import { describe, expect, it } from 'vitest';
import {
  advanceRedPriestCampaignToWeek, createRedPriestCampaign, getRedPriestCampaignChallenge, getRedPriestCampaignBlock,
  reduceRedPriestCampaign, validateRedPriestCampaignCommand, verifyRedPriestCampaignState,
  RED_PRIEST_HEADQUARTERS_REST as REST_COST,
  RED_PRIEST_SUPPLY_ONLY_CONVOY as SUPPLY_COST,
  type RedPriestCampaignCommand, type RedPriestCampaignHost, type RedPriestCampaignPlayer,
  type RedPriestCampaignReceipt, type RedPriestCampaignState,
} from '../../src/domain/red-priest/campaign.js';
import {
  RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_LEGIONS,
  RED_PRIEST_CAMPAIGN_LIMITS as LIMITS, RED_PRIEST_CAMPAIGN_POLITIES,
} from '../../src/domain/red-priest/campaign-content.js';

const REST = { type: 'REST_FIELD_ARMIES' } as const;
const FIELD = RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD');

// Independent synthetic host, never an edit to a captured save or its RNG.
function harness() {
  let state = createRedPriestCampaign('headquarters-rest-test', 187795);
  let player: RedPriestCampaignPlayer = { alive: true, pathwayId: 'hunter', sequence: 1,
    cash: 10000, health: 100, mind: 100, spirituality: 120, actionsRemaining: 3,
    campaignLocation: 'loen-headquarters' };
  const receipts: RedPriestCampaignReceipt[] = [];
  const host = (command: RedPriestCampaignCommand = REST,
    outcome: RedPriestCampaignReceipt['result'] = 'SUCCESS'): RedPriestCampaignHost => {
    const eventId = `headquarters-rest-event-${state.revision + 1}`;
    const challenge = getRedPriestCampaignChallenge(state, command);
    return { week: state.week, eventId, player: structuredClone(player), ...(challenge ? { receipt: {
      id: `resolved-${eventId}`, campaignId: state.campaignId, eventId, revision: state.revision, week: state.week,
      kind: challenge.kind, targetId: challenge.targetId, result: outcome,
      source: challenge.kind === 'BATTLE' ? 'BATTLE_RESOLUTION' as const : 'NORMAL_CHECK' as const,
    } } : {}) };
  };
  return {
    get state() { return state; }, get player() { return player; }, receipts, host,
    setPlayer(update: Partial<RedPriestCampaignPlayer>) { player = { ...player, ...update }; },
    act(command: RedPriestCampaignCommand, outcome: RedPriestCampaignReceipt['result'] = 'SUCCESS') {
      const h = host(command, outcome), before = structuredClone(state), hostBefore = structuredClone(h);
      const result = reduceRedPriestCampaign(state, command, h);
      expect(state).toEqual(before); expect(h).toEqual(hostBefore);
      if (!result.ok) throw new Error(`${command.type}: ${result.block.code}: ${result.block.message}`);
      state = result.state;
      player = { ...player, cash: player.cash - result.settlement.cash + result.settlement.cashGain,
        health: player.health - result.settlement.health, mind: player.mind - result.settlement.mind,
        spirituality: player.spirituality - result.settlement.spirituality,
        actionsRemaining: result.settlement.weeks > 0 ? 3 : player.actionsRemaining - result.settlement.actions,
        campaignLocation: result.settlement.toLocation };
      if (h.receipt) receipts.push(structuredClone(h.receipt));
      return result;
    },
    advance(weeks: number) {
      const result = advanceRedPriestCampaignToWeek(state, { ...host(), week: state.week + weeks });
      if (!result.ok) throw new Error(result.block.code);
      state = result.state; return result;
    },
  };
}
type Harness = ReturnType<typeof harness>;
function launch(h: Harness) {
  for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) h.act({ type: 'REQUEST_AUTHORITY', polityId });
  h.act({ type: 'DECLARE_OFFENSIVE' });
}
function lose(h: Harness) {
  h.act({ type: 'MARCH', nodeId: 'northern-pass' });
  h.act({ type: 'BATTLE', nodeId: 'northern-pass' }, 'FAILURE');
}
function reinforce(h: Harness) {
  for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) h.act({ type: 'REORGANIZE', polityId });
  h.act({ type: 'WAIT' });
}
function exhaustedReserves(h: Harness) {
  launch(h); lose(h); reinforce(h); lose(h); reinforce(h); reinforce(h); lose(h); reinforce(h);
  h.act({ type: 'MARCH', nodeId: 'northern-pass' }); h.act({ type: 'RETURN_TO_HEADQUARTERS' });
}
function reject(h: Harness, code: string, host = h.host(), command: unknown = REST, state = h.state) {
  const before = structuredClone(state), hostBefore = structuredClone(host);
  expect(reduceRedPriestCampaign(state, command, host)).toMatchObject({ ok: false, block: { code } });
  expect(state).toEqual(before); expect(host).toEqual(hostBefore);
}
function conserved(s: RedPriestCampaignState) {
  for (const cfg of RED_PRIEST_CAMPAIGN_POLITIES) {
    const p = s.polities[cfg.id];
    expect(p.treasury + p.treasurySpent).toBe(cfg.treasury);
    expect(p.reservePersonnel + p.reservesCommitted).toBe(cfg.reserves);
    expect(p.supplyReserve + p.suppliesCommitted).toBe(cfg.supplyReserve);
  }
  expect(Object.keys(s.legions)).toEqual(RED_PRIEST_CAMPAIGN_LEGIONS.map(l => l.id));
  for (const cfg of RED_PRIEST_CAMPAIGN_LEGIONS) {
    const l = s.legions[cfg.id];
    expect(l.personnel + l.killed + l.wounded + l.detached).toBe(cfg.personnel + l.reinforcements);
    expect(l.supply + l.supplySpent).toBe(cfg.supply + l.supplyDelivered);
  }
}
function deployed(s: RedPriestCampaignState, polityId: typeof RED_PRIEST_CAMPAIGN_COALITION[number]) {
  return Object.values(s.legions).filter(l => l.polityId === polityId && l.mobilized && !l.retreated && l.personnel > 0).length;
}
function expectWeeklyConsequences(before: RedPriestCampaignState, result: ReturnType<Harness['act']>, host: RedPriestCampaignHost) {
  const charged = structuredClone(before);
  for (const cfg of FIELD) {
    const p = charged.polities[cfg.polityId], l = charged.legions[cfg.id];
    p.treasury -= REST_COST.treasury; p.treasurySpent += REST_COST.treasury;
    l.supply -= REST_COST.supply; l.supplySpent += REST_COST.supply;
    l.morale += Math.min(REST_COST.morale, Math.max(0, REST_COST.maximumMorale - l.morale));
  }
  const elapsed = advanceRedPriestCampaignToWeek(charged, { ...host, week: result.state.week });
  if (!elapsed.ok) throw new Error(elapsed.block.code);
  expect(result.state.polities).toEqual(elapsed.state.polities);
  expect(result.state.legions).toEqual(elapsed.state.legions);
  expect(result.state.nodes).toEqual(elapsed.state.nodes);
  expect(result.state.convoys).toEqual(elapsed.state.convoys);
  expect(result.events.slice(FIELD.length)).toEqual(elapsed.events.slice(0, -1));
}

