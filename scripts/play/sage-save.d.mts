import type { SliceState } from '../../src/domain/slice/types.js';

export interface SageSaveOptions {
  key: 'boundaries' | 'directed';
  tag: string;
  sourceDirectory: string;
  outputDirectory: string;
  start: number;
  count?: number;
  expectedBoundaries?: number;
  help?: true;
}

export interface FileEvidence {
  bytes: number;
  sha256: string;
}

export interface BoundarySource {
  name: string;
  filename: string;
  path: string;
}

export interface InspectedSources {
  root: string;
  indexPath: string;
  indexEvidence: FileEvidence;
  entries: BoundarySource[];
  selected: BoundarySource[];
  start: number;
  count: number;
}

export interface SageSaveRuntime {
  SqliteSliceStore: typeof import('../../src/persistence/slice-store.js').SqliteSliceStore;
  projectSliceState: typeof import('../../src/domain/slice/index.js').projectSliceState;
  assertValidSliceState: typeof import('../../src/domain/slice/index.js').assertValidSliceState;
  migrateSliceState: typeof import('../../src/domain/slice/migration.js').migrateSliceState;
}

export type SaveCheck = 'rollback-no-receipt' | 'reopen-before-no-receipt' | 'public-private-equality'
  | 'reopen-after' | 'idempotent-retry' | 'unique-terminal-sidecar';

export interface VerifiedBoundary {
  name: string;
  source: string;
  sourceBytes: number;
  sourceSha256: string;
  status: SliceState['status'];
  revision: number;
  finalSha256: string;
  database: string;
  checks: SaveCheck[];
}

export interface NamedFileEvidence extends FileEvidence {
  filename: string;
}

export interface SageSaveSummary {
  passed: true;
  sourceDirectory: string;
  outputDir: string;
  key: SageSaveOptions['key'];
  sourceBoundaryCount: number;
  expectedBoundaryCount: number;
  start: number;
  requestedBoundaryCount: number;
  boundaries: number;
  fullIndexVerified: boolean;
  uniqueSourceFiles: number;
  /** Number of distinct raw-source SHA-256 values, not a byte total. */
  uniqueSourceBytes: number;
  uniqueFinalStates: number;
  boundaryBytes: number;
  index: NamedFileEvidence;
  provenance: NamedFileEvidence[];
  terminalBoundaries: number;
  checks: VerifiedBoundary[];
}

export function parseArguments(args: string[]): SageSaveOptions;
export function fileEvidence(path: string): FileEvidence;
export function inspectSources(options: SageSaveOptions): InspectedSources;
export function verifySageBoundaries(options: SageSaveOptions, runtime?: SageSaveRuntime): Promise<SageSaveSummary>;
