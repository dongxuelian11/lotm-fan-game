import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';

// Run from the repository root after the lead has compiled the current sources.
// Every state transition below is a public player command. Never reseed, reload a
// failed check, edit the historical capture, or refill a character/member here.
const old = JSON.parse(readFileSync('tests/fixtures/iron-blood-knight-v01180/natural.json', 'utf8'));
const creation = old.creation, seed = old.seed, prefixCount = old.commands.length;
const commands = [], boundaries = {}, MAX_COMMANDS = 1800;
// Keep at most twenty transaction boundaries; the complete command transcript
// and the four stage snapshots retain all other original transitions.
const BOUNDARY_KEYS = new Set(['guidance', 'preparation-plan_support', 'potion-work-5',
  'buy-independent-potion', 'prepare-current-week', 'consume-failure', 'promotion',
  'request-supply', 'receive-next-week-supply', 'team-rest-paid', 'team-recovered-next-week',
  'glass-cart-ability-outcome', 'fork-signals-ability-outcome', 'lateral-load-ability-outcome',
  'lateral-load-report', 'reflection', 'encounter-original-five', 'combat-first',
  'combat-terminal', 'ordinary-life-after-exit']);
const CASES = ['glass-cart', 'fork-signals', 'lateral-load'];
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
const wb = (command, key = null) => go({type: 'WAR_BISHOP', command}, key);
const view = () => projectSliceState(s).warBishop;
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
  return Math.max(-1, s.warBishop.encounter.invitedWeek ?? -1,
    ...Object.values(s.warBishop.life.cases).flatMap(c => c.attempts.map(a => a.invitedWeek)));
}
function readyTeam(ap) {
  // Preparation itself locks ordinary life. Finish all earning, recovery and
  // genuine week changes before paying for PREPARE or ENCOUNTER_TALK.
  assert(!view().insideCase, 'Team recovery must precede scene preparation');
  ready({cash: 40, ap, health: 90, mind: 85, spirituality: 15, afterWeek: lastInvitationWeek()});
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
  ready({cash: 40, ap, health: 90, mind: 85, spirituality: 15, afterWeek: lastInvitationWeek()});
}
function action(command, key = null) {
  ready();
  wb(command, key);
  clear();
}
function closePractice(caseId) {
  let p = s.warBishop.life.practice;
  if (caseId === 'lateral-load' && ['WARNED', 'HELD'].includes(p.load.phase)) wb({type: 'RELEASE_LOAD'});
  p = s.warBishop.life.practice;
  if (p.frame.holder === 'TEAM_FAR') wb({type: 'CARRY_BACK'});
  p = s.warBishop.life.practice;
  if (p.ownerNode !== 'NEAR' || p.memberNodes.some(m => m.node !== 'NEAR') ||
      caseId === 'fork-signals' && !['OWNER', 'RACK'].includes(p.card.holder)) wb({type: 'RETURN_NEAR'});
  wb({type: 'RETURN_TOOL'}, `${caseId}-return-original`);
  if (s.warBishop.life.practice.linkedMemberIds.length) wb({type: 'STOP_LINK'});
  wb({type: 'DISMISS_TEAM'}, `${caseId}-dismiss`);
  assert(members().every(m => !m.present && m.location === 'HOME'));
  wb({type: 'CLOSE', caseId}, `${caseId}-close`);
  clear();
}
function practice(caseId, method) {
  readyTeam(2);
  wb({type: 'PREPARE', caseId, method}, `${caseId}-${method.toLowerCase()}-prepare`);
  const invitedAfter = lastInvitationWeek(), resources = members().map(m => [m.health, m.energy]);
  wb({type: 'INVITE_TEAM', caseId}, `${caseId}-invite`);
  assert(s.week > invitedAfter, 'Every actual new invitation has a distinct later week');
  assert.deepEqual(members().map(m => [m.health, m.energy]), resources, 'Invitation does not replenish original members');
  assert(members().every(m => m.present && m.location === 'YARD'));
  wb({type: 'PERFORM', caseId});
  if (method === 'ABILITY') wb({type: 'START_LINK'}, `${caseId}-link`);
  const attempt = () => s.warBishop.life.cases[caseId].attempts.at(-1);
  if (caseId === 'glass-cart') {
    for (let trip = 0; trip < 2 && s.warBishop.life.practice.frame.cargo !== 'DELIVERED'; trip++) {
      wb({type: 'CARRY_OUT'}, method === 'ABILITY' ? `${caseId}-ability-outcome` : null);
      if (attempt().failed) break;
      wb({type: 'CARRY_BACK'});
    }
  } else if (caseId === 'fork-signals') {
    if (method === 'ORDINARY') wb({type: 'CHECK_SIGNALS'});
    wb({type: 'PASS_FIRST'}, method === 'ABILITY' ? `${caseId}-ability-outcome` : null);
    if (!attempt().failed) wb({type: 'PASS_SECOND'});
  } else {
    wb({type: 'WARN_LOAD'});
    if (method === 'ABILITY') wb({type: 'SUPPORT_LOAD'}, `${caseId}-ability-outcome`);
  }
  closePractice(caseId);
  if (method === 'ORDINARY') capture(`${caseId}-ordinary-complete`);
}
function inheritedMemberFacts(member) {
  const {health, energy, location, present, ...facts} = member;
  return facts;
}
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId);
  assert.equal(s.random.seed, seed);
  assert.equal(s.character.gender, old.final.character.gender);
  assert.equal(s.ironBloodKnight.originalGender, old.final.ironBloodKnight.originalGender);
  assert.deepEqual(s.ironBloodKnight.encounter, old.final.ironBloodKnight.encounter, 'Old Garrick and his original club remain unchanged');
  assert.deepEqual(s.ironBloodKnight.bottles, old.final.ironBloodKnight.bottles);
  assert.deepEqual(s.ironBloodKnight.team.members.map(inheritedMemberFacts), old.final.ironBloodKnight.team.members.map(inheritedMemberFacts));
}
function save(stage) {
  const result = {creation, seed, commands, prefixCount, stage, departureStart, guidanceStart,
    promoted, practiced, combatStart, beforeLast, lastIntent, final: s};
  writeFileSync('output/play/war-bishop-stage-natural.json', JSON.stringify(result));
  for (const [key, boundary] of Object.entries(boundaries)) {
    writeFileSync(`output/play/war-bishop-${key}-save-boundary.json`, JSON.stringify(boundary));
  }
  mkdirSync('tests/fixtures/war-bishop-v01410', {recursive: true});
  writeFileSync('tests/fixtures/war-bishop-v01410/natural.json', JSON.stringify(result));
  writeFileSync('tests/fixtures/war-bishop-v01410/boundaries.json', JSON.stringify(boundaries));
  console.log(JSON.stringify({passed: true, stage, commands: commands.length, prefixCount,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    bottles: s.warBishop.bottles.map(b => ({id: b.id, outcome: b.outcome})),
    cases: CASES.map(id => ({id, result: s.warBishop.life.cases[id].result, attempts: s.warBishop.life.cases[id].attempts})),
    team: members().map(m => ({id: m.id, health: m.health, energy: m.energy, present: m.present})),
    encounter: s.warBishop.encounter, boundaries: Object.keys(boundaries)}));
}

