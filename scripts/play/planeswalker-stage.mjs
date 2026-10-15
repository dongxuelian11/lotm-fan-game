import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Static candidate: the serial runtime lead runs after compilation, from repo root.
// node --max-old-space-size=512 scripts/play/planeswalker-stage.mjs
// The inherited S4 prefix was directed. Only its existing saved initial is replayed;
// this is NOT a new ordinary-person run. No new seed/cursor/state edits, reloads,
// free refills, forced results, or overwrite of an existing authoritative fixture.
const load = name => import(pathToFileURL(resolve(`dist/domain/${name}.js`)).href);
const { applySliceIntent, projectSliceState, assertValidSliceState } = await load('slice/index');
const { migrateSliceState } = await load('slice/migration');
const { validateSlicePayload } = await load('slice/validation');
const { projectPlaneswalker } = await load('planeswalker/index');
const { projectWandererLife } = await load('wanderer/life');
const sourceFixture = 'tests/fixtures/wanderer-v01500/peaceful.json';
const old = Object.fromEntries(['provenance', 'initial', 'creation', 'seed', 'commands', 'prefixCount', 'branch', 'final'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const { creation, seed, provenance } = old, prefixCount = old.commands.length;
const continuation = { sourceFixture, kind: 'EXACT_208_PUBLIC_PREFIX_THEN_PUBLIC_PLANESWALKER', inheritedDirectedPrefix: true, newRandomChanges: false };
const SITE_IDS = ['PW2-COPPER', 'PW2-SALT', 'PW2-GLASS', 'PW2-REED', 'PW2-ASH', 'PW2-TIDE', 'PW2-BELL', 'PW2-LAMP', 'PW2-STONE'];
const CASES = ['symbolic-transit', 'pattern-reproduction', 'withdrawn-transit'];
const NEW_IDS = ['door.s2.symbolic-transit', 'door.s2.pattern-reproduction'];
const OLD_ROOTS = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer'];
const MAX_COMMANDS = 3500, MAX_BOTTLES = 12, MAX_ROUTE_ATTEMPTS = 150, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, boundarySteps = {}, snapshots = {};
let s = null, initial = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
let legacyLifeProjection = null, originalSites = null, ritualAtQualification = null;
let firstSuccessCaptured = false, firstFailureCaptured = false;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/planeswalker-01740-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public-compact.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const view = () => projectPlaneswalker(s), ritual = () => s.planeswalker.ritual, life = () => s.planeswalker.life;
const visit = id => ritual().visits.find(v => v.id === id);
const attempt = id => life().cases[id].attempts.at(-1);
const success = tier => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const stableLifeProjection = state => { const { actions, ...historical } = projectWandererLife(state); return historical; };
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function compact() {
  const p = view(), v = p.ritual.currentVisit, a = p.life.currentAttempt, round = s.combat?.lastRound ?? s.lastCombatRound;
  return { revision: s.revision, week: s.week, date: s.date, status: s.status, H: s.health, M: s.mind, S: s.spirituality,
    pollution: p.pollution, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting,
    activeEvent: s.activeEvent?.instanceId ?? null, qualifiedSites: p.ritual.qualifiedSites, ritualLocation: p.ritual.playerLocation,
    visit: v ? { id: v.id, siteId: v.siteId, purpose: v.purpose, phase: v.phase, tier: v.departureTier, paid: v.paid, protection: v.kit.suit.protectionSeconds } : null,
    life: { activeCase: p.life.activeCase, location: p.life.playerLocation, astralLegs: p.life.playerAstralLegs,
      tier: a?.abilityTier ?? null, applied: a?.appliedAbilityIds ?? [], elapsedSeconds: p.life.clockSeconds },
    encounter: { status: p.encounter.status, enemy: p.encounter.enemy, lastRound: round ? { round: round.round, stance: round.stance, winner: round.winner, retreat: round.retreat, planeswalker: round.planeswalkerOutcome ? { playerHealthAfter: round.planeswalkerOutcome.playerHealthAfter, enemyHealthAfter: round.planeswalkerOutcome.enemyHealthAfter, playerSpiritualityAfter: round.planeswalkerOutcome.playerSpiritualityAfter, enemySpiritualityAfter: round.planeswalkerOutcome.enemySpiritualityAfter, continuing: round.planeswalkerOutcome.continuing } : null } : null } };
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the exact complete 208-command prefix');
  let unique = key, n = 2; while (boundaries[unique]) unique = `${key}-${n++}`;
  const name = `${unique}.json`; write(`${outputDir}/${name}`, { beforeLast, lastIntent, final: s });
  boundaries[unique] = name; boundarySteps[unique] = commands.length;
}
function go(intent, boundary = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Finite public strategy exhausted; preserve the actual blocker');
  beforeLast = s; lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent); assertValidSliceState(next);
  assert.equal(next.random.seed, seed); assert(next.random.cursor >= s.random.cursor);
  assert.equal(next.revision, s.revision + 1);
  s = next; commands.push(structuredClone(intent)); pendingIntent = null;
  append(commandsFile, { index: commands.length, prefix: !prefixVerified, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision, randomBefore: beforeLast.random, randomAfter: s.random });
  if (prefixVerified) {
    const record = { index: commands.length, intent, public: compact() }; append(publicFile, record);
    if (boundary) capture(boundary);
    if (boundary || intent.type === 'ACTION' || intent.type === 'COMBAT_ROUND') console.log(JSON.stringify(record));
  }
}
function pw(command, boundary = null) {
  pendingIntent = { type: 'PLANESWALKER', command: structuredClone(command) };
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a current public action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'PLANESWALKER', command }, boundary);
}
function clear() {
  for (let n = 0; s.activeEvent && n < 30; n++) {
    const e = projectSliceState(s).activeEvent;
    const choiceId = e.id.startsWith('ORIGIN') ? '.decline' : e.id === 'LIFE-BILL-01' ? 'PAY_PART' :
      e.id === 'DEBT-NOTICE-01' ? 'DECLINE' : e.id === 'DEBT-SETTLE-01' ? 'DEFER' :
      e.id === 'LIFE-CARE-01' ? (s.cash >= 60 ? 'PAY' : 'DECLINE') : e.id === 'CARE-WORK-OFFER' ? 'DECLINE' : null;
    assert(choiceId, `Unexpected current public event: ${e.id}`);
    assert(e.choices.some(choice => choice.id === choiceId), `Missing public choice ${e.id}/${choiceId}`);
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId });
  }
  assert.equal(s.activeEvent, null); assert.equal(s.pulse, 'NONE');
}
function ordinary(boundary = null) {
  clear(); assert.equal(s.status, 'ACTIVE'); assert(!s.combat && !view().insideCase);
  assert.equal(ritual().playerLocation, 'LOCAL'); assert.notEqual(life().site.playerLocation, 'REMOTE');
  // Shared ACTION actually pays the one weekly wage or rests. The shared week
  // pulse advances automatically after the final AP and pending choices; there
  // is no NEXT_WEEK/ERA payload in this run's public contract.
  assert(s.actionsRemaining > 0, 'No ordinary AP and no pending shared week settlement');
  go({ type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, boundary); clear();
}
function ready({ cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  clear(); assert(ap <= s.weeklyBudget);
  let n = 0;
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) {
    assert(n++ < 1000, 'Finite ordinary work/rest preparation exhausted'); ordinary();
  }
}
function action(command, boundary = null) { ready(); pw(command, boundary); clear(); }
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed); assert.equal(s.character.gender, old.final.character.gender);
  for (const key of OLD_ROOTS) assert.deepEqual(s[key], old.final[key], `Original ${key} history/people/gear`);
  assert.deepEqual(s.combatHistory.slice(0, old.final.combatHistory.length), old.final.combatHistory);
  assert.deepEqual(stableLifeProjection(s), legacyLifeProjection, 'Original Wanderer life projection remains historical and unchanged');
  for (const id of Object.keys(old.final.progression.mastery)) assert(Object.hasOwn(s.progression.mastery, id), `Inherited ability retained: ${id}`);
  assert.equal(Object.keys(s.progression.mastery).length, s.progression.sequence === 2 ? 15 : 13);
  // Ordinary public world growth may change old mastery; it is not frozen here.
}
function assertSiteOriginals() {
  for (const id of SITE_IDS) {
    const original = originalSites[id], current = ritual().sites[id];
    for (const key of ['id', 'name', 'worldId', 'coordinates', 'shelter', 'returnMarker', 'witness', 'reteller']) assert.deepEqual(current[key], original[key], `${id} original ${key}`);
    for (const key of ['id', 'name', 'location', 'ownerId', 'change']) assert.deepEqual(current.object[key], original.object[key], `${id} original object ${key}`);
    for (const key of ['id', 'location']) assert.equal(current.record[key], original.record[key]);
  }
}
function route(siteId, purpose) {
  for (let tries = 0; tries < MAX_ROUTE_ATTEMPTS; tries++) {
    const originalHelpWeek = ritual().sites[siteId].helpWeek;
    ready({ cash: 30, ap: 2, health: 100, mind: 100, spirituality: 24, pollution: 0, afterWeek: purpose === 'VERIFY' ? originalHelpWeek : -1 });
    assert.equal(ritual().playerLocation, 'LOCAL');
    const first = ritual().visits.length === 0, before = { cash: s.cash, ap: s.actionsRemaining, count: ritual().visits.length };
    pw({ type: 'PREPARE_ROUTE_KIT', siteId }, first ? 'first-visit-paid-new-kit' : null);
    const id = ritual().activeVisitId;
    assert.equal(visit(id).purpose, purpose); assert.equal(ritual().visits.length, before.count + 1);
    assert.equal(s.cash, before.cash - 30); assert.equal(s.actionsRemaining, before.ap - 1);
    assert.equal(visit(id).kit.suit.protectionSeconds, 90); assert(visit(id).kit.energy.every(e => e.status === 'UNUSED'));
    for (const type of ['CHECK_ROUTE_COORDINATES', 'CHECK_ROUTE_PROTECTION', 'CHECK_ROUTE_RETURN']) pw({ type }, first ? `first-visit-${type.toLowerCase()}` : null);
    const depart = { S: s.spirituality, M: s.mind, pollution: s.seer.pollution, cursor: s.random.cursor };
    pw({ type: 'DEPART_RITUAL', confirmed: true });
    assert.equal(s.spirituality, depart.S - 8); assert.equal(s.random.cursor, depart.cursor + 1);
    assert.equal(visit(id).kit.energy.filter(e => e.status === 'CONSUMED').length, 1);
    if (!success(visit(id).departureTier)) {
      if (!firstFailureCaptured) { capture('first-outbound-failure'); firstFailureCaptured = true; }
      assert.equal(ritual().playerLocation, 'LOCAL'); assert.equal(s.mind, Math.max(0, depart.M - 5));
      assert.equal(s.seer.pollution, Math.min(100, depart.pollution + 2)); assert.equal(visit(id).moves.length, 0);
      assert.equal(visit(id).kit.suit.protectionSeconds, 90);
      pw({ type: 'CLOSE_ROUTE_KIT' }, `failed-${id.toLowerCase()}-close`);
      assert.equal(visit(id).result, 'OUTBOUND_FAILURE'); assert.equal(visit(id).kit.location, 'PROVIDER_ARCHIVE');
      assert.equal(visit(id).kit.energy.filter(e => e.status === 'UNUSED').length, 1);
      assertSiteOriginals(); assertLegacyPreserved(); clear(); continue;
    }
    const captureFull = !firstSuccessCaptured;
    if (captureFull) capture('first-actual-offworld-departure');
    assert.equal(ritual().playerLocation, siteId); assert.equal(visit(id).kit.location, siteId);
    assert.equal(visit(id).kit.suit.protectionSeconds, 80); assert.equal(visit(id).moves.length, 1);
    assert.equal(s.seer.pollution, Math.min(100, depart.pollution + 1));
    pw({ type: 'CONTACT_SETTLEMENT' }, captureFull ? 'first-original-residents-contacted' : null);
    const site = ritual().sites[siteId]; assert.deepEqual(visit(id).contactedResidentIds, [site.witness.id, site.reteller.id]);
    const ap = s.actionsRemaining;
    pw({ type: purpose === 'HELP' ? 'HELP_SETTLEMENT' : 'VERIFY_LEGEND' }, `${siteId.toLowerCase()}-${purpose.toLowerCase()}`);
    assert.equal(s.actionsRemaining, ap - 1); assert.equal(ritual().playerLocation, siteId);
    assert.equal(ritual().sites[siteId].object.condition, 'REPAIRED');
    if (purpose === 'HELP') {
      assert.equal(ritual().sites[siteId].record.entry.visitId, id); assert.equal(ritual().sites[siteId].qualifiedWeek, null);
    } else {
      const now = ritual().sites[siteId]; assert(visit(id).week > originalHelpWeek);
      assert.equal(now.retelling.speakerId, now.reteller.id); assert.equal(now.retelling.heardFromId, now.witness.id);
      assert.equal(now.retelling.originalEntryId, now.record.entry.id); assert.equal(now.retelling.originalObjectId, now.object.id);
      assert.equal(now.qualifiedWeek, null, 'Verification only qualifies after actual return and close');
    }
    pw({ type: 'CHECK_RITUAL_RETURN_MARKER' }, captureFull ? 'first-actual-return-marker' : null);
    const returnS = s.spirituality, returnCursor = s.random.cursor;
    pw({ type: 'RETURN_RITUAL' }, captureFull ? 'first-actual-paid-return' : null);
    assert.equal(s.spirituality, returnS - 8); assert.equal(s.random.cursor, returnCursor);
    assert.equal(ritual().playerLocation, 'LOCAL'); assert.equal(visit(id).moves.length, 2);
    assert(visit(id).moves.every(m => m.originalBody && m.kitId === visit(id).kit.id));
    assert.equal(visit(id).kit.suit.protectionSeconds, 70); assert(visit(id).kit.energy.every(e => e.status === 'CONSUMED'));
    pw({ type: 'CLOSE_ROUTE_KIT' }, `${siteId.toLowerCase()}-${purpose.toLowerCase()}-close`);
    const closed = visit(id); assert.equal(closed.phase, 'CLOSED'); assert.equal(closed.result, purpose === 'HELP' ? 'HELPED' : 'VERIFIED');
    assert.equal(closed.kit.location, 'PROVIDER_ARCHIVE'); assert.equal(closed.kit.archivedWeek, closed.week);
    assert.deepEqual(closed.paid, { actions: 2, spirituality: 16, pennies: 30, energyPieces: 2, protectionSeconds: 20, mind: 0, pollution: 2 });
    firstSuccessCaptured = true; assertSiteOriginals(); assertLegacyPreserved(); clear(); return;
  }
  assert.fail(`Finite paid route attempts exhausted at ${siteId}/${purpose}; preserve all failures without reseeding`);
}
function practice(caseId) {
  action({ type: 'OBSERVE', caseId });
  const latestPracticeWeek = Math.max(-1, ...CASES.flatMap(id => life().cases[id].attempts.map(a => a.week)));
  ready({ cash: 20, ap: 2, health: 100, mind: 100, spirituality: 24, pollution: 0, afterWeek: latestPracticeWeek });
  pw({ type: 'PREPARE', caseId, method: 'ABILITY' }, `${caseId}-prepared`);
  const step = (type, boundary = null) => pw({ type, caseId }, boundary);
  const enabled = type => view().actions.some(a => a.command.type === type && a.command.caseId === caseId && a.enabled);
  step('CONSENT_OPERATOR');
  if (caseId === 'pattern-reproduction') step('READ_PATTERN', 'original-light-pattern-read');
  else {
    const cash = s.cash; step('BUY_KIT'); assert.equal(s.cash, cash - 20);
    step('CHECK_ENDPOINTS'); step('TAKE_PARCEL');
  }
  step('OPEN_DOOR');
  const before = { S: s.spirituality, AP: s.actionsRemaining, cursor: s.random.cursor, energy: life().site.operatorEnergy };
  step('PERFORM', `${caseId}-paid-window`);
  assert.equal(s.spirituality, before.S - (caseId === 'pattern-reproduction' ? 7 : 8));
  assert.equal(s.actionsRemaining, before.AP - 1); assert.equal(s.random.cursor, before.cursor + 1);
  assert.equal(life().site.operatorEnergy, before.energy - 2);
  if (caseId === 'symbolic-transit' && enabled('DEPART')) {
    step('DEPART', 'symbolic-transit-actual-offworld-body-and-parcel');
    assert.equal(life().site.playerLocation, 'REMOTE'); assert.equal(life().site.parcel.location, 'PLAYER');
    step('READ_RETURN_MARKER', 'symbolic-transit-original-return-marker');
    const returnS = s.spirituality; step('RETURN_LOCAL', 'symbolic-transit-paid-actual-return'); assert.equal(s.spirituality, returnS - 8);
    assert.equal(life().site.playerLocation, 'ENTRY'); assert.equal(attempt(caseId).playerAstralLegs, 2);
  } else if (caseId === 'pattern-reproduction' && enabled('APPLY_PATTERN')) step('APPLY_PATTERN', 'pattern-reproduction-actual-application');
  else if (caseId === 'withdrawn-transit') {
    step('WITHDRAW_PERMISSION', 'withdrawn-transit-current-permission');
    assert.deepEqual(attempt(caseId).appliedAbilityIds, []); assert.equal(attempt(caseId).playerAstralLegs, 0);
  }
  step('STOP');
  if (!attempt(caseId).appliedAbilityIds.length && caseId !== 'withdrawn-transit') step('MANUAL_COMPARE', `${caseId}-actual-ordinary-fallback`);
  if (caseId !== 'pattern-reproduction') { step('RETURN_PARCEL'); step('ARCHIVE_KIT'); }
  step('CLOSE_DOOR'); step('INSPECT'); step('LEAVE', `${caseId}-closed-original-site`); clear();
  action({ type: 'REPORT', caseId }, `${caseId}-report`);
  assert.equal(life().cases[caseId].status, 'RESOLVED'); assert.equal(life().site.playerLocation, 'ENTRY');
  assert.equal(life().site.parcel.location, 'ENTRY_STAND'); assert.equal(life().site.effect.mode, 'OFF');
  assertLegacyPreserved(); assert.deepEqual(ritual(), ritualAtQualification);
}
function appendFileBytes(destination, source) {
  const fd = openSync(source, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; appendFileSync(destination, buffer.subarray(0, count)); } } finally { closeSync(fd); }
}
function writeNatural(stage, error = null) {
  const path = `${outputDir}/${error ? 'blocker' : 'natural'}.json`;
  writeFileSync(path, '{', { flag: 'wx' }); let first = true;
  const property = (key, value, file = null) => { appendFileSync(path, `${first ? '' : ','}${JSON.stringify(key)}:`); first = false; if (file) appendFileBytes(path, file); else appendFileSync(path, JSON.stringify(value)); };
  for (const [key, value] of Object.entries({ provenance, continuation, creation, seed, initial, commands, prefixCount, inheritedPrefixCount: old.prefixCount, stage, sourceFixture, prefixVerified })) property(key, value);
  for (const key of ['departureStart', 'guidanceStart', 'ritualQualified', 'promoted', 'practiced', 'combatStart']) property(key, null, snapshots[key] ?? null);
  property('beforeLast', beforeLast); property('lastIntent', lastIntent); property('final', s); property('boundaryIndex', 'boundaries.index.json');
  if (error) { property('pendingIntent', pendingIntent); property('error', String(error)); property('stack', error.stack ?? null); }
  appendFileSync(path, '}'); return path;
}
function save(stage) {
  const naturalPath = writeNatural(stage); write(`${outputDir}/boundaries.index.json`, boundaries); write(`${outputDir}/boundaries.steps.json`, boundarySteps);
  const summary = { stage, outputDir, sourceFixture, provenance, continuation, prefixCount, commands: commands.length, prefixVerified,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, cash: s.cash, actionsRemaining: s.actionsRemaining, random: s.random,
    injuries: s.injuries, injuryRisk: s.injuryRisk, mastery: s.progression.mastery,
    bottles: s.planeswalker.bottles.map(b => ({ id: b.id, status: b.status, labourSteps: b.labourSteps, outcome: b.outcome, auxiliaryKit: b.auxiliaryKit })),
    ritual: { qualifiedSites: view().ritual.qualifiedSites, clockSeconds: ritual().clockSeconds, offworldLegs: ritual().offworldLegs, sites: ritual().sites, visits: ritual().visits },
    cases: CASES.map(id => ({ id, ...life().cases[id] })), site: life().site, encounter: s.planeswalker.encounter,
    boundaries: Object.keys(boundaries).length, legacyPreserved: true };
  write(`${outputDir}/summary.json`, summary);
  // Only successful completed execution publishes; failures stay in their unique
  // output folder. Reserve the destination directory exclusively before copying.
  const fixtureDir = 'tests/fixtures/planeswalker-v01740';
  assert(!existsSync(fixtureDir), `Refusing to replace existing authoritative fixture ${fixtureDir}`);
  mkdirSync(fixtureDir);
  const files = [[naturalPath, 'natural.json'], [`${outputDir}/summary.json`, 'summary.json'], [`${outputDir}/boundaries.index.json`, 'boundaries.index.json'], [`${outputDir}/boundaries.steps.json`, 'boundaries.steps.json'],
    [commandsFile, 'commands.jsonl'], [publicFile, 'public-compact.jsonl'], ...Object.entries(snapshots).map(([key, path]) => [path, `snapshot-${key}.json`]), ...Object.values(boundaries).map(name => [`${outputDir}/${name}`, name])];
  for (const [source, target] of files) copyFileSync(source, `${fixtureDir}/${target}`, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ passed: true, stage, outputDir, fixtureDir, commands: commands.length, prefixCount, boundaries: Object.keys(boundaries).length, summary: 'summary.json' }));
}
try {
  assert.equal(prefixCount, 208); assert.equal(old.prefixCount, 60); assert.equal(provenance.kind, 'DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER');
  assert.equal(provenance.newRandomChanges, false); assert.equal(old.final.status, 'ACTIVE');
  initial = migrateSliceState(old.initial); s = initial; assertValidSliceState(s); assert.deepEqual(s.random, old.initial.random);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands); assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated original peaceful terminal must match exactly before any new intent');
  assert.deepEqual(s.random, old.final.random); assert.equal(s.week, 126); assert.equal(s.cash, 540); assert.equal(s.actionsRemaining, 1);
  assert.equal(s.progression.pathwayId, 'door'); assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100);
  assert.equal(Object.keys(s.progression.mastery).length, 13); assert.equal(s.wanderer.life.packet.location, 'REMOTE');
  assert.equal(s.wanderer.life.suit.protectionSeconds, 90); assert.deepEqual(s.wanderer.life.energy, { id: 'WN3-ENERGY', remaining: 1, spent: 1 });
  prefixVerified = true; legacyLifeProjection = stableLifeProjection(s); originalSites = structuredClone(ritual().sites);
  snapshot('departureStart'); capture('inherited-full-208-peaceful-final'); assertLegacyPreserved();
  ready({ cash: 500, ap: 2 }); snapshot('guidanceStart'); const guidanceCash = s.cash;
  pw({ type: 'LEARN_GUIDANCE' }, 'independent-guidance-paid500');
  assert.equal(s.cash, guidanceCash - 500); assert.equal(s.planeswalker.guidanceKnown, true); clear();
  for (const taskId of ['REVIEW_COORDINATES', 'CHECK_PROTECTION', 'PLAN_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (const id of SITE_IDS) { route(id, 'HELP'); route(id, 'VERIFY'); }
  assert.equal(view().ritual.qualifiedSites, 9); assert.equal(view().ritual.qualified, true);
  assert.equal(ritual().visits.filter(v => v.result === 'HELPED').length, 9); assert.equal(ritual().visits.filter(v => v.result === 'VERIFIED').length, 9);
  assert.equal(ritual().offworldLegs, 36); assert.equal(new Set(ritual().visits.map(v => v.kit.id)).size, ritual().visits.length);
  assertSiteOriginals(); ritualAtQualification = structuredClone(ritual()); snapshot('ritualQualified'); capture('nine-places-actual-qualified');
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.planeswalker.bottles.find(b => b.status === 'PLAYER') ?? s.planeswalker.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      const length = s.planeswalker.bottles.length; action({ type: 'REQUEST_SUPPLY' }, 'request-independent-new-batch');
      const requestedWeek = s.planeswalker.resupply.requestedWeek; assert.notEqual(requestedWeek, null); assert.equal(s.planeswalker.bottles.length, length);
      ready({ afterWeek: requestedWeek }); pw({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-new-batch');
      assert.equal(s.planeswalker.bottles.length, length + 3); bottle = s.planeswalker.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'An independent original bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.planeswalker.bottles.find(b => b.id === bottleId).labourSteps < 5) action({ type: 'POTION_WORK', bottleId });
      ready({ cash: 1040 }); const cash = s.cash; pw({ type: 'BUY_POTION', bottleId }, 'buy-independent-bottle-and-three-original-worms'); assert.equal(s.cash, cash - 900);
    }
    ready({ cash: 140, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.wanderer.promotionWeek + 11 });
    assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); assert.equal(s.progression.acting, 100);
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    pw({ type: 'PREPARE_PROMOTION' }, 'paid140-current-week-original-auxiliary-check');
    assert.equal(s.cash, prep.cash - 140); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    const held = s.planeswalker.bottles.find(b => b.id === bottleId); assert.equal(held.labourSteps, 5);
    assert.equal(held.auxiliaryKit.openedWeek, s.week); assert.deepEqual(held.auxiliaryKit.items.map(i => i.kind).sort(), ['SPIRIT_WORM', 'STAR_WORM', 'TIME_WORM']);
    assert(held.auxiliaryKit.items.every(i => i.status === 'PLAYER' && i.donorSequence === 4 && i.donorAge > 18 && i.quantity === 1));
    assert.equal(new Set(held.auxiliaryKit.items.map(i => i.receiptId)).size, 3);
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), health: s.health, mind: s.mind,
      pollution: s.seer.pollution, spirituality: s.spirituality, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
    pw({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'promotion' : 'actual-potion-failure');
    const used = s.planeswalker.bottles.find(b => b.id === bottleId); assert.equal(used.status, 'CONSUMED'); assert.equal(used.auxiliaryKit.status, 'CONSUMED');
    assert(used.auxiliaryKit.items.every(i => i.status === 'CONSUMED')); assert.equal(s.planeswalker.preparedWeek, null);
    assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.spirituality);
    assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk); assert.deepEqual(ritual(), ritualAtQualification);
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[used.outcome]; assert(costs);
    assert.equal(s.health, Math.max(1, before.health - costs[0])); assert.equal(s.mind, Math.max(1, before.mind - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery, 'Only promotion itself must preserve every current inherited mastery');
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], Math.min(500, stat + (s.progression.sequence === 2 ? 1 : 0)));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite real bottle supply exhausted; never force promotion');
  assert.equal(s.planeswalker.wandererActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
  for (const id of CASES) practice(id);
  action({ type: 'REFLECT' }, 'three-practices-reflection'); assert.equal(s.progression.acting, 100);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], CASES.reduce((n, caseId) => n + (attempt(caseId).appliedAbilityIds.includes(id) ? 8 : 0), 0));
  assertLegacyPreserved(); snapshot('practiced');
  ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 });
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); const closedSite = structuredClone(life().site);
  pw({ type: 'ENCOUNTER_TALK' }, 'original-enemy-approach');
  assert.deepEqual(s.planeswalker.encounter.startSite, closedSite); assert.equal(life().site.playerLocation, 'NEAR'); assert.equal(life().site.operatorLocation, 'OUTSIDE');
  pw({ type: 'ENCOUNTER_FIGHT' }, 'original-enemy-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'PLANESWALKER_DISPUTE'); assert.equal(s.planeswalker.encounter.targetId, 'PW2-SOREN');
  const masteryBeforeCombat = structuredClone(s.progression.mastery);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK' }, round === 0 ? 'combat-first' : null);
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat);
    assert.deepEqual(s.planeswalker.encounter.startSite, closedSite); assert.deepEqual(ritual(), ritualAtQualification);
    for (const key of ['parcel', 'lamp', 'screen', 'kits']) assert.deepEqual(life().site[key], closedSite[key]);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual optional combat has not terminated'); assert(s.planeswalker.encounter.terminal);
  if (s.status === 'ACTIVE') { assert.equal(life().site.playerLocation, 'ENTRY'); ordinary('ordinary-life-after-actual-exit'); }
  else { assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert(['NEAR', 'FAR'].includes(life().site.playerLocation)); }
  assertLegacyPreserved(); assertSiteOriginals();
  for (const key of ['initial', 'commands', 'final', 'provenance']) assert.deepEqual(readObjectEntry(sourceFixture, key), old[key], `Original source ${key} unchanged`);
  save(s.status === 'ACTIVE' ? 'DIRECTED_S4_PREFIX_FULL_PUBLIC_PLANESWALKER' : 'DIRECTED_S4_PREFIX_ACTUAL_PLANESWALKER_COMBAT_DEATH');
} catch (error) {
  const blocker = writeNatural('ACTUAL_BLOCKER', error); write(`${outputDir}/blocker.boundaries.index.json`, boundaries); write(`${outputDir}/blocker.boundaries.steps.json`, boundarySteps);
  console.error(JSON.stringify({ passed: false, outputDir, blocker, commands: commands.length, prefixVerified, error: String(error) })); throw error;
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
