"use client";

import { useMemo, useState } from "react";

type GalleryImage = {
  id: number | string;
  url: string;
  alt: string;
};

export default function GalleryClient({ images }: { images: GalleryImage[] }) {
  const safeImages = useMemo(() => images.filter((img) => Boolean(img.url)), [images]);
  const [activeIndex, setActiveIndex] = useState(0);

  if (safeImages.length === 0) {
    return <div className="grid h-[420px] place-items-center rounded-xl bg-slate-100 text-sm text-slate-500">Görsel bulunamadı</div>;
  }

  const active = safeImages[Math.min(activeIndex, safeImages.length - 1)];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.url} alt={active.alt} className="h-[420px] w-full object-cover" />
      </div>

      <div className="flex gap-3 overflow-x-auto">
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
    </div>
  );
}
