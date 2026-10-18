import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { baseAdvantage, statusPenalty } from '../../src/domain/slice/combat.js';
import { resolveCalamityDemonessCombatRound } from '../../src/domain/slice/calamity-demoness-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceCombatRound, SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { CALAMITY_DEMONESS_COUNT_WHEEL, CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL, CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL, beginCalamityDemonessCombatRound, currentCalamityDemonessCombatSource,
  drawCalamityDemonessAbility, drawCalamityDemonessEnemyAbility, finishCalamityDemonessCombatRound, calamityDemonessAbilityWheel, calamityDemonessActionCount, calamityDemonessEnemyActionCount,
  projectCalamityDemonessCombat, resolveCalamityDemonessCombatAbility, resolveCalamityDemonessEnemyAbility, validateCalamityDemonessCombatRound, validateCalamityDemonessRoundOutcome,
  type CalamityDemonessCombatSource, type CalamityDemonessMoveId, type CalamityDemonessRoundOutcome } from '../../src/domain/calamity-demoness/combat.js';
import { calamityDemonessApproachedSite, validateCalamityDemonessEncounter } from '../../src/domain/calamity-demoness/encounter.js';
import { projectCalamityDemonessLife, validateCalamityDemonessLifeState } from '../../src/domain/calamity-demoness/life.js';
import { SCREEN, FLAME, FROST, combatStart, encounterReady, cd, oldDemonessRoots, practiced, rejectCalamity } from './calamity-demoness-directed-helper.js';
export const calamityOutcome = (r: SliceCombatRound): CalamityDemonessRoundOutcome => { if (!r.calamityDemonessOutcome) throw new Error('Missing explicit Calamity Demoness outcome'); return r.calamityDemonessOutcome; };
const ordered = (o: CalamityDemonessRoundOutcome) => [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
interface UnitOptions { stance?: SliceStance; health?: number; spirit?: number; charges?: number; depletedEnemy?: boolean }
/** SOURCE-ONLY unit boundary, never a persisted campaign. Vary only declared current budgets and
 * the original seed's input cursor. Historical acquisition/life/old roots remain unchanged.
 * depletedEnemy is an explicit isolated later-round120S-spent source, not fabricated prior rounds. */
function sourceUnit(base: SliceState, offset: number, options: UnitOptions): SliceState {
  const s: SliceState = { ...base, random: { ...base.random, cursor: base.random.cursor + offset }, injuries: structuredClone(base.injuries),
    character: { ...base.character, coreStats: { ...base.character.coreStats } }, progression: { ...base.progression, mastery: { ...base.progression.mastery } },
    combat: structuredClone(base.combat), calamityDemoness: { ...base.calamityDemoness, encounter: structuredClone(base.calamityDemoness.encounter) } };
  if (options.health !== undefined) s.health = options.health;
  if (options.spirit !== undefined) s.spirituality = options.spirit;
  if (options.charges !== undefined) s.calamityDemoness.encounter.plate!.charges = options.charges;
  if (options.depletedEnemy) {
    // Keep every original history entry untouched. This direct adapter source is deliberately
    // not asserted to have a whole-valid encounter history matching its declared later budgets.
    s.combat!.round = s.combatHistory.length + 1; s.calamityDemoness.encounter.startHistoryIndex = 0;
    s.calamityDemoness.encounter.enemySpirituality = 0; s.calamityDemoness.encounter.powerUses = { FORCE_STRIKE: 24, GUARD: 0, DISRUPT: 0 };
    s.calamityDemoness.encounter.currentSite!.clockSeconds = s.calamityDemoness.encounter.preparation!.lifeClockSeconds + 8 + 60 * (s.combat!.round - 1);
  }
  return s;
}
type UnitRound = ReturnType<typeof resolveCalamityDemonessCombatRound> & { state: SliceState; cursor: number };
const scans = new Map<string, { base: SliceState; rounds: UnitRound[] }>();
/** At most256 deterministic source cursors per declared budget. Never force an action ID or
 * check result. Every accepted candidate must replay counts, slots, checks, costs and injury RNG. */
function directedRound(wanted: (o: CalamityDemonessRoundOutcome, r: SliceCombatRound) => boolean, options: UnitOptions = {}): UnitRound {
  const key = JSON.stringify(options); let cache = scans.get(key); if (!cache) { cache = { base: combatStart(), rounds: [] }; scans.set(key, cache); }
  for (let i = 0; i < 256; i++) {
    if (!cache.rounds[i]) { const state = sourceUnit(cache.base, i, options), cursor = state.random.cursor; cache.rounds.push({ state, cursor, ...resolveCalamityDemonessCombatRound(state, options.stance ?? 'ATTACK') }); }
    const candidate = cache.rounds[i]!; if (wanted(calamityOutcome(candidate.round), candidate.round)) { expect(validateCalamityDemonessRoundOutcome(candidate.round.calamityDemonessOutcome)).toBe(true); expect(validateCalamityDemonessCombatRound(candidate.round)).toBe(true); return structuredClone(candidate); }
  }
  throw new Error(`No branch within256 unchanged-seed source cursors for ${key}; do not fabricate evidence.`);
}
function scheduledUnit(state = combatStart(), stance: SliceStance = 'ATTACK') {
  const random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor), context = beginCalamityDemonessCombatRound(state, stance, random);
  const remaining = { PLAYER: calamityDemonessActionCount(random.nextInt(1, 100)), ENEMY: calamityDemonessEnemyActionCount(random.nextInt(1, 100)) };
  const order = context.source.round % 2 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const, actors: ('PLAYER' | 'ENEMY')[] = [];
  while (remaining.PLAYER || remaining.ENEMY) for (const actor of order) if (remaining[actor]) { actors.push(actor); remaining[actor]--; }
  let index = 0;
  return { state, random, context, actors, next() {
    const actor = actors[index++]; if (!actor) throw new Error('No slot remains'); const count = context.playerActions.length + context.enemyActions.length;
    if (actor === 'PLAYER') resolveCalamityDemonessCombatAbility(state, drawCalamityDemonessAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context);
    else resolveCalamityDemonessEnemyAbility(state, drawCalamityDemonessEnemyAbility(random), 1 - statusPenalty(context.source.enemyHealth, 100), random, context);
    expect(context.playerActions.length + context.enemyActions.length).toBe(count + 1);
  } };
}
let roundCache: SliceState | undefined;
/** Public command replay from the explicitly directed helper, not the future natural capture. */
function publicRound(): SliceState { roundCache ??= applySliceIntent(combatStart(), { type: 'COMBAT_ROUND', stance: 'DEFEND' }); return structuredClone(roundCache); }

