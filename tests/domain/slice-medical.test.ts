import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { consequenceWeights, nextLosingInjuryWeights } from '../../src/domain/slice/combat.js';
import { projectRecovery } from '../../src/domain/slice/medical.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const choose = (s: SliceState, choiceId: string) => applySliceIntent(s, {
  type: 'EVENT_CHOICE', eventInstanceId: projectSliceState(s).activeEvent!.instanceId, choiceId,
});
const rest = (s: SliceState) => applySliceIntent(s, { type: 'ACTION', action: 'REST' });
const investigate = (s: SliceState, targetId: string) => applySliceIntent(s, { type: 'ACTION', action: 'INVESTIGATE', targetId });
const recovery = (s: SliceState) => projectRecovery(s, projectSliceState(s));
/** Directed unit wounds only. No natural capture, random cursor, or completed history is modified. */
function wounded(): SliceState {
  const s = choose(createSliceRun('medical-directed', sliceDefaultCreationSelection, 'medical-public-actions'), '.decline');
  s.cash = 1000;
  s.injuries = [{ id: 'directed-heavy-1', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
  s.injuryRisk = 2;
  return s;
}
function invited(): SliceState { return rest(investigate(wounded(), 'CARE-ACCESS-01')); }
function aidAccepted(): SliceState {
  let s = wounded(); s.cash = 0; s.credit = 'SUSPENDED';
  s = rest(investigate(s, 'CARE-ACCESS-01'));
  expect(s.activeEvent?.id).toBe('CARE-WORK-OFFER');
  return choose(s, 'ACCEPT');
}
/** Same minimal directed promoted setup as chaos-hunter-combat.test.ts; TALK itself remains public. */
function beforeEncounter(): SliceState {
  const s = wounded();
  s.arc.stage = 'ENDED';
  s.progression = { pathwayId: 'justiciar', sequence: 3, mastery: {
    'justiciar.s9.combat-training': 0, 'justiciar.s5.wound-verdict': 0, 'justiciar.s4.intimidation': 0,
    'justiciar.s3.bounded-order': 0, 'justiciar.s4.deprivation': 0,
    'justiciar.s5.punishment': 0, 'justiciar.s8.trace-sensing': 0, 'justiciar.s6.prohibition': 0,
  }, acting: 0, promotionWeek: s.week };
  s.chaosHunter.guidanceKnown = true;
  s.chaosHunter.promotionWeek = s.week;
  s.chaosHunter.imperativeMageActingAtPromotion = 100;
  s.chaosHunter.life.cases['paired-line'].status = 'RESOLVED';
  s.spirituality = 120;
  s.town.clubLocation = 'SHOP';
  return s;
}
afterEach(() => vi.restoreAllMocks());

describe('shared read-only recovery projection and existing public medical route', () => {
  it('keeps historical rest prose while recovering actual resources and potion rejection at a week boundary', () => {
    const state = wounded();
    state.health = 91; state.mind = 94; state.spirituality = 12; state.seer.pollution = 7;
    state.actionsRemaining = 1;
    const next = rest(state);
    const result = next.chronicle.find(record => record.title === '完成休养');
    expect(next.health).toBe(100);
    expect(next.mind).toBe(100);
    expect(next.spirituality).toBe(14.25);
    expect(next.seer.pollution).toBe(0);
    expect(result?.text).toBe('健康91→100；精神100，灵性14.25。');
    expect(next.week).toBe(state.week + 1);
    expect(next.chronicle.some(record => record.title === '新的一周')).toBe(true);
    assertValidSliceState(next);
  });

  it('keeps an untreated heavy wound and accumulated risk after ordinary REST at H100', () => {
    const s = wounded(), before = JSON.stringify(s), next = rest(s);
    expect(next.health).toBe(100);
    expect(next.injuries).toEqual(s.injuries);
    expect(next.injuryRisk).toBe(2);
    expect(next.activeEvent).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
    const p = recovery(next);
    expect(p).toMatchObject({ stage: 'DISCOVER_CARE', healthFullWithInjuries: true, untreatedHeavyCount: 1, needsAttention: true });
    expect(p.summary).toContain('健康100仍不等于伤势痊愈');
    expect(p.nextAction).toMatchObject({ kind: 'INVESTIGATE', targetId: 'CARE-ACCESS-01', enabled: true });
    expect(p.nextLoss.weights).toEqual({ light: 35, heavy: 30, death: 35 });
  });

  it('discovers for1AP, pays60 for the original wounds, then heals only on a later REST', () => {
    let s = wounded();
    s.injuries.push({ id: 'directed-heavy-2', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null });
    const wounds = structuredClone(s.injuries), random = { ...s.random }, startingAp = s.actionsRemaining, startingCash = s.cash;
    s = investigate(s, 'CARE-ACCESS-01');
    expect(s.actionsRemaining).toBe(startingAp - 1);
    expect(s.cash).toBe(startingCash);
    expect(s.injuries).toEqual(wounds);
    expect(s.random).toEqual(random);
    expect(s.knowledge.at(-1)).toMatchObject({ title: '诊疗点已核实', text: '这处普通诊疗点提供普通伤口处置；本次没有治疗或收费。' });
    expect(recovery(s)).toMatchObject({ stage: 'CARE_READY', untreatedHeavyCount: 2 });
    expect(recovery(s).nextAction).toMatchObject({ kind: 'REST', enabled: true });
    s = rest(s);
    expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    expect(s.actionsRemaining).toBe(startingAp - 2);
    expect(recovery(s).actions.pay.enabled).toBe(true);
    const treatmentAp = s.actionsRemaining, treatmentRevision = s.revision + 1, treatmentCash = s.cash;
    s = choose(s, 'PAY');
    expect(s.cash).toBe(treatmentCash - 60);
    expect(s.actionsRemaining).toBe(treatmentAp);
    expect(s.injuries).toEqual(wounds.map(i => ({ ...i, treatedRevision: treatmentRevision })));
    expect(s.injuryRisk).toBe(2);
    expect(recovery(s)).toMatchObject({ stage: 'REST_TO_HEAL', treatedHeavyCount: 2, untreatedHeavyCount: 0 });
    s = rest(s);
    expect(s.health).toBe(100);
    expect(s.injuries).toEqual([]);
    expect(s.injuryRisk).toBe(0);
    expect(s.random).toEqual(random);
    expect(recovery(s)).toMatchObject({ stage: 'CLEAR', needsAttention: false });
    assertValidSliceState(s);
  });

  it('does not heal treated heavy wounds before a later REST reaches H80', () => {
    let s = wounded(); s.health = 50; s.injuries[0]!.treatedRevision = s.revision;
    s = rest(s); expect(s.health).toBe(62); expect(s.injuries).toHaveLength(1); expect(s.injuryRisk).toBe(2);
    s = rest(s); expect(s.health).toBe(74); expect(s.injuries).toHaveLength(1); expect(s.injuryRisk).toBe(2);
    s = rest(s); expect(s.health).toBe(86); expect(s.injuries).toHaveLength(0); expect(s.injuryRisk).toBe(0);
  });

  it('removes eligible light/treated wounds but retains risk while any untreated heavy remains', () => {
    let s = wounded();
    s.injuries.push(
      { id: 'directed-light', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null },
      { id: 'directed-treated', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: s.revision },
    );
    s = rest(s);
    expect(s.injuries.map(i => i.id)).toEqual(['directed-heavy-1']);
    expect(s.injuryRisk).toBe(2);
    expect(recovery(s).nextLoss.weights).toEqual(consequenceWeights(3));
  });

  it('declining suppresses the same-week invitation and the next week allows a fresh REST invitation', () => {
    let s = invited();
    const week = s.week;
    s = choose(s, 'DECLINE');
    expect(recovery(s)).toMatchObject({ stage: 'INVITED_THIS_WEEK', invitedThisWeek: true });
    expect(recovery(s).nextAction).toMatchObject({ kind: 'WAIT_WEEK', enabled: false });
    // This is the last AP of this week: REST itself does not reinvite, then the ordinary week pulse advances.
    s = rest(s);
    expect(s.activeEvent).toBeNull();
    expect(s.lastMedicalInviteWeek).toBe(week);
    expect(s.week).toBe(week + 1);
    expect(recovery(s)).toMatchObject({ stage: 'CARE_READY', invitedThisWeek: false });
    s = rest(s);
    expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    expect(s.injuries[0]!.treatedRevision).toBeNull();
    expect(s.injuryRisk).toBe(2);
  });

  it('reports pending aid investigation and the public failed-check/correction route truthfully', () => {
    let s = aidAccepted();
    expect(recovery(s)).toMatchObject({ stage: 'AID_CHECK', aidStatus: 'ACCEPTED' });
    expect(recovery(s).nextAction).toMatchObject({ kind: 'INVESTIGATE', targetId: 'CARE-WORK-CHECK', enabled: true });
    const beforeAp = s.actionsRemaining, beforeWeek = s.week;
    const roll = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockReturnValue(96);
    try { s = investigate(s, 'CARE-WORK-CHECK'); } finally { roll.mockRestore(); }
    expect(s.aid).toBe('CORRECT');
    expect(beforeAp).toBe(1); expect(s.week).toBe(beforeWeek + 1); expect(s.actionsRemaining).toBe(s.weeklyBudget);
    expect(s.injuries[0]!.treatedRevision).toBeNull();
    expect(recovery(s)).toMatchObject({ stage: 'AID_CORRECT', aidStatus: 'CORRECT' });
    // This original ordinary pulse advances directly; it does not invent a bill event.
    expect(s.activeEvent).toBeNull();
    expect(recovery(s).nextAction).toMatchObject({ targetId: 'CARE-WORK-CORRECT', enabled: true });
    s = investigate(s, 'CARE-WORK-CORRECT');
    expect(s.aid).toBe('DELIVERED');
    expect(s.cash).toBe(0);
    expect(s.injuries).toHaveLength(1);
    expect(s.injuries[0]!.treatedRevision).not.toBeNull();
    expect(recovery(s).stage).toBe('REST_TO_HEAL');
  });

  it('does not promise treatment through an invalid aid batch or unavailable clinic', () => {
    const s = aidAccepted(); s.world.aidBatchAvailable = false;
    expect(recovery(s)).toMatchObject({ stage: 'AID_UNAVAILABLE' });
    expect(recovery(s).actions.aid.enabled).toBe(false);
    expect(recovery(s).nextAction.enabled).toBe(false);
    const clinic = wounded(); clinic.careKnown = true; clinic.world.careAvailable = false;
    expect(recovery(clinic)).toMatchObject({ stage: 'CARE_UNAVAILABLE', careAvailable: false });
    expect(recovery(clinic).actions.rest.enabled).toBe(true);
    expect(recovery(clinic).guidance).toContain('不会解除未治疗重伤');
  });

  it('uses actual cash/credit choices and only promises wages when not yet paid this week', () => {
    let s = invited(); s.cash = 59;
    expect(recovery(s)).toMatchObject({ cashShortfall: 1 });
    expect(recovery(s).actions.pay.enabled).toBe(false);
    expect(recovery(s).actions.credit.enabled).toBe(true);
    s.credit = 'SUSPENDED';
    expect(recovery(s).actions.credit.enabled).toBe(false);
    s = choose(s, 'DECLINE');
    expect(recovery(s).workIncomeThisWeek).toBe(s.character.weeklyWage);
    s = applySliceIntent(s, { type: 'ACTION', action: 'WORK' });
    // That action ends week1; in week2 the wage is due again, so take its first work action too.
    s = applySliceIntent(s, { type: 'ACTION', action: 'WORK' });
    expect(recovery(s).actions.work.enabled).toBe(true);
    expect(recovery(s).workIncomeThisWeek).toBe(0);
  });

  it('does not advertise investigation or work at H/M zero while legal REST stays available', () => {
    for (const field of ['health', 'mind'] as const) {
      const s = wounded(); s[field] = 0;
      const p = recovery(s);
      expect(p.actions.discover.enabled).toBe(false);
      expect(p.actions.work.enabled).toBe(false);
      expect(p.actions.rest.enabled).toBe(true);
      expect(p.nextAction).toMatchObject({ kind: 'REST', enabled: true });
      expect(() => investigate(s, 'CARE-ACCESS-01')).toThrow();
    }
  });

  it('shares exact conditional risk based on accumulated risk, not wound count', () => {
    const s = wounded();
    for (const k of [0, 2, 6, 10]) {
      s.injuryRisk = k;
      for (const count of [1, 2, 4]) {
        s.injuries = Array.from({ length: count }, (_, n) => ({ id: `directed-${n}`, severity: 'HEAVY' as const, acquiredRevision: 1, treatedRevision: null }));
        expect(recovery(s).nextLoss.weights).toEqual(consequenceWeights(k + 1));
        expect(nextLosingInjuryWeights(s)).toEqual(consequenceWeights(k + 1));
      }
    }
    s.injuries = []; s.injuryRisk = 0;
    expect(recovery(s).nextLoss.weights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(recovery(s).nextLoss.label).toContain('败北进入伤势分支');
    expect(recovery(s).nextLoss.explanation).toContain('不是每回合死亡概率');
  });

  it('does not mutate state, wound identity, RNG, or history and its output is detached', () => {
    const s = wounded(), p = projectSliceState(s), before = JSON.stringify(s);
    const random = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(() => { throw new Error('Projection must not draw RNG'); });
    const first = projectRecovery(s, p), second = projectRecovery(s, p);
    expect(first).toEqual(second);
    expect(random).not.toHaveBeenCalled();
    first.nextLoss.weights.death = 99;
    first.nextAction.label = 'detached';
    expect(JSON.stringify(s)).toBe(before);
    expect(second.nextLoss.weights.death).toBe(35);
    expect('recovery' in s).toBe(false);
  });

  it('uses the already-derived public gate and cannot auto-exit a READY encounter', () => {
    const before = beforeEncounter();
    const s = applySliceIntent(before, { type: 'CHAOS_HUNTER', command: { type: 'ENCOUNTER_TALK' } });
    expect(s.chaosHunter.encounter.status).toBe('READY');
    const saved = JSON.stringify(s), p = projectSliceState(s), r = projectRecovery(s, p);
    expect(p.canAct).toBe(false);
    expect(r.locked).toBe(true);
    expect(r.blockedReason).toBe(p.actionBlockedReason);
    expect(r.actions.rest.enabled).toBe(false);
    expect(r.actions.discover.enabled).toBe(false);
    expect(r.actions.work.enabled).toBe(false);
    expect(r.nextAction.enabled).toBe(false);
    expect(() => rest(s)).toThrow();
    expect(JSON.stringify(s)).toBe(saved);
    expect(s.chaosHunter.encounter.scene.playerPosition).toBe('COURT');
    expect(s.chaosHunter.encounter.exitTravelMetres).toBe(0);
  });

  it('keeps the same conditional wheel in an active combat and disables ordinary recovery actions', () => {
    let s = applySliceIntent(beforeEncounter(), { type: 'CHAOS_HUNTER', command: { type: 'ENCOUNTER_TALK' } });
    s = applySliceIntent(s, { type: 'CHAOS_HUNTER', command: { type: 'ENCOUNTER_FIGHT' } });
    const p = projectSliceState(s), r = projectRecovery(s, p);
    expect(p.combat?.consequenceWeights).toEqual(r.nextLoss.weights);
    expect(r.actions.rest.enabled).toBe(false);
    expect(r.nextAction.enabled).toBe(false);
  });

  it('keeps dead saves read-only even if a caller accidentally supplies canAct=true', () => {
    const s = wounded(); s.status = 'DEAD'; s.health = 0;
    const before = JSON.stringify(s), r = projectRecovery(s, { canAct: true, actionBlockedReason: null });
    expect(r.locked).toBe(true);
    expect(r.blockedReason).toContain('只读封存');
    expect(r.actions.rest.enabled).toBe(false);
    expect(r.actions.discover.enabled).toBe(false);
    expect(r.actions.work.enabled).toBe(false);
    expect(r.nextAction.enabled).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('is a required public projection field and is never persisted into state', () => {
    const s = wounded(), p = projectSliceState(s);
    expect(p.recovery).toEqual(projectRecovery(s, p));
    expect('recovery' in s).toBe(false);
  });
});
