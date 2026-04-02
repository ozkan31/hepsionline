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
const variantsDir = path.join(uploadsDir, "variants");
const forceRegenerate = ["1", "true", "yes"].includes(String(process.env.FORCE_IMAGE_VARIANTS ?? "").trim().toLowerCase());
const IMAGE_VARIANT_SPECS = {
  thumb: { width: 200, quality: 72 },
  card: { width: 960, quality: 86 },
  detail: { width: 1280, quality: 88 },
};

function parseImagesJson(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeMediaPath(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value)) return value;
  if (/^(data:|blob:)/i.test(value)) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function isLocalUploadPath(rawValue) {
  const value = normalizeMediaPath(rawValue);
  return value.startsWith("/uploads/") || value.startsWith("/api/uploads/");
}

function resolveLocalUploadFileInfo(rawValue) {
  const value = normalizeMediaPath(rawValue);
  if (!isLocalUploadPath(value)) return null;
  const relativePath = value
    .replace(/^\/api\/uploads\//, "")
    .replace(/^\/uploads\//, "")
    .replace(/^\/+/, "");
  if (!relativePath) return null;
  return {
    relativePath,
    filePath: path.join(uploadsDir, relativePath),
  };
}

function buildVariantRelativePath(rawValue, variantKey) {
  const fileInfo = resolveLocalUploadFileInfo(rawValue);
  const variantSpec = IMAGE_VARIANT_SPECS[variantKey];
  if (!fileInfo || !variantSpec) return "";
  const parsedPath = path.parse(fileInfo.relativePath);
  const normalizedDir = String(parsedPath.dir ?? "").replace(/\\/g, "/");
  const filename = `${parsedPath.name}__${variantKey}.webp`;
  return [normalizedDir, filename].filter(Boolean).join("/");
}

async function ensureVariant(rawValue, variantKey) {
  const fileInfo = resolveLocalUploadFileInfo(rawValue);
  const variantSpec = IMAGE_VARIANT_SPECS[variantKey];
  if (!fileInfo || !variantSpec || !fs.existsSync(fileInfo.filePath)) {
    return false;
  }

  const relativeVariantPath = buildVariantRelativePath(rawValue, variantKey);
  if (!relativeVariantPath) {
    return false;
  }

  const targetPath = path.join(variantsDir, relativeVariantPath);
  const sourceStats = await fs.promises.stat(fileInfo.filePath);
  if (fs.existsSync(targetPath)) {
    if (forceRegenerate) {
      await fs.promises.rm(targetPath, { force: true });
    } else {
    const targetStats = await fs.promises.stat(targetPath);
    if (targetStats.mtimeMs >= sourceStats.mtimeMs) {
      return false;
    }
    }
  }

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await sharp(fileInfo.filePath, { animated: false })
    .rotate()
    .resize({
      width: variantSpec.width,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: variantSpec.quality })
    .toFile(targetPath);

  return true;
}

async function main() {
  await fs.promises.mkdir(variantsDir, { recursive: true });

  const [rows] = await pool.query(`
    SELECT id, image, images_json
    FROM products
    ORDER BY id ASC
  `);

  const seen = new Set();
  let generated = 0;

  for (const row of rows) {
    const sources = [
      normalizeMediaPath(row.image),
      ...parseImagesJson(row.images_json).map(normalizeMediaPath),
    ]
      .filter(Boolean)
      .filter((item) => isLocalUploadPath(item));

    for (const source of sources) {
      if (seen.has(source)) continue;
      seen.add(source);
      for (const variantKey of Object.keys(IMAGE_VARIANT_SPECS)) {
        const created = await ensureVariant(source, variantKey);
        if (created) {
          generated += 1;
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        uniqueImages: seen.size,
        generated,
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
