import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { products } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Current price and stock for the products in a saved cart.
 * Carts live in the browser, so they can be older than the latest price change.
 */
export async function GET(req: Request) {
  await ensureDb();
  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ products: [] });

  const rows = await db
    .select({ id: products.id, price: products.price, stock: products.stock })
    .from(products)
    .where(inArray(products.id, ids));

  return NextResponse.json({ products: rows }, { headers: { "Cache-Control": "no-store" } });
}
