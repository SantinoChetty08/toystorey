import type { Metadata } from "next";
import { getPaddleConfig } from "@/lib/paddle";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout" };

// Rendered per request so Paddle keys added later are picked up without a rebuild.
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const paddle = getPaddleConfig();
  // Only the client-side token is sent to the browser; it is public by design.
  return (
    <CheckoutClient
      paddle={paddle.enabled && paddle.clientToken ? { clientToken: paddle.clientToken, environment: paddle.environment } : null}
    />
  );
}
