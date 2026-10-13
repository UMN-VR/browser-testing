import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CAMPUS_ROUTES, CAMPUS_TAB_IDS, CROSS_CAMPUS_DIRECTIONS, LEGACY } from './expectations.mjs';
import markerStyleBaseline from './marker-style-baseline.json' with { type: 'json' };

const ENTITY_FACT_KEYS = ['id', 'type', 'assetId', 'title', 'description', 'capture', 'imagePose', 'marker', 'initialView', 'extensions'];
const ASSET_FACT_KEYS = ['id', 'revision', 'type', 'colorSpace', 'alpha', 'attribution'];
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  return value;
}
function selected(value, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
}
export function applicationFactsSha256(value) {
  return createHash('sha256').update(JSON.stringify(ordered(value)), 'utf8').digest('hex');
}
export function exactBytesSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function expectedIds(route) {
  return route === 'twin-cities' ? LEGACY.entityOrder : LEGACY.membership[route];
}

function assertMarkerStyleBaseline() {
  assert.deepEqual(markerStyleBaseline.source, LEGACY.source, 'Marker-style measurement is not bound to the original authored scene');
  assert.equal(markerStyleBaseline.entityCount, LEGACY.entityOrder.length);
  assert.equal(markerStyleBaseline.individualMarkerStyleCount, 0);
}

/** Application appearance facts only; the shared checker owns marker-style validation. */
function assertEffectiveMarkerStyle(entity, sceneMarkerStyle) {
  assertMarkerStyleBaseline();
  const ownStyle = entity.marker?.style;
  assert.ok(sceneMarkerStyle && typeof sceneMarkerStyle === 'object' && !Array.isArray(sceneMarkerStyle),
    `${entity.id}: inherited marker style must be an authored record`);
  if (Object.hasOwn(entity.marker, 'style')) {
    assert.ok(ownStyle && typeof ownStyle === 'object' && !Array.isArray(ownStyle),
      `${entity.id}: materialized marker style must be an authored record`);
  }
  const effective = { ...sceneMarkerStyle, ...(ownStyle === undefined ? {} : ownStyle) };
  assert.deepEqual(effective, markerStyleBaseline.authoredRootStyle,
    `${entity.id}: effective inherited outline, hover or marker style changed`);
  if (Object.hasOwn(entity, 'markerStyle')) {
    assert.deepEqual(entity.markerStyle, markerStyleBaseline.resolvedStyle,
      `${entity.id}: resolved outline, hover or marker style changed`);
  }
}

/** Application provenance assertions. The shared Scenes checker validates scene/image formats. */
export function assertPreservedEntity(entity, { sceneMarkerStyle = markerStyleBaseline.authoredRootStyle } = {}) {
  const expected = LEGACY.entities.find(row => row.id === entity.id);
  assert.ok(expected, `Unknown campus entity ${entity.id}`);
  assertEffectiveMarkerStyle(entity, sceneMarkerStyle);
  const facts = selected(entity, ENTITY_FACT_KEYS);
  if (Object.hasOwn(entity.marker, 'style')) {
    // The measured original has no per-marker style. Remove only a verified
    // equivalent materialization; all placement and provenance remain hashed.
    facts.marker = { ...entity.marker };
    delete facts.marker.style;
  }
  assert.equal(applicationFactsSha256(facts), expected.metadataSha256,
    `${entity.id}: captions, description, placement, unknown height/north or provenance changed`);
  assert.equal(entity.capture.height, null, `${entity.id}: unknown capture height was invented`);
  assert.equal(entity.imagePose.aligned, false, `${entity.id}: unknown north was marked aligned`);
}
export function assertPreservedAsset(asset, { representations = true } = {}) {
  const expected = LEGACY.assets.find(row => row.id === asset.id);
  assert.ok(expected, `Unknown campus asset ${asset.id}`);
  assert.equal(applicationFactsSha256(selected(asset, ASSET_FACT_KEYS)), expected.metadataSha256,
    `${asset.id}: original image identity, revision or rights notice changed`);
  if (representations) {
    const cells = asset.representations.filter(record => record.extensions?.['foss-earth.preview-sheets'])
      .map(record => ({ representation: record.id, cell: record.extensions['foss-earth.preview-sheets'] }));
    assert.deepEqual(cells, expected.previewCells, `${asset.id}: shared preview-sheet cell identity changed`);
  }
}

