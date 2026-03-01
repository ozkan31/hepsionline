import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { StoreProvider } from '@/store/StoreContext';
import { Header } from '@/components/Header';
import { Home } from '@/pages/Home';
import { Shop } from '@/pages/Shop';
import { Product } from '@/pages/Product';
import { Cart } from '@/pages/Cart';
import { Wishlist } from '@/pages/Wishlist';
import { Account } from '@/pages/Account';
import { Checkout } from '@/pages/Checkout';
import { Admin } from '@/pages/Admin';
import { About } from '@/pages/About';
import { Contact } from '@/pages/Contact';
import { Footer } from '@/components/Footer';
import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function HashRouteNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = location.hash ?? "";
    if (!hash.startsWith("#/")) return;

    const hashPath = hash.slice(1);
    if (hashPath === "/akalin1453") return;

    navigate(hashPath, { replace: true });
  }, [location.hash, navigate]);

  return null;
}

function AppLayout() {
  const { pathname, hash } = useLocation();
  const isHashAdminRoute = hash === "#/akalin1453";
  const isAdminRoute = pathname === "/akalin1453" || isHashAdminRoute;

  return (
    <div className="relative min-h-screen bg-[#F8F7F4]">
      {!isAdminRoute ? <Header /> : null}
      <main className="min-h-screen">
        {isHashAdminRoute ? (
          <Admin />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/sepet" element={<Cart />} />
            <Route path="/favoriler" element={<Wishlist />} />
            <Route path="/hesabim" element={<Account />} />
            <Route path="/odeme" element={<Checkout />} />
            <Route path="/odeme/basarili" element={<Checkout />} />
            <Route path="/odeme/basarisiz" element={<Checkout />} />
            <Route path="/akalin1453" element={<Admin />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/hakkimizda" element={<About />} />
            <Route path="/iletisim" element={<Contact />} />
            <Route path="/urunler" element={<Shop />} />
          </Routes>
        )}
      </main>
      {!isAdminRoute ? <Footer /> : null}
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <Router>
        <ScrollToTop />
        <HashRouteNormalizer />
        <AppLayout />
      </Router>
    </StoreProvider>
  );
}

export default App;
