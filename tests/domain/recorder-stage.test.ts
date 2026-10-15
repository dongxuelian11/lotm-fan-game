import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyApprenticeCommand } from '../../src/domain/apprentice/index.js';
import { APPRENTICE_ABILITY_IDS } from '../../src/domain/apprentice/types.js';
import { applyTrickmasterCommand } from '../../src/domain/trickmaster/index.js';
import { TRICKMASTER_ABILITY_IDS } from '../../src/domain/trickmaster/types.js';
import { applyAstrologerCommand } from '../../src/domain/astrologer/index.js';
import { ASTROLOGER_ABILITY_IDS } from '../../src/domain/astrologer/types.js';
import { applyRecorderCommand, createRecorderState, projectRecorder, validateRecorderCommand, validateRecorderState } from '../../src/domain/recorder/index.js';
import { applyRecorderActivity, recorderActions, recorderCases, recorderInside, validateRecorderLife } from '../../src/domain/recorder/life.js';
import { settleRecorderEncounter } from '../../src/domain/recorder/encounter.js';
import { RECORDER_FORMULA_STATUS, RECORDER_PRICES, RECORDER_SOURCE_STATUS } from '../../src/domain/recorder/content.js';
import { RECORDER_ABILITY_IDS, RECORDER_CASE_IDS, type RecorderAcquisitionCommand, type RecorderActivityCommand, type RecorderCaseId } from '../../src/domain/recorder/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('recorder-domain', sliceDefaultCreationSelection, 'recorder-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.recorder = createRecorderState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[RECORDER_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function astrologer(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyApprenticeCommand(s, { type: 'DISCOVER' }, c);
  applyApprenticeCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyApprenticeCommand(s, { type: 'BUY_POTION', bottleId: s.apprentice.bottles[0]!.id }, c);
  applyApprenticeCommand(s, { type: 'CONSUME', bottleId: s.apprentice.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyTrickmasterCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyTrickmasterCommand(s, { type: 'BUY_MATERIALS', batchId: s.trickmaster.batches[0]!.id }, c);
  applyTrickmasterCommand(s, { type: 'BREW', batchId: s.trickmaster.batches[0]!.id }, c);
  applyTrickmasterCommand(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyAstrologerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyAstrologerCommand(s, { type: 'BUY_POTION', bottleId: s.astrologer.bottles[0]!.id }, c);
  applyAstrologerCommand(s, { type: 'CONSUME', bottleId: s.astrologer.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: RecorderAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyRecorderCommand(s, command, ctx.c); s.revision += 1; return ctx; }
function activity(s: SliceState, command: RecorderActivityCommand, roll = 1) { const ctx = context(s, roll); applyRecorderActivity(s, command, ctx.c, ctx.award); s.revision += 1; return ctx; }
function taught(s = astrologer()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.recorder.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.recorder.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyRecorderCommand(s, command as RecorderAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyRecorderActivity(s, command as RecorderActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: RecorderCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: RecorderCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId });
  activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}

describe('Recorder S6 independent potion and inherited growth', () => {
  it('starts with separate stock and empty source records, hiding the future channel', () => {
    const s = ordinary(), p = projectRecorder(s), other = createRecorderState();
    expect(validateRecorderState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], records: [], samples: [], capacities: [] });
    expect(p.story).toBeUndefined(); expect(recorderCases(s)).toEqual([]);
    other.bottles[0]!.labourSteps = 5; other.instructorSpirituality.NORA.spirituality = 0;
    expect(s.recorder.bottles[0]!.labourSteps).toBe(0); expect(s.recorder.instructorSpirituality.NORA.spirituality).toBe(20);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges guidance and exactly five corresponding labour actions before the discounted original bottle', () => {
    const s = astrologer(), old = structuredClone([s.apprentice, s.trickmaster, s.astrologer]);
    taught(s); expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]);
    const b = s.recorder.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect([s.apprentice, s.trickmaster, s.astrologer]).toEqual(old);
    expect(RECORDER_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(RECORDER_FORMULA_STATUS).toContain('尚未核实'); expect(projectRecorder(s).formula).toEqual([]);
    expect(validateRecorderState(s)).toBe(true); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('requires acting100 and twelve actual S7 weeks; incomplete labour never partially discounts', () => {
    const s = astrologer(); s.week = 19; s.progression.acting = 0; taught(s);
    acquisition(s, { type: 'POTION_WORK', bottleId: s.recorder.bottles[0]!.id }); const cash = s.cash, b = buy(s);
    expect(cash - s.cash).toBe(3320); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it('keeps all four recoverable consumption outcomes and previous masteries', () => {
    for (const [roll, tier, mind, health, pollution, sequence] of [[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.recorder.bottles[0]!;
      const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
      expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual([tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(validateRecorderState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('inherits every Door-family ID and adds only two zero masteries and four +1 stats without refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, old = structuredClone([s.apprentice, s.trickmaster, s.astrologer]);
    acquisition(s, { type: 'CONSUME', bottleId: s.recorder.bottles[0]!.id, confirmed: true });
    expect([s.apprentice, s.trickmaster, s.astrologer]).toEqual(old); expect(s.recorder.astrologerActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS, ...RECORDER_ABILITY_IDS]);
    expect(RECORDER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(s.recorder.records).toEqual([]);
    expect(projectRecorder(s).capacities.map(x => [x.maximum, x.used])).toEqual([[20, 0], [8, 0], [1, 0]]);
    expect(RECORDER_SOURCE_STATUS).toContain('不能返回');
  });
  it('restocks priced originals only in a later real week after three actual failed bottles', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.recorder.bottles); acquisition(s, { type: 'REQUEST_SUPPLY' });
    rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.recorder.bottles.slice(0, 3)).toEqual(originals); expect(s.recorder.bottles).toHaveLength(6);
    expect(s.recorder.bottles[3]).toMatchObject({ id: 'recorder-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateRecorderState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
});

describe('Recorder actual paid demonstration and one-use source records', () => {
  it('creates a unique sourced FLASH8 only after an actual paid successful original demonstration', () => {
    const s = promoted(), ap = s.actionsRemaining, spirit = s.spirituality, revision = s.revision;
    const ctx = activity(s, { type: 'RECORD', sample: 'FLASH' });
    expect(ctx.c.check).toHaveBeenCalledWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.recorder.demonstrations).toEqual([{ id: 'recorder-demo-1', sample: 'FLASH', actor: 'NORA', week: 31, revision: revision + 1, success: true }]);
    expect(s.recorder.records).toEqual([{ id: 'recorder-record-1', sample: 'FLASH', sequence: 8, status: 'STORED', sourceDemoId: 'recorder-demo-1', createdWeek: 31, releasedWeek: null }]);
    expect(s.recorder.instructorSpirituality.NORA).toEqual({ spirituality: 18, restWeek: 31 });
    expect(s.recorder.instructorSpirituality.SAFF).toEqual({ spirituality: 20, restWeek: null });
    expect(recorderInside(s)).toBe(false); expect(validateRecorderState(s)).toBe(true);
  });
  it('charges both actors on failure, retains the failed original demo, and permits the other weekly sample', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'FLASH' }, 100);
    expect(s.recorder.records).toEqual([]); expect(s.recorder.demonstrations[0]!.success).toBe(false);
    expect([s.spirituality, s.recorder.instructorSpirituality.NORA.spirituality]).toEqual([28, 18]);
    rejectActivity(s, { type: 'RECORD', sample: 'FLASH' }); activity(s, { type: 'RECORD', sample: 'COURAGE' });
    expect(s.recorder.records[0]).toMatchObject({ id: 'recorder-record-1', sourceDemoId: 'recorder-demo-2', sample: 'COURAGE', sequence: 9 });
    expect(s.recorder.demonstrations[1]!.actor).toBe('SAFF'); expect(validateRecorderState(s)).toBe(true);
  });
  it('recovers instructor spirituality only on a next paid visit after actual elapsed weeks and preserves stored records', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'FLASH' }); const original = structuredClone(s.recorder.records[0]);
    s.week += 3; const before = structuredClone(s.recorder); projectRecorder(s); recorderActions(s);
    expect(s.recorder).toEqual(before); expect(s.recorder.instructorSpirituality.NORA.spirituality).toBe(18);
    activity(s, { type: 'RECORD', sample: 'FLASH' });
    expect(s.recorder.instructorSpirituality.NORA).toEqual({ spirituality: 18, restWeek: 34 });
    expect(s.recorder.records[0]).toEqual(original); expect(s.recorder.records).toHaveLength(2); expect(validateRecorderState(s)).toBe(true);
  });
  it('rejects unknown samples, arbitrary source IDs, insufficient costs and recording during another preparation', () => {
    const s = promoted();
    for (const command of [{ type: 'RECORD', sample: 'TRAVEL' }, { type: 'RECORD', sample: 'FLASH', sourceDemoId: 'fake' }, { type: 'RECORD', sample: 'FLASH', actor: 'SAFF' }]) {
      expect(validateRecorderCommand(command)).toBe(false); rejectActivity(s, command);
    }
    s.spirituality = 2; rejectActivity(s, { type: 'RECORD', sample: 'FLASH' }); s.spirituality = 31;
    s.actionsRemaining = 0; rejectActivity(s, { type: 'RECORD', sample: 'FLASH' }); s.actionsRemaining = 100;
    begin(s, 'missing-source'); rejectActivity(s, { type: 'RECORD', sample: 'FLASH' });
    activity(s, { type: 'WITHDRAW', caseId: 'missing-source' }); activity(s, { type: 'RECORD', sample: 'FLASH' });
  });
  it('enforces all twenty LOW slots through real weekly records without gifting MID or DIVINE records', () => {
    const s = promoted();
    for (let i = 0; i < 10; i++) {
      s.spirituality = 80; activity(s, { type: 'RECORD', sample: 'FLASH' }); activity(s, { type: 'RECORD', sample: 'COURAGE' }); s.week += 1;
    }
    rejectActivity(s, { type: 'RECORD', sample: 'FLASH' });
    expect(projectRecorder(s).capacities.map(x => x.used)).toEqual([20, 0, 0]); expect(validateRecorderState(s)).toBe(true);
  });
  it('rejects forged original sources, missing demonstrations, duplicate IDs and free instructor replenishment', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'FLASH' });
    const changes: ((t: SliceState) => void)[] = [
      t => { t.recorder.records[0]!.sourceDemoId = 'invented'; }, t => { t.recorder.demonstrations[0]!.actor = 'SAFF'; },
      t => { t.recorder.demonstrations[0]!.success = false; }, t => { t.recorder.demonstrations[0]!.revision = t.revision + 1; },
      t => { t.recorder.records.push(structuredClone(t.recorder.records[0]!)); }, t => { t.recorder.instructorSpirituality.NORA.spirituality = 20; },
      t => { t.recorder.lastAttemptWeek.FLASH = null; }, t => { t.recorder.records[0]!.releasedWeek = 31; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateRecorderState(t)).toBe(false); }
  });
});

describe('Recorder bounded practice and real encounter closure', () => {
  it('does not grant a record from observation or preparation and requires the matching stored sample', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'flash-screen' });
    expect(s.recorder.records).toEqual([]); rejectActivity(s, { type: 'PREPARE', caseId: 'flash-screen', method: 'ABILITY' });
    activity(s, { type: 'RECORD', sample: 'COURAGE' }); rejectActivity(s, { type: 'PREPARE', caseId: 'flash-screen', method: 'ABILITY' });
    activity(s, { type: 'RECORD', sample: 'FLASH' }); activity(s, { type: 'PREPARE', caseId: 'flash-screen', method: 'ABILITY' });
    expect(s.recorder.records.every(x => x.status === 'STORED')).toBe(true);
  });
  it('consumes exactly one matching record and two spirituality, then requires zero-AP actual closure before report', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'FLASH' }); activity(s, { type: 'RECORD', sample: 'COURAGE' });
    begin(s, 'flash-screen', 'ABILITY'); const spirit = s.spirituality;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'flash-screen' });
    expect(ctx.c.check).toHaveBeenCalledWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 2);
    expect(s.recorder.records.map(x => x.status)).toEqual(['RELEASED', 'STORED']);
    expect(s.recorder.cases['flash-screen']).toMatchObject({ status: 'EXAMINED', contactOpen: true, releasedRecordId: 'recorder-record-1' });
    expect(recorderInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'flash-screen' }); rejectActivity(s, { type: 'RECORD', sample: 'COURAGE' });
    s.actionsRemaining = 0; activity(s, { type: 'CLOSE', caseId: 'flash-screen' }); expect(s.actionsRemaining).toBe(0);
    s.actionsRemaining = 1; activity(s, { type: 'REPORT', caseId: 'flash-screen' });
    expect(s.progression.acting).toBe(25); expect(validateRecorderState(s)).toBe(true);
  });
  it('keeps consumed records after failed release and supports next-week ordinary retry without another record', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'FLASH' }); begin(s, 'flash-screen', 'ABILITY');
    activity(s, { type: 'PERFORM', caseId: 'flash-screen' }, 100);
    expect(s.recorder.records[0]!.status).toBe('RELEASED'); expect(s.recorder.cases['flash-screen']!.status).toBe('OBSERVED');
    activity(s, { type: 'CLOSE', caseId: 'flash-screen' }); rejectActivity(s, { type: 'PREPARE', caseId: 'flash-screen', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'flash-screen', method: 'ORDINARY' });
    activity(s, { type: 'PERFORM', caseId: 'flash-screen' }); activity(s, { type: 'CLOSE', caseId: 'flash-screen' }); activity(s, { type: 'REPORT', caseId: 'flash-screen' });
    expect(s.recorder.records[0]!.status).toBe('RELEASED'); expect(s.recorder.cases['flash-screen']!.outcome).toBe('SCREEN_CHECKED'); expect(validateRecorderState(s)).toBe(true);
  });
  it('limits courage to the player, refuses unknown high powers and allows fully ordinary peaceful100', () => {
    const s = promoted(), spirit = s.spirituality;
    activity(s, { type: 'OBSERVE', caseId: 'missing-source' }); rejectActivity(s, { type: 'PREPARE', caseId: 'missing-source', method: 'ABILITY' });
    activity(s, { type: 'PREPARE', caseId: 'missing-source', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'missing-source' });
    activity(s, { type: 'CLOSE', caseId: 'missing-source' }); activity(s, { type: 'REPORT', caseId: 'missing-source' });
    complete(s, 'flash-screen'); complete(s, 'courage-task'); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality]).toEqual([100, spirit]); expect(s.recorder.records).toEqual([]);
    expect(recorderCases(s).find(x => x.id === 'courage-task')!.story).toContain('只鼓舞你自己');
    expect(validateRecorderState(s)).toBe(true); rejectActivity(s, { type: 'REFLECT' });
  });
  it('preserves both stored sources when withdrawing and allows replenishment after the final report', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'COURAGE' }); const original = structuredClone(s.recorder.records);
    begin(s, 'courage-task', 'ABILITY'); activity(s, { type: 'WITHDRAW', caseId: 'courage-task' }); expect(s.recorder.records).toEqual(original);
    activity(s, { type: 'PREPARE', caseId: 'courage-task', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'courage-task' });
    activity(s, { type: 'CLOSE', caseId: 'courage-task' }); activity(s, { type: 'REPORT', caseId: 'courage-task' });
    complete(s, 'flash-screen'); complete(s, 'missing-source'); activity(s, { type: 'REFLECT' }); s.week += 1;
    activity(s, { type: 'RECORD', sample: 'COURAGE' }); expect(s.recorder.records.map(x => x.status)).toEqual(['RELEASED', 'STORED']); expect(validateRecorderLife(s)).toBe(true);
  });
  it('retains case provenance and rejects forged closure, outcome, duplicate reports and unknown fields', () => {
    const s = promoted(); activity(s, { type: 'RECORD', sample: 'FLASH' }); complete(s, 'flash-screen', 'ABILITY');
    for (const command of [{ type: 'REPORT', caseId: 'flash-screen' }, { type: 'CLOSE', caseId: 'flash-screen' }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'missing-source', method: 'TRAVEL' }]) rejectActivity(s, command);
    for (const change of [
      (t: SliceState) => { t.recorder.cases['flash-screen']!.releasedRecordId = 'unknown'; },
      (t: SliceState) => { t.recorder.cases['flash-screen']!.closes = 0; },
      (t: SliceState) => { t.recorder.cases['flash-screen']!.outcome = 'COURAGE_RELEASED'; },
      (t: SliceState) => { t.seer.completedSources.push('recorder-case:flash-screen'); },
    ]) { const t = structuredClone(s); change(t); expect(validateRecorderState(t)).toBe(false); }
    expect(RECORDER_CASE_IDS).toHaveLength(3);
  });
  it('requires an actual report and clear scene before paid arrival, preserving refusal until another week', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'missing-source');
    const ap = s.actionsRemaining; activity(s, { type: 'ENCOUNTER_TALK' }, 100); expect(s.actionsRemaining).toBe(ap - 1);
    rejectActivity(s, { type: 'ENCOUNTER_TALK' }); expect(s.recorder.encounter.status).toBe('AVAILABLE');
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.recorder.encounter.status).toBe('RESOLVED');
    expect(s.progression.acting).toBe(25); expect(s.seer.completedSources).not.toContain('recorder-dispute'); expect(validateRecorderState(s)).toBe(true);
  });
  it('awards25 only for alive effective combat, keeps original ownership, and gives no retreat or death reward', () => {
    for (const outcome of ['ENEMY_SURRENDERED', 'RETREATED', 'PLAYER_DEAD'] as const) {
      const s = promoted(); complete(s, 'missing-source'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
      const before = structuredClone(s.town), ctx = context(s);
      if (outcome === 'PLAYER_DEAD') { s.status = 'DEAD'; s.health = 0; }
      settleRecorderEncounter(s, outcome, ctx.c, ctx.award);
      expect(s.town).toEqual(before); expect(s.combat).toBeNull();
      expect(s.recorder.encounter.status).toBe(outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED');
      if (outcome === 'ENEMY_SURRENDERED') expect(ctx.award).toHaveBeenCalledWith('recorder-dispute', 25); else expect(ctx.award).not.toHaveBeenCalled();
      expect(validateRecorderState(s)).toBe(true);
    }
  });
});
