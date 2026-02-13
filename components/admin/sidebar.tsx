"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/components/admin/nav";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] px-4 py-5">
      <div className="flex h-full flex-col rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 ring-1 ring-black/5">
            <span className="text-sm font-semibold text-slate-700">N</span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">Ana Yönetim</div>
            <div className="truncate text-xs text-slate-500">Admin Panel</div>
          </div>
        </div>

        <div className="mt-5 px-2">
          <div className="px-3 pb-2 text-xs font-medium text-slate-500">Menü</div>
          <nav className="flex flex-col gap-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition",
                    "hover:bg-slate-50",
                    isActive && "bg-[#EEF4FF] ring-1 ring-[#D7E6FF]"
                  )}
                >
                  <span
                    className={cx(
                      "grid h-10 w-10 place-items-center rounded-2xl transition",
                      "bg-slate-50 ring-1 ring-black/5 group-hover:bg-white",
                      isActive && "bg-white ring-[#CFE1FF]"
                    )}
                  >
                    <Icon
                      className={cx(
                        "h-5 w-5 transition",
                        isActive ? "text-[#2B6CFF]" : "text-slate-500 group-hover:text-slate-700"
                      )}
                    />
                  </span>

                  <span
                    className={cx(
                      "text-sm font-medium transition",
                      isActive ? "text-slate-900" : "text-slate-700"
                    )}
                  >
                    {item.label}
                  </span>

                  <span
                    className={cx(
                      "ml-auto h-2 w-2 rounded-full transition",
                      isActive ? "bg-[#2B6CFF]" : "bg-transparent group-hover:bg-slate-200"
                    )}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

