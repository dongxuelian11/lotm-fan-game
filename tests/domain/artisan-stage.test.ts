import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applySavantCommand } from '../../src/domain/savant/index.js';
import { SAVANT_ABILITY_IDS } from '../../src/domain/savant/types.js';
import { applyArchaeologistCommand } from '../../src/domain/archaeologist/index.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../../src/domain/archaeologist/types.js';
import { applyAppraiserCommand } from '../../src/domain/appraiser/index.js';
import { APPRAISER_ABILITY_IDS } from '../../src/domain/appraiser/types.js';
import { applyArtisanCommand, createArtisanState, projectArtisan, validateArtisanCommand, validateArtisanState } from '../../src/domain/artisan/index.js';
import { applyArtisanActivity, artisanActions, artisanCases, artisanInside, validateArtisanLife } from '../../src/domain/artisan/life.js';
import { settleArtisanEncounter } from '../../src/domain/artisan/encounter.js';
import { ARTISAN_FORMULA_STATUS, ARTISAN_PRICES, ARTISAN_SOURCE_STATUS } from '../../src/domain/artisan/content.js';
import { ARTISAN_ABILITY_IDS, ARTISAN_CASE_IDS, type ArtisanAcquisitionCommand, type ArtisanActivityCommand, type ArtisanCaseId } from '../../src/domain/artisan/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('artisan-domain', sliceDefaultCreationSelection, 'artisan-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.artisan = createArtisanState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[ARTISAN_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function appraiser(): SliceState {
  const s = ordinary(), c = context(s).c;
  applySavantCommand(s, { type: 'DISCOVER' }, c);
  applySavantCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySavantCommand(s, { type: 'BUY_POTION', bottleId: s.savant.bottles[0]!.id }, c);
  applySavantCommand(s, { type: 'CONSUME', bottleId: s.savant.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyArchaeologistCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyArchaeologistCommand(s, { type: 'BUY_POTION', bottleId: s.archaeologist.bottles[0]!.id }, c);
  applyArchaeologistCommand(s, { type: 'CONSUME', bottleId: s.archaeologist.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyAppraiserCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyAppraiserCommand(s, { type: 'BUY_POTION', bottleId: s.appraiser.bottles[0]!.id }, c);
  applyAppraiserCommand(s, { type: 'CONSUME', bottleId: s.appraiser.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: ArtisanAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyArtisanCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: ArtisanActivityCommand, roll = 1) { const ctx = context(s, roll); applyArtisanActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = appraiser()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.artisan.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.artisan.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyArtisanCommand(s, command as ArtisanAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyArtisanActivity(s, command as ArtisanActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: ArtisanCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: ArtisanCaseId, method: 'ABILITY' | 'ORDINARY' = caseId === 'limited-fabrication' ? 'ABILITY' : 'ORDINARY') {
  if (caseId === 'limited-fabrication' && s.artisan.workshop.copperShells === 0) activity(s, { type: 'BUY_KIT' });
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function diagram() { const s = promoted(); complete(s, 'reading-diagram'); return s; }
function lamp() { const s = diagram(); complete(s, 'limited-fabrication'); return s; }

describe('Artisan S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectArtisan(s), other = createArtisanState();
    expect(validateArtisanState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.workshop.kitsBought = 1;
    expect(s.artisan.bottles[0]!.labourSteps).toBe(0); expect(s.artisan.workshop.kitsBought).toBe(0);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = appraiser(), before = structuredClone([s.savant, s.archaeologist, s.appraiser]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.savant, s.archaeologist, s.appraiser]).toEqual(before);
    expect(projectArtisan(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(ARTISAN_FORMULA_STATUS).toContain('尚未核实'); expect(ARTISAN_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.artisan.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectArtisan(s).actions.find(a => a.id === 'buy-artisan-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validateArtisanState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.artisan.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.artisan.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.artisan.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = appraiser(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateArtisanState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectArtisan(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.artisan.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validateArtisanState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits every original Savant family ID, adds three zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.savant, s.archaeologist, s.appraiser]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.artisan.bottles[0]!.id, confirmed: true });
    expect([s.savant, s.archaeologist, s.appraiser]).toEqual(old); expect(s.artisan.appraiserActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS]);
    expect(ARTISAN_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(ARTISAN_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.artisan.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.artisan.bottles.slice(0, 3)).toEqual(originals); expect(s.artisan.bottles).toHaveLength(6);
    expect(s.artisan.bottles[3]).toMatchObject({ id: 'artisan-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateArtisanState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'artisan-batch-1' }, { type: 'CONSUME', bottleId: 'artisan-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'limited-fabrication', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validateArtisanCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.artisan.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.artisan.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.artisan.appraiserActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[SAVANT_ABILITY_IDS[0]]; }, (t: SliceState) => { t.artisan.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validateArtisanState(t)).toBe(false); }
  });
});


describe('Artisan known diagram, real fabrication and original handover', () => {
  it('hides workshop assets before promotion and never exposes an ordinary fabrication action', () => {
    expect(artisanCases(appraiser())).toEqual([]);
    expect(projectArtisan(appraiser()).workshop).toEqual({ summary: '', materials: '', lamp: null, remainingUses: 0, delivered: false });
    const s = diagram(); expect(artisanCases(s).map(c => c.id)).toEqual([...ARTISAN_CASE_IDS]); activity(s, { type: 'OBSERVE', caseId: 'limited-fabrication' });
    expect(artisanActions(s).filter(x => x.command.type === 'PREPARE' && x.command.caseId === 'limited-fabrication').map(x => x.command)).toEqual([{ type: 'PREPARE', caseId: 'limited-fabrication', method: 'ABILITY' }]);
    rejectActivity(s, { type: 'PREPARE', caseId: 'limited-fabrication', method: 'ORDINARY' });
  });
  it('requires the actual diagram report before material purchase or fabrication and the manufacturing report before handover', () => {
    const s = promoted(); rejectActivity(s, { type: 'BUY_KIT' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'limited-fabrication' });
    begin(s, 'reading-diagram'); activity(s, { type: 'PERFORM', caseId: 'reading-diagram' });
    rejectActivity(s, { type: 'REPORT', caseId: 'reading-diagram' });
    activity(s, { type: 'CLOSE', caseId: 'reading-diagram' }); rejectActivity(s, { type: 'BUY_KIT' });
    activity(s, { type: 'REPORT', caseId: 'reading-diagram' }); activity(s, { type: 'BUY_KIT' });
    begin(s, 'limited-fabrication', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'limited-fabrication' }); activity(s, { type: 'CLOSE', caseId: 'limited-fabrication' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'client-handover' }); expect(validateArtisanState(s)).toBe(true);
  });
  it('sells exactly one real 100-pence kit with zero action and no stockpiling', () => {
    const s = diagram(); s.actionsRemaining = 0; s.cash = 99; rejectActivity(s, { type: 'BUY_KIT' }); s.cash = 100;
    const ctx = activity(s, { type: 'BUY_KIT' });
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
    expect(s.artisan.workshop).toMatchObject({ kitsBought: 1, kitStock: 2, copperShells: 1, spiritualPortions: 1, lamp: null });
    expect(ctx.c.check).not.toHaveBeenCalled(); rejectActivity(s, { type: 'BUY_KIT' }); expect(validateArtisanState(s)).toBe(true);
  });
  it('cannot fabricate without both actual materials and sufficient spirituality', () => {
    const s = diagram(); begin(s, 'limited-fabrication', 'ABILITY'); rejectActivity(s, { type: 'PERFORM', caseId: 'limited-fabrication' });
    activity(s, { type: 'BUY_KIT' }); s.spirituality = 3; rejectActivity(s, { type: 'PERFORM', caseId: 'limited-fabrication' });
    expect(s.artisan.workshop).toMatchObject({ copperShells: 1, spiritualPortions: 1, lamp: null });
    activity(s, { type: 'WITHDRAW', caseId: 'limited-fabrication' }); expect(validateArtisanState(s)).toBe(true);
  });
  it.each([1, 100])('always spends the actual shell, spiritual portion and four spirituality for fabrication roll %s', roll => {
    const s = diagram(); activity(s, { type: 'BUY_KIT' }); begin(s, 'limited-fabrication', 'ABILITY'); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'limited-fabrication' }, roll);
    expect(s.spirituality).toBe(spirit - 4); expect(s.artisan.workshop).toMatchObject({ copperShells: 0, spiritualPortions: 0, craftFailures: roll === 1 ? 0 : 1 });
    expect(s.artisan.workshop.lamp).toEqual(roll === 1 ? { id: 'ART6-LAMP-1', createdWeek: s.week, charges: 3, location: 'PLAYER' } : null);
    const before = structuredClone(s.artisan.workshop), ap = s.actionsRemaining;
    activity(s, { type: 'CLOSE', caseId: 'limited-fabrication' });
    expect(s.artisan.workshop).toEqual(before); expect(s.actionsRemaining).toBe(ap); expect(validateArtisanState(s)).toBe(true);
  });
  it('preserves each failed paid attempt and only restocks the exhausted three-kit batch in a later real week', () => {
    const s = diagram(), cash = s.cash, spirit = s.spirituality;
    for (let i = 0; i < 3; i++) {
      activity(s, { type: 'BUY_KIT' }); if (i === 0) activity(s, { type: 'OBSERVE', caseId: 'limited-fabrication' });
      activity(s, { type: 'PREPARE', caseId: 'limited-fabrication', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'limited-fabrication' }, 100);
      rejectActivity(s, { type: 'BUY_KIT' }); activity(s, { type: 'CLOSE', caseId: 'limited-fabrication' });
      rejectActivity(s, { type: 'BUY_KIT' }); rejectActivity(s, { type: 'PREPARE', caseId: 'limited-fabrication', method: 'ABILITY' });
      expect(validateArtisanState(s)).toBe(true); if (i < 2) s.week += 1;
    }
    expect([s.cash, s.spirituality]).toEqual([cash - 300, spirit - 12]);
    expect(s.artisan.workshop).toMatchObject({ kitsBought: 3, kitStock: 0, restockAfterWeek: s.week, craftFailures: 3, lamp: null });
    s.week += 1; const restock = activity(s, { type: 'BUY_KIT' });
    expect(s.artisan.workshop).toMatchObject({ kitsBought: 4, kitStock: 2, restockAfterWeek: null, craftFailures: 3, copperShells: 1, spiritualPortions: 1 });
    expect(s.cash).toBe(cash - 400); expect(vi.mocked(restock.c.note).mock.calls.flat().join(' ')).toContain('实际到货');
    activity(s, { type: 'PREPARE', caseId: 'limited-fabrication', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'limited-fabrication' });
    expect(s.artisan.workshop.lamp!.id).toBe('ART6-LAMP-1'); expect(validateArtisanState(s)).toBe(true);
  });
  it.each(['ORDINARY', 'ABILITY'] as const)('actually lights the same scale using %s verification, retaining costs on repeated failed reports', method => {
    const s = lamp(); begin(s, 'client-handover', method); const mind = s.mind, spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'client-handover' }, 100);
    expect(s.artisan.workshop).toMatchObject({ tests: 1, delivered: false, lamp: { id: 'ART6-LAMP-1', charges: 2, location: 'PLAYER' } });
    expect([s.mind, s.spirituality]).toEqual([mind - 1, spirit]); rejectActivity(s, { type: 'REPORT', caseId: 'client-handover' });
    activity(s, { type: 'CLOSE', caseId: 'client-handover' });
    for (let i = 0; i < 4; i++) {
      s.week += 1; activity(s, { type: 'PREPARE', caseId: 'client-handover', method });
      activity(s, { type: 'PERFORM', caseId: 'client-handover' }, i === 3 ? 1 : 100); activity(s, { type: 'CLOSE', caseId: 'client-handover' });
      expect(s.artisan.workshop.lamp!.charges).toBe(2); expect(s.mind).toBe(mind - 1); expect(validateArtisanState(s)).toBe(true);
    }
    expect(s.artisan.workshop.lamp!.location).toBe('PLAYER'); activity(s, { type: 'REPORT', caseId: 'client-handover' });
    expect(s.artisan.workshop).toMatchObject({ delivered: true, lamp: { id: 'ART6-LAMP-1', charges: 2, location: 'CLIENT' } });
    expect(projectArtisan(s).workshop).toMatchObject({ delivered: true, remainingUses: 2 });
    expect(projectArtisan(s).workshop.lamp).toContain('不在玩家包中');
    rejectActivity(s, { type: 'BUY_KIT' }); rejectActivity(s, { type: 'REPORT', caseId: 'client-handover' }); expect(validateArtisanState(s)).toBe(true);
  });
  it('reaches peaceful 100 through three true reports and one reflection without a second lamp or battle', () => {
    const s = lamp(); complete(s, 'client-handover'); expect(s.progression.acting).toBe(75);
    activity(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ARTISAN_ABILITY_IDS[0]]).toBe(24);
    expect(s.artisan.workshop.kitsBought).toBe(1); expect(s.artisan.workshop.lamp!.charges).toBe(2);
    expect(artisanActions(s).some(x => x.command.type === 'BUY_KIT')).toBe(false); rejectActivity(s, { type: 'REFLECT' });
    expect(validateArtisanState(s)).toBe(true);
  });
  it('allows zero-action actual close after fatigue without refunds, healing, movement or a forged week advance', () => {
    const s = lamp(); begin(s, 'client-handover'); s.mind = 1; activity(s, { type: 'PERFORM', caseId: 'client-handover' });
    s.actionsRemaining = 0; s.health = 42;
    const before = structuredClone([s.artisan.workshop, s.health, s.mind, s.spirituality]);
    const forged = structuredClone(s); forged.week += 1; expect(validateArtisanLife(forged)).toBe(false);
    expect(artisanInside(s)).toBe(true); activity(s, { type: 'CLOSE', caseId: 'client-handover' });
    expect(artisanInside(s)).toBe(false); expect([s.artisan.workshop, s.health, s.mind, s.spirituality]).toEqual(before); expect(s.actionsRemaining).toBe(0);
  });
  it('rejects forged copies, free materials, charge resets, source awards and unearned delivery', () => {
    const s = lamp(); complete(s, 'client-handover');
    const changes: ((t: SliceState) => void)[] = [
      t => { t.artisan.workshop.lamp!.charges = 3; }, t => { t.artisan.workshop.lamp!.location = 'PLAYER'; },
      t => { t.artisan.workshop.kitsBought = 0; }, t => { t.artisan.workshop.copperShells = 1; },
      t => { t.artisan.workshop.tests = 0; }, t => { t.artisan.workshop.delivered = false; },
      t => { t.artisan.workshop.craftFailures = 1; }, t => { t.artisan.workshop.kitStock = 3; },
      t => { t.artisan.workshop.lamp!.createdWeek -= 1; }, t => { t.artisan.cases['limited-fabrication']!.method = 'ORDINARY'; },
      t => { t.seer.completedSources.push('artisan-case:reading-diagram'); },
      t => { Object.assign(t.artisan.workshop, { secondLamp: true }); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateArtisanState(t)).toBe(false); }
    expect(validateArtisanState(s)).toBe(true);
  });
});

describe('Artisan original courtyard encounter remains optional and physical', () => {
  it('requires one real report, an actual visit, and permits failed talk followed by a later clarification', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'reading-diagram');
    const ap = s.actionsRemaining, acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect([s.actionsRemaining, s.progression.acting]).toEqual([ap - 1, acting]); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.artisan.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
    expect(validateArtisanState(s)).toBe(true);
  });
  it('retreats through the original exit without pursuit, item transfer, rewards or injury healing', () => {
    const s = lamp(), original = structuredClone(s.artisan.workshop); activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.combat?.encounterId).toBe('ARTISAN_DISPUTE'); s.health = 43; s.mind = 62;
    const ctx = context(s); settleArtisanEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.health, s.mind, s.combat, s.artisan.encounter.status]).toEqual([43, 62, null, 'RETREATED']);
    expect(s.artisan.workshop).toEqual(original); expect(ctx.award).not.toHaveBeenCalled(); expect(validateArtisanState(s)).toBe(true);
  });
  it('awards one mastery25 only for an actual effective resolved fight and leaves acting and lamp untouched', () => {
    const s = lamp(), original = structuredClone(s.artisan.workshop), acting = s.progression.acting;
    activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '实际原地攻势', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s); settleArtisanEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('artisan-dispute', 25); expect(s.progression.acting).toBe(acting); expect(s.artisan.workshop).toEqual(original);
    expect(validateArtisanState(s)).toBe(true); expect(() => settleArtisanEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validateArtisanState(forged)).toBe(false);
  });
  it('preserves true death without revival, stolen items or an award', () => {
    const s = diagram(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD';
    const ctx = context(s); settleArtisanEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.artisan.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled();
  });
});
