export interface CategoryPageConfig {
  id: string;
  slug: string;
  path: string;
  name: string;
  title: string;
  description: string;
  introTitle: string;
  introDescription: string;
  image: string;
}

export const CATEGORY_PAGES: CategoryPageConfig[] = [
  {
    id: "crossbody",
    slug: "capraz-cantalar",
    path: "/kategori/capraz-cantalar/",
    name: "Çapraz Çantalar",
    title: "Çapraz Çantalar | StilBags&Fashion",
    description:
      "Günlük kullanım, şehir stili ve zarif kombinler için seçilen çapraz çanta modellerini StilBags&Fashion koleksiyonunda keşfedin.",
    introTitle: "Çapraz Çantalar",
    introDescription:
      "Günlük tempoya uyum sağlayan, hafif ve kullanışlı çapraz çanta modellerini keşfedin.",
    image: "/cat_crossbody.jpg",
  },
  {
    id: "mini",
    slug: "mini-cantalar",
    path: "/kategori/mini-cantalar/",
    name: "Mini Çantalar",
    title: "Mini Çantalar | StilBags&Fashion",
    description:
      "Özel davetlerden günlük kombinlere kadar her stile uyum sağlayan mini çanta modellerini StilBags&Fashion ile inceleyin.",
    introTitle: "Mini Çantalar",
    introDescription:
      "Kompakt, zarif ve dikkat çekici mini çanta modelleriyle stilinizi tamamlayın.",
    image: "/cat_mini.jpg",
  },
  {
    id: "shoulder",
    slug: "omuz-cantalari",
    path: "/kategori/omuz-cantalari/",
    name: "Omuz Çantaları",
    title: "Omuz Çantaları | StilBags&Fashion",
    description:
      "Şıklık ve konforu bir araya getiren omuz çantası modellerini StilBags&Fashion koleksiyonunda keşfedin.",
    introTitle: "Omuz Çantaları",
    introDescription:
      "Şehir yaşamına uyum sağlayan, günlük ve özel kombinlerde kullanılabilen omuz çantaları burada.",
    image: "/cat_shoulder.jpg",
  },
  {
    id: "new",
    slug: "yeni-gelenler",
    path: "/kategori/yeni-gelenler/",
    name: "Yeni Gelenler",
    title: "Yeni Gelenler | StilBags&Fashion",
    description:
      "Sezonun öne çıkan yeni çanta modellerini ve en güncel StilBags&Fashion seçkisini keşfedin.",
    introTitle: "Yeni Gelenler",
    introDescription:
      "Sezonun en yeni StilBags&Fashion modellerini ilk keşfedenlerden olun.",
    image: "/cat_new.jpg",
  },
];

export function getCategoryPageById(categoryId?: string | null) {
  const normalized = String(categoryId ?? "").trim().toLowerCase();
  return CATEGORY_PAGES.find((item) => item.id === normalized) ?? null;
}

export function getCategoryPageBySlug(categorySlug?: string | null) {
  const normalized = String(categorySlug ?? "").trim().toLowerCase();
  return CATEGORY_PAGES.find((item) => item.slug === normalized) ?? null;
}

export function getCategoryPagePath(categoryId?: string | null) {
  return getCategoryPageById(categoryId)?.path ?? "/shop/";
}
