"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import {
  adminApi,
  type AbTestReport,
  type CartsReport,
  type CouponPerformanceReport,
  type CouponRecoReport,
  type FunnelReport,
  type ProductPerformanceReport,
  type RevenueReport,
  type SmartBundleReport,
  type StorefrontVisitorsReport,
} from "@/lib/api";

type RangeKey = "daily" | "weekly" | "monthly";

function formatTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function normalizeBars(values: number[]) {
  const max = Math.max(1, ...values);
  return values.map((v) => Math.max(6, Math.round((v / max) * 100)));
}

function calcCtrAverage(
  series: Array<{ impressions: number; clicks: number }>,
  days: number,
) {
  const slice = series.slice(-days);
  const impressions = slice.reduce(
    (sum, row) => sum + Number(row.impressions ?? 0),
    0,
  );
  const clicks = slice.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
  if (impressions <= 0) return 0;
  return Math.round((clicks / impressions) * 100);
}

export default function ReportsPage() {
  const [rev, setRev] = useState<RevenueReport | null>(null);
  const [carts, setCarts] = useState<CartsReport | null>(null);
  const [range, setRange] = useState<RangeKey>("monthly");
  const [perf, setPerf] = useState<ProductPerformanceReport | null>(null);
  const [funnel, setFunnel] = useState<FunnelReport | null>(null);
  const [visitors, setVisitors] = useState<StorefrontVisitorsReport | null>(null);
  const [ab, setAb] = useState<AbTestReport | null>(null);
  const [smartBundle, setSmartBundle] = useState<SmartBundleReport | null>(null);
  const [couponReco, setCouponReco] = useState<CouponRecoReport | null>(null);
  const [couponPerf, setCouponPerf] = useState<CouponPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smartHoverIndex, setSmartHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const days = range === "daily" ? 7 : range === "weekly" ? 30 : 90;
        const [revData, cartsData, perfData, funnelData, visitorData, abData, smartBundleData, couponRecoData, couponPerfData] = await Promise.all([
          adminApi.reportsRevenue(days),
          adminApi.carts(),
          adminApi.productPerformance(days),
          adminApi.reportsFunnel(days),
          adminApi.reportsStorefrontVisitors(days, 5),
          adminApi.reportsAbTest("home_hero_copy", days),
          adminApi.reportsSmartBundle(days),
          adminApi.reportsCouponReco(days),
          adminApi.couponPerformance(days),
        ]);

        if (!active) return;
        setRev(revData);
        setCarts(cartsData);
        setPerf(perfData);
        setFunnel(funnelData);
        setVisitors(visitorData);
        setAb(abData);
        setSmartBundle(smartBundleData);
        setCouponReco(couponRecoData);
        setCouponPerf(couponPerfData);
        setLastUpdated(new Date());
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Rapor verileri yuklenemedi.");
      } finally {
        if (!active) return;
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    };

    void load();
    const interval = setInterval(() => {
      void load(true);
    }, 20000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [range, reloadKey]);

  const series = useMemo(() => rev?.series ?? [], [rev]);
  const revenueValues = series.map((s) => Number(s.totalTRY ?? 0));
  const revenueBars = useMemo(() => normalizeBars(revenueValues), [revenueValues]);

  const visitorSeries = useMemo(() => visitors?.series ?? [], [visitors]);
  const visitorValues = visitorSeries.map((s) => Number(s.visitors ?? 0));
  const visitorBars = useMemo(() => normalizeBars(visitorValues), [visitorValues]);

  const revenueStats = useMemo(() => {
    if (!revenueValues.length) return { min: 0, max: 0, avg: 0, last: 0 };
    const min = Math.min(...revenueValues);
    const max = Math.max(...revenueValues);
    const avg = revenueValues.reduce((sum, n) => sum + n, 0) / revenueValues.length;
    const last = revenueValues[revenueValues.length - 1] ?? 0;
    return { min, max, avg, last };
  }, [revenueValues]);

  const visitorStats = useMemo(() => {
    if (!visitorValues.length) return { min: 0, max: 0, avg: 0, last: 0 };
    const min = Math.min(...visitorValues);
    const max = Math.max(...visitorValues);
    const avg = visitorValues.reduce((sum, n) => sum + n, 0) / visitorValues.length;
    const last = visitorValues[visitorValues.length - 1] ?? 0;
    return { min, max, avg, last };
  }, [visitorValues]);

  const abRows = ab?.rows ?? [];
  const perfRows = perf?.rows ?? [];
  const smartSeries = useMemo(() => smartBundle?.series ?? [], [smartBundle]);
  const smartImpressionBars = normalizeBars(smartSeries.map((row) => Number(row.impressions ?? 0)));
  const smartClickBars = normalizeBars(smartSeries.map((row) => Number(row.clicks ?? 0)));
  const smartAddBars = normalizeBars(smartSeries.map((row) => Number(row.adds ?? 0)));
  const smartCtr7 = useMemo(() => calcCtrAverage(smartSeries, 7), [smartSeries]);
  const smartCtr30 = useMemo(() => calcCtrAverage(smartSeries, 30), [smartSeries]);
  const smartCtr90 = useMemo(() => calcCtrAverage(smartSeries, 90), [smartSeries]);
  const smartHoverPoint =
    smartHoverIndex !== null ? smartSeries[smartHoverIndex] : null;
  const couponTrend = useMemo(() => couponPerf?.trend ?? [], [couponPerf?.trend]);
  const couponApplyBars = useMemo(
    () => normalizeBars(couponTrend.map((row) => Number(row.applies ?? 0))),
    [couponTrend],
  );
  const couponNetBars = useMemo(
    () =>
      normalizeBars(
        couponTrend.map((row) =>
          Math.max(
            0,
            Number(row.revenueTRY ?? 0) - Math.max(0, Number(row.discountTRY ?? 0)),
          ),
        ),
      ),
    [couponTrend],
  );
  const topVariants = (carts?.topVariants ?? []).slice(0, 6);
  const topClicked = [...perfRows].sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0)).slice(0, 6);
  const rangeLabel = range === "daily" ? "Son 7 gun" : range === "weekly" ? "Son 30 gun" : "Son 90 gun";
  const funnelRows = [
    { label: "Goruntuleme", value: funnel?.views ?? 0, pct: 100, tone: "from-cyan-400 to-sky-500" },
    { label: "Sepete Ekleme", value: funnel?.addToCart ?? 0, pct: funnel?.addToCartRate ?? 0, tone: "from-sky-500 to-indigo-500" },
    { label: "Checkout", value: funnel?.checkoutStart ?? 0, pct: funnel?.checkoutRate ?? 0, tone: "from-indigo-500 to-violet-500" },
    { label: "Satin Alma", value: funnel?.purchases ?? 0, pct: funnel?.conversionRate ?? 0, tone: "from-violet-500 to-fuchsia-500" },
  ];

  const hasData = !loading && !error;

  function downloadCsv() {
    const rows = series.map((s) => ({
      date: s.date ?? "",
      totalTRY: Number(s.totalTRY ?? 0),
      totalTRYFormatted: formatTRY(Number(s.totalTRY ?? 0)),
    }));
    const header = ["date", "totalTRY", "totalTRYFormatted"];
    const csv = [header.join(","), ...rows.map((r) => `${r.date},${r.totalTRY},${r.totalTRYFormatted}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapor-ciro-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-[linear-gradient(135deg,#fff6e8_0%,#fffdf8_55%,#ecfeff_100%)] p-5 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/40 blur-2xl" />
        <div className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full bg-amber-200/40 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">Raporlar</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Commerce Pulse Board</h1>
            <p className="mt-1 text-sm text-slate-600">Canli metrikler, donusum adimlari ve urun aksiyonu tek ekranda.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300 bg-white/80 px-3 text-sm font-medium text-amber-900 hover:bg-white"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => setReloadKey((prev) => prev + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-500 px-3 text-sm font-semibold text-white hover:bg-cyan-600"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Yenile
            </button>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {(["daily", "weekly", "monthly"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={
                range === key
                  ? "rounded-full border border-slate-900 bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-300 bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
              }
            >
              {key === "daily" ? "Gunluk" : key === "weekly" ? "Haftalik" : "Aylik"}
            </button>
          ))}
          <div className="ml-auto rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-600">
            {refreshing ? "Guncelleniyor" : "Canli"}{lastUpdated ? ` | ${lastUpdated.toLocaleTimeString("tr-TR")}` : ""}
          </div>
        </div>
      </section>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Hata: {error}</div> : null}

      {hasData ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Toplam Ciro</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatTRY(rev?.totalTRY ?? 0)}</div>
              <div className="mt-1 text-xs text-slate-600">{rangeLabel}</div>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Aktif Sepet</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{carts?.totalActiveCarts ?? 0}</div>
              <div className="mt-1 text-xs text-slate-600">Toplam urun: {carts?.totalItemsInCarts ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Bugunku Trafik</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{visitors?.todayVisitors ?? 0}</div>
              <div className="mt-1 text-xs text-slate-600">Su an: {visitors?.currentVisitors ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Donusum</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">%{funnel?.conversionRate ?? 0}</div>
              <div className="mt-1 text-xs text-slate-600">Satin alma: {funnel?.purchases ?? 0}</div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">Gelir Kolon Grafigi</div>
                  <div className="text-xs text-slate-500">{rangeLabel}</div>
                </div>
                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Ciro</div>
              </div>
              <div className="mt-4 flex h-44 items-end gap-1 rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
                {revenueBars.map((h, idx) => (
                  <div key={`${series[idx]?.date ?? idx}`} className="group flex-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-amber-400 to-orange-300 transition-all duration-300 group-hover:from-amber-500 group-hover:to-orange-400"
                      style={{ height: `${h}%` }}
                      title={`${series[idx]?.date ?? "-"}: ${formatTRY(revenueValues[idx] ?? 0)}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Min: {formatTRY(revenueStats.min)}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Ort: {formatTRY(revenueStats.avg)}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Max: {formatTRY(revenueStats.max)}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Son: {formatTRY(revenueStats.last)}</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-900">Trafik Kolon Grafigi</div>
                  <div className="text-xs text-slate-500">Aktif pencere: {visitors?.activeWindowMin ?? 5} dk</div>
                </div>
                <div className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">Ziyaretci</div>
              </div>
              <div className="mt-4 flex h-44 items-end gap-1 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3">
                {visitorBars.map((h, idx) => (
                  <div key={`${visitorSeries[idx]?.date ?? idx}`} className="group flex-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-cyan-500 to-sky-300 transition-all duration-300 group-hover:from-cyan-600 group-hover:to-sky-400"
                      style={{ height: `${h}%` }}
                      title={`${visitorSeries[idx]?.date ?? "-"}: ${visitorValues[idx] ?? 0}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Min: {visitorStats.min}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Ort: {Math.round(visitorStats.avg)}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Max: {visitorStats.max}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Son: {visitorStats.last}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-base font-semibold text-slate-900">Davranis Hunisi</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {funnelRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</div>
                    <div className="mt-1 text-lg font-bold text-slate-900">{row.value}</div>
                    <div className="mt-1 text-xs text-slate-500">Oran %{row.pct}</div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full bg-gradient-to-r ${row.tone}`} style={{ width: `${Math.max(6, Math.min(100, row.pct))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-base font-semibold text-slate-900">Sepette En Cok Olanlar</div>
              <div className="space-y-2">
                {topVariants.map((v) => {
                  const maxQty = Math.max(1, ...topVariants.map((x) => Number(x.qty ?? 0)));
                  const pct = Math.round((Number(v.qty ?? 0) / maxQty) * 100);
                  return (
                    <div key={v.variantId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="line-clamp-1 font-medium text-slate-700">{v.title}</span>
                        <span className="text-slate-500">{v.qty}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white">
                        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${Math.max(8, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {topVariants.length === 0 ? <div className="text-sm text-slate-500">Veri yok.</div> : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Smart Bundle Performansi</div>
                <div className="text-xs text-slate-500">{rangeLabel}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Impression: {smartBundle?.impressions ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Click: {smartBundle?.clicks ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">CTR: %{smartBundle?.ctr ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Sepete ekleme: {smartBundle?.addToCart ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Click-&gt;Add: %{smartBundle?.addRateFromClicks ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Assisted purchase: {smartBundle?.assistedPurchases ?? 0}</div>
              </div>

              <div className="mt-3 text-xs text-slate-600">Add-&gt;Purchase: %{smartBundle?.purchaseRateFromAdds ?? 0}</div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700">
                Ortalama CTR: 7g %{smartCtr7} | 30g %{smartCtr30} | 90g %{smartCtr90}
              </div>

              <div className="mt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Gunluk Trend (Impression / Click / Add)</div>
                <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {smartHoverPoint ? (
                    <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[10px] text-slate-700 shadow-sm">
                      <div className="font-semibold text-slate-800">{smartHoverPoint.date}</div>
                      <div>Impression: {smartHoverPoint.impressions}</div>
                      <div>Click: {smartHoverPoint.clicks}</div>
                      <div>Add: {smartHoverPoint.adds}</div>
                    </div>
                  ) : null}
                  <div className="flex h-28 items-end gap-1">
                    {smartSeries.map((point, idx) => (
                      <div
                        key={point.date}
                        className="group flex flex-1 items-end gap-[2px]"
                        onMouseEnter={() => setSmartHoverIndex(idx)}
                        onMouseLeave={() => setSmartHoverIndex(null)}
                      >
                        <div
                          className="w-full rounded-t bg-cyan-300"
                          style={{ height: `${smartImpressionBars[idx] ?? 6}%` }}
                          title={`${point.date} impression: ${point.impressions}`}
                        />
                        <div
                          className="w-full rounded-t bg-sky-500"
                          style={{ height: `${smartClickBars[idx] ?? 6}%` }}
                          title={`${point.date} click: ${point.clicks}`}
                        />
                        <div
                          className="w-full rounded-t bg-indigo-500"
                          style={{ height: `${smartAddBars[idx] ?? 6}%` }}
                          title={`${point.date} add: ${point.adds}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{smartSeries[0]?.date ?? "-"}</span>
                    <span>{smartSeries[smartSeries.length - 1]?.date ?? "-"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-600">
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-cyan-300" />Impression</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" />Click</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />Add</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kaynak Dagilimi</div>
                <div className="mt-1 space-y-1">
                  {(smartBundle?.sources ?? []).slice(0, 4).map((row) => (
                    <div key={row.source} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      <span>{row.source}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  {(smartBundle?.sources ?? []).length === 0 ? <div className="text-xs text-slate-500">Veri yok.</div> : null}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Yerlesim Dagilimi</div>
                <div className="mt-1 space-y-1">
                  {(smartBundle?.placements ?? []).slice(0, 4).map((row) => (
                    <div key={row.placement} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      <span>{row.placement}</span>
                      <span>{row.count}</span>
                    </div>
                  ))}
                  {(smartBundle?.placements ?? []).length === 0 ? <div className="text-xs text-slate-500">Veri yok.</div> : null}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Kupon Oneri Performansi</div>
                <div className="text-xs text-slate-500">{rangeLabel}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Impression: {couponReco?.impressions ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Apply: {couponReco?.applies ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Apply rate: %{couponReco?.applyRate ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Tahmini indirim: {formatTRY(couponReco?.estimatedDiscountTotalTRY ?? 0)}</div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">En iyi kuponlar</div>
                <div className="mt-1 space-y-1">
                  {(couponReco?.topCoupons ?? []).map((row) => (
                    <div key={row.couponCode} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      <span>{row.couponCode}</span>
                      <span>{row.applies}/{row.impressions} (%{row.applyRate})</span>
                    </div>
                  ))}
                  {(couponReco?.topCoupons ?? []).length === 0 ? <div className="text-xs text-slate-500">Veri yok.</div> : null}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Kupon Performance</div>
                <div className="text-xs text-slate-500">{rangeLabel}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                  Apply: {couponPerf?.summary.applies ?? 0}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                  Donusum: %{couponPerf?.summary.conversionRate ?? 0}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                  Net Katki: {formatTRY(couponPerf?.summary.netRevenueTRY ?? 0)}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                  Maliyet: {formatTRY(couponPerf?.summary.totalDiscountTRY ?? 0)}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Segment (Yeni / Mevcut)
                </div>
                <div className="mt-1 flex gap-2">
                  {(couponPerf?.segments.customerType ?? []).map((row) => (
                    <div
                      key={`seg-customer-${row.label}`}
                      className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                    >
                      {row.label}: {row.value}
                    </div>
                  ))}
                  {(couponPerf?.segments.customerType ?? []).length === 0 ? (
                    <div className="text-xs text-slate-500">Veri yok.</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  En guclu kuponlar
                </div>
                <div className="mt-1 space-y-1">
                  {(couponPerf?.byCoupon ?? []).slice(0, 4).map((row) => (
                    <div
                      key={`coupon-perf-${row.couponId}`}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                    >
                      <span>{row.code}</span>
                      <span>
                        {row.uses} use | %{row.conversionRate} | {formatTRY(row.netRevenueTRY)}
                      </span>
                    </div>
                  ))}
                  {(couponPerf?.byCoupon ?? []).length === 0 ? (
                    <div className="text-xs text-slate-500">Veri yok.</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mini Trend
                </div>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex h-12 items-end gap-1">
                    {couponApplyBars.map((h, idx) => (
                      <div
                        key={`coupon-apply-${couponTrend[idx]?.day ?? idx}`}
                        className="flex-1 rounded-t bg-cyan-400"
                        style={{ height: `${h}%` }}
                        title={`${couponTrend[idx]?.day ?? "-"} | Apply: ${couponTrend[idx]?.applies ?? 0}`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-600">
                    <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                    Gunluk apply
                  </div>

                  <div className="mt-2 flex h-12 items-end gap-1">
                    {couponNetBars.map((h, idx) => (
                      <div
                        key={`coupon-net-${couponTrend[idx]?.day ?? idx}`}
                        className="flex-1 rounded-t bg-amber-400"
                        style={{ height: `${h}%` }}
                        title={`${couponTrend[idx]?.day ?? "-"} | Net: ${formatTRY(
                          Math.max(
                            0,
                            Number(couponTrend[idx]?.revenueTRY ?? 0) -
                              Math.max(0, Number(couponTrend[idx]?.discountTRY ?? 0)),
                          ),
                        )}`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-600">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    Gunluk net katki
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Urun Performansi</div>
                <div className="text-xs text-slate-500">Ilk 15 urun</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Urun</th>
                      <th className="px-3 py-2">Views</th>
                      <th className="px-3 py-2">Add</th>
                      <th className="px-3 py-2">Satis</th>
                      <th className="px-3 py-2">Ciro</th>
                      <th className="px-3 py-2">Donusum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfRows.slice(0, 15).map((r) => (
                      <tr key={r.productId} className="border-t border-slate-200">
                        <td className="px-3 py-2">
                          <div className="line-clamp-1 max-w-[320px] font-medium text-slate-900">{r.title}</div>
                        </td>
                        <td className="px-3 py-2">{r.views}</td>
                        <td className="px-3 py-2">{r.addToCart}</td>
                        <td className="px-3 py-2">{r.salesQty}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{formatTRY(r.revenueTRY)}</td>
                        <td className="px-3 py-2">%{r.conversion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {perfRows.length === 0 ? <div className="mt-2 text-sm text-slate-500">Performans verisi yok.</div> : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-base font-semibold text-slate-900">A/B Sonuclari</div>
                <div className="space-y-2">
                  {abRows.map((r) => (
                    <div key={r.variant} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">Varyant {r.variant}</span>
                        <span className="text-xs text-slate-500">Views {r.views}</span>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">Add %{r.addRate} | Purchase %{r.purchaseRate}</div>
                    </div>
                  ))}
                  {abRows.length === 0 ? <div className="text-sm text-slate-500">A/B test verisi yok.</div> : null}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-base font-semibold text-slate-900">En Cok Tiklanan Urunler</div>
                <div className="space-y-2">
                  {topClicked.map((r) => (
                    <div key={r.productId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <div className="line-clamp-1 font-medium text-slate-800">{r.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {r.views} goruntuleme | Donusum %{r.conversion}
                      </div>
                    </div>
                  ))}
                  {topClicked.length === 0 ? <div className="text-sm text-slate-500">Veri yok.</div> : null}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
