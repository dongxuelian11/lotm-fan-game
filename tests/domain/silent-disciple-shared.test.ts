import { playerText } from '../../src/shared/player-text.js';
import { SILENT_DISCIPLE_FORMULA_STATUS, SILENT_DISCIPLE_SOURCE_STATUS } from '../../src/domain/silent-disciple/content.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createSilentDiscipleState, hasSilentDiscipleLock } from '../../src/domain/silent-disciple/index.js';
import { SILENT_DISCIPLE_ABILITY_IDS } from '../../src/domain/silent-disciple/types.js';
import { createSilentDiscipleLifeState, SILENT_DISCIPLE_CASE_IDS } from '../../src/domain/silent-disciple/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  promoted: SliceState; practiced: SliceState; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/puppet-v01340/natural.json', 'utf8'));
function capture(): Capture {
  const c: Capture = JSON.parse(readFileSync('tests/fixtures/silent-disciple-v01570/natural.json', 'utf8'));
  for (const key of ['promoted', 'practiced', 'final'] as const) c[key] = migrateSliceState(c[key]);
  return c;
}
const boundaries = (): Record<string, Boundary> => JSON.parse(readFileSync('tests/fixtures/silent-disciple-v01570/boundaries.json', 'utf8'));
const roots = ['prisoner', 'madman', 'werewolf', 'zombie', 'wraith', 'puppet'] as const;
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of roots) expect(s[root]).toEqual(before[root]);
  expect(s.character.age).toBe(before.character.age); expect(s.character.gender).toBe(before.character.gender);
  expect(s.runId).toBe(before.runId); expect(s.random.seed).toBe(before.random.seed);
  expect(s.puppet.encounter).toMatchObject({ targetId: 'PU4-EDRIN-VALE', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 13, form: 'HUMAN', link: 'NONE' });
  expect(s.puppet.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']);
  expect(s.puppet.encounter.blocks.map(b => [b.id, b.status, b.location])).toEqual([['PU4-BLOCK-1', 'SPENT', 'TARGET_GROUND'], ['PU4-BLOCK-2', 'SPENT', 'TARGET_GROUND'], ['PU4-BLOCK-3', 'READY', 'SOURCE']]);
}

