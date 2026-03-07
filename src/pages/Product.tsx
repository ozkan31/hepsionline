import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Heart, Minus, Plus, ArrowLeft, Check, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import type { Product as ProductType } from '@/types';
import { fetchProductDetail, fetchProductMedia } from '@/lib/api';

export function Product() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dispatch, state } = useStore();
  
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState('');
  const [isAddedToCart, setIsAddedToCart] = useState(false);
  const [product, setProduct] = useState<ProductType | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productInfoTab, setProductInfoTab] = useState<'description' | 'features'>('description');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isSettlingImage, setIsSettlingImage] = useState(false);
  const [isImageResetting, setIsImageResetting] = useState(false);
  const [settlingDirection, setSettlingDirection] = useState<1 | -1 | 0>(0);
  const [pendingImageIndex, setPendingImageIndex] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const imageViewportRef = useRef<HTMLDivElement | null>(null);
  const imageAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const loadProduct = async () => {
      setIsLoading(true);
      try {
        const data = await fetchProductDetail(id);
        if (!isMounted) return;
        setProduct(data.product);
        setRelatedProducts(data.relatedProducts);
        fetchProductMedia(id)
          .then((media) => {
            if (!isMounted) return;
            const normalized = Array.isArray(media.images)
              ? media.images.map((item) => String(item ?? "").trim()).filter(Boolean)
              : [];
            if (normalized.length === 0) return;
            setProduct((prev) => (prev ? { ...prev, images: normalized, image: normalized[0] } : prev));
          })
          .catch((error) => {
            if (!isMounted) return;
            console.error('Failed to fetch product media:', error);
          });
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to fetch product detail:', error);
        setProduct(null);
        setRelatedProducts([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (product && product.colors.length > 0) {
      setSelectedColor(product.colors[0]);
    }
    setSelectedImageIndex(0);
    setDragOffsetX(0);
    setIsDraggingImage(false);
    setIsSettlingImage(false);
    setIsImageResetting(false);
    setSettlingDirection(0);
    setPendingImageIndex(null);
    setIsAddedToCart(false);
    setProductInfoTab('description');
    window.scrollTo(0, 0);
  }, [product]);

  useEffect(() => {
    return () => {
      if (imageAnimationTimeoutRef.current != null) {
        window.clearTimeout(imageAnimationTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
        <div className="w-full px-4 md:px-8">
          <div className="max-w-5xl mx-auto text-center py-20 text-gray-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-500 mb-4">Ürün bulunamadı</p>
          <Link to="/shop" className="bg-black text-white px-6 py-2 rounded-full">Alışverişe Dön</Link>
        </div>
      </div>
    );
  }

  const isInWishlist = state.wishlist.some(item => item.id === product.id);
  const isProductInCart = state.cart.some((item) => item.product.id === product.id);
  const productImages =
    Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image];
  const activeImage = productImages[selectedImageIndex] ?? product.image;
  const productTags =
    Array.isArray(product.tags) && product.tags.length > 0
      ? product.tags
      : [product.isNew ? 'Yeni' : null, product.isBestseller ? 'Çok Satan' : null].filter(
          (tag): tag is string => Boolean(tag)
        );

  const addToCart = () => {
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        product,
        quantity,
        color: selectedColor,
      },
    });
    setIsAddedToCart(true);
    setTimeout(() => setIsAddedToCart(false), 2000);
  };

  const toggleWishlist = () => {
    if (isInWishlist) {
      dispatch({ type: 'REMOVE_FROM_WISHLIST', payload: product.id });
    } else {
      dispatch({ type: 'ADD_TO_WISHLIST', payload: product });
    }
  };

  const showPrevImage = () => {
    goToImage(selectedImageIndex - 1, -1);
  };

  const showNextImage = () => {
    goToImage(selectedImageIndex + 1, 1);
  };

  const getImageViewportWidth = () => imageViewportRef.current?.clientWidth ?? 1;

  const animateSlide = (direction: 1 | -1, targetIndex: number, startOffset = 0) => {
    if (productImages.length <= 1) return;
    const width = getImageViewportWidth();
    const normalizedTarget = (targetIndex + productImages.length) % productImages.length;

    if (imageAnimationTimeoutRef.current != null) {
      window.clearTimeout(imageAnimationTimeoutRef.current);
    }

    setPendingImageIndex(normalizedTarget);
    setSettlingDirection(direction);
    setIsSettlingImage(true);
    setIsDraggingImage(false);
    setDragOffsetX(startOffset);

    window.requestAnimationFrame(() => {
      setDragOffsetX(direction === 1 ? -width : width);
    });

    imageAnimationTimeoutRef.current = window.setTimeout(() => {
      setIsImageResetting(true);
      setSelectedImageIndex(normalizedTarget);
      setDragOffsetX(0);
      setIsSettlingImage(false);
      setSettlingDirection(0);
      setPendingImageIndex(null);
      imageAnimationTimeoutRef.current = null;
      window.requestAnimationFrame(() => {
        setIsImageResetting(false);
      });
    }, 260);
  };

  const animateSnapBack = (startOffset: number) => {
    if (productImages.length <= 1) return;
    if (Math.abs(startOffset) < 1) {
      setDragOffsetX(0);
      setIsDraggingImage(false);
      setIsSettlingImage(false);
      setSettlingDirection(0);
      setPendingImageIndex(null);
      return;
    }

    if (imageAnimationTimeoutRef.current != null) {
      window.clearTimeout(imageAnimationTimeoutRef.current);
    }

    const direction = startOffset < 0 ? 1 : -1;
    const previewIndex = (selectedImageIndex + direction + productImages.length) % productImages.length;

    setPendingImageIndex(previewIndex);
    setSettlingDirection(direction);
    setIsSettlingImage(true);
    setIsDraggingImage(false);
    setDragOffsetX(startOffset);

    window.requestAnimationFrame(() => {
      setDragOffsetX(0);
    });

    imageAnimationTimeoutRef.current = window.setTimeout(() => {
      setDragOffsetX(0);
      setIsSettlingImage(false);
      setSettlingDirection(0);
      setPendingImageIndex(null);
      imageAnimationTimeoutRef.current = null;
    }, 220);
  };

  const goToImage = (nextIndex: number, direction: 1 | -1) => {
    if (productImages.length <= 1) return;
    const normalized = (nextIndex + productImages.length) % productImages.length;
    if (normalized === selectedImageIndex) return;
    animateSlide(direction, normalized, 0);
  };

  const selectImageDirectly = (nextIndex: number) => {
    if (productImages.length <= 1) return;
    const normalized = (nextIndex + productImages.length) % productImages.length;
    if (normalized === selectedImageIndex) return;
    if (imageAnimationTimeoutRef.current != null) {
      window.clearTimeout(imageAnimationTimeoutRef.current);
      imageAnimationTimeoutRef.current = null;
    }
    setIsDraggingImage(false);
    setIsSettlingImage(false);
    setIsImageResetting(false);
    setSettlingDirection(0);
    setPendingImageIndex(null);
    setDragOffsetX(0);
    setSelectedImageIndex(normalized);
  };

  const handleImageTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (productImages.length <= 1) return;
    if (imageAnimationTimeoutRef.current != null) {
      window.clearTimeout(imageAnimationTimeoutRef.current);
      imageAnimationTimeoutRef.current = null;
    }
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    setIsDraggingImage(true);
    setIsSettlingImage(false);
    setSettlingDirection(0);
    setPendingImageIndex(null);
    setDragOffsetX(0);
  };

  const handleImageTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (productImages.length <= 1) return;
    if (!isDraggingImage || touchStartXRef.current == null) return;
    const currentX = e.touches[0]?.clientX ?? touchStartXRef.current;
    setDragOffsetX(currentX - touchStartXRef.current);
  };

  const handleImageTouchEnd = () => {
    if (productImages.length <= 1 || touchStartXRef.current == null) return;
    const deltaX = dragOffsetX;
    const swipeThreshold = Math.max(40, getImageViewportWidth() * 0.18);

    if (deltaX > swipeThreshold) {
      animateSlide(-1, selectedImageIndex - 1, deltaX);
    } else if (deltaX < -swipeThreshold) {
      animateSlide(1, selectedImageIndex + 1, deltaX);
    } else {
      animateSnapBack(deltaX);
    }
    touchStartXRef.current = null;
  };

  const previewDirection: 1 | -1 | 0 =
    isSettlingImage && settlingDirection !== 0
      ? settlingDirection
      : dragOffsetX < 0
      ? 1
      : dragOffsetX > 0
      ? -1
      : 0;
  const livePreviewIndex =
    previewDirection === 0 ? null : (selectedImageIndex + previewDirection + productImages.length) % productImages.length;
  const previewImageIndex = pendingImageIndex ?? livePreviewIndex;
  const viewportWidth = getImageViewportWidth();
  const imageTransition =
    isDraggingImage || isImageResetting ? "none" : "transform 260ms ease-out";

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        {/* Breadcrumb */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto">
          {/* Image Gallery */}
          <div>
            <div
              ref={imageViewportRef}
              className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100"
              onTouchStart={handleImageTouchStart}
              onTouchMove={handleImageTouchMove}
              onTouchEnd={handleImageTouchEnd}
            >
              {previewImageIndex !== null && (
                <img
                  key={`${product.id}-preview-${previewImageIndex}-${productImages[previewImageIndex] ?? activeImage}`}
                  src={productImages[previewImageIndex] ?? activeImage}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    transform: `translateX(${dragOffsetX + (previewDirection === 1 ? viewportWidth : -viewportWidth)}px)`,
                    transition: imageTransition,
                  }}
                />
              )}
              <img
                key={`${product.id}-active-${selectedImageIndex}-${activeImage}`}
                src={activeImage}
                alt={product.name}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  transform: `translateX(${dragOffsetX}px)`,
                  transition: imageTransition,
                }}
              />
              {productImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={showPrevImage}
                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 items-center justify-center hover:bg-white hover:border-black transition-colors"
                    aria-label="Önceki görsel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border border-gray-200 items-center justify-center hover:bg-white hover:border-black transition-colors"
                    aria-label="Sonraki görsel"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              {productImages.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 md:hidden">
                  {productImages.map((_, index) => (
                    <button
                      key={`${product.id}-dot-${index}`}
                      type="button"
                      onClick={() => {
                        if (index === selectedImageIndex) return;
                        goToImage(index, index > selectedImageIndex ? 1 : -1);
                      }}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        selectedImageIndex === index ? "bg-black" : "bg-white/80"
                      }`}
                      aria-label={`Görsel ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
            {productImages.length > 1 && (
              <div className="mt-3 hidden md:grid grid-cols-5 gap-2">
                {productImages.map((image, index) => (
                  <button
                    key={`${product.id}-image-${index}`}
                    type="button"
                    onClick={() => selectImageDirectly(index)}
                    className={`aspect-square rounded-md overflow-hidden border ${
                      selectedImageIndex === index ? "border-black" : "border-gray-200"
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="mb-6">
              {productTags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {productTags.map((tag) => (
                    <span key={tag} className="bg-black text-white text-xs px-3 py-1 rounded-full inline-block">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-light mb-2">
                {product.name}
              </h1>
              <p className="text-xl md:text-2xl font-medium">{product.price.toLocaleString('tr-TR')} TL</p>
            </div>

            <div className="mb-6">
              <div className="flex gap-6 mb-4 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setProductInfoTab('description')}
                  className={`pb-2 text-sm transition-colors border-b-2 ${
                    productInfoTab === 'description'
                      ? 'text-black border-black'
                      : 'text-gray-500 border-transparent hover:text-black'
                  }`}
                >
                  Açıklama
                </button>
                <button
                  type="button"
                  onClick={() => setProductInfoTab('features')}
                  className={`pb-2 text-sm transition-colors border-b-2 ${
                    productInfoTab === 'features'
                      ? 'text-black border-black'
                      : 'text-gray-500 border-transparent hover:text-black'
                  }`}
                >
                  Özellikler
                </button>
              </div>

              {productInfoTab === 'description' ? (
                <p className="text-gray-600 leading-relaxed">
                  {product.description}
                </p>
              ) : product.features.length > 0 ? (
                <ul className="space-y-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="w-1 h-1 bg-black rounded-full mt-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Bu ürün için özellik bilgisi bulunmuyor.</p>
              )}
            </div>

            {/* Color Selection */}
            {product.colors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3">Renk: {selectedColor}</h3>
                <div className="flex gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1 text-sm border rounded-full transition-colors ${
                        selectedColor === color 
                          ? 'border-black bg-black text-white' 
                          : 'border-gray-300 hover:border-black'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Adet</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 border border-gray-300 rounded-full flex items-center justify-center hover:border-black transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-medium w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 border border-gray-300 rounded-full flex items-center justify-center hover:border-black transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={addToCart}
                className={`flex-1 py-4 rounded-full font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
                  isAddedToCart 
                    ? 'bg-green-600 text-white' 
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {isAddedToCart || isProductInCart ? (
                  <>
                    <Check className="w-4 h-4" />
                    Sepete Eklendi
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    Sepete Ekle
                  </>
                )}
              </button>
              <button
                onClick={toggleWishlist}
                className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 ${
                  isInWishlist
                    ? 'bg-white border-gray-300 text-black hover:border-black'
                    : 'border-gray-300 hover:border-black'
                }`}
              >
                <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Additional Info */}
            <div className="pt-6 border-t border-gray-200 space-y-2">
              <p className="text-sm text-gray-500">
                <span className="text-black font-medium">Ücretsiz kargo</span> 1500 TL üzeri siparişlerde
              </p>
              <p className="text-sm text-gray-500">
                <span className="text-black font-medium">Kolay iade</span> 14 gün içinde
              </p>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 md:mt-24 max-w-5xl mx-auto">
            <h2 className="text-xl md:text-2xl font-light mb-6">
              Benzer Ürünler
            </h2>
            <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-md">
              {relatedProducts.map((related) => (
                <Link 
                  key={related.id} 
                  to={`/product/${related.id}`}
                  className="group"
                >
                  <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-3">
                    <img 
                      src={related.image} 
                      alt={related.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">{related.name}</h3>
                  <p className="text-sm text-gray-600">{related.price.toLocaleString('tr-TR')} TL</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
