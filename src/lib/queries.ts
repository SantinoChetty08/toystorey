import "server-only";
import { and, asc, desc, eq, gt, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { ensureDb } from "@/db/bootstrap";
import { orderItems, orders, products, reviews, type Product } from "@/db/schema";

export type ProductCard = Product & { rating: number; reviewCount: number };

const ratingSq = db
  .select({
    productId: reviews.productId,
    rating: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`.as("rating"),
    reviewCount: sql<number>`count(*)::int`.as("review_count"),
  })
  .from(reviews)
  .groupBy(reviews.productId)
  .as("r");

function baseSelect() {
  return db
    .select({
      product: products,
      rating: sql<number>`coalesce(${ratingSq.rating}, 0)::float`,
      reviewCount: sql<number>`coalesce(${ratingSq.reviewCount}, 0)::int`,
    })
    .from(products)
    .leftJoin(ratingSq, eq(ratingSq.productId, products.id));
}

type Row = { product: Product; rating: number; reviewCount: number };
const toCard = (r: Row): ProductCard => ({ ...r.product, rating: Number(r.rating), reviewCount: Number(r.reviewCount) });

export type ShopFilters = {
  category?: string[];
  brand?: string[];
  scale?: string[];
  min?: number;
  max?: number;
  inStock?: boolean;
  onSale?: boolean;
  q?: string;
  sort?: string;
};

export async function getProducts(f: ShopFilters = {}): Promise<ProductCard[]> {
  await ensureDb();
  const conds: SQL[] = [];
  if (f.category?.length) conds.push(inArray(products.category, f.category));
  if (f.brand?.length) conds.push(inArray(products.brand, f.brand));
  if (f.scale?.length) conds.push(inArray(products.scale, f.scale));
  if (f.min != null && !Number.isNaN(f.min)) conds.push(gte(products.price, Math.round(f.min * 100)));
  if (f.max != null && !Number.isNaN(f.max)) conds.push(lte(products.price, Math.round(f.max * 100)));
  if (f.inStock) conds.push(gt(products.stock, 0));
  if (f.onSale) conds.push(sql`${products.compareAtPrice} is not null`);
  if (f.q) {
    const term = `%${f.q}%`;
    const c = or(ilike(products.name, term), ilike(products.brand, term), ilike(products.tagline, term));
    if (c) conds.push(c);
  }
  let order: SQL[];
  switch (f.sort) {
    case "price-asc":
      order = [asc(products.price)];
      break;
    case "price-desc":
      order = [desc(products.price)];
      break;
    case "newest":
      order = [desc(products.createdAt)];
      break;
    case "rating":
      order = [sql`coalesce(${ratingSq.rating}, 0) desc`, sql`coalesce(${ratingSq.reviewCount}, 0) desc`];
      break;
    default:
      order = [desc(products.featured), desc(products.createdAt)];
  }
  const rows = await baseSelect()
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...order);
  return rows.map(toCard);
}

export async function getFacets() {
  await ensureDb();
  const all = await db
    .select({ brand: products.brand, scale: products.scale, category: products.category, price: products.price })
    .from(products);
  const count = (key: "brand" | "scale" | "category") => {
    const m = new Map<string, number>();
    all.forEach((p) => m.set(p[key], (m.get(p[key]) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([value, n]) => ({ value, count: n }));
  };
  const prices = all.map((p) => p.price);
  return {
    brands: count("brand"),
    scales: count("scale"),
    categories: count("category"),
    maxPrice: Math.ceil(Math.max(...prices, 0) / 100),
  };
}

export async function getFeatured(limit = 8) {
  await ensureDb();
  const rows = await baseSelect().where(eq(products.featured, true)).orderBy(desc(products.createdAt)).limit(limit);
  return rows.map(toCard);
}

export async function getNewArrivals(limit = 4) {
  await ensureDb();
  const rows = await baseSelect().orderBy(desc(products.createdAt)).limit(limit);
  return rows.map(toCard);
}

export async function getProductBySlug(slug: string) {
  await ensureDb();
  const rows = await baseSelect().where(eq(products.slug, slug)).limit(1);
  return rows[0] ? toCard(rows[0]) : null;
}

export async function getReviews(productId: number) {
  await ensureDb();
  return db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt));
}

export async function getRelated(p: Product, limit = 4) {
  await ensureDb();
  const rows = await baseSelect()
    .where(and(eq(products.category, p.category), ne(products.id, p.id)))
    .orderBy(desc(products.featured), desc(products.createdAt))
    .limit(limit);
  return rows.map(toCard);
}

export async function getTopReviews(limit = 3) {
  await ensureDb();
  return db
    .select({
      id: reviews.id,
      author: reviews.author,
      location: reviews.location,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.rating, 5))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function getStoreStats() {
  await ensureDb();
  const [r] = await db
    .select({ avg: sql<number>`coalesce(avg(${reviews.rating}),0)::float`, n: sql<number>`count(*)::int` })
    .from(reviews);
  return { avgRating: Number(r.avg), reviewCount: Number(r.n) };
}

export async function getOrder(orderNumber: string) {
  await ensureDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}
