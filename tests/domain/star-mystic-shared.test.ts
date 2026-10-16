import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='star-mystic-stage-natural'?JSON.parse(readFileSync('tests/fixtures/star-mystic-v01090/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/star-mystic-v01090/boundaries.json','utf8'))[name.slice(12,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('StarMystic real public chain',()=>{
 it('retains original S6 scrolls and returns the two actual bodies, screen and lens after practice',()=>{
  const c=read('star-mystic-stage-natural'),s=c.practiced as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.scrollProfessor).toEqual(c.guidanceStart.scrollProfessor);
  expect(s.starMystic.practice).toEqual({lenses:'WORN',screen:'SHUT',markerSeen:true,cageActive:false,companionNode:'WAITING',playerNode:'ROOM',weatherSeen:true});
  expect(Object.values(s.starMystic.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  const p=projectSliceState(s);expect(p.starMystic.insideCase).toBe(false);expect(p.canAct).toBe(true);
 });
 it.each(['promotion','prepare','sight','cage','weather','close','report','craft','authorize','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`star-mystic-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('makes a new S5 original from one real material and keeps the carrier facts independent',()=>{
  const c=read('star-mystic-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.scrollProfessor.workshop.scrolls.some(x=>x.makerSequence===5)).toBe(true);
  for(const old of c.practiced.scrollProfessor.workshop.scrolls){const now=s.scrollProfessor.workshop.scrolls.find(x=>x.id===old.id)!;expect(now.makerSequence).toBe(old.makerSequence);expect(now.materialId).toBe(old.materialId);expect(now.createdWeek).toBe(old.createdWeek);}
  expect(c.combatStart.combat.encounterId).toBe('STAR_MYSTIC_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(s.starMystic.practice.lenses).toBe('WORN');
  const p=projectSliceState(s);expect(p.starMystic.abilities.filter(a=>a.id.startsWith('hermit.s5.')).map(a=>a.id)).toEqual(['hermit.s5.mystic-sight','hermit.s5.star-cage']);
 });
 it('migrates0.108 without rewriting any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/pain-v01080/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
