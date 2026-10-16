import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { baseAdvantage, statusPenalty } from '../../src/domain/slice/combat.js';
import { resolveGloryCombatRound } from '../../src/domain/slice/glory-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceCombatRound, SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { GLORY_COUNT_WHEEL, GLORY_ENEMY_COUNT_WHEEL, GLORY_ENEMY_ABILITY_WHEEL, beginGloryCombatRound, currentGloryCombatSource,
  drawGloryAbility, drawGloryEnemyAbility, finishGloryCombatRound, gloryAbilityWheel, gloryActionCount, gloryEnemyActionCount,
  projectGloryCombat, resolveGloryCombatAbility, resolveGloryEnemyAbility, validateGloryCombatRound, validateGloryRoundOutcome,
  type GloryCombatSource, type GloryMoveId, type GloryRoundOutcome } from '../../src/domain/glory/combat.js';
import { gloryApproachedSite, validateGloryEncounter } from '../../src/domain/glory/encounter.js';
import { projectGloryLife, validateGloryLifeState } from '../../src/domain/glory/life.js';
import { ARMOR, BEARING, THRUST, encounterReady, gl, oldWarriorRoots, rejectGlory } from './glory-directed-helper.js';

let actualStartCache: SliceState | undefined, actualRoundCache: SliceState | undefined;
/** Actual lead-produced public continuation. Its inherited S3 origin remains DIRECTED. */
export function actualCombatStart(): SliceState {
  actualStartCache ??= migrateSliceState(JSON.parse(readFileSync('tests/fixtures/glory-v01760/snapshot-combatStart.json', 'utf8')));
  return structuredClone(actualStartCache);
}
function actualRound(): SliceState {
  actualRoundCache ??= applySliceIntent(actualCombatStart(), { type: 'COMBAT_ROUND', stance: 'DEFEND' });
  return structuredClone(actualRoundCache);
}
export const gloryOutcome = (r: SliceCombatRound): GloryRoundOutcome => { if (!r.gloryOutcome) throw new Error('Missing explicit Glory outcome.'); return r.gloryOutcome; };
const ordered = (o: GloryRoundOutcome) => [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
interface UnitOptions { stance?: SliceStance; health?: number; spirit?: number; armor?: number; depletedEnemy?: boolean }
/** SOURCE-ONLY unit boundary, never a persisted/whole-valid campaign. Only the cloned current
 * budget/cursor is varied; completed journals and original roots are immutable. Each adapter
 * round must independently replay all real draws, checks, costs and consequences. No arbitrary
 * chosen action IDs, scripted successes, new seeds or post-hoc outcome edits are used.
 * depletedEnemy declares an isolated later-round120S-spent source, not actual prior combat. */
function sourceUnit(base: SliceState, offset: number, options: UnitOptions): SliceState {
  const s: SliceState = { ...base, random: { ...base.random, cursor: base.random.cursor + offset }, injuries: structuredClone(base.injuries),
    character: { ...base.character, coreStats: { ...base.character.coreStats } }, progression: { ...base.progression, mastery: { ...base.progression.mastery } },
    combat: structuredClone(base.combat), glory: { ...base.glory, encounter: structuredClone(base.glory.encounter), life: { ...base.glory.life, site: structuredClone(base.glory.life.site) } } };
  if (options.health !== undefined) s.health = options.health;
  if (options.spirit !== undefined) s.spirituality = options.spirit;
  if (options.armor !== undefined) s.glory.life.site.armor!.integrity = options.armor;
  if (options.depletedEnemy) {
    // Retain the existing array unchanged; only its length is used by the direct API membership
    // gate. This is deliberately NOT asserted to have a matching whole encounter history.
    s.combat!.round = s.combatHistory.length + 1; s.glory.encounter.startHistoryIndex = 0;
    s.glory.encounter.enemySpirituality = 0; s.glory.encounter.powerUses = { FORCE_STRIKE: 24, GUARD: 0, DISCERN: 0 };
  }
  return s;
}
type UnitRound = ReturnType<typeof resolveGloryCombatRound> & { state: SliceState; cursor: number };
const scanCache = new Map<string, { base: SliceState; rounds: UnitRound[] }>();
/** At most256 deterministic source cursors per declared budget. Existing candidates are reused
 * across tests. This is bounded branch coverage, not a broad gameplay search or a natural run. */
export function directedCombatRound(wanted: (o: GloryRoundOutcome, r: SliceCombatRound) => boolean, options: UnitOptions = {}): UnitRound {
  const key = JSON.stringify(options); let cache = scanCache.get(key);
  if (!cache) { cache = { base: actualCombatStart(), rounds: [] }; scanCache.set(key, cache); }
  for (let i = 0; i < 256; i++) {
    if (!cache.rounds[i]) {
      const state = sourceUnit(cache.base, i, options), cursor = state.random.cursor;
      cache.rounds.push({ state, cursor, ...resolveGloryCombatRound(state, options.stance ?? 'ATTACK') });
    }
    const candidate = cache.rounds[i]!;
    if (wanted(gloryOutcome(candidate.round), candidate.round)) {
      expect(validateGloryRoundOutcome(candidate.round.gloryOutcome)).toBe(true); expect(validateGloryCombatRound(candidate.round)).toBe(true);
      return structuredClone(candidate);
    }
  }
  throw new Error(`No branch in256 unchanged-seed source cursors for ${key}; do not fabricate an outcome.`);
}

/** Actual next-slot scheduler for direct API rejection checks. The two counts and every action
 * ID come from the same deterministic stream in prescribed actor order. No slot is handpicked. */
export function scheduledGloryUnit(state = actualCombatStart(), stance: SliceStance = 'ATTACK') {
  const random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor), context = beginGloryCombatRound(state, stance, random);
  const remaining = { PLAYER: gloryActionCount(random.nextInt(1, 100)), ENEMY: gloryEnemyActionCount(random.nextInt(1, 100)) };
  const order = context.source.round % 2 ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const actors: ('PLAYER' | 'ENEMY')[] = [];
  while (remaining.PLAYER || remaining.ENEMY) for (const actor of order) if (remaining[actor]) { actors.push(actor); remaining[actor]--; }
  let index = 0;
  return { state, random, context, actors,
    next() {
      const actor = actors[index++]; if (!actor) throw new Error('No scheduled action remains.');
      const count = context.playerActions.length + context.enemyActions.length;
      if (actor === 'PLAYER') resolveGloryCombatAbility(state, drawGloryAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random, context);
      else resolveGloryEnemyAbility(state, drawGloryEnemyAbility(random), 1 - statusPenalty(context.source.enemyHealth, 100), random, context);
      expect(context.playerActions.length + context.enemyActions.length).toBe(count + 1);
    },
  };
}

