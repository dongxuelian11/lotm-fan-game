import {UNDYING_LIFECYCLE_BOUNDARY} from '../../dist/domain/undying/content.js';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/undying-v01260/natural.json','utf8'));
const prefixCount=old.practiced.revision-1, creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<900);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/long-chapter-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);if(commands.length>prefixCount){const key=c.type==='LONG_CHAPTER'?c.command.type.toLowerCase():null;if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,command:c,week:s.week,date:s.date,H:s.health,M:s.mind,S:s.spirituality,AP:s.actionsRemaining,phase:s.longChapter.phase}));}}
for(const c of old.commands.slice(0,prefixCount))go(c);
const expectedPrefix=migrateSliceState(old.practiced);
const oldBoundary="第五部第31章支持不死者每六十年周期性死去与复活，遗忘大部分过去记忆，再逐步恢复。它不是战斗复活冷却，也不保证任意致命伤后复生；尸身、灵魂与复起细节尚未核实，阿兹克更高层次的分魂诅咒不能直接套用。当前仅登记实际晋升日期及其六十年后同月同日的G预期周年（闰日必要时记2月28日），这不是原著精确计时公式。六十年周期尚未实际经历，周期性死亡、复活、失忆及逐渐恢复的实际玩法仍是完整1.0前必须补齐的内容。普通战斗死亡与封存不变，不自动回满、复制身体、还原灵魂、跳过六十年或令见证人永生；记忆簿也不保证找回完整自我。";
for(const id of ['record-370-606','record-373-611']){const record=expectedPrefix.chronicle.find(r=>r.id===id);assert(record&&record.text.endsWith(oldBoundary));record.text=record.text.slice(0,-oldBoundary.length)+UNDYING_LIFECYCLE_BOUNDARY;}
assert.deepEqual(s,expectedPrefix);const departureStart=structuredClone(s);
const lc=c=>go({type:'LONG_CHAPTER',command:c});
function clear(){for(let n=0;n<10&&s.activeEvent;n++){const e=projectSliceState(s).activeEvent,id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':e.id.startsWith('ORIGIN')?'.decline':null;assert(id,'unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}assert.equal(s.activeEvent,null);}
clear();lc({type:'REVIEW'});
if(s.gatekeeper.companion.status==='INSIDE'){lc({type:'RELEASE_GRAY_FEATHER'});clear();}
for(const taskId of ['SORT_RECORDS','CHECK_CHEST','COPY_HANDOVER','PREPARE_ROOM']){lc({type:'PREPARE_SUPPORT',taskId});clear();}
lc({type:'BOOK_IN'});lc({type:'PAY_RESIDENCE',confirmed:true});const prepared=structuredClone(s);
lc({type:'LIVE_TO_CYCLE',confirmed:true});const cycleDead=structuredClone(s);
assert.equal(s.longChapter.phase,'CYCLE_DEAD');assert.deepEqual(s.date,s.undying.lifecycle.expectedCycleDate);assert.equal(s.status,'ACTIVE');assert.equal(s.health,0);
lc({type:'AWAIT_REVIVAL'});const revived=structuredClone(s);
lc({type:'BOOK_OUT'});
for(const type of ['RECOVER_IDENTITY','RECOVER_CASE','RECOVER_WITNESS'])lc({type});const recovered=structuredClone(s);
// Continue only through actual new-era actions. No former employer, old NPC or old shop is used.
let actions=projectSliceState(s).longChapter.actions;
if(actions.some(a=>a.enabled&&a.command.type==='ENTER_RECEPTION'))lc({type:'ENTER_RECEPTION'});
for(let n=0;n<12;n++){
 actions=projectSliceState(s).longChapter.actions;
 const type=s.actionsRemaining===0?'NEXT_WEEK':n%3===1?'REST':'WORK';
 const a=actions.find(a=>a.enabled&&a.command.type===type);if(a)lc(a.command);
 if(n>=4&&s.longChapter.newLife.works>0&&s.longChapter.newLife.rests>0&&s.longChapter.newLife.weeks>0)break;
}
const exit=projectSliceState(s).longChapter.actions.find(a=>a.enabled&&a.command.type==='LEAVE_RECEPTION');assert(exit,'actual ordinary new reception exit available');lc(exit.command);
assert.equal(s.undying.lifecycle.experiencedCycles,1);assert.equal(s.longChapter.recoveredSources.length,3);
const c={creation,seed,commands,prefixCount,departureStart,prepared,cycleDead,revived,recovered,beforeLast,lastIntent,final:s};
writeFileSync('output/play/long-chapter-stage-natural.json',JSON.stringify(c));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/long-chapter-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/long-chapter-v01390',{recursive:true});writeFileSync('tests/fixtures/long-chapter-v01390/natural.json',JSON.stringify(c));writeFileSync('tests/fixtures/long-chapter-v01390/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,date:s.date,week:s.week,phase:s.longChapter.phase,body:s.longChapter.body,people:s.longChapter.people,memory:s.longChapter.recoveredSources,boundaries:Object.keys(boundaries)}));
