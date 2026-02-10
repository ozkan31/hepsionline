import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  {
    name: "Dijital Filtre Kahve Makinesi",
    imageUrl: null,
    imageAlt: "dijital filtre kahve makinesi",
    imageBroken: true,
    filledStars: 4,
    ratingCount: 75,
    price: 999,
    oldPrice: 1299,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  },
  {
    name: "Kablosuz Mekanik Klavye",
    imageUrl: "/products/keyboard.jpg",
    imageAlt: "Kablosuz mekanik klavye",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 41,
    price: 1299,
    oldPrice: 1599,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: "Sepete eklendi",
    quantityControl: true,
    quantity: 3,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  },
  {
    name: "Nike Air Max 270 Erkek Ayakkabı",
    imageUrl: "/products/red-shoe.jpg",
    imageAlt: "Kırmızı spor ayakkabı",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 111,
    price: 3499,
    oldPrice: 3999,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  },
  {
    name: "Estée Lauder Advanced Night Repair",
    imageUrl: "/products/sky.jpg",
    imageAlt: "Bulutlu gökyüzü",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 49,
    price: 2799,
    oldPrice: 3199,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "İndirim", tone: "orange" },
      { label: "Sepette %5", tone: "red" },
    ],
  },
  {
    name: "Levi's 501 Original Fit Jean",
    imageUrl: "/products/office.jpg",
    imageAlt: "Bilgisayar başında çalışan ekip",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 45,
    price: 1499,
    oldPrice: 1899,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Popüler", tone: "red" },
    ],
  },
  {
    name: "Ruby Woo Ruj",
    imageUrl: "/products/lipstick.jpg",
    imageAlt: "Kırmızı ruj",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 58,
    price: 899,
    oldPrice: 1099,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [{ label: "Popüler", tone: "orange" }],
  },
  {
    name: "Kablosuz Oyun Mouse",
    imageUrl: "/products/mouse.jpg",
    imageAlt: "Oyuncu mouse",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 62,
    price: 1199,
    oldPrice: 1499,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Çok Satan", tone: "orange" },
      { label: "Sepette %5", tone: "red" },
    ],
  },
  {
    name: "Ultra HD Akıllı TV",
    imageUrl: "/products/tv.jpg",
    imageAlt: "Akıllı televizyon",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 34,
    price: 9999,
    oldPrice: 11499,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  },
  {
    name: "Bluetooth Kulaklık",
    imageUrl: "/products/headphones.jpg",
    imageAlt: "Bluetooth kulaklık",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 88,
    price: 1799,
    oldPrice: 2199,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Popüler", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  },
  {
    name: "Pamuklu Erkek Tişört",
    imageUrl: "/products/tshirt.jpg",
    imageAlt: "Erkek tişört",
    imageBroken: false,
    filledStars: 4,
    ratingCount: 19,
    price: 549,
    oldPrice: 699,
    addToCartLabel: "Sepete ekle",
    cartStateLabel: null,
    quantityControl: false,
    quantity: 1,
    badges: [
      { label: "Yeni", tone: "orange" },
      { label: "İndirim", tone: "red" },
    ],
  },
];

async function main() {
  await prisma.productBadge.deleteMany();
  await prisma.product.deleteMany();
  await prisma.section.deleteMany();
  await prisma.category.deleteMany();
  await prisma.headerAction.deleteMany();
  await prisma.siteConfig.deleteMany();

  await prisma.siteConfig.create({
    data: {
      id: 1,
      brandLetter: "s",
      brandName: "ShopMax",
      searchPlaceholder: "Ürün, kategori veya marka ara...",
      searchButtonLabel: "Ara",
      categoryNavLabel: "Kategoriler",
      wishlistLabel: "Favorilere ekle",
      quantityLabel: "Adet",
      decrementLabel: "Azalt",
      incrementLabel: "Artir",
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
        create: [
          {
            slug: "cok-satanlar",
            title: "Çok Satanlar",
            icon: "fire",
            sortOrder: 1,
            products: {
              create: products.map((product, index) => ({
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
                sortOrder: index + 1,
                badges: {
                  create: product.badges.map((badge, badgeIndex) => ({
                    label: badge.label,
                    tone: badge.tone,
                    sortOrder: badgeIndex + 1,
                  })),
                },
              })),
            },
          },
        ],
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
