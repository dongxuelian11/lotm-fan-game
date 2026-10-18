import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

/** Only completed, retained natural evidence belongs here. No route generation. */
const directory = 'tests/fixtures/twilight-giant-v02200';
export const TWILIGHT220_SOURCE_SHA = 'eb9bc7d243a5ffd4704a0d8047c66cf27acbe69dcc447c6075e6b738d057828d';
export const TWILIGHT220_SOURCE_STATE_SHA = 'd33b1055f0910b9453e4ee1053bc780a6ec574487924b190ff79deaa362507ca';
export const TWILIGHT220_HISTORY_SHA = '0bc387a501ff6f7307e4ca518286e1e7f37bc051fa9676346241155e9cf3c595';
export const TWILIGHT220_PREFIX_SHA = '0c2b99e8dba7bcb1a3cddd248619037093ea530da437acdd0391804ee95ecc71';
// Fill only from the completed actual summary, never from a guessed endpoint.
export const TWILIGHT220_SUMMARY_SHA = 'b5d2a2782899cf866804b02f60a2aa00990dc89005ad21a557e3f77ae90a9c46';
export const TWILIGHT220_FROZEN_ROOTS = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin',
  'guardian', 'demonHunter', 'silverKnight', 'glory', 'divineHand'] as const;
export const twilightNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const twilightNaturalHash = (value: unknown) => twilightNaturalSha(stableStringify(value));
export const twilightNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: twilightNaturalHash(state),
  publicStateSha256: twilightNaturalHash(view), random: state.random, randomSha256: twilightNaturalHash(state.random),
});
type Anchor = ReturnType<typeof twilightNaturalAnchor>;
export interface TwilightNaturalSnapshot {
  commandCount: number; newCount: number; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface TwilightNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'TWILIGHT_GIANT_ACTION'; commandCount: number;
  intent: SliceIntent; commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface TwilightNaturalActionRow extends TwilightNaturalRow {
  newCount: number; before: Anchor; after: Anchor;
  publicAction: SliceProjection['twilightGiant']['actions'][number];
  receipt: { id: string | null; checks: unknown[]; finance: unknown[]; notes: unknown[];
    beforeDigest?: string; afterDigest?: string };
}
interface Summary {
  stage: string; commandCount: number; originalCommandCount: number; newCount: number; revision: number;
  finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; historySha256: string; prefixCommandsSha256: string; runtimeFreezeSha256: string;
  frozenSourceKeys: string[]; strictFinalValidation: boolean; historicalPrefixReplayed: boolean;
  randomOverridden: boolean; futureDrawInspected: boolean; selectedPublicPreferredOnly: boolean;
  provenance: { inheritedDirectedPrefix: boolean; fullNaturalS9ToS0: boolean; nextCommandCount: number; nextRevision: number };
  actual: { status: SliceState['status']; sequence: number; promoted: boolean; reported: boolean;
    ordinaryExit: boolean; returnedHome: boolean; location: string | null; giantApplied: boolean; twilightApplied: boolean };
  keySnapshots: { file: string; commandCount: number; newCount: number; reasons: string[];
    stateSha256: string; publicSha256: string; contentSha256: string }[];
}
export function readTwilightNaturalSummary(): Summary {
  assert.match(TWILIGHT220_SUMMARY_SHA, /^[a-f0-9]{64}$/, 'The actual terminal summary has not been pinned yet');
  const bytes = readFileSync(join(directory, 'summary.json'));
  assert.equal(twilightNaturalSha(bytes), TWILIGHT220_SUMMARY_SHA);
  const value: Summary = JSON.parse(bytes.toString('utf8'));
  assert.match(value.stage, /^NATURAL_/);
  assert.equal(value.originalCommandCount, 287);
  assert(value.newCount > 0);
  assert.equal(value.commandCount, 287 + value.newCount);
  assert.equal(value.revision, 729 + value.newCount);
  assert.equal(value.sourceSha256, TWILIGHT220_SOURCE_SHA);
  assert.equal(value.historySha256, TWILIGHT220_HISTORY_SHA);
  assert.equal(value.prefixCommandsSha256, TWILIGHT220_PREFIX_SHA);
  assert.deepEqual(value.frozenSourceKeys, TWILIGHT220_FROZEN_ROOTS);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly,
    value.historicalPrefixReplayed, value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  assert.deepEqual([value.provenance.inheritedDirectedPrefix, value.provenance.fullNaturalS9ToS0,
    value.provenance.nextCommandCount, value.provenance.nextRevision], [true, false, 288, 730]);
  return value;
}
export function readTwilightNaturalSource(): SliceState {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-snapshot.json.gz')));
  assert.equal(twilightNaturalSha(bytes), TWILIGHT220_SOURCE_SHA);
  const value: SliceState = JSON.parse(bytes.toString('utf8'));
  assert.equal(twilightNaturalHash(value), TWILIGHT220_SOURCE_STATE_SHA);
  return value;
}
export function readTwilightNaturalArchive(): { commands: SliceIntent[]; final: SliceState } {
  const bytes = gunzipSync(readFileSync(join(directory, 'original297-natural.json.gz')));
  assert.equal(twilightNaturalSha(bytes), TWILIGHT220_HISTORY_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { commands: SliceIntent[]; final: SliceState };
  assert.equal(value.commands.length, 297); assert.equal(value.final.status, 'DEAD');
  assert.equal(twilightNaturalHash(value.commands.slice(0, 287)), TWILIGHT220_PREFIX_SHA);
  return value;
}
/** Verify the retained capture's own freeze, never today's production bytes.
 * Runtime freezing belongs to capture time; later chapters may legitimately change src/dist. */
export function assertTwilightNaturalRetainedFreeze(summary: Summary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { sha256: string }; history: { sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(twilightNaturalHash(payload), sha256);
  assert.equal(payload.source.sha256, TWILIGHT220_SOURCE_SHA); assert.equal(payload.history.sha256, TWILIGHT220_HISTORY_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/twilight-giant-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/twilight-giant-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(twilightNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
}
export function readTwilightNaturalRows(): TwilightNaturalRow[] {
  return readFileSync(join(directory, 'commands.jsonl'), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readTwilightNaturalSnapshot(which: 'initial' | 'terminal'): TwilightNaturalSnapshot {
  const summary = readTwilightNaturalSummary(), initial = which === 'initial';
  const candidates = summary.keySnapshots.filter(item => item.reasons.includes(which));
  assert.equal(candidates.length, 1);
  const item = candidates[0]!;
  assert.match(item.file, /^key-\d+-[a-z-]+\.json\.gz$/);
  const value: TwilightNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(twilightNaturalHash(value), item.contentSha256);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [217, 'twilight-giant-v217']);
  assert.equal(value.commandCount, initial ? 287 : summary.commandCount);
  assert.equal(value.newCount, initial ? 0 : summary.newCount);
  assert.deepEqual(value.anchor, twilightNaturalAnchor(value.final, value.public));
  assert.deepEqual(value.random, value.final.random);
  assert.equal(value.anchor.privateStateSha256, initial
    ? 'bd003490c33f753205af83cbdfaa3ae07679de7108fa4756505795a8701e6f9a' : summary.finalPrivateStateSha256);
  assert.equal(value.anchor.publicStateSha256, initial
    ? 'af721cca86390dd61a74e9bfa684c0416ccd4694e9c9e3790cc750c5065067a4' : summary.finalWholePublicSha256);
  assert.equal(value.anchor.privateStateSha256, item.stateSha256);
  assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  return value;
}
/** No future roots exist yet. Add only explicitly verified empty migration
 * roots here when a later schema introduces them; never strip arbitrary keys. */
export function historicalTwilightNaturalState(state: SliceState, originalKeys: readonly string[]): SliceState {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys].sort());
  return { ...state, schemaVersion: 217, contentVersion: 'twilight-giant-v217' };
}
export function historicalTwilightNaturalPublic(view: SliceProjection, originalKeys: readonly string[]): SliceProjection {
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys].sort());
  return view;
}
export function currentTwilightNaturalAnchor(state: SliceState, view: SliceProjection, original: TwilightNaturalSnapshot): Anchor {
  return twilightNaturalAnchor(historicalTwilightNaturalState(state, Object.keys(original.final)),
    historicalTwilightNaturalPublic(view, Object.keys(original.public)));
}

/** A retained actual command boundary for the separate last-command save test. */
export function readTwilightNaturalSnapshotAt(commandCount: number): TwilightNaturalSnapshot {
  const item = readTwilightNaturalSummary().keySnapshots.find(item => item.commandCount === commandCount);
  assert(item, `No retained actual snapshot at command ${commandCount}`);
  const value: TwilightNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(twilightNaturalHash(value), item.contentSha256);
  assert.equal(value.commandCount, commandCount);
  assert.deepEqual(value.anchor, twilightNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256);
  assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  return value;
}
