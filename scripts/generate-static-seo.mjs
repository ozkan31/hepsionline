import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { fileURLToPath } from "node:url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const distIndexPath = path.join(distDir, "index.html");
const robotsPath = path.join(distDir, "robots.txt");
const sitemapPath = path.join(distDir, "sitemap.xml");
const baseUrl = String(process.env.PUBLIC_SITE_URL ?? process.env.ORDER_EMAIL_BASE_URL ?? "https://stilbagsfashion.com")
  .trim()
  .replace(/\/+$/, "")
  .replace(/^((?!https?:\/\/).)+$/i, "https://$&");

const BRAND = "StilBags&Fashion";
const DEFAULT_IMAGE = `${baseUrl}/banner1.jpg`;
const defaultRobots = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const categoryLabels = {
  crossbody: "Çapraz Çantalar",
  mini: "Mini Çantalar",
  shoulder: "Omuz Çantaları",
  new: "Yeni Gelenler",
};

const categoryPages = {
  crossbody: {
    slug: "capraz-cantalar",
    name: "Çapraz Çantalar",
    title: `Çapraz Çantalar | ${BRAND}`,
    description:
      "Günlük kullanım, şehir stili ve zarif kombinler için seçilen çapraz çanta modellerini StilBags&Fashion koleksiyonunda keşfedin.",
    image: "/cat_crossbody.jpg",
  },
  mini: {
    slug: "mini-cantalar",
    name: "Mini Çantalar",
    title: `Mini Çantalar | ${BRAND}`,
    description:
      "Özel davetlerden günlük kombinlere kadar her stile uyum sağlayan mini çanta modellerini StilBags&Fashion ile inceleyin.",
    image: "/cat_mini.jpg",
  },
  shoulder: {
    slug: "omuz-cantalari",
    name: "Omuz Çantaları",
    title: `Omuz Çantaları | ${BRAND}`,
    description:
      "Şıklık ve konforu bir araya getiren omuz çantası modellerini StilBags&Fashion koleksiyonunda keşfedin.",
    image: "/cat_shoulder.jpg",
  },
  new: {
    slug: "yeni-gelenler",
    name: "Yeni Gelenler",
    title: `Yeni Gelenler | ${BRAND}`,
    description: "Sezonun öne çıkan yeni çanta modellerini ve en güncel StilBags&Fashion seçkisini keşfedin.",
    image: "/cat_new.jpg",
  },
};

