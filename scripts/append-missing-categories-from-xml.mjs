import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SITE_CONFIG_ID = 1;
const XML_FILE_CANDIDATES = ["\u00fcr\u00fcn.xml", "urun.xml", "xml.xml"];

function decodeEntities(value) {
  if (!value) return "";
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
  if (!value) return "";
  const trimmed = value.trim();
  const cdataMatch = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdataMatch ? cdataMatch[1] : trimmed;
}

function normalizeText(value) {
  return decodeEntities(unwrapCdata(value)).replace(/\s+/g, " ").trim();
}

function slugify(input) {
  return input
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractTagValue(xmlChunk, tagName) {
  const wrappedPattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const wrappedMatch = xmlChunk.match(wrappedPattern);
  if (wrappedMatch) return wrappedMatch[1] ?? "";
  const selfClosingPattern = new RegExp(`<${tagName}\\s*\\/\\s*>`, "i");
  if (selfClosingPattern.test(xmlChunk)) return "";
  return "";
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

function resolveXmlFilePath() {
  for (const fileName of XML_FILE_CANDIDATES) {
    const candidate = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function buildTreeFromXml(xmlText) {
  const rootMap = new Map();
  const chunks = splitProductChunks(xmlText);

  for (const chunk of chunks) {
    const rawPath = normalizeText(extractTagValue(chunk, "urun_kategori_path"));
    const mainCategoryName = normalizeText(extractTagValue(chunk, "urun_ana_kategori_ad"));
    const parentCategoryName = normalizeText(extractTagValue(chunk, "urun_ust_kategori_ad"));
    const categoryName = normalizeText(extractTagValue(chunk, "urun_kategori_ad"));

    const pathParts = rawPath
      ? rawPath.split("/").map((x) => x.trim()).filter(Boolean)
      : [mainCategoryName, parentCategoryName, categoryName].filter(Boolean);

    if (pathParts.length === 0) continue;

    const rootName = pathParts[0];
    if (!rootMap.has(rootName)) {
      rootMap.set(rootName, new Map());
    }
    const firstLevelMap = rootMap.get(rootName);

    const firstLevel = pathParts[1];
    const secondLevel = pathParts[2];

    if (!firstLevel) continue;
    if (!firstLevelMap.has(firstLevel)) {
      firstLevelMap.set(firstLevel, new Set());
    }
    const secondLevelSet = firstLevelMap.get(firstLevel);
    if (secondLevel) {
      secondLevelSet.add(secondLevel);
    }
  }

  return rootMap;
}

async function getNextSortOrder(siteConfigId, parentId) {
  const maxRow = await prisma.category.aggregate({
    where: { siteConfigId, parentId },
    _max: { sortOrder: true },
  });
  return (maxRow._max.sortOrder ?? -1) + 1;
}

async function findOrCreateCategory({ siteConfigId, parentId, label }) {
  const existing = await prisma.category.findFirst({
    where: { siteConfigId, parentId, label },
    orderBy: [{ id: "asc" }],
  });

  if (existing) return { category: existing, created: false };

  const created = await prisma.category.create({
    data: {
      siteConfigId,
      parentId,
      label,
      slug: slugify(label),
      isHighlighted: false,
      sortOrder: await getNextSortOrder(siteConfigId, parentId),
    },
  });
  return { category: created, created: true };
}

async function main() {
  const xmlFilePath = resolveXmlFilePath();
  if (!xmlFilePath) {
    throw new Error(`XML file not found. Checked: ${XML_FILE_CANDIDATES.join(", ")}`);
  }

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: SITE_CONFIG_ID }, select: { id: true } });
  if (!siteConfig) {
    throw new Error(`SiteConfig not found: ${SITE_CONFIG_ID}`);
  }

  const xmlText = fs.readFileSync(xmlFilePath, "utf8");
  const tree = buildTreeFromXml(xmlText);

  let addedRoot = 0;
  let addedChild = 0;
  let addedGrandChild = 0;

  for (const [rootLabel, childMap] of tree.entries()) {
    const root = await findOrCreateCategory({
      siteConfigId: siteConfig.id,
      parentId: null,
      label: rootLabel,
    });
    if (root.created) addedRoot += 1;

    for (const [childLabel, grandChildren] of childMap.entries()) {
      const child = await findOrCreateCategory({
        siteConfigId: siteConfig.id,
        parentId: root.category.id,
        label: childLabel,
      });
      if (child.created) addedChild += 1;

      for (const grandChildLabel of grandChildren.values()) {
        const grand = await findOrCreateCategory({
          siteConfigId: siteConfig.id,
          parentId: child.category.id,
          label: grandChildLabel,
        });
        if (grand.created) addedGrandChild += 1;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        siteConfigId: siteConfig.id,
        added: {
          root: addedRoot,
          child: addedChild,
          grandChild: addedGrandChild,
          total: addedRoot + addedChild + addedGrandChild,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("append-missing-categories-from-xml failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

