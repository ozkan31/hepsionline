import Link from "next/link";
import { notFound } from "next/navigation";
import { X, Home, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromSession } from "@/lib/user-auth";

const RED = "#EF4444";
const TEAL = "#1BA7A6";

type SearchParams = Promise<{
  orderId?: string;
}>;

function parseOrderId(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function maskEmail(email?: string | null) {
  if (!email || !email.includes("@")) {
    return "gizli@mail.com";
  }
  const [name, domain] = email.split("@");
  const visible = name.slice(0, 2) || "te";
  return `${visible}***@${domain}`;
}

export default async function OdemeBasarisizPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const orderId = parseOrderId(params.orderId);
  const currentUser = await getCurrentUserFromSession();
  if (!orderId || !currentUser) {
    notFound();
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      customerEmail: true,
      customerPhone: true,
    },
  });

  if (!order) {
    notFound();
  }

  const belongsToUser = order.customerEmail === currentUser.email || order.customerPhone === currentUser.phone;
  if (!belongsToUser) {
    notFound();
  }

  const orderNo = `#${order.orderNo ?? order.id}`;
  const maskedEmail = maskEmail(order.customerEmail);

  return (
    <div className="min-h-screen bg-[#F3F6F8] flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl w-full text-center">
          <div className="relative flex justify-center">
            <div
              className="h-28 w-28 rounded-full flex items-center justify-center text-white shadow-lg"
              style={{
                background: `linear-gradient(180deg, #F87171 0%, ${RED} 100%)`,
              }}
            >
              <X className="h-14 w-14" strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-8 text-5xl font-semibold text-slate-800">Odeme Basarisiz!</h1>

          <p className="mt-4 text-lg text-slate-600">Maalesef, odeme isleminiz basarisiz oldu.</p>

          <p className="mt-6 text-[15px] leading-7 text-slate-600">
            Siparis numaraniz <span className="font-semibold text-slate-800">{orderNo}</span>, onay e-postasi{" "}
            <span className="bg-slate-200 px-2 py-1 rounded-md text-slate-700">{maskedEmail}</span> adresinize
            gonderildi.
            <br />
            Guncel durumunuzu tekrar deneyerek guncelleyebilirsiniz.
          </p>

          <div className="mt-10 flex flex-col gap-4 md:flex-row md:justify-center">
            <Link
              href="/"
              className="h-12 px-10 rounded-xl text-lg font-semibold text-white flex items-center justify-center gap-2 shadow-sm hover:brightness-95 active:brightness-90"
              style={{ background: TEAL }}
            >
              <Home className="h-5 w-5" />
              Anasayfaya Don
            </Link>

            <Link
              href={`/odeme/${order.id}`}
              className="h-12 px-10 rounded-xl text-lg font-semibold border border-slate-300 bg-white text-slate-700 flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50"
            >
              <RotateCcw className="h-5 w-5" />
              Tekrar Dene
            </Link>
          </div>
        </div>
      </main>

      <div className="py-6 text-center text-sm text-slate-400">© 2024 hepsionline. Tum haklari saklidir.</div>
    </div>
  );
}
