import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateSlicePayload } from '../../dist/domain/slice/validation.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
import { validateUncleanMonarchSource } from '../../dist/domain/unclean-monarch/index.js';
import { getUncleanMonarchCurrentSite, uncleanMonarchLifeMasteryGains } from '../../dist/domain/unclean-monarch/life.js';

// Freeze mechanics and these exact producer bytes before the one natural run.
// Replay the original first718 public commands; boundary.beforeLast is living.
// The complete724 death and older592 death remain independent immutable evidence.
// No seed/cursor changes, outcome reloads, retries, invented energy or supplies.
const source='tests/fixtures/blood-duke-v01800/natural.json';
const SOURCE_HASH='7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363';
const sourceBoundary='tests/fixtures/blood-duke-v01800/boundary-real-combat-preparation.json';
const SOURCE_BOUNDARY_HASH='c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c';
const PREFIX_HASH='6f57b3aafe3469b3293ee5c2e6b700b834cebab7f091faa1468a096ec3291da7';
const preservedFiles=[source,'tests/fixtures/blatherer-v01560/natural.json'];
const PRESERVED_HASHES=[SOURCE_HASH,'796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b'];
const preserved=preservedFiles.map((file,i)=>{assert.equal(fileDigest(file),PRESERVED_HASHES[i]);return{file,sha256:PRESERVED_HASHES[i],commands:readObjectEntry(file,'commands').length,status:readObjectEntry(file,'final').status};});
const old=Object.fromEntries(['provenance','creation','seed','initial','commands','prefixCount','final'].map(k=>[k,readObjectEntry(source,k)]));
const rawSource=readObjectEntry(sourceBoundary,'beforeLast');
const prefixCount=718, CASES=['measured-reading','observed-tension','withdrawn-input'];
const ROOTS=['criminal','unwinged','serialKiller','demon','desireApostle','devil','blatherer','bloodDuke'];
const NEW_IDS=['abyss.s1.impulse-binding','abyss.s1.focused-interference'];
const strategy=deepFreeze({source:'EXACT718_LIVING_BLOOD_DUKE_BOUNDARY_BEFORE_LAST',sourceSeed:'criminal-natural-v054',sourceCursor:112,
  caseMethod:'ABILITY',caseRoute:'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy:'ALL',combatStance:'CONTROL',combatRoundCap:90,potionAttemptCap:12,maxCommands:3500,ordinaryPreparationCap:600,
  sourceInjuryRecovery:'NONE_HEALTHY_ORIGINAL718',ordinaryActions:'WORK_ONCE_PER_WEEK_THEN_REST',
  recovery:{health:100,mind:100,spirituality:120,pollution:0},caseReadiness:{ap:3,cash:20,mind:4,spirituality:8},
  encounterReadiness:{ap:2,cash:30},afterCases:'NO_OPTIONAL_MAXIMUM_RECOVERY_ONE_PUBLIC_WORK_AFTER_LIVING_EXIT',
  eventChoices:{ORIGIN:'.decline','LIFE-BILL-01':'PAY_PART','DEBT-NOTICE-01':'DECLINE','DEBT-SETTLE-01':'DEFER','LIFE-CARE-01':'PAY','CARE-WORK-OFFER':'DECLINE'}});
