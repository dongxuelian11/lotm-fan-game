import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {sliceDefaultCreationSelection} from '../../dist/content/slice-creation.js';
const creation={...sliceDefaultCreationSelection,displayName:'莉娜'},seed='audience-rebuild-first';
let s=createSliceRun('audience-rebuild-natural',creation,seed);
const commands=[];let beforeLast=null,lastIntent=null,conversationBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(intent.type==='AUDIENCE'&&intent.command.type==='DISCUSS'&&s.audience.social.cases[intent.command.caseId].verified&&!conversationBoundary)conversationBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,tier:s.lastCheck?.tier,acting:s.progression.acting,trust:s.audience.social.trust}));}
const aud=command=>go({type:'AUDIENCE',command});
const act=action=>go({type:'ACTION',action});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){for(let n=0;s.activeEvent&&n<20;n++){const e=projectSliceState(s).activeEvent;const wanted=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!wanted)break;pick(wanted);}}
function earn(){clear();act(s.wagePaidWeek===s.week?'REST':'WORK');clear();}
clear();go({type:'SET_LIFESTYLE',tier:'DESTITUTE'});aud({type:'DISCOVER'});while(s.cash<120)earn();aud({type:'LEARN_FORMULA'});clear();
for(let tries=0;tries<12&&!s.progression.pathwayId;tries++){
 let batch=s.audience.batches.find(b=>!b.brewed);
 if(!batch){aud({type:'REQUEST_SUPPLY'});clear();const week=s.audience.resupply.requestedWeek;while(s.week<=week)earn();aud({type:'RECEIVE_SUPPLY'});batch=s.audience.batches.find(b=>!b.brewed);}
 for(let k=0;k<2;k++){aud({type:'MATERIAL_WORK',batchId:batch.id});clear();}
 while(s.cash<120)earn();aud({type:'BUY_MATERIALS',batchId:batch.id});aud({type:'BREW',batchId:batch.id});clear();
 while(s.week<5||s.health<=0||s.mind<=0)earn();aud({type:'CONSUME',bottleId:s.audience.bottles.find(b=>b.batchId===batch.id).id,confirmed:true});
 if(!s.progression.pathwayId)while(s.seer.pollution>0||s.health<80||s.mind<80){act('REST');clear();}
}
assert.equal(s.progression.pathwayId,'audience','Finite real supply exhausted without promotion');const promoted=structuredClone(s);
for(const [caseId,approach] of [['counter-receipt','VERIFY'],['backstage-letter','ASK'],['boarding-house','VERIFY'],['night-deposition','ASK']]){
 aud({type:'OBSERVE',caseId});clear();
 if(caseId==='counter-receipt'){aud({type:'DISCUSS',caseId,approach:'ACCUSE'});clear();}
 for(let n=0;n<40&&!s.audience.social.cases[caseId].verified;n++){
  if(s.audience.social.cases[caseId].attemptWeek===s.week){earn();continue;}
  aud({type:'DISCUSS',caseId,approach});clear();
 }
 assert.equal(s.audience.social.cases[caseId].verified,true);
}
aud({type:'REFLECT'});clear();assert.equal(s.progression.acting,100);const socialFinal=structuredClone(s),socialCommandCount=commands.length;
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_OBSERVE');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')earn();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');
writeFileSync('output/play/audience-stage-natural.json',JSON.stringify({creation,seed,commands,promoted,socialFinal,combatStart,beforeLast,lastIntent,final:s}));
writeFileSync('output/play/audience-conversation-save-boundary.json',JSON.stringify(conversationBoundary));
console.log(JSON.stringify({passed:true,commands:commands.length,week:s.week,status:s.status,acting:s.progression.acting,trust:s.audience.social.trust,mastery:s.progression.mastery}));

// A separate actual branch from the same public social checkpoint keeps the peaceful route playable.
const combatOutcome=s.status;
s=structuredClone(socialFinal);commands.splice(socialCommandCount);
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_OBSERVE');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')earn();if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('REPORT');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_EVACUATE');
assert.notEqual(s.status,'ACTIVE');assert.equal(s.combatHistory.length,0);
writeFileSync('output/play/audience-stage-peaceful.json',JSON.stringify({creation,seed,commands,promoted,socialFinal,beforeLast,lastIntent,final:s}));
console.log(JSON.stringify({peaceful:true,commands:commands.length,status:s.status,ending:s.ending,combatOutcome}));
