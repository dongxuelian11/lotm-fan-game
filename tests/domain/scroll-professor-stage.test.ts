import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPryerCommand } from '../../src/domain/pryer/index.js';
import { PRYER_ABILITY_IDS } from '../../src/domain/pryer/types.js';
import { applyCombatScholarCommand } from '../../src/domain/combat-scholar/index.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../../src/domain/combat-scholar/types.js';
import { applyWizardCommand } from '../../src/domain/wizard/index.js';
import { WIZARD_ABILITY_IDS } from '../../src/domain/wizard/types.js';
import { applyScrollProfessorCommand, createScrollProfessorState, projectScrollProfessor, validateScrollProfessorCommand, validateScrollProfessorState } from '../../src/domain/scroll-professor/index.js';
import { applyScrollProfessorActivity, scrollProfessorActions, scrollProfessorCases, scrollProfessorInside, validateScrollProfessorLife } from '../../src/domain/scroll-professor/life.js';
import { hasScrollProfessorDisputeOpponent, settleScrollProfessorEncounter } from '../../src/domain/scroll-professor/encounter.js';
import { SCROLL_PROFESSOR_FORMULA_STATUS, SCROLL_PROFESSOR_SOURCE_STATUS } from '../../src/domain/scroll-professor/content.js';
import { SCROLL_PROFESSOR_ABILITY_IDS, SCROLL_PROFESSOR_CASE_IDS, type ScrollProfessorAcquisitionCommand, type ScrollProfessorActivityCommand, type ScrollProfessorCaseId, type ScrollProfessorScrollKind } from '../../src/domain/scroll-professor/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('scroll-professor-stage', sliceDefaultCreationSelection, 'scroll-professor-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.scrollProfessor = createScrollProfessorState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[SCROLL_PROFESSOR_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function wizard(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyPryerCommand(s, { type: 'DISCOVER' }, c); applyPryerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPryerCommand(s, { type: 'BUY_POTION', bottleId: s.pryer.bottles[0]!.id }, c); applyPryerCommand(s, { type: 'CONSUME', bottleId: s.pryer.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100;
  applyCombatScholarCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyCombatScholarCommand(s, { type: 'BUY_POTION', bottleId: s.combatScholar.bottles[0]!.id }, c); applyCombatScholarCommand(s, { type: 'CONSUME', bottleId: s.combatScholar.bottles[0]!.id, confirmed: true }, c);
  s.week = 17; s.progression.acting = 100;
  applyWizardCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyWizardCommand(s, { type: 'BUY_POTION', bottleId: s.wizard.bottles[0]!.id }, c); applyWizardCommand(s, { type: 'CONSUME', bottleId: s.wizard.bottles[0]!.id, confirmed: true }, c);
  s.week = 29; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: ScrollProfessorAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyScrollProfessorCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: ScrollProfessorActivityCommand, roll = 1) { const ctx = context(s, roll); applyScrollProfessorActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = wizard()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.scrollProfessor.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyScrollProfessorCommand(s, command as ScrollProfessorAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyScrollProfessorActivity(s, command as ScrollProfessorActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function learn(s: SliceState, kind: ScrollProfessorScrollKind) { const spellId = kind === 'IMPACT' ? 'light-touch' : 'brief-ward'; if (!s.wizard.lessons[spellId]!.learned) activity(s, { type: 'LEARN_SPELL', spellId }); }
function craft(s: SliceState, kind: ScrollProfessorScrollKind, roll = 1) { learn(s, kind); if (!s.scrollProfessor.workshop.materials.some(m => m.status === 'HELD')) activity(s, { type: 'BUY_KIT' }); return activity(s, { type: 'CRAFT_SCROLL', kind }, roll); }
function begin(s: SliceState, caseId: ScrollProfessorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: ScrollProfessorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  if (method === 'ABILITY' && caseId !== 'willing-reader') craft(s, caseId === 'paper-target' ? 'IMPACT' : 'WARD');
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function paper() { const s = promoted(); complete(s, 'paper-target'); return s; }
function ward() { const s = paper(); complete(s, 'soft-ward'); return s; }

describe('ScrollProfessor independent S6 originals, guidance and promotion', () => {
  it('hides the undiscovered channel and creates no formula, scrolls or lessons', () => {
    const s = ordinary(), other = createScrollProfessorState();
    expect(validateScrollProfessorState(s)).toBe(true);
    expect(projectScrollProfessor(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', workshop: { materials: [], lessons: [], scrolls: [] } });
    expect(projectScrollProfessor(s).story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; expect(s.scrollProfessor.bottles[0]!.labourSteps).toBe(0);
    expect(SCROLL_PROFESSOR_FORMULA_STATUS).toContain('尚未核实'); expect(SCROLL_PROFESSOR_SOURCE_STATUS).toContain('第三部第171、175章'); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360p and one AP for guidance, with no learned spell or complete recipe', () => {
    const s = wizard(), cash = s.cash, ap = s.actionsRemaining, oldWizard = structuredClone(s.wizard);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect(s.wizard).toEqual(oldWizard);
    expect(projectScrollProfessor(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] }); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' }); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('charges five bottle-specific labours then 320p without transfer, refund or partial credit', () => {
    const s = taught(), [first, second] = s.scrollProfessor.bottles, cash = s.cash, ap = s.actionsRemaining;
    for (let n = 0; n < 5; n += 1) acquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    expect(s.cash).toBe(cash); expect(s.actionsRemaining).toBe(ap - 5); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: first!.id });
    buy(s); expect(s.cash).toBe(cash - 320); expect(second!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: first!.id }); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('requires actual original, separate confirmation, consumed100 and twelve complete Wizard weeks', () => {
    const s = taught(); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }); buy(s);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: false });
    s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }); s.progression.acting = 100;
    s.week -= 1; rejectAcquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }); s.week += 1;
    acquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it.each([{ roll: 1, mind: 95 }, { roll: 30, mind: 90 }])('promotes at roll $roll preserving all original mastery and unlearned lessons', ({ roll, mind }) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), stats = { ...s.character.coreStats }, lessons = structuredClone(s.wizard.lessons), spirituality = s.spirituality;
    acquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toMatchObject({ pathwayId: 'hermit', sequence: 6, acting: 0, mastery: { ...old, 'hermit.s6.scrollcraft': 0 } });
    expect(s.scrollProfessor).toMatchObject({ promotionWeek: 29, wizardActingAtPromotion: 100 }); expect([s.mind, s.spirituality]).toEqual([mind, spirituality]); expect(s.wizard.lessons).toEqual(lessons);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.scrollProfessor.bottles[1]!.id }); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it.each([{ roll: 80, mind: 80, health: 90, pollution: 25 }, { roll: 100, mind: 60, health: 80, pollution: 50 }])('keeps failed roll $roll recoverable while spending exactly the selected original', ({ roll, mind, health, pollution }) => {
    const s = prepared(), old = structuredClone(s.progression); acquisition(s, { type: 'CONSUME', bottleId: s.scrollProfessor.bottles[0]!.id, confirmed: true }, roll);
    expect(s.progression).toEqual(old); expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([mind, health, pollution, 'ACTIVE']); expect(s.scrollProfessor.bottles[0]!.status).toBe('CONSUMED'); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('requires all originals to fail, one request AP and the next real week before a paid new batch', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' }); expect(s.scrollProfessor.bottles).toHaveLength(6); expect(s.scrollProfessor.bottles[3]!).toMatchObject({ id: 'scroll-professor-potion-4', status: 'SUPPLIER', labourSteps: 0 }); expect(validateScrollProfessorState(s)).toBe(true);
    const forged = structuredClone(s); forged.scrollProfessor.bottles[3]!.source = forged.scrollProfessor.bottles[0]!.source; expect(validateScrollProfessorState(forged)).toBe(false);
  });
  it('rejects unknown command fields, unconfirmed consumption and malformed forged state', () => {
    for (const command of [{ type: 'CRAFT_SCROLL', kind: 'STAR' }, { type: 'CRAFT_SCROLL', kind: 'IMPACT', free: true }, { type: 'AUTHORIZE_SCROLL', scrollId: 'scroll-professor-scroll-1', authorized: 'yes' }, { type: 'LEARN_SPELL', spellId: 'mystery-reenactment' }, { type: 'CONSUME', bottleId: 'wizard-potion-1', confirmed: true }]) expect(validateScrollProfessorCommand(command)).toBe(false);
    const s = promoted(); for (const command of [{ type: 'BUY_KIT', free: true }, { type: 'CRAFT_SCROLL', kind: 'STAR' }, { type: 'AUTHORIZE_SCROLL', scrollId: 'scroll-professor-scroll-1', authorized: true }]) rejectActivity(s, command);
    const forged = structuredClone(s); Object.assign(forged.scrollProfessor, { unlimitedSpells: true }); expect(validateScrollProfessorState(forged)).toBe(false);
  });
});

describe('ScrollProfessor physical workshop and explicit authorization', () => {
  it('buys four independently identified actual portions once per week for one AP and 100p', () => {
    const s = promoted(), cash = s.cash, ap = s.actionsRemaining;
    activity(s, { type: 'BUY_KIT' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 100, ap - 1]); expect(s.scrollProfessor.workshop.materials.map(x => x.id)).toEqual([1, 2, 3, 4].map(n => `scroll-professor-material-${n}`)); rejectActivity(s, { type: 'BUY_KIT' });
    s.week += 1; activity(s, { type: 'BUY_KIT' }); expect(s.scrollProfessor.workshop.materials).toHaveLength(8); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('cannot inscribe an unlearned spell and allows only the existing paid Wizard lesson at S6', () => {
    const s = promoted(); activity(s, { type: 'BUY_KIT' }); rejectActivity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }); const cash = s.cash, ap = s.actionsRemaining;
    activity(s, { type: 'LEARN_SPELL', spellId: 'light-touch' }, 100); expect([s.cash, s.actionsRemaining, s.wizard.lessons['light-touch']!.learned]).toEqual([cash - 60, ap - 1, false]); rejectActivity(s, { type: 'LEARN_SPELL', spellId: 'light-touch' });
    s.week += 1; activity(s, { type: 'LEARN_SPELL', spellId: 'light-touch' }); activity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }); expect(s.progression.acting).toBe(0); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('spends one actual portion, two spirituality and an AP even when crafting fails', () => {
    const s = promoted(); learn(s, 'IMPACT'); activity(s, { type: 'BUY_KIT' }); const ap = s.actionsRemaining, sp = s.spirituality;
    activity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }, 100); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - 2]);
    expect(s.scrollProfessor.workshop).toMatchObject({ craftAttempts: 1, craftFailures: 1, scrolls: [] }); expect(s.scrollProfessor.workshop.materials[0]!).toMatchObject({ status: 'SPENT', spentWeek: s.week });
    activity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }); expect(s.scrollProfessor.workshop.scrolls[0]!).toMatchObject({ id: 'scroll-professor-scroll-1', materialId: 'scroll-professor-material-2', makerSequence: 6, inscriptionMastery: 0, status: 'HELD', authorized: false }); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('keeps original scrolls across weeks and fixes mastery at inscription instead of retroactive scaling', () => {
    const s = promoted(); craft(s, 'IMPACT'); const original = structuredClone(s.scrollProfessor.workshop.scrolls[0]); s.week += 10;
    s.progression.mastery['hermit.s6.scrollcraft'] = 25; expect(s.scrollProfessor.workshop.scrolls[0]).toEqual(original); expect(validateScrollProfessorState(s)).toBe(true);
    expect(projectScrollProfessor(s).workshop.scrolls[0]!).toMatchObject({ inscriptionMastery: 0, status: 'HELD', authorized: false });
  });
  it('authorizes only the exact held original outside combat with no action or resource cost', () => {
    const s = promoted(); craft(s, 'IMPACT'); craft(s, 'WARD'); const [first, second] = s.scrollProfessor.workshop.scrolls, ap = s.actionsRemaining, sp = s.spirituality;
    activity(s, { type: 'AUTHORIZE_SCROLL', scrollId: first!.id, authorized: true }); expect([s.actionsRemaining, s.spirituality, first!.authorized, second!.authorized]).toEqual([ap, sp, true, false]); rejectActivity(s, { type: 'AUTHORIZE_SCROLL', scrollId: first!.id, authorized: true });
    activity(s, { type: 'AUTHORIZE_SCROLL', scrollId: first!.id, authorized: false }); expect(first!.authorized).toBe(false); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('rejects duplicated materials, forged makers/mastery, learned sources, use timing and reauthorization of spent scrolls', () => {
    const s = paper(); craft(s, 'WARD');
    const changes: ((t: SliceState) => void)[] = [
      t => { t.scrollProfessor.workshop.materials[1]!.id = t.scrollProfessor.workshop.materials[0]!.id; },
      t => { t.scrollProfessor.workshop.materials[0]!.status = 'HELD'; },
      t => { t.scrollProfessor.workshop.lastKitWeek! += 1; },
      t => { t.scrollProfessor.workshop.scrolls[1]!.id = t.scrollProfessor.workshop.scrolls[0]!.id; },
      t => { t.scrollProfessor.workshop.scrolls[1]!.materialId = t.scrollProfessor.workshop.scrolls[0]!.materialId; },
      t => { Object.assign(t.scrollProfessor.workshop.scrolls[0]!, { makerSequence: 5 }); },
      t => { t.scrollProfessor.workshop.scrolls[0]!.inscriptionMastery = 500; },
      t => { t.scrollProfessor.workshop.scrolls[0]!.usedWeek = null; },
      t => { t.scrollProfessor.workshop.scrolls[0]!.authorized = true; },
      t => { t.wizard.lessons['light-touch']!.learned = false; },
      t => { t.scrollProfessor.cases['paper-target']!.usedScrollIds = []; },
      t => { t.scrollProfessor.workshop.craftFailures += 1; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateScrollProfessorState(t)).toBe(false); }
    rejectActivity(s, { type: 'AUTHORIZE_SCROLL', scrollId: s.scrollProfessor.workshop.scrolls[0]!.id, authorized: true }); expect(validateScrollProfessorState(s)).toBe(true);
  });
});

