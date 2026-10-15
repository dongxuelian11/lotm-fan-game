import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/mysticism-magister-v01010/shared-${name.replace('mysticism-magister-','')}.json`,'utf8')));
describe('Mysticism Magister actual shared route',()=>{
 it('preserves original Reader histories and real learned samples through S5',()=>{
  const c=read('mysticism-magister-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.mysticismMagister.polymathActingAtPromotion).toBe(100);
  expect(s.mysticismMagister.promotionWeek).toBeGreaterThanOrEqual(s.polymath.promotionWeek!+12);
  for(const key of ['reader','reasoner','detective','polymath'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).polymath.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['reader.s5.secret-ritual','reader.s5.material-imitation']);
  expect(projectSliceState(s).mysticismMagister.abilities).toHaveLength(oldIds.length+2);
  expect(s.mysticismMagister.practice.token).toBe('OWNER');expect(s.mysticismMagister.practice.dreamOpen).toBe(false);
  expect(s.mysticismMagister.practice.dreamResult).toBe('VERIFIED');expect(c.promoted.mysticismMagister.crafts).toEqual([]);
  expect(Object.values(s.mysticismMagister.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['promotion','prepare','effect','close','verify','return','test-craft','report','craft','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`mysticism-magister-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps a dream claim unproved until actual waking verification',()=>{
  const b=read('mysticism-magister-verify-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.mysticismMagister.practice.dreamResult).toBe('CLAIM');expect(s.mysticismMagister.practice.dreamOpen).toBe(false);
  expect(()=>applySliceIntent(s,{type:'MYSTICISM_MAGISTER',command:{type:'REPORT',caseId:'linked-dream'}})).toThrow();
  const after=applySliceIntent(s,b.lastIntent);expect(after.mysticismMagister.practice.dreamResult).toBe('VERIFIED');
 });
 it('tests and consumes the exact original craft instead of granting a reusable object',()=>{
  const b=read('mysticism-magister-test-craft-save-boundary'),after=b.final as SliceState;
  const id=b.lastIntent.command.itemId,old=b.beforeLast.mysticismMagister.crafts.find((x:{id:string})=>x.id===id);
  expect(old.status).toBe('PLAYER');expect(after.mysticismMagister.crafts.find(x=>x.id===id)).toEqual({...old,status:'CONSUMED',usedWeek:b.beforeLast.week});
  expect(()=>applySliceIntent(after,b.lastIntent)).toThrow();
 });
 it('keeps the new opponent and original prepared artifacts separate from the first case',()=>{
  const c=read('mysticism-magister-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('MYSTICISM_MAGISTER_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.combatStart.mysticismMagister.crafts.some((x:{status:string})=>x.status==='PLAYER')).toBe(true);
  expect(new Set(s.mysticismMagister.crafts.map(x=>x.id)).size).toBe(s.mysticismMagister.crafts.length);
  expect(s.mysticismMagister.practice.kitsUsed).toBeGreaterThanOrEqual(s.mysticismMagister.crafts.length);
 });
 it('migrates exact 0.100 originals without changing prior objects and histories',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/spirit-warlock-v01000/natural.json','utf8')).final;
  const after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(175);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  expect(migrateSliceState(after)).toEqual(after);
 });
});
