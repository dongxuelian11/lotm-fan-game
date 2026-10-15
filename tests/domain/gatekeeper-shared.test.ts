import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "gatekeeper-stage-natural": "tests/fixtures/gatekeeper-v01040/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('Gatekeeper actual shared route',()=>{
 it('keeps old original letter and one-delivery agreement intact while establishing a new shelter agreement',()=>{
  const c=read('gatekeeper-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.gatekeeper.spiritGuideActingAtPromotion).toBe(100);
  for(const key of ['corpsecollector','gravedigger','spiritmedium','spiritGuide'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(projectSliceState(s).spiritGuide.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['death.s5.inner-underworld','death.s5.underworld-door']);expect(projectSliceState(s).gatekeeper.abilities).toHaveLength(oldIds.length+2);
  expect(c.promoted.gatekeeper.companion.status).toBe('OUTSIDE');expect(c.promoted.gatekeeper.companion.entries).toBe(0);
  expect(c.practiced.gatekeeper.companion.status).toBe('OUTSIDE');expect(c.combatStart.gatekeeper.companion.status).toBe('INSIDE');
  expect(s.gatekeeper.practice.marker).toBe('DESK');expect(s.gatekeeper.practice.gateOpen).toBe(false);
  expect(Object.values(s.gatekeeper.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
 });
 it.each(['promotion','invite','release','recall','return','prepare','effect','gate','close','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`gatekeeper-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('recalls the original spirit without moving the delivered original marker',()=>{
  const b=read('gatekeeper-recall-save-boundary'),s=b.beforeLast as SliceState,after=b.final as SliceState;
  expect(s.gatekeeper.companion.status).toBe('DEPLOYED');expect(after.gatekeeper.companion.status).toBe('INSIDE');
  expect(after.gatekeeper.practice.marker).toBe(s.gatekeeper.practice.marker);expect(after.spiritGuide.messenger).toEqual(s.spiritGuide.messenger);
 });
 it('performs actual door practice only after the original spirit has left the body',()=>{
  const b=read('gatekeeper-gate-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.gatekeeper.companion.status).toBe('OUTSIDE');expect(s.gatekeeper.practice.marker).toBe('DESK');
  expect(b.final.gatekeeper.practice.gateOpen).toBe(true);
 });
 it('retains the original first-case body across the independent optional scene',()=>{
  const c=read('gatekeeper-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('GATEKEEPER_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
 });
 it('migrates 0.103 without changing any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/priest-of-light-v01030/natural.json','utf8')).final;
  const after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(176);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  expect(migrateSliceState(after)).toEqual(after);
 });
});