describe('ScrollProfessor actual practice, closure and peaceful completion', () => {
  it('uses matching original scrolls separately and requires actual zero-AP closure before reporting', () => {
    const s = promoted(); craft(s, 'WARD'); begin(s, 'paper-target', 'ORDINARY'); activity(s, { type: 'WITHDRAW', caseId: 'paper-target' }); rejectActivity(s, { type: 'PREPARE', caseId: 'paper-target', method: 'ABILITY' }); craft(s, 'IMPACT');
    activity(s, { type: 'PREPARE', caseId: 'paper-target', method: 'ABILITY' }); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'paper-target' }); expect(s.spirituality).toBe(sp - 1); expect(scrollProfessorInside(s)).toBe(true); expect(s.scrollProfessor.workshop.scrolls.map(x => x.status)).toEqual(['HELD', 'USED']);
    rejectActivity(s, { type: 'REPORT', caseId: 'paper-target' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); const ap = s.actionsRemaining; activity(s, { type: 'CLOSE', caseId: 'paper-target' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'REPORT', caseId: 'paper-target' }); expect(s.progression.acting).toBe(25); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('spends the same original and spirituality on failed activation, then waits for a new real week', () => {
    const s = promoted(); craft(s, 'IMPACT'); begin(s, 'paper-target'); const sp = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'paper-target' }, 100); expect(s.spirituality).toBe(sp - 1); expect(s.scrollProfessor.workshop.scrolls[0]!.status).toBe('USED'); activity(s, { type: 'CLOSE', caseId: 'paper-target' });
    rejectActivity(s, { type: 'REPORT', caseId: 'paper-target' }); rejectActivity(s, { type: 'PREPARE', caseId: 'paper-target', method: 'ABILITY' });
    s.week += 1; craft(s, 'IMPACT'); activity(s, { type: 'PREPARE', caseId: 'paper-target', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'paper-target' }); activity(s, { type: 'CLOSE', caseId: 'paper-target' }); activity(s, { type: 'REPORT', caseId: 'paper-target' });
    expect(s.scrollProfessor.cases['paper-target']!.usedScrollIds).toEqual(['scroll-professor-scroll-1', 'scroll-professor-scroll-2']); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('permits ordinary hand and original padded-board routes without learning spells or spending spirituality', () => {
    const s = promoted(), sp = s.spirituality; complete(s, 'paper-target', 'ORDINARY'); complete(s, 'soft-ward', 'ORDINARY'); complete(s, 'willing-reader', 'ORDINARY'); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.scrollProfessor.workshop.kitsBought]).toEqual([100, sp, 0]); expect(Object.values(s.wizard.lessons).every(l => !l.learned)).toBe(true); expect(s.combat).toBeNull();
    for (const id of SCROLL_PROFESSOR_CASE_IDS) rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'REFLECT' }); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('preserves the adult reader’s refusal and permits a later narrower lesson without producing new scrolls', () => {
    const s = ward(), original = structuredClone(s.scrollProfessor.workshop), sp = s.spirituality; begin(s, 'willing-reader'); activity(s, { type: 'PERFORM', caseId: 'willing-reader' }, 100); activity(s, { type: 'CLOSE', caseId: 'willing-reader' });
    expect(s.scrollProfessor.workshop).toEqual(original); expect(s.spirituality).toBe(sp); rejectActivity(s, { type: 'REPORT', caseId: 'willing-reader' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'willing-reader', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'willing-reader' }); activity(s, { type: 'CLOSE', caseId: 'willing-reader' }); activity(s, { type: 'REPORT', caseId: 'willing-reader' }); activity(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.scrollProfessor.workshop).toEqual(original); expect(validateScrollProfessorLife(s)).toBe(true); expect(validateScrollProfessorState(s)).toBe(true);
    expect(scrollProfessorCases(s)).toHaveLength(3); expect(scrollProfessorActions(s).every(a => a.command.type !== 'REPORT' && a.command.type !== 'REFLECT')).toBe(true);
  });
});

