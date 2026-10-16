import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';

// Run from the repository root after the lead has compiled the current sources.
// Every state transition below is a public player command. Never reseed, reload a
// failed check, edit the historical capture, or refill a character/member here.
const old = JSON.parse(readFileSync('tests/fixtures/manipulator-v01190/natural.json', 'utf8'));
const creation = old.creation, seed = old.seed, prefixCount = old.commands.length;
const commands = [], boundaries = {}, MAX_COMMANDS = 1800;
// Keep at most twenty transaction boundaries; the complete command transcript
// and the four stage snapshots retain all other original transitions.
const BOUNDARY_KEYS = new Set(['guidance','preparation-plan_withdrawal','potion-work-5','buy-independent-potion','prepare-current-week','consume-failure','promotion','request-supply','receive-next-week-supply','two-desks-ability-outcome','original-message-ability-outcome','original-message-returned','woven-bell-ability-outcome','reflection','combat-first','combat-terminal','aid-enemy','ordinary-life-after-exit']);
const CASES = ['two-desks','original-message','woven-bell'];
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
const dw = (command, key = null) => go({type: 'DREAM_WEAVER', command}, key);
const view = () => projectSliceState(s).dreamWeaver;
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
  ready({ap:2,health:90,mind:85,spirituality:20});
  dw({type:'PREPARE',caseId,method:'ABILITY'});
  for(const personId of ['DWV3-IRIS','DWV3-OWEN'])dw({type:'CONSENT',personId});
  dw({type:'PERFORM',caseId});
  const p=()=>s.dreamWeaver.life.practice;
  if(caseId!=='woven-bell') {
    dw({type:'CREATE_IDENTITY'},`${caseId}-ability-outcome`);
    const actor=p().identity?'IDENTITY':'OWNER';
    if(caseId==='two-desks')dw({type:'TALK',actor:'OWNER',personId:'DWV3-OWEN'});
    dw({type:'MOVE',actor,to:'FAR'});
    if(caseId==='two-desks')dw({type:'TALK',actor,personId:'DWV3-IRIS'});
    else dw({type:'READ_MESSAGE',actor});
    if(p().identity)dw({type:'REJOIN_IDENTITY'});
    if(caseId==='original-message'){
      if(p().ownerNode!=='FAR')dw({type:'MOVE',actor:'OWNER',to:'FAR'});
      dw({type:'TAKE_MESSAGE'});dw({type:'MOVE',actor:'OWNER',to:'NEAR'});dw({type:'CHECK_MESSAGE'});
      dw({type:'MOVE',actor:'OWNER',to:'FAR'});dw({type:'RETURN_MESSAGE'},'original-message-returned');
    }
    if(p().ownerNode!=='NEAR')dw({type:'MOVE',actor:'OWNER',to:'NEAR'});
  }else{
    dw({type:'WOVEN_IMAGE'},'woven-bell-ability-outcome');
    if(p().image){dw({type:'BELIEVE_IMAGE'});dw({type:'RECOGNIZE_IMAGE'});dw({type:'STOP_IMAGE'});}
    dw({type:'CHECK_BELL'});
  }
  dw({type:'VERIFY',caseId});dw({type:'CLOSE',caseId});clear();
}
function assertLegacyPreserved(){
  assert.equal(s.runId,old.final.runId);assert.equal(s.random.seed,seed);
  assert.equal(s.character.gender,old.final.character.gender);
  for(const key of ['audience','mindreader','psychologist','hypnotist','dreamwalker','manipulator'])assert.deepEqual(s[key],old.final[key],`Preserve all original ${key} facts`);
}
function save(stage) {
  const result = {creation, seed, commands, prefixCount, stage, departureStart, guidanceStart,
    promoted, practiced, combatStart, beforeLast, lastIntent, final: s};
  writeFileSync('output/play/dream-weaver-stage-natural.json', JSON.stringify(result));
  for (const [key, boundary] of Object.entries(boundaries)) {
    writeFileSync(`output/play/dream-weaver-${key}-save-boundary.json`, JSON.stringify(boundary));
  }
  mkdirSync('tests/fixtures/dream-weaver-v01420', {recursive: true});
  writeFileSync('tests/fixtures/dream-weaver-v01420/natural.json', JSON.stringify(result));
  writeFileSync('tests/fixtures/dream-weaver-v01420/boundaries.json', JSON.stringify(boundaries));
  console.log(JSON.stringify({passed: true, stage, commands: commands.length, prefixCount,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    bottles: s.dreamWeaver.bottles.map(b => ({id: b.id, outcome: b.outcome})),
    cases: CASES.map(id => ({id, result: s.dreamWeaver.life.cases[id].result, attempts: s.dreamWeaver.life.cases[id].attempts})),
    encounter: s.dreamWeaver.encounter, boundaries: Object.keys(boundaries)}));
}

