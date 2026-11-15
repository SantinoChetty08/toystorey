# ToyStorey

Online shop for adult collectors: die-cast, LEGO and model kits, RC cars, collectibles and display gear.

Built with Next.js (App Router), PostgreSQL via Drizzle ORM, and Tailwind CSS.

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env` and point `DATABASE_URL` at a PostgreSQL database.
3. `npm run dev`, then open http://localhost:3000

The database tables are created and the demo catalog is loaded automatically on first start.
A storewide 50% sale is applied once at that point (`STOREWIDE_SALE` in `src/lib/format.ts`).

## Payments

Checkout uses Paddle Billing when `PADDLE_API_KEY` and `PADDLE_CLIENT_TOKEN` are set; `.env.example`
explains each setting. Without them the shop runs in a clearly labelled test mode and takes no payment.

Paddle only opens its live payment window on a domain that has been approved in the Paddle account.

## Before launch

- The catalog, reviews, product photos, business address and policies are demo content.
  Set `SEED_DEMO_DATA=false` once your own catalog is loaded.
- There is no admin screen yet: products, stock and orders are managed in the database.
- Keep `.env` and real keys out of the repository.
