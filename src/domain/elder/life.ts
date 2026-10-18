import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { createThreeHeadedTemplarLifeState, validateThreeHeadedTemplarSpiritSources, type ThreeHeadedTemplarLifeState, type ThreeHeadedTemplarSpiritId, type ThreeHeadedTemplarSpiritMethod } from '../three-headed-templar/life.js';
import { hasElderOldPractice } from './index.js';
import { replayElderEncounterRoot } from './encounter.js';

export const ELDER_CASE_IDS = ['sealed-whisper', 'single-chorus', 'interrupted-chorus'] as const;
export const ELDER_ACTIVITY_CASE_IDS = ELDER_CASE_IDS;
export const ACTIVITY_CASE_IDS = ELDER_CASE_IDS;
export type ElderCaseId = typeof ELDER_CASE_IDS[number];
export type ElderLifeAbilityId = 'hanged-man.s2.low-whisper' | 'hanged-man.s2.focused-chorus';
export type ElderLocation = 'START' | 'A' | 'B';
export type ElderConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'CONSENT_OWNER', 'TAKE_CARD', 'RETURN_CARD', 'INSPECT_SEAL', 'INSTALL_SEAL', 'REMOVE_SEAL', 'LOW_WHISPER', 'PERFORM_OPERATION', 'MANUAL_OPERATION', 'INTERRUPT_CHORUS', 'END_FOCUS', 'CLOSE_LIGHT', 'WITHDRAW_PERMISSION', 'RETURN_ITEMS', 'STOP', 'WAIT_6', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type ElderActivityCommand = { type: typeof STEPS[number]; caseId: ElderCaseId } | { type: 'PREPARE'; caseId: ElderCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: ElderCaseId; to: ElderLocation } | { type: 'FOCUSED_CHORUS'; caseId: ElderCaseId; spiritId: ThreeHeadedTemplarSpiritId; method: ThreeHeadedTemplarSpiritMethod } | { type: 'REFLECT' };
/** Immutable evidence of the handoff, never a second live court, adult or spirit inventory. */
export interface ElderSceneSource { root: 'threeHeadedTemplar.life'; promotionWeek: number; introducedWeek: number; snapshot: ThreeHeadedTemplarLifeState }
export interface ElderMaterial { id: 'EL2-KIT-1' | 'EL2-KIT-2' | 'EL2-KIT-3'; caseId: ElderCaseId; ownerId: 'PLAYER'; quantity: 1; status: 'SUPPLY' | 'PLAYER' | 'INSTALLED' | 'RETURNED'; location: 'SUPPLY' | 'PLAYER' | 'B' | 'OWNER'; charges: number; spentCharges: number; paidPennies: 0 | 24; preparedWeek: number | null }
export interface ElderOperationState {
  sealId: 'THT3-FAR-SEAL'; residualId: 'THT3-FAR-SEAL-RESIDUAL'; contained: true; residualPressure: 3; sealWear: number;
  suppressedUntil: number | null; focus: { spiritId: ThreeHeadedTemplarSpiritId; method: ThreeHeadedTemplarSpiritMethod; expiresAt: number } | null;
  materials: ElderMaterial[];
}
export interface ElderMovement { from: ElderLocation; to: ElderLocation; metres: 4; seconds: 4; itemIds: string[] }
export interface ElderAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: ElderConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  materialId: ElderMaterial['id']; cardTaken: boolean; cardReturned: boolean; reachedSeal: boolean; sealInspected: boolean; sealInstalled: boolean; itemsReturned: boolean;
  whisperTier: PublicResolutionTier | null; chorusTier: PublicResolutionTier | null; selectedSpiritId: ThreeHeadedTemplarSpiritId | null; selectedMethod: ThreeHeadedTemplarSpiritMethod | null;
  performed: boolean; manual: boolean; interrupted: boolean; expired: boolean; waits: number; inspected: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; spiritSpiritualitySpent: number; spiritIntegrityLost: number; penniesSpent: 24;
  appliedAbilityIds: ElderLifeAbilityId[]; playerMoves: ElderMovement[]; evidence: string[];
}
export interface ElderCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: ElderAttempt[] }
export interface ElderLifeCost { actions: number; spirituality: number; mind: number; pennies: number; health: 0; cashGained: 0; spiritSpirituality: number; spiritIntegrity: number; sealCharges: number }
export interface ElderLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number }
export interface ElderCheckSource { caseId: ElderCaseId; abilityId: ElderLifeAbilityId; cost: 6; difficulty: 20; coreStat: 'knowledge'; baseAbility: number; actor: { pathwayId: 'hanged-man'; sequence: 2; name: string; gender: string }; consentWeek: number; at: number; selectedSpirit: ThreeHeadedTemplarLifeState['spirits'][ThreeHeadedTemplarSpiritId] | null; sealId: 'THT3-FAR-SEAL'; materialId: ElderMaterial['id']; remainingCharges: number }
export interface ElderLifeEvent { week: number; date: PublicGameDate; revision: number; command: ElderActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: ElderCheckSource | null; inheritedScene: ElderSceneSource | null; paid: ElderLifeCost; budget: ElderLifeBudget }
export interface ElderLifeState { source: ElderSceneSource | null; activeCase: ElderCaseId | null; reflected: boolean; operation: ElderOperationState; cases: Record<ElderCaseId, ElderCaseState>; journal: ElderLifeEvent[] }
export interface ElderLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ElderActivityCommand }
export interface ElderLifeProjection { title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; spirits: ThreeHeadedTemplarLifeState['spirits'][ThreeHeadedTemplarSpiritId][]; activeCase: ElderCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; site: ThreeHeadedTemplarLifeState; operation: ElderOperationState; clockSeconds: number; playerLocation: ThreeHeadedTemplarLifeState['playerLocation']; playerTravelMetres: number; currentAttempt: ElderAttempt | null; cases: { id: ElderCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: ElderAttempt[] }[]; actions: ElderLifeAction[] }
const WHISPER: ElderLifeAbilityId = 'hanged-man.s2.low-whisper', CHORUS: ElderLifeAbilityId = 'hanged-man.s2.focused-chorus';
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const POSITION = { START: 0, A: 4, B: 8 } as const;
const METHODS = ['SIGNAL', 'BRIEF_WARD', 'LOW_GLOW', 'STEADY_HOLD', 'SCREEN'] as const;
const SPIRITS = ['THT3-HELENA', 'THT3-ROLAND'] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const successful = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 2;
const freshCase = (): ElderCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
const materialId = (id: ElderCaseId): ElderMaterial['id'] => id === 'sealed-whisper' ? 'EL2-KIT-1' : id === 'single-chorus' ? 'EL2-KIT-2' : 'EL2-KIT-3';
export function createElderLifeState(): ElderLifeState { return { source: null, activeCase: null, reflected: false, operation: { sealId: 'THT3-FAR-SEAL', residualId: 'THT3-FAR-SEAL-RESIDUAL', contained: true, residualPressure: 3, sealWear: 0, suppressedUntil: null, focus: null, materials: ELDER_CASE_IDS.map(caseId => ({ id: materialId(caseId), caseId, ownerId: 'PLAYER', quantity: 1, status: 'SUPPLY', location: 'SUPPLY', charges: 2, spentCharges: 0, paidPennies: 0, preparedWeek: null })) }, cases: { 'sealed-whisper': freshCase(), 'single-chorus': freshCase(), 'interrupted-chorus': freshCase() }, journal: [] }; }
const current = (l: ElderLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: ElderLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const kit = (l: ElderLifeState, a: ElderAttempt) => l.operation.materials.find(m => m.id === a.materialId)!;
function cleanupBlock(l: ElderLifeState, p: ThreeHeadedTemplarLifeState): string | null {
  if (l.operation.focus || l.operation.suppressedUntil !== null) return '先停止短咏与束令，让有限作用结束。';
  if (p.playerLocation !== 'START') return '须本人沿四米、四米普通路走回门口。';
  if (p.owner.location !== 'START' || p.card.location !== 'TABLE') return '玛拉须在门口，同一原卡须放回四米处原桌。';
  if (p.lamp.on || p.shutter.state !== 'CLOSED' || l.operation.materials.some(m => !['SUPPLY', 'RETURNED'].includes(m.status))) return '须关好原灯、取回封存耗材并当面归还。';
  if (Object.values(p.spirits).some(sp => sp.status === 'GRAZED' && sp.location !== 'INTERNAL')) return '仍在外放的原灵须收束；未放牧或已失去的来源不会被补造。';
  return null;
}
export const hasElderLifeLock = (s: SliceState): boolean => open(s.elder.life);
export const elderInside = hasElderLifeLock;
export const elderLifeClosed = (s: SliceState): boolean => !open(s.elder.life) && s.elder.life.source !== null && Object.values(s.elder.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.elder.life, s.threeHeadedTemplar.life);
export function validateElderActivityCommand(v: unknown): v is ElderActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!ELDER_CASE_IDS.includes(v.caseId as ElderCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B'].includes(String(v.to));
  if (v.type === 'FOCUSED_CHORUS') return shape(v, ['type', 'caseId', 'spiritId', 'method']) && SPIRITS.includes(v.spiritId as ThreeHeadedTemplarSpiritId) && METHODS.includes(v.method as ThreeHeadedTemplarSpiritMethod);
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isElderActivityCommand = validateElderActivityCommand;
export const isElderActivity = validateElderActivityCommand;
function localBlock(l: ElderLifeState, p: ThreeHeadedTemplarLifeState, c: ElderActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份真实报告并收好原院。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = ELDER_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[ELDER_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再核对同一原院的人、物与退路。';
  if (c.type === 'CONSENT_OWNER') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && r.consentWeek !== week && p.owner.willing ? null : '须在门口向仍自愿的玛拉询问本周本案的独立许可。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && r.consentWeek === week && p.owner.willing && !r.attempts.length && l.operation.materials[index]!.status === 'SUPPLY' ? null : '须有当前可撤回许可，每案只购买一次封存耗材。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' ? null : '先普通返回、归还原物，再报告实际结果。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一原院现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实实际收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '已经核实，只须结束接触并报告。';
  const m = kit(l, a), op = l.operation;
  if (c.type === 'WITHDRAW_PERMISSION') return a.permissionWithdrawn ? '本案许可已经撤回。' : null;
  if (c.type === 'STOP') return a.stopped ? '已经停止，已付成本不退。' : null;
  if (c.type === 'END_FOCUS') return op.focus || op.suppressedUntil !== null ? null : '短咏与束令已经结束。';
  if (c.type === 'WAIT_6') return (op.focus || op.suppressedUntil !== null) && a.waits < 2 ? null : '只可等待当前有限窗口，不会续时或补充灵性。';
  if (c.type === 'CLOSE_LIGHT') return p.playerLocation === 'B' && p.lamp.on ? null : '须本人在原灯旁亲手关闭。';
  if (c.type === 'REMOVE_SEAL') return p.playerLocation === 'B' && m.status === 'INSTALLED' && !op.focus && op.suppressedUntil === null && !p.lamp.on ? null : '先停止作用并关灯，再在原封条旁取回同一耗材。';
  if (c.type === 'RETURN_CARD') return p.playerLocation === 'A' && p.card.location === 'PLAYER' && (a.performed || a.manual || a.stopped) ? null : '须携同一原卡回到四米处原桌。';
  if (c.type === 'RETURN_ITEMS') return p.playerLocation === 'START' && p.owner.location === 'START' && p.card.location === 'TABLE' && m.status === 'PLAYER' && (a.performed || a.manual || a.stopped) ? null : '须本人回门口，当面交回用过的同一封存耗材。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (a.itemsReturned && (a.performed || a.manual || a.stopped) ? null : '先完成有限操作或明确停止，并真实归物。');
  if (c.type === 'WALK') {
    if (a.itemsReturned || op.focus || op.suppressedUntil !== null) return '先收束短效作用；归还后无需再离开门口。';
    if (p.playerLocation === 'START' && c.to === 'A') return !a.reachedSeal && !a.stopped && a.playerMoves.length === 0 ? null : '本案只按原路往返一次。';
    if (p.playerLocation === 'A' && c.to === 'B') return !a.reachedSeal && !a.stopped && p.card.location === 'PLAYER' ? null : '先在原桌拿起同一原卡，再前往封条。';
    if (p.playerLocation === 'B' && c.to === 'A') return m.status === 'PLAYER' && !p.lamp.on && (a.performed || a.manual || a.stopped) ? null : '先完成或停止，关闭原灯并取回耗材。';
    if (p.playerLocation === 'A' && c.to === 'START') return p.card.location === 'TABLE' && (a.reachedSeal || a.stopped) ? null : '先把原卡放回原桌，再走四米回门口。';
    return '只能沿门口至原桌四米、原桌至封条四米的实际道路行走。';
  }
  if (a.stopped || a.consent !== 'GRANTED' || !p.owner.willing || a.itemsReturned) return '许可已经停止或撤回；仍可普通返回与归物。';
  if (c.type === 'TAKE_CARD') return p.playerLocation === 'A' && p.card.location === 'TABLE' && !a.cardTaken ? null : '须本人在四米处原桌，亲手拿起唯一原卡。';
  if (c.type === 'INSPECT_SEAL') return p.playerLocation === 'B' && p.card.location === 'PLAYER' && !a.sealInspected ? null : '须携原卡到八米处检查原封条及其内部有限残留。';
  if (c.type === 'INSTALL_SEAL') return p.playerLocation === 'B' && a.sealInspected && m.status === 'PLAYER' && !a.sealInstalled ? null : '先现场检查，再安装本案新购的同一封存耗材。';
  if (c.type === 'LOW_WHISPER') return c.caseId !== 'single-chorus' && a.method === 'ABILITY' && a.whisperTier === null && p.playerLocation === 'B' && m.status === 'INSTALLED' && m.charges > 0 && !op.focus ? null : '低声束令只可对原封条中已核实的有限非凡残留尝试一次。';
  if (c.type === 'FOCUSED_CHORUS') {
    const spirit = p.spirits[c.spiritId];
    return c.caseId !== 'sealed-whisper' && a.method === 'ABILITY' && a.chorusTier === null && p.playerLocation === 'B' && m.status === 'INSTALLED' && m.charges > 0 && !op.focus && !p.lamp.on && spirit.status === 'GRAZED' && spirit.location === 'INTERNAL' && !spirit.interrupted && spirit.integrity > 0 && spirit.spirituality >= 3 && spirit.selectedAbilities.includes(c.method) && (c.caseId !== 'interrupted-chorus' || a.whisperTier !== null) ? null : '只可选一位原来已放牧、原来已选该技巧且仍有三灵性的原灵；不能增加放牧或借用名额。';
  }
  if (c.type === 'PERFORM_OPERATION') return p.playerLocation === 'B' && m.status === 'INSTALLED' && !a.performed && !a.manual && (c.caseId === 'sealed-whisper' ? op.suppressedUntil !== null : c.caseId === 'single-chorus' ? op.focus !== null : op.suppressedUntil !== null && op.focus !== null) ? null : '须在本次有效短窗内，对原封条实际完成一次有限核对。';
  if (c.type === 'MANUAL_OPERATION') return p.playerLocation === 'B' && m.status === 'INSTALLED' && !op.focus && op.suppressedUntil === null && !a.performed && !a.manual && (a.method === 'ORDINARY' || c.caseId === 'sealed-whisper' && a.whisperTier !== null || c.caseId !== 'sealed-whisper' && a.chorusTier !== null) ? null : '先结束短效作用，再用原夹具和封存纸普通核对；未成功的能力不记应用。';
  if (c.type === 'INTERRUPT_CHORUS') return c.caseId === 'interrupted-chorus' && p.playerLocation === 'B' && op.focus !== null && p.spirits[op.focus.spiritId].integrity >= 20 && !a.interrupted && !p.lamp.on ? null : '仅本案仍在运行的一位原灵短咏，可被身旁原灯的强光实际中断。';
  return '当前阶段不能进行这一步。';
}
function commandCost(l: ElderLifeState, c: ElderActivityCommand, tier: PublicResolutionTier | null = null): ElderLifeCost {
  const cast = c.type === 'LOW_WHISPER' || c.type === 'FOCUSED_CHORUS';
  return { actions: ['OBSERVE', 'PREPARE', 'LOW_WHISPER', 'FOCUSED_CHORUS', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: cast ? 6 : 0, mind: cast ? tier !== null && !successful(tier) ? 4 : 2 : 0, pennies: c.type === 'PREPARE' ? 24 : 0, health: 0, cashGained: 0, spiritSpirituality: c.type === 'FOCUSED_CHORUS' ? 3 : 0, spiritIntegrity: c.type === 'INTERRUPT_CHORUS' && l.operation.focus ? 20 : 0, sealCharges: cast || c.type === 'MANUAL_OPERATION' && current(l) !== null && kit(l, current(l)!).charges > 0 ? 1 : 0 };
}
export function blockElderLife(s: SliceState, c: ElderActivityCommand): string | null {
  if (!validateElderActivityCommand(c)) return '秽语长老生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已成为秽语长老。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际来到贝克兰德原封存院。';
  if (s.elder.preparedWeek !== null || s.elder.encounter.status !== 'AVAILABLE') return '先完成服药准备；后续遭遇开始后不能重开原案。';
  if (s.elder.life.source === null && hasElderOldPractice(s)) return '先收束此前原院中的全部接触与物品。';
  const reason = localBlock(s.elder.life, s.threeHeadedTemplar.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.elder.life, c), casts = c.type === 'PREPARE' && c.method === 'ABILITY' ? c.caseId === 'interrupted-chorus' ? 2 : 1 : 0;
  if (s.actionsRemaining < cost.actions + casts) return '本周须预留本次准备和全部有限施术的行动；普通收尾不耗行动。';
  if (s.spirituality < cost.spirituality || s.cash < cost.pennies || s.mind < (c.type === 'LOW_WHISPER' || c.type === 'FOCUSED_CHORUS' ? 4 : cost.mind)) return '当前本人资源不足以支付真实成本及可能的失败冲击。';
  return null;
}
function finishFocus(l: ElderLifeState, p: ThreeHeadedTemplarLifeState): void { if (l.operation.focus) p.spirits[l.operation.focus.spiritId].interrupted = false; l.operation.focus = null; l.operation.suppressedUntil = null; }
function elapse(l: ElderLifeState, p: ThreeHeadedTemplarLifeState, seconds: number, a: ElderAttempt | null): void {
  p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (l.operation.focus && l.operation.focus.expiresAt <= p.clockSeconds) { p.spirits[l.operation.focus.spiritId].interrupted = false; l.operation.focus = null; if (a) a.expired = true; }
  if (l.operation.suppressedUntil !== null && l.operation.suppressedUntil <= p.clockSeconds) { l.operation.suppressedUntil = null; if (a) a.expired = true; }
}
function freshAttempt(week: number, date: PublicGameDate, method: 'ABILITY' | 'ORDINARY', id: ElderCaseId): ElderAttempt { return { week, date: structuredClone(date), method, consent: 'GRANTED', closed: false, stopped: false, permissionWithdrawn: false, materialId: materialId(id), cardTaken: false, cardReturned: false, reachedSeal: false, sealInspected: false, sealInstalled: false, itemsReturned: false, whisperTier: null, chorusTier: null, selectedSpiritId: null, selectedMethod: null, performed: false, manual: false, interrupted: false, expired: false, waits: 0, inspected: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, spiritSpiritualitySpent: 0, spiritIntegrityLost: 0, penniesSpent: 24, appliedAbilityIds: [], playerMoves: [], evidence: [] }; }
function checkSource(l: ElderLifeState, p: ThreeHeadedTemplarLifeState, c: ElderActivityCommand, baseAbility: number, name: string, gender: string): ElderCheckSource | null { if (c.type !== 'LOW_WHISPER' && c.type !== 'FOCUSED_CHORUS') return null; const a = l.cases[c.caseId].attempts.at(-1)!; return { caseId: c.caseId, abilityId: c.type === 'LOW_WHISPER' ? WHISPER : CHORUS, cost: 6, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'hanged-man', sequence: 2, name, gender }, consentWeek: l.cases[c.caseId].consentWeek!, at: p.clockSeconds, selectedSpirit: c.type === 'FOCUSED_CHORUS' ? structuredClone(p.spirits[c.spiritId]) : null, sealId: p.farSeal.id, materialId: a.materialId, remainingCharges: kit(l, a).charges }; }
function evolve(l: ElderLifeState, p: ThreeHeadedTemplarLifeState, c: ElderActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: ElderSceneSource | null): void {
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 6, null); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { if (l.source === null) { if (!source) throw new Error('缺少同一原院的交接记录。'); l.source = structuredClone(source); } r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 4, null); return; }
  if (c.type === 'CONSENT_OWNER') { r.consentWeek = week; elapse(l, p, 2, null); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, date, c.method, c.caseId); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; const m = kit(l, a); m.status = 'PLAYER'; m.location = 'PLAYER'; m.paidPennies = 24; m.preparedWeek = week; elapse(l, p, 2, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 4, null); return; }
  const a = r.attempts.at(-1)!, m = kit(l, a), op = l.operation;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent !== 'WITHDRAWN') a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, p, 2, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': { const from = p.playerLocation as ElderLocation, move: ElderMovement = { from, to: c.to, metres: 4, seconds: 4, itemIds: [...(p.card.location === 'PLAYER' ? [p.card.id] : []), ...(m.status === 'PLAYER' ? [m.id] : [])] }; p.playerLocation = c.to; p.playerTravelMetres += 4; a.playerTravelMetres += 4; if (p.card.location === 'PLAYER') p.card.travelMetres += 4; a.playerMoves.push(move); if (c.to === 'B') a.reachedSeal = true; elapse(l, p, 4, a); break; }
    case 'TAKE_CARD': p.card.location = 'PLAYER'; a.cardTaken = true; elapse(l, p, 2, a); break;
    case 'RETURN_CARD': p.card.location = 'TABLE'; a.cardReturned = true; elapse(l, p, 2, a); break;
    case 'INSPECT_SEAL': a.sealInspected = true; a.evidence.push('原卡与八米处同一封条相符；有限非凡残留仍在原封条内部，普通路畅通。'); elapse(l, p, 2, a); break;
    case 'INSTALL_SEAL': m.status = 'INSTALLED'; m.location = 'B'; a.sealInstalled = true; elapse(l, p, 2, a); break;
    case 'REMOVE_SEAL': m.status = 'PLAYER'; m.location = 'PLAYER'; elapse(l, p, 2, a); break;
    case 'LOW_WHISPER': a.whisperTier = tier; a.spiritualitySpent += 6; a.mindSpent += successful(tier) ? 2 : 4; m.charges--; m.spentCharges++; op.sealWear++; r.status = 'ACTIVE'; elapse(l, p, 2, a); if (successful(tier)) op.suppressedUntil = p.clockSeconds + 12; break;
    case 'FOCUSED_CHORUS': a.chorusTier = tier; a.selectedSpiritId = c.spiritId; a.selectedMethod = c.method; a.spiritualitySpent += 6; a.mindSpent += successful(tier) ? 2 : 4; a.spiritSpiritualitySpent += 3; p.spirits[c.spiritId].spirituality -= 3; m.charges--; m.spentCharges++; op.sealWear++; r.status = 'ACTIVE'; elapse(l, p, 2, a); if (successful(tier)) op.focus = { spiritId: c.spiritId, method: c.method, expiresAt: p.clockSeconds + 6 }; break;
    case 'PERFORM_OPERATION': a.performed = true; if (op.suppressedUntil !== null) a.appliedAbilityIds.push(WHISPER); if (op.focus) { a.appliedAbilityIds.push(CHORUS); a.evidence.push(METHOD_RESULTS[op.focus.method]); } a.evidence.push('本人在原封条旁完成短窗内的有限核对；原残留仍封存，原成人未受控制，原灵没有补满。'); elapse(l, p, 2, a); break;
    case 'MANUAL_OPERATION': a.manual = true; if (m.charges > 0) { m.charges--; m.spentCharges++; } op.sealWear++; a.evidence.push('以原夹具与新购封存耗材普通核对，残留继续封存；未应用的技巧不记掌握。'); elapse(l, p, 4, a); break;
    case 'INTERRUPT_CHORUS': { const sp = p.spirits[op.focus!.spiritId], lost = Math.min(20, sp.integrity); sp.integrity -= lost; sp.interrupted = true; if (sp.integrity === 0) { sp.status = 'DISSIPATED'; sp.location = 'DISSIPATED'; sp.supportEnabled = false; } a.spiritIntegrityLost += lost; a.interrupted = true; p.lamp.on = true; a.evidence.push(`原灯强光中断了${sp.name}的这次短咏，原灵实损${lost}完整度；消耗不退。`); op.focus = null; elapse(l, p, 2, a); break; }
    case 'END_FOCUS': finishFocus(l, p); for (const id of SPIRITS) if (a.selectedSpiritId === id) p.spirits[id].interrupted = false; elapse(l, p, 1, a); break;
    case 'CLOSE_LIGHT': p.lamp.on = false; if (a.selectedSpiritId) p.spirits[a.selectedSpiritId].interrupted = false; elapse(l, p, 2, a); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.consent = 'WITHDRAWN'; a.stopped = true; if (op.focus) a.interrupted = true; finishFocus(l, p); a.evidence.push('玛拉撤回本案许可，所有当前短效作用已停止；她仍在原门口，可沿普通路离开。'); elapse(l, p, 2, a); break;
    case 'STOP': a.stopped = true; finishFocus(l, p); elapse(l, p, 1, a); break;
    case 'WAIT_6': a.waits++; elapse(l, p, 6, a); break;
    case 'RETURN_ITEMS': m.status = 'RETURNED'; m.location = 'OWNER'; a.itemsReturned = true; elapse(l, p, 2, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 2, a); break;
  }
}
export function applyElderActivity(s: SliceState, c: ElderActivityCommand, ctx: SeerContext): void {
  const reason = blockElderLife(s, c); if (reason) throw new Error(reason);
  const l = s.elder.life, p = s.threeHeadedTemplar.life, source = checkSource(l, p, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene: ElderSceneSource | null = c.type === 'OBSERVE' && l.source === null ? { root: 'threeHeadedTemplar.life', promotionWeek: s.elder.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(p) } : null;
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(l, c, tier), budget: ElderLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter; s.mind = budget.mindAfter;
  evolve(l, p, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原封存院：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation as ElderLocation] ?? '原院出口'}。原成人、原物与原灵的消耗继续保留；低声束令只约束封条内有限残留，短咏只用一位原灵已选技巧，均不能治伤或补资源。`);
}
export const applyElderLife = applyElderActivity;
export const handleElderLife = applyElderActivity;
const LOCATIONS = { START: '原院门口', A: '四米处原桌', B: '八米处原封条' } as const;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<ElderActivityCommand['type'], string> = { OBSERVE: '核对原院的人、物与普通退路', CONSENT_OWNER: '询问玛拉本案当前许可', PREPARE: '支付24便士购买本案封存耗材', WALK: '沿普通道路步行', TAKE_CARD: '在原桌拿起同一原卡', RETURN_CARD: '把同一原卡放回原桌', INSPECT_SEAL: '核对原封条内的有限残留', INSTALL_SEAL: '亲手安装本案新购封存纸', REMOVE_SEAL: '取回同一份用过的封存纸', LOW_WHISPER: '低声束令原封条中的有限残留', FOCUSED_CHORUS: '只聚起一位原灵的已选技巧', PERFORM_OPERATION: '在真实短窗内完成原封条核对', MANUAL_OPERATION: '用原夹具普通核对封条', INTERRUPT_CHORUS: '让原灯强光实际中断当前短咏', END_FOCUS: '收束当前短咏与束令', CLOSE_LIGHT: '亲手关闭同一原灯', WITHDRAW_PERMISSION: '听取玛拉撤回本案许可', RETURN_ITEMS: '当面交还同一份用过的耗材', STOP: '停止当前尝试并保留已付成本', WAIT_6: '实际等待六秒', INSPECT: '核实实际结果与收尾', LEAVE: '结束已收束接触', CLOSE: '结束已收束接触', WITHDRAW: '如实取消并结束接触', REPORT: '报告实际发生的有限结果', REFLECT: '反思三次有限实践' };
export const ELDER_LIFE_STORY = '玛拉51岁，仍在原封存院门口。原卡、原封条、原箱与原灯都只有原来那一份。每案重新取得可撤回许可，24便士购买一份两次用量的封存耗材。低声束令每次六灵性、二精神，成功只压住封条内有限非凡残留十二秒；聚灵短咏同样支付六灵性、二精神，并扣一位原已放牧之灵三灵性，只使用它原来选定的一项技巧六秒。失败总计损四精神，原灵与封存纸成本照付。';
export const ELDER_LIFE_ENVIRONMENT = '门口至原桌四米，原桌至封条四米，每米步行一秒；必须实际往返并归还原物。每次施术用去一格封存纸，强光中断另损所选原灵二十完整度。放牧总容量仍七位，最多两位外放，本人同时只借用一位；短咏时不叠加另一位借用。旧伤、原灵缺损与消耗不会因换案或晋升恢复。';
const CASES: { id: ElderCaseId; title: string; story: string }[] = [
  { id: 'sealed-whisper', title: '封条中的低声束令', story: '携同一原卡走到原封条，先检查再安装新购封存纸。束令只压住这份有限非凡残留，在十二秒内亲手核对后停止；失败可用原夹具普通核对，也可直接停止并原路归物。' },
  { id: 'single-chorus', title: '一位原灵的一项技巧', story: '在同一原封条旁选择赫莲娜或罗兰原来已经选定的技巧。原灵实际支付三灵性，短咏仅持续六秒；本人须在窗口内核对并收束，不能增加名额或补满原灵。' },
  { id: 'interrupted-chorus', title: '短咏被打断之后', story: '先作有限束令，再聚起一位原灵的已选技巧。核对后可用原灯强光实际中断短咏，或听取玛拉撤回许可；已付灵性和实际完整度损失保留。关灯、取纸、原路归卡与耗材后，才结束接触。' },
];
function preferred(s: SliceState, actions: ElderLifeAction[]): ElderLifeAction | undefined {
  const l = s.elder.life, p = s.threeHeadedTemplar.life, a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: ElderActivityCommand['type']) => enabled.find(x => x.command.type === type);
  if (!a) return pick('OBSERVE') ?? pick('CONSENT_OWNER') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (a.stopped) return pick('CLOSE_LIGHT') ?? pick('END_FOCUS') ?? pick('REMOVE_SEAL') ?? pick('RETURN_CARD') ?? enabled.find(x => x.command.type === 'WALK' && x.command.to !== 'B') ?? pick('RETURN_ITEMS') ?? pick('INSPECT');
  if (a.performed || a.manual) return l.activeCase === 'interrupted-chorus' && !a.interrupted ? pick('INTERRUPT_CHORUS') ?? pick('WITHDRAW_PERMISSION') : pick('CLOSE_LIGHT') ?? pick('END_FOCUS') ?? pick('REMOVE_SEAL') ?? pick('RETURN_CARD') ?? enabled.find(x => x.command.type === 'WALK' && x.command.to !== 'B') ?? pick('RETURN_ITEMS') ?? pick('INSPECT');
  if (p.playerLocation === 'START') return enabled.find(x => x.command.type === 'WALK' && x.command.to === 'A');
  if (p.playerLocation === 'A') return pick('TAKE_CARD') ?? enabled.find(x => x.command.type === 'WALK' && x.command.to === 'B');
  return pick('INSPECT_SEAL') ?? pick('INSTALL_SEAL') ?? pick('LOW_WHISPER') ?? pick('FOCUSED_CHORUS') ?? pick('PERFORM_OPERATION') ?? pick('END_FOCUS') ?? pick('MANUAL_OPERATION') ?? pick('STOP');
}
export function elderLifeActions(s: SliceState): ElderLifeAction[] {
  if (!promoted(s) || s.elder.encounter.status !== 'AVAILABLE') return [];
  const l = s.elder.life, p = s.threeHeadedTemplar.life, out: ElderLifeAction[] = [], id = l.activeCase ?? ELDER_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: ElderActivityCommand) => { const reason = blockElderLife(s, command), cost = commandCost(l, command), values = [`${cost.actions}行动`]; if (cost.pennies) values.push(`${cost.pennies}便士`); if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', '知识20'); if (cost.spiritSpirituality) values.push('原灵3灵性'); if (cost.spiritIntegrity) values.push('原灵20完整度'); if (cost.sealCharges) values.push('一格封存纸'); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : command.type === 'FOCUSED_CHORUS' ? `：${p.spirits[command.spiritId].name}的${METHOD_LABELS[command.method]}` : ''; out.push({ id: `EL2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : command.type === 'FOCUSED_CHORUS' ? `:${command.spiritId}:${command.method}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command }); };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'CONSENT_OWNER', caseId: id }); add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'CONSENT_OWNER', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const command: ElderActivityCommand = { type, caseId: id }; if (localBlock(l, p, command, s.week) === null) add(command); }
    for (const to of ['START', 'A', 'B'] as const) { const command: ElderActivityCommand = { type: 'WALK', caseId: id, to }; if (localBlock(l, p, command, s.week) === null) add(command); }
    for (const spiritId of SPIRITS) for (const method of p.spirits[spiritId].selectedAbilities) { const command: ElderActivityCommand = { type: 'FOCUSED_CHORUS', caseId: id, spiritId, method }; if (localBlock(l, p, command, s.week) === null) add(command); }
  }
  return out;
}
const METHOD_RESULTS: Record<ThreeHeadedTemplarSpiritMethod, string> = { SIGNAL: '原灵仅以有限信号复述眼前刚核实的封条情况，没有远程情报。', BRIEF_WARD: '原灵以已选短暂屏护护住眼前封条的检查口，仅维持本次核对。', LOW_GLOW: '原灵以已选低照照亮原封条，照见的仍是眼前原物。', STEADY_HOLD: '原灵以已选稳定托持固定原夹具，未搬走原箱或复制封条。', SCREEN: '原灵以已选局部遮护遮住眼前检查口，未制造全院屏障。' };
const METHOD_LABELS: Record<ThreeHeadedTemplarSpiritMethod, string> = { SIGNAL: '有限信号', BRIEF_WARD: '短暂屏护', LOW_GLOW: '低照', STEADY_HOLD: '稳定托持', SCREEN: '局部遮护' };
export function projectElderLife(s: SliceState): ElderLifeProjection { const l = s.elder.life, p = s.threeHeadedTemplar.life, actions = elderLifeActions(s), next = preferred(s, actions); return { title: '原封存院的有限短咏', story: ELDER_LIFE_STORY, environment: ELDER_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，原成人、原物与原灵均保留实际状态。' : '先支付必要成本或收束当前接触。'), preferredActionId: next?.id ?? null, facts: [`玛拉仍为同一位51岁成人，当前在${p.owner.location === 'START' ? '原院门口' : '院外'}。`, `原卡在${p.card.location === 'TABLE' ? '四米处原桌' : '本人手中'}，本人实际累计步行${p.playerTravelMetres}米，原院时钟${p.clockSeconds}秒。`, `封存纸累计实耗${l.operation.materials.reduce((n, m) => n + m.spentCharges, 0)}格；原封条磨损${l.operation.sealWear}。`, l.operation.focus ? `${p.spirits[l.operation.focus.spiritId].name}当前仅使用${METHOD_LABELS[l.operation.focus.method]}，还剩${l.operation.focus.expiresAt - p.clockSeconds}秒。` : '当前没有运行中的短咏。', l.operation.suppressedUntil !== null ? `封条内有限残留的束令还剩${l.operation.suppressedUntil - p.clockSeconds}秒。` : '当前没有运行中的束令。'], spirits: SPIRITS.map(id => structuredClone(p.spirits[id])), activeCase: l.activeCase, inside: hasElderLifeLock(s), insideCase: open(l), reflected: l.reflected, site: structuredClone(p), operation: structuredClone(l.operation), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: structuredClone(current(l)), cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { ...d, observations: a ? [`实付${a.penniesSpent}便士、${a.spiritualitySpent}本人灵性、${a.mindSpent}精神；原灵实耗${a.spiritSpiritualitySpent}灵性、${a.spiritIntegrityLost}完整度，步行${a.playerTravelMetres}米。`, ...a.evidence] : [], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已保留真实有限应用与归还记录。' : '普通方法或明确停止，不增加未应用技巧的掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions }; }
/** Baseline spirit replay still belongs to the old system; new costs never rewrite that old history. */
export function validateElderSceneSource(v: unknown, s: SliceState): v is ElderSceneSource {
  if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot']) || v.root !== 'threeHeadedTemplar.life' || v.promotionWeek !== s.elder.promotionWeek || !integer(v.introducedWeek, v.promotionWeek as number, s.week) || !record(v.snapshot)) return false;
  const p = v.snapshot as unknown as ThreeHeadedTemplarLifeState;
  return shape(p, Object.keys(createThreeHeadedTemplarLifeState())) && shape(p.cases, ['two-end-seal', 'paired-care', 'interrupted-light']) && shape(p.owner, ['id', 'name', 'age', 'alive', 'willing', 'location']) && p.siteId === 'THT3-SEALED-COURT' && p.playerLocation === 'START' && p.owner?.id === 'THT3-MARA' && p.owner.name === '玛拉·埃尔文' && p.owner.age === 51 && p.owner.alive === true && p.owner.location === 'START' && typeof p.owner.willing === 'boolean' && p.card?.id === 'THT3-CARD' && p.card.quantity === 1 && p.card.location === 'TABLE' && p.farSeal?.id === 'THT3-FAR-SEAL' && p.farSeal.quantity === 1 && p.farSeal.location === 'B' && p.leftBox?.id === 'THT3-LEFT-BOX' && p.rightBox?.id === 'THT3-RIGHT-BOX' && p.lamp?.id === 'THT3-LAMP' && !p.lamp.on && p.shutter?.state === 'CLOSED' && p.activeCase === null && p.reflected && Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) && validateThreeHeadedTemplarSpiritSources(p.spirits, v.introducedWeek) && Object.values(p.spirits).every(sp => sp.status !== 'GRAZED' || sp.location === 'INTERNAL') && integer(p.clockSeconds) && integer(p.playerTravelMetres);
}
function validBudget(b: ElderLifeBudget, cost: ElderLifeCost, c: ElderActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  const reserved = c.type === 'PREPARE' && c.method === 'ABILITY' ? c.caseId === 'interrupted-chorus' ? 2 : 1 : 0;
  return b.actionsBefore >= cost.actions + reserved && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore - cost.pennies && b.healthAfter === b.healthBefore && b.mindAfter === b.mindBefore - cost.mind && !((c.type === 'LOW_WHISPER' || c.type === 'FOCUSED_CHORUS') && b.mindBefore < 4);
}
/** Replays only this finite life continuation. Returns its exact terminal original root for the encounter. */
export function replayElderLifeRoot(s: SliceState): ThreeHeadedTemplarLifeState | null {
  try {
    const l = s.elder?.life, expected = createElderLifeState(), promotion = s.elder?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, ELDER_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 240 || !integer(promotion, 1, s.week) || !validateElderSceneSource(l.source, s)) return null;
    const p = structuredClone(l.source.snapshot); let previous: ElderLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateElderActivityCommand(raw.command)) return null;
      const e = raw as unknown as ElderLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(expected, c, e.tier), b = e.budget;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date)) || localBlock(expected, p, c, e.week) || !same(e.paid, cost) || !validBudget(b, cost, c)) return null;
      if (wasOpen && previous) { const old = previous.budget; if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter) return null; }
      const handoff = c.type === 'OBSERVE' && expected.source === null ? l.source : null;
      if (!same(e.inheritedScene, handoff) || handoff && (e.week !== handoff.introducedWeek || !same(p, handoff.snapshot))) return null;
      const recordedBase = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source !== null && recordedBase > s.character.coreStats.knowledge) return null;
      const priorCast = expected.journal.find(old => old.source !== null && 'caseId' in c && old.source.caseId === c.caseId);
      if (e.source !== null && priorCast?.source && priorCast.source.baseAbility !== recordedBase) return null;
      const source = checkSource(expected, p, c, recordedBase, s.character.name, s.character.gender);
      if (!same(e.source, source)) return null;
      if (source) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || e.tier !== check.tier || random.cursor !== e.randomAfter) return null; nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, handoff); expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same(l, expected)) return null;
    if (open(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.elder.encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return null;
      const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter) return null;
    }
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'); for (const id of [WHISPER, CHORUS]) if ((s.progression.mastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return p;
  } catch { return null; }
}
export function validateElderLifeState(s: SliceState): boolean {
  try {
    const l = s.elder?.life;
    if (l?.source === null) return same(l, createElderLifeState());
    const p = replayElderLifeRoot(s); if (!p) return false;
    if (s.elder.encounter.status === 'AVAILABLE') return same(s.threeHeadedTemplar.life, p);
    return !open(l) && l.reflected && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED');
  } catch { return false; }
}
export const validateElderLife = validateElderLifeState;
/** Old S3 validation uses this historical root only after all newer mutation evidence passes. */
export function reconstructElderOriginalRoot(s: SliceState): ThreeHeadedTemplarLifeState | null {
  if (!s.elder || !validateElderLifeState(s)) return null;
  if (s.elder.life.source === null) return s.elder.encounter.status === 'AVAILABLE' ? structuredClone(s.threeHeadedTemplar.life) : null;
  const lifeEnd = replayElderLifeRoot(s); if (!lifeEnd) return null;
  const actual = replayElderEncounterRoot(s, lifeEnd);
  if (!actual || !same(actual, s.threeHeadedTemplar.life)) return null;
  return structuredClone(s.elder.life.source.snapshot);
}
