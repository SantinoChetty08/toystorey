"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shown while an order is waiting for Paddle to confirm payment. Re-renders the
 * page every few seconds (each render asks Paddle again) and stops on its own:
 * once the order is paid, the page no longer includes this component.
 */
export function OrderStatusWatcher({ attempts = 15, everyMs = 3000 }: { attempts?: number; everyMs?: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(attempts);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => {
      router.refresh();
      setLeft((n) => n - 1);
    }, everyMs);
    return () => clearTimeout(t);
  }, [left, everyMs, router]);

  if (left > 0) {
    return (
      <p className="mt-6 inline-flex items-center gap-3 text-sm text-ink/60">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
        Checking with Paddle…
      </p>
    );
  }
  return (
    <p className="mt-6 text-sm text-ink/60">
      Still waiting for confirmation.{" "}
      <button onClick={() => setLeft(attempts)} className="font-medium text-ink underline underline-offset-2 hover:text-accent">
        Check again
      </button>
    </p>
  );
}
