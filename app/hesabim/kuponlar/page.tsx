import { AccountSidebar } from "@/components/account-sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

function formatDateTR(date: Date | null) {
  if (!date) return "Süresiz";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function KuponlarimPage() {
  const user = await getCurrentUserFromSession();
  if (!user) redirect("/giris?status=required&next=%2Fhesabim%2Fkuponlar");

  const now = new Date();

  const [siteHeader, cartItemCount, favoriteItemCount, orderCount, coupons, userUsages] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
    prisma.order.count({ where: { OR: [{ customerEmail: user.email }, { customerPhone: user.phone }] } }),
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
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.couponUsage.findMany({
      where: {
        userEmail: user.email.toLowerCase(),
      },
      include: {
        coupon: {
          select: {
            code: true,
            type: true,
            value: true,
          },
        },
      },
      orderBy: [{ usedAt: "desc" }],
      take: 20,
    }),
  ]);

  const usageByCouponId = new Map<number, number>();
  for (const usage of userUsages) {
    usageByCouponId.set(usage.couponId, (usageByCouponId.get(usage.couponId) ?? 0) + 1);
  }

  const availableCoupons = coupons.filter((coupon) => {
    if (coupon.usageLimit && coupon.usageLimit > 0 && coupon._count.usages >= coupon.usageLimit) {
      return false;
    }

    const userUsed = usageByCouponId.get(coupon.id) ?? 0;
    if (coupon.perUserLimit && coupon.perUserLimit > 0 && userUsed >= coupon.perUserLimit) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[300px_1fr]">
        <AccountSidebar
          fullName={user.fullName}
          active="kuponlar"
          orderCount={orderCount}
          favoriteCount={favoriteItemCount}
          couponCount={availableCoupons.length}
        />

        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Kuponlarım</h1>
            <p className="mt-1 text-slate-500">{availableCoupons.length} kullanılabilir kuponunuz var</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-semibold text-slate-900">Kullanılabilir Kuponlar</h2>
            {availableCoupons.length === 0 ? <p className="mt-3 text-slate-600">Şu anda aktif kupon bulunmuyor.</p> : null}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {availableCoupons.map((coupon) => (
                <article key={coupon.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm text-slate-500">Kupon Kodu</div>
                      <div className="text-xl font-bold tracking-wide text-slate-900">{coupon.code}</div>
                    </div>
                    <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                  </div>

                  <div className="mt-3 text-sm text-slate-600">
                    {coupon.type === "PERCENT" ? `%${coupon.value} indirim` : `${formatTRY(coupon.value)} indirim`}
                    {coupon.minOrderAmount ? ` • Min sepet: ${formatTRY(coupon.minOrderAmount)}` : ""}
                  </div>

                  <div className="mt-2 text-sm text-slate-500">Son geçerlilik: {formatDateTR(coupon.expiresAt)}</div>
                  {coupon.description ? <div className="mt-1 text-sm text-slate-500">{coupon.description}</div> : null}

                  <div className="mt-4">
                    <Link
                      href={`/sepet?coupon=${encodeURIComponent(coupon.code)}`}
                      className="inline-flex items-center rounded-xl bg-[#1BA7A6] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Sepette Kullan
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-semibold text-slate-900">Kupon Kullanım Geçmişi</h2>
            {userUsages.length === 0 ? <p className="mt-3 text-slate-600">Henüz kupon kullanımınız yok.</p> : null}

            <div className="mt-4 space-y-3">
              {userUsages.map((usage) => (
                <article key={usage.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">{usage.coupon.code}</div>
                    <div className="text-sm text-slate-500">{usage.usedAt.toLocaleDateString("tr-TR")}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {usage.coupon.type === "PERCENT" ? `%${usage.coupon.value}` : formatTRY(usage.coupon.value)} uygulandı • İndirim: {formatTRY(usage.discountAmount)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
