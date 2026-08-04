import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));

function jsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return jsxFiles(path);
    return extname(entry.name) === ".jsx" ? [path] : [];
  });
}

test("plain section fragments cannot replace an EdNotebook hash route", () => {
  const unsafe = [];
  for (const file of jsxFiles(root)) {
    const source = readFileSync(file, "utf8");
    const fragmentLinks = source.match(/<a\b[^>]*href="#(?!\/)[^"]*"[^>]*>/gu) || [];
    for (const tag of fragmentLinks) {
      if (!/\bonClick=/u.test(tag)) unsafe.push(`${file}: ${tag}`);
    }
  }
  assert.deepEqual(unsafe, [], `Plain fragments must prevent hash-router navigation:\n${unsafe.join("\n")}`);
});
