#!/usr/bin/env node
/** Campus receipts only; all browser lifecycle remains in the public helper. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompiledCampusSmokeInput, readCompiledCampusSceneState, runCompiledCampusSmoke } from './local-smoke.mjs';

const [inputFile, outputDirectory] = process.argv.slice(2);
if (!inputFile || !outputDirectory || process.argv.length !== 4)
  throw new Error('Usage: node src/local-smoke-cli.mjs EXACT_LOCAL_SMOKE_INPUT_JSON NEW_OWNED_OUTPUT_DIR');
const input = createCompiledCampusSmokeInput(JSON.parse(readFileSync(inputFile, 'utf8')));
const sourceSha256 = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
assert.equal(sourceSha256, input.observationSourceSha256, 'The grant must bind this actual maintained driver');
const output = path.resolve(outputDirectory), parent = path.dirname(output);
assert.equal(realpathSync(parent), parent, 'Use an existing physical owned output parent');
assert.equal(lstatSync(parent).isDirectory(), true);
assert.equal(path.resolve(input.profileDirectory), path.join(output, 'profile'), 'Bind the exact isolated browser profile');
mkdirSync(output); // Never overwrite a retained attempt.
const retain = (name, bytes, expectedSha256) => {
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, expectedSha256);
  const target = path.join(output, name);
  writeFileSync(target, bytes, { flag: 'wx' });
  return { path: target, sha256: digest, sizeBytes: bytes.byteLength };
};
try {
  const receipt = await runCompiledCampusSmoke(input, {
    synthetic: false, sourceSha256, readSceneState: readCompiledCampusSceneState,
    writeScreenshot(route, bytes, digest) {
      assert.ok(['selector', 'minneapolis', 'st-paul', 'twin-cities'].includes(route));
      return retain(`${route}.png`, bytes, digest);
    },
    writeResourceEvidence(bytes, digest) { return retain('resource-evidence.json', bytes, digest); },
    writeReceipt(receipt) { writeFileSync(path.join(output, 'smoke-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' }); },
  });
  console.log(JSON.stringify({ status: receipt.status, output, driverSha256: sourceSha256 }));
} catch (error) {
  // Failed attempt is retained even if a callback or shared cleanup failed.
  writeFileSync(path.join(output, 'attempt-failure.json'), `${JSON.stringify({
    status: 'FAIL', name: error?.name, message: String(error?.message ?? error),
    errors: error instanceof AggregateError ? error.errors.map(cause => String(cause?.message ?? cause)) : [],
    receipt: error?.receipt ?? null,
  }, null, 2)}\n`, { flag: 'wx' });
  throw error;
}
