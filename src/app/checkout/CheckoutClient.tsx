"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { computeTotals, formatPrice, FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from "@/lib/format";
import { loadPaddle, onPaddleEvent } from "@/lib/paddle/client";

const input =
  "w-full rounded-xl border border-ink/15 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-ink/35 focus:border-ink focus:ring-4 focus:ring-ink/5";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="animate-fade-up" style={{ animationDelay: `${n * 80}ms` }}>
      <h2 className="flex items-center gap-3 font-display text-2xl">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-sans text-sm text-paper">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function CheckoutClient() {
  const { items, subtotal, hydrated, clear, update, remove } = useCart();
  const [method, setMethod] = useState<string>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placed, setPlaced] = useState(false);

  const totals = computeTotals(subtotal, method);

  // When Paddle reports a completed payment, empty the cart. Paddle then redirects to the order page.
  useEffect(() => {
    const unsubscribe = onPaddleEvent((e) => {
      if (e.name === "checkout.completed") {
        setPlaced(true);
        clear();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [clear]);

  if (!hydrated || placed) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-7xl place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center animate-fade-up">
        <div className="text-5xl">🏁</div>
        <h1 className="mt-6 font-display text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-ink/60">Add a few pieces to your collection before checking out.</p>
        <Link href="/shop" className="mt-8 rounded-full bg-ink px-8 py-4 font-medium text-paper hover:bg-accent">
          Browse the shop
        </Link>
      </div>
    );
  }

  const summary = (
    <div className="space-y-5">
      <ul className="space-y-4">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-paper">{i.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-ink/50">
                <button type="button" onClick={() => update(i.id, i.quantity - 1)} className="hover:text-ink">−</button>
                <span>Qty {i.quantity}</span>
                <button type="button" disabled={i.quantity >= i.stock} onClick={() => update(i.id, i.quantity + 1)} className="hover:text-ink disabled:opacity-30">+</button>
                <button type="button" onClick={() => remove(i.id)} className="ml-auto hover:text-accent">Remove</button>
              </div>
            </div>
            <p className="text-sm font-medium">{formatPrice(i.price * i.quantity)}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-ink/10 pt-5 text-sm">
        <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
        <div className="flex justify-between">
          <dt className="text-ink/60">Shipping</dt>
          <dd>{totals.shipping === 0 ? <span className="text-emerald-700">Free</span> : formatPrice(totals.shipping)}</dd>
        </div>
        <div className="flex justify-between"><dt className="text-ink/60">Tax</dt><dd className="text-ink/50">Calculated at payment</dd></div>
        <div className="flex items-baseline justify-between border-t border-ink/10 pt-4">
          <dt className="font-medium">Total before tax</dt>
          <dd className="font-display text-3xl">{formatPrice(totals.total)}</dd>
        </div>
      </dl>
      {subtotal < FREE_SHIPPING_THRESHOLD && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-xs text-accent">
          Add {formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for free insured standard shipping.
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Checkout</h1>
        <span className="flex items-center gap-2 text-xs text-ink/50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
          Secure payment by Paddle
        </span>
      </div>

      {/* Mobile summary toggle */}
      <div className="mt-6 rounded-2xl bg-white lg:hidden">
        <button type="button" onClick={() => setSummaryOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-sm">
          <span className="font-medium">{summaryOpen ? "Hide" : "Show"} order summary ({items.length})</span>
          <span className="font-display text-xl">{formatPrice(totals.total)}</span>
        </button>
        <div className={`grid transition-all duration-500 ${summaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden"><div className="px-5 pb-5">{summary}</div></div>
        </div>
      </div>

      <form
        className="mt-10 grid gap-12 lg:grid-cols-[1fr_420px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting) return;
          const fd = new FormData(e.currentTarget);
          setSubmitting(true);
          setError("");
          try {
            const res = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: fd.get("email"),
                fullName: `${fd.get("firstName")} ${fd.get("lastName")}`.trim(),
                address: [fd.get("address"), fd.get("address2")].filter(Boolean).join(", "),
                city: fd.get("city"),
                region: fd.get("region"),
                postalCode: fd.get("postalCode"),
                country: fd.get("country"),
                shippingMethod: method,
                items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
              }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error ?? "Something went wrong.");

            const paddle = await loadPaddle();
            paddle.Checkout.open({
              transactionId: j.transactionId,
              settings: {
                displayMode: "overlay",
                successUrl: `${window.location.origin}/order/${j.orderNumber}`,
                allowLogout: false,
              },
            });
            setSubmitting(false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
            setSubmitting(false);
          }
        }}
      >
        <div className="space-y-12">
          <Step n={1} title="Contact">
            <input name="email" type="email" required autoComplete="email" placeholder="Email address" className={input} />
            <label className="mt-3 flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" defaultChecked className="accent-ink" /> Email me about new drops and restocks
            </label>
          </Step>

          <Step n={2} title="Shipping address">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="firstName" required autoComplete="given-name" placeholder="First name" className={input} />
              <input name="lastName" required autoComplete="family-name" placeholder="Last name" className={input} />
              <input name="address" required autoComplete="address-line1" placeholder="Street address" className={`${input} sm:col-span-2`} />
              <input name="address2" autoComplete="address-line2" placeholder="Apartment, suite (optional)" className={`${input} sm:col-span-2`} />
              <input name="city" required autoComplete="address-level2" placeholder="City" className={input} />
              <input name="region" required autoComplete="address-level1" placeholder="State / Province" className={input} />
              <input name="postalCode" required autoComplete="postal-code" placeholder="ZIP / Postal code" className={input} />
              <select name="country" defaultValue="United States" className={input}>
                {["United States", "Canada", "United Kingdom", "Australia", "Germany", "Japan"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </Step>

          <Step n={3} title="Delivery">
            <div className="space-y-3">
              {SHIPPING_METHODS.map((m) => {
                const t = computeTotals(subtotal, m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-5 transition ${
                      method === m.id ? "border-ink ring-4 ring-ink/5" : "border-ink/15 hover:border-ink/40"
                    }`}
                  >
                    <input type="radio" name="shipping" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="accent-ink" />
                    <div className="flex-1">
                      <p className="font-medium">{m.label}</p>
                      <p className="text-sm text-ink/50">{m.eta} · tracked & insured</p>
                    </div>
                    <span className="font-medium">{t.shipping === 0 ? "Free" : formatPrice(t.shipping)}</span>
                  </label>
                );
              })}
            </div>
          </Step>

          <Step n={4} title="Payment">
            <div className="rounded-2xl border border-ink/15 bg-white p-5">
              <p className="font-medium">Pay securely with Paddle</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">
                Paddle opens a secure payment window to collect your card or wallet details. Paddle is our merchant of
                record, so it also calculates and remits any applicable sales tax and VAT.
              </p>
            </div>
          </Step>

          {error && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent animate-fade-in">{error}</p>}

          <button
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-ink py-5 text-lg font-medium text-paper transition hover:bg-accent disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-paper/30 border-t-paper" /> Opening secure payment…
              </>
            ) : (
              <>Continue to payment · {formatPrice(totals.total)}</>
            )}
          </button>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl bg-white p-7">
            <h2 className="mb-6 font-display text-2xl">Order summary</h2>
            {summary}
          </div>
        </aside>
      </form>
    </div>
  );
}
