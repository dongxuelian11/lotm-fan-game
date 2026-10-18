/** R217 isolated engine candidate. Direct scene imports below are intentional
 * integration blockers, not empty implementations. No product wiring or run. */
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameDays } from '../game-calendar.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../resolution/normal-check.js';
import { createDeathSource, validateDeathSource, deathBudget, deathHistoryDigest,
  deathAcquisitionSnapshot } from './source.js';
import { DEATH_HOME, DEATH_CITY_PLACES, DEATH_CURRENT_ERA, DEATH_GUIDANCE,
  DEATH_CONSUMPTION, DEATH_PROMOTION_STABILITY, DEATH_SPIRITUALITY_CAP } from './content.js';
import { DEATH_RUNTIME_MATERIAL_POLICY, DEATH_WORKSHOP_CUSTODIAN, createDeathMaterialScene,
  deathMaterialPermissionReply, deathSuccessionAt, deathSuccessionRecordIds, type DeathMaterialScene as DeathAuthoredMaterialScene } from './material-content.js';
import { createDeathMaterials, applyDeathMaterial, deathMaterialBlock, validateDeathMaterialCommand,
  transportDeathMaterials, settleDeathConsumption, deathMaterialConservationBlock, deathMaterialEffect,
  prepareDeathPromotion, currentDeathPreparation, deathConsumeBlock,
  invalidateDeathPreparations, spendDeathPreparation,
  type DeathMaterialsRuntimeState, type DeathMaterialRuntimeHost, type DeathPreparationHost } from './materials.js';
import { DEATH_ABILITY_IDS, type DeathState, type DeathSource, type DeathBudget, type DeathFrame,
  type DeathCommand, type DeathEvent, type DeathCheckReceipt, type DeathServiceCommand,
  type DeathServicesState, type DeathServiceReceipt, type DeathEpilogueCommand,
  type DeathEpilogueState, type DeathAbilityId, type DeathMovementReceipt } from './types.js';
import type { DeathHost, DeathEffect, DeathModuleResult } from './ports.js';
// Required finite implementations, deliberately not supplied by this write set.
import * as servicesModule from './services.js';
import * as epilogueModule from './epilogue.js';

export const sameDeath = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const deathDigest = (value: unknown): string => sha256Hex(stableStringify(value));
const clone = <T>(value: T): T => structuredClone(value);
function need(value: unknown, reason: string): asserts value { if (!value) throw Error(reason); }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && (value as number) >= minimum;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 300;
const exact = (value: object, keys: readonly string[]) => sameDeath(Object.keys(value).sort(), [...keys].sort());
const city = (id: string) => DEATH_CITY_PLACES.some(place => place.id === id);
const WEEK_SECONDS = 604800;
/** Parent's final candidate freeze, not copied Sun wages/travel AP. */
const TIME = Object.freeze({ guidance: 1800, work: 21600, rest: 21600, clinic: 3600,
  travel: 1800, returnOnFoot: 1800, cityRouteMetres: 1800, consumption: 3600 });

export interface DeathSceneResult<T> extends DeathModuleResult<T> {
  injuries: SliceState['injuries']; movements: DeathMovementReceipt[];
}
/** These exact exports must be implemented against the two finite authored
 * scenes. No callback/plugin supplied by a renderer is accepted by the engine. */
export interface RequiredDeathServices {
  createDeathServices(runId: string, actorId: string, week: number, second: number): DeathServicesState;
  validateDeathServiceCommand(value: unknown): value is DeathServiceCommand;
  deathServicesBlock(state: DeathServicesState, command: DeathServiceCommand, host: DeathHost): string | null;
  applyDeathServices(state: DeathServicesState, command: DeathServiceCommand, host: DeathHost): DeathSceneResult<DeathServicesState>;
  deathServiceVerifiedReceipts(state: DeathServicesState): DeathServiceReceipt[];
  canLeaveDeathServices(state: DeathServicesState, location: string): boolean;
  leaveDeathServices(state: DeathServicesState, from: string, to: string, eventId: string): DeathServicesState;
  deathServiceConditionVersions(state: DeathServicesState): Record<string, number>;
}
export interface DeathCheckInput {
  ability: PublicCoreStatKey; difficulty: number; modifier: number; source: string;
}
export interface RequiredDeathEpilogue {
  validateDeathEpilogueCommand(value: unknown): value is DeathEpilogueCommand;
  startDeathEpilogue(services: DeathServicesState, host: DeathHost): DeathSceneResult<DeathEpilogueState>;
  deathEpilogueBlock(state: DeathEpilogueState, command: DeathEpilogueCommand, host: DeathHost): string | null;
  deathEpilogueCheckInput(state: DeathEpilogueState, command: DeathEpilogueCommand, host: DeathHost): DeathCheckInput | null;
  applyDeathEpilogue(state: DeathEpilogueState, command: DeathEpilogueCommand, host: DeathHost):
    DeathSceneResult<DeathEpilogueState> & { masteryGains: Partial<Record<DeathAbilityId, number>> };
}
const SERVICES: RequiredDeathServices = servicesModule;
const EPILOGUE: RequiredDeathEpilogue = epilogueModule;
export type DeathMaterialScene = DeathAuthoredMaterialScene;
export type DeathRuntimeFrame = DeathFrame;
export type DeathRuntimeState = DeathState;
/** Candidate overlay only. Parent must add the root to the central schema,
 * migration, payload union and both owned lists before any product use. */
export type DeathSliceState = SliceState & { death: DeathRuntimeState };

