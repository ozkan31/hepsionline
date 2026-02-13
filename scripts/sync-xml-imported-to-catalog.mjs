import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 400;
const XML_SECTION_SLUG = "xml-katalog";

function decimalToNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function pickPriceWithMarkup(product) {
  const candidates = [
    decimalToNumber(product.priceWithMarkupTry),
    decimalToNumber(product.basePriceTry),
    decimalToNumber(product.sitePrice),
    decimalToNumber(product.endUserPrice),
    decimalToNumber(product.marketPrice),
  ];

  for (const candidate of candidates) {
    if (candidate !== null && candidate > 0) {
      return Math.max(1, Math.round(candidate));
    }
  }

  return 1;
}

function pickOldPrice(product, currentPrice) {
  const marketPrice = decimalToNumber(product.marketPrice);
  if (marketPrice !== null) {
    const roundedMarket = Math.max(1, Math.round(marketPrice));
    if (roundedMarket > currentPrice) {
      return roundedMarket;
    }
  }

  return Math.max(currentPrice + 1, Math.round(currentPrice * 1.2));
}

async function createProductsInBatches(rows) {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await prisma.product.createMany({
      data: batch,
    });
    console.log(`Catalog sync inserted ${Math.min(offset + batch.length, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { id: 1 },
    select: { id: true },
  });

  if (!siteConfig) {
    throw new Error("SiteConfig bulunamadı. Önce seed çalıştırılmalı.");
  }

  const section = await prisma.section.upsert({
    where: { slug: XML_SECTION_SLUG },
    update: {
      title: "XML Ürün Havuzu",
      icon: "fire",
      sortOrder: 1,
    },
    create: {
      siteConfigId: siteConfig.id,
      slug: XML_SECTION_SLUG,
      title: "XML Ürün Havuzu",
      icon: "fire",
      sortOrder: 1,
    },
    select: { id: true },
  });

  const sourceProducts = await prisma.xmlImportedProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      primaryImageUrl: true,
      discounted: true,
      stock: true,
      priceWithMarkupTry: true,
      basePriceTry: true,
      sitePrice: true,
      endUserPrice: true,
      marketPrice: true,
    },
  });

  console.log(`Catalog sync source products: ${sourceProducts.length}`);

  await prisma.$transaction([
    prisma.productBadge.deleteMany({}),
    prisma.product.deleteMany({}),
  ]);

  const productRows = sourceProducts.map((product, index) => {
    const currentPrice = pickPriceWithMarkup(product);
    const oldPrice = pickOldPrice(product, currentPrice);
    const ratingCount = ((product.id * 17) % 240) + 11;
    const filledStars = product.id % 5 === 0 ? 5 : 4;

    return {
      sectionId: section.id,
      name: product.name || `XML Ürün ${product.id}`,
      imageUrl: product.primaryImageUrl || null,
      imageAlt: product.name || `XML Ürün ${product.id}`,
      imageBroken: !product.primaryImageUrl,
      filledStars,
      ratingCount,
      price: currentPrice,
      oldPrice,
      addToCartLabel: "Sepete ekle",
      cartStateLabel: "Sepete eklendi",
      quantityControl: false,
      quantity: 1,
      showWishlist: true,
      sortOrder: index + 1,
    };
  });

  await createProductsInBatches(productRows);

  const insertedCount = await prisma.product.count();
  console.log(`Catalog sync complete. Product count: ${insertedCount}`);
}

main()
  .catch((error) => {
    console.error("Catalog sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
