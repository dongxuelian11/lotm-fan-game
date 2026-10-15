import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasJusticeMentorLifeLock } from '../justice-mentor/life.js';
import { createLightSeekerSiteState, validateLightSeekerSiteState, advanceLightSeekerTime, LIGHT_SEEKER_POSITION_METRES, type LightSeekerSiteState, type LightSeekerLocation, type LightSeekerConsent } from './resources.js';
export { createLightSeekerSiteState, validateLightSeekerSiteState, type LightSeekerSiteState, type LightSeekerLocation, type LightSeekerConsent } from './resources.js';

// Original finite game rules: a single six-metre gallery, these independent people and objects,
// paid windows, travel, fatigue and mastery are not claims about exact novel powers.
export const LIGHT_SEEKER_CASE_IDS = ['marker-path', 'screened-return', 'withdrawn-visit'] as const;
export type LightSeekerCaseId = typeof LIGHT_SEEKER_CASE_IDS[number];
export type LightSeekerLifeAbilityId = 'sun.s2.guided-radiance' | 'sun.s2.limited-light';
export type LightSeekerWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'STOPPED';
const STEPS = ['CONSENT_OPERATOR', 'DECLINE_OPERATOR', 'CONSENT_SPIRIT', 'DECLINE_SPIRIT', 'INVITE_SPIRIT', 'RETIRE_SPIRIT', 'OPEN_SHUTTER', 'CLOSE_SHUTTER', 'PLACE_COVER', 'RETURN_COVER', 'MOVE_OPERATOR_FAR', 'TRACE_MARK', 'READ_LAMP', 'PASS_OPERATOR', 'RETURN_OPERATOR', 'INSPECT_SCREEN', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_10', 'INSPECT'] as const;
export type LightSeekerActivityCommand =
  | { type: typeof STEPS[number] | 'OBSERVE' | 'PERFORM' | 'REPORT' | 'LEAVE' | 'CLOSE' | 'WITHDRAW'; caseId: LightSeekerCaseId }
  | { type: 'PREPARE'; caseId: LightSeekerCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
export interface LightSeekerAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  performed: boolean; interrupted: boolean; inspected: boolean; elapsedSeconds: number; spiritualitySpent: number;
  playerTravelMetres: number; operatorTravelMetres: number; operatorEnergySpent: number; spiritTravelMetres: number; spiritEnergySpent: number;
  operatorConsent: LightSeekerConsent; operatorConsentWeek: number | null; spiritConsent: LightSeekerConsent; spiritConsentWeek: number | null;
  opened: boolean; coverPlaced: boolean; operatorWentFar: boolean; operatorReturned: boolean;
  spiritVisited: boolean; spiritRetired: boolean; permissionWithdrawn: boolean;
  markerRead: boolean; lampRead: boolean; screenInspected: boolean; lightStopped: boolean; waits: number;
  abilityTier: PublicResolutionTier | null; window: LightSeekerWindow; windowExpiresAt: number | null;
  appliedAbilityIds: LightSeekerLifeAbilityId[]; siteAtStart: LightSeekerSiteState; siteAtClose: LightSeekerSiteState | null;
}
export interface LightSeekerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  preparations: number; closes: number; withdrawals: number; attempts: LightSeekerAttempt[];
}
export interface LightSeekerCheckSource {
  caseId: LightSeekerCaseId; abilityId: LightSeekerLifeAbilityId; cost: 7 | 9; abilityCost: 7 | 6; inheritedCost: 0 | 3;
  at: number; coreStat: 'will' | 'knowledge'; baseAbility: number; operatorConsentWeek: number; spiritConsentWeek: number | null; site: LightSeekerSiteState;
}
export interface LightSeekerLifeEvent {
  week: number; command: LightSeekerActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: LightSeekerCheckSource | null;
  paid: { actions: number; spirituality: number };
  budget: { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number };
}
export interface LightSeekerLifeState {
  activeCase: LightSeekerCaseId | null; reflected: boolean; site: LightSeekerSiteState;
  cases: Record<LightSeekerCaseId, LightSeekerCaseState>; journal: LightSeekerLifeEvent[];
}
export interface LightSeekerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: LightSeekerActivityCommand }
export interface LightSeekerLifeProjection {
  title: string; story: string; environment: string; activeCase: LightSeekerCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: LightSeekerSiteState; clockSeconds: number; playerLocation: LightSeekerLocation; playerTravelMetres: number;
  currentAttempt: LightSeekerAttempt | null; sitePhase: 'LIFE' | 'ENCOUNTER';
  cases: { id: LightSeekerCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: LightSeekerAttempt[] }[];
  actions: LightSeekerLifeAction[];
}
export const LIGHT_SEEKER_LIFE_STORY = '逐光者·太阳序列2。这里练习把光送到现有字牌，以及短时收束自己已经点起的光。引光7灵性、意志20、施用10秒；收光另需先付3灵性照明，再付6灵性、知识20，合计10秒。成功只开20秒窗口，失败照付；窗口不会移动人、穿过遮板、揭开秘密或保护所有灵体。观察、准备、实施、报告各1行动，普通子步仍耗真实时间、精力与原物。三份报告各25扮演，反思25；每案仅实际应用并报告的新技巧加8掌握。';
const CASES = [
  { id: 'marker-path', title: '沿采光廊核读旧字牌', story: '玛拉保管的字牌一直固定在6米尽头。取得她本次许可，打开3米处的遮板，再试着把光送向尽头。你须陪她实走6米，花4秒核读；只能读出既有字母，无法由此知道所有权或隐藏真相。引光失败或过期，可花同一普通灯的1份油核读。之后停光，与玛拉原路返回，亲手关回遮板。' },
  { id: 'screened-return', title: '遮屏旁的真实返程', story: '趁光还没亮，让同一位玛拉从入口走到6米尽头，你陪她走到后再走回。摆好原遮罩，点起小范围照明，再尝试短时收束它。只有窗口仍有效，玛拉才沿原路走回入口；否则先停光并关遮板，再普通返回。原屏板要实际检查一次，耐久减1；收光不会替人挡棍击，也不是普遍免疫。' },
  { id: 'withdrawn-visit', title: '芦影改变主意之后', story: '玛拉联系的芦影是这里独立的友善灵体。先问它这次是否愿来，光灭时它自愿从9米侧路走到入口。若准备试光，它仍须沿原路退回。开窗后再次询问，它会明确撤回此次探访许可。尊重这次撤回，停光、归还遮罩并普通收尾；未应用的成功不会增加掌握。普通探访可不点光，花4秒在遮罩旁完成接触，再沿原路送别。停光后可以重新询问，旧许可不能替它回答。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 2;
const freshCase = (): LightSeekerCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, preparations: 0, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', site: LightSeekerSiteState): LightSeekerAttempt {
  return { week, method, closed: false, result: 'NONE', performed: false, interrupted: false, inspected: false, elapsedSeconds: 0, spiritualitySpent: 0,
    playerTravelMetres: 0, operatorTravelMetres: 0, operatorEnergySpent: 0, spiritTravelMetres: 0, spiritEnergySpent: 0,
    operatorConsent: 'UNASKED', operatorConsentWeek: null, spiritConsent: 'UNASKED', spiritConsentWeek: null,
    opened: false, coverPlaced: false, operatorWentFar: false, operatorReturned: false, spiritVisited: false, spiritRetired: false, permissionWithdrawn: false,
    markerRead: false, lampRead: false, screenInspected: false, lightStopped: false, waits: 0, abilityTier: null, window: 'NONE', windowExpiresAt: null,
    appliedAbilityIds: [], siteAtStart: structuredClone(site), siteAtClose: null };
}
export function createLightSeekerLifeState(): LightSeekerLifeState {
  return { activeCase: null, reflected: false, site: createLightSeekerSiteState(), cases: { 'marker-path': freshCase(), 'screened-return': freshCase(), 'withdrawn-visit': freshCase() }, journal: [] };
}
const current = (l: LightSeekerLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: LightSeekerLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
export const lightSeekerLifeClosed = (s: SliceState): boolean => !contactOpen(s.lightSeeker.life) && Object.values(s.lightSeeker.life.cases).every(r => r.status === 'RESOLVED');
export const hasLightSeekerLifeLock = (s: SliceState): boolean => contactOpen(s.lightSeeker.life) || (s.lightSeeker.encounter.status === 'AVAILABLE' && physicalCleanupBlock(s.lightSeeker.life) !== null);
export const lightSeekerInside = hasLightSeekerLifeLock;
export function validateLightSeekerActivityCommand(v: unknown): v is LightSeekerActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!LIGHT_SEEKER_CASE_IDS.includes(v.caseId as LightSeekerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && [...STEPS, 'OBSERVE', 'PERFORM', 'REPORT', 'LEAVE', 'CLOSE', 'WITHDRAW'].includes(String(v.type));
}
export const isLightSeekerActivityCommand = validateLightSeekerActivityCommand;
export const isLightSeekerActivity = validateLightSeekerActivityCommand;
function physicalCleanupBlock(l: LightSeekerLifeState): string | null {
  const p = l.site, a = current(l);
  if (p.light.mode !== 'OFF' || a?.performed && (a.spiritualitySpent > 0) && !a.lightStopped) return '先明确停光；失败或窗口过期也要确认停止，不退灵性。';
  if (p.shutter.state === 'OPEN') return '还须亲手关回遮板，停光不会替你关上它。';
  if (p.board.location !== 'FAR_STAND' || p.board.owner !== 'LS2-MARA') return '同一字牌尚未回到6米尽头的原架上。';
  if (p.cover.position !== 'OWNER_STAND') return '同一遮罩还在屏架上，须走过去取回并放回玛拉的架子。';
  if (p.operatorLocation !== 'ENTRY') return '玛拉仍在廊道里，须实际沿普通路返回入口。';
  if (p.spiritLocation !== 'SIDE') return '芦影仍在入口，须趁光灭时沿9米侧路实际退回。';
  return p.playerLocation !== 'ENTRY' ? '你还须沿原路实际走回入口。' : null;
}
const ownerAllowed = (l: LightSeekerLifeState, week: number) => l.site.operatorConsent === 'GRANTED' && l.site.operatorConsentWeek === week;
const spiritAllowed = (l: LightSeekerLifeState, week: number) => l.site.spiritConsent === 'GRANTED' && l.site.spiritConsentWeek === week;
function localBlock(l: LightSeekerLifeState, c: LightSeekerActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !contactOpen(l) && !physicalCleanupBlock(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先如实报告三案，再反思一次。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), p = l.site, index = LIGHT_SEEKER_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[LIGHT_SEEKER_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '按顺序观察本案，先收束前一处接触。';
  if (c.type === 'PREPARE') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'OBSERVED' && r.attempts.length === 0 && !Object.values(l.cases).some(x => x.attempts.some(t => t.week === week)) ? null : '须已观察本案、现场已收束，而且本周还没准备过另一案；每案只准备一次。';
  if (c.type === 'REPORT') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'EXAMINED' ? null : '先核实真实结果，实际停光、归物、返回并离开，再报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在准备或进行的同一案现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return physicalCleanupBlock(l) ?? (a.inspected ? null : '先核实本次结果；即使中途放弃，也须记录未完成的工作。');
  if (c.type === 'STOP') return (a.performed && a.spiritualitySpent > 0 && !a.lightStopped) || p.light.mode !== 'OFF' ? null : '本次没有尚待停止的光；不重复退款或清理原物。';
  if (c.type === 'RETURN_OPERATOR') return a.operatorWentFar && !a.operatorReturned && p.operatorLocation === 'FAR' && p.operatorEnergy >= 2 && p.light.mode === 'OFF' && (c.caseId === 'marker-path' ? p.playerLocation === 'FAR' : p.playerLocation === 'ENTRY' && p.shutter.state !== 'OPEN') ? null : '须先停光，再让同一玛拉从6米尽头普通返回；第二案还须先关遮板，每程仍耗2精力。';
  if (c.type === 'CLOSE_SHUTTER') return p.playerLocation === 'ENTRY' && p.light.mode === 'OFF' && p.shutter.state === 'OPEN' && p.shutter.durability > 0 ? null : '本人须在入口且已停光，再走到3米处关同一遮板并走回；损坏不会自行恢复。';
  if (c.type === 'RETURN_COVER') return p.playerLocation === 'ENTRY' && p.light.mode === 'OFF' && p.cover.position === 'SCREEN' ? null : '本人须在入口且光已灭，再沿普通路取回屏架上的同一遮罩。';
  if (c.type === 'RETIRE_SPIRIT') return c.caseId === 'withdrawn-visit' && p.light.mode === 'OFF' && p.spiritLocation === 'ENTRY' && p.spiritEnergy >= 2 && a.spiritVisited ? null : '须光灭，芦影确实在入口且还有2精力，才可自愿沿9米侧路退回；不强行召回或传送。';
  if (c.type === 'INSPECT') return !a.inspected && a.operatorConsentWeek === week && !physicalCleanupBlock(l) && (c.caseId !== 'screened-return' || !a.performed || a.screenInspected) ? null : '先当面取得或记录本案拒绝，再实际收束人、光与借物；第二案实施后须真实检查屏板一次。';
  if (a.inspected) return '本次已核实，请离开并报告。';
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'DECLINE_OPERATOR') return a.operatorConsent === 'UNASKED' && p.operatorLocation === 'ENTRY' && p.playerLocation === 'ENTRY' && !a.performed ? null : '须在入口当面询问玛拉本案许可，不能沿用上案同意。';
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'withdrawn-visit' && a.performed && a.spiritVisited && !a.permissionWithdrawn && spiritAllowed(l, week) && (p.spiritLocation === 'SIDE' || a.method === 'ORDINARY' && p.spiritLocation === 'ENTRY' && p.light.mode === 'OFF') ? null : '须已完成一次试光或普通探访，芦影确实来过，且尚未读取它这一次撤回；有光时它必须仍在侧路。';
  if (c.type === 'CONSENT_SPIRIT' || c.type === 'DECLINE_SPIRIT') return c.caseId === 'withdrawn-visit' && ownerAllowed(l, week) && p.light.mode === 'OFF' && p.playerLocation === 'ENTRY' && p.spiritLocation === 'SIDE' && (a.spiritConsent === 'UNASKED' || a.spiritConsent === 'WITHDRAWN') ? null : '须光灭且芦影在侧路，才能重新询问它当前意愿；旧许可无效。';
  if (c.type === 'INSPECT_SCREEN') return c.caseId === 'screened-return' && a.performed && !a.screenInspected && p.playerLocation === 'ENTRY' && p.light.mode === 'OFF' && p.screen.durability > 0 ? null : '须实施之后先停光，在入口走到原屏板检查一次；实际4秒检查、耐久减1。';
  if (c.type === 'WAIT_10') return a.performed && a.waits < 3 ? null : '实施后每案最多等三次10秒；等待不会续窗或归物。';
  if (!ownerAllowed(l, week)) return '玛拉尚未同意本案，或许可已失效；仍可停光并普通收尾。';
  if (c.type === 'INVITE_SPIRIT') return c.caseId === 'withdrawn-visit' && spiritAllowed(l, week) && p.light.mode === 'OFF' && p.spiritLocation === 'SIDE' && p.playerLocation === 'ENTRY' && p.spiritEnergy >= 4 && (!a.spiritVisited || a.permissionWithdrawn && a.spiritRetired) ? null : '须芦影当前同意且光灭，留足实际往返4精力，才可从9米侧路走到入口。';
  if (c.type === 'OPEN_SHUTTER') return !a.performed && !a.opened && p.playerLocation === 'ENTRY' && p.light.mode === 'OFF' && p.shutter.state === 'CLOSED' && p.shutter.durability > 1 ? null : '须光灭且本人在入口，开同一遮板时还须留出关回的耐久；每案只开一次。';
  if (c.type === 'PLACE_COVER') return c.caseId !== 'marker-path' && !a.performed && !a.coverPlaced && p.playerLocation === 'ENTRY' && p.light.mode === 'OFF' && p.cover.position === 'OWNER_STAND' && p.cover.durability > 0 && p.screen.durability > 0 ? null : '须光灭，沿3米路把玛拉架上的同一遮罩摆到现有屏板，再走回入口。';
  if (c.type === 'MOVE_OPERATOR_FAR') return c.caseId !== 'withdrawn-visit' && !a.operatorWentFar && p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' && p.operatorEnergy >= 4 && p.spiritLocation === 'SIDE' && (c.caseId === 'marker-path' ? a.performed : !a.performed && p.light.mode === 'OFF') ? null : '须同一玛拉当前在入口并留足往返4精力；首案实施后随行，第二案必须先在光灭时实际送到6米尽头。';
  if (c.type === 'PERFORM') {
    if (r.status !== 'PREPARED' || a.performed || p.playerLocation !== 'ENTRY' || p.light.mode !== 'OFF') return '须完成本案准备、本人回入口且光灭；每案只实施一次，不重抽。';
    if (c.caseId === 'withdrawn-visit' && a.method === 'ORDINARY') return a.spiritVisited && spiritAllowed(l, week) && p.spiritLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' && p.cover.position === 'SCREEN' && p.cover.durability > 0 && p.screen.durability > 0 ? null : '普通探访不点光；须芦影当前同意并已沿9米侧路真实来到入口，原遮罩已经摆好。';
    if (p.shutter.state !== 'OPEN' || p.shutter.durability <= 0) return '试光前须走到3米处打开完好遮板，再真实走回入口。';
    if (c.caseId === 'marker-path') return p.operatorLocation === 'ENTRY' && p.spiritLocation === 'SIDE' ? null : '玛拉须仍在入口、芦影在侧路，再开始一次引光尝试。';
    if (p.cover.position !== 'SCREEN' || p.cover.durability <= 0 || p.screen.durability <= 0) return '须先实际摆好原遮罩和原屏板。';
    if (c.caseId === 'screened-return') return a.operatorWentFar && p.operatorLocation === 'FAR' && p.spiritLocation === 'SIDE' ? null : '须先在光灭时把同一玛拉送到6米尽头，你再走回；芦影留侧路。';
    return a.spiritVisited && a.spiritRetired && spiritAllowed(l, week) && p.spiritLocation === 'SIDE' && p.operatorLocation === 'ENTRY' ? null : '芦影须本次自愿真实来过，再沿9米侧路退回；仍需它当前同意试光。';
  }
  if (c.type === 'TRACE_MARK') return c.caseId === 'marker-path' && a.performed && !a.markerRead && p.playerLocation === 'FAR' && p.operatorLocation === 'FAR' && p.board.location === 'FAR_STAND' && p.board.owner === 'LS2-MARA' && p.shutter.state === 'OPEN' && p.shutter.durability > 0 && p.light.mode === 'GUIDED' && p.light.expiresAt !== null && p.light.expiresAt - p.elapsedSeconds >= 4 ? null : '须你和玛拉都实际到达原字牌，遮板仍通光，且引光窗口还够4秒；只读原有字母。';
  if (c.type === 'READ_LAMP') return c.caseId === 'marker-path' && a.performed && !a.markerRead && p.playerLocation === 'FAR' && p.operatorLocation === 'FAR' && p.board.location === 'FAR_STAND' && p.board.owner === 'LS2-MARA' && p.lamp.oil > 0 ? null : '须两人确已到达同一字牌，原灯仍有1份油；普通核读耗4秒，不授新技巧掌握。';
  if (c.type === 'PASS_OPERATOR') return c.caseId === 'screened-return' && a.performed && !a.operatorReturned && p.operatorLocation === 'FAR' && p.operatorEnergy >= 2 && p.playerLocation === 'ENTRY' && p.cover.position === 'SCREEN' && p.cover.durability > 0 && p.screen.durability > 0 && p.light.mode === 'LIMITED' && p.light.expiresAt !== null && p.light.expiresAt - p.elapsedSeconds >= 6 ? null : '须收光窗口仍够6秒、原遮罩在位且当前许可有效；让同一玛拉实际走回，不是只记成功。';
  return '当前阶段不能进行这一步。';
}
function commandCost(l: LightSeekerLifeState, c: LightSeekerActivityCommand) {
  const actions = ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0;
  if (c.type !== 'PERFORM') return { actions, spirituality: 0 };
  const ability = l.cases[c.caseId].method === 'ABILITY';
  return { actions, spirituality: c.caseId === 'marker-path' ? ability ? 7 : 0 : ability ? 9 : c.caseId === 'withdrawn-visit' ? 0 : 3 };
}
export function blockLightSeekerLife(s: SliceState, c: LightSeekerActivityCommand): string | null {
  if (!validateLightSeekerActivityCommand(c)) return '逐光者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着，且当前是逐光者·太阳序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德这处采光廊。';
  if (hasJusticeMentorLifeLock(s) || ['READY', 'FIGHTING'].includes(s.justiceMentor.encounter.status) || s.lightSeeker.preparedWeek !== null) return '先收束先前接触和本次服药准备。';
  if (s.lightSeeker.encounter.status !== 'AVAILABLE') return '同一场地已进入后续遭遇，不能重开旧案或重置原物。';
  const reason = localBlock(s.lightSeeker.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.lightSeeker.life, c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备时须留出实施所需1行动。停光和普通收尾仍为0行动。';
  if (cost.spirituality > 0 && s.mind <= 0) return '当前精神不足以施术；仍可停光并普通收尾。';
  if (s.spirituality < cost.spirituality) return `本次需要${cost.spirituality}灵性，当前不足；不会免费开窗。`;
  return null;
}
function elapse(l: LightSeekerLifeState, a: LightSeekerAttempt, seconds: number): void {
  advanceLightSeekerTime(l.site, seconds); a.elapsedSeconds += seconds;
  if (a.window === 'ACTIVE' && a.windowExpiresAt !== null && l.site.elapsedSeconds >= a.windowExpiresAt) a.window = 'EXPIRED';
}
function walk(l: LightSeekerLifeState, a: LightSeekerAttempt, actor: 'player' | 'operator' | 'spirit', to: LightSeekerLocation): number {
  const p = l.site, from = LIGHT_SEEKER_POSITION_METRES[p[`${actor}Location`]], distance = Math.abs(from - LIGHT_SEEKER_POSITION_METRES[to]);
  if (actor === 'spirit') {
    if (to !== 'ENTRY' && to !== 'SIDE') throw new Error('芦影只能沿本次入口与侧路普通往返。');
    p.spiritLocation = to;
  } else p[`${actor}Location`] = to;
  p[`${actor}Metres`] += distance; a[`${actor}TravelMetres`] += distance;
  if (actor !== 'player' && distance > 0) { p[`${actor}Energy`] -= 2; a[`${actor}EnergySpent`] += 2; }
  return distance;
}
function screenTrip(l: LightSeekerLifeState, a: LightSeekerAttempt, seconds: number, operation: () => void): void {
  elapse(l, a, walk(l, a, 'player', 'SCREEN')); elapse(l, a, seconds); operation(); elapse(l, a, walk(l, a, 'player', 'ENTRY'));
}
function checkSource(l: LightSeekerLifeState, c: LightSeekerActivityCommand, baseAbility: number): LightSeekerCheckSource | null {
  if (c.type !== 'PERFORM' || l.cases[c.caseId].method !== 'ABILITY') return null;
  const p = l.site, marker = c.caseId === 'marker-path';
  return { caseId: c.caseId, abilityId: marker ? 'sun.s2.guided-radiance' : 'sun.s2.limited-light', cost: marker ? 7 : 9, abilityCost: marker ? 7 : 6, inheritedCost: marker ? 0 : 3,
    at: p.elapsedSeconds, coreStat: marker ? 'will' : 'knowledge', baseAbility, operatorConsentWeek: p.operatorConsentWeek!, spiritConsentWeek: p.spiritConsentWeek, site: structuredClone(p) };
}
/** Pure ordered scene reducer, also used to reconstruct every historical site and applied reward. */
function evolve(l: LightSeekerLifeState, c: LightSeekerActivityCommand, week: number, tier: PublicResolutionTier | null): void {
  if (c.type === 'REFLECT') { l.reflected = true; return; }
  const r = l.cases[c.caseId], p = l.site;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations++; r.contactOpen = true; l.activeCase = c.caseId;
    r.attempts.push(freshAttempt(week, c.method, p)); p.operatorConsent = 'UNASKED'; p.operatorConsentWeek = null; p.spiritConsent = 'UNASKED'; p.spiritConsentWeek = null; return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) {
    a.closed = true; a.interrupted = !a.performed || (c.caseId === 'marker-path' && !a.markerRead) || (c.caseId === 'screened-return' && !a.operatorReturned);
    if (a.operatorConsentWeek !== null) { a.operatorConsent = 'CLOSED'; p.operatorConsent = 'CLOSED'; }
    if (a.spiritConsentWeek !== null) { a.spiritConsent = 'CLOSED'; p.spiritConsent = 'CLOSED'; }
    r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++;
    a.siteAtClose = structuredClone(p); l.activeCase = null; return;
  }
  switch (c.type) {
    case 'CONSENT_OPERATOR': case 'DECLINE_OPERATOR': a.operatorConsent = p.operatorConsent = c.type === 'CONSENT_OPERATOR' ? 'GRANTED' : 'DECLINED'; a.operatorConsentWeek = p.operatorConsentWeek = week; elapse(l, a, 2); break;
    case 'CONSENT_SPIRIT': case 'DECLINE_SPIRIT': a.spiritConsent = p.spiritConsent = c.type === 'CONSENT_SPIRIT' ? 'GRANTED' : 'DECLINED'; a.spiritConsentWeek = p.spiritConsentWeek = week; elapse(l, a, 2); break;
    case 'INVITE_SPIRIT': a.spiritVisited = true; a.spiritRetired = false; elapse(l, a, walk(l, a, 'spirit', 'ENTRY')); break;
    case 'RETIRE_SPIRIT': a.spiritRetired = true; elapse(l, a, walk(l, a, 'spirit', 'SIDE')); break;
    case 'OPEN_SHUTTER': case 'CLOSE_SHUTTER': screenTrip(l, a, 2, () => {
      p.shutter.operations++; p.shutter.durability--; p.shutter.state = p.shutter.durability === 0 ? 'BROKEN' : c.type === 'OPEN_SHUTTER' ? 'OPEN' : 'CLOSED';
      if (c.type === 'OPEN_SHUTTER') a.opened = true;
    }); break;
    case 'PLACE_COVER': case 'RETURN_COVER': screenTrip(l, a, 1, () => { p.cover.position = c.type === 'PLACE_COVER' ? 'SCREEN' : 'OWNER_STAND'; if (c.type === 'PLACE_COVER') a.coverPlaced = true; }); break;
    case 'MOVE_OPERATOR_FAR': {
      a.operatorWentFar = true; const distance = walk(l, a, 'operator', 'FAR'); walk(l, a, 'player', 'FAR'); elapse(l, a, distance);
      if (c.caseId === 'screened-return') elapse(l, a, walk(l, a, 'player', 'ENTRY')); break;
    }
    case 'PERFORM': {
      a.performed = true; r.status = 'ACTIVE'; const marker = c.caseId === 'marker-path', ability = a.method === 'ABILITY';
      a.spiritualitySpent += marker ? ability ? 7 : 0 : ability ? 9 : c.caseId === 'withdrawn-visit' ? 0 : 3;
      if (c.caseId === 'withdrawn-visit' && !ability) { elapse(l, a, 4); break; }
      if (!marker) { elapse(l, a, 4); p.light = { mode: 'PLAIN', expiresAt: null }; }
      if (ability) {
        elapse(l, a, marker ? 10 : 6); a.abilityTier = tier; a.window = success(tier) ? 'ACTIVE' : 'FAILED';
        if (success(tier)) { a.windowExpiresAt = p.elapsedSeconds + 20; p.light = { mode: marker ? 'GUIDED' : 'LIMITED', expiresAt: a.windowExpiresAt }; }
      }
      break;
    }
    case 'TRACE_MARK': a.markerRead = true; p.board.read = true; a.appliedAbilityIds.push('sun.s2.guided-radiance'); elapse(l, a, 4); break;
    case 'READ_LAMP': a.markerRead = true; a.lampRead = true; p.board.read = true; p.lamp.oil--; elapse(l, a, 4); break;
    case 'PASS_OPERATOR': a.operatorReturned = true; a.appliedAbilityIds.push('sun.s2.limited-light'); elapse(l, a, walk(l, a, 'operator', 'ENTRY')); break;
    case 'RETURN_OPERATOR': {
      a.operatorReturned = true; const distance = walk(l, a, 'operator', 'ENTRY');
      if (c.caseId === 'marker-path') walk(l, a, 'player', 'ENTRY'); elapse(l, a, distance); break;
    }
    case 'INSPECT_SCREEN': screenTrip(l, a, 4, () => { p.screen.inspections++; p.screen.durability--; a.screenInspected = true; }); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.spiritConsent = p.spiritConsent = 'WITHDRAWN'; elapse(l, a, 1); break;
    case 'STOP': p.light = { mode: 'OFF', expiresAt: null }; a.lightStopped = true; if (a.abilityTier !== null) a.window = 'STOPPED'; break;
    case 'WAIT_10': a.waits++; elapse(l, a, 10); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, a, 2); break;
  }
}
export function applyLightSeekerActivity(s: SliceState, c: LightSeekerActivityCommand, ctx: SeerContext): void {
  const reason = blockLightSeekerLife(s, c); if (reason) throw new Error(reason);
  const l = s.lightSeeker.life, source = checkSource(l, c, s.character.coreStats['caseId' in c && c.caseId === 'marker-path' ? 'will' : 'knowledge']), paid = commandCost(l, c);
  const budget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality };
  let tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null, check: PublicCheckResult | null = null;
  s.actionsRemaining -= paid.actions; s.spirituality -= paid.spirituality;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check(c.type === 'PERFORM' && c.caseId === 'marker-path' ? 'will' : 'knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  evolve(l, c, s.week, tier); l.journal.push({ week: s.week, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, paid, budget });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const a = current(l) ?? ('caseId' in c ? l.cases[c.caseId].attempts.at(-1) : null), p = l.site;
  ctx.note(`采光廊：${LABELS[c.type]}`, `${tier ? `这次检定${TIER_LABELS[tier]}。` : ''}你在${LOCATION_LABELS[p.playerLocation]}，玛拉在${LOCATION_LABELS[p.operatorLocation]}、精力${p.operatorEnergy}，芦影在${LOCATION_LABELS[p.spiritLocation]}、精力${p.spiritEnergy}。遮板${SHUTTER_LABELS[p.shutter.state]}、耐久${p.shutter.durability}；原灯余油${p.lamp.oil}，当前${LIGHT_LABELS[p.light.mode]}。${a ? `本次已耗${a.spiritualitySpent}灵性、${a.elapsedSeconds}秒；成功窗口与实际应用分开记录。` : ''}`);
}
export const applyLightSeekerLife = applyLightSeekerActivity;
const LOCATION_LABELS: Record<LightSeekerLocation, string> = { ENTRY: '入口0米处', NEAR: '近端2米处', SCREEN: '遮板3米处', OTHER: '另一侧4米处', FAR: '尽头6米处', SIDE: '侧路9米处' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LIGHT_LABELS: Record<LightSeekerSiteState['light']['mode'], string> = { OFF: '光已熄灭', PLAIN: '普通小范围照明', GUIDED: '引光窗口有效', LIMITED: '收光窗口有效' };
const SHUTTER_LABELS = { OPEN: '打开', CLOSED: '关闭', BROKEN: '已损坏' };
const CONSENT_LABELS: Record<LightSeekerConsent, string> = { UNASKED: '尚未询问', GRANTED: '本次同意', DECLINED: '本次拒绝', WITHDRAWN: '当前撤回', CLOSED: '本次接触已结束' };
const LABELS: Record<string, string> = {
  OBSERVE: '观察这一次工作', PREPARE: '准备本次实践', PERFORM: '支付费用并实施一次', REPORT: '如实报告这一次结果', REFLECT: '反思三次接触与停止的分寸',
  CONSENT_OPERATOR: '当面问玛拉并记录本次同意', DECLINE_OPERATOR: '尊重玛拉本次拒绝', CONSENT_SPIRIT: '询问芦影现在是否愿意', DECLINE_SPIRIT: '尊重芦影本次拒绝', INVITE_SPIRIT: '光灭时请芦影沿9米侧路走来', RETIRE_SPIRIT: '光灭时芦影沿9米侧路退回',
  OPEN_SHUTTER: '走到3米处打开遮板，再走回', CLOSE_SHUTTER: '走到3米处关回遮板，再走回', PLACE_COVER: '把同一遮罩送到屏架，再走回', RETURN_COVER: '走去取回遮罩，放回主人架上', MOVE_OPERATOR_FAR: '陪同一玛拉实走到6米尽头',
  TRACE_MARK: '在引光窗口内核读原字牌', READ_LAMP: '用普通灯核读同一字牌', PASS_OPERATOR: '玛拉在收光窗口内实走回入口', RETURN_OPERATOR: '停光后让同一玛拉普通返回', INSPECT_SCREEN: '走去检查同一屏板，再走回',
  WITHDRAW_PERMISSION: '再次询问，尊重芦影当前撤回', STOP: '明确停止自己的光', WAIT_10: '实际等10秒', INSPECT: '核实结果与真实收尾', LEAVE: '结束接触并从普通入口离开', CLOSE: '结束已收束的接触', WITHDRAW: '结束本次准备或接触',
};
const COSTS: Partial<Record<string, string>> = {
  CONSENT_OPERATOR: '0行动 · 当面2秒 · 只限本案本周', DECLINE_OPERATOR: '0行动 · 当面2秒', CONSENT_SPIRIT: '0行动 · 2秒 · 需光灭与新的当前同意', DECLINE_SPIRIT: '0行动 · 2秒',
  INVITE_SPIRIT: '0行动 · 芦影9米/9秒 · 2精力', RETIRE_SPIRIT: '0行动 · 芦影9米/9秒 · 2精力', OPEN_SHUTTER: '0行动 · 本人往返6米 · 共8秒 · 遮板耐久−1', CLOSE_SHUTTER: '0行动 · 本人往返6米 · 共8秒 · 遮板耐久−1',
  PLACE_COVER: '0行动 · 本人往返6米 · 共7秒', RETURN_COVER: '0行动 · 本人往返6米 · 共7秒', TRACE_MARK: '0行动 · 4秒 · 只读已有字母', READ_LAMP: '0行动 · 4秒 · 原灯油−1',
  PASS_OPERATOR: '0行动 · 玛拉6米/6秒 · 2精力 · 须当前收光有效', RETURN_OPERATOR: '0行动 · 玛拉6米/6秒 · 2精力 · 首案本人同行6米', INSPECT_SCREEN: '0行动 · 本人往返6米 · 共10秒 · 屏板耐久−1',
  WITHDRAW_PERMISSION: '0行动 · 1秒 · 不退款、不移动芦影', STOP: '0行动0秒 · 不退灵性、不归物、不移人', WAIT_10: '0行动 · 10秒 · 不续窗', INSPECT: '0行动 · 2秒',
  LEAVE: '0行动 · 已到普通入口后结束接触', CLOSE: '0行动 · 须已实际收束', WITHDRAW: '0行动 · 须先真实收尾，不退款', REPORT: '1行动 · 扮演25 · 仅实际应用的新技巧+8', REFLECT: '1行动 · 三份实际报告后扮演25',
};
export function lightSeekerLifeActions(s: SliceState): LightSeekerLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.lightSeeker.life, out: LightSeekerLifeAction[] = [];
  const add = (command: LightSeekerActivityCommand) => {
    const reason = blockLightSeekerLife(s, command), id = 'caseId' in command ? command.caseId : null;
    let cost = COSTS[command.type] ?? '1行动';
    if (command.type === 'PREPARE') cost = '1行动 · 须至少余2行动，留出实施费用';
    if (command.type === 'MOVE_OPERATOR_FAR') cost = id === 'screened-return' ? '0行动 · 玛拉6米/2精力，本人往返12米 · 共12秒 · 先保持光灭' : '0行动 · 两人同行6米/6秒 · 玛拉2精力';
    if (command.type === 'PERFORM' && id) cost = id === 'marker-path' ? l.cases[id].method === 'ABILITY' ? '1行动 · 7灵性 · 意志20 · 10秒 · 成功开20秒窗' : '1行动 · 普通核读另耗原灯1油/4秒' : l.cases[id].method === 'ABILITY' ? '1行动 · 共9灵性、10秒 · 知识20 · 成功收光20秒' : id === 'withdrawn-visit' ? '1行动 · 普通探访4秒 · 0灵性、不点光 · 芦影仍须实际往返' : '1行动 · 继承照明3灵性、4秒 · 返回前须停光';
    out.push({ id: `LS2:${id ?? 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}`, label: `${LABELS[command.type]}${'method' in command ? command.method === 'ABILITY' ? '（有限能力）' : '（普通方法）' : ''}`, cost, enabled: reason === null, reason, command });
  };
  for (const caseId of LIGHT_SEEKER_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add({ type: 'PREPARE', caseId, method });
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    if (r.status === 'PREPARED') add({ type: 'PERFORM', caseId });
    for (const type of STEPS) {
      if (caseId !== 'withdrawn-visit' && ['CONSENT_SPIRIT', 'DECLINE_SPIRIT', 'INVITE_SPIRIT', 'RETIRE_SPIRIT', 'WITHDRAW_PERMISSION'].includes(type)) continue;
      if (caseId !== 'marker-path' && ['TRACE_MARK', 'READ_LAMP'].includes(type)) continue;
      if (caseId === 'marker-path' && ['PLACE_COVER', 'RETURN_COVER'].includes(type)) continue;
      if (caseId !== 'screened-return' && ['PASS_OPERATOR', 'INSPECT_SCREEN'].includes(type)) continue;
      if (caseId === 'withdrawn-visit' && ['MOVE_OPERATOR_FAR', 'RETURN_OPERATOR'].includes(type)) continue;
      if (r.method === 'ORDINARY' && ['TRACE_MARK', 'PASS_OPERATOR'].includes(type)) continue;
      add({ type, caseId });
    }
    add({ type: 'LEAVE', caseId });
  }
  if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
export function projectLightSeekerLife(s: SliceState): LightSeekerLifeProjection {
  const l = s.lightSeeker.life, p = l.site;
  return { title: '采光廊里的光、原物与当前许可', story: LIGHT_SEEKER_LIFE_STORY,
    environment: '这是一处6米直廊：入口0米、近端2米、遮板3米、另一侧4米、尽头6米，旁有9米普通侧路。玛拉46岁，芦影是她联系的独立友善灵体。固定字牌、普通灯、遮板、屏板和遮罩始终是这一份；油与磨损不会随换案恢复。普通门一直可走，遮板只挡直射光。你和旁人都须真实步行，停光不把任何人送回，友善也不等于免疫。',
    activeCase: l.activeCase, inside: hasLightSeekerLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected,
    site: structuredClone(p), clockSeconds: p.elapsedSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerMetres,
    currentAttempt: structuredClone(current(l)), sitePhase: s.lightSeeker.encounter.status === 'AVAILABLE' ? 'LIFE' : 'ENCOUNTER',
    cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { id: d.id, title: d.title, story: d.story,
      observations: a ? [`本次${a.elapsedSeconds}秒，实耗${a.spiritualitySpent}灵性；本人走${a.playerTravelMetres}米，玛拉走${a.operatorTravelMetres}米/耗${a.operatorEnergySpent}精力，芦影走${a.spiritTravelMetres}米/耗${a.spiritEnergySpent}精力。`, `玛拉：${CONSENT_LABELS[a.operatorConsent]}；芦影：${CONSENT_LABELS[a.spiritConsent]}。`, ...(a.abilityTier ? [`能力检定${TIER_LABELS[a.abilityTier]}；实际应用${a.appliedAbilityIds.length}次。`] : []), ...(a.markerRead ? ['实际仅读到原刻字 NORTH_ARCH；没有因此获知主人、隐物或事件真相。'] : []), ...(a.permissionWithdrawn ? ['芦影当前撤回的事实保留。新的同意须等光灭后重新询问。'] : [])] : [],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '能力确实用于本案，之后已真实停止、归还和返回。' : '按普通结果如实收尾；未应用的成功与中途停止都保留，不增加新技巧掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: lightSeekerLifeActions(s) };
}
/** Strict command, cost, check, source and physical replay; no position or resource resets on interruption. */
export function validateLightSeekerLife(s: SliceState): boolean {
  try {
    const l = s.lightSeeker?.life, promotion = s.lightSeeker?.promotionWeek, expected = createLightSeekerLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !Array.isArray(l.journal) || l.journal.length > 600 || !validateLightSeekerSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week)) return false;
    let lastWeek = promotion, nextCursor = 0, previous: LightSeekerLifeEvent | null = null;
    for (const event of l.journal) {
      if (!record(event) || !shape(event, ['week', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'paid', 'budget']) || !integer(event.week, lastWeek, s.week) || !validateLightSeekerActivityCommand(event.command)) return false;
      const c = event.command, source = checkSource(expected, c, record(event.check) && integer(event.check.baseAbility, 0, 500) ? event.check.baseAbility : 0), cost = commandCost(expected, c), b = event.budget;
      if (contactOpen(expected) && event.week !== lastWeek || localBlock(expected, c, event.week)) return false;
      if (!same(event.source, source) || !same(event.paid, cost) || !record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter']) ||
          !integer(b.actionsBefore) || !integer(b.actionsAfter) || !integer(b.spiritualityBefore, 0, 120) || !integer(b.spiritualityAfter, 0, 120) ||
          b.actionsAfter !== b.actionsBefore - cost.actions || b.spiritualityAfter !== b.spiritualityBefore - cost.spirituality || c.type === 'PREPARE' && b.actionsBefore < 2) return false;
      if (contactOpen(expected) && previous && (b.actionsBefore !== previous.budget.actionsAfter || b.spiritualityBefore !== previous.budget.spiritualityAfter)) return false;
      if (source) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
        // During this S2 stage only ordinary LEARN may increase knowledge, and it caps at 20.
        // The open contact locks such learning; historical will and knowledge already above 20 cannot drift.
        // Low historical knowledge additionally needs whole-run public-command replay to establish its exact past value.
        if (promoted(s)) {
          const now = s.character.coreStats[source.coreStat];
          const pinned = source.coreStat === 'will' || now > 20 || 'caseId' in c && l.activeCase === c.caseId;
          if (pinned ? source.baseAbility !== now : source.baseAbility > now) return false;
        }
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: source.abilityId === 'sun.s2.guided-radiance' ? 'will' : 'knowledge', baseAbility: event.check.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || check.tier !== event.tier || random.cursor !== event.randomAfter) return false;
        nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.tier as PublicResolutionTier | null);
      if (!validateLightSeekerSiteState(expected.site)) return false;
      expected.journal.push(structuredClone(event) as unknown as LightSeekerLifeEvent); lastWeek = event.week; previous = event as unknown as LightSeekerLifeEvent;
    }
    const encounter = s.lightSeeker.encounter;
    if (encounter.status === 'AVAILABLE') { if (!same(l, expected)) return false; }
    else {
      if (contactOpen(expected) || !Object.values(expected.cases).every(r => r.status === 'RESOLVED') || physicalCleanupBlock(expected) || !same(encounter.startSite, expected.site)) return false;
      if (!same({ ...l, site: expected.site }, expected)) return false;
    }
    if (contactOpen(l) && (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || encounter.status !== 'AVAILABLE')) return false;
    const a = current(l); if (a && a.week !== s.week) return false;
    if (contactOpen(l) && previous && (s.actionsRemaining !== previous.budget.actionsAfter || s.spirituality !== previous.budget.spiritualityAfter)) return false;
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['sun.s2.guided-radiance', 'sun.s2.limited-light'] as const) if (s.progression.mastery[id] !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return false;
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
