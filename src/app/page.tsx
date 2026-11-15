import Link from "next/link";
import {
  getFacets,
  getFeatured,
  getProducts,
  getStoreStats,
  getTopReviews,
  type ProductCard as TProduct,
} from "@/lib/queries";
import { CATEGORIES } from "@/lib/format";
import { ProductCard } from "@/components/product/ProductCard";
import { Stars } from "@/components/ui/Stars";

export const dynamic = "force-dynamic";

const BRANDS = ["Hot Wheels", "LEGO", "Mini GT", "Traxxas", "Tomica", "AUTOart", "Kyosho", "Bandai", "Axial", "Matchbox", "Tamiya", "Arrma", "Norev", "Greenlight"];

function ProductRow({
  eyebrow,
  title,
  href,
  cta,
  products,
}: {
  eyebrow: string;
  title: string;
  href: string;
  cta: string;
  products: TProduct[];
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">{title}</h2>
        </div>
        <Link href={href} className="link-underline text-sm">
          {cta} →
        </Link>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    </>
  );
}

export default async function Home() {
  const [featured, hotWheels, kits, stats, top, facets] = await Promise.all([
    getFeatured(8),
    getProducts({ brand: ["Hot Wheels"], sort: "newest" }),
    getProducts({ category: ["kits"], sort: "newest" }),
    getStoreStats(),
    getTopReviews(3),
    getFacets(),
  ]);
  const catCount = Object.fromEntries(facets.categories.map((c) => [c.value, c.count]));
  const productCount = facets.categories.reduce((n, c) => n + c.count, 0);
  const cats = Object.entries(CATEGORIES);

  // Brand rows show the newest pieces that aren't already in "Featured" above them.
  const inFeatured = new Set(featured.map((p) => p.id));
  const hotWheelsRow = hotWheels.filter((p) => !inFeatured.has(p.id)).slice(0, 4);
  const kitsRow = kits.filter((p) => !inFeatured.has(p.id)).slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="relative isolate flex min-h-[92vh] items-end overflow-hidden bg-ink text-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80 animate-ken-burns" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/80 via-ink/20 to-transparent" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-40 sm:px-6 lg:px-8 lg:pb-28">
          <p className="animate-fade-up text-xs uppercase tracking-[0.3em] text-paper/70">
            The collector&apos;s toy store · For grown-ups
          </p>
          <h1
            className="mt-6 max-w-3xl font-display text-5xl leading-[1.02] tracking-tight animate-fade-up sm:text-7xl lg:text-8xl"
            style={{ animationDelay: "120ms" }}
          >
            Small cars.
            <br />
            <span className="italic text-accent">Serious</span> collections.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/75 animate-fade-up" style={{ animationDelay: "240ms" }}>
            Red Line Club exclusives and Super Treasure Hunts, LEGO Technic flagships, hobby-grade RC and museum-quality
            collectibles, hand inspected and shipped in collector-grade protection.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: "360ms" }}>
            <Link href="/shop" className="group inline-flex items-center gap-2 rounded-full bg-paper px-8 py-4 font-medium text-ink transition hover:bg-accent hover:text-white">
              Shop the collection
              <svg className="transition group-hover:translate-x-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
            </Link>
            <Link href="/shop?sort=newest" className="inline-flex items-center rounded-full border border-paper/30 px-8 py-4 font-medium backdrop-blur transition hover:border-paper hover:bg-paper/10">
              New drops
            </Link>
          </div>
          <dl className="mt-16 grid max-w-xl grid-cols-3 gap-6 border-t border-paper/15 pt-8 animate-fade-up" style={{ animationDelay: "480ms" }}>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-paper/50">Rating</dt>
              <dd className="mt-1 font-display text-3xl">{stats.avgRating.toFixed(1)}<span className="text-lg text-paper/50">/5</span></dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-paper/50">Reviews</dt>
              <dd className="mt-1 font-display text-3xl">{stats.reviewCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-paper/50">In the vault</dt>
              <dd className="mt-1 font-display text-3xl">{productCount}<span className="text-lg text-paper/50"> pieces</span></dd>
            </div>
          </dl>
        </div>
      </section>

      {/* BRAND MARQUEE */}
      <section className="overflow-hidden border-b border-ink/10 bg-paper py-6">
        <div className="flex w-max animate-marquee gap-14 whitespace-nowrap">
          {[...BRANDS, ...BRANDS].map((b, i) => (
            <span key={i} className="font-display text-2xl italic text-ink/35">
              {b}
            </span>
          ))}
        </div>
      </section>

      {/* COLLECTIONS: one large tile + four small ones */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Collections</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Find your next obsession</h2>
          </div>
          <Link href="/shop" className="link-underline text-sm">Browse everything →</Link>
        </div>
        <div className="mt-12 grid grid-cols-2 auto-rows-[180px] gap-3 sm:auto-rows-[240px] sm:gap-4 lg:grid-cols-4 lg:auto-rows-[300px]">
          {cats.map(([key, c], i) => {
            const big = i === 0;
            return (
              <Link
                key={key}
                href={`/shop?category=${key}`}
                className={`group relative overflow-hidden rounded-3xl bg-ink text-paper animate-fade-up ${big ? "col-span-2 row-span-2" : ""}`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt={c.label} className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-[1.2s] ease-out group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
                <div className={`absolute inset-x-0 bottom-0 ${big ? "p-6 sm:p-8" : "p-4 sm:p-6"}`}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-paper/60 sm:text-xs">{catCount[key] ?? 0} pieces</p>
                  <h3 className={`mt-1 font-display ${big ? "text-4xl sm:text-5xl" : "text-lg sm:text-2xl lg:text-3xl"}`}>{c.label}</h3>
                  <p
                    className={`mt-2 max-w-sm text-sm text-paper/70 transition duration-500 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 ${
                      big ? "" : "hidden lg:block"
                    }`}
                  >
                    {c.blurb}
                  </p>
                </div>
                <span className={`absolute grid place-items-center rounded-full bg-paper/15 backdrop-blur transition duration-500 group-hover:rotate-[-45deg] group-hover:bg-accent ${big ? "right-6 top-6 h-11 w-11" : "right-3 top-3 h-9 w-9 sm:right-5 sm:top-5 sm:h-11 sm:w-11"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-sand/60 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ProductRow eyebrow="Featured drops" title="Curated this week" href="/shop" cta="View all" products={featured} />
        </div>
      </section>

      {/* LATEST HOT WHEELS */}
      {hotWheelsRow.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
          <ProductRow
            eyebrow="Fresh off the pegs"
            title="Latest Hot Wheels"
            href="/shop?brand=Hot%20Wheels&sort=newest"
            cta="All Hot Wheels"
            products={hotWheelsRow}
          />
        </section>
      )}

      {/* EDITORIAL */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 overflow-hidden rounded-[2rem] bg-ink text-paper lg:grid-cols-2">
          <div className="relative h-80 lg:h-full lg:min-h-[560px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/col-diecast.jpg" alt="The vault" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="p-8 sm:p-14">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">The Vault</p>
            <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              Every chase car, <span className="italic">verified.</span>
            </h2>
            <p className="mt-6 leading-relaxed text-paper/70">
              Our in-house team inspects every Super Treasure Hunt, RLC and graded piece under daylight-balanced light.
              Cards are photographed, sealed in acid-free protectors, and double-boxed. If it isn&apos;t perfect, it
              doesn&apos;t ship.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["Authenticity guarantee", "Or your money back, no questions."],
                ["Collector packing", "Clamshell + double box on every card."],
                ["Fully insured", "Every parcel, door to door."],
                ["30-day returns", "Sealed items, hassle free."],
              ].map(([t, d]) => (
                <li key={t} className="rounded-2xl border border-paper/10 p-4">
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-sm text-paper/55">{d}</p>
                </li>
              ))}
            </ul>
            <Link href="/shop?category=diecast" className="mt-10 inline-flex rounded-full bg-paper px-7 py-3.5 font-medium text-ink transition hover:bg-accent hover:text-white">
              Explore die-cast
            </Link>
          </div>
        </div>
      </section>

      {/* LEGO & KITS */}
      {kitsRow.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ProductRow
            eyebrow="Build night"
            title="LEGO & kits for grown-ups"
            href="/shop?category=kits"
            cta="All LEGO & kits"
            products={kitsRow}
          />
        </section>
      )}

      {/* REVIEWS */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <Stars rating={stats.avgRating} size={22} />
          <h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Loved by collectors</h2>
          <p className="mt-3 text-sm text-ink/55">
            {stats.avgRating.toFixed(1)} out of 5 across {stats.reviewCount} reviews
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {top.map((r, i) => (
            <figure key={r.id} className="flex flex-col rounded-3xl bg-white p-8 shadow-[0_1px_0_rgba(0,0,0,0.04)] animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
              <Stars rating={r.rating} />
              <p className="mt-4 font-display text-xl">“{r.title}”</p>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">{r.body}</blockquote>
              <figcaption className="mt-6 border-t border-ink/10 pt-4 text-sm">
                <span className="font-medium">{r.author}</span>
                <span className="text-ink/50"> · {r.location}</span>
                <Link href={`/products/${r.productSlug}`} className="mt-1 block text-xs text-accent hover:underline">
                  {r.productName}
                </Link>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