describe('ScrollProfessor independent courtyard source and real consequences', () => {
  it('requires a real report and actual arrival, respects refusal and leaves a peaceful route', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'paper-target', 'ORDINARY'); const acting = s.progression.acting;
    activity(s, { type: 'ENCOUNTER_TALK' }, 100); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.scrollProfessor.encounter.status, s.progression.acting, s.combat]).toEqual(['RESOLVED', acting, null]); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('recognizes only current living courtyard contact and blocks authorization during the encounter', () => {
    const s = paper(); craft(s, 'WARD'); const id = s.scrollProfessor.workshop.scrolls.at(-1)!.id;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); expect(hasScrollProfessorDisputeOpponent(s)).toBe(true); rejectActivity(s, { type: 'AUTHORIZE_SCROLL', scrollId: id, authorized: true });
    const stale = structuredClone(s); stale.week += 1; expect(hasScrollProfessorDisputeOpponent(stale)).toBe(false); const dead = structuredClone(s); dead.combat!.enemyHealth = 0; expect(hasScrollProfessorDisputeOpponent(dead)).toBe(false); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('retreats by the original exit without pursuit, theft, healing, refund or reward', () => {
    const s = paper(), originals = structuredClone(s.scrollProfessor.workshop); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.health = 43; s.mind = 62; const ctx = context(s);
    settleScrollProfessorEncounter(s, 'RETREATED', ctx.c, ctx.award); expect([s.health, s.mind, s.combat, s.scrollProfessor.encounter.status]).toEqual([43, 62, null, 'RETREATED']); expect(ctx.award).not.toHaveBeenCalled(); expect(s.scrollProfessor.workshop).toEqual(originals); expect(validateScrollProfessorState(s)).toBe(true);
  });
  it('awards only a living effective fight once, without acting or automatic mastery duplication', () => {
    const s = paper(), acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '真实原地打击', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s); settleScrollProfessorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award); expect(ctx.award).toHaveBeenCalledExactlyOnceWith('scroll-professor-dispute', 25); expect(s.progression.acting).toBe(acting); expect(validateScrollProfessorState(s)).toBe(true);
    expect(() => settleScrollProfessorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow(); const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validateScrollProfessorState(forged)).toBe(false);
  });
  it('preserves true death with no revival or reward', () => {
    const s = paper(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD'; const ctx = context(s); settleScrollProfessorEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.scrollProfessor.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateScrollProfessorState(s)).toBe(true);
  });
});
