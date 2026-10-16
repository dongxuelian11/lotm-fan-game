import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';

// Run from the repository root after the lead has compiled the current sources.
// Every state transition below is a public player command. Never reseed, reload a
// failed check, edit the historical capture, or refill a character/member here.
const old = JSON.parse(readFileSync('tests/fixtures/dream-weaver-v01420/peaceful-exit.json', 'utf8'));
const creation = old.creation, seed = old.seed, prefixCount = old.commands.length;
const commands = [], boundaries = {}, MAX_COMMANDS = 1800;
// Keep at most twenty transaction boundaries; the complete command transcript
// and the four stage snapshots retain all other original transitions.
const BOUNDARY_KEYS = new Set(['guidance','preparation-plan_withdrawal','potion-work-5','buy-independent-potion','prepare-current-week','consume-failure','promotion','request-supply','receive-next-week-supply','present-mark-formed','present-mark-ability-outcome','present-mark-card-taken','present-mark-checked','present-mark-returned','covered-mark-seal','covered-mark-ability-outcome','covered-mark-stopped','withdrawn-mark-revoked','withdrawn-mark-closed','reflection','combat-start','combat-first','combat-terminal','aid-enemy','ordinary-life-after-exit','clinic-discovery','clinic-pay60','clinic-later-rest']);
const CASES = ['present-mark','covered-mark','withdrawn-mark'];
const PERSONS = {'present-mark':'DCR2-ELENA','covered-mark':'DCR2-BRAM','withdrawn-mark':'DCR2-SELMA'};
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
const dw = (command, key = null) => go({type: 'DISCERNER', command}, key);
const view = () => projectSliceState(s).discerner;
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const event = projectSliceState(s).activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline'
      : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE'
      : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? (s.cash>=60?'PAY':'DECLINE') : null;
    assert(choiceId, `Unexpected event ${event.id}; preserve it for review`);
    const care=event.id==='LIFE-CARE-01'&&choiceId==='PAY',cash=s.cash;
    go({type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId},care?'clinic-pay60':null);
    if(care)assert.equal(s.cash,cash-60,'Actual treatment payment');
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
  const personId=PERSONS[caseId];
  dw({type:'CONSENT',personId,permission:'CONTACT'});
  dw({type:'CONSENT',personId,permission:'MATERIAL'});
  dw({type:'PERFORM',caseId});
  dw({type:'FORM_MARK'},`${caseId}-formed`);
  if(caseId==='covered-mark')dw({type:'ACTIVATE_SEAL'},`${caseId}-seal`);
  if(caseId==='withdrawn-mark')dw({type:'REVOKE_CONSENT',personId,permission:'CONTACT'},`${caseId}-revoked`);
  dw({type:'MOVE',actor:'OWNER',to:'FAR'});
  if(caseId!=='withdrawn-mark') {
    const spiritual=s.spirituality,mind=s.mind;
    dw({type:'MENTAL_IMPRINT'},`${caseId}-ability-outcome`);
    assert.equal(s.spirituality,spiritual-6);assert.equal(s.mind,mind-2);
    if(view().life.currentAttempt.contactActive)dw({type:'STOP_CONTACT'},`${caseId}-stopped`);
    if(view().life.currentAttempt.sealActive)dw({type:'DEACTIVATE_SEAL'});
  }
  dw({type:'TAKE_CARD'},`${caseId}-card-taken`);
  dw({type:'MOVE',actor:'OWNER',to:'NEAR'});
  dw({type:'CHECK_CARD'},`${caseId}-checked`);
  dw({type:'MOVE',actor:'OWNER',to:'FAR'});
  dw({type:'RETURN_CARD'},`${caseId}-returned`);
  dw({type:'MOVE',actor:'OWNER',to:'NEAR'});
  dw({type:'VERIFY',caseId});dw({type:'CLOSE',caseId},`${caseId}-closed`);clear();
}
function treatOriginalWounds() {
  if(!s.injuries.length)return;
  ready({cash:180,ap:3});
  if(!s.careKnown){assert(projectSliceState(s).investigateTargets.some(t=>t.id==='CARE-ACCESS-01'));go({type:'ACTION',action:'INVESTIGATE',targetId:'CARE-ACCESS-01'},'clinic-discovery');clear();}
  for(let n=0;s.injuries.length&&n<12;n++){
    ready({cash:60});const treated=s.injuries.every(i=>i.severity!=='HEAVY'||i.treatedRevision!==null);go({type:'ACTION',action:'REST'},treated?'clinic-later-rest':null);clear();
  }
  assert.equal(s.injuries.length,0,'Real paid care and subsequent rest must resolve original wounds');assert.equal(s.injuryRisk,0);
}

function assertLegacyPreserved(){
  assert.equal(s.runId,old.final.runId);assert.equal(s.random.seed,seed);
  assert.equal(s.character.gender,old.final.character.gender);
  for(const key of ['audience','mindreader','psychologist','hypnotist','dreamwalker','manipulator','dreamWeaver'])assert.deepEqual(s[key],old.final[key],`Preserve all original ${key} facts`);
}
function save(stage) {
  const result = {creation, seed, commands, prefixCount, stage, departureStart, guidanceStart,
    promoted, practiced, combatStart, beforeLast, lastIntent, final: s};
  writeFileSync('output/play/discerner-stage-natural.json', JSON.stringify(result));
  for (const [key, boundary] of Object.entries(boundaries)) {
    writeFileSync(`output/play/discerner-${key}-save-boundary.json`, JSON.stringify(boundary));
  }
  mkdirSync('tests/fixtures/discerner-v01660', {recursive: true});
  writeFileSync('tests/fixtures/discerner-v01660/natural.json', JSON.stringify(result));
  writeFileSync('tests/fixtures/discerner-v01660/boundaries.json', JSON.stringify(boundaries));
  console.log(JSON.stringify({passed: true, stage, commands: commands.length, prefixCount,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    bottles: s.discerner.bottles.map(b => ({id: b.id, outcome: b.outcome})),
    cases: view().life.cases,
    encounter: s.discerner.encounter, boundaries: Object.keys(boundaries)}));
}