export function createDeathState(): DeathRuntimeState {
  return { version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    services: null, materials: null, materialScene: null, epilogue: null, journal: [],
    promotionStability: { preparations: [] } };
}
export function validateDeathCommand(value: unknown): value is DeathCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'WORK', 'REST', 'CLINIC', 'NEXT_WEEK', 'START_EPILOGUE', 'RETURN_ON_FOOT'].includes(String(value.type))) return exact(value, ['type']);
  if (value.type === 'TRAVEL') return exact(value, ['type', 'to']) && text(value.to) && city(value.to);
  if (value.type === 'STABILIZE_PROMOTION') return exact(value, ['type', 'compoundId']) && text(value.compoundId);
  if (value.type === 'CONSUME') return exact(value, ['type', 'compoundId', 'confirmed']) && text(value.compoundId) && value.confirmed === true;
  if (!exact(value, ['type', 'command'])) return false;
  if (value.type === 'MATERIAL') return validateDeathMaterialCommand(value.command);
  if (value.type === 'SERVICE') return SERVICES.validateDeathServiceCommand(value.command);
  return value.type === 'EPILOGUE' && EPILOGUE.validateDeathEpilogueCommand(value.command);
}
function dataDigest(root: DeathRuntimeState): string {
  const { journal: _journal, ...data } = root;
  return deathDigest(data);
}
function frame(root: DeathRuntimeState): DeathRuntimeFrame {
  need(root.guidanceKnown && root.source && root.frame && root.materials && root.materialScene && root.services, '本章的真实来源、现物或当前身体不完整。');
  return root.frame;
}
function nextRevision(root: DeathRuntimeState): number { return root.source!.revision + 2 + root.journal.length; }
function eventId(root: DeathRuntimeState, revision: number): string { return `R217:${root.source!.runId}:${revision}`; }
function cap(budget: DeathBudget): number { return budget.sequence === 0 ? DEATH_SPIRITUALITY_CAP : 120; }
function budgetInvariant(root: DeathRuntimeState): void {
  const f = frame(root), b = f.budget;
  need([b.week, b.actions, b.cash, b.health, b.mind, b.spirituality, b.pollution, b.injuryRisk,
    f.nowSecond, f.weekAnchor, f.economy.livingArrears, f.economy.works, f.economy.rests, f.economy.treatments,
    f.economy.weeksAdvanced, f.economy.income, f.economy.expenses, f.economy.emergencyWorks, f.economy.travelledMetres, f.economy.elapsedSeconds,
    ...Object.values(b.mastery), ...Object.values(b.coreStats)].every(value => integer(value)), '当前身体、动作或时钟不能是负数、非整数或无穷。');
  need(b.week >= root.source!.budget.week && b.actions <= 4 && b.health <= 100 && b.mind <= 100 && b.spirituality <= cap(b) && b.pollution <= 100,
    '当前身体超出真实资源上限。');
  need((b.status === 'ACTIVE' && b.health > 0 && b.mind > 0 && b.pollution < 100) || (b.status === 'DEAD' && b.health === 0), '普通死亡不能被旧周期或来源视图替换。');
  need((b.sequence === 0) === (root.promotionWeek !== null) && [1, 0].includes(b.sequence), '晋升状态与实际成药结局不一致。');
  need(f.nowSecond >= f.weekAnchor && f.nowSecond < f.weekAnchor + WEEK_SECONDS && f.weekAnchor % WEEK_SECONDS === 0,
    '本章真实周界尚未完成同一结算。');
  need(sameDeath(b.date, addGameDays(root.source!.budget.date, (b.week - root.source!.budget.week) * 7)), '日期必须从同一来源按真实七天推进。');
  need(b.week - root.source!.budget.week === f.weekAnchor / WEEK_SECONDS &&
    f.economy.weeksAdvanced === root.source!.era.weeksAdvanced + f.weekAnchor / WEEK_SECONDS &&
    f.economy.elapsedSeconds === root.source!.era.elapsedSeconds + f.nowSecond, '日期、累计真实时间和已结算周数必须使用同一周锚。');
  need(f.economy.income === root.source!.era.income + (f.economy.works - root.source!.era.works) * 24 &&
    b.cash === root.source!.budget.cash + f.economy.income - root.source!.era.income - (f.economy.expenses - root.source!.era.expenses),
    '每一笔当前现金必须对应真实劳动收入或已经支付的支出，欠费不算已付款。');
  need(f.finance.weeklyBudget === 4 && f.economy.era === 'POST_CYCLE' && f.economy.sourceEra === root.source!.acquisition.sourceEra,
    '本章不能切回历史工资或跨时代生活。');
  const reason = deathMaterialConservationBlock(root.materials!); need(reason === null, reason ?? '原件守恒无效。');
}
function pay(root: DeathRuntimeState, cost: { actions?: number; cash?: number; spirituality?: number; mind?: number; health?: number; pollution?: number }): void {
  const f = frame(root), b = f.budget;
  need(Object.values(cost).every(value => integer(value)), '真实代价必须为有限非负整数。');
  need(b.actions >= (cost.actions ?? 0) && b.cash >= (cost.cash ?? 0) && b.spirituality >= (cost.spirituality ?? 0), '实际行动、现金或灵性不足。');
  b.actions -= cost.actions ?? 0; b.cash -= cost.cash ?? 0; f.economy.expenses += cost.cash ?? 0;
  b.spirituality -= cost.spirituality ?? 0;
  b.health = Math.max(0, b.health - (cost.health ?? 0)); b.mind = Math.max(0, b.mind - (cost.mind ?? 0));
  b.pollution = Math.min(100, b.pollution + (cost.pollution ?? 0));
  if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; }
}
/** One relative clock starting at the real source handoff. Work/travel cannot
 * create a free week. NEXT_WEEK only reaches this same anchor once. Old debts,
 * wagePaidWeek, NPC events and the sixty-year cycle are never re-run. */
function elapse(root: DeathRuntimeState, seconds: number, receipts: DeathEvent['financeReceipts']): void {
  const f = frame(root), b = f.budget;
  need(integer(seconds) && integer(f.nowSecond + seconds), '本次真实用时无效。');
  const target = f.nowSecond + seconds;
  while (target >= f.weekAnchor + WEEK_SECONDS) {
    const paid = Math.min(b.cash, 24), unpaid = 24 - paid;
    pay(root, { cash: paid }); f.economy.livingArrears += unpaid;
    f.weekAnchor += WEEK_SECONDS; b.week += 1; b.date = addGameDays(b.date, 7);
    b.actions = b.status === 'ACTIVE' ? DEATH_CURRENT_ERA.nextWeek.actions : 0;
    f.finance.weeklyBudget = 4; f.economy.weeksAdvanced += 1; f.economy.emergencyWorkUsed = false;
    receipts.push({ title: '当代生活实际满七天', text: `本周应付24便士，实际支付${paid}便士，新增本章生活欠费${unpaid}便士；${b.status === 'ACTIVE' ? '本人取得4行动，旧行动不结转' : '本人已死亡，不获得可用行动'}。旧工资、旧债和旧事件不重跑。` });
  }
  f.economy.elapsedSeconds += seconds; f.nowSecond = target;
}
function checks(f: DeathFrame, id: string) {
  const receipts: DeathCheckReceipt[] = [];
  const check = (input: DeathCheckInput): PublicCheckResult => {
    const before = f.random.cursor, random = new DeterministicActionRandomStream(f.random.seed, before);
    const result = resolveNormalCheck({ ability: input.ability, baseAbility: f.budget.coreStats[input.ability],
      difficulty: input.difficulty, modifiers: input.modifier ? [{ source: input.source, value: input.modifier }] : [], roll: random.nextInt(1, 100) });
    f.random.cursor = random.cursor;
    receipts.push({ kind: 'CHECK', id: `${id}:check:${receipts.length + 1}`, check: result, cursorBefore: before, cursorAfter: random.cursor });
    return result;
  };
  return { receipts, check };
}
function baseHost(root: DeathRuntimeState, id: string, revision: number): DeathHost {
  const f = frame(root), b = f.budget, source = root.source!;
  return { eventId: id, revision, week: b.week, date: addGameDays(b.date, Math.floor((f.nowSecond - f.weekAnchor) / 86400)),
    actorId: source.actorId, sourceDigest: source.historyDigest, sourceEra: source.acquisition.sourceEra,
    location: f.location, nowSecond: f.nowSecond, weekAnchor: f.weekAnchor,
    sequence: b.sequence, status: b.status === 'ACTIVE' ? 'ACTIVE' : 'DEAD', cash: b.cash, actions: b.actions,
    health: b.health, mind: b.mind, spirituality: b.spirituality, check: null,
    serviceReceipts: clone(SERVICES.deathServiceVerifiedReceipts(root.services!)),
    legacyAccess: null, succession: null, uniquenessCustodianPresent: false, recoveryPermission: null };
}
/** Exact, finite material observations from this private current scene. The
 * initial willingness is authored content; a real ASK still creates the sole
 * current permission receipt. It is never accepted from a command payload. */
