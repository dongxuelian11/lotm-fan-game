import { describe, expect, it, vi } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { projectReader, applyReaderCommand } from '../../src/domain/reader/index.js';
import { projectReasoner } from '../../src/domain/reasoner/index.js';
import { projectDetective } from '../../src/domain/detective/index.js';
import { projectPolymath } from '../../src/domain/polymath/index.js';
import { projectMysticismMagister } from '../../src/domain/mysticism-magister/index.js';
import { projectProphet } from '../../src/domain/prophet/index.js';
import { projectInsightScholar } from '../../src/domain/insight-scholar/index.js';
import { projectWisdomAngel, applyWisdomAngelCommand } from '../../src/domain/wisdom-angel/index.js';
import { applyWisdomAngelActivity, wisdomAngelLifeActions } from '../../src/domain/wisdom-angel/life.js';
import { applyWisdomAngelEncounterCommand } from '../../src/domain/wisdom-angel/encounter.js';
import { validateAllKnowingEyeState, allKnowingEyeInheritedView } from '../../src/domain/all-knowing-eye/index.js';
import { ALL_KNOWING_EYE_ABILITY_IDS } from '../../src/domain/all-knowing-eye/types.js';
import { originalWisdomAngel, readerLegacyKeys, promoted, recoverResources } from './all-knowing-eye-directed-helper.js';
const projectors=[projectReader,projectReasoner,projectDetective,projectPolymath,projectMysticismMagister,projectProphet,projectInsightScholar,projectWisdomAngel];
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('All-Knowing Eye exact Reader inheritance',()=>{
 it('keeps19 masteries and five zeros, original papers and historical people on promotion',()=>{
  const old=originalWisdomAngel(),s=promoted();for(const key of readerLegacyKeys)same(s[key],old[key]);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id],id).toBe(value);
  expect(Object.keys(s.progression.mastery)).toHaveLength(21);expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(5);
  for(const id of ALL_KNOWING_EYE_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe(old.character.gender);same(s.combatHistory,old.combatHistory);
  expect(s.wisdomAngel.life.device).toMatchObject({charges:0,filter:'AMBER',conditionVersion:2});
  expect(s.mysticismMagister.crafts.map(c=>[c.id,c.status])).toEqual([['MM5-FLASH-1','CONSUMED'],['MM5-FLASH-3','PLAYER'],['MM5-FLASH-4','PLAYER']]);
  expect(s.wisdomAngel.encounter.status).toBe('AVAILABLE');assertValidSliceState(s);
 });
 it('shows old completed histories while exact old actions remain closed',()=>{
  const s=promoted();s.progression.acting=25;
  for(const project of projectors)expect(project(s),project.name).toMatchObject({promoted:true,acting:100,actions:[]});
  expect(wisdomAngelLifeActions(s)).toEqual([]);
  s.allKnowingEye.wisdomAngelActingAtPromotion=99;expect(validateAllKnowingEyeState(s)).toBe(false);
 });
 it('rejects lost, additional or unexplained mastery and prematureS1 keys',()=>{
  for(const id of Object.keys(promoted().progression.mastery)){const s=promoted();delete s.progression.mastery[id];expect(validateAllKnowingEyeState(s),id).toBe(false);}
  for(const value of [-1,501,0.5,NaN]){const s=promoted();s.progression.mastery[ALL_KNOWING_EYE_ABILITY_IDS[0]]=value;expect(validateAllKnowingEyeState(s)).toBe(false);}
  for(const id of ['reader.s9.memory',...ALL_KNOWING_EYE_ABILITY_IDS]){const s=promoted();s.progression.mastery[id]!++;expect(validateAllKnowingEyeState(s)).toBe(false);}
  const extra=promoted();extra.progression.mastery['reader.s1.invented']=0;expect(validateAllKnowingEyeState(extra)).toBe(false);
  const premature=originalWisdomAngel();premature.progression.mastery[ALL_KNOWING_EYE_ABILITY_IDS[0]]=0;expect(()=>assertValidSliceState(premature)).toThrow();
 });
 it('keeps spirituality120 as the actual ceiling and rejects121',()=>{const s=recoverResources(promoted());expect(s.spirituality).toBe(120);expect(()=>assertValidSliceState(s)).not.toThrow();s.spirituality=121;expect(()=>assertValidSliceState(s)).toThrow();});
 it('returns a nonmutating originalS2 history view with no duplicated paper or device',()=>{
  const s=promoted(),before=stableStringify(s),view=allKnowingEyeInheritedView(s);
  expect(view.progression.sequence).toBe(2);expect(Object.keys(view.progression.mastery)).toHaveLength(19);
  for(const key of readerLegacyKeys)same(view[key],s.allKnowingEye.sourceHistory![key]);
  same(view.character,s.allKnowingEye.sourceScene!.character);expect(stableStringify(s)).toBe(before);
  view.wisdomAngel.life.device.charges=10;expect(s.wisdomAngel.life.device.charges).toBe(0);
 });
 it('rejects free charges, rewritten old deaths, missing paper and source object teleporting',()=>{
  const changes=[(s:ReturnType<typeof promoted>)=>{s.wisdomAngel.life.device.charges=1;},(s:ReturnType<typeof promoted>)=>{s.wisdomAngel.life.device.conditionVersion=0;},(s:ReturnType<typeof promoted>)=>{s.wisdomAngel.life.papers.pop();},(s:ReturnType<typeof promoted>)=>{s.wisdomAngel.life.playerTravelMetres=0;},(s:ReturnType<typeof promoted>)=>{s.mysticismMagister.crafts[0]!.status='PLAYER';}];
  for(const change of changes){const s=promoted();change(s);expect(validateAllKnowingEyeState(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();}
 });
 it('keeps old acquisition and practice unavailable without rolling or modifying history',()=>{
  const s=promoted(),c:SeerContext={roll:vi.fn(min=>min),note:vi.fn(),check:vi.fn(()=>{throw Error('Unexpected check');})};
  for(const action of [()=>applyReaderCommand(s,{type:'LEARN_GUIDANCE'},c),()=>applyWisdomAngelCommand(s,{type:'BUY_POTION',bottleId:s.wisdomAngel.bottles[0]!.id},c),()=>applyWisdomAngelActivity(s,{type:'REFLECT'},c),()=>applyWisdomAngelEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},c)]){const before=stableStringify(s);expect(action).toThrow();expect(stableStringify(s)).toBe(before);}expect(c.check).not.toHaveBeenCalled();
 });
});
