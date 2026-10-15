import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } from '../../dist/domain/slice/index.js';
import { migrateSliceState } from '../../dist/domain/slice/migration.js';

// Integration candidate; copy to scripts/play only after the mechanics are frozen.
// Run from the repository root, against its corresponding fresh dist build.
// No alternate seed, selected random cursor, edited resource, fabricated original,
// checkpoint reload, or retry-from-save is used. This script is one finite policy.
// Every new intent is copied from the exact currently enabled public root action.
// The 1,038 old intents are first replayed, including their actual old failures.
const resumePath = process.argv.includes('--resume') ? process.argv[process.argv.indexOf('--resume') + 1] : null;
const beforePath = process.argv.includes('--before') ? process.argv[process.argv.indexOf('--before') + 1] : null;
const source = 'tests/fixtures/miracle-worker-v01640/continuation.json';
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(k => [k, readObjectEntry(source, k)]));
const sourceHash = fileDigest(source), prefixCount = 1038;
const MAX_NEW_COMMANDS = 6000, MAX_POTION_ATTEMPTS = 12;
const commands = [], boundaries = {}, controlOutcomes = [], potionOutcomes = [];
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/attendant-mysteries-01860-');
const write = (name, value) => writeFileSync(`${outputDir}/${name}`, JSON.stringify(value), { flag: 'wx' });
const rootNames = ['clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar', 'miracleWorker'];
const lots = ['timber-stack-1', 'stone-stack-1', 'grain-sacks-1', 'herb-box-1', 'ore-crate-1', 'post-case-1'];
const lotPrices = [96, 48, 36, 24, 36, 24];
const sites = ['quarry', 'reed-cave', 'ash-grove', 'salt-vault', 'rain-ruin', 'hollow-bank'];
const facilities = ['mill', 'bakery', 'workshop', 'clinic', 'post', 'market'];
const phases = ['reserve-phase-3', 'reserve-phase-4'];
const visitors = ['merchant-ada', 'weaver-iven', 'courier-neri'];
const firstPlot = 'new-alder-clearing';
let s = createSliceRun(old.final.runId, old.creation, old.seed);
const initial = structuredClone(s);
let original = null, prefixVerified = false, beforeLast = null, lastIntent = null, pendingIntent = null;
let phase = 'REPLAY_ORIGINAL_1038';
const view = () => projectSliceState(s).attendantMysteries;
const town = () => { assert(s.attendantMysteries.town, 'Guidance must create the actual empty town ledger'); return s.attendantMysteries.town; };
const person = id => { const o = town().originals.find(o => o.id === id); assert(o, `Missing original ${id}`); return o; };
const role = id => { const r = town().roles.find(r => r.id === id); assert(r, `Missing role ${id}`); return r; };
const dead = o => o.status === 'DEAD' || o.status === 'INERT';
const budget = () => ({ revision: s.revision, week: s.week, date: s.date, status: s.status, H: s.health, M: s.mind,
  S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  sequence: s.progression.sequence, acting: s.progression.acting, cursor: s.random.cursor });
class ActualTerminalStop extends Error {}
class FiniteOutcomeStop extends Error {}

