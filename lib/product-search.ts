import { buildProductSlug } from "@/lib/product-slug";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

const productSearchSelect = {
  id: true,
  name: true,
  price: true,
  oldPrice: true,
  filledStars: true,
  ratingCount: true,
  addToCartLabel: true,
  cartStateLabel: true,
  showWishlist: true,
  imageUrl: true,
  imageAlt: true,
  imageBroken: true,
  quantity: true,
  quantityControl: true,
  section: {
    select: {
      slug: true,
      title: true,
    },
  },
  badges: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      label: true,
      tone: true,
    },
  },
} satisfies Prisma.ProductSelect;

type SearchProductRecord = Prisma.ProductGetPayload<{
  select: typeof productSearchSelect;
}>;

export type SearchProductResult = SearchProductRecord & {
  slug: string;
};

export type ProductSearchSort = "relevance" | "price_asc" | "price_desc" | "rating_desc" | "newest";

type SearchOptions = {
  limit?: number;
  preferStartsWith?: boolean;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRating?: number | null;
  discountedOnly?: boolean;
  inStockOnly?: boolean;
  sectionSlug?: string | null;
  sort?: ProductSearchSort;
};

export type SmartSearchResult = {
  products: SearchProductResult[];
  correctedQuery: string | null;
  suggestions: string[];
  usedFuzzy: boolean;
};

function clampNumber(value: number | null | undefined, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return Math.floor(value);
}

function getOrderBy(sort: ProductSearchSort): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "price_asc") {
    return [{ price: "asc" }, { id: "asc" }];
  }

  if (sort === "price_desc") {
    return [{ price: "desc" }, { id: "desc" }];
  }

  if (sort === "rating_desc") {
    return [{ filledStars: "desc" }, { ratingCount: "desc" }, { id: "desc" }];
  }

  if (sort === "newest") {
    return [{ id: "desc" }];
  }

  return [{ sortOrder: "asc" }, { id: "asc" }];
}

function buildFilterClauses(options?: SearchOptions): Prisma.ProductWhereInput[] {
  const clauses: Prisma.ProductWhereInput[] = [];

  const minPrice = clampNumber(options?.minPrice ?? null, 0, 1_000_000_000);
  const maxPrice = clampNumber(options?.maxPrice ?? null, 0, 1_000_000_000);
  const minRating = clampNumber(options?.minRating ?? null, 1, 5);
  const sectionSlug = options?.sectionSlug?.trim();

  if (minPrice !== null) {
    clauses.push({
      price: {
        gte: minPrice,
      },
    });
  }

  if (maxPrice !== null) {
    clauses.push({
      price: {
        lte: maxPrice,
      },
    });
  }

  if (minRating !== null) {
    clauses.push({
      filledStars: {
        gte: minRating,
      },
    });
  }

  if (options?.discountedOnly) {
    clauses.push({
      oldPrice: {
        not: null,
      },
    });
  }

  if (options?.inStockOnly) {
    clauses.push({
      OR: [
        {
          quantityControl: false,
        },
        {
          quantity: {
            gt: 0,
          },
        },
      ],
    });
  }

  if (sectionSlug) {
    clauses.push({
      section: {
        slug: sectionSlug,
      },
    });
  }

  return clauses;
}

