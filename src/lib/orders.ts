import "server-only";
import { randomInt } from "crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, type Order, type Product } from "@/db/schema";
import { computeTotals } from "@/lib/format";
import { getPaddleConfig, getPaddleTransaction, type PaddleTransaction } from "@/lib/paddle";

/**
 * Order statuses
 *   pending      stock is reserved; waiting for Paddle to confirm payment
 *   paid         Paddle confirmed payment and it matches the order
 *   paid_review  Paddle confirmed payment, but a person needs to look at it
 *                (the reason is stored in orders.payment_note)
 *   cancelled    never paid; the reserved stock went back on sale
 *   test         placed while payments were not connected; nothing was charged
 *   confirmed    demo orders from before payments were added
 */
export type OrderStatus = "pending" | "paid" | "paid_review" | "cancelled" | "test" | "confirmed";

/** How long unpaid stock stays reserved before it goes back on sale. */
export const RESERVATION_MINUTES = 45;

export class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type OrderInput = {
  email: string;
  fullName: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  shippingMethod: string;
  /** product id -> quantity */
  items: Map<number, number>;
};

// No 0/O or 1/I, so a number read out over the phone can't be mistyped.
const ORDER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newOrderNumber() {
  let s = "TS-";
  for (let i = 0; i < 10; i++) s += ORDER_ALPHABET[randomInt(ORDER_ALPHABET.length)];
  return s;
}

/**
 * Checks stock, reserves it and stores the order, all in one database
 * transaction, so two buyers can never both get the last piece.
 * Prices always come from the database, never from the browser.
 */
export async function createOrder(input: OrderInput, status: "pending" | "test") {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(products).where(inArray(products.id, [...input.items.keys()]));
    if (rows.length !== input.items.size) throw new CheckoutError("Some items are no longer available.", 409);

    let subtotal = 0;
    for (const p of rows) {
      const q = input.items.get(p.id)!;
      if (p.stock < q) {
        throw new CheckoutError(
          p.stock === 0 ? `${p.name} just sold out.` : `Only ${p.stock} of ${p.name} left in stock.`,
          409,
        );
      }
      subtotal += p.price * q;
    }

    for (const p of rows) {
      const q = input.items.get(p.id)!;
      const updated = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${q}` })
        .where(and(eq(products.id, p.id), gte(products.stock, q)))
        .returning({ id: products.id });
      if (updated.length === 0) throw new CheckoutError(`${p.name} just sold out.`, 409);
    }

    const totals = computeTotals(subtotal, input.shippingMethod);
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: newOrderNumber(),
        email: input.email,
        fullName: input.fullName,
        address: input.address,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
        country: input.country,
        shippingMethod: input.shippingMethod,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        // Tax is calculated and collected by Paddle; it is filled in once payment is confirmed.
        tax: 0,
        total: totals.total,
        status,
      })
      .returning();

    await tx.insert(orderItems).values(
      rows.map((p) => ({
        orderId: order.id,
        productId: p.id,
        name: p.name,
        image: p.images[0],
        price: p.price,
        quantity: input.items.get(p.id)!,
      })),
    );

    const lines: { product: Product; quantity: number }[] = rows.map((p) => ({ product: p, quantity: input.items.get(p.id)! }));
    return { order, lines };
  });
}

/**
 * Puts reserved stock back on sale and marks the order cancelled.
 * Only acts on orders that are still waiting for payment; returns false otherwise.
 */
export async function cancelPendingOrder(orderId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    // The status check and the change happen in one statement, so a payment
    // arriving at the same moment can't be cancelled from under itself.
    const [changed] = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id });
    if (!changed) return false;

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${it.quantity}` })
        .where(eq(products.id, it.productId));
    }
    return true;
  });
}

/**
 * Records a payment that Paddle has confirmed. Safe to call more than once
 * (the webhook and the customer's return to the site both end up here).
 */
