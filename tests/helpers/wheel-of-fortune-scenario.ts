import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createWheelOfFortuneState, getWheelOfFortunePromotionStabilityPreview } from '../../src/domain/wheel-of-fortune/index.js';
import { openWheelOfFortuneRuntimeSession, type WheelOfFortuneRuntimeSession } from '../../src/domain/wheel-of-fortune/owned-session.js';
import { WHEEL_OF_FORTUNE_FROZEN_SOURCE_KEYS } from '../../src/domain/wheel-of-fortune/source.js';
import type { WheelOfFortuneCommand } from '../../src/domain/wheel-of-fortune/types.js';
import { getMercurySnakeCurrentSite } from '../../src/domain/mercury-snake/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';
export { hermitPublicLeaks as wheelOfFortunePublicLeaks } from './hermit-scenario.js';

export const WHEEL_OF_FORTUNE_SOURCE_FILE = 'tests/fixtures/mercury-snake-v02040/natural.json';
export const WHEEL_OF_FORTUNE_SOURCE_SHA = '6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574';
export const WHEEL_OF_FORTUNE_SOURCE_COMMAND_COUNT = 841;
export const WHEEL_OF_FORTUNE_SOURCE_CURSOR = 306;
export const wheelOfFortuneHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const wheelOfFortuneInheritedHash = (state: SliceState): string => wheelOfFortuneHash({
  ...Object.fromEntries(WHEEL_OF_FORTUNE_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});
export function assertWheelOfFortuneSourceUnmodified(): void {
  expect(createHash('sha256').update(readFileSync(WHEEL_OF_FORTUNE_SOURCE_FILE)).digest('hex')).toBe(WHEEL_OF_FORTUNE_SOURCE_SHA);
}
/** Read the actual 841-command endpoint once. No old campaign replay and no
 * replacement body, money, random stream, original room or original bottle. */
export function authenticWheelOfFortuneSource(): SliceState {
  assertWheelOfFortuneSourceUnmodified();
  const raw = readObjectEntry<SliceState>(WHEEL_OF_FORTUNE_SOURCE_FILE, 'final');
  const before = wheelOfFortuneHash(raw), state = migrateSliceState(raw);
  expect(wheelOfFortuneHash(raw)).toBe(before);
  expect(state).toMatchObject({ revision:842,week:202,status:'ACTIVE',health:90,mind:88,
    spirituality:86,cash:20,actionsRemaining:3,injuryRisk:0,
    date:{epoch:'FIFTH_EPOCH',year:1353,month:5,day:5},
    progression:{pathwayId:'wheel',sequence:1,acting:100},
    random:{seed:'monster-natural-v060',cursor:WHEEL_OF_FORTUNE_SOURCE_CURSOR},seer:{pollution:0} });
  expect(state.injuries).toEqual([{id:'monster-rebuild-natural:combat:1:PLAYER:841:0',severity:'LIGHT',acquiredRevision:841,treatedRevision:null}]);
  expect(state.character.coreStats).toMatchObject({will:24,perception:26});
  expect(state.mercurySnake.promotionWeek).toBe(196);
  expect(state.mercurySnake.bottles.map(bottle=>bottle.outcome)).toEqual(['FAILURE','SUCCESS',null]);
  expect(state.mercurySnake.life.reflected).toBe(true);
  expect(state.mercurySnake.luck).toMatchObject({stored:0,accumulated:14,spent:14});
  expect(Object.keys(state.progression.mastery)).toHaveLength(19);
  expect(state.progression.mastery['wheel.s1.local-restart']).toBe(16);
  expect(state.progression.mastery['wheel.s1.moment-anchor']).toBe(0);
  expect(getMercurySnakeCurrentSite(state)).toMatchObject({playerLocation:'START',playerTravelMetres:212,
    volunteer:{id:'CW3-VERA',age:39,alive:true,location:'OUTSIDE',health:100,mind:97},
    guide:{id:'GUIDE',location:'OUTSIDE'},cart:{location:'A'},parcel:{location:'CW3-CART',massGrams:400,sealed:true},
    pouch:{location:'VERA'},disc:{location:'A'},record:{location:'B'}});
  expect(state.mercurySnake.life.operation).toMatchObject({door:'OPEN',forecast:null,correction:null,mechanical:{bias:'B'}});
  expect(state.mercurySnake.encounter.enemyStatus).toBe('SURRENDERED');
  expect(state.mercurySnake.encounter.enemyHealth).toBe(70);
  expect(state.mercurySnake.encounter.enemyInjuries.some(injury=>injury.severity==='HEAVY'&&injury.treatedRevision===null)).toBe(true);
  expect(state.wheelOfFortune).toStrictEqual(createWheelOfFortuneState());
  expect(wheelOfFortuneInheritedHash(state)).toBe(wheelOfFortuneInheritedHash(raw));
  return state;
}
export function executeWheelOfFortune(session: WheelOfFortuneRuntimeSession, command: WheelOfFortuneCommand): SliceState {
  const draft = session.prepare({ type: 'WHEEL_OF_FORTUNE', command }, session.inspect().revision);
  session.commit(draft);
  return session.snapshot();
}
/** Follow enabled public recommendations, paying for actual rest and work
 * before leaving the original START. This fixture never fills resources. */
export function preparedWheelOfFortuneScenario() {
  const source = authenticWheelOfFortuneSource();
  const guided = applySliceIntent(source, { type: 'WHEEL_OF_FORTUNE', command: { type: 'LEARN_GUIDANCE' } });
  const session = openWheelOfFortuneRuntimeSession(guided);
  const commands: WheelOfFortuneCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (let step = 0; step < 400; step++) {
    const panel = session.projectWheelOfFortune(), action = panel.actions.find(candidate => candidate.preferredAction);
    const state = session.snapshot();
    if (action?.command.type === 'CONSUME') {
      expect(action.enabled).toBe(true);
      expect(action.label).toContain('70%');
      expect(getWheelOfFortunePromotionStabilityPreview(state.wheelOfFortune, action.command.compoundId))
        .toMatchObject({ prepared: true, chance: 70 });
      expect(wheelOfFortuneInheritedHash(state)).toBe(wheelOfFortuneInheritedHash(source));
      assertWheelOfFortuneSourceUnmodified();
      return { source, guided, beforeConsume: state, session, commands };
    }
    if (!action?.enabled) throw Error(`WheelOfFortune route blocked: ${JSON.stringify({
      week: state.week, cash: state.cash, actions: state.actionsRemaining,
      location: state.wheelOfFortune.frame?.location, scene: state.wheelOfFortune.scene, action, last: commands.slice(-8),
    })}`);
    executeWheelOfFortune(session, action.command);
    commands.push(structuredClone(action.command));
  }
  throw Error('WheelOfFortune paid preparation did not reach enabled real consumption within 400 commands.');
}
/** Test-only future draws still advance the real random stream. The original
 * 841 results stay untouched. Keep active during controlled cold-replay checks. */
export function controlledWheelOfFortuneRolls(rolls: Readonly<Record<number, number>> = {}) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor, actual = original.call(this, minimum, maximum);
    return this.seed === 'monster-natural-v060' && cursor >= WHEEL_OF_FORTUNE_SOURCE_CURSOR && minimum === 1 && maximum === 100
      ? rolls[cursor] ?? 1 : actual;
  });
  return () => spy.mockRestore();
}
