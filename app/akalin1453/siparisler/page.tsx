"use client";
/* eslint-disable @next/next/no-img-element */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, type AdminOrder, type AdminOrderStatus, type AdminPaymentStatus, type ShippingCarrierCode } from "@/lib/api";

const tr = {
  title: "Sipari\u015fler",
  subtitle: "Canl\u0131 sipari\u015f listesi, \u00f6deme ve durum takibi",
  allStatuses: "T\u00fcm durumlar",
  allPaymentStatuses: "T\u00fcm \u00f6deme durumlar\u0131",
  pendingPayment: "\u00d6deme bekliyor",
  paid: "\u00d6dendi",
  failed: "Ba\u015far\u0131s\u0131z",
  confirmed: "Onayland\u0131",
  preparing: "Haz\u0131rlan\u0131yor",
  cancelled: "\u0130ptal",
  loading: "Y\u00fckleniyor...",
  retry: "Tekrar dene",
  shownOrders: "G\u00f6r\u00fcnen sipari\u015f",
  paidOrders: "\u00d6deme al\u0131nan",
  totalAmount: "Toplam tutar",
  customer: "M\u00fc\u015fteri",
  payment: "\u00d6deme",
  order: "Sipari\u015f",
  productImage: "\u00dcr\u00fcn g\u00f6rseli",
  products: "\u00dcr\u00fcnler",
  customerNote: "M\u00fc\u015fteri notu",
  couponUnused: "Kupon kullan\u0131lmad\u0131.",
  noFilteredOrder: "Filtreye uygun sipari\u015f yok.",
  show: "G\u00f6ster",
  updateStatus: "Durum g\u00fcncelle",
  statusUpdated: "Durum g\u00fcncellendi.",
  statusUpdateError: "Durum g\u00fcncellenemedi.",
  updateShipping: "Kargo bilgisi",
  carrier: "Kargo firmasi",
  trackingNo: "Kargo takip no",
  saveShipping: "Kargo bilgisini kaydet",
  openTracking: "Kargoyu takip et",
  shippingUpdated: "Kargo bilgisi guncellendi.",
  shippingUpdateError: "Kargo bilgisi guncellenemedi.",
};

const ORDER_STATUS_OPTIONS: Array<{ value: "ALL" | AdminOrderStatus; label: string }> = [
  { value: "ALL", label: tr.allStatuses },
  { value: "PENDING", label: "Beklemede" },
  { value: "CONFIRMED", label: tr.confirmed },
  { value: "PREPARING", label: tr.preparing },
  { value: "SHIPPED", label: "Kargoda" },
  { value: "ON_THE_WAY", label: "Yolda" },
  { value: "DELIVERED", label: "Teslim edildi" },
  { value: "CANCELLED", label: tr.cancelled },
];

const PAYMENT_STATUS_OPTIONS: Array<{ value: "ALL" | AdminPaymentStatus; label: string }> = [
  { value: "ALL", label: tr.allPaymentStatuses },
  { value: "PENDING", label: tr.pendingPayment },
  { value: "PAID", label: tr.paid },
  { value: "FAILED", label: tr.failed },
];

const STATUS_ACTIONS: AdminOrderStatus[] = ["CONFIRMED", "PREPARING", "SHIPPED", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
const SHIPPING_CARRIERS: Array<{ code: ShippingCarrierCode; label: string }> = [
  { code: "ARAS", label: "Aras Kargo" },
  { code: "YURTICI", label: "Yurtici Kargo" },
  { code: "MNG", label: "MNG Kargo" },
  { code: "SURAT", label: "Surat Kargo" },
  { code: "PTT", label: "PTT Kargo" },
  { code: "UPS", label: "UPS" },
];

function formatTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function statusBadgeClass(status: AdminOrderStatus) {
  if (status === "DELIVERED") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "ON_THE_WAY") return "bg-cyan-100 text-cyan-700 border-cyan-200";
  if (status === "SHIPPED") return "bg-sky-100 text-sky-700 border-sky-200";
  if (status === "PREPARING") return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (status === "CONFIRMED") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function paymentBadgeClass(status: AdminPaymentStatus) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "FAILED") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function orderStatusText(status: AdminOrderStatus) {
  if (status === "PENDING") return "Beklemede";
  if (status === "CONFIRMED") return tr.confirmed;
  if (status === "PREPARING") return tr.preparing;
  if (status === "SHIPPED") return "Kargoda";
  if (status === "ON_THE_WAY") return "Yolda";
  if (status === "DELIVERED") return "Teslim edildi";
  return tr.cancelled;
}

function paymentStatusText(status: AdminPaymentStatus) {
  if (status === "PAID") return tr.paid;
  if (status === "FAILED") return tr.failed;
  return "Bekliyor";
}

function isFinalStatus(status: AdminOrderStatus) {
  return status === "DELIVERED" || status === "CANCELLED";
}

