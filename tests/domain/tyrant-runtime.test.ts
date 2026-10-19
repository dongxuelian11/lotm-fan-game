import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as predecessor from '../../src/domain/thunder-god/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { createTyrantState, applyTyrantCommand, applyOwnedTyrantCommand, openTyrantOwnedHead, projectOwnedTyrant,
  ownedTyrantCommandBlock, validateTyrantState, assertOwnedTyrantCurrent, selectTyrantPreferredAction } from '../../src/domain/tyrant/index.js';
import { validateTyrantCommand, getTyrantPromotionStabilityPreview, tyrantCurrentGates, tyrantSeaTravel, type TyrantOwnedEngine } from '../../src/domain/tyrant/engine.js';
import { tyrantSourceBlock } from '../../src/domain/tyrant/source.js';
import { TYRANT_WORKSHOP } from '../../src/domain/tyrant/content.js';
import { TYRANT_LABOUR_IDS, type TyrantAction, type TyrantCommand } from '../../src/domain/tyrant/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { actualFailedTyrantSource, componentSource } from './tyrant-material-fixtures.js';

/** Isolated current-runtime tests. The predecessor admission is explicitly
 * mocked and componentSource uses scripted old checks and synthetic body gaps.
 * These cases do not establish valid full-history saves or a natural victory. */
let admission: ReturnType<typeof vi.spyOn>, oldLock: ReturnType<typeof vi.spyOn>, oldPractice: ReturnType<typeof vi.spyOn>;
let random: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
 admission=vi.spyOn(predecessor,'validateThunderGodState').mockReturnValue(true);
 oldLock=vi.spyOn(predecessor,'hasThunderGodLock').mockReturnValue(false);
 oldPractice=vi.spyOn(predecessor,'hasThunderGodOldPractice').mockReturnValue(false);
 const original=DeterministicActionRandomStream.prototype.nextInt;
 random=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min:number,max:number){
  original.call(this,min,max); return min===1&&max===100?30:min;
 });
});
afterAll(()=>{admission.mockRestore();oldLock.mockRestore();oldPractice.mockRestore();random.mockRestore();});

function harness() {
 const state=componentSource(1,'SUPPLIER');state.tyrant=createTyrantState();state.week+=12;state.date=addGameWeeks(state.date,12);
 state.progression.acting=100;state.thunderGod.life.reflected=true;
 for(const c of Object.values(state.thunderGod.life.cases)){c.status='RESOLVED';c.returned=true;c.contactOpen=false;}
 state.weeklyBudget=3;state.actionsRemaining=3;state.cash=5000;state.health=100;state.mind=100;state.spirituality=120;state.seer.pollution=0;
 state.injuries=[];state.injuryRisk=0;state.activeEvent=null;state.combat=null;state.eventQueue=[];state.pulse='NONE';
 applyTyrantCommand(state,{type:'LEARN_GUIDANCE'},{note(){}} as never);state.revision++;
 let head=openTyrantOwnedHead(state);
 const run=(command:TyrantCommand)=>{expect(ownedTyrantCommandBlock(state,command,head)).toBeNull();head=applyOwnedTyrantCommand(state,command,{note(){}} as never,head);state.revision++;return state;};
 const next=()=>run({type:'NEXT_WEEK'});
 const act=(command:TyrantCommand)=>{if(state.actionsRemaining===0)next();return run(command);};
 const move=(to:string)=>{if(state.tyrant.frame!.location!==to)act({type:'TRAVEL',to});};
 const coast=(id:'north'|'east'|'south')=>{
  move(`TYRANT0-${id.toUpperCase()}`);act({type:'COAST',command:{type:'SURVEY',coastId:id}});
  if(state.actionsRemaining===0)next();run({type:'COAST',command:{type:'ASK_PERMISSION',coastId:id}});
  run({type:'COAST',command:{type:'FULFILL',coastId:id}});run({type:'COAST',command:{type:'RETURN_TO_HARBOR',coastId:id}});
  next();act({type:'COAST',command:{type:'REVIEW_NEXT_WEEK',coastId:id}});run({type:'COAST',command:{type:'RETURN_TO_HARBOR',coastId:id}});
 };
 const material=(command:Extract<TyrantCommand,{type:'MATERIAL'}>['command'])=>act({type:'MATERIAL',command});
 const prepareMaterials=()=>{
  move('TY0-SUPPLIER');
  for(const bottleId of ['thunder-god-potion-2','thunder-god-potion-3'] as const){
   for(const taskId of TYRANT_LABOUR_IDS)material({type:'MATERIAL_LABOUR',bottleId,taskId});
   if(state.actionsRemaining===0)next();const cash=state.cash;material({type:'ACQUIRE_CHARACTERISTIC',bottleId});
   expect(state.cash).toBe(cash-1100);
  }
  material({type:'BUY_COMPOUND',batchId:'tyrant-carrier-1'});move('TY0-ARCHIVE');material({type:'VERIFY_UNIQUENESS',step:'CHAIN'});move('TY0-VAULT');
  if(state.actionsRemaining<2)next();material({type:'VERIFY_UNIQUENESS',step:'VACANCY'});material({type:'ACQUIRE_UNIQUENESS'});
 };
 return {state,run,act,next,move,coast,material,prepareMaterials,get head(){return head;}};
}

