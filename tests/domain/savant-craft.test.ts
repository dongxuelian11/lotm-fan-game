import {describe,it,expect} from 'vitest';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {sliceDefaultCreationSelection} from '../../src/content/slice-creation.js';
import {applySavantCraft,validateSavantCraft} from '../../src/domain/savant/craft.js';
import {SAVANT_ABILITY_IDS} from '../../src/domain/savant/types.js';
import type {SliceState} from '../../src/domain/slice/types.js';
import type {SeerContext} from '../../src/domain/seer/index.js';
function checkpoint(){const s=createSliceRun('craft-synthetic',sliceDefaultCreationSelection,'craft-synthetic');s.activeEvent=null;s.week=5;s.cash=100;s.savant.discovered=true;s.savant.guidanceKnown=true;Object.assign(s.savant.bottles[0]!,{status:'CONSUMED',outcome:'SUCCESS',acquiredWeek:5,consumedWeek:5});s.progression={pathwayId:'paragon',sequence:9,mastery:Object.fromEntries(SAVANT_ABILITY_IDS.map(x=>[x,0])),acting:0,promotionWeek:5};assertValidSliceState(s);return s;}
const context=(success=true):SeerContext=>({roll:()=>1,note:()=>{},check:()=>({tier:success?'SUCCESS':'FAILURE'} as ReturnType<SeerContext['check']>)});
const cmd=(s:SliceState,type:'STUDY'|'PREPARE'|'CRAFT'|'DELIVER'|'RETURN_TOOLS',projectId='shelf-repair',success=true)=>applySavantCraft(s,{type,projectId},context(success),(id,amount)=>{s.seer.completedSources.push(id);s.progression.mastery[SAVANT_ABILITY_IDS[0]]!+=amount;});
describe('Savant actual ordinary work',()=>{
 it('keeps unread plans unavailable and reveals only studied material',()=>{let s=checkpoint();expect(projectSliceState(s).savant.projects.every(p=>p.plan==='')).toBe(true);s=applySliceIntent(s,{type:'SAVANT',command:{type:'STUDY',projectId:'shelf-repair'}});assertValidSliceState(s);expect(projectSliceState(s).savant.projects.filter(p=>p.plan)).toHaveLength(1);});
 it('requires study, actual material and original borrowed tools',()=>{const s=checkpoint();expect(()=>cmd(s,'PREPARE')).toThrow();cmd(s,'STUDY');expect(()=>cmd(s,'CRAFT')).toThrow();cmd(s,'PREPARE');expect(s.cash).toBe(80);expect(s.savant.projects['shelf-repair']!.tool).toBe('PLAYER');});
 it('returns tools at zero AP and reborrows without purchasing the same materials',()=>{const s=checkpoint();cmd(s,'STUDY');cmd(s,'PREPARE');s.actionsRemaining=0;cmd(s,'RETURN_TOOLS');cmd(s,'PREPARE');expect(s.cash).toBe(80);expect(validateSavantCraft(s)).toBe(true);});
 it('does not hand over a second tool while the first is borrowed',()=>{const s=checkpoint();cmd(s,'STUDY');cmd(s,'PREPARE');cmd(s,'STUDY','handcart-wheel');expect(()=>cmd(s,'PREPARE','handcart-wheel')).toThrow('另一项');});
 it('failure preserves uncut material and original tool, then retries in a later week',()=>{const s=checkpoint();cmd(s,'STUDY');cmd(s,'PREPARE');cmd(s,'CRAFT','shelf-repair',false);expect(s.savant.projects['shelf-repair']!.materials).toBe('WORKBENCH');expect(()=>cmd(s,'CRAFT')).toThrow();s.week++;s.actionsRemaining=3;cmd(s,'CRAFT');expect(s.savant.projects['shelf-repair']!.status).toBe('READY');assertValidSliceState(s);});
 it('success really consumes materials, delivery returns tools and pays once',()=>{const s=checkpoint();cmd(s,'STUDY');cmd(s,'PREPARE');cmd(s,'CRAFT');expect(s.savant.projects['shelf-repair']!.materials).toBe('CONSUMED');s.actionsRemaining=0;cmd(s,'DELIVER');expect(s.cash).toBe(104);expect(s.progression.acting).toBe(20);expect(s.savant.projects['shelf-repair']!.tool).toBe('WORKSHOP');expect(()=>cmd(s,'DELIVER')).toThrow();assertValidSliceState(s);});
 it('allows delivery after explicitly returning the tool, without reborrowing',()=>{const s=checkpoint();cmd(s,'STUDY');cmd(s,'PREPARE');cmd(s,'CRAFT');cmd(s,'RETURN_TOOLS');cmd(s,'DELIVER');assertValidSliceState(s);});
 it('requires four actual deliveries before final reflection',()=>{const s=checkpoint();expect(()=>applySavantCraft(s,{type:'REFLECT'},context(),()=>{})).toThrow();});
 it('rejects fabricated delivered products and material revival',()=>{const s=checkpoint();s.savant.projects['shelf-repair']!.status='DELIVERED';expect(validateSavantCraft(s)).toBe(false);});
});
