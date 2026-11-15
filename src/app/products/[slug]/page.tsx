import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelated, getReviews } from "@/lib/queries";
import { categoryLabel, formatPrice } from "@/lib/format";
import { Gallery } from "@/components/product/Gallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { ReviewForm } from "@/components/product/ReviewForm";
import { ProductCard } from "@/components/product/ProductCard";
import { Stars } from "@/components/ui/Stars";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found" };
  return { title: p.name, description: p.tagline, openGraph: { images: [p.images[0]] } };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [reviews, related] = await Promise.all([getReviews(product.id), getRelated(product)]);

  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  const savings = product.compareAtPrice ? product.compareAtPrice - product.price : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <nav className="text-xs uppercase tracking-[0.2em] text-ink/50">
        <Link href="/" className="hover:text-ink">Home</Link>
        <span className="mx-2">/</span>
        <Link href={`/shop?category=${product.category}`} className="hover:text-ink">{categoryLabel(product.category)}</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.brand}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="animate-fade-in lg:sticky lg:top-24 lg:self-start">
          <Gallery images={product.images} name={product.name} />
        </div>

        <div className="animate-fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-ink/50">{product.brand} · {product.scale}</span>
            {product.badge && (
              <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${product.badge === "Sale" ? "bg-accent text-white" : "bg-ink text-paper"}`}>
                {product.badge}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{product.name}</h1>
          <p className="mt-3 text-lg text-ink/60">{product.tagline}</p>

          {product.reviewCount > 0 && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm">
              <Stars rating={product.rating} size={16} />
              <span className="font-medium">{product.rating.toFixed(1)}</span>
              <span className="text-ink/50 underline-offset-2 hover:underline">{product.reviewCount} reviews</span>
            </a>
          )}

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-4xl">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <>
                <span className="text-lg text-ink/40 line-through">{formatPrice(product.compareAtPrice)}</span>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">Save {formatPrice(savings)}</span>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${product.stock === 0 ? "bg-ink/30" : product.stock <= 5 ? "bg-accent animate-pulse" : "bg-emerald-500"}`} />
            {product.stock === 0 ? "Sold out" : product.stock <= 5 ? `Only ${product.stock} left — selling fast` : "In stock, ships in 1–2 business days"}
          </div>

          <div className="mt-8">
            <PurchasePanel
              item={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                brand: product.brand,
                image: product.images[0],
                price: product.price,
                stock: product.stock,
              }}
            />
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs">
            {[
              ["🛡️", "Authenticity guaranteed"],
              ["📦", "Collector-grade packing"],
              ["↩️", "30-day returns"],
            ].map(([i, t]) => (
              <div key={t} className="rounded-2xl bg-white px-2 py-4">
                <div className="text-xl">{i}</div>
                <p className="mt-1 text-ink/70">{t}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 divide-y divide-ink/10 border-y border-ink/10">
            <details open className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
                Description <span className="text-lg transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 leading-relaxed text-ink/75">{product.description}</p>
              <ul className="mt-4 space-y-2">
                {product.highlights.map((h) => (
                  <li key={h} className="flex gap-3 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {h}
                  </li>
                ))}
              </ul>
            </details>
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
                Specifications <span className="text-lg transition group-open:rotate-45">+</span>
              </summary>
              <dl className="mt-4 divide-y divide-ink/5 text-sm">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-ink/50">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <details className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
                Shipping &amp; Returns <span className="text-lg transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-ink/75">
                Free insured standard shipping on orders over $150. Express insured shipping available at checkout. Carded
                items ship in acid-free clamshells and are double-boxed. Unopened items may be returned within 30 days.
              </p>
            </details>
          </div>
        </div>
      </div>

      {/* REVIEWS */}
      <section id="reviews" className="mt-24 scroll-mt-24">
        <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
          <div>
            <h2 className="font-display text-4xl tracking-tight">Reviews</h2>
            <div className="mt-6 flex items-end gap-3">
              <span className="font-display text-6xl">{product.rating.toFixed(1)}</span>
              <div className="pb-2">
                <Stars rating={product.rating} size={18} />
                <p className="mt-1 text-sm text-ink/50">Based on {product.reviewCount} reviews</p>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              {dist.map(({ n, c }) => (
                <div key={n} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-ink/60">{n}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} />
                  </div>
                  <span className="w-6 text-right text-ink/50">{c}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <ReviewForm productId={product.id} />
            </div>
          </div>
          <ul className="space-y-4">
            {reviews.length === 0 && <li className="rounded-3xl bg-white p-8 text-ink/60">No reviews yet — be the first.</li>}
            {reviews.map((r) => (
              <li key={r.id} className="rounded-3xl bg-white p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <time className="text-xs text-ink/40">
                    {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </time>
                </div>
                <h3 className="mt-3 text-lg font-medium">{r.title}</h3>
                <p className="mt-2 leading-relaxed text-ink/70">{r.body}</p>
                <p className="mt-4 text-sm">
                  <span className="font-medium">{r.author}</span>
                  {r.location && <span className="text-ink/50"> · {r.location}</span>}
                  {r.verified && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">✓ Verified buyer</span>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-display text-4xl tracking-tight">You may also like</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
