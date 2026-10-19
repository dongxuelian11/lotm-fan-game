import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCriminalCommand } from '../../src/domain/criminal/index.js';
import { CRIMINAL_ABILITY_IDS } from '../../src/domain/criminal/types.js';
import { applyUnwingedCommand } from '../../src/domain/unwinged/index.js';
import { UNWINGED_ABILITY_IDS } from '../../src/domain/unwinged/types.js';
import { applySerialKillerCommand } from '../../src/domain/serial-killer/index.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../../src/domain/serial-killer/types.js';
import { applyDemonCommand, createDemonState, projectDemon, validateDemonCommand, validateDemonState } from '../../src/domain/demon/index.js';
import { applyDemonActivity, demonActions, demonCases, demonInside, validateDemonLife } from '../../src/domain/demon/life.js';
import { hasDemonDisputeOpponent, settleDemonEncounter } from '../../src/domain/demon/encounter.js';
import { DEMON_FORMULA_STATUS, DEMON_SOURCE_STATUS } from '../../src/domain/demon/content.js';
import { DEMON_ABILITY_IDS, DEMON_CASE_IDS, type DemonAcquisitionCommand, type DemonActivityCommand, type DemonCaseId } from '../../src/domain/demon/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('demon-stage', sliceDefaultCreationSelection, 'demon-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.demon = createDemonState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[DEMON_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function serialKiller(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyCriminalCommand(s, { type: 'DISCOVER' }, c); applyCriminalCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCriminalCommand(s, { type: 'BUY_POTION', bottleId: s.criminal.bottles[0]!.id }, c); applyCriminalCommand(s, { type: 'CONSUME', bottleId: s.criminal.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100;
  applyUnwingedCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyUnwingedCommand(s, { type: 'BUY_POTION', bottleId: s.unwinged.bottles[0]!.id }, c); applyUnwingedCommand(s, { type: 'CONSUME', bottleId: s.unwinged.bottles[0]!.id, confirmed: true, acceptedChange: true }, c);
  s.week = 17; s.progression.acting = 100;
  applySerialKillerCommand(s, { type: 'LEARN_GUIDANCE' }, c); applySerialKillerCommand(s, { type: 'BUY_POTION', bottleId: s.serialKiller.bottles[0]!.id }, c); applySerialKillerCommand(s, { type: 'CONSUME', bottleId: s.serialKiller.bottles[0]!.id, confirmed: true }, c);
  s.week = 29; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: DemonAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyDemonCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: DemonActivityCommand, roll = 1) { const ctx = context(s, roll); applyDemonActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = serialKiller()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.demon.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyDemonCommand(s, command as DemonAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyDemonActivity(s, command as DemonActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: DemonCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: DemonCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  if (caseId === 'loading-lane') activity(s, { type: 'VERIFY', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function lane() { const s = promoted(); complete(s, 'loading-lane'); return s; }

describe('Demon independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula or supply', () => {
    const s = ordinary(), other = createDemonState();
    expect(validateDemonState(s)).toBe(true);
    expect(projectDemon(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', strain: 0, practice: { body: 'NORMAL', flame: 'NONE' } });
    expect(projectDemon(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.demon.bottles[0]!.labourSteps).toBe(0);
    expect(DEMON_FORMULA_STATUS).toContain('尚未核实'); expect(DEMON_SOURCE_STATUS).toContain('第二部第98章'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, without inventing resources or a complete recipe', () => {
    const s = serialKiller(), cash = s.cash, ap = s.actionsRemaining, oldSerialKiller = structuredClone(s.serialKiller);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.serialKiller).toEqual(oldSerialKiller);
    expect(projectDemon(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateDemonState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.demon.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateDemonState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete SerialKiller weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }); expect(validateDemonState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery without gifting resources', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'abyss', sequence: 6, acting: 0, mastery: { ...old, 'abyss.s6.danger-premonition': 0, 'abyss.s6.demonic-body': 0, 'abyss.s6.flame-hex': 0 } });
    expect(s.demon).toMatchObject({ promotionWeek: 29, serialKillerActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]); expect(s.demon.strain).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.demon.bottles[1]!.id }); expect(validateDemonState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.demon.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.demon.bottles[0]!.status).toBe('CONSUMED'); expect(validateDemonState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.demon.bottles).toHaveLength(6); expect(s.demon.bottles[3]!).toMatchObject({ id: 'demon-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateDemonState(s)).toBe(true);
    const forged = structuredClone(s); forged.demon.bottles[3]!.source = forged.demon.bottles[0]!.source; expect(validateDemonState(forged)).toBe(false);
  });
});

describe('Demon limited danger warning and independent safe verification', () => {
  it('produces the current threat only on OBSERVE without leaking the hostile plan publicly', () => {
    const s = promoted();
    expect(s.demon.threat).toEqual({ active: false, noticed: false, verified: false, avoided: false });
    expect(projectDemon(s)).not.toHaveProperty('threat');
    expect(JSON.stringify(demonCases(s))).not.toMatch(/持凶器埋伏|致命袭击举动/);
    const ctx = activity(s, { type: 'OBSERVE', caseId: 'loading-lane' });
    expect(s.demon.threat.active).toBe(true); expect(s.demon.threat.noticed).toBe(false);
    expect(JSON.stringify(demonCases(s))).not.toMatch(/持凶器埋伏|致命袭击举动/);
    expect(JSON.stringify(vi.mocked(ctx.c.note).mock.calls)).not.toMatch(/持凶器埋伏|致命袭击举动/);
    expect(validateDemonState(s)).toBe(true);
  });
  it('spends 1AP 2S and one strain for a direction only; requires CLOSE then explicit VERIFY before reporting', () => {
    const s = promoted(); begin(s, 'loading-lane'); const ap = s.actionsRemaining, sp = s.spirituality;
    const first = activity(s, { type: 'PERFORM', caseId: 'loading-lane' });
    expect([s.actionsRemaining, s.spirituality, s.demon.strain]).toEqual([ap - 1, sp - 2, 1]);
    expect(first.c.check).toHaveBeenCalledExactlyOnceWith('will', 14);
    expect(s.demon.threat).toEqual({ active: true, noticed: true, verified: false, avoided: false });
    expect(demonInside(s)).toBe(true); expect(validateDemonState(s)).toBe(true);
    expect(JSON.stringify(demonCases(s))).not.toMatch(/持凶器埋伏|致命袭击举动/);
    rejectActivity(s, { type: 'VERIFY', caseId: 'loading-lane' }); rejectActivity(s, { type: 'REPORT', caseId: 'loading-lane' }); rejectActivity(s, { type: 'COMPOSE' });
    s.actionsRemaining = 0; activity(s, { type: 'CLOSE', caseId: 'loading-lane' });
    expect([s.actionsRemaining, s.spirituality, s.demon.strain, demonInside(s)]).toEqual([0, sp - 2, 1, false]);
    s.actionsRemaining = 3; rejectActivity(s, { type: 'REPORT', caseId: 'loading-lane' });
    const verify = activity(s, { type: 'VERIFY', caseId: 'loading-lane' });
    expect(verify.c.check).toHaveBeenCalledExactlyOnceWith('perception', 12); expect(s.actionsRemaining).toBe(2);
    expect(s.demon.threat).toMatchObject({ active: true, verified: true, avoided: false });
    expect(demonCases(s)[0]!.result).toContain('原安全侧窗'); expect(demonCases(s)[0]!.result).toContain('持凶器埋伏');
    activity(s, { type: 'REPORT', caseId: 'loading-lane' });
    expect(s.demon.threat).toEqual({ active: false, noticed: true, verified: true, avoided: true });
    expect(s.progression.acting).toBe(25); expect(demonCases(s)[0]!.result).toContain('原公共出口'); expect(validateDemonState(s)).toBe(true);
  });
  it('makes ordinary observation a clue rather than pretend magic or an automatic truth result', () => {
    const s = promoted(), sp = s.spirituality; begin(s, 'loading-lane', 'ORDINARY');
    activity(s, { type: 'PERFORM', caseId: 'loading-lane' });
    expect([s.spirituality, s.demon.strain, s.demon.threat.noticed, s.demon.threat.verified]).toEqual([sp, 0, false, false]);
    expect(s.demon.cases['loading-lane']!.outcome).toBe('LANE_CLUE');
    activity(s, { type: 'CLOSE', caseId: 'loading-lane' }); rejectActivity(s, { type: 'REPORT', caseId: 'loading-lane' });
    activity(s, { type: 'VERIFY', caseId: 'loading-lane' }); activity(s, { type: 'REPORT', caseId: 'loading-lane' });
    expect(demonCases(s)[0]!.result).toContain('普通方法'); expect(validateDemonState(s)).toBe(true);
  });
  it('keeps failed verification limited and retries at the original safe window only in a later real week', () => {
    const s = promoted(); begin(s, 'loading-lane'); activity(s, { type: 'PERFORM', caseId: 'loading-lane' }); activity(s, { type: 'CLOSE', caseId: 'loading-lane' });
    activity(s, { type: 'VERIFY', caseId: 'loading-lane' }, 100);
    expect(s.demon.cases['loading-lane']).toMatchObject({ status: 'EXAMINED', outcome: 'VERIFY_FAILED', attemptWeek: s.week, contactOpen: false });
    expect(s.demon.threat.verified).toBe(false); expect(validateDemonState(s)).toBe(true);
    expect(JSON.stringify(demonCases(s))).not.toMatch(/持凶器埋伏|致命袭击举动/);
    rejectActivity(s, { type: 'VERIFY', caseId: 'loading-lane' }); rejectActivity(s, { type: 'REPORT', caseId: 'loading-lane' });
    s.week += 1; activity(s, { type: 'VERIFY', caseId: 'loading-lane' }); activity(s, { type: 'REPORT', caseId: 'loading-lane' });
    expect(s.demon.threat.avoided).toBe(true); expect(s.demon.cases['loading-lane']!.closes).toBe(1); expect(validateDemonState(s)).toBe(true);
  });
  it('keeps failed sensing costs/contact and never forecasts an inactive, future or other source', () => {
    const s = promoted(); begin(s, 'loading-lane'); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'loading-lane' }, 100);
    expect([s.spirituality, s.demon.strain, s.demon.threat.noticed, s.demon.threat.active]).toEqual([sp - 2, 1, false, true]);
    expect(demonInside(s)).toBe(true); expect(validateDemonState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'loading-lane' }); rejectActivity(s, { type: 'PREPARE', caseId: 'loading-lane', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'loading-lane', method: 'ORDINARY' });
    s.demon.threat.active = false; rejectActivity(s, { type: 'PERFORM', caseId: 'loading-lane' });
    s.demon.threat.active = true; activity(s, { type: 'PERFORM', caseId: 'loading-lane' }); activity(s, { type: 'CLOSE', caseId: 'loading-lane' });
    s.demon.threat.active = false; rejectActivity(s, { type: 'VERIFY', caseId: 'loading-lane' });
    s.demon.threat.active = true; activity(s, { type: 'VERIFY', caseId: 'loading-lane' }); activity(s, { type: 'REPORT', caseId: 'loading-lane' });
    expect(s.demon.cases['loading-lane']!.closes).toBe(2); expect(validateDemonState(s)).toBe(true);
  });
});

describe('Demon own body, finite fire, strain and peaceful completion', () => {
  it('actually enlarges only the player and keeps the narrow door unchanged until zero-AP restoration', () => {
    const s = lane(); begin(s, 'wide-door'); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'wide-door' });
    expect([s.spirituality, s.demon.practice.body, s.demon.strain]).toEqual([sp - 3, 'ENLARGED', 2]);
    expect(demonCases(s)[1]!.result).toContain('当前接触仍在继续'); expect(validateDemonState(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: 'wide-door' }); rejectActivity(s, { type: 'COMPOSE' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; activity(s, { type: 'CLOSE', caseId: 'wide-door' }); expect(s.demon.practice.body).toBe('NORMAL'); expect(s.demon.strain).toBe(2);
    s.actionsRemaining = 2; activity(s, { type: 'REPORT', caseId: 'wide-door' }); expect(s.progression.acting).toBe(50); expect(validateDemonState(s)).toBe(true);
  });
  it.each(['wide-door', 'cold-brazier'] as const)('keeps failed %s ability costs and active condition until actual close', id => {
    const s = lane(); if (id === 'cold-brazier') complete(s, 'wide-door', 'ORDINARY'); begin(s, id); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: id }, 100);
    expect([s.spirituality, s.demon.strain, demonInside(s)]).toEqual([sp - 3, 2, true]);
    expect(s.demon.practice).toEqual(id === 'wide-door' ? { body: 'ENLARGED', flame: 'NONE' } : { body: 'NORMAL', flame: 'LIT' });
    expect(validateDemonState(s)).toBe(true); activity(s, { type: 'CLOSE', caseId: id });
    expect(s.demon.practice.body).toBe('NORMAL'); expect(s.demon.practice.flame).toBe(id === 'cold-brazier' ? 'EXTINGUISHED' : 'NONE');
    rejectActivity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); rejectActivity(s, { type: 'REPORT', caseId: id });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: id }); activity(s, { type: 'CLOSE', caseId: id }); activity(s, { type: 'REPORT', caseId: id });
    expect(s.demon.cases[id]!.closes).toBe(2); expect(validateDemonState(s)).toBe(true);
  });
  it('lights the actual empty brazier then really extinguishes it with the existing cover without healing', () => {
    const s = lane(); complete(s, 'wide-door'); begin(s, 'cold-brazier'); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'cold-brazier' });
    expect([s.spirituality, s.demon.strain, s.demon.practice.flame]).toEqual([sp - 3, 3, 'LIT']); expect(validateDemonState(s)).toBe(true);
    s.actionsRemaining = 0; s.health = 44; s.mind = 59;
    const ctx = activity(s, { type: 'CLOSE', caseId: 'cold-brazier' }); expect(ctx.c.note).toHaveBeenCalledWith('实际结束本次接触', expect.stringContaining('原普通盖实际熄灭'));
    expect([s.actionsRemaining, s.health, s.mind, s.spirituality, s.demon.strain, s.demon.practice.flame]).toEqual([0, 44, 59, sp - 3, 3, 'EXTINGUISHED']);
    s.actionsRemaining = 3; activity(s, { type: 'REPORT', caseId: 'cold-brazier' }); activity(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.demon.strain).toBe(3); s.week += 1; expect(validateDemonState(s)).toBe(true);
  });
  it('composes for one deterministic AP only outside contact/combat and never refills health, mind or spirituality', () => {
    const s = lane(); s.demon.strain = 3; const ap = s.actionsRemaining, sp = s.spirituality; s.health = 43; s.mind = 61;
    activity(s, { type: 'OBSERVE', caseId: 'wide-door' }); rejectActivity(s, { type: 'PREPARE', caseId: 'wide-door', method: 'ABILITY' });
    const ctx = activity(s, { type: 'COMPOSE' }); expect(ctx.c.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.demon.strain, s.health, s.mind, s.spirituality]).toEqual([ap - 2, 2, 43, 61, sp]);
    activity(s, { type: 'PREPARE', caseId: 'wide-door', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'wide-door' }); rejectActivity(s, { type: 'COMPOSE' });
    activity(s, { type: 'CLOSE', caseId: 'wide-door' }); activity(s, { type: 'REPORT', caseId: 'wide-door' });
    activity(s, { type: 'ENCOUNTER_FIGHT' }); rejectActivity(s, { type: 'COMPOSE' }); expect(s.demon.strain).toBe(3);
    const c = context(s); settleDemonEncounter(s, 'RETREATED', c.c, c.award); expect(s.demon.strain).toBe(3);
    for (let n = 0; n < 3; n += 1) activity(s, { type: 'COMPOSE' }); rejectActivity(s, { type: 'COMPOSE' }); expect(validateDemonState(s)).toBe(true);
  });
  it('allows every ordinary alternative with zero spirituality and strain at three, reaching G peaceful100', () => {
    const s = promoted(); s.spirituality = 0; s.demon.strain = 3;
    for (const id of DEMON_CASE_IDS) complete(s, id, 'ORDINARY'); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.demon.strain]).toEqual([100, 0, 3]); expect(s.combat).toBeNull();
    expect(s.demon.practice).toEqual({ body: 'NORMAL', flame: 'NONE' }); expect(s.demon.threat.noticed).toBe(false);
    for (const id of DEMON_CASE_IDS) rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'REFLECT' });
    expect(demonCases(s)).toHaveLength(3); expect(validateDemonLife(s)).toBe(true); expect(validateDemonState(s)).toBe(true);
  });
  it('cancels a preparation for zero AP, without changing real resources or executing the effect', () => {
    const s = lane(); begin(s, 'wide-door'); const sp = s.spirituality, strain = s.demon.strain; s.actionsRemaining = 0;
    activity(s, { type: 'WITHDRAW', caseId: 'wide-door' }); expect([s.actionsRemaining, s.spirituality, s.demon.strain, s.demon.practice.body]).toEqual([0, sp, strain, 'NORMAL']);
    expect(s.demon.cases['wide-door']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 }); expect(validateDemonState(s)).toBe(true);
  });
  it('rejects malformed commands, unsupported powers, unearned evidence and impossible persisted effects', () => {
    for (const c of [{ type: 'COMPOSE', free: true }, { type: 'REMOTE_DESIRE' }, { type: 'PREDICT_ANY_PLAN' }, { type: 'BUY_RATION' }, { type: 'CONSUME', bottleId: 'serial-killer-potion-1', confirmed: true }, { type: 'VERIFY', caseId: 'unknown' }, { type: 'PREPARE', caseId: 'wide-door', method: 'DESIRE' }]) expect(validateDemonCommand(c)).toBe(false);
    const s = promoted();
    for (const change of [
      (t: SliceState) => { t.demon.strain = 4; },
      (t: SliceState) => { t.demon.strain = -1; },
      (t: SliceState) => { t.demon.threat.active = true; },
      (t: SliceState) => { t.demon.threat.verified = true; },
      (t: SliceState) => { t.demon.threat.avoided = true; },
      (t: SliceState) => { t.demon.practice.body = 'ENLARGED'; },
      (t: SliceState) => { t.demon.practice.flame = 'LIT'; },
      (t: SliceState) => { t.demon.practice.flame = 'EXTINGUISHED'; },
      (t: SliceState) => { t.demon.cases['loading-lane']!.outcome = 'LANE_VERIFIED'; },
      (t: SliceState) => { t.progression.acting = 100; },
    ]) { const bad = structuredClone(s); change(bad); expect(validateDemonState(bad)).toBe(false); }
    expect(validateDemonState(s)).toBe(true);
  });
});

