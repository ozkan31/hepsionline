import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Heart, User, ShoppingBag, Menu, X } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { fetchPublicSettings } from '@/lib/api';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [siteName, setSiteName] = useState('Paris move');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const { state, cartCount } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!searchWrapRef.current?.contains(target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSearchOpen]);

  useEffect(() => {
    let mounted = true;
    fetchPublicSettings()
      .then((data) => {
        if (!mounted) return;
        const name = String(data?.siteName ?? '').trim();
        if (name) setSiteName(name);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { name: 'Ana Sayfa', path: '/' },
    { name: 'Ürünler', path: '/shop' },
    { name: 'Hakkımızda', path: '/about' },
    { name: 'İletişim', path: '/contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md py-3 shadow-sm'
            : 'bg-transparent py-4'
        }`}
      >
        <div className="w-full px-4 md:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2"
            >
              <Menu className="w-5 h-5" />
            </button>

            <a
              href="/"
              className="font-serif text-xl md:text-2xl font-medium tracking-tight absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0"
            >
              {siteName}
            </a>

            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                link.path === "/" ? (
                  <a
                    key={link.name}
                    href="/"
                    className={`text-sm tracking-wide transition-colors relative group ${
                      isActive(link.path) ? 'text-black font-medium' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {link.name}
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-black transition-all duration-300 group-hover:w-full" />
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`text-sm tracking-wide transition-colors relative group ${
                      isActive(link.path) ? 'text-black font-medium' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {link.name}
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-black transition-all duration-300 group-hover:w-full" />
                  </Link>
                )
              ))}
            </nav>

            <div className="flex items-center gap-2 md:gap-4">
              <div ref={searchWrapRef} className="relative flex items-center">
                <form
                  onSubmit={handleSearch}
                  className={`absolute right-11 top-1/2 -translate-y-1/2 overflow-hidden transition-all duration-300 ease-out z-10 ${
                    isSearchOpen ? 'w-56 sm:w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Ürün ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-full px-4 py-2 text-sm appearance-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:border-black"
                  />
                </form>
                <button
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors relative z-20"
                  aria-label="Ara"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>

              <Link
                to="/favoriler"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors relative hidden sm:block"
                aria-label="Favoriler"
              >
                <Heart className="w-5 h-5" />
                {state.wishlist.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                    {state.wishlist.length}
                  </span>
                )}
              </Link>

              <Link
                to="/hesabim"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors hidden sm:block"
                aria-label="Hesabım"
              >
                <User className="w-5 h-5" />
              </Link>

              <Link
                to="/sepet"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
                aria-label="Sepet"
              >
                <ShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-white">
          <div className="p-4">
            <div className="flex justify-between items-center mb-8">
              <span className="font-serif text-xl font-medium">{siteName}</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.path === "/" ? (
                  <a
                    key={link.name}
                    href="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg py-3 border-b border-gray-100"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg py-3 border-b border-gray-100"
                  >
                    {link.name}
                  </Link>
                )
              ))}
              <Link to="/favoriler" onClick={() => setIsMobileMenuOpen(false)} className="text-lg py-3 border-b border-gray-100">
                Favorilerim ({state.wishlist.length})
              </Link>
              <Link to="/sepet" onClick={() => setIsMobileMenuOpen(false)} className="text-lg py-3 border-b border-gray-100">
                Sepetim ({cartCount})
              </Link>
              <Link to="/hesabim" onClick={() => setIsMobileMenuOpen(false)} className="text-lg py-3 border-b border-gray-100">
                Hesabım
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
