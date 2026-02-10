import { prisma } from "@/lib/prisma";

export async function getHomepageData() {
  return prisma.siteConfig.findUnique({
    where: { id: 1 },
    include: {
      headerActions: {
        orderBy: { sortOrder: "asc" },
      },
      categories: {
        orderBy: { sortOrder: "asc" },
      },
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          products: {
            orderBy: { sortOrder: "asc" },
            include: {
              badges: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });
}
