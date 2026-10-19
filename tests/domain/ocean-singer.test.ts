import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SAILOR_ABILITY_IDS } from '../../src/domain/sailor/types.js';
import { RAGER_ABILITY_IDS } from '../../src/domain/rager/types.js';
import { NAVIGATOR_ABILITY_IDS } from '../../src/domain/navigator/types.js';
import { WIND_BLESSED_ABILITY_IDS } from '../../src/domain/wind-blessed/types.js';
import { applyOceanSingerCommand, createOceanSingerState, isOceanSingerAcquisitionCommand, projectOceanSinger, projectOceanSingerRitual, validateOceanSingerCommand, validateOceanSingerState, validateOceanSingerRitual } from '../../src/domain/ocean-singer/index.js';
import { OCEAN_SINGER_ABILITIES, OCEAN_SINGER_FORMULA_STATUS, OCEAN_SINGER_PRICES, OCEAN_SINGER_RITUAL_SOURCE } from '../../src/domain/ocean-singer/content.js';
import { OCEAN_SINGER_ABILITY_IDS, type OceanSingerAcquisitionCommand } from '../../src/domain/ocean-singer/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function windBlessed(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/wind-blessed-v0800/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.oceanSinger = createOceanSingerState(); s.week = s.windBlessed.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: OceanSingerAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyOceanSingerCommand(s, command, c); return c;
}
function taught(s = windBlessed()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.oceanSinger.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function coast(s: SliceState) {
  act(s, { type: 'REQUEST_RITUAL' }); s.week++; act(s, { type: 'GO_RITUAL' }); return s;
}
function belly(s: SliceState) { coast(s); act(s, { type: 'ENTER_RITUAL' }); return s; }
function prepared() { const s = taught(); buy(s); return belly(s); }
function returnDock(s: SliceState) { act(s, { type: 'EXIT_RITUAL' }); act(s, { type: 'RETURN_DOCK' }); }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.oceanSinger.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyOceanSingerCommand(s, command as OceanSingerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('OceanSinger S5 original finished bottles and actual living-beast rite', () => {
  it('hides the future channel and creates separate exact initial ritual and practice states', () => {
    const s = createSliceRun('ocean-singer-hidden', sliceDefaultCreationSelection, 'ocean-singer-hidden');
    expect(validateOceanSingerState(s)).toBe(true);
    expect(projectOceanSinger(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectOceanSinger(s).story).toBeUndefined();
    expect(s.oceanSinger.ritual).toEqual({ requestedWeek: null, visitWeek: null, location: 'DOCK', crewPresent: false, beastPresent: false, waterFilm: false, visits: 0, consumptions: 0, history: [] });
    expect(s.oceanSinger.practice).toEqual({ allyPosition: 'NEAR', songOpen: false, allyAffected: false, songChecks: 0, lightningMarks: 0, tideObservedWeek: null, tideVerified: false });
    const other = createOceanSingerState(); other.bottles[0]!.labourSteps = 5; other.ritual.location = 'BELLY'; other.practice.songChecks = 1;
    expect(s.oceanSinger.bottles[0]!.labourSteps).toBe(0); expect(s.oceanSinger.ritual.location).toBe('DOCK'); expect(s.oceanSinger.practice.songChecks).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the original mentor, independent stock, 460 guidance and five actual labour steps per bottle', () => {
    const s = windBlessed(), originals = structuredClone([s.sailor, s.rager, s.navigator, s.windBlessed]);
    expect(validateOceanSingerState(s)).toBe(true); taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]);
    expect(OCEAN_SINGER_PRICES).toMatchObject({ guidance: 460, potion: 4800, labourCredit: 4200, ritualTravel: 180, waterFilm: 120 });
    expect(OCEAN_SINGER_FORMULA_STATUS).toContain('完整配方尚未核实');
    const bottle = s.oceanSinger.bottles[0]!;
    for (let i = 0; i < 5; i++) act(s, { type: 'POTION_WORK', bottleId: bottle.id });
    reject(s, { type: 'POTION_WORK', bottleId: bottle.id }); buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([28940, 94, 'PLAYER']);
    act(s, { type: 'POTION_WORK', bottleId: s.oceanSinger.bottles[1]!.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect([s.sailor, s.rager, s.navigator, s.windBlessed]).toEqual(originals);
    expect(validateOceanSingerState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: bottle.id });
  });
  it('requires a prior-week request, a real paid boat trip, and separately paid belly entry', () => {
    const s = taught(); const bottle = buy(s); const cash = s.cash, ap = s.actionsRemaining;
    reject(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }); reject(s, { type: 'GO_RITUAL' }); reject(s, { type: 'ENTER_RITUAL' });
    act(s, { type: 'REQUEST_RITUAL' }); const requestedWeek = s.week;
    expect(s.oceanSinger.ritual).toMatchObject({ requestedWeek, location: 'DOCK', visits: 0 });
    reject(s, { type: 'GO_RITUAL' }); reject(s, { type: 'REQUEST_RITUAL' });
    s.week++; act(s, { type: 'GO_RITUAL' });
    expect([s.cash, s.actionsRemaining, s.world.city]).toEqual([cash - 180, ap - 2, 'BACKLUND']);
    expect(s.oceanSinger.ritual).toMatchObject({ requestedWeek: null, visitWeek: s.week, location: 'COAST', crewPresent: true, beastPresent: true, waterFilm: false, visits: 1 });
    expect(s.oceanSinger.ritual.history[0]).toEqual({ number: 1, requestedWeek, visitWeek: s.week, entered: false, returned: false, consumedBottleId: null });
    reject(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(validateOceanSingerState(s)).toBe(true); act(s, { type: 'ENTER_RITUAL' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 300, ap - 2]);
    expect(s.oceanSinger.ritual).toMatchObject({ location: 'BELLY', waterFilm: true });
    expect(s.oceanSinger.ritual.history[0]!.entered).toBe(true);
    expect(validateOceanSingerState(s)).toBe(true); reject(s, { type: 'RETURN_DOCK' });
    expect(projectOceanSingerRitual(s).source).toContain('OS5-BEAST-1'); expect(OCEAN_SINGER_RITUAL_SOURCE).toContain('原创G');
  });
  it('keeps free actual extraction and prepaid return available with zero AP and cash, without drinking', () => {
    const s = prepared(), bottle = structuredClone(s.oceanSinger.bottles[0]);
    s.actionsRemaining = 0; s.cash = 0; s.health = 1; s.mind = 1;
    expect(projectOceanSinger(s).actions.find(a => a.command.type === 'EXIT_RITUAL')?.enabled).toBe(true);
    act(s, { type: 'EXIT_RITUAL' });
    expect(s.oceanSinger.ritual).toMatchObject({ location: 'COAST', waterFilm: false, crewPresent: true, beastPresent: true });
    expect(projectOceanSinger(s).actions.find(a => a.command.type === 'RETURN_DOCK')?.enabled).toBe(true);
    act(s, { type: 'RETURN_DOCK' });
    expect(s.oceanSinger.ritual).toMatchObject({ location: 'DOCK', waterFilm: false, crewPresent: false, beastPresent: false, visitWeek: null, visits: 1, consumptions: 0 });
    expect(s.oceanSinger.ritual.history[0]!.returned).toBe(true);
    expect([s.actionsRemaining, s.cash, s.health, s.mind, s.spirituality]).toEqual([0, 0, 1, 1, 31]);
    expect(s.oceanSinger.bottles[0]).toEqual(bottle); expect(validateOceanSingerState(s)).toBe(true);
    reject(s, { type: 'EXIT_RITUAL' }); reject(s, { type: 'RETURN_DOCK' });
  });
  it('requires twelve full weeks, digestion100, health>20 and mind>40 before consuming', () => {
    const s = windBlessed(); s.week = s.windBlessed.promotionWeek! + 10; taught(s); const bottle = buy(s); belly(s);
    expect(projectOceanSinger(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }); returnDock(s); belly(s);
    s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }); s.progression.acting = 100;
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      s.health = health!; s.mind = mind!; reject(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
    s.health = 100; s.mind = 100; act(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(s.progression.sequence).toBe(5); expect(validateOceanSingerState(s)).toBe(true);
  });
  it('consumes the selected original inside the living beast and records all four recoverable tiers', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), bottle = s.oceanSinger.bottles[0]!, old = { ...s.progression.mastery };
      s.actionsRemaining = 0; const c = act(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect([bottle.status, bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      expect(bottle.ritualVisit).toBe(1); expect(s.oceanSinger.ritual.history[0]!.consumedBottleId).toBe(bottle.id);
      expect(s.oceanSinger.ritual).toMatchObject({ location: 'BELLY', waterFilm: true, visits: 1, consumptions: 1 });
      for (const [id, mastery] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(mastery);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateOceanSingerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      expect(projectOceanSinger(s).actions.find(a => a.command.type === 'EXIT_RITUAL')?.enabled).toBe(true);
      returnDock(s); expect(validateOceanSingerState(s)).toBe(true);
      expect([s.spirituality, s.mind, s.health]).toEqual([31, mind, health]);
    }
  });
  it('preserves all original knowledge and physical history, adds only three zero masteries and four +1 stats', () => {
    const s = prepared(), old = structuredClone([s.sailor, s.rager, s.navigator, s.windBlessed]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.oceanSinger.bottles[0]!.id, confirmed: true });
    expect([s.sailor, s.rager, s.navigator, s.windBlessed]).toEqual(old); expect(s.oceanSinger.windBlessedActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS, ...NAVIGATOR_ABILITY_IDS, ...WIND_BLESSED_ABILITY_IDS, ...OCEAN_SINGER_ABILITY_IDS]);
    for (const id of OCEAN_SINGER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(OCEAN_SINGER_ABILITIES).toHaveLength(3);
    expect(projectOceanSinger(s).digestion).toContain('海洋歌者扮演0/100');
  });
  it('allows only one original per visit and requires another actual later-week journey after failure', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1); belly(s);
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true }, 85);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    act(s, { type: 'EXIT_RITUAL' }); reject(s, { type: 'ENTER_RITUAL' }); act(s, { type: 'RETURN_DOCK' });
    act(s, { type: 'REQUEST_RITUAL' }); reject(s, { type: 'GO_RITUAL' });
    s.week++; act(s, { type: 'GO_RITUAL' }); act(s, { type: 'ENTER_RITUAL' });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(second.ritualVisit).toBe(2); expect(s.oceanSinger.ritual.consumptions).toBe(2);
    expect(s.oceanSinger.ritual.history.map(h => h.consumedBottleId)).toEqual([first.id, second.id]);
    expect(validateOceanSingerState(s)).toBe(true);
  });
  it('retains three failed originals and waits a real week for a newly sourced paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i++) {
      s.health = 100; s.mind = 100; const bottle = buy(s, i); belly(s);
      act(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 85); returnDock(s);
    }
    const originals = structuredClone(s.oceanSinger.bottles), visits = structuredClone(s.oceanSinger.ritual.history);
    act(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.oceanSinger.bottles.slice(0, 3)).toEqual(originals); expect(s.oceanSinger.ritual.history).toEqual(visits);
    expect(s.oceanSinger.bottles).toHaveLength(6);
    expect(s.oceanSinger.bottles[3]).toMatchObject({ id: 'ocean-singer-potion-4', status: 'SUPPLIER', acquiredWeek: null, consumedWeek: null, ritualVisit: null, labourSteps: 0 });
    expect(projectOceanSinger(s).actions.find(a => a.id === 'buy-ocean-singer-potion-4')!.cost).toContain('4800便士');
    expect(validateOceanSingerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects missing crew, beast or water film and ordinary preparation while actually away', () => {
    for (const field of ['crewPresent', 'beastPresent', 'waterFilm'] as const) {
      const s = prepared(); s.oceanSinger.ritual[field] = false;
      reject(s, { type: 'CONSUME', bottleId: s.oceanSinger.bottles[0]!.id, confirmed: true });
      expect(validateOceanSingerRitual(s)).toBe(false);
    }
    const s = prepared();
    for (const command of [{ type: 'REQUEST_RITUAL' }, { type: 'POTION_WORK', bottleId: s.oceanSinger.bottles[1]!.id }, { type: 'BUY_POTION', bottleId: s.oceanSinger.bottles[1]!.id }]) reject(s, command);
  });
  it('enforces exact public command payloads and separates activity from acquisition', () => {
    for (const type of ['REQUEST_RITUAL', 'GO_RITUAL', 'ENTER_RITUAL', 'EXIT_RITUAL', 'RETURN_DOCK'] as const) {
      expect(validateOceanSingerCommand({ type })).toBe(true); expect(isOceanSingerAcquisitionCommand({ type })).toBe(true);
      expect(validateOceanSingerCommand({ type, teleport: true })).toBe(false);
    }
    for (const type of ['MOVE_ALLY', 'RETURN_ALLY', 'CLEAR_ALLY'] as const) {
      expect(validateOceanSingerCommand({ type })).toBe(true); expect(isOceanSingerAcquisitionCommand({ type })).toBe(false);
      expect(validateOceanSingerCommand({ type, caseId: 'warned-rehearsal' })).toBe(false); reject(promoted(), { type });
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'ocean-singer-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'wind-blessed-potion-1' }, { type: 'CONSUME', bottleId: 'ocean-singer-potion-01', confirmed: true }, { type: 'PREPARE', caseId: 'warned-rehearsal', method: 'CONTROL' }]) expect(validateOceanSingerCommand(command)).toBe(false);
  });
  it('rejects forged sources, ritual flags, bottle mappings and chronology without throwing', () => {
    const s = promoted();
    const mutations: ((t: SliceState) => void)[] = [
      t => { t.oceanSinger.bottles[0]!.source = 'invented'; },
      t => { t.oceanSinger.bottles[0]!.ritualVisit = 2; },
      t => { t.oceanSinger.bottles[0]!.consumedWeek = t.week - 1; },
      t => { t.oceanSinger.windBlessedActingAtPromotion = 99; },
      t => { delete t.progression.mastery[SAILOR_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['tyrant.s5.monster-control'] = 0; },
      t => { t.oceanSinger.ritual.history[0]!.entered = false; },
      t => { t.oceanSinger.ritual.history[0]!.requestedWeek = t.week; },
      t => { t.oceanSinger.ritual.history[0]!.consumedBottleId = t.oceanSinger.bottles[1]!.id; },
      t => { t.oceanSinger.ritual.history[0]!.returned = true; },
      t => { t.oceanSinger.ritual.consumptions = 0; },
      t => { t.oceanSinger.ritual.waterFilm = false; },
      t => { t.oceanSinger.ritual.location = 'DOCK'; },
      t => { t.week++; },
      t => { (t.oceanSinger as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.oceanSinger as unknown as Record<string, unknown>).practice = null; },
      t => { (t.oceanSinger.ritual as unknown as Record<string, unknown>).history = [null]; },
      t => { (t.oceanSinger.cases as unknown as Record<string, unknown>)['warned-rehearsal'] = null; },
      t => { (t.oceanSinger as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const mutate of mutations) {
      const t = structuredClone(s); mutate(t);
      expect(() => validateOceanSingerState(t)).not.toThrow(); expect(validateOceanSingerState(t)).toBe(false);
    }
  });
  it('returns detached projections with actual ritual status and leaves practice projection to life', () => {
    const s = promoted(), before = structuredClone(s), p = projectOceanSinger(s);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: true, cases: [], practice: null, ritual: { location: 'BELLY', waterFilm: true, visits: 1, consumptions: 1 } });
    expect(p.ritual.summary).toContain('ocean-singer-potion-1');
    p.ritual.location = 'DOCK'; p.abilities[0]!.mastery = 99;
    expect(s).toEqual(before);
  });
});
