import Link from "next/link";
import type { ProductCard as TProduct } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { Stars } from "@/components/ui/Stars";
import { QuickAdd } from "./QuickAdd";

export function ProductCard({ product, index = 0 }: { product: TProduct; index?: number }) {
  const soldOut = product.stock <= 0;
  const second = product.images[1];
  return (
    <article
      className="group relative flex flex-col animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06] ${second ? "group-hover:opacity-0" : ""}`}
        />
        {second && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={second}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition duration-700 ease-out group-hover:scale-100 group-hover:opacity-100"
          />
        )}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.badge && (
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur ${
                product.badge === "Sale" ? "bg-accent text-white" : "bg-ink/85 text-paper"
              }`}
            >
              {product.badge}
            </span>
          )}
          {soldOut && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">
              Sold out
            </span>
          )}
          {!soldOut && product.stock <= 5 && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Only {product.stock} left
            </span>
          )}
        </div>
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-ink/50">
          <span>{product.brand}</span>
          <span>{product.scale}</span>
        </div>
        <Link href={`/products/${product.slug}`} className="mt-1 font-medium leading-snug transition hover:text-accent">
          {product.name}
        </Link>
        {product.reviewCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink/50">
            <Stars rating={product.rating} size={12} />
            <span>({product.reviewCount})</span>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-sm text-ink/40 line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
          </div>
          {!soldOut && (
            <QuickAdd
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
          )}
        </div>
      </div>
    </article>
  );
}