async function recordPayment(orderId: number, txn: PaddleTransaction): Promise<string> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) return "missing";
    // Already recorded, or not an order that payments apply to (test and demo orders).
    if (order.status !== "pending" && order.status !== "cancelled") return order.status;

    const problems: string[] = [];

    // 1. What was paid for must be what this shop reserved. Compared before
    //    tax, so it holds whether Paddle adds tax on top or includes it.
    const expected = order.subtotal + order.shipping;
    const charged = txn.items.reduce((n, i) => n + Number(i.price?.unit_price?.amount) * i.quantity, 0);
    if (charged !== expected) {
      problems.push(`Paddle's items add up to ${charged} cents before tax, but this order expects ${expected}.`);
    }
    if (txn.currency_code !== "USD") problems.push(`Paid in ${txn.currency_code}, expected USD.`);

    // 2. A payment can land after the reservation ran out. Take the stock
    //    again if it is still there; otherwise a person has to sort it out.
    if (order.status === "cancelled") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const stock = await tx
        .select({ id: products.id, stock: products.stock })
        .from(products)
        .where(inArray(products.id, items.map((i) => i.productId)))
        .for("update");
      const available = new Map(stock.map((s) => [s.id, s.stock]));
      const short = items.filter((i) => (available.get(i.productId) ?? 0) < i.quantity);
      if (short.length > 0) {
        problems.push(`Paid after the reservation expired and no longer in stock: ${short.map((i) => i.name).join(", ")}.`);
      } else {
        for (const it of items) {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} - ${it.quantity}` })
            .where(eq(products.id, it.productId));
        }
      }
    }

    const totals = txn.details?.totals;
    const tax = Number(totals?.tax ?? 0);
    const total = Number(totals?.grand_total ?? totals?.total ?? expected);
    const status: OrderStatus = problems.length > 0 ? "paid_review" : "paid";

    await tx
      .update(orders)
      .set({
        status,
        tax: Number.isFinite(tax) ? tax : 0,
        total: Number.isFinite(total) ? total : expected,
        paidAt: new Date(),
        paymentNote: problems.length > 0 ? problems.join(" ") : null,
      })
      .where(eq(orders.id, orderId));
    return status;
  });
}

/**
 * Asks Paddle what happened to an order's transaction and updates the order
 * to match. Paddle's API is the source of truth: nothing the browser or a
 * webhook body says is trusted on its own.
 *
 * Orders whose reservation already ran out are only re-checked when
 * `includeCancelled` is set (used by the webhook, which is how a late payment
 * is noticed).
 */
export async function syncOrderWithPaddle(order: Order, opts: { includeCancelled?: boolean } = {}): Promise<string> {
  const open = order.status === "pending" || (opts.includeCancelled && order.status === "cancelled");
  if (!order.paddleTransactionId || !open) return order.status;

  const txn = await getPaddleTransaction(order.paddleTransactionId);
  if (txn.status === "paid" || txn.status === "completed") return recordPayment(order.id, txn);
  if (txn.status === "canceled" && order.status === "pending") {
    await cancelPendingOrder(order.id);
    return "cancelled";
  }
  return order.status;
}

/**
 * Frees stock held by checkouts that were abandoned. Called before each new
 * order is taken, so no scheduled job is needed.
 */
export async function releaseExpiredOrders(limit = 10) {
  const stale = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        sql`${orders.createdAt} < now() - make_interval(mins => ${RESERVATION_MINUTES})`,
      ),
    )
    .limit(limit);

  const paddle = getPaddleConfig();
  for (const order of stale) {
    try {
      // The customer may have paid without coming back to the site, so ask
      // Paddle before letting the stock go.
      const status = paddle.enabled && order.paddleTransactionId ? await syncOrderWithPaddle(order) : order.status;
      if (status === "pending") await cancelPendingOrder(order.id);
    } catch (e) {
      // Paddle could not be reached: keep the reservation and try again next time.
      console.error(`Could not check expired order ${order.orderNumber} with Paddle`, e);
    }
  }
}
