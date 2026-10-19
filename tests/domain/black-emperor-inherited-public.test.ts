import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { projectPrinceOfAbolitionRoundOutcome } from '../../src/domain/prince-of-abolition/combat.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { authenticBlackEmperorSource, assertBlackEmperorSourceUnmodified, blackEmperorHash } from '../helpers/black-emperor-scenario.js';
const privateKeys = new Set(['seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','cursorBefore','cursorAfter','randomBefore','randomAfter','preparationRoll','futureRoll','nextRoll','futurePrivate','sourceDigest','identityDigest','historyDigest']);
function privatePaths(value: unknown): string[] {
 const paths: string[] = [];
 function walk(v: unknown, path: string): void {
  if (!v || typeof v !== 'object') return;
  for (const [key, child] of Object.entries(v)) {
   const at = `${path}.${key}`;
   if (privateKeys.has(key) || key === 'source' && child !== null && typeof child === 'object') paths.push(at);
   walk(child, at);
  }
 }
 walk(value,'$');return paths;
}
function inject(value: unknown): void {
 if (!value || typeof value !== 'object') return;
 for (const child of Object.values(value)) inject(child);
 if (!Array.isArray(value)) Object.assign(value,{futurePrivate:'PRIVATE-FUTURE',randomSeed:'PRIVATE-FUTURE',randomCursor:987654,preparationRoll:99});
}
describe('BlackEmperor227 complete genuine205 inherited public projection',()=>{
 it('preserves all private originals and mastery while all inherited public history omits future stream authority',()=>{
  const state=authenticBlackEmperorSource(),before=blackEmperorHash(state),random=structuredClone(state.random),view=projectSliceState(state);
  expect(privatePaths(view)).toEqual([]);expect(JSON.stringify(view)).not.toContain(state.random.seed);
  expect(view.progression.mastery).toEqual(state.progression.mastery);
  expect(view).toMatchObject({health:80,mind:71,spirituality:97,cash:140});
  expect(view.injuries).toHaveLength(2);
  let actual=0;
  for(const [index,round]of state.combatHistory.entries()){
   if(!round.princeOfAbolitionOutcome)continue;actual++;
   const raw=structuredClone(round.princeOfAbolitionOutcome),expected=projectPrinceOfAbolitionRoundOutcome(raw);
   expect(view.combatHistory[index]!.princeOfAbolitionOutcome).toEqual(projectPlayerText(expected,state.character.name));
   inject(raw);const poisoned=blackEmperorHash(raw);
   expect(projectPrinceOfAbolitionRoundOutcome(raw)).toEqual(expected);expect(privatePaths(expected)).toEqual([]);
   expect(blackEmperorHash(raw)).toBe(poisoned);
  }
  expect(actual).toBeGreaterThan(0);
  expect(view.lastCombatRound!.princeOfAbolitionOutcome).toEqual(view.combatHistory.at(-1)!.princeOfAbolitionOutcome);
  expect(blackEmperorHash(state)).toBe(before);expect(state.random).toEqual(random);assertBlackEmperorSourceUnmodified();
 },60_000);
});
