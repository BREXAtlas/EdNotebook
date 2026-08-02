import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const directProviderHosts = [
  "api.anthropic.com",
  "api.openai.com",
  "api.groq.com",
  "generativelanguage.googleapis.com",
  "api.9router.com",
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    if (entry.name.includes(".test.")) return [];
    return sourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
  });
}

test("browser source cannot call an AI provider directly", () => {
  const violations = sourceFiles(sourceRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8").toLowerCase();
    return directProviderHosts
      .filter((host) => source.includes(host))
      .map((host) => `${relative(sourceRoot, filePath)} -> ${host}`);
  });

  assert.deepEqual(
    violations,
    [],
    `AI requests must use the governed JWT-protected router: ${violations.join(", ")}`,
  );
});