function normalizeText(value) {
  return String(value ?? "")
    .replaceAll("Ã¼", "ü")
    .replaceAll("Ãœ", "Ü")
    .replaceAll("Ã¶", "ö")
    .replaceAll("Ã–", "Ö")
    .replaceAll("Ã§", "ç")
    .replaceAll("Ã‡", "Ç")
    .replaceAll("ÄŸ", "ğ")
    .replaceAll("Äž", "Ğ")
    .replaceAll("ÅŸ", "ş")
    .replaceAll("Å", "Ş")
    .replaceAll("Ä±", "ı")
    .replaceAll("Ä°", "İ")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("â€“", "-")
    .replaceAll("â€¦", "...")
    .replaceAll("Â", "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const clean = normalizeText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toAbsoluteUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `${baseUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function toDirectoryPath(route) {
  const normalized = String(route ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!normalized) return "/";
  return `/${normalized}/`;
}

function normalizeImagePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/api/uploads/") || raw.startsWith("/api/products/")) return raw;
  if (raw.startsWith("/uploads/")) return raw.replace(/^\/uploads\//i, "/api/uploads/");
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function replaceTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function replaceMetaByName(html, name, content) {
  const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["'][^"']*["'][^>]*>`, "i");
  const replacement = `<meta name="${name}" content="${escapeHtml(content)}" />`;
  return regex.test(html) ? html.replace(regex, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function replaceMetaByProperty(html, property, content) {
  const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["'][^"']*["'][^>]*>`, "i");
  const replacement = `<meta property="${property}" content="${escapeHtml(content)}" />`;
  return regex.test(html) ? html.replace(regex, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function replaceCanonical(html, href) {
  const regex = /<link[^>]*rel=["']canonical["'][^>]*href=["'][^"']*["'][^>]*>/i;
  const replacement = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  return regex.test(html) ? html.replace(regex, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function clearPrerenderSchemas(html) {
  return html.replace(/\s*<script type="application\/ld\+json" data-prerender="true">[\s\S]*?<\/script>/gi, "");
}

function buildBaseSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: BRAND,
      url: baseUrl,
      logo: `${baseUrl}/banner1.jpg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: BRAND,
      url: baseUrl,
      inLanguage: "tr-TR",
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/shop?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

function buildWebPageSchema(canonicalUrl, title, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    inLanguage: "tr-TR",
    url: canonicalUrl,
  };
}

function applySeo(template, payload) {
  const title = truncateText(payload.title, 65);
  const description = truncateText(payload.description, 170);
  const canonicalUrl = toAbsoluteUrl(payload.canonicalPath || "/");
  const imageUrl = toAbsoluteUrl(payload.image || "/banner1.jpg");
  const robots = payload.noindex ? "noindex, nofollow, noarchive" : defaultRobots;
  let html = clearPrerenderSchemas(template);
  html = replaceTitle(html, title);
  html = replaceMetaByName(html, "description", description);
  html = replaceMetaByName(html, "robots", robots);
  html = replaceMetaByProperty(html, "og:locale", "tr_TR");
  html = replaceMetaByProperty(html, "og:type", payload.type || "website");
  html = replaceMetaByProperty(html, "og:site_name", BRAND);
  html = replaceMetaByProperty(html, "og:title", title);
  html = replaceMetaByProperty(html, "og:description", description);
  html = replaceMetaByProperty(html, "og:url", canonicalUrl);
  html = replaceMetaByProperty(html, "og:image", imageUrl);
  html = replaceMetaByName(html, "twitter:card", "summary_large_image");
  html = replaceMetaByName(html, "twitter:title", title);
  html = replaceMetaByName(html, "twitter:description", description);
  html = replaceMetaByName(html, "twitter:image", imageUrl);
  html = replaceCanonical(html, canonicalUrl);

  const schemas = Array.isArray(payload.schema) ? payload.schema : payload.schema ? [payload.schema] : [];
  if (schemas.length > 0) {
    const schemaMarkup = schemas
      .filter(Boolean)
      .map((item) => `    <script type="application/ld+json" data-prerender="true">${JSON.stringify(item)}</script>`)
      .join("\n");
    html = html.replace("</head>", `${schemaMarkup}\n  </head>`);
  }

  return html;
}

function ensureRouteFile(relativePath, html) {
  const normalized = String(relativePath ?? "").trim().replace(/^\/+|\/+$/g, "");
  const targetDir = normalized ? path.join(distDir, normalized) : distDir;
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
}

function buildStaticPageConfigs() {
  const baseSchemas = buildBaseSchemas();
  const configs = [
    {
      route: "",
      title: `${BRAND} | Kadın Çanta ve Aksesuar Modelleri`,
      description: "StilBags&Fashion kadın çanta ve aksesuar koleksiyonlarını keşfedin. Şık, modern ve günlük kullanıma uygun modeller tek adreste.",
      image: "/banner1.jpg",
      type: "website",
    },
    {
      route: "shop",
      title: `Tüm Ürünler | ${BRAND}`,
      description: "Kadın çanta ve aksesuar koleksiyonunun tamamını StilBags&Fashion ürünler sayfasında keşfedin.",
      image: "/banner2.jpg",
      type: "website",
    },
    {
      route: "hakkimizda",
      title: `Hikayemiz | ${BRAND}`,
      description: "StilBags&Fashion markasının hikayesini, üretim yaklaşımını ve tasarım anlayışını keşfedin.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "iletisim",
      title: `İletişim | ${BRAND}`,
      description: "StilBags&Fashion müşteri destek ekibine ulaşın ve tüm soru, öneri ve taleplerinizi iletin.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "kargo",
      title: `Kargo Bilgileri | ${BRAND}`,
      description: "Sipariş hazırlık, kargolama ve teslimat süreçleri hakkında detaylı bilgilere ulaşın.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "iade",
      title: `İade Politikası | ${BRAND}`,
      description: "İade koşulları, iade süresi ve iade işlemleri hakkında bilmeniz gereken tüm detaylar.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "sss",
      title: `Sık Sorulan Sorular | ${BRAND}`,
      description: "Sipariş, ödeme, teslimat ve iade süreçlerine dair en çok sorulan soruların yanıtları.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "gizlilik",
      title: `Gizlilik Politikası | ${BRAND}`,
      description: "Kişisel verilerinizin işlenmesi, korunması ve saklanmasına ilişkin gizlilik politikamız.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "kullanim-kosullari",
      title: `Kullanım Koşulları | ${BRAND}`,
      description: "Site kullanım koşulları, hak ve yükümlülükler ile hukuki bilgilendirme metinleri.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "surdurulebilirlik",
      title: `Sürdürülebilirlik | ${BRAND}`,
      description: "StilBags&Fashion sürdürülebilirlik yaklaşımı ve sorumlu üretim anlayışını inceleyin.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "kariyer",
      title: `Kariyer | ${BRAND}`,
      description: "StilBags&Fashion kariyer fırsatları ve başvuru süreçleri hakkında bilgi alın.",
      image: "/banner3.jpg",
      type: "website",
    },
    {
      route: "giris",
      title: `Giriş Yap | ${BRAND}`,
      description: "StilBags&Fashion hesabınıza giriş yapın veya yeni hesap oluşturun.",
      image: "/banner1.jpg",
      type: "website",
      noindex: true,
    },
    {
      route: "hesabim",
      title: `Hesabım | ${BRAND}`,
      description: "StilBags&Fashion hesap bilgilerinizi ve sipariş geçmişinizi yönetin.",
      image: "/banner1.jpg",
      type: "website",
      noindex: true,
    },
    {
      route: "sepet",
      title: `Sepetim | ${BRAND}`,
      description: "Sepetinizdeki ürünleri gözden geçirin ve alışverişinizi tamamlayın.",
      image: "/banner1.jpg",
      type: "website",
      noindex: true,
    },
    {
      route: "favoriler",
      title: `Favorilerim | ${BRAND}`,
      description: "Beğendiğiniz StilBags&Fashion ürünlerini favorilerinizde saklayın.",
      image: "/banner1.jpg",
      type: "website",
      noindex: true,
    },
    {
      route: "odeme",
      title: `Ödeme | ${BRAND}`,
      description: "Siparişinizi güvenli ödeme adımıyla tamamlayın.",
      image: "/banner1.jpg",
      type: "website",
      noindex: true,
    },
    {
      route: "akalin1453",
      title: `Admin Paneli | ${BRAND}`,
      description: "Yönetim paneli.",
      image: "/banner1.jpg",
      type: "website",
      noindex: true,
    },
  ];

  return configs.map((item) => {
    const routePath = toDirectoryPath(item.route);
    const canonicalPath = item.canonicalPath ?? (routePath || "/");
    return {
      ...item,
      canonicalPath,
      schema: [...baseSchemas, buildWebPageSchema(toAbsoluteUrl(canonicalPath), item.title, item.description)],
    };
  });
}

async function getDatabaseRows() {
  const required = ["MYSQL_HOST", "MYSQL_PORT", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"];
  const hasDbConfig = required.every((key) => String(process.env[key] ?? "").trim());
  if (!hasDbConfig) {
    console.warn("[seo] DB ayarlari eksik. Ürün sayfaları ve dinamik sitemap sınırlı üretilecek.");
    return { products: [], categories: [] };
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      timezone: "Z",
    });

    const [products] = await connection.query(`
      SELECT id, name, price, image, images_json, category_id, description, updated_at
      FROM products
      ORDER BY id ASC
    `);
    const [categories] = await connection.query(`SELECT id FROM categories ORDER BY id ASC`);
    return { products, categories };
  } catch (error) {
    console.warn("[seo] DB verileri alınamadı:", error instanceof Error ? error.message : error);
    return { products: [], categories: [] };
  } finally {
    if (connection) {
      await connection.end().catch(() => undefined);
    }
  }
}

function getProductImages(row) {
  let images = [];
  try {
    const parsed = JSON.parse(String(row.images_json ?? "[]"));
    if (Array.isArray(parsed)) images = parsed;
  } catch {
    images = [];
  }
  if (images.length === 0 && row.image) {
    images = [row.image];
  }
  return images
    .map((item) => normalizeImagePath(item))
    .filter(Boolean)
    .map((item) => toAbsoluteUrl(item));
}

function getCategoryLabel(categoryId) {
  return categoryLabels[String(categoryId ?? "").trim()] ?? "Kadın Çanta";
}

function getCategoryPageConfig(categoryId) {
  return categoryPages[String(categoryId ?? "").trim()] ?? null;
}

function buildCategorySeo(row) {
  const categoryId = String(row.id ?? "").trim();
  const config = getCategoryPageConfig(categoryId);
  if (!config) return null;

  const canonicalPath = `/kategori/${config.slug}/`;
  const title = config.title;
  const description =
    truncateText(normalizeText(row.description || config.description || `${config.name} koleksiyonunu keşfedin.`), 170) ||
    config.description;
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Ana Sayfa",
        item: `${baseUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ürünler",
        item: `${baseUrl}/shop/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: config.name,
        item: `${baseUrl}${canonicalPath}`,
      },
    ],
  };

  return {
    route: `kategori/${config.slug}`,
    title,
    description,
    canonicalPath,
    image: config.image,
    type: "website",
    lastmod: new Date().toISOString(),
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        description,
        inLanguage: "tr-TR",
        url: `${baseUrl}${canonicalPath}`,
      },
      breadcrumbSchema,
    ],
  };
}

function buildProductSeo(row) {
  const productId = String(row.id ?? "").trim();
  const route = `product/${encodeURIComponent(productId)}`;
  const productName = normalizeText(row.name || `Ürün ${productId}`);
  const categoryLabel = getCategoryLabel(row.category_id);
  const title = `${productName} | ${categoryLabel} | ${BRAND}`;
  const description = truncateText(
    normalizeText(row.description || `${productName} ürün detayları, fiyatı ve özellikleri.`),
    170
  );
  const canonicalUrl = toAbsoluteUrl(`/${route}/`);
  const images = getProductImages(row);
  const image = images[0] || DEFAULT_IMAGE;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    sku: productId,
    description,
    category: categoryLabel,
    image: images.length > 0 ? images : [image],
    brand: {
      "@type": "Brand",
      name: BRAND,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "TRY",
      price: Number(row.price ?? 0).toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: canonicalUrl,
    },
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Ana Sayfa",
        item: `${baseUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ürünler",
        item: `${baseUrl}/shop/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: productName,
        item: canonicalUrl,
      },
    ],
  };

  return {
    route,
    title,
    description,
    canonicalPath: `/${route}/`,
    image,
    type: "product",
    lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    schema: [productSchema, breadcrumbSchema],
  };
}

function buildSitemapXml(staticConfigs, productConfigs, categoryConfigs) {
  const staticEntries = staticConfigs
    .filter((item) => !item.noindex)
    .map((item) => ({
      loc: toAbsoluteUrl(item.canonicalPath),
      changefreq: item.canonicalPath === "/" ? "daily" : item.canonicalPath === "/shop/" ? "daily" : "monthly",
      priority: item.canonicalPath === "/" ? "1.0" : item.canonicalPath === "/shop/" ? "0.95" : "0.7",
      lastmod: new Date().toISOString(),
    }));

  const categoryEntries = categoryConfigs.map((item) => ({
    loc: toAbsoluteUrl(item.canonicalPath),
    changefreq: "daily",
    priority: "0.75",
    lastmod: item.lastmod ?? new Date().toISOString(),
  }));

  const productEntries = productConfigs.map((item) => ({
    loc: toAbsoluteUrl(item.canonicalPath),
    changefreq: "daily",
    priority: "0.8",
    lastmod: item.lastmod,
  }));

  const entries = [...staticEntries, ...categoryEntries, ...productEntries];
  const body = entries
    .map(
      (item) => `  <url>\n    <loc>${escapeXml(item.loc)}</loc>\n    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n    <changefreq>${item.changefreq}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
  if (!fs.existsSync(distIndexPath)) {
    throw new Error(`dist/index.html bulunamadi: ${distIndexPath}`);
  }

  const template = fs.readFileSync(distIndexPath, "utf8");
  const staticConfigs = buildStaticPageConfigs();
  const { products, categories } = await getDatabaseRows();
  const categoryConfigs = categories.map(buildCategorySeo).filter(Boolean);
  const productConfigs = products.map(buildProductSeo);

  for (const config of staticConfigs) {
    const html = applySeo(template, config);
    ensureRouteFile(config.route, html);
  }

  for (const config of productConfigs) {
    const html = applySeo(template, config);
    ensureRouteFile(config.route, html);
  }

  for (const config of categoryConfigs) {
    const html = applySeo(template, config);
    ensureRouteFile(config.route, html);
  }

  if (fs.existsSync(robotsPath)) {
    const robots = fs.readFileSync(robotsPath, "utf8");
    fs.writeFileSync(robotsPath, robots.replace(/\r\n/g, "\n"), "utf8");
  }

  const sitemapXml = buildSitemapXml(staticConfigs, productConfigs, categoryConfigs);
  fs.writeFileSync(sitemapPath, sitemapXml, "utf8");

  console.log(
    `[seo] Statik SEO sayfalari üretildi. static=${staticConfigs.length} category=${categoryConfigs.length} product=${productConfigs.length}`
  );
}

await main();