/** Call only on public-producer output already accepted by the shared Scenes tools. */
export function assertCampusDocument(route, document) {
  const spec = CAMPUS_ROUTES.find(row => row.id === route);
  assert.ok(spec?.sceneId, 'A content assertion needs an actual campus route');
  assert.equal(document.id, spec.sceneId);
  assert.deepEqual(document.entities.map(entity => entity.id), expectedIds(route), `${route}: authored membership/order changed`);
  assert.equal(document.entities.length, spec.count);
  assert.deepEqual(document.assets.map(asset => asset.id), expectedIds(route), `${route}: selected image membership/order changed`);
  for (const entity of document.entities) assertPreservedEntity(entity, { sceneMarkerStyle: document.markerStyle ?? {} });
  for (const asset of document.assets) assertPreservedAsset(asset);
  if (route === 'twin-cities') {
    const links = document.entities.flatMap(entity => (entity.links ?? []).map(originalLink => ({ sourceEntityId: entity.id, originalLink })));
    assert.deepEqual(links, LEGACY.links, 'All134 original combined links and directions must survive');
    assert.equal(links.length, 134);
    assert.deepEqual(document.groups.map(group => ({ id: group.id, sha256: applicationFactsSha256(group) })), LEGACY.groups,
      'Authored group order and mixed retired group changed');
  }
}

/** Producer navigation observations must be bound to the actual compiled child output. */
export function assertChildNavigation(route, observed) {
  assert.ok(route === 'minneapolis' || route === 'st-paul');
  const ids = new Set(expectedIds(route));
  const expected = LEGACY.links.filter(row => ids.has(row.sourceEntityId));
  assert.deepEqual(observed.map(row => ({ sourceEntityId: row.sourceEntityId, originalLink: row.originalLink })), expected,
    `${route}: an original link was removed, reordered or relabelled`);
  const cross = observed.filter(row => !ids.has(row.originalLink.target));
  assert.equal(cross.length, 2, `${route}: both authored cross-campus directions need a mapping`);
  for (const row of cross) {
    const match = CROSS_CAMPUS_DIRECTIONS.find(item => item.source === row.sourceEntityId && item.link === row.originalLink.id);
    assert.ok(match);
    assert.equal(row.originalLink.target, match.target);
    assert.equal(row.mode, 'external-scene-route');
    assert.equal(row.targetRoute, match.route);
    assert.equal(row.targetPanoramaId, match.target);
    assert.equal(row.targetResolutionObserved, true, 'An intended mapping is not proof of reaching its panorama');
  }
}

export function assertSelectorSnapshot(snapshot) {
  assert.equal(snapshot.path, '/tour/');
  assert.equal(snapshot.mainCount, 1);
  assert.equal(snapshot.navCount, 1);
  assert.match(snapshot.heading, /campus tour/i);
  assert.equal(snapshot.skipTarget, 'campus-tours');
  assert.equal(snapshot.scriptCount, 0, 'The flat selector must remain usable without application JavaScript');
  assert.equal(snapshot.inlineHandlers, 0);
  assert.equal(snapshot.javascriptURLs, 0);
  assert.equal(snapshot.canvasCount, 0);
  assert.deepEqual(snapshot.cards.map(card => card.path), CAMPUS_ROUTES.slice(1).map(route => route.path));
  for (const card of snapshot.cards) {
    assert.equal(card.flat, true, 'Selector cards must be direct flat link/list entries');
    assert.equal(card.nestedLinks, 0);
    assert.ok(card.label.trim() && card.description.trim(), 'Each tour needs accessible title and summary');
    assert.equal(card.imageCount, 1);
    assert.ok(card.image.alt.trim(), 'Each selector photograph needs a description');
    assert.equal(card.image.complete, true, 'A missing photograph is not accepted');
    assert.ok(card.image.naturalWidth > 0);
  }
  assert.match(snapshot.text, /Regents of the University of Minnesota/);
  assert.match(snapshot.text, /OpenStreetMap contributors/);
}

