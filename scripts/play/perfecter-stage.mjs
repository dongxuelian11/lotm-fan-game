import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
/** Same original797 living campaign. Public choices only, no seed/check search.
 * Durable before-action and completed-draft checkpoints preserve failures and
 * exact pending commands across interruptions. Run only after runtime freeze. */
export const SOURCE='tests/fixtures/civilization-enlightener-v01890/natural.json';
export const SOURCE_SHA256='5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f';
export const HISTORY=SOURCE,HISTORY_SHA256=SOURCE_SHA256;
export const PREFIX_COUNT=797;
export const PREFIX_SHA256='3c5d52d10c731b2664f324a27ed5544623af38a66b38a4debdde50a9c62af565';
export const FORMAT='PERFECTER797_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
const SELF=fileURLToPath(import.meta.url);
const HOME='backlund:civic-repair-workshop',SUPPLIER='backlund:professional-handoff',ARCHIVE='backlund:custody-archive',VAULT='backlund:sealed-vault',WORKSHOP='backlund:ritual-workshop',INCIDENT='backlund:old-civic-archive';
const STATIONS=['ARCHIVE','WORKSHOP','SOUTH_BANK'];
const STATION_LOCATIONS={ARCHIVE:INCIDENT,WORKSHOP:HOME,SOUTH_BANK:'backlund:south-bank-relay'};
const LABOUR=['SEAL_REGISTER','CRATE_AUDIT','SUPPLY_LIST','TRANSIT_RECEIPT','DELIVERY_REVIEW'];
export const POLICY=Object.freeze({id:'PERFECTER797_THREE_REAL_STATIONS_PAID_STABILITY_V1',startWeek:188,wage:180,weeklyLiving:30,defaultObservationActions:500,
 preparation:'REAL_CLINIC_REST_WORK_THREE_STATION_REPAIR_OPERATOR_TRIAL_TWO_WEEK_RESULTS',materials:'THREE_ORIGINALS_REAL_LABOUR_CUSTODY_AND_CARRIER',promotion:'PAID_SAME_COMPOUND_STABILITY_BEFORE_EVERY_DOSE',recovery:'REAL_SEAL_RECOVER_CLINIC_REST_NEW_PAID_CARRIER',epilogue:'OBSERVE_CONTAIN_RECONSTRUCT_ORDINARY_EVACUATE_OR_ISOLATE_WITHDRAW_REPORT',noReroll:true});
