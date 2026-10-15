import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCorpsecollectorCommand } from '../../src/domain/corpsecollector/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../../src/domain/corpsecollector/types.js';
import { applyGravediggerCommand } from '../../src/domain/gravedigger/index.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../../src/domain/gravedigger/types.js';
import { applySpiritmediumCommand } from '../../src/domain/spiritmedium/index.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../../src/domain/spiritmedium/types.js';
import { applySpiritGuideCommand, createSpiritGuideState, projectSpiritGuide, validateSpiritGuideCommand, validateSpiritGuideState } from '../../src/domain/spirit-guide/index.js';
import { applySpiritGuideActivity, spiritGuideActions, spiritGuideCases, spiritGuideInside, validateSpiritGuideLife } from '../../src/domain/spirit-guide/life.js';
import { settleSpiritGuideEncounter } from '../../src/domain/spirit-guide/encounter.js';
import { SPIRIT_GUIDE_FORMULA_STATUS, SPIRIT_GUIDE_PRICES, SPIRIT_GUIDE_SOURCE_STATUS } from '../../src/domain/spirit-guide/content.js';
import { SPIRIT_GUIDE_ABILITY_IDS, SPIRIT_GUIDE_CASE_IDS, type SpiritGuideAcquisitionCommand, type SpiritGuideActivityCommand, type SpiritGuideCaseId } from '../../src/domain/spirit-guide/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('spiritGuide-domain', sliceDefaultCreationSelection, 'spiritGuide-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spiritGuide = createSpiritGuideState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[SPIRIT_GUIDE_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function spiritmedium(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyCorpsecollectorCommand(s, { type: 'DISCOVER' }, c);
  applyCorpsecollectorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCorpsecollectorCommand(s, { type: 'BUY_POTION', bottleId: s.corpsecollector.bottles[0]!.id }, c);
  applyCorpsecollectorCommand(s, { type: 'CONSUME', bottleId: s.corpsecollector.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyGravediggerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyGravediggerCommand(s, { type: 'BUY_POTION', bottleId: s.gravedigger.bottles[0]!.id }, c);
  applyGravediggerCommand(s, { type: 'CONSUME', bottleId: s.gravedigger.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applySpiritmediumCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySpiritmediumCommand(s, { type: 'BUY_POTION', bottleId: s.spiritmedium.bottles[0]!.id }, c);
  applySpiritmediumCommand(s, { type: 'CONSUME', bottleId: s.spiritmedium.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: SpiritGuideAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applySpiritGuideCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: SpiritGuideActivityCommand, roll = 1) { const ctx = context(s, roll); applySpiritGuideActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = spiritmedium()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.spiritGuide.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.spiritGuide.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applySpiritGuideCommand(s, command as SpiritGuideAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applySpiritGuideActivity(s, command as SpiritGuideActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: SpiritGuideCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: SpiritGuideCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId });
  activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}

describe('SpiritGuide S6 original supply and inherited growth', () => {
  it('starts with independent stock and no recruited spirit, hiding the unknown future channel', () => {
    const s = ordinary(), p = projectSpiritGuide(s), other = createSpiritGuideState();
    expect(validateSpiritGuideState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [] });
    expect(p.story).toBeUndefined(); expect(spiritGuideCases(s)).toEqual([]);
    expect(p.messenger).toEqual({ recruited: false, deliveries: 0, letter: 'DESK', replyReceived: false, feePaid: 0 });
    other.bottles[0]!.labourSteps = 5; other.messenger.recruited = true;
    expect(s.spiritGuide.bottles[0]!.labourSteps).toBe(0); expect(s.spiritGuide.messenger.recruited).toBe(false);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges actual guidance and five corresponding labour actions before a 320-penny original handover', () => {
    const s = spiritmedium(), old = structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium]);
    acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.corpsecollector, s.gravedigger, s.spiritmedium]).toEqual(old);
    const b = s.spiritGuide.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([s.actionsRemaining, b.status]).toEqual([94, 'SUPPLIER']);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(SPIRIT_GUIDE_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(SPIRIT_GUIDE_FORMULA_STATUS).toContain('尚未核实'); expect(projectSpiritGuide(s).formula).toEqual([]);
    expect(s.spiritGuide.bottles[1]!.labourSteps).toBe(0); rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id });
    expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('does not partially discount or transfer labour and enforces acting100 plus twelve actual S7 weeks at drinking', () => {
    const s = spiritmedium(); s.week = 19; s.progression.acting = 0; taught(s);
    acquisition(s, { type: 'POTION_WORK', bottleId: s.spiritGuide.bottles[0]!.id }); const cash = s.cash, b = buy(s);
    expect(cash - s.cash).toBe(3320); expect(validateSpiritGuideState(s)).toBe(true);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it('retains each of the four recoverable drinking outcomes and all prior mastery', () => {
    for (const [roll, tier, mind, health, pollution, sequence] of [[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.spiritGuide.bottles[0]!;
      const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 7) expect(s.progression.acting).toBe(100);
      expect(validateSpiritGuideState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('inherits every exact Death-family ID and adds only two zero masteries, four +1 stats, without a refill', () => {
    const s = prepared(), old = structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.spiritGuide.bottles[0]!.id, confirmed: true });
    expect([s.corpsecollector, s.gravedigger, s.spiritmedium]).toEqual(old); expect(s.spiritGuide.spiritmediumActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS]);
    expect(SPIRIT_GUIDE_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(SPIRIT_GUIDE_SOURCE_STATUS).toContain('序列5');
  });
  it('delivers a new priced batch only in a later real week after three actual failed originals', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.spiritGuide.bottles); acquisition(s, { type: 'REQUEST_SUPPLY' });
    rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.spiritGuide.bottles.slice(0, 3)).toEqual(originals); expect(s.spiritGuide.bottles).toHaveLength(6);
    expect(s.spiritGuide.bottles[3]).toMatchObject({ id: 'spirit-guide-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validateSpiritGuideState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects forged command fields, old bottle reuse and invented original sources without mutation', () => {
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'spirit-guide-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'messenger-terms', method: 'CONTROL_ALL' }, { type: 'CLOSE', caseId: 'short-delivery', returnMethod: 'TELEPORT' }, { type: 'REFLECT', extra: true }]) {
      expect(validateSpiritGuideCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
    }
    const s = promoted();
    for (const change of [(t: SliceState) => { t.spiritGuide.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.spiritGuide.spiritmediumActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[GRAVEDIGGER_ABILITY_IDS[0]]; }]) { const t = structuredClone(s); change(t); expect(validateSpiritGuideState(t)).toBe(false); }
  });
});

describe('SpiritGuide one consensual agreement and one original letter', () => {
  it('needs observation, preparation, actual cash and real successful invitation before recruiting', () => {
    const s = promoted(); rejectActivity(s, { type: 'PERFORM', caseId: 'messenger-terms' });
    expect(spiritGuideCases(s).every(r => r.observations.length === 0)).toBe(true);
    begin(s, 'messenger-terms', 'ABILITY'); s.cash = 11;
    rejectActivity(s, { type: 'PERFORM', caseId: 'messenger-terms' }); s.cash = 12;
    const ap = s.actionsRemaining, spirit = s.spirituality, c = activity(s, { type: 'PERFORM', caseId: 'messenger-terms' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([0, ap - 1, spirit - 3]);
    expect(s.spiritGuide.messenger).toEqual({ recruited: true, feePaid: 12, deliveries: 0, letter: 'DESK', replyReceived: false });
    expect(spiritGuideInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'messenger-terms' });
    const before = structuredClone(s.spiritGuide.messenger); s.actionsRemaining = 0; s.spirituality = 0; activity(s, { type: 'CLOSE', caseId: 'messenger-terms' });
    expect(s.spiritGuide.messenger).toEqual(before); expect([s.actionsRemaining, s.spirituality, s.cash]).toEqual([0, 0, 0]);
    expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('preserves failed invitation cost, requires explicit close and a later-week retry, without a fake agreement', () => {
    const s = promoted(); begin(s, 'messenger-terms', 'ABILITY'); const spirit = s.spirituality, cash = s.cash;
    activity(s, { type: 'PERFORM', caseId: 'messenger-terms' }, 100);
    expect([s.spirituality, s.cash, s.spiritGuide.messenger.recruited, s.spiritGuide.messenger.feePaid]).toEqual([spirit - 3, cash, false, 0]);
    rejectActivity(s, { type: 'OBSERVE', caseId: 'restless-echo' });
    activity(s, { type: 'CLOSE', caseId: 'messenger-terms' }); rejectActivity(s, { type: 'PREPARE', caseId: 'messenger-terms', method: 'ABILITY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'messenger-terms', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'messenger-terms' });
    expect(s.cash).toBe(cash - 12); expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('ordinary record review grants no messenger and still allows a real ordinary delivery and peaceful100', () => {
    const s = promoted(), spirit = s.spirituality, cash = s.cash;
    complete(s, 'messenger-terms'); expect(s.spiritGuide.messenger.recruited).toBe(false);
    activity(s, { type: 'OBSERVE', caseId: 'short-delivery' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'short-delivery', method: 'ABILITY' });
    activity(s, { type: 'PREPARE', caseId: 'short-delivery', method: 'ORDINARY' }); const c = activity(s, { type: 'PERFORM', caseId: 'short-delivery' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    expect(s.spiritGuide.cases['short-delivery']!.outcome).toBe('HAND_DELIVERED');
    activity(s, { type: 'CLOSE', caseId: 'short-delivery' }); activity(s, { type: 'REPORT', caseId: 'short-delivery' });
    complete(s, 'restless-echo'); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.cash]).toEqual([100, spirit, cash]);
    expect(s.spiritGuide.messenger).toEqual({ recruited: false, feePaid: 0, deliveries: 1, letter: 'RECIPIENT', replyReceived: true });
    expect(s.progression.mastery[SPIRIT_GUIDE_ABILITY_IDS[0]]).toBe(24); expect(validateSpiritGuideState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('performs one actual paid messenger roundtrip and preserves the original letter and reply through close', () => {
    const s = promoted(); complete(s, 'messenger-terms', 'ABILITY'); begin(s, 'short-delivery', 'ABILITY');
    const spirit = s.spirituality, ap = s.actionsRemaining, cash = s.cash, c = activity(s, { type: 'PERFORM', caseId: 'short-delivery' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.spirituality, s.actionsRemaining, s.cash]).toEqual([spirit - 3, ap - 1, cash]);
    expect(s.spiritGuide.cases['short-delivery']!.outcome).toBe('MESSENGER_DELIVERED');
    expect(projectSpiritGuide(s).messenger).toEqual({ recruited: true, feePaid: 12, deliveries: 1, letter: 'RECIPIENT', replyReceived: true });
    const letter = structuredClone(s.spiritGuide.messenger); activity(s, { type: 'CLOSE', caseId: 'short-delivery' });
    expect(s.spiritGuide.messenger).toEqual(letter); activity(s, { type: 'REPORT', caseId: 'short-delivery' });
    expect(spiritGuideCases(s).find(r => r.id === 'short-delivery')!.result).toContain('休息');
    rejectActivity(s, { type: 'PERFORM', caseId: 'short-delivery' }); expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('a failed messenger delivery spends spirituality but leaves the unique letter at DESK and no reply', () => {
    const s = promoted(); complete(s, 'messenger-terms', 'ABILITY'); begin(s, 'short-delivery', 'ABILITY');
    const spirit = s.spirituality; activity(s, { type: 'PERFORM', caseId: 'short-delivery' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(s.spiritGuide.messenger).toEqual({ recruited: true, feePaid: 12, deliveries: 0, letter: 'DESK', replyReceived: false });
    activity(s, { type: 'CLOSE', caseId: 'short-delivery' }); rejectActivity(s, { type: 'PREPARE', caseId: 'short-delivery', method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'short-delivery', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'short-delivery' });
    expect(s.spiritGuide.cases['short-delivery']!.outcome).toBe('HAND_DELIVERED'); expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('uses dead words only against the original mild spirit with will14 and preserves the finite result after stopping', () => {
    const s = promoted(); begin(s, 'restless-echo', 'ABILITY'); const spirit = s.spirituality;
    const c = activity(s, { type: 'PERFORM', caseId: 'restless-echo' });
    expect(c.c.check).toHaveBeenCalledExactlyOnceWith('will', 14); expect(s.spirituality).toBe(spirit - 3);
    expect(s.spiritGuide.cases['restless-echo']!.outcome).toBe('ECHO_QUIETED');
    activity(s, { type: 'CLOSE', caseId: 'restless-echo' }); activity(s, { type: 'REPORT', caseId: 'restless-echo' });
    expect(spiritGuideCases(s).find(r => r.id === 'restless-echo')!.result).toContain('没有被杀灭、复活、永久净化');
    expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('allows zero-action cancellation and ordinary alternatives with insufficient spiritual resources', () => {
    const s = promoted(); begin(s, 'restless-echo', 'ABILITY'); s.spirituality = 2;
    rejectActivity(s, { type: 'PERFORM', caseId: 'restless-echo' }); const ap = s.actionsRemaining;
    activity(s, { type: 'WITHDRAW', caseId: 'restless-echo' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'restless-echo', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'restless-echo' });
    expect([s.spirituality, s.spiritGuide.cases['restless-echo']!.outcome]).toEqual([2, 'BARRIER_RECORDED']);
    expect(spiritGuideActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true);
  });
  it('rejects invented recruitment, cloned deliveries, erased reply, shifted week and duplicate report sources', () => {
    const s = promoted(); complete(s, 'messenger-terms', 'ABILITY'); begin(s, 'short-delivery', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'short-delivery' });
    for (const change of [(t: SliceState) => { t.spiritGuide.messenger.recruited = false; }, (t: SliceState) => { t.spiritGuide.messenger.feePaid = 0; }, (t: SliceState) => { t.spiritGuide.messenger.deliveries = 2; }, (t: SliceState) => { t.spiritGuide.messenger.letter = 'DESK'; }, (t: SliceState) => { t.spiritGuide.messenger.replyReceived = false; }, (t: SliceState) => { t.week += 1; }, (t: SliceState) => { t.spiritGuide.cases['short-delivery']!.outcome = 'HAND_DELIVERED'; }, (t: SliceState) => { t.seer.completedSources.push('spirit-guide-case:messenger-terms'); }]) {
      const t = structuredClone(s); change(t); expect(validateSpiritGuideLife(t)).toBe(false);
    }
    const fresh = ordinary(); fresh.spiritGuide.messenger.recruited = true; expect(validateSpiritGuideState(fresh)).toBe(false);
  });
});

describe('SpiritGuide original empty-courtyard dispute', () => {
  it('requires one report, no prepared or open contact, and spends one action on actual arrival', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'messenger-terms');
    begin(s, 'restless-echo'); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); activity(s, { type: 'PERFORM', caseId: 'restless-echo' });
    rejectActivity(s, { type: 'ENCOUNTER_TALK' }); activity(s, { type: 'CLOSE', caseId: 'restless-echo' });
    const ap = s.actionsRemaining, old = structuredClone([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide.messenger, s.world]);
    const c = activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.actionsRemaining).toBe(ap - 1); expect(s.combat?.encounterId).toBe('SPIRIT_GUIDE_DISPUTE');
    expect([s.corpsecollector, s.gravedigger, s.spiritmedium, s.spiritGuide.messenger, s.world]).toEqual(old);
    expect(c.c.note).toHaveBeenCalledWith('实际走到原外院并核对现场', expect.stringContaining('迪恩'));
    expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('keeps refusal until a later week and permits peace without reward or taking the adult original club', () => {
    const s = promoted(); complete(s, 'messenger-terms'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.spiritGuide.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); s.week += 1;
    const acting = s.progression.acting, cash = s.cash, c = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.spiritGuide.encounter.status, s.progression.acting, s.cash]).toEqual(['RESOLVED', acting, cash]);
    expect(c.award).not.toHaveBeenCalled(); expect(validateSpiritGuideState(s)).toBe(true);
  });
  it('never awards retreat or nominal victory based on participation from an older encounter', () => {
    for (const outcome of ['RETREATED', 'ENEMY_SURRENDERED']) {
      const s = promoted(); complete(s, 'messenger-terms'); effectiveRound(s); activity(s, { type: 'ENCOUNTER_FIGHT' });
      const c = context(s); settleSpiritGuideEncounter(s, outcome, c.c, c.award);
      expect(c.award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(validateSpiritGuideState(s)).toBe(true);
    }
  });
  it('awards exactly once to a living effective participant even when the original enemy dies', () => {
    const s = promoted(); complete(s, 'messenger-terms'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
    const c = context(s), acting = s.progression.acting, cash = s.cash;
    settleSpiritGuideEncounter(s, 'ENEMY_DEAD', c.c, c.award);
    expect(c.award).toHaveBeenCalledExactlyOnceWith('spirit-guide-dispute', 25); expect([s.progression.acting, s.cash]).toEqual([acting, cash]);
    expect(validateSpiritGuideState(s)).toBe(true); expect(() => settleSpiritGuideEncounter(s, 'ENEMY_DEAD', c.c, c.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory.at(-1)!.moves[0]!.selfGain = 0; expect(validateSpiritGuideState(forged)).toBe(false);
  });
  it('rejects fabricated encounter endings atomically, and preserves actual player death without reward', () => {
    const s = promoted(); complete(s, 'messenger-terms'); activity(s, { type: 'ENCOUNTER_FIGHT' }); const c = context(s), before = structuredClone(s);
    expect(() => settleSpiritGuideEncounter(s, 'INVENTED', c.c, c.award)).toThrow(); expect(s).toEqual(before);
    effectiveRound(s); s.status = 'DEAD'; settleSpiritGuideEncounter(s, 'PLAYER_DEAD', c.c, c.award);
    expect([s.status, s.spiritGuide.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(c.award).not.toHaveBeenCalled();
    expect(validateSpiritGuideState(s)).toBe(true);
  });
});
