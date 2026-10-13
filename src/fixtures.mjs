import assert from 'node:assert/strict';
import { CAMPUS_ROUTES, LEGACY, SHARED_HELPER } from './expectations.mjs';

const SHA = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40}$/;
function sha(value, label) { assert.match(value ?? '', SHA, `${label}: an exact measured SHA256 is required`); }

/** Data-only contract. It launches/acquires/serves nothing and cannot qualify its own inputs. */
export function createCompiledCampusFixture(input) {
  assert.equal(input.format, 'umn-campus-compiled-browser-fixture');
  assert.equal(input.version, 1);
  assert.equal(input.inputStatus, 'checked-compiled-candidate', 'Source plans and synthetic packages are not browser candidates');
  const origin = new URL(input.origin);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'Only the explicitly granted local fixture origin is used');
  assert.ok(['http:', 'https:'].includes(origin.protocol));
  assert.equal(origin.pathname, '/');
  assert.equal(origin.search, '');
  assert.equal(origin.hash, '');
  assert.deepEqual(input.helper, SHARED_HELPER, 'Bind the already qualified public helper exactly');
  assert.ok(['chrome', 'firefox', 'webkit'].includes(input.browser));
  assert.ok(['webgl1', 'webgl2', 'webgpu'].includes(input.requestedBackend));
  assert.ok(input.profileDirectory, 'An approved disposable profile path must be supplied');
  sha(input.grant?.scopeSha256, 'fresh grant scope');
  assert.ok(input.grant.id && input.grant.expiresAt, 'A fresh coordinator grant is required before any execution');
  assert.ok(Number.isFinite(Date.parse(input.grant.expiresAt)));
  const compiled = input.compiled;
  if (compiled?.assemblyReceiptSha256) sha(compiled.assemblyReceiptSha256, 'actual Club assembly receipt');
  else sha(compiled?.assemblyArchiveSha256, 'actual compiled assembly archive');
  if (compiled?.assemblyArchiveSha256) sha(compiled.assemblyArchiveSha256, 'optional actual compiled assembly archive');
  sha(compiled?.fullFileMapSha256, 'compiled full file map');
  sha(compiled?.verificationReceiptSha256, 'checked compiled verification');
  sha(compiled?.appArchiveSha256, 'shared Campus App');
  sha(compiled?.workerBuildSealSha256, 'qualified shared worker build seal');
  assert.ok(compiled?.buildStamp, 'Bind the original actual compiled build stamp');
  sha(input.updateCandidate?.htmlSha256, 'controlled newer compiled HTML');
  sha(input.updateCandidate?.verificationReceiptSha256, 'controlled newer compiled verification');
  sha(input.updateCandidate?.workerSha256, 'controlled newer actual worker');
  sha(input.updateCandidate?.currentBundleSha256, 'controlled newer actual bundle');
  assert.ok(input.updateCandidate.currentBundleURL.startsWith('/assets/') && input.updateCandidate.cacheName);
  assert.equal(new URL(input.updateCandidate.currentBundleURL, origin).origin, origin.origin);
  assert.ok(input.updateCandidate?.buildStamp);
  assert.notEqual(input.updateCandidate.buildStamp, compiled.buildStamp);
  sha(input.nativeHost?.qualificationReceiptSha256, 'qualified public native host');
  sha(input.observationSourceSha256, 'actual compiled application observation fixture');
  assert.equal(input.contentProducer?.repository, 'foss-earth/scenes');
  assert.match(input.contentProducer?.revision ?? '', REVISION);
  assert.notEqual(input.contentProducer.revision, 'd58408d90542a73282d8bf544c54e0c9bf847b56',
    'The old checked single-document Scenes release does not qualify child composition');
  sha(input.contentProducer.archiveSha256, 'qualified Scenes composition archive');
  sha(input.contentProducer.qualificationReceiptSha256, 'qualified Scenes composition receipt');
  assert.equal(input.contentProducer.capability, 'finite-pinned-child-composition');
  assert.deepEqual(input.sharedSheet, LEGACY.sharedSheet, 'One exact shared preview sheet/cell-map identity is retained');
  assert.deepEqual(input.routes.map(row => row.id), CAMPUS_ROUTES.map(row => row.id), 'All four public routes must be checked');
  for (const route of input.routes) {
    const spec = CAMPUS_ROUTES.find(row => row.id === route.id);
    const entry = new URL(route.entryURL);
    assert.equal(entry.origin, origin.origin);
    assert.equal(entry.pathname, spec.path);
    assert.equal(entry.hash, '');
    sha(route.htmlSha256, `${route.id} compiled HTML`);
    sha(route.releaseDescriptorSha256, `${route.id} compiled release descriptor`);
    if (spec.sceneId) {
      const content = new URL(route.contentURL, entry);
      assert.equal(content.origin, origin.origin, 'Use the supplied compiled public corpus, not live providers');
      assert.equal(route.sceneId, spec.sceneId);
      sha(route.contentSha256, `${route.id} exact generated document`);
      assert.ok(Number.isSafeInteger(route.contentSizeBytes) && route.contentSizeBytes > 0);
      sha(route.navigationReceiptSha256, `${route.id} checked navigation binding`);
    }
  }
  assert.ok(input.pageOptions?.width > 0 && input.pageOptions?.height > 0);
  assert.equal(input.pageOptions.mode, 'live', 'Interception cannot qualify root workers');
  assert.equal(input.pageOptions.workers, true);
  assert.equal(input.pageOptions.respond, undefined);
  for (const name of ['startupMs', 'commandMs', 'closeMs', 'exitMs']) {
    const value = input.pageOptions.timeouts?.[name];
    assert.ok(Number.isFinite(value) && value > 0 && value <= 60000, `Bound the public helper's ${name}`);
  }
  if (input.browser === 'webkit') {
    const tools = input.pageOptions.playwright;
    assert.ok(tools?.packageRoot && tools.browserCachePath, 'Use named already installed WebKit tools/cache');
    assert.equal(tools.expectedVersion, '1.55.0');
    assert.equal(tools.expectedCoreVersion, '1.55.0');
    assert.equal(tools.expectedWebkitRevision, '2203');
  } else assert.ok(input.pageOptions.binary, 'Use a named installed browser binary');
  return structuredClone(input);
}

