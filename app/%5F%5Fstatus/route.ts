import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeDatabaseUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    parsed.username = parsed.username ? "***" : "";
    parsed.password = parsed.password ? "***" : "";
    return parsed.toString();
  } catch {
    return "invalid DATABASE_URL format";
  }
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export async function GET() {
  const startedAt = Date.now();
  const rawDatabaseUrl = process.env.DATABASE_URL;
  const safeDatabaseUrl = sanitizeDatabaseUrl(rawDatabaseUrl);
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const safeSiteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/+$/, "") : null;
  const paytrConfigured = Boolean(
    process.env.PAYTR_MERCHANT_ID && process.env.PAYTR_MERCHANT_KEY && process.env.PAYTR_MERCHANT_SALT,
  );

  let dbPingOk = false;
  let dbPingError: ReturnType<typeof errorDetails> | null = null;
  let siteConfigCount: number | null = null;
  let siteConfigError: ReturnType<typeof errorDetails> | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbPingOk = true;
  } catch (error) {
    dbPingError = errorDetails(error);
  }

  try {
    siteConfigCount = await prisma.siteConfig.count();
  } catch (error) {
    siteConfigError = errorDetails(error);
  }

  const ok = Boolean(rawDatabaseUrl) && dbPingOk && siteConfigError === null;
  const statusCode = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
      statusCode,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      runtime: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV ?? "unknown",
      },
      checks: {
        databaseUrlDefined: Boolean(rawDatabaseUrl),
        databaseUrl: safeDatabaseUrl,
        siteUrlDefined: Boolean(rawSiteUrl),
        siteUrl: safeSiteUrl,
        paytr: {
          configured: paytrConfigured,
          merchantIdDefined: Boolean(process.env.PAYTR_MERCHANT_ID),
          merchantKeyDefined: Boolean(process.env.PAYTR_MERCHANT_KEY),
          merchantSaltDefined: Boolean(process.env.PAYTR_MERCHANT_SALT),
          testMode: process.env.PAYTR_TEST_MODE ?? "1",
          callbackUrlHint: safeSiteUrl ? `${safeSiteUrl}/api/paytr/callback` : null,
        },
        dbPing: {
          ok: dbPingOk,
          error: dbPingError,
        },
        siteConfigTable: {
          ok: siteConfigError === null,
          count: siteConfigCount,
          error: siteConfigError,
        },
      },
    },
    {
      status: statusCode,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
