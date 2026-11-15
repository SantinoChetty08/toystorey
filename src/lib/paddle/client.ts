"use client";

// Browser loader for Paddle.js (overlay checkout). Only the client-side token is used here.
// Required: NEXT_PUBLIC_PADDLE_CLIENT_TOKEN and NEXT_PUBLIC_PADDLE_ENVIRONMENT ("sandbox" | "production").

type PaddleEvent = { name?: string };
type PaddleInstance = {
  Checkout: {
    open: (opts: {
      transactionId: string;
      settings?: { displayMode?: "overlay" | "inline"; successUrl?: string; allowLogout?: boolean; theme?: "light" | "dark" };
    }) => void;
  };
};
type PaddleGlobal = PaddleInstance & {
  Environment: { set: (env: "sandbox" | "production") => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

let loading: Promise<PaddleGlobal> | null = null;
const listeners = new Set<(e: PaddleEvent) => void>();

export function onPaddleEvent(fn: (e: PaddleEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadPaddle(): Promise<PaddleGlobal> {
  if (loading) return loading;
  const p = new Promise<PaddleGlobal>((resolve, reject) => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      reject(new Error("Payments are not configured yet."));
      return;
    }
    const init = () => {
      if (!window.Paddle) return reject(new Error("Payment library failed to load."));
      if (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "sandbox") window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({
        token,
        eventCallback: (e) => listeners.forEach((fn) => fn(e)),
      });
      resolve(window.Paddle);
    };
    if (window.Paddle) return init();
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = init;
    s.onerror = () => reject(new Error("Could not reach the payment provider. Check your connection and try again."));
    document.head.appendChild(s);
  });
  loading = p.catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}
