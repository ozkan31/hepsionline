export type TurkeyLocationMap = Record<string, string[]>;

const TURKEY_DATA_URL = new URL("../../turkiye.json", import.meta.url).href;

function fixMojibake(value: string): string {
  const mojibakePattern = /[\u00C3\u00C4\u00C5\uFFFD]/;
  if (!mojibakePattern.test(value)) return value;

  const decodeOnce = (input: string) => {
    const bytes = Uint8Array.from(Array.from(input).map((char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  };

  const firstPass = decodeOnce(value);
  return mojibakePattern.test(firstPass) ? decodeOnce(firstPass) : firstPass;
}

export async function loadTurkeyLocations(): Promise<TurkeyLocationMap> {
  const response = await fetch(TURKEY_DATA_URL);
  if (!response.ok) {
    throw new Error("Failed to load turkey locations.");
  }

  const raw = (await response.json()) as Record<string, string[]>;
  const normalized: TurkeyLocationMap = {};

  for (const [province, districts] of Object.entries(raw)) {
    const normalizedProvince = fixMojibake(province);
    normalized[normalizedProvince] = districts.map((district) => fixMojibake(district));
  }

  return normalized;
}
