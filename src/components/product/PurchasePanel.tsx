"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/cart/CartProvider";
import { QtyStepper } from "@/components/ui/QtyStepper";

export function PurchasePanel({ item }: { item: Omit<CartItem, "quantity"> }) {
  const { add, items } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const inCart = items.find((i) => i.id === item.id)?.quantity ?? 0;
  const available = Math.max(0, item.stock - inCart);
  const soldOut = item.stock <= 0;

  if (soldOut) {
    return (
      <div className="space-y-3">
        <button disabled className="w-full rounded-full bg-ink/10 py-4 font-medium text-ink/50">Sold out</button>
        <p className="text-center text-sm text-ink/60">Join our drop alerts in the footer to hear when it&apos;s back.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <QtyStepper value={qty} min={1} max={Math.max(1, available)} onChange={(v) => setQty(Math.max(1, v))} />
        <button
          disabled={available === 0}
          onClick={() => {
            add(item, qty);
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
          }}
          className="relative flex-1 overflow-hidden rounded-full bg-ink py-3 font-medium text-paper transition hover:bg-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/30"
        >
          <span className={`inline-block transition duration-300 ${added ? "-translate-y-8 opacity-0" : ""}`}>
            {available === 0 ? "Max quantity in cart" : "Add to cart"}
          </span>
          <span className={`absolute inset-0 grid place-items-center transition duration-300 ${added ? "" : "translate-y-8 opacity-0"}`}>
            ✓ Added
          </span>
        </button>
      </div>
      <button
        disabled={available === 0}
        onClick={() => {
          add(item, qty);
          router.push("/checkout");
        }}
        className="w-full rounded-full border border-ink py-3.5 font-medium transition hover:bg-ink hover:text-paper disabled:opacity-40"
      >
        Buy it now
      </button>
      {inCart > 0 && <p className="text-center text-xs text-ink/50">{inCart} already in your cart</p>}
    </div>
  );
}
