import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { StoreProvider } from '@/store/StoreContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteSeo } from '@/components/RouteSeo';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';
import './App.css';

const Home = lazy(() => import('@/pages/Home').then((module) => ({ default: module.Home })));
const Shop = lazy(() => import('@/pages/Shop').then((module) => ({ default: module.Shop })));
const Product = lazy(() => import('@/pages/Product').then((module) => ({ default: module.Product })));
const Cart = lazy(() => import('@/pages/Cart').then((module) => ({ default: module.Cart })));
const Wishlist = lazy(() => import('@/pages/Wishlist').then((module) => ({ default: module.Wishlist })));
const Account = lazy(() => import('@/pages/Account').then((module) => ({ default: module.Account })));
const Checkout = lazy(() => import('@/pages/Checkout').then((module) => ({ default: module.Checkout })));
const Admin = lazy(() => import('@/pages/Admin').then((module) => ({ default: module.Admin })));
const About = lazy(() => import('@/pages/About').then((module) => ({ default: module.About })));
const Contact = lazy(() => import('@/pages/Contact').then((module) => ({ default: module.Contact })));
const CargoInfoPage = lazy(() => import('@/pages/InfoPages').then((module) => ({ default: module.CargoInfoPage })));
const FaqPage = lazy(() => import('@/pages/InfoPages').then((module) => ({ default: module.FaqPage })));
const DistanceSalesContractPage = lazy(() =>
  import('@/pages/InfoPages').then((module) => ({ default: module.DistanceSalesContractPage }))
);
const PrivacyPolicyPage = lazy(() => import('@/pages/InfoPages').then((module) => ({ default: module.PrivacyPolicyPage })));
const ReturnPolicyPage = lazy(() => import('@/pages/InfoPages').then((module) => ({ default: module.ReturnPolicyPage })));
const SustainabilityPage = lazy(() => import('@/pages/InfoPages').then((module) => ({ default: module.SustainabilityPage })));
const TermsPage = lazy(() => import('@/pages/InfoPages').then((module) => ({ default: module.TermsPage })));
const HelpCenterPage = lazy(() => import('@/pages/SupportPages').then((module) => ({ default: module.HelpCenterPage })));
const NotFoundPage = lazy(() => import('@/pages/SupportPages').then((module) => ({ default: module.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
      {'Sayfa y\u00fckleniyor...'}
    </div>
  );
}

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

function ProductQueryNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const productId = String(params.get("product") ?? "").trim();
    if (!productId) return;

    const nextParams = new URLSearchParams(location.search);
    nextParams.delete("product");
    const remainingQuery = nextParams.toString();
    navigate(
      `/product/${encodeURIComponent(productId)}${remainingQuery ? `?${remainingQuery}` : ""}`,
      { replace: true }
    );
  }, [location.search, navigate]);

  return null;
}

function AppLayout() {
  const { pathname, hash } = useLocation();
  const isHashAdminRoute = hash === "#/akalin1453";
  const isAdminRoute = pathname === "/akalin1453" || isHashAdminRoute;

  return (
    <div className="relative min-h-screen bg-[#F8F7F4] overflow-x-hidden">
      {!isAdminRoute ? <RouteSeo /> : null}
      {!isAdminRoute ? <Header /> : null}
      <main className="min-h-screen">
        <Suspense fallback={<RouteFallback />}>
          {isHashAdminRoute ? (
            <Admin />
          ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/kategori/:categorySlug" element={<Shop />} />
              <Route path="/product/:id" element={<Product />} />
              <Route path="/sepet" element={<Cart />} />
              <Route path="/favoriler" element={<Wishlist />} />
              <Route path="/giris" element={<Account />} />
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
              <Route path="/kargo" element={<CargoInfoPage />} />
              <Route path="/iade" element={<ReturnPolicyPage />} />
              <Route path="/mesafeli-satis-sozlesmesi" element={<DistanceSalesContractPage />} />
              <Route path="/sss" element={<FaqPage />} />
              <Route path="/surdurulebilirlik" element={<SustainabilityPage />} />
              <Route path="/gizlilik" element={<PrivacyPolicyPage />} />
              <Route path="/kullanim-kosullari" element={<TermsPage />} />
              <Route path="/yardim-merkezi" element={<HelpCenterPage />} />
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          )}
        </Suspense>
      </main>
      {!isAdminRoute ? <Footer /> : null}
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <Router>
        <AnalyticsTracker />
        <ScrollToTop />
        <HashRouteNormalizer />
        <ProductQueryNormalizer />
        <AppLayout />
      </Router>
    </StoreProvider>
  );
}

export default App;


