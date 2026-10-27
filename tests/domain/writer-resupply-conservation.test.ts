import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyWriterCommand, createWriterState, projectWriter, resolveWriterOriginalCharacteristics, resolveWriterOriginalCharacteristicsSnapshot, validateWriterAcquisitionCommand, validateWriterAcquisitionJournal, validateWriterState, writerAcquisitionBlock } from '../../src/domain/writer/index.js';
import { WRITER_BOTTLE_IDS, WRITER_GUIDE } from '../../src/domain/writer/content.js';
import { WRITER_PREPARATION_IDS, type WriterAcquisitionBudget, type WriterAcquisitionCommand } from '../../src/domain/writer/types.js';
import { directedInitial2, originalAudienceRoots } from './writer-directed-helper.js';

const FIRST = 'writer-potion-1', FOURTH = 'writer-potion-4';
const request = { type: 'REQUEST_RECOVERY_V1', bottleId: FIRST } as const;
const recover = { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: FIRST } as const;
function context(s: SliceState): SeerContext {
  return { note() {}, roll(min, max) { const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), value = rng.nextInt(min, max); s.random.cursor = rng.cursor; return value; },
    check(ability, difficulty) { return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: this.roll(1, 100) }); } };
}
function issue(s: SliceState, command: WriterAcquisitionCommand): void { applyWriterCommand(s, command, context(s)); s.revision++; }
function budget(s: SliceState): WriterAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, pollution: s.seer.pollution,
    gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats },
    mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
/** Explicit module-host fixtures, not a natural campaign. Mature date, cash and
 * weekly budget are declared before the first new receipt. Choose a future
 * original-seed cursor before guidance; never rewrite an existing roll/receipt.
 * Between attempts the host supplies a later real-week boundary and restored
 * health/mind as directed test inputs, outside the acquisition cost assertions. */
function futureRolls(s: SliceState, failures: number): number {
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 100_000; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor), rolls = Array.from({ length: failures + 1 }, () => rng.nextInt(1, 100));
    if (rolls.slice(0, failures).every(r => r > chance && r < 96) && rolls[failures]! > 5 && rolls[failures]! <= chance) return cursor;
  }
  throw Error('No bounded declared future-roll sequence found.');
}
function nextHostWeek(s: SliceState): void { s.week++; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 100; s.health = 98; s.mind = 98; s.revision += 2; }
const failedCache = new Map<number, SliceState>();
function allFailed(failures = 4): SliceState {
  const cached = failedCache.get(failures); if (cached) return structuredClone(cached);
  const s = directedInitial2('THREE_FAILURES'); s.random.cursor = futureRolls(s, failures);
  issue(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of WRITER_PREPARATION_IDS) issue(s, { type: 'PREPARE_TASK', taskId });
  for (const bottleId of WRITER_BOTTLE_IDS) {
    issue(s, { type: 'BUY_POTION', bottleId }); issue(s, { type: 'PREPARE_PROMOTION' }); issue(s, { type: 'CONSUME', bottleId, confirmed: true });
  }
  expect(s.writer.bottles.every(b => b.outcome === 'FAILURE')).toBe(true);
  expect(validateWriterState(s)).toBe(true); failedCache.set(failures, structuredClone(s)); return s;
}
function recovered(failures = 4): SliceState { const s = allFailed(failures); issue(s, request); nextHostWeek(s); issue(s, recover); return s; }
function consume(s: SliceState, bottleId: string): void { issue(s, { type: 'BUY_POTION', bottleId }); issue(s, { type: 'PREPARE_PROMOTION' }); issue(s, { type: 'CONSUME', bottleId, confirmed: true }); }
function historicalSupply(s: SliceState, type: 'REQUEST_SUPPLY' | 'RECEIVE_SUPPLY'): void {
  // Reconstruct an expressly old-format receipt. No live legacy mutator is exported.
  const before = budget(s), state = s.writer;
  if (type === 'REQUEST_SUPPLY') { s.actionsRemaining--; state.resupply.requestedWeek = s.week; }
  else {
    const first = state.bottles.length + 1;
    for (let number = first; number < first + 3; number++) state.bottles.push({ id: `writer-potion-${number}`,
      source: `${WRITER_GUIDE}第${Math.ceil(number / 3)}批、第${s.week}周实际到货的序列1作家成品，独立封存编号writer-potion-${number}。本瓶须另行取得并独立耗用。`,
      stockedWeek: s.week, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
    state.resupply.deliveries++; state.resupply.requestedWeek = null;
  }
  state.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, command: { type },
    actor: { ...structuredClone(state.acquisitionJournal[0]!.actor), sourceHistoryDigest: null }, before, after: budget(s), randomBefore: null, randomAfter: null, check: null });
  s.revision++;
}

