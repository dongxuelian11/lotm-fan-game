import type { SliceState } from '../slice/types.js';
import type { PublicCoreStatKey } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks } from '../game-calendar.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createRedPriestSource, validateRedPriestSource, type RedPriestSource, type RedPriestBudget } from './source.js';
import { validateRedPriestCommand } from './index.js';
import { createRedPriestCampaign, reduceRedPriestCampaign, getRedPriestCampaignBlock, getRedPriestCampaignChallenge,
  deriveRedPriestCampaignAchievement, advanceRedPriestCampaignToWeek, dispatchRedPriestCampaignDetachment, settleRedPriestCampaignDetachment,
  type RedPriestCampaignHost } from './campaign.js';
import { RED_PRIEST_CAMPAIGN_NODES, RED_PRIEST_CAMPAIGN_ROUTES, RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_LEGIONS, RED_PRIEST_CAMPAIGN_POLITIES, type CampaignNodeId } from './campaign-content.js';
import { createRedPriestMaterials, reduceRedPriestMaterials, redPriestMaterialBlock, applyRedPriestMaterialConsumption,
  transportRedPriestMaterials, type RedPriestMaterialsOrigin, type RedPriestMaterialAuthority, type RedPriestMaterialFrame,
  type RedPriestMaterialActor, type RedPriestMaterialCheckReceipt, type RedPriestMaterialConsumptionReceipt,
  type RedPriestMaterialTransportReceipt, type RedPriestMaterialHost, type RedPriestMaterialCommand,
  type RedPriestMaterialEvidence } from './materials.js';
import { RED_PRIEST_MATERIAL_IDS, RED_PRIEST_UNIQUENESS_ID, RED_PRIEST_MATERIAL_LOCATIONS,
  RED_PRIEST_RELIC_CUSTODY, RED_PRIEST_SUPPLIER_LEADS, redPriestCompoundSupply, RED_PRIEST_MATERIAL_COSTS } from './material-content.js';
import { RED_PRIEST_CITY_PLACES, RED_PRIEST_CONSUMPTION, RED_PRIEST_PROMOTION_STABILITY, RED_PRIEST_EPILOGUE_CAPABILITY_BONUS } from './content.js';
import { RED_PRIEST_ABILITY_IDS, type RedPriestState, type RedPriestCommand, type RedPriestFrame, type RedPriestEvent, type RedPriestCheckReceipt, type RedPriestPromotionWitness, type RedPriestPromotionPreparation } from './types.js';
import { createRedPriestEpilogue, applyRedPriestEpilogue, redPriestEpilogueBlock } from './epilogue.js';
export const sameRedPriest = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const redPriestDigest = (v: unknown): string => sha256Hex(stableStringify(v));
function need(value: unknown, reason: string): asserts value { if (!value) throw Error(reason); }
const clone = <T>(value: T): T => structuredClone(value);
const city = (id: string) => RED_PRIEST_CITY_PLACES.some(p => p.id === id);
function dataDigest(root: RedPriestState): string { const { journal: _journal, ...data } = root; return redPriestDigest(data); }
export function createRedPriestState(): RedPriestState {
  return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null, campaign: null, materials: null, epilogue: null, journal: [] };
}
interface VerifiedContext { readonly origin: RedPriestMaterialsOrigin }
interface Prepared { root: RedPriestState; context: VerifiedContext }
declare const redPriestOwnedEngineBrand: unique symbol;
export interface RedPriestOwnedEngine { readonly [redPriestOwnedEngineBrand]: true }
const owned = new WeakMap<RedPriestOwnedEngine, Prepared>();
function getOwned(handle: RedPriestOwnedEngine): Prepared { const value = owned.get(handle); need(value, '无效的当前领域会话。'); return value; }
function retain(value: Prepared): RedPriestOwnedEngine { const handle = Object.freeze({}) as RedPriestOwnedEngine; owned.set(handle, value); return handle; }
function frozen<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const child of Object.values(v)) frozen(child); Object.freeze(v); } return v; }
function materialOrigin(source: RedPriestSource): RedPriestMaterialsOrigin {
  const sourceDigest = source.historyDigest;
  return { version: 1, caseId: `red-priest:${source.runId}`, actorId: source.actorId,
    sourceSnapshotDigest: redPriestDigest(source), sourceDigest, bottlesDigest: redPriestDigest(source.acquisition.bottles),
    acquisitionJournalDigest: redPriestDigest(source.acquisition.consumptions),
    checkpoint: { week: source.budget.week, revision: source.revision, locationId: 'loen-headquarters' },
    bottles: source.acquisition.bottles.map(bottle => {
      const event = source.acquisition.consumptions.find(e => e.command.type === 'CONSUME' && e.command.bottleId === bottle.id);
      if (bottle.status === 'CONSUMED') need(event?.check, '原服药记录缺少实际检定。');
      const integrated = bottle.outcome === 'SUCCESS' || bottle.outcome === 'GREAT_SUCCESS';
      return { bottleId: bottle.id, eventId: event ? `${source.runId}:conqueror-consumption:${event.revision}` : `${source.runId}:conqueror-original:${bottle.id}`,
        sourceDigest, acquisitionEventDigest: redPriestDigest(event ?? bottle), week: event?.week ?? bottle.acquiredWeek ?? bottle.stockedWeek ?? source.budget.week,
        revision: event?.revision ?? source.revision, status: bottle.status, outcome: bottle.outcome,
        roll: event?.check?.roll ?? null, chance: event?.check?.chance ?? null, integratedActorId: integrated ? source.actorId : null };
    }),
    uniqueness: { id: RED_PRIEST_UNIQUENESS_ID, incumbentActorId: null, custody: clone([...RED_PRIEST_RELIC_CUSTODY]) } };
}
/** Exact capabilities are scoped to one independently produced frame. They are
 * never reconstructed from a saved receipt and are never accepted from a caller. */
