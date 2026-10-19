import { describe, expect, it } from 'vitest';
import {
  createRedPriestCampaign, validateRedPriestCampaignCommand, getRedPriestCampaignBlock,
  getRedPriestCampaignChallenge, reduceRedPriestCampaign, verifyRedPriestCampaignState,
  deriveRedPriestCampaignAchievement, projectRedPriestCampaign, advanceRedPriestCampaignToWeek,
  dispatchRedPriestCampaignDetachment, settleRedPriestCampaignDetachment, getRedPriestCampaignTravelWeeks,
  type RedPriestCampaignCommand, type RedPriestCampaignHost, type RedPriestCampaignPlayer,
  type RedPriestCampaignReceipt, type RedPriestCampaignState,
} from '../../src/domain/red-priest/campaign.js';
import {
  RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_NODES, RED_PRIEST_CAMPAIGN_LEGIONS,
  RED_PRIEST_CAMPAIGN_POLITIES, RED_PRIEST_CAMPAIGN_LIMITS,
} from '../../src/domain/red-priest/campaign-content.js';

// Standalone synthetic engine host. It never reads a shipped save or the large
// Slice fixture. Only this host helper supplies simulated resolver receipts;
// ordinary command data contains no outcome, force size or resource overrides.
function harness(startWeek = 187795) {
  let state = createRedPriestCampaign('finite-campaign-test', startWeek);
  let player: RedPriestCampaignPlayer = { alive: true, pathwayId: 'hunter', sequence: 1,
    cash: 10000, health: 100, mind: 100, spirituality: 120, actionsRemaining: 3, campaignLocation: 'loen-headquarters' };
  const receipts: RedPriestCampaignReceipt[] = [];
  const host = (command: RedPriestCampaignCommand, result: RedPriestCampaignReceipt['result'] = 'SUCCESS'): RedPriestCampaignHost => {
    const eventId = `campaign-event-${state.revision + 1}`, challenge = getRedPriestCampaignChallenge(state, command);
    return { week: state.week, eventId, player: structuredClone(player), ...(challenge ? { receipt: {
      id: `resolved-${eventId}`, campaignId: state.campaignId, eventId, revision: state.revision, week: state.week,
      kind: challenge.kind, targetId: challenge.targetId, result,
      source: challenge.kind === 'BATTLE' ? 'BATTLE_RESOLUTION' as const : 'NORMAL_CHECK' as const,
    } } : {}) };
  };
  return {
    get state() { return state; }, get player() { return player; }, receipts, host,
    setPlayer(update: Partial<RedPriestCampaignPlayer>) { player = { ...player, ...update }; },
    act(command: RedPriestCampaignCommand, result: RedPriestCampaignReceipt['result'] = 'SUCCESS') {
      const h = host(command, result), before = structuredClone(state), hBefore = structuredClone(h);
      const applied = reduceRedPriestCampaign(state, command, h);
      expect(state).toEqual(before); expect(h).toEqual(hBefore);
      if (!applied.ok) throw new Error(`${command.type}: ${applied.block.code}: ${applied.block.message}`);
      state = applied.state;
      player = { ...player, cash: player.cash - applied.settlement.cash + applied.settlement.cashGain, actionsRemaining: applied.settlement.weeks > 0 ? 3 : player.actionsRemaining - applied.settlement.actions, health: player.health - applied.settlement.health,
        mind: player.mind - applied.settlement.mind, spirituality: player.spirituality - applied.settlement.spirituality,
        campaignLocation: applied.settlement.toLocation };
      if (h.receipt) receipts.push(structuredClone(h.receipt));
      return applied;
    },
  };
}
type Harness = ReturnType<typeof harness>;
function authorize(h: Harness) { for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) h.act({ type: 'REQUEST_AUTHORITY', polityId }); }
function launch(h: Harness) { authorize(h); h.act({ type: 'DECLARE_OFFENSIVE' }); }
function firstBattle(h: Harness, result: RedPriestCampaignReceipt['result'] = 'SUCCESS') {
  launch(h); h.act({ type: 'MARCH', nodeId: 'northern-pass' }); h.act({ type: 'BATTLE', nodeId: 'northern-pass' }, result);
}
function take(h: Harness, nodeId: typeof RED_PRIEST_CAMPAIGN_NODES[number]['id']) {
  h.act({ type: 'MARCH', nodeId }); h.act({ type: 'BATTLE', nodeId }); h.act({ type: 'CONSOLIDATE', nodeId });
}
function fullRoute(h: Harness) { launch(h); for (const n of RED_PRIEST_CAMPAIGN_NODES) take(h, n.id); }
function rejection(h: Harness, command: RedPriestCampaignCommand, code: string, host = h.host(command)) {
  const before = structuredClone(h.state);
  expect(reduceRedPriestCampaign(h.state, command, host)).toMatchObject({ ok: false, block: { code } });
  expect(h.state).toEqual(before);
}
function allFinite(s: RedPriestCampaignState) {
  for (const p of RED_PRIEST_CAMPAIGN_POLITIES) {
    const actual = s.polities[p.id];
    expect(actual.treasury).toBeGreaterThanOrEqual(0); expect(actual.reservePersonnel).toBeGreaterThanOrEqual(0);
    expect(actual.supplyReserve).toBeGreaterThanOrEqual(0);
    expect(actual.treasury + actual.treasurySpent).toBe(p.treasury);
    expect(actual.reservePersonnel + actual.reservesCommitted).toBe(p.reserves);
    expect(actual.supplyReserve + actual.suppliesCommitted).toBe(p.supplyReserve);
  }
  for (const l of RED_PRIEST_CAMPAIGN_LEGIONS) {
    const actual = s.legions[l.id];
    expect(actual.personnel).toBeGreaterThanOrEqual(0); expect(actual.supply).toBeGreaterThanOrEqual(0);
    expect(actual.personnel + actual.killed + actual.wounded + actual.detached).toBe(l.personnel + actual.reinforcements);
    expect(actual.supply + actual.supplySpent).toBe(l.supply + actual.supplyDelivered);
  }
}

