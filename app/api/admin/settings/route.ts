import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isRecord, jsonError, readJsonObject } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const PAGE_KEYS = ["home", "cart", "payment", "product"] as const;
const COLOR_FIELDS = ["primary", "accent", "background"] as const;
const PAGE_COLOR_FIELDS = ["text", "accent", "background"] as const;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_SETTINGS = {
  site_name: "Hepsionline",
  palette: { primary: "#111827", accent: "#8b5cf6", background: "#ffffff" },
  page_palettes: {
    home: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
    cart: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
    payment: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
    product: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
  },
  ab_tests: {
    enabled: false,
    experiments: {},
  },
  maintenance: {
    enabled: false,
    title: "Bakim modundayiz",
    message: "Kisa bir teknik calisma yapiyoruz.",
    eta: "Kisa surede tekrar buradayiz.",
  },
  feature_toggles: {
    ab_test: false,
    maintenance_mode: false,
  },
};

function isBooleanRecord(value: unknown) {
  if (!isRecord(value)) return false;
  return Object.values(value).every((v) => typeof v === "boolean");
}

function parseSiteName(body: Record<string, unknown>) {
  if (!("site_name" in body)) return { ok: true as const, value: undefined };
  if (typeof body.site_name !== "string") {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "site_name must be a string.") };
  }

  const siteName = body.site_name.trim();
  if (!siteName || siteName.length > 120) {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "site_name length must be between 1 and 120.") };
  }

  return { ok: true as const, value: siteName };
}

function parsePalette(body: Record<string, unknown>) {
  if (!("palette" in body)) return { ok: true as const, value: undefined };
  if (!isRecord(body.palette)) {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "palette must be an object.") };
  }

  const palette: Record<string, string> = {};
  for (const field of COLOR_FIELDS) {
    const value = body.palette[field];
    if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
      return {
        ok: false as const,
        response: jsonError(400, "INVALID_BODY", `palette.${field} must be a valid hex color (#RRGGBB).`),
      };
    }
    palette[field] = value;
  }

  return { ok: true as const, value: palette as Prisma.InputJsonValue };
}

function parsePagePalettes(body: Record<string, unknown>) {
  if (!("page_palettes" in body)) return { ok: true as const, value: undefined };
  if (!isRecord(body.page_palettes)) {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "page_palettes must be an object.") };
  }

  const pagePalettes: Record<string, Record<string, string>> = {};
  for (const pageKey of PAGE_KEYS) {
    const pageValue = body.page_palettes[pageKey];
    if (!isRecord(pageValue)) {
      return {
        ok: false as const,
        response: jsonError(400, "INVALID_BODY", `page_palettes.${pageKey} must be an object.`),
      };
    }

    pagePalettes[pageKey] = {};
    for (const field of PAGE_COLOR_FIELDS) {
      const color = pageValue[field];
      if (typeof color !== "string" || !HEX_COLOR_RE.test(color)) {
        return {
          ok: false as const,
          response: jsonError(400, "INVALID_BODY", `page_palettes.${pageKey}.${field} must be a valid hex color (#RRGGBB).`),
        };
      }
      pagePalettes[pageKey][field] = color;
    }
  }

  return { ok: true as const, value: pagePalettes as Prisma.InputJsonValue };
}

function parseMaintenance(body: Record<string, unknown>) {
  if (!("maintenance" in body)) return { ok: true as const, value: undefined };
  if (!isRecord(body.maintenance)) {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "maintenance must be an object.") };
  }

  const { enabled, title, message, eta } = body.maintenance;
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "maintenance.enabled must be boolean.") };
  }
  if (title !== undefined && typeof title !== "string") {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "maintenance.title must be string.") };
  }
  if (message !== undefined && typeof message !== "string") {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "maintenance.message must be string.") };
  }
  if (eta !== undefined && typeof eta !== "string") {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "maintenance.eta must be string.") };
  }

  return { ok: true as const, value: body.maintenance as Prisma.InputJsonValue };
}

