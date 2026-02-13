import { AccountSidebar } from "@/components/account-sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { buildProductSlug } from "@/lib/product-slug";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

export default async function RecentlyViewedPage() {
  const user = await getCurrentUserFromSession();
  if (!user) redirect("/giris?status=required&next=%2Fhesabim%2Fson-goruntulenenler");

  const [siteHeader, cartItemCount, favoriteCount, viewedEvents, orderCount, couponCount] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
    prisma.adminAuditLog.findMany({
      where: {
        action: "event:product_view",
        actorId: user.email,
        entity: "product",
      },
      select: {
        entityId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    }),
    prisma.order.count({
      where: {
        OR: [{ customerEmail: user.email }, { customerPhone: user.phone }],
      },
    }),
    prisma.coupon.count({
      where: {
        isActive: true,
      },
    }),
  ]);

  const productIds: number[] = [];
  const seen = new Set<number>();
  for (const event of viewedEvents) {
    const id = Number.parseInt(event.entityId ?? "", 10);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    productIds.push(id);
  }

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        })
      : [];

  const byId = new Map(products.map((p) => [p.id, p]));
  const orderedProducts = productIds.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteCount} /> : null}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[320px_1fr]">
        <AccountSidebar fullName={user.fullName} active="hesabim" orderCount={orderCount} favoriteCount={favoriteCount} couponCount={couponCount} />

        <section>
          <h1 className="text-3xl font-semibold text-slate-900">Son Görüntülenenler</h1>
          <p className="mt-1 text-slate-500">{orderedProducts.length} ürün listeleniyor</p>

          {orderedProducts.length === 0 ? <div className="mt-6 rounded-2xl bg-white p-6 text-slate-600">Henüz görüntülenen ürün yok.</div> : null}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedProducts.map((product) => (
              <Link
                key={product.id}
                href={`/urun/${buildProductSlug(product.name, product.id)}`}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
              >
                <div
                  className="h-40 w-full bg-slate-100"
                  style={{ backgroundImage: `url(${product.imageUrl || "/products/office.jpg"})`, backgroundSize: "cover", backgroundPosition: "center" }}
                />
                <div className="p-4">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-800">{product.name}</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">{formatTRY(product.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
