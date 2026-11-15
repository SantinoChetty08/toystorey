import "server-only";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// Server-only Paddle client. Never import this from a client component.
// Required secrets (set in your hosting provider's environment settings):
//   PADDLE_API_KEY           - server API key from Paddle dashboard > Developer tools > Authentication
//   PADDLE_WEBHOOK_SECRET    - secret for the notification destination pointing at /api/webhooks/paddle
//   PADDLE_ENVIRONMENT       - "sandbox" or "production" (defaults to sandbox)

let client: Paddle | null = null;

export function getPaddle(): Paddle {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY is not configured");
  if (!client) {
    const env = process.env.PADDLE_ENVIRONMENT === "production" ? Environment.production : Environment.sandbox;
    client = new Paddle(apiKey, { environment: env });
  }
  return client;
}

export function getWebhookSecret(): string {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) throw new Error("PADDLE_WEBHOOK_SECRET is not configured");
  return secret;
}
