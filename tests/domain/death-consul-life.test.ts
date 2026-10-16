import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { createDeathConsulState } from '../../src/domain/death-consul/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { DEATH_CONSUL_CASE_IDS, applyDeathConsulActivity, blockDeathConsulLife, createDeathConsulLifeState, hasDeathConsulLifeLock,
  projectDeathConsulLife, validateDeathConsulActivityCommand, validateDeathConsulLife,
  type DeathConsulActivityCommand, type DeathConsulCaseId } from '../../src/domain/death-consul/life.js';
import { createDeathConsulSiteState, validateDeathConsulSiteState, introduceDeathConsulSite, advanceDeathConsulTime,
  DEATH_CONSUL_SOURCES, type DeathConsulSourceEra } from '../../src/domain/death-consul/resources.js';

const FLAME = 'death.s2.pale-flame', PASSAGE = 'death.s2.spirit-passage';
const OLD = ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying', 'ferryman', 'longChapter'] as const;
let original: SliceState, postCycle: SliceState;
beforeAll(() => {
  original = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/ferryman-v01490/original.json', 'final'));
  postCycle = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/ferryman-v01490/natural.json', 'final'));
});
/** DIRECTED LIFE UNIT ONLY. Uses one streamed genuine S3 snapshot, then explicitly supplies S2 stage and local budgets.
 * This is not an acquisition replay, campaign fixture, natural promotion, medical recovery or saved-play artifact.
 * Genuine campaign replay, all failed bottles and the unchanged 611/571 prefixes are tested separately by the lead. */
