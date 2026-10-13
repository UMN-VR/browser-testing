import test from 'node:test';
import assert from 'node:assert/strict';
import publicFacts from './northrop-public-facts.json' with { type: 'json' };
import markerStyleBaseline from '../src/marker-style-baseline.json' with { type: 'json' };
import { LEGACY, CAMPUS_ROUTES, CAMPUS_TAB_IDS, CROSS_CAMPUS_DIRECTIONS, SHARED_HELPER } from '../src/expectations.mjs';
import {
  assertPreservedEntity, assertPreservedAsset, assertChildNavigation, assertSelectorSnapshot,
  assertRuntimeSnapshot, assertReportOnly, assertWorkerAndUpdate, assertCompleteBrowserEvidence,
} from '../src/assertions.mjs';
import { createCompiledCampusFixture, createCompiledCampusSelectorFixture, assertFreshFixtureGrant } from '../src/fixtures.mjs';

// Synthetic observations exercise application assertion failures. They qualify no browser,
// native host, producer, worker, compiled package or publication/admission setting.
function selector() {
  return { path: '/tour/', mainCount: 1, navCount: 1, heading: 'Choose your campus tour', skipTarget: 'campus-tours',
    scriptCount: 0, inlineHandlers: 0, javascriptURLs: 0, canvasCount: 0,
    cards: CAMPUS_ROUTES.slice(1).map(route => ({ path: route.path, label: route.id, description: 'A campus photograph tour.',
      flat: true, nestedLinks: 0, imageCount: 1, image: { alt: 'Campus panorama photograph.', complete: true, naturalWidth: 256 } })),
    text: 'Photographs © Regents of the University of Minnesota. OpenStreetMap contributors.' };
}
function navigation(campus) {
  const ids = new Set(LEGACY.membership[campus]);
  return LEGACY.links.filter(row => ids.has(row.sourceEntityId)).map(row => {
    const cross = CROSS_CAMPUS_DIRECTIONS.find(item => item.source === row.sourceEntityId && item.link === row.originalLink.id);
    return { ...structuredClone(row), mode: cross ? 'external-scene-route' : 'internal-original-id',
      ...(cross ? { targetRoute: cross.route, targetPanoramaId: cross.target, targetResolutionObserved: true } : {}) };
  });
}
function runtime() {
  return { runtimeStarted: true, currentSceneId: 'umn-st-paul', entityIds: [...LEGACY.membership['st-paul']],
    backend: { actual: 'webgl2', browserProduct: 'synthetic fixture', engineVersion: 'synthetic fixture', deviceKind: 'unknown' },
    configuredTabs: [...CAMPUS_TAB_IDS], authorities: { runtimes: 1, viewers: 1, schedulers: 1, brokers: 1, uploaders: 1 }, devActivated: false,
    tabProofs: CAMPUS_TAB_IDS.map(id => ({ id, accessibleLabel: id, renderedText: 'Retained tab content.', keyboardOpened: true,
      keyboardClosed: true, focusRestored: true, inputMechanism: 'native-browser-input' })),
    accessibilityClaim: 'retained-content-and-tested-controls' };
}
function worker() {
  return { mode: 'live', controlling: true, registrations: [{ scope: 'http://localhost:4180/', scriptURL: 'http://localhost:4180/foss-earth-sw.js' }],
    legacyScene: { sha256: LEGACY.source.sha256, sizeBytes: LEGACY.source.sizeBytes },
    oldResource: { readableAfterUpdateCheck: true, url: '/assets/older-content.js', sha256: 'a'.repeat(64), observedAfterCheckSha256: 'a'.repeat(64) },
    update: { beforeAskBuild: 'older-fixture-build', afterAskBuild: 'older-fixture-build', publishedBuild: 'newer-fixture-build',
      reloadCountBeforeAsk: 0, reloadCountAfterAsk: 0, reloadActionAvailable: true, reloadCountAfterExplicitAction: 1,
      afterExplicitReloadBuild: 'newer-fixture-build' } };
}
function compiledFixture() {
  return { format: 'umn-campus-compiled-browser-fixture', version: 1, inputStatus: 'checked-compiled-candidate',
    origin: 'http://localhost:4180/', helper: { ...SHARED_HELPER }, browser: 'chrome', requestedBackend: 'webgl2',
    profileDirectory: '/synthetic-owner-scratch/profile', grant: { id: 'synthetic-unit-data', scopeSha256: '1'.repeat(64), expiresAt: '2099-01-01T00:00:00Z' },
    compiled: { assemblyArchiveSha256: '2'.repeat(64), fullFileMapSha256: '3'.repeat(64), verificationReceiptSha256: '4'.repeat(64),
      appArchiveSha256: '5'.repeat(64), workerBuildSealSha256: '6'.repeat(64), buildStamp: 'older-fixture-build' },
    updateCandidate: { htmlSha256: '0'.repeat(64), verificationReceiptSha256: '1'.repeat(64), buildStamp: 'newer-fixture-build',
      workerSha256: '2'.repeat(64), currentBundleSha256: '3'.repeat(64), currentBundleURL: '/assets/newer-fixture.js', cacheName: 'synthetic-worker-cache' },
    nativeHost: { qualificationReceiptSha256: '7'.repeat(64) }, observationSourceSha256: '8'.repeat(64),
    contentProducer: { repository: 'foss-earth/scenes', revision: '9'.repeat(40), archiveSha256: 'a'.repeat(64),
      qualificationReceiptSha256: 'b'.repeat(64), capability: 'finite-pinned-child-composition' },
    sharedSheet: structuredClone(LEGACY.sharedSheet),
    routes: CAMPUS_ROUTES.map(row => ({ id: row.id, entryURL: `http://localhost:4180${row.path}`, htmlSha256: 'c'.repeat(64),
      releaseDescriptorSha256: 'd'.repeat(64), ...(row.sceneId ? { sceneId: row.sceneId, contentURL: `${row.path}compiled-scene.json`,
        contentSha256: 'e'.repeat(64), contentSizeBytes: 100, navigationReceiptSha256: 'f'.repeat(64) } : {}) })),
    pageOptions: { mode: 'live', workers: true, width: 1100, height: 900, binary: '/synthetic-installed-browser',
      timeouts: { startupMs: 30000, commandMs: 15000, closeMs: 10000, exitMs: 5000 } } };
}

