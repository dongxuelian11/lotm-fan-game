import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
const currentCapture=(v:any)=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x&&typeof x==='object'&&'schemaVersion'in x&&'runId'in x?migrateSliceState(x):x]));
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>currentCapture(name==='guardian-stage-natural'?JSON.parse(readFileSync('tests/fixtures/guardian-v01070/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/guardian-v01070/boundaries.json','utf8'))[name.replace('guardian-','').replace('-save-boundary','')]);
describe('Guardian real public chain',()=>{
 it('preserves original S6 facts and completes three concrete protective practices',()=>{
  const c=read('guardian-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.dawnPaladin).toEqual(c.guidanceStart.dawnPaladin);
  const p=s.guardian.practice;expect(p.guardActive).toBe(false);expect(p.allyPresent).toBe(false);expect(p.allyDistance).toBe(null);
  expect(p.playerDamageTaken).toBeGreaterThan(0);expect(p.sharedDamage).toBe(3);expect(p.allyHealth).toBe(100-p.allyDamageTaken);expect(p.playerAttacked).toBe(true);expect(p.target).toBe('MARKED');
  expect(Object.values(s.guardian.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['promotion','prepare','guard','attack','sharing','close','report','combat-defense','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`guardian-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('does not fake an ally in the optional single-opponent battle or copy original equipment',()=>{
  const c=read('guardian-stage-natural'),s=c.practiced as SliceState;
  expect(s.warrior.practiceClub).toEqual(c.guidanceStart.warrior.practiceClub);
  const p=projectSliceState(s);expect(p.guardian.abilities.filter(a=>a.id.startsWith('warrior.s5.')).map(a=>a.id)).toEqual(['warrior.s5.guard-state','warrior.s5.damage-sharing']);
  const first=c.final.combatHistory[c.practiced.combatHistory.length];expect(first.stance).toBe('DEFEND');
  expect(c.combatStart.combat.encounterId).toBe('GUARDIAN_DISPUTE');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
 });
 it('migrates0.106 without rewriting any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
