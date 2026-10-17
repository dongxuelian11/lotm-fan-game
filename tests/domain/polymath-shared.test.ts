import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/polymath-v0790/shared-${name.replace('polymath-','')}.json`,'utf8')));
describe('polymath actual shared route',()=>{
 it('retains original earlier stages and only actually learned samples',()=>{
  const s=read('polymath-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.polymath.promotionWeek).toBeGreaterThanOrEqual(s.detective.promotionWeek!+12);
  expect(s.polymath.detectiveActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.polymath.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(Object.values(s.polymath.samples).every(r=>r.observedWeek!==null&&r.understoodWeek!==null&&r.learnedWeek!==null)).toBe(true);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
 });
 it.each(['promotion','analysis','open','close','report','combat'])('replays %s from its exact original boundary',key=>{
  const b=read(`polymath-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('does not automatically turn an actual observation or analysis into imitation',()=>{
  const b=read('polymath-analysis-save-boundary'),before=b.beforeLast as SliceState;
  expect(before.polymath.samples.FLASH.observedWeek).not.toBeNull();
  expect(before.polymath.samples.FLASH.understoodWeek).toBeNull();
  expect(before.polymath.samples.FLASH.learnedWeek).toBeNull();
  expect(b.final.polymath.samples.FLASH.learnedWeek).toBeNull();
  expect(b.final.progression.acting).toBe(before.progression.acting);
  expect(b.final.spirituality).toBeGreaterThanOrEqual(before.spirituality);
 });
 it('keeps the actual spell cost and must exit before ordinary life',()=>{
  const b=read('polymath-open-save-boundary');expect(b.final.spirituality).toBe(b.beforeLast.spirituality-3);
  expect(projectSliceState(b.final).polymath.insideCase).toBe(true);
  expect(()=>applySliceIntent(b.final,{type:'ACTION',action:'WORK'})).toThrow();
  const e=read('polymath-close-save-boundary');expect(projectSliceState(e.final).polymath.insideCase).toBe(false);
 });
 it('does not grant another sample through a combat roll or steal the opponent tool',()=>{
  const c=read('polymath-stage-natural');expect(c.final.polymath.samples).toEqual(c.combatStart.polymath.samples);
  expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
 });
 it('migrates full prior Soother save preserving its actual death and injuries',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/soother-v0780/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.polymath.promotionWeek).toBeNull();
  expectPriorFields(current,old);
 });
});
