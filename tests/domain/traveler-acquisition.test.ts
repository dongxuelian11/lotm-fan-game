import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../../src/domain/apprentice/types.js';
import { TRICKMASTER_ABILITY_IDS } from '../../src/domain/trickmaster/types.js';
import { ASTROLOGER_ABILITY_IDS } from '../../src/domain/astrologer/types.js';
import { RECORDER_ABILITY_IDS } from '../../src/domain/recorder/types.js';
import { applyTravelerCommand, createTravelerState, isTravelerAcquisitionCommand, projectTraveler, projectTravelerRitual, travelerRitualInside, validateTravelerCommand, validateTravelerState } from '../../src/domain/traveler/index.js';
import { TRAVELER_ABILITIES, TRAVELER_FORMULA_STATUS, TRAVELER_PRICES, TRAVELER_SOURCE_STATUS, TRAVELER_RITUAL_SITES } from '../../src/domain/traveler/content.js';
import { TRAVELER_ABILITY_IDS, TRAVELER_RITUAL_SITE_IDS, type TravelerAcquisitionCommand, type TravelerRitualSiteId } from '../../src/domain/traveler/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function recorder(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/recorder-v0830/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.traveler = createTravelerState(); s.week = Math.max(s.week, s.recorder.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: TravelerAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyTravelerCommand(s, command, c); return c;
}
function taught(s = recorder()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.traveler.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function trip(s: SliceState, site: TravelerRitualSiteId, place = true) {
  act(s, { type: 'RITUAL_DEPART', site });
  if (place) act(s, { type: 'PLACE_COORDINATE' });
  act(s, { type: 'RITUAL_RETURN' });
}
function anchors(s = taught()) { for (const site of TRAVELER_RITUAL_SITE_IDS) trip(s, site); return s; }
function prepared() { const s = anchors(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.traveler.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyTravelerCommand(s, command as TravelerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
function oldDoor(s: SliceState) { return structuredClone([s.apprentice, s.trickmaster, s.astrologer, s.recorder]); }

describe('Traveler S5 independent bottles and four real spirit-world anchor journeys', () => {
  it('creates independent initial originals and hides a future ritual and formula', () => {
    const s = createSliceRun('traveler-hidden', sliceDefaultCreationSelection, 'traveler-hidden');
    expect(validateTravelerState(s)).toBe(true);
    expect(projectTraveler(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], ritual: null, practice: null });
    expect(projectTraveler(s).story).toBeUndefined();
    const another = createTravelerState(); another.ritual.coordinates.BRONZE_STEPS.placedWeek = 1; another.practice.card = 'PLAYER'; another.bottles[0]!.labourSteps = 5;
    expect(s.traveler.ritual.coordinates.BRONZE_STEPS.placedWeek).toBeNull(); expect(s.traveler.practice.card).toBe('DESK'); expect(s.traveler.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' }); reject(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' });
  });
  it('retains Nora as S8 and introduces a separate adult S5 escort without touching old records or resources', () => {
    const s = recorder(), old = oldDoor(s);
    expect(validateTravelerState(s)).toBe(true);
    expect(projectTravelerRitual(s)).toBeNull();
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect(oldDoor(s)).toEqual(old); expect(TRAVELER_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(TRAVELER_SOURCE_STATUS).toContain('诺拉·维恩仍是序列8'); expect(TRAVELER_SOURCE_STATUS).toContain('成年序列5旅行家艾文·盖尔');
    expect(TRAVELER_FORMULA_STATUS).toContain('完整配方尚未核实'); expect(TRAVELER_FORMULA_STATUS).toContain('材料名称、用量与调配顺序保持未知');
    expect(projectTraveler(s)).toMatchObject({ formulaKnown: false, formula: [], ritual: { escortSpirituality: 24 } });
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges five actual labour actions then600 for the selected original only', () => {
    const s = taught(), b = s.traveler.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.traveler.bottles[1]!; act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateTravelerState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.traveler.bottles[2]!.id });
  });
  it('requires separate departure, personal placement and actual zero-action return for each original distant site', () => {
    const s = taught(), old = oldDoor(s), cash = s.cash, ap = s.actionsRemaining, spirit = s.spirituality;
    expect(new Set(Object.values(TRAVELER_RITUAL_SITES).map(value => value.label)).size).toBe(4);
    for (const [index, site] of TRAVELER_RITUAL_SITE_IDS.entries()) {
      const out = act(s, { type: 'RITUAL_DEPART', site });
      expect(out.check).not.toHaveBeenCalled(); expect(out.note).toHaveBeenCalledWith('实际抵达灵界深处仪式地点', expect.stringContaining('序列5旅行家艾文·盖尔'));
      expect(s.traveler.ritual).toMatchObject({ at: site, journeys: index + 1, returns: index, escortSpirituality: 21 - index * 6, feePaid: 80 * (index + 1) });
      expect(s.traveler.ritual.coordinates[site].placedWeek).toBeNull(); expect(travelerRitualInside(s)).toBe(true);
      expect(s.spirituality).toBe(spirit - index * 2); expect(validateTravelerState(s)).toBe(true);
      reject(s, { type: 'RITUAL_DEPART', site: TRAVELER_RITUAL_SITE_IDS[(index + 1) % 4] });
      reject(s, { type: 'BUY_POTION', bottleId: s.traveler.bottles[0]!.id });
      act(s, { type: 'PLACE_COORDINATE' });
      expect(s.traveler.ritual.coordinates[site].placedWeek).toBe(s.week); expect(s.traveler.ritual.at).toBe(site);
      reject(s, { type: 'PLACE_COORDINATE' }); expect(validateTravelerState(s)).toBe(true);
      const back = act(s, { type: 'RITUAL_RETURN' });
      expect(back.note).toHaveBeenCalledWith('护送人带原身体实际返程', expect.stringContaining('实际耗掉预留的3灵性'));
      expect(s.traveler.ritual).toMatchObject({ at: 'HOME', journeys: index + 1, returns: index + 1, escortSpirituality: 18 - index * 6 });
      expect(validateTravelerState(s)).toBe(true); reject(s, { type: 'RITUAL_RETURN' }); reject(s, { type: 'RITUAL_DEPART', site });
    }
    expect([cash - s.cash, ap - s.actionsRemaining, spirit - s.spirituality]).toEqual([320, 4, 8]);
    expect(oldDoor(s)).toEqual(old); expect(s.traveler.ritual.escortSpirituality).toBe(0);
  });
  it('always preserves the paid return with zero remaining AP and zero player spirituality', () => {
    const s = taught(); s.actionsRemaining = 1; s.spirituality = 2;
    act(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' });
    expect(s.actionsRemaining).toBe(0); act(s, { type: 'PLACE_COORDINATE' }); expect(s.spirituality).toBe(0);
    expect(projectTraveler(s).actions.find(a => a.command.type === 'RITUAL_RETURN')!.enabled).toBe(true);
    act(s, { type: 'RITUAL_RETURN' }); expect([s.actionsRemaining, s.spirituality, s.traveler.ritual.escortSpirituality]).toEqual([0, 0, 18]);
    expect(validateTravelerState(s)).toBe(true);
  });
  it('allows returning without placement but never refunds paid transport or invents a coordinate', () => {
    const s = taught(), cash = s.cash;
    trip(s, 'BRONZE_STEPS', false);
    expect(s.traveler.ritual).toMatchObject({ at: 'HOME', journeys: 1, returns: 1, feePaid: 80, escortSpirituality: 18 });
    expect(s.traveler.ritual.coordinates.BRONZE_STEPS.placedWeek).toBeNull(); expect(s.cash).toBe(cash - 80); expect(s.spirituality).toBe(31);
    trip(s, 'BRONZE_STEPS'); expect(s.traveler.ritual.escortSpirituality).toBe(12); expect(validateTravelerState(s)).toBe(true);
  });
  it('recovers escort resources only on a real later visit and cannot refill by projection, retries or same-week clicks', () => {
    const s = taught(); for (let n = 0; n < 4; n++) trip(s, 'BRONZE_STEPS', false);
    expect(s.traveler.ritual.escortSpirituality).toBe(0);
    reject(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' });
    s.week += 2; const before = structuredClone(s); projectTraveler(s); projectTravelerRitual(s); expect(s).toEqual(before);
    reject(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' });
    s.week += 1; act(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' });
    expect(s.traveler.ritual).toMatchObject({ escortSpirituality: 3, escortRestWeek: s.week, journeys: 5, returns: 4 });
    act(s, { type: 'PLACE_COORDINATE' }); act(s, { type: 'RITUAL_RETURN' });
    expect(s.traveler.ritual.escortSpirituality).toBe(0); expect(validateTravelerState(s)).toBe(true);
    reject(s, { type: 'RITUAL_DEPART', site: 'INVERTED_REEF' });
    s.week += 100; act(s, { type: 'RITUAL_DEPART', site: 'INVERTED_REEF' }); expect(s.traveler.ritual.escortSpirituality).toBe(21);
    act(s, { type: 'RITUAL_RETURN' }); expect(validateTravelerState(s)).toBe(true);
  });
  it('requires money, action and two placement spirituality before departure without modifying resources on rejection', () => {
    for (const alter of [(s: SliceState) => { s.cash = 79; }, (s: SliceState) => { s.spirituality = 1; }, (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; }]) {
      const s = taught(); alter(s); reject(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' });
    }
    reject(taught(), { type: 'PLACE_COORDINATE' });
  });
  it('requires all four placed coordinates and the fourth return rather than only four checkboxes', () => {
    const s = taught(), b = buy(s);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    for (const site of TRAVELER_RITUAL_SITE_IDS.slice(0, 3)) trip(s, site);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    act(s, { type: 'RITUAL_DEPART', site: 'ECHO_WELL' }); act(s, { type: 'PLACE_COORDINATE' });
    expect(Object.values(s.traveler.ritual.coordinates).every(p => p.placedWeek !== null)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    act(s, { type: 'RITUAL_RETURN' }); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('allows early preparation but requires digestion100 and twelve full Recorder weeks before drinking', () => {
    const s = recorder(); s.week = s.recorder.promotionWeek!; s.progression.acting = 0; anchors(taught(s)); const b = buy(s);
    expect(validateTravelerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectTraveler(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(5);
  });
  it('all four tiers consume the selected bottle and undergo actual uncontrolled drift, anchor-assisted return and care', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = oldDoor(s), originalAnchors = structuredClone(s.traveler.ritual.coordinates), oldMastery = { ...s.progression.mastery }, b = s.traveler.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('服药后实际经历无法控制的灵界漂流', expect.stringContaining('实际身体离开原教学室'));
      expect(c.note).toHaveBeenCalledWith('原坐标帮助实际返回并接受照护', expect.stringContaining(`结果为${tier}`));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      expect(s.traveler.ritual).toMatchObject({ at: 'HOME', drifts: 1, escortSpirituality: 0, journeys: 4, returns: 4 });
      expect(s.traveler.ritual.coordinates).toEqual(originalAnchors); expect(oldDoor(s)).toEqual(old);
      for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateTravelerState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps the same four original coordinates after failure and needs no duplicate escort trips for another bottle', () => {
    const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.traveler.bottles[0]!.id, confirmed: true }, 85);
    const ritual = structuredClone(s.traveler.ritual); const b = buy(s, 1); s.actionsRemaining = 0;
    act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.traveler.ritual).toEqual({ ...ritual, drifts: 2 }); expect(s.actionsRemaining).toBe(0); expect(validateTravelerState(s)).toBe(true);
  });
  it('requires health above20 and mind above40 before any bottle or uncontrolled journey is consumed', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.traveler.bottles[0]!.id, confirmed: true });
      expect(s.traveler.ritual.drifts).toBe(0); expect(projectTraveler(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every old ID and empty new masteries without a spirituality refill, record gift or higher-space ability', () => {
    const s = prepared(), old = oldDoor(s), stats = { ...s.character.coreStats }, spirit = s.spirituality;
    act(s, { type: 'CONSUME', bottleId: s.traveler.bottles[0]!.id, confirmed: true });
    expect(oldDoor(s)).toEqual(old); expect(s.traveler.recorderActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS, ...RECORDER_ABILITY_IDS, ...TRAVELER_ABILITY_IDS]);
    for (const id of TRAVELER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([spirit, 0]); expect(TRAVELER_ABILITIES).toHaveLength(2);
    expect(TRAVELER_ABILITIES[1]!.label).toBe('无形之手'); expect(TRAVELER_SOURCE_STATUS).toContain('空间隐藏、空间口袋与放逐');
    expect(projectTraveler(s).digestion).toContain('旅行家扮演0/100');
  });
  it('resupplies only after three failed originals and an actual later week while retaining the same anchors', () => {
    const s = anchors(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.traveler.bottles), ritual = structuredClone(s.traveler.ritual), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.traveler.bottles.slice(0, 3)).toEqual(originals); expect(s.traveler.bottles).toHaveLength(6); expect(s.traveler.ritual).toEqual(ritual);
    expect(s.traveler.bottles[3]).toMatchObject({ id: 'traveler-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(validateTravelerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for buying and independently confirming the selected second original once the ritual is complete', () => {
    const s = anchors(); s.actionsRemaining = 0; const first = structuredClone(s.traveler.bottles[0]), b = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.traveler.bottles[0]).toEqual(first); expect(validateTravelerState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.traveler.bottles[2]!.id });
  });
  it('validates exact ritual command shapes and routes only ritual/acquisition commands to acquisition', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'RESTORE_ESCORT' }, { type: 'RITUAL_DEPART', site: 'BACKLUND' }, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS', companion: 'NORA' }, { type: 'PLACE_COORDINATE', site: 'BRONZE_STEPS' }, { type: 'RITUAL_RETURN', free: true }, { type: 'CONSUME', bottleId: 'traveler-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'recorder-potion-1' }, { type: 'PREPARE', caseId: 'known-landing', method: 'ASTROLOGY' }, { type: 'RECORD_SAMPLE', sample: 'TRAVEL' }];
    for (const command of malformed) { expect(validateTravelerCommand(command)).toBe(false); expect(isTravelerAcquisitionCommand(command)).toBe(false); reject(taught(), command); }
    for (const command of [{ type: 'RITUAL_DEPART', site: 'ECHO_WELL' }, { type: 'PLACE_COORDINATE' }, { type: 'RITUAL_RETURN' }]) { expect(validateTravelerCommand(command)).toBe(true); expect(isTravelerAcquisitionCommand(command)).toBe(true); }
    for (const command of [{ type: 'CLOSE', caseId: 'offered-card' }, { type: 'PREPARE', caseId: 'willing-companion', method: 'ABILITY' }, { type: 'RECORD_SAMPLE', sample: 'FLASH' }]) { expect(validateTravelerCommand(command)).toBe(true); expect(isTravelerAcquisitionCommand(command)).toBe(false); reject(promoted(), command); }
  });
  it('rejects forged ritual location, capacity, counters, chronologies and malformed nested saves without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.traveler.bottles[0]!.source = 'invented'; },
      t => { t.traveler.bottles[0]!.consumedWeek = t.traveler.promotionWeek! - 1; },
      t => { t.traveler.recorderActingAtPromotion = 99; },
      t => { delete t.progression.mastery[APPRENTICE_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['door.s5.space-pocket'] = 0; },
      t => { t.traveler.ritual.at = 'BRONZE_STEPS'; },
      t => { t.traveler.ritual.escortSpirituality = 25; },
      t => { t.traveler.ritual.escortSpirituality = 1; },
      t => { t.traveler.ritual.returns = 3; },
      t => { t.traveler.ritual.feePaid = 0; },
      t => { t.traveler.ritual.drifts = 0; },
      t => { t.traveler.ritual.escortRestWeek = t.week + 1; },
      t => { t.traveler.ritual.coordinates.BRONZE_STEPS.placedWeek = null; },
      t => { t.traveler.ritual.coordinates.BRONZE_STEPS.placedWeek = t.week + 1; },
      t => { (t.traveler as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.traveler.ritual as unknown as Record<string, unknown>).coordinates = null; },
      t => { (t.traveler.ritual.coordinates as unknown as Record<string, unknown>).BRONZE_STEPS = null; },
      t => { (t.traveler as unknown as Record<string, unknown>).practice = null; },
      t => { (t.traveler.cases as unknown as Record<string, unknown>)['known-landing'] = null; },
      t => { (t.traveler as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateTravelerState(t)).not.toThrow(); expect(validateTravelerState(t)).toBe(false); }
  });
  it('projects independent public anchor rows and bounded capabilities without mutating stored state', () => {
    const s = promoted(), before = structuredClone(s), p = projectTraveler(s);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [], practice: null });
    expect(p.ritual!.coordinates).toHaveLength(4); expect(p.ritual!.escortSpirituality).toBe(0);
    expect(p.abilities.map(a => a.id)).toEqual([...TRAVELER_ABILITY_IDS]); expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.ritual!.coordinates[0]!.status = 'invented'; p.ritual!.history.push('invented'); p.abilities[0]!.mastery = 99;
    expect(s).toEqual(before);
  });
});