describe('Writer versioned resupply conserves the three actual original characteristics', () => {
  it('keeps old default bytes and first-bottle practiced source unchanged; rejects live independent supply', () => {
    const state = createWriterState(); expect(state.resupply).toEqual({ requestedWeek: null, deliveries: 0 }); expect(state.bottles).toHaveLength(3);
    expect(state.bottles.every(b => !Object.hasOwn(b, 'recovery'))).toBe(true);
    const file = 'tests/fixtures/writer-v01880/snapshot-practiced.json', bytes = readFileSync(file, 'utf8'), old = JSON.parse(bytes) as SliceState;
    expect(sha256Hex(bytes)).toBe('49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc');
    const migrated = migrateSliceState(old); expect(migrated.writer).toEqual(old.writer); expect(validateWriterState(migrated)).toBe(true);
    expect(resolveWriterOriginalCharacteristics(migrated)).toMatchObject({ embodiedOriginalBottleId: FIRST, embodiedBottleId: FIRST });
    for (const type of ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'] as const) {
      expect(validateWriterAcquisitionCommand({ type })).toBe(false); expect(validateSlicePayload({ type: 'WRITER', command: { type } })).toBe(false);
      const s = allFailed(), before = stableStringify(s); expect(writerAcquisitionBlock(s, { type })).toMatch(/历史回放/);
      expect(() => issue(s, { type })).toThrow(); expect(stableStringify(s)).toBe(before);
    }
    for (const command of [request, recover]) expect(validateSlicePayload({ type: 'WRITER', command })).toBe(true);
    expect(validateWriterAcquisitionCommand({ ...request, free: true })).toBe(false);
  }, 60_000);

  it('charges investigation and later recovery without healing, RNG changes, new originals or altered receipts', () => {
    const s = allFailed(), originals = structuredClone(s.writer.bottles), receipts = structuredClone(s.writer.acquisitionJournal), roots = structuredClone(originalAudienceRoots(s)), before = budget(s), rng = { ...s.random };
    issue(s, request); expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 120, before.actions - 1]);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([before.health, before.mind, before.pollution]);
    expect(writerAcquisitionBlock(s, recover)).toMatch(/隔一真实周/); expect(writerAcquisitionBlock(s, { ...request, bottleId: 'writer-potion-2' })).not.toBeNull();
    nextHostWeek(s); const beforeRecovery = budget(s); issue(s, recover);
    expect([s.cash, s.actionsRemaining]).toEqual([beforeRecovery.cash, beforeRecovery.actions - 1]); expect(s.random).toEqual(rng);
    expect(s.writer.bottles).toHaveLength(4); expect(s.writer.bottles.slice(0, 3)).toEqual(originals); expect(s.writer.acquisitionJournal.slice(0, receipts.length)).toEqual(receipts);
    expect(s.writer.bottles[3]).toMatchObject({ id: FOURTH, status: 'SUPPLIER', labourSteps: 0, acquiredWeek: null,
      recovery: { version: 1, sourceBottleId: FIRST, originalBottleId: FIRST, characteristicId: `${FIRST}:characteristic`, requestedWeek: s.week - 1, recoveredWeek: s.week } });
    expect(originalAudienceRoots(s)).toEqual(roots); expect(validateWriterState(s)).toBe(true);
    expect(resolveWriterOriginalCharacteristics(s)?.characteristics).toHaveLength(3);
    expect(projectWriter(s).actions.some(a => a.command.type === 'REQUEST_SUPPLY' || a.command.type === 'RECEIVE_SUPPLY')).toBe(false);
    expect(writerAcquisitionBlock(s, request)).not.toBeNull(); expect(writerAcquisitionBlock(s, recover)).not.toBeNull();
  });

  it('requires new ordinary drug costs and five new labor actions, never reusing the old cost', () => {
    const s = recovered(), initial = budget(s); issue(s, { type: 'BUY_POTION', bottleId: FOURTH }); expect(s.cash).toBe(initial.cash - 900);
    expect(s.actionsRemaining).toBe(initial.actions); expect(validateWriterState(s)).toBe(true);
    const discounted = recovered(), before = budget(discounted);
    for (let n = 0; n < 5; n++) issue(discounted, { type: 'POTION_WORK', bottleId: FOURTH });
    expect([discounted.cash, discounted.actionsRemaining]).toEqual([before.cash, before.actions - 5]);
    issue(discounted, { type: 'BUY_POTION', bottleId: FOURTH }); expect(discounted.cash).toBe(before.cash - 90);
    const paid = discounted.cash, ap = discounted.actionsRemaining; issue(discounted, { type: 'PREPARE_PROMOTION' });
    expect([discounted.cash, discounted.actionsRemaining]).toEqual([paid - 140, ap - 1]); expect(validateWriterState(discounted)).toBe(true);
    expect(resolveWriterOriginalCharacteristicsSnapshot(discounted.writer)?.characteristics[0]?.holder).toBe('PLAYER');
  });

  it('recovers a repeated failure through its latest attempt and finally embodies that same first original', () => {
    const s = recovered(); consume(s, FOURTH); expect(s.writer.bottles[3]!.outcome).toBe('FAILURE');
    const originals = structuredClone(s.writer.bottles), before = stableStringify(s.writer.acquisitionJournal);
    expect(writerAcquisitionBlock(s, request)).not.toBeNull(); issue(s, { type: 'REQUEST_RECOVERY_V1', bottleId: FOURTH }); nextHostWeek(s); issue(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: FOURTH });
    expect(s.writer.bottles[4]!.recovery).toMatchObject({ sourceBottleId: FOURTH, originalBottleId: FIRST, characteristicId: `${FIRST}:characteristic` });
    expect(s.writer.bottles.slice(0, 4)).toEqual(originals); expect(stableStringify(s.writer.acquisitionJournal.slice(0, JSON.parse(before).length))).toBe(before);
    consume(s, 'writer-potion-5'); expect(s.progression.sequence).toBe(1); expect(validateWriterState(s)).toBe(true);
    const bytes = stableStringify(s), lineage = resolveWriterOriginalCharacteristics(s);
    expect(lineage).toMatchObject({ embodiedOriginalBottleId: FIRST, embodiedBottleId: 'writer-potion-5' });
    expect(lineage!.characteristics.map(c => c.characteristicId)).toEqual(WRITER_BOTTLE_IDS.map(id => `${id}:characteristic`));
    expect(lineage!.characteristics[0]).toMatchObject({ latestBottleId: 'writer-potion-5', holder: 'EMBODIED' }); expect(stableStringify(s)).toBe(bytes);
  });

  it.each(['SUPPLIER', 'PLAYER'] as const)('can retain a %s recovered original while another original succeeds', holder => {
    const s = recovered(3); if (holder === 'PLAYER') issue(s, { type: 'BUY_POTION', bottleId: FOURTH });
    issue(s, { type: 'REQUEST_RECOVERY_V1', bottleId: 'writer-potion-2' });
    expect(writerAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull(); nextHostWeek(s);
    issue(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'writer-potion-2' }); consume(s, 'writer-potion-5');
    expect(validateWriterState(s)).toBe(true);
    expect(resolveWriterOriginalCharacteristics(s)).toMatchObject({ embodiedOriginalBottleId: 'writer-potion-2', embodiedBottleId: 'writer-potion-5', characteristics: [
      { originalBottleId: FIRST, latestBottleId: FOURTH, holder }, { originalBottleId: 'writer-potion-2', holder: 'EMBODIED' }, { originalBottleId: 'writer-potion-3', holder: 'FAILED_REMAINS' },
    ] });
  });

  it('rejects forged ancestry, free costs, altered evidence, repeated ownership, and recovery hidden in an old schema', () => {
    const s = recovered(), original = stableStringify(s);
    const mutations: Array<(v: SliceState) => void> = [
      v => { v.writer.bottles[3]!.recovery!.originalBottleId = 'writer-potion-2'; },
      v => { v.writer.bottles[3]!.recovery!.characteristicId = `${FOURTH}:characteristic`; },
      v => { v.writer.bottles[3]!.recovery!.sourceBottleId = FOURTH; },
      v => { v.writer.bottles[3]!.recovery!.recoveredWeek--; },
      v => { Object.assign(v.writer.bottles[3]!.recovery!, { fabricated: true }); },
      v => { v.writer.bottles[0]!.status = 'PLAYER'; },
      v => { v.writer.acquisitionJournal.find(e => e.command.type === 'REQUEST_RECOVERY_V1')!.after.cash++; },
      v => { v.writer.acquisitionJournal.find(e => e.command.type === 'CONSUME')!.check!.tier = 'SUCCESS'; },
      v => { v.writer.acquisitionJournal = v.writer.acquisitionJournal.filter(e => e.command.type !== 'REQUEST_RECOVERY_V1'); },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateWriterState(bad)).toBe(false); expect(resolveWriterOriginalCharacteristicsSnapshot(bad.writer)).toBeNull(); }
    for (const schemaVersion of [185, 206]) { const bad = structuredClone(s); Object.assign(bad, { schemaVersion }); expect(validateWriterState(bad)).toBe(false); }
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); expect(validateWriterState(s)).toBe(true); expect(stableStringify(s)).toBe(original);
  });

  it('replays real legacy independent deliveries without converting their original identities', () => {
    const s = allFailed(); historicalSupply(s, 'REQUEST_SUPPLY'); nextHostWeek(s); historicalSupply(s, 'RECEIVE_SUPPLY');
    const before = stableStringify(s.writer); expect(s.writer.bottles).toHaveLength(6); expect(s.writer.bottles.slice(3).every(b => !b.recovery)).toBe(true);
    expect(validateWriterAcquisitionJournal(s)).toBe(true); expect(validateWriterState(s)).toBe(true); expect(resolveWriterOriginalCharacteristics(s)).toBeNull(); expect(stableStringify(s.writer)).toBe(before);
    const old = structuredClone(s); Object.assign(old, { schemaVersion: 185 }); expect(validateWriterState(old)).toBe(true);
    const pending = allFailed(); historicalSupply(pending, 'REQUEST_SUPPLY'); const cash = pending.cash, actions = pending.actionsRemaining;
    issue(pending, request); expect([pending.cash, pending.actionsRemaining]).toEqual([cash - 120, actions - 1]);
    expect(validateWriterState(pending)).toBe(true); expect(resolveWriterOriginalCharacteristics(pending)?.characteristics).toHaveLength(3);
  });
});
