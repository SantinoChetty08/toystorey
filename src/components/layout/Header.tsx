"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { STOREWIDE_SALE } from "@/lib/format";

const NAV = [
  { href: "/shop", label: "Shop All" },
  { href: "/shop?brand=Hot%20Wheels", label: "Hot Wheels" },
  { href: "/shop?brand=LEGO", label: "LEGO" },
  { href: "/shop?category=diecast", label: "Die-Cast" },
  { href: "/shop?category=rc", label: "RC Cars" },
  { href: "/shop?category=collectibles", label: "Collectibles" },
  { href: "/shop?category=display", label: "Display" },
];

export function Header() {
  const { count, setOpen, hydrated } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [bump, setBump] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [pathname]);

  useEffect(() => {
    if (!hydrated || count === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 400);
    return () => clearTimeout(t);
  }, [count, hydrated]);

  const transparent = isHome && !scrolled && !menu && !search;

  return (
    <>
      <div className="bg-ink text-paper">
        <p className="mx-auto max-w-7xl px-4 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-paper/80">
          {STOREWIDE_SALE.percentOff > 0 ? (
            <>
              <strong className="font-semibold text-white">{STOREWIDE_SALE.percentOff}% off everything</strong> · Free
              insured shipping over $150
            </>
          ) : (
            "Free insured shipping over $150 · Every order inspected by collectors"
          )}
        </p>
      </div>
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ${
          transparent ? "bg-transparent text-paper" : "bg-paper/85 text-ink shadow-[0_1px_0_rgba(20,20,20,0.08)] backdrop-blur-xl"
        } ${isHome ? "-mb-[72px]" : ""}`}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button onClick={() => setMenu((m) => !m)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-full hover:bg-current/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>

          <Link href="/" className="font-display text-2xl tracking-tight sm:text-[28px]">
            Toy<span className="italic text-accent">Storey</span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="link-underline text-sm tracking-wide">
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearch((s) => !s)}
              aria-label="Search"
              className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-current/10"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open cart"
              className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-current/10"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 7h12l-1 13H7L6 7z" />
                <path d="M9 7a3 3 0 016 0" />
              </svg>
              {hydrated && count > 0 && (
                <span
                  className={`absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white transition-transform ${bump ? "scale-125" : "scale-100"}`}
                >
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className={`overflow-hidden transition-all duration-500 ${search ? "max-h-28" : "max-h-0"}`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
            }}
            className="mx-auto max-w-3xl px-4 pb-5"
          >
            <input
              autoFocus={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Treasure Hunts, crawlers, figures…"
              className="w-full rounded-full border border-ink/15 bg-white px-6 py-3.5 text-ink outline-none transition focus:border-ink"
            />
          </form>
        </div>

        <div className={`overflow-hidden transition-all duration-500 lg:hidden ${menu ? "max-h-96" : "max-h-0"}`}>
          <nav className="flex flex-col px-6 pb-6">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenu(false)} className="border-b border-ink/10 py-4 font-display text-xl">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}
