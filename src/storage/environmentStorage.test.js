import assert from "node:assert/strict";
import test from "node:test";

import { createEnvironmentStorage } from "./environmentStorage.js";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

test("staging never reads an unscoped production course id", () => {
  const storage = memoryStorage({ "ednotebook-course-id": "production-course-id" });
  const staging = createEnvironmentStorage(storage, "staging");

  assert.equal(staging.getItem("ednotebook-course-id"), null);
  assert.equal(storage.getItem("ednotebook-course-id"), "production-course-id");
});

test("production migrates historical unscoped EdNotebook state once", () => {
  const storage = memoryStorage({ "ednotebook-course-step": "4" });
  const production = createEnvironmentStorage(storage, "production");

  assert.equal(production.getItem("ednotebook-course-step"), "4");
  assert.equal(storage.getItem("ednotebook-course-step"), null);
  assert.equal(
    storage.getItem("ednotebook:production:ednotebook-course-step"),
    "4",
  );
});

test("production and staging store independent values on the same origin", () => {
  const storage = memoryStorage();
  const production = createEnvironmentStorage(storage, "production");
  const staging = createEnvironmentStorage(storage, "staging");

  production.setItem("ednotebook-course-id", "production-id");
  staging.setItem("ednotebook-course-id", "staging-id");

  assert.equal(production.getItem("ednotebook-course-id"), "production-id");
  assert.equal(staging.getItem("ednotebook-course-id"), "staging-id");
  assert.deepEqual(storage.snapshot(), {
    "ednotebook:production:ednotebook-course-id": "production-id",
    "ednotebook:staging:ednotebook-course-id": "staging-id",
  });
});

test("environment storage isolates dynamic EdNotebook keys too", () => {
  const storage = memoryStorage();
  const staging = createEnvironmentStorage(storage, "staging");
  const key = "ednotebook-course-progress-course-123";

  staging.setJson(key, { completed: ["lesson-1"] });

  assert.deepEqual(staging.getJson(key), { completed: ["lesson-1"] });
  assert.equal(storage.getItem(key), null);
  assert.ok(storage.getItem(`ednotebook:staging:${key}`));
});