try {
  assert.equal(prefixCount, 423, 'Replay the complete original 0.118 capture');
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
  for (let attempt = 0; s.progression.sequence === 4 && attempt < 12; attempt++) {
    let bottle = s.warBishop.bottles.find(b => b.status === 'PLAYER') ?? s.warBishop.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-supply');
      const requestedWeek = s.warBishop.resupply.requestedWeek;
      ready({afterWeek: requestedWeek});
      assert(s.week > requestedWeek);
      wb({type: 'RECEIVE_SUPPLY'}, 'receive-next-week-supply');
      bottle = s.warBishop.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A real independent bottle must exist');
    const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.warBishop.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const step = s.warBishop.bottles.find(b => b.id === bottleId).labourSteps + 1;
        action({type: 'POTION_WORK', bottleId}, step === 1 || step === 5 ? `potion-work-${step}` : null);
      }
      ready({cash: 920});
      const cash = s.cash;
      wb({type: 'BUY_POTION', bottleId}, 'buy-independent-potion');
      assert.equal(s.cash, cash - 800, 'Five labour commands discount only this original bottle');
    }
    ready({cash: 120, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.ironBloodKnight.promotionWeek + 11});
    const resources = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    wb({type: 'PREPARE_PROMOTION'}, 'prepare-current-week');
    assert.equal(s.actionsRemaining, resources.ap - 1);
    assert.equal(s.cash, resources.cash - 120);
    assert.equal(s.week, resources.week);
    assert.equal(s.warBishop.preparedWeek, s.week);
    const originalMastery = structuredClone(s.progression.mastery), originalTeam = structuredClone(s.ironBloodKnight.team.members);
    wb({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 3 ? 'promotion' : 'consume-failure');
    assert.equal(s.warBishop.preparedWeek, null, 'The actual preparation is consumed on every outcome');
    assert.equal(s.warBishop.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.deepEqual(s.ironBloodKnight.team.members, originalTeam, 'Promotion cannot summon, heal or copy the team');
    for (const [id, value] of Object.entries(originalMastery)) assert.equal(s.progression.mastery[id], value);
    clear();
    if (s.progression.sequence === 4) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 3, 'Twelve actual bottles failed; preserve the real blocker without forced promotion');
  assert.equal(s.progression.acting, 0);
  assert.equal(s.warBishop.ironBloodActingAtPromotion, 100);
  assert.equal(s.progression.mastery['hunter.s3.formation-link'], 0);
  assert.equal(s.progression.mastery['hunter.s3.coordinated-action'], 0);
  assertLegacyPreserved();
  promoted = structuredClone(s);

  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId});
    practice(caseId, 'ABILITY');
    if (s.warBishop.life.cases[caseId].status === 'OBSERVED') {
      assert(s.warBishop.life.cases[caseId].attempts.at(-1).failed, 'Unfinished ability must retain its actual failure');
      // No reroll: after the failed scene is genuinely closed and a new week
      // arrives, use the case-specific ordinary physical fallback instead.
      practice(caseId, 'ORDINARY');
    }
    assert.equal(s.warBishop.life.cases[caseId].status, 'EXAMINED');
    action({type: 'REPORT', caseId}, `${caseId}-report`);
    assert.equal(s.warBishop.life.cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection');
  assert.equal(s.progression.acting, 100);
  practiced = structuredClone(s);

  readyTeam(3);
  ready({cash: 40, ap: 3, health: 100, mind: 100, spirituality: 120, pollution: 0});
  wb({type: 'ENCOUNTER_TALK'}, 'encounter-talk');
  const previousInvite = lastInvitationWeek(), teamBeforeCall = members().map(m => [m.health, m.energy]);
  wb({type: 'CALL_COMPANIONS'}, 'encounter-original-five');
  assert(s.warBishop.encounter.invitedWeek > previousInvite);
  assert.deepEqual(members().map(m => [m.health, m.energy]), teamBeforeCall);
  assert.deepEqual(s.warBishop.encounter.companionIds, MEMBER_IDS);
  wb({type: 'ENCOUNTER_FIGHT'}, 'combat-start');
  combatStart = structuredClone(s);
  assert.equal(s.combat.encounterId, 'WAR_BISHOP_DISPUTE');
  assert.equal(s.warBishop.encounter.enemySpirituality, 120);
  assertLegacyPreserved();
  for (let round = 0; s.combat && round < 100; round++) {
    const stance = s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    go({type: 'COMBAT_ROUND', stance, warBishopPolicy: 'LINK_IF_READY'}, round === 0 ? 'combat-first' : null);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual combat has not reached a terminal outcome');
  assert(s.warBishop.encounter.terminal, 'Keep the real death, surrender or ordinary retreat result');
  assert(members().every(m => !m.present && m.location === 'HOME'));
  assertLegacyPreserved();
  // Combat settlement already leaves the original yard and dismisses the five.
  // LEAVE_ENCOUNTER only applies to the pre-fight READY scene, so surviving
  // characters demonstrate ordinary access with a real paid-budget life action.
  if (s.status === 'ACTIVE') ordinary('ordinary-life-after-exit');
  assertLegacyPreserved();
  save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  writeFileSync('output/play/war-bishop-stage-blocker.json', JSON.stringify({creation, seed, commands,
    prefixCount, prefixVerified, departureStart, guidanceStart, promoted, practiced, combatStart,
    beforeLast, lastIntent, final: s, boundaries, error: String(error), stack: error.stack}));
  throw error;
}
