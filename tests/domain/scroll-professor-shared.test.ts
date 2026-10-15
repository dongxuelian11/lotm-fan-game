import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='scroll-professor-stage-natural'?JSON.parse(readFileSync('tests/fixtures/scroll-professor-v0870/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/scroll-professor-v0870/boundaries.json','utf8'))[name.slice(17,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('ScrollProfessor original shared route',()=>{
 it('retains Wizard lessons and actual material lineage throughout the new stage',()=>{
  const c=read('scroll-professor-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.scrollProfessor.promotionWeek).toBeGreaterThanOrEqual(s.wizard.promotionWeek!+12);
  expect(s.scrollProfessor.wizardActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.wizard.lessons).toEqual(c.guidanceStart.wizard.lessons);
  expect(Object.values(s.scrollProfessor.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  const w=s.scrollProfessor.workshop;expect(w.materials).toHaveLength(w.kitsBought*4);
  expect(new Set(w.scrolls.map(x=>x.materialId)).size).toBe(w.scrolls.length);
  for(const scroll of w.scrolls)expect(w.materials.find(m=>m.id===scroll.materialId)!.status).toBe('SPENT');
  expect(new Set(projectSliceState(s).scrollProfessor.actions.map(a=>a.id)).size).toBe(projectSliceState(s).scrollProfessor.actions.length);
 });
 it.each(['promotion','craft','use','authorize','close','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`scroll-professor-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('actually burns a created original even when a practice fails and must explicitly finish',()=>{
  const b=read('scroll-professor-use-save-boundary'),s=b.final as SliceState;
  const used=s.scrollProfessor.workshop.scrolls.filter(x=>x.status==='USED').length;
  expect(used).toBe(b.beforeLast.scrollProfessor.workshop.scrolls.filter((x:any)=>x.status==='USED').length+1);
  const caseId=b.lastIntent.command.caseId;expect(s.scrollProfessor.cases[caseId]!.contactOpen).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'SCROLL_PROFESSOR',command:{type:'CLOSE',caseId}});
  expect(projectSliceState(after).scrollProfessor.insideCase).toBe(false);expect(after.scrollProfessor.workshop.scrolls).toEqual(s.scrollProfessor.workshop.scrolls);
 });
 it('authorizes only the actual held original, without consuming or duplicating it',()=>{
  const b=read('scroll-professor-authorize-save-boundary');
  const id=b.lastIntent.command.scrollId;expect(b.beforeLast.scrollProfessor.workshop.scrolls.find((x:any)=>x.id===id)).toMatchObject({status:'HELD',authorized:false});
  expect(b.final.scrollProfessor.workshop.scrolls.find((x:any)=>x.id===id)).toMatchObject({status:'HELD',authorized:true});
  expect(b.final.scrollProfessor.workshop.scrolls.length).toBe(b.beforeLast.scrollProfessor.workshop.scrolls.length);
 });
 it('keeps old first-case bodies and displays only real held scrolls in the bag',()=>{
  const c=read('scroll-professor-stage-natural'),s=c.final as SliceState;expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  const terminal=s.combatHistory.at(-1)!;expect(terminal.consequence).toContain('卡尔');expect(terminal.consequence).not.toContain('携铃者');expect(terminal.consequence).not.toContain('箱子');
  const items=projectSliceState(s).town.items;
  for(const original of s.scrollProfessor.workshop.scrolls)expect(items.some(i=>i.id===original.id)).toBe(original.status==='HELD');
 });
 it('migrates the complete previous Pleasure save without discarding any original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/natural.json','utf8')).final,current=migrateSliceState(old);
  const{scrollProfessor:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
 it('shows the real prepared Pleasure potion as a brewed original in the inventory',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/boundaries.json','utf8')).promotion.beforeLast,s=migrateSliceState(old);assertValidSliceState(s);
  const b=s.pleasure.bottles.find(x=>x.status==='PREPARED')!;expect(b).toBeTruthy();
  expect(projectSliceState(s).town.items.filter(i=>i.id===b.id)).toHaveLength(1);
 });
});
