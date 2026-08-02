import { readFile } from "node:fs/promises";

import { reconcileOperationalRecoveryEvidence } from "../src/admin-control/operationalRecoveryEvidence.js";

function usage() {
  return "Usage: node scripts/reconcile-recovery-manifests.mjs <source-manifest.json> <restored-manifest.json>";
}

async function readManifest(fileName) {
  const content = await readFile(fileName, "utf8");
  return JSON.parse(content);
}

try {
  const [, , sourceFile, restoredFile, ...extra] = process.argv;
  if (!sourceFile || !restoredFile || extra.length) throw new TypeError(usage());
  const [source, restored] = await Promise.all([
    readManifest(sourceFile),
    readManifest(restoredFile),
  ]);
  const result = reconcileOperationalRecoveryEvidence(source, restored);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.technicallyReconciled) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`${error?.message || "Recovery evidence reconciliation failed."}\n`);
  process.exitCode = 1;
}
