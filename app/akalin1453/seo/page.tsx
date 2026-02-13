"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi, type SeoHealthReport } from "@/lib/api";

function formatTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function SeoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SeoHealthReport | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.seoHealth();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "SEO raporu yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-[linear-gradient(135deg,#fff6e8_0%,#fffdf8_55%,#ecfeff_100%)] p-5 shadow-sm">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/40 blur-2xl" />
        <div className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">
              SEO
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Teknik SEO Saglik Paneli
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Sitemap, robots, schema ve urun meta kalitesini tek ekranda takip edin.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-500 px-3 text-sm font-semibold text-white hover:bg-cyan-600"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yenile
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Yukleniyor...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Hata: {error}
        </div>
      ) : null}

      {!loading && !error && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                SEO Skoru
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">%{data.score}</div>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                Toplam Urun
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">
                {data.summary.totalProducts}
              </div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                Eksik Alt Text
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">
                {data.summary.missingImageAltCount}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                30g Stale Urun
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900">
                {data.summary.staleProducts30d}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-semibold text-slate-900">Kontrol Listesi</div>
              <div className="mt-3 space-y-2">
                {data.checks.map((check) => (
                  <div
                    key={check.key}
                    className={
                      check.pass
                        ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                        : "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    }
                  >
                    {check.pass ? "Gecerli" : "Aksiyon gerekli"}: {check.label}
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <a
                  href={data.links.sitemap}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100"
                >
                  Sitemap ac
                </a>
                <a
                  href={data.links.robots}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100"
                >
                  Robots ac
                </a>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-semibold text-slate-900">
                Meta Onerileri (Top Urunler)
              </div>
              <div className="mt-3 space-y-2">
                {data.topProducts.map((product) => (
                  <div key={product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="line-clamp-1 font-semibold text-slate-900">{product.name}</div>
                      <div className="text-xs text-slate-500">{formatTRY(product.price)}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      <b>Title:</b> {product.suggestedTitle}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      <b>Description:</b> {product.suggestedDescription}
                    </div>
                  </div>
                ))}
                {data.topProducts.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    Urun verisi bulunamadi.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-base font-semibold text-slate-900">Aksiyon Onerileri</div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {data.suggestions.map((row, index) => (
                <li key={`seo-suggestion-${index}`}>{row}</li>
              ))}
              {data.suggestions.length === 0 ? <li>SEO saglik durumu iyi gorunuyor.</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

