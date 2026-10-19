import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createRedPriestCampaign } from '../../src/domain/red-priest/campaign.js';
import { RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_NODES } from '../../src/domain/red-priest/campaign-content.js';
import { RED_PRIEST_MATERIAL_IDS, RED_PRIEST_UNIQUENESS_ID, RED_PRIEST_MATERIAL_LOCATIONS, redPriestCompoundSupply } from '../../src/domain/red-priest/material-content.js';
import { RED_PRIEST_PROMOTION_STABILITY } from '../../src/domain/red-priest/content.js';
import { createRedPriestState, getRedPriestPromotionStabilityPreview, getRedPriestEpilogueCheckPreview } from '../../src/domain/red-priest/engine.js';
import { createRedPriestEpilogue } from '../../src/domain/red-priest/epilogue.js';
import { validateRedPriestCommand } from '../../src/domain/red-priest/index.js';
import type { RedPriestState, RedPriestEvent } from '../../src/domain/red-priest/types.js';

// Small directed readiness fixtures only. These explicitly supplied states and
// receipts are NOT saved games, a natural continuation or promotion evidence.
// Kernel/replay and real-cost checks live in the separate natural QA test.
const actorId = 'directed:original-player', compoundId = 'directed:third-original-compound';
const check = resolveNormalCheck({ ability: 'will', baseAbility: 29, difficulty: 35, modifiers: [], roll: 10 });
function readyFixture(): RedPriestState {
  const root = createRedPriestState(), campaign = createRedPriestCampaign('directed', 200);
  root.guidanceKnown = true;
  root.source = { actorId } as NonNullable<RedPriestState['source']>;
  root.frame = { budget: { week: 300, date: { epoch: 'FIFTH_EPOCH', year: 1355, month: 1, day: 1 },
    actions: 3, cash: 500, health: 100, mind: 100, spirituality: 120, pollution: 0, injuries: [], injuryRisk: 0,
    status: 'ACTIVE', sequence: 1, acting: 100, mastery: {}, completedSources: [],
    coreStats: { physique: 35, perception: 28, will: 29, knowledge: 25 } },
    finance: { weeklyBudget: 3, wagePaidWeek: null, lifeTier: 'DESTITUTE', nextLifeTier: 'DESTITUTE', debts: [], missedWeeks: 0, credit: 0 },
    location: RED_PRIEST_MATERIAL_LOCATIONS.workshop, nowSecond: 0, random: { seed: 'directed-unused', cursor: 0 } };
  campaign.phase = 'ARMISTICE'; campaign.opponentDisposition = 'CEASEFIRE';
  campaign.declaration = { eventId: 'directed:declaration', week: 200, authorities: [...RED_PRIEST_CAMPAIGN_COALITION] };
  campaign.firstCrossBorder = { eventId: 'directed:cross-border', week: 201, from: 'loen-headquarters', to: 'northern-pass' };
  campaign.warStarted = { eventId: 'directed:war-started', receiptId: 'directed:first-battle-receipt', week: 202 };
  for (const polity of Object.values(campaign.polities)) Object.assign(polity,
    { mobilizedPersonnel: 100, treasurySpent: 100, transportLoads: 1, livelihoodLoss: 1 });
  for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) {
    const eventId = `directed:authority:${polityId}`, command = { type: 'REQUEST_AUTHORITY' as const, polityId };
    const host = { eventId, receipt: { id: `${eventId}:receipt`, eventId, campaignId: campaign.campaignId,
      kind: 'AUTHORIZATION', targetId: polityId, result: 'SUCCESS' } };
    Object.assign(campaign.polities[polityId], { authority: 'GRANTED', authorizationEventId: eventId });
    campaign.journal.push(structuredClone({ command, host }) as typeof campaign.journal[number]);
    root.journal.push({ id: eventId, command: { type: 'CAMPAIGN', command }, campaignHost: host,
      before: { location: 'loen-headquarters' }, randomReceipts: [{ check }] } as RedPriestEvent);
  }
  for (const node of RED_PRIEST_CAMPAIGN_NODES.slice(0, 5)) {
    const eventId = `directed:victory:${node.id}`, receiptId = `${eventId}:receipt`;
    Object.assign(campaign.nodes[node.id], { battleCount: 1, controller: 'coalition', consolidated: true,
      victory: { eventId, receiptId, week: 210, defenderId: node.opponentId } });
    campaign.legions[node.opponentId].retreated = true;
    root.journal.push({ id: eventId, command: { type: 'CAMPAIGN', command: { type: 'BATTLE', nodeId: node.id } },
      campaignHost: { receipt: { id: receiptId, campaignId: campaign.campaignId, kind: 'BATTLE', targetId: node.id, result: 'SUCCESS' } },
      randomReceipts: [{ check }] } as RedPriestEvent);
  }
  root.campaign = campaign;
  const integrated = RED_PRIEST_MATERIAL_IDS[2]!;
  root.materials = { status: 'ACTIVE', originDigest: 'directed:original-origin',
    items: RED_PRIEST_MATERIAL_IDS.map(id => ({ id, sourceEventId: `directed:original:${id}`, holderId: actorId,
      locationId: root.frame!.location, disposition: id === integrated ? 'INTEGRATED_PLAYER' : 'IN_COMPOUND',
      containerId: id === integrated ? `body:${actorId}` : compoundId })),
    compounds: [{ id: compoundId, status: 'PREPARED', locationId: root.frame.location, integratedMaterialId: integrated,
      externalMaterialIds: RED_PRIEST_MATERIAL_IDS.slice(0, 2), uniquenessId: RED_PRIEST_UNIQUENESS_ID, supplyReceiptId: 'directed:paid-third-supply' }],
  } as NonNullable<RedPriestState['materials']>;
  return root;
}
function preparedFixture(): RedPriestState {
  const root = readyFixture(), eventId = 'directed:paid-stability';
  root.promotionStability = { version: 1, preparations: [{ id: `${eventId}:promotion-stability`, eventId,
    compoundId, actorId, originDigest: root.materials!.originDigest, supplyReceiptId: root.materials!.compounds[0]!.supplyReceiptId,
    locationId: root.frame!.location, startedWeek: 299, completedWeek: 300, campaignId: root.campaign!.campaignId,
    warStartedEventId: root.campaign!.warStarted!.eventId,
    victoryReceiptIds: RED_PRIEST_CAMPAIGN_NODES.slice(0, 5).map(n => root.campaign!.nodes[n.id].victory!.receiptId),
    witnesses: RED_PRIEST_CAMPAIGN_COALITION.map(polityId => ({ polityId,
      authorizationEventId: `directed:authority:${polityId}`, authorizationReceiptId: `directed:authority:${polityId}:receipt`,
      legionId: `${polityId}-expedition`, personnel: root.campaign!.legions[`${polityId}-expedition`].personnel })),
    originals: root.materials!.items.map(item => ({ itemId: item.id, sourceEventId: item.sourceEventId })), status: 'READY', spentEventId: null, invalidatedEventId: null }] };
  root.journal.push({ id: eventId, command: { type: 'STABILIZE_PROMOTION', compoundId },
    before: { budget: { week: 299 } }, after: { budget: { week: 300 } } } as RedPriestEvent);
  return root;
}

