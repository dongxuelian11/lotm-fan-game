import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { projectDarkAngel } from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_CASE_IDS } from '../../src/domain/dark-angel/life.js';
import { createHangedManState } from '../../src/domain/hanged-man/index.js';
import { openHangedManRuntimeSession, type HangedManRuntimeSession } from '../../src/domain/hanged-man/owned-session.js';
import { HANGED_MAN_FROZEN_SOURCE_KEYS } from '../../src/domain/hanged-man/source.js';
import type { HangedManCommand } from '../../src/domain/hanged-man/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { prepareDarkAngelOriginalRecovery } from './hanged-man-predecessor.js';
import { da, ready } from '../domain/dark-angel-directed-helper.js';
export { hermitPublicLeaks as hangedManPublicLeaks } from './hermit-scenario.js';
export const HANGED_MAN_SOURCE_FILE='tests/fixtures/dark-angel-v02010/boundary-consume-dark-angel-potion-3.json';
export const HANGED_MAN_SOURCE_SHA='c550a22334fe0fbeab0927dfef8c6ee6ed0937a45ce5e6d4506bd0755045e4ef';
export const hangedManHash=(v:unknown)=>createHash('sha256').update(stableStringify(v)).digest('hex');
export const hangedManInheritedHash=(s:SliceState)=>hangedManHash({...Object.fromEntries(HANGED_MAN_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])),world:s.world,combatHistory:s.combatHistory});
export function assertHangedManSourceUnmodified(){expect(createHash('sha256').update(readFileSync(HANGED_MAN_SOURCE_FILE)).digest('hex')).toBe(HANGED_MAN_SOURCE_SHA);}
export function authenticHangedManPredecessor(){assertHangedManSourceUnmodified();const raw=JSON.parse(readFileSync(HANGED_MAN_SOURCE_FILE,'utf8')).final as SliceState;const s=migrateSliceState(raw);expect(s).toMatchObject({revision:724,week:178,status:'ACTIVE',health:85,mind:75,spirituality:120,cash:168,actionsRemaining:1,seer:{pollution:30},random:{seed:'secret-supplicant-natural-v051',cursor:356},progression:{sequence:2}});expect(s.hangedMan).toEqual(createHangedManState());return s;}
export function controlledHangedManRolls(rolls:Readonly<Record<number,number>>={}){const original=DeterministicActionRandomStream.prototype.nextInt;const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){const at=this.cursor,actual=original.call(this,min,max);return this.seed==='secret-supplicant-natural-v051'&&at>=356&&min===1&&max===100?rolls[at]??1:actual;});return()=>spy.mockRestore();}
export function executeHangedMan(session:HangedManRuntimeSession,command:HangedManCommand){const draft=session.prepare({type:'HANGED_MAN',command},session.inspect().revision);session.commit(draft);return session.snapshot();}
/** Only public actions from the genuine three-failure checkpoint. Future rolls
 * are controlled by the caller; no manufactured budget, scene or inventory. */
export function preparedHangedManScenario(){
 const predecessor=authenticHangedManPredecessor(),predecessorCommands:SliceIntent[]=[];
 let s=prepareDarkAngelOriginalRecovery({source:predecessor,commands:predecessorCommands});
 s=da(s,{type:'CONSUME',bottleId:s.darkAngel.bottles.at(-1)!.id,confirmed:true},predecessorCommands);
 if(s.progression.sequence!==1)throw Error('Controlled S1 recovery did not promote.');
 for(const caseId of DARK_ANGEL_CASE_IDS){
  s=ready(s,{ap:2,cash:100,health:100,mind:100,spirituality:120,pollution:0,healed:true},predecessorCommands);
  s=da(s,{type:'OBSERVE',caseId},predecessorCommands);
  for(let n=0;s.darkAngel.life.cases[caseId].status!=='EXAMINED';n++){
   if(n>=70)throw Error(`S1 case did not close: ${caseId}`);
   const action=projectDarkAngel(s).life.actions.find(a=>a.enabled&&a.preferredAction);
   if(!action)throw Error(`No actual S1 preferred action for ${caseId}`);
   s=da(s,action.command,predecessorCommands);
  }
  s=da(ready(s,{},predecessorCommands),{type:'REPORT',caseId},predecessorCommands);
 }
 s=da(ready(s,{},predecessorCommands),{type:'REFLECT'},predecessorCommands);
 s=ready(s,{ap:2,cash:350,health:100,mind:100,spirituality:120,pollution:0},predecessorCommands);
 const source=s,guided=applySliceIntent(source,{type:'HANGED_MAN',command:{type:'LEARN_GUIDANCE'}}),session=openHangedManRuntimeSession(guided),commands:HangedManCommand[]=[{type:'LEARN_GUIDANCE'}];
 for(let n=0;n<320;n++){
  const state=session.snapshot(),action=session.projectHangedMan().actions.find(a=>a.preferredAction);
  if(action?.command.type==='CONSUME'){expect(action.enabled).toBe(true);expect(action.label).toContain('70%');return {predecessor,predecessorCommands,source,guided,beforeConsume:state,session,commands};}
  if(!action?.enabled)throw Error(`Hanged Man route blocked ${JSON.stringify({week:state.week,ap:state.actionsRemaining,cash:state.cash,location:state.hangedMan.frame?.location,scene:state.hangedMan.scene,action,last:commands.slice(-8)})}`);
  executeHangedMan(session,action.command);commands.push(structuredClone(action.command));
 }
 throw Error('Hanged Man paid route exceeded320 actual commands.');
}
