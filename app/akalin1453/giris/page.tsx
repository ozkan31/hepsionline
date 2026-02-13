import { getAdminSessionFromCookie } from "@/lib/admin-auth";
import { loginAdminAction } from "@/lib/admin-auth-actions";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  next?: string;
}>;

function sanitizeNextPath(rawValue: string | undefined) {
  const fallback = "/akalin1453";
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return fallback;
  }

  return rawValue;
}

function statusMessage(status?: string) {
  if (status === "invalid") return "Kullanici adi veya sifre hatali.";
  if (status === "required") return "Devam etmek icin admin girisi yapin.";
  if (status === "session_error") return "Admin oturumu olusturulamadi.";
  if (status === "logged_out") return "Admin oturumu kapatildi.";
  return "";
}

function isSuccessStatus(status?: string) {
  return status === "logged_out";
}

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const adminSession = await getAdminSessionFromCookie();
  if (adminSession.ok) {
    redirect(nextPath);
  }

  const notice = statusMessage(params.status);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Admin Girisi</h1>
        {notice ? <div className={isSuccessStatus(params.status) ? styles.noticeSuccess : styles.noticeError}>{notice}</div> : null}
        <form action={loginAdminAction} className={styles.form}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            <span>Kullanici adi</span>
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            <span>Sifre</span>
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Giris yap</button>
        </form>
      </section>
    </main>
  );
}