export async function searchProducts(rawQuery: string, options?: SearchOptions): Promise<SearchProductResult[]> {
  const query = rawQuery.trim();
  if (!query || query.length > 64) {
    return [];
  }

  const safeLimit = Math.min(Math.max(options?.limit ?? 8, 1), 64);
  const preferStartsWith = options?.preferStartsWith ?? true;
  const sort = options?.sort ?? "relevance";
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = preferStartsWith
    ? [{ sortOrder: "asc" }, { id: "asc" }]
    : getOrderBy(sort);
  const filterClauses = buildFilterClauses(options);

  if (!preferStartsWith) {
    const products = await prisma.product.findMany({
      where: {
        AND: [
          ...filterClauses,
          {
            name: {
              contains: query,
            },
          },
        ],
      },
      orderBy,
      take: safeLimit,
      select: productSearchSelect,
    });

    return products.map((product) => ({
      ...product,
      slug: buildProductSlug(product.name, product.id),
    }));
  }

  const startsWithProducts = await prisma.product.findMany({
    where: {
      AND: [
        ...filterClauses,
        {
          name: {
            startsWith: query,
          },
        },
      ],
    },
    orderBy,
    take: safeLimit,
    select: productSearchSelect,
  });

  const usedIds = startsWithProducts.map((product) => product.id);
  const remaining = Math.max(0, safeLimit - startsWithProducts.length);

  const containsProducts: SearchProductRecord[] =
    remaining > 0
      ? await prisma.product.findMany({
          where: {
            AND: [
              ...filterClauses,
              {
                name: {
                  contains: query,
                },
              },
              ...(usedIds.length > 0
                ? [
                    {
                      id: {
                        notIn: usedIds,
                      },
                    },
                  ]
                : []),
            ],
          },
          orderBy,
          take: remaining,
          select: productSearchSelect,
        })
      : [];

  return [...startsWithProducts, ...containsProducts].map((product) => ({
    ...product,
    slug: buildProductSlug(product.name, product.id),
  }));
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[rows - 1][cols - 1];
}

const getSearchDictionary = unstable_cache(
  async () =>
    prisma.product.findMany({
      select: {
        name: true,
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: 1200,
    }),
  ["search-dictionary-v1"],
  { revalidate: 120 },
);

const getSectionSuggestions = unstable_cache(
  async () =>
    prisma.section.findMany({
      select: { title: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: 100,
    }),
  ["search-sections-v1"],
  { revalidate: 300 },
);

async function findFuzzyCandidate(rawQuery: string) {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery || normalizedQuery.length < 3) return null;

  const dict = await getSearchDictionary();
  let best: { value: string; distance: number } | null = null;

  for (const row of dict) {
    const normalizedName = normalizeSearchText(row.name);
    if (!normalizedName) continue;
    const tokens = normalizedName.split(" ");
    for (const token of tokens) {
      if (!token || Math.abs(token.length - normalizedQuery.length) > 3) continue;
      const distance = levenshtein(normalizedQuery, token);
      const threshold = Math.max(1, Math.floor(Math.max(token.length, normalizedQuery.length) * 0.34));
      if (distance > threshold) continue;

      if (!best || distance < best.distance) {
        best = { value: token, distance };
      }
    }
  }

  return best?.value ?? null;
}

async function buildSuggestions(query: string, products: SearchProductResult[]) {
  const normalizedQuery = normalizeSearchText(query);
  const productNames = products.map((p) => p.name).filter(Boolean).slice(0, 5);
  const sections = await getSectionSuggestions();
  const sectionMatches = sections
    .map((s) => s.title)
    .filter((title) => normalizeSearchText(title).includes(normalizedQuery))
    .slice(0, 3);

  return [...new Set([...productNames, ...sectionMatches])].slice(0, 6);
}

export async function searchProductsSmart(rawQuery: string, options?: SearchOptions): Promise<SmartSearchResult> {
  const query = rawQuery.trim();
  if (!query || query.length > 64) {
    return { products: [], correctedQuery: null, suggestions: [], usedFuzzy: false };
  }

  const direct = await searchProducts(query, options);
  if (direct.length > 0) {
    const suggestions = await buildSuggestions(query, direct);
    return {
      products: direct,
      correctedQuery: null,
      suggestions,
      usedFuzzy: false,
    };
  }

  const fuzzy = await findFuzzyCandidate(query);
  if (!fuzzy || fuzzy === normalizeSearchText(query)) {
    return { products: [], correctedQuery: null, suggestions: [], usedFuzzy: false };
  }

  const fuzzyProducts = await searchProducts(fuzzy, options);
  const suggestions = await buildSuggestions(fuzzy, fuzzyProducts);
  return {
    products: fuzzyProducts,
    correctedQuery: fuzzy,
    suggestions,
    usedFuzzy: fuzzyProducts.length > 0,
  };
}