function ready(era: DeathConsulSourceEra = 'POST_CYCLE'): SliceState {
  const s = structuredClone(era === 'POST_CYCLE' ? postCycle : original);
  s.deathConsul = createDeathConsulState();
  s.deathConsul.sourceEra = era; s.deathConsul.sourceWeek = s.week; s.deathConsul.promotionWeek = s.week; s.deathConsul.ferrymanActingAtPromotion = 100;
  s.progression.sequence = 2; s.progression.acting = 0; s.progression.mastery[FLAME] = 0; s.progression.mastery[PASSAGE] = 0;
  s.actionsRemaining = 4; s.cash = 500; s.spirituality = 120;
  // Only a local scene's permitted location is supplied; old source people and resource ledgers remain untouched.
  if (era === 'POST_CYCLE') s.ferryman.era.location = 'RECEPTION';
  return s;
}
const attempt = (s: SliceState, id: DeathConsulCaseId) => s.deathConsul.life.cases[id].attempts.at(-1)!;
const oldState = (s: SliceState) => Object.fromEntries(OLD.map(k => [k, structuredClone(s[k])]));
const mastery = (s: SliceState) => [s.progression.mastery[FLAME], s.progression.mastery[PASSAGE]];
/** With no forced roll, every life check uses the original seed and actual next cursor; no search or favorable retry. */
function act(s: SliceState, c: DeathConsulActivityCommand, forced?: 1 | 100) {
  const ctx: SeerContext = { note: vi.fn(), roll: vi.fn(() => { throw new Error('Unexpected extra draw'); }), check: vi.fn((ability, difficulty) => {
    const random = new DeterministicActionRandomStream(s.random.seed, s.random.cursor), draw = random.nextInt(1, 100); s.random.cursor = random.cursor;
    return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: forced ?? draw });
  }) };
  applyDeathConsulActivity(s, c, ctx); return ctx;
}
function actual(s: SliceState, c: DeathConsulActivityCommand) { const ctx = act(s, c); expect(validateDeathConsulLife(s), c.type).toBe(true); return ctx; }
function denied(s: SliceState, c: DeathConsulActivityCommand) {
  const before = structuredClone(s); expect(blockDeathConsulLife(s, c)).not.toBeNull(); expect(() => act(s, c)).toThrow(); expect(s).toEqual(before);
}
const step = (s: SliceState, caseId: DeathConsulCaseId, type: Exclude<DeathConsulActivityCommand['type'], 'PREPARE' | 'REFLECT'>) => actual(s, { type, caseId });
function start(s: SliceState, caseId: DeathConsulCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  step(s, caseId, 'OBSERVE'); actual(s, { type: 'PREPARE', caseId, method }); step(s, caseId, 'CONSENT_OPERATOR');
  if (caseId === 'pale-residue') for (const type of ['INSPECT_RESIDUAL', 'BUY_SEAL', 'OPEN_CONTAINER'] as const) step(s, caseId, type);
  else for (const type of ['CHECK_ENDPOINTS', 'TAKE_RESIDUAL'] as const) step(s, caseId, type);
}
function finish(s: SliceState, caseId: DeathConsulCaseId, checked = true) {
  const run = (type: Exclude<DeathConsulActivityCommand['type'], 'PREPARE' | 'REFLECT'>) => checked ? step(s, caseId, type) : act(s, { type, caseId });
  const a = attempt(s, caseId), p = s.deathConsul.life.site;
  if (caseId === 'withdrawn-passage' && a.performed && !a.permissionWithdrawn) run('WITHDRAW_PERMISSION');
  if (a.performed && a.spiritualitySpent > 0 && !a.effectStopped || p.effect.mode !== 'OFF') run('STOP');
  if (p.playerLocation === 'FAR') run('RETURN_GROUP');
  if (p.residual.location === 'PLAYER') run('RETURN_RESIDUAL');
  if (p.residual.container === 'OPEN') run('CLOSE_CONTAINER');
  while (p.residual.heatSeconds > 0) run('WAIT_10');
  if (p.residual.seal === 'BROKEN') run('SEAL_CONTAINER');
  if (p.door.state === 'OPEN') run('CLOSE_DOOR');
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) run(type);
}
/** Explicit isolated unit calendar budget, never presented as paid ERA_NEXT_WEEK or persisted gameplay. */
function nextUnitWeek(s: SliceState) { expect(hasDeathConsulLifeLock(s)).toBe(false); s.date = addGameDays(s.date, 7); s.week++; s.actionsRemaining = 4; }
function firstOrdinary(s: SliceState) { start(s, 'pale-residue', 'ORDINARY'); step(s, 'pale-residue', 'PERFORM'); finish(s, 'pale-residue'); nextUnitWeek(s); }
function secondOrdinary(s: SliceState) { start(s, 'short-passage', 'ORDINARY'); step(s, 'short-passage', 'PERFORM'); step(s, 'short-passage', 'WALK_OUT'); finish(s, 'short-passage'); nextUnitWeek(s); }

