"use client";

import { adminApi, type ReconciliationData, type ReleaseResult } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

function formatTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function OperationsPage() {
  const [days, setDays] = useState(30);
  const [minutes, setMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [releaseResult, setReleaseResult] = useState<ReleaseResult | null>(null);
  const [capBusy, setCapBusy] = useState(false);
  const [capMessage, setCapMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.reconciliation(days);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmedik hata");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runRelease() {
    setBusy(true);
    setError(null);
    setReleaseResult(null);
    try {
      const result = await adminApi.releaseStaleOrders(minutes);
      setReleaseResult(result);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operasyon calistirilamadi");
    } finally {
      setBusy(false);
    }
  }

  async function resetSmartUpsellCap() {
    setCapBusy(true);
    setCapMessage(null);
    try {
      const result = await adminApi.resetSmartUpsellCap();
      setCapMessage(result.message || "Smart upsell cooldown sifirlandi.");
    } catch (e) {
      setCapMessage(e instanceof Error ? e.message : "Cooldown sifirlanamadi.");
    } finally {
      setCapBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Bakim ve mutabakat</div>
        <h1 className="mt-1 text-2xl font-bold">Operasyon</h1>
        <p className="mt-1 text-sm text-slate-300">Stale siparisleri serbest birakma ve odeme mutabakati.</p>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span>Mutabakat periyodu (gun)</span>
            <input
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value || "30"))}
            />
          </label>

          <label className="grid gap-1.5">
            <span>Stale esik (dakika)</span>
            <input
              className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
              type="number"
              min={5}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value || "30"))}
            />
          </label>

          <button className="h-10 rounded-lg bg-[#2b6cff] px-4 text-sm font-semibold text-white hover:bg-[#1e5ae8] disabled:opacity-60" disabled={busy} onClick={() => void runRelease()}>
            {busy ? "Calisiyor..." : "Stale Siparisleri Serbest Birak"}
          </button>
          <button
            className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            disabled={capBusy}
            onClick={() => void resetSmartUpsellCap()}
          >
            {capBusy ? "Sifirlaniyor..." : "Smart Upsell Cooldown Sifirla"}
          </button>
        </div>
        {capMessage ? <div className="mt-3 text-sm text-slate-600">{capMessage}</div> : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Hata: {error}
        </div>
      ) : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}

      {data ? (
        <div className="row" style={{ marginTop: 12 }}>
          <div className="card">
            <div>Odenen Siparis</div>
            <b>{data.paidOrders}</b>
          </div>
          <div className="card">
            <div>Basarisiz Odeme</div>
            <b>{data.failedOrders}</b>
          </div>
          <div className="card">
            <div>Bekleyen Odeme</div>
            <b>{data.pendingOrders}</b>
          </div>
          <div className="card">
            <div>Stale Pending</div>
            <b>{data.stalePendingOrders}</b>
          </div>
          <div className="card">
            <div>Odenen Ciro</div>
            <b>{formatTRY(data.paidRevenueTRY)}</b>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 font-semibold text-slate-900">Basarisiz Odeme Sebepleri</div>
        {data?.failedReasons?.length ? (
          <ul className="m-0 list-disc pl-5">
            {data.failedReasons.map((row) => (
              <li key={row.code}>
                {row.code}: {row.count}
              </li>
            ))}
          </ul>
        ) : (
          <div>Veri yok.</div>
        )}
      </div>

      {releaseResult ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="font-semibold text-slate-900">Son Operasyon Sonucu</div>
          <div>Esik: {releaseResult.thresholdMinutes} dk</div>
          <div>Incelenen: {releaseResult.scanned}</div>
          <div>Serbest birakilan: {releaseResult.released}</div>
          <div>Siparisler: {releaseResult.releasedOrderIds.join(", ") || "-"}</div>
        </div>
      ) : null}
    </div>
  );
}
