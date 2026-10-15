/** Directed unit fixtures only. They do not claim a natural source continuation.
 * Authored without execution; the integration owner runs them after its gate. */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { cargoWeight, COORDINATES, createTownState, FACILITY_IDS, hasUsableTownRegion, LOTS, SITE_IDS, townCommandBlock, townEvidence, transitionTown, validateTownCommand, validateTownState,
  type HostFacts, type PhaseId, type ReserveId, type TownCommand, type TownState } from '../../src/domain/attendant-mysteries/town.js';

class Driver {
  state: TownState;
  host: HostFacts;
  constructor(state = createTownState(15839), host: HostFacts = {
    week: 15839, active: true, sequence: 2, health: 100, mind: 100, spirituality: 2000, cash: 20000,
    actions: 3, externalLiveWorms: 0, controlPower: 100, die: 1,
  }) { this.state = structuredClone(state); this.host = structuredClone(host); }
  nextWeek(): void { this.host.week++; this.host.actions = 3; }
  act(command: TownCommand): void {
    const paid = ['TRAVEL', 'SURVEY_SITE', 'SURVEY_PLOT', 'BUY_LOT', 'BEGIN_CONTROL', 'TRANSPORT', 'BUILD', 'FOUND', 'LIVE_WEEK', 'MEET_VISITOR', 'EXCHANGE', 'FORM_REGION', 'HIRE_CART', 'COMMISSION_REPLACEMENT', 'VERIFY_REPLACEMENT', 'COMMISSION_PHASE', 'VERIFY_PHASE_SUPPLY', 'START_PHASE', 'REVERIFY_REGION', 'REPAIR_RELOCATION'];
    const ap = command.type === 'MOVE_TOWN' ? 3 : command.type === 'TRAVEL' && command.to === 'base' ? 0 : paid.includes(command.type) ? 1 : 0;
    if (this.host.actions < ap) this.nextWeek();
    const result = transitionTown(this.state, command, this.host);
    this.state = result.state;
    this.host.actions -= result.cost.actions; this.host.cash -= result.cost.cash;
    this.host.spirituality -= result.cost.spirituality; this.host.mind -= result.cost.mind; this.host.health -= result.cost.health;
  }
  rejects(command: TownCommand, match?: RegExp): void {
    const before = structuredClone(this.state), host = structuredClone(this.host);
    assert.throws(() => transitionTown(this.state, command, this.host), match);
    assert.deepEqual(this.state, before); assert.deepEqual(this.host, host);
  }
}
function surveyed(): Driver {
  const d = new Driver(); d.act({ type: 'TRAVEL', to: 'quarry' }); d.act({ type: 'SURVEY_SITE', siteId: 'quarry' }); return d;
}
function convert(d: Driver, id: string): void {
  d.act({ type: 'BEGIN_CONTROL', originalId: id });
  d.act({ type: 'CONVERT', originalId: id, confirmedIrreversibleDeath: true });
}
function buildTown(): Driver {
  const d = new Driver(); d.act({ type: 'HIRE_CART' });
  for (const lot of LOTS) d.act({ type: 'BUY_LOT', lotId: lot.id });
  d.act({ type: 'TRAVEL', to: 'new-alder-clearing' }); d.act({ type: 'SURVEY_PLOT', plotId: 'new-alder-clearing' });
  d.act({ type: 'UNLOAD_CART' });
  for (const facilityId of FACILITY_IDS) d.act({ type: 'BUILD', facilityId });
  for (let siteIndex = 0; siteIndex < SITE_IDS.length; siteIndex++) {
    const siteId = SITE_IDS[siteIndex]!;
    d.act({ type: 'TRAVEL', to: siteId }); d.act({ type: 'SURVEY_SITE', siteId });
    for (let i = 0; i < 4; i++) {
      const originalId = d.state.originals[siteIndex * 4 + i]!.id;
      convert(d, originalId); d.act({ type: 'ASSIGN_WORM', originalId }); d.act({ type: 'TRANSPORT', originalId });
      d.act({ type: 'STAFF', originalId, facilityId: FACILITY_IDS[siteIndex]! });
      if (i < 3) d.act({ type: 'TRAVEL', to: siteId });
    }
  }
  d.act({ type: 'FOUND' }); return d;
}
// Reuse immutable directed setup to avoid repeatedly constructing its long ledger.
let townCache: Driver | undefined;
function town(): Driver { townCache ??= buildTown(); return new Driver(townCache.state, townCache.host); }
function liveTwelve(d: Driver): void {
  for (let eventIndex = 0; eventIndex < 12; eventIndex++) { d.nextWeek(); d.act({ type: 'LIVE_WEEK', eventIndex, choice: 'FULFILL' }); }
}
function visitorExchange(d: Driver, visitorId: 'merchant-ada' | 'courier-neri' | 'weaver-iven'): void {
  // Arrange a real visit and complete it in one actual week, with sufficient AP.
  if (d.host.actions < 2) d.nextWeek();
  d.act({ type: 'MEET_VISITOR', visitorId }); d.act({ type: 'EXCHANGE', visitorId }); d.act({ type: 'SEND_VISITOR_HOME', visitorId });
}
function externalLinks(d: Driver): void {
  visitorExchange(d, 'merchant-ada'); visitorExchange(d, 'weaver-iven'); visitorExchange(d, 'courier-neri');
  const letter = d.state.letters.find(l => l.holder === 'courier-neri')!;
  d.nextWeek(); d.act({ type: 'CONFIRM_DELIVERY', letterId: letter.id });
}