describe('Calamity Demoness paid finite combat and independent Iris', () => {
  it('requires a separate20p, three-charge original plate and does not heal or refill', () => {
    const before = practiced(); rejectCalamity(before, { type: 'ENCOUNTER_TALK' }); const s = cd(before, { type: 'PREPARE_ENCOUNTER' });
    expect(s.cash).toBe(before.cash - 20); expect([s.actionsRemaining, s.health, s.mind, s.spirituality]).toEqual([before.actionsRemaining, before.health, before.mind, before.spirituality]);
    expect(s.calamityDemoness.encounter.plate).toEqual({ id: 'CD2-COMBAT-PLATE', ownerId: 'PLAYER', quantity: 1, location: 'PLAYER', initialCharges: 3, charges: 3, paidPennies: 20 });
    expect(s.calamityDemoness.encounter.preparation).toMatchObject({ paidPennies: 20, initialCharges: 3, lifeJournalLength: before.calamityDemoness.life.journal.length }); rejectCalamity(s, { type: 'PREPARE_ENCOUNTER' }); assertValidSliceState(s);
  });
  it('retains six exact action-count slots, six player moves and five independently costed enemy moves', () => {
    expect(CALAMITY_DEMONESS_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL).toEqual(CALAMITY_DEMONESS_COUNT_WHEEL);
    expect([1, 10, 11, 25, 26, 50, 51, 75, 76, 90, 91, 100].map(calamityDemonessActionCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]); expect([1, 100].map(calamityDemonessEnemyActionCount)).toEqual([1, 6]);
    expect(calamityDemonessAbilityWheel(combatStart(), null).map(a => [a.id, a.weight])).toEqual([[SCREEN, 25], [FLAME, 20], [FROST, 20], ['STRIKE', 15], ['EVADE', 15], ['ACCIDENT', 5]]);
    expect(CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL.map(a => [a.id, a.weight])).toEqual([['FORCE_STRIKE', 35], ['GUARD', 25], ['BODY_STRIKE', 20], ['DISRUPT', 15], ['ACCIDENT', 5]]);
  });
  it('successful6S screen spends one charge immediately and reduces only the next actual BODY attack45', () => {
    const { round, state } = directedRound(o => o.playerActions.some(a => a.id === SCREEN && a.applied) && o.enemyActions.filter(a => a.attackKind === 'BODY').length >= 2), o = calamityOutcome(round), screen = o.playerActions.find(a => a.id === SCREEN && a.applied)!;
    expect(screen).toMatchObject({ attempted: true, succeeded: true, paidCost: 6, plateChargeSpent: 1, chargeGranted: true, enemyReduction: 45, appliedAmount: 45, threatens: false });
    const hit = o.enemyActions.find(a => a.order === screen.chargeConsumedByOrder)!; expect(hit).toMatchObject({ attackKind: 'BODY', consumedScreenOrder: screen.order }); expect(hit.order).toBeGreaterThan(screen.order);
    expect(o.enemyActions.filter(a => a.consumedScreenOrder === screen.order)).toHaveLength(1); expect(o.plateChargesSpent).toBe(1); expect(o.plateChargesAfter).toBe(2); expect(state.calamityDemoness.encounter.plate!.charges).toBe(2);
    expect(state.unagingDemoness.life.mirrorA).toEqual(combatStart().unagingDemoness.life.mirrorA); expect(state.unagingDemoness.encounter.enemyStatus).toBe('SURRENDERED');
  });
  it('failed screen still costs6S, does not spend durability and cannot retry that round', () => {
    const o = calamityOutcome(directedRound(x => x.playerActions.filter(a => a.id === SCREEN).length >= 2 && x.playerActions.some(a => a.id === SCREEN && a.attempted && !a.succeeded)).round), actions = o.playerActions.filter(a => a.id === SCREEN);
    expect(actions[0]).toMatchObject({ attempted: true, succeeded: false, paidCost: 6, plateChargeSpent: 0 }); for (const a of actions.slice(1)) expect(a).toMatchObject({ attempted: false, paidCost: 0, rolls: [], fallback: 'EVADE', enemyReduction: 10 });
    expect(o.plateChargesSpent).toBe(0); expect(o.plateChargesAfter).toBe(3);
  });
  it('paid3S DISRUPT cancels one pending screen without a BODY hit, charge refund or mirror repair', () => {
    const o = calamityOutcome(directedRound(x => x.playerActions.some(a => a.id === SCREEN && a.chargeCancelledByOrder !== null)).round), screen = o.playerActions.find(a => a.chargeCancelledByOrder !== null)!;
    expect(o.enemyActions.find(a => a.order === screen.chargeCancelledByOrder)).toMatchObject({ actual: 'DISRUPT', paidCost: 3, consumedScreenOrder: screen.order, attackKind: 'NONE', threatens: false, selfGain: 0 });
    expect(screen).toMatchObject({ paidCost: 6, plateChargeSpent: 1, applied: false, enemyReduction: 0, chargeConsumedByOrder: null }); expect(o.plateChargesAfter).toBe(2);
  });
  it('unused screen and guard expire at60seconds; costs remain and no pending shield survives', () => {
    const o = calamityOutcome(directedRound(x => x.expiredScreenOrder !== null).round); expect(o.playerActions.find(a => a.order === o.expiredScreenOrder)).toMatchObject({ paidCost: 6, plateChargeSpent: 1, chargeGranted: true, appliedAmount: 0 });
    expect(o).toMatchObject({ pendingScreenAfter: false, pendingGuardAfter: false, elapsedSeconds: 60, plateChargesAfter: 2 }); expect(o.clockSecondsAfter).toBe(o.source.clockSeconds + 60);
    const guard = calamityOutcome(directedRound(x => x.expiredGuardOrder !== null).round); expect(guard.enemyActions.find(a => a.order === guard.expiredGuardOrder)).toMatchObject({ paidCost: 4, appliedAmount: 0, enemyReduction: 0 });
  });
  it('zero actual plate charges cannot cast, recharge, replace the plate or consume original A/B', () => {
    const { round, state } = directedRound(o => o.playerActions.some(a => a.id === SCREEN), { charges: 0 }), o = calamityOutcome(round);
    for (const a of o.playerActions.filter(a => a.id === SCREEN)) expect(a).toMatchObject({ attempted: false, paidCost: 0, plateChargeSpent: 0, chargeGranted: false, rolls: [], fallback: 'EVADE' });
    expect(o.plateChargesAfter).toBe(0); expect(state.calamityDemoness.encounter.plate!.charges).toBe(0); expect(oldDemonessRoots(state)).toEqual(oldDemonessRoots(combatStart()));
  });
  it('the last single charge can be spent once and never falls below zero', () => {
    const o = calamityOutcome(directedRound(x => x.plateChargesSpent === 1, { charges: 1 }).round); expect(o.plateChargesAfter).toBe(0); expect(o.playerActions.filter(a => a.plateChargeSpent === 1)).toHaveLength(1);
  });
  it('successful flame is a real6S/K20 attack85×physical; failed attempts retain cost and cannot retry', () => {
    const o = calamityOutcome(directedRound(x => x.playerActions.some(a => a.id === FLAME && a.succeeded), { health: 70 }).round), a = o.playerActions.find(a => a.id === FLAME && a.succeeded)!;
    expect(a).toMatchObject({ attempted: true, paidCost: 6, physicalFactor: .95, selfGain: 85 * .95, appliedAmount: 85 * .95, threatens: true, mentalPressure: false });
    const failed = calamityOutcome(directedRound(x => x.playerActions.filter(a => a.id === FLAME).length >= 2 && x.playerActions.some(a => a.id === FLAME && a.attempted && !a.succeeded)).round), entries = failed.playerActions.filter(a => a.id === FLAME);
    expect(entries[0]).toMatchObject({ paidCost: 6, attempted: true, succeeded: false, selfGain: 0, threatens: false }); for (const later of entries.slice(1)) expect(later).toMatchObject({ paidCost: 0, attempted: false, fallback: 'EVADE', rolls: [] });
  });
  it('inherited frost retains its original mastery and costs6S/K18 for exactly35×mastery scale', () => {
    const o = calamityOutcome(directedRound(x => x.playerActions.some(a => a.id === FROST && a.succeeded)).round), a = o.playerActions.find(a => a.id === FROST && a.succeeded)!;
    expect(o.source.inheritedMastery[FROST]).toBe(combatStart().progression.mastery[FROST]); expect(a).toMatchObject({ paidCost: 6, attempted: true, applied: true, threatens: false });
    expect(a.enemyReduction).toBe(35 * (.65 + .35 * o.source.inheritedMastery[FROST]! / 500)); expect(a.appliedAmount).toBe(a.enemyReduction); expect(a.selfGain).toBe(0);
  });
  it.each(['STRIKE', FLAME] as const)('enemy4S GUARD reduces exactly one subsequent actual%s by40', id => {
    const o = calamityOutcome(directedRound(x => x.playerActions.some(a => a.id === id && a.consumedGuardOrder !== null)).round), a = o.playerActions.find(x => x.id === id && x.consumedGuardOrder !== null)!, guard = o.enemyActions.find(x => x.order === a.consumedGuardOrder)!;
    expect(guard).toMatchObject({ actual: 'GUARD', paidCost: 4, enemyReduction: 40, appliedAmount: 40, chargeConsumedByOrder: a.order }); expect(a.order).toBeGreaterThan(guard.order); expect(o.playerActions.filter(x => x.consumedGuardOrder === guard.order)).toHaveLength(1);
    if (id === FLAME) expect(a.selfGain).toBe(85 * a.physicalFactor);
  });
  it.each([120, 0])('full DEFEND with%s spirit disables all offensive flame/strike slots, including fallbacks', spirit => {
    const o = calamityOutcome(directedRound(x => x.playerActions.some(a => a.id === FLAME || a.id === 'STRIKE'), { stance: 'DEFEND', spirit }).round);
    for (const a of o.playerActions.filter(a => a.id === FLAME || a.id === 'STRIKE')) expect(a).toMatchObject({ paidCost: 0, attempted: false, selfGain: 0, threatens: false, fallback: 'HOLD_GUARD', rolls: [] });
    expect(o.playerActions.every(a => !a.threatens)).toBe(true);
  });
  it.each([SCREEN, FLAME, FROST] as const)('no spirit gives honest ordinary%s fallback with no check or charge use', id => {
    const o = calamityOutcome(directedRound(x => x.playerActions.some(a => a.id === id), { spirit: 0 }).round), a = o.playerActions.find(a => a.id === id)!;
    expect(a).toMatchObject({ attempted: false, paidCost: 0, plateChargeSpent: 0, rolls: [], fallback: id === FLAME ? 'STRIKE' : 'EVADE' }); expect(o.playerSpiritualityAfter).toBe(0);
    if (id === FLAME) expect(a.selfGain).toBe((o.source.clubHeld ? 16 : 12) * a.physicalFactor); else expect(a.enemyReduction).toBe(10);
  });
  it('a declared later source with its independent120S spent falls back to Iris’s actual rod', () => {
    const o = calamityOutcome(directedRound(x => x.enemyActions.some(a => a.planned === 'FORCE_STRIKE' || a.planned === 'GUARD'), { depletedEnemy: true }).round);
    for (const a of o.enemyActions.filter(a => a.planned === 'FORCE_STRIKE' || a.planned === 'GUARD')) expect(a).toMatchObject({ actual: 'BODY_STRIKE', attackKind: 'BODY', paidCost: 0, selfGain: 20 });
    expect(o.enemySpirituality).toBe(0); expect(o.source.powerUses).toEqual({ FORCE_STRIKE: 24, GUARD: 0, DISRUPT: 0 }); expect(o.powerUses).toEqual(o.source.powerUses);
  });
  it('ordinary BODY wounds, surrender and death are retained; no flame/screen revives anybody', () => {
    const hurt = directedRound((o, r) => r.winner === 'ENEMY' && r.consequenceRoll !== undefined && o.playerHealthAfter > 0), o = calamityOutcome(hurt.round), damage = hurt.round.consequenceRoll! <= hurt.round.consequenceWeights!.light ? 10 : 30;
    expect(hurt.state.health).toBe(o.source.playerHealth - damage); expect(hurt.state.mind).toBe(o.source.playerMind); expect(hurt.state.injuries.at(-1)!.severity).toBe(damage === 10 ? 'LIGHT' : 'HEAVY');
    const dead = directedRound((x, r) => r.winner === 'ENEMY' && x.playerHealthAfter === 0); expect(dead.outcome).toBe('PLAYER_DEAD'); expect(dead.round.consequenceDomain).toBe('BODY');
    const surrender = directedRound(o => o.enemyStatus === 'SURRENDERED'); expect(surrender.outcome).toBe('ENEMY_SURRENDERED'); expect(surrender.state.calamityDemoness.encounter.weaponLocation).toBe('YARD');
  });
  it.each(['SUCCESS', 'FAILURE'] as const)('actual RETREAT%s uses its prescribed draw and no offensive player slot', result => {
    const u = directedRound((_o, r) => r.retreat === result, { stance: 'RETREAT' }), o = calamityOutcome(u.round); expect(o.playerActions).toEqual([]); expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality);
    if (result === 'SUCCESS') { expect(u.outcome).toBe('RETREATED'); expect(o.continuing).toBe(false); } else expect(o.enemyActions.length).toBeGreaterThan(0);
  });
  it('continues with the same depleted plate, exact next cursor, and12S only for the player', () => {
    const u = directedRound(o => o.continuing && o.plateChargesSpent === 1), first = calamityOutcome(u.round), history = structuredClone(u.state.calamityDemoness.life.journal);
    u.state.combatHistory = [...u.state.combatHistory, u.round]; u.state.revision++;
    const nextSource = currentCalamityDemonessCombatSource(u.state)!; expect(nextSource.plateCharges).toBe(2); expect(nextSource.randomCursor).toBe(first.randomCursorAfter); expect(nextSource.enemySpirituality).toBe(first.enemySpirituality);
    const next = resolveCalamityDemonessCombatRound(u.state, 'DEFEND'), o = calamityOutcome(next.round); expect(validateCalamityDemonessCombatRound(next.round)).toBe(true); expect(o.source.plateCharges).toBe(2);
    expect(u.state.calamityDemoness.encounter.plate!.charges).toBe(2 - o.plateChargesSpent); expect(u.state.calamityDemoness.life.journal).toEqual(history);
  });
});