function materialSceneHost(scene: DeathMaterialScene, materials: DeathMaterialsRuntimeState,
  command: DeathCommand | null, base: DeathHost): DeathMaterialRuntimeHost {
  const h: DeathMaterialRuntimeHost = { ...clone(base), uniquenessObservation: null, compoundAccess: null };
  const material = command?.type === 'MATERIAL' ? command.command : null;
  const originalId = material && 'bottleId' in material ? material.bottleId : null;
  const legacy = originalId ? materials.legacySites.find(site => site.originalBottleId === originalId) : undefined;
  if (legacy && legacy.location === h.location) {
    h.legacyAccess = clone(legacy);
    h.legacyAccess.custodianPresent = legacy.custodianPresent && scene.legacy.custodianPresent && scene.legacy.adult &&
      scene.legacy.location === h.location && scene.legacy.custodianId === legacy.custodianId;
    h.legacyAccess.accessible = legacy.accessible && scene.legacy.accessible;
    if (scene.legacy.response !== 'ALLOW') {
      if (h.legacyAccess.investigation?.status === 'ALLOW') h.legacyAccess.investigation = null;
      if (h.legacyAccess.handover?.status === 'ALLOW') h.legacyAccess.handover = null;
    }
    if (material?.type === 'ASK_LEGACY_PERMISSION' && h.legacyAccess.custodianPresent && h.legacyAccess.accessible) {
      h.legacyAccess.investigation = deathMaterialPermissionReply(scene.legacy.response, legacy.investigation, h,
        'INVESTIGATE', legacy.custodianId, legacy.location, legacy.physicalVersion);
      h.legacyAccess.handover = deathMaterialPermissionReply(scene.legacy.response, legacy.handover, h,
        'HANDOVER', legacy.custodianId, legacy.location, legacy.physicalVersion);
    }
  }
  const chain = deathSuccessionAt(h.date), unique = scene.uniqueness, item = materials.uniqueness;
  if (chain) {
    h.succession = chain;
    h.succession.conditionVersion = unique.physicalVersion;
    // A declared conflicting holder or still-embodied predecessor invalidates
    // the chain rather than being hidden by the authored no-conflict template.
    if (unique.incumbentActorId !== null || unique.predecessorStillEmbodied || unique.custodianEmbodied) h.succession = null;
    if (h.succession) h.succession.permission = unique.response !== 'ALLOW' && unique.permission?.status === 'ALLOW'
      ? null : clone(unique.permission);
    h.uniquenessCustodianPresent = unique.adult && unique.custodianPresent && unique.location === h.location;
    const archived = material?.type === 'VERIFY_UNIQUENESS' && material.step === 'CHAIN' && h.location === DEATH_RUNTIME_MATERIAL_POLICY.archiveLocation;
    const carried = ['PLAYER', 'COMPOUND'].includes(item.holder) && item.location === h.location;
    const stored = ['UNVERIFIED', 'CUSTODIAN'].includes(item.holder) && unique.location === h.location && unique.present;
    if (archived || carried || stored) h.uniquenessObservation = {
      observedEventId: h.eventId, revision: h.revision, location: h.location, kind: archived ? 'ARCHIVE' : 'PHYSICAL',
      recordIds: archived ? deathSuccessionRecordIds(chain) : [], objectId: unique.objectId, seal: unique.seal,
      objectCount: unique.objectCount, present: archived || carried || stored, accessible: carried || unique.accessible,
      holderId: carried ? h.actorId : unique.custodianId, physicalVersion: unique.physicalVersion,
      incumbentActorId: unique.incumbentActorId, predecessorStillEmbodied: unique.predecessorStillEmbodied,
      custodianEmbodied: unique.custodianEmbodied,
    };
    if (material?.type === 'ASK_UNIQUENESS_PERMISSION' && stored && h.uniquenessCustodianPresent && unique.accessible && h.succession) {
      h.succession.permission = deathMaterialPermissionReply(unique.response, unique.permission, h,
        'HANDOVER', unique.custodianId, unique.location, unique.physicalVersion);
    }
  }
  const compoundId = material && 'compoundId' in material ? material.compoundId : null;
  const access = compoundId ? materials.recoverySites.find(site => site.compoundId === compoundId) : undefined;
  if (access && access.location === h.location) {
    h.compoundAccess = clone(access);
    h.compoundAccess.custodianPresent = access.custodianPresent && scene.workshop.custodianPresent && scene.workshop.adult &&
      scene.workshop.location === h.location && access.custodianId === scene.workshop.custodianId;
    h.compoundAccess.accessible = access.accessible && scene.workshop.accessible;
    if (scene.workshop.response !== 'ALLOW' && h.compoundAccess.handover?.status === 'ALLOW') h.compoundAccess.handover = null;
    if (material?.type === 'ASK_RECOVERY_PERMISSION' && h.compoundAccess.custodianPresent && h.compoundAccess.accessible)
      h.compoundAccess.handover = deathMaterialPermissionReply(scene.workshop.response, access.handover, h,
        'HANDOVER', access.custodianId, access.location, access.physicalVersion);
    h.recoveryPermission = clone(h.compoundAccess.handover);
  }
  return h;
}
function workshopPermission(scene: DeathMaterialScene, command: DeathCommand | null,
  h: DeathMaterialRuntimeHost): import('./types.js').DeathPermission | null {
  const workshop = scene.workshop;
  if (command?.type === 'STABILIZE_PROMOTION' && workshop.adult && workshop.custodianPresent && workshop.accessible && workshop.location === h.location)
    return deathMaterialPermissionReply(workshop.response, workshop.permission, h, 'SERVICE', workshop.custodianId, workshop.location, workshop.conditionVersion);
  if (!workshop.custodianPresent || !workshop.accessible || workshop.location !== h.location || workshop.response !== 'ALLOW') return null;
  return clone(workshop.permission);
}
function recordMaterialScene(scene: DeathMaterialScene, command: DeathCommand,
  h: DeathMaterialRuntimeHost, id: string): DeathMaterialScene {
  const next = clone(scene); need(h.eventId === id, '只能保存本动作实际许可答复。');
  if (command.type === 'MATERIAL' && command.command.type === 'ASK_UNIQUENESS_PERMISSION')
    next.uniqueness.permission = clone(h.succession?.permission ?? null);
  if (command.type === 'MATERIAL' && command.command.type === 'ACQUIRE_UNIQUENESS') next.uniqueness.present = false;
  if (command.type === 'STABILIZE_PROMOTION') {
    const permission = (h as DeathPreparationHost).workshopPermission;
    need(permission?.eventId === id && permission.revision === h.revision, '稳定准备必须保存本次现场询问的真实许可。');
    next.workshop.permission = clone(permission);
  }
  return next;
}
function leaveMaterialScene(scene: DeathMaterialScene, from: string, _to: string, _id: string): DeathMaterialScene {
  const next = clone(scene);
  for (const current of [next.uniqueness, next.workshop])
    if (current.permission?.location === from && current.permission.status === 'ALLOW') current.permission = null;
  return next;
}
function consumptionSceneHost(scene: DeathMaterialScene, materials: DeathMaterialsRuntimeState,
  compoundId: string, h: DeathMaterialRuntimeHost): DeathMaterialRuntimeHost {
  const next = clone(h), potion = materials.compounds.find(item => item.id === compoundId);
  need(potion && potion.status === 'PREPARED' && potion.location === h.location && h.check, '没有本次同一实物成药或真实检定。');
  if (h.check.tier === 'SUCCESS' || h.check.tier === 'GREAT_SUCCESS') return next;
  // The fixed receiving tray belongs to this existing finite workshop. A
  // destroyed/absent/inaccessible workshop cannot create replacement remnants.
  const workshop = scene.workshop;
  const tray = scene.receivingTray;
  if (workshop.location !== h.location || !workshop.accessible || !tray.present || !tray.accessible || tray.location !== h.location) return next;
  next.compoundAccess = { compoundId: potion.id, physicalId: `${potion.id}:receiving-tray`,
    sceneId: tray.id, location: h.location, characteristicIds: clone(potion.characteristicIds),
    uniquenessId: potion.uniquenessId, custodianId: DEATH_WORKSHOP_CUSTODIAN.id,
    custodianPresent: workshop.custodianPresent && workshop.adult, accessible: workshop.accessible,
    residualPresent: potion.residualPresent, physicalVersion: potion.physicalVersion + 1, sealed: false, handover: null };
  return next;
}
/** Private entry only. Nothing accepts a host or current-world certificate in
 * a command. The scene implementation must derive each current observation. */
