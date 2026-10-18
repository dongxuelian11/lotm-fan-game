import assert from 'node:assert/strict';
import { assertEmptyDeathState, assertEmptyDeathPublic, assertEmptyDoorState, assertEmptyDoorPublic } from '../helpers/empty-death-capture.js';
import { createDoorState } from '../../src/domain/door/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { projectFool, validateFoolCommand } from '../../src/domain/fool/index.js';
import { createRedPriestState, projectRedPriest } from '../../src/domain/red-priest/index.js';
import { createVisionaryState, projectVisionary } from '../../src/domain/visionary/index.js';
import { createPerfecterState, projectPerfecter } from '../../src/domain/perfecter/index.js';
import { createMoonState, projectMoon } from '../../src/domain/moon/index.js';
import { createDarknessState, projectDarkness } from '../../src/domain/darkness/index.js';
import { createWhiteTowerState, projectWhiteTower } from '../../src/domain/white-tower/index.js';
import { openFoolRuntimeSession, type FoolRuntimeSession } from '../../src/domain/fool/owned-session.js';
import { foolFrozenSourceDigest } from '../../src/domain/fool/source.js';
import type { FoolProjection } from '../../src/domain/fool/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

/** Immutable 208 capture evidence plus current-runtime migration/replay checks.
 * Nothing here launches the producer, imports dist, rewrites an input, supplies
 * a random result, or claims a creation-to-1868 historical replay. */
const ROOT = 'tests/fixtures/fool-v02080';
const SOURCE = 'tests/fixtures/attendant-mysteries-v01860/natural-battle.json';
const SOURCE_PATH = join('tests', 'fixtures', 'attendant-mysteries-v01860', 'natural-battle.json');
const ORIGINAL_RECORDED_ROOT = 'output/qa-0208/manual-pause-1851';
const SOURCE_SHA = '31e1b112e8495aece7f3bf8dc0fc63384f90ef4f0fd98aac1b14de645f334ffa';
const PREFIX_SHA = 'b4e076eaca66ac3edd38a20a338e96d833a22a29ed48bcd0f42d7a950693de17';
const PREFIX = 1868, RAW_INITIAL_COUNT = 1856, SEED = 'seer-rebuild-first';
const INTERRUPTED_ROWS = 43, INTERRUPTED_COUNT = PREFIX + INTERRUPTED_ROWS;
const ORIGINAL_FREEZE = '9260509a380be70d076c31da09aa4bb335258a8d264ba42380fb6ea5f6422e6c';
const PAUSED_ROWS = 68, PAUSED_COUNT = PREFIX + PAUSED_ROWS;
const PAUSED_FREEZE = '4fa64f7979b7cd079f694967bdb17830358d565ae405d021713de8257b160d4a';
const TRANSITION = {
  manifestFile: 'output/qa-0208/canonical-pause-1937/runtime-transition.json',
  checkpointFile: 'output/play/fool-02080-3SBoW5/checkpoint.json', checkpointBytes: 9903656,
  checkpointSha256: 'e981e113a494c18f50686374ebef6cc355ba6e8a92320a89457f8a8925817dd1',
  controlSha256: '18ef3f7481066157c69b69f0041f352e25c94b3108d320bfc0c15f7a88bcbc4d',
  finalStateSha256: '06e4f43fe2044dcf68c800f8f5230256f0947821e3a570ed260b5a5cd350923b',
  finalPublicSha256: 'b7aefa32cb51899969d44f5565392ed50d40536b0fde3cde8182877ea9f436f9',
  publicEvidenceFile: 'output/qa-0208/canonical-pause-1937/benchmark-before.json', publicEvidenceBytes: 749,
  publicEvidenceSha256: 'cb13195541cd40f1fa91039576dd15576276d2e6b6ba58dbb71e9923ebec826d',
  changedFiles: ['$natural-runner', 'dist/domain/fool/engine.js', 'dist/domain/fool/engine.js.map', 'dist/domain/fool/materials.js', 'dist/domain/fool/materials.js.map', 'dist/domain/slice/index.js', 'dist/domain/slice/index.js.map', 'src/domain/fool/engine.ts', 'src/domain/fool/materials.ts', 'src/domain/slice/index.ts'],
} as const;
const RECONSTRUCTION_KIND = 'RECONSTRUCTED_FROM_EXACT_COMPLETED_PARTIAL_LEDGER_NOT_ORIGINAL_FULL_STATE_CAPTURE';
const PROOF = 'resume-original';
const FILES = ['natural.json', 'commands.jsonl', 'states.jsonl', 'boundaries.index.json', 'report.json', 'freeze.json', 'runtime-transition.json',
  `${PROOF}/interruption.json`, `${PROOF}/terminated-commands.jsonl`, `${PROOF}/freeze-before-natural.json`, `${PROOF}/baseline/summary.json`, `${PROOF}/baseline/states.jsonl`] as const;
const ORIGINAL_PROOF_SHAS = {
  'resume-original/interruption.json': '04d80eeded74a63642e27941ee764b1ed1958f7397f9545c38abe8c86a96f048',
  'resume-original/terminated-commands.jsonl': '09ba77d6c0edde3b6df7f0a26c625808bef3b0ca20b01d173c32d420756604b1',
  'resume-original/freeze-before-natural.json': 'cb10464dcbdb5ff36ec26c4e5f4cf6db79d29e50ba510ae43d4215c1130d6689',
  'resume-original/baseline/summary.json': '475e33e9f5de0b1e075bacd6ff233a506005bcd866c2a5881eed568848baf8ae',
  'resume-original/baseline/states.jsonl': '80bcbdde0ed4f4476420e8d156b2f34258981404712e1b24c32ce5d2e55c3853',
} as const;
type FileName = typeof FILES[number];
type FilePin = { bytes: number; sha256: string };
interface Freeze { sha256: string; files: Array<FilePin & { file: string }> }
interface FinalRuntimeReview extends FilePin { file: string; runtimeFreezeSha256: string; verifierSha256: string }
interface FinalRuntimeProof {
  format: string; kind: string; captureFreezeSha256: string; captureInputs: Array<FilePin & { file: string }>;
  publicRedaction: unknown;
  finalRuntimeFreeze: Freeze; changedFiles: Array<{ file: string; before: FilePin | null; after: FilePin }>;
}
// Separate coordinator-reviewed historical 208 final-runtime proof. These exact
// bytes authenticate that review, not the source of a later product version.
// Never alter historical OBSERVED values to match current source.
const FINAL_RUNTIME_REVIEW: FinalRuntimeReview | null = { file: `${ROOT}/final-runtime-proof.json`, bytes: 866580, sha256: '85f7992dad6feebde5ae24d51dd2eb9874737a213cf4ca08ea6df7a425fe61e1', runtimeFreezeSha256: 'afc9b8237e6694069da5013719d4b1b16536f39448ce311a5b9bbdef70c23a16', verifierSha256: '2aacb0785e85ae79aef0cb74a986e659ccc04c6527e78718b48e65d6d8b381c7' };

function finalRuntimeReview(): FinalRuntimeReview {
  if (!FINAL_RUNTIME_REVIEW) throw new Error('PENDING: exact final-runtime proof, freeze and verifier review are not filled.');
  return FINAL_RUNTIME_REVIEW;
}

