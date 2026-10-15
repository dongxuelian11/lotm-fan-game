import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='corruption-baron-stage-natural'?JSON.parse(readFileSync('tests/fixtures/corruption-baron-v0920/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/corruption-baron-v0920/boundaries.json','utf8'))[name.slice(17,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Corruption Baron actual shared route',()=>{
 it('preserves earlier cases and the same original gifts through promotion and cleanup',()=>{
  const c=read('corruption-baron-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.corruptionBaron.promotionWeek).toBeGreaterThanOrEqual(s.briber.promotionWeek!+12);
  expect(s.corruptionBaron.briberActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.briber.cases).toEqual(c.guidanceStart.briber.cases);expect(c.promoted.briber.gifts).toEqual(c.guidanceStart.briber.gifts);
  expect(projectSliceState(s).briber.acting).toBe(100);
  expect(Object.values(s.corruptionBaron.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.corruptionBaron.practice).toEqual({clauseOrder:'RESTORED',marker:'STOPPED',route:'FREE'});
  const p=projectSliceState(s).corruptionBaron;expect(new Set(p.actions.map(a=>a.id)).size).toBe(p.actions.length);
  expect(p.abilities).toHaveLength(7);
 });
 it.each(['promotion','prepare','marker','close','report','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`corruption-baron-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps actual ball movement contact until stopped and charges the ability',()=>{
  const b=read('corruption-baron-marker-save-boundary'),s=b.final as SliceState;
  expect(s.spirituality).toBe(b.beforeLast.spirituality-3);expect(s.corruptionBaron.cases['rolling-marker']!.contactOpen).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'CORRUPTION_BARON',command:{type:'CLOSE',caseId:'rolling-marker'}});
  expect(after.corruptionBaron.cases['rolling-marker']!.contactOpen).toBe(false);expect(after.corruptionBaron.practice.marker).toBe('STOPPED');
 });
 it('keeps the independent opponent and existing original gift destinations',()=>{
  const c=read('corruption-baron-stage-natural'),s=c.final as SliceState;
  expect(s.corruptionBaron.practice).toEqual(c.combatStart.corruptionBaron.practice);
  expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.at(-1)!.consequence).toContain('沃恩');expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
  for(const old of c.guidanceStart.briber.gifts.filter((g:{location:string})=>g.location==='GIVEN'))expect(s.briber.gifts.find(g=>g.id===old.id)).toEqual(old);
 });
 it('migrates complete0.91 Calamity history without losing any earlier fact',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/calamity-priest-v0910/natural.json','utf8')).final,current=migrateSliceState(old);
  const{corruptionBaron:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
});
