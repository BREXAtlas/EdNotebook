import assert from "node:assert/strict";
import test from "node:test";
import { scrollWithinHashRoute } from "./scrollWithinHashRoute.js";

test("section scrolling preserves the active hash-router route", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  let prevented = false;
  let scrollOptions = null;
  let focused = false;
  globalThis.window = {
    location: { hash: "#/professor/dashboard" },
    matchMedia: () => ({ matches: false }),
  };
  globalThis.document = {
    getElementById: (id) => id === "digital-literacy-assign" ? {
      scrollIntoView: (options) => { scrollOptions = options; },
      hasAttribute: (name) => name === "tabindex",
      focus: () => { focused = true; },
    } : null,
  };
  try {
    const found = scrollWithinHashRoute(
      { preventDefault: () => { prevented = true; } },
      "digital-literacy-assign",
    );
    assert.equal(found, true);
    assert.equal(prevented, true);
    assert.equal(globalThis.window.location.hash, "#/professor/dashboard");
    assert.deepEqual(scrollOptions, { behavior: "smooth", block: "start" });
    assert.equal(focused, true);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
