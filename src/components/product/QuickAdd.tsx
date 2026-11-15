"use client";

import { useCart, type CartItem } from "@/components/cart/CartProvider";

export function QuickAdd({ item }: { item: Omit<CartItem, "quantity"> }) {
  const { add } = useCart();
  return (
    <button
      type="button"
      onClick={() => add(item, 1)}
      aria-label={`Add ${item.name} to cart`}
      className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-white transition duration-300 hover:scale-110 hover:border-ink hover:bg-ink hover:text-paper active:scale-95"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
