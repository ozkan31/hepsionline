import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.mjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "../../uploads");

const PRODUCT_DEFINITIONS = [
  {
    folder: "1",
    id: "angel-polo-uploads-1",
    name: "Limon Sarısı Mini El Çantası",
    price: 1890,
    stock: 12,
    barcode: "AP-2026-001",
    category: "mini",
    description:
      "Yumuşak limon sarısı tonu ve dik duruşlu formuyla günlük kombinlere ferah bir dokunuş katan mini el çantası.",
    features: ["Kompakt gövde", "Sabit çift sap", "Çıkarılabilir askı aparatı"],
    colors: ["Limon Sarısı"],
    tags: ["mini", "günlük", "ilkbahar"],
    isNew: true,
    isBestseller: false,
  },
  {
    folder: "2",
    id: "angel-polo-uploads-2",
    name: "Pudra Pembe Zincir Detaylı Çanta",
    price: 2190,
    stock: 9,
    barcode: "AP-2026-002",
    category: "mini",
    description:
      "İnce uzun silueti ve altın tonlu kilit detayıyla davet stiline de günlük kullanıma da uyum sağlayan pudra pembe model.",
    features: ["Metal kilit kapama", "Zincir detaylı askı bağlantısı", "Uzun cüzdan formu"],
    colors: ["Pudra Pembe"],
    tags: ["mini", "davet", "zincir detay"],
    isNew: true,
    isBestseller: true,
  },
  {
    folder: "3",
    id: "angel-polo-uploads-3",
    name: "Şampanya Beji Kutu Form Çanta",
    price: 2390,
    stock: 10,
    barcode: "AP-2026-003",
    category: "shoulder",
    description:
      "Şampanya beji tonundaki kutu form gövdesiyle sade ve derli toplu bir görünüm sunan, şehir kullanımı için dengeli boyutta çanta.",
    features: ["Dik duruşlu yapı", "Çift taşıma sapı", "Geniş taban hacmi"],
    colors: ["Şampanya Beji"],
    tags: ["omuz", "şehir stili", "minimal"],
    isNew: false,
    isBestseller: false,
  },
  {
    folder: "4",
    id: "angel-polo-uploads-4",
    name: "Buz Mavisi Kapitone Omuz Çantası",
    price: 2490,
    stock: 8,
    barcode: "AP-2026-004",
    category: "shoulder",
    description:
      "Parlak buz mavisi kapitone yüzeyiyle öne çıkan, klasik omuz çantası formunu daha modern bir çizgiyle yorumlayan model.",
    features: ["Kapitone yüzey", "Uzun omuz sapları", "Parlak metal detaylar"],
    colors: ["Buz Mavisi"],
    tags: ["omuz", "kapitone", "özel stil"],
    isNew: true,
    isBestseller: true,
  },
  {
    folder: "5",
    id: "angel-polo-uploads-5",
    name: "Metalik Gümüş Mini Çanta",
    price: 2290,
    stock: 7,
    barcode: "AP-2026-005",
    category: "mini",
    description:
      "Metalik gümüş yüzeyi ve belirgin taşıma kulbu ile akşam kombinlerinde dikkat çeken, kompakt boyutlu mini çanta.",
    features: ["Metalik parlak yüzey", "Üstten fermuarlı yapı", "Sert form kulp"],
    colors: ["Metalik Gümüş"],
    tags: ["mini", "gece", "metalik"],
    isNew: true,
    isBestseller: false,
  },
  {
    folder: "6",
    id: "angel-polo-uploads-6",
    name: "Monogram Bej Omuz Çantası",
    price: 2590,
    stock: 11,
    barcode: "AP-2026-006",
    category: "shoulder",
    description:
      "Monogram desenli gövdesi ve nötr bej tonlarıyla hem ofis hem günlük kullanıma uyum sağlayan geniş omuz çantası.",
    features: ["Monogram desenli yüzey", "Uzun omuz sapları", "Dengeli orta boy hacim"],
    colors: ["Bej", "Vizon"],
    tags: ["omuz", "monogram", "günlük"],
    isNew: false,
    isBestseller: true,
  },
  {
    folder: "7",
    id: "angel-polo-uploads-7",
    name: "Siyah Tokalı Baguette Çanta",
    price: 2090,
    stock: 13,
    barcode: "AP-2026-007",
    category: "shoulder",
    description:
      "Altın tonlu büyük toka detayıyla öne çıkan siyah baguette model, sade kombinlere güçlü bir vurgu ekler.",
    features: ["Baguette siluet", "Ön tokalı kapama", "Kısa omuz askısı"],
    colors: ["Siyah"],
    tags: ["omuz", "baguette", "siyah"],
    isNew: false,
    isBestseller: true,
  },
  {
    folder: "8",
    id: "angel-polo-uploads-8",
    name: "Pudra Hasır Dokulu Mini Çanta",
    price: 1990,
    stock: 10,
    barcode: "AP-2026-008",
    category: "mini",
    description:
      "Hasır dokulu yüzeyi ve pudra tonlu sap detaylarıyla yaz kombinlerine hafif ve zarif bir hava katan mini model.",
    features: ["Dokulu örgü yüzey", "Sert form mini gövde", "Çift kısa sap"],
    colors: ["Pudra", "Açık Pembe"],
    tags: ["mini", "yaz", "dokulu"],
    isNew: true,
    isBestseller: false,
  },
  {
    folder: "9",
    id: "angel-polo-uploads-9",
    name: "Vizon Dokulu El ve Omuz Çantası",
    price: 2690,
    stock: 9,
    barcode: "AP-2026-009",
    category: "shoulder",
    description:
      "Dokulu vizon yüzeyi, dengeli genişliği ve şık kilit detayıyla hem elde hem omuzda taşımaya uygun zamansız model.",
    features: ["Dokulu dış yüzey", "Çift kullanım formu", "Metal kilit şerit detayı"],
    colors: ["Vizon"],
    tags: ["omuz", "klasik", "dokulu"],
    isNew: false,
    isBestseller: true,
  },
];

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".jfif"]);