type CaptureStage = 'NATURAL_FULL1868_FOOL_PROMOTION_AND_FINITE_ESCAPE_COMPLETED' | 'NATURAL_FINITE_POLICY_STOP' | 'NATURAL_ACTUAL_TERMINAL_NO_REVIVAL';
interface Observation {
  stage: CaptureStage; phase: string; commands: number; namedBoundaries: number;
  finalStateSha256: string; finalRandom: SliceState['random']; finalBudget: ReturnType<typeof budget>;
  error: { name: string; code: string | null; message: string; detail: unknown } | null;
  captureRuntimeFreezeSha256: string; captureProducerSha256: string; files: Record<FileName, FilePin>;
  tailCommandsSha256: string; beforeLastStateSha256: string; originalMigratedStateSha256: string; boundaryCommands: Record<string, number>;
}
interface ResumeProvenance {
  kind: string; currentRuntimeFreezeSha256: string; continuation: string; replayEffects: string; verifiedCompletedRows: number; verifiedStates: number;
  originalCapture: { interruptionFile: string; interruptionSha256: string; originalCaptureFreezeSha256: string; originalCapturedFullState: false;
    completedNewCommands: number; lastCompleteCommandCount: number; ledgerFile: string; ledgerSha256: string; partialNextAction: string };
  reconstruction: { kind: string; originalFrozenRuntimeBaselineStatesFile: string; baselineStatesSha256: string; baselineFinalStateSha256: string;
    baselineFreezeSha256: string; originalBoundarySnapshotsCaptured: false; boundaryHashesMeaning: string };
  runtimeTransition?: { kind: string; manifestFile: string; manifestSha256: string; checkpointFile: string; checkpointSha256: string;
    previousRuntimeFreezeSha256: string; currentRuntimeFreezeSha256: string; commandCount: number; finalStateSha256: string };
}
interface RuntimeTransition {
  format: string; kind: string; oldFreeze: Freeze; newFreeze: Freeze;
  changedFiles: Array<{ file: string; before: FilePin; after: FilePin }>;
  checkpoint: FilePin & { file: string; finalPublicSha256: string;
    finalPublicEvidence: FilePin & { kind: string; file: string; rawText: string };
    control: Record<string, unknown> & { commandCount: number; commandsSha256: string; commandRowsSha256: string; stateRowsSha256: string;
      ledgerSha256: string; beforeLastStateSha256: string; finalStateSha256: string; phase: string; lastIntent: SliceIntent; boundaries: Record<string, Boundary> } };
}
// Literal observations from the coordinator-reviewed exit-0 continuation.
// These pins identify the CAPTURE runtime, never a later optimized final runtime.
// Original43 only has a partial command capture: its full states are reconstructed,
// NOT original persisted capture states. Their frozen-runtime proof is separate.
// A finite living stop or terminal result must be pinned honestly, never changed
// into a success expectation. Missing/running/unexpected/integrity-blocked work
// is not a completed natural-route observation and must keep this guard failing.
const OBSERVED: Observation | null = {
  "stage": "NATURAL_FULL1868_FOOL_PROMOTION_AND_FINITE_ESCAPE_COMPLETED",
  "phase": "FINITE_ORIGINAL_VAULT_ESCAPE",
  "commands": 2083,
  "namedBoundaries": 34,
  "finalStateSha256": "66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a",
  "finalRandom": {
    "seed": "seer-rebuild-first",
    "cursor": 956
  },
  "finalBudget": {
    "revision": 2084,
    "week": 16006,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1656,
      "month": 3,
      "day": 27
    },
    "status": "ACTIVE",
    "sequence": 0,
    "health": 65,
    "mind": 96,
    "spirituality": 92,
    "cash": 71,
    "actions": 2,
    "pollution": 0,
    "cursor": 956,
    "second": 21985407,
    "location": "base"
  },
  "error": null,
  "captureRuntimeFreezeSha256": "01aaf426597581a0023ff659f00e54be6b27b35163038291c6e30000de8fcfdf",
  "captureProducerSha256": "d8b99e799ab6d3ca46da7b522fdbfd30146b874dfcb78f02d030f149b1052ae4",
  "files": {
    "natural.json": {
      "bytes": 37252637,
      "sha256": "8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959"
    },
    "commands.jsonl": {
      "bytes": 183428,
      "sha256": "479b9392dd928a3b5508541549e659ea87d7442c198bd92a34521df668c2a9f4"
    },
    "states.jsonl": {
      "bytes": 28338,
      "sha256": "b72037d8bccf5f2c3bf38b361c79a1ef612c6d4618a5f5caad78f845047cdc46"
    },
    "boundaries.index.json": {
      "bytes": 29432,
      "sha256": "6dbb7c177bfcd665b2122cc3744e257db45f43f341166599f19f641efea0f669"
    },
    "report.json": {
      "bytes": 67146,
      "sha256": "0b7577b6d9343218288b69f9039a57386d48935d28b57bd2b4e8515f4c9c3955"
    },
    "freeze.json": {
      "bytes": 544257,
      "sha256": "f0fe8a831fb2c4f68db3f9f8c610e5177ee75c6402556e1a6b8a5b4538fb1979"
    },
    "runtime-transition.json": {
      "bytes": 1106614,
      "sha256": "32efef5fcf1b49cd01f22ec9d04ffe0e8c9e0da534f2dfc8f3c6992febd6d26f"
    },
    "resume-original/interruption.json": {
      "bytes": 2204,
      "sha256": "04d80eeded74a63642e27941ee764b1ed1958f7397f9545c38abe8c86a96f048"
    },
    "resume-original/terminated-commands.jsonl": {
      "bytes": 36122,
      "sha256": "09ba77d6c0edde3b6df7f0a26c625808bef3b0ca20b01d173c32d420756604b1"
    },
    "resume-original/freeze-before-natural.json": {
      "bytes": 544258,
      "sha256": "cb10464dcbdb5ff36ec26c4e5f4cf6db79d29e50ba510ae43d4215c1130d6689"
    },
    "resume-original/baseline/summary.json": {
      "bytes": 848,
      "sha256": "475e33e9f5de0b1e075bacd6ff233a506005bcd866c2a5881eed568848baf8ae"
    },
    "resume-original/baseline/states.jsonl": {
      "bytes": 22268,
      "sha256": "80bcbdde0ed4f4476420e8d156b2f34258981404712e1b24c32ce5d2e55c3853"
    }
  },
  "tailCommandsSha256": "1f09c4c0f1c18d34b7dd76bc3aa221d518062537f54e73f8521280d52d5b8340",
  "beforeLastStateSha256": "27301a09a93e5895df436065daebb78a533fabf7da96f2306b50aef490c5b88b",
  "originalMigratedStateSha256": "0203d3dd04ac25beb1d1cc15a98ccbd3c6af802ae99107696eecfce712af2f57",
  "boundaryCommands": {
    "original-full1868-migrated-start": 1868,
    "original-guidance-without-resource-or-rng-change": 1869,
    "supplier-real-work-1": 1870,
    "supplier-real-work-2": 1871,
    "supplier-real-work-3": 1872,
    "supplier-real-work-4": 1875,
    "supplier-real-work-5": 1876,
    "third-original-paid-handoff": 1885,
    "uniqueness-independent-custody-inspected": 1892,
    "same-uniqueness-actually-received": 1902,
    "material-0-attendant-mysteries-batch-1:characteristic-TRACE_REJECTION-1": 1910,
    "material-0-attendant-mysteries-batch-1:characteristic-EXTRACT_RESIDUE-1": 1927,
    "material-0-attendant-mysteries-batch-1:characteristic-SEAL_RESIDUE-1": 1938,
    "same-original-compound-1-prepared": 1957,
    "fate-1-same-originals-entered": 1966,
    "fate-1-before-one-graft": 1974,
    "fate-1-actual-graft": 1975,
    "fate-1-original-arrival-verified": 1977,
    "fate-1-settled": 1977,
    "fate-1-actual-return": 1978,
    "station-quarry-paid-real-attempt-1": 1995,
    "station-reed-cave-paid-real-attempt-1": 2012,
    "station-reed-cave-paid-real-attempt-2": 2028,
    "station-salt-vault-paid-real-attempt-1": 2037,
    "station-rain-ruin-paid-real-attempt-1": 2054,
    "sixteen-original-corridors-prepared": 2055,
    "potion-1-circuit-started": 2062,
    "potion-1-before-full-sixty-seconds": 2071,
    "potion-1-actual-consumption": 2072,
    "escape-original-people-door-and-objects": 2078,
    "escape-actual-blindness-attempt": 2080,
    "escape-first-actual-crossing": 2081,
    "escape-ordinary-retreat-after-real-failure": 2082,
    "escape-reported-actual-applications-only": 2083
  }
};
function observed(): Observation {
  if (!OBSERVED) throw new Error('PENDING: no reviewed final Fool208 capture observation. Natural result and file pins remain unfilled.');
  return OBSERVED;
}
const hash = (v: unknown): string => createHash('sha256').update(stableStringify(v)).digest('hex');
const compactHash = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Hash assertions keep giant private trees out of assertion diffs.
const same = (a: unknown, b: unknown): void => expect(hash(a)).toBe(hash(b));
const fixturePath = (file: string): string => join(ROOT, file);
const entry = <T>(key: string): T => readObjectEntry<T>(fixturePath('natural.json'), key);
const sourceEntry = <T>(key: string): T => readObjectEntry<T>(SOURCE_PATH, key);
const json = <T>(file: FileName): T => JSON.parse(readFileSync(fixturePath(file), 'utf8')) as T;
async function fileHash(path: string, prefixBytes?: number): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path, prefixBytes === undefined ? {} : { start: 0, end: prefixBytes - 1 })) digest.update(chunk);
  return digest.digest('hex');
}
interface PriorPublicRow { stateSha256: string; budgetSha256: string; random: SliceState['random']; eventSha256: string | null; public: { strictSha256: string } }
interface RedactionAudit {
  prior: { rows: PriorPublicRow[] };
  restore: (state: SliceState, projection: Omit<ReturnType<typeof projectSliceState>, 'redPriest' | 'visionary' | 'perfecter' | 'moon' | 'darkness' | 'whiteTower' | 'tyrant' | 'sun' | 'death' | 'door'>, display: typeof projectPlayerText) => unknown;
  assertRow: (prior: { rows: PriorPublicRow[] }, index: number, actual: { stateSha256: string; budgetSha256: string; random: SliceState['random']; eventSha256: string | null; legacyPublicSha256: string }) => string;
}
let redactionAudit: RedactionAudit | null = null;
// Reuse the exact pinned verifier to authenticate both historical inventories,
// their bounded differences and every original capture input. The proof records
// source hashes, not source bytes: it cannot authenticate today's source tree.
// Current source is exercised by migration, validation and replay below.
async function assertReviewedHistoricalRuntimeProof(): Promise<void> {
  const review = finalRuntimeReview(), e = observed();
  keys(review, ['file', 'bytes', 'sha256', 'runtimeFreezeSha256', 'verifierSha256']);
  for (const value of [review.sha256, review.runtimeFreezeSha256, review.verifierSha256]) expect(value).toMatch(/^[a-f0-9]{64}$/);
  const proofPath = resolve(review.file); expect(realpathSync(proofPath)).toBe(proofPath);
  expect(statSync(proofPath).size).toBe(review.bytes); expect(await fileHash(proofPath)).toBe(review.sha256);
  const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as FinalRuntimeProof;
  expect(proof.finalRuntimeFreeze.sha256).toBe(review.runtimeFreezeSha256);
  const verifierPath = resolve('scripts', 'verify', 'fool-save.mjs'); expect(realpathSync(verifierPath)).toBe(verifierPath);
  expect(await fileHash(verifierPath)).toBe(review.verifierSha256);
  const validator = await import(/* @vite-ignore */ pathToFileURL(verifierPath).href) as {
    assertFoolFinalRuntimeProof: (proof: unknown, captured: Freeze, current: Freeze, inputs: Array<FilePin & { file: string }>) => unknown;
    assertFoolPublicRedactionEvidence: (evidence: unknown, states: StateRow[]) => RedactionAudit['prior'];
    restoreFoolLegacyPublicProjection: RedactionAudit['restore'];
    assertFoolPublicRedactionRow: RedactionAudit['assertRow'];
  };
  expect(await fileHash(verifierPath)).toBe(review.verifierSha256);
  const captured = json<Freeze>('freeze.json'), captureInputs: Array<FilePin & { file: string }> = [];
  for (const file of [...FILES].sort()) {
    const path = resolve(fixturePath(file)); expect(realpathSync(path)).toBe(path);
    captureInputs.push({ file, bytes: statSync(path).size, sha256: await fileHash(path) });
  }
  // Both arguments are historical evidence. The helper binds complete recorded
  // inventories, unchanged pins and exact approved 208 changed-file rows; this
  // self-consistency check does not claim current-runtime byte equality.
  validator.assertFoolFinalRuntimeProof(proof, captured, proof.finalRuntimeFreeze, captureInputs);
  redactionAudit = { prior: validator.assertFoolPublicRedactionEvidence(proof.publicRedaction, jsonLines<StateRow>('states.jsonl')), restore: validator.restoreFoolLegacyPublicProjection, assertRow: validator.assertFoolPublicRedactionRow };
  expect(captured.sha256).toBe(e.captureRuntimeFreezeSha256);
  expect(captured.files.find(row => row.file === '$natural-runner')?.sha256).toBe(e.captureProducerSha256);
  const sourcePath = resolve(SOURCE_PATH); expect(realpathSync(sourcePath)).toBe(sourcePath);
  const originalSource = { file: SOURCE, bytes: statSync(sourcePath).size, sha256: await fileHash(sourcePath) };
  expect(originalSource.sha256).toBe(SOURCE_SHA);
  expect(proof.finalRuntimeFreeze.files.find(row => row.file === SOURCE)).toEqual(originalSource);
  expect(await fileHash(proofPath)).toBe(review.sha256); expect(await fileHash(verifierPath)).toBe(review.verifierSha256);
}