describe('Demon independent original courtyard encounter', () => {
  it('requires an actual report and respects a refusal until next week without coercion or reward', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'loading-lane', 'ORDINARY'); const acting = s.progression.acting;
    activity(s, { type: 'ENCOUNTER_TALK' }, 100); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.demon.encounter.status, s.progression.acting, s.combat]).toEqual(['RESOLVED', acting, null]); expect(validateDemonState(s)).toBe(true);
  });
  it('recognizes only the actual living same-week opponent and never reuses the old threat as precognition', () => {
    const s = lane(), threat = structuredClone(s.demon.threat); activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(hasDemonDisputeOpponent(s)).toBe(true); expect(s.demon.threat).toEqual(threat);
    for (const change of [
      (t: SliceState) => { t.week += 1; },
      (t: SliceState) => { t.combat!.enemyHealth = 0; },
      (t: SliceState) => { t.demon.practice.body = 'ENLARGED'; },
      (t: SliceState) => { t.demon.practice.flame = 'LIT'; },
    ]) { const bad = structuredClone(s); change(bad); expect(hasDemonDisputeOpponent(bad)).toBe(false); }
    expect(validateDemonState(s)).toBe(true);
  });
  it('retreats through the actual original exit, retaining strain and injuries with no reward or pursuit', () => {
    const s = lane(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.health = 43; s.mind = 62; s.demon.strain = 3; const ctx = context(s);
    settleDemonEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.health, s.mind, s.combat, s.demon.strain, s.demon.encounter.status]).toEqual([43, 62, null, 3, 'RETREATED']); expect(ctx.award).not.toHaveBeenCalled(); expect(validateDemonState(s)).toBe(true);
  });
  it('awards living effective participation exactly once without acting or free strain recovery', () => {
    const s = lane(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' }); s.demon.strain = 3;
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s); settleDemonEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('demon-dispute', 25); expect(s.progression.acting).toBe(acting); expect(s.demon.strain).toBe(3); expect(validateDemonState(s)).toBe(true);
    expect(() => settleDemonEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
  });
  it('preserves real death and all remaining strain with no revival or reward', () => {
    const s = lane(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; const strain = s.demon.strain, ctx = context(s);
    settleDemonEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.demon.encounter.status, s.combat, s.demon.strain]).toEqual(['DEAD', 'LOST', null, strain]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateDemonState(s)).toBe(true);
  });
});
