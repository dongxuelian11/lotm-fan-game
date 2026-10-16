import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { type SeerContext } from '../../src/domain/seer/index.js';
import { projectSavant, applySavantCommand } from '../../src/domain/savant/index.js';
import { projectArchaeologist } from '../../src/domain/archaeologist/index.js';
import { projectAppraiser } from '../../src/domain/appraiser/index.js';
import { projectArtisan } from '../../src/domain/artisan/index.js';
import { projectAstronomer } from '../../src/domain/astronomer/index.js';
import { projectAlchemist } from '../../src/domain/alchemist/index.js';
import { projectArcaneScholar } from '../../src/domain/arcane-scholar/index.js';
import { projectKnowledgeMentor, applyKnowledgeMentorCommand } from '../../src/domain/knowledge-mentor/index.js';
import { applyKnowledgeMentorActivity, knowledgeMentorLifeActions } from '../../src/domain/knowledge-mentor/life.js';
import { applyKnowledgeMentorEncounterCommand } from '../../src/domain/knowledge-mentor/encounter.js';
import { validateCivilizationEnlightenerState, civilizationEnlightenerInheritedView } from '../../src/domain/civilization-enlightener/index.js';
import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../../src/domain/civilization-enlightener/types.js';
import { knowledgeMentorNaturalPath, originalKnowledgeMentor, paragonLegacyKeys, promoted, recoverResources } from './civilization-enlightener-directed-helper.js';
const projectors=[projectSavant,projectArchaeologist,projectAppraiser,projectArtisan,projectAstronomer,projectAlchemist,projectArcaneScholar,projectKnowledgeMentor];
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('Civilization Enlightener original Paragon histories',()=>{
 it('pins actual691 source and preserves19 masteries, seven zeros, original exhausted objects and dead bodies',()=>{
  expect(createHash('sha256').update(readFileSync(knowledgeMentorNaturalPath)).digest('hex')).toBe('a1d58df609ea1c22e6605f8267a4e0792be7c2278fe2eb99c9b776af1a3d5b9a');
  const old=originalKnowledgeMentor(),s=promoted();
  for(const key of paragonLegacyKeys)same(s[key],old[key]);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id],id).toBe(value);
  expect(Object.keys(s.progression.mastery)).toHaveLength(21);expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(7);
  for(const id of CIVILIZATION_ENLIGHTENER_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe(old.character.gender);
  same(s.combatHistory,old.combatHistory);expect(s.knowledgeMentor.encounter.enemyStatus).toBe('DEAD');expect(s.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED');
  expect(s.alchemist.life.creations.map(x=>[x.charge,x.durability])).toEqual([[0,100],[0,90]]);assertValidSliceState(s);
 });
 it('projects eight old stages as consumed history while exact old actions stay closed',()=>{
  const s=promoted();s.progression.acting=25;
  for(const project of projectors)expect(project(s),project.name).toMatchObject({promoted:true,acting:100,actions:[]});
  expect(knowledgeMentorLifeActions(s)).toEqual([]);
  s.civilizationEnlightener.knowledgeMentorActingAtPromotion=99;expect(validateCivilizationEnlightenerState(s)).toBe(false);
 });
 it('rejects missing extra and unjustified mastery and prematureS1 keys',()=>{
  for(const id of Object.keys(promoted().progression.mastery)){const s=promoted();delete s.progression.mastery[id];expect(validateCivilizationEnlightenerState(s),id).toBe(false);}
  for(const value of [-1,501,0.5,NaN]){const s=promoted();s.progression.mastery[CIVILIZATION_ENLIGHTENER_ABILITY_IDS[0]]=value;expect(validateCivilizationEnlightenerState(s)).toBe(false);}
  for(const id of ['paragon.s8.ancient-history',...CIVILIZATION_ENLIGHTENER_ABILITY_IDS]){const s=promoted();s.progression.mastery[id]!++;expect(validateCivilizationEnlightenerState(s)).toBe(false);}
  const extra=promoted();extra.progression.mastery['paragon.s1.invented']=0;expect(validateCivilizationEnlightenerState(extra)).toBe(false);
  const premature=originalKnowledgeMentor();premature.progression.mastery[CIVILIZATION_ENLIGHTENER_ABILITY_IDS[0]]=0;expect(()=>assertValidSliceState(premature)).toThrow();
 });
 it('keeps actual spirituality ceiling120 without accepting121',()=>{const s=recoverResources(promoted());expect(s.spirituality).toBe(120);expect(()=>assertValidSliceState(s)).not.toThrow();s.spirituality=121;expect(()=>assertValidSliceState(s)).toThrow();});
 it('does not mutate live state when constructing the exact historical source view',()=>{
  const s=promoted(),before=stableStringify(s),view=civilizationEnlightenerInheritedView(s);
  expect(view.progression.sequence).toBe(2);expect(Object.keys(view.progression.mastery)).toHaveLength(19);
  for(const key of paragonLegacyKeys)same(view[key],s.civilizationEnlightener.sourceHistory![key]);
  expect(stableStringify(s)).toBe(before);view.alchemist.life.creations[0]!.charge=3;expect(s.alchemist.life.creations[0]!.charge).toBe(0);
 });
 it('rejects forged original resources and dead or surrendered historical people',()=>{
  for(const change of [(s:ReturnType<typeof promoted>)=>{s.alchemist.life.creations[0]!.charge=3;},(s:ReturnType<typeof promoted>)=>{s.alchemist.life.creations[1]!.durability=100;},(s:ReturnType<typeof promoted>)=>{s.knowledgeMentor.encounter.enemyStatus='RESISTING';},(s:ReturnType<typeof promoted>)=>{s.arcaneScholar.encounter.enemyStatus='RESISTING';}]){const s=promoted();change(s);expect(validateCivilizationEnlightenerState(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();}
 });
 it('keeps old acquisition, life and encounter mutations unavailable without rolling',()=>{
  const s=promoted(),c:SeerContext={roll:vi.fn(min=>min),note:vi.fn(),check:vi.fn(()=>{throw Error('Unexpected check');})};
  for(const action of [()=>applySavantCommand(s,{type:'LEARN_GUIDANCE'},c),()=>applyKnowledgeMentorCommand(s,{type:'BUY_POTION',bottleId:s.knowledgeMentor.bottles[0]!.id},c),()=>applyKnowledgeMentorActivity(s,{type:'REFLECT'},c),()=>applyKnowledgeMentorEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},c)]){const before=stableStringify(s);expect(action).toThrow();expect(stableStringify(s)).toBe(before);}expect(c.check).not.toHaveBeenCalled();
 });
});
