import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateElderState } from '../../src/domain/elder/index.js';
import { createDarkAngelState, darkAngelInheritedView, validateDarkAngelSource, validateDarkAngelState } from '../../src/domain/dark-angel/index.js';
import { getDarkAngelCurrentSite, projectDarkAngelLife, validateDarkAngelLifeState } from '../../src/domain/dark-angel/life.js';
import { DARK_ANGEL_ABILITY_IDS, DARK_ANGEL_SOURCE_KEYS } from '../../src/domain/dark-angel/types.js';
import { da, elderNaturalPath, oldHangedManRoots, originalElder, promoted, rejectIntent, taught } from './dark-angel-directed-helper.js';

describe('Dark Angel actual615 inheritance and authoritative continuation', () => {
  it('pins the untouched615 bytes and raw176 while migrated format follows current constants', () => {
    expect(createHash('sha256').update(readFileSync(elderNaturalPath)).digest('hex')).toBe('06a23ce47295f72e78428f19d2559d6aab833dc978c58ce560f564c0e1d37b3a');
    const commands = readObjectEntry<SliceIntent[]>(elderNaturalPath, 'commands'), raw = readObjectEntry<SliceState>(elderNaturalPath, 'final'), before = structuredClone(raw);
    expect(commands).toHaveLength(615); expect(raw.schemaVersion).toBe(176);
    const s = migrateSliceState(raw); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.random).toEqual({ seed: 'secret-supplicant-natural-v051', cursor: 353 });
    for (const key of DARK_ANGEL_SOURCE_KEYS) expect(s[key], key).toEqual(raw[key]);
    expect(s.character).toEqual(raw.character); expect(s.injuries).toEqual(raw.injuries); expect(s.combatHistory).toEqual(raw.combatHistory); expect(raw).toEqual(before);
    expect(s.darkAngel).toEqual(createDarkAngelState()); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  }, 120_000);
  it('reconstructs the actual injured S2 source while clinic/rest heals only the live body', () => {
    const s = promoted(), before = structuredClone(s), source = s.darkAngel.sourceScene!, view = darkAngelInheritedView(s);
    expect(source.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 26, perception: 24, will: 27, knowledge: 23 } });
    expect(source.budget).toMatchObject({ sequence: 2, health: 60, mind: 94, spirituality: 118, acting: 100, injuryRisk: 1 });
    expect(source.budget.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['HEAVY', null]]);
    expect(s.injuries).toEqual([]); expect(s.health).toBeGreaterThan(60); expect(s.character.coreStats).toEqual({ physique: 27, perception: 25, will: 28, knowledge: 24 });
    expect(view.character).toEqual(source.character); expect(view.progression.sequence).toBe(2); expect(view.progression.mastery).toEqual(source.budget.mastery);
    expect(view.health).toBe(60); expect(view.injuries).toEqual(source.budget.injuries); expect(view.revision).toBe(source.revision); expect(view.random).toEqual(source.random);
    expect(validateElderState(view)).toBe(true); expect(view.darkAngel).toEqual(createDarkAngelState()); expect(s).toEqual(before); expect(view.elder).not.toBe(s.elder);
  }, 120_000);
  it('preserves all15 old mastery values, two zeros, eight histories and existing finite soul/flesh resources', () => {
    const original = originalElder(), s = promoted();
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(original)); expect(s.darkAngel.sourceHistory).toEqual(Object.fromEntries(DARK_ANGEL_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(Object.keys(original.progression.mastery)).toHaveLength(15); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(2);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of DARK_ANGEL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(s.darkAngel.elderActingAtPromotion).toBe(100);
    expect(s.darkAngel.encounter.grazing).toEqual(original.shepherd.grazing); expect(s.darkAngel.encounter.grazing).not.toBe(s.shepherd.grazing);
    expect(s.darkAngel.encounter.reserve).toEqual(original.roseBishop.reserve); expect(s.darkAngel.encounter.reserve).not.toBe(s.roseBishop.reserve);
    expect(s.darkAngel.sourceScene!.originals.site).toEqual(original.threeHeadedTemplar.life);
    expect(s.darkAngel.sourceScene!.originals.operation).toEqual(original.elder.life.operation);
    expect(s.combatHistory).toEqual(original.combatHistory); expect(validateDarkAngelSource(s)).toBe(true); expect(validateDarkAngelState(s)).toBe(true);
  }, 120_000);
  it('distinguishes actual current court and contained residual from old combat start snapshots; old enemies stay alive/retreated', () => {
    const s = promoted(), site = getDarkAngelCurrentSite(s);
    expect(site).toMatchObject({ siteId: 'THT3-SEALED-COURT', playerLocation: 'START', playerTravelMetres: 88, clockSeconds: 933,
      owner: { id: 'THT3-MARA', age: 51, alive: true, willing: true, location: 'OUTSIDE' }, card: { id: 'THT3-CARD', location: 'TABLE', travelMetres: 40 },
      lamp: { on: false, location: 'B' }, shutter: { state: 'CLOSED', controlAt: 'START', cordMetres: 8 } });
    expect(site.spirits['THT3-HELENA']).toMatchObject({ age: 54, sequence: 4, status: 'GRAZED', spirituality: 18, integrity: 60, location: 'INTERNAL', interrupted: true, travelMetres: 20, selectedAbilities: ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW'] });
    expect(site.spirits['THT3-ROLAND']).toMatchObject({ age: 61, sequence: 4, status: 'GRAZED', spirituality: 21, integrity: 100, location: 'INTERNAL', travelMetres: 8, selectedAbilities: ['SIGNAL', 'STEADY_HOLD', 'SCREEN'] });
    expect(s.darkAngel.life.operation).toMatchObject({ residualId: 'THT3-FAR-SEAL-RESIDUAL', residualPressure: 3, contained: true, sealWear: 5, focus: null, suppressedUntil: null });
    expect(s.darkAngel.life.operation.materials.map(m => [m.status, m.location, m.charges, m.spentCharges])).toEqual([['RETURNED', 'OWNER', 1, 1], ['RETURNED', 'OWNER', 1, 1], ['RETURNED', 'OWNER', 0, 2]]);
    expect(s.elder.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 90 });
    expect(s.darkAngel.encounter).toMatchObject({ targetId: 'DA1-EDGAR', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect('playerEnergy' in site).toBe(false);
  }, 120_000);
  it('shows actual prepromotion site/operation and only moves the new actual copy after consent', () => {
    const original = originalElder(); expect(projectDarkAngelLife(original).site).toEqual(original.threeHeadedTemplar.life); expect(projectDarkAngelLife(original).operation).toEqual(original.elder.life.operation);
    let s = promoted(); const roots = oldHangedManRoots(s), source = structuredClone(s.darkAngel.sourceScene!.originals);
    for (const command of [
      { type: 'OBSERVE', caseId: 'guided-reading' }, { type: 'CONSENT', caseId: 'guided-reading', permission: 'OWNER' },
      { type: 'PREPARE', caseId: 'guided-reading', method: 'ORDINARY' }, { type: 'WALK_TO_A', caseId: 'guided-reading' },
    ] as const) s = da(s, command);
    expect(getDarkAngelCurrentSite(s)).toMatchObject({ playerLocation: 'A', playerTravelMetres: 92, owner: { location: 'START' } }); expect(s.darkAngel.life.ownerTravelMetres).toBe(2);
    expect(oldHangedManRoots(s)).toEqual(roots); expect(s.darkAngel.sourceScene!.originals).toEqual(source);
    expect(s.threeHeadedTemplar.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 88, owner: { location: 'OUTSIDE' } }); expect(validateDarkAngelLifeState(s)).toBe(true);
  }, 120_000);
  it('closes every old acquisition, grazing, life and encounter action after guidance or promotion', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'ELDER', command: { type: 'BUY_POTION', bottleId: 'elder-potion-2' } },
        { type: 'ELDER', command: { type: 'OBSERVE', caseId: 'sealed-whisper' } },
        { type: 'ELDER', command: { type: 'ENCOUNTER_FIGHT' } },
        { type: 'THREE_HEADED_TEMPLAR', command: { type: 'REST_SPIRIT', spiritId: 'THT3-HELENA' } },
        { type: 'THREE_HEADED_TEMPLAR', command: { type: 'MEET_SPIRITS' } },
        { type: 'SHEPHERD', command: { type: 'REFLECT' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(originalElder()));
    }
  }, 120_000);
  it('rejects source substitution, invented mastery, refilled original souls/kits and erased historical consequences', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.coreStats.knowledge++; },
      s => { const id = Object.keys(s.progression.mastery).find(id => !DARK_ANGEL_ABILITY_IDS.includes(id as typeof DARK_ANGEL_ABILITY_IDS[number]) && s.progression.mastery[id] === 0)!; s.progression.mastery[id] = 8; },
      s => { s.progression.mastery[DARK_ANGEL_ABILITY_IDS[0]] = 8; },
      s => { s.threeHeadedTemplar.life.spirits['THT3-HELENA'].spirituality = 30; }, s => { s.threeHeadedTemplar.life.spirits['THT3-HELENA'].interrupted = false; },
      s => { s.elder.life.operation.materials[2]!.charges = 2; }, s => { s.elder.encounter.enemySpirituality = 120; },
      s => { s.darkAngel.sourceScene!.originals.site.playerTravelMetres = 0; }, s => { s.darkAngel.sourceScene!.originals.operation.sealWear = 0; },
      s => { s.darkAngel.sourceScene!.budget.health = 100; }, s => { s.darkAngel.sourceScene!.character.coreStats.knowledge++; },
      s => { s.darkAngel.sourceHistory!.threeHeadedTemplar.life.card.travelMetres++; }, s => { s.darkAngel.elderActingAtPromotion = 99; },
      s => { delete (s.darkAngel.sourceHistory as Partial<NonNullable<SliceState['darkAngel']['sourceHistory']>>).blackKnight; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateDarkAngelState(s), change.toString()).toBe(false); }
  }, 120_000);
  it('rejects future format, unsupported S0 and wrong pathway without rewriting history', () => {
    const s = promoted(); expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    for (const wrong of [{ ...s, progression: { ...s.progression, sequence: 0 as const } }, { ...s, progression: { ...s.progression, pathwayId: 'audience' as const } }]) {
      expect(validateDarkAngelState(wrong)).toBe(false); expect(() => assertValidSliceState(wrong)).toThrow();
    }
  }, 120_000);
});
