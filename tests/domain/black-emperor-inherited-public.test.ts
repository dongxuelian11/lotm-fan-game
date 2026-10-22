import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
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
/** Poison only replay-authority boundaries that exist on these real outcomes. */
function inject(outcome: { source: object; playerActions: object[]; enemyActions: object[] }): void {
 Object.assign(outcome.source,{futurePrivate:'PRIVATE-FUTURE',randomSeed:'PRIVATE-FUTURE',randomCursor:987654,preparationRoll:99});
 if ('randomCursorAfter' in outcome) outcome.randomCursorAfter=987655;
 for (const action of [...outcome.playerActions,...outcome.enemyActions]) {
  if ('randomCursorBefore' in action) action.randomCursorBefore=987654;
  if ('randomCursorAfter' in action) action.randomCursorAfter=987655;
 }
}
function inheritedRoundFacts(round: SliceCombatRound) {
 const {fallenEarlOutcome,entropyDukeOutcome,...facts}=structuredClone(round);
 const fallen=fallenEarlOutcome?(({source,...actual})=>actual)(fallenEarlOutcome):null;
 const entropy=entropyDukeOutcome?(({source,randomCursorAfter,playerActions,enemyActions,...actual})=>({
  ...actual,
  playerActions:playerActions.map(({randomCursorBefore,randomCursorAfter,...action})=>action),
  enemyActions:enemyActions.map(({randomCursorBefore,randomCursorAfter,...action})=>action),
 }))(entropyDukeOutcome):null;
 return {...facts,...(fallen?{fallenEarlOutcome:fallen}:{}),...(entropy?{entropyDukeOutcome:entropy}:{})};
}
function atAllRoundEntrances(state: SliceState, round: SliceCombatRound): SliceState {
 const outcome=round.fallenEarlOutcome??round.entropyDukeOutcome!;
 return {...state,lastCombatRound:round,combat:{
  encounterId:round.fallenEarlOutcome?'FALLEN_EARL_DISPUTE':'ENTROPY_DUKE_DISPUTE',
  round:round.round,enemyHealth:outcome.enemyHealth,enemyMind:outcome.enemyMind,enemyStatus:outcome.enemyStatus,
  enemyInjuries:round.entropyDukeOutcome?.enemyInjuries??[],enemyRisk:round.entropyDukeOutcome?.enemyRisk??0,lastRound:round,
 }};
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
 it('keeps actual FallenEarl and EntropyDuke facts identical across history, last round and combat last round',()=>{
  const state=authenticBlackEmperorSource(),before=blackEmperorHash(state),random=structuredClone(state.random);
  const rounds=state.combatHistory.map((round,index)=>({round,index})).filter(({round})=>round.fallenEarlOutcome||round.entropyDukeOutcome);
  expect(rounds.some(({round})=>round.fallenEarlOutcome)).toBe(true);
  expect(rounds.some(({round})=>round.entropyDukeOutcome)).toBe(true);
  for(const {round,index}of rounds){
   const current=atAllRoundEntrances(state,round),currentHash=blackEmperorHash(current);
   const expected=projectPlayerText(inheritedRoundFacts(round),state.character.name),view=projectSliceState(current);
   expect(view.combatHistory[index]).toEqual(expected);
   expect(view.lastCombatRound).toEqual(expected);
   expect(view.combat!.lastRound).toEqual(expected);
   expect(privatePaths([view.combatHistory[index],view.lastCombatRound,view.combat!.lastRound])).toEqual([]);
   expect(blackEmperorHash(current)).toBe(currentHash);

   const poisonedRound=structuredClone(round);
   inject(poisonedRound.fallenEarlOutcome??poisonedRound.entropyDukeOutcome!);
   const poisoned=atAllRoundEntrances({...state,combatHistory:state.combatHistory.map((r,i)=>i===index?poisonedRound:r)},poisonedRound);
   const poisonedHash=blackEmperorHash(poisoned),publicPoisoned=projectSliceState(poisoned);
   expect(publicPoisoned.combatHistory[index]).toEqual(expected);
   expect(publicPoisoned.lastCombatRound).toEqual(expected);
   expect(publicPoisoned.combat!.lastRound).toEqual(expected);
   expect(privatePaths([publicPoisoned.combatHistory[index],publicPoisoned.lastCombatRound,publicPoisoned.combat!.lastRound])).toEqual([]);
   expect(blackEmperorHash(poisoned)).toBe(poisonedHash);expect(poisoned.random).toEqual(random);
  }
  // Public check explanations use a legitimate string source; retain it and the actual completed roll.
  const checked=structuredClone(rounds.find(({round})=>round.entropyDukeOutcome?.playerActions.some(action=>action.check))!.round);
  const action=checked.entropyDukeOutcome!.playerActions.find(action=>action.check)!;
  action.check={...action.check!,modifiers:[{source:'Actual resolved check explanation',value:0}]};
  const withModifier=atAllRoundEntrances({...state,combatHistory:[checked]},checked),modifierHash=blackEmperorHash(withModifier);
  const expected=projectPlayerText(inheritedRoundFacts(checked),state.character.name),view=projectSliceState(withModifier);
  expect(view.lastCombatRound).toEqual(expected);expect(view.combatHistory[0]).toEqual(expected);expect(view.combat!.lastRound).toEqual(expected);
  expect(view.lastCombatRound!.entropyDukeOutcome!.playerActions.find(a=>a.check)!.check!.modifiers).toEqual(action.check.modifiers);
  expect(blackEmperorHash(withModifier)).toBe(modifierHash);
  expect(blackEmperorHash(state)).toBe(before);expect(state.random).toEqual(random);assertBlackEmperorSourceUnmodified();
 },120_000);

});
