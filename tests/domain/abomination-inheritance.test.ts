import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateAncientEvilState } from '../../src/domain/ancient-evil/index.js';
import { createAbominationState, abominationInheritedView, validateAbominationSource, validateAbominationState } from '../../src/domain/abomination/index.js';
import { getAbominationCurrentSite, projectAbominationLife, validateAbominationLifeState } from '../../src/domain/abomination/life.js';
import { ABOMINATION_ABILITY_IDS, ABOMINATION_SOURCE_KEYS } from '../../src/domain/abomination/types.js';
import { ab, ancientEvilNaturalPath, oldChainedRoots, originalAncientEvil, promoted, rejectIntent, taught } from './abomination-directed-helper.js';

describe('Abomination complete original642 inheritance and authoritative continuation', () => {
  it('pins untouched raw178642 source separately from current migration and preserves historical terminal outcomes', () => {
    expect(createHash('sha256').update(readFileSync(ancientEvilNaturalPath)).digest('hex')).toBe('f005b8f8aa0b9d82f14919fbf668a56c4f5a63e1284be94c6f7155b94472c96f');
    const commands = readObjectEntry<SliceIntent[]>(ancientEvilNaturalPath, 'commands'), raw = readObjectEntry<SliceState>(ancientEvilNaturalPath, 'final'), before = structuredClone(raw);
    expect(commands).toHaveLength(642); expect(raw.schemaVersion).toBe(178); expect(raw.contentVersion).toBe('ancient-evil-v178'); expect(raw.revision).toBe(643); expect(raw.status).toBe('ACTIVE'); expect(raw.health).toBe(100);
    const s = migrateSliceState(raw); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.random).toEqual({ seed: 'prisoner-natural-v057', cursor: 228 }); for (const key of ABOMINATION_SOURCE_KEYS) expect(s[key], key).toEqual(raw[key]);
    expect(s.character).toEqual(raw.character); expect(s.injuries).toEqual(raw.injuries); expect(s.combatHistory).toEqual(raw.combatHistory); expect(raw).toEqual(before);
    expect(s.abomination).toEqual(createAbominationState()); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
    expect(s.ancientEvil.encounter).toMatchObject({ enemyHealth: 0, enemyMind: 100, enemySpirituality: 98, enemyStatus: 'DEAD', weaponLocation: 'COURT', terminal: { outcome: 'ENEMY_DEAD' } });
    expect(s.silentDisciple.encounter).toMatchObject({ enemyHealth: 70, enemyMind: 100, enemySpirituality: 116, enemyStatus: 'SURRENDERED', terminal: { outcome: 'ENEMY_SURRENDERED' } });
  }, 120_000);
  it('reconstructs actual S2 identity and preserves original S9week6 and actual S2week138 independently', () => {
    const s = promoted(), before = structuredClone(s), source = s.abomination.sourceScene!, view = abominationInheritedView(s);
    expect(source.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 30, perception: 24, will: 24, knowledge: 20 } });
    expect(source.budget).toMatchObject({ sequence: 2, health: 100, acting: 100, injuryRisk: 0, injuries: [] });
    expect(view.character).toEqual(source.character); expect(view.progression.sequence).toBe(2); expect(view.progression.promotionWeek).toBe(6); expect(view.ancientEvil.promotionWeek).toBe(138);
    expect(view.progression.mastery).toEqual(source.budget.mastery); expect(view.revision).toBe(source.revision); expect(view.random).toEqual(source.random); expect(validateAncientEvilState(view)).toBe(true);
    expect(view.abomination).toEqual(createAbominationState()); expect(s).toEqual(before); expect(view.ancientEvil).not.toBe(s.ancientEvil);
    expect(s.character.coreStats).toEqual({ physique: 31, perception: 25, will: 25, knowledge: 21 }); expect(s.character.gender).toBe('FEMALE'); expect(s.injuries).toEqual([]); expect(s.careKnown).toBe(originalAncientEvil().careKnown);
  }, 120_000);
  it('preserves all19 old mastery values including4 legal zeros and all8 complete roots', () => {
    const original = originalAncientEvil(), s = promoted();
    expect(oldChainedRoots(s)).toEqual(oldChainedRoots(original)); expect(s.abomination.sourceHistory).toEqual(Object.fromEntries(ABOMINATION_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(Object.keys(original.progression.mastery)).toHaveLength(19); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(4);
    for (const id of ['chained.s7.toxic-claws', 'chained.s6.steel-body', 'chained.s6.death-craft', 'chained.s5.spirit-possession']) expect(s.progression.mastery[id], id).toBe(0);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of ABOMINATION_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); expect(Object.keys(s.progression.mastery)).toHaveLength(21);
    expect(s.abomination.ancientEvilActingAtPromotion).toBe(100); expect(s.combatHistory).toEqual(original.combatHistory); expect(validateAbominationSource(s)).toBe(true); expect(validateAbominationState(s)).toBe(true);
  }, 120_000);
  it('uses current silentDisciple112/4026 and ElsaOUTSIDE, never the ancientEvil historical48/3799 snapshot', () => {
    const s = promoted(), site = getAbominationCurrentSite(s), source = s.abomination.sourceScene!;
    expect(site).toMatchObject({ siteId: 'SD3-QUIET-ROOM', playerLocation: 'START', playerTravelMetres: 112, clockSeconds: 4026,
      volunteer: { id: 'SD3-ELSA', name: '埃尔莎·莫尔', age: 43, alive: true, willing: true, location: 'OUTSIDE', bodyId: 'SD3-ELSA', form: 'HUMAN', health: 100, mind: 100, spirituality: 100, injuries: [] },
      guide: { id: 'HARLAN', name: '哈伦·维斯', location: 'OUTSIDE' }, clothing: { id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true },
      bag: { id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' }, tray: { id: 'SD3-TRAY', location: 'A', privacy: 'PRIVATE' }, note: { id: 'SD3-NOTE', quantity: 1, location: 'B' } });
    expect('age' in site.guide).toBe(false); expect('energy' in site.volunteer).toBe(false); expect('energy' in site).toBe(false);
    expect(site.note.records).toEqual(s.silentDisciple.life.note.records); expect(source.originals.site).toEqual(s.silentDisciple.life);
    expect(s.ancientEvil.life.source!.snapshot).toMatchObject({ playerTravelMetres: 48, clockSeconds: 3799, volunteer: { location: 'A' }, guide: { location: 'START' } }); expect(site).not.toEqual(s.ancientEvil.life.source!.snapshot);
    expect(s.abomination.life.operation).toEqual({ door: 'OPEN', inputActive: false, form: null }); expect(s.abomination.life.volunteerEffortSpent).toBe(0); expect(s.abomination.life.pieces).toEqual([]);
  }, 120_000);
  it('retains original deadLena, surrenderedCalder and all3 spent original blocks without revival, replenishment or replacement', () => {
    const s = promoted(), original = originalAncientEvil();
    expect(s.ancientEvil.encounter).toEqual(original.ancientEvil.encounter); expect(s.silentDisciple.encounter).toEqual(original.silentDisciple.encounter);
    expect(s.ancientEvil.encounter.blocks).toEqual([1, 2, 3].map(n => ({ id: `AE2-BLOCK-${n}`, owner: 'PLAYER', status: 'SPENT', location: 'TARGET_GROUND', usedRound: 1 })));
    expect(s.abomination.sourceScene!.originals.blocks).toEqual(s.ancientEvil.encounter.blocks); expect(s.abomination.encounter).toMatchObject({ targetId: 'AB1-RODERICK', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
  }, 120_000);
  it('shows originals before promotion and only moves the new current copy after actual invitation and walking', () => {
    const original = originalAncientEvil(); expect(projectAbominationLife(original).site).toEqual(original.silentDisciple.life); expect(projectAbominationLife(original).operation).toEqual(original.ancientEvil.life.operation);
    let s = promoted(); const roots = oldChainedRoots(s), source = structuredClone(s.abomination.sourceScene!.originals);
    for (const command of [
      { type: 'OBSERVE', caseId: 'tray-pulse' }, { type: 'CONSENT', caseId: 'tray-pulse', permission: 'OWNER' }, { type: 'INVITE', caseId: 'tray-pulse' },
      { type: 'PREPARE', caseId: 'tray-pulse', method: 'ORDINARY' }, { type: 'WALK_TO_A', caseId: 'tray-pulse' },
    ] as const) s = ab(s, command);
    expect(getAbominationCurrentSite(s)).toMatchObject({ playerLocation: 'A', playerTravelMetres: 116, volunteer: { location: 'A' } });
    expect(s.abomination.life.volunteerEffortSpent).toBe(0); expect(oldChainedRoots(s)).toEqual(roots); expect(s.abomination.sourceScene!.originals).toEqual(source);
    expect(s.silentDisciple.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 112, volunteer: { location: 'OUTSIDE' } }); expect(validateAbominationLifeState(s)).toBe(true);
  }, 120_000);
  it('keeps old historical projections truthful and read-only after handoff, including S2acting100 and all19 abilities', () => {
    const s = promoted(), bytesBefore = stableStringify(oldChainedRoots(s)), projected = projectSliceState(s), old = projected.ancientEvil;
    expect(stableStringify(oldChainedRoots(s))).toBe(bytesBefore);
    expect(old.promoted).toBe(true); expect(old.acting).toBe(100); expect(old.abilities).toHaveLength(19);
    expect(old.encounter.enemy).toMatchObject({ health: 0, mind: 100, spirituality: 98, status: 'DEAD', weaponLocation: 'COURT' });
    expect(old.encounter.facts.join(' ')).toContain('剩余0块');
    expect(Object.fromEntries(old.abilities.map(a => [a.id, a.mastery]))).toEqual(originalAncientEvil().progression.mastery);
    const scan = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(scan); return; }
      const object = value as Record<string, unknown>;
      if (Array.isArray(object.actions)) for (const action of object.actions as { enabled?: boolean }[]) expect(action.enabled).toBe(false);
      if ('preferredActionId' in object) expect(object.preferredActionId).toBeNull();
      for (const child of Object.values(object)) scan(child);
    };
    for (const key of ABOMINATION_SOURCE_KEYS) scan(projected[key]);
    expect(s.ancientEvil.encounter.enemyStatus).toBe('DEAD'); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(originalAncientEvil()));
  }, 120_000);
  it('closes all old acquisition, life and encounter commands after guidance and promotion', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'ANCIENT_EVIL', command: { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-3' } }, { type: 'ANCIENT_EVIL', command: { type: 'OBSERVE', caseId: 'lasting-form' } }, { type: 'ANCIENT_EVIL', command: { type: 'PREPARE_ENCOUNTER' } },
        { type: 'SILENT_DISCIPLE', command: { type: 'OBSERVE', caseId: 'original-body' } }, { type: 'PUPPET', command: { type: 'REFLECT' } }, { type: 'WRAITH', command: { type: 'REFLECT' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      expect(oldChainedRoots(s)).toEqual(oldChainedRoots(originalAncientEvil()));
    }
  }, 120_000);
  it('rejects changed mastery, source swaps, original death/resource erasure, energy invention and missing old roots', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.coreStats.knowledge++; }, s => { s.progression.mastery['chained.s7.toxic-claws'] = 8; }, s => { s.progression.mastery[ABOMINATION_ABILITY_IDS[0]] = 8; },
      s => { s.silentDisciple.life.volunteer.location = 'A'; }, s => { s.ancientEvil.encounter.enemyHealth = 100; }, s => { s.ancientEvil.encounter.blocks[0]!.status = 'READY'; },
      s => { s.abomination.sourceScene!.originals.site = structuredClone(s.ancientEvil.life.source!.snapshot); }, s => { s.abomination.sourceScene!.budget.health = 99; }, s => { s.abomination.sourceScene!.character.coreStats.knowledge++; },
      s => { s.abomination.sourceHistory!.silentDisciple.life.playerTravelMetres++; }, s => { s.abomination.ancientEvilActingAtPromotion = 99; },
      s => { delete (s.abomination.sourceHistory as Partial<NonNullable<SliceState['abomination']['sourceHistory']>>).wraith; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateAbominationState(s), change.toString()).toBe(false); }
    const s = promoted(); (s.abomination.life.site.volunteer as unknown as Record<string, unknown>).energy = 100; expect(validateAbominationState(s)).toBe(false);
  }, 120_000);
  it('rejects future format, unsupportedS0 and wrong pathway without manufacturing a historical schema', () => {
    const s = promoted(); expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    for (const wrong of [{ ...s, progression: { ...s.progression, sequence: 0 as const } }, { ...s, progression: { ...s.progression, pathwayId: 'audience' as const } }]) { expect(validateAbominationState(wrong)).toBe(false); expect(() => assertValidSliceState(wrong)).toThrow(); }
    const missing = structuredClone(s) as unknown as Record<string, unknown>; delete missing.silentDisciple; expect(() => assertValidSliceState(missing as unknown as SliceState)).toThrow();
  }, 120_000);
});
