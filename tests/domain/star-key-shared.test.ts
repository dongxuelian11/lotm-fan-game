import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createStarKeyState } from '../../src/domain/star-key/index.js';
import { STAR_KEY_ABILITY_IDS, STAR_KEY_SOURCE_KEYS } from '../../src/domain/star-key/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { originalPlaneswalker, planeswalkerBranchPath, planeswalkerNaturalPath } from './star-key-directed-helper.js';
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('Star Key current format and genuine original continuity',()=>{
 it('preserves every original171 field and initializes only genuinely missing roots',()=>{
  const old=readObjectEntry<Record<string,unknown>>(planeswalkerBranchPath,'beforeLast'),bytes=stableStringify(old),s=migrateSliceState(old);
  const creation=readObjectEntry<Parameters<typeof createSliceRun>[1]>(planeswalkerNaturalPath,'creation');
  const defaults=createSliceRun(s.runId,creation,s.random.seed) as unknown as Record<string,unknown>,current=s as unknown as Record<string,unknown>;
  const added=Object.keys(defaults).filter(k=>!Object.hasOwn(old,k));expect(added).toContain('starKey');
  expect(Object.keys(current).filter(k=>!Object.hasOwn(old,k)).sort()).toEqual([...added].sort());
  for(const k of Object.keys(old))if(k!=='schemaVersion'&&k!=='contentVersion')same(current[k],old[k]);
  for(const k of added)same(current[k],defaults[k]);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.starKey,createStarKeyState());same(migrateSliceState(s),s);expect(stableStringify(old)).toBe(bytes);assertValidSliceState(s);
 },60_000);
 it('retains all15 real skills, seven zeros and independent remote original parcel',()=>{
  const s=originalPlaneswalker(),raw=readObjectEntry<SliceState>(planeswalkerBranchPath,'beforeLast');
  expect(Object.keys(s.progression.mastery)).toHaveLength(15);expect(Object.values(s.progression.mastery).filter(x=>x===0)).toHaveLength(7);
  for(const id of STAR_KEY_ABILITY_IDS)expect(Object.hasOwn(s.progression.mastery,id)).toBe(false);
  for(const key of STAR_KEY_SOURCE_KEYS)same(s[key],raw[key]);
  expect(s.wanderer.life.packet.location).toBe('REMOTE');expect(s.planeswalker.life.site.parcel.location).toBe('ENTRY_STAND');
  same(s.injuries,[]);same(s.combatHistory,raw.combatHistory);same(s.character,raw.character);expect(projectSliceState(s).maxSpirituality).toBe(120);
 },60_000);
 it('fails closed for missing current roots, forged old roots and unknown future formats',()=>{
  const raw=readObjectEntry<Record<string,unknown>>(planeswalkerBranchPath,'beforeLast'),s=originalPlaneswalker();
  const missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.starKey;
  expect(()=>migrateSliceState(missing)).toThrow();expect(()=>assertValidSliceState(missing)).toThrow();
  const forged={...raw,starKey:createStarKeyState()},bytes=stableStringify(forged);expect(()=>migrateSliceState(forged)).toThrow();expect(stableStringify(forged)).toBe(bytes);
  expect(()=>migrateSliceState({...s,schemaVersion:CURRENT_SCHEMA_VERSION+1})).toThrow();expect(()=>assertValidSliceState({...s,contentVersion:'unknown-future'})).toThrow();
 },60_000);
 it('requires exact command payload and independent bottle confirmation',()=>{
  for(const command of [{type:'LEARN_GUIDANCE'},{type:'PREPARE_TASK',taskId:'VERIFY_ORIGINALS'},{type:'CONSUME',bottleId:'star-key-potion-1',confirmed:true}])expect(validateSlicePayload({type:'STAR_KEY',command})).toBe(true);
  for(const command of [{type:'LEARN_GUIDANCE',free:true},{type:'PREPARE_TASK',taskId:'LOCATE_ANYTHING'},{type:'CONSUME',bottleId:'star-key-potion-1',confirmed:false},{type:'CONFIRM_TRANSFORMATION',confirmed:true}])expect(validateSlicePayload({type:'STAR_KEY',command})).toBe(false);
 });
});
