import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);else if(value&&typeof value==='object'&&key.endsWith('Boundary'))capture[key]=currentCapture(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "spirit-guide-stage-natural": "tests/fixtures/spirit-guide-v0820/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('spirit guide actual shared route',()=>{
 it('retains earlier actual routes and the finite original letter and reply',()=>{
  const s=read('spirit-guide-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.spiritGuide.promotionWeek).toBeGreaterThanOrEqual(s.spiritmedium.promotionWeek!+12);
  expect(s.spiritGuide.spiritmediumActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.spiritGuide.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.spiritGuide.messenger).toMatchObject({recruited:true,deliveries:1,letter:'RECIPIENT',replyReceived:true,feePaid:12});
  expect(projectSliceState(s).maxSpirituality).toBe(80);
 });
 it.each(['promotion','recruit','delivery','close','report','combat'])('replays %s from its original boundary',key=>{
  const b=read(`spirit-guide-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps contact explicit and the same original letter and reply after closing',()=>{
  const b=read('spirit-guide-delivery-save-boundary'),s=b.final as SliceState;
  expect(s.spiritGuide.messenger).toMatchObject({recruited:true,letter:'RECIPIENT',replyReceived:true,deliveries:1,feePaid:12});
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  expect(()=>applySliceIntent(s,{type:'SPIRIT_GUIDE',command:{type:'REPORT',caseId:'short-delivery'}})).toThrow();
  const after=applySliceIntent(s,{type:'SPIRIT_GUIDE',command:{type:'CLOSE',caseId:'short-delivery'}});
  expect(after.spiritGuide.messenger).toEqual(s.spiritGuide.messenger);expect(projectSliceState(after).spiritGuide.insideCase).toBe(false);
 });
 it('keeps combat as its own adult and preserves prior carrier and ordinary tool facts',()=>{
  const c=read('spirit-guide-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);expect(c.final.spiritGuide.messenger).toEqual(c.combatStart.spiritGuide.messenger);
 });
 it('migrates complete prior Notary save without changing its actual injuries and death',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/notary-v0810/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.spiritGuide.promotionWeek).toBeNull();
  const{spiritGuide:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;expectPriorFields(current,old);
 });
});