describe('209 independent finite north-continent campaign prototype', () => {
  it('starts with a crisis and existing finite countries, armies, guards and residents, never an old war or mutual-aid army', () => {
    const h = harness();
    expect(verifyRedPriestCampaignState(h.state)).toBe(true);
    expect(h.state).toMatchObject({ phase: 'CRISIS', declaration: null, firstCrossBorder: null, warStarted: null,
      origin: { startWeek: 187795, branchYear: 1353, existingWar: false } });
    expect(Object.keys(h.state.polities)).toHaveLength(4); expect(Object.keys(h.state.nodes)).toHaveLength(6);
    expect(Object.keys(h.state.legions)).toHaveLength(13);
    expect(new Set(RED_PRIEST_CAMPAIGN_NODES.map(n => n.originalDefenderId)).size).toBe(6);
    expect(Object.values(h.state.legions).every(l => !l.mobilized)).toBe(true);
    expect(JSON.stringify(h.state)).not.toMatch(/IB4|mutual|sourceTeam/);
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false); allFinite(h.state);
  });

  it.each([
    null, [], {}, { type: 'WIN' }, { type: 'DECLARE_OFFENSIVE', authorized: true },
    { type: 'BATTLE', nodeId: 'northern-pass', outcome: 'SUCCESS' },
    { type: 'BATTLE', nodeId: 'northern-pass', personnel: 999999 },
    { type: 'MARCH', nodeId: 'unknown' }, { type: 'WAIT', revision: 0 },
    { type: 'WAIT', intentId: 'pretend' }, { type: 'HOST_ADVANCE', toWeek: 999999 },
    { type: 'DETACHMENT_DISPATCH', legionId: 'loen-expedition', personnel: 6 },
    { type: 'DETACHMENT_SETTLE', detachmentId: 'invented', killed: 0, wounded: 0 },
    { type: 'MILITARY_LABOUR', taskId: 'SUPPLY_INVENTORY', cashGain: 9999 }, { type: 'REORGANIZE', polityId: 'feysac' },
    { type: 'REQUEST_AUTHORITY', polityId: 'loen', treasury: -100 },
  ])('strictly rejects non-intents and forged command fields: %j', command => {
    expect(validateRedPriestCampaignCommand(command)).toBe(false);
    const h = harness();
    expect(reduceRedPriestCampaign(h.state, command, h.host({ type: 'WAIT' }))).toMatchObject({ ok: false, block: { code: 'INVALID_COMMAND' } });
  });

  it('requires three real independent authorizations, a separate declaration, and actual first crossing and battle', () => {
    const h = harness();
    rejection(h, { type: 'DECLARE_OFFENSIVE' }, 'MISSING_AUTHORITY');
    h.act({ type: 'REQUEST_AUTHORITY', polityId: 'loen' }, 'FAILURE');
    expect(h.state.polities.loen.authority).toBe('REFUSED');
    h.act({ type: 'REQUEST_AUTHORITY', polityId: 'feysac' });
    expect(h.state.polities.feysac.authority).toBe('REFUSED');
    rejection(h, { type: 'REQUEST_AUTHORITY', polityId: 'feysac' }, 'REFUSAL_RECORDED');
    for (const polityId of ['loen', 'intis'] as const) h.act({ type: 'REQUEST_AUTHORITY', polityId });
    rejection(h, { type: 'DECLARE_OFFENSIVE' }, 'MISSING_AUTHORITY');
    h.act({ type: 'REQUEST_AUTHORITY', polityId: 'feneport' });
    expect(h.state.warStarted).toBeNull(); expect(h.state.declaration).toBeNull();
    h.act({ type: 'DECLARE_OFFENSIVE' });
    expect(h.state.phase).toBe('ORDERED'); expect(h.state.warStarted).toBeNull();
    expect(h.state.nodes['western-depot'].controller).toBe('intis');
    rejection(h, { type: 'BATTLE', nodeId: 'northern-pass' }, 'NOT_PRESENT');
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    expect(h.state.firstCrossBorder).not.toBeNull(); expect(h.state.warStarted).toBeNull();
    const noReceipt = h.host({ type: 'BATTLE', nodeId: 'northern-pass' }); delete (noReceipt as { receipt?: unknown }).receipt;
    rejection(h, { type: 'BATTLE', nodeId: 'northern-pass' }, 'INVALID_RECEIPT', noReceipt);
    h.act({ type: 'BATTLE', nodeId: 'northern-pass' });
    expect(h.state.phase).toBe('WAR'); expect(h.state.warStarted?.receiptId).toBe(h.receipts.at(-1)?.id);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true);
  });

  it.each(['campaignId', 'eventId', 'revision', 'week', 'kind', 'targetId', 'source', 'result'] as const)('binds host receipt %s to the actual action', key => {
    const h = harness(), command = { type: 'REQUEST_AUTHORITY', polityId: 'loen' } as const;
    const host = structuredClone(h.host(command));
    (host.receipt as unknown as Record<string, unknown>)[key] = key === 'revision' || key === 'week' ? -1 : 'forged';
    rejection(h, command, 'INVALID_RECEIPT', host);
  });

  it('rejects mismatched weeks, positions, dead or wrong-stage actors, reused events and extra receipts', () => {
    const h = harness(), command = { type: 'WAIT' } as const;
    rejection(h, command, 'WEEK_MISMATCH', { ...h.host(command), week: h.state.week + 1 });
    rejection(h, command, 'LOCATION_MISMATCH', { ...h.host(command), player: { ...h.player, campaignLocation: 'southern-harbor' } });
    for (const update of [{ alive: false }, { health: 0 }, { sequence: 0 }, { pathwayId: 'seer' }])
      rejection(h, command, 'INELIGIBLE', { ...h.host(command), player: { ...h.player, ...update } });
    const usedEvent = h.host(command).eventId; h.act(command);
    rejection(h, command, 'REPEATED_EVENT', { ...h.host(command), eventId: usedEvent });
    const receipt = h.host({ type: 'REQUEST_AUTHORITY', polityId: 'loen' }).receipt!;
    rejection(h, command, 'UNEXPECTED_RECEIPT', { ...h.host(command), receipt });
  });

  it.each(['cash','health','mind','spirituality'] as const)('rejects negative and non-finite host %s without mutation', key => {
    const h = harness(), command = { type: 'WAIT' } as const;
    for (const bad of [-1, NaN, Infinity, 0.5]) rejection(h, command, 'INVALID_HOST', { ...h.host(command), player: { ...h.player, [key]: bad } });
  });

  it('blocks unaffordable costs, remote attacks, geographical skips, repeat victory, and consolidation without a victory', () => {
    const h = harness(); h.setPlayer({ cash: 0 });
    rejection(h, { type: 'REQUEST_AUTHORITY', polityId: 'loen' }, 'PLAYER_RESOURCES');
    h.setPlayer({ cash: 10000 }); launch(h);
    rejection(h, { type: 'MARCH', nodeId: 'eastern-stores' }, 'NO_ROUTE');
    rejection(h, { type: 'CONSOLIDATE', nodeId: 'northern-pass' }, 'NOT_PRESENT');
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    rejection(h, { type: 'CONSOLIDATE', nodeId: 'northern-pass' }, 'NOT_CONTROLLED');
    rejection(h, { type: 'MARCH', nodeId: 'eastern-bridge' }, 'UNSECURED_ROUTE');
    h.setPlayer({ spirituality: 5 }); rejection(h, { type: 'BATTLE', nodeId: 'northern-pass' }, 'PLAYER_RESOURCES');
    h.setPlayer({ spirituality: 120 }); h.act({ type: 'BATTLE', nodeId: 'northern-pass' });
    rejection(h, { type: 'BATTLE', nodeId: 'northern-pass' }, 'ALREADY_WON');
    h.act({ type: 'CONSOLIDATE', nodeId: 'northern-pass' });
    rejection(h, { type: 'CONSOLIDATE', nodeId: 'northern-pass' }, 'ALREADY_CONSOLIDATED');
    expect(deriveRedPriestCampaignAchievement(h.state).independentVictories).toHaveLength(1);
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false);
  });

  it('reaches six distinct strategic nodes across all three theaters in 24 weeks and settles a real armistice in week 25', () => {
    const h = harness(), startCash = h.player.cash;
    fullRoute(h);
    expect(h.state.week - h.state.origin.startWeek).toBe(24);
    const achievement = deriveRedPriestCampaignAchievement(h.state);
    expect(achievement).toMatchObject({ achieved: true, declaredByPlayer: true, firstCrossBorderExecuted: true, firstBattleExecuted: true, ceased: false });
    expect(achievement.independentVictories).toHaveLength(6); expect(achievement.withdrawalEvidence).toHaveLength(6);
    expect(achievement.controlledTheaters).toHaveLength(3); expect(achievement.engagedTheaters).toHaveLength(3);
    expect(achievement.participatingPolities).toHaveLength(4);
    expect(new Set(Object.values(h.state.nodes).map(n => n.victory!.receiptId)).size).toBe(6);
    for (const n of Object.values(h.state.nodes)) {
      expect(n.battleCount).toBe(1); expect(n.coalitionLosses).toBe(540); expect(n.defenderLosses).toBeGreaterThan(0);
      expect(n.facilityIntegrity).toBeLessThan(100); expect(n.supplyIntegrity).toBeLessThan(100);
      expect(n.civilianDeaths).toBe(0);
    }
    expect(h.player.cash).toBeLessThan(startCash); expect(h.player.sequence).toBe(1);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); allFinite(h.state);
    h.act({ type: 'SEEK_ARMISTICE' });
    expect(h.state.week - h.state.origin.startWeek).toBe(25); expect(h.state.phase).toBe('ARMISTICE');
    expect(deriveRedPriestCampaignAchievement(h.state)).toMatchObject({ achieved: true, ceased: true });
    expect(Object.values(h.state.legions).every(l => !l.mobilized)).toBe(true);
    rejection(h, { type: 'WAIT' }, 'ENDED');
  });

  it('requires the fifth independent victory and actual third-theater consolidation rather than a success boolean', () => {
    const h = harness(); launch(h);
    for (const n of RED_PRIEST_CAMPAIGN_NODES.slice(0, 4)) take(h, n.id);
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false);
    h.act({ type: 'MARCH', nodeId: 'eastern-stores' }); h.act({ type: 'BATTLE', nodeId: 'eastern-stores' });
    expect(deriveRedPriestCampaignAchievement(h.state).independentVictories).toHaveLength(5);
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false);
    h.act({ type: 'CONSOLIDATE', nodeId: 'eastern-stores' });
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(true);
    expect(h.state.week - h.state.origin.startWeek).toBe(21);
  });

  it('preserves an actual defeat, pays finite reserves and waits for cross-week delivery before finishing the same route', () => {
    const h = harness(); firstBattle(h, 'FAILURE');
    const failed = structuredClone(h.state), first = failed.legions['loen-expedition'];
    expect(h.state.location).toBe('loen-headquarters'); expect(h.state.nodes['northern-pass'].victory).toBeNull();
    expect(first.personnel).toBe(2000); expect(first.killed + first.wounded).toBe(600);
    h.act({ type: 'MARCH', nodeId: 'northern-pass' });
    rejection(h, { type: 'BATTLE', nodeId: 'northern-pass' }, 'ARMY_DEPLETED');
    const loenMoney = h.state.polities.loen.treasury;
    const ordered = h.act({ type: 'REORGANIZE', polityId: 'loen' });
    expect(h.state.legions['loen-expedition'].personnel).toBe(2000);
    expect(h.state.convoys[0]?.status).toBe('IN_TRANSIT');
    expect(ordered.events.some(e => e.type === 'CONVOY_ARRIVED')).toBe(false);
    expect(h.state.polities.loen.treasury).toBeLessThan(loenMoney - 599);
    expect(h.state.polities.loen.reservePersonnel).toBe(900);
    rejection(h, { type: 'REORGANIZE', polityId: 'loen' }, 'CONVOY_PENDING');
    h.act({ type: 'REORGANIZE', polityId: 'intis' });
    expect(h.state.convoys[0]?.status).toBe('DELIVERED');
    expect(h.state.legions['loen-expedition'].personnel).toBe(2300);
    h.act({ type: 'REORGANIZE', polityId: 'feneport' }); h.act({ type: 'WAIT' });
    expect(h.state.convoys.every(c => c.status === 'DELIVERED')).toBe(true);
    for (const id of ['loen-expedition','intis-expedition','feneport-expedition'] as const) {
      expect(h.state.legions[id].killed + h.state.legions[id].wounded).toBe(600);
      expect(h.state.legions[id].personnel).toBe(2300); expect(h.state.legions[id].morale).toBeLessThan(72);
    }
    expect(h.state.nodes['northern-pass'].facilityIntegrity).toBe(failed.nodes['northern-pass'].facilityIntegrity);
    h.act({ type: 'BATTLE', nodeId: 'northern-pass' }); h.act({ type: 'CONSOLIDATE', nodeId: 'northern-pass' });
    for (const n of RED_PRIEST_CAMPAIGN_NODES.slice(1)) take(h, n.id);
    expect(h.state.nodes['northern-pass'].battleCount).toBe(2);
    expect(h.state.nodes['northern-pass'].coalitionLosses).toBe(2340);
    expect(deriveRedPriestCampaignAchievement(h.state).independentVictories).toHaveLength(6);
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(true);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); allFinite(h.state);
  });

  it('allows early armistice without granting ritual achievement and rejects continuing an ended campaign', () => {
    const h = harness(); rejection(h, { type: 'SEEK_ARMISTICE' }, 'NO_WAR'); firstBattle(h);
    h.act({ type: 'SEEK_ARMISTICE' }, 'FAILURE'); expect(h.state.phase).toBe('WAR');
    h.act({ type: 'SEEK_ARMISTICE' }); expect(h.state.phase).toBe('ARMISTICE');
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false);
    expect(h.player.sequence).toBe(1); rejection(h, { type: 'DECLARE_OFFENSIVE' }, 'ENDED');
  });

  it('honors relinquished authority and returns pending reserves without refunding spent transportation or restoring losses', () => {
    const h = harness(); firstBattle(h, 'FAILURE');
    h.act({ type: 'REORGANIZE', polityId: 'loen' });
    const spent = h.state.polities.loen.treasurySpent;
    h.act({ type: 'RELEASE_AUTHORITY', polityId: 'loen' });
    expect(h.state.polities.loen.authority).toBe('RELEASED'); expect(h.state.convoys[0]?.status).toBe('RETURNED');
    expect(h.state.polities.loen.reservePersonnel).toBe(1200);
    expect(h.state.polities.loen.treasurySpent).toBeGreaterThanOrEqual(spent);
    expect(h.state.legions['loen-expedition'].killed + h.state.legions['loen-expedition'].wounded).toBe(600);
    rejection(h, { type: 'MARCH', nodeId: 'northern-pass' }, 'AUTHORITY_WITHDRAWN');
    h.act({ type: 'WITHDRAW_PROTECT' }); expect(h.state.phase).toBe('WITHDRAWN');
    expect(h.player.sequence).toBe(1); expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); allFinite(h.state);
  });

  it('withdraws along the complete real return route and retains original casualties, civilian displacement history and costs', () => {
    const h = harness(); fullRoute(h); const before = structuredClone(h.state);
    const result = h.act({ type: 'WITHDRAW_PROTECT' });
    expect(result.settlement).toMatchObject({ travelWeeks: 8, weeks: 8, fromLocation: 'southern-harbor', toLocation: 'loen-headquarters' });
    expect(h.state.week - before.week).toBe(8); expect(h.state.phase).toBe('WITHDRAWN');
    expect(h.state.nodes['northern-pass'].victory).toEqual(before.nodes['northern-pass'].victory);
    expect(h.state.legions['loen-expedition'].killed).toBe(before.legions['loen-expedition'].killed);
    expect(h.state.nodes['southern-harbor'].facilityIntegrity).toBe(before.nodes['southern-harbor'].facilityIntegrity);
    expect(Object.values(h.state.nodes).every(n => n.displaced === 0)).toBe(true);
    expect(deriveRedPriestCampaignAchievement(h.state).achieved).toBe(false); allFinite(h.state);
  });

  it('replays exact private source history and rejects edited victories, units, budgets, clocks, receipts and event results', () => {
    const h = harness(); firstBattle(h); h.act({ type: 'CONSOLIDATE', nodeId: 'northern-pass' });
    expect(verifyRedPriestCampaignState(JSON.parse(JSON.stringify(h.state)), h.receipts)).toBe(true);
    const mutations: ((s: RedPriestCampaignState) => void)[] = [
      s => { s.nodes['western-depot'].victory = structuredClone(s.nodes['northern-pass'].victory); },
      s => { s.legions['loen-expedition'].personnel += 1; },
      s => { s.polities.loen.treasury += 1; },
      s => { s.week += 1; },
      s => { s.nodes['northern-pass'].consolidated = false; },
      s => { (s.journal[0]!.host.receipt as RedPriestCampaignReceipt).result = 'FAILURE'; },
      s => { s.journal[0]!.settlement.cash = 0; },
      s => { s.journal[0]!.events[0]!.message = 'forged result'; },
      s => { s.origin.existingWar = true as false; },
    ];
    for (const change of mutations) { const bad = structuredClone(h.state); change(bad); expect(verifyRedPriestCampaignState(bad, h.receipts)).toBe(false); }
    expect(verifyRedPriestCampaignState(h.state, [])).toBe(false);
    expect(verifyRedPriestCampaignState({})).toBe(false); expect(verifyRedPriestCampaignState(null)).toBe(false);
  });

  it('rejects all negative private army, country and node numeric resources', () => {
    const h = harness();
    for (const group of ['polities','legions','nodes'] as const) {
      for (const [id, entity] of Object.entries(h.state[group])) {
        for (const [key, value] of Object.entries(entity)) {
          if (typeof value !== 'number') continue;
          const bad = structuredClone(h.state);
          (bad[group] as unknown as Record<string, Record<string, unknown>>)[id]![key] = -1;
          expect(verifyRedPriestCampaignState(bad), `${group}.${id}.${key}`).toBe(false);
        }
      }
    }
  });

  it('keeps real resources finite beyond the mobilization review and allows zero-cash withdrawal without a hard calendar expiry', () => {
    const h = harness();
    launch(h);
    for (let i = 1; i < RED_PRIEST_CAMPAIGN_LIMITS.reviewAfterWeeks; i += 1) h.act({ type: 'WAIT' });
    const before = h.state.polities.loen.treasury;
    expect(projectRedPriestCampaign(h.state).mobilizationReview).toBe(true);
    h.act({ type: 'WAIT' });
    expect(h.state.polities.loen.treasury).toBeLessThan(before);
    h.setPlayer({ cash: 0, spirituality: 0 }); h.act({ type: 'WITHDRAW_PROTECT' });
    expect(h.state.phase).toBe('WITHDRAWN'); expect(h.player.cash).toBe(0);
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); allFinite(h.state);
  });

  it('pays only actual authorized weekly labour from Loen treasury, with two actions and no automatic wage or calendar jump', () => {
    const h = harness();
    rejection(h, { type: 'MILITARY_LABOUR', taskId: 'SUPPLY_INVENTORY' }, 'NO_AUTHORITY');
    h.act({ type: 'REQUEST_AUTHORITY', polityId: 'loen' });
    const before = structuredClone(h.state), cash = h.player.cash;
    h.setPlayer({ actionsRemaining: 1 });
    rejection(h, { type: 'MILITARY_LABOUR', taskId: 'SUPPLY_INVENTORY' }, 'NO_ACTIONS');
    h.setPlayer({ actionsRemaining: 3 });
    rejection(h, { type: 'MILITARY_LABOUR', taskId: 'CASUALTY_REGISTER' }, 'LABOUR_TASK_ORDER');
    const work = h.act({ type: 'MILITARY_LABOUR', taskId: 'SUPPLY_INVENTORY' });
    expect(work.settlement).toMatchObject({ cash: 0, cashGain: 60, actions: 2, weeks: 0 });
    expect(h.state.week).toBe(before.week); expect(h.player.cash).toBe(cash + 60);
    expect(h.state.polities.loen.treasury).toBe(before.polities.loen.treasury - 60);
    expect(h.state.polities.intis.treasury).toBe(before.polities.intis.treasury);
    h.setPlayer({ actionsRemaining: 3 });
    rejection(h, { type: 'MILITARY_LABOUR', taskId: 'CASUALTY_REGISTER' }, 'LABOUR_DONE_THIS_WEEK');
    h.act({ type: 'WAIT' }); expect(h.player.cash).toBe(cash + 60);
    h.act({ type: 'MILITARY_LABOUR', taskId: 'CASUALTY_REGISTER' });
    h.act({ type: 'WAIT' }); h.act({ type: 'MILITARY_LABOUR', taskId: 'HANDOVER_RECONCILIATION' });
    expect(h.state.labour).toMatchObject({ completed: 3, earned: 180 });
    expect(projectRedPriestCampaign(h.state).labour.nextTask.id).toBe('SUPPLY_INVENTORY');
    expect(verifyRedPriestCampaignState(h.state, h.receipts)).toBe(true); allFinite(h.state);
  });

  it('synchronizes actual ordinary time without paying twice, accepts prewar preparation, and delivers only real pending convoys', () => {
    const h = harness(), old = structuredClone(h.state);
    const prepareHost = { ...h.host({ type: 'WAIT' }), week: h.state.week + 60 };
    const prepared = advanceRedPriestCampaignToWeek(h.state, prepareHost);
    expect(h.state).toEqual(old); if (!prepared.ok) throw new Error(prepared.block.message);
    expect(prepared.settlement).toMatchObject({ cash: 0, cashGain: 0, actions: 0, weeks: 0 });
    expect(prepared.state.polities).toEqual(old.polities);
    expect(prepared.state.week).toBe(prepareHost.week);
    expect(getRedPriestCampaignBlock(prepared.state, { type: 'REQUEST_AUTHORITY', polityId: 'loen' }, {
      ...h.host({ type: 'WAIT' }), week: prepared.state.week, eventId: 'new-authority-after-preparation' })).toBeNull();
    expect(verifyRedPriestCampaignState(prepared.state)).toBe(true);
    firstBattle(h, 'FAILURE'); h.act({ type: 'REORGANIZE', polityId: 'loen' });
    const before = structuredClone(h.state), advancedHost = { ...h.host({ type: 'WAIT' }), week: h.state.week + 2,
      player: { ...h.player, campaignLocation: 'southern-harbor' as const } };
    const advanced = advanceRedPriestCampaignToWeek(h.state, advancedHost);
    if (!advanced.ok) throw new Error(advanced.block.message);
    expect(advanced.state.convoys[0]?.status).toBe('DELIVERED');
    expect(advanced.state.legions['loen-expedition'].personnel).toBe(before.legions['loen-expedition'].personnel + 300);
    expect(advanced.state.legions['loen-expedition'].killed).toBe(before.legions['loen-expedition'].killed);
    expect(advanced.state.polities.loen.treasury).toBeLessThan(before.polities.loen.treasury);
    expect(verifyRedPriestCampaignState(advanced.state, h.receipts)).toBe(true); allFinite(advanced.state);
    expect(advanceRedPriestCampaignToWeek(advanced.state, { ...advancedHost, eventId: 'backward', week: before.week })).toMatchObject({ ok: false, block: { code: 'INVALID_TIME_ADVANCE' } });
  });

  it('transfers six existing people into one bounded postwar rescue and settles real casualties into the original legion', () => {
    const h = harness(); fullRoute(h); h.act({ type: 'SEEK_ARMISTICE' });
    let state = h.state;
    const host = (eventId: string): RedPriestCampaignHost => ({ week: state.week, eventId,
      player: { ...h.player, sequence: 0, campaignLocation: state.location } });
    const old = structuredClone(state.legions['loen-expedition']);
    expect(dispatchRedPriestCampaignDetachment(state, host('bad-unit'), { legionId: 'intis-expedition', personnel: 6 })).toMatchObject({ ok: false });
    expect(dispatchRedPriestCampaignDetachment(state, host('bad-count'), { legionId: 'loen-expedition', personnel: 7 })).toMatchObject({ ok: false });
    const sent = dispatchRedPriestCampaignDetachment(state, host('rescue-dispatch'), { legionId: 'loen-expedition', personnel: 6 });
    if (!sent.ok) throw new Error(sent.block.message); state = sent.state;
    expect(state.legions['loen-expedition'].personnel).toBe(old.personnel - 6);
    expect(state.legions['loen-expedition'].detached).toBe(6);
    expect(state.legions['loen-expedition'].wounded).toBe(old.wounded);
    expect(state.legions['loen-expedition'].supply).toBe(old.supply - 2);
    expect(dispatchRedPriestCampaignDetachment(state, host('rescue-duplicate'), { legionId: 'loen-expedition', personnel: 6 })).toMatchObject({ ok: false, block: { code: 'DETACHMENT_ALREADY_USED' } });
    expect(settleRedPriestCampaignDetachment(state, host('bad-loss'), { detachmentId: 'rescue-dispatch', killed: 4, wounded: 3 })).toMatchObject({ ok: false });
    expect(settleRedPriestCampaignDetachment(state, host('negative-loss'), { detachmentId: 'rescue-dispatch', killed: -1, wounded: 0 })).toMatchObject({ ok: false });
    const initialSettleHost = host('rescue-settle');
    const deadPlayerHost = { ...initialSettleHost, player: { ...initialSettleHost.player, alive: false, health: 0 } };
    const settled = settleRedPriestCampaignDetachment(state, deadPlayerHost, { detachmentId: 'rescue-dispatch', killed: 1, wounded: 2 });
    if (!settled.ok) throw new Error(settled.block.message); state = settled.state;
    expect(state.legions['loen-expedition'].personnel).toBe(old.personnel - 3);
    expect(state.legions['loen-expedition'].detached).toBe(0);
    expect(state.legions['loen-expedition'].killed).toBe(old.killed + 1);
    expect(state.legions['loen-expedition'].wounded).toBe(old.wounded + 2);
    expect(state.detachments[0]).toMatchObject({ returned: 3, killed: 1, wounded: 2, status: 'RETURNED' });
    expect(settleRedPriestCampaignDetachment(state, host('settle-again'), { detachmentId: 'rescue-dispatch', killed: 0, wounded: 0 })).toMatchObject({ ok: false });
    expect(verifyRedPriestCampaignState(state, h.receipts)).toBe(true); allFinite(state);
    expect(getRedPriestCampaignTravelWeeks('loen-headquarters', 'southern-harbor')).toBe(8);
    expect(getRedPriestCampaignTravelWeeks('eastern-bridge', 'eastern-stores')).toBe(5);
  });

  it('projects visible facts without private receipts, host budgets, source journals or developer provenance labels', () => {
    const h = harness(); firstBattle(h); const view = projectRedPriestCampaign(h.state), json = JSON.stringify(view);
    expect(view.theaters).toHaveLength(3); expect(view.polities).toHaveLength(4);
    for (const hidden of ['journal','authorizationEventId','receiptId','BATTLE_RESOLUTION','campaign-event','checkTotal','branchYear']) expect(json).not.toContain(hidden);
    expect(json).not.toMatch(/\bG[0-9]|G标签/);
    const original = h.state.nodes['northern-pass'].facilityIntegrity;
    view.theaters[0]!.nodes[0]!.facilityIntegrity = 0;
    expect(h.state.nodes['northern-pass'].facilityIntegrity).toBe(original);
  });
});
