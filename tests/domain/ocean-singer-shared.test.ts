import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/ocean-singer-v01020/shared-${name.replace('ocean-singer-','')}.json`,'utf8')));
describe('Ocean Singer actual shared route',()=>{
 it('retains prior Sailor histories and original paid rite',()=>{
  const c=read('ocean-singer-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.oceanSinger.windBlessedActingAtPromotion).toBe(100);
  for(const key of ['sailor','rager','navigator','windBlessed'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).windBlessed.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['tyrant.s5.sea-song','tyrant.s5.shallow-lightning','tyrant.s5.deep-water-activity']);
  expect(projectSliceState(s).oceanSinger.abilities).toHaveLength(oldIds.length+3);
  expect(s.oceanSinger.ritual.location).toBe('DOCK');expect(s.oceanSinger.ritual.waterFilm).toBe(false);
  expect(s.oceanSinger.ritual.history.every(r=>r.entered&&r.returned)).toBe(true);
  expect(s.oceanSinger.practice.allyPosition).toBe('NEAR');expect(s.oceanSinger.practice.allyAffected).toBe(false);expect(s.oceanSinger.practice.songOpen).toBe(false);
  expect(Object.values(s.oceanSinger.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['enter','promotion','exit','return','move-ally','prepare','effect','close','return-ally','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`ocean-singer-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('requires the actual original belly and film for original-bottle consumption',()=>{
  const b=read('ocean-singer-promotion-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.oceanSinger.ritual.location).toBe('BELLY');expect(s.oceanSinger.ritual.waterFilm).toBe(true);
  const returned=applySliceIntent(s,{type:'OCEAN_SINGER',command:{type:'EXIT_RITUAL'}});
  expect(()=>applySliceIntent(returned,b.lastIntent)).toThrow();
  expect(returned.oceanSinger.bottles.find(x=>x.id===b.lastIntent.command.bottleId)?.status).toBe('PLAYER');
 });
 it('finishes travel after promotion without refund or remote return',()=>{
  const b=read('ocean-singer-return-save-boundary'),s=b.beforeLast as SliceState,after=b.final as SliceState;
  expect(s.oceanSinger.ritual.location).toBe('COAST');expect(after.oceanSinger.ritual.location).toBe('DOCK');
  expect(after.cash).toBeLessThanOrEqual(s.cash);expect(after.oceanSinger.ritual.history.at(-1)?.returned).toBe(true);
 });
 it('keeps the original optional opponent separate from the first case',()=>{
  const c=read('ocean-singer-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('OCEAN_SINGER_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
 });
 it('migrates 0.101 without changing any previous original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/mysticism-magister-v01010/natural.json','utf8')).final;
  const after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(174);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  expect(migrateSliceState(after)).toEqual(after);
 });
});
