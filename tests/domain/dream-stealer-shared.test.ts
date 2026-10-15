const currentCapture=(v:any)=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x&&typeof x==='object'&&'schemaVersion'in x&&'runId'in x?migrateSliceState(x):x]));
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>currentCapture(name==='dream-stealer-stage-natural'?JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/boundaries.json','utf8'))[name.replace('dream-stealer-','').replace('-save-boundary','')]);
describe('DreamStealer real public chain',()=>{
 it('preserves old finite loans and completes actual self-execution and recovery',()=>{
  const c=read('dream-stealer-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.fireThief).toEqual(c.guidanceStart.fireThief);
  const p=s.dreamStealer.practice;expect(p.thefts).toBe(2);expect(p.executions).toBe(p.thefts);expect(p.recoveries).toBe(p.thefts);expect(p.playerPose).toBe('STANDING');expect(p.targetPaused).toBe(false);expect(p.targetRecovered).toBe(true);expect(p.token).toBe('TARGET_DESK');
  expect(Object.values(s.dreamStealer.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['promotion','prepare','seat','reach','no-mind','close','report','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`dream-stealer-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('does not turn the target intention into a copied original object or spell',()=>{
  const c=read('dream-stealer-stage-natural'),s=c.practiced as SliceState;expect(s.dreamStealer.practice.tokenMoves).toBeGreaterThanOrEqual(2);expect(s.dreamStealer.practice.tokenMoves%2).toBe(0);
  expect(s.fireThief.loan).toEqual(c.guidanceStart.fireThief.loan);expect(s.fireThief.demonstrations).toEqual(c.guidanceStart.fireThief.demonstrations);
  const p=projectSliceState(s);expect(p.dreamStealer.abilities.filter(a=>a.id.startsWith('error.s5.')).map(a=>a.id)).toEqual(['error.s5.thought-theft']);
 });
 it('preserves the independent original carrier after the new Marlow scene',()=>{const c=read('dream-stealer-stage-natural');expect(c.combatStart.combat.encounterId).toBe('DREAM_STEALER_DISPUTE');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);});
 it('migrates0.105 without rewriting any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/traveler-v01050/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(175);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
