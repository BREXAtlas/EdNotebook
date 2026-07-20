import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

async function filesBelow(directory, extension) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) results.push(...await filesBelow(target, extension));
    else if (entry.name.endsWith(extension)) results.push(target);
  }
  return results;
}

function openingButtonTags(source) {
  const tags = [];
  const starts = source.matchAll(/<button\b/g);
  for (const match of starts) {
    let quote = "";
    let escaped = false;
    let braceDepth = 0;
    let end = -1;
    for (let index = match.index; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'" || character === "`") {
        quote = character;
        continue;
      }
      if (character === "{") braceDepth += 1;
      else if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
      else if (character === ">" && braceDepth === 0) {
        end = index + 1;
        break;
      }
    }
    if (end > match.index) tags.push({ index: match.index, tag: source.slice(match.index, end) });
  }
  return tags;
}

const config = JSON.parse(await readFile(resolve(root, "capacitor.config.json"), "utf8"));
if (config.webDir !== "dist") failures.push("capacitor.config.json must use the Vite dist directory.");
if (config.server?.url) failures.push("A production app bundle must not set server.url.");
if (config.server?.cleartext) failures.push("A production app bundle must not enable cleartext traffic.");
if (config.android?.allowMixedContent) failures.push("A production app bundle must not allow mixed content.");

const distIndex = resolve(root, config.webDir, "index.html");
try {
  if (!(await stat(distIndex)).isFile()) failures.push("The built index.html is missing.");
  const html = await readFile(distIndex, "utf8");
  if (!html.includes("<head>")) failures.push("The built index.html needs a head element for Capacitor injection.");
  if (!html.includes("viewport-fit=cover")) failures.push("The built viewport must expose safe-area insets.");
} catch {
  failures.push("Run npm run build before the app-bundle readiness check.");
}

for (const file of await filesBelow(resolve(root, "src"), ".jsx")) {
  const source = await readFile(file, "utf8");
  for (const match of openingButtonTags(source)) {
    if (!/\btype\s*=/.test(match.tag)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${file.slice(root.length + 1)}:${line} button is missing an explicit type.`);
    }
  }
}

if (failures.length) {
  console.error(`Capacitor readiness failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Capacitor web-bundle readiness passed: dist is valid, production server settings are safe, and every JSX button has an explicit type.");