const clone=v=>structuredClone(v),sha=v=>createHash('sha256').update(v).digest('hex');
export function stable(v){if(Array.isArray(v))return `[${v.map(stable).join(',')}]`;if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;return JSON.stringify(v);}
export const stateHash=v=>sha(stable(v));const compactHash=v=>sha(JSON.stringify(v));
const material=(type,extra={})=>({type:'MATERIAL',command:{type,...extra}}),works=(type,stationId)=>({type:'WORKS',command:{type,stationId}}),travel=to=>({type:'TRAVEL',to});
const section=(view,id)=>view.sections.find(s=>s.id===id)?.lines??[];
const cash=view=>Number(view.resources.cash.match(/^\d+/)?.[0]??NaN);
const price=action=>({actions:Number(action.cost.match(/(\d+)行动/)?.[1]??1),cash:Number(action.cost.match(/(\d+)便士/)?.[1]??0),weeks:Number(action.cost.match(/实际(\d+)周/)?.[1]??0)});
export const WORKS_PLAN=Object.freeze([...STATIONS.flatMap(station=>['WORKS_TRAVEL','WORKS_INSPECT','WORKS_BUY_PARTS','WORKS_REPAIR','WORKS_CALIBRATE','WORKS_TRIAL'].map(type=>works(type,station))),...STATIONS.flatMap(station=>[works('WORKS_TRAVEL',station),works('WORKS_VERIFY',station)]),travel(HOME)]);
export const MATERIAL_PLAN=Object.freeze([travel(SUPPLIER),...['civilization-enlightener-potion-2','civilization-enlightener-potion-3'].flatMap(bottleId=>[...LABOUR.map(taskId=>material('MATERIAL_LABOUR',{bottleId,taskId})),material('ACQUIRE_CHARACTERISTIC',{bottleId})]),material('BUY_COMPOUND',{batchId:'perfecter-carrier-1'}),travel(ARCHIVE),material('VERIFY_UNIQUENESS',{step:'CHAIN'}),travel(VAULT),material('VERIFY_UNIQUENESS',{step:'VACANCY'}),material('VERIFY_UNIQUENESS',{step:'SEAL'}),material('ACQUIRE_UNIQUENESS'),travel(WORKSHOP),material('COMPOSE_POTION',{batchId:'perfecter-carrier-1'})]);
export function startingPolicy(){return{phase:'GUIDANCE',step:0,week:188,location:HOME,doses:0,failedCompoundId:null,recoveryStep:0,rescueReported:false,epilogueAttempted:[]};}
function recoveryPlan(p){const batch=p.doses<3?`perfecter-carrier-${p.doses+1}`:'perfecter-carrier-1';return[material('SEAL_REMAINS',{compoundId:p.failedCompoundId,method:'PROFESSIONAL'}),material('RECOVER_SEALED',{compoundId:p.failedCompoundId}),{type:'CLINIC'},travel(SUPPLIER),...(p.doses<3?[material('BUY_COMPOUND',{batchId:batch})]:[material('REQUEST_COMPOUND_REPAIR',{batchId:batch}),material('RECEIVE_COMPOUND_REPAIR',{batchId:batch})]),travel(WORKSHOP),material('COMPOSE_POTION',{batchId:batch})];}
export function chooseAction(view,previous){
 const policy=clone(previous),r=view.resources,all=view.actions;
 const offered=c=>all.find(a=>isDeepStrictEqual(a.command,c));const enabled=c=>{const a=offered(c);return a?.enabled?a:null;};const ordinary=t=>enabled({type:t});
 const select=(action,reason,advanceStep=false)=>{assert(action?.enabled);return{action:clone(action),reason,policy,advanceStep};};
 const stop=(stage,reason)=>({stop:stage,reason,policy});
 const wait=reason=>ordinary('NEXT_WEEK')?select(ordinary('NEXT_WEEK'),reason):stop('PUBLIC_ACTION_BLOCKED',reason);
 const needsRest=()=>r.health<100||r.mind<100||r.spirituality<120||section(view,'injuries').some(l=>/^(重伤|轻伤)：/.test(l));
 const recover=reason=>ordinary('CLINIC')?select(ordinary('CLINIC'),'Treat the actual untreated heavy injury for its real charge'):ordinary('REST')?select(ordinary('REST'),reason):wait(reason);
 const execute=(c,reason,advanceStep=false)=>{const a=offered(c);if(!a)return stop('PUBLIC_ACTION_BLOCKED',`Missing public action ${JSON.stringify(c)}`);if(a.enabled)return select(a,reason,advanceStep);if(r.actionsRemaining<price(a).actions||cash(view)<price(a).cash)return wait(`Obtain the actual weekly budget for ${a.label}`);if(/健康|精神|灵性|伤势/.test(a.reason??'')&&needsRest())return recover(`Recover actual resources for ${a.label}`);if((c.type==='WORKS'&&c.command.type==='WORKS_VERIFY'&&/^还需等到第\d+周/.test(a.reason??''))||(c.type==='MATERIAL'&&c.command.type==='RECEIVE_COMPOUND_REPAIR'&&a.reason?.includes('经过下一真实周')))return wait(`Wait the actual required time for ${a.label}: ${a.reason}`);return stop('PUBLIC_ACTION_BLOCKED',`${a.label}: ${a.reason}`);};
 if(policy.rescueReported)return stop('NATURAL_ARCHIVE_REPORTED','Actual original archive outcome reported; no replay or forced successful skill');
 if(!view.guidanceKnown)return execute({type:'LEARN_GUIDANCE'},'Pay guidance on the exact original living797 save');
 if(policy.phase==='GUIDANCE')policy.phase='HEAL';
 if(view.promoted){
  policy.phase='EPILOGUE';
  const ep=type=>enabled({type:'EPILOGUE',command:{type}});
  if(ep('REPORT'))return select(ep('REPORT'),'Report only the actual people, apparatus and effects');
  if(view.insideCase){
   if(ep('OBSERVE'))return select(ep('OBSERVE'),'Observe the actual original archive fault and ordinary exit');
   for(const t of ['CONTAIN_FLOW','RECONSTRUCT_MODEL'])if(!policy.epilogueAttempted.includes(t)&&ep(t))return select(ep(t),'Try the available finite technique once on this real unfinished scene');
   if(ep('ISOLATE'))return select(ep('ISOLATE'),'Close the actual ordinary isolator without a magical success requirement');
   if(ep('EVACUATE'))return select(ep('EVACUATE'),'Move the actual adults by the ordinary route');
   if(ep('WITHDRAW'))return select(ep('WITHDRAW'),'Use the actual ordinary exit and retain all costs and damage');
   return stop('PUBLIC_ACTION_BLOCKED','No public ordinary scene exit or report is available');
  }
  if(needsRest())return recover('Recover actual body before entering the archive incident');
  if(policy.location!==INCIDENT)return execute(travel(INCIDENT),'Walk to the actual original archive incident');
  if(r.actionsRemaining<3)return wait('Reserve three real actions for the finite scene and ordinary evacuation');
  return execute({type:'START_EPILOGUE'},'Enter the already-existing original archive fault');
 }
 // An enabled dose may still be unprepared. The public preferred marker is
 // set only for this bottle's effective paid preparation, never for a roll.
 const preparedDose=all.find(a=>a.command.type==='CONSUME'&&a.enabled&&a.preferredAction===true);
 const consumePrepared=()=>{
  const preparation=offered({type:'STABILIZE_PROMOTION',compoundId:preparedDose.command.compoundId});
  if(!preparation||preparation.enabled||!section(view,'promotion-stability').some(line=>line.includes('当前准备仍有效')))
   return stop('PUBLIC_STABILITY_BINDING_BLOCKED','A same-compound effective paid preparation is required before consumption');
  return select(preparedDose,'Take the same paid prepared dose immediately before any optional work or rest');
 };
 if(policy.phase==='PROMOTE'&&preparedDose)return consumePrepared();
 if(ordinary('WORK')&&cash(view)<8000)return select(ordinary('WORK'),'Earn this week’s original occupation wage once; pay living costs normally');
 if(policy.phase==='HEAL'){
  if(needsRest())return recover('Treat and recover the two original injuries without free healing');
  policy.phase='WORKS';policy.step=0;
 }
 if(policy.phase==='WORKS'){
  if(policy.step<WORKS_PLAN.length)return execute(WORKS_PLAN[policy.step],'Repair and verify the same actual municipal apparatus and residents',true);
  policy.phase='MATERIALS';policy.step=0;
 }
 if(policy.phase==='MATERIALS'){
  if(policy.step<MATERIAL_PLAN.length){
   const target=MATERIAL_PLAN[policy.step];
   if(target.command?.type==='VERIFY_UNIQUENESS'&&target.command.step==='SEAL'){
    const seal=offered(target),handoff=offered(material('ACQUIRE_UNIQUENESS'));
    if(!seal||!handoff)return stop('PUBLIC_ACTION_BLOCKED','Both public final-seal and same-week uniqueness delivery actions are required');
    if(r.actionsRemaining<price(seal).actions+price(handoff).actions||cash(view)<price(seal).cash+price(handoff).cash+POLICY.weeklyLiving)
     return wait('Reserve the actual fees and two actions for final seal, same-week original uniqueness delivery and the living bill');
   }
   return execute(target,'Acquire and physically carry the same conserved originals with actual fees',true);
  }
  policy.phase='PROMOTE';policy.step=0;
 }
 if(policy.phase==='RECOVERY'){
  const plan=recoveryPlan(policy);
  if(policy.recoveryStep>=3&&needsRest())return recover('Recover actual failed-dose injuries and resources after paid treatment');
  if(policy.recoveryStep<plan.length)return execute(plan[policy.recoveryStep],'Pay for recovery of the same failed originals and a new ordinary carrier',true);
  policy.phase='PROMOTE';policy.step=0;
 }
 if(policy.phase==='PROMOTE'){
  if(preparedDose)return consumePrepared();
  if(needsRest())return recover('Reach a real healthy, clear and funded preparation state');
  const preparation=all.find(a=>a.command.type==='STABILIZE_PROMOTION'&&a.enabled);
  if(preparation){if(r.actionsRemaining<2)return wait('Keep two actual actions for same-bottle preparation and consumption');return select(preparation,'Pay one-use stability for this actual compound and verified works');}
  const blockedPreparation=all.find(a=>a.command.type==='STABILIZE_PROMOTION');
  if(blockedPreparation)return execute(blockedPreparation.command,'Pay one-use stability for this actual compound and verified works');
  return stop('PUBLIC_ACTION_BLOCKED','No public same-compound paid preparation is available; do not take an unprepared dose');
 }
 return stop('PUBLIC_ACTION_BLOCKED',`Unknown public policy phase ${policy.phase}`);
}
export function advancePolicy(decision,after){const p=clone(decision.policy),c=decision.action.command;if(decision.advanceStep){if(p.phase==='RECOVERY')p.recoveryStep++;else p.step++;}if(c.type==='NEXT_WEEK')p.week++;if(c.type==='TRAVEL')p.location=c.to;if(c.type==='RETURN_ON_FOOT')p.location=HOME;if(c.type==='WORKS'&&c.command.type==='WORKS_TRAVEL')p.location=STATION_LOCATIONS[c.command.stationId];if(c.type==='CONSUME'){p.doses++;p.failedCompoundId=after.promoted?null:c.compoundId;p.phase=after.promoted?'EPILOGUE':'RECOVERY';p.recoveryStep=0;}if(c.type==='EPILOGUE'){p.epilogueAttempted.push(c.command.type);if(c.command.type==='REPORT')p.rescueReported=true;}return p;}

