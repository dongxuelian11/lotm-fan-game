import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasInsightScholarLifeLock } from '../insight-scholar/life.js';

export const WISDOM_ANGEL_CASE_IDS = ['record-handover', 'changed-condition', 'withdrawn-consent'] as const;
export type WisdomAngelCaseId = typeof WISDOM_ANGEL_CASE_IDS[number];
export type WisdomAngelConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'REVOKED' | 'CLOSED';
export type WisdomAngelWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'STOPPED' | 'EXPIRED' | 'INVALIDATED';
export type WisdomAngelPrediction = 'WHITE' | 'AMBER';
const STEPS = ['READ_SOURCE', 'CONSENT_OWNER', 'DECLINE_OWNER', 'AGREE_RETURN', 'ENTER_ROOM', 'TAKE_PAPERS', 'READ_FIRST', 'READ_SECOND', 'TAKE_DEVICE', 'OBSERVE_CONDITION', 'SYNTHESIS', 'MANUAL_COMPARE', 'VERIFY_HANDOVER', 'FIRST_DEMONSTRATION', 'SWITCH_FILTER', 'RESPONSE', 'SECOND_DEMONSTRATION', 'VERIFY_RESULT', 'WITHDRAW_CONSENT', 'STOP_METHOD', 'RETURN_PAPERS', 'RETURN_DEVICE', 'EXIT_ROOM', 'WAIT_20', 'INSPECT'] as const;
export type WisdomAngelActivityCommand =
  | { type: typeof STEPS[number] | 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW'; caseId: WisdomAngelCaseId }
  | { type: 'PREPARE'; caseId: WisdomAngelCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PREDICT'; caseId: 'changed-condition'; prediction: WisdomAngelPrediction }
  | { type: 'REFLECT' };
export interface WisdomAngelAbilityUse {
  attempts: number; successes: number; effects: number; tier: PublicResolutionTier | null;
  state: WisdomAngelWindow; remainingSeconds: number; conditionVersion: number | null;
}
export interface WisdomAngelModel {
  version: number; formedAt: number; tier: PublicResolutionTier; state: WisdomAngelWindow;
  basis: 'TWO_READ_SHEETS' | 'OBSERVED_DEVICE'; hypothesis: string; checkedAt: number | null;
}
export interface WisdomAngelDemonstration { id: string; version: number; filter: 'CLEAR' | 'AMBER'; at: number; result: WisdomAngelPrediction; chargeBefore: number; chargeAfter: number }
export interface WisdomAngelAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; maraTravelMetres: number; spiritualitySpent: number;
  ownerConsent: WisdomAngelConsent; ownerConsentWeek: number | null; sourceRead: boolean; returnAgreed: boolean;
  entered: boolean; exited: boolean; papersTaken: boolean; papersReturned: boolean; readFirst: boolean; readSecond: boolean;
  deviceTaken: boolean; deviceReturned: boolean; observedVersions: number[]; models: WisdomAngelModel[];
  manualCompared: boolean; handoverVerified: boolean; handoverFinding: string | null;
  demonstrations: WisdomAngelDemonstration[]; filterSwitched: boolean;
  predictions: { version: number; prediction: WisdomAngelPrediction; at: number }[];
  resultVerified: boolean; predictionMatched: boolean | null; inspected: boolean; waits: number;
  synthesis: WisdomAngelAbilityUse; response: WisdomAngelAbilityUse;
}
export interface WisdomAngelCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  preparations: number; closes: number; withdrawals: number; attempts: WisdomAngelAttempt[];
}
export interface WisdomAngelCheckSource {
  caseId: WisdomAngelCaseId; version: number; at: number; ownerConsentWeek: number;
  paperIds: string[]; deviceId: string | null; observedDemonstrationIds: string[];
  observedFilter: 'CLEAR' | 'AMBER' | null; prediction: WisdomAngelPrediction | null;
}
export interface WisdomAngelLifeEvent {
  week: number; command: WisdomAngelActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: WisdomAngelCheckSource | null;
}
export interface WisdomAngelPaper { id: string; owner: 'WA2-MARA'; location: 'TABLE' | 'PLAYER'; text: string; firstReadWeek: number | null }
export interface WisdomAngelLifeState {
  activeCase: WisdomAngelCaseId | null; reflected: boolean; clockSeconds: number; playerLocation: 'EXIT' | 'TABLE'; playerTravelMetres: number;
  room: { id: 'WA2-ROOM'; pathMetres: 4; exitOpen: true };
  mara: { id: 'WA2-MARA'; name: '玛拉'; age: 43; alive: true; health: 100; mind: 100; location: 'EXIT' | 'TABLE'; travelMetres: number };
  papers: [WisdomAngelPaper, WisdomAngelPaper];
  device: { id: 'WA2-DEVICE'; owner: 'WA2-MARA'; location: 'TABLE' | 'PLAYER'; charges: number; filter: 'CLEAR' | 'AMBER'; conditionVersion: number; demonstrations: number; filterChanges: number };
  cases: Record<WisdomAngelCaseId, WisdomAngelCaseState>; journal: WisdomAngelLifeEvent[];
}
export interface WisdomAngelLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WisdomAngelActivityCommand }
export interface WisdomAngelLifeProjection {
  title: string; story: string; environment: string; activeCase: WisdomAngelCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  clockSeconds: number; playerLocation: WisdomAngelLifeState['playerLocation']; playerTravelMetres: number;
  room: WisdomAngelLifeState['room']; mara: WisdomAngelLifeState['mara'];
  papers: { id: string; owner: string; location: 'TABLE' | 'PLAYER'; text: string | null; firstReadWeek: number | null }[];
  device: Omit<WisdomAngelLifeState['device'], 'filter'> & { filter: 'CLEAR' | 'AMBER' | null };
  currentAttempt: WisdomAngelAttempt | null;
  cases: { id: WisdomAngelCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: WisdomAngelAttempt[] }[];
  actions: WisdomAngelLifeAction[];
}
export const WISDOM_ANGEL_LIFE_STORY = '智慧天使·阅读者序列2候选G：名称、序列对应及新能力均未作原著证实；完整配方与原著仪式未知。只综合本人实际读过、观察过的有限资料，条件改变会使旧模型失效，真实结果仍须复核。人物、原物、距离、用时、检定、成本及成长均为G。三案报告各25扮演、反思25；每案每项新能力仅实际应用后+8掌握，成功但未应用不奖。';
const CASES = [
  { id: 'record-handover', title: '两张实读原纸与当前交接', story: '玛拉43岁，本次出借同一两张有日期的原纸。先亲手取读，可作有限条件综合或普通比较，再当面核验眼前交接。纸面差异不是罪责或真相按钮，原纸须亲手归还。' },
  { id: 'changed-condition', title: '真实换滤片使旧模型失效', story: '同一原示范器只有两格储能。亲眼看第一次实际演示，再记录预测。玛拉亲手换上同一器具的琥珀滤片，条件版本改变；旧模型保留为失效，须重新观察。最后一格储能只够第二次实做，错误或过时预测不删除。' },
  { id: 'withdrawn-consent', title: '当前撤回优先于成功窗口', story: '再次当面询问玛拉，借取仍是同一原纸与保留真实余量的原器具。可以对实际读过的资料形成有限窗口；她随后撤回本次许可，必须在应用前停止、亲手归还、沿原路退出。最初拒绝或普通完成同样可报告。' },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2;
const freshUse = (): WisdomAngelAbilityUse => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE', remainingSeconds: 0, conditionVersion: null });
const freshCase = (): WisdomAngelCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, preparations: 0, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY'): WisdomAngelAttempt {
  return { week, method, closed: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, maraTravelMetres: 0, spiritualitySpent: 0, ownerConsent: 'UNASKED', ownerConsentWeek: null,
    sourceRead: false, returnAgreed: false, entered: false, exited: false, papersTaken: false, papersReturned: false, readFirst: false, readSecond: false, deviceTaken: false, deviceReturned: false,
    observedVersions: [], models: [], manualCompared: false, handoverVerified: false, handoverFinding: null, demonstrations: [], filterSwitched: false, predictions: [], resultVerified: false, predictionMatched: null, inspected: false, waits: 0,
    synthesis: freshUse(), response: freshUse() };
}
export function createWisdomAngelLifeState(): WisdomAngelLifeState {
  return { activeCase: null, reflected: false, clockSeconds: 0, playerLocation: 'EXIT', playerTravelMetres: 0,
    room: { id: 'WA2-ROOM', pathMetres: 4, exitOpen: true }, mara: { id: 'WA2-MARA', name: '玛拉', age: 43, alive: true, health: 100, mind: 100, location: 'EXIT', travelMetres: 0 },
    papers: [{ id: 'WA2-SHEET-1', owner: 'WA2-MARA', location: 'TABLE', text: '1349年6月26日晨登记：本纸与WA2-SHEET-2每次借阅后拟归还玛拉；本行是归还计划，不是每次实际交接完成的签注。', firstReadWeek: null }, { id: 'WA2-SHEET-2', owner: 'WA2-MARA', location: 'TABLE', text: '1349年6月26日晚复核：两张原纸是否实际交回，须看当次持有位置并与玛拉当面核对。原示范器透明滤片下发白光，滤片改变后须重看现场，不保证旧预测。', firstReadWeek: null }],
    device: { id: 'WA2-DEVICE', owner: 'WA2-MARA', location: 'TABLE', charges: 2, filter: 'CLEAR', conditionVersion: 1, demonstrations: 0, filterChanges: 0 },
    cases: { 'record-handover': freshCase(), 'changed-condition': freshCase(), 'withdrawn-consent': freshCase() }, journal: [] };
}
const current = (l: WisdomAngelLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const lockedLife = (l: WisdomAngelLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.status === 'PREPARED' || r.contactOpen) || l.playerLocation !== 'EXIT' || l.mara.location !== 'EXIT' || l.papers.some(p => p.location !== 'TABLE') || l.device.location !== 'TABLE';
export const hasWisdomAngelLifeLock = (s: SliceState): boolean => lockedLife(s.wisdomAngel.life);
export const wisdomAngelInside = hasWisdomAngelLifeLock;
export function validateWisdomAngelActivityCommand(v: unknown): v is WisdomAngelActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!WISDOM_ANGEL_CASE_IDS.includes(v.caseId as WisdomAngelCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'PREDICT') return shape(v, ['type', 'caseId', 'prediction']) && v.caseId === 'changed-condition' && ['WHITE', 'AMBER'].includes(String(v.prediction));
  return shape(v, ['type', 'caseId']) && [...STEPS, 'OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(String(v.type));
}
export const isWisdomAngelActivityCommand = validateWisdomAngelActivityCommand;
export const isWisdomAngelActivity = validateWisdomAngelActivityCommand;
const permitted = (a: WisdomAngelAttempt, week: number) => a.ownerConsent === 'GRANTED' && a.ownerConsentWeek === week;
const activeWindow = (a: WisdomAngelAttempt) => a.synthesis.state === 'ACTIVE' || a.response.state === 'ACTIVE';
function cleanupBlock(l: WisdomAngelLifeState): string | null {
  const a = current(l);
  if (a && activeWindow(a)) return '先明确停止尚在进行的有限窗口；停止不退灵性。';
  if (l.papers.some(p => p.location !== 'TABLE') || l.device.location !== 'TABLE') return '先在原桌亲手归还本次同一原纸与原器具。';
  return l.playerLocation !== 'EXIT' || l.mara.location !== 'EXIT' ? '双方须沿同一4米通路实际走到原门外。' : null;
}
function localBlock(l: WisdomAngelLifeState, c: WisdomAngelActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !lockedLife(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先实际报告三案并归还退出；反思只计一次。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = WISDOM_ANGEL_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !lockedLife(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[WISDOM_ANGEL_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '按顺序观察本案，先收束上一现场。';
  if (c.type === 'PREPARE') return !lockedLife(l) && r.status === 'OBSERVED' && r.preparations < 16 ? null : '须本案已观察且没有占用现场；最多16次准备，不重置既有记录。';
  if (c.type === 'WITHDRAW' && r.status === 'PREPARED') return null;
  if (c.type === 'PERFORM') return r.status === 'PREPARED' && l.activeCase === null && r.attempts.length === 0 ? null : '须本案已准备；每案仅实际实施一次，不重骰。';
  if (c.type === 'REPORT') return !lockedLife(l) && r.status === 'EXAMINED' ? null : '先核实、归还、实际退出并关闭现场。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周实际进行中的本案现场。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return cleanupBlock(l) ?? (a.inspected ? null : '先核实本次原人、原物与出口。');
  if (c.type === 'STOP_METHOD') return activeWindow(a) ? null : '当前没有尚在进行的有限窗口。';
  if (c.type === 'WITHDRAW_CONSENT') return permitted(a, week) ? null : '须本次当前许可仍存在；拒绝或撤回不重复。';
  if (c.type === 'RETURN_PAPERS') return a.papersTaken && !a.papersReturned && l.playerLocation === 'TABLE' ? null : '须在原桌亲手归还本次确实拿起的同两张原纸。';
  if (c.type === 'RETURN_DEVICE') return a.deviceTaken && !a.deviceReturned && l.playerLocation === 'TABLE' ? null : '须在原桌亲手归还本次确实拿起的同一原器具。';
  if (c.type === 'EXIT_ROOM') return a.entered && !a.exited && l.papers.every(p => p.location === 'TABLE') && l.device.location === 'TABLE' && !activeWindow(a) ? null : '先停窗并亲手还物，再双方沿原4米路退出。';
  if (c.type === 'INSPECT') {
    if (a.inspected) return '本次已核实，请关闭现场。';
    const cleanup = cleanupBlock(l); if (cleanup) return cleanup;
    if (!a.sourceRead) return '先在入口核对本次实际物主与来源。';
    if (a.ownerConsent === 'DECLINED' || a.ownerConsent === 'REVOKED') return null;
    if (!a.entered || !a.exited) return '先尊重本次回答；同意进入后须实际退出。';
    if (c.caseId === 'withdrawn-consent') return '本案须记录当前撤回；最初拒绝也可普通结束。';
    if (c.caseId === 'record-handover') return a.handoverVerified ? null : '先对实际读过的资料作比较，再核验本次交接。';
    return a.filterSwitched && a.resultVerified ? null : '先记录真实条件改变、两次实做与结果复核；可普通完成。';
  }
  if (a.inspected) return '已核实完毕，请关闭现场。';
  if (c.type === 'READ_SOURCE') return !a.sourceRead && !a.entered ? null : '本次须在入口核对一次原物来源，不读取尚未打开的纸面。';
  if (c.type === 'CONSENT_OWNER' || c.type === 'DECLINE_OWNER') return a.sourceRead && a.ownerConsent === 'UNASKED' && !a.entered ? null : '须当面询问同一玛拉本次借阅、示范和参与许可。';
  if (c.type === 'AGREE_RETURN') return permitted(a, week) && !a.returnAgreed ? null : '须本次当前同意，才能约定随时停止及普通归还。';
  if (c.type === 'ENTER_ROOM') return permitted(a, week) && a.returnAgreed && !a.entered ? null : '须本次同意及归还约定，再双方走4米至原桌。';
  if (!permitted(a, week) || !a.entered || a.exited || l.playerLocation !== 'TABLE') return '当前许可或实际位置不成立；只能停止、归还、普通退出并如实核实。';
  if (c.type === 'TAKE_PAPERS') return !a.papersTaken && l.papers.every(p => p.location === 'TABLE') ? null : '同两张原纸每案只拿起一次。';
  if (c.type === 'READ_FIRST' || c.type === 'READ_SECOND') return a.papersTaken && !a.papersReturned && !(c.type === 'READ_FIRST' ? a.readFirst : a.readSecond) ? null : '须亲手持有本案原纸并实际阅读；已读不重记。';
  if (c.type === 'TAKE_DEVICE') return c.caseId !== 'record-handover' && !a.deviceTaken && l.device.location === 'TABLE' ? null : '须本案原器具实际仍在原桌，不能取副本。';
  if (c.type === 'OBSERVE_CONDITION') return a.deviceTaken && !a.deviceReturned && !a.observedVersions.includes(l.device.conditionVersion) ? null : '须手持同一器具，当前版本尚未实际观察。';
  if (c.type === 'MANUAL_COMPARE') return a.readFirst && a.readSecond && !a.papersReturned && !a.manualCompared ? null : '先实际读完两张原纸，才可作一次普通比较。';
  if (c.type === 'SYNTHESIS') {
    if (a.method !== 'ABILITY' || !a.readFirst || !a.readSecond || a.papersReturned || a.models.some(m => m.version === l.device.conditionVersion)) return '须本次有限能力准备及两张实读原纸；每一实际条件版本最多检定一次。';
    if (c.caseId === 'changed-condition' && (!a.demonstrations.length || !a.deviceTaken || a.deviceReturned || !a.observedVersions.includes(l.device.conditionVersion) || a.demonstrations.length > 1)) return '须亲眼看过第一次实做、实际观察当前条件，且尚未第二次实做；不推断未观察的条件。';
    return a.handoverVerified ? '已经完成本次交接核验，不追补能力效果。' : null;
  }
  if (c.type === 'VERIFY_HANDOVER') return c.caseId === 'record-handover' && !a.handoverVerified && !a.papersReturned && a.readFirst && a.readSecond && (a.manualCompared || a.synthesis.successes > 0) ? null : '只对实读且已比较的本案资料核验一次当前交接；能力失败可普通比较。';
  if (c.type === 'FIRST_DEMONSTRATION') return c.caseId === 'changed-condition' && a.deviceTaken && !a.deviceReturned && a.readFirst && a.readSecond && a.observedVersions.includes(1) && l.device.conditionVersion === 1 && l.device.charges === 2 && !a.demonstrations.length ? null : '须原器具当前许可、实读两纸及亲眼观察初始条件；第一次真实示范耗原储能1格。';
  if (c.type === 'SWITCH_FILTER') return c.caseId === 'changed-condition' && a.demonstrations.length === 1 && !a.filterSwitched && !a.deviceReturned ? null : '须第一次实做完成；玛拉只亲手更换一次原器具滤片，旧模型立即失效。';
  if (c.type === 'PREDICT') return a.demonstrations.length === 1 && !a.deviceReturned && a.observedVersions.includes(l.device.conditionVersion) && !a.predictions.some(p => p.version === l.device.conditionVersion) ? null : '须已见第一次实做及当前条件；每条件版本只记一个待证预测，旧预测不删除。';
  if (c.type === 'RESPONSE') return c.caseId === 'changed-condition' && a.method === 'ABILITY' && !a.response.attempts && a.filterSwitched && a.demonstrations.length === 1 && a.observedVersions.includes(l.device.conditionVersion) && a.predictions.some(p => p.version === l.device.conditionVersion) && !a.deviceReturned ? null : '须原器具第一次实做、当前已观察条件和本版本待证预测；只开下一次已知示范的有限应对窗。';
  if (c.type === 'SECOND_DEMONSTRATION') return c.caseId === 'changed-condition' && a.filterSwitched && a.demonstrations.length === 1 && !a.deviceReturned && a.observedVersions.includes(l.device.conditionVersion) && a.predictions.length > 0 && l.device.charges === 1 ? null : '须亲眼观察改变后的原条件并有待证预测，最后1格储能只够本次真实示范。';
  if (c.type === 'VERIFY_RESULT') return c.caseId === 'changed-condition' && a.demonstrations.length === 2 && !a.resultVerified && !a.deviceReturned ? null : '须先真实做完第二次示范，再比较原预测与实际结果；无第三格储能。';
  if (c.type === 'WAIT_20') return a.waits < 3 ? null : '每案最多等待三次20秒，等待不续窗或补充储能。';
  return '未知的本次实际步骤。';
}
export function blockWisdomAngelLife(s: SliceState, c: WisdomAngelActivityCommand): string | null {
  if (!validateWisdomAngelActivityCommand(c)) return '智慧天使生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE') return '须本人存活且当前确为阅读者候选序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德原资料室。';
  if (hasInsightScholarLifeLock(s) || ['READY', 'FIGHTING'].includes(s.wisdomAngel.encounter.status)) return '先实际收束旧现场或当前原敌接触。';
  const reason = localBlock(s.wisdomAngel.life, c, s.week); if (reason) return reason;
  const ap = ['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0;
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : ap)) return '本周行动不足；准备须保留1行动实际实施。';
  if ((c.type === 'SYNTHESIS' && s.spirituality < 5) || (c.type === 'RESPONSE' && s.spirituality < 6)) return '本次灵性不足；可普通核验，停止与归还始终不耗行动或灵性。';
  return null;
}
function stop(a: WisdomAngelAttempt, state: 'STOPPED' | 'INVALIDATED') {
  for (const use of [a.synthesis, a.response]) if (use.state === 'ACTIVE') { use.state = state; use.remainingSeconds = 0; }
  for (const model of a.models) if (model.state === 'ACTIVE') model.state = state;
}
function elapse(l: WisdomAngelLifeState, a: WisdomAngelAttempt, seconds: number) {
  l.clockSeconds += seconds; a.elapsedSeconds += seconds;
  for (const use of [a.synthesis, a.response]) if (use.state === 'ACTIVE') {
    use.remainingSeconds = Math.max(0, use.remainingSeconds - seconds);
    if (use.remainingSeconds === 0) { use.state = 'EXPIRED'; if (use === a.synthesis) for (const m of a.models) if (m.state === 'ACTIVE') m.state = 'EXPIRED'; }
  }
}
function checkSource(l: WisdomAngelLifeState, c: WisdomAngelActivityCommand): WisdomAngelCheckSource | null {
  if (c.type !== 'SYNTHESIS' && c.type !== 'RESPONSE') return null;
  const a = current(l)!;
  return { caseId: c.caseId, version: l.device.conditionVersion, at: l.clockSeconds, ownerConsentWeek: a.ownerConsentWeek!, paperIds: l.papers.filter((_, i) => i === 0 ? a.readFirst : a.readSecond).map(p => p.id), deviceId: a.deviceTaken && !a.deviceReturned ? l.device.id : null,
    observedDemonstrationIds: a.demonstrations.map(d => d.id), observedFilter: a.observedVersions.includes(l.device.conditionVersion) ? l.device.filter : null, prediction: a.predictions.find(p => p.version === l.device.conditionVersion)?.prediction ?? null };
}
function applyUse(a: WisdomAngelAttempt, kind: 'synthesis' | 'response', completedAt: number) {
  const use = a[kind]; use.effects = 1; use.state = 'APPLIED'; use.remainingSeconds = 0;
  if (kind === 'synthesis') for (const m of a.models) if (m.state === 'ACTIVE') { m.state = 'APPLIED'; m.checkedAt = completedAt; }
}
/** Replay only this finite scene. Never edits old people, objects, samples, body or RNG. */
function evolve(l: WisdomAngelLifeState, c: WisdomAngelActivityCommand, week: number, tier: PublicResolutionTier | null) {
  if (c.type === 'REFLECT') { l.reflected = true; return; }
  const r = l.cases[c.caseId];
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
    case 'ENTER_ROOM': case 'EXIT_ROOM': {
      const enter = c.type === 'ENTER_ROOM'; if (enter) a.entered = true; else a.exited = true;
      l.playerLocation = enter ? 'TABLE' : 'EXIT'; l.mara.location = enter ? 'TABLE' : 'EXIT';
      l.playerTravelMetres += 4; l.mara.travelMetres += 4; a.playerTravelMetres += 4; a.maraTravelMetres += 4; elapse(l, a, 4); break;
    }
    case 'TAKE_PAPERS': a.papersTaken = true; for (const p of l.papers) p.location = 'PLAYER'; elapse(l, a, 2); break;
    case 'READ_FIRST': case 'READ_SECOND': { const first = c.type === 'READ_FIRST'; if (first) a.readFirst = true; else a.readSecond = true; const p = l.papers[first ? 0 : 1]; p.firstReadWeek ??= week; elapse(l, a, 4); break; }
    case 'TAKE_DEVICE': a.deviceTaken = true; l.device.location = 'PLAYER'; elapse(l, a, 1); break;
    case 'OBSERVE_CONDITION': a.observedVersions.push(l.device.conditionVersion); elapse(l, a, 2); break;
    case 'MANUAL_COMPARE': a.manualCompared = true; elapse(l, a, 6); break;
    case 'SYNTHESIS': case 'RESPONSE': {
      const synthesis = c.type === 'SYNTHESIS', use = synthesis ? a.synthesis : a.response, passed = success(tier);
      elapse(l, a, 2); a.spiritualitySpent += synthesis ? 5 : 6; use.attempts++; use.successes += passed ? 1 : 0;
      use.tier = tier; use.state = passed ? 'ACTIVE' : 'FAILED'; use.remainingSeconds = passed ? 20 : 0; use.conditionVersion = l.device.conditionVersion;
      if (synthesis) a.models.push({ version: l.device.conditionVersion, formedAt: l.clockSeconds, tier: tier!, state: use.state, basis: c.caseId === 'changed-condition' ? 'OBSERVED_DEVICE' : 'TWO_READ_SHEETS', hypothesis: passed ? c.caseId === 'changed-condition' ? '仅在已观察滤片与操作条件保持时，原实做可供本次条件比较；须第二次实做复核。' : '两张实读原纸记载的计划与完成状态须分别比较；当前交接仍待当面核验。' : '本次未形成可靠模型；保留失败，可普通核对。', checkedAt: null });
      break;
    }
    case 'VERIFY_HANDOVER': {
      if (a.synthesis.state === 'ACTIVE' && a.synthesis.remainingSeconds >= 4 && a.synthesis.conditionVersion === l.device.conditionVersion) applyUse(a, 'synthesis', l.clockSeconds + 4);
      a.handoverVerified = true; a.handoverFinding = '已与原桌旁玛拉当面核对：同两张原纸此刻仍由本人持有，尚未实际归还；纸面归还计划不等于本次完成，仍须亲手交回原桌。未据此判定任何人有罪。'; elapse(l, a, 4); break;
    }
    case 'FIRST_DEMONSTRATION': case 'SECOND_DEMONSTRATION': {
      const result: WisdomAngelPrediction = l.device.filter === 'CLEAR' ? 'WHITE' : 'AMBER';
      const d: WisdomAngelDemonstration = { id: `WA2-DEMO-${l.device.demonstrations + 1}`, version: l.device.conditionVersion, filter: l.device.filter, at: l.clockSeconds + 3, result, chargeBefore: l.device.charges, chargeAfter: l.device.charges - 1 };
      if (c.type === 'SECOND_DEMONSTRATION' && a.response.state === 'ACTIVE') {
        const prediction = a.predictions.at(-1);
        if (a.response.remainingSeconds >= 3 && a.response.conditionVersion === d.version && prediction?.version === d.version && prediction.prediction === result) applyUse(a, 'response', d.at);
        else { a.response.state = 'INVALIDATED'; a.response.remainingSeconds = 0; }
      }
      l.device.charges--; l.device.demonstrations++; a.demonstrations.push(d); elapse(l, a, 3); break;
    }
    case 'PREDICT': a.predictions.push({ version: l.device.conditionVersion, prediction: c.prediction, at: l.clockSeconds }); elapse(l, a, 1); break;
    case 'SWITCH_FILTER': stop(a, 'INVALIDATED'); a.filterSwitched = true; l.device.filter = 'AMBER'; l.device.conditionVersion++; l.device.filterChanges++; elapse(l, a, 2); break;
    case 'VERIFY_RESULT': {
      const prediction = a.predictions.at(-1)!, actual = a.demonstrations.at(-1)!;
      a.predictionMatched = prediction.version === actual.version && prediction.prediction === actual.result; a.resultVerified = true;
      if (a.synthesis.state === 'ACTIVE' && a.synthesis.remainingSeconds >= 2 && a.synthesis.conditionVersion === actual.version && a.predictionMatched) applyUse(a, 'synthesis', l.clockSeconds + 2);
      elapse(l, a, 2); break;
    }
    case 'WITHDRAW_CONSENT': a.ownerConsent = 'REVOKED'; stop(a, 'STOPPED'); break;
    case 'STOP_METHOD': stop(a, 'STOPPED'); break;
    case 'RETURN_PAPERS': a.papersReturned = true; for (const p of l.papers) p.location = 'TABLE'; elapse(l, a, 2); break;
    case 'RETURN_DEVICE': a.deviceReturned = true; l.device.location = 'TABLE'; elapse(l, a, 1); break;
    case 'WAIT_20': a.waits++; elapse(l, a, 20); break;
    case 'INSPECT': a.inspected = true; a.result = a.synthesis.effects || a.response.effects ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, a, 2); break;
  }
}
export function applyWisdomAngelActivity(s: SliceState, c: WisdomAngelActivityCommand, ctx: SeerContext): void {
  const reason = blockWisdomAngelLife(s, c); if (reason) throw new Error(reason);
  const l = s.wisdomAngel.life, source = checkSource(l, c);
  let tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null, check: PublicCheckResult | null = null;
  if (['OBSERVE', 'PREPARE', 'PERFORM', 'REPORT', 'REFLECT'].includes(c.type)) s.actionsRemaining--;
  if (c.type === 'SYNTHESIS' || c.type === 'RESPONSE') {
    s.spirituality -= c.type === 'SYNTHESIS' ? 5 : 6; randomBefore = s.random.cursor;
    check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor;
  }
  evolve(l, c, s.week, tier); l.journal.push({ week: s.week, command: structuredClone(c), tier, randomBefore, randomAfter, check, source });
  if (c.type === 'REPORT') {
    const a = l.cases[c.caseId].attempts.at(-1)!; s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const [id, use] of [['reader.s2.conditional-synthesis', a.synthesis], ['reader.s2.observed-response', a.response]] as const) if (use.effects) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const a = current(l) ?? ('caseId' in c ? l.cases[c.caseId].attempts.at(-1) : null);
  ctx.note(`有限实读与已见方法：${LABELS[c.type]}`, `原创G；${tier ?? '普通实际步骤'}。原玛拉43岁，当前本人${l.playerLocation}，原纸${l.papers.map(p => `${p.id}:${p.location}`).join('、')}，同一器具${l.device.location}，剩${l.device.charges}/2格原储能、条件版本${l.device.conditionVersion}。${a ? `本次实耗${a.spiritualitySpent}灵性、${a.elapsedSeconds}秒；综合尝试/成功/应用${a.synthesis.attempts}/${a.synthesis.successes}/${a.synthesis.effects}，应对${a.response.attempts}/${a.response.successes}/${a.response.effects}。` : ''}只使用实际读过和观察过的资料，当前许可、原物位置与失败记录保留。`);
}
const LABELS: Record<string, string> = { OBSERVE: '观察本案实际来源', PREPARE: '准备本次有限实践', PERFORM: '进入本次实际接触', REPORT: '报告本次真实结果', REFLECT: '反思实证、条件和当前许可', CLOSE: '关闭已真实收束现场', WITHDRAW: '退出准备或已收束现场', READ_SOURCE: '入口核对原物主和物件来源', CONSENT_OWNER: '玛拉当面同意本次用途与参与', DECLINE_OWNER: '尊重玛拉本次拒绝', AGREE_RETURN: '约定随时停止与普通归还', ENTER_ROOM: '双方沿4米原路走至原桌', TAKE_PAPERS: '亲手取同两张原纸', READ_FIRST: '实际读第一张原纸', READ_SECOND: '实际读第二张原纸', TAKE_DEVICE: '亲手取同一原示范器', OBSERVE_CONDITION: '亲眼观察当前滤片条件', SYNTHESIS: '尝试条件综合', MANUAL_COMPARE: '普通比较两张实读原纸', VERIFY_HANDOVER: '当面核验当前真实交接', FIRST_DEMONSTRATION: '真实进行第一次示范', SWITCH_FILTER: '玛拉亲手换原器具滤片', PREDICT: '记录尚待实做验证的预测', RESPONSE: '尝试已见方法应对', SECOND_DEMONSTRATION: '耗最后原储能真实示范', VERIFY_RESULT: '比较原预测与实际结果', WITHDRAW_CONSENT: '玛拉撤回本次当前许可', STOP_METHOD: '明确停止有限模型与应对窗', RETURN_PAPERS: '亲手归还同两张原纸', RETURN_DEVICE: '亲手归还同一原器具', EXIT_ROOM: '双方沿4米原路步行退出', WAIT_20: '真实等待20秒，不续窗', INSPECT: '核实原人原物及普通出口' };
const COSTS: Partial<Record<string, string>> = { READ_SOURCE: '0行动 · 2秒G · 不读取封存内容', CONSENT_OWNER: '0行动 · 当面2秒G', DECLINE_OWNER: '0行动 · 当面2秒G', AGREE_RETURN: '0行动 · 2秒G', ENTER_ROOM: '0行动 · 双方各4米，共4秒G', TAKE_PAPERS: '0行动 · 2秒G', READ_FIRST: '0行动 · 4秒G', READ_SECOND: '0行动 · 4秒G', TAKE_DEVICE: '0行动 · 1秒G', OBSERVE_CONDITION: '0行动 · 2秒G', SYNTHESIS: '0行动 · 5灵性 · 知识20 · 2秒施用/成功最多20秒G', RESPONSE: '0行动 · 6灵性 · 知识20 · 2秒施用/成功最多20秒G', MANUAL_COMPARE: '0行动 · 6秒G · 不需能力成功', VERIFY_HANDOVER: '0行动 · 4秒G · 必须实际核验', FIRST_DEMONSTRATION: '0行动 · 原储能1格 · 3秒G', SECOND_DEMONSTRATION: '0行动 · 最后原储能1格 · 3秒G', SWITCH_FILTER: '0行动 · 玛拉亲手2秒G · 旧模型立即失效', PREDICT: '0行动 · 记录1秒G · 错误与过时预测保留', VERIFY_RESULT: '0行动 · 核验2秒G', WITHDRAW_CONSENT: '0行动0秒 · 立即停窗，不退实耗', STOP_METHOD: '0行动0秒 · 不移动原人原物', RETURN_PAPERS: '0行动 · 亲手2秒G', RETURN_DEVICE: '0行动 · 亲手1秒G', EXIT_ROOM: '0行动 · 双方各4米，共4秒G', WAIT_20: '0行动 · 20秒G · 每案最多三次', INSPECT: '0行动 · 2秒G', CLOSE: '0行动0秒 · 只结束已收束现场', WITHDRAW: '0行动0秒 · 先实际还物退出，不退款', REPORT: '1行动 · 扮演25 · 实际应用的新技能各最多+8G', REFLECT: '1行动 · 三实际报告后扮演25G' };
export function wisdomAngelLifeActions(s: SliceState): WisdomAngelLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.wisdomAngel.life, out: WisdomAngelLifeAction[] = [];
  const add = (command: WisdomAngelActivityCommand) => { const reason = blockWisdomAngelLife(s, command); out.push({ id: `WA2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'method' in command ? `:${command.method}` : ''}${'prediction' in command ? `:${command.prediction}` : ''}`, label: `${LABELS[command.type]}${'method' in command ? command.method === 'ABILITY' ? '（有限能力）' : '（普通对照）' : ''}${'prediction' in command ? command.prediction === 'WHITE' ? '（白光）' : '（琥珀光）' : ''}`, cost: COSTS[command.type] ?? (command.type === 'PREPARE' ? '1行动 · 须至少剩2行动' : '1行动'), enabled: reason === null, reason, command }); };
  for (const caseId of WISDOM_ANGEL_CASE_IDS) {
    const r = l.cases[caseId];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add({ type: 'PREPARE', caseId, method });
    if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId }); add({ type: 'WITHDRAW', caseId }); }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (!r.contactOpen) continue;
    for (const type of STEPS) if (!(r.method === 'ORDINARY' && ['SYNTHESIS', 'RESPONSE'].includes(type))) add({ type, caseId });
    if (caseId === 'changed-condition') for (const prediction of ['WHITE', 'AMBER'] as const) add({ type: 'PREDICT', caseId, prediction });
    add({ type: 'CLOSE', caseId }); add({ type: 'WITHDRAW', caseId });
  }
  if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
