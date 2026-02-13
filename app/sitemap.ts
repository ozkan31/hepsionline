import { buildProductSlug } from "@/lib/product-slug";
import { prisma } from "@/lib/prisma";
import { resolveLocalBaseUrl } from "@/lib/runtime-port";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || resolveLocalBaseUrl();
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const products = hasDatabaseUrl
    ? await prisma.product.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ id: "desc" }],
        take: 5000,
      })
    : [];

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/arama`,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/urun/${buildProductSlug(product.name, product.id)}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