describe('DeathConsul directed life units with streamed independent historical prefixes', () => {
  it('retains the real post-cycle and original-era people, old spirit energy and old branch distinction', () => {
    expect(postCycle.ferryman.life.reed).toMatchObject({ id: 'FR3-REED', energy: 91, travelMetres: 22 });
    expect(postCycle.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, weaponLocation: 'HAND' } });
    expect(original.undying.encounter.enemy).toMatchObject({ status: 'DEAD', health: 0, weaponLocation: 'YARD' });
    for (const era of ['ORIGINAL', 'POST_CYCLE'] as const) {
      const s = ready(era), old = oldState(s), source = DEATH_CONSUL_SOURCES[era];
      expect(s.deathConsul.life).toEqual(createDeathConsulLifeState()); expect(s.deathConsul.life.site).toEqual(createDeathConsulSiteState());
      expect(validateDeathConsulLife(s)).toBe(true); step(s, 'pale-residue', 'OBSERVE');
      expect(s.deathConsul.life.site).toMatchObject({ sourceEra: era, introducedWeek: s.week, introducedDate: s.date,
        operatorId: source.operatorId, operatorName: source.operatorName, operatorAge: source.operatorAge,
        residual: { id: source.residualId, strength: 3 }, material: { id: null, acquired: false, remaining: 0 } });
      expect(oldState(s)).toEqual(old);
    }
  });
  it('preserves every old entity while replaying three actual local attempts with the original random stream', () => {
    const s = ready(), old = oldState(s), oldMastery = { ...s.progression.mastery };
    start(s, 'pale-residue'); step(s, 'pale-residue', 'PERFORM');
    if (s.deathConsul.life.site.effect.mode === 'PALE_FLAME') step(s, 'pale-residue', 'APPLY_FLAME');
    finish(s, 'pale-residue'); nextUnitWeek(s);
    start(s, 'short-passage'); step(s, 'short-passage', 'PERFORM');
    if (s.deathConsul.life.site.effect.mode === 'PASSAGE') step(s, 'short-passage', 'CROSS_PASSAGE');
    else { step(s, 'short-passage', 'STOP'); step(s, 'short-passage', 'WALK_OUT'); }
    finish(s, 'short-passage'); nextUnitWeek(s);
    start(s, 'withdrawn-passage'); step(s, 'withdrawn-passage', 'PERFORM'); finish(s, 'withdrawn-passage'); nextUnitWeek(s);
    actual(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(hasDeathConsulLifeLock(s)).toBe(false);
    expect(oldState(s)).toEqual(old); for (const [id, value] of Object.entries(oldMastery)) if (id !== FLAME && id !== PASSAGE) expect(s.progression.mastery[id]).toBe(value);
    const l = s.deathConsul.life, p = l.site;
    expect(p.operatorEnergy).toBe(96); expect(p.operatorPassageMetres + p.operatorMetres).toBe(attempt(s, 'short-passage').crossed ? 18 : 24);
    expect(p.operatorConsent).toBe('WITHDRAWN'); expect(p.material).toMatchObject({ acquired: true, paidPennies: 4, remaining: 0 });
    expect(p.residual).toMatchObject({ location: 'ENTRY_STAND', container: 'CLOSED', seal: 'RESEALED', heatSeconds: 0 });
    expect(p.playerLocation).toBe('ENTRY'); expect(p.operatorLocation).toBe('ENTRY'); expect(p.effect.mode).toBe('OFF');
    for (const id of [FLAME, PASSAGE] as const) expect(s.progression.mastery[id]).toBe(DEATH_CONSUL_CASE_IDS.filter(c => attempt(s, c).appliedAbilityIds.includes(id)).length * 8);
    for (const e of l.journal) {
      expect(e.budget.actionsBefore - e.budget.actionsAfter).toBe(e.paid.actions); expect(e.budget.spiritualityBefore - e.budget.spiritualityAfter).toBe(e.paid.spirituality);
      expect(e.budget.cashBefore - e.budget.cashAfter).toBe(e.paid.pennies);
    }
    denied(s, { type: 'REPORT', caseId: 'pale-residue' }); denied(s, { type: 'REFLECT' });
  });
  it('uses exactly one paid sealing material even on the ordinary path, and does not infer a flame application', () => {
    const s = ready('ORIGINAL'), cash = s.cash; firstOrdinary(s);
    expect(s.cash).toBe(cash - 20); expect(s.spirituality).toBe(120); expect(mastery(s)).toEqual([0, 0]);
    expect(s.deathConsul.life.site.residual).toMatchObject({ strength: 3, scorch: 0, seal: 'RESEALED', container: 'CLOSED' });
    expect(s.deathConsul.life.site.material).toMatchObject({ id: DEATH_CONSUL_SOURCES.ORIGINAL.materialId, remaining: 0, paidPennies: 20 });
    denied(s, { type: 'BUY_SEAL', caseId: 'pale-residue' });
  });
  it('records current withdrawal after payment with zero movement, no refund and no unearned mastery', () => {
    const s = ready(); firstOrdinary(s); secondOrdinary(s); start(s, 'withdrawn-passage');
    const before = structuredClone(s.deathConsul.life.site), spirit = s.spirituality; step(s, 'withdrawn-passage', 'PERFORM'); step(s, 'withdrawn-passage', 'WITHDRAW_PERMISSION');
    const p = s.deathConsul.life.site; expect(s.spirituality).toBe(spirit - 6);
    expect([p.playerLocation, p.operatorLocation, p.operatorMetres, p.operatorPassageMetres, p.operatorEnergy]).toEqual([before.playerLocation, before.operatorLocation, before.operatorMetres, before.operatorPassageMetres, before.operatorEnergy]);
    expect(p.operatorConsent).toBe('WITHDRAWN'); expect(attempt(s, 'withdrawn-passage').appliedAbilityIds).toEqual([]);
    denied(s, { type: 'CROSS_PASSAGE', caseId: 'withdrawn-passage' }); denied(s, { type: 'CONSENT_OPERATOR', caseId: 'withdrawn-passage' });
    finish(s, 'withdrawn-passage'); expect(mastery(s)).toEqual([0, 0]); expect(p.operatorConsent).toBe('WITHDRAWN');
  });
  it('does not close a paid contact, carry an open hot jar or move a person without the actual prerequisites', () => {
    const s = ready(); start(s, 'pale-residue');
    denied(s, { type: 'LEAVE', caseId: 'pale-residue' }); denied(s, { type: 'TAKE_RESIDUAL', caseId: 'pale-residue' });
    denied(s, { type: 'APPLY_FLAME', caseId: 'pale-residue' }); expect(hasDeathConsulLifeLock(s)).toBe(true);
    const before = structuredClone(s); s.actionsRemaining = 0; denied(s, { type: 'PERFORM', caseId: 'pale-residue' });
    expect(before.deathConsul.life).toEqual(s.deathConsul.life);
  });
  it('projects detached real resources without side effects or developer-only labels', () => {
    const s = ready(); start(s, 'pale-residue'); const before = structuredClone(s), v = projectDeathConsulLife(s);
    expect(v.inside).toBe(true); expect(v.sitePhase).toBe('LIFE'); expect(v.story).toContain('苍白焰'); expect(v.environment).toContain('12米');
    expect(v.environment).not.toMatch(/候选|原文|原创G/); v.site.operatorEnergy = 0; v.currentAttempt!.penniesSpent++; v.cases[0]!.attempts[0]!.siteAtStart.playerMetres++;
    expect(s).toEqual(before);
  });
});

