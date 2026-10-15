import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/priest-of-light-v01030/shared-${name.replace('priest-of-light-','')}.json`,'utf8')));
describe('Priest of Light actual shared route',()=>{
 it('retains all original Sun histories and completes original ice rite',()=>{
  const c=read('priest-of-light-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.priestOfLight.notaryActingAtPromotion).toBe(100);
  for(const key of ['bard','lightprayer','sunpriest','notary'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).notary.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['sun.s5.holy-light','sun.s5.purification-aura']);expect(projectSliceState(s).priestOfLight.abilities).toHaveLength(oldIds.length+2);
  expect(s.priestOfLight.ritual.location).toBe('GUIDE');expect(s.priestOfLight.ritual.darkness).toBe(false);
  expect(s.priestOfLight.ritual.history.every(r=>r.entered&&r.returned)).toBe(true);
  expect(s.priestOfLight.practice.lanternPosition).toBe('NEAR');expect(s.priestOfLight.practice.spiritDistressed).toBe(false);expect(s.priestOfLight.practice.auraOpen).toBe(false);
  expect(Object.values(s.priestOfLight.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['brew','enter','promotion','exit','return','move-lantern','prepare','effect','close','return-lantern','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`priest-of-light-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('consumes exactly one real six-material batch into its original bottle',()=>{
  const b=read('priest-of-light-brew-save-boundary'),old=b.beforeLast as SliceState,after=b.final as SliceState,id=b.lastIntent.command.batchId;
  const batch=after.priestOfLight.batches.find(x=>x.id===id)!;
  expect(batch.materials).toHaveLength(6);expect(batch.materials.every(x=>x.holder==='CONSUMED')).toBe(true);
  const bottle=after.priestOfLight.bottles.at(-1)!;expect(bottle.inputIds).toEqual(batch.materials.map(x=>x.id));expect(bottle.batchId).toBe(id);
  expect(after.priestOfLight.bottles.length).toBe(old.priestOfLight.bottles.length+1);expect(()=>applySliceIntent(after,b.lastIntent)).toThrow();
 });
 it('requires actual ice and darkness at independent original-bottle confirmation',()=>{
  const b=read('priest-of-light-promotion-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.priestOfLight.ritual.location).toBe('ICE');expect(s.priestOfLight.ritual.darkness).toBe(true);expect(s.priestOfLight.ritual.nonMeltingIce).toBe(true);
  const returned=applySliceIntent(s,{type:'PRIEST_OF_LIGHT',command:{type:'END_RITUAL'}});
  expect(()=>applySliceIntent(returned,b.lastIntent)).toThrow();
  expect(returned.priestOfLight.bottles.find(x=>x.id===b.lastIntent.command.bottleId)?.status).toBe('PREPARED');
 });
 it('retains original first-case body when the optional independent scene ends',()=>{
  const c=read('priest-of-light-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('PRIEST_OF_LIGHT_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
 });
 it('migrates 0.102 without changing prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/ocean-singer-v01020/natural.json','utf8')).final;
  const after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(176);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  expect(migrateSliceState(after)).toEqual(after);
 });
});
