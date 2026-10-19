import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../../src/domain/corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../../src/domain/gravedigger/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../../src/domain/spiritmedium/types.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../../src/domain/spirit-guide/types.js';
import { applyGatekeeperCommand, createGatekeeperState, isGatekeeperAcquisitionCommand, projectGatekeeper, validateGatekeeperCommand, validateGatekeeperState } from '../../src/domain/gatekeeper/index.js';
import { GATEKEEPER_ABILITIES, GATEKEEPER_FORMULA_STATUS, GATEKEEPER_PRICES, GATEKEEPER_SOURCE_STATUS } from '../../src/domain/gatekeeper/content.js';
import { GATEKEEPER_ABILITY_IDS, type GatekeeperAcquisitionCommand } from '../../src/domain/gatekeeper/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function spiritGuide(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/spirit-guide-v0820/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.gatekeeper = createGatekeeperState(); s.week = s.spiritGuide.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: GatekeeperAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyGatekeeperCommand(s, command, c); return c;
}
function taught(s = spiritGuide()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.gatekeeper.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.gatekeeper.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyGatekeeperCommand(s, command as GatekeeperAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Gatekeeper S5 finished originals and bounded G promotion', () => {
  it('hides the future channel and creates independent original bottles and practice state', () => {
    const s = createSliceRun('gatekeeper-hidden', sliceDefaultCreationSelection, 'gatekeeper-hidden');
    expect(validateGatekeeperState(s)).toBe(true);
    expect(projectGatekeeper(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectGatekeeper(s).story).toBeUndefined();
    const other = createGatekeeperState(); other.practice.marker = 'RECIPIENT'; other.companion.status = 'INSIDE'; other.bottles[0]!.labourSteps = 5;
    expect(s.gatekeeper.practice.marker).toBe('DESK'); expect(s.gatekeeper.companion.status).toBe('OUTSIDE'); expect(s.gatekeeper.bottles[0]!.labourSteps).toBe(0);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('opens the existing spiritGuide channel and takes 460 plus one action without revealing a formula or ritual', () => {
    const s = spiritGuide(), old = structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide]);
    expect(validateGatekeeperState(s)).toBe(true);
    expect(projectGatekeeper(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide]).toEqual(old);
    expect(GATEKEEPER_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(GATEKEEPER_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(projectGatekeeper(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(GATEKEEPER_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取看门人用药说明', expect.stringContaining('实际核对原瓶、准备原纪念工作室安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment per bottle, with no transferable or partial credit', () => {
    const s = taught(), b = s.gatekeeper.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.gatekeeper.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateGatekeeperState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.gatekeeper.bottles[2]!.id });
  });
  it('allows early preparation but requires spiritGuide digestion100 and twelve complete weeks before drinking', () => {
    const s = spiritGuide(); s.week = s.spiritGuide.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateGatekeeperState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectGatekeeper(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes exactly the selected original and applies all four fixed guided result tiers', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.gatekeeper.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次看门人服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.gatekeeper.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateGatekeeperState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('requires health above20 and mind above40 without rolling or consuming a bottle at the boundary', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.gatekeeper.bottles[0]!.id, confirmed: true });
      expect(s.gatekeeper.bottles[0]!.status).toBe('PLAYER');
      expect(projectGatekeeper(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves every old ID and past spirit cases, adds two zero masteries without a free spirit or refill', () => {
    const s = prepared(), old = structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.gatekeeper.bottles[0]!.id, confirmed: true });
    expect([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide]).toEqual(old);
    expect(s.gatekeeper.spiritGuideActingAtPromotion).toBe(100);
    expect(s.spiritGuide.messenger).toMatchObject({ recruited: true, letter: 'RECIPIENT', feePaid: 12 });
    expect(s.gatekeeper.inviteAttemptWeek).toBeNull();
    expect(Object.keys(s.progression.mastery)).toEqual([...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS, ...GATEKEEPER_ABILITY_IDS]);
    expect(GATEKEEPER_ABILITY_IDS).toEqual(['death.s5.inner-underworld', 'death.s5.underworld-door']);
    for (const id of GATEKEEPER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.gatekeeper.companion).toEqual({ source: 'SG6-GRAY-FEATHER', status: 'OUTSIDE', agreementWeek: null, entries: 0, releases: 0, deployments: 0, recalls: 0, feePaid: 0 });
    expect(s.gatekeeper.practice).toEqual({ marker: 'DESK', gateOpen: false, deliveries: 0, returns: 0, gateTests: 0 });
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(GATEKEEPER_ABILITIES).toHaveLength(2); expect(GATEKEEPER_ABILITIES[0]!.description).toContain('晋升不附赠任何灵');
    expect(GATEKEEPER_SOURCE_STATUS).toContain('高位存在可以挣脱'); expect(GATEKEEPER_SOURCE_STATUS).toContain('体内冥界'); expect(GATEKEEPER_SOURCE_STATUS).toContain('序列4');
    expect(projectGatekeeper(s).digestion).toContain('看门人扮演0/100');
  });
  it('retains failed originals and waits a real week for the next batch without free delivery to the player', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.gatekeeper.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.gatekeeper.bottles.slice(0, 3)).toEqual(originals); expect(s.gatekeeper.bottles).toHaveLength(6);
    expect(s.gatekeeper.bottles[3]).toMatchObject({ id: 'gatekeeper-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectGatekeeper(s).actions.find(a => a.id === 'buy-gatekeeper-potion-4')!.cost).toContain('4800便士');
    expect(validateGatekeeperState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for actual purchase and confirmed consumption of the selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.gatekeeper.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.gatekeeper.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' });
    expect(validateGatekeeperState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' });
    reject(s, { type: 'BUY_POTION', bottleId: s.gatekeeper.bottles[2]!.id });
  });
  it('keeps action costs, location, event and finished-run boundaries atomic', () => {
    const withoutAction = spiritGuide(); withoutAction.actionsRemaining = 0;
    reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = spiritGuide(); withoutCash.cash = 459;
    reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD';
    reject(dead, { type: 'CONSUME', bottleId: dead.gatekeeper.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE';
    reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.gatekeeper.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.gatekeeper.bottles[0]!.id });
  });
  it('rejects invented commands and extra fields while keeping exact life commands outside acquisition', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'gatekeeper-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'spirit-guide-potion-1' }, { type: 'SIGNAL', caseId: 'shared-task' }, { type: 'REFLECT', extra: true }, { type: 'PREPARE', caseId: 'resting-place', method: 'ASTROLOGY' }];
    for (const command of malformed) {
      expect(validateGatekeeperCommand(command)).toBe(false); expect(isGatekeeperAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
    for (const command of [{ type: 'CLOSE', caseId: 'shared-task' }, { type: 'PREPARE', caseId: 'controlled-threshold', method: 'ABILITY' }]) {
      expect(validateGatekeeperCommand(command)).toBe(true); expect(isGatekeeperAcquisitionCommand(command)).toBe(false); reject(promoted(), command);
    }
  });
  it('rejects forged sources, chronology, promotion snapshots, mastery and malformed nested saves without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.gatekeeper.bottles[0]!.source = 'invented'; },
      t => { t.gatekeeper.bottles[0]!.consumedWeek = t.gatekeeper.promotionWeek! - 1; },
      t => { t.gatekeeper.spiritGuideActingAtPromotion = 99; },
      t => { delete t.progression.mastery[CORPSECOLLECTOR_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['death.s5.free-revival'] = 0; },
      t => { t.gatekeeper.bottles[1]!.labourSteps = 6; },
      t => { (t.gatekeeper as unknown as Record<string, unknown>).practice = null; },
      t => { (t.gatekeeper as unknown as Record<string, unknown>).companion = null; },
      t => { (t.gatekeeper.companion as unknown as Record<string, unknown>).extraSpirit = 'invented'; },
      t => { t.gatekeeper.companion.status = 'INSIDE'; },
      t => { t.gatekeeper.practice.marker = 'RECIPIENT'; },
      t => { (t.gatekeeper.cases as unknown as Record<string, unknown>)['resting-place'] = null; },
      t => { (t.gatekeeper as unknown as Record<string, unknown>).encounter = null; },
      t => { t.gatekeeper.inviteAttemptWeek = t.week + 1; },
      t => { t.gatekeeper.companion.source = 'SW5-LEAF-1' as never; },
      t => { t.gatekeeper.companion.entries = 1; },
      t => { t.gatekeeper.companion.feePaid = 12; },
      t => { t.gatekeeper.practice.gateOpen = true; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateGatekeeperState(t)).not.toThrow(); expect(validateGatekeeperState(t)).toBe(false);
    }
  });
  it('projects bounded S5 capabilities without exposing mutable companion or practice state', () => {
    const s = promoted(), p = projectGatekeeper(s);
    expect(p.practice).toBeNull(); expect(p.companion).toBeNull();
    expect(p.abilities.map(x => x.id)).toEqual([...GATEKEEPER_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[GATEKEEPER_ABILITY_IDS[0]]).toBe(0);
    const before = structuredClone(s); projectGatekeeper(s); expect(s).toEqual(before);
  });
  it('accepts only exact finite-original life commands and never routes them through acquisition', () => {
    for (const type of ['INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_MARKER'] as const) {
      expect(validateGatekeeperCommand({ type })).toBe(true);
      expect(isGatekeeperAcquisitionCommand({ type })).toBe(false);
      expect(validateGatekeeperCommand({ type, source: 'SG6-OTHER-SPIRIT' })).toBe(false);
      reject(promoted(), { type });
    }
    expect(validateGatekeeperCommand({ type: 'INVITE_SPIRIT', caseId: 'resting-place' })).toBe(false);
    expect(validateGatekeeperCommand({ type: 'RETRIEVE_MARKER', count: 2 })).toBe(false);
  });
});
