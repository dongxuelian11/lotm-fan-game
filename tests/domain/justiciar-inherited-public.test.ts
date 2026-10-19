import {expect,it} from 'vitest';
import {projectSliceState} from '../../src/domain/slice/index.js';
import type {SliceCombatRound,SliceState} from '../../src/domain/slice/types.js';
import {projectImperativeMageCombat} from '../../src/domain/imperative-mage/combat.js';
import {projectChaosHunterCombat} from '../../src/domain/chaos-hunter/combat.js';
import {projectBalancerCombat} from '../../src/domain/balancer/combat.js';
import {projectPlayerText} from '../../src/shared/player-text.js';
import {authenticJusticiarPredecessor,assertJusticiarSourceUnmodified,justiciarHash,justiciarPublicLeaks} from '../helpers/justiciar-scenario.js';

const inheritedKeys=['imperativeMageOutcome','chaosHunterOutcome','balancerOutcome'] as const;
/** All existing completed facts survive; only the actual replay-authority fields are private. */
function inheritedRoundFacts(round:SliceCombatRound){
 const {imperativeMageOutcome,chaosHunterOutcome,balancerOutcome,...facts}=structuredClone(round);
 const imperative=imperativeMageOutcome?(({source,...actual})=>actual)(imperativeMageOutcome):null;
 const chaos=chaosHunterOutcome?(({source,...actual})=>actual)(chaosHunterOutcome):null;
 const balancer=balancerOutcome?(({source,randomCursorAfter,playerActions,enemyActions,...actual})=>({
  ...actual,playerActions:playerActions.map(({randomCursorBefore,randomCursorAfter,...action})=>action),
  enemyActions:enemyActions.map(({randomCursorBefore,randomCursorAfter,...action})=>action),
 }))(balancerOutcome):null;
 return {...facts,...(imperative?{imperativeMageOutcome:imperative}:{}),...(chaos?{chaosHunterOutcome:chaos}:{}),...(balancer?{balancerOutcome:balancer}:{})};
}
function atAllRoundEntrances(state:SliceState,round:SliceCombatRound):SliceState{
 const outcome=round.imperativeMageOutcome??round.chaosHunterOutcome??round.balancerOutcome!;
 return {...state,lastCombatRound:round,combat:{
  encounterId:round.imperativeMageOutcome?'IMPERATIVE_MAGE_DISPUTE':round.chaosHunterOutcome?'CHAOS_HUNTER_DISPUTE':'BALANCER_DISPUTE',
  round:round.round,enemyHealth:outcome.enemyHealth,enemyMind:outcome.enemyMind,enemyStatus:outcome.enemyStatus,
  enemyInjuries:round.balancerOutcome?.enemyInjuries??round.chaosHunterOutcome?.enemyInjuriesAfter??[],
  enemyRisk:round.balancerOutcome?.enemyRisk??round.chaosHunterOutcome?.enemyRiskAfter??0,lastRound:round,
 }};
}
/** Change only private fields that exist on these real historical outcomes. */
function poisonPrivateAuthority(round:SliceCombatRound):void{
 const outcome=round.imperativeMageOutcome??round.chaosHunterOutcome??round.balancerOutcome!;
 outcome.source.runId='PRIVATE-INHERITED-AUTHORITY';
 if(round.balancerOutcome){
  round.balancerOutcome.source.randomSeed='PRIVATE-INHERITED-RANDOM';round.balancerOutcome.source.randomCursor=987654;
  round.balancerOutcome.randomCursorAfter=987655;
  for(const action of [...round.balancerOutcome.playerActions,...round.balancerOutcome.enemyActions]){
   action.randomCursorBefore=987654;action.randomCursorAfter=987655;
  }
 }
}
it('keeps actual706 private roots and every allowed inherited outcome fact while omitting stream internals',()=>{
 const state=authenticJusticiarPredecessor(),hash=justiciarHash(state),random=structuredClone(state.random),view=projectSliceState(state);
 expect(justiciarPublicLeaks(view)).toEqual([]);expect(JSON.stringify(view)).not.toContain(state.random.seed);
 expect(view).toMatchObject({health:93,mind:85,spirituality:120,cash:190,actionsRemaining:2,pollution:20});
 expect(view.progression.mastery).toEqual(state.progression.mastery);expect(view.injuries).toHaveLength(0);
 for(const key of inheritedKeys){
  const rounds=state.combatHistory.map((round,index)=>({round,index})).filter(({round})=>round[key]);
  expect(rounds.length).toBeGreaterThan(0);
  for(const {round,index}of rounds)expect(view.combatHistory[index]).toEqual(projectPlayerText(inheritedRoundFacts(round),state.character.name));
 }
 expect(view.lastCombatRound).toEqual(view.combatHistory.at(-1));
 expect(justiciarHash(state)).toBe(hash);expect(state.random).toEqual(random);assertJusticiarSourceUnmodified();
},60_000);
it('closes all three actual inherited round entrances and their combat panels without losing resources, positions or check explanations',()=>{
 const state=authenticJusticiarPredecessor(),hash=justiciarHash(state),random=structuredClone(state.random);
 for(const key of inheritedKeys){
  const index=state.combatHistory.findIndex(round=>round[key]?.playerActions.length);
  expect(index).toBeGreaterThanOrEqual(0);
  const round=state.combatHistory[index]!,expected=projectPlayerText(inheritedRoundFacts(round),state.character.name);
  const current=atAllRoundEntrances(state,round),currentHash=justiciarHash(current),view=projectSliceState(current);
  expect(view.combatHistory[index]).toEqual(expected);expect(view.lastCombatRound).toEqual(expected);expect(view.combat!.lastRound).toEqual(expected);
  expect(justiciarPublicLeaks(view)).toEqual([]);
  if(key==='imperativeMageOutcome'){
   const {source,...facts}=projectImperativeMageCombat(current);
   expect(view.combat!.imperativeMage).toEqual(projectPlayerText(facts,state.character.name));expect(view.combat!.imperativeMage).not.toHaveProperty('source');
  }else if(key==='chaosHunterOutcome'){
   const {source,...facts}=projectChaosHunterCombat(current);
   expect(view.combat!.chaosHunter).toEqual(projectPlayerText(facts,state.character.name));expect(view.combat!.chaosHunter).not.toHaveProperty('source');
  }else{
   const {lastActionSequence,...facts}=projectBalancerCombat(current);
   expect(view.combat!.balancer).toEqual(projectPlayerText({...facts,lastActionSequence:lastActionSequence.map(({randomCursorBefore,randomCursorAfter,...action})=>action)},state.character.name));
  }
  expect(justiciarHash(current)).toBe(currentHash);

  const poisonedRound=structuredClone(round);poisonPrivateAuthority(poisonedRound);
  const poisoned=atAllRoundEntrances({...state,combatHistory:state.combatHistory.map((r,i)=>i===index?poisonedRound:r)},poisonedRound);
  const poisonedHash=justiciarHash(poisoned),publicPoisoned=projectSliceState(poisoned);
  expect(publicPoisoned.combatHistory[index]).toEqual(expected);expect(publicPoisoned.lastCombatRound).toEqual(expected);expect(publicPoisoned.combat!.lastRound).toEqual(expected);
  expect(justiciarPublicLeaks(publicPoisoned)).toEqual([]);expect(JSON.stringify(publicPoisoned)).not.toContain('PRIVATE-INHERITED-');
  expect(justiciarHash(poisoned)).toBe(poisonedHash);expect(poisoned.random).toEqual(random);
 }
 const checked=structuredClone(state.combatHistory.find(round=>round.balancerOutcome?.playerActions.some(action=>action.check))!);
 const action=checked.balancerOutcome!.playerActions.find(a=>a.check)!;
 action.check={...action.check!,modifiers:[{source:'Actual resolved check explanation',value:0}]};
 const withModifier=atAllRoundEntrances({...state,combatHistory:[checked]},checked),modifierHash=justiciarHash(withModifier);
 const expected=projectPlayerText(inheritedRoundFacts(checked),state.character.name),view=projectSliceState(withModifier);
 expect(view.combatHistory[0]).toEqual(expected);expect(view.lastCombatRound).toEqual(expected);expect(view.combat!.lastRound).toEqual(expected);
 expect(view.lastCombatRound!.balancerOutcome!.playerActions.find(a=>a.check)!.check!.modifiers).toEqual(action.check.modifiers);
 expect(view.combat!.balancer!.lastActionSequence.find(a=>a.actor==='PLAYER'&&a.order===action.order)?.check?.modifiers).toEqual(action.check.modifiers);
 expect(justiciarPublicLeaks(view)).toEqual([]);expect(justiciarHash(withModifier)).toBe(modifierHash);
 expect(justiciarHash(state)).toBe(hash);expect(state.random).toEqual(random);assertJusticiarSourceUnmodified();
},60_000);
