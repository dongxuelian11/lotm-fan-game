import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { readFileSync } from 'node:fs';
import { validateSeerState, type SeerContext } from '../../src/domain/seer/index.js';
import { validateAudienceState, projectAudience, applyAudienceCommand } from '../../src/domain/audience/index.js';
import { validateMindreaderState, projectMindreader } from '../../src/domain/mindreader/index.js';
import { validatePsychologistState, projectPsychologist } from '../../src/domain/psychologist/index.js';
import { validateHypnotistState, projectHypnotist } from '../../src/domain/hypnotist/index.js';
import { validateDreamwalkerState, projectDreamwalker } from '../../src/domain/dreamwalker/index.js';
import { validateManipulatorState, projectManipulator } from '../../src/domain/manipulator/index.js';
import { validateDreamWeaverState, projectDreamWeaver } from '../../src/domain/dream-weaver/index.js';
import { validateDiscernerState, projectDiscerner, applyDiscernerCommand } from '../../src/domain/discerner/index.js';
import { applyDiscernerActivity, discernerLifeActions } from '../../src/domain/discerner/life.js';
import { applyDiscernerEncounterCommand, validateDiscernerEncounter } from '../../src/domain/discerner/encounter.js';
import { validateWriterState } from '../../src/domain/writer/index.js';
import { WRITER_ABILITY_IDS } from '../../src/domain/writer/types.js';
import { audienceLegacyKeys, discernerNaturalPath, originalDiscerner, promoted } from './writer-directed-helper.js';
const validators=[validateAudienceState,validateMindreaderState,validatePsychologistState,validateHypnotistState,validateDreamwalkerState,validateManipulatorState,validateDreamWeaverState,validateDiscernerState,validateSeerState];
const projectors=[projectAudience,projectMindreader,projectPsychologist,projectHypnotist,projectDreamwalker,projectManipulator,projectDreamWeaver,projectDiscerner];
describe('Writer preserves actual Audience9–2 histories',()=>{
 it('pins original580 source and retains eight roots and every zero mastery through public directed promotion',()=>{
  expect(createHash('sha256').update(readFileSync(discernerNaturalPath)).digest('hex')).toBe('c586d61403e2077e480111365a1fc88837f2d9d8f8b1db25571e2587e35de575');
  const old=originalDiscerner(),s=promoted();
  for(const key of audienceLegacyKeys)expect(s[key],key).toEqual(old[key]);
  for(const[id,value]of Object.entries(old.progression.mastery))expect(s.progression.mastery[id],id).toBe(value);
  expect(Object.keys(s.progression.mastery)).toHaveLength(25);expect(Object.values(old.progression.mastery).filter(v=>v===0)).toHaveLength(8);
  for(const id of WRITER_ABILITY_IDS)expect(s.progression.mastery[id]).toBe(0);
  expect(s.character.name).toBe(old.character.name);expect(s.character.gender).toBe(old.character.gender);
  expect(s.combatHistory).toEqual(old.combatHistory);expect(s.discerner.encounter.enemyStatus).toBe('SURRENDERED');
  for(const validate of validators)expect(validate(s),validate.name).toBe(true);
 });
 it('projects all old stages as history without actions and preserves their own100 acting',()=>{
  const s=promoted();s.progression.acting=25;
  for(const project of projectors)expect(project(s),project.name).toMatchObject({promoted:true,acting:100,actions:[]});
  expect(discernerLifeActions(s)).toEqual([]);
  s.writer.discernerActingAtPromotion=99;expect(validateWriterState(s)).toBe(false);
 });
 it('rejects missing, extra or invalid mastery without accepting premature1 abilities',()=>{
  for(const id of Object.keys(promoted().progression.mastery)){
   const s=promoted();delete s.progression.mastery[id];for(const validate of validators)expect(validate(s),`${validate.name}/${id}`).toBe(false);
  }
  for(const value of [-1,501,0.5,NaN]){const s=promoted();s.progression.mastery[WRITER_ABILITY_IDS[0]]=value;for(const validate of validators)expect(validate(s),validate.name).toBe(false);}
  const extra=promoted();extra.progression.mastery['audience.s1.invented']=0;for(const validate of validators)expect(validate(extra),validate.name).toBe(false);
  const premature=originalDiscerner();premature.progression.mastery[WRITER_ABILITY_IDS[0]]=0;for(const validate of validators)expect(validate(premature),validate.name).toBe(false);
 });
 it('accepts the actual S1 spirituality ceiling120 and rejects a forged121',()=>{
  const s=promoted();expect(s.spirituality).toBe(120);expect(()=>assertValidSliceState(s)).not.toThrow();
  s.spirituality=121;expect(()=>assertValidSliceState(s)).toThrow();
 });
 it('rejects invented old or new mastery without a corresponding actual award',()=>{
  for(const id of ['audience.s7.soothe', ...WRITER_ABILITY_IDS]){
   const s=promoted();s.progression.mastery[id]!++;expect(validateWriterState(s)).toBe(false);
  }
 });
 it('keeps old acquisition, life and encounter actions closed without checks or mutation',()=>{
  const s=promoted(),c:SeerContext={roll:vi.fn(min=>min),note:vi.fn(),check:vi.fn(()=>{throw Error('Unexpected check');})};
  for(const action of [()=>applyAudienceCommand(s,{type:'LEARN_FORMULA'},c),()=>applyDiscernerCommand(s,{type:'BUY_POTION',bottleId:s.discerner.bottles[0]!.id},c),()=>applyDiscernerActivity(s,{type:'OBSERVE',caseId:'present-mark'},c),()=>applyDiscernerEncounterCommand(s,{type:'ENCOUNTER_FIGHT'},c)]){
   const before=structuredClone(s);expect(action).toThrow();expect(s).toEqual(before);
  }
  expect(c.check).not.toHaveBeenCalled();
  for(const status of ['READY','FIGHTING','LOST'] as const){const changed=promoted();changed.discerner.encounter.status=status;expect(validateDiscernerEncounter(changed)).toBe(false);}
 });
});
