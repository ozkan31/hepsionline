"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  TicketPercent,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  adminApi,
  type AdminCoupon,
  type CouponAbReport,
  type CouponPerformanceByCouponRow,
  type CouponPerformanceReport,
  type CouponPerformanceTrendRow,
} from "@/lib/api";

type FormState = {
  code: string;
  type: "FIXED" | "PERCENT";
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  description: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  perUserLimit: "",
  startsAt: "",
  expiresAt: "",
  description: "",
  isActive: true,
};

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

function parseOptionalNumber(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function isoToInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function inputToIso(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function couponToForm(coupon: AdminCoupon): FormState {
  return {
    code: coupon.code ?? "",
    type: coupon.type ?? "PERCENT",
    value: String(coupon.value ?? ""),
    minOrderAmount:
      coupon.minOrderAmount === null || coupon.minOrderAmount === undefined
        ? ""
        : String(coupon.minOrderAmount),
    maxDiscountAmount:
      coupon.maxDiscountAmount === null || coupon.maxDiscountAmount === undefined
        ? ""
        : String(coupon.maxDiscountAmount),
    usageLimit:
      coupon.usageLimit === null || coupon.usageLimit === undefined
        ? ""
        : String(coupon.usageLimit),
    perUserLimit:
      coupon.perUserLimit === null || coupon.perUserLimit === undefined
        ? ""
        : String(coupon.perUserLimit),
    startsAt: isoToInput(coupon.startsAt),
    expiresAt: isoToInput(coupon.expiresAt),
    description: coupon.description ?? "",
    isActive: Boolean(coupon.isActive),
  };
}

export default function KuponlarPage() {
  const [perfRange, setPerfRange] = useState<7 | 30 | 90>(30);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perf, setPerf] = useState<CouponPerformanceReport | null>(null);
  const [abRange, setAbRange] = useState<7 | 30 | 90>(30);
  const [abLoading, setAbLoading] = useState(true);
  const [abReport, setAbReport] = useState<CouponAbReport | null>(null);
  const [abForm, setAbForm] = useState({
    enabled: false,
    traffic: 100,
    splitA: 50,
    forceVariant: "NONE" as "A" | "B" | "NONE",
    couponCodeA: "",
    couponCodeB: "",
  });
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    void loadCoupons();
    void loadPerformance(perfRange);
    void loadAbTest(abRange);
  }, [perfRange, abRange]);

  const filteredCoupons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter((coupon) => {
      const text = `${coupon.code} ${coupon.description ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [coupons, query]);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = coupons.filter((c) => c.isActive).length;
    const expiringSoon = coupons.filter((c) => {
      if (!c.expiresAt) return false;
      const expires = new Date(c.expiresAt).getTime();
      if (Number.isNaN(expires)) return false;
      return expires >= now && expires <= now + 1000 * 60 * 60 * 24 * 7;
    }).length;
    return {
      total: coupons.length,
      active,
      passive: Math.max(0, coupons.length - active),
      expiringSoon,
    };
  }, [coupons]);

  const trendBars = useMemo(() => {
    const trend = perf?.trend ?? [];
    return {
      impressionHeights: normalizeBars(
        trend.map((row) => Number(row.impressions ?? 0)),
      ),
      applyHeights: normalizeBars(trend.map((row) => Number(row.applies ?? 0))),
    };
  }, [perf?.trend]);

  const topCouponRows = useMemo<CouponPerformanceByCouponRow[]>(() => {
    return (perf?.byCoupon ?? []).slice(0, 8);
  }, [perf?.byCoupon]);

  async function loadPerformance(days: 7 | 30 | 90) {
    setPerfLoading(true);
    try {
      const data = await adminApi.couponPerformance(days);
      setPerf(data);
    } catch {
      setPerf(null);
    } finally {
      setPerfLoading(false);
    }
  }

  async function loadAbTest(days: 7 | 30 | 90) {
    setAbLoading(true);
    try {
      const data = await adminApi.couponAbTest(days);
      setAbReport(data);
      setAbForm({
        enabled: data.experiment.enabled,
        traffic: data.experiment.traffic,
        splitA: data.experiment.splitA,
        forceVariant: data.experiment.forceVariant ?? "NONE",
        couponCodeA: data.experiment.variants.A.couponCode,
        couponCodeB: data.experiment.variants.B.couponCode,
      });
    } catch {
      setAbReport(null);
    } finally {
      setAbLoading(false);
    }
  }

  async function saveAbConfig() {
    setBusyKey("ab:save");
    setMessage(null);
    try {
      await adminApi.updateCouponAbTest({
        enabled: abForm.enabled,
        traffic: Math.max(0, Math.min(100, Math.floor(Number(abForm.traffic) || 0))),
        splitA: Math.max(0, Math.min(100, Math.floor(Number(abForm.splitA) || 0))),
        forceVariant: abForm.forceVariant,
        couponCodeA: abForm.couponCodeA,
        couponCodeB: abForm.couponCodeB,
      });
      await loadAbTest(abRange);
      setMessage("Kupon A/B ayari kaydedildi.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "A/B ayari kaydedilemedi.");
    } finally {
      setBusyKey(null);
    }
  }

  async function activateAbWinner() {
    setBusyKey("ab:winner");
    setMessage(null);
    try {
      const result = await adminApi.activateCouponAbWinner(abRange);
      await Promise.all([loadAbTest(abRange), loadCoupons(), loadPerformance(perfRange)]);
      setMessage(
        `Kazanan varyant aktif edildi (${result.winner} - ${result.winnerCode}).`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kazanan aktif edilemedi.");
    } finally {
      setBusyKey(null);
    }
  }

  async function loadCoupons() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.coupons();
      setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuponlar yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  function resetCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(coupon: AdminCoupon) {
    setEditingId(coupon.id);
    setForm(couponToForm(coupon));
    setMessage(null);
  }

  async function saveForm() {
    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    const value = parseOptionalNumber(form.value);
    const minOrderAmount = parseOptionalNumber(form.minOrderAmount);
    const maxDiscountAmount = parseOptionalNumber(form.maxDiscountAmount);
    const usageLimit = parseOptionalNumber(form.usageLimit);
    const perUserLimit = parseOptionalNumber(form.perUserLimit);
    const startsAt = inputToIso(form.startsAt);
    const expiresAt = inputToIso(form.expiresAt);

    if (!code || code.length < 3 || code.length > 32) {
      setMessage("Kupon kodu 3-32 karakter olmali.");
      return;
    }
    if (!value || value <= 0) {
      setMessage("Deger pozitif sayi olmali.");
      return;
    }
    if (form.type === "PERCENT" && value > 100) {
      setMessage("Yuzde kuponu en fazla 100 olabilir.");
      return;
    }
    if (startsAt && expiresAt && new Date(startsAt) > new Date(expiresAt)) {
      setMessage("Baslangic tarihi bitis tarihinden sonra olamaz.");
      return;
    }

    setBusyKey(editingId ? `save:${editingId}` : "create");
    setMessage(null);

    try {
      if (editingId) {
        const updated = await adminApi.updateCoupon(editingId, {
          code,
          type: form.type,
          value,
          minOrderAmount,
          maxDiscountAmount,
          usageLimit,
          perUserLimit,
          startsAt,
          expiresAt,
          description: form.description.trim() || null,
          isActive: form.isActive,
        });
        setCoupons((prev) =>
          prev.map((row) => (row.id === editingId ? updated : row)),
        );
        setMessage(`Kupon guncellendi (#${editingId}).`);
      } else {
        const created = await adminApi.createCoupon({
          code,
          type: form.type,
          value,
          minOrderAmount,
          maxDiscountAmount,
          usageLimit,
          perUserLimit,
          startsAt,
          expiresAt,
          description: form.description.trim() || null,
          isActive: form.isActive,
        });
        setCoupons((prev) => [created, ...prev]);
        setMessage(`Kupon olusturuldu (#${created.id}).`);
        resetCreateForm();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kayit yapilamadi.");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleActive(coupon: AdminCoupon) {
    setBusyKey(`toggle:${coupon.id}`);
    setMessage(null);
    try {
      const updated = await adminApi.updateCoupon(coupon.id, {
        isActive: !coupon.isActive,
      });
      setCoupons((prev) =>
        prev.map((row) => (row.id === coupon.id ? updated : row)),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Durum degistirilemedi.");
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteCoupon(coupon: AdminCoupon) {
    const ok = window.confirm(
      `${coupon.code} kuponunu pasife almak istiyor musunuz?`,
    );
    if (!ok) return;

    setBusyKey(`delete:${coupon.id}`);
    setMessage(null);
    try {
      await adminApi.deleteCoupon(coupon.id);
      setCoupons((prev) =>
        prev.map((row) =>
          row.id === coupon.id
            ? {
                ...row,
                isActive: false,
                expiresAt: new Date().toISOString(),
              }
            : row,
        ),
      );
      setMessage(`Kupon pasife alindi (#${coupon.id}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Kupon silinemedi.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-[linear-gradient(135deg,#fff6e8_0%,#fffdf8_55%,#ecfeff_100%)] p-5 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/35 blur-2xl" />
        <div className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full bg-amber-200/45 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">
              Kampanya
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Kupon Merkezi
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Kuponlari olustur, yonet ve hizlica aktif/pasif duruma cek.
            </p>
          </div>
          <button
            onClick={() => {
              void loadCoupons();
              void loadPerformance(perfRange);
              void loadAbTest(abRange);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-500 px-3 text-sm font-semibold text-white hover:bg-cyan-600"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>

        <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Toplam
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {stats.total}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Aktif
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {stats.active}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Pasif
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {stats.passive}
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              7 Gun Icinde Bitecek
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {stats.expiringSoon}
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Hata: {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-[24px] border border-amber-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Kupon A/B Test Motoru</div>
            <div className="text-xs text-slate-500">
              Checkout kupon onerilerini varyantlayin, kazanani tek tikla aktif edin.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={`ab-range-${d}`}
                onClick={() => setAbRange(d)}
                className={
                  abRange === d
                    ? "rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                Son {d} gun
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Test Durumu</div>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                  value={abForm.enabled ? "1" : "0"}
                  onChange={(e) =>
                    setAbForm((prev) => ({ ...prev, enabled: e.target.value === "1" }))
                  }
                >
                  <option value="1">Acik</option>
                  <option value="0">Kapali</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Force Winner</div>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                  value={abForm.forceVariant}
                  onChange={(e) =>
                    setAbForm((prev) => ({
                      ...prev,
                      forceVariant: e.target.value as "A" | "B" | "NONE",
                    }))
                  }
                >
                  <option value="NONE">Yok</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Trafik (%)</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                  type="number"
                  min={0}
                  max={100}
                  value={abForm.traffic}
                  onChange={(e) =>
                    setAbForm((prev) => ({
                      ...prev,
                      traffic: Number(e.target.value || "0"),
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">A Split (%)</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                  type="number"
                  min={0}
                  max={100}
                  value={abForm.splitA}
                  onChange={(e) =>
                    setAbForm((prev) => ({
                      ...prev,
                      splitA: Number(e.target.value || "0"),
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Varyant A Kupon Kodu</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm uppercase outline-none focus:border-amber-400"
                  value={abForm.couponCodeA}
                  onChange={(e) =>
                    setAbForm((prev) => ({
                      ...prev,
                      couponCodeA: e.target.value,
                    }))
                  }
                  placeholder="ABA10"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Varyant B Kupon Kodu</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm uppercase outline-none focus:border-amber-400"
                  value={abForm.couponCodeB}
                  onChange={(e) =>
                    setAbForm((prev) => ({
                      ...prev,
                      couponCodeB: e.target.value,
                    }))
                  }
                  placeholder="ABB75"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void saveAbConfig()}
                disabled={busyKey === "ab:save"}
                className="inline-flex h-10 items-center rounded-xl border border-amber-300 bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ayari Kaydet
              </button>
              <button
                onClick={() => void activateAbWinner()}
                disabled={busyKey === "ab:winner"}
                className="inline-flex h-10 items-center rounded-xl border border-cyan-300 bg-cyan-500 px-4 text-sm font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Kazanani Aktif Et
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            {abLoading ? (
              <div className="text-sm text-slate-600">A/B test verisi yukleniyor...</div>
            ) : null}
            {!abLoading && abReport ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                    Onerilen winner: {abReport.stats.suggestedWinner ?? "-"}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-slate-700">
                    Force winner: {abReport.experiment.forceVariant ?? "-"}
                  </div>
                </div>
                <div className="space-y-2">
                  {abReport.stats.variants.map((row) => (
                    <div key={`ab-variant-${row.variant}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">
                          Varyant {row.variant} ({row.couponCode || "Kodsuz"})
                        </div>
                        <div className="text-xs text-slate-500">
                          Apply %{row.applyRate} | Purchase %{row.purchaseRate}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                        <div>Impression: {row.impressions}</div>
                        <div>Apply: {row.applies}</div>
                        <div>Paid: {row.paidOrders}</div>
                        <div>Net: {formatTRY(row.netTRY)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-amber-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              Kupon Performans Analitigi
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Donusum, maliyet ve kanal etkisini canli takip edin.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={`perf-${d}`}
                onClick={() => setPerfRange(d)}
                className={
                  perfRange === d
                    ? "rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                }
              >
                Son {d} gun
              </button>
            ))}
          </div>
        </div>

        {perfLoading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Performans verisi yukleniyor...
          </div>
        ) : null}

        {!perfLoading && perf ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  Uygulama
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {perf.summary.applies}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Donusum
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  %{perf.summary.conversionRate}
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Indirim Maliyeti
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {formatTRY(perf.summary.totalDiscountTRY)}
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Net Katki
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {formatTRY(perf.summary.netRevenueTRY)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Oneri Apply Rate
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  %{perf.summary.recommendationApplyRate}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Gunluk Trend (Gosterim vs Uygulama)
                </div>
                <div className="mt-3 flex h-44 items-end gap-1 rounded-xl border border-amber-100 bg-amber-50/40 p-2">
                  {(perf.trend as CouponPerformanceTrendRow[]).map((row, index) => (
                    <div key={`${row.day}-${index}`} className="group flex flex-1 items-end gap-0.5">
                      <div
                        className="w-1/2 rounded-t-sm bg-amber-300"
                        style={{ height: `${trendBars.impressionHeights[index] ?? 6}%` }}
                        title={`${row.day} | Gosterim: ${row.impressions}`}
                      />
                      <div
                        className="w-1/2 rounded-t-sm bg-cyan-400"
                        style={{ height: `${trendBars.applyHeights[index] ?? 6}%` }}
                        title={`${row.day} | Uygulama: ${row.applies}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-300" />
                    Oneri gosterim
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Kupon uygulama
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Segment Kirilimi
                </div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Musteri Tipi
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {perf.segments.customerType.map((row) => (
                        <div key={`customer-${row.label}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-slate-500">{row.label}</div>
                          <div className="text-base font-semibold text-slate-900">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Kanal
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      {perf.segments.channel.map((row) => (
                        <div key={`channel-${row.label}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="text-slate-500">{row.label}</div>
                          <div className="text-base font-semibold text-slate-900">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">
                  Kupon Bazli Performans
                </div>
                <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Kupon</th>
                        <th className="px-3 py-2 text-left">Kullanim</th>
                        <th className="px-3 py-2 text-left">Donusum</th>
                        <th className="px-3 py-2 text-left">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCouponRows.map((row) => (
                        <tr key={`perf-row-${row.couponId}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{row.code}</td>
                          <td className="px-3 py-2 text-slate-700">{row.uses}</td>
                          <td className="px-3 py-2 text-slate-700">%{row.conversionRate}</td>
                          <td className="px-3 py-2 text-slate-700">{formatTRY(row.netRevenueTRY)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Otomatik Aksiyon</div>
                <div className="mt-3 space-y-2">
                  {(perf.recommendations ?? []).length > 0 ? (
                    perf.recommendations.map((row) => (
                      <div key={`reco-${row.code}`} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                        <div className="text-xs font-semibold text-amber-800">{row.code}</div>
                        <div className="mt-1 text-xs text-slate-700">{row.suggestion}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Yeterli hacimde kupon verisi olustugunda aksiyon onerileri burada listelenir.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr]">
        <div className="rounded-[24px] border border-amber-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">
                {editingId ? `Kupon Duzenle #${editingId}` : "Yeni Kupon"}
              </div>
              <div className="text-xs text-slate-500">
                Kupon kurallarini tek panelden yonetin.
              </div>
            </div>
            {editingId ? (
              <button
                onClick={resetCreateForm}
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Yeni Form
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 text-slate-600">Kod</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="YAZ10"
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Tip</div>
              <select
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as "FIXED" | "PERCENT",
                  }))
                }
              >
                <option value="PERCENT">Yuzde (%)</option>
                <option value="FIXED">Sabit Tutar (TRY)</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Deger</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="number"
                min={1}
                value={form.value}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, value: e.target.value }))
                }
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Min. Sepet Tutari</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="number"
                min={0}
                value={form.minOrderAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    minOrderAmount: e.target.value,
                  }))
                }
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Maks. Indirim</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="number"
                min={0}
                value={form.maxDiscountAmount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    maxDiscountAmount: e.target.value,
                  }))
                }
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Kullanim Limiti</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="number"
                min={1}
                value={form.usageLimit}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, usageLimit: e.target.value }))
                }
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Kisi Basi Limit</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="number"
                min={1}
                value={form.perUserLimit}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, perUserLimit: e.target.value }))
                }
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Baslangic</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startsAt: e.target.value }))
                }
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600">Bitis</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, expiresAt: e.target.value }))
                }
              />
            </label>

            <label className="text-sm md:col-span-2">
              <div className="mb-1 text-slate-600">Aciklama</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Orn: Ilk sipariste gecerlidir"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
              />
              Olustururken aktif olsun
            </label>
            <button
              onClick={saveForm}
              disabled={busyKey === "create" || busyKey === `save:${editingId ?? 0}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300 bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editingId ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Degisiklikleri Kaydet" : "Kupon Ekle"}
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-slate-900">Kupon Listesi</div>
              <div className="text-xs text-slate-500">
                Toplam: {filteredCoupons.length}
              </div>
            </div>
            <input
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-400 sm:w-56"
              placeholder="Kod veya aciklama ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-4 max-h-[560px] overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Kod</th>
                  <th className="px-3 py-2 text-left">Indirim</th>
                  <th className="px-3 py-2 text-left">Durum</th>
                  <th className="px-3 py-2 text-left">Kullanim</th>
                  <th className="px-3 py-2 text-left">Bitis</th>
                  <th className="px-3 py-2 text-right">Islem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Yukleniyor...
                    </td>
                  </tr>
                ) : null}

                {!loading && filteredCoupons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Kupon bulunamadi.
                    </td>
                  </tr>
                ) : null}

                {!loading
                  ? filteredCoupons.map((coupon) => {
                      const uses = coupon._count?.usages ?? 0;
                      const expiryLabel = coupon.expiresAt
                        ? new Date(coupon.expiresAt).toLocaleString("tr-TR")
                        : "-";
                      return (
                        <tr key={coupon.id} className="border-t border-slate-100">
                          <td className="px-3 py-3">
                            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                              <TicketPercent className="h-3.5 w-3.5" />
                              {coupon.code}
                            </div>
                            {coupon.description ? (
                              <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                                {coupon.description}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {coupon.type === "PERCENT"
                              ? `%${coupon.value}`
                              : formatTRY(coupon.value)}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                coupon.isActive
                                  ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                                  : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                              }
                            >
                              {coupon.isActive ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {coupon.isActive ? "Aktif" : "Pasif"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{uses}</td>
                          <td className="px-3 py-3 text-slate-700">{expiryLabel}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => startEdit(coupon)}
                                className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Duzenle
                              </button>
                              <button
                                onClick={() => void toggleActive(coupon)}
                                disabled={busyKey === `toggle:${coupon.id}`}
                                className="inline-flex h-8 items-center rounded-lg border border-cyan-300 px-2.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {coupon.isActive ? "Pasife Al" : "Aktif Et"}
                              </button>
                              <button
                                onClick={() => void deleteCoupon(coupon)}
                                disabled={busyKey === `delete:${coupon.id}`}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Sil
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