function originalContinuity(full = false) {
  assert(original && prefixVerified);
  assert.equal(s.random.seed, old.seed, 'Never change the original seed');
  assert.equal(s.runId, original.runId);
  assert.equal(s.character.name, original.character.name);
  assert.equal(s.character.gender, original.character.gender);
  for (const [id, mastery] of Object.entries(original.progression.mastery))
    assert.equal(s.progression.mastery[id], mastery, `Do not erase, refill, or train old mastery ${id}`);
  if (full) {
    for (const key of rootNames) assert.deepEqual(s[key], original[key], `Preserve original ${key} history`);
    assert.deepEqual(s.seer.batches, original.seer.batches);
    assert.deepEqual(s.combatHistory, original.combatHistory);
    assert.deepEqual(s.miracleWorker.revival, original.miracleWorker.revival, 'No old revival is consumed or replenished');
  }
}
function capture(key) {
  if (!prefixVerified || !key || boundaries[key]) return;
  originalContinuity(true);
  const file = `boundary-${key.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`;
  // Only selected phase/conversion/potion boundaries retain full states.
  write(file, { phase, step: commands.length, beforeLast, lastIntent, final: s });
  boundaries[key] = file;
}
function go(intent, key = null, publicControl = null) {
  assert(commands.length < prefixCount + MAX_NEW_COMMANDS, 'Finite strategy command budget exhausted');
  if (prefixVerified) {
    assert.equal(intent.type, 'ATTENDANT_MYSTERIES', 'New play uses only the current public chapter controls');
    assert(publicControl?.enabled && isDeepStrictEqual(intent.command, publicControl.command));
  }
  pendingIntent = structuredClone(intent);
  const before = budget(); beforeLast = s; lastIntent = structuredClone(intent);
  s = applySliceIntent(s, intent);
  commands.push(structuredClone(intent));
  // Record the actual applied result even if strict save validation discovers a blocker.
  appendFileSync(`${outputDir}/commands.jsonl`, JSON.stringify({ step: commands.length,
    origin: prefixVerified ? 'PUBLIC_CONTINUATION' : 'ORIGINAL_PREFIX_REPLAY', phase,
    intent, publicControl: publicControl ? { id: publicControl.id, label: publicControl.label, enabled: true, cost: publicControl.cost } : null,
    before, after: budget() }) + '\n');
  assertValidSliceState(s); pendingIntent = null;
  if (prefixVerified) { originalContinuity(); capture(key); }
  if (s.status !== 'ACTIVE' && prefixVerified) throw new ActualTerminalStop(`Actual terminal state: ${s.status}`);
}
function publicAction(command) {
  return view().actions.find(a => isDeepStrictEqual(a.command, command));
}
function act(command, key = null) {
  pendingIntent = { type: 'ATTENDANT_MYSTERIES', command: structuredClone(command) };
  const available = publicAction(command);
  assert(available, `No current public control: ${JSON.stringify(command)}`);
  assert(available.enabled, `${available.label}: ${available.reason}`);
  // Pass the projection's exact command object, rather than a reconstructed intent.
  go({ type: 'ATTENDANT_MYSTERIES', command: structuredClone(available.command) }, key, available);
}
function ta(command, key = null) { act({ type: 'TOWN', command }, key); }
function noUnplannedScene() {
  assert.equal(s.combat, null, 'Do not silently fight or reroll an unplanned encounter');
  assert.equal(s.activeEvent, null, 'Preserve any unplanned blocking event for manual inspection');
}
function returnBase() {
  if (!s.attendantMysteries.town) return;
  const initialControl = town().originals.find(o => o.status === 'INITIAL_CONTROL');
  if (initialControl) ta({ type: 'RELEASE_INITIAL', originalId: initialControl.id }, `released-${initialControl.id}-${s.week}`);
  assert.equal(s.attendantMysteries.preparation, null, 'Do not silently discard a prepared original bottle');
  if (town().operatorAt !== 'base') {
    const before = budget(), oldBodyLocations = town().originals.map(o => [o.id, o.bodyId, o.location, o.health]);
    ta({ type: 'TRAVEL', to: 'base' });
    assert.equal(s.actionsRemaining, before.AP, 'The actual return route is a zero-AP escape');
    assert.equal(s.cash, before.cash, 'The actual return route needs no cash');
    assert.deepEqual(town().originals.map(o => [o.id, o.bodyId, o.location, o.health]), oldBodyLocations, 'Returning does not teleport or heal the original residents');
  }
}
function enough({ ap = 1, cash = 0, health = 40, mind = 10, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  return s.actionsRemaining >= ap && s.cash >= cash + 32 && s.health >= health && s.mind >= mind &&
    s.spirituality >= spirituality && s.seer.pollution <= pollution && s.week > afterWeek;
}
function ready(needs = {}) {
  returnBase(); noUnplannedScene();
  assert((needs.ap ?? 1) <= 4, 'Split the actual excursion; reception grants four AP, never more');
  for (let count = 0; !enough(needs); count++) {
    assert(count < 1200, 'Finite reception preparation exhausted; preserve the current budget');
    if (s.actionsRemaining === 0) {
      // The public one-use emergency job only exists when cash < the next week's 24p.
      if (s.cash < 24) act({ type: 'RECEPTION_WORK' });
      else act({ type: 'RECEPTION_NEXT_WEEK' });
    } else if (s.cash < (needs.cash ?? 0) + 32) act({ type: 'RECEPTION_WORK' });
    else if (s.health < (needs.health ?? 40) || s.mind < (needs.mind ?? 10) ||
      s.spirituality < (needs.spirituality ?? 0) || s.seer.pollution > (needs.pollution ?? 100)) act({ type: 'RECEPTION_REST' });
    else act({ type: 'RECEPTION_WORK' }); // Spend actual AP for the required later week; earn its real wage.
    noUnplannedScene();
  }
}
function at(place, needs = {}) {
  noUnplannedScene();
  if (town().operatorAt === place && enough(needs)) return;
  if (place === 'base') { ready(needs); return; }
  ready({ ...needs, ap: (needs.ap ?? 1) + 1, cash: (needs.cash ?? 0) + 4 });
  ta({ type: 'TRAVEL', to: place });
  assert(enough(needs), 'The planned route must leave its real field budget intact');
}
function baseAction(command, needs = {}, key = null) { ready(needs); act(command, key); }

function buildOriginalFacilities() {
  phase = 'ORIGINAL_CART_GOODS_AND_SIX_FACILITIES';
  baseAction({ type: 'TOWN', command: { type: 'HIRE_CART' } }, { cash: 24 });
  for (let i = 0; i < lots.length; i++) {
    baseAction({ type: 'TOWN', command: { type: 'BUY_LOT', lotId: lots[i] } }, { cash: lotPrices[i] });
    assert.equal(Object.values(town().goods).reduce((a, b) => a + b, 0), 0, 'Goods bought at reception remain on the actual cart');
  }
  at(firstPlot, { ap: 1, cash: 24 });
  ta({ type: 'SURVEY_PLOT', plotId: firstPlot });
  ta({ type: 'UNLOAD_CART' }, 'original-cart-delivered-and-unloaded');
  for (const facilityId of facilities) {
    at(town().plot, { ap: 1, cash: 12 });
    ta({ type: 'BUILD', facilityId });
  }
  capture('six-original-facilities-built');
}
function acquireOriginal(id) {
  // At most four actual initial attempts per individual. A dead original stays dead.
  for (let attempts = 0; person(id).status === 'WILD'; attempts++) {
    assert(attempts < 4, 'Four failed attempts exhaust this living original');
    const old = person(id);
    at(old.location, { ap: 2, cash: 4, health: 40, mind: 10, spirituality: 14, afterWeek: old.attemptedWeek ?? -1 });
    ta({ type: 'BEGIN_CONTROL', originalId: id });
    const receipt = town().journal.at(-1), now = person(id);
    controlOutcomes.push({ id, week: s.week, status: now.status, health: now.health,
      control: structuredClone(now.controlHistory.at(-1)), die: receipt.host.die, cost: receipt.cost });
    if (now.status === 'INITIAL_CONTROL') {
      ta({ type: 'CONVERT', originalId: id, confirmedIrreversibleDeath: true },
        id === 'town-being-01' ? 'first-original-irreversible-conversion' : null);
      assert.equal(person(id).alive, false);
    }
  }
  if (dead(person(id))) { capture(`actual-original-loss-${id}`); return false; }
  assert.equal(person(id).status, 'CONTROLLED');
  if (!person(id).wormId) {
    at(person(id).location, { ap: 1, cash: 4, mind: 10, spirituality: 3 });
    ta({ type: 'ASSIGN_WORM', originalId: id });
  }
  if (person(id).location !== town().plot) {
    at(person(id).location, { ap: 1, cash: 4 });
    const body = person(id).bodyId, health = person(id).health;
    ta({ type: 'TRANSPORT', originalId: id });
    assert.equal(person(id).bodyId, body); assert.equal(person(id).health, health);
    assert.equal(person(id).location, town().plot);
  }
  return true;
}
function fillRole(roleId) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const currentId = role(roleId).currentOriginalId;
    if (!dead(person(currentId)) && acquireOriginal(currentId)) {
      if (!person(currentId).facility) ta({ type: 'STAFF', originalId: currentId, facilityId: role(roleId).facilityId });
      return;
    }
    let request = town().replacements.find(r => r.roleId === roleId && r.oldOriginalId === currentId &&
      (r.originalId === null || !dead(person(r.originalId))));
    if (!request) {
      ready({ ap: 1, cash: 48 });
      const offered = view().actions.find(a => a.enabled && a.command.type === 'TOWN' &&
        a.command.command.type === 'COMMISSION_REPLACEMENT' && a.command.command.roleId === roleId);
      if (!offered) throw new FiniteOutcomeStop(`The six real reserve sources cannot fill ${roleId}; preserve all actual deaths`);
      act(offered.command);
      request = town().replacements.at(-1);
    }
    const sourceId = request.sourceId;
    if (request.verifiedWeek === null) {
      at(sourceId, { ap: 1, cash: 48, afterWeek: request.commissionedWeek });
      ta({ type: 'VERIFY_REPLACEMENT', sourceId }, `independent-new-original-${sourceId}`);
    }
    const replacement = town().replacements.find(r => r.sourceId === sourceId).originalId;
    if (!acquireOriginal(replacement)) continue;
    const oldBody = structuredClone(person(currentId));
    ta({ type: 'OCCUPY_ROLE', roleId, originalId: replacement });
    ta({ type: 'STAFF', originalId: replacement, facilityId: role(roleId).facilityId });
    assert.deepEqual(person(currentId), oldBody, 'Vacancy substitution never overwrites or revives the old original');
    capture(`replacement-occupies-${roleId}`);
    return;
  }
  throw new FiniteOutcomeStop(`Finite independent replacement policy exhausted for ${roleId}`);
}
function acquireTwentyFour() {
  phase = 'TWENTY_FOUR_INDIVIDUAL_ORIGINALS';
  for (let i = 0; i < sites.length; i++) {
    const siteId = sites[i];
    at(siteId, { ap: 1, cash: 12 }); ta({ type: 'SURVEY_SITE', siteId });
    for (const r of town().roles.filter(r => r.facilityId === facilities[i])) fillRole(r.id);
    capture(`four-original-workers-${facilities[i]}`);
  }
  at(town().plot, { ap: 1, spirituality: 6 }); ta({ type: 'FOUND' }, 'actual-twenty-four-town-founded');
}
function currentFates() {
  const t = town(), ids = t.roles.map(r => r.currentOriginalId);
  return t.fates.filter(f => f.epoch === t.epoch && f.plot === t.plot && f.choice === 'FULFILL' &&
    f.week > t.proofSinceWeek && f.participants.every(id => ids.includes(id)));
}
function finishVisitorDepartures() {
  if (town().visitors.every(v => v.location === 'outside')) return;
  at(town().plot, { ap: 0 });
  for (const visitor of town().visitors.filter(v => v.location !== 'outside')) ta({ type: 'SEND_VISITOR_HOME', visitorId: visitor.id });
}
function startFiniteNewPhase() {
  finishVisitorDepartures();
  let p = town().phases.find(p => ['COMMISSIONED', 'LOADED', 'DELIVERED'].includes(p.status));
  if (!p) {
    const phaseId = phases.find(id => !town().phases.some(p => p.id === id));
    if (!phaseId) throw new FiniteOutcomeStop('Both independent later living phases are exhausted; preserve original events and goods');
    ready({ ap: 1, cash: 48 }); ta({ type: 'COMMISSION_PHASE', phaseId }); p = town().phases.at(-1);
  }
  const phaseId = p.id;
  if (p.status === 'COMMISSIONED') {
    ready({ ap: 1, cash: 96, afterWeek: p.commissionedWeek });
    ta({ type: 'VERIFY_PHASE_SUPPLY', phaseId }, `${phaseId}-original-supply-loaded`);
  }
  at(town().plot, { ap: 1 });
  if (town().phases.find(p => p.id === phaseId).status === 'LOADED') ta({ type: 'UNLOAD_CART' });
  ta({ type: 'START_PHASE', phaseId, confirmedAbandon: true }, `${phaseId}-actual-new-life-starts`);
}
function liveTwelveActualWeeks() {
  phase = 'CONNECTED_REAL_LIFE_WEEKS';
  for (let iteration = 0; currentFates().length < 12; iteration++) {
    assert(iteration < 48, 'Finite living-phase policy exhausted');
    for (const r of town().roles.filter(r => dead(person(r.currentOriginalId)))) fillRole(r.id);
    let p = town().phases.find(p => p.id === town().activePhaseId);
    const ids = town().roles.map(r => r.currentOriginalId);
    if (p.nextEvent >= p.limit || p.epoch !== town().epoch || !isDeepStrictEqual(p.roster, ids)) {
      startFiniteNewPhase(); p = town().phases.find(p => p.id === town().activePhaseId);
    }
    const afterWeek = Math.max(town().foundedWeek, p.activatedWeek, ...town().fates.map(f => f.week));
    at(town().plot, { ap: 1, cash: 10, spirituality: 4, afterWeek });
    ta({ type: 'LIVE_WEEK', eventIndex: p.nextEvent, choice: 'FULFILL' });
    assert.equal(town().fates.at(-1).choice, 'FULFILL');
    if ([6, 12].includes(currentFates().length)) capture(`actual-life-weeks-${currentFates().length}`);
  }
  assert(new Set(currentFates().map(f => f.week)).size >= 12, 'Elapsed weeks alone are never town proof');
  assert(town().roles.every(r => currentFates().some(f => f.participants.includes(r.currentOriginalId))));
}
function currentInteractions(visitorId, completed = true) {
  const t = town(), ids = t.roles.map(r => r.currentOriginalId);
  return t.interactions.filter(i => i.visitorId === visitorId && i.epoch === t.epoch && i.plot === t.plot &&
    i.week > t.proofSinceWeek && i.townOriginalIds.every(id => ids.includes(id)) && (!completed || i.completedWeek !== null));
}
function actualOutsideLinks() {
  phase = 'THREE_INDEPENDENT_ADULT_OUTSIDE_LINKS';
  for (const visitorId of visitors) {
    if (currentInteractions(visitorId).length) continue;
    if (!currentInteractions(visitorId, false).length) {
      at(town().plot, { ap: 2, cash: 3 });
      ta({ type: 'MEET_VISITOR', visitorId });
      const visitor = town().visitors.find(v => v.id === visitorId);
      assert(visitor.age >= 18 && visitor.alive && !visitor.controlled);
      if (visitor.consent?.status !== 'GRANTED') {
        ta({ type: 'SEND_VISITOR_HOME', visitorId });
        throw new FiniteOutcomeStop(`Actual outside visitor ${visitorId} refused the requested visit`);
      }
      ta({ type: 'EXCHANGE', visitorId });
      ta({ type: 'SEND_VISITOR_HOME', visitorId }, `${visitorId}-actual-return-journey`);
    }
    if (visitorId === 'courier-neri') {
      const exchange = currentInteractions(visitorId, false).find(i => i.completedWeek === null);
      if (exchange) {
        const letter = town().letters.find(l => l.id === exchange.letterId);
        at(town().plot, { ap: 0, afterWeek: letter.dueWeek - 1 });
        ta({ type: 'CONFIRM_DELIVERY', letterId: letter.id }, 'original-letter-delivered-next-week');
        assert.equal(town().letters.find(l => l.id === letter.id).holder, 'recipient');
      }
    }
    assert(currentInteractions(visitorId).length > 0, 'An actual completed external consequence is required');
  }
}
function formActualRegion() {
  liveTwelveActualWeeks(); actualOutsideLinks();
  phase = 'ACTUAL_NEW_SPIRIT_WORLD_REGION';
  at(town().plot, { ap: 1, spirituality: town().region ? 6 : 12 });
  ta({ type: town().region ? 'REVERIFY_REGION' : 'FORM_REGION' }, 'genuine-corresponding-region');
  assert(view().town.ready, 'The public region proof must be usable now');
}
function prepareNextOriginalBottle() {
  returnBase();
  let bottle = s.attendantMysteries.bottles.find(b => b.status === 'PREPARED');
  if (bottle) return bottle.id;
  let batch = s.attendantMysteries.batches.find(b => b.brewedWeek === null);
  if (!batch) {
    if (s.attendantMysteries.resupply.requestedWeek === null)
      baseAction({ type: 'REQUEST_SUPPLY' }, { cash: 120 }, `potion-resupply-${potionOutcomes.length}`);
    ready({ ap: 1, afterWeek: s.attendantMysteries.resupply.requestedWeek });
    act({ type: 'RECEIVE_SUPPLY' }, `later-week-new-potion-batch-${potionOutcomes.length}`);
    batch = s.attendantMysteries.batches.at(-1);
  }
  const batchId = batch.id;
  if (batch.acquiredWeek === null) {
    while (s.attendantMysteries.batches.find(b => b.id === batchId).labourSteps < 5)
      baseAction({ type: 'MATERIAL_WORK', batchId });
    ready({ cash: 1164 });
    const cash = s.cash;
    act({ type: 'BUY_MATERIALS', batchId }, `${batchId}-original-ten-ingredients`);
    assert.equal(cash - s.cash, 900, 'Five actual labour actions buy this original batch for the real 900p balance');
  }
  baseAction({ type: 'BREW', batchId }, { cash: 120 }, `${batchId}-actual-original-bottle`);
  bottle = s.attendantMysteries.bottles.find(b => b.batchId === batchId);
  assert(bottle && bottle.status === 'PREPARED');
  assert(s.attendantMysteries.batches.find(b => b.id === batchId).materials.every(m => m.holder === 'CONSUMED'));
  return bottle.id;
}
function promoteWithFiniteActualBottles() {
  phase = 'ORIGINAL_POTION_AND_REAL_REJECTION_RECOVERY';
  for (let attempt = 0; s.progression.sequence === 2 && attempt < MAX_POTION_ATTEMPTS; attempt++) {
    const bottleId = prepareNextOriginalBottle();
    // Rest/work happen at the actual base, not remotely while standing in town.
    ready({ ap: 2, cash: 144, health: 100, mind: 100, spirituality: 80, pollution: 0 });
    const sameTown = structuredClone(town()), oldRegionId = town().region.id;
    ta({ type: 'TRAVEL', to: town().plot });
    assert(view().town.ready, 'Ordinary return and potion failure do not erase real town history');
    act({ type: 'PREPARE_PROMOTION', bottleId }, `${bottleId}-actual-town-preparation`);
    act({ type: 'CONSUME', bottleId, confirmed: true }, `${bottleId}-actual-consumption-result`);
    const result = s.attendantMysteries.bottles.find(b => b.id === bottleId);
    potionOutcomes.push({ bottleId, week: s.week, outcome: result.outcome, regionId: result.regionId, after: budget() });
    assert.equal(result.status, 'CONSUMED'); assert.equal(result.regionId, oldRegionId);
    assert.deepEqual(town().originals, sameTown.originals, 'A potion outcome never replaces or heals a town body');
    assert.deepEqual(town().goods, sameTown.goods); assert.deepEqual(town().fates, sameTown.fates);
    assert.deepEqual(town().region, sameTown.region, 'The same town and same formed region survive actual rejection');
    if (s.progression.sequence === 2) returnBase();
  }
}
function completeOriginalLifeCases() {
  phase = 'THREE_REAL_S1_WORKSHOP_CASES';
  for (const [caseId, price, castType, appliedType, ordinaryType] of [
    ['lost-threads', 30, 'REGENERATE_THREADS', 'MOVE_FISH', 'MOVE_FISH_MANUALLY'],
    ['bounded-door', 24, 'GRAFT_DOOR', 'CROSS_GATE', 'WALK_OUTBOUND'],
    ['enclosed-realm', 12, 'CONCEAL_ROOM', 'CHECK_CONCEALMENT', 'CHECK_CONCEALMENT'],
  ]) {
    ready({ ap: 4, cash: price, health: 100, mind: 100, spirituality: 30, pollution: 0 });
    const step = type => act({ type, caseId });
    step('OBSERVE'); act({ type: 'PREPARE', caseId, method: 'ABILITY' });
    step('CONSENT'); step('CHECK_ORIGINALS'); step('SETUP');
    if (caseId === 'enclosed-realm') step('ENTER_ROOM');
    step(castType);
    step(publicAction({ type: appliedType, caseId })?.enabled ? appliedType : ordinaryType);
    if (caseId === 'enclosed-realm') step('VOLUNTEER_EXIT');
    step('STOP'); step('RETURN'); step('RETURN_ITEMS'); step('INSPECT'); step('CLOSE'); step('REPORT');
    capture(`actual-workshop-${caseId}`);
  }
  ready({ ap: 1 }); act({ type: 'REFLECT' }, 'actual-three-case-reflection');
}
function save(stage, error = null) {
  assert.equal(fileDigest(source), sourceHash, 'Never overwrite the authoritative source fixture');
  // A real integration-validation failure is itself evidence. Do not lose that
  // exact state merely because a continuity assertion is the failure being saved.
  let continuityError = null;
  if (prefixVerified) {
    try { originalContinuity(true); } catch (failure) { continuityError = String(failure); }
  }
  write('natural.json', { provenance: { kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION',
    source, sourceSha256: sourceHash, resumeSource: resumePath, resumeSha256: resumePath ? fileDigest(resumePath) : null, beforeSource: beforePath, beforeSha256: beforePath ? fileDigest(beforePath) : null, newRandomChanges: false, policy: 'FINITE_REAL_TOWN_AND_ORIGINAL_POTIONS',
    limits: { newCommands: MAX_NEW_COMMANDS, potionAttempts: MAX_POTION_ATTEMPTS, reserveIndividuals: 6, laterPhases: 2 } },
    creation: old.creation, seed: old.seed, prefixCount, prefixVerified, commands, initial,
    prefixFinal: original, boundaries, controlOutcomes, potionOutcomes, phase, stage,
    beforeLast, lastIntent, pendingIntent, error: error ? String(error) : null, continuityError, final: s });
  write('boundaries.index.json', boundaries);
  const t = s.attendantMysteries?.town;
  write('summary.json', { stage, phase, prefixCount, prefixVerified, commands: commands.length, newCommands: Math.max(0, commands.length - prefixCount),
    ...budget(), sourceSha256: sourceHash, originals: t?.originals.map(o => ({ id: o.id, bodyId: o.bodyId, status: o.status, alive: o.alive,
      health: o.health, location: o.location, wormId: o.wormId, workCount: o.workCount, fateCount: o.fateIds.length })),
    roles: t?.roles, boughtLots: t?.boughtLots, deliveredOriginalCargo: t?.cargoReceipts, phases: t?.phases,
    region: t?.region, retiredRegions: t?.retiredRegions, visitors: t?.visitors, interactions: t?.interactions,
    controlOutcomes, potionOutcomes, boundaries: Object.keys(boundaries), error: error ? String(error) : null, continuityError });
  console.log(JSON.stringify({ outputDir, stage, commands: commands.length, ...budget() }));
}

