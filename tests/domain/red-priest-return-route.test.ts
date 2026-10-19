import { describe, expect, it } from 'vitest';
import {
  advanceRedPriestCampaignToWeek, createRedPriestCampaign, getRedPriestCampaignChallenge,
  getRedPriestCampaignTravelWeeks, reduceRedPriestCampaign, validateRedPriestCampaignCommand,
  verifyRedPriestCampaignState, type RedPriestCampaignCommand, type RedPriestCampaignHost,
  type RedPriestCampaignPlayer, type RedPriestCampaignReceipt, type RedPriestCampaignState,
} from '../../src/domain/red-priest/campaign.js';
import {
  RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_LEGIONS,
  RED_PRIEST_CAMPAIGN_LIMITS as LIMITS, RED_PRIEST_CAMPAIGN_NODES,
  RED_PRIEST_CAMPAIGN_POLITIES,
} from '../../src/domain/red-priest/campaign-content.js';

const RETURN = { type: 'RETURN_TO_HEADQUARTERS' } as const;
const FIELD = RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD');

// A standalone synthetic authoritative host supplies explicit resolved checks.
// No shipped save, capture, actual character or historical RNG is rewritten.
function harness() {
  let state = createRedPriestCampaign('return-route-test', 187795);
  let player: RedPriestCampaignPlayer = { alive: true, pathwayId: 'hunter', sequence: 1,
    cash: 10000, health: 100, mind: 100, spirituality: 120, actionsRemaining: 3,
    campaignLocation: 'loen-headquarters' };
  const receipts: RedPriestCampaignReceipt[] = [];
  const host = (command: RedPriestCampaignCommand = RETURN,
    outcome: RedPriestCampaignReceipt['result'] = 'SUCCESS'): RedPriestCampaignHost => {
    const eventId = `return-route-event-${state.revision + 1}`;
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
      state = result.state;
      return result;
    },
  };
}
type Harness = ReturnType<typeof harness>;
function launch(h: Harness) {
  for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) h.act({ type: 'REQUEST_AUTHORITY', polityId });
  h.act({ type: 'DECLARE_OFFENSIVE' });
}
function firstBattle(h: Harness, outcome: RedPriestCampaignReceipt['result'] = 'SUCCESS') {
  launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' });
  h.act({ type: 'BATTLE', nodeId: 'northern-pass' }, outcome);
}
function reinforce(h: Harness) {
  for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) h.act({ type: 'REORGANIZE', polityId });
  h.act({ type: 'WAIT' });
}
function reject(h: Harness, code: string, host = h.host(), command: unknown = RETURN,
  state = h.state) {
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
function expectSameWeeklyConsequences(before: RedPriestCampaignState, result: ReturnType<Harness['act']>, host: RedPriestCampaignHost) {
  const elapsed = advanceRedPriestCampaignToWeek(before, { ...host, week: result.state.week });
  if (!elapsed.ok) throw new Error(elapsed.block.code);
  expect(result.state.polities).toEqual(elapsed.state.polities);
  expect(result.state.nodes).toEqual(elapsed.state.nodes);
  expect(result.state.convoys).toEqual(elapsed.state.convoys);
  for (const cfg of RED_PRIEST_CAMPAIGN_LEGIONS) {
    expect(result.state.legions[cfg.id]).toEqual({ ...elapsed.state.legions[cfg.id],
      ...(cfg.role === 'FIELD' ? { location: 'loen-headquarters' } : {}) });
  }
  expect(result.events.slice(1)).toEqual(elapsed.events.slice(0, -1));
}

describe('209 real campaign return-to-headquarters route', () => {
  it('returns the original twice-defeated army with zero personal cash and preserves every old failure and finite reserve', () => {
    const h = harness(); firstBattle(h, 'FAILURE'); reinforce(h);
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    h.act({ type: 'BATTLE', nodeId: 'northern-pass' }, 'SEVERE_FAILURE'); reinforce(h);
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    h.setPlayer({ cash: 0, actionsRemaining: 1 });
    const before = structuredClone(h.state), playerBefore = structuredClone(h.player), host = h.host();
    expect(before.nodes['northern-pass'].battleCount).toBe(2);
    expect(before.nodes['northern-pass'].consolidated).toBe(false);
    expect(getRedPriestCampaignChallenge(h.state, RETURN)).toBeNull();
    const result = h.act(RETURN);
    expect(result.settlement).toEqual({ cash: 0, cashGain: 0, spirituality: 0, health: 0, mind: 0,
      actions: 1, weeks: 1, travelWeeks: 1, fromLocation: 'northern-pass', toLocation: 'loen-headquarters',
      risk: 'EXPOSURE', receiptId: null });
    expect(h.player).toEqual({ ...playerBefore, actionsRemaining: 3, campaignLocation: 'loen-headquarters' });
    expect(h.state).toMatchObject({ campaignId: before.campaignId, origin: before.origin, phase: 'WAR',
      declaration: before.declaration, firstCrossBorder: before.firstCrossBorder, warStarted: before.warStarted,
      opponentDisposition: before.opponentDisposition, location: 'loen-headquarters', lastSafeLocation: 'loen-headquarters' });
    expect(h.state.journal.slice(0, -1)).toEqual(before.journal);
    expect(h.state.nodes).toEqual(before.nodes); expect(h.state.labour).toEqual(before.labour);
    expect(h.state.detachments).toEqual(before.detachments);
    expect(h.state.convoys).toEqual(before.convoys);
    for (const cfg of FIELD) {
      const l = h.state.legions[cfg.id], old = before.legions[cfg.id];
      expect(l).toMatchObject({ id: old.id, mobilized: true, retreated: false,
        personnel: old.personnel, killed: old.killed, wounded: old.wounded, reinforcements: old.reinforcements,
        morale: old.morale, location: 'loen-headquarters', supply: old.supply - LIMITS.weeklySupply });
      expect(l.killed + l.wounded).toBe(2 * LIMITS.defeatLoss);
      const p = h.state.polities[cfg.polityId], oldP = before.polities[cfg.polityId];
      expect(p.authority).toBe(oldP.authority);
      expect(p.reservePersonnel).toBe(oldP.reservePersonnel);
      expect(p.supplyReserve).toBe(oldP.supplyReserve);
    }
    expectSameWeeklyConsequences(before, result, host);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('traverses all eight original route weeks without doubling upkeep or surrendering occupied nodes', () => {
    const h = harness(); launch(h);
    for (const node of RED_PRIEST_CAMPAIGN_NODES) {
      h.act({ type: 'MARCH', nodeId: node.id }); h.act({ type: 'BATTLE', nodeId: node.id });
      h.act({ type: 'CONSOLIDATE', nodeId: node.id });
    }
    h.setPlayer({ cash: 0 });
    const before = structuredClone(h.state), host = h.host(), result = h.act(RETURN);
    expect(result.settlement).toMatchObject({ cash: 0, cashGain: 0, actions: 1, weeks: 8, travelWeeks: 8,
      fromLocation: 'southern-harbor', toLocation: 'loen-headquarters', receiptId: null });
    expect(result.settlement.travelWeeks).toBe(getRedPriestCampaignTravelWeeks('southern-harbor', 'loen-headquarters'));
    expect(h.state.week).toBe(before.week + 8); expect(h.state.phase).toBe('WAR');
    expect(h.state.nodes).toEqual(before.nodes);
    expect(result.events[0]).toMatchObject({ type: 'MARCH', from: 'southern-harbor', to: 'loen-headquarters', travelWeeks: 8 });
    expect(result.events[0]!.message).toContain('南灯港路 → 东南粮仓地 → 青岸河埠 → 白石转运地 → 晨河东桥 → 灰脊北关 → 鲁恩联合协商处');
    expect(result.events.some(e => e.type === 'WITHDRAWAL' || e.type === 'LABOUR' || e.type === 'ARMISTICE')).toBe(false);
    expectSameWeeklyConsequences(before, result, host);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('preserves an ordered but unstarted war and permits a later real departure without rewriting the first crossing', () => {
    const h = harness(); launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    const before = structuredClone(h.state); h.act(RETURN);
    expect(h.state).toMatchObject({ phase: 'ORDERED', declaration: before.declaration,
      firstCrossBorder: before.firstCrossBorder, warStarted: null, opponentDisposition: 'MOBILIZED' });
    reject(h, 'ALREADY_AT_HEADQUARTERS');
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    expect(h.state.firstCrossBorder).toEqual(before.firstCrossBorder);
    h.act({ type: 'BATTLE', nodeId: 'northern-pass' });
    expect(h.state.phase).toBe('WAR');
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('continues ordinary enemy advances during travel rather than pausing the war', () => {
    const h = harness(); firstBattle(h);
    h.act({ type: 'CONSOLIDATE', nodeId: 'northern-pass' });
    h.act({ type: 'MARCH', nodeId: 'eastern-bridge' });
    const before = structuredClone(h.state), host = h.host(), result = h.act(RETURN);
    expect(result.settlement.travelWeeks).toBe(2);
    expect(before.nodes['western-depot'].enemyAdvanced).toBe(false);
    expect(h.state.nodes['western-depot'].controller).toBe('feysac');
    expect(h.state.nodes['western-depot'].enemyAdvanced).toBe(true);
    expect(h.state.nodes['southern-river'].enemyAdvanced).toBe(true);
    expect(result.events.some(e => e.type === 'OCCUPATION')).toBe(true);
    expect(h.state.nodes['northern-pass']).toEqual(before.nodes['northern-pass']);
    expectSameWeeklyConsequences(before, result, host);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('allows only an already-dispatched finite convoy to replenish the same original legion during return', () => {
    const h = harness(); firstBattle(h, 'FAILURE');
    h.act({ type: 'MARCH', nodeId: 'northern-pass' }); h.act({ type: 'REORGANIZE', polityId: 'loen' });
    const before = structuredClone(h.state), host = h.host();
    expect(before.convoys).toHaveLength(1); expect(before.convoys[0]!.status).toBe('IN_TRANSIT');
    h.setPlayer({ cash: 0 }); const result = h.act(RETURN);
    expect(h.state.convoys[0]!.status).toBe('DELIVERED'); expect(h.state.convoys).toHaveLength(1);
    expect(h.state.polities.loen.reservePersonnel).toBe(before.polities.loen.reservePersonnel);
    expect(h.state.legions['loen-expedition'].reinforcements).toBe(before.legions['loen-expedition'].reinforcements + LIMITS.convoyPersonnel);
    expect(h.state.legions['loen-expedition'].killed).toBe(before.legions['loen-expedition'].killed);
    expect(h.state.legions['loen-expedition'].wounded).toBe(before.legions['loen-expedition'].wounded);
    expectSameWeeklyConsequences(before, result, host);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('keeps real shortage attrition on return instead of healing, minting resources or silently stranding the army', () => {
    const h = harness(); launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' }); h.advance(200);
    // The small garrisons have already died from shortages and no longer incur
    // upkeep. Spend actual finite convoy funds, then exhaust the remaining
    // treasury through the surviving field army's ordinary weekly charges.
    for (let convoy = 0; convoy < 3; convoy += 1) {
      h.act({ type: 'REORGANIZE', polityId: 'feneport' }); h.act({ type: 'WAIT' });
    }
    const feneportDeployed = Object.values(h.state.legions)
      .filter(l => l.polityId === 'feneport' && l.mobilized && !l.retreated && l.personnel > 0).length;
    h.advance(Math.ceil(h.state.polities.feneport.treasury / (feneportDeployed * LIMITS.weeklyTreasury)));
    h.setPlayer({ cash: 0 });
    const before = structuredClone(h.state), host = h.host();
    expect(before.legions['loen-expedition'].supply).toBe(0);
    expect(before.polities.feneport.treasury).toBe(0);
    expect(before.legions['feneport-expedition'].supply).toBeGreaterThan(LIMITS.weeklySupply);
    const result = h.act(RETURN);
    expect(result.events.some(e => e.type === 'ATTRITION')).toBe(true);
    expect(h.state.legions['loen-expedition'].personnel).toBe(before.legions['loen-expedition'].personnel - 12);
    expect(h.state.legions['feneport-expedition'].personnel).toBe(before.legions['feneport-expedition'].personnel - 12);
    expect(h.state.legions['loen-expedition'].morale).toBeLessThanOrEqual(before.legions['loen-expedition'].morale);
    expectSameWeeklyConsequences(before, result, host);
    conserved(h.state); expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it('rejects unavailable campaigns, actors, action points, locations, authorities and original-army sources atomically', () => {
    const h = harness(); reject(h, 'NO_OFFENSIVE');
    launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    reject(h, 'WEEK_MISMATCH', { ...h.host(), week: h.state.week + 1 });
    reject(h, 'LOCATION_MISMATCH', { ...h.host(), player: { ...h.player, campaignLocation: 'loen-headquarters' } });
    for (const update of [{ alive: false }, { health: 0 }, { sequence: 0 }, { pathwayId: 'seer' }])
      reject(h, 'INELIGIBLE', { ...h.host(), player: { ...h.player, ...update } });
    reject(h, 'NO_ACTIONS', { ...h.host(), player: { ...h.player, actionsRemaining: 0 } });
    const absent = structuredClone(h.state); absent.legions['loen-expedition'].location = 'rear';
    reject(h, 'ARMY_NOT_PRESENT', h.host(), RETURN, absent);
    const unavailable = structuredClone(h.state); unavailable.legions['loen-expedition'].mobilized = false;
    reject(h, 'ARMY_UNAVAILABLE', h.host(), RETURN, unavailable);
    const forgedId = structuredClone(h.state); forgedId.legions['loen-expedition'].id = 'intis-expedition';
    reject(h, 'INVALID_STATE', h.host(), RETURN, forgedId);
    h.act({ type: 'RELEASE_AUTHORITY', polityId: 'loen' }); reject(h, 'AUTHORITY_WITHDRAWN');
    h.act({ type: 'WITHDRAW_PROTECT' }); reject(h, 'ENDED');
    const ended = harness(); firstBattle(ended); ended.act({ type: 'SEEK_ARMISTICE' }); reject(ended, 'ENDED');
  });

  it('accepts only a plain return intent and rejects forged receipts, repeated events and rewritten source history', () => {
    const h = harness(); firstBattle(h);
    expect(validateRedPriestCampaignCommand(RETURN)).toBe(true);
    for (const command of [
      { ...RETURN, nodeId: 'loen-headquarters' }, { ...RETURN, cashGain: 60 },
      { ...RETURN, weeks: 0 }, { ...RETURN, personnel: 9000 }, { ...RETURN, result: 'SUCCESS' },
    ]) {
      expect(validateRedPriestCampaignCommand(command)).toBe(false); reject(h, 'INVALID_COMMAND', h.host(), command);
    }
    const receipt = h.host({ type: 'SEEK_ARMISTICE' }).receipt!;
    reject(h, 'UNEXPECTED_RECEIPT', { ...h.host(), receipt });
    reject(h, 'REPEATED_EVENT', { ...h.host(), eventId: h.state.journal[0]!.host.eventId });
    h.act(RETURN);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
    const mutations: ((s: RedPriestCampaignState) => void)[] = [
      s => { s.journal.at(-1)!.settlement.weeks = 0; },
      s => { s.journal.at(-1)!.settlement.cashGain = 60; },
      s => { s.journal.at(-1)!.host = { ...s.journal.at(-1)!.host, receipt }; },
      s => { s.journal.at(-1)!.events[0]!.travelWeeks = 0; },
      s => { s.polities.loen.authority = 'RELEASED'; },
      s => { s.legions['loen-expedition'].killed -= 1; s.legions['loen-expedition'].personnel += 1; },
    ];
    for (const change of mutations) {
      const forged = structuredClone(h.state); change(forged);
      expect(verifyRedPriestCampaignState(forged, h.receipts)).toBe(false);
    }
    expect(verifyRedPriestCampaignState(h.state, [])).toBe(false);
  });
});
