import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyThunderGodAcquisition, projectThunderGod, resolveThunderGodOriginalsSnapshot,
  thunderGodAcquisitionBlock, validateThunderGodAcquisitionCommand, validateThunderGodAcquisitionJournal,
  validateThunderGodSource, validateThunderGodState } from '../../src/domain/thunder-god/index.js';
import type { ThunderGodAcquisitionCommand } from '../../src/domain/thunder-god/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { actualFailedTyrantSource } from './tyrant-material-fixtures.js';

/** Port-budget gaps are explicit unit-test inputs, not ordinary-life trace proof.
 * The source itself, its old outcomes and the future random stream are untouched. */
function harness() {
  const s = actualFailedTyrantSource(); s.schemaVersion = 215;
  const apply = (c: ThunderGodAcquisitionCommand) => {
    applyThunderGodAcquisition(s, c, { note() {}, roll() { throw Error('No extra draw'); }, check(ability, difficulty) {
      const stream = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), roll = stream.nextInt(1, 100); s.random.cursor = stream.cursor;
      return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
    } }); s.revision++;
  };
  const gap = (week = false) => {
    s.revision += 2; if (week) { s.week++; s.date = addGameWeeks(s.date, 1); }
    s.actionsRemaining = 100; s.cash = 10000; s.health = 100; s.mind = 100; s.spirituality = 120;
  };
  const recover = (n: 1 | 2 | 3 = 1) => {
    apply({ type: 'REQUEST_RECOVERY_V1', bottleId: `thunder-god-potion-${n}` }); gap(true);
    apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: `thunder-god-potion-${n}` }); return s.thunderGod.bottles.at(-1)!.id;
  };
  return { s, apply, gap, recover };
}

