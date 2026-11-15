import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { orders } from "@/db/schema";
import { getPaddle, getWebhookSecret } from "@/lib/paddle/server";
import { releaseOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

// Paddle notification handler. The signature is verified against the RAW request body
// (read as text, never parsed first). Handlers are idempotent because Paddle retries deliveries.
export async function POST(req: Request) {
  await ensureDb();
  const rawBody = await req.text();
  const signature = req.headers.get("paddle-signature") ?? "";

  let event;
  try {
    event = await getPaddle().webhooks.unmarshal(rawBody, getWebhookSecret(), signature);
  } catch (e) {
    console.warn("Rejected Paddle webhook:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const type = String(event.eventType);
  const data = event.data as unknown as { id?: string; customData?: Record<string, string> | null };
  const orderNumber = data.customData?.orderNumber;

  if (orderNumber && data.id) {
    if (type === "transaction.completed" || type === "transaction.paid") {
      await db
        .update(orders)
        .set({ status: "paid", paddleTransactionId: data.id })
        .where(and(eq(orders.orderNumber, orderNumber), eq(orders.status, "pending_payment")));
    } else if (type === "transaction.payment_failed" || type === "transaction.canceled") {
      const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
      if (o) await releaseOrder(o.id);
    }
  }

  return NextResponse.json({ received: true });
}
