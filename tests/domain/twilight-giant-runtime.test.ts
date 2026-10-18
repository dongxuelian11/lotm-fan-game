import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { openTwilightGiantRuntimeSession } from '../../src/domain/twilight-giant/owned-session.js';
import { validateTwilightGiantState, validateTwilightGiantCommand, createTwilightGiantState } from '../../src/domain/twilight-giant/index.js';
import { twilightWorksVerifiedPassages, twilightWorksCurrentOriginals } from '../../src/domain/twilight-giant/works.js';
import { twilightGiantMaterialConservationBlock } from '../../src/domain/twilight-giant/materials.js';
import * as predecessor from '../../src/domain/divine-hand/index.js';
import { assertTwilightSourceUnmodified, preparedTwilightScenario, twilightInheritedHash, twilightHash, executeTwilight, controlledTwilightRolls, twilightPublicLeaks } from '../helpers/twilight-giant-scenario.js';
let scenario:ReturnType<typeof preparedTwilightScenario>;
beforeAll(()=>{scenario=preparedTwilightScenario();console.info('TWILIGHT_PAID_READY',JSON.stringify({commands:scenario.commands.length,week:scenario.beforeConsume.week,cash:scenario.beforeConsume.cash,actions:scenario.beforeConsume.actionsRemaining,naturalPromotion:false}));},300000);
afterAll(()=>assertTwilightSourceUnmodified());
describe('Twilight Giant actual living source, paid works and owned runtime',()=>{
 it('retains all nine old roots, source positions, all22masteries and zeroS1skills',()=>{
  const{source,guided,beforeConsume}=scenario;expect(guided.cash).toBe(745);expect(guided.actionsRemaining).toBe(1);expect(twilightInheritedHash(beforeConsume)).toBe(twilightInheritedHash(source));expect(beforeConsume.progression.mastery).toEqual(source.progression.mastery);
  expect(Object.keys(source.progression.mastery)).toHaveLength(22);expect(source.progression.mastery['warrior.s1.beam-stabilize']).toBe(0);expect(source.progression.mastery['warrior.s1.armor-convergence']).toBe(0);
  expect(twilightWorksCurrentOriginals(beforeConsume.twilightGiant.works!).site).toMatchObject({armor:{integrity:55},celia:{energy:56,location:'OUTSIDE'},evan:{energy:58,location:'OUTSIDE'},pads:{remaining:0},load:{remainingLoads:0}});
 });
 it('pays normalwages,living,travel and supports and earns two distinct actual safeexits',()=>{
  const s=scenario.beforeConsume,r=s.twilightGiant,w=r.works!;expect(s.week).toBeGreaterThanOrEqual(179);expect(s.cash).toBeGreaterThanOrEqual(0);expect(scenario.commands.some(c=>c.type==='WORK')).toBe(true);expect(scenario.commands.some(c=>c.type==='NEXT_WEEK')).toBe(true);
  for(const e of r.journal.filter(e=>e.command.type==='WORK'))expect(e.after.budget.cash-e.before.budget.cash).toBe(180);
  expect(r.journal.some(e=>e.financeReceipts.length>0)).toBe(true);expect(w.supports).toHaveLength(2);expect(w.supports.every(p=>p.paidPennies===24&&p.passagesRemaining===0&&p.integrity===80)).toBe(true);
  const passages=twilightWorksVerifiedPassages(w);expect(passages).toHaveLength(2);expect(new Set(passages.map(p=>p.workerId)).size).toBe(2);expect(passages.every(p=>p.segments.length===2&&!!p.safeExitEventId)).toBe(true);expect(w.workers.every(w=>w.position===-2)).toBe(true);
  expect(r.materials!.characteristics).toHaveLength(3);expect(r.materials!.batches).toHaveLength(3);expect(twilightGiantMaterialConservationBlock(r.materials!)).toBeNull();
 });
 it('keeps public commands intent-only and public views free of private evidence',()=>{
  expect(validateTwilightGiantCommand({type:'CONSUME',compoundId:'x',confirmed:true,roll:1})).toBe(false);
  expect(validateTwilightGiantCommand({type:'WORKS',command:{type:'REVIEW',receipts:[]}})).toBe(false);
  const p=scenario.session.projectTwilightGiant();expect(twilightPublicLeaks(p)).toEqual([]);expect(JSON.stringify(p)).not.toContain(scenario.source.random.seed);expect(p.resources).toMatchObject({maxHealth:100,maxMind:100,maxSpirituality:120});
 });
 it('checks the complete inherited public projection beforeguidance and afterguidance',()=>{
  for(const state of[scenario.source,scenario.guided]){const view=projectSliceState(state);const leaks=twilightPublicLeaks(view);if(leaks.length)console.info('TWILIGHT_INHERITED_PUBLIC_LEAKS',JSON.stringify(leaks));expect(leaks).toEqual([]);expect(JSON.stringify(view)).not.toContain(state.random.seed);}
 },300000);
 it('discards owned drafts without oldsource replay or stale changes',()=>{
  const session=scenario.session,before=twilightHash(session.snapshot()),spy=vi.spyOn(predecessor,'validateDivineHandState');
  try{const draft=session.prepare({type:'TWILIGHT_GIANT',command:{type:'RETURN_ON_FOOT'}},session.inspect().revision);expect(spy).not.toHaveBeenCalled();const copy=session.snapshotDraft(draft);copy.cash=999999;expect(session.snapshotDraft(draft).cash).not.toBe(999999);session.discard(draft);expect(()=>session.commit(draft)).toThrow();expect(twilightHash(session.snapshot())).toBe(before);expect(()=>session.prepare({type:'WORK'},session.inspect().revision)).toThrow();}finally{spy.mockRestore();}
 });
 it('rejects changed oldsource,current endpoint and forged journals on cold reopen',()=>{
  for(const mutate of[(s:typeof scenario.beforeConsume)=>s.cash++,(s:typeof scenario.beforeConsume)=>s.glory.life.site.armor!.integrity++,(s:typeof scenario.beforeConsume)=>s.twilightGiant.works!.workers[0]!.energy++,(s:typeof scenario.beforeConsume)=>s.twilightGiant.journal[0]!.after.budget.cash++]){const s=structuredClone(scenario.beforeConsume);mutate(s);expect(validateTwilightGiantState(s)).toBe(false);}
  const noHistory=structuredClone(scenario.source);noHistory.progression.sequence=0;noHistory.twilightGiant=createTwilightGiantState();expect(validateTwilightGiantState(noHistory)).toBe(false);
 },300000);
 it('controlled success conserves originals,sets only two new skills0 and does not refill resources',()=>{
  const restore=controlledTwilightRolls({481:1});try{const session=openTwilightGiantRuntimeSession(scenario.beforeConsume),s=executeTwilight(session,{type:'CONSUME',compoundId:scenario.beforeConsume.twilightGiant.materials!.compounds[0]!.id,confirmed:true});expect(s.progression.sequence).toBe(0);expect(s.spirituality).toBe(scenario.beforeConsume.spirituality-30);expect(s.mind).toBe(scenario.beforeConsume.mind-12);expect(s.character.coreStats.will).toBe(27);expect(s.progression.mastery['warrior.s0.giant-contact-hold']).toBe(0);expect(s.progression.mastery['warrior.s0.twilight-axle-easing']).toBe(0);expect(s.twilightGiant.materials!.characteristics.map(c=>c.holder)).toEqual(['FUSED','FUSED','FUSED']);expect(twilightGiantMaterialConservationBlock(s.twilightGiant.materials!)).toBeNull();expect(s.twilightGiant.journal.at(-1)!.randomReceipts[0]!.check.chance).toBe(70);expect(twilightInheritedHash(s)).toBe(twilightInheritedHash(scenario.source));assertValidSliceState(s);const publicView=projectSliceState(s);expect(publicView.maxSpirituality).toBe(150);const leaks=twilightPublicLeaks(publicView);if(leaks.length)console.info('TWILIGHT_S0_PUBLIC_LEAKS',JSON.stringify(leaks));expect(leaks).toEqual([]);}finally{restore();}
 },300000);
 it('controlled ordinary failure leaves embodied original inside and severe failure kills without resurrection',()=>{
  for(const roll of[80,100]){const restore=controlledTwilightRolls({481:roll});try{const session=openTwilightGiantRuntimeSession(scenario.beforeConsume),s=executeTwilight(session,{type:'CONSUME',compoundId:scenario.beforeConsume.twilightGiant.materials!.compounds[0]!.id,confirmed:true}),m=s.twilightGiant.materials!;expect(m.compounds[0]!.status).toBe(roll===80?'FAILED_EXPOSED':'DEATH_EXPOSED');expect(m.characteristics.map(c=>c.holder)).toEqual(roll===80?['EXPOSED','EMBODIED','EXPOSED']:['EXPOSED','EXPOSED','EXPOSED']);expect(twilightGiantMaterialConservationBlock(m)).toBeNull();expect(s.status).toBe(roll===80?'ACTIVE':'DEAD');if(roll===100)expect(()=>session.prepare({type:'TWILIGHT_GIANT',command:{type:'REST'}},s.revision)).toThrow();assertValidSliceState(s);}finally{restore();}}
 },300000);
});