try {
  assert.equal(old.commands.length, prefixCount);
  assert.equal(old.final.status, 'ACTIVE');
  if (resumePath) {
    assert(beforePath, 'Resuming a captured live result requires its original one-intent pre-state');
    const prior = Object.fromEntries(['commands', 'final', 'prefixFinal', 'controlOutcomes', 'potionOutcomes'].map(k => [k, readObjectEntry(resumePath, k)]));
    assert.deepEqual(prior.commands.slice(0, prefixCount), old.commands);
    original = migrateSliceState(old.final); assert.deepEqual(prior.prefixFinal, original);
    beforeLast = migrateSliceState(readObjectEntry(beforePath, 'final')); lastIntent = prior.commands.at(-1);
    assertValidSliceState(beforeLast); assert.equal(beforeLast.status, 'ACTIVE');
    s = applySliceIntent(beforeLast, lastIntent); assertValidSliceState(s);
    assert.deepEqual(s, prior.final, 'Validation-only repair preserves exact applied state, costs, and RNG');
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.progression.sequence, 1);
    commands.push(...prior.commands); controlOutcomes.push(...prior.controlOutcomes);
    potionOutcomes.push(...s.attendantMysteries.bottles.filter(b => b.status === 'CONSUMED').map(b => ({ bottleId: b.id, week: b.consumedWeek, outcome: b.outcome, regionId: b.regionId })));
    prefixVerified = true; originalContinuity(true); phase = 'EXACT_ORIGINAL_CONSUMPTION_REVALIDATED';
    capture('same-original-successful-consumption-revalidated');
  } else {
  for (const intent of old.commands) go(intent);
  assert.deepEqual(commands, old.commands);
  assert.deepEqual(s, migrateSliceState(old.final), 'Complete creation/seed/1038-command replay equals the migrated original final');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.progression.sequence, 2);
  assert.equal(s.week, 15839); assert.equal(s.health, 100); assert.equal(s.mind, 99);
  assert.equal(s.spirituality, 108); assert.equal(s.cash, 358); assert.equal(s.actionsRemaining, 0);
  assert.equal(Object.keys(s.progression.mastery).length, 31);
  assert.equal(s.miracleWorker.revival.allowance, 4); assert.equal(s.miracleWorker.revival.used, 0);
  noUnplannedScene(); original = structuredClone(s); prefixVerified = true;
  capture('exact-original-1038-prefix');
  phase = 'REAL_RECEPTION_GUIDANCE_FUNDS';
  baseAction({ type: 'LEARN_GUIDANCE' }, { ap: 1, cash: 500, health: 100, mind: 100, spirituality: 40, pollution: 0 }, 'actual-paid-guidance');
  assert(town().originals.length === 24 && town().originals.every(o => o.alive && o.status === 'WILD'));
  buildOriginalFacilities(); acquireTwentyFour(); formActualRegion(); promoteWithFiniteActualBottles();
  }
  if (s.progression.sequence === 1) {
    for (const id of ['diviner.s1.thread-regeneration', 'diviner.s1.bounded-grafting', 'diviner.s1.mysterious-realm'])
      assert.equal(s.progression.mastery[id], 0, 'Promotion grants no practice mastery');
    capture('promoted-same-original-character-and-town');
    completeOriginalLifeCases();
    save('NATURAL_ATTENDANT_MYSTERIES_PROMOTED_MAIN_PATH');
  } else save('NATURAL_FINITE_POTION_FAILURES_ALIVE_S2');
} catch (error) {
  if (error instanceof ActualTerminalStop) save('NATURAL_ACTUAL_TERMINAL', error);
  else if (error instanceof FiniteOutcomeStop) save('NATURAL_FINITE_RESOURCES_EXHAUSTED', error);
  else { save('ACTUAL_BLOCKER', error); throw error; }
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
