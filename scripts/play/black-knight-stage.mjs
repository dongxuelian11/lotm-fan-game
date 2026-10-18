import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1800);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/black-knight-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='BLACK_KNIGHT'?c.command.type:null;const key=({CONSUME:s.progression.sequence===4?'promotion':'consume',PREPARE:'prepare',PERFORM:c.command?.caseId,RETURN_ROUTE:'return-route',CLOSE:'close',REPORT:'report',BUY_SHADE_KIT:'shade-kit',ENTER_SHADE_ROOM:'shade-entry',SPAWN_SHADE:'shade-spawn',CAPTURE_SHADE:'shade-capture-'+commands.filter(x=>x.type==='BLACK_KNIGHT'&&x.command.type==='CAPTURE_SHADE').length,RETURN_SHADE_ROUTE:'shade-return',HANDOFF_SHADE:'shade-handoff',SHADOW_EXIT:'shade-isolate',ENCOUNTER_FIGHT:'fight-start'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':c.type==='COMBAT_ROUND'?'combat-round':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,H:s.health,M:s.mind,S:s.spirituality,sequence:s.progression.sequence,acting:s.progression.acting}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'BLACK_KNIGHT',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
const view=()=>projectSliceState(s).blackKnight;
clear();while(s.cash<540)ordinary();const guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let n=0;n<15&&s.progression.sequence===5;n++){
 let b=s.blackKnight.bottles.find(b=>b.status==='SUPPLIER');if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.blackKnight.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.blackKnight.bottles.find(b=>b.status==='SUPPLIER');}
 for(let k=b.labourSteps;k<5;k++){rd({type:'POTION_WORK',bottleId:b.id});clear();}
 while(s.cash<1700||s.week-s.shepherd.promotionWeek<12||s.health<80||s.mind<80)ordinary();rd({type:'BUY_POTION',bottleId:b.id});clear();rd({type:'CONSUME',bottleId:b.id,confirmed:true});clear();
 if(s.progression.sequence===5)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.sequence,4);const promoted=structuredClone(s);
for(const caseId of ['shadow-boundary','blade-panel','one-spirit-account']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<160&&s.blackKnight.life.cases[caseId].status!=='RESOLVED';n++){
  const preferred=['PERFORM','RETURN_ROUTE','CLOSE','REPORT','PREPARE','OBSERVE','WITHDRAW'];
  const a=preferred.map(type=>view().actions.find(a=>a.enabled&&a.command.type===type&&(!('caseId'in a.command)||a.command.caseId===caseId)&&(!('method'in a.command)||a.command.method==='ABILITY'))).find(Boolean);
  if(a){rd(a.command);clear();}else{assert(!view().insideCase,'locked without exit: '+JSON.stringify(view().actions));ordinary();}
 }
 assert.equal(s.blackKnight.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const practiced=structuredClone(s);
// One optional independent creature, never commanded or grazed; actual room/kit consequences.
while(s.health<100||s.mind<100||s.spirituality<120||s.cash<180||s.actionsRemaining<2)ordinary();
for(const type of ['BUY_SHADE_KIT','ENTER_SHADE_ROOM','SPAWN_SHADE']){let a=view().actions.find(a=>a.enabled&&a.command.type===type);if(!a){assert(!view().insideCase);ordinary();a=view().actions.find(a=>a.enabled&&a.command.type===type);}assert(a,'missing '+type+JSON.stringify(view().actions));rd(a.command);clear();}
const shadeSpawned=structuredClone(s);
for(let n=0;n<8&&view().insideCase;n++){
 const a=['HANDOFF_SHADE','RETURN_SHADE_ROUTE','CAPTURE_SHADE','SHADOW_EXIT'].map(type=>view().actions.find(a=>a.enabled&&a.command.type===type)).find(Boolean);assert(a,'shade has no actual exit');rd(a.command);clear();
}
let handoff=view().actions.find(a=>a.enabled&&a.command.type==='HANDOFF_SHADE');if(handoff){rd(handoff.command);clear();}
assert(!view().insideCase);const shadeResolved=structuredClone(s);
while(s.health<100||s.mind<100||s.spirituality<120)ordinary();
rd({type:'ENCOUNTER_FIGHT'});const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<100;n++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':n<2?'CONTROL':'ATTACK',shepherdSpiritId:s.shepherd.grazing.activeSpiritId});
assert.equal(s.combat,null);if(s.status==='ACTIVE')clear();
const capture={creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,shadeSpawned,shadeResolved,combatStart,beforeLast,lastIntent,final:s};
writeFileSync('output/play/black-knight-stage-natural.json',JSON.stringify(capture));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/black-knight-${k}-save-boundary.json`,JSON.stringify(b));
mkdirSync('tests/fixtures/black-knight-v01320',{recursive:true});writeFileSync('tests/fixtures/black-knight-v01320/natural.json',JSON.stringify(capture));writeFileSync('tests/fixtures/black-knight-v01320/boundaries.json',JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,spirituality:s.spirituality,bottles:s.blackKnight.bottles.map(b=>b.outcome),life:s.blackKnight.life,encounter:s.blackKnight.encounter,boundaries:Object.keys(boundaries)}));
