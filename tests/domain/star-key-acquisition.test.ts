import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  STAR_KEY_INHERITED_ABILITY_IDS, createStarKeyState, hasStarKeyLock, projectStarKey,
  validateStarKeyAcquisitionJournal, validateStarKeyCommand, validateStarKeySource, validateStarKeyState,
  starKeyAcquisitionBlock, starKeyCompletedAcquisitionBudgetMatches, starKeyFinanceSnapshot,
} from '../../src/domain/star-key/index.js';
import { STAR_KEY_ABILITY_IDS, STAR_KEY_PREPARATION_IDS } from '../../src/domain/star-key/types.js';
import { STAR_KEY_PRICES } from '../../src/domain/star-key/content.js';
import {
  ae, dose, originalDoorRoots, originalPlaneswalker, prepared, promoted, ordinary,
  rejectStarKey, rejectIntent, taught, planeswalkerNaturalPath, planeswalkerBranchPath,
  doorLegacyKeys, loadStarKeyFixture,
} from './star-key-directed-helper.js';

const journal = (s: SliceState) => s.starKey.acquisitionJournal;
async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256'); for await (const block of createReadStream(path)) hash.update(block); return hash.digest('hex');
}

describe('Star Key genuine Door source and strict commands', () => {
  it('keeps raw701 living evidence separate from current migration and the full707 death', async () => {
    expect(await fileHash(planeswalkerNaturalPath)).toBe('06e0bec9d3a72a41c27c96dbedafdddb023732f74a559471848f53163d144a78');
    const raw = readObjectEntry<SliceState>(planeswalkerBranchPath, 'beforeLast');
    const dead = readObjectEntry<SliceState>(planeswalkerNaturalPath, 'final');
    const commands = readObjectEntry<SliceIntent[]>(planeswalkerNaturalPath, 'commands');
    expect(raw).toMatchObject({ schemaVersion: 171, contentVersion: 'planeswalker-v171', revision: 1009, week: 201, status: 'ACTIVE', health: 100,
      random: { seed: 'secrets-sorcerer-directed-24', cursor: 94 } });
    expect(commands).toHaveLength(707);
    expect(createHash('sha256').update(JSON.stringify(commands.slice(0, 701))).digest('hex')).toBe('cef4fc68b02edf0328bb5b5345684f997fa4919427c5e1a4f962d454fad81a8e');
    expect(commands[701]).toEqual({ type: 'PLANESWALKER', command: { type: 'ENCOUNTER_TALK' } });
    expect(dead).toMatchObject({ status: 'DEAD', health: 0, revision: 1015, random: { cursor: 147 } });
    const s = originalPlaneswalker();
    expect(s).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(s.starKey).toEqual(createStarKeyState()); expect(originalDoorRoots(s)).toEqual(originalDoorRoots(raw));
    expect(s.character).toEqual(raw.character); expect(s.progression).toEqual(raw.progression); expect(s.combatHistory).toEqual(raw.combatHistory);
    expect(Object.keys(s.progression.mastery)).toEqual([...STAR_KEY_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(7);
    const migratedDead = loadStarKeyFixture(planeswalkerNaturalPath, 'final');
    rejectStarKey(migratedDead, { type: 'LEARN_GUIDANCE' }); expect(migratedDead.health).toBe(0); expect(migratedDead.status).toBe('DEAD');
  }, 60_000);
  it('constructs current roots and independent original bottles without exposing unrelated play', () => {
    const s = createSliceRun('star-hidden', sliceDefaultCreationSelection, 'star-hidden');
    assertValidSliceState(s);
    expect(projectStarKey(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], abilities: [], bottles: [], resources: null });
    rejectStarKey(s, { type: 'LEARN_GUIDANCE' });
    const other = createStarKeyState(); other.bottles[0]!.labourSteps = 5;
    expect(s.starKey.bottles[0]!.labourSteps).toBe(0);
  });
  it('requires exact original commands, explicit consumption and three named preparations', () => {
    expect(STAR_KEY_ABILITY_IDS).toEqual(['door.s1.endpoint-location', 'door.s1.anchor-maintenance']);
    expect(STAR_KEY_PREPARATION_IDS).toEqual(['VERIFY_ORIGINALS', 'RECORD_ENDPOINTS', 'MARK_RETURN']);
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'RECORD_CONDITIONS' },
      { ...dose, confirmed: false }, { type: 'CONSUME', bottleId: dose.bottleId }, { ...dose, bottleId: 'planeswalker-potion-1' },
      { ...dose, bottleId: 'star-key-potion-0' }, { ...dose, transformGender: true }, { type: 'FREE_REMOTE_RETURN' }, { type: 'REFILL_LAMP' },
    ]) expect(validateStarKeyCommand(command)).toBe(false);
    expect(validateStarKeyCommand(dose)).toBe(true);
    expect(STAR_KEY_PRICES).toEqual({ guidance: 500, potion: 6600, labourCredit: 5500, labourBalance: 1100, preparation: 150, resupply: 100 });
  });
});

