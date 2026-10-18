import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const captureFixturePaths: Record<string, string> = {
  "manipulator-stage-natural": "tests/fixtures/manipulator-v01190/natural.json",
};
const read=(name:string)=>{const data=JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8'));for(const key of ['departureStart','guidanceStart','promoted','practiced','combatStart','beforeLast','final'])if(data[key])data[key]=migrateSliceState(data[key]);return data;};
describe('Manipulator actual public source route',()=>{
 it('keeps the complete old Dreamwalker prefix and each previous actual history',()=>{
  const c=read('manipulator-stage-natural'),s=c.final as SliceState,old=JSON.parse(readFileSync('tests/fixtures/dreamwalker-v0970/natural.json','utf8'));
  assertValidSliceState(s);expect(c.commands.slice(0,c.prefixCount)).toEqual(old.commands);expect(c.prefixCount).toBe(old.commands.length);
  expect(s.progression.sequence).toBe(4);expect(c.practiced.progression.acting).toBe(100);
  for(const k of ['audience','mindreader','psychologist','hypnotist','dreamwalker'] as const)expect(s[k]).toEqual(c.guidanceStart[k]);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['audience.s4.mind-island','audience.s4.virtual-persona','audience.s4.mental-plague']);
  expect(projectSliceState(s).dreamwalker.acting).toBe(100);expect(projectSliceState(s).maxSpirituality).toBe(120);
 });
 it('brews every original bottle from ten actual sources including seven distinct consenting donors',()=>{
  const s=read('manipulator-stage-natural').final as SliceState;
  for(const b of s.manipulator.bottles){const batch=s.manipulator.batches.find(x=>x.id===b.batchId)!;
   expect(batch.status).toBe('BREWED');expect(batch.materials).toHaveLength(3);expect(batch.materials.every(x=>x.holder==='CONSUMED')).toBe(true);
   expect(batch.tears).toHaveLength(7);expect(new Set(batch.tears.map(t=>t.donorId)).size).toBe(7);expect(batch.tears.every(t=>t.consent&&t.quantity===1&&t.holder==='CONSUMED')).toBe(true);
   expect(b.sourceItemIds).toHaveLength(10);expect(new Set(b.sourceItemIds).size).toBe(10);
   const g=s.manipulator.ritual.gatherings.find(g=>g.id===b.ritualId)!;expect(g.groups.reduce((n,x)=>n+x.arrivedCount,0)).toBeGreaterThanOrEqual(10000);expect(g.windowWeek).toBe(b.consumedWeek);expect(g.consumedBottleId).toBe(b.id);expect(g.groups.every(x=>x.presentCount===0&&x.location==='HOME')).toBe(true);
  }
 });
 it.each(['materials','tear','brew','book','open','arrival','resonance','promotion','effect','verify','close','persona','rejoin','combat'])('replays actual %s with full private/public save equality',key=>{
  const b=read(`manipulator-${key}-save-boundary`),original=structuredClone(b.beforeLast),s=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(s).toEqual(b.final);expect(b.beforeLast).toEqual(original);assertValidSliceState(s);expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);expect(projectSliceState(s)).toEqual(projectSliceState(b.final));
 });
 it('keeps the original real opponent and does not turn inert model work into real infection',()=>{
  const c=read('manipulator-stage-natural'),s=c.final as SliceState;
  expect(c.practiced.manipulator.life.cases['plague-model'].method).toBe('ORDINARY');expect(c.practiced.manipulator.life.cases['plague-model'].abilityUses).toBe(0);
  expect(c.combatStart.combat.encounterId).toBe('MANIPULATOR_DISPUTE');expect(s.combat).toBeNull();expect(s.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
 });
 it('migrates the actual 0.118 save while preserving all prior fields and original input bytes',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json','utf8')).final,bytes=JSON.stringify(old),s=migrateSliceState(old);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((s as unknown as Record<string,unknown>)[key]).toEqual(old[key]);assertValidSliceState(s);expect(migrateSliceState(s)).toEqual(s);expect(JSON.stringify(old)).toBe(bytes);expect(s.manipulator.guidanceKnown).toBe(false);
 });
});
