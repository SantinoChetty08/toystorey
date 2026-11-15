import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { orders } from "@/db/schema";
import { cancelPendingOrder, syncOrderWithPaddle } from "@/lib/orders";
import { getPaddleConfig } from "@/lib/paddle";

/**
 * Called when the customer closes Paddle's payment window without paying, so
 * the reserved stock goes back on sale straight away instead of waiting for
 * the reservation to run out. Only ever affects orders that are still unpaid:
 * Paddle is asked first, and an order it reports as paid is recorded as paid.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ orderNumber: string }> }) {
  await ensureDb();
  const { orderNumber } = await ctx.params;
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  let status = order.status;
  if (status === "pending") {
    if (order.paddleTransactionId && getPaddleConfig().enabled) {
      try {
        status = await syncOrderWithPaddle(order);
      } catch {
        // Paddle can't be reached, so we can't be sure it is unpaid. Leave the
        // reservation in place; it is released automatically later.
        return NextResponse.json({ status: "pending" });
      }
    }
    if (status === "pending") {
      await cancelPendingOrder(order.id);
      status = "cancelled";
    }
  }
  return NextResponse.json({ status });
}
