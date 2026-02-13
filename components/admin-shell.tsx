"use client";

import { ADMIN_NAV } from "@/components/admin/nav";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f8fbff_0%,#f1f5f9_45%,#eef2f7_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#2b6cff] text-sm font-bold text-white shadow-sm shadow-blue-500/30">A</div>
            <div className="text-sm font-semibold text-slate-800">Admin Panel</div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-700"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Menuyu ac/kapat"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {mobileOpen ? <div className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      <aside
        className={cx(
          "fixed left-0 top-0 z-40 flex h-screen w-[272px] flex-col border-r border-slate-200/80 bg-white/95 px-4 py-5 shadow-xl shadow-slate-200/60 backdrop-blur transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#2b6cff] text-sm font-bold text-white shadow-sm shadow-blue-500/30">A</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Admin Panel</div>
            <div className="text-[11px] text-slate-500">Operasyon ve raporlama</div>
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs font-medium text-blue-700">
          Sistem durumu: Aktif
        </div>

        <nav className="mt-1 flex-1 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cx(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                  active
                    ? "border-blue-200 bg-gradient-to-r from-[#eef4ff] to-[#f7fbff] text-[#2b6cff] shadow-sm"
                    : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          hepsionline admin
        </div>
      </aside>

      <main className="min-h-screen px-4 py-4 lg:ml-[272px] lg:px-6 lg:py-6">
        <div className="mb-4 hidden items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur lg:flex">
          <div>
            <div className="text-sm font-semibold text-slate-900">Yonetim merkezi</div>
            <div className="text-xs text-slate-500">{pathname}</div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Canli
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
