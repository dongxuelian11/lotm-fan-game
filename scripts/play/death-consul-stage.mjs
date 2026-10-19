import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Static candidate. Lead runs after compilation, once per intentional public route:
// node --max-old-space-size=512 scripts/play/death-consul-stage.mjs
// No state edits, reseeding, cursor search, failure reloads, free injury treatment,
// old-prefix substitution, death erasure, or overwrite of existing captures.
const load = name => import(pathToFileURL(resolve(`dist/domain/slice/${name}.js`)).href);
const { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await load('index');
const { migrateSliceState } = await load('migration');
const { validateSlicePayload } = await load('validation');
const sourceFixture = 'tests/fixtures/ferryman-v01490/natural.json';
const old = Object.fromEntries(['creation', 'seed', 'commands', 'final', 'prefixCount'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const { creation, seed } = old, prefixCount = old.commands.length;
const CASES = ['pale-residue', 'short-passage', 'withdrawn-passage'];
const NEW_IDS = ['death.s2.pale-flame', 'death.s2.spirit-passage'];
const MAX_COMMANDS = 3500, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, snapshots = {}, treatments = [];
let s = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/death-consul-01730-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => pub().deathConsul;
const life = () => s.deathConsul.life, attempt = id => life().cases[id].attempts.at(-1);
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete 611-command prefix');
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
  assert.equal(next.revision, s.revision + 1); assert.equal(next.weeklyBudget, prefixVerified ? 4 : next.weeklyBudget);
  s = next; commands.push(structuredClone(intent)); pendingIntent = null;
  if (prefixVerified) {
    append(commandsFile, { index: commands.length, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision, randomBefore: beforeLast.random, randomAfter: s.random });
    append(publicFile, { index: commands.length, public: pub() });
    if (boundary) capture(boundary);
    console.log(JSON.stringify({ index: commands.length, intent, week: s.week, status: s.status, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting }));
  }
}
function ct(command, boundary = null) {
  pendingIntent = { type: 'DEATH_CONSUL', command: structuredClone(command) };
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a public action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'DEATH_CONSUL', command }, boundary ?? `public-${command.type.toLowerCase()}${'caseId' in command ? `-${command.caseId}` : ''}`);
}
function clear() { assert.equal(s.activeEvent,null);assert.equal(s.pulse,'NONE'); }
function era(type,boundary=null) {
  const action=pub().ferryman.era.actions.find(a=>a.command.type===type);
  assert(action,`Missing current-era action ${type}`);assert(action.enabled,action.reason);
  go({type:'FERRYMAN',command:{type}},boundary);
}
function ordinary(boundary=null,forceRest=false) {
  clear();assert.equal(s.status,'ACTIVE');assert(!view().insideCase&&!s.combat);
  if(s.ferryman.era.location==='OUTSIDE')era('ERA_ENTER');
  if(s.actionsRemaining===0) {
    if(s.cash<24)era('ERA_WORK','real-emergency-work');
    era('ERA_NEXT_WEEK',boundary);return;
  }
  if(forceRest&&s.cash>=32)era('ERA_REST',boundary);else era('ERA_WORK',boundary);
}
function ready({cash=0,ap=1,health=0,mind=0,spirituality=0,pollution=100,afterWeek=-1}={}) {
  clear();assert(ap<=4);
  let n=0;
  while(s.cash<cash||s.actionsRemaining<ap||s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution||s.week<=afterWeek) {
    assert(n++<1000,'Finite current-era preparation strategy exhausted');
    const recovering=s.health<health||s.mind<mind||s.spirituality<spirituality||s.seer.pollution>pollution;
    ordinary(null,recovering);
  }
}
function action(command,boundary=null){ready();ct(command,boundary);clear();}
function assertLegacyPreserved() {
  assert.equal(s.runId,old.final.runId);assert.equal(s.random.seed,seed);assert.equal(s.character.gender,old.final.character.gender);
  for(const key of ['corpsecollector','gravedigger','spiritmedium','spiritGuide','gatekeeper','undying','longChapter'])assert.deepEqual(s[key],old.final[key],`Preserve original ${key}`);
  for(const key of Object.keys(old.final.ferryman).filter(k=>k!=='era'))assert.deepEqual(s.ferryman[key],old.final.ferryman[key],`Preserve ferryman ${key}`);
  for(const [id,m]of Object.entries(old.final.progression.mastery))assert.equal(s.progression.mastery[id],m);
  assert.equal(Object.keys(s.progression.mastery).length,s.progression.sequence===2?17:15);
  assert.deepEqual(s.town,old.final.town);assert.deepEqual(s.combatHistory.slice(0,old.final.combatHistory.length),old.final.combatHistory);
}
function practice(caseId){
  ready({cash:40,ap:2,health:90,mind:85,spirituality:30});
  ct({type:'PREPARE',caseId,method:'ABILITY'},`${caseId}-prepared`);
  const step=(type,key=null)=>ct({type,caseId},key);
  step('CONSENT_OPERATOR');
  if(caseId==='pale-residue'){step('BUY_SEAL');step('INSPECT_RESIDUAL');step('OPEN_CONTAINER');}
  else {step('CHECK_ENDPOINTS');step('TAKE_RESIDUAL');}
  const paid=s.spirituality;step('PERFORM',`${caseId}-paid-window`);assert.equal(paid-s.spirituality,caseId==='pale-residue'?7:6);
  const enabled=type=>view().actions.some(a=>a.command.type===type&&a.command.caseId===caseId&&a.enabled);
  if(caseId==='pale-residue'){
    if(enabled('APPLY_FLAME'))step('APPLY_FLAME',`${caseId}-actual-application`);
    step('STOP');step('CLOSE_CONTAINER');while(life().site.residual.heatSeconds>0)step('WAIT_10');step('SEAL_CONTAINER');
  } else if(caseId==='short-passage'){
    if(enabled('CROSS_PASSAGE'))step('CROSS_PASSAGE',`${caseId}-actual-application`);
    else {step('STOP');step('WALK_OUT',`${caseId}-ordinary-original-route`);}
    if(enabled('STOP'))step('STOP');step('RETURN_GROUP');step('RETURN_RESIDUAL');
  } else {step('WITHDRAW_PERMISSION',`${caseId}-current-withdrawal`);assert.deepEqual(attempt(caseId).appliedAbilityIds,[]);step('STOP');step('RETURN_RESIDUAL');}
  if(life().site.door.state==='OPEN')step('CLOSE_DOOR');
  step('INSPECT');step('LEAVE',`${caseId}-actual-return`);
  assert.equal(life().site.effect.mode,'OFF');assert.equal(life().site.playerLocation,'ENTRY');assert.equal(life().site.operatorLocation,'ENTRY');
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
    bottles: s.deathConsul.bottles.map(b => ({ id: b.id, outcome: b.outcome, status: b.status })),
    cases: CASES.map(id => ({ id, ...life().cases[id] })), mastery: Object.fromEntries(NEW_IDS.map(id => [id, s.progression.mastery[id]])), site: life().site, encounter: s.deathConsul.encounter };
  write(`${outputDir}/summary.json`, summary);
  // Each full transition is one standalone file; no giant all-boundaries object.
  // Publishing is exclusive. Existing authoritative captures cannot be overwritten.
  const fixtureDir = 'tests/fixtures/death-consul-v01730'; mkdirSync(fixtureDir, { recursive: true });
  for (const [source, target] of [[naturalPath, 'natural.json'], [`${outputDir}/summary.json`, 'summary.json'], [`${outputDir}/boundaries.index.json`, 'boundaries.index.json'], ...Object.entries(snapshots).map(([key, path]) => [path, `snapshot-${key}.json`]), ...Object.values(boundaries).map(name => [`${outputDir}/${name}`, name])]) copyFileSync(source, `${fixtureDir}/${target}`, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ passed: true, stage, outputDir, fixtureDir, commands: commands.length, prefixCount, boundaries: Object.keys(boundaries), summary: 'summary.json' }));
}
try {
  assert.equal(prefixCount,611);assert.equal(old.final.status,'ACTIVE');
  s=createSliceRun(old.final.runId,creation,seed);assertValidSliceState(s);
  for(const command of old.commands)go(command);
  assert.deepEqual(commands,old.commands);assert.deepEqual(s,migrateSliceState(old.final),'Entire migrated original terminal must match');
  assert.deepEqual(s.random,old.final.random);assert.equal(s.week,3260);assert.equal(s.health,40);assert.equal(s.injuries.filter(i=>i.severity==='HEAVY'&&i.treatedRevision===null).length,2);
  assert.equal(s.progression.pathwayId,'death');assert.equal(s.progression.sequence,3);assert.equal(s.progression.acting,100);
  prefixVerified = true; snapshot('departureStart'); capture('inherited-full-s3-final');
  assertLegacyPreserved();
  ready({cash:84,ap:1});
  const treatmentBefore={cash:s.cash,injuries:structuredClone(s.injuries),health:s.health,risk:s.injuryRisk};
  era('ERA_CARE','actual-current-era-care60');assert.equal(s.cash,treatmentBefore.cash-60);assert.equal(s.health,treatmentBefore.health);assert.equal(s.injuryRisk,treatmentBefore.risk);
  treatments.push({before:treatmentBefore,after:structuredClone(s.injuries),paidPennies:60});
  ready({health:100,mind:100,spirituality:120,pollution:0});assert.equal(s.injuries.length,0);
  ready({ cash: 144, ap: 2 }); snapshot('guidanceStart'); const guideCash = s.cash;
  ct({ type: 'LEARN_GUIDANCE' }, 'independent-guidance'); assert.equal(s.cash, guideCash - 120); clear();
  for (const taskId of ['CHECK_ANCHORS', 'REVIEW_RESIDUAL', 'PLAN_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.deathConsul.bottles.find(b => b.status === 'PLAYER') ?? s.deathConsul.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      const countBefore = s.deathConsul.bottles.length;
      action({ type: 'REQUEST_SUPPLY' }, 'paid-real-supply-request'); const requestedWeek = s.deathConsul.resupply.requestedWeek;
      assert.equal(s.deathConsul.bottles.length, countBefore); assert.notEqual(requestedWeek, null);
      ready({ afterWeek: requestedWeek }); assert(s.week > requestedWeek);
      ct({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-supply');
      assert.equal(s.deathConsul.bottles.length, countBefore + 3);
      bottle = s.deathConsul.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'Independent original source bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.deathConsul.bottles.find(b => b.id === bottleId).labourSteps < 5) action({ type: 'POTION_WORK', bottleId });
      ready({ cash: 124 }); const cash = s.cash; ct({ type: 'BUY_POTION', bottleId }, 'buy-independent-bottle'); assert.equal(s.cash, cash - 80);
    }
    ready({ cash: 44, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.ferryman.promotionWeek + 11 });
    assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0);
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    ct({ type: 'PREPARE_PROMOTION' }, 'current-week-paid-preparation');
    assert.equal(s.cash, prep.cash - 20); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    assert.equal(s.deathConsul.preparedWeek, s.week);
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), health: s.health, mind: s.mind, pollution: s.seer.pollution, spirituality: s.spirituality, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
    ct({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'promotion' : 'actual-potion-failure');
    assert.equal(s.deathConsul.preparedWeek, null); assert.equal(s.deathConsul.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.spirituality);
    assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const tier = s.deathConsul.bottles.find(b => b.id === bottleId).outcome;
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[tier]; assert(costs);
    assert.equal(s.health, Math.max(1, before.health - costs[0])); assert.equal(s.mind, Math.max(1, before.mind - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], stat + (s.progression.sequence === 2 ? 1 : 0));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite independent bottles all failed; retain real costs without forced promotion');
  assert.equal(s.deathConsul.ferrymanActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
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
  assert.deepEqual(s.deathConsul.encounter.startSite, closedSite, 'Encounter keeps immutable provenance of the actual closed life site');
  for(const key of ['door','residual','material'])assert.deepEqual(life().site[key],closedSite[key]);
  assert.equal(life().site.playerLocation,'NEAR');assert.equal(life().site.operatorLocation,'OUTSIDE');
  ct({ type: 'ENCOUNTER_FIGHT' }, 'original-enemy-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'DEATH_CONSUL_DISPUTE'); assert.equal(s.deathConsul.encounter.targetId, 'DC2-P-NOLAN');
  assert.equal(s.deathConsul.encounter.enemySpirituality, 120);
  const masteryBeforeCombat = structuredClone(s.progression.mastery);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK' }, round === 0 ? 'combat-first' : `combat-round-${round + 1}`);
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat, 'Combat has no extra mastery award');
    assert.deepEqual(s.deathConsul.encounter.startSite, closedSite, 'The immutable life provenance snapshot cannot be changed by combat');
    assert.deepEqual(life().site.residual,closedSite.residual);assert.deepEqual(life().site.material,closedSite.material);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not terminated'); assert(s.deathConsul.encounter.terminal);
  if (s.status === 'ACTIVE') { assert.equal(life().site.playerLocation, 'ENTRY'); ordinary('ordinary-life-after-actual-exit'); }
  else { assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert(['NEAR','OTHER'].includes(life().site.playerLocation)); }
  assertLegacyPreserved();
  assert.deepEqual(readObjectEntry(sourceFixture, 'commands'), old.commands, 'The original611 public commands remain unchanged');
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
