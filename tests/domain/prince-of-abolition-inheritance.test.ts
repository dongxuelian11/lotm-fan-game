import { hasFrenzyMageLifeLock } from '../../src/domain/frenzy-mage/life.js';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createPrinceOfAbolitionState, princeOfAbolitionInheritedView, validatePrinceOfAbolitionSource, validatePrinceOfAbolitionState } from '../../src/domain/prince-of-abolition/index.js';
import { getPrinceOfAbolitionCurrentSite, projectPrinceOfAbolitionLife, validatePrinceOfAbolitionLifeState } from '../../src/domain/prince-of-abolition/life.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, PRINCE_OF_ABOLITION_SOURCE_KEYS } from '../../src/domain/prince-of-abolition/types.js';
import { entropyDukeNaturalPath, oldBlackEmperorRoots, originalEntropyDuke, poa, promotedForLife, rejectIntent, taught } from './prince-of-abolition-directed-helper.js';

describe('Prince of Abolition original743 inheritance and single physical authority', () => {
  it('pins untouched schema180/743 source and preserves every raw root and original seed during current migration', () => {
    expect(createHash('sha256').update(readFileSync(entropyDukeNaturalPath)).digest('hex')).toBe('3dbb2166121b85a02883455a5604df7c44a50ce6102d7dd65d5c9720b4ed32f1');
    const commands = readObjectEntry<SliceIntent[]>(entropyDukeNaturalPath, 'commands'), raw = readObjectEntry<SliceState>(entropyDukeNaturalPath, 'final'), bytes = stableStringify(raw);
    expect(commands).toHaveLength(743); expect(raw).toMatchObject({ schemaVersion: 180, contentVersion: 'entropy-duke-v180', revision: 744, week: 185, runId: 'lawyer-rebuild-natural', random: { seed: 'lawyer-natural-v063', cursor: 228 } });
    const s = migrateSliceState(raw); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); expect(s.princeOfAbolition).toEqual(createPrinceOfAbolitionState());
    for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) expect(s[key], key).toEqual(raw[key]); expect(s.character).toEqual(raw.character); expect(s.injuries).toEqual(raw.injuries); expect(s.combatHistory).toEqual(raw.combatHistory); expect(stableStringify(raw)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  }, 120_000);
  it('preserves actualS2 promotion175 separately from originalpromotion6 and all14 mastery values including3 zeros', () => {
    const original = originalEntropyDuke(), s = promotedForLife(), source = s.princeOfAbolition.sourceScene!, view = princeOfAbolitionInheritedView(s);
    expect(view.progression.promotionWeek).toBe(6); expect(view.entropyDuke.promotionWeek).toBe(175); expect(source.character.coreStats).toEqual({ physique: 29, perception: 23, will: 25, knowledge: 23 }); expect(s.character.coreStats).toEqual({ physique: 30, perception: 24, will: 26, knowledge: 24 });
    expect(source.budget).toMatchObject({ sequence: 2, acting: 100, gender: 'FEMALE', health: 100, injuryRisk: 0, injuries: [] }); expect(view.progression.mastery).toEqual(original.progression.mastery); expect(Object.keys(original.progression.mastery)).toHaveLength(14); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(3);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery); for (const id of PRINCE_OF_ABOLITION_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); expect(Object.keys(s.progression.mastery)).toHaveLength(16);
    expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(original)); expect(s.princeOfAbolition.sourceHistory).toEqual(Object.fromEntries(PRINCE_OF_ABOLITION_SOURCE_KEYS.map(key => [key, original[key]]))); expect(validatePrinceOfAbolitionSource(s)).toBe(true); expect(validatePrinceOfAbolitionState(s)).toBe(true);
  }, 120_000);
  it('selects actual clock449 scene rather than historical85/249 and preserves same originals OUTSIDE and oldpads inside', () => {
    const original = originalEntropyDuke(), s = promotedForLife(), p = getPrinceOfAbolitionCurrentSite(s);
    expect(p).toEqual(original.frenzyMage.life); expect(p).not.toBe(s.frenzyMage.life); expect(p).toMatchObject({ playerLocation: 'START', playerTravelMetres: 120, guideTravelMetres: 52, clockSeconds: 449, guide: { id: 'GUIDE', location: 'OUTSIDE' }, volunteer: { id: 'FM3-DARIAN', age: 42, health: 100, mind: 100, location: 'OUTSIDE' }, ball: { owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 80 }, parcel: { owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 400 }, paper: { owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, text: '从A到B' } });
    expect(p.pads).toEqual([{ id: 'FM3-PAD-B', location: 'B', padded: true, people: 0 }, { id: 'FM3-PAD-C', location: 'C', padded: true, people: 0 }]); expect(s.entropyDuke.life.source!.snapshot.clockSeconds).toBe(85); expect(s.entropyDuke.encounter.startRoot!.clockSeconds).toBe(249); expect(s.princeOfAbolition.life.operation).toEqual({ door: 'OPEN', inputActive: false, flight: null });
    expect('energy' in p.volunteer).toBe(false); expect('spirituality' in p.volunteer).toBe(false); expect('mind' in p.guide).toBe(false); expect(s.princeOfAbolition.life).toMatchObject({ annex: null, flight: null, cooperationEffortSpent: 0, volunteerMindSpent: 0, pieces: [] });
    expect(getPrinceOfAbolitionCurrentSite(original)).toEqual(original.frenzyMage.life); expect(projectPrinceOfAbolitionLife(original)).toMatchObject({ clockSeconds: 449, playerTravelMetres: 120, playerLocation: 'START' });
  }, 120_000);
  it('keeps original Oswin surrendered with both injuries and staff in hand, and preserves old bottle outcomes and original15 gifts', () => {
    const s = promotedForLife(), original = originalEntropyDuke(); expect(s.entropyDuke.encounter).toEqual(original.entropyDuke.encounter);
    expect(s.entropyDuke.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 85, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B', enemyRisk: 1 });
    expect(s.entropyDuke.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision])).toEqual([['LIGHT', 741], ['HEAVY', 743]]);
    expect(s.entropyDuke.bottles.map(b => [b.status, b.outcome])).toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'GREAT_SUCCESS'], ['SUPPLIER', null], ['SUPPLIER', null]]);
    expect(s.princeOfAbolition.gifts).toEqual(original.briber.gifts); expect(s.princeOfAbolition.gifts).not.toBe(s.briber.gifts); expect(s.princeOfAbolition.sourceScene!.originals.gifts).toEqual(original.briber.gifts); expect(s.princeOfAbolition.gifts.filter(g => g.location === 'PLAYER').map(g => g.id)).toEqual(['BR7-GIFT-13', 'BR7-GIFT-14', 'BR7-GIFT-15']); expect(s.princeOfAbolition.gifts).toHaveLength(15);
  }, 120_000);
  it('reads the closed inherited scene only for evidenced S1 and rejects bare S1, missing promotion, stale originals and S0', () => {
    const s = promotedForLife(); expect(hasFrenzyMageLifeLock(s)).toBe(false);
    const exited = poa(s, { type: 'EXIT_ROOM' });
    expect(exited.princeOfAbolition.life.site.playerLocation).toBe('OUTSIDE');
    expect(exited.princeOfAbolition.life.site.playerTravelMetres - s.princeOfAbolition.life.site.playerTravelMetres).toBe(4);
    expect(exited.princeOfAbolition.life.site.clockSeconds - s.princeOfAbolition.life.site.clockSeconds).toBe(4);
    expect(oldBlackEmperorRoots(exited)).toEqual(oldBlackEmperorRoots(s)); expect(hasFrenzyMageLifeLock(exited)).toBe(false);
    for (const mutate of [
      (v: SliceState) => { v.princeOfAbolition = createPrinceOfAbolitionState(); },
      (v: SliceState) => { v.princeOfAbolition.promotionWeek = null; },
      (v: SliceState) => { v.princeOfAbolition.acquisitionJournal = v.princeOfAbolition.acquisitionJournal.filter(e => e.command.type !== 'CONSUME'); },
      (v: SliceState) => { v.frenzyMage.life.ball.location = 'A'; },
      (v: SliceState) => { v.progression.sequence = 0; },
    ]) { const bad = structuredClone(s); mutate(bad); expect(hasFrenzyMageLifeLock(bad), mutate.toString()).toBe(true); expect(() => assertValidSliceState(bad)).toThrow(); }
    rejectIntent(s, { type: 'FRENZY_MAGE', command: { type: 'REFLECT' } });
  }, 120_000);
  it('changes only the new physical continuation and leaves all eight old roots plus source originals immutable', () => {
    let s = promotedForLife(); const roots = oldBlackEmperorRoots(s), source = structuredClone(s.princeOfAbolition.sourceScene!.originals); s = poa(s, { type: 'EXIT_ROOM' }); s = poa(s, { type: 'BUY_ANNEX' });
    expect(getPrinceOfAbolitionCurrentSite(s)).toMatchObject({ clockSeconds: 471, playerTravelMetres: 140, playerLocation: 'OUTSIDE' }); expect(s.frenzyMage.life).toMatchObject({ clockSeconds: 449, playerTravelMetres: 120, playerLocation: 'START' }); expect(oldBlackEmperorRoots(s)).toEqual(roots); expect(s.princeOfAbolition.sourceScene!.originals).toEqual(source); expect(validatePrinceOfAbolitionLifeState(s)).toBe(true);
  }, 120_000);
  it('freezes all old command surfaces after guidance while keeping inherited projection honest and read-only', () => {
    for (const s of [taught(), promotedForLife()]) {
      for (const intent of [
        { type: 'ENTROPY_DUKE', command: { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-5' } }, { type: 'ENTROPY_DUKE', command: { type: 'OBSERVE', caseId: 'measured-throw' } }, { type: 'ENTROPY_DUKE', command: { type: 'PREPARE_ENCOUNTER' } },
        { type: 'FRENZY_MAGE', command: { type: 'REFLECT' } }, { type: 'FALLEN_EARL', command: { type: 'REFLECT' } }, { type: 'BRIBER', command: { type: 'REFLECT' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      const before = stableStringify(oldBlackEmperorRoots(s)), projected = projectSliceState(s);
      const scan = (v: unknown): void => { if (!v || typeof v !== 'object') return; if (Array.isArray(v)) { v.forEach(scan); return; } const object = v as Record<string, unknown>; if (Array.isArray(object.actions)) for (const action of object.actions as { enabled?: boolean }[]) expect(action.enabled).toBe(false); if ('preferredActionId' in object) expect(object.preferredActionId).toBeNull(); for (const child of Object.values(object)) scan(child); };
      for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) scan(projected[key]); expect(projected.entropyDuke.abilities).toHaveLength(14); expect(projected.entropyDuke.acting).toBe(100); expect(projected.entropyDuke.encounter.enemy).toMatchObject({ status: 'SURRENDERED', health: 60, mind: 100, spirituality: 85 }); expect(stableStringify(oldBlackEmperorRoots(s))).toBe(before);
    }
  }, 180_000);
  it('rejects hidden old-body replacement, invented energy, stale source scene, missing root and doubled original stock', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.frenzyMage.life.clockSeconds++; }, s => { s.entropyDuke.encounter.enemyHealth = 100; }, s => { s.princeOfAbolition.life.site.volunteer.mind = 101; }, s => { s.princeOfAbolition.sourceScene!.originals.site = structuredClone(s.entropyDuke.life.source!.snapshot); }, s => { s.princeOfAbolition.gifts.push(structuredClone(s.princeOfAbolition.gifts.at(-1)!)); }, s => { s.princeOfAbolition.sourceHistory!.briber.gifts.pop(); }, s => { (s.princeOfAbolition.life.site.volunteer as unknown as Record<string, unknown>).energy = 100; }];
    for (const change of changes) { const s = promotedForLife(); change(s); expect(validatePrinceOfAbolitionState(s), change.toString()).toBe(false); }
    const missing = structuredClone(promotedForLife()) as unknown as Record<string, unknown>; delete missing.mentorDisorder; expect(() => assertValidSliceState(missing as unknown as SliceState)).toThrow();
  }, 120_000);
});
