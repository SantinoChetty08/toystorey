"use client";

export function QtyStepper({
  value,
  onChange,
  max = 99,
  min = 1,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  min?: number;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-8" : "h-12";
  const w = size === "sm" ? "w-8" : "w-11";
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-ink/15 bg-white`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min - 1, value - 1))}
        className={`${w} grid h-full place-items-center rounded-l-full text-lg transition hover:bg-ink/5`}
      >
        −
      </button>
      <span className={`min-w-6 text-center tabular-nums ${size === "sm" ? "text-sm" : ""}`}>{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${w} grid h-full place-items-center rounded-r-full text-lg transition hover:bg-ink/5 disabled:opacity-30`}
      >
        +
      </button>
    </div>
  );
}