function getTrackingUrl(carrier: ShippingCarrierCode | null | undefined, trackingNo: string | null | undefined) {
  if (!carrier || !trackingNo) return null;
  const code = encodeURIComponent(trackingNo.trim());
  if (!code) return null;

  if (carrier === "ARAS") return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${code}`;
  if (carrier === "YURTICI") return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${code}`;
  if (carrier === "MNG") return `https://www.mngkargo.com.tr/gonderi-takip/?tknumara=${code}`;
  if (carrier === "SURAT") return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${code}`;
  if (carrier === "PTT") return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${code}`;
  if (carrier === "UPS") return `https://www.ups.com/track?loc=tr_TR&tracknum=${code}`;
  return null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminOrderStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | AdminPaymentStatus>("ALL");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [shippingDrafts, setShippingDrafts] = useState<Record<number, { carrier: ShippingCarrierCode; trackingNo: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.orders();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Siparisler yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyOrderStatus = useCallback(async (orderId: number, nextStatus: AdminOrderStatus) => {
    setActionMessage(null);
    const key = `${orderId}:${nextStatus}`;
    setBusyAction(key);
    try {
      const updated = await adminApi.updateOrder(orderId, { status: nextStatus });
      setOrders((prev) => prev.map((row) => (row.id === orderId ? updated : row)));
      setActionMessage(`${tr.statusUpdated} #${updated.orderNo ?? updated.id}`);
    } catch (e) {
      setActionMessage(`${tr.statusUpdateError} #${orderId}: ${e instanceof Error ? e.message : "Bilinmeyen hata"}`);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const getShippingDraft = useCallback(
    (order: AdminOrder) => {
      const existing = shippingDrafts[order.id];
      if (existing) return existing;
      return {
        carrier: (order.shippingCarrier as ShippingCarrierCode | undefined) ?? "YURTICI",
        trackingNo: order.shippingTrackingNo ?? "",
      };
    },
    [shippingDrafts],
  );

  const updateShippingDraft = useCallback((orderId: number, patch: Partial<{ carrier: ShippingCarrierCode; trackingNo: string }>, order: AdminOrder) => {
    setShippingDrafts((prev) => {
      const current = prev[orderId] ?? {
        carrier: (order.shippingCarrier as ShippingCarrierCode | undefined) ?? "YURTICI",
        trackingNo: order.shippingTrackingNo ?? "",
      };
      return {
        ...prev,
        [orderId]: {
          carrier: patch.carrier ?? current.carrier,
          trackingNo: patch.trackingNo ?? current.trackingNo,
        },
      };
    });
  }, []);

  const applyShipping = useCallback(async (order: AdminOrder) => {
    const draft = getShippingDraft(order);
    if (!draft.trackingNo.trim()) {
      setActionMessage(`${tr.shippingUpdateError} #${order.orderNo ?? order.id}: takip no zorunlu.`);
      return;
    }
    const key = `${order.id}:shipping`;
    setBusyAction(key);
    setActionMessage(null);
    try {
      const result = await adminApi.updateOrderShipping(order.id, {
        carrier: draft.carrier,
        trackingNo: draft.trackingNo,
        notifyCarrier: false,
      });
      setOrders((prev) => prev.map((row) => (row.id === order.id ? result.order : row)));
      setActionMessage(`${tr.shippingUpdated} #${result.order.orderNo ?? result.order.id}`);
    } catch (e) {
      setActionMessage(`${tr.shippingUpdateError} #${order.orderNo ?? order.id}: ${e instanceof Error ? e.message : "Bilinmeyen hata"}`);
    } finally {
      setBusyAction(null);
    }
  }, [getShippingDraft]);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (paymentFilter !== "ALL" && o.paymentStatus !== paymentFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [String(o.id), o.orderNo ?? "", o.customerName, o.customerEmail, o.customerPhone].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [orders, statusFilter, paymentFilter, normalizedQuery]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const paid = filtered.filter((o) => o.paymentStatus === "PAID").length;
    const pending = filtered.filter((o) => o.status === "PENDING").length;
    const revenue = filtered.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    return { total, paid, pending, revenue };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-bold text-slate-900">{tr.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{tr.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">{tr.shownOrders}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">{tr.paidOrders}</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.paid}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Bekleyen durum</div>
          <div className="mt-1 text-2xl font-bold text-amber-700">{stats.pending}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">{tr.totalAmount}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{formatTRY(stats.revenue)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Siparis no, ad, email veya telefon ara"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | AdminOrderStatus)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
          >
            {ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as "ALL" | AdminPaymentStatus)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
          >
            {PAYMENT_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-lg border border-slate-300 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => void load()}>
            Yenile
          </button>
        </div>
      </div>

      {actionMessage ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{actionMessage}</div> : null}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{tr.loading}</div> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Hata: {error}
          <div className="mt-3">
            <button className="h-9 rounded-lg border border-rose-300 bg-white px-3 text-sm font-medium text-rose-700 hover:bg-rose-100" onClick={() => void load()}>
              {tr.retry}
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr.order}</th>
                  <th className="px-4 py-3">{tr.customer}</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">{tr.payment}</th>
                  <th className="px-4 py-3">Tutar</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3 text-right">Detay</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const opened = Boolean(expanded[order.id]);
                  const isClosed = isFinalStatus(order.status);

                  return (
                    <Fragment key={order.id}>
                      <tr className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                              {order.items[0]?.product?.imageUrl ? (
                                <img
                                  src={order.items[0].product.imageUrl}
                                  alt={order.items[0].product.imageAlt || order.items[0].productName || tr.productImage}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-[11px] text-slate-400">Yok</div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">#{order.orderNo ?? order.id}</div>
                              <div className="text-xs text-slate-500">{order.items.length} urun</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{order.customerName}</div>
                          <div className="text-xs text-slate-500">{order.customerEmail ?? "-"}</div>
                          <div className="text-xs text-slate-500">{order.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}>
                            {orderStatusText(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${paymentBadgeClass(order.paymentStatus)}`}>
                            {paymentStatusText(order.paymentStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{formatTRY(order.totalAmount)}</td>
                        <td className="px-4 py-3 text-slate-600">{order.createdAt ? new Date(order.createdAt).toLocaleString("tr-TR") : "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [order.id]: !prev[order.id],
                              }))
                            }
                          >
                            {opened ? "Gizle" : tr.show}
                          </button>
                        </td>
                      </tr>

                      {opened ? (
                        <tr className="border-t border-slate-100 bg-slate-50/50">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr.products}</div>
                                <ul className="space-y-2">
                                  {order.items.map((item, idx) => (
                                    <li key={`${order.id}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                                      <div>
                                        <div className="font-medium text-slate-900">{item.productName}</div>
                                        <div className="text-xs text-slate-500">
                                          {item.quantity} x {formatTRY(item.unitPrice)}
                                        </div>
                                      </div>
                                      <div className="font-semibold text-slate-900">{formatTRY(item.totalPrice)}</div>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-white p-3">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Kupon ve adres</div>
                                <div className="text-sm text-slate-700">
                                  <div className="mb-2">
                                    <span className="font-medium text-slate-900">Adres:</span> {order.customerAddress}
                                  </div>
                                  {order.customerNote ? (
                                    <div className="mb-2">
                                      <span className="font-medium text-slate-900">{tr.customerNote}:</span> {order.customerNote}
                                    </div>
                                  ) : null}

                                  {order.couponUsages.length ? (
                                    <ul className="space-y-1">
                                      {order.couponUsages.map((usage, idx) => (
                                        <li key={`${order.id}-coupon-${idx}`} className="text-sm text-slate-700">
                                          Kupon <b>{usage.coupon?.code ?? "-"}</b> ile <b>{formatTRY(usage.discountAmount)}</b> indirim
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm text-slate-500">{tr.couponUnused}</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr.updateStatus}</div>
                              <div className="flex flex-wrap gap-2">
                                {STATUS_ACTIONS.map((nextStatus) => {
                                  if (nextStatus === order.status) return null;
                                  const disabled = isClosed || busyAction === `${order.id}:${nextStatus}`;
                                  return (
                                    <button
                                      key={`${order.id}:${nextStatus}`}
                                      className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      disabled={disabled}
                                      onClick={() => void applyOrderStatus(order.id, nextStatus)}
                                    >
                                      {busyAction === `${order.id}:${nextStatus}` ? "Guncelleniyor..." : orderStatusText(nextStatus)}
                                    </button>
                                  );
                                })}
                              </div>
                              {isClosed ? (
                                <div className="mt-2 text-xs text-slate-500">Tamamlanan veya iptal edilen siparislerde durum degisikligi kapali.</div>
                              ) : null}
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr.updateShipping}</div>
                              <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
                                <select
                                  value={getShippingDraft(order).carrier}
                                  onChange={(e) => updateShippingDraft(order.id, { carrier: e.target.value as ShippingCarrierCode }, order)}
                                  className="h-9 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-[#2b6cff]"
                                >
                                  {SHIPPING_CARRIERS.map((c) => (
                                    <option key={c.code} value={c.code}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={getShippingDraft(order).trackingNo}
                                  onChange={(e) => updateShippingDraft(order.id, { trackingNo: e.target.value }, order)}
                                  placeholder={tr.trackingNo}
                                  className="h-9 rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-[#2b6cff]"
                                />
                                <button
                                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={busyAction === `${order.id}:shipping`}
                                  onClick={() => void applyShipping(order)}
                                >
                                  {busyAction === `${order.id}:shipping` ? "Kaydediliyor..." : tr.saveShipping}
                                </button>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                Mevcut: {order.shippingCarrier ?? "-"} / {order.shippingTrackingNo ?? "-"}
                              </div>
                              {getTrackingUrl(order.shippingCarrier ?? undefined, order.shippingTrackingNo ?? undefined) ? (
                                <div className="mt-3">
                                  <a
                                    href={getTrackingUrl(order.shippingCarrier ?? undefined, order.shippingTrackingNo ?? undefined) ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                  >
                                    {tr.openTracking}
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length ? <div className="border-t border-slate-200 p-4 text-sm text-slate-500">{tr.noFilteredOrder}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
