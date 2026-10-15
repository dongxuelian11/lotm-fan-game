import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/reaper-v0960/natural.json','utf8'));
const creation=old.creation,seed=old.seed,commands=[],boundaries={};
let s=createSliceRun(old.final.runId,creation,seed),beforeLast,lastIntent,guidanceStart,promoted=null,practiced=null,combatStart=null;
mkdirSync('output/play',{recursive:true});
function go(c){assert(commands.length<1300);beforeLast=structuredClone(s);lastIntent=c;try{s=applySliceIntent(s,c);assertValidSliceState(s);}catch(e){writeFileSync('output/play/iron-blood-knight-stage-blocker.json',JSON.stringify({commands,beforeLast,lastIntent,error:String(e),stack:e.stack}));throw e;}commands.push(c);const t=c.type==='IRON_BLOOD_KNIGHT'?c.command.type:null;const key=t==='CONSUME'?(s.progression.sequence===4?'promotion':'consume'):({JOIN_COHORT:'join',TEAM_ACTIVITY:'team-activity',FULL_EXERCISE:'exercise',PREPARE_RITE:'rite',RECOVER_TEAM:'recover',START_LINK:'link',LOAD_PULSE:'load',STOP_LINK:'unlink',RETURN_TOOL:'return',FLAME_OUT:'flame',RETURN_ORDINARY:'return',CLOSE:'close',REPORT:'report',CALL_COMPANIONS:'companions'}[t])??(c.type==='COMBAT_ROUND'&&!s.combat?'combat':null);if(key&&!boundaries[key])boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};if(commands.length>old.commands.length)console.log(JSON.stringify({step:commands.length,type:t??c.type,week:s.week,health:s.health,mind:s.mind,S:s.spirituality,sequence:s.progression.sequence,gender:s.character.gender}));}
for(const c of old.commands)go(c);assert.deepEqual(s,migrateSliceState(old.final));const prefixCount=commands.length;for(const k of Object.keys(boundaries))delete boundaries[k];
const rd=command=>go({type:'IRON_BLOOD_KNIGHT',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
function view(){return projectSliceState(s).ironBloodKnight;}
function finish(){writeFileSync('output/play/iron-blood-knight-stage-natural.json',JSON.stringify({creation,seed,commands,prefixCount,guidanceStart,promoted,practiced,combatStart,beforeLast,lastIntent,final:s}));for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/iron-blood-knight-${k}-save-boundary.json`,JSON.stringify(b));console.log(JSON.stringify({passed:true,complete:!!practiced,commands:commands.length,prefixCount,week:s.week,status:s.status,sequence:s.progression.sequence,acting:s.progression.acting,health:s.health,gender:s.character.gender,originalGender:s.ironBloodKnight.originalGender,team:s.ironBloodKnight.team.members.map(m=>({id:m.id,health:m.health,energy:m.energy,experience:m.experience})),bottles:s.ironBloodKnight.bottles.map(b=>b.outcome),boundaries:Object.keys(boundaries)}));}
clear();while(s.cash<500)ordinary();guidanceStart=structuredClone(s);rd({type:'LEARN_GUIDANCE'});clear();
for(let guard=0;!view().team.qualified&&guard<400;guard++){
 if(s.cash<100||s.mind<60||s.health<80){ordinary();continue;}
 const t=s.ironBloodKnight.team;
 if(t.restRequestedWeek!==null){if(s.week<=t.restRequestedWeek){ordinary();continue;}rd({type:'RECOVER_TEAM'});clear();continue;}
 if(t.members.some(m=>m.joined&&(m.energy<10||m.health<85))){rd({type:'REST_TEAM'});continue;}
 const actions=view().actions;let a=actions.find(a=>a.enabled&&a.command.type==='JOIN_COHORT')??actions.find(a=>a.enabled&&a.command.type==='TEAM_ACTIVITY')??actions.find(a=>a.enabled&&a.command.type==='FULL_EXERCISE');
 if(a){rd(a.command);clear();}else ordinary();
}
assert(view().team.qualified,'Actual thirty-member common growth must finish');
for(let attempt=0;s.progression.sequence===5&&attempt<12;attempt++){
 let b=s.ironBloodKnight.bottles.find(b=>b.status==='PLAYER')??s.ironBloodKnight.bottles.find(b=>b.status==='SUPPLIER');
 if(!b){rd({type:'REQUEST_SUPPLY'});clear();while(s.week<=s.ironBloodKnight.resupply.requestedWeek)ordinary();rd({type:'RECEIVE_SUPPLY'});b=s.ironBloodKnight.bottles.find(b=>b.status==='SUPPLIER');}
 if(b.status==='SUPPLIER'){for(let n=b.labourSteps;n<5;n++){rd({type:'POTION_WORK',bottleId:b.id});clear();}while(s.cash<1000)ordinary();rd({type:'BUY_POTION',bottleId:b.id});}
 while(s.health<100||s.mind<100||s.spirituality<100||s.seer.pollution>0||s.week-s.reaper.promotionWeek<12)ordinary();
 if(s.ironBloodKnight.team.members.some(m=>m.health<80||m.energy<8)){rd({type:'REST_TEAM'});while(s.week<=s.ironBloodKnight.team.restRequestedWeek)ordinary();rd({type:'RECOVER_TEAM'});}
 rd({type:'PREPARE_RITE'});rd({type:'CONSUME',bottleId:b.id,confirmed:true,acceptBodyChange:true});clear();
}
if(s.progression.sequence!==4){finish();process.exit(0);}promoted=structuredClone(s);assert.equal(s.ironBloodKnight.originalGender,old.final.character.gender);assert.equal(s.character.gender,'MALE');
// The three physical practice commands are appended after their implementation freezes.
for(const caseId of ['steel-load','linked-carry','flame-clearance']){
 clear();rd({type:'OBSERVE',caseId});clear();
 for(let n=0;n<80&&s.ironBloodKnight.life.cases[caseId].status!=='RESOLVED';n++){
  const r=s.ironBloodKnight.life.cases[caseId];
  if(r.status==='OBSERVED'){
   if(r.attemptWeek===s.week||s.spirituality<8||s.mind<25||s.health<30){ordinary();continue;}
   rd({type:'PREPARE',caseId,method:'ABILITY'});clear();
  }
  if(s.ironBloodKnight.life.cases[caseId].status==='PREPARED'){
   rd({type:'PERFORM',caseId});
   if(caseId==='linked-carry'){rd({type:'START_LINK'});rd({type:'LOAD_PULSE'});rd({type:'STOP_LINK'});}
   if(caseId==='flame-clearance'){
    rd({type:'FLAME_OUT'});
    if(s.ironBloodKnight.life.practice.ownerNode==='FAR'&&s.spirituality>=3)rd({type:'FLAME_BACK'});
    if(!s.ironBloodKnight.life.cases[caseId].returned)rd({type:'RETURN_ORDINARY'});
   }else rd({type:'RETURN_TOOL'});
   if(s.ironBloodKnight.life.practice.form!=='HUMAN')rd({type:'EXIT_FORM'});
   rd({type:'CLOSE',caseId});clear();
  }
  if(s.ironBloodKnight.life.cases[caseId].status==='EXAMINED'){rd({type:'REPORT',caseId});clear();}
 }
 assert.equal(s.ironBloodKnight.life.cases[caseId].status,'RESOLVED');
}
rd({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);practiced=structuredClone(s);
while(s.health<95||s.mind<85||s.spirituality<115||s.actionsRemaining<3)ordinary();
rd({type:'ENCOUNTER_TALK'});rd({type:'CALL_COMPANIONS'});rd({type:'ENCOUNTER_FIGHT'});combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK',ironBloodPolicy:'SHARE_FIRST'});
assert.equal(s.combat,null);finish();
