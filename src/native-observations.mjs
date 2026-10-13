import assert from 'node:assert/strict';
import { CAMPUS_TAB_IDS, CROSS_CAMPUS_DIRECTIONS, LEGACY } from './expectations.mjs';
import { exactBytesSha256 } from './assertions.mjs';

const READ = 'window.__UMNVR_CAMPUS__?.readRuntime()';
const LABELS = { location: 'Location', controls: 'Controls', interface: 'Interface', settings: 'Settings', map: 'Map', renderer: 'Renderer', sky: 'Sky', time: 'Date and time', scenes: 'Scenes', about: 'About', 'bug-report': 'Bug report', 'panorama-settings': '360 image settings' };
const GLOBE = CAMPUS_TAB_IDS.filter(id => !['panorama', 'panorama-settings'].includes(id));
const PANORAMA = CAMPUS_TAB_IDS.filter(id => !['location', 'map', 'sky', 'time'].includes(id));
const visibleExpression = `e => Boolean(e && e.isConnected && !e.hidden && e.getBoundingClientRect().width && e.getBoundingClientRect().height && getComputedStyle(e).visibility !== 'hidden')`;
const panelExpression = id => `document.querySelector('[data-campus-panel="${id}"]')`;
const buttonExpression = (id, text) => `[...(${panelExpression(id)})?.querySelectorAll('button') ?? []].find(e => e.textContent.trim() === ${JSON.stringify(text)} && (${visibleExpression})(e))`;