try {
  assert.equal(prefixCount, 441, 'Replay the existing living S3 branch; original443 death stays unchanged');
  s = createSliceRun(old.final.runId, creation, seed);
  for (const command of old.commands) go(command);
  assert.deepEqual(s, migrateSliceState(old.final), 'The full migrated original terminal state must match without edits');
  assert.deepEqual(commands, old.commands);
  prefixVerified = true;
  departureStart = structuredClone(s);
  treatOriginalWounds();
  ready({cash: 500, ap: 2});
  guidanceStart = structuredClone(s);
  dw({type: 'LEARN_GUIDANCE'}, 'guidance');
  assert.equal(s.cash, guidanceStart.cash - 500);
  clear();
  for (const taskId of ['INSPECT_ROUTE','CHECK_ORIGINALS','PLAN_WITHDRAWAL']) {
    action({type: 'PREPARE_TASK', taskId}, `preparation-${taskId.toLowerCase()}`);
  }
  for (let attempt = 0; s.progression.sequence === 3 && attempt < 12; attempt++) {
    let bottle = s.discerner.bottles.find(b => b.status === 'PLAYER') ?? s.discerner.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-supply');
      const requestedWeek = s.discerner.resupply.requestedWeek;
      ready({afterWeek: requestedWeek});
      assert(s.week > requestedWeek);
      dw({type: 'RECEIVE_SUPPLY'}, 'receive-next-week-supply');
      bottle = s.discerner.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A real independent bottle must exist');
    const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.discerner.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const step = s.discerner.bottles.find(b => b.id === bottleId).labourSteps + 1;
        action({type: 'POTION_WORK', bottleId}, step === 1 || step === 5 ? `potion-work-${step}` : null);
      }
      ready({cash: 920});
      const cash = s.cash;
      dw({type: 'BUY_POTION', bottleId}, 'buy-independent-potion');
      assert.equal(s.cash, cash - 800, 'Five labour commands discount only this original bottle');
    }
    ready({cash: 120, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.dreamWeaver.promotionWeek + 11});
    const resources = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    dw({type: 'PREPARE_PROMOTION'}, 'prepare-current-week');
    assert.equal(s.actionsRemaining, resources.ap - 1);
    assert.equal(s.cash, resources.cash - 120);
    assert.equal(s.week, resources.week);
    assert.equal(s.discerner.preparedWeek, s.week);
    const originalMastery = structuredClone(s.progression.mastery);
    dw({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 2 ? 'promotion' : 'consume-failure');
    assert.equal(s.discerner.preparedWeek, null, 'The actual preparation is consumed on every outcome');
    assert.equal(s.discerner.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assertLegacyPreserved();
    for (const [id, value] of Object.entries(originalMastery)) assert.equal(s.progression.mastery[id], value);
    clear();
    if (s.progression.sequence === 3) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 2, 'Twelve actual bottles failed; preserve the real blocker without forced promotion');
  assert.equal(s.progression.acting, 0);
  assert.equal(s.discerner.dreamWeaverActingAtPromotion, 100);
  assert.equal(s.progression.mastery['audience.s2.mental-imprint'], 0);
  assert.equal(s.progression.mastery['audience.s2.insight-window'], 0);
  assertLegacyPreserved();
  promoted = structuredClone(s);

  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId});
    practice(caseId);
    assert.equal(s.discerner.life.cases[caseId].status, 'EXAMINED');
    action({type: 'REPORT', caseId}, `${caseId}-report`);
    assert.equal(s.discerner.life.cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection');
  assert.equal(s.progression.acting, 100);
  practiced = structuredClone(s);

  treatOriginalWounds();
  ready({ap:2,cash:120,health:100,mind:100,spirituality:120,pollution:0});
  dw({type:'ENCOUNTER_TALK'});
  dw({type: 'ENCOUNTER_FIGHT'}, 'combat-start');
  combatStart = structuredClone(s);
  assert.equal(s.combat.encounterId, 'DISCERNER_DISPUTE');
  assert.equal(s.discerner.encounter.enemySpirituality, 120);
  assertLegacyPreserved();
  for (let round = 0; s.combat && round < 100; round++) {
    const stance = s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    go({type: 'COMBAT_ROUND', stance}, round === 0 ? 'combat-first' : null);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not reached a terminal outcome');
  assert(s.discerner.encounter.terminal, 'Keep the real death, surrender or ordinary retreat result');
  assertLegacyPreserved();
  if(s.status==='ACTIVE'){
    while(s.discerner.encounter.mentalPlague>0&&s.discerner.encounter.enemyHealth>0){
      ready({cash:40,afterWeek:s.discerner.encounter.helpHistory.at(-1)?.week??-1});
      dw({type:'AID_ENEMY'},'aid-enemy');clear();
    }
    ordinary('ordinary-life-after-exit');
  }
  assertLegacyPreserved();
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  writeFileSync('output/play/discerner-stage-blocker.json', JSON.stringify({creation, seed, commands,
    prefixCount, prefixVerified, departureStart, guidanceStart, promoted, practiced, combatStart,
    beforeLast, lastIntent, final: s, boundaries, error: String(error), stack: error.stack}));
  throw error;
}
