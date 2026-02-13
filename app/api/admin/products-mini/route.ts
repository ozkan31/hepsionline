import { prisma } from "@/lib/prisma";
import { parseBoundedInt } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const parsedLimit = parseBoundedInt(searchParams.get("limit"), {
    defaultValue: 300,
    min: 20,
    max: 1000,
    paramName: "limit",
  });
  if (!parsedLimit.ok) return parsedLimit.response;

  const q = (searchParams.get("q") ?? "").trim();
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { section: { title: { contains: q } } },
        ],
      }
    : undefined;

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    take: parsedLimit.value,
    select: {
      id: true,
      name: true,
      price: true,
      imageUrl: true,
      section: { select: { title: true } },
    },
  });

  return Response.json({ products });
}
