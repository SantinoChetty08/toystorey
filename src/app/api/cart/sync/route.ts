import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { products } from "@/db/schema";

// Returns current price/stock for the product IDs in a client's saved cart,
// so stale localStorage prices never drift from what the server will charge.
export async function POST(req: Request) {
  await ensureDb();
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n)).slice(0, 100)
    : [];
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const rows = await db
    .select({ id: products.id, price: products.price, stock: products.stock, name: products.name, slug: products.slug, image: products.images })
    .from(products)
    .where(inArray(products.id, ids));

  return NextResponse.json({
    items: rows.map((r) => ({ id: r.id, price: r.price, stock: r.stock, name: r.name, slug: r.slug, image: r.image[0] })),
  });
}
