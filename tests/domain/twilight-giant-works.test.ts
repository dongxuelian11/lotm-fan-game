import { readFileSync } from 'node:fs';
import { describe,it,expect } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createTwilightWorks, applyTwilightWorks, twilightWorksBlock, twilightWorksVerifiedPassages, twilightWorksPreparationFacts, validateTwilightWorksState, twilightWorksCurrentOriginals } from '../../src/domain/twilight-giant/works.js';
import { createTwilightEpilogue, applyTwilightEpilogue, twilightEpilogueBlock, twilightEpilogueCheck, validateTwilightEpilogueState, type TwilightEpilogueCommand } from '../../src/domain/twilight-giant/epilogue.js';
import type { TwilightWorksHost, TwilightWorksCommand } from '../../src/domain/twilight-giant/works-types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
const source=JSON.parse(readFileSync('tests/fixtures/divine-hand-v01980/snapshot-recoveredBeforeEncounter.json','utf8')) as SliceState;
/** Component-only host; not a legal complete campaign or source admission. */
function localWorks(){
 let state=createTwilightWorks(source,{actorId:'unit-actor',sourceDigest:'a'.repeat(64),nowSecond:36000});
 const host:TwilightWorksHost={actorId:'unit-actor',sourceDigest:'a'.repeat(64),location:'GL2-REPAIR-ROOM',status:'ACTIVE',sequence:1,eventId:'unit:730',revision:730,week:175,nowSecond:36000,actions:20,cash:1000,health:100,mind:100,spirituality:120,coreStats:{...source.character.coreStats},mastery:{...source.progression.mastery},check:null};
 const take=(c:TwilightWorksCommand)=>{const r=applyTwilightWorks(state,c,host);state=r.state;host.actions-=r.effect.actions;host.cash-=r.effect.cashCost;host.nowSecond+=r.effect.seconds;host.revision++;host.eventId=`unit:${host.revision}`;return r;};
 return{get state(){return state;},host,take};
}
function completeWorks(){
 const x=localWorks();for(const type of ['SURVEY','WALK_RETURN_ROUTE','REST_OUTSIDE','APPROACH'] as const)x.take({type});
 for(const segment of ['A','B'] as const){x.take({type:'BUY_SUPPORT',segment});x.take({type:'FIT_SUPPORT',segment});}
 x.take({type:'REPAIR_BEAM_JOINT'});x.take({type:'RETREAT'});
 for(const workerId of ['TG220-MARA','TG220-OSRIC'] as const){x.take({type:'ASK_WORKER',workerId});x.take({type:'ARRIVE_WORKER',workerId});x.take({type:'APPROACH'});for(const segment of ['A','B'] as const)x.take({type:'CROSS_SEGMENT',workerId,segment});x.take({type:'SAFE_EXIT',workerId});x.take({type:'RETREAT'});}
 x.take({type:'REVIEW'});return x;
}
function localEpilogue(){
 const x=completeWorks(),host={...x.host,sequence:0,health:100,mind:100,spirituality:150};let state=createTwilightEpilogue(x.state,{actorId:host.actorId,week:host.week,nowSecond:host.nowSecond});
 const take=(command:TwilightEpilogueCommand,roll?:number)=>{const descriptor=twilightEpilogueCheck(state,command,host);host.check=descriptor?resolveNormalCheck({...descriptor,roll:roll??1}):null;const r=applyTwilightEpilogue(state,command,host);state=r.state;host.actions-=r.effect.actions;host.cash-=r.effect.cashCost;host.health-=r.effect.health;host.mind-=r.effect.mind;host.spirituality-=r.effect.spirituality;host.nowSecond+=r.effect.seconds;host.revision++;host.eventId=`unit:${host.revision}`;host.check=null;return r;};
 take({type:'REST_OUTSIDE'});take({type:'BUY_REPLACEMENT_SUPPORT'});for(const workerId of ['TG220-MARA','TG220-OSRIC'] as const)take({type:'ASK_WORKER',workerId});take({type:'ARRIVE_FAR_SIDE'});take({type:'TRY_CART_RETURN'});
 return{get state(){return state;},host,take};
}
describe('Twilight bridge component invariants (not a campaign provenance test)',()=>{
 it('keeps all old bodies and consumables; actual full paid two-passages cost90 and5AP',()=>{
  const x=completeWorks();expect(x.host.cash).toBe(910);expect(x.host.actions).toBe(15);expect(twilightWorksVerifiedPassages(x.state)).toHaveLength(2);expect(twilightWorksPreparationFacts(x.state)).not.toBeNull();expect(validateTwilightWorksState(x.state)).toBe(true);
  const current=twilightWorksCurrentOriginals(x.state);expect(current.site.celia).toEqual(source.glory.life.site.celia);expect(current.site.evan).toEqual(source.glory.life.site.evan);expect(current.site.armor).toEqual(source.glory.life.site.armor);expect(current.site.pads).toEqual(source.glory.life.site.pads);expect(current.site.load).toEqual(source.glory.life.site.load);expect(x.state.supports.every(s=>s.passagesRemaining===0)).toBe(true);
 });
 it('permits real zeroAP zeroCash exits afterwithdrawal without asserting full passage',()=>{
  const x=localWorks();x.take({type:'SURVEY'});x.take({type:'WALK_RETURN_ROUTE'});x.take({type:'ASK_WORKER',workerId:'TG220-MARA'});x.take({type:'ARRIVE_WORKER',workerId:'TG220-MARA'});x.take({type:'APPROACH'});x.take({type:'WITHDRAW_CONSENT',workerId:'TG220-MARA'});x.host.actions=0;x.host.cash=0;
  expect(twilightWorksBlock(x.state,{type:'CROSS_SEGMENT',workerId:'TG220-MARA',segment:'A'},x.host)).not.toBeNull();x.take({type:'SAFE_EXIT',workerId:'TG220-MARA'});expect(x.state.position).toBe(2);x.take({type:'RETREAT'});expect(x.state.position).toBe(-2);expect(twilightWorksVerifiedPassages(x.state)).toEqual([]);
 });
 it('rejects local journal corruption and each command-supplied result',()=>{const x=completeWorks(),bad=structuredClone(x.state);bad.traversals[0]!.supportId='invented';expect(validateTwilightWorksState(bad)).toBe(false);expect(twilightWorksBlock(x.state,{type:'REVIEW',result:'SUCCESS'} as unknown as TwilightWorksCommand,x.host)).not.toBeNull();});
 it('requires actual beam contact then realinstallation and only actual axleapplication grants8',()=>{
  const x=localEpilogue(),before={...x.host};x.take({type:'CONTACT_BEAM'});x.take({type:'GIANT_CONTACT_HOLD'},1);expect(x.state.giant.applied).toBe(false);const hold=x.take({type:'FIT_BRACE_IN_WINDOW'});expect(hold.masteryGains).toEqual({'warrior.s0.giant-contact-hold':8});
  x.take({type:'OBSERVE_AXLE'});x.take({type:'TWILIGHT_AXLE_EASING'},1);const easing=x.take({type:'APPLY_TWILIGHT'});expect(easing.masteryGains).toEqual({'warrior.s0.twilight-axle-easing':8});expect(x.state.cart.axle).toMatchObject({remainingPush:4,strain:3,jammed:true});expect(x.host.actions).toBe(before.actions-2);expect(x.host.spirituality).toBe(before.spirituality-26);expect(x.host.mind).toBe(before.mind-11);
  x.take({type:'STEP_TO_CART'});x.take({type:'PUSH_CART'});expect(x.state.cart.position).toBe(2);expect(x.state.workers.every(w=>w.position===2)).toBe(true);x.take({type:'ORDINARY_EXIT'});expect(x.state.workers.every(w=>w.position===-2)).toBe(true);expect(validateTwilightEpilogueState(x.state)).toBe(true);
 });
 it('chargesfailedattempts,keeps injuries and supports paid ordinaryfallback',()=>{
  const x=localEpilogue(),cash=x.host.cash;x.take({type:'CONTACT_BEAM'});const fail=x.take({type:'GIANT_CONTACT_HOLD'},100);expect(fail.effect).toMatchObject({actions:1,spirituality:14,mind:6,health:14});expect(fail.injuries[0]!.severity).toBe('HEAVY');expect(x.state.beam.integrity).toBe(51);expect(x.state.giant.applied).toBe(false);
  const shore=x.take({type:'ORDINARY_SHORE'});expect(shore.masteryGains).toEqual({});expect(x.host.cash).toBe(cash);x.take({type:'STEP_TO_CART'});x.take({type:'PUSH_CART'});x.take({type:'ORDINARY_EXIT'});expect(x.state.cart.integrity).toBe(65);expect(x.state.playerInjuries).toHaveLength(1);
 });
 it('invalidates giantwindow on any unrelatedaction and stale observed axlewindow',()=>{
  const x=localEpilogue();x.take({type:'CONTACT_BEAM'});x.take({type:'GIANT_CONTACT_HOLD'},1);x.take({type:'WAIT_20'});expect(twilightEpilogueBlock(x.state,{type:'FIT_BRACE_IN_WINDOW'},x.host)).not.toBeNull();x.take({type:'OBSERVE_AXLE'});x.take({type:'WAIT_20'});expect(twilightEpilogueBlock(x.state,{type:'TWILIGHT_AXLE_EASING'},x.host)).not.toBeNull();
 });
 it('onlyplayerwithdrawal leavesworkersinside until a real cashless exit',()=>{const x=localEpilogue();x.host.cash=0;x.host.actions=0;x.take({type:'WITHDRAW'});expect(x.state.position).toBe(-2);expect(x.state.workers.every(w=>w.position===8)).toBe(true);x.take({type:'ORDINARY_EXIT'});expect(x.state.workers.every(w=>w.position===-2)).toBe(true);expect(x.state.cart.axle.jammed).toBe(true);});
});
