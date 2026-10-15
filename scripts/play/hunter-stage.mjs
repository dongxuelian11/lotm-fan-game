import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {sliceDefaultCreationSelection} from '../../dist/content/slice-creation.js';
const creation={...sliceDefaultCreationSelection,displayName:'罗温'},seed='hunter-rebuild-first';
let s=createSliceRun('hunter-rebuild-natural',creation,seed),beforeLast=null,lastIntent=null,trapBoundary=null;
const commands=[];
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(s.hunter.trapSpent>beforeLast.hunter.trapSpent&&!trapBoundary)trapBoundary={before:structuredClone(beforeLast),intent,after:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:intent.command?.type??intent.type,choice:intent.choiceId,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,mind:s.mind,check:s.lastCheck?.tier,acting:s.progression.acting,trap:s.hunter.trapSpent}));}
const hunter=command=>go({type:'HUNTER',command});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
function clear(){let k=0;while(s.activeEvent&&k++<20){const e=projectSliceState(s).activeEvent;const id=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!id)break;pick(id);}}
function ordinary(){clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();}
clear();go({type:'SET_LIFESTYLE',tier:'DESTITUTE'});hunter({type:'DISCOVER'});while(s.cash<120)ordinary();hunter({type:'LEARN_GUIDANCE'});clear();
for(const id of s.hunter.bottles.map(x=>x.id)){
 if(s.progression.pathwayId)break;
 for(let i=0;i<2;i++){hunter({type:'POTION_WORK',bottleId:id});clear();}
 while(s.cash<60||s.week<5||s.mind<=0||s.health<=0)ordinary();
 hunter({type:'BUY_POTION',bottleId:id});hunter({type:'CONSUME',bottleId:id,confirmed:true});
 if(!s.progression.pathwayId)while(s.seer.pollution>0||s.health<80||s.mind<80){go({type:'ACTION',action:'REST'});clear();}
}
assert.equal(s.progression.pathwayId,'hunter','Finite real bottles exhausted; retain actual seed/outcome');
const promoted=structuredClone(s);while(s.cash<12)ordinary();hunter({type:'BUY_TRAP_KIT'});clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_TRACK');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')ordinary();
if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_TRAP_PURSUIT');const firstCombatStart=structuredClone(s);
for(let i=0;s.combat&&s.status==='ACTIVE'&&i<60;i++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.status,'SLICE_COMPLETE','First-case actual terminal prevents living continuation');const firstCase=structuredClone(s);go({type:'CONTINUE_LIFE'});clear();
while(s.cash<12||s.health<80||s.mind<70)ordinary();hunter({type:'BUY_TRAP_KIT'});
for(const practiceId of ['muddy-cart','missing-hound','shifted-crate','rolling-barrel','blind-corner','rope-inspection']){
 for(let attempt=0;attempt<40&&!s.hunter.observations.includes(practiceId);attempt++){
  clear();if(s.hunter.practiceAttempts[practiceId]===s.week||s.health<60||s.mind<40){ordinary();continue;}
  hunter({type:'PRACTICE',practiceId});clear();
 }
 assert(s.hunter.observations.includes(practiceId),'Actual practice did not complete: '+practiceId);
}
if(s.hunter.trapDeployed===0)hunter({type:'SET_TRAP',location:'HUNTER_CARGO'});clear();
hunter({type:'CARGO_FIGHT'});const cargoStart=structuredClone(s);
for(let i=0;s.combat&&s.status==='ACTIVE'&&i<60;i++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);assert.notEqual(s.hunter.cargo.status,'FIGHTING');
writeFileSync('output/play/hunter-stage-natural.json',JSON.stringify({creation,seed,commands,promoted,firstCombatStart,firstCase,cargoStart,trapBoundary,beforeLast,lastIntent,final:s}));
if(trapBoundary)writeFileSync('output/play/hunter-trap-save-boundary.json',JSON.stringify({...trapBoundary,beforeLast:trapBoundary.before,lastIntent:trapBoundary.intent,final:trapBoundary.after}));
console.log(JSON.stringify({passed:true,commands:commands.length,week:s.week,status:s.status,hunter:s.hunter,acting:s.progression.acting,mastery:s.progression.mastery,trapBoundary:!!trapBoundary}));