/** The application driver borrows the public page. All state comes from compiled native authorities and actual DOM. */
export function createCampusObservationPorts(fixture, options) {
  assert.equal(typeof options.publishUpdate, 'function');
  assert.match(options.oldResource?.sha256 ?? '', /^[a-f0-9]{64}$/);
  const commandMs = fixture.pageOptions.timeouts.commandMs;
  assert.ok(Array.isArray(options.installedArtifactPins) && options.installedArtifactPins.length >= 4, 'Actual installed About artifact expectations required');
  async function wait(page, expression, label) {
    const deadline = Date.now() + commandMs;
    while (Date.now() < deadline) {
      if (await page.evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out observing ${label}`);
  }
  async function revealAndFocus(page, expression) {
    for (let count = 0; count < 8; count++) {
      const state = await page.evaluate(`(() => { const e = ${expression}; if (!e) return { found: false }; const closed = []; for (let p = e.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) closed.push(p); const outer = closed.at(-1); if (outer) { outer.querySelector(':scope > summary').focus(); return { found: true, opened: false }; } e.scrollIntoView({ block: 'nearest' }); e.focus(); return { found: true, opened: true, focused: document.activeElement === e, visible: (${visibleExpression})(e), disabled: e.disabled === true }; })()`);
      assert.equal(state.found, true, 'A real application control is required');
      if (!state.opened) { await page.pressKey('Enter'); continue; }
      assert.equal(state.visible, true); assert.equal(state.focused, true); assert.equal(state.disabled, false);
      return;
    }
    throw new Error('Application control has too many unopened ancestor sections');
  }
  async function activate(page, expression, key = 'Enter') {
    assert.equal(typeof page.pressKey, 'function', 'The qualified native keyboard helper is required');
    await revealAndFocus(page, expression);
    await page.pressKey(key);
  }
  const labelExpression = id => id === 'panorama' ? `${READ}?.activeImage ? '360: ' + ${READ}.activeImage.title : '360'` : JSON.stringify(LABELS[id]);
  async function open(page, id) {
    const label = labelExpression(id);
    const closeQuery = `[...document.querySelectorAll('.foss-earth-tab-close')].find(e => e.getAttribute('aria-label') === 'Close ' + (${label}) + ' tab')`;
    const alreadyOpen = await page.evaluate(`Boolean(${closeQuery})`);
    await activate(page, alreadyOpen ? `(${closeQuery})?.parentElement.querySelector('.foss-earth-tab-button')` : `document.querySelector('[data-campus-tab="${id}"]')`);
    await wait(page, `(${visibleExpression})(${closeQuery})`, `${id} panel`);
    const proof = await page.evaluate(`(() => { const close = ${closeQuery}; const panel = ${panelExpression(id)}; const dock = close?.closest('.foss-earth-dock-panel'); return { panelVisible: (${visibleExpression})(panel), belongsToSelectedDock: Boolean(dock?.contains(panel)), id: ${JSON.stringify(id)}, accessibleLabel: close?.getAttribute('aria-label') ?? '', renderedText: panel?.innerText.trim() ?? '', closeLabel: close?.getAttribute('aria-label') ?? '' }; })()`);
    assert.equal(proof.panelVisible, true); assert.equal(proof.belongsToSelectedDock, true);
    return proof;
  }
  async function traverseLaunchers(page, expected) {
    await page.evaluate("document.querySelector('canvas').focus()");
    const forward = [];
    for (let step = 0; step < 100 && forward.length < expected.length; step++) {
      await page.pressKey('Tab');
      const id = await page.evaluate("document.activeElement?.dataset.campusTab ?? null");
      if (id) forward.push(id);
    }
    assert.deepEqual(forward, expected, 'Native Tab reaches every context launcher in its owned order');
    const reverse = [await page.evaluate('document.activeElement.dataset.campusTab')];
    for (let step = 0; step < 100 && reverse.length < expected.length; step++) {
      await page.pressKey('ShiftTab');
      const id = await page.evaluate("document.activeElement?.dataset.campusTab ?? null");
      if (id) reverse.push(id);
    }
    assert.deepEqual(reverse, [...expected].reverse(), 'Native ShiftTab returns through the same controls');
    const visible = await page.evaluate(`[...document.querySelectorAll('[data-campus-tab]')].filter(e => (${visibleExpression})(e)).map(e => e.dataset.campusTab)`);
    assert.deepEqual(visible, expected);
    return { forward, reverse, visible, inputMechanism: 'native-browser-input' };
  }
  async function close(page, proof) {
    await activate(page, `document.querySelector('[aria-label=' + ${JSON.stringify(JSON.stringify(proof.closeLabel))} + ']')`);
    await wait(page, `document.activeElement?.tagName === 'CANVAS'`, `${proof.id} returned focus`);
    const closed = await page.evaluate(`!Boolean([...document.querySelectorAll('.foss-earth-tab-close')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(proof.closeLabel)}))`);
    assert.equal(closed, true);
    return { ...proof, keyboardOpened: true, keyboardClosed: closed, focusRestored: await page.evaluate("document.activeElement?.tagName === 'CANVAS'"), inputMechanism: 'native-browser-input' };
  }
  async function enter(page, id) {
    await open(page, 'scenes');
    await activate(page, `document.querySelector('button[data-panorama=' + ${JSON.stringify(JSON.stringify(id))} + ']')`);
    await wait(page, `${READ}?.sceneState?.status?.phase === 'immersive' && ${READ}.sceneState.status.active === ${JSON.stringify(id)}`, `entered actual panorama ${id}`);
    // The shared workspace opens its panorama context automatically.
    await wait(page, `Boolean([...document.querySelectorAll('.foss-earth-tab-button')].find(e => e.textContent === '360: ' + ${READ}.activeImage?.title))`, 'dynamic 360 title');
  }
  async function ready(page, route) {
    if (route.id === 'selector') return wait(page, `document.readyState === 'complete' && document.querySelectorAll('nav[aria-label="Campus tours"] img').length === 3 && document.querySelectorAll('nav[aria-label="Campus tours"] a').length === 3 && [...document.querySelectorAll('nav[aria-label="Campus tours"] img')].every(e => e.complete && e.naturalWidth > 0)`, 'selector photographs');
    await wait(page, `${READ}?.sceneState?.status?.sceneId === ${JSON.stringify(route.sceneId)} && ${READ}.sceneState.loading === null`, `compiled ${route.id} native scene`);
    const state = await page.evaluate(READ);
    assert.deepEqual(state.sceneState.errors, []);
    assert.equal(state.sceneState.status.renderingAvailable, true);
  }
  async function actualEntryBundle(page) {
    const observed = await page.evaluate(`(() => {
      const scripts = [...document.querySelectorAll('script[type="module"][src]')];
      return scripts.map(script => {
        const url = new URL(script.getAttribute('src'), location.href);
        return { url: url.href, origin: url.origin, pageOrigin: location.origin,
          basename: url.pathname.split('/').at(-1),
          resourceEntries: performance.getEntriesByName(url.href).map(entry => ({ name: entry.name, entryType: entry.entryType, initiatorType: entry.initiatorType })) };
      });
    })()`);
    assert.equal(observed.length, 1, 'The compiled route has one actual sourced entry module');
    const entry = observed[0];
    assert.equal(entry.origin, entry.pageOrigin, 'The actual compiled entry shares the route origin');
    assert.match(entry.basename ?? '', /-[A-Za-z0-9_-]{8,}\.js$/, 'The loaded compiled entry has its actual Vite hashed filename');
    assert.ok(entry.resourceEntries.some(row => row.entryType === 'resource'), 'The browser actually loaded the named entry module');
    return entry;
  }
  async function context(page, ids, proofs) {
    for (const id of ids) {
      const proof = await open(page, id);
      assert.ok(proof.accessibleLabel && proof.renderedText, `Actual ${id} content must be visible`);
      if (id === 'about') {
        const actualEntry = await actualEntryBundle(page);
        const bundleLines = await page.evaluate(`[...document.querySelectorAll('[data-campus-panel="about"] .foss-earth-about__app .foss-earth-about__line')].filter(e => (${visibleExpression})(e) && e.textContent.startsWith('Bundle: ')).map(e => e.textContent)`);
        assert.deepEqual(bundleLines, [`Bundle: ${actualEntry.basename}`], 'The selected visible About panel names the actual loaded compiled bundle');
        proof.bundle = { actualEntry, displayedLine: bundleLines[0] };
        const state = await page.evaluate(READ);
        assert.ok(state.installed, 'About uses the actual Vite installed manifest');
        const flatten = part => [part, ...(part.parts ?? []).flatMap(flatten)];
        const installed = flatten(state.installed.app);
        for (const pin of options.installedArtifactPins) {
          const actual = installed.find(part => part.name === pin.package && !part.listedAbove);
          assert.ok(actual, `Actual About manifest must name installed ${pin.package}`);
          assert.equal(actual.version, pin.version); assert.equal(actual.commit, pin.sourceIdentity);
          assert.equal(actual.dirty ?? false, pin.dirty); assert.equal(actual.artifact?.sha256, pin.archiveSha256);
        }
        proof.installed = state.installed;
        proof.release = state.release;
      }
      proofs.push(await close(page, proof));
    }
  }
  async function canvasPoint(page) {
    return page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: Math.floor(r.left + r.width * .5), y: Math.floor(r.top + r.height * .4), width: r.width, height: r.height }; })()`);
  }
  async function exerciseNativePointer(page) {
    assert.equal(typeof page.clickAt, 'function'); assert.equal(typeof page.dragAt, 'function');
    const point = await canvasPoint(page), before = await page.evaluate(READ);
    await page.dragAt(point.x, point.y, point.x + 40, point.y + 16, { steps: 5, durationMs: 250 });
    await wait(page, `JSON.stringify(${READ}.camera) !== ${JSON.stringify(JSON.stringify(before.camera))}`, 'native globe camera drag');
    const afterDrag = await page.evaluate(READ);
    const hit = await page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); for (let iy = 1; iy < 12; iy++) for (let ix = 1; ix < 18; ix++) { const x = Math.floor(r.left + r.width * ix / 18), y = Math.floor(r.top + r.height * iy / 12); const ids = window.__UMNVR_CAMPUS__.pickPanoramasAt(x, y); if (ids.length) return { x, y, ids }; } return null; })()`);
    assert.ok(hit, 'At least one actually published overview orb must be hit-testable');
    await page.clickAt(hit.x, hit.y);
    await wait(page, `${READ}.sceneState.status.phase === 'immersive' && ${READ}.sceneState.status.active === ${JSON.stringify(hit.ids[0])}`, 'native rendered orb picking and entry');
    const entered = await page.evaluate(READ);
    const glidePanel = await open(page, 'panorama-settings');
    const glideControl = `document.querySelector('[data-campus-panel="panorama-settings"] [data-parameter="scene.panorama.inertiaHalfLife"] input[type="range"]')`;
    await revealAndFocus(page, glideControl); await page.pressKey('End');
    const glideMilliseconds = Number(await page.evaluate(`(${glideControl}).value`));
    assert.ok(glideMilliseconds > 0, 'Real Look glide control is enabled for the native momentum check');
    await close(page, glidePanel);
    const lookBefore = (await page.evaluate(READ)).viewer.view;
    await page.dragAt(point.x, point.y, point.x + 70, point.y - 12, { steps: 8, durationMs: 300 });
    await wait(page, `JSON.stringify(${READ}.viewer.view) !== ${JSON.stringify(JSON.stringify(lookBefore))}`, 'native panorama look drag');
    const release = await page.evaluate(READ);
    await new Promise(resolve => setTimeout(resolve, 100));
    const momentum = await page.evaluate(READ);
    assert.notDeepEqual(momentum.viewer.view, release.viewer.view, 'Actual look momentum continues after the native drag before interruption');
    // Native pointerdown cancels the owner's look glide. No test-specific runtime setter.
    await page.clickAt(point.x, point.y);
    const interrupted = await page.evaluate(READ);
    await new Promise(resolve => setTimeout(resolve, 150));
    const settled = await page.evaluate(READ);
    assert.deepEqual(settled.viewer.view, interrupted.viewer.view, 'Native input stops look momentum');
    await page.evaluate("document.querySelector('canvas').focus()"); await page.pressKey('Escape');
    await wait(page, `${READ}.sceneState.status.phase === 'overview'`, 'native Escape exit');
    assert.equal(await page.evaluate("document.activeElement?.tagName === 'CANVAS'"), true);
    return { nativeInput: true, globe: { before: before.camera, afterDrag: afterDrag.camera },
      orb: { actualHit: hit, entered: entered.viewer.active, title: entered.activeImage.title },
      look: { glideMilliseconds, before: lookBefore, afterDrag: release.viewer.view, after100ms: momentum.viewer.view,
        afterNativeInterrupt: interrupted.viewer.view, after150ms: settled.viewer.view }, escapeExited: true, focusRestored: true };
  }
  async function exerciseRepresentations(page, route, id) {
    const readings = [];
    for (const [value, representation, projection, warp] of [
      ['equi-angular-tiles', 'eac-tiles', 'tiled-cube', 'equi-angular'],
      ['cube-tiles', 'cube-tiles', 'tiled-cube', 'gnomonic'],
      ['whole', 'whole-6144', 'equirectangular', null],
    ]) {
      await open(page, 'panorama-settings');
      await activate(page, `document.querySelector('[data-campus-panel="panorama-settings"] [data-parameter="scene.panorama.representation"] input[value="${value}"]')`, 'Space');
      await activate(page, `document.querySelector('[data-campus-panel="panorama-settings"] [data-parameter="scene.panorama.immersionDensity"] input[value="off"]')`, 'Space');
      const detailPanel = await open(page, 'panorama');
      await revealAndFocus(page, `document.querySelector('[data-campus-panel="panorama"] [data-parameter="scene.panorama.immersionWidth"] input[type="range"]')`);
      await page.pressKey('End');
      await wait(page, `${READ}.viewer.immersionDetail?.representation === ${JSON.stringify(representation)} && ${READ}.viewer.immersionDetail.loading === null`, `actual ${representation} display`);
      const state = await page.evaluate(READ), record = state.activeImage.asset.representations.find(r => r.id === representation);
      assert.ok(record); assert.equal(record.projection, projection);
      if (warp) assert.equal(record.warp, warp);
      if (representation === 'whole-6144') { assert.equal(record.width, 6144); assert.equal(record.height, 3072); }
      readings.push({ preference: value, status: state.viewer.immersionDetail, shownSources: state.activeSources,
        actualAssetRevision: state.activeImage.asset.revision, record, visibleDetail: detailPanel.renderedText });
    }
    const state = await page.evaluate(READ), asset = state.activeImage.asset;
    const beforeStore = await page.evaluate('window.__UMNVR_CAMPUS__.inspectImages()');
    const groupId = `${asset.id}@${asset.revision}/whole-6144`;
    assert.equal(beforeStore.available, true, 'Actual image revision cache available');
    assert.ok(beforeStore.groups.some(group => group.id === groupId), 'Saved representation group binds actual asset revision');
    const beforeRequests = page.captureEvidence().network.filter(row => row.phase === 'request' && row.url.includes(`/media/${asset.id}/`)).length;
    await page.navigate(route.entryURL); await ready(page, route); await enter(page, id);
    await wait(page, `${READ}.viewer.immersionDetail?.representation === 'whole-6144' && ${READ}.viewer.immersionDetail.loading === null`, 'same immutable whole photograph after new native session');
    const reusedStore = await page.evaluate('window.__UMNVR_CAMPUS__.inspectImages()');
    assert.ok(reusedStore.reused.files > 0 && reusedStore.reused.bytes > 0, 'Actual IndexedDB encoded image reuse, independent of App worker cache');
    assert.ok(reusedStore.groups.some(group => group.id === groupId));
    const repeatAsset = (await page.evaluate(READ)).activeImage.asset;
    assert.equal(repeatAsset.id, asset.id); assert.equal(repeatAsset.revision, asset.revision);
    const afterRequests = page.captureEvidence().network.filter(row => row.phase === 'request' && row.url.includes(`/media/${asset.id}/`)).length;
    // Toggle the real shared setting then create a new session; first previews must come from original face resources.
    await open(page, 'scenes');
    await activate(page, `document.querySelector('[data-campus-panel="scenes"] [data-parameter="scene.panorama.previewSheets"] input')`, 'Space');
    const fallbackStart = page.captureEvidence().network.length;
    await page.navigate(route.entryURL); await ready(page, route);
    await wait(page, `${READ}.sceneState.status.entries.some(e => e.preview === 'ready')`, 'original-face preview fallback');
    const fallbackRequests = page.captureEvidence().network.slice(fallbackStart).filter(row => row.phase === 'request');
    assert.ok(fallbackRequests.some(row => /\/preview-64\/(px|nx|py|ny|pz|nz)\.jpg(?:$|\?)/.test(row.url)), 'Disabling sheets obtains original preview faces');
    const sheetRequests = page.captureEvidence().network.filter(row => row.phase === 'request' && new URL(row.url).pathname === new URL(LEGACY.sharedSheet.url, fixture.origin).pathname);
    assert.ok(sheetRequests.length > 0, 'Actual shared preview sheet was requested before original-face fallback');
    await open(page, 'scenes');
    await activate(page, `document.querySelector('[data-campus-panel="scenes"] [data-parameter="scene.panorama.previewSheets"] input')`, 'Space');
    await enter(page, id);
    return { readings, revisionCache: { assetId: asset.id, revision: asset.revision, groupId, beforeStore, reusedStore, requestsDuringRepeat: afterRequests - beforeRequests },
      previewSheet: { actualRequestedURL: sheetRequests[0].url, sourceSha256: LEGACY.sharedSheet.sha256 }, originalFaceFallback: fallbackRequests.filter(row => /\/preview-64\//.test(row.url)) };
  }
  async function exercisePersistenceAndReport(page, route) {
    const before = (await page.evaluate(READ)).interfaceTheme;
    const panel = await open(page, 'interface');
    await revealAndFocus(page, `document.querySelector('[data-campus-panel="interface"] [data-parameter="interface.theme"] input[type="range"]')`);
    await page.pressKey('End');
    let changed = (await page.evaluate(READ)).interfaceTheme;
    if (changed === before) { await page.pressKey('Home'); changed = (await page.evaluate(READ)).interfaceTheme; }
    assert.notEqual(changed, before);
    await close(page, panel);
    await page.navigate(route.entryURL); await ready(page, route);
    const afterReload = (await page.evaluate(READ)).interfaceTheme;
    assert.equal(afterReload, changed, 'The real settings registry persisted native UI change');
    const settings = await open(page, 'settings');
    await activate(page, buttonExpression('settings', 'Copy report'));
    await wait(page, "Boolean(document.querySelector('[data-campus-panel=\"settings\"] textarea[aria-label=\"The report\"]')?.value)", 'actual copied/manual report text');
    const report = await page.evaluate(`(() => { const e = document.querySelector('[data-campus-panel="settings"] textarea[aria-label="The report"]'); return { text: e.value, visible: (${visibleExpression})(e), status: e.parentElement.querySelector('[role="status"]')?.innerText ?? '' }; })()`);
    assert.equal(report.visible, true); assert.ok(report.text.length > 200);
    assert.ok(report.text.includes('Campus') && report.text.includes('Renderer'));
    assert.ok(report.text.includes((await page.evaluate(READ)).backend.mode));
    const build = await page.evaluate("document.querySelector('meta[name=\"foss-earth-build\"]').content");
    assert.ok(report.text.includes(build));
    const actualEntry = await actualEntryBundle(page);
    const reportBuildLine = report.text.split('\n').find(line => line.startsWith('Build: '));
    assert.ok(reportBuildLine?.endsWith(` · bundle ${actualEntry.basename}`), 'The actual copied report names the loaded compiled entry bundle');
    await close(page, settings);
    return { persistence: { before, changed, afterReload }, report: { text: report.text, sha256: exactBytesSha256(Buffer.from(report.text)), visible: report.visible, copyResult: report.status,
      clipboardAllowed: /^Copied,/.test(report.status), manualTextAvailable: true, bundle: { actualEntry, reportBuildLine } } };
  }
  async function exerciseTabsAndReadRuntime(page, route) {
    const globeProofs = [], panoramaProofs = [];
    const globeTraversal = await traverseLaunchers(page, GLOBE);
    await context(page, GLOBE, globeProofs);
    const first = await page.evaluate(`${READ}.sceneState.status.entries.find(e => e.supported)?.id`);
    assert.ok(first);
    const pointer = await exerciseNativePointer(page);
    await enter(page, first);
    const projectionAndCache = await exerciseRepresentations(page, route, first);
    const entered = await page.evaluate(READ);
    assert.equal(entered.navigation?.inputContext, 'panorama');
    const dynamicTitle = `360: ${entered.activeImage.title}`;
    assert.equal(await page.evaluate(`Boolean([...document.querySelectorAll('.foss-earth-tab-button')].find(e => e.textContent === ${JSON.stringify(dynamicTitle)}))`), true);
    const panoramaTraversal = await traverseLaunchers(page, PANORAMA);
    // Close360 last: its actual close action exits the panorama.
    await context(page, [...PANORAMA.filter(id => id !== 'panorama'), 'panorama'], panoramaProofs);
    await wait(page, `${READ}.sceneState.status.phase === 'overview'`, '360 close returned to map');
    const persistenceAndReport = await exercisePersistenceAndReport(page, route);
    const state = await page.evaluate(READ);
    assert.equal(state.backend.fallbackReason, null);
    if (state.backend.actual !== 'webgpu') assert.match(state.backend.glVersion, /^WebGL [12]/);
    assert.equal(globeProofs.length, 11); assert.equal(panoramaProofs.length, 9);
    const combined = [...globeProofs, ...panoramaProofs];
    return { runtimeStarted: state.runtimeStarted, currentSceneId: state.sceneState.status.sceneId,
      entityIds: state.sceneState.status.entries.map(e => e.id), devActivated: state.devActivated,
      configuredTabs: [...new Set(combined.map(e => e.id))], backend: { ...state.backend, browserProduct: page.product },
      authorities: state.authorities, tabProofs: CAMPUS_TAB_IDS.map(id => combined.find(e => e.id === id)),
      contextProofs: { globe: globeProofs, panorama: panoramaProofs }, nativeTraversal: { globe: globeTraversal, panorama: panoramaTraversal }, dynamicTitle,
      pointer, projectionAndCache, persistenceAndReport,
      enteredInputContext: entered.navigation?.inputContext, exitedInputContext: state.navigation?.inputContext,
      accessibilityClaim: 'retained-content-and-tested-controls' };
  }
  async function readNavigation(page, route) {
    const text = await page.evaluate(`fetch(${JSON.stringify(new URL(route.contentURL, route.entryURL).href)}, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Scene HTTP ' + r.status); return r.text(); })`);
    assert.equal(exactBytesSha256(Buffer.from(text)), route.contentSha256);
    const document = JSON.parse(text);
    const ownIds = new Set(document.entities.map(e => e.id));
    const links = document.entities.flatMap(entity => (entity.links ?? []).map(link => {
      const originalLink = { ...link }; delete originalLink.externalDestination;
      return { sourceEntityId: entity.id, originalLink,
        mode: ownIds.has(link.target) ? 'internal-original-id' : 'external-scene-route', externalDestination: link.externalDestination };
    }));
    for (const row of links.filter(row => row.mode === 'external-scene-route')) {
      const registration = document.externalDestinations?.find(item => item.id === row.externalDestination);
      assert.ok(registration, 'The actual produced scene registers the external route');
      const expected = CROSS_CAMPUS_DIRECTIONS.find(item => item.source === row.sourceEntityId && item.link === row.originalLink.id);
      assert.ok(expected);
      await page.navigate(route.entryURL); await ready(page, route); await enter(page, row.sourceEntityId);
      await open(page, 'panorama');
      await activate(page, buttonExpression('panorama', row.originalLink.label));
      await wait(page, `location.pathname === ${JSON.stringify(expected.route)} && ${READ}?.sceneState?.status?.active === ${JSON.stringify(row.originalLink.target)} && ${READ}.sceneState.status.phase === 'immersive'`, 'native cross-campus arrival');
      row.targetRoute = await page.evaluate('location.pathname');
      row.targetPanoramaId = await page.evaluate(`${READ}.sceneState.status.active`);
      row.targetResolutionObserved = row.targetPanoramaId === row.originalLink.target;
    }
    await page.navigate(route.entryURL); await ready(page, route);
    return { producerReceiptSha256: route.navigationReceiptSha256, links };
  }
  async function readReportOnly(page) {
    await wait(page, `${READ} && document.querySelector('.foss-earth-report-only')`, 'actual report-only page');
    const state = await page.evaluate(READ);
    assert.equal(state.authorities, undefined, "Report-only never allocated the native authority closure");
    return { runtimeStarted: state.runtimeStarted, viewerCreated: state.viewerCreated, devActivated: state.devActivated,
      canvasCount: await page.evaluate("document.querySelectorAll('canvas').length"), visibleText: await page.evaluate('document.body.innerText') };
  }
  async function readPositiveDev(page, route) {
    await ready(page, route);
    assert.equal((await page.evaluate(READ)).devActivated, true);
    await activate(page, `[...document.querySelectorAll('[aria-label="Open new tab"], [aria-label="Open right panel"], [aria-label="Open left panel"]')].find(e => (${visibleExpression})(e))`);
    await activate(page, `[...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent.trim() === 'Dev')`);
    await wait(page, "Boolean(document.querySelector('[aria-label=\"Close Dev tab\"]'))", 'positive Dev tab');
    const visibleText = await page.evaluate(`(() => { const close = document.querySelector('[aria-label="Close Dev tab"]'); const body = close?.closest('.foss-earth-dock-panel')?.querySelector('.foss-earth-dock-panel-body'); if (!(${visibleExpression})(body)) return ''; return body.innerText; })()`);
    assert.ok(visibleText.trim());
    return { devActivated: (await page.evaluate(READ)).devActivated, canvasCount: await page.evaluate("document.querySelectorAll('canvas').length"), visibleText, keyboardOpened: true, inputMechanism: 'native-browser-input' };
  }
  async function exerciseWorkerUpdate(page, route) {
    await page.navigate(route.entryURL); await ready(page, route);
    await wait(page, "Boolean(navigator.serviceWorker?.controller)", 'actual controlling root worker');
    const beforeAskBuild = await page.evaluate("document.querySelector('meta[name=\"foss-earth-build\"]').content");
    await page.evaluate(`sessionStorage.setItem('umn-canonical-driver-pagehide', '0'); window.addEventListener('pagehide', () => sessionStorage.setItem('umn-canonical-driver-pagehide', String(Number(sessionStorage.getItem('umn-canonical-driver-pagehide')) + 1)), { once: true });`);
    const reloadCountBeforeAsk = Number(await page.evaluate("sessionStorage.getItem('umn-canonical-driver-pagehide')"));
    await options.publishUpdate();
    await open(page, 'settings');
    await activate(page, buttonExpression('settings', 'Ask now'));
    await wait(page, `${READ}.published.kind === 'older'`, 'shared watcher observed actual newer compiled page');
    const watched = await page.evaluate(READ);
    const afterAskBuild = await page.evaluate("document.querySelector('meta[name=\"foss-earth-build\"]').content");
    const reloadCountAfterAsk = Number(await page.evaluate("sessionStorage.getItem('umn-canonical-driver-pagehide')"));
    const reloadActionAvailable = await page.evaluate(`(${visibleExpression})(${buttonExpression('settings', 'Reload to use the published version')})`);
    const old = await page.evaluate(`fetch(${JSON.stringify(new URL(options.oldResource.url, fixture.origin).href)}, { cache: 'no-store' }).then(async r => ({ ok: r.ok, bytes: Array.from(new Uint8Array(await r.arrayBuffer())) }))`);
    const observedAfterCheckSha256 = exactBytesSha256(Uint8Array.from(old.bytes));
    assert.equal(observedAfterCheckSha256, options.oldResource.sha256);
    const legacy = await page.evaluate(`fetch(${JSON.stringify(new URL(LEGACY.source.url, fixture.origin).href)}, { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error('Legacy scene HTTP ' + r.status); return Array.from(new Uint8Array(await r.arrayBuffer())); })`);
    const registrations = await page.evaluate("navigator.serviceWorker.getRegistrations().then(rows => rows.map(r => ({ scope: r.scope, scriptURL: (r.active ?? r.waiting ?? r.installing)?.scriptURL })))");
    const controlling = await page.evaluate("Boolean(navigator.serviceWorker.controller)");
    await activate(page, buttonExpression('settings', 'Reload to use the published version'));
    await wait(page, `document.querySelector('meta[name="foss-earth-build"]')?.content === ${JSON.stringify(fixture.updateCandidate.buildStamp)} && ${READ}?.sceneState?.status?.sceneId === ${JSON.stringify(route.sceneId)}`, 'explicit reload to actual second compiled build');
    assert.equal(await page.evaluate("performance.getEntriesByType('navigation')[0]?.type"), 'reload');
    const workerBytes = await page.evaluate("fetch('/foss-earth-sw.js', { cache: 'no-store' }).then(r => r.arrayBuffer()).then(b => Array.from(new Uint8Array(b)))");
    assert.equal(exactBytesSha256(Uint8Array.from(workerBytes)), fixture.updateCandidate.workerSha256);
    await wait(page, `caches.open(${JSON.stringify(fixture.updateCandidate.cacheName)}).then(c => c.match(${JSON.stringify(fixture.updateCandidate.currentBundleURL)})).then(Boolean)`, 'actual newer worker retained newly listed compiled bundle');
    const keptNewBundle = await page.evaluate(`caches.open(${JSON.stringify(fixture.updateCandidate.cacheName)}).then(c => c.match(${JSON.stringify(fixture.updateCandidate.currentBundleURL)})).then(r => r.arrayBuffer()).then(b => Array.from(new Uint8Array(b)))`);
    assert.equal(exactBytesSha256(Uint8Array.from(keptNewBundle)), fixture.updateCandidate.currentBundleSha256);
    return { mode: page.facts.mode, controlling, registrations, buildSealSha256: fixture.compiled.workerBuildSealSha256,
      newerWorker: { sha256: fixture.updateCandidate.workerSha256, newlyCachedBundleURL: fixture.updateCandidate.currentBundleURL, newlyCachedBundleSha256: exactBytesSha256(Uint8Array.from(keptNewBundle)) },
      legacyScene: { sha256: exactBytesSha256(Uint8Array.from(legacy)), sizeBytes: legacy.length },
      oldResource: { ...options.oldResource, readableAfterUpdateCheck: old.ok, observedAfterCheckSha256 },
      update: { beforeAskBuild, afterAskBuild, publishedBuild: watched.published.published,
        reloadCountBeforeAsk, reloadCountAfterAsk, reloadActionAvailable,
        reloadCountAfterExplicitAction: Number(await page.evaluate("sessionStorage.getItem('umn-canonical-driver-pagehide')")),
        afterExplicitReloadBuild: await page.evaluate("document.querySelector('meta[name=\"foss-earth-build\"]').content") } };
  }
  return { ready, exerciseTabsAndReadRuntime, readNavigation, readReportOnly, readPositiveDev, exerciseWorkerUpdate,
    writeReceipt: options.writeReceipt, ...(options.writeScreenshot ? { writeScreenshot: options.writeScreenshot } : {}) };
}
