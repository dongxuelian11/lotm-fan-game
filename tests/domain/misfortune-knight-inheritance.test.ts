import { describe, expect, it, vi } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { projectSleepless, applySleeplessCommand } from '../../src/domain/sleepless/index.js';
import { projectMidnight } from '../../src/domain/midnight/index.js';
import { projectNightmare } from '../../src/domain/nightmare/index.js';
import { projectSoother } from '../../src/domain/soother/index.js';
import { projectSpiritWarlock } from '../../src/domain/spirit-warlock/index.js';
import { projectNightwatcher } from '../../src/domain/nightwatcher/index.js';
import { projectFearBishop } from '../../src/domain/fear-bishop/index.js';
import { projectConcealmentServant, applyConcealmentServantCommand } from '../../src/domain/concealment-servant/index.js';
import { applyConcealmentServantActivity, concealmentServantLifeActions } from '../../src/domain/concealment-servant/life.js';
import { applyConcealmentServantEncounterCommand } from '../../src/domain/concealment-servant/encounter.js';
import { validateMisfortuneKnightState, misfortuneKnightInheritedView } from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_ABILITY_IDS } from '../../src/domain/misfortune-knight/types.js';
import { originalConcealmentServant, darknessLegacyKeys, promoted, recoverResources } from './misfortune-knight-directed-helper.js';
const projectors=[projectSleepless,projectMidnight,projectNightmare,projectSoother,projectSpiritWarlock,projectNightwatcher,projectFearBishop,projectConcealmentServant];
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('Misfortune Knight exact Darkness inheritance',()=>{
 it('keeps18 masteries and five zeros, original leaf and historical people on promotion',()=>{
  const old=originalConcealmentServant(),s=promoted();for(const key of darknessLegacyKeys)same(s[key],old[key]);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id],id).toBe(value);
  expect(Object.keys(s.progression.mastery)).toHaveLength(20);expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(5);
  for(const id of MISFORTUNE_KNIGHT_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe(old.character.gender);same(s.combatHistory,old.combatHistory);
  expect(s.spiritWarlock.companion).toMatchObject({source:'SW5-LEAF-1',status:'SEALED',deployments:12,recalls:12});
  expect(s.nightwatcher.encounter.enemy.status).toBe('DEAD');expect(s.fearBishop.encounter.enemyStatus).toBe('SURRENDERED');
  expect(s.concealmentServant.encounter.status).toBe('AVAILABLE');assertValidSliceState(s);
 });
 it('shows old completed histories while exact old actions remain closed',()=>{
  const s=promoted();s.progression.acting=25;
  for(const project of projectors)expect(project(s),project.name).toMatchObject({promoted:true,acting:100,actions:[]});
  expect(concealmentServantLifeActions(s)).toEqual([]);
  s.misfortuneKnight.concealmentServantActingAtPromotion=99;expect(validateMisfortuneKnightState(s)).toBe(false);
 });
 it('rejects lost, additional or unexplained mastery and prematureS1 keys',()=>{
  for(const id of Object.keys(promoted().progression.mastery)){const s=promoted();delete s.progression.mastery[id];expect(validateMisfortuneKnightState(s),id).toBe(false);}
  for(const value of [-1,501,0.5,NaN]){const s=promoted();s.progression.mastery[MISFORTUNE_KNIGHT_ABILITY_IDS[0]]=value;expect(validateMisfortuneKnightState(s)).toBe(false);}
  for(const id of ['darkness.s9.night-vision',...MISFORTUNE_KNIGHT_ABILITY_IDS]){const s=promoted();s.progression.mastery[id]!++;expect(validateMisfortuneKnightState(s)).toBe(false);}
  const extra=promoted();extra.progression.mastery['darkness.s1.invented']=0;expect(validateMisfortuneKnightState(extra)).toBe(false);
  const premature=originalConcealmentServant();premature.progression.mastery[MISFORTUNE_KNIGHT_ABILITY_IDS[0]]=0;expect(()=>assertValidSliceState(premature)).toThrow();
 });
 it('keeps spirituality120 as the actual ceiling and rejects121',()=>{const s=recoverResources(promoted());expect(s.spirituality).toBe(120);expect(()=>assertValidSliceState(s)).not.toThrow();s.spirituality=121;expect(()=>assertValidSliceState(s)).toThrow();});
 it('returns a nonmutating originalS2 history view with no duplicated spendable leaf',()=>{
  const s=promoted(),before=stableStringify(s),view=misfortuneKnightInheritedView(s);
  expect(view.progression.sequence).toBe(2);expect(Object.keys(view.progression.mastery)).toHaveLength(18);
  for(const key of darknessLegacyKeys)same(view[key],s.misfortuneKnight.sourceHistory![key]);
  same(view.character,s.misfortuneKnight.sourceScene!.character);expect(stableStringify(s)).toBe(before);
  view.spiritWarlock.companion.deployments=0;expect(s.spiritWarlock.companion.deployments).toBe(12);
 });
 it('rejects invented spirits, reset counters, rewritten dead people and returned source objects teleporting',()=>{
  const changes=[(s:ReturnType<typeof promoted>)=>{s.spiritWarlock.companion.deployments=0;},(s:ReturnType<typeof promoted>)=>{s.spiritWarlock.companion.recalls=0;},(s:ReturnType<typeof promoted>)=>{s.nightwatcher.encounter.enemy.health=100;},(s:ReturnType<typeof promoted>)=>{s.concealmentServant.life.box.travelMetres=0;},(s:ReturnType<typeof promoted>)=>{s.concealmentServant.life.room.concealed=true;}];
  for(const change of changes){const s=promoted();change(s);expect(validateMisfortuneKnightState(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();}
 });
 it('keeps old acquisition and practice unavailable without rolling or modifying history',()=>{
  const s=promoted(),c:SeerContext={roll:vi.fn(min=>min),note:vi.fn(),check:vi.fn(()=>{throw Error('Unexpected check');})};
  for(const action of [()=>applySleeplessCommand(s,{type:'LEARN_GUIDANCE'},c),()=>applyConcealmentServantCommand(s,{type:'BUY_POTION',bottleId:s.concealmentServant.bottles[0]!.id},c),()=>applyConcealmentServantActivity(s,{type:'REFLECT'},c),()=>applyConcealmentServantEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},c)]){const before=stableStringify(s);expect(action).toThrow();expect(stableStringify(s)).toBe(before);}expect(c.check).not.toHaveBeenCalled();
 });
});
