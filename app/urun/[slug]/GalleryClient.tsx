"use client";

import { useMemo, useRef, useState } from "react";

type GalleryImage = {
  id: number | string;
  url: string;
  alt: string;
};

export default function GalleryClient({ images }: { images: GalleryImage[] }) {
  const safeImages = useMemo(() => images.filter((img) => Boolean(img.url)), [images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPercent, setZoomPercent] = useState({ x: 50, y: 50 });
  const imageWrapRef = useRef<HTMLDivElement | null>(null);

  if (safeImages.length === 0) {
    return <div className="grid h-[420px] place-items-center rounded-xl bg-slate-100 text-sm text-slate-500">Görsel bulunamadı</div>;
  }

  const active = safeImages[Math.min(activeIndex, safeImages.length - 1)];
  const canSlide = safeImages.length > 1;

  const goPrev = () => {
    if (!canSlide) return;
    setActiveIndex((prev) => (prev === 0 ? safeImages.length - 1 : prev - 1));
  };

  const goNext = () => {
    if (!canSlide) return;
    setActiveIndex((prev) => (prev === safeImages.length - 1 ? 0 : prev + 1));
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = imageWrapRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const localX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const localY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    setZoomPercent({
      x: rect.width > 0 ? (localX / rect.width) * 100 : 50,
      y: rect.height > 0 ? (localY / rect.height) * 100 : 50,
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="relative min-w-0 overflow-visible">
          <div
            ref={imageWrapRef}
            className="group relative overflow-hidden rounded-xl bg-slate-100"
            onMouseEnter={() => setZoomActive(true)}
            onMouseLeave={() => setZoomActive(false)}
            onMouseMove={handleMouseMove}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={active.url} alt={active.alt} className="h-[420px] w-full object-cover" />
          </div>
          {canSlide ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Önceki görsel"
                className="absolute -left-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:border-teal-600 hover:bg-teal-600 hover:text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Sonraki görsel"
                className="absolute -right-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:border-teal-600 hover:bg-teal-600 hover:text-white"
              >
                ›
              </button>
            </>
          ) : null}
        </div>

        {zoomActive ? (
          <div
            className="absolute left-full top-0 z-30 ml-3 hidden h-40 w-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm md:block"
            style={{
              backgroundImage: `url(${active.url})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "280% 280%",
              backgroundPosition: `${zoomPercent.x}% ${zoomPercent.y}%`,
            }}
          />
        ) : null}
      </div>

      <div
        className="gallery-thumbs flex gap-3 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {safeImages.map((img, index) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={[
              "h-16 w-24 flex-none overflow-hidden rounded-xl border bg-slate-100",
              index === activeIndex ? "border-teal-600" : "border-slate-200",
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <style jsx>{`
        .gallery-thumbs::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
