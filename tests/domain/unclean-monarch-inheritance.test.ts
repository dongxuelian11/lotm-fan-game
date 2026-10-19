import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateBloodDukeState } from '../../src/domain/blood-duke/index.js';
import { createUncleanMonarchState, uncleanMonarchInheritedView, validateUncleanMonarchSource, validateUncleanMonarchState } from '../../src/domain/unclean-monarch/index.js';
import { getUncleanMonarchCurrentSite, projectUncleanMonarchLife, validateUncleanMonarchLifeState } from '../../src/domain/unclean-monarch/life.js';
import { UNCLEAN_MONARCH_ABILITY_IDS, UNCLEAN_MONARCH_SOURCE_KEYS } from '../../src/domain/unclean-monarch/types.js';
import { um, bloodDukeNaturalPath, bloodDukeLivingBoundaryPath, oldAbyssRoots, originalBloodDuke, promoted, rejectIntent, taught } from './unclean-monarch-directed-helper.js';

describe('Unclean Monarch actual living718 inheritance and authoritative continuation', () => {
  it('pins untouched raw177718 boundary separately from current migration and leaves both historical deaths terminal', () => {
    expect(createHash('sha256').update(readFileSync(bloodDukeNaturalPath)).digest('hex')).toBe('7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363');
    expect(createHash('sha256').update(readFileSync(bloodDukeLivingBoundaryPath)).digest('hex')).toBe('c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c');
    const commands = readObjectEntry<SliceIntent[]>(bloodDukeNaturalPath, 'commands'), terminal = readObjectEntry<SliceState>(bloodDukeNaturalPath, 'final');
    const raw = readObjectEntry<SliceState>(bloodDukeLivingBoundaryPath, 'beforeLast'), before = structuredClone(raw);
    expect(commands).toHaveLength(724); expect(terminal.status).toBe('DEAD'); expect(terminal.health).toBe(0); expect(terminal.ending?.kind).toBe('DEATH');
    expect(raw.schemaVersion).toBe(177); expect(raw.contentVersion).toBe('blood-duke-v177'); expect(raw.revision).toBe(719); expect(raw.status).toBe('ACTIVE');
    const s = migrateSliceState(raw); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.random).toEqual({ seed: 'criminal-natural-v054', cursor: 112 }); for (const key of UNCLEAN_MONARCH_SOURCE_KEYS) expect(s[key], key).toEqual(raw[key]);
    expect(s.character).toEqual(raw.character); expect(s.injuries).toEqual(raw.injuries); expect(s.combatHistory).toEqual(raw.combatHistory); expect(raw).toEqual(before);
    expect(s.uncleanMonarch).toEqual(createUncleanMonarchState()); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
    const older = 'tests/fixtures/blatherer-v01560/natural.json';
    expect(createHash('sha256').update(readFileSync(older)).digest('hex')).toBe('796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b');
    expect(readObjectEntry<SliceIntent[]>(older, 'commands')).toHaveLength(592); expect(readObjectEntry<SliceState>(older, 'final').status).toBe('DEAD');
  }, 120_000);
  it('reconstructs the actual healthy S2 source and preserves original S9 and actual S2 promotion weeks separately', () => {
    const s = promoted(), before = structuredClone(s), source = s.uncleanMonarch.sourceScene!, view = uncleanMonarchInheritedView(s);
    expect(source.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 30, perception: 24, will: 22, knowledge: 24 } });
    expect(source.budget).toMatchObject({ sequence: 2, health: 100, mind: 100, spirituality: 120, acting: 100, injuryRisk: 0, injuries: [] });
    expect(view.character).toEqual(source.character); expect(view.progression.sequence).toBe(2); expect(view.progression.promotionWeek).toBe(5); expect(view.bloodDuke.promotionWeek).toBe(172);
    expect(view.progression.mastery).toEqual(source.budget.mastery); expect(view.revision).toBe(source.revision); expect(view.random).toEqual(source.random);
    expect(view.health).toBe(100); expect(view.injuries).toEqual([]); expect(validateBloodDukeState(view)).toBe(true);
    expect(view.uncleanMonarch).toEqual(createUncleanMonarchState()); expect(s).toEqual(before); expect(view.bloodDuke).not.toBe(s.bloodDuke);
    expect(s.character.coreStats).toEqual({ physique: 31, perception: 25, will: 23, knowledge: 25 });
    expect(s.character.gender).toBe('FEMALE'); expect(s.injuries).toEqual([]); expect(s.careKnown).toBe(originalBloodDuke().careKnown);
  }, 120_000);
  it('preserves all16 old mastery values and four legal zeros, eight complete roots, conscience and actual demon strain3', () => {
    const original = originalBloodDuke(), s = promoted();
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(original)); expect(s.uncleanMonarch.sourceHistory).toEqual(Object.fromEntries(UNCLEAN_MONARCH_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(Object.keys(original.progression.mastery)).toHaveLength(16); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(4);
    const zeros = ['abyss.s7.demonic-lore', 'abyss.s7.ritual-practice', 'abyss.s6.danger-premonition', 'abyss.s5.catalysis'];
    for (const id of zeros) expect(s.progression.mastery[id], id).toBe(0);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of UNCLEAN_MONARCH_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(Object.keys(s.progression.mastery)).toHaveLength(18); expect(s.uncleanMonarch.bloodDukeActingAtPromotion).toBe(100);
    expect(s.unwinged.conscienceLost).toBe(true); expect(s.demon.strain).toBe(3); expect(s.uncleanMonarch.sourceScene!.originals.strain).toBe(3); expect(s.uncleanMonarch.encounter.strain).toBe(3);
    expect(s.combatHistory).toEqual(original.combatHistory); expect(validateUncleanMonarchSource(s)).toBe(true); expect(validateUncleanMonarchState(s)).toBe(true);
  }, 120_000);
  it('uses live blatherer.life96/317 rather than old S2 handoff48/162; original people, card, bell and note are retained', () => {
    const s = promoted(), site = getUncleanMonarchCurrentSite(s), source = s.uncleanMonarch.sourceScene!;
    expect(site).toMatchObject({ siteId: 'BL3-QUIET-ROOM', playerLocation: 'START', playerTravelMetres: 96, clockSeconds: 317,
      volunteer: { id: 'BL3-NORA', name: '诺拉·温特', age: 46, alive: true, willing: true, location: 'A' },
      guide: { id: 'ROAN', name: '罗安·费里', location: 'OUTSIDE', travelMetres: 24 }, card: { id: 'BL3-CARD', owner: 'BL3-NORA', quantity: 1, location: 'NORA', travelMetres: 40 },
      bell: { id: 'BL3-BELL', quantity: 1, location: 'B' }, note: { id: 'BL3-NOTE', quantity: 1, location: 'B' } });
    expect('age' in site.guide).toBe(false); expect('energy' in site.volunteer).toBe(false); expect('energy' in site).toBe(false);
    expect(site.note.records).toEqual(s.blatherer.life.note.records); expect(source.originals.site).toEqual(s.blatherer.life);
    expect(s.bloodDuke.life.source!.snapshot).toMatchObject({ playerTravelMetres: 48, clockSeconds: 162 }); expect(site).not.toEqual(s.bloodDuke.life.source!.snapshot);
    expect(s.uncleanMonarch.life.operation).toEqual({ door: 'OPEN', inputActive: false, impulse: null, emotion: null, restraintUntil: null, hesitationUntil: null, bellRehearsals: 2 });
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0); expect(s.uncleanMonarch.life.pieces).toEqual([]);
  }, 120_000);
  it('keeps Edric and Gareth available and the same surrendered older opponent injured, without resetting any body', () => {
    const s = promoted();
    expect(s.blatherer.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'BL3-EDRIC', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', enemyInjuries: [] });
    expect(s.bloodDuke.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'BD2-GARETH', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', enemyInjuries: [] });
    expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 32 });
    expect(s.devil.encounter.enemyInjuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null]]);
    expect(s.uncleanMonarch.encounter).toMatchObject({ targetId: 'UM1-HARLAN', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
  }, 120_000);
  it('shows the original room before promotion and thereafter moves only the new actual copy', () => {
    const original = originalBloodDuke(); expect(projectUncleanMonarchLife(original).site).toEqual(original.blatherer.life); expect(projectUncleanMonarchLife(original).operation).toEqual(original.bloodDuke.life.operation);
    let s = promoted(); const roots = oldAbyssRoots(s), source = structuredClone(s.uncleanMonarch.sourceScene!.originals);
    for (const command of [
      { type: 'OBSERVE', caseId: 'measured-reading' }, { type: 'CONSENT', caseId: 'measured-reading', permission: 'OWNER' },
      { type: 'PREPARE', caseId: 'measured-reading', method: 'ORDINARY' }, { type: 'WALK_TO_A', caseId: 'measured-reading' }, { type: 'TAKE_CARD', caseId: 'measured-reading' },
    ] as const) s = um(s, command);
    expect(getUncleanMonarchCurrentSite(s)).toMatchObject({ playerLocation: 'A', playerTravelMetres: 100, volunteer: { location: 'A' }, card: { location: 'PLAYER' } });
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0); expect(oldAbyssRoots(s)).toEqual(roots); expect(s.uncleanMonarch.sourceScene!.originals).toEqual(source);
    expect(s.blatherer.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 96, card: { location: 'NORA' } }); expect(validateUncleanMonarchLifeState(s)).toBe(true);
  }, 120_000);
  it('closes old acquisition, life and encounter commands after guidance and promotion while preserving old roots', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'BLOOD_DUKE', command: { type: 'BUY_POTION', bottleId: 'blood-duke-potion-3' } },
        { type: 'BLOOD_DUKE', command: { type: 'OBSERVE', caseId: 'door-restraint' } },
        { type: 'BLOOD_DUKE', command: { type: 'PREPARE_ENCOUNTER' } },
        { type: 'BLATHERER', command: { type: 'OBSERVE', caseId: 'conflicting-bell' } },
        { type: 'DEVIL', command: { type: 'REFLECT' } },
        { type: 'DESIRE_APOSTLE', command: { type: 'REFLECT' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(originalBloodDuke()));
    }
  }, 120_000);
  it('rejects invented old mastery, historical source swaps, energy refills, erased consequences and missing roots', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.coreStats.knowledge++; }, s => { s.progression.mastery['abyss.s7.demonic-lore'] = 8; },
      s => { s.progression.mastery[UNCLEAN_MONARCH_ABILITY_IDS[0]] = 8; }, s => { s.demon.strain = 0; }, s => { s.unwinged.conscienceLost = false; },
      s => { s.blatherer.life.card.travelMetres = 0; }, s => { s.bloodDuke.life.operation.bellRehearsals = 0; },
      s => { s.uncleanMonarch.sourceScene!.originals.site = structuredClone(s.bloodDuke.life.source!.snapshot); },
      s => { s.uncleanMonarch.sourceScene!.originals.strain = 0; }, s => { s.uncleanMonarch.sourceScene!.budget.health = 99; },
      s => { s.uncleanMonarch.sourceScene!.character.coreStats.knowledge++; }, s => { s.uncleanMonarch.sourceHistory!.blatherer.life.card.travelMetres++; },
      s => { s.uncleanMonarch.bloodDukeActingAtPromotion = 99; }, s => { s.uncleanMonarch.encounter.strain = 0; },
      s => { delete (s.uncleanMonarch.sourceHistory as Partial<NonNullable<SliceState['uncleanMonarch']['sourceHistory']>>).desireApostle; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateUncleanMonarchState(s), change.toString()).toBe(false); }
    const s = promoted(); (s.uncleanMonarch.life.site.volunteer as unknown as Record<string, unknown>).energy = 100; expect(validateUncleanMonarchState(s)).toBe(false);
  }, 120_000);
  it('rejects future format, unsupported S0 and wrong pathway without rewriting history', () => {
    const s = promoted(); expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    for (const wrong of [{ ...s, progression: { ...s.progression, sequence: 0 as const } }, { ...s, progression: { ...s.progression, pathwayId: 'audience' as const } }]) {
      expect(validateUncleanMonarchState(wrong)).toBe(false); expect(() => assertValidSliceState(wrong)).toThrow();
    }
  }, 120_000);
});
