import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATE = [
  {
    label: "Erkek",
    groups: [
      { label: "Giyim", items: ["Tişört", "Gömlek", "Sweatshirt", "Pantolon", "Kot"] },
      { label: "Ayakkabı", items: ["Spor Ayakkabı", "Günlük Ayakkabı", "Klasik Ayakkabı", "Bot", "Terlik"] },
      { label: "Aksesuar", items: ["Saat", "Gözlük", "Cüzdan", "Kemer", "Şapka"] },
      { label: "Kozmetik & Bakım", items: ["Parfüm", "Tıraş Ürünleri", "Cilt Bakım", "Saç Bakım", "Deodorant"] },
    ],
  },
  {
    label: "Kadın",
    groups: [
      { label: "Giyim", items: ["Elbise", "Bluz", "Pantolon", "Etek", "Triko"] },
      { label: "Ayakkabı", items: ["Topuklu", "Spor", "Bot", "Babet", "Terlik"] },
      { label: "Aksesuar", items: ["Çanta", "Saat", "Takı", "Kemer"] },
      { label: "Kozmetik & Bakım", items: ["Parfüm", "Makyaj", "Cilt Bakım", "Saç Bakım"] },
    ],
  },
  {
    label: "Anne & Bebek",
    groups: [
      { label: "Bebek Giyim", items: ["Body", "Tulum", "Takım", "Mont"] },
      { label: "Bebek Bakım", items: ["Bez", "Islak Mendil", "Şampuan", "Pişik Kremi"] },
      { label: "Bebek Araçları", items: ["Puset", "Oto Koltuğu", "Mama Sandalyesi"] },
    ],
  },
  {
    label: "Süpermarket",
    groups: [
      { label: "Temel Gıda", items: ["Makarna", "Pirinç", "Bakliyat", "Yağ"] },
      { label: "İçecek", items: ["Su", "Meyve Suyu", "Gazlı İçecek", "Çay"] },
      { label: "Temizlik", items: ["Deterjan", "Yüzey Temizleyici", "Kağıt Ürünleri"] },
    ],
  },
  {
    label: "Kitap & Kırtasiye",
    groups: [
      { label: "Kitap", items: ["Roman", "Kişisel Gelişim", "Çocuk Kitapları"] },
      { label: "Kırtasiye", items: ["Defter", "Kalem", "Dosya", "Boya"] },
    ],
  },
  { label: "Saat & Aksesuar", groups: [{ label: "Saat", items: ["Kadın Saat", "Erkek Saat", "Akıllı Saat"] }] },
  { label: "Takı & Mücevher", groups: [{ label: "Takı", items: ["Kolye", "Bileklik", "Küpe", "Yüzük"] }] },
  { label: "Yapı Market & Bahçe", groups: [{ label: "Yapı Market", items: ["El Aletleri", "Boya", "Aydınlatma"] }] },
  { label: "Sağlık", groups: [{ label: "Sağlık Ürünleri", items: ["Vitamin", "Medikal", "Ağız Bakım"] }] },
  { label: "Ofis & İş Ürünleri", groups: [{ label: "Ofis", items: ["Yazıcı", "Toner", "Masaüstü Gereçler"] }] },
  { label: "Hediye & Parti", groups: [{ label: "Hediye", items: ["Hediye Seti", "Parti Süsleri", "Konsept Ürünler"] }] },
  { label: "Dijital Ürünler", groups: [{ label: "Dijital", items: ["Oyun Kodu", "Yazılım Lisansı", "Hediye Kartı"] }] },
];

async function main() {
  await prisma.category.deleteMany({ where: { siteConfigId: 1 } });

  for (let i = 0; i < TEMPLATE.length; i += 1) {
    const root = TEMPLATE[i];
    const createdRoot = await prisma.category.create({
      data: {
        siteConfigId: 1,
        label: root.label,
        sortOrder: i + 1,
      },
    });

    for (let gi = 0; gi < root.groups.length; gi += 1) {
      const group = root.groups[gi];
      const createdGroup = await prisma.category.create({
        data: {
          siteConfigId: 1,
          parentId: createdRoot.id,
          label: group.label,
          sortOrder: gi + 1,
        },
      });

      for (let ii = 0; ii < group.items.length; ii += 1) {
        await prisma.category.create({
          data: {
            siteConfigId: 1,
            parentId: createdGroup.id,
            label: group.items[ii],
            sortOrder: ii + 1,
          },
        });
      }
    }
  }

  console.log("Categories reset from kategori.png template.");
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
