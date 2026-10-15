import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyTravelerCommand, createTravelerState, validateTravelerState } from '../../src/domain/traveler/index.js';
import { applyTravelerActivity, isTravelerActivity, travelerActions, travelerCases, travelerInside, travelerPractice, TRAVELER_ENVIRONMENT, validateTravelerLife } from '../../src/domain/traveler/life.js';
import { TRAVELER_ABILITY_IDS, TRAVELER_CASE_IDS, TRAVELER_RITUAL_SITE_IDS, type TravelerActivityCommand, type TravelerCaseId } from '../../src/domain/traveler/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[TRAVELER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function recorder(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/recorder-v0830/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.traveler = createTravelerState();
  const week = Math.max(s.week, s.recorder.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(): SliceState {
  const s = recorder(), c = context(s).ctx;
  applyTravelerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  for (const site of TRAVELER_RITUAL_SITE_IDS) {
    applyTravelerCommand(s, { type: 'RITUAL_DEPART', site }, c);
    applyTravelerCommand(s, { type: 'PLACE_COORDINATE' }, c);
    applyTravelerCommand(s, { type: 'RITUAL_RETURN' }, c);
  }
  applyTravelerCommand(s, { type: 'BUY_POTION', bottleId: s.traveler.bottles[0]!.id }, c);
  applyTravelerCommand(s, { type: 'CONSUME', bottleId: s.traveler.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: TravelerActivityCommand, roll = 1) { const c = context(s, roll); applyTravelerActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyTravelerActivity(s, command as TravelerActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: TravelerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.traveler.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: TravelerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.apprentice, s.trickmaster, s.astrologer, s.recorder]);


describe('Traveler original bodies, same wooden card and limited willing companion', () => {
  it('starts with distinct untouched cases and no body, card or companion moved by promotion', () => {
    const before = recorder(), old = originals(before);
    expect(travelerActions(before)).toEqual([]); expect(travelerCases(before)).toEqual([]); expect(travelerPractice(before)).toBeNull();
    expect(validateTravelerLife(before)).toBe(true);
    const s = promoted();
    expect(s.traveler.practice).toEqual({ position: 'ENTRY', card: 'DESK', companionPosition: 'ENTRY', consent: false, journeys: 0, returns: 0, cardTakes: 0, cardReturns: 0, companionTrips: 0 });
    expect(travelerCases(s).map(p => p.id)).toEqual([...TRAVELER_CASE_IDS]); expect(new Set(travelerCases(s).map(p => p.story)).size).toBe(3);
    expect(travelerCases(s).every(p => p.observations.length === 0)).toBe(true); expect(travelerInside(s)).toBe(false);
    expect(originals(s)).toEqual(old); expect(validateTravelerState(s)).toBe(true);
    expect(TRAVELER_ENVIRONMENT).toContain('序列8'); expect(TRAVELER_ENVIRONMENT).toContain('无形之手');
  });

  it('uses one paid ordinary observation round trip to verify the actual six-metre landing before preparation', () => {
    const s = promoted(), ap = s.actionsRemaining, spirit = s.spirituality, old = originals(s);
    const observed = act(s, { type: 'OBSERVE', caseId: 'known-landing' });
    expect(messages(observed)).toContain('已经实际步行六米到平台核对'); expect(messages(observed)).toContain('步行六米返回入口');
    expect(observed.ctx.check).not.toHaveBeenCalled(); expect(observed.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit]);
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', journeys: 0, returns: 0 });
    act(s, { type: 'PREPARE', caseId: 'known-landing', method: 'ABILITY' });
    expect(s.traveler.practice.position).toBe('ENTRY'); expect(travelerInside(s)).toBe(false); expect(originals(s)).toEqual(old);
    expect(validateTravelerLife(s)).toBe(true);
  });

  it('moves the actual body only on successful travel and performs a free-AP ordinary return without free teleportation', () => {
    const s = promoted(); begin(s, 'known-landing', 'ABILITY'); const spirit = s.spirituality, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'known-landing' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 3);
    expect(s.traveler.practice).toMatchObject({ position: 'LANDING', companionPosition: 'ENTRY', journeys: 1, returns: 0 });
    expect(messages(c)).toContain('原身体经灵界实际抵达'); expect(travelerInside(s)).toBe(true); expect(validateTravelerLife(s)).toBe(true);
    for (const command of [{ type: 'REPORT', caseId: 'known-landing' }, { type: 'OBSERVE', caseId: 'offered-card' }, { type: 'RECORD_SAMPLE', sample: 'FLASH' }]) reject(s, command);
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'known-landing' });
    expect(messages(close)).toContain('实际步行六米返回入口'); expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.mind, s.spirituality]).toEqual([0, 0, 0]);
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', journeys: 1, returns: 1 }); expect(travelerInside(s)).toBe(false);
    expect(originals(s)).toEqual(old); expect(validateTravelerLife(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'known-landing' });
  });

  it('failed travel spends the actual three spirituality but never fabricates arrival or return', () => {
    const s = promoted(); begin(s, 'known-landing', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'known-landing' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', journeys: 0, returns: 0 });
    expect(s.traveler.cases['known-landing']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(travelerInside(s)).toBe(true); expect(validateTravelerLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'known-landing' }); expect(s.traveler.practice.returns).toBe(0);
    reject(s, { type: 'PREPARE', caseId: 'known-landing', method: 'ABILITY' }); reject(s, { type: 'REPORT', caseId: 'known-landing' });
    nextWeek(s); complete(s, 'known-landing');
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', journeys: 1, returns: 1 }); expect(validateTravelerLife(s)).toBe(true);
  });

  it('failed ordinary landing inspection retains actual body movement until an explicit ordinary return', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'known-landing');
    const c = act(s, { type: 'PERFORM', caseId: 'known-landing' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(0);
    expect(s.traveler.practice).toMatchObject({ position: 'LANDING', journeys: 1, returns: 0 });
    expect(travelerCases(s)[0]!.result).toContain('仍在六米原平台'); expect(validateTravelerLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'known-landing' }); expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', journeys: 1, returns: 1 });
    reject(s, { type: 'REPORT', caseId: 'known-landing' }); nextWeek(s); complete(s, 'known-landing');
    expect(s.traveler.practice).toMatchObject({ journeys: 2, returns: 2 }); expect(validateTravelerLife(s)).toBe(true);
  });

  it('the invisible hand moves only the same original permitted card, followed by physical two-metre return', () => {
    const s = promoted(); begin(s, 'offered-card', 'ABILITY'); const spirit = s.spirituality, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'offered-card' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 2);
    expect(messages(c)).toContain('TR5-CARD-1'); expect(messages(c)).toContain('原桌已没有这张卡');
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', card: 'PLAYER', cardTakes: 1, cardReturns: 0, journeys: 0, returns: 0 });
    expect(travelerPractice(s)!.card).toContain('在你手中'); expect(validateTravelerLife(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'offered-card' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'offered-card' });
    expect(messages(close)).toContain('亲手将原卡放回'); expect(messages(close)).toContain('步行两米回到入口');
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', card: 'DESK', cardTakes: 1, cardReturns: 1 });
    expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled(); expect(originals(s)).toEqual(old);
    expect(validateTravelerLife(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'offered-card' });
  });

  it('failed invisible-hand taking spends two spirituality while the one original card remains on the desk', () => {
    const s = promoted(); begin(s, 'offered-card', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'offered-card' }, 100);
    expect(s.spirituality).toBe(spirit - 2); expect(s.traveler.practice).toMatchObject({ card: 'DESK', cardTakes: 0, cardReturns: 0 });
    expect(s.traveler.cases['offered-card']!.contactOpen).toBe(true); expect(validateTravelerLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'offered-card' }); expect(s.traveler.practice.cardReturns).toBe(0); expect(validateTravelerLife(s)).toBe(true);
  });

  it('failed ordinary checking keeps the physically taken original card until the player walks to return it', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'offered-card');
    const c = act(s, { type: 'PERFORM', caseId: 'offered-card' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(messages(c)).toContain('不撤销真实取卡');
    expect(s.traveler.practice).toMatchObject({ card: 'PLAYER', cardTakes: 1, cardReturns: 0, position: 'ENTRY' });
    act(s, { type: 'CLOSE', caseId: 'offered-card' }); expect(s.traveler.practice).toMatchObject({ card: 'DESK', cardTakes: 1, cardReturns: 1 });
    reject(s, { type: 'PREPARE', caseId: 'offered-card', method: 'ORDINARY' }); nextWeek(s); complete(s, 'offered-card');
    expect(s.traveler.practice).toMatchObject({ card: 'DESK', cardTakes: 2, cardReturns: 2 }); expect(validateTravelerLife(s)).toBe(true);
  });

  it('Mira is independently present and gives limited face-to-face consent only during preparation', () => {
    const s = promoted(), old = originals(s);
    act(s, { type: 'OBSERVE', caseId: 'willing-companion' });
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: false, companionTrips: 0 });
    const prep = act(s, { type: 'PREPARE', caseId: 'willing-companion', method: 'ABILITY' });
    expect(messages(prep)).toContain('本人明确自愿答应'); expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: true, companionTrips: 0 });
    expect(travelerInside(s)).toBe(false); expect(validateTravelerLife(s)).toBe(true);
    reject(s, { type: 'OBSERVE', caseId: 'known-landing' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0; const withdrawal = act(s, { type: 'WITHDRAW', caseId: 'willing-companion' });
    expect(messages(withdrawal)).toContain('同意也已撤销'); expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: false, companionTrips: 0 });
    expect(s.traveler.cases['willing-companion']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 }); expect(originals(s)).toEqual(old); expect(validateTravelerLife(s)).toBe(true);
  });

  it('successful companion travel moves exactly the two original willing bodies and requires both to walk back', () => {
    const s = promoted(); begin(s, 'willing-companion', 'ABILITY'); const spirit = s.spirituality, old = originals(s);
    const c = act(s, { type: 'PERFORM', caseId: 'willing-companion' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16); expect(s.spirituality).toBe(spirit - 5);
    expect(s.traveler.practice).toMatchObject({ position: 'LANDING', companionPosition: 'LANDING', consent: true, journeys: 1, returns: 0, companionTrips: 1 });
    expect(messages(c)).toContain('同一位原米拉抵达六米平台'); expect(validateTravelerLife(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'willing-companion' }); reject(s, { type: 'WITHDRAW', caseId: 'willing-companion' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'willing-companion' });
    expect(messages(close)).toContain('两具原身体真实回到出发处');
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: false, journeys: 1, returns: 1, companionTrips: 1 });
    expect(originals(s)).toEqual(old); expect(validateTravelerLife(s)).toBe(true); expect(travelerInside(s)).toBe(false);
  });

  it('failed companion travel leaves both bodies at entry and retains the limited contact until explicit cleanup', () => {
    const s = promoted(); begin(s, 'willing-companion', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'willing-companion' }, 100);
    expect(s.spirituality).toBe(spirit - 5); expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: true, journeys: 0, returns: 0, companionTrips: 0 });
    expect(travelerInside(s)).toBe(true); expect(validateTravelerLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'willing-companion' }); expect(s.traveler.practice).toMatchObject({ consent: false, returns: 0 });
    reject(s, { type: 'PREPARE', caseId: 'willing-companion', method: 'ORDINARY' }); nextWeek(s); complete(s, 'willing-companion');
    expect(s.traveler.practice).toMatchObject({ companionTrips: 1, journeys: 1, returns: 1 }); expect(validateTravelerLife(s)).toBe(true);
  });

  it('failed ordinary companion checking retains both actual arrivals and both ordinary returns', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'willing-companion');
    const c = act(s, { type: 'PERFORM', caseId: 'willing-companion' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    expect(s.traveler.practice).toMatchObject({ position: 'LANDING', companionPosition: 'LANDING', consent: true, journeys: 1, returns: 0, companionTrips: 1 });
    expect(validateTravelerLife(s)).toBe(true); act(s, { type: 'CLOSE', caseId: 'willing-companion' });
    expect(s.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: false, journeys: 1, returns: 1, companionTrips: 1 });
    reject(s, { type: 'REPORT', caseId: 'willing-companion' }); expect(validateTravelerLife(s)).toBe(true);
  });

  it('all ordinary reports and reflection reach peaceful acting100 without changing old records or granting new mastery', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery); s.spirituality = 0;
    for (const id of TRAVELER_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); expect(act(s, { type: 'REFLECT' }).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.traveler.practice).toEqual({ position: 'ENTRY', card: 'DESK', companionPosition: 'ENTRY', consent: false, journeys: 2, returns: 2, cardTakes: 1, cardReturns: 1, companionTrips: 1 });
    expect(s.seer.completedSources.filter(x => x.startsWith('traveler-'))).toEqual([...TRAVELER_CASE_IDS.map(id => `traveler-case:${id}`), 'traveler-reflection']);
    expect(originals(s)).toEqual(old); expect(validateTravelerState(s)).toBe(true);
    for (const caseId of TRAVELER_CASE_IDS) { reject(s, { type: 'PERFORM', caseId }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' });
  });

  it('ability reports give one known-pool reward each after actual cleanup, with no repeated performance or reward', () => {
    const s = promoted(), old = originals(s);
    for (const caseId of TRAVELER_CASE_IDS) {
      expect(complete(s, caseId, 'ABILITY').award).toHaveBeenCalledExactlyOnceWith(`traveler-case:${caseId}`, 8);
      reject(s, { type: 'REPORT', caseId }); reject(s, { type: 'PERFORM', caseId });
    }
    expect(s.progression.mastery[TRAVELER_ABILITY_IDS[0]]).toBe(24); expect(s.progression.acting).toBe(75);
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(originals(s)).toEqual(old); expect(validateTravelerState(s)).toBe(true);
  });

  it('failed ordinary history survives a later ability preparation and withdrawal without moving anything again', () => {
    const s = promoted(); begin(s, 'willing-companion'); act(s, { type: 'PERFORM', caseId: 'willing-companion' }, 100);
    act(s, { type: 'CLOSE', caseId: 'willing-companion' }); nextWeek(s); begin(s, 'willing-companion', 'ABILITY');
    expect(s.traveler.practice).toMatchObject({ journeys: 1, returns: 1, companionTrips: 1, consent: true }); expect(validateTravelerLife(s)).toBe(true);
    act(s, { type: 'WITHDRAW', caseId: 'willing-companion' });
    expect(s.traveler.practice).toMatchObject({ journeys: 1, returns: 1, companionTrips: 1, consent: false }); expect(validateTravelerLife(s)).toBe(true);
  });

  it('last-AP public travel holds its week and actual position until the explicit ordinary return', () => {
    const s = promoted(); begin(s, 'known-landing'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, moved = applySliceIntent(s, { type: 'TRAVELER', command: { type: 'PERFORM', caseId: 'known-landing' } });
    expect([moved.week, moved.actionsRemaining, moved.traveler.practice.position]).toEqual([week, 0, 'LANDING']);
    expect(() => applySliceIntent(moved, { type: 'ACTION', action: 'REST' })).toThrow();
    const returned = applySliceIntent(moved, { type: 'TRAVELER', command: { type: 'CLOSE', caseId: 'known-landing' } });
    expect(returned.week).toBe(week + 1); expect(returned.traveler.practice).toMatchObject({ position: 'ENTRY', journeys: 1, returns: 1 }); expect(travelerInside(returned)).toBe(false);
  });

  it.each(['offered-card', 'willing-companion'] as const)('last-AP public %s keeps its real card or companion state until cleanup', caseId => {
    const s = promoted(); begin(s, caseId); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, moved = applySliceIntent(s, { type: 'TRAVELER', command: { type: 'PERFORM', caseId } });
    expect(moved.week).toBe(week); expect(moved.actionsRemaining).toBe(0); expect(travelerInside(moved)).toBe(true);
    expect(caseId === 'offered-card' ? moved.traveler.practice.card : moved.traveler.practice.companionPosition).toBe(caseId === 'offered-card' ? 'PLAYER' : 'LANDING');
    expect(() => applySliceIntent(moved, { type: 'ACTION', action: 'WORK' })).toThrow();
    const returned = applySliceIntent(moved, { type: 'TRAVELER', command: { type: 'CLOSE', caseId } });
    expect(returned.week).toBe(week + 1); expect(travelerInside(returned)).toBe(false);
    expect(returned.traveler.practice).toMatchObject({ position: 'ENTRY', card: 'DESK', companionPosition: 'ENTRY', consent: false });
  });

  it.each(['PERFORM', 'WITHDRAW'] as const)('last-AP companion preparation advances the week and still allows %s without phantom movement', commandType => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'willing-companion' });
    s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = []; const week = s.week;
    const prepared = applySliceIntent(s, { type: 'TRAVELER', command: { type: 'PREPARE', caseId: 'willing-companion', method: 'ORDINARY' } });
    expect(prepared.week).toBe(week + 1); expect(prepared.actionsRemaining).toBeGreaterThan(0);
    expect(prepared.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: true, journeys: 0, returns: 0, companionTrips: 0 });
    expect(prepared.traveler.cases['willing-companion']!.status).toBe('PREPARED'); expect(travelerInside(prepared)).toBe(false);
    const after = applySliceIntent(prepared, { type: 'TRAVELER', command: { type: commandType, caseId: 'willing-companion' } });
    if (commandType === 'WITHDRAW') {
      expect(after.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: false, journeys: 0, returns: 0, companionTrips: 0 });
      expect(after.traveler.cases['willing-companion']!.status).toBe('OBSERVED'); expect(travelerInside(after)).toBe(false);
    } else {
      expect(after.traveler.practice).toMatchObject({ position: 'LANDING', companionPosition: 'LANDING', consent: true, journeys: 1, returns: 0, companionTrips: 1 });
      expect(after.traveler.cases['willing-companion']!.contactOpen).toBe(true); expect(travelerInside(after)).toBe(true);
      const closed = applySliceIntent(after, { type: 'TRAVELER', command: { type: 'CLOSE', caseId: 'willing-companion' } });
      expect(closed.traveler.practice).toMatchObject({ position: 'ENTRY', companionPosition: 'ENTRY', consent: false, journeys: 1, returns: 1, companionTrips: 1 });
    }
  });

  it('ordinary life outside advances the real week without inventing practice movement', () => {
    const s = promoted(); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = []; const before = structuredClone(s.traveler.practice), week = s.week;
    const rested = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(rested.week).toBe(week + 1); expect(rested.traveler.practice).toEqual(before); expect(travelerInside(rested)).toBe(false);
  });

  it('the unpromoted actual ritual visit is also inside and cannot be mistaken for a local trial', () => {
    const s = recorder(), c = context(s).ctx;
    applyTravelerCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyTravelerCommand(s, { type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' }, c);
    expect(travelerInside(s)).toBe(true); expect(travelerCases(s)).toEqual([]); expect(validateTravelerLife(s)).toBe(true);
    reject(s, { type: 'OBSERVE', caseId: 'known-landing' });
    applyTravelerCommand(s, { type: 'RITUAL_RETURN' }, c); expect(travelerInside(s)).toBe(false);
  });

  it('inherited FLASH recording reuses the same actual teacher, paid demonstration and one original stock record', () => {
    const s = promoted(), records = structuredClone(s.recorder.records), demos = s.recorder.demonstrations.length, ap = s.actionsRemaining, spirit = s.spirituality;
    const actor = structuredClone(s.recorder.instructorSpirituality.NORA), practice = structuredClone(s.traveler.practice), acting = s.progression.acting;
    const action = travelerActions(s).find(a => a.command.type === 'RECORD_SAMPLE' && a.command.sample === 'FLASH');
    expect(action?.enabled).toBe(true);
    const c = act(s, { type: 'RECORD_SAMPLE', sample: 'FLASH' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(c.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.recorder.demonstrations).toHaveLength(demos + 1); expect(s.recorder.records.slice(0, records.length)).toEqual(records);
    expect(s.recorder.records.at(-1)).toMatchObject({ sample: 'FLASH', status: 'STORED', sourceDemoId: s.recorder.demonstrations.at(-1)!.id });
    expect(s.recorder.instructorSpirituality.NORA.spirituality).toBe(Math.min(20, actor.spirituality + (s.week - (actor.restWeek ?? s.recorder.promotionWeek!)) * 2) - 2);
    expect(s.traveler.practice).toEqual(practice); expect(s.progression.acting).toBe(acting);
    reject(s, { type: 'RECORD_SAMPLE', sample: 'FLASH' }); expect(validateTravelerState(s)).toBe(true);
  });

  it('inherited failed recording retains teacher and player costs without refilling or creating a record', () => {
    const s = promoted(), records = structuredClone(s.recorder.records), demos = s.recorder.demonstrations.length, spirit = s.spirituality;
    const c = act(s, { type: 'RECORD_SAMPLE', sample: 'COURAGE' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 3);
    expect(s.recorder.records).toEqual(records); expect(s.recorder.demonstrations).toHaveLength(demos + 1);
    expect(s.recorder.demonstrations.at(-1)).toMatchObject({ sample: 'COURAGE', success: false });
    reject(s, { type: 'RECORD_SAMPLE', sample: 'COURAGE' }); expect(validateTravelerState(s)).toBe(true);
  });

  it('projections are detached and show current real location, one card and original consent', () => {
    const s = promoted(); begin(s, 'willing-companion', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'willing-companion' });
    const practice = travelerPractice(s)!, cases = travelerCases(s);
    expect(practice.position).toContain('六米原平台'); expect(practice.companion).toContain('同一位成年原米拉'); expect(practice.companion).toContain('须两人一起普通步行返回');
    expect(practice.card).toContain('唯一TR5-CARD-1'); expect(practice.history.join(' ')).toContain('实际同行抵达1次');
    expect(cases.find(c => c.id === 'willing-companion')!.result).toContain('仍在六米原平台');
    practice.history.push('forged'); practice.position = 'elsewhere'; cases[0]!.observations.push('forged');
    expect(travelerPractice(s)!.history).not.toContain('forged'); expect(travelerCases(s)[0]!.observations).not.toContain('forged'); expect(s.traveler.practice.position).toBe('LANDING');
    expect(travelerActions(s).find(a => a.command.type === 'CLOSE')?.enabled).toBe(true); expect(travelerActions(s).find(a => a.command.type === 'REPORT')?.enabled).toBe(false);
  });

  it('rejects malformed commands, unknown locations and invented participants without state changes', () => {
    const s = promoted();
    for (const command of [null, {}, { type: 'PERFORM', caseId: 'other' }, { type: 'PREPARE', caseId: 'known-landing', method: 'TELEPORT' }, { type: 'PREPARE', caseId: 'willing-companion', method: 'ABILITY', passenger: 'other' }, { type: 'OBSERVE', caseId: 'known-landing', destination: 'moon' }, { type: 'REFLECT', extra: true }, { type: 'RECORD_SAMPLE', sample: 'TRAVEL' }]) reject(s, command);
    expect(isTravelerActivity({ type: 'OBSERVE', caseId: 'known-landing' })).toBe(true);
    expect(isTravelerActivity({ type: 'RITUAL_DEPART', site: 'BRONZE_STEPS' })).toBe(false);
  });

  it('rejects forged body positions, copied cards, missing consent, unbalanced journeys and duplicate rewards', () => {
    const initial = promoted(); expect(validateTravelerLife(initial)).toBe(true);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.traveler.practice.position = 'LANDING'; }, s => { s.traveler.practice.companionPosition = 'LANDING'; }, s => { s.traveler.practice.card = 'PLAYER'; },
      s => { s.traveler.practice.consent = true; }, s => { s.traveler.practice.journeys = 1; }, s => { s.traveler.practice.cardTakes = 1; }, s => { s.traveler.practice.companionTrips = 1; },
      s => { Object.assign(s.traveler.practice, { duplicateCard: true }); }, s => { Object.assign(s.traveler, { practice: null }); }, s => { Object.assign(s.traveler.cases, { 'known-landing': null }); },
      s => { s.traveler.cases['known-landing']!.attemptWeek = s.week + 1; }, s => { s.seer.completedSources.push('traveler-case:known-landing'); },
    ];
    for (const change of mutations) { const s = structuredClone(initial); change(s); expect(validateTravelerLife(s)).toBe(false); }
    const moving = promoted(); begin(moving, 'willing-companion', 'ABILITY'); act(moving, { type: 'PERFORM', caseId: 'willing-companion' });
    for (const change of [((s: SliceState) => { s.traveler.practice.consent = false; }), (s: SliceState) => { s.traveler.practice.companionPosition = 'ENTRY'; }, (s: SliceState) => { s.traveler.practice.position = 'ENTRY'; s.traveler.practice.returns = 1; }, (s: SliceState) => { s.traveler.cases['willing-companion']!.contactOpen = false; }, (s: SliceState) => { s.world.city = 'TINGEN'; }, (s: SliceState) => { s.week += 1; }]) {
      const s = structuredClone(moving); change(s); expect(validateTravelerLife(s)).toBe(false);
    }
    const finished = promoted(); for (const id of TRAVELER_CASE_IDS) complete(finished, id, 'ABILITY');
    for (const change of [((s: SliceState) => { s.traveler.practice.returns = 1; }), (s: SliceState) => { s.traveler.practice.cardReturns = 0; }, (s: SliceState) => { s.traveler.practice.companionTrips = 0; }, (s: SliceState) => { s.traveler.cases['offered-card']!.outcome = 'LANDING_CHECKED'; }, (s: SliceState) => { s.traveler.cases['willing-companion']!.closes = 0; }, (s: SliceState) => { s.seer.completedSources.push('traveler-case:offered-card'); }, (s: SliceState) => { s.progression.acting = 100; }]) {
      const s = structuredClone(finished); change(s); expect(validateTravelerLife(s)).toBe(false);
    }
  });

  it('blocks insufficient resources and interruptions without consuming resources, and allows zero-cost withdrawal', () => {
    for (const change of [((s: SliceState) => { s.world.city = 'TINGEN'; }), (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }]) {
      const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'known-landing' });
    }
    for (const [caseId, cost] of [['known-landing', 3], ['offered-card', 2], ['willing-companion', 5]] as const) {
      const s = promoted(); begin(s, caseId, 'ABILITY'); s.spirituality = cost - 1; reject(s, { type: 'PERFORM', caseId });
      s.actionsRemaining = 0; s.mind = 0; act(s, { type: 'WITHDRAW', caseId }); expect(validateTravelerLife(s)).toBe(true);
    }
    const s = promoted(); reject(s, { type: 'REFLECT' }); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    complete(s, 'known-landing'); expect(travelerActions(s).find(a => a.command.type === 'ENCOUNTER_TALK')?.enabled).toBe(true);
  });
});
