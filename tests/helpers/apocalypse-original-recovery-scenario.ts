import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { hasApocalypseDemonessLock, projectApocalypseDemoness } from '../../src/domain/apocalypse-demoness/index.js';
import type { ApocalypseDemonessCommand } from '../../src/domain/apocalypse-demoness/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';

export const APOCALYPSE_ACTUAL688_PATH = 'tests/fixtures/apocalypse-demoness-v01990/boundary-step-688-action.json';
export const APOCALYPSE_LEGACY854_PATH = 'tests/fixtures/apocalypse-demoness-v01990/natural.json';
export const APOCALYPSE_ACTUAL688_SHA256 = '34e43b3cb872a7c43851e5d3d583983e06b2081d8645bc42cd10b6d243a5bb67';
export const APOCALYPSE_LEGACY854_SHA256 = 'baf997edd399bee66132fc7278a741968063dee012e960c9e2fc80ae1f1f4339';
export const originalApocalypseId = (ordinal: 1 | 2 | 3) => `apocalypse-demoness-potion-${ordinal}`;
export const loadActual688 = () => migrateSliceState(readObjectEntry<SliceState>(APOCALYPSE_ACTUAL688_PATH, 'final'));
export const loadLegacy854 = () => migrateSliceState(readObjectEntry<SliceState>(APOCALYPSE_LEGACY854_PATH, 'final'));
export function recoveryStep(s: SliceState, intent: SliceIntent, commands: SliceIntent[] = []): SliceState {
  const next = applySliceIntent(s, intent); commands.push(structuredClone(intent)); return next;
}
export const apocalypseStep = (s: SliceState, command: ApocalypseDemonessCommand, commands?: SliceIntent[]) =>
  recoveryStep(s, { type: 'APOCALYPSE_DEMONESS', command }, commands);

/** Finite fixed budget strategy, with actual wages, AP, resting and weekly bills.
 * No predecessor replay, resource edit, future draw inspection or outcome retry. */
