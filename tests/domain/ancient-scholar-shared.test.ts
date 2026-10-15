import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {applySliceIntent,assertValidSliceState,createSliceRun,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
const data=JSON.parse(readFileSync('tests/fixtures/ancient-scholar-v01400/natural.json','utf8'));
const bounds=JSON.parse(readFileSync('tests/fixtures/ancient-scholar-v01400/boundaries.json','utf8')) as Record<string,{beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState}>;
for(const [key,value] of Object.entries(data))if(value&&typeof value==='object'&&'schemaVersion' in value)data[key]=migrateSliceState(value);
for(const b of Object.values(bounds)){b.beforeLast=migrateSliceState(b.beforeLast);b.final=migrateSliceState(b.final);}
describe('Ancient scholar actual public route and inherited original facts',()=>{
 it('replays all public commands from original creation including failure, actual centuries and original battle',()=>{
  let s=createSliceRun(data.final.runId,data.creation,data.seed);for(const c of data.commands)s=applySliceIntent(s,c);assertValidSliceState(s);expect(s).toEqual(data.final);
  expect(s.progression.sequence).toBe(3);expect(s.ancientScholar.bottles.map(b=>b.outcome)).toEqual(['FAILURE','SUCCESS',null]);expect(s.ancientScholar.encounter.terminal?.outcome).toBe('ENEMY_SURRENDERED');
 },30000);
 it('all captured private boundary states are valid and their original command produces the same full state',()=>{
  for(const b of Object.values(bounds)){assertValidSliceState(b.beforeLast);assertValidSliceState(b.final);expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final);}
 },30000);
 it('retains the 461-command old history, original objects and actual 300-year local clock',()=>{
  const s=data.final as SliceState,old=data.departureStart as SliceState;
  expect(data.prefixCount).toBe(461);expect(data.full300.date.year-data.sealed.date.year).toBe(300);
  expect(s.ancientScholar.ritual.visits[0]?.milestones.map(m=>m.communication)).toEqual(['NONE','NONE']);
  expect(s.bizarroSorcerer.life.practice.tag).toEqual(old.bizarroSorcerer.life.practice.tag);
  expect(s.bizarroSorcerer.life.practice.carrier).toEqual(old.bizarroSorcerer.life.practice.carrier);
  expect(s.marionettist.puppet).toEqual(old.marionettist.puppet);expect(s.caseArchive).toEqual(old.caseArchive);
  expect(s.ancientScholar.ritual.people.some(p=>p.id==='AS3-MARA'&&p.kind==='DEATH')).toBe(true);
  expect(s.ancientScholar.ritual.successorId).toBe('AS3-ELIN');
 });
 it('blocks old contacts, purchases and ordinary work after centuries without changing input',()=>{
  for(const s of [data.sealed,data.first150,data.full300,data.practiced,data.final] as SliceState[]){const original=JSON.stringify(s);for(const c of [{type:'ACTION',action:'WORK'},{type:'MAGICIAN',command:{type:'BUY_OIL'}},{type:'FACELESS',command:{type:'RESTORE_SELF'}}] as SliceIntent[])expect(()=>applySliceIntent(s,c)).toThrow();expect(JSON.stringify(s)).toBe(original);}
 });
 it('migrates original 137 save without inventing isolation and exposes present plus inherited abilities',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/long-chapter-v01390/natural.json','utf8')).final,bytes=JSON.stringify(old),current=migrateSliceState(old);
  expect(current.schemaVersion).toBe(176);expect(current.ancientScholar.ritual.visits).toEqual([]);
  expect(old.longChapter).not.toHaveProperty('handoff');
  const {handoff,...preservedLongChapter}=current.longChapter;
  expect(handoff).toBeNull();expect(preservedLongChapter).toEqual(old.longChapter);expect(JSON.stringify(old)).toBe(bytes);
  const p=projectSliceState(data.practiced);expect(p.ancientScholar.promoted).toBe(true);expect(p.ancientScholar.acting).toBe(100);expect(p.bizarroSorcerer.acting).toBe(100);expect(p.canAct).toBe(false);
 });
});
