import {expect,it} from 'vitest';
import {projectSliceState} from '../../src/domain/slice/index.js';
import type {SliceCombatRound,SliceState} from '../../src/domain/slice/types.js';
import {projectAncientAlchemistCombat} from '../../src/domain/ancient-alchemist/combat.js';
import {projectCoffinBearerCombat} from '../../src/domain/coffin-bearer/combat.js';
import {projectBarrenMatriarchCombat} from '../../src/domain/barren-matriarch/combat.js';
import {projectPlayerText} from '../../src/shared/player-text.js';
import {authenticMotherPredecessor,assertMotherSourceUnmodified,motherHash,motherPublicLeaks} from '../helpers/mother-scenario.js';

const inheritedKeys=['ancientAlchemistOutcome','coffinBearerOutcome','barrenMatriarchOutcome'] as const;
/** All existing completed facts survive; only the actual replay-authority fields are private. */
function inheritedRoundFacts(round:SliceCombatRound){
 const {ancientAlchemistOutcome,coffinBearerOutcome,barrenMatriarchOutcome,...facts}=structuredClone(round);
 const imperative=ancientAlchemistOutcome?(({source,...actual})=>actual)(ancientAlchemistOutcome):null;
 const chaos=coffinBearerOutcome?(({source,...actual})=>actual)(coffinBearerOutcome):null;
 const barrenMatriarch=barrenMatriarchOutcome?(({source,randomCursorAfter,playerActions,enemyActions,...actual})=>({
  ...actual,playerActions:playerActions.map(({randomCursorBefore,randomCursorAfter,...action})=>action),
  enemyActions:enemyActions.map(({randomCursorBefore,randomCursorAfter,...action})=>action),
 }))(barrenMatriarchOutcome):null;
 return {...facts,...(imperative?{ancientAlchemistOutcome:imperative}:{}),...(chaos?{coffinBearerOutcome:chaos}:{}),...(barrenMatriarch?{barrenMatriarchOutcome:barrenMatriarch}:{})};
}
function atAllRoundEntrances(state:SliceState,round:SliceCombatRound):SliceState{
 const outcome=round.ancientAlchemistOutcome??round.coffinBearerOutcome??round.barrenMatriarchOutcome!;
 return {...state,lastCombatRound:round,combat:{
  encounterId:round.ancientAlchemistOutcome?'ANCIENT_ALCHEMIST_DISPUTE':round.coffinBearerOutcome?'COFFIN_BEARER_DISPUTE':'BARREN_MATRIARCH_DISPUTE',
  round:round.round,enemyHealth:outcome.enemyHealth,enemyMind:outcome.enemyMind,enemyStatus:outcome.enemyStatus,
  enemyInjuries:round.barrenMatriarchOutcome?.enemyInjuries??round.coffinBearerOutcome?.enemyInjuriesAfter??[],
  enemyRisk:round.barrenMatriarchOutcome?.enemyRisk??round.coffinBearerOutcome?.enemyRiskAfter??0,lastRound:round,
 }};
}
/** Change only private fields that exist on these real historical outcomes. */
function poisonPrivateAuthority(round:SliceCombatRound):void{
 const outcome=round.ancientAlchemistOutcome??round.coffinBearerOutcome??round.barrenMatriarchOutcome!;
 outcome.source.runId='PRIVATE-INHERITED-AUTHORITY';
 if(round.barrenMatriarchOutcome){
  round.barrenMatriarchOutcome.source.randomSeed='PRIVATE-INHERITED-RANDOM';round.barrenMatriarchOutcome.source.randomCursor=987654;
  round.barrenMatriarchOutcome.randomCursorAfter=987655;
  for(const action of [...round.barrenMatriarchOutcome.playerActions,...round.barrenMatriarchOutcome.enemyActions]){
   action.randomCursorBefore=987654;action.randomCursorAfter=987655;
  }
 }
}
it('keeps actual955 private roots and every allowed inherited outcome fact while omitting stream internals',()=>{
 const state=authenticMotherPredecessor(),hash=motherHash(state),random=structuredClone(state.random),view=projectSliceState(state);
 expect(motherPublicLeaks(view)).toEqual([]);expect(JSON.stringify(view)).not.toContain(state.random.seed);
 expect(view).toMatchObject({health:40,mind:83,spirituality:114,cash:255,actionsRemaining:3,pollution:0});
 expect(view.progression.mastery).toEqual(state.progression.mastery);expect(view.injuries).toHaveLength(4);
 for(const key of inheritedKeys){
  const rounds=state.combatHistory.map((round,index)=>({round,index})).filter(({round})=>round[key]);
  expect(rounds.length).toBeGreaterThan(0);
  for(const {round,index}of rounds)expect(view.combatHistory[index]).toEqual(projectPlayerText(inheritedRoundFacts(round),state.character.name));
 }
 expect(view.lastCombatRound).toEqual(view.combatHistory.at(-1));
 expect(motherHash(state)).toBe(hash);expect(state.random).toEqual(random);assertMotherSourceUnmodified();
},60_000);
it('closes all three actual inherited round entrances and their combat panels without losing resources, positions or check explanations',()=>{
 const state=authenticMotherPredecessor(),hash=motherHash(state),random=structuredClone(state.random);
 for(const key of inheritedKeys){
  const index=state.combatHistory.findIndex(round=>round[key]?.playerActions.length);
  expect(index).toBeGreaterThanOrEqual(0);
  const round=state.combatHistory[index]!,expected=projectPlayerText(inheritedRoundFacts(round),state.character.name);
  const current=atAllRoundEntrances(state,round),currentHash=motherHash(current),view=projectSliceState(current);
  expect(view.combatHistory[index]).toEqual(expected);expect(view.lastCombatRound).toEqual(expected);expect(view.combat!.lastRound).toEqual(expected);
  expect(motherPublicLeaks(view)).toEqual([]);
  if(key==='ancientAlchemistOutcome'){
   const {source,...facts}=projectAncientAlchemistCombat(current);
   expect(view.combat!.ancientAlchemist).toEqual(projectPlayerText(facts,state.character.name));expect(view.combat!.ancientAlchemist).not.toHaveProperty('source');
  }else if(key==='coffinBearerOutcome'){
   const {source,...facts}=projectCoffinBearerCombat(current);
   expect(view.combat!.coffinBearer).toEqual(projectPlayerText(facts,state.character.name));expect(view.combat!.coffinBearer).not.toHaveProperty('source');
  }else{
   const {lastActionSequence,...facts}=projectBarrenMatriarchCombat(current);
   expect(view.combat!.barrenMatriarch).toEqual(projectPlayerText({...facts,lastActionSequence:lastActionSequence.map(({randomCursorBefore,randomCursorAfter,...action})=>action)},state.character.name));
  }
  expect(motherHash(current)).toBe(currentHash);

  const poisonedRound=structuredClone(round);poisonPrivateAuthority(poisonedRound);
  const poisoned=atAllRoundEntrances({...state,combatHistory:state.combatHistory.map((r,i)=>i===index?poisonedRound:r)},poisonedRound);
  const poisonedHash=motherHash(poisoned),publicPoisoned=projectSliceState(poisoned);
  expect(publicPoisoned.combatHistory[index]).toEqual(expected);expect(publicPoisoned.lastCombatRound).toEqual(expected);expect(publicPoisoned.combat!.lastRound).toEqual(expected);
  expect(motherPublicLeaks(publicPoisoned)).toEqual([]);expect(JSON.stringify(publicPoisoned)).not.toContain('PRIVATE-INHERITED-');
  expect(motherHash(poisoned)).toBe(poisonedHash);expect(poisoned.random).toEqual(random);
 }
 const checked=structuredClone(state.combatHistory.find(round=>round.barrenMatriarchOutcome?.playerActions.some(action=>action.check))!);
 const action=checked.barrenMatriarchOutcome!.playerActions.find(a=>a.check)!;
 action.check={...action.check!,modifiers:[{source:'Actual resolved check explanation',value:0}]};
 const withModifier=atAllRoundEntrances({...state,combatHistory:[checked]},checked),modifierHash=motherHash(withModifier);
 const expected=projectPlayerText(inheritedRoundFacts(checked),state.character.name),view=projectSliceState(withModifier);
 expect(view.combatHistory[0]).toEqual(expected);expect(view.lastCombatRound).toEqual(expected);expect(view.combat!.lastRound).toEqual(expected);
 expect(view.lastCombatRound!.barrenMatriarchOutcome!.playerActions.find(a=>a.check)!.check!.modifiers).toEqual(action.check.modifiers);
 expect(view.combat!.barrenMatriarch!.lastActionSequence.find(a=>a.actor==='PLAYER'&&a.order===action.order)?.check?.modifiers).toEqual(action.check.modifiers);
 expect(motherPublicLeaks(view)).toEqual([]);expect(motherHash(withModifier)).toBe(modifierHash);
 expect(motherHash(state)).toBe(hash);expect(state.random).toEqual(random);assertMotherSourceUnmodified();
},60_000);
