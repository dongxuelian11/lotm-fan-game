import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { createSilentDiscipleLifeState, validateSilentDiscipleLifeOriginal, type SilentDiscipleLifeState } from '../silent-disciple/life.js';
import { hasAncientEvilOldPractice } from './index.js';
import { replayAncientEvilEncounterRoot } from './encounter.js';

export const ANCIENT_EVIL_CASE_IDS = ['lasting-form', 'revoked-form', 'original-link'] as const;
export const ANCIENT_EVIL_ACTIVITY_CASE_IDS = ANCIENT_EVIL_CASE_IDS;
export const ACTIVITY_CASE_IDS = ANCIENT_EVIL_CASE_IDS;
export type AncientEvilCaseId = typeof ANCIENT_EVIL_CASE_IDS[number];
export type AncientEvilLifeAbilityId = 'chained.s2.enduring-transfiguration' | 'chained.s2.curse-guidance';
export type AncientEvilLocation = 'START' | 'A' | 'B';
export type AncientEvilConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'READ_IDENTITY', 'STORE_ITEMS', 'CONSENT_ELSA', 'ENDURING_TRANSFIGURATION', 'STOP_INPUT', 'WITHDRAW_PERMISSION', 'READ_NOTE', 'COMPARE_IDENTITY', 'CURSE_GUIDANCE', 'WAIT_FORM', 'RETURN_ITEMS', 'MANUAL_OPERATION', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type AncientEvilActivityCommand = { type: typeof STEPS[number]; caseId: AncientEvilCaseId } | { type: 'PREPARE'; caseId: AncientEvilCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: AncientEvilCaseId; to: AncientEvilLocation } | { type: 'REFLECT' };
/** The snapshot is historical evidence. All physical changes continue on silentDisciple.life. */
export interface AncientEvilSceneSource { root: 'silentDisciple.life'; promotionWeek: number; introducedWeek: number; snapshot: SilentDiscipleLifeState }
export interface AncientEvilFormRecord {
  subjectId: 'SD3-ELSA'; bodyId: 'SD3-ELSA'; sourceAbilityId: 'chained.s2.enduring-transfiguration'; sourceCaseId: AncientEvilCaseId;
  originalForm: 'HUMAN'; currentForm: 'RABBIT'; castAt: number; expiresAt: number;
}
export interface AncientEvilOperationState { door: 'OPEN'; inputActive: boolean; form: AncientEvilFormRecord | null }
export interface AncientEvilMovement { from: AncientEvilLocation; to: AncientEvilLocation; metres: 4; seconds: 4; itemIds: [] }
export interface AncientEvilAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; consent: AncientEvilConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  identityRead: boolean; identitySourceId: 'SD3-ELSA' | null; originalBodyId: 'SD3-ELSA' | null; originalForm: 'HUMAN' | null;
  itemsStored: boolean; itemsReturned: boolean; reachedNote: boolean; noteRead: boolean; identityCompared: boolean; comparedForm: 'HUMAN' | 'RABBIT' | null;
  formTier: PublicResolutionTier | null; guidanceTier: PublicResolutionTier | null; ownForm: AncientEvilFormRecord | null;
  performed: boolean; manual: boolean; expired: boolean; waits: number; waitedSeconds: number; released: boolean; inspected: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; penniesSpent: 0;
  appliedAbilityIds: AncientEvilLifeAbilityId[]; playerMoves: AncientEvilMovement[]; evidence: string[];
}
export interface AncientEvilCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: AncientEvilAttempt[] }
export interface AncientEvilLifeCost { actions: number; spirituality: number; mind: number; pennies: 0; health: 0; cashGained: 0 }
export interface AncientEvilLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number }
export interface AncientEvilCheckSource {
  caseId: AncientEvilCaseId; abilityId: AncientEvilLifeAbilityId; cost: 6 | 4; difficulty: 20; coreStat: 'knowledge'; baseAbility: number;
  actor: { pathwayId: 'chained'; sequence: 2; name: string; gender: string }; consentWeek: number; at: number;
  actorLocation: AncientEvilLocation; subjectId: 'SD3-ELSA'; subjectLocation: 'A'; bodyId: 'SD3-ELSA'; currentConsent: 'GRANTED' | 'WITHDRAWN';
  originalIdentity: { subjectId: 'SD3-ELSA'; bodyId: 'SD3-ELSA'; originalForm: 'HUMAN'; compared: boolean };
  form: AncientEvilFormRecord | null; currentForm: 'HUMAN' | 'RABBIT'; clothingId: 'SD3-CLOTHES'; bagId: 'SD3-BAG'; trayId: 'SD3-TRAY'; noteId: 'SD3-NOTE';
}
export interface AncientEvilLifeEvent { week: number; date: PublicGameDate; revision: number; randomCursor: number; command: AncientEvilActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: AncientEvilCheckSource | null; inheritedScene: AncientEvilSceneSource | null; paid: AncientEvilLifeCost; budget: AncientEvilLifeBudget }
export interface AncientEvilLifeState { source: AncientEvilSceneSource | null; activeCase: AncientEvilCaseId | null; reflected: boolean; operation: AncientEvilOperationState; cases: Record<AncientEvilCaseId, AncientEvilCaseState>; journal: AncientEvilLifeEvent[] }
export interface AncientEvilLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AncientEvilActivityCommand }
export interface AncientEvilLifeProjection {
  title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: AncientEvilCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: SilentDiscipleLifeState; operation: AncientEvilOperationState; clockSeconds: number; playerLocation: SilentDiscipleLifeState['playerLocation']; playerTravelMetres: number; currentAttempt: AncientEvilAttempt | null;
  cases: { id: AncientEvilCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: AncientEvilAttempt[] }[];
  actions: AncientEvilLifeAction[];
}
const FORM = 'chained.s2.enduring-transfiguration' as const, GUIDANCE = 'chained.s2.curse-guidance' as const;
/** G: only this consensual practice uses this 90-second bound, not a universal sequence rule. */
const PRACTICE_FORM_SECONDS = 90;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const successful = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 2;
const freshCase = (): AncientEvilCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createAncientEvilLifeState(): AncientEvilLifeState { return { source: null, activeCase: null, reflected: false, operation: { door: 'OPEN', inputActive: false, form: null }, cases: { 'lasting-form': freshCase(), 'revoked-form': freshCase(), 'original-link': freshCase() }, journal: [] }; }
const current = (l: AncientEvilLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: AncientEvilLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const itemsHome = (p: SilentDiscipleLifeState) => p.clothing.location === 'ELSA' && p.clothing.worn && p.bag.location === 'ELSA';
const itemsPrivate = (p: SilentDiscipleLifeState) => p.clothing.location === 'TRAY' && !p.clothing.worn && p.bag.location === 'TRAY' && p.tray.location === 'A' && p.tray.privacy === 'PRIVATE';
function cleanupBlock(l: AncientEvilLifeState, p: SilentDiscipleLifeState): string | null {
  if (l.operation.inputActive || l.operation.form !== null || p.volunteer.form !== 'HUMAN') return '先停止新输入，实际等候原身体复原，或付费尝试引导结束自己本次变形。';
  if (!itemsHome(p)) return '须本人到四米处，在原私密托盘旁让埃尔莎穿回同一原衣并归还原包。';
  if (p.playerLocation !== 'START') return '须本人沿四米普通路实际回到原门口。';
  if (p.volunteer.location !== 'A' || p.guide.location !== 'START') return '埃尔莎仍应在四米处，原导师哈伦仍在门口；不能凭空移动或复制旁人。';
  return null;
}
export const hasAncientEvilLifeLock = (s: SliceState): boolean => open(s.ancientEvil.life);
export const ancientEvilInside = hasAncientEvilLifeLock;
export const ancientEvilLifeClosed = (s: SliceState): boolean => !open(s.ancientEvil.life) && s.ancientEvil.life.source !== null && Object.values(s.ancientEvil.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.ancientEvil.life, s.silentDisciple.life);
export function validateAncientEvilActivityCommand(v: unknown): v is AncientEvilActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!ANCIENT_EVIL_CASE_IDS.includes(v.caseId as AncientEvilCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B'].includes(String(v.to));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isAncientEvilActivityCommand = validateAncientEvilActivityCommand;
export const isAncientEvilActivity = validateAncientEvilActivityCommand;
function localBlock(l: AncientEvilLifeState, p: SilentDiscipleLifeState, c: AncientEvilActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三份真实报告并收好原安静室。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = ANCIENT_EVIL_CASE_IDS.indexOf(c.caseId), op = l.operation;
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[ANCIENT_EVIL_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再核对同一原室的人、物与普通退路。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && !r.attempts.length ? null : '须先观察，每案只可准备一次。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' && !!a && (a.performed || a.manual) ? null : '须有实际有限应用或普通核对，并真实归物退出；提前取消不能领取报告成果。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一原室现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实实际收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止。' : null);
  if (a.inspected) return '已经核实，只须结束接触并报告。';
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止，已付成本不退。';
  if (c.type === 'STOP_INPUT') return op.inputActive ? null : '没有正在继续的输入；停止不能让已有兔形瞬间复原。';
  if (c.type === 'WITHDRAW_PERMISSION') return a.consent === 'GRANTED' && !a.permissionWithdrawn && (c.caseId !== 'revoked-form' || a.formTier !== null) ? null : '须有本案当前许可；本案撤回记录在实际尝试之后，撤回后不重复索取。';
  if (c.type === 'WAIT_FORM') return p.playerLocation === 'A' && !op.inputActive && op.form !== null && op.form.sourceCaseId === c.caseId && p.volunteer.form === 'RABBIT' ? null : '须在原身体旁停止输入后，实际等待这次仍存在的全部剩余时间；无需行动或灵性。';
  if (c.type === 'RETURN_ITEMS') return p.playerLocation === 'A' && p.volunteer.location === 'A' && p.volunteer.form === 'HUMAN' && !op.inputActive && op.form === null && a.itemsStored && !a.itemsReturned && itemsPrivate(p) ? null : '须原身体真正恢复人形，才可在四米处私下穿回同一原衣并归还同一原包。';
  if (c.type === 'CURSE_GUIDANCE') return a.method === 'ABILITY' && a.guidanceTier === null && !op.inputActive && p.playerLocation === 'A' && p.volunteer.location === 'A' && p.volunteer.form === 'RABBIT' && a.identityCompared && a.identitySourceId === p.volunteer.id && a.originalBodyId === p.volunteer.bodyId && a.originalForm === 'HUMAN' && op.form !== null && same(op.form, a.ownForm) && op.form.sourceCaseId === c.caseId && op.form.expiresAt > p.clockSeconds + 2 && itemsPrivate(p) && ['GRANTED', 'WITHDRAWN'].includes(a.consent) ? null : '只可按已核对的原身份，引导结束自己本案仍在持续的成功变形；撤回后仅允许这种收尾，不是普遍解咒。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (!(a.performed || a.manual || a.stopped) ? '先完整核对有限结果或明确取消。' : c.caseId === 'revoked-form' && a.method === 'ABILITY' && a.formTier !== null && !a.permissionWithdrawn ? '本案须记录埃尔莎在尝试后明确撤回，再核实退出。' : null);
  if (c.type === 'WALK') {
    if (op.inputActive) return '先停止新输入，再沿原路步行；已有兔形仍按实际时钟持续。';
    if (p.playerLocation === 'START' && c.to === 'A') return !a.playerMoves.length && !a.stopped ? null : '本案只从原门口进入一次。';
    if (p.playerLocation === 'A' && c.to === 'B') return a.identityRead && !a.reachedNote && !a.stopped && (c.caseId !== 'revoked-form' || a.formTier === null || a.permissionWithdrawn) ? null : '先读原身份，并记录本案已有的撤回，再实际走向原纸。';
    if (p.playerLocation === 'B' && c.to === 'A') return a.noteRead || a.stopped ? null : '先亲读同一原纸或明确取消，再沿四米原路返回。';
    if (p.playerLocation === 'A' && c.to === 'START') return itemsHome(p) && p.volunteer.form === 'HUMAN' && op.form === null && (a.performed || a.manual || a.stopped) ? null : '须先让原身体真实复原、原物归主，再沿四米原路离开。';
    return '只能沿门口、四米处埃尔莎和八米处原纸之间的相邻普通道路行走。';
  }
  if (c.type === 'READ_NOTE') return p.playerLocation === 'B' && a.identityRead && !a.noteRead ? null : '须本人实际来到八米处，亲读同一原纸。';
  if (c.type === 'COMPARE_IDENTITY') return p.playerLocation === 'A' && p.volunteer.location === 'A' && a.noteRead && !a.identityCompared ? null : '须亲读八米处原纸并走回，面对同一原身体比较身份和当前形态。';
  if (a.stopped) return '方案已经取消；仍可停止、等待、核对原身体、归物与普通退出。';
  if (c.type === 'READ_IDENTITY') return p.playerLocation === 'A' && p.volunteer.location === 'A' && !a.identityRead && p.volunteer.form === 'HUMAN' ? null : '须本人到四米处，先亲见埃尔莎的同一原身份与人形身体。';
  if (c.type === 'STORE_ITEMS') return a.method === 'ABILITY' && p.playerLocation === 'A' && a.identityRead && !a.itemsStored && a.formTier === null && itemsHome(p) && p.volunteer.form === 'HUMAN' ? null : '须先核原身份，再在原私密托盘存放同一原衣和原包，不能复制衣物。';
  if (c.type === 'CONSENT_ELSA') return a.method === 'ABILITY' && p.playerLocation === 'A' && p.volunteer.location === 'A' && a.identityRead && a.itemsStored && itemsPrivate(p) && a.consent === 'UNASKED' && p.volunteer.willing ? null : '须本人当面完成原身份与私密存物后，取得仅限本次且可撤回的当前许可。';
  if (c.type === 'ENDURING_TRANSFIGURATION') return a.method === 'ABILITY' && a.formTier === null && a.consent === 'GRANTED' && p.volunteer.willing && p.playerLocation === 'A' && p.volunteer.location === 'A' && a.identityRead && itemsPrivate(p) && p.volunteer.form === 'HUMAN' && op.form === null ? null : '仅可对当前明确同意、原物已存妥的同一埃尔莎尝试一次；旧同意或撤回后的许可均不可复用。';
  if (c.type === 'MANUAL_OPERATION') return p.playerLocation === 'A' && a.identityRead && a.noteRead && a.identityCompared && p.volunteer.form === 'HUMAN' && !op.inputActive && op.form === null && !a.performed && !a.manual ? null : '须实际往返并核对同一原身体，已停止并真正复原后，才可用普通方法完成。';
  return '当前阶段不能进行这一步。';
}
function commandCost(_l: AncientEvilLifeState, c: AncientEvilActivityCommand, tier: PublicResolutionTier | null = null): AncientEvilLifeCost {
  const cast = c.type === 'ENDURING_TRANSFIGURATION' || c.type === 'CURSE_GUIDANCE';
  return { actions: ['OBSERVE', 'PREPARE', 'ENDURING_TRANSFIGURATION', 'CURSE_GUIDANCE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: c.type === 'ENDURING_TRANSFIGURATION' ? 6 : c.type === 'CURSE_GUIDANCE' ? 4 : 0, mind: cast ? tier !== null && !successful(tier) ? 4 : 2 : 0, pennies: 0, health: 0, cashGained: 0 };
}
export function blockAncientEvilLife(s: SliceState, c: AncientEvilActivityCommand): string | null {
  if (!validateAncientEvilActivityCommand(c)) return '古代邪物生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已经成为古代邪物。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际来到贝克兰德原安静室。';
  if (s.ancientEvil.preparedWeek !== null || s.ancientEvil.encounter.status !== 'AVAILABLE') return '先完成服药准备；后续遭遇开始后不能重开原案。';
  if (s.ancientEvil.life.source === null && hasAncientEvilOldPractice(s)) return '先收束此前原室中的全部接触与原物。';
  if (s.ancientEvil.life.source === null && !validateAncientEvilSceneSource({ root: 'silentDisciple.life', promotionWeek: s.ancientEvil.promotionWeek, introducedWeek: s.week, snapshot: s.silentDisciple.life }, s)) return '原安静室的旧实践与收尾记录须完整，不能凭空接出另一间房。';
  const reason = localBlock(s.ancientEvil.life, s.silentDisciple.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.ancientEvil.life, c), casts = c.type === 'PREPARE' && c.method === 'ABILITY' ? 2 : 0;
  if (s.actionsRemaining < cost.actions + casts) return '本周须预留准备及两次有限施术的行动；普通收尾不耗行动。';
  if (s.spirituality < cost.spirituality || s.mind < (c.type === 'ENDURING_TRANSFIGURATION' || c.type === 'CURSE_GUIDANCE' ? 4 : cost.mind)) return '当前资源不足以支付真实成本及可能的失败冲击；已有形态总能免费实际等候。';
  return null;
}
/** Elapsed time restores only the same original body; it never equips or duplicates belongings. */
export function advanceAncientEvilLifeClock(l: AncientEvilLifeState, p: SilentDiscipleLifeState, seconds: number, a: AncientEvilAttempt | null = null): void {
  if (!integer(seconds)) throw new Error('实际经过的秒数无效。');
  p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (l.operation.form !== null && l.operation.form.expiresAt <= p.clockSeconds) { p.volunteer.form = 'HUMAN'; l.operation.form = null; l.operation.inputActive = false; if (a) a.expired = true; }
}
const elapse = advanceAncientEvilLifeClock;
function freshAttempt(week: number, date: PublicGameDate, method: 'ABILITY' | 'ORDINARY'): AncientEvilAttempt {
  return { week, date: structuredClone(date), method, consent: 'UNASKED', closed: false, stopped: false, permissionWithdrawn: false, identityRead: false, identitySourceId: null, originalBodyId: null, originalForm: null, itemsStored: false, itemsReturned: false, reachedNote: false, noteRead: false, identityCompared: false, comparedForm: null, formTier: null, guidanceTier: null, ownForm: null, performed: false, manual: false, expired: false, waits: 0, waitedSeconds: 0, released: false, inspected: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, penniesSpent: 0, appliedAbilityIds: [], playerMoves: [], evidence: [] };
}
function checkSource(l: AncientEvilLifeState, p: SilentDiscipleLifeState, c: AncientEvilActivityCommand, baseAbility: number, name: string, gender: string): AncientEvilCheckSource | null {
  if (c.type !== 'ENDURING_TRANSFIGURATION' && c.type !== 'CURSE_GUIDANCE') return null;
  const a = l.cases[c.caseId].attempts.at(-1)!;
  return { caseId: c.caseId, abilityId: c.type === 'ENDURING_TRANSFIGURATION' ? FORM : GUIDANCE, cost: c.type === 'ENDURING_TRANSFIGURATION' ? 6 : 4, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'chained', sequence: 2, name, gender }, consentWeek: l.cases[c.caseId].consentWeek!, at: p.clockSeconds, actorLocation: p.playerLocation, subjectId: p.volunteer.id, subjectLocation: 'A', bodyId: p.volunteer.bodyId, currentConsent: a.consent as 'GRANTED' | 'WITHDRAWN', originalIdentity: { subjectId: a.identitySourceId!, bodyId: a.originalBodyId!, originalForm: a.originalForm!, compared: a.identityCompared }, form: structuredClone(l.operation.form), currentForm: p.volunteer.form, clothingId: p.clothing.id, bagId: p.bag.id, trayId: p.tray.id, noteId: p.note.id };
}
function evolve(l: AncientEvilLifeState, p: SilentDiscipleLifeState, c: AncientEvilActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: AncientEvilSceneSource | null): void {
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 6); return; }
  const r = l.cases[c.caseId], op = l.operation;
  if (c.type === 'OBSERVE') { if (l.source === null) { if (!source) throw new Error('缺少同一原室的交接记录。'); l.source = structuredClone(source); } r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 4); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, date, c.method); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; elapse(l, p, 2, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent !== 'WITHDRAWN') a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, p, 2, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': a.playerMoves.push({ from: p.playerLocation, to: c.to, metres: 4, seconds: 4, itemIds: [] }); p.playerLocation = c.to; p.playerTravelMetres += 4; a.playerTravelMetres += 4; if (c.to === 'B') a.reachedNote = true; elapse(l, p, 4, a); break;
    case 'READ_IDENTITY': a.identityRead = true; a.identitySourceId = p.volunteer.id; a.originalBodyId = p.volunteer.bodyId; a.originalForm = 'HUMAN'; a.evidence.push('本人在四米处亲见43岁的原埃尔莎，记录同一身份与原人形身体；健康、精神、灵性与原伤势不因试验改变。'); elapse(l, p, 2, a); break;
    case 'STORE_ITEMS': p.clothing.location = 'TRAY'; p.clothing.worn = false; p.bag.location = 'TRAY'; a.itemsStored = true; a.evidence.push('埃尔莎在原私密托盘旁存放同一套原衣与同一原包，物品仍归她所有，只有这一份。'); elapse(l, p, 2, a); break;
    case 'CONSENT_ELSA': a.consent = 'GRANTED'; r.consentWeek = week; a.evidence.push('原身份与私密存物完成后，埃尔莎当面同意仅本次有限变形；可随时撤回，新输入必须停止，收尾可付费引导或实际等候。'); elapse(l, p, 1, a); break;
    case 'ENDURING_TRANSFIGURATION': a.formTier = tier; a.spiritualitySpent += 6; a.mindSpent += successful(tier) ? 2 : 4; r.status = 'ACTIVE'; elapse(l, p, 2, a); if (successful(tier)) { op.form = { subjectId: p.volunteer.id, bodyId: p.volunteer.bodyId, sourceAbilityId: FORM, sourceCaseId: c.caseId, originalForm: 'HUMAN', currentForm: 'RABBIT', castAt: p.clockSeconds, expiresAt: p.clockSeconds + PRACTICE_FORM_SECONDS }; a.ownForm = structuredClone(op.form); p.volunteer.form = 'RABBIT'; op.inputActive = true; a.evidence.push('本次持久变形实际成功：同一原身体变为兔形，本练习上限九十秒；原衣原包仍在托盘，未产生第二身体。'); } else a.evidence.push('持久变形未成；六灵性与失败精神成本已实付，原身体仍为人形。'); break;
    case 'STOP_INPUT': op.inputActive = false; a.evidence.push('停止新输入；已经存在的同一兔形仍持续，不能以停止按钮代替真实复原。'); elapse(l, p, 1, a); break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.consent = 'WITHDRAWN'; op.inputActive = false; a.evidence.push('埃尔莎明确撤回本案许可，禁止任何新的变形；已有兔形不瞬间消失，只可引导结束自己这次效果或实际等候。'); elapse(l, p, 1, a); break;
    case 'READ_NOTE': a.noteRead = true; a.evidence.push('本人实际到八米处亲读同一原纸：核对埃尔莎的原身份、原身体与原物，不能把陌生诅咒或他人效果当成本次来源。'); elapse(l, p, 2, a); break;
    case 'COMPARE_IDENTITY': a.identityCompared = true; a.comparedForm = p.volunteer.form; a.evidence.push(`本人沿原路走回四米处，逐项比对原纸与同一埃尔莎；当前${p.volunteer.form === 'RABBIT' ? '仍是兔形' : '已经是人形'}，原身体身份未变。`); if (!a.stopped && op.form !== null && same(op.form, a.ownForm) && p.volunteer.form === 'RABBIT') { a.performed = true; a.appliedAbilityIds.push(FORM); } elapse(l, p, 2, a); break;
    case 'CURSE_GUIDANCE': a.guidanceTier = tier; a.spiritualitySpent += 4; a.mindSpent += successful(tier) ? 2 : 4; elapse(l, p, 2, a); if (successful(tier)) { p.volunteer.form = 'HUMAN'; op.form = null; op.inputActive = false; a.released = true; if (!a.stopped) a.appliedAbilityIds.push(GUIDANCE); a.evidence.push('按正确原身份联系，解咒引导实际结束本人这次仍在持续的变形；同一身体恢复原人形，原衣原包尚须私下交还。'); } else a.evidence.push('解咒引导未成；四灵性与失败精神成本已支付，原兔形仍按原剩余时间持续。'); break;
    case 'WAIT_FORM': { const seconds = Math.max(0, op.form!.expiresAt - p.clockSeconds); a.waits++; a.waitedSeconds += seconds; elapse(l, p, seconds, a); a.evidence.push(`实际等待剩余${seconds}秒，同一身体按原限时恢复人形；没有退款、治疗或自动穿衣。`); break; }
    case 'RETURN_ITEMS': p.clothing.location = 'ELSA'; p.clothing.worn = true; p.bag.location = 'ELSA'; a.itemsReturned = true; a.evidence.push('本人在四米处核实已是原人形，埃尔莎在原托盘旁私下穿回同一原衣，收回同一原包；数量和所有权不变。'); elapse(l, p, 2, a); break;
    case 'MANUAL_OPERATION': a.manual = true; a.evidence.push('亲见原身份、实际往返读取原纸并比较原身体后，以普通核对完成；没有把失败或未使用的技巧计为掌握。'); elapse(l, p, 4, a); break;
    case 'STOP': a.stopped = true; op.inputActive = false; a.evidence.push('明确取消后续方案；已支付成本和仍存形态均保留，只继续安全收尾。'); elapse(l, p, 1, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 2, a); break;
  }
}
export function applyAncientEvilActivity(s: SliceState, c: AncientEvilActivityCommand, ctx: SeerContext): void {
  const reason = blockAncientEvilLife(s, c); if (reason) throw new Error(reason);
  const l = s.ancientEvil.life, p = s.silentDisciple.life, source = checkSource(l, p, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene: AncientEvilSceneSource | null = c.type === 'OBSERVE' && l.source === null ? { root: 'silentDisciple.life', promotionWeek: s.ancientEvil.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(p) } : null;
  const randomCursor = s.random.cursor;
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(l, c, tier), budget: AncientEvilLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash, healthBefore: s.health, healthAfter: s.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.mind = budget.mindAfter;
  evolve(l, p, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, randomCursor, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原安静室：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation]}。同一埃尔莎当前${p.volunteer.form === 'HUMAN' ? '为人形' : '为兔形'}；原物、实际秒数、当前许可与已付成本均有记录。`);
}
export const applyAncientEvilLife = applyAncientEvilActivity;
export const handleAncientEvilLife = applyAncientEvilActivity;
const LOCATIONS = { START: '原室门口', A: '四米处埃尔莎身旁', B: '八米处原纸旁' } as const;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<AncientEvilActivityCommand['type'], string> = { OBSERVE: '核对原室的人、物与普通退路', PREPARE: '准备本案有限核对', WALK: '沿原路普通步行', READ_IDENTITY: '当面记录埃尔莎的原身份与身体', STORE_ITEMS: '在原私密托盘存放原衣与原包', CONSENT_ELSA: '当面询问本次当前可撤回许可', ENDURING_TRANSFIGURATION: '尝试同一身体的持久变形', STOP_INPUT: '停止新输入并保留现有形态', WITHDRAW_PERMISSION: '听取埃尔莎明确撤回本案许可', READ_NOTE: '亲读八米处同一原纸', COMPARE_IDENTITY: '当面对比原身份与当前真实形态', CURSE_GUIDANCE: '按原身份引导结束自己本次变形', WAIT_FORM: '实际等待当前形态全部剩余时间', RETURN_ITEMS: '人形复原后私下穿回原衣并归包', MANUAL_OPERATION: '以普通原身份核对完成', STOP: '明确取消后续方案并安全收尾', INSPECT: '核实真实复原、原物与普通退出', LEAVE: '结束已经收束的接触', CLOSE: '结束已经收束的接触', WITHDRAW: '如实取消并结束接触', REPORT: '报告实际发生的有限结果', REFLECT: '反思三次有限实践' };
export const ANCIENT_EVIL_LIFE_STORY = '43岁的埃尔莎·莫尔仍在原安静室四米处，哈伦留在原门口。她始终只有同一原身体；原衣、原包、私密托盘与原纸各只有一份。每案先核原身份，能力路线须私下存妥原物，再取得本次可撤回许可。持久变形只改变这具身体；解咒引导只尝试结束自己本案仍在持续、且已核对正确原身份的变形。';
export const ANCIENT_EVIL_LIFE_ENVIRONMENT = '门口、埃尔莎和原纸分别在零米、四米、八米，每米步行一秒。持久变形需一行动、六灵性；解咒引导需一行动、四灵性；两者知识难度二十，成功损二精神、失败损四精神。本练习兔形上限九十秒，停止与撤回不代办复原。每案总有零行动、零灵性的实际等待与普通归物退路；只有真正应用的技巧才增加掌握。';
const CASES: { id: AncientEvilCaseId; title: string; story: string }[] = [
  { id: 'lasting-form', title: '停止输入后的同一身体', story: '核原身份、私密存物并取得当前许可后，可尝试本练习九十秒持久变形。停止输入后仍须实际走到原纸旁，再返回比较同一身体的当前形态；可付费引导复原或实际等候。' },
  { id: 'revoked-form', title: '撤回许可后的真实复原', story: '埃尔莎在本次尝试后明确撤回。立即禁止新变形，已成兔形不会瞬间消失；核对原身份后只可引导结束自己这次效果，或免费实际等待。人形复原后才私下归物。' },
  { id: 'original-link', title: '正确原身份的有限解咒', story: '本人实际往返读取同一原纸，将记录与当前原身体比对。解咒引导须有自己本案成功且仍在的变形，以及正确原身份联系；不能移除陌生诅咒、旧伤或他人任意效果。' },
];
function preferred(s: SliceState, actions: AncientEvilLifeAction[]): AncientEvilLifeAction | undefined {
  const l = s.ancientEvil.life, p = s.silentDisciple.life, a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: AncientEvilActivityCommand['type']) => enabled.find(x => x.command.type === type), walk = (to: AncientEvilLocation) => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!a) return pick('OBSERVE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (a.stopped) return pick('STOP_INPUT') ?? (p.playerLocation === 'B' ? walk('A') : undefined) ?? pick('WAIT_FORM') ?? pick('RETURN_ITEMS') ?? walk('START') ?? pick('INSPECT');
  if (l.activeCase === 'revoked-form' && a.formTier !== null && !a.permissionWithdrawn) return pick('WITHDRAW_PERMISSION');
  if (p.playerLocation === 'START') return walk('A') ?? pick('INSPECT');
  if (p.playerLocation === 'B') return pick('READ_NOTE') ?? walk('A');
  if (!a.identityRead) return pick('READ_IDENTITY');
  if (!a.reachedNote) {
    if (a.method === 'ABILITY') return pick('STORE_ITEMS') ?? pick('CONSENT_ELSA') ?? pick('ENDURING_TRANSFIGURATION') ?? pick('STOP_INPUT') ?? walk('B') ?? pick('STOP');
    return walk('B');
  }
  return pick('COMPARE_IDENTITY') ?? pick('STOP_INPUT') ?? pick('CURSE_GUIDANCE') ?? pick('WAIT_FORM') ?? pick('MANUAL_OPERATION') ?? pick('RETURN_ITEMS') ?? walk('START') ?? pick('INSPECT') ?? pick('STOP');
}
export function ancientEvilLifeActions(s: SliceState): AncientEvilLifeAction[] {
  if (!promoted(s) || s.ancientEvil.encounter.status !== 'AVAILABLE') return [];
  const l = s.ancientEvil.life, p = s.silentDisciple.life, out: AncientEvilLifeAction[] = [], id = l.activeCase ?? ANCIENT_EVIL_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: AncientEvilActivityCommand) => { const reason = blockAncientEvilLife(s, command), cost = commandCost(l, command), values = [`${cost.actions}行动`]; if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', '知识20'); if (command.type === 'WAIT_FORM') values.push(`${Math.max(0, (l.operation.form?.expiresAt ?? p.clockSeconds) - p.clockSeconds)}秒`); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : ''; out.push({ id: `AE2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command }); };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const command: AncientEvilActivityCommand = { type, caseId: id }; if (localBlock(l, p, command, s.week) === null) add(command); }
    for (const to of ['START', 'A', 'B'] as const) { const command: AncientEvilActivityCommand = { type: 'WALK', caseId: id, to }; if (localBlock(l, p, command, s.week) === null) add(command); }
  }
  return out;
}
export function projectAncientEvilLife(s: SliceState): AncientEvilLifeProjection {
  const l = s.ancientEvil.life, p = s.silentDisciple.life, actions = ancientEvilLifeActions(s), next = preferred(s, actions);
  return { title: '原安静室的持久变形与有限解咒', story: ANCIENT_EVIL_LIFE_STORY, environment: ANCIENT_EVIL_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，原身体、原物与所有实际消耗继续保留。' : '先支付必要成本或收束当前接触。'), preferredActionId: next?.id ?? null,
    facts: [`同一位43岁的埃尔莎${p.volunteer.location === 'A' ? '在四米处' : '已沿实际道路离开'}，当前${p.volunteer.form === 'HUMAN' ? '为原人形' : '为同一身体的兔形'}，健康、精神与灵性仍各为${p.volunteer.health}、${p.volunteer.mind}、${p.volunteer.spirituality}。`, `原衣${p.clothing.location === 'ELSA' ? '已由埃尔莎穿回' : '仍在私密托盘'}，原包${p.bag.location === 'ELSA' ? '由她持有' : '仍在同一托盘'}，所有权与数量不变。`, `原纸仍在八米处，本人累计普通步行${p.playerTravelMetres}米，原室时钟${p.clockSeconds}秒。`, l.operation.form !== null ? `本次同一身体的兔形还剩${Math.max(0, l.operation.form.expiresAt - p.clockSeconds)}秒；停止输入不会立即复原。` : '当前没有本次持久变形；复原不替代原物归还。', '原门保持开放；旧伤与已结清的月相经历完整保留，本次不追加月相惩罚，也不清除陌生诅咒。'], activeCase: l.activeCase, inside: hasAncientEvilLifeLock(s), insideCase: open(l), reflected: l.reflected, site: structuredClone(p), operation: structuredClone(l.operation), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: structuredClone(current(l)), cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { ...d, observations: a ? [`实付${a.spiritualitySpent}灵性、${a.mindSpent}精神；本人步行${a.playerTravelMetres}米，实际经过${a.elapsedSeconds}秒。`, ...a.evidence] : [], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已保留同一身体的真实有限应用与原物归还记录。' : '普通核对或明确取消，未实际应用的技巧不增加掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions };
}

/** Validate the completed old room by its entire original lifecycle, not just its appearance. */
export function validateAncientEvilSceneSource(v: unknown, s: SliceState): v is AncientEvilSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot']) || v.root !== 'silentDisciple.life' || v.promotionWeek !== s.ancientEvil.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !integer(v.introducedWeek, v.promotionWeek, s.week) || !record(v.snapshot)) return false;
    const p = v.snapshot as unknown as SilentDiscipleLifeState;
    if (!shape(p, Object.keys(createSilentDiscipleLifeState())) || p.siteId !== 'SD3-QUIET-ROOM' || p.playerLocation !== 'START' || p.volunteer?.id !== 'SD3-ELSA' || p.volunteer.name !== '埃尔莎·莫尔' || p.volunteer.age !== 43 || p.volunteer.alive !== true || p.volunteer.location !== 'A' || p.volunteer.bodyId !== 'SD3-ELSA' || p.volunteer.form !== 'HUMAN' || p.volunteer.health !== 100 || p.volunteer.mind !== 100 || p.volunteer.spirituality !== 100 || p.guide?.id !== 'HARLAN' || p.guide.location !== 'START' || p.clothing?.id !== 'SD3-CLOTHES' || p.clothing.owner !== 'SD3-ELSA' || p.clothing.quantity !== 1 || p.bag?.id !== 'SD3-BAG' || p.bag.owner !== 'SD3-ELSA' || p.bag.quantity !== 1 || !itemsHome(p) || p.tray?.id !== 'SD3-TRAY' || p.tray.location !== 'A' || p.tray.privacy !== 'PRIVATE' || p.note?.id !== 'SD3-NOTE' || p.note.quantity !== 1 || p.note.location !== 'B' || p.activeCase !== null || !p.reflected || !record(p.cases) || !Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) || p.moon?.status !== 'RESOLVED' || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    return validateSilentDiscipleLifeOriginal({ ...s, week: v.introducedWeek, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, silentDisciple: { ...s.silentDisciple, life: structuredClone(p) } });
  } catch { return false; }
}
function validBudget(b: AncientEvilLifeBudget, cost: AncientEvilLifeCost, c: AncientEvilActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  const reserved = c.type === 'PREPARE' && c.method === 'ABILITY' ? 2 : 0;
  return b.actionsBefore >= cost.actions + reserved && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore && b.healthAfter === b.healthBefore && b.mindAfter === b.mindBefore - cost.mind && !((c.type === 'ENDURING_TRANSFIGURATION' || c.type === 'CURSE_GUIDANCE') && b.mindBefore < 4);
}
/** Replay the finite continuation into the original room; never mutate old case history. */
export function replayAncientEvilLifeRoot(s: SliceState): SilentDiscipleLifeState | null {
  try {
    const l = s.ancientEvil?.life, expected = createAncientEvilLifeState(), promotion = s.ancientEvil?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, ANCIENT_EVIL_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 240 || !integer(promotion, 1, s.week) || !validateAncientEvilSceneSource(l.source, s)) return null;
    const p = structuredClone(l.source.snapshot); let previous: AncientEvilLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'randomCursor', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateAncientEvilActivityCommand(raw.command)) return null;
      const e = raw as unknown as AncientEvilLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(expected, c, e.tier), b = e.budget;
      if (!integer(e.randomCursor, nextCursor, s.random.cursor)) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1) && e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
      const acquisition = s.ancientEvil.acquisitionJournal.at(-1);
      if (!previous && acquisition && e.revision === acquisition.revision + 1 && e.randomCursor !== acquisition.randomAfter) return null;
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
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.randomBefore !== e.randomCursor || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || e.tier !== check.tier || random.cursor !== e.randomAfter) return null; nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, handoff); expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same(l, expected)) return null;
    if (open(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.ancientEvil.encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return null;
      if (s.random.cursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
      const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter) return null;
    }
    if (previous && s.revision === previous.revision + 1 && s.week === previous.week && previous.budget.actionsAfter > 0) {
      const b = previous.budget;
      if (!same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter) return null;
    }
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'); for (const id of [FORM, GUIDANCE]) if ((s.progression.mastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return p;
  } catch { return null; }
}
export function validateAncientEvilLifeState(s: SliceState): boolean {
  try {
    const l = s.ancientEvil?.life;
    if (l?.source === null) return same(l, createAncientEvilLifeState());
    const p = replayAncientEvilLifeRoot(s); if (!p) return false;
    if (s.ancientEvil.encounter.status === 'AVAILABLE') return same(s.silentDisciple.life, p);
    return !open(l) && l.reflected && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED');
  } catch { return false; }
}
export const validateAncientEvilLife = validateAncientEvilLifeState;
/** Old validation may use its snapshot only after every new mutation has been replayed. */
export function reconstructAncientEvilOriginalRoot(s: SliceState): SilentDiscipleLifeState | null {
  if (!s.ancientEvil || !validateAncientEvilLifeState(s)) return null;
  if (s.ancientEvil.life.source === null) return s.ancientEvil.encounter.status === 'AVAILABLE' ? structuredClone(s.silentDisciple.life) : null;
  const lifeEnd = replayAncientEvilLifeRoot(s); if (!lifeEnd) return null;
  const actual = replayAncientEvilEncounterRoot(s, lifeEnd);
  if (!actual || !same(actual, s.silentDisciple.life)) return null;
  return structuredClone(s.ancientEvil.life.source.snapshot);
}

/** The old validator gets its source only after replay has justified every new physical change. */
export function validateAncientEvilSourceSilentDiscipleLife(s: SliceState): boolean {
  try {
    if (s.ancientEvil?.life.source === null) return validateSilentDiscipleLifeOriginal(s);
    if (s.progression.pathwayId !== 'chained' || s.progression.sequence !== 2 || s.ancientEvil.silentDiscipleActingAtPromotion !== 100) return false;
    const original = reconstructAncientEvilOriginalRoot(s);
    if (!original) return false;
    return validateSilentDiscipleLifeOriginal({ ...s, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, silentDisciple: { ...s.silentDisciple, life: original } });
  } catch { return false; }
}
