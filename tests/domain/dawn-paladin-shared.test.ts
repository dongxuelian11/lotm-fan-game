const currentCapture=(v:any)=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x&&typeof x==='object'&&'schemaVersion'in x&&'runId'in x?migrateSliceState(x):x]));
import {DeterministicActionRandomStream} from '../../src/resolution/deterministic-random.js';
import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>currentCapture(name==='dawn-paladin-stage-natural'?JSON.parse(readFileSync('tests/fixtures/dawn-paladin-v0850/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/dawn-paladin-v0850/boundaries.json','utf8'))[name.replace('dawn-paladin-','').replace('-save-boundary','')]);
describe('Dawn Paladin original shared route',()=>{
 it('retains old growth, returns the actual mentor club, and completes finite dawn work',()=>{
  const c=read('dawn-paladin-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.dawnPaladin.promotionWeek).toBeGreaterThanOrEqual(s.weaponmaster.promotionWeek!+12);
  expect(s.dawnPaladin.weaponmasterActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.dawnPaladin.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.warrior.practiceClub).toMatchObject({owner:'奥斯温·布莱克特',custodian:'MENTOR',location:'training-rack'});
  expect(s.warrior.practiceClub.version).toBe(c.promoted.warrior.practiceClub.version+1);
  expect(s.dawnPaladin.practice).toMatchObject({illusionCreated:true,volunteerSpirituality:18,illusionDispelled:true,armorProbePerformed:true,armorCracked:true,stormTarget:'DESTROYED',stormFrameScorched:true,stormSwordDispersed:true,stormArmorCracked:true});
 });
 it.each(['promotion','light','armor','storm','close','combat'])('replays the actual %s boundary through save migration',key=>{
  const b=read(`dawn-paladin-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('pays the actual sword/armor/storm cost and must explicitly leave',()=>{
  const b=read('dawn-paladin-storm-save-boundary'),s=b.final as SliceState;
  expect(s.spirituality).toBe(b.beforeLast.spirituality-10);expect(s.dawnPaladin.cases['cleared-storm']!.contactOpen).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'DAWN_PALADIN',command:{type:'CLOSE',caseId:'cleared-storm'}});
  expect(projectSliceState(after).dawnPaladin.insideCase).toBe(false);
  expect(after.dawnPaladin.practice.stormTarget).toBe(s.dawnPaladin.practice.stormTarget);
 });
 it('keeps enemy club and prior first-case facts, without permanent summoned equipment after battle',()=>{
  const c=read('dawn-paladin-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
  expect(c.final.dawnPaladin.encounter).toMatchObject({swordReady:false,armorReady:false,armorExpiresRound:null});
 });
 it('migrates the whole previous Fire Thief save without losing its original loans or history',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.dawnPaladin.promotionWeek).toBeNull();
  const{dawnPaladin:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const k of Object.keys(prior))expect((facts as any)[k]).toEqual(prior[k]);
 });
 it('saves the actual shared six-player/four-Bard action shape under bounded synthetic draws',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/natural.json','utf8')).combatStart;
  const s=migrateSliceState(old);assertValidSliceState(s);
  const original=DeterministicActionRandomStream.prototype.nextInt,rolls=[100,100,280,300,280,300,280,300,280,300,280,280,1];let i=0;
  const spy=vi.spyOn(DeterministicActionRandomStream.prototype,'nextInt').mockImplementation(function(this:DeterministicActionRandomStream,min,max){original.call(this,min,max);const roll=rolls[i++]!;expect(roll).toBeGreaterThanOrEqual(min);expect(roll).toBeLessThanOrEqual(max);return roll;});
  try{const after=applySliceIntent(s,{type:'COMBAT_ROUND',stance:'PREPARE'});expect(after.combat!.lastRound).toMatchObject({playerCount:6,enemyCount:4});expect(after.combat!.lastRound!.moves).toHaveLength(10);expect(i).toBe(rolls.length);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);}finally{spy.mockRestore();}
 });

});