function authority(context: VerifiedContext, frame: RedPriestMaterialFrame | null,
  consumption: RedPriestMaterialConsumptionReceipt | null = null, transport: RedPriestMaterialTransportReceipt | null = null): RedPriestMaterialAuthority {
  return { verifyOrigin: origin => sameRedPriest(origin, context.origin),
    verifyHost: candidate => frame !== null && sameRedPriest(candidate, frame),
    verifyEvidence: (e, f) => frame !== null && sameRedPriest(f, frame) && frame.evidence !== null && sameRedPriest(e, frame.evidence),
    verifyConsumption: (r, f) => consumption !== null && sameRedPriest(r, consumption) && sameRedPriest(f, frame),
    verifyTransport: (r, f) => transport !== null && sameRedPriest(r, transport) && sameRedPriest(f, frame) };
}
function start(source: RedPriestSource): Prepared {
  const root = createRedPriestState(), origin = frozen(materialOrigin(source)), context = { origin };
  root.guidanceKnown = true; root.source = frozen(clone(source));
  root.frame = { budget: clone(source.budget), random: { ...source.random }, finance: clone(source.finance), location: 'loen-headquarters', nowSecond: 0 };
  root.campaign = createRedPriestCampaign(source.runId, source.budget.week);
  root.materials = createRedPriestMaterials(origin, authority(context, null));
  return { root, context };
}
export function startRedPriest(s: SliceState): RedPriestState { return start(createRedPriestSource(s)).root; }
function actor(b: RedPriestBudget): RedPriestMaterialActor {
  return { status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', sequence: b.sequence, health: b.health, mind: b.mind,
    pollution: b.pollution, injuryIds: b.injuries.map(i => i.id) };
}
function materialFrame(root: RedPriestState, eventId: string, revision: number, evidence: RedPriestMaterialEvidence | null = null): RedPriestMaterialFrame {
  const b = root.frame!.budget;
  return { eventId, actorId: root.source!.actorId, originDigest: root.materials!.originDigest, locationId: root.frame!.location,
    week: b.week, revision, actor: actor(b), resources: { cash: b.cash, actions: b.actions, spirituality: b.spirituality }, evidence };
}
function host(root: RedPriestState, eventId: string): RedPriestCampaignHost {
  const b = root.frame!.budget;
  return { week: b.week, eventId, player: { alive: b.status === 'ACTIVE', pathwayId: 'hunter', sequence: b.sequence,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, actionsRemaining: b.actions,
    campaignLocation: root.campaign!.location } };
}
function pay(b: RedPriestBudget, cost: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
  need(b.actions >= (cost.actions ?? 0) && b.cash >= (cost.cash ?? 0) && b.spirituality >= (cost.spirituality ?? 0), '实际行动、费用或灵性不足。');
  b.actions -= cost.actions ?? 0; b.cash -= cost.cash ?? 0; b.spirituality -= cost.spirituality ?? 0;
  b.health = Math.max(0, b.health - (cost.health ?? 0)); b.mind = Math.max(0, b.mind - (cost.mind ?? 0));
  b.pollution = Math.min(100, b.pollution + (cost.pollution ?? 0));
  if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
function checks(frame: RedPriestFrame, eventId: string) {
  const receipts: RedPriestCheckReceipt[] = [];
  const check = (ability: PublicCoreStatKey, difficulty: number, modifier = 0, source = '实际在场条件') => {
    const before = frame.random.cursor, rng = new DeterministicActionRandomStream(frame.random.seed, before);
    const result = resolveNormalCheck({ ability, baseAbility: frame.budget.coreStats[ability], difficulty,
      modifiers: modifier ? [{ source, value: modifier }] : [], roll: rng.nextInt(1, 100) });
    frame.random.cursor = rng.cursor;
    receipts.push({ kind: 'CHECK', id: `${eventId}:check:${receipts.length + 1}`, check: result, cursorBefore: before, cursorAfter: rng.cursor }); return result;
  };
  return { receipts, check };
}
/** Ordinary bills and agreed debt payments continue during every real week of
 * travel and war. An unpaid bill is explicit principal, never erased or frozen. */
function weeks(root: RedPriestState, count: number, revision: number, eventId: string, notes: RedPriestEvent['financeReceipts']): void {
  const f = root.frame!, b = f.budget;
  for (let i = 0; i < count; i++) {
    let result = resolveSliceWeeklyFinance({ ...f.finance, week: b.week, revision, cash: b.cash, pulse: 'BILL', billAmount: 0 });
    notes.push(...result.receipts);
    if (result.eventId === 'LIFE-BILL-01') {
      const due = SLICE_LIFE[result.state.lifeTier].cost, paid = result.state.cash;
      result.state.cash = 0;
      result.state.debts.push({ id: `${eventId}:living-debt:${i}`, source: '生活应付款', remaining: due - paid, weeklyPayment: 30, createdWeek: b.week });
      result.state.nextLifeTier = 'DESTITUTE'; result.state.pulse = 'DEBTS';
      notes.push({ title: '本周生活应付款', text: `已付${paid}便士，未付${due - paid}便士如实计欠；下周采用赤贫生活。` });
      result = resolveSliceWeeklyFinance(result.state); notes.push(...result.receipts);
    }
    b.cash = result.state.cash;
    const { lifeTier, nextLifeTier, debts, missedWeeks, credit } = result.state;
    Object.assign(f.finance, { lifeTier: nextLifeTier, nextLifeTier, debts: clone(debts), missedWeeks, credit });
    void lifeTier;
    b.week++; b.date = addGameWeeks(b.date, 1); b.actions = f.finance.weeklyBudget; f.nowSecond += 604800;
  }
}
function syncCampaign(root: RedPriestState, eventId: string): void {
  if (root.campaign!.week === root.frame!.budget.week) return;
  const result = advanceRedPriestCampaignToWeek(root.campaign!, host(root, `${eventId}:elapsed-time`));
  need(result.ok, result.ok ? '' : result.block.message); root.campaign = result.state;
}
function roadWeeks(node: CampaignNodeId): number {
  let total = 0;
  for (const route of RED_PRIEST_CAMPAIGN_ROUTES) { total += route.weeks; if (route.to === node) return total; }
  throw Error('这处地点尚无真实运输路线。');
}
function materialTransport(root: RedPriestState, context: VerifiedContext, eventId: string, revision: number, from: string, departedWeek: number): RedPriestEvent['materialReceipt'] {
  if (!['ACTIVE', 'ASCENDED'].includes(root.materials!.status) || root.frame!.budget.status !== 'ACTIVE') return null;
  const frame = materialFrame(root, eventId, revision), r: RedPriestMaterialTransportReceipt = {
    id: `${eventId}:original-transport`, eventId, originDigest: frame.originDigest, actorId: frame.actorId, locationId: frame.locationId,
    week: frame.week, revision, sourceTravelReceiptId: `${eventId}:travel`, fromLocationId: from, toLocationId: frame.locationId,
    departedWeek, arrivedWeek: frame.week,
    carried: root.materials!.items.filter(i => i.holderId === frame.actorId && ['INTEGRATED_PLAYER', 'INTEGRATED_S0', 'PLAYER_HELD', 'IN_COMPOUND'].includes(i.disposition))
      .map(i => ({ itemId: i.id, containerId: i.containerId! })) };
  const result = transportRedPriestMaterials(root.materials!, { ...frame, authority: authority(context, frame, null, r) }, r);
  root.materials = result.state; return result.receipt;
}
function materialEvidence(root: RedPriestState, c: RedPriestMaterialCommand, frame: RedPriestMaterialFrame,
  random: ReturnType<typeof checks>, revision: number): RedPriestMaterialEvidence {
  const base = { id: `${frame.eventId}:material-evidence`, eventId: frame.eventId, originDigest: frame.originDigest, actorId: frame.actorId,
    locationId: frame.locationId, week: frame.week, revision };
  if (c.type === 'PREPARE_COMPOUND') {
    const supply = redPriestCompoundSupply(root.materials!.compounds.length + 1, root.materials!.origin.checkpoint.week);
    need(supply, '普通调配物料的原库存已经用尽。');
    return { ...base, kind: 'COMPOUND_SUPPLY', batchId: supply.batchId, providerId: supply.providerId,
      chargedCash: RED_PRIEST_MATERIAL_COSTS.PREPARE_COMPOUND.cash, inputs: clone(supply.inputs) };
  }
  const item = root.materials!.items.find(i => i.id === ('itemId' in c ? c.itemId : RED_PRIEST_UNIQUENESS_ID))!;
  const check = random.check(c.type === 'PURIFY_REMAINS' ? 'will' : 'knowledge', c.type === 'PURIFY_REMAINS' ? 40 : 32);
  const passed = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
  let container = item.containerId, location = item.locationId, keeper = item.holderId,
    before = item.contamination, after = item.contamination, recoverable = item.recoverable, custody: string | null = null;
  if (c.type === 'TRACE_DISPOSITION') {
    if (item.disposition === 'SUPPLIER_BOTTLED') { before = 0; after = 0; recoverable = true; custody = item.sourceEventId; }
    else {
      const lead = RED_PRIEST_SUPPLIER_LEADS.find(l => l.itemId === item.id); need(lead, '尚无这份原特性的处置线索。');
      container = lead.containerId; location = lead.locationId; keeper = lead.custodianId;
      after = 20; recoverable = true; custody = lead.leadId;
    }
  } else if (c.type === 'INSPECT_RELIC' || c.type === 'VERIFY_RELIC' || c.type === 'TRANSFER_RELIC') {
    const tail = root.materials!.origin.uniqueness.custody.at(-1)!;
    container = tail.containerId; location = tail.locationId; keeper = tail.toCustodianId;
    before = 0; after = 0; recoverable = false; custody = tail.id;
  } else if (c.type === 'PURIFY_REMAINS' && passed) after = 0;
  const afterActor = clone(frame.actor);
  if (c.type === 'PURIFY_REMAINS' && !passed) {
    const severe = check.tier === 'GREAT_FAILURE'; afterActor.health = Math.max(0, afterActor.health - (severe ? 24 : 8));
    afterActor.mind = Math.max(0, afterActor.mind - (severe ? 18 : 6)); afterActor.pollution = Math.min(100, afterActor.pollution + (severe ? 20 : 8));
    if (severe) afterActor.injuryIds.push(`${frame.eventId}:purification-injury`);
    if (afterActor.health === 0 || afterActor.mind === 0 || afterActor.pollution >= 100) { afterActor.status = 'DEAD'; afterActor.health = 0; }
    after = (before ?? 0) + 5;
  }
  const result: RedPriestMaterialCheckReceipt = { ...base, kind: 'MATERIAL_CHECK', action: c.type, itemId: item.id,
    sourceEventId: item.sourceEventId, checkReceiptId: random.receipts.at(-1)!.id, result: passed ? 'SUCCESS' : 'FAILURE',
    containerId: container, materialLocationId: location, custodianId: keeper, contaminationBefore: before, contaminationAfter: after,
    recoverable, custodyRecordId: custody, actorAfter: afterActor };
  return result;
}
function publishActor(b: RedPriestBudget, after: RedPriestMaterialActor, revision: number): void {
  b.health = after.health; b.mind = after.mind; b.pollution = after.pollution; b.status = after.status;
  for (const id of after.injuryIds) if (!b.injuries.some(i => i.id === id)) { b.injuries.push({ id, severity: 'HEAVY', acquiredRevision: revision, treatedRevision: null }); b.injuryRisk += 2; }
}
interface PromotionStabilityEvidence {
  campaignId: string; warStartedEventId: string; victoryReceiptIds: string[];
  witnesses: RedPriestPromotionWitness[]; originals: { itemId: string; sourceEventId: string }[];
}
/** Sources come from already authenticated central history, never from intent. */
function promotionStabilityEvidence(root: RedPriestState, compoundId: string): { reason: string | null; evidence: PromotionStabilityEvidence | null } {
  const blocked = (reason: string) => ({ reason, evidence: null });
  const { source, frame, campaign, materials } = root;
  if (!source || !frame || !campaign || !materials || !root.guidanceKnown) return blocked('须先核清本人、原件与本场战争。');
  const b = frame.budget, achievement = deriveRedPriestCampaignAchievement(campaign);
  if (b.status !== 'ACTIVE' || b.sequence !== 1 || b.acting !== 100 || root.promotionWeek !== null)
    return blocked('须由仍活着、已完整消化的征服者本人进行稳定准备。');
  if (!achievement.achieved || !achievement.ceased || !campaign.warStarted)
    return blocked('须先取得五处独立胜利、三战区控制并真正停战，不能用准备补写战果。');
  if (frame.location !== RED_PRIEST_MATERIAL_LOCATIONS.workshop)
    return blocked('本人和全部原件须沿真实道路回到封闭调配室。');
  const compound = materials.compounds.find(c => c.id === compoundId);
  if (materials.status !== 'ACTIVE' || !compound || compound.status !== 'PREPARED' || compound.locationId !== frame.location)
    return blocked('须先用同三份原特性与唯一性实际调成这一瓶原成药。');
  const compoundIds = [compound.integratedMaterialId, ...compound.externalMaterialIds, compound.uniquenessId];
  if (compoundIds.length !== RED_PRIEST_MATERIAL_IDS.length || new Set(compoundIds).size !== RED_PRIEST_MATERIAL_IDS.length
    || RED_PRIEST_MATERIAL_IDS.some(id => !compoundIds.includes(id)) || materials.items.length !== RED_PRIEST_MATERIAL_IDS.length
    || RED_PRIEST_MATERIAL_IDS.some(id => !materials.items.some(item => item.id === id && item.locationId === frame.location
      && item.holderId === source.actorId && (id === compound.integratedMaterialId
        ? item.disposition === 'INTEGRATED_PLAYER' : item.disposition === 'IN_COMPOUND' && item.containerId === compound.id))))
    return blocked('三份原特性和唯一性必须仍是这一瓶及本人携带的同批原件，不能补发或替换。');
  const witnesses: RedPriestPromotionWitness[] = [];
  for (const polityId of RED_PRIEST_CAMPAIGN_COALITION) {
    const polity = campaign.polities[polityId], cfg = RED_PRIEST_CAMPAIGN_LEGIONS.find(l => l.role === 'FIELD' && l.polityId === polityId)!;
    const legion = campaign.legions[cfg.id];
    const event = root.journal.find(e => e.id === polity.authorizationEventId && e.command.type === 'CAMPAIGN'
      && e.command.command.type === 'REQUEST_AUTHORITY' && e.command.command.polityId === polityId);
    const receipt = event?.campaignHost?.receipt;
    const originalAuthority = campaign.journal.find(e => e.host.eventId === polity.authorizationEventId
      && e.command.type === 'REQUEST_AUTHORITY' && e.command.polityId === polityId);
    if (polity.authority !== 'GRANTED' || !event || !receipt || receipt.kind !== 'AUTHORIZATION'
      || receipt.targetId !== polityId || receipt.eventId !== event.id || receipt.campaignId !== campaign.campaignId
      || !['SUCCESS', 'GREAT_SUCCESS'].includes(receipt.result) || !sameRedPriest(receipt, originalAuthority?.host.receipt)
      || !event.randomReceipts.some(r => r.check.tier === 'SUCCESS' || r.check.tier === 'GREAT_SUCCESS')
      || event.before.location !== 'loen-headquarters' || !legion || legion.id !== cfg.id || legion.polityId !== polityId
      || legion.personnel <= 0 || legion.retreated)
      return blocked('三方原驻都委托必须仍然有效，且各自原军团仍有实际存员；不能伪造支持者或旧授权。');
    witnesses.push({ polityId, authorizationEventId: event.id, authorizationReceiptId: receipt.id,
      legionId: legion.id, personnel: legion.personnel });
  }
  const victoryReceiptIds: string[] = [];
  for (const nodeId of achievement.independentVictories) {
    const victory = campaign.nodes[nodeId].victory!;
    const event = root.journal.find(e => e.id === victory.eventId && e.command.type === 'CAMPAIGN'
      && (e.command.command.type === 'BATTLE' || e.command.command.type === 'PREPARED_BATTLE') && e.command.command.nodeId === nodeId);
    const receipt = event?.campaignHost?.receipt;
    if (!receipt || receipt.id !== victory.receiptId || receipt.campaignId !== campaign.campaignId
      || receipt.kind !== 'BATTLE' || receipt.targetId !== nodeId || !['SUCCESS', 'GREAT_SUCCESS'].includes(receipt.result)
      || !event!.randomReceipts.some(r => r.check.tier === 'SUCCESS' || r.check.tier === 'GREAT_SUCCESS'))
      return blocked('战后核验必须逐一对应实际会战胜利，不能用新准备改写旧战果。');
    victoryReceiptIds.push(receipt.id);
  }
  return { reason: null, evidence: { campaignId: campaign.campaignId, warStartedEventId: campaign.warStarted.eventId,
    victoryReceiptIds, witnesses, originals: materials.items.map(item => ({ itemId: item.id, sourceEventId: item.sourceEventId })) } };
}
function preparationBindingMatches(root: RedPriestState, prepared: RedPriestPromotionPreparation, evidence: PromotionStabilityEvidence | null): boolean {
  if (!evidence) return false;
  const compound = root.materials!.compounds.find(c => c.id === prepared.compoundId);
  if (!compound || prepared.status !== 'READY' || prepared.invalidatedEventId !== null || prepared.spentEventId !== null || prepared.actorId !== root.source!.actorId
    || prepared.originDigest !== root.materials!.originDigest || prepared.supplyReceiptId !== compound.supplyReceiptId
    || prepared.locationId !== root.frame!.location || prepared.completedWeek > root.frame!.budget.week
    || prepared.completedWeek - prepared.startedWeek !== RED_PRIEST_PROMOTION_STABILITY.weeks
    || !sameRedPriest({ campaignId: prepared.campaignId, warStartedEventId: prepared.warStartedEventId,
      victoryReceiptIds: prepared.victoryReceiptIds, witnesses: prepared.witnesses, originals: prepared.originals }, evidence)) return false;
  return true;
}
function activePromotionPreparation(root: RedPriestState, compoundId: string, evidence: PromotionStabilityEvidence | null): RedPriestPromotionPreparation | null {
  if (root.promotionStability?.version !== 1) return null;
  const prepared = root.promotionStability.preparations.find(p => p.status === 'READY' && p.compoundId === compoundId);
  if (!prepared || !preparationBindingMatches(root, prepared, evidence) || !root.journal.some(e => e.id === prepared.eventId && e.command.type === 'STABILIZE_PROMOTION'
      && e.command.compoundId === compoundId && e.before.budget.week === prepared.startedWeek
      && e.after.budget.week === prepared.completedWeek)) return null;
  return prepared;
}
/** Once actual conditions change, returning later never silently revives them. */
function invalidatePromotionPreparation(root: RedPriestState, eventId: string): void {
  for (const preparation of root.promotionStability?.preparations ?? []) {
    if (preparation.status !== 'READY') continue;
    const evidence = promotionStabilityEvidence(root, preparation.compoundId).evidence;
    if (!preparationBindingMatches(root, preparation, evidence)) {
      preparation.status = 'INVALIDATED'; preparation.invalidatedEventId = eventId;
    }
  }
}
/** Pure public readiness: exposes actual conditions and odds, never private
 * check receipts, a future draw, the random stream or authorization source IDs. */
export function getRedPriestPromotionStabilityPreview(root: RedPriestState, compoundId: string) {
  const rules = RED_PRIEST_PROMOTION_STABILITY, b = root.frame?.budget;
  const { reason: evidenceReason, evidence } = promotionStabilityEvidence(root, compoundId);
  const preparation = activePromotionPreparation(root, compoundId, evidence), prepared = preparation !== null;
  const already = root.promotionStability?.preparations.find(p => p.compoundId === compoundId);
  let reason = evidenceReason;
  if (!reason && root.promotionStability?.preparations.some(p => p.status === 'READY' && root.materials!.compounds.some(c => c.id === p.compoundId && c.status === 'PREPARED'))) reason = '本瓶已有一次稳定准备；不能重复付费叠加或转给另一瓶。';
  if (!reason && already) reason = already.status === 'INVALIDATED' ? '这瓶原成药的准备条件已经改变，旧准备已失效，不能返回后自动重用。' : '这瓶原成药的准备已经实际使用，不能重新充填旧准备。';
  if (!reason && (b!.health < RED_PRIEST_CONSUMPTION.healthMinimum || b!.mind < RED_PRIEST_CONSUMPTION.mindMinimum || b!.injuries.length))
    reason = '先真正恢复到80健康、70精神并解除原伤势，再进行稳定准备。';
  if (!reason && (b!.actions < rules.actions || b!.cash < rules.cash || b!.spirituality < rules.spirituality))
    reason = '稳定准备需要2行动、120便士、12灵性与8精神，并实际经过一周。';
  const chance = (bonus: number) => computeCheckChance({ ability: 'will', baseAbility: b?.coreStats.will ?? 0,
    difficulty: RED_PRIEST_CONSUMPTION.difficulty, modifiers: bonus ? [{ source: '战后三方原委托稳定准备', value: bonus }] : [] });
  const effectiveBonus = prepared ? rules.effectiveBonus : 0;
  return { eligible: reason === null, reason, prepared, status: (prepared ? 'READY' : already?.status === 'SPENT' ? 'SPENT' : 'UNPREPARED') as 'READY' | 'SPENT' | 'UNPREPARED',
    effectiveBonus, unpreparedChance: chance(0), currentChance: chance(effectiveBonus), stabilizedChance: chance(rules.effectiveBonus),
    witnesses: (evidence?.witnesses ?? []).map(w => ({ polityId: w.polityId,
      name: RED_PRIEST_CAMPAIGN_POLITIES.find(p => p.id === w.polityId)!.name, legionId: w.legionId,
      legionName: RED_PRIEST_CAMPAIGN_LEGIONS.find(l => l.id === w.legionId)!.name, personnel: w.personnel })),
    victoryCount: evidence?.victoryReceiptIds.length ?? 0,
    cost: { actions: rules.actions, cash: rules.cash, spirituality: rules.spirituality, mind: rules.mind, weeks: rules.weeks } };
}
/** The exact same preview feeds execution. Legacy scenes have no rank bonus. */
export function getRedPriestEpilogueCheckPreview(root: RedPriestState, kind: import('./epilogue.js').RedPriestEpilogueCommand['type']) {
  const epilogue = root.epilogue, b = root.frame?.budget;
  if (!epilogue || !b || kind === 'WITHDRAW' || kind === 'REPORT') return null;
  const ability: PublicCoreStatKey = kind === 'EVACUATE' ? 'physique' : 'will';
  const difficulty = kind === 'CONTAIN_FIRE' ? 48 : kind === 'COORDINATE' ? 42 : epilogue.fire >= 50 ? 48 : 36;
  const effectiveBonus = kind === 'EVACUATE' ? epilogue.coordinated ? 5 : 0
    : epilogue.rulesVersion === 2 && b.status === 'ACTIVE' && b.sequence === 0 && root.promotionWeek !== null ? RED_PRIEST_EPILOGUE_CAPABILITY_BONUS : 0;
  return { ability, difficulty, effectiveBonus, chance: computeCheckChance({ ability, baseAbility: b.coreStats[ability], difficulty,
    modifiers: effectiveBonus ? [{ source: kind === 'EVACUATE' ? '实际在场条件' : '红祭司本体有限施术', value: effectiveBonus }] : [] }) };
}

function reduce(prepared: Prepared, command: RedPriestCommand, revision: number): RedPriestEvent {
  const { root, context } = prepared, f = root.frame!, b = f.budget;
  need(validateRedPriestCommand(command) && command.type !== 'LEARN_GUIDANCE', '这项行动的内容无效。');
  need(root.guidanceKnown && root.source && b.status === 'ACTIVE', '已经死亡或结束的角色不能继续行动。');
  need(root.journal.length < 4096 && revision === root.source.revision + 2 + root.journal.length, '本次实际动作次序无效。');
  need(root.epilogue?.status !== 'ACTIVE' || command.type === 'EPILOGUE', '先沿当前运输路完成救援或普通撤出。');
  const eventId = `R209:${root.source.runId}:${revision}`, before = clone(f), beforeDigest = dataDigest(root), random = checks(f, eventId);
  let campaignHost: RedPriestCampaignHost | null = null, materialReceipt: RedPriestEvent['materialReceipt'] = null;
  const financeReceipts: RedPriestEvent['financeReceipts'] = [], notes: string[] = [];
  if (command.type === 'WORK') {
    need(city(f.location), '须先沿普通路线回到贝克兰德，再做原来的本职工作。');
    need(f.finance.wagePaidWeek !== b.week, '本周职业工资已经结算，不能重复入账。');
    pay(b, { actions: 1 }); b.cash += root.source.character.weeklyWage; f.finance.wagePaidWeek = b.week; f.nowSecond += 28800;
    notes.push(`本周原职业工资${root.source.character.weeklyWage}便士已入账。`);
  } else if (command.type === 'REST') {
    pay(b, { actions: 1 }); const life = SLICE_LIFE[f.finance.lifeTier];
    b.health = Math.min(100, b.health + life.health); b.mind = Math.min(100, b.mind + life.mind);
    b.spirituality = Math.min(120, b.spirituality + Math.round(120 * life.spirituality)); b.pollution = Math.max(0, b.pollution - 10);
    b.injuries = b.injuries.filter(i => !(b.health >= 80 && i.acquiredRevision < revision &&
      (i.severity === 'LIGHT' || i.treatedRevision !== null && i.treatedRevision < revision)));
    if (!b.injuries.length) b.injuryRisk = 0;
    f.nowSecond += 28800; notes.push('按当前生活档休养；未经处置的重伤仍然保留。');
  } else if (command.type === 'CLINIC') {
    need(city(f.location) || f.location === root.campaign!.location && f.location !== 'loen-headquarters' && root.campaign!.nodes[f.location as CampaignNodeId].consolidated,
      '须到城市诊所或实际巩固驻地的原救护站。');
    need(b.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null), '当前没有尚未处置的重伤。');
    pay(b, { actions: 1, cash: 60 });
    for (const injury of b.injuries) if (injury.severity === 'HEAVY' && injury.treatedRevision === null) injury.treatedRevision = revision;
    f.nowSecond += 3600; notes.push('60便士普通处置已完成；仍须之后休养并达到80健康，才能解除重伤。');
  } else if (command.type === 'NEXT_WEEK') {
    // Waiting deliberately abandons remaining opportunities. It never pays a
    // wage, replenishes health, removes wounds or suppresses agreed repayments.
    b.actions = 0; weeks(root, 1, revision, eventId, financeReceipts);
  } else if (command.type === 'TRAVEL') {
    need(command.to !== f.location, '本人已经在这处原地点。');
    const from = f.location, departed = b.week;
    let travel = 0;
    if (city(from) && city(command.to)) {
      need(root.campaign!.phase === 'CRISIS' || root.campaign!.phase === 'ARMISTICE' || root.campaign!.phase === 'WITHDRAWN', '原军团正在执行发动命令，先沿真实战役路线收束。');
      pay(b, { actions: 1, cash: 10 }); f.nowSecond += 3600;
    } else {
      need(root.campaign!.phase === 'ARMISTICE' || root.campaign!.phase === 'WITHDRAWN', '战争尚未结束，不能离开军团跳过大陆行军。');
      const node = city(from) ? command.to : from;
      need(RED_PRIEST_CAMPAIGN_NODES.some(n => n.id === node) && (city(from) ? city(from) && command.to === root.campaign!.location : command.to === 'loen-headquarters'), '须沿已行经运输路往返总部与原军团驻地。');
      travel = roadWeeks(node as CampaignNodeId); pay(b, { actions: 1, cash: travel * 10 });
      weeks(root, travel, revision, eventId, financeReceipts);
    }
    f.location = command.to;
    materialReceipt = materialTransport(root, context, eventId, revision, from, departed);
    notes.push(travel ? `已沿原大陆运输路行经${travel}周，个人生活及旧还款已逐周结算。` : '本人及随身原件沿普通城市道路实际到场。');
  } else if (command.type === 'RETURN_ON_FOOT') {
    need(root.campaign!.phase === 'ARMISTICE' || root.campaign!.phase === 'WITHDRAWN', '须先实际结束战争，才能独自沿原路返回。');
    need(RED_PRIEST_CAMPAIGN_NODES.some(n => n.id === f.location), '本人须实际在原大陆运输路节点，不能远程返回。');
    const from = f.location, departed = b.week, travel = roadWeeks(from as CampaignNodeId) * 2;
    pay(b, { actions: 1 }); weeks(root, travel, revision, eventId, financeReceipts);
    f.location = 'loen-headquarters';
    materialReceipt = materialTransport(root, context, eventId, revision, from, departed);
    notes.push(`本人携同一批随身原件沿原路步行${travel}周返回总部，没有领取工资或返还旧费用；生活与还款已实际结算，原军团仍留在停战驻地。`);
  } else if (command.type === 'CAMPAIGN') {
    need(f.location === root.campaign!.location, '本人须先沿真实路线抵达原军团所在地点。');
    if (command.command.type === 'BATTLE' || command.command.type === 'PREPARED_BATTLE' || command.command.type === 'DECLARE_OFFENSIVE')
      need(b.health >= 60 && b.mind >= 50 && !b.injuries.some(i => i.severity === 'HEAVY'), '须先处理重伤并休养，不能带着未愈重伤发动或指挥会战。');
    campaignHost = host(root, eventId);
    const reason = getRedPriestCampaignBlock(root.campaign!, command.command, campaignHost); need(reason === null, reason?.message ?? '当前无法进行这项战役行动。');
    const challenge = getRedPriestCampaignChallenge(root.campaign!, command.command);
    if (challenge) {
      const check = random.check(challenge.kind === 'BATTLE' ? 'will' : 'knowledge', challenge.difficulty, challenge.effectiveBonus ?? 0);
      campaignHost = { ...campaignHost, receipt: { id: `${eventId}:campaign-check`, campaignId: root.campaign!.campaignId, eventId,
        revision: root.campaign!.revision, week: b.week, kind: challenge.kind, targetId: challenge.targetId,
        result: check.tier === 'GREAT_FAILURE' ? 'SEVERE_FAILURE' : check.tier,
        source: challenge.kind === 'BATTLE' ? 'BATTLE_RESOLUTION' : 'NORMAL_CHECK' } };
    }
    const next = reduceRedPriestCampaign(root.campaign!, command.command, campaignHost); need(next.ok, next.ok ? '' : next.block.message);
    const from = f.location, departed = b.week; root.campaign = next.state;
    pay(b, next.settlement); b.cash += next.settlement.cashGain;
    weeks(root, next.settlement.weeks, revision, eventId, financeReceipts); f.location = next.settlement.toLocation;
    if (from !== f.location) materialReceipt = materialTransport(root, context, eventId, revision, from, departed);
    notes.push(...next.events.map(e => e.message));
  } else if (command.type === 'MATERIAL') {
    need(b.sequence === 1 && root.materials!.status === 'ACTIVE', '这批原件只能用于本人尚未结束的晋升筹备。');
    const frame = materialFrame(root, eventId, revision), preliminary: RedPriestMaterialHost = { ...frame, authority: authority(context, frame) };
    const reason = redPriestMaterialBlock(root.materials!, command.command, preliminary); need(reason === null, reason ?? '这批原件尚不具备条件。');
    frame.evidence = materialEvidence(root, command.command, frame, random, revision);
    const result = reduceRedPriestMaterials(root.materials!, command.command, { ...frame, authority: authority(context, frame) });
    root.materials = result.state; pay(b, result.cost); publishActor(b, result.actorAfter, revision); materialReceipt = result.receipt; f.nowSecond += 3600;
  } else if (command.type === 'STABILIZE_PROMOTION') {
    const preview = getRedPriestPromotionStabilityPreview(root, command.compoundId);
    need(preview.eligible, preview.reason ?? '当前不能进行这瓶原成药的稳定准备。');
    const evidence = promotionStabilityEvidence(root, command.compoundId).evidence!;
    const compound = root.materials!.compounds.find(c => c.id === command.compoundId)!, startedWeek = b.week;
    pay(b, RED_PRIEST_PROMOTION_STABILITY);
    weeks(root, RED_PRIEST_PROMOTION_STABILITY.weeks, revision, eventId, financeReceipts);
    const preparation: RedPriestPromotionPreparation = { id: `${eventId}:promotion-stability`, eventId,
      compoundId: compound.id, actorId: root.source!.actorId, originDigest: root.materials!.originDigest,
      supplyReceiptId: compound.supplyReceiptId, locationId: f.location, startedWeek, completedWeek: b.week,
      ...evidence, status: 'READY', spentEventId: null, invalidatedEventId: null };
    root.promotionStability ??= { version: 1, preparations: [] };
    root.promotionStability.preparations.push(preparation);
    notes.push('三方原驻都委托方在一周内核对各自未撤回的真实授权、同三支原军团与实际五处战果，完成本瓶原成药的战后稳定准备。没有新建信徒、人员或特性；120便士、2行动、12灵性与8精神已经实付，生活费与旧约还款照常结算。此准备只为本瓶下一次实际服药提供有限加值35，服药无论成败即用尽，仍可能重伤、失控或死亡。');
  } else if (command.type === 'CONSUME') {
    const rules = RED_PRIEST_CONSUMPTION, achievement = deriveRedPriestCampaignAchievement(root.campaign!);
    need(b.sequence === 1 && root.promotionWeek === null && b.acting === 100, '须由已经完整消化的征服者本人服药。');
    need(achievement.achieved && achievement.ceased, '须先完成实际北大陆战争、五处独立胜利与三战区控制，并真实结束战争。');
    need(f.location === RED_PRIEST_MATERIAL_LOCATIONS.workshop, '本人及原成药须沿真实路线回到封闭调配室。');
    need(b.health >= rules.healthMinimum && b.mind >= rules.mindMinimum && !b.injuries.length, '先真正恢复到80健康、70精神并解除原伤势，再承担服药风险。');
    need(b.actions >= 1 && b.spirituality >= rules.spirituality, '服药需要1行动与30灵性。');
    const compound = root.materials!.compounds.find(c => c.id === command.compoundId);
    need(compound?.status === 'PREPARED' && compound.locationId === f.location, '须由本人带着这瓶真实原成药到场。');
    const preparation = activePromotionPreparation(root, compound.id, promotionStabilityEvidence(root, compound.id).evidence);
    const frame = materialFrame(root, eventId, revision), beforeActor = actor(b),
      check = random.check('will', rules.difficulty, preparation ? RED_PRIEST_PROMOTION_STABILITY.effectiveBonus : 0, '战后三方原委托稳定准备');
    const passed = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS', severe = check.tier === 'GREAT_FAILURE';
    pay(b, { actions: 1, spirituality: rules.spirituality });
    if (passed) {
      b.sequence = 0; b.acting = 0; root.promotionWeek = b.week;
      for (const id of RED_PRIEST_ABILITY_IDS) b.mastery[id] = 0;
      b.completedSources.push('RED_PRIEST_ORIGINAL_SUCCESSION');
    } else {
      pay(b, { health: severe ? rules.greatFailureHealth : rules.failureHealth, mind: severe ? rules.greatFailureMind : rules.failureMind,
        pollution: severe ? rules.greatFailurePollution : rules.failurePollution });
      b.injuries.push({ id: `${eventId}:potion-injury`, severity: 'HEAVY', acquiredRevision: revision, treatedRevision: null }); b.injuryRisk += 2;
    }
    const r: RedPriestMaterialConsumptionReceipt = { id: `${eventId}:consumption`, eventId, originDigest: frame.originDigest,
      actorId: frame.actorId, locationId: frame.locationId, week: frame.week, revision, compoundId: compound.id, itemIds: [...RED_PRIEST_MATERIAL_IDS],
      outcome: passed ? 'SUCCESS' : 'FAILURE', formulaReceiptId: compound.supplyReceiptId,
      warAchievementReceiptId: `${root.campaign!.campaignId}:achieved:${root.campaign!.warStarted!.eventId}`,
      checkReceiptId: random.receipts.at(-1)!.id, actorBefore: beforeActor, actorAfter: actor(b),
      destinations: root.materials!.items.map(item => {
        if (passed) return { itemId: item.id, disposition: 'INTEGRATED_S0' as const, locationId: f.location,
          containerId: `body:${frame.actorId}`, holderId: frame.actorId, contamination: 0, recoverable: false };
        if (item.id === compound.integratedMaterialId && b.status === 'ACTIVE') return { itemId: item.id, disposition: 'INTEGRATED_PLAYER' as const,
          locationId: f.location, containerId: `body:${frame.actorId}`, holderId: frame.actorId, contamination: b.pollution, recoverable: false };
        // Only a survivable, contained rejection can leave identifiable original
        // residue in the retained original boxes at this actual sealed workshop.
        const originalBox = compound.sourceContainers.find(c => c.itemId === item.id)?.containerId;
        if (!severe && b.status === 'ACTIVE' && check.roll <= 80 && originalBox) return { itemId: item.id, disposition: 'LOCATED_DIRTY' as const,
          locationId: f.location, containerId: originalBox, holderId: 'backlund:sealed-workshop-keeper', contamination: 35, recoverable: true };
        return { itemId: item.id, disposition: 'UNAVAILABLE' as const, locationId: null, containerId: null, holderId: null, contamination: null, recoverable: false };
      }) };
    const result = applyRedPriestMaterialConsumption(root.materials!, { ...frame, authority: authority(context, frame, r) }, r);
    root.materials = result.state; materialReceipt = result.receipt; f.nowSecond += 3600;
    // The actual dose spends its preparation even if a changed condition
    // removed the bonus. An old READY can never lock a later real compound.
    for (const old of root.promotionStability?.preparations ?? []) if (old.compoundId === compound.id && old.spentEventId === null) {
      old.status = 'SPENT'; old.spentEventId = eventId;
    }
    notes.push(passed ? '三份原特性与唯一性在同一本人体内完成融合；旧原件已全部登记为消耗。' : '实际服药失败；伤害、污染与每份原件的去向已逐一保留，没有免费复起。');
  } else if (command.type === 'START_EPILOGUE' || command.type === 'START_PREPARED_EPILOGUE') {
    need(b.sequence === 0 && root.promotionWeek !== null && root.epilogue === null, '须由已经实际成神的本人参与这宗尚未开始的战后救援。');
    need(f.location === root.campaign!.location && f.location !== 'loen-headquarters', '须沿原大陆运输路亲自回到停战后的原军团驻地。');
    need(b.actions >= 1, '开始现场救援需要一次行动。');
    const dispatchId = `${eventId}:detachment`, result = dispatchRedPriestCampaignDetachment(root.campaign!, host(root, dispatchId), { legionId: 'loen-expedition', personnel: 6 });
    need(result.ok, result.ok ? '' : result.block.message); root.campaign = result.state; pay(b, { actions: 1 });
    root.epilogue = createRedPriestEpilogue({ eventId, week: b.week, revision, legionId: 'loen-expedition', location: f.location as CampaignNodeId, detachmentId: dispatchId });
    if (command.type === 'START_PREPARED_EPILOGUE') root.epilogue.rulesVersion = 2;
    f.nowSecond += 600; notes.push('原军团实派六人处理运输侧线火势，三名既有伤员仍待转运；没有征召旧互助成员。');
  } else if (command.type === 'EPILOGUE') {
    need(root.epilogue && f.location === root.epilogue.originLocation, '本人须实际在这宗原运输路救援现场。');
    const reason = redPriestEpilogueBlock(root.epilogue, command.command, b); need(reason === null, reason ?? '现场条件不足。');
    const kind = command.command.type, preview = getRedPriestEpilogueCheckPreview(root, kind),
      check = preview ? random.check(preview.ability, preview.difficulty, preview.effectiveBonus,
        kind !== 'EVACUATE' && preview.effectiveBonus ? '红祭司本体有限施术' : '实际在场条件') : null;
    root.epilogue = applyRedPriestEpilogue(root.epilogue, command.command, b, { eventId, revision, check }); f.nowSecond += 300;
    if (root.epilogue.status !== 'ACTIVE' && root.epilogue.settlementEventId === null) {
      const settleId = `${eventId}:detachment-return`, result = settleRedPriestCampaignDetachment(root.campaign!, host(root, settleId),
        { detachmentId: root.epilogue.detachmentId, killed: root.epilogue.killed, wounded: root.epilogue.wounded });
      need(result.ok, result.ok ? '' : result.block.message); root.campaign = result.state;
      root.epilogue.returned = root.epilogue.personnel - root.epilogue.killed - root.epilogue.wounded; root.epilogue.settlementEventId = settleId;
    }
    notes.push(root.epilogue.journal.at(-1)!.summary);
  } else throw Error('这项行动尚未接线。');
  syncCampaign(root, eventId);
  invalidatePromotionPreparation(root, eventId);
  const event: RedPriestEvent = { id: eventId, revision, command: clone(command), before, after: clone(f), randomReceipts: clone(random.receipts),
    campaignHost: clone(campaignHost), materialReceipt: clone(materialReceipt), financeReceipts, notes, beforeDigest, afterDigest: dataDigest(root) };
  root.journal.push(event); return event;
}
/** Full raw-entry replay independently authenticates the predecessor, constructs
 * all hosts from real state, reruns every central draw and compares all receipts.
 * Neither supplied module digests nor a public prepared object are authority. */
