import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const capture=JSON.parse(readFileSync(`tests/fixtures/cataclysm-priest-v01240/shared-${name}.json`,'utf8'));for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
describe('Cataclysm Priest actual coastal stages and original Tyrant continuity',()=>{
 it('keeps provisional drinking at5 and promotes only after two actual survival stages',()=>{
  const drink=read('drink-save-boundary').final as SliceState,first=read('first-wave-save-boundary').final as SliceState,c=read('stage-natural'),s=c.promoted as SliceState;
  expect(drink.progression.sequence).toBe(5);expect(drink.cataclysmPriest.promotionWeek).toBeNull();expect(drink.cataclysmPriest.ritual.visits.at(-1)!.phase).toBe('DRUNK');expect(drink.cataclysmPriest.ritual.visits.at(-1)!.kit.status).toBe('CONSUMED');
  expect(first.progression.sequence).toBe(5);expect(first.cataclysmPriest.ritual.visits.at(-1)!.elapsedSeconds).toBe(60);expect(first.cataclysmPriest.ritual.visits.at(-1)!.site.platformFlooded).toBe(true);
  assertValidSliceState(s);expect(s.progression.sequence).toBe(4);expect(s.cataclysmPriest.oceanSingerActingAtPromotion).toBe(100);const v=s.cataclysmPriest.ritual.visits.at(-1)!;expect(v).toMatchObject({phase:'ENDED',elapsedSeconds:120,finishedSuccess:true});expect(v.hazards).toHaveLength(2);expect(s.cataclysmPriest.ritual.playerLocation).toBe('PLATFORM');
  for(const key of ['sailor','rager','navigator','windBlessed','oceanSinger'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);expect(s.character.gender).toBe(c.guidanceStart.character.gender);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).oceanSinger.acting).toBe(100);expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['tyrant.s4.sea-tornado','tyrant.s4.surge-control','tyrant.s4.great-lightning']);
 });
 it.each(['book','open','clear','check','quake','drink','first-wave','promotion','exit','move-ally','eddy','stop','return-float','return-ally','close','report','wind','lightning','combat'])('replays actual %s with full private and JSON equality',key=>{
  const b=read(`${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('retains original damage and costs after real ordinary exit',()=>{
  const b=read('exit-save-boundary'),before=b.beforeLast as SliceState,s=b.final as SliceState;const v=s.cataclysmPriest.ritual.visits.at(-1)!;expect(s.cataclysmPriest.ritual.playerLocation).toBe('RIDGE');expect(v.site).toMatchObject({gauge:'BROKEN',lowerWalkway:'WASHED_OUT',sea:'RECEDED',earthquakeOccurred:true,platformFlooded:true});expect(v.kit.status).toBe('CONSUMED');expect(s.health).toBe(before.health);expect(s.cash).toBe(before.cash);expect(s.spirituality).toBe(before.spirituality);expect(s.cataclysmPriest.ritual.assistants.every(p=>p.alive&&p.location==='RIDGE')).toBe(true);
 });
 it('returns the same original float and willing adult while leaving real water and scorch facts',()=>{
  const c=read('stage-natural'),s=c.practiced as SliceState,l=s.cataclysmPriest.life;expect(s.progression.acting).toBe(100);expect(l.float).toMatchObject({id:'CP4-FLOAT',owner:'CP4-SYLVA',location:'BANK',moves:1,returns:1});expect(l.rope.durability).toBe(90);expect(l.ally.location).toBe('LOW');expect(l.ally.moves).toBe(l.ally.returns);expect(l.tray.capturedUnits).toBe(1);expect(l.stone.scorchMarks).toBe(1);expect(Object.values(l.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen&&!r.effectActive)).toBe(true);for(const key of ['sailor','rager','navigator','windBlessed','oceanSinger'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
 });
 it('keeps the actual original optional conflict terminal and older consequences',()=>{
  const c=read('stage-natural'),s=c.final as SliceState;expect(s.combat).toBeNull();expect(s.cataclysmPriest.encounter.enemy.id).toBe('CP4-BENEDICT');expect(s.oceanSinger.encounter).toEqual(c.guidanceStart.oceanSinger.encounter);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);const last=s.combatHistory.at(-1)!.cataclysmPriestOutcome!;expect(last.enemyHealth).toBe(s.cataclysmPriest.encounter.enemy.health);expect(last.waterSource).toBe('SEAWATER');
 });
 it('migrates the prior0.123 full terminal while preserving every existing fact',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json','utf8')).final,s=migrateSliceState(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((s as any)[key]).toEqual(old[key]);expect(s.cataclysmPriest.promotionWeek).toBeNull();expect(migrateSliceState(s)).toEqual(s);
 });
});
