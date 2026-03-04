import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Truck } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { createOrder, createPaytrIframe, saveAddress } from "@/lib/api";
import { loadTurkeyLocations } from "@/lib/turkiye";
import type { Order } from "@/types";

export function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, cartTotal, dispatch } = useStore();
  const [step, setStep] = useState<"shipping" | "payment" | "confirmation">("shipping");
  const [selectedAddressId, setSelectedAddressId] = useState(
    state.user?.addresses?.[0]?.id ?? ""
  );
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [distanceSaleAccepted, setDistanceSaleAccepted] = useState(false);
  const [isDistanceSaleModalOpen, setIsDistanceSaleModalOpen] = useState(false);
  const [newAddressDetail, setNewAddressDetail] = useState("");
  const [locationMap, setLocationMap] = useState<Record<string, Record<string, string[]>>>({});
  const [paytrIframeUrl, setPaytrIframeUrl] = useState("");
  const [isPaytrLoading, setIsPaytrLoading] = useState(false);
  const [paytrError, setPaytrError] = useState("");
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const processedPathRef = useRef<string>("");
  const newAddressDistrictSelectRef = useRef<HTMLSelectElement | null>(null);
  const newAddressNeighborhoodSelectRef = useRef<HTMLSelectElement | null>(null);

  const generateOrderId = () =>
    String(Math.floor(1000000000 + Math.random() * 9000000000));
  const splitStreetParts = (street: string) => {
    const input = String(street ?? "");
    const [namePart, ...detailParts] = input.split("|||");
    return {
      addressName: (namePart ?? "").trim(),
      addressDetail: detailParts.join("|||").trim(),
    };
  };
  const combineStreetParts = (addressName: string, detail: string) =>
    `${String(addressName ?? "").trim()}|||${String(detail ?? "").trim()}`;
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

  const shippingCost = cartTotal >= 1500 ? 0 : 79;
  const total = cartTotal + shippingCost;

  const [shippingInfo, setShippingInfo] = useState({
    firstName: "",
    lastName: "",
    email: state.user?.email ?? "",
    phone: state.user?.phone ?? "",
    street: "",
    province: "",
    district: "",
    neighborhood: "",
  });

  const [newAddressForm, setNewAddressForm] = useState({
    firstName: state.user?.firstName ?? "",
    lastName: state.user?.lastName ?? "",
    phone: state.user?.phone ?? "",
    street: "",
    province: "",
    district: "",
    neighborhood: "",
    isDefault: false,
  });

  const savedAddresses = state.user?.addresses ?? [];
  const hasSavedAddresses = savedAddresses.length > 0;

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

  const provinceOptions = useMemo(() => Object.keys(locationMap), [locationMap]);
  const newAddressDistrictOptions = useMemo(
    () => (newAddressForm.province ? Object.keys(locationMap[newAddressForm.province] ?? {}) : []),
    [locationMap, newAddressForm.province]
  );
  const newAddressNeighborhoodOptions = useMemo(
    () =>
      newAddressForm.province && newAddressForm.district
        ? locationMap[newAddressForm.province]?.[newAddressForm.district] ?? []
        : [],
    [locationMap, newAddressForm.province, newAddressForm.district]
  );

  useEffect(() => {
    if (hasSavedAddresses && !selectedAddressId) {
      setSelectedAddressId(savedAddresses[0].id);
    }
  }, [hasSavedAddresses, savedAddresses, selectedAddressId]);

  useEffect(() => {
    if (state.isAuthenticated && !hasSavedAddresses) {
      setIsAddressFormOpen(true);
    }
  }, [hasSavedAddresses, state.isAuthenticated]);

  const selectedAddress = useMemo(
    () => savedAddresses.find((addr) => addr.id === selectedAddressId) ?? null,
    [savedAddresses, selectedAddressId]
  );

  const isPaymentSuccessPath = location.pathname === "/odeme/basarili";
  const isPaymentFailPath = location.pathname === "/odeme/basarisiz";

  useEffect(() => {
    if (isPaymentSuccessPath) {
      if (processedPathRef.current === `success:${location.pathname}`) return;

      // Wait for persisted store hydration after external PAYTR redirect.
      if (state.cart.length === 0 && state.orders.length === 0) return;

      if (state.cart.length > 0) {
        const orderDraft = {
          id: generateOrderId(),
          date: new Date().toISOString().split("T")[0],
          items: [...state.cart],
          total,
          status: "processing" as const,
          shippingAddress: {
            firstName: shippingInfo.firstName,
            lastName: shippingInfo.lastName,
            phone: shippingInfo.phone,
            street: shippingInfo.street,
            province: shippingInfo.province,
            district: shippingInfo.district,
            neighborhood: shippingInfo.neighborhood,
          },
        };
        createOrder(orderDraft)
          .then((createdOrder) => {
            dispatch({ type: "ADD_ORDER", payload: createdOrder });
            setCompletedOrder(createdOrder);
            dispatch({ type: "CLEAR_CART" });
          })
          .catch(() => {
            // Fallback keeps UX working even if API fails.
            dispatch({ type: "ADD_ORDER", payload: orderDraft });
            setCompletedOrder(orderDraft);
            dispatch({ type: "CLEAR_CART" });
          });
      } else if (state.orders.length > 0) {
        setCompletedOrder(state.orders[state.orders.length - 1]);
      }

      setStep("confirmation");
      setPaytrError("");
      setPaytrIframeUrl("");
      processedPathRef.current = `success:${location.pathname}`;
      return;
    }

    if (isPaymentFailPath) {
      if (processedPathRef.current === `fail:${location.pathname}`) return;
      setStep("payment");
      setPaytrError("Ödeme başarısız veya iptal edildi. Lütfen tekrar deneyin.");
      processedPathRef.current = `fail:${location.pathname}`;
      return;
    }

    processedPathRef.current = "";
  }, [dispatch, isPaymentFailPath, isPaymentSuccessPath, location.pathname, state.cart, state.orders, total]);

  if (state.cart.length === 0 && !isPaymentSuccessPath && step !== "confirmation") {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-500 mb-4">{"Sepetiniz bo\u015f"}</p>
          <button
            onClick={() => navigate("/shop")}
            className="bg-black text-white px-6 py-2 rounded-full"
          >
            {"Al\u0131\u015fveri\u015fe Ba\u015fla"}
          </button>
        </div>
      </div>
    );
  }

  const handleSavedAddressContinue = () => {
    if (!selectedAddress) return;
    if (!distanceSaleAccepted) {
      setAddressError("Ödemeye geçmek için Mesafeli Satış Sözleşmesi'ni onaylamalısınız.");
      return;
    }
    const parsedStreet = splitStreetParts(selectedAddress.street);
    setShippingInfo({
      firstName: selectedAddress.firstName,
      lastName: selectedAddress.lastName,
      email: state.user?.email ?? "",
      phone: selectedAddress.phone || state.user?.phone || "",
      street: parsedStreet.addressDetail || parsedStreet.addressName,
      province: selectedAddress.province,
      district: selectedAddress.district,
      neighborhood: selectedAddress.neighborhood,
    });
    setStep("payment");
    window.scrollTo(0, 0);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError("");
    setIsSavingAddress(true);
    try {
      const previousIds = new Set((state.user?.addresses ?? []).map((a) => a.id));
      const updatedUser = await saveAddress({
        ...newAddressForm,
        street: combineStreetParts(newAddressForm.street, newAddressDetail),
      });
      dispatch({ type: "SET_USER", payload: updatedUser });

      const addedAddress = updatedUser.addresses.find((a) => !previousIds.has(a.id));
      if (addedAddress) {
        setSelectedAddressId(addedAddress.id);
      } else if (updatedUser.addresses.length > 0) {
        setSelectedAddressId(updatedUser.addresses[0].id);
      }

      setNewAddressForm({
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone ?? "",
        street: "",
        province: "",
        district: "",
        neighborhood: "",
        isDefault: false,
      });
      setNewAddressDetail("");
      setIsAddressFormOpen(false);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Adres eklenemedi.");
    } finally {
      setIsSavingAddress(false);
    }
  };

  useEffect(() => {
    if (step !== "payment" || isPaymentSuccessPath || isPaymentFailPath) return;
    if (
      !shippingInfo.email ||
      !shippingInfo.phone ||
      !shippingInfo.street ||
      !shippingInfo.province ||
      !shippingInfo.district ||
      !shippingInfo.neighborhood
    ) {
      setPaytrError("Teslimat bilgileri eksik.");
      setPaytrIframeUrl("");
      return;
    }

    let isMounted = true;
    setIsPaytrLoading(true);
    setPaytrError("");
    setPaytrIframeUrl("");

    createPaytrIframe({
      email: shippingInfo.email,
      firstName: shippingInfo.firstName,
      lastName: shippingInfo.lastName,
      phone: shippingInfo.phone,
      street: shippingInfo.street,
      province: shippingInfo.province,
      district: shippingInfo.district,
      total,
      items: state.cart.map((item) => ({
        name: item.product.name,
        unitPrice: item.product.price,
        quantity: item.quantity,
      })),
    })
      .then((data) => {
        if (!isMounted) return;
        setPaytrIframeUrl(data.iframeUrl);
      })
      .catch((error) => {
        if (!isMounted) return;
        setPaytrError(error instanceof Error ? error.message : "PAYTR başlatılamadı.");
      })
      .finally(() => {
        if (isMounted) setIsPaytrLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isPaymentFailPath, isPaymentSuccessPath, step, shippingInfo, state.cart, total]);

  const confirmationEmail = shippingInfo.email || state.user?.email || "";

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-2xl mx-auto mb-10">
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === "shipping" ? "text-black" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  step === "shipping" ? "bg-black text-white" : "bg-gray-200"
                }`}
              >
                {step !== "shipping" ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <span className="text-sm font-medium hidden sm:block">Teslimat</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 ${step === "payment" ? "text-black" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  step === "payment" ? "bg-black text-white" : step === "confirmation" ? "bg-gray-200" : "bg-gray-200"
                }`}
              >
                {step === "confirmation" ? <Check className="w-4 h-4" /> : "2"}
              </div>
              <span className="text-sm font-medium hidden sm:block">{"\u00d6deme"}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <div className={`flex items-center gap-2 ${step === "confirmation" ? "text-black" : "text-gray-400"}`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  step === "confirmation" ? "bg-black text-white" : "bg-gray-200"
                }`}
              >
                3
              </div>
              <span className="text-sm font-medium hidden sm:block">Onay</span>
            </div>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 ${step === "confirmation" ? "lg:grid-cols-1" : "lg:grid-cols-2"} gap-8 lg:gap-12 max-w-5xl mx-auto`}
        >
          <div>
            {step === "shipping" && (
              <div>
                <h2 className="text-xl md:text-2xl font-light mb-6">Teslimat Bilgileri</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-500">
                      {"Kay\u0131tl\u0131 adreslerinizden birini se\u00e7in."}
                    </p>
                    {state.isAuthenticated ? (
                      <button
                        type="button"
                        onClick={() => setIsAddressFormOpen((prev) => !prev)}
                        className="text-sm px-4 py-2 rounded-full border border-black hover:bg-black hover:text-white transition-colors"
                      >
                        Adres Ekle
                      </button>
                    ) : null}
                  </div>

                  {addressError && (
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{addressError}</p>
                  )}

                  {!state.isAuthenticated && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-600 space-y-3">
                      <p>Adres eklemek ve siparişe devam etmek için giriş yapmalısınız.</p>
                      <button
                        type="button"
                        onClick={() => navigate("/giris?redirect=/odeme")}
                        className="bg-black text-white px-5 py-2 rounded-full text-sm"
                      >
                        Giriş Yap / Kayıt Ol
                      </button>
                    </div>
                  )}

                  {state.isAuthenticated && isAddressFormOpen && (
                    <form onSubmit={handleAddAddress} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Ad"
                          value={newAddressForm.firstName}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, firstName: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Soyad"
                          value={newAddressForm.lastName}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, lastName: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                          required
                          value={newAddressForm.province}
                          onChange={(e) => {
                            setNewAddressForm({
                              ...newAddressForm,
                              province: e.target.value,
                              district: "",
                              neighborhood: "",
                            });
                            window.setTimeout(() => openNativeSelect(newAddressDistrictSelectRef.current), 0);
                          }}
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
                          disabled={!newAddressForm.province}
                          value={newAddressForm.district}
                          onChange={(e) => {
                            setNewAddressForm({ ...newAddressForm, district: e.target.value, neighborhood: "" });
                            window.setTimeout(() => openNativeSelect(newAddressNeighborhoodSelectRef.current), 0);
                          }}
                          ref={newAddressDistrictSelectRef}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value="">{ "\u0130l\u00e7e se\u00e7in" }</option>
                          {newAddressDistrictOptions.map((district) => (
                            <option key={district} value={district}>
                              {district}
                            </option>
                          ))}
                        </select>
                        <select
                          required
                          disabled={!newAddressForm.district}
                          value={newAddressForm.neighborhood}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, neighborhood: e.target.value })}
                          ref={newAddressNeighborhoodSelectRef}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value="">Mahalle seçin</option>
                          {newAddressNeighborhoodOptions.map((neighborhood) => (
                            <option key={neighborhood} value={neighborhood}>
                              {neighborhood}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="tel"
                          required
                          placeholder="Telefon"
                          value={newAddressForm.phone}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, phone: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                        <input
                          type="text"
                          required
                          placeholder="örn. ev adresim, iş adresim"
                          value={newAddressForm.street}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, street: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>
                      <textarea
                        required
                        minLength={10}
                        placeholder="Adres Detayı"
                        value={newAddressDetail}
                        onChange={(e) => setNewAddressDetail(e.target.value)}
                        onInvalid={(e) => {
                          e.currentTarget.setCustomValidity("Adres detayı en az 10 karakter olmalıdır.");
                        }}
                        onInput={(e) => {
                          e.currentTarget.setCustomValidity("");
                        }}
                        rows={4}
                        className="w-full resize-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newAddressForm.isDefault}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, isDefault: e.target.checked })}
                        />
                        {"Varsay\u0131lan adres yap"}
                      </label>
                      <button
                        type="submit"
                        disabled={isSavingAddress}
                        className="bg-black text-white px-5 py-2 rounded-full text-sm disabled:opacity-50"
                      >
                        {isSavingAddress ? "Kaydediliyor..." : "Adresi Kaydet"}
                      </button>
                    </form>
                  )}

                  <div className="space-y-3">
                    {savedAddresses.map((address) => {
                      const parsedStreet = splitStreetParts(address.street);
                      return (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => setSelectedAddressId(address.id)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedAddressId === address.id
                            ? "border-black bg-[#F8F7F4] text-black"
                            : "border-gray-200 bg-white hover:border-gray-400"
                        }`}
                      >
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
                      </button>
                    )})}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={distanceSaleAccepted}
                        onChange={(e) => {
                          setDistanceSaleAccepted(e.target.checked);
                          if (e.target.checked) {
                            setAddressError("");
                          }
                        }}
                        className="mt-1"
                      />
                      <span>
                        <button
                          type="button"
                          onClick={() => setIsDistanceSaleModalOpen(true)}
                          className="underline hover:text-black"
                        >
                          Mesafeli Satış Sözleşmesi
                        </button>{" "}
                        metnini okudum, onaylıyorum.
                      </span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleSavedAddressContinue}
                    disabled={!state.isAuthenticated || !selectedAddressId || !distanceSaleAccepted}
                    className="w-full bg-black text-white py-4 rounded-full font-medium text-sm hover:bg-gray-800 mt-6 disabled:opacity-50"
                  >
                    {"\u00d6demeye Ge\u00e7"}
                  </button>
                </div>
              </div>
            )}

            {isDistanceSaleModalOpen && (
              <div
                className="fixed inset-0 z-[110] bg-black/40 p-4 flex items-center justify-center"
                onClick={() => setIsDistanceSaleModalOpen(false)}
              >
                <div
                  className="w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-lg border border-gray-200 p-5 md:p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Mesafeli Satış Sözleşmesi</h3>
                    <button
                      type="button"
                      onClick={() => setIsDistanceSaleModalOpen(false)}
                      className="border border-black text-black px-3 py-1 rounded-full text-sm hover:bg-black hover:text-white transition-colors"
                    >
                      Kapat
                    </button>
                  </div>
                  <div className="space-y-4 text-sm text-gray-700 leading-6">
                    <p><strong>MESAFELİ SATIŞ SÖZLEŞMESİ</strong></p>
                    <p>
                      <strong>1. Taraflar</strong><br />
                      İşbu Mesafeli Satış Sözleşmesi (“Sözleşme”), www.stilbagsfashion.com internet sitesi üzerinden satış yapan
                      StilBags&amp;fashion ile site üzerinden ürün satın alan ALICI arasında elektronik ortamda kurulmuştur.
                      ALICI, sipariş oluşturduğu anda işbu sözleşmenin tüm şartlarını okuduğunu, anladığını ve kabul ettiğini beyan eder.
                    </p>
                    <p>
                      <strong>2. Konu</strong><br />
                      Bu sözleşmenin konusu, ALICI’nın SATICI’ya ait www.stilbagsfashion.com internet sitesi üzerinden elektronik ortamda
                      sipariş verdiği ürünlerin satışı ve teslimine ilişkin tarafların hak ve yükümlülüklerinin belirlenmesidir.
                    </p>
                    <p>
                      <strong>3. Ürün Bilgileri</strong><br />
                      Satışı yapılan ürünler başlıca aşağıdaki kategorilerden oluşmaktadır: Kadın çantaları, cüzdanlar, moda aksesuarları,
                      çanta ve aksesuar kategorisine ait diğer ürünler. Ürünlerin temel özellikleri, satış fiyatı ve kampanyalar ürün
                      sayfasında belirtildiği şekilde geçerlidir. Tüm fiyatlara KDV dahildir.
                    </p>
                    <p>
                      <strong>4. Ödeme Yöntemi</strong><br />
                      Ödemeler PayTR ödeme altyapısı aracılığıyla kredi kartı ve banka kartı ile yapılmaktadır.
                      ALICI, ödeme işlemini tamamladığında sipariş kesinleşmiş sayılır.
                    </p>
                    <p>
                      <strong>5. Teslimat ve Kargo</strong><br />
                      Sipariş edilen ürünler Türkiye genelinde gönderilmektedir. Siparişler 1-3 iş günü içinde kargoya verilir.
                      Teslimatlar anlaşmalı kargo firmaları aracılığıyla yapılmaktadır. Kargo süresi teslimat adresine bağlı olarak
                      değişiklik gösterebilir. SATICI, mücbir sebepler veya lojistik gecikmelerden kaynaklı teslimat süresi değişikliklerinde
                      sorumlu tutulamaz.
                    </p>
                    <p>
                      <strong>6. Fatura</strong><br />
                      Satın alınan ürünler için e-Arşiv fatura düzenlenir. Fatura, sipariş sırasında belirtilen e-posta adresine dijital
                      olarak gönderilir.
                    </p>
                    <p>
                      <strong>7. Cayma Hakkı</strong><br />
                      ALICI, satın aldığı ürünü teslim aldığı tarihten itibaren 14 gün içinde cayma hakkını kullanabilir. Cayma hakkının
                      kullanılabilmesi için ürünün kullanılmamış olması, tekrar satılabilir durumda olması ve orijinal ambalajının zarar
                      görmemiş olması gerekmektedir.
                    </p>
                    <p>
                      <strong>8. İade ve Değişim</strong><br />
                      ALICI, cayma hakkını kullandığında ürün iadesi gerçekleştirebilir. İade kargo ücreti ALICI tarafından karşılanır.
                      İade edilen ürünler kontrol edildikten sonra ücret iadesi yapılır. Ürünlerde değişim işlemi yapılabilmektedir.
                    </p>
                    <p>
                      <strong>9. Genel Hükümler</strong><br />
                      ALICI, www.stilbagsfashion.com internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı, ödeme ve
                      teslimat bilgileri hakkında bilgi sahibi olduğunu ve elektronik ortamda gerekli onayı verdiğini kabul eder. Taraflar,
                      işbu sözleşmeden doğabilecek uyuşmazlıklarda Türkiye Cumhuriyeti yasalarının geçerli olduğunu kabul eder.
                    </p>
                    <p>
                      <strong>10. Yürürlük</strong><br />
                      ALICI, www.stilbagsfashion.com üzerinden sipariş verdiğinde işbu sözleşmenin tüm şartlarını kabul etmiş sayılır.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === "payment" && (
              <div>
                <div className="space-y-4">
                  {isPaytrLoading && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
                      {"PAYTR ödeme ekranı hazırlanıyor..."}
                    </div>
                  )}

                  {paytrError && (
                    <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-4 text-sm">
                      {paytrError}
                    </div>
                  )}

                  {paytrIframeUrl && (
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <iframe
                        title="PAYTR Ödeme"
                        src={paytrIframeUrl}
                        className="w-full max-w-[420px] h-[520px] mx-auto rounded-md"
                        frameBorder={0}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setStep("shipping")}
                    className="w-full border border-gray-300 text-black py-4 rounded-full font-medium text-sm hover:border-black transition-colors"
                  >
                    Geri
                  </button>
                </div>
              </div>
            )}

            {step === "confirmation" && (
              <div className="max-w-2xl mx-auto text-center py-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-light mb-4">{"Siparişiniz oluşturuldu."}</h2>
                <p className="text-gray-600 mb-8">
                  {"Sipari\u015finiz i\u00e7in te\u015fekk\u00fcr ederiz. "}
                  {confirmationEmail}
                  {" adresine sipari\u015f bilgilerini g\u00f6nderdik."}
                </p>
                {completedOrder && (
                  <div className="text-left bg-white rounded-lg border border-gray-200 p-4 mb-8">
                    <p className="text-sm text-gray-500 mb-3">{"Sipariş No: "}{completedOrder.id}</p>
                    <div className="space-y-2">
                      {completedOrder.items.map((item) => (
                        <div key={`${item.product.id}-${item.color ?? ""}`} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.product.image}
                              alt={item.product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                            <span className="truncate">
                              {item.product.name} x {item.quantity}
                            </span>
                          </div>
                          <span className="shrink-0">{(item.product.price * item.quantity).toLocaleString("tr-TR")} TL</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => navigate("/hesabim")} className="bg-black text-white px-8 py-3 rounded-full">
                  {"Siparişlerime Git"}
                </button>
              </div>
            )}
          </div>

          {step !== "confirmation" && <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white rounded-lg p-6">
              <h3 className="text-lg font-medium mb-6">{"Sipari\u015f \u00d6zeti"}</h3>
              <div className="space-y-4 mb-6">
                {state.cart.map((item) => (
                  <div key={item.product.id} className="flex gap-4">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-gray-500">Adet: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium">
                      {(item.product.price * item.quantity).toLocaleString("tr-TR")} TL
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ara Toplam</span>
                  <span>{cartTotal.toLocaleString("tr-TR")} TL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kargo</span>
                  <span>{shippingCost === 0 ? "\u00dccretsiz" : `${shippingCost} TL`}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="font-medium">Toplam</span>
                  <span className="text-xl font-medium">{total.toLocaleString("tr-TR")} TL</span>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
                <Truck className="w-4 h-4" />
                <span>{"1500 TL \u00fczeri \u00fccretsiz kargo"}</span>
              </div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}








