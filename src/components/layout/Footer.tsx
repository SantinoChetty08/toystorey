import Link from "next/link";
import { Newsletter } from "./Newsletter";

export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Link href="/" className="font-display text-3xl">
            Toy<span className="italic text-accent">Storey</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/60">
            The collector&apos;s toy store. Rare die-cast, hobby-grade RC and premium collectibles — inspected, protected
            and shipped by people who collect too.
          </p>
          <Newsletter />
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-paper/50">Shop</h4>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link className="hover:text-accent" href="/shop?category=diecast">Die-Cast</Link></li>
            <li><Link className="hover:text-accent" href="/shop?category=rc">RC Cars</Link></li>
            <li><Link className="hover:text-accent" href="/shop?category=collectibles">Collectibles</Link></li>
            <li><Link className="hover:text-accent" href="/shop?category=display">Display &amp; Care</Link></li>
            <li><Link className="hover:text-accent" href="/shop?sort=newest">New Arrivals</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-paper/50">Service</h4>
          <ul className="mt-4 space-y-3 text-sm text-paper/80">
            <li>Insured shipping</li>
            <li>30-day returns</li>
            <li>Authenticity guarantee</li>
            <li>Collector grading</li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-paper/50">Visit</h4>
          <ul className="mt-4 space-y-3 text-sm text-paper/80">
            <li>214 Chrome Street</li>
            <li>Portland, OR 97209</li>
            <li>hello@toystorey.com</li>
            <li>Tue–Sun · 10am–7pm</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-paper/40 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} ToyStorey Collectibles. All rights reserved.</p>
          <p>Brand names are trademarks of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}
