"use client";

import { useState } from "react";

export function Newsletter() {
  const [done, setDone] = useState(false);
  return done ? (
    <p className="mt-6 text-sm text-accent animate-fade-in">You&apos;re on the list — first dibs on the next drop. 🏁</p>
  ) : (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="mt-6 flex max-w-sm overflow-hidden rounded-full border border-paper/20 focus-within:border-paper/60"
    >
      <input
        type="email"
        required
        placeholder="Email for drop alerts"
        className="min-w-0 flex-1 bg-transparent px-5 py-3 text-sm outline-none placeholder:text-paper/40"
      />
      <button className="bg-paper px-5 text-sm font-medium text-ink transition hover:bg-accent hover:text-white">Join</button>
    </form>
  );
}
