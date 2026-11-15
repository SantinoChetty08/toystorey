import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/queries";
import { formatPrice, SHIPPING_METHODS } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const data = await getOrder(orderNumber);
  if (!data) notFound();
  const { order, items } = data;
  const method = SHIPPING_METHODS.find((m) => m.id === order.shippingMethod);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-16 sm:px-6">
      <div className="text-center animate-fade-up">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink text-paper">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12l5 5L20 7" /></svg>
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-accent">Order {order.orderNumber}</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Thank you, {order.fullName.split(" ")[0]}.</h1>
        {order.status === "paid" ? (
          <p className="mx-auto mt-4 max-w-md text-ink/60">
            Payment confirmed. Our team is inspecting and packing your pieces now — a tracking link will be sent to{" "}
            <strong className="text-ink">{order.email}</strong>.
          </p>
        ) : order.status === "pending_payment" ? (
          <p className="mx-auto mt-4 max-w-md text-ink/60">
            We&apos;re waiting for payment confirmation from Paddle. This usually takes a few seconds — refresh the page
            in a moment. A receipt will be sent to <strong className="text-ink">{order.email}</strong>.
          </p>
        ) : (
          <p className="mx-auto mt-4 max-w-md text-accent">
            This payment didn&apos;t complete, so no charge was made. Your items have been released back to stock.
          </p>
        )}
      </div>

      <div className="mt-12 rounded-3xl bg-white p-6 sm:p-8 animate-fade-up" style={{ animationDelay: "150ms" }}>
        <ul className="divide-y divide-ink/10">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.image} alt={i.name} className="h-16 w-16 rounded-xl object-cover" />
              <div className="flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-sm text-ink/50">Qty {i.quantity} · {formatPrice(i.price)}</p>
              </div>
              <p className="font-medium">{formatPrice(i.price * i.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink/60">Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink/60">Shipping ({method?.label})</dt><dd>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink/60">Tax</dt><dd className="text-ink/50">Calculated by Paddle</dd></div>
          <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
            <dt className="font-medium">{order.status === "paid" ? "Total paid" : "Total"}</dt>
            <dd className="font-display text-3xl">{formatPrice(order.total)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid gap-6 rounded-3xl bg-white p-6 text-sm sm:grid-cols-2 sm:p-8 animate-fade-up" style={{ animationDelay: "250ms" }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Shipping to</p>
          <p className="mt-2 leading-relaxed">
            {order.fullName}<br />{order.address}<br />{order.city}, {order.region} {order.postalCode}<br />{order.country}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Delivery</p>
          <p className="mt-2">{method?.label}</p>
          <p className="text-ink/60">{method?.eta}</p>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link href="/shop" className="inline-flex rounded-full bg-ink px-8 py-4 font-medium text-paper transition hover:bg-accent">
          Continue collecting
        </Link>
      </div>
    </div>
  );
}
