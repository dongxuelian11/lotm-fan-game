import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(`tests/fixtures/spirit-warlock-v01000/shared-${name.replace('spirit-warlock-','')}.json`,'utf8')));
describe('Spirit Warlock actual shared route',()=>{
 it('preserves original Darkness histories, mastery and S6 digestion while acquiring one actual spirit',()=>{
  const c=read('spirit-warlock-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.spiritWarlock.sootherActingAtPromotion).toBe(100);
  expect(s.spiritWarlock.promotionWeek).toBeGreaterThanOrEqual(s.soother.promotionWeek!+12);
  for(const key of ['sleepless','midnight','nightmare','soother'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).soother.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['darkness.s5.spirit-shelter','darkness.s5.spirit-assistance','darkness.s5.spirit-coordination']);
  expect(projectSliceState(s).spiritWarlock.abilities).toHaveLength(oldIds.length+3);
  expect(c.promoted.spiritWarlock.companion.status).toBe('UNMET');
  expect(Object.values(s.spiritWarlock.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.spiritWarlock.practice.note).toBe('TABLE');expect(s.spiritWarlock.practice.dreamOpen).toBe(false);
  expect(s.spiritWarlock.practice.deliveries).toBe(s.spiritWarlock.practice.returns);expect(s.spiritWarlock.practice.returns).toBeGreaterThan(0);
  expect(s.spiritWarlock.companion.source).toBe('SW5-LEAF-1');expect(s.spiritWarlock.companion.releases).toBe(1);
 });
 it.each(['promotion','recruit','prepare','effect','close','return','report','release','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`spirit-warlock-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps delivered original note in place until an actual zero-AP retrieval',()=>{
  const b=read('spirit-warlock-return-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.spiritWarlock.practice.note).toBe('RECIPIENT');expect(s.spiritWarlock.practice.dreamOpen).toBe(false);
  expect(projectSliceState(s).spiritWarlock.insideCase).toBe(true);expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  const after=applySliceIntent(s,b.lastIntent);expect(after.spiritWarlock.practice.note).toBe('TABLE');
  expect(after.spiritWarlock.practice.returns).toBe(s.spiritWarlock.practice.returns+1);
 });
 it('releases the same original spirit without granting another spirit or erasing prior deliveries',()=>{
  const b=read('spirit-warlock-release-save-boundary'),s=b.final as SliceState;
  expect(s.spiritWarlock.companion.status).toBe('RELEASED');expect(s.spiritWarlock.companion.source).toBe(b.beforeLast.spiritWarlock.companion.source);
  expect(s.spiritWarlock.practice).toEqual(b.beforeLast.spiritWarlock.practice);
  expect(s.progression.mastery).toEqual(b.beforeLast.progression.mastery);
 });
 it('keeps the new actual opponent separate from the original first-case carrier',()=>{
  const c=read('spirit-warlock-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('SPIRIT_WARLOCK_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.spiritWarlock.encounter.dreamLocked).toBe(false);expect(s.spiritWarlock.encounter.pressure).toBe(0);
  expect(s.spiritWarlock.companion.status).toBe('SEALED');
 });
 it('migrates the exact 0.99 original save without changing any prior pathway or original object',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/crimson-scholar-v0990/natural.json','utf8')).final;
  const after=migrateSliceState(old);assertValidSliceState(after);
  expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);expect(after.spiritWarlock.promotionWeek).toBeNull();
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  expect(migrateSliceState(after)).toEqual(after);
 });
});