function reconstruct(s: SliceState): Prepared {
  const saved = s.redPriest;
  need(saved?.source && validateRedPriestSource(s, saved.source), '原身份、原军团与三份特性历史未通过核验。');
  need(Array.isArray(saved.journal) && saved.journal.length <= 4096, '本章行动记录长度无效。');
  const prepared = start(clone(saved.source));
  for (const event of saved.journal) {
    need(event && event.revision === saved.source.revision + 2 + prepared.root.journal.length, '本章实际修订次序不一致。');
    const actual = reduce(prepared, clone(event.command), event.revision);
    need(sameRedPriest(actual, event), '实际行动、检定、费用或来源回执与原记录不一致。');
  }
  need(sameRedPriest(prepared.root, saved), '当前战争、材料或身体状态不能由原行动重建。');
  return prepared;
}
function fork(value: Prepared): Prepared { return { root: clone(value.root), context: value.context }; }
export function validateRedPriestRoot(s: SliceState): void { reconstruct(s); }
export function transitionRedPriest(s: SliceState, command: RedPriestCommand): RedPriestState {
  const prepared = reconstruct(s); reduce(prepared, clone(command), s.revision + 1); return prepared.root;
}
export function openRedPriestOwnedEngine(s: SliceState): RedPriestOwnedEngine { return retain(reconstruct(clone(s))); }
export function snapshotRedPriestOwnedEngine(handle: RedPriestOwnedEngine): RedPriestState { return clone(getOwned(handle).root); }
export function advanceRedPriestOwnedEngine(handle: RedPriestOwnedEngine, command: RedPriestCommand, revision: number): RedPriestOwnedEngine {
  const prepared = fork(getOwned(handle)); reduce(prepared, clone(command), revision); return retain(prepared);
}
export function blockRedPriestOwnedEngine(handle: RedPriestOwnedEngine, command: RedPriestCommand, revision: number): string | null {
  try { reduce(fork(getOwned(handle)), clone(command), revision); return null; } catch (error) { return error instanceof Error ? error.message : '当前不能执行这项行动。'; }
}