assert.equal(process.argv.length,2,'Run once without seed, cursor or outcome options');
assert.equal(fileDigest(source),SOURCE_HASH);assert.equal(fileDigest(sourceBoundary),SOURCE_BOUNDARY_HASH);
assert.equal(old.commands.length,724);assert.equal(old.final.status,'DEAD');assert.equal(old.final.health,0);
assert.equal(compactDigest(old.commands.slice(0,prefixCount)),PREFIX_HASH);assert.equal(old.prefixCount,583);
assert.equal(old.provenance.kind,'SAME_SEED_PUBLIC_LIVING_FORK_BEFORE_OPTIONAL_COMBAT');assert.equal(old.initial.progression.sequence,null);
assert.equal(old.seed,strategy.sourceSeed);assert.equal(rawSource.schemaVersion,177);assert.equal(rawSource.contentVersion,'blood-duke-v177');
assert.equal(rawSource.status,'ACTIVE');assert.equal(rawSource.revision,719);
assert.deepEqual(preserved.map(x=>[x.commands,x.status]),[[724,'DEAD'],[592,'DEAD']]);
const producerHash=fileDigest(fileURLToPath(import.meta.url));
mkdirSync('output/play',{recursive:true});const outputDir=mkdtempSync('output/play/unclean-monarch-02020-');
const commands=[],boundaries={},boundarySteps={},snapshots={},uniqueTransitions=[],treatments=[];
const capturedSteps=new Map(),snapshotSteps=new Map();
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const append=(name,value)=>appendFileSync(`${outputDir}/${name}`,`${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`,'',{flag:'wx'});writeFileSync(`${outputDir}/public.jsonl`,'',{flag:'wx'});
let s=migrateSliceState(old.initial),initial=structuredClone(s),original=null,beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false,saved=false,failurePhase='INITIALIZATION';
const view=()=>projectSliceState(s).uncleanMonarch,life=()=>s.uncleanMonarch.life,site=()=>s.uncleanMonarch.promotionWeek===null?s.blatherer.life:getUncleanMonarchCurrentSite(s);
const body=x=>({status:x.status,revision:x.revision,week:x.week,date:x.date,H:x.health,M:x.mind,S:x.spirituality,cash:x.cash,AP:x.actionsRemaining,
  pollution:x.seer.pollution,injuries:x.injuries,injuryRisk:x.injuryRisk,random:x.random,mastery:x.progression.mastery,sequence:x.progression.sequence,acting:x.progression.acting,
  finance:{weeklyBudget:x.weeklyBudget,wagePaidWeek:x.wagePaidWeek,lifeTier:x.lifeTier,nextLifeTier:x.nextLifeTier,debts:x.debts,missedWeeks:x.missedWeeks,credit:x.credit,pulse:x.pulse,billAmount:x.billAmount}});
const sourceOriginals=x=>({site:x.blatherer.life,operation:x.bloodDuke.life.operation,strain:x.demon.strain});
const currentOriginals=()=>({site:site(),operation:s.uncleanMonarch.promotionWeek===null?s.bloodDuke.life.operation:life().operation,
  strain:s.uncleanMonarch.encounter.strain??s.demon.strain});
const abilityUse=()=>Object.fromEntries(NEW_IDS.map((id,i)=>{const attempts=CASES.filter(c=>i===1?c==='observed-tension':c!=='observed-tension').flatMap(c=>life().cases[c].attempts);return[id,{
  attempts:attempts.filter(a=>a.castTier!==null).length,checkSuccesses:attempts.filter(a=>['SUCCESS','GREAT_SUCCESS'].includes(a.castTier)).length,
  actualApplications:attempts.filter(a=>a.appliedAbilityIds.includes(id)).length,
  reportedApplications:CASES.filter(c=>life().cases[c].status==='RESOLVED').flatMap(c=>life().cases[c].attempts).filter(a=>a.appliedAbilityIds.includes(id)).length}];}));
