export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return Response.json(
    {
      error: message,
      code,
      ...(details === undefined ? {} : { details }),
    },
    { status },
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export function parseBoundedInt(
  rawValue: string | null,
  options: { defaultValue: number; min: number; max: number; paramName: string },
): { ok: true; value: number } | { ok: false; response: Response } {
  const { defaultValue, min, max, paramName } = options;

  if (rawValue === null || rawValue === "") {
    return { ok: true, value: defaultValue };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return {
      ok: false,
      response: jsonError(400, "INVALID_QUERY", `${paramName} must be an integer.`),
    };
  }

  if (parsed < min || parsed > max) {
    return {
      ok: false,
      response: jsonError(400, "INVALID_QUERY", `${paramName} must be between ${min} and ${max}.`),
    };
  }

  return { ok: true, value: parsed };
}
