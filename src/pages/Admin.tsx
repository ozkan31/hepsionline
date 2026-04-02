import {
  Boxes,
  ChevronDown,
  LayoutDashboard,
  List,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createAdminProduct,
  adminLogin,
  adminLogout,
  createAdminCoupon,
  createAdminOrderNavlungoShipment,
  deleteAdminCoupon,
  deleteAdminProduct,
  fetchAdminAbandonedCartCampaign,
  fetchAdminContactRequests,
  fetchAdminCoupons,
  fetchAdminProductById,
  fetchAdminGoogleMerchantStatus,
  fetchAdminSettings,
  fetchAdminTrendyolOrders,
  fetchAdminTrendyolStatus,
  fetchAdminUsers,
  adminValidate,
  fetchAdminOrders,
  fetchAdminProducts,
  updateAdminSettings,
  syncAdminGoogleMerchant,
  updateAdminAbandonedCartCampaign,
  updateAdminCoupon,
  updateAdminProduct,
  uploadAdminProductImages,
  runAdminAbandonedCartCampaign,
} from "@/lib/api";
import { sanitizeExternalUrl } from "@/lib/safeLinks";
import type {
  AdminAbandonedCartSettings,
  AdminContactRequest,
  AdminCustomerCouponSettings,
  AdminOrder,
  AdminTrendyolOrder,
  AdminTrendyolStatus,
  AdminUserSummary,
  Product,
} from "@/types";

const ADMIN_TOKEN_KEY = "parisMoveAdminToken";
const ADMIN_REMEMBER_KEY = "parisMoveAdminRemember";
type AdminSection = "overview" | "orders" | "products" | "users" | "contactRequests" | "marketing" | "campaigns" | "trendyol" | "settings";
type ProductEditorDraft = {
  id: string;
  name: string;
  price: string;
  stock: string;
  barcode: string;
  images: Array<{ id: string; url: string; isLocal: boolean }>;
  category: string;
  description: string;
  features: string[];
  colors: string[];
  tags: string[];
  isNew: boolean;
  isBestseller: boolean;
};
type ProductPanel = "list" | "create" | "stock";
type MarketingPanel = "abandonedCart" | "coupons";
type CampaignsPanel = "createCoupon" | "existingCoupons";
const MAX_PRODUCT_IMAGES = 15;
const defaultMarketingSettings: AdminAbandonedCartSettings = {
  enabled: false,
  delayMinutes: 120,
  subject: "Sepetiniz sizi bekliyor",
  heading: "Sepetinizde bıraktığınız ürünler sizi bekliyor",
  body:
    "Seçtiğiniz ürünler hâlâ sepetinizde duruyor. Tükenmeden alışverişinizi tamamlamak için sepete geri dönebilirsiniz.",
  ctaLabel: "Sepetime Dön",
  couponEnabled: false,
  couponCode: "",
  couponType: "percentage",
  couponValue: 10,
  couponMinimumSubtotal: 750,
  couponDescription: "Sepetinize özel indirim kodunuz hazır.",
};
const defaultCustomerCouponSettings: AdminCustomerCouponSettings = {
  enabled: false,
  code: "",
  type: "percentage",
  value: 10,
  minimumSubtotal: 750,
  description: "Müşterilerinize özel indirim kodunuz hazır.",
  singleUsePerCustomer: true,
  startsAt: "",
  expiresAt: "",
  usageCount: 0,
};

function sortAdminCoupons(coupons: AdminCustomerCouponSettings[]) {
  return [...coupons].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || "");
    const bTime = Date.parse(b.updatedAt || b.createdAt || "");
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function generateAdminCouponCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomChunk = (length: number) =>
    Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `STIL-${randomChunk(4)}-${randomChunk(4)}`;
}

function toDateTimeLocalInput(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16);
}

function normalizeAdminCouponDraft(
  coupon?: Partial<AdminCustomerCouponSettings> | null
): AdminCustomerCouponSettings {
  return {
    ...defaultCustomerCouponSettings,
    ...(coupon ?? {}),
    singleUsePerCustomer:
      coupon?.singleUsePerCustomer == null ? true : Boolean(coupon.singleUsePerCustomer),
    startsAt: toDateTimeLocalInput(coupon?.startsAt),
    expiresAt: toDateTimeLocalInput(coupon?.expiresAt),
    usageCount: Math.max(0, Number(coupon?.usageCount || 0)),
  };
}

function getStoredAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function getStoredAdminRememberPreference() {
  const stored = localStorage.getItem(ADMIN_REMEMBER_KEY);
  return stored === null ? true : stored === "1";
}