export function deathHost(root: DeathRuntimeState, id: string, revision: number, command: DeathCommand | null = null): DeathMaterialRuntimeHost {
  const h = materialSceneHost(clone(root.materialScene!), clone(root.materials!), clone(command), baseHost(root, id, revision));
  const base = baseHost(root, id, revision);
  for (const key of ['eventId', 'revision', 'week', 'date', 'actorId', 'sourceDigest', 'sourceEra', 'location',
    'nowSecond', 'weekAnchor', 'sequence', 'status', 'cash', 'actions', 'health', 'mind', 'spirituality', 'serviceReceipts', 'check'] as const)
    need(sameDeath(h[key], base[key]), '当前场景不得改写本人预算、检定或已完成服务。');
  return h;
}
function preparationHost(root: DeathRuntimeState, id: string, revision: number, command: DeathCommand | null): DeathPreparationHost {
  const h = deathHost(root, id, revision, command), f = frame(root);
  return { ...h, acting: f.budget.acting, will: f.budget.coreStats.will,
    injuryCount: f.budget.injuries.length, promotionWeek: root.source!.acquisition.promotionWeek,
    conditionVersions: { ...SERVICES.deathServiceConditionVersions(root.services!),
      'DE0-WORKSHOP': root.materialScene!.workshop.conditionVersion,
      'DE0-WORKSHOP-RECEIVING-TRAY': root.materialScene!.receivingTray.conditionVersion },
    workshopPermission: workshopPermission(clone(root.materialScene!), clone(command), clone(h)) };
}
function start(source: DeathSource): DeathRuntimeState {
  const root = createDeathState(), era = source.era;
  need(source.acquisition.sourceEra === 'POST_CYCLE' && era.location === 'RECEPTION' && source.finance.weeklyBudget === 4,
    '本章只接续已核的当代接待处，不重置时代额度。');
  root.guidanceKnown = true; root.source = clone(source);
  root.frame = { budget: clone(source.budget), finance: clone(source.finance), random: clone(source.random),
    location: DEATH_HOME, nowSecond: 0, weekAnchor: 0,
    economy: { era: 'POST_CYCLE', sourceEra: source.acquisition.sourceEra, works: era.works, rests: era.rests,
      treatments: era.treatments, weeksAdvanced: era.weeksAdvanced, income: era.income, expenses: era.expenses,
      emergencyWorks: era.emergencyWorks, emergencyWorkUsed: era.emergencyWorkUsed,
      travelledMetres: era.travelledMetres, elapsedSeconds: era.elapsedSeconds, livingArrears: 0 } };
  root.services = SERVICES.createDeathServices(source.runId, source.actorId, source.budget.week, 0);
  root.materialScene = createDeathMaterialScene();
  root.materials = createDeathMaterials({ ...clone(source.acquisition), actorId: source.actorId,
    sourceDigest: source.historyDigest, inheritanceLocation: DEATH_HOME }, DEATH_RUNTIME_MATERIAL_POLICY);
  pay(root, DEATH_GUIDANCE); elapse(root, TIME.guidance, []); budgetInvariant(root);
  return root;
}
export function startDeath(s: DeathSliceState): DeathRuntimeState {
  need(sameDeath(s.death, createDeathState()), '非空或受损本章记录不能降为空根重开。');
  return start(createDeathSource(clone(s)));
}
function injuryEffects(root: DeathRuntimeState, injuries: SliceState['injuries'], revision: number): void {
  const b = frame(root).budget;
  for (const injury of injuries) {
    need(text(injury.id) && !b.injuries.some(item => item.id === injury.id) && ['LIGHT', 'HEAVY'].includes(injury.severity) &&
      injury.acquiredRevision === revision && injury.treatedRevision === null, '现场只能增加本次真实新伤，不能复制、治疗或重写旧伤。');
    b.injuries.push(clone(injury)); b.injuryRisk += injury.severity === 'HEAVY' ? 2 : 1;
  }
}
function movements(root: DeathRuntimeState, rows: DeathMovementReceipt[]): void {
  for (const row of rows) {
    need(text(row.actorId) && text(row.from) && text(row.to) && integer(row.metres) && integer(row.seconds) && integer(row.energyCost), '实际移动回执不完整。');
    if (row.actorId === root.source!.actorId) root.frame!.economy.travelledMetres += row.metres;
  }
}
function move(root: DeathRuntimeState, to: string, id: string): void {
  const f = frame(root), from = f.location;
  need(city(to), '不能借普通步行前往未登记地点。');
  if (from === to) return;
  root.materials = transportDeathMaterials(root.materials!, from, to);
  if (!root.epilogue) root.services = SERVICES.leaveDeathServices(root.services!, from, to, id);
  if (root.epilogue) root.epilogue.playerLocation = to;
  root.materialScene = leaveMaterialScene(root.materialScene!, from, to, id);
  root.promotionStability.preparations = invalidateDeathPreparations(root.promotionStability.preparations, id, from, to, () => false);
  f.location = to;
}
function applyEffect(root: DeathRuntimeState, effect: DeathEffect, id: string, receipts: DeathEvent['financeReceipts']): void {
  need(exact(effect, ['cashCost', 'cashGain', 'actions', 'spirituality', 'mind', 'health', 'seconds', 'toLocation']) &&
    Object.entries(effect).every(([key, value]) => key === 'toLocation' ? value === null || typeof value === 'string' : integer(value)) &&
    effect.seconds > 0, '有限场景必须返回完整实际非负代价与真实用时。');
  pay(root, { actions: effect.actions, cash: effect.cashCost, spirituality: effect.spirituality, mind: effect.mind, health: effect.health });
  // Ordinary services/abilities/material handling cannot invent wages/rewards.
  need(effect.cashGain === 0, '只有真实当代劳动能发放本章收入。');
  if (effect.toLocation !== null) move(root, effect.toLocation, id);
  elapse(root, effect.seconds, receipts);
}
export function getDeathPromotionStabilityPreview(root: DeathRuntimeState, compoundId: string) {
  const copy = clone(root), revision = nextRevision(copy), command: DeathCommand = { type: 'STABILIZE_PROMOTION', compoundId };
  const h = preparationHost(copy, eventId(copy, revision), revision, command);
  let reason: string | null = copy.frame!.economy.livingArrears > 0 ? '先偿还本章实际生活欠费，再为同一瓶准备。' : null;
  try { if (reason === null) prepareDeathPromotion(copy.materials!, copy.promotionStability.preparations, compoundId, h, DEATH_RUNTIME_MATERIAL_POLICY); }
  catch (error) { reason = error instanceof Error ? error.message : '当前不能进行准备。'; }
  const preparedChance = computeCheckChance({ ability: 'will', baseAbility: h.will, difficulty: DEATH_CONSUMPTION.difficulty,
    modifiers: [{ source: '本瓶本次实际稳定准备', value: DEATH_CONSUMPTION.bonus }] });
  const prepared = !!currentDeathPreparation(copy.materials!, copy.promotionStability.preparations, compoundId, h, DEATH_RUNTIME_MATERIAL_POLICY);
  const chance = prepared ? preparedChance : computeCheckChance({ ability: 'will', baseAbility: h.will,
    difficulty: DEATH_CONSUMPTION.difficulty, modifiers: [] });
  return { eligible: reason === null, reason, prepared, cost: DEATH_PROMOTION_STABILITY, chance, preparedChance };
}
function commandBlock(root: DeathRuntimeState, command: DeathCommand, revision: number): string | null {
  if (!validateDeathCommand(command) || command.type === 'LEARN_GUIDANCE') return '当前行动无效，已有指导也不能重新发资源。';
  const f = frame(root), b = f.budget;
  if (b.status !== 'ACTIVE' || b.health <= 0 || b.mind <= 0 || b.pollution >= 100) return '本人已经死亡，不能用旧周期、历史活体视图或治疗继续行动。';
  if (revision !== nextRevision(root)) return '当前行动次序已变化。';
  if (root.epilogue?.status === 'ACTIVE' && command.type !== 'EPILOGUE') return '先完成本次事故处置或走普通退路，不能借周结移走原现场。';
  if (!root.epilogue && !SERVICES.canLeaveDeathServices(root.services!, f.location) && command.type !== 'SERVICE') return '先停止当前作业并实际走回入口，再离开本处。';
  if (['WORK', 'REST', 'CLINIC', 'NEXT_WEEK'].includes(command.type) && f.location !== DEATH_HOME) return '先沿普通道路返回当前接待处，再劳动、休整、治疗或主动跨周。';
  if (command.type === 'WORK') return b.actions > 0 || b.actions === 0 && b.cash < 24 && !f.economy.emergencyWorkUsed
    ? null : '工作需1行动；0行动且不足24便士时，每周只能实做一次共享补劳动。';
  if (command.type === 'REST') return b.actions < 1 || b.cash < 8 ? '休整需1行动与8便士。' : null;
  if (command.type === 'CLINIC') return !b.injuries.some(injury => injury.severity === 'HEAVY' && injury.treatedRevision === null)
    ? '当前没有待普通处置的重伤。' : b.actions < 1 || b.cash < 60 ? '普通处置需要1行动与60便士，不能直接恢复健康。' : null;
  if (command.type === 'NEXT_WEEK') return b.actions !== 0 ? '先用完本周行动，再支付生活费走到同一七天周界。'
    : b.cash < 24 && !f.economy.emergencyWorkUsed ? '生活费不足时，先实做本周尚未使用的补劳动；新收入先偿还本章旧欠费。' : null;
  if (command.type === 'TRAVEL') return command.to === f.location ? '本人已在这一地点。' : null;
  if (command.type === 'RETURN_ON_FOOT') return f.location === DEATH_HOME ? '本人已在当代接待处。' : null;
  const id = eventId(root, revision);
  if (f.economy.livingArrears > 0 && (command.type === 'STABILIZE_PROMOTION' || command.type === 'CONSUME' ||
    command.type === 'MATERIAL' && ['ACQUIRE_CHARACTERISTIC', 'BUY_COMPOUND', 'COMPOSE_POTION', 'ACQUIRE_UNIQUENESS'].includes(command.command.type) &&
      deathMaterialEffect(root.materials!, command.command, DEATH_RUNTIME_MATERIAL_POLICY).cashCost > 0 ||
    command.type === 'SERVICE' && command.command.type === 'BUY_SUPPLIES')) return '先以真实劳动偿还本章生活欠费，再采购或为同一瓶准备、饮用。';
  if (command.type === 'SERVICE') return b.sequence !== 1 ? '两件原服务已经封存，晋升后须接续同一身体的新事故。'
    : SERVICES.deathServicesBlock(clone(root.services!), command.command, baseHost(root, id, revision));
  if (command.type === 'MATERIAL') return deathMaterialBlock(root.materials!, command.command, deathHost(root, id, revision, command), DEATH_RUNTIME_MATERIAL_POLICY);
  if (command.type === 'STABILIZE_PROMOTION') return getDeathPromotionStabilityPreview(root, command.compoundId).reason;
  if (command.type === 'CONSUME') return deathConsumeBlock(root.materials!, root.promotionStability.preparations,
    command.compoundId, preparationHost(root, id, revision, command), DEATH_RUNTIME_MATERIAL_POLICY);
  if (command.type === 'START_EPILOGUE') {
    if (b.sequence !== 0 || root.promotionWeek === null || root.epilogue !== null) return '须真实晋升的同一本人，且该单次事故尚未发生。';
    if (f.location !== 'DE0-OLD-WHARF') return '须沿普通路实际抵达原旧码头。';
    try { EPILOGUE.startDeathEpilogue(clone(root.services!), baseHost(root, id, revision)); return null; }
    catch (error) { return error instanceof Error ? error.message : '原工人、同罐、当次许可或当前身体不能完成取送。'; }
  }
  if (command.type === 'EPILOGUE') return !root.epilogue || f.location !== root.epilogue.location
    ? '本人须在同一宗事故的真实现场。' : EPILOGUE.deathEpilogueBlock(clone(root.epilogue), command.command, baseHost(root, id, revision));
  return '当前没有这项行动。';
}
function reduce(root: DeathRuntimeState, command: DeathCommand, revision: number): DeathEvent {
  const reason = commandBlock(root, command, revision); need(reason === null, reason ?? '当前不能行动。');
  const f = frame(root), b = f.budget, id = eventId(root, revision), before = clone(f), beforeDigest = dataDigest(root);
  const random = checks(f, id), financeReceipts: DeathEvent['financeReceipts'] = [], notes: string[] = [];
  const time = (seconds: number) => elapse(root, seconds, financeReceipts);
  if (command.type === 'WORK') {
    const emergency = b.actions === 0;
    if (emergency) { f.economy.emergencyWorkUsed = true; f.economy.emergencyWorks += 1; }
    else pay(root, { actions: 1 });
    b.cash += 24; f.economy.works += 1; f.economy.income += 24;
    const repaid = Math.min(b.cash, f.economy.livingArrears);
    pay(root, { cash: repaid }); f.economy.livingArrears -= repaid;
    if (repaid) financeReceipts.push({ title: '本章生活欠费实际偿还', text: `本次真实劳动收入优先偿还${repaid}便士，尚欠${f.economy.livingArrears}便士；旧债未改。` });
    time(TIME.work);
    notes.push(emergency ? '实做本周唯一一次补劳动，24便士入账；继承的同周已用额度不重置。' : '实做当代普通劳动，扣1行动并收入24便士；不发历史180便士工资。');
  } else if (command.type === 'REST') {
    pay(root, { actions: 1, cash: 8 }); f.economy.rests += 1;
    b.health = Math.min(100, b.health + 5); b.mind = Math.min(100, b.mind + 8);
    b.spirituality = Math.min(cap(b), b.spirituality + 10); b.pollution = Math.max(0, b.pollution - 4);
    const oldCount = b.injuries.length;
    b.injuries = b.injuries.filter(injury => !(b.health >= 80 && injury.acquiredRevision < revision &&
      (injury.severity === 'LIGHT' || injury.treatedRevision !== null && injury.treatedRevision < revision)));
    if (oldCount > b.injuries.length && b.injuries.length === 0) b.injuryRisk = 0;
    time(TIME.rest); notes.push('实付8便士与1行动，恢复健康5、精神8、灵性10并减少污染4；重伤须先治疗且后续休整达健康80才解除。');
  } else if (command.type === 'CLINIC') {
    pay(root, { actions: 1, cash: 60 }); f.economy.treatments += 1;
    for (const injury of b.injuries) if (injury.severity === 'HEAVY' && injury.treatedRevision === null) injury.treatedRevision = revision;
    time(TIME.clinic); notes.push('实际60便士与1行动仅处置同一未治重伤，健康、伤势条目和风险不直接补满。');
  } else if (command.type === 'NEXT_WEEK') {
    time(f.weekAnchor + WEEK_SECONDS - f.nowSecond);
    notes.push('补足同一真实七天的余时，只结算这一周的24便士生活费与下周4行动。');
  } else if (command.type === 'TRAVEL' || command.type === 'RETURN_ON_FOOT') {
    move(root, command.type === 'TRAVEL' ? command.to : DEATH_HOME, id);
    f.economy.travelledMetres += TIME.cityRouteMetres;
    time(command.type === 'TRAVEL' ? TIME.travel : TIME.returnOnFoot);
    notes.push('本人沿登记公共路线实际步行1800米、1800秒，不另扣行动；仅同一批随身原物同行，旧人物原物留在旧处。');
  } else if (command.type === 'SERVICE') {
    const result = SERVICES.applyDeathServices(clone(root.services!), command.command, baseHost(root, id, revision));
    root.services = result.state; applyEffect(root, result.effect, id, financeReceipts);
    injuryEffects(root, result.injuries, revision); movements(root, result.movements); notes.push(...result.notes);
  } else if (command.type === 'MATERIAL') {
    const h = deathHost(root, id, revision, command);
    const result = applyDeathMaterial(root.materials!, command.command, h, DEATH_RUNTIME_MATERIAL_POLICY);
    root.materialScene = recordMaterialScene(root.materialScene!, command, h, id);
    root.materials = result.state; applyEffect(root, result.effect, id, financeReceipts); notes.push(...result.notes);
  } else if (command.type === 'STABILIZE_PROMOTION') {
    const h = preparationHost(root, id, revision, command);
    const result = prepareDeathPromotion(root.materials!, root.promotionStability.preparations, command.compoundId, h, DEATH_RUNTIME_MATERIAL_POLICY);
    root.materialScene = recordMaterialScene(root.materialScene!, command, h, id);
    root.promotionStability.preparations = result.state;
    applyEffect(root, result.effect, id, financeReceipts); notes.push(...result.notes);
  } else if (command.type === 'CONSUME') {
    const h = preparationHost(root, id, revision, command);
    const preparation = currentDeathPreparation(root.materials!, root.promotionStability.preparations, command.compoundId, h, DEATH_RUNTIME_MATERIAL_POLICY);
    need(preparation, '同一瓶的实际已付准备已失效。');
    const check = random.check({ ability: 'will', difficulty: DEATH_CONSUMPTION.difficulty, modifier: DEATH_CONSUMPTION.bonus, source: '本瓶本次实际稳定准备' });
    const success = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS', severe = check.tier === 'GREAT_FAILURE';
    pay(root, { actions: 1, spirituality: 30 });
    if (success) {
      pay(root, { mind: 12 }); b.sequence = 0; b.acting = 0; root.promotionWeek = b.week;
      for (const ability of DEATH_ABILITY_IDS) { need(!(ability in b.mastery), '新技巧不能覆盖旧掌握。'); b.mastery[ability] = 0; }
      need(!b.completedSources.includes('DEATH_ORIGINAL_SUCCESSION'), '同一次晋升不能重复结算。');
      b.completedSources.push('DEATH_ORIGINAL_SUCCESSION');
    } else {
      pay(root, { health: severe ? DEATH_CONSUMPTION.greatFailureHealth : DEATH_CONSUMPTION.failureHealth,
        mind: severe ? DEATH_CONSUMPTION.greatFailureMind : DEATH_CONSUMPTION.failureMind,
        pollution: severe ? DEATH_CONSUMPTION.greatFailurePollution : DEATH_CONSUMPTION.failurePollution });
      injuryEffects(root, [{ id: `${id}:potion-injury`, severity: 'HEAVY', acquiredRevision: revision, treatedRevision: null }], revision);
    }
    const afterDamage = deathHost(root, id, revision, command); afterDamage.check = clone(check);
    const observed = consumptionSceneHost(clone(root.materialScene!), clone(root.materials!), command.compoundId, afterDamage);
    for (const key of Object.keys(afterDamage) as (keyof DeathMaterialRuntimeHost)[])
      if (key !== 'compoundAccess') need(sameDeath(observed[key], afterDamage[key]), '失败现物观察不得更改实际身体、骰或其他权威。');
    const potion = root.materials!.compounds.find(item => item.id === command.compoundId)!;
    root.materials = settleDeathConsumption(root.materials!, { eventId: id, week: b.week, compoundId: command.compoundId,
      success, alive: b.status === 'ACTIVE', location: f.location,
      residualPresent: !success && observed.compoundAccess?.residualPresent === true,
      physicalVersion: potion.physicalVersion + 1 }, observed);
    if (success) root.materialScene!.uniqueness.incumbentActorId = root.source!.actorId;
    root.promotionStability.preparations = spendDeathPreparation(root.promotionStability.preparations, preparation.id, id);
    time(TIME.consumption);
    notes.push(success ? '同一本人融合三原份及同一唯一性，精神实扣12，两项新技巧从0开始；原19项掌握、身份和当前资源不补满。'
      : '单次真实检定失败，原成药已耗，真实损伤、污染和重伤保留；死亡硬锁，幸存且原处同物确实尚存才可封存回收。');
  } else if (command.type === 'START_EPILOGUE') {
    const result = EPILOGUE.startDeathEpilogue(clone(root.services!), baseHost(root, id, revision));
    need(sameDeath(result.state.origin.wharf, root.services!.wharf) && sameDeath(result.state.origin.residue, root.services!.residue) &&
      sameDeath(result.state.origin.receipts, SERVICES.deathServiceVerifiedReceipts(root.services!)), '新事故必须继承已完成服务的同一原人原物和损耗，不重开服务。');
    root.epilogue = result.state; applyEffect(root, result.effect, id, financeReceipts);
    injuryEffects(root, result.injuries, revision); movements(root, result.movements); notes.push(...result.notes);
  } else if (command.type === 'EPILOGUE') {
    const h = baseHost(root, id, revision), input = EPILOGUE.deathEpilogueCheckInput(clone(root.epilogue!), command.command, clone(h));
    const isAttempt = ['PARTIAL_SPIRIT_PASSAGE', 'PROPAGATION_BARRIER'].includes(command.command.type);
    need((input !== null) === isAttempt, '仅两项本次实际施术抽取随机数；观察、开路应用或重复尝试不能补骰。');
    if (input) h.check = random.check(input);
    const result = EPILOGUE.applyDeathEpilogue(clone(root.epilogue!), command.command, h);
    const beforeCase = root.epilogue!; root.epilogue = result.state;
    for (const [ability, gain] of Object.entries(result.masteryGains)) {
      need(DEATH_ABILITY_IDS.some(id => id === ability) && integer(gain, 1), '现场只能增加两项新能力的真实应用掌握。');
      const passage = ability === DEATH_ABILITY_IDS[0], previous = passage ? beforeCase.passage.window : beforeCase.barrier.window;
      const current = passage ? result.state.passage.window : result.state.barrier.window;
      need(!previous.applied && current.applied && current.appliedEventId === id && !isAttempt &&
        command.command.type === (passage ? 'TRAVERSE_PASSAGE' : 'APPLY_BARRIER'), '成功开窗不等于实际应用，不能重复涨掌握。');
      b.mastery[ability] = (b.mastery[ability] ?? 0) + gain;
    }
    applyEffect(root, result.effect, id, financeReceipts);
    injuryEffects(root, result.injuries, revision); movements(root, result.movements); notes.push(...result.notes);
  }
  root.promotionStability.preparations = invalidateDeathPreparations(root.promotionStability.preparations, id, before.location, f.location,
    preparation => b.status === 'ACTIVE' && !!currentDeathPreparation(root.materials!, root.promotionStability.preparations, preparation.compoundId,
      preparationHost(root, id, revision, null), DEATH_RUNTIME_MATERIAL_POLICY));
  // Never turn the embodied original into supplier inventory after death.
  // Actual failed exterior material disposition is already settled above.
  budgetInvariant(root);
  const event: DeathEvent = { id, revision, command: clone(command), before, after: clone(f),
    randomReceipts: clone(random.receipts), financeReceipts, notes, beforeDigest, afterDigest: dataDigest(root) };
  root.journal.push(event); return event;
}