test('01: six finite sites contain 24 stable living nonhuman originals, no preloaded bodies or worms', () => {
  const state = createTownState(15839);
  assert.equal(state.sites.length, 6); assert.equal(new Set(state.originals.map(o => o.id)).size, 24);
  assert.equal(new Set(state.originals.map(o => o.bodyId)).size, 24);
  for (const site of SITE_IDS) assert.equal(state.originals.filter(o => o.site === site && o.location === site).length, 4);
  assert.ok(state.originals.every(o => o.alive && o.health === 100 && o.status === 'WILD' && o.nature === 'LIVING_NONHUMAN_HUMANOID_SUPERNATURAL' && o.wormId === null));
  assert.equal(state.worms.length, 0); assert.equal(state.facilities.filter(f => f.builtWeek !== null).length, 0);
  assert.ok(validateTownState(state));
  assert.equal(validateTownCommand({ type: 'CONVERT', originalId: 'DORN', confirmedIrreversibleDeath: true }), false);
});

test('02: individual control requires presence, survey, a real check and explicit irreversible conversion', () => {
  const d = surveyed(), id = d.state.originals[0]!.id;
  d.rejects({ type: 'CONVERT', originalId: id, confirmedIrreversibleDeath: true }, /initial control/);
  d.act({ type: 'BEGIN_CONTROL', originalId: id });
  assert.equal(d.state.originals[0]!.alive, true);
  assert.equal(validateTownCommand({ type: 'CONVERT', originalId: id }), false);
  const spirituality = d.host.spirituality;
  d.act({ type: 'CONVERT', originalId: id, confirmedIrreversibleDeath: true });
  assert.equal(d.host.spirituality, spirituality - 8); assert.equal(d.state.originals[0]!.alive, false);
  assert.equal(d.state.originals[0]!.location, 'quarry'); assert.equal(d.state.originals[0]!.wormId, null);
  assert.ok(d.state.originals.slice(1).every(o => o.alive));
  d.rejects({ type: 'CONVERT', originalId: id, confirmedIrreversibleDeath: true });
});

test('03: failed checks leave wounds, cannot reroll that week, and a dead original cannot refresh', () => {
  const d = surveyed(), id = d.state.originals[0]!.id; d.host.die = 100;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) d.nextWeek();
    d.act({ type: 'BEGIN_CONTROL', originalId: id });
    assert.equal(d.state.originals[0]!.health, 100 - (attempt + 1) * 25);
    d.rejects({ type: 'BEGIN_CONTROL', originalId: id });
  }
  assert.equal(d.state.originals[0]!.status, 'DEAD'); assert.equal(d.state.originals[0]!.alive, false);
  d.nextWeek(); d.host.die = 1; d.rejects({ type: 'BEGIN_CONTROL', originalId: id }, /living original/);
  d.rejects({ type: 'SURVEY_SITE', siteId: 'quarry' }, /already surveyed/);
  assert.equal(validateTownCommand({ type: 'REPLACE_ORIGINAL', originalId: id }), false);
});

