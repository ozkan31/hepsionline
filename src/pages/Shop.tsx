import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Heart, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import type { Product, Category } from '@/types';
import { fetchProducts, fetchCategories } from '@/lib/api';

export function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { dispatch, state } = useStore();

  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const sortBy = searchParams.get('sort') || 'featured';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          fetchProducts(),
          fetchCategories(),
        ]);

        if (!isMounted) return;
        setProducts(productsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch shop data:', error);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        p => p.name.toLowerCase().includes(query) ||
             p.description.toLowerCase().includes(query)
      );
    }

    if (categoryFilter) {
      if (categoryFilter === 'new') {
        result = result.filter(p => p.isNew);
      } else {
        result = result.filter(p => p.category === categoryFilter);
      }
    }

    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      default:
        break;
    }

    return result;
  }, [products, searchQuery, categoryFilter, sortBy]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const addToWishlist = (product: Product) => {
    dispatch({ type: 'ADD_TO_WISHLIST', payload: product });
  };

  const addToCart = (product: Product) => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: { product, quantity: 1, color: product.colors[0] }
    });
  };

  const isInWishlist = (productId: string) => {
    return state.wishlist.some(item => item.id === productId);
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : id;
  };

  const getProductTags = (product: Product) => {
    if (Array.isArray(product.tags) && product.tags.length > 0) {
      return product.tags;
    }
    const fallback: string[] = [];
    if (product.isNew) fallback.push('Yeni');
    if (product.isBestseller) fallback.push('Çok Satan');
    return fallback;
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-light mb-2">
              {searchQuery ? `Arama: "${searchQuery}"` : 
               categoryFilter ? getCategoryName(categoryFilter) : 
               'Tüm Ürünler'}
            </h1>
            <p className="text-sm text-gray-500">
              {filteredProducts.length} ürün
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-full px-4 py-2 pr-10 text-sm cursor-pointer hover:border-gray-400 transition-colors"
              >
                <option value="featured">Öne Çıkanlar</option>
                <option value="newest">Yeni Gelenler</option>
                <option value="price-low">Fiyat: Düşükten Yükseğe</option>
                <option value="price-high">Fiyat: Yüksekten Düşüğe</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
            </div>

            {/* Filter Button (Mobile) */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="md:hidden flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtre
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters (Desktop) */}
          <aside className="hidden md:block w-48 flex-shrink-0">
            <div className="sticky top-24">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Filtreler</h3>
                {(categoryFilter) && (
                  <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-black">
                    Temizle
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => updateFilter('category', '')}
                  className={`block w-full text-left text-sm py-2 transition-colors ${
                    categoryFilter === '' ? 'text-black font-medium' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  Tümü
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => updateFilter('category', cat.id)}
                    className={`block w-full text-left text-sm py-2 transition-colors ${
                      categoryFilter === cat.id ? 'text-black font-medium' : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Products Grid - 2 columns */}
          <div className="flex-1">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg text-gray-500 mb-4">Ürün bulunamadı</p>
                <button onClick={clearFilters} className="bg-black text-white px-6 py-2 rounded-full">
                  Filtreleri Temizle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:gap-6">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="group">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-3">
                      <Link to={`/product/${product.id}`}>
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>
                      
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {getProductTags(product).map((tag) => (
                          <span key={`${product.id}-${tag}`} className="bg-black text-white text-xs px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => addToWishlist(product)}
                        className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isInWishlist(product.id)
                            ? 'bg-red-500 text-white'
                            : 'bg-white/80 hover:bg-white'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                      </button>
                      
                      <button
                        onClick={() => addToCart(product)}
                        className="absolute bottom-0 left-0 right-0 bg-black text-white py-3 text-sm font-medium translate-y-full group-hover:translate-y-0 transition-transform"
                      >
                        Sepete Ekle
                      </button>
                    </div>
                    
                    <Link to={`/product/${product.id}`}>
                      <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-600">{product.price.toLocaleString('tr-TR')} TL</p>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-4/5 max-w-sm bg-white p-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-medium">Filtreler</h3>
              <button onClick={() => setIsFilterOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => { updateFilter('category', ''); setIsFilterOpen(false); }}
                className={`block w-full text-left text-sm py-3 border-b ${
                  categoryFilter === '' ? 'text-black font-medium' : 'text-gray-500'
                }`}
              >
                Tümü
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { updateFilter('category', cat.id); setIsFilterOpen(false); }}
                  className={`block w-full text-left text-sm py-3 border-b ${
                    categoryFilter === cat.id ? 'text-black font-medium' : 'text-gray-500'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
