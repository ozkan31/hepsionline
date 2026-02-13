import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function createProduct(data) {
  return {
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    filledStars: 4,
    imageBroken: false,
    badges: [{ label: "Popüler", tone: "orange" }],
    ...data,
  };
}

const products = [
  createProduct({
    name: "Dijital Filtre Kahve Makinesi",
    imageUrl: null,
    imageAlt: "Dijital filtre kahve makinesi",
    imageBroken: true,
    ratingCount: 75,
    price: 999,
    oldPrice: 1299,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Kablosuz Mekanik Klavye",
    imageUrl: "/products/keyboard.jpg",
    imageAlt: "Kablosuz mekanik klavye",
    ratingCount: 41,
    price: 1299,
    oldPrice: 1599,
    cartStateLabel: "Sepete eklendi",
    quantityControl: true,
    quantity: 3,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Nike Air Max 270 Erkek Ayakkabı",
    imageUrl: "/products/red-shoe.jpg",
    imageAlt: "Kırmızı spor ayakkabı",
    ratingCount: 111,
    price: 3499,
    oldPrice: 3999,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  }),
  createProduct({
    name: "Estée Lauder Advanced Night Repair",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Bulutlu gökyüzü",
    ratingCount: 49,
    price: 2799,
    oldPrice: 3199,
    badges: [
      { label: "İndirim", tone: "orange" },
      { label: "Sepette %5", tone: "red" },
    ],
  }),
  createProduct({
    name: "Levi's 501 Original Fit Jean",
    imageUrl: "/products/office.jpg",
    imageAlt: "Bilgisayar başında çalışan ekip",
    ratingCount: 45,
    price: 1499,
    oldPrice: 1899,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  }),
  createProduct({
    name: "Ruby Woo Ruj",
    imageUrl: "/products/lipstick.jpg",
    imageAlt: "Kırmızı ruj",
    ratingCount: 58,
    price: 899,
    oldPrice: 1099,
  }),
  createProduct({
    name: "Kablosuz Oyun Mouse",
    imageUrl: "/products/mouse.jpg",
    imageAlt: "Oyuncu mouse",
    ratingCount: 62,
    price: 1199,
    oldPrice: 1499,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Sepette %5", tone: "red" },
    ],
  }),
  createProduct({
    name: "Ultra HD Akıllı TV",
    imageUrl: "/products/tv.jpg",
    imageAlt: "Akıllı televizyon",
    ratingCount: 34,
    price: 9999,
    oldPrice: 11499,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Bluetooth Kulaklık",
    imageUrl: "/products/headphones.jpg",
    imageAlt: "Bluetooth kulaklık",
    ratingCount: 88,
    price: 1799,
    oldPrice: 2199,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Pamuklu Erkek Tişört",
    imageUrl: "/products/tshirt.jpg",
    imageAlt: "Erkek tişört",
    ratingCount: 19,
    price: 549,
    oldPrice: 699,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Gaming Laptop 16GB RAM",
    imageUrl: "/products/keyboard.jpg",
    imageAlt: "Gaming laptop",
    filledStars: 5,
    ratingCount: 66,
    price: 28999,
    oldPrice: 31999,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Kablosuz Bluetooth Hoparlör",
    imageUrl: "/products/headphones.jpg",
    imageAlt: "Kablosuz hoparlör",
    ratingCount: 51,
    price: 1499,
    oldPrice: 1899,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  }),
  createProduct({
    name: "4K Android TV Box",
    imageUrl: "/products/tv.jpg",
    imageAlt: "TV box cihazı",
    ratingCount: 39,
    price: 2299,
    oldPrice: 2699,
    badges: [
      { label: "Kampanya", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Erkek Koşu Ayakkabısı",
    imageUrl: "/products/red-shoe.jpg",
    imageAlt: "Erkek koşu ayakkabısı",
    ratingCount: 71,
    price: 2399,
    oldPrice: 2899,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Sepette %5", tone: "red" },
    ],
  }),
  createProduct({
    name: "Kadın Oversize Hoodie",
    imageUrl: "/products/office.jpg",
    imageAlt: "Kadın oversize hoodie",
    ratingCount: 26,
    price: 899,
    oldPrice: 1199,
  }),
  createProduct({
    name: "Mat Ruj Seti 3'lü",
    imageUrl: "/products/lipstick.jpg",
    imageAlt: "Mat ruj seti",
    ratingCount: 47,
    price: 749,
    oldPrice: 999,
    badges: [
      { label: "Kampanya", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "RGB Oyuncu Klavyesi",
    imageUrl: "/products/keyboard.jpg",
    imageAlt: "RGB oyuncu klavyesi",
    ratingCount: 43,
    price: 1899,
    oldPrice: 2399,
  }),
  createProduct({
    name: "Ergonomik Dikey Mouse",
    imageUrl: "/products/mouse.jpg",
    imageAlt: "Ergonomik dikey mouse",
    ratingCount: 31,
    price: 1399,
    oldPrice: 1699,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Gürültü Engelleyici Kulaklık",
    imageUrl: "/products/headphones.jpg",
    imageAlt: "Gürültü engelleyici kulaklık",
    filledStars: 5,
    ratingCount: 95,
    price: 3299,
    oldPrice: 3999,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  }),
  createProduct({
    name: "Akıllı Ev Güvenlik Kamerası",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Güvenlik kamerası",
    ratingCount: 28,
    price: 2599,
    oldPrice: 3099,
  }),
  createProduct({
    name: "Pamuklu Kadın Tişört",
    imageUrl: "/products/tshirt.jpg",
    imageAlt: "Kadın tişört",
    ratingCount: 36,
    price: 499,
    oldPrice: 649,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Unisex Jean Ceket",
    imageUrl: "/products/office.jpg",
    imageAlt: "Jean ceket",
    ratingCount: 22,
    price: 1899,
    oldPrice: 2299,
  }),
  createProduct({
    name: "Mekanik Numpad Klavye",
    imageUrl: "/products/keyboard.jpg",
    imageAlt: "Mekanik numpad",
    ratingCount: 18,
    price: 999,
    oldPrice: 1299,
  }),
  createProduct({
    name: "Kablosuz Kulak İçi Kulaklık",
    imageUrl: "/products/headphones.jpg",
    imageAlt: "Kulak içi kulaklık",
    ratingCount: 54,
    price: 1299,
    oldPrice: 1699,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "UltraWide Oyuncu Monitörü",
    imageUrl: "/products/tv.jpg",
    imageAlt: "UltraWide monitör",
    ratingCount: 21,
    price: 11999,
    oldPrice: 13999,
  }),
  createProduct({
    name: "Elektrikli Diş Fırçası",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Elektrikli diş fırçası",
    ratingCount: 24,
    price: 1599,
    oldPrice: 1999,
  }),
  createProduct({
    name: "C Vitamini Serum",
    imageUrl: "/products/sky.jpg",
    imageAlt: "C vitamini serum",
    ratingCount: 52,
    price: 699,
    oldPrice: 899,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Nemlendirici Gece Kremi",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Gece kremi",
    ratingCount: 37,
    price: 799,
    oldPrice: 999,
  }),
  createProduct({
    name: "Likit Eyeliner",
    imageUrl: "/products/lipstick.jpg",
    imageAlt: "Likit eyeliner",
    ratingCount: 42,
    price: 349,
    oldPrice: 449,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Kompakt Pudra",
    imageUrl: "/products/lipstick.jpg",
    imageAlt: "Kompakt pudra",
    ratingCount: 34,
    price: 429,
    oldPrice: 549,
  }),
  createProduct({
    name: "Su Geçirmez Spor Ayakkabı",
    imageUrl: "/products/red-shoe.jpg",
    imageAlt: "Su geçirmez spor ayakkabı",
    ratingCount: 48,
    price: 2699,
    oldPrice: 3199,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  }),
  createProduct({
    name: "Koşu Çorabı 5'li Paket",
    imageUrl: "/products/tshirt.jpg",
    imageAlt: "Koşu çorabı",
    ratingCount: 16,
    price: 229,
    oldPrice: 299,
  }),
  createProduct({
    name: "Basic Polo Yaka Tişört",
    imageUrl: "/products/tshirt.jpg",
    imageAlt: "Polo yaka tişört",
    ratingCount: 29,
    price: 599,
    oldPrice: 749,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Slim Fit Erkek Gömlek",
    imageUrl: "/products/office.jpg",
    imageAlt: "Erkek gömlek",
    ratingCount: 27,
    price: 1099,
    oldPrice: 1399,
  }),
  createProduct({
    name: "Bluetooth Oyun Kontrolcüsü",
    imageUrl: "/products/mouse.jpg",
    imageAlt: "Oyun kontrolcüsü",
    ratingCount: 32,
    price: 1899,
    oldPrice: 2299,
  }),
  createProduct({
    name: "Taşınabilir SSD 1TB",
    imageUrl: "/products/mouse.jpg",
    imageAlt: "Taşınabilir SSD",
    ratingCount: 44,
    price: 3099,
    oldPrice: 3599,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Çocuk Spor Ayakkabı",
    imageUrl: "/products/red-shoe.jpg",
    imageAlt: "Çocuk spor ayakkabısı",
    ratingCount: 23,
    price: 1499,
    oldPrice: 1799,
  }),
  createProduct({
    name: "Dijital Mutfak Terazisi",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Mutfak terazisi",
    ratingCount: 20,
    price: 549,
    oldPrice: 699,
  }),
  createProduct({
    name: "Kahve Öğütücü Mini",
    imageUrl: null,
    imageAlt: "Kahve öğütücü",
    imageBroken: true,
    ratingCount: 33,
    price: 899,
    oldPrice: 1099,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  }),
  createProduct({
    name: "Paslanmaz Çelik Termos",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Çelik termos",
    ratingCount: 40,
    price: 749,
    oldPrice: 949,
  }),
];

const sectionConfigs = [
  { slug: "cok-satanlar", title: "Çok Satanlar", icon: "fire" },
  { slug: "yeni-gelenler", title: "Yeni Gelenler", icon: "fire" },
  { slug: "firsat-kosesi", title: "Fırsat Köşesi", icon: "fire" },
  { slug: "trend-urunler", title: "Trend Ürünler", icon: "fire" },
  { slug: "sizin-icin-sectiklerimiz", title: "Sizin İçin Seçtiklerimiz", icon: "fire" },
];

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function rotateItems(items, offset) {
  if (items.length === 0) {
    return [];
  }

  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

async function main() {
  await prisma.favoriteItem.deleteMany();
  await prisma.favoriteList.deleteMany();
  await prisma.productBadge.deleteMany();
  await prisma.product.deleteMany();
  await prisma.section.deleteMany();
  await prisma.category.deleteMany();
  await prisma.headerAction.deleteMany();
  await prisma.siteConfig.deleteMany();

  await prisma.siteConfig.create({
    data: {
      id: 1,
      brandLetter: "h",
      brandName: "hepsionline",
      searchPlaceholder: "Ürün, kategori veya marka ara...",
      searchButtonLabel: "Ara",
      categoryNavLabel: "Kategoriler",
      wishlistLabel: "Favorilere ekle",
      quantityLabel: "Adet",
      decrementLabel: "Azalt",
      incrementLabel: "Artır",
      sectionTitle: "Çok Satanlar",
      sectionIcon: "fire",
      headerActions: {
        create: [
          { label: "Hesabım", icon: "user", sortOrder: 1 },
          { label: "Favoriler", icon: "heart", sortOrder: 2 },
          { label: "Sepet", icon: "cart", badgeCount: 3, sortOrder: 3 },
        ],
      },
      categories: {
        create: [
          { label: "Kategoriler", sortOrder: 1 },
          { label: "Erkek", sortOrder: 2 },
          { label: "Avizeler", sortOrder: 3 },
          { label: "Aydınlatma", sortOrder: 4 },
          { label: "Elektronik", sortOrder: 5 },
          { label: "Moda", sortOrder: 6 },
          { label: "Ev & Yaşam", sortOrder: 7 },
          { label: "Spor & Outdoor", sortOrder: 8 },
          { label: "Kozmetik", sortOrder: 9 },
          { label: "Kitap & Hobi", sortOrder: 10 },
          { label: "Kampanyalar", isHighlighted: true, sortOrder: 11 },
        ],
      },
      sections: {
        create: (() => {
          const shuffledProducts = shuffleItems(products);
          const productsPerSection = 15;
          const sectionShift = 6;

          return sectionConfigs.map((sectionConfig, sectionIndex) => {
            const sectionProducts = rotateItems(shuffledProducts, sectionIndex * sectionShift).slice(0, productsPerSection);

            return {
              slug: sectionConfig.slug,
              title: sectionConfig.title,
              icon: sectionConfig.icon,
              sortOrder: sectionIndex + 1,
              products: {
                create: sectionProducts.map((product, productIndex) => ({
                  name: product.name,
                  imageUrl: product.imageUrl,
                  imageAlt: product.imageAlt,
                  imageBroken: product.imageBroken,
                  filledStars: product.filledStars,
                  ratingCount: product.ratingCount,
                  price: product.price,
                  oldPrice: product.oldPrice,
                  addToCartLabel: product.addToCartLabel,
                  cartStateLabel: product.cartStateLabel,
                  quantityControl: product.quantityControl,
                  quantity: product.quantity,
                  showWishlist: true,
                  sortOrder: productIndex + 1,
                  badges: {
                    create: product.badges.map((badge, badgeIndex) => ({
                      label: badge.label,
                      tone: badge.tone,
                      sortOrder: badgeIndex + 1,
                    })),
                  },
                })),
              },
            };
          });
        })(),
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

