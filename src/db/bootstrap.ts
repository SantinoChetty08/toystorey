import "server-only";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { STOREWIDE_SALE } from "@/lib/format";
import { reviewerNames, reviewTemplates, seedProducts } from "@/lib/seed-data";

/**
 * Bump whenever the demo catalog (src/lib/seed-data*.ts) gains products.
 * On the next start, products whose slug is not in the database are added
 * once. Existing rows are never modified, and anything deleted after a given
 * version has been applied stays deleted.
 *
 * Set SEED_DEMO_DATA=false to stop demo products being inserted at all
 * (recommended once the real catalog is loaded).
 */
const SEED_VERSION = 2;

const DDL = `
CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text NOT NULL,
  category text NOT NULL,
  scale text NOT NULL,
  price integer NOT NULL,
  compare_at_price integer,
  images jsonb NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  highlights jsonb NOT NULL,
  specs jsonb NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  badge text,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reviews (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author text NOT NULL,
  location text,
  rating integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL,
  shipping_method text NOT NULL,
  subtotal integer NOT NULL,
  shipping integer NOT NULL,
  tax integer NOT NULL,
  total integer NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  name text NOT NULL,
  image text NOT NULL,
  price integer NOT NULL,
  quantity integer NOT NULL
);
CREATE TABLE IF NOT EXISTS store_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
-- Payments (Paddle): added to databases created before payments existed.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paddle_transaction_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamp;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_note text;
CREATE INDEX IF NOT EXISTS orders_paddle_transaction_id_idx ON orders (paddle_transaction_id);
`;

// Deterministic pseudo-random generator so seeds are stable
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function getMetaNumber(client: PoolClient, key: string) {
  const res = await client.query<{ value: string }>("SELECT value FROM store_meta WHERE key = $1", [key]);
  return Number(res.rows[0]?.value ?? 0);
}

async function setMeta(client: PoolClient, key: string, value: number) {
  await client.query(
    `INSERT INTO store_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, String(value)],
  );
}

/** Adds demo products that are not in the database yet. Returns the ids it inserted. */
async function seedCatalog(client: PoolClient): Promise<number[]> {
  if (process.env.SEED_DEMO_DATA === "false") return [];
  if ((await getMetaNumber(client, "seed_version")) >= SEED_VERSION) return [];

  const inserted: number[] = [];
  const now = Date.now();
  for (let i = 0; i < seedProducts.length; i++) {
    const p = seedProducts[i];
    const createdAt = new Date(now - p.daysAgo * 86400000);
    const res = await client.query<{ id: number }>(
      `INSERT INTO products (slug,name,brand,category,scale,price,compare_at_price,images,tagline,description,highlights,specs,stock,badge,featured,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [
        p.slug, p.name, p.brand, p.category, p.scale, p.price, p.compareAtPrice ?? null,
        JSON.stringify(p.images), p.tagline, p.description, JSON.stringify(p.highlights),
        JSON.stringify(p.specs), p.stock, p.badge ?? null, p.featured ?? false, createdAt,
      ],
    );
    // Already in the catalog from an earlier seed version: leave it untouched.
    if (!res.rows[0]) continue;

    const productId = res.rows[0].id;
    inserted.push(productId);
    const rand = rng(i * 7919 + 13);
    const templates = reviewTemplates[p.category] ?? reviewTemplates.diecast;
    const count = 3 + Math.floor(rand() * 4);
    const used = new Set<number>();
    for (let r = 0; r < count; r++) {
      let t = Math.floor(rand() * templates.length);
      let guard = 0;
      while (used.has(t) && guard++ < 10) t = (t + 1) % templates.length;
      used.add(t);
      const tpl = templates[t];
      const [author, location] = reviewerNames[Math.floor(rand() * reviewerNames.length)];
      const daysAgo = Math.floor(rand() * Math.max(1, p.daysAgo + 30));
      await client.query(
        `INSERT INTO reviews (product_id,author,location,rating,title,body,verified,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [productId, author, location, tpl.rating, tpl.title, tpl.body, rand() > 0.15, new Date(now - daysAgo * 86400000)],
      );
    }
  }

  await setMeta(client, "seed_version", SEED_VERSION);
  return inserted;
}

/**
 * Storewide sale (STOREWIDE_SALE in src/lib/format.ts).
 *
 * The first time a database sees this sale version, every product's selling
 * price is reduced by the sale percentage and the price it had before becomes
 * the struck-through "was" price. Fractions of a cent round down, in the
 * customer's favour. After that, only products seeded later are brought in
 * line, so restarting the app never discounts a product twice.
 *
 * To end the sale by hand:
 *   UPDATE products SET price = compare_at_price, compare_at_price = NULL
 *   WHERE compare_at_price IS NOT NULL;
 */
async function applyStorewideSale(client: PoolClient, newlySeeded: number[]) {
  const { version, percentOff } = STOREWIDE_SALE;
  if (!(percentOff > 0 && percentOff < 100)) return;

  // Integer maths on cents; Postgres integer division truncates.
  const discount = `UPDATE products SET compare_at_price = price, price = (price * ${100 - percentOff}) / 100`;

  if ((await getMetaNumber(client, "sale_version")) < version) {
    await client.query(discount);
    await setMeta(client, "sale_version", version);
  } else if (newlySeeded.length > 0) {
    await client.query(`${discount} WHERE id = ANY($1::int[])`, [newlySeeded]);
  }
}

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(424242)");
    const newlySeeded = await seedCatalog(client);
    await applyStorewideSale(client, newlySeeded);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const g = globalThis as typeof globalThis & { __toystoreyReady?: Promise<void> };

export function ensureDb(): Promise<void> {
  if (!g.__toystoreyReady) {
    g.__toystoreyReady = (async () => {
      await pool.query(DDL);
      await migrate();
    })().catch((e) => {
      g.__toystoreyReady = undefined;
      throw e;
    });
  }
  return g.__toystoreyReady;
}
