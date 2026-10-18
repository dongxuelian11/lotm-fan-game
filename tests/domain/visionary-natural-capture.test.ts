import { assertEmptyDeathState, assertEmptyDoorState } from '../helpers/empty-death-capture.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applySliceIntent, assertValidSliceState, createSliceRun, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createVisionaryState, projectVisionary, visionaryCommandBlock } from '../../src/domain/visionary/index.js';
import { openVisionaryRuntimeSession, type VisionaryRuntimeSession } from '../../src/domain/visionary/owned-session.js';
import { VISIONARY_FROZEN_SOURCE_KEYS, visionarySourceBlock } from '../../src/domain/visionary/source.js';
import type { VisionaryEvent, VisionaryProjection } from '../../src/domain/visionary/types.js';
import { VISIONARY_ERA_CITIES, VISIONARY_ERA_GOVERNMENTS } from '../../src/domain/visionary/era-content.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

/** Immutable actual210 evidence. The original659 prefix is authenticated, not
 * redundantly replayed. Only the recorded174 continuation commands execute,
 * with the same raw guidance handoff and one private owned session as capture.
 * No producer import, dist import, fixture write,
 * supplied die, alternate route, or replacement for the separate667 death. */
const ROOT = 'tests/fixtures/visionary-v02100';
const SOURCE = 'tests/fixtures/writer-v01880/snapshot-practiced.json';
const HISTORY = 'tests/fixtures/writer-v01880/natural.json';
const SOURCE_SHA = '49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc';
const HISTORY_SHA = '7b4a0998bd36ba06108ddb5c8dd7884f474d99145e9f9edbe1b56ba811f35399';
const PREFIX_SHA = '3176e2d31a990a18b0d1256d3d008da7a04ff246bfa1e02ace695c54da8cca1b';
const MANIFEST_SHA = 'f57f14ae90a9c4401ef924aad65a5ce1f1af6d08dcdb69ad5f8749327ff8c24c';
const FREEZE_SHA = 'f35089c2ad09782a606265aa8ecadb6655149f680cd7f38c1363f79ddf2304f6';
const PRIOR_FREEZE_SHA = 'cfd1a4120e42ae1dc877fcc445afe6da9d12ba79bc2997ef9bc401a28882780b';
const INITIAL_SHA = 'b1755d43274407c1a2c40132e07925dfecb406af061ac5217e0e07e83163f5c5';
const FINAL_SHA = 'dcf8145d646db84dc7a2c2caeaf543682875ef15d3e0d23c2a56ecc4cb94008c';
const FINAL_PUBLIC_SHA = 'ffbc42822fdc1f702e61040e2261fe470e9210aed75d3b27ba3ed116d3222699';
const PREFIX = 659, TAIL = 174, FINAL_COUNT = 833;
interface Pin { bytes: number; sha256: string }
interface Member extends Pin { file: string }
interface Boundary extends Member { kind: string; commandCount: number }
interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; revision: number; week: number;
  reason: string; publicLabel: string; publicCost: string; startedAt: string; elapsedMilliseconds: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random'];
  randomBeforeSha256: string; randomAfterSha256: string; policyBeforeSha256: string; policyAfterSha256: string;
  receipts: { checks: VisionaryEvent['randomReceipts']; finance: VisionaryEvent['financeReceipts']; notes: string[] };
}
interface Checkpoint {
  format: string; source: string; sourceSha256: string; historySha256: string; prefixSha256: string; freezeSha256: string;
  commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: Boundary[]; state: SliceState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialRandomSha256: string; pending: unknown; terminal: { stage: string; reason: string };
  policyDefinition: { noReroll: boolean }; policy: unknown; continuationProofSha256?: string;
}
interface Freeze { sha256: string; nodeVersion: string; files: Member[] }
interface Continuation {
  kind: string; originalCheckpoint: string; originalFreeze: string; currentFreeze: string; changedFrozenFiles: string[];
  originalTerminal: Checkpoint['terminal']; completedCommandsCompared: number;
  comparisons: Array<{ commandCount: number; privateSha256: string; publicSha256: string; randomSha256: string }>;
  originalFiles: Member[]; productChanged: boolean; randomOverridden: boolean; oldArtifactsPreserved: boolean;
}
// Producer wire order sorts ALL keys, including integer-looking keys. Do not
// substitute JSON.stringify's integer-key ordering for the captured digest.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value)!;
}
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown): string => sha(stable(value));
const compactHash = (value: unknown): string => sha(JSON.stringify(value));
const same = (actual: unknown, expected: unknown): void => { expect(hash(actual)).toBe(hash(expected)); };
const json = <T>(file: string): T => JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;
const entry = <T>(file: string, key: string): T => readObjectEntry<T>(join(ROOT, file), key);
function pin(path: string): Pin {
  const stat = lstatSync(path); expect(stat.isSymbolicLink(), path).toBe(false); expect(stat.isFile(), path).toBe(true);
  const bytes = readFileSync(path); expect(bytes.length).toBe(stat.size);
  return { bytes: bytes.length, sha256: sha(bytes) };
}
function inventory(root = ROOT): string[] {
  const files: string[] = [];
  const walk = (relative: string): void => {
    const path = join(root, relative), stat = lstatSync(path); expect(stat.isSymbolicLink(), path).toBe(false);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(relative ? `${relative}/${child}` : child);
    else { expect(stat.isFile(), path).toBe(true); files.push(relative); }
  };
  walk(''); return files.sort();
}
function checkpoint(file: string): { sha256: string; payload: Checkpoint } {
  const result = json<{ sha256: string; payload: Checkpoint }>(file);
  expect(hash(result.payload), file).toBe(result.sha256); return result;
}
let rawSource: SliceState, initial: SliceState, captureInitial: SliceState, defaults: SliceState;
let cp: Checkpoint, rows: Row[], boundaries: Boundary[];

