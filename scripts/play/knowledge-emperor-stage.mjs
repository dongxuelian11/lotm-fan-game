import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { validateSlicePayload } from '../../dist/domain/slice/validation.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';
import { validateKnowledgeEmperorSource } from '../../dist/domain/knowledge-emperor/index.js';
import { getKnowledgeEmperorCurrentSite, knowledgeEmperorLifeMasteryGains } from '../../dist/domain/knowledge-emperor/life.js';

// Freeze all mechanisms and this public strategy before executing once. The
// original651-command natural Sage continuation is replayed and checked
// before new public choices. No old death is reopened. No seed/cursor edits, outcome reloads, free supplies,
// altered source/death captures, or adaptive combat stances are permitted.
const source='tests/fixtures/sage-v01780/natural.json';
const SOURCE_HASH='a0e37a9db792f8a6906efa92dbec3b13e0c1dff00ad9df492158b7d05b569766';
const PREFIX_HASH='b7337b1b8265d38324749a82dfb5b77f9e07fda6d9936c1257a3c2bea3ba9031';
const preservedFiles=['tests/fixtures/prophecy-master-v01540/natural.json'];
const preserved=preservedFiles.map(file=>({file,sha256:fileDigest(file),commands:readObjectEntry(file,'commands').length,status:readObjectEntry(file,'final').status}));
const old=Object.fromEntries(['provenance','seed','initial','commands','prefixCount','final'].map(k=>[k,readObjectEntry(source,k)]));
const prefixCount=651, CASES=['knowledge-power','power-knowledge','withdrawn-consent'];
const ROOTS=['pryer','combatScholar','wizard','scrollProfessor','starMystic','mystic','prophecyMaster','sage'];
const NEW_IDS=['hermit.s1.knowledge-power','hermit.s1.power-knowledge'];
const strategy=deepFreeze({source:'EXACT651_LIVING_NATURAL_SAGE_FINAL',sourceSeed:'pryer-natural-v048',sourceCursor:340,
  caseMethod:'ABILITY',caseRoute:'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy:'ALL',combatStance:'CONTROL',combatRoundCap:90,potionAttemptCap:12,maxCommands:3500,ordinaryPreparationCap:600,
  sourceInjuryRecovery:'DISCOVER_ACTUAL_CLINIC_PAY60_THEN_REST_FOR_TWO_ORIGINAL_HEAVY_WOUNDS',ordinaryActions:'WORK_ONCE_PER_WEEK_THEN_REST',
  recovery:{health:100,mind:100,spirituality:120,pollution:0},energyBeforeCase:24,energyBeforeEncounter:15,
  eventChoices:{ORIGIN:'.decline','LIFE-BILL-01':'PAY_PART','DEBT-NOTICE-01':'DECLINE','DEBT-SETTLE-01':'DEFER','LIFE-CARE-01':'PAY','CARE-WORK-OFFER':'DECLINE'}});
assert.equal(process.argv.length,2,'Run once without seed, cursor or outcome options');
assert.equal(fileDigest(source),SOURCE_HASH);assert.equal(old.commands.length,prefixCount);assert.equal(compactDigest(old.commands),PREFIX_HASH);
assert.equal(old.prefixCount,507);assert.equal(old.provenance.kind,'SAME_SEED_PUBLIC_NATURAL_PREFIX');assert.equal(old.initial.progression.sequence,null);
assert.equal(old.seed,strategy.sourceSeed);assert.equal(old.final.schemaVersion,175);assert.equal(old.final.contentVersion,'sage-v175');
const producerHash=fileDigest(fileURLToPath(import.meta.url));
mkdirSync('output/play',{recursive:true});const outputDir=mkdtempSync('output/play/knowledge-emperor-02000-');
const commands=[],boundaries={},boundarySteps={},snapshots={},uniqueTransitions=[],treatments=[];
const capturedSteps=new Map(),snapshotSteps=new Map();
const write=(name,value)=>writeFileSync(`${outputDir}/${name}`,JSON.stringify(value),{flag:'wx'});
const append=(name,value)=>appendFileSync(`${outputDir}/${name}`,`${JSON.stringify(value)}\n`);
writeFileSync(`${outputDir}/commands.jsonl`,'',{flag:'wx'});writeFileSync(`${outputDir}/public.jsonl`,'',{flag:'wx'});
let s=migrateSliceState(old.initial),initial=structuredClone(s),original=null,beforeLast=null,lastIntent=null,pendingIntent=null,prefixVerified=false,saved=false,failurePhase='INITIALIZATION';
const view=()=>projectSliceState(s).knowledgeEmperor,life=()=>s.knowledgeEmperor.life,site=()=>getKnowledgeEmperorCurrentSite(s);
const body=x=>({status:x.status,revision:x.revision,week:x.week,date:x.date,H:x.health,M:x.mind,S:x.spirituality,cash:x.cash,AP:x.actionsRemaining,
  pollution:x.seer.pollution,injuries:x.injuries,injuryRisk:x.injuryRisk,random:x.random,mastery:x.progression.mastery,sequence:x.progression.sequence,acting:x.progression.acting});
