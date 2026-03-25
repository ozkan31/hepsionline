import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingBag, TicketPercent, Truck, X } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { trackBeginCheckout } from "@/lib/analytics";
import { applyCustomerCoupon } from "@/lib/api";
import {
  clearStoredAbandonedCartCoupon,
  describeCouponDiscount,
  getCouponDiscountAmount,
  getStoredAbandonedCartCouponCode,
  normalizeClientCouponCode,
  storeAbandonedCartCoupon,
} from "@/lib/abandonedCartCoupon";
import type { AppliedAbandonedCartCoupon } from "@/types";

export function Cart() {
  const { state, dispatch, cartTotal } = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const couponOwner = state.user?.id ?? "guest";
  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedAbandonedCartCoupon | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponError, setCouponError] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const shippingCost = cartTotal >= 1500 ? 0 : 79;
  const discountAmount = getCouponDiscountAmount(cartTotal, appliedCoupon);
  const total = Math.max(0, cartTotal + shippingCost - discountAmount);
  const cartSignature = useMemo(
    () =>
      JSON.stringify(
        state.cart.map((item) => ({
          id: item.product.id,
          quantity: item.quantity,
          color: item.color ?? "",
        }))
      ),
    [state.cart]
  );

  const cleanupCouponQueryParams = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("kupon");
    nextParams.delete("coupon");
    setSearchParams(nextParams, { replace: true });
  };

  const clearCouponState = (message = "") => {
    setAppliedCoupon(null);
    clearStoredAbandonedCartCoupon(couponOwner);
    if (!promoCode.trim()) {
      setPromoCode("");
    }
    setCouponMessage(message);
  };

  const syncCoupon = async (rawCode: string, options?: { silentSuccess?: boolean; cleanupQuery?: boolean }) => {
    const code = normalizeClientCouponCode(rawCode);
    if (!code) {
      setCouponError("İndirim kodu girin.");
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError("");
    if (!options?.silentSuccess) {
      setCouponMessage("");
    }

    try {
      const coupon = await applyCustomerCoupon(code, state.cart);
      setAppliedCoupon(coupon);
      setPromoCode(coupon.code);
      storeAbandonedCartCoupon(coupon, couponOwner);
      if (!options?.silentSuccess) {
        setCouponMessage(`${coupon.code} kuponu uygulandı.`);
      }
    } catch (error) {
      setAppliedCoupon(null);
      clearStoredAbandonedCartCoupon(couponOwner);
      setCouponError(error instanceof Error ? error.message : "Kupon uygulanamadı.");
    } finally {
      if (options?.cleanupQuery) {
        cleanupCouponQueryParams();
      }
      setIsApplyingCoupon(false);
    }
  };

  useEffect(() => {
    if (state.cart.length === 0) {
      setPromoCode("");
      setCouponError("");
      clearCouponState("");
    }
  }, [state.cart.length, couponOwner]);

  useEffect(() => {
    const queryCode =
      normalizeClientCouponCode(searchParams.get("kupon") ?? "") ||
      normalizeClientCouponCode(searchParams.get("coupon") ?? "");
    const storedCode = getStoredAbandonedCartCouponCode(couponOwner);
    const incomingCode = queryCode || storedCode;

    if (!incomingCode || state.cart.length === 0) {
      setAppliedCoupon(null);
      setPromoCode("");
      setCouponMessage("");
      setCouponError("");
      return;
    }
    if (appliedCoupon?.code === incomingCode && appliedCoupon.subtotal === cartTotal) return;

    setPromoCode(incomingCode);
    void syncCoupon(incomingCode, {
      silentSuccess: appliedCoupon?.code === incomingCode,
      cleanupQuery: true,
    });
  }, [appliedCoupon?.code, appliedCoupon?.subtotal, cartSignature, cartTotal, couponOwner, searchParams, state.cart.length, state.cart]);

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      dispatch({ type: "REMOVE_FROM_CART", payload: productId });
    } else {
      dispatch({ type: "UPDATE_CART_QUANTITY", payload: { id: productId, quantity: newQuantity } });
    }
  };

  const handleBeginCheckout = () => {
    trackBeginCheckout({
      items: state.cart.map((item) => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          category: item.product.category,
          price: item.product.price,
        },
        quantity: item.quantity,
        color: item.color,
      })),
      total,
    });

    if (state.isAuthenticated) {
      navigate("/odeme");
      return;
    }
    navigate("/giris?redirect=/odeme");
  };

  const handleApplyClick = async () => {
    await syncCoupon(promoCode);
  };

  const handleRemoveCoupon = () => {
    setPromoCode("");
    setCouponError("");
    clearCouponState("Kupon kaldırıldı.");
    cleanupCouponQueryParams();
  };

  if (state.cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
        <div className="w-full px-4 md:px-8">
          <h1 className="text-2xl md:text-3xl font-light mb-8">Alışveriş Sepeti</h1>
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 mx-auto mb-6 text-gray-300" />
            <p className="text-lg text-gray-500 mb-6">Sepetiniz boş</p>
            <Link to="/shop" className="bg-black text-white px-6 py-3 rounded-full">
              Alışverişe Başla
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        <h1 className="text-2xl md:text-3xl font-light mb-8">Alışveriş Sepeti ({state.cart.length})</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          <div className="lg:col-span-2 space-y-4">
            {state.cart.map((item) => (
              <div key={`${item.product.id}-${item.color ?? ""}`} className="flex gap-4 p-4 bg-white rounded-lg">
                <Link
                  to={`/product/${item.product.id}`}
                  className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"
                >
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                </Link>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <Link
                        to={`/product/${item.product.id}`}
                        className="text-base font-medium text-gray-900 hover:text-gray-600 transition-colors line-clamp-1"
                      >
                        {item.product.name}
                      </Link>
                      <button
                        onClick={() => dispatch({ type: "REMOVE_FROM_CART", payload: item.product.id })}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    {item.color ? <p className="text-sm text-gray-500 mt-1">Renk: {item.color}</p> : null}
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center hover:border-black transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center hover:border-black transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-base font-medium">
                      {(item.product.price * item.quantity).toLocaleString("tr-TR")} TL
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Alışverişe Devam Et
            </Link>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-6 lg:sticky lg:top-24">
              <h2 className="text-lg font-medium mb-6">Sipariş Özeti</h2>

              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="İndirim kodu"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={handleApplyClick}
                    disabled={isApplyingCoupon || !promoCode.trim()}
                    className="shrink-0 px-4 py-2 border border-black rounded-full text-sm font-medium hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                  >
                    {isApplyingCoupon ? "Uygulanıyor..." : "Uygula"}
                  </button>
                </div>
                {appliedCoupon ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-medium">
                        <TicketPercent className="w-4 h-4" />
                        <span>{appliedCoupon.code}</span>
                      </div>
                      <button type="button" onClick={handleRemoveCoupon} className="text-xs underline">
                        Kaldır
                      </button>
                    </div>
                    <p className="mt-1">
                      {describeCouponDiscount(appliedCoupon.type, appliedCoupon.value)} uygulandı.
                    </p>
                  </div>
                ) : null}
                {couponMessage ? <p className="mt-2 text-sm text-green-700">{couponMessage}</p> : null}
                {couponError ? <p className="mt-2 text-sm text-red-600">{couponError}</p> : null}
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ara Toplam</span>
                  <span>{cartTotal.toLocaleString("tr-TR")} TL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kargo</span>
                  <span>{shippingCost === 0 ? "Ücretsiz" : `${shippingCost} TL`}</span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Kupon İndirimi</span>
                    <span className="text-emerald-700">-{discountAmount.toLocaleString("tr-TR")} TL</span>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-between mb-6">
                <span className="text-base font-medium">Toplam</span>
                <span className="text-xl font-medium">{total.toLocaleString("tr-TR")} TL</span>
              </div>

              <button
                onClick={handleBeginCheckout}
                className="w-full bg-black text-white py-4 rounded-full font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                Ödemeye Geç
              </button>

              <div className="mt-6 flex items-center gap-3 text-sm text-gray-500">
                <Truck className="w-4 h-4" />
                {cartTotal >= 1500 ? (
                  <span>Ücretsiz kargo hakkınız var!</span>
                ) : (
                  <span>1500 TL üzeri ücretsiz kargo</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
