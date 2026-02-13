import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rawCategoryTree = [
  {
    name: "Anne & Bebek",
    slug: "anne-bebek",
    children: [
      "Bebek Bezi",
      "Mama & Beslenme",
      "Bebek Arabası",
      "Oto Koltuğu",
      "Emzirme Ürünleri",
      "Bebek Oyuncakları",
    ],
  },
  {
    name: "Süpermarket",
    slug: "supermarket",
    children: [
      "Temel Gıda",
      "Atıştırmalık",
      "İçecek",
      "Kahvaltılık",
      "Dondurulmuş Gıda",
      "Organik Ürünler",
    ],
  },
  {
    name: "Kitap & Kırtasiye",
    slug: "kitap-kirtasiye",
    children: ["Roman", "Kişisel Gelişim", "Çocuk Kitapları", "Defter", "Kalem", "Okul Gereçleri"],
  },
  {
    name: "Saat & Aksesuar",
    slug: "saat-aksesuar",
    children: ["Kol Saati", "Akıllı Saat Kayış", "Gözlük", "Cüzdan", "Kemer"],
  },
  {
    name: "Takı & Mücevher",
    slug: "taki-mucevher",
    children: ["Altın", "Gümüş", "Pırlanta", "Bileklik", "Kolye", "Yüzük"],
  },
  {
    name: "Yapı Market & Bahçe",
    slug: "yapi-market-bahce",
    children: ["El Aletleri", "Elektrikli Aletler", "Bahçe Mobilyası", "Sulama Sistemleri", "Boyalar", "Hırdavat"],
  },
  {
    name: "Sağlık",
    slug: "saglik",
    children: ["Vitamin & Takviye", "Medikal Ürünler", "Masaj Aletleri", "Ortopedik Ürünler", "Tansiyon Aleti"],
  },
  {
    name: "Ofis & İş Ürünleri",
    slug: "ofis-is",
    children: ["Yazıcı", "Kartuş & Toner", "Ofis Sandalyesi", "Dosyalama Ürünleri", "Sunum Araçları"],
  },
  {
    name: "Hediye & Parti",
    slug: "hediye-parti",
    children: ["Hediye Kutuları", "Parti Süsleri", "Doğum Günü Ürünleri", "Balon", "Sürpriz Kutular"],
  },
  {
    name: "Dijital Ürünler",
    slug: "dijital-urunler",
    children: ["Oyun Kodları", "Hediye Kartları", "Yazılım Lisansları", "Abonelikler"],
  },
];

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeNodes(nodes) {
  return nodes
    .map((node) => {
      if (typeof node === "string") {
        const name = node.trim();
        if (!name) return null;
        return {
          name,
          slug: toSlug(name),
          children: [],
        };
      }

      if (!node || typeof node !== "object") {
        return null;
      }

      const name = typeof node.name === "string" ? node.name.trim() : "";
      if (!name) return null;

      const slug = typeof node.slug === "string" && node.slug.trim() ? node.slug.trim() : toSlug(name);
      const children = Array.isArray(node.children) ? normalizeNodes(node.children) : [];

      return {
        name,
        slug,
        children,
      };
    })
    .filter(Boolean);
}

async function getNextSortOrder(siteConfigId, parentId) {
  const result = await prisma.category.aggregate({
    where: { siteConfigId, parentId },
    _max: { sortOrder: true },
  });

  return (result._max.sortOrder ?? 0) + 1;
}

async function upsertNode(siteConfigId, parentId, node) {
  const existing = await prisma.category.findFirst({
    where: {
      siteConfigId,
      parentId,
      OR: [{ slug: node.slug }, { label: node.name }],
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: {
        label: node.name,
        slug: node.slug,
      },
      select: { id: true },
    });
  }

  const sortOrder = await getNextSortOrder(siteConfigId, parentId);
  return prisma.category.create({
    data: {
      siteConfigId,
      parentId,
      label: node.name,
      slug: node.slug,
      isHighlighted: false,
      sortOrder,
    },
    select: { id: true },
  });
}

async function appendNodes(nodes, siteConfigId, parentId = null) {
  for (const node of nodes) {
    const current = await upsertNode(siteConfigId, parentId, node);
    if (node.children.length > 0) {
      await appendNodes(node.children, siteConfigId, current.id);
    }
  }
}

async function main() {
  const siteConfig = await prisma.siteConfig.findUnique({
    where: { id: 1 },
    select: { id: true },
  });

  if (!siteConfig) {
    throw new Error("SiteConfig id=1 bulunamadı.");
  }

  const normalizedTree = normalizeNodes(rawCategoryTree);
  await appendNodes(normalizedTree, siteConfig.id);

  const [allCount, rootCount] = await Promise.all([
    prisma.category.count({ where: { siteConfigId: siteConfig.id } }),
    prisma.category.count({ where: { siteConfigId: siteConfig.id, parentId: null } }),
  ]);

  console.log(`Kategori ekleme tamamlandı. Toplam ${allCount} kategori, ${rootCount} ana kategori mevcut.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
