import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='rose-bishop-stage-natural'?JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/boundaries.json','utf8'))[name.slice(12,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('RoseBishop original shared route',()=>{
 it('finishes actual reports with inherited history and independently consumed rations',()=>{
  const c=read('rose-bishop-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.roseBishop.promotionWeek).toBeGreaterThanOrEqual(s.shadowAscetic.promotionWeek!+12);
  expect(s.roseBishop.shadowAsceticActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.shadowAscetic.cases).toEqual(c.guidanceStart.shadowAscetic.cases);
  expect(Object.values(s.roseBishop.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.roseBishop.practice.shape).toBe('NORMAL');
  expect(s.roseBishop.reserve.packets).toHaveLength(s.roseBishop.reserve.packetsBought);
  expect(s.roseBishop.reserve.packets.filter(x=>x.status==='CONSUMED').length).toBeGreaterThanOrEqual(5);
  expect(new Set(projectSliceState(s).roseBishop.actions.map(a=>a.id)).size).toBe(projectSliceState(s).roseBishop.actions.length);
 });
 it.each(['promotion','buy','reserve','shape','close','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`rose-bishop-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('consumes an exact packet once without treating food as healing',()=>{
  const b=read('rose-bishop-reserve-save-boundary'),id=b.lastIntent.command.packetId;
  expect(b.beforeLast.roseBishop.reserve.packets.find((x:any)=>x.id===id).status).toBe('HELD');
  expect(b.final.roseBishop.reserve.packets.find((x:any)=>x.id===id).status).toBe('CONSUMED');
  expect(b.final.roseBishop.reserve.points).toBe(b.beforeLast.roseBishop.reserve.points+1);
  expect(b.final.health).toBe(b.beforeLast.health);
  expect(()=>applySliceIntent(b.final,b.lastIntent)).toThrow();
 });
 it('holds the actual changed body until explicit zero-AP close',()=>{
  const b=read('rose-bishop-shape-save-boundary'),s=b.final as SliceState,caseId=b.lastIntent.command.caseId;
  expect(s.roseBishop.reserve.points).toBe(b.beforeLast.roseBishop.reserve.points-1);
  expect(s.roseBishop.cases[caseId]!.contactOpen).toBe(true);expect(s.roseBishop.practice.shape).not.toBe('NORMAL');
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'ROSE_BISHOP',command:{type:'CLOSE',caseId}});
  expect(projectSliceState(after).roseBishop.insideCase).toBe(false);expect(after.roseBishop.practice.shape).toBe('NORMAL');
  expect(after.roseBishop.reserve).toEqual(s.roseBishop.reserve);
 });
 it('retains the old carrier and shows only held actual ration packets',()=>{
  const c=read('rose-bishop-stage-natural'),s=c.final as SliceState;expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  const terminal=s.combatHistory.at(-1)!;expect(terminal.consequence).toContain('维恩');expect(terminal.consequence).not.toContain('携铃者');
  for(const packet of s.roseBishop.reserve.packets)expect(projectSliceState(s).town.items.some(i=>i.id===packet.id)).toBe(packet.status==='HELD');
 });
 it('migrates the complete prior ScrollProfessor save without discarding original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/scroll-professor-v0870/natural.json','utf8')).final,current=migrateSliceState(old);
  const{roseBishop:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
});
