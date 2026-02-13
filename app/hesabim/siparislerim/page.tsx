import { SiteHeader } from "@/components/site-header";
import { AccountSidebar } from "@/components/account-sidebar";
import { AutoRefresh } from "@/components/auto-refresh";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getAvailableCouponCountForUser } from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { createReturnRequestAction } from "@/lib/user-auth-actions";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import { CheckCircle, Clock, Package, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TEAL = "#1BA7A6";

type SearchParams = Promise<{ durum?: string; status?: string }>;
type ProgressStep = "hazirlaniyor" | "kargoya_verildi" | "yolda" | "teslim_edildi";
type TimelineState = { label: string; step: ProgressStep; cancelled: boolean };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

function formatDateTR(date: Date) {
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function mapOrderStatus(orderStatus: string): TimelineState {
  if (orderStatus === "DELIVERED") return { label: "Teslim Edildi", step: "teslim_edildi", cancelled: false };
  if (orderStatus === "ON_THE_WAY") return { label: "Yolda", step: "yolda", cancelled: false };
  if (orderStatus === "SHIPPED") return { label: "Kargoya Verildi", step: "kargoya_verildi", cancelled: false };
  if (orderStatus === "PREPARING" || orderStatus === "CONFIRMED" || orderStatus === "PENDING") {
    return { label: "Hazırlanıyor", step: "hazirlaniyor", cancelled: false };
  }
  if (orderStatus === "CANCELLED") return { label: "İptal Edildi", step: "hazirlaniyor", cancelled: true };
  return { label: "Hazırlanıyor", step: "hazirlaniyor", cancelled: false };
}

function mapDurumToWhere(durum?: string): { in?: OrderStatus[]; equals?: OrderStatus } | undefined {
  if (durum === "hazirlaniyor") return { in: ["PENDING", "CONFIRMED", "PREPARING"] };
  if (durum === "kargoya_verildi") return { equals: "SHIPPED" };
  if (durum === "yolda") return { equals: "ON_THE_WAY" };
  if (durum === "teslim_edildi") return { equals: "DELIVERED" };
  return undefined;
}

function returnStatusMessage(status?: string) {
  if (status === "return_created") return "Iade talebiniz alindi. Inceleme sonrasi bilgilendirileceksiniz.";
  if (status === "return_exists") return "Bu siparis icin acik bir iade talebiniz zaten bulunuyor.";
  if (status === "return_invalid") return "Iade talebi olusturulamadi. Lutfen siparisinizi kontrol edin.";
  return "";
}

function StatusBadge({ text }: { text: string }) {
  return (
    <span className="rounded-lg px-3 py-1 text-sm font-semibold text-white" style={{ background: TEAL }}>
      {text}
    </span>
  );
}

function Progress({ step, cancelled }: { step: ProgressStep; cancelled: boolean }) {
  const active = { hazirlaniyor: 1, kargoya_verildi: 2, yolda: 3, teslim_edildi: 4 }[step];
  const steps = [
    { key: "hazirlaniyor", label: "Hazırlanıyor", icon: CheckCircle },
    { key: "kargoya_verildi", label: "Kargoya Verildi", icon: Truck },
    { key: "yolda", label: "Yolda", icon: Package },
    { key: "teslim_edildi", label: "Teslim Edildi", icon: Clock },
  ] as const;

  if (cancelled) {
    return (
      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
        Sipariş iptal edildi. Kargo süreci başlatılmadı.
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 lg:grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto]">
      {steps.map((item, idx) => {
        const Icon = item.icon;
        const stepOrder = idx + 1;
        const isActive = active >= stepOrder;
        return (
          <div key={item.key} className="contents">
            <div className="flex items-center gap-2">
              <Icon className={isActive ? "h-[18px] w-[18px] text-[#1BA7A6]" : "h-[18px] w-[18px] text-slate-300"} />
              <span className={isActive ? "font-medium text-slate-800" : "text-slate-500"}>{item.label}</span>
            </div>
            {idx < steps.length - 1 ? <div className={active >= stepOrder + 1 ? "hidden h-[2px] self-center bg-[#1BA7A6] lg:block" : "hidden h-[2px] self-center bg-slate-200 lg:block"} /> : null}
          </div>
        );
      })}

      <div className="lg:hidden">
        <div className="mt-1 h-[2px] w-full rounded-full bg-slate-200">
          <div
            className="h-[2px] rounded-full bg-[#1BA7A6] transition-all"
            style={{ width: `${Math.max(25, Math.min(100, active * 25))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default async function SiparislerimPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const user = await getCurrentUserFromSession();
  if (!user) redirect("/giris?status=required&next=%2Fhesabim%2Fsiparislerim");

  const [siteHeader, cartItemCount, favoriteCount, couponCount] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
    getAvailableCouponCountForUser(user.email),
  ]);

  const orderWhereByDurum = mapDurumToWhere(params.durum);
  const returnNotice = returnStatusMessage(params.status);

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ customerEmail: user.email }, { customerPhone: user.phone }],
      ...(orderWhereByDurum ? { status: orderWhereByDurum } : {}),
    },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { product: { select: { imageUrl: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const orderCount = await prisma.order.count({
    where: { OR: [{ customerEmail: user.email }, { customerPhone: user.phone }] },
  });

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteCount} /> : null}

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[300px_1fr]">
        <AccountSidebar fullName={user.fullName} active="siparislerim" orderCount={orderCount} favoriteCount={favoriteCount} couponCount={couponCount} />

        <section>
          <AutoRefresh intervalMs={15000} />
          <h1 className="mb-4 text-3xl font-semibold">Siparişlerim</h1>
          {returnNotice ? <div className="mb-4 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">{returnNotice}</div> : null}

          <div className="mb-6 flex flex-wrap gap-4 text-sm font-semibold">
            <Link className="rounded-xl px-4 py-2" style={{ background: params.durum ? "transparent" : TEAL, color: params.durum ? "#0f172a" : "#fff" }} href="/hesabim/siparislerim">
              Tüm Siparişlerim
            </Link>
            <Link
              className="rounded-xl px-4 py-2"
              style={{ background: params.durum === "hazirlaniyor" ? TEAL : "transparent", color: params.durum === "hazirlaniyor" ? "#fff" : "#0f172a" }}
              href="/hesabim/siparislerim?durum=hazirlaniyor"
            >
              Hazırlanıyor
            </Link>
            <Link
              className="rounded-xl px-4 py-2"
              style={{ background: params.durum === "kargoya_verildi" ? TEAL : "transparent", color: params.durum === "kargoya_verildi" ? "#fff" : "#0f172a" }}
              href="/hesabim/siparislerim?durum=kargoya_verildi"
            >
              Kargoya Verildi
            </Link>
            <Link
              className="rounded-xl px-4 py-2"
              style={{ background: params.durum === "yolda" ? TEAL : "transparent", color: params.durum === "yolda" ? "#fff" : "#0f172a" }}
              href="/hesabim/siparislerim?durum=yolda"
            >
              Yolda
            </Link>
            <Link
              className="rounded-xl px-4 py-2"
              style={{ background: params.durum === "teslim_edildi" ? TEAL : "transparent", color: params.durum === "teslim_edildi" ? "#fff" : "#0f172a" }}
              href="/hesabim/siparislerim?durum=teslim_edildi"
            >
              Teslim Edildi
            </Link>
          </div>

          {orders.length === 0 ? <div className="rounded-2xl bg-white p-8 text-slate-600 shadow-sm">Bu filtrede sipariş bulunamadı.</div> : null}

          {orders.map((order) => {
            const firstItem = order.items[0];
            const status = mapOrderStatus(order.status);
            const imageUrl = firstItem?.product?.imageUrl || "/products/office.jpg";

            return (
              <div className="mb-6 rounded-2xl bg-white px-3 pb-[20px] pt-5 shadow-sm" key={order.id}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">
                    #{order.orderNo ?? order.id} <span className="ml-3 text-sm text-slate-500">{formatDateTR(order.createdAt)}</span>
                  </div>
                  <Link className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: TEAL }} href={`/odeme/${order.id}`}>
                    Detayı Gör
                  </Link>
                </div>

                <div className="mt-2.5">
                  <div className="mb-3 h-[1.5px] w-full bg-slate-300" />
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <StatusBadge text={status.label} />
                    <div className="text-sm font-semibold text-slate-700">Toplam: {formatTRY(order.totalAmount)}</div>
                  </div>
                  <div className="relative z-10 -mb-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-2 pb-0 pt-4 shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
                    <div className="flex gap-5">
                      <div className="shrink-0">
                        <Image
                          src={imageUrl}
                          width={128}
                          height={128}
                          className="mt-2 h-32 w-32 rounded-xl object-cover"
                          alt={firstItem?.productName || "Ürün"}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{firstItem?.productName || "Sipariş Ürünü"}</div>
                        <Progress step={status.step} cancelled={status.cancelled} />
                      </div>
                    </div>

                    <div className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-2 py-[0.5px]">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-base font-semibold text-slate-900">{formatTRY(firstItem?.unitPrice || order.totalAmount)}</div>
                        <form action={createReturnRequestAction}>
                          <input type="hidden" name="redirectTo" value="/hesabim/siparislerim" />
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="orderItemId" value={firstItem?.id ?? ""} />
                          <input type="hidden" name="type" value="RETURN" />
                          <input type="hidden" name="reason" value="Siparis iade talebi" />
                          <button className="h-8 rounded-lg border px-3 text-xs text-slate-700 hover:bg-slate-50" type="submit">
                            Iade Talebi Olustur
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
