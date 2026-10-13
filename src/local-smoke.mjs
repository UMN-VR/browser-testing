/** First compiled Campus smoke. Application assertions only; lifecycle stays shared. */
import assert from "node:assert/strict";
import { CAMPUS_ROUTES, LEGACY, SHARED_HELPER } from "./expectations.mjs";
import { exactBytesSha256, assertSelectorSnapshot, assertCampusDocument, assertCompleteBrowserEvidence } from "./assertions.mjs";
import { assertFreshFixtureGrant } from "./fixtures.mjs";
import { SELECTOR_EXPRESSION, publicDocumentExpression } from "./probes.mjs";

const SHA = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40}$/;
const failure = error => ({ name: error?.name ?? "Error", message: String(error?.message ?? error) });
function seal(value, name) { assert.match(value ?? "", SHA, `${name}: exact measured SHA-256 is required`); }
function localURL(value, origin, name) {
  const url = new URL(value, origin);
  assert.equal(url.origin, new URL(origin).origin, `${name}: use the actual granted local compiled assembly`);
  assert.equal(url.username, ""); assert.equal(url.password, ""); assert.equal(url.hash, "");
  return url;
}

/** Data gate only. Hash-shaped data never qualifies the underlying compiled artifacts. */
export function createCompiledCampusSmokeInput(input) {
  assert.equal(input.format, "umn-campus-compiled-local-smoke");
  assert.equal(input.version, 1);
  assert.equal(input.inputStatus, "checked-compiled-candidate");
  assert.equal(input.synthetic, false, "Synthetic observations and fixtures cannot establish first local smoke");
  assert.equal(input.observations, undefined, "Runtime observations must be obtained from the opened actual page");
  const origin = new URL(input.origin);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname));
  assert.ok(["http:", "https:"].includes(origin.protocol));
  assert.equal(origin.pathname, "/"); assert.equal(origin.search, ""); assert.equal(origin.hash, "");
  assert.equal(Number(origin.port), input.localPort, "Name and bind the exact granted local port");
  assert.ok(Number.isSafeInteger(input.localPort) && input.localPort > 0 && input.localPort < 65536);
  assert.deepEqual(input.helper, SHARED_HELPER);
  assert.ok(["chrome", "firefox", "webkit"].includes(input.browser));
  assert.ok(input.profileDirectory, "Name the disposable owned profile in the grant");
  seal(input.grant?.scopeSha256, "grant scope");
  assert.ok(input.grant?.id && Number.isFinite(Date.parse(input.grant?.expiresAt)));
  assert.ok(Number.isSafeInteger(input.maxDurationMs) && input.maxDurationMs > 0 && input.maxDurationMs <= 300000,
    "First smoke needs a bounded wall deadline of at most 300000 ms");
  if (input.compiled?.assemblyReceiptSha256) seal(input.compiled.assemblyReceiptSha256, "compiled.assemblyReceiptSha256");
  else seal(input.compiled?.assemblyArchiveSha256, "compiled.assemblyReceiptSha256 or actual compiled.assemblyArchiveSha256");
  if (input.compiled?.assemblyArchiveSha256) seal(input.compiled.assemblyArchiveSha256, "optional actual compiled.assemblyArchiveSha256");
  for (const field of ["fullFileMapSha256", "verificationReceiptSha256", "appArchiveSha256", "workerBuildSealSha256"]) seal(input.compiled?.[field], `compiled.${field}`);
  assert.ok(input.compiled?.buildStamp);
  seal(input.nativeHost?.qualificationReceiptSha256, "native host qualification");
  seal(input.observationSourceSha256, "actual native observation driver source");
  assert.equal(input.contentProducer?.repository, "foss-earth/scenes");
  assert.match(input.contentProducer?.revision ?? "", REVISION);
  assert.notEqual(input.contentProducer.revision, "d58408d90542a73282d8bf544c54e0c9bf847b56");
  seal(input.contentProducer.archiveSha256, "checked Scenes archive");
  seal(input.contentProducer.qualificationReceiptSha256, "checked Scenes qualification");
  assert.equal(input.contentProducer.capability, "finite-pinned-child-composition");
  for (const field of ["releaseDescriptorSha256", "fullFileMapSha256", "verificationReceiptSha256"]) seal(input.media?.[field], `media.${field}`);
  assert.deepEqual(input.sharedSheet, LEGACY.sharedSheet);
  assert.deepEqual(input.routes?.map(row => row.id), CAMPUS_ROUTES.map(row => row.id));
  for (const route of input.routes) {
    const spec = CAMPUS_ROUTES.find(row => row.id === route.id);
    const entry = localURL(route.entryURL, input.origin, `${route.id}.entryURL`);
    assert.equal(entry.pathname, spec.path); assert.equal(entry.search, "");
    seal(route.htmlSha256, `${route.id} HTML`); seal(route.releaseDescriptorSha256, `${route.id} release descriptor`);
    if (!spec.sceneId) continue;
    assert.equal(route.sceneId, spec.sceneId);
    localURL(route.contentURL, input.origin, `${route.id}.contentURL`);
    seal(route.contentSha256, `${route.id} produced content`);
    assert.ok(Number.isSafeInteger(route.contentSizeBytes) && route.contentSizeBytes > 0);
    seal(route.navigationReceiptSha256, `${route.id} producer navigation`);
    const expected = route.id === "twin-cities" ? LEGACY.entityOrder : LEGACY.membership[route.id];
    assert.ok(expected.includes(route.panoramaId), `${route.id}: select an actual authored panorama`);
    assert.ok(Array.isArray(route.photographResources) && route.photographResources.length > 0 && route.photographResources.length <= 16,
      "Name at most 16 small actual measured image resources for the selected photograph");
    for (const file of route.photographResources) {
      localURL(file.url, input.origin, `${route.id} photograph URL`);
      seal(file.sha256, `${route.id} photograph digest`);
      assert.ok(Number.isSafeInteger(file.sizeBytes) && file.sizeBytes > 0 && file.sizeBytes <= 1048576,
        "First smoke verifies bounded existing preview/image bytes, not the complete corpus");
      assert.equal(file.assetId, route.panoramaId, "Bind photograph evidence to the selected authored image");
    }
  }
  assert.ok(input.pageOptions?.width > 0 && input.pageOptions?.height > 0);
  assert.equal(input.pageOptions.mode, "live"); assert.equal(input.pageOptions.workers, true);
  assert.equal(input.pageOptions.respond, undefined, "Interception cannot replace real resource startup");
  for (const name of ["startupMs", "commandMs", "closeMs", "exitMs"]) {
    const value = input.pageOptions.timeouts?.[name];
    assert.ok(Number.isFinite(value) && value > 0 && value <= 60000, `Bound helper ${name}`);
  }
  if (input.browser === "webkit") {
    assert.ok(input.pageOptions.playwright?.packageRoot && input.pageOptions.playwright?.browserCachePath);
    assert.equal(input.pageOptions.playwright.expectedVersion, "1.55.0");
    assert.equal(input.pageOptions.playwright.expectedCoreVersion, "1.55.0");
    assert.equal(input.pageOptions.playwright.expectedWebkitRevision, "2203");
  } else assert.ok(input.pageOptions.binary, "Use the explicitly named already installed browser binary");
  assertFreshFixtureGrant(input);
  return structuredClone(input);
}

