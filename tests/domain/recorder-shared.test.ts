import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "recorder-stage-natural": "tests/fixtures/recorder-v0830/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('recorder actual shared route',()=>{
 it('retains original demonstrations, spent records, and full earlier growth',()=>{
  const s=read('recorder-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.recorder.promotionWeek).toBeGreaterThanOrEqual(s.astrologer.promotionWeek!+12);
  expect(s.recorder.astrologerActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.recorder.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  for(const r of s.recorder.records)expect(s.recorder.demonstrations.some(d=>d.id===r.sourceDemoId&&d.success&&d.sample===r.sample)).toBe(true);
  expect(s.recorder.records.filter(r=>r.status==='RELEASED').length).toBeGreaterThanOrEqual(2);
  expect(projectSliceState(s).recorder.capacities.map(c=>c.maximum)).toEqual([20,8,1]);
 });
 it.each(['promotion','record','release','close','report','combat'])('replays %s from its original boundary',key=>{
  const b=read(`recorder-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('requires explicit close after use and never restores the spent original',()=>{
  const b=read('recorder-release-save-boundary'),s=b.final as SliceState;
  expect(s.recorder.records.filter(r=>r.status==='RELEASED').length).toBe(b.beforeLast.recorder.records.filter((r:{status:string})=>r.status==='RELEASED').length+1);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  expect(()=>applySliceIntent(s,{type:'RECORDER',command:{type:'REPORT',caseId:b.lastIntent.command.caseId}})).toThrow();
  const after=applySliceIntent(s,{type:'RECORDER',command:{type:'CLOSE',caseId:b.lastIntent.command.caseId}});
  expect(after.recorder.records).toEqual(s.recorder.records);expect(projectSliceState(after).recorder.insideCase).toBe(false);
 });
 it('rejects a nonexistent or previously spent battle selection without changing input',()=>{
  const c=read('recorder-stage-natural'),s=c.combatStart as SliceState,before=structuredClone(s);
  expect(()=>applySliceIntent(s,{type:'COMBAT_ROUND',stance:'CONTROL',recordingId:'unknown-record'})).toThrow();
  const used=s.recorder.records.find(r=>r.status==='RELEASED');expect(used).toBeTruthy();
  expect(()=>applySliceIntent(s,{type:'COMBAT_ROUND',stance:'CONTROL',recordingId:used!.id})).toThrow();expect(s).toEqual(before);
 });
 it('preserves original carrier, tool and demonstration facts through combat',()=>{
  const c=read('recorder-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);expect(c.final.recorder.demonstrations).toEqual(c.combatStart.recorder.demonstrations);
 });
 it('migrates the complete prior SpiritGuide save without changing any prior facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/spirit-guide-v0820/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.recorder.promotionWeek).toBeNull();
  const{recorder:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;expectPriorFields(current,old);
 });
});
