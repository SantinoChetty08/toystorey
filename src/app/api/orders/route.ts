import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { orders } from "@/db/schema";
import { COUNTRIES, SHIPPING_METHODS } from "@/lib/format";
import { cancelPendingOrder, CheckoutError, createOrder, releaseExpiredOrders } from "@/lib/orders";
import { createPaddleTransaction, getPaddleConfig, PaddleError, type PaddleLine } from "@/lib/paddle";

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Public address of the site, as the customer's browser sees it. */
function siteOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

/** Paddle only accepts absolute https image links; anything else is left out. */
function paddleImage(src: string, origin: string) {
  try {
    const u = new URL(src, origin);
    return u.protocol === "https:" && /\.(jpe?g|png)$/i.test(u.pathname) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Starts a checkout.
 *
 * With Paddle connected: reserves the stock, stores the order as "pending",
 * creates a Paddle transaction for it and returns the transaction id, which
 * the browser hands to Paddle's payment window. The order only becomes "paid"
 * once Paddle itself confirms the payment.
 *
 * Without Paddle keys: stores a clearly labelled test order and charges nothing.
 */
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
  const country = COUNTRIES.find((c) => c.name === body.country)?.name ?? COUNTRIES[0].name;
  const shipping = SHIPPING_METHODS.find((m) => m.id === body.shippingMethod) ?? SHIPPING_METHODS[0];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!fullName || !address || !city || !region || !postalCode)
    return NextResponse.json({ error: "Please complete your shipping address." }, { status: 400 });

  const wanted = new Map<number, number>();
  for (const it of body.items as { id: unknown; quantity: unknown }[]) {
    const id = Number(it.id);
    const q = Math.floor(Number(it.quantity));
    if (!Number.isInteger(id) || !Number.isFinite(q) || q < 1) continue;
    wanted.set(id, Math.min((wanted.get(id) ?? 0) + q, 99));
  }
  if (wanted.size === 0) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });

  const paddle = getPaddleConfig();

  let created: Awaited<ReturnType<typeof createOrder>>;
  try {
    // Free stock held by abandoned checkouts before checking availability.
    await releaseExpiredOrders();
    created = await createOrder(
      { email, fullName, address, city, region, postalCode, country, shippingMethod: shipping.id, items: wanted },
      paddle.enabled ? "pending" : "test",
    );
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "We couldn't place your order. Please try again." }, { status: 500 });
  }

  const { order, lines } = created;
  if (!paddle.enabled) {
    return NextResponse.json({ orderNumber: order.orderNumber, mode: "test" }, { status: 201 });
  }

  try {
    const origin = siteOrigin(req);
    const paddleLines: PaddleLine[] = lines.map(({ product, quantity }) => ({
      name: product.name,
      description: `${product.brand}, ${product.scale}. ToyStorey order ${order.orderNumber}.`,
      unitAmount: product.price,
      quantity,
      imageUrl: paddleImage(product.images[0], origin),
    }));
    // Paddle has no separate shipping field, so shipping is a line of its own.
    if (order.shipping > 0) {
      paddleLines.push({
        name: `${shipping.label} shipping`,
        description: `Delivery in ${shipping.eta}. ToyStorey order ${order.orderNumber}.`,
        unitAmount: order.shipping,
        quantity: 1,
      });
    }

    const txn = await createPaddleTransaction(paddleLines, { order_number: order.orderNumber });
    await db.update(orders).set({ paddleTransactionId: txn.id }).where(eq(orders.id, order.id));
    return NextResponse.json({ orderNumber: order.orderNumber, mode: "paddle", transactionId: txn.id }, { status: 201 });
  } catch (e) {
    // The payment could not be started, so give the reserved stock back.
    await cancelPendingOrder(order.id).catch(() => {});
    const code = e instanceof PaddleError ? e.code : undefined;
    console.error(`Paddle could not start a payment for order ${order.orderNumber}`, e);
    return NextResponse.json(
      {
        error: `We couldn't start the payment, so nothing has been charged. Please try again in a moment.${code ? ` (Paddle: ${code})` : ""}`,
      },
      { status: 502 },
    );
  }
}
