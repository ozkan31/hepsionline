"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi, type AdminProductMini, type BundleOfferAdmin } from "@/lib/api";

function formatTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

type DraftById = Record<
  number,
  {
    title: string;
    discountPercent: number;
    isActive: boolean;
    itemProductIds: number[];
  }
>;

function discountedLine(unitPrice: number, index: number, discountPercent: number) {
  if (index === 0) return unitPrice;
  const pct = Math.max(0, Math.min(40, Math.floor(discountPercent)));
  return Math.max(1, Math.floor(unitPrice * (1 - pct / 100)));
}

export default function BundlesPage() {
  const [products, setProducts] = useState<AdminProductMini[]>([]);
  const [bundles, setBundles] = useState<BundleOfferAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [primaryProductId, setPrimaryProductId] = useState<number>(0);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [title, setTitle] = useState("Birlikte Al");
  const [isActive, setIsActive] = useState(true);
  const [selectedBundleIds, setSelectedBundleIds] = useState<number[]>([]);

  const [drafts, setDrafts] = useState<DraftById>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, b] = await Promise.all([adminApi.productsMini(700), adminApi.bundles()]);
        const productRows = Array.isArray(p.products) ? p.products : [];
        const bundleRows = Array.isArray(b.bundles) ? b.bundles : [];
        setProducts(productRows);
        setBundles(bundleRows);
        setPrimaryProductId((prev) => (prev || !productRows[0] ? prev : productRows[0].id));
        const nextDrafts: DraftById = {};
        for (const row of bundleRows) {
          nextDrafts[row.id] = {
            title: row.title ?? "",
            discountPercent: row.discountPercent,
            isActive: row.isActive,
            itemProductIds: row.items.map((item) => item.productId),
          };
        }
        setDrafts(nextDrafts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bundle verisi yuklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const text = `${p.name} ${p.section?.title ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [products, query]);

  const selectableItems = useMemo(
    () => filteredProducts.filter((p) => p.id !== primaryProductId),
    [filteredProducts, primaryProductId],
  );

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const createPreview = useMemo(() => {
    const primary = productById.get(primaryProductId);
    if (!primary) return null;
    const items = [primary, ...selectedItemIds.map((id) => productById.get(id)).filter((x): x is AdminProductMini => Boolean(x))];
    if (items.length < 2) return null;
    const baseTotal = items.reduce((sum, p) => sum + p.price, 0);
    const discountedTotal = items.reduce((sum, p, idx) => sum + discountedLine(p.price, idx, discountPercent), 0);
    return {
      items,
      baseTotal,
      discountedTotal,
      savings: Math.max(0, baseTotal - discountedTotal),
    };
  }, [discountPercent, primaryProductId, productById, selectedItemIds]);

  const toggleBundleSelection = (bundleId: number, checked: boolean) => {
    setSelectedBundleIds((prev) =>
      checked ? Array.from(new Set([...prev, bundleId])) : prev.filter((id) => id !== bundleId),
    );
  };

  const bulkSetActive = async (nextActive: boolean) => {
    if (selectedBundleIds.length === 0) {
      setMessage("Toplu islem icin en az bir bundle secin.");
      return;
    }

    setBusyKey(nextActive ? "bulk:active" : "bulk:passive");
    setMessage(null);
    try {
      const updatedRows = await Promise.all(
        selectedBundleIds.map((id) =>
          adminApi.updateBundle(id, {
            isActive: nextActive,
          }),
        ),
      );
      const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
      setBundles((prev) => prev.map((row) => updatedMap.get(row.id) ?? row));
      setDrafts((prev) => {
        const next: DraftById = { ...prev };
        for (const id of selectedBundleIds) {
          const draft = next[id];
          if (draft) {
            next[id] = { ...draft, isActive: nextActive };
          }
        }
        return next;
      });
      setMessage(`${selectedBundleIds.length} bundle ${nextActive ? "aktif" : "pasif"} yapildi.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Toplu durum guncellenemedi.");
    } finally {
      setBusyKey(null);
    }
  };

  const createBundle = async () => {
    if (!primaryProductId || selectedItemIds.length < 1) {
      setMessage("Ana urun ve en az 1 bagli urun secin.");
      return;
    }

    setBusyKey("create");
    setMessage(null);
    try {
      const created = await adminApi.createBundle({
        primaryProductId,
        title,
        discountPercent: Math.max(0, Math.min(40, discountPercent)),
        isActive,
        itemProductIds: selectedItemIds,
      });
      setBundles((prev) => [created, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [created.id]: {
          title: created.title ?? "",
          discountPercent: created.discountPercent,
          isActive: created.isActive,
          itemProductIds: created.items.map((i) => i.productId),
        },
      }));
      setSelectedItemIds([]);
      setMessage(`Bundle olusturuldu (#${created.id}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Bundle olusturulamadi.");
    } finally {
      setBusyKey(null);
    }
  };

  const saveBundle = async (bundleId: number) => {
    const draft = drafts[bundleId];
    if (!draft || draft.itemProductIds.length < 1) {
      setMessage("En az 1 bagli urun secin.");
      return;
    }

    setBusyKey(`save:${bundleId}`);
    setMessage(null);
    try {
      const updated = await adminApi.updateBundle(bundleId, {
        title: draft.title || null,
        discountPercent: Math.max(0, Math.min(40, draft.discountPercent)),
        isActive: draft.isActive,
        itemProductIds: draft.itemProductIds,
      });
      setBundles((prev) => prev.map((row) => (row.id === bundleId ? updated : row)));
      setMessage(`Bundle guncellendi (#${bundleId}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Bundle guncellenemedi.");
    } finally {
      setBusyKey(null);
    }
  };

  const deleteBundle = async (bundleId: number) => {
    setBusyKey(`delete:${bundleId}`);
    setMessage(null);
    try {
      await adminApi.deleteBundle(bundleId);
      setBundles((prev) => prev.filter((row) => row.id !== bundleId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[bundleId];
        return next;
      });
      setMessage(`Bundle silindi (#${bundleId}).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Bundle silinemedi.");
    } finally {
      setBusyKey(null);
    }
  };

  const updateDraft = (id: number, patch: Partial<DraftById[number]>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        title: prev[id]?.title ?? "",
        discountPercent: prev[id]?.discountPercent ?? 10,
        isActive: prev[id]?.isActive ?? true,
        itemProductIds: prev[id]?.itemProductIds ?? [],
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 p-5 text-white shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Kampanya</div>
        <h1 className="mt-1 text-2xl font-bold">Bundle Yönetimi</h1>
        <p className="mt-1 text-sm text-slate-300">Birlikte al paketleri olusturun, indirim oranini ayarlayin ve aktif/pasif yonetin.</p>
      </section>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Yukleniyor...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Hata: {error}</div> : null}
      {message ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</div> : null}

      {!loading && !error ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-base font-semibold text-slate-900">Yeni Bundle Olustur</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-600">Baslik</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600">Ana urun</div>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                  value={primaryProductId}
                  onChange={(e) => setPrimaryProductId(Number(e.target.value))}
                >
                  <option value={0}>Urun secin</option>
                  {products.map((p) => (
                    <option key={`primary-${p.id}`} value={p.id}>
                      {p.name} ({formatTRY(p.price)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600">Indirim (%)</div>
                <input
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                  type="number"
                  min={0}
                  max={40}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value || "0"))}
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600">Durum</div>
                <select
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                  value={isActive ? "1" : "0"}
                  onChange={(e) => setIsActive(e.target.value === "1")}
                >
                  <option value="1">Aktif</option>
                  <option value="0">Pasif</option>
                </select>
              </label>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-sm text-slate-600">Bagli urun ara</div>
              <input
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                placeholder="Urun ismi veya kategori"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid gap-1">
                {selectableItems.map((p) => {
                  const checked = selectedItemIds.includes(p.id);
                  return (
                    <label key={`item-${p.id}`} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                      <span className="line-clamp-1 text-slate-700">{p.name}</span>
                      <span className="ml-3 flex items-center gap-2">
                        <span className="text-xs text-slate-500">{formatTRY(p.price)}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedItemIds, p.id]
                              : selectedItemIds.filter((id) => id !== p.id);
                            setSelectedItemIds(Array.from(new Set(next)).slice(0, 6));
                          }}
                        />
                      </span>
                    </label>
                  );
                })}
                {selectableItems.length === 0 ? <div className="px-2 py-2 text-xs text-slate-500">Urun bulunamadi.</div> : null}
              </div>
            </div>

            <button
              className="mt-3 h-10 rounded-lg border border-[#2b6cff] bg-[#2b6cff] px-4 text-sm font-semibold text-white hover:bg-[#2459d3] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void createBundle()}
              disabled={busyKey === "create"}
            >
              {busyKey === "create" ? "Olusturuluyor..." : "Bundle Olustur"}
            </button>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-800">Canli Onizleme</div>
              {createPreview ? (
                <>
                  <div className="space-y-1">
                    {createPreview.items.map((item, idx) => (
                      <div key={`preview-${item.id}`} className="flex items-center justify-between text-xs text-slate-700">
                        <span className="line-clamp-1">{item.name}</span>
                        <span>{formatTRY(discountedLine(item.price, idx, discountPercent))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Normal toplam</span>
                      <span>{formatTRY(createPreview.baseTotal)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
                      <span>Paket toplam</span>
                      <span>{formatTRY(createPreview.discountedTotal)}</span>
                    </div>
                    <div className="mt-1 text-emerald-700">Kazanc: {formatTRY(createPreview.savings)}</div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500">Ana urun + en az 1 bagli urun secin.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={bundles.length > 0 && selectedBundleIds.length === bundles.length}
                  onChange={(e) => setSelectedBundleIds(e.target.checked ? bundles.map((b) => b.id) : [])}
                />
                Tumunu sec
              </label>
              <button
                className="h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void bulkSetActive(true)}
                disabled={busyKey === "bulk:active" || busyKey === "bulk:passive"}
              >
                {busyKey === "bulk:active" ? "Uygulaniyor..." : "Secilenleri Aktif Yap"}
              </button>
              <button
                className="h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void bulkSetActive(false)}
                disabled={busyKey === "bulk:active" || busyKey === "bulk:passive"}
              >
                {busyKey === "bulk:passive" ? "Uygulaniyor..." : "Secilenleri Pasif Yap"}
              </button>
              <div className="ml-auto text-xs text-slate-500">Secili: {selectedBundleIds.length}</div>
            </div>

            {bundles.map((bundle) => {
              const draft = drafts[bundle.id] ?? {
                title: bundle.title ?? "",
                discountPercent: bundle.discountPercent,
                isActive: bundle.isActive,
                itemProductIds: bundle.items.map((item) => item.productId),
              };
              const pool = products.filter((p) => p.id !== bundle.primaryProductId);
              const primary = productById.get(bundle.primaryProductId);
              const draftProducts = [
                ...(primary ? [primary] : []),
                ...draft.itemProductIds.map((id) => productById.get(id)).filter((x): x is AdminProductMini => Boolean(x)),
              ];
              const baseTotal = draftProducts.reduce((sum, p) => sum + p.price, 0);
              const discountedTotal = draftProducts.reduce((sum, p, idx) => sum + discountedLine(p.price, idx, draft.discountPercent), 0);
              const savings = Math.max(0, baseTotal - discountedTotal);
              return (
                <div key={`bundle-row-${bundle.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedBundleIds.includes(bundle.id)}
                        onChange={(e) => toggleBundleSelection(bundle.id, e.target.checked)}
                      />
                      <div>
                      <div className="text-sm font-semibold text-slate-900">
                        #{bundle.id} | {bundle.primaryProduct.name}
                      </div>
                      <div className="text-xs text-slate-500">Ana urun fiyat: {formatTRY(bundle.primaryProduct.price)}</div>
                      </div>
                    </div>
                    <button
                      className="h-9 rounded-lg border border-rose-300 bg-white px-3 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void deleteBundle(bundle.id)}
                      disabled={busyKey === `delete:${bundle.id}`}
                    >
                      {busyKey === `delete:${bundle.id}` ? "Siliniyor..." : "Sil"}
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Baslik</div>
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                        value={draft.title}
                        onChange={(e) => updateDraft(bundle.id, { title: e.target.value })}
                      />
                    </label>
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Indirim (%)</div>
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                        type="number"
                        min={0}
                        max={40}
                        value={draft.discountPercent}
                        onChange={(e) => updateDraft(bundle.id, { discountPercent: Number(e.target.value || "0") })}
                      />
                    </label>
                    <label className="text-sm">
                      <div className="mb-1 text-slate-600">Durum</div>
                      <select
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2b6cff]"
                        value={draft.isActive ? "1" : "0"}
                        onChange={(e) => updateDraft(bundle.id, { isActive: e.target.value === "1" })}
                      >
                        <option value="1">Aktif</option>
                        <option value="0">Pasif</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {pool.map((p) => {
                      const checked = draft.itemProductIds.includes(p.id);
                      return (
                        <label key={`bundle-${bundle.id}-item-${p.id}`} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                          <span className="line-clamp-1 text-slate-700">{p.name}</span>
                          <span className="ml-3 flex items-center gap-2">
                            <span className="text-xs text-slate-500">{formatTRY(p.price)}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...draft.itemProductIds, p.id]
                                  : draft.itemProductIds.filter((id) => id !== p.id);
                                updateDraft(bundle.id, { itemProductIds: Array.from(new Set(next)).slice(0, 6) });
                              }}
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Paket Onizleme</div>
                    <div className="space-y-1">
                      {draftProducts.map((p, idx) => (
                        <div key={`draft-preview-${bundle.id}-${p.id}`} className="flex items-center justify-between text-xs text-slate-700">
                          <span className="line-clamp-1">{p.name}</span>
                          <span>{formatTRY(discountedLine(p.price, idx, draft.discountPercent))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t border-slate-200 pt-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Normal toplam</span>
                        <span>{formatTRY(baseTotal)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between font-semibold text-slate-900">
                        <span>Paket toplam</span>
                        <span>{formatTRY(discountedTotal)}</span>
                      </div>
                      <div className="mt-1 text-emerald-700">Kazanc: {formatTRY(savings)}</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void saveBundle(bundle.id)}
                      disabled={busyKey === `save:${bundle.id}`}
                    >
                      {busyKey === `save:${bundle.id}` ? "Kaydediliyor..." : "Degisiklikleri Kaydet"}
                    </button>
                  </div>
                </div>
              );
            })}
            {bundles.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Bundle kaydi yok.</div> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
