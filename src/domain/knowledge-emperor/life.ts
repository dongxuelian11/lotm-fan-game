import { publicPryerFields, publicPryerDate, publicPryerCheck, publicPryerInjury, publicSageSite, publicSageMovement, type SagePublicSite } from '../sage/life.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { STAR_MYSTIC_ABILITY_IDS } from '../star-mystic/types.js';
import { MYSTIC_ABILITY_IDS } from '../mystic/types.js';
import { PROPHECY_MASTER_ABILITY_IDS } from '../prophecy-master/types.js';
import { SAGE_ABILITY_IDS } from '../sage/types.js';
import { KNOWLEDGE_EMPEROR_ABILITY_IDS } from './types.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { createSageSiteState, validateSageSiteState, type SageLocation, type SageMovement, type SageSiteState } from '../sage/life.js';
import type { KnowledgeEmperorOriginals } from './types.js';
export type { KnowledgeEmperorOriginals } from './types.js';
import { knowledgeEmperorEncounterBudget, knowledgeEmperorFinanceSnapshot, validateKnowledgeEmperorFinanceSnapshot,
  type KnowledgeEmperorEncounterBudget, type KnowledgeEmperorFinanceSnapshot } from './encounter.js';

export const KNOWLEDGE_EMPEROR_CASE_IDS = ['knowledge-power', 'power-knowledge', 'withdrawn-consent'] as const;
export type KnowledgeEmperorCaseId = typeof KNOWLEDGE_EMPEROR_CASE_IDS[number];
export type KnowledgeEmperorLifeAbilityId = 'hermit.s1.knowledge-power' | 'hermit.s1.power-knowledge';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'ABILITY';
type Consent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'APPROACH', 'WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'COPY_NOTE', 'KNOWLEDGE_POWER', 'APPLY_POWER', 'SPEND_FORCE', 'POWER_KNOWLEDGE', 'VERIFY_REACTION', 'WAIT_10', 'STOP_METHOD', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_NOTE', 'LEAVE', 'ABORT', 'REPORT'] as const;
export type KnowledgeEmperorActivityCommand =
  | { type: typeof STEPS[number]; caseId: KnowledgeEmperorCaseId }
  | { type: 'PREPARE'; caseId: KnowledgeEmperorCaseId; method: Method }
  | { type: 'CONSENT' | 'WITHDRAW_CONSENT'; caseId: KnowledgeEmperorCaseId; permission: Permission }
  | { type: 'RECOVER_ENERGY' | 'REFLECT' };
export interface KnowledgeEmperorReading {
  pageId: 'SG2-ARCHIVE-LEAF'; location: 'B'; at: number; readingNumber: number; permissionVersion: number;
  facts: string[];
}
export interface KnowledgeEmperorNote {
  id: string; substrateId: string; caseId: KnowledgeEmperorCaseId; ownerId: 'PLAYER'; quantity: 1;
  status: 'PLAYER' | 'RETURNED'; location: 'PLAYER' | 'OWNER'; copied: boolean; paidPennies: 20; boughtWeek: number;
  charges: 0 | 1; wear: number; travelMetres: number; content: string[]; reading: KnowledgeEmperorReading | null;
}
export interface KnowledgeEmperorForceReceipt {
  id: string; caseId: 'power-knowledge'; noteId: string; substrateId: string; pageId: 'SG2-ARCHIVE-LEAF'; location: 'B';
  at: number; elapsedSeconds: 1; spiritualitySpent: 4; force: 6; noteChargeSpent: 1; noteWear: number;
  paperEdgeMovedMm: 1; permissionVersion: number;
}
export interface KnowledgeEmperorLifeWindow {
  abilityId: KnowledgeEmperorLifeAbilityId; caseId: KnowledgeEmperorCaseId; noteId: string; substrateId: string;
  pageId: 'SG2-ARCHIVE-LEAF'; location: 'B'; permissionVersion: number; createdAt: number; expiresAt: number;
  forceReceiptId: string | null;
}
export interface KnowledgeEmperorAttempt {
  week: number; method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; ownerTravelMetres: number; energySpent: number;
  spiritualitySpent: number; checkSpiritualitySpent: number; forceSpiritualitySpent: number; mindSpent: number; penniesSpent: 20;
  noteSubstrateId: string; reading: KnowledgeEmperorReading | null; forceReceipt: KnowledgeEmperorForceReceipt | null; forceReceiptValid: boolean;
  knowledgePowerTier: PublicResolutionTier | null; powerKnowledgeTier: PublicResolutionTier | null;
  applicationDone: boolean; verified: boolean; baselineStabilization: 0 | 3; measuredStabilization: 0 | 3 | 6;
  observedReaction: string | null; appliedAbilityIds: KnowledgeEmperorLifeAbilityId[];
  waits: number; ownerAccompanied: boolean; windowEnd: 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'EXPIRED' | 'MOVED' | 'STOPPED' | 'WITHDRAWN';
  result: 'NONE' | Method; siteAtStart: SageSiteState; siteAtClose: SageSiteState | null;
}
export interface KnowledgeEmperorLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  permission: Record<Permission, Consent>; permissionVersion: number; consentWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; attempts: KnowledgeEmperorAttempt[];
}
export interface KnowledgeEmperorLifeCost { actions: number; pennies: number; spirituality: number; mind: number; energy: number; forceSpirituality: number }
export interface KnowledgeEmperorLifeSource {
  caseId: KnowledgeEmperorCaseId; at: number; pageId: 'SG2-ARCHIVE-LEAF'; playerLocation: SageLocation;
  body: 'SOLID'; note: KnowledgeEmperorNote; reading: KnowledgeEmperorReading; permissionVersion: number;
  forceReceipt: KnowledgeEmperorForceReceipt | null; window: KnowledgeEmperorLifeWindow | null;
}
export interface KnowledgeEmperorLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: KnowledgeEmperorActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null;
  check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: KnowledgeEmperorEncounterBudget; after: KnowledgeEmperorEncounterBudget; finance: KnowledgeEmperorFinanceSnapshot;
  paid: KnowledgeEmperorLifeCost; elapsedSeconds: number; energyRecovered: number;
  moves: SageMovement[]; siteBefore: SageSiteState; siteAfter: SageSiteState; source: KnowledgeEmperorLifeSource | null;
}
export interface KnowledgeEmperorLifeState {
  sourceWeek: number | null; activeCase: KnowledgeEmperorCaseId | null; reflected: boolean; site: SageSiteState;
  notes: KnowledgeEmperorNote[]; pending: KnowledgeEmperorLifeWindow | null; energyRecovered: number;
  cases: Record<KnowledgeEmperorCaseId, KnowledgeEmperorLifeCase>; journal: KnowledgeEmperorLifeReceipt[];
}
export interface KnowledgeEmperorLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: KnowledgeEmperorActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface KnowledgeEmperorLifeProjection {
  title: string; story: string; source: string; environment: string; activeCase: KnowledgeEmperorCaseId | null;
  inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  site: SagePublicSite; clockSeconds: number; playerLocation: SageLocation; playerTravelMetres: number;
  pending: KnowledgeEmperorLifeWindow | null; pendingRemainingSeconds: number; currentAttempt: KnowledgeEmperorPublicAttempt | null;
  notes: KnowledgeEmperorNote[];
  cases: { id: KnowledgeEmperorCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; permission: Record<Permission, Consent>; permissionVersion: number; contactOpen: boolean; returned: boolean; attempts: KnowledgeEmperorPublicAttempt[] }[];
  ledger: KnowledgeEmperorPublicLifeReceipt[]; actions: KnowledgeEmperorLifeAction[];
}
const KP: KnowledgeEmperorLifeAbilityId = 'hermit.s1.knowledge-power', PK: KnowledgeEmperorLifeAbilityId = 'hermit.s1.power-knowledge';
const POSITION: Record<SageLocation, number> = { YARD: -4, OUTSIDE: -2, ENTRY: 0, A: 6, B: 10 };
const FACTS = ['第三格原盒已经盖好。', '第四格有一只空夹，旧旁注“空置”不准确。', '缺失正文仍然未知，不能由力量补全。'];
const REACTION = '同一原档页边缘在实付4灵性的短促推力下移动1毫米，夹持处仍有阻力；没有读出缺失正文。';
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (t: PublicResolutionTier | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 1;
const distance = (from: SageLocation, to: SageLocation) => Math.abs(POSITION[to] - POSITION[from]);
const freshCase = (): KnowledgeEmperorLifeCase => ({ status: 'AVAILABLE', observedWeek: null, permission: { OWNER: 'UNASKED', ABILITY: 'UNASKED' }, permissionVersion: 0, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, attempts: [] });
export function createKnowledgeEmperorLifeState(): KnowledgeEmperorLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, site: createSageSiteState(), notes: [], pending: null, energyRecovered: 0,
    cases: { 'knowledge-power': freshCase(), 'power-knowledge': freshCase(), 'withdrawn-consent': freshCase() }, journal: [] };
}
function freshLife(week: number, originals: KnowledgeEmperorOriginals): KnowledgeEmperorLifeState {
  return { ...createKnowledgeEmperorLifeState(), sourceWeek: week, site: structuredClone(originals.site) };
}
export function initializeKnowledgeEmperorLifeState(s: SliceState): void {
  const source = s.knowledgeEmperor.sourceScene?.originals;
  if (!active(s) || !source || !validateSageSiteState(source.site) || !same(source.site, s.sage.encounter.currentSite) || !same(source.workshop, s.scrollProfessor.workshop) ||
    source.site.playerLocation !== 'OUTSIDE' || source.site.iris?.location !== 'OUTSIDE' || source.site.body !== 'SOLID' || source.site.form.active ||
    !same(s.knowledgeEmperor.life, createKnowledgeEmperorLifeState())) throw new Error('须继承原贤者遭遇后的实际院外现场、同一本体与原有限工房，不能改用旧生活现场。');
  s.knowledgeEmperor.life = freshLife(s.week, source);
}
export const getKnowledgeEmperorCurrentSite = (s: SliceState): SageSiteState => s.knowledgeEmperor.encounter.currentSite ??
  (s.knowledgeEmperor.life.sourceWeek === null ? s.knowledgeEmperor.sourceScene?.originals.site ?? s.sage.encounter.currentSite ?? s.knowledgeEmperor.life.site : s.knowledgeEmperor.life.site);
