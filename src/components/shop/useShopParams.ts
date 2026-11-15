"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function useShopParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const getList = useCallback(
    (key: string) => (params.get(key) ?? "").split(",").filter(Boolean),
    [params],
  );

  const push = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      const cur = (next.get(key) ?? "").split(",").filter(Boolean);
      const updated = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (updated.length) next.set(key, updated.join(","));
      else next.delete(key);
      push(next);
    },
    [params, push],
  );

  const set = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      push(next);
    },
    [params, push],
  );

  const setMany = useCallback(
    (entries: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(entries).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      push(next);
    },
    [params, push],
  );

  const clear = useCallback(() => {
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    push(next);
  }, [params, push]);

  return { params, getList, toggle, set, setMany, clear, pending };
}
