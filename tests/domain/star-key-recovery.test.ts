import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyStarKeyAcquisition, createStarKeyState, resolveStarKeyOriginalsSnapshot, resolveStarKeyOriginals,
  starKeyAcquisitionBlock, starKeyAcquisitionActions, starKeyCharacteristicId, starKeyFinanceSnapshot,
  validateStarKeyAcquisitionCommand, validateStarKeyAcquisitionJournal } from '../../src/domain/star-key/index.js';
import { STAR_KEY_RECOVERY_SCHEMA_VERSION, STAR_KEY_GUIDE } from '../../src/domain/star-key/content.js';
import { STAR_KEY_PREPARATION_IDS, type StarKeyAcquisitionCommand, type StarKeyAcquisitionBudget,
  type StarKeyAcquisitionEvent } from '../../src/domain/star-key/types.js';
import { doorAcquisitionSnapshot } from '../../src/domain/door/source.js';
import { resolveDoorOriginals } from '../../src/domain/door/originals.js';
import { originalPlaneswalker } from './star-key-directed-helper.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const original = (n: number) => `star-key-potion-${n}`;
const apply = (s: SliceState, command: StarKeyAcquisitionCommand) => {
  applyStarKeyAcquisition(s, command, { note() {}, roll() { throw Error('No extra recovery draw'); }, check(ability, difficulty) {
    const stream = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
    const check = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: stream.nextInt(1, 100) });
    s.random.cursor = stream.cursor; return check;
  } }); s.revision++;
};
/** Acquisition-only component inputs. These explicitly supplied budget/cursor
 * gaps are never used as natural-play evidence or to alter a recorded outcome. */
function component(tiers: PublicResolutionTier[]): SliceState {
  const s = originalPlaneswalker(); s.schemaVersion = STAR_KEY_RECOVERY_SCHEMA_VERSION;
  const weeks = Math.max(0, s.planeswalker.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameWeeks(s.date, weeks); s.revision += 2;
  s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  expect(s.starKey.acquisitionJournal).toHaveLength(0);
  let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 65536; cursor++) {
    const stream = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (tiers.every(tier => resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: stream.nextInt(1, 100) }).tier === tier)) { selected = cursor; break; }
  }
  expect(selected).not.toBeNull(); s.random.cursor = selected!;
  apply(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of STAR_KEY_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId });
  return s;
}
function resourceGap(s: SliceState) { s.revision += 2; s.health = 100; s.mind = 100; s.spirituality = 120; s.seer.pollution = 0; s.actionsRemaining = 100; }
function consume(s: SliceState, id: string) {
  resourceGap(s);
  if (s.starKey.bottles.find(b => b.id === id)!.status === 'SUPPLIER') apply(s, { type: 'BUY_POTION', bottleId: id });
  apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, { type: 'CONSUME', bottleId: id, confirmed: true });
}
function nextWeek(s: SliceState) { s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2; }
function recover(s: SliceState, bottleId: string) {
  const cursor = s.random.cursor, before = structuredClone(s.starKey.bottles), cash = s.cash;
  apply(s, { type: 'REQUEST_RECOVERY_V1', bottleId });
  expect(s.starKey.bottles).toEqual(before); expect(s.cash).toBe(cash - 120);
  expect(starKeyAcquisitionBlock(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId })).not.toBeNull();
  nextWeek(s); apply(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId });
  expect(s.random.cursor).toBe(cursor); expect(s.cash).toBe(cash - 150);
  expect(s.starKey.bottles.slice(0, before.length)).toEqual(before);
  const id = s.starKey.bottles.at(-1)!.id; expect(id).toMatch(/^star-key-recovery-[1-9]\d*$/); return id;
}
function threeFailures(extra: PublicResolutionTier[] = []) {
  const s = component(['FAILURE', 'FAILURE', 'FAILURE', ...extra]);
  for (const n of [1, 2, 3]) consume(s, original(n)); return s;
}
const budget = (s: SliceState): StarKeyAcquisitionBudget => ({ actions: s.actionsRemaining, health: s.health, mind: s.mind,
  spirituality: s.spirituality, cash: s.cash, pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1,
  acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery },
  completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk });
