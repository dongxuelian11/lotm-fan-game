import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createBlackEmperorState, getBlackEmperorPromotionStabilityPreview } from '../../src/domain/black-emperor/index.js';
import { openBlackEmperorRuntimeSession, type BlackEmperorRuntimeSession } from '../../src/domain/black-emperor/owned-session.js';
import { BLACK_EMPEROR_FROZEN_SOURCE_KEYS } from '../../src/domain/black-emperor/source.js';
import type { BlackEmperorCommand } from '../../src/domain/black-emperor/types.js';
import { getPrinceOfAbolitionCurrentSite } from '../../src/domain/prince-of-abolition/life.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';
export { hermitPublicLeaks as blackEmperorPublicLeaks } from './hermit-scenario.js';

export const BLACK_EMPEROR_SOURCE_FILE = 'tests/fixtures/prince-of-abolition-v02050/natural.json';
export const BLACK_EMPEROR_SOURCE_SHA = '116e7060455dbde907758f92af3fb20f6de8f0e15b248f44bb895d4a78e03dfa';
export const BLACK_EMPEROR_SOURCE_COMMAND_COUNT = 924;
export const BLACK_EMPEROR_SOURCE_CURSOR = 315;
export const blackEmperorHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const blackEmperorInheritedHash = (state: SliceState): string => blackEmperorHash({
  ...Object.fromEntries(BLACK_EMPEROR_FROZEN_SOURCE_KEYS.map(key => [key, state[key]])),
  world: state.world, combatHistory: state.combatHistory,
});
export function assertBlackEmperorSourceUnmodified(): void {
  expect(createHash('sha256').update(readFileSync(BLACK_EMPEROR_SOURCE_FILE)).digest('hex')).toBe(BLACK_EMPEROR_SOURCE_SHA);
}
/** Read the actual 924-command endpoint once. No old campaign replay and no
 * replacement body, money, random stream, original room or original bottle. */
export function authenticBlackEmperorSource(): SliceState {
  assertBlackEmperorSourceUnmodified();
  const raw = readObjectEntry<SliceState>(BLACK_EMPEROR_SOURCE_FILE, 'final');
  const before = blackEmperorHash(raw), state = migrateSliceState(raw);
  expect(blackEmperorHash(raw)).toBe(before);
  expect(state).toMatchObject({ revision:925,week:222,status:'ACTIVE',health:80,mind:71,
    spirituality:97,cash:140,actionsRemaining:1,injuryRisk:1,
    date:{epoch:'FIFTH_EPOCH',year:1353,month:9,day:22},
    progression:{pathwayId:'black-emperor',sequence:1,acting:100},
    random:{seed:'lawyer-natural-v063',cursor:BLACK_EMPEROR_SOURCE_CURSOR},seer:{pollution:0} });
  expect(state.injuries).toEqual([
    {id:'lawyer-rebuild-natural:combat:1:PLAYER:920:0',severity:'LIGHT',acquiredRevision:920,treatedRevision:null},
    {id:'lawyer-rebuild-natural:combat:5:PLAYER:924:1',severity:'LIGHT',acquiredRevision:924,treatedRevision:null}]);
  expect(state.character.coreStats).toMatchObject({will:26,perception:24});
  expect(state.princeOfAbolition.promotionWeek).toBe(216);
  expect(state.princeOfAbolition.bottles.map(bottle=>bottle.outcome)).toEqual(['FAILURE','FAILURE','SUCCESS']);
  expect(state.princeOfAbolition.resupply).toEqual({requestedWeek:null,deliveries:0});
  expect(state.princeOfAbolition.life.reflected).toBe(true);
  expect(Object.keys(state.progression.mastery)).toHaveLength(16);
  expect(state.progression.mastery['black-emperor.s1.directed-amplification']).toBe(16);
  expect(state.progression.mastery['black-emperor.s1.effect-maintenance']).toBe(8);
  expect(getPrinceOfAbolitionCurrentSite(state)).toMatchObject({playerLocation:'OUTSIDE',playerTravelMetres:236,
    volunteer:{id:'FM3-DARIAN',age:42,alive:true,location:'OUTSIDE',health:100,mind:97},
    guide:{id:'GUIDE',location:'OUTSIDE'},parcel:{holder:'GUIDE',location:'OUTSIDE',massGrams:400,sealed:true},
    ball:{holder:'GUIDE',location:'OUTSIDE',massGrams:80},paper:{holder:'GUIDE',location:'OUTSIDE'}});
  expect(state.princeOfAbolition.life.operation).toEqual({door:'OPEN',inputActive:false,flight:null});
  expect(state.princeOfAbolition.encounter.enemyStatus).toBe('SURRENDERED');
  expect(state.princeOfAbolition.encounter.enemyHealth).toBe(50);
  expect(state.princeOfAbolition.encounter.enemyInjuries.filter(injury=>injury.treatedRevision===null)).toHaveLength(3);
  expect(state.blackEmperor).toStrictEqual(createBlackEmperorState());
  expect(blackEmperorInheritedHash(state)).toBe(blackEmperorInheritedHash(raw));
  return state;
}
export function executeBlackEmperor(session: BlackEmperorRuntimeSession, command: BlackEmperorCommand): SliceState {
  const draft = session.prepare({ type: 'BLACK_EMPEROR', command }, session.inspect().revision);
  session.commit(draft);
  return session.snapshot();
}
/** Follow enabled public recommendations, paying for actual rest and work
 * before travelling from the original OUTSIDE. This fixture never fills resources. */
export function preparedBlackEmperorScenario() {
  const source = authenticBlackEmperorSource();
  const guided = applySliceIntent(source, { type: 'BLACK_EMPEROR', command: { type: 'LEARN_GUIDANCE' } });
  const session = openBlackEmperorRuntimeSession(guided);
  const commands: BlackEmperorCommand[] = [{ type: 'LEARN_GUIDANCE' }];
  for (let step = 0; step < 400; step++) {
    const panel = session.projectBlackEmperor(), action = panel.actions.find(candidate => candidate.preferredAction);
    const state = session.snapshot();
    if (action?.command.type === 'CONSUME') {
      expect(action.enabled).toBe(true);
      expect(action.label).toContain('70%');
      expect(getBlackEmperorPromotionStabilityPreview(state.blackEmperor, action.command.compoundId))
        .toMatchObject({ prepared: true, chance: 70 });
      expect(blackEmperorInheritedHash(state)).toBe(blackEmperorInheritedHash(source));
      assertBlackEmperorSourceUnmodified();
      return { source, guided, beforeConsume: state, session, commands };
    }
    if (!action?.enabled) throw Error(`BlackEmperor route blocked: ${JSON.stringify({
      week: state.week, cash: state.cash, actions: state.actionsRemaining,
      location: state.blackEmperor.frame?.location, scene: state.blackEmperor.scene, action, last: commands.slice(-8),
    })}`);
    executeBlackEmperor(session, action.command);
    commands.push(structuredClone(action.command));
  }
  throw Error('BlackEmperor paid preparation did not reach enabled real consumption within 400 commands.');
}
/** Test-only future draws still advance the real random stream. The original
 * 924 results stay untouched. Keep active during controlled cold-replay checks. */
export function controlledBlackEmperorRolls(rolls: Readonly<Record<number, number>> = {}) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor, actual = original.call(this, minimum, maximum);
    return this.seed === 'lawyer-natural-v063' && cursor >= BLACK_EMPEROR_SOURCE_CURSOR && minimum === 1 && maximum === 100
      ? rolls[cursor] ?? 1 : actual;
  });
  return () => spy.mockRestore();
}
