import fs from "node:fs";

const html = fs.readFileSync("dist/index.html", "utf8");

if (html.includes('src="./assets/') || html.includes('href="./assets/')) {
  console.error("Build output contains ./assets (relative). This can break deep links.");
  process.exit(1);
}

console.log("Asset paths are absolute (/assets).");
