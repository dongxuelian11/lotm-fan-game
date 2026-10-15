import { stableStringify } from '../../src/domain/canonical.js';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { createParasiteState } from '../../src/domain/parasite/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  applyParasiteEncounterCommand, parasiteEncounterReason, parasiteEncounterActions,
  validateParasiteEncounterCommand, validateParasiteEncounter, hasParasiteDisputeOpponent,
  createParasiteEncounterState, projectParasiteEncounter, PARASITE_POWERS,
} from '../../src/domain/parasite/encounter.js';

function context(roll = 1): SeerContext {
  return { note: vi.fn(), roll: min => min, check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
/** Directed encounter-only fixture; predecessor acquisition has separate tests. */
function available(): SliceState {
  const s = createSliceRun('parasite-encounter-directed', sliceDefaultCreationSelection, 'parasite-encounter');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 84; s.actionsRemaining = 4;
  s.progression = { pathwayId: 'error', sequence: 4, mastery: { 'error.s4.parasitism': 0, 'error.s4.deferred-thought': 0 }, acting: 0, promotionWeek: 84 };
  s.parasite = createParasiteState(); s.parasite.promotionWeek = 84; s.parasite.dreamStealerActingAtPromotion = 100;
  s.health = 100; s.mind = 100; s.spirituality = 87; s.arc.stage = 'ENDED'; return s;
}

describe('Finite optional original Ralf encounter', () => {
  it('accepts canonical key-sorted ordinary save reopen but rejects actual nested fact changes', () => {
    const ordinary = createSliceRun('parasite-canonical-ordinary', sliceDefaultCreationSelection, 'parasite-canonical');
    const restored = JSON.parse(stableStringify(ordinary)) as SliceState;
    expect(validateParasiteEncounter(ordinary)).toBe(true); expect(validateParasiteEncounter(restored)).toBe(true);
    expect(restored.parasite.encounter).toEqual(ordinary.parasite.encounter);
    for (const mutate of [(s: SliceState) => { s.parasite.encounter.enemyHealth = 99; },
      (s: SliceState) => { s.parasite.encounter.elapsedSeconds = 60; },
      (s: SliceState) => { s.parasite.encounter.weapon.location = 'YARD'; },
      (s: SliceState) => { s.parasite.encounter.observed = ['GUST']; }]) {
      const changed = structuredClone(restored); mutate(changed); expect(validateParasiteEncounter(changed)).toBe(false);
    }
  });
  it('creates fresh independent original bodies,weapon,ability records and finite32S', () => {
    const a = createParasiteEncounterState(), b = createParasiteEncounterState();
    a.observed.push('GUST'); expect(b.observed).toEqual([]); expect(b.enemySpirituality).toBe(32);
    expect(b.weapon).toEqual({ id: 'PR4-RALF-CLUB', owner: 'PR4-RALF-TOREN', location: 'HAND' });
    expect(b.borrowed).toEqual([]); expect(b.terminal).toBeNull();
    expect(PARASITE_POWERS.map(p => [p.cost, p.selfGain, p.enemyReduction])).toEqual([[4, 54, 0], [3, 0, 22], [3, 0, 18]]);
  });
  it('has no future original opponent identity or actions before promotion', () => {
    const s = available(); s.progression.sequence = 5;
    expect(projectParasiteEncounter(s)).toEqual({ encounter: null }); expect(parasiteEncounterActions(s)).toEqual([]);
  });
  it('strictly accepts only actual encounter and postbattle closure commands', () => {
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'RETURN_POWERS', 'WAIT_POWER_EXPIRY']) expect(validateParasiteEncounterCommand({ type })).toBe(true);
    for (const c of [null, [], {}, { type: 'POSSESS_TARGET' }, { type: 'ENCOUNTER_FIGHT', target: 'ANYONE' }, { type: 'RETURN_POWERS', refill: true }]) expect(validateParasiteEncounterCommand(c)).toBe(false);
  });
  it('peaceful settlement costs1AP,preserves all original resources and cannot replay', () => {
    const s = available(), old = structuredClone(s.fireThief), mastery = structuredClone(s.progression);
    applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.actionsRemaining).toBe(3); expect(s.spirituality).toBe(87); expect(s.parasite.encounter.status).toBe('RESOLVED');
    expect(s.parasite.encounter.enemyHealth).toBe(100); expect(s.parasite.encounter.enemySpirituality).toBe(32); expect(s.parasite.encounter.borrowed).toEqual([]);
    expect(s.combat).toBeNull(); expect(s.progression).toEqual(mastery); expect(s.fireThief).toEqual(old); expect(validateParasiteEncounter(s)).toBe(true);
    const before = structuredClone(s); expect(() => applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
  });
  it('failed ordinary talk keeps original refusal until next real week while fight is optional', () => {
    const s = available(); applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(s.actionsRemaining).toBe(3); expect(s.parasite.encounter.status).toBe('AVAILABLE'); expect(validateParasiteEncounter(s)).toBe(true);
    expect(parasiteEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toContain('本周'); expect(parasiteEncounterReason(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull();
    s.week++; expect(parasiteEncounterReason(s, { type: 'ENCOUNTER_TALK' })).toBeNull();
  });
  it('does not substitute an old ordinary enemy or erase predecessor death and loan history', () => {
    const s = available(); s.dreamStealer.encounter.status = 'RESOLVED'; s.dreamStealer.encounter.attemptWeek = 70;
    const old = structuredClone({ dream: s.dreamStealer, fire: s.fireThief, world: s.world });
    applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.combat?.encounterId).toBe('PARASITE_DISPUTE'); expect(s.actionsRemaining).toBe(3); expect(s.spirituality).toBe(87);
    expect(hasParasiteDisputeOpponent(s)).toBe(true); expect(validateParasiteEncounter(s)).toBe(true);
    expect({ dream: s.dreamStealer, fire: s.fireThief, world: s.world }).toEqual(old);
    expect(projectParasiteEncounter(s).encounter).toMatchObject({ name: '拉尔夫·托伦', age: 39, sequence: 6, pursuit: false });
  });
  it('open current or inherited actual contact and insufficient resources block arrival without mutation', () => {
    for (const mutate of [(s: SliceState) => { s.parasite.life.player.presence = 'INSIDE_HOST'; },
      (s: SliceState) => { s.dreamStealer.practice.targetPaused = true; },
      (s: SliceState) => { s.fireThief.loan.playerSteps = 1; },
      (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.world.city = 'TINGEN'; }]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyParasiteEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
  });
  it('public actions disclose actual AP and cannot close a nonexistent loan', () => {
    const s = available(), actions = parasiteEncounterActions(s);
    expect(actions.find(a => a.id === 'ENCOUNTER_FIGHT')).toMatchObject({ cost: '1行动', enabled: true });
    expect(actions.find(a => a.id === 'RETURN_POWERS')?.enabled).toBe(false);
    const before = structuredClone(s); expect(() => applyParasiteEncounterCommand(s, { type: 'WAIT_POWER_EXPIRY' }, context())).toThrow(); expect(s).toEqual(before);
  });
  it('validator rejects counterfeit body,weapon,spirituality and malformed nested loans without throwing', () => {
    for (const mutate of [(s: SliceState) => { s.parasite.encounter.enemySpirituality = 33; },
      (s: SliceState) => { s.parasite.encounter.targetId = 'COPY' as never; },
      (s: SliceState) => { s.parasite.encounter.weapon.owner = 'COPY' as never; },
      (s: SliceState) => { s.parasite.encounter.borrowed = [null] as never; },
      (s: SliceState) => { s.parasite.encounter.enemyInjuries = [null] as never; },
      (s: SliceState) => { s.parasite.encounter.enemyHealth = 0; }]) {
      const s = available(); mutate(s); expect(validateParasiteEncounter(s)).toBe(false);
    }
  });
});
