import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import { products, categories } from '@/data/products';
import { useStore } from '@/store/StoreContext';

gsap.registerPlugin(ScrollTrigger);

export function ShopSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const { dispatch } = useStore();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Header animation
      gsap.fromTo(headerRef.current,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
          }
        }
      );

      // Product cards animation
      const productCards = productsRef.current?.querySelectorAll('.product-card');
      if (productCards) {
        gsap.fromTo(productCards,
          { y: 40, opacity: 0, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.1,
            scrollTrigger: {
              trigger: productsRef.current,
              start: 'top 75%',
              toggleActions: 'play none none reverse'
            }
          }
        );
      }

      // Categories animation
      const categoryCards = categoriesRef.current?.querySelectorAll('.category-card');
      if (categoryCards) {
        gsap.fromTo(categoryCards,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.15,
            scrollTrigger: {
              trigger: categoriesRef.current,
              start: 'top 75%',
              toggleActions: 'play none none reverse'
            }
          }
        );
      }

    }, section);

    return () => ctx.revert();
  }, []);

  const addToWishlist = (product: typeof products[0]) => {
    dispatch({ type: 'ADD_TO_WISHLIST', payload: product });
  };

  const bestsellers = products.filter(p => p.isBestseller).slice(0, 4);

  return (
    <section 
      ref={sectionRef} 
      className="relative w-full bg-cream py-20 lg:py-28"
      style={{ zIndex: 90 }}
    >
      <div className="w-full px-6 lg:px-12">
        {/* Header */}
        <div ref={headerRef} className="flex justify-between items-end mb-12">
          <h2 className="heading-section text-4xl lg:text-5xl text-black">Bestsellers</h2>
          <Link 
            to="/shop" 
            className="text-sm font-medium text-black underline underline-offset-4 hover:text-gold transition-colors flex items-center gap-2"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Products Grid */}
        <div 
          ref={productsRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-20"
        >
          {bestsellers.map((product) => (
            <div key={product.id} className="product-card group">
              <Link to={`/product/${product.id}`} className="block">
                <div className="relative aspect-square overflow-hidden rounded-md bg-warm-grey/10 mb-4">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {product.isNew && (
                    <span className="absolute top-3 left-3 micro-label bg-black text-white px-3 py-1 rounded-full">
                      NEW
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      addToWishlist(product);
                    }}
                    className="absolute top-3 right-3 w-9 h-9 bg-cream/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-gold hover:text-white"
                  >
                    <Heart className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <button className="w-full bg-black text-white text-sm font-medium py-3 rounded-full hover:bg-gold transition-colors">
                      Quick Add
                    </button>
                  </div>
                </div>
                <h3 className="text-base font-medium text-black mb-1">{product.name}</h3>
                <p className="text-sm text-grey">€{product.price}</p>
              </Link>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div 
          ref={categoriesRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {categories.map((category) => (
            <Link 
              key={category.id} 
              to={`/shop?category=${category.id}`}
              className="category-card group relative h-[34vh] rounded-md overflow-hidden"
            >
              <img 
                src={category.image} 
                alt={category.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <h3 className="text-2xl lg:text-3xl font-display font-bold tracking-tight mb-2">
                  {category.name}
                </h3>
                <p className="text-sm text-white/80">{category.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Link to="/shop" className="btn-outline inline-flex items-center gap-2">
            See the full collection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
