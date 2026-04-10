import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync("dist/index.html", "utf8");
const publicHtaccessPath = path.join("public", ".htaccess");
const distHtaccessPath = path.join("dist", ".htaccess");

if (html.includes('src="./assets/') || html.includes('href="./assets/')) {
  console.error("Build output contains ./assets (relative). This can break deep links.");
  process.exit(1);
}

if (fs.existsSync(publicHtaccessPath)) {
  fs.copyFileSync(publicHtaccessPath, distHtaccessPath);
  console.log(".htaccess copied to dist.");
}

console.log("Asset paths are absolute (/assets).");