function assertCurrent(s: DeathSliceState, root: DeathRuntimeState): void {
  const f = frame(root), source = root.source!;
  need(s.runId === source.runId && s.progression.pathwayId === 'death' && s.revision === source.revision + 1 + root.journal.length,
    '当前周目、途径或版本与本章完整末态不一致。');
  need(sameDeath(deathBudget(s), f.budget) && sameDeath(s.random, f.random), '当前身体、全部掌握或随机游标不等于真实行动末态。');
  const { coreStats: _current, ...identity } = s.character, { coreStats: _original, ...originalIdentity } = source.character;
  need(sameDeath(identity, originalIdentity) && Object.entries(f.finance).every(([key, value]) => sameDeath(s[key as keyof SliceState], value)), '当前身份或生活财务被跨状态替换。');
  need(source.historyDigest === deathHistoryDigest(s) && source.originalWorldDigest === deathDigest(s.world) &&
    sameDeath(source.acquisition, deathAcquisitionSnapshot(s)) && s.combatHistory.length === source.combatHistoryLength &&
    source.combatHistoryDigest === deathDigest(s.combatHistory), '十个旧根、原人物原物、原取得或原战斗末态被改写。');
  need(s.combat === null && s.activeEvent === null && s.eventQueue.length === 0 && s.pulse === 'NONE' && s.billAmount === 0,
    '新章不能同时重开旧战斗、旧周脉冲或待办事件。');
  need(f.budget.status === 'DEAD' ? s.ending?.kind === 'DEATH' && s.arc.stage === 'ENDED' : s.ending === null,
    '真实死亡必须由中央归档，仍活着的本人不能被替换为另一终局。');
  const expectedLastCheck = root.journal.at(-1)?.randomReceipts.at(-1)?.check ?? null;
  need(sameDeath(s.lastCheck, expectedLastCheck), '当前末次检定不能来自另一动作或旧骰。');
}
/** Sole cold/raw path: validate the independent source exactly once, then
 * execute every new command and compare every receipt AND the complete root.
 * Digests detect tampering; none can waive either replay. */
