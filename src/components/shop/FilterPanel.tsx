"use client";

import { useEffect, useState } from "react";
import type { getFacets } from "@/lib/queries";
import { categoryLabel } from "@/lib/format";
import { useShopParams } from "./useShopParams";

export type Facets = Awaited<ReturnType<typeof getFacets>>;

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink/10 py-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <span className="text-xs font-semibold uppercase tracking-[0.2em]">{title}</span>
        <span className={`text-lg leading-none transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function Check({ checked, label, count, onChange }: { checked: boolean; label: string; count: number; onChange: () => void }) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 py-1.5 text-sm">
      <span
        className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border transition ${
          checked ? "border-ink bg-ink text-paper" : "border-ink/25 bg-white group-hover:border-ink"
        }`}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span className="flex-1">{label}</span>
      {count > 0 && <span className="text-xs text-ink/40">{count}</span>}
    </label>
  );
}

export function FilterPanel({ facets }: { facets: Facets }) {
  const { getList, toggle, setMany, params, clear, set } = useShopParams();
  const cats = getList("category");
  const brands = getList("brand");
  const scales = getList("scale");
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");

  useEffect(() => {
    setMin(params.get("min") ?? "");
    setMax(params.get("max") ?? "");
  }, [params]);

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-display text-2xl">Filters</h2>
        <button onClick={clear} className="text-xs text-ink/50 underline-offset-2 hover:text-accent hover:underline">
          Clear all
        </button>
      </div>

      <Section title="Category">
        {facets.categories.map((c) => (
          <Check key={c.value} label={categoryLabel(c.value)} count={c.count} checked={cats.includes(c.value)} onChange={() => toggle("category", c.value)} />
        ))}
      </Section>

      <Section title="Price">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMany({ min: min || null, max: max || null });
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">$</span>
              <input
                inputMode="numeric"
                value={min}
                onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="w-full rounded-xl border border-ink/15 bg-white py-2 pl-6 pr-2 text-sm outline-none focus:border-ink"
              />
            </div>
            <span className="text-ink/40">–</span>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink/40">$</span>
              <input
                inputMode="numeric"
                value={max}
                onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={String(facets.maxPrice)}
                className="w-full rounded-xl border border-ink/15 bg-white py-2 pl-6 pr-2 text-sm outline-none focus:border-ink"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["Under $25", "", "25"],
              ["$25–$100", "25", "100"],
              ["$100–$300", "100", "300"],
              ["$300+", "300", ""],
            ].map(([l, a, b]) => (
              <button
                type="button"
                key={l}
                onClick={() => setMany({ min: a || null, max: b || null })}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  (params.get("min") ?? "") === a && (params.get("max") ?? "") === b
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/15 hover:border-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="w-full rounded-full bg-ink py-2 text-sm text-paper transition hover:bg-accent">Apply</button>
        </form>
      </Section>

      <Section title="Brand">
        {facets.brands.map((b) => (
          <Check key={b.value} label={b.value} count={b.count} checked={brands.includes(b.value)} onChange={() => toggle("brand", b.value)} />
        ))}
      </Section>

      <Section title="Scale" defaultOpen={false}>
        {facets.scales.map((s) => (
          <Check key={s.value} label={s.value} count={s.count} checked={scales.includes(s.value)} onChange={() => toggle("scale", s.value)} />
        ))}
      </Section>

      <Section title="Availability">
        <Check label="In stock only" count={0} checked={params.get("inStock") === "1"} onChange={() => set("inStock", params.get("inStock") === "1" ? null : "1")} />
        <Check label="On sale" count={0} checked={params.get("onSale") === "1"} onChange={() => set("onSale", params.get("onSale") === "1" ? null : "1")} />
      </Section>
    </div>
  );
}
