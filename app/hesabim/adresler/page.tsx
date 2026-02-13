import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getAvailableCouponCountForUser } from "@/lib/coupon";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import { redirect } from "next/navigation";
import { AdreslerContent } from "./adresler-content";

export const dynamic = "force-dynamic";

type AddressCard = {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
};

export default async function AdreslerimPage() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect("/giris?status=required&next=%2Fhesabim%2Fadresler");
  }

  const [siteHeader, cartItemCount, favoriteItemCount] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
  ]);

  const orderFilters: Array<{ customerEmail?: string; customerPhone?: string }> = [];
  if (user.email) orderFilters.push({ customerEmail: user.email });
  if (user.phone) orderFilters.push({ customerPhone: user.phone });

  const orderCount =
    orderFilters.length > 0
      ? await prisma.order.count({
          where: {
            OR: orderFilters,
          },
        })
      : 0;

  const couponCount = await getAvailableCouponCountForUser(user.email);
  const hasPrimaryAddress = Boolean(user.addressLine1 && user.addressLine1.trim().length > 0);
  const addresses: AddressCard[] = hasPrimaryAddress
    ? [
        {
          id: `user-${user.id}`,
          fullName: user.fullName,
          phone: user.phone,
          addressLine1: user.addressLine1,
          addressLine2: user.addressLine2 ?? "",
          city: user.city,
          district: user.district,
          postalCode: user.postalCode,
          country: "Türkiye",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#F3F6F8]">
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
      <AdreslerContent
        fullName={user.fullName}
        favoriteCount={favoriteItemCount}
        orderCount={orderCount}
        couponCount={couponCount}
        addresses={addresses}
      />
    </div>
  );
}