function reconstruct(input: DeathSliceState): DeathRuntimeState {
  const s = clone(input), saved = s.death;
  need(record(saved) && saved.source && Array.isArray(saved.journal), '缺失或受损本章根不能作为空白新局。');
  need(validateDeathSource(s, saved.source, 'COLD_REOPEN'), '原身份、十个旧根、时代生活或三原份未通过完整历史核验。');
  const root = start(clone(saved.source));
  for (const event of saved.journal) {
    need(record(event) && event.revision === nextRevision(root) && validateDeathCommand(event.command), '新章命令或修订次序无效。');
    const actual = reduce(root, clone(event.command), event.revision);
    need(sameDeath(actual, event), '同一命令的真实代价、时间、物权、检定或完整回执与记录不一致。');
  }
  need(sameDeath(root, saved), '完整当前身体、材料、场景、准备、事故或日志不能由真实命令重建。');
  assertCurrent(s, root); return root;
}
export function validateDeathRoot(s: DeathSliceState): void { reconstruct(s); }
export function transitionDeath(s: DeathSliceState, command: DeathCommand): DeathRuntimeState {
  const root = reconstruct(s); reduce(root, clone(command), s.revision + 1); return root;
}
declare const deathOwnedEngineBrand: unique symbol;
export interface DeathOwnedEngine { readonly [deathOwnedEngineBrand]: true }
interface OwnedHead { root: DeathRuntimeState; envelopeDigest: string;
  finishBaseline: { arcStage: SliceState['arc']['stage']; aid: SliceState['aid'] } }
