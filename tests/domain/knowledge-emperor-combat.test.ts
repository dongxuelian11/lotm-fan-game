import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { resolveKnowledgeEmperorCombatRound } from '../../src/domain/slice/knowledge-emperor-combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { KNOWLEDGE_EMPEROR_COUNT_WHEEL, KNOWLEDGE_EMPEROR_ENEMY_COUNT_WHEEL, KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL,
  KNOWLEDGE_POWER, POWER_KNOWLEDGE, knowledgeEmperorAbilityWheel, knowledgeEmperorActionCount, knowledgeEmperorEnemyActionCount,
  currentKnowledgeEmperorCombatSource, replayKnowledgeEmperorCombatRound, validKnowledgeEmperorCombatSource, validateKnowledgeEmperorCombatRound, validateKnowledgeEmperorRoundOutcome,
  type KnowledgeEmperorRoundOutcome } from '../../src/domain/knowledge-emperor/combat.js';
import { KNOWLEDGE_EMPEROR_POLICIES, validateKnowledgeEmperorEncounter, projectKnowledgeEmperorEncounter, blockKnowledgeEmperorEncounter,
  type KnowledgeEmperorPolicy } from '../../src/domain/knowledge-emperor/encounter.js';
import { KNOWLEDGE_EMPEROR_CASE_IDS } from '../../src/domain/knowledge-emperor/life.js';
import { originalSage, promoted, ke, ready, oldHermitRoots, rejectKnowledgeEmperor, rejectIntent } from './knowledge-emperor-directed-helper.js';

let practicedCache: SliceState | undefined;
/** Explicit pre-journal UNIT promotion comes from the migrated real651 fixture.
 * All practice, recovery, purchases, movement and battle below use public commands.
 * No combat seed/cursor is searched, replaced or replayed to select a victory. */
