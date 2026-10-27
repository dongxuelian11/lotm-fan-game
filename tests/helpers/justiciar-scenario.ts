import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createJusticiarState } from '../../src/domain/justiciar/index.js';
import { justiciarSourceBlock } from '../../src/domain/justiciar/source.js';
import { hasHandOfOrderLock, hasHandOfOrderOldPractice } from '../../src/domain/hand-of-order/index.js';
import { openJusticiarRuntimeSession, type JusticiarRuntimeSession } from '../../src/domain/justiciar/owned-session.js';
import { JUSTICIAR_FROZEN_SOURCE_KEYS } from '../../src/domain/justiciar/source.js';
import type { JusticiarCommand } from '../../src/domain/justiciar/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { prepareHandOfOrderOriginalRecovery } from './justiciar-predecessor.js';
import { hoo, ready, completeHandOfOrderLife } from '../domain/hand-of-order-directed-helper.js';
export { hermitPublicLeaks as justiciarPublicLeaks } from './hermit-scenario.js';
export const JUSTICIAR_SOURCE_FILE='tests/fixtures/hand-of-order-v02060/boundary-step-706-action.json';
export const JUSTICIAR_SOURCE_SHA='7cb9aa2ac25d209060582aef054f9c0fb1d8af8a77b2d071fc8feef633893f4c';
export const justiciarHash=(v:unknown)=>createHash('sha256').update(stableStringify(v)).digest('hex');
export const justiciarInheritedHash=(s:SliceState)=>justiciarHash({...Object.fromEntries(JUSTICIAR_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])),world:s.world,combatHistory:s.combatHistory});
export function assertJusticiarSourceUnmodified(){expect(createHash('sha256').update(readFileSync(JUSTICIAR_SOURCE_FILE)).digest('hex')).toBe(JUSTICIAR_SOURCE_SHA);}
export function authenticJusticiarPredecessor(){assertJusticiarSourceUnmodified();const raw=JSON.parse(readFileSync(JUSTICIAR_SOURCE_FILE,'utf8')).final as SliceState;const s=migrateSliceState(raw);expect(s).toMatchObject({revision:707,week:169,status:'ACTIVE',health:93,mind:85,spirituality:120,cash:190,actionsRemaining:2,seer:{pollution:20},random:{seed:'arbiter-natural-v066',cursor:370},progression:{sequence:2}});expect(s.justiciar).toEqual(createJusticiarState());return s;}
export function controlledJusticiarRolls(rolls:Readonly<Record<number,number>>={}){const original=DeterministicActionRandomStream.prototype.nextInt;const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){const at=this.cursor,actual=original.call(this,min,max);return this.seed==='arbiter-natural-v066'&&at>=370&&min===1&&max===100?rolls[at]??1:actual;});return()=>spy.mockRestore();}
export function executeJusticiar(session:JusticiarRuntimeSession,command:JusticiarCommand){const draft=session.prepare({type:'JUSTICIAR',command},session.inspect().revision);session.commit(draft);return session.snapshot();}
/** Only public actions from the genuine three-failure checkpoint. Future rolls
 * are controlled by the caller; no manufactured budget, scene or inventory. */
export function preparedJusticiarScenario(){
 const predecessor=authenticJusticiarPredecessor(),predecessorCommands:SliceIntent[]=[];
 let s=prepareHandOfOrderOriginalRecovery({source:predecessor,commands:predecessorCommands});
 s=hoo(s,{type:'CONSUME',bottleId:s.handOfOrder.bottles.at(-1)!.id,confirmed:true},predecessorCommands);
 if(s.progression.sequence!==1)throw Error('Controlled S1 recovery did not promote.');
 s=completeHandOfOrderLife(s,predecessorCommands);
 s=ready(s,{ap:2,cash:350,health:100,mind:100,spirituality:120,pollution:0},predecessorCommands);
 const sourceReason=justiciarSourceBlock(s);
 if(sourceReason)throw Error(JSON.stringify({reason:sourceReason,lock:hasHandOfOrderLock(s),oldLock:hasHandOfOrderOldPractice(s),combat:s.combat?.encounterId,event:s.activeEvent,queue:s.eventQueue,pulse:s.pulse,site:s.handOfOrder.life.site?.playerLocation,operation:s.handOfOrder.life.operation}));
 const source=s,guided=applySliceIntent(source,{type:'JUSTICIAR',command:{type:'LEARN_GUIDANCE'}}),session=openJusticiarRuntimeSession(guided),commands:JusticiarCommand[]=[{type:'LEARN_GUIDANCE'}];
 for(let n=0;n<320;n++){
  const state=session.snapshot(),action=session.projectJusticiar().actions.find(a=>a.preferredAction);
  if(action?.command.type==='CONSUME'){expect(action.enabled).toBe(true);expect(action.label).toContain('70%');return {predecessor,predecessorCommands,source,guided,beforeConsume:state,session,commands};}
  if(!action?.enabled)throw Error(`Justiciar route blocked ${JSON.stringify({week:state.week,ap:state.actionsRemaining,cash:state.cash,location:state.justiciar.frame?.location,scene:state.justiciar.scene,action,last:commands.slice(-8)})}`);
  executeJusticiar(session,action.command);commands.push(structuredClone(action.command));
 }
 throw Error('Justiciar paid route exceeded320 actual commands.');
}
