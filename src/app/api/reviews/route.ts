import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { products, reviews } from "@/db/schema";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  await ensureDb();
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const productId = Number(body.productId);
  const rating = Math.round(Number(body.rating));
  const author = str(body.author, 40);
  const location = str(body.location, 40) || null;
  const title = str(body.title, 80);
  const text = str(body.body, 1500);

  if (!Number.isInteger(productId) || rating < 1 || rating > 5 || !author || !title || text.length < 10) {
    return NextResponse.json({ error: "Please complete all fields (review must be at least 10 characters)." }, { status: 400 });
  }
  const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const [created] = await db
    .insert(reviews)
    .values({ productId, rating, author, location, title, body: text, verified: false })
    .returning();
  return NextResponse.json({ review: created }, { status: 201 });
}
