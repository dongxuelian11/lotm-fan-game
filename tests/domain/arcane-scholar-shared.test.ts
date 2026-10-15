import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
const read=()=>{const d=JSON.parse(readFileSync('tests/fixtures/arcane-scholar-v01430/natural.json','utf8'));for(const k of ['departureStart','guidanceStart','promoted','practiced','combatStart','beforeLast','final'])if(d[k])d[k]=migrateSliceState(d[k]);return d;};
const old=()=>JSON.parse(readFileSync('tests/fixtures/alchemist-v01200/natural.json','utf8'));
describe('Arcane Scholar original public route and shared runtime',()=>{
 it('replays all352 original commands and every new choice using the original seed',()=>{
  const d=read(),prior=old();expect(prior.commands).toHaveLength(352);expect(d.commands.slice(0,352)).toEqual(prior.commands);expect(d.seed).toBe(prior.seed);
  let s=createSliceRun(d.final.runId,d.creation,d.seed);for(const c of d.commands)s=applySliceIntent(s,c);assertValidSliceState(s);expect(s).toEqual(d.final);
 },30000);
 it('migratesS4 without changing dead Osric, exhausted garden plots or original constructs',()=>{
  const d=old(),bytes=JSON.stringify(d.final),s=migrateSliceState(d.final);expect(s.schemaVersion).toBe(174);expect(s.arcaneScholar.promotionWeek).toBeNull();
  for(const key of Object.keys(d.final))if(!['schemaVersion','contentVersion'].includes(key))expect((s as unknown as Record<string,unknown>)[key]).toEqual(d.final[key]);
  expect(s.alchemist.promotionWeek).toBe(83);expect(s.alchemist.encounter.enemy.status).toBe('DEAD');expect(s.alchemist.encounter.enemy.weaponLocation).toBe('YARD');expect(JSON.stringify(d.final)).toBe(bytes);
 });
 it('retains all original mastery and exposes the inherited pool after independent promotion',()=>{
  const s=read().promoted as SliceState,prior=old().final as SliceState;assertValidSliceState(s);expect(s.progression.sequence).toBe(3);
  for(const key of ['savant','archaeologist','appraiser','artisan','astronomer','alchemist'] as const)expect(s[key]).toEqual(prior[key]);
  expect(s.character.gender).toBe(prior.character.gender);expect(s.injuries).toEqual(prior.injuries);
  expect(Object.keys(s.progression.mastery).filter(id=>!Object.hasOwn(prior.progression.mastery,id))).toEqual(['paragon.s3.bounded-analysis','paragon.s3.construct-coordination']);
  const p=projectSliceState(s);expect(p.alchemist.acting).toBe(100);expect(p.arcaneScholar.abilities.map(a=>a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
 });
 it('replays actual transaction boundaries with no mutation of their input',()=>{
  const d=JSON.parse(readFileSync('tests/fixtures/arcane-scholar-v01430/boundaries.json','utf8')) as Record<string,{beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState}>;
  for(const b of Object.values(d)){b.beforeLast=migrateSliceState(b.beforeLast);b.final=migrateSliceState(b.final);assertValidSliceState(b.beforeLast);assertValidSliceState(b.final);const bytes=JSON.stringify(b.beforeLast);expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final);expect(JSON.stringify(b.beforeLast)).toBe(bytes);}
 },30000);
 it('finishes three distinct practices using the same original construct pair and returns all originals',()=>{
  const d=read(),s=d.practiced as SliceState,prior=old().final as SliceState;assertValidSliceState(s);expect(s.progression.acting).toBe(100);
  const l=s.arcaneScholar.life;expect(Object.values(l.cases).every(c=>c.status==='RESOLVED')).toBe(true);expect(l.activeCase).toBeNull();expect(l.note.location).toBe('OWNER');expect(l.note.custodian).toBe('AR3-NELL');expect(l.fuses.every(f=>f.consumed&&f.location==='RECYCLING_BOX')).toBe(true);
  expect(s.alchemist.life.creations.map(x=>x.id)).toEqual(['AL4-BOX-1','AL4-FRAME-1']);
  for(const x of s.alchemist.life.creations){const before=prior.alchemist.life.creations.find(y=>y.id===x.id)!;expect(x.location).toBe('PLAYER');expect(x.active).toBe(false);for(const key of ['source','componentIds','madeBy','owner','custodian','manufacturedWeek'] as const)expect(x[key]).toEqual(before[key]);}
  expect(s.alchemist.encounter).toEqual(prior.alchemist.encounter);expect(s.alchemist.ritual).toEqual(prior.alchemist.ritual);
 });
 it('uses actual independent enemy spirituality and preserves the original terminal combat branch',()=>{
  const d=read(),s=d.final as SliceState;assertValidSliceState(s);expect(s.combat).toBeNull();expect(s.arcaneScholar.encounter.terminal).not.toBeNull();expect(s.arcaneScholar.encounter.targetId).toBe('AR3-CORWIN');
  expect(s.combatHistory.some(r=>r.arcaneScholarOutcome)).toBe(true);expect(s.alchemist.encounter).toEqual(old().final.alchemist.encounter);
  const e=s.arcaneScholar.encounter;expect(e.enemySpirituality).toBe(120-e.powerUses.ARC_BOLT*5-e.powerUses.WARD*4-e.powerUses.JAM*4);
 });
 it('does not reopen oldS4 acquisition after becomingS3',()=>{
  const s=read().promoted as SliceState,bytes=JSON.stringify(s);expect(()=>applySliceIntent(s,{type:'ALCHEMIST',command:{type:'LEARN_GUIDANCE'}})).toThrow();expect(JSON.stringify(s)).toBe(bytes);expect(projectSliceState(s).alchemist.actions).toEqual([]);
 });
});
