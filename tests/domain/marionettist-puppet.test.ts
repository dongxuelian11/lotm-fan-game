import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { createMarionettistState } from '../../src/domain/marionettist/index.js';
import { applyMarionettistEncounter, blockMarionettistEncounter, settleMarionettistEncounter,
  validateMarionettistEncounter } from '../../src/domain/marionettist/encounter.js';
import { applyMarionettistPuppetCommand, blockMarionettistPuppetCommand, createMarionettistPuppetState,
  hasMarionettistOpenCapture, marionettistPuppetActions, projectMarionettistPuppet,
  validateMarionettistPuppet, validateMarionettistPuppetCommand,
  type MarionettistPuppetCommand } from '../../src/domain/marionettist/puppet.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, rolls: number[] = [1, 1]): SeerContext {
  let cursor = 0;
  return { note: vi.fn(), roll: vi.fn(() => { throw new Error('Unexpected random draw'); }),
    check: vi.fn((ability, difficulty) => {
      const roll = rolls[cursor++]; if (roll === undefined) throw new Error('Unexpected check');
      return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
    }) };
}
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let cursor = 0;
  vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const roll = rolls[cursor++];
    if (roll === undefined || roll < min || roll > max) throw new Error('Unexpected random draw'); return roll;
  });
}
/** Explicit bounded engine fixture. No natural result/seed is replaced. The body
 * must still pass through an actual common combat round and actual settlement. */