class ActualTerminalStop extends Error{};class FiniteEncounterStop extends Error{};
function preserve(){
 assert.equal(fileDigest(source),SOURCE_HASH);for(const f of preserved)assert.equal(fileDigest(f.file),f.sha256);
}
function originals(){
 assert(original);for(const key of ROOTS)assert.deepEqual(s[key],original[key],`Immutable original ${key} history`);
 assert.deepEqual(s.combatHistory.slice(0,original.combatHistory.length),original.combatHistory);
 if(s.knowledgeEmperor.guidanceKnown)assert(validateKnowledgeEmperorSource(s));
 const oldSite=original.sage.encounter.currentSite;assert(oldSite);
 assert.deepEqual(s.sage.ritual,original.sage.ritual,'Original stopped disaster, damage and injured adults remain exact');
 assert.deepEqual(s.sage.encounter,original.sage.encounter,'Merrin remains the original living retreated opponent');
 assert.deepEqual(site().materials,oldSite.materials,'Old returned kits never refill');
 assert.equal(site().archive.id,oldSite.archive.id);assert.equal(site().archive.location,oldSite.archive.location);
 assert.equal(site().record.id,oldSite.record.id);assert.equal(site().record.location,oldSite.record.location);
 assert.equal(site().body,'SOLID');assert.equal(site().form.active,false);
 assert.equal(site().iris.id,oldSite.iris.id);assert(site().iris.energy<=oldSite.iris.energy);assert(site().iris.travelMetres>=oldSite.iris.travelMetres);
 const expected=structuredClone(original.progression.mastery);
 if(s.progression.sequence===1){for(const id of NEW_IDS)expected[id]=0;for(const [id,n]of Object.entries(knowledgeEmperorLifeMasteryGains(s)))expected[id]+=n;}
 for(const round of s.combatHistory.slice(original.combatHistory.length)){
  assert(round.knowledgeEmperorOutcome);for(const a of [...round.knowledgeEmperorOutcome.playerActions,...round.knowledgeEmperorOutcome.enemyActions])for(const id of a.masteryApplied){assert(Object.hasOwn(expected,id));expected[id]=Math.min(500,expected[id]+8);}
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
function compact(){return {...body(s),activeEvent:s.activeEvent?.instanceId??null,site:site(),life:{activeCase:life().activeCase,pending:life().pending,clockSeconds:site().clockSeconds},encounter:{status:s.knowledgeEmperor.encounter.status,currentSite:s.knowledgeEmperor.encounter.currentSite,terminal:s.knowledgeEmperor.encounter.terminal}};}
function publicControl(intent){
 if(!prefixVerified)return{kind:'IMMUTABLE651_SOURCE_PREFIX',enabled:true};const p=projectSliceState(s);
 if(intent.type==='KNOWLEDGE_EMPEROR'){const a=p.knowledgeEmperor.actions.find(x=>isDeepStrictEqual(x.command,intent.command));assert(a,`No public control ${JSON.stringify(intent.command)}`);assert(a.enabled,a.reason);return structuredClone(a);}
 if(intent.type==='ACTION'){assert(p.canAct,p.actionBlockedReason);assert(['WORK','REST'].includes(intent.action)||(intent.action==='INVESTIGATE'&&intent.targetId==='CARE-ACCESS-01'&&!s.careKnown));assert(!view().insideCase&&!s.combat&&s.knowledgeEmperor.preparedWeek===null);return{kind:'ACTION',action:intent.action,...(intent.targetId?{targetId:intent.targetId}:{}),enabled:true};}
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
 if(prefixVerified){originals();capture(key??`step-${commands.length}-${intent.type==='KNOWLEDGE_EMPEROR'?intent.command.type.toLowerCase():intent.type.toLowerCase()}`);}
 failurePhase='IDLE';if(prefixVerified&&s.status!=='ACTIVE')throw new ActualTerminalStop(`Actual ${s.status}`);
}
const dh=(command,key=null)=>go({type:'KNOWLEDGE_EMPEROR',command},key);
function clear(){for(let n=0;s.activeEvent&&n<20;n++){const e=projectSliceState(s).activeEvent,choiceId=strategy.eventChoices[e.id.startsWith('ORIGIN')?'ORIGIN':e.id];assert(choiceId,`Unplanned event ${e.id}`);const prior=e.id==='LIFE-CARE-01'?structuredClone(body(s)):null;go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId});if(prior)treatments.push({paidPennies:60,before:prior,after:structuredClone(body(s))});}assert.equal(s.activeEvent,null);assert.equal(s.pulse,'NONE');}
function ordinary(forceRest=false,key=null){clear();assert(!view().insideCase&&!s.combat);go({type:'ACTION',action:forceRest||s.wagePaidWeek===s.week?'REST':'WORK'},key);clear();}
function ready({ap=1,cash=0,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}){clear();assert(!view().insideCase&&!s.combat&&s.knowledgeEmperor.preparedWeek===null);for(let n=0;s.actionsRemaining<ap||s.cash<cash||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek;n++){assert(n<strategy.ordinaryPreparationCap);ordinary();}}
function action(command,key=null){ready();dh(command,key);clear();}
function recoverEnergy(minimum){while(site().playerEnergy<minimum){ready({ap:1,cash:15});dh({type:'RECOVER_ENERGY'},'actual-paid-outside-energy-recovery');clear();}}
function practice(caseId){
 ready({ap:2,cash:20,...strategy.recovery});recoverEnergy(strategy.energyBeforeCase);ready({ap:2,cash:20,...strategy.recovery});
 const start=structuredClone(site());dh({type:'OBSERVE',caseId},`${caseId}-observe-originals`);
 for(let n=0;life().cases[caseId].status!=='EXAMINED';n++){
  assert(n<60,'Finite case action budget');const a=view().life.actions.find(a=>a.preferredAction&&a.enabled);assert(a,'Current case requires an actual enabled public next step');dh(a.command,`${caseId}-${a.command.type.toLowerCase()}`);
 }
 clear();assert.equal(life().cases[caseId].status,'EXAMINED');assert.equal(life().cases[caseId].attempts.length,1);
 assert.equal(site().playerLocation,'OUTSIDE');assert.equal(site().iris.location,'OUTSIDE');
 assert(site().playerTravelMetres>start.playerTravelMetres);assert(site().iris.travelMetres>=start.iris.travelMetres);
 action({type:'REPORT',caseId},`${caseId}-honest-report`);assert.equal(life().cases[caseId].status,'RESOLVED');
}
function consume(bottleId){const before=structuredClone(body(s)),energy=site().playerEnergy;dh({type:'CONSUME',bottleId,confirmed:true},`consume-${bottleId}`);const b=s.knowledgeEmperor.bottles.find(b=>b.id===bottleId);assert.equal(b.status,'CONSUMED');assert.equal(s.random.cursor,before.random.cursor+1);assert.equal(site().playerEnergy,energy);assert.equal(s.knowledgeEmperor.preparedWeek,null);capture(s.progression.sequence===1?'promotion':'actual-potion-failure');clear();}
function encounter(){
 ready({ap:2,cash:30,...strategy.recovery});recoverEnergy(strategy.energyBeforeEncounter);ready({ap:2,cash:30,...strategy.recovery});snapshot('recoveredBeforeEncounter');
 assert.equal(site().iris.location,'OUTSIDE');assert.equal(s.knowledgeEmperor.encounter.status,'AVAILABLE');
 dh({type:'PREPARE_ENCOUNTER'},'paid-independent-combat-note');dh({type:'ENCOUNTER_TALK'},'actual-independent-darian-contact');
 if(s.knowledgeEmperor.encounter.policy!==strategy.encounterPolicy)dh({type:'SET_COMBAT_POLICY',policy:strategy.encounterPolicy},'fixed-all-policy');assert.equal(s.knowledgeEmperor.encounter.policy,strategy.encounterPolicy);dh({type:'ENCOUNTER_FIGHT'},'independent-optional-fight');snapshot('combatStart');
 while(s.combat&&s.combat.round<=strategy.combatRoundCap)go({type:'COMBAT_ROUND',stance:strategy.combatStance},`combat-round-${s.combat.round}`);
 if(s.combat)throw new FiniteEncounterStop('Declared90-round limit retains the actual unresolved encounter');
 assert(s.knowledgeEmperor.encounter.terminal);assert.equal(s.knowledgeEmperor.encounter.currentSite.playerLocation,'OUTSIDE');snapshot('combatTerminal');capture('actual-ordinary-encounter-exit');
}
function save(stage,error=null){
 assert(!saved);saved=true;preserve();const e=s.knowledgeEmperor.encounter,rounds=s.combatHistory.slice(original?.combatHistory.length??s.combatHistory.length);
 const attempts=CASES.flatMap(id=>life().cases[id].attempts);
 write('natural.json',{provenance:{kind:'EXACT651_PUBLIC_SAGE_THEN_PUBLIC_KNOWLEDGE_EMPEROR',prior:old.provenance,source,sourceSha256:SOURCE_HASH,sourceRoot:'final',inheritedDirectedPrefix:false,fullNaturalS9ToS1:s.progression.sequence===1,newRandomChanges:false,preserved},
  continuation:{kind:'EXACT651_LIVING_PREFIX_THEN_PUBLIC_KNOWLEDGE_EMPEROR',sourceFixture:source,sourceRoot:'final',sourceS3Setup:'NATURAL',newRandomChanges:false},producerSha256:producerHash,strategy,seed:old.seed,prefixCount,inheritedPrefixCount:507,prefixVerified,commands,initial,prefixFinal:original,beforeLast,lastIntent,pendingIntent,failurePhase,snapshots,treatments,stage,error:error?String(error.stack??error):null,final:s});
 write('boundaries.index.json',boundaries);write('boundaries.steps.json',boundarySteps);write('transitions.json',uniqueTransitions);
 write('summary.json',{stage,producerSha256:producerHash,strategy,source:{prefixCount,prefixVerified,sourceSha256:SOURCE_HASH,prefixCompactSha256:PREFIX_HASH,migratedWholeSourceSha256:original?digest(original):null,preserved},commands:commands.length,final:body(s),originalMastery:original?.progression.mastery,mastery:s.progression.mastery,
  lifeCases:life().cases,lifeAbilityUse:Object.fromEntries(NEW_IDS.map((id,i)=>[id,{attempts:attempts.filter(a=>a[i===0?'knowledgePowerTier':'powerKnowledgeTier']!==null).length,checkSuccesses:attempts.filter(a=>['SUCCESS','GREAT_SUCCESS'].includes(a[i===0?'knowledgePowerTier':'powerKnowledgeTier'])).length,actualApplications:attempts.filter(a=>a.appliedAbilityIds.includes(id)).length}])),
  sourceOriginals:original?{site:(original.sage.encounter.currentSite??original.sage.life.site)}:null,currentOriginals:{site:site()},life:life(),encounter:e,rounds,bottles:s.knowledgeEmperor.bottles,treatments,boundaries:Object.keys(boundaries),uniqueTransitions:uniqueTransitions.length,snapshots});
 write('capture-integrity.json',{producerSha256:producerHash,naturalSha256:fileDigest(`${outputDir}/natural.json`),commandsSha256:fileDigest(`${outputDir}/commands.jsonl`),publicSha256:fileDigest(`${outputDir}/public.jsonl`),sourcePrefixSha256:prefixVerified?fileDigest(`${outputDir}/source-prefix.json`):null,boundaryIndexSha256:fileDigest(`${outputDir}/boundaries.index.json`),boundaryStepsSha256:fileDigest(`${outputDir}/boundaries.steps.json`),transitionsSha256:fileDigest(`${outputDir}/transitions.json`),summarySha256:fileDigest(`${outputDir}/summary.json`),files:Object.fromEntries([...new Set([...Object.values(boundaries),...Object.values(snapshots)])].map(n=>[n,fileDigest(`${outputDir}/${n}`)]))});
 console.log(JSON.stringify({outputDir,stage,commands:commands.length,prefixCount,prefixVerified,status:s.status,sequence:s.progression.sequence,week:s.week,producerSha256:producerHash}));
}
try{
 assertValidSliceState(s);for(const intent of old.commands)go(intent);assert.deepEqual(s,migrateSliceState(old.final));assert.deepEqual(commands,old.commands);
 assert.equal(s.revision,652);assert.equal(s.week,152);assert.equal(s.random.cursor,340);assert.equal(s.health,40);assert.equal(s.injuries.length,2);assert(s.injuries.every(i=>i.severity==='HEAVY'&&i.treatedRevision===null));assert.equal(s.careKnown,false);
 original=structuredClone(s);prefixVerified=true;write('source-prefix.json',{source,sourceSha256:SOURCE_HASH,prefixCount,rawInitial:old.initial,rawFinal:old.final,commands:old.commands,rawCommandsSha256:PREFIX_HASH,migratedWholeStateSha256:digest(original),preserved,inheritedDirectedPrefix:false});snapshot('departure');capture('exact-original651-living-source');
 go({type:'ACTION',action:'INVESTIGATE',targetId:'CARE-ACCESS-01'},'actual-discovery-of-ordinary-clinic');clear();
 for(let n=0;s.injuries.length;n++){assert(n<30,'Finite actual clinic recovery');ready({ap:1,cash:60});ordinary(true,'actual-rest-and-clinic-for-original-heavy');}
 ready(strategy.recovery);assert.equal(s.injuries.length,0);assert.equal(treatments.length,1);snapshot('sourceRecovered');
 ready({ap:1,cash:500,...strategy.recovery});dh({type:'LEARN_GUIDANCE'},'paid500-guidance-freezes-eight-roots');clear();snapshot('guidance');
 for(const taskId of ['VERIFY_ORIGINALS','VERIFY_KNOWLEDGE','CHECK_RETURN'])action({type:'PREPARE_TASK',taskId},`preparation-${taskId}`);
 for(let number=0;s.progression.sequence===2&&number<strategy.potionAttemptCap;number++){
  let b=s.knowledgeEmperor.bottles.find(x=>x.status==='PLAYER')??s.knowledgeEmperor.bottles.find(x=>x.status==='SUPPLIER');
  if(!b){ready({ap:1,cash:100});dh({type:'REQUEST_SUPPLY'},'paid-next-week-resupply');const week=s.knowledgeEmperor.resupply.requestedWeek;clear();ready({afterWeek:week});dh({type:'RECEIVE_SUPPLY'},'actual-next-week-new-stock');b=s.knowledgeEmperor.bottles.find(x=>x.status==='SUPPLIER');}
  assert(b);const id=b.id;if(b.status==='SUPPLIER'){while(s.knowledgeEmperor.bottles.find(x=>x.id===id).labourSteps<5)action({type:'POTION_WORK',bottleId:id},`${id}-real-labour`);ready({cash:1400});dh({type:'BUY_POTION',bottleId:id},`actual1200p-buy-${id}`);}
  ready({ap:1,cash:180,...strategy.recovery,afterWeek:s.sage.promotionWeek+11});dh({type:'PREPARE_PROMOTION'},`actual180p-current-week-prepare-${id}`);consume(id);
 }
 if(s.progression.sequence!==1)save('SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2');else{
  assert.equal(s.knowledgeEmperor.sageActingAtPromotion,100);for(const id of NEW_IDS)assert.equal(s.progression.mastery[id],0);snapshot('promoted');
  for(const id of CASES)practice(id);action({type:'REFLECT'},'three-actual-honest-reports-reflected');assert.equal(s.progression.acting,100);snapshot('practiced');
  encounter();clear();if(s.wagePaidWeek===s.week)ready({afterWeek:s.week});ready();go({type:'ACTION',action:'WORK'},'actual-work-after-living-exit');clear();originals();save('NATURAL651_PREFIX_PUBLIC_KNOWLEDGE_EMPEROR_CONTINUATION');
 }
}catch(error){if(saved)throw error;if(error instanceof ActualTerminalStop){snapshot('actualTerminal');save('ACTUAL_TERMINAL_WITH_NATURAL651_HISTORY');}else if(error instanceof FiniteEncounterStop)save('ACTUAL_FINITE_ENCOUNTER_UNRESOLVED',error);else{save('ACTUAL_BLOCKER',error);throw error;}}

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
