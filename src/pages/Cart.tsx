import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, X, ShoppingBag, ArrowRight, Truck } from 'lucide-react';
import { useStore } from '@/store/StoreContext';

export function Cart() {
  const { state, dispatch, cartTotal } = useStore();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState('');
  const shippingCost = cartTotal >= 1500 ? 0 : 79;
  const total = cartTotal + shippingCost;

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
    } else {
      dispatch({ type: 'UPDATE_CART_QUANTITY', payload: { id: productId, quantity: newQuantity } });
    }
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
        <h1 className="text-2xl md:text-3xl font-light mb-8">
          Alışveriş Sepeti ({state.cart.length})
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {state.cart.map((item) => (
              <div 
                key={item.product.id}
                className="flex gap-4 p-4 bg-white rounded-lg"
              >
                <Link 
                  to={`/product/${item.product.id}`}
                  className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"
                >
                  <img 
                    src={item.product.image} 
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
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
                        onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: item.product.id })}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    {item.color && (
                      <p className="text-sm text-gray-500 mt-1">Renk: {item.color}</p>
                    )}
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
                      {(item.product.price * item.quantity).toLocaleString('tr-TR')} TL
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

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-6 lg:sticky lg:top-24">
              <h2 className="text-lg font-medium mb-6">Sipariş Özeti</h2>

              {/* Promo Code */}
              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="İndirim kodu"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-black"
                  />
                  <button className="shrink-0 px-4 py-2 border border-black rounded-full text-sm font-medium hover:bg-black hover:text-white transition-colors">
                    Uygula
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ara Toplam</span>
                  <span>{cartTotal.toLocaleString('tr-TR')} TL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Kargo</span>
                  <span>{shippingCost === 0 ? 'Ücretsiz' : `${shippingCost} TL`}</span>
                </div>
              </div>

              <div className="flex justify-between mb-6">
                <span className="text-base font-medium">Toplam</span>
                <span className="text-xl font-medium">{total.toLocaleString('tr-TR')} TL</span>
              </div>

              <button
                onClick={() =>
                  state.isAuthenticated
                    ? navigate('/odeme')
                    : navigate('/hesabim?mode=register&redirect=/odeme')
                }
                className="w-full bg-black text-white py-4 rounded-full font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                Ödemeye Geç
              </button>

              {/* Shipping Info */}
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
