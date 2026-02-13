"use client";

import Link from "next/link";
import { logoutUserAction } from "@/lib/user-auth-actions";
import { Award, ChevronRight, Heart, LogOut, MapPin, MessageSquareText, Package, Star, TicketPercent, User } from "lucide-react";
import type { ReactNode } from "react";

function PillBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-[#1BA7A6] px-2 py-0.5 text-xs font-semibold text-white">
      {text}
    </span>
  );
}

function SidebarItem({
  href,
  icon,
  label,
  active = false,
  badge,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition",
        active
          ? "bg-white shadow-sm ring-1 ring-black/5"
          : "hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-black/5",
      ].join(" ")}
    >
      <span className="text-[#1BA7A6]">{icon}</span>
      <span className="flex-1 text-slate-700">{label}</span>
      {badge ? <span className="mr-1">{badge}</span> : null}
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
    </Link>
  );
}

export function AccountSidebar({
  fullName,
  active,
  orderCount = 0,
  favoriteCount = 0,
  couponCount = 0,
  className = "",
}: {
  fullName: string;
  active: "hesabim" | "adresler" | "siparislerim" | "kuponlar" | "puanlar";
  orderCount?: number;
  favoriteCount?: number;
  couponCount?: number;
  loyaltyPoints?: number;
  className?: string;
}) {
  const firstLetter = fullName.charAt(0).toUpperCase();

  return (
    <aside className={`-ml-[70px] self-start rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${className}`.trim()}>
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-200 text-xl font-bold text-slate-700">{firstLetter}</div>
        <div className="min-w-0">
          <div className="text-xl font-semibold text-slate-800">Hesabım</div>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
            <Heart className="h-4 w-4 text-slate-400" />
            {fullName}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <SidebarItem href="/hesabim" icon={<User className="h-5 w-5" />} label="Hesabım" active={active === "hesabim"} />
        <SidebarItem href="/hesabim/adresler" icon={<MapPin className="h-5 w-5" />} label="Adreslerim" active={active === "adresler"} />
        <SidebarItem
          href="/hesabim/siparislerim"
          icon={<Package className="h-5 w-5" />}
          label="Siparişlerim"
          active={active === "siparislerim"}
          badge={<PillBadge text={String(orderCount)} />}
        />
        <SidebarItem
          href="/favoriler"
          icon={<Heart className="h-5 w-5" />}
          label="Favorilerim"
          badge={<PillBadge text={String(favoriteCount)} />}
        />
        <SidebarItem href="/hesabim/yorumlar" icon={<Star className="h-5 w-5" />} label="Yorumlarım" />
        <SidebarItem
          href="/hesabim/kuponlar"
          icon={<TicketPercent className="h-5 w-5" />}
          label="Kuponlarım"
          active={active === "kuponlar"}
          badge={<PillBadge text={String(couponCount)} />}
        />
        <SidebarItem
          href="/hesabim/puanlar"
          icon={<Award className="h-5 w-5" />}
          label="Puanlarım"
          active={active === "puanlar"}
        />
        <SidebarItem href="/hesabim/mesajlar" icon={<MessageSquareText className="h-5 w-5" />} label="Mesajlarım" />
      </div>

      <div className="my-3 h-px bg-slate-200" />

      <form action={logoutUserAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1BA7A6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
        >
          <LogOut className="h-5 w-5" />
          Çıkış Yap
        </button>
      </form>
    </aside>
  );
}
