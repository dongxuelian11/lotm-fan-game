import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { playerText } from '../../src/shared/player-text.js';
import { BLATHERER_FORMULA_STATUS, BLATHERER_SOURCE_STATUS } from '../../src/domain/blatherer/content.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createBlathererState, hasBlathererLock } from '../../src/domain/blatherer/index.js';
import { BLATHERER_ABILITY_IDS } from '../../src/domain/blatherer/types.js';
import { createBlathererLifeState, BLATHERER_CASE_IDS } from '../../src/domain/blatherer/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  promoted: SliceState; practiced: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/devil-v01330/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/blatherer-v01560/natural.json', 'utf8'));
  for (const key of ['promoted', 'practiced', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/blatherer-v01560/boundaries.json', 'utf8'));
const roots = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'devil'] as const;
function expectOriginals(s: SliceState, before: SliceState, allowActualStrain = false) {
  for (const root of roots) {
    if (root !== 'demon' || !allowActualStrain) expect(s[root]).toEqual(before[root]);
    else {
      const { strain: current, ...actual } = s.demon, { strain: previous, ...old } = before.demon;
      expect(actual).toEqual(old); expect(current).toBeGreaterThanOrEqual(0); expect(current).toBeLessThanOrEqual(3);
      const rounds = s.combatHistory.slice(before.combatHistory.length).filter(round => round.blathererOutcome);
      if (rounds.length === 0) expect(current).toBe(previous);
      else expect(current).toBe(rounds.at(-1)!.blathererOutcome!.playerStrainAfter);
    }
  }
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed); expect(s.unwinged.conscienceLost).toBe(true);
  expect(s.devil.life.invitation.declined).toBe(true); expect(s.devil.life.stage.programHolder).toBe('MIREL');
  expect(s.devil.encounter).toMatchObject({ targetId: 'DV4-ORRICK-FANE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 32 });
  expect(s.devil.encounter.enemyInjuries).toHaveLength(1); expect(s.devil.encounter.enemyInjuries[0]!.severity).toBe('HEAVY');
}

describe('Blatherer actual public continuation from preserved Devil history', () => {
  it('replays creation, all434 original commands and every new public command with the exact original seed and prefix', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(434); expect(c.prefixCount).toBe(434);
    expect(c.commands.length).toBeGreaterThan(434); expect(c.commands.slice(0, 434)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('criminal-natural-v054'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 433) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final, true);
  }, 30_000);
  it('migrates W121 without changing resources, original six roots or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(175); expect(s.contentVersion).toBe('sage-v175'); expect(s.blatherer).toEqual(createBlathererState());
    expect(s).toMatchObject({ week: 121, status: 'ACTIVE', health: 100, mind: 100, spirituality: 116, cash: 430, actionsRemaining: 2, progression: { sequence: 4, acting: 100 }, random: { seed: 'criminal-natural-v054', cursor: 100 } });
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every old mastery and original at actual S3 promotion, adding exactly one zero mastery', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression).toMatchObject({ pathwayId: 'abyss', sequence: 3, acting: 0 }); expect(s.blatherer.devilActingAtPromotion).toBe(100);
    expect(s.blatherer.promotionWeek! - s.devil.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...BLATHERER_ABILITY_IDS]);
    expect(s.progression.mastery['abyss.s3.limited-murmur']).toBe(0); expect(s.blatherer.life).toEqual(createBlathererLifeState());
    expect(s.blatherer.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'BL3-EDRIC', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.devil.acting).toBe(100);
    expect(view.blatherer.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    expect(view.blatherer).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    for (const text of ['DV4-ORRICK-FANE', 'SURRENDERED', '原恶魔紧绷3/3', '拒绝仍保留']) expect(view.blatherer.inheritedHistory.join(' ')).toContain(text);
    const authoredStory = `${BLATHERER_FORMULA_STATUS}${BLATHERER_SOURCE_STATUS}`;
    // Research attribution remains in authored content; the public copy preserves the real limits.
    for (const text of ['人物推断', '原创G']) {
      expect(authoredStory).toContain(text); expect(view.blatherer.story).not.toContain(text);
    }
    expect(view.blatherer.story).toBe(playerText(authoredStory));
    for (const text of ['完整配方尚未掌握', '服用前需要专业准备', '不开放自制配方', '6米听距', '2秒输入', '30秒残留', '4灵性1精神与知识18检定', '不保证安全消化', '不恢复原有良知']) expect(view.blatherer.story).toContain(text);
    const promotion = Object.values(boundaries()).find(b => b.lastIntent.type === 'BLATHERER' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3);
    expect(promotion).toBeTruthy(); expect(s.spirituality).toBe(promotion!.beforeLast.spirituality); expect(s.health).toBe(promotion!.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, promotion!.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays every actual save boundary atomically with unchanged input, intent and original histories', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final, true);
    }
  }, 30_000);
  it('finishes three finite reports and reflection without requiring natural whisper success', () => {
    const s = capture().practiced, life = s.blatherer.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'abyss', sequence: 3, acting: 100 }); expect(Object.keys(life.cases)).toEqual([...BLATHERER_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasBlathererLock(s)).toBe(false);
    expect(life.clockSeconds).toBeGreaterThan(0); expect(life.playerTravelMetres).toBeGreaterThan(0);
    const actualAbilityReports = Object.values(life.cases).filter(scene => scene.result === 'ABILITY').length;
    expect(s.progression.mastery['abyss.s3.limited-murmur']).toBe(actualAbilityReports * 8);
    expect(projectSliceState(s).blatherer.digestion).toContain('和平100不保证安全消化');
    expect(life.card).toMatchObject({ id: 'BL3-CARD', owner: 'BL3-NORA', location: 'NORA', quantity: 1 });
    expect(life.volunteer).toMatchObject({ id: 'BL3-NORA', name: '诺拉·温特', age: 46, alive: true, location: 'A' });
    for (const caseId of BLATHERER_CASE_IDS) {
      const scene = life.cases[caseId], attempt = scene.attempts.at(-1)!;
      expect(attempt).toMatchObject({ closed: true, voiceActive: false, residualSeconds: 0, cardRead: true, bellRead: true, outcomeRecorded: true, resolutionActions: 1 });
      expect(attempt.playerMoves.every(move => move.mode === 'WALK' && move.metres === move.seconds)).toBe(true);
      expect(attempt.playerTravelMetres).toBe(attempt.playerMoves.reduce((sum, move) => sum + move.metres, 0));
      if (attempt.whisperTier !== null) {
        expect([attempt.spiritualitySpent, attempt.mindSpent]).toEqual([4, 1]); expect(attempt.whisperSourceId).toBe('BL3-NORA');
        expect(attempt).toMatchObject({ stopped: true, waitCompleted: true });
        expect(attempt.waitedSeconds).toBe(['SUCCESS', 'GREAT_SUCCESS'].includes(attempt.whisperTier) ? 30 : 0);
        if (['FAILURE', 'GREAT_FAILURE'].includes(attempt.whisperTier)) { expect(attempt.ordinaryChecked).toBe(true); expect(scene.result).toBe('ORDINARY'); }
      } else { expect([attempt.spiritualitySpent, attempt.mindSpent]).toEqual([0, 0]); expect(scene.result).toBe('ORDINARY'); }
      if (caseId === 'withdrawn-invitation') { expect(attempt.currentAnswer).toBe('DECLINED'); expect(attempt.cardTaken).toBe(false); }
    }
  });
  it('persists real stop-input boundaries without silently clearing successful residual hesitation', () => {
    const stops = Object.values(boundaries()).filter(b => b.lastIntent.type === 'BLATHERER' && b.lastIntent.command.type === 'STOP_VOICE');
    for (const b of stops) {
      if (b.lastIntent.type !== 'BLATHERER' || b.lastIntent.command.type !== 'STOP_VOICE') throw new Error('Expected exact saved stop.');
      const before = migrateSliceState(b.beforeLast), after = migrateSliceState(b.final), id = b.lastIntent.command.caseId;
      const previous = before.blatherer.life.cases[id].attempts.at(-1)!, current = after.blatherer.life.cases[id].attempts.at(-1)!;
      expect(current.voiceActive).toBe(false); expect(current.residualSeconds).toBe(previous.residualSeconds);
      expect(after.spirituality).toBe(before.spirituality); expect(after.mind).toBe(before.mind); expect(after.health).toBe(before.health);
      expect(after.blatherer.life.clockSeconds).toBe(before.blatherer.life.clockSeconds);
      if (previous.residualSeconds > 0) { expect(hasBlathererLock(after)).toBe(true); expect(current.waitCompleted).toBe(false); }
      assertValidSliceState(after); expect(migrateSliceState(after)).toEqual(after);
    }
  });
  it('records each real bottle outcome with an independent same-week140 preparation and retained originals', () => {
    const s = capture().promoted;
    expect(s.blatherer.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const bottle of s.blatherer.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^blatherer-potion-/);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(s.devil.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(s.blatherer.promotionWeek!);
    }
    expect(s.blatherer.preparedWeek).toBeNull(); expect(s.blatherer.preparations).toHaveLength(3);
  });
  it('shows the purchased original in the ordinary bag and removes only that consumed original', () => {
    const all = Object.values(boundaries());
    const purchase = all.find(b => b.lastIntent.type === 'BLATHERER' && b.lastIntent.command.type === 'BUY_POTION')!;
    expect(purchase).toBeTruthy(); const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'BLATHERER' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false); expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'BLATHERER' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(dose).toBeTruthy(); expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('does not redose old Devil originals or reopen surrendered Orrick after promotion', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'stage-decision' }] as const) expect(() => applySliceIntent(s, { type: 'DEVIL', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expectOriginals(s, original().final);
  });
  it('retains the independent opponent and real optional-combat terminal without assuming victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old, true); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.blatherer.encounter, rounds = s.combatHistory.filter(r => r.blathererOutcome);
    expect(encounter.targetId).toBe('BL3-EDRIC'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.ARC_BOLT * 5 - encounter.powerUses.WARD * 4);
    if (rounds.length > 0) expect(encounter.terminal).not.toBeNull();
    for (const round of rounds) {
      const outcome = round.blathererOutcome!;
      expect(outcome.source.targetId).toBe('BL3-EDRIC'); expect(outcome.source.enemyWeapon).toBe('BL3-EDRIC-ROD');
      expect(outcome.playerStrainAfter).toBe(outcome.source.strain + outcome.playerActions.reduce((sum, action) => sum + action.strainCost, 0));
      expect(outcome.enemySpirituality).toBe(outcome.enemySpiritualityBefore - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
    }
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'BLATHERER', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasBlathererLock(s)).toBe(false); }
  });
});
