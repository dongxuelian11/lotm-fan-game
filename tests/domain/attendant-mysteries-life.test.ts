import { describe, expect, it } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicResolutionTier } from '../../src/shared/contracts.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { SEER_ABILITIES } from '../../src/domain/seer/content.js';
import { CLOWN_ABILITIES } from '../../src/domain/clown/content.js';
import { MAGICIAN_ABILITIES } from '../../src/domain/magician/content.js';
import { FACELESS_ABILITIES } from '../../src/domain/faceless/content.js';
import { MARIONETTIST_ABILITIES } from '../../src/domain/marionettist/content.js';
import { BIZARRO_SORCERER_ABILITIES } from '../../src/domain/bizarro-sorcerer/content.js';
import { ANCIENT_SCHOLAR_ABILITIES } from '../../src/domain/ancient-scholar/content.js';
import { MIRACLE_WORKER_ABILITIES } from '../../src/domain/miracle-worker/content.js';
import { ATTENDANT_MYSTERIES_CASE_IDS, ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS, applyAttendantMysteriesActivity, attendantMysteriesLifeClosed, attendantMysteriesLifeRewards, blockAttendantMysteriesActivity, createAttendantMysteriesLifeState, hasAttendantMysteriesLifeLock, projectAttendantMysteriesLife, validateAttendantMysteriesActivityCommand, validateAttendantMysteriesLife, type AttendantMysteriesActivityCommand, type AttendantMysteriesCaseId } from '../../src/domain/attendant-mysteries/life.js';
const [THREADS, GRAFT, REALM] = ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS;
const OLD_IDS = [...SEER_ABILITIES, ...CLOWN_ABILITIES, ...MAGICIAN_ABILITIES, ...FACELESS_ABILITIES, ...MARIONETTIST_ABILITIES, ...BIZARRO_SORCERER_ABILITIES, ...ANCIENT_SCHOLAR_ABILITIES, ...MIRACLE_WORKER_ABILITIES].map(x => x.id);
/** Declared isolated pre-journal inputs, not an acquisition or natural-play proof. No save mutation during an attempt. */
function fixture(tiers: PublicResolutionTier[] = []): SliceState {
  let seed = '';
  for (let n = 0; n < 32768; n++) {
    const candidate = `attendant-life-unit-${n}`, rng = new DeterministicActionRandomStream(candidate, 0);
    if (tiers.every(tier => resolveNormalCheck({ ability: 'knowledge', baseAbility: 20, difficulty: 20, modifiers: [], roll: rng.nextInt(1, 100) }).tier === tier)) { seed = candidate; break; }
  }
  expect(seed).not.toBe('');
  return { revision: 0, week: 1, date: { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 }, status: 'ACTIVE', activeEvent: null, combat: null, world: { city: 'BACKLUND' }, actionsRemaining: 100, weeklyBudget: 100, cash: 1000, spirituality: 120, mind: 100, health: 100, injuries: [], combatHistory: [],
    character: { name: '工坊测试者', gender: 'FEMALE', coreStats: { knowledge: 20 } }, random: { seed, cursor: 0 }, progression: { pathwayId: 'diviner', sequence: 1, acting: 0, mastery: { ...Object.fromEntries(OLD_IDS.map((id, i) => [id, i + 7])), ...Object.fromEntries(ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS.map(id => [id, 0])) } }, seer: { completedSources: ['original-history-source'] },
    ancientScholar: { ritual: { calendarRemainderDays: 0 } },
    miracleWorker: { life: { originalRecord: 'unchanged', clockSeconds: 413, originalBodyId: 'MW2-ORIGINAL' }, revival: { used: 1 }, ritual: { completed: true } },
    attendantMysteries: { promotionWeek: 1, life: createAttendantMysteriesLifeState() },
  } as unknown as SliceState;
}
function context(s: SliceState): SeerContext { return { note() {}, roll(min, max) { const r = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), n = r.nextInt(min, max); s.random.cursor = r.cursor; return n; }, check(ability, difficulty) { const r = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: r.nextInt(1, 100) }); s.random.cursor = r.cursor; return result; } }; }
function act(s: SliceState, c: AttendantMysteriesActivityCommand): SliceState { s.revision++; applyAttendantMysteriesActivity(s, c, context(s)); expect(validateAttendantMysteriesLife(s), JSON.stringify(c)).toBe(true); return s; }
const a = (s: SliceState, id: AttendantMysteriesCaseId) => s.attendantMysteries.life.cases[id].attempts[0]!;
function start(s: SliceState, caseId: AttendantMysteriesCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', consent: 'CONSENT' | 'DECLINE' = 'CONSENT'): SliceState {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
  for (const type of [consent, 'CHECK_ORIGINALS', 'SETUP'] as const) act(s, { type, caseId });
  if (caseId === 'enclosed-realm') act(s, { type: 'ENTER_ROOM', caseId }); return s;
}
function finish(s: SliceState, caseId: AttendantMysteriesCaseId): SliceState {
  if (caseId === 'enclosed-realm' && s.attendantMysteries.life.site.volunteer.location === 'ROOM') act(s, { type: 'VOLUNTEER_EXIT', caseId });
  if (s.attendantMysteries.life.effect) act(s, { type: 'STOP', caseId });
  for (const type of ['RETURN', 'RETURN_ITEMS', 'INSPECT', 'CLOSE', 'REPORT'] as const) act(s, { type, caseId }); return s;
}
function ordinary(s: SliceState, caseId: AttendantMysteriesCaseId): SliceState { start(s, caseId, 'ORDINARY'); act(s, { type: caseId === 'lost-threads' ? 'MOVE_FISH_MANUALLY' : caseId === 'bounded-door' ? 'WALK_OUTBOUND' : 'CHECK_CONCEALMENT', caseId }); return finish(s, caseId); }
function beforeGate(s = fixture()): SliceState { return ordinary(s, 'lost-threads'); }
function beforeRoom(s = fixture()): SliceState { return ordinary(beforeGate(s), 'bounded-door'); }
function reject(s: SliceState, c: AttendantMysteriesActivityCommand) { const old = structuredClone(s); expect(blockAttendantMysteriesActivity(s, c)).not.toBeNull(); expect(() => applyAttendantMysteriesActivity(s, c, context(s))).toThrow(); expect(s).toEqual(old); }
function successful(s: SliceState, caseId: AttendantMysteriesCaseId): SliceState { start(s, caseId); act(s, { type: caseId === 'lost-threads' ? 'REGENERATE_THREADS' : caseId === 'bounded-door' ? 'GRAFT_DOOR' : 'CONCEAL_ROOM', caseId }); act(s, { type: caseId === 'lost-threads' ? 'MOVE_FISH' : caseId === 'bounded-door' ? 'CROSS_GATE' : 'CHECK_CONCEALMENT', caseId }); return finish(s, caseId); }

