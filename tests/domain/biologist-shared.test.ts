import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const raw=name==='biologist-stage-natural'?JSON.parse(readFileSync('tests/fixtures/biologist-v0940/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/biologist-v0940/boundaries.json','utf8'))[name.slice('biologist-'.length,-'-save-boundary'.length)];if(!raw)throw new Error('Missing original fixture '+name);for(const k of Object.keys(raw))if(raw[k]&&typeof raw[k]==='object'&&'schemaVersion'in raw[k])raw[k]=migrateSliceState(raw[k]);return raw;};
describe('Biologist actual shared route',()=>{
 it('preserves old harvest and waits before verifying the same original trial plant',()=>{
  const c=read('biologist-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.biologist.promotionWeek).toBeGreaterThanOrEqual(s.harvestpriest.promotionWeek!+12);
  expect(s.biologist.harvestpriestActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.harvestpriest.cases).toEqual(c.guidanceStart.harvestpriest.cases);expect(projectSliceState(s).harvestpriest.acting).toBe(100);
  expect(Object.values(s.biologist.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.biologist.trial).toMatchObject({location:'OWNER',status:'RETURNED'});
  expect(s.biologist.trial.verifiedWeek).toBeGreaterThan(s.biologist.trial.careWeek!);
  expect(s.biologist.practice).toEqual({sampleRecorded:true,warningsRecorded:true});
  expect(s.harvestpriest.plot.waterUsed-c.guidanceStart.harvestpriest.plot.waterUsed).toBe(s.biologist.trial.waterUsed);
  expect(s.harvestpriest.plot.produce).toBe(c.guidanceStart.harvestpriest.plot.produce);
  const p=projectSliceState(s).biologist;expect(new Set(p.actions.map(a=>a.id)).size).toBe(p.actions.length);expect(p.abilities).toHaveLength(9);
 });
 it.each(['promotion','prepare','verify','close','report','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`biologist-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('spends the same original water and paid ability before cleanup',()=>{
  const b=read('biologist-trial-save-boundary'),s=b.final as SliceState;
  expect(s.spirituality).toBe(b.beforeLast.spirituality-3);expect(s.harvestpriest.plot.water).toBe(b.beforeLast.harvestpriest.plot.water-1);
  expect(s.biologist.cases['paired-seedling']!.contactOpen).toBe(true);expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'BIOLOGIST',command:{type:'CLOSE',caseId:'paired-seedling'}});
  expect(after.biologist.cases['paired-seedling']!.contactOpen).toBe(false);expect(after.harvestpriest.plot.waterUsed).toBe(s.harvestpriest.plot.waterUsed);
 });
 it('keeps nursery originals out of the independent battle and its ordinary opponent intact until actual consequences',()=>{
  const c=read('biologist-stage-natural'),s=c.final as SliceState;
  expect(s.biologist.trial).toEqual(c.combatStart.biologist.trial);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.combatStart.combat.encounterId).toBe('BIOLOGIST_DISPUTE');
  expect(s.status).toBe('DEAD');expect(s.health).toBe(0);expect(s.biologist.encounter.status).toBe('LOST');
  expect(s.combatHistory.at(-1)!.consequence).toContain('最终死亡');expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
 });
 it('migrates complete0.93 Judge history without losing any original fact',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/judge-v0930/natural.json','utf8')).final,current=migrateSliceState(old);
  const{biologist:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const k of Object.keys(prior))expect((facts as any)[k]).toEqual(prior[k]);
 });
});
