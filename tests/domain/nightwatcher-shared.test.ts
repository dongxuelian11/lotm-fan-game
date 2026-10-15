import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const capture=JSON.parse(readFileSync(`tests/fixtures/nightwatcher-v01220/shared-${name}.json`,'utf8'));for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
describe('Nightwatcher actual original Darkness continuity',()=>{
 it('preserves every earlier original at promotion and only adds two new skill IDs',()=>{
  const c=read('stage-natural'),s=c.promoted as SliceState;assertValidSliceState(s);expect(s.progression.sequence).toBe(4);expect(s.nightwatcher.spiritWarlockActingAtPromotion).toBe(100);expect(s.nightwatcher.promotionWeek).toBeGreaterThanOrEqual(s.spiritWarlock.promotionWeek!+12);
  for(const key of ['sleepless','midnight','nightmare','soother','spiritWarlock'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['darkness.s4.limited-misfortune','darkness.s4.area-dream']);expect(s.character.gender).toBe(c.guidanceStart.character.gender);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).spiritWarlock.acting).toBe(100);
 });
 it.each(['book','open','check','promotion','effect','cart-return','dream','stop','spirit','recall','note-return','close','report','combat'])('replays actual %s with complete state and JSON equality',key=>{
  const b=read(`${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('uses the same independently acquired old spirit, retains prior notes and returns the new original note',()=>{
  const c=read('stage-natural'),s=c.practiced as SliceState;expect(s.progression.acting).toBe(100);expect(s.spiritWarlock.companion.source).toBe('SW5-LEAF-1');expect(s.spiritWarlock.companion.acquiredWeek).toBe(c.guidanceStart.spiritWarlock.companion.acquiredWeek);expect(s.spiritWarlock.companion.deployments).toBeGreaterThan(c.guidanceStart.spiritWarlock.companion.deployments);expect(s.spiritWarlock.companion.deployments).toBe(s.spiritWarlock.companion.recalls);expect(s.spiritWarlock.companion.status).toBe('SEALED');expect(s.spiritWarlock.practice).toEqual(c.guidanceStart.spiritWarlock.practice);expect(s.spiritWarlock.cases).toEqual(c.guidanceStart.spiritWarlock.cases);
  expect(s.nightwatcher.life.practice.note.location).toBe('TABLE');expect(Object.values(s.nightwatcher.life.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);expect(projectSliceState(s).nightwatcher.insideCase).toBe(false);
 });
 it('blocks ordinary work during the actual new deployment and accepts its own true recall command',()=>{
  const b=read('spirit-save-boundary'),s=b.final as SliceState;expect(s.spiritWarlock.companion.status).toBe('DEPLOYED');expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();const after=applySliceIntent(s,{type:'NIGHTWATCHER',command:{type:'RECALL_SPIRIT'}});expect(after.spiritWarlock.companion.status).toBe('SEALED');expect(after.spiritWarlock.companion.recalls).toBe(s.spiritWarlock.companion.recalls+1);expect(after.nightwatcher.life.practice.note).toEqual(s.nightwatcher.life.practice.note);
 });
 it('settles the real Bram encounter once, with all old opponents and carrier unchanged',()=>{
  const c=read('stage-natural'),s=c.final as SliceState;expect(s.combat).toBeNull();expect(s.nightwatcher.encounter.enemy.id).toBe('NW4-BRAM');expect(s.nightwatcher.encounter.enemy.weaponId).toBe('NW4-BRAM-CLUB');expect(s.spiritWarlock.encounter).toEqual(c.guidanceStart.spiritWarlock.encounter);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(s.seer.completedSources.filter(x=>x.startsWith('nightwatcher-combat-victory:'))).toHaveLength(1);expect(s.spiritWarlock.companion.status).not.toBe('DEPLOYED');
 });
 it('migrates prior0.121 preserving every prior item, history, paper and original person',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/witch-king-v01210/natural.json','utf8')).final,current=migrateSliceState(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((current as any)[key]).toEqual(old[key]);expect(current.nightwatcher.promotionWeek).toBeNull();expect(migrateSliceState(current)).toEqual(current);
 });
});