describe('209 finite original-army headquarters rest', () => {
  it('restores only morale after three real defeats and exhausted reserves, paying original military funds and two real weeks', () => {
    const h = harness(); exhaustedReserves(h); h.setPlayer({ cash: 0, actionsRemaining: 1 });
    const before = structuredClone(h.state), playerBefore = structuredClone(h.player), host = h.host();
    expect(REST_COST).toEqual({ weeks: 2, treasury: 120, supply: 4, morale: 20, maximumMorale: 80 });
    expect(before.nodes['northern-pass'].battleCount).toBe(3);
    for (const cfg of FIELD) {
      expect(before.legions[cfg.id]).toMatchObject({ morale: 28, personnel: 2000 });
      expect(before.polities[cfg.polityId].reservePersonnel).toBe(0);
      reject(h, 'RESERVE_EXHAUSTED', { ...h.host({ type: 'REORGANIZE', polityId: cfg.polityId }), player: { ...h.player, cash: 20 } }, { type: 'REORGANIZE', polityId: cfg.polityId });
    }
    expect(getRedPriestCampaignChallenge(before, REST)).toBeNull();
    const result = h.act(REST);
    expect(result.settlement).toEqual({ cash: 0, cashGain: 0, spirituality: 0, health: 0, mind: 0,
      actions: 1, weeks: 2, travelWeeks: 0, fromLocation: 'loen-headquarters', toLocation: 'loen-headquarters',
      risk: 'NONE', receiptId: null });
    expect(h.player).toEqual({ ...playerBefore, actionsRemaining: 3 });
    expect(h.state).toMatchObject({ campaignId: before.campaignId, origin: before.origin, phase: 'WAR',
      declaration: before.declaration, firstCrossBorder: before.firstCrossBorder, warStarted: before.warStarted,
      opponentDisposition: before.opponentDisposition, location: before.location, lastSafeLocation: before.lastSafeLocation });
    expect(h.state.week).toBe(before.week + 2); expect(h.state.journal.slice(0, -1)).toEqual(before.journal);
    expect(h.state.nodes).toEqual(before.nodes); expect(h.state.labour).toEqual(before.labour);
    expect(h.state.convoys).toEqual(before.convoys); expect(h.state.detachments).toEqual(before.detachments);
    for (const cfg of FIELD) {
      const old = before.legions[cfg.id], p = before.polities[cfg.polityId];
      expect(h.state.legions[cfg.id]).toEqual({ ...old, morale: 48, supply: old.supply - 6, supplySpent: old.supplySpent + 6 });
      expect(h.state.polities[cfg.polityId]).toMatchObject({ authority: p.authority,
        treasury: p.treasury - 120 - deployed(before, cfg.polityId) * 48,
        reservePersonnel: p.reservePersonnel, reservesCommitted: p.reservesCommitted,
        supplyReserve: p.supplyReserve, suppliesCommitted: p.suppliesCommitted });
      expect(result.events.find(e => e.type === 'REST' && e.legionId === cfg.id))
        .toMatchObject({ treasurySpent: 120, supplySpent: 4, moraleGain: 20 });
    }
    expectWeeklyConsequences(before, result, host); conserved(h.state);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
    h.setPlayer({ cash: 60 });
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    h.act({ type: 'BATTLE', nodeId: 'northern-pass' }, 'FAILURE');
    expect(h.state.nodes['northern-pass'].battleCount).toBe(4);
    expect(h.state.nodes['northern-pass'].victory).toBeNull();
    expect(h.state.legions['loen-expedition']).toMatchObject({ personnel: 1400, morale: 12 });
  });

  it('caps repeat paid rest at 80 and refuses an unnecessary additional charge', () => {
    const h = harness(); exhaustedReserves(h);
    for (const expected of [48, 68, 80]) {
      const before = structuredClone(h.state), result = h.act(REST);
      for (const cfg of FIELD) {
        expect(h.state.legions[cfg.id].morale).toBe(expected);
        expect(result.events.find(e => e.type === 'REST' && e.legionId === cfg.id)?.moraleGain)
          .toBe(expected - before.legions[cfg.id].morale);
      }
    }
    reject(h, 'NO_REST_NEEDED'); conserved(h.state);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('does not reduce morale already above 80 when the other original armies need rest', () => {
    const h = harness(); launch(h); lose(h);
    for (let convoy = 0; convoy < 3; convoy += 1) {
      h.act({ type: 'REORGANIZE', polityId: 'loen' }); h.act({ type: 'WAIT' });
    }
    expect(h.state.legions['loen-expedition'].morale).toBe(84);
    const before = structuredClone(h.state), result = h.act(REST);
    expect(h.state.legions['loen-expedition'].morale).toBe(84);
    expect(h.state.legions['intis-expedition'].morale).toBe(56);
    expect(result.events.find(e => e.type === 'REST' && e.legionId === 'loen-expedition')?.moraleGain).toBe(0);
    expect(h.state.legions['loen-expedition'].personnel).toBe(before.legions['loen-expedition'].personnel);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('preserves ORDERED and its original declaration without starting a war or manufacturing a crossing', () => {
    const h = harness(); launch(h); const before = structuredClone(h.state), host = h.host(), result = h.act(REST);
    expect(h.state).toMatchObject({ phase: 'ORDERED', declaration: before.declaration, warStarted: null, firstCrossBorder: null });
    expect(result.events.filter(e => e.type === 'REST').every(e => e.moraleGain === 8)).toBe(true);
    expectWeeklyConsequences(before, result, host);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('continues ordinary enemy occupation and already-paid finite convoy delivery during the same two weeks', () => {
    const h = harness(); launch(h); lose(h); h.act({ type: 'REORGANIZE', polityId: 'loen' });
    const before = structuredClone(h.state), host = h.host();
    expect(before.convoys[0]!.status).toBe('IN_TRANSIT'); expect(before.nodes['western-depot'].enemyAdvanced).toBe(false);
    const result = h.act(REST);
    expect(h.state.convoys[0]!.status).toBe('DELIVERED'); expect(h.state.convoys).toHaveLength(1);
    expect(h.state.legions['loen-expedition'].reinforcements).toBe(LIMITS.convoyPersonnel);
    expect(h.state.legions['loen-expedition'].wounded).toBe(before.legions['loen-expedition'].wounded);
    expect(h.state.nodes['western-depot'].controller).toBe('feysac');
    expect(result.events.some(e => e.type === 'OCCUPATION')).toBe(true);
    expectWeeklyConsequences(before, result, host); conserved(h.state);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('requires all fixed costs plus actual two-week upkeep, and accepts the exact finite boundary', () => {
    const h = harness(); launch(h);
    // Pure engine affordability boundaries use isolated synthetic state clones;
    // they are deliberately not represented as authentic saved source history.
    const exact = structuredClone(h.state);
    for (const cfg of FIELD) {
      const p = exact.polities[cfg.polityId], l = exact.legions[cfg.id];
      const due = REST_COST.treasury + REST_COST.weeks * LIMITS.weeklyTreasury * deployed(exact, cfg.polityId);
      p.treasurySpent += p.treasury - due; p.treasury = due;
      const supply = REST_COST.supply + REST_COST.weeks * LIMITS.weeklySupply;
      l.supplySpent += l.supply - supply; l.supply = supply;
    }
    for (const cfg of FIELD) {
      const noMoney = structuredClone(exact), p = noMoney.polities[cfg.polityId];
      p.treasury -= 1; p.treasurySpent += 1; reject(h, 'TREASURY', h.host(), REST, noMoney);
      const noSupply = structuredClone(exact), l = noSupply.legions[cfg.id];
      l.supply -= 1; l.supplySpent += 1; reject(h, 'SUPPLY', h.host(), REST, noSupply);
    }
    const result = reduceRedPriestCampaign(exact, REST, h.host());
    if (!result.ok) throw new Error(result.block.code);
    for (const cfg of FIELD) {
      expect(result.state.polities[cfg.polityId].treasury).toBe(0);
      expect(result.state.legions[cfg.id].supply).toBe(0);
      expect(result.state.legions[cfg.id].personnel).toBe(exact.legions[cfg.id].personnel);
      expect(result.state.legions[cfg.id].morale).toBe(80);
    }
    conserved(result.state);
  });

  it('rejects remote, dead, ended, unauthorized, unavailable and mismatched original participants without mutation', () => {
    const h = harness(); reject(h, 'NO_OFFENSIVE'); launch(h);
    reject(h, 'WEEK_MISMATCH', { ...h.host(), week: h.state.week + 1 });
    reject(h, 'LOCATION_MISMATCH', { ...h.host(), player: { ...h.player, campaignLocation: 'northern-pass' } });
    for (const update of [{ alive: false }, { health: 0 }, { sequence: 0 }, { pathwayId: 'seer' }])
      reject(h, 'INELIGIBLE', { ...h.host(), player: { ...h.player, ...update } });
    reject(h, 'NO_ACTIONS', { ...h.host(), player: { ...h.player, actionsRemaining: 0 } });
    const absent = structuredClone(h.state); absent.legions['loen-expedition'].location = 'rear';
    reject(h, 'ARMY_NOT_PRESENT', h.host(), REST, absent);
    for (const change of [(s: RedPriestCampaignState) => { s.legions['loen-expedition'].mobilized = false; },
      (s: RedPriestCampaignState) => { s.legions['loen-expedition'].retreated = true; },
      (s: RedPriestCampaignState) => { const l = s.legions['loen-expedition']; l.killed += l.personnel; l.personnel = 0; }]) {
      const unavailable = structuredClone(h.state); change(unavailable); reject(h, 'ARMY_UNAVAILABLE', h.host(), REST, unavailable);
    }
    const wrongIdentity = structuredClone(h.state); wrongIdentity.legions['loen-expedition'].id = 'intis-expedition';
    reject(h, 'INVALID_STATE', h.host(), REST, wrongIdentity);
    h.act({ type: 'MARCH', nodeId: 'northern-pass' }); reject(h, 'NOT_AT_HEADQUARTERS');
    h.act({ type: 'RETURN_TO_HEADQUARTERS' }); h.act({ type: 'RELEASE_AUTHORITY', polityId: 'loen' });
    reject(h, 'AUTHORITY_WITHDRAWN'); h.act({ type: 'WITHDRAW_PROTECT' }); reject(h, 'ENDED');
    const ended = harness(); launch(ended); lose(ended); ended.act({ type: 'SEEK_ARMISTICE' }); reject(ended, 'ENDED');
  });

  it('rejects injected costs, morale, troops, receipts, repeats and edited historical rest results', () => {
    const h = harness(); exhaustedReserves(h);
    expect(validateRedPriestCampaignCommand(REST)).toBe(true);
    for (const command of [{ ...REST, morale: 100 }, { ...REST, personnel: 2600 }, { ...REST, cashGain: 60 },
      { ...REST, weeks: 0 }, { ...REST, polityId: 'loen' }, { ...REST, result: 'SUCCESS' }]) {
      expect(validateRedPriestCampaignCommand(command)).toBe(false); reject(h, 'INVALID_COMMAND', h.host(), command);
    }
    const receipt = h.host({ type: 'SEEK_ARMISTICE' }).receipt!;
    reject(h, 'UNEXPECTED_RECEIPT', { ...h.host(), receipt });
    reject(h, 'REPEATED_EVENT', { ...h.host(), eventId: h.state.journal[0]!.host.eventId });
    h.act(REST);
    const mutations: ((s: RedPriestCampaignState) => void)[] = [
      s => { s.journal.at(-1)!.settlement.weeks = 0; },
      s => { s.journal.at(-1)!.settlement.cashGain = 60; },
      s => { s.journal.at(-1)!.host = { ...s.journal.at(-1)!.host, receipt }; },
      s => { s.journal.at(-1)!.events[0]!.moraleGain = 80; },
      s => { s.legions['loen-expedition'].morale = 80; },
      s => { const l = s.legions['loen-expedition']; l.killed -= 1; l.personnel += 1; },
    ];
    for (const change of mutations) {
      const forged = structuredClone(h.state); change(forged);
      expect(verifyRedPriestCampaignState(forged, h.receipts)).toBe(false);
    }
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
    expect(verifyRedPriestCampaignState(h.state, [])).toBe(false);
  });

  it('transports existing stock without troops or morale after personnel reserves are exhausted and rejects forged cargo', () => {
    const h = harness(); exhaustedReserves(h);
    h.advance(h.state.legions['loen-expedition'].supply - 63);
    const command = { type: 'SUPPLY_ONLY', polityId: 'loen' } as const;
    const before = structuredClone(h.state), original = before.legions['loen-expedition'];
    expect(SUPPLY_COST).toEqual({ treasury: 300, supply: 24, weeks: 2 });
    expect(before.polities.loen.reservePersonnel).toBe(0);
    expect(before.polities.loen.supplyReserve).toBe(144);
    const ordered = h.act(command), convoy = h.state.convoys.at(-1)!;
    expect(ordered.settlement).toMatchObject({ cash: 20, cashGain: 0, actions: 1, weeks: 1, receiptId: null });
    expect(convoy).toMatchObject({ kind: 'SUPPLY_ONLY', polityId: 'loen', legionId: original.id,
      personnel: 0, supply: 24, status: 'IN_TRANSIT', orderedWeek: before.week, arrivalWeek: before.week + 2 });
    expect(h.state.legions[original.id]).toMatchObject({ personnel: original.personnel, reinforcements: original.reinforcements,
      morale: original.morale, supply: original.supply - 1, supplyDelivered: original.supplyDelivered });
    expect(h.state.polities.loen).toMatchObject({ reservePersonnel: 0, reservesCommitted: before.polities.loen.reservesCommitted,
      supplyReserve: 120, suppliesCommitted: before.polities.loen.suppliesCommitted + 24,
      treasury: before.polities.loen.treasury - 300 - 24 });
    reject(h, 'CONVOY_PENDING', h.host(command), command);
    const reorganization = { type: 'REORGANIZE', polityId: 'loen' } as const;
    reject(h, 'CONVOY_PENDING', h.host(reorganization), reorganization);
    h.act({ type: 'WAIT' });
    expect(h.state.convoys.at(-1)!.status).toBe('DELIVERED');
    expect(h.state.legions[original.id]).toMatchObject({ personnel: original.personnel, reinforcements: original.reinforcements,
      killed: original.killed, wounded: original.wounded, morale: original.morale,
      supply: original.supply + 22, supplyDelivered: original.supplyDelivered + 24 });
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); conserved(h.state);
    for (const injected of [{ ...command, personnel: 300 }, { ...command, supply: 240 },
      { ...command, morale: 16 }, { ...command, arrivalWeek: 0 }, { type: 'SUPPLY_ONLY', polityId: 'feysac' }]) {
      expect(validateRedPriestCampaignCommand(injected)).toBe(false);
      reject(h, 'INVALID_COMMAND', h.host(command), injected);
    }
    for (const change of [(s: RedPriestCampaignState) => { s.convoys.at(-1)!.personnel = 300; },
      (s: RedPriestCampaignState) => { delete s.convoys.at(-1)!.kind; },
      (s: RedPriestCampaignState) => { s.convoys[0]!.kind = 'SUPPLY_ONLY'; s.convoys[0]!.personnel = 0; },
      (s: RedPriestCampaignState) => { s.convoys.push(structuredClone(s.convoys.at(-1)!)); },
      (s: RedPriestCampaignState) => { s.convoys.at(-1)!.arrivalWeek -= 1; }]) {
      const forged = structuredClone(h.state); change(forged);
      expect(verifyRedPriestCampaignState(forged, h.receipts)).toBe(false);
    }
  });

  it('returns undelivered supply stock exactly once, never refunds freight, and refuses unaffordable or unnecessary loads', () => {
    const h = harness(); exhaustedReserves(h); h.advance(h.state.legions['loen-expedition'].supply - 63);
    const command = { type: 'SUPPLY_ONLY', polityId: 'loen' } as const, before = structuredClone(h.state);
    for (const change of [(s: RedPriestCampaignState) => {
      const p = s.polities.loen; p.suppliesCommitted += p.supplyReserve - 23; p.supplyReserve = 23;
    }, (s: RedPriestCampaignState) => {
      const p = s.polities.loen; p.treasurySpent += p.treasury - 299; p.treasury = 299;
    }]) {
      const scarce = structuredClone(h.state); change(scarce);
      reject(h, 'RESERVE_EXHAUSTED', h.host(command), command, scarce);
    }
    const sufficient = structuredClone(h.state); sufficient.legions['loen-expedition'].supply += 1;
    sufficient.legions['loen-expedition'].supplySpent -= 1;
    reject(h, 'NO_REPLENISHMENT_NEED', h.host(command), command, sufficient);
    h.act(command); h.act({ type: 'WITHDRAW_PROTECT' });
    expect(h.state.convoys.at(-1)!.status).toBe('RETURNED');
    expect(h.state.polities.loen.supplyReserve).toBe(before.polities.loen.supplyReserve);
    expect(h.state.polities.loen.suppliesCommitted).toBe(before.polities.loen.suppliesCommitted);
    expect(h.state.polities.loen.reservePersonnel).toBe(before.polities.loen.reservePersonnel);
    expect(h.state.polities.loen.treasurySpent).toBeGreaterThanOrEqual(before.polities.loen.treasurySpent + 300);
    const returned = structuredClone(h.state.convoys); h.advance(2);
    expect(h.state.convoys).toEqual(returned);
    expect(h.state.polities.loen.supplyReserve).toBe(before.polities.loen.supplyReserve);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
    const pending = harness(); launch(pending); lose(pending); pending.act({ type: 'REORGANIZE', polityId: 'loen' });
    reject(pending, 'CONVOY_PENDING', pending.host(command), command);
  });

  it('retains the complete 512-entry journal while allowing real return, wait, withdrawal and host time but no further expansion', () => {
    const h = harness();
    while (h.state.journal.length < LIMITS.maxEntries - 5) h.act({ type: 'WAIT' });
    launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    const prefix = structuredClone(h.state.journal);
    expect(prefix).toHaveLength(512);
    for (const command of [REST, { type: 'BATTLE', nodeId: 'northern-pass' },
      { type: 'SUPPLY_ONLY', polityId: 'loen' }, { type: 'REORGANIZE', polityId: 'loen' }] as RedPriestCampaignCommand[])
      reject(h, 'ENTRY_LIMIT', h.host(command), command);
    h.act({ type: 'RETURN_TO_HEADQUARTERS' }); h.act({ type: 'WAIT' }); h.advance(2);
    h.act({ type: 'WITHDRAW_PROTECT' }); h.advance(1);
    expect(h.state.journal).toHaveLength(517);
    expect(h.state.journal.slice(0, 512)).toEqual(prefix);
    expect(h.state.journal.slice(512).map(e => e.command.type))
      .toEqual(['RETURN_TO_HEADQUARTERS', 'WAIT', 'HOST_ADVANCE', 'WITHDRAW_PROTECT', 'HOST_ADVANCE']);
    expect(h.state.phase).toBe('WITHDRAWN');
    reject(h, 'ENDED', h.host({ type: 'WAIT' }), { type: 'WAIT' });
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); conserved(h.state);
    const forgedSuffix = structuredClone(h.state); forgedSuffix.journal.at(-1)!.command = REST;
    expect(verifyRedPriestCampaignState(forgedSuffix, h.receipts)).toBe(false);
    const forgedPrefix = structuredClone(h.state); forgedPrefix.journal[0]!.settlement.cashGain = 60;
    expect(verifyRedPriestCampaignState(forgedPrefix, h.receipts)).toBe(false);
  }, 15000);

  it('commits a real two-week defeat retreat, including shortage attrition instead of canceling the losing check', () => {
    const h = harness(); launch(h);
    for (const nodeId of ['northern-pass', 'eastern-bridge'] as const) {
      h.act({ type: 'MARCH', nodeId }); h.act({ type: 'BATTLE', nodeId }); h.act({ type: 'CONSOLIDATE', nodeId });
    }
    h.act({ type: 'MARCH', nodeId: 'western-depot' });
    const command = { type: 'BATTLE', nodeId: 'western-depot' } as const;
    const before = structuredClone(h.state), scarce = structuredClone(h.state);
    for (const cfg of FIELD) {
      const l = scarce.legions[cfg.id]; l.supplySpent += l.supply - 5; l.supply = 5;
    }
    const failedHost = h.host(command, 'FAILURE'), previewHost = { ...failedHost };
    delete (previewHost as { receipt?: unknown }).receipt;
    expect(getRedPriestCampaignBlock(scarce, command, previewHost)).toBeNull();
    expect(getRedPriestCampaignBlock(scarce, command, failedHost)).toBeNull();
    const scarceLoss = reduceRedPriestCampaign(scarce, command, failedHost);
    if (!scarceLoss.ok) throw new Error(scarceLoss.block.code);
    expect(scarceLoss.settlement).toMatchObject({ weeks: 2, travelWeeks: 2,
      fromLocation: 'western-depot', toLocation: 'eastern-bridge', receiptId: failedHost.receipt!.id });
    for (const cfg of FIELD) expect(scarceLoss.state.legions[cfg.id].personnel)
      .toBe(scarce.legions[cfg.id].personnel - LIMITS.defeatLoss - 12);
    expect(scarceLoss.events.filter(e => e.type === 'ATTRITION' && FIELD.some(l => l.id === e.legionId))).toHaveLength(3);
    conserved(scarceLoss.state);
    const actual = h.act(command, 'FAILURE');
    expect(h.state.week).toBe(before.week + 2); expect(h.state.location).toBe('eastern-bridge');
    expect(h.state.nodes['western-depot']).toMatchObject({ battleCount: 1, victory: null });
    expect(actual.events.find(e => e.type === 'RETREAT')).toMatchObject({ travelWeeks: 2, from: 'western-depot', to: 'eastern-bridge' });
    expect(h.state.legions['loen-expedition'].personnel).toBe(before.legions['loen-expedition'].personnel - LIMITS.defeatLoss);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('keeps the old one-week northern defeat settlement and retreat prose unchanged', () => {
    const h = harness(); launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    const result = h.act({ type: 'BATTLE', nodeId: 'northern-pass' }, 'FAILURE');
    expect(result.settlement).toMatchObject({ cash: 40, cashGain: 0, spirituality: 6, health: 10,
      mind: 8, actions: 1, weeks: 1, travelWeeks: 0, fromLocation: 'northern-pass', toLocation: 'loen-headquarters', risk: 'BATTLE' });
    expect(result.events.find(e => e.type === 'RETREAT')).toEqual({ type: 'RETREAT', week: h.state.week - 1,
      nodeId: 'northern-pass', from: 'northern-pass', to: 'loen-headquarters',
      message: '会战失利，原军团与本人退回已确保的地点，伤亡和损坏不回滚。' });
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });
});
