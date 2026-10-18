import { assertEmptyDemonessState, assertEmptyDemonessPublic } from './empty-demoness-capture.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyTwilightGiantState, assertEmptyTwilightGiantPublic } from './empty-twilight-giant-capture.js';

/** The completed natural capture, never a controlled route or a generated fixture. */
const directory = () => process.env.ERROR219_CAPTURE_DIR ?? 'tests/fixtures/error-v02190';
export const ERROR219_SOURCE_SHA = 'e9920991623fdd3f1b8ecf4e5c8049720f362145462703d6b804afa9dfd390cf';
export const ERROR219_FINAL_PRIVATE_SHA = 'cfddaa10b540c53d07e47cb5c0cf0567a6a53ac3c9d7fdb6b7f7ed3952cd1a22';
export const ERROR219_FINAL_PUBLIC_SHA = 'b4ee0850c98a43923a2e74c7b5038380e1bcafe803711e6dc092ec412c13a37d';
export const errorNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const errorNaturalHash = (value: unknown) => errorNaturalSha(stableStringify(value));
type HistoricalErrorNaturalState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'twilightGiant' | 'demoness'> & {
  schemaVersion: 216; contentVersion: 'error-ascent-v216';
};
type HistoricalErrorNaturalPublic = Omit<SliceProjection, 'twilightGiant' | 'demoness'>;
export const errorNaturalAnchor = (state: SliceState | HistoricalErrorNaturalState, view: SliceProjection | HistoricalErrorNaturalPublic) => ({
  revision: state.revision, privateStateSha256: errorNaturalHash(state),
  publicStateSha256: errorNaturalHash(view), random: state.random, randomSha256: errorNaturalHash(state.random),
});
type Anchor = ReturnType<typeof errorNaturalAnchor>;
interface Snapshot {
  commandCount: number; newCount: number; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface ErrorNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'ERROR_ASCENT_ACTION'; commandCount: number;
  intent: SliceIntent; commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface ErrorNaturalActionRow extends ErrorNaturalRow {
  newCount: number; before: Anchor; after: Anchor;
  publicAction: SliceProjection['errorAscent']['actions'][number];
  receipt: { id: string | null; checks: unknown[]; finance: unknown[]; notes: unknown[];
    beforeDigest?: string; afterDigest?: string };
}
export function readErrorNaturalSource(): { final: SliceState; commands: SliceIntent[] } {
  const bytes = gunzipSync(readFileSync(join(directory(), 'source-natural.json.gz')));
  assert.equal(errorNaturalSha(bytes), ERROR219_SOURCE_SHA);
  return JSON.parse(bytes.toString('utf8'));
}
export function readErrorNaturalRows(): ErrorNaturalRow[] {
  return readFileSync(join(directory(), 'commands.jsonl'), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readErrorNaturalSnapshot(which: 'initial' | 'terminal'): Snapshot {
  const initial = which === 'initial';
  const file = initial ? 'key-656-initial.json.gz' : 'key-730-terminal.json.gz';
  const value: Snapshot = JSON.parse(gunzipSync(readFileSync(join(directory(), file))).toString('utf8'));
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [216, 'error-ascent-v216']);
  assert.equal(Object.hasOwn(value.final, 'twilightGiant'), false); assert.equal(Object.hasOwn(value.final, 'demoness'), false);
  assert.equal(Object.hasOwn(value.public, 'twilightGiant'), false); assert.equal(Object.hasOwn(value.public, 'demoness'), false);
  assert.equal(value.commandCount, initial ? 656 : 730);
  assert.equal(value.newCount, initial ? 0 : 74);
  assert.deepEqual(value.anchor, errorNaturalAnchor(value.final, value.public));
  assert.deepEqual(value.random, value.final.random);
  assert.equal(value.anchor.privateStateSha256, initial
    ? '20c569afe7069560f8d2a4446b99fc775def5fd8e21518d827b375e0f24ca28f' : ERROR219_FINAL_PRIVATE_SHA);
  assert.equal(value.anchor.publicStateSha256, initial
    ? 'df63db06bd16232aa0579bcf460d85613b757405904822fd28c4a801bf301c05' : ERROR219_FINAL_PUBLIC_SHA);
  return value;
}

/** Raw216 evidence remains untouched. Current replay may add only the exact schema217
 * Twilight Giant and schema218 Demoness defaults and metadata; every original/private/RNG/public leaf stays
 * in its complete historical hash. Exact keys also reject undefined extras. */
export function historicalErrorNaturalState(state: SliceState, originalKeys: readonly string[]): HistoricalErrorNaturalState {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.equal(originalKeys.includes('twilightGiant'), false); assert.equal(originalKeys.includes('demoness'), false);
  assert.deepEqual(Object.keys(state).sort(), [...originalKeys, 'twilightGiant', 'demoness'].sort());
  assertEmptyTwilightGiantState(state); assertEmptyDemonessState(state);
  const { twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 216 as const, contentVersion: 'error-ascent-v216' as const };
}
export function historicalErrorNaturalPublic(view: SliceProjection, state: SliceState, originalKeys: readonly string[]): HistoricalErrorNaturalPublic {
  assert.equal(originalKeys.includes('twilightGiant'), false); assert.equal(originalKeys.includes('demoness'), false);
  assert.deepEqual(Object.keys(view).sort(), [...originalKeys, 'twilightGiant', 'demoness'].sort());
  assertEmptyTwilightGiantState(state); assertEmptyDemonessState(state); assertEmptyTwilightGiantPublic(view, state); assertEmptyDemonessPublic(view, state);
  const { twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...originalFields } = view;
  return originalFields;
}
export function currentErrorNaturalAnchor(state: SliceState, view: SliceProjection, original: Snapshot): Anchor {
  return errorNaturalAnchor(historicalErrorNaturalState(state, Object.keys(original.final)),
    historicalErrorNaturalPublic(view, state, Object.keys(original.public)));
}
