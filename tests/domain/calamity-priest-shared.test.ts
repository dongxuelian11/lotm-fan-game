import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='calamity-priest-stage-natural'?JSON.parse(readFileSync('tests/fixtures/calamity-priest-v0910/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/calamity-priest-v0910/boundaries.json','utf8'))[name.slice(16,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Calamity Priest actual shared route',()=>{
 it('preserves earlier luck records and actual cleanup',()=>{
  const c=read('calamity-priest-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.calamityPriest.promotionWeek).toBeGreaterThanOrEqual(s.lucky.promotionWeek!+12);
  expect(s.calamityPriest.luckyActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.lucky.cases).toEqual(c.guidanceStart.lucky.cases);
  expect(projectSliceState(s).lucky.acting).toBe(100);
  expect(Object.values(s.calamityPriest.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.calamityPriest.practice).toEqual({hazard:'SECURED',board:'SECURED',contact:'RELEASED'});
  expect(new Set(projectSliceState(s).calamityPriest.actions.map(a=>a.id)).size).toBe(projectSliceState(s).calamityPriest.actions.length);
 });
 it.each(['promotion','prepare','board','close','report','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`calamity-priest-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps the actual board contact until cleanup and charges its ability',()=>{
  const b=read('calamity-priest-board-save-boundary'),s=b.final as SliceState;
  expect(s.spirituality).toBe(b.beforeLast.spirituality-3);expect(s.calamityPriest.cases['isolated-board']!.contactOpen).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'CALAMITY_PRIEST',command:{type:'CLOSE',caseId:'isolated-board'}});
  expect(after.calamityPriest.cases['isolated-board']!.contactOpen).toBe(false);expect(after.calamityPriest.practice.board).toBe('SECURED');
 });
 it('does not offer chosen luck or use the practice board in the independent battle',()=>{
  const c=read('calamity-priest-stage-natural'),s=c.final as SliceState;
  expect(projectSliceState(s).calamityPriest.actions.some(a=>/REROLL|BANK_LUCK|CHOOSE_LUCK/.test(a.command.type))).toBe(false);
  expect(s.calamityPriest.practice).toEqual(c.combatStart.calamityPriest.practice);
  expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.at(-1)!.consequence).toContain('杜兰');expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
 });
 it('migrates complete Zombie history without losing original moon episodes',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/zombie-v0900/natural.json','utf8')).final,current=migrateSliceState(old);
  const{calamityPriest:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
});
