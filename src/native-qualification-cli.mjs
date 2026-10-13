#!/usr/bin/env node
/** One sealed compiled-site qualification; root owns server/process timing and exact fixture cleanup authorization. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, realpathSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { runCampusQualification, createCompiledCampusFixture } from '@umn-vr/browser-testing';
import { createCampusObservationPorts } from '@umn-vr/browser-testing/native-observations';
import { createFixtureUpdate, restoreFixtureUpdate } from './fixture-update.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const restoreOnly = process.argv[2] === '--restore-only';
const arguments_ = process.argv.slice(restoreOnly ? 3 : 2); assert.equal(arguments_.length, 2, 'Usage: node native-qualification-cli.mjs [--restore-only] EXACT_NATIVE_INPUT_JSON NEW_EVIDENCE_DIR');
const [inputFile, outputDirectory] = arguments_;
const stat = lstatSync(inputFile); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8 * 1024 * 1024);
const bytes = readFileSync(inputFile), input = JSON.parse(bytes); assert.equal(input.format, 'umn-sealed-native-qualification'); assert.equal(input.version, 1);
assert.match(input.fixture.compiled.assemblyReceiptSha256 ?? '', /^[a-f0-9]{64}$/, 'New qualification uses an actual Club assembly receipt; archive hash only when an actual archive exists');
const fixture = createCompiledCampusFixture(input.fixture);
const output = path.resolve(outputDirectory); assert.equal(realpathSync(path.dirname(output)), path.dirname(output));
function write(file, value) { writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
if (restoreOnly) {
  const restoration = restoreFixtureUpdate(input, output); console.log(JSON.stringify({ ...restoration, mode: 'RESTORE_ONLY' }));
} else {
  mkdirSync(output); let update, failure;
  try {
    update = createFixtureUpdate(input, output);
    const ports = createCampusObservationPorts(fixture, { installedArtifactPins: input.installedArtifactPins, oldResource: input.oldResource, publishUpdate: () => update.publish(),
      writeReceipt: receipt => write(path.join(output, 'native-qualification.json'), receipt),
      writeScreenshot: (screenshot, expected) => { assert.equal(sha(screenshot), expected); assert.ok(screenshot.length <= 16 * 1024 * 1024); writeFileSync(path.join(output, 'native-qualification.png'), screenshot, { flag: 'wx' }); },
    });
    const receipt = await runCampusQualification(fixture, ports); assert.equal(receipt.status, 'PASS');
  } catch (error) {
    failure = error; write(path.join(output, 'native-command-failure.json'), { status: 'FAIL', inputSha256: sha(bytes), update: update?.state() ?? { anyWriteAttempted: false, publicationComplete: false }, message: String(error.message ?? error) });
  } finally {
    // Public browser close finishes before this point. Restore is also independently resumable by root on timeout.
    try { const restored = restoreFixtureUpdate(input, output); write(path.join(output, 'fixture-restoration.json'), restored); assert.equal(restored.status === 'PASS' || restored.status === 'NO_WRITES_TO_RESTORE', true); }
    catch (error) { write(path.join(output, 'fixture-restoration-failure.json'), { status: 'FAIL', message: String(error.message ?? error), update: update?.state() }); failure = failure ? new AggregateError([failure, error], 'Qualification and exact fixture restoration failed') : error; }
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ status: 'PASS', receipt: path.join(output, 'native-qualification.json'), receiptSha256: sha(readFileSync(path.join(output, 'native-qualification.json'))), update: update.state(), exactBaselineRestored: true }));
}