try {
  assert.equal(prefixCount, 354, 'Replay the complete original 0.119 capture');
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
  for (const taskId of ['INSPECT_ROUTE','CHECK_ORIGINALS','PLAN_WITHDRAWAL']) {
    action({type: 'PREPARE_TASK', taskId}, `preparation-${taskId.toLowerCase()}`);
  }
  for (let attempt = 0; s.progression.sequence === 4 && attempt < 12; attempt++) {
    let bottle = s.dreamWeaver.bottles.find(b => b.status === 'PLAYER') ?? s.dreamWeaver.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-supply');
      const requestedWeek = s.dreamWeaver.resupply.requestedWeek;
      ready({afterWeek: requestedWeek});
      assert(s.week > requestedWeek);
      dw({type: 'RECEIVE_SUPPLY'}, 'receive-next-week-supply');
      bottle = s.dreamWeaver.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A real independent bottle must exist');
    const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.dreamWeaver.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const step = s.dreamWeaver.bottles.find(b => b.id === bottleId).labourSteps + 1;
        action({type: 'POTION_WORK', bottleId}, step === 1 || step === 5 ? `potion-work-${step}` : null);
      }
      ready({cash: 920});
      const cash = s.cash;
      dw({type: 'BUY_POTION', bottleId}, 'buy-independent-potion');
      assert.equal(s.cash, cash - 800, 'Five labour commands discount only this original bottle');
    }
    ready({cash: 120, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.manipulator.promotionWeek + 11});
    const resources = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    dw({type: 'PREPARE_PROMOTION'}, 'prepare-current-week');
    assert.equal(s.actionsRemaining, resources.ap - 1);
    assert.equal(s.cash, resources.cash - 120);
    assert.equal(s.week, resources.week);
    assert.equal(s.dreamWeaver.preparedWeek, s.week);
    const originalMastery = structuredClone(s.progression.mastery);
    dw({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 3 ? 'promotion' : 'consume-failure');
    assert.equal(s.dreamWeaver.preparedWeek, null, 'The actual preparation is consumed on every outcome');
    assert.equal(s.dreamWeaver.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assertLegacyPreserved();
    for (const [id, value] of Object.entries(originalMastery)) assert.equal(s.progression.mastery[id], value);
    clear();
    if (s.progression.sequence === 4) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 3, 'Twelve actual bottles failed; preserve the real blocker without forced promotion');
  assert.equal(s.progression.acting, 0);
  assert.equal(s.dreamWeaver.manipulatorActingAtPromotion, 100);
  assert.equal(s.progression.mastery['audience.s3.external-identity'], 0);
  assert.equal(s.progression.mastery['audience.s3.woven-image'], 0);
  assertLegacyPreserved();
  promoted = structuredClone(s);

  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId});
    practice(caseId);
    assert.equal(s.dreamWeaver.life.cases[caseId].status, 'EXAMINED');
    action({type: 'REPORT', caseId}, `${caseId}-report`);
    assert.equal(s.dreamWeaver.life.cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection');
  assert.equal(s.progression.acting, 100);
  practiced = structuredClone(s);

  ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});
  dw({type:'ENCOUNTER_TALK'});
  dw({type: 'ENCOUNTER_FIGHT'}, 'combat-start');
  combatStart = structuredClone(s);
  assert.equal(s.combat.encounterId, 'DREAM_WEAVER_DISPUTE');
  assert.equal(s.dreamWeaver.encounter.enemySpirituality, 120);
  assertLegacyPreserved();
  for (let round = 0; s.combat && round < 100; round++) {
    const stance = s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    go({type: 'COMBAT_ROUND', stance}, round === 0 ? 'combat-first' : null);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not reached a terminal outcome');
  assert(s.dreamWeaver.encounter.terminal, 'Keep the real death, surrender or ordinary retreat result');
  assertLegacyPreserved();
  if(s.status==='ACTIVE'){
    while(s.dreamWeaver.encounter.mentalPlague>0&&s.dreamWeaver.encounter.enemyHealth>0){
      ready({cash:40,afterWeek:s.dreamWeaver.encounter.helpHistory.at(-1)?.week??-1});
      dw({type:'AID_ENEMY'},'aid-enemy');clear();
    }
    ordinary('ordinary-life-after-exit');
  }
  assertLegacyPreserved();
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  writeFileSync('output/play/dream-weaver-stage-blocker.json', JSON.stringify({creation, seed, commands,
    prefixCount, prefixVerified, departureStart, guidanceStart, promoted, practiced, combatStart,
    beforeLast, lastIntent, final: s, boundaries, error: String(error), stack: error.stack}));
  throw error;
}