export function assertRuntimeSnapshot(route, snapshot, requestedBackend) {
  const spec = CAMPUS_ROUTES.find(row => row.id === route);
  assert.ok(spec?.sceneId);
  assert.equal(snapshot.runtimeStarted, true);
  assert.equal(snapshot.currentSceneId, spec.sceneId);
  assert.deepEqual(snapshot.entityIds, expectedIds(route));
  assert.equal(snapshot.backend.actual, requestedBackend, 'Requested backend cannot silently fall back');
  assert.ok(snapshot.backend.browserProduct && snapshot.backend.engineVersion, 'Record actual browser and renderer');
  assert.ok(['hardware', 'software', 'unknown'].includes(snapshot.backend.deviceKind), 'Do not invent GPU identity');
  assert.deepEqual([...snapshot.configuredTabs].sort(), [...CAMPUS_TAB_IDS].sort());
  assert.deepEqual(snapshot.authorities, { runtimes: 1, viewers: 1, schedulers: 1, brokers: 1, uploaders: 1 });
  assert.equal(snapshot.devActivated, false, 'Ordinary startup must not activate Dev');
  for (const id of CAMPUS_TAB_IDS) {
    const proof = snapshot.tabProofs.find(row => row.id === id);
    assert.ok(proof, `Missing actual tab proof: ${id}`);
    assert.ok(proof.accessibleLabel && proof.renderedText, `${id}: empty content is not accepted`);
    assert.equal(proof.keyboardOpened, true, `${id}: missing keyboard open proof`);
    assert.equal(proof.keyboardClosed, true, `${id}: missing keyboard close proof`);
    assert.equal(proof.focusRestored, true, `${id}: missing focus restoration proof`);
    assert.equal(proof.inputMechanism, 'native-browser-input', 'Synthetic DOM keyboard dispatch is not native-input qualification');
  }
  assert.equal(snapshot.accessibilityClaim, 'retained-content-and-tested-controls', 'Do not claim future accessibility work is complete');
}

export function assertReportOnly(snapshot) {
  assert.equal(snapshot.runtimeStarted, false, 'Report-only must stop before native runtime startup');
  assert.equal(snapshot.viewerCreated, false);
  assert.equal(snapshot.devActivated, false, '?report=1&dev=1 must not activate Dev');
  assert.equal(snapshot.canvasCount, 0);
  assert.match(snapshot.visibleText, /bug report/i);
}

export function assertWorkerAndUpdate(snapshot, origin) {
  assert.equal(snapshot.mode, 'live');
  assert.equal(snapshot.controlling, true, 'No controlling worker means no worker acceptance');
  assert.equal(snapshot.registrations.length, 1);
  assert.equal(snapshot.registrations[0].scope, new URL('/', origin).href);
  assert.equal(snapshot.registrations[0].scriptURL, new URL('/foss-earth-sw.js', origin).href);
  assert.equal(snapshot.legacyScene.sha256, LEGACY.source.sha256);
  assert.equal(snapshot.legacyScene.sizeBytes, LEGACY.source.sizeBytes);
  assert.equal(snapshot.oldResource.readableAfterUpdateCheck, true, 'Older immutable resources must remain readable');
  assert.ok(snapshot.oldResource.url && snapshot.oldResource.sha256);
  assert.match(snapshot.oldResource.sha256, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.oldResource.observedAfterCheckSha256, snapshot.oldResource.sha256, 'An old URL must still return its original bytes');
  const update = snapshot.update;
  assert.ok(update.beforeAskBuild && update.publishedBuild, 'Observe actual loaded and published build stamps');
  assert.notEqual(update.beforeAskBuild, update.publishedBuild, 'The controlled update fixture needs a real newer compiled version');
  assert.equal(update.beforeAskBuild, update.afterAskBuild, 'Update detection must not replace the loaded application');
  assert.equal(update.reloadCountBeforeAsk, 0);
  assert.equal(update.reloadCountAfterAsk, 0, 'Update checking must be report-only');
  assert.equal(update.reloadActionAvailable, true);
  assert.equal(update.reloadCountAfterExplicitAction, 1, 'Only the explicit Reload action changes the loaded page');
  assert.equal(update.afterExplicitReloadBuild, update.publishedBuild);
}

export function assertCompleteBrowserEvidence(evidence, requestedBrowser) {
  assert.equal(evidence.facts.browser, requestedBrowser);
  assert.equal(evidence.facts.mode, 'live');
  assert.equal(evidence.facts.workers, true);
  assert.equal(evidence.dropped.console, 0, 'Incomplete console evidence is not accepted');
  assert.equal(evidence.dropped.network, 0, 'Incomplete network evidence is not accepted');
  assert.equal(evidence.dropped.lifecycle, 0, 'Incomplete lifecycle evidence is not accepted');
  assert.equal(evidence.console.filter(row => row.level === 'error').length, 0, 'Browser console errors need causal repair');
  assert.equal(evidence.network.filter(row => ['failure', 'responder-error', 'interception-error'].includes(row.phase)).length, 0,
    'Failed compiled route/resource requests are not accepted');
  assert.equal(evidence.network.filter(row => row.status >= 400).length, 0, 'HTTP resource failures are not accepted');
  assert.ok(evidence.lifecycle.some(row => row.event === 'exit' && row.code === 0 && row.signal === null), 'A closed protocol is not proof of owned browser exit');
  assert.equal(evidence.lifecycle.filter(row => ['graceful-close-timeout', 'signal', 'forced-close', 'event-listener-error'].includes(row.event)).length,
    0, 'Forced cleanup or incomplete event handling cannot qualify a browser run');
}