describe('Attendant of Mysteries original workshop and finite noncombat practice', () => {
  it('starts fresh with three zero masteries, a new original workshop, and strict commands', () => {
    const s = fixture(), p = s.attendantMysteries.life.site;
    expect(OLD_IDS).toHaveLength(31); expect(validateAttendantMysteriesLife(s)).toBe(true); expect(ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
    expect(p.owner).toMatchObject({ age: 46, bodyCount: 1, health: 100, independentMind: true }); expect(p.volunteer).toMatchObject({ age: 39, bodyCount: 1, health: 100, independentMind: true }); expect(p.owner.id).not.toBe(p.volunteer.id);
    expect(p.fish).toMatchObject({ id: 'AM1-FISH', quantity: 1, alive: false, threadsPresent: false, paidPennies: 0 }); expect(p.room).toMatchObject({ radiusMetres: 6, doorUsable: true, quantity: 1 });
    for (const c of [{ type: 'REFLECT', extra: true }, { type: 'CONCEAL_ROOM', caseId: 'enclosed-realm', radius: 6000 }, { type: 'REGENERATE_THREADS', caseId: 'lost-threads', target: 'STEEL' }, { type: 'GRAFT_DOOR', caseId: 'bounded-door', destination: 'UNSEEN' }, { type: 'REVIVE_PERSON', caseId: 'lost-threads' }]) expect(validateAttendantMysteriesActivityCommand(c)).toBe(false);
  });
  it('ordinary completion earns acting100 only, preserves all31 actual old masteries and old scenes', () => {
    const s = fixture(), oldScene = structuredClone(s.miracleWorker), oldMastery = { ...s.progression.mastery }, bodies = { health: s.health, mind: s.mind, spirituality: s.spirituality, injuries: structuredClone(s.injuries), combatHistory: structuredClone(s.combatHistory) };
    for (const id of ATTENDANT_MYSTERIES_CASE_IDS) ordinary(s, id); act(s, { type: 'REFLECT' });
    expect(attendantMysteriesLifeClosed(s)).toBe(true); expect(hasAttendantMysteriesLifeLock(s)).toBe(false); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(oldMastery); expect(s.miracleWorker).toEqual(oldScene);
    expect({ health: s.health, mind: s.mind, spirituality: s.spirituality, injuries: s.injuries, combatHistory: s.combatHistory }).toEqual(bodies); expect(s.cash).toBe(934); expect(s.attendantMysteries.life.site.playerTravelMetres).toBe(52); expect(s.attendantMysteries.life.site.fish.travelMetres).toBe(2);
    expect(s.attendantMysteries.life.site.materials.map(x => [x.paidPennies, x.wear, x.holder])).toEqual([[12, 1, 'STORED'], [24, 1, 'STORED'], [12, 1, 'STORED']]);
    expect(s.seer.completedSources).toEqual(['original-history-source', 'attendant-mysteries-life-lost-threads', 'attendant-mysteries-life-bounded-door', 'attendant-mysteries-life-enclosed-realm', 'attendant-mysteries-reflection']);
    reject(s, { type: 'REPORT', caseId: 'enclosed-realm' }); reject(s, { type: 'REFLECT' });
  });
  it('restores only lost prior fish threads, then actually moves the original without restoring life', () => {
    const s = start(fixture(['SUCCESS']), 'lost-threads'), id = 'lost-threads';
    expect(s.attendantMysteries.life.site.fish).toMatchObject({ owner: 'PLAYER', paidPennies: 18, alive: false, provenance: { originalSpiritThreads: 'PREEXISTED_THEN_LOST', deathBeforeScene: true } });
    act(s, { type: 'REGENERATE_THREADS', caseId: id }); const e = s.attendantMysteries.life.journal.at(-1)!;
    expect(e.paid).toMatchObject({ actions: 1, spirituality: 6, mind: 2 }); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.source).toMatchObject({ abilityId: THREADS, currentConsent: 'GRANTED', maximumSeconds: 20, actor: { sequence: 1, pathwayId: 'diviner', bodyCount: 1 } });
    expect(s.attendantMysteries.life.site.fish.threadsPresent).toBe(true); expect(s.progression.mastery[THREADS]).toBe(0); act(s, { type: 'MOVE_FISH', caseId: id });
    expect(s.attendantMysteries.life.site.fish).toMatchObject({ holder: 'DISH', quantity: 1, alive: false, travelMetres: 1 }); expect(s.attendantMysteries.life.site.movements.at(-1)).toMatchObject({ actorId: 'AM1-FISH', mode: 'THREADS', metres: 1 }); finish(s, id);
    expect(s.progression.mastery[THREADS]).toBe(8); expect(s.attendantMysteries.life.site.fish).toMatchObject({ holder: 'TRAY', threadsPresent: false, alive: false, travelMetres: 2 });
  });
  for (const tier of ['FAILURE', 'GREAT_FAILURE'] as const) it(`${tier} consumes actual resources/material and keeps deterministic check with no fabricated mastery`, () => {
    const s = start(fixture([tier]), 'lost-threads'), id = 'lost-threads', before = { spirit: s.spirituality, mind: s.mind, actions: s.actionsRemaining, time: s.attendantMysteries.life.site.clockSeconds };
    act(s, { type: 'REGENERATE_THREADS', caseId: id }); expect(a(s, id).tier).toBe(tier); expect([s.spirituality, s.mind, s.actionsRemaining, s.attendantMysteries.life.site.clockSeconds]).toEqual([before.spirit - 6, before.mind - 4, before.actions - 1, before.time + 1]);
    expect(s.attendantMysteries.life.site.materials[0]!.wear).toBe(2); expect(s.attendantMysteries.life.effect).toBeNull(); reject(s, { type: 'REGENERATE_THREADS', caseId: id }); reject(s, { type: 'MOVE_FISH', caseId: id }); act(s, { type: 'MOVE_FISH_MANUALLY', caseId: id }); finish(s, id); expect(s.progression.mastery[THREADS]).toBe(0);
  });
  it('twenty actual seconds expire restored threads before use; manual fallback has no ability mastery', () => {
    const s = start(fixture(['SUCCESS']), 'lost-threads'), id = 'lost-threads'; act(s, { type: 'REGENERATE_THREADS', caseId: id }); const before = s.attendantMysteries.life.site.clockSeconds, paid = [s.cash, s.spirituality, s.mind];
    act(s, { type: 'WAIT_EFFECT', caseId: id }); expect(s.attendantMysteries.life.site.clockSeconds).toBe(before + 20); expect(a(s, id)).toMatchObject({ effectExpired: true, waitedSeconds: 20, appliedAbilityIds: [] }); expect(s.attendantMysteries.life.site.fish.threadsPresent).toBe(false); expect([s.cash, s.spirituality, s.mind]).toEqual(paid);
    reject(s, { type: 'MOVE_FISH', caseId: id }); act(s, { type: 'MOVE_FISH_MANUALLY', caseId: id }); finish(s, id); expect(s.progression.mastery[THREADS]).toBe(0);
  });
  it('physically observes/positions paid endpoints, carries one original parcel8m, then ordinarily returns', () => {
    const s = start(beforeGate(fixture(['SUCCESS'])), 'bounded-door'), id = 'bounded-door', p = s.attendantMysteries.life.site;
    expect(p.playerTravelMetres).toBe(32); expect(p.gate.endpointA).toMatchObject({ observed: true, positioned: true }); expect(p.gate.endpointB).toMatchObject({ observed: true, positioned: true }); expect(p.materials[1]!.paidPennies).toBe(24);
    act(s, { type: 'GRAFT_DOOR', caseId: id }); act(s, { type: 'CROSS_GATE', caseId: id }); expect(p).toMatchObject({ playerLocation: 'B', playerBody: { count: 1, original: true }, parcel: { id: 'AM1-PARCEL', holder: 'PLAYER', quantity: 1, location: 'B', alive: false } });
    expect(p.movements.at(-1)).toMatchObject({ actorId: 'PLAYER', from: 'A', to: 'B', mode: 'GRAFT', metres: 8, seconds: 1, itemIds: ['AM1-PARCEL'] }); reject(s, { type: 'RETURN', caseId: id });
    const before = p.clockSeconds; act(s, { type: 'WAIT_EFFECT', caseId: id }); expect(p.clockSeconds - before).toBe(29); expect(p.playerLocation).toBe('B'); expect(p.parcel.location).toBe('B'); finish(s, id);
    expect(p.movements.at(-1)).toMatchObject({ actorId: 'PLAYER', from: 'B', to: 'A', mode: 'WALK', metres: 8, seconds: 8 }); expect(p.parcel).toMatchObject({ holder: 'OWNER', location: 'A', travelMetres: 16 }); expect(s.progression.mastery[GRAFT]).toBe(8);
  });
  it('expiry before graft traversal forces ordinary outbound/return and cannot earn graft mastery', () => {
    const s = start(beforeGate(fixture(['SUCCESS'])), 'bounded-door'), id = 'bounded-door'; act(s, { type: 'GRAFT_DOOR', caseId: id }); act(s, { type: 'WAIT_EFFECT', caseId: id }); expect(a(s, id).waitedSeconds).toBe(30); reject(s, { type: 'CROSS_GATE', caseId: id }); act(s, { type: 'WALK_OUTBOUND', caseId: id }); finish(s, id); expect(s.progression.mastery[GRAFT]).toBe(0);
  });
  it('keeps one actual consenting adult inside original60s room and permits original-door exit while concealed', () => {
    const s = start(beforeRoom(fixture(['SUCCESS'])), 'enclosed-realm'), id = 'enclosed-realm', p = s.attendantMysteries.life.site;
    expect(p.volunteer).toMatchObject({ id: 'AM1-MIRA', age: 39, bodyCount: 1, location: 'ROOM', travelMetres: 2 }); expect(p.owner.location).toBe('A'); expect(p.parcel.location).toBe('ROOM');
    act(s, { type: 'CONCEAL_ROOM', caseId: id }); expect(s.attendantMysteries.life.effect!.expiresAt - p.clockSeconds).toBe(60); act(s, { type: 'CHECK_CONCEALMENT', caseId: id }); act(s, { type: 'VOLUNTEER_EXIT', caseId: id });
    expect(p.room).toMatchObject({ id: 'AM1-ROOM', quantity: 1, concealed: true, radiusMetres: 6, doorUsable: true, tableQuantity: 1 }); expect(p.volunteer).toMatchObject({ location: 'A', travelMetres: 4, bodyCount: 1, health: 100 }); expect(p.playerLocation).toBe('ROOM');
    const clock = p.clockSeconds; act(s, { type: 'WAIT_EFFECT', caseId: id }); expect(p.clockSeconds - clock).toBe(53); expect(p.playerLocation).toBe('ROOM'); expect(p.parcel.location).toBe('ROOM'); expect(p.room.concealed).toBe(false); finish(s, id); expect(s.progression.mastery[REALM]).toBe(8); expect(p.playerBody.count).toBe(1); expect(s.injuries).toEqual([]);
  });
  it('withdrawal stops concealment/new effects without teleport/refunds; original door remains the exit', () => {
    const s = start(beforeRoom(fixture(['SUCCESS'])), 'enclosed-realm'), id = 'enclosed-realm', p = s.attendantMysteries.life.site; act(s, { type: 'CONCEAL_ROOM', caseId: id }); const resources = [s.cash, s.spirituality, s.mind];
    act(s, { type: 'WITHDRAW_PERMISSION', caseId: id }); expect(a(s, id)).toMatchObject({ permissionWithdrawn: true, effectStopped: true, consent: 'WITHDRAWN' }); expect(s.attendantMysteries.life.effect).toBeNull(); expect(p).toMatchObject({ playerLocation: 'ROOM', volunteer: { location: 'ROOM' }, parcel: { location: 'ROOM' }, room: { concealed: false } }); expect([s.cash, s.spirituality, s.mind]).toEqual(resources);
    reject(s, { type: 'CONCEAL_ROOM', caseId: id }); reject(s, { type: 'RETURN', caseId: id }); act(s, { type: 'CHECK_CONCEALMENT', caseId: id }); finish(s, id); expect(s.progression.mastery[REALM]).toBe(0); expect(p.movements.filter(x => x.actorId === 'AM1-MIRA').map(x => x.mode)).toEqual(['ORIGINAL_DOOR', 'ORIGINAL_DOOR']);
  });
  it('accepts declined permission once and retains a complete ordinary alternative', () => {
    const s = start(fixture(), 'lost-threads', 'ABILITY', 'DECLINE'), id = 'lost-threads'; reject(s, { type: 'CONSENT', caseId: id }); reject(s, { type: 'REGENERATE_THREADS', caseId: id }); act(s, { type: 'MOVE_FISH_MANUALLY', caseId: id }); finish(s, id); expect(a(s, id).consent).toBe('DECLINED'); expect(s.progression.acting).toBe(25); expect(s.progression.mastery[THREADS]).toBe(0);
  });
  it('awards exactly8 only on each actual application report; receipts preserve31 old values and unique source order', () => {
    const s = fixture(['SUCCESS', 'SUCCESS', 'SUCCESS']), original = { ...s.progression.mastery };
    for (const id of ATTENDANT_MYSTERIES_CASE_IDS) successful(s, id); act(s, { type: 'REFLECT' });
    expect(ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8, 8]); expect(OLD_IDS.map(id => s.progression.mastery[id])).toEqual(OLD_IDS.map(id => original[id])); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(98); expect(s.mind).toBe(94);
    expect(attendantMysteriesLifeRewards(s.attendantMysteries.life)).toEqual({ acting: 100, mastery: { [THREADS]: 8, [GRAFT]: 8, [REALM]: 8 } });
    for (const e of s.attendantMysteries.life.journal.filter(x => x.reward)) { const r = e.reward!; expect(OLD_IDS.map(id => r.masteryAfter[id])).toEqual(OLD_IDS.map(id => r.masteryBefore[id])); expect(r.actingAfter - r.actingBefore).toBe(25); expect(r.completedSourcesAfter).toEqual([...r.completedSourcesBefore, r.sourceId]); }
    const projection = projectAttendantMysteriesLife(s); expect(projection.reflected).toBe(true); expect(projection.insideCase).toBe(false); expect(projection.actions).toEqual([]); expect(projection.facts.join('')).not.toContain('候选');
    // Later combat's authoritative validator may reconcile additional applied mastery without rewriting life receipts.
    s.progression.mastery[REALM] = s.progression.mastery[REALM]! + 8; s.seer.completedSources.push('attendant-mysteries-combat-unit'); s.revision += 2; expect(validateAttendantMysteriesLife(s)).toBe(true);
  });
  it('replays forged cost, duplicate originals, actor sources, cursor, movement, expiry and reward mutations as invalid', () => {
    const s = fixture(['SUCCESS', 'SUCCESS', 'SUCCESS']); for (const id of ATTENDANT_MYSTERIES_CASE_IDS) successful(s, id); act(s, { type: 'REFLECT' });
    const mutations: ((x: SliceState) => void)[] = [
      x => x.attendantMysteries.life.site.fish.quantity = 2 as 1,
      x => x.attendantMysteries.life.site.fish.alive = true as false,
      x => x.attendantMysteries.life.site.playerBody.count = 2 as 1,
      x => x.attendantMysteries.life.site.volunteer.bodyCount = 2 as 1,
      x => x.attendantMysteries.life.site.parcel.id = 'AM1-DUPLICATE' as 'AM1-PARCEL',
      x => x.attendantMysteries.life.site.room.tableQuantity = 2 as 1,
      x => x.attendantMysteries.life.site.room.doorUsable = false as true,
      x => x.attendantMysteries.life.site.materials[1]!.wear = 0,
      x => x.attendantMysteries.life.site.movements.find(m => m.mode === 'GRAFT')!.metres = 0,
      x => x.attendantMysteries.life.journal.find(e => e.command.type === 'PREPARE')!.paid.pennies = 0,
      x => x.attendantMysteries.life.journal.find(e => e.command.type === 'PREPARE')!.budget.cashAfter++,
      x => x.attendantMysteries.life.journal.find(e => e.check)!.check!.roll = 1,
      x => x.attendantMysteries.life.journal.find(e => e.check)!.source!.actor.name = '另一个人',
      x => x.attendantMysteries.life.journal.find(e => e.check)!.source!.site.fish.provenance.originalSpiritThreads = 'NEVER_EXISTED' as 'PREEXISTED_THEN_LOST',
      x => { const e = x.attendantMysteries.life.journal.find(e => e.check)!; e.randomAfter = e.randomAfter! + 1; },
      x => x.attendantMysteries.life.journal[1]!.clockAfter++,
      x => { const r = x.attendantMysteries.life.journal.find(e => e.reward)!.reward!; r.masteryAfter[OLD_IDS[0]!] = r.masteryAfter[OLD_IDS[0]!]! + 1; },
      x => x.attendantMysteries.life.journal.find(e => e.reward)!.reward!.masteryAfter[THREADS] = 16,
      x => x.attendantMysteries.life.journal.find(e => e.reward)!.reward!.actingAfter++,
      x => x.seer.completedSources.push('attendant-mysteries-life-forged'),
      x => (x.attendantMysteries.life as unknown as Record<string, unknown>).extra = true,
    ];
    for (const mutate of mutations) { const clone = structuredClone(s); mutate(clone); expect(validateAttendantMysteriesLife(clone)).toBe(false); }
  });
  it('pins active contact to current budgets, same week, actual city and retained RNG with zero-AP cleanup', () => {
    const s = fixture(['SUCCESS']); s.actionsRemaining = 3; start(s, 'lost-threads'); expect(s.actionsRemaining).toBe(1); act(s, { type: 'REGENERATE_THREADS', caseId: 'lost-threads' }); expect(s.actionsRemaining).toBe(0); act(s, { type: 'MOVE_FISH', caseId: 'lost-threads' }); act(s, { type: 'STOP', caseId: 'lost-threads' });
    for (const type of ['RETURN', 'RETURN_ITEMS', 'INSPECT', 'CLOSE'] as const) act(s, { type, caseId: 'lost-threads' }); expect(hasAttendantMysteriesLifeLock(s)).toBe(false); expect(blockAttendantMysteriesActivity(s, { type: 'REPORT', caseId: 'lost-threads' })).not.toBeNull();
    const active = start(fixture(), 'lost-threads');
    for (const mutate of [(x: SliceState) => x.cash++, (x: SliceState) => x.random.cursor++, (x: SliceState) => x.week++, (x: SliceState) => x.world.city = 'ELSEWHERE']) { const clone = structuredClone(active); mutate(clone); expect(validateAttendantMysteriesLife(clone)).toBe(false); }
  });
});
