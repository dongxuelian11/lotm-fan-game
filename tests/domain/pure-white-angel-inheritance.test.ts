import { describe, expect, it, vi } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { projectBard, applyBardCommand } from '../../src/domain/bard/index.js';
import { projectLightprayer } from '../../src/domain/lightprayer/index.js';
import { projectSunpriest } from '../../src/domain/sunpriest/index.js';
import { projectNotary } from '../../src/domain/notary/index.js';
import { projectPriestOfLight } from '../../src/domain/priest-of-light/index.js';
import { projectUnshadowed } from '../../src/domain/unshadowed/index.js';
import { projectJusticeMentor } from '../../src/domain/justice-mentor/index.js';
import { projectLightSeeker, applyLightSeekerCommand } from '../../src/domain/light-seeker/index.js';
import { applyLightSeekerActivity, lightSeekerLifeActions } from '../../src/domain/light-seeker/life.js';
import { applyLightSeekerEncounterCommand } from '../../src/domain/light-seeker/encounter.js';
import { validatePureWhiteAngelState, pureWhiteAngelInheritedView } from '../../src/domain/pure-white-angel/index.js';
import { PURE_WHITE_ANGEL_ABILITY_IDS } from '../../src/domain/pure-white-angel/types.js';
import { originalLightSeeker, sunLegacyKeys, promoted, recoverResources } from './pure-white-angel-directed-helper.js';

const projectors = [projectBard, projectLightprayer, projectSunpriest, projectNotary, projectPriestOfLight, projectUnshadowed, projectJusticeMentor, projectLightSeeker];
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
describe('Pure White Angel exact eight-stage Sun inheritance', () => {
  it('preserves20 original mastery values and five zero entries with only two new zeros', () => {
    const old = originalLightSeeker(), s = promoted();
    for (const key of sunLegacyKeys) same(s[key], old[key]);
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id], id).toBe(value);
    expect(Object.keys(s.progression.mastery)).toHaveLength(22);
    expect(Object.values(old.progression.mastery).filter(v => v === 0)).toHaveLength(5);
    for (const id of PURE_WHITE_ANGEL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.character.name).toBe('塞琳'); expect(s.character.gender).toBe('FEMALE'); expect(s.character.age).toBe(26);
    same(s.combatHistory, old.combatHistory); assertValidSliceState(s);
  }, 180_000);
  it('retains original gallery wear, effort and the actual dead old opponent', () => {
    const old = originalLightSeeker(), s = promoted(), site = s.lightSeeker.life.site;
    same(site, old.lightSeeker.life.site);
    expect(site).toMatchObject({ elapsedSeconds: 976, playerMetres: 94, operatorLocation: 'SIDE', operatorMetres: 33,
      operatorEnergy: 90, spiritMetres: 18, spiritEnergy: 96, shutter: { state: 'OPEN', durability: 81, operations: 19 },
      lamp: { oil: 3 }, screen: { durability: 99, inspections: 1 }, light: { mode: 'OFF' } });
    expect(s.lightSeeker.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0, enemyStatus: 'DEAD' });
    expect(s.pureWhiteAngel.sourceScene!.budget.injuries).toEqual(old.injuries);
    expect(s.pureWhiteAngel.sourceScene!.budget.injuryRisk).toBe(3);
  }, 180_000);
  it('shows completed old histories while exact old practice actions remain closed', () => {
    const s = promoted();
    for (const project of projectors) expect(project(s), project.name).toMatchObject({ promoted: true, acting: 100, actions: [] });
    expect(lightSeekerLifeActions(s)).toEqual([]);
    s.pureWhiteAngel.lightSeekerActingAtPromotion = 99; expect(validatePureWhiteAngelState(s)).toBe(false);
  }, 180_000);
  it('rejects missing, additional, out-of-range and unexplained mastery', () => {
    for (const id of Object.keys(promoted().progression.mastery)) {
      const s = promoted(); delete s.progression.mastery[id]; expect(validatePureWhiteAngelState(s), id).toBe(false);
    }
    for (const value of [-1, 501, 0.5, NaN]) {
      const s = promoted(); s.progression.mastery[PURE_WHITE_ANGEL_ABILITY_IDS[0]] = value; expect(validatePureWhiteAngelState(s)).toBe(false);
    }
    for (const id of ['sun.s9.praise', ...PURE_WHITE_ANGEL_ABILITY_IDS]) {
      const s = promoted(); s.progression.mastery[id]!++; expect(validatePureWhiteAngelState(s)).toBe(false);
    }
    const extra = promoted(); extra.progression.mastery['sun.s1.invented'] = 0; expect(validatePureWhiteAngelState(extra)).toBe(false);
    const premature = originalLightSeeker(); premature.progression.mastery[PURE_WHITE_ANGEL_ABILITY_IDS[0]] = 0;
    expect(() => assertValidSliceState(premature)).toThrow();
  }, 180_000);
  it('preserves120 spirituality as an actual ceiling and requires ordinary recovery', () => {
    const before = promoted(), receipt = before.pureWhiteAngel.acquisitionJournal.at(-1)!;
    expect(receipt.after.spirituality).toBe(receipt.before.spirituality);
    const s = recoverResources(before); expect(s.spirituality).toBe(120); assertValidSliceState(s);
    s.spirituality = 121; expect(() => assertValidSliceState(s)).toThrow();
  }, 180_000);
  it('returns an independent frozenS2 view with original untreated wounds and unchanged identities', () => {
    const s = promoted(), before = stableStringify(s), view = pureWhiteAngelInheritedView(s);
    expect(view.progression.sequence).toBe(2); expect(Object.keys(view.progression.mastery)).toHaveLength(20);
    for (const key of sunLegacyKeys) same(view[key], s.pureWhiteAngel.sourceHistory![key]);
    same(view.character, s.pureWhiteAngel.sourceScene!.character); expect(view.health).toBe(50);
    expect(view.injuries).toHaveLength(3); expect(view.injuries.every(i => i.treatedRevision === null)).toBe(true);
    expect(stableStringify(s)).toBe(before);
    view.lightSeeker.life.site.operatorEnergy = 100; expect(s.lightSeeker.life.site.operatorEnergy).toBe(90);
  }, 180_000);
  it('rejects free oil, repaired original shutter, restored energy and unaudited movement', () => {
    const changes = [
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.lamp.oil++; },
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.shutter.durability = 100; },
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.operatorEnergy = 100; },
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.spiritEnergy = 100; },
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.operatorMetres = 0; },
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.playerLocation = 'FAR'; },
      (s: ReturnType<typeof promoted>) => { s.lightSeeker.life.site.cover.position = 'SCREEN'; },
    ];
    for (const change of changes) {
      const s = promoted(); change(s); expect(validatePureWhiteAngelState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
    }
  }, 180_000);
  it('rejects old direct acquisition, old practice and old encounter calls without mutation or random draws', () => {
    const s = promoted(), c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn(() => { throw Error('Unexpected check'); }) };
    for (const action of [
      () => applyBardCommand(s, { type: 'LEARN_GUIDANCE' }, c),
      () => applyLightSeekerCommand(s, { type: 'BUY_POTION', bottleId: s.lightSeeker.bottles[0]!.id }, c),
      () => applyLightSeekerActivity(s, { type: 'REFLECT' }, c),
      () => applyLightSeekerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, c),
    ]) {
      const before = stableStringify(s); expect(action).toThrow(); expect(stableStringify(s)).toBe(before);
    }
    expect(c.check).not.toHaveBeenCalled();
  }, 180_000);
});