describe('DeathConsul explicitly forced local branches, never natural-play evidence', () => {
  it('pays on failure, opens no window and still consumes the real sealing material on ordinary cleanup', () => {
    const s = ready(); start(s, 'pale-residue'); const before = s.spirituality, cursor = s.random.cursor;
    act(s, { type: 'PERFORM', caseId: 'pale-residue' }, 100);
    expect(s.spirituality).toBe(before - 7); expect(s.random.cursor).toBe(cursor + 1); expect(s.deathConsul.life.site.effect.mode).toBe('OFF');
    expect(attempt(s, 'pale-residue').window).toBe('FAILED'); denied(s, { type: 'APPLY_FLAME', caseId: 'pale-residue' });
    finish(s, 'pale-residue', false); expect(s.deathConsul.life.site.material.remaining).toBe(0); expect(mastery(s)).toEqual([0, 0]);
  });
  it('requires actual flame application, leaves scorch and heat, and awards only on honest reporting', () => {
    const s = ready(); start(s, 'pale-residue'); act(s, { type: 'PERFORM', caseId: 'pale-residue' }, 1);
    expect(s.deathConsul.life.site.residual.strength).toBe(3); expect(mastery(s)).toEqual([0, 0]);
    act(s, { type: 'APPLY_FLAME', caseId: 'pale-residue' }); expect(s.deathConsul.life.site.residual).toMatchObject({ strength: 1, scorch: 1, heatSeconds: 16 });
    denied(s, { type: 'APPLY_FLAME', caseId: 'pale-residue' }); expect(mastery(s)).toEqual([0, 0]);
    finish(s, 'pale-residue', false); expect(mastery(s)).toEqual([8, 0]); expect(s.deathConsul.life.site.residual).toMatchObject({ scorch: 1, heatSeconds: 0 });
  });
  it('expires exactly after 20 seconds and cannot claim transport from an unused successful check', () => {
    const s = ready(); firstOrdinary(s); start(s, 'short-passage'); act(s, { type: 'PERFORM', caseId: 'short-passage' }, 1);
    const before = structuredClone(s.deathConsul.life.site); act(s, { type: 'WAIT_10', caseId: 'short-passage' }); expect(s.deathConsul.life.site.effect.mode).toBe('PASSAGE');
    act(s, { type: 'WAIT_10', caseId: 'short-passage' }); expect(s.deathConsul.life.site.effect.mode).toBe('OFF'); expect(attempt(s, 'short-passage').window).toBe('EXPIRED');
    denied(s, { type: 'CROSS_PASSAGE', caseId: 'short-passage' }); expect(s.deathConsul.life.site.operatorEnergy).toBe(before.operatorEnergy);
    finish(s, 'short-passage', false); expect(mastery(s)).toEqual([0, 0]);
  });
  it('moves the same two bodies and original jar six metres, then truly walks twelve metres back', () => {
    const s = ready(); firstOrdinary(s); start(s, 'short-passage'); const prior = structuredClone(s.deathConsul.life.site);
    act(s, { type: 'PERFORM', caseId: 'short-passage' }, 1); act(s, { type: 'CROSS_PASSAGE', caseId: 'short-passage' });
    const p = s.deathConsul.life.site; expect([p.playerLocation, p.operatorLocation]).toEqual(['FAR', 'FAR']); expect(p.operatorId).toBe(prior.operatorId); expect(p.residual.id).toBe(prior.residual.id);
    expect([p.playerPassageMetres, p.operatorPassageMetres, p.residual.passageMetres]).toEqual([6, 6, 6]); expect(p.operatorEnergy).toBe(prior.operatorEnergy - 2);
    denied(s, { type: 'CROSS_PASSAGE', caseId: 'short-passage' }); denied(s, { type: 'RETURN_GROUP', caseId: 'short-passage' });
    act(s, { type: 'STOP', caseId: 'short-passage' }); act(s, { type: 'RETURN_GROUP', caseId: 'short-passage' });
    expect(p.playerMetres).toBe(prior.playerMetres + 12); expect(p.operatorMetres).toBe(prior.operatorMetres + 12); expect(p.residual.ordinaryMetres).toBe(prior.residual.ordinaryMetres + 12);
    expect(p.operatorEnergy).toBe(prior.operatorEnergy - 4); finish(s, 'short-passage', false); expect(mastery(s)).toEqual([0, 8]);
  });
});

