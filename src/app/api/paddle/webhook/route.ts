import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { orders } from "@/db/schema";
import { syncOrderWithPaddle } from "@/lib/orders";
import { getPaddleConfig, verifyPaddleSignature } from "@/lib/paddle";

export const dynamic = "force-dynamic";

const HANDLED = new Set(["transaction.paid", "transaction.completed", "transaction.canceled"]);

/**
 * Paddle notification destination: point a webhook at /api/paddle/webhook and
 * subscribe it to transaction.paid, transaction.completed and
 * transaction.canceled.
 *
 * This is what marks an order paid when the customer pays but never comes back
 * to the site (closed tab, lost connection). Requests are only accepted with a
 * valid Paddle signature, and even then the transaction is fetched again from
 * Paddle's API before anything changes.
 */
export async function POST(req: Request) {
  const { webhookSecret } = getPaddleConfig();
  if (!webhookSecret) {
    // Not set up yet. A non-2xx answer makes Paddle retry later.
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }

  // The signature covers the exact bytes sent, so read the body as text.
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get("paddle-signature"), webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event_type?: unknown; data?: { id?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event.event_type;
  const transactionId = event.data?.id;
  if (typeof type !== "string" || !HANDLED.has(type) || typeof transactionId !== "string") {
    return NextResponse.json({ ignored: true });
  }

  await ensureDb();
  const [order] = await db.select().from(orders).where(eq(orders.paddleTransactionId, transactionId)).limit(1);
  // Not one of this shop's orders, e.g. a sale of something else on the same Paddle account.
  if (!order) return NextResponse.json({ ignored: true });

  try {
    const status = await syncOrderWithPaddle(order, { includeCancelled: true });
    return NextResponse.json({ orderNumber: order.orderNumber, status });
  } catch (e) {
    console.error(`Paddle webhook for order ${order.orderNumber} could not be processed`, e);
    // Non-2xx so Paddle sends it again.
    return NextResponse.json({ error: "Could not process event" }, { status: 500 });
  }
}
