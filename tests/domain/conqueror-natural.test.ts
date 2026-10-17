import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const ROOT='tests/fixtures/conqueror-v01870';
const entry=<T>(key:string)=>readObjectEntry<T>(`${ROOT}/natural.json`,key);
const state=()=>migrateSliceState(entry<unknown>('final'));
const boundary=(key:string)=>JSON.parse(readFileSync(`${ROOT}/boundary-${key}.json`,'utf8')) as {beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState};
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));

describe('Conqueror original795-command living continuation',()=>{
 it('replays the exact complete original seed and commands without editing an old failure or rolling again',()=>{
  const commands=entry<SliceIntent[]>('commands'),originalCommands=readObjectEntry<SliceIntent[]>('tests/fixtures/weather-warlock-v01650/natural.json','commands');
  expect(commands).toHaveLength(795);expect(entry<number>('prefixCount')).toBe(658);expect(entry<boolean>('prefixVerified')).toBe(true);
  same(commands.slice(0,658),originalCommands);
  const sourceHash=createHash('sha256').update(readFileSync('tests/fixtures/weather-warlock-v01650/natural.json')).digest('hex');
  expect(entry<{sourceSha256:string;newRandomChanges:boolean}>('provenance')).toMatchObject({sourceSha256:sourceHash,newRandomChanges:false});
  const final=state();let s=createSliceRun(final.runId,entry<Parameters<typeof createSliceRun>[1]>('creation'),entry<string>('seed'));
  for(const [i,intent]of commands.entries()){s=applySliceIntent(s,intent);if(i===657)same(s,migrateSliceState(entry<unknown>('prefixFinal')));}
  same(s,final);assertValidSliceState(s);
 },60000);
 it('keeps two actual potion failures, third success and all six old zero masteries',()=>{
  const s=state(),old=entry<SliceState>('prefixFinal');
  expect(s.conqueror.bottles.map(b=>b.outcome)).toEqual(['FAILURE','FAILURE','SUCCESS']);expect(s.conqueror.promotionWeek).toBe(191);
  expect(s).toMatchObject({status:'ACTIVE',revision:796,week:200,date:{epoch:'FIFTH_EPOCH',year:1353,month:4,day:21},health:80,mind:100,spirituality:120,cash:536,actionsRemaining:3,injuryRisk:1,progression:{pathwayId:'hunter',sequence:1,acting:100,promotionWeek:9},random:{seed:'hunter-rebuild-first',cursor:376}});
  expect(s.conqueror.acquisitionJournal.filter(e=>e.command.type==='CONSUME').map(e=>e.check?.tier)).toEqual(['FAILURE','FAILURE','SUCCESS']);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id]).toBe(value);
  expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(6);expect(Object.keys(s.progression.mastery)).toHaveLength(23);
  expect(s.progression.mastery['hunter.s1.formation-momentum']).toBe(8);expect(s.progression.mastery['hunter.s1.focused-flame']).toBe(8);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe(old.character.gender);
 });
 it('pays for the same tired five and recovers only after a real week, retaining all30 identities',()=>{
  const s=state(),old=entry<SliceState>('prefixFinal');
  expect(old.ironBloodKnight.team.members.slice(0,5).map(m=>m.energy)).toEqual([5,5,5,5,6]);
  const receipts=s.conqueror.life.journal,rests=receipts.filter(e=>e.command.type==='REST_TEAM'),recoveries=receipts.filter(e=>e.command.type==='RECOVER_TEAM');
  expect(rests).toHaveLength(2);expect(recoveries).toHaveLength(2);
  rests.forEach((e,i)=>{expect(e.before.cash-e.after.cash).toBe(40);expect(recoveries[i]!.week).toBeGreaterThan(e.week);});
  expect(s.ironBloodKnight.team.members.slice(0,5).map(m=>m.energy)).toEqual([7,7,7,7,8]);
  const immutable=(team:SliceState['ironBloodKnight']['team'])=>({...team,restRequestedWeek:null,members:team.members.map(({health,energy,location,present,willing,...history})=>history)});
  same(immutable(s.ironBloodKnight.team),immutable(old.ironBloodKnight.team));
  expect(s.ironBloodKnight.team.members.every(m=>!m.present&&m.location==='HOME')).toBe(true);
 });
 it('applies both new powers once to actual original objects and respects the third withdrawn permission',()=>{
  const s=state(),l=s.conqueror.life;
  expect(Object.values(l.cases).map(c=>[c.status,c.result,c.abilityApplied])).toEqual([['RESOLVED','ABILITY',true],['RESOLVED','ABILITY',true],['RESOLVED','ORDINARY',false]]);
  expect(l.practice.cart.movedMetres).toBe(3);expect(l.practice.iron).toMatchObject({integrity:70,heatDamage:30,temperature:20,cooldownSeconds:0});expect(l.practice.crate.movedMetres).toBe(2);
  expect(l.cases['withdrawn-permission'].permission).toBe('WITHDRAWN');expect(l.journal.filter(e=>e.command.type==='APPLY_POWER')).toHaveLength(2);
  expect(l.reflected).toBe(true);expect(l.practice.activeCase).toBeNull();expect(l.practice.ownerNode).toBe('ENTRY');
 });
 it('keeps the old surrendered Orren and independent new Ronan death distinct',()=>{
  const s=state(),old=entry<SliceState>('prefixFinal');same(s.weatherWarlock,old.weatherWarlock);expect(s.weatherWarlock.encounter.enemyStatus).toBe('SURRENDERED');
  same(s.combatHistory.slice(0,old.combatHistory.length),old.combatHistory);
  expect(s.conqueror.encounter).toMatchObject({status:'RESOLVED',targetId:'CQ1-RONAN-HALE',enemyStatus:'DEAD',enemyHealth:0,policy:'HOLD',terminal:{outcome:'ENEMY_DEAD',round:8,exitMetres:12}});
  expect(s.conqueror.encounter.scene.presentMemberIds).toEqual([]);expect(s.combat).toBeNull();
  expect(projectSliceState(s).conqueror.actions.some(a=>a.command.type==='ENCOUNTER_FIGHT'&&a.enabled)).toBe(false);
 });
 it('uses the saved original dice for all8 rounds and preserves each explicit consequence domain',()=>{
  const s=state(),rounds=s.combatHistory.filter(r=>r.conquerorOutcome);expect(rounds).toHaveLength(8);
  expect(rounds[0]!.consequenceDomain).toBeUndefined();expect(rounds.slice(1).every(r=>r.consequenceDomain==='BODY')).toBe(true);
  expect(rounds.flatMap(r=>r.conquerorOutcome!.playerActions).every(a=>!a.formationCast&&a.actualMemberIds.length===0)).toBe(true);
  expect(rounds.flatMap(r=>r.conquerorOutcome!.playerActions).filter(a=>a.mode==='FOCUSED_FLAME')).toEqual([]);
  for(let i=1;i<=8;i++){const b=boundary(`combat-round-${i}`);same(applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent),migrateSliceState(b.final));}
 },30000);
 it('reopens actual new combat with its own full enemy wheels and mental/material resources',()=>{
  const b=boundary('combat-round-1'),s=migrateSliceState(b.beforeLast),p=projectSliceState(s),combat=p.combat!;
  expect(combat.title).toContain('征服者');expect(combat.enemyCountWheel.map(x=>x.id)).toHaveLength(6);expect(combat.enemyAbilityWheel).toHaveLength(6);
  expect(combat.enemyMind).toBe(s.conqueror.encounter.enemyMind);expect(combat.conqueror?.targetId).toBe('CQ1-RONAN-HALE');expect(combat.conqueror?.materials.water.remainingLitres).toBe(20);
  expect(combat.conqueror?.facts.join('')).toContain('没有实际队友');expect(p.maxSpirituality).toBe(120);
 });
 it('settles a zero-action terminal through actual ordinary public preparation and shared weekly billing',()=>{
  const b=boundary('independent-ronan-talk');let s=migrateSliceState(b.beforeLast);expect(s.actionsRemaining).toBe(3);
  s=applySliceIntent(s,{type:'ACTION',action:'REST'});expect(s.actionsRemaining).toBe(2);
  s=applySliceIntent(s,b.lastIntent);s=applySliceIntent(s,{type:'CONQUEROR',command:{type:'ENCOUNTER_FIGHT'}});
  expect(s.actionsRemaining).toBe(0);const start=structuredClone(s);
  for(let n=0;s.combat&&n<20;n++)s=applySliceIntent(s,{type:'COMBAT_ROUND',stance:(['DEFEND','CONTROL','ATTACK'] as const)[n%3]!});
  expect(s.combat).toBeNull();expect(s.conqueror.encounter.terminal?.outcome).toBe('ENEMY_DEAD');expect(s.status).toBe('ACTIVE');
  expect(s.week).toBe(start.week+1);expect(s.actionsRemaining).toBe(3);expect(s.cash).toBe(start.cash-30);expect(s.random.cursor).toBe(376);
  expect(s.conqueror.encounter.scene.playerLocation).toBe('WORKSHOP');assertValidSliceState(s);same(migrateSliceState(s),s);
 },30000);
 it('returns to ordinary paid living with both real light wounds and no recreated enemy',()=>{
  const b=boundary('ordinary-life-after-exit'),before=migrateSliceState(b.beforeLast),s=state();expect(b.lastIntent).toEqual({type:'ACTION',action:'WORK'});
  same(applySliceIntent(before,b.lastIntent),s);expect(s.injuries.map(i=>i.severity)).toEqual(['LIGHT','LIGHT']);expect(s.health).toBe(80);expect(projectSliceState(s).canAct).toBe(true);
  expect(s.week).toBe(before.week+1);expect(s.conqueror.encounter.enemyStatus).toBe('DEAD');expect(s.conqueror.encounter.scene.playerLocation).toBe('WORKSHOP');
 });
});