test('04: real worm splits share the existing 50 capacity and charge spirituality plus mind', () => {
  const d = surveyed(), id = d.state.originals[0]!.id; convert(d, id);
  d.host.externalLiveWorms = 50; d.rejects({ type: 'ASSIGN_WORM', originalId: id }, /capacity/);
  d.host.externalLiveWorms = 49; const mind = d.host.mind, spirit = d.host.spirituality;
  d.act({ type: 'ASSIGN_WORM', originalId: id });
  assert.equal(d.host.mind, mind - 2); assert.equal(d.host.spirituality, spirit - 3);
  assert.equal(d.state.worms.filter(w => w.status === 'ASSIGNED').length, 1);
  d.rejects({ type: 'ASSIGN_WORM', originalId: id });
  const second = d.state.originals[1]!.id; convert(d, second); d.rejects({ type: 'ASSIGN_WORM', originalId: second }, /capacity/);
});

test('05: recall and ending control preserve death; unrecalled worms are lost with real cost', () => {
  const d = surveyed(), id = d.state.originals[0]!.id; convert(d, id); d.act({ type: 'ASSIGN_WORM', originalId: id });
  const mind = d.host.mind; d.act({ type: 'RECALL_WORM', originalId: id });
  assert.equal(d.host.mind, mind); assert.equal(d.state.worms[0]!.status, 'RECALLED');
  d.act({ type: 'END_CONTROL', originalId: id, confirmedLoss: true });
  assert.equal(d.state.originals[0]!.alive, false); assert.equal(d.state.originals[0]!.status, 'INERT');
  d.rejects({ type: 'BEGIN_CONTROL', originalId: id });
  const second = d.state.originals[1]!.id; convert(d, second); d.act({ type: 'ASSIGN_WORM', originalId: second });
  const before = d.host.mind; d.act({ type: 'END_CONTROL', originalId: second, confirmedLoss: true });
  assert.equal(d.host.mind, before - 10); assert.equal(d.state.worms[1]!.status, 'LOST');
  assert.equal(d.state.journal.at(-1)!.cost.pollution, 10);
});

test('06: finite original lots and actual construction cannot replenish or mint supplies', () => {
  const d = new Driver(); d.act({ type: 'HIRE_CART' }); d.act({ type: 'BUY_LOT', lotId: 'timber-stack-1' });
  d.rejects({ type: 'BUY_LOT', lotId: 'timber-stack-1' }, /exhausted/);
  d.act({ type: 'TRAVEL', to: 'new-alder-clearing' }); d.act({ type: 'SURVEY_PLOT', plotId: 'new-alder-clearing' });
  d.act({ type: 'UNLOAD_CART' });
  d.rejects({ type: 'BUILD', facilityId: 'mill' }, /stone/);
  const forged = structuredClone(d.state); forged.goods.stone = 12; assert.equal(validateTownState(forged), false);
  assert.equal(validateTownCommand({ type: 'BUY_LOT', lotId: 'timber-stack-2' }), false);
});

test('07: 24 staffed statues and elapsed weeks alone never create a Spirit World region', () => {
  const d = town(); assert.equal(d.state.originals.filter(o => o.wormId !== null).length, 24);
  assert.ok(d.state.facilities.every(f => f.staff.length === 4 && f.condition === 100));
  d.host.week += 52; d.host.actions = 3;
  const proof = townEvidence(d.state, d.host.week); assert.equal(proof.ready, false);
  assert.ok(proof.blockers.some(b => b.includes('lived game weeks'))); assert.ok(proof.blockers.some(b => b.includes('connect all 24')));
  d.rejects({ type: 'FORM_REGION' });
});

test('08: twelve distinct weekly events consume goods and produce connected individual fates', () => {
  const d = town(); const grain = d.state.goods.grain; d.nextWeek();
  d.act({ type: 'LIVE_WEEK', eventIndex: 0, choice: 'FULFILL' });
  assert.equal(d.state.goods.grain, grain - 2); assert.equal(d.state.goods.flour, 5);
  assert.equal(d.state.fates[0]!.effects.length, 5); assert.equal(d.state.originals[0]!.earnings, 2);
  d.rejects({ type: 'LIVE_WEEK', eventIndex: 0, choice: 'FULFILL' }, /finite event/);
  d.rejects({ type: 'LIVE_WEEK', eventIndex: 1, choice: 'FULFILL' }, /one lived event/);
  for (let eventIndex = 1; eventIndex < 12; eventIndex++) { d.nextWeek(); d.act({ type: 'LIVE_WEEK', eventIndex, choice: 'FULFILL' }); }
  assert.ok(d.state.originals.every(o => o.workCount > 0 && o.fateIds.length > 0 && o.earnings > 0));
  assert.equal(new Set(d.state.fates.map(f => f.week)).size, 12);
  assert.equal(townEvidence(d.state, d.host.week).blockers.some(b => b.includes('connect all 24')), false);
  assert.equal(townEvidence(d.state, d.host.week).ready, false); // Still no external society.
});

