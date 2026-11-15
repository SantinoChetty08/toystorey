import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/queries";
import { formatPrice, SHIPPING_METHODS } from "@/lib/format";
import { syncOrderWithPaddle } from "@/lib/orders";
import { getPaddleConfig } from "@/lib/paddle";
import { OrderStatusWatcher } from "@/components/order/OrderStatusWatcher";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order" };

type View = "paid" | "review" | "pending" | "cancelled" | "test";

function viewFor(status: string): View {
  if (status === "pending") return "pending";
  if (status === "cancelled") return "cancelled";
  if (status === "test") return "test";
  if (status === "paid_review") return "review";
  return "paid"; // "paid", and demo orders from before payments were added
}

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  let data = await getOrder(orderNumber);
  if (!data) notFound();

  // Still waiting for payment: ask Paddle directly instead of waiting for its
  // webhook, so the customer sees the result as soon as they land here.
  if (data.order.status === "pending" && getPaddleConfig().enabled) {
    try {
      await syncOrderWithPaddle(data.order);
      data = (await getOrder(orderNumber)) ?? data;
    } catch (e) {
      console.error(`Could not check order ${orderNumber} with Paddle`, e);
    }
  }

  const { order, items } = data;
  const view = viewFor(order.status);
  const method = SHIPPING_METHODS.find((m) => m.id === order.shippingMethod);
  const firstName = order.fullName.split(" ")[0];
  const charged = view === "paid" || view === "review";
  // When Paddle is set to tax-inclusive pricing, tax is part of the prices rather than added on top.
  const taxIncluded = charged && order.tax > 0 && order.total < order.subtotal + order.shipping + order.tax;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-16 sm:px-6">
      <div className="text-center animate-fade-up">
        <div
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${
            charged ? "bg-ink text-paper" : view === "cancelled" ? "bg-ink/10 text-ink/50" : "bg-amber-100 text-amber-800"
          }`}
        >
          {charged ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12l5 5L20 7" /></svg>
          ) : view === "cancelled" ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          )}
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-accent">Order {order.orderNumber}</p>

        {view === "paid" && (
          <>
            <h1 className="mt-3 font-display text-5xl tracking-tight">Thank you, {firstName}.</h1>
            <p className="mx-auto mt-4 max-w-md text-ink/60">
              {order.status === "paid" ? "Your payment went through and your order is confirmed." : "Your order is confirmed."} We are
              inspecting and packing your pieces now.
              {order.status === "paid" && (
                <>
                  {" "}
                  A receipt from Paddle, our payment provider, is on its way to <strong className="text-ink">{order.email}</strong>.
                </>
              )}
            </p>
          </>
        )}
        {view === "review" && (
          <>
            <h1 className="mt-3 font-display text-5xl tracking-tight">Payment received, {firstName}.</h1>
            <p className="mx-auto mt-4 max-w-md text-ink/60">
              Thank you. We need to double-check one detail of this order before it ships and will contact you at{" "}
              <strong className="text-ink">{order.email}</strong>.
            </p>
          </>
        )}
        {view === "pending" && (
          <>
            <h1 className="mt-3 font-display text-5xl tracking-tight">Confirming your payment</h1>
            <p className="mx-auto mt-4 max-w-md text-ink/60">
              This usually takes a few seconds and the page updates by itself. If you have not paid yet, your items are
              held for a short while and then released.
            </p>
            <OrderStatusWatcher />
          </>
        )}
        {view === "cancelled" && (
          <>
            <h1 className="mt-3 font-display text-5xl tracking-tight">This order was not completed</h1>
            <p className="mx-auto mt-4 max-w-md text-ink/60">
              No payment was taken and the items went back on sale. You can check out again whenever you like.
            </p>
          </>
        )}
        {view === "test" && (
          <>
            <h1 className="mt-3 font-display text-5xl tracking-tight">Test order placed</h1>
            <p className="mx-auto mt-4 max-w-md rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              Payments are not connected yet, so no payment was taken and nothing will be shipped.
            </p>
          </>
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
          <div className="flex justify-between">
            <dt className="text-ink/60">{taxIncluded ? "Tax (included in prices)" : "Tax"}</dt>
            <dd className={charged ? "" : "text-ink/60"}>
              {charged ? formatPrice(order.tax) : view === "pending" ? "Calculated at payment" : "None"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-ink/10 pt-3">
            <dt className="font-medium">
              {order.status === "paid" || view === "review" ? "Total paid" : view === "pending" ? "Total before tax" : view === "paid" ? "Total" : "Total (not charged)"}
            </dt>
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
        <Link
          href={view === "cancelled" ? "/checkout" : "/shop"}
          className="inline-flex rounded-full bg-ink px-8 py-4 font-medium text-paper transition hover:bg-accent"
        >
          {view === "cancelled" ? "Back to checkout" : "Continue collecting"}
        </Link>
      </div>
    </div>
  );
}
