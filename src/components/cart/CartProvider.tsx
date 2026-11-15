"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  stock: number;
  quantity: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  update: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  lastAdded: CartItem | null;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "toystorey.cart.v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<CartItem | null>(null);

  useEffect(() => {
    let saved: CartItem[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) saved = parsed;
    } catch {}
    if (saved.length) setItems(saved);
    setHydrated(true);

    // A saved cart can be older than the latest price or stock change, so
    // refresh those from the server on every page load. Saved items that no
    // longer exist are dropped; anything added while this runs is left alone.
    if (saved.length) {
      const asked = new Set(saved.map((i) => i.id));
      fetch(`/api/cart/refresh?ids=${[...asked].join(",")}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { products: { id: number; price: number; stock: number }[] } | null) => {
          if (!data) return;
          const live = new Map(data.products.map((p) => [p.id, p]));
          setItems((prev) =>
            prev.flatMap((item) => {
              if (!asked.has(item.id)) return [item];
              const p = live.get(item.id);
              if (!p) return [];
              const quantity = p.stock > 0 ? Math.min(item.quantity, p.stock) : item.quantity;
              return [{ ...item, price: p.price, stock: p.stock, quantity }];
            }),
          );
        })
        .catch(() => {});
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          setItems(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
  }, [isOpen]);

  const add = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const max = Math.max(1, item.stock);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, ...item, quantity: Math.min(max, i.quantity + qty) } : i,
        );
      }
      return [...prev, { ...item, quantity: Math.min(max, qty) }];
    });
    setLastAdded({ ...item, quantity: qty });
    setOpen(true);
  }, []);

  const update = useCallback((id: number, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, quantity: Math.min(Math.max(1, i.stock), qty) } : i)),
    );
  }, []);

  const remove = useCallback((id: number) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.price * i.quantity, 0),
      hydrated,
      isOpen,
      setOpen,
      add,
      update,
      remove,
      clear,
      lastAdded,
    }),
    [items, hydrated, isOpen, add, update, remove, clear, lastAdded],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