test('09: independent adult visits require current consent and move original goods irreversibly', () => {
  const d = town(); liveTwelve(d); if (d.host.actions < 2) d.nextWeek();
  d.act({ type: 'MEET_VISITOR', visitorId: 'merchant-ada' });
  d.act({ type: 'WITHDRAW_VISITOR', visitorId: 'merchant-ada' }); d.rejects({ type: 'EXCHANGE', visitorId: 'merchant-ada' }, /consent/);
  d.act({ type: 'SEND_VISITOR_HOME', visitorId: 'merchant-ada' }); d.nextWeek();
  d.act({ type: 'MEET_VISITOR', visitorId: 'merchant-ada' }); d.nextWeek(); d.rejects({ type: 'EXCHANGE', visitorId: 'merchant-ada' }, /consent/);
  d.act({ type: 'SEND_VISITOR_HOME', visitorId: 'merchant-ada' });
  const bread = d.state.goods.bread; visitorExchange(d, 'merchant-ada');
  const v = d.state.visitors.find(v => v.id === 'merchant-ada')!;
  assert.ok(v.age >= 18 && v.alive && !v.controlled); assert.equal(v.receivedBread, 2);
  assert.equal(d.state.goods.bread, bread - 2); assert.equal(d.state.goods.salt, 1); assert.equal(v.spentStockIds.length, 1);
  const routes = d.state.journeys.filter(j => j.bodyIds.includes(v.bodyId));
  assert.equal(routes.at(-2)!.from, 'outside'); assert.equal(routes.at(-1)!.to, 'outside');
  d.rejects({ type: 'EXCHANGE', visitorId: 'merchant-ada' });
});

test('10: a letter is external evidence only after the real courier leaves and delivers later', () => {
  const d = town(); liveTwelve(d); if (d.host.actions < 2) d.nextWeek();
  d.act({ type: 'MEET_VISITOR', visitorId: 'courier-neri' }); d.act({ type: 'EXCHANGE', visitorId: 'courier-neri' });
  const letterId = d.state.interactions[0]!.letterId!;
  assert.equal(d.state.interactions[0]!.completedWeek, null);
  d.rejects({ type: 'CONFIRM_DELIVERY', letterId }, /later actual week/);
  d.nextWeek(); d.rejects({ type: 'CONFIRM_DELIVERY', letterId }, /actually leave/);
  d.act({ type: 'SEND_VISITOR_HOME', visitorId: 'courier-neri' }); d.act({ type: 'CONFIRM_DELIVERY', letterId });
  assert.equal(d.state.letters.find(l => l.id === letterId)!.holder, 'recipient');
  assert.equal(d.state.visitors.find(v => v.id === 'courier-neri')!.deliveredLetters[0], letterId);
  d.rejects({ type: 'CONFIRM_DELIVERY', letterId });
});

test('11: real history plus three outside consequences forms one region; relocation invalidates old eligibility', () => {
  const d = town(); liveTwelve(d); externalLinks(d);
  assert.equal(townEvidence(d.state, d.host.week).ready, true); d.act({ type: 'FORM_REGION' });
  assert.equal(hasUsableTownRegion(d.state, d.host.week), true);
  assert.equal(d.state.region!.fateIds.length, 12); assert.equal(d.state.region!.interactionIds.length, 3);
  d.rejects({ type: 'FORM_REGION' }, /already exists/);
  const deadIds = d.state.originals.filter(o => !o.alive).map(o => o.id), spent = [...d.state.boughtLots];
  d.act({ type: 'TRAVEL', to: 'new-flint-clearing' }); d.act({ type: 'SURVEY_PLOT', plotId: 'new-flint-clearing' });
  d.act({ type: 'TRAVEL', to: 'new-alder-clearing' }); d.act({ type: 'MOVE_TOWN', plotId: 'new-flint-clearing', confirmedBrokenLinks: true });
  assert.equal(d.state.region, null); assert.equal(d.state.retiredRegions.length, 1);
  assert.equal(hasUsableTownRegion(d.state, d.host.week), false);
  assert.equal(townEvidence(d.state, d.host.week).interactionIds.length, 0);
  assert.equal(townEvidence(d.state, d.host.week).fateIds.length, 0);
  assert.deepEqual(d.state.originals.filter(o => !o.alive).map(o => o.id), deadIds); assert.deepEqual(d.state.boughtLots, spent);
  assert.equal(d.state.fates.length, 12); assert.equal(d.state.interactions.length, 3); assert.ok(d.state.originals.every(o => o.location === 'new-flint-clearing'));
  assert.equal(d.state.journeys.at(-1)!.bodyIds.length, 25); d.rejects({ type: 'FORM_REGION' });
});

