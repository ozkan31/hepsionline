import { jsonError, readJsonObject } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const couponId = Number(id);
    if (!Number.isInteger(couponId) || couponId <= 0) {
      return jsonError(400, "INVALID_PATH", "id must be a positive integer.");
    }

    const body = await readJsonObject(request);
    if (!body) {
      return jsonError(
        400,
        "INVALID_JSON",
        "Request body must be a valid JSON object.",
      );
    }

    const existing = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, type: true },
    });
    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Coupon not found.");
    }

    const patch: {
      code?: string;
      type?: "FIXED" | "PERCENT";
      value?: number;
      minOrderAmount?: number | null;
      maxDiscountAmount?: number | null;
      description?: string | null;
      isActive?: boolean;
      startsAt?: Date | null;
      expiresAt?: Date | null;
      usageLimit?: number | null;
      perUserLimit?: number | null;
    } = {};

    if ("code" in body) {
      if (typeof body.code !== "string") {
        return jsonError(400, "INVALID_BODY", "code must be string.");
      }
      const code = body.code.trim().toUpperCase().replace(/\s+/g, "");
      if (!code || code.length < 3 || code.length > 32) {
        return jsonError(
          400,
          "INVALID_BODY",
          "code must be between 3 and 32 characters.",
        );
      }
      patch.code = code;
    }

    if ("type" in body) {
      if (body.type !== "FIXED" && body.type !== "PERCENT") {
        return jsonError(400, "INVALID_BODY", "type must be FIXED or PERCENT.");
      }
      patch.type = body.type;
    }

    if ("value" in body) {
      const value = parseOptionalInt(body.value);
      if (!value || value <= 0) {
        return jsonError(400, "INVALID_BODY", "value must be positive.");
      }
      patch.value = value;
    }

    if ("minOrderAmount" in body) {
      const minOrderAmount = parseOptionalInt(body.minOrderAmount);
      if (minOrderAmount !== null && minOrderAmount < 0) {
        return jsonError(400, "INVALID_BODY", "minOrderAmount cannot be negative.");
      }
      patch.minOrderAmount = minOrderAmount;
    }

    if ("maxDiscountAmount" in body) {
      const maxDiscountAmount = parseOptionalInt(body.maxDiscountAmount);
      if (maxDiscountAmount !== null && maxDiscountAmount <= 0) {
        return jsonError(400, "INVALID_BODY", "maxDiscountAmount must be positive.");
      }
      patch.maxDiscountAmount = maxDiscountAmount;
    }

    if ("usageLimit" in body) {
      const usageLimit = parseOptionalInt(body.usageLimit);
      if (usageLimit !== null && usageLimit <= 0) {
        return jsonError(400, "INVALID_BODY", "usageLimit must be positive.");
      }
      patch.usageLimit = usageLimit;
    }

    if ("perUserLimit" in body) {
      const perUserLimit = parseOptionalInt(body.perUserLimit);
      if (perUserLimit !== null && perUserLimit <= 0) {
        return jsonError(400, "INVALID_BODY", "perUserLimit must be positive.");
      }
      patch.perUserLimit = perUserLimit;
    }

    if ("description" in body) {
      if (typeof body.description !== "string" && body.description !== null) {
        return jsonError(
          400,
          "INVALID_BODY",
          "description must be string or null.",
        );
      }
      patch.description =
        typeof body.description === "string"
          ? body.description.trim().slice(0, 220) || null
          : null;
    }

    if ("isActive" in body) {
      if (typeof body.isActive !== "boolean") {
        return jsonError(400, "INVALID_BODY", "isActive must be boolean.");
      }
      patch.isActive = body.isActive;
    }

    if ("startsAt" in body) {
      const startsAt = parseOptionalDate(body.startsAt);
      if (body.startsAt !== null && body.startsAt !== "" && !startsAt) {
        return jsonError(400, "INVALID_BODY", "startsAt must be a valid date.");
      }
      patch.startsAt = startsAt;
    }

    if ("expiresAt" in body) {
      const expiresAt = parseOptionalDate(body.expiresAt);
      if (body.expiresAt !== null && body.expiresAt !== "" && !expiresAt) {
        return jsonError(400, "INVALID_BODY", "expiresAt must be a valid date.");
      }
      patch.expiresAt = expiresAt;
    }

    const effectiveType = patch.type ?? existing.type;
    const effectiveValue = patch.value;
    if (effectiveType === "PERCENT" && effectiveValue && effectiveValue > 100) {
      return jsonError(
        400,
        "INVALID_BODY",
        "PERCENT coupon value cannot exceed 100.",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.update({
        where: { id: couponId },
        data: patch,
      });

      await tx.adminAuditLog.create({
        data: {
          action: "coupon_update",
          entity: "coupon",
          entityId: String(couponId),
          afterJson: patch,
        },
      });
      return coupon.id;
    });

    const full = await prisma.coupon.findUnique({
      where: { id: updated },
      include: {
        _count: { select: { usages: true } },
      },
    });
    return Response.json(full);
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const couponId = Number(id);
    if (!Number.isInteger(couponId) || couponId <= 0) {
      return jsonError(400, "INVALID_PATH", "id must be a positive integer.");
    }

    const existing = await prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, code: true },
    });
    if (!existing) return jsonError(404, "NOT_FOUND", "Coupon not found.");

    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id: couponId },
        data: {
          isActive: false,
          expiresAt: new Date(),
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "coupon_delete",
          entity: "coupon",
          entityId: String(couponId),
          afterJson: {
            code: existing.code,
            mode: "soft_disable",
          },
        },
      });
    });

    return Response.json({ ok: true });
  } catch {
    return jsonError(500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

