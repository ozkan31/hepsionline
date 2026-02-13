import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const CONTAINER_TITLE_POOL = [
  "Çok Satanlar",
  "Trend Ürünler",
  "Fırsat Ürünleri",
  "Bugüne Özel",
  "Sizin İçin Seçtiklerimiz",
  "Yeni Keşifler",
  "Kaçırılmayacak Ürünler",
  "Öne Çıkanlar",
] as const;

const PRODUCTS_PER_CONTAINER = 12;
const SECTIONS_PER_PAGE = 4;
const PRODUCT_CACHE_SECONDS = 90;
const SITE_CACHE_SECONDS = 300;
const SHUFFLED_IDS_CACHE_SECONDS = 300;
const FEED_SEED_SOURCE = process.env.HOMEPAGE_RANDOM_SEED ?? "hepsionline-feed-v1";

export type HomepageProduct = {
  id: number;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  imageBroken: boolean;
  filledStars: number;
  ratingCount: number;
  price: number;
  oldPrice: number | null;
  addToCartLabel: string;
  cartStateLabel: string | null;
  quantityControl: boolean;
  quantity: number;
  showWishlist: boolean;
  sortOrder: number;
  badges: Array<{
    id: number;
    label: string;
    tone: string;
    sortOrder: number;
    productId: number;
  }>;
};

export type HomepageSection = {
  id: number;
  slug: string;
  title: string;
  icon: string;
  sortOrder: number;
  siteConfigId: number;
  products: HomepageProduct[];
};

export type HomepagePagination = {
  currentPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
  totalProducts: number;
  totalSections: number;
  sectionsPerPage: number;
  productsPerSection: number;
};

function parsePage(rawPage: number) {
  if (!Number.isFinite(rawPage) || rawPage < 1) {
    return 1;
  }

  return Math.floor(rawPage);
}

function buildSectionTitle(sectionIndex: number) {
  const base = CONTAINER_TITLE_POOL[sectionIndex % CONTAINER_TITLE_POOL.length] ?? "Öne Çıkanlar";
  const cycle = Math.floor(sectionIndex / CONTAINER_TITLE_POOL.length) + 1;
  return cycle > 1 ? `${base} ${sectionIndex + 1}` : base;
}

