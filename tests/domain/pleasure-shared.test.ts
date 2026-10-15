import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const currentCapture=(v:any)=>{for(const k of Object.keys(v))if(v[k]&&typeof v[k]==='object'&&'schemaVersion'in v[k])v[k]=migrateSliceState(v[k]);return v;};
const read=(name:string)=>currentCapture(name.endsWith('-stage-natural')?JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/boundaries.json','utf8'))[name.slice('pleasure-'.length,-'-save-boundary'.length)]);
describe('Pleasure original shared route',()=>{
 it('keeps the original Witch body, materials and history through actual seven-material promotion',()=>{
  const c=read('pleasure-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(new Set(projectSliceState(s).pleasure.actions.map(a=>a.id)).size).toBe(projectSliceState(s).pleasure.actions.length);
  expect(s.progression.sequence).toBe(6);expect(s.pleasure.promotionWeek).toBeGreaterThanOrEqual(s.witch.promotionWeek!+12);
  expect(s.pleasure.witchActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.character.gender).toBe(c.guidanceStart.character.gender);expect(s.witch.previousGender).toBe(c.guidanceStart.witch.previousGender);
  expect(Object.values(s.pleasure.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  const bottle=s.pleasure.bottles.find(b=>b.outcome==='SUCCESS'||b.outcome==='GREAT_SUCCESS')!;
  expect(bottle.inputIds).toHaveLength(7);expect(s.pleasure.batches.find(b=>b.id===bottle.batchId)!.materials.every(m=>m.holder==='CONSUMED')).toBe(true);
 });
 it.each(['promotion','silk','refusal','fire','close','combat'])('replays actual %s through JSON migration',key=>{
  const b=read(`pleasure-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps an actual refusal and separately creates and breaks finite frame silk',()=>{
  const c=read('pleasure-stage-natural'),r=read('pleasure-refusal-save-boundary');
  expect(r.final.pleasure.cases['refused-invitation'].status).toBe('OBSERVED');
  expect(c.practiced.pleasure.cases['refused-invitation'].notes).toBe(1);
  expect(c.practiced.pleasure.practice).toMatchObject({wrist:'FREE',fireBreak:'BLACK_FLAME'});
  const spin=read('pleasure-spin-save-boundary');expect(spin.final.spirituality).toBe(spin.beforeLast.spirituality-3);
  expect(spin.final.pleasure.practice.fireSilk).toBe('ON_FRAME');
 });
 it('blocks work until actual release and preserves cost and the original consent outcome',()=>{
  const b=read('pleasure-silk-save-boundary'),s=b.final as SliceState;
  expect(s.pleasure.cases['silk-release'].contactOpen).toBe(true);expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'PLEASURE',command:{type:'CLOSE',caseId:'silk-release'}});
  expect(projectSliceState(after).pleasure.insideCase).toBe(false);expect(after.pleasure.practice.wrist).toBe('FREE');
  expect(after.spirituality).toBe(s.spirituality);
 });
 it('cleans actual temporary battle silk without changing old first-case outcomes or original ownership',()=>{
  const c=read('pleasure-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
  expect(c.final.pleasure.encounter).toMatchObject({silkPrepared:false,boundRound:null});
 });
 it('migrates the complete prior DawnPaladin save preserving all old fields',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/dawn-paladin-v0850/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.pleasure.promotionWeek).toBeNull();
  const{pleasure:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((facts as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);expect(current.schemaVersion).toBe(174);
 });
});