export function assertFreshFixtureGrant(fixture, now = Date.now()) {
  assert.ok(now < Date.parse(fixture.grant.expiresAt), 'The supplied heavy-check grant expired; do not launch');
}

/** The runtime-free selector is independently verifiable; no App/Scenes/worker input is required. */
export function createCompiledCampusSelectorFixture(input) {
  assert.equal(input.format, 'umn-campus-compiled-selector-fixture');
  assert.equal(input.version, 1);
  assert.equal(input.inputStatus, 'checked-compiled-candidate');
  assert.deepEqual(input.helper, SHARED_HELPER);
  assert.equal(input.browser, 'chrome', 'This public JavaScript-disable protocol proof is Chrome-only');
  assert.ok(input.profileDirectory);
  sha(input.grant?.scopeSha256, 'fresh selector grant scope');
  assert.ok(input.grant.id && Number.isFinite(Date.parse(input.grant.expiresAt)));
  sha(input.compiled?.selectorArchiveSha256, 'independent selector archive');
  sha(input.compiled?.fullFileMapSha256, 'independent selector full file map');
  sha(input.compiled?.verificationReceiptSha256, 'independent compiled selector verification');
  sha(input.selector?.htmlSha256, 'actual compiled selector HTML');
  const entry = new URL(input.selector.entryURL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(entry.hostname));
  assert.ok(['http:', 'https:'].includes(entry.protocol));
  assert.equal(entry.pathname, '/tour/');
  assert.equal(entry.search, '');
  assert.equal(entry.hash, '');
  assert.ok(input.pageOptions?.binary, 'Use the explicitly named installed Chrome binary');
  assert.ok(input.pageOptions.width > 0 && input.pageOptions.height > 0, 'Supply the actual selector fixture viewport');
  assert.equal(input.pageOptions.mode, 'live');
  assert.equal(input.pageOptions.respond, undefined);
  for (const name of ['startupMs', 'commandMs', 'closeMs', 'exitMs']) {
    const value = input.pageOptions.timeouts?.[name];
    assert.ok(Number.isFinite(value) && value > 0 && value <= 60000, `Bound selector ${name}`);
  }
  return structuredClone(input);
}
