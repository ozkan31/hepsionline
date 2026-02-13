import { jsonError, readJsonObject } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function parseOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export async function GET() {
  const coupons = await prisma.coupon.findMany({
    include: {
      _count: {
        select: { usages: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  return Response.json({ coupons });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(
        400,
        "INVALID_JSON",
        "Request body must be a valid JSON object.",
      );
    }

    const codeRaw = typeof body.code === "string" ? body.code : "";
    const code = normalizeCode(codeRaw);
    const type =
      body.type === "PERCENT"
        ? "PERCENT"
        : body.type === "FIXED"
          ? "FIXED"
          : null;
    const value = parseOptionalInt(body.value);
    const minOrderAmount = parseOptionalInt(body.minOrderAmount);
    const maxDiscountAmount = parseOptionalInt(body.maxDiscountAmount);
    const usageLimit = parseOptionalInt(body.usageLimit);
    const perUserLimit = parseOptionalInt(body.perUserLimit);
    const startsAt = parseOptionalDate(body.startsAt);
    const expiresAt = parseOptionalDate(body.expiresAt);
    const description =
      typeof body.description === "string"
        ? body.description.trim().slice(0, 220)
        : "";
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

    if (!code || code.length < 3 || code.length > 32) {
      return jsonError(
        400,
        "INVALID_BODY",
        "code must be between 3 and 32 characters.",
      );
    }
    if (!type) {
      return jsonError(400, "INVALID_BODY", "type must be FIXED or PERCENT.");
    }
    if (!value || value <= 0) {
      return jsonError(400, "INVALID_BODY", "value must be a positive number.");
    }
    if (type === "PERCENT" && value > 100) {
      return jsonError(
        400,
        "INVALID_BODY",
        "PERCENT coupon value cannot exceed 100.",
      );
    }
    if (minOrderAmount !== null && minOrderAmount < 0) {
      return jsonError(
        400,
        "INVALID_BODY",
        "minOrderAmount cannot be negative.",
      );
    }
    if (maxDiscountAmount !== null && maxDiscountAmount <= 0) {
      return jsonError(
        400,
        "INVALID_BODY",
        "maxDiscountAmount must be positive.",
      );
    }
    if (usageLimit !== null && usageLimit <= 0) {
      return jsonError(400, "INVALID_BODY", "usageLimit must be positive.");
    }
    if (perUserLimit !== null && perUserLimit <= 0) {
      return jsonError(400, "INVALID_BODY", "perUserLimit must be positive.");
    }
    if (startsAt && expiresAt && startsAt > expiresAt) {
      return jsonError(
        400,
        "INVALID_BODY",
        "startsAt cannot be later than expiresAt.",
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({
        data: {
          code,
          type,
          value,
          minOrderAmount,
          maxDiscountAmount,
          description: description || null,
          isActive,
          startsAt,
          expiresAt,
          usageLimit,
          perUserLimit,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "coupon_create",
          entity: "coupon",
          entityId: String(coupon.id),
          afterJson: {
            code,
            type,
            value,
            isActive,
          },
        },
      });

      return coupon.id;
    });

    const coupon = await prisma.coupon.findUnique({
      where: { id: created },
      include: {
        _count: { select: { usages: true } },
      },
    });
    return Response.json(coupon);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

