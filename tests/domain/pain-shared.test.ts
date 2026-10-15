import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const currentCapture=(v:any)=>{for(const k of Object.keys(v))if(v[k]&&typeof v[k]==='object'&&'schemaVersion'in v[k])v[k]=migrateSliceState(v[k]);return v;};
const read=(name:string)=>currentCapture(name.endsWith('-stage-natural')?JSON.parse(readFileSync('tests/fixtures/pain-v01080/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/pain-v01080/boundaries.json','utf8'))[name.slice('pain-'.length,-'-save-boundary'.length)]);
describe('Pain real public chain',()=>{
 it('preserves original S6 facts/body change and completes three non-infectious physical simulations',()=>{
  const c=read('pain-stage-natural'),s=c.practiced as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.pleasure).toEqual(c.guidanceStart.pleasure);expect(s.witch).toEqual(c.promoted.witch);
  const p=s.pain.practice;expect(p.simulatedOnly).toBe(true);expect(p.playerNode).toBe('ENTRY');expect(p.companionNode).toBe('WAITING');expect(p.marker).toBe('RACK');expect(p.tableRows).toBe(3);expect(p.careNote).toBe('HANDED_OVER');
  expect(s.progression.mastery).toEqual(c.promoted.progression.mastery);expect(s.pain.encounter.enemyDisease).toBe(0);expect(s.pain.encounter.diseaseApplications).toBe(0);
  expect(Object.values(s.pain.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['promotion','prepare','exit','table','handoff','close','report','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`pain-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('does not erase real infection on exit or present the original carrier as Oren',()=>{
  const c=read('pain-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.pain.encounter.fieldActive).toBe(false);
  expect(s.pain.encounter.enemyDisease).toBe(s.combatHistory.at(-1)!.painOutcome!.enemyDisease);
  expect(c.combatStart.combat.encounterId).toBe('PAIN_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  const p=projectSliceState(s);expect(p.pain.abilities.filter(a=>a.id.startsWith('assassin.s5.')).map(a=>a.id)).toEqual(['assassin.s5.disease']);
 });
 it('migrates0.107 without rewriting any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/guardian-v01070/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(174);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
