import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "potion-professor-stage-natural": "tests/fixtures/potion-professor-v0770/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('potion professor actual shared route',()=>{
 it('retains actual lower sequences and independent S6 promotion',()=>{
  const s=read('potion-professor-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.potionProfessor.promotionWeek).toBeGreaterThanOrEqual(s.vampire.promotionWeek!+12);
  expect(s.potionProfessor.vampireActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.potionProfessor.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
  expect(Object.values(s.potionProfessor.laboratory.effects).every(v=>!v)).toBe(true);
 });
 it.each(['promotion','brew','use','close','report','combat'])('replays %s from its exact original boundary',key=>{
  const b=read(`potion-professor-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('actually consumes material to make one bottle then uses that original',()=>{
  const b=read('potion-professor-brew-save-boundary');
  expect(b.final.potionProfessor.laboratory.materials).toBe(b.beforeLast.potionProfessor.laboratory.materials-1);
  expect(b.final.potionProfessor.laboratory.potions.length).toBe(b.beforeLast.potionProfessor.laboratory.potions.length+1);
  const u=read('potion-professor-use-save-boundary');const p=u.final.potionProfessor.laboratory.potions.find((p:any)=>p.usedWeek!==null);
  expect(p.status).toBe('USED');expect(u.beforeLast.potionProfessor.laboratory.potions.find((q:any)=>q.id===p.id).status).toBe('PLAYER');
  expect(projectSliceState(u.final).town.items.some(x=>x.id===p.id)).toBe(false);
 });
 it('does not carry temporary practice effects or consume assistance bottles in battle',()=>{
  const c=read('potion-professor-stage-natural');expect(c.final.potionProfessor.laboratory).toEqual(c.combatStart.potionProfessor.laboratory);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(Object.values(c.combatStart.potionProfessor.laboratory.effects).every(x=>x===false)).toBe(true);
 });
 it('keeps actual S6 food supply and limited regeneration reachable',()=>{
  const c=read('potion-professor-stage-natural'),s=migrateSliceState(c.practiced);
  const p=projectSliceState(s);expect(p.vampire.actions.some(a=>a.command.type==='BUY_BLOOD')).toBe(true);
  expect(p.vampire.actions.some(a=>a.command.type==='FEED')).toBe(true);
  expect(p.vampire.actions.some(a=>a.command.type==='PRACTICE')).toBe(false);
  if(s.actionsRemaining>0&&s.cash>=24){const after=applySliceIntent(s,{type:'VAMPIRE',command:{type:'BUY_BLOOD'}});expect(after.vampire.blood.held).toBe(s.vampire.blood.held+1);assertValidSliceState(after);}
 });
 it('migrates prior complete Artisan save without changing its original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/artisan-v0760/natural.json','utf8')).final;
  const current=migrateSliceState(old);expect(current.potionProfessor.promotionWeek).toBeNull();
  expectPriorFields(current,old);
 });
});