/** Archived old protocol fixture; there is no runtime replay flag or write API. */
function archivedSupply(s: SliceState, receive: boolean) {
  const before = budget(s), command = { type: receive ? 'RECEIVE_SUPPLY' : 'REQUEST_SUPPLY' } as StarKeyAcquisitionCommand;
  if (!receive) { s.cash -= 100; s.actionsRemaining--; s.starKey.resupply.requestedWeek = s.week; }
  else {
    for (const n of [4, 5, 6]) s.starKey.bottles.push({ ...createStarKeyState().bottles[0]!, id: original(n), stockedWeek: s.week,
      source: `${STAR_KEY_GUIDE}第${Math.ceil(n / 3)}批、第${s.week}周实际到货的序列1星之匙成品，独立封存编号${original(n)}。本瓶须另行取得并独立耗用。` });
    s.starKey.resupply.deliveries++; s.starKey.resupply.requestedWeek = null;
  }
  const event: StarKeyAcquisitionEvent = { week: s.week, date: { ...s.date }, revision: s.revision, command,
    actor: { ...s.starKey.acquisitionJournal[0]!.actor, sourceHistoryDigest: null }, before, after: budget(s),
    finance: starKeyFinanceSnapshot(s), cursorBefore: s.random.cursor, cursorAfter: s.random.cursor, randomBefore: null, randomAfter: null, check: null };
  s.starKey.acquisitionJournal.push(event); s.revision++;
}

