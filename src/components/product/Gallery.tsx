"use client";

import { useEffect, useState } from "react";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setActive((a) => (a + 1) % images.length);
      if (e.key === "ArrowLeft") setActive((a) => (a - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, images.length]);

  const go = (d: number) => setActive((a) => (a + d + images.length) % images.length);

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar md:w-20 md:flex-col">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-white transition ${
                i === active ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1">
        <div
          className="relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl bg-white"
          onMouseEnter={() => setZoom((z) => ({ ...z, on: true }))}
          onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ on: true, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onClick={() => setLightbox(true)}
        >
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={i === active ? name : ""}
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-500 ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
              style={
                i === active
                  ? { transform: zoom.on ? "scale(1.8)" : "scale(1)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                  : undefined
              }
            />
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous image" className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg backdrop-blur transition hover:scale-110 md:hidden">‹</button>
            <button onClick={() => go(1)} aria-label="Next image" className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg backdrop-blur transition hover:scale-110 md:hidden">›</button>
          </>
        )}
        <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-ink/70 px-3 py-1 text-xs text-paper backdrop-blur">
          {active + 1} / {images.length}
        </span>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 p-4 animate-fade-in" onClick={() => setLightbox(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[active]} alt={name} className="max-h-[88vh] max-w-full rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute right-6 top-6 text-3xl text-paper" aria-label="Close">✕</button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-5xl text-paper/70 hover:text-paper" aria-label="Previous">‹</button>
              <button onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl text-paper/70 hover:text-paper" aria-label="Next">›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