export function recoveryBudget(s: SliceState, minimum: { cash?: number; ap?: number; health?: number; mind?: number; spirituality?: number; pollution?: number; afterWeek?: number } = {}, commands?: SliceIntent[]): SliceState {
  const { cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = minimum;
  for (let n = 0; s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) {
    if (n >= 120 || s.status !== 'ACTIVE' || s.activeEvent || s.combat || hasApocalypseDemonessLock(s)) throw new Error('Actual recovery budget is blocked; preserve the current result.');
    s = recoveryStep(s, { type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, commands);
  }
  return s;
}

/** Returns one newly paid same-original vessel, still unprepared and unconsumed. */
export function acquireRecoveredDose(s: SliceState, sourceBottleId: string, commands?: SliceIntent[]): { state: SliceState; bottleId: string } {
  s = recoveryBudget(s, { cash: 150 }, commands);
  s = apocalypseStep(s, { type: 'REQUEST_RECOVERY_V1', bottleId: sourceBottleId }, commands);
  const requestedWeek = s.apocalypseDemoness.resupply.recovery!.requestedWeek;
  s = recoveryBudget(s, { afterWeek: requestedWeek }, commands);
  s = apocalypseStep(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: sourceBottleId }, commands);
  const bottleId = s.apocalypseDemoness.bottles.at(-1)!.id;
  for (let n = 0; n < 5; n++) {
    s = recoveryBudget(s, {}, commands);
    s = apocalypseStep(s, { type: 'POTION_WORK', bottleId }, commands);
  }
  // 90 new drugs + 150 actual site + 60 optional support + a 30-penny real bill.
  s = recoveryBudget(s, { cash: 330, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  s = apocalypseStep(s, { type: 'BUY_POTION', bottleId }, commands);
  return { state: s, bottleId };
}

/** CONTROLLED FUTURE UNIT INPUT ONLY. The source688 file, seed, original checks,
 * costs, receipts and sourceScene remain unchanged. Advance one actual ordinary
 * action before selecting a future cursor, so no adjacent receipt is rewritten.
 * Natural continuation below never calls this helper. */
export function controlledFutureDose(s: SliceState, bottleId: string, rollRange: readonly [number, number]): SliceState {
  if (s.revision <= 689 || s.apocalypseDemoness.preparedWeek !== null) throw new Error('Controlled input must follow the untouched actual688 boundary and precede preparation.');
  s = recoveryStep(s, { type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' });
  s = recoveryBudget(s, { cash: 240, health: 100, mind: 100, spirituality: 120 });
  const next = structuredClone(s);
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 1024; cursor++) {
    const roll = new DeterministicActionRandomStream(s.random.seed, cursor).nextInt(1, 100);
    if (roll >= rollRange[0] && roll <= rollRange[1]) {
      next.random.cursor = cursor;
      return apocalypseStep(next, { type: 'PREPARE_PROMOTION' });
    }
  }
  throw new Error(`No controlled future input for ${bottleId} in the finite cursor window.`);
}

/** One actual ability attempt per life case, following its existing finite
 * preferred route. Failed applications use normal cleanup, never rerolls. */
export function finishApocalypseLife(s: SliceState, commands?: SliceIntent[]): SliceState {
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 1) throw new Error('Actual S1 promotion is required.');
  s = recoveryBudget(s, { cash: 300, health: 100, mind: 100, spirituality: 120, pollution: 0 }, commands);
  for (let n = 0; !s.apocalypseDemoness.life.reflected; n++) {
    if (n >= 160) throw new Error('Finite S1 life route did not reach reflection.');
    const life = projectApocalypseDemoness(s).life;
    const action = life.actions.find(a => a.enabled && a.id === life.preferredActionId);
    if (!action) {
      if (hasApocalypseDemonessLock(s)) throw new Error('S1 scene is blocked; preserve the actual people and objects.');
      s = recoveryBudget(s, { cash: 150, health: 100, mind: 100, spirituality: 120 }, commands);
      const retry = projectApocalypseDemoness(s).life;
      if (!retry.actions.some(a => a.enabled && a.id === retry.preferredActionId)) throw new Error('No declared S1 preferred action.');
    } else s = apocalypseStep(s, action.command, commands);
  }
  return s;
}

/** Optional later natural capture: exactly one future supported original3 dose.
 * If it fails, return that failure. No automatic extra recovery or reroll. */
export function continueNaturalApocalypseFrom688(): { state: SliceState; commands: SliceIntent[] } {
  const commands: SliceIntent[] = [];
  let s = loadActual688();
  for (let n = 0; n < 5; n++) s = recoveryStep(s, { type: 'ACTION', action: 'REST' }, commands);
  const acquired = acquireRecoveredDose(s, originalApocalypseId(3), commands);
  s = apocalypseStep(acquired.state, { type: 'PREPARE_PROMOTION' }, commands);
  s = apocalypseStep(s, { type: 'STABILIZE_PROMOTION', bottleId: acquired.bottleId }, commands);
  s = apocalypseStep(s, { type: 'CONSUME', bottleId: acquired.bottleId, confirmed: true }, commands);
  if (s.progression.sequence === 1) s = finishApocalypseLife(s, commands);
  return { state: s, commands };
}

let controlledLifeSource: SliceState | undefined;
/** Explicit future-controlled test branch for S0 consumers. All original688
 * evidence and all later real costs/practices remain; no acting/mastery edits. */
export function controlledApocalypseS1Source(): SliceState {
  if (!controlledLifeSource) {
    const { state, bottleId } = acquireRecoveredDose(loadActual688(), originalApocalypseId(3));
    let s = controlledFutureDose(state, bottleId, [43, 68]);
    s = apocalypseStep(s, { type: 'STABILIZE_PROMOTION', bottleId });
    s = apocalypseStep(s, { type: 'CONSUME', bottleId, confirmed: true });
    controlledLifeSource = finishApocalypseLife(s);
  }
  return structuredClone(controlledLifeSource);
}