export function assertCompiledCampusSmokePorts(input, ports) {
  assert.equal(ports?.synthetic, false, "The actual compiled driver must explicitly decline synthetic observations");
  assert.equal(ports?.sourceSha256, input.observationSourceSha256, "Bind the exact reviewed native driver source");
  for (const name of ["readSceneState", "writeScreenshot", "writeResourceEvidence", "writeReceipt"]) {
    assert.equal(typeof ports?.[name], "function", `Actual source-bound ${name} callback is required`);
  }
}

// These expressions exercise existing public Campus/Scenes/UI DOM. They neither
// construct an app nor set scene state, renderer state or readiness observations.
function domSnapshot() {
  const visible = node => Boolean(node && node.getClientRects().length);
  return {
    path: location.pathname,
    readyState: document.readyState,
    canvases: [...document.querySelectorAll("canvas")].filter(visible).map(canvas => ({ width: canvas.width, height: canvas.height })),
    selectorImages: [...document.querySelectorAll('nav[aria-label="Campus tours"] li > a img')].map(image => ({ complete: image.complete, naturalWidth: image.naturalWidth })),
    entries: [...document.querySelectorAll(".foss-earth-scene-entry")].map(entry => ({
      id: entry.dataset.panorama,
      title: entry.querySelector("button[data-panorama]")?.textContent?.trim() ?? "",
      state: entry.querySelector(".foss-earth-scene-entry__state")?.textContent?.trim() ?? "",
      disabled: entry.querySelector("button[data-panorama]")?.disabled ?? true,
    })),
    text: document.body?.textContent ?? "",
  };
}
const DOM = `(${domSnapshot.toString()})()`;
/** Canonical Campus route readiness, including commit/old-context navigation races. */
async function actualCampusDOM(page, routePath, ready, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await page.evaluate(DOM);
      if (value.path === routePath && ready(value)) return value;
    } catch (error) {
      // A navigation invalidates the old document context. Only that precise
      // transitional protocol failure is retried; app/protocol errors stay failures.
      if (!/execution context.*destroyed|cannot find.*context|no execution context|browsing context.*discarded/i.test(String(error?.message ?? error))) throw error;
    }
    if (Date.now() >= deadline) throw new Error(`Actual compiled Campus DOM at ${routePath} did not become ready within its bounded owner deadline`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
async function openActualScenesTab(page, timeoutMs) {
  const action = await page.evaluate(`(() => {
    const visible = node => Boolean(node && node.getClientRects().length);
    if ([...document.querySelectorAll('.foss-earth-scene-entry')].some(visible)) return 'already-visible';
    const direct = [...document.querySelectorAll('[data-campus-tab="scenes"]')].find(visible);
    if (direct) { direct.click(); return 'direct-campus-launcher'; }
    const existing = [...document.querySelectorAll('.foss-earth-tab-button')].find(node => visible(node) && node.textContent.trim() === 'Scenes');
    if (existing) { existing.click(); return 'existing-tab'; }
    const choice = [...document.querySelectorAll('[role="menuitem"]')].find(node => visible(node) && node.textContent.trim() === 'Scenes');
    if (choice) { choice.click(); return 'menu-item'; }
    const launcher = [...document.querySelectorAll('[aria-label="Open right panel"], [aria-label="Open new tab"], .foss-earth-panel-launcher-button')].find(visible);
    if (!launcher) throw new Error('No actual shared UI Scenes tab or launcher exists');
    launcher.click(); return 'opened-menu';
  })()`);
  if (action === "opened-menu") {
    await page.evaluate(`(async () => {
      const find = () => [...document.querySelectorAll('[role="menuitem"]')].find(node => node.getClientRects().length && node.textContent.trim() === 'Scenes');
      const first = find(); if (first) { first.click(); return; }
      await new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => { const item = find(); if (item) { clearTimeout(timer); observer.disconnect(); item.click(); resolve(); } });
        const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Actual shared UI menu did not offer Scenes')); }, ${timeoutMs});
        observer.observe(document.documentElement, { childList: true, subtree: true });
      });
    })()`);
  }
  return action;
}
async function checkedDocument(page, url, expectedSha, expectedSize) {
  const fetched = await page.evaluate(publicDocumentExpression(url));
  assert.equal(new URL(fetched.url).href, new URL(url).href, "Actual compiled document was redirected");
  const bytes = Buffer.from(fetched.text, "utf8");
  assert.equal(exactBytesSha256(bytes), expectedSha, "Actual served compiled bytes differ from their checked seal");
  if (expectedSize !== undefined) assert.equal(bytes.length, expectedSize);
  return fetched.text;
}
/** Read-only host observation of the real public Scenes controller; no state mutation. */
export async function readCompiledCampusSceneState(page, route, { signal, expectedActivePanoramaId, timeoutMs = 30000 }) {
  assert.equal(signal.aborted, false, "Native observation was cancelled");
  assert.equal(expectedActivePanoramaId, route.panoramaId);
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000);
  return page.evaluate(`(async () => {
    const read = window.__UMNVR_CAMPUS__?.readSceneState;
    if (typeof read !== 'function') throw new Error('Actual Campus read-only controller observation is missing');
    const deadline = performance.now() + ${timeoutMs};
    for (;;) {
      const state = read();
      if (state?.synthetic === true) throw new Error('Synthetic native state is not accepted');
      if (state?.errors?.length) throw new Error('Actual scene controller reports a content/runtime error');
      if (state?.status?.lastError) throw new Error('Actual native scene reports: ' + state.status.lastError);
      if (state?.loading === null && state?.status?.sceneId === ${JSON.stringify(route.sceneId)} && state.status.phase === 'immersive' && state.status.active === ${JSON.stringify(route.panoramaId)}) return state;
      if (performance.now() >= deadline) throw new Error('Actual native scene did not enter the selected panorama within the bounded observation deadline');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  })()`);
}
function assertNativeObservation(value, route) {
  assert.notEqual(value?.synthetic, true);
  assert.equal(value?.loading, null);
  assert.deepEqual(value?.errors, []);
  assert.equal(value.status?.sceneId, route.sceneId);
  assert.ok(typeof value.status.revision === "string" && value.status.revision.length);
  assert.equal(value.status.active, route.panoramaId);
  assert.equal(value.status.phase, "immersive", "A target or click alone is not entered native state");
  assert.equal(value.status.renderingAvailable, true);
  assert.equal(value.status.lastError, null);
  assert.ok(value.status.view && ["headingDeg", "pitchDeg", "verticalFovDeg"].every(key => Number.isFinite(value.status.view[key])), "Retain the actual native panorama view");
}
function assertOutputAcknowledgement(value, sha256, sizeBytes, label) {
  assert.ok(typeof value?.path === "string" && value.path.length, `${label}: retain an actual output path`);
  assert.equal(value.sha256, sha256, `${label}: written evidence must retain exact bytes`);
  assert.equal(value.sizeBytes, sizeBytes);
}

