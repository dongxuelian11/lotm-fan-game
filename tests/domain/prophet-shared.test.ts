import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const capture=JSON.parse(readFileSync(`tests/fixtures/prophet-v01230/shared-${name}.json`,'utf8'));for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
describe('Prophet actual uncertain forecasts and original Reader continuity',()=>{
 it('promotes without replacing any original sample, craft, old scene or body',()=>{
  const c=read('stage-natural'),s=c.promoted as SliceState;assertValidSliceState(s);expect(s.progression.sequence).toBe(4);expect(s.prophet.mysticismMagisterActingAtPromotion).toBe(100);expect(s.prophet.promotionWeek).toBeGreaterThanOrEqual(s.mysticismMagister.promotionWeek!+12);
  for(const key of ['reader','reasoner','detective','polymath','mysticismMagister'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['reader.s4.fragmentary-foresight','reader.s4.symbolic-interpretation']);expect(s.character.gender).toBe(c.guidanceStart.character.gender);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).mysticismMagister.acting).toBe(100);
 });
 it.each(['book','open','check','promotion','omen','interpret','close','waiting','verify','return','dream','stop','parcel','meet','decline','help','helper-verify','report','combat'])('replays actual %s with complete state and JSON equality',key=>{
  const b=read(`${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps a recorded hypothesis separate from a later real opening and manually returns the fallen original pages',()=>{
  const close=read('waiting-save-boundary').final as SliceState,verify=read('verify-save-boundary'),ret=read('return-save-boundary');
  expect(close.prophet.life.cases['loose-shutter'].status).toBe('WAITING');expect(close.prophet.life.cases['loose-shutter'].actual).toBe('NONE');expect(projectSliceState(close).prophet.insideCase).toBe(false);
  expect(verify.final.prophet.life.cases['loose-shutter'].verifiedWeek).toBeGreaterThan(verify.final.prophet.life.cases['loose-shutter'].recordedWeek);expect(verify.final.prophet.life.cases['loose-shutter'].actual).toBe('RATTLED');expect(verify.final.prophet.life.pages.location).toBe('FLOOR');expect(ret.beforeLast.prophet.life.pages.location).toBe('FLOOR');expect(ret.final.prophet.life.pages).toEqual({...ret.beforeLast.prophet.life.pages,location:'TABLE',returns:ret.beforeLast.prophet.life.pages.returns+1});
 });
 it('uses real later delivery and actual interviews before the same original tool repairs the same pin',()=>{
  const c=read('stage-natural'),s=c.practiced as SliceState,l=s.prophet.life;expect(s.progression.acting).toBe(100);expect(l.parcel).toMatchObject({id:'PF4-PARCEL',owner:'PF4-NORA',location:'NORA',handovers:2});expect(l.pliers).toMatchObject({id:'PF4-PLIERS',owner:'PF4-JONAS',location:'JONAS',uses:1});expect(l.shutter.pin).toBe('SOUND');expect(l.people['PF4-NORA'].reply).toBe('PAPERS');expect(l.people['PF4-JONAS'].reply).toBe('REPAIR');expect(l.people['PF4-JONAS'].metWeek).not.toBeNull();expect(l.people['PF4-JONAS'].askedWeek).not.toBeNull();
  for(const r of Object.values(l.cases)){expect(r.status).toBe('RESOLVED');expect(r.verifiedWeek).toBeGreaterThan(r.recordedWeek!);expect(r.contactOpen).toBe(false);}
  expect(s.mysticismMagister).toEqual(c.guidanceStart.mysticismMagister);expect(s.polymath).toEqual(c.guidanceStart.polymath);
 });
 it('uses only actually held prior crafts in the new encounter and retains old Rowan/carrier facts',()=>{
  const c=read('stage-natural'),s=c.final as SliceState,start=c.combatStart as SliceState;expect(s.combat).toBeNull();expect(s.prophet.encounter.enemy.id).toBe('PF4-HAROLD');expect(s.mysticismMagister.encounter).toEqual(c.guidanceStart.mysticismMagister.encounter);expect(s.world.carrierAlive).toBe(start.world.carrierAlive);
  const ids=s.combatHistory.slice(start.combatHistory.length).flatMap(r=>r.prophetOutcome?.consumedCraftIds??[]);expect(new Set(ids).size).toBe(ids.length);for(const id of ids){expect(start.mysticismMagister.crafts.find(i=>i.id===id)?.status).toBe('PLAYER');expect(s.mysticismMagister.crafts.find(i=>i.id===id)?.status).toBe('CONSUMED');}expect(s.mysticismMagister.practice.kitsUsed).toBe(start.mysticismMagister.practice.kitsUsed);
 });
 it('migrates the prior0.122 full terminal without modifying any prior field',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json','utf8')).final,current=migrateSliceState(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((current as any)[key]).toEqual(old[key]);expect(current.prophet.promotionWeek).toBeNull();expect(migrateSliceState(current)).toEqual(current);
 });
});
