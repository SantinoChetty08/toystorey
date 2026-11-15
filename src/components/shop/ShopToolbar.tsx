"use client";

import { useState } from "react";
import { categoryLabel } from "@/lib/format";
import { FilterPanel, type Facets } from "./FilterPanel";
import { useShopParams } from "./useShopParams";

const SORTS = [
  ["featured", "Featured"],
  ["newest", "Newest"],
  ["price-asc", "Price: Low to High"],
  ["price-desc", "Price: High to Low"],
  ["rating", "Top Rated"],
] as const;

export function ShopToolbar({ facets, count }: { facets: Facets; count: number }) {
  const { params, set, toggle, setMany, pending, getList } = useShopParams();
  const [open, setOpen] = useState(false);

  const chips: { label: string; onRemove: () => void }[] = [];
  getList("category").forEach((c) => chips.push({ label: categoryLabel(c), onRemove: () => toggle("category", c) }));
  getList("brand").forEach((b) => chips.push({ label: b, onRemove: () => toggle("brand", b) }));
  getList("scale").forEach((s) => chips.push({ label: s, onRemove: () => toggle("scale", s) }));
  if (params.get("min") || params.get("max"))
    chips.push({
      label: `$${params.get("min") || 0} – ${params.get("max") ? "$" + params.get("max") : "any"}`,
      onRemove: () => setMany({ min: null, max: null }),
    });
  if (params.get("inStock") === "1") chips.push({ label: "In stock", onRemove: () => set("inStock", null) });
  if (params.get("onSale") === "1") chips.push({ label: "On sale", onRemove: () => set("onSale", null) });
  if (params.get("q")) chips.push({ label: `“${params.get("q")}”`, onRemove: () => set("q", null) });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            Filters {chips.length > 0 && <span className="rounded-full bg-ink px-1.5 text-[10px] text-paper">{chips.length}</span>}
          </button>
          <p className={`text-sm text-ink/60 transition ${pending ? "opacity-40" : ""}`}>
            {count} {count === 1 ? "piece" : "pieces"}
          </p>
          {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden text-ink/50 sm:inline">Sort by</span>
          <select
            value={params.get("sort") ?? "featured"}
            onChange={(e) => set("sort", e.target.value === "featured" ? null : e.target.value)}
            className="cursor-pointer rounded-full border border-ink/15 bg-white px-4 py-2 outline-none focus:border-ink"
          >
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={c.onRemove}
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs text-paper transition hover:bg-accent animate-fade-in"
            >
              {c.label}
              <span className="opacity-60 group-hover:opacity-100">✕</span>
            </button>
          ))}
        </div>
      )}

      <div className={`fixed inset-0 z-[60] lg:hidden ${open ? "" : "pointer-events-none"}`}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-ink/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        <div
          className={`absolute left-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-paper transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex-1 overflow-y-auto px-6 pt-6">
            <FilterPanel facets={facets} />
          </div>
          <div className="border-t border-ink/10 p-4">
            <button onClick={() => setOpen(false)} className="w-full rounded-full bg-ink py-3.5 text-paper">
              Show {count} results
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
