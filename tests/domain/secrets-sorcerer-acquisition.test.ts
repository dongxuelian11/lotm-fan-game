import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applySecretsSorcererAcquisition, applySecretsSorcererCommand, createSecretsSorcererState, projectSecretsSorcerer, validateSecretsSorcererCommand, validateSecretsSorcererState } from '../../src/domain/secrets-sorcerer/index.js';
import { SECRETS_SORCERER_CONSUMPTION_RISK, SECRETS_SORCERER_FORMULA_STATUS, SECRETS_SORCERER_PRICES, SECRETS_SORCERER_SOURCE_STATUS } from '../../src/domain/secrets-sorcerer/content.js';
import { SECRETS_SORCERER_ABILITY_IDS, type SecretsSorcererAcquisitionCommand } from '../../src/domain/secrets-sorcerer/types.js';
import { applySecretsSorcererRitualCommand, currentSecretsSorcererAttempt, currentSecretsSorcererCase, currentSecretsSorcererTarget, hasSecretsSorcererRitualLock, settleSecretsSorcererRitual, type SecretsSorcererRitualCommand } from '../../src/domain/secrets-sorcerer/ritual.js';

/** Directed component setup, never a natural replay or a promised combat victory. */
function traveler(): SliceState {
  const prior = JSON.parse(readFileSync('tests/fixtures/traveler-v01050/natural.json', 'utf8')).final;
  const s = migrateSliceState(prior), addedWeeks = Math.max(0, s.traveler.promotionWeek! + 12 - s.week);
  s.week += addedWeeks; s.date = addGameWeeks(s.date, addedWeeks); s.secretsSorcerer = createSecretsSorcererState();
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: SecretsSorcererAcquisitionCommand, roll = 1) { const c = context(s, roll); applySecretsSorcererAcquisition(s, command, c); return c; }
function ritual(s: SliceState, command: SecretsSorcererRitualCommand) { applySecretsSorcererRitualCommand(s, command, context(s)); }
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function taught() { const s = traveler(); apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.secretsSorcerer.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.secretsSorcerer.bottles[index]!.id, confirmed: true }) as const;
/** A bounded sealed-combat fixture isolates acquisition. Shared combat tests exercise real slot resolution. */
function sealFixture(s: SliceState, index = 0) {
  ritual(s, { type: 'SURVEY_RITUAL', targetId: `SS4-ARCH-${['A', 'B', 'C'][index]}` });
  ritual(s, { type: 'PREPARE_SEAL' }); ritual(s, { type: 'START_RITUAL', bottleId: s.secretsSorcerer.bottles[index]!.id, confirmed: true });
  const r = s.secretsSorcerer.ritual, a = currentSecretsSorcererAttempt(s)!, t = currentSecretsSorcererTarget(s)!, box = currentSecretsSorcererCase(s)!;
  a.travelSuccesses = 2; a.captureAttempts = 1; box.charges = 2; box.targetId = t.id; box.sealsIntact = true;
  a.captureEvidence = { targetId: t.id, caseId: box.id, attemptId: a.id, equivalentSequence: 4, hostileAtCapture: true, ownTravelControls: 2, externalCombatHelpers: 0, terminalHistoryIndex: s.combatHistory.length };
  r.restraintMarks = 2;
  const round: SliceCombatRound = {
    round: 1, stance: 'CONTROL', first: 'PLAYER', playerCount: 3, enemyCount: 2, playerCountRoll: 10, enemyCountRoll: 10,
    moves: [], playerAdvantage: 0, enemyAdvantage: 0, winChance: 50, winner: 'PLAYER', consequence: 'Directed acquisition fixture: same living original sealed.', consequenceWeights: null, retreat: 'NONE',
    secretsSorcererOutcome: { targetId: t.id, attemptId: a.id, enemyHealth: 100, enemyMind: 100, enemySpirituality: 40, enemyStatus: 'SEALED', caseId: box.id, charges: 2, restraintMarks: 2 },
  };
  s.combatHistory.push(round); s.combat!.lastRound = round; t.status = 'SEALED';
  settleSecretsSorcererRitual(s, 'ENEMY_SEALED', context(s));
}
function ready() { const s = taught(); buy(s); sealFixture(s); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applySecretsSorcererAcquisition(s, command as SecretsSorcererAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
const oldPath = (s: SliceState) => [s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler];

describe('Secrets Sorcerer4 independent originals and actual-seal acquisition', () => {
  it('starts hidden with three separate originals, an unknown formula and no gifted seal', () => {
    const s = createSliceRun('secrets-hidden', sliceDefaultCreationSelection, 'secrets-hidden');
    expect(validateSecretsSorcererState(s)).toBe(true);
    expect(projectSecretsSorcerer(s)).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [] });
    expect(projectSecretsSorcerer(s).story).toBeUndefined(); expect(s.secretsSorcerer.ritual.attempts).toEqual([]);
    const other = createSecretsSorcererState(); other.bottles[0]!.labourSteps = 5;
    expect(s.secretsSorcerer.bottles[0]!.labourSteps).toBe(0); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires twelve real weeks, old digestion and health even for guidance', () => {
    const s = traveler(); s.progression.acting = 99; reject(s, { type: 'LEARN_GUIDANCE' }); s.progression.acting = 100;
    const week = s.traveler.promotionWeek; s.traveler.promotionWeek = s.week - 11; reject(s, { type: 'LEARN_GUIDANCE' }); s.traveler.promotionWeek = week;
    s.health = 20; reject(s, { type: 'LEARN_GUIDANCE' }); s.health = 100; s.mind = 40; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 520 and one action while preserving old records, teachers and travel', () => {
    const s = traveler(), old = structuredClone(oldPath(s)); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99480, 99]); expect(oldPath(s)).toEqual(old);
    expect(SECRETS_SORCERER_PRICES).toEqual({ guidance: 520, potion: 6600, labourCredit: 5100 });
    expect(SECRETS_SORCERER_FORMULA_STATUS).toContain('完整主辅配方'); expect(SECRETS_SORCERER_FORMULA_STATUS).toContain('保持未知');
    expect(SECRETS_SORCERER_SOURCE_STATUS).toContain('漫游者3'); expect(SECRETS_SORCERER_CONSUMPTION_RISK).toContain('战斗仍可真正死亡');
    expect(new Set(s.secretsSorcerer.bottles.map(b => b.source)).size).toBe(3); expect(validateSecretsSorcererState(s)).toBe(true);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires all five actual jobs on this original before its price becomes 1500', () => {
    const s = taught(), b = s.secretsSorcerer.bottles[0]!;
    for (let n = 0; n < 5; n++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, s.actionsRemaining, b.status]).toEqual([5, 94, 'SUPPLIER']); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    buy(s); expect([s.cash, b.status, b.acquiredWeek]).toEqual([97980, 'PLAYER', s.week]);
    expect(s.secretsSorcerer.bottles[1]!.labourSteps).toBe(0); expect(s.secretsSorcerer.ritual.cases).toEqual([]);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); expect(validateSecretsSorcererState(s)).toBe(true);
  });
  it('does not partially discount or turn payment and a prepared box into capture', () => {
    const s = taught(), b = s.secretsSorcerer.bottles[0]!;
    for (let n = 0; n < 4; n++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6600); reject(s, dose(s));
    ritual(s, { type: 'SURVEY_RITUAL', targetId: 'SS4-ARCH-A' }); ritual(s, { type: 'PREPARE_SEAL' }); reject(s, dose(s));
    expect(currentSecretsSorcererCase(s)).toMatchObject({ charges: 3, targetId: null, sealsIntact: false });
    ritual(s, { type: 'END_RITUAL' }); expect(b.status).toBe('PLAYER'); expect(validateSecretsSorcererState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 96, 100, 0, 4, 31], [30, 'SUCCESS', 92, 100, 0, 4, 16], [90, 'FAILURE', 75, 85, 30, 5, 31], [100, 'GREAT_FAILURE', 55, 75, 60, 5, 31]] as const)(
    'roll %s gives %s and leaves the same enemy sealed until actual return', (roll, tier, mind, health, pollution, sequence, spirit) => {
      const s = ready(), old = structuredClone(oldPath(s)), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender;
      const attempt = currentSecretsSorcererAttempt(s)!, box = structuredClone(currentSecretsSorcererCase(s)), b = s.secretsSorcerer.bottles[0]!; s.actionsRemaining = 0;
      const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, spirit, 0]);
      expect(b).toMatchObject({ status: 'CONSUMED', ritualAttemptId: attempt.id, consumedWeek: s.week });
      expect(attempt.consumedBottleId).toBe(b.id); expect(currentSecretsSorcererCase(s)).toEqual(box); expect(hasSecretsSorcererRitualLock(s)).toBe(true);
      expect(s.secretsSorcerer.ritual.phase).toBe('SEALED'); expect(oldPath(s)).toEqual(old); expect(s.character.gender).toBe(gender);
      for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      if (sequence === 4) {
        expect(s.secretsSorcerer.travelerActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
        expect(SECRETS_SORCERER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
        for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
      } else expect(s.progression.acting).toBe(100);
      expect(validateSecretsSorcererState(s)).toBe(true); reject(s, dose(s)); ritual(s, { type: 'END_RITUAL' });
      expect(currentSecretsSorcererCase(s)).toMatchObject({ custody: 'ARCHIVE', targetId: attempt.targetId, sealsIntact: true }); expect(validateSecretsSorcererState(s)).toBe(true);
    });
  it('applies only the guided potion floor, leaving battle mortality untouched', () => {
    const s = ready(); s.health = 21; s.mind = 41; s.seer.pollution = 90; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.seer.pollution, s.spirituality]).toEqual([1, 1, 'ACTIVE', 5, 100, 31]);
    ritual(s, { type: 'END_RITUAL' }); expect([s.health, s.mind]).toEqual([1, 1]); expect(validateSecretsSorcererState(s)).toBe(true);
  });
  it('requires original living hostility, intact seal, own control, correct bottle and separate confirmation', () => {
    const original = ready();
    const mutations: ((s: SliceState) => void)[] = [
      s => { currentSecretsSorcererTarget(s)!.body.health = 0; }, s => { currentSecretsSorcererTarget(s)!.hostileVerified = false; },
      s => { currentSecretsSorcererCase(s)!.sealsIntact = false; }, s => { currentSecretsSorcererCase(s)!.custody = 'ARCHIVE'; },
      s => { currentSecretsSorcererAttempt(s)!.captureEvidence!.ownTravelControls = 1; },
      s => { Object.assign(currentSecretsSorcererAttempt(s)!.captureEvidence!, { externalCombatHelpers: 1 }); },
      s => { s.progression.acting = 99; }, s => { s.health = 20; }, s => { s.mind = 40; },
    ];
    for (const mutate of mutations) { const s = structuredClone(original); mutate(s); reject(s, dose(s)); }
    reject(original, dose(original, 1));
    for (const command of [{ type: 'CONSUME', bottleId: dose(original).bottleId }, { ...dose(original), confirmed: false }, { ...dose(original), enemyDead: true }]) { expect(validateSecretsSorcererCommand(command)).toBe(false); reject(original, command); }
  });
  it('allows returning the sealed original without drinking or gaining sequence4', () => {
    const s = ready(), b = s.secretsSorcerer.bottles[0]!, enemy = currentSecretsSorcererTarget(s)!.id;
    ritual(s, { type: 'END_RITUAL' }); expect(s.progression.sequence).toBe(5); expect(b.status).toBe('PLAYER');
    expect(currentSecretsSorcererCase(s)).toMatchObject({ custody: 'ARCHIVE', targetId: enemy, sealsIntact: true }); reject(s, dose(s));
    expect(validateSecretsSorcererState(s)).toBe(true);
  });
  it('retains failed originals and only adds priced fourth-through-sixth bottles next week', () => {
    const s = taught();
    for (let n = 0; n < 3; n++) {
      buy(s, n); sealFixture(s, n); apply(s, dose(s, n), 100); ritual(s, { type: 'END_RITUAL' }); s.health = 100; s.mind = 100;
      if (n < 2) { reject(s, { type: 'REQUEST_SUPPLY' }); nextWeek(s); }
    }
    const originals = structuredClone(s.secretsSorcerer.bottles), ritualHistory = structuredClone(s.secretsSorcerer.ritual), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' });
    nextWeek(s); apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.secretsSorcerer.bottles).toHaveLength(6);
    expect(s.secretsSorcerer.bottles.slice(0, 3)).toEqual(originals); expect(s.secretsSorcerer.ritual).toEqual(ritualHistory);
    expect(s.secretsSorcerer.bottles[3]).toMatchObject({ id: 'secrets-sorcerer-potion-4', stockedWeek: s.week, status: 'SUPPLIER', labourSteps: 0 });
    expect(projectSecretsSorcerer(s).actions.find(a => a.id === 'buy-secrets-sorcerer-potion-4')!.cost).toContain('6600便士');
    expect(validateSecretsSorcererState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects copied bottles, fabricated seal linkage, missing old mastery and unknown new powers', () => {
    const s = ready(); apply(s, dose(s)); ritual(s, { type: 'END_RITUAL' });
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.secretsSorcerer.travelerActingAtPromotion = 99; }, s => { s.secretsSorcerer.bottles[0]!.source = 'reused traveler bottle'; },
      s => { s.secretsSorcerer.bottles[1]!.id = s.secretsSorcerer.bottles[0]!.id; }, s => { s.secretsSorcerer.bottles[0]!.ritualAttemptId = 'invented'; },
      s => { delete s.progression.mastery['door.s5.travel']; }, s => { s.progression.mastery['door.s4.interstellar-travel'] = 0; },
      s => { Object.assign(s.secretsSorcerer, { ritual: null }); },
    ];
    for (const mutate of mutations) { const t = structuredClone(s); mutate(t); expect(() => validateSecretsSorcererState(t)).not.toThrow(); expect(validateSecretsSorcererState(t)).toBe(false); }
  });
  it('keeps inherited teacher recording a paid source-bound operation at sequence4', () => {
    const s = ready(); apply(s, dose(s)); ritual(s, { type: 'END_RITUAL' }); s.actionsRemaining = 10;
    const before = structuredClone(s.recorder), oldTravel = structuredClone(s.traveler), spirit = s.spirituality;
    const action = projectSecretsSorcerer(s).actions.find(a => a.command.type === 'RECORD_SAMPLE' && a.command.sample === 'FLASH');
    expect(action?.enabled).toBe(true); expect(validateSecretsSorcererCommand({ type: 'RECORD_SAMPLE', sample: 'DEMIGOD' })).toBe(false);
    applySecretsSorcererCommand(s, { type: 'RECORD_SAMPLE', sample: 'FLASH' }, context(s));
    expect(s.spirituality).toBe(spirit - 3); expect(s.actionsRemaining).toBe(9); expect(s.recorder.records).toHaveLength(before.records.length + 1);
    expect(s.recorder.records.at(-1)).toMatchObject({ sample: 'FLASH', status: 'STORED' }); expect(s.traveler).toEqual(oldTravel);
    expect(s.recorder.records.slice(0, before.records.length)).toEqual(before.records); expect(validateSecretsSorcererState(s)).toBe(true);
  });
});
