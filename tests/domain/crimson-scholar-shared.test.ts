import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "crimson-scholar-stage-natural": "tests/fixtures/crimson-scholar-v0990/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('Crimson Scholar actual shared route',()=>{
 it('keeps original Moon abilities, blood and assistance-potion history through the actual ritual',()=>{
  const c=read('crimson-scholar-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.crimsonScholar.potionProfessorActingAtPromotion).toBe(100);
  expect(s.crimsonScholar.promotionWeek).toBeGreaterThanOrEqual(s.potionProfessor.promotionWeek!+12);
  for(const key of ['apothecary','tamer','vampire','potionProfessor'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).potionProfessor.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['moon.s5.regional-moon','moon.s5.moonlight-step','moon.s5.moonlight-reassembly']);
  expect(projectSliceState(s).crimsonScholar.abilities).toHaveLength(oldIds.length+3);
  expect(Object.values(s.crimsonScholar.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.crimsonScholar.practice.field).toBe('NONE');expect(s.crimsonScholar.practice.location).toBe('START');
  expect(s.crimsonScholar.practice.outboundTrips).toBe(s.crimsonScholar.practice.returns);expect(s.crimsonScholar.practice.returns).toBeGreaterThan(0);
  const ritual=s.crimsonScholar.ritual;expect(ritual.activeVisitId).toBeNull();
  for(const visit of ritual.visits){expect(visit.week).toBe(ritual.announcements.find(e=>e.id===visit.eventId)!.week);expect(visit.endedWeek).not.toBeNull();}
 });
 it.each(['ritual','promotion','end-ritual','prepare','effect','close','return','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`crimson-scholar-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('holds the actual full-moon visit until a real zero-cost exit and does not refund its kit',()=>{
  const b=read('crimson-scholar-ritual-save-boundary'),s=b.final as SliceState;
  expect(projectSliceState(s).crimsonScholar.insideCase).toBe(true);expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  const after=applySliceIntent(s,{type:'CRIMSON_SCHOLAR',command:{type:'END_RITUAL'}});
  expect(after.crimsonScholar.ritual.activeVisitId).toBeNull();expect(after.crimsonScholar.ritual.visits).toHaveLength(s.crimsonScholar.ritual.visits.length);assertValidSliceState(after);
 });
 it('stops its field at the actual end node and requires the ordinary original return route',()=>{
  const b=read('crimson-scholar-return-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.crimsonScholar.practice.location).toBe('END');expect(s.crimsonScholar.practice.field).toBe('NONE');
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  expect(()=>applySliceIntent(s,{type:'CRIMSON_SCHOLAR',command:{type:'REPORT',caseId:'moonlight-route'}})).toThrow();
  expect(b.final.crimsonScholar.practice.location).toBe('START');
 });
 it('keeps actual Sid and the original carrier separate without manufacturing rescue',()=>{
  const c=read('crimson-scholar-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('CRIMSON_SCHOLAR_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');assertValidSliceState(s);
 });
 it('migrates prior0.98 original instrument, lamp and actual terminal outcome unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/astronomer-v0980/natural.json','utf8')).final,current=migrateSliceState(old);
  expectPriorFields(current,old);
 });
});
