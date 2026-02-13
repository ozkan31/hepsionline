import { SiteHeader } from "@/components/site-header";
import { AccountSidebar } from "@/components/account-sidebar";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { buildProductSlug } from "@/lib/product-slug";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Heart, MapPin } from "lucide-react";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type Product = {
  id: number;
  title: string;
  subtitle?: string;
  price: number;
  imageUrl: string;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

function SectionCard({
  title,
  subtitle,
  ctaText,
  ctaHref,
  leftIcon,
  rightVisual,
}: {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  leftIcon?: ReactNode;
  rightVisual?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex gap-4">
        {leftIcon ? (
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F6F6] text-[#1BA7A6]">{leftIcon}</div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-800">{title}</div>
          <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>

          <div className="mt-4">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1BA7A6] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
            >
              {ctaText}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {rightVisual ? (
          <div className="relative hidden h-[96px] w-[180px] shrink-0 overflow-hidden rounded-xl bg-slate-100 md:block">{rightVisual}</div>
        ) : null}
      </div>
    </div>
  );
}

function ProductCard({ p }: { p: Product }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="relative">
        <div
          className="h-40 w-full bg-slate-100"
          style={{ backgroundImage: `url(${p.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        <button
          type="button"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/5 hover:bg-white"
          aria-label="Favorilere ekle"
        >
          <Heart className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      <div className="p-4">
        <div className="line-clamp-2 text-sm font-semibold text-slate-800">{p.title}</div>
        {p.subtitle ? <div className="mt-1 text-xs text-slate-500">{p.subtitle}</div> : <div className="mt-1 text-xs text-slate-500">&nbsp;</div>}

        <div className="mt-2 text-base font-semibold text-slate-900">{formatTRY(p.price)}</div>

        <div className="mt-3">
          <Link
            href={`/urun/${buildProductSlug(p.title, p.id)}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#1BA7A6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
          >
            Tümünü Gör <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function HesabimPage() {
  const user = await getCurrentUserFromSession();
  if (!user) redirect("/giris?status=required&next=%2Fhesabim");

  const now = new Date();

  const [siteHeader, cartItemCount, favoriteCount, viewedEvents, coupons, couponUsages] = await Promise.all([
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
      take: 200,
    }),
    prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      include: {
        _count: {
          select: {
            usages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    prisma.couponUsage.findMany({
      where: {
        userEmail: user.email.toLowerCase(),
      },
      select: {
        couponId: true,
      },
    }),
  ]);

  const orderFilters: Array<{ customerEmail?: string; customerPhone?: string }> = [];
  if (user.email) orderFilters.push({ customerEmail: user.email });
  if (user.phone) orderFilters.push({ customerPhone: user.phone });

  const orderCount =
    orderFilters.length > 0
      ? await prisma.order.count({ where: { OR: orderFilters } })
      : 0;

  const addressCount = user.addressLine1 ? 1 : 0;

  const usageByCouponId = new Map<number, number>();
  for (const usage of couponUsages) {
    usageByCouponId.set(usage.couponId, (usageByCouponId.get(usage.couponId) ?? 0) + 1);
  }

  const availableCoupons = coupons.filter((coupon) => {
    if (coupon.usageLimit && coupon.usageLimit > 0 && coupon._count.usages >= coupon.usageLimit) {
      return false;
    }

    const userUsageCount = usageByCouponId.get(coupon.id) ?? 0;
    if (coupon.perUserLimit && coupon.perUserLimit > 0 && userUsageCount >= coupon.perUserLimit) {
      return false;
    }

    return true;
  });

  const couponCount = availableCoupons.length;

  const viewedProductIds: number[] = [];
  const viewedIdSet = new Set<number>();
  for (const event of viewedEvents) {
    const productId = Number.parseInt(event.entityId ?? "", 10);
    if (!Number.isFinite(productId) || productId <= 0 || viewedIdSet.has(productId)) {
      continue;
    }
    viewedIdSet.add(productId);
    viewedProductIds.push(productId);
    if (viewedProductIds.length >= 4) {
      break;
    }
  }

  const viewedProductsRaw =
    viewedProductIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: {
              in: viewedProductIds,
            },
          },
          select: { id: true, name: true, price: true, imageUrl: true },
        })
      : [];

  const viewedProductMap = new Map(viewedProductsRaw.map((p) => [p.id, p]));
  const viewedProducts: Product[] = viewedProductIds
    .map((id) => viewedProductMap.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .map((product) => ({
    id: product.id,
    title: product.name,
    subtitle: "",
    price: product.price,
    imageUrl: product.imageUrl || "/products/office.jpg",
  }));

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteCount} /> : null}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[320px_1fr]">
        <AccountSidebar fullName={user.fullName} active="hesabim" orderCount={orderCount} favoriteCount={favoriteCount} couponCount={couponCount} />

        <section className="space-y-5">
          <div className="rounded-2xl bg-transparent">
            <h1 className="text-3xl font-semibold text-slate-900">Hesabım</h1>
            <p className="mt-1 text-slate-500">Hoşgeldiniz, {user.fullName}!</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard
              title="Adreslerim"
              subtitle={`${addressCount} kayıtlı adresiniz var.`}
              ctaText="Adreslerimi Gör"
              ctaHref="/hesabim/adresler"
              leftIcon={<MapPin className="h-5 w-5" />}
              rightVisual={
                <div className="absolute inset-0">
                  <div className="absolute -right-10 top-6 h-24 w-24 rounded-full bg-[#E7F6F6]" />
                  <div className="absolute right-4 top-10 h-10 w-10 rounded-xl bg-[#1BA7A6]/15" />
                  <div className="absolute right-7 top-12 h-6 w-6 rounded-lg bg-[#1BA7A6]/25" />
                </div>
              }
            />

            <SectionCard
              title="Siparişlerim"
              subtitle={`${orderCount} siparişiniz var`}
              ctaText="Siparişlerimi Gör"
              ctaHref="/hesabim/siparislerim"
              rightVisual={
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "url(https://images.unsplash.com/photo-1528701800489-20be3c2ea2d6?auto=format&fit=crop&w=900&q=70)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              }
            />

            <SectionCard
              title="Favorilerim"
              subtitle={`${favoriteCount} favori ürününüz var`}
              ctaText="Favorilerimi Gör"
              ctaHref="/favoriler"
              rightVisual={
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "url(https://images.unsplash.com/photo-1528701800489-20be3c2ea2d6?auto=format&fit=crop&w=900&q=70)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              }
            />

            <SectionCard
              title="Kuponlarım"
              subtitle={`${couponCount} kullanılabilir kuponunuz var`}
              ctaText="Kuponlarımı Gör"
              ctaHref="/hesabim/kuponlar"
              rightVisual={
                <div className="absolute inset-0 flex items-center justify-center bg-[#E7F6F6]">
                  <div className="flex h-[74px] w-[140px] items-center justify-center rounded-xl border-2 border-dashed border-[#1BA7A6]/50 bg-white text-center">
                    <div>
                      <div className="text-2xl font-extrabold text-[#1BA7A6]">₺50</div>
                      <div className="text-sm font-semibold text-slate-600">hediye</div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Son Görüntülenenler</h2>
            <Link href="/hesabim/son-goruntulenenler" className="text-sm font-semibold text-[#1BA7A6] hover:underline">
              Tümünü Gör
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {viewedProducts.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
