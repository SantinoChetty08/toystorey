import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paddle Billing integration (https://developer.paddle.com).
 *
 * Configuration, all read at request time so no rebuild is needed:
 *   PADDLE_API_KEY          server-side API key (secret)
 *   PADDLE_CLIENT_TOKEN     client-side token for Paddle.js (public by design)
 *   PADDLE_WEBHOOK_SECRET   secret key of the notification destination that
 *                           points at /api/paddle/webhook (secret)
 *   PADDLE_ENVIRONMENT      "sandbox" or "production" (optional; worked out
 *                           from the key prefixes when omitted)
 *
 * Payments are only switched on when both the API key and the client token
 * are present. Without them the shop takes clearly labelled test orders.
 */

export type PaddleEnvironment = "sandbox" | "production";

function env(name: string) {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function getPaddleConfig() {
  const apiKey = env("PADDLE_API_KEY");
  const clientToken = env("PADDLE_CLIENT_TOKEN") ?? env("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  const webhookSecret = env("PADDLE_WEBHOOK_SECRET") ?? env("PADDLE_WEBHOOK_SECRET_KEY");

  const explicit = env("PADDLE_ENVIRONMENT")?.toLowerCase();
  let environment: PaddleEnvironment;
  if (explicit === "sandbox" || explicit === "production") environment = explicit;
  // Sandbox client tokens start with "test_"; sandbox API keys contain "_sdbx_".
  else if (clientToken?.startsWith("test_") || apiKey?.includes("_sdbx_")) environment = "sandbox";
  else environment = "production";

  const apiBase =
    env("PADDLE_API_BASE_URL") ??
    (environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com");

  return { enabled: Boolean(apiKey && clientToken), apiKey, clientToken, webhookSecret, environment, apiBase };
}

export class PaddleError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}

async function paddleFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const cfg = getPaddleConfig();
  if (!cfg.apiKey) throw new PaddleError("Paddle is not configured", "not_configured");

  let res: Response;
  try {
    res = await fetch(`${cfg.apiBase}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "Paddle-Version": "1",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    throw new PaddleError("Could not reach Paddle", "network_error");
  }

  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; detail?: string } } | null;
  if (!res.ok || !json?.data) {
    throw new PaddleError(json?.error?.detail ?? `Paddle responded with ${res.status}`, json?.error?.code, res.status);
  }
  return json.data;
}

/** The parts of a Paddle transaction this shop reads. Amounts are strings in cents. */
export type PaddleTransaction = {
  id: string;
  status: "draft" | "ready" | "billed" | "paid" | "completed" | "canceled" | "past_due";
  currency_code: string;
  custom_data: Record<string, unknown> | null;
  items: { quantity: number; price: { unit_price: { amount: string; currency_code: string } } }[];
  details?: {
    totals?: { subtotal: string; tax: string; total: string; grand_total?: string; currency_code: string };
  };
};

export type PaddleLine = {
  /** Shown to the customer in Paddle's payment window and on their receipt. */
  name: string;
  description: string;
  /** Price of one unit, in cents, before tax. */
  unitAmount: number;
  quantity: number;
  imageUrl?: string;
};

/**
 * Creates a Paddle transaction for one order. The catalog lives in this shop's
 * own database, so every line is sent as a "non-catalog" price and product:
 * nothing has to be set up in Paddle's product catalog first.
 * Tax is left to Paddle, which calculates it from the customer's address.
 */
export function createPaddleTransaction(lines: PaddleLine[], customData: Record<string, string>) {
  return paddleFetch<PaddleTransaction>("/transactions", {
    method: "POST",
    body: {
      items: lines.map((l) => ({
        quantity: l.quantity,
        price: {
          name: l.name.slice(0, 150),
          description: l.description.slice(0, 300),
          unit_price: { amount: String(l.unitAmount), currency_code: "USD" },
          product: {
            name: l.name.slice(0, 200),
            description: l.description.slice(0, 300),
            tax_category: "standard",
            ...(l.imageUrl ? { image_url: l.imageUrl } : {}),
          },
        },
      })),
      currency_code: "USD",
      collection_mode: "automatic",
      custom_data: customData,
    },
  });
}

export function getPaddleTransaction(id: string) {
  return paddleFetch<PaddleTransaction>(`/transactions/${encodeURIComponent(id)}`);
}

/**
 * Checks the Paddle-Signature header of a webhook: "ts=<unix>;h1=<hex>".
 * The signature is an HMAC-SHA256 of "<ts>:<raw body>" using the notification
 * destination's secret key. More than one h1 can be present while Paddle
 * rotates secrets. Events older than the tolerance are rejected.
 */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300) {
  if (!header) return false;

  let ts = "";
  const signatures: string[] = [];
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "h1") signatures.push(value);
  }

  const sentAt = Number(ts);
  if (!ts || !Number.isFinite(sentAt) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - sentAt) > toleranceSeconds) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(`${ts}:${rawBody}`, "utf8").digest("hex"));
  return signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
