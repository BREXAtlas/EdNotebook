import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = "dist";
const coreDir = join(root, "assets", "core");
const featuresDir = join(root, "assets", "features");

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const errors = [];
if (!existsSync(coreDir)) errors.push("Missing dist/assets/core output folder.");
if (!existsSync(featuresDir)) errors.push("Missing dist/assets/features output folder.");

const coreFiles = filesUnder(coreDir).filter((path) => path.endsWith(".js"));
const featureFiles = filesUnder(featuresDir).filter((path) => path.endsWith(".js"));
const coreBytes = coreFiles.reduce((total, path) => total + statSync(path).size, 0);
const largestCore = coreFiles.map((path) => ({ path, bytes: statSync(path).size })).sort((a, b) => b.bytes - a.bytes)[0];

if (!coreFiles.length) errors.push("No JavaScript core bundle was generated.");
if (!featureFiles.length) errors.push("No lazy feature bundles were generated.");
if (coreBytes > 1_600_000) errors.push(`Initial core JavaScript is ${kb(coreBytes)}; keep it below 1.6 MB uncompressed.`);
if (largestCore?.bytes > 850_000) errors.push(`Largest core file ${relative(root, largestCore.path)} is ${kb(largestCore.bytes)}; keep individual core files below 850 KB uncompressed.`);

const html = readFileSync(join(root, "index.html"), "utf8");
const forbiddenInitial = ["document-tools", "tesseract", "opencv", "pdfjs", "mammoth", "jspdf"];
for (const name of forbiddenInitial) {
  if (html.toLowerCase().includes(name)) errors.push(`Heavy document feature “${name}” is referenced by the initial page HTML.`);
}

console.log(`Core JavaScript: ${coreFiles.length} files, ${kb(coreBytes)}`);
console.log(`Lazy feature JavaScript: ${featureFiles.length} files`);
console.log(`Largest core file: ${largestCore ? `${relative(root, largestCore.path)} (${kb(largestCore.bytes)})` : "none"}`);
console.log("Core files:");
for (const path of coreFiles.sort()) console.log(`  ${relative(root, path)} · ${kb(statSync(path).size)}`);
console.log("Largest feature files:");
for (const item of featureFiles.map((path) => ({ path, bytes: statSync(path).size })).sort((a, b) => b.bytes - a.bytes).slice(0, 12)) {
  console.log(`  ${relative(root, item.path)} · ${kb(item.bytes)}`);
}

if (errors.length) {
  console.error("Bundle split verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Bundle split verification passed.");