test('12: replay validation rejects forged facts, receipts, consent, regions and extra command fields', () => {
  const d = town(); liveTwelve(d); externalLinks(d); d.act({ type: 'FORM_REGION' }); assert.ok(validateTownState(d.state));
  const mutations: ((s: TownState) => void)[] = [
    s => { s.originals[0]!.alive = true; }, s => { s.originals[1]!.id = s.originals[0]!.id; },
    s => { s.goods.grain++; }, s => { s.fates[0]!.participants = []; }, s => { s.interactions[0]!.epoch++; },
    s => { s.region!.formedWeek--; }, s => { s.visitors[0]!.consent!.status = 'GRANTED'; },
    s => { s.journal[0]!.cost.cash = 0; }, s => { s.worms[0]!.status = 'RECALLED'; },
  ];
  for (const mutate of mutations) { const bad = structuredClone(d.state); mutate(bad); assert.equal(validateTownState(bad), false); }
  assert.equal(validateTownCommand({ type: 'FORM_REGION', ready: true }), false);
  const lowResources = structuredClone(d.host); lowResources.actions = 0; lowResources.cash = 0;
  assert.throws(() => transitionTown(createTownState(lowResources.week), { type: 'TRAVEL', to: 'quarry' }, lowResources), /Insufficient/);
});

function readyRegion(): Driver { const d = town(); liveTwelve(d); externalLinks(d); d.act({ type: 'FORM_REGION' }); return d; }
function prepareReserve(d: Driver, sourceId: ReserveId = 'quarry-reserve'): string {
  if (d.state.operatorAt !== 'base') d.act({ type: 'TRAVEL', to: 'base' });
  d.act({ type: 'COMMISSION_REPLACEMENT', roleId: 'resident-slot-01', sourceId });
  d.nextWeek(); d.act({ type: 'TRAVEL', to: sourceId }); d.act({ type: 'VERIFY_REPLACEMENT', sourceId });
  return d.state.replacements.find(r => r.sourceId === sourceId)!.originalId!;
}
function replaceFirst(d: Driver): { old: TownState['originals'][number]; replacementId: string } {
  const id = d.state.roles[0]!.currentOriginalId;
  d.act({ type: 'RECALL_WORM', originalId: id }); d.act({ type: 'END_CONTROL', originalId: id, confirmedLoss: true });
  const old = structuredClone(d.state.originals.find(o => o.id === id)!);
  const replacementId = prepareReserve(d); convert(d, replacementId); d.act({ type: 'ASSIGN_WORM', originalId: replacementId });
  d.act({ type: 'TRANSPORT', originalId: replacementId });
  d.act({ type: 'OCCUPY_ROLE', roleId: 'resident-slot-01', originalId: replacementId }); d.act({ type: 'STAFF', facilityId: 'mill', originalId: replacementId });
  return { old, replacementId };
}
function supplyPhase(d: Driver, phaseId: PhaseId = 'reserve-phase-3'): void {
  if (d.state.operatorAt !== 'base') d.act({ type: 'TRAVEL', to: 'base' });
  d.act({ type: 'COMMISSION_PHASE', phaseId }); d.nextWeek(); d.act({ type: 'VERIFY_PHASE_SUPPLY', phaseId });
  d.act({ type: 'TRAVEL', to: d.state.plot! }); d.act({ type: 'UNLOAD_CART' }); d.act({ type: 'START_PHASE', phaseId, confirmedAbandon: true });
}
function surveyDestination(d: Driver): void {
  d.act({ type: 'TRAVEL', to: 'new-flint-clearing' }); d.act({ type: 'SURVEY_PLOT', plotId: 'new-flint-clearing' }); d.act({ type: 'TRAVEL', to: 'new-alder-clearing' });
}

