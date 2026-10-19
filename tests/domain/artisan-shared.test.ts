import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "artisan-stage-natural": "tests/fixtures/artisan-v0760/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('artisan actual shared route',()=>{
 it('retains prior path, original S6 bottle and actual finite craftsmanship',()=>{
  const c=read('artisan-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.artisan.promotionWeek).toBeGreaterThanOrEqual(s.appraiser.promotionWeek!+12);
  expect(s.artisan.appraiserActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.artisan.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
  expect(s.artisan.workshop).toMatchObject({copperShells:0,spiritualPortions:0,tests:1,delivered:true,lamp:{id:'ART6-LAMP-1',location:'CLIENT',charges:2}});
 });
 it.each(['promotion','materials','craft','test','close','delivery','combat'])('replays %s from its exact original seed and serialized boundary',key=>{
  const b=read(`artisan-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('consumes originals to create exactly one lamp and consumes its first use on actual inspection',()=>{
  const b=read('artisan-craft-save-boundary');expect(b.beforeLast.artisan.workshop.lamp).toBeNull();
  expect(b.final.artisan.workshop.copperShells).toBe(b.beforeLast.artisan.workshop.copperShells-1);
  expect(b.final.artisan.workshop.spiritualPortions).toBe(b.beforeLast.artisan.workshop.spiritualPortions-1);
  expect(b.final.spirituality).toBe(b.beforeLast.spirituality-4);expect(b.final.artisan.workshop.lamp.charges).toBe(3);
  const t=read('artisan-test-save-boundary');expect(t.final.artisan.workshop.lamp.charges).toBe(t.beforeLast.artisan.workshop.lamp.charges-1);
  expect(t.final.mind).toBe(t.beforeLast.mind-1);
 });
 it('delivers the same actual lamp and does not carry a duplicate after handover',()=>{
  const b=read('artisan-delivery-save-boundary');expect(b.beforeLast.artisan.workshop.lamp.location).toBe('PLAYER');
  expect(b.final.artisan.workshop.lamp).toEqual({...b.beforeLast.artisan.workshop.lamp,location:'CLIENT'});
  expect(projectSliceState(b.final).town.items.some(x=>x.id==='ART6-LAMP-1')).toBe(false);
 });
 it('does not turn a daily light into a battle spell or steal the opponent tool',()=>{
  const c=read('artisan-stage-natural');expect(c.final.artisan.workshop).toEqual(c.combatStart.artisan.workshop);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.combatHistory.slice(c.combatStart.combatHistory.length).flatMap((r:any)=>r.moves).some((m:any)=>/微光灯|照明攻击|附魔攻击/.test(m.label))).toBe(false);
 });
 it('migrates full prior Hypnotist save preserving its actual injuries and original choices',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/hypnotist-v0750/natural.json','utf8')).final;
  const current=migrateSliceState(old);expect(current.artisan.promotionWeek).toBeNull();
  expectPriorFields(current,old);
 });
});
