import { describe, expect, it } from 'vitest';
import {
  createRedPriestCampaign, validateRedPriestCampaignCommand, getRedPriestCampaignBlock,
  getRedPriestCampaignChallenge, getRedPriestCampaignCost, getRedPriestCampaignPlanPreview,
  reduceRedPriestCampaign, verifyRedPriestCampaignState, projectRedPriestCampaign,
  advanceRedPriestCampaignToWeek, RED_PRIEST_BATTLE_PLANNING,
  type RedPriestCampaignCommand, type RedPriestCampaignHost, type RedPriestCampaignState,
  type RedPriestCampaignReceipt, type RedPriestBattleStance,
} from '../../src/domain/red-priest/campaign.js';
import { RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_LEGIONS } from '../../src/domain/red-priest/campaign-content.js';

// Focused synthetic authoritative-host checks; no save fixture, random reroll,
// natural-run claim or expensive Slice replay. These commands use real reducers.
const armyIds = ['loen-expedition', 'intis-expedition', 'feneport-expedition'] as const;
const nodeId = 'northern-pass' as const;
const prepared = { type: 'PREPARED_BATTLE', nodeId } as const;
function harness() {
  let state = createRedPriestCampaign('planning-unit', 200);
  function host(command: RedPriestCampaignCommand, result: RedPriestCampaignReceipt['result'] = 'SUCCESS'): RedPriestCampaignHost {
    const challenge = getRedPriestCampaignChallenge(state, command), eventId = `event-${state.revision + 1}`;
    return { week: state.week, eventId, player: { alive: true, pathwayId: 'hunter', sequence: 1,
      cash: 10000, health: 100, mind: 100, spirituality: 120, actionsRemaining: 3, campaignLocation: state.location },
      ...(challenge ? { receipt: { id: `receipt-${eventId}`, campaignId: state.campaignId, eventId,
        revision: state.revision, week: state.week, kind: challenge.kind, targetId: challenge.targetId, result,
        source: challenge.kind === 'BATTLE' ? 'BATTLE_RESOLUTION' as const : 'NORMAL_CHECK' as const } } : {}) };
  }
  function act(command: RedPriestCampaignCommand, result: RedPriestCampaignReceipt['result'] = 'SUCCESS') {
    const before = structuredClone(state), value = reduceRedPriestCampaign(state, command, host(command, result));
    expect(state).toEqual(before);
    if (!value.ok) throw Error(`${command.type}: ${value.block.code}: ${value.block.message}`);
    state = value.state; return value;
  }
  return { get state() { return state; }, host, act,
    replace(next: RedPriestCampaignState) { state = next; },
    launch(planning = true) {
      if (planning) act({ type: 'ENABLE_PLANNING' });
      for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) act({ type: 'REQUEST_AUTHORITY', polityId });
      act({ type: 'DECLARE_OFFENSIVE' }); act({ type: 'MARCH', nodeId });
    },
    select(stance: RedPriestBattleStance, extraSupplies = false) {
      return act({ type: 'SELECT_BATTLE_PLAN', nodeId, stance, extraSupplies });
    },
  };
}
function reject(h: ReturnType<typeof harness>, command: RedPriestCampaignCommand, code: string, host = h.host(command)) {
  const before = structuredClone(h.state);
  expect(reduceRedPriestCampaign(h.state, command, host)).toMatchObject({ ok: false, block: { code } });
  expect(h.state).toEqual(before);
}
function conservation(s: RedPriestCampaignState) {
  for (const cfg of RED_PRIEST_CAMPAIGN_LEGIONS) {
    const l = s.legions[cfg.id];
    expect(l.personnel + l.killed + l.wounded + l.detached).toBe(cfg.personnel + l.reinforcements);
    expect(l.supply + l.supplySpent).toBe(cfg.supply + l.supplyDelivered);
  }
  for (const id of RED_PRIEST_CAMPAIGN_COALITION) expect(s.polities[id].treasury + s.polities[id].treasurySpent).toBe(10000);
}