test('known public record and Regents credit retain their independently measured baseline', () => {
  assertPreservedEntity(publicFacts.entity);
  assertPreservedEntity(publicFacts.aliasEntity);
  assertPreservedAsset(publicFacts.asset, { representations: false });
});
test('an invented capture height or north alignment is rejected', () => {
  for (const change of [entity => { entity.capture.height = { meters: 0, datum: 'ellipsoid' }; },
    entity => { entity.imagePose.aligned = true; },
    entity => { entity.extensions['umn-vr.tour'].north.provenance = 'Assumed true north.'; }]) {
    const entity = structuredClone(publicFacts.entity); change(entity);
    assert.throws(() => assertPreservedEntity(entity), /unknown height\/north|north|height/);
  }
});
test('removing a caption, photograph alias or rights notice is rejected', () => {
  const entity = structuredClone(publicFacts.entity); entity.description = '';
  assert.throws(() => assertPreservedEntity(entity), /captions|description/);
  const alias = structuredClone(publicFacts.aliasEntity); alias.extensions['umn-vr.tour'].youvisit.panoramas.pop();
  assert.throws(() => assertPreservedEntity(alias), /provenance|captions/);
  const asset = structuredClone(publicFacts.asset); asset.attribution.text = 'AGPL project image';
  assert.throws(() => assertPreservedAsset(asset, { representations: false }), /rights notice/);
});
test('each child retains every authored link and its two intentional cross-campus directions', () => {
  for (const campus of ['minneapolis', 'st-paul']) assertChildNavigation(campus, navigation(campus));
  const dropped = navigation('st-paul'); dropped.pop();
  assert.throws(() => assertChildNavigation('st-paul', dropped), /original link/);
  const changed = navigation('minneapolis');
  changed.find(row => row.targetRoute).targetPanoramaId = 'wrong-campus-place';
  assert.throws(() => assertChildNavigation('minneapolis', changed));
});
test('planned cross-campus intent cannot stand in for observed destination resolution', () => {
  const links = navigation('st-paul'); links.find(row => row.targetRoute).targetResolutionObserved = false;
  assert.throws(() => assertChildNavigation('st-paul', links), /not proof/);
});
test('selector rejects nesting, empty descriptions, missing photos and script activation', () => {
  assertSelectorSnapshot(selector());
  for (const change of [snapshot => { snapshot.cards[1].flat = false; },
    snapshot => { snapshot.cards[0].description = ''; }, snapshot => { snapshot.cards[2].image.naturalWidth = 0; },
    snapshot => { snapshot.scriptCount = 1; }]) {
    const snapshot = selector(); change(snapshot); assert.throws(() => assertSelectorSnapshot(snapshot));
  }
});
test('all thirteen actual tabs and the requested backend are required', () => {
  assertRuntimeSnapshot('st-paul', runtime(), 'webgl2');
  const fallback = runtime(); fallback.backend.actual = 'webgl1';
  assert.throws(() => assertRuntimeSnapshot('st-paul', fallback, 'webgl2'), /silently fall back/);
  const missing = runtime(); missing.configuredTabs.pop();
  assert.throws(() => assertRuntimeSnapshot('st-paul', missing, 'webgl2'));
  const syntheticKeyboard = runtime(); syntheticKeyboard.tabProofs[0].inputMechanism = 'DOM-dispatch';
  assert.throws(() => assertRuntimeSnapshot('st-paul', syntheticKeyboard, 'webgl2'), /not native-input/);
});
test('report-only rejects a runtime or Dev even when both query flags were requested', () => {
  const report = { runtimeStarted: false, viewerCreated: false, devActivated: false, canvasCount: 0, visibleText: 'Bug report' };
  assertReportOnly(report);
  assert.throws(() => assertReportOnly({ ...report, devActivated: true }), /must not activate Dev/);
  assert.throws(() => assertReportOnly({ ...report, runtimeStarted: true }), /stop before/);
});
test('root worker scope, old bytes and report-only updates cannot regress', () => {
  assertWorkerAndUpdate(worker(), 'http://localhost:4180/');
  const scoped = worker(); scoped.registrations[0].scope = 'http://localhost:4180/tour/';
  assert.throws(() => assertWorkerAndUpdate(scoped, 'http://localhost:4180/'));
  const earlyReload = worker(); earlyReload.update.reloadCountAfterAsk = 1;
  assert.throws(() => assertWorkerAndUpdate(earlyReload, 'http://localhost:4180/'), /report-only/);
  const lostResource = worker(); lostResource.oldResource.observedAfterCheckSha256 = 'b'.repeat(64);
  assert.throws(() => assertWorkerAndUpdate(lostResource, 'http://localhost:4180/'), /original bytes/);
  const changedLegacy = worker(); changedLegacy.legacyScene.sha256 = 'c'.repeat(64);
  assert.throws(() => assertWorkerAndUpdate(changedLegacy, 'http://localhost:4180/'));
});
test('source plans, old Scenes, missing native evidence, interception and expired grants cannot launch', () => {
  createCompiledCampusFixture(compiledFixture());
  for (const change of [input => { input.inputStatus = 'source-prepared'; },
    input => { input.contentProducer.revision = 'd58408d90542a73282d8bf544c54e0c9bf847b56'; },
    input => { delete input.nativeHost; }, input => { input.pageOptions.mode = 'interception'; }]) {
    const input = compiledFixture(); change(input); assert.throws(() => createCompiledCampusFixture(input));
  }
  for (const field of ['workerSha256', 'currentBundleSha256', 'currentBundleURL', 'cacheName']) {
    const input = compiledFixture(); delete input.updateCandidate[field]; assert.throws(() => createCompiledCampusFixture(input), `Missing update ${field}`);
  }
  const receiptOnly = compiledFixture(); delete receiptOnly.compiled.assemblyArchiveSha256; receiptOnly.compiled.assemblyReceiptSha256 = '2'.repeat(64);
  createCompiledCampusFixture(receiptOnly);
  const fixture = createCompiledCampusFixture(compiledFixture());
  assert.throws(() => assertFreshFixtureGrant(fixture, Date.parse('2100-01-01T00:00:00Z')), /expired/);
});
test('truncated or forcibly closed browser evidence never becomes a pass', () => {
  const evidence = { facts: { browser: 'chrome', mode: 'live', workers: true }, console: [], network: [],
    lifecycle: [{ event: 'exit', code: 0, signal: null }], dropped: { console: 0, network: 0, lifecycle: 0 } };
  assertCompleteBrowserEvidence(evidence, 'chrome');
  const truncated = structuredClone(evidence); truncated.dropped.network = 1;
  assert.throws(() => assertCompleteBrowserEvidence(truncated, 'chrome'), /Incomplete network/);
  const forced = structuredClone(evidence); forced.lifecycle.unshift({ event: 'signal', signal: 'SIGTERM' });
  assert.throws(() => assertCompleteBrowserEvidence(forced, 'chrome'), /Forced cleanup/);
});
test('the compiled runtime-free selector can be gated without any App, Scenes or worker dependency', () => {
  const full = compiledFixture();
  const selectorOnly = { format: 'umn-campus-compiled-selector-fixture', version: 1, inputStatus: 'checked-compiled-candidate',
    helper: full.helper, browser: 'chrome', profileDirectory: full.profileDirectory, grant: full.grant,
    compiled: { selectorArchiveSha256: 'a'.repeat(64), fullFileMapSha256: 'b'.repeat(64), verificationReceiptSha256: 'c'.repeat(64) },
    selector: { entryURL: full.routes[0].entryURL, htmlSha256: full.routes[0].htmlSha256 }, pageOptions: full.pageOptions };
  const accepted = createCompiledCampusSelectorFixture(selectorOnly);
  assert.equal(accepted.nativeHost, undefined);
  assert.equal(accepted.contentProducer, undefined);
  assert.equal(accepted.compiled.appArchiveSha256, undefined);
});

