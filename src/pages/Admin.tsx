import { Menu, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createAdminProduct,
  adminLogin,
  adminLogout,
  deleteAdminProduct,
  fetchAdminAbandonedCartCampaign,
  fetchAdminContactRequests,
  fetchAdminProductById,
  fetchAdminGoogleMerchantStatus,
  fetchAdminSettings,
  fetchAdminUsers,
  adminValidate,
  fetchAdminOrders,
  fetchAdminProducts,
  updateAdminSettings,
  syncAdminGoogleMerchant,
  updateAdminOrderStatus,
  updateAdminAbandonedCartCampaign,
  updateAdminProduct,
  uploadAdminProductImages,
  runAdminAbandonedCartCampaign,
} from "@/lib/api";
import type {
  AdminAbandonedCartSettings,
  AdminContactRequest,
  AdminOrder,
  AdminUserSummary,
  Product,
} from "@/types";

const ADMIN_TOKEN_KEY = "parisMoveAdminToken";
const ADMIN_REMEMBER_KEY = "parisMoveAdminRemember";
type AdminSection = "orders" | "products" | "users" | "contactRequests" | "marketing" | "settings";
type OrderStatusDraft = {
  status: "processing" | "shipped" | "delivered";
  shippingCompany: string;
  shippingTrackingNo: string;
};
type ProductEditorDraft = {
  id: string;
  name: string;
  price: string;
  images: Array<{ id: string; url: string; isLocal: boolean }>;
  category: string;
  description: string;
  features: string[];
  colors: string[];
  tags: string[];
  isNew: boolean;
  isBestseller: boolean;
};
const MAX_PRODUCT_IMAGES = 15;
const shippingCompanies = [
  "Sen Kargo",
  "Aras Kargo",
  "PTT Kargo",
  "DHL",
  "SÃ¼rat Kargo",
  "YurtiÃ§i Kargo",
];
const defaultMarketingSettings: AdminAbandonedCartSettings = {
  enabled: false,
  delayMinutes: 120,
  subject: "Sepetiniz sizi bekliyor",
  heading: "Sepetinizde bÄ±raktÄ±ÄŸÄ±nÄ±z Ã¼rÃ¼nler sizi bekliyor",
  body:
    "SeÃ§tiÄŸiniz Ã¼rÃ¼nler hÃ¢lÃ¢ sepetinizde duruyor. TÃ¼kenmeden alÄ±ÅŸveriÅŸinizi tamamlamak iÃ§in sepete geri dÃ¶nebilirsiniz.",
  ctaLabel: "Sepetime DÃ¶n",
  couponEnabled: false,
  couponCode: "",
  couponType: "percentage",
  couponValue: 10,
  couponMinimumSubtotal: 750,
  couponDescription: "Sepetinize Ã¶zel indirim kodunuz hazÄ±r.",
};

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
  const [activeSection, setActiveSection] = useState<AdminSection>("orders");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, OrderStatusDraft>>({});
  const [statusSavingByOrderId, setStatusSavingByOrderId] = useState<Record<string, boolean>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
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
  const [marketingStats, setMarketingStats] = useState<{
    eligibleUsers: number;
    sentLast7Days: number;
    lastSentAt: string | null;
    mailConfigured: boolean;
  } | null>(null);
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
    if (!isAuthenticated) return;
    const token = getStoredAdminToken();
    if (!token) return;

    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError("");
      try {
        const data = await fetchAdminOrders(token);
        setOrders(data);
        setStatusDrafts(data.reduce<Record<string, OrderStatusDraft>>((acc, order) => {
          const normalizedStatus =
            order.status === "shipped" || order.status === "delivered" ? order.status : "processing";
          acc[order.id] = {
            status: normalizedStatus,
            shippingCompany: order.shippingCompany ?? "",
            shippingTrackingNo: order.shippingTrackingNo ?? "",
          };
          return acc;
        }, {}));
      } catch (err) {
        setOrdersError(err instanceof Error ? err.message : "SipariÅŸler alÄ±namadÄ±.");
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [isAuthenticated]);

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
        setProductsError(err instanceof Error ? err.message : "ÃœrÃ¼nler alÄ±namadÄ±.");
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
        setSettingsMessage(err instanceof Error ? err.message : "Ayarlar alÄ±namadÄ±.");
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
        setUsersError(err instanceof Error ? err.message : "KullanÄ±cÄ±lar alÄ±namadÄ±.");
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
        setContactRequestsError(err instanceof Error ? err.message : "Ä°letiÅŸim talepleri alÄ±namadÄ±.");
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
        const data = await fetchAdminAbandonedCartCampaign(token);
        if (!mounted) return;
        setMarketingSettings(data.settings);
        setMarketingStats(data.stats);
      } catch (err) {
        if (!mounted) return;
        setMarketingMessage(err instanceof Error ? err.message : "Pazarlama ayarlarÄ± alÄ±namadÄ±.");
      } finally {
        if (mounted) setMarketingLoading(false);
      }
    };

    void loadMarketing();
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
      setActiveSection("orders");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "GiriÅŸ baÅŸarÄ±sÄ±z.");
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
    setOrders([]);
    setExpandedOrderId(null);
    setStatusDrafts({});
    setStatusSavingByOrderId({});
    setProducts([]);
    setProductsError("");
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
    setMarketingStats(null);
    setIsSavingMarketing(false);
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
    setIsMobileNavOpen(false);
  };

  const handleSectionChange = (section: AdminSection) => {
    setActiveSection(section);
    setIsMobileNavOpen(false);
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
      setSettingsMessage("Site ismi gÃ¼ncellendi.");
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
      setMarketingMessage("Sepeti terk eden mÃ¼ÅŸteriler kampanyasÄ± kaydedildi.");
    } catch (err) {
      setMarketingMessage(err instanceof Error ? err.message : "Pazarlama ayarlarÄ± kaydedilemedi.");
    } finally {
      setIsSavingMarketing(false);
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
      setMarketingMessage(err instanceof Error ? err.message : "Kampanya Ã§alÄ±ÅŸtÄ±rÄ±lamadÄ±.");
    } finally {
      setIsRunningMarketing(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Teslim Edildi";
      case "shipped":
        return "Kargoya Verildi";
      case "processing":
        return "HazÄ±rlanÄ±yor";
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

  const clearLocalImagePreviews = (images: Array<{ url: string; isLocal: boolean }>) => {
    images.forEach((image) => {
      if (image.isLocal && image.url.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
    });
  };

  const handleSaveOrderStatus = async (orderId: string) => {
    const token = getStoredAdminToken();
    const draft = statusDrafts[orderId];
    if (!token || !draft) return;

    setStatusSavingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    setOrdersError("");
    try {
      await updateAdminOrderStatus(token, orderId, {
        status: draft.status,
        shippingCompany: draft.status === "shipped" ? draft.shippingCompany : undefined,
        shippingTrackingNo: draft.status === "shipped" ? draft.shippingTrackingNo : undefined,
      });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: draft.status,
                shippingCompany: draft.status === "shipped" ? draft.shippingCompany : "",
                shippingTrackingNo: draft.status === "shipped" ? draft.shippingTrackingNo : "",
              }
            : order
        )
      );
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "SipariÅŸ durumu gÃ¼ncellenemedi.");
    } finally {
      setStatusSavingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const openProductEditor = async (product: Product) => {
    const token = getStoredAdminToken();
    if (!token) return;
    if (productEditor) {
      clearLocalImagePreviews(productEditor.images);
    }
    setIsCreatingProduct(false);
    setEditingProductId(product.id);
    setProductSaveMessage("ÃœrÃ¼n detaylarÄ± yÃ¼kleniyor...");
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
      setProductSaveMessage(error instanceof Error ? error.message : "ÃœrÃ¼n detaylarÄ± alÄ±namadÄ±.");
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
          `Google Merchant senkron tamamlandÄ±. BaÅŸarÄ±lÄ±: ${result.success}, Silinen: ${result.deleted}, HatalÄ±: ${result.failed}`
      );
    } catch (err) {
      setMerchantMessage(err instanceof Error ? err.message : "Google Merchant senkronu baÅŸarÄ±sÄ±z.");
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
      setProductSaveMessage(`En fazla ${MAX_PRODUCT_IMAGES} gÃ¶rsel ekleyebilirsiniz.`);
      return;
    }

    const accepted = files
      .filter((file) => {
        if (file.type.startsWith("image/")) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)$/i.test(file.name);
      })
      .slice(0, remaining);
    if (accepted.length === 0) {
      setProductSaveMessage("LÃ¼tfen geÃ§erli bir gÃ¶rsel dosyasÄ± seÃ§in.");
      return;
    }
    const token = getStoredAdminToken();
    if (!token) {
      setProductSaveMessage("Admin oturumu bulunamadÄ±.");
      return;
    }

    setProductSaveMessage("GÃ¶rseller yÃ¼kleniyor...");
    try {
      const uploadedUrls = await uploadAdminProductImages(token, accepted);
      const selected = uploadedUrls.map((url, index) => ({
        id: `uploaded-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        url,
        isLocal: false,
      }));
      setProductEditor((prev) => (prev ? { ...prev, images: [...prev.images, ...selected] } : prev));
      if (files.length > remaining) {
        setProductSaveMessage(`En fazla ${MAX_PRODUCT_IMAGES} gÃ¶rsel ekleyebilirsiniz.`);
      } else {
        setProductSaveMessage("");
      }
    } catch (error) {
      setProductSaveMessage(error instanceof Error ? error.message : "GÃ¶rseller yÃ¼klenemedi.");
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
      setProductSaveMessage("ÃœrÃ¼n ismi zorunlu.");
      return;
    }
    const primaryImage = productEditor.images.find((image) => image.url.trim().length > 0)?.url?.trim() ?? "";
    if (!primaryImage) {
      setProductSaveMessage("Kaydetmek iÃ§in en az bir gÃ¶rsel zorunlu.");
      return;
    }
    const numericPrice = Number(productEditor.price);

    const features = productEditor.features.map((item) => item.trim()).filter((item) => item.length > 0);
    const colors = productEditor.colors.map((item) => item.trim()).filter((item) => item.length > 0);

    setIsSavingProduct(true);
    setProductSaveMessage("");
    try {
      const payload = {
        id: productEditor.id.trim() || undefined,
        name: productEditor.name.trim(),
        price: Number.isFinite(numericPrice) ? numericPrice : 0,
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

      const updatedProduct = isCreatingProduct
        ? await createAdminProduct(token, payload)
        : await updateAdminProduct(token, productEditor.id, payload);

      if (isCreatingProduct) {
        setProducts((prev) => [updatedProduct, ...prev.filter((item) => item.id !== updatedProduct.id)]);
      } else {
        setProducts((prev) => prev.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)));
      }
      clearLocalImagePreviews(productEditor.images);
      setProductEditor({
        id: updatedProduct.id,
        name: updatedProduct.name,
        price: String(updatedProduct.price),
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
      setProductSaveMessage(isCreatingProduct ? "ÃœrÃ¼n baÅŸarÄ±yla eklendi." : "ÃœrÃ¼n baÅŸarÄ±yla gÃ¼ncellendi.");
    } catch (err) {
      setProductSaveMessage(
        err instanceof Error ? err.message : isCreatingProduct ? "ÃœrÃ¼n eklenemedi." : "ÃœrÃ¼n gÃ¼ncellenemedi."
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const token = getStoredAdminToken();
    if (!token) return;
    const confirmText = `"${product.name}" Ã¼rÃ¼nÃ¼nÃ¼ silmek istediÄŸinize emin misiniz?`;
    if (!window.confirm(confirmText)) return;

    setProductsError("");
    try {
      await deleteAdminProduct(token, product.id);
      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      if (editingProductId === product.id || (productEditor && productEditor.id === product.id)) {
        closeProductEditor();
      }
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : "ÃœrÃ¼n silinemedi.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-24 pb-20 px-4 md:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg p-6 text-center text-gray-500">
          YÃ¼kleniyor...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-24 pb-20 px-4 md:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg p-6 md:p-8">
          <h1 className="text-2xl font-light mb-6">Admin GiriÅŸ</h1>
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
              <label className="block text-sm font-medium mb-2">Åifre</label>
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
              <span>Bu cihazda beni hatirla</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-black text-white py-3 rounded-full text-sm disabled:opacity-50"
            >
              {submitting ? "GiriÅŸ yapÄ±lÄ±yor..." : "GiriÅŸ Yap"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-screen">
        <aside className="hidden md:block border-b md:border-b-0 md:border-r border-[#E7E2D8] bg-[#F8F7F4] p-4 md:p-6 md:h-screen md:sticky md:top-0">
          <h1 className="text-xl font-light mb-6">Admin Panel</h1>
          <nav className="space-y-2">
            <button
              onClick={() => handleSectionChange("orders")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "orders" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              SipariÅŸler
            </button>
            <button
              onClick={() => handleSectionChange("products")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "products" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              ÃœrÃ¼nler
            </button>
            <button
              onClick={() => handleSectionChange("users")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "users" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              KullanÄ±cÄ±lar
            </button>
            <button
              onClick={() => handleSectionChange("contactRequests")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "contactRequests" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              Ä°letiÅŸim Talepleri
            </button>
            <button
              onClick={() => handleSectionChange("marketing")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "marketing" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              Pazarlama
            </button>
            <button
              onClick={() => handleSectionChange("settings")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "settings" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              Ayarlar
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 rounded-md text-sm border border-black text-black hover:bg-black hover:text-white transition-colors"
            >
              Ã‡Ä±kÄ±ÅŸ Yap
            </button>
          </nav>
        </aside>

        <section className="p-6 md:p-8 bg-white">
          <div className="md:hidden mb-4">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex items-center justify-center w-10 h-10 border border-black rounded-md"
              aria-label="Admin menÃ¼sÃ¼nÃ¼ aÃ§"
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
                    aria-label="Admin menÃ¼sÃ¼nÃ¼ kapat"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-2">
                  <button
                    onClick={() => handleSectionChange("orders")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "orders" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    SipariÅŸler
                  </button>
                  <button
                    onClick={() => handleSectionChange("products")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "products" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    ÃœrÃ¼nler
                  </button>
                  <button
                    onClick={() => handleSectionChange("users")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "users" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    KullanÄ±cÄ±lar
                  </button>
                  <button
                    onClick={() => handleSectionChange("contactRequests")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "contactRequests" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    Ä°letiÅŸim Talepleri
                  </button>
                  <button
                    onClick={() => handleSectionChange("marketing")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "marketing" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    Pazarlama
                  </button>
                  <button
                    onClick={() => handleSectionChange("settings")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "settings" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    Ayarlar
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 rounded-md text-sm border border-black text-black hover:bg-black hover:text-white transition-colors"
                  >
                    Ã‡Ä±kÄ±ÅŸ Yap
                  </button>
                </nav>
              </div>
            </div>
          )}
          {activeSection === "orders" && (
            <div>
              <h2 className="text-2xl font-light mb-2">SipariÅŸler</h2>
              <p className="text-sm text-gray-500 mb-5">VeritabanÄ±ndaki sipariÅŸler listeleniyor.</p>
              {ordersLoading && <p className="text-sm text-gray-500">SipariÅŸler yÃ¼kleniyor...</p>}
              {ordersError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{ordersError}</p>
              )}
              {!ordersLoading && !ordersError && orders.length === 0 && (
                <p className="text-sm text-gray-500">HenÃ¼z sipariÅŸ bulunmuyor.</p>
              )}

              <div className="space-y-3">
                {orders.map((order) => {
                  const firstItem = order.items[0];
                  const productName = firstItem?.product?.name ?? "ÃœrÃ¼n adÄ± yok";
                  const productImage = firstItem?.product?.image ?? "";
                  const isExpanded = expandedOrderId === order.id;
                  const draft = statusDrafts[order.id] ?? {
                    status: "processing" as const,
                    shippingCompany: "",
                    shippingTrackingNo: "",
                  };

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
                            <p className="text-sm text-gray-500">SipariÅŸ No: {order.id}</p>
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
                          <h3 className="text-sm font-medium mb-3">MÃ¼ÅŸteri Ä°letiÅŸim Bilgileri</h3>
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
                              <p>Kargo FirmasÄ±: {order.shippingCompany}</p>
                            )}
                            {order.status === "shipped" && order.shippingTrackingNo && (
                              <p>Takip No: {order.shippingTrackingNo}</p>
                            )}
                          </div>
                          <div className="mt-4 flex flex-col gap-2">
                            <select
                              value={draft.status}
                              onChange={(e) =>
                                setStatusDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...(prev[order.id] ?? {
                                      status: "processing" as const,
                                      shippingCompany: order.shippingCompany ?? "",
                                      shippingTrackingNo: order.shippingTrackingNo ?? "",
                                    }),
                                    status: e.target.value as "processing" | "shipped" | "delivered",
                                  },
                                }))
                              }
                              className="w-full sm:w-[240px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                            >
                              <option value="processing">HazÄ±rlanÄ±yor</option>
                              <option value="shipped">Kargoya Verildi</option>
                              <option value="delivered">Teslim Edildi</option>
                            </select>
                            {draft.status === "shipped" && (
                              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                <select
                                  value={draft.shippingCompany}
                                  onChange={(e) =>
                                    setStatusDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...(prev[order.id] ?? {
                                          status: "shipped" as const,
                                          shippingCompany: "",
                                          shippingTrackingNo: "",
                                        }),
                                        shippingCompany: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full sm:w-[220px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                >
                                  <option value="">Kargo FirmasÄ±</option>
                                  {shippingCompanies.map((company) => (
                                    <option key={company} value={company}>
                                      {company}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={draft.shippingTrackingNo}
                                  onChange={(e) =>
                                    setStatusDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...(prev[order.id] ?? {
                                          status: "shipped" as const,
                                          shippingCompany: "",
                                          shippingTrackingNo: "",
                                        }),
                                        shippingTrackingNo: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Takip No"
                                  className="w-full sm:w-[220px] bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveOrderStatus(order.id)}
                                  disabled={Boolean(statusSavingByOrderId[order.id])}
                                  className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50 sm:whitespace-nowrap"
                                >
                                  {statusSavingByOrderId[order.id] ? "Kaydediliyor..." : "Durumu Kaydet"}
                                </button>
                              </div>
                            )}
                            {draft.status !== "shipped" && (
                              <button
                                type="button"
                                onClick={() => handleSaveOrderStatus(order.id)}
                                disabled={Boolean(statusSavingByOrderId[order.id])}
                                className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50 w-full sm:w-auto"
                              >
                                {statusSavingByOrderId[order.id] ? "Kaydediliyor..." : "Durumu Kaydet"}
                              </button>
                            )}
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
                <h2 className="text-2xl font-light">ÃœrÃ¼nler</h2>
                <button
                  type="button"
                  onClick={openCreateProductEditor}
                  className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                >
                  Ekle
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-5">VeritabanÄ±ndaki Ã¼rÃ¼nler listeleniyor.</p>
              {productsLoading && <p className="text-sm text-gray-500">ÃœrÃ¼nler yÃ¼kleniyor...</p>}
              {productsError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{productsError}</p>
              )}
              {!productsLoading && !productsError && products.length === 0 && (
                <p className="text-sm text-gray-500">HenÃ¼z Ã¼rÃ¼n bulunmuyor.</p>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openProductEditor(product)}
                        className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                      >
                        DÃ¼zenle
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
            </div>
          )}

          {activeSection === "users" && (
            <div>
              <h2 className="text-2xl font-light mb-2">KullanÄ±cÄ±lar</h2>
              <p className="text-sm text-gray-500 mb-5">VeritabanÄ±ndaki kullanÄ±cÄ±lar listeleniyor.</p>
              {usersLoading && <p className="text-sm text-gray-500">KullanÄ±cÄ±lar yÃ¼kleniyor...</p>}
              {usersError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{usersError}</p>
              )}
              {!usersLoading && !usersError && users.length === 0 && (
                <p className="text-sm text-gray-500">HenÃ¼z kullanÄ±cÄ± bulunmuyor.</p>
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
                        KayÄ±t: {formatOrderDateTime(user.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "contactRequests" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Ä°letiÅŸim Talepleri</h2>
              <p className="text-sm text-gray-500 mb-5">Ä°letiÅŸim formundan gelen talepler burada listelenir.</p>
              {contactRequestsLoading && <p className="text-sm text-gray-500">Talepler yÃ¼kleniyor...</p>}
              {contactRequestsError && (
                <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-4">{contactRequestsError}</p>
              )}
              {!contactRequestsLoading && !contactRequestsError && contactRequests.length === 0 && (
                <p className="text-sm text-gray-500">HenÃ¼z iletiÅŸim talebi bulunmuyor.</p>
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
                Ä°lk kampanya olarak sepette Ã¼rÃ¼n bÄ±rakÄ±p ayrÄ±lan mÃ¼ÅŸterilere hatÄ±rlatma e-postasÄ± gÃ¶nderilir.
              </p>

              {marketingLoading ? (
                <p className="text-sm text-gray-500">Pazarlama ayarlarÄ± yÃ¼kleniyor...</p>
              ) : (
                <div className="max-w-4xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">SMTP</p>
                      <p className={`mt-2 text-sm font-medium ${marketingStats?.mailConfigured ? "text-green-700" : "text-red-600"}`}>
                        {marketingStats?.mailConfigured ? "HazÄ±r" : "Eksik"}
                      </p>
                    </div>
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Uygun Sepet</p>
                      <p className="mt-2 text-2xl font-light">{marketingStats?.eligibleUsers ?? 0}</p>
                    </div>
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Son 7 GÃ¼n</p>
                      <p className="mt-2 text-2xl font-light">{marketingStats?.sentLast7Days ?? 0}</p>
                    </div>
                    <div className="bg-white border border-[#E7E2D8] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Son GÃ¶nderim</p>
                      <p className="mt-2 text-sm font-medium text-gray-700">
                        {marketingStats?.lastSentAt ? formatOrderDateTime(marketingStats.lastSentAt) : "-"}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveMarketingSettings}
                    className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium">Sepeti Terk Edenler</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Sadece giriÅŸ yapmÄ±ÅŸ ve sunucuda sepeti kayÄ±tlÄ± kullanÄ±cÄ±lar hedeflenir.
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
                        <label className="block text-sm font-medium mb-1">Bekleme SÃ¼resi</label>
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
                        <p className="mt-1 text-xs text-gray-500">Dakika cinsinden. Ã–rn: 120 = 2 saat.</p>
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
                      <label className="block text-sm font-medium mb-1">BaÅŸlÄ±k</label>
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

                    <div className="border border-[#E7E2D8] rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-medium">Kupon Kodu</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Mail iÃ§indeki butonla sepete dÃ¶nen kullanÄ±cÄ±da kupon otomatik uygulanÄ±r.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={marketingSettings.couponEnabled}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({ ...prev, couponEnabled: e.target.checked }))
                            }
                          />
                          Kupon aktif
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Kupon Kodu</label>
                          <input
                            type="text"
                            maxLength={40}
                            value={marketingSettings.couponCode}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                couponCode: e.target.value.toUpperCase().replace(/\s+/g, ""),
                              }))
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Ä°ndirim Tipi</label>
                          <select
                            value={marketingSettings.couponType}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                couponType: e.target.value === "fixed" ? "fixed" : "percentage",
                              }))
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                          >
                            <option value="percentage">YÃ¼zde</option>
                            <option value="fixed">Sabit Tutar</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            {marketingSettings.couponType === "fixed" ? "Ä°ndirim TutarÄ± (TL)" : "Ä°ndirim OranÄ± (%)"}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={marketingSettings.couponType === "fixed" ? 100000 : 95}
                            value={marketingSettings.couponValue}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                couponValue: Number(e.target.value || 0),
                              }))
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Minimum Sepet TutarÄ±</label>
                          <input
                            type="number"
                            min={0}
                            max={1000000}
                            value={marketingSettings.couponMinimumSubtotal}
                            onChange={(e) =>
                              setMarketingSettings((prev) => ({
                                ...prev,
                                couponMinimumSubtotal: Number(e.target.value || 0),
                              }))
                            }
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-1">Kupon AÃ§Ä±klamasÄ±</label>
                        <input
                          type="text"
                          maxLength={200}
                          value={marketingSettings.couponDescription}
                          onChange={(e) =>
                            setMarketingSettings((prev) => ({
                              ...prev,
                              couponDescription: e.target.value,
                            }))
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    {marketingMessage ? (
                      <p
                        className={`text-sm ${
                          marketingMessage.includes("tamamlandÄ±") || marketingMessage.includes("kaydedildi")
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
                        {isSavingMarketing ? "Kaydediliyor..." : "KampanyayÄ± Kaydet"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRunMarketingCampaign}
                        disabled={isRunningMarketing}
                        className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                      >
                        {isRunningMarketing ? "TaranÄ±yor..." : "Åimdi Tara ve GÃ¶nder"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeSection === "settings" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Ayarlar</h2>
              <p className="text-sm text-gray-500 mb-5">Site genel ayarlarÄ±nÄ± buradan dÃ¼zenleyebilirsiniz.</p>
              {settingsLoading ? (
                <p className="text-sm text-gray-500">Ayarlar yÃ¼kleniyor...</p>
              ) : (
                <div className="max-w-xl space-y-4">
                  <form onSubmit={handleSaveSettings} className="bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Site Ä°smi</label>
                      <input
                        type="text"
                        value={siteNameInput}
                        onChange={(e) => setSiteNameInput(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        maxLength={80}
                      />
                    </div>
                    {settingsMessage ? (
                      <p className={`text-sm ${settingsMessage.includes("gÃ¼ncellendi") ? "text-green-700" : "text-red-600"}`}>
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
                          ÃœrÃ¼nleri Content API ile Merchant Center hesabÄ±na gÃ¶nderir.
                        </p>
                      </div>
                    </div>

                    {merchantLoading ? (
                      <p className="text-sm text-gray-500">Merchant durumu yÃ¼kleniyor...</p>
                    ) : merchantStatus ? (
                      <div className="text-sm space-y-1">
                        <p>
                          Durum:{" "}
                          <span className={merchantStatus.enabled ? "text-green-700" : "text-red-600"}>
                            {merchantStatus.enabled ? "Aktif" : "Pasif"}
                          </span>
                        </p>
                        <p>
                          KonfigÃ¼rasyon:{" "}
                          <span className={merchantStatus.configured ? "text-green-700" : "text-red-600"}>
                            {merchantStatus.configured ? "HazÄ±r" : "Eksik"}
                          </span>
                        </p>
                        <p>Merchant ID: {merchantStatus.accountId || "-"}</p>
                        <p>
                          Ãœlke/Dil/Para: {merchantStatus.targetCountry} / {merchantStatus.contentLanguage} /{" "}
                          {merchantStatus.currency}
                        </p>
                      </div>
                    ) : null}

                    {merchantMessage ? (
                      <p className={`text-sm ${merchantMessage.toLowerCase().includes("tamamlandÄ±") ? "text-green-700" : "text-red-600"}`}>
                        {merchantMessage}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSyncGoogleMerchant}
                      disabled={merchantSyncing || !merchantStatus?.enabled || !merchantStatus?.configured}
                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                    >
                      {merchantSyncing ? "Google'a GÃ¶nderiliyor..." : "ÃœrÃ¼nleri Google Merchant'a GÃ¶nder"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {productEditor && (
        <div className="fixed inset-0 z-[120] bg-black/35 p-4 md:p-8 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[#E7E2D8] rounded-lg bg-[#FAF9F6] p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{isCreatingProduct ? "Yeni ÃœrÃ¼n Ekle" : "ÃœrÃ¼n DÃ¼zenleme"}</h3>
              <button
                type="button"
                onClick={closeProductEditor}
                className="text-sm border border-black px-3 py-1 rounded-full hover:bg-black hover:text-white transition-colors"
              >
                Kapat
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">ÃœrÃ¼n ID</label>
                <input
                  type="text"
                  value={productEditor.id}
                  readOnly={!isCreatingProduct}
                  onChange={(e) =>
                    setProductEditor((prev) => (prev ? { ...prev, id: e.target.value } : prev))
                  }
                  placeholder={isCreatingProduct ? "BoÅŸ bÄ±rakÄ±lÄ±rsa otomatik Ã¼retilir" : ""}
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
                <label className="block text-sm font-medium mb-1">ÃœrÃ¼n AdÄ±</label>
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">ÃœrÃ¼n GÃ¶rselleri</label>
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
                      <img src={image.url} alt="ÃœrÃ¼n gÃ¶rseli" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(image.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-300 flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                        aria-label="GÃ¶rseli sil"
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
                      aria-label="GÃ¶rsel ekle"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">En fazla {MAX_PRODUCT_IMAGES} gÃ¶rsel seÃ§ebilirsiniz.</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">AÃ§Ä±klama</label>
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
                <label className="block text-sm font-medium mb-1">Ã–zellikler</label>
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
                      placeholder="Ã–zellik adÄ±"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={handleAddFeature}
                      className="border border-black text-black px-3 py-2 rounded-lg text-sm hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                    >
                      Ã–zellik Ekle
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {productEditor.features.length === 0 && (
                      <span className="text-xs text-gray-500">HenÃ¼z Ã¶zellik eklenmedi.</span>
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
                          aria-label={`${feature} Ã¶zelliÄŸini kaldÄ±r`}
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
                      placeholder="Renk adÄ±"
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
                      <span className="text-xs text-gray-500">HenÃ¼z renk eklenmedi.</span>
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
                          aria-label={`${color} rengini kaldÄ±r`}
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
                      placeholder="Etiket adÄ± (Ã¶r. Yeni, Ã‡ok Satan)"
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
                      <span className="text-xs text-gray-500">HenÃ¼z etiket eklenmedi.</span>
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
                          aria-label={`${tag} etiketini kaldÄ±r`}
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
                Yeni ÃœrÃ¼n
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productEditor.isBestseller}
                  onChange={(e) =>
                    setProductEditor((prev) => (prev ? { ...prev, isBestseller: e.target.checked } : prev))
                  }
                />
                Ã‡ok Satan
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              {isCreatingProduct
                ? "Yeni Ã¼rÃ¼n bilgilerini girip Kaydet butonuna basÄ±n."
                : "DÃ¼zenleme alanÄ±nda deÄŸiÅŸiklik yapÄ±p Kaydet butonuna basÄ±n."}
            </p>
            {productSaveMessage && (
              <p
                className={`text-sm mt-3 ${
                  productSaveMessage.includes("baÅŸarÄ±yla") ? "text-green-700" : "text-red-600"
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
                onClick={closeProductEditor}
                className="text-sm border border-black px-4 py-2 rounded-full hover:bg-black hover:text-white transition-colors"
              >
                VazgeÃ§
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