describe('Star Key per-bottle acquisition and actual weekly economy', () => {
  it('pays for guidance and freezes all eight real roots, identity, original room and finance', () => {
    const before = originalPlaneswalker(), s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!, scene = s.starKey.sourceScene!;
    expect(e.before.cash - e.after.cash).toBe(500); expect(e.before.actions - e.after.actions).toBe(1);
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([e.before.health, e.before.mind, e.before.spirituality]);
    expect(scene.originals).toEqual({ site: before.planeswalker.life.site }); expect(scene.finance).toEqual(starKeyFinanceSnapshot(before));
    expect(e.finance).toEqual(scene.finance); expect(scene.character).toEqual(before.character);
    for (const key of doorLegacyKeys) expect(s.starKey.sourceHistory![key]).toEqual(before[key]);
    expect(s.starKey.sourceHistory!.planeswalker).not.toBe(s.planeswalker);
    expect(s.planeswalker.life.site).toMatchObject({ elapsedSeconds: 211, playerLocation: 'ENTRY', playerMetres: 40, playerAstralLegs: 2,
      operatorEnergy: 94, operatorConsent: 'WITHDRAWN', operatorConsentWeek: 198, door: { state: 'CLOSED', operations: 8 },
      parcel: { id: 'PW2-PARCEL', location: 'ENTRY_STAND', ordinaryMetres: 8, astralLegs: 2 }, lamp: { oilRemaining: 2, shows: 1 }, screen: { applications: 0 } });
    expect(validateStarKeySource(s)).toBe(true); expect(validateStarKeyAcquisitionJournal(s)).toBe(true); rejectStarKey(s, { type: 'LEARN_GUIDANCE' });
  }, 60_000);
  it('uses the real S2 promotion clock, per-bottle five jobs and separate professional work', () => {
    const s = taught(); expect(s.planeswalker.promotionWeek).toBe(193);
    expect(starKeyAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('/12');
    const p = prepared(), jobs = journal(p).filter(e => e.command.type === 'POTION_WORK'), purchase = journal(p).find(e => e.command.type === 'BUY_POTION')!;
    expect(p.week).toBeGreaterThanOrEqual(205); expect(jobs).toHaveLength(5);
    for (const job of jobs) { expect(job.before.actions - job.after.actions).toBe(1); expect(job.before.cash).toBe(job.after.cash); }
    expect(purchase.before.cash - purchase.after.cash).toBe(1100); expect(purchase.before.actions).toBe(purchase.after.actions);
    expect(p.starKey.bottles[0]).toMatchObject({ labourSteps: 5, status: 'PLAYER' });
    expect(p.starKey.bottles.slice(1).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0)).toBe(true);
    expect(journal(p).filter(e => e.command.type === 'PREPARE_TASK')).toHaveLength(3);
    expect(originalDoorRoots(p)).toEqual(originalDoorRoots(originalPlaneswalker())); assertValidSliceState(p);
  }, 60_000);
  it('preserves actual paid preparation cancellation and rejects ordinary escape while locked', () => {
    const s = prepared(), event = journal(s).at(-1)!;
    expect(event.command.type).toBe('PREPARE_PROMOTION'); expect(event.before.cash - event.after.cash).toBe(150);
    expect(hasStarKeyLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ae(s, { type: 'LEAVE_PREPARATION' }), cancellation = journal(left).at(-1)!;
    expect(cancellation.after).toEqual(cancellation.before); expect(hasStarKeyLock(left)).toBe(false);
    expect(left.starKey.bottles[0]!.status).toBe('PLAYER'); expect(left.starKey.preparations).toEqual(s.starKey.preparations);
    expect(originalDoorRoots(left)).toEqual(originalDoorRoots(s)); rejectStarKey(left, dose); assertValidSliceState(left);
  }, 60_000);
  it('reconciles the last action through the actual shared weekly bill without free recovery', () => {
    let before = originalPlaneswalker(); before = ordinary(before); before = ordinary(before);
    expect(before.actionsRemaining).toBe(1);
    const s = ae(before, { type: 'LEARN_GUIDANCE' }), e = journal(s).at(-1)!;
    expect(e.after.actions).toBe(0); expect(s.week).toBe(e.week + 1);
    expect(starKeyCompletedAcquisitionBudgetMatches(s, e)).toBe(true);
    expect([s.health, s.mind, s.spirituality]).toEqual([e.after.health, e.after.mind, e.after.spirituality]);
    const forged = structuredClone(s); forged.cash++; expect(validateStarKeyState(forged)).toBe(false);
    const forgedFinance = structuredClone(s); forgedFinance.weeklyBudget++; expect(validateStarKeyState(forgedFinance)).toBe(false);
  }, 60_000);
  it('permits zero-action cancellation, retains its costs and only then settles the week', () => {
    let s = ae(prepared(), { type: 'LEAVE_PREPARATION' });
    while (s.actionsRemaining > 1) s = ordinary(s);
    s = ae(s, { type: 'PREPARE_PROMOTION' });
    expect(s.actionsRemaining).toBe(0); const week = s.week;
    const after = ae(s, { type: 'LEAVE_PREPARATION' }), e = journal(after).at(-1)!;
    expect(e.before).toEqual(e.after); expect(after.week).toBe(week + 1); expect(after.starKey.bottles[0]!.status).toBe('PLAYER');
    expect(starKeyCompletedAcquisitionBudgetMatches(after, e)).toBe(true); assertValidSliceState(after);
  }, 60_000);
  it('records the actual same-seed result and preserves every original bottle and failed cost', () => {
    const before = prepared(), s = ae(before, dose), e = journal(s).at(-1)!, kind = e.check!.tier;
    const succeeds = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    const h = succeeds ? 0 : kind === 'FAILURE' ? 15 : 25, m = kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45;
    expect([e.after.health, e.after.mind, e.after.spirituality]).toEqual([Math.max(1, e.before.health - h), Math.max(1, e.before.mind - m), e.before.spirituality]);
    expect(e.after.sequence).toBe(succeeds ? 1 : 2); expect(e.cursorAfter).toBe(e.cursorBefore + 1); expect(e.randomAfter).toBe(e.randomBefore! + 1);
    expect(s.starKey.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: e.week, preparationWeek: e.week });
    expect(s.starKey.preparedWeek).toBeNull(); expect(originalDoorRoots(s)).toEqual(originalDoorRoots(before));
    for (const id of STAR_KEY_INHERITED_ABILITY_IDS) expect(e.after.mastery[id]).toBe(e.before.mastery[id]);
    expect(validateStarKeyAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 60_000);
  it('finishes with17 exact skills, two new zeros and no free stock or identity change', () => {
    const s = promoted(), source = originalPlaneswalker(), e = journal(s).at(-1)!;
    expect(e.command.type).toBe('CONSUME'); expect(e.after.sequence).toBe(1); expect(s.starKey.planeswalkerActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(s.progression.acting).toBe(0);
    for (const id of STAR_KEY_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const id of STAR_KEY_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(source.progression.mastery[id]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(9);
    const identity = ({ coreStats: _stats, ...rest }: SliceState['character']) => rest;
    expect(identity(s.character)).toEqual(identity(source.character)); expect(originalDoorRoots(s)).toEqual(originalDoorRoots(source));
    expect(s.combatHistory).toEqual(source.combatHistory); expect(s.random.seed).toBe(source.random.seed);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(e.after.coreStats[stat]).toBe(e.before.coreStats[stat] + 1);
    expect(e.after.spirituality).toBe(e.before.spirituality); rejectStarKey(s, dose); assertValidSliceState(s);
  }, 60_000);
  it('does not issue premature or free replacement originals', () => {
    const s = taught(); rejectStarKey(s, { type: 'REQUEST_SUPPLY' }); rejectStarKey(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.starKey.bottles).toHaveLength(3); expect(s.starKey.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    const finish = promoted();
    for (const e of journal(finish).filter(e => e.command.type === 'REQUEST_SUPPLY')) {
      expect(e.before.cash - e.after.cash).toBe(100); expect(e.before.actions - e.after.actions).toBe(1);
      const delivery = journal(finish).find(d => d.command.type === 'RECEIVE_SUPPLY' && d.revision > e.revision)!;
      expect(delivery.week).toBeGreaterThan(e.week); expect(delivery.before).toEqual(delivery.after);
    }
    expect(new Set(finish.starKey.bottles.map(b => b.id)).size).toBe(finish.starKey.bottles.length);
  }, 60_000);
});