const current = (l: KnowledgeEmperorLifeState) => l.activeCase ? l.cases[l.activeCase].attempts[0] ?? null : null;
const locked = (l: KnowledgeEmperorLifeState) => l.activeCase !== null || l.pending !== null;
const outside = (p: SageSiteState) => p.playerLocation === 'OUTSIDE' && p.iris?.location === 'OUTSIDE' && p.body === 'SOLID' && !p.form.active;
export const hasKnowledgeEmperorLifeLock = (s: SliceState) => !!s.knowledgeEmperor?.life && locked(s.knowledgeEmperor.life);
export const knowledgeEmperorLifeClosed = (s: SliceState) => !hasKnowledgeEmperorLifeLock(s) && outside(s.knowledgeEmperor.life.site) && KNOWLEDGE_EMPEROR_CASE_IDS.every(id => s.knowledgeEmperor.life.cases[id].status === 'RESOLVED');
export function validateKnowledgeEmperorActivityCommand(v: unknown): v is KnowledgeEmperorActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'RECOVER_ENERGY' || v.type === 'REFLECT') return shape(v, ['type']);
  if (!KNOWLEDGE_EMPEROR_CASE_IDS.includes(v.caseId as KnowledgeEmperorCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'permission']) && ['OWNER', 'ABILITY'].includes(String(v.permission));
  return shape(v, ['type', 'caseId']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isKnowledgeEmperorActivityCommand = validateKnowledgeEmperorActivityCommand;
const isPower = (c: KnowledgeEmperorActivityCommand) => c.type === 'KNOWLEDGE_POWER' || c.type === 'POWER_KNOWLEDGE';
const noteFor = (l: KnowledgeEmperorLifeState, id: KnowledgeEmperorCaseId) => l.notes.find(n => n.caseId === id)!;
function pendingUsable(l: KnowledgeEmperorLifeState, id: KnowledgeEmperorCaseId, ability: KnowledgeEmperorLifeAbilityId): boolean {
  const w = l.pending, r = l.cases[id], note = noteFor(l, id);
  return !!w && w.caseId === id && w.abilityId === ability && w.expiresAt > l.site.clockSeconds && w.location === l.site.playerLocation &&
    w.noteId === note?.id && w.substrateId === note.substrateId && w.pageId === l.site.archive.id && w.permissionVersion === r.permissionVersion &&
    r.permission.OWNER === 'GRANTED' && r.permission.ABILITY === 'GRANTED' && note.location === 'PLAYER' && l.site.body === 'SOLID' && !l.site.form.active;
}
function localBlock(l: KnowledgeEmperorLifeState, c: KnowledgeEmperorActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'RECOVER_ENERGY') return !locked(l) && outside(p) && p.playerEnergy < 100 ? null : '须在院外结束接触后付费恢复精力；原物、灵性与旧伤不会恢复。';
  if (c.type === 'REFLECT') return !locked(l) && outside(p) && !l.reflected && KNOWLEDGE_EMPEROR_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先真实收尾并报告三案。';
  if (!('caseId' in c)) return '当前操作缺少实际案例。';
  const id = c.caseId, r = l.cases[id], a = r.attempts[0], index = KNOWLEDGE_EMPEROR_CASE_IDS.indexOf(id);
  if (c.type === 'OBSERVE') return !locked(l) && outside(p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[KNOWLEDGE_EMPEROR_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案并在院外核对同一原人、原页和普通退路。';
  if (c.type === 'CONSENT') return !locked(l) && outside(p) && r.status === 'OBSERVED' && r.permission[c.permission] === 'UNASKED' && p.iris?.willing ? null : '每案须向仍自愿的原成年所有人分别重新取得原物与能力许可；撤回后不能重置。';
  if (c.type === 'PREPARE') return !locked(l) && outside(p) && r.status === 'OBSERVED' && r.attempts.length === 0 && r.consentWeek === week &&
    r.permission.OWNER === 'GRANTED' && (c.method === 'ORDINARY' || r.permission.ABILITY === 'GRANTED') && p.playerEnergy >= 24 && (id !== 'power-knowledge' || p.iris!.energy >= 24) ? null : '须本案新许可、唯一未买纸张与24精力实际往返；每案只准备一次。';
  if (c.type === 'REPORT') return !locked(l) && outside(p) && r.status === 'EXAMINED' && a?.closed && a.returned ? null : '须本人和原主均在院外，同一纸张已亲手归还，现场已经结束。';
  if (!a || a.closed || l.activeCase !== id || !r.contactOpen || a.week !== week) return '须本周同一次正在进行的现场；不能重抽、刷新原物或复用旧许可。';
  if (c.type === 'WITHDRAW_CONSENT') return r.permission[c.permission] === 'GRANTED' ? null : '只能撤回本案仍有效的这一项许可。';
  if (c.type === 'STOP_METHOD') return !a.stopped ? null : '已停止；成本与原物磨损保留。';
  if (c.type === 'ABORT') return null;
  if (c.type === 'RETURN_TO_A') return p.playerLocation === 'B' ? null : '须本人实际从档架沿4米原路返回。';
  if (c.type === 'RETURN_TO_ENTRY') return p.playerLocation === 'A' ? null : '须本人实际从锚位沿6米原路返回。';
  if (c.type === 'LEAVE') return p.playerLocation === 'ENTRY' && (a.verified || a.stopped) ? null : '先完成有限核验或停止，再从门口实际走2米离场。';
  if (c.type === 'RETURN_NOTE') return outside(p) && noteFor(l, id)?.location === 'PLAYER' && (a.verified || a.stopped) ? null : '须本人携同一纸张回到院外原主面前，完成核验或明确停止后亲手归还。';
  if (a.verified) return '本案有限试验已经完成，只能如实停止、沿原路返回和归还。';
  if (a.stopped || r.permission.OWNER !== 'GRANTED' || !p.iris?.willing) return '当前许可已停止或撤回，只能沿普通路返回和归还。';
  const moveTo = c.type === 'APPROACH' ? 'ENTRY' : c.type === 'WALK_TO_A' ? 'A' : c.type === 'WALK_TO_B' ? 'B' : null;
  if (moveTo) {
    const from = c.type === 'APPROACH' ? 'OUTSIDE' : c.type === 'WALK_TO_A' ? 'ENTRY' : 'A';
    const needed = distance(p.playerLocation, moveTo) + distance(moveTo, 'OUTSIDE');
    return p.playerLocation === from && p.playerEnergy >= needed && (!a.ownerAccompanied || p.iris.energy >= needed) ? null : '须逐段实际步行并留下回院外的精力；移动会清除未用窗口。';
  }
  const n = noteFor(l, id);
  if (p.playerLocation !== 'B' || p.body !== 'SOLID' || p.form.active || !n || n.location !== 'PLAYER') return '本人须实体在原档页旁，手持本案同一纸张。';
  if (c.type === 'READ_ORIGINAL') return a.reading === null ? null : '原档页已实际阅读，不能重复领取来源。';
  if (c.type === 'COPY_NOTE') return !!a.reading && !n.copied ? null : '先亲读同一原档页，再把这张已付费纸转为有限笔记。';
  if (!n.copied || !a.reading) return '须先实际阅读并亲手抄录本案同一纸张；缺失内容仍未知。';
  if (c.type === 'WAIT_10') return l.pending && a.waits < 2 ? null : '只可等待当前有限窗口，不能续期或恢复资源。';
  if (c.type === 'APPLY_POWER') return id === 'knowledge-power' && !a.applicationDone && n.charges === 1 && (a.method === 'ORDINARY' || a.knowledgePowerTier !== null) ? null : '本案只可对同一原页进行一次实际试验；失败仍可普通测得基线。';
  if (c.type === 'VERIFY_REACTION') return id === 'power-knowledge' && !a.verified && (a.method === 'ORDINARY' || !!a.forceReceipt && (a.powerKnowledgeTier !== null || !a.forceReceiptValid || a.forceReceipt.at + 20 <= p.clockSeconds)) ? null : '先有实际消耗推力来源及一次检定，或选择普通核验；不能从目标名字推断未知力量。';
  if (r.permission.ABILITY !== 'GRANTED' || a.method !== 'ABILITY') return '须当前独立能力许可；普通方法不施术。';
  if (c.type === 'KNOWLEDGE_POWER') return id !== 'power-knowledge' && a.knowledgePowerTier === null && n.charges === 1 ? null : '同一笔记只尝试知识赋力一次。';
  if (c.type === 'SPEND_FORCE') return id === 'power-knowledge' && !a.forceReceipt && n.charges === 1 ? null : '同一笔记只可实付4灵性施加一次有限推力。';
  if (c.type === 'POWER_KNOWLEDGE') return id === 'power-knowledge' && a.powerKnowledgeTier === null && !!a.forceReceipt && a.forceReceiptValid && a.forceReceipt.permissionVersion === r.permissionVersion &&
    a.forceReceipt.at + 20 > p.clockSeconds && a.forceReceipt.noteId === n.id ? null : '须这张笔记刚刚实际付费消耗的同页推力收据，20秒内只求知一次。';
  return '当前阶段不能进行这一步。';
}
function cost(l: KnowledgeEmperorLifeState, c: KnowledgeEmperorActivityCommand): KnowledgeEmperorLifeCost {
  const target = c.type === 'APPROACH' ? 'ENTRY' : c.type === 'WALK_TO_A' || c.type === 'RETURN_TO_A' ? 'A' : c.type === 'WALK_TO_B' ? 'B' : c.type === 'RETURN_TO_ENTRY' ? 'ENTRY' : c.type === 'LEAVE' ? 'OUTSIDE' : null;
  return { actions: ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT', 'RECOVER_ENERGY'].includes(c.type) ? 1 : 0,
    pennies: c.type === 'PREPARE' ? 20 : c.type === 'RECOVER_ENERGY' ? 15 : 0, spirituality: isPower(c) ? 8 : c.type === 'SPEND_FORCE' ? 4 : 0,
    mind: isPower(c) ? 2 : 0, energy: target ? distance(l.site.playerLocation, target) : c.type === 'ABORT' ? distance(l.site.playerLocation, 'OUTSIDE') : 0,
    forceSpirituality: c.type === 'SPEND_FORCE' ? 4 : 0 };
}
function validBudget(b: KnowledgeEmperorEncounterBudget): boolean {
  return record(b) && shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) &&
    integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 0, 100) && integer(b.spirituality, 0, 120) && b.sequence === 1 &&
    integer(b.acting, 0, 100) && integer(b.pollution, 0, 100) && typeof b.gender === 'string' && record(b.coreStats) && shape(b.coreStats, ['physique', 'perception', 'will', 'knowledge']) &&
    Object.values(b.coreStats).every(n => integer(n, 0, 500)) && record(b.mastery) && Object.values(b.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(b.completedSources) && b.completedSources.every(x => typeof x === 'string') && new Set(b.completedSources).size === b.completedSources.length && Array.isArray(b.injuries) && integer(b.injuryRisk);
}
interface Audit { date: PublicGameDate; revision: number; finance: KnowledgeEmperorFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
function audit(s: SliceState, checked: boolean): Audit {
  return { date: structuredClone(s.date), revision: s.revision, finance: knowledgeEmperorFinanceSnapshot(s), randomCursor: s.random.cursor,
    randomBefore: checked ? s.random.cursor : null, randomAfter: null, checkBase: checked ? s.character.coreStats.knowledge : null, check: null };
}
function transition(initial: KnowledgeEmperorLifeState, c: KnowledgeEmperorActivityCommand, week: number, before: KnowledgeEmperorEncounterBudget, clock: Audit) {
  if (!validateKnowledgeEmperorActivityCommand(c) || !validBudget(before) || localBlock(initial, c, week)) return null;
  const l = structuredClone(initial), p = l.site, paid = cost(l, c), after = structuredClone(before);
  if (before.actions < paid.actions || before.cash < paid.pennies || before.spirituality < paid.spirituality || before.mind < paid.mind || p.playerEnergy < paid.energy) return null;
  after.actions -= paid.actions; after.cash -= paid.pennies; after.spirituality -= paid.spirituality; after.mind -= paid.mind;
  const id = 'caseId' in c ? c.caseId : null, r = id ? l.cases[id] : null;
  let a = id ? r!.attempts[0] ?? null : null;
  const n = id ? l.notes.find(note => note.caseId === id) ?? null : null;
  const source: KnowledgeEmperorLifeSource | null = id && a?.reading && n?.copied && ['KNOWLEDGE_POWER', 'APPLY_POWER', 'SPEND_FORCE', 'POWER_KNOWLEDGE', 'VERIFY_REACTION'].includes(c.type)
    ? { caseId: id, at: p.clockSeconds, pageId: p.archive.id, playerLocation: p.playerLocation, body: 'SOLID', note: structuredClone(n), reading: structuredClone(a.reading), permissionVersion: r!.permissionVersion, forceReceipt: structuredClone(a.forceReceipt), window: structuredClone(l.pending) } : null;
  const receipt: KnowledgeEmperorLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome: clock.check?.tier ?? null,
    before: structuredClone(before), after, paid, elapsedSeconds: 0, energyRecovered: 0, moves: [], siteBefore: structuredClone(p), siteAfter: structuredClone(p), source };
  const clear = (why: KnowledgeEmperorAttempt['windowEnd']) => { if (l.pending && a) a.windowEnd = why; l.pending = null; };
  const tick = (seconds: number) => { p.clockSeconds += seconds; receipt.elapsedSeconds += seconds; if (a && c.type !== 'REPORT') a.elapsedSeconds += seconds; if (l.pending && l.pending.expiresAt <= p.clockSeconds) clear('EXPIRED'); };
  const move = (to: 'ENTRY' | 'A' | 'B' | 'OUTSIDE') => {
    clear('MOVED'); if (a) a.forceReceiptValid = false;
    const from = p.playerLocation, metres = distance(from, to), note = id ? noteFor(l, id) : null;
    p.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres;
    if (note?.location === 'PLAYER') note.travelMetres += metres;
    receipt.moves.push({ actorId: 'PLAYER', from, to, mode: 'WALK', metres, seconds: metres, itemIds: note?.location === 'PLAYER' ? [note.id] : [] });
    if (a) { a.playerTravelMetres += metres; a.energySpent += metres; } tick(metres);
    if (a?.ownerAccompanied) {
      const owner = p.iris!, ownerFrom = owner.location, ownerMetres = distance(ownerFrom, to);
      owner.location = to; owner.travelMetres += ownerMetres; owner.energy -= ownerMetres;
      if (p.record?.location === 'OWNER') p.record.travelMetres += ownerMetres;
      const movement: SageMovement = { actorId: 'PM3-IRIS', from: ownerFrom, to, mode: 'WALK', metres: ownerMetres, seconds: ownerMetres, itemIds: p.record?.location === 'OWNER' ? [p.record.id] : [] };
      p.actorMoves.push(movement); receipt.moves.push(structuredClone(movement)); a.ownerTravelMetres += ownerMetres; tick(ownerMetres);
    }
  };
  const close = () => {
    const note = noteFor(l, id!); note.status = 'RETURNED'; note.location = 'OWNER'; a!.returned = true; a!.closed = true;
    a!.result = a!.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r!.result = a!.result; r!.returned = true; r!.contactOpen = false; r!.status = 'EXAMINED';
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED';
    if (p.iris!.consent !== 'WITHDRAWN') p.iris!.consent = 'CLOSED'; clear('STOPPED'); tick(2); a!.siteAtClose = structuredClone(p); l.activeCase = null;
  };
  switch (c.type) {
    case 'OBSERVE': r!.status = 'OBSERVED'; r!.observedWeek = week; tick(3); break;
    case 'CONSENT': r!.permission[c.permission] = 'GRANTED'; r!.permissionVersion++; r!.consentWeek = week; if (c.permission === 'OWNER') p.iris!.consent = 'GRANTED'; tick(2); break;
    case 'PREPARE': {
      const index = KNOWLEDGE_EMPEROR_CASE_IDS.indexOf(c.caseId) + 1, substrateId = `KE1-PAPER-${index}`;
      a = { week, method: c.method, closed: false, stopped: false, returned: false, withdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0, ownerTravelMetres: 0,
        energySpent: 0, spiritualitySpent: 0, checkSpiritualitySpent: 0, forceSpiritualitySpent: 0, mindSpent: 0, penniesSpent: 20, noteSubstrateId: substrateId,
        reading: null, forceReceipt: null, forceReceiptValid: false, knowledgePowerTier: null, powerKnowledgeTier: null, applicationDone: false, verified: false,
        baselineStabilization: 0, measuredStabilization: 0, observedReaction: null, appliedAbilityIds: [], waits: 0, ownerAccompanied: c.caseId === 'power-knowledge',
        windowEnd: 'NONE', result: 'NONE', siteAtStart: structuredClone(p), siteAtClose: null };
      r!.attempts.push(a); r!.method = c.method; r!.status = 'ACTIVE'; r!.contactOpen = true; l.activeCase = c.caseId;
      l.notes.push({ id: substrateId, substrateId, caseId: c.caseId, ownerId: 'PLAYER', quantity: 1, status: 'PLAYER', location: 'PLAYER', copied: false,
        paidPennies: 20, boughtWeek: week, charges: 1, wear: 0, travelMetres: 0, content: [], reading: null }); tick(2); break;
    }
    case 'RECOVER_ENERGY': receipt.energyRecovered = Math.min(20, 100 - p.playerEnergy); p.playerEnergy += receipt.energyRecovered; l.energyRecovered += receipt.energyRecovered; tick(60); break;
    case 'APPROACH': move('ENTRY'); break;
    case 'WALK_TO_A': move('A'); break;
    case 'WALK_TO_B': move('B'); break;
    case 'RETURN_TO_A': move('A'); break;
    case 'RETURN_TO_ENTRY': move('ENTRY'); break;
    case 'LEAVE': move('OUTSIDE'); break;
    case 'READ_ORIGINAL': tick(6); p.archive.readings++; a!.reading = { pageId: p.archive.id, location: 'B', at: p.clockSeconds, readingNumber: p.archive.readings, permissionVersion: r!.permissionVersion, facts: [...FACTS] }; break;
    case 'COPY_NOTE': tick(4); n!.id = `KE1-NOTE-${KNOWLEDGE_EMPEROR_CASE_IDS.indexOf(id!) + 1}`; n!.copied = true; n!.content = [...FACTS]; n!.reading = structuredClone(a!.reading); break;
    case 'KNOWLEDGE_POWER': case 'POWER_KNOWLEDGE': {
      const tier = clock.check?.tier ?? null;
      if (!tier || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(tier)) return null;
      a!.spiritualitySpent += 8; a!.checkSpiritualitySpent += 8; a!.mindSpent += 2; tick(1);
      if (c.type === 'KNOWLEDGE_POWER') a!.knowledgePowerTier = tier; else a!.powerKnowledgeTier = tier;
      a!.windowEnd = success(tier) ? 'ACTIVE' : 'FAILED';
      l.pending = success(tier) ? { abilityId: c.type === 'KNOWLEDGE_POWER' ? KP : PK, caseId: id!, noteId: n!.id, substrateId: n!.substrateId,
        pageId: p.archive.id, location: 'B', permissionVersion: r!.permissionVersion, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 20, forceReceiptId: c.type === 'POWER_KNOWLEDGE' ? a!.forceReceipt!.id : null } : null;
      break;
    }
    case 'APPLY_POWER': {
      const applied = pendingUsable(l, id!, KP); n!.charges = 0; n!.wear++; a!.applicationDone = true; a!.verified = true; a!.baselineStabilization = 3; a!.measuredStabilization = applied ? 6 : 3;
      if (applied) a!.appliedAbilityIds.push(KP); clear(applied ? 'APPLIED' : a!.windowEnd); p.archive.verifications++; tick(1); break;
    }
    case 'SPEND_FORCE':
      n!.charges = 0; n!.wear++; a!.spiritualitySpent += 4; a!.forceSpiritualitySpent += 4; a!.forceReceiptValid = true; tick(1);
      a!.forceReceipt = { id: 'KE1-FORCE-2', caseId: 'power-knowledge', noteId: n!.id, substrateId: n!.substrateId, pageId: p.archive.id, location: 'B', at: p.clockSeconds,
        elapsedSeconds: 1, spiritualitySpent: 4, force: 6, noteChargeSpent: 1, noteWear: n!.wear, paperEdgeMovedMm: 1, permissionVersion: r!.permissionVersion }; break;
    case 'VERIFY_REACTION': {
      const applied = !!a!.forceReceipt && pendingUsable(l, id!, PK) && l.pending!.forceReceiptId === a!.forceReceipt!.id;
      a!.verified = true; a!.observedReaction = a!.forceReceipt ? REACTION : '亲眼核对原档页与夹持位置；没有施加超凡推力，缺失正文仍未知。';
      if (!a!.forceReceipt) n!.charges = 0; n!.wear++; if (applied) a!.appliedAbilityIds.push(PK); clear(applied ? 'APPLIED' : a!.windowEnd); p.archive.verifications++; tick(2); break;
    }
    case 'WAIT_10': a!.waits++; tick(10); break;
    case 'WITHDRAW_CONSENT': r!.permission[c.permission] = 'WITHDRAWN'; r!.permissionVersion++; a!.withdrawn = true; a!.stopped = true; a!.forceReceiptValid = false; if (c.permission === 'OWNER') p.iris!.consent = 'WITHDRAWN'; clear('WITHDRAWN'); tick(1); break;
    case 'STOP_METHOD': a!.stopped = true; a!.forceReceiptValid = false; clear('STOPPED'); tick(1); break;
    case 'ABORT':
      a!.stopped = true; clear('STOPPED'); tick(1);
      if (p.playerLocation === 'B') move('A'); if (p.playerLocation === 'A') move('ENTRY'); if (p.playerLocation === 'ENTRY') move('OUTSIDE'); close(); break;
    case 'RETURN_NOTE': close(); break;
    case 'REPORT': {
      const marker = `knowledge-emperor-case:${id}`; if (after.completedSources.includes(marker)) return null;
      r!.status = 'RESOLVED'; after.acting = Math.min(100, after.acting + 25); after.completedSources.push(marker);
      for (const ability of a!.appliedAbilityIds) after.mastery[ability] = Math.min(500, (after.mastery[ability] ?? 0) + 8); tick(4); break;
    }
    case 'REFLECT': if (after.completedSources.includes('knowledge-emperor-reflection')) return null; l.reflected = true; after.acting = Math.min(100, after.acting + 25); after.completedSources.push('knowledge-emperor-reflection'); tick(4); break;
  }
  receipt.siteAfter = structuredClone(p);
  if (!validBudget(after)) return null;
  return { life: l, receipt };
}
/** Structural checks for the continuing site. Exact action replay, rather than
 * the obsolete S2 energy/travel sum, proves every recovery and movement. */
export function validateKnowledgeEmperorCurrentSite(v: unknown, originals: KnowledgeEmperorOriginals): v is SageSiteState {
  try {
    const original = originals.site;
    if (!validateSageSiteState(original) || !record(v) || !shape(v, Object.keys(original))) return false;
    const p = v as unknown as SageSiteState;
    if (p.siteId !== original.siteId || p.introducedWeek !== original.introducedWeek || !same(p.introducedDate, original.introducedDate) || !same(p.source, original.source) ||
      !same(p.materials, original.materials) || !same(p.conduit, original.conduit) || !integer(p.clockSeconds, original.clockSeconds) || !integer(p.playerTravelMetres, original.playerTravelMetres) ||
      !integer(p.playerEnergy, 0, 100) || !integer(p.formEnergySpent, original.formEnergySpent) || !integer(p.assimilationExposure, original.assimilationExposure) || !Object.hasOwn(POSITION, p.playerLocation)) return false;
    const iris = p.iris, old = original.iris;
    if (!iris || !old || !shape(iris, Object.keys(old)) || !integer(iris.energy, 0, 100) || !integer(iris.travelMetres, old.travelMetres) || iris.energy + iris.travelMetres !== old.energy + old.travelMetres ||
      !['ENTRY', 'A', 'B', 'OUTSIDE'].includes(iris.location) || !['UNASKED', 'GRANTED', 'WITHDRAWN', 'CLOSED'].includes(iris.consent) || !same(iris, { ...old, location: iris.location, energy: iris.energy, travelMetres: iris.travelMetres, consent: iris.consent })) return false;
    if (!Array.isArray(p.actorMoves) || !same(p.actorMoves.slice(0, original.actorMoves.length), original.actorMoves)) return false;
    let at = old.location, travel = old.travelMetres, ownerSeconds = 0;
    for (const m of p.actorMoves.slice(original.actorMoves.length)) {
      if (!record(m) || !shape(m, ['actorId', 'from', 'to', 'mode', 'metres', 'seconds', 'itemIds']) || m.actorId !== old.id || m.from !== at || m.to === 'YARD' || m.to === at || m.mode !== 'WALK' ||
        !['ENTRY', 'A', 'B', 'OUTSIDE'].includes(m.to) || m.metres !== distance(at, m.to) || m.seconds !== m.metres || !same(m.itemIds, ['PM3-BOUNDARY-RECORD'])) return false;
      at = m.to; travel += m.metres; ownerSeconds += m.seconds;
    }
    if (iris.location !== at || iris.travelMetres !== travel || p.clockSeconds < original.clockSeconds + ownerSeconds || !original.record ||
      !same(p.record, { ...original.record, travelMetres: original.record.travelMetres + iris.travelMetres - old.travelMetres })) return false;
    if (!integer(p.archive?.readings, original.archive.readings, original.archive.readings + 3) || !integer(p.archive?.verifications, original.archive.verifications, original.archive.verifications + 2) ||
      !same(p.archive, { ...original.archive, readings: p.archive.readings, verifications: p.archive.verifications })) return false;
    if (!record(p.form) || !shape(p.form, ['active', 'expiresAt', 'anchorId']) || !['SOLID', 'INFORMATION'].includes(p.body)) return false;
    return p.form.active ? p.body === 'INFORMATION' && integer(p.form.expiresAt, p.clockSeconds + 1, p.clockSeconds + 20) : p.body === 'SOLID' && p.form.expiresAt === null && p.form.anchorId === null;
  } catch { return false; }
}
function lifeBoundary(e: KnowledgeEmperorLifeReceipt, isLocked: boolean) {
  const b = structuredClone(e.after), finance = structuredClone(e.finance);
  if (b.actions > 0 || isLocked) return { budget: b, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: b.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE', receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...b, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 },
    finance: knowledgeEmperorFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date,
    pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
export function knowledgeEmperorCompletedLifeBudgetMatches(s: SliceState, e: KnowledgeEmperorLifeReceipt, isLocked = hasKnowledgeEmperorLifeLock(s)): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(knowledgeEmperorEncounterBudget(s), expected.budget) || !same(knowledgeEmperorFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null ||
    (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate) => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(s: SliceState): KnowledgeEmperorLifeState | null {
  const l = s.knowledgeEmperor.life, source = s.knowledgeEmperor.sourceScene;
  if (!source || l.sourceWeek === null) return null;
  let model = freshLife(l.sourceWeek, source.originals), previous: KnowledgeEmperorLifeReceipt | null = null, lastWeek = l.sourceWeek, cursor = source.random.cursor;
  for (const e of l.journal) {
    if (!record(e) || !shape(e, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'paid', 'elapsedSeconds', 'energyRecovered', 'moves', 'siteBefore', 'siteAfter', 'source']) ||
      !validateKnowledgeEmperorActivityCommand(e.command) || !integer(e.week, lastWeek, s.week) || !isValidGameDate(e.date) || !dateMatches(e.date, s.week - e.week, s.date) ||
      !integer(e.revision, previous ? previous.revision + 1 : source.revision, s.revision) || !integer(e.randomCursor, cursor, s.random.cursor) || !validateKnowledgeEmperorFinanceSnapshot(e.finance, e.week) || !validBudget(e.before)) return null;
    if (locked(model) && (!previous || e.week !== lastWeek || e.revision !== previous.revision + 1 || !same(e.before, previous.after) || !same(e.finance, previous.finance) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (previous && e.revision === previous.revision + 1) {
      const expected = lifeBoundary(previous, locked(model));
      if (e.week !== expected.week || !same(e.date, expected.date) || !same(e.before, expected.budget) || !same(e.finance, expected.finance) || expected.eventId !== null || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
    }
    if (isPower(e.command)) {
      if (e.checkBase !== e.before.coreStats.knowledge || e.checkBase !== s.character.coreStats.knowledge || !record(e.check) || e.randomBefore !== e.randomCursor || e.randomAfter !== e.randomCursor + 1 || !integer(e.randomAfter, cursor, s.random.cursor)) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, e.randomCursor), expected = resolveNormalCheck({ ability: 'knowledge', baseAbility: e.checkBase, difficulty: 18, modifiers: [], roll: random.nextInt(1, 100) });
      if (!same(e.check, expected) || e.outcome !== expected.tier || random.cursor !== e.randomAfter) return null;
    } else if (e.randomBefore !== null || e.randomAfter !== null || e.checkBase !== null || e.check !== null || e.outcome !== null) return null;
    const next = transition(model, e.command, e.week, e.before, { date: e.date, revision: e.revision, finance: e.finance, randomCursor: e.randomCursor, randomBefore: e.randomBefore, randomAfter: e.randomAfter, checkBase: e.checkBase, check: e.check });
    if (!next || !same(next.receipt, e) || !validateKnowledgeEmperorCurrentSite(next.life.site, source.originals)) return null;
    model = next.life; model.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; cursor = e.randomAfter ?? e.randomCursor;
  }
  return model;
}
export function knowledgeEmperorLifeMasteryGains(s: SliceState): Record<KnowledgeEmperorLifeAbilityId, number> {
  const gains = { [KP]: 0, [PK]: 0 } as Record<KnowledgeEmperorLifeAbilityId, number>;
  for (const id of KNOWLEDGE_EMPEROR_CASE_IDS) { const r = s.knowledgeEmperor.life.cases[id]; if (r.status === 'RESOLVED') for (const ability of r.attempts[0]!.appliedAbilityIds) gains[ability] += 8; }
  return gains;
}
export function validateKnowledgeEmperorLifeState(s: SliceState): boolean {
  try {
    const l = s.knowledgeEmperor?.life, source = s.knowledgeEmperor?.sourceScene;
    if (!record(l) || !shape(l, Object.keys(createKnowledgeEmperorLifeState())) || !record(l.cases) || !shape(l.cases, KNOWLEDGE_EMPEROR_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 250) return false;
    if (s.knowledgeEmperor.promotionWeek === null) return same(l, createKnowledgeEmperorLifeState());
    if (!source || l.sourceWeek !== s.knowledgeEmperor.promotionWeek || !same(source.originals.site, s.sage.encounter.currentSite) || !same(source.originals.workshop, s.scrollProfessor.workshop) ||
      !validateSageSiteState(source.originals.site) || !outside(source.originals.site) || !validateKnowledgeEmperorCurrentSite(l.site, source.originals)) return false;
    const replay = replayLife(s); if (!replay || !same(l, replay)) return false;
    const gains = knowledgeEmperorLifeMasteryGains(s); let acting = l.reflected ? 25 : 0;
    for (const id of KNOWLEDGE_EMPEROR_CASE_IDS) {
      const resolved = l.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `knowledge-emperor-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'knowledge-emperor-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting ||
      (s.progression.mastery[KP] ?? 0) < gains[KP] || (s.progression.mastery[PK] ?? 0) < gains[PK]) return false;
    const last = l.journal.at(-1), encounter = s.knowledgeEmperor.encounter;
    if (locked(l) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.knowledgeEmperor.preparedWeek !== null ||
      encounter.status !== 'AVAILABLE' || encounter.preparation !== null || !last || last.week !== s.week || !same(knowledgeEmperorEncounterBudget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !knowledgeEmperorCompletedLifeBudgetMatches(s, last, locked(l))) return false;
    return true;
  } catch { return false; }
}
export const validateKnowledgeEmperorLife = validateKnowledgeEmperorLifeState;
export function blockKnowledgeEmperorLife(s: SliceState, c: KnowledgeEmperorActivityCommand): string | null {
  if (!validateKnowledgeEmperorActivityCommand(c)) return '有限知识实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已实际晋升知识皇帝。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.knowledgeEmperor.preparedWeek !== null) return '先处理当前事件、战斗或晋升准备，并回到贝克兰德原档区。';
  if (s.knowledgeEmperor.encounter.status !== 'AVAILABLE' || s.knowledgeEmperor.encounter.preparation !== null) return '现场已经交给后续独立遭遇；旧生活现场只作历史。';
  if (!validateKnowledgeEmperorLifeState(s)) return '原人、原页、同一纸张、实际成本或历史收据不一致。';
  const reason = localBlock(s.knowledgeEmperor.life, c, s.week); if (reason) return reason;
  const paid = cost(s.knowledgeEmperor.life, c);
  if (s.actionsRemaining < paid.actions || s.cash < paid.pennies || s.spirituality < paid.spirituality || s.mind < paid.mind || s.knowledgeEmperor.life.site.playerEnergy < paid.energy) return '本次行动、费用、灵性、精神或实际步行精力不足；普通收尾不会补资源。';
  return null;
}
export function applyKnowledgeEmperorLifeCommand(s: SliceState, c: KnowledgeEmperorActivityCommand, ctx: SeerContext): void {
  const reason = blockKnowledgeEmperorLife(s, c); if (reason) throw new Error(reason);
  const clock = audit(s, isPower(c)), before = knowledgeEmperorEncounterBudget(s);
  if (isPower(c)) { clock.check = structuredClone(ctx.check('knowledge', 18)); clock.randomAfter = s.random.cursor; }
  const next = transition(s.knowledgeEmperor.life, c, s.week, before, clock); if (!next) throw new Error('有限现场转移失败。');
  s.knowledgeEmperor.life = next.life; s.knowledgeEmperor.life.journal.push(next.receipt);
  const after = next.receipt.after; s.cash = after.cash; s.actionsRemaining = after.actions; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality;
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  ctx.note(`原档案有限实践：${LABELS[c.type]}`, `${clock.check ? `本次知识18检定${TIER_LABELS[clock.check.tier]}；已付8灵性、2精神，不返还。` : ''}本人在${LOCATION_LABELS[next.life.site.playerLocation]}，原档区精力${next.life.site.playerEnergy}，实际时钟${next.life.site.clockSeconds}秒。${c.type === 'SPEND_FORCE' ? '同一纸张已消耗唯一充能，实付4灵性，推力6使原页边缘移动1毫米；只有这一次实际来源。' : c.type === 'COPY_NOTE' ? '亲读后把同一已购纸张转为笔记；只抄录确知格位与缺文未知，不复制或搬走原档页。' : c.type === 'APPLY_POWER' ? '同一原页有限试验已消耗一次充能；成功窗口只把本次实测稳定值从3提高至6。' : c.type === 'VERIFY_REACTION' ? '只记录实际可见的移动与夹持阻力；不会补充力量、恢复充能或读出缺文。' : c.type === 'WITHDRAW_CONSENT' ? '本案指定许可已真实撤回，未用窗口立即清除；后续只能普通返回归还。' : '原人、原页、付费纸张和实际成本持续保留。'}`);
}
export const applyKnowledgeEmperorActivity = applyKnowledgeEmperorLifeCommand;
export const applyKnowledgeEmperorLife = applyKnowledgeEmperorLifeCommand;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATION_LABELS: Record<SageLocation, string> = { OUTSIDE: '院外', ENTRY: '原入口', A: '六米锚位', B: '十米原档架', YARD: '独立后院' };
const LABELS: Record<KnowledgeEmperorActivityCommand['type'], string> = {
  OBSERVE: '在院外核对原人原物', PREPARE: '购买本案唯一纸张', CONSENT: '重新询问本案许可', WITHDRAW_CONSENT: '听取原主撤回许可', RECOVER_ENERGY: '院外付费休整60秒',
  APPROACH: '实际走2米到入口', WALK_TO_A: '沿原路走6米到锚位', WALK_TO_B: '沿原路走4米到档架', READ_ORIGINAL: '亲读同一原档页', COPY_NOTE: '在同一纸张抄录已知内容',
  KNOWLEDGE_POWER: '知识赋力：准备一次有限应用', APPLY_POWER: '对同一原页实测稳定值', SPEND_FORCE: '实付4灵性施加一次推力', POWER_KNOWLEDGE: '循力求知：追溯刚才实际推力', VERIFY_REACTION: '核验实际移动与阻力',
  WAIT_10: '实际等待10秒', STOP_METHOD: '停止本次方法', RETURN_TO_A: '沿原路走4米返回锚位', RETURN_TO_ENTRY: '沿原路走6米回入口', LEAVE: '实际走2米离场', RETURN_NOTE: '在院外亲手交还同一纸张', ABORT: '停止并沿普通路实际归还', REPORT: '报告已真实收尾的结果', REFLECT: '反思三案的有限知识与代价',
};
const CASES: { id: KnowledgeEmperorCaseId; title: string; story: string }[] = [
  { id: 'knowledge-power', title: '亲读的知识用于一次实测', story: '新纸只抄下原页确有内容。付费知识赋力成功后开放20秒单次窗口；对同一原页实际应用，基线稳定值3才可能提高至6。失败、到期或移动都不退款。' },
  { id: 'power-knowledge', title: '从已付出的力量追溯有限反应', story: '艾瑞丝沿同一普通道路陪同行走并返回。先消耗这张笔记唯一充能与4灵性，推力6使原页边缘实际移动1毫米，再付8灵性、2精神尝试求知；只能核验已发生的移动与阻力。' },
  { id: 'withdrawn-consent', title: '原主说停止之后照常归还', story: '重新许可后亲读并抄第三张纸，可先尝试知识赋力，再让原主真实撤回许可。未用窗口立即失效，已付成本保留；普通返回归还，不增加没有应用的掌握。' },
];
export function knowledgeEmperorLifeActions(s: SliceState): KnowledgeEmperorLifeAction[] {
  if (!active(s) || s.knowledgeEmperor.encounter.status !== 'AVAILABLE' || s.knowledgeEmperor.encounter.preparation !== null) return [];
  const l = s.knowledgeEmperor.life, id = l.activeCase ?? KNOWLEDGE_EMPEROR_CASE_IDS.find(key => l.cases[key].status !== 'RESOLVED'), out: KnowledgeEmperorLifeAction[] = [];
  const add = (command: KnowledgeEmperorActivityCommand) => {
    const reason = blockKnowledgeEmperorLife(s, command), paid = cost(l, command), cleanup = ['STOP_METHOD', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'LEAVE', 'RETURN_NOTE', 'ABORT', 'WITHDRAW_CONSENT'].includes(command.type);
    out.push({ id: `KE1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'permission' in command ? `:${command.permission}` : command.type === 'PREPARE' ? `:${command.method}` : ''}`,
      label: LABELS[command.type] + ('permission' in command ? command.permission === 'OWNER' ? '（原物）' : '（能力）' : command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : ''),
      cost: [`${paid.actions}行动`, ...(paid.pennies ? [`${paid.pennies}便士`] : []), ...(paid.spirituality ? [`${paid.spirituality}灵性`] : []), ...(paid.mind ? [`${paid.mind}精神`] : []), ...(paid.energy ? [`${paid.energy}精力`] : []), ...(isPower(command) ? ['知识18', '1秒', '成功窗口20秒'] : [])].join(' · '),
      enabled: reason === null, reason, command, cleanup });
  };
  if (id && ['AVAILABLE', 'OBSERVED'].includes(l.cases[id].status) && !locked(l) && outside(l.site) && l.site.playerEnergy < 24) add({ type: 'RECOVER_ENERGY' });
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id], a = r.attempts[0];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') {
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'UNASKED') add({ type: 'CONSENT', caseId: id, permission });
    add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' });
  }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (a && r.contactOpen) {
    const preferred = id === 'withdrawn-consent' && l.site.playerLocation === 'B' && noteFor(l, id)?.copied && !a.withdrawn && (a.method === 'ORDINARY' || a.knowledgePowerTier !== null);
    if (preferred) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission: r.permission.ABILITY === 'GRANTED' ? 'ABILITY' : 'OWNER' });
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'ABORT'].includes(type) && localBlock(l, { type, caseId: id }, s.week) === null) add({ type, caseId: id });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'GRANTED' && !(preferred && permission === (r.permission.ABILITY === 'GRANTED' ? 'ABILITY' : 'OWNER'))) add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  const preferred = out.find(a => a.enabled && !['ABORT', 'STOP_METHOD', 'WAIT_10', 'WITHDRAW_CONSENT', 'RETURN_TO_A', 'RETURN_TO_ENTRY'].includes(a.command.type)) ?? out.find(a => a.enabled);
  if (preferred) preferred.preferredAction = true;
  return out;
}
export function projectKnowledgeEmperorLife(s: SliceState): KnowledgeEmperorLifeProjection {
  const l = s.knowledgeEmperor.life, site = getKnowledgeEmperorCurrentSite(s), actions = knowledgeEmperorLifeActions(s);
  return { title: '原档案的有限知识实践', story: '继承贤者遭遇后真实院外状态。每案新许可、新购一张有限纸，亲读原页才可手抄；两种能力都须真实来源、实付代价和实际应用。旧档灾难、原棍与耗尽的旧耗材仍保留原结局。',
    source: '同一原档区、原49岁艾瑞丝、原记录、原档页与四米导管；历史工房不会补充。', environment: '院外至入口2米，入口至锚位6米，锚位至原档架4米。每米消耗1精力并经过1秒；第二案原主也各自实际行走和支付精力。院外休整15便士、1行动、60秒恢复20精力，上限100。',
    activeCase: l.activeCase, inside: hasKnowledgeEmperorLifeLock(s), insideCase: hasKnowledgeEmperorLifeLock(s), reflected: l.reflected, preferredActionId: actions.find(a => a.preferredAction)?.id ?? actions.find(a => a.enabled)?.id ?? null,
    site: publicSageSite(site), clockSeconds: site.clockSeconds, playerLocation: site.playerLocation, playerTravelMetres: site.playerTravelMetres, pending: l.pending ? publicKnowledgeEmperorWindow(l.pending) : null, pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - site.clockSeconds) : 0,
    currentAttempt: current(l) ? publicKnowledgeEmperorAttempt(current(l)!) : null, notes: l.notes.map(publicKnowledgeEmperorNote),
    cases: CASES.map(info => { const r = l.cases[info.id], a = r.attempts[0]; return { ...info, observations: a ? [
      `实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性（检定${a.checkSpiritualitySpent}，实际推力${a.forceSpiritualitySpent}）、${a.mindSpent}精神；本人移动${a.playerTravelMetres}米，原主移动${a.ownerTravelMetres}米，耗时${a.elapsedSeconds}秒。`,
      ...(a.reading?.facts ?? []), ...(a.applicationDone ? [`同一原页实际基线${a.baselineStabilization}，本次稳定值${a.measuredStabilization}。`] : []), ...(a.observedReaction ? [a.observedReaction] : []), ...(a.withdrawn ? ['本案许可已撤回，未用窗口不可恢复。'] : []),
    ] : [], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限能力已实际作用并记录。' : '普通核验或明确停止；没有未应用的掌握奖励。', permission: publicPryerFields(r.permission, ['OWNER', 'ABILITY']), permissionVersion: r.permissionVersion, contactOpen: r.contactOpen, returned: r.returned, attempts: r.attempts.map(publicKnowledgeEmperorAttempt) }; }),
    ledger: l.journal.map(publicKnowledgeEmperorLifeReceipt), actions };
}

const PUBLIC_MASTERY_IDS = [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS, ...MYSTIC_ABILITY_IDS, ...PROPHECY_MASTER_ABILITY_IDS, ...SAGE_ABILITY_IDS, ...KNOWLEDGE_EMPEROR_ABILITY_IDS];
export const publicKnowledgeEmperorMastery = (m: Record<string, number>) => Object.fromEntries(PUBLIC_MASTERY_IDS.filter(id => Object.hasOwn(m, id)).map(id => [id, m[id]!]));
export const publicKnowledgeEmperorBudget = (b: KnowledgeEmperorEncounterBudget): KnowledgeEmperorEncounterBudget => ({
  ...publicPryerFields(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'injuryRisk']),
  coreStats: publicPryerFields(b.coreStats, ['physique', 'perception', 'will', 'knowledge']), mastery: publicKnowledgeEmperorMastery(b.mastery),
  completedSources: [...b.completedSources], injuries: b.injuries.map(publicPryerInjury),
});
export const publicKnowledgeEmperorReading = (r: KnowledgeEmperorReading): KnowledgeEmperorReading => ({
  ...publicPryerFields(r, ['pageId', 'location', 'at', 'readingNumber', 'permissionVersion']), facts: [...r.facts],
});
export const publicKnowledgeEmperorLifeForceReceipt = (r: KnowledgeEmperorForceReceipt): KnowledgeEmperorForceReceipt => publicPryerFields(r,
  ['id', 'caseId', 'noteId', 'substrateId', 'pageId', 'location', 'at', 'elapsedSeconds', 'spiritualitySpent', 'force', 'noteChargeSpent', 'noteWear', 'paperEdgeMovedMm', 'permissionVersion']);
export const publicKnowledgeEmperorWindow = (w: KnowledgeEmperorLifeWindow): KnowledgeEmperorLifeWindow => publicPryerFields(w,
  ['abilityId', 'caseId', 'noteId', 'substrateId', 'pageId', 'location', 'permissionVersion', 'createdAt', 'expiresAt', 'forceReceiptId']);
export const publicKnowledgeEmperorNote = (n: KnowledgeEmperorNote): KnowledgeEmperorNote => ({
  ...publicPryerFields(n, ['id', 'substrateId', 'caseId', 'ownerId', 'quantity', 'status', 'location', 'copied', 'paidPennies', 'boughtWeek', 'charges', 'wear', 'travelMetres']),
  content: [...n.content], reading: n.reading ? publicKnowledgeEmperorReading(n.reading) : null,
});
export function publicKnowledgeEmperorAttempt(a: KnowledgeEmperorAttempt) { return {
  ...publicPryerFields(a, ['week', 'method', 'closed', 'stopped', 'returned', 'withdrawn', 'elapsedSeconds', 'playerTravelMetres', 'ownerTravelMetres', 'energySpent', 'spiritualitySpent', 'checkSpiritualitySpent', 'forceSpiritualitySpent', 'mindSpent', 'penniesSpent', 'noteSubstrateId', 'forceReceiptValid', 'knowledgePowerTier', 'powerKnowledgeTier', 'applicationDone', 'verified', 'baselineStabilization', 'measuredStabilization', 'observedReaction', 'waits', 'ownerAccompanied', 'windowEnd', 'result']),
  reading: a.reading ? publicKnowledgeEmperorReading(a.reading) : null,
  forceReceipt: a.forceReceipt ? publicKnowledgeEmperorLifeForceReceipt(a.forceReceipt) : null,
  appliedAbilityIds: [...a.appliedAbilityIds], siteAtStart: publicSageSite(a.siteAtStart), siteAtClose: a.siteAtClose ? publicSageSite(a.siteAtClose) : null,
}; }
export type KnowledgeEmperorPublicAttempt = ReturnType<typeof publicKnowledgeEmperorAttempt>;
function publicKnowledgeEmperorLifeCommand(c: KnowledgeEmperorActivityCommand): KnowledgeEmperorActivityCommand {
  if (c.type === 'PREPARE') return { type: c.type, caseId: c.caseId, method: c.method };
  if (c.type === 'CONSENT' || c.type === 'WITHDRAW_CONSENT') return { type: c.type, caseId: c.caseId, permission: c.permission };
  if (c.type === 'RECOVER_ENERGY' || c.type === 'REFLECT') return { type: c.type };
  return { type: c.type, caseId: c.caseId };
}
export function publicKnowledgeEmperorLifeReceipt(r: KnowledgeEmperorLifeReceipt) { return {
  ...publicPryerFields(r, ['week', 'revision', 'checkBase', 'outcome', 'elapsedSeconds', 'energyRecovered']),
  date: publicPryerDate(r.date), command: publicKnowledgeEmperorLifeCommand(r.command), check: publicPryerCheck(r.check),
  before: publicKnowledgeEmperorBudget(r.before), after: publicKnowledgeEmperorBudget(r.after),
  paid: publicPryerFields(r.paid, ['actions', 'pennies', 'spirituality', 'mind', 'energy', 'forceSpirituality']),
  moves: r.moves.map(publicSageMovement), siteBefore: publicSageSite(r.siteBefore), siteAfter: publicSageSite(r.siteAfter),
}; }
export type KnowledgeEmperorPublicLifeReceipt = ReturnType<typeof publicKnowledgeEmperorLifeReceipt>;
