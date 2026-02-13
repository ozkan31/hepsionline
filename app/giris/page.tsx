import { SiteHeader } from "@/components/site-header";
import { getCartItemCountFromCookie } from "@/lib/cart";
import { getFavoriteItemCountFromCookie } from "@/lib/favorites";
import { getSiteHeaderData } from "@/lib/site-header-data";
import { loginUserAction } from "@/lib/user-auth-actions";
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
  if (status === "invalid") return "E-posta veya şifre hatalı.";
  if (status === "required") return "Bu sayfa için önce giriş yapmalısınız.";
  if (status === "favorite_required") return "Favorilere eklemek için önce giriş yapmalısınız.";
  if (status === "session_error") return "Oturum oluşturulamadı. Yönetici ile iletişime geçin.";
  if (status === "logged_out") return "Oturum kapatıldı.";
  return "";
}

function isSuccessStatus(status?: string) {
  return status === "logged_out";
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
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
          <h1 className={styles.title}>Giriş Yap</h1>
          <p className={styles.subtitle}>Hesabına giriş yaparak bilgilerine erişebilirsin.</p>

          {notice ? <div className={isSuccessStatus(params.status) ? styles.noticeSuccess : styles.noticeError}>{notice}</div> : null}

          <form action={loginUserAction} className={styles.form}>
            <input type="hidden" name="next" value={nextPath} />
            {favoriteProductId ? <input type="hidden" name="favoriteProductId" value={favoriteProductId} /> : null}

            <label className={styles.field}>
              <span>E-posta</span>
              <input type="email" name="email" autoComplete="email" required />
            </label>

            <label className={styles.field}>
              <span>Şifre</span>
              <input type="password" name="password" autoComplete="current-password" required />
            </label>

            <button type="submit" className={styles.submitButton}>
              Giriş yap
            </button>
          </form>

          <p className={styles.switchText}>
            Hesabın yok mu?{" "}
            <Link
              href={{
                pathname: "/kayit",
                query: favoriteProductId ? { next: nextPath, favoriteProductId } : { next: nextPath },
              }}
              className={styles.switchLink}
            >
              Kayıt ol
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
