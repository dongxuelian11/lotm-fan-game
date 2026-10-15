import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const hydrate=(data:any)=>{for(const [key,value] of Object.entries(data))if(value&&typeof value==='object'&&'schemaVersion' in value)data[key]=migrateSliceState(value);return data;};
const read=(name:string)=>{
 if(name==='stage-directed')return hydrate(JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json','utf8')));
 return hydrate(JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/boundaries.json','utf8'))[name.replace('-save-boundary','')]);
};
describe('Secrets Sorcerer original hostile target, seal and real space route',()=>{
 it('directed roll-1 promotion preserves the actual hostile living demigod seal with the same source-bound case',()=>{
  const c=read('stage-directed'),s=c.promoted as SliceState;assertValidSliceState(s);expect(s.progression.sequence).toBe(4);expect(s.secretsSorcerer.travelerActingAtPromotion).toBe(100);
  const a=s.secretsSorcerer.ritual.attempts.find(a=>a.consumedBottleId!==null&&s.secretsSorcerer.bottles.find(b=>b.id===a.consumedBottleId)?.outcome?.includes('SUCCESS'))!;
  expect(a.captureEvidence).toMatchObject({hostileAtCapture:true,equivalentSequence:4,externalCombatHelpers:0,targetId:a.targetId,caseId:a.caseId});expect(a.captureEvidence!.ownTravelControls).toBeGreaterThanOrEqual(2);
  const target=s.secretsSorcerer.ritual.targets.find(t=>t.id===a.targetId)!,box=s.secretsSorcerer.ritual.cases.find(b=>b.id===a.caseId)!;expect(target.status).toBe('SEALED');expect(target.body.health).toBeGreaterThan(0);expect(box).toMatchObject({targetId:target.id,capacity:1,grade:1,sealsIntact:true});
  const h=s.combatHistory[a.captureEvidence!.terminalHistoryIndex]!;expect(h.secretsSorcererOutcome).toMatchObject({targetId:target.id,enemyStatus:'SEALED',caseId:box.id});expect(h.consequence).toContain('不是投降');
  for(const k of ['apprentice','trickmaster','astrologer','traveler'] as const)expect(s[k]).toEqual(c.guidanceStart[k]);expect(s.recorder.demonstrations).toEqual(c.guidanceStart.recorder.demonstrations);
  for(const r of c.guidanceStart.recorder.records){const after=s.recorder.records.find(x=>x.id===r.id)!;expect({...after,status:r.status,releasedWeek:r.releasedWeek}).toEqual(r);}
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['door.s4.space-hiding','door.s4.space-pocket','door.s4.banishment']);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).traveler.acting).toBe(100);
 });
 it.each(['survey','prepare-seal','start','sealed','promotion','exit','record','hide','door-exit','stop-hide','pocket','store','take','return-item','stop-pocket','restrain','banish','return-target','release','close','report'])('replays actual %s with every saved field',key=>{const b=read(`${key}-save-boundary`),s=applySliceIntent(b.beforeLast,b.lastIntent);expect(s).toEqual(b.final);assertValidSliceState(s);expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);});
 it('returns the sealed living original to the same case archive without erasing it',()=>{
  const c=read('stage-directed'),s=c.practiced as SliceState;expect(s.combat).toBeNull();expect(s.secretsSorcerer.ritual.phase).toBe('CLOSED');const a=s.secretsSorcerer.ritual.attempts.find(a=>a.outcome==='SEALED'&&a.closedWeek!==null)!,box=s.secretsSorcerer.ritual.cases.find(x=>x.id===a.caseId)!;expect(box).toMatchObject({custody:'ARCHIVE',location:'ARCHIVE',targetId:a.targetId,sealsIntact:true});expect(s.secretsSorcerer.ritual.targets.find(x=>x.id===a.targetId)!.status).toBe('SEALED');expect(box.returnedWeek).not.toBeNull();
 });
 it('keeps one door, finite original items and the returning precontrolled echo',()=>{
  const c=read('stage-directed'),s=c.practiced as SliceState,l=s.secretsSorcerer.life;expect(s.progression.acting).toBe(100);expect(l.room).toMatchObject({id:'SS4-ROOM',doorId:'SS4-DOOR',position:'OUTSIDE',hidden:false});expect(l.room.entries).toBe(l.room.exits);expect(l.pocket.capacity).toBe(3);expect(l.pocket.mode).toBe('NONE');expect(l.pocket.linked).toBe(false);expect(l.pocket.buzzCosts).toBeGreaterThanOrEqual(2);
  for(const item of l.pocket.items){expect(item.location).toBe(item.owner==='PLAYER'?'PLAYER':'DESK');expect(item.stores).toBeGreaterThan(0);expect(item.stores).toBe(item.takes);}
  expect(l.banishment).toMatchObject({id:'SS4-ECHO-G',cageId:'SS4-CAGE-1',alive:true,hostile:true,location:'ORIGINAL_CAGE',restrained:false});expect(l.banishment.banishments).toBe(l.banishment.returns);expect(l.banishment.banishments).toBeGreaterThan(0);expect(Object.values(l.cases).every(x=>x.status==='RESOLVED'&&!x.contactOpen)).toBe(true);
 });
 it('keeps inherited demonstration costs and produces only its actual record',()=>{
  const b=read('record-save-boundary'),before=b.beforeLast as SliceState,s=b.final as SliceState;expect(s.recorder.demonstrations).toHaveLength(before.recorder.demonstrations.length+1);expect(s.progression.acting).toBe(before.progression.acting);expect(s.recorder.records.length).toBeGreaterThanOrEqual(before.recorder.records.length);expect(s.recorder.records.length).toBeLessThanOrEqual(before.recorder.records.length+1);
 });
 it('migrates prior0.126 full terminal retaining every old field',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/undying-v01260/natural.json','utf8')).final,s=migrateSliceState(old);for(const k of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(k))expect((s as any)[k]).toEqual(old[k]);expect(s.schemaVersion).toBe(175);expect(s.secretsSorcerer.promotionWeek).toBeNull();expect(migrateSliceState(s)).toEqual(s);
 });
});


describe('honest natural failure branches and directed continuation',()=>{
 it.each(['natural-first-death','natural-failure'])('replays %s without changing its seed, resources or lethal outcome',name=>{
  const c=JSON.parse(readFileSync(`tests/fixtures/secrets-sorcerer-v01270/${name}.json`,'utf8'));
  let s=createSliceRun(c.final.runId,c.creation,c.seed);for(const command of c.commands)s=applySliceIntent(s,command);
  expect(s).toEqual(migrateSliceState(c.final));expect(s.status).toBe('DEAD');expect(s.progression.sequence).toBe(5);
  if(name==='natural-failure'){expect(c.sealed.secretsSorcerer.ritual.phase).toBe('SEALED');expect(s.secretsSorcerer.bottles[0].outcome).toBe('FAILURE');}
 });
 it('replays every subsequent public command from the explicitly directed pre-potion start',()=>{
  const c=read('stage-directed'),b=read('promotion-save-boundary');expect(c.provenance.kind).toBe('DIRECTED_PROMOTION_THEN_PUBLIC_COMMANDS');
  let s=b.beforeLast;for(const command of c.commands)s=applySliceIntent(s,command);expect(s).toEqual(c.final);
  expect(c.practiced.progression.acting).toBe(100);expect(s.status).toBe('ACTIVE');expect(s.secretsSorcerer.ritual.attempts.at(-1).outcome).toBe('RETREATED');
 });
});