describe('DeathConsul strict ordered life provenance and finite resource units', () => {
  it('rejects plausible final resources, forged sources, changed receipts and erased physical steps', () => {
    const base = ready(); firstOrdinary(base); start(base, 'short-passage'); step(base, 'short-passage', 'PERFORM'); finish(base, 'short-passage');
    const mutations: [string, (s: SliceState) => void][] = [
      ['same-shaped alternate-era person', s => { s.deathConsul.life.site.operatorId = DEATH_CONSUL_SOURCES.ORIGINAL.operatorId; }],
      ['free independent energy', s => { s.deathConsul.life.site.operatorEnergy -= 2; }],
      ['unrecorded body movement', s => { s.deathConsul.life.site.playerMetres++; }],
      ['unrecorded passage', s => { s.deathConsul.life.site.playerPassageMetres += 6; }],
      ['renewed material', s => { s.deathConsul.life.site.material.remaining = 1; }],
      ['extra residual copy', s => { (s.deathConsul.life.site.residual as unknown as Record<string, unknown>).quantity = 2; }],
      ['free receipt', s => { const e = s.deathConsul.life.journal.find(e => e.command.type === 'BUY_SEAL')!; e.paid.pennies = 0; e.budget.cashAfter = e.budget.cashBefore; }],
      ['invented clock', s => { s.deathConsul.life.site.elapsedSeconds++; }],
      ['removed endpoint walk', s => { const l = s.deathConsul.life; l.journal.splice(l.journal.findIndex(e => e.command.type === 'CHECK_ENDPOINTS'), 1); }],
      ['changed paid check', s => { s.deathConsul.life.journal.find(e => e.check)!.check!.roll = 0; }],
      ['changed random cursor', s => { s.deathConsul.life.journal.find(e => e.check)!.randomAfter!++; }],
      ['changed current source consent', s => { s.deathConsul.life.journal.find(e => e.source)!.source!.operatorConsentWeek--; }],
      ['changed source site', s => { s.deathConsul.life.journal.find(e => e.source)!.source!.site.playerLocation = 'FAR'; }],
      ['changed introduction date', s => { s.deathConsul.life.site.introducedWeek!--; }],
      ['forged past snapshot', s => { attempt(s, 'short-passage').siteAtStart.material.remaining++; }],
      ['duplicate final event', s => { s.deathConsul.life.journal.push(structuredClone(s.deathConsul.life.journal.at(-1)!)); }],
      ['unearned mastery', s => { s.progression.mastery[PASSAGE]!++; }],
      ['unearned acting', s => { s.progression.acting++; }],
    ];
    expect(validateDeathConsulLife(base)).toBe(true);
    for (const [label, change] of mutations) { const s = structuredClone(base); change(s); expect(validateDeathConsulLife(s), label).toBe(false); }
  });
  it('rejects stale current budgets, next-week permissions, fake spirit commands and arbitrary extra properties', () => {
    const s = ready(); start(s, 'pale-residue'); const changed = structuredClone(s); changed.spirituality++; expect(validateDeathConsulLife(changed)).toBe(false);
    const stale = structuredClone(s); stale.week++; stale.date = addGameDays(stale.date, 7); expect(validateDeathConsulLife(stale)).toBe(false);
    for (const c of [{ type: 'RESURRECT', caseId: 'pale-residue' }, { type: 'SUMMON_REED', caseId: 'short-passage' },
      { type: 'CROSS_PASSAGE', caseId: 'short-passage', copies: 2 }, { type: 'REFLECT', caseId: 'pale-residue' }, { type: 'PREPARE', caseId: 'pale-residue', method: 'FREE' }]) expect(validateDeathConsulActivityCommand(c)).toBe(false);
  });
  it('expires an isolated window without moving a person, repairing the seal, clearing scorch or restoring fatigue', () => {
    const p = createDeathConsulSiteState(); introduceDeathConsulSite(p, 'POST_CYCLE', 1, { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 });
    p.effect = { mode: 'PASSAGE', expiresAt: 20 }; p.operatorEnergy = 96; p.operatorMetres = 12; p.operatorPassageMetres = 6;
    p.residual.scorch = 1; p.residual.strength = 1; p.residual.heatSeconds = 16;
    expect(validateDeathConsulSiteState(p)).toBe(true); const before = structuredClone(p); advanceDeathConsulTime(p, 19); expect(p.effect.mode).toBe('PASSAGE');
    advanceDeathConsulTime(p, 1); expect(p).toEqual({ ...before, elapsedSeconds: 20, effect: { mode: 'OFF', expiresAt: null }, residual: { ...before.residual, heatSeconds: 0 } });
    for (const invalid of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) { const same = structuredClone(p); expect(() => advanceDeathConsulTime(p, invalid)).toThrow(); expect(p).toEqual(same); }
  });
});