const owned = new WeakMap<DeathOwnedEngine, OwnedHead>();
/** All non-chapter mutable publishing fields are explicit. Central migration,
 * chronicle/ending validation remains required, never a Death history skip. */
function frozenEnvelope(s: DeathSliceState): unknown {
  const { death: _death, revision: _revision, status: _status, week: _week, date: _date,
    actionsRemaining: _actions, weeklyBudget: _weekly, cash: _cash, health: _health, mind: _mind,
    spirituality: _spirituality, injuries: _injuries, injuryRisk: _risk, random: _random,
    lastCheck: _check, lastResult: _result, chronicle: _chronicle, knowledge: _knowledge,
    ending: _ending, aid: _aid, arc, character, progression, seer, ...frozen } = s;
  const { stage: _arcStage, ...arcHistory } = arc;
  const { coreStats: _core, ...identity } = character;
  const { sequence: _sequence, acting: _acting, mastery: _mastery, ...progressionIdentity } = progression;
  const { pollution: _pollution, completedSources: _completed, ...seerHistory } = seer;
  return { frozen, arcHistory, identity, progressionIdentity, seerHistory };
}
function retain(entry: OwnedHead): DeathOwnedEngine { const handle = Object.freeze({}) as DeathOwnedEngine; owned.set(handle, entry); return handle; }
function getOwned(handle: DeathOwnedEngine): OwnedHead { const entry = owned.get(handle); need(entry, '无效、伪造或跨来源的领域会话。'); return entry; }
/** Initial handoff creates its source once. The caller publishes this exact
 * chapter root into the same Slice draft and increments revision once. */
