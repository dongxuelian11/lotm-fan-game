import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateFateProphetState } from '../../src/domain/fate-prophet/index.js';
import { createMercurySnakeState, mercurySnakeInheritedView, validateMercurySnakeSource, validateMercurySnakeState } from '../../src/domain/mercury-snake/index.js';
import { getMercurySnakeCurrentSite, projectMercurySnakeLife, validateMercurySnakeLifeState } from '../../src/domain/mercury-snake/life.js';
import { MERCURY_SNAKE_ABILITY_IDS, MERCURY_SNAKE_SOURCE_KEYS } from '../../src/domain/mercury-snake/types.js';
import { ms, fateProphetNaturalPath, oldWheelRoots, originalFateProphet, promoted, rejectIntent, taught } from './mercury-snake-directed-helper.js';

describe('Mercury Snake complete original703 inheritance and authoritative continuation', () => {
  it('pins genuine raw179 source separately from current migration, preserving703 commands and all historical outcomes', () => {
    expect(createHash('sha256').update(readFileSync(fateProphetNaturalPath)).digest('hex')).toBe('52688eebc9ef8bf3d548195aa174b1f04a517adcce5d2fc6a3bef57a901f86cb');
    const commands = readObjectEntry<SliceIntent[]>(fateProphetNaturalPath, 'commands'), raw = readObjectEntry<SliceState>(fateProphetNaturalPath, 'final'), before = structuredClone(raw);
    expect(commands).toHaveLength(703); expect(raw.schemaVersion).toBe(179); expect(raw.contentVersion).toBe('fate-prophet-v179'); expect(raw.revision).toBe(704);
    expect(raw).toMatchObject({ week: 177, status: 'ACTIVE', health: 90, mind: 95, spirituality: 119, cash: 1060, actionsRemaining: 2, random: { seed: 'monster-natural-v060', cursor: 269 } });
    const s = migrateSliceState(raw); expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of MERCURY_SNAKE_SOURCE_KEYS) expect(s[key], key).toEqual(raw[key]);
    expect(s.character).toEqual(raw.character); expect(s.injuries).toEqual(raw.injuries); expect(s.combatHistory).toEqual(raw.combatHistory); expect(raw).toEqual(before);
    expect(s.mercurySnake).toEqual(createMercurySnakeState()); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
    expect(s.fateProphet.encounter).toMatchObject({ targetId: 'FP2-ROWAN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
    expect(s.fateProphet.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']);
    expect(s.injuries).toEqual([{ id: 'monster-rebuild-natural:combat:2:PLAYER:702:0', severity: 'LIGHT', acquiredRevision: 702, treatedRevision: null }]);
  }, 120_000);
  it('reconstructs the actual S2identity and independently preserves S9week6, S2week166 and new S1promotion', () => {
    const s = promoted(), before = structuredClone(s), source = s.mercurySnake.sourceScene!, view = mercurySnakeInheritedView(s);
    expect(source.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 26, perception: 25, will: 23, knowledge: 24 } });
    expect(source.budget).toMatchObject({ sequence: 2, acting: 100, luck: { stored: 0, accumulated: 14, spent: 14, lastAccumulateWeek: 176 } });
    expect(view.character).toEqual(source.character); expect(view.progression.sequence).toBe(2); expect(view.progression.promotionWeek).toBe(6); expect(view.fateProphet.promotionWeek).toBe(166);
    expect(view.progression.mastery).toEqual(source.budget.mastery); expect(view.revision).toBe(source.revision); expect(view.random).toEqual(source.random); expect(validateFateProphetState(view)).toBe(true);
    expect(view.mercurySnake).toEqual(createMercurySnakeState()); expect(s).toEqual(before); expect(view.fateProphet).not.toBe(s.fateProphet);
    expect(s.character.coreStats).toEqual({ physique: 27, perception: 26, will: 24, knowledge: 25 }); expect(s.character.gender).toBe('FEMALE'); expect(s.careKnown).toBe(originalFateProphet().careKnown);
  }, 120_000);
  it('keeps all17 inherited skills, six honest zeros, all8 immutable roots and the complete old combat history', () => {
    const original = originalFateProphet(), s = promoted();
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(original)); expect(s.mercurySnake.sourceHistory).toEqual(Object.fromEntries(MERCURY_SNAKE_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(Object.keys(original.progression.mastery)).toHaveLength(17); expect(Object.values(original.progression.mastery).filter(n => n === 0)).toHaveLength(6);
    for (const id of ['wheel.s7.passive-luck', 'wheel.s6.disaster-awareness', 'wheel.s6.disaster-attraction', 'wheel.s5.luck-reserve', 'wheel.s5.ill-fortune', 'wheel.s2.hazard-adjustment']) expect(s.progression.mastery[id], id).toBe(0);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of MERCURY_SNAKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); expect(Object.keys(s.progression.mastery)).toHaveLength(19);
    expect(s.mercurySnake.fateProphetActingAtPromotion).toBe(100); expect(s.combatHistory).toEqual(original.combatHistory); expect(validateMercurySnakeSource(s)).toBe(true); expect(validateMercurySnakeState(s)).toBe(true);
  }, 120_000);
  it('continues actual chaosWalker713/124 with both adultsOUTSIDE, never the earlier FateProphet snapshot', () => {
    const s = promoted(), source = s.mercurySnake.sourceScene!, site = getMercurySnakeCurrentSite(s), original = originalFateProphet();
    expect(site).toMatchObject({ siteId: 'CW3-MECHANICAL-WORKSHOP', playerLocation: 'START', playerTravelMetres: 124, clockSeconds: 713,
      guide: { id: 'GUIDE', name: '报时铺记录员艾妲·芬恩', location: 'OUTSIDE' }, volunteer: { id: 'CW3-VERA', name: '薇拉·霍尔', age: 39, alive: true, willing: true, location: 'OUTSIDE', health: 100, mind: 100, spirituality: 100, injuries: [] },
      cart: { id: 'CW3-CART', owner: 'GUIDE', quantity: 1, location: 'A', releases: 3, returns: 3 }, parcel: { id: 'CW3-PARCEL', owner: 'GUIDE', quantity: 1, massGrams: 400, sealed: true, location: 'CW3-CART' },
      disc: { id: 'CW3-DISC', owner: 'GUIDE', location: 'A', pointer: 'A' }, pouch: { id: 'CW3-POUCH', owner: 'CW3-VERA', location: 'VERA' } });
    expect(site.tags).toEqual(original.chaosWalker.life.tags); expect(site.record).toEqual(original.chaosWalker.life.record); expect(source.originals.site).toEqual(s.chaosWalker.life);
    expect(source.originals.site).not.toEqual(s.fateProphet.life.source!.snapshot); expect(site).not.toEqual(s.fateProphet.life.source!.snapshot);
    expect(s.mercurySnake.life.operation).toEqual({ door: 'OPEN', mechanical: { objectId: 'CW3-DISC', caseId: 'finite-disc', preparedAt: 477, preparationRoll: 41, bias: 'B', version: 1 }, forecast: null, correction: null });
    expect('energy' in site.volunteer).toBe(false); expect('mind' in site.guide).toBe(false); expect(s.mercurySnake.life.pieces).toEqual([]);
  }, 120_000);
  it('keeps all historical luck copies readonly and initializes exactly one spendable continuation0/14/14', () => {
    const s = promoted(), original = originalFateProphet();
    expect(s.mercurySnake.luck).toEqual(original.winner.luck); expect(s.mercurySnake.luck).not.toBe(s.winner.luck);
    expect(s.mercurySnake.sourceScene!.originals.luck).toEqual(original.winner.luck); expect(s.mercurySnake.sourceHistory!.winner.luck).toEqual(original.winner.luck);
    expect(s.mercurySnake.sourceScene!.budget.luck).toEqual(original.winner.luck); expect(s.mercurySnake.acquisitionJournal.every(e => stableStringify(e.before.luck) === stableStringify(e.after.luck))).toBe(true);
    const next = ms(s, { type: 'ACCUMULATE' }); expect(next.mercurySnake.luck).toMatchObject({ stored: 1, accumulated: 15, spent: 14 }); expect(oldWheelRoots(next)).toEqual(oldWheelRoots(s));
    expect(next.mercurySnake.sourceScene).toEqual(s.mercurySnake.sourceScene); expect(next.mercurySnake.sourceHistory).toEqual(s.mercurySnake.sourceHistory);
  }, 120_000);
  it('moves only the new current scene after actual consent and invitation; old roots and their earlier scene remain byte-exact', () => {
    let s = promoted(); const roots = oldWheelRoots(s), source = structuredClone(s.mercurySnake.sourceScene!.originals);
    for (const command of [
      { type: 'OBSERVE', caseId: 'cart-return' }, { type: 'CONSENT', caseId: 'cart-return', permission: 'OWNER' }, { type: 'INVITE', caseId: 'cart-return' },
      { type: 'START_ORDINARY', caseId: 'cart-return' }, { type: 'WALK_TO_A', caseId: 'cart-return' },
    ] as const) s = ms(s, command);
    expect(getMercurySnakeCurrentSite(s)).toMatchObject({ playerLocation: 'A', playerTravelMetres: 128, guideTravelMetres: 28, clockSeconds: source.site.clockSeconds + 27, guide: { location: 'A' }, volunteer: { location: 'A' } });
    expect(s.chaosWalker.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 124, clockSeconds: 713, guide: { location: 'OUTSIDE' }, volunteer: { location: 'OUTSIDE' } });
    expect(oldWheelRoots(s)).toEqual(roots); expect(s.mercurySnake.sourceScene!.originals).toEqual(source); expect(validateMercurySnakeLifeState(s)).toBe(true);
  }, 120_000);
  it('projects the old surrenderedRowan and mastered history truthfully while disabling old mutation actions', () => {
    const s = promoted(), bytesBefore = stableStringify(oldWheelRoots(s)), view = projectSliceState(s), old = view.fateProphet;
    expect(stableStringify(oldWheelRoots(s))).toBe(bytesBefore); expect(old.promoted).toBe(true); expect(old.acting).toBe(100); expect(old.abilities).toHaveLength(17);
    expect(old.encounter.enemy).toMatchObject({ health: 60, mind: 100, spirituality: 83, status: 'SURRENDERED' }); expect(Object.fromEntries(old.abilities.map(a => [a.id, a.mastery]))).toEqual(originalFateProphet().progression.mastery);
    const scan = (value: unknown): void => {
      if (!value || typeof value !== 'object') return; if (Array.isArray(value)) { value.forEach(scan); return; }
      const object = value as Record<string, unknown>; if (Array.isArray(object.actions)) for (const action of object.actions as { enabled?: boolean }[]) expect(action.enabled).toBe(false);
      if ('preferredActionId' in object) expect(object.preferredActionId).toBeNull(); for (const child of Object.values(object)) scan(child);
    };
    for (const key of MERCURY_SNAKE_SOURCE_KEYS) scan(view[key]); expect(s.fateProphet.encounter.enemyStatus).toBe('SURRENDERED'); expect(s.fateProphet.encounter.enemyInjuries).toEqual(originalFateProphet().fateProphet.encounter.enemyInjuries);
  }, 120_000);
  it('closes old acquisition, physical life and luck commands as soon as the new handoff is recorded', () => {
    for (const s of [taught(), promoted()]) {
      for (const intent of [
        { type: 'FATE_PROPHET', command: { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-3' } }, { type: 'FATE_PROPHET', command: { type: 'OBSERVE', caseId: 'cart-omen' } }, { type: 'FATE_PROPHET', command: { type: 'PREPARE_ENCOUNTER' } },
        { type: 'CHAOS_WALKER', command: { type: 'ACCUMULATE' } }, { type: 'FATE_PROPHET', command: { type: 'ACCUMULATE' } }, { type: 'WINNER', command: { type: 'ACCUMULATE' } },
      ] as SliceIntent[]) rejectIntent(s, intent); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(originalFateProphet()));
    }
  }, 120_000);
  it('rejects rewritten identities, refreshed luck, reopened surrenderedRowan, swapped snapshot and missing history', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.character.gender = 'MALE'; }, s => { s.character.coreStats.knowledge++; }, s => { s.progression.mastery['wheel.s7.passive-luck'] = 8; }, s => { s.progression.mastery[MERCURY_SNAKE_ABILITY_IDS[0]] = 8; },
      s => { s.chaosWalker.life.volunteer.location = 'A'; }, s => { s.fateProphet.encounter.enemyHealth = 100; }, s => { s.fateProphet.encounter.enemyStatus = 'RESISTING'; }, s => { s.fateProphet.encounter.enemyInjuries = []; },
      s => { s.mercurySnake.sourceScene!.originals.site = structuredClone(s.fateProphet.life.source!.snapshot); }, s => { s.mercurySnake.sourceScene!.budget.health--; }, s => { s.mercurySnake.sourceScene!.character.coreStats.knowledge++; },
      s => { s.mercurySnake.sourceHistory!.chaosWalker.life.playerTravelMetres++; }, s => { s.mercurySnake.fateProphetActingAtPromotion = 99; },
      s => { s.winner.luck.stored = 3; s.winner.luck.accumulated += 3; }, s => { s.mercurySnake.luck.stored = 3; s.mercurySnake.luck.accumulated += 3; },
      s => { delete (s.mercurySnake.sourceHistory as Partial<NonNullable<SliceState['mercurySnake']['sourceHistory']>>).winner; },
    ];
    for (const change of changes) { const s = promoted(); change(s); expect(validateMercurySnakeState(s), change.toString()).toBe(false); }
    const energy = promoted(); (energy.mercurySnake.life.site.volunteer as unknown as Record<string, unknown>).energy = 100; expect(validateMercurySnakeState(energy)).toBe(false);
  }, 120_000);
  it('does not manufacture future format, missing source roots, S0opportunity or a dead campaign continuation', () => {
    const s = promoted(); expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    for (const wrong of [{ ...s, progression: { ...s.progression, sequence: 0 as const } }, { ...s, progression: { ...s.progression, pathwayId: 'audience' as const } }]) { expect(validateMercurySnakeState(wrong)).toBe(false); expect(() => assertValidSliceState(wrong)).toThrow(); }
    const missing = structuredClone(s) as unknown as Record<string, unknown>; delete missing.winner; expect(() => assertValidSliceState(missing as unknown as SliceState)).toThrow();
    const dead = structuredClone(s); dead.status = 'DEAD'; dead.health = 0; rejectIntent(dead, { type: 'MERCURY_SNAKE', command: { type: 'OBSERVE', caseId: 'cart-return' } });
    expect(projectMercurySnakeLife(originalFateProphet()).site.clockSeconds).toBe(713);
  }, 120_000);
});
