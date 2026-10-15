import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "traveler-stage-natural": "tests/fixtures/traveler-v01050/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('Traveler real public chain',()=>{
 it('preserves original Recorder history and completes actual four-site preparation',()=>{
  const c=read('traveler-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);
  expect(c.promoted.recorder).toEqual(c.guidanceStart.recorder);
  expect(Object.values(s.traveler.ritual.coordinates).every(r=>r.placedWeek!==null)).toBe(true);
  expect(s.traveler.ritual.at).toBe('HOME');expect(s.traveler.ritual.journeys).toBe(4);expect(s.traveler.ritual.returns).toBe(4);expect(s.traveler.ritual.feePaid).toBe(320);
  expect(s.traveler.practice.position).toBe('ENTRY');expect(s.traveler.practice.card).toBe('DESK');expect(s.traveler.practice.companionPosition).toBe('ENTRY');expect(s.traveler.practice.consent).toBe(false);
  expect(Object.values(s.traveler.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['promotion','depart','coordinate','ritual-return','prepare','travel','hand','companion','close','report','record','combat'])('replays actual %s and complete save shape',key=>{
  const b=read(`traveler-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps actual recorder sources and raises only divine capacity to four',()=>{
  const c=read('traveler-stage-natural'),p=projectSliceState(c.promoted);expect(p.recorder.capacities.map(c=>c.maximum)).toEqual([20,8,4]);expect(p.recorder.demonstrations?.length).toBe(c.promoted.recorder.demonstrations.length);
  const b=read('traveler-record-save-boundary');expect(b.final.recorder.demonstrations.length).toBe(b.beforeLast.recorder.demonstrations.length+1);expect(b.final.progression.acting).toBe(b.beforeLast.progression.acting);
 });
 it('preserves original first-case carrier independently of Belan',()=>{const c=read('traveler-stage-natural');expect(c.combatStart.combat.encounterId).toBe('TRAVELER_DISPUTE');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);});
 it('migrates 0.104 preserving every prior field',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/gatekeeper-v01040/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