describe('Star Key R218 same-original recovery', () => {
  it('retains the raw natural823 source, original1 failure, original2 embodied and original3 supplied', () => {
    const path = 'tests/fixtures/star-key-v01960/natural.json', bytes = readFileSync(path);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('d9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d');
    const s = readObjectEntry<SliceState>(path, 'final'), before = stableStringify(s);
    expect([s.schemaVersion, s.week, s.revision, s.health, s.mind, s.cash, s.random.cursor]).toEqual([193, 218, 1131, 80, 98, 3900, 205]);
    expect(resolveStarKeyOriginals(s)?.characteristics.map(c => c.holder)).toEqual(['FAILED_REMNANT', 'EMBODIED', 'SUPPLIER']);
    expect(resolveDoorOriginals(doorAcquisitionSnapshot(s))?.embodiedOriginalBottleId).toBe(original(2));
    expect(stableStringify(s)).toBe(before);
  }, 60000);
  for (const n of [1, 2, 3]) for (const custody of ['SUPPLIER', 'PLAYER', 'FAILED_REMNANT'] as const) it(`derives actual original${n} success with external ${custody}`, () => {
    const s = component(custody === 'FAILED_REMNANT' ? ['FAILURE', 'FAILURE', 'SUCCESS'] : ['SUCCESS']);
    for (const other of [1, 2, 3].filter(x => x !== n)) {
      if (custody === 'PLAYER') apply(s, { type: 'BUY_POTION', bottleId: original(other) });
      if (custody === 'FAILED_REMNANT') consume(s, original(other));
    }
    consume(s, original(n));
    expect(validateStarKeyAcquisitionJournal(s)).toBe(true);
    const result = resolveStarKeyOriginalsSnapshot(s.starKey)!; expect(result).not.toBeNull();
    expect(result.embodiedOriginalBottleId).toBe(original(n)); expect(result.characteristics).toHaveLength(3);
    expect(result.characteristics.map(c => c.holder)).toEqual([1, 2, 3].map(x => x === n ? 'EMBODIED' : custody));
    expect(resolveDoorOriginals(doorAcquisitionSnapshot(s))?.embodiedOriginalBottleId).toBe(original(n));
  }, 60000);
  for (const n of [1, 2, 3]) it(`recovers original${n} twice without potion4 or a fourth characteristic`, () => {
    const s = threeFailures(['FAILURE', 'SUCCESS']), originals = structuredClone(s.starKey.bottles), oldJournal = structuredClone(s.starKey.acquisitionJournal);
    const first = recover(s, original(n)); consume(s, first); const second = recover(s, first); consume(s, second);
    expect(validateStarKeyAcquisitionJournal(s)).toBe(true);
    const result = resolveStarKeyOriginalsSnapshot(s.starKey)!;
    expect(result.embodiedOriginalBottleId).toBe(original(n)); expect(result.embodiedBottleId).toBe(second);
    expect(result.characteristics.map(c => c.characteristicId)).toEqual([1, 2, 3].map(x => starKeyCharacteristicId(original(x))));
    expect(s.starKey.bottles.some(b => b.id === original(4))).toBe(false);
    expect(s.starKey.bottles.slice(0, 3)).toEqual(originals); expect(s.starKey.acquisitionJournal.slice(0, oldJournal.length)).toEqual(oldJournal);
    expect(resolveDoorOriginals(doorAcquisitionSnapshot(s))?.embodiedOriginalBottleId).toBe(original(n));
  }, 60000);
  it('charges new labour only to its actual recovery vessel and preserves original6600/1100 economics', () => {
    const s = threeFailures(), id = recover(s, original(1)), cash = s.cash;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: id });
    expect(s.cash).toBe(cash); apply(s, { type: 'BUY_POTION', bottleId: id }); expect(s.cash).toBe(cash - 90);
    expect(s.starKey.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(starKeyAcquisitionBlock(s, { type: 'REQUEST_RECOVERY_V1', bottleId: original(1) })).not.toBeNull();
  }, 60000);
  it('rejects legacy resupply writes and command-supplied physical evidence or replay bypasses', () => {
    for (const command of [{ type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'REQUEST_RECOVERY_V1', bottleId: original(1), historicalReplay: true },
      { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: original(1), recoverySite: {} },
      { type: 'REQUEST_RECOVERY_V1', bottleId: original(1), success: true }]) expect(validateStarKeyAcquisitionCommand(command)).toBe(false);
    const s = threeFailures(); expect(starKeyAcquisitionActions(s).some(a => ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(a.command.type))).toBe(false);
    for (const patch of [{ actionsRemaining: 0 }, { cash: 119 }, { schemaVersion: 217 }])
      expect(starKeyAcquisitionBlock({ ...s, ...patch }, { type: 'REQUEST_RECOVERY_V1', bottleId: original(1) })).not.toBeNull();
  }, 60000);
  it('preserves legal legacy4+ replay but rejects its conflicting conservation admission', () => {
    const s = threeFailures(); archivedSupply(s, false); nextWeek(s); archivedSupply(s, true);
    const before = stableStringify(s.starKey); expect(validateStarKeyAcquisitionJournal(s)).toBe(true);
    expect(resolveStarKeyOriginalsSnapshot(s.starKey)).toBeNull();
    expect(starKeyAcquisitionBlock(s, { type: 'BUY_POTION', bottleId: original(4) })).not.toBeNull();
    expect(stableStringify(s.starKey)).toBe(before);
  }, 60000);
  it('rejects changed original, false permission, missing physical chain and free recovery', () => {
    const s = threeFailures(); recover(s, original(1));
    for (const mutate of [
      (x: SliceState) => { x.starKey.bottles.at(-1)!.recovery!.originalBottleId = original(2); },
      (x: SliceState) => { x.starKey.bottles.at(-1)!.id = original(4); },
      (x: SliceState) => { x.starKey.acquisitionJournal.at(-1)!.after.cash += 30; },
      (x: SliceState) => { x.starKey.acquisitionJournal.at(-1)!.recoverySite!.permission.week--; },
      (x: SliceState) => { delete x.starKey.acquisitionJournal.at(-1)!.recoverySite; },
      (x: SliceState) => { x.starKey.acquisitionJournal.at(-2)!.recoverySite!.custodyAfter = 'SUPPLIER'; },
      (x: SliceState) => { x.starKey.acquisitionJournal.at(-1)!.recoverySite!.originals.site.parcel.location = 'PLAYER'; },
    ]) { const forged = structuredClone(s); mutate(forged); expect(resolveStarKeyOriginalsSnapshot(forged.starKey)).toBeNull(); expect(validateStarKeyAcquisitionJournal(forged)).toBe(false); }
  }, 60000);
});
