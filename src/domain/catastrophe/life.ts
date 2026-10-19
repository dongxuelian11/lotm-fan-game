import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasSeaKingLifeLock } from '../sea-king/life.js';
import { createCatastropheSiteState, validateCatastropheSiteState, type CatastropheSiteState } from './resources.js';
export { createCatastropheSiteState, validateCatastropheSiteState, type CatastropheSiteState } from './resources.js';

export const CATASTROPHE_CASE_IDS = ['buoy-return', 'wheel-return', 'withdrawn-request'] as const;
export type CatastropheCaseId = typeof CATASTROPHE_CASE_IDS[number];
export type CatastropheConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type CatastropheWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'STOPPED' | 'EXPIRED';
export type CatastropheLifeAbilityId = 'tyrant.s2.storm-field' | 'tyrant.s2.water-pressure';
const STEPS = ['READ_SOURCE', 'CONSENT_OWNER', 'DECLINE_OWNER', 'AGREE_RETURN', 'ENTER_SITE', 'CHECK_BOUNDARY', 'CLEAR_KEEPER', 'CHECK_GATE', 'OPEN_GATE', 'ADMIT_WATER', 'STORM_FIELD', 'MOVE_BUOY', 'WATER_PRESSURE', 'DRIVE_WHEEL', 'MANUAL_WHEEL', 'CHECK_CONTINUATION', 'STOP_EFFECT', 'RECOVER_BUOY', 'DRAIN_WATER', 'CLOSE_GATE', 'CHECK_MOORING', 'RETURN_KEEPER', 'EXIT_SITE', 'WAIT_10', 'INSPECT'] as const;
export type CatastropheActivityCommand =
  | { type: typeof STEPS[number] | 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW'; caseId: CatastropheCaseId }
  | { type: 'PREPARE'; caseId: CatastropheCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
export interface CatastropheAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null;
  state: CatastropheWindow; remainingSeconds: number; stopped: boolean;
}
export interface CatastropheAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; keeperTravelMetres: number; keeperEnergySpent: number; spiritualitySpent: number;
  ownerConsent: CatastropheConsent; ownerConsentWeek: number | null; sourceRead: boolean; returnAgreed: boolean;
  entered: boolean; exited: boolean; boundaryChecked: boolean; keeperCleared: boolean; keeperReturned: boolean;
  gateChecked: boolean; gateBlocked: boolean; gateOpened: boolean; gateClosed: boolean; continuationChecked: boolean; consentWithdrawn: boolean;
  waterAdmitted: boolean; waterDrained: boolean; buoyMoved: boolean; buoyRecovered: boolean;
  wheelTurned: boolean; manualWheel: boolean; mooringChecked: boolean; inspected: boolean; waits: number;
  storm: CatastropheAbilityUse; pressure: CatastropheAbilityUse; appliedAbilityIds: CatastropheLifeAbilityId[];
}
export interface CatastropheCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  preparations: number; closes: number; withdrawals: number; attempts: CatastropheAttempt[];
}
export interface CatastropheCheckSource {
  caseId: CatastropheCaseId; siteId: 'CT2-COVE'; abilityId: CatastropheLifeAbilityId; cost: 6 | 7;
  at: number; boundaryMetres: 12; ownerId: 'CT2-NORA'; ownerConsentWeek: number;
  playerPosition: CatastropheSiteState['playerPosition']; keeperPosition: CatastropheSiteState['keeper']['position'];
  waterId: 'CT2-WATER'; bayUnits: number; channelUnits: number; gateId: 'CT2-GATE';
  gatePosition: CatastropheSiteState['gate']['position']; gateDurability: number; objectId: 'CT2-BUOY' | 'CT2-WHEEL'; objectDurability: number;
}
export interface CatastropheLifeEvent {
  week: number; command: CatastropheActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: CatastropheCheckSource | null;
  paid: { actions: number; spirituality: number };
  budget: { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number };
}
export interface CatastropheLifeState {
  activeCase: CatastropheCaseId | null; reflected: boolean; site: CatastropheSiteState;
  cases: Record<CatastropheCaseId, CatastropheCaseState>; journal: CatastropheLifeEvent[];
}
export interface CatastropheLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CatastropheActivityCommand }
export interface CatastropheLifeProjection {
  title: string; story: string; environment: string; activeCase: CatastropheCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: CatastropheSiteState; clockSeconds: number; playerLocation: CatastropheSiteState['playerPosition']; playerTravelMetres: number;
  currentAttempt: CatastropheAttempt | null; sitePhase: 'LIFE' | 'ENCOUNTER';
  cases: { id: CatastropheCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: CatastropheAttempt[] }[];
  actions: CatastropheLifeAction[];
}

