import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_TEMPLATE = {
  Kategoriler: ["Tüm Ürünler", "Yeni Gelenler", "Çok Satanlar"],
  Erkek: ["Tişört", "Gömlek", "Pantolon", "Ayakkabı"],
  Avizeler: ["Modern Avize", "Klasik Avize", "Led Avize"],
  Aydınlatma: ["Lambader", "Masa Lambası", "Duvar Apliği"],
  Elektronik: ["Telefon", "Bilgisayar", "Kulaklık", "Akıllı Saat"],
  Moda: ["Kadın Giyim", "Erkek Giyim", "Çocuk Giyim"],
  "Ev & Yaşam": ["Mutfak", "Banyo", "Dekorasyon"],
  "Spor & Outdoor": ["Koşu", "Fitness", "Kamp"],
  Kozmetik: ["Cilt Bakımı", "Makyaj", "Parfüm"],
  "Kitap & Hobi": ["Roman", "Kişisel Gelişim", "Oyuncak"],
};

async function main() {
  const roots = await prisma.category.findMany({
    where: { parentId: null, siteConfigId: 1 },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, label: true },
  });

  for (const root of roots) {
    const children = CATEGORY_TEMPLATE[root.label];
    if (!children?.length) continue;

    for (let i = 0; i < children.length; i += 1) {
      const label = children[i];
      const existing = await prisma.category.findFirst({
        where: { siteConfigId: 1, parentId: root.id, label },
        select: { id: true },
      });

      if (existing) continue;

      await prisma.category.create({
        data: {
          siteConfigId: 1,
          parentId: root.id,
          label,
          sortOrder: i + 1,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Category children populated.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
