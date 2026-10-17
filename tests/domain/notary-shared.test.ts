import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/notary-v0810/shared-${name.replace('notary-','')}.json`,'utf8')));
describe('notary actual shared route',()=>{
 it('retains original prior routes and actual six-material promotion',()=>{
  const s=read('notary-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.notary.promotionWeek).toBeGreaterThanOrEqual(s.sunpriest.promotionWeek!+12);
  expect(s.notary.sunpriestActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.notary.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.notary.contract).toMatchObject({active:false,tool:'TABLE',fulfilled:true});
  expect(projectSliceState(s).maxSpirituality).toBe(80);
  const b=s.notary.batches.filter(b=>b.brewed);expect(b.length).toBeGreaterThan(0);
  for(const batch of b){expect(batch.materials).toHaveLength(6);expect(batch.materials.every(m=>m.quantity===0&&m.holder==='CONSUMED')).toBe(true);}
 });
 it.each(['promotion','brew','sign','contract','return','combat'])('replays %s from its exact original boundary',key=>{
  const b=read(`notary-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('preserves actual refusal without binding or free casting',()=>{
  const b=read('notary-refusal-save-boundary');expect(b.final.spirituality).toBe(b.beforeLast.spirituality-3);
  expect(b.final.notary.contract.active).toBe(false);expect(b.final.notary.cases['rejected-terms'].revised).toBe(false);
  expect(b.final.notary.cases['rejected-terms'].contactOpen).toBe(true);
  expect(b.final.progression.acting).toBe(b.beforeLast.progression.acting);
  expect(()=>applySliceIntent(b.final,{type:'ACTION',action:'WORK'})).toThrow();
 });
 it('only borrows after the separately accepted actual contract and returns the same tool',()=>{
  const signed=read('notary-sign-save-boundary');expect(signed.beforeLast.notary.contract.signed).toBe(false);
  expect(signed.final.notary.contract).toMatchObject({signed:true,active:false,tool:'TABLE'});
  const b=read('notary-contract-save-boundary');expect(b.final.notary.contract).toMatchObject({signed:true,active:true,tool:'PLAYER'});
  expect(projectSliceState(b.final).town.items.find(i=>i.id==='NT6-MEASURE-1')).toMatchObject({owner:'BORROWED',quantity:1});
  expect(()=>applySliceIntent(b.final,{type:'ACTION',action:'WORK'})).toThrow();
  const r=read('notary-return-save-boundary');expect(r.final.notary.contract).toMatchObject({active:false,tool:'TABLE',fulfilled:true});
  expect(projectSliceState(r.final).town.items.some(i=>i.id==='NT6-MEASURE-1')).toBe(false);
 });
 it('keeps the actual new opponent separate from the old carrier and its tool',()=>{
  const c=read('notary-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);expect(c.final.notary.contract).toEqual(c.combatStart.notary.contract);
 });
 it('migrates complete prior wind-blessed save keeping actual flight and terminal history',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/wind-blessed-v0800/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.notary.promotionWeek).toBeNull();
  const{notary:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;expectPriorFields(current,old);
 });
});
