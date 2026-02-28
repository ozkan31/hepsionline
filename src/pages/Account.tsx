import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, LogOut, MapPin, Package, User, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import {
  clearAuthToken,
  deleteAddress,
  fetchCurrentUser,
  getAuthToken,
  loginUser,
  logoutUser,
  registerUser,
  saveAddress,
  updateAddress,
  updateProfile,
} from "@/lib/api";
import { loadTurkeyLocations } from "@/lib/turkiye";
import type { Address } from "@/types";

type AuthMode = "login" | "register";
type ActiveTab = "orders" | "profile" | "addresses" | "wishlist";

const emptyAddressForm: Omit<Address, "id"> = {
  firstName: "",
  lastName: "",
  phone: "",
  street: "",
  province: "",
  district: "",
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

  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [addressForm, setAddressForm] = useState<Omit<Address, "id">>(emptyAddressForm);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressForm, setEditAddressForm] = useState<Omit<Address, "id">>(emptyAddressForm);
  const [locationMap, setLocationMap] = useState<Record<string, string[]>>({});
  const [copiedTrackingOrderId, setCopiedTrackingOrderId] = useState<string | null>(null);

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
    if (state.isAuthenticated) return;
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    if (mode === "register") {
      setAuthMode("register");
    } else if (mode === "login") {
      setAuthMode("login");
    }
  }, [location.search, state.isAuthenticated]);

  const provinceOptions = useMemo(() => Object.keys(locationMap), [locationMap]);
  const addressDistrictOptions = useMemo(
    () => (addressForm.province ? locationMap[addressForm.province] ?? [] : []),
    [locationMap, addressForm.province]
  );
  const editDistrictOptions = useMemo(
    () => (editAddressForm.province ? locationMap[editAddressForm.province] ?? [] : []),
    [locationMap, editAddressForm.province]
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      const user = await registerUser(registerForm);
      dispatch({ type: "SET_USER", payload: user });
      const redirectPath = new URLSearchParams(location.search).get("redirect");
      setRegisterForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      if (redirectPath && redirectPath.startsWith("/")) {
        navigate(redirectPath);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Kay\u0131t ba\u015far\u0131s\u0131z.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      const user = await loginUser(loginForm);
      dispatch({ type: "SET_USER", payload: user });
      const redirectPath = new URLSearchParams(location.search).get("redirect");
      setLoginForm({ email: "", password: "" });
      if (redirectPath && redirectPath.startsWith("/")) {
        navigate(redirectPath);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Giri\u015f ba\u015far\u0131s\u0131z.");
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    dispatch({ type: "SET_USER", payload: null });
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const user = await updateProfile(profileForm);
      dispatch({ type: "SET_USER", payload: user });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Profil g\u00fcncellenemedi.");
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    try {
      const user = await saveAddress(addressForm);
      dispatch({ type: "SET_USER", payload: user });
      setAddressForm(emptyAddressForm);
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
    setEditingAddressId(address.id);
    setEditAddressForm({
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      street: address.street,
      province: address.province,
      district: address.district,
      isDefault: address.isDefault,
    });
  };

  const handleCancelAddressEdit = () => {
    setEditingAddressId(null);
    setEditAddressForm(emptyAddressForm);
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddressId) return;
    setErrorMessage("");
    try {
      const user = await updateAddress(editingAddressId, editAddressForm);
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

  if (!state.isAuthenticated || !state.user) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
        <div className="w-full px-4 md:px-8">
          <h1 className="text-2xl md:text-3xl font-light mb-8">{"Hesab\u0131m"}</h1>

          <div className="max-w-lg mx-auto bg-white rounded-lg p-6 md:p-8">
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setAuthMode("login")}
                className={`flex-1 py-2 rounded-full text-sm ${
                  authMode === "login" ? "bg-black text-white" : "bg-gray-100"
                }`}
              >
                {"Giri\u015f Yap"}
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className={`flex-1 py-2 rounded-full text-sm ${
                  authMode === "register" ? "bg-black text-white" : "bg-gray-100"
                }`}
              >
                {"Kay\u0131t Ol"}
              </button>
            </div>

            {errorMessage && (
              <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{errorMessage}</p>
            )}

            {authMode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">E-posta</label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{"\u015eifre"}</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-full text-sm">
                  {"Giri\u015f Yap"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Ad</label>
                    <input
                      type="text"
                      required
                      value={registerForm.firstName}
                      onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Soyad</label>
                    <input
                      type="text"
                      required
                      value={registerForm.lastName}
                      onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">E-posta</label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{"\u015eifre"}</label>
                  <input
                    type="password"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{"\u015eifre Tekrar"}</label>
                  <input
                    type="password"
                    required
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <button type="submit" className="w-full bg-black text-white py-3 rounded-full text-sm">
                  {"Kay\u0131t Ol"}
                </button>
              </form>
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
                <form onSubmit={handleProfileSave} className="bg-white rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Ad</label>
                      <input
                        type="text"
                        required
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
                      value={profileForm.email}
                      readOnly
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Telefon</label>
                    <input
                      type="tel"
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
                  <form onSubmit={handleAddAddress} className="bg-white rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Ad</label>
                      <input
                        type="text"
                        required
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
                        value={addressForm.lastName}
                        onChange={(e) => setAddressForm({ ...addressForm, lastName: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{"\u0130l"}</label>
                      <select
                        required
                        value={addressForm.province}
                        onChange={(e) =>
                          setAddressForm({ ...addressForm, province: e.target.value, district: "" })
                        }
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
                        onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Telefon</label>
                    <input
                      type="tel"
                      required
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Adres</label>
                    <input
                      type="text"
                      required
                      minLength={10}
                      value={addressForm.street}
                      onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
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
                    {user.addresses.map((address) => (
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
                        <p className="text-sm text-gray-500">{address.street}</p>
                        <p className="text-sm text-gray-500">
                          {address.district} / {address.province}
                        </p>
                        <button
                          onClick={() => handleDeleteAddress(address.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Sil
                        </button>

                        {editingAddressId === address.id && (
                          <form onSubmit={handleUpdateAddress} className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                required
                                value={editAddressForm.firstName}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, firstName: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                placeholder="Ad"
                              />
                              <input
                                type="text"
                                required
                                value={editAddressForm.lastName}
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, lastName: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                                placeholder="Soyad"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <select
                                required
                                value={editAddressForm.province}
                                onChange={(e) =>
                                  setEditAddressForm({
                                    ...editAddressForm,
                                    province: e.target.value,
                                    district: "",
                                  })
                                }
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
                                onChange={(e) => setEditAddressForm({ ...editAddressForm, district: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                              >
                                <option value="">{ "\u0130l\u00e7e se\u00e7in" }</option>
                                {editDistrictOptions.map((district) => (
                                  <option key={district} value={district}>
                                    {district}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="tel"
                              required
                              value={editAddressForm.phone}
                              onChange={(e) => setEditAddressForm({ ...editAddressForm, phone: e.target.value })}
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                              placeholder="Telefon"
                            />
                            <input
                              type="text"
                              required
                              minLength={10}
                              value={editAddressForm.street}
                              onChange={(e) => setEditAddressForm({ ...editAddressForm, street: e.target.value })}
                              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                              placeholder="Adres"
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
                    ))}
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
