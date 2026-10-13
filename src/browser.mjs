import assert from 'node:assert/strict';
import { openHeadlessPage } from '@foss-earth/browser-testing/page';
import { openHeadlessChrome, evaluate, waitForExpression } from '@foss-earth/browser-testing/chrome';
import { createCompiledCampusFixture, createCompiledCampusSelectorFixture, assertFreshFixtureGrant } from './fixtures.mjs';
import { SHARED_HELPER, LEGACY } from './expectations.mjs';
import {
  exactBytesSha256, assertSelectorSnapshot, assertCampusDocument, assertChildNavigation,
  assertRuntimeSnapshot, assertReportOnly, assertWorkerAndUpdate, assertCompleteBrowserEvidence,
} from './assertions.mjs';
import { SELECTOR_EXPRESSION, publicDocumentExpression } from './probes.mjs';

function failuresMessage(error) { return { name: error?.name ?? 'Error', message: String(error?.message ?? error) }; }
function requiredPorts(ports) {
  for (const name of ['ready', 'exerciseTabsAndReadRuntime', 'readNavigation', 'readReportOnly', 'readPositiveDev', 'exerciseWorkerUpdate', 'writeReceipt']) {
    assert.equal(typeof ports[name], 'function', `Actual compiled fixture port ${name} is required`);
  }
}

/**
 * Campus assertions only. The approved caller starts/stops the named compiled fixture
 * server and supplies actual native observation/action ports. No tool acquisition,
 * server, provider emulation, generic runner or private source dependency lives here.
 */
