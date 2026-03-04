import { Menu, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createAdminProduct,
  adminLogin,
  fetchAdminContactRequests,
  fetchAdminSettings,
  fetchAdminUsers,
  adminValidate,
  fetchAdminOrders,
  fetchAdminProducts,
  updateAdminSettings,
  updateAdminOrderStatus,
  updateAdminProduct,
} from "@/lib/api";
import type { AdminContactRequest, AdminOrder, AdminUserSummary, Product } from "@/types";

const ADMIN_TOKEN_KEY = "parisMoveAdminToken";
type AdminSection = "orders" | "products" | "users" | "contactRequests" | "settings";
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
  "Sürat Kargo",
  "Yurtiçi Kargo",
];

export function Admin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [contactRequests, setContactRequests] = useState<AdminContactRequest[]>([]);
  const [contactRequestsLoading, setContactRequestsLoading] = useState(false);
  const [contactRequestsError, setContactRequestsError] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await adminValidate(token);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
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
        setOrdersError(err instanceof Error ? err.message : "Siparişler alınamadı.");
      } finally {
        setOrdersLoading(false);
      }
    };

    loadOrders();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "products") return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return;

    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError("");
      try {
        const data = await fetchAdminProducts(token);
        setProducts(data);
      } catch (err) {
        setProductsError(err instanceof Error ? err.message : "Ürünler alınamadı.");
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "settings") return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return;

    let mounted = true;
    const loadSettings = async () => {
      setSettingsLoading(true);
      setSettingsMessage("");
      try {
        const data = await fetchAdminSettings(token);
        if (!mounted) return;
        setSiteNameInput(String(data?.siteName ?? ""));
      } catch (err) {
        if (!mounted) return;
        setSettingsMessage(err instanceof Error ? err.message : "Ayarlar alınamadı.");
      } finally {
        if (mounted) setSettingsLoading(false);
      }
    };

    loadSettings();
    return () => {
      mounted = false;
    };
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "users") return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return;

    const loadUsers = async () => {
      setUsersLoading(true);
      setUsersError("");
      try {
        const data = await fetchAdminUsers(token);
        setUsers(data);
      } catch (err) {
        setUsersError(err instanceof Error ? err.message : "Kullanıcılar alınamadı.");
      } finally {
        setUsersLoading(false);
      }
    };

    loadUsers();
  }, [activeSection, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "contactRequests") return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const token = await adminLogin({ email, password });
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      setIsAuthenticated(true);
      setActiveSection("orders");
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
    localStorage.removeItem(ADMIN_TOKEN_KEY);
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
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
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

  const getStatusText = (status: string) => {
    switch (status) {
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

  const clearLocalImagePreviews = (images: Array<{ url: string; isLocal: boolean }>) => {
    images.forEach((image) => {
      if (image.isLocal && image.url.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
    });
  };

  const handleSaveOrderStatus = async (orderId: string) => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
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
      setOrdersError(err instanceof Error ? err.message : "Sipariş durumu güncellenemedi.");
    } finally {
      setStatusSavingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const openProductEditor = (product: Product) => {
    const normalizedFeatures = Array.isArray(product.features)
      ? product.features
      : product.features != null
      ? [String(product.features)]
      : [];
    const normalizedColors = Array.isArray(product.colors)
      ? product.colors
      : product.colors != null
      ? [String(product.colors)]
      : [];

    if (productEditor) {
      clearLocalImagePreviews(productEditor.images);
    }
    setIsCreatingProduct(false);
    setEditingProductId(product.id);
    const existingImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : String(product.image ?? "").trim()
      ? [String(product.image ?? "").trim()]
      : [];
    setProductEditor({
      id: product.id,
      name: String(product.name ?? ""),
      price: String(product.price ?? ""),
      images: existingImages.map((url, index) => ({ id: `existing-${product.id}-${index}`, url, isLocal: false })),
      category: String(product.category ?? ""),
      description: String(product.description ?? ""),
      features: normalizedFeatures,
      colors: normalizedColors,
      tags: Array.isArray(product.tags) ? product.tags : [],
      isNew: Boolean(product.isNew),
      isBestseller: Boolean(product.isBestseller),
    });
    setNewFeatureName("");
    setNewColorName("");
    setNewTagName("");
    setProductSaveMessage("");
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

  const handleImageFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    Promise.all(
      accepted.map(
        (file) =>
          new Promise<{ id: string; url: string; isLocal: boolean }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                url: String(reader.result ?? ""),
                isLocal: true,
              });
            reader.onerror = () => reject(new Error("file_read_failed"));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((selected) => {
        setProductEditor((prev) => (prev ? { ...prev, images: [...prev.images, ...selected] } : prev));
        if (files.length > remaining) {
          setProductSaveMessage(`En fazla ${MAX_PRODUCT_IMAGES} görsel ekleyebilirsiniz.`);
        } else {
          setProductSaveMessage("");
        }
      })
      .catch(() => {
        setProductSaveMessage("Görseller okunamadı.");
      });
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
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return;

    const numericPrice = Number(productEditor.price);
    if (!Number.isFinite(numericPrice)) {
      setProductSaveMessage("Fiyat geçerli bir sayı olmalı.");
      return;
    }
    const primaryImage = productEditor.images.find((image) => image.url.trim().length > 0)?.url?.trim() ?? "";
    if (!primaryImage) {
      setProductSaveMessage("Kaydetmek için en az bir görsel zorunlu.");
      return;
    }

    const features = productEditor.features.map((item) => item.trim()).filter((item) => item.length > 0);
    const colors = productEditor.colors.map((item) => item.trim()).filter((item) => item.length > 0);

    setIsSavingProduct(true);
    setProductSaveMessage("");
    try {
      const payload = {
        id: productEditor.id.trim() || undefined,
        name: productEditor.name.trim(),
        price: numericPrice,
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
      setProductSaveMessage(isCreatingProduct ? "Ürün başarıyla eklendi." : "Ürün başarıyla güncellendi.");
    } catch (err) {
      setProductSaveMessage(
        err instanceof Error ? err.message : isCreatingProduct ? "Ürün eklenemedi." : "Ürün güncellenemedi."
      );
    } finally {
      setIsSavingProduct(false);
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">E-posta</label>
              <input
                type="email"
                required
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>
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
              Siparişler
            </button>
            <button
              onClick={() => handleSectionChange("products")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "products" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              Ürünler
            </button>
            <button
              onClick={() => handleSectionChange("users")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "users" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              Kullanıcılar
            </button>
            <button
              onClick={() => handleSectionChange("contactRequests")}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                activeSection === "contactRequests" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
              }`}
            >
              İletişim Talepleri
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
              Çıkış Yap
            </button>
          </nav>
        </aside>

        <section className="p-6 md:p-8 bg-white">
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
                    onClick={() => handleSectionChange("orders")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "orders" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    Siparişler
                  </button>
                  <button
                    onClick={() => handleSectionChange("products")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "products" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    Ürünler
                  </button>
                  <button
                    onClick={() => handleSectionChange("users")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "users" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    Kullanıcılar
                  </button>
                  <button
                    onClick={() => handleSectionChange("contactRequests")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                      activeSection === "contactRequests" ? "bg-black text-white" : "text-black hover:bg-[#ECE7DC]"
                    }`}
                  >
                    İletişim Talepleri
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
                    Çıkış Yap
                  </button>
                </nav>
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
                                ? `${order.customer.address.street}, ${order.customer.address.district}/${order.customer.address.province}`
                                : "-"}
                            </p>
                            {order.status === "shipped" && order.shippingCompany && (
                              <p>Kargo Firması: {order.shippingCompany}</p>
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
                              <option value="processing">Hazırlanıyor</option>
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
                                  <option value="">Kargo Firması</option>
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
                <h2 className="text-2xl font-light">Ürünler</h2>
                <button
                  type="button"
                  onClick={openCreateProductEditor}
                  className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                >
                  Ekle
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-5">Veritabanındaki ürünler listeleniyor.</p>
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
                    </div>
                    <button
                      type="button"
                      onClick={() => openProductEditor(product)}
                      className="border border-black text-black px-4 py-2 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                    >
                      Düzenle
                    </button>
                  </div>
                ))}
              </div>
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

          {activeSection === "settings" && (
            <div>
              <h2 className="text-2xl font-light mb-2">Ayarlar</h2>
              <p className="text-sm text-gray-500 mb-5">Site genel ayarlarını buradan düzenleyebilirsiniz.</p>
              {settingsLoading ? (
                <p className="text-sm text-gray-500">Ayarlar yükleniyor...</p>
              ) : (
                <form onSubmit={handleSaveSettings} className="max-w-xl bg-white border border-[#E7E2D8] rounded-lg p-4 space-y-3">
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
              )}
            </div>
          )}
        </section>
      </div>
      {productEditor && (
        <div className="fixed inset-0 z-[120] bg-black/35 p-4 md:p-8 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[#E7E2D8] rounded-lg bg-[#FAF9F6] p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{isCreatingProduct ? "Yeni Ürün Ekle" : "Ürün Düzenleme"}</h3>
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
                  value={productEditor.price}
                  onChange={(e) =>
                    setProductEditor((prev) => (prev ? { ...prev, price: e.target.value } : prev))
                  }
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
                      draggable
                      onDragStart={(e) => handleImageDragStart(image.id, e)}
                      onDragOver={(e) => handleImageDragOver(e, image.id)}
                      onDrop={() => handleImageDrop(image.id)}
                      onDragEnd={() => setDraggingImageId(null)}
                      className={`relative aspect-square rounded-lg border overflow-hidden bg-white cursor-grab active:cursor-grabbing transition-all ${
                        draggingImageId === image.id
                          ? "border-transparent opacity-0"
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
                onClick={closeProductEditor}
                className="text-sm border border-black px-4 py-2 rounded-full hover:bg-black hover:text-white transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

