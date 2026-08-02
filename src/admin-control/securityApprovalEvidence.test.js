import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const workflowDirectory = new URL("../../.github/workflows/", import.meta.url);

test("every external GitHub Action is pinned to an immutable commit", async () => {
  const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/u.test(name));
  const references = [];

  for (const workflowName of workflowNames) {
    const workflow = await readFile(new URL(workflowName, workflowDirectory), "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(\S+))?\s*$/gmu)) {
      if (!match[1].startsWith("./")) references.push({ workflowName, reference: match[1], release: match[2] });
    }
  }

  assert.ok(references.length > 0);
  for (const { workflowName, reference, release } of references) {
    assert.match(reference, /^[^@]+@[0-9a-f]{40}$/u, `${workflowName}: ${reference}`);
    assert.match(release || "", /^v\d+(?:\.\d+){0,2}$/u, `${workflowName}: ${reference} needs a readable release comment`);
  }
});

test("the security packet remains a human-owned, fail-closed staging decision", async () => {
  const packet = await readFile(new URL("../../docs/SECURITY_APPROVAL_EVIDENCE_PACKET.md", import.meta.url), "utf8");

  assert.match(packet, /Status: \*\*AWAITING ACCOUNTABLE SECURITY REVIEW — HOLD\*\*/u);
  assert.match(packet, /gfalgonektwdylsxsgzc/u);
  assert.match(packet, /didwxihufueqbpfnfdmm/u);
  assert.match(packet, /production student intake remains disabled/iu);
  assert.match(packet, /103 `WARN` findings/u);
  assert.match(packet, /102 authenticated SECURITY DEFINER RPCs/u);
  assert.match(packet, /list_alex_morrison_catalog\(text\)/u);
  assert.match(packet, /0 of 161 dependencies/u);
  assert.match(packet, /securityApproval/u);
  assert.match(packet, /must not be inferred from a merge/u);
});
