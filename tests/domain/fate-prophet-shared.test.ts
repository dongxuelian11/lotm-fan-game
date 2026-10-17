import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createFateProphetState } from '../../src/domain/fate-prophet/index.js';
import { FATE_PROPHET_ABILITY_IDS } from '../../src/domain/fate-prophet/types.js';
import { validateFateProphetCombatRound, FATE_PROPHET_ENEMY_ABILITY_WHEEL, FATE_PROPHET_ENEMY_COUNT_WHEEL } from '../../src/domain/fate-prophet/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const ROOT='tests/fixtures/fate-prophet-v01820', NATURAL=`${ROOT}/natural.json`, OLD='tests/fixtures/chaos-walker-v01580/natural.json';
const HASH='eb42c6205279a77bd6c19f7ea0946181e2b6df8e31201f8ba1126fa51d928ce2';
const entry=<T>(k:string):T=>readObjectEntry<T>(NATURAL,k);
const final=()=>migrateSliceState(entry<unknown>('final'));
const prefix=()=>migrateSliceState(entry<unknown>('prefixFinal'));
const snapshot=(name:string)=>migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`,'utf8')));
function boundary(name:string){const index=JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`,'utf8')) as Record<string,string>;expect(index[name]).toBe(`boundary-${name}.json`);const p=`${ROOT}/${index[name]}`;return{beforeLast:migrateSliceState(readObjectEntry(p,'beforeLast')),lastIntent:readObjectEntry<SliceIntent>(p,'lastIntent'),final:migrateSliceState(readObjectEntry(p,'final'))};}
function oldFacts(s:SliceState,old:SliceState){
 for(const k of ['monster','machine','lucky','calamityPriest','misfortuneMage'] as const)expect(s[k]).toEqual(old[k]);
 const{luck:a,...oldWinner}=old.winner,{luck:b,...newWinner}=s.winner;expect(newWinner).toEqual(oldWinner);
 const{life:c,...oldCW}=old.chaosWalker,{life:d,...newCW}=s.chaosWalker;expect(newCW).toEqual(oldCW);
 if(s.fateProphet.life.source){expect(s.fateProphet.life.source.snapshot).toEqual(c);for(const k of ['cases','record','forecast'] as const)expect(d[k]).toEqual(c[k]);}else expect(d).toEqual(c);
 expect(s.combatHistory.slice(0,old.combatHistory.length)).toEqual(old.combatHistory);expect(s.random.seed).toBe(old.random.seed);expect(s.runId).toBe(old.runId);expect(s.character.gender).toBe(old.character.gender);
 for(const[id,v]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id]).toBeGreaterThanOrEqual(v);
}
describe('Fate Prophet actual same-seed public continuation and persistence boundaries',()=>{
 it('keeps all551 original commands and immutable input bytes before the real continuation',async()=>{
  const h=createHash('sha256');for await(const c of createReadStream(OLD))h.update(c);expect(h.digest('hex')).toBe(HASH);
  expect(entry('provenance')).toEqual({kind:'SAME_SEED_COMPLETE_PUBLIC_CONTINUATION',source:OLD,sourceSha256:HASH,newRandomChanges:false});
  const commands=entry<SliceIntent[]>('commands'),original=readObjectEntry<SliceIntent[]>(OLD,'commands');expect(original).toHaveLength(551);expect(commands.slice(0,551)).toEqual(original);expect(commands.length).toBeGreaterThan(551);expect(entry('prefixVerified')).toBe(true);expect(entry('prefixCount')).toBe(551);
  expect(entry('stage')).toBe('NATURAL_FATE_PROPHET_PUBLIC_CONTINUATION');expect(entry('error')).toBeNull();expect(entry('pendingIntent')).toBeNull();
  expect(prefix()).toEqual(migrateSliceState(readObjectEntry(OLD,'final')));expect(prefix()).toEqual(snapshot('departure'));expect(prefix().fateProphet).toEqual(createFateProphetState());assertValidSliceState(prefix());
 });
 it('actually treats both original heavy wounds for60 and rests instead of equating H100 with healing',()=>{
  const old=prefix(),paid=boundary('clinic-actual-pay60'),treated=snapshot('treated');expect(old).toMatchObject({health:60,injuryRisk:2,cash:630,week:140});expect(old.injuries.filter(i=>i.severity==='HEAVY')).toHaveLength(2);
  expect(paid.beforeLast.cash-paid.final.cash).toBe(60);expect(paid.final.health).toBe(paid.beforeLast.health);expect(paid.final.injuryRisk).toBe(paid.beforeLast.injuryRisk);
  for(const i of old.injuries.filter(x=>x.severity==='HEAVY'))expect(paid.final.injuries.find(x=>x.id===i.id)).toMatchObject({id:i.id,acquiredRevision:i.acquiredRevision,treatedRevision:paid.beforeLast.revision+1});
  expect(entry<unknown[]>('treatments')).toHaveLength(1);expect(treated.injuries.filter(i=>i.severity==='HEAVY')).toEqual([]);oldFacts(treated,old);assertValidSliceState(treated);
 });
 it('retains both failed original doses, paid third success, all15 old masteries and two new zero entries',()=>{
  const old=prefix(),s=snapshot('promoted');expect(s.fateProphet.bottles.map(x=>x.outcome)).toEqual(['FAILURE','FAILURE','SUCCESS']);expect(Object.keys(old.progression.mastery)).toHaveLength(15);expect(Object.keys(s.progression.mastery)).toHaveLength(17);
  for(const[id,v]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id]).toBe(v);for(const id of FATE_PROPHET_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  for(const row of s.fateProphet.bottles){expect(row.status).toBe('CONSUMED');expect(row.labourSteps).toBe(5);}
  const b=boundary('consume-fate-prophet-potion-3');expect(b.final.spirituality).toBe(b.beforeLast.spirituality);expect(b.final.health).toBe(b.beforeLast.health);oldFacts(s,old);assertValidSliceState(s);
 });
 it('applies the actual cart clue, records changed consent and failed disc adjustments without inventing mastery',()=>{
  const s=snapshot('practiced'),cases=s.fateProphet.life.cases;expect(cases['cart-omen']).toMatchObject({status:'RESOLVED',result:'ABILITY'});expect(cases['changed-condition']).toMatchObject({status:'RESOLVED',result:'ORDINARY'});expect(cases['finite-disc']).toMatchObject({status:'RESOLVED',result:'ORDINARY'});
  const changed=cases['changed-condition'].attempts.at(-1)!,disc=cases['finite-disc'].attempts.at(-1)!;expect(changed.permissionWithdrawn).toBe(true);expect(changed.eventResult).toBe('C');expect(disc.foresightTier).toBe('FAILURE');expect(disc.adjustmentTier).toBe('GREAT_FAILURE');expect(disc.eventResult).toBe('C');
  expect(s.progression.mastery['wheel.s2.event-foresight']).toBe(8);expect(s.progression.mastery['wheel.s2.hazard-adjustment']).toBe(0);expect(s.progression.acting).toBe(100);expect(s.chaosWalker.life.playerLocation).toBe('START');oldFacts(s,prefix());assertValidSliceState(s);
 });
 it('uses one original cap3 luck account and pays actual failed attempts without refunds',()=>{
  const s=final();expect(prefix().winner.luck).toMatchObject({stored:0,accumulated:12,spent:12});expect(s.winner.luck).toMatchObject({stored:0,accumulated:14,spent:14});expect(s.winner.luck.accumulated-s.winner.luck.spent).toBe(s.winner.luck.stored);
  const b=boundary('finite-disc-hazard_adjustment-actual');expect(b.beforeLast.winner.luck.stored-b.final.winner.luck.stored).toBe(1);expect(b.beforeLast.spirituality-b.final.spirituality).toBe(5);expect(b.beforeLast.mind-b.final.mind).toBe(1);
 });
 it('has the same two adults physically outside and an independent Rowan with the actual enemy wheel',()=>{
  const s=snapshot('combatStart'),p=projectSliceState(s);expect(s.chaosWalker.life.volunteer.location).toBe('OUTSIDE');expect(s.chaosWalker.life.guide.location).toBe('OUTSIDE');expect(s.fateProphet.encounter.clearance).toMatchObject({veraMetres:8,guideMetres:4,elapsedSeconds:16});
  expect(p.combat!.enemyAbilityWheel).toEqual(FATE_PROPHET_ENEMY_ABILITY_WHEEL);expect(p.combat!.enemyCountWheel).toEqual(FATE_PROPHET_ENEMY_COUNT_WHEEL);expect(s.fateProphet.encounter).toMatchObject({enemyHealth:100,enemyMind:100,enemySpirituality:120,weaponLocation:'HAND'});oldFacts(s,prefix());assertValidSliceState(s);
 });
 it('keeps actual three-round surrender, real original weapon and ordinary four-metre exit',()=>{
  const s=snapshot('combatTerminal'),old=prefix();expect(s.fateProphet.encounter.terminal).toMatchObject({outcome:'ENEMY_SURRENDERED',round:3,enemyHealth:60,enemyMind:100,enemySpirituality:83,enemyStatus:'SURRENDERED',exitMetres:4,exitSeconds:4});expect(s.status).toBe('ACTIVE');expect(s.health).toBe(90);expect(s.chaosWalker.life.playerLocation).toBe('START');expect(s.fateProphet.encounter.weaponLocation).toBe('HAND');
  const rounds=s.combatHistory.slice(old.combatHistory.length);expect(rounds).toHaveLength(3);for(const r of rounds)expect(validateFateProphetCombatRound(r)).toBe(true);const applied=rounds[0]!.fateProphetOutcome!.enemyActions.find(a=>a.pendingApplied==='FORESIGHT');expect(applied).toMatchObject({id:'ARC_BOLT',rawContribution:70,selfGain:49,pendingAfter:null});expect(rounds[1]!.fateProphetOutcome!.hazardAttempts).toBe(1);expect(s.progression.mastery['wheel.s2.hazard-adjustment']).toBe(0);oldFacts(s,old);assertValidSliceState(s);
 });
 it('accepts only the real zero-action terminal weekly pulse and its exact living cost',()=>{
  const b=boundary('combat-round-3');expect(b.beforeLast.actionsRemaining).toBe(0);expect(b.final.week).toBe(b.beforeLast.week+1);expect(b.beforeLast.cash-b.final.cash).toBe(30);expect(b.final.actionsRemaining).toBe(b.final.weeklyBudget);expect(b.final.random.cursor).toBe(269);
  expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final);assertValidSliceState(b.final);
  for(const change of[(s:SliceState)=>{s.cash--;},(s:SliceState)=>{s.actionsRemaining--;},(s:SliceState)=>{s.date.day++;}]){const fake=structuredClone(b.final);change(fake);expect(()=>assertValidSliceState(fake)).toThrow();}
 });
 it('saves real ordinary post-encounter work while retaining the original light injury and history',()=>{
  const b=boundary('ordinary-life-after-actual-exit');expect(b.lastIntent).toEqual({type:'ACTION',action:'WORK'});expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final);expect(b.final).toEqual(final());expect(b.final.fateProphet.encounter.terminal).toEqual(b.beforeLast.fateProphet.encounter.terminal);oldFacts(b.final,prefix());assertValidSliceState(b.final);
 });
 it('rejects malformed public commands, hidden event forgery and unsupported future saves',()=>{
  for(const command of[{type:'EVENT_FORESIGHT',caseId:'unknown'},{type:'HAZARD_ADJUSTMENT',caseId:'cart-omen',free:true},{type:'ACCUMULATE',amount:99},{type:'CONSUME',bottleId:'fate-prophet-potion-1',confirmed:false}])expect(validateSlicePayload({type:'FATE_PROPHET',command})).toBe(false);
  const s=final(),raw=JSON.stringify(s);expect(migrateSliceState(s)).toEqual(s);expect(JSON.stringify(s)).toBe(raw);const future={...s,schemaVersion:999};expect(()=>migrateSliceState(future)).toThrow();expect(()=>assertValidSliceState(future)).toThrow();
 });
});
