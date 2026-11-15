import type { Metadata } from "next";
import { getFacets, getProducts } from "@/lib/queries";
import { BRAND_BLURBS, CATEGORIES, categoryLabel } from "@/lib/format";
import { ProductCard } from "@/components/product/ProductCard";
import { ShopToolbar } from "@/components/shop/ShopToolbar";
import { FilterPanel } from "@/components/shop/FilterPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shop" };

type SP = Record<string, string | string[] | undefined>;
const list = (v: string | string[] | undefined) => (v ? (Array.isArray(v) ? v : v.split(",")).filter(Boolean) : []);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters = {
    category: list(sp.category),
    brand: list(sp.brand),
    scale: list(sp.scale),
    min: one(sp.min) ? Number(one(sp.min)) : undefined,
    max: one(sp.max) ? Number(one(sp.max)) : undefined,
    inStock: one(sp.inStock) === "1",
    onSale: one(sp.onSale) === "1",
    q: one(sp.q)?.trim() || undefined,
    sort: one(sp.sort) ?? "featured",
  };
  const [items, facets] = await Promise.all([getProducts(filters), getFacets()]);

  const singleCat = filters.category.length === 1 ? CATEGORIES[filters.category[0]] : undefined;
  // A single brand with no category (e.g. the "Hot Wheels" and "LEGO" nav links) gets its own heading.
  const singleBrand = filters.category.length === 0 && filters.brand.length === 1 ? filters.brand[0] : undefined;
  const title = filters.q
    ? `Results for “${filters.q}”`
    : singleCat
      ? singleCat.label
      : (singleBrand ?? "The Collection");
  const blurb =
    singleCat?.blurb ??
    (singleBrand
      ? (BRAND_BLURBS[singleBrand] ?? `Everything from ${singleBrand} currently in the collection.`)
      : "Die-cast, LEGO, RC and collectibles for grown-up collectors.");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <nav className="text-xs uppercase tracking-[0.2em] text-ink/50">
        <Link href="/" className="hover:text-ink">Home</Link> <span className="mx-2">/</span>
        <span className="text-ink">{singleCat ? categoryLabel(filters.category[0]) : (singleBrand ?? "Shop")}</span>
      </nav>
      <header className="mt-4 animate-fade-up">
        <h1 className="font-display text-5xl tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-3 max-w-xl text-ink/60">{blurb}</p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 no-scrollbar">
            <FilterPanel facets={facets} />
          </div>
        </aside>
        <div>
          <ShopToolbar facets={facets} count={items.length} />
          {items.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-ink/20 p-16 text-center">
              <p className="font-display text-2xl">Nothing matches — yet.</p>
              <p className="mt-2 text-sm text-ink/60">Try removing a filter or searching for something else.</p>
              <Link href="/shop" className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm text-paper hover:bg-accent">
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
              {items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
