import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';

// Run from the repository root after the lead has compiled the current sources.
// Every state transition below is a public player command. Never reseed, reload a
// failed check, edit the historical capture, or refill a character/member here.
const old = JSON.parse(readFileSync('tests/fixtures/war-bishop-v01410/peaceful-exit.json', 'utf8'));
const creation = old.creation, seed = old.seed, prefixCount = old.commands.length;
const commands = [], boundaries = {}, MAX_COMMANDS = 1800;
// Keep at most twenty transaction boundaries; the complete command transcript
// and the four stage snapshots retain all other original transitions.
const BOUNDARY_KEYS = new Set(['guidance', 'preparation-plan_support', 'potion-work-5',
  'buy-independent-potion', 'prepare-current-week', 'consume-failure', 'promotion',
  'request-supply', 'receive-next-week-supply', 'team-rest-paid', 'team-recovered-next-week',
  'fog-corridor-ability-outcome', 'frost-tray-ability-outcome', 'wind-rain-ability-outcome',
  'wind-rain-report', 'reflection', 'encounter-original-five', 'combat-first',
  'combat-terminal', 'ordinary-life-after-exit', 'fog-corridor-stop', 'frost-tray-ordinary', 'wind-rain-stop', 'wind-rain-close', 'fog-corridor-perform', 'frost-tray-perform', 'wind-rain-perform']);
const CASES = ['fog-corridor', 'frost-tray', 'wind-rain'];
const MEMBER_IDS = ['IB4-01', 'IB4-02', 'IB4-03', 'IB4-04', 'IB4-05'];
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
const wb = (command, key = null) => go({type: 'WEATHER_WARLOCK', command}, key);
const view = () => projectSliceState(s).weatherWarlock;
const members = () => MEMBER_IDS.map(id => {
  const member = s.ironBloodKnight.team.members.find(m => m.id === id);
  assert(member, `Missing original member ${id}`);
  return member;
});
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
function lastInvitationWeek() {
  return Math.max(-1, s.warBishop.encounter.invitedWeek ?? -1, ...Object.values(s.warBishop.life.cases).flatMap(c=>c.attempts.map(a=>a.invitedWeek)), s.weatherWarlock.encounter.invitedWeek ?? -1,
    ...Object.values(s.weatherWarlock.life.cases).flatMap(c => c.attempts.map(a => a.invitedWeek)));
}
function readyTeam(ap) {
  // Preparation itself locks ordinary life. Finish all earning, recovery and
  // genuine week changes before paying for PREPARE or ENCOUNTER_TALK.
  assert(!view().insideCase, 'Team recovery must precede scene preparation');
  ready({cash: 40, ap, health: 90, mind: 85, spirituality: 30, afterWeek: lastInvitationWeek()});
  assert(members().every(m => m.joined && m.willing && !m.present && m.location === 'HOME'),
    'Original members must currently agree and actually be at home');
  while (s.ironBloodKnight.team.restRequestedWeek !== null || members().some(m => m.health < 50 || m.energy < 6)) {
    if (s.ironBloodKnight.team.restRequestedWeek === null) {
      ready({cash: 80});
      const cash = s.cash, originalResources = members().map(m => [m.health, m.energy]);
      wb({type: 'REST_TEAM'}, 'team-rest-paid');
      assert.equal(s.cash, cash - 40, 'Actual old team recovery payment');
      assert.deepEqual(members().map(m => [m.health, m.energy]), originalResources, 'Payment must not heal immediately');
    }
    const requestedWeek = s.ironBloodKnight.team.restRequestedWeek;
    ready({afterWeek: requestedWeek});
    assert(s.week > requestedWeek, 'Recovery needs a real later week');
    const originalResources = members().map(m => [m.health, m.energy]);
    wb({type: 'RECOVER_TEAM'}, 'team-recovered-next-week');
    assert.deepEqual(members().map(m => [m.health, m.energy]),
      originalResources.map(([h, e]) => [Math.min(100, h + 20), Math.min(20, e + 8)]));
  }
  ready({cash: 40, ap, health: 90, mind: 85, spirituality: 30, afterWeek: lastInvitationWeek()});
}
function action(command, key = null) {
  ready();
  wb(command, key);
  clear();
}
function practice(caseId) {
  readyTeam(2);
  wb({type:'PREPARE',caseId,method:'ABILITY'});
  wb({type:'INVITE_TEAM',caseId});
  wb({type:'PERFORM',caseId}, `${caseId}-perform`);
  wb({type:'WARN_READ_EXIT'});
  wb({type:'CAST_WEATHER'}, `${caseId}-ability-outcome`);
  wb({type:'INSPECT_WEATHER'});
  wb({type:'STOP_WEATHER'}, `${caseId}-stop`);
  if(s.weatherWarlock.life.cases[caseId].attempts[0].evidence.result==='NONE') wb({type:'ORDINARY_WORK'}, `${caseId}-ordinary`);
  wb({type:'RETURN_NEAR'}); wb({type:'RETURN_TOOL'}); wb({type:'DISMISS_TEAM'});
  wb({type:'CLOSE',caseId}, `${caseId}-close`); clear();
}
function inheritedMemberFacts(member) {
  const {health, energy, location, present, ...facts} = member;
  return facts;
}
function assertLegacyPreserved() {
  assert.equal(s.runId,old.final.runId);assert.equal(s.random.seed,seed);
  assert.equal(s.character.gender,old.final.character.gender);
  assert.deepEqual(s.ironBloodKnight.encounter,old.final.ironBloodKnight.encounter);
  assert.deepEqual(s.warBishop,old.final.warBishop,'Old Cedric and original peaceful exit remain intact');
  assert.deepEqual(s.ironBloodKnight.team.members.map(inheritedMemberFacts),old.final.ironBloodKnight.team.members.map(inheritedMemberFacts));
}
function save(stage) {
  const result = {creation, seed, commands, prefixCount, stage, departureStart, guidanceStart,
    promoted, practiced, combatStart, beforeLast, lastIntent, final: s};
  writeFileSync('output/play/weather-warlock-stage-natural.json', JSON.stringify(result));
  for (const [key, boundary] of Object.entries(boundaries)) {
    writeFileSync(`output/play/weather-warlock-${key}-save-boundary.json`, JSON.stringify(boundary));
  }
  mkdirSync('tests/fixtures/weather-warlock-v01650', {recursive: true});
  writeFileSync('tests/fixtures/weather-warlock-v01650/natural.json', JSON.stringify(result));
  writeFileSync('tests/fixtures/weather-warlock-v01650/boundaries.json', JSON.stringify(boundaries));
  console.log(JSON.stringify({passed: true, stage, commands: commands.length, prefixCount,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    bottles: s.weatherWarlock.bottles.map(b => ({id: b.id, outcome: b.outcome})),
    cases: CASES.map(id => ({id, result: s.weatherWarlock.life.cases[id].result, attempts: s.weatherWarlock.life.cases[id].attempts})),
    team: members().map(m => ({id: m.id, health: m.health, energy: m.energy, present: m.present})),
    encounter: s.weatherWarlock.encounter, boundaries: Object.keys(boundaries)}));
}

