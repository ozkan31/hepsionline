import { HomeInfiniteFeed } from "@/components/home-infinite-feed";
import { SiteHeader } from "@/components/site-header";
import { resolveAbVariantForToken } from "@/lib/ab-test";
import { getCartHomepageStateFromCookie, getCartTokenFromCookie } from "@/lib/cart";
import { getFavoriteHomepageStateFromCookie } from "@/lib/favorites";
import { getHomepageData } from "@/lib/homepage-data";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  let site = null;
  let loadError: string | null = null;

  try {
    site = await getHomepageData(1);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Bilinmeyen veritabanı hatası";
    console.error("Homepage DB load failed:", error);
  }

  if (loadError) {
    return (
      <main className="empty-state">
        <p>Veritabanı bağlantısı sırasında hata oluştu.</p>
        <p>{loadError}</p>
        <p>Detaylı kontrol: /__status</p>
      </main>
    );
  }

  if (!site) {
    return (
      <main className="empty-state">
        <p>Site verisi bulunamadı. Veritabanı seed komutunu çalıştırın.</p>
      </main>
    );
  }

  const [cartState, favoriteState, cartToken, currentUser] = await Promise.all([
    getCartHomepageStateFromCookie(),
    getFavoriteHomepageStateFromCookie(),
    getCartTokenFromCookie(),
    getCurrentUserFromSession(),
  ]);

  const homeAbVariant = await resolveAbVariantForToken("home_hero_copy", cartToken);

  await prisma.adminAuditLog.create({
    data: {
      action: "storefront_visit",
      actorId: currentUser?.email ?? undefined,
      entity: "cart",
      entityId: cartToken ?? undefined,
      afterJson: {
        path: "/",
      },
    },
  });

  if (homeAbVariant) {
    await prisma.adminAuditLog.create({
      data: {
        action: `ab:home_hero_copy:${homeAbVariant}:view`,
        actorId: currentUser?.email ?? undefined,
        entity: "cart",
        entityId: cartToken ?? undefined,
      },
    });
  }

  const initialCartStateByProductId: Record<string, { cartItemId: number; quantity: number }> = {};
  for (const item of cartState.items) {
    initialCartStateByProductId[String(item.productId)] = {
      cartItemId: item.id,
      quantity: item.quantity,
    };
  }

  const initialFavoriteStateByProductId: Record<string, { favoriteItemId: number }> = {};
  for (const item of favoriteState.items) {
    initialFavoriteStateByProductId[String(item.productId)] = {
      favoriteItemId: item.id,
    };
  }

  return (
    <main className="shop-page">
      <SiteHeader site={site} cartItemCount={cartState.itemCount} favoriteItemCount={favoriteState.itemCount} />

      <section className="catalog-shell">
        <div className="shop-container">
          <HomeInfiniteFeed
            site={{
              sectionIcon: site.sectionIcon,
              wishlistLabel: site.wishlistLabel,
              quantityLabel: site.quantityLabel,
            }}
            initialSections={site.sections}
            initialPagination={site.pagination}
            initialCartStateByProductId={initialCartStateByProductId}
            initialFavoriteStateByProductId={initialFavoriteStateByProductId}
          />
        </div>
      </section>
    </main>
  );
}
