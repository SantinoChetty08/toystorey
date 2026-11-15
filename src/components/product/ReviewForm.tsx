"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewForm({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  if (state === "done") {
    return <p className="rounded-2xl bg-white p-5 text-sm animate-fade-in">Thanks for your review! It&apos;s now live below. 🏁</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-full border border-ink px-6 py-3 text-sm font-medium transition hover:bg-ink hover:text-paper">
        Write a review
      </button>
    );
  }

  return (
    <form
      className="space-y-4 rounded-3xl bg-white p-6 animate-fade-up"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setState("saving");
        setError("");
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            rating,
            author: fd.get("author"),
            location: fd.get("location"),
            title: fd.get("title"),
            body: fd.get("body"),
          }),
        });
        if (res.ok) {
          setState("done");
          router.refresh();
        } else {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "Something went wrong");
          setState("error");
        }
      }}
    >
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]">Your rating</p>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              aria-label={`${n} stars`}
              className={`text-3xl transition hover:scale-110 ${(hover || rating) >= n ? "text-gold" : "text-ink/15"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="author" required maxLength={40} placeholder="Name" className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink" />
        <input name="location" maxLength={40} placeholder="City (optional)" className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink" />
      </div>
      <input name="title" required maxLength={80} placeholder="Headline" className="w-full rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink" />
      <textarea name="body" required minLength={10} maxLength={1500} rows={4} placeholder="What did you think of the piece, packaging and shipping?" className="w-full rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-ink" />
      {error && <p className="text-sm text-accent">{error}</p>}
      <div className="flex gap-3">
        <button disabled={state === "saving"} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-accent disabled:opacity-50">
          {state === "saving" ? "Posting…" : "Post review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 text-sm text-ink/60 hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