test('the measured inherited appearance is bound to the unchanged original scene and record hashes', () => {
  assert.deepEqual(markerStyleBaseline.source, LEGACY.source);
  assert.equal(markerStyleBaseline.source.sha256, publicFacts.sourceSha256);
  assert.equal(markerStyleBaseline.entityCount, 60);
  assert.equal(markerStyleBaseline.individualMarkerStyleCount, 0);
  const materialized = structuredClone(publicFacts.entity);
  materialized.marker.style = structuredClone(markerStyleBaseline.authoredRootStyle);
  assertPreservedEntity(materialized, { sceneMarkerStyle: {} });
  const partial = structuredClone(publicFacts.entity);
  partial.marker.style = { hover: { scale: 1.3 } };
  assertPreservedEntity(partial);
  materialized.markerStyle = structuredClone(markerStyleBaseline.resolvedStyle);
  assertPreservedEntity(materialized, { sceneMarkerStyle: {} });
});

test('absent or changed inherited root appearance fails for an unmaterialized original marker', () => {
  assert.throws(() => assertPreservedEntity(publicFacts.entity, { sceneMarkerStyle: {} }), /effective inherited/);
  const rootStyle = structuredClone(markerStyleBaseline.authoredRootStyle);
  rootStyle.outline.widthPx = 3;
  assert.throws(() => assertPreservedEntity(publicFacts.entity, { sceneMarkerStyle: rootStyle }), /effective inherited/);
});

