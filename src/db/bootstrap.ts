import "server-only";
import { pool } from "@/db";
import { reviewerNames, reviewTemplates, seedProducts } from "@/lib/seed-data";

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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paddle_transaction_id text;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending_payment';
CREATE INDEX IF NOT EXISTS orders_paddle_txn_idx ON orders (paddle_transaction_id);
CREATE TABLE IF NOT EXISTS order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL,
  name text NOT NULL,
  image text NOT NULL,
  price integer NOT NULL,
  quantity integer NOT NULL
);
`;

// Deterministic pseudo-random generator so seeds are stable
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(424242)");
    // Additive seeding: insert any catalog entry whose slug is not present yet.
    // This lets new drops ship to existing databases without wiping orders or reviews.
    const now = Date.now();
    for (let i = 0; i < seedProducts.length; i++) {
      const p = seedProducts[i];
      const createdAt = new Date(now - p.daysAgo * 86400000);
      const res = await client.query<{ id: number }>(
        `INSERT INTO products (slug,name,brand,category,scale,price,compare_at_price,images,tagline,description,highlights,specs,stock,badge,featured,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (slug) DO NOTHING RETURNING id`,
        [
          p.slug, p.name, p.brand, p.category, p.scale, p.price, p.compareAtPrice ?? null,
          JSON.stringify(p.images), p.tagline, p.description, JSON.stringify(p.highlights),
          JSON.stringify(p.specs), p.stock, p.badge ?? null, p.featured ?? false, createdAt,
        ],
      );
      if (res.rows.length === 0) continue; // already seeded
      const productId = res.rows[0].id;
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
      await seed();
    })().catch((e) => {
      g.__toystoreyReady = undefined;
      throw e;
    });
  }
  return g.__toystoreyReady;
}
