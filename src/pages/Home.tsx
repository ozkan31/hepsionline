import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import type { Product, Category } from '@/types';
import { fetchProducts } from '@/lib/api';
import { queuePendingWishlistProduct } from '@/lib/pendingWishlist';

const banners = [
  { id: 1, image: '/banner1.jpg', title: 'Yeni Sezon', subtitle: 'Zarif ve şık çantalar', cta: 'Keşfet', link: '/shop' },
  { id: 2, image: '/banner2.jpg', title: 'Özel Koleksiyon', subtitle: 'Her anınıza eşlik eder', cta: 'İncele', link: '/shop' },
  { id: 3, image: '/banner3.jpg', title: 'Şıklık ve Konfor', subtitle: 'Tarzınızı yansıtın', cta: 'Alışverişe Başla', link: '/shop' }
];

const HOME_CATEGORIES: Category[] = [
  { id: 'crossbody', name: 'Çapraz Çantalar', image: '/cat_crossbody.jpg', description: 'Günlük kullanıma uygun şık çapraz çantalar' },
  { id: 'mini', name: 'Mini Çantalar', image: '/cat_mini.jpg', description: 'Kompakt ve zarif mini çantalar' },
  { id: 'shoulder', name: 'Omuz Çantaları', image: '/cat_shoulder.jpg', description: 'Elegant omuz çantaları' },
  { id: 'new', name: 'Yeni Gelenler', image: '/cat_new.jpg', description: 'En yeni koleksiyonumuz' }
];

const normalizeTurkishText = (value: string) =>
  String(value ?? '')
    .replaceAll('Ã¼', 'ü')
    .replaceAll('Ãœ', 'Ü')
    .replaceAll('Ã¶', 'ö')
    .replaceAll('Ã–', 'Ö')
    .replaceAll('Ã§', 'ç')
    .replaceAll('Ã‡', 'Ç')
    .replaceAll('ÄŸ', 'ğ')
    .replaceAll('Äž', 'Ğ')
    .replaceAll('ÅŸ', 'ş')
    .replaceAll('Åž', 'Ş')
    .replaceAll('Ä±', 'ı')
    .replaceAll('Ä°', 'İ')
    .replaceAll('Â', '');

export function Home() {
  const navigate = useNavigate();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [visibleProducts, setVisibleProducts] = useState<Product[]>([]);
  const [categories] = useState<Category[]>(HOME_CATEGORIES);
  const { dispatch, state } = useStore();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const productsData = await fetchProducts({ limit: 24 });
        if (!isMounted) return;
        setProducts(productsData);
      } catch (error) {
        console.error('Failed to fetch homepage data:', error);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setVisibleProducts([]);
    if (products.length === 0) return;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleProducts(products.slice(0, index));
      if (index >= products.length) {
        window.clearInterval(timer);
      }
    }, 90);

    return () => {
      window.clearInterval(timer);
    };
  }, [products]);

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % banners.length);
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextBanner();
      else prevBanner();
    }
  };

  const addToWishlist = (product: Product) => {
    if (!state.isAuthenticated) {
      queuePendingWishlistProduct(product);
      navigate('/giris?redirect=/favoriler');
      return;
    }
    if (isInWishlist(product.id)) {
      dispatch({ type: 'REMOVE_FROM_WISHLIST', payload: product.id });
      return;
    }
    dispatch({ type: 'ADD_TO_WISHLIST', payload: product });
  };

  const addToCart = (product: Product) => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: { product, quantity: 1, color: product.colors[0] }
    });
  };

  const isInWishlist = (productId: string) => {
    return state.wishlist.some(item => item.id === productId);
  };

  const isInCart = (productId: string) => {
    return state.cart.some(item => item.product.id === productId);
  };

  const getProductTags = (product: Product) => {
    if (Array.isArray(product.tags) && product.tags.length > 0) {
      return product.tags;
    }
    const fallback: string[] = [];
    if (product.isNew) fallback.push('Yeni');
    if (product.isBestseller) fallback.push('Çok Satan');
    return fallback;
  };

  return (
    <main className="min-h-screen bg-[#F8F7F4]">
      <section
        className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === currentBanner ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={banner.image}
              alt={banner.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-wide mb-4 drop-shadow-lg">
                {banner.title}
              </h2>
              <p className="text-lg md:text-xl mb-8 drop-shadow-md">{banner.subtitle}</p>
              <Link
                to={banner.link}
                className="bg-white text-black px-8 py-3 rounded-full font-medium hover:bg-black hover:text-white transition-colors"
              >
                {banner.cta}
              </Link>
            </div>
          </div>
        ))}

        <button
          onClick={prevBanner}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={nextBanner}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentBanner ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </section>

      <section className="py-12 md:py-16 px-4 md:px-8">
        <h2 className="text-2xl md:text-3xl font-light text-center mb-10">Kategoriler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/shop?category=${cat.id}`}
              className="group relative aspect-[4/3] rounded-lg overflow-hidden"
            >
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <h3 className="text-lg md:text-xl font-medium">{cat.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-12 md:py-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl md:text-3xl font-light">Tüm Ürünler</h2>
            <Link to="/shop" className="text-sm text-gray-600 hover:text-black underline">
              Tümünü Gör
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            {visibleProducts.map((product) => (
              <div key={product.id} className="group">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-3">
                  <Link to={`/product/${product.id}`}>
                    <img
                      src={product.image}
                      alt={normalizeTurkishText(product.name)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </Link>

                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {getProductTags(product).map((tag) => (
                      <span key={`${product.id}-${tag}`} className="bg-black text-white text-xs px-2 py-1 rounded">
                        {normalizeTurkishText(tag)}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => addToWishlist(product)}
                    className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isInWishlist(product.id)
                        ? 'bg-white text-black'
                        : 'bg-white/80 hover:bg-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => addToCart(product)}
                    className="absolute bottom-0 left-0 right-0 bg-black text-white py-3 text-sm font-medium translate-y-full group-hover:translate-y-0 transition-transform"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      {isInCart(product.id) ? 'Sepete Eklendi' : 'Sepete Ekle'}
                    </span>
                  </button>
                </div>

                <Link to={`/product/${product.id}`}>
                  <h3 className="text-sm md:text-base font-medium text-gray-900 mb-1 line-clamp-1">
                    {normalizeTurkishText(product.name)}
                  </h3>
                  <p className="text-sm text-gray-600">{product.price.toLocaleString('tr-TR')} TL</p>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
