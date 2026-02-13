import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const XML_FILE_PATH = path.resolve(process.cwd(), "xml.xml");
const MARKUP_RATE = 0.45;
const PRODUCT_BATCH_SIZE = 80;
const VARIANT_BATCH_SIZE = 1000;

const FEED_TAGS = [
  "urun_aktif",
  "urun_metaKeywords",
  "urun_metaDescription",
  "urun_seo",
  "urun_url",
  "urun_ID",
  "urun_kod",
  "urun_gtin",
  "urun_xml_kod",
  "urun_ad",
  "urun_ana_kategori_kod_l4",
  "urun_ana_kategori_ad_l4",
  "urun_ana_kategori_kod_l3",
  "urun_ana_kategori_ad_l3",
  "urun_ana_kategori_kod_l2",
  "urun_ana_kategori_ad_l2",
  "urun_ana_kategori_kod",
  "urun_ana_kategori_ad",
  "urun_ust_kategori_kod",
  "urun_ust_kategori_ad",
  "urun_kategori_kod",
  "urun_kategori_ggkod",
  "urun_kategori_ad",
  "urun_kategori_path",
  "urun_marka_kod",
  "urun_marka_ad",
  "data1",
  "data2",
  "data3",
  "data4",
  "data5",
  "urun_ucretsizKargo",
  "urun_tanim",
  "urun_aciklama",
  "urun_ozellikler",
  "urun_resim1",
  "urun_resim2",
  "urun_resim3",
  "urun_resim4",
  "urun_resim5",
  "urun_resim6",
  "urun_resim7",
  "urun_resim8",
  "urun_fiyat",
  "urun_fiyat_TL",
  "urun_havale_fiyat_TL",
  "urun_fiyat_son_kullanici",
  "urun_fiyat_bayi_ozel",
  "urun_fiyat_site",
  "urun_fiyat_piyasa",
  "urun_doviz",
  "urun_kdv",
  "urun_stok",
  "urun_garanti",
  "urun_indirimde",
  "urun_kargo_desi",
  "urun_oncelik",
  "urun_varyasyonlari",
];

const SOURCE_DATA_EXCLUDED_TAGS = new Set([
  "urun_aciklama",
  "urun_ozellikler",
  "urun_varyasyonlari",
  "urun_resim1",
  "urun_resim2",
  "urun_resim3",
  "urun_resim4",
  "urun_resim5",
  "urun_resim6",
  "urun_resim7",
  "urun_resim8",
]);

function decodeEntities(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)));
}

function unwrapCdata(value) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  const cdataMatch = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? cdataMatch[1] : trimmed;
}

function normalizeText(value) {
  const decoded = decodeEntities(unwrapCdata(value));
  return decoded.replace(/\s+/g, " ").trim();
}

function normalizeHtml(value) {
  return unwrapCdata(value).trim();
}

function extractTagValue(xmlChunk, tagName) {
  const wrappedPattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const wrappedMatch = xmlChunk.match(wrappedPattern);
  if (wrappedMatch) {
    return wrappedMatch[1] ?? "";
  }

  const selfClosingPattern = new RegExp(`<${tagName}\\s*\\/\\s*>`, "i");
  if (selfClosingPattern.test(xmlChunk)) {
    return "";
  }

  return "";
}

