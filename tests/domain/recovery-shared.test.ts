import { describe, it, expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const path='tests/fixtures/recovery-v01620/natural.json';
const old='tests/fixtures/chaos-hunter-v01600/natural.json';
const state=(key:string)=>migrateSliceState(readObjectEntry<SliceState>(path,key));
const boundary=(key:string)=>readObjectEntry<Boundary>('tests/fixtures/recovery-v01620/boundaries.json',key);
describe('actual public paid care from the saved living pre-contact branch',()=>{
 it('keeps the original death and exactly the same474-command prefix',()=>{
  const commands=readObjectEntry<SliceIntent[]>(path,'commands'), previous=readObjectEntry<SliceIntent[]>(old,'commands');
  expect(commands.slice(0,474)).toEqual(previous.slice(0,474));expect(commands).toHaveLength(483);
  expect(migrateSliceState(readObjectEntry<SliceState>(old,'final')).status).toBe('DEAD');
  const initial=state('initial');assertValidSliceState(initial);
  expect(initial).toMatchObject({status:'ACTIVE',health:100,injuryRisk:2,careKnown:false,chaosHunter:{encounter:{status:'AVAILABLE'}}});
  expect(initial.injuries).toHaveLength(1);expect(initial.injuries[0]).toMatchObject({severity:'HEAVY',treatedRevision:null});
 });
 it('pays60 for actual original wound treatment without healing or resource invention',()=>{
  const b=boundary('paid-original-wound-treatment');
  expect(b.lastIntent).toMatchObject({type:'EVENT_CHOICE',choiceId:'PAY'});
  expect(b.final.cash).toBe(b.beforeLast.cash-60);expect(b.final.health).toBe(b.beforeLast.health);
  expect(b.final.actionsRemaining).toBe(b.beforeLast.actionsRemaining);expect(b.final.random).toEqual(b.beforeLast.random);
  expect(b.final.injuries.map(i=>i.id)).toEqual(b.beforeLast.injuries.map(i=>i.id));
  expect(b.final.injuries.every(i=>i.treatedRevision!==null)).toBe(true);expect(b.final.injuryRisk).toBe(2);
 });
 it('only later rest clears the treated wound, preserving every original pathway record',()=>{
  const initial=state('initial'),treated=state('treated');
  expect(treated.injuries).toEqual([]);expect(treated.injuryRisk).toBe(0);expect(treated.week).toBe(115);
  expect(treated.progression).toEqual(initial.progression);expect(treated.chaosHunter).toEqual(initial.chaosHunter);
  for(const key of ['arbiter','sheriff','interrogator','judge','punishmentKnight','imperativeMage'] as const)expect(treated[key]).toEqual(initial[key]);
  expect(projectSliceState(treated).recovery.nextLoss.weights).toEqual({light:65,heavy:30,death:5});
 });
 it('uses the same original first consequence95 with actual clean-risk weights',()=>{
  const original=migrateSliceState(readObjectEntry<SliceState>(old,'final'));
  const now=boundary('first-actual-treated-round').final;
  expect(original.lastCombatRound!.consequenceWeights).toEqual({light:35,heavy:30,death:35});
  expect(now.lastCombatRound!.consequenceWeights).toEqual({light:65,heavy:30,death:5});
  expect(original.lastCombatRound!.consequence).toContain('95/100');expect(now.lastCombatRound!.consequence).toContain('95/100');
  expect(original.status).toBe('DEAD');expect(now.status).toBe('ACTIVE');expect(now.health).toBe(70);
 });
 it('replays every saved public care and encounter boundary without direct state edits',()=>{
  for(const key of ['actual-clinic-discovery','actual-clinic-invitation','paid-original-wound-treatment','later-real-rest','same-original-contact-after-care','same-original-battle-after-care','first-actual-treated-round','actual-terminal']){
   const b=boundary(key),before=migrateSliceState(b.beforeLast),after=applySliceIntent(before,b.lastIntent);
   assertValidSliceState(after);expect(after).toEqual(migrateSliceState(b.final));expect(projectSliceState(after)).toEqual(projectSliceState(migrateSliceState(b.final)));
  }
 });
 it('keeps the new injury and the surrendered original opponent after real ordinary exit',()=>{
  const final=state('final');assertValidSliceState(final);
  expect(final).toMatchObject({status:'ACTIVE',health:70,mind:100,spirituality:116,injuryRisk:0});
  expect(final.injuries).toHaveLength(1);expect(final.injuries[0]).toMatchObject({severity:'HEAVY',treatedRevision:null});
  expect(final.chaosHunter.encounter).toMatchObject({targetId:'CH3-EDRIC',enemyHealth:70,enemyMind:100,enemySpirituality:92,enemyStatus:'SURRENDERED',weaponLocation:'HAND',exitTravelMetres:4,exitSeconds:4,terminal:{round:3}});
  expect(projectSliceState(final).recovery.nextLoss.weights).toEqual({light:55,heavy:30,death:15});
 });
});
