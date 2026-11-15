import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-8xl italic text-accent">404</p>
      <h1 className="mt-4 font-display text-3xl">This one rolled under the couch.</h1>
      <p className="mt-3 text-ink/60">We couldn&apos;t find the page you were looking for.</p>
      <Link href="/shop" className="mt-8 rounded-full bg-ink px-8 py-4 font-medium text-paper hover:bg-accent">
        Back to the shop
      </Link>
    </div>
  );
}
