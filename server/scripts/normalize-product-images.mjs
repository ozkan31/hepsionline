import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { pool } from "../db.mjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads");

function parseImagesJson(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toApiUploadPath(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/api/uploads/")) return value;
  if (value.startsWith("/uploads/")) {
    return `/api/uploads/${value.replace(/^\/uploads\//, "")}`;
  }
  return value;
}

function isLocalUploadPath(rawValue) {
  const value = String(rawValue ?? "").trim();
  return value.startsWith("/api/uploads/") || value.startsWith("/uploads/");
}

function resolveUploadFilePath(rawValue) {
  const value = toApiUploadPath(rawValue);
  if (!isLocalUploadPath(value)) return "";
  const relativePath = value.replace(/^\/api\/uploads\//, "").replace(/^\/+/, "");
  return path.join(uploadsDir, relativePath);
}

async function convertJfifToJpg(rawValue) {
  const normalized = toApiUploadPath(rawValue);
  if (!normalized) return normalized;

  const parsedUrl = normalized.split("?")[0];
  if (path.extname(parsedUrl).toLowerCase() !== ".jfif") {
    return normalized;
  }

  const sourcePath = resolveUploadFilePath(normalized);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return normalized;
  }

  const targetFilename = `${path.basename(sourcePath, path.extname(sourcePath))}.jpg`;
  const targetPath = path.join(path.dirname(sourcePath), targetFilename);
  if (!fs.existsSync(targetPath)) {
    await sharp(sourcePath, { animated: false })
      .rotate()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(targetPath);
  }

  return `/api/uploads/${targetFilename}`;
}

function normalizeImageList(images) {
  const seen = new Set();
  const result = [];
  for (const image of images) {
    const value = String(image ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

async function main() {
  const [rows] = await pool.query(`
    SELECT id, image, images_json
    FROM products
    ORDER BY id ASC
  `);

  let updatedProducts = 0;
  let convertedFiles = 0;

  for (const row of rows) {
    const rawImages = parseImagesJson(row.images_json);
    const normalizedPrimaryInput = toApiUploadPath(row.image);
    const normalizedImageInputs = normalizeImageList(
      rawImages.map((item) => toApiUploadPath(item)).filter(Boolean)
    );

    const convertedPrimary = await convertJfifToJpg(normalizedPrimaryInput);
    const convertedImages = [];
    for (const item of normalizedImageInputs) {
      const converted = await convertJfifToJpg(item);
      convertedImages.push(converted);
      if (converted !== item) {
        convertedFiles += 1;
      }
    }

    if (convertedPrimary && convertedPrimary !== normalizedPrimaryInput) {
      convertedFiles += 1;
    }

    const finalImages = normalizeImageList(
      convertedImages.length > 0
        ? convertedImages
        : convertedPrimary
          ? [convertedPrimary]
          : []
    );
    const finalPrimary = finalImages[0] ?? convertedPrimary ?? "";

    const originalImagesJson = JSON.stringify(normalizeImageList(normalizedImageInputs));
    const nextImagesJson = JSON.stringify(finalImages);
    const primaryChanged = finalPrimary !== normalizedPrimaryInput;
    const imagesChanged = nextImagesJson !== originalImagesJson;

    if (!primaryChanged && !imagesChanged) {
      continue;
    }

    await pool.query(
      `
      UPDATE products
      SET image = ?, images_json = ?
      WHERE id = ?
      `,
      [finalPrimary, nextImagesJson, row.id]
    );
    updatedProducts += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        updatedProducts,
        convertedFiles,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: error?.message ?? String(error),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