describe('Tyrant isolated host, current gates and strict owned runtime',()=>{
 it.each([
  ['resource shortage',{type:'TRAVEL',to:'TYRANT0-SOUTH'},'实际海程需60便士、1行动与一整周。'],
  ['actual later week',{type:'COAST',command:{type:'REVIEW_NEXT_WEEK',coastId:'north'}},'须下一真实周才可复核。'],
  ['permanent refusal',{type:'COAST',command:{type:'ASK_PERMISSION',coastId:'north'}},'胁迫造成的服从不等于信仰，此原人群不再签订本次晋升契约。'],
 ] as const)('keeps %s on the real disabled goal instead of recommending an endless work/week loop',(_label,command,reason)=>{
  const goal:TyrantAction={id:'goal',label:'实际目标',cost:'实际成本',enabled:false,reason,command:command as TyrantCommand};
  const alternatives:TyrantAction[]=[goal,...(['WORK','NEXT_WEEK'] as const).map(type=>({id:type,label:type,cost:'实际费用',enabled:true,reason:null,command:{type}}))];
  expect(selectTyrantPreferredAction(alternatives,goal.command)).toBe(goal);
  expect(selectTyrantPreferredAction(alternatives,goal.command)?.reason).toBe(reason);
  expect(selectTyrantPreferredAction(alternatives,null)).toBeUndefined();
 });
 it('denies genuine boundary701 S2 entry without modifying its three actual failed originals',()=>{
  const s=actualFailedTyrantSource(),before=stableStringify(s);
  expect(s).toMatchObject({week:169,health:93,mind:85,spirituality:120,cash:210,actionsRemaining:2,status:'ACTIVE',progression:{sequence:2}});
  expect(s.thunderGod.bottles).toHaveLength(3);expect(s.thunderGod.bottles.every(b=>b.outcome==='FAILURE')).toBe(true);
  expect(tyrantSourceBlock(s)).not.toBeNull();expect(stableStringify(s)).toBe(before);
 });
 it('accepts only exact commands and actual ocean routes, never remote foot teleports',()=>{
  expect(validateTyrantCommand({type:'CONSUME',compoundId:'x',confirmed:true})).toBe(true);
  for(const command of [{type:'CONSUME',compoundId:'x',confirmed:true,seed:'x'},{type:'CHALLENGE',command:{type:'BEGIN',won:true}},{type:'COAST',command:{type:'FULFILL',coastId:'north',population:270000}},{type:'TRAVEL',to:'unknown'}])expect(validateTyrantCommand(command)).toBe(false);
  expect(tyrantSeaTravel('TYRANT0-NORTH',TYRANT_WORKSHOP)).toBe(false);
  expect(tyrantSeaTravel('TYRANT0-NORTH','TYRANT0-SOUTH')).toBe(true);
  const h=harness(),before=structuredClone(h.state.tyrant.frame!);h.move('TYRANT0-SOUTH');
  const f=h.state.tyrant.frame!;expect(f.nowSecond-before.nowSecond).toBe(604800);expect(f.budget.week-before.budget.week).toBe(1);
  expect(h.state.tyrant.seaVoyages[0]).toMatchObject({cashCost:60,actions:1,from:'TYRANT0-HARBOR',to:'TYRANT0-SOUTH'});
  expect(f.budget.cash).toBeLessThanOrEqual(before.budget.cash-60);expect(f.budget.health).toBe(before.budget.health);
  expect(ownedTyrantCommandBlock(h.state,{type:'RETURN_ON_FOOT'},h.head)).not.toBeNull();
  expect(validateTyrantState(h.state)).toBe(true);
 },60000);
 it('replays exact paid actions on cold entry, rejects tamper and never trusts a forged owned token',()=>{
  const h=harness();h.act({type:'WORK'});expect(validateTyrantState(h.state)).toBe(true);
  const bad=structuredClone(h.state);bad.tyrant.journal[0]!.after.budget.cash++;expect(validateTyrantState(bad)).toBe(false);
  expect(()=>assertOwnedTyrantCurrent(h.state,{} as TyrantOwnedEngine)).toThrow();
  const detached=structuredClone(h.state);detached.tyrant.frame!.budget.cash++;expect(()=>assertOwnedTyrantCurrent(detached,h.head)).toThrow();
  const p=projectOwnedTyrant(h.state,h.head),text=JSON.stringify(p);
  expect(text).not.toContain(h.state.random.seed);expect(text).not.toContain('cursor');expect(text).not.toContain('sourceDigest');expect(text).not.toContain('compoundDigest');
  expect(Object.keys(p).sort()).toEqual(['abilities','actions','guidanceKnown','insideCase','nextStep','promoted','resources','risk','sections','story','title']);
 },60000);
 it('binds paid preparation to physically present original residents, current gates and exact dose, with real0AP consumption',()=>{
  const h=harness();h.prepareMaterials();h.coast('north');h.coast('south');h.coast('east');
  h.move('TYRANT0-SUN-CHALLENGE');h.act({type:'CHALLENGE',command:{type:'BEGIN'}});
  for(const type of ['WORK','REST','NEXT_WEEK'] as const)expect(ownedTyrantCommandBlock(h.state,{type},h.head)).not.toBeNull();
  while(h.state.tyrant.challenge!.position<60)h.run({type:'CHALLENGE',command:{type:'WITHDRAW'}});
  h.run({type:'CHALLENGE',command:{type:'BREAK_CONTACT'}});h.move(TYRANT_WORKSHOP);
  while(h.state.health<90||h.state.mind<78||h.state.injuries.length){if(h.state.injuries.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null))h.act({type:'CLINIC'});else h.act({type:'REST'});}
  expect(tyrantCurrentGates(h.state.tyrant).ready).toBe(true);h.material({type:'COMPOSE_POTION',batchId:'tyrant-carrier-1'});
  const id=h.state.tyrant.materials!.compounds[0]!.id;
  expect(ownedTyrantCommandBlock(h.state,{type:'CONSUME',compoundId:id,confirmed:true},h.head)).not.toBeNull();
  if(h.state.actionsRemaining===0)h.next();const before=structuredClone(h.state.tyrant.frame!);
  h.run({type:'STABILIZE_PROMOTION',compoundId:id});const ready=structuredClone(h.state),f=ready.tyrant.frame!;
  expect(f.budget.cash).toBe(before.budget.cash-150);expect(f.budget.actions).toBe(before.budget.actions-1);
  expect(f.budget.spirituality).toBe(before.budget.spirituality-10);expect(f.budget.mind).toBe(before.budget.mind-8);expect(f.nowSecond-before.nowSecond).toBe(600);
  expect(ready.tyrant.promotionStability.preparations[0]!.attendees).toHaveLength(12);
  expect(ready.tyrant.assembly!.members.every(m=>m.position===0)).toBe(true);
  expect(getTyrantPromotionStabilityPreview(ready.tyrant,id)).toMatchObject({prepared:true,preparedChance:72});
  const expired=structuredClone(ready.tyrant);expired.coasts!.coasts[0]!.cohorts[0]!.believes=false;
  expect(getTyrantPromotionStabilityPreview(expired,id).prepared).toBe(false);
  const absent=structuredClone(ready.tyrant);absent.assembly!.members[0]!.position=12;
  expect(getTyrantPromotionStabilityPreview(absent,id).prepared).toBe(false);
  const beforeConsume=structuredClone(h.state);h.run({type:'CONSUME',compoundId:id,confirmed:true});
  expect(h.state.progression.sequence).toBe(0);expect(h.state.actionsRemaining).toBe(beforeConsume.actionsRemaining);
  expect(h.state.mind).toBe(beforeConsume.mind-12);expect(h.state.tyrant.promotionStability.preparations[0]!.status).toBe('SPENT');
  expect(h.state.tyrant.materials!.characteristics.every(c=>c.holder==='FUSED')).toBe(true);
  expect(validateTyrantState(h.state)).toBe(true);
 },120000);
});
