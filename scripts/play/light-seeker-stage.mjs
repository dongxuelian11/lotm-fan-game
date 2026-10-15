import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Static candidate. Lead runs after compilation, once per intentional public route:
// node --max-old-space-size=512 scripts/play/light-seeker-stage.mjs
// No state edits, reseeding, cursor search, failure reloads, free injury treatment,
// old-prefix substitution, death erasure, or overwrite of existing captures.
const load = name => import(pathToFileURL(resolve(`dist/domain/slice/${name}.js`)).href);
const { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await load('index');
const { migrateSliceState } = await load('migration');
const { validateSlicePayload } = await load('validation');
const sourceFixture = 'tests/fixtures/justice-mentor-v01480/peaceful.json';
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final', 'prefixCount'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const { creation, seed } = old, prefixCount = old.commands.length;
const CASES = ['marker-path', 'screened-return', 'withdrawn-visit'];
const NEW_IDS = ['sun.s2.guided-radiance', 'sun.s2.limited-light'];
const MAX_COMMANDS = 2200, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, snapshots = {}, treatments = [];
let s = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/light-seeker-01720-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => pub().lightSeeker;
const life = () => s.lightSeeker.life, attempt = id => life().cases[id].attempts.at(-1);
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete 582-command prefix');
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
function ct(command, boundary = null) {
  pendingIntent = { type: 'LIGHT_SEEKER', command: structuredClone(command) };
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a public action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'LIGHT_SEEKER', command }, boundary ?? `public-${command.type.toLowerCase()}${'caseId' in command ? `-${command.caseId}` : ''}`);
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
function action(command, boundary = null) { ready(); ct(command, boundary); clear(); }
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed);
  assert.equal(s.character.gender, old.final.character.gender);
  for (const key of ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed', 'justiceMentor']) {
    assert.deepEqual(s[key], old.final[key], `Preserve every original ${key} fact`);
  }
  assert.equal(Object.keys(old.final.progression.mastery).length, 18);
  for (const [id, mastery] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Preserve original mastery ${id}`);
  assert.equal(Object.keys(s.progression.mastery).length, s.progression.sequence === 2 ? 20 : 18);
  assert.deepEqual(s.town, old.final.town, 'No free club, bandages, crafting or ordinary equipment');
  assert.deepEqual(s.combatHistory.slice(0, old.final.combatHistory.length), old.final.combatHistory, 'All original combat rounds and deaths remain unchanged');
  assert.deepEqual(s.seer.completedSources.slice(0, old.final.seer.completedSources.length), old.final.seer.completedSources, 'Old sources cannot be replaced or rewarded again');
  assert.deepEqual(s.justiceMentor.encounter,old.final.justiceMentor.encounter);
  assert.deepEqual(s.unshadowed,old.final.unshadowed);
}
function practice(caseId) {
  ready({ap:2,health:90,mind:85,spirituality:30});
  const startSite=structuredClone(life().site);
  ct({type:'PREPARE',caseId,method:'ABILITY'},`${caseId}-prepared`);
  const step=(type,key=null)=>ct({type,caseId},key);
  step('CONSENT_OPERATOR');
  if(caseId==='marker-path') step('OPEN_SHUTTER');
  else if(caseId==='screened-return') {step('MOVE_OPERATOR_FAR');step('PLACE_COVER');step('OPEN_SHUTTER');}
  else {step('CONSENT_SPIRIT');step('INVITE_SPIRIT');step('RETIRE_SPIRIT');step('PLACE_COVER');step('OPEN_SHUTTER');}
  const paidBefore=s.spirituality;
  step('PERFORM',`${caseId}-paid-window`);assert.equal(paidBefore-s.spirituality,caseId==='marker-path'?7:9);
  if(caseId==='marker-path') {
    step('MOVE_OPERATOR_FAR');
    if(view().actions.some(a=>a.command.type==='TRACE_MARK'&&a.command.caseId===caseId&&a.enabled))step('TRACE_MARK',`${caseId}-actual-application`);
    else step('READ_LAMP',`${caseId}-ordinary-original-lamp`);
    step('STOP');step('RETURN_OPERATOR');step('CLOSE_SHUTTER');
  } else if(caseId==='screened-return') {
    if(view().actions.some(a=>a.command.type==='PASS_OPERATOR'&&a.command.caseId===caseId&&a.enabled))step('PASS_OPERATOR',`${caseId}-actual-application`);
    else {step('STOP');if(life().site.shutter.state==='OPEN')step('CLOSE_SHUTTER');step('RETURN_OPERATOR');}
    if(life().site.light.mode!=='OFF')step('STOP');step('INSPECT_SCREEN');if(life().site.shutter.state==='OPEN')step('CLOSE_SHUTTER');step('RETURN_COVER');
  } else {
    step('WITHDRAW_PERMISSION',`${caseId}-current-permission-withdrawn`);
    assert.deepEqual(attempt(caseId).appliedAbilityIds,[]);step('STOP');
    if(life().site.shutter.state==='OPEN')step('CLOSE_SHUTTER');step('RETURN_COVER');
  }
  step('INSPECT');step('LEAVE',`${caseId}-actual-return`);clear();
  assert.equal(life().site.light.mode,'OFF');assert.equal(life().site.playerLocation,'ENTRY');
  assert.equal(life().site.operatorLocation,'ENTRY');assert.equal(life().site.spiritLocation,'SIDE');
  assert.equal(attempt(caseId).spiritualitySpent,caseId==='marker-path'?7:9);
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
    bottles: s.lightSeeker.bottles.map(b => ({ id: b.id, outcome: b.outcome, status: b.status })),
    cases: CASES.map(id => ({ id, ...life().cases[id] })), mastery: Object.fromEntries(NEW_IDS.map(id => [id, s.progression.mastery[id]])), site: life().site, encounter: s.lightSeeker.encounter };
  write(`${outputDir}/summary.json`, summary);
  // Each full transition is one standalone file; no giant all-boundaries object.
  // Publishing is exclusive. Existing authoritative captures cannot be overwritten.
  const fixtureDir = 'tests/fixtures/light-seeker-v01720'; mkdirSync(fixtureDir, { recursive: true });
  for (const [source, target] of [[naturalPath, 'natural.json'], [`${outputDir}/summary.json`, 'summary.json'], [`${outputDir}/boundaries.index.json`, 'boundaries.index.json'], ...Object.entries(snapshots).map(([key, path]) => [path, `snapshot-${key}.json`]), ...Object.values(boundaries).map(name => [`${outputDir}/${name}`, name])]) copyFileSync(source, `${fixtureDir}/${target}`, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ passed: true, stage, outputDir, fixtureDir, commands: commands.length, prefixCount, boundaries: Object.keys(boundaries), summary: 'summary.json' }));
}
try {
  assert.equal(prefixCount,582);assert.equal(seed,'bard-natural-v029');assert.equal(old.final.status,'ACTIVE');assert.equal(old.final.revision,583);
  s=createSliceRun(old.final.runId,creation,seed);assertValidSliceState(s);
  for(const command of old.commands)go(command);
  assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final),'Entire migrated original terminal must match without repairs');
  assert.deepEqual(s.random,old.final.random);assert.equal(s.random.cursor,171);
  assert.equal(s.week,143);assert.equal(s.health,100);assert.equal(s.mind,100);assert.equal(s.spirituality,120);assert.equal(s.cash,620);assert.equal(s.actionsRemaining,1);assert.equal(s.injuryRisk,0);assert.equal(s.injuries.length,0);
  assert.equal(s.progression.pathwayId,'sun');assert.equal(s.progression.sequence,3);assert.equal(s.progression.acting,100);assert.equal(s.justiceMentor.promotionWeek,136);assert.equal(s.progression.promotionWeek,5);
  prefixVerified = true; snapshot('departureStart'); capture('inherited-full-s3-final');
  assertLegacyPreserved();
  ready({ cash: 500, ap: 2 }); snapshot('guidanceStart'); const guideCash = s.cash;
  ct({ type: 'LEARN_GUIDANCE' }, 'independent-guidance'); assert.equal(s.cash, guideCash - 500); clear();
  for (const taskId of ['CHECK_LIGHT_PATH', 'REVIEW_EXPOSURE', 'PLAN_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.lightSeeker.bottles.find(b => b.status === 'PLAYER') ?? s.lightSeeker.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      const countBefore = s.lightSeeker.bottles.length;
      action({ type: 'REQUEST_SUPPLY' }, 'paid-real-supply-request'); const requestedWeek = s.lightSeeker.resupply.requestedWeek;
      assert.equal(s.lightSeeker.bottles.length, countBefore); assert.notEqual(requestedWeek, null);
      ready({ afterWeek: requestedWeek }); assert(s.week > requestedWeek);
      ct({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-supply');
      assert.equal(s.lightSeeker.bottles.length, countBefore + 3);
      bottle = s.lightSeeker.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'Independent original source bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.lightSeeker.bottles.find(b => b.id === bottleId).labourSteps < 5) action({ type: 'POTION_WORK', bottleId });
      ready({ cash: 920 }); const cash = s.cash; ct({ type: 'BUY_POTION', bottleId }, 'buy-independent-bottle'); assert.equal(s.cash, cash - 800);
    }
    ready({ cash: 120, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.justiceMentor.promotionWeek + 11 });
    assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    ct({ type: 'PREPARE_PROMOTION' }, 'current-week-paid-preparation');
    assert.equal(s.cash, prep.cash - 120); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    assert.equal(s.lightSeeker.preparedWeek, s.week);
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), health: s.health, mind: s.mind, pollution: s.seer.pollution, spirituality: s.spirituality, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
    ct({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'promotion' : 'actual-potion-failure');
    assert.equal(s.lightSeeker.preparedWeek, null); assert.equal(s.lightSeeker.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.spirituality);
    assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const tier = s.lightSeeker.bottles.find(b => b.id === bottleId).outcome;
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[tier]; assert(costs);
    assert.equal(s.health, Math.max(1, before.health - costs[0])); assert.equal(s.mind, Math.max(1, before.mind - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], stat + (s.progression.sequence === 2 ? 1 : 0));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite independent bottles all failed; retain real costs without forced promotion');
  assert.equal(s.lightSeeker.justiceMentorActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
  for (const caseId of CASES) {
    action({ type: 'OBSERVE', caseId }); practice(caseId); action({ type: 'REPORT', caseId }, `${caseId}-report`);
    assert.equal(life().cases[caseId].status, 'RESOLVED'); assertLegacyPreserved();
  }
  action({ type: 'REFLECT' }, 'reflection'); assert.equal(s.progression.acting, 100); assertLegacyPreserved();
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], CASES.reduce((n, caseId) => n + (attempt(caseId).appliedAbilityIds.includes(id) ? 8 : 0), 0));
  snapshot('practiced');
  // One intentional optional encounter. Stances depend only on visible health
  // and round number: CONTROL twice, then ATTACK; RETREAT at health <= 40.
  // No inherited paid CRAFT, resource edit, reload, or search for a winning draw.
  ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 }); assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
  const closedSite = structuredClone(life().site);
  ct({ type: 'ENCOUNTER_TALK' }, 'original-enemy-approach');
  assert.deepEqual(s.lightSeeker.encounter.startSite, closedSite, 'Encounter keeps immutable provenance of the actual closed life site');
  for(const key of ['shutter','lamp','cover','screen','board'])assert.deepEqual(life().site[key],closedSite[key],`Approach does not reset ${key}`);
  assert.equal(life().site.playerLocation,'NEAR');assert.equal(life().site.operatorLocation,'SIDE');assert.equal(life().site.spiritLocation,'SIDE');
  ct({ type: 'ENCOUNTER_FIGHT' }, 'original-enemy-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'LIGHT_SEEKER_DISPUTE'); assert.equal(s.lightSeeker.encounter.targetId, 'LS2-OWEN');
  assert.equal(s.lightSeeker.encounter.enemySpirituality, 120);
  const masteryBeforeCombat = structuredClone(s.progression.mastery);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK' }, round === 0 ? 'combat-first' : `combat-round-${round + 1}`);
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat, 'Combat has no extra mastery award');
    assert.deepEqual(s.lightSeeker.encounter.startSite, closedSite, 'The immutable life provenance snapshot cannot be changed by combat');
    assert.equal(life().site.lamp.oil,closedSite.lamp.oil);
    assert(life().site.shutter.durability<=closedSite.shutter.durability);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not terminated'); assert(s.lightSeeker.encounter.terminal);
  if (s.status === 'ACTIVE') { assert.equal(life().site.playerLocation, 'ENTRY'); ordinary('ordinary-life-after-actual-exit'); }
  else { assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert.equal(life().site.playerLocation, 'NEAR'); }
  assertLegacyPreserved();
  assert.deepEqual(readObjectEntry(sourceFixture, 'commands'), old.commands, 'The original582 public commands remain unchanged');
  assert.deepEqual(readObjectEntry(sourceFixture, 'final'), old.final, 'The source terminal, its original people and separate death branch remain unchanged');
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
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