function parseJsonObjectField(body: Record<string, unknown>, key: "ab_tests") {
  if (!(key in body)) return { ok: true as const, value: undefined };
  if (!isRecord(body[key])) {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", `${key} must be an object.`) };
  }
  return { ok: true as const, value: body[key] as Prisma.InputJsonValue };
}

function parseFeatureToggles(body: Record<string, unknown>) {
  if (!("feature_toggles" in body)) return { ok: true as const, value: undefined };
  if (!isBooleanRecord(body.feature_toggles)) {
    return { ok: false as const, response: jsonError(400, "INVALID_BODY", "feature_toggles must be an object with boolean values.") };
  }
  return { ok: true as const, value: body.feature_toggles as Prisma.InputJsonValue };
}

function toResponse(settings: {
  siteName: string | null;
  palette: Prisma.JsonValue;
  pagePalettes: Prisma.JsonValue;
  abTests: Prisma.JsonValue;
  maintenance: Prisma.JsonValue;
  featureToggles: Prisma.JsonValue;
}) {
  return {
    site_name: settings.siteName ?? DEFAULT_SETTINGS.site_name,
    palette: settings.palette ?? DEFAULT_SETTINGS.palette,
    page_palettes: settings.pagePalettes ?? DEFAULT_SETTINGS.page_palettes,
    ab_tests: settings.abTests ?? DEFAULT_SETTINGS.ab_tests,
    maintenance: settings.maintenance ?? DEFAULT_SETTINGS.maintenance,
    feature_toggles: settings.featureToggles ?? DEFAULT_SETTINGS.feature_toggles,
  };
}

export async function GET() {
  try {
    const settings = await prisma.adminSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        siteName: DEFAULT_SETTINGS.site_name,
        palette: DEFAULT_SETTINGS.palette,
        pagePalettes: DEFAULT_SETTINGS.page_palettes,
        abTests: DEFAULT_SETTINGS.ab_tests,
        maintenance: DEFAULT_SETTINGS.maintenance,
        featureToggles: DEFAULT_SETTINGS.feature_toggles,
      },
    });

    return Response.json(toResponse(settings));
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(400, "INVALID_JSON", "Request body must be a valid JSON object.");
    }

    const siteName = parseSiteName(body);
    if (!siteName.ok) return siteName.response;

    const palette = parsePalette(body);
    if (!palette.ok) return palette.response;

    const pagePalettes = parsePagePalettes(body);
    if (!pagePalettes.ok) return pagePalettes.response;

    const abTests = parseJsonObjectField(body, "ab_tests");
    if (!abTests.ok) return abTests.response;

    const maintenance = parseMaintenance(body);
    if (!maintenance.ok) return maintenance.response;

    const featureToggles = parseFeatureToggles(body);
    if (!featureToggles.ok) return featureToggles.response;

    const settings = await prisma.adminSetting.upsert({
      where: { id: 1 },
      update: {
        siteName: siteName.value,
        palette: palette.value,
        pagePalettes: pagePalettes.value,
        abTests: abTests.value,
        maintenance: maintenance.value,
        featureToggles: featureToggles.value,
      },
      create: {
        id: 1,
        siteName: siteName.value ?? DEFAULT_SETTINGS.site_name,
        palette: palette.value ?? (DEFAULT_SETTINGS.palette as Prisma.InputJsonValue),
        pagePalettes: pagePalettes.value ?? (DEFAULT_SETTINGS.page_palettes as Prisma.InputJsonValue),
        abTests: abTests.value ?? (DEFAULT_SETTINGS.ab_tests as Prisma.InputJsonValue),
        maintenance: maintenance.value ?? (DEFAULT_SETTINGS.maintenance as Prisma.InputJsonValue),
        featureToggles: featureToggles.value ?? (DEFAULT_SETTINGS.feature_toggles as Prisma.InputJsonValue),
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        action: "settings_update",
        entity: "admin_setting",
        entityId: "1",
        afterJson: {
          site_name: settings.siteName,
        },
      },
    });

    return Response.json(toResponse(settings));
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}
