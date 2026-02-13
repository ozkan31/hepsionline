import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Search,
  TicketPercent,
  Trophy,
  Star,
  Truck,
  Undo2,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", href: "/akalin1453", icon: LayoutDashboard, exact: true },
  { label: "Raporlar", href: "/akalin1453/reports", icon: BarChart3, exact: true },
  { label: "Siparişler", href: "/akalin1453/siparisler", icon: ShoppingBag, exact: true },
  { label: "Kuponlar", href: "/akalin1453/kuponlar", icon: TicketPercent, exact: true },
  { label: "SEO", href: "/akalin1453/seo", icon: Search, exact: true },
  { label: "Sadakat", href: "/akalin1453/loyalty", icon: Trophy, exact: true },
  { label: "Bundleler", href: "/akalin1453/bundles", icon: Boxes, exact: true },
  { label: "Yorumlar", href: "/akalin1453/reviews", icon: Star, exact: true },
  { label: "Sorular", href: "/akalin1453/questions", icon: MessageSquare, exact: true },
  { label: "İadeler", href: "/akalin1453/returns", icon: Undo2, exact: true },
  { label: "Operasyon", href: "/akalin1453/operations", icon: Truck, exact: true },
  { label: "Ayarlar", href: "/akalin1453/settings", icon: Settings, exact: true },
  { label: "Audit", href: "/akalin1453/audit", icon: ClipboardList, exact: true },
  { label: "Güvenlik", href: "/akalin1453/giris", icon: ShieldCheck, exact: true },
  { label: "Sistem", href: "/__status", icon: Settings2, exact: true },
  { label: "Çıkış", href: "/logout", icon: LogOut, exact: true },
];