test('13: one paid original cart carries weighted real lots, which cannot be consumed before unloading', () => {
  const d = new Driver(); d.rejects({ type: 'BUY_LOT', lotId: 'timber-stack-1' }, /cart/);
  d.act({ type: 'HIRE_CART' }); d.rejects({ type: 'HIRE_CART' }, /once/);
  d.act({ type: 'BUY_LOT', lotId: 'timber-stack-1' });
  assert.equal(d.state.goods.timber, 0); assert.equal(d.state.cart.goods.timber, 28); assert.equal(cargoWeight(d.state.cart.goods), 84);
  d.rejects({ type: 'UNLOAD_CART' }, /actual town plot/);
  d.act({ type: 'TRAVEL', to: 'new-alder-clearing' }); d.act({ type: 'SURVEY_PLOT', plotId: 'new-alder-clearing' });
  d.rejects({ type: 'BUILD', facilityId: 'mill' }, /timber/);
  d.act({ type: 'UNLOAD_CART' }); assert.equal(d.state.goods.timber, 28); assert.equal(cargoWeight(d.state.cart.goods), 0);
  assert.equal(d.state.cargoReceipts[0]!.id, 'timber-stack-1'); assert.equal(d.state.cart.location, 'new-alder-clearing');
  assert.ok(d.state.journeys.at(-1)!.objectIds.includes('town-cart-1')); assert.ok(d.state.journeys.at(-1)!.objectIds.includes('timber-stack-1'));
  d.rejects({ type: 'UNLOAD_CART' });
});

test('14: real district coordinates keep control lines in range and both control steps record actual seconds', () => {
  for (const a of Object.values(COORDINATES)) for (const b of Object.values(COORDINATES)) assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1000);
  const d = surveyed(), id = d.state.originals[0]!.id; convert(d, id);
  assert.deepEqual(d.state.originals[0]!.controlHistory.map(x => [x.step, x.seconds, x.startSecond]), [['INITIAL', 10, 0], ['CONTINUE', 30, 10]]);
  assert.equal(d.state.controlElapsedSeconds, 40);
  assert.equal(d.state.journeys[0]!.metres, Math.ceil(Math.hypot(180, 60)));
  d.act({ type: 'TRAVEL', to: 'hollow-bank' }); assert.equal(d.state.originals[0]!.status, 'CONTROLLED');
  assert.equal(d.state.originals[0]!.location, 'quarry'); assert.ok(validateTownState(d.state));
  const e = surveyed(); e.act({ type: 'BEGIN_CONTROL', originalId: e.state.originals[0]!.id });
  e.host.actions = 0; e.host.cash = 0; e.host.spirituality = 0; e.host.mind = 0;
  e.rejects({ type: 'TRAVEL', to: 'base' }, /Release/);
  const old = structuredClone(e.state), oldHost = structuredClone(e.host);
  assert.equal(townCommandBlock(e.state, { type: 'RELEASE_INITIAL', originalId: e.state.originals[0]!.id }, e.host), null);
  assert.deepEqual(e.state, old); assert.deepEqual(e.host, oldHost);
  e.act({ type: 'RELEASE_INITIAL', originalId: e.state.originals[0]!.id }); e.act({ type: 'TRAVEL', to: 'base' });
  assert.equal(e.state.operatorAt, 'base'); assert.equal(e.state.originals[0]!.alive, true); assert.equal(e.state.originals[0]!.status, 'WILD');
  assert.equal(e.state.controlElapsedSeconds, 10); assert.equal(e.host.actions, 0); assert.equal(e.host.cash, 0);
  assert.ok(e.state.journeys.at(-1)!.metres > 0); assert.ok(validateTownState(e.state));
});

test('15: paid later-week independent replacement fills one role without rewriting the dead original', () => {
  const d = town(); const result = replaceFirst(d);
  assert.deepEqual(d.state.originals.find(o => o.id === result.old.id), result.old);
  assert.equal(d.state.originals.length, 25); assert.equal(d.state.roles.length, 24); assert.equal(d.state.roles[0]!.currentOriginalId, result.replacementId);
  assert.deepEqual(d.state.roles[0]!.occupancyHistory.map(x => x.originalId), [result.old.id, result.replacementId]);
  const replacement = d.state.originals.find(o => o.id === result.replacementId)!;
  assert.notEqual(replacement.bodyId, result.old.bodyId); assert.equal(replacement.alive, false); assert.equal(replacement.workCount, 0);
  assert.equal(d.state.worms.filter(w => w.status === 'ASSIGNED').length, 24);
  assert.ok(d.state.replacements[0]!.verifiedWeek! > d.state.replacements[0]!.commissionedWeek);
  d.rejects({ type: 'OCCUPY_ROLE', roleId: 'resident-slot-01', originalId: result.replacementId });
  d.rejects({ type: 'LIVE_WEEK', eventIndex: 0, choice: 'FULFILL' }, /new phase/);
});