function ready(): SliceState {
  const s = createSliceRun('marionettist-puppet-test', sliceDefaultCreationSelection, 'puppet-engine-fixture');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20; s.actionsRemaining = 3;
  s.character.coreStats = { physique: 25, perception: 25, will: 50, knowledge: 25 };
  s.progression = { pathwayId: 'diviner', sequence: 5, mastery: {}, acting: 25, promotionWeek: 19 };
  s.marionettist = createMarionettistState(); s.marionettist.cases['living-lines'].status = 'RESOLVED';
  s.health = 100; s.mind = 100; s.spirituality = 100; s.arc.stage = 'ENDED'; s.town.clubLocation = 'SHOP';
  return s;
}
function settled(kind: 'SURRENDERED' | 'DEAD' | 'RETREATED' = 'SURRENDERED', oldWound = false) {
  const s = ready(), ctx = context(s), award = vi.fn();
  applyMarionettistEncounter(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
  expect(s.marionettist.puppet.target).toBeNull(); expect(validateMarionettistEncounter(s)).toBe(true);
  if (oldWound) {
    s.combat!.enemyHealth = 85; s.combat!.enemyMind = 66; s.combat!.enemyRisk = 1;
    s.combat!.enemyInjuries.push({ id: 'original-combat-wound', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
  }
  if (kind === 'RETREATED') scriptRolls(1, 1, 1);
  else scriptRolls(1, 1, 1, 400, 1, kind === 'DEAD' ? 100 : oldWound ? 50 : 66);
  const result = resolveSliceCombatRound(s, kind === 'RETREATED' ? 'RETREAT' : 'ATTACK');
  expect(result.outcome).toBe(kind === 'SURRENDERED' ? 'ENEMY_SURRENDERED' : kind === 'DEAD' ? 'ENEMY_DEAD' : 'RETREATED');
  const body = structuredClone(s.combat!); s.combatHistory.push(result.round);
  settleMarionettistEncounter(s, result.outcome, ctx, award); vi.restoreAllMocks();
  expect(s.combat).toBeNull(); expect(validateMarionettistEncounter(s)).toBe(true);
  return { s, body, ctx, award };
}
function convert(s: SliceState, ctx = context(s)) {
  applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, ctx);
  applyMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE', confirmedDeath: true }, ctx);
  return ctx;
}
afterEach(() => vi.restoreAllMocks());

describe('One original Dorn body, two-stage capture and bounded real use', () => {
  it('starts empty and rejects invented capture/death confirmation shapes', () => {
    const s = ready(); expect(validateMarionettistPuppet(createMarionettistPuppetState())).toBe(true);
    expect(marionettistPuppetActions(s)).toEqual([]); expect(projectMarionettistPuppet(s).targetId).toBeNull();
    expect(blockMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' })).toContain('没有真实原身体');
    expect(validateMarionettistPuppetCommand({ type: 'COMPLETE_CAPTURE', confirmedDeath: true })).toBe(true);
    for (const command of [{ type: 'COMPLETE_CAPTURE' }, { type: 'COMPLETE_CAPTURE', confirmedDeath: false },
      { type: 'COMPLETE_CAPTURE', confirmed: true }, { type: 'BEGIN_CAPTURE', target: 'COPY' }, { type: 'RESURRECT' }]) expect(validateMarionettistPuppetCommand(command)).toBe(false);
  });

  it('settles actual residual H/M/injuries/risk and retains one same record across death, use and dismissal', () => {
    const { s, body, award } = settled('SURRENDERED', true), p = s.marionettist.puppet, target = p.target!;
    expect(target).toMatchObject({ id: 'MM5-DORN', alive: true, status: 'SURRENDERED', health: body.enemyHealth,
      mind: body.enemyMind, injuries: body.enemyInjuries, injuryRisk: body.enemyRisk, spirituality: 15 });
    expect(target.health).toBe(55); expect(target.mind).toBe(66); expect(target.injuryRisk).toBe(2);
    const ctx = context(s); applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, ctx);
    expect(p.target).toBe(target); expect(p.capture.elapsedSeconds).toBe(20); expect(target.alive).toBe(true);
    expect(s.actionsRemaining).toBe(1); expect(s.spirituality).toBe(97); expect(hasMarionettistOpenCapture(s)).toBe(true);
    const beforeConfirmation = structuredClone(s);
    expect(() => applyMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE' } as MarionettistPuppetCommand, ctx)).toThrow('确认');
    expect(s).toEqual(beforeConfirmation);
    applyMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE', confirmedDeath: true }, ctx);
    expect(p.target).toBe(target); expect(target.status).toBe('CONTROLLED'); expect(target.alive).toBe(false);
    expect(p.capture.elapsedSeconds).toBe(300); expect(ctx.check).toHaveBeenCalledTimes(2);
    expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(89); expect(validateMarionettistEncounter(s)).toBe(true);
    expect(marionettistPuppetActions(s).find(a => a.command.type === 'PUPPET_DELIVER')?.enabled).toBe(true);
    applyMarionettistPuppetCommand(s, { type: 'PUPPET_DELIVER' }, ctx);
    expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(87); expect(target.spirituality).toBe(14);
    expect(p.note).toMatchObject({ id: 'MM5-NOTE', location: 'RECIPIENT_TABLE', deliveries: 1,
      bodyRoute: ['ORIGINAL_COURTYARD', 'SOURCE_TABLE', 'RECIPIENT_TABLE', 'ORIGINAL_COURTYARD'],
      noteRoute: ['SOURCE_TABLE', 'DORN_HAND', 'RECIPIENT_TABLE'] });
    const delivered = structuredClone(s);
    expect(() => applyMarionettistPuppetCommand(s, { type: 'PUPPET_DELIVER' }, ctx)).toThrow('已经交'); expect(s).toEqual(delivered);
    applyMarionettistPuppetCommand(s, { type: 'DISMISS_PUPPET' }, ctx);
    expect(p.target).toBe(target); expect(target).toMatchObject({ status: 'INERT', alive: false, health: body.enemyHealth, mind: body.enemyMind, injuries: body.enemyInjuries });
    expect(target.club).toEqual({ id: 'MM5-DORN-CLUB', ownerId: 'MM5-DORN', location: 'COURTYARD_GROUND' });
    expect(s.town.clubLocation).toBe('SHOP'); expect(p.active).toBe(false); expect(hasMarionettistOpenCapture(s)).toBe(false);
    expect(p.note.location).toBe('RECIPIENT_TABLE'); expect(marionettistPuppetActions(s)).toEqual([]);
    expect(award).toHaveBeenCalledTimes(1); expect(s.progression.acting).toBe(25); expect(validateMarionettistEncounter(s)).toBe(true);
    expect(() => applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, ctx)).toThrow();
  });

  it('permits 0AP/0SP/0mind release of the same living person without death or a reroll', () => {
    const { s } = settled(), ctx = context(s); applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, ctx);
    const target = s.marionettist.puppet.target!; s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    applyMarionettistPuppetCommand(s, { type: 'RELEASE_CONTROL' }, ctx);
    expect(target).toMatchObject({ status: 'DEPARTED', alive: true, location: 'DEPARTED', spirituality: 15 });
    expect(target.club.location).toBe('DORN_HAND'); expect(s.actionsRemaining).toBe(0); expect(s.spirituality).toBe(0);
    expect(marionettistPuppetActions(s)).toEqual([]); expect(validateMarionettistPuppet(s.marionettist.puppet)).toBe(true);
  });

  it.each(['initial', 'complete'] as const)('retains paid %s resistance failure and the living departure permanently', stage => {
    const { s } = settled(), ctx = context(s, stage === 'initial' ? [100] : [1, 100]);
    applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, ctx);
    if (stage === 'complete') applyMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE', confirmedDeath: true }, ctx);
    const p = s.marionettist.puppet;
    expect(p.target).toMatchObject({ status: 'DEPARTED', alive: true, health: 70, spirituality: 15 });
    expect(s.spirituality).toBe(stage === 'initial' ? 97 : 89); expect(s.actionsRemaining).toBe(stage === 'initial' ? 1 : 0);
    expect(p.capture.elapsedSeconds).toBe(stage === 'initial' ? 20 : 300); expect(p.active).toBe(false);
    expect(marionettistPuppetActions(s)).toEqual([]); expect(validateMarionettistEncounter(s)).toBe(true);
    expect(blockMarionettistEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('已有结果');
  });

  it.each(['DEAD', 'RETREATED'] as const)('preserves actual %s without exposing capture actions or a new healthy target', kind => {
    const { s, body } = settled(kind), p = s.marionettist.puppet;
    expect(p.target!.health).toBe(body.enemyHealth); expect(p.target!.injuries).toEqual(body.enemyInjuries);
    expect(p.target!.alive).toBe(kind !== 'DEAD'); expect(marionettistPuppetActions(s)).toEqual([]);
    const before = structuredClone(s);
    expect(() => applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, context(s))).toThrow(); expect(s).toEqual(before);
  });

  it('does not skip initial control, continue across weeks, or fund capture with insufficient SP', () => {
    const { s } = settled();
    expect(() => applyMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE', confirmedDeath: true }, context(s))).toThrow('20秒');
    s.spirituality = 2; const before = structuredClone(s);
    expect(() => applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, context(s))).toThrow('3灵性'); expect(s).toEqual(before);
    s.spirituality = 100; applyMarionettistPuppetCommand(s, { type: 'BEGIN_CAPTURE' }, context(s));
    s.week += 1;
    expect(validateMarionettistEncounter(s)).toBe(false);
    expect(() => applyMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE', confirmedDeath: true }, context(s))).toThrow('跨周');
    applyMarionettistPuppetCommand(s, { type: 'RELEASE_CONTROL' }, context(s)); expect(validateMarionettistEncounter(s)).toBe(true);
  });

  it('keeps the 1AP range-exit budget and makes the same body inert past100m without moving its objects', () => {
    const { s } = settled(); convert(s);
    expect(blockMarionettistPuppetCommand(s, { type: 'MOVE_BEYOND_RANGE' })).toContain('1行动');
    // Isolated range-boundary test with one available action; not a claim that
    // the natural three-action encounter grants a fourth action or extra week.
    s.actionsRemaining = 1;
    const p = s.marionettist.puppet, target = p.target!;
    applyMarionettistPuppetCommand(s, { type: 'MOVE_BEYOND_RANGE' }, context(s));
    expect(p.target).toBe(target); expect(s.actionsRemaining).toBe(0); expect(p.ownerDistanceMetres).toBe(122);
    expect(target).toMatchObject({ status: 'INERT', alive: false, location: 'ORIGINAL_COURTYARD', spirituality: 15 });
    expect(target.club.location).toBe('COURTYARD_GROUND'); expect(p.note.location).toBe('SOURCE_TABLE');
    expect(p.active).toBe(false); expect(marionettistPuppetActions(s)).toEqual([]); expect(validateMarionettistEncounter(s)).toBe(true);
  });

  it('binds the settled body to its own original terminal round, not the last round of every later battle', () => {
    const { s } = settled(); convert(s); applyMarionettistPuppetCommand(s, { type: 'DISMISS_PUPPET' }, context(s));
    const later = structuredClone(s.combatHistory[0]!); later.round = 7; s.combatHistory.push(later); s.week += 1;
    expect(validateMarionettistEncounter(s)).toBe(true);
    s.marionettist.puppet.target!.source.settledRound = 2;
    expect(validateMarionettistEncounter(s)).toBe(false);
  });

  it('rejects capacity copies, free SP, fake delivery, resurrection and retained control outside range', () => {
    const { s } = settled(); convert(s); const original = s.marionettist.puppet;
    const mutations: ((p: typeof original) => void)[] = [p => { p.target!.alive = true; }, p => { p.target!.spirituality = 16; },
      p => { p.capture.elapsedSeconds = 20; }, p => { p.ownerDistanceMetres = 122; },
      p => { p.note.location = 'RECIPIENT_TABLE'; }, p => { p.target!.club.id = 'COPY' as 'MM5-DORN-CLUB'; },
      p => { (p as unknown as Record<string, unknown>).secondTarget = structuredClone(p.target); }];
    for (const mutate of mutations) { const copy = structuredClone(original); mutate(copy); expect(validateMarionettistPuppet(copy)).toBe(false); }
  });
});
