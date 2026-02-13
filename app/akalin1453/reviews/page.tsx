"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type ReviewItem } from "@/lib/api";

export default function ReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminApi.reviews();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Degerlendirmeler yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Topluluk</div>
        <h1 className="mt-1 text-2xl font-bold">Degerlendirmeler</h1>
        <p className="mt-1 text-sm text-slate-300">Yorum moderasyonu ve urun algisi yonetimi.</p>
      </section>
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Hata: {error}</div> : null}

      {!loading && !error ? (
        <div className="card review-card">
          <div className="review-head-row">
            <div>Urun</div>
            <div>Kullanici</div>
            <div>Puan</div>
            <div>Durum</div>
            <div>Tarih</div>
            <div>Islem</div>
          </div>
          {items.map((r) => {
            const createdAt = r.createdAt ? new Date(r.createdAt) : null;
            return (
              <div key={r.id} className="review-row">
                <div>
                  <div className="review-product">{r.product?.title ?? "Urun"}</div>
                  <div className="review-mini">{r.title ?? ""}</div>
                </div>
                <div className="review-mini">{r.user?.email ?? "-"}</div>
                <div className="review-stars">{"?".repeat(r.rating ?? 0)}</div>
                <div>
                  <span className={`status-pill ${r.isApproved ? "ok" : "draft"}`}>{r.isApproved ? "Onayli" : "Bekliyor"}</span>
                </div>
                <div className="review-mini">{createdAt ? createdAt.toLocaleString("tr-TR") : "-"}</div>
                <div className="review-actions">
                  <button
                    className="btn"
                    disabled={busy === r.id}
                    onClick={async () => {
                      setBusy(r.id);
                      try {
                        const updated = await adminApi.reviewApprove(r.id, !r.isApproved);
                        setItems((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {r.isApproved ? "Kaldir" : "Onayla"}
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 ? <div className="review-empty">Henuz degerlendirme yok.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
