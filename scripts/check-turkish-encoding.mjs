import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["src", "server", "scripts", "public"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css", ".md"]);
const skipDirectories = new Set(["node_modules", "dist", ".git", "reports", "uploads"]);
const suspiciousTokens = ["Ã", "Å", "Ä", "Â", "\u009e", "\u0178", "\u0153"];

function shouldInspect(filePath) {
  return [...allowedExtensions].some((extension) => filePath.endsWith(extension));
}

function collectFiles(dirPath, bucket) {
  for (const entry of readdirSync(dirPath)) {
    if (skipDirectories.has(entry)) continue;
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      collectFiles(fullPath, bucket);
      continue;
    }

    if (stats.isFile() && shouldInspect(fullPath)) {
      bucket.push(fullPath);
    }
  }
}

const files = [];
for (const root of roots) {
  collectFiles(root, files);
}

const findings = [];

for (const filePath of files) {
  if (relative(process.cwd(), filePath) === "scripts\\check-turkish-encoding.mjs") {
    continue;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const isIntentionalRepairLine = line.includes(".replaceAll(") || line.includes(".replace(");
    if (isIntentionalRepairLine) {
      return;
    }

    const hasSuspiciousToken = suspiciousTokens.some((token) => line.includes(token));
    const hasControlCharacter = [...line].some((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x80 && code <= 0x9f;
    });

    if (hasSuspiciousToken || hasControlCharacter) {
      findings.push({
        filePath: relative(process.cwd(), filePath),
        lineNumber: index + 1,
        line,
      });
    }
  });
}

if (findings.length > 0) {
  console.error("Turkce karakter bozulmasi tespit edildi:");
  findings.slice(0, 50).forEach(({ filePath, lineNumber, line }) => {
    console.error(`- ${filePath}:${lineNumber}: ${line}`);
  });

  if (findings.length > 50) {
    console.error(`... ve ${findings.length - 50} ek satir daha`);
  }

  process.exit(1);
}

console.log("Turkce karakter kontrolu temiz.");
