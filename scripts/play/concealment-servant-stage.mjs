import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Static candidate. Lead runs after compilation, once per intentional public route:
// node --max-old-space-size=512 scripts/play/concealment-servant-stage.mjs
// No state edits, reseeding, cursor search, failure reloads, free injury treatment,
// old-prefix substitution, death erasure, or overwrite of existing captures.
const load = name => import(pathToFileURL(resolve(`dist/domain/slice/${name}.js`)).href);
const { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await load('index');
const { migrateSliceState } = await load('migration');
const { validateSlicePayload } = await load('validation');
const sourceFixture = 'tests/fixtures/fear-bishop-v01450/natural.json';
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final', 'stage', 'prefixCount'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const { creation, seed } = old, prefixCount = old.commands.length;
const CASES = ['consented-box', 'withdrawn-consent', 'blocked-door'];
const NEW_IDS = ['darkness.s2.bounded-concealment', 'darkness.s2.trace-veil'];
const MAX_COMMANDS = 2200, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, snapshots = {}, treatments = [];
let s = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/concealment-servant-01690-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => pub().concealmentServant;
const life = () => s.concealmentServant.life, attempt = id => life().cases[id].attempts.at(-1);
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete 420-command prefix');
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  const name = `${unique}.json`; write(`${outputDir}/${name}`, { beforeLast, lastIntent, final: s });
  boundaries[unique] = name;
}
function go(intent, boundary = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Finite public strategy exhausted; preserve its actual blocker');
  beforeLast = s; lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent); assertValidSliceState(next);
  assert.equal(next.random.seed, seed); assert(next.random.cursor >= s.random.cursor);
  assert.equal(next.revision, s.revision + 1); assert.equal(next.weeklyBudget, 3);
  s = next; commands.push(structuredClone(intent)); pendingIntent = null;
  if (prefixVerified) {
    append(commandsFile, { index: commands.length, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision, randomBefore: beforeLast.random, randomAfter: s.random });
    append(publicFile, { index: commands.length, public: pub() });
    if (boundary) capture(boundary);
    console.log(JSON.stringify({ index: commands.length, intent, week: s.week, status: s.status, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting }));
  }
}
function cs(command, boundary = null) {
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a public action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'CONCEALMENT_SERVANT', command }, boundary);
}
function clear() {
  for (let count = 0; s.activeEvent && count < 20; count++) {
    const event = pub().activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline' : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE' : event.id === 'DEBT-SETTLE-01' ? 'DEFER' : event.id === 'LIFE-CARE-01' ? 'PAY' : null;
    assert(choiceId, `Unexpected event ${event.id}; retain the actual pending event`);
    assert(event.choices.some(c => c.id === choiceId && c.enabled), `Unavailable actual choice ${event.id}/${choiceId}`);
    const before = event.id === 'LIFE-CARE-01' ? { cash: s.cash, week: s.week, revision: s.revision, injuries: structuredClone(s.injuries) } : null;
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, before ? 'clinic-pay60' : null);
    if (before) {
      assert(s.cash <= before.cash - 60, 'PAY60 and actual week-end charges remain paid');
      for (const oldInjury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const injury = s.injuries.find(i => i.id === oldInjury.id); assert(injury, 'Treatment must not instantly heal the original wound'); assert.notEqual(injury.treatedRevision, null);
      }
      treatments.push({ paidPennies: 60, before, cashAfter: s.cash, injuriesAfter: structuredClone(s.injuries) });
    }
  }
  assert.equal(s.activeEvent, null, 'Event chain still pending');
}
function ordinary(boundary = null, forceRest = false) {
  clear(); assert.equal(s.status, 'ACTIVE', 'Actual death cannot continue ordinary life');
  assert(pub().canAct && !view().insideCase && !s.combat, 'Never work/rest through a real scene lock');
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, boundary); clear();
}
function ready({ cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  clear(); assert(ap <= 3);
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) ordinary();
}
function action(command, boundary = null) { ready(); cs(command, boundary); clear(); }
function recoverOriginalInjuries() {
  assert.equal(s.health, 80); assert.equal(s.injuryRisk, 3);
  assert.equal(s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length, 1);
  assert.equal(s.injuries.filter(i => i.severity === 'LIGHT').length, 2);
  if (!s.careKnown) {
    ready({ cash: 60, ap: 2 }); assert(pub().investigateTargets.some(t => t.id === 'CARE-ACCESS-01'));
    const health = s.health, injuries = structuredClone(s.injuries);
    go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'clinic-actual-discovery');
    assert.equal(s.health, health); assert.deepEqual(s.injuries, injuries); clear();
  }
  while (s.injuries.length) {
    ready({ cash: s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? 60 : 0 });
    ordinary(s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? 'clinic-invitation-rest' : 'treated-injury-later-rest', true);
  }
  assert(treatments.length > 0, 'Original untreated heavy injury requires real PAY60'); assert.equal(s.injuryRisk, 0);
}
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId); assert.equal(s.character.gender, old.final.character.gender); assert.equal(s.random.seed, seed);
  for (const key of ['sleepless', 'midnight', 'nightmare', 'soother', 'nightwatcher', 'fearBishop']) assert.deepEqual(s[key], old.final[key], `Preserve every original ${key} fact`);
  const original = old.final.spiritWarlock, current = s.spiritWarlock;
  assert.equal(current.companion.id, original.companion.id); assert.equal(current.companion.source, original.companion.source);
  assert.equal(current.companion.releases, original.companion.releases);
  assert(current.companion.deployments >= original.companion.deployments);
  assert.equal(current.companion.deployments - original.companion.deployments, current.companion.recalls - original.companion.recalls);
  assert.equal(current.companion.status, original.companion.status, 'Same original spirit is actually recalled at every round boundary');
  const rest = structuredClone(current); rest.companion.deployments = original.companion.deployments; rest.companion.recalls = original.companion.recalls;
  assert.deepEqual(rest, original, 'Only actual additional deployments/recalls may change the same acquired spirit');
  for (const [id, mastery] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Preserve original mastery ${id}`);
  assert.deepEqual(s.town, old.final.town, 'No free club or other ordinary equipment grant');
}
function practice(caseId) {
  ready({ ap: 2, health: 90, mind: 85, spirituality: 30 });
  cs({ type: 'PREPARE', caseId, method: 'ABILITY' }, `${caseId}-prepared`); cs({ type: 'PERFORM', caseId }, `${caseId}-opened`);
  const step = (type, key = null) => cs({ type, caseId }, key);
  for (const type of ['READ_SOURCE', 'CHECK_DOOR', 'CONSENT_OWNER', 'CONSENT_PARTICIPANT', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_BOX']) step(type);
  step('CONCEAL', `${caseId}-concealment-outcome`); step('TRACE_VEIL', `${caseId}-veil-outcome`);
  if (caseId === 'withdrawn-consent') {
    cs({ type: 'WITHDRAW_CONSENT', caseId, actor: 'ERIN' }, 'owner-current-consent-withdrawn');
    assert.equal(attempt(caseId).concealment.effects, 0); assert.equal(attempt(caseId).traceVeil.effects, 0);
    assert(view().actions.filter(a => ['CONCEAL', 'TRACE_VEIL', 'MOVE_BOX', 'WEAK_SEARCH'].includes(a.command.type) && 'caseId' in a.command && a.command.caseId === caseId).every(a => !a.enabled));
  } else {
    step('MOVE_BOX', `${caseId}-actual-box-move`); step('WEAK_SEARCH', `${caseId}-actual-next-weak-search`);
    if (caseId === 'blocked-door') {
      step('BLOCK_DOOR', 'actual-original-door-blocked');
      assert(!view().actions.find(a => a.command.type === 'UNBOLT_DOOR' && 'caseId' in a.command && a.command.caseId === caseId)?.enabled);
      assert(!view().actions.find(a => a.command.type === 'EXIT_ROOM' && 'caseId' in a.command && a.command.caseId === caseId)?.enabled);
    }
    const release = view().actions.find(a => a.command.type === 'RELEASE_CONCEALMENT' && 'caseId' in a.command && a.command.caseId === caseId);
    if (release?.enabled) step('RELEASE_CONCEALMENT', `${caseId}-explicit-release`);
    if (life().room.doorBlocked) step('UNBOLT_DOOR', 'ordinary-unbolt-after-release');
  }
  step('RETURN_BOX', `${caseId}-same-box-returned`); step('EXIT_ROOM', `${caseId}-actual-ordinary-exit`); step('INSPECT'); step('CLOSE', `${caseId}-closed`); clear();
  assert.equal(life().cases[caseId].status, 'EXAMINED'); assert.equal(life().box.location, 'START'); assert.equal(life().erin.location, 'EXIT');
}
function appendFileBytes(destination, source) {
  const fd = openSync(source, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; appendFileSync(destination, buffer.subarray(0, count)); } } finally { closeSync(fd); }
}
function writeNatural(stage, error = null) {
  const path = `${outputDir}/${error ? 'blocker' : 'natural'}.json`;
  writeFileSync(path, '{', { flag: 'wx' }); let first = true;
  const property = (key, value, file = null) => {
    appendFileSync(path, `${first ? '' : ','}${JSON.stringify(key)}:`); first = false;
    if (file) appendFileBytes(path, file); else appendFileSync(path, JSON.stringify(value));
  };
  for (const [key, value] of Object.entries({ creation, seed, commands, prefixCount, stage, sourceFixture, prefixVerified })) property(key, value);
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart']) property(key, null, snapshots[key] ?? null);
  property('beforeLast', beforeLast); property('lastIntent', lastIntent); property('final', s);
  property('boundaryIndex', 'boundaries.index.json'); property('treatments', treatments);
  if (error) { property('pendingIntent', pendingIntent); property('error', String(error)); property('stack', error.stack ?? null); }
  appendFileSync(path, '}'); return path;
}
function save(stage) {
  const naturalPath = writeNatural(stage); write(`${outputDir}/boundaries.index.json`, boundaries);
  const summary = { stage, outputDir, prefixCount, commands: commands.length, prefixVerified, week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, injuryRisk: s.injuryRisk, injuries: s.injuries, random: s.random, treatments,
    bottles: s.concealmentServant.bottles.map(b => ({ id: b.id, outcome: b.outcome, status: b.status })),
    cases: CASES.map(id => ({ id, ...life().cases[id] })), mastery: Object.fromEntries(NEW_IDS.map(id => [id, s.progression.mastery[id]])), encounter: s.concealmentServant.encounter };
  write(`${outputDir}/summary.json`, summary);
  // Each full transition is one standalone file; no giant all-boundaries object.
  // Publishing is exclusive. Existing authoritative captures cannot be overwritten.
  const fixtureDir = 'tests/fixtures/concealment-servant-v01690'; mkdirSync(fixtureDir, { recursive: true });
  for (const [source, target] of [[naturalPath, 'natural.json'], [`${outputDir}/summary.json`, 'summary.json'], [`${outputDir}/boundaries.index.json`, 'boundaries.index.json'], ...Object.entries(snapshots).map(([key, path]) => [path, `snapshot-${key}.json`]), ...Object.values(boundaries).map(name => [`${outputDir}/${name}`, name])]) copyFileSync(source, `${fixtureDir}/${target}`, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ passed: true, stage, outputDir, fixtureDir, commands: commands.length, prefixCount, boundaries: Object.keys(boundaries), summary: 'summary.json' }));
}
try {
  assert.equal(prefixCount, 420); assert.equal(old.prefixCount, 291); assert.equal(old.stage, 'FULL_NATURAL_BRANCH'); assert.equal(seed, 'sleepless-natural-v020');
  s = createSliceRun(old.final.runId, creation, seed); assertValidSliceState(s);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands); assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated original terminal must match without any repairs');
  assert.deepEqual(s.random, old.final.random); assert.equal(s.random.cursor, 334);
  assert.equal(s.week, 105); assert.equal(s.health, 80); assert.equal(s.mind, 100); assert.equal(s.spirituality, 111); assert.equal(s.cash, 580); assert.equal(s.actionsRemaining, 3);
  assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100); assert.equal(s.fearBishop.promotionWeek, 97);
  prefixVerified = true; snapshot('departureStart'); capture('inherited-full-s3-final');
  recoverOriginalInjuries(); assertLegacyPreserved();
  ready({ cash: 500, ap: 2 }); snapshot('guidanceStart'); const guideCash = s.cash;
  cs({ type: 'LEARN_GUIDANCE' }, 'independent-guidance'); assert.equal(s.cash, guideCash - 500); clear();
  for (const taskId of ['CHECK_BOUNDARY', 'AGREE_RETURN', 'TRACE_LIMIT']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.concealmentServant.bottles.find(b => b.status === 'PLAYER') ?? s.concealmentServant.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({ type: 'REQUEST_SUPPLY' }, 'paid-real-supply-request'); const requestedWeek = s.concealmentServant.resupply.requestedWeek;
      ready({ afterWeek: requestedWeek }); cs({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-supply'); bottle = s.concealmentServant.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'Independent source bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.concealmentServant.bottles.find(b => b.id === bottleId).labourSteps < 5) action({ type: 'POTION_WORK', bottleId });
      ready({ cash: 920 }); const cash = s.cash; cs({ type: 'BUY_POTION', bottleId }, 'buy-independent-bottle'); assert.equal(s.cash, cash - 800);
    }
    ready({ cash: 120, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.fearBishop.promotionWeek + 11 });
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    cs({ type: 'PREPARE_PROMOTION' }, 'current-week-paid-preparation'); assert.equal(s.cash, prep.cash - 120); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), health: s.health, mind: s.mind, pollution: s.seer.pollution, spirituality: s.spirituality, injuries: structuredClone(s.injuries), risk: s.injuryRisk };
    cs({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'promotion' : 'actual-potion-failure');
    assert.equal(s.concealmentServant.preparedWeek, null); assert.equal(s.concealmentServant.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.equal(s.spirituality, before.spirituality); assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const tier = s.concealmentServant.bottles.find(b => b.id === bottleId).outcome;
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[tier]; assert(costs);
    assert.equal(s.health, Math.max(1, before.health - costs[0])); assert.equal(s.mind, Math.max(1, before.mind - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], stat + (s.progression.sequence === 2 ? 1 : 0));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite independent bottles all failed; preserve the real costs without forced promotion');
  assert.equal(s.concealmentServant.fearBishopActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
  for (const caseId of CASES) { action({ type: 'OBSERVE', caseId }); practice(caseId); action({ type: 'REPORT', caseId }, `${caseId}-report`); }
  action({ type: 'REFLECT' }, 'reflection'); assert.equal(s.progression.acting, 100); assertLegacyPreserved();
  for (const [index, key] of ['concealment', 'traceVeil'].entries()) assert.equal(s.progression.mastery[NEW_IDS[index]], CASES.reduce((n, id) => n + (attempt(id)[key].effects > 0 ? 8 : 0), 0));
  snapshot('practiced');
  ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 }); assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  cs({ type: 'ENCOUNTER_TALK' }, 'original-enemy-approach'); cs({ type: 'ENCOUNTER_FIGHT' }, 'original-enemy-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'CONCEALMENT_SERVANT_DISPUTE'); assert.equal(s.concealmentServant.encounter.enemySpirituality, 120);
  const masteryBeforeCombat = structuredClone(s.progression.mastery);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK' }, round === 0 ? 'combat-first' : null);
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat, 'Combat has no extra mastery award');
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not terminated'); assert(s.concealmentServant.encounter.terminal);
  if (s.status === 'ACTIVE') { assert.equal(s.concealmentServant.encounter.playerLocation, 'OUTSIDE'); ordinary('ordinary-life-after-actual-exit'); }
  assertLegacyPreserved(); save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  const blocker = writeNatural('ACTUAL_BLOCKER', error); write(`${outputDir}/blocker.boundaries.index.json`, boundaries);
  console.error(JSON.stringify({ passed: false, outputDir, blocker, commandCount: commands.length, prefixVerified, error: String(error) })); throw error;
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
