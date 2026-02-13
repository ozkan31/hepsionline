import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/akalin1453",
          "/api",
          "/checkout",
          "/sepet",
          "/odeme",
          "/giris",
          "/kayit",
          "/logout",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