export const CATASTROPHE_LIFE_STORY = '天灾·暴君序列2；名称与相邻序列有原著依据，完整配方、原著仪式及本阶精确新权能仍未知。本小湾、人物、原物、12米边界、20单位原水、费用、时间、强度与成长均为原创G。有限风浪7灵性/意志20，原水压力6灵性/知识20；一次检定只开最多10秒窗口，成功不等于实际应用。不造水、不修物、不自动豁免旁人。每案观察、准备、实施、报告各1行动，子步0行动但实际消耗秒、米、精力、原物耐久与灵性。三报告各25扮演、反思25；每案每项新能力只在实际应用后+8掌握。';
const CASES = [
  { id: 'buoy-return', title: '同一原浮标的有限移送与实拉归位', story: '诺拉45岁，仅当次同意原浮标、原系索及原轮具的有限作业。她须沿6米干路实际退出，才可尝试风浪把仍系原索的浮标移至8米标位。成功开窗尚未移动；停止后须用原轮具实拉同一浮标归位，索和轮各磨损1。失败可普通检查系泊，如实报告未移成。' },
  { id: 'wheel-return', title: '同一原海水推动原轮并排回', story: '重新问当前许可，让原保管员实际退至干路出口；原闸每次手动操作2秒、耐久−1。先开闸，再用4秒引同一湾内4单位原水到既有水道。有限压力成功开窗后，须再实际推动原轮一转并磨损1；也可普通手柄转动。最后明确停止、用4秒经原回流道排水、关闸，水总量始终20。' },
  { id: 'withdrawn-request', title: '当前撤回或闭闸后停止并普通退出', story: '这次许可只准有限检查，不准实际移浮标或推轮。可以付费开启有限窗口，再询问是否继续；诺拉当前明确撤回，已付成本和未用窗口历史保留，仍须单独停止和普通收束。也可先查见原闸当前关闭，保留拒绝施术的原因后普通退出。原人不会随停止而瞬移返回，原水也不会自动归湾。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 2;
const freshUse = (): CatastropheAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, stopped: false });
const freshCase = (): CatastropheCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, preparations: 0, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY'): CatastropheAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, keeperTravelMetres: 0, keeperEnergySpent: 0, spiritualitySpent: 0,
    ownerConsent: 'UNASKED', ownerConsentWeek: null, sourceRead: false, returnAgreed: false, entered: false, exited: false, boundaryChecked: false, keeperCleared: false, keeperReturned: false,
    gateChecked: false, gateBlocked: false, gateOpened: false, gateClosed: false, continuationChecked: false, consentWithdrawn: false, waterAdmitted: false, waterDrained: false, buoyMoved: false, buoyRecovered: false,
    wheelTurned: false, manualWheel: false, mooringChecked: false, inspected: false, waits: 0, storm: freshUse(), pressure: freshUse(), appliedAbilityIds: [] };
}
export function createCatastropheLifeState(): CatastropheLifeState {
  return { activeCase: null, reflected: false, site: createCatastropheSiteState(), cases: { 'buoy-return': freshCase(), 'wheel-return': freshCase(), 'withdrawn-request': freshCase() }, journal: [] };
}
const current = (l: CatastropheLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const unstoppedUse = (a: CatastropheAttempt) => [a.storm, a.pressure].some(u => u.attempts > 0 && !u.stopped);
const permitted = (a: CatastropheAttempt, week: number) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === week;
const lifeContactOpen = (l: CatastropheLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.status === 'PREPARED' || r.contactOpen);
export const catastropheLifeClosed = (s: SliceState): boolean => !lifeContactOpen(s.catastrophe.life) && Object.values(s.catastrophe.life.cases).every(r => r.status === 'RESOLVED');
/** Once the encounter owns this site, its positions are current; closed life positions are historical. */
export const hasCatastropheLifeLock = (s: SliceState): boolean => lifeContactOpen(s.catastrophe.life) || (s.catastrophe.encounter.status === 'AVAILABLE' && physicalCleanupBlock(s.catastrophe.life) !== null);
export const catastropheInside = hasCatastropheLifeLock;
export function validateCatastropheActivityCommand(v: unknown): v is CatastropheActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!CATASTROPHE_CASE_IDS.includes(v.caseId as CatastropheCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && [...STEPS, 'OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(String(v.type));
}
export const isCatastropheActivityCommand = validateCatastropheActivityCommand;
export const isCatastropheActivity = validateCatastropheActivityCommand;
function physicalCleanupBlock(l: CatastropheLifeState): string | null {
  const a = current(l), p = l.site;
  if (a && unstoppedUse(a)) return '先明确停止本次已施用的有限窗口；失败或过期也须确认停术，不退灵性。';
  if (p.buoy.offsetMetres !== 0) return '同一原浮标仍偏离原泊位；须用原轮具实拉归位。';
  if (p.water.channelUnits !== 0) return '原水仍在水道；须经既有回流道实际排回原湾。';
  if (p.gate.position !== 'CLOSED') return '须真实关闭原闸；停止不能代替手动关闸。';
  if (p.keeper.position !== 'CONTROL') return '原诺拉仍在范围外；须沿6米干路实际走回，耗2精力。';
  return p.playerPosition !== 'EXIT' ? '本人须沿2米普通干路实际回到出口。' : null;
}
function localBlock(l: CatastropheLifeState, c: CatastropheActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !lifeContactOpen(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先如实报告三案；反思只计一次。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), p = l.site, index = CATASTROPHE_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !lifeContactOpen(l) && !physicalCleanupBlock(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[CATASTROPHE_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '按顺序观察本案；先收束前一原现场。';
  if (c.type === 'PREPARE') return !lifeContactOpen(l) && !physicalCleanupBlock(l) && r.status === 'OBSERVED' && r.preparations < 16 ? null : '须已观察本案且现场收束；最多16次准备，原水与耐久不重置。';
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') return null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && l.activeCase === null && r.attempts.length === 0 ? null : '须已准备本案；每案只实施一次，不重骰。';
  if (c.type === 'REPORT') return !lifeContactOpen(l) && !physicalCleanupBlock(l) && r.status === 'EXAMINED' ? null : '先实际停术、归水归物、原人返回、本人退出并关闭现场。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在实际进行的同一案现场。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return physicalCleanupBlock(l) ?? (a.inspected ? null : '先核实本次实际结果和原物原人收束。');
  if (c.type === 'STOP_EFFECT') return unstoppedUse(a) ? null : '当前没有尚待明确停止的本次能力；不重复停止或退款。';
  if (c.type === 'RECOVER_BUOY') return p.playerPosition === 'CONTROL' && !unstoppedUse(a) && a.buoyMoved && !a.buoyRecovered && p.buoy.offsetMetres === 8 && p.winch.durability > 0 && p.mooring.durability > 0 ? null : '须先停止风浪，再本人用原轮具实拉确已移出的同一浮标；原索、轮具须仍可用。';
  if (c.type === 'DRAIN_WATER') return p.playerPosition === 'CONTROL' && !unstoppedUse(a) && p.water.channelUnits > 0 && !a.waterDrained ? null : '先停止压力，再本人经现成原回流道排回实际水量；闭闸不堵此普通回流道。';
  if (c.type === 'CLOSE_GATE') return p.playerPosition === 'CONTROL' && p.gate.position === 'OPEN' && p.gate.durability > 0 && a.gateOpened && !a.gateClosed ? null : '须本人实际在控制位，原闸已打开且未关回；一次手动关闸仍耗2秒、耐久1。';
  if (c.type === 'RETURN_KEEPER') return p.playerPosition === 'CONTROL' && a.keeperCleared && !a.keeperReturned && p.keeper.position === 'EXIT' && p.keeper.energy >= 2 && !unstoppedUse(a) && p.buoy.offsetMetres === 0 && p.water.channelUnits === 0 && p.gate.position === 'CLOSED' ? null : '先停术、归浮标、排水并关闸，再让原诺拉沿6米干路实际返回；仍耗2精力。';
  if (c.type === 'EXIT_SITE') return a.entered && !a.exited && p.playerPosition === 'CONTROL' && p.keeper.position === 'CONTROL' && !unstoppedUse(a) && p.buoy.offsetMetres === 0 && p.water.channelUnits === 0 && p.gate.position === 'CLOSED' ? null : '先真实收束水、闸、浮标和原人，再本人沿2米干路退出。';
  if (c.type === 'INSPECT') {
    if (a.inspected) return '已经核实本次真实结果，请关闭现场。';
    const cleanup = physicalCleanupBlock(l); if (cleanup) return cleanup;
    if (!a.sourceRead) return '先在原入口核对当前原物、原主与原水来源。';
    if (a.ownerConsent === 'DECLINED') return null;
    if (!a.entered || !a.exited || !a.boundaryChecked || !a.keeperCleared || !a.keeperReturned) return '须记录真实进出、实测边界与原人的实际往返。';
    if (c.caseId === 'withdrawn-request') return a.consentWithdrawn || a.gateBlocked ? null : '须实际读到本次撤回，或亲眼核见当前闭闸阻断。';
    if (c.caseId === 'buoy-return') return a.mooringChecked ? null : '须普通核实同一浮标与原系索；能力没移成也如实记录。';
    return a.wheelTurned || a.pressure.attempts > 0 ? null : '须实际转过原轮，或保留真实付费压力尝试并收束；不能凭空记轮转。';
  }
  if (a.inspected) return '本案已经核实，请关闭现场。';
  if (c.type === 'READ_SOURCE') return !a.sourceRead && !a.entered ? null : '每案在原入口核对一次原主、20单位原水及同一组原物。';
  if (c.type === 'CONSENT_OWNER' || c.type === 'DECLINE_OWNER') return a.sourceRead && a.ownerConsent === 'UNASKED' && !a.entered && p.keeper.position === 'CONTROL' ? null : '须当面询问同一原诺拉本次当前许可；旧案同意不能沿用。';
  if (c.type === 'AGREE_RETURN') return permitted(a, week) && !a.returnAgreed && !a.entered ? null : '须本次当前同意，先约定停止、原水回流和原物普通归位。';
  if (c.type === 'ENTER_SITE') return permitted(a, week) && a.returnAgreed && !a.entered && p.playerPosition === 'EXIT' ? null : '须本次同意及收束约定，再本人沿2米原干路到控制位。';
  if (c.type === 'CHECK_GATE') return a.entered && !a.exited && p.playerPosition === 'CONTROL' && (!a.gateChecked || (p.gate.position === 'CLOSED' && !a.gateBlocked)) ? null : '须本人在控制位查看当前真实闸位；同一已核状态不重复。';
  if (c.type === 'CHECK_MOORING') return c.caseId === 'buoy-return' && a.entered && !a.exited && p.playerPosition === 'CONTROL' && !unstoppedUse(a) && p.buoy.offsetMetres === 0 && !a.mooringChecked ? null : '先停术并将确已偏移的浮标归位，再普通核实同一系泊；未移成也可如实检查。';
  if (c.type === 'WAIT_10') return a.entered && !a.exited && a.waits < 3 ? null : '实际入场后每案最多等待三次10秒；等待不补水、不续窗。';
  if (!permitted(a, week) || !a.entered || a.exited || p.playerPosition !== 'CONTROL') return '本次当前许可或实际位置不成立；只能停术、归物排水、关闸并普通退出。';
  if (c.type === 'CHECK_BOUNDARY') return !a.boundaryChecked ? null : '本次已实际核对12米有限作用边界与原干路。';
  if (c.type === 'CLEAR_KEEPER') return a.boundaryChecked && !a.keeperCleared && p.keeper.position === 'CONTROL' && p.keeper.energy >= 4 ? null : '须先核实边界与干路；诺拉须至少有4精力支付真实往返，不能瞬移清场。';
  if (!a.keeperCleared || a.keeperReturned || p.keeper.position !== 'EXIT') return '先让原诺拉沿6米干路实际退出作用范围；风水没有自动友军免疫。';
  if (c.type === 'CHECK_CONTINUATION') return c.caseId === 'withdrawn-request' && !a.continuationChecked ? null : '仅第三案可读取诺拉这一次明确撤回；撤回不是永久操控她的意愿。';
  if (c.type === 'OPEN_GATE') return c.caseId !== 'buoy-return' && !a.gateOpened && p.gate.position === 'CLOSED' && p.gate.durability > 1 ? null : '须本次许可及原闸当前关闭，保留真正关回所需耐久；每案最多开一次。';
  if (c.type === 'ADMIT_WATER') return c.caseId !== 'buoy-return' && p.gate.position === 'OPEN' && !a.waterAdmitted && p.water.channelUnits === 0 && p.water.bayUnits >= 4 ? null : '须原闸确实打开，再用4秒把同一湾内4单位原水引入既有水道；不凭空补水。';
  if (c.type === 'STORM_FIELD' || c.type === 'WATER_PRESSURE') {
    if (a.method !== 'ABILITY' || a.storm.attempts + a.pressure.attempts > 0) return '须有限能力准备；每案最多一次付费能力检定，失败不重抽。';
    if (c.type === 'STORM_FIELD') return c.caseId !== 'wheel-return' && p.water.bayUnits > 0 && p.mooring.durability > 0 && p.winch.durability > 0 && p.buoy.offsetMetres === 0 ? null : '有限风浪须真实湾水、仍完好的同一系索与轮具；不隔空生成浮标或水。';
    return c.caseId !== 'buoy-return' && p.gate.position === 'OPEN' && p.water.channelUnits >= 4 && a.waterAdmitted && p.wheel.durability > 0 ? null : '原水压力须原闸当前打开，且同一原水道确已引入4单位湾水；闭闸或无水时零消费拒绝。';
  }
  if (c.type === 'MOVE_BUOY') return c.caseId === 'buoy-return' && a.storm.state === 'ACTIVE' && a.storm.remainingSeconds >= 2 && !a.buoyMoved && p.buoy.offsetMetres === 0 && p.water.bayUnits > 0 && p.mooring.durability > 0 && p.winch.durability > 0 ? null : '须本案付费成功风浪窗还余2秒，才能把同一原浮标实际移至8米；第三案没有物体作用许可。';
  if (c.type === 'DRIVE_WHEEL') return c.caseId === 'wheel-return' && a.pressure.state === 'ACTIVE' && a.pressure.remainingSeconds >= 2 && !a.wheelTurned && p.gate.position === 'OPEN' && p.water.channelUnits >= 4 && p.wheel.durability > 0 ? null : '须本案成功压力窗还余2秒、当前开闸且原水足够，才实际推原轮一转；闭闸不补抽检定。';
  if (c.type === 'MANUAL_WHEEL') return c.caseId === 'wheel-return' && !a.wheelTurned && !unstoppedUse(a) && p.wheel.durability > 0 ? null : '先停止本次能力，再用原轮现成手柄普通转动；仍磨损1，不计能力应用。';
  return '未知的本次实际步骤。';
}
const commandCost = (c: CatastropheActivityCommand) => ({ actions: ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: c.type === 'STORM_FIELD' ? 7 : c.type === 'WATER_PRESSURE' ? 6 : 0 });
export function blockCatastropheLife(s: SliceState, c: CatastropheActivityCommand): string | null {
  if (!validateCatastropheActivityCommand(c)) return '天灾生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着且当前确为天灾·暴君序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德同一原小湾。';
  if (hasSeaKingLifeLock(s) || ['READY', 'FIGHTING'].includes(s.seaKing.encounter.status) || s.catastrophe.preparedWeek !== null) return '先实际收束旧海王现场与当次服药准备。';
  if (s.catastrophe.encounter.status !== 'AVAILABLE') return '三案已关闭，原小湾当前状态由同一后续遭遇继续；旧生活现场不能重开或重置。';
  const reason = localBlock(s.catastrophe.life, c, s.week); if (reason) return reason;
  const cost = commandCost(c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备须保留1行动实际实施。停止与普通收尾仍为0行动。';
  if (cost.spirituality > 0 && s.mind <= 0) return '当前精神不足以施术；仍可0行动停止与普通收尾。';
  if (s.spirituality < cost.spirituality) return '本次灵性不足；不会免费成功或重新抽取，仍可停止与普通收尾。';
  return null;
}
function elapse(l: CatastropheLifeState, a: CatastropheAttempt, seconds: number) {
  l.site.clockSeconds += seconds; a.elapsedSeconds += seconds;
  for (const use of [a.storm, a.pressure]) if (use.state === 'ACTIVE') {
    use.remainingSeconds = Math.max(0, use.remainingSeconds - seconds);
    if (use.remainingSeconds === 0) use.state = 'EXPIRED';
  }
}
function checkSource(l: CatastropheLifeState, c: CatastropheActivityCommand): CatastropheCheckSource | null {
  if (c.type !== 'STORM_FIELD' && c.type !== 'WATER_PRESSURE') return null;
  const a = current(l)!, p = l.site, storm = c.type === 'STORM_FIELD';
  return { caseId: c.caseId, siteId: p.id, abilityId: storm ? 'tyrant.s2.storm-field' : 'tyrant.s2.water-pressure', cost: storm ? 7 : 6,
    at: p.clockSeconds, boundaryMetres: p.boundaryMetres, ownerId: p.keeper.id, ownerConsentWeek: a.ownerConsentWeek!, playerPosition: p.playerPosition, keeperPosition: p.keeper.position,
    waterId: p.water.id, bayUnits: p.water.bayUnits, channelUnits: p.water.channelUnits, gateId: p.gate.id, gatePosition: p.gate.position, gateDurability: p.gate.durability,
    objectId: storm ? p.buoy.id : p.wheel.id, objectDurability: storm ? p.mooring.durability : p.wheel.durability };
}
/** Deterministic finite-scene replay. No old objects, bodies, RNG or global resource fields are edited here. */
function evolve(l: CatastropheLifeState, c: CatastropheActivityCommand, week: number, tier: PublicResolutionTier | null) {
  if (c.type === 'REFLECT') { l.reflected = true; return; }
  const r = l.cases[c.caseId], p = l.site;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; r.preparations++; return; }
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; return; }
  if (c.type === 'PERFORM') { r.status = 'ACTIVE'; r.contactOpen = true; l.activeCase = c.caseId; r.attempts.push(freshAttempt(week, r.method!)); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a.closed = true; a.ownerConsent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; l.activeCase = null; return; }
  switch (c.type) {
    case 'READ_SOURCE': a.sourceRead = true; elapse(l, a, 2); break;
    case 'CONSENT_OWNER': case 'DECLINE_OWNER': a.ownerConsent = c.type === 'CONSENT_OWNER' ? 'GRANTED' : 'DECLINED'; a.ownerConsentWeek = week; elapse(l, a, 2); break;
    case 'AGREE_RETURN': a.returnAgreed = true; elapse(l, a, 2); break;
    case 'ENTER_SITE': case 'EXIT_SITE': {
      const enter = c.type === 'ENTER_SITE'; if (enter) a.entered = true; else a.exited = true;
      p.playerPosition = enter ? 'CONTROL' : 'EXIT'; p.playerTravelMetres += 2; a.playerTravelMetres += 2; elapse(l, a, 2); break;
    }
    case 'CHECK_BOUNDARY': a.boundaryChecked = true; elapse(l, a, 2); break;
    case 'CLEAR_KEEPER': case 'RETURN_KEEPER': {
      const clear = c.type === 'CLEAR_KEEPER'; if (clear) a.keeperCleared = true; else a.keeperReturned = true;
      p.keeper.position = clear ? 'EXIT' : 'CONTROL'; p.keeper.travelMetres += 6; p.keeper.energy -= 2; a.keeperTravelMetres += 6; a.keeperEnergySpent += 2; elapse(l, a, 6); break;
    }
    case 'CHECK_GATE': a.gateChecked = true; if (p.gate.position === 'CLOSED') a.gateBlocked = true; elapse(l, a, 1); break;
    case 'OPEN_GATE': case 'CLOSE_GATE': {
      const open = c.type === 'OPEN_GATE'; if (open) a.gateOpened = true; else a.gateClosed = true;
      p.gate.operations++; p.gate.durability--; p.gate.position = p.gate.durability === 0 ? 'BROKEN' : open ? 'OPEN' : 'CLOSED'; elapse(l, a, 2); break;
    }
    case 'ADMIT_WATER': p.water.bayUnits -= 4; p.water.channelUnits += 4; a.waterAdmitted = true; elapse(l, a, 4); break;
    case 'STORM_FIELD': case 'WATER_PRESSURE': {
      const storm = c.type === 'STORM_FIELD', use = storm ? a.storm : a.pressure, passed = success(tier);
      elapse(l, a, 2); a.spiritualitySpent += storm ? 7 : 6; use.attempts++; use.successes += passed ? 1 : 0;
      use.tier = tier; use.state = passed ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = passed ? 10 : 0; break;
    }
    case 'MOVE_BUOY': p.buoy.offsetMetres = 8; a.buoyMoved = true; a.storm.effects++; a.appliedAbilityIds.push('tyrant.s2.storm-field'); elapse(l, a, 2); break;
    case 'DRIVE_WHEEL': case 'MANUAL_WHEEL': {
      p.wheel.turns++; p.wheel.durability--; a.wheelTurned = true;
      if (c.type === 'DRIVE_WHEEL') { a.pressure.effects++; a.appliedAbilityIds.push('tyrant.s2.water-pressure'); }
      else a.manualWheel = true;
      elapse(l, a, c.type === 'DRIVE_WHEEL' ? 2 : 4); break;
    }
    case 'CHECK_CONTINUATION': a.continuationChecked = true; a.consentWithdrawn = true; a.ownerConsent = 'WITHDRAWN'; elapse(l, a, 1); break;
    case 'STOP_EFFECT': for (const use of [a.storm, a.pressure]) if (use.attempts > 0 && !use.stopped) { use.state = 'STOPPED'; use.remainingSeconds = 0; use.stopped = true; } break;
    case 'RECOVER_BUOY': p.buoy.offsetMetres = 0; p.mooring.durability--; p.winch.durability--; a.buoyRecovered = true; elapse(l, a, 8); break;
    case 'DRAIN_WATER': p.water.bayUnits += p.water.channelUnits; p.water.channelUnits = 0; a.waterDrained = true; elapse(l, a, 4); break;
    case 'CHECK_MOORING': a.mooringChecked = true; elapse(l, a, 2); break;
    case 'WAIT_10': a.waits++; elapse(l, a, 10); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length > 0 ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, a, 2); break;
  }
}
export function applyCatastropheActivity(s: SliceState, c: CatastropheActivityCommand, ctx: SeerContext): void {
  const reason = blockCatastropheLife(s, c); if (reason) throw new Error(reason);
  const l = s.catastrophe.life, source = checkSource(l, c), paid = commandCost(c);
  const budget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality };
  let tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null, check: PublicCheckResult | null = null;
  s.actionsRemaining -= paid.actions; s.spirituality -= paid.spirituality;
  if (c.type === 'STORM_FIELD' || c.type === 'WATER_PRESSURE') {
    randomBefore = s.random.cursor; check = structuredClone(ctx.check(c.type === 'STORM_FIELD' ? 'will' : 'knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor;
  }
  evolve(l, c, s.week, tier); l.journal.push({ week: s.week, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, paid, budget });
  if (c.type === 'REPORT') {
    const a = l.cases[c.caseId].attempts.at(-1)!; s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const id of a.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const a = current(l) ?? ('caseId' in c ? l.cases[c.caseId].attempts.at(-1) : null), p = l.site;
  ctx.note(`原小湾有限实践：${LABELS[c.type]}`, `原创G；${tier ?? '普通实际步骤'}。本人${p.playerPosition}，原诺拉${p.keeper.position}/精力${p.keeper.energy}；同一原水湾${p.water.bayUnits}+水道${p.water.channelUnits}=20，原闸${p.gate.position}/耐${p.gate.durability}，浮标偏移${p.buoy.offsetMetres}米，原轮累计${p.wheel.turns}转/耐${p.wheel.durability}。${a ? `本次当前许可${a.ownerConsent}，实耗${a.spiritualitySpent}灵性/${a.elapsedSeconds}秒；风浪尝试/成功/应用${a.storm.attempts}/${a.storm.successes}/${a.storm.effects}，压力${a.pressure.attempts}/${a.pressure.successes}/${a.pressure.effects}。` : ''}成功窗口、实际应用与普通收束分别保留，不恢复原水或原物耐久。`);
}
const LABELS: Record<string, string> = {
  OBSERVE: '观察本案真实原场', PREPARE: '准备本次有限实践', PERFORM: '进入本次实际接触', REPORT: '如实报告本次结果', REFLECT: '反思当前许可、原水与普通归还', CLOSE: '关闭已实际收束现场', WITHDRAW: '退出准备或已收束现场',
  READ_SOURCE: '入口核对原诺拉、原水与原物', CONSENT_OWNER: '询问并记录诺拉本次同意', DECLINE_OWNER: '尊重诺拉本次最初拒绝', AGREE_RETURN: '约定停术与同一原水原物归位', ENTER_SITE: '本人沿2米原干路到控制位', CHECK_BOUNDARY: '实测12米作用边界与原干路', CLEAR_KEEPER: '原诺拉沿6米干路实际退出', CHECK_GATE: '亲眼核见原闸当前状态', OPEN_GATE: '亲手打开同一原闸', ADMIT_WATER: '原湾4单位海水实际引入水道', STORM_FIELD: '付费尝试有限风浪窗口', MOVE_BUOY: '在有效风浪窗内实际移动原浮标', WATER_PRESSURE: '付费尝试同一原水压力窗口', DRIVE_WHEEL: '在有效压力窗内实际推原轮一转', MANUAL_WHEEL: '用原轮现成手柄普通转一圈', CHECK_CONTINUATION: '询问继续并读取诺拉当前撤回', STOP_EFFECT: '明确停止本次有限效果', RECOVER_BUOY: '用原轮具实拉同一浮标归位', DRAIN_WATER: '同一原水经既有回流道实际排回', CLOSE_GATE: '亲手关闭同一原闸', CHECK_MOORING: '普通检查原浮标与系泊', RETURN_KEEPER: '原诺拉沿6米干路实际返回', EXIT_SITE: '本人沿2米原干路实际退出', WAIT_10: '实际等待10秒，不续窗', INSPECT: '核实本次真实结果及原人原物收束',
};
const COSTS: Partial<Record<string, string>> = {
  READ_SOURCE: '0行动 · 2秒G', CONSENT_OWNER: '0行动 · 当面2秒G · 只限本案本周', DECLINE_OWNER: '0行动 · 当面2秒G', AGREE_RETURN: '0行动 · 2秒G', ENTER_SITE: '0行动 · 本人2米/2秒G', CHECK_BOUNDARY: '0行动 · 2秒G', CLEAR_KEEPER: '0行动 · 原人6米/6秒 · 2精力G', CHECK_GATE: '0行动 · 1秒G · 不改变闸或水', OPEN_GATE: '0行动 · 2秒 · 原闸耐久−1G', ADMIT_WATER: '0行动 · 4秒 · 湾−4/水道+4单位G', STORM_FIELD: '0行动 · 7灵性 · 意志20 · 2秒施用/成功最多10秒G', MOVE_BUOY: '0行动 · 2秒 · 同一浮标至8米G', WATER_PRESSURE: '0行动 · 6灵性 · 知识20 · 2秒施用/成功最多10秒G', DRIVE_WHEEL: '0行动 · 2秒 · 原轮1转/耐久−1G', MANUAL_WHEEL: '0行动 · 4秒 · 原轮1转/耐久−1G · 不奖掌握', CHECK_CONTINUATION: '0行动 · 当面1秒G · 当前撤回，仍须明确停术', STOP_EFFECT: '0行动0秒 · 不退灵性、不移人、不归水', RECOVER_BUOY: '0行动 · 8秒 · 原索与原轮具各耐久−1G', DRAIN_WATER: '0行动 · 4秒G · 同一水道原水回湾，闭闸也可排回', CLOSE_GATE: '0行动 · 2秒 · 原闸耐久−1G', CHECK_MOORING: '0行动 · 2秒G · 未移成也如实检查', RETURN_KEEPER: '0行动 · 原人6米/6秒 · 2精力G', EXIT_SITE: '0行动 · 本人2米/2秒G', WAIT_10: '0行动 · 10秒G · 每案最多三次', INSPECT: '0行动 · 2秒G', CLOSE: '0行动0秒 · 只关闭已真实收束的场景', WITHDRAW: '0行动0秒 · 原水原物须先收束，不退款', REPORT: '1行动 · 扮演25 · 实际应用的新技能各最多+8G', REFLECT: '1行动 · 三实际报告后扮演25G',
};
export function catastropheLifeActions(s: SliceState): CatastropheLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.catastrophe.life, out: CatastropheLifeAction[] = [];
  const add = (command: CatastropheActivityCommand) => {
    const reason = blockCatastropheLife(s, command);
    out.push({ id: `CT2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}`,
      label: `${LABELS[command.type]}${'method' in command ? command.method === 'ABILITY' ? '（有限能力）' : '（普通方法）' : ''}`,
      cost: COSTS[command.type] ?? (command.type === 'PREPARE' ? '1行动 · 须至少剩2行动' : '1行动'), enabled: reason === null, reason, command });
  };
  for (const caseId of CATASTROPHE_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add({ type: 'PREPARE', caseId, method });
    if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId }); add({ type: 'WITHDRAW', caseId }); }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    for (const type of STEPS) {
      if (r.method === 'ORDINARY' && ['STORM_FIELD', 'WATER_PRESSURE', 'MOVE_BUOY', 'DRIVE_WHEEL'].includes(type)) continue;
      if (caseId === 'buoy-return' && ['OPEN_GATE', 'ADMIT_WATER', 'WATER_PRESSURE', 'DRIVE_WHEEL', 'MANUAL_WHEEL', 'CHECK_CONTINUATION'].includes(type)) continue;
      if (caseId === 'wheel-return' && ['STORM_FIELD', 'MOVE_BUOY', 'RECOVER_BUOY', 'CHECK_MOORING', 'CHECK_CONTINUATION'].includes(type)) continue;
      if (caseId === 'withdrawn-request' && ['MOVE_BUOY', 'DRIVE_WHEEL', 'MANUAL_WHEEL', 'RECOVER_BUOY', 'CHECK_MOORING'].includes(type)) continue;
      add({ type, caseId });
    }
    add({ type: 'CLOSE', caseId }); add({ type: 'WITHDRAW', caseId });
  }
  if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
export function projectCatastropheLife(s: SliceState): CatastropheLifeProjection {
  const l = s.catastrophe.life, p = l.site;
  return { title: '同一原水、原浮标、原闸与当前许可', story: CATASTROPHE_LIFE_STORY,
    environment: '原创G·CT2-COVE：仅12米有限作用边界。同一20单位海水只在原湾与既有水道间转移；水道另有既有普通回流道，闭闸仍可用4秒排回。本人沿2米干路至原控制位，诺拉沿独立6米干路到范围外，每次往返各耗2精力；控制位及普通出口均为既有干地，实际清场不等于风水自动友军免疫。一枚原浮标始终系原索，原轮具、闸和工作轮一直归同一诺拉；所有磨损累积。后续可选冲突继续使用这一份原水与原物，生活尝试中的位置只是当时历史。',
    activeCase: l.activeCase, inside: hasCatastropheLifeLock(s), insideCase: lifeContactOpen(l), reflected: l.reflected,
    site: structuredClone(p), clockSeconds: p.clockSeconds, playerLocation: p.playerPosition, playerTravelMetres: p.playerTravelMetres,
    currentAttempt: structuredClone(current(l)), sitePhase: s.catastrophe.encounter.status === 'AVAILABLE' ? 'LIFE' : 'ENCOUNTER',
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story,
      observations: r.observedWeek === null ? [] : [d.story, '本案当前许可不从旧案继承；成功窗口不奖掌握，须真实作用于同一原物并完成报告。停止与普通收尾不需行动或灵性。'],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限能力确已移动同一原浮标或推动原轮；其后真实归位，付费、失败和磨损保留。' : '普通检查、原手柄转动或尊重当前拒绝/撤回后真实收束；未应用的成功窗口不奖掌握。',
      contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: catastropheLifeActions(s) };
}
/** Strict ordered source/check/cost/physical replay. Only encounter.startSite is an immutable replay input; it is never a second live water stock. */
export function validateCatastropheLife(s: SliceState): boolean {
  try {
    const l = s.catastrophe?.life, promotion = s.catastrophe?.promotionWeek, expected = createCatastropheLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !Array.isArray(l.journal) || l.journal.length > 600 || !validateCatastropheSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week)) return false;
    let lastWeek = promotion, nextCursor = 0, previous: CatastropheLifeEvent | null = null;
    for (const event of l.journal) {
      if (!record(event) || !shape(event, ['week', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'paid', 'budget']) || !integer(event.week, lastWeek, s.week) || !validateCatastropheActivityCommand(event.command)) return false;
      const c = event.command, cast = c.type === 'STORM_FIELD' || c.type === 'WATER_PRESSURE', cost = commandCost(c), b = event.budget;
      if ((lifeContactOpen(expected) && event.week !== lastWeek) || localBlock(expected, c, event.week)) return false;
      if (!same(event.source, checkSource(expected, c)) || !same(event.paid, cost) || !record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter']) ||
          !integer(b.actionsBefore) || !integer(b.actionsAfter) || !integer(b.spiritualityBefore, 0, 120) || !integer(b.spiritualityAfter, 0, 120) ||
          b.actionsAfter !== b.actionsBefore - cost.actions || b.spiritualityAfter !== b.spiritualityBefore - cost.spirituality || (c.type === 'PREPARE' && b.actionsBefore < 2)) return false;
      if (lifeContactOpen(expected) && previous && (b.actionsBefore !== previous.budget.actionsAfter || b.spiritualityBefore !== previous.budget.spiritualityAfter)) return false;
      if (cast) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || !integer(event.randomAfter, event.randomBefore + 1, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: c.type === 'STORM_FIELD' ? 'will' : 'knowledge', baseAbility: event.check.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || check.tier !== event.tier || random.cursor !== event.randomAfter) return false;
        nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.tier as PublicResolutionTier | null);
      if (!validateCatastropheSiteState(expected.site)) return false;
      expected.journal.push(structuredClone(event) as unknown as CatastropheLifeEvent); lastWeek = event.week; previous = event as unknown as CatastropheLifeEvent;
    }
    const encounter = s.catastrophe.encounter;
    if (encounter.status === 'AVAILABLE') { if (!same(l, expected)) return false; }
    else {
      if (lifeContactOpen(expected) || !Object.values(expected.cases).every(r => r.status === 'RESOLVED') || physicalCleanupBlock(expected) || !same(encounter.startSite, expected.site)) return false;
      if (!same({ ...l, site: expected.site }, expected)) return false;
    }
    if (lifeContactOpen(l) && (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || encounter.status !== 'AVAILABLE')) return false;
    const a = current(l); if (a && a.week !== s.week) return false;
    if (lifeContactOpen(l) && previous && (s.actionsRemaining !== previous.budget.actionsAfter || s.spirituality !== previous.budget.spiritualityAfter)) return false;
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['tyrant.s2.storm-field', 'tyrant.s2.water-pressure'] as const) if (s.progression.mastery[id] !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return false;
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
