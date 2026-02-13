"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type ReturnRequest, type ReturnRequestStatus, type ReturnRequestType } from "@/lib/api";

const STATUS_OPTIONS = ["REQUESTED", "REVIEWING", "APPROVED", "REJECTED", "COMPLETED", "CANCELLED"] as const;
const STATUS_LABELS: Record<ReturnRequestStatus, string> = {
  REQUESTED: "Alindi",
  REVIEWING: "Incelemede",
  APPROVED: "Onaylandi",
  REJECTED: "Reddedildi",
  COMPLETED: "Tamamlandi",
  CANCELLED: "Iptal edildi",
};

const TYPE_LABELS: Record<ReturnRequestType, string> = {
  RETURN: "Iade",
  EXCHANGE: "Degisim",
};

export default function ReturnsPage() {
  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: ReturnRequestStatus; adminNote: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = () => {
      setLoading(true);
      setError(null);

      return adminApi
        .returnRequests()
        .then((list) => {
          if (!active) return;
          const arr = Array.isArray(list) ? list : [];
          setRows(arr);
          setDrafts((prev) => {
            const next = { ...prev };
            for (const r of arr) {
              if (!next[r.id]) {
                next[r.id] = {
                  status: r.status ?? "REQUESTED",
                  adminNote: r.adminNote ?? "",
                };
              }
            }
            return next;
          });
        })
        .catch((e) => {
          if (!active) return;
          setError(e instanceof Error ? e.message : "Iade talepleri yuklenemedi.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    load();
    const t = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  const requestedCount = useMemo(() => rows.filter((x) => x.status === "REQUESTED").length, [rows]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Satis Sonrasi</div>
        <h1 className="mt-1 text-2xl font-bold">Iade Talepleri</h1>
        <p className="mt-1 text-sm text-slate-300">Iade ve degisim taleplerini durum bazli yonetin.</p>
      </section>

      <div className="order-head card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ marginBottom: 0 }}>
        <div>
          <div className="order-title">Iade ve degisim talepleri</div>
          <div className="order-sub">Musteri taleplerini durum ve not ile yonet.</div>
        </div>
        <div className="badge rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Toplam {rows.length} - Bekleyen {requestedCount}</div>
      </div>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Hata: {error}</div> : null}

      {!loading && !error ? (
        <div className="order-table">
          <div className="order-row order-head-row" style={{ gridTemplateColumns: "0.9fr 0.9fr 1fr 0.7fr 0.9fr 1.2fr 1.4fr 0.7fr" }}>
            <div>Talep</div>
            <div>Siparis</div>
            <div>Musteri</div>
            <div>Tip</div>
            <div>Durum</div>
            <div>Neden</div>
            <div>Admin Notu</div>
            <div>Islem</div>
          </div>

          {rows.map((r) => {
            const draft = drafts[r.id] ?? { status: r.status ?? "REQUESTED", adminNote: r.adminNote ?? "" };
            const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString("tr-TR") : "-";
            return (
              <div key={r.id} className="order-row" style={{ gridTemplateColumns: "0.9fr 0.9fr 1fr 0.7fr 0.9fr 1.2fr 1.4fr 0.7fr" }}>
                <div className="order-cell">
                  <div className="order-no">#{String(r.id).slice(0, 8)}</div>
                  <div className="order-mini">{createdAt}</div>
                </div>
                <div className="order-cell">
                  <div className="order-customer">#{r.order?.orderNo ?? "-"}</div>
                  <div className="order-mini">{r.orderItem?.title ?? "Tum siparis"}</div>
                </div>
                <div className="order-cell">
                  <div className="order-customer">{r.user?.email ?? r.order?.customerEmail ?? "-"}</div>
                </div>
                <div className="order-cell">{TYPE_LABELS[r.type] ?? r.type}</div>
                <div className="order-cell">
                  <select
                    className="order-select"
                    value={draft.status}
                    onChange={(e) =>
                      setDrafts((p) => ({
                        ...p,
                        [r.id]: { ...draft, status: e.target.value as ReturnRequestStatus },
                      }))
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="order-cell">
                  <div className="order-mini" style={{ color: "var(--text)" }}>
                    {r.reason ?? "-"}
                  </div>
                  {r.note ? <div className="order-mini">{r.note}</div> : null}
                </div>
                <div className="order-cell">
                  <input
                    className="order-input"
                    value={draft.adminNote}
                    onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...draft, adminNote: e.target.value } }))}
                    placeholder="Admin notu"
                  />
                </div>
                <div className="order-cell">
                  <button
                    className="order-save"
                    disabled={busyId === r.id}
                    onClick={async () => {
                      setBusyId(r.id);
                      try {
                        const updated = await adminApi.updateReturnRequest(r.id, {
                          status: draft.status,
                          adminNote: draft.adminNote,
                        });
                        setRows((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            );
          })}

          {rows.length === 0 ? <div className="order-empty">Henuz talep yok.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