test('16: replacement sources are finite and paid verification cannot occur in the commissioning week', () => {
  const d = town(), id = d.state.roles[0]!.currentOriginalId;
  d.act({ type: 'RECALL_WORM', originalId: id }); d.act({ type: 'END_CONTROL', originalId: id, confirmedLoss: true });
  d.act({ type: 'TRAVEL', to: 'base' }); d.nextWeek();
  d.act({ type: 'COMMISSION_REPLACEMENT', roleId: 'resident-slot-01', sourceId: 'quarry-reserve' });
  d.act({ type: 'TRAVEL', to: 'quarry-reserve' }); d.rejects({ type: 'VERIFY_REPLACEMENT', sourceId: 'quarry-reserve' }, /later game week/);
  d.nextWeek(); d.act({ type: 'VERIFY_REPLACEMENT', sourceId: 'quarry-reserve' });
  const replacementId = d.state.replacements[0]!.originalId!; d.host.die = 100;
  for (let i = 0; i < 4; i++) { if (i) d.nextWeek(); d.act({ type: 'BEGIN_CONTROL', originalId: replacementId }); }
  assert.equal(d.state.originals.find(o => o.id === replacementId)!.status, 'DEAD');
  d.act({ type: 'TRAVEL', to: 'base' }); d.rejects({ type: 'COMMISSION_REPLACEMENT', roleId: 'resident-slot-01', sourceId: 'quarry-reserve' }, /already commissioned/);
  d.act({ type: 'COMMISSION_REPLACEMENT', roleId: 'resident-slot-01', sourceId: 'reed-reserve' });
  assert.equal(d.state.originals.find(o => o.id === replacementId)!.health, 0); assert.equal(d.state.originals.find(o => o.id === id)!.alive, false);
  assert.equal(validateTownCommand({ type: 'COMMISSION_REPLACEMENT', roleId: 'resident-slot-01', sourceId: 'generated-reserve-7' }), false);
});

test('17: exhausted original events recover through a distinct paid delivered phase, without refilling old goods or receipts', () => {
  const d = town(); for (let i = 0; i < 24; i++) { d.nextWeek(); d.act({ type: 'LIVE_WEEK', eventIndex: i, choice: 'FULFILL' }); }
  const oldFates = structuredClone(d.state.fates), oldLots = [...d.state.boughtLots], oldStock = structuredClone(d.state.visitors[0]!.stockIds);
  d.rejects({ type: 'LIVE_WEEK', eventIndex: 0, choice: 'FULFILL' }, /finite event/);
  d.act({ type: 'TRAVEL', to: 'base' }); d.nextWeek(); d.act({ type: 'COMMISSION_PHASE', phaseId: 'reserve-phase-3' });
  d.rejects({ type: 'VERIFY_PHASE_SUPPLY', phaseId: 'reserve-phase-3' }, /later game week/);
  d.nextWeek(); const storedGrain = d.state.goods.grain; d.act({ type: 'VERIFY_PHASE_SUPPLY', phaseId: 'reserve-phase-3' });
  assert.equal(d.state.goods.grain, storedGrain); assert.equal(d.state.cart.goods.grain, 8);
  d.act({ type: 'TRAVEL', to: d.state.plot! }); d.rejects({ type: 'START_PHASE', phaseId: 'reserve-phase-3', confirmedAbandon: true }, /deliver/);
  d.act({ type: 'UNLOAD_CART' }); assert.equal(d.state.goods.grain, storedGrain + 8);
  d.act({ type: 'START_PHASE', phaseId: 'reserve-phase-3', confirmedAbandon: true }); liveTwelve(d);
  assert.deepEqual(d.state.fates.slice(0, 24), oldFates); assert.deepEqual(d.state.boughtLots, oldLots);
  assert.equal(d.state.fates.length, 36); assert.equal(new Set(d.state.fates.map(f => f.id)).size, 36);
  assert.ok(d.state.visitors[0]!.stockIds.includes(oldStock[0]!)); assert.equal(d.state.visitors[0]!.stockIds.length, oldStock.length + 1);
  assert.ok(d.state.cargoReceipts.some(r => r.id === 'reserve-phase-3:supply-crate'));
  assert.equal(d.state.phases.find(p => p.id === 'reserve-phase-3')!.status, 'COMPLETED');
  assert.equal(validateTownCommand({ type: 'COMMISSION_PHASE', phaseId: 'reserve-phase-5' }), false);
});

