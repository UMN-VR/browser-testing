import type { BrowserName, HeadlessPage, PageOptions, BrowserTimeouts } from "@foss-earth/browser-testing/page";
import type { CampusRouteKey, CampusSceneKey, HelperPin, LegacyExpectations, CampusQualificationReceipt } from "./routes.mjs";
export interface CompiledCampusSmokeRoute {
  id: CampusRouteKey; entryURL: string; htmlSha256: string; releaseDescriptorSha256: string;
  sceneId?: string; contentURL?: string; contentSha256?: string; contentSizeBytes?: number;
  navigationReceiptSha256?: string; panoramaId?: string;
  photographResources?: readonly { url: string; sha256: string; sizeBytes: number; assetId: string }[];
}
export interface CompiledCampusSmokeInput {
  format: "umn-campus-compiled-local-smoke"; version: 1; inputStatus: "checked-compiled-candidate";
  synthetic: false; observations?: never; origin: string; localPort: number;
  helper: HelperPin; browser: BrowserName; profileDirectory: string; maxDurationMs: number;
  grant: { id: string; scopeSha256: string; expiresAt: string };
  compiled: { assemblyReceiptSha256?: string; assemblyArchiveSha256?: string; fullFileMapSha256: string; verificationReceiptSha256: string;
    appArchiveSha256: string; workerBuildSealSha256: string; buildStamp: string };
  nativeHost: { qualificationReceiptSha256: string };
  observationSourceSha256: string;
  contentProducer: { repository: "foss-earth/scenes"; revision: string; archiveSha256: string;
    qualificationReceiptSha256: string; capability: "finite-pinned-child-composition" };
  media: { releaseDescriptorSha256: string; fullFileMapSha256: string; verificationReceiptSha256: string };
  sharedSheet: LegacyExpectations["sharedSheet"];
  routes: readonly CompiledCampusSmokeRoute[];
  pageOptions: PageOptions & { mode: "live"; workers: true; timeouts: Required<BrowserTimeouts> };
}
export interface CampusNativeSmokeObservation {
  /** Exact read-only controller.state() data, without synthesized readiness facts. */
  loading: null; errors: readonly unknown[]; synthetic?: never;
  status: {
    sceneId: string; revision: string; phase: "immersive";
    active: string; target: string | null; renderingAvailable: true; lastError: null;
    view: { headingDeg: number; pitchDeg: number; verticalFovDeg: number };
    immersionDetail?: { representation: string; loading: string | null; limitation: string | null } | null;
    [actualStatusField: string]: unknown;
  };
}
export interface SmokeOutputAcknowledgement { path: string; sha256: string; sizeBytes: number }
export interface CompiledCampusSmokePorts {
  synthetic: false; sourceSha256: string;
  /** Await actual page native readiness; never return intended/cached or synthetic observations. */
  readSceneState(page: HeadlessPage, route: CompiledCampusSmokeRoute & { id: CampusSceneKey },
    context: { signal: AbortSignal; expectedActivePanoramaId: string; timeoutMs: number }): Promise<CampusNativeSmokeObservation>;
  writeScreenshot(route: CampusRouteKey, bytes: Uint8Array, sha256: string): Promise<SmokeOutputAcknowledgement> | SmokeOutputAcknowledgement;
  writeResourceEvidence(bytes: Uint8Array, sha256: string): Promise<SmokeOutputAcknowledgement> | SmokeOutputAcknowledgement;
  writeReceipt(receipt: CampusLocalSmokeReceipt): Promise<void> | void;
}
export interface CampusLocalSmokeReceipt extends Omit<CampusQualificationReceipt, "format"> {
  format: "umn-campus-first-local-compiled-smoke-receipt";
  input: CompiledCampusSmokeInput; incomplete: string[]; routes: unknown[];
}
/** Pure gating only; does not prove or execute supplied artifacts. */
export function createCompiledCampusSmokeInput(input: CompiledCampusSmokeInput): CompiledCampusSmokeInput;
export function assertCompiledCampusSmokePorts(input: CompiledCampusSmokeInput, ports: CompiledCampusSmokePorts): void;
/** Built-in actual page reader of window.__UMNVR_CAMPUS__.readSceneState(). */
export function readCompiledCampusSceneState(page: HeadlessPage,
  route: CompiledCampusSmokeRoute & { id: CampusSceneKey },
  context: { signal: AbortSignal; expectedActivePanoramaId: string; timeoutMs?: number }): Promise<CampusNativeSmokeObservation>;
/** Executes only under a fresh explicitly bound grant, using the actual public helper. */
export function runCompiledCampusSmoke(input: CompiledCampusSmokeInput, ports: CompiledCampusSmokePorts): Promise<CampusLocalSmokeReceipt>;
