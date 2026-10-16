import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';

// Run from the repository root after the lead has compiled the current sources.
// Every state transition below is a public player command. Never reseed, reload a
// failed check, edit the historical capture, or refill a character/member here.
const old = JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8'));
const creation = old.creation, seed = old.seed, prefixCount = old.commands.length;
const commands = [], boundaries = {}, MAX_COMMANDS = 1800;
// Keep at most twenty transaction boundaries; the complete command transcript
// and the four stage snapshots retain all other original transitions.
const BOUNDARY_KEYS = new Set(['guidance','preparation-plan_return','potion-work-5','buy-independent-potion','prepare-current-week','consume-failure','promotion','request-supply','receive-next-week-supply','paired-lift-ability','paired-lift-return','faded-label-ability','faded-label-verify','shielded-sample-ability','shielded-sample-sealed','reflection','combat-first','combat-terminal','ordinary-life-after-exit']);
const CASES = ['paired-lift','faded-label','shielded-sample'];
let s = null, beforeLast = null, lastIntent = null, prefixVerified = false;
let departureStart = null, guidanceStart = null, promoted = null, practiced = null, combatStart = null;
mkdirSync('output/play', {recursive: true});

function capture(key) {
  if (!BOUNDARY_KEYS.has(key) || boundaries[key] || !prefixVerified) return;
  boundaries[key] = {beforeLast, lastIntent, final: structuredClone(s)};
}
function go(intent, key = null) {
  beforeLast = structuredClone(s);
  lastIntent = structuredClone(intent);
  assert(commands.length < MAX_COMMANDS, 'Bounded public play exhausted; keep the actual state');
  s = applySliceIntent(s, intent);
  assertValidSliceState(s);
  commands.push(structuredClone(intent));
  capture(key);
  if (prefixVerified) console.log(JSON.stringify({step: commands.length, command: intent,
    week: s.week, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash,
    AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting}));
}
const dw = (command, key = null) => go({type: 'JUSTICE_MENTOR', command}, key);
const view = () => projectSliceState(s).justiceMentor;
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const event = projectSliceState(s).activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline'
      : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE'
      : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? 'DECLINE' : null;
    assert(choiceId, `Unexpected event ${event.id}; preserve it for review`);
    go({type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId});
  }
  assert.equal(s.activeEvent, null, 'Pending event loop did not finish');
}
function ordinary(key = null) {
  clear();
  assert.equal(s.status, 'ACTIVE', 'Ordinary life cannot resume after actual death');
  assert(!view().insideCase && !s.combat, 'Do not work/rest through a locked original scene');
  go({type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK'}, key);
  clear();
}
function ready({cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1} = {}) {
  clear();
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind ||
      s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) ordinary();
}
function action(command, key = null) {
  ready();
  dw(command, key);
  clear();
}
function practice(caseId) {
  ready({ap:2,spirituality:6});
  dw({type:'PREPARE',caseId,method:'ABILITY'});
  ready({ap:1,spirituality:6});
  dw({type:'PERFORM',caseId});
  const step=(type,key=null,extra={})=>dw({type,caseId,...extra},key);
  step('CONSENT_OWNER');step('GO_SITE');
  if(caseId==='paired-lift') {
    for(const t of ['CONSENT_AYA','CONSENT_NIVEN','CHECK_ROUTE'])step(t);
    step('ENCOURAGE','paired-lift-ability');
    for(const t of ['CARRY_CHEST','RECEIVE_CHEST','RETURN_HELPERS'])step(t);
    step('RETURN_PLAYER','paired-lift-return');
  } else if(caseId==='faded-label') {
    step('REVEAL_GLYPHS','faded-label-ability');
    if(!s.justiceMentor.life.cases[caseId].attempts.at(-1).glyphs.length)step('READ_LAMP');
    step('HYPOTHESIZE',null,{hypothesis:'MISSING_ITEM'});
    for(const t of ['ASK_SELBY','ASK_NIVEN','READ_REGISTER'])step(t);
    step('HYPOTHESIZE',null,{hypothesis:'REASSIGNED'});
    step('VERIFY','faded-label-verify');step('RETURN_ITEMS');step('RETURN_PLAYER');
  } else {
    for(const t of ['CHECK_SCREEN','CONSENT_SPIRIT','MOVE_SPIRIT'])step(t);
    step('PURIFY','shielded-sample-ability');step('STOP_EFFECT');
    step('SEAL_SAMPLE','shielded-sample-sealed');step('INVITE_SPIRIT_RETURN');step('RETURN_PLAYER');
  }
  step('INSPECT');step('CLOSE');
}
function assertLegacyPreserved(){
  assert.equal(s.runId,old.final.runId);assert.equal(s.random.seed,seed);
  assert.equal(s.character.gender,old.final.character.gender);
  for(const key of ['bard','lightprayer','sunpriest','notary','priestOfLight','unshadowed'])assert.deepEqual(s[key],old.final[key],`Preserve all original ${key} facts`);
}
function save(stage) {
  const result = {creation, seed, commands, prefixCount, stage, departureStart, guidanceStart,
    promoted, practiced, combatStart, beforeLast, lastIntent, final: s};
  writeFileSync('output/play/justice-mentor-stage-natural.json', JSON.stringify(result));
  for (const [key, boundary] of Object.entries(boundaries)) {
    writeFileSync(`output/play/justice-mentor-${key}-save-boundary.json`, JSON.stringify(boundary));
  }
  mkdirSync('tests/fixtures/justice-mentor-v01480', {recursive: true});
  writeFileSync('tests/fixtures/justice-mentor-v01480/natural.json', JSON.stringify(result));
  writeFileSync('tests/fixtures/justice-mentor-v01480/boundaries.json', JSON.stringify(boundaries));
  console.log(JSON.stringify({passed: true, stage, commands: commands.length, prefixCount,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    bottles: s.justiceMentor.bottles.map(b => ({id: b.id, outcome: b.outcome})),
    cases: CASES.map(id => ({id, result: s.justiceMentor.life.cases[id].result, attempts: s.justiceMentor.life.cases[id].attempts})),
    encounter: s.justiceMentor.encounter, boundaries: Object.keys(boundaries)}));
}

try {
  assert.equal(prefixCount, 440, 'Replay the complete original 0.125 capture');
  s = createSliceRun(old.final.runId, creation, seed);
  for (const command of old.commands) go(command);
  assert.deepEqual(s, migrateSliceState(old.final), 'The full migrated original terminal state must match without edits');
  assert.deepEqual(commands, old.commands);
  prefixVerified = true;
  departureStart = structuredClone(s);
  ready({cash: 500, ap: 2});
  guidanceStart = structuredClone(s);
  dw({type: 'LEARN_GUIDANCE'}, 'guidance');
  assert.equal(s.cash, guidanceStart.cash - 500);
  clear();
  for (const taskId of ['CHECK_TERMS','REVIEW_BOUNDARIES','PLAN_RETURN']) {
    action({type: 'PREPARE_TASK', taskId}, `preparation-${taskId.toLowerCase()}`);
  }
  for (let attempt = 0; s.progression.sequence === 4 && attempt < 12; attempt++) {
    let bottle = s.justiceMentor.bottles.find(b => b.status === 'PLAYER') ?? s.justiceMentor.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-supply');
      const requestedWeek = s.justiceMentor.resupply.requestedWeek;
      ready({afterWeek: requestedWeek});
      assert(s.week > requestedWeek);
      dw({type: 'RECEIVE_SUPPLY'}, 'receive-next-week-supply');
      bottle = s.justiceMentor.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A real independent bottle must exist');
    const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.justiceMentor.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const step = s.justiceMentor.bottles.find(b => b.id === bottleId).labourSteps + 1;
        action({type: 'POTION_WORK', bottleId}, step === 1 || step === 5 ? `potion-work-${step}` : null);
      }
      ready({cash: 920});
      const cash = s.cash;
      dw({type: 'BUY_POTION', bottleId}, 'buy-independent-potion');
      assert.equal(s.cash, cash - 800, 'Five labour commands discount only this original bottle');
    }
    ready({cash: 120, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.unshadowed.promotionWeek + 11});
    const resources = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    dw({type: 'PREPARE_PROMOTION'}, 'prepare-current-week');
    assert.equal(s.actionsRemaining, resources.ap - 1);
    assert.equal(s.cash, resources.cash - 120);
    assert.equal(s.week, resources.week);
    assert.equal(s.justiceMentor.preparedWeek, s.week);
    const originalMastery = structuredClone(s.progression.mastery);
    dw({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 3 ? 'promotion' : 'consume-failure');
    assert.equal(s.justiceMentor.preparedWeek, null, 'The actual preparation is consumed on every outcome');
    assert.equal(s.justiceMentor.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assertLegacyPreserved();
    for (const [id, value] of Object.entries(originalMastery)) assert.equal(s.progression.mastery[id], value);
    clear();
    if (s.progression.sequence === 4) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 3, 'Twelve actual bottles failed; preserve the real blocker without forced promotion');
  assert.equal(s.progression.acting, 0);
  assert.equal(s.justiceMentor.unshadowedActingAtPromotion, 100);
  assert.equal(s.progression.mastery['sun.s3.shared-radiance'], 0);
  assert.equal(s.progression.mastery['sun.s3.clarity-mark'], 0);
  assertLegacyPreserved();
  promoted = structuredClone(s);

  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId});
    practice(caseId);
    assert.equal(s.justiceMentor.life.cases[caseId].status, 'EXAMINED');
    action({type: 'REPORT', caseId}, `${caseId}-report`);
    assert.equal(s.justiceMentor.life.cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection');
  assert.equal(s.progression.acting, 100);
  practiced = structuredClone(s);

  ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});
  dw({type:'ENCOUNTER_TALK'});
  dw({type: 'ENCOUNTER_FIGHT'}, 'combat-start');
  combatStart = structuredClone(s);
  assert.equal(s.combat.encounterId, 'JUSTICE_MENTOR_DISPUTE');
  assert.equal(s.justiceMentor.encounter.enemySpirituality, 120);
  assertLegacyPreserved();
  for (let round = 0; s.combat && round < 100; round++) {
    const stance = s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    go({type: 'COMBAT_ROUND', stance}, round === 0 ? 'combat-first' : null);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not reached a terminal outcome');
  assert(s.justiceMentor.encounter.terminal, 'Keep the real death, surrender or ordinary retreat result');
  assertLegacyPreserved();
  if(s.status==='ACTIVE')ordinary('ordinary-life-after-exit');
  assertLegacyPreserved();
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  writeFileSync('output/play/justice-mentor-stage-blocker.json', JSON.stringify({creation, seed, commands,
    prefixCount, prefixVerified, departureStart, guidanceStart, promoted, practiced, combatStart,
    beforeLast, lastIntent, final: s, boundaries, error: String(error), stack: error.stack}));
  throw error;
}
