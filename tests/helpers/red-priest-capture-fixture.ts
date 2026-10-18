import { assertEmptyErrorAscentState } from './empty-error-ascent-capture.js';
import { assertEmptyDeathState, assertEmptyDoorState } from './empty-death-capture.js';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { readObjectEntry } from './read-object-entry.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { RED_PRIEST_CAPTURE_OBSERVED } from './red-priest-capture-observed.js';
import { RED_PRIEST_STORY_OBSERVED } from './red-priest-story-observed.js';
import { RED_PRIEST_FINAL_UI_OBSERVED } from './red-priest-final-ui-observed.js';

export const ROOT = 'tests/fixtures/red-priest-v02090';
export const SOURCE = 'tests/fixtures/conqueror-v01870/natural.json';
export const SOURCE_SHA = '469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973';
export const ORIGINAL_PREFIX_SHA = '88211e592c4714058c3e8b45eab02fa0f0ae73b35c2526288503329ec1d52f2e';
export const ORIGINAL_COUNT = 795;
export const FORK_COUNT = 918;
export const FORK_SHA = '2ab728663f4ce0096a94e49279a5feadda378f64629dd4ec6ccff785db60c68b';
export const RECONSTRUCTION_SHA = '398f3854fc323bc106f58b0133cf702cce1a9b234bca850ccc416a21570611c5';
export const EQUIVALENCE_SHA = '9f64e510ace5f5f484ad2869a8bc616c668231ac345383695740a4edd065a3c3';
export const ORIGINAL983_MANIFEST_SHA = '24d971395d08ca7b031d51d79c17a75681ccf7e3fe78a076f79b84f917acf909';
export const FORK_STATE_SHA = '779ef84dfc74b9abbfe1e97c9bff206c683a9b18d3957d6603661f9748b38acd';
export const FORK_PUBLIC_SHA = '361cc87eba7713bdf66752b17fd298350d558e5be2f10e30e8419fb67f172d91';
export const PLANNING_INITIAL_PUBLIC_SHA = '86f345235955bf51cdf59730e8358e5fa54c57479a1ef22ab79a938b5f4866dd';
export const ORIGINAL918_FREEZE_SHA = 'be967f07d9a912627b5c21fb1746247b4d2ba3797ee1dce532108748e1eeb11e';
export const ORIGINAL983_FREEZE_SHA = 'd6fffde98a45d09615a74b8daded5cb41071eee1f26a74789d54660ca8ba8993';
export const PLANNED1017_MANIFEST_SHA = 'e5d510ea1413d44c828341699bd03f1c1955d2c6e88a38a30f820f41fd577af3';
export const PLANNED1137_MANIFEST_SHA = '9964baf7e73d054affe8769111f28e780c574d63529770b93a7d5301b0a01217';
export const STABLE_FAILURE1222_MANIFEST_SHA = '773f1169cadcb4694cc85ac73f19aa5ef445f02eb233e82b827fe723eafd0e03';
export interface FilePin { bytes: number; sha256: string }
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; revision: number;
  reason: string; publicLabel: string; startedAt: string; elapsedMilliseconds: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random'];
}
export interface Fork {
  rootFile: string; rootSha256: string; proofFile: string; proofSha256: string;
  runtimeProofFile: string; runtimeProofSha256: string;
}
export interface BranchRoot {
  format: string; source: string; sourceSha256: string; prefixSha256: string; originalRuntimeFreezeSha256: string;
  commandCount: number; commands: SliceIntent[]; rows: Row[]; state: SliceState;
  initialStateSha256: string; finalStateSha256: string; publicStateSha256: string; random: SliceState['random'];
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixCount: number; prefixSha256: string; freezeSha256: string;
  commandCount: number; commands: SliceIntent[]; rows: Row[]; state: SliceState;
  initialStateSha256: string; initialPublicStateSha256: string; finalStateSha256: string; publicStateSha256: string;
  fork: Fork; pending: unknown; terminal: { stage: string; reason: string } | null;
  continuation?: { proofFile: string; proofSha256: string; originalCommandCount: number };
  independentBranch?: { proofFile: string; proofSha256: string; rootCommandCount: number; priorFailureCommandCount: number };
  stabilityContinuation?: { proofFile: string; proofSha256: string; originalCommandCount: number };
  policyDefinition: { id: string; noReroll: boolean; plannedStance: string; extraSupplies: boolean };
  policy: { attempts: Record<string, number>; materialCycle?: { startedAfterCommand: number; attempts: Record<string, number> } };
}
export interface CaptureObservation {
  commands: number; stage: string; reason: string; finalStatus: SliceState['status']; finalSequence: number | null;
  finalRandom: SliceState['random']; prefixSha256: string; initialStateSha256: string;
  initialPublicStateSha256: string; finalStateSha256: string; publicStateSha256: string;
  freezeSha256: string; producerSha256: string;
  stabilityEquivalenceSha256: string;
  /** Complete portable fixture inventory, excluding no files. This module lives outside ROOT. */
  files: Record<string, FilePin>;
  sqlite: { ledgerSha256: string; commandCount: number; beforeStateSha256: string; afterStateSha256: string };
}
export interface Freeze { sha256: string; files: Array<FilePin & { file: string }> }
export interface RuntimeTransition {
  format: string; commandCount: number; originalRuntimeFreezeSha256: string; newRuntimeFreezeSha256: string;
  stateSha256: string; originalPublicSha256: string; continuedPublicSha256: string; random: SliceState['random'];
  unchangedPrivateAndRng: boolean; publicDifference: string; allowedPublicChanges: string[];
  addedAction: RedPriestProjection['actions'][number]; original983Replay: { proofFile: string; proofSha256: string };
}
export interface IndependentRuntimeTransition extends Omit<RuntimeTransition, 'original983Replay'> {
  independentBranch: NonNullable<Checkpoint['independentBranch']>;
  historicalPlanningReplay: { proofFile: string; proofSha256: string; commands: number; first: number; last: number; scope: string };
  currentStabilityReplay: { proofFile: string; proofSha256: string; commands: number; first: number; last: number;
    genuine918PrivateAndRngBound: boolean; currentRuntimeFreezeSha256: string };
}
export interface ArtifactMap {
  format: 'RED_PRIEST_PLANNED_VERIFIER_ARTIFACT_MAP_V1';
  entries: Array<FilePin & { kind: 'ARTIFACT' | 'FROZEN_RUNTIME'; name: string; path: string }>;
}
export function observed(): CaptureObservation {
  if (!RED_PRIEST_CAPTURE_OBSERVED) throw Error('PENDING: main must seal the reviewed actual terminal and portable fixture inventory; never substitute a desired outcome.');
  return RED_PRIEST_CAPTURE_OBSERVED;
}
// Exact capture wire format, including lexicographic integer-looking object keys.
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value)!;
}
export const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hash = (value: unknown): string => sha(stable(value));
export const compactHash = (value: unknown): string => sha(JSON.stringify(value));
export const same = (actual: unknown, expected: unknown): void => { expect(hash(actual)).toBe(hash(expected)); };
export const json = <T>(relativePath: string): T => JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8')) as T;
export function filePin(path: string): FilePin {
  const stat = lstatSync(path); expect(stat.isSymbolicLink(), path).toBe(false); expect(stat.isFile(), path).toBe(true);
  const bytes = readFileSync(path); expect(bytes.length).toBe(stat.size); return { bytes: bytes.length, sha256: sha(bytes) };
}
export function inventory(directory = ROOT): string[] {
  const files: string[] = [];
  const visit = (relative: string): void => {
    const path = join(directory, relative), stat = lstatSync(path); expect(stat.isSymbolicLink(), path).toBe(false);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) visit(relative ? `${relative}/${child}` : child);
    else { expect(stat.isFile(), path).toBe(true); files.push(relative); }
  };
  visit(''); return files.sort();
}
export function authenticateFixture(): void {
  const expected = observed(); expect(filePin(SOURCE).sha256).toBe(SOURCE_SHA);
  if (!RED_PRIEST_STORY_OBSERVED) throw Error('PENDING: exact reviewed story sidecar is required');
  if (!RED_PRIEST_FINAL_UI_OBSERVED) throw Error('PENDING: exact reviewed final UI sidecar is required');
  const finalUi = RED_PRIEST_FINAL_UI_OBSERVED.files;
  expect(Object.keys(finalUi).some(file => Object.hasOwn(expected.files, file) || Object.hasOwn(RED_PRIEST_STORY_OBSERVED.files, file))).toBe(false);
  const added = { ...RED_PRIEST_STORY_OBSERVED.files, ...finalUi };
  expect(Object.keys(added).some(file => Object.hasOwn(expected.files, file)), 'Story proof only appends new files').toBe(false);
  expect(inventory()).toEqual([...Object.keys(expected.files), ...Object.keys(added)].sort());
  for (const [file, pin] of Object.entries({ ...expected.files, ...added })) expect(filePin(join(ROOT, file)), file).toEqual(pin);
  expect(added['proofs/final-story-equivalence.json']?.sha256).toBe(RED_PRIEST_STORY_OBSERVED.proofSha256);
  expect(finalUi['proofs/final-ui-equivalence.json']?.sha256).toBe(RED_PRIEST_FINAL_UI_OBSERVED.proofSha256);
  expect(expected.files['fork/original-918-checkpoint.json']?.sha256).toBe(FORK_SHA);
  expect(expected.files['fork/reconstruction-proof.json']?.sha256).toBe(RECONSTRUCTION_SHA);
  expect(expected.files['proofs/planning-equivalence.json']?.sha256).toBe(EQUIVALENCE_SHA);
  expect(expected.files['proofs/original983-manifest.json']?.sha256).toBe(ORIGINAL983_MANIFEST_SHA);
  expect(expected.files['proofs/planned1017-manifest.json']?.sha256).toBe(PLANNED1017_MANIFEST_SHA);
  expect(expected.files['proofs/planned1137-manifest.json']?.sha256).toBe(PLANNED1137_MANIFEST_SHA);
  expect(expected.files['proofs/stable-failure1222-manifest.json']?.sha256).toBe(STABLE_FAILURE1222_MANIFEST_SHA);
  expect(expected.files['proofs/stability-equivalence.json']?.sha256).toBe(expected.stabilityEquivalenceSha256);
}
export function checkpoint<T>(relative: string): T {
  const wrapped = json<{ sha256: string; payload: T }>(relative);
  expect(hash(wrapped.payload), relative).toBe(wrapped.sha256); return wrapped.payload;
}
export function ledger(relative = 'planned/commands.ndjson'): Row[] {
  const bytes = readFileSync(join(ROOT, relative), 'utf8'); expect(bytes.endsWith('\n'), relative).toBe(true);
  return bytes.slice(0, -1).split('\n').map(line => JSON.parse(line) as Row);
}
/** Called only after migrateSliceState. Every original field remains in this
 * audit hash. Additional current roots must be exactly the complete fresh
 * current save's missing defaults; unknown/nondefault additions are rejected. */