describe('future-only postwar preparation, directed readiness checks', () => {
  it('keeps optional state absent and shows the actual 5% versus paid 68%, never certainty', () => {
    expect(Object.hasOwn(createRedPriestState(), 'promotionStability')).toBe(false);
    const root = readyFixture(), before = stableStringify(root), preview = getRedPriestPromotionStabilityPreview(root, compoundId);
    expect(preview).toMatchObject({ eligible: true, prepared: false, effectiveBonus: 0, currentChance: 5, stabilizedChance: 68, victoryCount: 5 });
    expect(preview.cost).toEqual({ actions: 2, cash: 120, spirituality: 12, mind: 8, weeks: 1 });
    expect(preview.witnesses.map(w => w.polityId)).toEqual(['loen', 'intis', 'feneport']);
    expect(stableStringify(preview)).not.toMatch(/authorizationEventId|receipt|sourceEventId|seed|cursor/);
    expect(stableStringify(root)).toBe(before);
    expect(resolveNormalCheck({ baseAbility: 29, difficulty: 55, modifiers: [{ source: 'directed paid preparation', value: 35 }], roll: 69 }).tier).toBe('FAILURE');
    expect(resolveNormalCheck({ baseAbility: 29, difficulty: 55, modifiers: [{ source: 'directed paid preparation', value: 35 }], roll: 99 }).tier).toBe('GREAT_FAILURE');
  });
  it('requires all three concrete mandates and their original surviving legions', () => {
    for (const mutate of [
      (r: RedPriestState) => { r.campaign!.polities.intis.authority = 'RELEASED'; },
      (r: RedPriestState) => { r.campaign!.polities.intis.authorizationEventId = 'invented:witness'; },
      (r: RedPriestState) => { r.campaign!.legions['intis-expedition'].personnel = 0; },
      (r: RedPriestState) => { r.campaign!.legions['intis-expedition'].retreated = true; },
      (r: RedPriestState) => { r.journal = r.journal.filter(e => e.id !== 'directed:authority:intis'); },
      (r: RedPriestState) => { r.campaign!.journal[1]!.host.receipt!.id = 'invented:source'; },
      (r: RedPriestState) => { r.campaign!.nodes['eastern-stores'].victory!.receiptId = 'invented:victory'; },
    ]) { const root = readyFixture(); mutate(root); expect(getRedPriestPromotionStabilityPreview(root, compoundId).eligible).toBe(false); }
  });
  it('requires the genuine unconsumed same-location compound, body, money, actions and resources', () => {
    for (const mutate of [
      (r: RedPriestState) => { r.frame!.location = 'loen-headquarters'; },
      (r: RedPriestState) => { r.frame!.budget.status = 'DEAD'; },
      (r: RedPriestState) => { r.frame!.budget.acting = 99; },
      (r: RedPriestState) => { r.frame!.budget.health = 79; },
      (r: RedPriestState) => { r.frame!.budget.mind = 69; },
      (r: RedPriestState) => { r.frame!.budget.cash = 119; },
      (r: RedPriestState) => { r.frame!.budget.actions = 1; },
      (r: RedPriestState) => { r.frame!.budget.spirituality = 11; },
      (r: RedPriestState) => { r.materials!.compounds[0]!.status = 'CONSUMED'; },
      (r: RedPriestState) => { r.materials!.items[0]!.locationId = 'remote:vault'; },
      (r: RedPriestState) => { r.materials!.items[0]!.holderId = 'invented:player'; },
      (r: RedPriestState) => { r.materials!.items[0]!.id = 'invented:fourth-characteristic'; },
      (r: RedPriestState) => { r.campaign!.phase = 'WAR'; },
    ]) { const root = readyFixture(); mutate(root); expect(getRedPriestPromotionStabilityPreview(root, compoundId).eligible).toBe(false); }
  });
  it('binds one preparation to one compound and authenticates its recorded preparation event', () => {
    const root = preparedFixture(), preview = getRedPriestPromotionStabilityPreview(root, compoundId);
    expect(preview).toMatchObject({ eligible: false, prepared: true, effectiveBonus: 35, currentChance: 68, status: 'READY' });
    expect(getRedPriestPromotionStabilityPreview(root, 'another:compound').prepared).toBe(false);
    const forged = structuredClone(root); forged.promotionStability!.preparations[0]!.witnesses[1]!.authorizationEventId = 'invented:witness';
    expect(getRedPriestPromotionStabilityPreview(forged, compoundId).prepared).toBe(false);
    root.promotionStability!.preparations[0]!.status = 'SPENT'; root.promotionStability!.preparations[0]!.spentEventId = 'directed:consume';
    expect(getRedPriestPromotionStabilityPreview(root, compoundId)).toMatchObject({ prepared: false, effectiveBonus: 0, currentChance: 5, status: 'SPENT' });
  });
  it('does not revive explicitly invalidated preparation or lock a later original compound', () => {
    const root = preparedFixture(), old = root.promotionStability!.preparations[0]!;
    old.status = 'INVALIDATED'; old.invalidatedEventId = 'directed:left-original-workshop';
    // Even with all original location/mandate conditions restored, payment is
    // retained and the discarded preparation never springs back to life.
    expect(getRedPriestPromotionStabilityPreview(root, compoundId)).toMatchObject({ prepared: false, effectiveBonus: 0, currentChance: 5, eligible: false });
    const nextId = 'directed:later-original-compound';
    root.materials!.compounds[0]!.status = 'CONSUMED';
    root.materials!.compounds.push({ ...root.materials!.compounds[0]!, id: nextId, status: 'PREPARED', supplyReceiptId: 'directed:later-paid-supply' });
    for (const item of root.materials!.items) if (item.containerId === compoundId) item.containerId = nextId;
    expect(getRedPriestPromotionStabilityPreview(root, nextId)).toMatchObject({ prepared: false, currentChance: 5, eligible: true });
  });
  it('never accepts caller-supplied witnesses, bonus, outcomes or epilogue version', () => {
    expect(validateRedPriestCommand({ type: 'STABILIZE_PROMOTION', compoundId })).toBe(true);
    for (const extra of [{ witnesses: ['fake'] }, { effectiveBonus: 95 }, { confirmed: true }, { roll: 1 }])
      expect(validateRedPriestCommand({ type: 'STABILIZE_PROMOTION', compoundId, ...extra })).toBe(false);
    expect(validateRedPriestCommand({ type: 'START_PREPARED_EPILOGUE' })).toBe(true);
    expect(validateRedPriestCommand({ type: 'START_PREPARED_EPILOGUE', rulesVersion: 2 })).toBe(false);
    expect(redPriestCompoundSupply(3)).not.toBeNull(); expect(redPriestCompoundSupply(4)).toBeNull();
    expect(RED_PRIEST_PROMOTION_STABILITY.effectiveBonus).toBe(35);
  });
  it('uses +25 only for genuine v2 S0 supernatural actions, retaining ordinary and legacy odds', () => {
    const root = readyFixture(); root.frame!.budget.sequence = 0; root.promotionWeek = 300;
    root.epilogue = createRedPriestEpilogue({ eventId: 'directed:epilogue', week: 300, revision: 1200,
      legionId: 'loen-expedition', location: 'eastern-stores', detachmentId: 'directed:detachment' });
    expect(Object.hasOwn(root.epilogue, 'rulesVersion')).toBe(false);
    expect(getRedPriestEpilogueCheckPreview(root, 'COORDINATE')?.chance).toBe(24);
    expect(getRedPriestEpilogueCheckPreview(root, 'CONTAIN_FIRE')?.chance).toBe(12);
    root.epilogue.rulesVersion = 2;
    expect(getRedPriestEpilogueCheckPreview(root, 'COORDINATE')).toMatchObject({ chance: 74, effectiveBonus: 25 });
    expect(getRedPriestEpilogueCheckPreview(root, 'CONTAIN_FIRE')).toMatchObject({ chance: 62, effectiveBonus: 25 });
    expect(getRedPriestEpilogueCheckPreview(root, 'EVACUATE')).toMatchObject({ chance: 24, effectiveBonus: 0 });
    root.epilogue.coordinated = true;
    expect(getRedPriestEpilogueCheckPreview(root, 'EVACUATE')).toMatchObject({ chance: 34, effectiveBonus: 5 });
    root.epilogue.fire = 5;
    expect(getRedPriestEpilogueCheckPreview(root, 'EVACUATE')?.chance).toBe(computeCheckChance({ baseAbility: 35, difficulty: 36, modifiers: [{ source: 'coordination', value: 5 }] }));
    root.frame!.budget.sequence = 1;
    expect(getRedPriestEpilogueCheckPreview(root, 'COORDINATE')?.effectiveBonus).toBe(0);
    expect(getRedPriestEpilogueCheckPreview(root, 'REPORT')).toBeNull();
  });
});
