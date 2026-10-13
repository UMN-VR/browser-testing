import type { CompiledCampusFixture, CampusCompiledObservationPorts, CampusQualificationReceipt } from './routes.mjs';
/** Application DOM actions over the public native helper; no browser or server is started. */
export function createCampusObservationPorts(fixture: CompiledCampusFixture, options: {
  publishUpdate(): Promise<void>;
  installedArtifactPins: readonly { package: string; version: string; sourceIdentity: string; dirty: boolean; archiveSha256: string }[];
  oldResource: { url: string; sha256: string };
  writeReceipt(receipt: CampusQualificationReceipt): Promise<void> | void;
  writeScreenshot?(bytes: Uint8Array, sha256: string): Promise<void> | void;
}): CampusCompiledObservationPorts;
