import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasFerrymanLifeLock } from '../ferryman/life.js';
import { createDeathConsulSiteState, validateDeathConsulSiteState, introduceDeathConsulSite, advanceDeathConsulTime, stopDeathConsulEffects,
  DEATH_CONSUL_SOURCES, type DeathConsulSiteState, type DeathConsulLocation, type DeathConsulConsent, type DeathConsulSourceEra } from './resources.js';
export { createDeathConsulSiteState, validateDeathConsulSiteState, type DeathConsulSiteState, type DeathConsulLocation, type DeathConsulConsent, type DeathConsulSourceEra } from './resources.js';

/** Bounded authored practice: one original residual object and one newly introduced current adult. */
export const DEATH_CONSUL_CASE_IDS = ['pale-residue', 'short-passage', 'withdrawn-passage'] as const;
export const DEATH_CONSUL_ACTIVITY_CASE_IDS = DEATH_CONSUL_CASE_IDS;
export const ACTIVITY_CASE_IDS = DEATH_CONSUL_CASE_IDS;
export type DeathConsulCaseId = typeof DEATH_CONSUL_CASE_IDS[number];
export type DeathConsulLifeAbilityId = 'death.s2.pale-flame' | 'death.s2.spirit-passage';
export type DeathConsulWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'STOPPED';
const STEPS = ['CONSENT_OPERATOR', 'DECLINE_OPERATOR', 'BUY_SEAL', 'INSPECT_RESIDUAL', 'OPEN_CONTAINER', 'CLOSE_CONTAINER', 'SEAL_CONTAINER',
  'CHECK_ENDPOINTS', 'OPEN_DOOR', 'CLOSE_DOOR', 'BLOCK_DOOR', 'UNBLOCK_DOOR', 'TAKE_RESIDUAL', 'RETURN_RESIDUAL', 'APPLY_FLAME',
  'CROSS_PASSAGE', 'WALK_OUT', 'RETURN_GROUP', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_10', 'INSPECT'] as const;
export type DeathConsulActivityCommand =
  | { type: typeof STEPS[number] | 'OBSERVE' | 'PERFORM' | 'REPORT' | 'LEAVE' | 'CLOSE' | 'WITHDRAW'; caseId: DeathConsulCaseId }
  | { type: 'PREPARE'; caseId: DeathConsulCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' };
export interface DeathConsulAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  performed: boolean; interrupted: boolean; inspected: boolean; elapsedSeconds: number; spiritualitySpent: number; penniesSpent: number;
  playerTravelMetres: number; playerPassageMetres: number; operatorTravelMetres: number; operatorPassageMetres: number; operatorEnergySpent: number;
  operatorConsent: DeathConsulConsent; operatorConsentWeek: number | null; residualInspected: boolean; containerOpened: boolean;
  flameApplied: boolean; materialSpent: number; endpointsChecked: boolean; crossed: boolean; ordinaryOut: boolean; returned: boolean;
  permissionWithdrawn: boolean; effectStopped: boolean; waits: number; abilityTier: PublicResolutionTier | null;
  window: DeathConsulWindow; windowExpiresAt: number | null; appliedAbilityIds: DeathConsulLifeAbilityId[];
  siteAtStart: DeathConsulSiteState; siteAtClose: DeathConsulSiteState | null;
}
export interface DeathConsulCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  preparations: number; closes: number; withdrawals: number; attempts: DeathConsulAttempt[];
}
export interface DeathConsulCheckSource {
  caseId: DeathConsulCaseId; abilityId: DeathConsulLifeAbilityId; cost: 7 | 6; at: number; coreStat: 'will' | 'knowledge'; baseAbility: number;
  operatorConsentWeek: number; sourceEra: DeathConsulSourceEra; site: DeathConsulSiteState;
}
export interface DeathConsulLifeEvent {
  week: number; date: PublicGameDate; sourceEra: DeathConsulSourceEra; command: DeathConsulActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: DeathConsulCheckSource | null;
  paid: { actions: number; spirituality: number; pennies: number };
  budget: { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number };
}
export interface DeathConsulLifeState {
  activeCase: DeathConsulCaseId | null; reflected: boolean; site: DeathConsulSiteState;
  cases: Record<DeathConsulCaseId, DeathConsulCaseState>; journal: DeathConsulLifeEvent[];
}
export interface DeathConsulLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DeathConsulActivityCommand }
export interface DeathConsulLifeProjection {
  title: string; story: string; environment: string; activeCase: DeathConsulCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: DeathConsulSiteState; clockSeconds: number; playerLocation: DeathConsulLocation; playerTravelMetres: number; playerPassageMetres: number;
  currentAttempt: DeathConsulAttempt | null; sitePhase: 'LIFE' | 'ENCOUNTER';
  cases: { id: DeathConsulCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null;
    result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: DeathConsulAttempt[] }[];
  actions: DeathConsulLifeAction[];
}
export const DEATH_CONSUL_LIFE_STORY = '死亡执政官·死神序列2。先认识当代保管员和她带来的唯一封存罐，再练习苍白焰与灵界短渡。苍白焰消耗7灵性、意志20；短渡消耗6灵性、知识20。施术各用10秒，成功开20秒窗口，失败仍消耗。你须在窗口内实际处理原残余物，或与当前同意的成人携原罐越过6米，才算应用技巧。普通绕行12米，成人每程消耗2精力。观察、准备、实施、报告各需1行动；三份报告各25扮演，反思25；每案仅实际应用并报告的技巧增加8掌握。';
const CASES = [
  { id: 'pale-residue', title: '封存罐上的苍白焰', story: '先当面确认保管员本次许可，检查她带来的同一封存罐，再实购一份封材。打开原封后，可试着在20秒窗口内用4秒苍白焰消减残余回响。原罐会留下焦痕与余热，里面不是待复活的人。施术失败仍可按普通步骤合盖，等余热散去，再耗掉唯一封材重新封存。' },
  { id: 'short-passage', title: '两室间的真实短渡', story: '两室直距6米，普通绕道12米。你先实走两端检查，再取得保管员本次同意，拿起同一封存罐，支付施术费用。仅有效窗口内才能让你、她和这只原罐一起越过6米。之后停止通路，两人带原罐沿12米普通路返回；失败也可实际普通绕行，不会因此获得短渡掌握。' },
  { id: 'withdrawn-passage', title: '准备之后，她改变主意', story: '再次实走核对两端，取得新的当前同意，支付本次施术费用。保管员随后会明确撤回许可。读取她这次决定，停止通路，把同一原罐放回，普通结束接触。这次不运输她，也不因一次未应用的成功增加掌握。' },
] as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 2;
const freshCase = (): DeathConsulCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, preparations: 0, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', site: DeathConsulSiteState): DeathConsulAttempt {
  return { week, method, closed: false, result: 'NONE', performed: false, interrupted: false, inspected: false, elapsedSeconds: 0, spiritualitySpent: 0, penniesSpent: 0,
    playerTravelMetres: 0, playerPassageMetres: 0, operatorTravelMetres: 0, operatorPassageMetres: 0, operatorEnergySpent: 0,
    operatorConsent: 'UNASKED', operatorConsentWeek: null, residualInspected: false, containerOpened: false, flameApplied: false, materialSpent: 0,
    endpointsChecked: false, crossed: false, ordinaryOut: false, returned: false, permissionWithdrawn: false, effectStopped: false, waits: 0,
    abilityTier: null, window: 'NONE', windowExpiresAt: null, appliedAbilityIds: [], siteAtStart: structuredClone(site), siteAtClose: null };
}
export function createDeathConsulLifeState(): DeathConsulLifeState {
  return { activeCase: null, reflected: false, site: createDeathConsulSiteState(), cases: { 'pale-residue': freshCase(), 'short-passage': freshCase(), 'withdrawn-passage': freshCase() }, journal: [] };
}
const current = (l: DeathConsulLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: DeathConsulLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
export const deathConsulLifeClosed = (s: SliceState): boolean => !contactOpen(s.deathConsul.life) && Object.values(s.deathConsul.life.cases).every(r => r.status === 'RESOLVED');
export const hasDeathConsulLifeLock = (s: SliceState): boolean => contactOpen(s.deathConsul.life) || s.deathConsul.encounter.status === 'AVAILABLE' && physicalCleanupBlock(s.deathConsul.life) !== null;
export const deathConsulInside = hasDeathConsulLifeLock;
export function validateDeathConsulActivityCommand(v: unknown): v is DeathConsulActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!DEATH_CONSUL_CASE_IDS.includes(v.caseId as DeathConsulCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && [...STEPS, 'OBSERVE', 'PERFORM', 'REPORT', 'LEAVE', 'CLOSE', 'WITHDRAW'].includes(String(v.type));
}
export const isDeathConsulActivityCommand = validateDeathConsulActivityCommand;
export const isDeathConsulActivity = validateDeathConsulActivityCommand;
function physicalCleanupBlock(l: DeathConsulLifeState): string | null {
  const p = l.site, a = current(l);
  if (p.effect.mode !== 'OFF' || a?.performed && a.spiritualitySpent > 0 && !a.effectStopped) return '先明确停止本次作用；失败或过期也须确认停止，不退还灵性。';
  if (p.door.state === 'OPEN') return '先亲手关回两室间的门；停止作用不会替你关门。';
  if (p.residual.container !== 'CLOSED' || p.residual.seal === 'BROKEN') return '同一封存罐还未合盖并重新封存，须使用已实购的封材。';
  if (p.residual.heatSeconds !== 0) return '原罐仍有余热，须实际等它冷却，不能靠退出清除。';
  if (p.residual.location !== 'ENTRY_STAND') return '先把同一封存罐实际带回并放到近室原架。';
  if (p.operatorLocation !== 'ENTRY') return '保管员仍在另一室，须沿普通路真实返回。';
  return p.playerLocation === 'ENTRY' ? null : '你还须沿普通路实际回到近室入口。';
}
const allowed = (l: DeathConsulLifeState, week: number) => l.site.operatorConsent === 'GRANTED' && l.site.operatorConsentWeek === week;
const inactive = (l: DeathConsulLifeState) => l.site.effect.mode === 'OFF';
function localBlock(l: DeathConsulLifeState, c: DeathConsulActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !contactOpen(l) && !physicalCleanupBlock(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先如实报告三案，再完成一次反思。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), p = l.site, index = DEATH_CONSUL_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[DEATH_CONSUL_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '按顺序观察本案，先收束前一处接触。';
  if (c.type === 'PREPARE') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'OBSERVED' && r.attempts.length === 0 && !Object.values(l.cases).some(x => x.attempts.some(t => t.week === week)) ? null : '须已观察且现场收束；每案只准备一次，每周只准备一案。';
  if (c.type === 'REPORT') return !contactOpen(l) && !physicalCleanupBlock(l) && r.status === 'EXAMINED' ? null : '先核实真实结果，实际停止、归物、返回并离开，再报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在准备或进行的同一案现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return physicalCleanupBlock(l) ?? (a.inspected ? null : '先核实这次结果；中途放弃也须如实记录。');
  if (c.type === 'STOP') return p.effect.mode !== 'OFF' || a.performed && a.spiritualitySpent > 0 && !a.effectStopped ? null : '本次没有尚待停止的作用，不重复退款或移动原物。';
  if (c.type === 'RETURN_GROUP') return p.playerLocation === 'FAR' && p.operatorLocation === 'FAR' && p.residual.location === 'PLAYER' && p.operatorEnergy >= 2 && inactive(l) ? null : '须先停止作用，两人与原罐确实在另一室，才可沿12米普通路返回；保管员仍需2精力。';
  if (c.type === 'RETURN_RESIDUAL') return p.playerLocation === 'ENTRY' && p.residual.location === 'PLAYER' && inactive(l) ? null : '须本人实际带原罐回到近室，停止作用后亲手放回原架。';
  if (c.type === 'CLOSE_CONTAINER') return c.caseId === 'pale-residue' && p.playerLocation === 'ENTRY' && p.residual.location === 'ENTRY_STAND' && p.residual.container === 'OPEN' && inactive(l) ? null : '须先停止苍白焰，再在近室原架前亲手合上同一罐盖。';
  if (c.type === 'SEAL_CONTAINER') return c.caseId === 'pale-residue' && p.playerLocation === 'ENTRY' && p.residual.location === 'ENTRY_STAND' && p.residual.container === 'CLOSED' && p.residual.seal === 'BROKEN' && p.residual.heatSeconds === 0 && p.material.remaining === 1 && inactive(l) ? null : '原罐须已合盖、实际冷却，且仍有实购的一份原封材；这一步会耗尽它。';
  if (c.type === 'CLOSE_DOOR' || c.type === 'UNBLOCK_DOOR') return p.playerLocation === 'ENTRY' && inactive(l) && p.door.state === (c.type === 'CLOSE_DOOR' ? 'OPEN' : 'BLOCKED') ? null : '须本人在近室且已停止作用，再实走到门边处理原门。';
  if (c.type === 'WAIT_10') return a.performed && a.waits < 4 ? null : '实施后每案最多实际等四次10秒；等待不会续窗或补充原物。';
  if (c.type === 'INSPECT') return !a.inspected && a.operatorConsentWeek === week && !physicalCleanupBlock(l) && (c.caseId !== 'withdrawn-passage' || !a.performed || a.permissionWithdrawn) ? null : '先记录本案同意或拒绝，实际收尾人、原罐与作用；末案实施后还须读取她当前撤回的决定。';
  if (a.inspected) return '本案已核实，请离开并报告。';
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'DECLINE_OPERATOR') return a.operatorConsent === 'UNASKED' && !a.performed && p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' ? null : '须在近室当面询问这次许可，不能沿用上案同意。';
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'withdrawn-passage' && a.performed && !a.permissionWithdrawn && allowed(l, week) && p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' ? null : '须已支付并实施本次准备，再当面读取保管员当前撤回的决定；本次不运输她。';
  if (!allowed(l, week)) return '保管员尚未同意本案，或当前许可已撤回；仍可停止并普通收尾。';
  if (c.type === 'BUY_SEAL') return c.caseId === 'pale-residue' && !a.performed && !p.material.acquired && p.playerLocation === 'ENTRY' ? null : '本案实施前可实购唯一一份封材，不随失败或换案补充。';
  if (c.type === 'INSPECT_RESIDUAL') return c.caseId === 'pale-residue' && !a.performed && !a.residualInspected && p.playerLocation === 'ENTRY' && p.residual.location === 'ENTRY_STAND' && p.residual.container === 'CLOSED' ? null : '须本人站在近室原架前，实际检查这只仍封闭的原罐。';
  if (c.type === 'OPEN_CONTAINER') return c.caseId === 'pale-residue' && a.residualInspected && !a.containerOpened && !a.performed && p.material.remaining === 1 && p.residual.container === 'CLOSED' && p.residual.seal === 'ORIGINAL' ? null : '先实际检查并购得收尾所需封材，才能拆开这只原罐的旧封。';
  if (c.type === 'CHECK_ENDPOINTS') return c.caseId !== 'pale-residue' && !a.performed && !a.endpointsChecked && p.playerLocation === 'ENTRY' && p.residual.location === 'ENTRY_STAND' && inactive(l) ? null : '须施术前由本人沿12米普通路往返两室，检查两处实际端点，再回近室；原罐留原架。';
  if (c.type === 'OPEN_DOOR' || c.type === 'BLOCK_DOOR') return !a.performed && p.playerLocation === 'ENTRY' && inactive(l) && p.door.state === 'CLOSED' ? null : '本人须在近室且尚未施术，再走到原门前打开它或放下原门闩。';
  if (c.type === 'TAKE_RESIDUAL') return c.caseId !== 'pale-residue' && !a.performed && a.endpointsChecked && p.playerLocation === 'ENTRY' && p.residual.location === 'ENTRY_STAND' && p.residual.container === 'CLOSED' && p.residual.seal !== 'BROKEN' && p.residual.heatSeconds === 0 ? null : '须已实查两端，亲手拿起已封好、已冷却的同一原罐。';
  if (c.type === 'PERFORM') {
    if (r.status !== 'PREPARED' || a.performed || p.playerLocation !== 'ENTRY' || p.operatorLocation !== 'ENTRY' || !inactive(l)) return '须完成本案准备、两人仍在近室且没有旧作用；每案只实施一次。';
    if (c.caseId === 'pale-residue') return a.residualInspected && a.containerOpened && p.residual.container === 'OPEN' && p.material.remaining === 1 ? null : '先检查并实际打开原罐，保留一份实购封材供收尾。';
    return a.endpointsChecked && p.residual.location === 'PLAYER' && p.operatorEnergy >= 4 ? null : '先真实核对两端并拿起原罐，保管员须留足往返4精力。';
  }
  if (c.type === 'APPLY_FLAME') return c.caseId === 'pale-residue' && a.performed && !a.flameApplied && p.playerLocation === 'ENTRY' && p.residual.location === 'ENTRY_STAND' && p.residual.container === 'OPEN' && p.residual.scorch === 0 && p.effect.mode === 'PALE_FLAME' && p.effect.expiresAt !== null && p.effect.expiresAt - p.elapsedSeconds >= 4 ? null : '苍白焰窗口须还够4秒，原罐仍开着且就在面前；只消减这份有限残余物。';
  if (c.type === 'CROSS_PASSAGE') return c.caseId === 'short-passage' && a.performed && !a.crossed && !a.ordinaryOut && a.endpointsChecked && p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' && p.operatorEnergy >= 4 && p.residual.location === 'PLAYER' && p.effect.mode === 'PASSAGE' && p.effect.expiresAt !== null && p.effect.expiresAt - p.elapsedSeconds >= 6 ? null : '须本案当前许可有效、两处端点已实查、两人与原罐都在近室，窗口还够6秒；末案的撤回不允许运输。';
  if (c.type === 'WALK_OUT') return c.caseId === 'short-passage' && a.performed && !a.crossed && !a.ordinaryOut && p.playerLocation === 'ENTRY' && p.operatorLocation === 'ENTRY' && p.residual.location === 'PLAYER' && p.operatorEnergy >= 4 && inactive(l) ? null : '先停止作用，两人可带同一原罐沿12米普通路去另一室，并留下返程2精力；不增加短渡掌握。';
  return '当前阶段不能进行这一步。';
}
function commandCost(l: DeathConsulLifeState, c: DeathConsulActivityCommand) {
  const actions = ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0;
  const spirituality = c.type === 'PERFORM' && l.cases[c.caseId].method === 'ABILITY' ? c.caseId === 'pale-residue' ? 7 : 6 : 0;
  const pennies = c.type === 'BUY_SEAL' && l.site.sourceEra !== null ? DEATH_CONSUL_SOURCES[l.site.sourceEra].materialPrice : 0;
  return { actions, spirituality, pennies };
}
export function blockDeathConsulLife(s: SliceState, c: DeathConsulActivityCommand): string | null {
  if (!validateDeathConsulActivityCommand(c)) return '死亡执政官生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着，且当前是死亡执政官·死神序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德这处封存室。';
  if (hasFerrymanLifeLock(s) || s.ferryman.channels.some(x => x.preparedWeek !== null) || ['READY', 'FIGHTING'].includes(s.ferryman.encounter.status) || s.deathConsul.preparedWeek !== null) return '先收束已有实践、遭遇和本次服药准备。';
  const era = s.deathConsul.sourceEra;
  if (era === null || (s.longChapter.handoff !== null ? era !== 'POST_CYCLE' : era !== 'ORIGINAL')) return '本次专业渠道尚未记录有效的时代来源。';
  if (era === 'POST_CYCLE' && s.ferryman.era.location !== 'RECEPTION') return '先沿普通道路实际回到当代接待处，再去相邻的封存室。';
  if (s.deathConsul.encounter.status !== 'AVAILABLE') return '同一现场已有后续遭遇，不能重开三案或重置原物。';
  const reason = localBlock(s.deathConsul.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.deathConsul.life, c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备须另留1行动实施，停止与普通收尾仍为0行动。';
  if (cost.spirituality > 0 && s.mind <= 0) return '当前精神不足以施术；仍可停止并普通收尾。';
  if (s.spirituality < cost.spirituality) return `本次需要${cost.spirituality}灵性，当前不足。`;
  return s.cash < cost.pennies ? `这份原封材需实付${cost.pennies}便士，当前不足。` : null;
}
function elapse(l: DeathConsulLifeState, a: DeathConsulAttempt, seconds: number): void {
  advanceDeathConsulTime(l.site, seconds); a.elapsedSeconds += seconds;
  if (a.window === 'ACTIVE' && a.windowExpiresAt !== null && l.site.elapsedSeconds >= a.windowExpiresAt) a.window = 'EXPIRED';
}
function walkPlayer(l: DeathConsulLifeState, a: DeathConsulAttempt, to: DeathConsulLocation, metres: number): void {
  l.site.playerLocation = to; l.site.playerMetres += metres; a.playerTravelMetres += metres;
  if (l.site.residual.location === 'PLAYER') l.site.residual.ordinaryMetres += metres;
  elapse(l, a, metres);
}
function moveGroup(l: DeathConsulLifeState, a: DeathConsulAttempt, to: 'ENTRY' | 'FAR', passage: boolean): void {
  const p = l.site, metres = passage ? 6 : 12;
  p.playerLocation = p.operatorLocation = to;
  if (passage) { p.playerPassageMetres += metres; p.operatorPassageMetres += metres; p.residual.passageMetres += metres; a.playerPassageMetres += metres; a.operatorPassageMetres += metres; }
  else { p.playerMetres += metres; p.operatorMetres += metres; p.residual.ordinaryMetres += metres; a.playerTravelMetres += metres; a.operatorTravelMetres += metres; }
  p.operatorEnergy -= 2; a.operatorEnergySpent += 2; elapse(l, a, metres);
}
function doorTrip(l: DeathConsulLifeState, a: DeathConsulAttempt, state: DeathConsulSiteState['door']['state']): void {
  walkPlayer(l, a, 'DOOR', 3); elapse(l, a, 2); l.site.door.state = state; l.site.door.operations++; walkPlayer(l, a, 'ENTRY', 3);
}
function checkSource(l: DeathConsulLifeState, c: DeathConsulActivityCommand, baseAbility: number): DeathConsulCheckSource | null {
  if (c.type !== 'PERFORM' || l.cases[c.caseId].method !== 'ABILITY') return null;
  const flame = c.caseId === 'pale-residue', p = l.site;
  return { caseId: c.caseId, abilityId: flame ? 'death.s2.pale-flame' : 'death.s2.spirit-passage', cost: flame ? 7 : 6, at: p.elapsedSeconds,
    coreStat: flame ? 'will' : 'knowledge', baseAbility, operatorConsentWeek: p.operatorConsentWeek!, sourceEra: p.sourceEra!, site: structuredClone(p) };
}
/** Pure ordered reducer: every ordinary step and every paid attempt survive replay, failure and exit. */
function evolve(l: DeathConsulLifeState, c: DeathConsulActivityCommand, week: number, date: PublicGameDate, era: DeathConsulSourceEra, tier: PublicResolutionTier | null): void {
  const p = l.site;
  if (c.type === 'REFLECT') { l.reflected = true; advanceDeathConsulTime(p, 10); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { if (p.sourceEra === null) introduceDeathConsulSite(p, era, week, date); r.status = 'OBSERVED'; r.observedWeek = week; advanceDeathConsulTime(p, 4); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations++; r.contactOpen = true; l.activeCase = c.caseId;
    const a = freshAttempt(week, c.method, p); r.attempts.push(a); p.operatorConsent = 'UNASKED'; p.operatorConsentWeek = null; elapse(l, a, 4); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; advanceDeathConsulTime(p, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) {
    a.closed = true; a.interrupted = !a.performed || c.caseId === 'pale-residue' && !a.flameApplied && a.materialSpent === 0 || c.caseId === 'short-passage' && !a.crossed && !a.ordinaryOut;
    if (a.operatorConsentWeek !== null && a.operatorConsent !== 'WITHDRAWN') { a.operatorConsent = p.operatorConsent = 'CLOSED'; }
    r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++;
    elapse(l, a, 2); a.siteAtClose = structuredClone(p); l.activeCase = null; return;
  }
  switch (c.type) {
    case 'CONSENT_OPERATOR': case 'DECLINE_OPERATOR': a.operatorConsent = p.operatorConsent = c.type === 'CONSENT_OPERATOR' ? 'GRANTED' : 'DECLINED'; a.operatorConsentWeek = p.operatorConsentWeek = week; elapse(l, a, 2); break;
    case 'BUY_SEAL': { const source = DEATH_CONSUL_SOURCES[era]; p.material = { id: source.materialId, acquired: true, paidPennies: source.materialPrice, remaining: 1 }; a.penniesSpent += source.materialPrice; elapse(l, a, 2); break; }
    case 'INSPECT_RESIDUAL': a.residualInspected = true; elapse(l, a, 4); break;
    case 'OPEN_CONTAINER': a.containerOpened = true; p.residual.container = 'OPEN'; p.residual.seal = 'BROKEN'; elapse(l, a, 2); break;
    case 'CLOSE_CONTAINER': p.residual.container = 'CLOSED'; elapse(l, a, 2); break;
    case 'SEAL_CONTAINER': p.residual.seal = 'RESEALED'; p.material.remaining--; a.materialSpent++; elapse(l, a, 2); break;
    case 'CHECK_ENDPOINTS': walkPlayer(l, a, 'FAR', 12); elapse(l, a, 2); walkPlayer(l, a, 'ENTRY', 12); elapse(l, a, 2); a.endpointsChecked = true; break;
    case 'OPEN_DOOR': doorTrip(l, a, 'OPEN'); break;
    case 'CLOSE_DOOR': case 'UNBLOCK_DOOR': doorTrip(l, a, 'CLOSED'); break;
    case 'BLOCK_DOOR': doorTrip(l, a, 'BLOCKED'); break;
    case 'TAKE_RESIDUAL': p.residual.location = 'PLAYER'; elapse(l, a, 2); break;
    case 'RETURN_RESIDUAL': p.residual.location = 'ENTRY_STAND'; elapse(l, a, 2); break;
    case 'PERFORM': {
      const flame = c.caseId === 'pale-residue', ability = a.method === 'ABILITY'; a.performed = true; r.status = 'ACTIVE';
      if (ability) { a.spiritualitySpent += flame ? 7 : 6; elapse(l, a, 10); a.abilityTier = tier; a.window = success(tier) ? 'ACTIVE' : 'FAILED';
        if (success(tier)) { a.windowExpiresAt = p.elapsedSeconds + 20; p.effect = { mode: flame ? 'PALE_FLAME' : 'PASSAGE', expiresAt: a.windowExpiresAt }; } }
      else elapse(l, a, 4);
      break;
    }
    case 'APPLY_FLAME': a.flameApplied = true; p.residual.strength -= 2; p.residual.scorch++; p.residual.heatSeconds = 20; a.appliedAbilityIds.push('death.s2.pale-flame'); elapse(l, a, 4); break;
    case 'CROSS_PASSAGE': a.crossed = true; a.appliedAbilityIds.push('death.s2.spirit-passage'); moveGroup(l, a, 'FAR', true); break;
    case 'WALK_OUT': a.ordinaryOut = true; moveGroup(l, a, 'FAR', false); break;
    case 'RETURN_GROUP': a.returned = true; moveGroup(l, a, 'ENTRY', false); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.operatorConsent = p.operatorConsent = 'WITHDRAWN'; elapse(l, a, 1); break;
    case 'STOP': stopDeathConsulEffects(p); a.effectStopped = true; if (a.abilityTier !== null) a.window = 'STOPPED'; break;
    case 'WAIT_10': a.waits++; elapse(l, a, 10); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, a, 2); break;
  }
}
export function applyDeathConsulActivity(s: SliceState, c: DeathConsulActivityCommand, ctx: SeerContext): void {
  const reason = blockDeathConsulLife(s, c); if (reason) throw new Error(reason);
  const l = s.deathConsul.life, era = s.deathConsul.sourceEra!, stat = 'caseId' in c && c.caseId === 'pale-residue' ? 'will' : 'knowledge';
  const source = checkSource(l, c, s.character.coreStats[stat]), paid = commandCost(l, c);
  const budget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality,
    spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash - paid.pennies };
  let tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null, check: PublicCheckResult | null = null;
  s.actionsRemaining -= paid.actions; s.spirituality -= paid.spirituality; s.cash -= paid.pennies;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check(stat, 20)); tier = check.tier; randomAfter = s.random.cursor; }
  evolve(l, c, s.week, s.date, era, tier);
  l.journal.push({ week: s.week, date: structuredClone(s.date), sourceEra: era, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const a = current(l) ?? ('caseId' in c ? l.cases[c.caseId].attempts.at(-1) : null), p = l.site;
  ctx.note(`封存室：${LABELS[c.type]}`, `${tier ? `这次检定${TIER_LABELS[tier]}。` : ''}你在${LOCATION_LABELS[p.playerLocation]}，${p.operatorName ?? '保管员'}在${LOCATION_LABELS[p.operatorLocation]}、精力${p.operatorEnergy}。同一罐内残余强度${p.residual.strength}，焦痕${p.residual.scorch}处、余热${p.residual.heatSeconds}秒，封材余${p.material.remaining}份。${a ? `本次实耗${a.spiritualitySpent}灵性、${a.penniesSpent}便士、${a.elapsedSeconds}秒。` : ''}`);
}
export const applyDeathConsulLife = applyDeathConsulActivity;
const LOCATION_LABELS: Record<DeathConsulLocation, string> = { ENTRY: '近室入口', NEAR: '近侧2米处', DOOR: '3米处的门边', OTHER: '远侧4米处', FAR: '另一室6米端点', OUTSIDE: '室外' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const CONSENT_LABELS: Record<DeathConsulConsent, string> = { UNASKED: '尚未询问', GRANTED: '本次同意', DECLINED: '本次拒绝', WITHDRAWN: '当前撤回', CLOSED: '本次接触已结束' };
const LABELS: Record<string, string> = {
  OBSERVE: '当面观察这次工作', PREPARE: '准备本次实践', PERFORM: '支付费用并实施一次', REPORT: '如实报告这一次结果', REFLECT: '反思三次实践与停止的分寸',
  CONSENT_OPERATOR: '当面询问并记录本次同意', DECLINE_OPERATOR: '尊重保管员本次拒绝', BUY_SEAL: '实购唯一一份新封材', INSPECT_RESIDUAL: '检查同一封存罐与有限残余物',
  OPEN_CONTAINER: '拆开旧封并打开同一原罐', CLOSE_CONTAINER: '停止后亲手合上原罐盖', SEAL_CONTAINER: '耗掉实购封材重新封存原罐',
  CHECK_ENDPOINTS: '沿普通路往返，亲查两室端点', OPEN_DOOR: '实走到门边打开原门，再走回', CLOSE_DOOR: '实走到门边关回原门，再走回',
  BLOCK_DOOR: '实走到门边放下原门闩，再走回', UNBLOCK_DOOR: '实走到门边移开原门闩，再走回',
  TAKE_RESIDUAL: '从近室原架拿起同一封存罐', RETURN_RESIDUAL: '把同一封存罐放回近室原架', APPLY_FLAME: '在窗口内将苍白焰用于原残余物',
  CROSS_PASSAGE: '取得当前同意后，两人携原罐短渡6米', WALK_OUT: '停止作用后，两人携原罐普通绕行', RETURN_GROUP: '两人携同一原罐沿普通路返回',
  WITHDRAW_PERMISSION: '再次询问，记录她当前撤回的决定', STOP: '明确停止自己的作用', WAIT_10: '实际等待10秒', INSPECT: '核实这次结果与真实收尾',
  LEAVE: '从普通入口结束接触', CLOSE: '结束已实际收束的接触', WITHDRAW: '如实收束本次准备或接触',
};
const COSTS: Partial<Record<string, string>> = {
  OBSERVE: '1行动 · 当面观察4秒', PREPARE: '1行动 · 准备4秒 · 须另留1行动实施',
  CONSENT_OPERATOR: '0行动 · 2秒 · 仅限本案本周', DECLINE_OPERATOR: '0行动 · 2秒', INSPECT_RESIDUAL: '0行动 · 检查4秒',
  OPEN_CONTAINER: '0行动 · 2秒 · 原封不可复原', CLOSE_CONTAINER: '0行动 · 2秒 · 不消除焦痕或余热', SEAL_CONTAINER: '0行动 · 2秒 · 原封材−1',
  CHECK_ENDPOINTS: '0行动 · 本人普通往返24米 · 两端各查2秒 · 共28秒',
  OPEN_DOOR: '0行动 · 本人普通往返6米 · 操作2秒 · 共8秒', CLOSE_DOOR: '0行动 · 本人普通往返6米 · 操作2秒 · 共8秒',
  BLOCK_DOOR: '0行动 · 本人普通往返6米 · 操作2秒 · 共8秒', UNBLOCK_DOOR: '0行动 · 本人普通往返6米 · 操作2秒 · 共8秒',
  TAKE_RESIDUAL: '0行动 · 2秒 · 同一原罐由本人持有', RETURN_RESIDUAL: '0行动 · 2秒 · 不生成副本',
  APPLY_FLAME: '0行动 · 实施4秒 · 残余强度3→1 · 留1处焦痕与真实余热', CROSS_PASSAGE: '0行动 · 两人携原罐6米/6秒 · 保管员2精力',
  WALK_OUT: '0行动 · 两人携原罐12米/12秒 · 保管员2精力', RETURN_GROUP: '0行动 · 两人携原罐12米/12秒 · 保管员2精力',
  WITHDRAW_PERMISSION: '0行动 · 1秒 · 不退款、不运输', STOP: '0行动0秒 · 不退款、不归物、不移人', WAIT_10: '0行动 · 10秒 · 不续窗', INSPECT: '0行动 · 核实2秒',
  LEAVE: '0行动 · 结束接触2秒 · 须已实际收尾', CLOSE: '0行动 · 结束接触2秒', WITHDRAW: '0行动 · 如实收尾2秒 · 不退款',
  REPORT: '1行动 · 报告4秒 · 扮演25 · 仅实际应用的技巧+8', REFLECT: '1行动 · 反思10秒 · 三份实际报告后扮演25',
};
export function deathConsulLifeActions(s: SliceState): DeathConsulLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.deathConsul.life, out: DeathConsulLifeAction[] = [];
  const add = (command: DeathConsulActivityCommand) => {
    const reason = blockDeathConsulLife(s, command), id = 'caseId' in command ? command.caseId : null;
    let cost = COSTS[command.type] ?? '0行动';
    if (command.type === 'BUY_SEAL') cost = `0行动 · 2秒 · 实付${s.deathConsul.sourceEra === 'POST_CYCLE' ? 4 : 20}便士 · 仅一份`;
    if (command.type === 'PERFORM' && id) cost = l.cases[id].method === 'ABILITY'
      ? `1行动 · ${id === 'pale-residue' ? '7灵性 · 意志20' : '6灵性 · 知识20'} · 施术10秒 · 成功开20秒窗口`
      : '1行动 · 普通实施4秒 · 不施术、不增加新技巧掌握';
    out.push({ id: `DC2:${id ?? 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}`, label: `${LABELS[command.type]}${'method' in command ? command.method === 'ABILITY' ? '（有限能力）' : '（普通方法）' : ''}`, cost, enabled: reason === null, reason, command });
  };
  for (const caseId of DEATH_CONSUL_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add({ type: 'PREPARE', caseId, method });
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    if (r.status === 'PREPARED') add({ type: 'PERFORM', caseId });
    for (const type of STEPS) {
      if (caseId !== 'pale-residue' && ['BUY_SEAL', 'INSPECT_RESIDUAL', 'OPEN_CONTAINER', 'CLOSE_CONTAINER', 'SEAL_CONTAINER', 'APPLY_FLAME'].includes(type)) continue;
      if (caseId === 'pale-residue' && ['CHECK_ENDPOINTS', 'TAKE_RESIDUAL', 'RETURN_RESIDUAL', 'CROSS_PASSAGE', 'WALK_OUT', 'RETURN_GROUP', 'WITHDRAW_PERMISSION'].includes(type)) continue;
      if (caseId !== 'short-passage' && ['CROSS_PASSAGE', 'WALK_OUT', 'RETURN_GROUP'].includes(type)) continue;
      if (caseId !== 'withdrawn-passage' && type === 'WITHDRAW_PERMISSION') continue;
      if (r.method === 'ORDINARY' && ['APPLY_FLAME', 'CROSS_PASSAGE'].includes(type)) continue;
      add({ type, caseId });
    }
    add({ type: 'LEAVE', caseId });
  }
  if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
export function projectDeathConsulLife(s: SliceState): DeathConsulLifeProjection {
  const l = s.deathConsul.life, p = l.site;
  const person = p.sourceEra === null ? '尚未与当代保管员当面接触。' : `${p.operatorName}${p.operatorAge}岁，已在本时代当面介绍，始终是同一个人。`;
  return { title: '封存室里的苍白焰与真实短渡', story: DEATH_CONSUL_LIFE_STORY,
    environment: `${person}两室直距6米，普通绕路12米；中间有一扇可以实际打开、关闭或闩住的门。封存罐、罐内有限残余物和实购封材各只有这一份，换案不补充。苍白焰留下的焦痕不会消失，余热须真实冷却；短渡只移动已经在场的人与物，许可撤回后停止。室外普通出口一直可用。`,
    activeCase: l.activeCase, inside: hasDeathConsulLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected,
    site: structuredClone(p), clockSeconds: p.elapsedSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerMetres, playerPassageMetres: p.playerPassageMetres,
    currentAttempt: structuredClone(current(l)), sitePhase: s.deathConsul.encounter.status === 'AVAILABLE' ? 'LIFE' : 'ENCOUNTER',
    cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { id: d.id, title: d.title, story: d.story,
      observations: a ? [`本次${a.elapsedSeconds}秒，实耗${a.spiritualitySpent}灵性、${a.penniesSpent}便士。本人普通走${a.playerTravelMetres}米、短渡${a.playerPassageMetres}米；保管员普通走${a.operatorTravelMetres}米、短渡${a.operatorPassageMetres}米，消耗${a.operatorEnergySpent}精力。`,
        `本次许可：${CONSENT_LABELS[a.operatorConsent]}。`, ...(a.abilityTier ? [`检定${TIER_LABELS[a.abilityTier]}；本次实际应用${a.appliedAbilityIds.length}项技巧。`] : []),
        ...(a.flameApplied ? ['苍白焰确实用于同一有限残余物，强度减2；焦痕与余热独立保留。'] : []), ...(a.permissionWithdrawn ? ['她在支付准备后撤回许可，本次没有运输她，也未因此增加掌握。'] : [])] : [],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '技巧已实际用于同一人或原物，之后完成真实停止、归物和普通返程。' : '按普通方法或中止结果如实收尾，未应用的成功不增加技巧掌握。',
      contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: deathConsulLifeActions(s) };
}
/** Strict event, charge, check, source, date and physical replay. Closed life becomes immutable encounter input. */
export function validateDeathConsulLife(s: SliceState): boolean {
  try {
    const l = s.deathConsul?.life, promotion = s.deathConsul?.promotionWeek, era = s.deathConsul?.sourceEra, expected = createDeathConsulLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !Array.isArray(l.journal) || l.journal.length > 600 || !validateDeathConsulSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week) || !['ORIGINAL', 'POST_CYCLE'].includes(String(era))) return false;
    let lastWeek = promotion, nextCursor = 0, previous: DeathConsulLifeEvent | null = null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'sourceEra', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'paid', 'budget']) ||
        !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        previous && compareGameDates(raw.date, previous.date) < 0 || raw.sourceEra !== era || !validateDeathConsulActivityCommand(raw.command)) return false;
      const event = raw as unknown as DeathConsulLifeEvent, c = event.command;
      if (contactOpen(expected) && (event.week !== lastWeek || previous && !same(event.date, previous.date)) || localBlock(expected, c, event.week)) return false;
      const source = checkSource(expected, c, record(event.check) && integer(event.check.baseAbility, 0, 500) ? event.check.baseAbility : 0), cost = commandCost(expected, c), b = event.budget;
      if (!same(event.source, source) || !same(event.paid, cost) || !record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter']) ||
        !integer(b.actionsBefore) || !integer(b.actionsAfter) || !integer(b.spiritualityBefore, 0, 120) || !integer(b.spiritualityAfter, 0, 120) || !integer(b.cashBefore) || !integer(b.cashAfter) ||
        b.actionsAfter !== b.actionsBefore - cost.actions || b.spiritualityAfter !== b.spiritualityBefore - cost.spirituality || b.cashAfter !== b.cashBefore - cost.pennies || c.type === 'PREPARE' && b.actionsBefore < 2) return false;
      if (contactOpen(expected) && previous && (b.actionsBefore !== previous.budget.actionsAfter || b.spiritualityBefore !== previous.budget.spiritualityAfter || b.cashBefore !== previous.budget.cashAfter)) return false;
      if (source) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 ||
          !integer(event.randomAfter, 0, s.random.cursor) || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
        // Actual open contact bars unrelated stat training. Original-era knowledge can rise only through its existing capped ordinary path.
        if (promoted(s)) {
          const now = s.character.coreStats[source.coreStat];
          const pinned = era === 'POST_CYCLE' || source.coreStat === 'will' || now > 20 || 'caseId' in c && l.activeCase === c.caseId;
          if (pinned ? source.baseAbility !== now : source.baseAbility > now) return false;
        }
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: source.coreStat, baseAbility: event.check.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || check.tier !== event.tier || random.cursor !== event.randomAfter) return false;
        nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.date, event.sourceEra, event.tier);
      if (!validateDeathConsulSiteState(expected.site)) return false;
      expected.journal.push(structuredClone(event)); lastWeek = event.week; previous = event;
    }
    const encounter = s.deathConsul.encounter;
    if (encounter.status === 'AVAILABLE') { if (!same(l, expected)) return false; }
    else {
      if (contactOpen(expected) || !Object.values(expected.cases).every(r => r.status === 'RESOLVED') || !expected.reflected || physicalCleanupBlock(expected) || !same(encounter.startSite, expected.site)) return false;
      if (!same({ ...l, site: expected.site }, expected)) return false;
    }
    if (l.site.sourceEra !== null && (l.site.sourceEra !== era || !integer(l.site.introducedWeek, Math.max(promotion, s.deathConsul.sourceWeek ?? promotion), s.week))) return false;
    if (contactOpen(l) && (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || encounter.status !== 'AVAILABLE' ||
      era === 'POST_CYCLE' && s.ferryman.era.location !== 'RECEPTION')) return false;
    const a = current(l); if (a && a.week !== s.week) return false;
    if (contactOpen(l) && previous && (!same(previous.date, s.date) || s.actionsRemaining !== previous.budget.actionsAfter || s.spirituality !== previous.budget.spiritualityAfter || s.cash !== previous.budget.cashAfter)) return false;
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['death.s2.pale-flame', 'death.s2.spirit-passage'] as const) if (s.progression.mastery[id] !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return false;
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