async function firstCompleteLines(path: string, count: number): Promise<Buffer> {
  const pieces: Buffer[] = []; let lines = 0;
  for await (const chunk of createReadStream(path)) {
    const bytes = chunk as Buffer;
    for (let i = 0; i < bytes.length; i++) if (bytes[i] === 10 && ++lines === count) { pieces.push(bytes.subarray(0, i + 1)); return Buffer.concat(pieces); }
    pieces.push(bytes);
  }
  throw new Error(`Missing ${count} complete ledger lines`);
}
function jsonLines<T>(file: FileName): T[] {
  const text = readFileSync(fixturePath(file), 'utf8'); expect(text.endsWith('\n'), file).toBe(true);
  return text.slice(0, -1).split('\n').map(line => { expect(line.length).toBeGreaterThan(0); return JSON.parse(line) as T; });
}
type HistoricalFoolState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'redPriest' | 'visionary' | 'perfecter' | 'moon' | 'darkness' | 'whiteTower' | 'tyrant' | 'sun' | 'death' | 'door'> & { schemaVersion: 205; contentVersion: 'fool-v205' };
const EMPTY_RED_PRIEST: SliceState['redPriest'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  campaign: null, materials: null, epilogue: null, journal: [],
};
const EMPTY_VISIONARY: SliceState['visionary'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  era: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_PERFECTER: SliceState['perfecter'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  works: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_MOON: SliceState['moon'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_DARKNESS: SliceState['darkness'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_WHITE_TOWER: SliceState['whiteTower'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_TYRANT: SliceState['tyrant'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  coasts: null, challenge: null, materials: null, epilogue: null, seaVoyages: [], assembly: null,
  journal: [], promotionStability: { preparations: [] },
};
const EMPTY_SUN: SliceState['sun'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
let originalStateKeys: readonly string[] | null = null;
function historicalStateKeys(): readonly string[] {
  if (!originalStateKeys) {
    const raw = entry<HistoricalFoolState>('final');
    expect(hash(raw)).toBe(observed().finalStateSha256);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([205, 'fool-v205']);
    expect(Object.hasOwn(raw, 'redPriest')).toBe(false);
    expect(Object.hasOwn(raw, 'visionary')).toBe(false);
    expect(Object.hasOwn(raw, 'perfecter')).toBe(false);
    expect(Object.hasOwn(raw, 'moon')).toBe(false);
    expect(Object.hasOwn(raw, 'darkness')).toBe(false);
    expect(Object.hasOwn(raw, 'whiteTower')).toBe(false);
    for (const root of ['tyrant', 'sun', 'death', 'door']) expect(Object.hasOwn(raw, root)).toBe(false);
    originalStateKeys = Object.keys(raw).sort();
  }
  return originalStateKeys;
}
/** Audit only: allow exactly the ten approved new roots and two version changes.
 * Every original field, including all nested history, remains in the hash. */
function historicalStateView(state: SliceState): HistoricalFoolState {
  keys(state, [...historicalStateKeys(), 'redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door']);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(state.redPriest).toStrictEqual(EMPTY_RED_PRIEST);
  expect(state.visionary).toStrictEqual(EMPTY_VISIONARY);
  expect(state.perfecter).toStrictEqual(EMPTY_PERFECTER);
  expect(state.moon).toStrictEqual(EMPTY_MOON);
  expect(state.darkness).toStrictEqual(EMPTY_DARKNESS);
  expect(state.whiteTower).toStrictEqual(EMPTY_WHITE_TOWER);
  expect(state.tyrant).toStrictEqual(EMPTY_TYRANT); expect(state.sun).toStrictEqual(EMPTY_SUN);
  assertEmptyDeathState(state); assertEmptyDoorState(state);
  const { redPriest: _emptyRedPriest, visionary: _emptyVisionary,
    perfecter: _emptyPerfecter, moon: _emptyMoon, darkness: _emptyDarkness, whiteTower: _emptyWhiteTower,
    tyrant: _emptyTyrant, sun: _emptySun, death: _emptyDeath, door: _emptyDoor, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 205, contentVersion: 'fool-v205' };
}
function current(raw: unknown): SliceState {
  const before = hash(raw), state = migrateSliceState(raw);
  assertValidSliceState(state);
  const historical = historicalStateView(state);
  expect(hash(raw), 'Migration preserves the complete original input').toBe(before);
  if (raw && typeof raw === 'object' && 'schemaVersion' in raw && raw.schemaVersion === 205) {
    keys(raw, historicalStateKeys());
    expect('contentVersion' in raw && raw.contentVersion).toBe('fool-v205');
    for (const [field, value] of Object.entries(raw)) same(historical[field as keyof HistoricalFoolState], value);
    same(historical, raw);
  }
  return state;
}

/** Remove only the ten verified inactive new chapters from this detached audit view.
 * Its complete remaining shape/content is still bound by the old public hash. */
function historicalPublicView(state: SliceState, projection: ReturnType<typeof projectSliceState>): Omit<ReturnType<typeof projectSliceState>, 'redPriest' | 'visionary' | 'perfecter' | 'moon' | 'darkness' | 'whiteTower' | 'tyrant' | 'sun' | 'death' | 'door'> {
  expect(state.progression.pathwayId).toBe('diviner');
  expect(state.redPriest).toStrictEqual(EMPTY_RED_PRIEST);
  expect(state.visionary).toStrictEqual(EMPTY_VISIONARY);
  expect(state.perfecter).toStrictEqual(EMPTY_PERFECTER);
  expect(state.moon).toStrictEqual(EMPTY_MOON);
  expect(state.darkness).toStrictEqual(EMPTY_DARKNESS);
  expect(state.whiteTower).toStrictEqual(EMPTY_WHITE_TOWER);
  expect(state.tyrant).toStrictEqual(EMPTY_TYRANT); expect(state.sun).toStrictEqual(EMPTY_SUN);
  assertEmptyDeathState(state); assertEmptyDoorState(state);
  expect(Object.hasOwn(projection, 'redPriest')).toBe(true);
  expect(projection.redPriest).toStrictEqual(projectPlayerText(projectRedPriest(state), state.character.name));
  expect(projection.redPriest.guidanceKnown).toBe(false); expect(projection.redPriest.promoted).toBe(false);
  expect(projection.redPriest.insideCase).toBe(false); expect(projection.redPriest.abilities).toEqual([]);
  expect(projection.redPriest.actions.every(action => !action.enabled)).toBe(true);
  for (const field of ['source', 'frame', 'journal']) expect(Object.hasOwn(projection.redPriest, field)).toBe(false);
  expect(Object.hasOwn(projection, 'visionary')).toBe(true);
  expect(projection.visionary).toStrictEqual(projectPlayerText(projectVisionary(state), state.character.name));
  expect(projection.visionary.guidanceKnown).toBe(false); expect(projection.visionary.promoted).toBe(false);
  expect(projection.visionary.insideCase).toBe(false); expect(projection.visionary.abilities).toEqual([]);
  expect(projection.visionary.actions.every(action => !action.enabled)).toBe(true);
  for (const field of ['source', 'frame', 'journal']) expect(Object.hasOwn(projection.visionary, field)).toBe(false);
  expect(Object.hasOwn(projection, 'perfecter')).toBe(true);
  expect(projection.perfecter).toStrictEqual(projectPlayerText(projectPerfecter(state), state.character.name));
  expect(Object.hasOwn(projection, 'moon')).toBe(true);
  expect(projection.moon).toStrictEqual(projectPlayerText(projectMoon(state), state.character.name));
  expect(Object.hasOwn(projection, 'darkness')).toBe(true);
  expect(projection.darkness).toStrictEqual(projectPlayerText(projectDarkness(state), state.character.name));
  expect(Object.hasOwn(projection, 'whiteTower')).toBe(true);
  expect(projection.whiteTower).toStrictEqual(projectPlayerText(projectWhiteTower(state), state.character.name));
  // Independently pin every discarded Darkness field, including the only
  // disabled control; a changed projector cannot redefine an inactive chapter.
  expect(projection.darkness).toStrictEqual({
    title: '序列0 黑暗', guidanceKnown: false, promoted: false,
    story: '原庭院里的人和物仍在原处。步行前往新街区，在白昼查路、问过四位成年人的意愿，入夜后用普通灯、原绳和亲身搀扶完成长夜撤离。',
    nextStep: '四人逐一在真实夜间抵达，再亲走返程；核清三份原特性，等待1353年真实事件后才交接同一唯一性，并为同一瓶付费准备。',
    risk: '完整准备按本人实际意志计算成功率，不改骰子。失败会留下伤势、污染并可能死亡。幸存者须原地封存、隔周付费回收，另购有限载体重新准备。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'darkness:0:LEARN_GUIDANCE', label: '听取长夜撤离与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的厄难骑士继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  // White Tower is discarded only after its entire inactive public shape is pinned.
  expect(projection.whiteTower).toStrictEqual({
    title: '序列0 白塔', guidanceKnown: false, promoted: false,
    story: '原资料室、埃德温的庭院、两张原纸与停止的器材留在原处。街区接待处收到市场台阶、运河检修廊和公寓后巷三处阻路求助；分别亲自问过居民、实勘、修补和验收，再让本人真实通过，并于下一周回来复核。',
    nextStep: '完成三处原居民的真实通过与隔周复核；核清本人已有的一份和另外两份原特性，实地确认同一唯一性空位，再为同一本人的同一瓶付费准备。',
    risk: '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'white-tower:0:LEARN_GUIDANCE', label: '听取三条通路与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的全知之眼本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  for (const root of [projection.perfecter, projection.moon, projection.darkness, projection.whiteTower]) {
    keys(root, ['title', 'guidanceKnown', 'promoted', 'story', 'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase']);
    expect(root.guidanceKnown).toBe(false); expect(root.promoted).toBe(false);
    expect(root.insideCase).toBe(false); expect(root.abilities).toEqual([]); expect(root.sections).toEqual([]);
    expect(root.actions.every(action => !action.enabled)).toBe(true);
    for (const field of ['source', 'frame', 'journal']) expect(Object.hasOwn(root, field)).toBe(false);
  }
  assert.equal(Object.hasOwn(projection, 'tyrant'), true);
  assert.deepEqual(projection.tyrant, {
    title: '序列0 暴君', guidanceKnown: false, promoted: false,
    story: '原小湾与旧人原物继续保留。三岸共二十七万原居民各有当前意愿与有限粮食；履约、隔周复核和真实航运不能用证书代替。另一位太阳真神独立敌对，单独挑战并真实存活才计入晋升经历。',
    nextStep: state.progression.sequence === 1
      ? '维持至少二十万同一在世居民同时恐惧、服从并信仰；本人单独挑战另一位真神后存活，取得原三份特性与同一唯一性，在当前氛围中完成同瓶付费准备。'
      : '先继续雷神的真实原三份续筹、晋升和三案反思；历史独立第四份不能改写为同根回收件。',
    risk: '晋升成功率按当前意志与本次付费准备计算；失败实际重伤、污染或死亡，没有免费重试。药液与普通载体耗用，原特性仍守恒，回收必须按真实原处和隔周条件完成。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'tyrant:0:LEARN_GUIDANCE', label: '听取暴君晋升与三岸原人群指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的雷神本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  assert.equal(Object.hasOwn(projection, 'sun'), true);
  assert.deepEqual(projection.sun, {
    title: '序列0 太阳', guidanceKnown: false, promoted: false,
    story: '玛拉与芦影、原采光廊和投降的西拉斯都留在原处，旧许可、伤势和耗料继续保留。街区接待处有洗衣房与邻楼后阶两件居民求助；须亲自问清情况、处理实际原物并完成交接，普通手段也能完成。',
    nextStep: '完成两件居民服务与现场核验；核清本人已有的一份和另外两份原特性，实地确认同一太阳唯一性空位，再为同一本人的同一瓶付费准备。实际晋1满十二周才可服药。',
    risk: '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'sun:0:LEARN_GUIDANCE', label: '听取两件服务与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的纯白天使本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  assertEmptyDeathPublic(projection, state); assertEmptyDoorPublic(projection, state);
  const { redPriest: _emptyRedPriest, visionary: _emptyVisionary,
    perfecter: _emptyPerfecter, moon: _emptyMoon, darkness: _emptyDarkness, whiteTower: _emptyWhiteTower,
    tyrant: _emptyTyrant, sun: _emptySun, death: _emptyDeath, door: _emptyDoor, ...originalFields } = projection;
  return originalFields;
}
function budget(s: SliceState) {
  return { revision: s.revision, week: s.week, date: s.date, status: s.status, sequence: s.progression.sequence,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining,
    pollution: s.seer.pollution, cursor: s.random.cursor, second: s.fool.frame?.nowSecond ?? null, location: s.fool.frame?.location ?? 'base' };
}
interface Boundary {
  phase: string; commandCount: number; commandIndex0: number; revision: number; stateSha256: string;
  beforeCommandCount?: number; beforeStateSha256?: string; intent?: SliceIntent; intentCommitted?: boolean;
  budget: ReturnType<typeof budget>;
  replayFrom: { file: string; key: string; sourceCommandCount: number; migrateToSchema: number };
  inclusiveTailRange0: [number, number];
}
interface Index { format: string; source: string; sourceSha256: string; prefixCount: number; originalMigratedStateSha256: string; boundaries: Record<string, Boundary> }
interface Row {
  commandCount: number; phase: string; intent: SliceIntent;
  publicControl: { id: string; label: string; cost: string; enabled: true };
  before: ReturnType<typeof budget>; after: ReturnType<typeof budget>; journalEventId: string | null;
}
interface StateRow { index: number; commandCount: number; stateSha256: string; publicSha256?: string }
interface BaselineStateRow extends StateRow { publicSha256: string; random: SliceState['random']; budget: ReturnType<typeof budget> }
interface Interruption { kind: string; originalProcessTerminated: boolean; freezeSha256: string; lastCompleteCommandCount: number;
  newCompleteCommandRows: number; completePrivateStatePersisted: boolean; partialNextAction: string; finalRecordedBudget: ReturnType<typeof budget>; files: Record<string, FilePin> }
interface BaselineSummary { kind: string; mode: string; passed: boolean; newCommands: number; final: ReturnType<typeof budget>; stateSha256: string; publicSha256: string;
  ledgerHash: string; freeze: string; originalCapturedFullState: boolean; allOriginalRecordedBudgetsControlsCursorsVerified: boolean; optimizedStateByStateEquivalent: boolean }
interface Report {
  stage: CaptureStage; phase: string; error: Observation['error']; integrityError: string | null;
  commands: number; prefixCount: number; newCommands: number; final: ReturnType<typeof budget>;
  boundaries: string[]; historicalPrefixReplay: string; sqlite: string; desktop: string;
  resumeProvenance: ResumeProvenance;
  potions: { prepared: number; consumed: number; succeeded: number; failed: number; attempts: Array<{ commandCount: number; eventId: string; compoundId: string; outcome: string }> };
}
async function* rows(): AsyncGenerator<Row> {
  const stream = createReadStream(fixturePath('commands.jsonl'), { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length, 'No blank committed ledger rows').toBeGreaterThan(0); yield JSON.parse(line) as Row; } }
  finally { lines.close(); stream.destroy(); }
}
const inventory = () => [SOURCE_PATH, ...FILES.map(fixturePath)].map(path => {
  const s = statSync(path); return { path, bytes: s.size, mtimeMs: s.mtimeMs, ctimeMs: s.ctimeMs };
});
const keys = (v: object, expected: readonly string[]): void => expect(Object.keys(v).sort()).toEqual([...expected].sort());

/** Precise chapter shape, with a targeted whole-projection private-key guard.
 * Public lastCheck.roll, modifiers[].source, and action branch intent are legal;
 * private source objects, hidden causal facts and RNG cursors/receipts are not. */
function assertPublicFool(f: FoolProjection): void {
  keys(f, ['title', 'guidanceKnown', 'promoted', 'story', 'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase']);
  keys(f.resources, ['health', 'mind', 'spirituality', 'cash', 'actionsRemaining']);
  for (const a of f.abilities) keys(a, ['id', 'label', 'mastery', 'description']);
  for (const a of f.actions) {
    keys(a, ['id', 'label', 'cost', 'enabled', 'reason', 'command', ...(Object.hasOwn(a, 'preferredAction') ? ['preferredAction'] : [])]);
    expect(validateFoolCommand(a.command)).toBe(true);
  }
  for (const s of f.sections) keys(s, ['id', 'title', 'lines']);
  const prose = [f.title, f.story, f.nextStep, f.risk, ...f.abilities.flatMap(a => [a.label, a.description]),
    ...f.actions.flatMap(a => [a.label, a.cost, a.reason ?? '']), ...f.sections.flatMap(s => [s.title, ...s.lines])].join('\n');
  expect(prose).not.toMatch(/seed|cursor|receipt|digest|UNALTERED_BINDING|VERIFIED_DEVIATION|SHIELD_MAIN|SIDE_CHANNEL|TRAPPED|DORMANT/i);
}
function assertPublicProjection(p: ReturnType<typeof projectSliceState>): void {
  for (const k of ['source', 'frame', 'journal', 'sourceHistory', 'sourceScene', 'fateReceipts']) expect(Object.hasOwn(p, k), k).toBe(false);
  const denied = new Set(['seed', 'cursor', 'random', 'randomSeed', 'randomCursor', 'cursorBefore', 'cursorAfter', 'randomCursorBefore', 'randomCursorAfter',
    'randomBefore', 'randomAfter', 'truth', 'hiddenTruth', 'worldFacts', 'worldDigest', 'originDigest', 'sourceHistoryDigest', 'beforeDigest', 'afterDigest', 'randomReceipts', 'checkReceipts']);
  const walk = (v: unknown): void => {
    if (typeof v === 'string') { expect(v).not.toContain(SEED); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, child] of Object.entries(v)) { expect(denied.has(k), k).toBe(false); walk(child); }
  };
  walk(p); assertPublicFool(p.fool);
  if (p.lastCheck !== null) {
    keys(p.lastCheck, ['ability', 'baseAbility', 'modifiers', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier']);
    for (const m of p.lastCheck.modifiers) keys(m, ['source', 'value']);
  }
}
function assertRandom(before: SliceState, intent: Extract<SliceIntent, { type: 'FOOL' }>, after: SliceState): void {
  expect(after.random.seed).toBe(SEED);
  if (intent.command.type === 'LEARN_GUIDANCE') { same(after.random, before.random); expect(after.fool.journal).toEqual([]); return; }
  expect(after.fool.journal.length).toBe(before.fool.journal.length + 1);
  const event = after.fool.journal.at(-1)!;
  expect(event.revision).toBe(after.revision); same(event.command, intent.command);
  same(event.before.random, before.random); same(event.after.random, after.random);
  const stream = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
  for (const receipt of event.randomReceipts) {
    expect(receipt.cursorBefore).toBe(stream.cursor);
    if (receipt.kind === 'CHECK') expect(receipt.check.roll).toBe(stream.nextInt(1, 100));
    else { expect(receipt.kind).toBe('ROLL'); expect(receipt.value).toBe(stream.nextInt(receipt.min, receipt.max)); }
    expect(receipt.cursorAfter).toBe(stream.cursor);
  }
  expect(stream.cursor, 'Exactly one receipt per actual draw; no skipped/repeated draw').toBe(after.random.cursor);
}

async function assertTransition(e: Observation, commands: SliceIntent[], freeze: Freeze, originalProvenance: ResumeProvenance, strategy: unknown): Promise<RuntimeTransition> {
  const m = json<RuntimeTransition>('runtime-transition.json'), cp = m.checkpoint, c = cp.control;
  keys(m, ['format', 'kind', 'checkpoint', 'oldFreeze', 'newFreeze', 'changedFiles']);
  expect(m.format).toBe('FOOL208_PINNED_RUNTIME_TRANSITION_V1'); expect(m.kind).toBe('CANONICAL_MATERIAL_REPLAY_AND_PREVIEW_AUDIT_WITH_SAME_ROOT_HISTORY_REUSE_ONLY');
  keys(cp, ['file', 'bytes', 'sha256', 'control', 'finalPublicSha256', 'finalPublicEvidence']);
  expect(cp.file).toBe(TRANSITION.checkpointFile); expect(cp.bytes).toBe(TRANSITION.checkpointBytes); expect(cp.sha256).toBe(TRANSITION.checkpointSha256);
  keys(c, ['format', 'resumable', 'reason', 'source', 'sourceSha256', 'sourceCommandsSha256', 'strategy', 'currentRuntimeFreezeSha256', 'resumeProvenance',
    'commandCount', 'phase', 'ledgerSha256', 'boundaries', 'observations', 'receptionActions', 'materialAttempts', 'beforeLastCommandCount', 'beforeLastStateSha256',
    'lastIntent', 'pendingIntent', 'finalStateSha256', 'continuationMeaning', 'commandsSha256', 'commandRowsSha256', 'stateRowsSha256']);
  // This authenticates all small checkpoint controls. The test replays commands,
  // not the producer strategy loops; it does not claim to recalculate counters.
  expect(compactHash(c)).toBe(TRANSITION.controlSha256);
  expect(c).toMatchObject({ format: 'FOOL208_DURABLE_ACTION_BOUNDARY_V1', resumable: true, reason: 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY',
    source: SOURCE, sourceSha256: SOURCE_SHA, sourceCommandsSha256: PREFIX_SHA, currentRuntimeFreezeSha256: PAUSED_FREEZE,
    commandCount: PAUSED_COUNT, beforeLastCommandCount: PAUSED_COUNT - 1, pendingIntent: null, finalStateSha256: TRANSITION.finalStateSha256,
    continuationMeaning: 'INSIDE_GO_AFTER_COMMIT_BEFORE_CALLER_CONTINUES; REPLAY_THE_STRATEGY_TO_RESTORE_ALL_LOCALS' });
  same(c.strategy, strategy); same(c.resumeProvenance, originalProvenance);
  expect(m.oldFreeze.sha256).toBe(PAUSED_FREEZE); expect(m.newFreeze.sha256).toBe(e.captureRuntimeFreezeSha256); same(m.newFreeze, freeze);
  for (const f of [m.oldFreeze, m.newFreeze]) {
    keys(f, ['sha256', 'files']); expect(compactHash(f.files)).toBe(f.sha256); expect(new Set(f.files.map(row => row.file)).size).toBe(f.files.length);
    for (const row of f.files) { keys(row, ['file', 'bytes', 'sha256']); expect(Number.isSafeInteger(row.bytes)).toBe(true); expect(row.bytes).toBeGreaterThanOrEqual(0); expect(row.sha256).toMatch(/^[a-f0-9]{64}$/); }
  }
  same(m.oldFreeze.files.map(row => row.file), m.newFreeze.files.map(row => row.file));
  const differences = m.oldFreeze.files.flatMap((before, i) => {
    const after = m.newFreeze.files[i]!;
    return compactHash(before) === compactHash(after) ? [] : [{ file: before.file, before: { bytes: before.bytes, sha256: before.sha256 }, after: { bytes: after.bytes, sha256: after.sha256 } }];
  }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  same(differences.map(row => row.file), TRANSITION.changedFiles); same(m.changedFiles, differences);
  expect(compactHash(commands.slice(0, PAUSED_COUNT))).toBe(c.commandsSha256);
  const rawPrefix = await firstCompleteLines(fixturePath('commands.jsonl'), PAUSED_ROWS);
  expect(createHash('sha256').update(rawPrefix).digest('hex')).toBe(c.ledgerSha256);
  const rows = rawPrefix.toString('utf8').slice(0, -1).split('\n').map(line => JSON.parse(line) as Row);
  expect(compactHash(rows)).toBe(c.commandRowsSha256);
  for (const [i, row] of rows.entries()) { expect(row.commandCount).toBe(PREFIX + i + 1); same(row.intent, commands[PREFIX + i]); }
  same(rows.at(-1)!.intent, c.lastIntent); expect(rows.at(-1)!.phase).toBe(c.phase);
  const states = jsonLines<StateRow>('states.jsonl').slice(0, PAUSED_ROWS + 1); expect(states).toHaveLength(PAUSED_ROWS + 1);
  expect(compactHash(states)).toBe(c.stateRowsSha256); expect(states.at(-2)!.stateSha256).toBe(c.beforeLastStateSha256); expect(states.at(-1)!.stateSha256).toBe(c.finalStateSha256);
  const boundaries = json<Index>('boundaries.index.json').boundaries;
  for (const [name, b] of Object.entries(c.boundaries)) same(boundaries[name], b);
  const proof = cp.finalPublicEvidence;
  keys(proof, ['kind', 'file', 'bytes', 'sha256', 'rawText']);
  expect(proof.kind).toBe('COMPUTED_FROM_EXACT_PAUSED_PRIVATE_STATE_WITH_FROZEN_PREVIOUS_RUNTIME'); expect(proof.file).toBe(TRANSITION.publicEvidenceFile);
  expect(proof.bytes).toBe(TRANSITION.publicEvidenceBytes); expect(proof.sha256).toBe(TRANSITION.publicEvidenceSha256);
  expect(Buffer.byteLength(proof.rawText)).toBe(proof.bytes); expect(createHash('sha256').update(proof.rawText).digest('hex')).toBe(proof.sha256);
  expect(cp.finalPublicSha256).toBe(TRANSITION.finalPublicSha256);
  expect(JSON.parse(proof.rawText)).toMatchObject({ mode: 'before', freeze: PAUSED_FREEZE, checkpoint: TRANSITION.checkpointSha256,
    initial: TRANSITION.finalStateSha256, public: TRANSITION.finalPublicSha256 });
  return m;
}

describe.sequential('Fool original1868 continuation with explicit original43 reconstruction evidence', () => {
  beforeAll(assertReviewedHistoricalRuntimeProof, 240_000);
  afterAll(assertReviewedHistoricalRuntimeProof, 240_000);
  it('limits the historical audit view to the exact original keys and ten strictly empty current chapters', () => {
    const raw = entry<HistoricalFoolState>('final');
    expect(EMPTY_RED_PRIEST).toStrictEqual(createRedPriestState());
    expect(EMPTY_VISIONARY).toStrictEqual(createVisionaryState());
    expect(EMPTY_PERFECTER).toStrictEqual(createPerfecterState());
    expect(EMPTY_MOON).toStrictEqual(createMoonState());
    expect(EMPTY_DARKNESS).toStrictEqual(createDarknessState());
    expect(EMPTY_WHITE_TOWER).toStrictEqual(createWhiteTowerState());
    expect(EMPTY_TYRANT).toStrictEqual(createTyrantState()); expect(EMPTY_SUN).toStrictEqual(createSunState());
    // This is only an audit-helper guard; actual migration/loading is tested below.
    const shape: SliceState = { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION,
      redPriest: structuredClone(EMPTY_RED_PRIEST), visionary: structuredClone(EMPTY_VISIONARY),
      perfecter: structuredClone(EMPTY_PERFECTER), moon: structuredClone(EMPTY_MOON), darkness: structuredClone(EMPTY_DARKNESS),
      whiteTower: structuredClone(EMPTY_WHITE_TOWER), tyrant: structuredClone(EMPTY_TYRANT),
      sun: structuredClone(EMPTY_SUN), death: createDeathState(), door: createDoorState() };
    same(historicalStateView(shape), raw);
    expect(() => historicalStateView({ ...shape, unexpectedRoot: null } as SliceState)).toThrow();
    const { fool: _missingOriginalRoot, ...missingOriginal } = shape;
    expect(() => historicalStateView(missingOriginal as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, redPriest: { ...shape.redPriest, guidanceKnown: true } })).toThrow();
    expect(() => historicalStateView({ ...shape, redPriest: { ...shape.redPriest, unexpectedField: undefined } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, visionary: { ...shape.visionary, guidanceKnown: true } })).toThrow();
    expect(() => historicalStateView({ ...shape, visionary: { ...shape.visionary, unexpectedField: undefined } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, perfecter: { ...shape.perfecter, guidanceKnown: true } })).toThrow();
    expect(() => historicalStateView({ ...shape, perfecter: { ...shape.perfecter, unexpectedField: undefined } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, moon: { ...shape.moon, guidanceKnown: true } })).toThrow();
    expect(() => historicalStateView({ ...shape, moon: { ...shape.moon, unexpectedField: undefined } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, darkness: { ...shape.darkness, guidanceKnown: true } })).toThrow();
    expect(() => historicalStateView({ ...shape, darkness: { ...shape.darkness, unexpectedField: undefined } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, darkness: { ...shape.darkness,
      promotionStability: { preparations: [], unexpectedField: undefined } } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, whiteTower: { ...shape.whiteTower, guidanceKnown: true } })).toThrow();
    expect(() => historicalStateView({ ...shape, whiteTower: { ...shape.whiteTower, unexpectedField: undefined } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, whiteTower: { ...shape.whiteTower,
      promotionStability: { preparations: [], unexpectedField: undefined } } } as SliceState)).toThrow();
    expect(() => historicalStateView({ ...shape, whiteTower: null } as unknown as SliceState)).toThrow();
    const { perfecter: _missingPerfecter, ...missingPerfecter } = shape;
    const { moon: _missingMoon, ...missingMoon } = shape;
    const { darkness: _missingDarkness, ...missingDarkness } = shape;
    const { whiteTower: _missingWhiteTower, ...missingWhiteTower } = shape;
    expect(() => historicalStateView(missingPerfecter as SliceState)).toThrow();
    expect(() => historicalStateView(missingMoon as SliceState)).toThrow();
    expect(() => historicalStateView(missingDarkness as SliceState)).toThrow();
    expect(() => historicalStateView(missingWhiteTower as SliceState)).toThrow();
    for (const root of ['tyrant', 'sun', 'death', 'door'] as const) {
      const { [root]: _missing, ...missing } = shape;
      expect(() => historicalStateView(missing as SliceState)).toThrow();
      for (const value of [null, { ...shape[root], guidanceKnown: true },
        { ...shape[root], unexpectedField: undefined },
        { ...shape[root], promotionStability: { preparations: [], unexpectedField: undefined } }])
        expect(() => historicalStateView({ ...shape, [root]: value } as SliceState)).toThrow();
    }
    expect(() => historicalStateView({ ...shape, schemaVersion: 205 } as unknown as SliceState)).toThrow();
    expect(hash(historicalStateView({ ...shape, cash: shape.cash + 1 })), 'An old field is never normalized away').not.toBe(hash(raw));
  });
  it('requires reviewed actual observations and immutable restored inputs, preserving both raw original roots', async () => {
    const e = observed();
    expect(e.commands).toBeGreaterThanOrEqual(PAUSED_COUNT); expect(e.commands).toBeLessThanOrEqual(PREFIX + 1600);
    expect(statSync(SOURCE_PATH).size).toBe(19_873_527); expect(await fileHash(SOURCE_PATH)).toBe(SOURCE_SHA);
    keys(e.files, FILES);
    expect(readdirSync(ROOT).sort()).toEqual(['natural.json', 'commands.jsonl', 'states.jsonl', 'boundaries.index.json', 'report.json', 'freeze.json', 'runtime-transition.json', 'final-runtime-proof.json', PROOF].sort());
    expect(readdirSync(fixturePath(PROOF)).sort()).toEqual(['interruption.json', 'terminated-commands.jsonl', 'freeze-before-natural.json', 'baseline'].sort());
    expect(readdirSync(fixturePath(`${PROOF}/baseline`)).sort()).toEqual(['summary.json', 'states.jsonl'].sort());
    for (const name of FILES) {
      const path = fixturePath(name); expect(realpathSync(path)).toBe(resolve(path));
      expect(statSync(path).size).toBe(e.files[name].bytes); expect(await fileHash(path)).toBe(e.files[name].sha256);
    }
    for (const [file, sha] of Object.entries(ORIGINAL_PROOF_SHAS)) expect(await fileHash(fixturePath(file))).toBe(sha);
    const commands = entry<SliceIntent[]>('commands'), oldCommands = sourceEntry<SliceIntent[]>('commands');
    expect(oldCommands).toHaveLength(PREFIX); expect(commands).toHaveLength(e.commands);
    expect(commands.slice(PREFIX)).toHaveLength(215); expect(compactHash(commands.slice(PREFIX))).toBe(e.tailCommandsSha256);
    same(commands.at(-1), { type: 'FOOL', command: { type: 'ESCAPE', command: { type: 'REPORT' } } });
    expect(compactHash(oldCommands)).toBe(PREFIX_SHA); expect(compactHash(commands.slice(0, PREFIX))).toBe(PREFIX_SHA); same(commands.slice(0, PREFIX), oldCommands);
    expect(sourceEntry('prefixCount')).toBe(RAW_INITIAL_COUNT); expect(entry('prefixCount')).toBe(PREFIX); expect(entry('seed')).toBe(SEED);
    for (const [captured, original] of [['initial', 'initial'], ['prefixFinal', 'final'], ['creation', 'creation']] as const) same(entry(captured), sourceEntry(original));
    for (const key of ['initial', 'prefixFinal']) {
      const raw = entry<Record<string, unknown>>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([183, 'attendant-mysteries-v183']);
      expect(Object.hasOwn(raw, 'fool')).toBe(false); const next = current(raw) as unknown as Record<string, unknown>;
      for (const [field, value] of Object.entries(raw)) if (!['schemaVersion', 'contentVersion'].includes(field)) same(next[field], value);
    }
    expect(entry<SliceState>('initial').revision).toBe(1857); expect(entry<SliceState>('prefixFinal').revision).toBe(1869);
    for (const key of ['beforeLast', 'final']) { const raw = entry<SliceState>(key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([205, 'fool-v205']); current(raw); }
    const provenance = entry<Record<string, unknown>>('provenance');
    expect(provenance).toMatchObject({ kind: 'SAME_SEED_ORIGINAL_FULL1868_PUBLIC_FOOL_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA,
      sourcePrefixCount: PREFIX, sourceCommandsSha256: PREFIX_SHA, sourceInitialCommandCount: RAW_INITIAL_COUNT,
      initialMeans: 'EXACT_RAW_SOURCE_INITIAL_AT_COMMAND_1856', prefixFinalMeans: 'EXACT_RAW_SOURCE_FINAL_AT_COMMAND_1868',
      producerPrefixReplay: 'NOT_RUN', migration: 205, freezeSha256: e.captureRuntimeFreezeSha256, newRandomChanges: false });
    same(provenance.sourceProvenance, sourceEntry('provenance'));
    expect(provenance.strategy).toMatchObject({ id: 'FOOL208_SAME_ORIGINAL_PUBLIC_FINITE_V1', maxNewCommands: 1600,
      fateCommissions: 3, graftAttemptsPerCommission: 1, potionAttempts: 3, stationVisitsPerStation: 3 });
    const freeze = json<Freeze>('freeze.json');
    expect(freeze.sha256).toBe(e.captureRuntimeFreezeSha256); expect(compactHash(freeze.files)).toBe(e.captureRuntimeFreezeSha256);
    expect(new Set(freeze.files.map(f => f.file)).size).toBe(freeze.files.length);
    expect(freeze.files.find(f => f.file === '$natural-runner')?.sha256).toBe(e.captureProducerSha256);
    expect(freeze.files.find(f => f.file === SOURCE)?.sha256).toBe(SOURCE_SHA);
    // Historical producer identity stays pinned above. The suite hooks bind the
    // separate historical final-runtime review, not today's source or producer.
    // Original freeze and completed-capture freeze are separately authenticated.
    // The original run has NO persisted complete private state or boundary tree.
    const interruption = json<Interruption>(`${PROOF}/interruption.json`), baseline = json<BaselineSummary>(`${PROOF}/baseline/summary.json`);
    const originalFreeze = json<typeof freeze>(`${PROOF}/freeze-before-natural.json`), reconstructed = jsonLines<BaselineStateRow>(`${PROOF}/baseline/states.jsonl`);
    expect(interruption).toMatchObject({ kind: 'EXPLICIT_MANUAL_INTERRUPTION_PARTIAL_CAPTURE', originalProcessTerminated: true,
      completePrivateStatePersisted: false, freezeSha256: ORIGINAL_FREEZE, lastCompleteCommandCount: INTERRUPTED_COUNT, newCompleteCommandRows: INTERRUPTED_ROWS,
      partialNextAction: 'UNKNOWN_NO_COMPLETED_LEDGER_ROW; not counted or claimed completed' });
    expect(originalFreeze.sha256).toBe(ORIGINAL_FREEZE); expect(compactHash(originalFreeze.files)).toBe(ORIGINAL_FREEZE);
    expect(new Set(originalFreeze.files.map(f => f.file)).size).toBe(originalFreeze.files.length);
    expect(originalFreeze.files.find(f => f.file === SOURCE)?.sha256).toBe(SOURCE_SHA);
    expect(originalFreeze.files.find(f => f.file === '$natural-runner')?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(e.captureRuntimeFreezeSha256).not.toBe(ORIGINAL_FREEZE);
    expect(e.captureProducerSha256).not.toBe(originalFreeze.files.find(f => f.file === '$natural-runner')?.sha256);
    for (const file of ['terminated-commands.jsonl', 'freeze-before-natural.json'] as const) same(e.files[`${PROOF}/${file}`], interruption.files[file]);
    expect(baseline).toMatchObject({ kind: RECONSTRUCTION_KIND, mode: 'baseline', passed: true, newCommands: INTERRUPTED_ROWS, freeze: ORIGINAL_FREEZE,
      originalCapturedFullState: false, allOriginalRecordedBudgetsControlsCursorsVerified: true, optimizedStateByStateEquivalent: false });
    expect(reconstructed).toHaveLength(INTERRUPTED_ROWS + 1); const reconstructedLast = reconstructed.at(-1)!;
    expect(reconstructedLast.stateSha256).toBe(baseline.stateSha256); expect(reconstructedLast.publicSha256).toBe(baseline.publicSha256);
    same(reconstructedLast.budget, baseline.final); same(baseline.final, interruption.finalRecordedBudget);
    expect(baseline.ledgerHash).toBe(e.files[`${PROOF}/terminated-commands.jsonl`].sha256);
    expect(await fileHash(fixturePath('commands.jsonl'), e.files[`${PROOF}/terminated-commands.jsonl`].bytes)).toBe(baseline.ledgerHash);
    const originalRows = jsonLines<Row>(`${PROOF}/terminated-commands.jsonl`); expect(originalRows).toHaveLength(INTERRUPTED_ROWS);
    same(commands.slice(PREFIX, INTERRUPTED_COUNT), originalRows.map(row => row.intent));
    const resume = provenance.resumeProvenance as ResumeProvenance;
    // Linux-recorded provenance strings are fixed POSIX metadata even on Windows.
    // Never dereference these recorded paths or accept caller-selected siblings.
    expect(resume.originalCapture.interruptionFile).toBe(posix.join(ORIGINAL_RECORDED_ROOT, 'interruption.json'));
    const originalProvenance: ResumeProvenance = { kind: 'EXACT_FINITE_STRATEGY_RECONSTRUCTION_OF_ORIGINAL_INTERRUPTED_PREFIX',
      originalCapture: { interruptionFile: resume.originalCapture.interruptionFile, interruptionSha256: e.files[`${PROOF}/interruption.json`].sha256,
        originalCaptureFreezeSha256: ORIGINAL_FREEZE, originalCapturedFullState: false, completedNewCommands: INTERRUPTED_ROWS, lastCompleteCommandCount: INTERRUPTED_COUNT,
        ledgerFile: posix.join(ORIGINAL_RECORDED_ROOT, 'terminated-commands.jsonl'), ledgerSha256: baseline.ledgerHash, partialNextAction: interruption.partialNextAction },
      reconstruction: { kind: RECONSTRUCTION_KIND, originalFrozenRuntimeBaselineStatesFile: posix.join(ORIGINAL_RECORDED_ROOT, 'baseline/states.jsonl'),
        baselineStatesSha256: e.files[`${PROOF}/baseline/states.jsonl`].sha256, baselineFinalStateSha256: baseline.stateSha256, baselineFreezeSha256: ORIGINAL_FREEZE,
        originalBoundarySnapshotsCaptured: false, boundaryHashesMeaning: 'REGENERATED_BY_EXACT_STRATEGY_FROM_FULL_STATE_EQUIVALENT_RECONSTRUCTION' },
      currentRuntimeFreezeSha256: PAUSED_FREEZE, continuation: 'SAME_FINITE_STRATEGY_WITH_REPLAY_RESTORED_COUNTERS',
      replayEffects: 'IN_MEMORY_ONLY_NO_DUPLICATE_AUDIT_ROWS', verifiedCompletedRows: INTERRUPTED_ROWS, verifiedStates: INTERRUPTED_ROWS + 1 };
    await assertTransition(e, commands, freeze, originalProvenance, provenance.strategy);
    same(resume, { ...originalProvenance, currentRuntimeFreezeSha256: e.captureRuntimeFreezeSha256, verifiedCompletedRows: PAUSED_ROWS, verifiedStates: PAUSED_ROWS + 1,
      runtimeTransition: { kind: 'EXACT_PAUSED_CHECKPOINT_REPLAY_WITH_APPROVED_RUNTIME_TRANSITION', manifestFile: TRANSITION.manifestFile,
        manifestSha256: e.files['runtime-transition.json'].sha256, checkpointFile: TRANSITION.checkpointFile, checkpointSha256: TRANSITION.checkpointSha256,
        previousRuntimeFreezeSha256: PAUSED_FREEZE, currentRuntimeFreezeSha256: e.captureRuntimeFreezeSha256, commandCount: PAUSED_COUNT, finalStateSha256: TRANSITION.finalStateSha256 } });
    const report = json<Report>('report.json');
    expect(report.stage).toBe(e.stage); expect(report.phase).toBe(e.phase); same(report.error, e.error);
    same(report.resumeProvenance, resume);
    expect(report.integrityError).toBeNull(); expect(report.historicalPrefixReplay).toBe('NOT_RUN_BY_PRODUCER');
    expect(report.sqlite).toBe('NOT_RUN'); expect(report.desktop).toBe('NOT_RUN');
    expect(report.commands).toBe(e.commands); expect(report.newCommands).toBe(e.commands - PREFIX); expect(report.prefixCount).toBe(PREFIX);
    expect(entry('stage')).toBe(e.stage); expect(entry('phase')).toBe(e.phase); same(entry('error'), e.error); expect(entry('reportFile')).toBe('report.json');
    expect(hash(entry('final'))).toBe(e.finalStateSha256); same(report.final, e.finalBudget);
    expect(hash(entry('beforeLast'))).toBe(e.beforeLastStateSha256); expect(entry('beforeLastCommandCount')).toBe(2082);
    expect(entry('pendingIntent')).toBeNull(); same(entry('lastIntent'), commands.at(-1));
  }, 240_000);

  it('replays the independently captured original1856-to1868 tail into the exact CURRENT migrated prefix root', () => {
    observed(); const commands = sourceEntry<SliceIntent[]>('commands');
    let state = current(sourceEntry('initial'));
    for (let i = RAW_INITIAL_COUNT; i < PREFIX; i++) {
      const before = state, immutable = hash(before), intent = commands[i]!;
      expect(before.status).toBe('ACTIVE'); expect(validateSlicePayload(intent)).toBe(true);
      state = applySliceIntent(before, intent); assertValidSliceState(state);
      historicalStateView(state);
      expect(hash(before)).toBe(immutable); expect(state.revision).toBe(before.revision + 1);
      expect(state.random.seed).toBe(SEED); expect(state.random.cursor).toBeGreaterThanOrEqual(before.random.cursor);
    }
    same(state, current(sourceEntry('final'))); same(state, current(entry('prefixFinal')));
  }, 600_000);

  it('replays every committed Fool command once, proving original44 reconstructed states, paused69 private states and every continuation state/RNG', async () => {
    const e = observed(), beforeFiles = inventory(), commands = entry<SliceIntent[]>('commands'), index = json<Index>('boundaries.index.json'), report = json<Report>('report.json');
    const transition = json<RuntimeTransition>('runtime-transition.json');
    const oldEndpointPublic = JSON.parse(transition.checkpoint.finalPublicEvidence.rawText) as { random: SliceState['random'] };
    const capturedStates = jsonLines<StateRow>('states.jsonl'), reconstructed = jsonLines<BaselineStateRow>(`${PROOF}/baseline/states.jsonl`), originalRows = jsonLines<Row>(`${PROOF}/terminated-commands.jsonl`);
    expect(capturedStates).toHaveLength(commands.length - PREFIX + 1); expect(reconstructed).toHaveLength(INTERRUPTED_ROWS + 1); expect(originalRows).toHaveLength(INTERRUPTED_ROWS);
    for (const [i, row] of capturedStates.entries()) {
      keys(row, ['index', 'commandCount', 'stateSha256', ...(i <= INTERRUPTED_ROWS ? ['publicSha256'] : [])]);
      expect(row.index).toBe(i); expect(row.commandCount).toBe(PREFIX + i); expect(row.stateSha256).toMatch(/^[a-f0-9]{64}$/);
      if (i <= INTERRUPTED_ROWS) {
        const b = reconstructed[i]!; keys(b, ['index', 'commandCount', 'stateSha256', 'publicSha256', 'random', 'budget']);
        expect(b.index).toBe(i); expect(b.commandCount).toBe(PREFIX + i); expect(b.publicSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(row.stateSha256).toBe(b.stateSha256); expect(row.publicSha256).toBe(b.publicSha256);
        expect(b.random.seed).toBe(SEED); expect(Number.isSafeInteger(b.random.cursor)).toBe(true); expect(b.random.cursor).toBe(b.budget.cursor);
      }
    }
    expect(index.format).toBe('FOOL208_HASHED_COMMAND_BOUNDARIES_V1'); expect(index.source).toBe(SOURCE); expect(index.sourceSha256).toBe(SOURCE_SHA); expect(index.prefixCount).toBe(PREFIX);
    same(entry('boundaries'), index.boundaries); same(report.boundaries, Object.keys(index.boundaries)); expect(Object.keys(index.boundaries)).toHaveLength(e.namedBoundaries);
    same(Object.fromEntries(Object.entries(index.boundaries).map(([name, b]) => [name, b.commandCount])), e.boundaryCommands);
    expect(new Set(Object.values(index.boundaries).map(b => b.commandCount)).size).toBe(33);
    const committed = Object.values(index.boundaries).filter(b => b.intentCommitted); expect(committed).toHaveLength(33);
    expect(new Set(committed.map(b => `${b.beforeCommandCount}->${b.commandCount}`)).size).toBe(32);
    expect(index.originalMigratedStateSha256).toBe(e.originalMigratedStateSha256);
    const byCount = new Map<number, Array<[string, Boundary]>>(), needed = new Set(capturedStates.map(row => row.commandCount));
    const beforeLastCount = entry<number>('beforeLastCommandCount'), pending = entry<SliceIntent | null>('pendingIntent');
    expect(beforeLastCount).toBe(2082); expect(pending).toBeNull(); needed.add(beforeLastCount);
    for (const [name, b] of Object.entries(index.boundaries)) {
      expect(Number.isSafeInteger(b.commandCount)).toBe(true); expect(b.commandCount).toBeGreaterThanOrEqual(PREFIX); expect(b.commandCount).toBeLessThanOrEqual(commands.length);
      expect(b.commandIndex0).toBe(b.commandCount - 1); expect(b.stateSha256).toMatch(/^[a-f0-9]{64}$/);
      same(b.replayFrom, { file: 'natural.json', key: 'prefixFinal', sourceCommandCount: PREFIX, migrateToSchema: 205 }); same(b.inclusiveTailRange0, [PREFIX, b.commandCount - 1]);
      if (b.beforeCommandCount === undefined) { expect(name).toBe('original-full1868-migrated-start'); expect(b.commandCount).toBe(PREFIX); expect(b.intent).toBeUndefined(); expect(b.intentCommitted).toBeUndefined(); expect(b.beforeStateSha256).toBeUndefined(); }
      else {
        expect(typeof b.intentCommitted).toBe('boolean'); expect(b.beforeStateSha256).toMatch(/^[a-f0-9]{64}$/); expect(validateSlicePayload(b.intent)).toBe(true);
        expect(b.beforeCommandCount).toBe(b.commandCount - (b.intentCommitted ? 1 : 0));
        if (b.intentCommitted) same(b.intent, commands[b.commandCount - 1]); else same(b.intent, pending);
        needed.add(b.beforeCommandCount);
      }
      needed.add(b.commandCount); const list = byCount.get(b.commandCount) ?? []; list.push([name, b]); byCount.set(b.commandCount, list);
    }
    expect(index.boundaries['original-full1868-migrated-start']).toBeDefined();
    let state = current(entry('prefixFinal'));
    let session: FoolRuntimeSession | null = null;
    const origin = { runId: state.runId, character: { ...state.character, coreStats: null }, frozen: foolFrozenSourceDigest(state),
      mastery: { ...state.progression.mastery }, revival: hash(state.miracleWorker.revival), combat: hash(state.combatHistory) };
    const stateHashes = new Map<number, string>(), currentStateHashes = new Map<number, string>();
    const checkBoundary = (count: number): void => {
      expect(needed.has(count)).toBe(true);
      const currentHash = hash(state), h = hash(historicalStateView(state));
      currentStateHashes.set(count, currentHash); stateHashes.set(count, h);
      const captured = capturedStates[count - PREFIX]!; expect(h, `Every original 205 private field after command${count}`).toBe(captured.stateSha256);
      if (!redactionAudit) throw new Error('Missing exact reviewed public-redaction proof');
      const prior = redactionAudit.prior.rows[count - PREFIX]!;
      expect(h).toBe(prior.stateSha256); expect(hash(budget(state))).toBe(prior.budgetSha256); same(state.random, prior.random);
      expect(count > 1869 ? hash(state.fool.journal.at(-1)) : null).toBe(prior.eventSha256);
      const baseline = reconstructed[count - PREFIX];
      // These are reconstructed original-freeze states, not original full-state
      // captures. Compare all44 private/public/RNG/budget rows independently.
      if (baseline) { expect(h).toBe(baseline.stateSha256); same(state.random, baseline.random); same(budget(state), baseline.budget); }
      if (count === PAUSED_COUNT) { expect(h).toBe(TRANSITION.finalStateSha256); same(state.random, oldEndpointPublic.random); }
      if (count === PREFIX) expect(h).toBe(index.originalMigratedStateSha256);
      for (const [name, b] of byCount.get(count) ?? []) {
        expect(h, name).toBe(b.stateSha256); expect(b.revision).toBe(state.revision); same(b.budget, budget(state));
        if (b.beforeCommandCount !== undefined) expect(stateHashes.get(b.beforeCommandCount), `${name}: before`).toBe(b.beforeStateSha256);
      }
      if (baseline || byCount.has(count) || count === PAUSED_COUNT || count === commands.length) {
        expect(state.runId).toBe(origin.runId); same({ ...state.character, coreStats: null }, origin.character); expect(state.random.seed).toBe(SEED);
        expect(foolFrozenSourceDigest(state)).toBe(origin.frozen); expect(hash(state.miracleWorker.revival)).toBe(origin.revival); expect(hash(state.combatHistory)).toBe(origin.combat);
        for (const [id, mastery] of Object.entries(origin.mastery)) expect(state.progression.mastery[id], id).toBe(mastery);
        assertValidSliceState(state); const p = projectSliceState(state); assertPublicProjection(p);
        if (session) { const owned = session.project(); assertPublicProjection(owned); same(owned, p); }
        // The complete current strict/owned output agrees before the five added
        // inactive chapters are checked and removed. Only this detached audit copy
        // receives the reviewed removed private S1 fields; every old public field
        // remains covered by its exact historical hash.
        const legacyHash = hash(redactionAudit.restore(state, historicalPublicView(state, p), projectPlayerText));
        redactionAudit.assertRow(redactionAudit.prior, count - PREFIX, { stateSha256: h, budgetSha256: hash(budget(state)), random: state.random, eventSha256: count > 1869 ? hash(state.fool.journal.at(-1)) : null, legacyPublicSha256: legacyHash });
        if (baseline) expect(legacyHash, `Original-freeze reconstructed public state${count}`).toBe(baseline.publicSha256);
        // A separate post-pause computation under the previous frozen runtime,
        // not a 45th recorded public row or a claim of 69 captured public states.
        if (count === PAUSED_COUNT) expect(legacyHash).toBe(TRANSITION.finalPublicSha256);
        expect(hash(state), 'Validation and public projection are read-only').toBe(currentHash);
      }
    };
    checkBoundary(PREFIX);
    const ledger = rows();
    try {
      for (let i = PREFIX; i < commands.length; i++) {
        const intent = commands[i]!, line = await ledger.next(); expect(line.done).toBe(false); const row = line.value!;
        expect(intent.type).toBe('FOOL'); if (intent.type !== 'FOOL') throw new Error('Only actual public Fool intents belong to the new tail');
        const before = state; expect(before.status).toBe('ACTIVE'); expect(validateSlicePayload(intent)).toBe(true);
        expect(row.commandCount).toBe(i + 1); same(row.intent, intent); same(row.before, budget(before));
        if (i < INTERRUPTED_COUNT) same(row, originalRows[i - PREFIX]);
        const publicView = session ? session.projectFool() : projectFool(before); assertPublicFool(publicView);
        const offered = publicView.actions.filter(a => stableStringify(a.command) === stableStringify(intent.command));
        expect(offered).toHaveLength(1); const control = offered[0]!; expect(control.enabled, control.reason ?? '').toBe(true);
        same(row.publicControl, { id: control.id, label: control.label, cost: control.cost, enabled: true });
        if (!session) {
          expect(i).toBe(PREFIX); same(intent, { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } });
          state = applySliceIntent(before, intent); assertValidSliceState(state);
          session = openFoolRuntimeSession(state);
        } else {
          same(session.inspect(), { runId: before.runId, revision: before.revision, status: before.status });
          const draft = session.prepare(intent, before.revision);
          state = session.snapshotDraft(draft);
          same(session.inspectDraft(draft), { runId: state.runId, revision: state.revision, status: state.status });
          session.commit(draft);
        }
        expect(state.revision).toBe(before.revision + 1); assertRandom(before, intent, state);
        expect(hash(before), 'Reducer preserves every previous complete current state').toBe(currentStateHashes.get(i));
        same(row.after, budget(state)); const event = state.fool.journal.at(-1); expect(row.journalEventId).toBe(event?.revision === state.revision ? event.id : null);
        checkBoundary(i + 1);
      }
      expect((await ledger.next()).done, 'No unconsumed ledger commands').toBe(true);
    } finally { await ledger.return(undefined); }
    expect(stateHashes.size).toBe(needed.size);
    expect(currentStateHashes.size).toBe(needed.size);
    expect(stateHashes.get(INTERRUPTED_COUNT)).toBe(report.resumeProvenance.reconstruction.baselineFinalStateSha256);
    expect(stateHashes.get(beforeLastCount)).toBe(e.beforeLastStateSha256); expect(stateHashes.get(beforeLastCount)).toBe(hash(entry('beforeLast')));
    if (pending === null) { expect(beforeLastCount).toBe(commands.length - 1); same(entry('lastIntent'), commands.at(-1)); }
    else { expect(beforeLastCount).toBe(commands.length); same(entry('lastIntent'), pending); expect(validateSlicePayload(pending)).toBe(true); }
    // A pending intent is evidence of an uncommitted attempt; never apply it.
    expect(hash(historicalStateView(state))).toBe(e.finalStateSha256); same(state, current(entry('final'))); same(state.random, e.finalRandom); same(budget(state), e.finalBudget); same(report.final, budget(state));
    const actualPotions = state.fool.journal.flatMap((event, i) => event.consumption ? [{ commandCount: PREFIX + i + 2, eventId: event.id, compoundId: event.consumption.compoundId, outcome: event.consumption.outcome }] : []);
    same(report.potions.attempts.map(({ commandCount, eventId, compoundId, outcome }) => ({ commandCount, eventId, compoundId, outcome })), actualPotions);
    expect(report.potions.prepared).toBe(state.fool.materials?.compounds.length ?? 0); expect(report.potions.consumed).toBe(actualPotions.length);
    expect(report.potions.succeeded).toBe(actualPotions.filter(p => p.outcome === 'SUCCESS').length); expect(report.potions.failed).toBe(actualPotions.filter(p => p.outcome === 'FAILURE').length);
    if (e.stage === 'NATURAL_FULL1868_FOOL_PROMOTION_AND_FINITE_ESCAPE_COMPLETED') {
      expect(state.status).toBe('ACTIVE'); expect(state.progression.sequence).toBe(0);
      expect(report.potions).toMatchObject({ prepared: 1, consumed: 1, succeeded: 1, failed: 0 });
      const consumption = state.fool.journal.filter(event => event.consumption);
      expect(consumption).toHaveLength(1); expect(consumption[0]!.consumption).toMatchObject({ outcome: 'SUCCESS' });
      expect(consumption[0]!.randomReceipts).toMatchObject([{ kind: 'CHECK', cursorBefore: 953, cursorAfter: 954, check: { roll: 29, chance: 38, tier: 'SUCCESS' } }]);
      const escape = state.fool.escape; if (!escape) throw new Error('Missing actual original-vault escape');
      same(escape.journal.map(step => step.command), ['OPEN_DOOR', 'MOMENTARY_BLINDNESS', 'WALK', 'WITHDRAW', 'REPORT'].map(type => ({ type })));
      expect(escape.journal[1]!.host.check).toMatchObject({ ability: 'will', roll: 62, chance: 38, tier: 'FAILURE' });
      expect(escape.journal[2]!.host.check).toMatchObject({ ability: 'perception', roll: 43, chance: 42, tier: 'FAILURE' });
      same(escape.journal[2]!.effect.consequences.map(c => c.injury.healthLoss), [35, 18, 18]);
      expect(escape.journal[3]!.effect.elapsedSeconds).toBe(12);
      same(escape.journal[3]!.effect.rescuedIds, ['F208-ESCAPE-SULAI', 'F208-ESCAPE-LIEN']);
      expect(escape.scene).toMatchObject({ status: 'WITHDRAWN', reported: true, blindAttempted: true, imageAttempted: false, blindness: null, image: null, appliedAbilities: [] });
      for (const [role, health] of [['ACTOR', 65], ['MESSENGER_A', 82], ['MESSENGER_B', 82]] as const)
        expect(escape.scene.bodies.find(body => body.role === role)).toMatchObject({ health, place: 'EXIT', walkedMetres: 12 });
      expect(state.progression.mastery['diviner.s0.momentary-blindness']).toBe(0); expect(state.progression.mastery['diviner.s0.prior-place']).toBe(0);
      expect(Object.keys(origin.mastery)).toHaveLength(34); expect(Object.keys(state.progression.mastery)).toHaveLength(36);
      same(state.miracleWorker.revival, { allowance: 4, used: 0, pendingDeathId: null, records: [] });
      same(commands.at(-1), { type: 'FOOL', command: { type: 'ESCAPE', command: { type: 'REPORT' } } });
    }
    if (e.stage === 'NATURAL_ACTUAL_TERMINAL_NO_REVIVAL') expect(state.status).not.toBe('ACTIVE');
    if (e.stage === 'NATURAL_FINITE_POLICY_STOP') { expect(state.status).toBe('ACTIVE'); expect(e.error).not.toBeNull(); expect(e.error?.code).toEqual(expect.any(String)); }
    same(inventory(), beforeFiles); expect(await fileHash(SOURCE_PATH)).toBe(SOURCE_SHA);
    for (const file of FILES) expect(await fileHash(fixturePath(file))).toBe(e.files[file].sha256);
  // Actual route length and historical-validation cost can be substantial.
  // Fixed 30-second defaults are inappropriate; never weaken assertions to fit.
  }, 7_200_000);
});