/** The ONLY migration seam: preserve every captured field, normalize the two
 * version labels, and require each newly introduced root to equal its complete
 * fresh current default. A missing/unknown/nonempty added field is not ignored. */
function captureHash(current: SliceState, historical: SliceState): string {
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  const old = historical as unknown as Record<string, unknown>, now = current as unknown as Record<string, unknown>;
  const fresh = defaults as unknown as Record<string, unknown>;
  const laterRoots = ['perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door'] as const;
  expect([185, 207]).toContain(historical.schemaVersion);
  const added = Number(historical.schemaVersion) === 185 ? [
    'civilizationEnlightener', 'beautyGoddess', 'misfortuneKnight', 'allKnowingEye', 'thunderGod', 'pureWhiteAngel',
    'paleEmperor', 'starKey', 'timeWorm', 'divineHand', 'apocalypseDemoness', 'knowledgeEmperor', 'darkAngel',
    'uncleanMonarch', 'abomination', 'mercurySnake', 'princeOfAbolition', 'handOfOrder', 'natureWalker',
    'fool', 'redPriest', 'visionary', ...laterRoots,
  ] : [...laterRoots];
  for (const key of added) expect(Object.hasOwn(old, key), `Unexpected historical root ${key}`).toBe(false);
  assertEmptyDeathState(current); assertEmptyDoorState(current);
  expect(Object.keys(now).sort()).toEqual([...Object.keys(old), ...added].sort());
  for (const key of added) same(now[key], fresh[key]);
  return hash({ ...Object.fromEntries(Object.keys(old).map(key => [key, now[key]])),
    schemaVersion: historical.schemaVersion, contentVersion: historical.contentVersion });
}
function migrateExactly(raw: SliceState): SliceState {
  const before = hash(raw), migrated = migrateSliceState(raw);
  expect(hash(raw), 'Migration must leave the historical input intact').toBe(before);
  expect(captureHash(migrated, raw)).toBe(before); return migrated;
}
function conserve(state: SliceState, before: SliceState): void {
  const era = state.visionary.era!, materials = state.visionary.materials!;
  expect(era.week).toBe(state.week);
  for (const definition of VISIONARY_ERA_CITIES) {
    const city = era.cities.find(item => item.id === definition.id)!;
    expect(city.stock + city.supplied + city.spoiled, definition.id).toBe(definition.stock);
    expect(city.residentsSafe + city.residentsDisplaced + city.residentsDeparted, definition.id).toBe(definition.population);
    expect(city.staffAssigned).toBe(city.pilot ? 2 : 0); expect(city.staffAssigned).toBeLessThanOrEqual(definition.staff);
    const prior = before.visionary.era?.cities.find(item => item.id === city.id);
    if (prior) { expect(city.residentsDeparted).toBeGreaterThanOrEqual(prior.residentsDeparted); expect(city.spoiled).toBeGreaterThanOrEqual(prior.spoiled); }
  }
  for (const definition of VISIONARY_ERA_GOVERNMENTS) {
    const government = era.governments.find(item => item.id === definition.id)!;
    expect(government.budget + government.spent).toBe(definition.budget);
    expect(government.spent).toBe(era.journal.flatMap(event => event.governmentSpend)
      .filter(spend => spend.id === definition.id).reduce((sum, spend) => sum + spend.amount, 0));
  }
  expect(materials.characteristics.map(item => item.id)).toEqual([
    'writer-potion-1:characteristic', 'writer-potion-2:characteristic', 'writer-potion-3:characteristic',
  ]);
  expect(new Set(materials.characteristics.map(item => item.originBottleId)).size).toBe(3);
  expect(materials.uniqueness.id).toBe('audience-uniqueness:original-branch-1352');
  expect(materials.batches.map(item => item.id)).toEqual(['visionary-carrier-1', 'visionary-carrier-2', 'visionary-carrier-3']);
  for (const compound of materials.compounds) {
    expect(compound.characteristicIds).toEqual(materials.characteristics.map(item => item.id));
    expect(compound.uniquenessId).toBe(materials.uniqueness.id);
  }
  same(materials.origin.bottles, rawSource.writer.bottles);
  for (const [ability, mastery] of Object.entries(rawSource.progression.mastery)) expect(state.progression.mastery[ability], ability).toBe(mastery);
}

