import { AccountSidebar } from "@/components/account-sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getAvailableCouponCountForUser } from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { redeemLoyaltyCouponAction } from "@/lib/loyalty-actions";
import { getLoyaltyRedeemOptions, getUserLoyaltySummary, loyaltyTxnLabel, loyaltyTxnTone } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { Award, Gift } from "lucide-react";
import { redirect } from "next/navigation";

function formatDateTR(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function tierLabel(tier: string) {
  if (tier === "PLATINUM") return "Platinum";
  if (tier === "GOLD") return "Gold";
  if (tier === "SILVER") return "Silver";
  return "Bronze";
}

function statusMessage(status: string | undefined) {
  if (status === "success") return { tone: "emerald", text: "Kupon olusturuldu. Kod asagida gorunuyor." };
  if (status === "insufficient") return { tone: "amber", text: "Yetersiz puan. Farkli bir secenek deneyin." };
  if (status === "invalid_points") return { tone: "rose", text: "Gecersiz puan secimi." };
  if (status === "failed") return { tone: "rose", text: "Islem basarisiz oldu. Tekrar deneyin." };
  return null;
}

export default async function PuanlarimPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; code?: string }>;
}) {
  const user = await getCurrentUserFromSession();
  if (!user) redirect("/giris?status=required&next=%2Fhesabim%2Fpuanlar");

  const resolvedParams = searchParams ? await searchParams : undefined;
  const status = resolvedParams?.status;
  const code = resolvedParams?.code;
  const statusInfo = statusMessage(status);

  const [siteHeader, cartItemCount, favoriteItemCount, couponCount, loyalty, orderCount] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
    getAvailableCouponCountForUser(user.email),
    getUserLoyaltySummary(user.id),
    prisma.order.count({
      where: {
        OR: [{ customerEmail: user.email }, { customerPhone: user.phone }],
      },
    }),
  ]);

  const redeemOptions = getLoyaltyRedeemOptions();

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[300px_1fr]">
        <AccountSidebar
          fullName={user.fullName}
          active="puanlar"
          orderCount={orderCount}
          favoriteCount={favoriteItemCount}
          couponCount={couponCount}
        />

        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Sadakat Programi</h1>
            <p className="mt-1 text-slate-500">Alisveristen puan kazanin, puanlari kupona cevirin.</p>
          </div>

          {statusInfo ? (
            <div
              className={[
                "rounded-xl border px-4 py-3 text-sm",
                statusInfo.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "",
                statusInfo.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "",
                statusInfo.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "",
              ].join(" ")}
            >
              {statusInfo.text}
              {status === "success" && code ? (
                <span className="ml-2 rounded-md bg-white px-2 py-0.5 font-semibold text-slate-800">{code}</span>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-sm text-slate-500">Kullanilabilir Puan</div>
              <div className="mt-1 text-3xl font-bold text-[#1BA7A6]">{loyalty.account.pointsBalance}</div>
            </article>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-sm text-slate-500">Seviye</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{tierLabel(loyalty.account.tier)}</div>
            </article>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-sm text-slate-500">Toplam Kazanilan</div>
              <div className="mt-1 text-3xl font-bold text-slate-900">{loyalty.account.totalEarned}</div>
            </article>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Gift className="h-5 w-5 text-[#1BA7A6]" />
              Puani Kupona Cevir
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {redeemOptions.map((option) => {
                const disabled = loyalty.account.pointsBalance < option.points;
                return (
                  <form key={option.points} action={redeemLoyaltyCouponAction} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <input type="hidden" name="points" value={option.points} />
                    <div className="text-xs text-slate-500">{option.points} puan</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">₺{option.discountTRY}</div>
                    <button
                      type="submit"
                      disabled={disabled}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1BA7A6] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Award className="h-4 w-4" />
                      Kupon Olustur
                    </button>
                  </form>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-lg font-semibold text-slate-900">Puan Hareketleri</h2>
            {loyalty.transactions.length === 0 ? <p className="mt-3 text-slate-600">Henuz puan hareketi yok.</p> : null}
            <div className="mt-4 space-y-2">
              {loyalty.transactions.map((txn) => (
                <article key={txn.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-900">{loyaltyTxnLabel(txn.type)}</div>
                    <div className="text-xs text-slate-500">{formatDateTR(txn.createdAt)}</div>
                  </div>
                  <div className={`rounded-full border px-2 py-1 text-sm font-semibold ${loyaltyTxnTone(txn.pointsChange)}`}>
                    {txn.pointsChange >= 0 ? `+${txn.pointsChange}` : txn.pointsChange}
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