test('materialization rejects changed outline, hover, extra style semantics and null style records', () => {
  for (const change of [style => { style.outline.color = '#ffffff'; }, style => { style.outline.widthPx = 3; },
    style => { style.outline = null; }, style => { style.hover.scale = 2; }, style => { style.hover = null; },
    style => { style.unreviewedGlow = true; }]) {
    const entity = structuredClone(publicFacts.entity);
    entity.marker.style = structuredClone(markerStyleBaseline.authoredRootStyle);
    change(entity.marker.style);
    assert.throws(() => assertPreservedEntity(entity), /effective inherited/);
  }
  const nullStyle = structuredClone(publicFacts.entity); nullStyle.marker.style = null;
  assert.throws(() => assertPreservedEntity(nullStyle), /materialized marker style/);
});

test('equivalent materialized style cannot hide changed marker geometry', () => {
  for (const change of [marker => { marker.eastM = 1; }, marker => { marker.northM = 1; },
    marker => { marker.offsetM = 26; }, marker => { marker.radiusMeters = 4; },
    marker => { marker.mode = 'capture-relative'; }]) {
    const entity = structuredClone(publicFacts.entity);
    entity.marker.style = structuredClone(markerStyleBaseline.authoredRootStyle);
    change(entity.marker);
    assert.throws(() => assertPreservedEntity(entity), /placement|provenance/);
  }
});

test('equivalent materialized style cannot hide changed caption, provenance, capture height or north', () => {
  for (const change of [entity => { entity.description = 'Rewritten caption.'; },
    entity => { entity.extensions['umn-vr.tour'].capture = 'Unmeasured placement.'; },
    entity => { entity.capture.height = { meters: 0, datum: 'ellipsoid' }; },
    entity => { entity.imagePose.aligned = true; },
    entity => { entity.extensions['umn-vr.tour'].north.provenance = 'Assumed true north.'; }]) {
    const entity = structuredClone(publicFacts.entity);
    entity.marker.style = structuredClone(markerStyleBaseline.authoredRootStyle);
    change(entity);
    assert.throws(() => assertPreservedEntity(entity), /captions|provenance|unknown height\/north/);
  }
});

test('materialized style does not admit unknown identities or incompatible original photograph aliases', () => {
  const unknown = structuredClone(publicFacts.entity);
  unknown.marker.style = structuredClone(markerStyleBaseline.authoredRootStyle);
  unknown.id = 'unreviewed-campus-place';
  assert.throws(() => assertPreservedEntity(unknown), /Unknown campus entity/);
  const alias = structuredClone(publicFacts.aliasEntity);
  alias.marker.style = structuredClone(markerStyleBaseline.authoredRootStyle);
  alias.extensions['umn-vr.tour'].youvisit.panoramas.pop();
  assert.throws(() => assertPreservedEntity(alias), /provenance/);
});

test('resolved appearance observations must match the independently measured outline and hover', () => {
  for (const change of [style => { style.outline.color[3] = 0; }, style => { style.outline.widthPx = 4; },
    style => { style.hoverScale = 1; }]) {
    const entity = structuredClone(publicFacts.entity);
    entity.markerStyle = structuredClone(markerStyleBaseline.resolvedStyle);
    change(entity.markerStyle);
    assert.throws(() => assertPreservedEntity(entity), /resolved outline/);
  }
});
