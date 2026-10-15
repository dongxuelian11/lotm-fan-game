import { describe, expect, it, vi } from 'vitest';
import { assertValidSliceState, applySliceIntent } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { projectCorpsecollector, applyCorpsecollectorCommand } from '../../src/domain/corpsecollector/index.js';
import { projectGravedigger } from '../../src/domain/gravedigger/index.js';
import { projectSpiritmedium } from '../../src/domain/spiritmedium/index.js';
import { projectSpiritGuide } from '../../src/domain/spirit-guide/index.js';
import { projectGatekeeper } from '../../src/domain/gatekeeper/index.js';
import { projectUndying } from '../../src/domain/undying/index.js';
import { projectFerryman } from '../../src/domain/ferryman/index.js';
import { projectDeathConsul, applyDeathConsulCommand } from '../../src/domain/death-consul/index.js';
import { deathConsulLifeActions, applyDeathConsulActivity } from '../../src/domain/death-consul/life.js';
import { applyDeathConsulEncounterCommand } from '../../src/domain/death-consul/encounter.js';
import { validatePaleEmperorState, paleEmperorInheritedView } from '../../src/domain/pale-emperor/index.js';
import { PALE_EMPEROR_ABILITY_IDS } from '../../src/domain/pale-emperor/types.js';
import { originalDeathConsul, promoted, originalDeathRoots, recoverResources, taught, rejectIntent } from './pale-emperor-directed-helper.js';
const projectors = [projectCorpsecollector, projectGravedigger, projectSpiritmedium, projectSpiritGuide, projectGatekeeper, projectUndying, projectFerryman, projectDeathConsul];
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
describe('Pale Emperor exact eight-stage and one-cycle inheritance', () => {
  it('keeps17 actual values and five originalzero entries, adding just twozeros', () => {
    const old = originalDeathConsul(), s = promoted(); same(originalDeathRoots(s), originalDeathRoots(old));
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(value);
    expect(Object.keys(s.progression.mastery)).toHaveLength(19); expect(Object.values(old.progression.mastery).filter(v => v === 0)).toHaveLength(5);
    for (const id of PALE_EMPEROR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.character).toMatchObject({ name: '伊莲', gender: 'FEMALE', age: 26 });
    same(s.combatHistory, old.combatHistory); same(s.longChapter, old.longChapter); same(s.undying.lifecycle, old.undying.lifecycle); assertValidSliceState(s);
  }, 300_000);
  it('retains actual originalVera, closedscarredjar, exhaustedseal and woundedNolan', () => {
    const old = originalDeathConsul(), s = promoted(); same(s.deathConsul, old.deathConsul);
    expect(s.deathConsul.life.site).toMatchObject({ playerLocation: 'ENTRY', operatorLocation: 'OUTSIDE', operatorEnergy: 94,
      door: { state: 'OPEN', operations: 17 }, residual: { location: 'ENTRY_STAND', strength: 1, container: 'CLOSED', seal: 'RESEALED', scorch: 1, heatSeconds: 0 }, material: { remaining: 0 } });
    expect(s.deathConsul.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 80, enemySpirituality: 46 });
    expect(s.deathConsul.encounter.enemyInjuries).toHaveLength(2);
    expect(s.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, status: 'RESISTING' } });
    expect(s.undying.lifecycle.experiencedCycles).toBe(1); same(s.longChapter.people, old.longChapter.people); same(s.longChapter.objects, old.longChapter.objects);
    expect(s.paleEmperor.sourceScene!.budget.injuries).toEqual(old.injuries); expect(s.paleEmperor.sourceScene!.budget.injuryRisk).toBe(6);
  }, 300_000);
  it('shows old completed histories without reopening predecessor practice', () => {
    const s = promoted();
    for (const project of projectors) {
      const view = project(s); expect(view, project.name).toMatchObject({ promoted: true, acting: 100 });
      if (project === projectFerryman) expect(view.actions.every(a => a.command.type.startsWith('ERA_'))).toBe(true);
      else expect(view.actions, project.name).toEqual([]);
    }
    const oldEnemy = projectDeathConsul(s).encounter;
    expect(oldEnemy).toMatchObject({ status: 'RETREATED', enemy: { health: 80, spirituality: 46, status: 'RESISTING' }, actions: [] });
    expect(oldEnemy.site).toEqual(s.deathConsul.life.site); expect(oldEnemy.startSite).toEqual(s.deathConsul.encounter.startSite);
    expect(oldEnemy.facts.length).toBeGreaterThan(0);
    expect(deathConsulLifeActions(s)).toEqual([]);
    s.paleEmperor.deathConsulActingAtPromotion = 99; expect(validatePaleEmperorState(s)).toBe(false);
    const frozen = taught(); rejectIntent(frozen, { type: 'DEATH_CONSUL', command: { type: 'REFLECT' } });
    expect(() => applySliceIntent(frozen, { type: 'DEATH_CONSUL', command: { type: 'ENCOUNTER_TALK' } })).toThrow('旧阶段履历已交接');
    rejectIntent(frozen, { type: 'DEATH_CONSUL', command: { type: 'ENCOUNTER_TALK' } });
  }, 300_000);
  it('rejects missing, extra, out-of-range or unexplained mastery', () => {
    for (const id of Object.keys(promoted().progression.mastery)) { const s = promoted(); delete s.progression.mastery[id]; expect(validatePaleEmperorState(s), id).toBe(false); }
    for (const value of [-1, 501, 0.5, NaN]) { const s = promoted(); s.progression.mastery[PALE_EMPEROR_ABILITY_IDS[0]] = value; expect(validatePaleEmperorState(s)).toBe(false); }
    for (const id of ['death.s8.spirit-contact', ...PALE_EMPEROR_ABILITY_IDS]) { const s = promoted(); s.progression.mastery[id]!++; expect(validatePaleEmperorState(s)).toBe(false); }
    const extra = promoted(); extra.progression.mastery['death.s1.invented'] = 0; expect(validatePaleEmperorState(extra)).toBe(false);
    const early = originalDeathConsul(); early.progression.mastery[PALE_EMPEROR_ABILITY_IDS[0]] = 0; expect(() => assertValidSliceState(early)).toThrow();
  }, 300_000);
  it('requires realpaid recovery and never refills current spirituality on promotion', () => {
    const s = promoted(), r = s.paleEmperor.acquisitionJournal.at(-1)!; expect(r.after.spirituality).toBe(r.before.spirituality);
    const healed = recoverResources(s); expect(healed.spirituality).toBe(120); assertValidSliceState(healed);
    healed.spirituality = 121; expect(() => assertValidSliceState(healed)).toThrow();
  }, 300_000);
  it('returns a detachedexactS2checkpoint, including frozen oldeconomic counters', () => {
    const s = promoted(), before = stableStringify(s), view = paleEmperorInheritedView(s);
    expect(view.progression.sequence).toBe(2); expect(Object.keys(view.progression.mastery)).toHaveLength(17);
    same(view.character, s.paleEmperor.sourceScene!.character); expect(view.health).toBe(20); expect(view.injuries).toHaveLength(4);
    expect(view.injuries.every(i => i.treatedRevision === null)).toBe(true); same(view.ferryman.era, s.paleEmperor.sourceScene!.budget.era);
    expect(stableStringify(s)).toBe(before); view.deathConsul.life.site.operatorEnergy = 100; expect(s.deathConsul.life.site.operatorEnergy).toBe(94);
  }, 300_000);
  it('rejects originalrefills, newcycles, changed historicpeople and returnedoldcontracts', () => {
    const changes = [
      (s: SliceState) => { s.deathConsul.life.site.material.remaining = 1; }, (s: SliceState) => { s.deathConsul.life.site.operatorEnergy = 100; },
      (s: SliceState) => { s.deathConsul.life.site.residual.scorch = 0; }, (s: SliceState) => { s.deathConsul.encounter.enemyHealth = 100; },
      (s: SliceState) => { s.longChapter.releasedSpiritDate = null; }, (s: SliceState) => { s.longChapter.departureDate = null; },
      (s: SliceState) => { s.undying.lifecycle.experiencedCycles = 0; }, (s: SliceState) => { s.ferryman.channels[0]!.provider.id = 'FR3-LEWIS'; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validatePaleEmperorState(s), change.toString()).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); }
  }, 300_000);
  it('rejects olddirect acquisition, practice and encounters without draws or mutations', () => {
    const s = promoted(), c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn(() => { throw Error('Unexpected check'); }) };
    for (const action of [
      () => applyCorpsecollectorCommand(s, { type: 'LEARN_GUIDANCE' }, c),
      () => applyDeathConsulCommand(s, { type: 'BUY_POTION', bottleId: s.deathConsul.bottles[0]!.id }, c),
      () => applyDeathConsulActivity(s, { type: 'REFLECT' }, c),
      () => applyDeathConsulEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, c),
    ]) { const before = stableStringify(s); expect(action).toThrow(); expect(stableStringify(s)).toBe(before); }
    expect(c.check).not.toHaveBeenCalled();
  }, 300_000);
});