export function fileEvidence(path) {
  const before = lstatSync(path, { bigint: true });
  assert(before.isFile() && !before.isSymbolicLink(), `Not a frozen regular file: ${path}`);
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(before[key], after[key], `File changed while hashing: ${path}`);
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: hash.digest('hex') };
}
export function inspectFreeze(root = process.cwd()) {
  const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Frozen input cannot be a symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else if (stat.isFile()) files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/perfecter/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes',SOURCE,HISTORY])) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
  return { sha256: compactHash(files), nodeVersion: process.version, files };
}
const stampFreeze = (root, freeze) => freeze.files.map(file => {
  const path = file.file === '$natural-producer' ? SELF : join(root, file.file), stat = lstatSync(path, { bigint: true });
  return { path, size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs, ino: stat.ino };
});
function unchanged(stamps) {
  for (const before of stamps) {
    const after = lstatSync(before.path, { bigint: true }); assert(after.isFile() && !after.isSymbolicLink());
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(before[key], after[key], `Frozen input drift: ${before.path}`);
  }
}
export function readSource(root = process.cwd()) {
  const bytes = readFileSync(join(root, SOURCE));
  assert.equal(sha(bytes), SOURCE_SHA256, 'Original living797 source bytes changed');
  const old = JSON.parse(bytes), source = old.final, commands = old.commands;
  assert.equal(commands.length, PREFIX_COUNT); assert.equal(compactHash(commands), PREFIX_SHA256);
  assert.equal(source.revision, 798); assert.equal(source.runId, 'savant-rebuild-natural');
  assert.equal(old.seed, source.random.seed); assert.deepEqual(source.random, {seed:'savant-rebuild-first',cursor:346});
  assert.equal(source.schemaVersion,186); assert.equal(source.contentVersion,'civilization-enlightener-v186');
  assert.equal(source.status,'ACTIVE'); assert.equal(source.week,188);
  assert.deepEqual([source.health,source.mind,source.spirituality,source.cash,source.actionsRemaining],[60,98,120,436,3]);
  assert.deepEqual(source.injuries.map(i=>i.severity),['LIGHT','HEAVY']);
  assert.equal(source.progression.sequence,1); assert.equal(source.progression.acting,100);
  assert.equal(source.character.weeklyWage,180); assert.equal(source.lifeTier,'DESTITUTE');
  assert.equal(source.debts.reduce((sum,d)=>sum+d.remaining,0),0);
  assert.deepEqual(source.civilizationEnlightener.bottles.map(b=>[b.id,b.status,b.labourSteps]),[
    ['civilization-enlightener-potion-1','CONSUMED',5],['civilization-enlightener-potion-2','SUPPLIER',0],['civilization-enlightener-potion-3','SUPPLIER',0]]);
  assert.equal(Object.keys(source.progression.mastery).length,21);
  assert.equal(Object.values(source.progression.mastery).filter(v=>v===0).length,8);
  return { source, commands, creation:old.creation,seed:old.seed,initial:old.initial };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index', 'domain/slice/migration', 'domain/perfecter/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openPerfecterRuntimeSession: session.openPerfecterRuntimeSession };
}
function migrate(runtime, original) {
  const state = runtime.migrateSliceState(original);
  for (const [key, value] of Object.entries(original)) {
    if (key === 'schemaVersion' || key === 'contentVersion') continue;
    assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  }
  assert.equal(state.contentVersion, 'perfecter-v208'); assert.equal(state.schemaVersion, 208);
  runtime.assertValidSliceState(state); return state;
}
function checkOriginals(state, original) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed);
  assert(state.random.cursor >= original.random.cursor);
  for (const key of ['savant','archaeologist','appraiser','artisan','astronomer','alchemist','arcaneScholar','knowledgeMentor','civilizationEnlightener','world','combatHistory'])
    assert.deepEqual(state[key], original[key], `Original history changed: ${key}`);
  assert.deepEqual(state.character, original.character, 'Original identity and core skills must remain unchanged');
  for (const [id, value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  if (state.perfecter.source) {
    assert.equal(state.perfecter.source.revision, original.revision);
    assert.deepEqual(state.perfecter.source.random, original.random);
    assert.deepEqual(state.perfecter.source.budget.injuries, original.injuries);
    assert.equal(state.perfecter.source.budget.cash, original.cash);
  }
}
const syncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function durableCreate(path, value) {
  const fd = openSync(path, 'wx'); try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
}
export const encodeCheckpoint = payload => JSON.stringify({ sha256: stateHash(payload), payload });
export function decodeCheckpoint(bytes) {
  const envelope = JSON.parse(bytes); assert.equal(envelope.sha256, stateHash(envelope.payload), 'Checkpoint checksum mismatch');
  assert.equal(envelope.payload.format, FORMAT); return envelope;
}
export function recoverAtomicNext(path) {
  const candidate = `${path}.next`; if (!existsSync(candidate)) return;
  const current = existsSync(path) ? decodeCheckpoint(readFileSync(path, 'utf8')) : null;
  let next;
  try { next = decodeCheckpoint(readFileSync(candidate, 'utf8')); }
  catch {
    assert(!existsSync(`${path}.incomplete`), 'Preserve both incomplete boundaries and inspect before resume');
    renameSync(candidate, `${path}.incomplete`); syncDirectory(dirname(path)); return;
  }
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unknown checkpoint successor; do not discard it');
  renameSync(candidate, path); syncDirectory(dirname(path));
}
function saveCheckpoint(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'Recover the pending atomic successor first');
  const text = encodeCheckpoint({ ...payload, predecessorSha256 }); durableCreate(`${path}.next`, text);
  renameSync(`${path}.next`, path); syncDirectory(dirname(path)); return decodeCheckpoint(text);
}
function replaceDerived(path, value) {
  const temporary = `${path}.derived-next`, fd = openSync(temporary, 'w');
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path); syncDirectory(dirname(path));
}
export function verifyCheckpoint(payload, freeze, initialStateSha256) {
  assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.historySha256, HISTORY_SHA256); assert.equal(payload.prefixSha256, PREFIX_SHA256);
  assert.equal(payload.freezeSha256, freeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  let priorState = initialStateSha256, priorPublic = payload.initialPublicSha256, priorRandom = payload.initialRandomSha256;
  let priorPolicy = stateHash(startingPolicy());
  for (const [index, row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, priorState);
    assert.equal(row.publicBeforeSha256, priorPublic); assert.equal(row.randomBeforeSha256, priorRandom);
    assert.equal(row.policyBeforeSha256, priorPolicy); assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore));
    assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    priorState = row.afterStateSha256; priorPublic = row.publicAfterSha256; priorRandom = row.randomAfterSha256; priorPolicy = row.policyAfterSha256;
  }
  assert.equal(priorState, payload.finalStateSha256); assert.equal(priorPublic, payload.publicStateSha256);
  assert.equal(priorRandom, stateHash(payload.state.random)); assert.equal(priorPolicy, stateHash(payload.policy));
  assert.equal(payload.policy.week, payload.state.week);
  if (payload.pending) {
    assert.equal(payload.pending.commandCount, payload.commandCount + 1);
    assert.equal(payload.pending.beforeStateSha256, payload.finalStateSha256);
    assert.equal(payload.pending.publicBeforeSha256, payload.publicStateSha256);
    assert.equal(payload.pending.policyBeforeSha256, stateHash(payload.policy));
    assert.deepEqual(payload.pending.intent, { type: 'PERFECTER', command: payload.pending.decision.action.command });
  }
}
function selectedBoundary(command, after, previous) {
 const first=key=>previous.some(item=>item.kind===key)?null:key;
 if(['LEARN_GUIDANCE','STABILIZE_PROMOTION','CONSUME','START_EPILOGUE'].includes(command.type))return command.type.toLowerCase();
 if(['WORK','NEXT_WEEK','TRAVEL','REST','CLINIC'].includes(command.type))return first(`first-${command.type.toLowerCase()}`);
 if(command.type==='WORKS'&&['WORKS_TRIAL','WORKS_VERIFY'].includes(command.command.type))return `${command.command.type.toLowerCase()}-${command.command.stationId.toLowerCase()}`;
 if(command.type==='MATERIAL'){
  const c=command.command;
  if(['COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED','BUY_COMPOUND','REQUEST_COMPOUND_REPAIR','RECEIVE_COMPOUND_REPAIR'].includes(c.type))return c.type.toLowerCase();
  if(c.type==='VERIFY_UNIQUENESS')return `uniqueness-${c.step.toLowerCase()}`;
  if(['MATERIAL_LABOUR','ACQUIRE_CHARACTERISTIC','ACQUIRE_UNIQUENESS'].includes(c.type))return first(`first-${c.type.toLowerCase()}`);
 }
 if(command.type==='EPILOGUE')return `actual-archive-${command.command.type.toLowerCase()}`;
 return null;
}
export function parseOptions(args) {
  const result = { out: null, resume: null, maxNewActions: POLICY.defaultObservationActions };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[++index]; assert(value !== undefined, `Missing value for ${flag}`);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--out') result.out = resolve(value);
    else if (flag === '--resume') result.resume = resolve(value);
    else if (flag === '--max-new-actions') { assert(/^\d+$/.test(value)); result.maxNewActions = Number(value); assert(Number.isSafeInteger(result.maxNewActions)); }
    else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resource or outcome overrides`);
  }
  if (result.resume) { assert(!result.out || result.out === dirname(result.resume), 'Resume retains its exact output directory'); result.out = dirname(result.resume); }
  return result;
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/perfecter-stage.mjs'), SELF, 'Run from the matching frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, freeze);
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/perfecter-02110-')); }
  for (const name of ['src', 'dist', 'scripts', 'tests', 'docs', 'node_modules', '.git'])
    assert(![join(root, name), join(root, name) + sep].some((prefix, index) => index ? options.out.startsWith(prefix) : options.out === prefix), 'Output cannot modify a source, runtime, fixture, or repository metadata tree');
  assert.notEqual(options.out, root); mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json'), freezePath = join(options.out, 'freeze.json');
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0;
  if (options.resume) {
    // Drift is rejected before adopting or executing any pending boundary.
    assert.deepEqual(JSON.parse(readFileSync(freezePath, 'utf8')), freeze, 'Frozen source/compiled/producer inputs changed; same-runtime resume rejected');
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath, 'utf8'));
    verifyCheckpoint(saved.payload, freeze, initialHash);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert(!existsSync(checkpointPath) && !existsSync(`${checkpointPath}.next`) && !existsSync(freezePath), 'Refuse to overwrite a capture; use --resume');
    const view = runtime.projectSliceState(initial).perfecter;
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    durableCreate(join(options.out, 'prefix-original797.json'), JSON.stringify({ source: SOURCE, sourceSha256: SOURCE_SHA256,
      history: HISTORY, historySha256: HISTORY_SHA256, prefixCount: PREFIX_COUNT, prefixSha256: PREFIX_SHA256,
      commands: old.commands, initial: old.initial, final: old.source, historicalPrefixReplayedHere: false, original797AliveHistoryRetained: true }));
    syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, historySha256: HISTORY_SHA256,
      prefixSha256: PREFIX_SHA256, freezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
      createdAt: new Date().toISOString(), commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
      initialStateSha256: initialHash, finalStateSha256: initialHash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
      initialRandomSha256: stateHash(initial.random), pending: null, terminal: null }, null);
  }
  try {
    if (saved.payload.state.perfecter.guidanceKnown) session = runtime.openPerfecterRuntimeSession(saved.payload.state);
    const project = () => session ? session.projectPerfecter() : runtime.projectSliceState(saved.payload.state).perfecter;
    assert.equal(stateHash(project()), saved.payload.publicStateSha256, 'Reopened public boundary changed');
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    while (!stage) {
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      // A requested/default observation limit is a resumable operator pause. It
      // never creates death, closes an event or declares the strategy exhausted.
      if (!boundary.pending && count >= options.maxNewActions) { stage = 'MANUAL_PAUSE'; reason = 'Observation limit reached at a durable completed-action boundary; resume the same frozen policy'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const view = project(), decision = chooseAction(view, boundary.policy);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        pending = { commandCount: boundary.commandCount + 1, intent: { type: 'PERFECTER', command: clone(decision.action.command) }, decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), policyBeforeSha256: stateHash(boundary.policy), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const beforeView = project(), action = beforeView.actions.find(a => isDeepStrictEqual(a.command, pending.intent.command));
      assert(action?.enabled, `Exact pending action is unavailable: ${action?.reason ?? 'missing'}`);
      assert.deepEqual(action, pending.decision.action); assert.equal(stateHash(beforeView), pending.publicBeforeSha256);
      assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision, 'Pending command must remain the exact frozen public-policy selection');
      const before = saved.payload.state, started = performance.now(); let draft = null, next, after;
      if (session) {
        draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); after = session.projectDraftPerfecter(draft);
      } else {
        assert.deepEqual(pending.intent.command, { type: 'LEARN_GUIDANCE' });
        next = runtime.applySliceIntent(before, pending.intent); session = runtime.openPerfecterRuntimeSession(next); after = session.projectPerfecter();
      }
      assert.equal(next.revision, before.revision + 1); checkOriginals(next, old.source);
      const policy = advancePolicy(pending.decision, after); assert.equal(policy.week, next.week, 'Displayed committed travel time must equal the actual clock');
      if (next.perfecter.frame) assert.equal(policy.location, next.perfecter.frame.location, 'Committed public location must equal the actual location');
      const latest = next.perfecter.journal.at(-1), row = {
        commandCount: pending.commandCount, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
        reason: pending.decision.reason, publicLabel: action.label, publicCost: action.cost,
        startedAt: pending.startedAt, elapsedMilliseconds: Math.round(performance.now() - started), revision: next.revision, week: next.week,
        beforeStateSha256: pending.beforeStateSha256, afterStateSha256: stateHash(next),
        publicBeforeSha256: pending.publicBeforeSha256, publicAfterSha256: stateHash(after),
        randomBefore: clone(before.random), randomAfter: clone(next.random), randomBeforeSha256: stateHash(before.random), randomAfterSha256: stateHash(next.random),
        policyBeforeSha256: pending.policyBeforeSha256, policyAfterSha256: stateHash(policy),
        receipts: latest && latest.revision === next.revision ? { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) } : { checks: [], finance: [], notes: ['Actual guidance paid: 100 pennies and one action.'] },
      };
      const selected = selectedBoundary(pending.intent.command, after, saved.payload.boundaries), boundaries = [...saved.payload.boundaries];
      if (selected) {
        const file = `boundary-${pending.commandCount}-${selected}.json`, path = join(options.out, file);
        // Wall-clock timing may differ after a crash, but the prepared command,
        // state, public result, receipts and every hash must be identical.
        const bytes = JSON.stringify({ commandCount: pending.commandCount, beforeLast: before, lastIntent: pending.intent, final: next, public: after,
          audit: { ...row, elapsedMilliseconds: null } });
        if (existsSync(path)) assert.equal(readFileSync(path, 'utf8'), bytes, 'Existing selected boundary differs from the exact resumed draft');
        else { durableCreate(path, bytes); syncDirectory(options.out); }
        boundaries.push({ file, kind: selected, commandCount: pending.commandCount, ...fileEvidence(path) });
      }
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands, pending.intent], rows: [...saved.payload.rows, row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen bytes changed during capture');
    verifyCheckpoint(saved.payload, freeze, initialHash); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.perfecter.guidanceKnown) {
      const strict = runtime.openPerfecterRuntimeSession(saved.payload.state);
      assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256); assert.equal(stateHash(strict.projectPerfecter()), saved.payload.publicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE';
    if (!paused && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson'), saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json'), JSON.stringify({ provenance: { kind: 'EXACT_ORIGINAL_LIVING_ENLIGHTENER797_PUBLIC_PERFECTER_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA256, originalHistory: HISTORY, originalHistorySha256: HISTORY_SHA256,
      prefixCommandsSha256: PREFIX_SHA256, runtimeFreezeSha256: freeze.sha256, historicalPrefixReplayedByThisProducer: false,
      originalPrefixRetainedExactly: true, original797AliveHistoryUnchanged: true, privateAudit: true, seedChanged: false, randomOverridden: false,
      selectedFromEnabledPublicActionsOnly: true }, creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT,
      commands: [...old.commands, ...saved.payload.commands], initial: old.initial, prefixFinal: old.source, policy: POLICY,
      stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }));
    // Public summary excludes private RNG, input manifests and internal receipts.
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount,
      originalCommands: PREFIX_COUNT, newCommands: saved.payload.commands.length, week: saved.payload.policy.week, paused,
      strictFinalValidation: true, public: view }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused };
  } catch (error) {
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error),
      commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Keep the original error and every durable boundary. */ }
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
