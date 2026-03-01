import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

interface FeatureSectionProps {
  title: string;
  topText: string;
  bottomText: string;
  ctaText: string;
  ctaLink: string;
  bgImage: string;
  portraitImage: string;
  zIndex: number;
}

export function FeatureSection({
  title,
  topText,
  bottomText,
  ctaText,
  ctaLink,
  bgImage,
  portraitImage,
  zIndex,
}: FeatureSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const topTextRef = useRef<HTMLParagraphElement>(null);
  const bottomTextRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
        }
      });

      // ENTRANCE (0% - 30%)
      scrollTl
        .fromTo(portraitRef.current, 
          { y: '110vh', scale: 0.86, opacity: 0 }, 
          { y: 0, scale: 1, opacity: 1, ease: 'power2.out' }, 
          0
        )
        .fromTo(headlineRef.current, 
          { x: '-60vw', opacity: 0 }, 
          { x: 0, opacity: 1, ease: 'power2.out' }, 
          0
        )
        .fromTo(topTextRef.current, 
          { x: '30vw', opacity: 0 }, 
          { x: 0, opacity: 1, ease: 'power2.out' }, 
          0.05
        )
        .fromTo(bottomTextRef.current, 
          { x: '-30vw', opacity: 0 }, 
          { x: 0, opacity: 1, ease: 'power2.out' }, 
          0.08
        );

      // SETTLE (30% - 70%): Elements hold position

      // EXIT (70% - 100%)
      scrollTl
        .fromTo(portraitRef.current, 
          { y: 0, scale: 1, opacity: 1 }, 
          { y: '-90vh', scale: 0.92, opacity: 0, ease: 'power2.in' }, 
          0.7
        )
        .fromTo(headlineRef.current, 
          { x: 0, opacity: 1 }, 
          { x: '40vw', opacity: 0, ease: 'power2.in' }, 
          0.7
        )
        .fromTo(topTextRef.current, 
          { x: 0, opacity: 1 }, 
          { x: '12vw', opacity: 0, ease: 'power2.in' }, 
          0.7
        )
        .fromTo(bottomTextRef.current, 
          { x: 0, opacity: 1 }, 
          { x: '-12vw', opacity: 0, ease: 'power2.in' }, 
          0.7
        )
        .fromTo(bgRef.current, 
          { scale: 1, opacity: 1 }, 
          { scale: 1.04, opacity: 0.4, ease: 'power2.in' }, 
          0.75
        );

    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      className="relative w-full h-screen overflow-hidden bg-cream"
      style={{ zIndex }}
    >
      {/* Background Image */}
      <div ref={bgRef} className="absolute inset-0 w-full h-full">
        <img 
          src={bgImage} 
          alt={title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-cream/20" />
      </div>

      {/* Large Headline Behind Portrait */}
      <h2 
        ref={headlineRef}
        className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 heading-display text-section text-black/90 whitespace-nowrap pointer-events-none select-none"
        style={{ zIndex: 5 }}
      >
        {title}
      </h2>

      {/* Center Portrait Card */}
      <div 
        ref={portraitRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(34vw,420px)] h-[min(72vh,720px)] rounded-md overflow-hidden shadow-product"
        style={{ zIndex: 10 }}
      >
        <img 
          src={portraitImage} 
          alt={title} 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Top Right Text */}
      <p 
        ref={topTextRef}
        className="absolute right-[4vw] top-[10vh] w-[min(26vw,340px)] text-sm lg:text-base text-black/80 leading-relaxed text-left"
        style={{ zIndex: 15 }}
      >
        {topText}
      </p>

      {/* Bottom Left Text + CTA */}
      <div 
        ref={bottomTextRef}
        className="absolute left-[4vw] bottom-[10vh] w-[min(26vw,340px)]"
        style={{ zIndex: 15 }}
      >
        <p className="text-sm lg:text-base text-black/80 leading-relaxed mb-6">
          {bottomText}
        </p>
        <Link 
          to={ctaLink} 
          className="text-sm font-medium text-black underline underline-offset-4 hover:text-gold transition-colors"
        >
          {ctaText}
        </Link>
      </div>
    </section>
  );
}
