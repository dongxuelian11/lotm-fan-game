import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
const read=()=>{const d=JSON.parse(readFileSync('tests/fixtures/war-bishop-v01410/natural.json','utf8'));for(const k of ['departureStart','guidanceStart','promoted','practiced','combatStart','beforeLast','final'])if(d[k])d[k]=migrateSliceState(d[k]);return d;};
const old=()=>JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json','utf8'));
describe('War Bishop original public route and shared runtime',()=>{
 it('replays the whole same-seed run with the exact original423 public-command prefix',()=>{
  const data=read(),prior=old();expect(prior.commands).toHaveLength(423);expect(data.commands.slice(0,423)).toEqual(prior.commands);expect(data.seed).toBe(prior.seed);
  let s=createSliceRun(data.final.runId,data.creation,data.seed);for(const c of data.commands)s=applySliceIntent(s,c);assertValidSliceState(s);expect(s).toEqual(data.final);
 },30000);
 it('migrates originalS4 without inventing a member, healing, potion or current presence',()=>{
  const data=old(),bytes=JSON.stringify(data.final),s=migrateSliceState(data.final);
  expect(s.schemaVersion).toBe(174);expect(s.warBishop.promotionWeek).toBeNull();expect(s.warBishop.preparations).toEqual([]);
  for(const key of Object.keys(data.final))if(!['schemaVersion','contentVersion'].includes(key))expect((s as unknown as Record<string,unknown>)[key]).toEqual(data.final[key]);
  expect(s.ironBloodKnight.team.members.filter(m=>m.present)).toHaveLength(0);expect(JSON.stringify(data.final)).toBe(bytes);
 });
 it('retains original lower-stage objects, endings and the one prior body change atS3',()=>{
  const data=read(),s=data.promoted as SliceState,prior=old().final as SliceState;expect(s).toBeTruthy();assertValidSliceState(s);
  expect(s.progression.sequence).toBe(3);expect(s.character.gender).toBe(prior.character.gender);expect(s.ironBloodKnight.originalGender).toBe(prior.ironBloodKnight.originalGender);
  for(const key of ['hunter','provoker','pyromaniac','conspirator','reaper'] as const)expect(s[key]).toEqual(prior[key]);
  expect(s.ironBloodKnight.encounter).toEqual(prior.ironBloodKnight.encounter);expect(s.ironBloodKnight.team.members).toEqual(prior.ironBloodKnight.team.members);
  expect(Object.keys(s.progression.mastery).filter(id=>!Object.hasOwn(prior.progression.mastery,id))).toEqual(['hunter.s3.formation-link','hunter.s3.coordinated-action']);
  const p=projectSliceState(s);expect(p.ironBloodKnight.acting).toBe(100);expect(p.reaper.acting).toBe(100);expect(p.warBishop.abilities.map(a=>a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
 });
 it('replays actual saved boundaries through their original public intent without mutating input',()=>{
  const data=JSON.parse(readFileSync('tests/fixtures/war-bishop-v01410/boundaries.json','utf8')) as Record<string,{beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState}>;
  for(const b of Object.values(data)){b.beforeLast=migrateSliceState(b.beforeLast);b.final=migrateSliceState(b.final);assertValidSliceState(b.beforeLast);assertValidSliceState(b.final);const bytes=JSON.stringify(b.beforeLast);expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final);expect(JSON.stringify(b.beforeLast)).toBe(bytes);}
 },30000);
 it('has actual three-case completion and keeps real members, tools and independent enemy resource outcomes',()=>{
  const data=read(),s=data.practiced as SliceState;assertValidSliceState(s);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.warBishop.life.cases).every(c=>c.status==='RESOLVED')).toBe(true);expect(s.ironBloodKnight.team.members.filter(m=>m.present)).toHaveLength(0);
  const final=data.final as SliceState;assertValidSliceState(final);expect(final.combat).toBeNull();expect(final.warBishop.encounter.status).not.toBe('FIGHTING');
  expect(final.ironBloodKnight.encounter).toEqual(old().final.ironBloodKnight.encounter);expect(final.ironBloodKnight.team.members.map(m=>m.id)).toEqual(old().final.ironBloodKnight.team.members.map((m:{id:string})=>m.id));
  expect(final.combatHistory.some(r=>r.warBishopOutcome)).toBe(true);
 });
 it('does not allow the promoted original body to consume an unusedS4 bottle again',()=>{
  const s=read().promoted as SliceState,bytes=JSON.stringify(s),b=s.ironBloodKnight.bottles.find(b=>b.status==='SUPPLIER'||b.status==='PLAYER')!;
  expect(()=>applySliceIntent(s,{type:'IRON_BLOOD_KNIGHT',command:{type:'BUY_POTION',bottleId:b.id}})).toThrow();expect(JSON.stringify(s)).toBe(bytes);
 });
});
