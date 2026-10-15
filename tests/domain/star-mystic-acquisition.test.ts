import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { PRYER_ABILITY_IDS } from '../../src/domain/pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../../src/domain/combat-scholar/types.js';
import { WIZARD_ABILITY_IDS, WIZARD_SPELL_IDS } from '../../src/domain/wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS, SCROLL_PROFESSOR_SCROLL_KINDS } from '../../src/domain/scroll-professor/types.js';
import { SCROLL_PROFESSOR_GUIDE } from '../../src/domain/scroll-professor/content.js';
import { applyScrollProfessorActivity } from '../../src/domain/scroll-professor/life.js';
import { projectScrollProfessor, validateScrollProfessorCommand } from '../../src/domain/scroll-professor/index.js';
import { applyStarMysticCommand, createStarMysticState, freshStarMysticPractice, isStarMysticAcquisitionCommand, projectStarMystic, validateStarMysticCommand, validateStarMysticState } from '../../src/domain/star-mystic/index.js';
import { STAR_MYSTIC_ABILITIES, STAR_MYSTIC_FORMULA_STATUS, STAR_MYSTIC_GUIDE, STAR_MYSTIC_LENSES_ID, STAR_MYSTIC_LENSES_PRICE, STAR_MYSTIC_PRICES, STAR_MYSTIC_SOURCE_STATUS } from '../../src/domain/star-mystic/content.js';
import { STAR_MYSTIC_ABILITY_IDS, STAR_MYSTIC_CASE_IDS, type StarMysticAcquisitionCommand } from '../../src/domain/star-mystic/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function scrollProfessor(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/scroll-professor-v0870/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.starMystic = createStarMysticState(); s.week = Math.max(s.week, s.scrollProfessor.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: StarMysticAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyStarMysticCommand(s, command, c); return c;
}
function taught(s = scrollProfessor()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.starMystic.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.starMystic.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyStarMysticCommand(s, command as StarMysticAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Star Mystic HERMIT S5 actual finished bottles and bounded promotion', () => {
  it('hides the future channel and creates independent bottles, lenses, practice and encounter', () => {
    const s = createSliceRun('star-mystic-hidden', sliceDefaultCreationSelection, 'star-mystic-hidden');
    expect(validateStarMysticState(s)).toBe(true);
    expect(projectStarMystic(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectStarMystic(s).story).toBeUndefined(); expect(projectStarMystic(s).workshop).toBeUndefined();
    const other = createStarMysticState(); other.practice.lenses = 'WORN'; other.practice.markerSeen = true; other.bottles[0]!.labourSteps = 5; other.encounter.focused = true;
    expect(s.starMystic.practice).toEqual(freshStarMysticPractice()); expect(s.starMystic.bottles[0]!.labourSteps).toBe(0); expect(s.starMystic.encounter.focused).toBe(false);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the same Ire channel and charges 460 plus one action without claiming a recipe or ritual', () => {
    const s = scrollProfessor(), old = structuredClone([s.pryer, s.combatScholar, s.wizard, s.scrollProfessor]);
    expect(validateStarMysticState(s)).toBe(true);
    expect(projectStarMystic(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.pryer, s.combatScholar, s.wizard, s.scrollProfessor]).toEqual(old);
    expect(STAR_MYSTIC_GUIDE).toBe(SCROLL_PROFESSOR_GUIDE);
    expect(STAR_MYSTIC_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectStarMystic(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(STAR_MYSTIC_FORMULA_STATUS).toContain('完整配方');
    expect(STAR_MYSTIC_FORMULA_STATUS).toContain('细节尚未核实');
    expect(STAR_MYSTIC_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取星象师用药说明', expect.stringContaining('实际核对原瓶、准备原法术教学室安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment for the selected bottle only', () => {
    const s = taught(), b = s.starMystic.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.starMystic.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateStarMysticState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.starMystic.bottles[2]!.id });
  });
  it('allows early preparation but requires old digestion100 and twelve complete weeks to drink', () => {
    const s = scrollProfessor(); s.week = s.scrollProfessor.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateStarMysticState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectStarMystic(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four public risk tiers with will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.starMystic.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次星象师服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.starMystic.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateStarMysticState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps health20 and mind40 boundaries atomic without rolling or consuming', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.starMystic.bottles[0]!.id, confirmed: true });
      expect(s.starMystic.bottles[0]!.status).toBe('PLAYER');
      expect(projectStarMystic(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves all lower identities, originals, actual lessons, old maker sequences and resolved enemy history', () => {
    const s = prepared(), old = structuredClone([s.pryer, s.combatScholar, s.wizard, s.scrollProfessor, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.starMystic.bottles[0]!.id, confirmed: true });
    expect([s.pryer, s.combatScholar, s.wizard, s.scrollProfessor, s.combatHistory]).toEqual(old);
    expect(s.starMystic.scrollProfessorActingAtPromotion).toBe(100);
    expect(s.scrollProfessor.encounter.status).toBe('RESOLVED');
    expect(s.scrollProfessor.workshop.scrolls).toHaveLength(6);
    expect(s.scrollProfessor.workshop.scrolls.every(scroll => scroll.makerSequence === 6 && scroll.status === 'USED')).toBe(true);
    expect(Object.keys(s.progression.mastery)).toEqual([...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS]);
    expect(STAR_MYSTIC_ABILITY_IDS).toEqual(['hermit.s5.mystic-sight', 'hermit.s5.star-cage']);
    for (const id of STAR_MYSTIC_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.starMystic.practice).toEqual(freshStarMysticPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectStarMystic(s).digestion).toContain('星象师扮演0/100');
    expect(validateStarMysticState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.starMystic.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.starMystic.bottles.slice(0, 3)).toEqual(originals); expect(s.starMystic.bottles).toHaveLength(6);
    expect(s.starMystic.bottles[3]).toMatchObject({ id: 'star-mystic-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectStarMystic(s).actions.find(a => a.id === 'buy-star-mystic-potion-4')!.cost).toContain('4800便士');
    expect(validateStarMysticState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.starMystic.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.starMystic.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' });
    expect(validateStarMysticState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.starMystic.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = scrollProfessor(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = scrollProfessor(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.starMystic.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.starMystic.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.starMystic.bottles[0]!.id });
  });
  it('rejects forged bottle sources, snapshots, mastery and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.starMystic.bottles[0]!.source = 'invented'; },
      t => { t.starMystic.bottles[0]!.consumedWeek = t.starMystic.promotionWeek! - 1; },
      t => { t.starMystic.scrollProfessorActingAtPromotion = 99; },
      t => { delete t.progression.mastery[PRYER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['hermit.s4.mystical-reenactment'] = 0; },
      t => { t.starMystic.bottles[1]!.labourSteps = 6; },
      t => { (t.starMystic as unknown as Record<string, unknown>).practice = null; },
      t => { t.starMystic.practice.playerNode = 'COURTYARD'; },
      t => { t.starMystic.practice.companionNode = 'MARK'; },
      t => { t.starMystic.practice.screen = 'OPEN'; },
      t => { t.starMystic.practice.cageActive = true; },
      t => { t.starMystic.encounter.cageReady = true; },
      t => { (t.starMystic.encounter as unknown as Record<string, unknown>).focused = 'yes'; },
      t => { (t.starMystic.encounter as unknown as Record<string, unknown>).freeSpell = true; },
      t => { (t.starMystic.practice as unknown as Record<string, unknown>).summonedAlly = true; },
      t => { (t.starMystic.cases as unknown as Record<string, unknown>)['veiled-marker'] = null; },
      t => { (t.starMystic as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateStarMysticState(t)).not.toThrow(); expect(validateStarMysticState(t)).toBe(false);
    }
  });
  it('projects only two new masteries and detached actual workshop originals without leaking the unseen plaque', () => {
    const s = promoted(), p = projectStarMystic(s);
    expect(p.practice).toBeNull(); expect(p.abilities.map(x => x.id)).toEqual([...STAR_MYSTIC_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    expect(p.workshop).toEqual(projectScrollProfessor(s).workshop);
    expect(p.workshop!.scrolls.map(scroll => scroll.id)).toEqual(s.scrollProfessor.workshop.scrolls.map(scroll => scroll.id));
    expect(JSON.stringify(p)).not.toMatch(/三道横刻痕|三条横刻痕|三道横痕|左手|右手/);
    p.abilities[0]!.mastery = 99; p.workshop!.materials[0]!.status = 'HELD'; p.workshop!.scrolls[0]!.authorized = true;
    expect(s.progression.mastery[STAR_MYSTIC_ABILITY_IDS[0]]).toBe(0);
    expect(s.scrollProfessor.workshop.materials[0]!.status).toBe('SPENT'); expect(s.scrollProfessor.workshop.scrolls[0]!.authorized).toBe(false);
    const before = structuredClone(s); projectStarMystic(s); expect(s).toEqual(before);
  });
  it('accepts exact finite-case commands and leaves uncertain-chart strictly ordinary', () => {
    for (const caseId of STAR_MYSTIC_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateStarMysticCommand({ type, caseId })).toBe(true); expect(isStarMysticAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateStarMysticCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateStarMysticCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateStarMysticCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId !== 'uncertain-chart');
    }
    for (const type of ['BUY_LENSES', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) {
      expect(validateStarMysticCommand({ type })).toBe(true); expect(isStarMysticAcquisitionCommand({ type })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'star-mystic-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'scroll-professor-potion-1' }, { type: 'CREATE_STORY_SPELL' }, { type: 'FORECAST_FUTURE_WEATHER' }, { type: 'REFLECT', extra: true }]) {
      expect(validateStarMysticCommand(command)).toBe(false); expect(isStarMysticAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('uses unchanged finite workshop command identities instead of inventing a new spell or scroll library', () => {
    const commands = [
      { type: 'BUY_KIT' },
      ...WIZARD_SPELL_IDS.map(spellId => ({ type: 'LEARN_SPELL', spellId })),
      ...SCROLL_PROFESSOR_SCROLL_KINDS.map(kind => ({ type: 'CRAFT_SCROLL', kind })),
      { type: 'AUTHORIZE_SCROLL', scrollId: 'scroll-professor-scroll-1', authorized: true },
    ];
    for (const command of commands) {
      expect(validateStarMysticCommand(command)).toBe(validateScrollProfessorCommand(command));
      expect(validateStarMysticCommand(command)).toBe(true); expect(isStarMysticAcquisitionCommand(command)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_SPELL', spellId: 'free-star-library' }, { type: 'CRAFT_SCROLL', kind: 'STAR_CAGE' }, { type: 'AUTHORIZE_SCROLL', scrollId: 'SM5-FAKE-1', authorized: true }, { type: 'BUY_KIT', materials: 100 }]) expect(validateStarMysticCommand(command)).toBe(false);
    const s = prepared(); s.wizard.lessons['blur-mark']!.learned = false;
    act(s, { type: 'CONSUME', bottleId: s.starMystic.bottles[0]!.id, confirmed: true });
    expect(s.wizard.lessons['blur-mark']!.learned).toBe(false); expect(s.starMystic.practice.lenses).toBe('SUPPLIER');
    expect(STAR_MYSTIC_LENSES_ID).toBe('SM5-LENS-1'); expect(STAR_MYSTIC_LENSES_PRICE).toBe(80);
  });
  it('makes one actual S5 scroll from the same original held material without copying or rewriting old originals', () => {
    const s = promoted(), w = s.scrollProfessor.workshop, old = structuredClone(w.scrolls);
    const material = w.materials.find(item => item.status === 'HELD')!, materialId = material.id;
    const previous = { actions: s.actionsRemaining, spirituality: s.spirituality, attempts: w.craftAttempts, mastery: s.progression.mastery['hermit.s6.scrollcraft'] };
    const c = context(s), award = vi.fn();
    applyScrollProfessorActivity(s, { type: 'CRAFT_SCROLL', kind: 'IMPACT' }, c, award);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, w.craftAttempts]).toEqual([previous.actions - 1, previous.spirituality - 2, previous.attempts + 1]);
    expect(material).toMatchObject({ id: materialId, status: 'SPENT', spentWeek: s.week });
    expect(w.scrolls.slice(0, old.length)).toEqual(old); expect(w.scrolls).toHaveLength(old.length + 1);
    const created = w.scrolls.at(-1)!;
    expect(created).toMatchObject({ id: `scroll-professor-scroll-${old.length + 1}`, kind: 'IMPACT', makerSequence: 5, inscriptionMastery: previous.mastery, materialId, createdWeek: s.week, status: 'HELD', usedWeek: null, authorized: false });
    applyScrollProfessorActivity(s, { type: 'AUTHORIZE_SCROLL', scrollId: created.id, authorized: true }, c, award);
    expect(created.authorized).toBe(true); expect(w.scrolls.slice(0, old.length)).toEqual(old);
    expect([s.actionsRemaining, s.spirituality]).toEqual([previous.actions - 1, previous.spirituality - 2]);
    expect(projectStarMystic(s).workshop!.scrolls.at(-1)).toMatchObject({ id: created.id, makerSequence: 5, materialId });
    expect(validateStarMysticState(s)).toBe(true);
  });
  it('still spends one old material and 2 spirituality on a failed S5 inscription without creating a scroll', () => {
    const s = promoted(), w = s.scrollProfessor.workshop, old = structuredClone(w.scrolls);
    const held = w.materials.find(item => item.status === 'HELD')!, failures = w.craftFailures, actions = s.actionsRemaining;
    applyScrollProfessorActivity(s, { type: 'CRAFT_SCROLL', kind: 'WARD' }, context(s, 100), vi.fn());
    expect(held).toMatchObject({ status: 'SPENT', spentWeek: s.week });
    expect(w.scrolls).toEqual(old); expect(w.craftFailures).toBe(failures + 1);
    expect(s.spirituality).toBe(29); expect(s.actionsRemaining).toBe(actions - 1);
    expect(s.progression.mastery['hermit.s6.scrollcraft']).toBe(8);
  });
  it('distinguishes HERMIT from PARAGON and bounds enhanced sight, direct cage and unknown ritual', () => {
    expect(STAR_MYSTIC_ABILITIES).toHaveLength(2);
    expect(STAR_MYSTIC_SOURCE_STATUS).toContain('不是通识者途径（PARAGON）的天文学家5');
    expect(STAR_MYSTIC_SOURCE_STATUS).toContain('厚玻璃眼镜可过滤'); expect(STAR_MYSTIC_SOURCE_STATUS).toContain('视觉纷乱');
    expect(STAR_MYSTIC_SOURCE_STATUS).toContain('不烧新卷'); expect(STAR_MYSTIC_SOURCE_STATUS).toContain('不确定性');
    expect(STAR_MYSTIC_SOURCE_STATUS).toContain('序列4是神秘学家'); expect(STAR_MYSTIC_SOURCE_STATUS).toContain('序列2才是贤者');
    expect(STAR_MYSTIC_SOURCE_STATUS).toContain('没有从任意故事免费创术'); expect(STAR_MYSTIC_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    const wrongPath = scrollProfessor(); wrongPath.progression.pathwayId = 'paragon';
    expect(projectStarMystic(wrongPath).discovered).toBe(false); reject(wrongPath, { type: 'LEARN_GUIDANCE' });
  });
  it('blocks acquisition during actual new or inherited unfinished contact and return routes', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.starMystic.cases['veiled-marker']!.contactOpen = true; },
      s => { s.starMystic.practice.screen = 'OPEN'; },
      s => { s.starMystic.practice.lenses = 'HELD'; },
      s => { s.starMystic.practice.cageActive = true; },
      s => { s.starMystic.practice.playerNode = 'COURTYARD'; },
      s => { s.starMystic.practice.companionNode = 'MARK'; },
      s => { s.scrollProfessor.cases['paper-target']!.contactOpen = true; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.starMystic.bottles[0]!.id, confirmed: true });
      expect(projectStarMystic(s).insideCase).toBe(true);
    }
  });
  it('rejects forged early resupply, duplicate originals and an unknown complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.starMystic.resupply.requestedWeek = t.week; },
      t => { t.starMystic.resupply.deliveries = 1; },
      t => { t.starMystic.bottles[1]!.id = t.starMystic.bottles[0]!.id; },
      t => { t.starMystic.bottles[1]!.source = t.scrollProfessor.bottles[0]!.id; },
      t => { (t.starMystic as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.scrollProfessor.guidanceKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t);
      expect(() => validateStarMysticState(t)).not.toThrow(); expect(validateStarMysticState(t)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS', batchId: 'star-mystic-batch-1' }, { type: 'BREW', batchId: 'star-mystic-batch-1' }]) reject(s, command);
  });
  it('keeps unused purchased originals and caps base stats without filling spirituality', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1);
    s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second.status).toBe('PLAYER'); expect(second.consumedWeek).toBeNull();
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(validateStarMysticState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
  });
  it('preserves the actual old natural record through migration before new activity', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/scroll-professor-v0870/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.starMystic).toEqual(createStarMysticState()); expect(validateStarMysticState(s)).toBe(true);
  });
});
