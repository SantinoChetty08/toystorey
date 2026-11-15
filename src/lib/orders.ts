import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";

// Returns reserved stock to inventory when a pending order fails or is cancelled.
// Safe to call more than once: it only acts on orders still in pending_payment.
export async function releaseOrder(orderId: number) {
  await db.transaction(async (tx) => {
    const [o] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
    if (!o || o.status !== "pending_payment") return;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${it.quantity}` })
        .where(eq(products.id, it.productId));
    }
    await tx.update(orders).set({ status: "failed" }).where(eq(orders.id, orderId));
  });
}
