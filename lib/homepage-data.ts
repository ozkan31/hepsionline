import { prisma } from "@/lib/prisma";

const PRODUCTS_PER_PAGE = 48;

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

function hashSeed(input: string) {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRng(seed: string) {
  let state = hashSeed(seed) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffleIdsDeterministic(ids: number[], seed: string) {
  const result = [...ids];
  const random = createSeededRng(seed);

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

async function getSiteData() {
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
}

async function getHomeFeedFooterGateEnabled() {
  const settings = await prisma.adminSetting.findUnique({
    where: { id: 1 },
    select: { featureToggles: true },
  });

  const toggles =
    settings?.featureToggles && typeof settings.featureToggles === "object"
      ? (settings.featureToggles as Record<string, unknown>)
      : null;

  return toggles?.home_feed_footer_gate === true;
}

export async function getHomepageSectionsPage(page: number, feedSeed: string) {
  const parsedPage = parsePage(page);

  const allProductIds = await prisma.product.findMany({
    orderBy: [{ id: "desc" }],
    select: { id: true },
  });

  const orderedIds = shuffleIdsDeterministic(
    allProductIds.map((row) => row.id),
    feedSeed,
  );

  const totalProducts = orderedIds.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(parsedPage, totalPages);
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageProductIds = orderedIds.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

  const rawProducts = pageProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: pageProductIds } },
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
      })
    : [];

  const productById = new Map(rawProducts.map((product) => [product.id, product]));
  const products = pageProductIds
    .map((id) => productById.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  const sections: HomepageSection[] = products.length
    ? [
        {
          id: 900000 + currentPage,
          slug: `sizin-icin-oneriler-${currentPage}`,
          title: "Sizin için öneriler",
          icon: "fire",
          sortOrder: 1,
          siteConfigId: 1,
          products,
        },
      ]
    : [];

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
      totalSections: totalPages,
      sectionsPerPage: 1,
      productsPerSection: PRODUCTS_PER_PAGE,
    } satisfies HomepagePagination,
  };
}

export async function getHomepageData(page = 1, feedSeedOverride?: string) {
  const normalizedSeed = typeof feedSeedOverride === "string" ? feedSeedOverride.trim() : "";
  const feedSeed =
    normalizedSeed.length > 0 && normalizedSeed.length <= 120
      ? normalizedSeed
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const [site, productPayload, homeFeedFooterGateEnabled] = await Promise.all([
    getSiteData(),
    getHomepageSectionsPage(page, feedSeed),
    getHomeFeedFooterGateEnabled(),
  ]);

  if (!site) {
    return null;
  }

  return {
    ...site,
    feedSeed,
    homeFeedFooterGateEnabled,
    ...productPayload,
  };
}

export type HomepageData = NonNullable<Awaited<ReturnType<typeof getHomepageData>>>;
