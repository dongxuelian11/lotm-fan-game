import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectRecovery } from '../../src/domain/slice/medical.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { addGameDays, addGameYears } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyFerrymanEraCommand, blockFerrymanEraCommand, projectFerrymanEra, validateFerrymanEra,
  type FerrymanEraCommand } from '../../src/domain/ferryman/era.js';
import { blockLongChapterCommand, isLongChapterEraClosed, validateLongChapterState } from '../../src/domain/long-chapter/index.js';
import { applyDeathConsulAcquisition, hasDeathConsulLock, projectDeathConsul, validateDeathConsulState } from '../../src/domain/death-consul/index.js';
import { DEATH_CONSUL_PREPARATION_IDS, type DeathConsulCommand } from '../../src/domain/death-consul/types.js';

const path = 'tests/fixtures/ferryman-v01490/natural.json';
let original: SliceState | undefined;
function start(): SliceState {
  original ??= migrateSliceState(readObjectEntry<unknown>(path, 'final'));
  return structuredClone(original);
}
function step(s: SliceState, intent: SliceIntent): SliceState {
  const next = applySliceIntent(s, intent); assertValidSliceState(next); return next;
}
const era = (s: SliceState, type: FerrymanEraCommand['type']) => step(s, { type: 'FERRYMAN', command: { type } });
const dc = (s: SliceState, command: DeathConsulCommand) => step(s, { type: 'DEATH_CONSUL', command });
const medical = (s: SliceState) => projectRecovery(s, { canAct: false, actionBlockedReason: '旧时代普通行动不可用。' });
const frozen = (s: SliceState) => ({ longChapter: s.longChapter, undying: s.undying, town: s.town,
  reed: s.ferryman.life.reed, ferrymanLife: s.ferryman.life, ferrymanEncounter: s.ferryman.encounter,
  invitations: [s.careKnown, s.lastMedicalInviteWeek, s.aid, s.aidInjuryIds, s.wagePaidWeek], debts: s.debts,
  random: s.random });
function rejectEra(s: SliceState, type: FerrymanEraCommand['type']) {
  const before = structuredClone(s);
  expect(() => applySliceIntent(s, { type: 'FERRYMAN', command: { type } })).toThrow(); expect(s).toEqual(before);
}
/** Only existing public work and seven-day commands finance the requested next actual action. */
function fundedAction(s: SliceState, pennies = 0): SliceState {
  while (s.actionsRemaining === 0 || s.cash < pennies) {
    if (s.actionsRemaining === 0) {
      if (s.cash < 24) s = era(s, 'ERA_WORK');
      s = era(s, 'ERA_NEXT_WEEK');
    } else s = era(s, 'ERA_WORK');
  }
  return s;
}
function freshWeek(s: SliceState): SliceState {
  while (s.actionsRemaining > 0) s = era(s, 'ERA_WORK');
  if (s.cash < 24) s = era(s, 'ERA_WORK');
  return era(s, 'ERA_NEXT_WEEK');
}
/** Genuine public care/rest/work continuation of the exact living611-command final state. No resource edits or RNG search. */
function heal(): SliceState {
  let s = era(start(), 'ERA_CARE');
  for (let n = 0; n < 8; n++) s = era(fundedAction(s, 8), 'ERA_REST');
  return s;
}
let readyCache: SliceState | undefined;
function promotionReady(): SliceState {
  if (!readyCache) {
    let s = heal();
    while (s.week < s.ferryman.promotionWeek! + 12) s = freshWeek(s);
    s = dc(fundedAction(s, 120), { type: 'LEARN_GUIDANCE' });
    const bottleId = s.deathConsul.bottles[0]!.id;
    for (let n = 0; n < 5; n++) s = dc(fundedAction(s), { type: 'POTION_WORK', bottleId });
    s = dc(fundedAction(s, 80), { type: 'BUY_POTION', bottleId });
    for (const taskId of DEATH_CONSUL_PREPARATION_IDS) s = dc(fundedAction(s), { type: 'PREPARE_TASK', taskId });
    s = dc(fundedAction(s, 20), { type: 'PREPARE_PROMOTION' });
    readyCache = s;
  }
  return structuredClone(readyCache);
}
/** Only the final check is directed to1 for S2 guard coverage. This is not a natural promotion capture. */
function promoted(): SliceState {
  const s = promotionReady();
  const ctx: SeerContext = { note: vi.fn(), roll: vi.fn(min => min), check: vi.fn((ability, difficulty) =>
    resolveNormalCheck({ ability, difficulty, baseAbility: s.character.coreStats[ability], modifiers: [], roll: 1 })) };
  applyDeathConsulAcquisition(s, { type: 'CONSUME', bottleId: s.deathConsul.bottles[0]!.id, confirmed: true }, ctx);
  assertValidSliceState(s); return s;
}