describe('bounded opt-in Red Priest battle planning', () => {
  it('keeps legacy roots, challenge values, battle losses and replay free of planning defaults', () => {
    const h = harness(); h.launch(false);
    expect(Object.hasOwn(h.state, 'planning')).toBe(false);
    expect(Object.hasOwn(projectRedPriestCampaign(h.state), 'planning')).toBe(false);
    expect(getRedPriestCampaignChallenge(h.state, { type: 'BATTLE', nodeId })).toEqual({
      kind: 'BATTLE', targetId: nodeId, difficulty: 42, attackingPersonnel: 7800, defendingPersonnel: 900 });
    const result = h.act({ type: 'BATTLE', nodeId });
    expect(result.settlement).toMatchObject({ cash: 40, spirituality: 6, health: 3, mind: 2, actions: 1, weeks: 1 });
    expect(h.state.nodes[nodeId]).toMatchObject({ coalitionLosses: 540, displaced: 60, battleCount: 1 });
    expect(Object.hasOwn(h.state, 'planning')).toBe(false);
    expect(verifyRedPriestCampaignState(h.state)).toBe(true);
  });

  it('enables planning only by one explicit zero-cost predeclaration journal entry', () => {
    const h = harness(), before = structuredClone(h.state), result = h.act({ type: 'ENABLE_PLANNING' });
    expect(result.settlement).toMatchObject({ actions: 0, weeks: 0, cash: 0, spirituality: 0 });
    expect(h.state.planning).toEqual({ version: 1, enabledEventId: 'event-1', enabledWeek: 200, recon: null, selection: null });
    expect(h.state.polities).toEqual(before.polities); expect(h.state.legions).toEqual(before.legions);
    reject(h, { type: 'ENABLE_PLANNING' }, 'PLANNING_ALREADY_ENABLED');
    expect(verifyRedPriestCampaignState(h.state)).toBe(true);
  });

  it('rejects late opt-in and planning actions on a legacy campaign without changing it', () => {
    const h = harness(); h.launch(false);
    reject(h, { type: 'ENABLE_PLANNING' }, 'PLANNING_CLOSED');
    reject(h, { type: 'RECONNOITRE', nodeId }, 'PLANNING_NOT_ENABLED');
    reject(h, prepared, 'PLANNING_NOT_ENABLED');
    reject(h, { type: 'SELECT_BATTLE_PLAN', nodeId, stance: 'STANDARD', extraSupplies: false }, 'PLANNING_NOT_ENABLED');
  });

  it('requires explicit plan selection and rejects legacy battle in opted-in campaigns', () => {
    const h = harness(); h.launch();
    reject(h, { type: 'BATTLE', nodeId }, 'PREPARED_BATTLE_REQUIRED');
    reject(h, prepared, 'NO_BATTLE_PLAN');
    h.select('STANDARD'); expect(getRedPriestCampaignBlock(h.state, prepared, h.host(prepared))).toBeNull();
  });

  it('accepts only exact bounded commands without injected bonuses, receipts or troop counts', () => {
    const good = { type: 'SELECT_BATTLE_PLAN', nodeId, stance: 'PROTECTIVE', extraSupplies: true } as const;
    expect(validateRedPriestCampaignCommand(good)).toBe(true);
    for (const bad of [{ ...good, bonus: 99 }, { ...good, stance: 'ALL' }, { ...good, extraSupplies: 6 },
      { type: 'ENABLE_PLANNING', enabled: true }, { ...prepared, result: 'SUCCESS' },
      { type: 'RECONNOITRE', nodeId, defenderId: 'feysac-north' }, { ...good, nodeId: 'anywhere' }])
      expect(validateRedPriestCampaignCommand(bad)).toBe(false);
  });

  it('charges recon to every original treasury and army, then real upkeep exactly once', () => {
    const h = harness(); h.launch(); const before = structuredClone(h.state);
    const result = h.act({ type: 'RECONNOITRE', nodeId });
    expect(result.settlement).toMatchObject({ actions: 1, weeks: 1, cash: 0 });
    expect(h.state.week).toBe(before.week + 1);
    for (const id of RED_PRIEST_CAMPAIGN_COALITION) {
      const deployed = Object.values(before.legions).filter(l => l.polityId === id && l.mobilized && !l.retreated && l.personnel > 0).length;
      expect(before.polities[id].treasury - h.state.polities[id].treasury).toBe(120 + 24 * deployed);
    }
    for (const id of armyIds) expect(before.legions[id].supply - h.state.legions[id].supply).toBe(2);
    expect(h.state.planning!.recon).toMatchObject({ nodeId, defenderId: 'feysac-north', battleCount: 0 });
    expect(getRedPriestCampaignPlanPreview(h.state, nodeId).effectiveBonus).toBe(8);
    conservation(h.state); expect(verifyRedPriestCampaignState(h.state)).toBe(true);
  });

  it('rejects repeated recon rather than charging or stacking the same record', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId });
    reject(h, { type: 'RECONNOITRE', nodeId }, 'ALREADY_RECONNOITRED');
    h.select('COORDINATED', true);
    expect(getRedPriestCampaignChallenge(h.state, prepared)?.effectiveBonus).toBe(40);
  });

  it('rejects recon when any original treasury cannot pay its own cost and upkeep', () => {
    const h = harness(); h.launch(); const p = h.state.polities.intis;
    p.treasurySpent += p.treasury - 120; p.treasury = 120;
    reject(h, { type: 'RECONNOITRE', nodeId }, 'TREASURY');
  });

  it('rejects recon when any original army lacks preparation plus weekly supply', () => {
    const h = harness(); h.launch(); const l = h.state.legions['feneport-expedition'];
    l.supplySpent += l.supply - 1; l.supply = 1;
    reject(h, { type: 'RECONNOITRE', nodeId }, 'SUPPLY');
  });

  it('keeps standard/coordinated selection free and checks all three original armies', () => {
    const h = harness(); h.launch(); const before = structuredClone(h.state);
    const result = h.select('COORDINATED');
    expect(result.settlement).toMatchObject({ actions: 0, weeks: 0, cash: 0 });
    expect(h.state.polities).toEqual(before.polities); expect(h.state.legions).toEqual(before.legions);
    expect(getRedPriestCampaignChallenge(h.state, prepared)?.effectiveBonus).toBe(20);
    reject(h, { type: 'SELECT_BATTLE_PLAN', nodeId, stance: 'COORDINATED', extraSupplies: false }, 'PLAN_ALREADY_SELECTED');
    h.select('STANDARD'); expect(getRedPriestCampaignChallenge(h.state, prepared)?.effectiveBonus).toBe(0);
  });

  it('requires per-army personnel and morale thresholds and rechecks them at execution', () => {
    const h = harness(); h.launch(); h.select('COORDINATED');
    const l = h.state.legions['intis-expedition']; l.personnel = 999; l.wounded = 1601;
    reject(h, prepared, 'COORDINATION_UNAVAILABLE');
    l.personnel = 1000; l.wounded = 1600; l.morale = 59;
    reject(h, prepared, 'COORDINATION_UNAVAILABLE');
    l.morale = 60;
    expect(getRedPriestCampaignBlock(h.state, prepared, h.host(prepared))).toBeNull();
    expect(getRedPriestCampaignChallenge(h.state, prepared)?.effectiveBonus).toBe(20);
  });

  it('requires actual presence and still-granted original authority for preparation', () => {
    const h = harness(); h.launch();
    h.state.legions['intis-expedition'].location = 'loen-headquarters';
    reject(h, { type: 'RECONNOITRE', nodeId }, 'ARMY_NOT_PRESENT');
    h.state.legions['intis-expedition'].location = nodeId;
    h.act({ type: 'RELEASE_AUTHORITY', polityId: 'intis' });
    reject(h, { type: 'RECONNOITRE', nodeId }, 'AUTHORITY_WITHDRAWN');
  });

  it('charges additional supply only when the single prepared battle actually commits', () => {
    const h = harness(); h.launch(); const beforeSelect = structuredClone(h.state);
    h.select('STANDARD', true);
    expect(h.state.legions).toEqual(beforeSelect.legions);
    expect(getRedPriestCampaignPlanPreview(h.state, nodeId)).toMatchObject({ effectiveBonus: 12, battleSupplyPerArmy: 10 });
    const beforeBattle = structuredClone(h.state); h.act(prepared);
    for (const id of armyIds) expect(beforeBattle.legions[id].supply - h.state.legions[id].supply).toBe(11);
    expect(h.state.planning!.selection).toBeNull(); conservation(h.state);
  });

  it('blocks unaffordable additional supply before any battle receipt can be consumed', () => {
    const h = harness(); h.launch(); h.select('STANDARD', true);
    const l = h.state.legions['loen-expedition']; l.supplySpent += l.supply - 10; l.supply = 10;
    const host = h.host(prepared); const { receipt: _receipt, ...withoutDraw } = host;
    expect(getRedPriestCampaignBlock(h.state, prepared, withoutDraw)?.code).toBe('SUPPLY');
    reject(h, prepared, 'SUPPLY', host);
    expect(h.state.nodes[nodeId].battleCount).toBe(0);
  });

  it('performs protective deployment as an actual paid week before battle with no second deployment charge', () => {
    const h = harness(); h.launch(); const before = structuredClone(h.state);
    const deployment = h.select('PROTECTIVE');
    expect(deployment.settlement).toMatchObject({ actions: 1, weeks: 1, cash: 0 });
    for (const id of RED_PRIEST_CAMPAIGN_COALITION) {
      const deployed = Object.values(before.legions).filter(l => l.polityId === id && l.mobilized && !l.retreated && l.personnel > 0).length;
      expect(before.polities[id].treasury - h.state.polities[id].treasury).toBe(60 + deployed * 24);
    }
    for (const id of armyIds) expect(before.legions[id].supply - h.state.legions[id].supply).toBe(1);
    expect(getRedPriestCampaignCost(h.state, prepared, h.host(prepared))).toMatchObject({ actions: 1, weeks: 1, cash: 40 });
    const ready = structuredClone(h.state); h.act(prepared);
    expect(ready.polities.loen.treasury - h.state.polities.loen.treasury).toBe(48);
    conservation(h.state);
  });

  it('blocks duplicate protective selection, discards sunk preparation on switching, and charges fresh deployment', () => {
    const h = harness(); h.launch(); h.select('PROTECTIVE');
    reject(h, { type: 'SELECT_BATTLE_PLAN', nodeId, stance: 'PROTECTIVE', extraSupplies: false }, 'PLAN_ALREADY_SELECTED');
    reject(h, { type: 'SELECT_BATTLE_PLAN', nodeId, stance: 'PROTECTIVE', extraSupplies: true }, 'PLAN_ALREADY_SELECTED');
    const paid = h.state.polities.loen.treasury, week = h.state.week;
    h.select('STANDARD'); expect(h.state.polities.loen.treasury).toBe(paid); expect(h.state.week).toBe(week);
    h.select('PROTECTIVE', true); expect(h.state.week).toBe(week + 1);
    expect(h.state.polities.loen.treasury).toBe(paid - 108);
    expect(getRedPriestCampaignChallenge(h.state, prepared)?.effectiveBonus).toBe(30);
  });

  it('uses actual protective victory losses120 each and civilian displacement30', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId }); h.select('PROTECTIVE', true);
    expect(getRedPriestCampaignChallenge(h.state, prepared)).toMatchObject({ difficulty: 42, effectiveBonus: 38 });
    h.act(prepared);
    for (const id of armyIds) expect(h.state.legions[id]).toMatchObject({ personnel: 2480, killed: 30, wounded: 90 });
    expect(h.state.nodes[nodeId]).toMatchObject({ coalitionLosses: 360, displaced: 30, battleCount: 1 });
    expect(h.state.planning).toMatchObject({ recon: null, selection: null });
    conservation(h.state); expect(verifyRedPriestCampaignState(h.state)).toBe(true);
  });

  it('uses actual protective defeat losses450 each/displacement60 and preserves forced retreat and one-shot costs', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId }); h.select('PROTECTIVE', true);
    const used = h.host(prepared, 'FAILURE'); const battle = h.act(prepared, 'FAILURE');
    for (const id of armyIds) expect(h.state.legions[id]).toMatchObject({ personnel: 2150, killed: 112, wounded: 338, location: 'loen-headquarters' });
    expect(h.state.nodes[nodeId]).toMatchObject({ coalitionLosses: 1350, displaced: 60, victory: null, battleCount: 1 });
    expect(battle.settlement).toMatchObject({ health: 10, mind: 8, toLocation: 'loen-headquarters' });
    expect(h.state.planning).toMatchObject({ recon: null, selection: null });
    const before = structuredClone(h.state);
    expect(reduceRedPriestCampaign(h.state, prepared, used).ok).toBe(false); expect(h.state).toEqual(before);
    conservation(h.state); expect(verifyRedPriestCampaignState(h.state)).toBe(true);
  });

  it('rechecks resources after the protective week rather than admitting battle from the earlier state', () => {
    const h = harness(); h.launch(); const l = h.state.legions['loen-expedition'];
    l.supplySpent += l.supply - 11; l.supply = 11;
    h.select('PROTECTIVE', true);
    expect(h.state.legions['loen-expedition'].supply).toBe(10);
    reject(h, prepared, 'SUPPLY');
    expect(h.state.nodes[nodeId].battleCount).toBe(0);
  });

  it('invalidates live preparation on actual return or authority release, preserving sunk cost and old journal', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId }); h.select('PROTECTIVE');
    const journal = structuredClone(h.state.journal), spent = h.state.polities.loen.treasurySpent;
    const result = h.act({ type: 'RETURN_TO_HEADQUARTERS' });
    expect(h.state.planning).toMatchObject({ recon: null, selection: null });
    expect(h.state.journal.slice(0, journal.length)).toEqual(journal);
    expect(h.state.polities.loen.treasurySpent).toBeGreaterThan(spent);
    expect(result.events.some(e => e.type === 'PREPARATION')).toBe(true);
    h.act({ type: 'MARCH', nodeId }); h.select('STANDARD'); h.act({ type: 'RELEASE_AUTHORITY', polityId: 'loen' });
    expect(h.state.planning!.selection).toBeNull(); expect(verifyRedPriestCampaignState(h.state)).toBe(true);
  });

  it('never carries the same recon/plan across target defender or battle-count changes', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId }); h.select('COORDINATED', true);
    expect(getRedPriestCampaignPlanPreview(h.state, 'eastern-bridge')).toMatchObject({ hasSelection: false, reconEffective: false, effectiveBonus: 0 });
    for (const edit of [
      (s: RedPriestCampaignState) => { s.nodes[nodeId].currentDefenderId = 'feysac-east'; },
      (s: RedPriestCampaignState) => { s.nodes[nodeId].battleCount += 1; },
      (s: RedPriestCampaignState) => { s.planning!.selection!.nodeId = 'eastern-bridge'; },
    ]) {
      const changed = structuredClone(h.state); edit(changed);
      expect(getRedPriestCampaignPlanPreview(changed, nodeId).hasSelection).toBe(false);
      expect(verifyRedPriestCampaignState(changed)).toBe(false);
    }
  });

  it('strictly replays paid preparation and refuses forged enablement, costs, bindings and bonus payloads', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId }); h.select('PROTECTIVE', true);
    expect(verifyRedPriestCampaignState(JSON.parse(JSON.stringify(h.state)))).toBe(true);
    const edits = [
      (s: RedPriestCampaignState) => { s.planning!.enabledEventId = 'invented'; },
      (s: RedPriestCampaignState) => { s.planning!.selection!.stance = 'COORDINATED'; },
      (s: RedPriestCampaignState) => { s.planning!.selection!.extraSupplies = false; },
      (s: RedPriestCampaignState) => { s.planning!.recon!.week -= 1; },
      (s: RedPriestCampaignState) => { s.journal.at(-1)!.settlement.weeks = 0; },
      (s: RedPriestCampaignState) => { Object.assign(s.planning!, { effectiveBonus: 999 }); },
      (s: RedPriestCampaignState) => { delete s.planning; },
    ];
    for (const edit of edits) { const changed = structuredClone(h.state); edit(changed); expect(verifyRedPriestCampaignState(changed)).toBe(false); }
  });

  it('retains valid bindings through ordinary elapsed upkeep and projects no private source identity', () => {
    const h = harness(); h.launch(); h.act({ type: 'RECONNOITRE', nodeId }); h.select('STANDARD');
    const { receipt: _receipt, ...host } = h.host({ type: 'WAIT' });
    const result = advanceRedPriestCampaignToWeek(h.state, { ...host, week: h.state.week + 1 });
    if (!result.ok) throw Error(result.block.message); h.replace(result.state);
    expect(getRedPriestCampaignPlanPreview(h.state, nodeId)).toMatchObject({ hasSelection: true, reconEffective: true, effectiveBonus: 8 });
    const view = projectRedPriestCampaign(h.state), json = JSON.stringify(view.planning);
    expect(view.planning).toMatchObject({ enabled: true, recon: { nodeId, defenderName: '弗萨克北关守备团' }, selection: { nodeId, stance: 'STANDARD', extraSupplies: false } });
    for (const privateKey of ['enabledEventId', 'eventId', 'defenderId', 'battleCount', 'receipt', 'journal']) expect(json).not.toContain(privateKey);
    expect(verifyRedPriestCampaignState(h.state)).toBe(true);
    expect(RED_PRIEST_BATTLE_PLANNING.protective.effectiveBonus).toBe(18);
  });
});
