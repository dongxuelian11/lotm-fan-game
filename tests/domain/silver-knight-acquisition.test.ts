import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySilverKnightCommand, createSilverKnightState, projectSilverKnight, validateSilverKnightCommand, validateSilverKnightState } from '../../src/domain/silver-knight/index.js';
import { SILVER_KNIGHT_ABILITY_IDS, SILVER_KNIGHT_PREPARATION_IDS, type SilverKnightCommand } from '../../src/domain/silver-knight/types.js';
import { SILVER_KNIGHT_ALTAR_SLOTS, validateSilverKnightRitual } from '../../src/domain/silver-knight/ritual.js';
import { SILVER_KNIGHT_CONSUMPTION_RISK, SILVER_KNIGHT_FORMULA_STATUS, SILVER_KNIGHT_PRICES } from '../../src/domain/silver-knight/content.js';

const roots = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter'] as const;
const original = () => JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json', 'utf8'));
/** Targeted unit setup. Never a natural replay or a claim that the six hunts succeeded. */
function base() {
  const s = migrateSliceState(original().final); s.silverKnight = createSilverKnightState();
  s.week = Math.max(s.week, s.demonHunter.promotionWeek! + 12); s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext { return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) }; }
function act(s: SliceState, c: SilverKnightCommand, roll = 1) { const ctx = context(s, roll); applySilverKnightCommand(s, c, ctx); return ctx; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applySilverKnightCommand(s, c as SilverKnightCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
function taught() { const s = base(); act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function ready() {
  const s = taught(); for (const taskId of SILVER_KNIGHT_PREPARATION_IDS) act(s, { type: 'PREPARE_TASK', taskId }); act(s, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-1' });
  // Only isolate acquisition/ritual consumption here. Full witnessed hunt provenance is tested by the shared public captures.
  s.silverKnight.encounter.remains = SILVER_KNIGHT_ALTAR_SLOTS.map((slot, n) => ({ id: `UNIT-REMAINS-${n}`, instanceId: `UNIT-HUNT-${n}`, speciesId: slot.speciesId, killedBy: 'PLAYER', outcome: 'ENEMY_DEAD', killedWeek: s.week, collectedWeek: s.week, locationId: 'PLAYER', originLocationId: `UNIT-QUARRY-${n}`, status: 'OWNER_PLAYER', slotId: null, consumedWeek: null }));
  for (const type of ['RITUAL_REQUEST_MEETING', 'RITUAL_GO_MEETING', 'RITUAL_SHOW_RECORDS', 'RITUAL_SEEK_BLESSING', 'RITUAL_RETURN_DOOR', 'RITUAL_GO_ALTAR'] as const) act(s, { type });
  for (const [n, slot] of SILVER_KNIGHT_ALTAR_SLOTS.entries()) act(s, { type: 'RITUAL_PLACE_REMAINS', remainsId: `UNIT-REMAINS-${n}`, slotId: slot.id });
  act(s, { type: 'PREPARE_PROMOTION' }); return s;
}
const dose = { type: 'CONSUME', bottleId: 'silver-knight-potion-1', confirmed: true } as const;

describe('Silver Knight original acquisition and independent actual ritual cost', () => {
  it('reads unchanged340-command natural warrior baseline and keeps old surrendered guard and its final coating', () => {
    const capture = original(), state = migrateSliceState(capture.final);
    expect(capture.seed).toBe('warrior-natural-v042'); expect(capture.commands).toHaveLength(340);
    expect(state).toMatchObject({ week: 93, status: 'ACTIVE', health: 100, mind: 100, spirituality: 112, cash: 490, actionsRemaining: 1, progression: { sequence: 4, acting: 100 } });
    expect(state.demonHunter.encounter).toMatchObject({ enemyHealth: 70, enemySpirituality: 14, enemyStatus: 'SURRENDERED' });
    expect(state.demonHunter.encounter.coatings.filter(c => c.status === 'SEALED')).toHaveLength(1);
    expect(state.silverKnight).toEqual(createSilverKnightState()); expect(validateSilverKnightState(state)).toBe(true);
    for (const root of roots) expect(state[root]).toEqual(capture.final[root]); expect(state.random).toEqual(capture.final.random);
  });
  it('keeps full recipe unknown and actual six-remain rite separate from potion ingredients', () => {
    const s = taught(), view = projectSilverKnight(s);
    expect(SILVER_KNIGHT_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    expect(view).toMatchObject({ formulaKnown: false, formula: [], guidanceKnown: true });
    expect(SILVER_KNIGHT_FORMULA_STATUS).toContain('不将六种遗骸当六味药材'); expect(SILVER_KNIGHT_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges five real bottle-specific jobs and900 for only that original', () => {
    const s = taught(); for (let i = 0; i < 5; i++) act(s, { type: 'POTION_WORK', bottleId: 'silver-knight-potion-2' });
    reject(s, { type: 'POTION_WORK', bottleId: 'silver-knight-potion-2' }); act(s, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-2' });
    expect([s.cash, s.actionsRemaining]).toEqual([98600, 94]); expect(s.silverKnight.bottles[0]!.labourSteps).toBe(0);
    expect(s.silverKnight.bottles[1]).toMatchObject({ status: 'PLAYER', acquiredWeek: s.week, labourSteps: 5 });
    expect(s.silverKnight.ritual.anchor).toBeNull(); expect(s.silverKnight.encounter.remains).toEqual([]); expect(validateSilverKnightState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-2' });
  });
  it('does not partially discount or transfer unfinished labour', () => { const s = taught(); for (let i = 0; i < 4; i++) act(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); const cash = s.cash; act(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(cash - s.cash).toBe(6400); s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: 'silver-knight-potion-2' }); });
  it('writes exactly one actual original anchor linking Oswin and Vera to original events', () => {
    const s = taught(), old = roots.map(r => structuredClone(s[r])); for (const taskId of SILVER_KNIGHT_PREPARATION_IDS) act(s, { type: 'PREPARE_TASK', taskId });
    expect(s.silverKnight.ritual.anchor).toMatchObject({ id: 'SK3-ANCHOR-JOURNAL', owner: 'PLAYER', location: 'PLAYER', quantity: 1, writtenWeek: s.week });
    expect(s.silverKnight.ritual.anchor!.entries).toContainEqual({ root: 'guardian', caseId: 'nearby-companion', personId: '维拉·埃德里奇（Vera Edridge）', eventWeek: s.guardian.cases['nearby-companion']!.attemptWeek, outcome: s.guardian.cases['nearby-companion']!.outcome });
    for (const [n, root] of roots.entries()) expect(s[root]).toEqual(old[n]); reject(s, { type: 'PREPARE_TASK', taskId: 'RECORD_ANCHOR' }); expect(validateSilverKnightState(s)).toBe(true);
  });
  it('cannot buy a ritual or replace old surrendered guard with fake remains', () => {
    const s = taught(); act(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); for (const taskId of SILVER_KNIGHT_PREPARATION_IDS) act(s, { type: 'PREPARE_TASK', taskId });
    reject(s, { type: 'PREPARE_PROMOTION' }); reject(s, dose); reject(s, { type: 'RITUAL_REQUEST_MEETING' });
    expect(s.silverKnight.encounter.remains).toEqual([]); expect(s.demonHunter.encounter.enemyStatus).toBe('SURRENDERED');
  });
  it('rejects absent/false confirmation and unapproved fields before draws or mutation', () => {
    const s = ready(); for (const c of [{ type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, confirmed: false }, { ...dose, skipRitual: true }]) { expect(validateSilverKnightCommand(c)).toBe(false); reject(s, c); }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact dose tier%s and consumes the same six originals without healing or changing old roots', (roll, tier, mind, health, pollution, sequence) => {
    const s = ready(), old = roots.map(r => structuredClone(s[r])), oldStats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, gender = s.character.gender;
    const ap = s.actionsRemaining, cash = s.cash, travel = s.silverKnight.ritual.travelMetres; act(s, dose, roll);
    expect([s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining, s.cash]).toEqual([mind, health, pollution, sequence, 31, ap, cash]);
    expect(s.silverKnight.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: s.week, preparationWeek: s.week });
    expect(s.silverKnight.encounter.remains.every(r => r.status === 'CONSUMED' && r.consumedWeek === s.week)).toBe(true);
    expect(s.silverKnight.ritual).toMatchObject({ playerLocation: 'DOOR', travelMetres: travel + 4, activeAttemptId: null }); expect(s.silverKnight.ritual.attempts[0]).toMatchObject({ status: 'CONSUMED', bottleId: dose.bottleId, outcome: tier });
    expect(s.silverKnight.ritual.meetings[0]!.blessing).toMatchObject({ sourceId: 'SK3-AURIEL', status: 'CONSUMED', consumedWeek: s.week });
    expect(validateSilverKnightRitual(s)).toBe(true); expect(s.character.gender).toBe(gender); for (const [n, root] of roots.entries()) expect(s[root]).toEqual(old[n]);
    for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(oldStats[stat] + (sequence === 3 ? 1 : 0));
    if (sequence === 3) { expect(s.silverKnight.demonHunterActingAtPromotion).toBe(100); for (const id of SILVER_KNIGHT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); } else expect(s.progression.acting).toBe(100);
    reject(s, dose);
  });
  it('cancel keeps originals on actual altar and destroys no new bodies or unused bottle', () => {
    const s = ready(), cash = s.cash, ap = s.actionsRemaining; act(s, { type: 'LEAVE_PREPARATION' });
    expect([s.cash, s.actionsRemaining, s.silverKnight.preparedWeek]).toEqual([cash, ap, null]); expect(s.silverKnight.bottles[0]!.status).toBe('PLAYER');
    expect(s.silverKnight.encounter.remains.every(r => r.status === 'ALTAR')).toBe(true); expect(s.silverKnight.ritual.attempts[0]!.status).toBe('CANCELLED');
    expect(s.silverKnight.ritual.meetings[0]!.blessing!.status).toBe('CANCELLED'); expect(validateSilverKnightRitual(s)).toBe(true); reject(s, dose);
  });
  it('cannot prepare too early, with undigested potion, after death or with poor health/mind', () => {
    for (const change of [(s: SliceState) => { s.week = s.demonHunter.promotionWeek! + 11; }, (s: SliceState) => { s.progression.acting = 99; }, (s: SliceState) => { s.health = 20; }, (s: SliceState) => { s.mind = 40; }, (s: SliceState) => { s.status = 'DEAD'; }]) { const s = ready(); change(s); reject(s, dose); }
  });
  it('validates independent state and rejects forged root chronology, extra materials or promotion', () => {
    const s = taught(); expect(validateSilverKnightState(s)).toBe(true);
    for (const change of [(v: SliceState) => { v.silverKnight.bottles[0]!.id = 'warrior-potion-1'; }, (v: SliceState) => { v.silverKnight.bottles[0]!.labourSteps = 6; }, (v: SliceState) => { v.silverKnight.promotionWeek = v.week; }, (v: SliceState) => { (v.silverKnight as unknown as Record<string, unknown>).materials = ['six']; }]) { const altered = structuredClone(s); change(altered); expect(validateSilverKnightState(altered)).toBe(false); }
    const other = createSilverKnightState(); other.ritual.slots[0]!.remainsId = 'fake'; expect(s.silverKnight.ritual.slots[0]!.remainsId).toBeNull();
  });
});
