import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
const c=JSON.parse(readFileSync(new URL('../fixtures/clown-v050/natural.json',import.meta.url),'utf8'));
for(const k of ['final','beforeRescue','combatStart'])c[k]=migrateSliceState(c[k]);c.paperBoundary.before=migrateSliceState(c.paperBoundary.before);c.paperBoundary.after=migrateSliceState(c.paperBoundary.after);
describe('Clown real shared checkpoints',()=>{
 it('retains the actual paper use, nine known abilities and the prior case archive',()=>{assertValidSliceState(c.final);expect(c.paperBoundary.after.clown.paperSheets).toBe(c.paperBoundary.before.clown.paperSheets-1);expect(c.paperBoundary.after.clown.paperSpent).toBe(c.paperBoundary.before.clown.paperSpent+1);expect(applySliceIntent(c.paperBoundary.before,c.paperBoundary.intent)).toEqual(c.paperBoundary.after);expect(projectSliceState(c.final).clown.abilities).toHaveLength(9);expect(c.final.caseArchive).toEqual(c.beforeRescue.caseArchive);});
 it('can instead attempt the public negotiation without starting combat or transferring the parcel',()=>{const s=applySliceIntent(c.beforeRescue,{type:'CLOWN',command:{type:'RESCUE_TALK'}});assertValidSliceState(s);expect(s.combat).toBeNull();expect(s.clown.rescue.parcelOwner).toBe('courier-elsie');expect(s.clown.rescue.parcelHolder).toBe('COURIER');expect(['AVAILABLE','RESCUED']).toContain(s.clown.rescue.status);if(s.clown.rescue.status==='RESCUED')expect(()=>applySliceIntent(s,{type:'CLOWN',command:{type:'RESCUE_FIGHT'}})).toThrow();else expect(()=>applySliceIntent(s,{type:'CLOWN',command:{type:'RESCUE_TALK'}})).toThrow();});
 it('actual retreat requests keep the courier ownership and never reset the old case',()=>{let s=structuredClone(c.combatStart);for(let n=0;n<20&&s.combat;n++)s=applySliceIntent(s,{type:'COMBAT_ROUND',stance:'RETREAT'});assertValidSliceState(s);expect(s.combat).toBeNull();expect(['RETREATED','LOST']).toContain(s.clown.rescue.status);expect(s.clown.rescue.parcelOwner).toBe('courier-elsie');expect(s.clown.paperSpent).toBe(c.combatStart.clown.paperSpent);expect(s.caseArchive).toEqual(c.combatStart.caseArchive);expect(s.seer.completedSources).not.toContain('clown-rescue');});
 it('migrates the actual 0.4.0 complete commission save without changing old facts',()=>{
  const old=JSON.parse(readFileSync(new URL('../fixtures/seer-v040/natural.json',import.meta.url),'utf8')),bytes=JSON.stringify(old.final);
  const s=migrateSliceState(old.final),back:Record<string,unknown>=structuredClone(s) as unknown as Record<string,unknown>;
  const fresh=createSliceRun(old.final.runId,old.creation,old.seed),defaults=fresh as unknown as Record<string,unknown>;
  // Every current root must exist, and every root absent from this genuine v3 save must be a fresh default.
  expect(Object.keys(s).sort()).toEqual(Object.keys(fresh).sort());
  for(const key of Object.keys(back))if(!Object.hasOwn(old.final,key)){expect(back[key],key).toEqual(defaults[key]);delete back[key];}
  expect(s.seer.resupply).toEqual({requestedWeek:null,deliveries:0});delete (back.seer as Record<string,unknown>).resupply;
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  back.schemaVersion=old.final.schemaVersion;back.contentVersion=old.final.contentVersion;
  expect(back).toEqual(old.final);expect(JSON.stringify(old.final)).toBe(bytes);
  expect(migrateSliceState(s)).toEqual(s);assertValidSliceState(s);
 });
});