try {
  assert.equal(prefixCount, 543, 'Replay the original living peaceful choice, preserving the separate 550-command dead branch');
  s = createSliceRun(old.final.runId, creation, seed);
  for (const command of old.commands) go(command);
  assert.deepEqual(s, migrateSliceState(old.final), 'The full migrated original terminal state must match without edits');
  assert.deepEqual(commands, old.commands);
  prefixVerified = true;
  departureStart = structuredClone(s);
  ready({cash: 500, ap: 2});
  guidanceStart = structuredClone(s);
  wb({type: 'LEARN_GUIDANCE'}, 'guidance');
  assert.equal(s.cash, guidanceStart.cash - 500);
  clear();
  for (const taskId of ['INSPECT_ROUTE', 'CHECK_EQUIPMENT', 'PLAN_SUPPORT']) {
    action({type: 'PREPARE_TASK', taskId}, `preparation-${taskId.toLowerCase()}`);
  }
  for (let attempt = 0; s.progression.sequence === 3 && attempt < 12; attempt++) {
    let bottle = s.weatherWarlock.bottles.find(b => b.status === 'PLAYER') ?? s.weatherWarlock.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-supply');
      const requestedWeek = s.weatherWarlock.resupply.requestedWeek;
      ready({afterWeek: requestedWeek});
      assert(s.week > requestedWeek);
      wb({type: 'RECEIVE_SUPPLY'}, 'receive-next-week-supply');
      bottle = s.weatherWarlock.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A real independent bottle must exist');
    const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.weatherWarlock.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const step = s.weatherWarlock.bottles.find(b => b.id === bottleId).labourSteps + 1;
        action({type: 'POTION_WORK', bottleId}, step === 1 || step === 5 ? `potion-work-${step}` : null);
      }
      ready({cash: 920});
      const cash = s.cash;
      wb({type: 'BUY_POTION', bottleId}, 'buy-independent-potion');
      assert.equal(s.cash, cash - 800, 'Five labour commands discount only this original bottle');
    }
    ready({cash: 120, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.warBishop.promotionWeek + 11});
    const resources = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    wb({type: 'PREPARE_PROMOTION'}, 'prepare-current-week');
    assert.equal(s.actionsRemaining, resources.ap - 1);
    assert.equal(s.cash, resources.cash - 120);
    assert.equal(s.week, resources.week);
    assert.equal(s.weatherWarlock.preparedWeek, s.week);
    const originalMastery = structuredClone(s.progression.mastery), originalTeam = structuredClone(s.ironBloodKnight.team.members);
    wb({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 2 ? 'promotion' : 'consume-failure');
    assert.equal(s.weatherWarlock.preparedWeek, null, 'The actual preparation is consumed on every outcome');
    assert.equal(s.weatherWarlock.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.deepEqual(s.ironBloodKnight.team.members, originalTeam, 'Promotion cannot summon, heal or copy the team');
    for (const [id, value] of Object.entries(originalMastery)) assert.equal(s.progression.mastery[id], value);
    clear();
    if (s.progression.sequence === 3) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 2, 'Twelve actual bottles failed; preserve the real blocker without forced promotion');
  assert.equal(s.progression.acting, 0);
  assert.equal(s.weatherWarlock.warBishopActingAtPromotion, 100);
  for(const id of ['hunter.s2.battle-fog','hunter.s2.frost','hunter.s2.storm']) assert.equal(s.progression.mastery[id],0);
  assertLegacyPreserved();
  promoted = structuredClone(s);

  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId});
    practice(caseId);
    assert.equal(s.weatherWarlock.life.cases[caseId].status, 'EXAMINED');
    action({type: 'REPORT', caseId}, `${caseId}-report`);
    assert.equal(s.weatherWarlock.life.cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection');
  assert.equal(s.progression.acting, 100);
  practiced = structuredClone(s);

  readyTeam(3);
  ready({cash: 40, ap: 3, health: 100, mind: 100, spirituality: 120, pollution: 0});
  wb({type: 'ENCOUNTER_TALK'}, 'encounter-talk');
  const previousInvite = lastInvitationWeek(), teamBeforeCall = members().map(m => [m.health, m.energy]);
  wb({type: 'CALL_COMPANIONS'}, 'encounter-original-five');
  assert(s.weatherWarlock.encounter.invitedWeek > previousInvite);
  assert.deepEqual(members().map(m => [m.health, m.energy]), teamBeforeCall);
  assert.deepEqual(s.weatherWarlock.encounter.companionIds, MEMBER_IDS);
  wb({type: 'ENCOUNTER_FIGHT'}, 'combat-start');
  combatStart = structuredClone(s);
  assert.equal(s.combat.encounterId, 'WEATHER_WARLOCK_DISPUTE');
  assert.equal(s.weatherWarlock.encounter.enemySpirituality, 120);
  assertLegacyPreserved();
  for (let round = 0; s.combat && round < 100; round++) {
    const stance = s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    go({type: 'COMBAT_ROUND', stance, warBishopPolicy: 'LINK_IF_READY'}, round === 0 ? 'combat-first' : null);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not reached a terminal outcome');
  assert(s.weatherWarlock.encounter.terminal, 'Keep the real death, surrender or ordinary retreat result');
  assert(members().every(m => !m.present && m.location === 'HOME'));
  assertLegacyPreserved();
  // Combat settlement already leaves the original yard and dismisses the five.
  // LEAVE_ENCOUNTER only applies to the pre-fight READY scene, so surviving
  // characters demonstrate ordinary access with a real paid-budget life action.
  if (s.status === 'ACTIVE') ordinary('ordinary-life-after-exit');
  assertLegacyPreserved();
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  writeFileSync('output/play/weather-warlock-stage-blocker.json', JSON.stringify({creation, seed, commands,
    prefixCount, prefixVerified, departureStart, guidanceStart, promoted, practiced, combatStart,
    beforeLast, lastIntent, final: s, boundaries, error: String(error), stack: error.stack}));
  throw error;
}
