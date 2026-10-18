import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/star-mystic-v01090/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1800);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/mystic-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='MYSTIC'?c.command.type:null;let key=({CONSUME:s.progression.sequence===4?'promotion':'consume',ACQUIRE_SAMPLE:'sample',OPEN_ANALYSIS:'analysis-open',ANALYZE_SAMPLE:'analysis-'+commands.filter(x=>x.type==='MYSTIC'&&x.command.type==='ANALYZE_SAMPLE').length,CLOSE_ANALYSIS:'analysis-close',RETURN_SAMPLE:'sample-return',PREPARE:'prepare',PERFORM:c.command?.caseId,RETURN_ROUTE:'return-route',CLOSE:'close',REPORT:'report',PUBLISH_STORY:'publish',CRAFT_SCROLL:'craft',AUTHORIZE_SCROLL:'authorize',ENCOUNTER_FIGHT:'fight-start'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':c.type==='COMBAT_ROUND'?'combat-round':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'MYSTIC',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
const view=()=>projectSliceState(s).mystic;
clear();while(s.cash<540)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
// Carry the same source drop through three real protected analyses, closing before rest.
for(let n=0;n<180;n++){
 const acts=view().actions;
 const priority=['BUY_LENSES','ACQUIRE_SAMPLE','ANALYZE_SAMPLE','CLOSE_ANALYSIS','RETURN_SAMPLE','OPEN_ANALYSIS'];
 const a=priority.map(type=>acts.find(a=>a.enabled&&a.command.type===type)).find(Boolean);
 if(a){rd(a.command);clear();if(a.command.type==='RETURN_SAMPLE')break;}
 else{assert(!view().insideCase,'ritual cannot safely exit '+JSON.stringify(acts));ordinary();}
 assert(n<179,'ritual did not finish');
}
const ritualCompleted=structuredClone(s);
for(let n=0;n<15&&s.progression.sequence===5;n++){
 let b=s.mystic.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.mystic.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.mystic.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<1600||s.week-s.starMystic.promotionWeek<12||s.health<80||s.mind<80)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===5)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,4);const promoted=structuredClone(s);
for(const caseId of ['sealed-story','bell-test','shared-eye']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<160&&s.mystic.life.cases[caseId].status!=='RESOLVED';n++){
  const preferred=['PERFORM','RETURN_ROUTE','CLOSE','REPORT','PREPARE','OBSERVE','WITHDRAW'];
  const a=preferred.map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&(!('method'in a.command)||a.command.method===(caseId==='sealed-story'?'ORDINARY':'ABILITY')))).find(Boolean);
  if(a){rd(a.command);clear();}else{assert(!view().insideCase,'locked without exit: '+JSON.stringify(view().actions));ordinary();}
 }
 assert.equal(s.mystic.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();
// One newly made S4 original uses an actual inherited workshop material and known spell.
for(let n=0;n<30&&!s.scrollProfessor.workshop.scrolls.some(x=>x.makerSequence===4);n++){
 const a=['CRAFT_SCROLL','BUY_KIT'].map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('kind'in a.command)||a.command.kind==='IMPACT'))).find(Boolean);
 if(a){rd(a.command);clear();}else ordinary();
}
const newScroll=s.scrollProfessor.workshop.scrolls.find(x=>x.makerSequence===4);
assert(newScroll,'no original S4 crafted scroll');
const authorize=view().actions.find(a=>a.enabled&&a.command.type==='AUTHORIZE_SCROLL'&&a.command.scrollId===newScroll.id);assert(authorize);rd(authorize.command);clear();
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();
rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<100;n++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':n<3?'PREPARE':'ATTACK'});
assert.equal(s.combat,null);if(s.status==='ACTIVE')clear();
if(s.status==='ACTIVE'){
 let publish=view().actions.find(a=>a.enabled&&a.command.type==='PUBLISH_STORY');
 while(!publish){ordinary();publish=view().actions.find(a=>a.enabled&&a.command.type==='PUBLISH_STORY');}
 rd(publish.command);clear();
}
const capture={creation,seed,commands,prefixCount,guidanceStart,ritualCompleted,promoted,practiced,combatStart,beforeLast,lastIntent,final:s};
writeFileSync('output/play/mystic-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/mystic-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/mystic-v01310',{recursive:true});writeFileSync('tests/fixtures/mystic-v01310/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/mystic-v01310/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,spirituality:s.spirituality,bottles:s.mystic.bottles.map(b=>b.outcome),life:s.mystic.life,encounter:s.mystic.encounter,boundaries:Object.keys(boundaries)}));