export async function runCampusQualification(input, ports) {
  const fixture = createCompiledCampusFixture(input);
  requiredPorts(ports);
  assertFreshFixtureGrant(fixture);
  const receipt = {
    format: 'umn-campus-browser-qualification', version: 1, status: 'RUNNING',
    fixture, helper: SHARED_HELPER, startedAt: new Date().toISOString(),
    routeResults: [], reportOnlyResults: [], workerUpdate: null,
    browserEvidence: null, browserExit: null, screenshotSha256: null, failures: [],
    claim: 'Only actual checked artifacts, observed runtime/backend, retained content and exercised controls in this receipt.',
  };
  let page;
  const failures = [];
  const readCompiledEntry = async route => {
    const response = await page.evaluate(publicDocumentExpression(route.entryURL));
    assert.equal(new URL(response.url).pathname, new URL(route.entryURL).pathname, 'Actual public route was redirected');
    assert.equal(exactBytesSha256(Buffer.from(response.text, 'utf8')), route.htmlSha256,
      `${route.id}: actual served compiled HTML differs from its checked byte seal`);
  };
  try {
    page = await openHeadlessPage(fixture.browser, fixture.profileDirectory, fixture.pageOptions);
    receipt.browserFacts = page.facts;
    const selector = fixture.routes[0];
    await page.navigate(selector.entryURL);
    await ports.ready(page, selector);
    await readCompiledEntry(selector);
    const selectorSnapshot = await page.evaluate(SELECTOR_EXPRESSION);
    assertSelectorSnapshot(selectorSnapshot);
    receipt.routeResults.push({ id: selector.id, status: 'PASS', document: selectorSnapshot });
    for (const route of fixture.routes.slice(1)) {
      assertFreshFixtureGrant(fixture);
      await page.navigate(route.entryURL);
      await ports.ready(page, route);
      await readCompiledEntry(route);
      const fetched = await page.evaluate(publicDocumentExpression(new URL(route.contentURL, route.entryURL).href));
      const bytes = Buffer.from(fetched.text, 'utf8');
      assert.equal(exactBytesSha256(bytes), route.contentSha256, `${route.id}: actual served scene differs from its compiled seal`);
      assert.equal(bytes.length, route.contentSizeBytes);
      assertCampusDocument(route.id, JSON.parse(fetched.text));
      const navigation = await ports.readNavigation(page, route);
      assert.equal(navigation.producerReceiptSha256, route.navigationReceiptSha256, 'Navigation observations need the exact checked producer binding');
      if (route.id !== 'twin-cities') assertChildNavigation(route.id, navigation.links);
      const runtime = await ports.exerciseTabsAndReadRuntime(page, route);
      assertRuntimeSnapshot(route.id, runtime, fixture.requestedBackend);
      receipt.routeResults.push({ id: route.id, status: 'PASS', contentSha256: route.contentSha256, runtime, navigation });
    }
    const combined = fixture.routes.find(route => route.id === 'twin-cities');
    const worker = await ports.exerciseWorkerUpdate(page, combined);
    assert.equal(worker.buildSealSha256, fixture.compiled.workerBuildSealSha256);
    assert.equal(worker.update.beforeAskBuild, fixture.compiled.buildStamp);
    assert.equal(worker.update.publishedBuild, fixture.updateCandidate.buildStamp);
    assertWorkerAndUpdate(worker, fixture.origin);
    const updatedHTML = await page.evaluate(publicDocumentExpression(combined.entryURL));
    assert.equal(exactBytesSha256(Buffer.from(updatedHTML.text, 'utf8')), fixture.updateCandidate.htmlSha256,
      'Explicit Reload must use the measured controlled newer compiled fixture');
    receipt.workerUpdate = worker;
    for (const route of fixture.routes.slice(1)) {
      assertFreshFixtureGrant(fixture);
      const url = new URL(route.entryURL);
      url.searchParams.set('report', '1');
      url.searchParams.set('dev', '1');
      await page.navigate(url.href);
      const observation = await ports.readReportOnly(page, route);
      assertReportOnly(observation);
      receipt.reportOnlyResults.push({ id: route.id, status: 'PASS', observation });
    }
    const devURL = new URL(combined.entryURL); devURL.searchParams.set('dev', '1');
    await page.navigate(devURL.href);
    const positiveDev = await ports.readPositiveDev(page, combined);
    assert.equal(positiveDev.devActivated, true);
    assert.ok(positiveDev.canvasCount > 0 && positiveDev.visibleText.trim());
    receipt.positiveDev = positiveDev;
    const screenshot = await page.screenshot();
    receipt.screenshotSha256 = exactBytesSha256(screenshot);
    if (ports.writeScreenshot) await ports.writeScreenshot(screenshot, receipt.screenshotSha256);
  } catch (error) { failures.push(error); }
  finally {
    if (page) {
      try { receipt.browserExit = await page.close() ?? null; } catch (error) { failures.push(error); }
      try {
        receipt.browserEvidence = page.captureEvidence();
        assertCompleteBrowserEvidence(receipt.browserEvidence, fixture.browser);
      } catch (error) { failures.push(error); }
    }
    receipt.status = failures.length ? 'FAIL' : 'PASS';
    receipt.failures = failures.map(failuresMessage);
    receipt.finishedAt = new Date().toISOString();
    try { await ports.writeReceipt(receipt); } catch (error) { failures.push(error); }
  }
  if (failures.length) {
    receipt.status = 'FAIL';
    const error = new AggregateError(failures, 'Campus browser qualification failed; retain the exact receipt and stop the assigned phase');
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}

/**
 * Chrome's public protocol adapter supports an actual page-JavaScript-disabled
 * selector proof. It never substitutes for other browsers' native/runtime checks.
 */
export async function runCampusSelectorWithoutJavaScript(input, ports) {
  const fixture = createCompiledCampusSelectorFixture(input);
  assert.equal(typeof ports.writeReceipt, 'function');
  assertFreshFixtureGrant(fixture);
  const lifecycle = [];
  const receipt = {
    format: 'umn-campus-selector-no-javascript', version: 1, status: 'RUNNING',
    helper: SHARED_HELPER, compiled: fixture.compiled, grant: fixture.grant,
    expectedLegacySceneSha256: LEGACY.source.sha256, lifecycle,
    pageJavaScriptDisabled: false, snapshot: null, browserExit: null, failures: [],
    startedAt: new Date().toISOString(),
  };
  let browser;
  const failures = [];
  try {
    browser = await openHeadlessChrome(fixture.profileDirectory, fixture.pageOptions.binary,
      fixture.pageOptions.chromeArgs ?? [], { timeouts: fixture.pageOptions.timeouts, onLifecycle: value => lifecycle.push(value) });
    receipt.product = browser.version.product;
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    await browser.send('Page.enable', {}, sessionId);
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: fixture.pageOptions.width, height: fixture.pageOptions.height, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await browser.send('Emulation.setScriptExecutionDisabled', { value: true }, sessionId);
    receipt.pageJavaScriptDisabled = true;
    await browser.send('Page.navigate', { url: fixture.selector.entryURL }, sessionId);
    await waitForExpression(browser, sessionId,
      `location.pathname === '/tour/' && document.readyState === 'complete' && [...document.querySelectorAll('nav[aria-label="Campus tours"] img')].every(image => image.complete)`,
      fixture.pageOptions.timeouts.commandMs);
    const compiledHTML = await evaluate(browser, sessionId, publicDocumentExpression(fixture.selector.entryURL));
    assert.equal(exactBytesSha256(Buffer.from(compiledHTML.text, 'utf8')), fixture.selector.htmlSha256,
      'The JavaScript-disabled selector must use the actual checked compiled HTML');
    receipt.snapshot = await evaluate(browser, sessionId, SELECTOR_EXPRESSION);
    receipt.viewport = await evaluate(browser, sessionId, '({ width: innerWidth, height: innerHeight })');
    assertSelectorSnapshot(receipt.snapshot);
  } catch (error) { failures.push(error); }
  finally {
    if (browser) {
      try {
        receipt.browserExit = await browser.close();
        assert.equal(receipt.browserExit.code, 0);
        assert.equal(receipt.browserExit.signal, null);
        assert.equal(lifecycle.filter(row => ['graceful-close-timeout', 'signal', 'forced-close', 'event-listener-error'].includes(row.event)).length, 0);
      } catch (error) { failures.push(error); }
    }
    receipt.status = failures.length ? 'FAIL' : 'PASS';
    receipt.failures = failures.map(failuresMessage);
    receipt.finishedAt = new Date().toISOString();
    try { await ports.writeReceipt(receipt); } catch (error) { failures.push(error); }
  }
  if (failures.length) {
    receipt.status = 'FAIL';
    const error = new AggregateError(failures, 'Campus selector JavaScript-disabled proof failed');
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}
