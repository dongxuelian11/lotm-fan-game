import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createMotherState } from '../../src/domain/mother/index.js';
import { motherSourceBlock, MOTHER_FROZEN_SOURCE_KEYS } from '../../src/domain/mother/source.js';
import { openMotherRuntimeSession, type MotherRuntimeSession } from '../../src/domain/mother/owned-session.js';
import type { MotherCommand } from '../../src/domain/mother/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from './read-object-entry.js';
export { hermitPublicLeaks as motherPublicLeaks } from './hermit-scenario.js';
export const MOTHER_SOURCE_FILE='tests/fixtures/nature-walker-v02070/natural.json';
export const MOTHER_SOURCE_SHA='620cd1a94fd3a4c89abf6359c8126a564383bee51dc6fdfbd2442e4cca67916c';
export const motherHash=(v:unknown)=>createHash('sha256').update(stableStringify(v)).digest('hex');
export const motherInheritedHash=(s:SliceState)=>motherHash({...Object.fromEntries(MOTHER_FROZEN_SOURCE_KEYS.map(k=>[k,s[k]])),world:s.world,combatHistory:s.combatHistory});
export function assertMotherSourceUnmodified(){expect(createHash('sha256').update(readFileSync(MOTHER_SOURCE_FILE)).digest('hex')).toBe(MOTHER_SOURCE_SHA);}
/** The actual full955 living terminal, never the earlier S2 prefix or a recreated history. */
export function authenticMotherPredecessor():SliceState{
 assertMotherSourceUnmodified();const s=migrateSliceState(readObjectEntry<unknown>(MOTHER_SOURCE_FILE,'final'));
 expect(s).toMatchObject({revision:956,week:228,status:'ACTIVE',health:40,mind:83,spirituality:114,cash:255,actionsRemaining:3,injuryRisk:3,
  random:{seed:'cultivator-natural-v069',cursor:349},progression:{pathwayId:'mother',sequence:1,acting:100},natureWalker:{promotionWeek:221,life:{rootPad:{integrity:5}}}});
 expect(s.injuries.filter(i=>i.severity==='HEAVY')).toHaveLength(2);expect(s.injuries.filter(i=>i.severity==='LIGHT')).toHaveLength(2);
 expect(s.natureWalker.life.site!.samples.map(p=>[p.id,p.vitality])).toEqual([['CB3-LIVE-1',47],['CB3-LIVE-2',47],['CB3-DRY-1',0]]);
 expect(s.mother).toEqual(createMotherState());return s;
}
/** Control only future checks. Original955 recorded rolls and all old evidence remain exact. */
export function controlledMotherRolls(rolls:Readonly<Record<number,number>>={}){
 const original=DeterministicActionRandomStream.prototype.nextInt;
 const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){
  const at=this.cursor,actual=original.call(this,min,max);return this.seed==='cultivator-natural-v069'&&at>=349&&min===1&&max===100?rolls[at]??1:actual;
 });return()=>spy.mockRestore();
}
export function executeMother(session:MotherRuntimeSession,command:MotherCommand):SliceState{
 const draft=session.prepare({type:'MOTHER',command},session.inspect().revision);session.commit(draft);return session.snapshot();
}
/** Paid real commands heal H40/two heavy/two light, maintain work and five real
 * weeks, carry the original plants, and prepare the actual dose. No state edits. */
export function preparedMotherScenario(){
 const source=authenticMotherPredecessor();expect(motherSourceBlock(source)).toBeNull();
 const guided=applySliceIntent(source,{type:'MOTHER',command:{type:'LEARN_GUIDANCE'}}),session=openMotherRuntimeSession(guided);
 const commands:MotherCommand[]=[{type:'LEARN_GUIDANCE'}];
 for(let n=0;n<240;n++){
  const state=session.snapshot(),action=session.projectMother().actions.find(a=>a.preferredAction);
  if(action?.command.type==='CONSUME'){
   expect(action.enabled).toBe(true);expect(action.label).toContain('70%');expect(state.health).toBeGreaterThanOrEqual(80);expect(state.injuries).toEqual([]);
   expect(state.week-source.natureWalker.promotionWeek!).toBeGreaterThanOrEqual(12);
   return {source,guided,beforeConsume:state,session,commands};
  }
  if(!action?.enabled)throw Error(`Mother route blocked ${JSON.stringify({week:state.week,ap:state.actionsRemaining,cash:state.cash,health:state.health,location:state.mother.frame?.location,action,last:commands.slice(-8)})}`);
  executeMother(session,action.command);commands.push(structuredClone(action.command));
 }
 throw Error('Mother paid route exceeded240 actual continuation commands.');
}
