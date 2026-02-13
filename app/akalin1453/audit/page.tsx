"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { adminApi, type AuditRow } from "@/lib/api";

function actionLabel(action: string) {
  if (action === "loyalty:manual_adjust") return "Sadakat puan duzeltmesi";
  if (action === "event:purchase_order") return "Siparis satin alma olayi";
  if (action === "paytr:callback_received") return "PAYTR callback alindi";
  if (action === "paytr:callback_bad_hash") return "PAYTR hash hatasi";
  return action;
}

function entityLabel(entity?: string) {
  if (entity === "user") return "Kullanici";
  if (entity === "order") return "Siparis";
  if (entity === "product") return "Urun";
  if (entity === "paytr") return "Odeme";
  return entity ?? "-";
}

function loyaltyDetail(afterJson: unknown) {
  if (!afterJson || typeof afterJson !== "object") return null;
  const payload = afterJson as {
    userEmail?: string;
    requestedDelta?: number;
    appliedDelta?: number;
    note?: string;
    pointsBalance?: number;
  };

  if (
    typeof payload.appliedDelta !== "number" &&
    typeof payload.requestedDelta !== "number"
  ) {
    return null;
  }

  const deltaText =
    typeof payload.appliedDelta === "number"
      ? `${payload.appliedDelta >= 0 ? "+" : ""}${payload.appliedDelta}`
      : "-";
  return `Delta ${deltaText} | Bakiye ${payload.pointsBalance ?? "-"} | ${payload.note ?? "Aciklama yok"}`;
}

function detailText(row: AuditRow) {
  if (row.action === "loyalty:manual_adjust") {
    return loyaltyDetail(row.afterJson) ?? "Manuel puan duzeltmesi";
  }

  if (row.afterJson) return "Kayit guncellendi";
  if (row.beforeJson) return "Kayit silindi";
  return "Kayit olusturuldu";
}

type AuditFilter = "all" | "loyalty" | "payment" | "order";

function parseAuditFilter(value: string | null): AuditFilter {
  if (value === "loyalty" || value === "payment" || value === "order") {
    return value;
  }
  return "all";
}

function matchesFilter(row: AuditRow, filter: AuditFilter) {
  if (filter === "all") return true;
  if (filter === "loyalty") return row.action.startsWith("loyalty:");
  if (filter === "payment") return row.action.startsWith("paytr:");
  if (filter === "order") {
    return (
      row.entity === "order" ||
      row.action.startsWith("event:purchase_order") ||
      row.action.startsWith("event:purchase_item")
    );
  }
  return true;
}

export default function AuditPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<AuditFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextRows = await adminApi.audit();
      setRows(Array.isArray(nextRows) ? nextRows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit kayitlari yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setFilterState(parseAuditFilter(params.get("type")));
  }, []);

  const setFilter = useCallback(
    (next: AuditFilter) => {
      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      );
      if (next === "all") {
        params.delete("type");
      } else {
        params.set("type", next);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
      setFilterState(next);
    },
    [pathname, router],
  );

  const filteredRows = rows.filter((row) => matchesFilter(row, filter));

  return (
    <div>
      <h1>Audit Log</h1>
      <div className="audit-head card" style={{ marginBottom: 14 }}>
        <div>
          <div className="audit-title">Kim neyi degistirdi?</div>
          <div className="audit-sub">Son 200 islem kaydi burada listelenir.</div>
        </div>
        <div className="badge">{filteredRows.length} kayit</div>
      </div>

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: filter === "all" ? "#1BA7A6" : "#cbd5e1",
            background: filter === "all" ? "#e6fffb" : "#fff",
            color: filter === "all" ? "#0f766e" : "#334155",
          }}
        >
          Tum
        </button>
        <button
          type="button"
          onClick={() => setFilter("loyalty")}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: filter === "loyalty" ? "#1BA7A6" : "#cbd5e1",
            background: filter === "loyalty" ? "#e6fffb" : "#fff",
            color: filter === "loyalty" ? "#0f766e" : "#334155",
          }}
        >
          Sadakat
        </button>
        <button
          type="button"
          onClick={() => setFilter("payment")}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: filter === "payment" ? "#1BA7A6" : "#cbd5e1",
            background: filter === "payment" ? "#e6fffb" : "#fff",
            color: filter === "payment" ? "#0f766e" : "#334155",
          }}
        >
          Odeme
        </button>
        <button
          type="button"
          onClick={() => setFilter("order")}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: filter === "order" ? "#1BA7A6" : "#cbd5e1",
            background: filter === "order" ? "#e6fffb" : "#fff",
            color: filter === "order" ? "#0f766e" : "#334155",
          }}
        >
          Siparis
        </button>
      </div>

      {loading ? <div className="card">Yukleniyor...</div> : null}
      {error ? <div className="card" style={{ color: "#b91c1c" }}>Hata: {error}</div> : null}

      {!loading && !error ? (
        <div className="audit-table">
          <div className="audit-row audit-head-row">
            <div>Islem</div>
            <div>Varlik</div>
            <div>Detay</div>
            <div>IP</div>
            <div>Tarih</div>
          </div>
          {filteredRows.map((r) => {
            const createdAt = r.createdAt ? new Date(r.createdAt) : null;
            return (
              <div key={r.id} className="audit-row">
                <div className="audit-cell">
                  <div className="audit-action">{actionLabel(r.action)}</div>
                  <div className="audit-mini">{r.actorId ?? "Sistem"}</div>
                </div>
                <div className="audit-cell">
                  <div className="audit-entity">{entityLabel(r.entity)}</div>
                  <div className="audit-mini">{r.entityId ?? "-"}</div>
                </div>
                <div className="audit-cell audit-detail">{detailText(r)}</div>
                <div className="audit-cell audit-mini">{r.ip ?? "-"}</div>
                <div className="audit-cell audit-mini">{createdAt ? createdAt.toLocaleString("tr-TR") : "-"}</div>
              </div>
            );
          })}
          {filteredRows.length === 0 ? <div className="audit-empty">Secili filtre icin kayit yok.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
