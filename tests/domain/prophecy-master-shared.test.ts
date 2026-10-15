import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createProphecyMasterState, hasProphecyMasterLock } from '../../src/domain/prophecy-master/index.js';
import { PROPHECY_MASTER_ABILITY_IDS } from '../../src/domain/prophecy-master/types.js';
import { createProphecyMasterLifeState, PROPHECY_MASTER_CASE_IDS } from '../../src/domain/prophecy-master/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  promoted: SliceState; practiced: SliceState; craftStart: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/mystic-v01310/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/prophecy-master-v01540/natural.json', 'utf8'));
  for (const key of ['promoted', 'practiced', 'craftStart', 'final'] as const) c[key] = migrateSliceState(c[key]); return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/prophecy-master-v01540/boundaries.json', 'utf8'));
const roots = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic'] as const;
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of roots) {
    if (root !== 'scrollProfessor') expect(s[root]).toEqual(before[root]);
    else {
      const { workshop: actual, ...a } = s.scrollProfessor, { workshop: previous, ...b } = before.scrollProfessor;
      expect(a).toEqual(b); expect(actual.kitsBought).toBe(previous.kitsBought); expect(actual.lastKitWeek).toBe(previous.lastKitWeek);
      expect(actual.materials).toHaveLength(previous.materials.length); expect(previous.materials).toHaveLength(12); expect(previous.scrolls).toHaveLength(8);
      expect(actual.materials.slice(0, 11)).toEqual(previous.materials.slice(0, 11)); expect(actual.scrolls.slice(0, 8)).toEqual(previous.scrolls);
      const crafts = actual.craftAttempts - previous.craftAttempts, failures = actual.craftFailures - previous.craftFailures;
      expect([0, 1]).toContain(crafts); expect(failures).toBeGreaterThanOrEqual(0); expect(failures).toBeLessThanOrEqual(crafts);
      expect(actual.scrolls.length - previous.scrolls.length).toBe(crafts - failures);
      if (crafts === 0) expect(actual).toEqual(previous);
      else {
        const material = actual.materials[11]!, originalMaterial = previous.materials[11]!;
        expect(originalMaterial.status).toBe('HELD'); expect(material).toMatchObject({ id: originalMaterial.id, acquiredWeek: originalMaterial.acquiredWeek, status: 'SPENT' });
        expect(material.spentWeek).toBeGreaterThanOrEqual(before.week); expect(material.spentWeek).toBeLessThanOrEqual(s.week);
        for (const scroll of actual.scrolls.slice(8)) {
          expect(scroll).toMatchObject({ id: 'scroll-professor-scroll-9', kind: 'IMPACT', makerSequence: 3, materialId: originalMaterial.id, createdWeek: material.spentWeek, inscriptionMastery: before.progression.mastery['hermit.s6.scrollcraft'] });
          if (scroll.status === 'HELD') expect(scroll.usedWeek).toBeNull();
          else {
            expect(scroll.authorized).toBe(false); expect(scroll.usedWeek).toBeGreaterThanOrEqual(scroll.createdWeek); expect(scroll.usedWeek).toBeLessThanOrEqual(s.week);
            const rounds = s.combatHistory.slice(before.combatHistory.length).filter(round => round.prophecyMasterOutcome?.playerActions.some(action => action.scroll?.id === scroll.id));
            expect(rounds).toHaveLength(1); const outcome = rounds[0]!.prophecyMasterOutcome!;
            const uses = outcome.playerActions.filter(action => action.scroll?.id === scroll.id);
            expect(uses).toHaveLength(1); expect(uses[0]).toMatchObject({ mode: 'ORIGINAL_SCROLL', paidCost: 1 });
            expect(uses[0]!.scroll).toEqual({ id: scroll.id, materialId: scroll.materialId, makerSequence: scroll.makerSequence, inscriptionMastery: scroll.inscriptionMastery });
            expect(scroll.usedWeek).toBe(outcome.source.week);
          }
        }
      }
    }
  }
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.mystic.encounter).toMatchObject({ targetId: 'MY4-LUCAN-VEY', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 17 });
  expect(s.mystic.encounter.enemyInjuries).toHaveLength(1);
  expect(s.mystic.life.story.readerIds).toHaveLength(105); expect(s.mystic.life.publicDisclosed).toBe(true); expect(s.mystic.life.story.publicationWeek).toBe(108);
  expect(s.mystic.ritual.sample.status).toBe('RETURNED'); expect(s.starMystic.practice.lenses).toBe('WORN');
}

