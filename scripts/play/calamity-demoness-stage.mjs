import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

// Static candidate. Only the serial lead runs this after compiling the integrated domain:
// node --max-old-space-size=512 scripts/play/calamity-demoness-stage.mjs
// Run from the repository root. Recreate the original character, replay all 487
// public commands and prove full migrated equality BEFORE the first new command.
// One original seed, no cursor edits, reloads, retries for better luck or free heals.
// This producer writes a unique evidence directory, never authoritative fixtures.
const load = name => import(pathToFileURL(resolve(`dist/domain/${name}.js`)).href);
const { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await load('slice/index');
const { migrateSliceState } = await load('slice/migration');
const { validateSlicePayload } = await load('slice/validation');
const { projectCalamityDemoness } = await load('calamity-demoness/index');
const sourceFixture = 'tests/fixtures/unaging-demoness-v01530/natural.json';
const old = Object.fromEntries(['provenance', 'creation', 'seed', 'initial', 'commands', 'final'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const { creation, seed } = old, prefixCount = old.commands.length;
const provenance = { kind: 'SAME_SEED_PUBLIC_NATURAL_PREFIX', source: sourceFixture, newRandomChanges: false };
const continuation = {
  kind: 'NATURAL_UNAGING_DEMONESS_PREFIX_THEN_PUBLIC_CALAMITY_DEMONESS', sourceFixture,
  prefixStartingPoint: 'Original creation and seed; no directed startingState', exactPublicPrefixCommands: 487,
  sourceS3Setup: 'NATURAL', fullNaturalS9ToS2: true, newRandomChanges: false,
  policy: 'One natural public continuation. Actual60p clinic and later rest; bounded ordinary work/rest and at most12 independent bottles. Two one-shot ability cases with ordinary fallback and one withdrawal case without a cast; one optional fight using DEFEND/CONTROL/ATTACK cycle, permanent RETREAT at H<=40 or first new HEAVY, at most90 rounds. Preserve actual death or exhausted outcome; never rerun for success.',
};
const sourcePreservation = [{ file: sourceFixture, sha256: fileDigest(sourceFixture) }];
const CASES = ['mirror-screen', 'black-flame-channel', 'revoked-window'];
const NEW_IDS = ['assassin.s2.mirror-screen', 'assassin.s2.black-flame-channel'];
const OLD_ROOTS = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness'];
const MAX_COMMANDS = 3500, MAX_BOTTLES = 12, MAX_ROUNDS = 90;
const commands = [], boundaries = {}, boundarySteps = {}, snapshots = {}, treatments = [];
const capturedSteps = new Map(), uniqueTransitions = [], combatEvidence = [];
let s = null, initial = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
let legacy = null, attemptedState = null, retreatCommitted = false;
class ActualTerminalStop extends Error {}
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/calamity-demoness-01770-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public-compact.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => projectCalamityDemoness(s);
const root = () => s.calamityDemoness, life = () => root().life, encounter = () => root().encounter;
const attempt = id => life().cases[id].attempts.at(-1) ?? null;
const success = tier => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function compact() {
  const p = view(), a = p.life.currentAttempt, site = encounter().currentSite ?? life().site;
  const round = s.combat?.lastRound ?? s.lastCombatRound, result = round?.calamityDemonessOutcome;
  return { revision: s.revision, week: s.week, date: s.date, status: s.status, H: s.health, M: s.mind, S: s.spirituality,
    pollution: s.seer.pollution, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting,
    activeEvent: s.activeEvent?.instanceId ?? null, injuryRisk: s.injuryRisk, injuries: s.injuries,
    life: { activeCase: life().activeCase, location: site.playerLocation, energy: site.playerEnergy, travelMetres: site.playerTravelMetres, clockSeconds: site.clockSeconds,
      tier: a?.abilityTier ?? null, applied: a?.appliedAbilityIds ?? [], mirrorA: site.mirrorA, mirrorB: site.mirrorB,
      plates: site.plates, load: site.load, box: site.box, residue: site.residue, screen: site.screen, adults: { vera: site.vera, marcus: site.marcus } },
    encounter: { status: p.encounter.status, enemy: p.encounter.enemy, plate: encounter().plate, lastRound: result ? {
      round: round.round, stance: round.stance, winner: round.winner, retreat: round.retreat, consequenceDomain: round.consequenceDomain,
      playerHealthAfter: result.playerHealthAfter, enemyHealth: result.enemyHealth, playerSpiritualityAfter: result.playerSpiritualityAfter,
      enemySpirituality: result.enemySpirituality, continuing: result.continuing, plateChargesAfter: result.plateChargesAfter, plateChargesSpent: result.plateChargesSpent,
      screenApplications: result.playerActions.filter(x => x.id === NEW_IDS[0]).map(x => ({ attempted: x.attempted, succeeded: x.succeeded,
        applied: x.applied, appliedAmount: x.appliedAmount, consumedByOrder: x.chargeConsumedByOrder, cancelledByOrder: x.chargeCancelledByOrder })),
      expiredScreenOrder: result.expiredScreenOrder, expiredGuardOrder: result.expiredGuardOrder } : null } };
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete original487-command natural prefix');
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  let name = capturedSteps.get(commands.length);
  if (!name) {
    name = `${unique}.json`; write(`${outputDir}/${name}`, { beforeLast, lastIntent, final: s });
    capturedSteps.set(commands.length, name);
    uniqueTransitions.push({ key: unique, file: name, commandIndex: commands.length, beforeRevision: beforeLast.revision, afterRevision: s.revision });
  }
  boundaries[unique] = name; boundarySteps[unique] = commands.length;
}
function go(intent, boundary = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Finite public strategy exhausted; retain actual state and pending command');
  if (prefixVerified && intent.type === 'ACTION') {
    const p = pub(); assert(p.canAct, p.actionBlockedReason ?? 'Ordinary world action unavailable');
    assert(!view().insideCase && !s.combat, 'Never perform world WORK/REST inside a locked current scene');
    if (intent.action === 'INVESTIGATE') assert(p.investigateTargets.some(t => t.id === intent.targetId), `Missing public investigation ${intent.targetId}`);
  }
  if (prefixVerified && intent.type === 'EVENT_CHOICE') {
    const event = pub().activeEvent;
    assert(event && s.activeEvent.instanceId === intent.eventInstanceId, 'Only the actual current public event may be chosen');
    assert(event.choices.some(c => c.id === intent.choiceId && c.enabled), `Disabled public event choice ${event.id}/${intent.choiceId}`);
  }
  if (prefixVerified && intent.type === 'COMBAT_ROUND') assert(pub().combat?.stances.some(stance => stance.id === intent.stance), `Missing public combat stance ${intent.stance}`);
  beforeLast = s; lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent); attemptedState = next; assertValidSliceState(next);
  assert.equal(next.random.seed, seed); assert(next.random.cursor >= s.random.cursor); assert.equal(next.revision, s.revision + 1);
  s = next; commands.push(structuredClone(intent)); pendingIntent = null; attemptedState = null;
  append(commandsFile, { index: commands.length, prefix: !prefixVerified, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision, randomBefore: beforeLast.random, randomAfter: s.random });
  if (prefixVerified) {
    const record = { index: commands.length, intent, public: compact() }; append(publicFile, record);
    if (boundary) capture(boundary);
    if (boundary || intent.type === 'ACTION' || intent.type === 'COMBAT_ROUND') console.log(JSON.stringify(record));
  }
}
function cd(command, boundary = null) {
  pendingIntent = { type: 'CALAMITY_DEMONESS', command: structuredClone(command) };
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a current public CALAMITY_DEMONESS action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'CALAMITY_DEMONESS', command }, boundary);
}
function clear() {
  if (s.status === 'DEAD') return;
  for (let count = 0; s.activeEvent && count < 30; count++) {
    const event = pub().activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline' : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE' : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? 'PAY' : event.id === 'CARE-WORK-OFFER' ? 'DECLINE' : null;
    assert(choiceId, `Unexpected current public event ${event.id}; preserve its actual pending choices`);
    assert(event.choices.some(c => c.id === choiceId && c.enabled), `Unavailable public choice ${event.id}/${choiceId}`);
    const before = event.id === 'LIFE-CARE-01' ? { cash: s.cash, health: s.health, risk: s.injuryRisk, week: s.week, revision: s.revision, injuries: structuredClone(s.injuries) } : null;
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, before ? 'clinic-actual-pay60' : null);
    if (before) {
      assert(s.cash <= before.cash - 60, 'Actual treatment fee and weekly charges remain paid');
      assert.equal(s.health, before.health, 'Paying the doctor does not heal the body'); assert.equal(s.injuryRisk, before.risk);
      for (const injury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const treated = s.injuries.find(i => i.id === injury.id); assert(treated, 'Original wound remains immediately after treatment');
        assert.equal(treated.treatedRevision, before.revision + 1); assert.equal(treated.acquiredRevision, injury.acquiredRevision);
      }
      treatments.push({ paidPennies: 60, before, cashAfter: s.cash, healthAfter: s.health, injuriesAfter: structuredClone(s.injuries) }); assertLegacyPreserved();
    }
    if (s.status === 'DEAD') return;
  }
  assert.equal(s.activeEvent, null, 'Actual shared event chain still pending'); assert.equal(s.pulse, 'NONE');
}
function requireAlive() { if (s.status === 'DEAD') throw new ActualTerminalStop('Actual natural death preserved without rerun'); assert.equal(s.status, 'ACTIVE'); }
function ordinary(boundary = null, forceRest = false) {
  clear(); requireAlive(); assert(!s.combat && !view().insideCase, 'No world rest while a real scene is locked');
  assert(s.actionsRemaining > 0, 'No ordinary AP or unresolved weekly settlement');
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, boundary); clear(); requireAlive();
}
function ready({ cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  clear(); requireAlive(); assert(ap <= s.weeklyBudget, `Need ${ap} AP but actual weekly budget is ${s.weeklyBudget}`);
  let count = 0;
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) {
    assert(count++ < 1000, 'Finite ordinary work/rest preparation exhausted'); ordinary();
  }
}
function action(command, boundary = null) { ready(); cd(command, boundary); clear(); requireAlive(); }
function assertLegacyPreserved() {
  assert(legacy, 'Original natural prefix must be verified first'); assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed);
  for (const field of ['name', 'gender', 'age']) assert.equal(s.character[field], old.final.character[field], `Original player ${field}`);
  assert.equal(s.progression.promotionWeek, old.final.progression.promotionWeek, 'Original earliest promotion date remains history');
  for (const key of OLD_ROOTS) assert.deepEqual(s[key], legacy[key], `Keep every original ${key} history/person/object fact`);
  assert.deepEqual(s.combatHistory.slice(0, old.final.combatHistory.length), old.final.combatHistory, 'Original combat and consequences remain history');
  assert.deepEqual(s.seer.completedSources.slice(0, old.final.seer.completedSources.length), old.final.seer.completedSources);
  for (const [id, mastery] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Original mastery ${id}`);
  assert.equal(Object.keys(s.progression.mastery).length, s.progression.sequence === 2 ? 18 : 16);
  assert.equal(s.unagingDemoness.encounter.enemyStatus, 'SURRENDERED'); assert.equal(s.unagingDemoness.encounter.targetId, 'UD3-CORBIN');
  assert.equal(s.unagingDemoness.life.mirrorA.id, 'UD3-MIRROR-A'); assert.equal(s.unagingDemoness.life.mirrorB.id, 'UD3-MIRROR-B');
  if (life().site.source) {
    const original = old.final.unagingDemoness.life;
    assert.deepEqual(life().site.source.snapshot, Object.fromEntries(['siteId', 'vera', 'marcus', 'mirrorA', 'mirrorB', 'playerLocation', 'playerTravelMetres', 'clockSeconds', 'entry', 'shutter'].map(k => [k, original[k]])));
    assert.deepEqual(life().site.mirrorA, original.mirrorA); assert.deepEqual(life().site.mirrorB, original.mirrorB);
    for (const actor of ['vera', 'marcus']) for (const field of ['id', 'name', 'age', 'alive']) assert.deepEqual(life().site[actor][field], original[actor][field]);
    for (const key of ['portrait', 'parcel', 'register']) assert.equal(Object.hasOwn(life().site, key), false, 'No duplicate inherited artifact');
  }
}
function recoverOriginalInjury() {
  assert.equal(s.health, 70); assert.equal(s.injuryRisk, 0); assert.equal(s.careKnown, false); assert.equal(s.injuries.length, 1);
  assert.equal(s.injuries[0].severity, 'HEAVY'); assert.equal(s.injuries[0].treatedRevision, null);
  ready({ cash: 60, ap: 2 }); const before = { health: s.health, cash: s.cash, injuries: structuredClone(s.injuries) };
  go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'clinic-actual-discovery');
  assert.equal(s.careKnown, true); assert.equal(s.health, before.health); assert.equal(s.cash, before.cash); assert.deepEqual(s.injuries, before.injuries); clear();
  let count = 0;
  while (s.injuries.length) {
    assert(count++ < 20, 'Actual treatment/recovery did not finish; never remove the original wound manually');
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    ready({ cash: untreated ? 60 : 0 }); ordinary(untreated ? 'clinic-invitation-actual-rest' : 'treated-original-wound-subsequent-rest', true);
  }
  assert.equal(treatments.length, 1); assert.equal(treatments[0].before.injuries.length, 1); assert.equal(s.injuryRisk, 0); assert(s.health >= 80);
  assertLegacyPreserved(); capture('clinic-original-heavy-healed');
}

function practice(caseId) {
  ready({cash:20,ap:2,health:100,mind:100,spirituality:12,pollution:0});
  cd({type:'OBSERVE',caseId},`${caseId}-observe-original-site`);
  if(caseId===CASES[0]){cd({type:'ARRIVE_VERA',caseId},'original-vera-walk-two-metres');cd({type:'ARRIVE_MARCUS',caseId},'original-marcus-walk-twenty-four-metres');}
  clear();ready({cash:20,ap:2,health:100,mind:100,spirituality:12,pollution:0});
  const step=(type,key=null)=>cd({type,caseId},key),walk=(to,key=null)=>cd({type:'WALK',caseId,to},key);
  step('CONSENT_OPERATOR');step('CONSENT_OWNER',`${caseId}-current-consents`);
  const budget={cash:s.cash,ap:s.actionsRemaining};cd({type:'PREPARE',caseId,method:'ABILITY'},`${caseId}-paid-original-plate`);
  assert.equal(s.cash,budget.cash-20);assert.equal(s.actionsRemaining,budget.ap-1);
  if(caseId==='mirror-screen'){
    walk('A');step('INSTALL_PLATE','mirror-original-insert-installed');
    const before={S:s.spirituality,cursor:s.random.cursor};step('SCREEN_MIRROR','mirror-paid-six-actual-check');assert.equal(s.spirituality,before.S-6);assert.equal(s.random.cursor,before.cursor+1);
    const applied=success(attempt(caseId).abilityTier);step('APPLY_LOAD',applied?'mirror-real-buffer-five':'mirror-failed-ordinary-load');
    assert.equal(life().site.load.remainingLoads,0);assert.equal(life().site.load.bufferedForce,applied?5:0);assert.equal(life().site.load.finalForce,applied?7:12);
    step('REMOVE_PLATE');walk('ENTRY');
  }else if(caseId==='black-flame-channel'){
    step('MOVE_ADULTS_OUTSIDE','both-original-adults-actual-clearance');walk('BOX');step('INSTALL_PLATE','original-residue-placed-in-box');step('CLOSE_BOX');
    const before={S:s.spirituality,cursor:s.random.cursor};step('CHANNEL_BLACK_FLAME','flame-paid-six-single-check');assert.equal(s.spirituality,before.S-6);assert.equal(s.random.cursor,before.cursor+1);
    const applied=success(attempt(caseId).abilityTier);assert.equal(life().site.residue.status,applied?'CONSUMED':'CONTAINED');
    if(!applied)step('COLLECT_RESIDUE','failed-flame-original-sealed-residue-collected');
    step('REMOVE_PLATE');walk('ENTRY');step('RETURN_ADULTS','same-adults-return-two-metres');
    if(!applied)step('SEALED_HANDOVER','original-residue-handed-to-original-custodian');
    assert.equal(life().site.residue.status,applied?'CONSUMED':'HANDED_OVER');
  }else{
    const cursor=s.random.cursor,S=s.spirituality;step('WITHDRAW_PERMISSION','actual-owner-withdrawal');step('STOP');walk('A');step('ORDINARY_ROUTE','actual-eight-metre-ordinary-route');step('RETURN_ROUTE');walk('ENTRY');
    assert.equal(s.random.cursor,cursor);assert.equal(s.spirituality,S);assert.equal(attempt(caseId).abilityTier,null);
  }
  step('RETURN_PLATE',`${caseId}-actual-original-insert-return`);step('INSPECT');step('LEAVE',`${caseId}-actual-ordinary-close`);clear();
  const previous={...s.progression.mastery};action({type:'REPORT',caseId},`${caseId}-report-actual-application`);
  for(const id of NEW_IDS)assert.equal(s.progression.mastery[id],previous[id]+(attempt(caseId).appliedAbilityIds.includes(id)?8:0));
  assertLegacyPreserved();assert.equal(life().site.playerLocation,'ENTRY');
}
function recordCombatEvidence(){
 const r=s.lastCombatRound,o=r.calamityDemonessOutcome;assert(o);assert.equal(r.consequenceDomain,'BODY');assert.equal(o.source.targetId,'CD2-IRIS');
 assert.equal(o.source.randomSeed,seed);assert.equal(o.source.randomCursor,beforeLast.random.cursor);
 assert.equal(o.playerSpiritualityAfter,o.playerSpiritualityBefore-o.playerActions.reduce((n,a)=>n+a.paidCost,0));
 assert.equal(o.enemySpirituality,o.enemySpiritualityBefore-o.enemyActions.reduce((n,a)=>n+a.paidCost,0));
 const screens=o.playerActions.filter(a=>a.id===NEW_IDS[0]),flames=o.playerActions.filter(a=>a.id===NEW_IDS[1]);
 for(const a of screens){if(a.chargeConsumedByOrder!==null){const hit=o.enemyActions.find(x=>x.order===a.chargeConsumedByOrder);assert(hit&&hit.order>a.order&&hit.attackKind==='BODY');assert.equal(a.appliedAmount,45);}else assert.equal(a.appliedAmount,0);}
 if(r.stance==='DEFEND')for(const a of o.playerActions)assert.equal(a.threatens,false);
 combatEvidence.push({round:r.round,stance:r.stance,winner:r.winner,retreat:r.retreat,continuing:o.continuing,playerH:o.playerHealthAfter,playerS:o.playerSpiritualityAfter,enemyH:o.enemyHealth,enemyS:o.enemySpirituality,plateChargesSpent:o.plateChargesSpent,plateChargesAfter:o.plateChargesAfter,screenReduction:screens.reduce((n,a)=>n+a.appliedAmount,0),screenApplications:screens.filter(a=>a.applied).length,flameAdvantage:flames.reduce((n,a)=>n+a.appliedAmount,0),flameApplications:flames.filter(a=>a.applied).length,consequenceWeights:r.consequenceWeights,consequenceRoll:r.consequenceRoll});
}
function appendFileBytes(destination, source) {
  const fd = openSync(source, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; appendFileSync(destination, buffer.subarray(0, count)); } } finally { closeSync(fd); }
}
function writeNatural(stage, error = null) {
  const path = `${outputDir}/${error ? 'blocker' : 'natural'}.json`;
  writeFileSync(path, '{', { flag: 'wx' }); let first = true;
  const property = (key, value, file = null) => { appendFileSync(path, `${first ? '' : ','}${JSON.stringify(key)}:`); first = false; if (file) appendFileBytes(path, file); else appendFileSync(path, JSON.stringify(value)); };
  for (const [key, value] of Object.entries({ provenance, continuation, creation, seed, initial, commands, prefixCount, stage,
    sourceFixture, sourcePreservation, prefixVerified })) property(key, value);
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart']) property(key, null, snapshots[key] ?? null);
  property('beforeLast', beforeLast); property('lastIntent', lastIntent); property('final', s); property('treatments', treatments); property('combatEvidence', combatEvidence);
  property('boundaryIndex', 'boundaries.index.json'); property('uniqueTransitions', 'boundaries.unique.json');
  if (error) { property('pendingIntent', pendingIntent); property('attemptedState', attemptedState); property('error', String(error)); property('stack', error.stack ?? null); }
  appendFileSync(path, '}'); return path;
}
function writeIndices(prefix = '') {
  write(`${outputDir}/${prefix}boundaries.index.json`, boundaries); write(`${outputDir}/${prefix}boundaries.steps.json`, boundarySteps);
  write(`${outputDir}/${prefix}boundaries.unique.json`, uniqueTransitions);
}

function save(stage){
 const naturalPath=writeNatural(stage);writeIndices();
 const summary={passed:true,stage,outputDir,naturalPath,provenance,continuation,prefixVerified,prefixCount,commands:commands.length,week:s.week,status:s.status,sequence:s.progression.sequence,health:s.health,mind:s.mind,spirituality:s.spirituality,cash:s.cash,actionsRemaining:s.actionsRemaining,acting:s.progression.acting,injuries:s.injuries,injuryRisk:s.injuryRisk,random:s.random,mastery:s.progression.mastery,treatments,bottles:root().bottles,lifeActuals:{load:life().site.load,residue:life().site.residue,box:life().site.box,plates:life().site.plates,energy:life().site.playerEnergy,travelMetres:life().site.playerTravelMetres},encounter:encounter(),combatEvidence,boundaries:Object.keys(boundaries).length,uniqueBoundaries:uniqueTransitions.length};
 write(`${outputDir}/summary.json`,summary);console.log(JSON.stringify(summary));
}
try {
 assert.equal(prefixCount,487);s=createSliceRun(old.final.runId,creation,seed);initial=s;assert.deepEqual(s,migrateSliceState(old.initial));assertValidSliceState(s);
 for(const command of old.commands)go(command);
 assert.deepEqual(s,migrateSliceState(old.final),'Entire original487 natural final must match');assert.equal(s.random.cursor,177);
 prefixVerified=true;legacy=Object.fromEntries(OLD_ROOTS.map(k=>[k,structuredClone(old.final[k])]));snapshot('departureStart');capture('inherited-full-487-natural-final');assertLegacyPreserved();
 recoverOriginalInjury();ready({cash:500,ap:2});snapshot('guidanceStart');const cash=s.cash;cd({type:'LEARN_GUIDANCE'},'guidance-paid500');assert.equal(s.cash,cash-500);clear();
 for(const taskId of ['TRACE_ORIGINAL_MIRRORS','PLAN_CONTAINMENT','CHECK_RETURN'])action({type:'PREPARE_TASK',taskId},`professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.calamityDemoness.bottles.find(b => b.status === 'PLAYER') ?? s.calamityDemoness.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      const length = s.calamityDemoness.bottles.length; action({ type: 'REQUEST_SUPPLY' }, 'request-independent-new-batch');
      const requestedWeek = s.calamityDemoness.resupply.requestedWeek; assert.notEqual(requestedWeek, null); assert.equal(s.calamityDemoness.bottles.length, length);
      ready({ afterWeek: requestedWeek }); cd({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-new-batch');
      assert.equal(s.calamityDemoness.bottles.length, length + 3); assert(s.week > requestedWeek);
      bottle = s.calamityDemoness.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'An independent original bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.calamityDemoness.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const fifth = s.calamityDemoness.bottles.find(b => b.id === bottleId).labourSteps === 4;
        action({ type: 'POTION_WORK', bottleId }, fifth ? `${bottleId}-fifth-real-labour` : null);
      }
      ready({ cash: 1040 }); const cash = s.cash; cd({ type: 'BUY_POTION', bottleId }, `${bottleId}-independent-purchase900`);
      assert.equal(s.cash, cash - 900);
    }
    ready({ cash: 140, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.unagingDemoness.promotionWeek + 11 });
    assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); assert.equal(s.progression.acting, 100);
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    cd({ type: 'PREPARE_PROMOTION' }, `${bottleId}-actual-current-week-preparation140`);
    assert.equal(s.cash, prep.cash - 140); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    assert.equal(s.calamityDemoness.preparedWeek, s.week); assert.equal(s.calamityDemoness.bottles.find(b => b.id === bottleId).labourSteps, 5);
    if (!boundaries['consume-ready']) capture('consume-ready');
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), H: s.health, M: s.mind, S: s.spirituality,
      pollution: s.seer.pollution, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
    cd({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'actual-promotion' : `${bottleId}-actual-potion-failure`);
    const used = s.calamityDemoness.bottles.find(b => b.id === bottleId);
    assert.equal(used.status, 'CONSUMED'); assert.equal(used.preparationWeek, prep.week); assert.equal(used.consumedWeek, prep.week); assert.equal(s.calamityDemoness.preparedWeek, null);
    assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.S); assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[used.outcome]; assert(costs);
    assert.equal(s.health, Math.max(1, before.H - costs[0])); assert.equal(s.mind, Math.max(1, before.M - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], Math.min(500, stat + (s.progression.sequence === 2 ? 1 : 0)));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite real bottle allowance exhausted; keep failures rather than force promotion');
  assert.equal(s.calamityDemoness.unagingDemonessActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');

 for(const caseId of CASES)practice(caseId);
 action({type:'REFLECT'},'all-three-actual-cases-reflected');assert.equal(s.progression.acting,100);assertLegacyPreserved();snapshot('practiced');
 ready({cash:20,ap:2,health:100,mind:100,spirituality:120,pollution:0});assert.equal(s.injuries.length,0);const closed=structuredClone(life().site),encounterCash=s.cash;
 cd({type:'PREPARE_ENCOUNTER'},'actual-paid-twenty-three-charge-plate');assert.equal(s.cash,encounterCash-20);assert.equal(encounter().plate.charges,3);
 cd({type:'ENCOUNTER_TALK'},'original-adults-clear-and-player-walk-yard');assert.deepEqual(encounter().startSite,closed);assert.equal(encounter().currentSite.playerLocation,'YARD');
 for(const actor of ['vera','marcus']){assert.equal(encounter().currentSite[actor].location,'OUTSIDE');assert.equal(encounter().currentSite[actor].travelMetres,closed[actor].travelMetres+2);}
 cd({type:'ENCOUNTER_FIGHT'},'independent-iris-optional-fight');snapshot('combatStart');const mastery=structuredClone(s.progression.mastery),oldInjuries=new Set(s.injuries.map(i=>i.id));
 for(let n=0;s.combat&&n<MAX_ROUNDS;n++){
  retreatCommitted ||= s.health<=40||s.injuries.some(i=>i.severity==='HEAVY'&&!oldInjuries.has(i.id));
  go({type:'COMBAT_ROUND',stance:retreatCommitted?'RETREAT':['DEFEND','CONTROL','ATTACK'][n%3]},`combat-round-${n+1}`);recordCombatEvidence();
  if(s.lastCombatRound.consequenceWeights&&!boundaries['combat-body-consequence'])capture('combat-body-consequence');
  assertLegacyPreserved();assert.deepEqual(s.progression.mastery,mastery);assert.deepEqual(life().site,closed);
  if(!s.combat)capture('combat-terminal');
 }
 assert.equal(s.combat,null,'Actual unresolved finite combat retained');assert(encounter().terminal);
 if(s.status==='ACTIVE'){assert.equal(encounter().currentSite.playerLocation,'OUTSIDE');assert.equal(encounter().terminal.exitMetres,2);ordinary('ordinary-life-after-actual-exit');}
 else{assert.equal(s.status,'DEAD');assert.equal(s.health,0);assert.equal(encounter().currentSite.playerLocation,'YARD');}
 assertLegacyPreserved();for(const x of sourcePreservation)assert.equal(fileDigest(x.file),x.sha256);
 save(s.status==='ACTIVE'?'NATURAL_CALAMITY_DEMONESS_CONTINUATION':'NATURAL_CALAMITY_DEMONESS_ACTUAL_COMBAT_DEATH');
}catch(error){
 if(error instanceof ActualTerminalStop){save('NATURAL_ACTUAL_TERMINAL_BEFORE_COMPLETION');}
 else{const blocker=writeNatural('ACTUAL_BLOCKER',error);writeIndices('blocker.');console.error(JSON.stringify({passed:false,outputDir,blocker,commands:commands.length,prefixVerified,pendingIntent,error:String(error)}));throw error;}
}
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
}
// Streaming top-level entry reader: skipped historical snapshot trees are never
// retained or parsed. StringDecoder preserves UTF-8 across 64KiB chunks.
function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START';
  let key = '', selected = false, quoted = false, escaped = false, depth = 0;
  let kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      const text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected a top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON object entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected a JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
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
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) {
            if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); }
            phase = 'AFTER'; selected = false; captureStart = -1;
          }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON object entry: ${wanted}`);
}
