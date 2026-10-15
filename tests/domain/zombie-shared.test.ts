import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='zombie-stage-natural'?JSON.parse(readFileSync('tests/fixtures/zombie-v0900/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/zombie-v0900/boundaries.json','utf8'))[name.slice(7,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Zombie actual shared route and replaced curse',()=>{
 it('retains old history and actual new-case closures',()=>{
  const c=read('zombie-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.zombie.promotionWeek).toBeGreaterThanOrEqual(s.werewolf.promotionWeek!+12);
  expect(s.zombie.werewolfActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.werewolf.cases).toEqual(c.guidanceStart.werewolf.cases);
  expect(Object.values(s.zombie.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.zombie.practice.body).toBe('NORMAL');expect(s.zombie.practice.cold).not.toBe('ICED');expect(s.zombie.practice.spirit).not.toBe('PRESENT');
  expect(s.zombie.moon.history.length).toBeGreaterThan(0);expect(s.werewolf.moon.history).toEqual(c.promoted.werewolf.moon.history);
  expect(s.zombie.moon.history.some(r=>s.werewolf.moon.history.some(o=>o.week===r.week))).toBe(false);
  expect(new Set(projectSliceState(s).zombie.actions.map(a=>a.id)).size).toBe(projectSliceState(s).zombie.actions.length);
 });
 it.each(['promotion','effect','close','report','moon','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`zombie-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('requires handling actual new curse and pays its mental cost without healing',()=>{
  const b=read('zombie-moon-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.zombie.moon.pendingWeek).not.toBeNull();expect(s.werewolf.moon.pendingWeek).toBeNull();
  expect(()=>applySliceIntent(s,{type:'ZOMBIE',command:{type:'ENCOUNTER_FIGHT'}})).toThrow();
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  expect(b.final.zombie.moon.history.at(-1).mentalCost).toBeGreaterThan(0);
  expect(b.final.werewolf.moon).toEqual(s.werewolf.moon);
 });
 it('requires actual zero-action closure and blocks work while contact remains',()=>{
  const b=read('zombie-effect-save-boundary'),s=b.final as SliceState,caseId=b.lastIntent.command.caseId;
  expect(s.zombie.cases[caseId]!.contactOpen).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'ZOMBIE',command:{type:'CLOSE',caseId}});
  expect(after.zombie.cases[caseId]!.contactOpen).toBe(false);expect(after.zombie.practice.body).toBe('NORMAL');
 });
 it('keeps old carrier facts and the real independent opponent',()=>{
  const c=read('zombie-stage-natural'),s=c.final as SliceState;expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.at(-1)!.consequence).toContain('里德');expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
 });
 it('migrates complete Demon history without losing paid strain and evidence',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/demon-v0890/natural.json','utf8')).final,current=migrateSliceState(old);
  const{zombie:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
});
