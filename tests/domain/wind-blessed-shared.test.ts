import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/wind-blessed-v0800/shared-${name.replace('wind-blessed-','')}.json`,'utf8')));
describe('wind blessed actual shared route',()=>{
 it('retains earlier actual routes and the finite completed return',()=>{
  const s=read('wind-blessed-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.windBlessed.promotionWeek).toBeGreaterThanOrEqual(s.navigator.promotionWeek!+12);
  expect(s.windBlessed.navigatorActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.windBlessed.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.windBlessed.flight.position).toBe('GROUND');expect(s.windBlessed.flight.ascents).toBe(1);
  expect(s.windBlessed.flight.flightReturns+s.windBlessed.flight.stairReturns).toBe(1);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
 });
 it.each(['promotion','flight','return','close','report','combat'])('replays %s from its original boundary',key=>{
  const b=read(`wind-blessed-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('does not let ordinary WORK or report silently return from the actual platform',()=>{
  const b=read('wind-blessed-flight-save-boundary'),s=b.final as SliceState;
  expect(s.windBlessed.flight.position).toBe('LOW_PLATFORM');expect(s.spirituality).toBe(b.beforeLast.spirituality-3);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  expect(()=>applySliceIntent(s,{type:'WIND_BLESSED',command:{type:'REPORT',caseId:'low-platform'}})).toThrow();
  expect(()=>applySliceIntent(s,{type:'WIND_BLESSED',command:{type:'CLOSE',caseId:'low-platform'}})).toThrow();
  const after=applySliceIntent(s,{type:'WIND_BLESSED',command:{type:'CLOSE',caseId:'low-platform',returnMethod:'STAIRS'}});
  expect(after.windBlessed.flight.position).toBe('GROUND');expect(after.windBlessed.flight.stairReturns).toBe(1);
  expect(after.actionsRemaining).toBeGreaterThanOrEqual(s.actionsRemaining);expect(after.spirituality).toBeGreaterThanOrEqual(s.spirituality);
  expect(projectSliceState(after).windBlessed.insideCase).toBe(false);
 });
 it('keeps combat as its own adult and preserves prior carrier and ordinary tool facts',()=>{
  const c=read('wind-blessed-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);expect(c.final.windBlessed.flight).toEqual(c.combatStart.windBlessed.flight);
 });
 it('migrates complete prior Polymath save without changing its actual injuries and death',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/polymath-v0790/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.windBlessed.promotionWeek).toBeNull();
  expectPriorFields(current,old);
 });
});
