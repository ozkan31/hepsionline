import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { Instagram, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export function FooterSection() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const newsletterRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(newsletterRef.current,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: newsletterRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );

      const linkItems = linksRef.current?.querySelectorAll('.footer-link');
      if (linkItems) {
        gsap.fromTo(linkItems,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.4,
            stagger: 0.05,
            scrollTrigger: {
              trigger: linksRef.current,
              start: 'top 85%',
              toggleActions: 'play none none reverse'
            }
          }
        );
      }

    }, section);

    return () => ctx.revert();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 3000);
    }
  };

  const customerCareLinks = [
    { name: 'Shipping', path: '/shipping' },
    { name: 'Returns', path: '/returns' },
    { name: 'FAQ', path: '/faq' },
    { name: 'Contact', path: '/contact' },
  ];

  const socialLinks = [
    { name: 'Instagram', path: 'https://instagram.com', icon: Instagram },
    { name: 'Pinterest', path: 'https://pinterest.com' },
    { name: 'TikTok', path: 'https://tiktok.com' },
  ];

  return (
    <footer 
      ref={sectionRef}
      className="relative w-full bg-black text-cream py-16 lg:py-20"
      style={{ zIndex: 100 }}
    >
      <div className="w-full px-6 lg:px-12">
        {/* Newsletter */}
        <div ref={newsletterRef} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 pb-16 border-b border-cream/20">
          <div>
            <h3 className="text-2xl lg:text-3xl font-display font-bold tracking-tight mb-2">
              Join the list
            </h3>
            <p className="text-sm text-cream/65">
              Early access to drops, city guides, and member-only edits.
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="flex w-full lg:w-auto gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 lg:w-72 bg-transparent border-b border-cream/30 focus:border-cream text-cream placeholder:text-cream/40 py-3 outline-none text-sm"
            />
            <button
              type="submit"
              className="bg-cream text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-gold transition-colors flex items-center gap-2"
            >
              {isSubscribed ? 'Subscribed!' : 'Subscribe'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Links */}
        <div ref={linksRef} className="grid grid-cols-2 lg:grid-cols-4 gap-10 py-16">
          {/* Customer Care */}
          <div>
            <h4 className="micro-label text-cream/50 mb-6">Customer Care</h4>
            <ul className="space-y-3">
              {customerCareLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.path}
                    className="footer-link text-sm text-cream/80 hover:text-cream transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Follow */}
          <div>
            <h4 className="micro-label text-cream/50 mb-6">Follow</h4>
            <ul className="space-y-3">
              {socialLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link text-sm text-cream/80 hover:text-cream transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4 className="micro-label text-cream/50 mb-6">About</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/about" className="footer-link text-sm text-cream/80 hover:text-cream transition-colors">
                  Our Story
                </Link>
              </li>
              <li>
                <Link to="/sustainability" className="footer-link text-sm text-cream/80 hover:text-cream transition-colors">
                  Sustainability
                </Link>
              </li>
              <li>
                <Link to="/careers" className="footer-link text-sm text-cream/80 hover:text-cream transition-colors">
                  Careers
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="micro-label text-cream/50 mb-6">Contact</h4>
            <ul className="space-y-3">
              <li className="footer-link text-sm text-cream/80">
                hello@parismove.com
              </li>
              <li className="footer-link text-sm text-cream/80">
                +33 1 23 45 67 89
              </li>
              <li className="footer-link text-sm text-cream/80">
                12 Rue de la Paix<br />
                75002 Paris, France
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 pt-8 border-t border-cream/10">
          <div className="flex gap-6">
            <Link to="/privacy" className="text-xs text-cream/50 hover:text-cream transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="text-xs text-cream/50 hover:text-cream transition-colors">
              Terms
            </Link>
          </div>
          <p className="font-display text-xl font-bold tracking-tight">
            Paris move
          </p>
          <p className="text-xs text-cream/50">
            © 2024 Paris Move. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
