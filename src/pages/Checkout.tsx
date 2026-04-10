import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Truck } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { applyCustomerCoupon, createIyzicoCheckoutSession, createOrder, fetchIyzicoCheckoutStatus, saveAddress } from "@/lib/api";
import { DistanceSalesContract } from "@/components/DistanceSalesContract";
import {
  clearStoredAbandonedCartCoupon,
  getCouponDiscountAmount,
  getStoredAbandonedCartCouponCode,
  storeAbandonedCartCoupon,
} from "@/lib/abandonedCartCoupon";
import { DISTANCE_SALES_CONTRACT_PATH } from "@/lib/legalInfo";
import { loadTurkeyLocations } from "@/lib/turkiye";
import { trackPurchase } from "@/lib/analytics";
import type { AppliedAbandonedCartCoupon, Order } from "@/types";
import checkoutIyzicoLogo from "../../checkout_iyzico_ile_ode/TR/Tr_Colored_Horizontal/iyzico_ile_ode_colored_horizontal.svg";

type IyzicoCheckoutPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressName?: string;
  street: string;
  province: string;
  district: string;
  neighborhood?: string;
  total: number;
  items: Array<{ name: string; unitPrice: number; quantity: number }>;
  couponCode?: string | null;
};

export function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, cartTotal, dispatch } = useStore();
  const couponOwner = state.user?.id ?? "guest";
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
  const [iyzicoIframeUrl, setIyzicoIframeUrl] = useState("");
  const [iyzicoPaymentReference, setIyzicoPaymentReference] = useState("");
  const [isIyzicoLoading, setIsIyzicoLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedAbandonedCartCoupon | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const processedPathRef = useRef<string>("");
  const iyzicoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const newAddressDistrictSelectRef = useRef<HTMLSelectElement | null>(null);
  const newAddressNeighborhoodSelectRef = useRef<HTMLSelectElement | null>(null);

  const generateOrderId = () =>
    String(Math.floor(1000000000 + Math.random() * 9000000000));
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
  const buildIyzicoIframeSrc = (rawUrl: string) => {
    const input = String(rawUrl ?? "").trim();
    if (!input) return "";
    try {
      const parsed = new URL(input);
      parsed.searchParams.set("iframe", "true");
      return parsed.toString();
    } catch {
      const hasQuery = input.includes("?");
      const hasIframe = /([?&])iframe=true(?:&|$)/i.test(input);
      if (hasIframe) return input;
      return `${input}${hasQuery ? "&" : "?"}iframe=true`;
    }
  };
  const handleIyzicoIframeLoad = () => {
    const frame = iyzicoIframeRef.current;
    if (!frame?.contentWindow) return;
    try {
      const { href, pathname, search, hash } = frame.contentWindow.location;
      if (!href) return;
      const normalizedPath = pathname.replace(/\/+$/, "");

      if (normalizedPath === "/odeme/basarili") {
        const params = new URLSearchParams(search);
        params.set("paymentResult", "success");
        navigate(`/odeme?${params.toString()}${hash}`, { replace: true });
      }
    } catch {
      // Cross-origin iyzico pages are expected until callback lands back on our domain.
    }
  };

  const shippingCost = cartTotal >= 1500 ? 0 : 79;
  const discountAmount = getCouponDiscountAmount(cartTotal, appliedCoupon);
  const total = Math.max(0, cartTotal + shippingCost - discountAmount);

  const [shippingInfo, setShippingInfo] = useState({
    addressName: "",
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

  const buildShippingInfoFromAddress = (address: (typeof savedAddresses)[number] | null) => {
    if (!address) return null;
    const parsedStreet = splitStreetParts(address.street);
    return {
      addressName: parsedStreet.addressName,
      firstName: address.firstName,
      lastName: address.lastName,
      email: state.user?.email ?? "",
      phone: address.phone || state.user?.phone || "",
      street: parsedStreet.addressDetail || parsedStreet.addressName,
      province: address.province,
      district: address.district,
      neighborhood: address.neighborhood,
    };
  };

  const buildIyzicoPayload = (info: typeof shippingInfo): IyzicoCheckoutPayload | null => {
    if (
      !info.email ||
      !info.phone ||
      !info.street ||
      !info.province ||
      !info.district ||
      state.cart.length === 0 ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return null;
    }

    return {
      email: info.email,
      firstName: info.firstName,
      lastName: info.lastName,
      phone: info.phone,
      addressName: info.addressName,
      street: info.street,
      province: info.province,
      district: info.district,
      neighborhood: info.neighborhood,
      total,
      couponCode: appliedCoupon?.code ?? null,
      items: state.cart.map((item) => ({
        name: item.product.name,
        unitPrice: item.product.price,
        quantity: item.quantity,
      })),
    };
  };

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
  const selectedShippingInfo = useMemo(() => buildShippingInfoFromAddress(selectedAddress), [selectedAddress]);
  const currentIyzicoPayload = useMemo(
    () => buildIyzicoPayload(shippingInfo),
    [shippingInfo, state.cart, total, appliedCoupon?.code]
  );
  const contractParty = useMemo(() => {
    const source = selectedShippingInfo ?? shippingInfo;
    const fullName = [
      String(source?.firstName ?? state.user?.firstName ?? "").trim(),
      String(source?.lastName ?? state.user?.lastName ?? "").trim(),
    ]
      .filter(Boolean)
      .join(" ");
    const addressParts = [
      String(source?.addressName ?? "").trim(),
      String(source?.street ?? "").trim(),
      String(source?.neighborhood ?? "").trim(),
      String(source?.district ?? "").trim(),
      String(source?.province ?? "").trim(),
    ].filter(Boolean);

    return {
      fullName,
      address: addressParts.join(", "),
      phone: String(source?.phone ?? state.user?.phone ?? "").trim(),
      email: String(source?.email ?? state.user?.email ?? "").trim(),
    };
  }, [selectedShippingInfo, shippingInfo, state.user?.email, state.user?.firstName, state.user?.lastName, state.user?.phone]);
  const contractItems = useMemo(
    () =>
      state.cart.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.product.price ?? 0),
      })),
    [state.cart]
  );

  const paymentResult = String(new URLSearchParams(location.search).get("paymentResult") ?? "")
    .trim()
    .toLowerCase();
  const isPaymentSuccessPath = location.pathname === "/odeme/basarili" || (location.pathname === "/odeme" && paymentResult === "success");
  const isPaymentFailPath = location.pathname === "/odeme/basarisiz" || (location.pathname === "/odeme" && paymentResult === "failed");

  useEffect(() => {
    if (!state.isAuthenticated || state.cart.length === 0) {
      setAppliedCoupon(null);
      setCouponMessage("");
      return;
    }

    const storedCode = getStoredAbandonedCartCouponCode(couponOwner);
    if (!storedCode) {
      setAppliedCoupon(null);
      setCouponMessage("");
      return;
    }

    let isMounted = true;
    applyCustomerCoupon(storedCode, state.cart)
      .then((coupon) => {
        if (!isMounted) return;
        setAppliedCoupon(coupon);
        setCouponMessage(`${coupon.code} kuponu siparişinize uygulandı.`);
        storeAbandonedCartCoupon(coupon, couponOwner);
      })
      .catch((error) => {
        if (!isMounted) return;
        setAppliedCoupon(null);
        clearStoredAbandonedCartCoupon(couponOwner);
        setCouponMessage(error instanceof Error ? error.message : "Kupon artık geçerli değil.");
      });

    return () => {
      isMounted = false;
    };
  }, [cartTotal, couponOwner, state.cart, state.cart.length, state.isAuthenticated]);

  const finalizeSuccessfulPayment = async (paymentReference: string, processKey: string) => {
    if (processedPathRef.current === processKey) return;
    if (!state.user) return;
    if (!paymentReference) {
      setStep("payment");
      setPaymentError("Ödeme doğrulama bilgisi eksik. Lütfen tekrar deneyin.");
      processedPathRef.current = processKey;
      return;
    }

    processedPathRef.current = processKey;
    let lastErrorMessage = "Ödeme doğrulanamadı. Lütfen birkaç saniye sonra tekrar deneyin.";
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const orderDraft = {
      id: generateOrderId(),
      date: new Date().toISOString().split("T")[0],
      paymentReference,
      items: [...state.cart],
      total,
      subtotal: cartTotal,
      shippingTotal: shippingCost,
      discountTotal: discountAmount,
      couponCode: appliedCoupon?.code ?? "",
      status: "processing" as const,
      shippingAddress: {
        addressName:
          shippingInfo.addressName ||
          (() => {
            const fallbackAddress =
              selectedAddress ?? savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0] ?? null;
            if (!fallbackAddress) return "";
            return splitStreetParts(fallbackAddress.street).addressName;
          })(),
        firstName:
          shippingInfo.firstName ||
          selectedAddress?.firstName ||
          savedAddresses.find((address) => address.isDefault)?.firstName ||
          savedAddresses[0]?.firstName ||
          state.user?.firstName ||
          "",
        lastName:
          shippingInfo.lastName ||
          selectedAddress?.lastName ||
          savedAddresses.find((address) => address.isDefault)?.lastName ||
          savedAddresses[0]?.lastName ||
          state.user?.lastName ||
          "",
        phone:
          shippingInfo.phone ||
          selectedAddress?.phone ||
          savedAddresses.find((address) => address.isDefault)?.phone ||
          savedAddresses[0]?.phone ||
          state.user?.phone ||
          "",
        street:
          shippingInfo.street ||
          (() => {
            const fallbackAddress =
              selectedAddress ?? savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0] ?? null;
            if (!fallbackAddress) return "";
            const parsed = splitStreetParts(fallbackAddress.street);
            return parsed.addressDetail || parsed.addressName;
          })(),
        province:
          shippingInfo.province ||
          selectedAddress?.province ||
          savedAddresses.find((address) => address.isDefault)?.province ||
          savedAddresses[0]?.province ||
          "",
        district:
          shippingInfo.district ||
          selectedAddress?.district ||
          savedAddresses.find((address) => address.isDefault)?.district ||
          savedAddresses[0]?.district ||
          "",
        neighborhood:
          shippingInfo.neighborhood ||
          selectedAddress?.neighborhood ||
          savedAddresses.find((address) => address.isDefault)?.neighborhood ||
          savedAddresses[0]?.neighborhood ||
          "",
      },
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const createdOrder = await createOrder(orderDraft);
        dispatch({ type: "ADD_ORDER", payload: createdOrder });
        setCompletedOrder(createdOrder);
        trackPurchase({
          id: createdOrder.id,
          total: createdOrder.total,
          items: createdOrder.items.map((item) => ({
            product: {
              id: item.product.id,
              name: item.product.name,
              category: item.product.category,
              price: item.product.price,
            },
            quantity: item.quantity,
            color: item.color,
          })),
        });
        dispatch({ type: "CLEAR_CART" });
        clearStoredAbandonedCartCoupon(couponOwner);
        setAppliedCoupon(null);
        setStep("confirmation");
        setPaymentError("");
        setIyzicoIframeUrl("");
        setIyzicoPaymentReference("");
        return;
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : lastErrorMessage;
        if (attempt < 3) {
          await wait(2000);
        }
      }
    }

    setStep("payment");
    setPaymentError(lastErrorMessage);
    processedPathRef.current = "";
  };

  useEffect(() => {
    if (isPaymentSuccessPath) {
      const successPaymentReference = new URLSearchParams(location.search).get("paymentReference") ?? "";
      void finalizeSuccessfulPayment(successPaymentReference, `success:${location.pathname}:${successPaymentReference}`);
      return;
    }

    if (isPaymentFailPath) {
      if (processedPathRef.current === `fail:${location.pathname}`) return;
      const failedReason =
        new URLSearchParams(location.search).get("reason") ?? "Ödeme başarısız veya iptal edildi. Lütfen tekrar deneyin.";
      setStep("payment");
      setPaymentError(failedReason);
      setIyzicoIframeUrl("");
      setIyzicoPaymentReference("");
      processedPathRef.current = `fail:${location.pathname}`;
      return;
    }

    processedPathRef.current = "";
  }, [isPaymentFailPath, isPaymentSuccessPath, location.pathname, location.search]);

  const handleSavedAddressContinue = () => {
    if (!selectedAddress) return;
    if (!distanceSaleAccepted) {
      setAddressError("Ödemeye geçmek için Mesafeli Satış Sözleşmesi'ni onaylamalısınız.");
      return;
    }
    const nextShippingInfo = buildShippingInfoFromAddress(selectedAddress);
    if (!nextShippingInfo) return;
    setShippingInfo(nextShippingInfo);
    setStep("payment");
    window.scrollTo(0, 0);
  };

  const handleBackToShipping = () => {
    setIyzicoIframeUrl("");
    setIyzicoPaymentReference("");
    setPaymentError("");
    setIsIyzicoLoading(false);
    setStep("shipping");
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
    if (!currentIyzicoPayload) {
      setPaymentError("Teslimat bilgileri eksik.");
      setIyzicoIframeUrl("");
      return;
    }

    let isMounted = true;
    setIsIyzicoLoading(true);
    setPaymentError("");
    setIyzicoIframeUrl("");
    setIyzicoPaymentReference("");

    createIyzicoCheckoutSession(currentIyzicoPayload)
      .then((data) => {
        if (!isMounted) return;
        setIyzicoIframeUrl(buildIyzicoIframeSrc(data.paymentPageUrl));
        setIyzicoPaymentReference(data.paymentReference);
      })
      .catch((error) => {
        if (!isMounted) return;
        setPaymentError(error instanceof Error ? error.message : "Ödeme başlatılamadı.");
      })
      .finally(() => {
        if (isMounted) setIsIyzicoLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentIyzicoPayload, isPaymentFailPath, isPaymentSuccessPath, step]);

  useEffect(() => {
    if (
      step !== "payment" ||
      !iyzicoIframeUrl ||
      !iyzicoPaymentReference ||
      isPaymentSuccessPath ||
      isPaymentFailPath
    ) {
      return;
    }

    let isMounted = true;
    let inFlight = false;

    const pollStatus = async () => {
      if (!isMounted || inFlight) return;
      inFlight = true;
      try {
        const status = await fetchIyzicoCheckoutStatus(iyzicoPaymentReference);
        if (!isMounted) return;

        if (status.status === "authorized") {
          await finalizeSuccessfulPayment(
            iyzicoPaymentReference,
            `poll:${iyzicoPaymentReference}`
          );
          return;
        }

      } catch {
        // Ignore transient polling errors while iyzico is still finishing.
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => {
      void pollStatus();
    }, 1200);

    void pollStatus();

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [finalizeSuccessfulPayment, isPaymentFailPath, isPaymentSuccessPath, iyzicoIframeUrl, iyzicoPaymentReference, step]);

  const confirmationEmail = shippingInfo.email || state.user?.email || "";

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
                    <form onSubmit={handleAddAddress} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3" autoComplete="on">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          name="addressFirstName"
                          autoComplete="given-name"
                          placeholder="Ad"
                          value={newAddressForm.firstName}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, firstName: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                        <input
                          type="text"
                          required
                          name="addressLastName"
                          autoComplete="family-name"
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
                          name="addressPhone"
                          autoComplete="tel"
                          placeholder="Telefon"
                          value={newAddressForm.phone}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, phone: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                        <input
                          type="text"
                          required
                          name="addressLabel"
                          autoComplete="address-line1"
                          placeholder="örn. ev adresim, iş adresim"
                          value={newAddressForm.street}
                          onChange={(e) => setNewAddressForm({ ...newAddressForm, street: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black"
                        />
                      </div>
                      <textarea
                        required
                        minLength={10}
                        name="streetAddress"
                        autoComplete="street-address"
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
                        metnini okudum, onaylıyorum.{" "}
                        <Link to={DISTANCE_SALES_CONTRACT_PATH} className="underline hover:text-black" target="_blank" rel="noreferrer">
                          Ayrı sayfada aç
                        </Link>
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
                  <DistanceSalesContract
                    buyer={contractParty}
                    orderer={contractParty}
                    invoice={contractParty}
                    items={contractItems}
                    shippingCost={shippingCost}
                    total={total}
                  />
                </div>
              </div>
            )}

            {step === "payment" && (
              <div>
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Ödeme Yöntemi</p>
                    <div className="flex items-center justify-center rounded-lg border border-gray-100 bg-[#F8F7F4] px-4 py-4">
                      <img
                        src={checkoutIyzicoLogo}
                        alt="iyzico ile Öde"
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-auto max-w-full"
                      />
                    </div>
                  </div>

                  {isIyzicoLoading && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
                      {"iyzico güvenli ödeme alanı hazırlanıyor..."}
                    </div>
                  )}

                  {paymentError && (
                    <div className="bg-red-50 text-red-600 border border-red-200 rounded-lg p-4 text-sm">
                      {paymentError}
                    </div>
                  )}

                  {iyzicoIframeUrl && !isIyzicoLoading && (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
                      <div className="rounded-xl overflow-hidden border border-gray-200 bg-[#F8F7F4]">
                        <iframe
                          ref={iyzicoIframeRef}
                          title="iyzico Güvenli Ödeme"
                          src={iyzicoIframeUrl}
                          onLoad={handleIyzicoIframeLoad}
                          className="w-full h-[640px] md:h-[720px] bg-white"
                          allow="payment *"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBackToShipping}
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
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Kupon İndirimi{appliedCoupon?.code ? ` (${appliedCoupon.code})` : ""}
                    </span>
                    <span className="text-emerald-700">-{discountAmount.toLocaleString("tr-TR")} TL</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="font-medium">Toplam</span>
                  <span className="text-xl font-medium">{total.toLocaleString("tr-TR")} TL</span>
                </div>
              </div>

              {couponMessage ? <p className="mt-4 text-sm text-gray-600">{couponMessage}</p> : null}

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








