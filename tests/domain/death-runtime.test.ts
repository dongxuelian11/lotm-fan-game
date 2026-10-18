import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { openDeathRuntimeSession } from '../../src/domain/death/owned-session.js';
import { deathSourceBlock, DEATH_FROZEN_SOURCE_KEYS } from '../../src/domain/death/source.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { deathServiceVerifiedReceipts } from '../../src/domain/death/services.js';
import * as predecessor from '../../src/domain/pale-emperor/index.js';
import { authenticDeathSource, controlledDeathSuccess, installControlledDeathPromotion, deathScenarioHash,
  assertDeathPublicBoundary, assertUnmodifiedDeathInput, type ControlledDeathSuccess } from '../helpers/death-scenario.js';
let seam:ReturnType<typeof installControlledDeathPromotion>,scenario:ControlledDeathSuccess;
beforeAll(()=>{seam=installControlledDeathPromotion();scenario=controlledDeathSuccess(seam);},300_000);
afterAll(()=>{try{assertUnmodifiedDeathInput();}finally{seam?.restore();}});
describe('Death original injured source and controlled complete success',()=>{
  it('keeps original three failures/success,19 masteries,old dead opponent and all ten roots',()=>{
    const {source,guided,success}=scenario;expect(guided.cash).toBe(24);expect(guided.actionsRemaining).toBe(0);expect(guided.injuries).toEqual(source.injuries);
    for(const key of DEATH_FROZEN_SOURCE_KEYS)expect(deathScenarioHash(success[key]),key).toBe(deathScenarioHash(source[key]));
    for(const[id,value]of Object.entries(source.progression.mastery))expect(success.progression.mastery[id]).toBe(value);
    expect(success.progression.mastery['death.s0.partial-spirit-passage']).toBe(0);expect(success.progression.mastery['death.s0.residual-propagation-barrier']).toBe(0);
    expect(success.paleEmperor.encounter.enemyStatus).toBe('DEAD');expect(success.death.materials!.characteristics).toHaveLength(3);
  });
  it('pays real treatment,rest,24p work,bills and two services before the same70% preparation',()=>{
    const s=scenario.success,root=s.death,events=root.journal;expect(deathServiceVerifiedReceipts(root.services!)).toHaveLength(2);expect(s.week).toBeGreaterThanOrEqual(3329);expect(s.injuries).toEqual([]);
    const clinic=events.find(e=>e.command.type==='CLINIC')!;expect(clinic.before.budget.health).toBe(50);expect(clinic.after.budget.health).toBe(50);expect(clinic.before.budget.cash-clinic.after.budget.cash).toBe(60);
    const works=events.filter(e=>e.command.type==='WORK');expect(works.length).toBeGreaterThan(0);for(const e of works)expect(e.after.economy.income-e.before.economy.income).toBe(24);
    expect(events.filter(e=>e.command.type==='REST').length).toBeGreaterThanOrEqual(6);
    expect(root.materials!.characteristics.map(x=>x.holder)).toEqual(['FUSED','FUSED','FUSED']);expect(root.materials!.uniqueness.holder).toBe('FUSED');
    const prep=events.find(e=>e.command.type==='STABILIZE_PROMOTION')!;expect(prep.before.budget.cash-prep.after.budget.cash).toBe(12);expect(prep.before.budget.spirituality-prep.after.budget.spirituality).toBe(12);expect(prep.before.budget.mind-prep.after.budget.mind).toBe(8);
  });
  it('shows true global cap and locked ordinary actions immediately, with all permitted chapter actions',()=>{
    for(const s of[scenario.guided,scenario.success]){const view=projectSliceState(s);assertDeathPublicBoundary(view,s);expect(view.canAct).toBe(false);expect(view.actionBlockedReason).toBeTruthy();expect(view.death.actions.some(a=>a.enabled)).toBe(true);expect(view.death.resources.spirituality).toBe(s.spirituality);expect(view.death.injuries.map(i=>i.severity)).toEqual(s.injuries.map(i=>i.severity));expect(view.maxSpirituality).toBe(s.progression.sequence===0?150:120);expect(view.death.resources.maxSpirituality).toBe(view.maxSpirituality);}
  },300_000);
  it('keeps hot drafts private without rerunning S1 source and rejects old ordinary actions',()=>{
    const session=openDeathRuntimeSession(scenario.success),before=deathScenarioHash(session.snapshot());const spy=vi.spyOn(predecessor,'validatePaleEmperorState');
    try{const draft=session.prepare({type:'DEATH',command:{type:'RETURN_ON_FOOT'}},scenario.success.revision);expect(spy).not.toHaveBeenCalled();expect(deathScenarioHash(session.snapshot())).toBe(before);const copy=session.snapshotDraft(draft);copy.cash=99999;expect(session.snapshotDraft(draft).cash).not.toBe(99999);session.discard(draft);expect(()=>session.commit(draft)).toThrow();expect(deathScenarioHash(session.snapshot())).toBe(before);expect(()=>session.prepare({type:'WORK'},scenario.success.revision)).toThrow();}finally{spy.mockRestore();}
  },300_000);
  it('rejects fakeS0, missing history and mutated current or old resources',()=>{
    const fake=structuredClone(scenario.source);fake.progression.sequence=0;expect(()=>assertValidSliceState(fake)).toThrow();
    const missing=structuredClone(scenario.success);missing.death=createDeathState();expect(()=>assertValidSliceState(missing)).toThrow();
    for(const mutate of[(s:typeof missing)=>{s.cash++;},(s:typeof missing)=>{s.death.frame!.budget.cash++;},(s:typeof missing)=>{s.paleEmperor.bottles[0]!.labourSteps=0;}]){const s=structuredClone(scenario.success);mutate(s);expect(()=>assertValidSliceState(s)).toThrow();}
    expect(deathSourceBlock(scenario.source)).toBe(null);
  },300_000);
});
