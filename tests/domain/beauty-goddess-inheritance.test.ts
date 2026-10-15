import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { projectApothecary, applyApothecaryCommand } from '../../src/domain/apothecary/index.js';
import { projectTamer } from '../../src/domain/tamer/index.js';
import { projectVampire } from '../../src/domain/vampire/index.js';
import { projectPotionProfessor } from '../../src/domain/potion-professor/index.js';
import { projectCrimsonScholar } from '../../src/domain/crimson-scholar/index.js';
import { projectWitchKing } from '../../src/domain/witch-king/index.js';
import { projectSummoningMaster } from '../../src/domain/summoning-master/index.js';
import { projectLifeGiver, applyLifeGiverCommand } from '../../src/domain/life-giver/index.js';
import { applyLifeGiverActivity, lifeGiverLifeActions } from '../../src/domain/life-giver/life.js';
import { applyLifeGiverEncounterCommand } from '../../src/domain/life-giver/encounter.js';
import { validateBeautyGoddessState, beautyGoddessInheritedView } from '../../src/domain/beauty-goddess/index.js';
import { BEAUTY_GODDESS_ABILITY_IDS } from '../../src/domain/beauty-goddess/types.js';
import { lifeGiverNaturalPath, originalLifeGiver, moonLegacyKeys, promoted, recoverResources } from './beauty-goddess-directed-helper.js';
const projectors=[projectApothecary,projectTamer,projectVampire,projectPotionProfessor,projectCrimsonScholar,projectWitchKing,projectSummoningMaster,projectLifeGiver];
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('Beauty Goddess original Moon histories',()=>{
 it('pins actual572 source and preserves21 masteries, seven zeros, spent materials and the same guest body',()=>{
  expect(createHash('sha256').update(readFileSync(lifeGiverNaturalPath)).digest('hex')).toBe('6ae7bbe18c20979643cf881cec54e3794656701b3b962ce775f14c44d46356b1');
  const old=originalLifeGiver(),s=promoted();
  for(const key of moonLegacyKeys)same(s[key],old[key]);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id],id).toBe(value);
  expect(Object.keys(s.progression.mastery)).toHaveLength(23);expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(7);
  for(const id of BEAUTY_GODDESS_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe('FEMALE');same(s.combatHistory,old.combatHistory);
  expect(s.witchKing.life.papers.map(p=>p.status)).toEqual(['CONSUMED','CONSUMED','CONSUMED']);
  expect(s.summoningMaster.life.partner).toMatchObject({id:'SM3-LUMEN',bodyId:'SM3-LUMEN-BODY',location:'HOME',health:100,mind:92,stamina:88});
  expect(s.lifeGiver.encounter.enemyStatus).toBe('RESISTING');assertValidSliceState(s);
 });
 it('projects eight old stages as consumed history while exact old actions stay closed',()=>{
  const s=promoted();s.progression.acting=25;
  for(const project of projectors)expect(project(s),project.name).toMatchObject({promoted:true,acting:100,actions:[]});
  expect(lifeGiverLifeActions(s)).toEqual([]);
  s.beautyGoddess.lifeGiverActingAtPromotion=99;expect(validateBeautyGoddessState(s)).toBe(false);
 });
 it('rejects missing extra and unjustified mastery and prematureS1 keys',()=>{
  for(const id of Object.keys(promoted().progression.mastery)){const s=promoted();delete s.progression.mastery[id];expect(validateBeautyGoddessState(s),id).toBe(false);}
  for(const value of [-1,501,0.5,NaN]){const s=promoted();s.progression.mastery[BEAUTY_GODDESS_ABILITY_IDS[0]]=value;expect(validateBeautyGoddessState(s)).toBe(false);}
  for(const id of ['moon.s8.taming',...BEAUTY_GODDESS_ABILITY_IDS]){const s=promoted();s.progression.mastery[id]!++;expect(validateBeautyGoddessState(s)).toBe(false);}
  const extra=promoted();extra.progression.mastery['moon.s1.invented']=0;expect(validateBeautyGoddessState(extra)).toBe(false);
  const premature=originalLifeGiver();premature.progression.mastery[BEAUTY_GODDESS_ABILITY_IDS[0]]=0;expect(()=>assertValidSliceState(premature)).toThrow();
 });
 it('keeps actual spirituality ceiling120 without accepting121',()=>{const s=recoverResources(promoted());expect(s.spirituality).toBe(120);expect(()=>assertValidSliceState(s)).not.toThrow();s.spirituality=121;expect(()=>assertValidSliceState(s)).toThrow();});
 it('constructs a nonmutating exactS2 source view including original body and original partner',()=>{
  const s=promoted(),before=stableStringify(s),view=beautyGoddessInheritedView(s);
  expect(view.progression.sequence).toBe(2);expect(Object.keys(view.progression.mastery)).toHaveLength(21);
  for(const key of moonLegacyKeys)same(view[key],s.beautyGoddess.sourceHistory![key]);
  same(view.character,s.beautyGoddess.sourceScene!.character);expect(stableStringify(s)).toBe(before);
  view.summoningMaster.life.partner.stamina=1;expect(s.summoningMaster.life.partner.stamina).toBe(88);
 });
 it('rejects free original guest recovery, reopened paper and rewritten historical enemy',()=>{
  for(const change of [(s:ReturnType<typeof promoted>)=>{s.summoningMaster.life.partner.stamina=100;},(s:ReturnType<typeof promoted>)=>{s.summoningMaster.life.partner.mind=100;},(s:ReturnType<typeof promoted>)=>{s.witchKing.life.papers[2]!.status='PREPARED';},(s:ReturnType<typeof promoted>)=>{s.lifeGiver.encounter.enemyStatus='DEAD';}]){const s=promoted();change(s);expect(validateBeautyGoddessState(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();}
 });
 it('keeps old acquisition, life and encounter mutations unavailable without rolling',()=>{
  const s=promoted(),c:SeerContext={roll:vi.fn(min=>min),note:vi.fn(),check:vi.fn(()=>{throw Error('Unexpected check');})};
  for(const action of [()=>applyApothecaryCommand(s,{type:'LEARN_GUIDANCE'},c),()=>applyLifeGiverCommand(s,{type:'BUY_POTION',bottleId:s.lifeGiver.bottles[0]!.id},c),()=>applyLifeGiverActivity(s,{type:'REFLECT'},c),()=>applyLifeGiverEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},c)]){const before=stableStringify(s);expect(action).toThrow();expect(stableStringify(s)).toBe(before);}expect(c.check).not.toHaveBeenCalled();
 });
});