beforeAll(() => {
  expect(pin(join(ROOT, 'manifest.json')).sha256).toBe(MANIFEST_SHA);
  const manifest = json<{ format: string; files: Member[] }>('manifest.json');
  expect(manifest.format).toBe('VISIONARY210_CAPTURE_FILES_V1'); expect(manifest.files).toHaveLength(64);
  expect(inventory()).toEqual([...manifest.files.map(file => file.file), 'manifest.json'].sort());
  for (const file of manifest.files) {
    expect(file.file.split('/').every(part => part !== '' && part !== '.' && part !== '..')).toBe(true);
    expect(pin(join(ROOT, file.file)), file.file).toEqual({ bytes: file.bytes, sha256: file.sha256 });
  }
  expect(pin(SOURCE)).toEqual({ bytes: 1009544, sha256: SOURCE_SHA });
  expect(pin(HISTORY)).toEqual({ bytes: 2884612, sha256: HISTORY_SHA });
  rawSource = JSON.parse(readFileSync(SOURCE, 'utf8')) as SliceState;
  defaults = createSliceRun(rawSource.runId, entry<Parameters<typeof createSliceRun>[1]>('natural.json', 'creation'), rawSource.random.seed);
  initial = migrateExactly(rawSource);
  captureInitial = entry<SliceState>('boundary-660-learn_guidance.json', 'beforeLast');
  cp = checkpoint('checkpoint.json').payload; boundaries = json<Boundary[]>('boundaries.index.json');
  const ledger = readFileSync(join(ROOT, 'commands.ndjson'), 'utf8'); expect(ledger.endsWith('\n')).toBe(true);
  rows = ledger.slice(0, -1).split('\n').map(line => JSON.parse(line) as Row);
  same(rows, cp.rows); expect(rows).toHaveLength(TAIL); same(boundaries, cp.boundaries); expect(boundaries).toHaveLength(33);
}, 20_000); // Authenticate ~200 MB of complete evidence once; no game replay in setup.

