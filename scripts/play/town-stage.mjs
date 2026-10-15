import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const old=JSON.parse(readFileSync('tests/fixtures/mindreader-v090/natural.json','utf8'));
let s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of old.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}assert.deepEqual(s,migrateSliceState(old.final));
const stageCommands=[];let beforeLast=null,lastIntent=null,equipBoundary=null;
function go(intent){beforeLast=structuredClone(s);lastIntent=intent;s=applySliceIntent(s,intent);assertValidSliceState(s);stageCommands.push(intent);if(intent.type==='TOWN'&&intent.command.type==='EQUIP_CLUB')equipBoundary={beforeLast:structuredClone(beforeLast),lastIntent:intent,final:structuredClone(s)};console.log(JSON.stringify({step:stageCommands.length,type:intent.command?.type??intent.type,week:s.week,ap:s.actionsRemaining,cash:s.cash,health:s.health,club:s.town.clubLocation,held:s.town.bandagesHeld,used:s.town.bandagesUsed}));}
const town=command=>go({type:'TOWN',command});
function clear(){while(s.activeEvent){const e=projectSliceState(s).activeEvent;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;assert(id,'Unexpected event '+e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}}
go({type:'CONTINUE_LIFE'});clear();town({type:'VISIT_SHOP'});clear();town({type:'BUY_CLUB'});town({type:'EQUIP_CLUB'});town({type:'UNEQUIP_CLUB'});town({type:'SELL_CLUB'});town({type:'BUY_CLUB'});town({type:'EQUIP_CLUB'});town({type:'BUY_BANDAGE'});
const oldInjuries=structuredClone(s.injuries),healthBefore=s.health;town({type:'USE_BANDAGE'});clear();assert.equal(s.health,Math.min(100,healthBefore+8));assert.deepEqual(s.injuries,oldInjuries);assert.equal(s.town.bandagesUsed,1);assert.equal(s.town.clubLocation,'HAND');
writeFileSync('output/play/town-stage-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...old.commands,...stageCommands],stageCommands,beforeLast,lastIntent,final:s}));
writeFileSync('output/play/town-equipment-save-boundary.json',JSON.stringify(equipBoundary));
console.log(JSON.stringify({passed:true,commands:old.commands.length+stageCommands.length,stageCommands:stageCommands.length,week:s.week,health:s.health,injuries:s.injuries,town:s.town}));
// An independent public branch buys and holds this original before entering the existing encounter.
const prefix=old.commands.slice(0,old.commands.findIndex(i=>i.type==='MINDREADER'&&i.command.type==='REFLECT')+1);
s=createSliceRun(old.final.runId,old.creation,old.seed);for(const i of prefix){s=applySliceIntent(s,i);assertValidSliceState(s);}stageCommands.splice(0);clear();town({type:'VISIT_SHOP'});clear();town({type:'BUY_CLUB'});town({type:'EQUIP_CLUB'});
const pick=choiceId=>go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});
go({type:'ACTION',action:'INVESTIGATE',targetId:'LIFE-LEAD-NIGHTSHIFT'});pick('A_OBSERVE');
while(!s.activeEvent&&s.arc.stage==='WAIT_B')go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});
if(s.activeEvent?.id==='ARC-B')pick('B_SHARE');if(s.activeEvent?.id==='ARC-REPORT')pick('SKIP');clear();
go({type:'ACTION',action:'INVESTIGATE',targetId:'ARC-C'});pick('C_PURSUIT');const combatStart=structuredClone(s);
for(let n=0;s.combat&&n<60;n++)go({type:'COMBAT_ROUND',stance:'ATTACK'});
assert.equal(s.combat,null);assert.notEqual(s.status,'ACTIVE');assert.equal(s.town.clubLocation,'HAND');assert(s.combatHistory.some(r=>r.moves.some(m=>m.actor==='PLAYER'&&m.label.includes('原短棍'))));
writeFileSync('output/play/town-equipped-battle-natural.json',JSON.stringify({creation:old.creation,seed:old.seed,commands:[...prefix,...stageCommands],combatStart,beforeLast,lastIntent,final:s}));
console.log(JSON.stringify({equippedBattle:true,commands:prefix.length+stageCommands.length,status:s.status,rounds:s.combatHistory.length,club:s.town.clubLocation}));