describe('Calamity Demoness strict direct scheduler and public continuity', () => {
  it('rejects skipped count draws and premature finish without mutation', () => {
    const state = combatStart(), random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor), r = beginCalamityDemonessCombatRound(state, 'ATTACK', random), before = structuredClone(state);
    resolveCalamityDemonessCombatAbility(state, SCREEN, 1, random, r); expect(state).toEqual(before); expect(random.cursor).toBe(before.random.cursor); expect(r.playerActions).toEqual([]); expect(() => finishCalamityDemonessCombatRound(state, r)).toThrow();
  });
  it('rejects wrong actor, arbitrarily selected ID, physical factor and extra draw before actual scheduled action', () => {
    const u = scheduledUnit(), { state, random, context: r } = u; expect(u.actors[0]).toBe('PLAYER'); const id = drawCalamityDemonessAbility(random, state, 'ATTACK'), before = structuredClone(state), cursor = random.cursor;
    const other: CalamityDemonessMoveId = id === SCREEN ? FLAME : SCREEN;
    resolveCalamityDemonessEnemyAbility(state, 'BODY_STRIKE', 1, random, r); resolveCalamityDemonessCombatAbility(state, other, 1, random, r); resolveCalamityDemonessCombatAbility(state, id, .5, random, r);
    const extra = new DeterministicActionRandomStream(random.seed, random.cursor + 1); resolveCalamityDemonessCombatAbility(state, id, 1, extra, r);
    expect(state).toEqual(before); expect(random.cursor).toBe(cursor); expect(r.playerActions).toEqual([]); expect(r.enemyActions).toEqual([]);
    resolveCalamityDemonessCombatAbility(state, id, 1, random, r); expect(r.playerActions).toHaveLength(1);
  });
  it('rejects forged source arguments and same-object context changes rather than treating reference equality as authority', () => {
    const u = scheduledUnit(), id = drawCalamityDemonessAbility(u.random, u.state, 'ATTACK'), before = structuredClone(u.state), cursor = u.random.cursor;
    for (const source of [null, { ...u.context.source, targetId: 'UD3-CORBIN' }, { ...u.context.source, enemyWeapon: 'COPY' }, { ...u.context.source, plateCharges: 3.5 }]) resolveCalamityDemonessCombatAbility(u.state, id, 1, u.random, u.context, source as CalamityDemonessCombatSource | null);
    expect(u.state).toEqual(before); expect(u.random.cursor).toBe(cursor); expect(u.context.playerActions).toEqual([]);
    u.context.source.playerSpirituality++; resolveCalamityDemonessCombatAbility(u.state, id, 1, u.random, u.context, u.context.source); expect(u.state).toEqual(before); expect(() => finishCalamityDemonessCombatRound(u.state, u.context)).toThrow();
    const stale = scheduledUnit(); stale.state.calamityDemoness.encounter.plate!.charges--; const changed = structuredClone(stale.state), drawn = drawCalamityDemonessAbility(stale.random, stale.state, 'ATTACK');
    resolveCalamityDemonessCombatAbility(stale.state, drawn, 1, stale.random, stale.context); expect(stale.state).toEqual(changed); expect(stale.context.playerActions).toEqual([]);
  });
  it('executes only exact counts/order/checks and rejects extra actions or finish before winner/consequence draws', () => {
    const u = scheduledUnit(); for (const _actor of u.actors) u.next();
    expect(u.context.playerActions).toHaveLength(u.actors.filter(a => a === 'PLAYER').length); expect(u.context.enemyActions).toHaveLength(u.actors.filter(a => a === 'ENEMY').length);
    const before = structuredClone(u.state), cursor = u.random.cursor; resolveCalamityDemonessCombatAbility(u.state, SCREEN, 1, u.random, u.context); resolveCalamityDemonessEnemyAbility(u.state, 'FORCE_STRIKE', 1, u.random, u.context);
    expect(u.state).toEqual(before); expect(u.random.cursor).toBe(cursor); expect(() => finishCalamityDemonessCombatRound(u.state, u.context, true, cursor)).toThrow();
    for (const [i, a] of [...u.context.playerActions, ...u.context.enemyActions].sort((a, b) => a.order - b.order).entries()) expect(a).toMatchObject({ order: i, elapsedSeconds: 5, atSeconds: u.context.source.clockSeconds + i * 5 });
  });
  it('public commands are deterministic, preserve their input and all seven historical roots', () => {
    const before = combatStart(), frozen = structuredClone(before), intent = { type: 'COMBAT_ROUND', stance: 'DEFEND' } as const, s = applySliceIntent(before, intent);
    expect(s).toEqual(applySliceIntent(before, intent)); expect(before).toEqual(frozen); expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(before)); expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.calamityDemoness.life).toEqual(before.calamityDemoness.life);
    expect(validateCalamityDemonessCombatRound(s.combatHistory.at(-1)!)).toBe(true); expect(validateCalamityDemonessLifeState(s)).toBe(true); expect(validateCalamityDemonessEncounter(s)).toBe(true); assertValidSliceState(s);
  });
  it('uses original25/30/30/15 core,1250/floor125 and independent spirituality with continuation-only12S', () => {
    const s = publicRound(), r = s.combatHistory.at(-1)!, o = calamityOutcome(r), x = o.source, sum = (a: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, entry) => n + entry[key], 0);
    expect(r.playerAdvantage).toBe(Math.max(125, baseAdvantage(x.physique * .25 + x.perception * .30 + x.will * .30 + x.knowledge * .15, x.playerHealth, x.playerMind, x.playerSpirituality, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction')));
    expect(r.enemyAdvantage).toBe(Math.max(125, baseAdvantage(20, x.enemyHealth, x.enemyMind, x.enemySpirituality, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction')));
    expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0)); expect(o.enemySpirituality).toBe(x.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(s.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter); expect(r.consequenceDomain).toBe('BODY');
    if (r.consequenceWeights) expect(r.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
  });
  it('the same original adults walk2m out before player4m entry, and peaceful exit is a real2m route', () => {
    const s = encounterReady(), e = s.calamityDemoness.encounter, start = e.startSite!, p = e.currentSite!;
    expect(p).toEqual(calamityDemonessApproachedSite(start, s.week)); expect(s.calamityDemoness.life.site).toEqual(start); expect(e.clearance).toMatchObject({ veraConsent: 'GRANTED', marcusConsent: 'GRANTED', elapsedSeconds: 8 });
    for (const id of ['vera', 'marcus'] as const) expect(p[id]).toMatchObject({ location: 'OUTSIDE', travelMetres: start[id]!.travelMetres + 2, energy: start[id]!.energy - 2 });
    expect(p).toMatchObject({ playerLocation: 'YARD', playerTravelMetres: start.playerTravelMetres + 4, playerEnergy: start.playerEnergy - 4, clockSeconds: start.clockSeconds + 8 });
    const left = cd(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.calamityDemoness.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: p.playerTravelMetres + 2, playerEnergy: p.playerEnergy - 2, clockSeconds: p.clockSeconds + 2 });
    expect(left.calamityDemoness.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' }); expect(left.calamityDemoness.encounter.plate!.charges).toBe(3);
    rejectCalamity(left, { type: 'ENCOUNTER_TALK' }); rejectCalamity(left, { type: 'PREPARE_ENCOUNTER' }); assertValidSliceState(left);
  });
  it('projects independent Iris45/S3, exact actual wheels, no allies and detached current plate/scene', () => {
    const s = publicRound(), frozen = structuredClone(s), p = projectCalamityDemonessCombat(s), start = projectSliceState(combatStart());
    expect(start.combat!.enemyCountWheel).toEqual(CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL); expect(start.combat!.enemyAbilityWheel).toEqual(CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL);
    expect(combatStart().calamityDemoness.encounter.startSource).toMatchObject({ targetId: 'CD2-IRIS', targetAge: 45, targetSequence: 3, enemyWeapon: 'CD2-IRIS-ROD', actualBody: true, independentMind: true, thirdPartiesInArea: 0, automaticAllyImmunity: false });
    expect(p.alliesPresent).toBe(0); expect(p.plate!.id).toBe('CD2-COMBAT-PLATE'); expect(projectCalamityDemonessLife(s).site).toEqual(s.calamityDemoness.encounter.currentSite);
    p.site!.playerEnergy--; p.powerUses!.GUARD++; p.plate!.charges++; p.lastActionSequence[0]!.paidCost++; expect(s).toEqual(frozen);
  });
});

const outcomeMutations: [string, (o: CalamityDemonessRoundOutcome) => void][] = [
  ['old enemy resurrected', o => { Object.assign(o.source, { targetId: 'UD3-CORBIN' }); }], ['wrong enemy age', o => { Object.assign(o.source, { targetAge: 46 }); }],
  ['copied rod', o => { Object.assign(o.source, { enemyWeapon: 'COPY' }); }], ['imaginary ally', o => { Object.assign(o.source, { thirdPartiesInArea: 1 }); }], ['ally immunity', o => { Object.assign(o.source, { automaticAllyImmunity: true }); }],
  ['source cursor', o => { o.source.randomCursor++; }], ['final cursor', o => { o.randomCursorAfter++; }], ['charge source', o => { o.source.plateCharges++; }], ['charge refund', o => { o.plateChargesAfter++; }], ['charge cost', o => { o.plateChargesSpent++; }],
  ['free preparation', o => { o.source.preparation.after.cash++; }], ['original mirror changed', o => { o.source.site.mirrorA!.intact = false; }], ['extra source field', o => { Object.assign(o.source, { freeShield: true }); }],
  ['health refund', o => { o.playerHealthAfter++; }], ['spirit refund', o => { o.playerSpiritualityAfter++; }], ['enemy refill', o => { o.enemySpirituality++; }], ['power use count', o => { o.powerUses.GUARD++; }],
  ['slot cost', o => { ordered(o)[0]!.paidCost++; }], ['slot order', o => { ordered(o)[0]!.order++; }], ['slot physical factor', o => { ordered(o)[0]!.physicalFactor = .5; }], ['slot cursor', o => { ordered(o)[0]!.randomCursorAfter++; }],
  ['slot check', o => { ordered(o)[0]!.rolls.push(1); }], ['slot clock', o => { ordered(o)[0]!.atSeconds++; }], ['slot gain', o => { ordered(o)[0]!.selfGain++; }], ['slot label', o => { ordered(o)[0]!.label += ' Free'; }],
  ['shield consumed twice', o => { ordered(o)[0]!.chargeConsumedByOrder = 999; }], ['shield cancel', o => { ordered(o)[0]!.chargeCancelledByOrder = 999; }], ['guard target', o => { ordered(o)[0]!.consumedGuardOrder = 999; }], ['screen target', o => { ordered(o)[0]!.consumedScreenOrder = 999; }],
  ['screen survives', o => { Object.assign(o, { pendingScreenAfter: true }); }], ['elapsed clock', o => { o.clockSecondsAfter++; }], ['extra outcome', o => { Object.assign(o, { immortal: true }); }],
];
describe('Calamity Demoness strict source/outcome/public-round evidence', () => {
  it.each(outcomeMutations)('rejects%s', (_name, mutate) => { const r = publicRound().combatHistory.at(-1)!; expect(validateCalamityDemonessCombatRound(r)).toBe(true); mutate(calamityOutcome(r)); expect(validateCalamityDemonessRoundOutcome(r.calamityDemonessOutcome)).toBe(false); expect(validateCalamityDemonessCombatRound(r)).toBe(false); });
  it('rejects altered public counts, order, winner, risk, advantages and narrative around a genuine nested outcome', () => {
    const changes: ((r: SliceCombatRound) => void)[] = [r => { r.playerCount++; }, r => { r.enemyCount++; }, r => { r.playerCountRoll++; }, r => { r.enemyCountRoll++; }, r => { r.first = r.first === 'PLAYER' ? 'ENEMY' : 'PLAYER'; },
      r => { r.playerAdvantage++; }, r => { r.enemyAdvantage++; }, r => { r.winChance++; }, r => { r.moves[0]!.selfGain++; }, r => { r.moves[0]!.label += ' Copy'; },
      r => { r.winner = r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'; }, r => { r.consequence += ' Free'; }, r => { Object.assign(r, { consequenceDomain: 'MIND' }); }, r => { Object.assign(r, { freeTurn: true }); }];
    for (const mutate of changes) { const r = publicRound().combatHistory.at(-1)!; mutate(r); expect(validateCalamityDemonessRoundOutcome(r.calamityDemonessOutcome)).toBe(true); expect(validateCalamityDemonessCombatRound(r)).toBe(false); }
  });
  it('cannot erase the new discriminator and launder the result as an old physical round', () => {
    const s = publicRound(), r = s.combatHistory.at(-1)!; delete r.calamityDemonessOutcome; if (s.lastCombatRound) delete s.lastCombatRound.calamityDemonessOutcome; if (s.combat?.lastRound) delete s.combat.lastRound.calamityDemonessOutcome;
    expect(validateCalamityDemonessCombatRound(r)).toBe(false); expect(validateCalamityDemonessEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects copied current/history mutations even when both aliases were changed to agree', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.calamityDemoness.encounter.plate!.charges++; }, s => { s.calamityDemoness.encounter.startSite!.playerEnergy++; },
      s => { s.calamityDemoness.encounter.startSource!.randomCursor++; }, s => { s.calamityDemoness.encounter.startSource!.inheritedMastery[FROST] = 500; }, s => { s.calamityDemoness.encounter.currentSite!.marcus!.location = 'ENTRY'; }, s => { s.calamityDemoness.encounter.currentSite!.playerTravelMetres++; },
      s => { s.calamityDemoness.encounter.enemySpirituality++; }, s => { s.calamityDemoness.encounter.enemyHealth--; }, s => { Object.assign(s.calamityDemoness.encounter.clearance!, { marcusConsent: 'WITHDRAWN' }); },
      s => { const o = s.combatHistory.at(-1)!.calamityDemonessOutcome!; o.source.preparation.after.cash++; s.calamityDemoness.encounter.preparation!.after.cash++; },
      s => { const source = s.calamityDemoness.encounter.startSource!; source.site.source!.snapshot.mirrorA.intact = false; source.site.mirrorA!.intact = false; },
    ];
    for (const mutate of changes) { const s = publicRound(); mutate(s); expect(validateCalamityDemonessLifeState(s) && validateCalamityDemonessEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  });
});
