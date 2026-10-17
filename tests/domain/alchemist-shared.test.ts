import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const filename=name==='alchemist-stage-natural'?'natural.json':`${name.replace(/^alchemist-/, '').replace(/-save-boundary$/, '')}-boundary.json`;const d=JSON.parse(readFileSync(`tests/fixtures/alchemist-v01200/${filename}`,'utf8'));for(const key of ['departureStart','guidanceStart','promoted','practiced','combatStart','beforeLast','final'])if(d[key])d[key]=migrateSliceState(d[key]);return d;};
describe('Alchemist actual public route and irreversible garden',()=>{
 it('preserves the complete real Astronomer prefix and all prior Paragon source histories',()=>{
  const c=read('alchemist-stage-natural'),s=c.final as SliceState,old=JSON.parse(readFileSync('tests/fixtures/astronomer-v0980/natural.json','utf8'));
  assertValidSliceState(s);expect(c.commands.slice(0,c.prefixCount)).toEqual(old.commands);expect(c.prefixCount).toBe(old.commands.length);
  expect(s.progression.sequence).toBe(4);expect(c.practiced.progression.acting).toBe(100);
  for(const k of ['savant','archaeologist','appraiser','artisan','astronomer'] as const)expect(s[k]).toEqual(c.guidanceStart[k]);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['paragon.s4.animate-made-object','paragon.s4.direct-creation']);
  expect(projectSliceState(s).astronomer.acting).toBe(100);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(s.artisan.workshop.lamp?.location).toBe('CLIENT');
 });
 it('consumes each real bottle only in its newly destroyed original garden and preserves each failed plot',()=>{
  const s=read('alchemist-stage-natural').final as SliceState;
  for(const b of s.alchemist.bottles.filter(b=>b.status==='CONSUMED')){
   const p=s.alchemist.ritual.plots.find(x=>x.id===b.ritualId)!;
   expect(p).toBeDefined();expect(p.status).toBe('CLOSED');expect(p.consumedBottleId).toBe(b.id);expect(p.drainedWeek).toBe(b.consumedWeek);expect(b.ritualWindowWeek).toBe(b.consumedWeek);
   expect(p.plants).toHaveLength(14);expect(new Set(p.plants.map(x=>x.id)).size).toBe(14);expect(p.plants.every(x=>x.status==='DEAD')).toBe(true);expect(p.soil).toMatchObject({status:'SAND',vitality:0});expect(p.pool).toMatchObject({status:'DRY',waterLitres:0});
  }
  const ids=s.alchemist.ritual.plots.flatMap(x=>x.plants.map(p=>p.id));expect(new Set(ids).size).toBe(ids.length);
 });
 it.each(['plot','open','survey','drain','promotion','effect','close','report','combat'])('replays actual %s with full private/public saved-state equality',key=>{
  const b=read(`alchemist-${key}-save-boundary`),original=structuredClone(b.beforeLast),s=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(s).toEqual(b.final);expect(b.beforeLast).toEqual(original);assertValidSliceState(s);expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);expect(projectSliceState(s)).toEqual(projectSliceState(b.final));
 });
 it('retains actual garden damage when leaving without drinking and refuses ordinary time passage while inside',()=>{
  const b=read('alchemist-drain-save-boundary'),s=b.final as SliceState,p=structuredClone(s.alchemist.ritual.plots.at(-1)!);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  const after=applySliceIntent(s,{type:'ALCHEMIST',command:{type:'LEAVE_RITUAL'}});assertValidSliceState(after);expect(projectSliceState(after).alchemist.insideCase).toBe(false);
  const q=after.alchemist.ritual.plots.at(-1)!;expect(q.plants).toEqual(p.plants);expect(q.soil).toEqual(p.soil);expect(q.pool).toEqual(p.pool);expect(q.consumedBottleId).toBeNull();expect(after.alchemist.bottles).toEqual(s.alchemist.bottles);
  const bottle=after.alchemist.bottles.find(x=>x.status==='PLAYER')!;expect(()=>applySliceIntent(after,{type:'ALCHEMIST',command:{type:'CONSUME',bottleId:bottle.id,confirmed:true}})).toThrow();
 });
 it('keeps actual optional Osric independent of the old carrier and old dead Hober',()=>{
  const c=read('alchemist-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('ALCHEMIST_DISPUTE');expect(s.combat).toBeNull();expect(s.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(s.astronomer).toEqual(c.guidanceStart.astronomer);
 });
 it('migrates complete actual0.119 while preserving every pre-existing field and input',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/manipulator-v01190/natural.json','utf8')).final,bytes=JSON.stringify(old),s=migrateSliceState(old);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((s as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  assertValidSliceState(s);expect(migrateSliceState(s)).toEqual(s);expect(JSON.stringify(old)).toBe(bytes);expect(s.alchemist.guidanceKnown).toBe(false);expect(s.alchemist.ritual.plots).toEqual([]);
 });
});