function setStoredAdminToken(token: string, rememberMe: boolean) {
  localStorage.setItem(ADMIN_REMEMBER_KEY, rememberMe ? "1" : "0");
  if (rememberMe) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }

  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function clearStoredAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function Admin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => getStoredAdminRememberPreference());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [navlungoShipmentSavingByOrderId, setNavlungoShipmentSavingByOrderId] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productsMessage, setProductsMessage] = useState("");
  const [isProductsMenuOpen, setIsProductsMenuOpen] = useState(false);
  const [activeProductPanel, setActiveProductPanel] = useState<ProductPanel>("list");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productEditor, setProductEditor] = useState<ProductEditorDraft | null>(null);
  const imagePickerRef = useRef<HTMLInputElement | null>(null);
  const [newFeatureName, setNewFeatureName] = useState("");
  const [newColorName, setNewColorName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productSaveMessage, setProductSaveMessage] = useState("");
  const [siteNameInput, setSiteNameInput] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [marketingSettings, setMarketingSettings] = useState<AdminAbandonedCartSettings>(defaultMarketingSettings);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingMessage, setMarketingMessage] = useState("");
  const [customerCouponSettings, setCustomerCouponSettings] =
    useState<AdminCustomerCouponSettings>(() => normalizeAdminCouponDraft(defaultCustomerCouponSettings));
  const [customerCoupons, setCustomerCoupons] = useState<AdminCustomerCouponSettings[]>([]);
  const [customerCouponsLoading, setCustomerCouponsLoading] = useState(false);
  const [customerCouponMessage, setCustomerCouponMessage] = useState("");
  const [isMarketingMenuOpen, setIsMarketingMenuOpen] = useState(false);
  const [isCampaignsMenuOpen, setIsCampaignsMenuOpen] = useState(false);
  const [activeMarketingPanel, setActiveMarketingPanel] = useState<MarketingPanel>("abandonedCart");
  const [activeCampaignsPanel, setActiveCampaignsPanel] = useState<CampaignsPanel>("createCoupon");
  const [marketingStats, setMarketingStats] = useState<{
    eligibleUsers: number;
    sentLast7Days: number;
    lastSentAt: string | null;
    mailConfigured: boolean;
  } | null>(null);
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);
  const [isSavingCustomerCoupon, setIsSavingCustomerCoupon] = useState(false);
  const [isRunningMarketing, setIsRunningMarketing] = useState(false);
  const [merchantStatus, setMerchantStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    accountId: string;
    targetCountry: string;
    contentLanguage: string;
    currency: string;
    brand: string;
  } | null>(null);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [merchantSyncing, setMerchantSyncing] = useState(false);
  const [merchantMessage, setMerchantMessage] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [contactRequests, setContactRequests] = useState<AdminContactRequest[]>([]);
  const [contactRequestsLoading, setContactRequestsLoading] = useState(false);
  const [contactRequestsError, setContactRequestsError] = useState("");
  const [trendyolStatus, setTrendyolStatus] = useState<AdminTrendyolStatus | null>(null);
  const [trendyolOrders, setTrendyolOrders] = useState<AdminTrendyolOrder[]>([]);
  const [trendyolLoading, setTrendyolLoading] = useState(false);
  const [trendyolError, setTrendyolError] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeCustomerCoupons = customerCoupons.filter((coupon) => coupon.enabled);
  const latestCustomerCoupon = customerCoupons[0] ?? null;
  const todayOrderCount = orders.filter((order) => {
    const parsedDate = new Date(String(order.date ?? "").replace(" ", "T"));
    if (Number.isNaN(parsedDate.getTime())) return false;
    const now = new Date();
    return (
      parsedDate.getFullYear() === now.getFullYear() &&
      parsedDate.getMonth() === now.getMonth() &&
      parsedDate.getDate() === now.getDate()
    );
  }).length;
  const processingOrderCount = orders.filter((order) => order.status === "processing").length;
  const shippedOrderCount = orders.filter((order) => order.status === "shipped").length;
  const deliveredOrderCount = orders.filter((order) => order.status === "delivered").length;

  const resetCustomerCouponDraft = () => {
    setCustomerCouponSettings(normalizeAdminCouponDraft(defaultCustomerCouponSettings));
    setCustomerCouponMessage("");
  };

  useEffect(() => {
    const check = async () => {
      const token = getStoredAdminToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await adminValidate(token);
        setIsAuthenticated(true);
      } catch {
        clearStoredAdminToken();
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || (activeSection !== "overview" && activeSection !== "orders")) return;
    const token = getStoredAdminToken();
    if (!token) return;

    let mounted = true;
    const loadOrders = async () => {
      if (mounted) {
        setOrdersLoading(true);
        setOrdersError("");
      }
      try {
        const data = await fetchAdminOrders(token);
        if (!mounted) return;
        setOrders(data);
      } catch (err) {
        if (!mounted) return;
        setOrdersError(err instanceof Error ? err.message : "Siparişler alınamadı.");
      } finally {
        if (mounted) {
          setOrdersLoading(false);
        }
      }
    };

    const handleFocus = () => {
      void loadOrders();
    };

    void loadOrders();
    const interval = window.setInterval(() => {
      void loadOrders();
    }, 10000);
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "products") return;
    const token = getStoredAdminToken();
    if (!token) return;

    let mounted = true;
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError("");
      setProducts([]);
      try {
        let hasMore = true;
        let offset = 0;
        const limit = 24;

        while (hasMore && mounted) {
          const data = await fetchAdminProducts(token, { limit, offset });
          const chunk = Array.isArray(data.products) ? data.products : [];

          for (const item of chunk) {
            if (!mounted) break;
            setProducts((prev) => [...prev, item]);
            // Render products progressively instead of all at once.
            await new Promise((resolve) => window.setTimeout(resolve, 25));
          }

          hasMore = Boolean(data.hasMore);
          offset =
            typeof data.nextOffset === "number" && Number.isFinite(data.nextOffset)
              ? data.nextOffset
              : offset + chunk.length;
        }
      } catch (err) {
        if (!mounted) return;
        setProductsError(err instanceof Error ? err.message : "Ürünler alınamadı.");
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };

    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "settings") return;
    const token = getStoredAdminToken();
    if (!token) return;

    let mounted = true;
    const loadSettings = async () => {
      setSettingsLoading(true);
      setSettingsMessage("");
      setMerchantLoading(true);
      setMerchantMessage("");
      try {
        const [data, merchant] = await Promise.all([
          fetchAdminSettings(token),
          fetchAdminGoogleMerchantStatus(token),
        ]);
        if (!mounted) return;
        setSiteNameInput(String(data?.siteName ?? ""));
        setMerchantStatus(merchant);
      } catch (err) {
        if (!mounted) return;
        setSettingsMessage(err instanceof Error ? err.message : "Ayarlar alınamadı.");
      } finally {
        if (mounted) {
          setSettingsLoading(false);
          setMerchantLoading(false);
        }
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "users") return;
    const token = getStoredAdminToken();
    if (!token) return;

    let mounted = true;
    const loadUsers = async () => {
      if (mounted) {
        setUsersLoading(true);
        setUsersError("");
      }
      try {
        const data = await fetchAdminUsers(token);
        if (!mounted) return;
        setUsers(data);
      } catch (err) {
        if (!mounted) return;
        setUsersError(err instanceof Error ? err.message : "Kullanıcılar alınamadı.");
      } finally {
        if (mounted) setUsersLoading(false);
      }
    };

    const handleFocus = () => {
      void loadUsers();
    };

    void loadUsers();
    const interval = window.setInterval(() => {
      void loadUsers();
    }, 10000);
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "contactRequests") return;
    const token = getStoredAdminToken();
    if (!token) return;

    const loadContactRequests = async () => {
      setContactRequestsLoading(true);
      setContactRequestsError("");
      try {
        const data = await fetchAdminContactRequests(token);
        setContactRequests(data);
      } catch (err) {
        setContactRequestsError(err instanceof Error ? err.message : "İletişim talepleri alınamadı.");
      } finally {
        setContactRequestsLoading(false);
      }
    };

    loadContactRequests();
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "marketing") return;
    const token = getStoredAdminToken();
    if (!token) return;

    let mounted = true;
    const loadMarketing = async () => {
      setMarketingLoading(true);
      setMarketingMessage("");
      try {
        const abandonedCartData = await fetchAdminAbandonedCartCampaign(token);
        if (!mounted) return;
        setMarketingSettings(abandonedCartData.settings);
        setMarketingStats(abandonedCartData.stats);
      } catch (err) {
        if (!mounted) return;
        setMarketingMessage(err instanceof Error ? err.message : "Pazarlama ayarları alınamadı.");
      } finally {
        if (mounted) setMarketingLoading(false);
      }
    };

    void loadMarketing();
    return () => {
      mounted = false;
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "trendyol") return;
    const token = getStoredAdminToken();
    if (!token) return;

    let cancelled = false;
    setTrendyolLoading(true);
    setTrendyolError("");

    Promise.all([fetchAdminTrendyolStatus(token), fetchAdminTrendyolOrders(token)])
      .then(([statusData, ordersData]) => {
        if (cancelled) return;
        setTrendyolStatus(statusData);
        setTrendyolOrders(ordersData);
      })
      .catch((err) => {
        if (cancelled) return;
        setTrendyolError(err instanceof Error ? err.message : "Trendyol verileri yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) {
          setTrendyolLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || (activeSection !== "marketing" && activeSection !== "campaigns")) return;
    const token = getStoredAdminToken();
    if (!token) return;

    let mounted = true;
    const loadCoupons = async () => {
      setCustomerCouponsLoading(true);
      setCustomerCouponMessage("");
      try {
        const coupons = sortAdminCoupons(await fetchAdminCoupons(token));
        if (!mounted) return;
        setCustomerCoupons(coupons);
        setCustomerCouponSettings((prev) => {
          if (!prev.id) {
            return prev;
          }
          const matchedCoupon = coupons.find((coupon) => coupon.id === prev.id);
          return matchedCoupon
            ? normalizeAdminCouponDraft(matchedCoupon)
            : normalizeAdminCouponDraft(defaultCustomerCouponSettings);
        });
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Kuponlar alınamadı.";
        if (activeSection === "marketing") {
          setMarketingMessage(message);
        } else {
          setCustomerCouponMessage(message);
        }
      } finally {
        if (mounted) setCustomerCouponsLoading(false);
      }
    };

    void loadCoupons();
    return () => {
      mounted = false;
    };
  }, [activeSection, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const token = await adminLogin({ email, password, rememberMe });
      setStoredAdminToken(token, rememberMe);
      setIsAuthenticated(true);
      setActiveSection("overview");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (productEditor) {
      clearLocalImagePreviews(productEditor.images);
    }
    const token = getStoredAdminToken();
    if (token) {
      void adminLogout(token).catch(() => undefined);
    }
    clearStoredAdminToken();
    setIsAuthenticated(false);
    setActiveSection("overview");
    setOrders([]);
    setExpandedOrderId(null);
    setNavlungoShipmentSavingByOrderId({});
    setProducts([]);
    setProductsError("");
    setProductsMessage("");
    setIsProductsMenuOpen(false);
    setActiveProductPanel("list");
    setEditingProductId(null);
    setProductEditor(null);
    setIsSavingProduct(false);
    setProductSaveMessage("");
    setSiteNameInput("");
    setSettingsLoading(false);
    setSettingsMessage("");
    setIsSavingSettings(false);
    setMarketingSettings(defaultMarketingSettings);
    setMarketingLoading(false);
    setMarketingMessage("");
    setCustomerCouponSettings(normalizeAdminCouponDraft(defaultCustomerCouponSettings));
    setCustomerCoupons([]);
    setCustomerCouponsLoading(false);
    setCustomerCouponMessage("");
    setIsMarketingMenuOpen(false);
    setIsCampaignsMenuOpen(false);
    setActiveMarketingPanel("abandonedCart");
    setMarketingStats(null);
    setIsSavingMarketing(false);
    setIsSavingCustomerCoupon(false);
    setIsRunningMarketing(false);
    setMerchantStatus(null);
    setMerchantLoading(false);
    setMerchantSyncing(false);
    setMerchantMessage("");
    setUsers([]);
    setUsersLoading(false);
    setUsersError("");
    setContactRequests([]);
    setContactRequestsLoading(false);
    setContactRequestsError("");
    setTrendyolStatus(null);
    setTrendyolOrders([]);
    setTrendyolLoading(false);
    setTrendyolError("");
    setIsMobileNavOpen(false);
  };

  const handleSectionChange = (section: AdminSection) => {
    setActiveSection(section);
    if (section !== "products") {
      setIsProductsMenuOpen(false);
    }
    if (section !== "marketing") {
      setIsMarketingMenuOpen(false);
    }
    if (section !== "campaigns") {
      setIsCampaignsMenuOpen(false);
    }
    setIsMobileNavOpen(false);
  };

  const handleProductsMenuToggle = () => {
    setIsProductsMenuOpen((prev) => !prev);
  };

  const handleMarketingMenuToggle = () => {
    setIsMarketingMenuOpen((prev) => !prev);
  };

  const handleCampaignsMenuToggle = () => {
    setIsCampaignsMenuOpen((prev) => !prev);
  };

  const handleOpenAbandonedCartMarketing = () => {
    setActiveSection("marketing");
    setActiveMarketingPanel("abandonedCart");
    setIsMarketingMenuOpen(true);
    setIsCampaignsMenuOpen(false);
    setIsMobileNavOpen(false);
  };

  const handleOpenCouponsMarketing = () => {
    setActiveSection("marketing");
    setActiveMarketingPanel("coupons");
    setIsMarketingMenuOpen(true);
    setIsCampaignsMenuOpen(false);
    setIsMobileNavOpen(false);
  };

  const handleOpenCouponCreateCampaigns = () => {
    resetCustomerCouponDraft();
    setActiveSection("campaigns");
    setActiveCampaignsPanel("createCoupon");
    setIsMarketingMenuOpen(false);
    setIsCampaignsMenuOpen(true);
    setIsMobileNavOpen(false);
  };

  const handleOpenExistingCouponsCampaigns = () => {
    setCustomerCouponMessage("");
    setActiveSection("campaigns");
    setActiveCampaignsPanel("existingCoupons");
    setIsMarketingMenuOpen(false);
    setIsCampaignsMenuOpen(true);
    setIsMobileNavOpen(false);
  };

  const handleEditCoupon = (coupon: AdminCustomerCouponSettings) => {
    setCustomerCouponSettings(normalizeAdminCouponDraft(coupon));
    setCustomerCouponMessage("");
    setActiveSection("campaigns");
    setActiveCampaignsPanel("createCoupon");
    setIsMarketingMenuOpen(false);
    setIsCampaignsMenuOpen(true);
    setIsMobileNavOpen(false);
  };

  const handleGenerateCouponCode = () => {
    setCustomerCouponSettings((prev) => ({
      ...prev,
      enabled: true,
      code: generateAdminCouponCode(),
    }));
    setCustomerCouponMessage("Kupon kodu oluşturuldu. Kaydetmeyi unutmayın.");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredAdminToken();
    if (!token) return;
    const normalized = siteNameInput.trim();
    if (!normalized) {
      setSettingsMessage("Site ismi zorunludur.");
      return;
    }

    setIsSavingSettings(true);
    setSettingsMessage("");
    try {
      const updated = await updateAdminSettings(token, { siteName: normalized });
      setSiteNameInput(updated.siteName);
      setSettingsMessage("Site ismi güncellendi.");
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "Ayarlar kaydedilemedi.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveMarketingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredAdminToken();
    if (!token) return;

    setIsSavingMarketing(true);
    setMarketingMessage("");
    try {
      const data = await updateAdminAbandonedCartCampaign(token, marketingSettings);
      setMarketingSettings(data.settings);
      setMarketingStats(data.stats);
      setMarketingMessage("Sepeti terk eden müşteriler kampanyası kaydedildi.");
    } catch (err) {
      setMarketingMessage(err instanceof Error ? err.message : "Pazarlama ayarları kaydedilemedi.");
    } finally {
      setIsSavingMarketing(false);
    }
  };

  const handleSaveCustomerCouponSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredAdminToken();
    if (!token) return;

    setIsSavingCustomerCoupon(true);
    setCustomerCouponMessage("");
    try {
      const savingExistingCoupon = Boolean(customerCouponSettings.id);
      const savedCoupon = savingExistingCoupon
        ? await updateAdminCoupon(token, String(customerCouponSettings.id), customerCouponSettings)
        : await createAdminCoupon(token, customerCouponSettings);

      setCustomerCoupons((prev) => {
        const filteredCoupons = prev.filter((coupon) => coupon.id !== savedCoupon.id);
        return sortAdminCoupons([savedCoupon, ...filteredCoupons]);
      });
      setCustomerCouponSettings(normalizeAdminCouponDraft(savedCoupon));
      setCustomerCouponMessage(savingExistingCoupon ? "Kupon güncellendi." : "Kupon oluşturuldu.");
    } catch (err) {
      setCustomerCouponMessage(err instanceof Error ? err.message : "Kupon kaydedilemedi.");
    } finally {
      setIsSavingCustomerCoupon(false);
    }
  };

  const handleDeleteCoupon = async (coupon: AdminCustomerCouponSettings) => {
    if (!coupon.id) return;
    const confirmed = window.confirm(
      `${coupon.code || "Bu kuponu"} silmek istediğinize emin misiniz?`
    );
    if (!confirmed) return;

    const token = getStoredAdminToken();
    if (!token) return;

    setIsSavingCustomerCoupon(true);
    setCustomerCouponMessage("");
    try {
      await deleteAdminCoupon(token, coupon.id);
      setCustomerCoupons((prev) => prev.filter((item) => item.id !== coupon.id));
      setCustomerCouponSettings((prev) =>
        prev.id === coupon.id
          ? normalizeAdminCouponDraft(defaultCustomerCouponSettings)
          : prev
      );
      setCustomerCouponMessage("Kupon silindi.");
    } catch (err) {
      setCustomerCouponMessage(err instanceof Error ? err.message : "Kupon silinemedi.");
    } finally {
      setIsSavingCustomerCoupon(false);
    }
  };

  const handleRunMarketingCampaign = async () => {
    const token = getStoredAdminToken();
    if (!token) return;

    setIsRunningMarketing(true);
    setMarketingMessage("");
    try {
      const result = await runAdminAbandonedCartCampaign(token);
      setMarketingMessage(result.message);
      const refreshed = await fetchAdminAbandonedCartCampaign(token);
      setMarketingSettings(refreshed.settings);
      setMarketingStats(refreshed.stats);
    } catch (err) {
      setMarketingMessage(err instanceof Error ? err.message : "Kampanya çalıştırılamadı.");
    } finally {
      setIsRunningMarketing(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "created":
        return "Sipariş Alındı";
      case "delivered":
        return "Teslim Edildi";
      case "shipped":
        return "Kargoya Verildi";
      case "processing":
        return "Hazırlanıyor";
      default:
        return status;
    }
  };

  const formatOrderDateTime = (value: string) => {
    if (!value) return "-";
    const raw = String(value).trim();
    const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    const hasTime = normalized.includes("T");
    const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
    const candidate = hasExplicitTimezone
      ? normalized
      : hasTime
      ? normalized
      : `${normalized}T00:00:00`;
    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimelineEventTone = (type: string) => {
    switch (type) {
      case "delivered":
        return {
          dot: "bg-green-600 border-green-600",
          line: "bg-green-200",
          card: "border-green-200 bg-green-50/60",
        };
      case "shipped":
        return {
          dot: "bg-blue-600 border-blue-600",
          line: "bg-blue-200",
          card: "border-blue-200 bg-blue-50/60",
        };
      case "processing":
        return {
          dot: "bg-amber-500 border-amber-500",
          line: "bg-amber-200",
          card: "border-amber-200 bg-amber-50/60",
        };
      default:
        return {
          dot: "bg-black border-black",
          line: "bg-[#D7D1C3]",
          card: "border-[#E7E2D8] bg-white",
        };
    }
  };

  const getShipmentStatusText = (status?: string) => {
    switch (status) {
      case "created":
        return "Gönderi Oluşturuldu";
      case "failed":
        return "Gönderi Hatası";
      default:
        return "Beklemede";
    }
  };

  const getShipmentTone = (status?: string) => {
    switch (status) {
      case "created":
        return "border-green-200 bg-green-50";
      case "failed":
        return "border-red-200 bg-red-50";
      default:
        return "border-[#E7E2D8] bg-white";
    }
  };

  const clearLocalImagePreviews = (images: Array<{ url: string; isLocal: boolean }>) => {
    images.forEach((image) => {
      if (image.isLocal && image.url.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
    });
  };

  const handleCreateNavlungoShipment = async (orderId: string) => {
    const token = getStoredAdminToken();
    if (!token) return;

    setNavlungoShipmentSavingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    setOrdersError("");
    try {
      const response = await createAdminOrderNavlungoShipment(token, orderId);
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                shipment: response.shipment,
              }
            : order
        )
      );
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Navlungo gönderisi oluşturulamadı.");
    } finally {
      setNavlungoShipmentSavingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const openProductEditor = async (product: Product) => {
    const token = getStoredAdminToken();
    if (!token) return;
    setProductsMessage("");
    if (productEditor) {
      clearLocalImagePreviews(productEditor.images);
    }
    setIsCreatingProduct(false);
    setEditingProductId(product.id);
    setProductSaveMessage("Ürün detayları yükleniyor...");
    try {
      const detailed = await fetchAdminProductById(token, product.id);
      const normalizedFeatures = Array.isArray(detailed.features)
        ? detailed.features
        : detailed.features != null
        ? [String(detailed.features)]
        : [];
      const normalizedColors = Array.isArray(detailed.colors)
        ? detailed.colors
        : detailed.colors != null
        ? [String(detailed.colors)]
        : [];
      const existingImages = Array.isArray(detailed.images) && detailed.images.length > 0
        ? detailed.images
        : String(detailed.image ?? "").trim()
        ? [String(detailed.image ?? "").trim()]
        : [];
      setProductEditor({
        id: detailed.id,
        name: String(detailed.name ?? ""),
        price: String(detailed.price ?? ""),
        stock: detailed.stock == null ? "" : String(detailed.stock),
        barcode: String(detailed.barcode ?? ""),
        images: existingImages.map((url, index) => ({ id: `existing-${detailed.id}-${index}`, url, isLocal: false })),
        category: String(detailed.category ?? ""),
        description: String(detailed.description ?? ""),
        features: normalizedFeatures,
        colors: normalizedColors,
        tags: Array.isArray(detailed.tags) ? detailed.tags : [],
        isNew: Boolean(detailed.isNew),
        isBestseller: Boolean(detailed.isBestseller),
      });
      setNewFeatureName("");
      setNewColorName("");
      setNewTagName("");
      setProductSaveMessage("");
    } catch (error) {
      setProductSaveMessage(error instanceof Error ? error.message : "Ürün detayları alınamadı.");
    }
  };

  const handleSyncGoogleMerchant = async () => {
    const token = getStoredAdminToken();
    if (!token) return;
    setMerchantSyncing(true);
    setMerchantMessage("");
    try {
      const result = await syncAdminGoogleMerchant(token);
      setMerchantMessage(
        result?.message ||
          `Google Merchant senkron tamamlandı. Başarılı: ${result.success}, Silinen: ${result.deleted}, Hatalı: ${result.failed}`
      );
    } catch (err) {
      setMerchantMessage(err instanceof Error ? err.message : "Google Merchant senkronu başarısız.");
    } finally {
      setMerchantSyncing(false);
    }
  };

  const openCreateProductEditor = () => {
    if (productEditor) {
      clearLocalImagePreviews(productEditor.images);
    }
    setIsCreatingProduct(true);
    setEditingProductId(null);
    setProductEditor({
      id: "",
      name: "",
      price: "",
      stock: "",
      barcode: "",
      images: [],
      category: "",
      description: "",
      features: [],
      colors: [],
      tags: [],
      isNew: false,
      isBestseller: false,
    });
    setNewFeatureName("");
    setNewColorName("");
    setNewTagName("");
    setProductSaveMessage("");
  };

  const closeProductEditor = () => {
    if (productEditor) {
      clearLocalImagePreviews(productEditor.images);
    }
    setEditingProductId(null);
    setIsCreatingProduct(false);
    setProductEditor(null);
    setNewFeatureName("");
    setNewColorName("");
    setNewTagName("");
    setProductSaveMessage("");
  };

  const handleOpenProductList = () => {
    closeProductEditor();
    setActiveSection("products");
    setActiveProductPanel("list");
    setIsProductsMenuOpen(true);
    setIsMobileNavOpen(false);
  };

  const handleOpenCreateProduct = () => {
    setProductsMessage("");
    setActiveSection("products");
    setActiveProductPanel("create");
    setIsProductsMenuOpen(true);
    setIsMobileNavOpen(false);
    openCreateProductEditor();
  };

  const handleOpenStockManagement = () => {
    closeProductEditor();
    setProductsMessage("");
    setActiveSection("products");
    setActiveProductPanel("stock");
    setIsProductsMenuOpen(true);
    setIsMobileNavOpen(false);
  };

  const handlePickImages = () => {
    imagePickerRef.current?.click();
  };

  const handleImageFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    // Reset immediately so picking same file again still triggers onChange.
    input.value = "";
    if (!productEditor || files.length === 0) return;

    const remaining = Math.max(0, MAX_PRODUCT_IMAGES - productEditor.images.length);
    if (remaining === 0) {
      setProductSaveMessage(`En fazla ${MAX_PRODUCT_IMAGES} görsel ekleyebilirsiniz.`);
      return;
    }

    const accepted = files
      .filter((file) => {
        if (file.type.startsWith("image/")) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)$/i.test(file.name);
      })
      .slice(0, remaining);
    if (accepted.length === 0) {
      setProductSaveMessage("Lütfen geçerli bir görsel dosyası seçin.");
      return;
    }
    const token = getStoredAdminToken();
    if (!token) {
      setProductSaveMessage("Admin oturumu bulunamadı.");
      return;
    }

    setProductSaveMessage("Görseller yükleniyor...");
    try {
      const uploadedUrls = await uploadAdminProductImages(token, accepted);
      const selected = uploadedUrls.map((url, index) => ({
        id: `uploaded-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        url,
        isLocal: false,
      }));
      setProductEditor((prev) => (prev ? { ...prev, images: [...prev.images, ...selected] } : prev));
      if (files.length > remaining) {
        setProductSaveMessage(`En fazla ${MAX_PRODUCT_IMAGES} görsel ekleyebilirsiniz.`);
      } else {
        setProductSaveMessage("");
      }
    } catch (error) {
      setProductSaveMessage(error instanceof Error ? error.message : "Görseller yüklenemedi.");
    }
  };

  const handleRemoveImage = (imageId: string) => {
    setProductEditor((prev) => {
      if (!prev) return prev;
      const imageToRemove = prev.images.find((img) => img.id === imageId);
      if (imageToRemove?.isLocal && imageToRemove.url.startsWith("blob:")) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return { ...prev, images: prev.images.filter((img) => img.id !== imageId) };
    });
  };

  const handleImageDragStart = (
    imageId: string,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    setDraggingImageId(imageId);
    // Use the whole card as drag preview so the full box appears while dragging.
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", imageId);
    e.dataTransfer.setDragImage(e.currentTarget, e.currentTarget.clientWidth / 2, e.currentTarget.clientHeight / 2);
  };

  const handleImageDrop = (targetImageId: string) => {
    if (!draggingImageId || draggingImageId === targetImageId) {
      setDraggingImageId(null);
      return;
    }

    setProductEditor((prev) => {
      if (!prev) return prev;
      const fromIndex = prev.images.findIndex((img) => img.id === draggingImageId);
      const toIndex = prev.images.findIndex((img) => img.id === targetImageId);
      if (fromIndex < 0 || toIndex < 0) return prev;

      const next = [...prev.images];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, images: next };
    });
    setDraggingImageId(null);
  };

  const handleImageDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    targetImageId: string
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (!draggingImageId || draggingImageId === targetImageId) return;

    setProductEditor((prev) => {
      if (!prev) return prev;
      const fromIndex = prev.images.findIndex((img) => img.id === draggingImageId);
      const toIndex = prev.images.findIndex((img) => img.id === targetImageId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;

      const next = [...prev.images];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, images: next };
    });
  };

  const handleImageTouchStart = (imageId: string) => {
    setDraggingImageId(imageId);
  };

  const handleImageTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!draggingImageId) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCard = element?.closest?.("[data-admin-image-id]") as HTMLElement | null;
    const targetImageId = targetCard?.dataset.adminImageId;
    if (!targetImageId || targetImageId === draggingImageId) return;

    setProductEditor((prev) => {
      if (!prev) return prev;
      const fromIndex = prev.images.findIndex((img) => img.id === draggingImageId);
      const toIndex = prev.images.findIndex((img) => img.id === targetImageId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      const next = [...prev.images];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, images: next };
    });
  };

  const handleImageTouchEnd = () => {
    setDraggingImageId(null);
  };

  const handleAddFeature = () => {
    if (!productEditor) return;
    const normalized = newFeatureName.trim();
    if (!normalized) return;

    setProductEditor((prev) => {
      if (!prev) return prev;
      if (prev.features.some((feature) => feature.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      return { ...prev, features: [...prev.features, normalized] };
    });
    setNewFeatureName("");
  };

  const handleRemoveFeature = (featureToRemove: string) => {
    setProductEditor((prev) =>
      prev ? { ...prev, features: prev.features.filter((feature) => feature !== featureToRemove) } : prev
    );
  };

  const handleAddColor = () => {
    if (!productEditor) return;
    const normalized = newColorName.trim();
    if (!normalized) return;

    setProductEditor((prev) => {
      if (!prev) return prev;
      if (prev.colors.some((color) => color.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      return { ...prev, colors: [...prev.colors, normalized] };
    });
    setNewColorName("");
  };

  const handleRemoveColor = (colorToRemove: string) => {
    setProductEditor((prev) =>
      prev ? { ...prev, colors: prev.colors.filter((color) => color !== colorToRemove) } : prev
    );
  };

  const handleAddTag = () => {
    if (!productEditor) return;
    const normalized = newTagName.trim();
    if (!normalized) return;

    setProductEditor((prev) => {
      if (!prev) return prev;
      if (prev.tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      return { ...prev, tags: [...prev.tags, normalized] };
    });
    setNewTagName("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProductEditor((prev) =>
      prev ? { ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) } : prev
    );
  };

  const handleSaveProduct = async () => {
    if (!productEditor) return;
    const token = getStoredAdminToken();
    if (!token) return;

    if (!productEditor.name.trim()) {
      setProductSaveMessage("Ürün ismi zorunlu.");
      return;
    }
    const primaryImage = productEditor.images.find((image) => image.url.trim().length > 0)?.url?.trim() ?? "";
    if (!primaryImage) {
      setProductSaveMessage("Kaydetmek için en az bir görsel zorunlu.");
      return;
    }
    const numericPrice = Number(productEditor.price);
    const normalizedStockInput = productEditor.stock.trim();
    const numericStock =
      normalizedStockInput.length > 0
        ? Number(normalizedStockInput.replace(/\s+/g, "").replace(",", "."))
        : null;
    const creatingProduct = isCreatingProduct;

    const features = productEditor.features.map((item) => item.trim()).filter((item) => item.length > 0);
    const colors = productEditor.colors.map((item) => item.trim()).filter((item) => item.length > 0);

    if (normalizedStockInput.length > 0 && (!Number.isFinite(numericStock) || Number(numericStock) < 0)) {
      setProductSaveMessage("Stok adedi 0 veya daha büyük bir sayı olmalıdır.");
      return;
    }

    setIsSavingProduct(true);
    setProductSaveMessage("");
    setProductsMessage("");
    try {
      const payload = {
        id: productEditor.id.trim() || undefined,
        name: productEditor.name.trim(),
        price: Number.isFinite(numericPrice) ? numericPrice : 0,
        stock: numericStock == null ? null : Math.trunc(Number(numericStock)),
        barcode: productEditor.barcode.trim(),
        image: primaryImage,
        images: productEditor.images.map((image) => image.url).filter((url) => url.trim().length > 0),
        category: productEditor.category.trim(),
        description: productEditor.description.trim(),
        features,
        colors,
        tags: productEditor.tags.map((item) => item.trim()).filter((item) => item.length > 0),
        isNew: productEditor.isNew,
        isBestseller: productEditor.isBestseller,
      };

      const updatedProduct = creatingProduct
        ? await createAdminProduct(token, payload)
        : await updateAdminProduct(token, productEditor.id, payload);

      if (creatingProduct) {
        setProducts((prev) => [updatedProduct, ...prev.filter((item) => item.id !== updatedProduct.id)]);
      } else {
        setProducts((prev) => prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
      }
      clearLocalImagePreviews(productEditor.images);
      if (creatingProduct) {
        setEditingProductId(null);
        setIsCreatingProduct(false);
        setProductEditor(null);
        setNewFeatureName("");
        setNewColorName("");
        setNewTagName("");
        setProductSaveMessage("");
        setProductsMessage("Ürün başarıyla eklendi.");
        setActiveProductPanel("list");
      } else {
        setProductEditor({
          id: updatedProduct.id,
          name: updatedProduct.name,
          price: String(updatedProduct.price),
          stock: updatedProduct.stock == null ? "" : String(updatedProduct.stock),
          barcode: String(updatedProduct.barcode ?? ""),
          images: (Array.isArray(updatedProduct.images) && updatedProduct.images.length > 0
            ? updatedProduct.images
            : updatedProduct.image
            ? [updatedProduct.image]
            : []
          ).map((url, index) => ({ id: `existing-${updatedProduct.id}-${index}`, url, isLocal: false })),
          category: updatedProduct.category,
          description: updatedProduct.description,
          features: updatedProduct.features ?? [],
          colors: updatedProduct.colors ?? [],
          tags: updatedProduct.tags ?? [],
          isNew: Boolean(updatedProduct.isNew),
          isBestseller: Boolean(updatedProduct.isBestseller),
        });
        setEditingProductId(updatedProduct.id);
        setIsCreatingProduct(false);
        setProductSaveMessage("Ürün başarıyla güncellendi.");
      }
    } catch (err) {
      setProductSaveMessage(
        err instanceof Error ? err.message : creatingProduct ? "Ürün eklenemedi." : "Ürün güncellenemedi."
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const token = getStoredAdminToken();
    if (!token) return;
    const confirmText = `"${product.name}" ürününü silmek istediğinize emin misiniz?`;
    if (!window.confirm(confirmText)) return;

    setProductsError("");
    try {
      await deleteAdminProduct(token, product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      setProductsMessage(`"${product.name}" ürünü silindi.`);
      if (editingProductId === product.id || (productEditor && productEditor.id === product.id)) {
        closeProductEditor();
      }
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : "Ürün silinemedi.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-24 pb-20 px-4 md:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg p-6 text-center text-gray-500">
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-24 pb-20 px-4 md:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg p-6 md:p-8">
          <h1 className="text-2xl font-light mb-6">Admin Giriş</h1>
          {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
            <div>
              <label className="block text-sm font-medium mb-2">E-posta</label>
              <input
                type="email"
                required
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Şifre</label>
              <input
                type="password"
                required
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <span>Bu cihazda beni hatırla</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-black text-white py-3 rounded-full text-sm disabled:opacity-50"
            >
              {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderProductEditorForm = (mode: "inline" | "modal") => {
    if (!productEditor) return null;

    const isInline = mode === "inline";
    const secondaryAction = isInline ? handleOpenProductList : closeProductEditor;
    const headerActionLabel = isInline ? "Listeye Dön" : "Kapat";
    const footerActionLabel = isInline ? "Vazgeç ve Listeye Dön" : "Vazgeç";

    return (
      <div className={isInline ? "border border-[#E7E2D8] rounded-lg bg-[#FAF9F6] p-4 md:p-6" : "w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[#E7E2D8] rounded-lg bg-[#FAF9F6] p-4 md:p-6"}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">{isCreatingProduct ? "Yeni Ürün Ekle" : "Ürün Düzenleme"}</h3>
          <button
            type="button"
            onClick={secondaryAction}
            className="text-sm border border-black px-3 py-1 rounded-full hover:bg-black hover:text-white transition-colors"
          >
            {headerActionLabel}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ürün ID</label>
            <input
              type="text"
              value={productEditor.id}
              readOnly={!isCreatingProduct}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, id: e.target.value } : prev))
              }
              placeholder={isCreatingProduct ? "Boş bırakılırsa otomatik üretilir" : ""}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${
                isCreatingProduct
                  ? "bg-white border-gray-300 outline-none focus:border-black"
                  : "bg-gray-100 border-gray-300"
              }`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategori</label>
            <input
              type="text"
              value={productEditor.category}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, category: e.target.value } : prev))
              }
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ürün Adı</label>
            <input
              type="text"
              value={productEditor.name}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, name: e.target.value } : prev))
              }
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fiyat (TL)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={productEditor.price}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) =>
                setProductEditor((prev) =>
                  prev ? { ...prev, price: e.target.value.replace(/[^\d]/g, "") } : prev
                )
              }
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stok Adedi</label>
            <input
              type="number"
              min={0}
              step={1}
              value={productEditor.stock}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) =>
                setProductEditor((prev) =>
                  prev ? { ...prev, stock: e.target.value.replace(/[^\d]/g, "") } : prev
                )
              }
              placeholder="Boş bırakılırsa stok takibi daha sonra eklenir"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Barkod</label>
            <input
              type="text"
              value={productEditor.barcode}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, barcode: e.target.value } : prev))
              }
              placeholder="Örn. 8691234567890"
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Ürün Görselleri</label>
            <input
              ref={imagePickerRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFilesSelected}
              className="hidden"
            />
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {productEditor.images.map((image) => (
                <div
                  key={image.id}
                  data-admin-image-id={image.id}
                  draggable
                  onDragStart={(e) => handleImageDragStart(image.id, e)}
                  onDragOver={(e) => handleImageDragOver(e, image.id)}
                  onDrop={() => handleImageDrop(image.id)}
                  onDragEnd={() => setDraggingImageId(null)}
                  onTouchStart={() => handleImageTouchStart(image.id)}
                  onTouchMove={handleImageTouchMove}
                  onTouchEnd={handleImageTouchEnd}
                  onTouchCancel={handleImageTouchEnd}
                  className={`relative aspect-square rounded-lg border overflow-hidden bg-white cursor-grab active:cursor-grabbing transition-all ${
                    draggingImageId === image.id
                      ? "border-transparent opacity-0 touch-none"
                      : "border-gray-300"
                  }`}
                >
                  <img src={image.url} alt="Ürün görseli" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-300 flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                    aria-label="Görseli sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {productEditor.images.length < MAX_PRODUCT_IMAGES && (
                <button
                  type="button"
                  onClick={handlePickImages}
                  className="aspect-square rounded-lg border border-dashed border-gray-400 bg-white flex items-center justify-center text-gray-500 hover:text-black hover:border-black transition-colors"
                  aria-label="Görsel ekle"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">En fazla {MAX_PRODUCT_IMAGES} görsel seçebilirsiniz.</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Açıklama</label>
            <textarea
              value={productEditor.description}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, description: e.target.value } : prev))
              }
              rows={3}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Özellikler</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFeatureName}
                  onChange={(e) => setNewFeatureName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                  placeholder="Özellik adı"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="border border-black text-black px-3 py-2 rounded-lg text-sm hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                >
                  Özellik Ekle
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {productEditor.features.length === 0 && (
                  <span className="text-xs text-gray-500">Henüz özellik eklenmedi.</span>
                )}
                {productEditor.features.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center justify-between gap-2 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm transition-colors hover:bg-black hover:text-white hover:border-black"
                  >
                    <span>{feature}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(feature)}
                      className="text-gray-500 hover:text-current"
                      aria-label={`${feature} özelliğini kaldır`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Renkler</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddColor();
                    }
                  }}
                  placeholder="Renk adı"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={handleAddColor}
                  className="border border-black text-black px-3 py-2 rounded-lg text-sm hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                >
                  Renk Ekle
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {productEditor.colors.length === 0 && (
                  <span className="text-xs text-gray-500">Henüz renk eklenmedi.</span>
                )}
                {productEditor.colors.map((color) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm transition-colors hover:bg-black hover:text-white hover:border-black"
                  >
                    {color}
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="text-gray-500 hover:text-black"
                      aria-label={`${color} rengini kaldır`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Etiketler</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Etiket adı (ör. Yeni, Çok Satan)"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="border border-black text-black px-3 py-2 rounded-lg text-sm hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                >
                  Etiket Ekle
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {productEditor.tags.length === 0 && (
                  <span className="text-xs text-gray-500">Henüz etiket eklenmedi.</span>
                )}
                {productEditor.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm transition-colors hover:bg-black hover:text-white hover:border-black"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-500 hover:text-current"
                      aria-label={`${tag} etiketini kaldır`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={productEditor.isNew}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, isNew: e.target.checked } : prev))
              }
            />
            Yeni Ürün
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={productEditor.isBestseller}
              onChange={(e) =>
                setProductEditor((prev) => (prev ? { ...prev, isBestseller: e.target.checked } : prev))
              }
            />
            Çok Satan
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          {isCreatingProduct
            ? "Yeni ürün bilgilerini girip Kaydet butonuna basın."
            : "Düzenleme alanında değişiklik yapıp Kaydet butonuna basın."}
        </p>
        {productSaveMessage && (
          <p
            className={`text-sm mt-3 ${
              productSaveMessage.includes("başarıyla") ? "text-green-700" : "text-red-600"
            }`}
          >
            {productSaveMessage}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveProduct}
            disabled={isSavingProduct}
            className="bg-black text-white px-5 py-2 rounded-full text-sm disabled:opacity-50"
          >
            {isSavingProduct ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={secondaryAction}
            className="text-sm border border-black px-4 py-2 rounded-full hover:bg-black hover:text-white transition-colors"
          >
            {footerActionLabel}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="min-h-screen md:pl-[240px]">
        <aside className="hidden md:block md:fixed md:inset-y-0 md:left-0 md:z-20 md:w-[240px] border-b md:border-b-0 md:border-r border-[#E7E2D8] bg-[#F8F7F4] p-4 md:p-6 overflow-y-auto">
          <h1 className="text-xl font-light mb-6">Admin Panel</h1>
          <nav className="space-y-2">
            <button
              onClick={() => handleSectionChange("overview")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "overview" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Genel Bakış
              </span>
            </button>
            <button
              onClick={() => handleSectionChange("orders")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "orders" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Siparişler
              </span>
            </button>
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleProductsMenuToggle}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-md text-sm transition-colors ${
                  activeSection === "products" || isProductsMenuOpen
                    ? "bg-black text-white"
                    : "text-black hover:bg-[#ECE7DC]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Ürünler
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isProductsMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ease-out ${
                  isProductsMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pl-4 pt-1 space-y-1">
                    <button
                      type="button"
                      onClick={handleOpenProductList}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "products" && activeProductPanel === "list"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "products" && activeProductPanel === "list" ? "bg-black" : "bg-transparent"
                        }`}
                      />
                      <List className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Ürün Listesi
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCreateProduct}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "products" && activeProductPanel === "create"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "products" && activeProductPanel === "create" ? "bg-black" : "bg-transparent"
                        }`}
                      />
                      <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Ürün Ekle
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenStockManagement}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "products" && activeProductPanel === "stock"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "products" && activeProductPanel === "stock" ? "bg-black" : "bg-transparent"
                        }`}
                      />
                      <Boxes className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Stok Yönetimi
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSectionChange("users")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "users" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4" />
                Kullanıcılar
              </span>
            </button>
            <button
              onClick={() => handleSectionChange("contactRequests")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "contactRequests" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Mail className="w-4 h-4" />
                İletişim Talepleri
              </span>
            </button>
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleMarketingMenuToggle}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-md text-sm transition-colors ${
                  activeSection === "marketing" || isMarketingMenuOpen
                    ? "bg-black text-white"
                    : "text-black hover:bg-[#ECE7DC]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Pazarlama
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isMarketingMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ease-out ${
                  isMarketingMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pl-4 pt-1 space-y-1">
                    <button
                      type="button"
                      onClick={handleOpenAbandonedCartMarketing}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "marketing" && activeMarketingPanel === "abandonedCart"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "marketing" && activeMarketingPanel === "abandonedCart"
                            ? "bg-black"
                            : "bg-transparent"
                        }`}
                      />
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Sepet Terk
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCouponsMarketing}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "marketing" && activeMarketingPanel === "coupons"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "marketing" && activeMarketingPanel === "coupons"
                            ? "bg-black"
                            : "bg-transparent"
                        }`}
                      />
                      <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Kuponlar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleCampaignsMenuToggle}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-md text-sm transition-colors ${
                  activeSection === "campaigns" || isCampaignsMenuOpen
                    ? "bg-black text-white"
                    : "text-black hover:bg-[#ECE7DC]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Kampanyalar
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isCampaignsMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-200 ease-out ${
                  isCampaignsMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pl-4 pt-1 space-y-1">
                    <button
                      type="button"
                      onClick={handleOpenCouponCreateCampaigns}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "campaigns" && activeCampaignsPanel === "createCoupon"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "campaigns" && activeCampaignsPanel === "createCoupon"
                            ? "bg-black"
                            : "bg-transparent"
                        }`}
                      />
                      <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Kupon Oluştur
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenExistingCouponsCampaigns}
                      className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "campaigns" && activeCampaignsPanel === "existingCoupons"
                          ? "bg-[#ECE7DC] text-black"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                          activeSection === "campaigns" && activeCampaignsPanel === "existingCoupons"
                            ? "bg-black"
                            : "bg-transparent"
                        }`}
                      />
                      <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                      Mevcut Kuponlar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleSectionChange("trendyol")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "trendyol" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Trendyol
              </span>
            </button>
            <button
              onClick={() => handleSectionChange("settings")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "settings" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Ayarlar
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 rounded-md text-sm border border-black text-black hover:bg-black hover:text-white transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Çıkış Yap
              </span>
            </button>
          </nav>
        </aside>

        <section className="min-h-screen p-6 md:p-8 bg-white">
          <div className="md:hidden mb-4">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex items-center justify-center w-10 h-10 border border-black rounded-md"
              aria-label="Admin menüsünü aç"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {isMobileNavOpen && (
            <div className="fixed inset-0 z-[130] bg-black/35 md:hidden">
              <div className="h-full w-[280px] bg-[#F8F7F4] border-r border-[#E7E2D8] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-xl font-light">Admin Panel</h1>
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="inline-flex items-center justify-center w-9 h-9 border border-black rounded-md"
                    aria-label="Admin menüsünü kapat"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-2">
                  <button
                    onClick={() => handleSectionChange("overview")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "overview" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      Genel Bakış
                    </span>
                  </button>
                  <button
                    onClick={() => handleSectionChange("orders")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "orders" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Siparişler
                    </span>
                  </button>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={handleProductsMenuToggle}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "products" || isProductsMenuOpen
                          ? "bg-black text-white"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Ürünler
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isProductsMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        isProductsMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="pl-4 pt-1 space-y-1">
                          <button
                            type="button"
                            onClick={handleOpenProductList}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "products" && activeProductPanel === "list"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "products" && activeProductPanel === "list"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <List className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Ürün Listesi
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenCreateProduct}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "products" && activeProductPanel === "create"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "products" && activeProductPanel === "create"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Ürün Ekle
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenStockManagement}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "products" && activeProductPanel === "stock"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "products" && activeProductPanel === "stock"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <Boxes className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Stok Yönetimi
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSectionChange("users")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "users" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Kullanıcılar
                    </span>
                  </button>
                  <button
                    onClick={() => handleSectionChange("contactRequests")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "contactRequests" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      İletişim Talepleri
                    </span>
                  </button>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={handleMarketingMenuToggle}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "marketing" || isMarketingMenuOpen
                          ? "bg-black text-white"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Megaphone className="w-4 h-4" />
                        Pazarlama
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isMarketingMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        isMarketingMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="pl-4 pt-1 space-y-1">
                          <button
                            type="button"
                            onClick={handleOpenAbandonedCartMarketing}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "marketing" && activeMarketingPanel === "abandonedCart"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "marketing" && activeMarketingPanel === "abandonedCart"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Sepet Terk
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenCouponsMarketing}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "marketing" && activeMarketingPanel === "coupons"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "marketing" && activeMarketingPanel === "coupons"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Kuponlar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={handleCampaignsMenuToggle}
                      className={`w-full flex items-center justify-between px-4 py-2 rounded-md text-sm transition-colors ${
                        activeSection === "campaigns" || isCampaignsMenuOpen
                          ? "bg-black text-white"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Kampanyalar
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isCampaignsMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-out ${
                        isCampaignsMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="pl-4 pt-1 space-y-1">
                          <button
                            type="button"
                            onClick={handleOpenCouponCreateCampaigns}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "campaigns" && activeCampaignsPanel === "createCoupon"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "campaigns" && activeCampaignsPanel === "createCoupon"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Kupon Oluştur
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenExistingCouponsCampaigns}
                            className={`relative w-full text-left pl-10 pr-4 py-2 rounded-md text-sm transition-colors ${
                              activeSection === "campaigns" && activeCampaignsPanel === "existingCoupons"
                                ? "bg-[#ECE7DC] text-black"
                                : "text-black hover:bg-[#ECE7DC]"
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full ${
                                activeSection === "campaigns" && activeCampaignsPanel === "existingCoupons"
                                  ? "bg-black"
                                  : "bg-transparent"
                              }`}
                            />
                            <Tag className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            Mevcut Kuponlar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSectionChange("trendyol")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "trendyol" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Trendyol
                    </span>
                  </button>
                  <button
                    onClick={() => handleSectionChange("settings")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "settings" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Ayarlar
                    </span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 rounded-md text-sm border border-black text-black hover:bg-black hover:text-white transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <LogOut className="w-4 h-4" />
                      Çıkış Yap
                    </span>
                  </button>
                </nav>
              </div>
            </div>
          )}
          {activeSection === "overview" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Genel Bakış</h2>
              <p className="text-sm text-gray-500 mb-5">
                Admin panelindeki temel sipariş görünümünü ve hızlı geçişleri burada görebilirsiniz.
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Toplam Sipariş</p>
                  <p className="mt-3 text-2xl font-medium text-black">
                    {ordersLoading ? "..." : orders.length.toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Bugünkü Sipariş</p>
                  <p className="mt-3 text-2xl font-medium text-black">
                    {ordersLoading ? "..." : todayOrderCount.toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Hazırlanan</p>
                  <p className="mt-3 text-2xl font-medium text-black">
                    {ordersLoading ? "..." : processingOrderCount.toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Kargodaki / Teslim</p>
                  <p className="mt-3 text-2xl font-medium text-black">
                    {ordersLoading
                      ? "..."
                      : `${shippedOrderCount.toLocaleString("tr-TR")} / ${deliveredOrderCount.toLocaleString("tr-TR")}`}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Son Siparişler</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        En son oluşan siparişleri buradan hızlıca takip edebilirsiniz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSectionChange("orders")}
                      className="rounded-full border border-black px-4 py-2 text-sm text-black transition-colors hover:bg-black hover:text-white"
                    >
                      Tüm Siparişler
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {ordersLoading ? (
                      <p className="text-sm text-gray-500">Siparişler yükleniyor...</p>
                    ) : orders.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Henüz sipariş yok. Örnek sipariş oluşturduysan sayfayı yenileyip tekrar bakabilirsin.
                      </p>
                    ) : (
                      orders.slice(0, 5).map((order) => (
                        <div
                          key={order.id}
                          className="rounded-xl border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-black">#{order.id}</p>
                              <p className="mt-1 text-xs text-gray-500">
                                {order.customer.firstName} {order.customer.lastName} • {formatOrderDateTime(order.date)}
                              </p>
                            </div>
                            <span className="text-sm text-gray-700">{getStatusText(order.status)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-5">
                  <h3 className="text-sm font-medium">Hızlı İşlemler</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    En sık kullanılan alanlara buradan tek tıkla geçebilirsin.
                  </p>
                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      onClick={() => handleSectionChange("orders")}
                      className="w-full rounded-full border border-black px-4 py-3 text-sm text-black transition-colors hover:bg-black hover:text-white"
                    >
                      Sipariş Yönetimine Git
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenProductList}
                      className="w-full rounded-full border border-[#D5CFC3] px-4 py-3 text-sm text-gray-700 transition-colors hover:border-black hover:text-black"
                    >
                      Ürün Listesini Aç
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCouponCreateCampaigns}
                      className="w-full rounded-full border border-[#D5CFC3] px-4 py-3 text-sm text-gray-700 transition-colors hover:border-black hover:text-black"
                    >
                      Yeni Kupon Oluştur
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSectionChange("settings")}
                      className="w-full rounded-full border border-[#D5CFC3] px-4 py-3 text-sm text-gray-700 transition-colors hover:border-black hover:text-black"
                    >
                      Ayarlara Git
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeSection === "orders" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Siparişler</h2>
              <p className="text-sm text-gray-500 mb-5">Veritabanındaki siparişler listeleniyor.</p>
              {ordersLoading && <p className="text-sm text-gray-500">Siparişler yükleniyor...</p>}
              {ordersError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{ordersError}</p>
              )}
              {!ordersLoading && !ordersError && orders.length === 0 && (
                <p className="text-sm text-gray-500">Henüz sipariş bulunmuyor.</p>
              )}

              <div className="space-y-3">
                {orders.map((order) => {
                  const firstItem = order.items[0];
                  const productName = firstItem?.product?.name ?? "Ürün adı yok";
                  const productImage = firstItem?.product?.image ?? "";
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <div key={order.id} className="border border-[#E7E2D8] rounded-lg overflow-hidden bg-white">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 rounded-md border border-[#E7E2D8] bg-white overflow-hidden shrink-0">
                            {productImage ? (
                              <img src={productImage} alt={productName} className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-500">Sipariş No: {order.id}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Tarih: {formatOrderDateTime(order.date)}
                            </p>
                            <p className="font-medium truncate">{productName}</p>
                            <p className="text-xs text-gray-500 mt-1">Durum: {getStatusText(order.status)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedOrderId((prev) => (prev === order.id ? null : order.id))}
                          className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                        >
                          Detay
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-[#E7E2D8] px-4 py-4 bg-[#FAF9F6]">
                          <h3 className="text-sm font-medium mb-3">Müşteri İletişim Bilgileri</h3>
                          <div className="text-sm text-gray-700 space-y-1">
                            <p>
                              Ad Soyad: {order.customer.firstName} {order.customer.lastName}
                            </p>
                            <p>E-posta: {order.customer.email}</p>
                            <p>Telefon: {order.customer.phone || "-"}</p>
                            <p>
                              Adres:{" "}
                              {order.customer.address
                                ? `${order.customer.address.street}, ${order.customer.address.neighborhood}, ${order.customer.address.district}/${order.customer.address.province}`
                                : "-"}
                            </p>
                            {order.status === "shipped" && order.shippingCompany && (
                              <p>Kargo Firması: {order.shippingCompany}</p>
                            )}
                            {order.status === "shipped" && order.shippingTrackingNo && (
                              <p>Takip No: {order.shippingTrackingNo}</p>
                            )}
                          </div>
                          <div className="mt-5">
                            <h3 className="text-sm font-medium mb-3">Navlungo Gönderisi</h3>
                            <div className={`rounded-xl border px-4 py-4 ${getShipmentTone(order.shipment?.status)}`}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1 text-sm text-gray-700">
                                  <p className="font-medium text-black">
                                    Durum: {getShipmentStatusText(order.shipment?.status)}
                                  </p>
                                  {order.shipment?.postNumber ? (
                                    <p>Gönderi No: {order.shipment.postNumber}</p>
                                  ) : null}
                                  {order.shipment?.carrierName ? (
                                    <p>Taşıyıcı: {order.shipment.carrierName}</p>
                                  ) : null}
                                  {order.shipment?.referenceId ? (
                                    <p>Referans: {order.shipment.referenceId}</p>
                                  ) : null}
                                  {order.shipment?.updatedAt ? (
                                    <p>Son Güncelleme: {formatOrderDateTime(order.shipment.updatedAt)}</p>
                                  ) : null}
                                  {order.shipment?.providerStatusName ? (
                                    <p>
                                      Navlungo Durumu: {order.shipment.providerStatusName}
                                      {typeof order.shipment.providerStatusCode === "number"
                                        ? ` (#${order.shipment.providerStatusCode})`
                                        : ""}
                                    </p>
                                  ) : null}
                                  {order.shipment?.errorMessage ? (
                                    <p className="text-red-600">{order.shipment.errorMessage}</p>
                                  ) : (
                                    <p className="text-gray-500">
                                      {order.shipment?.status === "created"
                                        ? "Navlungo gönderi kaydı başarıyla oluşturuldu."
                                        : "Sipariş için henüz Navlungo gönderisi oluşturulmadı."}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2 sm:items-end">
                                  {sanitizeExternalUrl(order.shipment?.trackingUrl) ? (
                                    <a
                                      href={sanitizeExternalUrl(order.shipment?.trackingUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                                    >
                                      Takip Linki
                                    </a>
                                  ) : null}
                                  {sanitizeExternalUrl(order.shipment?.barcodeUrl) ? (
                                    <a
                                      href={sanitizeExternalUrl(order.shipment?.barcodeUrl)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                                    >
                                      Barkod PDF
                                    </a>
                                  ) : null}
                                  {order.shipment?.status !== "created" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleCreateNavlungoShipment(order.id)}
                                      disabled={Boolean(navlungoShipmentSavingByOrderId[order.id])}
                                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                                    >
                                      {navlungoShipmentSavingByOrderId[order.id]
                                        ? "Oluşturuluyor..."
                                        : order.shipment?.status === "failed"
                                          ? "Tekrar Dene"
                                          : "Gönderi Oluştur"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-5">
                            <h3 className="text-sm font-medium mb-3">Sipariş Zaman Çizelgesi</h3>
                            <div className="space-y-4">
                              {order.timeline.map((event, index) => {
                                const tone = getTimelineEventTone(event.type);
                                return (
                                  <div key={event.id || `${order.id}-${event.type}-${index}`} className="relative pl-8">
                                    {index < order.timeline.length - 1 ? (
                                      <span
                                        className={`absolute left-[10px] top-6 bottom-[-18px] w-px ${tone.line}`}
                                        aria-hidden="true"
                                      />
                                    ) : null}
                                    <span
                                      className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-2 ${tone.dot}`}
                                      aria-hidden="true"
                                    />
                                    <div className={`rounded-xl border px-4 py-3 ${tone.card}`}>
                                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm font-medium text-black">
                                          {getStatusText(event.type)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {formatOrderDateTime(event.createdAt)}
                                        </p>
                                      </div>
                                      {event.note ? (
                                        <p className="mt-2 text-sm text-gray-700">{event.note}</p>
                                      ) : null}
                                      {event.shippingCompany || event.shippingTrackingNo ? (
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                          {event.shippingCompany ? (
                                            <span>Kargo Firması: {event.shippingCompany}</span>
                                          ) : null}
                                          {event.shippingTrackingNo ? (
                                            <span>Takip No: {event.shippingTrackingNo}</span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === "products" && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h2 className="text-2xl font-light">
                  {activeProductPanel === "create"
                    ? "Ürün Ekle"
                    : activeProductPanel === "stock"
                      ? "Stok Yönetimi"
                      : "Ürünler"}
                </h2>
                {activeProductPanel === "list" ? (
                  <button
                    type="button"
                    onClick={handleOpenCreateProduct}
                    className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                  >
                    Ürün Ekle
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenProductList}
                    className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                  >
                    Ürün Listesi
                  </button>
                )}
              </div>
              {activeProductPanel === "create" ? (
                <>
                  <p className="text-sm text-gray-500 mb-5">Yeni ürün formunu bu alan üzerinden doldurabilirsiniz.</p>
                  {productEditor && isCreatingProduct ? renderProductEditorForm("inline") : null}
                </>
              ) : activeProductPanel === "stock" ? (
                <>
                  <p className="text-sm text-gray-500 mb-5">
                    Stok takibini ürün bazında bu alandan yöneteceğiz. Şimdilik ürünleri hızlıca gözden geçirip düzenleme
                    ekranına geçebilirsiniz.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3 mb-5">
                    <div className="rounded-2xl border border-[#E7E2D8] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Toplam Ürün</p>
                      <p className="mt-2 text-2xl font-semibold text-black">{products.length}</p>
                      <p className="mt-2 text-sm text-gray-500">Stok takibini açabileceğiniz toplam ürün sayısı.</p>
                    </div>
                    <div className="rounded-2xl border border-[#E7E2D8] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Takip Açık</p>
                      <p className="mt-2 text-2xl font-semibold text-black">
                        {products.filter((product) => product.stock != null).length}
                      </p>
                      <p className="mt-2 text-sm text-gray-500">Stok adedi girilmiş ve takibi aktif ürünler.</p>
                    </div>
                    <div className="rounded-2xl border border-[#E7E2D8] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Stokta Yok</p>
                      <p className="mt-2 text-2xl font-semibold text-black">
                        {products.filter((product) => product.stock === 0).length}
                      </p>
                      <p className="mt-2 text-sm text-gray-500">Stok adedi 0 olan ve kontrol bekleyen ürünler.</p>
                    </div>
                  </div>
                  {productsLoading && <p className="text-sm text-gray-500">Ürünler yükleniyor...</p>}
                  {productsError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{productsError}</p>
                  )}
                  {!productsLoading && !productsError && products.length === 0 && (
                    <p className="text-sm text-gray-500">Henüz stok yönetimine alınacak ürün bulunmuyor.</p>
                  )}
                  <div className="space-y-3">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="border border-[#E7E2D8] rounded-2xl bg-white p-4 flex flex-col gap-4 lg:flex-row lg:items-center"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-14 h-14 rounded-md border border-[#E7E2D8] bg-white overflow-hidden shrink-0">
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{product.name}</p>
                            <p className="text-sm text-gray-500">
                              {product.category} · {product.price.toLocaleString("tr-TR")} TL
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Barkod: {product.barcode?.trim() ? product.barcode : "Henüz eklenmedi"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-[#F4EFE6] px-3 py-1 text-xs font-medium text-black">
                            {product.stock == null ? "Takip Kapalı" : `Stok: ${product.stock}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => void openProductEditor(product)}
                            className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                          >
                            Ürünü Düzenle
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-5">Veritabanındaki ürünler listeleniyor.</p>
                  {productsMessage && (
                    <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2 mb-4">{productsMessage}</p>
                  )}
                  {productsLoading && <p className="text-sm text-gray-500">Ürünler yükleniyor...</p>}
                  {productsError && (
                    <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{productsError}</p>
                  )}
                  {!productsLoading && !productsError && products.length === 0 && (
                    <p className="text-sm text-gray-500">Henüz ürün bulunmuyor.</p>
                  )}
                  <div className="space-y-3">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className={`border rounded-lg bg-white p-4 flex items-center gap-3 ${
                          editingProductId === product.id ? "border-black" : "border-[#E7E2D8]"
                        }`}
                      >
                        <div className="w-14 h-14 rounded-md border border-[#E7E2D8] bg-white overflow-hidden shrink-0">
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.price.toLocaleString("tr-TR")} TL</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Stok: {product.stock == null ? "Tanımlanmadı" : product.stock} · Barkod:{" "}
                            {product.barcode?.trim() ? product.barcode : "Yok"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openProductEditor(product)}
                            className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            className="border border-red-600 text-red-600 px-4 py-2 rounded-full text-sm hover:bg-red-600 hover:text-white transition-colors"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeSection === "users" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Kullanıcılar</h2>
              <p className="text-sm text-gray-500 mb-5">Veritabanındaki kullanıcılar listeleniyor.</p>
              {usersLoading && <p className="text-sm text-gray-500">Kullanıcılar yükleniyor...</p>}
              {usersError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{usersError}</p>
              )}
              {!usersLoading && !usersError && users.length === 0 && (
                <p className="text-sm text-gray-500">Henüz kullanıcı bulunmuyor.</p>
              )}
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="border border-[#E7E2D8] rounded-lg bg-white p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-600">E-posta: {user.email}</p>
                        <p className="text-sm text-gray-600">Telefon: {user.phone || "-"}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Kayıt: {formatOrderDateTime(user.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "contactRequests" && (
            <div>
              <h2 className="text-2xl font-light mb-2">İletişim Talepleri</h2>
              <p className="text-sm text-gray-500 mb-5">İletişim formundan gelen talepler burada listelenir.</p>
              {contactRequestsLoading && <p className="text-sm text-gray-500">Talepler yükleniyor...</p>}
              {contactRequestsError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{contactRequestsError}</p>
              )}
              {!contactRequestsLoading && !contactRequestsError && contactRequests.length === 0 && (
                <p className="text-sm text-gray-500">Henüz iletişim talebi bulunmuyor.</p>
              )}

              <div className="space-y-3">
                {contactRequests.map((request) => (
                  <div key={request.id} className="border border-[#E7E2D8] rounded-lg bg-white p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{request.name}</p>
                        <p className="text-sm text-gray-600">{request.email}</p>
                      </div>
                      <p className="text-xs text-gray-500">{formatOrderDateTime(request.createdAt)}</p>
                    </div>
                    <p className="text-sm font-medium text-black">Konu: {request.subject}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "marketing" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Pazarlama</h2>
              <p className="text-sm text-gray-500 mb-5">
                Pazarlama araçlarını alt menülerden ayrı ayrı yönetebilir, kampanyaları daha kontrollü şekilde kurabilirsiniz.
              </p>

              {marketingLoading ? (
                <p className="text-sm text-gray-500">Pazarlama ayarları yükleniyor...</p>
              ) : (
                <div className="max-w-4xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">SMTP</p>
                      <p className={`mt-2 text-sm font-medium ${marketingStats?.mailConfigured ? "text-green-700" : "text-red-600"}`}>
                        {marketingStats?.mailConfigured ? "Hazır" : "Eksik"}
                      </p>
                    </div>
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Uygun Sepet</p>
                      <p className="mt-2 text-2xl font-light">{marketingStats?.eligibleUsers ?? 0}</p>
                    </div>
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Son 7 Gün</p>
                      <p className="mt-2 text-2xl font-light">{marketingStats?.sentLast7Days ?? 0}</p>
                    </div>
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Son Gönderim</p>
                      <p className="mt-2 text-sm font-medium text-gray-700">
                        {marketingStats?.lastSentAt ? formatOrderDateTime(marketingStats.lastSentAt) : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex flex-wrap gap-2 rounded-full border border-[#E7E2D8] bg-white p-1">
                    <button
                      type="button"
                      onClick={handleOpenAbandonedCartMarketing}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                        activeMarketingPanel === "abandonedCart"
                          ? "bg-black text-white"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      Sepet Terk
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCouponsMarketing}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                        activeMarketingPanel === "coupons"
                          ? "bg-black text-white"
                          : "text-black hover:bg-[#ECE7DC]"
                      }`}
                    >
                      <Tag className="h-4 w-4" />
                      Kuponlar
                    </button>
                  </div>

                  {activeMarketingPanel === "abandonedCart" ? (
                    <form
                      onSubmit={handleSaveMarketingSettings}
                      className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium">Sepeti Terk Edenler</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Sadece giriş yapmış ve sunucuda sepeti kayıtlı kullanıcılar hedeflenir.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={marketingSettings.enabled}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                            }
                          />
                          Kampanya aktif
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Bekleme Süresi</label>
                          <input
                            type="number"
                            min={15}
                            max={10080}
                            value={marketingSettings.delayMinutes}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                delayMinutes: Number(e.target.value || 0),
                              }))
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                          />
                          <p className="mt-1 text-xs text-gray-500">Dakika cinsinden. Örn: 120 = 2 saat.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Buton Metni</label>
                          <input
                            type="text"
                            maxLength={80}
                            value={marketingSettings.ctaLabel}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({ ...prev, ctaLabel: e.target.value }))
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">E-posta Konusu</label>
                        <input
                          type="text"
                          maxLength={180}
                          value={marketingSettings.subject}
                          onChange={(e) =>
                            setMarketingSettings((prev) => ({ ...prev, subject: e.target.value }))
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Başlık</label>
                        <input
                          type="text"
                          maxLength={180}
                          value={marketingSettings.heading}
                          onChange={(e) =>
                            setMarketingSettings((prev) => ({ ...prev, heading: e.target.value }))
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Mesaj</label>
                        <textarea
                          rows={5}
                          maxLength={2000}
                          value={marketingSettings.body}
                          onChange={(e) =>
                            setMarketingSettings((prev) => ({ ...prev, body: e.target.value }))
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black resize-y"
                        />
                      </div>

                      {marketingMessage ? (
                        <p
                          className={`text-sm ${
                            marketingMessage.includes("tamamlandı") || marketingMessage.includes("kaydedildi")
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {marketingMessage}
                        </p>
                      ) : null}

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          type="submit"
                          disabled={isSavingMarketing}
                          className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                        >
                          {isSavingMarketing ? "Kaydediliyor..." : "Kampanyayı Kaydet"}
                        </button>
                        <button
                          type="button"
                          onClick={handleRunMarketingCampaign}
                          disabled={isRunningMarketing}
                          className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                        >
                          {isRunningMarketing ? "Taranıyor..." : "Şimdi Tara ve Gönder"}
                        </button>
                      </div>
                    </form>
                  ) : activeMarketingPanel === "coupons" ? (
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-sm font-medium">Kuponlar</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Veritabanında kayıtlı müşteri kuponlarını burada özet olarak görebilir, yeni kupon hazırlamak için ayrı oluşturma ekranına geçebilirsiniz.
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={handleOpenExistingCouponsCampaigns}
                            className="inline-flex items-center justify-center rounded-full border border-black px-4 py-2 text-sm text-black transition-colors hover:bg-black hover:text-white"
                          >
                            Mevcut Kuponları Aç
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenCouponCreateCampaigns}
                            className="inline-flex items-center justify-center rounded-full border border-black px-4 py-2 text-sm text-black transition-colors hover:bg-black hover:text-white"
                          >
                            Kupon Oluştur Ekranını Aç
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Toplam Kupon</p>
                          <p className="mt-2 text-sm font-medium text-black">
                            {customerCouponsLoading ? "Yükleniyor..." : customerCoupons.length.toLocaleString("tr-TR")}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Aktif Kupon</p>
                          <p className="mt-2 text-sm font-medium text-black">
                            {customerCouponsLoading
                              ? "Yükleniyor..."
                              : activeCustomerCoupons.length.toLocaleString("tr-TR")}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Son Güncellenen</p>
                          <p className="mt-2 text-sm font-medium text-black">
                            {customerCouponsLoading
                              ? "Yükleniyor..."
                              : latestCustomerCoupon?.code || "Henüz oluşturulmadı"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Son İndirim</p>
                          <p className="mt-2 text-sm font-medium text-black">
                            {latestCustomerCoupon
                              ? latestCustomerCoupon.type === "fixed"
                                ? `${Number(latestCustomerCoupon.value || 0).toLocaleString("tr-TR")} TL`
                                : `%${Number(latestCustomerCoupon.value || 0).toLocaleString("tr-TR")}`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-dashed border-[#D7D1C3] bg-[#FCFBF8] px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Kupon Özeti</p>
                        {latestCustomerCoupon ? (
                          <>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-medium tracking-[0.2em] text-white">
                                {latestCustomerCoupon.code}
                              </span>
                              <span className="text-sm text-gray-700">
                                {latestCustomerCoupon.type === "fixed"
                                  ? `${Number(latestCustomerCoupon.value || 0).toLocaleString("tr-TR")} TL indirim`
                                  : `%${Number(latestCustomerCoupon.value || 0).toLocaleString("tr-TR")} indirim`}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                                  latestCustomerCoupon.enabled
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                {latestCustomerCoupon.enabled ? "Aktif" : "Pasif"}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-gray-700">
                              {latestCustomerCoupon.description || "Henüz bir kupon açıklaması girilmedi."}
                            </p>
                            <p className="mt-2 text-xs text-gray-500">
                              Müşteri bu kodu minimum {Number(latestCustomerCoupon.minimumSubtotal || 0).toLocaleString("tr-TR")} TL sepette kullanabilir.
                            </p>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-gray-600">
                            Henüz veritabanına kaydedilmiş bir müşteri kuponu yok. Yeni bir kampanya kuponu oluşturarak başlayabilirsiniz.
                          </p>
                        )}
                      </div>

                      {customerCouponMessage ? (
                        <p
                          className={`text-sm ${
                            customerCouponMessage.includes("tamamlandı") ||
                            customerCouponMessage.includes("kaydedildi") ||
                            customerCouponMessage.includes("oluşturuldu") ||
                            customerCouponMessage.includes("güncellendi") ||
                            customerCouponMessage.includes("silindi")
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {customerCouponMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {activeSection === "campaigns" && (
            <div>
              <h2 className="text-2xl font-light mb-2">
                {activeCampaignsPanel === "existingCoupons" ? "Mevcut Kuponlar" : "Kampanyalar"}
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                {activeCampaignsPanel === "existingCoupons"
                  ? "Aktif müşteri kuponlarını, indirim oranlarını ve kullanım koşullarını bu alandan takip edebilirsiniz."
                  : "Müşterilerinizin sepette kullanabileceği kampanya ve indirim kodlarını buradan hazırlayabilirsiniz."}
              </p>

              {activeCampaignsPanel === "existingCoupons" ? (
                <div className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Mevcut Kuponlar</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Veritabanına kaydettiğiniz müşteri kuponlarını, durumlarını ve indirim koşullarını bu alandan yönetebilirsiniz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenCouponCreateCampaigns}
                      className="inline-flex items-center justify-center rounded-full border border-black px-4 py-2 text-sm text-black transition-colors hover:bg-black hover:text-white"
                    >
                      Kupon Oluştur Ekranını Aç
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Toplam Kupon</p>
                      <p className="mt-2 text-sm font-medium text-black">
                        {customerCouponsLoading ? "Yükleniyor..." : customerCoupons.length.toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Aktif Kupon</p>
                      <p className="mt-2 text-sm font-medium text-black">
                        {customerCouponsLoading ? "Yükleniyor..." : activeCustomerCoupons.length.toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Son Kod</p>
                      <p className="mt-2 text-sm font-medium text-black">
                        {customerCouponsLoading ? "Yükleniyor..." : latestCustomerCoupon?.code || "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Son Güncelleme</p>
                      <p className="mt-2 text-sm font-medium text-black">
                        {latestCustomerCoupon?.updatedAt
                          ? formatOrderDateTime(latestCustomerCoupon.updatedAt)
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#E7E2D8] bg-[#FAF9F6] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">Toplam Kullanım</p>
                      <p className="mt-2 text-sm font-medium text-black">
                        {customerCouponsLoading
                          ? "Yükleniyor..."
                          : customerCoupons.reduce((total, coupon) => total + Number(coupon.usageCount || 0), 0).toLocaleString("tr-TR")}
                      </p>
                    </div>
                  </div>

                  {customerCouponsLoading ? (
                    <p className="text-sm text-gray-500">Kuponlar yükleniyor...</p>
                  ) : customerCoupons.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D7D1C3] bg-[#FCFBF8] px-4 py-4 text-sm text-gray-600">
                      Henüz veritabanına kaydedilmiş kupon bulunmuyor. İlk kuponu oluşturmak için üstteki butonu kullanabilirsiniz.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customerCoupons.map((coupon) => (
                        <div
                          key={coupon.id || coupon.code}
                          className="rounded-xl border border-[#E7E2D8] bg-[#FCFBF8] px-4 py-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-medium tracking-[0.2em] text-white">
                                  {coupon.code}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                                    coupon.enabled
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-200 text-gray-700"
                                  }`}
                                >
                                  {coupon.enabled ? "Aktif" : "Pasif"}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {coupon.type === "fixed"
                                    ? `${Number(coupon.value || 0).toLocaleString("tr-TR")} TL indirim`
                                    : `%${Number(coupon.value || 0).toLocaleString("tr-TR")} indirim`}
                                </span>
                                <span className="text-sm text-gray-700">
                                  Kullanım: {Number(coupon.usageCount || 0).toLocaleString("tr-TR")}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">
                                {coupon.description || "Bu kupon için açıklama girilmedi."}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                                <span>
                                  Minimum Sepet: {Number(coupon.minimumSubtotal || 0).toLocaleString("tr-TR")} TL
                                </span>
                                <span>
                                  {coupon.singleUsePerCustomer
                                    ? "Müşteri başına tek kullanım"
                                    : "Müşteri başına tekrar kullanılabilir"}
                                </span>
                                {coupon.startsAt ? (
                                  <span>Başlangıç: {formatOrderDateTime(coupon.startsAt)}</span>
                                ) : null}
                                {coupon.expiresAt ? (
                                  <span>Bitiş: {formatOrderDateTime(coupon.expiresAt)}</span>
                                ) : null}
                                <span>
                                  Son Güncelleme: {coupon.updatedAt ? formatOrderDateTime(coupon.updatedAt) : "-"}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => handleEditCoupon(coupon)}
                                className="inline-flex items-center justify-center rounded-full border border-black px-4 py-2 text-sm text-black transition-colors hover:bg-black hover:text-white"
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCoupon(coupon)}
                                disabled={isSavingCustomerCoupon}
                                className="inline-flex items-center justify-center rounded-full border border-[#D5CFC3] px-4 py-2 text-sm text-gray-700 transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-50"
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {customerCouponMessage ? (
                    <p
                      className={`text-sm ${
                        customerCouponMessage.includes("tamamlandı") ||
                        customerCouponMessage.includes("kaydedildi") ||
                        customerCouponMessage.includes("oluşturuldu") ||
                        customerCouponMessage.includes("güncellendi") ||
                        customerCouponMessage.includes("silindi")
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {customerCouponMessage}
                    </p>
                  ) : null}
                </div>
              ) : (
                <form
                  onSubmit={handleSaveCustomerCouponSettings}
                  className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-4"
                >
                  <div className="rounded-xl border border-[#E7E2D8] bg-[#FAF9F6] p-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-medium">
                          {customerCouponSettings.id ? "Kuponu Düzenle" : "Kupon Oluştur"}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Tüm müşterilerinizin sepette kullanabileceği indirim kodunu buradan hazırlayabilir veya mevcut bir kuponu güncelleyebilirsiniz.
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {customerCouponSettings.id ? (
                          <button
                            type="button"
                            onClick={resetCustomerCouponDraft}
                            className="inline-flex items-center justify-center rounded-full border border-[#D5CFC3] px-4 py-2 text-sm text-gray-700 transition-colors hover:border-black hover:text-black"
                          >
                            Yeni Kupon Hazırla
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleGenerateCouponCode}
                          className="inline-flex items-center justify-center rounded-full border border-black px-4 py-2 text-sm text-black transition-colors hover:bg-black hover:text-white"
                        >
                          Otomatik Kod Üret
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <div className="rounded-lg border border-[#E7E2D8] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Durum</p>
                        <p className={`mt-2 text-sm font-medium ${customerCouponSettings.enabled ? "text-green-700" : "text-gray-600"}`}>
                          {customerCouponSettings.enabled ? "Aktif" : "Pasif"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#E7E2D8] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Kod</p>
                        <p className="mt-2 text-sm font-medium text-black">
                          {customerCouponSettings.code || "Henüz oluşturulmadı"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#E7E2D8] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">İndirim</p>
                        <p className="mt-2 text-sm font-medium text-black">
                          {customerCouponSettings.type === "fixed"
                            ? `${Number(customerCouponSettings.value || 0).toLocaleString("tr-TR")} TL`
                            : `%${Number(customerCouponSettings.value || 0).toLocaleString("tr-TR")}`}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#E7E2D8] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Minimum Sepet</p>
                        <p className="mt-2 text-sm font-medium text-black">
                          {Number(customerCouponSettings.minimumSubtotal || 0).toLocaleString("tr-TR")} TL
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#E7E2D8] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Kullanım</p>
                        <p className="mt-2 text-sm font-medium text-black">
                          {Number(customerCouponSettings.usageCount || 0).toLocaleString("tr-TR")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Kupon Ayarları</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Buradaki kupon ayarları veritabanına kaydedilir ve müşterilerin sepette manuel kullanacağı indirim kodunu belirler.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={customerCouponSettings.enabled}
                          onChange={(e) =>
                            setCustomerCouponSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                          }
                        />
                        Kupon aktif
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={customerCouponSettings.singleUsePerCustomer}
                          onChange={(e) =>
                            setCustomerCouponSettings((prev) => ({
                              ...prev,
                              singleUsePerCustomer: e.target.checked,
                            }))
                          }
                        />
                        Müşteri başına tek kullanım
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Kupon Kodu</label>
                      <input
                        type="text"
                        maxLength={40}
                        value={customerCouponSettings.code}
                        onChange={(e) =>
                          setCustomerCouponSettings((prev) => ({
                            ...prev,
                            code: e.target.value.toUpperCase().replace(/\s+/g, ""),
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">İndirim Tipi</label>
                      <select
                        value={customerCouponSettings.type}
                        onChange={(e) =>
                          setCustomerCouponSettings((prev) => ({
                            ...prev,
                            type: e.target.value === "fixed" ? "fixed" : "percentage",
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      >
                        <option value="percentage">Yüzde</option>
                        <option value="fixed">Sabit Tutar</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {customerCouponSettings.type === "fixed" ? "İndirim Tutarı (TL)" : "İndirim Oranı (%)"}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={customerCouponSettings.type === "fixed" ? 100000 : 95}
                        value={customerCouponSettings.value}
                        onChange={(e) =>
                          setCustomerCouponSettings((prev) => ({
                            ...prev,
                            value: Number(e.target.value || 0),
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Minimum Sepet Tutarı</label>
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        value={customerCouponSettings.minimumSubtotal}
                        onChange={(e) =>
                          setCustomerCouponSettings((prev) => ({
                            ...prev,
                            minimumSubtotal: Number(e.target.value || 0),
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Başlangıç Tarihi</label>
                      <input
                        type="datetime-local"
                        value={customerCouponSettings.startsAt || ""}
                        onChange={(e) =>
                          setCustomerCouponSettings((prev) => ({
                            ...prev,
                            startsAt: e.target.value,
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      />
                      <p className="mt-1 text-xs text-gray-500">Boş bırakırsanız kupon hemen aktif olabilir.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Bitiş Tarihi</label>
                      <input
                        type="datetime-local"
                        value={customerCouponSettings.expiresAt || ""}
                        onChange={(e) =>
                          setCustomerCouponSettings((prev) => ({
                            ...prev,
                            expiresAt: e.target.value,
                          }))
                        }
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      />
                      <p className="mt-1 text-xs text-gray-500">Boş bırakırsanız kupon süresiz kalır.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Kupon Açıklaması</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={customerCouponSettings.description}
                      onChange={(e) =>
                        setCustomerCouponSettings((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div className="rounded-xl border border-dashed border-[#D7D1C3] bg-[#FCFBF8] px-4 py-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Önizleme</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-medium tracking-[0.2em] text-white">
                        {customerCouponSettings.code || "KUPON-KODU"}
                      </span>
                      <span className="text-sm text-gray-700">
                        {customerCouponSettings.type === "fixed"
                          ? `${Number(customerCouponSettings.value || 0).toLocaleString("tr-TR")} TL indirim`
                          : `%${Number(customerCouponSettings.value || 0).toLocaleString("tr-TR")} indirim`}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-700">
                      {customerCouponSettings.description || "Müşterilerinize özel indirim kodunuz hazır."}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Müşteri bu kodu minimum {Number(customerCouponSettings.minimumSubtotal || 0).toLocaleString("tr-TR")} TL sepette kullanabilir.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {customerCouponSettings.singleUsePerCustomer
                        ? "Kupon aynı müşteri hesabında yalnızca bir kez kullanılabilir."
                        : "Kupon aynı müşteri hesabında tekrar kullanılabilir."}
                    </p>
                    {customerCouponSettings.startsAt ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Başlangıç: {formatOrderDateTime(customerCouponSettings.startsAt)}
                      </p>
                    ) : null}
                    {customerCouponSettings.expiresAt ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Bitiş: {formatOrderDateTime(customerCouponSettings.expiresAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-[#E7E2D8] bg-[#F8F7F4] px-4 py-3 text-sm text-gray-600">
                    Müşteri kupon kodunu sepette girdiğinde, minimum tutar sağlanıyorsa indirim uygulanır ve ödeme sırasında sunucuda tekrar doğrulanır. Tek kullanım ve tarih aralığı kontrolleri de sipariş anında sunucuda yeniden denetlenir.
                  </div>

                  {customerCouponMessage ? (
                    <p
                      className={`text-sm ${
                        customerCouponMessage.includes("tamamlandı") ||
                        customerCouponMessage.includes("kaydedildi") ||
                        customerCouponMessage.includes("oluşturuldu") ||
                        customerCouponMessage.includes("güncellendi") ||
                        customerCouponMessage.includes("silindi")
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {customerCouponMessage}
                    </p>
                  ) : null}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      disabled={isSavingCustomerCoupon}
                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isSavingCustomerCoupon
                        ? "Kaydediliyor..."
                        : customerCouponSettings.id
                        ? "Kuponu Güncelle"
                        : "Kuponu Kaydet"}
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenExistingCouponsCampaigns}
                      className="border border-[#D5CFC3] text-gray-700 px-4 py-2 rounded-full text-sm hover:border-black hover:text-black transition-colors"
                    >
                      Mevcut Kuponları Gör
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeSection === "trendyol" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Trendyol</h2>
              <p className="text-sm text-gray-500 mb-5">
                Trendyol siparişleri bu alanda ayrı gösterilir. Ürün create ve update işlemlerinde otomatik senkronizasyon,
                `.env` içindeki Trendyol alanları eksiksiz doldurulduğunda backend tarafından tetiklenir.
              </p>
              {trendyolLoading ? <p className="text-sm text-gray-500">Trendyol verileri yükleniyor...</p> : null}
              {trendyolError ? (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{trendyolError}</p>
              ) : null}

              {!trendyolLoading && trendyolStatus ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Entegrasyon</p>
                      <p className={`mt-2 text-lg font-medium ${trendyolStatus.configured ? "text-green-700" : "text-amber-700"}`}>
                        {trendyolStatus.configured ? "Hazır" : "Eksik"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Sipariş Çekme</p>
                      <p className={`mt-2 text-lg font-medium ${trendyolStatus.orderFetchReady ? "text-green-700" : "text-amber-700"}`}>
                        {trendyolStatus.orderFetchReady ? "Hazır" : "Eksik"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Oto Ürün Sync</p>
                      <p className={`mt-2 text-lg font-medium ${trendyolStatus.productSyncReady ? "text-green-700" : "text-amber-700"}`}>
                        {trendyolStatus.productSyncReady ? "Hazır" : "Eksik"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Ortam</p>
                      <p className="mt-2 text-lg font-medium text-black">{trendyolStatus.environment || "-"}</p>
                    </div>
                  </div>

                  {trendyolStatus.missing.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                      <p className="text-sm font-medium text-amber-900 mb-2">Doldurulması gereken `.env` alanları</p>
                      <div className="flex flex-wrap gap-2">
                        {trendyolStatus.missing.map((item) => (
                          <span key={item} className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs text-amber-900">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {trendyolStatus.notes.length > 0 ? (
                    <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-4 space-y-2">
                      <p className="text-sm font-medium text-black">Notlar</p>
                      {trendyolStatus.notes.map((note, index) => (
                        <p key={`${note}-${index}`} className="text-sm text-gray-600">
                          {note}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-[#E7E2D8] bg-white px-5 py-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-black">Trendyol Siparişleri</h3>
                        <p className="text-sm text-gray-500">Trendyol paket siparişleri admin panelde ayrı görünür.</p>
                      </div>
                      <p className="text-sm text-gray-500">{trendyolOrders.length.toLocaleString("tr-TR")} kayıt</p>
                    </div>

                    {trendyolOrders.length === 0 ? (
                      <p className="text-sm text-gray-500">Listelenecek Trendyol siparişi bulunmuyor.</p>
                    ) : (
                      <div className="space-y-3">
                        {trendyolOrders.map((order) => (
                          <div key={order.id} className="rounded-xl border border-[#E7E2D8] bg-[#FCFBF8] px-4 py-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-black">
                                  {order.orderNumber} / Paket {order.packageNumber}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {order.customerName} • {order.status} • {new Date(order.createdAt).toLocaleString("tr-TR")}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {order.cargoProviderName || "Kargo bilgisi yok"}
                                  {order.cargoTrackingNumber ? ` • ${order.cargoTrackingNumber}` : ""}
                                </p>
                              </div>
                              <p className="text-base font-medium text-black">{order.totalPrice.toLocaleString("tr-TR")} TL</p>
                            </div>
                            <div className="mt-3 space-y-1">
                              {order.lines.map((line, index) => (
                                <p key={`${order.id}-${line.barcode}-${index}`} className="text-sm text-gray-600">
                                  {line.productName} • {line.quantity} adet • {line.barcode || line.merchantSku || "-"}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeSection === "settings" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Ayarlar</h2>
              <p className="text-sm text-gray-500 mb-5">Site genel ayarlarını buradan düzenleyebilirsiniz.</p>
              {settingsLoading ? (
                <p className="text-sm text-gray-500">Ayarlar yükleniyor...</p>
              ) : (
                <div className="max-w-xl space-y-4">
                  <form onSubmit={handleSaveSettings} className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Site İsmi</label>
                      <input
                        type="text"
                        value={siteNameInput}
                        onChange={(e) => setSiteNameInput(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        maxLength={80}
                      />
                    </div>
                    {settingsMessage ? (
                      <p className={`text-sm ${settingsMessage.includes("güncellendi") ? "text-green-700" : "text-red-600"}`}>
                        {settingsMessage}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isSavingSettings ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </form>

                  <div className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">Google Merchant Center</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Ürünleri Content API ile Merchant Center hesabına gönderir.
                        </p>
                      </div>
                    </div>

                    {merchantLoading ? (
                      <p className="text-sm text-gray-500">Merchant durumu yükleniyor...</p>
                    ) : merchantStatus ? (
                      <div className="text-sm space-y-1">
                        <p>
                          Durum:{" "}
                          <span className={merchantStatus.enabled ? "text-green-700" : "text-red-600"}>
                            {merchantStatus.enabled ? "Aktif" : "Pasif"}
                          </span>
                        </p>
                        <p>
                          Konfigürasyon:{" "}
                          <span className={merchantStatus.configured ? "text-green-700" : "text-red-600"}>
                            {merchantStatus.configured ? "Hazır" : "Eksik"}
                          </span>
                        </p>
                        <p>Merchant ID: {merchantStatus.accountId || "-"}</p>
                        <p>
                          Ülke/Dil/Para: {merchantStatus.targetCountry} / {merchantStatus.contentLanguage} /{" "}
                          {merchantStatus.currency}
                        </p>
                      </div>
                    ) : null}

                    {merchantMessage ? (
                      <p className={`text-sm ${merchantMessage.toLowerCase().includes("tamamlandı") ? "text-green-700" : "text-red-600"}`}>
                        {merchantMessage}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSyncGoogleMerchant}
                      disabled={merchantSyncing || !merchantStatus?.enabled || !merchantStatus?.configured}
                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                    >
                      {merchantSyncing ? "Google'a Gönderiliyor..." : "Ürünleri Google Merchant'a Gönder"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {productEditor && !isCreatingProduct && (
        <div className="fixed inset-0 z-[120] bg-black/35 p-4 md:p-8 flex items-center justify-center">
          {renderProductEditorForm("modal")}
        </div>
      )}
    </div>
  );
}



