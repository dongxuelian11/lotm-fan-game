import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const captureFixturePaths: Record<string, string> = {
  "dreamwalker-stage-natural": "tests/fixtures/dreamwalker-v0970/natural.json",
};
const read=(name:string)=>JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8'));
describe('Dreamwalker actual shared route',()=>{
 it('keeps all old Audience facts and the original past consent and exits after promotion',()=>{
  const c=read('dreamwalker-stage-natural'),s=migrateSliceState(c.final);assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.dreamwalker.hypnotistActingAtPromotion).toBe(100);
  expect(s.dreamwalker.promotionWeek).toBeGreaterThanOrEqual(s.hypnotist.promotionWeek!+12);
  for(const key of ['audience','mindreader','psychologist','hypnotist'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).hypnotist.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['audience.s5.dream-guidance','audience.s5.dream-modification','audience.s5.dream-travel']);
  expect(projectSliceState(s).dreamwalker.abilities).toHaveLength(oldIds.length+3);
  expect(Object.values(s.dreamwalker.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen&&r.verified)).toBe(true);
  expect(s.dreamwalker.practice).toEqual({location:'SOURCE_ROOM',dream:'NONE',outboundTrips:1,returns:1,wakingChecks:3});
  const weeks=s.dreamwalker.cases['repeated-garden']!.sessionWeeks;expect(weeks).toHaveLength(2);expect(weeks[1]).toBeGreaterThan(weeks[0]!);
 });
 it.each(['ritual','promotion','end-ritual','prepare','effect','close','return','verify','report','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`dreamwalker-${key}-save-boundary`),after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('holds a real ritual visit through the last paid action and permits its real zero-cost exit',()=>{
  const b=read('dreamwalker-ritual-save-boundary'),s=migrateSliceState(b.final);
  expect(projectSliceState(s).dreamwalker.insideCase).toBe(true);expect(s.dreamwalker.ritual.featherHolder).toBe('PLAYER');
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  const after=applySliceIntent(s,{type:'DREAMWALKER',command:{type:'END_RITUAL'}});
  expect(after.dreamwalker.ritual.activeVisitId).toBeNull();expect(after.dreamwalker.ritual.featherHolder).toBe('LINGWEI');
  expect(after.dreamwalker.ritual.visits).toHaveLength(s.dreamwalker.ritual.visits.length);assertValidSliceState(after);
 });
 it('exits at the actual target node, blocks ordinary actions and walks the original route before reality verification',()=>{
  const b=read('dreamwalker-return-save-boundary'),s=migrateSliceState(b.beforeLast);
  expect(s.dreamwalker.practice.location).toBe('TARGET_ROOM');expect(s.dreamwalker.practice.dream).toBe('NONE');
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  expect(()=>applySliceIntent(s,{type:'DREAMWALKER',command:{type:'VERIFY',caseId:'paired-dream'}})).toThrow();
  expect(b.final.dreamwalker.practice.location).toBe('SOURCE_ROOM');expect(b.final.dreamwalker.practice.returns).toBe(1);
  expect(b.final.spirituality).toBeGreaterThanOrEqual(s.spirituality); // Any weekly recovery occurs only after actual return.
 });
 it('keeps the independent awake opponent and original first-case carrier history',()=>{
  const c=read('dreamwalker-stage-natural'),s=migrateSliceState(c.final);
  expect(c.combatStart.combat.encounterId).toBe('DREAMWALKER_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);
  expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');assertValidSliceState(s);
 });
 it('migrates the previous 0.96 source without changing the actual original Hunter history',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/reaper-v0960/natural.json','utf8')).final,current=migrateSliceState(old);
  const original=JSON.stringify(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((current as unknown as Record<string,unknown>)[key]).toEqual(old[key]);assertValidSliceState(current);expect(migrateSliceState(current)).toEqual(current);expect(JSON.stringify(old)).toBe(original);
 });
});
