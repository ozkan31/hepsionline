"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, type AbandonedCartSummary, type NotificationRow, type RevenueReport, type SearchAnalyticsReport, type StockAlertSummary, type TopProduct } from "@/lib/api";

type LiveEvent = {
  id: string;
  msg: string;
  createdAt?: string;
};

export default function Dashboard() {
  const [rev, setRev] = useState<RevenueReport | null>(null);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [abandoned, setAbandoned] = useState<AbandonedCartSummary | null>(null);
  const [stockAlerts, setStockAlerts] = useState<StockAlertSummary | null>(null);
  const [searchAnalytics, setSearchAnalytics] = useState<SearchAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [abandonedActionMsg, setAbandonedActionMsg] = useState<string | null>(null);
  const [abandonedBusy, setAbandonedBusy] = useState(false);
  const [stockActionMsg, setStockActionMsg] = useState<string | null>(null);
  const [stockBusy, setStockBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revenue, topProducts, abandonedSummary, stockSummary, searchSummary] = await Promise.all([
        adminApi.reportsRevenue(30),
        adminApi.topProducts(10),
        adminApi.abandonedCarts(30, 10),
        adminApi.stockAlertsSummary(),
        adminApi.searchAnalytics(30),
      ]);
      setRev(revenue);
      setTop(topProducts);
      setAbandoned(abandonedSummary);
      setStockAlerts(stockSummary);
      setSearchAnalytics(searchSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dashboard verisi alinamadi.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runAbandonedScan = useCallback(async () => {
    setAbandonedBusy(true);
    setAbandonedActionMsg(null);
    try {
      const result = await adminApi.scanAbandonedCarts(30, 120);
      const summary = await adminApi.abandonedCarts(30, 10);
      setAbandoned(summary);
      setAbandonedActionMsg(`Tara-gonder tamamlandi: ${result.sent} bildirim olusturuldu.`);
    } catch (e) {
      setAbandonedActionMsg(e instanceof Error ? e.message : "Tara-gonder basarisiz.");
    } finally {
      setAbandonedBusy(false);
    }
  }, []);

  const runStockDispatch = useCallback(async () => {
    setStockBusy(true);
    setStockActionMsg(null);
    try {
      const result = await adminApi.stockAlertsDispatch(300);
      const summary = await adminApi.stockAlertsSummary();
      setStockAlerts(summary);
      setStockActionMsg(`Dispatch tamamlandi: ${result.notified} bildirim isaretlendi.`);
    } catch (e) {
      setStockActionMsg(e instanceof Error ? e.message : "Dispatch basarisiz.");
    } finally {
      setStockBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await adminApi.notifications();
        const list: NotificationRow[] = Array.isArray(rows) ? rows : [];
        setEvents(
          list.slice(0, 8).map((r) => ({
            id: r.id,
            msg: r.message ?? r.action ?? "Bildirim",
            createdAt: r.createdAt,
          })),
        );
        setEventsError(null);
      } catch {
        setEventsError("Canli bildirimler su an alinamiyor.");
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const series = useMemo(() => rev?.series ?? [], [rev]);
  const totals = series.map((s) => Number(s.totalTRY ?? 0));
  const maxVal = Math.max(1, ...totals);
  const minVal = Math.min(0, ...totals);
  const formatTRY = (v: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(v) || 0);
  const points = useMemo(() => {
    if (!series.length) return "";
    const w = 640;
    const h = 180;
    const padX = 16;
    const padY = 18;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;
    return series
      .map((s, i: number) => {
        const x = padX + (innerW * i) / Math.max(1, series.length - 1);
        const v = Number(s.totalTRY ?? 0);
        const t = (v - minVal) / Math.max(1, maxVal - minVal);
        const y = padY + innerH - t * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [series, maxVal, minVal]);
  const last = series[series.length - 1];
  const hasSeries = series.length > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Yonetim merkezi</div>
        <h1 className="mt-1 text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-300">Gelir, operasyon ve canli olaylari tek ekrandan takip edin.</p>
      </section>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Hata: {error}
          <div className="mt-3">
            <button className="h-9 rounded-lg border border-rose-300 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-100" onClick={() => void loadDashboard()}>
              Tekrar dene
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gelir performansi</div>
                <div className="text-lg font-bold text-slate-900">Son 30 gun ciro</div>
              </div>
              <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Son 30 gun</div>
            </div>

            <div className="mt-4 flex items-end justify-between">
              <div className="text-3xl font-bold text-slate-900">{formatTRY(rev?.totalTRY ?? 0)}</div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Canli veri</div>
            </div>

            {hasSeries ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <svg viewBox="0 0 640 180" preserveAspectRatio="none" aria-hidden="true" className="h-44 w-full">
                  <defs>
                    <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`M ${points} L 624 170 L 16 170 Z`} fill="url(#lineGrad)" />
                  <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{series[0]?.date ?? "-"}</span>
                  <span>{last?.date ?? "-"}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                Son 30 gun icin ciro verisi bulunamadi.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-bold text-slate-900">Canli Bildirimler</div>
              <div className="mt-1 text-xs text-slate-500">Webhook + polling ile guncellenir.</div>
              {eventsError ? <div className="mt-2 text-sm text-rose-700">{eventsError}</div> : null}
              {!events.length ? <div className="mt-3 text-sm text-slate-500">Bildirim yok.</div> : null}
              <ul className="mt-3 space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {e.msg}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-bold text-slate-900">En cok satan urunler</div>
              {top.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {top.map((t) => (
                    <span key={t.productId} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {t.title}: {t.qty} adet
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Top urun verisi yok.</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-slate-900">Terk Edilen Sepetler</div>
                  <div className="mt-1 text-xs text-slate-500">Esik: {abandoned?.thresholdMinutes ?? 30} dk</div>
                </div>
                <button
                  onClick={() => void runAbandonedScan()}
                  disabled={abandonedBusy}
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {abandonedBusy ? "Calisiyor..." : "Tara-gonder"}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Takip: {abandoned?.tracked ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Aksiyon: {abandoned?.actionable ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Gonderilen: {abandoned?.sent ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Kazanilan: {abandoned?.recovered ?? 0}</div>
              </div>

              <div className="mt-2 text-xs text-slate-500">Recovery rate: %{abandoned?.recoveryRate ?? 0}</div>
              {abandonedActionMsg ? <div className="mt-2 text-xs text-slate-600">{abandonedActionMsg}</div> : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-slate-900">Stok Bildirimleri</div>
                  <div className="mt-1 text-xs text-slate-500">Gelince haber ver akisi</div>
                </div>
                <button
                  onClick={() => void runStockDispatch()}
                  disabled={stockBusy}
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stockBusy ? "Calisiyor..." : "Dispatch"}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Toplam: {stockAlerts?.total ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Bekleyen: {stockAlerts?.pending ?? 0}</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">Gonderilen: {stockAlerts?.notified ?? 0}</div>
              </div>

              {stockActionMsg ? <div className="mt-2 text-xs text-slate-600">{stockActionMsg}</div> : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-bold text-slate-900">Arama Analitigi</div>
              <div className="mt-1 text-xs text-slate-500">Son 30 gun arama davranisi</div>
              <div className="mt-2 text-xs text-slate-700">Toplam arama: {searchAnalytics?.totalSearches ?? 0}</div>
              <div className="mt-2 text-xs font-semibold text-slate-700">En cok arananlar</div>
              <ul className="mt-1 space-y-1">
                {(searchAnalytics?.topQueries ?? []).slice(0, 4).map((row) => (
                  <li key={`top-${row.query}`} className="text-xs text-slate-600">
                    {row.query} ({row.count})
                  </li>
                ))}
                {(searchAnalytics?.topQueries ?? []).length === 0 ? <li className="text-xs text-slate-500">Veri yok.</li> : null}
              </ul>
              <div className="mt-2 text-xs font-semibold text-slate-700">Sonucsuz aramalar</div>
              <ul className="mt-1 space-y-1">
                {(searchAnalytics?.noResultQueries ?? []).slice(0, 4).map((row) => (
                  <li key={`empty-${row.query}`} className="text-xs text-slate-600">
                    {row.query} ({row.count})
                  </li>
                ))}
                {(searchAnalytics?.noResultQueries ?? []).length === 0 ? <li className="text-xs text-slate-500">Veri yok.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
