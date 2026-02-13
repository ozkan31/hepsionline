"use client";

import React from "react";
import { ChevronDown, ChevronRight, Home, Plus, Search } from "lucide-react";

type ProductStatus = "Aktif" | "Taslak" | "Stokta Yok" | "Öne Çıkan";

type ProductRow = {
  id: number;
  name: string;
  section: string;
  price: number;
  stock: number;
  status: ProductStatus;
  dateLabel: string;
  imageUrl: string | null;
};

type ProductsApiResponse = {
  products: ProductRow[];
  summary: {
    total: number;
    draft: number;
    outOfStock: number;
    featured: number;
  };
};

function formatTry(price: number) {
  return price.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

function statusBadgeClass(status: ProductStatus) {
  if (status === "Aktif") return "bg-emerald-100 text-emerald-700";
  if (status === "Taslak") return "bg-amber-100 text-amber-700";
  if (status === "Öne Çıkan") return "bg-yellow-100 text-yellow-700";
  return "bg-slate-200 text-slate-600";
}

export function ProductsPanel() {
  const [data, setData] = React.useState<ProductsApiResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);

        const endpoint = `/api/admin/urunler?q=${encodeURIComponent(query)}`;
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const nextData = (await res.json()) as ProductsApiResponse;
        if (!cancelled) {
          setData(nextData);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Bilinmeyen hata");
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const products = data?.products ?? [];
  const summary = data?.summary ?? { total: 0, draft: 0, outOfStock: 0, featured: 0 };

  return (
    <section className="mx-auto max-w-[1120px] rounded-3xl border border-[#E7ECF5] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Home className="h-4 w-4" />
          <span>Ana Yönetim</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-slate-500">Ürünler</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E6EBF4] px-4 text-sm font-semibold text-slate-600">
            <Plus className="h-4 w-4" />
            Yeni
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-[#E6EBF4] text-slate-500">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <h1 className="text-[36px] font-semibold tracking-tight text-slate-800">Ürünler</h1>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">API hatası: {error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#F6F9FF] p-2 text-sm">
        <span className="rounded-xl bg-[#E8F0FF] px-3 py-1.5 font-semibold text-[#2B6CFF]">Tümü ({summary.total})</span>
        <span className="rounded-xl px-3 py-1.5 text-slate-500">Taslak ({summary.draft})</span>
        <span className="rounded-xl px-3 py-1.5 text-slate-500">Stokta Yok ({summary.outOfStock})</span>
        <span className="rounded-xl px-3 py-1.5 text-slate-500">Öne Çıkan ({summary.featured})</span>
        <button className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#2B6CFF] px-4 py-2 font-semibold text-white">
          <Plus className="h-4 w-4" />
          Yeni Ürün Ekle
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6EBF4] px-3 text-sm font-semibold text-slate-500">
          Filtreler
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E6EBF4] px-3 text-sm text-slate-500">
          İçe Aktar
          <ChevronDown className="h-4 w-4" />
        </button>
        <div className="ml-auto flex h-10 items-center gap-2 rounded-xl border border-[#E6EBF4] px-3 text-slate-400">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ürün ara..."
            className="w-56 bg-transparent text-sm text-slate-600 outline-none placeholder:text-slate-400"
          />
          {isLoading ? <span className="text-xs text-slate-400">Yükleniyor...</span> : null}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E9EEF6]">
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="bg-[#FBFCFF]">
            <tr className="text-left text-xs text-slate-400">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              </th>
              <th className="px-2 py-3 font-semibold">Ürün</th>
              <th className="px-2 py-3 font-semibold">Fiyat</th>
              <th className="px-2 py-3 font-semibold">Stok</th>
              <th className="px-2 py-3 font-semibold">Durum</th>
              <th className="px-2 py-3 font-semibold">Tarih</th>
              <th className="px-2 py-3 font-semibold">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => (
              <tr key={row.id} className="border-t border-[#EEF2F8] text-sm text-slate-600">
                <td className="px-3 py-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-slate-100">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt={row.name} className="h-9 w-9 object-cover" />
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500">IMG</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700">{row.name}</div>
                      <div className="text-xs text-slate-400">{row.section}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 font-semibold text-slate-700">{formatTry(row.price)}</td>
                <td className="px-2 py-3">{row.stock}</td>
                <td className="px-2 py-3">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-2 py-3 text-xs text-slate-400">{row.dateLabel}</td>
                <td className="px-2 py-3">
                  <button className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#2B6CFF] px-3 text-xs font-semibold text-white">
                    Düzenle
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-slate-400">{products.length} ürün gösteriliyor</div>
    </section>
  );
}