describe('Glory exact finite deterministic battle rules', () => {
  it('retains six counts, six player slots,45/20/25/10 core and five exact enemy slots', () => {
    const s = actualCombatStart(); expect(GLORY_COUNT_WHEEL.map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(GLORY_ENEMY_COUNT_WHEEL).toEqual(GLORY_COUNT_WHEEL);
    expect([1, 10, 11, 25, 26, 50, 51, 75, 76, 90, 91, 100].map(gloryActionCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]); expect([1, 100].map(gloryEnemyActionCount)).toEqual([1, 6]);
    expect(gloryAbilityWheel(s, null).map(a => [a.id, a.weight])).toEqual([[ARMOR, 25], [BEARING, 20], [THRUST, 20], ['STRIKE', 15], ['EVADE', 15], ['ACCIDENT', 5]]);
    expect(GLORY_ENEMY_ABILITY_WHEEL.map(a => [a.id, a.weight])).toEqual([['FORCE_STRIKE', 35], ['GUARD', 25], ['BODY_STRIKE', 20], ['DISCERN', 15], ['ACCIDENT', 5]]);
  });
  it('successful paid armor applies45 only to one later actual BODY attack and wears the same armor5 once', () => {
    const { round, state } = directedCombatRound(o => o.armorWear === 5 && o.enemyActions.filter(a => a.attackKind === 'BODY').length >= 2), o = gloryOutcome(round);
    const armor = o.playerActions.find(a => a.id === ARMOR && a.applied)!;
    expect(armor).toMatchObject({ attempted: true, succeeded: true, paidCost: 6, healthPaid: 0, enemyReduction: 45, appliedAmount: 45, threatens: false });
    const hit = o.enemyActions.find(a => a.order === armor.chargeConsumedByOrder)!;
    expect(hit).toMatchObject({ attackKind: 'BODY', consumedArmorOrder: armor.order, armorWear: 5 }); expect(hit.order).toBeGreaterThan(armor.order);
    expect(o.enemyActions.filter(a => a.consumedArmorOrder === armor.order)).toHaveLength(1);
    expect(o.armorIntegrityAfter).toBe(o.source.armorIntegrity - 5); expect(state.glory.life.site.armor!.integrity).toBe(o.armorIntegrityAfter);
    expect(o.source.armorSource!.snapshot.integrity).toBe(65); expect(state.silverKnight.life.armor.integrity).toBe(65);
  });
  it('one failed paid armor attempt cannot be repurchased that round and never wears the armor', () => {
    const { round } = directedCombatRound(o => o.playerActions.filter(a => a.id === ARMOR).length >= 2 && o.playerActions.some(a => a.id === ARMOR && a.attempted && !a.succeeded)), o = gloryOutcome(round);
    const entries = o.playerActions.filter(a => a.id === ARMOR); expect(entries[0]).toMatchObject({ paidCost: 6, attempted: true, succeeded: false });
    for (const a of entries.slice(1)) expect(a).toMatchObject({ paidCost: 0, attempted: false, fallback: 'EVADE', rolls: [], enemyReduction: 10 });
    expect(o.armorWear).toBe(0); expect(o.armorIntegrityAfter).toBe(o.source.armorIntegrity);
  });
  it('paid DISCERN cancels exactly the pending armor window without BODY damage or armor wear', () => {
    const { round } = directedCombatRound(o => o.playerActions.some(a => a.id === ARMOR && a.chargeCancelledByOrder !== null)), o = gloryOutcome(round), armor = o.playerActions.find(a => a.id === ARMOR && a.chargeCancelledByOrder !== null)!;
    const discern = o.enemyActions.find(a => a.order === armor.chargeCancelledByOrder)!;
    expect(discern).toMatchObject({ actual: 'DISCERN', paidCost: 3, attackKind: 'NONE', consumedArmorOrder: armor.order, threatens: false, selfGain: 0 });
    expect(armor).toMatchObject({ chargeGranted: true, applied: false, enemyReduction: 0, appliedAmount: 0, chargeConsumedByOrder: null }); expect(o.armorWear).toBe(0);
  });
  it('unused paid armor and enemy guard expire after60 seconds without refunds or permanent charges', () => {
    const { round, state } = directedCombatRound(o => o.expiredArmorOrder !== null), o = gloryOutcome(round), armor = o.playerActions.find(a => a.order === o.expiredArmorOrder)!;
    expect(armor).toMatchObject({ paidCost: 6, chargeGranted: true, appliedAmount: 0, enemyReduction: 0 }); expect(o).toMatchObject({ pendingArmorAfter: false, pendingGuardAfter: false, elapsedSeconds: 60, armorWear: 0 });
    expect(o.clockSecondsAfter).toBe(o.source.clockSeconds + 60); expect(state.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
    const guard = gloryOutcome(directedCombatRound(x => x.expiredGuardOrder !== null).round);
    expect(guard.enemyActions.find(a => a.order === guard.expiredGuardOrder)).toMatchObject({ paidCost: 4, chargeGranted: true, enemyReduction: 0, appliedAmount: 0 }); expect(guard.pendingGuardAfter).toBe(false);
  });
  it.each([0, 4])('current same armor integrity%s falls back without check, free repair or formation', integrity => {
    const o = gloryOutcome(directedCombatRound(x => x.playerActions.some(a => a.id === ARMOR), { armor: integrity }).round);
    for (const a of o.playerActions.filter(a => a.id === ARMOR)) expect(a).toMatchObject({ attempted: false, paidCost: 0, rolls: [], fallback: 'EVADE', enemyReduction: 10, chargeGranted: false });
    expect(o.armorIntegrityAfter).toBe(integrity); expect(o.armorWear).toBe(0); expect(o.source.armorSource!.snapshot.integrity).toBe(65);
  });
  it('exactly5 remaining armor integrity can pay one actual wear and then remains0', () => {
    const o = gloryOutcome(directedCombatRound(x => x.armorWear === 5, { armor: 5 }).round);
    expect(o.source.armorIntegrity).toBe(5); expect(o.armorIntegrityAfter).toBe(0); expect(o.enemyActions.filter(a => a.armorWear > 0)).toHaveLength(1);
    expect(o.source.armorSource!.snapshot.integrity).toBe(65);
  });
  it('successful close guard costs6S and5H for30 defensive advantage without an imaginary ally or attack', () => {
    const { round, state } = directedCombatRound(o => o.playerActions.some(a => a.id === BEARING && a.succeeded)), o = gloryOutcome(round), a = o.playerActions.find(a => a.id === BEARING && a.succeeded)!;
    expect(a).toMatchObject({ attempted: true, paidCost: 6, healthPaid: 5, selfGain: 30, appliedAmount: 30, applied: true, threatens: false, mentalPressure: false });
    expect(a.playerHealthAfter).toBe(o.source.playerHealth - 5); expect(o.healthPaid).toBe(5); expect(o.source.thirdPartiesInArea).toBe(0); expect(projectGloryCombat(state).alliesPresent).toBe(0);
    expect(state.progression.mastery).toEqual(actualCombatStart().progression.mastery);
  });
  it('failed close guard still spends6S, pays no health and cannot retry that round', () => {
    const o = gloryOutcome(directedCombatRound(x => x.playerActions.filter(a => a.id === BEARING).length >= 2 && x.playerActions.some(a => a.id === BEARING && a.attempted && !a.succeeded)).round);
    const a = o.playerActions.filter(x => x.id === BEARING); expect(a[0]).toMatchObject({ attempted: true, succeeded: false, paidCost: 6, healthPaid: 0, selfGain: 0, threatens: false });
    for (const later of a.slice(1)) expect(later).toMatchObject({ attempted: false, paidCost: 0, healthPaid: 0, fallback: 'EVADE', rolls: [] }); expect(o.healthPaid).toBe(0);
  });
  it('H5 never casts close guard, while a genuine successful H6 source reachesH1 before consequences', () => {
    const five = gloryOutcome(directedCombatRound(o => o.playerActions.some(a => a.id === BEARING), { health: 5 }).round);
    for (const a of five.playerActions.filter(x => x.id === BEARING)) expect(a).toMatchObject({ attempted: false, paidCost: 0, healthPaid: 0, fallback: 'EVADE', rolls: [] });
    const six = gloryOutcome(directedCombatRound(o => o.playerActions.some(a => a.id === BEARING && a.succeeded), { health: 6 }).round);
    expect(six.playerActions.find(a => a.id === BEARING && a.succeeded)).toMatchObject({ playerHealthAfter: 1, healthPaid: 5, paidCost: 6, selfGain: 30, threatens: false });
  });
  it('paid enemy GUARD reduces exactly one subsequent ordinary strike by40', () => {
    const o = gloryOutcome(directedCombatRound(x => x.playerActions.some(a => a.id === 'STRIKE' && a.consumedGuardOrder !== null)).round);
    const strike = o.playerActions.find(a => a.id === 'STRIKE' && a.consumedGuardOrder !== null)!, guard = o.enemyActions.find(a => a.order === strike.consumedGuardOrder)!;
    expect(guard).toMatchObject({ actual: 'GUARD', paidCost: 4, appliedAmount: 40, enemyReduction: 40, chargeConsumedByOrder: strike.order });
    expect(o.playerActions.filter(a => a.consumedGuardOrder === guard.order)).toHaveLength(1); expect(strike.resisted).toBe(false);
  });
  it('paid enemy GUARD fully blocks one successful inherited silver thrust, with no extra40 counted', () => {
    const o = gloryOutcome(directedCombatRound(x => x.playerActions.some(a => a.id === THRUST && a.resisted)).round), thrust = o.playerActions.find(a => a.id === THRUST && a.resisted)!;
    const guard = o.enemyActions.find(a => a.order === thrust.consumedGuardOrder)!;
    expect(thrust).toMatchObject({ attempted: true, succeeded: true, paidCost: 6, selfGain: 0, appliedAmount: 0, applied: false, resisted: true, threatens: false });
    expect(guard).toMatchObject({ paidCost: 4, enemyReduction: 0, chargeConsumedByOrder: thrust.order });
    expect(guard.appliedAmount).toBe(76 * (.65 + .35 * o.source.inheritedMastery[THRUST]! / 500) * thrust.physicalFactor);
    expect(o.playerActions.filter(a => a.consumedGuardOrder === guard.order)).toHaveLength(1);
  });
  it('full DEFEND disables strike and inherited thrust for every slot, including unpaid fallback', () => {
    const o = gloryOutcome(directedCombatRound(x => x.playerActions.some(a => a.id === THRUST || a.id === 'STRIKE'), { stance: 'DEFEND', spirit: 0 }).round);
    for (const a of o.playerActions.filter(a => a.id === THRUST || a.id === 'STRIKE')) expect(a).toMatchObject({ attempted: false, paidCost: 0, selfGain: 0, threatens: false, fallback: 'HOLD_GUARD', rolls: [] });
    expect(o.playerActions.every(a => !a.threatens)).toBe(true); expect(o.playerSpiritualityAfter).toBe(0);
    const paid = gloryOutcome(directedCombatRound(x => x.playerActions.some(a => a.id === BEARING && a.succeeded), { stance: 'DEFEND' }).round);
    expect(paid.playerActions.every(a => !a.threatens)).toBe(true); expect(paid.playerActions.find(a => a.id === BEARING && a.succeeded)!.selfGain).toBe(30);
  });
  it.each([ARMOR, BEARING, THRUST] as const)('no spirituality gives the real ordinary%s fallback without a check', id => {
    const o = gloryOutcome(directedCombatRound(x => x.playerActions.some(a => a.id === id), { spirit: 0 }).round), a = o.playerActions.find(a => a.id === id)!;
    expect(a).toMatchObject({ attempted: false, paidCost: 0, healthPaid: 0, rolls: [], fallback: id === THRUST ? 'STRIKE' : 'EVADE' }); expect(o.playerSpiritualityAfter).toBe(0);
    if (id === THRUST) expect(a.selfGain).toBe((o.source.clubHeld ? 16 : 12) * a.physicalFactor); else expect(a.enemyReduction).toBe(10);
  });
  it('a declared source-only enemy with all120S actually spent falls back to the original club', () => {
    const o = gloryOutcome(directedCombatRound(x => x.enemyActions.some(a => a.planned === 'FORCE_STRIKE' || a.planned === 'GUARD'), { depletedEnemy: true }).round);
    for (const a of o.enemyActions.filter(a => a.planned === 'FORCE_STRIKE' || a.planned === 'GUARD')) expect(a).toMatchObject({ actual: 'BODY_STRIKE', attackKind: 'BODY', paidCost: 0, threatens: true, selfGain: 20 });
    expect(o.source.powerUses).toEqual({ FORCE_STRIKE: 24, GUARD: 0, DISCERN: 0 }); expect(o.enemySpirituality).toBe(0); expect(o.powerUses).toEqual(o.source.powerUses);
  });
  it('a real bodily wound is additional to personal guard5H, and a fatal roll still kills', () => {
    const hit = directedCombatRound((o, r) => r.winner === 'ENEMY' && o.healthPaid === 5 && r.consequenceRoll !== undefined && o.playerHealthAfter > 0), o = gloryOutcome(hit.round);
    const damage = hit.round.consequenceRoll! <= hit.round.consequenceWeights!.light ? 10 : 30;
    expect(hit.state.health).toBe(o.source.playerHealth - 5 - damage); expect(hit.state.mind).toBe(o.source.playerMind); expect(hit.state.injuries.at(-1)!.severity).toBe(damage === 10 ? 'LIGHT' : 'HEAVY');
    const dead = directedCombatRound((x, r) => r.winner === 'ENEMY' && x.playerHealthAfter === 0);
    expect(dead.outcome).toBe('PLAYER_DEAD'); expect(dead.state.health).toBe(0); expect(gloryOutcome(dead.round).continuing).toBe(false); expect(dead.round.consequenceDomain).toBe('BODY');
  });
  it('actual RETREAT succeeds or fails from its prescribed draw and never spends offensive player slots', () => {
    const successful = directedCombatRound((_o, r) => r.retreat === 'SUCCESS', { stance: 'RETREAT' });
    expect(successful.outcome).toBe('RETREATED'); expect(gloryOutcome(successful.round).playerActions).toEqual([]); expect(gloryOutcome(successful.round).continuing).toBe(false);
    const failed = directedCombatRound((_o, r) => r.retreat === 'FAILURE', { stance: 'RETREAT' });
    expect(gloryOutcome(failed.round).playerActions).toEqual([]); expect(gloryOutcome(failed.round).enemyActions.length).toBeGreaterThan(0); expect(gloryOutcome(failed.round).playerSpiritualityAfter).toBe(gloryOutcome(failed.round).source.playerSpirituality);
  });
  it('actual enemy bodily death leaves his own club at the body with spent finite spirituality', () => {
    const result = directedCombatRound(o => o.enemyStatus === 'DEAD'), o = gloryOutcome(result.round);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(result.state.glory.encounter).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD', weaponLocation: 'YARD' });
    expect(o.enemySpirituality).toBe(o.source.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0)); expect(o.continuing).toBe(false);
  });
  it('same-armor wear carries into the next actual source without editing old armor or the life journal', () => {
    const unit = directedCombatRound(o => o.armorWear === 5 && o.continuing), first = gloryOutcome(unit.round), journal = structuredClone(unit.state.glory.life.journal);
    // Continue this isolated source replay, not a fabricated campaign: adapter consumes the genuine
    // next stream; append only the round actually just generated and advance its commit revision.
    unit.state.combatHistory = [...unit.state.combatHistory, unit.round]; unit.state.revision++;
    const nextSource = currentGloryCombatSource(unit.state)!; expect(nextSource.armorIntegrity).toBe(first.armorIntegrityAfter); expect(nextSource.randomCursor).toBe(first.randomCursorAfter);
    const next = resolveGloryCombatRound(unit.state, 'DEFEND'), o = gloryOutcome(next.round);
    expect(validateGloryCombatRound(next.round)).toBe(true); expect(o.source.armorIntegrity).toBe(first.armorIntegrityAfter);
    expect(unit.state.glory.life.site.armor!.integrity).toBe(first.armorIntegrityAfter - o.armorWear); expect(unit.state.silverKnight.life.armor.integrity).toBe(65); expect(unit.state.glory.life.journal).toEqual(journal);
    expect(projectGloryLife(unit.state).currentArmorIntegrity).toBe(o.armorIntegrityAfter); expect(projectGloryCombat(unit.state).armor!.currentIntegrity).toBe(o.armorIntegrityAfter);
  });
});

describe('Glory strict direct slot API and actual public adapter', () => {
  it('requires both actual count draws before accepting a scheduled action', () => {
    const state = actualCombatStart(), random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor), r = beginGloryCombatRound(state, 'ATTACK', random), before = structuredClone(state);
    resolveGloryCombatAbility(state, ARMOR, 1 - statusPenalty(state.health, 100), random, r);
    expect(state).toEqual(before); expect(random.cursor).toBe(before.random.cursor); expect(r.playerActions).toEqual([]);
    expect(() => finishGloryCombatRound(state, r)).toThrow();
  });
  it('rejects a wrong actor, chosen ID, physical factor or extra cursor draw without committing costs', () => {
    const unit = scheduledGloryUnit(), { state, random, context: r } = unit; expect(unit.actors[0]).toBe('PLAYER');
    const id = drawGloryAbility(random, state, 'ATTACK'), before = structuredClone(state), cursor = random.cursor;
    const other: GloryMoveId = id === ARMOR ? BEARING : ARMOR;
    resolveGloryEnemyAbility(state, 'BODY_STRIKE', 1, random, r); resolveGloryCombatAbility(state, other, 1, random, r); resolveGloryCombatAbility(state, id, .5, random, r);
    expect(state).toEqual(before); expect(random.cursor).toBe(cursor); expect(r.playerActions).toEqual([]); expect(r.enemyActions).toEqual([]);
    const wrongCursor = new DeterministicActionRandomStream(random.seed, random.cursor + 1); resolveGloryCombatAbility(state, id, 1, wrongCursor, r); expect(state).toEqual(before);
    resolveGloryCombatAbility(state, id, 1 - statusPenalty(state.health, 100), random, r); expect(r.playerActions).toHaveLength(1);
  });
  it('binds context to its original source and rejects stale site resources or forged targets', () => {
    const u = scheduledGloryUnit(), id = drawGloryAbility(u.random, u.state, 'ATTACK'), before = structuredClone(u.state), cursor = u.random.cursor;
    for (const source of [null, { ...u.context.source, targetId: 'SK3-LORCAN' }, { ...u.context.source, enemyWeapon: 'COPY' }, { ...u.context.source, armorIntegrity: 100 }])
      resolveGloryCombatAbility(u.state, id, 1, u.random, u.context, source as GloryCombatSource | null);
    expect(u.state).toEqual(before); expect(u.random.cursor).toBe(cursor); expect(u.context.playerActions).toEqual([]);
    u.context.source.playerSpirituality++; resolveGloryCombatAbility(u.state, id, 1, u.random, u.context); expect(u.state).toEqual(before); expect(() => finishGloryCombatRound(u.state, u.context)).toThrow();
    const stale = scheduledGloryUnit(); stale.state.glory.life.site.playerEnergy--; const changed = structuredClone(stale.state);
    const drawn = drawGloryAbility(stale.random, stale.state, 'ATTACK'); resolveGloryCombatAbility(stale.state, drawn, 1, stale.random, stale.context); expect(stale.state).toEqual(changed); expect(stale.context.playerActions).toEqual([]);
  });
  it('executes only the prescribed counts/order/check stream; extra actions and incomplete finish fail', () => {
    const u = scheduledGloryUnit(); for (const _actor of u.actors) u.next();
    expect(u.context.playerActions.length).toBe(u.actors.filter(a => a === 'PLAYER').length); expect(u.context.enemyActions.length).toBe(u.actors.filter(a => a === 'ENEMY').length);
    const before = structuredClone(u.state), cursor = u.random.cursor;
    resolveGloryCombatAbility(u.state, ARMOR, 1, u.random, u.context); resolveGloryEnemyAbility(u.state, 'FORCE_STRIKE', 1, u.random, u.context);
    expect(u.state).toEqual(before); expect(u.random.cursor).toBe(cursor);
    // Final winner/consequence RNG has deliberately not yet been performed by this slot unit.
    expect(() => finishGloryCombatRound(u.state, u.context, true, u.random.cursor)).toThrow();
    for (const [i, a] of [...u.context.playerActions, ...u.context.enemyActions].sort((a, b) => a.order - b.order).entries()) expect(a).toMatchObject({ order: i, elapsedSeconds: 5, atSeconds: u.context.source.clockSeconds + i * 5 });
  });
  it('the actual public round replays identically, preserves input, inherited roots and life evidence', () => {
    const before = actualCombatStart(), frozen = structuredClone(before), intent = { type: 'COMBAT_ROUND', stance: 'DEFEND' } as const;
    const s = applySliceIntent(before, intent); expect(s).toEqual(applySliceIntent(before, intent)); expect(before).toEqual(frozen);
    expect(oldWarriorRoots(s)).toEqual(oldWarriorRoots(before)); expect(s.progression.mastery).toEqual(before.progression.mastery); expect(s.glory.life.journal).toEqual(before.glory.life.journal);
    expect(validateGloryCombatRound(s.combatHistory.at(-1)!)).toBe(true); expect(validateGloryLifeState(s)).toBe(true); expect(validateGloryEncounter(s)).toBe(true); assertValidSliceState(s);
  });
  it('reconstructs actual45/20/25/10 core,1250 tier,125 floor and continuation-only12S recovery', () => {
    const s = actualRound(), r = s.combatHistory.at(-1)!, o = gloryOutcome(r), x = o.source;
    const sum = (a: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, item) => n + item[key], 0);
    const core = x.physique * .45 + x.perception * .20 + x.will * .25 + x.knowledge * .10;
    expect(r.playerAdvantage).toBe(Math.max(125, baseAdvantage(core, x.playerHealth, x.playerMind, x.playerSpirituality, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction')));
    expect(r.enemyAdvantage).toBe(Math.max(125, baseAdvantage(20, x.enemyHealth, x.enemyMind, x.enemySpirituality, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction')));
    expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0)); expect(o.enemySpirituality).toBe(x.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(s.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter); expect(r.consequenceDomain).toBe('BODY'); expect(r.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
  });
  it('the two original adults walk out before same-armor dressing and actual yard entry; peaceful exit stays ordinary', () => {
    const s = encounterReady(), e = s.glory.encounter, start = e.startSite!, p = s.glory.life.site;
    expect(p).toEqual(gloryApproachedSite(start, s.week)); expect(e.clearance).toMatchObject({ celiaConsent: 'GRANTED', evanConsent: 'GRANTED', armorDressingSeconds: 4, elapsedSeconds: 16 });
    for (const id of ['celia', 'evan'] as const) expect(p[id]).toMatchObject({ location: 'OUTSIDE', travelMetres: start[id].travelMetres + 4, energy: start[id].energy - 4 });
    expect(p).toMatchObject({ playerLocation: 'YARD', playerTravelMetres: start.playerTravelMetres + 4, playerEnergy: start.playerEnergy - 4, clockSeconds: start.clockSeconds + 16, armorWorn: true, armor: { integrity: 60 } });
    const left = gl(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.glory.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: p.playerTravelMetres + 2, playerEnergy: p.playerEnergy - 2, clockSeconds: p.clockSeconds + 2 });
    expect(left.glory.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' }); rejectGlory(left, { type: 'ENCOUNTER_TALK' }); assertValidSliceState(left);
  });
  it('projects actual new enemy identity, real enemy wheels, no allies, current armor and detached actions', () => {
    const s = actualRound(), frozen = structuredClone(s), p = projectGloryCombat(s), start = projectSliceState(actualCombatStart());
    expect(start.combat!.enemyCountWheel).toEqual(GLORY_ENEMY_COUNT_WHEEL); expect(start.combat!.enemyAbilityWheel).toEqual(GLORY_ENEMY_ABILITY_WHEEL);
    expect(actualCombatStart().glory.encounter.startSource).toMatchObject({ targetId: 'GL2-MARTIN', targetAge: 45, targetSequence: 3, enemyWeapon: 'GL2-MARTIN-CLUB', actualBody: true, independentMind: true, thirdPartiesInArea: 0, automaticAllyImmunity: false });
    expect(p.armor).toMatchObject({ id: 'SK3-LIFE-ARMOR', historicalIntegrity: 65, currentIntegrity: 60 }); p.site!.playerEnergy--; p.powerUses!.GUARD++; p.lastActionSequence[0]!.paidCost++; expect(s).toEqual(frozen);
  });
});

const outcomeMutations: [string, (o: GloryRoundOutcome) => void][] = [
  ['original enemy substituted', o => { Object.assign(o.source, { targetId: 'SK3-LORCAN' }); }], ['enemy age', o => { Object.assign(o.source, { targetAge: 46 }); }],
  ['copied club', o => { Object.assign(o.source, { enemyWeapon: 'COPY' }); }], ['imaginary ally', o => { Object.assign(o.source, { thirdPartiesInArea: 1 }); }],
  ['ally immunity', o => { Object.assign(o.source, { automaticAllyImmunity: true }); }], ['source cursor', o => { o.source.randomCursor++; }],
  ['final cursor', o => { o.randomCursorAfter++; }], ['source armor', o => { o.source.armorIntegrity++; }], ['original armor ID', o => { Object.assign(o.source.armorSource!.snapshot, { id: 'COPY' }); }],
  ['armor current refill', o => { o.armorIntegrityAfter++; }], ['armor wear erased', o => { o.armorWear++; }], ['health refund', o => { o.playerHealthAfter++; }],
  ['spirit refund', o => { o.playerSpiritualityAfter++; }], ['enemy refill', o => { o.enemySpirituality++; }], ['health cost', o => { o.healthPaid++; }],
  ['slot paid cost', o => { ordered(o)[0]!.paidCost++; }], ['slot health cost', o => { ordered(o)[0]!.healthPaid++; }], ['slot physical factor', o => { ordered(o)[0]!.physicalFactor = .5; }],
  ['slot cursor', o => { ordered(o)[0]!.randomCursorAfter++; }], ['slot action order', o => { ordered(o)[0]!.order++; }], ['slot seconds', o => { ordered(o)[0]!.atSeconds++; }],
  ['slot extra check', o => { ordered(o)[0]!.rolls.push(1); }], ['slot narrative', o => { ordered(o)[0]!.label += ' Free shield'; }], ['slot advantage', o => { ordered(o)[0]!.selfGain++; }],
  ['slot armor wear', o => { ordered(o)[0]!.armorWear++; }], ['charge consumption', o => { ordered(o)[0]!.chargeConsumedByOrder = 999; }], ['charge cancellation', o => { ordered(o)[0]!.chargeCancelledByOrder = 999; }],
  ['guard consumption', o => { ordered(o)[0]!.consumedGuardOrder = 999; }], ['armor consumption', o => { ordered(o)[0]!.consumedArmorOrder = 999; }],
  ['pending survived', o => { Object.assign(o, { pendingArmorAfter: true }); }], ['enemy use count', o => { o.powerUses.GUARD++; }], ['elapsed clock', o => { o.clockSecondsAfter++; }],
  ['extra source field', o => { Object.assign(o.source, { freeArmor: true }); }], ['extra output field', o => { Object.assign(o, { permanentShield: 45 }); }],
];
describe('Glory strict source/outcome/public-round replay and live scene continuity', () => {
  it.each(outcomeMutations)('rejects %s', (_name, mutate) => {
    const r = actualRound().combatHistory.at(-1)!; expect(validateGloryCombatRound(r)).toBe(true); mutate(gloryOutcome(r)); expect(validateGloryRoundOutcome(r.gloryOutcome)).toBe(false); expect(validateGloryCombatRound(r)).toBe(false);
  });
  it('rejects every altered public round field even with an independently genuine nested outcome', () => {
    const changes: ((r: SliceCombatRound) => void)[] = [r => { r.playerCount++; }, r => { r.enemyCount++; }, r => { r.playerCountRoll++; }, r => { r.enemyCountRoll++; },
      r => { r.playerAdvantage++; }, r => { r.enemyAdvantage++; }, r => { r.winChance++; }, r => { r.moves[0]!.selfGain++; }, r => { r.moves[0]!.label += ' Copy'; },
      r => { r.winner = r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'; }, r => { r.consequence += ' Free'; }, r => { Object.assign(r, { consequenceDomain: 'MIND' }); }, r => { Object.assign(r, { freeTurn: true }); }];
    for (const mutate of changes) { const r = actualRound().combatHistory.at(-1)!; mutate(r); expect(validateGloryRoundOutcome(r.gloryOutcome)).toBe(true); expect(validateGloryCombatRound(r)).toBe(false); }
  });
  it('cannot remove the Glory discriminator to launder this as an old physical round', () => {
    const s = actualRound(), r = s.combatHistory.at(-1)!; delete r.gloryOutcome; if (s.lastCombatRound) delete s.lastCombatRound.gloryOutcome; if (s.combat?.lastRound) delete s.combat.lastRound.gloryOutcome;
    expect(validateGloryCombatRound(r)).toBe(false); expect(validateGloryEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects live armor refills, invented second positions, changed start lineage or current enemy resources', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.glory.life.site.armor!.integrity++; }, s => { s.glory.encounter.startSite!.armor!.integrity++; },
      s => { s.glory.encounter.startSource!.armorIntegrity++; }, s => { s.glory.encounter.startSource!.randomCursor++; }, s => { s.glory.life.site.evan.location = 'BENCH'; },
      s => { s.glory.life.site.playerTravelMetres++; }, s => { s.glory.encounter.enemySpirituality++; }, s => { s.glory.encounter.enemyHealth--; }, s => { Object.assign(s.glory.encounter.clearance!, { evanConsent: 'WITHDRAWN' }); }];
    for (const change of changes) { const s = actualRound(); change(s); expect(validateGloryLifeState(s) && validateGloryEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  });
});
