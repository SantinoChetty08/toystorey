import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { orderItems, orders, products } from "@/db/schema";
import { computeTotals, SHIPPING_METHODS } from "@/lib/format";
import { getPaddle } from "@/lib/paddle/server";
import { releaseOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

class CheckoutError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}


export async function POST(req: Request) {
  await ensureDb();
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const email = str(body.email);
  const fullName = str(body.fullName);
  const address = str(body.address, 200);
  const city = str(body.city);
  const region = str(body.region);
  const postalCode = str(body.postalCode, 20);
  const country = str(body.country) || "United States";
  const shippingMethod = SHIPPING_METHODS.some((m) => m.id === body.shippingMethod) ? String(body.shippingMethod) : "standard";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!fullName || !address || !city || !region || !postalCode)
    return NextResponse.json({ error: "Please complete your shipping address." }, { status: 400 });

  const wanted = new Map<number, number>();
  for (const it of body.items as { id: unknown; quantity: unknown }[]) {
    const id = Number(it.id);
    const q = Math.floor(Number(it.quantity));
    if (!Number.isInteger(id) || !Number.isFinite(q) || q < 1) continue;
    wanted.set(id, (wanted.get(id) ?? 0) + Math.min(q, 99));
  }
  if (wanted.size === 0) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

  let orderId: number | null = null;
  try {
    // 1) Reserve stock and create a pending order atomically.
    const created = await db.transaction(async (tx) => {
      const rows = await tx.select().from(products).where(inArray(products.id, [...wanted.keys()]));
      if (rows.length !== wanted.size) throw new CheckoutError("Some items are no longer available.", 409);

      let subtotal = 0;
      for (const p of rows) {
        const q = wanted.get(p.id)!;
        if (p.stock < q)
          throw new CheckoutError(
            p.stock === 0 ? `${p.name} just sold out.` : `Only ${p.stock} of ${p.name} left in stock.`,
            409,
          );
        subtotal += p.price * q;
      }
      for (const p of rows) {
        const q = wanted.get(p.id)!;
        const updated = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${q}` })
          .where(and(eq(products.id, p.id), gte(products.stock, q)))
          .returning({ id: products.id });
        if (updated.length === 0) throw new CheckoutError(`${p.name} just sold out.`, 409);
      }

      const totals = computeTotals(subtotal, shippingMethod);
      const orderNumber = `TS-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const [order] = await tx
        .insert(orders)
        .values({ orderNumber, email, fullName, address, city, region, postalCode, country, shippingMethod, ...totals, status: "pending_payment" })
        .returning();
      await tx.insert(orderItems).values(
        rows.map((p) => ({
          orderId: order.id,
          productId: p.id,
          name: p.name,
          image: p.images[0],
          price: p.price,
          quantity: wanted.get(p.id)!,
        })),
      );
      return { order, rows, shipping: totals.shipping };
    });
    orderId = created.order.id;

    // 2) Create a Paddle transaction with the exact cart prices (Paddle calculates tax as merchant of record).
    const lineItems = created.rows.map((p) => ({
      quantity: wanted.get(p.id)!,
      price: {
        description: `ToyStorey order ${created.order.orderNumber}: ${p.name}`,
        name: p.name,
        unitPrice: { amount: String(p.price), currencyCode: "USD" as const },
        product: { name: p.name.slice(0, 200), description: p.tagline, taxCategory: "standard" as const },
      },
    }));
    if (created.shipping > 0) {
      const method = SHIPPING_METHODS.find((m) => m.id === shippingMethod)!;
      lineItems.push({
        quantity: 1,
        price: {
          description: `${method.label} shipping for ${created.order.orderNumber}`,
          name: method.label,
          unitPrice: { amount: String(created.shipping), currencyCode: "USD" as const },
          product: { name: `Shipping: ${method.label}`, description: method.eta, taxCategory: "standard" as const },
        },
      });
    }

    const transaction = await getPaddle().transactions.create({
      items: lineItems,
      currencyCode: "USD",
      customData: { orderNumber: created.order.orderNumber, orderId: String(created.order.id) },
    });

    await db
      .update(orders)
      .set({ paddleTransactionId: transaction.id })
      .where(eq(orders.id, created.order.id));

    return NextResponse.json({ orderNumber: created.order.orderNumber, transactionId: transaction.id }, { status: 201 });
  } catch (e) {
    if (orderId) await releaseOrder(orderId).catch(() => {});
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Checkout failed:", e);
    const notConfigured = e instanceof Error && e.message.includes("not configured");
    return NextResponse.json(
      { error: notConfigured ? "Payments aren't configured yet. Please try again later." : "We couldn't start your payment. Please try again." },
      { status: 500 },
    );
  }
}