describe('SilentDisciple actual public continuation from preserved Puppet history', () => {
  it('replays creation, all407 original commands and every new public command with the exact original seed and prefix', () => {
    const c = capture(), old = original(); expect(old.commands).toHaveLength(407); expect(c.prefixCount).toBe(407);
    expect(c.commands.length).toBeGreaterThan(407); expect(c.commands.slice(0, 407)).toEqual(old.commands);
    expect(c.creation).toEqual(old.creation); expect(c.seed).toBe('prisoner-natural-v057'); expect(c.seed).toBe(old.seed);
    let s = createSliceRun(c.final.runId, c.creation, c.seed);
    for (const [index, command] of c.commands.entries()) { s = applySliceIntent(s, command); if (index === 406) expect(s).toEqual(migrateSliceState(old.final)); }
    expect(s).toEqual(c.final); assertValidSliceState(s); expectOriginals(s, old.final);
  }, 30_000);
  it('migrates W103 without changing resources, original six roots or next RNG', () => {
    const old = original().final, bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(s.schemaVersion).toBe(174); expect(s.contentVersion).toBe('calamity-demoness-v174'); expect(s.silentDisciple).toEqual(createSilentDiscipleState());
    expect(s).toMatchObject({ week: 103, status: 'ACTIVE', health: 70, mind: 100, spirituality: 115, cash: 900, actionsRemaining: 2, progression: { sequence: 4, acting: 100 }, random: { seed: 'prisoner-natural-v057', cursor: 192 } });
    for (const [key, value] of Object.entries(old)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    expectOriginals(s, old); expect(JSON.stringify(old)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('preserves every old mastery and original at actual S3 promotion, adding exactly two zero masteries', () => {
    const s = capture().promoted, old = original().final; assertValidSliceState(s); expectOriginals(s, old);
    expect(s.progression).toMatchObject({ pathwayId: 'chained', sequence: 3, acting: 0 }); expect(s.silentDisciple.puppetActingAtPromotion).toBe(100);
    expect(s.silentDisciple.promotionWeek! - s.puppet.promotionWeek!).toBeGreaterThanOrEqual(12);
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(old.progression.mastery, id))).toEqual([...SILENT_DISCIPLE_ABILITY_IDS]);
    expect(s.progression.mastery['chained.s3.short-transfiguration']).toBe(0); expect(s.progression.mastery['chained.s3.measured-curse']).toBe(0); expect(s.silentDisciple.life).toEqual(createSilentDiscipleLifeState());
    expect(s.silentDisciple.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'SD3-CALDER', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    const view = projectSliceState(s); expect(view.maxSpirituality).toBe(120); expect(view.puppet.acting).toBe(100);
    expect(view.silentDisciple.abilities.map(a => a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
    expect(view.silentDisciple).toMatchObject({ promoted: true, formulaKnown: false, formula: [] });
    for (const text of ['PU4-EDRIN-VALE', 'SURRENDERED', '原伤势2处', '原诺兰NOLAN']) expect(view.silentDisciple.inheritedHistory.join(' ')).toContain(text);
    expect(SILENT_DISCIPLE_FORMULA_STATUS).toContain('有直接原核'); expect(SILENT_DISCIPLE_SOURCE_STATUS).toContain('原创G');
    expect(view.silentDisciple.story).toBe(playerText(SILENT_DISCIPLE_FORMULA_STATUS+SILENT_DISCIPLE_SOURCE_STATUS));
    expect(view.silentDisciple.story).not.toMatch(/有直接原核|原创G/);
    for(const text of ['完整配方尚未掌握','主辅材料、用量、调配顺序和完整仪式均保持未知','三项真实专业准备和当周原房检查','不开放自制魔药','本人实际处于诅咒形态并真实受伤，目标可抵抗','不提供零自伤、无限反射、自动沉默或永久禁言','各阶段诅咒取代旧发作，不叠加','和平100仍有实际成本，不保证安全消化或治愈诅咒','不赠送第二身体、尸体、天使权限或永久变形'])expect(view.silentDisciple.story).toContain(text);
    const promotion = Object.values(boundaries()).find(b => b.lastIntent.type === 'SILENT_DISCIPLE' && b.lastIntent.command.type === 'CONSUME' && b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3);
    expect(promotion).toBeTruthy(); expect(s.spirituality).toBe(promotion!.beforeLast.spirituality); expect(s.health).toBe(promotion!.beforeLast.health);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(Math.min(500, promotion!.beforeLast.character.coreStats[stat] + 1));
  });
  it('replays every actual save boundary atomically with unchanged input, intent and original histories', () => {
    const saved = Object.values(boundaries()); expect(saved.length).toBeGreaterThan(0);
    for (const b of saved) {
      const before = migrateSliceState(b.beforeLast), expected = migrateSliceState(b.final), input = JSON.stringify(before), intent = JSON.stringify(b.lastIntent);
      assertValidSliceState(before); assertValidSliceState(expected); expect(applySliceIntent(before, b.lastIntent)).toEqual(expected);
      expect(JSON.stringify(before)).toBe(input); expect(JSON.stringify(b.lastIntent)).toBe(intent); expect(migrateSliceState(expected)).toEqual(expected); expectOriginals(expected, original().final);
    }
  }, 30_000);
  it('finishes actual original-body reports without assuming every natural attempt succeeded', () => {
    const s = capture().practiced, life = s.silentDisciple.life; assertValidSliceState(s); expectOriginals(s, original().final);
    expect(s.progression).toMatchObject({ pathwayId: 'chained', sequence: 3, acting: 100 });
    expect(Object.keys(life.cases)).toEqual([...SILENT_DISCIPLE_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(life).toMatchObject({ reflected: true, playerLocation: 'START', activeCase: null }); expect(hasSilentDiscipleLock(s)).toBe(false);
    expect(life.volunteer).toMatchObject({ id: 'SD3-ELSA', bodyId: 'SD3-ELSA', name: '埃尔莎·莫尔', age: 43, alive: true, location: 'A', form: 'HUMAN', health: 100, mind: 100, spirituality: 100, injuries: [] });
    expect(life.clothing).toEqual({ id: 'SD3-CLOTHES', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true });
    expect(life.bag).toEqual({ id: 'SD3-BAG', owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' });
    expect(life.tray).toEqual({ id: 'SD3-TRAY', location: 'A', privacy: 'PRIVATE' });
    const formSuccesses = ['original-body', 'revoked-form'].filter(id => life.cases[id as 'original-body' | 'revoked-form'].result === 'ABILITY').length;
    expect(s.progression.mastery['chained.s3.short-transfiguration']).toBe(formSuccesses * 8);
    expect(s.progression.mastery['chained.s3.measured-curse']).toBe(life.cases['measured-link'].result === 'ABILITY' ? 8 : 0);
    expect(projectSliceState(s).silentDisciple.digestion).toContain('和平100不保证安全消化或消除诅咒');
    for (const caseId of SILENT_DISCIPLE_CASE_IDS) {
      const scene = life.cases[caseId], attempt = scene.attempts.at(-1)!;
      expect(attempt).toMatchObject({ closed: true, inputActive: false, formRemainingSeconds: 0, linkRemainingSeconds: 0, linkState: 'NONE', identityRead: true, noteRead: true, identityCompared: true, outcomeRecorded: true, resolutionActions: 1 });
      expect(attempt.playerTravelMetres).toBe(16); expect(attempt.playerMoves.every(move => move.mode === 'WALK' && move.metres === move.seconds && move.itemIds.length === 0)).toBe(true);
      expect(attempt.playerTravelMetres).toBe(attempt.playerMoves.reduce((sum, move) => sum + move.metres, 0));
      expect(attempt.evidence.some(e => e.sourceId === 'SD3-NOTE')).toBe(true); expect(attempt.evidence.some(e => e.sourceId === 'SD3-ELSA')).toBe(true);
      if (attempt.abilityTier !== null) {
        const extraRelease = attempt.steps.some(step => step.type === 'RELEASE_FORM') ? 2 : 0;
        expect([attempt.spiritualitySpent, attempt.mindSpent]).toEqual([caseId === 'measured-link' ? 4 : 5 + extraRelease, caseId === 'measured-link' ? 1 : 2]);
        expect(attempt.abilitySourceId).toBe('SD3-ELSA'); expect(attempt.stopped).toBe(true); expect(attempt.waitCompleted || attempt.released).toBe(true);
        if (caseId !== 'measured-link') expect(attempt).toMatchObject({ itemsStored: true, itemsReturned: true });
        if (['FAILURE', 'GREAT_FAILURE'].includes(attempt.abilityTier)) { expect(attempt.ordinaryChecked).toBe(true); expect(scene.result).toBe('ORDINARY'); }
        if (caseId === 'revoked-form') expect(attempt.consent).toBe('REVOKED');
      } else { expect([attempt.spiritualitySpent, attempt.mindSpent]).toEqual([0, 0]); expect(scene.result).toBe('ORDINARY'); }
    }
  });
  it('saves stop-input without free restoration and waits the exact remaining duration on the same body', () => {
    const all = Object.values(boundaries());
    for (const b of all) {
      if (b.lastIntent.type !== 'SILENT_DISCIPLE' || !['STOP_INPUT', 'WAIT_FORM', 'RETURN_ITEMS'].includes(b.lastIntent.command.type) || !('caseId' in b.lastIntent.command)) continue;
      const before = migrateSliceState(b.beforeLast), after = migrateSliceState(b.final), id = b.lastIntent.command.caseId;
      const previous = before.silentDisciple.life.cases[id].attempts.at(-1)!, current = after.silentDisciple.life.cases[id].attempts.at(-1)!;
      expect(after.health).toBe(before.health); expect(after.mind).toBe(before.mind); expect(after.spirituality).toBe(before.spirituality); expect(after.actionsRemaining).toBe(before.actionsRemaining);
      expect(after.silentDisciple.life.volunteer.bodyId).toBe(before.silentDisciple.life.volunteer.bodyId);
      if (b.lastIntent.command.type === 'STOP_INPUT') {
        expect(current.inputActive).toBe(false); expect(current.formRemainingSeconds).toBe(previous.formRemainingSeconds); expect(current.linkRemainingSeconds).toBe(previous.linkRemainingSeconds);
        expect(after.silentDisciple.life.volunteer).toEqual(before.silentDisciple.life.volunteer); expect(after.silentDisciple.life.clockSeconds).toBe(before.silentDisciple.life.clockSeconds);
      } else if (b.lastIntent.command.type === 'WAIT_FORM') {
        expect(after.silentDisciple.life.clockSeconds - before.silentDisciple.life.clockSeconds).toBe(previous.formRemainingSeconds);
        expect(current.waitedSeconds - previous.waitedSeconds).toBe(previous.formRemainingSeconds); expect(current.formRemainingSeconds).toBe(0);
        expect(after.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(after.silentDisciple.life.clothing).toEqual(before.silentDisciple.life.clothing); expect(after.silentDisciple.life.bag).toEqual(before.silentDisciple.life.bag);
      } else {
        expect(before.silentDisciple.life.volunteer.form).toBe('HUMAN'); expect(after.silentDisciple.life.clothing).toMatchObject({ owner: 'SD3-ELSA', quantity: 1, location: 'ELSA', worn: true });
        expect(after.silentDisciple.life.bag).toMatchObject({ owner: 'SD3-ELSA', quantity: 1, location: 'ELSA' });
      }
      assertValidSliceState(after); expect(migrateSliceState(after)).toEqual(after);
    }
  });
  it('records each real bottle outcome with an independent same-week140 preparation and retained originals', () => {
    const s = capture().promoted;
    expect(s.silentDisciple.bottles.filter(b => b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).toHaveLength(1);
    for (const bottle of s.silentDisciple.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(bottle.preparationWeek).toBe(bottle.consumedWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^silent-disciple-potion-/);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(s.puppet.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(s.silentDisciple.promotionWeek!);
    }
    expect(s.silentDisciple.preparedWeek).toBeNull(); expect(s.silentDisciple.preparations).toHaveLength(3);
  });
  it('shows the purchased original in the ordinary bag and removes only that consumed original', () => {
    const all = Object.values(boundaries());
    const purchase = all.find(b => b.lastIntent.type === 'SILENT_DISCIPLE' && b.lastIntent.command.type === 'BUY_POTION')!;
    expect(purchase).toBeTruthy(); const before = migrateSliceState(purchase.beforeLast), after = migrateSliceState(purchase.final);
    const id = purchase.lastIntent.type === 'SILENT_DISCIPLE' && 'bottleId' in purchase.lastIntent.command ? purchase.lastIntent.command.bottleId : '';
    expect(projectSliceState(before).town.items.some(item => item.id === id)).toBe(false); expect(projectSliceState(after).town.items.filter(item => item.id === id)).toHaveLength(1);
    const dose = all.find(b => b.lastIntent.type === 'SILENT_DISCIPLE' && b.lastIntent.command.type === 'CONSUME' && b.lastIntent.command.bottleId === id)!;
    expect(dose).toBeTruthy(); expect(projectSliceState(migrateSliceState(dose.final)).town.items.some(item => item.id === id)).toBe(false);
  });
  it('does not redose old Puppet originals or reopen surrendered Edrin after promotion', () => {
    const s = capture().promoted, bytes = JSON.stringify(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true }, { type: 'OBSERVE', caseId: 'moving-token' }] as const) expect(() => applySliceIntent(s, { type: 'PUPPET', command })).toThrow();
    expect(JSON.stringify(s)).toBe(bytes); expectOriginals(s, original().final);
  });
  it('retains the independent opponent and real optional-combat terminal without assuming victory or survival', () => {
    const s = capture().final, old = original().final; assertValidSliceState(s); expectOriginals(s, old); expect(s.combat).toBeNull();
    expect(s.combatHistory.slice(0, old.combatHistory.length)).toEqual(old.combatHistory);
    const encounter = s.silentDisciple.encounter, rounds = s.combatHistory.filter(r => r.silentDiscipleOutcome);
    expect(encounter.targetId).toBe('SD3-CALDER'); expect(encounter.enemySpirituality).toBeLessThanOrEqual(120);
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.ARC_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.BREAK_CURSE * 4);
    expect(encounter).toMatchObject({ form: 'HUMAN', enemyForm: 'HUMAN', enemyFormUntilSeconds: null, link: 'NONE' });
    for (const round of rounds) {
      const outcome = round.silentDiscipleOutcome!;
      expect(outcome.source).toMatchObject({ targetId: 'SD3-CALDER', enemyWeapon: 'SD3-CALDER-ROD', weaponOwner: 'SD3-CALDER', actualOriginalBody: true, targetAge: 47, targetSequence: 4 });
      expect(outcome.enemySpirituality).toBe(outcome.enemySpiritualityBefore - outcome.enemyActions.reduce((sum, a) => sum + a.paidCost, 0));
      expect(outcome.playerMindAfter).toBe(outcome.source.playerMind - outcome.playerActions.reduce((sum, a) => sum + a.mentalCost, 0));
      expect(outcome.playerSpiritualityAfter).toBe(outcome.playerSpiritualityBefore - outcome.playerActions.reduce((sum, a) => sum + a.paidCost + a.burstSpiritualCost, 0));
      expect(outcome.elapsedSeconds).toBe(60); expect(outcome.lifeClockSecondsAfter).toBe(outcome.source.lifeClockSeconds + 60);
      if (!outcome.cursePolicy) expect(outcome.reflection).toBeNull();
      for (const action of outcome.enemyActions.filter(a => a.actual === 'PICK_UP')) expect(action).toMatchObject({ paidCost: 0, weaponBefore: 'COURT', weaponAfter: 'HAND', selfGain: 0, enemyReduction: 0 });
    }
    if (rounds.length > 0) expect(encounter.terminal).not.toBeNull();
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); expect(() => applySliceIntent(s, { type: 'SILENT_DISCIPLE', command: { type: 'PREPARE_PROMOTION' } })).toThrow(); }
    else { expect(s.status).toBe('ACTIVE'); expect(s.health).toBeGreaterThan(0); expect(hasSilentDiscipleLock(s)).toBe(false); }
  });
  it('preserves an earned original Zombie encounter after a later actual fatal common-injury round', () => {
    const all = Object.values(boundaries()), b = all.find(v => v.lastIntent.type === 'COMBAT_ROUND')!;
    const before = migrateSliceState(b.beforeLast); before.random.cursor = 3;
    const after = applySliceIntent(before, { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' });
    expect(after.status).toBe('DEAD'); expect(after.health).toBe(0); assertValidSliceState(after);
    expect(after.zombie).toEqual(before.zombie); expect(after.seer.completedSources).toContain('zombie-dispute');
    expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after); expectOriginals(after, original().final);
  });

  it('replays the explicitly directed form and next pickup as full public save boundaries', () => {
    const d = JSON.parse(readFileSync('tests/fixtures/silent-disciple-v01570/directed-form.json', 'utf8'));
    expect(d.provenance.kind).toBe('DIRECTED_RNG_START_THEN_PUBLIC_COMMANDS'); expect(d.provenance.selectedCursor).not.toBe(d.provenance.naturalCursor);
    for (const key of ['form', 'pickup']) {
      const b = d[key], before = migrateSliceState(b.beforeLast), after = migrateSliceState(b.final);
      assertValidSliceState(before); assertValidSliceState(after); expect(applySliceIntent(before, b.lastIntent)).toEqual(after); expectOriginals(after, original().final);
    }
    expect(d.form.final.silentDisciple.encounter).toMatchObject({ transfigurationSuccesses: 1, weaponLocation: 'COURT', enemyForm: 'HUMAN', pickUpUses: 0 });
    expect(d.pickup.beforeLast).toEqual(d.form.final);
    expect(d.pickup.final.silentDisciple.encounter).toMatchObject({ transfigurationSuccesses: 1, weaponLocation: 'HAND', pickUpUses: 1 });
    expect(d.pickup.final.lastCombatRound.silentDiscipleOutcome.enemyActions.some((a: {label:string}) => a.label.includes('拾'))).toBe(true);
  });

});
