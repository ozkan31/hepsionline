import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { registerUserAction } from "@/lib/user-auth-actions";
import { getCurrentUserFromSession } from "@/lib/user-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  next?: string;
  favoriteProductId?: string;
}>;

function sanitizeNextPath(rawValue: string | undefined) {
  const fallback = "/hesabim";
  if (!rawValue) {
    return fallback;
  }

  if (!rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return fallback;
  }

  return rawValue;
}

function sanitizeFavoriteProductId(rawValue: string | undefined) {
  if (!rawValue) {
    return "";
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "";
  }

  return String(parsed);
}

function statusMessage(status?: string) {
  if (status === "invalid") return "Lütfen zorunlu alanları doldurun.";
  if (status === "invalid_email") return "Geçerli bir e-posta girin.";
  if (status === "short_password") return "Şifre en az 6 karakter olmalı.";
  if (status === "password_mismatch") return "Şifre ve şifre tekrar eşleşmiyor.";
  if (status === "email_exists") return "Bu e-posta zaten kayıtlı.";
  return "";
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const favoriteProductId = sanitizeFavoriteProductId(params.favoriteProductId);
  const currentUser = await getCurrentUserFromSession();

  if (currentUser) {
    redirect(nextPath);
  }

  const [siteHeader, cartItemCount, favoriteItemCount] = await Promise.all([
    getSiteHeaderData(),
    getCartItemCountFromCookie(),
    getFavoriteItemCountFromCookie(),
  ]);

  const notice = statusMessage(params.status);

  return (
    <>
      {siteHeader ? <SiteHeader site={siteHeader} cartItemCount={cartItemCount} favoriteItemCount={favoriteItemCount} /> : null}
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title}>Kayıt Ol</h1>
          <p className={styles.subtitle}>Adres ve iletişim bilgilerin hesabında saklanır.</p>

          {notice ? <div className={styles.noticeError}>{notice}</div> : null}

          <form action={registerUserAction} className={styles.form}>
            <input type="hidden" name="next" value={nextPath} />
            {favoriteProductId ? <input type="hidden" name="favoriteProductId" value={favoriteProductId} /> : null}

            <label className={styles.field}>
              <span>Ad Soyad</span>
              <input type="text" name="fullName" autoComplete="name" required />
            </label>

            <label className={styles.field}>
              <span>E-posta</span>
              <input type="email" name="email" autoComplete="email" required />
            </label>

            <label className={styles.field}>
              <span>Telefon</span>
              <input type="tel" name="phone" autoComplete="tel" required />
            </label>

            <label className={styles.field}>
              <span>Adres Satırı 1</span>
              <input type="text" name="addressLine1" autoComplete="address-line1" required />
            </label>

            <label className={styles.field}>
              <span>Adres Satırı 2 (opsiyonel)</span>
              <input type="text" name="addressLine2" autoComplete="address-line2" />
            </label>

            <div className={styles.gridRow}>
              <label className={styles.field}>
                <span>İl</span>
                <input type="text" name="city" autoComplete="address-level1" required />
              </label>

              <label className={styles.field}>
                <span>İlçe</span>
                <input type="text" name="district" autoComplete="address-level2" required />
              </label>

              <label className={styles.field}>
                <span>Posta Kodu</span>
                <input type="text" name="postalCode" autoComplete="postal-code" required />
              </label>
            </div>

            <div className={styles.gridRow}>
              <label className={styles.field}>
                <span>Şifre</span>
                <input type="password" name="password" autoComplete="new-password" required />
              </label>

              <label className={styles.field}>
                <span>Şifre Tekrar</span>
                <input type="password" name="confirmPassword" autoComplete="new-password" required />
              </label>
            </div>

            <button type="submit" className={styles.submitButton}>
              Hesap oluştur
            </button>
          </form>

          <p className={styles.switchText}>
            Zaten hesabın var mı?{" "}
            <Link
              href={{
                pathname: "/giris",
                query: favoriteProductId ? { next: nextPath, favoriteProductId } : { next: nextPath },
              }}
              className={styles.switchLink}
            >
              Giriş yap
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