describe('future S1 recovery preserves the genuine pre-fourth source', () => {
  it('pins actual boundary701, three failures and preserved resources', () => {
    const s = actualFailedTyrantSource();
    expect([s.revision, s.week, s.status, s.progression.sequence, s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining, s.seer.pollution])
      .toEqual([702, 169, 'ACTIVE', 2, 93, 85, 120, 210, 2, 20]);
    expect(s.thunderGod.bottles).toHaveLength(3); expect(s.thunderGod.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
    expect(validateThunderGodSource(s)).toBe(true); expect(validateThunderGodAcquisitionJournal(s)).toBe(true);
  });
  it.each([1, 2, 3] as const)('investigates original%s now and hands over that same identity only after a real week', n => {
    const h = harness(), { s } = h, old = stableStringify(s.thunderGod.bottles), oldSite = stableStringify(s.catastrophe.life.site), seed = s.random.seed, cursor = s.random.cursor;
    h.apply({ type: 'REQUEST_RECOVERY_V1', bottleId: `thunder-god-potion-${n}` });
    expect([s.cash, s.actionsRemaining]).toEqual([90, 1]); expect(s.thunderGod.bottles).toHaveLength(3);
    expect(thunderGodAcquisitionBlock(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: `thunder-god-potion-${n}` })).not.toBeNull();
    h.gap(true); h.apply({ type: 'RECOVER_CHARACTERISTIC_V1', bottleId: `thunder-god-potion-${n}` });
    expect(stableStringify(s.thunderGod.bottles.slice(0, 3))).toBe(old); expect(stableStringify(s.catastrophe.life.site)).toBe(oldSite);
    expect(s.thunderGod.bottles[3]).toMatchObject({ id: 'thunder-god-potion-4', labourSteps: 0, status: 'SUPPLIER', recovery: { originalBottleId: `thunder-god-potion-${n}`, characteristicId: `thunder-god-potion-${n}:characteristic` } });
    expect([s.random.seed, s.random.cursor]).toEqual([seed, cursor]);
    expect(resolveThunderGodOriginalsSnapshot(s.thunderGod)?.characteristics).toHaveLength(3);
    expect(validateThunderGodAcquisitionJournal(s)).toBe(true);
  });
  it('requires the same original scene and present custodian, rejecting public certificate extras', () => {
    const h = harness(); h.s.catastrophe.life.site.keeper.position = 'EXIT';
    expect(thunderGodAcquisitionBlock(h.s, { type: 'REQUEST_RECOVERY_V1', bottleId: 'thunder-god-potion-1' })).not.toBeNull();
    expect(validateThunderGodAcquisitionCommand({ type: 'REQUEST_RECOVERY_V1', bottleId: 'thunder-god-potion-1', permission: true })).toBe(false);
    expect(validateThunderGodAcquisitionCommand({ type: 'REQUEST_SUPPLY' })).toBe(false);
    expect(validateThunderGodAcquisitionCommand({ type: 'RECEIVE_SUPPLY' })).toBe(false);
  });
  it('charges900 fresh carrier or five new distinct step receipts plus90; old five labour cannot transfer', () => {
    const h = harness(), id = h.recover(), old = stableStringify(h.s.thunderGod.bottles.slice(0, 3));
    for (let i = 0; i < 5; i++) h.apply({ type: 'POTION_WORK', bottleId: id });
    const before = h.s.cash; h.apply({ type: 'BUY_POTION', bottleId: id }); expect(before - h.s.cash).toBe(90);
    expect(h.s.thunderGod.acquisitionJournal.filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === id)).toHaveLength(5);
    expect(stableStringify(h.s.thunderGod.bottles.slice(0, 3))).toBe(old);
    expect(validateThunderGodAcquisitionJournal(h.s)).toBe(true);
    const full = harness(), fullId = full.recover(), fullBefore = full.s.cash; full.apply({ type: 'BUY_POTION', bottleId: fullId }); expect(fullBefore - full.s.cash).toBe(900);
  });
  it('supports the real +13 normal check, same dose, paid costs and leave invalidation', () => {
    const h = harness(), id = h.recover(); h.apply({ type: 'BUY_POTION', bottleId: id }); h.apply({ type: 'PREPARE_PROMOTION' });
    const before = [h.s.cash, h.s.spirituality, h.s.mind, h.s.actionsRemaining];
    h.apply({ type: 'STABILIZE_PROMOTION', bottleId: id });
    expect([h.s.cash, h.s.spirituality, h.s.mind, h.s.actionsRemaining]).toEqual([before[0]! - 60, before[1]! - 8, before[2]! - 6, before[3]]);
    expect(projectThunderGod(h.s).bottles.find(b => b.id === id)!.chance).toBe(70);
    expect(projectThunderGod(h.s).bottles[0]!.chance).toBe(44);
    expect(thunderGodAcquisitionBlock(h.s, { type: 'STABILIZE_PROMOTION', bottleId: id })).not.toBeNull();
    h.apply({ type: 'LEAVE_PREPARATION' }); expect(h.s.thunderGod.promotionStability!.preparations[0]!.status).toBe('INVALIDATED');
    expect(projectThunderGod(h.s).bottles.find(b => b.id === id)!.chance).toBe(44);
    expect(validateThunderGodAcquisitionJournal(h.s)).toBe(true);
    h.apply({ type: 'PREPARE_PROMOTION' }); h.apply({ type: 'STABILIZE_PROMOTION', bottleId: id });
    const cursor = h.s.random.cursor; h.apply({ type: 'CONSUME', bottleId: id, confirmed: true });
    const event = h.s.thunderGod.acquisitionJournal.at(-1)!;
    expect(event.check!.chance).toBe(70); expect(h.s.random.cursor).toBe(cursor + 1);
    expect(h.s.thunderGod.promotionStability!.preparations.at(-1)!.status).toBe('SPENT');
    expect(validateThunderGodAcquisitionJournal(h.s)).toBe(true); expect(resolveThunderGodOriginalsSnapshot(h.s.thunderGod)).not.toBeNull();
  });
  it('continues to read genuine old fourth-plus histories while refusing their S0 conservation snapshot', () => {
    const old = readObjectEntry<SliceState>('tests/fixtures/thunder-god-v01930/natural.json', 'final');
    expect(old.thunderGod.bottles.length).toBeGreaterThan(3);
    expect(validateThunderGodSource(old)).toBe(true); expect(validateThunderGodAcquisitionJournal(old)).toBe(true);
    expect(validateThunderGodState(old)).toBe(true); expect(resolveThunderGodOriginalsSnapshot(old.thunderGod)).toBeNull();
  });
});
