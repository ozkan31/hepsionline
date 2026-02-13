import { prisma } from "@/lib/prisma";

export async function getSiteHeaderData() {
  return prisma.siteConfig.findUnique({
    where: { id: 1 },
    select: {
      id: true,
      brandLetter: true,
      brandName: true,
      searchPlaceholder: true,
      searchButtonLabel: true,
      categoryNavLabel: true,
      headerActions: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          label: true,
          icon: true,
          badgeCount: true,
        },
      },
      categories: {
        where: {
          parentId: null,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          label: true,
          slug: true,
          isHighlighted: true,
          children: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              label: true,
              slug: true,
              isHighlighted: true,
              children: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  label: true,
                  slug: true,
                  isHighlighted: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export type SiteHeaderData = NonNullable<Awaited<ReturnType<typeof getSiteHeaderData>>>;
