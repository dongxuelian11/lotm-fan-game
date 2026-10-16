import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceState } from '../../src/domain/slice/types.js';
vi.mock('../../src/domain/elder/index.js', () => ({ hasElderOldPractice: () => false }));
import { blockElderLife, createElderLifeState, elderLifeClosed, handleElderLife, projectElderLife, replayElderLifeRoot, validateElderActivityCommand, validateElderLifeState, type ElderActivityCommand, type ElderCaseId } from '../../src/domain/elder/life.js';
const WHISPER = 'hanged-man.s2.low-whisper', CHORUS = 'hanged-man.s2.focused-chorus', H = 'THT3-HELENA', R = 'THT3-ROLAND';
/** Explicit unit inputs: original S3 court/source history plus isolated S2 resources, not promotion/natural-play evidence. */
function fixture(firstSuccess = true): SliceState {
  const s: SliceState = JSON.parse(readFileSync('tests/fixtures/three-headed-templar-v01550/natural.json', 'utf8')).final;
  let seed = '';
  for (let n = 0; n < 512; n++) { const candidate = `elder-life-unit-${n}`, random = new DeterministicActionRandomStream(candidate, 0); const rolls = Array.from({ length: 4 }, () => random.nextInt(1, 100)); if (firstSuccess ? rolls.every(x => x <= 95) : rolls[0]! > 95) { seed = candidate; break; } }
  expect(seed).not.toBe('');
  s.random = { seed, cursor: 0 }; s.character.coreStats.knowledge = 500; s.progression.sequence = 2; s.progression.acting = 0; s.progression.mastery[WHISPER] = 0; s.progression.mastery[CHORUS] = 0;
  s.cash = 1000; s.actionsRemaining = 100; s.mind = 100; s.spirituality = 120;
  s.elder = { promotionWeek: s.week, preparedWeek: null, life: createElderLifeState(), encounter: { status: 'AVAILABLE' } } as SliceState['elder'];
  return s;
}
function act(s: SliceState, command: ElderActivityCommand) {
  handleElderLife(s, command, { note() {}, roll(min, max) { const r = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), n = r.nextInt(min, max); s.random.cursor = r.cursor; return n; }, check(ability, difficulty) { const r = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), check = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: r.nextInt(1, 100) }); s.random.cursor = r.cursor; return check; } });
  s.revision++; expect(validateElderLifeState(s), JSON.stringify(command)).toBe(true); return s;
}
const attempt = (s: SliceState, caseId: ElderCaseId) => s.elder.life.cases[caseId].attempts.at(-1)!;
function start(s: SliceState, caseId: ElderCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'CONSENT_OWNER', caseId }); act(s, { type: 'PREPARE', caseId, method });
  act(s, { type: 'WALK', caseId, to: 'A' }); act(s, { type: 'TAKE_CARD', caseId }); act(s, { type: 'WALK', caseId, to: 'B' }); act(s, { type: 'INSPECT_SEAL', caseId }); return act(s, { type: 'INSTALL_SEAL', caseId });
}
function finish(s: SliceState, caseId: ElderCaseId, stop = false) {
  if (stop && !attempt(s, caseId).stopped) act(s, { type: 'STOP', caseId });
  if (s.threeHeadedTemplar.life.lamp.on) act(s, { type: 'CLOSE_LIGHT', caseId });
  if (s.elder.life.operation.focus || s.elder.life.operation.suppressedUntil !== null) act(s, { type: 'END_FOCUS', caseId });
  if (s.threeHeadedTemplar.life.playerLocation === 'B') { act(s, { type: 'REMOVE_SEAL', caseId }); act(s, { type: 'WALK', caseId, to: 'A' }); }
  if (s.threeHeadedTemplar.life.card.location === 'PLAYER') act(s, { type: 'RETURN_CARD', caseId });
  if (s.threeHeadedTemplar.life.playerLocation === 'A') act(s, { type: 'WALK', caseId, to: 'START' });
  act(s, { type: 'RETURN_ITEMS', caseId }); act(s, { type: 'INSPECT', caseId }); act(s, { type: 'LEAVE', caseId }); return act(s, { type: 'REPORT', caseId });
}
function ordinary(s: SliceState, caseId: ElderCaseId) { start(s, caseId, 'ORDINARY'); act(s, { type: 'MANUAL_OPERATION', caseId }); return finish(s, caseId); }
function reject(s: SliceState, command: ElderActivityCommand) { const before = structuredClone(s); expect(() => handleElderLife(s, command, { note() {}, check() { throw new Error('Unexpected check'); }, roll() { throw new Error('Unexpected roll'); } })).toThrow(); expect(s).toEqual(before); }
describe('Elder finite original-court life', () => {
  it('strictly validates command shape, IDs and original selected abilities', () => {
    expect(validateElderActivityCommand({ type: 'REFLECT', extra: true })).toBe(false);
    expect(validateElderActivityCommand({ type: 'WALK', caseId: 'sealed-whisper', to: 'REMOTE' })).toBe(false);
    expect(validateElderActivityCommand({ type: 'FOCUSED_CHORUS', caseId: 'single-chorus', spiritId: 'SH5-CEDRIC-1', method: 'SIGNAL' })).toBe(false);
    const s = ordinary(fixture(), 'sealed-whisper'); start(s, 'single-chorus'); reject(s, { type: 'FOCUSED_CHORUS', caseId: 'single-chorus', spiritId: R, method: 'LOW_GLOW' });
  });
  it('retains original bodies, card, injuries and spirit deficits through all ordinary cases', () => {
    const s = fixture(), old = structuredClone(s.threeHeadedTemplar.life), oldInjuries = structuredClone(s.injuries), oldShepherd = structuredClone(s.shepherd), oldShadow = structuredClone(s.blackKnight.life.shade);
    for (const id of ['sealed-whisper', 'single-chorus', 'interrupted-chorus'] as const) ordinary(s, id);
    act(s, { type: 'REFLECT' }); expect(elderLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100);
    expect(s.health).toBe(40); expect(s.injuries).toEqual(oldInjuries); expect(s.threeHeadedTemplar.life.spirits).toEqual(old.spirits); expect(s.threeHeadedTemplar.life.owner).toEqual(old.owner);
    expect(s.shepherd).toEqual(oldShepherd); expect(s.blackKnight.life.shade).toEqual(oldShadow); expect(s.elder.life.source!.snapshot).toEqual(old);
    expect(s.threeHeadedTemplar.life.playerTravelMetres).toBe(old.playerTravelMetres + 48); expect(s.threeHeadedTemplar.life.card.travelMetres).toBe(old.card.travelMetres + 24); expect(s.cash).toBe(928); expect(s.spirituality).toBe(120); expect(s.mind).toBe(100);
    expect(s.progression.mastery[WHISPER]).toBe(0); expect(s.progression.mastery[CHORUS]).toBe(0); expect(s.elder.life.operation.materials.every(m => m.status === 'RETURNED' && m.spentCharges === 1)).toBe(true);
  });
  it('charges a bounded whisper and requires real application before awarding mastery', () => {
    const s = start(fixture(), 'sealed-whisper'); act(s, { type: 'LOW_WHISPER', caseId: 'sealed-whisper' });
    expect([s.spirituality, s.mind, s.health]).toEqual([114, 98, 40]); expect(s.elder.life.operation.suppressedUntil! - s.threeHeadedTemplar.life.clockSeconds).toBe(12); expect(s.progression.mastery[WHISPER]).toBe(0);
    reject(s, { type: 'LOW_WHISPER', caseId: 'sealed-whisper' }); reject(s, { type: 'WALK', caseId: 'sealed-whisper', to: 'START' });
    act(s, { type: 'PERFORM_OPERATION', caseId: 'sealed-whisper' }); finish(s, 'sealed-whisper'); expect(s.progression.mastery[WHISPER]).toBe(8); expect(s.elder.life.operation.contained).toBe(true);
  });
  it('failure and expiry preserve paid resources and allow ordinary fallback', () => {
    const failed = start(fixture(false), 'sealed-whisper'); act(failed, { type: 'LOW_WHISPER', caseId: 'sealed-whisper' }); expect([failed.spirituality, failed.mind]).toEqual([114, 96]); expect(failed.elder.life.operation.suppressedUntil).toBeNull(); act(failed, { type: 'MANUAL_OPERATION', caseId: 'sealed-whisper' }); finish(failed, 'sealed-whisper'); expect(failed.progression.mastery[WHISPER]).toBe(0);
    const expired = start(fixture(), 'sealed-whisper'); act(expired, { type: 'LOW_WHISPER', caseId: 'sealed-whisper' }); act(expired, { type: 'WAIT_6', caseId: 'sealed-whisper' }); act(expired, { type: 'WAIT_6', caseId: 'sealed-whisper' }); expect(attempt(expired, 'sealed-whisper').expired).toBe(true); reject(expired, { type: 'PERFORM_OPERATION', caseId: 'sealed-whisper' }); finish(expired, 'sealed-whisper', true); expect(expired.progression.mastery[WHISPER]).toBe(0); expect(expired.spirituality).toBe(114);
  });
  it('uses exactly one originally selected spirit with actual depletion and real interruption', () => {
    const s = ordinary(fixture(), 'sealed-whisper'); start(s, 'single-chorus');
    reject(s, { type: 'FOCUSED_CHORUS', caseId: 'single-chorus', spiritId: H, method: 'LOW_GLOW' });
    act(s, { type: 'FOCUSED_CHORUS', caseId: 'single-chorus', spiritId: R, method: 'STEADY_HOLD' }); expect(s.threeHeadedTemplar.life.spirits[R]).toMatchObject({ spirituality: 24, integrity: 100, location: 'INTERNAL' }); expect(s.threeHeadedTemplar.life.spirits[H]).toMatchObject({ spirituality: 18, integrity: 60, interrupted: true });
    reject(s, { type: 'FOCUSED_CHORUS', caseId: 'single-chorus', spiritId: R, method: 'SCREEN' }); act(s, { type: 'PERFORM_OPERATION', caseId: 'single-chorus' }); finish(s, 'single-chorus');
    start(s, 'interrupted-chorus'); act(s, { type: 'LOW_WHISPER', caseId: 'interrupted-chorus' }); act(s, { type: 'FOCUSED_CHORUS', caseId: 'interrupted-chorus', spiritId: R, method: 'SCREEN' }); act(s, { type: 'PERFORM_OPERATION', caseId: 'interrupted-chorus' }); act(s, { type: 'INTERRUPT_CHORUS', caseId: 'interrupted-chorus' });
    expect(s.threeHeadedTemplar.life.spirits[R]).toMatchObject({ spirituality: 21, integrity: 80, interrupted: true }); expect(s.elder.life.operation.focus).toBeNull(); reject(s, { type: 'INTERRUPT_CHORUS', caseId: 'interrupted-chorus' }); finish(s, 'interrupted-chorus'); act(s, { type: 'REFLECT' });
    expect(s.progression.mastery[CHORUS]).toBe(16); expect(s.progression.mastery[WHISPER]).toBe(8); expect(s.shepherd.grazing.activeSpiritId).toBe('SH5-IRIS-1'); expect(s.threeHeadedTemplar.life.spirits[R]).toMatchObject({ spirituality: 21, integrity: 80, interrupted: false }); expect(s.threeHeadedTemplar.life.spirits[H]).toMatchObject({ spirituality: 18, integrity: 60, interrupted: true });
  });
  it('honors adult revocation immediately while requiring actual return with no refunds', () => {
    const s = start(fixture(), 'sealed-whisper'); act(s, { type: 'LOW_WHISPER', caseId: 'sealed-whisper' }); act(s, { type: 'WITHDRAW_PERMISSION', caseId: 'sealed-whisper' }); expect(s.elder.life.operation.suppressedUntil).toBeNull(); expect(s.threeHeadedTemplar.life.playerLocation).toBe('B'); expect(s.threeHeadedTemplar.life.owner.location).toBe('START'); reject(s, { type: 'RETURN_ITEMS', caseId: 'sealed-whisper' }); reject(s, { type: 'PERFORM_OPERATION', caseId: 'sealed-whisper' }); finish(s, 'sealed-whisper'); expect(s.spirituality).toBe(114); expect(s.cash).toBe(976); expect(attempt(s, 'sealed-whisper').permissionWithdrawn).toBe(true);
  });
  it('reserves casts up front and keeps resource-free cleanup possible', () => {
    const s = fixture(), id = 'sealed-whisper'; act(s, { type: 'OBSERVE', caseId: id }); act(s, { type: 'CONSENT_OWNER', caseId: id }); s.actionsRemaining = 1; expect(blockElderLife(s, { type: 'PREPARE', caseId: id, method: 'ABILITY' })).not.toBeNull(); act(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); act(s, { type: 'STOP', caseId: id }); act(s, { type: 'RETURN_ITEMS', caseId: id }); act(s, { type: 'INSPECT', caseId: id }); act(s, { type: 'LEAVE', caseId: id }); expect(s.actionsRemaining).toBe(0);
  });
  it('offers a complete finite preferred route and keeps historical checks valid after later ordinary study', () => {
    const s = fixture(); s.character.coreStats.knowledge = 300;
    for (let n = 0; !s.elder.life.reflected && n < 100; n++) {
      const view = projectElderLife(s), next = view.actions.find(a => a.id === view.preferredActionId);
      expect(next?.enabled, view.nextStep).toBe(true); act(s, next!.command);
    }
    expect(s.elder.life.reflected).toBe(true); expect(elderLifeClosed(s)).toBe(true); expect(s.progression.acting).toBe(100);
    expect(s.threeHeadedTemplar.life.spirits[H]).toMatchObject({ spirituality: 18, integrity: 60, interrupted: true });
    expect(s.threeHeadedTemplar.life.spirits[R]).toMatchObject({ spirituality: 21, integrity: 80 });
    s.character.coreStats.knowledge++; expect(validateElderLifeState(s)).toBe(true);
  });
  it('rejects forged source, spirit refill, teleport, extra body, budget, check and reward records', () => {
    const s = start(fixture(), 'sealed-whisper'); act(s, { type: 'LOW_WHISPER', caseId: 'sealed-whisper' }); act(s, { type: 'PERFORM_OPERATION', caseId: 'sealed-whisper' }); finish(s, 'sealed-whisper');
    const mutations: ((x: SliceState) => void)[] = [x => x.threeHeadedTemplar.life.spirits[H].spirituality++, x => x.threeHeadedTemplar.life.spirits[H].integrity = 100, x => x.threeHeadedTemplar.life.playerTravelMetres--, x => x.threeHeadedTemplar.life.card.quantity = 2 as 1, x => (x.elder.life as unknown as Record<string, unknown>).owner = x.threeHeadedTemplar.life.owner, x => x.elder.life.journal[0]!.budget.cashAfter++, x => x.elder.life.journal.find(e => e.check)!.check!.roll = 0, x => x.elder.life.source!.snapshot.owner.age = 50 as 51, x => x.elder.life.operation.materials[0]!.charges++, x => x.progression.mastery[WHISPER] += 8];
    for (const change of mutations) { const copy = structuredClone(s); change(copy); expect(validateElderLifeState(copy)).toBe(false); }
    expect(replayElderLifeRoot(s)).toEqual(s.threeHeadedTemplar.life); const view = projectElderLife(s); expect(view.spirits[0]!.spirituality).toBe(18); expect(`${view.title}${view.story}${view.environment}`).not.toMatch(/G ·|候选|来源标签/);
  });
});
