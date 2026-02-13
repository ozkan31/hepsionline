import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Home, PackageCheck, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromSession } from "@/lib/user-auth";

const TEAL = "#1BA7A6";

type SearchParams = Promise<{
  orderId?: string;
}>;

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

function parseOrderId(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function maskEmail(email?: string | null) {
  if (!email || !email.includes("@")) {
    return "Gizli";
  }
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return "Gizli";
  }
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}

function Confetti() {
  const dots = [
    { x: 14, y: 10, r: 4, c: "#F59E0B" },
    { x: 28, y: 4, r: 3, c: "#22C55E" },
    { x: 44, y: 12, r: 3, c: "#60A5FA" },
    { x: 58, y: 2, r: 4, c: "#FB7185" },
    { x: 74, y: 10, r: 3, c: "#A78BFA" },
    { x: 10, y: 28, r: 3, c: "#34D399" },
    { x: 80, y: 30, r: 3, c: "#FBBF24" },
    { x: 26, y: 38, r: 3, c: "#93C5FD" },
    { x: 62, y: 42, r: 3, c: "#F87171" },
  ];

  return (
    <svg
      className="absolute -top-8 left-1/2 -translate-x-1/2"
      width="160"
      height="90"
      viewBox="0 0 90 50"
      fill="none"
      aria-hidden
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity="0.9" />
      ))}
      <path d="M6 20 l8 -6" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
      <path d="M82 18 l-10 -7" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 14 l6 6" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 14 l-6 6" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MiniProgress() {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E7F6F6]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAL }} />
          </span>
          Hazirlaniyor
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 w-[60%] rounded-full" style={{ background: TEAL }} />
          </div>
        </div>
        <span className="text-slate-500">Siparis Alindi, Hazirlaniyor</span>
      </div>
    </div>
  );
}

export default async function OdemeBasariliPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const orderId = parseOrderId(params.orderId);
  const currentUser = await getCurrentUserFromSession();

  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNo: true,
          customerEmail: true,
          customerPhone: true,
          totalAmount: true,
          paymentStatus: true,
          items: {
            orderBy: { id: "asc" },
            take: 1,
            select: {
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              product: {
                select: {
                  imageUrl: true,
                  name: true,
                  imageAlt: true,
                },
              },
            },
          },
        },
      })
    : null;

  if (!order || order.paymentStatus !== "PAID") {
    notFound();
  }

  if (!currentUser) {
    notFound();
  }

  const belongsToUser = order.customerEmail === currentUser.email || order.customerPhone === currentUser.phone;
  if (!belongsToUser) {
    notFound();
  }

  const firstItem = order.items[0];
  const imageUrl =
    firstItem?.product?.imageUrl ??
    "https://images.unsplash.com/photo-1528701800489-20be3c2ea2d6?auto=format&fit=crop&w=900&q=70";
  const orderNo = `#${order.orderNo ?? order.id}`;
  const maskedEmail = maskEmail(order.customerEmail);
  const qty = firstItem?.quantity ?? 1;
  const productTotal = firstItem?.totalPrice ?? order.totalAmount;
  const unitPrice = firstItem?.unitPrice ?? order.totalAmount;
  const productName = firstItem?.productName ?? "Urun";
  const secondaryLine = firstItem?.product?.name ?? "Urun";
  const tertiaryLine = firstItem?.product?.imageAlt ?? "Model";

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="relative">
            <Confetti />
            <div
              className="grid h-28 w-28 place-items-center rounded-full text-white shadow-sm"
              style={{
                background: "linear-gradient(180deg, #25B7B6 0%, #1BA7A6 100%)",
              }}
            >
              <Check className="h-12 w-12" strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-800">Basarili Siparis!</h1>
          <p className="mt-3 text-lg text-slate-600">Tebrikler, siparisiniz basariyla olusturuldu.</p>

          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-slate-600">
            Siparis numaraniz <span className="font-semibold text-slate-800">{orderNo}</span>, onay e-postasi{" "}
            <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-slate-700">{maskedEmail}</span> adresinize
            gonderildi. Siparisinizin guncel durumunu{" "}
            <Link href="/hesabim/siparislerim" className="font-semibold text-slate-800 underline">
              buradan takip edebilirsiniz.
            </Link>
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_0.9fr]">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-2xl font-semibold text-slate-800">Siparis Ozeti</div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex gap-5">
                <div
                  className="h-24 w-28 rounded-xl bg-slate-100"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />

                <div className="flex-1">
                  <div className="text-lg font-semibold text-slate-800">{productName}</div>
                  <div className="mt-1 text-sm text-slate-500">{secondaryLine}</div>
                  <div className="mt-2 text-sm text-slate-600">{tertiaryLine}</div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-slate-500">Adet: {qty}</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">{formatTRY(productTotal)}</div>
                  <div className="mt-2 text-sm font-semibold" style={{ color: TEAL }}>
                    Hazirlaniyor
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" style={{ color: TEAL }} />
                    Hazirlaniyor
                  </div>
                  <div className="text-slate-500">Siparis Alindi, Hazirlaniyor</div>
                </div>
                <MiniProgress />
              </div>

              <div className="mt-5 flex items-center justify-end gap-10">
                <div className="text-base text-slate-600">Urunler:</div>
                <div className="text-2xl font-semibold text-slate-900">{formatTRY(unitPrice * qty)}</div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 md:flex-row md:justify-center">
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-10 text-lg font-semibold text-white shadow-sm hover:brightness-95 active:brightness-90"
                style={{ background: TEAL }}
              >
                <Home className="h-5 w-5" />
                Anasayfaya Don
              </Link>

              <Link
                href="/hesabim/siparislerim"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-10 text-lg font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <PackageCheck className="h-5 w-5" style={{ color: TEAL }} />
                Siparislerimi Goruntule
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-2xl font-semibold text-slate-800">Siparis Ozeti</div>

            <div className="mt-5 space-y-3 text-[15px] text-slate-700">
              <div className="flex items-center justify-between">
                <span>Urunler:</span>
                <span className="font-semibold">{formatTRY(order.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Kargo:</span>
                <span className="font-semibold">Ucretsiz</span>
              </div>

              <div className="mt-4 h-px bg-slate-200" />

              <div className="flex items-center justify-between text-lg">
                <span className="font-semibold text-slate-700">Toplam:</span>
                <span className="text-2xl font-semibold" style={{ color: TEAL }}>
                  {formatTRY(order.totalAmount)}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-center gap-4 text-slate-500">
                  <span className="rounded-lg bg-slate-50 px-4 py-2 font-semibold">VISA</span>
                  <span className="rounded-lg bg-slate-50 px-4 py-2 font-semibold">master</span>
                  <span className="rounded-lg bg-slate-50 px-4 py-2 font-semibold">troy</span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F0FAFA] p-4">
                <div className="flex gap-3">
                  <div
                    className="grid h-10 w-10 place-items-center rounded-xl bg-white ring-1 ring-black/5"
                    style={{ color: TEAL }}
                  >
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="text-sm leading-6 text-slate-700">
                    <span className="font-semibold">3D Secure</span> ile %100 Guvenli Odeme
                    <br />
                    ve alisveris yapabilirsiniz.
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-3 opacity-70">
                <span className="rounded-lg bg-slate-50 px-4 py-2 font-semibold">VISA</span>
                <span className="rounded-lg bg-slate-50 px-4 py-2 font-semibold">master</span>
                <span className="rounded-lg bg-slate-50 px-4 py-2 font-semibold">troy</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-sm text-slate-400">© 2024 hepsionline. Tum haklari saklidir.</div>
      </main>
    </div>
  );
}
