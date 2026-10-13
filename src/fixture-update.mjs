/** Finite compiled fixture update with exact before recovery and idempotent restoration. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync, existsSync, appendFileSync, renameSync, chmodSync } from 'node:fs';
import path from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function physical(file) {
  const absolute = path.resolve(file); let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) { current = path.join(current, part); assert.equal(lstatSync(current).isSymbolicLink(), false); }
  const stat = lstatSync(absolute); assert.ok(stat.isFile() && stat.size <= 100 * 1024 * 1024); return readFileSync(absolute);
}
function pinned(pin) { const bytes = physical(pin.path); assert.equal(bytes.length, pin.sizeBytes); assert.equal(sha(bytes), pin.sha256); return bytes; }
function present(file) { try { lstatSync(file); return true; } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; } }
function safeParent(file) {
  const parent = path.dirname(path.resolve(file)); let current = path.parse(parent).root;
  for (const part of parent.slice(current.length).split(path.sep).filter(Boolean)) { current = path.join(current, part); const stat = lstatSync(current); assert.ok(stat.isDirectory() && !stat.isSymbolicLink()); }
}
function writeNew(file, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (existsSync(file)) { assert.equal(sha(physical(file)), sha(bytes)); return; }
  const temporary = file + '.writing-' + randomUUID(); writeFileSync(temporary, bytes, { flag: 'wx' }); assert.equal(existsSync(file), false); renameSync(temporary, file);
}
function validPin(pin) { assert.ok(pin && /^[0-9a-f]{64}$/.test(pin.sha256) && Number.isSafeInteger(pin.sizeBytes) && pin.sizeBytes >= 0 && pin.sizeBytes <= 100 * 1024 * 1024); }
// Restoration validates sealed metadata only: absent/corrupt after artifacts cannot block old controls.
function metadataRows(update, fixture) {
  assert.equal(realpathSync(update.assemblyRoot), path.resolve(update.assemblyRoot));
  assert.ok(Array.isArray(update.files) && update.files.length > 2 && update.files.length <= 4096);
  assert.ok(Array.isArray(update.cleanupCreatedFiles), 'Root must explicitly authorize exact newly created fixture asset cleanup');
  assert.deepEqual([...update.cleanupCreatedFiles].sort(), update.files.filter(item => item.before.absent === true).map(item => item.path).sort());
  const seen = new Set(), records = []; let total = 0;
  for (const item of update.files) {
    assert.ok(typeof item.path === 'string' && !seen.has(item.path)); seen.add(item.path);
    assert.ok(item.path === 'tour/twin-cities/index.html' || item.path === 'foss-earth-sw.js' || /^assets\/[A-Za-z0-9_.-]+$/.test(item.path));
    validPin(item.after); total += item.after.sizeBytes; assert.ok(total <= 300 * 1024 * 1024);
    if (item.before.absent !== true) validPin(item.before);
    assert.ok(item.path.startsWith('assets/') || (item.before.absent !== true && item.before.sizeBytes <= 16 * 1024 * 1024));
    const target = path.join(update.assemblyRoot, item.path); assert.ok(target.startsWith(update.assemblyRoot + path.sep));
    if (item.path.startsWith('assets/') && item.before.absent !== true) assert.equal(item.before.sha256, item.after.sha256, 'Existing immutable asset paths preserve bytes');
    records.push({ item, target });
  }
  assert.ok(seen.has('tour/twin-cities/index.html') && seen.has('foss-earth-sw.js'));
  const bundle = records.find(row => '/' + row.item.path === fixture.updateCandidate.currentBundleURL);
  assert.ok(bundle && bundle.item.before.absent === true, 'Actual new bundle path absent from the first assembly');
  assert.equal(bundle.item.after.sha256, fixture.updateCandidate.currentBundleSha256);
  assert.equal(records.find(row => row.item.path === 'foss-earth-sw.js').item.after.sha256, fixture.updateCandidate.workerSha256);
  assert.equal(records.find(row => row.item.path === 'tour/twin-cities/index.html').item.after.sha256, fixture.updateCandidate.htmlSha256);
  return records;
}
function rows(update, fixture) { return metadataRows(update, fixture).map(row => ({ ...row, after: pinned(row.item.after) })); }
export function createFixtureUpdate(input, output) {
  const records = rows(input.update, input.fixture), recovery = path.join(output, 'before-update'); mkdirSync(recovery);
  const before = [];
  for (const row of records) {
    if (row.item.before.absent === true) { assert.equal(existsSync(row.target), false); before.push({ path: row.item.path, absent: true }); continue; }
    const bytes = physical(row.target); assert.equal(bytes.length, row.item.before.sizeBytes); assert.equal(sha(bytes), row.item.before.sha256);
    const save = path.join(recovery, row.item.path); mkdirSync(path.dirname(save), { recursive: true }); writeFileSync(save, bytes, { flag: 'wx' });
    before.push({ path: row.item.path, sizeBytes: bytes.length, sha256: sha(bytes), mode: lstatSync(row.target).mode & 0o777 });
  }
  writeNew(path.join(recovery, 'before.json'), { format: 'umn-exact-fixture-update-before', version: 1, assemblyRoot: input.update.assemblyRoot, files: before });
  let anyWriteAttempted = false, publicationComplete = false;
  return {
    async publish() {
      assert.equal(anyWriteAttempted, false); assert.ok(Date.now() < Date.parse(input.fixture.grant.expiresAt));
      for (const row of records) {
        if (row.item.before.absent === true) assert.equal(existsSync(row.target), false); else assert.equal(sha(physical(row.target)), row.item.before.sha256);
      }
      for (const row of [...records.filter(row => row.item.path !== 'tour/twin-cities/index.html'), records.find(row => row.item.path === 'tour/twin-cities/index.html')]) {
        appendFileSync(path.join(recovery, 'publication.jsonl'), JSON.stringify({ event: 'WRITE_INTENT', path: row.item.path }) + '\n'); anyWriteAttempted = true;
        mkdirSync(path.dirname(row.target), { recursive: true }); writeFileSync(row.target, row.after, row.item.before.absent === true ? { flag: 'wx' } : {});
        appendFileSync(path.join(recovery, 'publication.jsonl'), JSON.stringify({ event: 'WRITE_COMPLETED', path: row.item.path, sha256: sha(physical(row.target)) }) + '\n');
      }
      publicationComplete = true; writeNew(path.join(output, 'published-update.json'), { status: 'PUBLISHED_BOUNDED_LOCAL_FIXTURE', files: records.map(row => ({ path: row.item.path, sha256: sha(physical(row.target)), sizeBytes: row.after.length })), recovery });
    },
    state() { return { anyWriteAttempted, publicationComplete }; },
    restore() { return restoreFixtureUpdate(input, output); },
  };
}
/** Root may invoke this again after a terminated qualification command within its remaining cleanup reserve. */
export function restoreFixtureUpdate(input, output) {
  const records = metadataRows(input.update, input.fixture), recovery = path.join(output, 'before-update'), beforeFile = path.join(recovery, 'before.json');
  if (!existsSync(beforeFile)) {
    assert.equal(existsSync(path.join(recovery, 'publication.jsonl')), false);
    for (const row of records) if (row.item.before.absent === true) assert.equal(existsSync(row.target), false); else assert.equal(sha(physical(row.target)), row.item.before.sha256);
    return { status: 'NO_WRITES_TO_RESTORE', beforeVerified: true };
  }
  const before = JSON.parse(physical(beforeFile)); assert.equal(before.format, 'umn-exact-fixture-update-before'); assert.equal(before.version, 1);
  assert.equal(before.assemblyRoot, input.update.assemblyRoot); assert.deepEqual(before.files.map(item => item.path), records.map(row => row.item.path));
  for (const row of records) {
    const original = before.files.find(item => item.path === row.item.path);
    assert.equal(original.absent === true, row.item.before.absent === true);
    if (original.absent !== true) { assert.equal(original.sha256, row.item.before.sha256); assert.equal(original.sizeBytes, row.item.before.sizeBytes); assert.ok(Number.isInteger(original.mode) && original.mode >= 0 && original.mode <= 0o777); }
  }
  const observed = path.join(output, 'observed-update-' + randomUUID()); mkdirSync(observed);
  const retained = [], errors = [];
  function retain(row) {
    safeParent(row.target); if (!present(row.target)) return;
    const destination = path.join(observed, row.item.path); mkdirSync(path.dirname(destination), { recursive: true });
    // Rename retains exact observed bytes without any optional recursive/read/hash audit.
    renameSync(row.target, destination); retained.push({ path: row.item.path, destination });
  }
  function restoreOriginal(row) {
    const original = before.files.find(item => item.path === row.item.path), saved = physical(path.join(recovery, row.item.path));
    assert.equal(sha(saved), original.sha256); assert.equal(saved.length, original.sizeBytes);
    retain(row); writeFileSync(row.target, saved, { flag: 'wx' }); chmodSync(row.target, original.mode);
  }
  // Return both critical controls before processing assets or any observed/after artifact audit.
  const controls = records.filter(row => !row.item.path.startsWith('assets/'));
  for (const row of controls) { try { restoreOriginal(row); } catch (error) { errors.push({ path: row.item.path, error: String(error) }); } }
  for (const row of records.filter(row => row.item.path.startsWith('assets/'))) {
    try { if (row.item.before.absent === true) retain(row); else restoreOriginal(row); } catch (error) { errors.push({ path: row.item.path, error: String(error) }); }
  }
  for (const row of records) {
    try {
      if (row.item.before.absent === true) assert.equal(present(row.target), false);
      else { const bytes = physical(row.target); assert.equal(sha(bytes), row.item.before.sha256); assert.equal(bytes.length, row.item.before.sizeBytes); assert.equal(lstatSync(row.target).mode & 0o777, before.files.find(item => item.path === row.item.path).mode); }
    } catch (error) { errors.push({ path: row.item.path, error: String(error) }); }
  }
  const audits = retained.map(item => {
    try {
      const stat = lstatSync(item.destination); assert.ok(stat.isFile() && !stat.isSymbolicLink());
      if (stat.size > 1024 * 1024) return { path: item.path, observedSizeBytes: stat.size, optionalObservedAudit: 'SKIPPED_OVER_ONE_MIB_BOUND', exactBytesRetainedByRename: true };
      const bytes = physical(item.destination); return { path: item.path, observedSha256: sha(bytes), observedSizeBytes: bytes.length };
    }
    catch (error) { return { path: item.path, optionalObservedAudit: 'FAILED_AFTER_BASELINE_RESTORATION', error: String(error) }; }
  });
  const result = { status: errors.length ? 'FAIL' : 'PASS', exactBeforeControlBytesRestored: !errors.length, exactCreatedFixtureAssetsRemoved: input.update.cleanupCreatedFiles, observedBytesRetained: observed, files: audits, errors };
  writeNew(path.join(observed, 'restoration.json'), result); assert.equal(errors.length, 0, 'Exact baseline restoration failed; observed evidence retained'); return result;
}
