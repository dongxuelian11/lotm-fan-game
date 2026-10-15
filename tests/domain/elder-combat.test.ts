import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { projectElderCombat, currentElderCombatSource, validateElderRoundOutcome, validateElderCombatRound, elderAbilityWheel, beginElderCombatRound, resolveElderCombatAbility } from '../../src/domain/elder/combat.js';
import { createElderEncounterState, validateElderEncounter, projectElderEncounter, replayElderEncounterRoot } from '../../src/domain/elder/encounter.js';
import { replayElderLifeRoot } from '../../src/domain/elder/life.js';
import { resolveElderCombatRound } from '../../src/domain/slice/elder-combat.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { eg, promoted, recover, step, rejectElder } from './elder-directed-helper.js';

const H = 'THT3-HELENA', R = 'THT3-ROLAND', WHISPER = 'hanged-man.s2.low-whisper', CHORUS = 'hanged-man.s2.focused-chorus';
let closedCache: SliceState | undefined;
/** Explicit UNIT pre-journal budgets are in promoted(); all promotion, rest and
 * life commands below are real public commands, not a natural campaign fixture. */
function closedLife(): SliceState {
  if (!closedCache) {
    let s = recover(promoted());
    for (const caseId of ['sealed-whisper', 'single-chorus', 'interrupted-chorus'] as const) {
      for (const command of [
        { type: 'OBSERVE', caseId }, { type: 'CONSENT_OWNER', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
        { type: 'WALK', caseId, to: 'A' }, { type: 'TAKE_CARD', caseId }, { type: 'WALK', caseId, to: 'B' },
        { type: 'INSPECT_SEAL', caseId }, { type: 'INSTALL_SEAL', caseId }, { type: 'MANUAL_OPERATION', caseId },
        { type: 'REMOVE_SEAL', caseId }, { type: 'WALK', caseId, to: 'A' }, { type: 'RETURN_CARD', caseId },
        { type: 'WALK', caseId, to: 'START' }, { type: 'RETURN_ITEMS', caseId }, { type: 'INSPECT', caseId },
        { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
      ] as const) s = eg(s, command);
    }
    s = eg(s, { type: 'REFLECT' }); assertValidSliceState(s); closedCache = s;
  }
  return structuredClone(closedCache);
}
function ready(): SliceState { let s = eg(closedLife(), { type: 'PREPARE_ENCOUNTER' }); return eg(s, { type: 'ENCOUNTER_TALK' }); }
function fight(): SliceState { return eg(ready(), { type: 'ENCOUNTER_FIGHT' }); }

describe('Elder original-court encounter and physical combat', () => {
  it('walks the same adult out before combat, allows ordinary exit, and preserves old opponent and original inventory', () => {
    const source = closedLife(), oldEnemy = structuredClone(source.threeHeadedTemplar.encounter), spirits = structuredClone(source.threeHeadedTemplar.life.spirits), grazing = structuredClone(source.shepherd.grazing);
    rejectElder(source, { type: 'ENCOUNTER_FIGHT' }); const s = ready();
    expect(s.threeHeadedTemplar.life.owner).toEqual({ ...source.threeHeadedTemplar.life.owner, location: 'OUTSIDE' });
    expect(s.threeHeadedTemplar.life.playerLocation).toBe('A'); expect(s.threeHeadedTemplar.life.clockSeconds).toBe(source.threeHeadedTemplar.life.clockSeconds + 6);
    expect(s.threeHeadedTemplar.life.playerTravelMetres).toBe(source.threeHeadedTemplar.life.playerTravelMetres + 4);
    expect(s.threeHeadedTemplar.encounter).toEqual(oldEnemy); expect(s.threeHeadedTemplar.life.spirits).toEqual(spirits); expect(s.shepherd.grazing).toEqual(grazing);
    const p = projectElderEncounter(s); expect(p.enemy?.id).not.toBe(oldEnemy.targetId); expect(p.enemy?.pathway).toBe('warrior'); expect(p.enemy?.abilities).toEqual(['warrior.s3.silver-thrust', 'warrior.s3.silver-armor']);
    const left = eg(s, { type: 'LEAVE_ENCOUNTER' }); expect(left.elder.encounter.status).toBe('RESOLVED'); expect(left.threeHeadedTemplar.life.playerLocation).toBe('START'); expect(left.threeHeadedTemplar.life.owner.location).toBe('OUTSIDE');
    expect(left.threeHeadedTemplar.life.clockSeconds).toBe(source.threeHeadedTemplar.life.clockSeconds + 10); expect(left.threeHeadedTemplar.life.spirits).toEqual(spirits); assertValidSliceState(left);
    rejectElder(left, { type: 'ENCOUNTER_TALK' }); rejectElder(left, { type: 'PREPARE_ENCOUNTER' });
  });
  it('preserves inherited wheel ratios and proves each public combat round with finite costs and actual physical consequences', () => {
    let s = fight(); const old = structuredClone(s.threeHeadedTemplar.encounter), grazing = structuredClone(s.shepherd.grazing), originalSpirits = structuredClone(s.threeHeadedTemplar.life.spirits);
    const wheel = elderAbilityWheel(s, null); expect(wheel.map(a => a.weight / wheel[5]!.weight)).toEqual([6, 3, 4, 4, 2, 1, 4, 4]);
    let rounds = 0;
    while (s.combat && rounds++ < 30) {
      const before = structuredClone(s); s = step(s, { type: 'COMBAT_ROUND', stance: rounds % 2 ? 'PREPARE' : 'ATTACK' });
      const round = s.combatHistory.at(-1)!, o = round.elderOutcome!;
      expect(validateElderRoundOutcome(o)).toBe(true); expect(validateElderCombatRound(round)).toBe(true); expect(validateElderEncounter(s)).toBe(true); assertValidSliceState(s);
      expect(round.consequenceDomain).toBe('BODY'); expect(o.elapsedSeconds).toBe(60); expect(o.source.physique).toBe(before.character.coreStats.physique);
      expect(o.enemySpirituality).toBe(o.enemySpiritualityBefore - o.enemyActions.reduce((sum, a) => sum + a.paidCost, 0));
      expect(o.playerSpiritualityAfter).toBe(o.playerSpiritualityBefore - o.playerActions.reduce((sum, a) => sum + a.paidCost, 0));
      expect(o.playerMindAfter).toBe(o.source.playerMind - o.playerActions.reduce((sum, a) => sum + a.mindCost, 0));
      const spiritCosts = o.playerActions.filter(a => a.spirit); for (const id of [H, R] as const) expect(o.rootAfter.spirits[id].spirituality).toBe(o.source.root.spirits[id].spirituality - spiritCosts.filter(a => a.spirit!.id === id).length * 3);
      for (const a of spiritCosts) { expect(a.spirit!.id).toBe(R); expect(a.spirit!.method).toBe('STEADY_HOLD'); expect(a.spirit!.integrity).toBe(100); expect(a.paidCost).toBe(6); expect(a.mindCost).toBe(a.succeeded ? 2 : 4); }
      expect(o.rootAfter.spirits[H]).toEqual(originalSpirits[H]);
      for (const a of o.playerActions.filter(a => a.id === 'BODY_FOLLOWUP')) { expect(a.applied).toBe(a.selfGain > 0); expect(a.appliedAmount).toBe(a.selfGain); }
      for (const a of [...o.playerActions, ...o.enemyActions]) if (a.chargeGranted && a.chargeConsumedByOrder === null) { expect(a.applied).toBe(false); expect(a.appliedAmount).toBe(0); }
      expect(o.playerActions.filter(a => a.id === WHISPER && a.attempted).length).toBeLessThanOrEqual(1); expect(o.playerActions.filter(a => a.id === CHORUS && a.attempted).length).toBeLessThanOrEqual(1);
      expect(s.threeHeadedTemplar.encounter).toEqual(old); expect(s.shepherd.grazing).toEqual(grazing);
      if (round.consequenceRoll !== undefined) expect(round.consequence).toMatch(/身体|健康/);
    }
    expect(rounds).toBeLessThan(30); expect(s.elder.encounter.terminal).not.toBeNull(); expect(s.threeHeadedTemplar.life.owner.location).toBe('OUTSIDE');
  });
  it('rejects resource refills, restored original integrity, forged preparation bridges and fictional spirit source', () => {
    const s = fight(); expect(validateElderEncounter(s)).toBe(true);
    for (const mutate of [
      (q: SliceState) => { q.spirituality++; },
      (q: SliceState) => { q.threeHeadedTemplar.life.spirits[H].integrity = 100; },
      (q: SliceState) => { q.threeHeadedTemplar.life.spirits[H].interrupted = false; },
      (q: SliceState) => { q.elder.encounter.startSource!.playerSpirituality++; },
      (q: SliceState) => { q.elder.encounter.startRoot!.spirits[R].selectedAbilities.push('BRIEF_WARD'); },
      (q: SliceState) => { q.threeHeadedTemplar.encounter.enemyHealth = 100; },
      (q: SliceState) => { q.elder.encounter.startSource!.randomCursor--; },
    ]) { const q = structuredClone(s); mutate(q); expect(validateElderEncounter(q)).toBe(false); }
    const q = structuredClone(s), random = new DeterministicActionRandomStream(q.random.seed, q.random.cursor), context = beginElderCombatRound(q, 'ATTACK', random), before = structuredClone(q);
    expect(resolveElderCombatAbility(q, CHORUS, 1, random, context).selfGain).toBe(0); expect(q).toEqual(before);
    const reset = structuredClone(s); reset.elder.encounter = createElderEncounterState(); expect(replayElderEncounterRoot(reset, replayElderLifeRoot(reset)!)).not.toEqual(reset.threeHeadedTemplar.life);
  });
  it('replays finite directed round inputs through physical death, surrender, retreat and exhaustion without reviving spirits', () => {
    const base = fight(); let observedDeath = false, observedChorus = false, observedResisted = false, observedRetreat = false, observedFallback = false;
    // Isolated round-only UNIT seeds/resources, intentionally not submitted as complete saves.
    // The real promoted/life/preparation root is retained; each seeded source is explicitly
    // re-bound before beginning a new context, then the round itself must replay exactly.
    for (let n = 0; n < 128 && !(observedDeath && observedChorus && observedResisted && observedRetreat && observedFallback); n++) {
      const s = structuredClone(base); s.random.seed = `elder-combat-unit-${n}`; s.random.cursor = 0;
      s.elder.encounter.preparation!.randomSeed = s.random.seed; s.elder.encounter.preparation!.randomCursor = 0;
      if (n % 5 === 0) { s.spirituality = 0; s.elder.encounter.enemySpirituality = 0; s.elder.encounter.powerUses.SILVER_THRUST = 20; }
      if (n % 5 === 1) { s.health = 10; s.injuryRisk = 10; }
      s.elder.encounter.startSource = currentElderCombatSource(s)!;
      // A finite exhausted opponent source needs a later round with witnessed prior uses;
      // standalone replay rejects invented round-1 expenditures, so exercise player exhaustion only.
      if (n % 5 === 0) { s.elder.encounter.enemySpirituality = 120; s.elder.encounter.powerUses.SILVER_THRUST = 0; s.elder.encounter.startSource = currentElderCombatSource(s)!; }
      const stance: SliceStance = n % 7 === 0 ? 'RETREAT' : n % 2 ? 'PREPARE' : 'ATTACK';
      const result = resolveElderCombatRound(s, stance), o = result.round.elderOutcome!;
      expect(validateElderRoundOutcome(o)).toBe(true); expect(validateElderCombatRound(result.round)).toBe(true);
      observedDeath ||= result.outcome === 'PLAYER_DEAD'; observedRetreat ||= result.outcome === 'RETREATED';
      observedChorus ||= o.playerActions.some(a => a.spirit !== null); observedResisted ||= o.playerActions.some(a => a.resisted);
      observedFallback ||= o.playerActions.some(a => a.mode === 'ORDINARY_FALLBACK' || a.id === 'hanged-man.s4.flesh-soul-blade' && a.paidCost === 0);
      if (result.outcome === 'PLAYER_DEAD') { expect(s.health).toBe(0); expect(o.playerHealthAfter).toBe(0); expect(result.round.consequence).toMatch(/身体.*致命|健康降到0/); }
      expect(o.rootAfter.spirits[H]).toEqual(base.threeHeadedTemplar.life.spirits[H]);
      const forged = structuredClone(o); if (forged.playerActions.length) { forged.playerActions[0]!.appliedAmount++; expect(validateElderRoundOutcome(forged)).toBe(false); }
    }
    expect({ observedDeath, observedChorus, observedResisted, observedRetreat, observedFallback }).toEqual({ observedDeath: true, observedChorus: true, observedResisted: true, observedRetreat: true, observedFallback: true });
    expect(projectElderCombat(base).summary).not.toMatch(/G\b|候选|来源/);
  });
});
