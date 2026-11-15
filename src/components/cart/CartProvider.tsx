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
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {}
    setHydrated(true);
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

  // Re-sync saved cart prices and stock with the server after hydration.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    let cancelled = false;
    fetch("/api/cart/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: items.map((i) => i.id) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        const byId = new Map<number, { price: number; stock: number }>(
          data.items.map((i: { id: number; price: number; stock: number }) => [i.id, i]),
        );
        setItems((prev) =>
          prev
            .filter((i) => byId.has(i.id))
            .map((i) => {
              const latest = byId.get(i.id)!;
              return { ...i, price: latest.price, stock: latest.stock, quantity: Math.min(i.quantity, Math.max(1, latest.stock)) };
            }),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Run once per page load, after the saved cart has been read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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