let defaults: SliceState | undefined;
export function captureHash(current: SliceState, capturedRoot: SliceState): string {
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  defaults ??= createSliceRun(capturedRoot.runId, readObjectEntry<Parameters<typeof createSliceRun>[1]>(SOURCE, 'creation'), capturedRoot.random.seed);
  const old = capturedRoot as unknown as Record<string, unknown>, now = current as unknown as Record<string, unknown>,
    base = defaults as unknown as Record<string, unknown>;
  const laterRoots = ['visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'] as const;
  expect(capturedRoot.schemaVersion).toBe(206);
  const added = [...laterRoots];
  for (const key of added) expect(Object.hasOwn(old, key), `Unexpected historical root ${key}`).toBe(false);
  assertEmptyDeathState(current); assertEmptyDoorState(current); assertEmptyErrorAscentState(current);
  expect(Object.keys(now).sort()).toEqual([...Object.keys(old), ...added].sort());
  for (const key of added) same(now[key], base[key]);
  const historical = Object.fromEntries(Object.keys(old).map(key => [key, now[key]]));
  return hash({ ...historical, schemaVersion: capturedRoot.schemaVersion, contentVersion: capturedRoot.contentVersion });
}
export function initialPlanningSeam(view: RedPriestProjection, transition: Pick<RuntimeTransition, 'addedAction'>): void {
  const added = view.actions.filter(a => a.command.type === 'CAMPAIGN' && a.command.command.type === 'ENABLE_PLANNING');
  expect(added).toHaveLength(1); expect(view.actions.at(-1)).toEqual(added[0]);
  expect(added[0]).toEqual(transition.addedAction);
  expect(added[0]).toEqual({ id: `red-priest-action-${view.actions.length}`,
    command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } }, label: '启用本场战争筹备',
    cost: '不花行动、时间或费用；须在签发发动命令前选择，之后每次侦察和保护性准备照实支付，不能补写过去战果', enabled: true, reason: null });
  expect(hash({ ...view, actions: view.actions.slice(0, -1) })).toBe(FORK_PUBLIC_SHA);
  expect(hash(view)).toBe(PLANNING_INITIAL_PUBLIC_SHA);
}
