const TURKISH_CHAR_MAP: Record<string, string> = {
  "\u00E7": "c",
  "\u00C7": "c",
  "\u011F": "g",
  "\u011E": "g",
  "\u0131": "i",
  "\u0130": "i",
  "\u00F6": "o",
  "\u00D6": "o",
  "\u015F": "s",
  "\u015E": "s",
  "\u00FC": "u",
  "\u00DC": "u",
};

export function slugifyProductName(name: string) {
  return name
    .replace(/[\u00E7\u00C7\u011F\u011E\u0131\u0130\u00F6\u00D6\u015F\u015E\u00FC\u00DC]/g, (char) => {
      return TURKISH_CHAR_MAP[char] ?? char;
    })
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildProductSlug(name: string, id: number) {
  const base = slugifyProductName(name) || "urun";
  return `${base}-${id}`;
}

export function parseProductIdFromSlug(slug: string) {
  const match = slug.match(/-(\d+)$/);
  if (!match) {
    return null;
  }

  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}
