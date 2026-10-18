import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createTwilightGiantState } from '../../src/domain/twilight-giant/index.js';
import { openTwilightGiantRuntimeSession, type TwilightGiantRuntimeSession } from '../../src/domain/twilight-giant/owned-session.js';
import { TWILIGHT_GIANT_FROZEN_SOURCE_KEYS } from '../../src/domain/twilight-giant/source.js';
import type { TwilightGiantCommand } from '../../src/domain/twilight-giant/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
export const TWILIGHT_SOURCE_FILE='tests/fixtures/divine-hand-v01980/snapshot-recoveredBeforeEncounter.json';
export const TWILIGHT_SOURCE_SHA='eb9bc7d243a5ffd4704a0d8047c66cf27acbe69dcc447c6075e6b738d057828d';
export const twilightHash=(v:unknown)=>createHash('sha256').update(stableStringify(v)).digest('hex');
export const twilightInheritedHash=(s:SliceState)=>twilightHash({...Object.fromEntries(TWILIGHT_GIANT_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])),world:s.world,combatHistory:s.combatHistory});
export function assertTwilightSourceUnmodified(){expect(createHash('sha256').update(readFileSync(TWILIGHT_SOURCE_FILE)).digest('hex')).toBe(TWILIGHT_SOURCE_SHA);}
export function authenticTwilightSource():SliceState {
 assertTwilightSourceUnmodified();const raw=JSON.parse(readFileSync(TWILIGHT_SOURCE_FILE,'utf8')) as SliceState,s=migrateSliceState(raw);
 expect(s).toMatchObject({revision:729,week:175,status:'ACTIVE',health:100,mind:100,spirituality:120,cash:845,actionsRemaining:2,progression:{pathwayId:'warrior',sequence:1,acting:100},random:{seed:'warrior-natural-v042',cursor:481}});
 expect(s.divineHand.promotionWeek).toBe(167);expect(s.glory.life.site).toMatchObject({playerEnergy:29,playerLocation:'OUTSIDE',armor:{integrity:55},pads:{remaining:0},load:{remainingLoads:0},celia:{energy:56,location:'OUTSIDE'},evan:{energy:58,location:'OUTSIDE'}});
 expect(s.divineHand.bottles.map(b=>b.outcome)).toEqual(['FAILURE','SUCCESS',null]);expect(s.twilightGiant).toEqual(createTwilightGiantState());expect(twilightInheritedHash(s)).toBe(twilightInheritedHash(raw));return s;
}
export const executeTwilight=(session:TwilightGiantRuntimeSession,command:TwilightGiantCommand)=>{
 const draft=session.prepare({type:'TWILIGHT_GIANT',command},session.inspect().revision);session.commit(draft);return session.snapshot();
};
export function preparedTwilightScenario(){
 const source=authenticTwilightSource(),guided=applySliceIntent(source,{type:'TWILIGHT_GIANT',command:{type:'LEARN_GUIDANCE'}}),session=openTwilightGiantRuntimeSession(guided),commands:TwilightGiantCommand[]=[{type:'LEARN_GUIDANCE'}];
 for(let i=0;i<260;i++){
  const panel=session.projectTwilightGiant(),action=panel.actions.find(a=>a.preferredAction),state=session.snapshot();
  if(action?.command.type==='CONSUME'){expect(action.enabled).toBe(true);expect(action.cost).toContain('70%');return{source,guided,beforeConsume:state,session,commands};}
  if(!action?.enabled)throw Error(`Twilight route blocked ${JSON.stringify({week:state.week,cash:state.cash,ap:state.actionsRemaining,location:state.twilightGiant.frame?.location,action,last:commands.slice(-8)})}`);
  executeTwilight(session,action.command);commands.push(structuredClone(action.command));
 }
 throw Error('Twilight paid preparation route did not reach a genuine ready compound within260 commands.');
}
/** Test-only new d100 seam. Original history and random advancement remain real. */
export function controlledTwilightRolls(rolls:Readonly<Record<number,number>>){
 const original=DeterministicActionRandomStream.prototype.nextInt;
 const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){const cursor=this.cursor,actual=original.call(this,min,max);return this.seed==='warrior-natural-v042'&&min===1&&max===100&&Object.hasOwn(rolls,cursor)?rolls[cursor]!:actual;});
 return ()=>spy.mockRestore();
}
/** These old public references name actual on-screen bodies, never chapter admission identity. */
export function twilightPublicPhysicalActor(path:string,value:unknown):boolean {
 const resident=value===null||value==='GL2-CELIA'||value==='GL2-EVAN';
 if(/^\$\.(?:divineHand|glory)\.(?:life\.(?:site|currentAttempt\.siteAt(?:Start|Close)|cases\.\d+\.attempts\.\d+\.siteAt(?:Start|Close)|ledger\.\d+\.originals(?:Before|After)\.site)|encounter\.(?:site|startSite))\.guard\.actorId$/.test(path))return resident;
 if(/^\$\.glory\.life\.(?:currentAttempt|cases\.\d+\.attempts\.\d+)\.actorId$/.test(path))return resident;
 return /^\$\.glory\.life\.(?:currentAttempt|cases\.\d+\.attempts\.\d+)\.(?:playerMoves|actorMoves)\.\d+\.actorId$/.test(path)&&(value==='PLAYER'||value==='GL2-CELIA'||value==='GL2-EVAN');
}
export function twilightPublicLeaks(view:unknown):string[]{
 const forbidden=new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest','originalWorldDigest','combatHistoryDigest','originalsDigest','acquisitionDigest','compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId','custodianActorId','preparationRoll']);
 const errors:string[]=[];const visit=(v:unknown,path:string)=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){const p=`${path}.${k}`,physicalActor=k==='actorId'&&twilightPublicPhysicalActor(p,x);if(forbidden.has(k)&&!physicalActor||k==='source'&&x!==null&&typeof x==='object')errors.push(p);visit(x,p);}};visit(view,'$');return errors;
}
/** Caller keeps controlledTwilightRolls({481:1}) active through cold validation. */
export function controlledTwilightSuccess(){
 const prepared=preparedTwilightScenario();
 const command:TwilightGiantCommand={type:'CONSUME',compoundId:prepared.beforeConsume.twilightGiant.materials!.compounds[0]!.id,confirmed:true};
 const success=executeTwilight(prepared.session,command);expect(success.progression.sequence).toBe(0);
 return{...prepared,success,commands:[...prepared.commands,command]};
}
