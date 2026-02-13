import { prisma } from "@/lib/prisma";
import { searchProductsSmart } from "@/lib/product-search";

export const dynamic = "force-dynamic";

function getQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("q") ?? "").trim();
}

export async function GET(request: Request) {
  const query = getQuery(request);
  const searchResult = await searchProductsSmart(query, { limit: 8, preferStartsWith: true });

  const normalizedQuery = query
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedQuery.length >= 2) {
    await prisma.searchQueryLog.create({
      data: {
        query,
        normalizedQuery,
        correctedQuery: searchResult.correctedQuery,
        resultCount: searchResult.products.length,
        hadResult: searchResult.products.length > 0,
        source: "live",
      },
    });
  }

  return Response.json(searchResult);
}