/** First bounded human-preview gate; does not run the broader backend/update suites. */
export async function runCompiledCampusSmoke(input, ports) {
  const fixture = createCompiledCampusSmokeInput(input);
  assertCompiledCampusSmokePorts(fixture, ports);
  const started = Date.now(), deadline = Math.min(started + fixture.maxDurationMs, Date.parse(fixture.grant.expiresAt));
  const abort = new AbortController();
  const receipt = {
    format: "umn-campus-first-local-compiled-smoke-receipt", version: 1, status: "RUNNING",
    input: fixture, helper: SHARED_HELPER, startedAt: new Date(started).toISOString(),
    routes: [], screenshots: [], resources: [], failures: [], browserExit: null, browserEvidence: null,
    claim: "Actual four-route compiled startup, retained authored content, selected photograph and public DOM navigation on the one recorded browser only; no renderer/GPU/backend qualification.",
    incomplete: ["six-browser/backend matrix", "worker update and retained-resource regression", "all thirteen keyboard/focus control proofs", "installer/bootstrap", "remote admission/publication", "future accessibility/media work"],
  };
  let page;
  const failures = [];
  const bounded = async (label, action, cleanup = false) => {
    if (!cleanup) assertFreshFixtureGrant(fixture);
    const ms = cleanup ? fixture.pageOptions.timeouts.closeMs + fixture.pageOptions.timeouts.exitMs : Math.min(deadline - Date.now(), fixture.pageOptions.timeouts.commandMs);
    assert.ok(ms > 0, `${label}: first smoke deadline expired`);
    let timer;
    try { return await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => { if (!cleanup) abort.abort(); reject(new Error(`${label}: bounded owner deadline exceeded`)); }, ms); })]); }
    finally { clearTimeout(timer); }
  };
  try {
    // Import after all pure data/port gates; importing this module never starts a browser.
    const { openHeadlessPage } = await import("@foss-earth/browser-testing/page");
    assertFreshFixtureGrant(fixture);
    // Shared startup is bounded by its own startupMs/owned failure cleanup.
    page = await openHeadlessPage(fixture.browser, fixture.profileDirectory, fixture.pageOptions);
    receipt.browserFacts = page.facts;
    receipt.browserProduct = page.product;
    const selector = fixture.routes[0];
    await bounded("selector navigation", () => page.navigate(selector.entryURL));
    await bounded("actual selector readiness", () => actualCampusDOM(page, "/tour/", value => value.readyState === "complete" && value.selectorImages.length === 3 && value.selectorImages.every(image => image.complete && image.naturalWidth > 0), fixture.pageOptions.timeouts.commandMs));
    await bounded("selector compiled bytes", () => checkedDocument(page, selector.entryURL, selector.htmlSha256));
    const selectorSnapshot = await bounded("actual selector DOM", () => page.evaluate(SELECTOR_EXPRESSION));
    assertSelectorSnapshot(selectorSnapshot);
    receipt.routes.push({ id: "selector", status: "PASS", snapshot: selectorSnapshot });
    for (const route of fixture.routes.slice(1)) {
      await bounded(`${route.id} selector navigation`, () => page.navigate(selector.entryURL));
      await bounded(`${route.id} selector readiness`, () => actualCampusDOM(page, "/tour/", value => value.readyState === "complete" && value.selectorImages.length === 3, fixture.pageOptions.timeouts.commandMs));
      await bounded(`${route.id} actual selector link`, () => page.evaluate(`(() => {
        const anchor = [...document.querySelectorAll('nav[aria-label="Campus tours"] li > a')].find(node => new URL(node.href).pathname === ${JSON.stringify(new URL(route.entryURL).pathname)});
        if (!anchor || !anchor.getClientRects().length) throw new Error('Actual compiled selector route is unavailable');
        // Return the actual link before navigation replaces its execution context.
        setTimeout(() => anchor.click(), 0); return { href: anchor.href, label: anchor.textContent.trim() };
      })()`));
      const routePath = new URL(route.entryURL).pathname;
      await bounded(`${route.id} startup DOM`, () => actualCampusDOM(page, routePath, value => value.canvases.some(canvas => canvas.width > 0 && canvas.height > 0), fixture.pageOptions.timeouts.commandMs));
      await bounded(`${route.id} compiled bytes`, () => checkedDocument(page, route.entryURL, route.htmlSha256));
      const document = JSON.parse(await bounded(`${route.id} produced content`, () => checkedDocument(page, new URL(route.contentURL, fixture.origin).href, route.contentSha256, route.contentSizeBytes)));
      assertCampusDocument(route.id, document);
      const tabAction = await bounded(`${route.id} shared Scenes tab`, () => openActualScenesTab(page, fixture.pageOptions.timeouts.commandMs));
      const expectedIds = document.entities.map(entity => entity.id);
      const listed = await bounded(`${route.id} actual authored membership`, () => actualCampusDOM(page, routePath, value => value.entries.length === expectedIds.length, fixture.pageOptions.timeouts.commandMs));
      assert.deepEqual(listed.entries.map(entry => entry.id), expectedIds, "Actual Scenes DOM membership/order differs from the accepted content");
      await bounded(`${route.id} actual panorama selection`, () => page.evaluate(`(() => {
        const button = [...document.querySelectorAll('.foss-earth-scene-entry button[data-panorama]')].find(node => node.dataset.panorama === ${JSON.stringify(route.panoramaId)});
        if (!button || button.disabled || !button.getClientRects().length) throw new Error('Actual authored panorama is not selectable');
        button.click(); return { id: button.dataset.panorama, label: button.textContent.trim() };
      })()`));
      const native = await bounded(`${route.id} actual native photograph`, () => ports.readSceneState(page, route, { signal: abort.signal, expectedActivePanoramaId: route.panoramaId, timeoutMs: fixture.pageOptions.timeouts.commandMs }));
      assertNativeObservation(native, route);
      const screenshot = await bounded(`${route.id} actual screenshot`, () => page.screenshot());
      const screenshotSha = exactBytesSha256(screenshot);
      const screenshotOutput = await bounded(`${route.id} screenshot retention`, () => ports.writeScreenshot(route.id, screenshot, screenshotSha));
      assertOutputAcknowledgement(screenshotOutput, screenshotSha, screenshot.byteLength, "screenshot");
      receipt.screenshots.push({ route: route.id, ...screenshotOutput });
      await bounded(`${route.id} reopen Scenes`, () => openActualScenesTab(page, fixture.pageOptions.timeouts.commandMs));
      const entered = await bounded(`${route.id} actual entered state`, () => actualCampusDOM(page, routePath, value => value.entries.some(entry => entry.id === route.panoramaId && entry.state === "Entered"), fixture.pageOptions.timeouts.commandMs));
      const actualResources = [];
      const network = page.captureEvidence().network;
      const successful = new Set(network.filter(row => row.status >= 200 && row.status < 400).map(row => row.url));
      const requestedPhotos = route.photographResources.filter(file => successful.has(new URL(file.url, fixture.origin).href));
      assert.ok(requestedPhotos.length, `${route.id}: no selected photograph resource was actually requested by the compiled app`);
      for (const file of requestedPhotos) {
        const url = new URL(file.url, fixture.origin).href;
        const loaded = await bounded(`${route.id} actual photograph bytes`, () => page.evaluate(`(async () => {
          const response = await fetch(${JSON.stringify(url)}, { cache: 'no-store' });
          if (!response.ok) throw new Error('Actual photograph HTTP ' + response.status);
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.byteLength !== ${file.sizeBytes}) throw new Error('Actual photograph length changed');
          let binary = ''; for (let start = 0; start < bytes.length; start += 16384) binary += String.fromCharCode(...bytes.subarray(start, start + 16384));
          return { url: response.url, status: response.status, base64: btoa(binary) };
        })()`));
        assert.equal(loaded.url, url);
        const bytes = Buffer.from(loaded.base64, "base64");
        assert.equal(exactBytesSha256(bytes), file.sha256, "Actual photograph differs from the one immutable measured media release");
        assert.equal(bytes.byteLength, file.sizeBytes);
        actualResources.push({ url, sha256: file.sha256, sizeBytes: file.sizeBytes, assetId: file.assetId, requestedByAppBeforeProbe: true, status: loaded.status });
      }
      receipt.resources.push({ route: route.id, files: actualResources });
      receipt.routes.push({ id: route.id, status: "PASS", contentSha256: route.contentSha256, tabAction, listed, entered, native });
    }
  } catch (error) { failures.push(error); }
  finally {
    abort.abort();
    if (page) {
      // The shared helper owns bounded close/exit/failure cleanup. Await its actual
      // terminal result; no owner timer can publish while that cleanup is pending.
      try { receipt.browserExit = await page.close() ?? null; }
      catch (error) { failures.push(error); }
      try { receipt.browserEvidence = page.captureEvidence(); assertCompleteBrowserEvidence(receipt.browserEvidence, fixture.browser); }
      catch (error) { failures.push(error); }
    }
    receipt.status = failures.length ? "FAIL" : "PASS";
    receipt.failures = failures.map(failure);
    receipt.finishedAt = new Date().toISOString();
    receipt.elapsedMs = Date.now() - started;
    try {
      const bytes = Buffer.from(`${JSON.stringify({ resources: receipt.resources, browserEvidence: receipt.browserEvidence }, null, 2)}\n`);
      const digest = exactBytesSha256(bytes);
      const output = await bounded("closed resource evidence retention", () => ports.writeResourceEvidence(bytes, digest), true);
      assertOutputAcknowledgement(output, digest, bytes.byteLength, "resource evidence");
      receipt.resourceEvidence = output;
    } catch (error) { failures.push(error); }
    receipt.status = failures.length ? "FAIL" : "PASS";
    receipt.failures = failures.map(failure);
    try { await bounded("closed owner receipt retention", () => ports.writeReceipt(receipt), true); }
    catch (error) { failures.push(error); receipt.status = "FAIL"; receipt.failures = failures.map(failure); }
  }
  if (failures.length) {
    const error = new AggregateError(failures, "First local compiled Campus smoke failed; retain receipts and stop the granted phase");
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}