function toStoredUploadPath(folderName, fileName) {
  return `/uploads/${folderName}/${fileName}`.replace(/\\/g, "/");
}

function getFolderImages(folderName) {
  const folderPath = path.join(uploadsRoot, folderName);
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Uploads klasoru bulunamadi: ${folderPath}`);
  }

  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "tr"))
    .map((fileName) => toStoredUploadPath(folderName, fileName));
}

async function ensureCategoriesExist(categories) {
  const uniqueCategories = [...new Set(categories)];
  if (uniqueCategories.length === 0) return;

  const placeholders = uniqueCategories.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT id FROM categories WHERE id IN (${placeholders})`,
    uniqueCategories
  );
  const existing = new Set(rows.map((row) => String(row.id ?? "").trim()));
  const missing = uniqueCategories.filter((category) => !existing.has(category));
  if (missing.length > 0) {
    throw new Error(`Eksik kategori kayitlari: ${missing.join(", ")}`);
  }
}

async function upsertProduct(definition) {
  const images = getFolderImages(definition.folder);
  if (images.length === 0) {
    throw new Error(`Klasorde gorsel bulunamadi: uploads/${definition.folder}`);
  }

  await pool.query(
    `
    INSERT INTO products (
      id, name, price, stock, barcode, image, images_json, category_id, description,
      features_json, colors_json, tags_json, is_new, is_bestseller
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      price = VALUES(price),
      stock = VALUES(stock),
      barcode = VALUES(barcode),
      image = VALUES(image),
      images_json = VALUES(images_json),
      category_id = VALUES(category_id),
      description = VALUES(description),
      features_json = VALUES(features_json),
      colors_json = VALUES(colors_json),
      tags_json = VALUES(tags_json),
      is_new = VALUES(is_new),
      is_bestseller = VALUES(is_bestseller)
    `,
    [
      definition.id,
      definition.name,
      definition.price,
      definition.stock,
      definition.barcode,
      images[0],
      JSON.stringify(images),
      definition.category,
      definition.description,
      JSON.stringify(definition.features),
      JSON.stringify(definition.colors),
      JSON.stringify(definition.tags),
      Boolean(definition.isNew),
      Boolean(definition.isBestseller),
    ]
  );

  return { id: definition.id, name: definition.name, imageCount: images.length };
}

async function main() {
  await ensureCategoriesExist(PRODUCT_DEFINITIONS.map((item) => item.category));

  const results = [];
  for (const definition of PRODUCT_DEFINITIONS) {
    results.push(await upsertProduct(definition));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        imported: results.length,
        products: results,
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
