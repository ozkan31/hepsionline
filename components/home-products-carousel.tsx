"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

type HomeProductsCarouselProps = {
  children: ReactNode;
};

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="icon icon-carousel-arrow">
      {direction === "left" ? (
        <path d="M14.5 6.5 9 12l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9.5 6.5 15 12l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function HomeProductsCarousel({ children }: HomeProductsCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canGoPrev, setCanGoPrev] = useState(false);

  const updateCanGoPrev = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      setCanGoPrev(false);
      return;
    }

    setCanGoPrev(track.scrollLeft > 1);
  }, []);

  const getCardUnitInPixels = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      return 0;
    }

    const firstCard = track.querySelector<HTMLElement>(".product-card");
    if (!firstCard) {
      return track.clientWidth;
    }

    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0");
    const cardWidth = firstCard.getBoundingClientRect().width;

    return cardWidth + gap;
  }, []);

  const slide = useCallback(
    (direction: "left" | "right") => {
      const track = trackRef.current;
      if (!track) {
        return;
      }

      const unit = getCardUnitInPixels();
      if (unit <= 0) {
        return;
      }

      const styles = window.getComputedStyle(track);
      const stepValue = Number.parseInt(styles.getPropertyValue("--carousel-step").trim(), 10);
      const stepCards = Number.isFinite(stepValue) && stepValue > 0 ? stepValue : 6;
      const step = unit * stepCards;
      const rawTarget = track.scrollLeft + (direction === "left" ? -step : step);
      const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
      const clampedTarget = Math.max(0, Math.min(maxScrollLeft, rawTarget));
      const alignedTarget = Math.round(clampedTarget / unit) * unit;

      track.scrollTo({
        left: alignedTarget,
        behavior: "smooth",
      });
    },
    [getCardUnitInPixels],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      updateCanGoPrev();
    });

    const onScroll = () => {
      updateCanGoPrev();
    };

    const onResize = () => {
      updateCanGoPrev();
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateCanGoPrev]);

  return (
    <div className="products-carousel-shell">
      {canGoPrev ? (
        <button
          type="button"
          className="carousel-nav carousel-nav-left"
          onClick={() => slide("left")}
          aria-label="Ürünleri sola kaydır"
        >
          <ArrowIcon direction="left" />
        </button>
      ) : null}

      <div ref={trackRef} className="products-carousel-track">
        {children}
      </div>

      <button
        type="button"
        className="carousel-nav carousel-nav-right"
        onClick={() => slide("right")}
        aria-label="Ürünleri sağa kaydır"
      >
        <ArrowIcon direction="right" />
      </button>
    </div>
  );
}
