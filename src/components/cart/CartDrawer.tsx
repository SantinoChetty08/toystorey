"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "./CartProvider";
import { FREE_SHIPPING_THRESHOLD, formatPrice } from "@/lib/format";
import { QtyStepper } from "@/components/ui/QtyStepper";

export function CartDrawer() {
  const { items, isOpen, setOpen, subtotal, update, remove, count } = useCart();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className={`fixed inset-0 z-[60] ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      <div
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-ink/50 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-2xl transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
          <h2 className="font-display text-2xl">
            Your Cart <span className="text-base text-ink/50">({count})</span>
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-ink/5"
            aria-label="Close cart"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {items.length > 0 && (
          <div className="border-b border-ink/10 px-6 py-4">
            <p className="text-sm text-ink/70">
              {remaining > 0 ? (
                <>
                  You&apos;re <strong className="text-ink">{formatPrice(remaining)}</strong> away from free insured shipping
                </>
              ) : (
                <strong className="text-ink">🎉 You&apos;ve unlocked free insured shipping</strong>
              )}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 grid h-20 w-20 place-items-center rounded-full bg-ink/5 text-3xl">🏎️</div>
              <p className="font-display text-xl">Your garage is empty</p>
              <p className="mt-2 max-w-xs text-sm text-ink/60">Start building your collection with our latest drops and rare finds.</p>
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-accent"
              >
                Shop the collection
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-ink/10">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5 animate-fade-in">
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink/50">{item.brand}</p>
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 font-medium leading-snug hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QtyStepper
                        size="sm"
                        value={item.quantity}
                        max={item.stock}
                        onChange={(q) => update(item.id, q)}
                      />
                      <div className="text-right">
                        <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                        <button onClick={() => remove(item.id)} className="text-xs text-ink/50 underline-offset-2 hover:text-accent hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-ink/10 px-6 py-5">
            <div className="flex items-center justify-between text-lg">
              <span>Subtotal</span>
              <span className="font-display text-2xl">{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/50">Shipping and taxes calculated at checkout.</p>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 font-medium text-paper transition hover:bg-accent"
            >
              Secure Checkout
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <button onClick={() => setOpen(false)} className="mt-3 w-full text-center text-sm text-ink/60 hover:text-ink">
              Continue shopping
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
