import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createVisionaryEra } from '../../src/domain/visionary/era.js';
import { visionaryBudget } from '../../src/domain/visionary/source.js';
import { createVisionaryEpilogue,applyVisionaryEpilogue,visionaryEpilogueBlock } from '../../src/domain/visionary/epilogue.js';
import type { SliceState } from '../../src/domain/slice/types.js';
const setup=()=>{const s=JSON.parse(readFileSync('tests/fixtures/writer-v01880/snapshot-practiced.json','utf8')) as SliceState,b=visionaryBudget(s);b.sequence=0;b.acting=0;
  b.mastery['audience.s0.bounded-support']=0;b.mastery['audience.s0.finite-guidance']=0;
  return {b,ep:createVisionaryEpilogue(createVisionaryEra(s.runId,s.week).epilogueOrigin,{eventId:'actual-scene',week:s.week,revision:700})};};
const check=(roll:number)=>resolveNormalCheck({ability:'will',baseAbility:32,difficulty:45,modifiers:[{source:'本人本次有限施术',value:23}],roll});
describe('Visionary finite original relay rescue',()=>{
  it('starts both skills at zero and applies one paid window to original people and objects',()=>{
    let {b,ep}=setup();const ids=structuredClone({patients:ep.patients.map(p=>p.id),objects:ep.objectIds,rescuers:ep.rescuerIds});
    ep=applyVisionaryEpilogue(ep,{type:'OBSERVE'},b,{eventId:'observe',revision:701,check:null});
    ep=applyVisionaryEpilogue(ep,{type:'SUPPORT_STRUCTURE'},b,{eventId:'support',revision:702,check:check(20)});
    ep=applyVisionaryEpilogue(ep,{type:'GUIDE_RESCUER'},b,{eventId:'guide',revision:703,check:check(50)});
    expect([b.actions,b.spirituality,b.mind]).toEqual([1,98,82]);expect(check(50).chance).toBe(70);
    expect(visionaryEpilogueBlock(ep,{type:'GUIDE_RESCUER'},b)).not.toBeNull();
    ep=applyVisionaryEpilogue(ep,{type:'EVACUATE'},b,{eventId:'carry',revision:704,check:null});
    expect(ep.status).toBe('RESOLVED');expect(ep.patients.every(p=>p.status==='EVACUATED')).toBe(true);
    expect(ep.supportActive||ep.guidanceActive).toBe(false);expect({patients:ep.patients.map(p=>p.id),objects:ep.objectIds,rescuers:ep.rescuerIds}).toEqual(ids);
    ep=applyVisionaryEpilogue(ep,{type:'REPORT'},b,{eventId:'report',revision:705,check:null});
    expect(ep.reported).toBe(true);expect(b.mastery['audience.s0.bounded-support']).toBe(10);expect(b.mastery['audience.s0.finite-guidance']).toBe(10);
    expect(visionaryEpilogueBlock(ep,{type:'REPORT'},b)).not.toBeNull();
  });
  it('failed skills retain costs and original injuries while ordinary AP-zero withdrawal and report remain available',()=>{
    let {b,ep}=setup();ep=applyVisionaryEpilogue(ep,{type:'OBSERVE'},b,{eventId:'observe',revision:701,check:null});
    ep=applyVisionaryEpilogue(ep,{type:'SUPPORT_STRUCTURE'},b,{eventId:'failed',revision:702,check:check(85)});
    expect([b.spirituality,b.mind,b.health]).toEqual([108,86,90]);expect(b.injuries).toHaveLength(1);b.actions=0;
    expect(visionaryEpilogueBlock(ep,{type:'WITHDRAW'},b)).toBeNull();
    ep=applyVisionaryEpilogue(ep,{type:'WITHDRAW'},b,{eventId:'exit',revision:703,check:null});
    ep=applyVisionaryEpilogue(ep,{type:'REPORT'},b,{eventId:'report',revision:704,check:null});
    expect(ep.patients.every(p=>p.status==='SHELTERED')).toBe(true);expect(b.spirituality).toBe(108);expect(ep.reported).toBe(true);
  });
});
