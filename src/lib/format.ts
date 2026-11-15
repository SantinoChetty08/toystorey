export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/**
 * Storewide sale. Applied to every product exactly once per database when the
 * app starts (see applyStorewideSale in src/db/bootstrap.ts): the selling price
 * drops by `percentOff` and the previous price is kept as the "was" price.
 */
export const STOREWIDE_SALE: { version: number; percentOff: number } = { version: 1, percentOff: 50 };

/** Whole-number percentage saved, or 0 when there is no higher "was" price. */
export function discountPercent(price: number, compareAtPrice: number | null | undefined) {
  if (!compareAtPrice || compareAtPrice <= price) return 0;
  return Math.round((1 - price / compareAtPrice) * 100);
}

const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;

// Order here is the order of the collection tiles on the home page (first = large tile).
export const CATEGORIES: Record<string, { label: string; blurb: string; image: string }> = {
  diecast: {
    label: "Die-Cast",
    blurb: "Hot Wheels RLC, Car Culture and Treasure Hunts, plus premium 1:64 to 1:18.",
    image: "/images/col-diecast.jpg",
  },
  kits: {
    label: "LEGO & Kits",
    blurb: "Technic flagships, Speed Champions and Gunpla for grown-up builders.",
    image: pexels(34200502),
  },
  rc: {
    label: "RC Cars",
    blurb: "Hobby-grade crawlers, bashers, drifters and racing kits.",
    image: "/images/col-rc.jpg",
  },
  collectibles: {
    label: "Collectibles",
    blurb: "Die-cast mecha, graded vintage and sixth-scale figures.",
    image: "/images/col-figures.jpg",
  },
  display: {
    label: "Display & Care",
    blurb: "Cabinets, dioramas and protectors worthy of your collection.",
    image: pexels(5795435),
  },
};

export const categoryLabel = (c: string) => CATEGORIES[c]?.label ?? c;

export const BRAND_BLURBS: Record<string, string> = {
  "Hot Wheels": "Red Line Club exclusives, Car Culture, Boulevard, Team Transport and sealed mainline cases.",
  LEGO: "Technic 1:8 flagships, Icons and Speed Champions, new releases and retired sets.",
};

export const SHIPPING_METHODS = [
  { id: "standard", label: "Insured Standard", eta: "4–6 business days", price: 795 },
  { id: "express", label: "Insured Express", eta: "1–2 business days", price: 1995 },
] as const;

export type ShippingMethodId = (typeof SHIPPING_METHODS)[number]["id"];

export const FREE_SHIPPING_THRESHOLD = 15000;

/** Countries the checkout ships to. The code is what Paddle expects for the customer's address. */
export const COUNTRIES = [
  { name: "United States", code: "US" },
  { name: "Canada", code: "CA" },
  { name: "United Kingdom", code: "GB" },
  { name: "Australia", code: "AU" },
  { name: "Germany", code: "DE" },
  { name: "Japan", code: "JP" },
] as const;

/**
 * Order total before tax. Tax is not estimated here: the payment provider
 * works it out from the customer's address and collects it at payment.
 */
export function computeTotals(subtotal: number, method: string) {
  const m = SHIPPING_METHODS.find((s) => s.id === method) ?? SHIPPING_METHODS[0];
  const shipping = subtotal === 0 ? 0 : m.id === "standard" && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : m.price;
  return { subtotal, shipping, total: subtotal + shipping };
}
