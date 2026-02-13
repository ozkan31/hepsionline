import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rawCategoryTree = [
  {
    name: "Erkek",
    slug: "erkek",
    children: [
      {
        name: "Giyim",
        slug: "erkek-giyim",
        children: [
          "Tişört",
          "Gömlek",
          "Sweatshirt",
          "Pantolon",
          "Kot",
          "Şort",
          "Mont",
          "Ceket",
          "Takım Elbise",
          "İç Giyim",
          "Pijama",
        ],
      },
      {
        name: "Ayakkabı",
        slug: "erkek-ayakkabi",
        children: ["Spor Ayakkabı", "Günlük Ayakkabı", "Klasik Ayakkabı", "Bot", "Terlik", "Sandalet"],
      },
      {
        name: "Aksesuar",
        slug: "erkek-aksesuar",
        children: ["Saat", "Gözlük", "Cüzdan", "Kemer", "Şapka", "Çanta", "Bileklik"],
      },
      {
        name: "Kozmetik & Bakım",
        slug: "erkek-bakim",
        children: ["Parfüm", "Tıraş Ürünleri", "Cilt Bakım", "Saç Bakım", "Deodorant"],
      },
    ],
  },
  {
    name: "Kadın",
    slug: "kadin",
    children: [
      {
        name: "Giyim",
        slug: "kadin-giyim",
        children: [
          "Elbise",
          "Bluz",
          "Tişört",
          "Pantolon",
          "Etek",
          "Kot",
          "Sweatshirt",
          "Ceket",
          "Mont",
          "İç Giyim",
          "Pijama",
        ],
      },
      {
        name: "Ayakkabı",
        slug: "kadin-ayakkabi",
        children: ["Topuklu Ayakkabı", "Spor Ayakkabı", "Günlük Ayakkabı", "Bot", "Terlik", "Sandalet"],
      },
      {
        name: "Çanta",
        slug: "kadin-canta",
        children: ["Omuz Çantası", "Sırt Çantası", "El Çantası", "Cüzdan", "Portföy"],
      },
      {
        name: "Aksesuar",
        slug: "kadin-aksesuar",
        children: ["Takı", "Saat", "Gözlük", "Şapka", "Kemer"],
      },
      {
        name: "Kozmetik & Bakım",
        slug: "kadin-kozmetik",
        children: ["Makyaj", "Cilt Bakım", "Parfüm", "Saç Bakım", "Oje"],
      },
    ],
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

const categoryTree = normalizeNodes(rawCategoryTree);

async function insertNodes(nodes, siteConfigId, parentId = null) {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    const created = await prisma.category.create({
      data: {
        siteConfigId,
        parentId,
        label: node.name,
        slug: node.slug,
        isHighlighted: false,
        sortOrder: index + 1,
      },
    });

    if (Array.isArray(node.children) && node.children.length > 0) {
      await insertNodes(node.children, siteConfigId, created.id);
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

  await prisma.category.deleteMany({
    where: { siteConfigId: siteConfig.id },
  });

  await insertNodes(categoryTree, siteConfig.id);

  const [allCount, rootCount] = await Promise.all([
    prisma.category.count({ where: { siteConfigId: siteConfig.id } }),
    prisma.category.count({ where: { siteConfigId: siteConfig.id, parentId: null } }),
  ]);

  console.log(`Kategori import tamamlandı. Toplam ${allCount} kategori, ${rootCount} ana kategori yazıldı.`);
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
