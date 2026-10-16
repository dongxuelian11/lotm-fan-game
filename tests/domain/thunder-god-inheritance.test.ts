import { describe, expect, it, vi } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { projectSailor, applySailorCommand } from '../../src/domain/sailor/index.js';
import { projectRager } from '../../src/domain/rager/index.js';
import { projectNavigator } from '../../src/domain/navigator/index.js';
import { projectWindBlessed } from '../../src/domain/wind-blessed/index.js';
import { projectOceanSinger } from '../../src/domain/ocean-singer/index.js';
import { projectCataclysmPriest } from '../../src/domain/cataclysm-priest/index.js';
import { projectSeaKing } from '../../src/domain/sea-king/index.js';
import { projectCatastrophe, applyCatastropheCommand } from '../../src/domain/catastrophe/index.js';
import { applyCatastropheActivity, catastropheLifeActions } from '../../src/domain/catastrophe/life.js';
import { applyCatastropheEncounterCommand } from '../../src/domain/catastrophe/encounter.js';
import { validateThunderGodState, thunderGodInheritedView } from '../../src/domain/thunder-god/index.js';
import { THUNDER_GOD_ABILITY_IDS } from '../../src/domain/thunder-god/types.js';
import { originalCatastrophe, tyrantLegacyKeys, promoted, recoverResources } from './thunder-god-directed-helper.js';
const projectors=[projectSailor,projectRager,projectNavigator,projectWindBlessed,projectOceanSinger,projectCataclysmPriest,projectSeaKing,projectCatastrophe];
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('Thunder God exact Sailor inheritance',()=>{
 it('keeps22 masteries and seven zeros, original bay and historical people on promotion',()=>{
  const old=originalCatastrophe(),s=promoted();for(const key of tyrantLegacyKeys)same(s[key],old[key]);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id],id).toBe(value);
  expect(Object.keys(s.progression.mastery)).toHaveLength(24);expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(7);
  for(const id of THUNDER_GOD_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe(old.character.gender);same(s.combatHistory,old.combatHistory);
  expect(s.catastrophe.life.site).toMatchObject({water:{originalUnits:20,bayUnits:20,channelUnits:0},gate:{durability:96},keeper:{energy:88,travelMetres:36}});
  expect(s.catastrophe.encounter.status).toBe('AVAILABLE');assertValidSliceState(s);
 });
 it('shows old completed histories while exact old actions remain closed',()=>{
  const s=promoted();s.progression.acting=25;
  for(const project of projectors)expect(project(s),project.name).toMatchObject({promoted:true,acting:100,actions:[]});
  expect(catastropheLifeActions(s)).toEqual([]);
  s.thunderGod.catastropheActingAtPromotion=99;expect(validateThunderGodState(s)).toBe(false);
 });
 it('rejects lost, additional or unexplained mastery and prematureS1 keys',()=>{
  for(const id of Object.keys(promoted().progression.mastery)){const s=promoted();delete s.progression.mastery[id];expect(validateThunderGodState(s),id).toBe(false);}
  for(const value of [-1,501,0.5,NaN]){const s=promoted();s.progression.mastery[THUNDER_GOD_ABILITY_IDS[0]]=value;expect(validateThunderGodState(s)).toBe(false);}
  for(const id of ['tyrant.s9.aquatic-affinity',...THUNDER_GOD_ABILITY_IDS]){const s=promoted();s.progression.mastery[id]!++;expect(validateThunderGodState(s)).toBe(false);}
  const extra=promoted();extra.progression.mastery['tyrant.s1.invented']=0;expect(validateThunderGodState(extra)).toBe(false);
  const premature=originalCatastrophe();premature.progression.mastery[THUNDER_GOD_ABILITY_IDS[0]]=0;expect(()=>assertValidSliceState(premature)).toThrow();
 });
 it('keeps spirituality120 as the actual ceiling and rejects121',()=>{const s=recoverResources(promoted());expect(s.spirituality).toBe(120);expect(()=>assertValidSliceState(s)).not.toThrow();s.spirituality=121;expect(()=>assertValidSliceState(s)).toThrow();});
 it('returns a nonmutating originalS2 history view without changing the actual bay',()=>{
  const s=promoted(),before=stableStringify(s),view=thunderGodInheritedView(s);
  expect(view.progression.sequence).toBe(2);expect(Object.keys(view.progression.mastery)).toHaveLength(22);
  for(const key of tyrantLegacyKeys)same(view[key],s.thunderGod.sourceHistory![key]);
  same(view.character,s.thunderGod.sourceScene!.character);expect(stableStringify(s)).toBe(before);
  view.catastrophe.life.site.keeper.energy=100;expect(s.catastrophe.life.site.keeper.energy).toBe(88);
 });
 it('rejects free water, repaired original gate, restored keeper energy and original-site teleporting',()=>{
  const changes=[(s:ReturnType<typeof promoted>)=>{s.catastrophe.life.site.water.bayUnits++;},(s:ReturnType<typeof promoted>)=>{s.catastrophe.life.site.gate.durability=100;},(s:ReturnType<typeof promoted>)=>{s.catastrophe.life.site.keeper.energy=100;},(s:ReturnType<typeof promoted>)=>{s.catastrophe.life.site.keeper.travelMetres=0;},(s:ReturnType<typeof promoted>)=>{s.catastrophe.life.site.playerPosition='CONTROL';}];
  for(const change of changes){const s=promoted();change(s);expect(validateThunderGodState(s)).toBe(false);expect(()=>assertValidSliceState(s)).toThrow();}
 });
 it('keeps old acquisition and practice unavailable without rolling or modifying history',()=>{
  const s=promoted(),c:SeerContext={roll:vi.fn(min=>min),note:vi.fn(),check:vi.fn(()=>{throw Error('Unexpected check');})};
  for(const action of [()=>applySailorCommand(s,{type:'LEARN_GUIDANCE'},c),()=>applyCatastropheCommand(s,{type:'BUY_POTION',bottleId:s.catastrophe.bottles[0]!.id},c),()=>applyCatastropheActivity(s,{type:'REFLECT'},c),()=>applyCatastropheEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},c)]){const before=stableStringify(s);expect(action).toThrow();expect(stableStringify(s)).toBe(before);}expect(c.check).not.toHaveBeenCalled();
 });
});
