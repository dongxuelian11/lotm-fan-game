import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createDoorState } from '../../src/domain/door/index.js';
import { openDoorRuntimeSession } from '../../src/domain/door/owned-session.js';
import { DOOR_FROZEN_SOURCE_KEYS } from '../../src/domain/door/source.js';
import type { DoorCommand } from '../../src/domain/door/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { readObjectEntry } from './read-object-entry.js';
export const DOOR_SOURCE_FILE='tests/fixtures/star-key-v01960/natural.json';
export const DOOR_SOURCE_SHA='d9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d';
export const DOOR_CONTROLLED_SEED='secrets-sorcerer-directed-24';
export const DOOR_CONTROLLED_CURSOR=205;
export const doorScenarioHash=(v:unknown)=>createHash('sha256').update(stableStringify(v)).digest('hex');
export const doorInheritedHash=(s:SliceState)=>doorScenarioHash({...Object.fromEntries(DOOR_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])),world:s.world,combatHistory:s.combatHistory});
export function assertUnmodifiedDoorInput(){expect(createHash('sha256').update(readFileSync(DOOR_SOURCE_FILE)).digest('hex')).toBe(DOOR_SOURCE_SHA);}
export function authenticDoorSource():SliceState {
 assertUnmodifiedDoorInput();expect(readObjectEntry<unknown[]>(DOOR_SOURCE_FILE,'commands')).toHaveLength(823);
 const raw=readObjectEntry<SliceState>(DOOR_SOURCE_FILE,'final'),hash=doorScenarioHash(raw),s=migrateSliceState(raw);
 expect(hash).toBe('56ecbdddfdbfa82116aa8ea466d4195be0b98e4ccbcc49bea07f3f2cabfd1a5b');
 expect(doorScenarioHash(raw)).toBe(hash);
 for(const[k,v]of Object.entries(raw))if(!['schemaVersion','contentVersion'].includes(k))expect(doorScenarioHash(s[k as keyof SliceState]),`Changed old ${k}`).toBe(doorScenarioHash(v));
 expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
 expect(s).toMatchObject({revision:1131,week:218,status:'ACTIVE',health:80,mind:98,spirituality:120,cash:3900,actionsRemaining:3,injuryRisk:1,progression:{pathwayId:'door',sequence:1,acting:100},random:{seed:DOOR_CONTROLLED_SEED,cursor:205}});
 expect(s.injuries.map(i=>[i.severity,i.treatedRevision])).toEqual([['LIGHT',null],['LIGHT',null]]);
 expect(Object.keys(s.progression.mastery)).toHaveLength(17);expect(Object.values(s.progression.mastery).filter(v=>v===0)).toHaveLength(8);
 expect(s.starKey.promotionWeek).toBe(208);expect(s.starKey.bottles.map(b=>b.outcome)).toEqual(['FAILURE','SUCCESS',null]);expect(s.starKey.resupply).toEqual({requestedWeek:null,deliveries:0});
 expect(s.door).toEqual(createDoorState());assertValidSliceState(s);return s;
}
export function doorPublicLeaks(view:unknown):string[]{
 const forbidden=new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest','originalWorldDigest','combatHistoryDigest','originalsDigest','acquisitionDigest','compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId','custodianActorId','preparationRoll']);
 const result:string[]=[];const visit=(v:unknown,path:string)=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){const p=`${path}.${k}`,oldNull=k==='actorId'&&x===null&&['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(p);if(forbidden.has(k)&&!oldNull||k==='source'&&x!==null&&typeof x==='object')result.push(p);visit(x,p);}};visit(view,'$');return result;
}
export function assertDoorPublicBoundary(view:SliceProjection,s:SliceState){expect(doorPublicLeaks(view)).toEqual([]);const text=JSON.stringify(view);expect(text.includes(s.random.seed)).toBe(false);if(s.door.source){expect(text.includes(s.door.source.actorId)).toBe(false);expect(text.includes(s.door.source.historyDigest)).toBe(false);}}
/** Controls only this new d100 in a labeled test. Original source and later draws remain genuine. */
export function installControlledDoorPromotion(roll=1){
 const original=DeterministicActionRandomStream.prototype.nextInt,substituted:{cursorBefore:number;cursorAfter:number;actual:number;controlled:number}[]=[];
 const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){const before=this.cursor,actual=original.call(this,min,max);if(this.seed===DOOR_CONTROLLED_SEED&&before===DOOR_CONTROLLED_CURSOR&&min===1&&max===100){substituted.push({cursorBefore:before,cursorAfter:this.cursor,actual,controlled:roll});return roll;}return actual;});return{substituted,restore:()=>spy.mockRestore()};
}
export interface ControlledDoorSuccess {source:SliceState;guided:SliceState;beforeConsume:SliceState;success:SliceState;commands:DoorCommand[]}
export function controlledDoorSuccess(control:ReturnType<typeof installControlledDoorPromotion>):ControlledDoorSuccess{
 const source=authenticDoorSource(),old=doorInheritedHash(source),guided=applySliceIntent(source,{type:'DOOR',command:{type:'LEARN_GUIDANCE'}});
 const session=openDoorRuntimeSession(guided),commands:DoorCommand[]=[{type:'LEARN_GUIDANCE'}];let state=guided,beforeConsume:SliceState|undefined;
 while(state.progression.sequence!==0){const panel=session.projectDoor(),a=panel.actions.find(x=>x.preferredAction);if(commands.length>260||!a?.enabled)throw Error(`Door prepared route stopped ${JSON.stringify({last:commands.slice(-5),week:state.week,cash:state.cash,ap:state.actionsRemaining,location:state.door.frame?.location,command:a?.command,reason:a?.reason,advice:panel.nextStep})}`);
  if(a.command.type==='CONSUME')beforeConsume=state;
  const draft=session.prepare({type:'DOOR',command:a.command},state.revision);expect(session.inspect().revision).toBe(state.revision);session.commit(draft);state=session.snapshot();commands.push(structuredClone(a.command));expect(state.status).toBe('ACTIVE');expect(doorInheritedHash(state)).toBe(old);
 }
 expect(beforeConsume).toBeDefined();expect(control.substituted.length).toBeGreaterThan(0);expect(state.random).toEqual({seed:DOOR_CONTROLLED_SEED,cursor:206});expect(state.door.journal.at(-1)!.randomReceipts[0]!.check.chance).toBe(70);assertValidSliceState(state);assertUnmodifiedDoorInput();return{source,guided,beforeConsume:beforeConsume!,success:state,commands};
}
export {projectSliceState};
