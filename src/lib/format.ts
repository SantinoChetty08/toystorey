export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export const CATEGORIES: Record<string, { label: string; blurb: string; image: string }> = {
  diecast: {
    label: "Die-Cast",
    blurb: "Hot Wheels, Treasure Hunts, RLC & premium 1:64 to 1:18.",
    image: "/images/col-diecast.jpg",
  },
  rc: {
    label: "RC Cars",
    blurb: "Hobby-grade crawlers, bashers and racing kits.",
    image: "/images/col-rc.jpg",
  },
  collectibles: {
    label: "Collectibles",
    blurb: "Die-cast mecha, graded vintage and sixth-scale figures.",
    image: "/images/col-figures.jpg",
  },
  lego: {
    label: "LEGO & Bricks",
    blurb: "Speed Champions, modular buildings, Technic and minifigure drops.",
    image: "/images/p-lego-icons.jpg",
  },
  display: {
    label: "Display & Care",
    blurb: "Cabinets, dioramas and protectors worthy of your collection.",
    image: "https://images.pexels.com/photos/5795435/pexels-photo-5795435.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
};

export const categoryLabel = (c: string) => CATEGORIES[c]?.label ?? c;

export const SHIPPING_METHODS = [
  { id: "standard", label: "Insured Standard", eta: "4–6 business days", price: 795 },
  { id: "express", label: "Insured Express", eta: "1–2 business days", price: 1995 },
] as const;

export type ShippingMethodId = (typeof SHIPPING_METHODS)[number]["id"];

export const FREE_SHIPPING_THRESHOLD = 15000;
// Paddle is the merchant of record and calculates VAT/sales tax at payment time,
// so the store no longer adds its own tax line.
export const TAX_RATE = 0;

export function computeTotals(subtotal: number, method: string) {
  const m = SHIPPING_METHODS.find((s) => s.id === method) ?? SHIPPING_METHODS[0];
  const shipping = subtotal === 0 ? 0 : m.id === "standard" && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : m.price;
  const tax = Math.round(subtotal * TAX_RATE);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}
