import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasWandererLifeLock } from '../wanderer/life.js';
import { createPlaneswalkerRitualState, hasPlaneswalkerRitualLock, planeswalkerRitualQualified } from './ritual.js';
import { createPlaneswalkerSiteState, validatePlaneswalkerSiteState, advancePlaneswalkerTime, stopPlaneswalkerEffects,
  PLANESWALKER_POSITION_METRES, type PlaneswalkerSiteState, type PlaneswalkerLocation, type PlaneswalkerLocalLocation,
  type PlaneswalkerConsent, type PlaneswalkerVerifiedEndpoint, type PlaneswalkerKitCaseId } from './resources.js';
export { createPlaneswalkerSiteState, validatePlaneswalkerSiteState, type PlaneswalkerSiteState, type PlaneswalkerLocation, type PlaneswalkerConsent } from './resources.js';

/** All quantified practice mechanics are authored G. No Star Staff ability library or matter/person copying. */
export const PLANESWALKER_CASE_IDS = ['symbolic-transit', 'pattern-reproduction', 'withdrawn-transit'] as const;
export const PLANESWALKER_ACTIVITY_CASE_IDS = PLANESWALKER_CASE_IDS;
export const ACTIVITY_CASE_IDS = PLANESWALKER_CASE_IDS;
export type PlaneswalkerCaseId = typeof PLANESWALKER_CASE_IDS[number];
export type PlaneswalkerLifeAbilityId = 'door.s2.symbolic-transit' | 'door.s2.pattern-reproduction';
export type PlaneswalkerWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'STOPPED';
const STEPS = ['CONSENT_OPERATOR', 'DECLINE_OPERATOR', 'BUY_KIT', 'CHECK_ENDPOINTS', 'TAKE_PARCEL', 'DEPART',
  'READ_RETURN_MARKER', 'RETURN_LOCAL', 'RETURN_PARCEL', 'ARCHIVE_KIT', 'READ_PATTERN', 'OPEN_DOOR', 'CLOSE_DOOR',
  'BLOCK_DOOR', 'UNBLOCK_DOOR', 'APPLY_PATTERN', 'MANUAL_COMPARE', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_10', 'INSPECT', 'CLEANUP'] as const;
export type PlaneswalkerActivityCommand =
  | { type: typeof STEPS[number] | 'OBSERVE' | 'PERFORM' | 'REPORT' | 'LEAVE' | 'CLOSE' | 'WITHDRAW'; caseId: PlaneswalkerCaseId }
  | { type: 'PREPARE'; caseId: PlaneswalkerCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
export interface PlaneswalkerLifeMovement {
  from: PlaneswalkerLocation; to: PlaneswalkerLocation; mode: 'WALK' | 'ASTRAL'; metres: number | null; seconds: number;
  originalBody: true; parcelId: 'PW2-PARCEL' | null; kitId: string | null;
}
export interface PlaneswalkerAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  performed: boolean; interrupted: boolean; inspected: boolean; elapsedSeconds: number; spiritualitySpent: number; penniesSpent: number;
  pollutionAdded: number; protectionSpent: number; playerTravelMetres: number; playerAstralLegs: number; operatorEnergySpent: number;
  operatorConsent: PlaneswalkerConsent; operatorConsentWeek: number | null; endpointsChecked: boolean; patternRead: boolean;
  parcelTaken: boolean; departed: boolean; returnMarkerChecked: boolean; returnedLocal: boolean; parcelReturned: boolean; kitArchived: boolean;
  patternApplied: boolean; manualComparison: boolean; permissionWithdrawn: boolean; effectStopped: boolean; waits: number; doorOperations: number;
  abilityTier: PublicResolutionTier | null; window: PlaneswalkerWindow; windowExpiresAt: number | null;
  appliedAbilityIds: PlaneswalkerLifeAbilityId[]; moves: PlaneswalkerLifeMovement[];
  siteAtStart: PlaneswalkerSiteState; siteAtClose: PlaneswalkerSiteState | null;
}
export interface PlaneswalkerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  preparations: number; closes: number; withdrawals: number; attempts: PlaneswalkerAttempt[];
}
export interface PlaneswalkerCheckSource {
  caseId: PlaneswalkerCaseId; abilityId: PlaneswalkerLifeAbilityId; cost: 8 | 7; at: number; coreStat: 'knowledge'; baseAbility: number;
  operatorConsentWeek: number; site: PlaneswalkerSiteState;
}
export interface PlaneswalkerLifeBudget {
  actions: number; spirituality: number; cash: number; health: number; mind: number; pollution: number;
}
export interface PlaneswalkerLifeEvent {
  week: number; date: PublicGameDate; endpoint: PlaneswalkerVerifiedEndpoint; command: PlaneswalkerActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number; randomAfter: number; check: PublicCheckResult | null; source: PlaneswalkerCheckSource | null;
  paid: { actions: number; spirituality: number; pennies: number; pollution: number };
  before: PlaneswalkerLifeBudget; after: PlaneswalkerLifeBudget;
}
export interface PlaneswalkerLifeState {
  activeCase: PlaneswalkerCaseId | null; reflected: boolean; site: PlaneswalkerSiteState;
  cases: Record<PlaneswalkerCaseId, PlaneswalkerCaseState>; journal: PlaneswalkerLifeEvent[];
}
export interface PlaneswalkerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PlaneswalkerActivityCommand }
export interface PlaneswalkerLifeProjection {
  title: string; story: string; environment: string; activeCase: PlaneswalkerCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: PlaneswalkerSiteState; clockSeconds: number; playerLocation: PlaneswalkerLocation; playerTravelMetres: number; playerAstralLegs: number;
  currentAttempt: PlaneswalkerAttempt | null; sitePhase: 'LIFE' | 'ENCOUNTER';
  cases: { id: PlaneswalkerCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null;
    result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: PlaneswalkerAttempt[] }[];
  actions: PlaneswalkerLifeAction[];
}
export const PLANESWALKER_LIFE_STORY = '旅法师·门序列2。玛拉42岁，在本地通行室与你核对本人已实访的灯原聚居点。本体象征通行消耗8灵性、知识20，施术10秒，成功开放20秒窗口；实际出发和返程各消耗10秒防护并增加1污染，返程另需8灵性及现场原标记。准备与施术前须至少24灵性。另一案先亲见原灯的三环光纹，再以7灵性、知识20试作短时复现，须在窗口内用4秒真实投到原屏才能算应用。观察、准备、实施、报告各1行动；三报告各25扮演，反思25；只有实际应用且报告的对应技巧增加8掌握。';
const CASES = [
  { id: 'symbolic-transit', title: '同一身体与原封包的异星往返', story: '先取得玛拉本次许可，实付20便士购得这一案的独立90秒路线护具，核读此前本人已经到访并留下传说的灯原聚居点坐标。拿起属于自己的唯一封包，支付施术成本，窗口成功还须实际出发。本人和原包一起抵达异星生活舱，亲读当前原回程标记，再付8灵性真实返回；往返各耗10秒防护、各加1污染。未应用的成功、失败或普通核读都不会把身体送到远处。' },
  { id: 'pattern-reproduction', title: '亲见三环，再将短暂光纹投到原屏', story: '当面问过本次许可后，亲自走到原油灯旁，耗掉一份灯油，观察并理解同一透镜产生的三环光纹。全场只有这一次原灯展示。打开原遮门，施术成功后用4秒在原屏上完成短暂光纹比对。关闭或闩住的遮门会阻止实际应用；成功但未应用不增加掌握。普通方法只能比对已经记录的式样，不造出光、物质、人物或能力库。' },
  { id: 'withdrawn-transit', title: '付过费用，仍尊重当前撤回', story: '重新取得玛拉本案许可，为这一案另付20便士购入独立90秒路线护具，再检查已有端点并拿起同一原包。支付一次施术成本后，她会明确撤回现场协调许可。这一案不能出发；读取她当前的决定，停止作用、原包放回、原门关好并归档这一套护具。费用不退，未发生的通行不增加掌握。' },
] as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const ORIGINAL_REMOTE = createPlaneswalkerRitualState().sites['PW2-LAMP'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 2;
function endpoint(s: SliceState): PlaneswalkerVerifiedEndpoint | null {
  const r = s.planeswalker.ritual, p = r.sites['PW2-LAMP'];
  if (!planeswalkerRitualQualified(s) || !integer(p.qualifiedWeek, 1, s.week) || p.qualifiedWeek !== p.verifiedWeek ||
    r.localMarker.id !== 'PW2-LOCAL-MARKER' || r.localMarker.location !== 'LOCAL' || r.localMarker.intact !== true || p.id !== ORIGINAL_REMOTE.id || p.name !== ORIGINAL_REMOTE.name || p.worldId !== ORIGINAL_REMOTE.worldId ||
    !same(p.coordinates, ORIGINAL_REMOTE.coordinates) || !same(p.returnMarker, ORIGINAL_REMOTE.returnMarker) || !same(p.shelter, ORIGINAL_REMOTE.shelter)) return null;
  return { planetId: p.worldId, siteId: p.id, title: p.name, coordinateId: p.coordinates.sourceId, returnMarkerId: p.returnMarker.id, qualifiedWeek: p.qualifiedWeek };
}
const freshCase = (): PlaneswalkerCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, preparations: 0, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', site: PlaneswalkerSiteState): PlaneswalkerAttempt {
  return { week, method, closed: false, result: 'NONE', performed: false, interrupted: false, inspected: false, elapsedSeconds: 0, spiritualitySpent: 0,
    penniesSpent: 0, pollutionAdded: 0, protectionSpent: 0, playerTravelMetres: 0, playerAstralLegs: 0, operatorEnergySpent: 0,
    operatorConsent: 'UNASKED', operatorConsentWeek: null, endpointsChecked: false, patternRead: false, parcelTaken: false, departed: false,
    returnMarkerChecked: false, returnedLocal: false, parcelReturned: false, kitArchived: false, patternApplied: false, manualComparison: false,
    permissionWithdrawn: false, effectStopped: false, waits: 0, doorOperations: 0, abilityTier: null, window: 'NONE', windowExpiresAt: null,
    appliedAbilityIds: [], moves: [], siteAtStart: structuredClone(site), siteAtClose: null };
}
export function createPlaneswalkerLifeState(): PlaneswalkerLifeState {
  return { activeCase: null, reflected: false, site: createPlaneswalkerSiteState(), cases: { 'symbolic-transit': freshCase(), 'pattern-reproduction': freshCase(), 'withdrawn-transit': freshCase() }, journal: [] };
}
const current = (l: PlaneswalkerLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: PlaneswalkerLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
export const planeswalkerLifeClosed = (s: SliceState): boolean => !contactOpen(s.planeswalker.life) && Object.values(s.planeswalker.life.cases).every(r => r.status === 'RESOLVED');
export const hasPlaneswalkerLifeLock = (s: SliceState): boolean => s.progression.pathwayId === 'door' && s.progression.sequence === 2 && (contactOpen(s.planeswalker.life) || s.planeswalker.encounter.status === 'AVAILABLE' && physicalCleanupBlock(s.planeswalker.life) !== null);
export const planeswalkerInside = hasPlaneswalkerLifeLock;
export function validatePlaneswalkerActivityCommand(v: unknown): v is PlaneswalkerActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!PLANESWALKER_CASE_IDS.includes(v.caseId as PlaneswalkerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && [...STEPS, 'OBSERVE', 'PERFORM', 'REPORT', 'LEAVE', 'CLOSE', 'WITHDRAW'].includes(String(v.type));
}
export const isPlaneswalkerActivityCommand = validatePlaneswalkerActivityCommand;
export const isPlaneswalkerActivity = validatePlaneswalkerActivityCommand;
function physicalCleanupBlock(l: PlaneswalkerLifeState): string | null {
  const p = l.site, a = current(l);
  if (p.playerLocation === 'REMOTE') return '本人和原封包仍在异星；须现场亲读原回程标记，再付8灵性与10秒防护实际返回。';
  if (p.effect.mode !== 'OFF' || a?.performed && a.spiritualitySpent > 0 && !a.effectStopped) return '先明确停止作用；失败或过期仍须确认，不退款。';
  if (p.parcel.location !== 'ENTRY_STAND') return '先把同一原封包实际带回本地原架。';
  if (p.door.state !== 'CLOSED') return '原遮门须亲手关闭或解除门闩后关好。';
  if (Object.values(p.kits).some(k => k.status === 'PLAYER')) return '归档本次实购护具，保留实际余量；不会退费或补满。';
  return p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' ? null : '本人和玛拉须沿本地普通道路回到入口。';
}
const allowed = (l: PlaneswalkerLifeState, week: number) => l.site.operatorConsent === 'GRANTED' && l.site.operatorConsentWeek === week;
const inactive = (l: PlaneswalkerLifeState) => l.site.effect.mode === 'OFF';
function localBlock(l: PlaneswalkerLifeState, c: PlaneswalkerActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !contactOpen(l) && !physicalCleanupBlock(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先如实报告三案，再完成一次反思。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), p = l.site, index = PLANESWALKER_CASE_IDS.indexOf(c.caseId), transit = c.caseId !== 'pattern-reproduction';
  if (c.type === 'OBSERVE') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[PLANESWALKER_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '按顺序观察本案，先收束前一处接触。';
  if (c.type === 'PREPARE') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'OBSERVED' && r.attempts.length === 0 && !Object.values(l.cases).some(x => x.attempts.some(t => t.week === week)) ? null : '须已观察且现场收束；每案只准备一次，每周只准备一案。';
  if (c.type === 'REPORT') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'EXAMINED' ? null : '先停止、真实返回并归物，收束接触后才能报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在准备或进行的同一案现场。';
  // After actual departure only bounded current-location work and a paid real return remain available.
  if (p.playerLocation === 'REMOTE' && !['READ_RETURN_MARKER', 'RETURN_LOCAL', 'STOP'].includes(c.type)) return '你正处于异星封闭生活舱；只能核读当前原回程标记、停止作用，或付费真实返程，不能操作本地物品或过周。';
  if (c.type === 'READ_RETURN_MARKER') return c.caseId === 'symbolic-transit' && a.departed && !a.returnMarkerChecked && p.playerLocation === 'REMOTE' && p.parcel.location === 'PLAYER' ? null : '须本人已携同一原包抵达异星，在当前原标记前亲读一次。';
  if (c.type === 'RETURN_LOCAL') return c.caseId === 'symbolic-transit' && a.departed && !a.returnedLocal && a.returnMarkerChecked && p.returnMarkerRead && p.playerLocation === 'REMOTE' && p.parcel.location === 'PLAYER' && p.kits['symbolic-transit'].status === 'PLAYER' && p.kits['symbolic-transit'].protectionSeconds >= 10 ? null : '本人、原包与本次护具须仍在异星，已现场亲读原回程标记，且保留10秒防护；回程另付8灵性。';
  if (c.type === 'CLEANUP') return c.caseId === 'withdrawn-transit' && a.performed && !a.permissionWithdrawn ? '先读取玛拉当前撤回的决定，再普通收尾；付费后也不能越过她的许可。' : null;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return physicalCleanupBlock(l) ?? (a.inspected ? null : '先核实这次真实结果；中止也须如实记录。');
  if (c.type === 'STOP') return p.effect.mode !== 'OFF' || a.performed && a.spiritualitySpent > 0 && !a.effectStopped ? null : '本次没有尚待停止的作用；不会重复退款或移动原物。';
  if (c.type === 'RETURN_PARCEL') return p.playerLocation === 'ENTRY' && p.parcel.location === 'PLAYER' && inactive(l) ? null : '须本人带同一原包真实回到本地入口，停止作用后亲手放回原架。';
  if (c.type === 'ARCHIVE_KIT') return transit && p.kits[c.caseId as PlaneswalkerKitCaseId].status === 'PLAYER' && p.playerLocation === 'ENTRY' && p.parcel.location === 'ENTRY_STAND' && inactive(l) ? null : '须已经实际返回本地、停止并放回原包，才能归档这套实购护具。';
  if (c.type === 'CLOSE_DOOR' || c.type === 'UNBLOCK_DOOR') return p.playerLocation === 'ENTRY' && inactive(l) && a.doorOperations < 8 && p.door.state === (c.type === 'CLOSE_DOOR' ? 'OPEN' : 'BLOCKED') ? null : '须已停止作用并在本地入口，才能实走到遮门边处理原门。';
  if (c.type === 'WAIT_10') return a.performed && a.waits < 2 ? null : '本地实施后每案最多实等两次10秒；等待不会续窗或补充原物。';
  if (c.type === 'INSPECT') return !a.inspected && !physicalCleanupBlock(l) && (c.caseId !== 'withdrawn-transit' || !a.performed || a.permissionWithdrawn) ? null : '须先完成真实收尾；末案付费实施后还须读到她当前撤回的决定。';
  if (a.inspected) return '本案已核实，请结束接触并报告。';
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'DECLINE_OPERATOR') return a.operatorConsent === 'UNASKED' && !a.performed && p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' ? null : '须在入口当面询问本案许可，不能沿用上案同意。';
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'withdrawn-transit' && a.performed && !a.permissionWithdrawn && allowed(l, week) && p.playerLocation === 'ENTRY' ? null : '先实付本次准备与实施费用，再当面读取玛拉撤回协调许可的决定；不能出发。';
  if (!allowed(l, week)) return '玛拉尚未同意本案，或当前许可已撤回；仍可停止并普通收尾。';
  if (c.type === 'BUY_KIT') return transit && !a.performed && p.playerLocation === 'ENTRY' && p.kits[c.caseId as PlaneswalkerKitCaseId].status === 'SUPPLIER' ? null : '本案只能实购这套独立路线护具一次；不用旧漫游者护具，也不重填归档余量。';
  if (c.type === 'CHECK_ENDPOINTS') return transit && !a.performed && !a.endpointsChecked && p.playerLocation === 'ENTRY' && inactive(l) && p.verifiedEndpoint !== null ? null : '须施术前在本地核读此前本人已实访的原坐标与当前生活舱信号；这不是一次免费异星出行。';
  if (c.type === 'TAKE_PARCEL') return transit && !a.performed && a.endpointsChecked && p.playerLocation === 'ENTRY' && p.parcel.location === 'ENTRY_STAND' && !a.parcelTaken ? null : '先核读本次端点，再从本地原架亲手拿起自己的同一原包。';
  if (c.type === 'READ_PATTERN') return !transit && !a.performed && !a.patternRead && !p.lamp.patternKnown && p.lamp.oilRemaining > 0 && p.playerLocation === 'ENTRY' && inactive(l) ? null : '须本人在场、尚未施术，亲自走近这盏原灯看一次三环光纹；原灯只展示一次并真实耗油。';
  if (c.type === 'OPEN_DOOR' || c.type === 'BLOCK_DOOR') return !a.performed && p.playerLocation === 'ENTRY' && inactive(l) && a.doorOperations < 8 && p.door.state === 'CLOSED' ? null : '须尚未施术且站在本地入口，再实走到原遮门边打开或闩住。';
  if (c.type === 'PERFORM') {
    if (r.status !== 'PREPARED' || a.performed || p.playerLocation !== 'ENTRY' || p.operatorLocation !== 'ENTRY' || !inactive(l) || p.operatorEnergy < 2) return '每案只实施一次，须两人仍在本地入口、没有旧作用，玛拉至少保留2精力协调。';
    if (!transit) return a.patternRead && p.lamp.patternKnown && p.lamp.shows === 1 ? null : '先本人亲见并理解原油灯的三环光纹，不能复制未知式样。';
    return a.endpointsChecked && p.parcel.location === 'PLAYER' && p.kits[c.caseId as PlaneswalkerKitCaseId].status === 'PLAYER' && p.kits[c.caseId as PlaneswalkerKitCaseId].protectionSeconds >= 20 ? null : '须已核读真实端点、拿起同一原包并实购本案护具，保留至少20秒往返防护。';
  }
  if (c.type === 'DEPART') return c.caseId === 'symbolic-transit' && a.performed && !a.departed && a.method === 'ABILITY' && p.playerLocation === 'ENTRY' && p.parcel.location === 'PLAYER' &&
    p.door.state === 'OPEN' && p.kits['symbolic-transit'].status === 'PLAYER' && p.kits['symbolic-transit'].protectionSeconds >= 20 && p.effect.mode === 'TRANSIT' && p.effect.expiresAt !== null && p.effect.expiresAt - p.elapsedSeconds >= 10 ? null : '仅首案当前许可与端点有效、原门打开且窗口还够10秒，才能携同一原包真实出发；失败、过期、门闩或末案撤回都不能通行。';
  if (c.type === 'APPLY_PATTERN') return !transit && a.performed && !a.patternApplied && a.method === 'ABILITY' && p.lamp.patternKnown && p.playerLocation === 'ENTRY' && p.door.state === 'OPEN' && p.effect.mode === 'PATTERN' && p.effect.expiresAt !== null && p.effect.expiresAt - p.elapsedSeconds >= 4 ? null : '须已理解原灯三环光纹，原遮门确实打开，成功窗口还够4秒，才能在同一原屏完成短暂光纹比对。';
  if (c.type === 'MANUAL_COMPARE') return a.performed && !a.manualComparison && inactive(l) && p.playerLocation === 'ENTRY' && (transit ? a.endpointsChecked : a.patternRead) ? null : '须停止作用，在本地对照自己实读的原记录；普通比对不生成光纹或异星旅行，也不增加技巧掌握。';
  return '当前阶段不能进行这一步。';
}
function commandCost(l: PlaneswalkerLifeState, c: PlaneswalkerActivityCommand) {
  const actions = ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0;
  const spirituality = c.type === 'RETURN_LOCAL' ? 8 : c.type === 'PERFORM' && l.cases[c.caseId].method === 'ABILITY' ? c.caseId === 'pattern-reproduction' ? 7 : 8 : 0;
  return { actions, spirituality, pennies: c.type === 'BUY_KIT' ? 20 : 0, pollution: c.type === 'DEPART' || c.type === 'RETURN_LOCAL' ? 1 : 0 };
}
function requiredSpirituality(l: PlaneswalkerLifeState, c: PlaneswalkerActivityCommand): number {
  if (c.type === 'PREPARE' && c.caseId !== 'pattern-reproduction' && c.method === 'ABILITY' || c.type === 'PERFORM' && c.caseId !== 'pattern-reproduction' && l.cases[c.caseId].method === 'ABILITY') return 24;
  if (c.type === 'DEPART') return 16;
  return commandCost(l, c).spirituality;
}
export function blockPlaneswalkerLife(s: SliceState, c: PlaneswalkerActivityCommand): string | null {
  if (!validatePlaneswalkerActivityCommand(c)) return '旅法师生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着，且已经真实晋升旅法师·门序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '本次出行从贝克兰德通行室开始；异星期间须按现场原标记真实返回。';
  if (hasWandererLifeLock(s) || hasPlaneswalkerRitualLock(s) || s.wanderer.preparedWeek !== null || s.planeswalker.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.wanderer.encounter.status)) return '先收束旧原现场、远行和服药准备，不能覆盖历史位置。';
  if (s.planeswalker.encounter.status !== 'AVAILABLE') return '同一现场已有后续遭遇，不能重开三案或重置原物。';
  if (endpoint(s) === null) return '须已本人实访并复核灯原聚居点，九处实际履历完整，原生活舱与回程标记仍有效。';
  const l = s.planeswalker.life, reason = localBlock(l, c, s.week); if (reason) return reason;
  const cost = commandCost(l, c), minimum = requiredSpirituality(l, c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备须另留1行动实施，已开放现场的停止、真实返程和收尾为0行动。';
  if (cost.spirituality > 0 && s.mind <= 0) return '当前精神不足以施术；本地仍能停止并普通收尾。';
  if (s.spirituality < minimum) return `本次须至少${minimum}灵性，含真实返程所需余量；当前不足。`;
  return s.cash < cost.pennies ? '这套独立路线护具须实付20便士；不能赊取或重填旧物。' : null;
}
export const blockPlaneswalkerActivity = blockPlaneswalkerLife;
function elapse(l: PlaneswalkerLifeState, a: PlaneswalkerAttempt, seconds: number): void {
  advancePlaneswalkerTime(l.site, seconds); a.elapsedSeconds += seconds;
  if (a.window === 'ACTIVE' && a.windowExpiresAt !== null && l.site.elapsedSeconds >= a.windowExpiresAt) a.window = 'EXPIRED';
}
function walkPlayer(l: PlaneswalkerLifeState, a: PlaneswalkerAttempt, to: PlaneswalkerLocalLocation): void {
  const p = l.site; if (p.playerLocation === 'REMOTE') throw new Error('异星不能以本地步行返回。');
  const from = p.playerLocation, metres = Math.abs(PLANESWALKER_POSITION_METRES[from] - PLANESWALKER_POSITION_METRES[to]);
  p.playerLocation = to; p.playerMetres += metres; a.playerTravelMetres += metres;
  if (p.parcel.location === 'PLAYER') p.parcel.ordinaryMetres += metres;
  a.moves.push({ from, to, mode: 'WALK', metres, seconds: metres, originalBody: true, parcelId: p.parcel.location === 'PLAYER' ? p.parcel.id : null, kitId: null });
  elapse(l, a, metres);
}
function doorTrip(l: PlaneswalkerLifeState, a: PlaneswalkerAttempt, state: PlaneswalkerSiteState['door']['state']): void {
  walkPlayer(l, a, 'NEAR'); elapse(l, a, 2); l.site.door.state = state; l.site.door.operations++; a.doorOperations++; walkPlayer(l, a, 'ENTRY');
}
function stop(l: PlaneswalkerLifeState, a: PlaneswalkerAttempt): void {
  stopPlaneswalkerEffects(l.site); a.effectStopped = true; if (a.abilityTier !== null) a.window = 'STOPPED';
}
function archiveKit(l: PlaneswalkerLifeState, a: PlaneswalkerAttempt, id: PlaneswalkerKitCaseId, week: number): void {
  const k = l.site.kits[id]; k.status = 'ARCHIVED'; k.archivedWeek = week; a.kitArchived = true; elapse(l, a, 2);
}
function closeContact(l: PlaneswalkerLifeState, r: PlaneswalkerCaseState, a: PlaneswalkerAttempt, week: number, withdrawn: boolean): void {
  a.closed = true; a.interrupted = !a.performed || a.appliedAbilityIds.length === 0 && !a.manualComparison;
  if (a.operatorConsent !== 'WITHDRAWN') a.operatorConsent = l.site.operatorConsent = 'CLOSED';
  if (a.operatorConsentWeek === null) a.operatorConsentWeek = l.site.operatorConsentWeek = week;
  r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (withdrawn) r.withdrawals++;
  elapse(l, a, 2); a.siteAtClose = structuredClone(l.site); l.activeCase = null;
}
function inspect(l: PlaneswalkerLifeState, r: PlaneswalkerCaseState, a: PlaneswalkerAttempt): void {
  a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, a, 2);
}
function checkSource(l: PlaneswalkerLifeState, c: PlaneswalkerActivityCommand, baseAbility: number): PlaneswalkerCheckSource | null {
  if (c.type !== 'PERFORM' || l.cases[c.caseId].method !== 'ABILITY') return null;
  const pattern = c.caseId === 'pattern-reproduction';
  return { caseId: c.caseId, abilityId: pattern ? 'door.s2.pattern-reproduction' : 'door.s2.symbolic-transit', cost: pattern ? 7 : 8,
    at: l.site.elapsedSeconds, coreStat: 'knowledge', baseAbility, operatorConsentWeek: l.site.operatorConsentWeek!, site: structuredClone(l.site) };
}
/** Pure ordered reducer. The journal is the only source of new applications, fees and physical moves. */
function evolve(l: PlaneswalkerLifeState, c: PlaneswalkerActivityCommand, week: number, date: PublicGameDate, remote: PlaneswalkerVerifiedEndpoint, tier: PublicResolutionTier | null, pollutionAdded: number): void {
  const p = l.site;
  if (c.type === 'REFLECT') { l.reflected = true; advancePlaneswalkerTime(p, 10); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') {
    if (p.introducedWeek === null) {
      p.introducedWeek = week; p.introducedDate = structuredClone(date); p.verifiedEndpoint = structuredClone(remote);
      // The same original body surveys the visible two- and six-metre pads, then returns. No astral leg is implied.
      p.playerLocation = 'NEAR'; p.playerMetres += 2; advancePlaneswalkerTime(p, 2);
      p.door.state = 'OPEN'; p.door.operations++; advancePlaneswalkerTime(p, 2);
      p.playerLocation = 'FAR'; p.playerMetres += 4; advancePlaneswalkerTime(p, 4);
      p.playerLocation = 'NEAR'; p.playerMetres += 4; advancePlaneswalkerTime(p, 4);
      p.door.state = 'CLOSED'; p.door.operations++; advancePlaneswalkerTime(p, 2);
      p.playerLocation = 'ENTRY'; p.playerMetres += 2; advancePlaneswalkerTime(p, 2); p.localPadsKnown = true;
    }
    r.status = 'OBSERVED'; r.observedWeek = week; advancePlaneswalkerTime(p, 4); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations++; r.contactOpen = true; l.activeCase = c.caseId;
    const a = freshAttempt(week, c.method, p); r.attempts.push(a); p.operatorConsent = 'UNASKED'; p.operatorConsentWeek = null;
    if (c.caseId !== 'pattern-reproduction') p.returnMarkerRead = false;
    elapse(l, a, 4); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; advancePlaneswalkerTime(p, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { closeContact(l, r, a, week, c.type === 'WITHDRAW'); return; }
  switch (c.type) {
    case 'CONSENT_OPERATOR': case 'DECLINE_OPERATOR': a.operatorConsent = p.operatorConsent = c.type === 'CONSENT_OPERATOR' ? 'GRANTED' : 'DECLINED'; a.operatorConsentWeek = p.operatorConsentWeek = week; elapse(l, a, 2); break;
    case 'BUY_KIT': { const k = p.kits[c.caseId as PlaneswalkerKitCaseId]; k.status = 'PLAYER'; k.purchasedWeek = week; k.paidPennies = 20; a.penniesSpent += 20; elapse(l, a, 2); break; }
    case 'CHECK_ENDPOINTS': a.endpointsChecked = true; elapse(l, a, 4); break;
    case 'TAKE_PARCEL': p.parcel.location = 'PLAYER'; a.parcelTaken = true; elapse(l, a, 2); break;
    case 'RETURN_PARCEL': p.parcel.location = 'ENTRY_STAND'; a.parcelReturned = true; elapse(l, a, 2); break;
    case 'ARCHIVE_KIT': archiveKit(l, a, c.caseId as PlaneswalkerKitCaseId, week); break;
    case 'READ_PATTERN': walkPlayer(l, a, 'NEAR'); p.lamp.oilRemaining--; p.lamp.shows++; p.lamp.patternKnown = true; a.patternRead = true; elapse(l, a, 4); walkPlayer(l, a, 'ENTRY'); break;
    case 'OPEN_DOOR': doorTrip(l, a, 'OPEN'); break;
    case 'CLOSE_DOOR': case 'UNBLOCK_DOOR': doorTrip(l, a, 'CLOSED'); break;
    case 'BLOCK_DOOR': doorTrip(l, a, 'BLOCKED'); break;
    case 'PERFORM': {
      a.performed = true; r.status = 'ACTIVE'; p.operatorEnergy -= 2; a.operatorEnergySpent += 2;
      if (a.method === 'ABILITY') {
        a.spiritualitySpent += c.caseId === 'pattern-reproduction' ? 7 : 8; elapse(l, a, 10); a.abilityTier = tier; a.window = success(tier) ? 'ACTIVE' : 'FAILED';
        if (success(tier)) { a.windowExpiresAt = p.elapsedSeconds + 20; p.effect = { mode: c.caseId === 'pattern-reproduction' ? 'PATTERN' : 'TRANSIT', expiresAt: a.windowExpiresAt }; }
      } else elapse(l, a, 4);
      break;
    }
    case 'DEPART': case 'RETURN_LOCAL': {
      const outbound = c.type === 'DEPART', k = p.kits['symbolic-transit'], from = p.playerLocation, to = outbound ? 'REMOTE' : 'ENTRY';
      p.playerLocation = to; p.playerAstralLegs++; p.parcel.astralLegs++; a.playerAstralLegs++;
      k.astralLegs++; k.protectionSeconds -= 10; a.protectionSpent += 10; a.pollutionAdded += pollutionAdded;
      a.moves.push({ from, to, mode: 'ASTRAL', metres: null, seconds: 10, originalBody: true, parcelId: p.parcel.id, kitId: k.id });
      if (outbound) { a.departed = true; p.returnMarkerRead = false; a.appliedAbilityIds.push('door.s2.symbolic-transit'); }
      else { a.returnedLocal = true; a.spiritualitySpent += 8; }
      elapse(l, a, 10); break;
    }
    case 'READ_RETURN_MARKER': a.returnMarkerChecked = p.returnMarkerRead = true; elapse(l, a, 4); break;
    case 'APPLY_PATTERN': a.patternApplied = true; p.screen.state = 'MATCHED'; p.screen.applications++; a.appliedAbilityIds.push('door.s2.pattern-reproduction'); elapse(l, a, 4); break;
    case 'MANUAL_COMPARE': a.manualComparison = true; elapse(l, a, 8); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.operatorConsent = p.operatorConsent = 'WITHDRAWN'; elapse(l, a, 1); break;
    case 'STOP': stop(l, a); break;
    case 'WAIT_10': a.waits++; elapse(l, a, 10); break;
    case 'INSPECT': inspect(l, r, a); break;
    case 'CLEANUP': {
      stop(l, a);
      if (p.playerLocation !== 'ENTRY') walkPlayer(l, a, 'ENTRY');
      if (p.parcel.location === 'PLAYER') { p.parcel.location = 'ENTRY_STAND'; a.parcelReturned = true; elapse(l, a, 2); }
      if (p.operatorLocation !== 'ENTRY') { const metres = Math.abs(PLANESWALKER_POSITION_METRES[p.operatorLocation]); p.operatorLocation = 'ENTRY'; p.operatorMetres += metres; elapse(l, a, metres); }
      if (p.door.state !== 'CLOSED') doorTrip(l, a, 'CLOSED');
      if (c.caseId !== 'pattern-reproduction' && p.kits[c.caseId].status === 'PLAYER') archiveKit(l, a, c.caseId, week);
      if (!a.inspected) inspect(l, r, a);
      closeContact(l, r, a, week, !a.performed); break;
    }
  }
}
const budget = (s: SliceState): PlaneswalkerLifeBudget => ({ actions: s.actionsRemaining, spirituality: s.spirituality, cash: s.cash, health: s.health, mind: s.mind, pollution: s.seer.pollution });
export function applyPlaneswalkerActivity(s: SliceState, c: PlaneswalkerActivityCommand, ctx: SeerContext): void {
  const reason = blockPlaneswalkerLife(s, c); if (reason) throw new Error(reason);
  const l = s.planeswalker.life, remote = endpoint(s)!, source = checkSource(l, c, s.character.coreStats.knowledge), paid = commandCost(l, c), before = budget(s), randomBefore = s.random.cursor;
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null;
  s.actionsRemaining -= paid.actions; s.spirituality -= paid.spirituality; s.cash -= paid.pennies; s.seer.pollution = Math.min(100, s.seer.pollution + paid.pollution);
  if (source) { check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; }
  const after = budget(s);
  evolve(l, c, s.week, s.date, remote, tier, after.pollution - before.pollution);
  l.journal.push({ week: s.week, date: structuredClone(s.date), endpoint: structuredClone(remote), command: structuredClone(c), tier,
    randomBefore, randomAfter: s.random.cursor, check, source, paid, before, after });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const a = current(l) ?? ('caseId' in c ? l.cases[c.caseId].attempts.at(-1) : null), p = l.site;
  ctx.note(`通行室：${LABELS[c.type]}`, `${tier ? `本次检定${TIER_LABELS[tier]}；成功尚须实际应用。` : ''}你在${LOCATION_LABELS[p.playerLocation]}，同一原包在${PARCEL_LABELS[p.parcel.location]}。玛拉仍在${LOCATION_LABELS[p.operatorLocation]}，精力${p.operatorEnergy}。原灯油余${p.lamp.oilRemaining}份，已实际完成${p.screen.applications}次屏上比对。${a ? `本案实耗${a.spiritualitySpent}灵性、${a.penniesSpent}便士、${a.protectionSpent}秒防护、${a.elapsedSeconds}秒，实际异星通行${a.playerAstralLegs}程，增加污染${a.pollutionAdded}。` : ''}`);
}
export const applyPlaneswalkerLife = applyPlaneswalkerActivity;
const LOCATION_LABELS: Record<PlaneswalkerLocation, string> = { ENTRY: '本地入口', NEAR: '本地2米原台', FAR: '本地6米原台', OUTSIDE: '本地室外', REMOTE: '异星灯原聚居点的封闭生活舱' };
const PARCEL_LABELS: Record<PlaneswalkerSiteState['parcel']['location'], string> = { ENTRY_STAND: '本地原架', PLAYER: '本人手中', REMOTE_STAND: '异星原架' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const CONSENT_LABELS: Record<PlaneswalkerConsent, string> = { UNASKED: '尚未询问', GRANTED: '本次同意', DECLINED: '本次拒绝', WITHDRAWN: '当前撤回', CLOSED: '本次接触已结束' };
const LABELS: Record<string, string> = {
  OBSERVE: '当面观察原现场与实际端点', PREPARE: '准备本次实践', PERFORM: '支付成本并实施一次', REPORT: '如实报告这一次结果', REFLECT: '反思三案与真实返程',
  CONSENT_OPERATOR: '当面询问并记录本案同意', DECLINE_OPERATOR: '尊重玛拉本次拒绝', BUY_KIT: '实付20便士购入本案独立路线护具',
  CHECK_ENDPOINTS: '核读本人已实访的原坐标与当前舱讯', TAKE_PARCEL: '从本地原架拿起自己的同一原包',
  DEPART: '在窗口内让本人携同一原包实际抵达异星', READ_RETURN_MARKER: '在异星现场亲读当前原回程标记', RETURN_LOCAL: '另付8灵性，携原包实际返回本地',
  RETURN_PARCEL: '停止后把同一原包放回本地原架', ARCHIVE_KIT: '归档本案原护具并保留实际余量', READ_PATTERN: '亲自走近原灯，耗油观看并理解三环光纹',
  OPEN_DOOR: '实走到遮门边打开原门，再走回', CLOSE_DOOR: '实走到遮门边关闭原门，再走回', BLOCK_DOOR: '实走到遮门边放下原闩，再走回', UNBLOCK_DOOR: '实走到遮门边解除原闩并关好，再走回',
  APPLY_PATTERN: '用4秒把已理解的三环短暂光纹投到原屏', MANUAL_COMPARE: '停止后人工核对已有原记录', WITHDRAW_PERMISSION: '读取玛拉当前撤回协调许可的决定',
  STOP: '明确停止自己的作用', WAIT_10: '在本地实际等10秒', INSPECT: '核实真实结果与收尾', CLEANUP: '停止并沿本地普通路归物、关门、归档护具，结束接触',
  LEAVE: '从普通入口结束已收束的接触', CLOSE: '结束已收束的接触', WITHDRAW: '如实结束已收束的准备或接触',
};
const COSTS: Partial<Record<string, string>> = {
  OBSERVE: '1行动 · 初次实走12米、检查4秒、原门开关4秒；以后观察4秒', PREPARE: '1行动 · 4秒 · 须另留1行动实施',
  CONSENT_OPERATOR: '0行动 · 2秒 · 仅限本案本周', DECLINE_OPERATOR: '0行动 · 2秒', BUY_KIT: '0行动 · 20便士 · 2秒 · 独立原护具90秒且不退款',
  CHECK_ENDPOINTS: '0行动 · 4秒 · 核读已实访记录，不发生出行', TAKE_PARCEL: '0行动 · 2秒 · 同一原件转到本人手中',
  DEPART: '0行动 · 实际异星出程10秒 · 原防护−10秒、污染+1 · 须余16灵性供返程和余量', READ_RETURN_MARKER: '0行动 · 异星现场亲读4秒',
  RETURN_LOCAL: '0行动 · 8灵性 · 实际返程10秒 · 原防护−10秒、污染+1', RETURN_PARCEL: '0行动 · 2秒 · 原件放回，不生成副本',
  ARCHIVE_KIT: '0行动 · 2秒 · 原余量保留，费用不退', READ_PATTERN: '0行动 · 本人普通往返4米、观察4秒 · 原灯油−1 · 全场仅一次',
  OPEN_DOOR: '0行动 · 普通往返4米、操作2秒', CLOSE_DOOR: '0行动 · 普通往返4米、操作2秒', BLOCK_DOOR: '0行动 · 普通往返4米、操作2秒', UNBLOCK_DOOR: '0行动 · 普通往返4米、操作2秒',
  APPLY_PATTERN: '0行动 · 4秒 · 已知三环光纹短时比对，不制造物质', MANUAL_COMPARE: '0行动 · 8秒 · 不施术、不旅行、不增加掌握',
  WITHDRAW_PERMISSION: '0行动 · 1秒 · 不能出发、不退款', STOP: '0行动0秒 · 不退款、不移人或归物', WAIT_10: '0行动 · 10秒 · 不续窗', INSPECT: '0行动 · 核实2秒',
  CLEANUP: '0行动 · 按本人真实本地位置计步计时，归物/门/护具各实耗2秒 · 不能替代异星返程',
  LEAVE: '0行动 · 结束接触2秒 · 须已实际收尾', CLOSE: '0行动 · 结束接触2秒', WITHDRAW: '0行动 · 结束接触2秒 · 不退款',
  REPORT: '1行动 · 4秒 · 扮演25 · 仅实际应用的对应技巧+8', REFLECT: '1行动 · 10秒 · 三份报告后扮演25',
};
export function planeswalkerLifeActions(s: SliceState): PlaneswalkerLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.planeswalker.life, out: PlaneswalkerLifeAction[] = [];
  const add = (command: PlaneswalkerActivityCommand) => {
    const reason = blockPlaneswalkerLife(s, command), id = 'caseId' in command ? command.caseId : null;
    let cost = COSTS[command.type] ?? '0行动';
    if (command.type === 'PREPARE' && command.method === 'ABILITY' && command.caseId !== 'pattern-reproduction') cost += ' · 至少24灵性，保留真实返程预算';
    if (command.type === 'PERFORM' && id) cost = l.cases[id].method === 'ABILITY'
      ? `1行动 · ${id === 'pattern-reproduction' ? '7灵性' : '8灵性，施术前须至少24灵性'} · 知识20 · 施术10秒 · 成功开20秒窗口 · 玛拉精力−2`
      : '1行动 · 普通检查4秒 · 玛拉精力−2 · 不施术、不增加新技巧掌握';
    out.push({ id: `PW2:${id ?? 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}`, label: `${LABELS[command.type]}${'method' in command ? command.method === 'ABILITY' ? '（有限能力）' : '（普通方法）' : ''}`, cost, enabled: reason === null, reason, command });
  };
  for (const caseId of PLANESWALKER_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add({ type: 'PREPARE', caseId, method });
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    if (r.status === 'PREPARED') add({ type: 'PERFORM', caseId });
    for (const type of STEPS) {
      if (caseId === 'pattern-reproduction' && ['BUY_KIT', 'CHECK_ENDPOINTS', 'TAKE_PARCEL', 'DEPART', 'READ_RETURN_MARKER', 'RETURN_LOCAL', 'RETURN_PARCEL', 'ARCHIVE_KIT', 'WITHDRAW_PERMISSION'].includes(type)) continue;
      if (caseId !== 'pattern-reproduction' && ['READ_PATTERN', 'APPLY_PATTERN'].includes(type)) continue;
      if (caseId !== 'symbolic-transit' && ['DEPART', 'READ_RETURN_MARKER', 'RETURN_LOCAL'].includes(type)) continue;
      if (caseId !== 'withdrawn-transit' && type === 'WITHDRAW_PERMISSION') continue;
      if (r.method === 'ORDINARY' && ['DEPART', 'APPLY_PATTERN', 'READ_RETURN_MARKER', 'RETURN_LOCAL'].includes(type)) continue;
      add({ type, caseId });
    }
    add({ type: 'LEAVE', caseId });
  }
  if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
/** Positive public copies keep known physical facts, never future replay fields. */
const publicPlaneswalkerDate = (d: PublicGameDate): PublicGameDate => ({ epoch: d.epoch, year: d.year, month: d.month, day: d.day });
const publicPlaneswalkerEndpoint = (e: PlaneswalkerVerifiedEndpoint): PlaneswalkerVerifiedEndpoint => ({
  planetId: e.planetId, siteId: e.siteId, title: e.title, coordinateId: e.coordinateId, returnMarkerId: e.returnMarkerId, qualifiedWeek: e.qualifiedWeek,
});
const publicPlaneswalkerKit = (k: PlaneswalkerSiteState['kits'][PlaneswalkerKitCaseId]) => ({
  id: k.id, source: k.source, caseId: k.caseId, pricePennies: k.pricePennies, status: k.status, purchasedWeek: k.purchasedWeek,
  archivedWeek: k.archivedWeek, paidPennies: k.paidPennies, initialProtectionSeconds: k.initialProtectionSeconds,
  protectionSeconds: k.protectionSeconds, astralLegs: k.astralLegs,
});
export function projectPlaneswalkerSite(p: PlaneswalkerSiteState): PlaneswalkerSiteState { return {
  id: p.id, localMarkerId: p.localMarkerId, elapsedSeconds: p.elapsedSeconds, ordinaryExit: p.ordinaryExit,
  introducedWeek: p.introducedWeek, introducedDate: p.introducedDate ? publicPlaneswalkerDate(p.introducedDate) : null,
  playerLocation: p.playerLocation, playerMetres: p.playerMetres, playerAstralLegs: p.playerAstralLegs,
  operatorId: p.operatorId, operatorName: p.operatorName, operatorAge: p.operatorAge, operatorLocation: p.operatorLocation,
  operatorMetres: p.operatorMetres, operatorEnergy: p.operatorEnergy, operatorConsent: p.operatorConsent, operatorConsentWeek: p.operatorConsentWeek,
  door: { id: p.door.id, state: p.door.state, operations: p.door.operations },
  parcel: { id: p.parcel.id, owner: p.parcel.owner, quantity: p.parcel.quantity, location: p.parcel.location, ordinaryMetres: p.parcel.ordinaryMetres, astralLegs: p.parcel.astralLegs },
  lamp: { id: p.lamp.id, oilRemaining: p.lamp.oilRemaining, patternKnown: p.lamp.patternKnown, shows: p.lamp.shows },
  screen: { id: p.screen.id, state: p.screen.state, applications: p.screen.applications },
  effect: { mode: p.effect.mode, expiresAt: p.effect.expiresAt },
  verifiedEndpoint: p.verifiedEndpoint ? publicPlaneswalkerEndpoint(p.verifiedEndpoint) : null,
  returnMarkerRead: p.returnMarkerRead, localPadsKnown: p.localPadsKnown,
  kits: { 'symbolic-transit': publicPlaneswalkerKit(p.kits['symbolic-transit']), 'withdrawn-transit': publicPlaneswalkerKit(p.kits['withdrawn-transit']) },
}; }
export function projectPlaneswalkerAttempt(a: PlaneswalkerAttempt): PlaneswalkerAttempt { return {
  week: a.week, method: a.method, closed: a.closed, result: a.result, performed: a.performed, interrupted: a.interrupted, inspected: a.inspected,
  elapsedSeconds: a.elapsedSeconds, spiritualitySpent: a.spiritualitySpent, penniesSpent: a.penniesSpent, pollutionAdded: a.pollutionAdded,
  protectionSpent: a.protectionSpent, playerTravelMetres: a.playerTravelMetres, playerAstralLegs: a.playerAstralLegs, operatorEnergySpent: a.operatorEnergySpent,
  operatorConsent: a.operatorConsent, operatorConsentWeek: a.operatorConsentWeek, endpointsChecked: a.endpointsChecked, patternRead: a.patternRead,
  parcelTaken: a.parcelTaken, departed: a.departed, returnMarkerChecked: a.returnMarkerChecked, returnedLocal: a.returnedLocal,
  parcelReturned: a.parcelReturned, kitArchived: a.kitArchived, patternApplied: a.patternApplied, manualComparison: a.manualComparison,
  permissionWithdrawn: a.permissionWithdrawn, effectStopped: a.effectStopped, waits: a.waits, doorOperations: a.doorOperations,
  abilityTier: a.abilityTier, window: a.window, windowExpiresAt: a.windowExpiresAt, appliedAbilityIds: [...a.appliedAbilityIds],
  moves: a.moves.map(m => ({ from: m.from, to: m.to, mode: m.mode, metres: m.metres, seconds: m.seconds, originalBody: m.originalBody, parcelId: m.parcelId, kitId: m.kitId })),
  siteAtStart: projectPlaneswalkerSite(a.siteAtStart), siteAtClose: a.siteAtClose ? projectPlaneswalkerSite(a.siteAtClose) : null,
}; }

export function projectPlaneswalkerLife(s: SliceState): PlaneswalkerLifeProjection {
  const l = s.planeswalker.life, p = l.site;
  return { title: '通行室中的真实远行与三环光纹', story: PLANESWALKER_LIFE_STORY,
    environment: '通行室入口就是此前本地路线台原回程标记的位置；原标记没有搬迁。本地入口0米、近台2米、远台6米，普通出口在入口外2米；第一次观察会亲自实走两台并返回。玛拉42岁，是同一位当地协调人。异星灯原聚居点是此前本人已两次实访并核实当地传说的真实地点，绝不是这条本地米线的另一端。那里的原封闭生活舱提供有限正常呼吸，不提供真空或污染免疫。原包始终属于本人、只有一件；原灯有3份灯油，亲见光纹消耗1份且只展示一次。原屏保留已完成比对的记录，光纹作用停止后不会永久发光。',
    activeCase: l.activeCase, inside: hasPlaneswalkerLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected,
    site: projectPlaneswalkerSite(p), clockSeconds: p.elapsedSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerMetres, playerAstralLegs: p.playerAstralLegs,
    currentAttempt: current(l) ? projectPlaneswalkerAttempt(current(l)!) : null, sitePhase: s.planeswalker.encounter.status === 'AVAILABLE' ? 'LIFE' : 'ENCOUNTER',
    cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { id: d.id, title: d.title, story: d.story,
      observations: a ? [`本案实际${a.elapsedSeconds}秒，实耗${a.spiritualitySpent}灵性、${a.penniesSpent}便士、${a.protectionSpent}秒防护，污染增加${a.pollutionAdded}。`,
        `本人普通走${a.playerTravelMetres}米，异星实际通行${a.playerAstralLegs}程；玛拉始终是本地原协调人，实际消耗${a.operatorEnergySpent}精力。当前许可：${CONSENT_LABELS[a.operatorConsent]}。`,
        ...(a.abilityTier ? [`检定${TIER_LABELS[a.abilityTier]}，实际应用${a.appliedAbilityIds.length}项；窗口未使用、失败、过期或撤回不冒充应用。`] : []),
        ...(a.departed ? [a.returnedLocal ? '同一身体与原包已经使用当前原回程标记，另付8灵性真实返回。' : '本人和原包仍在异星；亲读原回程标记，再另付8灵性真实返回，不能普通退出。'] : []),
        ...(a.patternRead ? ['本人亲见同一原灯三环光纹，原灯油真实减少1份；已知记录不代表任何能力库。'] : []),
        ...(a.patternApplied ? ['已用4秒在同一原屏完成短暂光纹比对，留下应用记录；停止后不永久发光。'] : []),
        ...(a.permissionWithdrawn ? ['玛拉在支付本次费用后撤回协调许可，本案没有出发，不退费用，也不增加通行掌握。'] : [])] : [],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '技巧真实应用后完成了停止、原物收尾与必要的付费返程。' : '按普通方法或中止结果如实收尾，没有把未应用的成功算作掌握。',
      contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(projectPlaneswalkerAttempt) }; }), actions: planeswalkerLifeActions(s) };
}
function validBudget(v: unknown): v is PlaneswalkerLifeBudget {
  return record(v) && shape(v, ['actions', 'spirituality', 'cash', 'health', 'mind', 'pollution']) && integer(v.actions) && integer(v.spirituality, 0, 120) &&
    integer(v.cash) && integer(v.health, 1, 100) && integer(v.mind, 0, 100) && integer(v.pollution, 0, 100);
}
/** Ordered replay proves every source, consent, fee, window, original-body move and reward. */
export function validatePlaneswalkerLife(s: SliceState): boolean {
  try {
    const l = s.planeswalker?.life, promotion = s.planeswalker?.promotionWeek, expected = createPlaneswalkerLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !Array.isArray(l.journal) || l.journal.length > 400 || !validatePlaneswalkerSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week)) return false;
    const remote = endpoint(s); if (!remote || remote.qualifiedWeek > promotion) return false;
    let lastWeek = promotion, nextCursor = 0, previous: PlaneswalkerLifeEvent | null = null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'endpoint', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'paid', 'before', 'after']) ||
        !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        previous && compareGameDates(raw.date, previous.date) < 0 || !same(raw.endpoint, remote) || !validatePlaneswalkerActivityCommand(raw.command)) return false;
      const e = raw as unknown as PlaneswalkerLifeEvent, c = e.command, lockedBefore = contactOpen(expected);
      if (lockedBefore && (e.week !== lastWeek || previous && !same(e.date, previous.date)) || localBlock(expected, c, e.week)) return false;
      const source = checkSource(expected, c, record(e.check) && integer(e.check.baseAbility, 0, 500) ? e.check.baseAbility : 0), cost = commandCost(expected, c);
      if (!same(e.source, source) || !same(e.paid, cost) || !validBudget(e.before) || !validBudget(e.after) ||
        e.before.actions < (c.type === 'PREPARE' ? 2 : cost.actions) || e.before.spirituality < requiredSpirituality(expected, c) || e.before.cash < cost.pennies || cost.spirituality > 0 && e.before.mind <= 0 ||
        !same(e.after, { ...e.before, actions: e.before.actions - cost.actions, spirituality: e.before.spirituality - cost.spirituality, cash: e.before.cash - cost.pennies, pollution: Math.min(100, e.before.pollution + cost.pollution) })) return false;
      if (!integer(e.randomBefore, nextCursor, s.random.cursor) || !integer(e.randomAfter, e.randomBefore, s.random.cursor) ||
        lockedBefore && previous && (!same(e.before, previous.after) || e.randomBefore !== previous.randomAfter)) return false;
      if (source) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.randomAfter !== e.randomBefore + 1 || !record(e.check) || !integer(e.check.baseAbility, 0, 500)) return false;
        // Current knowledge above the ordinary training cap is fixed. Lower old checks may precede legitimate later ordinary training.
        if (promoted(s)) {
          const now = s.character.coreStats.knowledge, pinned = now > 20 || 'caseId' in c && l.activeCase === c.caseId;
          if (pinned ? source.baseAbility !== now : source.baseAbility > now) return false;
        }
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore);
        const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return false;
      } else if (e.tier !== null || e.check !== null || e.randomAfter !== e.randomBefore) return false;
      evolve(expected, c, e.week, e.date, e.endpoint, e.tier, e.after.pollution - e.before.pollution);
      if (!validatePlaneswalkerSiteState(expected.site)) return false;
      expected.journal.push(structuredClone(e)); lastWeek = e.week; nextCursor = e.randomAfter; previous = e;
    }
    const encounter = s.planeswalker.encounter;
    if (encounter.status === 'AVAILABLE') { if (!same(l, expected)) return false; }
    else {
      // Combat may change the single live site, but never rewrite one byte of the closed life journal or attempts.
      if (contactOpen(expected) || !Object.values(expected.cases).every(r => r.status === 'RESOLVED') || !expected.reflected || physicalCleanupBlock(expected) || !same(encounter.startSite, expected.site)) return false;
      if (!same({ ...l, site: expected.site }, expected)) return false;
    }
    if (l.site.introducedWeek !== null && !integer(l.site.introducedWeek, promotion, s.week)) return false;
    if (contactOpen(l) && (s.status !== 'ACTIVE' || s.health <= 0 || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || encounter.status !== 'AVAILABLE' || hasWandererLifeLock(s) || hasPlaneswalkerRitualLock(s))) return false;
    const a = current(l); if (a && a.week !== s.week) return false;
    if (contactOpen(l) && previous && (!same(previous.date, s.date) || !same(budget(s), previous.after) || s.random.cursor !== previous.randomAfter)) return false;
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['door.s2.symbolic-transit', 'door.s2.pattern-reproduction'] as const) if (s.progression.mastery[id] !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return false;
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
