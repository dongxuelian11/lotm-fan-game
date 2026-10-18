import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { openDeathRuntimeSession } from '../../src/domain/death/owned-session.js';
import { DEATH_FROZEN_SOURCE_KEYS } from '../../src/domain/death/source.js';
import type { DeathCommand } from '../../src/domain/death/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { readObjectEntry } from './read-object-entry.js';

export const DEATH_SOURCE_FILE='tests/fixtures/pale-emperor-v01950/natural.json';
export const DEATH_SOURCE_SHA='14be49645e7fa18b4127c7ec34b39875eff1302fbba8052b9037ed149a42d66c';
export const DEATH_CONTROLLED_SEED='corpsecollector-natural-v032';
export const DEATH_CONTROLLED_CURSOR=490;
export const deathScenarioHash=(value:unknown)=>createHash('sha256').update(stableStringify(value)).digest('hex');
export const deathInheritedHash=(s:SliceState)=>deathScenarioHash({...Object.fromEntries(DEATH_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])),world:s.world,combatHistory:s.combatHistory});
export function assertUnmodifiedDeathInput(){expect(createHash('sha256').update(readFileSync(DEATH_SOURCE_FILE)).digest('hex')).toBe(DEATH_SOURCE_SHA);}
export function authenticDeathSource():SliceState {
  assertUnmodifiedDeathInput();expect(readObjectEntry<unknown[]>(DEATH_SOURCE_FILE,'commands')).toHaveLength(1038);
  const raw=readObjectEntry<SliceState>(DEATH_SOURCE_FILE,'final'), hash=deathScenarioHash(raw),s=migrateSliceState(raw);
  expect(hash).toBe('171748e310a3f2f52f96d710d01610fa3aa296e516e87fe29f2d0ca7d1709276');
  expect(deathScenarioHash(raw)).toBe(hash);
  for(const [key,value]of Object.entries(raw))if(!['schemaVersion','contentVersion'].includes(key))expect(deathScenarioHash(s[key as keyof SliceState]),`Changed old ${key}`).toBe(deathScenarioHash(value));
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  expect(s).toMatchObject({revision:1039,week:3323,status:'ACTIVE',health:50,mind:100,spirituality:120,cash:36,actionsRemaining:1,injuryRisk:2,progression:{pathwayId:'death',sequence:1,acting:100},random:{seed:DEATH_CONTROLLED_SEED,cursor:490}});
  expect(s.injuries.map(i=>[i.severity,i.treatedRevision])).toEqual([['HEAVY',null],['LIGHT',null],['LIGHT',null]]);
  expect(Object.keys(s.progression.mastery)).toHaveLength(19);expect(Object.values(s.progression.mastery).filter(x=>x===0)).toHaveLength(7);
  expect(s.paleEmperor.promotionWeek).toBe(3317);expect(s.paleEmperor.bottles.map(b=>b.outcome)).toEqual(['FAILURE','FAILURE','SUCCESS']);
  expect(s.paleEmperor.resupply).toEqual({requestedWeek:null,deliveries:0});
  expect(s.death).toEqual(createDeathState());assertValidSliceState(s);return s;
}
export function deathPublicLeaks(view:unknown):string[]{
  const forbidden=new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest','originalWorldDigest','combatHistoryDigest','originalsDigest','acquisitionDigest','compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId','custodianActorId','preparationRoll']);
  const result:string[]=[];const visit=(v:unknown,path:string)=>{if(!v||typeof v!=='object')return;for(const[key,value]of Object.entries(v)){const p=`${path}.${key}`;const oldNullGuard=key==='actorId'&&value===null&&['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(p);if(forbidden.has(key)&&!oldNullGuard||key==='source'&&value!==null&&typeof value==='object')result.push(p);visit(value,p);}};visit(view,'$');return result;
}
export function assertDeathPublicBoundary(view:SliceProjection,s:SliceState){expect(deathPublicLeaks(view)).toEqual([]);const json=JSON.stringify(view);expect(json.includes(s.random.seed)).toBe(false);if(s.death.source){expect(json.includes(s.death.source.actorId)).toBe(false);expect(json.includes(s.death.source.historyDigest)).toBe(false);}}
/** Only this new promotion draw is controlled; source and later draws always
 * execute the original RNG. Reopening the controlled test needs this same seam. */
export function installControlledDeathPromotion(roll=1){
  const original=DeterministicActionRandomStream.prototype.nextInt;
  const substituted:{cursorBefore:number;cursorAfter:number;actual:number;controlled:number}[]=[];
  const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){const before=this.cursor,actual=original.call(this,min,max);if(this.seed===DEATH_CONTROLLED_SEED&&before===DEATH_CONTROLLED_CURSOR&&min===1&&max===100){substituted.push({cursorBefore:before,cursorAfter:this.cursor,actual,controlled:roll});return roll;}return actual;});
  return {substituted,restore:()=>spy.mockRestore()};
}
export interface ControlledDeathSuccess {source:SliceState;guided:SliceState;beforeConsume:SliceState;success:SliceState;commands:DeathCommand[]}
export function controlledDeathSuccess(control:ReturnType<typeof installControlledDeathPromotion>):ControlledDeathSuccess{
  const source=authenticDeathSource(),old=deathInheritedHash(source),guided=applySliceIntent(source,{type:'DEATH',command:{type:'LEARN_GUIDANCE'}});
  const session=openDeathRuntimeSession(guided),commands:DeathCommand[]=[{type:'LEARN_GUIDANCE'}];let state=guided,beforeConsume:SliceState|undefined;
  while(state.progression.sequence!==0){const panel=session.projectDeath(),a=panel.actions.find(x=>x.preferredAction);if(commands.length>240||!a?.enabled)throw Error(`Death prepared route stopped ${JSON.stringify({last:commands.slice(-5),week:state.week,cash:state.cash,ap:state.actionsRemaining,location:state.death.frame?.location,command:a?.command,reason:a?.reason,advice:panel.nextStep})}`);
    if(a.command.type==='CONSUME')beforeConsume=state;
    const draft=session.prepare({type:'DEATH',command:a.command},state.revision);expect(session.inspect().revision).toBe(state.revision);session.commit(draft);state=session.snapshot();commands.push(structuredClone(a.command));expect(state.status).toBe('ACTIVE');expect(deathInheritedHash(state)).toBe(old);
  }
  expect(beforeConsume).toBeDefined();expect(control.substituted.length).toBeGreaterThan(0);expect(state.random).toEqual({seed:DEATH_CONTROLLED_SEED,cursor:491});expect(state.death.journal.at(-1)!.randomReceipts[0]!.check.chance).toBe(70);assertValidSliceState(state);assertUnmodifiedDeathInput();return {source,guided,beforeConsume:beforeConsume!,success:state,commands};
}
export { projectSliceState };