describe('Visionary immutable actual210 natural capture', () => {
  it('binds the raw185 living659 ancestry and migrates all old fields with only empty current roots added', () => {
    expect([rawSource.schemaVersion, rawSource.contentVersion]).toEqual([185, 'writer-v185']);
    expect(rawSource).toMatchObject({ runId: 'audience-rebuild-natural', revision: 660, week: 144, status: 'ACTIVE',
      health: 100, mind: 100, spirituality: 120, cash: 400, actionsRemaining: 3,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 3, day: 25 }, random: { seed: 'audience-rebuild-first', cursor: 480 } });
    expect([captureInitial.schemaVersion, captureInitial.contentVersion]).toEqual([207, 'visionary-v207']);
    expect(hash(captureInitial)).toBe(INITIAL_SHA); expect(captureHash(initial, captureInitial)).toBe(INITIAL_SHA);
    same(initial, migrateExactly(captureInitial)); same(initial.visionary, createVisionaryState());
    expect(visionarySourceBlock(initial)).toBeNull(); assertValidSliceState(initial);
    const historyCommands = readObjectEntry<SliceIntent[]>(HISTORY, 'commands');
    const commands = entry<SliceIntent[]>('natural.json', 'commands');
    expect(historyCommands).toHaveLength(667); expect(commands).toHaveLength(FINAL_COUNT);
    const prefix = historyCommands.slice(0, PREFIX); expect(compactHash(prefix)).toBe(PREFIX_SHA);
    same(commands.slice(0, PREFIX), prefix); same(commands.slice(PREFIX), cp.commands);
    same(entry('prefix-original659.json', 'commands'), prefix);
    same(entry('prefix-original659.json', 'final'), rawSource); same(entry('natural.json', 'prefixFinal'), rawSource);
    same(entry('natural.json', 'initial'), readObjectEntry(HISTORY, 'initial'));
    same(entry('prefix-original659.json', 'initial'), readObjectEntry(HISTORY, 'initial'));
    expect(entry('prefix-original659.json', 'historicalPrefixReplayedHere')).toBe(false);
    expect(entry('prefix-original659.json', 'separate667DeathRetained')).toBe(true);
    expect(entry('natural.json', 'provenance')).toEqual({
      kind: 'EXACT_ORIGINAL_LIVING_WRITER659_PUBLIC_VISIONARY_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA,
      originalHistory: HISTORY, originalHistorySha256: HISTORY_SHA, prefixCommandsSha256: PREFIX_SHA,
      runtimeFreezeSha256: FREEZE_SHA, historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true,
      separateOriginal667DeathUnchanged: true, privateAudit: true, seedChanged: false, randomOverridden: false,
      selectedFromEnabledPublicActionsOnly: true,
    });
    expect(cp).toMatchObject({ format: 'VISIONARY659_DURABLE_PUBLIC_ACTION_BOUNDARY_V1', source: SOURCE,
      sourceSha256: SOURCE_SHA, historySha256: HISTORY_SHA, prefixSha256: PREFIX_SHA, freezeSha256: FREEZE_SHA,
      initialStateSha256: INITIAL_SHA, commandCount: FINAL_COUNT, pending: null, policyDefinition: { noReroll: true } });
    expect(Object.keys(rawSource.progression.mastery)).toHaveLength(25);
    expect(rawSource.writer.life.cases['scheduled-return']).toMatchObject({ outcome: 'FAILURE', arrangementEnd: 'FAILED', returned: true });
    expect(rawSource.writer.life.cases['withdrawn-request']).toMatchObject({ result: 'ORDINARY', abilityApplied: false });
  }, 20_000);

  it('authenticates all97 completed756 rows and allows only the producer temporary-port wait change', () => {
    const proof = json<Continuation>('continuation-proof.json'), prior = checkpoint('prior-segment/checkpoint.json');
    const freeze = json<Freeze>('freeze.json'), oldFreeze = json<Freeze>('prior-segment/freeze.json');
    // This checkpoint link is a canonical object digest. The independent
    // manifest above separately authenticates the proof's exact file bytes.
    expect(cp.continuationProofSha256).toBe(hash(proof));
    expect(proof).toMatchObject({ kind: 'SAME_COMPLETED756_CONTINUATION_AFTER_PUBLIC_TEMPORARY_PORT_CLOSURE',
      originalCheckpoint: prior.sha256, originalFreeze: PRIOR_FREEZE_SHA, currentFreeze: FREEZE_SHA,
      changedFrozenFiles: ['$natural-producer'], completedCommandsCompared: 97,
      productChanged: false, randomOverridden: false, oldArtifactsPreserved: true });
    expect(freeze.sha256).toBe(FREEZE_SHA); expect(oldFreeze.sha256).toBe(PRIOR_FREEZE_SHA);
    expect(compactHash(freeze.files)).toBe(freeze.sha256); expect(compactHash(oldFreeze.files)).toBe(oldFreeze.sha256);
    expect(freeze.files).toHaveLength(4347); expect(freeze.files.map(file => file.file)).toEqual(oldFreeze.files.map(file => file.file));
    const changed = freeze.files.filter((file, index) => hash(file) !== hash(oldFreeze.files[index]));
    expect(changed.map(file => file.file)).toEqual(['$natural-producer']);
    expect(changed[0]).toEqual({ file: '$natural-producer', ...pin(join(ROOT, 'producer.mjs')) });
    expect(oldFreeze.files.at(-1)).toEqual({ file: '$natural-producer', ...pin(join(ROOT, 'prior-segment/producer.mjs')) });
    // These are historical manifests, never expectations about future current source/dist bytes.
    expect(inventory(join(ROOT, 'prior-segment'))).toEqual(proof.originalFiles.map(file => file.file).sort());
    for (const file of proof.originalFiles) expect(pin(join(ROOT, 'prior-segment', file.file))).toEqual({ bytes: file.bytes, sha256: file.sha256 });
    expect(prior.payload.commandCount).toBe(756); expect(prior.payload.commands).toHaveLength(97);
    same(cp.commands.slice(0, 97), prior.payload.commands); same(rows.slice(0, 97), prior.payload.rows);
    same(proof.originalTerminal, prior.payload.terminal);
    expect(proof.originalTerminal.stage).toBe('PUBLIC_ACTION_BLOCKED'); expect(proof.originalTerminal.reason).toContain('目的港正执行原封港规则');
    same(boundaries.slice(0, 14), prior.payload.boundaries);
    expect(proof.comparisons).toEqual(rows.slice(0, 97).map(row => ({ commandCount: row.commandCount,
      privateSha256: row.afterStateSha256, publicSha256: row.publicAfterSha256, randomSha256: row.randomAfterSha256 })));
    expect(hash(prior.payload.state)).toBe(rows[96]!.afterStateSha256);
    expect(rows[97]!.beforeStateSha256).toBe(prior.payload.finalStateSha256);
    expect(rows[97]!.intent).toEqual({ type: 'VISIONARY', command: { type: 'NEXT_WEEK' } });
    expect(rows[97]!.reason).toContain('temporary port closure');
  }, 20_000);

  it('replays174 actual commands through the captured guidance/owned handoff with exact boundaries and real costs', () => {
    // The owned API requires an established chapter. Match the real producer:
    // one raw LEARN_GUIDANCE, then all173 remaining commands in this one session.
    let session: VisionaryRuntimeSession | null = null;
    let state = initial, view = projectVisionary(initial), materialCost = 0, wages = 0, living = 0, eraCost = 0;
    const seenBoundaries: number[] = [], draws: Array<[number, number, string]> = [];
    expect(hash(view)).toBe(cp.initialPublicSha256); expect(hash(state.random)).toBe(cp.initialRandomSha256);
    for (const [index, row] of rows.entries()) {
      expect(row.commandCount).toBe(PREFIX + index + 1); expect(row.revision).toBe(initial.revision + index + 1);
      expect(row.commandSha256).toBe(compactHash(row.intent)); same(row.intent, cp.commands[index]);
      expect(validateSlicePayload(row.intent)).toBe(true);
      if (row.intent.type !== 'VISIONARY') throw Error('Only the actual captured Visionary command may execute.');
      expect(state.status).toBe('ACTIVE'); expect(captureHash(state, captureInitial)).toBe(row.beforeStateSha256);
      expect(hash(view)).toBe(row.publicBeforeSha256); expect(state.random).toEqual(row.randomBefore);
      expect(hash(row.randomBefore)).toBe(row.randomBeforeSha256); expect(hash(row.randomAfter)).toBe(row.randomAfterSha256);
      const command = row.intent.command, offered = view.actions.filter(action => hash(action.command) === hash(command));
      expect(offered).toHaveLength(1); expect(offered[0]).toMatchObject({ enabled: true, reason: null, label: row.publicLabel, cost: row.publicCost });
      const before = state;
      if (session) {
        const draft = session.prepare(row.intent, before.revision);
        state = session.snapshotDraft(draft); view = session.projectDraftVisionary(draft); session.commit(draft);
      } else {
        expect(index).toBe(0); expect(command).toEqual({ type: 'LEARN_GUIDANCE' });
        state = applySliceIntent(before, row.intent); session = openVisionaryRuntimeSession(state); view = session.projectVisionary();
      }
      expect(captureHash(before, captureInitial), 'Drafts cannot mutate their predecessor').toBe(row.beforeStateSha256);
      expect(captureHash(state, captureInitial)).toBe(row.afterStateSha256); expect(hash(view)).toBe(row.publicAfterSha256);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]); expect(state.random).toEqual(row.randomAfter);
      expect(state.random.seed).toBe(rawSource.random.seed);
      const elapsedWeeks = state.week - before.week; living += elapsedWeeks * 30;
      if (command.type === 'LEARN_GUIDANCE') {
        expect([state.cash, state.actionsRemaining]).toEqual([before.cash - 100, before.actionsRemaining - 1]);
        expect(state.visionary.journal).toEqual([]); expect(state.random).toEqual(before.random);
        same(state.visionary.source!.budget.mastery, rawSource.progression.mastery);
        expect(row.receipts).toEqual({ checks: [], finance: [], notes: ['Actual guidance paid: 100 pennies and one action.'] });
      } else {
        const event = state.visionary.journal.at(-1)!;
        expect(event.revision).toBe(row.revision); same(event.command, command);
        expect(event.before.random).toEqual(row.randomBefore); expect(event.after.random).toEqual(row.randomAfter);
        same({ checks: event.randomReceipts, finance: event.financeReceipts, notes: event.notes }, row.receipts);
        expect(state.random.cursor - before.random.cursor).toBe(event.randomReceipts.length);
        const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
        for (const receipt of event.randomReceipts) {
          expect(receipt.cursorBefore).toBe(rng.cursor); expect(receipt.check.roll).toBe(rng.nextInt(1, 100));
          expect(receipt.cursorAfter).toBe(rng.cursor); draws.push([row.commandCount, receipt.check.roll, receipt.check.tier]);
        }
        expect(rng.cursor).toBe(state.random.cursor);
        const effect = command.type === 'ERA' ? state.visionary.era!.journal.at(-1)!.effect
          : command.type === 'MATERIAL' ? state.visionary.materials!.receipts.at(-1)!.effect : null;
        if (effect) {
          expect(elapsedWeeks).toBe(effect.weeks); expect(state.cash).toBe(before.cash - effect.cashCost + effect.cashGain - 30 * elapsedWeeks);
          expect(state.actionsRemaining).toBe(elapsedWeeks ? state.weeklyBudget : before.actionsRemaining - effect.actions);
          expect(state.spirituality).toBe(before.spirituality - effect.spirituality); expect(state.mind).toBe(before.mind - effect.mind);
          if (command.type === 'MATERIAL') materialCost += effect.cashCost; else eraCost += effect.cashCost;
        }
        if (elapsedWeeks) {
          let finance = { ...event.before.finance, week: before.week, revision: row.revision,
            cash: before.cash - (effect?.cashCost ?? 0), pulse: 'BILL' as const, billAmount: 0 };
          const receipts: VisionaryEvent['financeReceipts'] = [];
          for (let week = 0; week < elapsedWeeks; week++) {
            const result = resolveSliceWeeklyFinance({ ...finance, pulse: 'BILL' }); expect(result.eventId).toBeNull();
            receipts.push(...result.receipts); finance = { ...finance, ...result.state, week: finance.week + 1, pulse: 'BILL' };
          }
          expect(finance.cash).toBe(state.cash); same(finance.debts, state.debts); same(receipts, event.financeReceipts);
        } else expect(event.financeReceipts).toEqual([]);
        if (command.type === 'WORK') {
          wages += 180; expect(state.cash).toBe(before.cash + 180); expect(state.actionsRemaining).toBe(before.actionsRemaining - 1);
          expect(state.wagePaidWeek).toBe(state.week); expect(before.wagePaidWeek).not.toBe(before.week);
        }
        if (command.type === 'NEXT_WEEK') {
          expect(elapsedWeeks).toBe(1); expect(state.cash).toBe(before.cash - 30); expect(state.actionsRemaining).toBe(3);
          expect([state.health, state.mind, state.spirituality]).toEqual([before.health, before.mind, before.spirituality]);
        }
        if (command.type === 'TRAVEL') expect([state.cash, state.actionsRemaining]).toEqual([before.cash - 10, before.actionsRemaining - 1]);
        if (command.type === 'STABILIZE_PROMOTION') {
          expect([state.cash, state.actionsRemaining, state.spirituality, state.mind, state.week]).toEqual([
            before.cash - 100, before.actionsRemaining - 1, before.spirituality - 12, before.mind - 8, before.week,
          ]);
          same(state.visionary.materials, before.visionary.materials);
          expect(state.visionary.promotionStability.preparations).toHaveLength(1);
          expect(state.visionary.promotionStability.preparations[0]).toMatchObject({ compoundId: 'visionary-compound-1', status: 'READY',
            week: 210, startWeek: 209, endWeek: 210, windowId: 'audience-rebuild-natural:quarter-3', spentEventId: null });
        }
        if (command.type === 'CONSUME') {
          expect(row.commandCount).toBe(820); expect(before.visionary.promotionStability.preparations[0]!.status).toBe('READY');
          expect(event.randomReceipts[0]!.check).toMatchObject({ baseAbility: 32, effectiveAbility: 65, difficulty: 55, chance: 70, roll: 67, tier: 'SUCCESS' });
          expect(state.visionary.promotionStability.preparations[0]).toMatchObject({ status: 'SPENT', spentEventId: event.id });
          expect([state.spirituality, state.actionsRemaining, state.cash]).toEqual([before.spirituality - 30, before.actionsRemaining - 1, before.cash]);
          expect(state.progression.sequence).toBe(0); expect(state.visionary.promotionWeek).toBe(210);
          expect(state.progression.mastery['audience.s0.bounded-support']).toBe(0); expect(state.progression.mastery['audience.s0.finite-guidance']).toBe(0);
          assertValidSliceState(state); expect(hash(projectVisionary(state))).toBe(row.publicAfterSha256);
        }
        if (command.type === 'START_EPILOGUE') {
          expect(state.visionary.frame!.nowSecond - before.visionary.frame!.nowSecond).toBe(600);
          expect([state.health, state.mind, state.spirituality, state.actionsRemaining, state.cash]).toEqual([
            before.health, before.mind, before.spirituality, before.actionsRemaining, before.cash,
          ]);
        }
        if (command.type === 'EPILOGUE' && command.command.type === 'SUPPORT_STRUCTURE') {
          expect([state.health, state.mind, state.spirituality, state.actionsRemaining]).toEqual([before.health - 10, before.mind - 14, before.spirituality - 12, before.actionsRemaining - 1]);
          expect(state.visionary.epilogue).toMatchObject({ supportAttempted: true, supportActive: false, routeDamage: 35 });
          expect(state.injuries).toHaveLength(1); expect(state.injuries[0]!.severity).toBe('LIGHT'); expect(state.injuryRisk).toBe(1);
        }
        if (command.type === 'EPILOGUE' && command.command.type === 'GUIDE_RESCUER') {
          expect([state.mind, state.spirituality, state.actionsRemaining]).toEqual([before.mind - 8, before.spirituality - 10, before.actionsRemaining - 1]);
          expect(state.visionary.epilogue).toMatchObject({ guidanceAttempted: true, guidanceActive: true, routeDamage: 35 });
        }
      }
      conserve(state, before);
      const selected = boundaries.find(boundary => boundary.commandCount === row.commandCount);
      if (selected) {
        seenBoundaries.push(row.commandCount);
        expect(entry(selected.file, 'commandCount')).toBe(row.commandCount); same(entry(selected.file, 'lastIntent'), row.intent);
        // The producer retains the entire row, including startedAt, but seals
        // elapsedMilliseconds as null so resumed wall-clock timing is irrelevant.
        same(entry(selected.file, 'audit'), { ...row, elapsedMilliseconds: null });
        expect(hash(entry(selected.file, 'beforeLast'))).toBe(row.beforeStateSha256);
        expect(hash(entry(selected.file, 'final'))).toBe(row.afterStateSha256);
        expect(hash(entry(selected.file, 'public'))).toBe(row.publicAfterSha256);
      }
    }
    expect(seenBoundaries).toEqual(boundaries.map(boundary => boundary.commandCount));
    expect(draws).toEqual([[820, 67, 'SUCCESS'], [830, 86, 'FAILURE'], [831, 29, 'SUCCESS']]);
    expect({ wages, living, materialCost, eraCost }).toEqual({ wages: 8100, living: 2070, materialCost: 4200, eraCost: 270 });
    expect(state.cash).toBe(400 + wages - living - materialCost - eraCost - 100 - 100 - 6 * 10);
    expect(captureHash(state, captureInitial)).toBe(FINAL_SHA); expect(cp.finalStateSha256).toBe(FINAL_SHA);
    expect(hash(view)).toBe(FINAL_PUBLIC_SHA); expect(cp.publicStateSha256).toBe(FINAL_PUBLIC_SHA);
    expect(captureHash(session!.snapshot(), captureInitial)).toBe(FINAL_SHA);
    expect(hash(session!.projectVisionary())).toBe(FINAL_PUBLIC_SHA);
    same(state, migrateExactly(cp.state)); same(cp.state, entry('natural.json', 'final'));
    assertValidSliceState(state); expect(hash(projectVisionary(state))).toBe(FINAL_PUBLIC_SHA);
    expect(state).toMatchObject({ revision: 834, status: 'ACTIVE', week: 213,
      date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 7, day: 21 }, health: 90, mind: 78, spirituality: 98,
      cash: 1700, actionsRemaining: 0, injuryRisk: 1, progression: { pathwayId: 'audience', sequence: 0 },
      random: { seed: 'audience-rebuild-first', cursor: 483 } });
    for (const key of [...VISIONARY_FROZEN_SOURCE_KEYS, 'world', 'combatHistory'] as const) same(state[key], rawSource[key]);
    expect(state.progression.mastery['audience.s0.bounded-support']).toBe(5); expect(state.progression.mastery['audience.s0.finite-guidance']).toBe(10);
    const era = state.visionary.era!, epilogue = state.visionary.epilogue!, materials = state.visionary.materials!;
    expect(era.cities.every(city => city.pilot && city.connected && city.staffAssigned === 2 && city.facility >= 60)).toBe(true);
    expect(era.governments.every(government => government.adopted)).toBe(true);
    expect(era.forecast).toMatchObject({ plan: 'PUBLIC_RELAY', week: 189, minimumStations: 5, rounds: 2 });
    expect(era.nodes.map(node => [node.id, node.startWeek, node.endWeek, node.verifiedWeek])).toEqual([
      ['quarter-1', 183, 184, null], ['quarter-2', 196, 197, null], ['quarter-3', 209, 210, 209], ['quarter-4', 222, 223, null],
    ]);
    expect(era.incidents.slice(0, 4).map(incident => [incident.departed, incident.resolvedWeek])).toEqual([[4, 204], [4, 204], [4, 205], [4, 205]]);
    expect(era.incidents.slice(4, 6).map(incident => [incident.departed, incident.resolvedWeek, incident.deadlineWeek])).toEqual([[0, 202, 205], [0, 206, 209]]);
    expect(era.incidents.slice(6)).toEqual([
      { id: 'pritz-beacon', phase: 'PENDING', releaseWeek: 215, deadlineWeek: 218, assisted: 0, departed: 0, delivered: 0, resolution: null, resolvedWeek: null, receipt: null },
      { id: 'trier-cold', phase: 'PENDING', releaseWeek: 219, deadlineWeek: 222, assisted: 0, departed: 0, delivered: 0, resolution: null, resolvedWeek: null, receipt: null },
    ]);
    expect(materials.characteristics.map(item => item.holder)).toEqual(['FUSED', 'FUSED', 'FUSED']); expect(materials.uniqueness.holder).toBe('FUSED');
    expect(materials.compounds).toHaveLength(1); expect(materials.compounds[0]!.status).toBe('SUCCESS');
    expect(materials.batches.map(batch => [batch.status, batch.uses])).toEqual([['SPENT', 1], ['SUPPLIER', 0], ['SUPPLIER', 0]]);
    expect(epilogue).toMatchObject({ status: 'RESOLVED', reported: true, supportAttempted: true, supportActive: false,
      guidanceAttempted: true, guidanceActive: false, turns: 3, routeDamage: 35, willingRescuerId: 'era-rescuer-oswin', resistingRescuerId: 'era-rescuer-clara' });
    expect(epilogue.rescueInjuries).toEqual(['R210:audience-rebuild-natural:831:era-rescuer-oswin:strain']);
    expect(epilogue.patients).toEqual(era.epilogueOrigin.patients.map(patient => ({ id: patient.id, injury: patient.injury, status: 'EVACUATED' })));
    expect(epilogue.objectIds).toEqual(era.epilogueOrigin.objects.map(object => object.id)); expect(epilogue.objectIds).toContain('era-west-stretcher');
    expect(epilogue.journal.map(event => event.command.type)).toEqual(['OBSERVE', 'SUPPORT_STRUCTURE', 'GUIDE_RESCUER', 'EVACUATE', 'REPORT']);
    expect(cp.terminal.stage).toBe('NATURAL_RESCUE_REPORTED'); expect(entry('natural.json', 'stage')).toBe(cp.terminal.stage);
    expect(entry('natural.json', 'pendingIntent')).toBeNull();
    const summary = json<{ stage: string; commands: number; originalCommands: number; newCommands: number; paused: boolean; strictFinalValidation: boolean; public: VisionaryProjection }>('summary.json');
    expect(summary).toMatchObject({ stage: 'NATURAL_RESCUE_REPORTED', commands: FINAL_COUNT, originalCommands: PREFIX,
      newCommands: TAIL, paused: false, strictFinalValidation: true }); same(summary.public, view);
  }, 150_000); // Actual producer spent26.7s on174 actions; allow hashing33 full boundaries and three cold checks, not quadratic raw replay.

  it('keeps the separate original667 source death dead after explicit current migration', () => {
    expect(pin(HISTORY).sha256).toBe(HISTORY_SHA);
    const raw = readObjectEntry<SliceState>(HISTORY, 'final');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([185, 'writer-v185']);
    const dead = migrateExactly(raw); assertValidSliceState(dead);
    expect(dead).toMatchObject({ revision: 668, status: 'DEAD', health: 0, mind: 93, spirituality: 110,
      cash: 400, week: 144, actionsRemaining: 1, injuryRisk: 2, ending: { kind: 'DEATH' },
      random: { seed: 'audience-rebuild-first', cursor: 537 } });
    expect(dead.writer.encounter).toMatchObject({ status: 'LOST', enemyStatus: 'RESISTING', enemyHealth: 100,
      enemyMind: 56, enemySpirituality: 74, reciprocalAttempts: 2, reciprocalSuccesses: 0,
      terminal: { outcome: 'PLAYER_DEAD', round: 5, exitMetres: 0, exitSeconds: 0 } });
    expect(dead.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null]]);
    same(dead.visionary, createVisionaryState()); expect(visionarySourceBlock(dead)).not.toBeNull();
    expect(visionaryCommandBlock(dead, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    expect(projectVisionary(dead).actions.every(action => !action.enabled)).toBe(true);
    expect(captureHash(dead, raw)).toBe(hash(raw)); expect(pin(HISTORY).sha256).toBe(HISTORY_SHA);
  }, 20_000);
});
