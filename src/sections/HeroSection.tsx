import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const parisRef = useRef<HTMLHeadingElement>(null);
  const moveRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const badgeTopRef = useRef<HTMLSpanElement>(null);
  const badgeBottomRef = useRef<HTMLSpanElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Initial load animation
      const loadTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      loadTl
        .fromTo(bgRef.current, 
          { opacity: 0, scale: 1.08 }, 
          { opacity: 1, scale: 1, duration: 1.2 }
        )
        .fromTo(parisRef.current, 
          { x: '-40vw', opacity: 0 }, 
          { x: 0, opacity: 1, duration: 0.9 }, 
          0.2
        )
        .fromTo(moveRef.current, 
          { x: '40vw', opacity: 0 }, 
          { x: 0, opacity: 1, duration: 0.9 }, 
          0.2
        )
        .fromTo([subheadRef.current, ctaRef.current], 
          { y: 24, opacity: 0 }, 
          { y: 0, opacity: 1, duration: 0.7, stagger: 0.08 }, 
          0.5
        )
        .fromTo([badgeTopRef.current, badgeBottomRef.current], 
          { scale: 0.85, opacity: 0 }, 
          { scale: 1, opacity: 1, duration: 0.5, stagger: 0.06 }, 
          0.6
        );

      // Scroll-driven exit animation
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.6,
          onLeaveBack: () => {
            // Reset all elements to visible when scrolling back to top
            gsap.set([parisRef.current, moveRef.current, subheadRef.current, ctaRef.current, badgeTopRef.current, badgeBottomRef.current], {
              opacity: 1, x: 0, y: 0, scale: 1
            });
            gsap.set(bgRef.current, { opacity: 1, scale: 1 });
          }
        }
      });

      // SETTLE phase (0% - 70%): Hold position
      // EXIT phase (70% - 100%): Elements exit
      scrollTl
        .fromTo(parisRef.current, 
          { x: 0, opacity: 1 }, 
          { x: '-18vw', opacity: 0, ease: 'power2.in' }, 
          0.7
        )
        .fromTo(moveRef.current, 
          { x: 0, opacity: 1 }, 
          { x: '18vw', opacity: 0, ease: 'power2.in' }, 
          0.7
        )
        .fromTo([subheadRef.current, ctaRef.current], 
          { y: 0, opacity: 1 }, 
          { y: '-10vh', opacity: 0, ease: 'power2.in' }, 
          0.72
        )
        .fromTo(badgeTopRef.current, 
          { y: 0, opacity: 1 }, 
          { y: '-5vh', opacity: 0, ease: 'power2.in' }, 
          0.75
        )
        .fromTo(badgeBottomRef.current, 
          { y: 0, opacity: 1 }, 
          { y: '5vh', opacity: 0, ease: 'power2.in' }, 
          0.75
        )
        .fromTo(bgRef.current, 
          { scale: 1, opacity: 1 }, 
          { scale: 1.06, opacity: 0.3, ease: 'power2.in' }, 
          0.75
        );

    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      className="relative w-full h-screen overflow-hidden bg-cream"
      style={{ zIndex: 10 }}
    >
      {/* Background Image */}
      <div 
        ref={bgRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0 }}
      >
        <img 
          src="/hero_bg.jpg" 
          alt="Paris Move" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cream/30 via-transparent to-cream/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between px-6 lg:px-12 py-20 lg:py-24">
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <h1 
            ref={parisRef}
            className="heading-display text-hero text-black"
            style={{ opacity: 0 }}
          >
            PARIS
          </h1>
          <span 
            ref={badgeTopRef}
            className="micro-label text-black/80 bg-cream/80 backdrop-blur-sm px-4 py-2 rounded-full"
            style={{ opacity: 0 }}
          >
            NEW ARRIVALS
          </span>
        </div>

        {/* Center Section */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p 
            ref={subheadRef}
            className="text-lg lg:text-xl font-light tracking-wide text-black/90 mb-8"
            style={{ opacity: 0 }}
          >
            Move with Elegance
          </p>
          <div ref={ctaRef} style={{ opacity: 0 }}>
            <Link to="/shop" className="btn-primary inline-block">
              Shop the Collection
            </Link>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex justify-between items-end">
          <span 
            ref={badgeBottomRef}
            className="micro-label text-black/80 bg-cream/80 backdrop-blur-sm px-4 py-2 rounded-full"
            style={{ opacity: 0 }}
          >
            FREE SHIPPING
          </span>
          <h1 
            ref={moveRef}
            className="heading-display text-hero text-black"
            style={{ opacity: 0 }}
          >
            MOVE
          </h1>
        </div>
      </div>
    </section>
  );
}