function hashStringToSeed(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) || 1;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: readonly T[], seedSource: string) {
  const random = createSeededRandom(hashStringToSeed(seedSource));
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function buildSectionsFromProducts(products: HomepageProduct[], sectionOffset = 0): HomepageSection[] {
  if (products.length === 0) {
    return [];
  }

  const containerCount = Math.ceil(products.length / PRODUCTS_PER_CONTAINER);

  return Array.from({ length: containerCount }, (_, localSectionIndex) => {
    const sectionIndex = sectionOffset + localSectionIndex;
    const startIndex = localSectionIndex * PRODUCTS_PER_CONTAINER;
    const endIndex = startIndex + PRODUCTS_PER_CONTAINER;

    const sectionProducts = products.slice(startIndex, endIndex).map((product, productIndex) => {
      return {
        ...product,
        sortOrder: productIndex + 1,
      };
    });

    return {
      id: 900000 + sectionIndex,
      slug: `rastgele-konteyner-${sectionIndex + 1}`,
      title: buildSectionTitle(sectionIndex),
      icon: "fire",
      sortOrder: sectionIndex + 1,
      siteConfigId: 1,
      products: sectionProducts,
    };
  });
}

const getCachedSiteData = unstable_cache(
  async () => {
    return prisma.siteConfig.findUnique({
      where: { id: 1 },
      select: {
        id: true,
        brandLetter: true,
        brandName: true,
        searchPlaceholder: true,
        searchButtonLabel: true,
        categoryNavLabel: true,
        wishlistLabel: true,
        quantityLabel: true,
        decrementLabel: true,
        incrementLabel: true,
        sectionTitle: true,
        sectionIcon: true,
        headerActions: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            label: true,
            icon: true,
            badgeCount: true,
          },
        },
        categories: {
          where: {
            parentId: null,
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            label: true,
            slug: true,
            isHighlighted: true,
            children: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              select: {
                id: true,
                label: true,
                slug: true,
                isHighlighted: true,
                children: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  select: {
                    id: true,
                    label: true,
                    slug: true,
                    isHighlighted: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },
  ["homepage-site-config-v3"],
  { revalidate: SITE_CACHE_SECONDS, tags: ["site-config"] },
);

const getCachedShuffledProductIds = unstable_cache(
  async () => {
    const productIds = await prisma.product.findMany({
      orderBy: [{ id: "asc" }],
      select: { id: true },
    });

    return shuffleWithSeed(
      productIds.map((product) => product.id),
      FEED_SEED_SOURCE,
    );
  },
  ["homepage-shuffled-product-ids-v1", FEED_SEED_SOURCE],
  { revalidate: SHUFFLED_IDS_CACHE_SECONDS, tags: ["products", "homepage"] },
);

export const getHomepageSectionsPage = unstable_cache(
  async (page: number) => {
    const parsedPage = parsePage(page);
    const shuffledIds = await getCachedShuffledProductIds();

    const totalProducts = shuffledIds.length;
    const totalSections = Math.ceil(totalProducts / PRODUCTS_PER_CONTAINER);
    const totalPages = Math.max(1, Math.ceil(totalSections / SECTIONS_PER_PAGE));
    const currentPage = Math.min(parsedPage, totalPages);
    const productOffset = (currentPage - 1) * SECTIONS_PER_PAGE * PRODUCTS_PER_CONTAINER;
    const pageProductLimit = SECTIONS_PER_PAGE * PRODUCTS_PER_CONTAINER;
    const sectionOffset = (currentPage - 1) * SECTIONS_PER_PAGE;
    const selectedProductIds = shuffledIds.slice(productOffset, productOffset + pageProductLimit);

    let sections: HomepageSection[] = [];

    if (selectedProductIds.length > 0) {
      const pageProducts = await prisma.product.findMany({
        where: {
          id: {
            in: selectedProductIds,
          },
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          imageAlt: true,
          imageBroken: true,
          filledStars: true,
          ratingCount: true,
          price: true,
          oldPrice: true,
          addToCartLabel: true,
          cartStateLabel: true,
          quantityControl: true,
          quantity: true,
          showWishlist: true,
          sortOrder: true,
          badges: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              label: true,
              tone: true,
              sortOrder: true,
              productId: true,
            },
          },
        },
      });

      const productsById = new Map(pageProducts.map((product) => [product.id, product]));
      const orderedProducts = selectedProductIds
        .map((productId) => productsById.get(productId))
        .filter((product): product is HomepageProduct => Boolean(product));

      sections = buildSectionsFromProducts(orderedProducts, sectionOffset);
    }

    return {
      sections,
      pagination: {
        currentPage,
        totalPages,
        hasPrevPage: currentPage > 1,
        hasNextPage: currentPage < totalPages,
        prevPage: currentPage > 1 ? currentPage - 1 : null,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        totalProducts,
        totalSections,
        sectionsPerPage: SECTIONS_PER_PAGE,
        productsPerSection: PRODUCTS_PER_CONTAINER,
      } satisfies HomepagePagination,
    };
  },
  ["homepage-sections-page-v2"],
  { revalidate: PRODUCT_CACHE_SECONDS, tags: ["products", "homepage"] },
);

export async function getHomepageData(page = 1) {
  const [site, productPayload] = await Promise.all([getCachedSiteData(), getHomepageSectionsPage(page)]);

  if (!site) {
    return null;
  }

  return {
    ...site,
    ...productPayload,
  };
}

export type HomepageData = NonNullable<Awaited<ReturnType<typeof getHomepageData>>>;
