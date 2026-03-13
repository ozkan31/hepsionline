import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, LogOut, MapPin, Package, User, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import {
  checkAuthEmailStatus,
  clearAuthToken,
  deleteAddress,
  fetchCurrentUser,
  getAuthToken,
  loginWithGoogle,
  logoutUser,
  requestPasswordReset,
  resetPassword,
  startAuthFlow,
  validateResetToken,
  saveAddress,
  updateAddress,
  updateProfile,
  verifyAuthFlowCode,
} from "@/lib/api";
import { loadTurkeyLocations } from "@/lib/turkiye";
import type { Address } from "@/types";

type AuthMode = "login" | "forgot" | "reset";
type ActiveTab = "orders" | "profile" | "addresses" | "wishlist";

const emptyAddressForm: Omit<Address, "id"> = {
  firstName: "",
  lastName: "",
  phone: "",
  street: "",
  province: "",
  district: "",
  neighborhood: "",
  isDefault: false,
};

export function Account() {
  const { state, dispatch } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeTab, setActiveTab] = useState<ActiveTab>("orders");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authGender, setAuthGender] = useState<"kadin" | "erkek" | "">("");
  const [authPhone, setAuthPhone] = useState("");
  const [authTermsAccepted, setAuthTermsAccepted] = useState(false);
  const [authEmailExists, setAuthEmailExists] = useState<boolean | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isVerificationCodeSending, setIsVerificationCodeSending] = useState(false);
  const [verificationDigits, setVerificationDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetForm, setResetForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("");
  const [resetTokenStatus, setResetTokenStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [resetTokenError, setResetTokenError] = useState("");

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [addressForm, setAddressForm] = useState<Omit<Address, "id">>(emptyAddressForm);
  const [addressDetail, setAddressDetail] = useState("");
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressForm, setEditAddressForm] = useState<Omit<Address, "id">>(emptyAddressForm);
  const [editAddressDetail, setEditAddressDetail] = useState("");
  const [locationMap, setLocationMap] = useState<Record<string, Record<string, string[]>>>({});
  const [copiedTrackingOrderId, setCopiedTrackingOrderId] = useState<string | null>(null);
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const hasRenderedGoogleButtonRef = useRef(false);
  const verificationInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const addressDistrictSelectRef = useRef<HTMLSelectElement | null>(null);
  const addressNeighborhoodSelectRef = useRef<HTMLSelectElement | null>(null);
  const editDistrictSelectRef = useRef<HTMLSelectElement | null>(null);
  const editNeighborhoodSelectRef = useRef<HTMLSelectElement | null>(null);
  const navigateAfterAuth = () => {
    const redirectPath = new URLSearchParams(location.search).get("redirect");
    if (redirectPath && redirectPath.startsWith("/")) {
      navigate(redirectPath, { replace: true });
      return;
    }
    navigate("/", { replace: true });
  };
  const openNativeSelect = (element: HTMLSelectElement | null) => {
    if (!element) return;
    element.focus();
    const picker = (element as HTMLSelectElement & { showPicker?: () => void }).showPicker;
    if (typeof picker === "function") {
      try {
        picker.call(element);
        return;
      } catch {
        // ignore picker errors and fall back to click
      }
    }
    element.click();
  };
  const normalizeAuthMessage = (message: string) => {
    const fixMojibake = (value: string) =>
      String(value ?? "")
        .replaceAll("Ã¼", "ü")
        .replaceAll("Ãœ", "Ü")
        .replaceAll("Ã¶", "ö")
        .replaceAll("Ã–", "Ö")
        .replaceAll("Ã§", "ç")
        .replaceAll("Ã‡", "Ç")
        .replaceAll("ÄŸ", "ğ")
        .replaceAll("Äž", "Ğ")
        .replaceAll("ÅŸ", "ş")
        .replaceAll("Å", "Ş")
        .replaceAll("Ä±", "ı")
        .replaceAll("Ä°", "İ")
        .replaceAll("â€™", "'")
        .replaceAll("â€œ", "\"")
        .replaceAll("â€", "\"")
        .replaceAll("â€“", "-")
        .replaceAll("Â", "");

    const input = fixMojibake(String(message ?? "").trim());
    if (!input) return "İşlem başarısız.";
    const lower = input.toLowerCase();

    if (lower.includes("google login failed")) return "Google ile giriş başarısız.";
    if (lower.includes("google client id")) return "Google yapılandırması hatalı.";
    if (lower.includes("invalid google account")) return "Geçersiz Google hesabı.";
    if (lower.includes("google email is not verified")) return "Google e-posta hesabı doğrulanmamış.";
    if (lower.includes("token used too early")) return "Cihaz veya sunucu saati geri. Saati senkronize edip tekrar deneyin.";
    if (lower.includes("token used too late") || lower.includes("expired")) return "Google oturum süresi dolmuş. Tekrar deneyin.";
    if (lower.includes("api request failed")) return "İstek sırasında bir hata oluştu.";
    if (lower.includes("required")) return "Zorunlu alanları doldurun.";
    if (lower.includes("invalid")) return "Girilen bilgiler geçersiz.";
    if (lower.includes("failed")) return "İşlem başarısız.";
    return input;
  };
  const normalizeAddressPart = (value: string) => String(value ?? "").trim().replace(/\s+/g, " ");
  const sameAddressPart = (left: string, right: string) =>
    normalizeAddressPart(left).toLocaleLowerCase("tr-TR") ===
    normalizeAddressPart(right).toLocaleLowerCase("tr-TR");
  const splitStreetParts = (street: string) => {
    const input = String(street ?? "");
    const [namePart, ...detailParts] = input.split("|||");
    let addressName = normalizeAddressPart(namePart ?? "");
    let addressDetail = normalizeAddressPart(detailParts.join("|||"));

    if (!addressName && addressDetail) {
      addressName = addressDetail;
      addressDetail = "";
    }
    if (addressName && addressDetail && sameAddressPart(addressName, addressDetail)) {
      addressDetail = "";
    }

    return { addressName, addressDetail };
  };
  const combineStreetParts = (addressName: string, detail: string) => {
    const normalizedName = normalizeAddressPart(addressName);
    const normalizedDetail = normalizeAddressPart(detail);
    if (!normalizedName && !normalizedDetail) return "";
    if (!normalizedName) return normalizedDetail;
    if (!normalizedDetail || sameAddressPart(normalizedName, normalizedDetail)) {
      return normalizedName;
    }
    return `${normalizedName}|||${normalizedDetail}`;
  };

  useEffect(() => {
    const loadSession = async () => {
      const token = getAuthToken();
      if (!token) {
        dispatch({ type: "SET_USER", payload: null });
        setLoading(false);
        return;
      }

      try {
        const user = await fetchCurrentUser();
        dispatch({ type: "SET_USER", payload: user });
      } catch {
        clearAuthToken();
        dispatch({ type: "SET_USER", payload: null });
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [dispatch]);

  useEffect(() => {
    if (!state.user) return;
    setProfileForm({
      firstName: state.user.firstName,
      lastName: state.user.lastName,
      email: state.user.email,
      phone: state.user.phone ?? "",
    });
  }, [state.user]);

  useEffect(() => {
    if (!state.user) return;
    if (state.user.addresses.length === 0) {
      setIsAddressFormOpen(true);
    }
  }, [state.user]);

  useEffect(() => {
    let isMounted = true;
    loadTurkeyLocations()
      .then((data) => {
        if (isMounted) setLocationMap(data);
      })
      .catch(() => {
        if (isMounted) setLocationMap({});
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const token = params.get("token");

    // Reset token should always take precedence, even if mode is missing.
    if (token && (mode === "reset" || mode === null || mode === "")) {
      setAuthMode("reset");
      return;
    }

    if (state.isAuthenticated) return;

    if (mode === "login" || mode === "register") {
      setAuthMode("login");
    }
  }, [location.search, state.isAuthenticated]);

  useEffect(() => {
    if (!state.isAuthenticated || !state.user) return;
    if (location.pathname !== "/giris") return;
    navigateAfterAuth();
  }, [state.isAuthenticated, state.user, location.pathname, location.search]);

  useEffect(() => {
    if (authMode !== "login") {
      hasRenderedGoogleButtonRef.current = false;
    }
  }, [authMode]);

  useEffect(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, [authMode]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "success") {
      setSuccessMessage("Şifreniz başarıyla değiştirildi.");
    }
  }, [location.search]);

  const provinceOptions = useMemo(() => Object.keys(locationMap), [locationMap]);
  const resetTokenFromUrl = useMemo(
    () => new URLSearchParams(location.search).get("token") ?? "",
    [location.search]
  );
  const resetModeFromUrl = useMemo(
    () => new URLSearchParams(location.search).get("mode") ?? "",
    [location.search]
  );
  const shouldEnterResetFlow = useMemo(
    () => Boolean(resetTokenFromUrl) && (resetModeFromUrl === "reset" || resetModeFromUrl === ""),
    [resetTokenFromUrl, resetModeFromUrl]
  );
  const addressDistrictOptions = useMemo(
    () => (addressForm.province ? Object.keys(locationMap[addressForm.province] ?? {}) : []),
    [locationMap, addressForm.province]
  );
  const addressNeighborhoodOptions = useMemo(
    () =>
      addressForm.province && addressForm.district
        ? locationMap[addressForm.province]?.[addressForm.district] ?? []
        : [],
    [locationMap, addressForm.province, addressForm.district]
  );
  const editDistrictOptions = useMemo(
    () => (editAddressForm.province ? Object.keys(locationMap[editAddressForm.province] ?? {}) : []),
    [locationMap, editAddressForm.province]
  );
  const editNeighborhoodOptions = useMemo(
    () =>
      editAddressForm.province && editAddressForm.district
        ? locationMap[editAddressForm.province]?.[editAddressForm.district] ?? []
        : [],
    [locationMap, editAddressForm.province, editAddressForm.district]
  );

  const menuItems = useMemo(
    () => [
      { id: "orders" as const, name: "Sipari\u015flerim", icon: Package },
      { id: "profile" as const, name: "Profilim", icon: User },
      { id: "addresses" as const, name: "Adreslerim", icon: MapPin },
      { id: "wishlist" as const, name: "Favorilerim", icon: Heart },
    ],
    []
  );

  const orders = state.orders;
  const wishlistPreview = state.wishlist.slice(0, 10);
  const parseOrderDate = (value: string) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    const hasTime = normalized.includes("T");
    const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
    const candidate = hasTime && !hasExplicitTimezone ? `${normalized}Z` : normalized;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const aTime = parseOrderDate(a.date)?.getTime() ?? 0;
    const bTime = parseOrderDate(b.date)?.getTime() ?? 0;
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return String(b.id).localeCompare(String(a.id));
  });
  const formatOrderNumber = (id: string) => {
    const digits = String(id ?? "").replace(/\D/g, "");
    if (digits.length >= 10) return digits.slice(-10);
    return digits.padStart(10, "0");
  };

  const formatOrderDate = (value: string) => {
    const parsed = parseOrderDate(value);
    if (!parsed) return value || "-";
    const hasTime = String(value).includes("T") || String(value).includes(" ");
    return hasTime
      ? parsed.toLocaleString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : parsed.toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Teslim Edildi";
      case "shipped":
        return "Kargoya Verildi";
      case "processing":
        return "Haz\u0131rlan\u0131yor";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "shipped":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTrackingUrl = (shippingCompany: string, trackingNo: string) => {
    const no = encodeURIComponent(trackingNo.trim());
    switch (shippingCompany) {
      case "Aras Kargo":
        return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${no}`;
      case "PTT Kargo":
        return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${no}`;
      case "DHL":
        return `https://www.dhl.com/tr-tr/home/tracking.html?tracking-id=${no}&submit=1`;
      case "Sürat Kargo":
        return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${no}`;
      case "Yurtiçi Kargo":
        return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${no}`;
      case "Sen Kargo":
        return `https://www.google.com/search?q=${encodeURIComponent(`Sen Kargo takip ${trackingNo}`)}`;
      default:
        return `https://www.google.com/search?q=${encodeURIComponent(`${shippingCompany} kargo takip ${trackingNo}`)}`;
    }
  };

  const handleCopyTrackingNo = async (orderId: string, trackingNo: string) => {
    try {
      await navigator.clipboard.writeText(trackingNo);
      setCopiedTrackingOrderId(orderId);
      window.setTimeout(() => {
        setCopiedTrackingOrderId((prev) => (prev === orderId ? null : prev));
      }, 1200);
    } catch {
      setErrorMessage("Takip numarası kopyalanamadı.");
    }
  };

  const handleCheckEmailForAuthFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await checkAuthEmailStatus(authEmail);
      setAuthEmailExists(result.exists);
      setAuthPassword("");
      setAuthFirstName("");
      setAuthLastName("");
      setAuthGender("");
      setAuthPhone("");
      setAuthTermsAccepted(false);
      setSuccessMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? normalizeAuthMessage(error.message) : "E-posta kontrol edilemedi.");
    }
  };

  const handleStartUnifiedAuthFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const isRegisterAttempt = authEmailExists === false;
    if (isRegisterAttempt && (!authFirstName.trim() || !authLastName.trim())) {
      setErrorMessage("Ad ve soyad zorunludur.");
      return;
    }
    if (isRegisterAttempt && !authTermsAccepted) {
      setErrorMessage("Devam etmek için Gizlilik Politikası ve Kullanım Koşulları'nı onaylayın.");
      return;
    }

    if (isRegisterAttempt) {
      // Open modal immediately for faster UX while code is being sent in background.
      setIsVerificationModalOpen(true);
      setVerificationDigits(["", "", "", "", "", ""]);
      setIsVerificationCodeSending(true);
    }

    try {
      const result = await startAuthFlow({
        email: authEmail,
        password: authPassword,
        firstName: isRegisterAttempt ? authFirstName.trim() : undefined,
        lastName: isRegisterAttempt ? authLastName.trim() : undefined,
        gender: authEmailExists ? undefined : authGender || undefined,
        phone: isRegisterAttempt ? authPhone.trim() : undefined,
        termsAccepted: isRegisterAttempt ? authTermsAccepted : undefined,
      });

      if (result.mode === "login" && result.user) {
        dispatch({ type: "SET_USER", payload: result.user });
        navigateAfterAuth();
        return;
      }

      if (result.mode === "register" && result.requiresVerification) {
        setIsVerificationCodeSending(false);
        setErrorMessage("");
        setSuccessMessage("Do\u011frulama kodu e-posta adresinize g\u00f6nderildi.");
      }
    } catch (error) {
      if (isRegisterAttempt) {
        setIsVerificationCodeSending(false);
        // Keep verification modal open so the user sees the error in-place.
        setIsVerificationModalOpen(true);
      }
      setErrorMessage(error instanceof Error ? normalizeAuthMessage(error.message) : "İşlem başarısız.");
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage("");
    const normalizedCode = verificationDigits.join("");
    if (normalizedCode.length !== 6) {
      setErrorMessage("L\u00fctfen 6 haneli do\u011frulama kodunu girin.");
      return;
    }
    try {
      const user = await verifyAuthFlowCode({
        email: authEmail,
        code: normalizedCode,
      });
      dispatch({ type: "SET_USER", payload: user });
      setIsVerificationModalOpen(false);
      navigateAfterAuth();
    } catch (error) {
      setErrorMessage(error instanceof Error ? normalizeAuthMessage(error.message) : "Do\u011frulama kodu hatal\u0131.");
    }
  };

  const handleVerificationDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setVerificationDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      verificationInputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerificationDigitKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !verificationDigits[index] && index > 0) {
      verificationInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerificationPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setVerificationDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    verificationInputRefs.current[focusIndex]?.focus();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await requestPasswordReset(forgotEmail);
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? normalizeAuthMessage(error.message) : "Şifre yenileme e-postası gönderilemedi.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const token = resetTokenFromUrl;
    if (!token) {
      setErrorMessage("Şifre yenileme bağlantısı geçersiz.");
      return;
    }
    try {
      await resetPassword({
        token,
        password: resetForm.password,
        confirmPassword: resetForm.confirmPassword,
      });
      setResetForm({ password: "", confirmPassword: "" });
      setAuthMode("login");
      navigate("/giris?mode=login&reset=success", { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? normalizeAuthMessage(error.message) : "Şifre sıfırlama başarısız.");
    }
  };

  useEffect(() => {
    if (!shouldEnterResetFlow) {
      setResetTokenStatus("idle");
      setResetTokenError("");
      return;
    }

    let mounted = true;
    setResetTokenStatus("checking");
    setResetTokenError("");

    validateResetToken(resetTokenFromUrl)
      .then((result) => {
        if (!mounted) return;
        if (result.valid) {
          setResetTokenStatus("valid");
        } else {
          setResetTokenStatus("invalid");
          setResetTokenError(result.message ?? "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş.");
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setResetTokenStatus("invalid");
        setResetTokenError(error instanceof Error ? normalizeAuthMessage(error.message) : "Şifre yenileme bağlantısı doğrulanamadı.");
      });

    return () => {
      mounted = false;
    };
  }, [shouldEnterResetFlow, resetTokenFromUrl]);

  const handleGoogleLogin = async (credential: string) => {
    setErrorMessage("");
    try {
      const user = await loginWithGoogle(credential);
      dispatch({ type: "SET_USER", payload: user });
      navigateAfterAuth();
    } catch (error) {
      setErrorMessage(error instanceof Error ? normalizeAuthMessage(error.message) : "Google ile giriş başarısız.");
    }
  };

  useEffect(() => {
    const canRenderGoogleButton =
      Boolean(googleClientId) &&
      !loading &&
      !state.isAuthenticated &&
      !shouldEnterResetFlow &&
      authMode === "login" &&
      authEmailExists === null;

    if (!canRenderGoogleButton) {
      hasRenderedGoogleButtonRef.current = false;
      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = "";
      }
      return;
    }

    let cancelled = false;

    const initGoogleButton = () => {
      if (cancelled || hasRenderedGoogleButtonRef.current || !googleButtonRef.current) return;
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const credential = String(response?.credential ?? "");
          if (!credential) {
            setErrorMessage("Google kimlik doğrulaması alınamadı.");
            return;
          }
          void handleGoogleLogin(credential);
        },
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 320,
        text: "continue_with",
      });
      hasRenderedGoogleButtonRef.current = true;
    };

    if (window.google?.accounts?.id) {
      initGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector(
      'script[data-google-identity="true"]'
    ) as HTMLScriptElement | null;
    const script =
      existingScript ??
      Object.assign(document.createElement("script"), {
        src: "https://accounts.google.com/gsi/client",
        async: true,
        defer: true,
      });

    if (!existingScript) {
      script.dataset.googleIdentity = "true";
      document.head.appendChild(script);
    }

    script.addEventListener("load", initGoogleButton);
    return () => {
      cancelled = true;
      script.removeEventListener("load", initGoogleButton);
    };
  }, [
    authMode,
    googleClientId,
    navigate,
    location.search,
    state.isAuthenticated,
    dispatch,
    loading,
    shouldEnterResetFlow,
    authEmailExists,
  ]);

  const handleLogout = async () => {
    await logoutUser();
    dispatch({ type: "CLEAR_CART" });
    dispatch({ type: "SET_WISHLIST", payload: [] });
    dispatch({ type: "SET_ORDERS", payload: [] });
    dispatch({ type: "SET_USER", payload: null });
    localStorage.removeItem("parisMoveStore");
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setProfileSuccessMessage("");
    try {
      const user = await updateProfile(profileForm);
      dispatch({ type: "SET_USER", payload: user });
      setProfileSuccessMessage("Profil bilgileriniz başarıyla güncellendi.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Profil g\u00fcncellenemedi.");
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const user = await saveAddress({
        ...addressForm,
        street: combineStreetParts(addressForm.street, addressDetail),
      });
      dispatch({ type: "SET_USER", payload: user });
      setAddressForm(emptyAddressForm);
      setAddressDetail("");
      setIsAddressFormOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Adres kaydedilemedi.");
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    setErrorMessage("");
    try {
      const user = await deleteAddress(addressId);
      dispatch({ type: "SET_USER", payload: user });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Adres silinemedi.");
    }
  };

  const handleStartAddressEdit = (address: Address) => {
    const parsedStreet = splitStreetParts(address.street);
    setEditingAddressId(address.id);
    setEditAddressForm({
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      street: parsedStreet.addressName,
      province: address.province,
      district: address.district,
      neighborhood: address.neighborhood,
      isDefault: address.isDefault,
    });
    setEditAddressDetail(parsedStreet.addressDetail);
  };

  const handleCancelAddressEdit = () => {
    setEditingAddressId(null);
    setEditAddressForm(emptyAddressForm);
    setEditAddressDetail("");
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddressId) return;
    setErrorMessage("");
    try {
      const user = await updateAddress(editingAddressId, {
        ...editAddressForm,
        street: combineStreetParts(editAddressForm.street, editAddressDetail),
      });
      dispatch({ type: "SET_USER", payload: user });
      handleCancelAddressEdit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Adres g\u00fcncellenemedi.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
        <div className="w-full px-4 md:px-8">
          <div className="max-w-5xl mx-auto text-center py-20 text-gray-500">
            {"Y\u00fckleniyor..."}
          </div>
        </div>
      </div>
    );
  }

  if (!state.isAuthenticated || !state.user || authMode === "reset" || shouldEnterResetFlow) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
        <div className="w-full px-4 md:px-8">
          {location.pathname !== "/giris" && (
            <h1 className="text-2xl md:text-3xl font-light mb-8">{"Hesab\u0131m"}</h1>
          )}

          <div className="max-w-lg mx-auto bg-white rounded-lg p-6 md:p-8">

            {errorMessage && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{errorMessage}</p>
            )}
            {successMessage && !isVerificationModalOpen && (
              <p className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded">{successMessage}</p>
            )}

            {shouldEnterResetFlow && resetTokenStatus === "checking" ? (
              <div className="text-sm text-gray-600 py-2">Şifre yenileme bağlantısı kontrol ediliyor...</div>
            ) : shouldEnterResetFlow && resetTokenStatus === "invalid" ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
                  {resetTokenError || "Şifre yenileme bağlantısı geçersiz veya süresi dolmuş."}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/giris?mode=login", { replace: true })}
                  className="w-full bg-black text-white py-3 rounded-full text-sm"
                >
                  Giriş Yap Sayfasına Dön
                </button>
              </div>
            ) : shouldEnterResetFlow && resetTokenStatus === "valid" ? (
              <form onSubmit={handleResetPassword} className="space-y-4" autoComplete="on">
                <p className="text-sm text-gray-600">Yeni şifrenizi belirleyin.</p>
                <div>
                  <label className="block text-sm font-medium mb-2">Yeni Şifre</label>
                  <input
                    type="password"
                    required
                    name="newPassword"
                    autoComplete="new-password"
                    value={resetForm.password}
                    onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Yeni Şifre Tekrar</label>
                  <input
                    type="password"
                    required
                    name="newPasswordConfirm"
                    autoComplete="new-password"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-full text-sm">
                  Şifreyi Güncelle
                </button>
              </form>
            ) : authMode === "forgot" ? (
              <form onSubmit={handleForgotPassword} className="space-y-4" autoComplete="on">
                <p className="text-sm text-gray-600">
                  Şifre yenileme bağlantısını göndermek için e-posta adresinizi girin.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-2">E-posta</label>
                  <input
                    type="email"
                    required
                    name="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-full text-sm">
                  Şifre Yenileme E-postası Gönder
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="w-full border border-gray-200 py-3 rounded-full text-sm hover:border-black transition-colors"
                >
                  Girişe Dön
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">
                  {authEmailExists === null
                    ? "Giri\u015f yap veya kaydol"
                    : authEmailExists
                      ? "Giri\u015f Yap"
                      : "Kay\u0131t Ol"}
                </p>
                {authEmailExists === null ? (
                  <form onSubmit={handleCheckEmailForAuthFlow} className="space-y-4" autoComplete="on">
                    <div>
                      <label className="block text-sm font-medium mb-2">E-posta</label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <button type="submit" className="w-full bg-black text-white py-3 rounded-full text-sm">
                      Devam Et
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleStartUnifiedAuthFlow} className="space-y-4" autoComplete="on">
                    <div>
                      <label className="block text-sm font-medium mb-2">E-posta</label>
                      <input
                        type="email"
                        required
                        name="email"
                        autoComplete="email"
                        value={authEmail}
                        readOnly={authEmailExists === true}
                        onChange={(e) => {
                          if (authEmailExists === false) {
                            setAuthEmail(e.target.value);
                          }
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {authEmailExists ? "Şifre" : "Şifre Oluştur"}
                      </label>
                      <input
                        type="password"
                        required
                        name="password"
                        autoComplete={authEmailExists ? "current-password" : "new-password"}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                    {!authEmailExists && (
                      <div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Ad</label>
                            <input
                              type="text"
                              required
                              name="firstName"
                              autoComplete="given-name"
                              value={authFirstName}
                              onChange={(e) => setAuthFirstName(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Soyad</label>
                            <input
                              type="text"
                              required
                              name="lastName"
                              autoComplete="family-name"
                              value={authLastName}
                              onChange={(e) => setAuthLastName(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                            />
                          </div>
                        </div>
                        <label className="block text-sm font-medium mb-2">
                          Telefon <span className="text-xs text-gray-500 font-normal">(isteğe bağlı)</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          autoComplete="tel"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black mb-4"
                        />
                        <label className="block text-sm font-medium mb-2">
                          Cinsiyet <span className="text-xs text-gray-500 font-normal">(isteğe bağlı)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setAuthGender((prev) => (prev === "kadin" ? "" : "kadin"))}
                            className={`border rounded-lg py-2 text-sm ${
                              authGender === "kadin" ? "border-black bg-black text-white" : "border-gray-200"
                            }`}
                          >
                            Kadın
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthGender((prev) => (prev === "erkek" ? "" : "erkek"))}
                            className={`border rounded-lg py-2 text-sm ${
                              authGender === "erkek" ? "border-black bg-black text-white" : "border-gray-200"
                            }`}
                          >
                            Erkek
                          </button>
                        </div>
                        <label className="flex items-start gap-2 mt-4 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={authTermsAccepted}
                            onChange={(e) => setAuthTermsAccepted(e.target.checked)}
                            required
                            className="mt-1"
                          />
                          <span>
                            <Link to="/gizlilik" className="underline hover:text-black">
                              Gizlilik Politikası
                            </Link>{" "}
                            ve{" "}
                            <Link to="/kullanim-kosullari" className="underline hover:text-black">
                              Kullanım Koşulları
                            </Link>{" "}
                            metinlerini okudum, kabul ediyorum.
                          </span>
                        </label>
                      </div>
                    )}
                    <button type="submit" className="w-full bg-black text-white py-3 rounded-full text-sm">
                      {authEmailExists ? "Giriş Yap" : "Üye Ol"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthEmailExists(null);
                        setAuthPassword("");
                        setAuthFirstName("");
                        setAuthLastName("");
                        setAuthGender("");
                        setAuthPhone("");
                        setAuthTermsAccepted(false);
                        setSuccessMessage("");
                      }}
                      className="w-full border border-gray-200 py-3 rounded-full text-sm hover:border-black transition-colors"
                    >
                      Başka E-posta Kullan
                    </button>
                    {authEmailExists && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(authEmail);
                          setAuthMode("forgot");
                        }}
                        className="w-full text-sm text-gray-600 hover:text-black transition-colors"
                      >
                        Şifremi Unuttum
                      </button>
                    )}
                  </form>
                )}
                {googleClientId && authEmailExists === null && (
                  <div className="pt-2">
                    <div className="relative mb-3">
                      <div className="h-px bg-gray-200" />
                      <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-gray-500">
                        veya
                      </span>
                    </div>
                    <div ref={googleButtonRef} className="flex justify-center" />
                  </div>
                )}
                {isVerificationModalOpen && (
                  <div className="fixed inset-0 z-[90] bg-black/30 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-lg p-6 space-y-4 relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsVerificationModalOpen(false);
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-black hover:text-black transition-colors"
                        aria-label="Kapat"
                      >
                        x
                      </button>
                      <h3 className="text-lg font-medium">{"E-posta Do\u011frulamas\u0131"}</h3>
                      <p className="text-sm text-gray-600">
                        {authEmail} adresine gönderilen doğrulama kodunu girin.
                      </p>
                      {errorMessage && (
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{errorMessage}</p>
                      )}
                      <form onSubmit={handleVerifyEmailCode} className="space-y-4">
                        <div onPaste={handleVerificationPaste}>
                          <label className="block text-sm font-medium mb-2">{"Do\u011frulama Kodu"}</label>
                          <div className="flex items-center justify-center gap-3 py-2">
                            {verificationDigits.map((digit, index) => (
                              <input
                                key={index}
                                ref={(el) => {
                                  verificationInputRefs.current[index] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                disabled={isVerificationCodeSending}
                                value={digit}
                                onChange={(e) => handleVerificationDigitChange(index, e.target.value)}
                                onKeyDown={(e) => handleVerificationDigitKeyDown(index, e)}
                                className="w-8 text-center text-lg bg-transparent border-0 border-b border-gray-300 rounded-none outline-none focus:border-black"
                              />
                            ))}
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={isVerificationCodeSending}
                          className="w-full bg-black text-white py-3 rounded-full text-sm disabled:opacity-60"
                        >
                          {"Do\u011frula"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const user = state.user;

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        <h1 className="text-2xl md:text-3xl font-light mb-8">{"Hesab\u0131m"}</h1>

        {errorMessage && (
          <div className="max-w-5xl mx-auto mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <aside className="hidden lg:block">
            <div className="bg-white rounded-lg p-6 sticky top-24">
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === item.id ? "bg-black text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </button>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {"\u00c7\u0131k\u0131\u015f Yap"}
                </button>
              </nav>
            </div>
          </aside>

          <div className="lg:hidden mb-6">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5" />
                <span className="font-medium">
                  {user.firstName} {user.lastName}
                </span>
              </div>
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${
                      activeTab === item.id ? "bg-black text-white" : "hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </button>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-gray-500 hover:text-black hover:bg-gray-100"
                >
                  <LogOut className="w-5 h-5" />
                  {"\u00c7\u0131k\u0131\u015f Yap"}
                </button>
              </nav>
            </div>
          </div>

          <div className="lg:col-span-3">
            {activeTab === "orders" && (
              <div>
                <h2 className="text-xl font-medium mb-6">{"Sipari\u015flerim"}</h2>
                {sortedOrders.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <p className="text-gray-500">{"Hen\u00fcz sipari\u015finiz yok"}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sortedOrders.map((order) => (
                      <div key={order.id} className="bg-white rounded-lg p-6">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500 mb-1">
                              {"Sipari\u015f No: "} {formatOrderNumber(order.id)}
                            </p>
                            <p className="text-sm text-gray-500">{formatOrderDate(order.date)}</p>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </div>
                        <div className="space-y-3 mb-4">
                          {order.items.map((item) => (
                            <div key={`${order.id}-${item.product.id}-${item.color ?? ""}`} className="flex items-center gap-3">
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className="w-12 h-12 rounded-md object-cover"
                              />
                              <p className="text-sm text-gray-700">{item.product.name}</p>
                            </div>
                          ))}
                        </div>
                        {order.status === "shipped" && (
                          <div className="mb-4 text-sm text-gray-600 space-y-1">
                            {order.shippingCompany ? <p>Kargo Firması: {order.shippingCompany}</p> : null}
                            {order.shippingTrackingNo ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <p>Takip No: {order.shippingTrackingNo}</p>
                                <button
                                  type="button"
                                  onClick={() => handleCopyTrackingNo(order.id, order.shippingTrackingNo || "")}
                                  className={`inline-flex items-center justify-center w-6 h-6 border rounded transition-colors ${
                                    copiedTrackingOrderId === order.id
                                      ? "bg-black text-white border-black"
                                      : "border-gray-300 hover:border-black hover:text-black"
                                  }`}
                                  aria-label="Takip numarasını kopyala"
                                  title={copiedTrackingOrderId === order.id ? "Kopyalandı" : "Kopyala"}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : null}
                            {order.shippingCompany && order.shippingTrackingNo && (
                              <a
                                href={getTrackingUrl(order.shippingCompany, order.shippingTrackingNo)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-xs px-3 py-1 border border-black rounded-full hover:bg-black hover:text-white transition-colors"
                              >
                                Kargo Takip
                              </a>
                            )}
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Toplam</p>
                          <p className="font-medium">{order.total.toLocaleString("tr-TR")} TL</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "profile" && (
              <div>
                <h2 className="text-xl font-medium mb-6">Profil Bilgileri</h2>
                {profileSuccessMessage && (
                  <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
                    {profileSuccessMessage}
                  </div>
                )}
                <form onSubmit={handleProfileSave} className="bg-white rounded-lg p-6 space-y-4" autoComplete="on">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Ad</label>
                      <input
                        type="text"
                        required
                        name="firstName"
                        autoComplete="given-name"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Soyad</label>
                      <input
                        type="text"
                        required
                        name="lastName"
                        autoComplete="family-name"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">E-posta</label>
                    <input
                      type="email"
                      required
                      name="email"
                      autoComplete="email"
                      value={profileForm.email}
                      readOnly
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Telefon</label>
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>
                  <button type="submit" className="bg-black text-white px-6 py-2 rounded-full text-sm">
                    Kaydet
                  </button>
                </form>
              </div>
            )}

            {activeTab === "addresses" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium">Adreslerim</h2>
                  <button
                    type="button"
                    onClick={() => setIsAddressFormOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-sm"
                  >
                    Adres Ekle
                    {isAddressFormOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isAddressFormOpen && (
                  <form onSubmit={handleAddAddress} className="bg-white rounded-lg p-6 space-y-4" autoComplete="on">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Ad</label>
                      <input
                        type="text"
                        required
                        name="addressFirstName"
                        autoComplete="given-name"
                        value={addressForm.firstName}
                        onChange={(e) => setAddressForm({ ...addressForm, firstName: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Soyad</label>
                      <input
                        type="text"
                        required
                        name="addressLastName"
                        autoComplete="family-name"
                        value={addressForm.lastName}
                        onChange={(e) => setAddressForm({ ...addressForm, lastName: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">{"\u0130l"}</label>
                      <select
                        required
                        value={addressForm.province}
                        onChange={(e) => {
                          setAddressForm({
                            ...addressForm,
                            province: e.target.value,
                            district: "",
                            neighborhood: "",
                          });
                          window.setTimeout(() => openNativeSelect(addressDistrictSelectRef.current), 0);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      >
                        <option value="">{ "\u0130l se\u00e7in" }</option>
                        {provinceOptions.map((province) => (
                          <option key={province} value={province}>
                            {province}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">{"\u0130l\u00e7e"}</label>
                      <select
                        required
                        disabled={!addressForm.province}
                        value={addressForm.district}
                        onChange={(e) => {
                          setAddressForm({ ...addressForm, district: e.target.value, neighborhood: "" });
                          window.setTimeout(() => openNativeSelect(addressNeighborhoodSelectRef.current), 0);
                        }}
                        ref={addressDistrictSelectRef}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">{ "\u0130l\u00e7e se\u00e7in" }</option>
                        {addressDistrictOptions.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Mahalle</label>
                      <select
                        required
                        disabled={!addressForm.district}
                        value={addressForm.neighborhood}
                        onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                        ref={addressNeighborhoodSelectRef}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="">Mahalle seçin</option>
                        {addressNeighborhoodOptions.map((neighborhood) => (
                          <option key={neighborhood} value={neighborhood}>
                            {neighborhood}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Telefon</label>
                      <input
                        type="tel"
                        required
                        name="addressPhone"
                        autoComplete="tel"
                        value={addressForm.phone}
                        onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Adres İsmi</label>
                      <input
                        type="text"
                        required
                        name="addressLabel"
                        autoComplete="address-line1"
                        value={addressForm.street}
                        onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                        placeholder="örn. ev adresim, iş adresim"
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Adres Detayı</label>
                    <textarea
                      required
                      minLength={10}
                      name="streetAddress"
                      autoComplete="street-address"
                      value={addressDetail}
                      onChange={(e) => setAddressDetail(e.target.value)}
                      rows={4}
                      className="w-full resize-none bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                    />
                    {"Varsay\u0131lan adres yap"}
                  </label>
                  <button type="submit" className="bg-black text-white px-6 py-2 rounded-full text-sm">
                    Adres Ekle
                  </button>
                  </form>
                )}

                {user.addresses.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-lg">
                    <p className="text-gray-500">{"Kay\u0131tl\u0131 adresiniz yok"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.addresses.map((address) => {
                      const parsedStreet = splitStreetParts(address.street);
                      return (
                      <div key={address.id} className="bg-white rounded-lg p-6">
                        <div className="flex items-center justify-between mb-3">
                          {address.isDefault ? (
                            <span className="bg-black text-white text-xs px-3 py-1 rounded-full inline-block">
                              {"Varsay\u0131lan"}
                            </span>
                          ) : (
                            <span />
                          )}
                          <button
                            onClick={() => handleStartAddressEdit(address)}
                            className="border border-black text-black bg-white px-3 py-1 rounded-full text-xs hover:bg-black hover:text-white transition-colors"
                          >
                            {"D\u00fczenle"}
                          </button>
                        </div>
                        <p className="font-medium">
                          {address.firstName} {address.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{address.phone}</p>
                        <p className="text-sm text-gray-500">{parsedStreet.addressName}</p>
                        {parsedStreet.addressDetail ? (
                          <p className="text-sm text-gray-500">{parsedStreet.addressDetail}</p>
                        ) : null}
                        <p className="text-sm text-gray-500">
                          {address.neighborhood}, {address.district} / {address.province}
                        </p>
                        <button
                          onClick={() => handleDeleteAddress(address.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Sil
                        </button>

                        {editingAddressId === address.id && (
                          <form onSubmit={handleUpdateAddress} className="mt-4 pt-4 border-t border-gray-200 space-y-3" autoComplete="on">
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                required
                                name="editAddressFirstName"
                                autoComplete="given-name"
                                value={editAddressForm.firstName}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, firstName: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                placeholder="Ad"
                              />
                              <input
                                type="text"
                                required
                                name="editAddressLastName"
                                autoComplete="family-name"
                                value={editAddressForm.lastName}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, lastName: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                placeholder="Soyad"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <select
                                required
                                value={editAddressForm.province}
                                onChange={(e) => {
                                  setEditAddressForm({
                                    ...editAddressForm,
                                    province: e.target.value,
                                    district: "",
                                    neighborhood: "",
                                  });
                                  window.setTimeout(() => openNativeSelect(editDistrictSelectRef.current), 0);
                                }}
                                ref={editDistrictSelectRef}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                              >
                                <option value="">{ "\u0130l se\u00e7in" }</option>
                                {provinceOptions.map((province) => (
                                  <option key={province} value={province}>
                                    {province}
                                  </option>
                                ))}
                              </select>
                              <select
                                required
                                disabled={!editAddressForm.province}
                                value={editAddressForm.district}
                                onChange={(e) => {
                                  setEditAddressForm({
                                    ...editAddressForm,
                                    district: e.target.value,
                                    neighborhood: "",
                                  });
                                  window.setTimeout(() => openNativeSelect(editNeighborhoodSelectRef.current), 0);
                                }}
                                ref={editNeighborhoodSelectRef}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                              >
                                <option value="">{ "\u0130l\u00e7e se\u00e7in" }</option>
                                {editDistrictOptions.map((district) => (
                                  <option key={district} value={district}>
                                    {district}
                                  </option>
                                ))}
                              </select>
                              <select
                                required
                                disabled={!editAddressForm.district}
                                value={editAddressForm.neighborhood}
                                onChange={(e) =>
                                  setEditAddressForm({ ...editAddressForm, neighborhood: e.target.value })
                                }
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                              >
                                <option value="">Mahalle seçin</option>
                                {editNeighborhoodOptions.map((neighborhood) => (
                                  <option key={neighborhood} value={neighborhood}>
                                    {neighborhood}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="tel"
                                required
                                name="editAddressPhone"
                                autoComplete="tel"
                                value={editAddressForm.phone}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, phone: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                placeholder="Telefon"
                              />
                              <input
                                type="text"
                                required
                                name="editAddressLabel"
                                autoComplete="address-line1"
                                value={editAddressForm.street}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, street: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                placeholder="örn. ev adresim, iş adresim"
                              />
                            </div>
                            <textarea
                              required
                              minLength={10}
                              name="editStreetAddress"
                              autoComplete="street-address"
                              value={editAddressDetail}
                              onChange={(e) => setEditAddressDetail(e.target.value)}
                              onInvalid={(e) => {
                                e.currentTarget.setCustomValidity("Adres detayı en az 10 karakter olmalıdır.");
                              }}
                              onInput={(e) => {
                                e.currentTarget.setCustomValidity("");
                              }}
                              rows={4}
                              className="w-full resize-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                              placeholder="Adres Detayı"
                            />
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editAddressForm.isDefault}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, isDefault: e.target.checked })}
                              />
                              {"Varsay\u0131lan adres yap"}
                            </label>
                            <div className="flex items-center gap-3">
                              <button type="submit" className="bg-black text-white px-4 py-2 rounded-full text-sm">
                                {"Kaydet"}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelAddressEdit}
                                className="text-sm text-gray-600 hover:underline"
                              >
                                {"\u0130ptal"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}

            {activeTab === "wishlist" && (
              <div>
                <h2 className="text-xl font-medium mb-6">Favorilerim</h2>
                {wishlistPreview.length === 0 ? (
                  <div className="bg-white rounded-lg p-6">
                    <p className="text-sm text-gray-500 mb-3">Henüz favori ürününüz yok.</p>
                    <Link to="/shop" className="text-sm text-black hover:underline">
                      Ürünleri Keşfet
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {wishlistPreview.map((product) => (
                        <Link
                          key={product.id}
                          to={`/product/${product.id}`}
                          className="bg-white rounded-lg p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        >
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-14 h-14 rounded-md object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.price.toLocaleString("tr-TR")} TL</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <Link to="/favoriler" className="inline-block text-sm text-black hover:underline">
                      {"T\u00fcm favorileri g\u00f6r"}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}






