"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, type QuestionItem } from "@/lib/api";

export default function QuestionsPage() {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminApi.questions();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sorular yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitAnswer = async (id: string) => {
    const text = String(drafts[id] ?? "").trim();
    if (!text) return;
    setBusy(id);
    try {
      const updated = await adminApi.questionAnswer(id, text);
      if (updated) {
        setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      }
      setDrafts((prev) => ({ ...prev, [id]: "" }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Topluluk</div>
        <h1 className="mt-1 text-2xl font-bold">Soru & Cevap</h1>
        <p className="mt-1 text-sm text-slate-300">Musteri sorularini hizli yanitlayin ve gorunurluk yonetin.</p>
      </section>
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Hata: {error}</div> : null}

      {!loading && !error ? (
        <div className="card qa-card">
          <div className="qa-head-row">
            <div>Urun</div>
            <div>Soru</div>
            <div>Kullanici</div>
            <div>Durum</div>
            <div>Cevap</div>
            <div>Islem</div>
          </div>

          {items.map((q) => {
            const createdAt = q.createdAt ? new Date(q.createdAt) : null;
            const answers = Array.isArray(q.answers) ? q.answers : [];
            const first = answers[0];
            return (
              <div key={q.id} className="qa-row">
                <div>
                  <div className="review-product">{q.product?.title ?? "Urun"}</div>
                  <div className="review-mini">{q.product?.slug ?? ""}</div>
                </div>
                <div>
                  <div className="qa-question">{q.question}</div>
                  <div className="review-mini">{createdAt ? createdAt.toLocaleString("tr-TR") : "-"}</div>
                </div>
                <div className="review-mini">{q.user?.email ?? "Ziyaretci"}</div>
                <div>
                  <span className={`status-pill ${q.isApproved ? "ok" : "draft"}`}>{q.isApproved ? "Onayli" : "Bekliyor"}</span>
                </div>
                <div>
                  {first ? (
                    <div className="qa-answer-text">
                      <strong>Yanit:</strong> {first.answer}
                    </div>
                  ) : (
                    <div className="review-mini">Henuz yanit yok.</div>
                  )}
                  <textarea
                    className="qa-input"
                    rows={2}
                    placeholder="Yanit yaz..."
                    value={drafts[q.id] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                </div>
                <div className="qa-actions">
                  <button
                    className="btn"
                    disabled={busy === q.id}
                    onClick={async () => {
                      setBusy(q.id);
                      try {
                        const updated = await adminApi.questionApprove(q.id, !q.isApproved);
                        setItems((prev) => prev.map((x) => (x.id === q.id ? updated : x)));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {q.isApproved ? "Kaldir" : "Onayla"}
                  </button>
                  <button className="btn btnPrimary" disabled={busy === q.id || !String(drafts[q.id] ?? "").trim()} onClick={() => submitAnswer(q.id)}>
                    Yanitla
                  </button>
                </div>
              </div>
            );
          })}

          {items.length === 0 ? <div className="qa-empty">Henuz soru yok.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
