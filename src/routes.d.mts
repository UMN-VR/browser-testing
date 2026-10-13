import type { HeadlessPage, PageOptions, BrowserTimeouts, BrowserEvidence, BrowserName } from '@foss-earth/browser-testing/page';

export type CampusSceneKey = 'minneapolis' | 'st-paul' | 'twin-cities';
export type CampusRouteKey = 'selector' | CampusSceneKey;
export type CampusBackend = 'webgl1' | 'webgl2' | 'webgpu';
export interface CampusRouteSpec { id: CampusRouteKey; path: string; sceneId: string | null; count: number }
export interface HelperPin { package: '@foss-earth/browser-testing'; revision: string; archiveSha256: string; archiveSizeBytes: number; descriptorSha256: string }
export const CAMPUS_ROUTES: readonly CampusRouteSpec[];
export const CAMPUS_TAB_IDS: readonly string[];
export const CROSS_CAMPUS_DIRECTIONS: readonly { source: string; link: string; target: string; route: string }[];
export const SHARED_HELPER: Readonly<HelperPin>;
export interface AuthoredLink { id: string; target: string; label: string; direction?: { headingDeg: number; pitchDeg: number } }
export interface LegacyExpectations {
  source: { url: string; sha256: string; sizeBytes: number; id: string; revision: string };
  entityOrder: readonly string[];
  membership: Readonly<Record<'minneapolis' | 'st-paul', readonly string[]>>;
  entities: readonly { id: string; metadataSha256: string }[];
  assets: readonly { id: string; metadataSha256: string; previewCells: readonly unknown[] }[];
  links: readonly { sourceEntityId: string; originalLink: AuthoredLink }[];
  groups: readonly { id: string; sha256: string }[];
  sharedSheet: { id: string; revision: string; sha256: string; sizeBytes: number; url: string };
}
export const LEGACY: Readonly<LegacyExpectations>;
export interface NavigationObservation {
  sourceEntityId: string; originalLink: AuthoredLink; mode: 'internal-original-id' | 'external-scene-route';
  targetRoute?: string; targetPanoramaId?: string; targetResolutionObserved?: boolean;
}
export interface SelectorSnapshot {
  path: string; mainCount: number; navCount: number; heading: string; skipTarget: string | null;
  scriptCount: number; inlineHandlers: number; javascriptURLs: number; canvasCount: number; text: string;
  cards: { path: string; label: string; description: string; flat: boolean; nestedLinks: number; imageCount: number;
    image: { src?: string; alt: string; complete: boolean; naturalWidth: number } }[];
}
export interface RuntimeSnapshot {
  runtimeStarted: boolean; currentSceneId: string; entityIds: string[]; devActivated: boolean; configuredTabs: string[];
  backend: { actual: CampusBackend; browserProduct: string; engineVersion: string; deviceKind: 'hardware' | 'software' | 'unknown' };
  authorities: { runtimes: number; viewers: number; schedulers: number; brokers: number; uploaders: number };
  tabProofs: { id: string; accessibleLabel: string; renderedText: string; keyboardOpened: boolean; keyboardClosed: boolean;
    focusRestored: boolean; inputMechanism: 'native-browser-input' }[];
  accessibilityClaim: 'retained-content-and-tested-controls';
}
export interface ReportOnlySnapshot { runtimeStarted: boolean; viewerCreated: boolean; devActivated: boolean; canvasCount: number; visibleText: string }
export interface WorkerSnapshot {
  mode: 'live'; buildSealSha256?: string; controlling: boolean; registrations: { scope: string; scriptURL: string }[];
  legacyScene: { sha256: string; sizeBytes: number };
  oldResource: { readableAfterUpdateCheck: boolean; url: string; sha256: string; observedAfterCheckSha256: string };
  update: { beforeAskBuild: string; afterAskBuild: string; publishedBuild: string; reloadCountBeforeAsk: number;
    reloadCountAfterAsk: number; reloadActionAvailable: boolean; reloadCountAfterExplicitAction: number; afterExplicitReloadBuild: string };
}
export interface RouteInput {
  id: CampusRouteKey; entryURL: string; htmlSha256: string; releaseDescriptorSha256: string;
  sceneId?: string; contentURL?: string; contentSha256?: string; contentSizeBytes?: number; navigationReceiptSha256?: string;
}
export interface CompiledCampusFixture {
  format: 'umn-campus-compiled-browser-fixture'; version: 1; inputStatus: 'checked-compiled-candidate';
  origin: string; helper: HelperPin; browser: BrowserName; requestedBackend: CampusBackend; profileDirectory: string;
  grant: { id: string; scopeSha256: string; expiresAt: string };
  compiled: { assemblyReceiptSha256?: string; assemblyArchiveSha256?: string; fullFileMapSha256: string; verificationReceiptSha256: string;
    appArchiveSha256: string; workerBuildSealSha256: string; buildStamp: string };
  updateCandidate: { htmlSha256: string; verificationReceiptSha256: string; buildStamp: string; workerSha256: string; currentBundleURL: string; currentBundleSha256: string; cacheName: string };
  nativeHost: { qualificationReceiptSha256: string }; observationSourceSha256: string;
  contentProducer: { repository: 'foss-earth/scenes'; revision: string; archiveSha256: string; qualificationReceiptSha256: string;
    capability: 'finite-pinned-child-composition' };
  sharedSheet: LegacyExpectations['sharedSheet']; routes: RouteInput[];
  pageOptions: PageOptions & { mode: 'live'; workers: true; timeouts: Required<BrowserTimeouts> };
}
export interface CampusQualificationReceipt {
  format: 'umn-campus-browser-qualification' | 'umn-campus-selector-no-javascript'; version: 1; status: 'RUNNING' | 'PASS' | 'FAIL';
  startedAt: string; finishedAt?: string; failures: { name: string; message: string }[];
  [observedField: string]: unknown;
}
export interface CompiledCampusSelectorFixture {
  format: 'umn-campus-compiled-selector-fixture'; version: 1; inputStatus: 'checked-compiled-candidate';
  helper: HelperPin; browser: 'chrome'; profileDirectory: string;
  grant: CompiledCampusFixture['grant'];
  compiled: { selectorArchiveSha256: string; fullFileMapSha256: string; verificationReceiptSha256: string };
  selector: { entryURL: string; htmlSha256: string };
  pageOptions: PageOptions & { mode: 'live'; binary: string; timeouts: Required<BrowserTimeouts> };
}
export interface CampusCompiledObservationPorts {
  /** Wait on the actual compiled fixture's lifecycle; do not manufacture success observations. */
  ready(page: HeadlessPage, route: RouteInput): Promise<void>;
  exerciseTabsAndReadRuntime(page: HeadlessPage, route: RouteInput): Promise<RuntimeSnapshot>;
  readNavigation(page: HeadlessPage, route: RouteInput): Promise<{ producerReceiptSha256: string; links: NavigationObservation[] }>;
  readReportOnly(page: HeadlessPage, route: RouteInput): Promise<ReportOnlySnapshot>;
  readPositiveDev(page: HeadlessPage, route: RouteInput): Promise<{ devActivated: boolean; canvasCount: number; visibleText: string; keyboardOpened: boolean; inputMechanism: string }>;
  exerciseWorkerUpdate(page: HeadlessPage, route: RouteInput): Promise<WorkerSnapshot>;
  writeReceipt(receipt: CampusQualificationReceipt): Promise<void> | void;
  writeScreenshot?(bytes: Uint8Array, sha256: string): Promise<void> | void;
}
export function applicationFactsSha256(value: unknown): string;
export function exactBytesSha256(bytes: string | Uint8Array): string;
export interface CampusMarkerStyleFacts {
  outline?: { color: string; widthPx: number } | null;
  hover?: { scale: number } | null;
}
/** Verifies appearance before normalizing equivalent inherited marker.style for the original hash. */
export function assertPreservedEntity(entity: unknown, options?: { sceneMarkerStyle?: CampusMarkerStyleFacts }): void;
export function assertPreservedAsset(asset: unknown, options?: { representations?: boolean }): void;
/** Input must already have passed the public shared Scenes/image validators. */
export function assertCampusDocument(route: CampusSceneKey, document: unknown): void;
export function assertChildNavigation(route: 'minneapolis' | 'st-paul', observed: NavigationObservation[]): void;
export function assertSelectorSnapshot(snapshot: SelectorSnapshot): void;
export function assertRuntimeSnapshot(route: CampusSceneKey, snapshot: RuntimeSnapshot, requestedBackend: CampusBackend): void;
export function assertReportOnly(snapshot: ReportOnlySnapshot): void;
export function assertWorkerAndUpdate(snapshot: WorkerSnapshot, origin: string): void;
export function assertCompleteBrowserEvidence(evidence: BrowserEvidence, requestedBrowser: BrowserName): void;
export function createCompiledCampusFixture(input: CompiledCampusFixture): CompiledCampusFixture;
export function createCompiledCampusSelectorFixture(input: CompiledCampusSelectorFixture): CompiledCampusSelectorFixture;
export function assertFreshFixtureGrant(fixture: Pick<CompiledCampusFixture, 'grant'>, now?: number): void;
export function runCampusQualification(input: CompiledCampusFixture, ports: CampusCompiledObservationPorts): Promise<CampusQualificationReceipt>;
export function runCampusSelectorWithoutJavaScript(input: CompiledCampusSelectorFixture,
  ports: Pick<CampusCompiledObservationPorts, 'writeReceipt'>): Promise<CampusQualificationReceipt>;
