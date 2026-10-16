import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { createElderLifeState, type ElderOperationState } from '../elder/life.js';
import { createThreeHeadedTemplarLifeState, THREE_HEADED_TEMPLAR_SPIRIT_IDS, type ThreeHeadedTemplarSpiritId, type ThreeHeadedTemplarSpiritMethod, type ThreeHeadedTemplarSpiritState } from '../three-headed-templar/life.js';
import type { DarkAngelOriginals, DarkAngelSite } from './types.js';
export type { DarkAngelOriginals, DarkAngelSite } from './types.js';
import { darkAngelEncounterBudget, darkAngelFinanceSnapshot, validateDarkAngelFinanceSnapshot, type DarkAngelEncounterBudget, type DarkAngelFinanceSnapshot } from './encounter.js';

export const DARK_ANGEL_CASE_IDS = ['guided-reading', 'guarded-pulse', 'withdrawn-guidance'] as const;
export type DarkAngelCaseId = typeof DARK_ANGEL_CASE_IDS[number];
export type DarkAngelLifeAbilityId = 'hanged-man.s1.single-spirit-guidance' | 'hanged-man.s1.single-spirit-shelter';
type Method = 'ABILITY' | 'ORDINARY';
type Permission = 'OWNER' | 'ABILITY';
type Consent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'APPROACH', 'WALK_TO_A', 'WALK_TO_B', 'TAKE_CARD', 'READ_ORIGINAL', 'PERFORM_OPERATION', 'WAIT_10', 'STOP_METHOD', 'RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_STRIP', 'LEAVE', 'ABORT', 'REPORT', 'OPEN_LIGHT', 'CLOSE_LIGHT'] as const;
export type DarkAngelActivityCommand =
  | { type: typeof STEPS[number]; caseId: DarkAngelCaseId }
  | { type: 'PREPARE'; caseId: DarkAngelCaseId; method: Method }
  | { type: 'CONSENT' | 'WITHDRAW_CONSENT'; caseId: DarkAngelCaseId; permission: Permission }
  | { type: 'GUIDANCE' | 'SHELTER'; caseId: DarkAngelCaseId; spiritId: ThreeHeadedTemplarSpiritId }
  | { type: 'REFLECT' };
