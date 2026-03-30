export function sanitizeExternalUrl(rawUrl: string | null | undefined): string {
  const input = String(rawUrl ?? "").trim();
  if (!input) return "";

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}
