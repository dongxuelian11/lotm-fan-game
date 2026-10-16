import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/soother-v0780/shared-${name.replace('soother-','')}.json`,'utf8')));
describe('soother actual shared route',()=>{
 it('retains original earlier stages and finite S6 reports',()=>{
  const s=read('soother-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.soother.promotionWeek).toBeGreaterThanOrEqual(s.nightmare.promotionWeek!+12);
  expect(s.soother.nightmareActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.soother.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
 });
 it.each(['promotion','refusal','open','close','report','combat'])('replays %s from its exact original boundary',key=>{
  const b=read(`soother-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('preserves the original resistance and separately paid later attempt',()=>{
  const b=read('soother-refusal-save-boundary');expect(b.final.soother.cases['echo-at-wall'].status).toBe('OBSERVED');
  expect(b.final.spirituality).toBe(b.beforeLast.spirituality-3);
  const s=read('soother-stage-natural').practiced as SliceState;
  expect(s.soother.cases['echo-at-wall']!.revised).toBe(true);
  expect(s.soother.cases['echo-at-wall']!.closes).toBeGreaterThanOrEqual(2);
 });
 it('ends actual contact without returning costs and permits normal life after exit',()=>{
  const b=read('soother-close-save-boundary');expect(projectSliceState(b.beforeLast).soother.insideCase).toBe(true);
  expect(projectSliceState(b.final).soother.insideCase).toBe(false);
  expect(()=>applySliceIntent(b.beforeLast,{type:'ACTION',action:'WORK'})).toThrow();
  expect(b.final.spirituality).toBeGreaterThanOrEqual(0);
 });
 it('keeps the original nightmare encounter separate from current control state',()=>{
  const c=read('soother-stage-natural');expect(c.final.nightmare.encounter).toEqual(c.combatStart.nightmare.encounter);
  expect(c.final.soother.encounter.pressure).toBe(0);expect(c.final.soother.encounter.dreamLocked).toBe(false);
  expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
 });
 it('migrates full prior PotionProfessor save preserving all original materials and bottles',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/potion-professor-v0770/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.soother.promotionWeek).toBeNull();
  expectPriorFields(current,old);
 });
});