export interface DarkAngelSealStrip {
  id: string; caseId: DarkAngelCaseId; ownerId: 'PLAYER'; quantity: 1; status: 'PLAYER' | 'RETURNED'; location: 'PLAYER' | 'OWNER';
  charges: 0 | 1; wear: number; paidPennies: 20; boughtWeek: number; travelMetres: number;
}
export interface DarkAngelLifeWindow {
  abilityId: DarkAngelLifeAbilityId; caseId: DarkAngelCaseId; stripId: string; cardId: 'THT3-CARD'; spiritId: ThreeHeadedTemplarSpiritId;
  selectedMethod: ThreeHeadedTemplarSpiritMethod; location: 'B'; permissionVersion: number; createdAt: number; expiresAt: number;
  sourceSpirit: ThreeHeadedTemplarSpiritState;
}
export interface DarkAngelAttempt {
  week: number; method: Method; closed: boolean; stopped: boolean; returned: boolean; withdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; ownerTravelMetres: number; spiritualitySpent: number; mindSpent: number;
  spiritSpiritualitySpent: number; spiritIntegrityLost: number; penniesSpent: 20; stripId: string;
  cardTaken: boolean; cardReturned: boolean; inspected: boolean; readingQuality: 0 | 3 | 6; baselinePressure: 0 | 3; feltPressure: 0 | 1 | 3;
  castTier: PublicResolutionTier | null; selectedSpiritId: ThreeHeadedTemplarSpiritId | null; selectedMethod: ThreeHeadedTemplarSpiritMethod | null;
  applicationDone: boolean; verified: boolean; appliedAbilityIds: DarkAngelLifeAbilityId[]; waits: number;
  windowEnd: 'NONE' | 'ACTIVE' | 'FAILED' | 'APPLIED' | 'EXPIRED' | 'MOVED' | 'STOPPED' | 'WITHDRAWN' | 'LIGHT';
  result: 'NONE' | Method; siteAtStart: DarkAngelSite; siteAtClose: DarkAngelSite | null;
}
export interface DarkAngelLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  permission: Record<Permission, Consent>; permissionVersion: number; consentWeek: number | null;
  method: Method | null; result: 'NONE' | Method; contactOpen: boolean; returned: boolean; attempts: DarkAngelAttempt[];
}
export interface DarkAngelLifeCost { actions: number; pennies: number; spirituality: number; mind: number; spiritSpirituality: number; spiritIntegrity: number; sealCharges: number }
export interface DarkAngelLifeMovement { actorId: 'PLAYER' | 'THT3-MARA'; from: DarkAngelSite['playerLocation']; to: DarkAngelSite['playerLocation']; metres: number; seconds: number; itemIds: string[] }
export interface DarkAngelLifeSource {
  caseId: DarkAngelCaseId; at: number; cardId: 'THT3-CARD'; sealId: 'THT3-FAR-SEAL'; location: 'B'; permissionVersion: number;
  strip: DarkAngelSealStrip; spirit: ThreeHeadedTemplarSpiritState | null; selectedMethod: ThreeHeadedTemplarSpiritMethod | null; window: DarkAngelLifeWindow | null;
}
export interface DarkAngelLifeReceipt {
  week: number; date: PublicGameDate; revision: number; command: DarkAngelActivityCommand;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null; outcome: PublicResolutionTier | null;
  before: DarkAngelEncounterBudget; after: DarkAngelEncounterBudget; finance: DarkAngelFinanceSnapshot; paid: DarkAngelLifeCost;
  elapsedSeconds: number; moves: DarkAngelLifeMovement[]; siteBefore: DarkAngelSite; siteAfter: DarkAngelSite;
  operationBefore: ElderOperationState; operationAfter: ElderOperationState; source: DarkAngelLifeSource | null;
}
export interface DarkAngelLifeState {
  sourceWeek: number | null; activeCase: DarkAngelCaseId | null; reflected: boolean; site: DarkAngelSite; operation: ElderOperationState;
  ownerTravelMetres: number; strips: DarkAngelSealStrip[]; pending: DarkAngelLifeWindow | null; cases: Record<DarkAngelCaseId, DarkAngelLifeCase>; journal: DarkAngelLifeReceipt[];
}
export interface DarkAngelLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DarkAngelActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface DarkAngelLifeProjection {
  title: string; story: string; source: string; environment: string; nextStep: string; activeCase: DarkAngelCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  site: DarkAngelSite; operation: ElderOperationState; clockSeconds: number; playerLocation: DarkAngelSite['playerLocation']; playerTravelMetres: number; ownerTravelMetres: number;
  spirits: ThreeHeadedTemplarSpiritState[]; strips: DarkAngelSealStrip[]; pending: DarkAngelLifeWindow | null; pendingRemainingSeconds: number; currentAttempt: DarkAngelAttempt | null;
  cases: { id: DarkAngelCaseId; title: string; story: string; observations: string[]; status: string; method: Method | null; result: string | null; permission: Record<Permission, Consent>; permissionVersion: number; contactOpen: boolean; returned: boolean; attempts: DarkAngelAttempt[] }[];
  ledger: DarkAngelLifeReceipt[]; actions: DarkAngelLifeAction[];
}
const GUIDANCE: DarkAngelLifeAbilityId = 'hanged-man.s1.single-spirit-guidance', SHELTER: DarkAngelLifeAbilityId = 'hanged-man.s1.single-spirit-shelter';
const POSITION: Record<DarkAngelSite['playerLocation'], number> = { START: 0, A: 4, B: 8, YARD: -4, OUTSIDE: -2 };
const same = (a: unknown, b: unknown) => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 1;
const distance = (from: DarkAngelSite['playerLocation'], to: DarkAngelSite['playerLocation']) => Math.abs(POSITION[to] - POSITION[from]);
const freshCase = (): DarkAngelLifeCase => ({ status: 'AVAILABLE', observedWeek: null, permission: { OWNER: 'UNASKED', ABILITY: 'UNASKED' }, permissionVersion: 0, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, attempts: [] });
export function createDarkAngelLifeState(): DarkAngelLifeState {
  return { sourceWeek: null, activeCase: null, reflected: false, site: createThreeHeadedTemplarLifeState(), operation: createElderLifeState().operation, ownerTravelMetres: 0,
    strips: [], pending: null, cases: { 'guided-reading': freshCase(), 'guarded-pulse': freshCase(), 'withdrawn-guidance': freshCase() }, journal: [] };
}
const freshLife = (week: number, originals: DarkAngelOriginals): DarkAngelLifeState => ({ ...createDarkAngelLifeState(), sourceWeek: week, site: structuredClone(originals.site), operation: structuredClone(originals.operation) });
export function initializeDarkAngelLifeState(s: SliceState): void {
  const originals = s.darkAngel.sourceScene?.originals;
  if (!active(s) || !originals || !same(originals.site, s.threeHeadedTemplar.life) || !same(originals.operation, s.elder.life.operation) ||
    originals.site.playerLocation !== 'START' || originals.site.owner.location !== 'OUTSIDE' || originals.site.card.location !== 'TABLE' || originals.site.lamp.on || originals.site.shutter.state !== 'CLOSED' ||
    !same(s.darkAngel.life, createDarkAngelLifeState())) throw new Error('须只继承一次同一原院、原卡、原灵和已封存余压。');
  s.darkAngel.life = freshLife(s.week, originals);
}
export const getDarkAngelCurrentSite = (s: SliceState): DarkAngelSite => s.darkAngel.encounter.currentSite ?? (s.darkAngel.life.sourceWeek === null ? s.darkAngel.sourceScene?.originals.site ?? s.threeHeadedTemplar.life : s.darkAngel.life.site);
const current = (l: DarkAngelLifeState) => l.activeCase ? l.cases[l.activeCase].attempts[0] ?? null : null;
const locked = (l: DarkAngelLifeState) => l.activeCase !== null || l.pending !== null || l.sourceWeek !== null && l.site.owner.location === 'START';
const closedSite = (p: DarkAngelSite) => p.playerLocation === 'START' && p.owner.location === 'OUTSIDE' && p.card.location === 'TABLE' && !p.lamp.on && p.shutter.state === 'CLOSED';
export const hasDarkAngelLifeLock = (s: SliceState) => !!s.darkAngel?.life && locked(s.darkAngel.life);
export const darkAngelLifeClosed = (s: SliceState) => !hasDarkAngelLifeLock(s) && closedSite(s.darkAngel.life.site) && DARK_ANGEL_CASE_IDS.every(id => s.darkAngel.life.cases[id].status === 'RESOLVED');
export function validateDarkAngelActivityCommand(v: unknown): v is DarkAngelActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!DARK_ANGEL_CASE_IDS.includes(v.caseId as DarkAngelCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONSENT' || v.type === 'WITHDRAW_CONSENT') return shape(v, ['type', 'caseId', 'permission']) && ['OWNER', 'ABILITY'].includes(String(v.permission));
  if (v.type === 'GUIDANCE' || v.type === 'SHELTER') return shape(v, ['type', 'caseId', 'spiritId']) && THREE_HEADED_TEMPLAR_SPIRIT_IDS.includes(v.spiritId as ThreeHeadedTemplarSpiritId);
  return shape(v, ['type', 'caseId']) && (STEPS as readonly string[]).includes(String(v.type));
}
export const isDarkAngelActivityCommand = validateDarkAngelActivityCommand;
const isPower = (c: DarkAngelActivityCommand): c is Extract<DarkAngelActivityCommand, { spiritId: ThreeHeadedTemplarSpiritId }> => c.type === 'GUIDANCE' || c.type === 'SHELTER';
const stripFor = (l: DarkAngelLifeState, id: DarkAngelCaseId) => l.strips.find(n => n.caseId === id);
const selectedMethod = (type: 'GUIDANCE' | 'SHELTER', spiritId: ThreeHeadedTemplarSpiritId): ThreeHeadedTemplarSpiritMethod => type === 'GUIDANCE' ? 'SIGNAL' : spiritId === 'THT3-HELENA' ? 'BRIEF_WARD' : 'SCREEN';
function eligible(spirit: ThreeHeadedTemplarSpiritState | undefined, method: ThreeHeadedTemplarSpiritMethod): boolean {
  return !!spirit && spirit.status === 'GRAZED' && spirit.location === 'INTERNAL' && spirit.integrity > 0 && spirit.spirituality >= 3 && spirit.selectedAbilities.includes(method);
}
function pendingUsable(l: DarkAngelLifeState, id: DarkAngelCaseId, abilityId: DarkAngelLifeAbilityId): boolean {
  const w = l.pending, r = l.cases[id], strip = stripFor(l, id);
  return !!w && w.caseId === id && w.abilityId === abilityId && w.expiresAt > l.site.clockSeconds && w.location === l.site.playerLocation &&
    w.stripId === strip?.id && strip.location === 'PLAYER' && strip.charges === 1 && w.cardId === l.site.card.id && l.site.card.location === 'PLAYER' &&
    w.permissionVersion === r.permissionVersion && r.permission.OWNER === 'GRANTED' && r.permission.ABILITY === 'GRANTED' && l.site.owner.willing &&
    l.site.spirits[w.spiritId].status === 'GRAZED' && l.site.spirits[w.spiritId].location === 'INTERNAL' && l.site.spirits[w.spiritId].integrity > 0 && !l.site.lamp.on && l.site.shutter.state === 'CLOSED';
}
function localBlock(l: DarkAngelLifeState, c: DarkAngelActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !locked(l) && closedSite(p) && !l.reflected && DARK_ANGEL_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三案的真实归还与报告。';
  const id = c.caseId, r = l.cases[id], a = r.attempts[0], index = DARK_ANGEL_CASE_IDS.indexOf(id);
  if (c.type === 'OBSERVE') return !locked(l) && closedSite(p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[DARK_ANGEL_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收尾前案，核对同一原院与普通退路。';
  if (c.type === 'CONSENT') return l.activeCase === null && p.playerLocation === 'START' && r.status === 'OBSERVED' && r.permission[c.permission] === 'UNASKED' && p.owner.willing ? null : '须向仍自愿的玛拉分别取得本案原物及能力许可；撤回不自动重置。';
  if (c.type === 'PREPARE') return l.activeCase === null && p.playerLocation === 'START' && p.owner.location === 'START' && r.status === 'OBSERVED' && !a &&
    r.consentWeek === week && r.permission.OWNER === 'GRANTED' && (c.method === 'ORDINARY' || r.permission.ABILITY === 'GRANTED') ? null : '须本案当前原物许可，每案只购买一条真实封条；普通方法不要求能力许可。';
  if (c.type === 'REPORT') return !locked(l) && closedSite(p) && r.status === 'EXAMINED' && a?.closed && a.returned ? null : '须原卡回原桌、新封条已归还、灯板关闭、玛拉已走回院外。';
  if (c.type === 'WITHDRAW_CONSENT' && !a && r.status === 'OBSERVED') return r.permission[c.permission] === 'GRANTED' ? null : '只能撤回本案仍有效的这一项许可。';
  if (!a || a.closed || l.activeCase !== id || !r.contactOpen || a.week !== week) return '须本周正在进行的同一现场，不能复用旧许可或刷新原物。';
  if (c.type === 'WITHDRAW_CONSENT') return r.permission[c.permission] === 'GRANTED' ? null : '只能撤回本案仍有效的这一项许可。';
  if (c.type === 'ABORT') return null;
  if (c.type === 'STOP_METHOD') return !a.stopped ? null : '已停止；成本仍保留。';
  if (c.type === 'RETURN_TO_A') return p.playerLocation === 'B' ? null : '须本人从原封条沿4米路返回A。';
  if (c.type === 'RETURN_CARD') return p.playerLocation === 'A' && p.card.location === 'PLAYER' ? null : '须携同一原卡回A原桌亲手归还。';
  if (c.type === 'RETURN_TO_ENTRY') return p.playerLocation === 'A' && p.card.location === 'TABLE' ? null : '先归还原卡，再沿4米路回入口。';
  if (c.type === 'CLOSE_LIGHT') return (p.playerLocation === 'B' || p.playerLocation === 'START' && !p.lamp.on) && (p.lamp.on || p.shutter.state === 'OPEN') ? null : '须在B亲手关灯，原入口拉绳只能关遮板。';
  if (c.type === 'RETURN_STRIP') return p.playerLocation === 'START' && p.card.location === 'TABLE' && !p.lamp.on && p.shutter.state === 'CLOSED' && stripFor(l, id)?.location === 'PLAYER' && (a.verified || a.stopped) ? null : '须本人返回入口，原卡归位、灯板关闭后把同一新封条交回。';
  if (c.type === 'LEAVE') return p.playerLocation === 'START' && p.owner.location === 'START' && stripFor(l, id)?.location === 'OWNER' && p.card.location === 'TABLE' && !p.lamp.on && p.shutter.state === 'CLOSED' && (a.verified || a.stopped) ? null : '先真实完成或停止、归还原卡和封条，再由玛拉走2米回院外。';
  if (c.type === 'WAIT_10') return l.pending && a.waits < 2 ? null : '只等待当前20秒窗口，不续时、不退费。';
  if (a.verified) return '有限核验已结束，只能停止并普通收尾。';
  if (r.permission.OWNER !== 'GRANTED' || !p.owner.willing) return '原物许可已经停止，只能普通返回归还。';
  if (c.type === 'APPROACH') return p.playerLocation === 'OUTSIDE' ? null : '本人已经在原入口，无须多走一次。';
  if (c.type === 'WALK_TO_A') return p.playerLocation === 'START' && !a.stopped ? null : '须从入口沿4米原路步行到A。';
  if (c.type === 'TAKE_CARD') return p.playerLocation === 'A' && p.card.location === 'TABLE' && !a.cardTaken && !a.stopped ? null : '只可在A原桌取同一张原卡一次。';
  if (c.type === 'WALK_TO_B') return p.playerLocation === 'A' && p.card.location === 'PLAYER' ? null : '须本人持原卡沿4米路到B。';
  if (p.playerLocation !== 'B' || p.card.location !== 'PLAYER' || stripFor(l, id)?.location !== 'PLAYER') return '须本人持原卡与本案封条，实际在B原封条旁。';
  if (c.type === 'OPEN_LIGHT') return !!l.pending && !p.lamp.on && p.shutter.state === 'CLOSED' ? null : '须有真实正在作用的单灵窗口，再亲手打开同一原灯与遮板。';
  if (c.type === 'READ_ORIGINAL') return !a.readingQuality && (id !== 'withdrawn-guidance' || a.method === 'ORDINARY' || a.withdrawn) ? null : '同一原卡只实际阅读一次；撤回案须先撤回能力许可再普通读取。';
  if (c.type === 'PERFORM_OPERATION') return id === 'guarded-pulse' && a.readingQuality > 0 && !a.applicationDone && l.operation.contained && l.operation.residualPressure === 3 && !p.lamp.on && p.shutter.state === 'CLOSED' ? null : '先亲读原卡，再对仍封存的3点余压作一次局部核验。';
  if (isPower(c)) {
    if (a.method !== 'ABILITY' || a.stopped || r.permission.ABILITY !== 'GRANTED' || l.pending || a.castTier !== null || stripFor(l, id)?.charges !== 1 || p.lamp.on || p.shutter.state !== 'CLOSED') return '须本案能力许可、未用付费封条与一次机会；不能重复施术或延长窗口。';
    if (c.type === 'GUIDANCE' && (id === 'guarded-pulse' || a.readingQuality > 0) || c.type === 'SHELTER' && (id !== 'guarded-pulse' || !a.readingQuality)) return '引导须在读卡前，护持须在读卡后且实际核验之前。';
    return eligible(p.spirits[c.spiritId], selectedMethod(c.type, c.spiritId)) ? null : '指定原灵须仍内部放牧、完整度有效、原已选技巧匹配且有3灵性；可直接选择普通办法。';
  }
  return '当前阶段不能进行这一步。';
}
function cost(c: DarkAngelActivityCommand): DarkAngelLifeCost {
  return { actions: ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, pennies: c.type === 'PREPARE' ? 20 : 0,
    spirituality: isPower(c) ? 8 : 0, mind: isPower(c) ? 2 : 0, spiritSpirituality: isPower(c) ? 3 : 0, spiritIntegrity: 0, sealCharges: 0 };
}
function validBudget(b: DarkAngelEncounterBudget): boolean {
  return record(b) && shape(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) &&
    integer(b.cash) && integer(b.actions, 0, 100) && integer(b.health, 1, 100) && integer(b.mind, 0, 100) && integer(b.spirituality, 0, 120) && b.sequence === 1 &&
    integer(b.acting, 0, 100) && integer(b.pollution, 0, 100) && typeof b.gender === 'string' && record(b.coreStats) && shape(b.coreStats, ['physique', 'perception', 'will', 'knowledge']) &&
    Object.values(b.coreStats).every(n => integer(n, 0, 500)) && record(b.mastery) && Object.values(b.mastery).every(n => integer(n, 0, 500)) &&
    Array.isArray(b.completedSources) && b.completedSources.every(x => typeof x === 'string') && new Set(b.completedSources).size === b.completedSources.length && Array.isArray(b.injuries) && integer(b.injuryRisk);
}
interface Audit { date: PublicGameDate; revision: number; finance: DarkAngelFinanceSnapshot; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const audit = (s: SliceState, checked: boolean): Audit => ({ date: structuredClone(s.date), revision: s.revision, finance: darkAngelFinanceSnapshot(s), randomCursor: s.random.cursor, randomBefore: checked ? s.random.cursor : null, randomAfter: null, checkBase: checked ? s.character.coreStats.knowledge : null, check: null });
function transition(initial: DarkAngelLifeState, c: DarkAngelActivityCommand, week: number, before: DarkAngelEncounterBudget, clock: Audit) {
  if (!validateDarkAngelActivityCommand(c) || !validBudget(before) || localBlock(initial, c, week)) return null;
  const l = structuredClone(initial), p = l.site, paid = cost(c), after = structuredClone(before);
  if (isPower(c) && !success(clock.check?.tier ?? null)) paid.mind = 4;
  if (before.actions < paid.actions || before.cash < paid.pennies || before.spirituality < paid.spirituality || before.mind < paid.mind) return null;
  after.actions -= paid.actions; after.cash -= paid.pennies; after.spirituality -= paid.spirituality; after.mind -= paid.mind;
  const id = 'caseId' in c ? c.caseId : null, r = id ? l.cases[id] : null;
  let a = r?.attempts[0] ?? null;
  const strip = id ? stripFor(l, id) ?? null : null;
  const source: DarkAngelLifeSource | null = id && strip && p.playerLocation === 'B' && (isPower(c) || c.type === 'READ_ORIGINAL' || c.type === 'PERFORM_OPERATION' || c.type === 'OPEN_LIGHT') ? {
    caseId: id, at: p.clockSeconds, cardId: p.card.id, sealId: p.farSeal.id, location: 'B', permissionVersion: r!.permissionVersion, strip: structuredClone(strip),
    spirit: isPower(c) ? structuredClone(p.spirits[c.spiritId]) : l.pending ? structuredClone(p.spirits[l.pending.spiritId]) : null,
    selectedMethod: isPower(c) ? selectedMethod(c.type, c.spiritId) : l.pending?.selectedMethod ?? null, window: structuredClone(l.pending) } : null;
  const receipt: DarkAngelLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome: clock.check?.tier ?? null, before: structuredClone(before), after, paid,
    elapsedSeconds: 0, moves: [], siteBefore: structuredClone(p), siteAfter: structuredClone(p), operationBefore: structuredClone(l.operation), operationAfter: structuredClone(l.operation), source };
  const clear = (why: DarkAngelAttempt['windowEnd']) => { if (l.pending && a) a.windowEnd = why; l.pending = null; };
  const tick = (seconds: number) => { p.clockSeconds += seconds; receipt.elapsedSeconds += seconds; if (a && c.type !== 'REPORT') a.elapsedSeconds += seconds; if (l.pending && l.pending.expiresAt <= p.clockSeconds) clear('EXPIRED'); };
  const ownerMove = (to: 'START' | 'OUTSIDE') => {
    const from = p.owner.location, metres = distance(from, to); p.owner.location = to; l.ownerTravelMetres += metres; if (a) a.ownerTravelMetres += metres;
    receipt.moves.push({ actorId: 'THT3-MARA', from, to, metres, seconds: metres, itemIds: [] }); tick(metres);
  };
  const move = (to: 'START' | 'A' | 'B') => {
    clear('MOVED'); const from = p.playerLocation, metres = distance(from, to), held = id ? stripFor(l, id) : null, itemIds: string[] = [];
    p.playerLocation = to; p.playerTravelMetres += metres; if (a) a.playerTravelMetres += metres;
    if (p.card.location === 'PLAYER') { p.card.travelMetres += metres; itemIds.push(p.card.id); }
    if (held?.location === 'PLAYER') { held.travelMetres += metres; itemIds.push(held.id); }
    receipt.moves.push({ actorId: 'PLAYER', from, to, metres, seconds: metres, itemIds }); tick(metres);
  };
  const returnCard = () => { p.card.location = 'TABLE'; a!.cardReturned = true; tick(1); };
  const returnStrip = () => { const held = stripFor(l, id!)!; held.status = 'RETURNED'; held.location = 'OWNER'; a!.returned = true; r!.returned = true; tick(1); };
  const close = () => {
    clear('STOPPED'); ownerMove('OUTSIDE'); a!.closed = true; a!.result = a!.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r!.result = a!.result;
    r!.contactOpen = false; r!.status = 'EXAMINED'; for (const permission of ['OWNER', 'ABILITY'] as const) if (r!.permission[permission] === 'GRANTED') r!.permission[permission] = 'CLOSED';
    a!.siteAtClose = structuredClone(p); l.activeCase = null;
  };
  const applyWindow = (abilityId: DarkAngelLifeAbilityId): boolean => {
    if (!pendingUsable(l, id!, abilityId)) return false;
    strip!.charges = 0; strip!.wear++; paid.sealCharges = 1; a!.appliedAbilityIds.push(abilityId); clear('APPLIED'); return true;
  };
  switch (c.type) {
    case 'OBSERVE': r!.status = 'OBSERVED'; r!.observedWeek = week; tick(3); break;
    case 'CONSENT': r!.permission[c.permission] = 'GRANTED'; r!.permissionVersion++; r!.consentWeek = week; tick(1); if (c.permission === 'OWNER') ownerMove('START'); break;
    case 'PREPARE': {
      const stripId = `DA1-SEAL-STRIP-${DARK_ANGEL_CASE_IDS.indexOf(c.caseId) + 1}`;
      a = { week, method: c.method, closed: false, stopped: false, returned: false, withdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0, ownerTravelMetres: 2,
        spiritualitySpent: 0, mindSpent: 0, spiritSpiritualitySpent: 0, spiritIntegrityLost: 0, penniesSpent: 20, stripId, cardTaken: false, cardReturned: false, inspected: false,
        readingQuality: 0, baselinePressure: 0, feltPressure: 0, castTier: null, selectedSpiritId: null, selectedMethod: null, applicationDone: false, verified: false, appliedAbilityIds: [], waits: 0,
        windowEnd: 'NONE', result: 'NONE', siteAtStart: structuredClone(p), siteAtClose: null };
      r!.attempts.push(a); r!.method = c.method; r!.status = 'ACTIVE'; r!.contactOpen = true; l.activeCase = c.caseId;
      l.strips.push({ id: stripId, caseId: c.caseId, ownerId: 'PLAYER', quantity: 1, status: 'PLAYER', location: 'PLAYER', charges: 1, wear: 0, paidPennies: 20, boughtWeek: week, travelMetres: 0 }); tick(2); break;
    }
    case 'APPROACH': move('START'); break;
    case 'WALK_TO_A': case 'RETURN_TO_A': move('A'); break;
    case 'WALK_TO_B': move('B'); a!.inspected = true; break;
    case 'RETURN_TO_ENTRY': move('START'); break;
    case 'TAKE_CARD': p.card.location = 'PLAYER'; a!.cardTaken = true; tick(1); break;
    case 'RETURN_CARD': returnCard(); break;
    case 'RETURN_STRIP': returnStrip(); break;
    case 'LEAVE': close(); break;
    case 'GUIDANCE': case 'SHELTER': {
      const tier = clock.check?.tier ?? null; if (!tier || !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(tier)) return null;
      const spirit = p.spirits[c.spiritId], method = selectedMethod(c.type, c.spiritId); const original = structuredClone(spirit);
      spirit.spirituality -= 3; a!.spiritualitySpent += 8; a!.mindSpent += paid.mind; a!.spiritSpiritualitySpent += 3; a!.castTier = tier; a!.selectedSpiritId = c.spiritId; a!.selectedMethod = method; tick(1);
      a!.windowEnd = success(tier) ? 'ACTIVE' : 'FAILED';
      l.pending = success(tier) ? { abilityId: c.type === 'GUIDANCE' ? GUIDANCE : SHELTER, caseId: id!, stripId: strip!.id, cardId: p.card.id, spiritId: c.spiritId,
        selectedMethod: method, location: 'B', permissionVersion: r!.permissionVersion, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 20, sourceSpirit: original } : null; break;
    }
    case 'READ_ORIGINAL': {
      const applied = id !== 'guarded-pulse' && applyWindow(GUIDANCE); a!.readingQuality = applied ? 6 : 3;
      if (id !== 'guarded-pulse') { a!.applicationDone = true; a!.verified = true; } tick(3); break;
    }
    case 'PERFORM_OPERATION': {
      const applied = applyWindow(SHELTER); a!.baselinePressure = 3; a!.feltPressure = applied ? 1 : 3; a!.applicationDone = true; a!.verified = true;
      l.operation.sealWear++; tick(2); break;
    }
    case 'OPEN_LIGHT': {
      const w = l.pending!; const spirit = p.spirits[w.spiritId]; const lost = Math.min(20, spirit.integrity);
      p.lamp.on = true; p.shutter.state = 'OPEN'; spirit.integrity -= lost; spirit.interrupted = true; a!.spiritIntegrityLost += lost; paid.spiritIntegrity = lost;
      if (spirit.integrity === 0) { spirit.status = 'DISSIPATED'; spirit.location = 'DISSIPATED'; spirit.supportEnabled = false; }
      clear('LIGHT'); tick(1); break;
    }
    case 'CLOSE_LIGHT': p.lamp.on = false; p.shutter.state = 'CLOSED'; tick(1); break;
    case 'WAIT_10': a!.waits++; tick(10); break;
    case 'WITHDRAW_CONSENT':
      r!.permission[c.permission] = 'WITHDRAWN'; r!.permissionVersion++;
      if (a) { a.withdrawn = true; a.stopped = true; } clear('WITHDRAWN'); tick(1);
      if (!a && c.permission === 'OWNER' && p.owner.location === 'START') ownerMove('OUTSIDE'); break;
    case 'STOP_METHOD': a!.stopped = true; clear('STOPPED'); tick(1); break;
    case 'ABORT':
      a!.stopped = true; clear('STOPPED'); tick(1);
      if (p.lamp.on || p.shutter.state === 'OPEN') { if (p.playerLocation === 'START') move('A'); if (p.playerLocation === 'A') move('B'); p.lamp.on = false; p.shutter.state = 'CLOSED'; tick(1); }
      if (p.playerLocation === 'B') move('A'); if (p.card.location === 'PLAYER') returnCard(); if (p.playerLocation === 'A') move('START');
      if (stripFor(l, id!)!.location === 'PLAYER') returnStrip(); close(); break;
    case 'REPORT': {
      const marker = `dark-angel-case:${id}`; if (after.completedSources.includes(marker)) return null;
      r!.status = 'RESOLVED'; after.acting = Math.min(100, after.acting + 25); after.completedSources.push(marker);
      for (const abilityId of a!.appliedAbilityIds) after.mastery[abilityId] = Math.min(500, (after.mastery[abilityId] ?? 0) + 8); tick(4); break;
    }
    case 'REFLECT': if (after.completedSources.includes('dark-angel-reflection')) return null; l.reflected = true; after.acting = Math.min(100, after.acting + 25); after.completedSources.push('dark-angel-reflection'); tick(4); break;
  }
  receipt.siteAfter = structuredClone(p); receipt.operationAfter = structuredClone(l.operation); if (!validBudget(after)) return null;
  return { life: l, receipt };
}
/** Continuing objects keep original identity/history. Exact life and encounter
 * replay separately establishes every permitted mutable field and cost. */
export function validateDarkAngelCurrentSite(v: unknown, originals: DarkAngelOriginals): v is DarkAngelSite {
  try {
    if (!record(v) || !shape(v, Object.keys(originals.site))) return false;
    const p = v as unknown as DarkAngelSite, old = originals.site;
    if (!Object.hasOwn(POSITION, p.playerLocation) || !integer(p.playerTravelMetres, old.playerTravelMetres) || !integer(p.clockSeconds, old.clockSeconds) ||
      !same(p, { ...old, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, clockSeconds: p.clockSeconds, owner: p.owner, card: p.card, lamp: p.lamp, shutter: p.shutter, spirits: p.spirits })) return false;
    if (!['START', 'OUTSIDE'].includes(p.owner.location) || !same(p.owner, { ...old.owner, location: p.owner.location }) ||
      !['TABLE', 'PLAYER'].includes(p.card.location) || !integer(p.card.travelMetres, old.card.travelMetres) || !same(p.card, { ...old.card, location: p.card.location, travelMetres: p.card.travelMetres }) ||
      typeof p.lamp.on !== 'boolean' || !same(p.lamp, { ...old.lamp, on: p.lamp.on }) || !['OPEN', 'CLOSED'].includes(p.shutter.state) || !same(p.shutter, { ...old.shutter, state: p.shutter.state })) return false;
    if (!record(p.spirits) || !shape(p.spirits, THREE_HEADED_TEMPLAR_SPIRIT_IDS)) return false;
    for (const id of THREE_HEADED_TEMPLAR_SPIRIT_IDS) {
      const spirit = p.spirits[id], original = old.spirits[id];
      if (!record(spirit) || !shape(spirit, Object.keys(original)) || !integer(spirit.spirituality, 0, original.spirituality) || !integer(spirit.integrity, 0, original.integrity) ||
        !integer(spirit.travelMetres, original.travelMetres) || !Array.isArray(spirit.history) || !same(spirit.history.slice(0, original.history.length), original.history) ||
        !['GRAZED', 'RELEASED', 'DISSIPATED', 'SEALED'].includes(spirit.status) || !['INTERNAL', 'START', 'A', 'B', 'COURT', 'RELEASED', 'DISSIPATED', 'SEALED'].includes(spirit.location) ||
        typeof spirit.interrupted !== 'boolean' || typeof spirit.supportEnabled !== 'boolean' ||
        !same(spirit, { ...original, status: spirit.status, location: spirit.location, spirituality: spirit.spirituality, integrity: spirit.integrity, interrupted: spirit.interrupted,
          supportEnabled: spirit.supportEnabled, travelMetres: spirit.travelMetres, history: spirit.history, releasedWeek: spirit.releasedWeek })) return false;
    }
    return true;
  } catch { return false; }
}
function lifeBoundary(e: DarkAngelLifeReceipt, isLocked: boolean) {
  const budget = structuredClone(e.after), finance = structuredClone(e.finance);
  if (budget.actions > 0 || isLocked) return { budget, finance, week: e.week, date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: budget.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE', receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...budget, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 },
    finance: darkAngelFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date,
    pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount, eventId: result.eventId, receipts };
}
export function darkAngelCompletedLifeBudgetMatches(s: SliceState, e: DarkAngelLifeReceipt, isLocked = hasDarkAngelLifeLock(s)): boolean {
  const expected = lifeBoundary(e, isLocked);
  if (!same(darkAngelEncounterBudget(s), expected.budget) || !same(darkAngelFinanceSnapshot(s), expected.finance) || s.week !== expected.week || !same(s.date, expected.date) ||
    s.random.cursor !== (e.randomAfter ?? e.randomCursor) || s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null ||
    (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId)) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate) => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(s: SliceState): DarkAngelLifeState | null {
  const life = s.darkAngel.life, source = s.darkAngel.sourceScene;
  if (!source || life.sourceWeek === null) return null;
  let model = freshLife(life.sourceWeek, source.originals), previous: DarkAngelLifeReceipt | null = null, lastWeek = life.sourceWeek, cursor = source.random.cursor;
  for (const e of life.journal) {
    if (!record(e) || !shape(e, ['week', 'date', 'revision', 'command', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'outcome', 'before', 'after', 'finance', 'paid', 'elapsedSeconds', 'moves', 'siteBefore', 'siteAfter', 'operationBefore', 'operationAfter', 'source']) ||
      !validateDarkAngelActivityCommand(e.command) || !integer(e.week, lastWeek, s.week) || !isValidGameDate(e.date) || !dateMatches(e.date, s.week - e.week, s.date) ||
      !integer(e.revision, previous ? previous.revision + 1 : source.revision, s.revision) || !integer(e.randomCursor, cursor, s.random.cursor) || !validateDarkAngelFinanceSnapshot(e.finance, e.week) || !validBudget(e.before)) return null;
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
    if (!next || !same(next.receipt, e) || !validateDarkAngelCurrentSite(next.life.site, source.originals)) return null;
    model = next.life; model.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; cursor = e.randomAfter ?? e.randomCursor;
  }
  return model;
}
export function darkAngelLifeMasteryGains(s: SliceState): Record<DarkAngelLifeAbilityId, number> {
  const gains: Record<DarkAngelLifeAbilityId, number> = { [GUIDANCE]: 0, [SHELTER]: 0 } as Record<DarkAngelLifeAbilityId, number>;
  for (const id of DARK_ANGEL_CASE_IDS) { const r = s.darkAngel.life.cases[id]; if (r.status === 'RESOLVED') for (const abilityId of r.attempts[0]!.appliedAbilityIds) gains[abilityId] += 8; }
  return gains;
}
export function validateDarkAngelLifeState(s: SliceState): boolean {
  try {
    const life = s.darkAngel?.life, source = s.darkAngel?.sourceScene;
    if (!record(life) || !shape(life, Object.keys(createDarkAngelLifeState())) || !record(life.cases) || !shape(life.cases, DARK_ANGEL_CASE_IDS) || !Array.isArray(life.journal) || life.journal.length > 250) return false;
    if (s.darkAngel.promotionWeek === null) return same(life, createDarkAngelLifeState());
    if (!source || life.sourceWeek !== s.darkAngel.promotionWeek || !same(source.originals.site, s.threeHeadedTemplar.life) || !same(source.originals.operation, s.elder.life.operation) ||
      !closedSite(source.originals.site) || !validateDarkAngelCurrentSite(life.site, source.originals)) return false;
    const replay = replayLife(s); if (!replay || !same(life, replay)) return false;
    const gains = darkAngelLifeMasteryGains(s); let acting = life.reflected ? 25 : 0;
    for (const id of DARK_ANGEL_CASE_IDS) {
      const resolved = life.cases[id].status === 'RESOLVED'; if (s.seer.completedSources.filter(x => x === `dark-angel-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
    }
    if (s.seer.completedSources.filter(x => x === 'dark-angel-reflection').length !== (life.reflected ? 1 : 0) || active(s) && s.progression.acting < acting ||
      (s.progression.mastery[GUIDANCE] ?? 0) < gains[GUIDANCE] || (s.progression.mastery[SHELTER] ?? 0) < gains[SHELTER]) return false;
    const last = life.journal.at(-1), encounter = s.darkAngel.encounter;
    if (locked(life) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.darkAngel.preparedWeek !== null ||
      encounter.status !== 'AVAILABLE' || encounter.preparation !== null || !last || last.week !== s.week || !same(darkAngelEncounterBudget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && !darkAngelCompletedLifeBudgetMatches(s, last, locked(life))) return false;
    return true;
  } catch { return false; }
}
export const validateDarkAngelLife = validateDarkAngelLifeState;
export function blockDarkAngelLife(s: SliceState, c: DarkAngelActivityCommand): string | null {
  if (!validateDarkAngelActivityCommand(c)) return '单灵有限实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着并已实际晋升暗天使。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.darkAngel.preparedWeek !== null) return '先处理当前事件、战斗或晋升准备，并回到贝克兰德原院。';
  if (s.darkAngel.encounter.status !== 'AVAILABLE' || s.darkAngel.encounter.preparation !== null) return '现场已经交给独立遭遇；原院实践保留为历史。';
  if (!validateDarkAngelLifeState(s)) return '原人原物、有限原灵、实付成本或历史收据不一致。';
  const reason = localBlock(s.darkAngel.life, c, s.week); if (reason) return reason;
  const paid = cost(c);
  if (s.actionsRemaining < paid.actions || s.cash < paid.pennies || s.spirituality < paid.spirituality || s.mind < (isPower(c) ? 4 : paid.mind)) return '行动、费用、灵性或失败所需精神不足；可用普通方法完成并归还。';
  return null;
}
export const getDarkAngelActivityBlock = blockDarkAngelLife;
export function applyDarkAngelLifeCommand(s: SliceState, c: DarkAngelActivityCommand, ctx: SeerContext): void {
  const reason = blockDarkAngelLife(s, c); if (reason) throw new Error(reason);
  const clock = audit(s, isPower(c)), before = darkAngelEncounterBudget(s);
  if (isPower(c)) { clock.check = structuredClone(ctx.check('knowledge', 18)); clock.randomAfter = s.random.cursor; }
  const next = transition(s.darkAngel.life, c, s.week, before, clock); if (!next) throw new Error('同一原院的有限现场转移失败。');
  s.darkAngel.life = next.life; s.darkAngel.life.journal.push(next.receipt);
  const after = next.receipt.after; s.cash = after.cash; s.actionsRemaining = after.actions; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality;
  s.progression.acting = after.acting; s.progression.mastery = structuredClone(after.mastery); s.seer.completedSources = [...after.completedSources];
  ctx.note(`原院单灵实践：${LABELS[c.type]}`, `${clock.check ? `知识18检定${TIER_LABELS[clock.check.tier]}，本人实付8灵性、${next.receipt.paid.mind}精神，所选原灵实付3灵性。` : ''}本人在${LOCATION_LABELS[next.life.site.playerLocation]}，原院时钟${next.life.site.clockSeconds}秒。${c.type === 'READ_ORIGINAL' ? `同一原卡本次读取质量${current(next.life)?.readingQuality ?? 3}。` : c.type === 'PERFORM_OPERATION' ? `本次局部承受${current(next.life)?.feltPressure ?? 3}，原余压仍为3并保持封存。` : c.type === 'WITHDRAW_CONSENT' ? '指定许可已经撤回，未用窗口立即失效，已付成本保留。' : '原灵、原卡与旧封存物持续保留；普通归还不恢复资源。'}`);
}
export const applyDarkAngelActivity = applyDarkAngelLifeCommand;
export const applyDarkAngelLife = applyDarkAngelLifeCommand;
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATION_LABELS: Record<DarkAngelSite['playerLocation'], string> = { START: '原入口', A: '四米处原桌', B: '八米处原封条', YARD: '独立邻院', OUTSIDE: '院外' };
const LABELS: Record<DarkAngelActivityCommand['type'], string> = {
  OBSERVE: '核对原院、原人和普通退路', PREPARE: '购买本案唯一封条', CONSENT: '重新询问本案许可', WITHDRAW_CONSENT: '听取本案撤回许可',
  APPROACH: '沿2米路回入口', WALK_TO_A: '沿4米路走到原桌', TAKE_CARD: '取同一张原卡', WALK_TO_B: '持原卡走4米到原封条', READ_ORIGINAL: '亲读原卡并对照封条',
  GUIDANCE: '单灵引导：准备一次读卡', SHELTER: '单灵护持：准备一次局部核验', PERFORM_OPERATION: '实际核验一次封存余压',
  WAIT_10: '实际等待10秒', STOP_METHOD: '停止本次能力方法', RETURN_TO_A: '沿4米原路回原桌', RETURN_CARD: '把原卡放回同一原桌', RETURN_TO_ENTRY: '沿4米原路回入口',
  RETURN_STRIP: '亲手交还同一新封条', LEAVE: '结束接触，玛拉走回院外', ABORT: '停止并沿普通路真实归还', REPORT: '报告已收尾的实际结果', REFLECT: '反思三案的有限协作与代价',
  OPEN_LIGHT: '亲手打开原灯与遮板', CLOSE_LIGHT: '关闭原灯与遮板',
};
const CASES: { id: DarkAngelCaseId; title: string; story: string }[] = [
  { id: 'guided-reading', title: '单灵引导同一原卡', story: '本人持原卡走到八米处原封条，明确选择一位已掌握有限信号的内部原灵。实付成本后的20秒窗口只提高下一次亲读质量3→6；普通阅读始终可用。' },
  { id: 'guarded-pulse', title: '单灵护持一次局部余压', story: '先亲读原卡，选择赫莲娜已选短暂守护或罗兰已选屏护。只让下一次实际封存操作的局部承受3→1，原封条余压仍为3，没有治疗或伤害原主。' },
  { id: 'withdrawn-guidance', title: '撤回后依然普通完成', story: '重新取得原物与能力许可，可先尝试引导，再听取真实撤回。未用窗口立即清除、成本保留；本人普通读卡、原路归还，不奖未应用掌握。' },
];
export function darkAngelLifeActions(s: SliceState): DarkAngelLifeAction[] {
  if (!active(s) || s.darkAngel.encounter.status !== 'AVAILABLE' || s.darkAngel.encounter.preparation !== null) return [];
  const l = s.darkAngel.life, id = l.activeCase ?? DARK_ANGEL_CASE_IDS.find(key => l.cases[key].status !== 'RESOLVED'), out: DarkAngelLifeAction[] = [];
  const add = (command: DarkAngelActivityCommand) => {
    const reason = blockDarkAngelLife(s, command), paid = cost(command), cleanup = ['STOP_METHOD', 'RETURN_TO_A', 'RETURN_CARD', 'RETURN_TO_ENTRY', 'RETURN_STRIP', 'LEAVE', 'ABORT', 'CLOSE_LIGHT', 'WITHDRAW_CONSENT'].includes(command.type);
    out.push({ id: `DA1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${'permission' in command ? `:${command.permission}` : command.type === 'PREPARE' ? `:${command.method}` : 'spiritId' in command ? `:${command.spiritId}` : ''}`,
      label: LABELS[command.type] + ('permission' in command ? command.permission === 'OWNER' ? '（原物）' : '（能力）' : command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : 'spiritId' in command ? `（${l.site.spirits[command.spiritId].name}）` : ''),
      cost: [`${paid.actions}行动`, ...(paid.pennies ? [`${paid.pennies}便士`] : []), ...(isPower(command) ? ['本人8灵性、2精神（失败总4精神）', '所选原灵3灵性', '知识18', '20秒单次窗口'] : [])].join(' · '), enabled: reason === null, reason, command, cleanup });
  };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id], a = r.attempts[0];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') {
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'UNASKED') add({ type: 'CONSENT', caseId: id, permission });
    add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
  }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (a && r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'ABORT'].includes(type) && localBlock(l, { type, caseId: id }, s.week) === null) add({ type, caseId: id });
    if (a.method === 'ABILITY' && !a.stopped && a.castTier === null && l.site.playerLocation === 'B') for (const spiritId of THREE_HEADED_TEMPLAR_SPIRIT_IDS) add({ type: id === 'guarded-pulse' ? 'SHELTER' : 'GUIDANCE', caseId: id, spiritId });
    for (const permission of ['OWNER', 'ABILITY'] as const) if (r.permission[permission] === 'GRANTED') add({ type: 'WITHDRAW_CONSENT', caseId: id, permission });
    add({ type: 'ABORT', caseId: id });
  }
  let preferred: DarkAngelLifeAction | undefined;
  if (a && !a.verified && a.method === 'ABILITY') {
    if (id === 'withdrawn-guidance' && l.site.playerLocation === 'B' && !a.withdrawn && (a.castTier !== null || !out.some(v => v.enabled && isPower(v.command)))) preferred = out.find(v => v.enabled && v.command.type === 'WITHDRAW_CONSENT' && v.command.permission === 'ABILITY');
    if (!preferred && a.castTier === null) preferred = out.find(v => v.enabled && isPower(v.command));
  }
  preferred ??= out.find(v => v.enabled && !['ABORT', 'STOP_METHOD', 'WAIT_10', 'WITHDRAW_CONSENT', 'OPEN_LIGHT', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_CARD', 'RETURN_STRIP', 'LEAVE'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled && !['ABORT', 'STOP_METHOD', 'WAIT_10', 'WITHDRAW_CONSENT', 'OPEN_LIGHT'].includes(v.command.type));
  preferred ??= out.find(v => v.enabled);
  if (preferred) preferred.preferredAction = true;
  return out;
}
export function projectDarkAngelLife(s: SliceState): DarkAngelLifeProjection {
  const l = s.darkAngel.life, site = getDarkAngelCurrentSite(s), actions = darkAngelLifeActions(s), preferred = actions.find(a => a.preferredAction) ?? actions.find(a => a.enabled);
  return { title: '原院的有限单灵实践', story: '沿用原玛拉、原卡、原封条和两位实际内部原灵。每案只购一条封条；所有许可、行走、代价与退路都实际记录。',
    source: '同一原封存院、51岁玛拉、赫莲娜与罗兰；旧封存耗材、旧灵历史和既有身体伤势持续保留。',
    environment: '入口到四米处原桌，再走四米到原封条，每米1秒；玛拉取得原物许可后从院外走2米到入口，结束后走2米回院外。成功施术本人8灵性2精神，失败总4精神；原灵均付3灵性。20秒单次窗口只在原位置应用一次。',
    nextStep: preferred?.label ?? (l.reflected ? '三案已收尾，可自行决定是否前往独立邻院。' : '当前没有可执行的原院操作。'), preferredActionId: preferred?.id ?? null,
    activeCase: l.activeCase, inside: hasDarkAngelLifeLock(s), insideCase: hasDarkAngelLifeLock(s), reflected: l.reflected,
    site: structuredClone(site), operation: structuredClone(l.sourceWeek === null ? s.darkAngel.sourceScene?.originals.operation ?? s.elder.life.operation : l.operation), clockSeconds: site.clockSeconds, playerLocation: site.playerLocation, playerTravelMetres: site.playerTravelMetres, ownerTravelMetres: l.ownerTravelMetres,
    spirits: THREE_HEADED_TEMPLAR_SPIRIT_IDS.map(id => structuredClone(site.spirits[id])), strips: structuredClone(l.strips), pending: structuredClone(l.pending), pendingRemainingSeconds: l.pending ? Math.max(0, l.pending.expiresAt - site.clockSeconds) : 0,
    currentAttempt: structuredClone(current(l)), cases: CASES.map(info => { const r = l.cases[info.id], a = r.attempts[0]; return { ...info,
      observations: a ? [`实付${a.penniesSpent}便士、本人${a.spiritualitySpent}灵性/${a.mindSpent}精神、原灵${a.spiritSpiritualitySpent}灵性；本人走${a.playerTravelMetres}米，玛拉走${a.ownerTravelMetres}米。`,
        ...(a.readingQuality ? [`同一原卡本次读取质量${a.readingQuality}。`] : []), ...(a.baselinePressure ? [`封存余压基线3，本次局部承受${a.feltPressure}；操作后余压仍为3。`] : []), ...(a.withdrawn ? ['本案许可已经真实撤回，未用窗口不恢复。'] : [])] : [],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限作用已经实际应用并记录。' : '普通完成或明确停止；没有未应用的能力奖励。', permission: structuredClone(r.permission), permissionVersion: r.permissionVersion, contactOpen: r.contactOpen, returned: r.returned, attempts: structuredClone(r.attempts) }; }),
    ledger: structuredClone(l.journal), actions };
}
