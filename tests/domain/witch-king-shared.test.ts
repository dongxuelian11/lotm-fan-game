import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const data=JSON.parse(readFileSync(`tests/fixtures/witch-king-v01210/${name==='stage-natural'?'natural':name}.json`,'utf8'));for(const key of Object.keys(data))if(data[key]&&typeof data[key]==='object'&&typeof data[key].schemaVersion==='number')data[key]=migrateSliceState(data[key]);return data;};
describe('Witch King actual public route and inherited Moon history',()=>{
 it('preserves every old Moon item, body and food record through actual independent promotion',()=>{
  const c=read('stage-natural'),s=c.promoted as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(4);expect(s.witchKing.crimsonScholarActingAtPromotion).toBe(100);
  expect(s.witchKing.promotionWeek).toBeGreaterThanOrEqual(s.crimsonScholar.promotionWeek!+12);
  for(const key of ['apothecary','tamer','vampire','potionProfessor','crimsonScholar'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['moon.s4.moon-paper-substitute','moon.s4.blood-moon-arrow']);
  expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).crimsonScholar.acting).toBe(100);
  expect(s.character.gender).toEqual(c.guidanceStart.character.gender);
 });
 it.each(['book','open','check','promotion','paper-buy','paper-prepare','effect','return','stop','inspect','close','report','combat'])('replays actual %s with whole private state equality',key=>{
  const b=read(`${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps each paid original kit and actual expert separate from immutable appointment history',()=>{
  const s=read('stage-natural').final as SliceState;expect(s.witchKing.ritual.expert.id).toBe('WK4-GRACE');expect(s.witchKing.ritual.activeVisitId).toBeNull();expect(s.witchKing.ritual.playerLocation).toBe('OUTSIDE');
  for(const v of s.witchKing.ritual.visits){expect(v.plannedWeek).toBe(v.bookedWeek+1);expect(v.kit.id).toMatch(/^WK4-KIT-/);if(v.consumedBottleId){expect(v.kit.status).toBe('CONSUMED');expect(v.kit.consumedWeek).toBe(v.windowWeek);}expect(v.closedWeek).not.toBeNull();}
 });
 it('uses real finite paper and leaves the same target, folio and instructor after practice',()=>{
  const c=read('stage-natural'),s=c.practiced as SliceState;expect(s.progression.acting).toBe(100);expect(Object.values(s.witchKing.life.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.witchKing.life.papers.some(p=>p.consumedBy==='PAPER_TRIAL')).toBe(true);expect(s.witchKing.life.target.status).toBe('BROKEN');expect(s.witchKing.life.practice.location).toBe('START');expect(s.witchKing.life.practice.folio.location).toBe('START');expect(s.witchKing.life.practice.field).toBe('NONE');expect(s.witchKing.life.practice.outboundTrips).toBe(s.witchKing.life.practice.returns);
 });
 it('retains real blood purchase/feed actions and does not reopen lower-stage growth',()=>{
  const s=read('stage-natural').practiced as SliceState,p=projectSliceState(s);expect(p.vampire.actions.some(a=>a.command.type==='BUY_BLOOD')).toBe(true);expect(p.vampire.actions.some(a=>a.command.type==='FEED')).toBe(true);expect(p.vampire.actions.some(a=>a.command.type==='PRACTICE')).toBe(false);
  const a=p.vampire.actions.find(a=>a.command.type==='BUY_BLOOD'&&a.enabled);if(a){const next=applySliceIntent(s,{type:'VAMPIRE',command:a.command});expect(next.vampire.blood.held).toBe(s.vampire.blood.held+1);expect(next.progression.mastery).toEqual(s.progression.mastery);}
 });
 it('settles original Dorian and the original club without altering earlier Sid or the old carrier',()=>{
  const c=read('stage-natural'),s=c.final as SliceState;expect(c.combatStart.combat.encounterId).toBe('WITCH_KING_DISPUTE');expect(s.combat).toBeNull();expect(s.witchKing.encounter.enemy.id).toBe('WK4-DORIAN');expect(s.witchKing.encounter.enemy.weaponId).toBe('WK4-DORIAN-CLUB');expect(s.crimsonScholar.encounter).toEqual(c.guidanceStart.crimsonScholar.encounter);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(s.seer.completedSources.filter(x=>x.startsWith('witch-king-combat-victory:'))).toHaveLength(1);
 });
 it('migrates actual0.120 full state keeping all prior fields and registers only a fresh Witch King module',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/alchemist-v01200/natural.json','utf8')).final,current=migrateSliceState(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((current as any)[key]).toEqual(old[key]);expect(current.witchKing.promotionWeek).toBeNull();expect(current.witchKing.life.papers).toEqual([]);expect(migrateSliceState(current)).toEqual(current);
 });
});
