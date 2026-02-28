import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadSeedData() {
  const sourcePath = path.resolve(__dirname, "../src/data/products.ts");
  const source = await fs.readFile(sourcePath, "utf8");

  const executable = source
    .replace(/^import .*$/gm, "")
    .replace("export const products: Product[] =", "const products =")
    .replace("export const categories =", "const categories =");

  const factory = new Function(`${executable}\nreturn { products, categories };`);
  const result = factory();

  if (!result?.products || !result?.categories) {
    throw new Error("Failed to load seed data from src/data/products.ts");
  }

  return result;
}
