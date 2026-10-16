import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const capture=JSON.parse(readFileSync(`tests/fixtures/unshadowed-v01250/shared-${name}.json`,'utf8'));for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const prior=['bard','lightprayer','sunpriest','notary','priestOfLight'] as const;
describe('Unshadowed actual original emotion return and Sun continuity',()=>{
 it('keeps independent drinking at5 and requires the same original emotion returned before promotion',()=>{
  const c=read('stage-natural'),drink=read('drink-save-boundary').final as SliceState,s=c.promoted as SliceState;
  expect(drink.progression.sequence).toBe(5);expect(drink.unshadowed.promotionWeek).toBeNull();const pending=drink.unshadowed.ritual.visits.at(-1)!;
  expect(pending.phase).toBe('DRUNK');expect(pending.vessel.status).toBe('FULL');expect(pending.anchor).toMatchObject({subjectId:'UD4-MIRIEL',location:'VESSEL',felt:false,memoriesRetained:true});expect(pending.kit.status).toBe('CONSUMED');
  assertValidSliceState(s);expect(s.progression.sequence).toBe(4);expect(s.unshadowed.priestOfLightActingAtPromotion).toBe(100);const v=s.unshadowed.ritual.visits.at(-1)!;
  expect(v).toMatchObject({phase:'RETURNED',finishedSuccess:true});expect(v.vessel.status).toBe('EMPTY');expect(v.anchor).toMatchObject({subjectId:'UD4-MIRIEL',location:'RETURNED',felt:true,returnedFromVesselId:v.vessel.id});expect(v.anchor!.basis.length).toBeGreaterThan(0);
  for(const key of prior)expect(s[key]).toEqual(c.guidanceStart[key]);expect(s.character.gender).toBe(c.guidanceStart.character.gender);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).priestOfLight.acting).toBe(100);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['sun.s4.unshadowed-domain','sun.s4.purification','sun.s4.sunflare']);
 });
 it.each(['book','open','declare','separate','drink','promotion','exit','move-ally','domain','step-out','step-in','stop','purification','sunflare','cool','return-ally','close','report','combat'])('replays actual %s with full state and JSON equality',key=>{
  const b=read(`${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('walks outside without losing the original returned emotion, bottle costs or prior rite',()=>{
  const b=read('exit-save-boundary'),before=b.beforeLast as SliceState,s=b.final as SliceState,v=s.unshadowed.ritual.visits.at(-1)!;
  expect(s.unshadowed.ritual.playerLocation).toBe('OUTSIDE');expect(v.anchor!.felt).toBe(true);expect(v.vessel.status).toBe('EMPTY');expect(v.kit.status).toBe('CONSUMED');expect(s.cash).toBe(before.cash);expect(s.unshadowed.bottles).toEqual(before.unshadowed.bottles);expect(s.priestOfLight).toEqual(before.priestOfLight);
 });
 it('keeps the real open-door return, original cleaned archive trait and persistent cooled scorch',()=>{
  const c=read('stage-natural'),s=c.practiced as SliceState,l=s.unshadowed.life;expect(s.progression.acting).toBe(100);expect(l.playerLocation).toBe('OUTSIDE');expect(l.room.stepsOut).toBeGreaterThan(0);expect(l.room.stepsIn).toBe(l.room.stepsOut);expect(l.room.illuminated).toBe(false);
  expect(l.characteristic).toMatchObject({id:'UD4-CHARACTERISTIC-1',quantity:1,owner:'ARCHIVE',contamination:0,before:3,after:0});expect(l.tile).toMatchObject({id:'UD4-TILE',heat:'COLD',scorchMarks:1,coolingSeconds:60});expect(l.ally.location).toBe('LOW');expect(l.ally.moves).toBe(l.ally.returns);expect(l.ally.moves).toBeGreaterThan(0);
  expect(Object.values(l.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen&&!r.effectActive)).toBe(true);for(const key of prior)expect(s[key]).toEqual(c.guidanceStart[key]);
 });
 it('retains the original optional guard outcome and all older conflict consequences',()=>{
  const c=read('stage-natural'),s=c.final as SliceState;expect(s.combat).toBeNull();expect(s.unshadowed.encounter.enemy.id).toBe('UD4-EDMUND');expect(s.priestOfLight.encounter).toEqual(c.guidanceStart.priestOfLight.encounter);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);const last=s.combatHistory.at(-1)!.unshadowedOutcome!;expect(last.enemyHealth).toBe(s.unshadowed.encounter.enemy.health);
 });
 it('migrates the prior0.124 full terminal without changing any existing field',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json','utf8')).final,s=migrateSliceState(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((s as any)[key]).toEqual(old[key]);expect(s.unshadowed.promotionWeek).toBeNull();expect(migrateSliceState(s)).toEqual(s);
 });
});
