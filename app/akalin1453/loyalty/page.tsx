import { getLoyaltyAdminSnapshot } from "@/lib/loyalty";
import { adminAdjustLoyaltyPointsAction } from "@/lib/admin-loyalty-actions";

export const dynamic = "force-dynamic";

function statusText(
  status: string | undefined,
  reason: string | undefined,
) {
  if (status === "ok") {
    return {
      cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
      text: "Puan duzeltmesi kaydedildi.",
    };
  }

  if (status === "invalid") {
    return {
      cls: "border-amber-200 bg-amber-50 text-amber-800",
      text: "Gecersiz form verisi.",
    };
  }

  if (status === "error") {
    return {
      cls: "border-rose-200 bg-rose-50 text-rose-800",
      text: `Islem basarisiz: ${reason || "Bilinmeyen hata"}`,
    };
  }

  return null;
}

export default async function LoyaltyAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    reason?: string;
    userId?: string;
  }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const statusInfo = statusText(resolved?.status, resolved?.reason);
  const data = await getLoyaltyAdminSnapshot(80);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-bold text-slate-900">Sadakat Programi</h1>
        <p className="mt-1 text-sm text-slate-500">Puan bakiyesi, seviye ve kupon donusum ozeti.</p>
      </div>
      {statusInfo ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${statusInfo.cls}`}>
          {statusInfo.text}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Programa dahil kullanici</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data.totals.users}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Toplam aktif puan</div>
          <div className="mt-1 text-2xl font-bold text-[#1BA7A6]">{data.totals.pointsBalance}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Toplam kazanilan puan</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data.totals.totalEarned}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Toplam harcanan puan</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{data.totals.totalRedeemed}</div>
        </article>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Kullanici</th>
                <th className="px-4 py-3">Seviye</th>
                <th className="px-4 py-3">Bakiye</th>
                <th className="px-4 py-3">Kazanilan</th>
                <th className="px-4 py-3">Harcanan</th>
                <th className="px-4 py-3">Hareket</th>
                <th className="px-4 py-3">Guncelleme</th>
                <th className="px-4 py-3">Manuel Islem</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{account.user.fullName}</div>
                    <div className="text-xs text-slate-500">{account.user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{account.tier}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1BA7A6]">{account.pointsBalance}</td>
                  <td className="px-4 py-3">{account.totalEarned}</td>
                  <td className="px-4 py-3">{account.totalRedeemed}</td>
                  <td className="px-4 py-3">{account._count.transactions}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(account.updatedAt).toLocaleString("tr-TR")}</td>
                  <td className="px-4 py-3">
                    <form action={adminAdjustLoyaltyPointsAction} className="grid min-w-[420px] gap-2 md:grid-cols-[90px_150px_1fr_auto]">
                      <input type="hidden" name="userId" value={account.user.id} />
                      <input
                        name="delta"
                        type="number"
                        required
                        placeholder="+50 / -30"
                        className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-[#2b6cff]"
                      />
                      <select
                        name="reasonCode"
                        required
                        defaultValue="CUSTOMER_SATISFACTION"
                        className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-[#2b6cff]"
                      >
                        <option value="REFUND_COMPENSATION">Iade telafisi</option>
                        <option value="CUSTOMER_SATISFACTION">Musteri memnuniyeti</option>
                        <option value="SYSTEM_FIX">Sistem duzeltmesi</option>
                        <option value="CAMPAIGN_BONUS">Kampanya bonusu</option>
                        <option value="OTHER">Diger</option>
                      </select>
                      <input
                        name="note"
                        type="text"
                        minLength={0}
                        maxLength={180}
                        placeholder="Opsiyonel aciklama"
                        className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-[#2b6cff]"
                      />
                      <button
                        type="submit"
                        className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Kaydet
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.accounts.length === 0 ? <div className="border-t border-slate-200 p-4 text-sm text-slate-500">Henüz sadakat kaydı yok.</div> : null}
      </div>
    </div>
  );
}