function combatAbilityUse(rounds) {
 const actions=rounds.flatMap(r=>r.uncleanMonarchOutcome.playerActions);
 return Object.fromEntries(NEW_IDS.map(id=>{const selected=actions.filter(a=>a.id===id);return[id,{
  selectedSlots:selected.length,paidAttempts:selected.filter(a=>a.attempted).length,
  castingSuccesses:selected.filter(a=>a.succeeded).length,preparedWindows:selected.filter(a=>a.chargeGranted).length,
  actualApplications:selected.filter(a=>a.applied&&a.appliedAmount>0).length,
  masteryApplications:selected.filter(a=>a.masteryApplied.includes(id)).length,
  spiritualitySpent:selected.reduce((n,a)=>n+a.paidCost,0),mindSpent:selected.reduce((n,a)=>n+a.mindCost,0)
 }];}));
}
class ActualTerminalStop extends Error{};class FiniteEncounterStop extends Error{};
function preserve(){
 assert.equal(fileDigest(source),SOURCE_HASH);assert.equal(fileDigest(sourceBoundary),SOURCE_BOUNDARY_HASH);for(const f of preserved)assert.equal(fileDigest(f.file),f.sha256);
}
function originals(){
 assert(original);for(const key of ROOTS)assert.deepEqual(s[key],original[key],`Immutable original ${key} history`);
 assert.deepEqual(s.combatHistory.slice(0,original.combatHistory.length),original.combatHistory);
 if(s.uncleanMonarch.guidanceKnown)assert(validateUncleanMonarchSource(s));
 const oldSite=original.blatherer.life,now=currentOriginals();
 assert.equal(Object.hasOwn(site().volunteer,'energy'),false,'No invented original Nora energy');
 assert.equal(Object.hasOwn(site(),'playerEnergy'),false);assert.equal(site().siteId,oldSite.siteId);
 for(const key of ['id','owner','quantity'])assert.deepEqual(site().card[key],oldSite.card[key]);
 for(const key of ['id','name','age','alive','willing'])assert.deepEqual(site().volunteer[key],oldSite.volunteer[key]);
 assert.deepEqual(site().guide,oldSite.guide);assert.deepEqual(site().bell,oldSite.bell);assert.deepEqual(site().note,oldSite.note);
 assert(now.strain>=0&&now.strain<=3);assert.equal(now.operation.door,'OPEN');assert(now.operation.bellRehearsals>=original.bloodDuke.life.operation.bellRehearsals);
 assert.equal(life().volunteerEffortSpent,CASES.flatMap(c=>life().cases[c].attempts).reduce((n,a)=>n+a.volunteerEffortSpent,0));
 assert(life().volunteerEffortSpent<=12);
 const expected=structuredClone(original.progression.mastery);
 if(s.progression.sequence===1){for(const id of NEW_IDS)expected[id]=0;for(const [id,n]of Object.entries(uncleanMonarchLifeMasteryGains(s)))expected[id]+=n;}
 for(const round of s.combatHistory.slice(original.combatHistory.length)){
  assert(round.uncleanMonarchOutcome);for(const a of [...round.uncleanMonarchOutcome.playerActions,...round.uncleanMonarchOutcome.enemyActions])for(const id of a.masteryApplied){assert(Object.hasOwn(expected,id));expected[id]=Math.min(500,expected[id]+8);}
 }
 assert.deepEqual(s.progression.mastery,expected);assert.equal(s.random.seed,old.seed);assert.equal(s.runId,original.runId);
 const {coreStats:stats,...identity}=s.character,{coreStats:prior,...priorIdentity}=original.character;assert.deepEqual(identity,priorIdentity);
 for(const [id,n]of Object.entries(prior))assert.equal(stats[id],Math.min(500,n+(s.progression.sequence===1?1:0)));
}
function capture(key){
 if(!prefixVerified)return;let name=key,n=2;while(boundaries[name])name=`${key}-${n++}`;
 let file=capturedSteps.get(commands.length);if(!file){file=`boundary-${name}.json`;write(file,{commandCount:commands.length,beforeLast,lastIntent,final:s});capturedSteps.set(commands.length,file);uniqueTransitions.push({key:name,file,commandIndex:commands.length,beforeRevision:beforeLast.revision,afterRevision:s.revision});}
 boundaries[name]=file;boundarySteps[name]=commands.length;
}
function snapshot(name){assert(!snapshots[name]);let file=snapshotSteps.get(commands.length);if(!file){file=`snapshot-${name}.json`;write(file,s);snapshotSteps.set(commands.length,file);}snapshots[name]=file;}
function compact(){return {...body(s),activeEvent:s.activeEvent?.instanceId??null,site:site(),life:{activeCase:life().activeCase,pending:life().pending,clockSeconds:site().clockSeconds},encounter:{status:s.uncleanMonarch.encounter.status,currentSite:s.uncleanMonarch.encounter.currentSite,terminal:s.uncleanMonarch.encounter.terminal}};}
function publicControl(intent){
 if(!prefixVerified)return{kind:'IMMUTABLE718_SOURCE_PREFIX',enabled:true};const p=projectSliceState(s);
 if(intent.type==='UNCLEAN_MONARCH'){const a=p.uncleanMonarch.actions.find(x=>isDeepStrictEqual(x.command,intent.command));assert(a,`No public control ${JSON.stringify(intent.command)}`);assert(a.enabled,a.reason);return structuredClone(a);}
 if(intent.type==='ACTION'){assert(p.canAct,p.actionBlockedReason);assert(['WORK','REST'].includes(intent.action));assert(!view().insideCase&&!s.combat&&s.uncleanMonarch.preparedWeek===null);return{kind:'ACTION',action:intent.action,enabled:true};}
 if(intent.type==='EVENT_CHOICE'){assert(p.activeEvent&&s.activeEvent.instanceId===intent.eventInstanceId);const c=p.activeEvent.choices.find(c=>c.id===intent.choiceId);assert(c?.enabled);return structuredClone(c);}
 assert.equal(intent.type,'COMBAT_ROUND');assert(p.combat&&p.combat.stances.some(x=>x.id===intent.stance));assert.equal(intent.stance,strategy.combatStance);return{kind:'COMBAT_ROUND',stance:intent.stance,round:s.combat.round};
}
function go(intent,key=null){
 pendingIntent=structuredClone(intent);failurePhase='PUBLIC_PREFLIGHT';assert(commands.length<strategy.maxCommands);assert(validateSlicePayload(intent));
 const control=publicControl(intent),prior=s,beforePublic=prefixVerified?compact():null;beforeLast=s;lastIntent=structuredClone(intent);failurePhase='APPLY';
 s=applySliceIntent(s,intent);commands.push(structuredClone(intent));pendingIntent=null;failurePhase='AFTER_APPLY_VALIDATION';
 append('commands.jsonl',{step:commands.length,intent,sourcePrefix:commands.length<=prefixCount,before:body(prior),after:body(s)});
 if(prefixVerified)append('public.jsonl',{step:commands.length,revision:prior.revision,command:intent,control,randomBefore:prior.random,randomAfter:s.random,before:beforePublic,after:compact()});
 assertValidSliceState(s);assert.equal(s.revision,prior.revision+1);assert.equal(s.random.seed,old.seed);assert(s.random.cursor>=prior.random.cursor);
 if(prefixVerified){originals();capture(key??`step-${commands.length}-${intent.type==='UNCLEAN_MONARCH'?intent.command.type.toLowerCase():intent.type.toLowerCase()}`);}
 failurePhase='IDLE';if(prefixVerified&&s.status!=='ACTIVE')throw new ActualTerminalStop(`Actual ${s.status}`);
}
const dh=(command,key=null)=>go({type:'UNCLEAN_MONARCH',command},key);
function clear(){for(let n=0;s.activeEvent&&n<20;n++){const e=projectSliceState(s).activeEvent,choiceId=strategy.eventChoices[e.id.startsWith('ORIGIN')?'ORIGIN':e.id];assert(choiceId,`Unplanned event ${e.id}`);const prior=e.id==='LIFE-CARE-01'?structuredClone(body(s)):null;go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});if(prior)treatments.push({paidPennies:60,before:prior,after:structuredClone(body(s))});}assert.equal(s.activeEvent,null);assert.equal(s.pulse,'NONE');}
function ordinary(forceRest=false,key=null){clear();assert(!view().insideCase&&!s.combat);go({type:'ACTION',action:forceRest||s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();assert(!view().insideCase&&!s.combat&&s.uncleanMonarch.preparedWeek===null);for(let n=0;s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek;n++){assert(n<strategy.ordinaryPreparationCap);ordinary();}}
function action(command,key=null){ready();dh(command,key);clear();}
function practice(caseId){
 ready(strategy.caseReadiness);
 const start=structuredClone(site());dh({type:'OBSERVE',caseId},`${caseId}-observe-originals`);
 for(let n=0;life().cases[caseId].status!=='EXAMINED';n++){
  assert(n<60,'Finite case action budget');const a=view().life.actions.find(a=>a.preferredAction&&a.enabled);assert(a,'Current case requires an actual enabled public next step');dh(a.command,`${caseId}-${a.command.type.toLowerCase()}`);
 }
 clear();assert.equal(life().cases[caseId].status,'EXAMINED');assert.equal(life().cases[caseId].attempts.length,1);
 assert.equal(site().playerLocation,'START');assert.equal(site().volunteer.location,'A');
 assert(site().playerTravelMetres>start.playerTravelMetres);assert.equal(site().card.location,'NORA');
 const attempt=life().cases[caseId].attempts[0];assert(attempt.closed&&attempt.returned&&attempt.cardReturned&&attempt.verified);
 if(caseId==='withdrawn-input'){assert.equal(attempt.withdrawn,true);assert.equal(attempt.appliedAbilityIds.length,0);}
 action({type:'REPORT',caseId},`${caseId}-honest-report`);assert.equal(life().cases[caseId].status,'RESOLVED');
}
function consume(bottleId){const before=structuredClone(body(s)),originalsBefore=structuredClone(currentOriginals());dh({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);const b=s.uncleanMonarch.bottles.find(b=>b.id===bottleId);assert.equal(b.status,'CONSUMED');assert.equal(s.random.cursor,before.random.cursor+1);assert.deepEqual(currentOriginals(),originalsBefore);assert.equal(s.uncleanMonarch.preparedWeek,null);capture(s.progression.sequence===1?'promotion':'actual-potion-failure');clear();}
function encounter(){
 ready(strategy.encounterReadiness);snapshot('actualBeforeEncounter');
 assert.equal(site().volunteer.location,'A');assert.equal(s.uncleanMonarch.encounter.status,'AVAILABLE');
 dh({type:'PREPARE_ENCOUNTER'},'paid-independent-combat-piece');dh({type:'ENCOUNTER_TALK'},'actual-independent-harlan-contact');
 if(s.uncleanMonarch.encounter.policy!==strategy.encounterPolicy)dh({type:'SET_COMBAT_POLICY',policy:strategy.encounterPolicy},'fixed-all-policy');assert.equal(s.uncleanMonarch.encounter.policy,strategy.encounterPolicy);dh({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
 while(s.combat&&s.combat.round<=strategy.combatRoundCap)go({type:'COMBAT_ROUND',stance:strategy.combatStance},`combat-round-${s.combat.round}`);
 if(s.combat)throw new FiniteEncounterStop('Declared90-round limit retains the actual unresolved encounter');
 assert(s.uncleanMonarch.encounter.terminal);assert.equal(s.uncleanMonarch.encounter.currentSite.playerLocation,'START');snapshot('combatTerminal');capture('actual-ordinary-encounter-exit');
}
function save(stage,error=null){
 assert(!saved);saved=true;preserve();const e=s.uncleanMonarch.encounter,rounds=s.combatHistory.slice(original?.combatHistory.length??s.combatHistory.length);
 write('natural.json',{provenance:{kind:'EXACT718_PUBLIC_BLOOD_DUKE_THEN_PUBLIC_UNCLEAN_MONARCH',prior:old.provenance,source,sourceSha256:SOURCE_HASH,sourceRoot:'beforeLast',sourceBoundary,sourceBoundarySha256:SOURCE_BOUNDARY_HASH,inheritedDirectedPrefix:false,fullNaturalS9ToS1:s.progression.sequence===1,newRandomChanges:false,preserved},
  continuation:{kind:'EXACT718_LIVING_PREFIX_THEN_PUBLIC_UNCLEAN_MONARCH',sourceFixture:source,sourceRoot:'beforeLast',sourceBoundary,sourceBoundarySha256:SOURCE_BOUNDARY_HASH,sourceS2Setup:'NATURAL_LIVING_PREFIX_OF_PRESERVED_DEATH',newRandomChanges:false},producerSha256:producerHash,strategy,creation:old.creation,seed:old.seed,prefixCount,inheritedPrefixCount:583,prefixVerified,commands,initial,prefixFinal:original,beforeLast,lastIntent,pendingIntent,failurePhase,snapshots,treatments,stage,error:error?String(error.stack??error):null,final:s});
 write('boundaries.index.json',boundaries);write('boundaries.steps.json',boundarySteps);write('transitions.json',uniqueTransitions);
 write('summary.json',{stage,producerSha256:producerHash,strategy,source:{prefixCount,prefixVerified,sourceSha256:SOURCE_HASH,sourceBoundary,sourceBoundarySha256:SOURCE_BOUNDARY_HASH,prefixCompactSha256:PREFIX_HASH,migratedWholeSourceSha256:original?digest(original):null,preserved},commands:commands.length,final:body(s),originalMastery:original?.progression.mastery,mastery:s.progression.mastery,
  lifeCases:life().cases,lifeAbilityUse:abilityUse(),combatAbilityUse:combatAbilityUse(rounds),
  sourceOriginals:original?sourceOriginals(original):null,currentOriginals:currentOriginals(),life:life(),encounter:e,rounds,bottles:s.uncleanMonarch.bottles,treatments,boundaries:Object.keys(boundaries),uniqueTransitions:uniqueTransitions.length,snapshots});
 write('capture-integrity.json',{producerSha256:producerHash,naturalSha256:fileDigest(`${outputDir}/natural.json`),commandsSha256:fileDigest(`${outputDir}/commands.jsonl`),publicSha256:fileDigest(`${outputDir}/public.jsonl`),sourcePrefixSha256:prefixVerified?fileDigest(`${outputDir}/source-prefix.json`):null,boundaryIndexSha256:fileDigest(`${outputDir}/boundaries.index.json`),boundaryStepsSha256:fileDigest(`${outputDir}/boundaries.steps.json`),transitionsSha256:fileDigest(`${outputDir}/transitions.json`),summarySha256:fileDigest(`${outputDir}/summary.json`),files:Object.fromEntries([...new Set([...Object.values(boundaries),...Object.values(snapshots)])].map(n=>[n,fileDigest(`${outputDir}/${n}`)]))});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,prefixCount,prefixVerified,status:s.status,sequence:s.progression.sequence,week:s.week,producerSha256:producerHash}));
}
try{
 assertValidSliceState(s);for(const intent of old.commands.slice(0,prefixCount))go(intent);
 assert.deepEqual(s,migrateSliceState(rawSource));assert.deepEqual(commands,old.commands.slice(0,prefixCount));
 assert.equal(s.revision,719);assert.equal(s.week,181);assert.equal(s.random.cursor,112);assert.equal(s.health,100);assert.equal(s.mind,100);assert.equal(s.spirituality,120);assert.equal(s.cash,710);assert.equal(s.actionsRemaining,3);
 assert.deepEqual(s.injuries,[]);assert.equal(s.injuryRisk,0);assert.equal(s.bloodDuke.promotionWeek,172);
 assert.equal(s.blatherer.life.playerLocation,'START');assert.equal(s.blatherer.life.volunteer.location,'A');
 assert.equal(s.blatherer.life.playerTravelMetres,96);assert.equal(s.blatherer.life.clockSeconds,317);assert.equal(s.blatherer.life.card.travelMetres,40);
 assert.equal(s.demon.strain,3);assert.equal(s.unwinged.conscienceLost,true);
 original=structuredClone(s);prefixVerified=true;write('source-prefix.json',{source,sourceSha256:SOURCE_HASH,sourceBoundary,sourceBoundarySha256:SOURCE_BOUNDARY_HASH,sourceRoot:'beforeLast',prefixCount,rawInitial:old.initial,rawFinal:rawSource,commands:old.commands.slice(0,prefixCount),rawCommandsSha256:PREFIX_HASH,migratedWholeStateSha256:digest(original),preserved,inheritedDirectedPrefix:false});snapshot('departure');capture('exact-original718-living-source');
 assert.equal(treatments.length,0);snapshot('sourceHealthy');
 ready({ap:1,cash:500,...strategy.recovery});dh({type:'LEARN_GUIDANCE'},'paid500-guidance-freezes-eight-roots');clear();snapshot('guidance');
 for(const taskId of ['VERIFY_ORIGINALS','CHECK_LIMITS','CHECK_RETURN'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 for(let number=0;s.progression.sequence===2&&number<strategy.potionAttemptCap;number++){
  let b=s.uncleanMonarch.bottles.find(x=>x.status==='PLAYER')??s.uncleanMonarch.bottles.find(x=>x.status==='SUPPLIER');
  if(!b){ready({ap:1,cash:100});dh({type:'REQUEST_SUPPLY'},'paid-next-week-resupply');const week=s.uncleanMonarch.resupply.requestedWeek;clear();ready({afterWeek:week});dh({type:'RECEIVE_SUPPLY'},'actual-next-week-new-stock');b=s.uncleanMonarch.bottles.find(x=>x.status==='SUPPLIER');}
  assert(b);const id=b.id;if(b.status==='SUPPLIER'){while(s.uncleanMonarch.bottles.find(x=>x.id===id).labourSteps<5)action({type:'POTION_WORK',bottleId:id},`${id}-real-labour`);ready({cash:1400});dh({type:'BUY_POTION',bottleId:id},`actual1200p-buy-${id}`);}
  ready({ap:1,cash:180,...strategy.recovery,afterWeek:s.bloodDuke.promotionWeek+11});dh({type:'PREPARE_PROMOTION'},`actual180p-current-week-prepare-${id}`);consume(id);
 }
 if(s.progression.sequence!==1)save('SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2');else{
  assert.equal(s.uncleanMonarch.bloodDukeActingAtPromotion,100);for(const id of NEW_IDS)assert.equal(s.progression.mastery[id],0);snapshot('promoted');
  for(const id of CASES)practice(id);action({type:'REFLECT'},'three-actual-honest-reports-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  encounter();clear();if(s.wagePaidWeek===s.week)ready({afterWeek:s.week});ready();go({type:'ACTION',action:'WORK'},'actual-work-after-living-exit');clear();originals();save('NATURAL718_PREFIX_PUBLIC_UNCLEAN_MONARCH_CONTINUATION');
 }
}catch(error){if(saved)throw error;if(error instanceof ActualTerminalStop){snapshot('actualTerminal');save('ACTUAL_TERMINAL_WITH_NATURAL718_HISTORY');}else if(error instanceof FiniteEncounterStop)save('ACTUAL_FINITE_ENCOUNTER_UNRESOLVED',error);else{save('ACTUAL_BLOCKER',error);throw error;}}

function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
function compactDigest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); } return hash.digest('hex');
}
// Read just one top-level entry without retaining unrelated large historical
// snapshots; StringDecoder preserves UTF-8 when a character crosses a chunk.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', key = '', selected = false, quoted = false, escaped = false, depth = 0, kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null), text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false; else if (c === '\\') escaped = true;
          else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; }
          continue;
        }
        if (phase === 'COLON') { if (/\s/.test(c)) continue; if (c !== ':') throw new Error('Expected JSON colon'); phase = 'VALUE_START'; continue; }
        if (phase === 'VALUE_START') {
          if (/\s/.test(c)) continue;
          if (selected) captureStart = i;
          depth = 0; quoted = false; escaped = false;
          kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE';
        }
        if (phase === 'VALUE') {
          let done = false, end = i + 1;
          if (quoted) {
            if (escaped) escaped = false; else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) { if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); } phase = 'AFTER'; selected = false; captureStart = -1; }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON entry: ${wanted}`);
}