export function projectWisdomAngelLife(s: SliceState): WisdomAngelLifeProjection {
  const l = s.wisdomAngel.life;
  const filterKnown = Object.values(l.cases).some(r => r.attempts.some(a => a.observedVersions.includes(l.device.conditionVersion)));
  return { title: '实读资料、改变条件与普通归还', story: WISDOM_ANGEL_LIFE_STORY, environment: '原创G：WA2-ROOM原桌距唯一开放出口4米；原玛拉43岁，双方同速步行4秒抵桌、4秒退出。纸与器具的拿取、阅读、更换滤片、归还均在同一原桌伸手范围，不隔空移动。只有两张有日期的原纸和一件两格原储能器具，物主始终是玛拉；不会复制纸、补原储能或填入未见答案。', activeCase: l.activeCase, inside: lockedLife(l), insideCase: lockedLife(l), reflected: l.reflected, clockSeconds: l.clockSeconds, playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres,
    room: { ...l.room }, mara: { ...l.mara }, papers: l.papers.map(p => ({ ...p, text: p.firstReadWeek === null ? null : p.text })), device: { ...l.device, filter: filterKnown ? l.device.filter : null }, currentAttempt: structuredClone(current(l)),
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.observedWeek === null ? [] : [d.story, '能力不会判断罪责、读取未来、免费复制法术或改写现实。成功与实际应用分开；未应用成功不奖掌握。'], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限新方法至少实际应用一次；原检定、失败、条件版本与原物归还记录均保留。' : '已实际普通收束；未应用的能力没有掌握奖励。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: wisdomAngelLifeActions(s) };
}
/** Strict local event/source/check replay, retaining only the small scene. */
export function validateWisdomAngelLife(s: SliceState): boolean {
  try {
  const l = s.wisdomAngel?.life, promotion = s.wisdomAngel?.promotionWeek, expected = createWisdomAngelLifeState();
  if (!record(l) || !shape(l, Object.keys(expected)) || !Array.isArray(l.journal) || l.journal.length > 400) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(expected);
  if (!integer(promotion, 1, s.week)) return false;
  let lastWeek = promotion, nextCursor = 0;
  for (const event of l.journal) {
    if (!record(event) || !shape(event, ['week', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source']) || !integer(event.week, lastWeek, s.week) || !validateWisdomAngelActivityCommand(event.command)) return false;
    const c = event.command, cast = c.type === 'SYNTHESIS' || c.type === 'RESPONSE';
    if (lockedLife(expected) && event.week !== lastWeek || localBlock(expected, c, event.week)) return false;
    if (stableStringify(event.source) !== stableStringify(checkSource(expected, c))) return false;
    if (cast) {
      if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || !integer(event.randomAfter, event.randomBefore + 1, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
      const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
      const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: event.check.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
      if (stableStringify(check) !== stableStringify(event.check) || check.tier !== event.tier || random.cursor !== event.randomAfter) return false;
      nextCursor = event.randomAfter;
    } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
    evolve(expected, c, event.week, event.tier as PublicResolutionTier | null); expected.journal.push(structuredClone(event) as unknown as WisdomAngelLifeEvent); lastWeek = event.week;
  }
  if (stableStringify(l) !== stableStringify(expected)) return false;
  if (lockedLife(l) && (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND')) return false;
  const a = current(l); if (a && a.week !== s.week) return false;
  if (promoted(s)) {
    const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
    for (const [id, key] of [['reader.s2.conditional-synthesis', 'synthesis'], ['reader.s2.observed-response', 'response']] as const) if (s.progression.mastery[id] !== reported.reduce((n, r) => n + (r.attempts.at(-1)![key].effects ? 8 : 0), 0)) return false;
    if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
  }
  return true;
  } catch { return false; }
}
