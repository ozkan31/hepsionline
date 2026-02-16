import { AccountSidebar } from "@/components/account-sidebar";
import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getAvailableCouponCountForUser } from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { redirect } from "next/navigation";

function formatDateTR(date: Date) {
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function MesajlarimPage() {
  const user = await getCurrentUserFromSession();
  if (!user) redirect("/giris?status=required&next=%2Fhesabim%2Fmesajlar");

  const [siteHeader, cartItemCount, favoriteItemCount, couponCount, orderCount, questions] =
    await Promise.all([
      getSiteHeaderData(),
      getCartItemCountFromCookie(),
      getFavoriteItemCountFromCookie(),
      getAvailableCouponCountForUser(user.email),
      prisma.order.count({
        where: {
          OR: [{ customerEmail: user.email }, { customerPhone: user.phone }],
        },
      }),
      prisma.adminQuestion.findMany({
        where: {
          userEmail: {
            in: [user.email, user.email.toLowerCase()],
          },
        },
        include: {
          answers: {
            orderBy: [{ createdAt: "desc" }],
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
      }),
    ]);

  const productIds = Array.from(
    new Set(
      questions
        .map((question) => question.productId)
        .filter((productId): productId is number => typeof productId === "number" && productId > 0),
    ),
  );

  const products = productIds.length
    ? await prisma.xmlImportedProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      })
    : [];

  const productById = new Map(products.map((product) => [product.id, product.name]));

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? (
        <SiteHeader
          site={siteHeader}
          cartItemCount={cartItemCount}
          favoriteItemCount={favoriteItemCount}
        />
      ) : null}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[300px_1fr]">
        <AccountSidebar
          fullName={user.fullName}
          active="mesajlar"
          orderCount={orderCount}
          favoriteCount={favoriteItemCount}
          couponCount={couponCount}
        />

        <section className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Mesajlarım</h1>
            <p className="mt-1 text-slate-500">Satıcıya sorduğunuz sorular burada listelenir.</p>
          </div>

          {questions.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-slate-700 shadow-sm ring-1 ring-black/5">
              Satıcıya sorduğunuz soru bulunmamaktadır.
            </div>
          ) : null}

          {questions.map((question) => {
            const productName = question.productId ? productById.get(question.productId) : null;

            return (
              <article key={question.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-500">{formatDateTR(question.createdAt)}</div>
                  <span
                    className={[
                      "rounded-lg px-2 py-1 text-xs font-semibold",
                      question.isApproved
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    {question.isApproved ? "Onaylandı" : "Onay Bekliyor"}
                  </span>
                </div>

                {productName ? (
                  <div className="mt-2 text-sm text-slate-500">Ürün: {productName}</div>
                ) : null}

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sorunuz</div>
                  <p className="mt-1 text-sm text-slate-800">{question.question}</p>
                </div>

                <div className="mt-3 space-y-2">
                  {question.answers.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-500">
                      Henüz yanıtlanmadı.
                    </div>
                  ) : (
                    question.answers.map((answer) => (
                      <div key={answer.id} className="rounded-xl border border-[#1BA7A6]/20 bg-[#E7F6F6] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
                          Satıcı Yanıtı
                        </div>
                        <p className="mt-1 text-sm text-slate-800">{answer.answer}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
