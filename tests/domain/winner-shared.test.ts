import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='winner-stage-natural'?JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/winner-v01130/boundaries.json','utf8'))[name.slice(7,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Winner real public chain',()=>{
 it('retains S6 history, pays actual accumulated luck and returns the original practice objects',()=>{
  const c=read('winner-stage-natural'),s=c.practiced as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.calamityPriest).toEqual(c.guidanceStart.calamityPriest);
  expect(s.winner.practice).toEqual({counter:'GUIDE',ring:'OWNER',note:'HANDED_OVER'});
  expect(s.winner.luck.spent).toBeGreaterThanOrEqual(2);expect(s.winner.luck.stored).toBe(s.winner.luck.accumulated-s.winner.luck.spent);
  expect(Object.values(s.winner.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);expect(projectSliceState(s).winner.insideCase).toBe(false);
 });
 it.each(['promotion','accumulate','counter','ill-fortune','account','close','report','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`winner-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps distinct carrier facts and ends only the bounded enemy hesitation',()=>{
  const c=read('winner-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(c.combatStart.combat.encounterId).toBe('WINNER_DISPUTE');expect(c.combatStart.winner.luck.stored).toBe(3);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.winner.encounter.staggerReady).toBe(false);expect(s.winner.luck.stored).toBeLessThanOrEqual(c.combatStart.winner.luck.stored);
  expect(projectSliceState(s).winner.abilities.filter(a=>a.id.startsWith('wheel.s5.')).map(a=>a.id)).toEqual(['wheel.s5.luck-reserve','wheel.s5.ill-fortune']);
 });
 it('migrates0.112 without rewriting any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/wraith-v01120/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
