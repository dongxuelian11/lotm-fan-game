import {UNDYING_LIFECYCLE_BOUNDARY} from '../../src/domain/undying/content.js';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const raw=name==='stage-natural'?JSON.parse(readFileSync('tests/fixtures/undying-v01260/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/undying-v01260/boundaries.json','utf8'))[name.replace('-save-boundary','')];for(const [key,value]of Object.entries(raw))if(value&&typeof value==='object'&&'schemaVersion'in value){raw[key]=migrateSliceState(value);const oldBoundary="第五部第31章支持不死者每六十年周期性死去与复活，遗忘大部分过去记忆，再逐步恢复。它不是战斗复活冷却，也不保证任意致命伤后复生；尸身、灵魂与复起细节尚未核实，阿兹克更高层次的分魂诅咒不能直接套用。当前仅登记实际晋升日期及其六十年后同月同日的G预期周年（闰日必要时记2月28日），这不是原著精确计时公式。六十年周期尚未实际经历，周期性死亡、复活、失忆及逐渐恢复的实际玩法仍是完整1.0前必须补齐的内容。普通战斗死亡与封存不变，不自动回满、复制身体、还原灵魂、跳过六十年或令见证人永生；记忆簿也不保证找回完整自我。";for(const id of ['record-370-606','record-373-611']){for(const record of [raw[key].chronicle.find((r:any)=>r.id===id),raw[key].lastResult?.id===id?raw[key].lastResult:undefined])if(record){expect(record.text.endsWith(oldBoundary)).toBe(true);record.text=record.text.slice(0,-oldBoundary.length)+UNDYING_LIFECYCLE_BOUNDARY;}}}return raw;};
const prior=['corpsecollector','gravedigger','spiritmedium','spiritGuide','gatekeeper'] as const;
describe('Undying actual advancement and honest unexperienced cycle preparation',()=>{
 it('registers the real promotion date without claiming death, revival or recovered memories',()=>{
  const c=read('stage-natural'),s=c.promoted as SliceState;assertValidSliceState(s);expect(s.progression.sequence).toBe(4);expect(s.undying.gatekeeperActingAtPromotion).toBe(100);
  expect(s.undying.lifecycle).toMatchObject({promotionDate:s.date,experiencedCycles:0,status:'REGISTERED_NOT_EXPERIENCED'});expect(s.undying.lifecycle.expectedCycleDate!.year).toBe(s.date.year+60);expect(s.undying.ritual.playerLocation).toBe('HALL');
  for(const key of prior)expect(s[key]).toEqual(c.guidanceStart[key]);expect(s.character.gender).toBe(c.guidanceStart.character.gender);expect(projectSliceState(s).maxSpirituality).toBe(120);expect(projectSliceState(s).gatekeeper.acting).toBe(100);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['death.s4.underworld-seal']);expect(projectSliceState(s).undying.lifecycle.summary).toContain('尚未实际经历');
 });
 it.each(['book','open','check','promotion','exit','ledger','witness','seal','return-book','stop','close','report','combat'])('replays actual %s with full state and JSON equality',key=>{
  const b=read(`${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('walks out of the actual room while leaving original bottle and kit consumed',()=>{
  const b=read('exit-save-boundary'),before=b.beforeLast as SliceState,s=b.final as SliceState;expect(s.undying.ritual.playerLocation).toBe('OUTSIDE');expect(s.undying.ritual.visits.at(-1)!.kit.status).toBe('CONSUMED');expect(s.undying.bottles).toEqual(before.undying.bottles);for(const key of prior)expect(s[key]).toEqual(before[key]);
 });
 it('keeps the same three-page book, actual witness and finite consumed strips without inventing a spirit',()=>{
  const c=read('stage-natural'),s=c.practiced as SliceState,l=s.undying.life;expect(s.progression.acting).toBe(100);expect(l.playerLocation).toBe('OUTSIDE');expect(l.book).toMatchObject({id:'UDY4-BOOK-1',owner:'PLAYER',location:'PLAYER',blankPages:0});expect(l.book.entries).toHaveLength(3);expect(l.book.placements).toBe(l.book.returns);expect(l.book.returns).toBeGreaterThanOrEqual(2);
  expect(l.witness.id).toBe('EVELYN-VOSS');expect(l.witness.entryIds).toEqual(l.book.entries.map(e=>e.id));expect(l.witness.uncertainty).toContain('六十年');expect(l.vessel).toMatchObject({id:'UDY4-ECHO-VESSEL',owner:'ARCHIVE',quantity:1,status:'ACTIVE'});expect(l.strips.length).toBeGreaterThan(0);expect(l.strips.every(x=>x.status==='CONSUMED')).toBe(true);
  expect(Object.values(l.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen&&!r.effectActive)).toBe(true);for(const key of prior)expect(s[key]).toEqual(c.guidanceStart[key]);expect(s.undying.lifecycle.experiencedCycles).toBe(0);
 });
 it('retains the original optional guard outcome and older ghost and conflict facts',()=>{
  const c=read('stage-natural'),s=c.final as SliceState;expect(s.combat).toBeNull();expect(s.undying.encounter.enemy.id).toBe('UDY4-OWEN');expect(s.gatekeeper).toEqual(c.guidanceStart.gatekeeper);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);const last=s.combatHistory.at(-1)!.undyingOutcome!;expect(last.enemyHealth).toBe(s.undying.encounter.enemy.health);expect(s.undying.lifecycle.experiencedCycles).toBe(0);
 });
 it('migrates prior0.125 full terminal with every older field unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json','utf8')).final,s=migrateSliceState(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((s as any)[key]).toEqual(old[key]);expect(s.undying.promotionWeek).toBeNull();expect(migrateSliceState(s)).toEqual(s);
 });
});