export function startDeathOwnedEngine(s: DeathSliceState): DeathOwnedEngine {
  const copy = clone(s), root = startDeath(copy);
  return retain({ root, envelopeDigest: deathDigest(frozenEnvelope(copy)), finishBaseline: { arcStage: copy.arc.stage, aid: copy.aid } });
}
export function openDeathOwnedEngine(s: DeathSliceState): DeathOwnedEngine {
  const copy = clone(s), root = reconstruct(copy); return retain({ root, envelopeDigest: deathDigest(frozenEnvelope(copy)), finishBaseline: { arcStage: copy.arc.stage, aid: copy.aid } });
}
export function snapshotDeathOwnedEngine(handle: DeathOwnedEngine): DeathRuntimeState { return clone(getOwned(handle).root); }
export function inspectDeathOwnedEngine(handle: DeathOwnedEngine) {
  const root = getOwned(handle).root;
  return { runId: root.source!.runId, revision: nextRevision(root) - 1, status: root.frame!.budget.status };
}
/** No source revalidation/replay on a hot step. The only authority is the
 * private object identity; clone/project results carry no usable brand. */
export function advanceDeathOwnedEngine(handle: DeathOwnedEngine, command: DeathCommand, revision: number): DeathOwnedEngine {
  const current = getOwned(handle), next = clone(current.root);
  reduce(next, clone(command), revision); return retain({ root: next, envelopeDigest: current.envelopeDigest, finishBaseline: current.finishBaseline });
}
export function assertOwnedDeathCurrent(s: DeathSliceState, handle: DeathOwnedEngine): void {
  const current = getOwned(handle);
  need(sameDeath(s.death, current.root) && deathDigest(frozenEnvelope(s)) === current.envelopeDigest,
    '外部状态不是本会话同一完整当前头，不能跨状态借用已验证资格。');
  const dead = current.root.frame!.budget.status === 'DEAD';
  need(s.arc.stage === (dead ? 'ENDED' : current.finishBaseline.arcStage) &&
    s.aid === (dead ? current.finishBaseline.aid === 'DELIVERED' ? 'DELIVERED' : 'CANCELLED' : current.finishBaseline.aid),
    '只有真实死亡可以执行中央归档与援助终止；其他旧案状态必须原样。');
  assertCurrent(s, current.root);
}
export function blockDeathOwnedEngine(handle: DeathOwnedEngine, command: DeathCommand, revision: number): string | null {
  try { return commandBlock(getOwned(handle).root, command, revision); }
  catch { return '当前完整记录或实际行动条件无效。'; }
}
