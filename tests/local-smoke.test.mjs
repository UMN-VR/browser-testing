// Negative data/port gates only. No synthetic passing browser fixture; source prepared UNRUN.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SHARED_HELPER } from "../src/expectations.mjs";
import { createCompiledCampusSmokeInput, assertCompiledCampusSmokePorts } from "../src/local-smoke.mjs";

const sealed = "a".repeat(64);
function incompletePlan() {
  return {
    format: "umn-campus-compiled-local-smoke", version: 1,
    inputStatus: "checked-compiled-candidate", synthetic: false,
    origin: "http://127.0.0.1:4197/", localPort: 4197, helper: SHARED_HELPER,
    browser: "chrome", profileDirectory: "/unrun/owned/profile", maxDurationMs: 240000,
    grant: { id: "test-only-unrun", scopeSha256: sealed, expiresAt: "2099-01-01T00:00:00Z" },
    // Deliberately lacks real artifact seals: this never becomes a candidate or launches.
  };
}

test("rejects source plans and supplied synthetic runtime observations before helper import", () => {
  const plan = incompletePlan(); plan.inputStatus = "source-prepared";
  assert.throws(() => createCompiledCampusSmokeInput(plan));
  const synthetic = incompletePlan(); synthetic.synthetic = true;
  assert.throws(() => createCompiledCampusSmokeInput(synthetic), /Synthetic/);
  const supplied = incompletePlan(); supplied.observations = { panoramaOnScreen: true };
  assert.throws(() => createCompiledCampusSmokeInput(supplied), /opened actual page/);
});

test("requires exact assembly and native/media/producer seals rather than hash-free success flags", () => {
  assert.throws(() => createCompiledCampusSmokeInput(incompletePlan()), /compiled.assemblyArchiveSha256/);
  const receiptOnly = incompletePlan(); receiptOnly.compiled = { assemblyReceiptSha256: sealed };
  assert.throws(() => createCompiledCampusSmokeInput(receiptOnly), /compiled.fullFileMapSha256/);
  const invalidArchive = incompletePlan(); invalidArchive.compiled = { assemblyReceiptSha256: sealed, assemblyArchiveSha256: "unmeasured" };
  assert.throws(() => createCompiledCampusSmokeInput(invalidArchive), /optional actual compiled.assemblyArchiveSha256/);
});

test("rejects a different local port and nonlocal preview origin", () => {
  const wrongPort = incompletePlan(); wrongPort.localPort = 4198;
  assert.throws(() => createCompiledCampusSmokeInput(wrongPort), /exact granted local port/);
  const remote = incompletePlan(); remote.origin = "https://umn-vr.github.io/";
  assert.throws(() => createCompiledCampusSmokeInput(remote));
});

test("requires every actual native/evidence callback and its reviewed source pin", () => {
  const input = { observationSourceSha256: sealed };
  assert.throws(() => assertCompiledCampusSmokePorts(input, { synthetic: false, sourceSha256: sealed }), /readSceneState/);
  assert.throws(() => assertCompiledCampusSmokePorts(input, { synthetic: true, sourceSha256: sealed }), /synthetic/);
  assert.throws(() => assertCompiledCampusSmokePorts(input, { synthetic: false, sourceSha256: "b".repeat(64) }), /reviewed native driver/);
});
