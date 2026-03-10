import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Heart, ShoppingBag, X } from 'lucide-react';
import { useStore } from '@/store/StoreContext';

export function Wishlist() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.isAuthenticated) return;
    navigate('/giris?redirect=/favoriler', { replace: true });
  }, [navigate, state.isAuthenticated]);

  if (!state.isAuthenticated) {
    return null;
  }

  const addToCart = (productId: string) => {
    const product = state.wishlist.find(p => p.id === productId);
    if (product) {
      dispatch({
        type: 'ADD_TO_CART',
        payload: { product, quantity: 1, color: product.colors[0] },
      });
    }
  };

  if (state.wishlist.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
        <div className="w-full px-4 md:px-8">
          <h1 className="text-2xl md:text-3xl font-light mb-8">Favorilerim</h1>
          <div className="text-center py-20">
            <Heart className="w-16 h-16 mx-auto mb-6 text-gray-300" />
            <p className="text-lg text-gray-500 mb-6">Favorileriniz boş</p>
            <Link to="/shop" className="bg-black text-white px-6 py-3 rounded-full">
              Ürünleri Keşfet
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
          Favorilerim ({state.wishlist.length})
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
          {state.wishlist.map((product) => (
            <div key={product.id} className="group">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-3">
                <Link to={`/product/${product.id}`}>
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </Link>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_FROM_WISHLIST', payload: product.id })}
                  className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Link to={`/product/${product.id}`}>
                <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{product.price.toLocaleString('tr-TR')} TL</p>
              </Link>
              <button
                onClick={() => addToCart(product.id)}
                className="w-full flex items-center justify-center gap-2 border border-black text-black py-2.5 rounded-full text-sm font-medium hover:bg-black hover:text-white transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                Sepete Ekle
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