describe('DeathConsul and inherited post-era actual care routing', () => {
  it('projects ERA_LIFE for the real wounded S3 survivor without reopening old-town care or mutating anything', () => {
    const s = start(), before = structuredClone(s), p = medical(s);
    expect(p).toMatchObject({ stage: 'ERA_CARE', untreatedHeavyCount: 2, treatedHeavyCount: 0, injuryCount: 2, injuryRisk: 1,
      treatmentCost: 60, healingHealthThreshold: 80, workIncomeThisWeek: 24, cashShortfall: 0, locked: false,
      nextAction: { kind: 'ERA_LIFE', enabled: true, targetId: null },
      actions: { pay: { enabled: true }, rest: { enabled: true }, work: { enabled: true }, discover: { enabled: false }, aid: { enabled: false, targetId: null }, credit: { enabled: false } } });
    expect(p.guidance).toContain('60便士'); expect(p.guidance).toContain('8便士'); expect(p.guidance).toContain('恢复5健康');
    expect(projectSliceState(s).recovery).toEqual(p); expect(s).toEqual(before);
  });
  it('pays actual ERA_CARE60 and one action to mark both original wounds, without healing or resetting risk', () => {
    const before = start(), s = era(before, 'ERA_CARE');
    expect([s.cash, s.actionsRemaining, s.health, s.mind, s.spirituality, s.injuryRisk]).toEqual([50, 3, 40, 100, 108, 1]);
    expect(s.injuries).toEqual(before.injuries.map(i => ({ ...i, treatedRevision: before.revision + 1 })));
    expect(s.ferryman.era.treatments).toBe(before.ferryman.era.treatments + 1);
    expect(s.ferryman.era.expenses).toBe(before.ferryman.era.expenses + 60);
    expect(frozen(s)).toEqual(frozen(before)); expect(medical(s)).toMatchObject({ stage: 'ERA_REST', untreatedHeavyCount: 0, treatedHeavyCount: 2, injuryRisk: 1 });
    rejectEra(s, 'ERA_CARE'); expect(before.injuries.every(i => i.treatedRevision === null)).toBe(true);
  });
  it('charges each ERA_REST8 and reaches80 only after eight real rests financed by actual work and weeks', () => {
    const before = start(); let s = era(before, 'ERA_CARE');
    const originalIds = before.injuries.map(i => i.id), originalEra = structuredClone(before.ferryman.era);
    for (let index = 0; index < 8; index++) {
      s = fundedAction(s, 8); const cash = s.cash, ap = s.actionsRemaining, health = s.health, spirit = s.spirituality;
      s = era(s, 'ERA_REST');
      expect([s.cash, s.actionsRemaining, s.health, s.spirituality]).toEqual([cash - 8, ap - 1, health + 5, Math.min(120, spirit + 10)]);
      if (index < 7) { expect(s.injuries.map(i => i.id)).toEqual(originalIds); expect(s.injuryRisk).toBe(1); }
    }
    expect(s.health).toBe(80); expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0);
    expect(s.ferryman.era.rests - originalEra.rests).toBe(8);
    expect(s.ferryman.era.works - originalEra.works).toBeGreaterThan(0);
    expect(s.ferryman.era.expenses - originalEra.expenses).toBe(60 + 8 * 8 + 24 * (s.ferryman.era.weeksAdvanced - originalEra.weeksAdvanced));
    expect(s.cash).toBe(before.cash + 24 * (s.ferryman.era.works - originalEra.works) - (s.ferryman.era.expenses - originalEra.expenses));
    expect(frozen(s)).toEqual(frozen(before)); expect(validateFerrymanEra(s)).toBe(true); expect(validateLongChapterState(s)).toBe(true);
    expect(medical(s)).toMatchObject({ injuryCount: 0, injuryRisk: 0, stage: 'ERA_REST', nextAction: { kind: 'ERA_LIFE' } });
  });
  it('does not confuse full health with treatment of an existing heavy wound', () => {
    // Explicit projector/guard fixture, not actual recovery evidence.
    const s = start(); s.health = 100;
    const p = medical(s); expect(p.healthFullWithInjuries).toBe(true); expect(p.stage).toBe('ERA_CARE'); expect(p.summary).toContain('健康100仍不等于伤势痊愈');
    const n = era(s, 'ERA_REST'); expect(n.injuries).toEqual(s.injuries); expect(n.injuryRisk).toBe(1);
  });
  it('uses actual current-era prices and work24 despite any old invitation or ordinary-action gate', () => {
    const s = start(); s.cash = 59; s.lastMedicalInviteWeek = s.week;
    const p = medical(s); expect(p.cashShortfall).toBe(1); expect(p.invitedThisWeek).toBe(false); expect(p.workIncomeThisWeek).toBe(24);
    expect(p.actions.pay.enabled).toBe(false); expect(p.actions.work.enabled).toBe(true); expect(p.nextAction.kind).toBe('ERA_LIFE');
    rejectEra(s, 'ERA_CARE'); const worked = era(s, 'ERA_WORK'); expect(worked.cash).toBe(83);
    expect(worked.lastMedicalInviteWeek).toBe(s.lastMedicalInviteWeek); expect(medical(worked).actions.pay.enabled).toBe(true);
  });
  it('requires real12m arrival before treatment while navigation remains available', () => {
    const s = era(start(), 'ERA_LEAVE'), before = structuredClone(s), p = medical(s);
    expect(p.nextAction).toMatchObject({ kind: 'ERA_LIFE', enabled: true }); expect(p.actions.pay.enabled).toBe(false); expect(p.actions.rest.enabled).toBe(false);
    rejectEra(s, 'ERA_CARE'); rejectEra(s, 'ERA_REST');
    const arrived = era(s, 'ERA_ENTER');
    expect(arrived.ferryman.era.travelledMetres).toBe(before.ferryman.era.travelledMetres + 12);
    expect(arrived.ferryman.era.elapsedSeconds).toBe(before.ferryman.era.elapsedSeconds + 12);
    expect([arrived.cash, arrived.health, arrived.actionsRemaining]).toEqual([before.cash, before.health, before.actionsRemaining]);
    expect(frozen(arrived)).toEqual(frozen(before)); expect(medical(arrived).actions.pay.enabled).toBe(true);
  });
  it('blocks medical and era movement while the real current-week S2 acquisition preparation is open', () => {
    const s = promotionReady(), p = medical(s); expect(hasDeathConsulLock(s)).toBe(true);
    expect(p).toMatchObject({ locked: true, nextAction: { kind: 'ERA_LIFE', enabled: false }, actions: { rest: { enabled: false }, work: { enabled: false }, pay: { enabled: false } } });
    expect(p.blockedReason).toContain('死亡执政官');
    for (const type of ['ERA_ENTER', 'ERA_LEAVE', 'ERA_WORK', 'ERA_REST', 'ERA_NEXT_WEEK', 'ERA_CARE'] as const) rejectEra(s, type);
    const cash = s.cash, left = dc(s, { type: 'LEAVE_PREPARATION' });
    expect(left.cash).toBe(cash); expect(left.deathConsul.bottles[0]!.status).toBe('PLAYER'); expect(medical(left).nextAction.enabled).toBe(true);
  });
  it('keeps S2 current life on ERA_LIFE with120 spirit cap and the identical sixty-year history', () => {
    const s = promoted(), old = start();
    expect(s.progression.sequence).toBe(2); expect(s.health).toBe(80); expect(s.injuries).toEqual([]);
    expect(s.longChapter).toEqual(old.longChapter); expect(s.undying).toEqual(old.undying); expect(s.ferryman.life.reed).toEqual(old.ferryman.life.reed);
    expect(isLongChapterEraClosed(s)).toBe(true); expect(projectFerrymanEra(s).available).toBe(true);
    expect(medical(s).nextAction).toMatchObject({ kind: 'ERA_LIFE', enabled: true });
    expect(projectSliceState(s).recovery.nextAction.kind).toBe('ERA_LIFE');
    expect(projectDeathConsul(s).resources).toMatchObject({ spirituality: 120, maxSpirituality: 120 });
    expect(validateDeathConsulState(s)).toBe(true); expect(validateLongChapterState(s)).toBe(true);
    const over = structuredClone(s); over.spirituality = 121; expect(() => assertValidSliceState(over)).toThrow();
  });
  it('continues real paid S2 rest/work/week without old pulses, passive income, resource refill or cycle reset', () => {
    let s = promoted(); s = fundedAction(s, 8); // Finance only with current-era public commands.
    const before = structuredClone(s), cash = s.cash, ap = s.actionsRemaining;
    s = era(s, 'ERA_REST'); expect([s.cash, s.actionsRemaining]).toEqual([cash - 8, ap - 1]); expect(s.spirituality).toBe(120);
    expect(frozen(s)).toEqual(frozen(before));
    while (s.actionsRemaining > 0) s = era(s, 'ERA_WORK'); if (s.cash < 24) s = era(s, 'ERA_WORK');
    const last = structuredClone(s); s = era(s, 'ERA_NEXT_WEEK');
    expect(s.date).toEqual(addGameDays(last.date, 7)); expect(s.week).toBe(last.week + 1); expect(s.cash).toBe(last.cash - 24);
    expect(s.actionsRemaining).toBe(4); expect([s.health, s.mind, s.spirituality]).toEqual([last.health, last.mind, last.spirituality]);
    expect(frozen(s)).toEqual(frozen(last)); expect(s.eventQueue).toEqual([]); expect(s.pulse).toBe('NONE'); expect(validateLongChapterState(s)).toBe(true);
    for (const intent of [{ type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
      { type: 'LONG_CHAPTER', command: { type: 'WORK' } }, { type: 'LONG_CHAPTER', command: { type: 'AWAIT_REVIVAL' } }] as unknown as SliceIntent[]) {
      expect(() => applySliceIntent(s, intent)).toThrow();
    }
  });
  it('blocks current care during actual S2 contact and restores navigation only after ordinary closure', () => {
    let s = freshWeek(promoted()); s = dc(s, { type: 'OBSERVE', caseId: 'pale-residue' });
    expect(medical(s).nextAction.enabled).toBe(true);
    s = dc(s, { type: 'PREPARE', caseId: 'pale-residue', method: 'ORDINARY' });
    const p = medical(s); expect(p.locked).toBe(true); expect(p.nextAction).toMatchObject({ kind: 'ERA_LIFE', enabled: false });
    for (const type of ['ERA_LEAVE', 'ERA_WORK', 'ERA_REST', 'ERA_NEXT_WEEK', 'ERA_CARE'] as const) rejectEra(s, type);
    s = dc(s, { type: 'DECLINE_OPERATOR', caseId: 'pale-residue' });
    s = dc(s, { type: 'INSPECT', caseId: 'pale-residue' }); s = dc(s, { type: 'LEAVE', caseId: 'pale-residue' });
    expect(medical(s).nextAction.enabled).toBe(true); expect(s.deathConsul.life.site.operatorEnergy).toBe(100);
    expect(s.deathConsul.life.site.residual.strength).toBe(3); expect(s.progression.mastery['death.s2.pale-flame']).toBe(0);
  });
  it.each(['READY', 'FIGHTING'] as const)('projects a locked medical route for S2 encounter%s', status => {
    // Guard-only mutation: actual encounter setup and replay are covered by the dedicated life/combat suite.
    const s = promoted(); s.deathConsul.encounter.status = status;
    const p = medical(s); expect(p.locked).toBe(true); expect(p.nextAction.enabled).toBe(false); expect(p.blockedReason).toContain('死亡执政官');
    for (const type of ['ERA_ENTER', 'ERA_LEAVE', 'ERA_WORK', 'ERA_REST', 'ERA_NEXT_WEEK', 'ERA_CARE'] as const) rejectEra(s, type);
  });
  it('keeps ordinary S2 death final and retains the completed long chapter as history', () => {
    // Terminal guard fixture only. No fabricated combat result or natural death claim.
    const s = promoted(), history = structuredClone(s.longChapter), lifecycle = structuredClone(s.undying.lifecycle);
    s.health = 0; s.status = 'DEAD';
    expect(validateLongChapterState(s)).toBe(true); expect(medical(s).nextAction).toMatchObject({ kind: 'ERA_LIFE', enabled: false });
    for (const type of ['ERA_ENTER', 'ERA_LEAVE', 'ERA_WORK', 'ERA_REST', 'ERA_NEXT_WEEK', 'ERA_CARE'] as const) rejectEra(s, type);
    expect(blockLongChapterCommand(s, { type: 'AWAIT_REVIVAL' })).not.toBeNull();
    for (const intent of [{ type: 'LONG_CHAPTER', command: { type: 'AWAIT_REVIVAL' } },
      { type: 'DEATH_CONSUL', command: { type: 'LEARN_GUIDANCE' } }] as SliceIntent[]) expect(() => applySliceIntent(s, intent)).toThrow();
    expect(s.longChapter).toEqual(history); expect(s.undying.lifecycle).toEqual(lifecycle); expect([s.status, s.health]).toEqual(['DEAD', 0]);
  });
  it('does not restart the S4 cycle at its next anniversary once current sequence is2', () => {
    // Directed calendar guard coverage; not a new sixty-year natural-play continuation.
    const s = promoted(), history = structuredClone(s.longChapter), lifecycle = structuredClone(s.undying.lifecycle);
    s.date = addGameYears(s.undying.lifecycle.expectedCycleDate!, 60); s.actionsRemaining = 0; s.cash = 24;
    expect(blockFerrymanEraCommand(s, { type: 'ERA_NEXT_WEEK' })).toBeNull();
    const ctx: SeerContext = { note: vi.fn(), roll: vi.fn(min => min), check: vi.fn(() => { throw new Error('Era time does not roll.'); }) };
    const health = s.health; applyFerrymanEraCommand(s, { type: 'ERA_NEXT_WEEK' }, ctx);
    expect([s.status, s.health, s.progression.sequence]).toEqual(['ACTIVE', health, 2]);
    expect(s.longChapter).toEqual(history); expect(s.undying.lifecycle).toEqual(lifecycle); expect(ctx.check).not.toHaveBeenCalled();
  });
  it('leaves the independent original-era branch on its ordinary recovery route', () => {
    const s = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/ferryman-v01490/original.json', 'final'));
    expect(projectFerrymanEra(s).available).toBe(false); expect(medical(s).nextAction.kind).not.toBe('ERA_LIFE');
    expect(s.longChapter.handoff).toBeNull(); expect(s.undying.encounter.enemy.status).toBe('DEAD'); rejectEra(s, 'ERA_WORK');
  });
});
