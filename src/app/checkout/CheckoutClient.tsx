"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckoutEventNames,
  initializePaddle,
  type CheckoutSettings,
  type Paddle,
  type PaddleEventData,
} from "@paddle/paddle-js";
import { useCart } from "@/components/cart/CartProvider";
import { computeTotals, COUNTRIES, formatPrice, FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from "@/lib/format";

export type PaddleClientConfig = { clientToken: string; environment: "sandbox" | "production" };

const input =
  "w-full rounded-xl border border-ink/15 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-ink/35 focus:border-ink focus:ring-4 focus:ring-ink/5";

const PADDLE_SETTINGS: CheckoutSettings = {
  displayMode: "overlay",
  theme: "light",
  variant: "one-page",
  // The email and items were fixed on the previous step.
  allowLogout: false,
  showAddDiscounts: false,
};

type ActiveOrder = { orderNumber: string; transactionId: string; completed: boolean; retried: boolean };

/** Tell the server the customer backed out, so the reserved stock goes back on sale. */
function releaseOrder(orderNumber: string) {
  fetch(`/api/orders/${orderNumber}/cancel`, { method: "POST", keepalive: true }).catch(() => {});
}

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

export function CheckoutClient({ paddle }: { paddle: PaddleClientConfig | null }) {
  const { items, subtotal, hydrated, clear, update, remove } = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<string>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [placed, setPlaced] = useState(false);

  const paddleRef = useRef<Paddle | undefined>(undefined);
  const activeOrder = useRef<ActiveOrder | null>(null);

  const totals = computeTotals(subtotal, method);

  // Everything Paddle's payment window reports comes through here.
  const onPaddleEvent = useCallback(
    (event: PaddleEventData) => {
      const current = activeOrder.current;
      if (!current) return;

      if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
        current.completed = true;
        setPlaced(true);
        clear();
        paddleRef.current?.Checkout.close();
        // The order page asks Paddle directly whether the payment went through.
        router.push(`/order/${current.orderNumber}`);
        return;
      }

      if (event.name === CheckoutEventNames.CHECKOUT_ERROR) {
        // Most likely Paddle rejected a prefilled detail. Open once more
        // without them and let the customer type their details in.
        if (!current.retried) {
          current.retried = true;
          paddleRef.current?.Checkout.open({ transactionId: current.transactionId, settings: PADDLE_SETTINGS });
          return;
        }
        activeOrder.current = null;
        releaseOrder(current.orderNumber);
        paddleRef.current?.Checkout.close();
        setSubmitting(false);
        setError(`The payment window could not open${event.detail ? ` (${event.detail})` : ""}. Nothing has been charged.`);
        return;
      }

      if (event.name === CheckoutEventNames.CHECKOUT_CLOSED) {
        if (current.completed) return;
        activeOrder.current = null;
        releaseOrder(current.orderNumber);
        setSubmitting(false);
        setError("Payment window closed. Nothing has been charged and your cart is still here.");
      }
    },
    [clear, router],
  );

  // Load Paddle.js once, when payments are connected.
  const token = paddle?.clientToken;
  const environment = paddle?.environment;
  useEffect(() => {
    if (!token || !environment) return;
    let stale = false;
    initializePaddle({ environment, token, eventCallback: onPaddleEvent })
      .then((instance) => {
        if (!stale) paddleRef.current = instance;
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [token, environment, onPaddleEvent]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim();
    const email = text("email");
    const country = COUNTRIES.find((c) => c.name === text("country")) ?? COUNTRIES[0];

    if (paddle && !paddleRef.current) {
      setError("The secure payment window hasn't loaded yet. Check your connection or ad blocker, then try again.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName: `${text("firstName")} ${text("lastName")}`.trim(),
          address: [text("address"), text("address2")].filter(Boolean).join(", "),
          city: text("city"),
          region: text("region"),
          postalCode: text("postalCode"),
          country: country.name,
          shippingMethod: method,
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Something went wrong.");

      if (j.mode === "paddle") {
        const instance = paddleRef.current;
        if (!instance) {
          releaseOrder(j.orderNumber);
          throw new Error("The secure payment window could not load. Nothing has been charged. Please reload the page and try again.");
        }
        activeOrder.current = { orderNumber: j.orderNumber, transactionId: j.transactionId, completed: false, retried: false };
        instance.Checkout.open({
          transactionId: j.transactionId,
          // Prefill what was just typed, so the customer only adds payment details.
          customer: {
            email,
            address: {
              countryCode: country.code,
              postalCode: text("postalCode"),
              region: text("region"),
              city: text("city"),
              firstLine: text("address"),
            },
          },
          settings: PADDLE_SETTINGS,
        });
        return; // stays busy until Paddle reports back through onPaddleEvent
      }

      // Payments are not connected: this was a test order.
      setPlaced(true);
      clear();
      router.push(`/order/${j.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

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
            {/* The badge sits outside the rounded image so its corner isn't clipped. */}
            <div className="relative h-16 w-16 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.image} alt={i.name} className="h-full w-full rounded-xl bg-white object-cover" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-paper ring-2 ring-white">{i.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-ink/50">
                <button type="button" disabled={submitting} onClick={() => update(i.id, i.quantity - 1)} className="hover:text-ink disabled:opacity-30">−</button>
                <span>Qty {i.quantity}</span>
                <button type="button" disabled={submitting || i.quantity >= i.stock} onClick={() => update(i.id, i.quantity + 1)} className="hover:text-ink disabled:opacity-30">+</button>
                <button type="button" disabled={submitting} onClick={() => remove(i.id)} className="ml-auto hover:text-accent disabled:opacity-30">Remove</button>
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
        <div className="flex justify-between">
          <dt className="text-ink/60">Tax</dt>
          <dd className="text-ink/60">{paddle ? "Calculated at payment" : "None (test mode)"}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/10 pt-4">
          <dt className="font-medium">{paddle ? "Total before tax" : "Total"}</dt>
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Checkout</h1>
        <span className="flex items-center gap-2 text-xs text-ink/50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
          {paddle ? "Secure payment by Paddle" : "Test mode"}
        </span>
      </div>

      {!paddle && (
        <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong className="font-semibold">Test mode.</strong> Payments are not connected yet. You can place a test order
          to try the checkout, but no payment is taken and nothing will be shipped.
        </p>
      )}

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

      <form className="mt-10 grid gap-12 lg:grid-cols-[1fr_420px]" onSubmit={onSubmit}>
        <div className="space-y-12">
          <Step n={1} title="Contact">
            <input name="email" type="email" required autoComplete="email" placeholder="Email address" className={input} />
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
              <select name="country" defaultValue={COUNTRIES[0].name} autoComplete="country-name" className={input}>
                {COUNTRIES.map((c) => (
                  <option key={c.code}>{c.name}</option>
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
                      <p className="text-sm text-ink/50">{m.eta} · tracked &amp; insured</p>
                    </div>
                    <span className="font-medium">{t.shipping === 0 ? "Free" : formatPrice(t.shipping)}</span>
                  </label>
                );
              })}
            </div>
          </Step>

          <Step n={4} title="Payment">
            {paddle ? (
              <div className="rounded-2xl border border-ink/15 bg-white p-5">
                <p className="font-medium">Pay securely with Paddle</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">
                  When you continue, a secure Paddle window opens for your card or wallet details. Any sales tax or VAT
                  for your address is shown there before you pay. Paddle processes the payment and emails your receipt.
                </p>
                {paddle.environment === "sandbox" && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    Sandbox mode: use Paddle&apos;s test cards. No real money moves.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-ink/25 bg-white p-5 text-sm leading-relaxed text-ink/60">
                No payment step in test mode. Once Paddle is connected, a secure payment window opens here.
              </div>
            )}
          </Step>

          {error && <p role="alert" className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent animate-fade-in">{error}</p>}

          <div>
            <button
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-ink py-5 text-lg font-medium text-paper transition hover:bg-accent disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
                  {paddle ? "Waiting for payment…" : "Placing test order…"}
                </>
              ) : paddle ? (
                <>Continue to payment · {formatPrice(totals.total)}</>
              ) : (
                <>Place test order</>
              )}
            </button>
            {paddle && (
              <p className="mt-3 text-center text-xs text-ink/50">
                You are only charged once you confirm in the Paddle window. Your items are held for you while you pay.
              </p>
            )}
          </div>
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