test('18: relocation needs a genuinely new plot and new lived phase/outside consequences, never old-region recycling', () => {
  const d = readyRegion(); const oldRegion = structuredClone(d.state.region), oldFates = structuredClone(d.state.fates);
  surveyDestination(d); const health = d.state.originals.map(o => o.health), goods = structuredClone(d.state.goods);
  d.act({ type: 'MOVE_TOWN', plotId: 'new-flint-clearing', confirmedBrokenLinks: true });
  assert.deepEqual(d.state.originals.map(o => o.health), health); assert.deepEqual(d.state.goods, goods);
  d.rejects({ type: 'MOVE_TOWN', plotId: 'new-alder-clearing', confirmedBrokenLinks: true }, /previously settled/);
  d.rejects({ type: 'LIVE_WEEK', eventIndex: 12, choice: 'FULFILL' }, /new phase/);
  supplyPhase(d); liveTwelve(d); assert.equal(townEvidence(d.state, d.host.week).ready, false);
  externalLinks(d); d.act({ type: 'FORM_REGION' });
  assert.equal(d.state.region!.plot, 'new-flint-clearing'); assert.notEqual(d.state.region!.id, oldRegion!.id);
  assert.deepEqual(d.state.retiredRegions[0], oldRegion); assert.deepEqual(d.state.fates.slice(0, 12), oldFates);
  assert.equal(d.state.interactions.length, 6); assert.equal(d.state.region!.interactionIds.length, 3);
});

test('19: failed relocation keeps originals and the existing town, with paid repair rather than free reset', () => {
  const d = readyRegion(); surveyDestination(d); d.nextWeek(); d.host.die = 100;
  const before = structuredClone(d.state), cash = d.host.cash;
  d.act({ type: 'MOVE_TOWN', plotId: 'new-flint-clearing', confirmedBrokenLinks: true });
  assert.equal(d.host.cash, cash - 72); assert.equal(d.state.plot, before.plot); assert.equal(d.state.epoch, before.epoch);
  assert.deepEqual(d.state.originals, before.originals); assert.deepEqual(d.state.region, before.region); assert.equal(d.state.retiredRegions.length, 0);
  assert.ok(d.state.facilities.every((f, i) => f.condition === before.facilities[i]!.condition - 5));
  d.nextWeek(); d.rejects({ type: 'MOVE_TOWN', plotId: 'new-flint-clearing', confirmedBrokenLinks: true }, /repair/);
  const timber = d.state.goods.timber; d.act({ type: 'REPAIR_RELOCATION' });
  assert.equal(d.state.goods.timber, timber - 2); assert.deepEqual(d.state.facilities.map(f => f.condition), before.facilities.map(f => f.condition));
  assert.notEqual(d.state.relocations[0]!.repairedWeek, null); d.rejects({ type: 'REPAIR_RELOCATION' });
  assert.equal(hasUsableTownRegion(d.state, d.host.week), true);
});

test('20: replacement earns new actual history and revalidates the same region; maintenance survives Sequence 1', () => {
  const d = readyRegion(), regionId = d.state.region!.id, formedWeek = d.state.region!.formedWeek;
  const { old, replacementId } = replaceFirst(d); assert.equal(hasUsableTownRegion(d.state, d.host.week), false);
  assert.equal(townEvidence(d.state, d.host.week).fateIds.length, 0); d.rejects({ type: 'REVERIFY_REGION' });
  d.host.sequence = 1; supplyPhase(d); liveTwelve(d); externalLinks(d);
  assert.equal(townEvidence(d.state, d.host.week).ready, true); assert.equal(hasUsableTownRegion(d.state, d.host.week), false);
  d.act({ type: 'REVERIFY_REGION' }); assert.equal(hasUsableTownRegion(d.state, d.host.week), true);
  assert.equal(d.state.region!.id, regionId); assert.equal(d.state.region!.formedWeek, formedWeek); assert.equal(d.state.plot, 'new-alder-clearing');
  assert.ok(d.state.originals.find(o => o.id === replacementId)!.workCount > 0); assert.deepEqual(d.state.originals.find(o => o.id === old.id), old);
  assert.equal(d.state.retiredRegions.length, 0); d.act({ type: 'TRAVEL', to: 'base' }); assert.equal(d.host.sequence, 1); assert.ok(validateTownState(d.state));
});