describe('Prophecy Master actual public continuation from preserved Mystic history', () => {
  it('replays creation, all411 original commands and every new public command with the original seed and untouched prefix', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(411); expect(c.prefixCount).toBe(411);
    expect(c.commands.length).toBeGreaterThan(411); expect(c.commands.slice(0, 411)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('pryer-natural-v048'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 410) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates the real W108 state without changing resources, old roots, original knowledge or the next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(174); expect(s.contentVersion).toBe('calamity-demoness-v174'); expect(s.prophecyMaster).toEqual(createProphecyMasterState());
    expect(s).toMatchObject({ week: 108, status: 'ACTIVE', health: 100, mind: 100, spirituality: 112, cash: 750, actionsRemaining: 2, progression: { sequence: 4, acting: 100 }, random: { seed: 'pryer-natural-v048', cursor: 238 } });
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves each old mastery and original at actual S3 promotion while adding exactly one zero mastery', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression.sequence).toBe(3); expect(s.progression.acting).toBe(0); expect(s.prophecyMaster.mysticActingAtPromotion).toBe(100);
    expect(s.prophecyMaster.promotionWeek! - s.mystic.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...PROPHECY_MASTER_ABILITY_IDS]);
    expect(s.progression.mastery['hermit.s3.prophetic-glimpse']).toBe(0); expect(s.prophecyMaster.life).toEqual(createProphecyMasterLifeState());
    expect(s.prophecyMaster.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'PM3-OSRIC', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.mystic.acting).toBe(100);
    expect(view.prophecyMaster.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    expect(view.prophecyMaster).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    expect(view.prophecyMaster.inheritedHistory.join(' ')).toContain('105'); expect(view.prophecyMaster.inheritedHistory.join(' ')).toContain('15%');
    const promotion = Object.values(boundaries()).find(b => b.lastIntent.type === 'PROPHECY_MASTER' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3);
    expect(promotion).toBeTruthy(); expect(s.spirituality).toBe(promotion!.beforeLast.spirituality); expect(s.health).toBe(promotion!.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, promotion!.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays each actual save boundary atomically with unchanged inputs and exact original histories', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final);
    }
  }, 30_000);
  it('completes three finite reports and reflection without requiring every natural glimpse to succeed', () => {
    const s = capture().practiced, life = s.prophecyMaster.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'hermit', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...PROPHECY_MASTER_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null });
    expect(hasProphecyMasterLock(s)).toBe(false); expect(life.playerTravelMetres).toBeGreaterThan(0); expect(life.clockSeconds).toBeGreaterThan(0);
    expect(Object.values(life.records).every(item => item.location === 'OWNER')).toBe(true);
    expect(life.parcel).toMatchObject({ id: 'PM3-PARCEL', location: 'RECEIVER', massGrams: 800, sealed: true });
    expect(life.receipt).toMatchObject({ id: 'PM3-RECEIPT', location: 'OWNER', signed: true });
    expect(life.instrument).toMatchObject({ id: 'PM3-SEALED-ECHO', location: 'A', coreSealed: true, residualLevel: 1 });
    expect(life.shutter.state).toBe('CLOSED');
    const actualAbilityReports = Object.values(life.cases).filter(scene => scene.result === 'ABILITY').length;
    expect(s.progression.mastery['hermit.s3.prophetic-glimpse']).toBe(actualAbilityReports * 8);
    for (const caseId of PROPHECY_MASTER_CASE_IDS) {
      const scene = life.cases[caseId], attempt = scene.attempts.at(-1)!;
      expect(attempt).toMatchObject({ closed: true, recordReturned: true, inspected: true, compared: true });
      expect(attempt.evidence.length).toBeGreaterThan(0); expect(attempt.correction).not.toBeNull();
      expect(attempt.playerMoves.every(move => move.mode === 'WALK' && move.metres === move.seconds)).toBe(true);
      expect(attempt.playerTravelMetres).toBe(attempt.playerMoves.reduce((sum, move) => sum + move.metres, 0));
      if (attempt.glimpseTier !== null) {
        expect([attempt.spiritualitySpent, attempt.mindSpent]).toEqual([6, 2]); expect(attempt.glimpseText).not.toBeNull();
        for (const evidence of attempt.evidence) expect(evidence.atSecond).toBeGreaterThanOrEqual(attempt.glimpseAtSecond!);
        if (['FAILURE', 'GREAT_FAILURE'].includes(attempt.glimpseTier)) expect(scene.result).toBe('ORDINARY');
      }
      if (caseId !== 'bounded-source') {
        expect(['ALARM', 'HANDOVER']).toContain(attempt.hypothesis); expect(attempt.hypothesisAtSecond).not.toBeNull();
        for (const evidence of attempt.evidence) expect(evidence.atSecond).toBeGreaterThanOrEqual(attempt.hypothesisAtSecond!);
      } else expect(attempt).toMatchObject({ stopped: true, warningRead: true, shutterClosed: true, ordinaryChecked: true });
      for (const evidence of attempt.evidence) expect(attempt.comparedAtSecond).toBeGreaterThanOrEqual(evidence.atSecond);
    }
  });
  it('keeps later physical outcomes out of pre-observation saved projections', () => {
    const saved = Object.values(boundaries()).filter(b => b.lastIntent.type === 'PROPHECY_MASTER' && b.lastIntent.command.type === 'GLIMPSE');
    expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const s = migrateSliceState(b.final), view = projectSliceState(s).prophecyMaster.life;
      if (b.lastIntent.type !== 'PROPHECY_MASTER' || b.lastIntent.command.type !== 'GLIMPSE') throw new Error('Expected actual glimpse boundary.');
      const attempt = view.currentAttempt!; expect(attempt.glimpseTier).not.toBeNull(); expect(attempt.evidence).toEqual([]); expect(attempt.correction).toBeNull();
      expect(attempt.hypothesis).toBeNull(); expect(attempt.comparedAtSecond).toBeNull();
      if (b.lastIntent.command.caseId === 'bell-schedule') { expect(view.bell.witnessedEvent).toBeNull(); expect(view.bell.rings).toBe(0); }
      if (b.lastIntent.command.caseId === 'covered-door') { expect(view.door.locked).toBeNull(); expect(view.curtain.state).toBeNull(); expect(view.receipt.signed).toBe(false); expect(view.parcel.location).toBe('PLAYER'); }
      expect(s.mystic.life.story).toEqual(original().final.mystic.life.story);
    }
  });
  it('records actual successful or failed bottles with a separate same-week paid preparation', () => {
    const s = capture().promoted;
    expect(s.prophecyMaster.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const bottle of s.prophecyMaster.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^prophecy-master-potion-/);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(s.mystic.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(s.prophecyMaster.promotionWeek!);
    }
    expect(s.prophecyMaster.preparedWeek).toBeNull(); expect(s.prophecyMaster.preparations).toHaveLength(3);
  });
  it('shows the actual held S3 bottle in the ordinary bag and removes only the consumed original', () => {
    const all = Object.values(boundaries());
    const purchase = all.find(b => b.lastIntent.type === 'PROPHECY_MASTER' && b.lastIntent.command.type === 'BUY_POTION')!;
    const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'PROPHECY_MASTER' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false);
    expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'PROPHECY_MASTER' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('uses original material12 for exactly one honest S3 crafting attempt and preserves originals1–8', () => {
    const c = capture(), old = original().final;
    expect(c.craftStart.scrollProfessor).toEqual(old.scrollProfessor); assertValidSliceState(c.craftStart);
    const saved = Object.values(boundaries());
    const craft = saved.find(b => 'command' in b.lastIntent && b.lastIntent.command.type === 'CRAFT_SCROLL');
    expect(craft).toBeTruthy();
    const before = migrateSliceState(craft!.beforeLast), after = migrateSliceState(craft!.final);
    expect(before.progression.sequence).toBe(3); expect(before.scrollProfessor.workshop.materials[11]!.status).toBe('HELD');
    expect(after.scrollProfessor.workshop.materials[11]).toMatchObject({ id: 'scroll-professor-material-12', acquiredWeek: 50, status: 'SPENT', spentWeek: before.week });
    expect(after.scrollProfessor.workshop.craftAttempts).toBe(before.scrollProfessor.workshop.craftAttempts + 1);
    expect(applySliceIntent(before, craft!.lastIntent)).toEqual(after); expectOriginals(after, old);
    const created = after.scrollProfessor.workshop.scrolls.slice(8);
    expect(created).toHaveLength(after.scrollProfessor.workshop.craftFailures === before.scrollProfessor.workshop.craftFailures ? 1 : 0);
    const authorization = saved.find(b => 'command' in b.lastIntent && b.lastIntent.command.type === 'AUTHORIZE_SCROLL');
    if (created.length === 0) expect(authorization).toBeUndefined();
    else {
      expect(created[0]).toMatchObject({ id: 'scroll-professor-scroll-9', makerSequence: 3, materialId: 'scroll-professor-material-12', status: 'HELD', usedWeek: null, authorized: false });
      expect(authorization).toBeTruthy(); expect(applySliceIntent(migrateSliceState(authorization!.beforeLast), authorization!.lastIntent)).toEqual(migrateSliceState(authorization!.final));
    }
  });
  it('prevents reopening the old blood analysis, new story creation and original S4 redosing after promotion', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'OPEN_ANALYSIS' }, { type: 'CONSUME', bottleId: s.mystic.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'sealed-story' }] as const) expect(() => applySliceIntent(s, { type: 'MYSTIC', command })).toThrow();
    expect(projectSliceState(s).mystic.actions.every(a => !a.enabled && !!a.reason)).toBe(true); expect(JSON.stringify(s)).toBe(bytes);
  });
  it('keeps the independent opponent and actual optional-combat outcome without assuming victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.prophecyMaster.encounter, rounds = s.combatHistory.filter(r => r.prophecyMasterOutcome);
    expect(encounter.targetId).toBe('PM3-OSRIC'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    if (rounds.length > 0) expect(encounter.terminal).not.toBeNull();
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'PROPHECY_MASTER', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasProphecyMasterLock(s)).toBe(false); }
  });
});