function practiced(): SliceState {
  if (!practicedCache) {
    let s = promoted();
    for (const caseId of KNOWLEDGE_EMPEROR_CASE_IDS) {
      while (s.knowledgeEmperor.life.site.playerEnergy < 24) s = ke(ready(s, { ap: 1, cash: 15 }), { type: 'RECOVER_ENERGY' });
      s = ke(s, { type: 'OBSERVE', caseId }); s = ke(s, { type: 'CONSENT', caseId, permission: 'OWNER' });
      if (caseId === 'withdrawn-consent') s = ke(s, { type: 'CONSENT', caseId, permission: 'ABILITY' });
      s = ke(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
      for (const type of ['APPROACH', 'WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'COPY_NOTE'] as const) s = ke(s, { type, caseId });
      if (caseId === 'knowledge-power') s = ke(s, { type: 'APPLY_POWER', caseId });
      else if (caseId === 'power-knowledge') s = ke(s, { type: 'VERIFY_REACTION', caseId });
      else s = ke(s, { type: 'WITHDRAW_CONSENT', caseId, permission: 'ABILITY' });
      for (const type of ['RETURN_TO_A', 'RETURN_TO_ENTRY', 'LEAVE', 'RETURN_NOTE', 'REPORT'] as const) s = ke(s, { type, caseId });
    }
    s = ke(s, { type: 'REFLECT' }); assertValidSliceState(s); practicedCache = s;
  }
  return structuredClone(practicedCache);
}
function combatStart(policy: KnowledgeEmperorPolicy = 'ALL'): SliceState {
  let s = practiced(); s = ready(s, { ap: 2, cash: 30 });
  s = ke(s, { type: 'PREPARE_ENCOUNTER' }); s = ke(s, { type: 'ENCOUNTER_TALK' });
  if (policy !== 'ALL') s = ke(s, { type: 'SET_COMBAT_POLICY', policy });
  s = ke(s, { type: 'ENCOUNTER_FIGHT' }); assertValidSliceState(s); return s;
}
function assertCostEvidence(o: KnowledgeEmperorRoundOutcome): void {
  const actions = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
  expect(actions.map(a => a.order)).toEqual(actions.map((_a, i) => i));
  for (const a of actions) { expect(a.elapsedSeconds).toBe(5); expect(a.atSeconds).toBe(o.source.clockSeconds + 5 * a.order); expect(a.randomCursorAfter).toBeGreaterThanOrEqual(a.randomCursorBefore); }
  expect(o.playerSpiritualityAfter).toBe(o.source.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(o.source.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.noteAfter.charges).toBe(o.source.note.charges - o.playerActions.reduce((n, a) => n + a.noteChargePaid, 0));
  expect(o.noteAfter.wear).toBe(o.source.note.wear + o.playerActions.reduce((n, a) => n + a.noteWearPaid, 0));
  expect(o.clockSecondsAfter).toBe(o.source.clockSeconds + 60);
  for (const a of o.playerActions.filter(a => a.id === KNOWLEDGE_POWER || a.id === POWER_KNOWLEDGE)) {
    expect([a.paidCost, a.mindCost]).toEqual(a.attempted ? [8, 2] : [0, 0]);
    expect(a.rolls).toHaveLength(a.attempted ? 1 : 0);
    if (a.applied) {
      expect(a.succeeded).toBe(true); expect(a.chargeConsumedByOrder).toBeGreaterThan(a.order);
      expect(a.appliedAmount).toBeGreaterThan(0); expect(a.appliedAmount).toBeLessThanOrEqual(a.id === KNOWLEDGE_POWER ? 35 : 30);
      const trigger = actions.find(v => v.order === a.chargeConsumedByOrder)!;
      expect(trigger.atSeconds).toBeLessThan(a.expiresAt!); expect(trigger.conditionVersion).toBe(a.conditionVersion);
      expect(a.masteryApplied).toEqual([a.id]); expect(trigger.consumedEffectOrders).toContain(a.order);
    } else expect(a.masteryApplied).toEqual([]);
    if (a.id === POWER_KNOWLEDGE && a.attempted) {
      expect(a.receipt).not.toBeNull(); expect(a.receipt!.atSeconds).toBeLessThan(a.atSeconds); expect(a.atSeconds - a.receipt!.atSeconds).toBeLessThan(20);
      const spent = o.enemyActions.find(e => e.markId === a.receipt!.markId)!;
      expect(spent).toBeDefined(); expect(spent.paidCost).toBe(7); expect(spent.actual).toBe(a.receipt!.power);
      if (a.applied) expect(o.enemyActions.find(e => e.order === a.chargeConsumedByOrder)!.actual).toBe(a.receipt!.power);
    }
  }
  for (const a of o.enemyActions.filter(a => a.actual === 'ARC_BOLT' || a.actual === 'DREAD_MARK')) {
    expect(a.paidCost).toBe(7); expect(a.markId).not.toBeNull(); expect(a.receipt).toMatchObject({ paidCost: 7, targetId: 'KE1-DARIAN', atSeconds: a.atSeconds });
    expect(o.marksAfter.find(m => m.id === a.markId)).toMatchObject({ status: 'SPENT', usedRound: o.round, usedOrder: a.order });
    expect(a.threatens).toBe(a.attackKind === 'BODY' && a.selfGain > 0); expect(a.mentalPressure).toBe(a.attackKind === 'MENTAL' && a.selfGain > 0);
  }
  for (const id of [KNOWLEDGE_POWER, POWER_KNOWLEDGE]) expect(o.masteryAfter[id]).toBe(Math.min(500, o.source.mastery[id]! + 8 * o.playerActions.filter(a => a.masteryApplied.includes(id)).length));
  for (const [id, value] of Object.entries(o.source.inheritedMastery)) expect(o.masteryAfter[id]).toBe(value);
}

describe('Knowledge Emperor finite original-resource combat', () => {
  it('uses migrated CURRENT format while retaining the authentic651 source and all eight roots', () => {
    const source = originalSage(); expect(source.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(source.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    const s = combatStart(), x = currentKnowledgeEmperorCombatSource(s)!;
    expect(oldHermitRoots(s)).toEqual(oldHermitRoots(source)); expect(x.originals.site).toEqual(source.sage.encounter.currentSite);
    expect(x.workshop).toEqual(source.scrollProfessor.workshop); expect(x.originals.workshop).toEqual(source.scrollProfessor.workshop);
    expect(x.targetId).toBe('KE1-DARIAN'); expect(x.targetName).toBe('达里安·洛克'); expect(x.targetAge).toBe(44); expect(x.enemyWeapon).toBe('KE1-DARIAN-ROD');
    expect(s.sage.encounter).toMatchObject({ targetId: 'SG2-MERRIN', status: 'RETREATED', enemySpirituality: 77, weaponLocation: 'HAND' });
    expect(x.site.iris).toMatchObject({ id: 'PM3-IRIS', location: 'OUTSIDE', energy: 54, travelMetres: 46 });
    expect(x.originals.site.iris).toMatchObject({ energy: 78, travelMetres: 22 }); expect(x.maxActionCount).toBe(6);
    expect(x.site.body).toBe('SOLID'); expect(x.site.form.active).toBe(false); expect(x.marks).toHaveLength(3); expect(x.note).toMatchObject({ id: 'KE1-COMBAT-NOTE', charges: 3, wear: 0 });
    expect(Object.keys(x.inheritedMastery)).toHaveLength(13); expect(validKnowledgeEmperorCombatSource(x)).toBe(true);
  }, 240_000);
  it('preserves Sage nine relative slots and truthful player/enemy count and ability wheels', () => {
    const s = combatStart(), wheel = knowledgeEmperorAbilityWheel(s, null);
    expect(KNOWLEDGE_EMPEROR_COUNT_WHEEL.map(a => a.weight)).toEqual([10, 15, 25, 25, 15, 10]); expect(KNOWLEDGE_EMPEROR_ENEMY_COUNT_WHEEL).toEqual(KNOWLEDGE_EMPEROR_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [26, 3], [51, 4], [76, 5], [91, 6], [100, 6]]) { expect(knowledgeEmperorActionCount(roll!)).toBe(count); expect(knowledgeEmperorEnemyActionCount(roll!)).toBe(count); }
    expect(wheel).toHaveLength(11); expect(wheel.map(a => Math.round(a.weight * 1.8))).toEqual([30, 15, 20, 15, 10, 5, 5, 20, 20, 20, 20]);
    expect(KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL.map(a => a.id)).toEqual(['ARC_BOLT', 'DREAD_MARK', 'WARD', 'BODY_STRIKE', 'FEINT', 'ACCIDENT']);
    expect(KNOWLEDGE_EMPEROR_ENEMY_ABILITY_WHEEL.reduce((n, a) => n + a.weight, 0)).toBe(100);
    const old = combatStart('INHERITED_ONLY'); expect(knowledgeEmperorAbilityWheel(old, null).map(a => a.id)).toEqual(wheel.slice(0, 9).map(a => a.id));
    const ordinary = combatStart('ORDINARY'); expect(knowledgeEmperorAbilityWheel(ordinary, null).map(a => a.id)).toEqual(['hermit.s6.scrollcraft', 'BODY_FOLLOWUP', 'BRIEF_WARD', 'ACCIDENT']);
  }, 240_000);
  it('records genuine30p/1AP acquisition and actual4m/2energy approach and peaceful exit', () => {
    let s = practiced(); const roots = oldHermitRoots(s), site = structuredClone(s.knowledgeEmperor.life.site), cash = s.cash, actions = s.actionsRemaining, cursor = s.random.cursor;
    s = ke(s, { type: 'PREPARE_ENCOUNTER' }); expect(s.cash).toBe(cash - 30); expect(s.actionsRemaining).toBe(actions - 1);
    s = ke(s, { type: 'ENCOUNTER_TALK' }); expect(s.knowledgeEmperor.encounter.currentSite).toMatchObject({ playerLocation: 'YARD', playerEnergy: site.playerEnergy - 2, playerTravelMetres: site.playerTravelMetres + 4, clockSeconds: site.clockSeconds + 4 });
    s = ke(s, { type: 'LEAVE_ENCOUNTER' }); expect(s.knowledgeEmperor.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: site.playerEnergy - 4, playerTravelMetres: site.playerTravelMetres + 8, clockSeconds: site.clockSeconds + 8 });
    expect(s.knowledgeEmperor.encounter.note).toMatchObject({ charges: 3, wear: 0 }); expect(s.knowledgeEmperor.encounter.enemySpirituality).toBe(120);
    expect(s.random.cursor).toBe(cursor); expect(oldHermitRoots(s)).toEqual(roots); expect(s.knowledgeEmperor.life.site).toEqual(site); expect(validateKnowledgeEmperorEncounter(s)).toBe(true); assertValidSliceState(s);
    rejectKnowledgeEmperor(s, { type: 'PREPARE_ENCOUNTER' }); rejectKnowledgeEmperor(s, { type: 'ENCOUNTER_TALK' });
  }, 240_000);
  it.each(KNOWLEDGE_EMPEROR_POLICIES)('replays fixed actual source under public %s policy without searching combat RNG', policy => {
    const s = combatStart(policy), roots = oldHermitRoots(s), source = currentKnowledgeEmperorCombatSource(s)!, cursor = s.random.cursor;
    const result = resolveKnowledgeEmperorCombatRound(s, 'ATTACK'), o = result.round.knowledgeEmperorOutcome!;
    expect(result).toEqual(replayKnowledgeEmperorCombatRound(source, 'ATTACK')); expect(validateKnowledgeEmperorCombatRound(result.round)).toBe(true); expect(validateKnowledgeEmperorRoundOutcome(o)).toBe(true);
    expect(source.randomCursor).toBe(cursor); expect(s.random.seed).toBe(source.randomSeed); expect(oldHermitRoots(s)).toEqual(roots); expect(s.scrollProfessor.workshop).toEqual(source.originals.workshop);
    assertCostEvidence(o);
    if (policy === 'ORDINARY') { expect(o.playerActions.every(a => a.paidCost === 0 && a.mindCost === 0 && a.rolls.length === 0)).toBe(true); expect(o.workshopAfter).toEqual(source.workshop); expect(o.noteAfter).toEqual(source.note); }
    if (policy === 'INHERITED_ONLY') expect(o.playerActions.every(a => a.id !== KNOWLEDGE_POWER && a.id !== POWER_KNOWLEDGE)).toBe(true);
    const core = source.physique * .10 + source.perception * .30 + source.will * .25 + source.knowledge * .35;
    expect(core).toBeCloseTo(26.2, 10); expect(result.round.playerAdvantage).toBeGreaterThanOrEqual(150);
    expect(o.siteAfter.body).toBe('SOLID'); expect(o.siteAfter.form.active).toBe(false); expect(o.siteAfter.playerEnergy).toBeGreaterThanOrEqual(2);
    expect(s.spirituality).toBe(result.outcome === 'CONTINUE' ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
  }, 240_000);
  it('executes unchanged-seed public rounds to actual retreat, surrender or death and validates terminal history', () => {
    let s = combatStart(); const roots = oldHermitRoots(s), seed = s.random.seed, originalWorkshop = structuredClone(s.scrollProfessor.workshop);
    for (let n = 0; s.combat && n < 60; n++) {
      s = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: n < 8 ? 'ATTACK' : 'RETREAT' });
      const round = s.combatHistory.at(-1)!; expect(validateKnowledgeEmperorCombatRound(round)).toBe(true); assertCostEvidence(round.knowledgeEmperorOutcome!);
      expect(validateKnowledgeEmperorEncounter(s)).toBe(true); assertValidSliceState(s); expect(oldHermitRoots(s)).toEqual(roots);
    }
    expect(s.combat).toBeNull(); expect(s.knowledgeEmperor.encounter.terminal).not.toBeNull(); expect(s.random.seed).toBe(seed); expect(s.scrollProfessor.workshop).toEqual(originalWorkshop);
    const e = s.knowledgeEmperor.encounter, t = e.terminal!;
    expect(e.currentSite?.playerLocation).toBe(t.outcome === 'PLAYER_DEAD' ? 'YARD' : 'OUTSIDE'); expect(t.exitMetres).toBe(t.outcome === 'PLAYER_DEAD' ? 0 : 4); expect(t.playerEnergyPaid).toBe(t.outcome === 'PLAYER_DEAD' ? 0 : 2);
    expect(e.weaponLocation).toBe(e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD'); expect(e.currentSite?.iris?.location).toBe('OUTSIDE');
    const privateSite = structuredClone(e.currentSite!);
    const publicSite = projectKnowledgeEmperorEncounter(s).site;
    expect(publicSite).toEqual({
      siteId: privateSite.siteId, introducedWeek: privateSite.introducedWeek, introducedDate: privateSite.introducedDate,
      clockSeconds: privateSite.clockSeconds, playerLocation: privateSite.playerLocation, playerTravelMetres: privateSite.playerTravelMetres,
      playerEnergy: privateSite.playerEnergy, formEnergySpent: privateSite.formEnergySpent, assimilationExposure: privateSite.assimilationExposure,
      body: privateSite.body, form: privateSite.form, iris: privateSite.iris, record: privateSite.record,
      conduit: privateSite.conduit, archive: privateSite.archive, materials: privateSite.materials, actorMoves: privateSite.actorMoves,
    });
    expect(publicSite).not.toHaveProperty('source');
    expect(e.currentSite).toEqual(privateSite); expect(e.currentSite!.source).toEqual(e.startSite!.source);
    expect(e.marks.filter(m => m.status === 'SPENT')).toHaveLength(e.powerUses.ARC_BOLT + e.powerUses.DREAD_MARK);
    expect(e.enemySpirituality).toBe(120 - 7 * (e.powerUses.ARC_BOLT + e.powerUses.DREAD_MARK) - 4 * e.powerUses.WARD - 3 * e.powerUses.FEINT);
  }, 240_000);
  it('rejects forged receipt, enemy refill, extra counts, note refill, spent originals and rewritten ordered RNG evidence', () => {
    const s = combatStart(), source = currentKnowledgeEmperorCombatSource(s)!;
    for (const alter of [
      (x: typeof source) => { x.maxActionCount = 7 as 6; },
      (x: typeof source) => { x.note.charges = 4; },
      (x: typeof source) => { x.enemySpirituality = 121; },
      (x: typeof source) => { x.marks[0]!.status = 'SPENT'; },
      (x: typeof source) => { x.targetId = 'SG2-MERRIN' as 'KE1-DARIAN'; },
      (x: typeof source) => { x.lastForceReceipt = { id: 'invented', targetId: 'KE1-DARIAN', power: 'ARC_BOLT', kind: 'BODY', markId: x.marks[0]!.id, paidCost: 7, round: 1, order: 0, atSeconds: x.clockSeconds + 5, position: 'YARD', visible: true, conditionVersion: 1 }; },
    ]) { const forged = structuredClone(source); alter(forged); expect(validKnowledgeEmperorCombatSource(forged)).toBe(false); expect(() => replayKnowledgeEmperorCombatRound(forged, 'ATTACK')).toThrow(); }
    const used = source.workshop.scrolls.find(v => v.status === 'USED');
    if (used) { const forged = structuredClone(source), v = forged.workshop.scrolls.find(v => v.id === used.id)!; v.status = 'HELD'; v.authorized = true; v.usedWeek = null; expect(validKnowledgeEmperorCombatSource(forged)).toBe(false); }
    const result = replayKnowledgeEmperorCombatRound(source, 'ATTACK');
    const mutations: ((r: SliceCombatRound) => void)[] = [r => { r.playerCount = 7; }, r => { r.knowledgeEmperorOutcome!.randomCursorAfter++; }, r => { r.knowledgeEmperorOutcome!.noteAfter.charges++; }, r => { r.knowledgeEmperorOutcome!.enemySpirituality++; }, r => { r.consequenceDomain = r.consequenceDomain === 'BODY' ? 'MENTAL' : 'BODY'; }, r => { const a = [...r.knowledgeEmperorOutcome!.playerActions, ...r.knowledgeEmperorOutcome!.enemyActions][0]!; a.paidCost++; }];
    for (const mutate of mutations) { const forged = structuredClone(result.round); mutate(forged); expect(validateKnowledgeEmperorCombatRound(forged)).toBe(false); }
  }, 240_000);
  it('closes old/S2/future/wrong-path actions and forbids fighting with an adult still inside', () => {
    const base = practiced();
    for (const sequence of [0, 2]) { const s = structuredClone(base); s.progression.sequence = sequence; expect(blockKnowledgeEmperorEncounter(s, { type: 'PREPARE_ENCOUNTER' })).not.toBeNull(); }
    const other = structuredClone(base); other.progression.pathwayId = 'demoness'; expect(blockKnowledgeEmperorEncounter(other, { type: 'PREPARE_ENCOUNTER' })).not.toBeNull();
    const inside = structuredClone(base); inside.knowledgeEmperor.life.site.iris!.location = 'ENTRY'; expect(blockKnowledgeEmperorEncounter(inside, { type: 'PREPARE_ENCOUNTER' })).not.toBeNull();
    rejectIntent(base, { type: 'SAGE', command: { type: 'PREPARE_ENCOUNTER' } }); rejectKnowledgeEmperor(base, { type: 'SET_COMBAT_POLICY', policy: 'OMNISCIENT' });
    const active = combatStart(); rejectKnowledgeEmperor(active, { type: 'RECOVER_ENERGY' }); rejectIntent(active, { type: 'ACTION', action: 'REST' });
  }, 240_000);
});
