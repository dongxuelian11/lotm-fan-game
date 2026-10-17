import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { createSliceRun,applySliceIntent,projectSliceState,assertValidSliceState } from '../../dist/domain/slice/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
const source='tests/fixtures/chaos-hunter-v01600/natural.json';
const old=JSON.parse(readFileSync(source,'utf8'));
const split=old.commands.findIndex(c=>c.type==='CHAOS_HUNTER'&&c.command.type==='ENCOUNTER_TALK');
assert.equal(split,474);
let replay=createSliceRun(old.final.runId,old.creation,old.seed), alivePrefix=null;
for(let i=0;i<old.commands.length;i++){
 if(i===split)alivePrefix=structuredClone(replay);
 replay=applySliceIntent(replay,old.commands[i]);assertValidSliceState(replay);
}
assert.deepEqual(replay,migrateSliceState(old.final));assert.equal(replay.status,'DEAD');
assert(alivePrefix&&alivePrefix.status==='ACTIVE'&&!alivePrefix.combat&&!alivePrefix.activeEvent);
assert.equal(alivePrefix.chaosHunter.encounter.status,'AVAILABLE');
const provenance={kind:'SAME_SEED_PUBLIC_LIVING_PRE_CONTACT_BRANCH',source,originalDeathPreserved:true,originalCommands:old.commands.length,prefixCommands:split,oldDeathRevision:old.final.revision,oldDeathRandomCursor:old.final.random.cursor,branchRandomCursor:alivePrefix.random.cursor,randomEdits:false,freeHealing:false};
let s=structuredClone(alivePrefix),commands=old.commands.slice(0,split),beforeLast=null,lastIntent=null;
const boundaries={},medical=[],root='tests/fixtures/recovery-v01620';
mkdirSync(root,{recursive:true});mkdirSync('output/play',{recursive:true});
function go(intent,key){beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);if(key)boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,intent,week:s.week,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,injuries:s.injuries.length,risk:s.injuryRisk,status:s.status}));}
function clear(){for(let i=0;s.activeEvent&&i<20;i++){const e=projectSliceState(s).activeEvent;const choiceId=e.id.startsWith('ORIGIN')?'.decline':e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':null;assert(choiceId,`Unexpected actual event ${e.id}`);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});}assert.equal(s.activeEvent,null);}
try{
 const wounds=structuredClone(s.injuries),rng=structuredClone(s.random);
 assert.equal(s.health,100);assert(wounds.some(i=>i.severity==='HEAVY'&&i.treatedRevision===null));assert.equal(s.careKnown,false);
 assert(projectSliceState(s).investigateTargets.some(t=>t.id==='CARE-ACCESS-01'));
 go({type:'ACTION',action:'INVESTIGATE',targetId:'CARE-ACCESS-01'},'actual-clinic-discovery');
 assert(s.careKnown);assert.deepEqual(s.injuries,wounds);assert.deepEqual(s.random,rng);
 go({type:'ACTION',action:'REST'},'actual-clinic-invitation');
 assert.equal(s.activeEvent?.id,'LIFE-CARE-01');assert.deepEqual(s.injuries,wounds);
 const cash=s.cash,health=s.health,actions=s.actionsRemaining;
 go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:'PAY'},'paid-original-wound-treatment');
 assert.equal(s.cash,cash-60);assert.equal(s.health,health);assert.equal(s.actionsRemaining,actions);assert.equal(s.injuries.length,wounds.length);assert(s.injuries.filter(i=>i.severity==='HEAVY').every(i=>i.treatedRevision!==null));
 const afterPaid=structuredClone(s);
 go({type:'ACTION',action:'REST'},'later-real-rest');clear();
 assert.equal(s.injuries.length,0);assert.equal(s.injuryRisk,0);assert.equal(s.status,'ACTIVE');assert.deepEqual(s.chaosHunter,alivePrefix.chaosHunter);
 const treated=structuredClone(s);
 while(s.actionsRemaining<2){go({type:'ACTION',action:'REST'});clear();}
 go({type:'CHAOS_HUNTER',command:{type:'ENCOUNTER_TALK'}},'same-original-contact-after-care');
 go({type:'CHAOS_HUNTER',command:{type:'ENCOUNTER_FIGHT'}},'same-original-battle-after-care');
 const combatStart=structuredClone(s);assert.equal(s.combat.encounterId,'CHAOS_HUNTER_DISPUTE');assert.equal(s.chaosHunter.encounter.targetId,alivePrefix.chaosHunter.encounter.targetId);
 assert.deepEqual(projectSliceState(s).combat.consequenceWeights,{light:65,heavy:30,death:5});
 for(let i=0;s.combat&&i<100;i++)go({type:'COMBAT_ROUND',stance:s.health<=40?'RETREAT':i<2?'CONTROL':'ATTACK'},i===0?'first-actual-treated-round':null);
 assert.equal(s.combat,null);assert(s.chaosHunter.encounter.terminal);boundaries['actual-terminal']={beforeLast,lastIntent,final:structuredClone(s)};
 const final=structuredClone(s),data={provenance,creation:old.creation,seed:old.seed,initial:alivePrefix,commands,afterPaid,treated,combatStart,beforeLast,lastIntent,final};
 writeFileSync(`${root}/natural.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/recovery-stage-natural.json',JSON.stringify(data));
 for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/recovery-${k}-save-boundary.json`,JSON.stringify(b));
 console.log(JSON.stringify({passed:true,provenance,commands:commands.length,paid:60,treatedWeek:treated.week,battleWeek:combatStart.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,risk:s.injuryRisk,injuries:s.injuries,encounter:s.chaosHunter.encounter,boundaries:Object.keys(boundaries)}));
}catch(error){writeFileSync('output/play/recovery-stage-blocker.json',JSON.stringify({provenance,commands,alivePrefix,beforeLast,lastIntent,final:s,boundaries,error:String(error),stack:error.stack}));throw error;}