function parseDecimal(value) {
  if (!value) {
    return null;
  }

  const trimmed = normalizeText(value);
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\s+/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  normalized = normalized.replace(/[^0-9.+-]/g, "");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value).replace(/[^0-9-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDbDecimal(value, digits = 4) {
  if (value === null || value === undefined) {
    return null;
  }

  const rounded = Number.parseFloat(value.toFixed(digits));
  return Number.isFinite(rounded) ? rounded.toFixed(digits) : null;
}

function parseVariantOption(variantChunk, index) {
  const optionMatch = variantChunk.match(new RegExp(`<var${index}\\b([^>]*)\\/?>`, "i"));
  if (!optionMatch) {
    return { name: null, value: null };
  }

  const attrsText = optionMatch[1] ?? "";
  const attrs = {};
  const attrsRegex = /([a-zA-Z0-9_:-]+)="([\s\S]*?)"/g;
  let attrMatch = null;

  while ((attrMatch = attrsRegex.exec(attrsText)) !== null) {
    attrs[attrMatch[1]] = decodeEntities(attrMatch[2] ?? "").trim();
  }

  return {
    name: attrs.baslik ? normalizeText(attrs.baslik) : null,
    value: attrs.varyasyon ? normalizeText(attrs.varyasyon) : null,
  };
}

function parseVariants(variantXml) {
  if (!variantXml || !variantXml.trim()) {
    return [];
  }

  const variants = [];
  const variantRegex = /<varyasyon>([\s\S]*?)<\/varyasyon>/gi;
  let variantMatch = null;
  let sortOrder = 0;

  while ((variantMatch = variantRegex.exec(variantXml)) !== null) {
    const variantChunk = variantMatch[1] ?? "";
    const option1 = parseVariantOption(variantChunk, 1);
    const option2 = parseVariantOption(variantChunk, 2);
    const option3 = parseVariantOption(variantChunk, 3);

    variants.push({
      sortOrder,
      option1Name: option1.name,
      option1Value: option1.value,
      option2Name: option2.name,
      option2Value: option2.value,
      option3Name: option3.name,
      option3Value: option3.value,
      priceDiff: toDbDecimal(parseDecimal(extractTagValue(variantChunk, "fiyat_fark"))),
      stock: parseInteger(extractTagValue(variantChunk, "stok")),
      gtin: normalizeText(extractTagValue(variantChunk, "gtin")) || null,
      stockCode: normalizeText(extractTagValue(variantChunk, "stok_kod")) || null,
      sourceData: {
        fiyat_fark: normalizeText(extractTagValue(variantChunk, "fiyat_fark")),
        stok: normalizeText(extractTagValue(variantChunk, "stok")),
        gtin: normalizeText(extractTagValue(variantChunk, "gtin")),
        stok_kod: normalizeText(extractTagValue(variantChunk, "stok_kod")),
      },
    });

    sortOrder += 1;
  }

  return variants;
}

function firstNonNull(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function getSourceProductId(fields, fallbackIndex) {
  const preferred = [
    normalizeText(fields.urun_ID),
    normalizeText(fields.urun_xml_kod),
    normalizeText(fields.urun_kod),
    normalizeText(fields.urun_gtin),
  ].find((value) => Boolean(value));

  if (preferred) {
    return preferred;
  }

  const fallbackName = normalizeText(fields.urun_ad).replace(/\s+/g, "-").slice(0, 64);
  return fallbackName ? `fallback-${fallbackIndex}-${fallbackName}` : `fallback-${fallbackIndex}`;
}

function splitProductChunks(xmlText) {
  const chunks = [];
  const productRegex = /<urun>([\s\S]*?)<\/urun>/gi;
  let productMatch = null;

  while ((productMatch = productRegex.exec(xmlText)) !== null) {
    chunks.push(productMatch[1] ?? "");
  }

  return chunks;
}

function buildProductRow(fields) {
  const name = normalizeText(fields.urun_ad) || "İsimsiz Ürün";
  const basePriceTry = firstNonNull(
    parseDecimal(fields.urun_fiyat_TL),
    parseDecimal(fields.urun_havale_fiyat_TL),
    parseDecimal(fields.urun_fiyat_site),
    parseDecimal(fields.urun_fiyat),
  );
  const priceWithMarkupTry = basePriceTry === null ? null : basePriceTry * (1 + MARKUP_RATE);

  const imageUrls = [];
  for (let imageIndex = 1; imageIndex <= 8; imageIndex += 1) {
    const imageUrl = normalizeText(fields[`urun_resim${imageIndex}`]);
    if (imageUrl) {
      imageUrls.push(imageUrl);
    }
  }

  const sourceData = {};
  for (const tag of FEED_TAGS) {
    if (SOURCE_DATA_EXCLUDED_TAGS.has(tag)) {
      continue;
    }
    sourceData[tag] = normalizeText(fields[tag]);
  }

  return {
    name,
    sourceCode: normalizeText(fields.urun_kod) || null,
    sourceXmlCode: normalizeText(fields.urun_xml_kod) || null,
    sourceSeo: normalizeText(fields.urun_seo) || null,
    sourceUrl: normalizeText(fields.urun_url) || null,
    isActive: normalizeText(fields.urun_aktif) === "1",
    summary: normalizeText(fields.urun_tanim) || null,
    descriptionHtml: normalizeHtml(fields.urun_aciklama) || null,
    featuresHtml: normalizeHtml(fields.urun_ozellikler) || null,
    brandCode: normalizeText(fields.urun_marka_kod) || null,
    brandName: normalizeText(fields.urun_marka_ad) || null,
    mainCategoryCode: normalizeText(fields.urun_ana_kategori_kod) || null,
    mainCategoryName: normalizeText(fields.urun_ana_kategori_ad) || null,
    parentCategoryCode: normalizeText(fields.urun_ust_kategori_kod) || null,
    parentCategoryName: normalizeText(fields.urun_ust_kategori_ad) || null,
    categoryCode: normalizeText(fields.urun_kategori_kod) || null,
    categoryName: normalizeText(fields.urun_kategori_ad) || null,
    categoryPath: normalizeText(fields.urun_kategori_path) || null,
    currency: normalizeText(fields.urun_doviz) || null,
    vatRate: toDbDecimal(parseDecimal(fields.urun_kdv)),
    stock: parseInteger(fields.urun_stok),
    shippingDesi: toDbDecimal(parseDecimal(fields.urun_kargo_desi)),
    basePrice: toDbDecimal(parseDecimal(fields.urun_fiyat)),
    basePriceTry: toDbDecimal(parseDecimal(fields.urun_fiyat_TL)),
    bankTransferPriceTry: toDbDecimal(parseDecimal(fields.urun_havale_fiyat_TL)),
    dealerPrice: toDbDecimal(parseDecimal(fields.urun_fiyat_bayi_ozel)),
    sitePrice: toDbDecimal(parseDecimal(fields.urun_fiyat_site)),
    endUserPrice: toDbDecimal(parseDecimal(fields.urun_fiyat_son_kullanici)),
    marketPrice: toDbDecimal(parseDecimal(fields.urun_fiyat_piyasa)),
    priceWithMarkupTry: toDbDecimal(priceWithMarkupTry),
    markupRate: toDbDecimal(MARKUP_RATE),
    freeShipping: normalizeText(fields.urun_ucretsizKargo) === "1",
    discounted: normalizeText(fields.urun_indirimde) === "1",
    primaryImageUrl: imageUrls[0] ?? null,
    imageUrls,
    sourceData,
  };
}

async function insertInBatches(model, rows, batchSize) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    if (batch.length === 0) {
      continue;
    }

    await model.createMany({
      data: batch,
      skipDuplicates: true,
    });

    console.log(`Inserted ${Math.min(offset + batch.length, rows.length)}/${rows.length}`);
  }
}

async function main() {
  if (!fs.existsSync(XML_FILE_PATH)) {
    throw new Error(`XML dosyası bulunamadı: ${XML_FILE_PATH}`);
  }

  console.log(`Reading XML: ${XML_FILE_PATH}`);
  const xmlText = fs.readFileSync(XML_FILE_PATH, "utf8");
  const productChunks = splitProductChunks(xmlText);
  console.log(`Found product chunks: ${productChunks.length}`);

  const productRows = [];
  const variantRows = [];
  const seenSourceProductIds = new Set();
  let duplicateSourceProductIdCount = 0;

  for (let index = 0; index < productChunks.length; index += 1) {
    const productChunk = productChunks[index];
    const fields = {};

    for (const tag of FEED_TAGS) {
      fields[tag] = extractTagValue(productChunk, tag);
    }

    const sourceProductId = getSourceProductId(fields, index + 1);
    if (seenSourceProductIds.has(sourceProductId)) {
      duplicateSourceProductIdCount += 1;
      continue;
    }
    seenSourceProductIds.add(sourceProductId);

    const row = buildProductRow(fields);
    productRows.push({
      sourceProductId,
      ...row,
    });

    const variants = parseVariants(fields.urun_varyasyonlari);
    for (const variant of variants) {
      variantRows.push({
        sourceProductId,
        ...variant,
      });
    }

    if ((index + 1) % 1000 === 0) {
      console.log(`Parsed ${index + 1}/${productChunks.length} products`);
    }
  }

  console.log(`Unique products to import: ${productRows.length}`);
  console.log(`Variants to import: ${variantRows.length}`);
  console.log(`Skipped duplicate source IDs: ${duplicateSourceProductIdCount}`);

  console.log("Clearing old imported XML data...");
  await prisma.$transaction([
    prisma.xmlImportedProductVariant.deleteMany({}),
    prisma.xmlImportedProduct.deleteMany({}),
  ]);

  console.log("Inserting products...");
  await insertInBatches(prisma.xmlImportedProduct, productRows, PRODUCT_BATCH_SIZE);

  console.log("Preparing variant product ID map...");
  const idMapRows = await prisma.xmlImportedProduct.findMany({
    select: {
      id: true,
      sourceProductId: true,
    },
  });
  const productIdBySourceId = new Map(idMapRows.map((row) => [row.sourceProductId, row.id]));

  const variantInsertRows = [];
  let orphanVariantCount = 0;
  for (const variant of variantRows) {
    const productId = productIdBySourceId.get(variant.sourceProductId);
    if (!productId) {
      orphanVariantCount += 1;
      continue;
    }

    variantInsertRows.push({
      productId,
      sortOrder: variant.sortOrder,
      option1Name: variant.option1Name,
      option1Value: variant.option1Value,
      option2Name: variant.option2Name,
      option2Value: variant.option2Value,
      option3Name: variant.option3Name,
      option3Value: variant.option3Value,
      priceDiff: variant.priceDiff,
      stock: variant.stock,
      gtin: variant.gtin,
      stockCode: variant.stockCode,
      sourceData: variant.sourceData,
    });
  }

  console.log(`Orphan variants skipped: ${orphanVariantCount}`);
  console.log(`Inserting variants: ${variantInsertRows.length}`);
  await insertInBatches(prisma.xmlImportedProductVariant, variantInsertRows, VARIANT_BATCH_SIZE);

  const [importedProductCount, importedVariantCount] = await Promise.all([
    prisma.xmlImportedProduct.count(),
    prisma.xmlImportedProductVariant.count(),
  ]);

  console.log("Import complete.");
  console.log(`DB xmlImportedProduct count: ${importedProductCount}`);
  console.log(`DB xmlImportedProductVariant count: ${importedVariantCount}`);
}

main()
  .catch((error) => {
    console.error("XML import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
