import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { createCoffinBearerLifeState, validateCoffinBearerLifeOriginal, type CoffinBearerLifeState, type CoffinBearerSampleId } from '../coffin-bearer/life.js';
import { replayBarrenMatriarchEncounterRoot, replayBarrenMatriarchEncounterRootPad } from './encounter.js';

export const BARREN_MATRIARCH_CASE_IDS = ['bounded-dormancy', 'withdrawn-transfer', 'finite-root-buffer'] as const;
export const BARREN_MATRIARCH_ACTIVITY_CASE_IDS = BARREN_MATRIARCH_CASE_IDS;
export const ACTIVITY_CASE_IDS = BARREN_MATRIARCH_CASE_IDS;
export type BarrenMatriarchCaseId = typeof BARREN_MATRIARCH_CASE_IDS[number];
export type BarrenMatriarchLifeAbilityId = 'mother.s2.bounded-dormancy' | 'mother.s2.root-buffer';
export type BarrenMatriarchLocation = 'START' | 'A' | 'B';
export type BarrenMatriarchConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
/** One physical nursery. Original journals stay immutable; the actual people and objects move here. */
export interface BarrenMatriarchSceneRoot extends Omit<CoffinBearerLifeState, 'owner' | 'recipient' | 'samples' | 'paper' | 'box' | 'tag' | 'pads'> {
  owner: Omit<CoffinBearerLifeState['owner'], 'location'> & { location: BarrenMatriarchLocation | 'OUTSIDE' };
  recipient: Omit<CoffinBearerLifeState['recipient'], 'location'> & { location: BarrenMatriarchLocation | 'OUTSIDE' };
  samples: (Omit<CoffinBearerLifeState['samples'][number], 'location'> & { location: BarrenMatriarchLocation | 'OUTSIDE' })[];
  paper: Omit<CoffinBearerLifeState['paper'], 'location' | 'holder'> & { location: BarrenMatriarchLocation | 'OUTSIDE'; holder: 'OWNER' | 'PLAYER' };
  box: Omit<CoffinBearerLifeState['box'], 'location'> & { location: BarrenMatriarchLocation | 'SUPPLIER' | 'OUTSIDE' };
  tag: Omit<CoffinBearerLifeState['tag'], 'location'> & { location: BarrenMatriarchLocation | 'SUPPLIER' | 'OUTSIDE' };
  pads: (Omit<CoffinBearerLifeState['pads'][number], 'location'> & { location: BarrenMatriarchLocation | 'SUPPLIER' | 'OUTSIDE' })[];
}
export type BarrenMatriarchPhysicalState = BarrenMatriarchSceneRoot;
export interface BarrenMatriarchRootPad { id: 'BM2-ROOT-PAD'; sourceId: 'BM2-ROOT-FIBRE-STOCK'; material: 'PLANT_FIBRE'; quantity: 1; owner: 'SUPPLIER' | 'PLAYER'; holder: 'SUPPLIER' | 'PLAYER' | 'GROUND'; location: BarrenMatriarchLocation | 'OUTSIDE'; integrity: number; acquiredWeek: number | null }
export interface BarrenMatriarchSceneSource { root: 'coffinBearer.life'; promotionWeek: number; introducedWeek: number; snapshot: CoffinBearerLifeState; rootPad: BarrenMatriarchRootPad }
const STEPS = ['OBSERVE', 'CHECK_ORIGINALS', 'CONSENT_OWNER', 'DECLINE_PERMISSION', 'TAKE_KIT', 'CHECK_SAMPLE', 'CONSENT_SAMPLE', 'TAKE_SAMPLE', 'BOUNDED_DORMANCY', 'WITHDRAW_PERMISSION', 'VERIFY_TRANSPORT', 'CONFIRM_LIMITED', 'ROOT_BUFFER', 'APPLY_IMPACT', 'ORDINARY_SUPPORT', 'RETURN_SAMPLE', 'RETURN_KIT', 'WAIT_EFFECT', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type BarrenMatriarchActivityCommand = { type: typeof STEPS[number]; caseId: BarrenMatriarchCaseId } | { type: 'PREPARE'; caseId: BarrenMatriarchCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'WALK'; caseId: BarrenMatriarchCaseId; to: BarrenMatriarchLocation } | { type: 'REFLECT' } | { type: 'BUY_ROOT_PAD' };
export interface BarrenMatriarchMovement { from: BarrenMatriarchLocation; to: BarrenMatriarchLocation; mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[] }
export interface BarrenMatriarchDormancyEffect { abilityId: 'mother.s2.bounded-dormancy'; sampleId: CoffinBearerSampleId; createdAt: number; expiresAt: number; sourceCaseId: BarrenMatriarchCaseId }
export interface BarrenMatriarchBufferEffect { abilityId: 'mother.s2.root-buffer'; actor: 'PLAYER'; target: 'PLAYER'; padId: 'BM2-ROOT-PAD'; createdAt: number; expiresAt: number; remainingUses: 1; sourceCaseId: 'finite-root-buffer' }
export interface BarrenMatriarchImpact { actor: 'PLAYER'; target: 'PLAYER'; objectId: 'CB3-DRY-1'; massGrams: 100; visible: true; at: number; mode: 'IMPACT' | 'ORDINARY_SUPPORT'; baseHealthLoss: 5; healthLoss: 0 | 2 | 5; padWear: 0 | 15; bufferApplied: boolean }
export interface BarrenMatriarchOperationState { dormancy: BarrenMatriarchDormancyEffect | null; buffer: BarrenMatriarchBufferEffect | null }
export interface BarrenMatriarchAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; sampleId: CoffinBearerSampleId; consent: BarrenMatriarchConsent; ownerConsent: BarrenMatriarchConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean;
  originalsChecked: boolean; kitTaken: boolean; sampleChecked: boolean; checkedAlive: boolean | null; checkedVitality: number | null; sampleTaken: boolean; transportVerified: boolean; limitedConfirmed: boolean; sampleReturned: boolean; kitReturned: boolean; inspected: boolean;
  dormancyTier: PublicResolutionTier | null; bufferTier: PublicResolutionTier | null; impact: BarrenMatriarchImpact | null; effectExpired: boolean; effectStopped: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; healthLost: number; waitedSeconds: number; ordinaryExposureSeconds: number; protectedExposureSeconds: number; protectedTravelSeconds: number; ordinaryRemainderSeconds: number; protectedRemainderSeconds: number; vitalityLost: number;
  appliedAbilityIds: BarrenMatriarchLifeAbilityId[]; playerMoves: BarrenMatriarchMovement[]; evidence: string[];
}
export interface BarrenMatriarchCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: BarrenMatriarchAttempt[] }
export interface BarrenMatriarchLifeCost { actions: number; spirituality: number; mind: number; pennies: number; health: number; cashGained: 0 }
export interface BarrenMatriarchLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number }
export interface BarrenMatriarchCheckSource { caseId: BarrenMatriarchCaseId; abilityId: BarrenMatriarchLifeAbilityId; cost: 5 | 6; difficulty: 20; coreStat: 'knowledge'; baseAbility: number; actor: { pathwayId: 'mother'; sequence: 2; name: string; gender: string }; at: number; actorLocation: BarrenMatriarchLocation; currentConsent: 'GRANTED'; sample: BarrenMatriarchSceneRoot['samples'][number]; rootPad: BarrenMatriarchRootPad | null; target: 'LIVING_PLANT' | 'PLAYER'; maximumSeconds: 60 | 30 }
export interface BarrenMatriarchLifeEvent { week: number; date: PublicGameDate; revision: number; randomCursor: number; command: BarrenMatriarchActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: BarrenMatriarchCheckSource | null; inheritedScene: BarrenMatriarchSceneSource | null; clockBefore: number; clockAfter: number; padBefore: BarrenMatriarchRootPad; padAfter: BarrenMatriarchRootPad; paid: BarrenMatriarchLifeCost; budget: BarrenMatriarchLifeBudget }
export interface BarrenMatriarchLifeState { source: BarrenMatriarchSceneSource | null; activeCase: BarrenMatriarchCaseId | null; reflected: boolean; operation: BarrenMatriarchOperationState; rootPad: BarrenMatriarchRootPad; cases: Record<BarrenMatriarchCaseId, BarrenMatriarchCaseState>; journal: BarrenMatriarchLifeEvent[] }
export interface BarrenMatriarchLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: BarrenMatriarchActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface BarrenMatriarchAttemptProjection { method: 'ABILITY' | 'ORDINARY'; consent: BarrenMatriarchConsent; closed: boolean; stopped: boolean; permissionWithdrawn: boolean; checkedAlive: boolean | null; checkedVitality: number | null; dormancyTier: PublicResolutionTier | null; bufferTier: PublicResolutionTier | null; effectRemainingSeconds: number; impact: Pick<BarrenMatriarchImpact, 'at' | 'mode' | 'healthLoss' | 'padWear' | 'bufferApplied'> | null; sampleReturned: boolean; kitReturned: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; healthLost: number; vitalityLost: number; protectedTravelSeconds: number; evidence: string[] }
export interface BarrenMatriarchLifeProjection { title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: BarrenMatriarchCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; clockSeconds: number; playerLocation: BarrenMatriarchLocation; playerTravelMetres: number; currentAttempt: BarrenMatriarchAttemptProjection | null; rootPad: { title: string; owner: string; holder: string; location: string; integrity: number; acquired: boolean }; site: { title: string; owner: string; recipient: string; samples: string[]; paper: string; box: string; tag: string }; cases: { id: BarrenMatriarchCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: BarrenMatriarchAttemptProjection[] }[]; actions: BarrenMatriarchLifeAction[] }
const DORMANCY = 'mother.s2.bounded-dormancy' as const, BUFFER = 'mother.s2.root-buffer' as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 2;
const site = (s: SliceState): BarrenMatriarchSceneRoot => s.coffinBearer.life as BarrenMatriarchSceneRoot;
const freshPad = (): BarrenMatriarchRootPad => ({ id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', material: 'PLANT_FIBRE', quantity: 1, owner: 'SUPPLIER', holder: 'SUPPLIER', location: 'START', integrity: 65, acquiredWeek: null });
const freshCase = (): BarrenMatriarchCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createBarrenMatriarchLifeState(): BarrenMatriarchLifeState { return { source: null, activeCase: null, reflected: false, operation: { dormancy: null, buffer: null }, rootPad: freshPad(), cases: { 'bounded-dormancy': freshCase(), 'withdrawn-transfer': freshCase(), 'finite-root-buffer': freshCase() }, journal: [] }; }
const current = (l: BarrenMatriarchLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: BarrenMatriarchLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const sampleId = (id: BarrenMatriarchCaseId): CoffinBearerSampleId => id === 'bounded-dormancy' ? 'CB3-LIVE-1' : id === 'withdrawn-transfer' ? 'CB3-LIVE-2' : 'CB3-DRY-1';
const sampleFor = (p: BarrenMatriarchSceneRoot, id: BarrenMatriarchCaseId) => p.samples.find(x => x.id === sampleId(id))!;
const originFor = (id: BarrenMatriarchCaseId): 'A' | 'B' => id === 'bounded-dormancy' ? 'B' : 'A';
const route = (id: BarrenMatriarchCaseId): BarrenMatriarchLocation[] => id === 'bounded-dormancy' ? ['A', 'B', 'A', 'B', 'A', 'START'] : ['A', 'B', 'A', 'START'];
function kitHeld(p: BarrenMatriarchSceneRoot): boolean { return [p.box, p.tag, p.paper, ...p.pads].every(x => x.holder === 'PLAYER' && x.location === p.playerLocation); }
function cleanupBlock(l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot): string | null {
  if (l.operation.dormancy || l.operation.buffer) return '先停止或实际等候有限效果到期。';
  if (p.playerLocation !== 'START' || p.owner.location !== 'A' || p.recipient.location !== 'B') return '本人须普通走回门口，两位照料员须仍在各自原位。';
  if (p.box.sampleId !== null || [p.box, p.tag, p.paper, ...p.pads].some(x => x.holder !== 'OWNER' || x.location !== 'A')) return '须把空原匣、原牌、原纸及全部原衬片亲交艾达。';
  if (p.samples.some(x => x.id === 'CB3-LIVE-1' ? x.holder !== 'RECIPIENT' || x.location !== 'B' || x.care !== 'RECIPIENT_CARE' : x.holder !== 'OWNER' || x.location !== 'A' || x.care !== 'OWNER_CARE')) return '须把每份原样亲交回当前照料人，不能复制或远程交还。';
  return l.rootPad.location !== 'START' || l.rootPad.holder !== l.rootPad.owner ? '唯一根纤维衬垫须随实际持有人回到门口。' : null;
}
export const hasBarrenMatriarchLifeLock = (s: SliceState): boolean => open(s.barrenMatriarch.life);
export const barrenMatriarchInside = hasBarrenMatriarchLifeLock;
export const barrenMatriarchLifeClosed = (s: SliceState): boolean => !open(s.barrenMatriarch.life) && !!s.barrenMatriarch.life.source && Object.values(s.barrenMatriarch.life.cases).every(r => r.status === 'RESOLVED') && !cleanupBlock(s.barrenMatriarch.life, site(s));
export function validateBarrenMatriarchActivityCommand(v: unknown): v is BarrenMatriarchActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT' || v.type === 'BUY_ROOT_PAD') return shape(v, ['type']);
  if (!BARREN_MATRIARCH_CASE_IDS.includes(v.caseId as BarrenMatriarchCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['START', 'A', 'B'].includes(String(v.to));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isBarrenMatriarchActivityCommand = validateBarrenMatriarchActivityCommand;
export const isBarrenMatriarchActivity = validateBarrenMatriarchActivityCommand;
function localBlock(l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot, c: BarrenMatriarchActivityCommand, week: number): string | null {
  if (c.type === 'BUY_ROOT_PAD') return !open(l) && !cleanupBlock(l, p) && same(l.rootPad, freshPad()) ? null : '门口仅有这一片新根纤维衬垫，不能重复购买或恢复磨损。';
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && !cleanupBlock(l, p) && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先完成三案、原物交还和真实报告。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = BARREN_MATRIARCH_CASE_IDS.indexOf(c.caseId), sample = sampleFor(p, c.caseId), origin = originFor(c.caseId), impact = c.caseId === 'finite-root-buffer';
  if (c.type === 'OBSERVE') return !open(l) && !cleanupBlock(l, p) && r.status === 'AVAILABLE' && (index === 0 || l.cases[BARREN_MATRIARCH_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先完成前案并归还实物，再观察同一原苗圃。';
  if (c.type === 'PREPARE') return !open(l) && !cleanupBlock(l, p) && r.status === 'OBSERVED' && !r.attempts.length ? null : '先观察，每案只准备一次，不能重置结果。';
  if (c.type === 'REPORT') return !open(l) && !cleanupBlock(l, p) && r.status === 'EXAMINED' && a?.inspected ? null : '先当面交还原物、核实并普通走回门口。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l, p) ?? (!a.inspected ? '先核实真实收尾。' : c.type === 'WITHDRAW' && !a.stopped ? '先明确停止后续能力。' : null);
  if (a.inspected) return '已经核实，只须结束本案接触。';
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止，仍须普通完成并亲还原物；成本不退。';
  if (c.type === 'WAIT_EFFECT') return l.operation.dormancy || l.operation.buffer ? null : '没有仍生效的有限效果。';
  if (c.type === 'INSPECT') return cleanupBlock(l, p) ?? (!a.transportVerified || !a.sampleReturned || !a.kitReturned ? '先完成普通核实和实物交还。' : null);
  if (c.type === 'WALK') {
    if (route(c.caseId)[a.playerMoves.length] !== c.to) return '须沿本案原路逐段普通步行，不能跳段、绕行刷时或传送。';
    const n = a.playerMoves.length;
    if (n === 0) return null;
    if (c.to === 'START') return a.kitReturned && !l.operation.dormancy && !l.operation.buffer ? null : '先交还原物并结束有限效果。';
    if (!kitHeld(p)) return '须亲持原匣、原纸、原牌和全部原衬片才能走下一段。';
    if (c.caseId === 'bounded-dormancy' && n === 1) return a.originalsChecked && a.ownerConsent !== 'UNASKED' && a.kitTaken ? null : '先核原纸、询问艾达并亲领空匣。';
    if (!a.sampleTaken) return '先核对、询问并亲装同一原样。';
    if ((c.caseId === 'bounded-dormancy' ? n === 3 : n === 2) && (!a.transportVerified || impact && (!a.limitedConfirmed || !a.impact) || c.caseId === 'withdrawn-transfer' && !a.permissionWithdrawn)) return '先核当前许可与实际搬运；原枯样须明确有限结论并完成安全承托。';
    if (c.caseId === 'bounded-dormancy' && n === 4 && !a.sampleReturned) return '先亲交原活苗给莉娜，空匣才能带回艾达处。';
    return null;
  }
  if (c.type === 'CHECK_ORIGINALS') return p.playerLocation === 'A' && p.owner.location === 'A' && !a.originalsChecked ? null : '须亲到艾达旁核对原记录，不能远程读取或改变旧记录。';
  if (c.type === 'CONSENT_OWNER' || c.type === 'DECLINE_PERMISSION') return p.playerLocation === 'A' && a.originalsChecked && a.ownerConsent === 'UNASKED' ? null : '每案重新询问物主，已拒绝后不再索取同意。';
  if (c.type === 'TAKE_KIT') return p.playerLocation === 'A' && a.ownerConsent !== 'UNASKED' && !a.kitTaken && p.box.sampleId === null && [p.box, p.tag, p.paper, ...p.pads].every(x => x.holder === 'OWNER' && x.location === 'A') ? null : '须亲到艾达旁，当前许可确认后领取同一空匣及全部原物。';
  if (c.type === 'CHECK_SAMPLE') return p.playerLocation === origin && a.kitTaken && kitHeld(p) && !a.sampleChecked && sample.location === origin && sample.holder === (origin === 'B' ? 'RECIPIENT' : 'OWNER') && (origin === 'B' ? p.recipient.location === origin : p.owner.location === origin) ? null : '须本人实到原样当前照料人身旁，直接核对活性与存活，不能远处猜测。';
  if (c.type === 'CONSENT_SAMPLE') return p.playerLocation === origin && a.sampleChecked && a.consent === 'UNASKED' ? null : '先当面核原样，再询问本案当前照料许可。';
  if (c.type === 'TAKE_SAMPLE') return p.playerLocation === origin && a.sampleChecked && a.consent !== 'UNASKED' && !a.sampleTaken && kitHeld(p) && p.box.sampleId === null && sample.massGrams <= p.box.maximumMassGrams ? null : '先核原样与本案许可，再把同一原样亲装进容量一件的空匣。';
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'withdrawn-transfer' && p.playerLocation === 'B' && a.sampleTaken && !a.permissionWithdrawn ? null : '须本人携第二株原苗实到莉娜面前，接受本案明确撤回。';
  if (c.type === 'VERIFY_TRANSPORT') return p.playerLocation === (origin === 'A' ? 'B' : 'A') && a.sampleTaken && !a.transportVerified && sample.holder === 'CASE' && kitHeld(p) && (c.caseId !== 'withdrawn-transfer' || a.permissionWithdrawn) ? null : '先实际携同一原样到另一原位；撤回案先停止未用效果，再普通核记录。';
  if (c.type === 'CONFIRM_LIMITED') return impact && p.playerLocation === 'B' && a.transportVerified && !a.limitedConfirmed && !sample.alive && sample.vitality === 0 ? null : '须当面核同一零活性枯样，明确它不能复活且没有新生命。';
  if (c.type === 'ORDINARY_SUPPORT') return impact && p.playerLocation === 'B' && a.limitedConfirmed && !a.impact && sample.holder === 'CASE' && kitHeld(p) ? null : '仅本人亲持原枯样时可普通承托，安全完成而无需施术。';
  if (c.type === 'RETURN_SAMPLE') return p.playerLocation === origin && a.sampleTaken && a.transportVerified && !a.sampleReturned && sample.holder === 'CASE' && p.box.sampleId === sample.id && kitHeld(p) && !l.operation.dormancy && !l.operation.buffer && (impact ? a.limitedConfirmed && !!a.impact : c.caseId !== 'withdrawn-transfer' || a.permissionWithdrawn) ? null : '须亲携同一原样回到原照料人旁，效果结束后当面交还。';
  if (c.type === 'RETURN_KIT') return p.playerLocation === 'A' && a.sampleReturned && !a.kitReturned && p.box.sampleId === null && kitHeld(p) && !l.operation.dormancy && !l.operation.buffer ? null : '先交还原样，再亲把空匣、原纸、原牌和所有原衬片交艾达。';
  if (a.stopped || a.permissionWithdrawn || a.consent !== 'GRANTED' || a.ownerConsent !== 'GRANTED' || a.method !== 'ABILITY') return '没有本案当前能力许可，只可普通核实、承托和亲还原物。';
  if (c.type === 'BOUNDED_DORMANCY') return !impact && p.playerLocation === origin && a.sampleTaken && sample.holder === 'CASE' && sample.care === 'EXPOSED' && sample.alive && sample.vitality > 0 && sample.origin === 'OWNER_GREENHOUSE' && a.dormancyTier === null && !l.operation.dormancy ? null : '只可对眼前同一仍活植物尝试一次六十秒休眠；原枯样不能复活，不能给人施用或增加活性。';
  if (c.type === 'ROOT_BUFFER') return impact && p.playerLocation === 'B' && a.limitedConfirmed && !a.impact && a.bufferTier === null && !l.operation.buffer && l.rootPad.owner === 'PLAYER' && l.rootPad.holder === 'PLAYER' && l.rootPad.location === 'B' && l.rootPad.integrity >= 15 ? null : '须亲持付费根纤维衬垫，只护本人下一次可见轻小冲击，三十秒一次，不能替不在场者承受伤害。';
  if (c.type === 'APPLY_IMPACT') return impact && p.playerLocation === 'B' && a.limitedConfirmed && a.bufferTier !== null && !a.impact && sample.holder === 'CASE' && kitHeld(p) && l.rootPad.owner === 'PLAYER' && l.rootPad.holder === 'PLAYER' && l.rootPad.location === 'B' && l.rootPad.integrity >= 15 ? null : '须本人亲持同一原枯样和有余量的实物衬垫，才能自愿承受一次可见轻小冲击。';
  return '本案不支持此动作。';
}
function commandCost(c: BarrenMatriarchActivityCommand, tier: PublicResolutionTier | null = null, l?: BarrenMatriarchLifeState): BarrenMatriarchLifeCost {
  const cast = c.type === 'BOUNDED_DORMANCY' || c.type === 'ROOT_BUFFER';
  return { actions: cast || ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT', 'BUY_ROOT_PAD'].includes(c.type) ? 1 : 0, spirituality: c.type === 'BOUNDED_DORMANCY' ? 5 : c.type === 'ROOT_BUFFER' ? 6 : 0, mind: cast ? tier !== null && !passed(tier) ? 4 : 2 : 0, pennies: c.type === 'BUY_ROOT_PAD' ? 30 : 0, health: c.type === 'APPLY_IMPACT' ? l?.operation.buffer ? 2 : 5 : 0, cashGained: 0 };
}
const reserve = (c: BarrenMatriarchActivityCommand) => c.type === 'PREPARE' && c.method === 'ABILITY' ? 1 : 0;
function makeSource(s: SliceState): BarrenMatriarchSceneSource { return { root: 'coffinBearer.life', promotionWeek: s.barrenMatriarch.promotionWeek!, introducedWeek: s.week, snapshot: structuredClone(s.coffinBearer.life), rootPad: freshPad() }; }
export function blockBarrenMatriarchLife(s: SliceState, c: BarrenMatriarchActivityCommand): string | null {
  if (!validateBarrenMatriarchActivityCommand(c)) return '荒芜主母生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着且已成为荒芜主母。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件或战斗，并实际回到贝克兰德原苗圃。';
  if (s.barrenMatriarch.preparedWeek !== null || s.barrenMatriarch.encounter.status !== 'AVAILABLE' || s.barrenMatriarch.encounter.preparation) return '先收束晋升准备；遭遇开始后不能重开原案。';
  if (s.barrenMatriarch.life.source === null && !validateBarrenMatriarchSceneSource(makeSource(s), s)) return '须完整保留旧三案、原样与原人，不能另造来源或倒填活性。';
  const reason = localBlock(s.barrenMatriarch.life, site(s), c, s.week); if (reason) return reason;
  const cost = commandCost(c, null, s.barrenMatriarch.life);
  if (s.actionsRemaining < cost.actions + reserve(c)) return '须预留准备及施术行动；已开现场的真实步行、等待和普通收尾仍零行动。';
  if (s.cash < cost.pennies) return '唯一新根纤维衬垫须实付30便士；仍可普通完成。';
  if (s.spirituality < cost.spirituality || s.mind < (cost.spirituality ? 4 : 0)) return '须能支付灵性及失败精神成本；可改为普通收尾。';
  if (cost.health && s.health <= 5) return '当前身体不能安全承受冲击，须普通承托。';
  return null;
}
export const barrenMatriarchActivityReason = blockBarrenMatriarchLife;
export function advanceBarrenMatriarchLifeClock(l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot, seconds: number, a: BarrenMatriarchAttempt | null = current(l), walking = false): void {
  if (!integer(seconds) || !Number.isSafeInteger(p.clockSeconds + seconds)) throw new Error('实际经过的秒数无效。');
  for (let n = 0; n < seconds; n++) {
    const sample = a ? p.samples.find(x => x.id === a.sampleId)! : null;
    if (a && sample?.alive && sample.care === 'EXPOSED' && sample.vitality > 0) {
      const protectedNow = l.operation.dormancy?.sampleId === sample.id && p.clockSeconds < l.operation.dormancy.expiresAt;
      if (protectedNow) { a.protectedExposureSeconds++; a.protectedRemainderSeconds++; if (walking) a.protectedTravelSeconds++; }
      else { a.ordinaryExposureSeconds++; a.ordinaryRemainderSeconds++; }
      if (protectedNow ? a.protectedRemainderSeconds >= 20 : a.ordinaryRemainderSeconds >= 10) {
        sample.vitality--; a.vitalityLost++; if (protectedNow) a.protectedRemainderSeconds = 0; else a.ordinaryRemainderSeconds = 0;
        if (sample.vitality === 0) sample.alive = false;
      }
    }
    p.clockSeconds++; if (a) a.elapsedSeconds++;
    if (l.operation.dormancy && p.clockSeconds >= l.operation.dormancy.expiresAt) { l.operation.dormancy = null; if (a) { a.effectExpired = true; a.ordinaryRemainderSeconds = 0; a.protectedRemainderSeconds = 0; } }
    if (l.operation.buffer && p.clockSeconds >= l.operation.buffer.expiresAt) { l.operation.buffer = null; if (a) a.effectExpired = true; }
  }
}
const elapse = advanceBarrenMatriarchLifeClock;
export function advanceBarrenMatriarchLifeTime(s: SliceState, seconds: number): void { elapse(s.barrenMatriarch.life, site(s), seconds); }
function freshAttempt(week: number, date: PublicGameDate, id: BarrenMatriarchCaseId, method: 'ABILITY' | 'ORDINARY'): BarrenMatriarchAttempt { return { week, date: structuredClone(date), method, sampleId: sampleId(id), consent: 'UNASKED', ownerConsent: 'UNASKED', closed: false, stopped: false, permissionWithdrawn: false, originalsChecked: false, kitTaken: false, sampleChecked: false, checkedAlive: null, checkedVitality: null, sampleTaken: false, transportVerified: false, limitedConfirmed: false, sampleReturned: false, kitReturned: false, inspected: false, dormancyTier: null, bufferTier: null, impact: null, effectExpired: false, effectStopped: false, result: 'NONE', elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, healthLost: 0, waitedSeconds: 0, ordinaryExposureSeconds: 0, protectedExposureSeconds: 0, protectedTravelSeconds: 0, ordinaryRemainderSeconds: 0, protectedRemainderSeconds: 0, vitalityLost: 0, appliedAbilityIds: [], playerMoves: [], evidence: [] }; }
function checkSource(l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot, c: BarrenMatriarchActivityCommand, baseAbility: number, name: string, gender: string): BarrenMatriarchCheckSource | null {
  if (c.type !== 'BOUNDED_DORMANCY' && c.type !== 'ROOT_BUFFER') return null;
  const dormancy = c.type === 'BOUNDED_DORMANCY';
  return { caseId: c.caseId, abilityId: dormancy ? DORMANCY : BUFFER, cost: dormancy ? 5 : 6, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'mother', sequence: 2, name, gender }, at: p.clockSeconds, actorLocation: p.playerLocation, currentConsent: 'GRANTED', sample: structuredClone(sampleFor(p, c.caseId)), rootPad: dormancy ? null : structuredClone(l.rootPad), target: dormancy ? 'LIVING_PLANT' : 'PLAYER', maximumSeconds: dormancy ? 60 : 30 };
}
function stopEffects(l: BarrenMatriarchLifeState, a: BarrenMatriarchAttempt): void { if (l.operation.dormancy || l.operation.buffer) a.effectStopped = true; if (l.operation.dormancy) { a.ordinaryRemainderSeconds = 0; a.protectedRemainderSeconds = 0; } l.operation.dormancy = null; l.operation.buffer = null; }
function move(l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot, a: BarrenMatriarchAttempt, to: BarrenMatriarchLocation): void {
  const from = p.playerLocation, items = [p.box, p.tag, p.paper, ...p.pads].filter(x => x.holder === 'PLAYER'), carried = p.samples.filter(x => x.holder === 'CASE' && p.box.holder === 'PLAYER' && p.box.sampleId === x.id);
  a.playerMoves.push({ from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: [...items.map(x => x.id), ...carried.map(x => x.id), ...(l.rootPad.holder === 'PLAYER' ? [l.rootPad.id] : [])] });
  for (const item of [...items, ...carried]) item.location = to;
  if (l.rootPad.holder === 'PLAYER') l.rootPad.location = to;
  p.playerLocation = to; p.playerTravelMetres += 4; a.playerTravelMetres += 4; elapse(l, p, 4, a, true);
}
function evolve(l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot, c: BarrenMatriarchActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, source: BarrenMatriarchSceneSource | null): void {
  if (l.source === null) { if (!source) throw new Error('缺少同一原苗圃的完整交接。'); l.source = structuredClone(source); }
  if (c.type === 'BUY_ROOT_PAD') { l.rootPad.owner = 'PLAYER'; l.rootPad.holder = 'PLAYER'; l.rootPad.acquiredWeek = week; elapse(l, p, 2); return; }
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, p, 6); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, p, 4); return; }
  if (c.type === 'PREPARE') { const a = freshAttempt(week, date, c.caseId, c.method); r.attempts.push(a); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId; elapse(l, p, 2, a); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, p, 4); return; }
  const a = r.attempts.at(-1)!, sample = sampleFor(p, c.caseId);
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent === 'GRANTED') a.consent = 'CLOSED'; if (a.ownerConsent === 'GRANTED') a.ownerConsent = 'CLOSED'; p.owner.consent = 'RECORD_ONLY'; p.recipient.consent = 'RECORD_ONLY'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, p, 2, a); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': move(l, p, a, c.to); break;
    case 'CHECK_ORIGINALS': a.originalsChecked = true; p.paper.readings++; a.evidence.push('当面核同一原纸与物主艾达；两位成年照料员始终独立，旧记录和原物来源不改写。'); elapse(l, p, 2, a); break;
    case 'CONSENT_OWNER': a.ownerConsent = 'GRANTED'; p.owner.consent = 'GRANTED'; a.evidence.push('艾达对本案有限搬运与自愿演练重新明确许可；这不是对任何人治疗或控制的许可。'); elapse(l, p, 1, a); break;
    case 'DECLINE_PERMISSION': a.ownerConsent = 'DECLINED'; p.owner.consent = 'RECORD_ONLY'; a.evidence.push('接受物主本次能力参与的拒绝，仍可普通核样并安全归还，不再次索取同意。'); elapse(l, p, 1, a); break;
    case 'TAKE_KIT': for (const x of [p.box, p.tag, p.paper, ...p.pads]) x.holder = 'PLAYER'; a.kitTaken = true; elapse(l, p, 1, a); break;
    case 'CHECK_SAMPLE': a.sampleChecked = true; a.checkedAlive = sample.alive; a.checkedVitality = sample.vitality; a.evidence.push(`本人在原样当前照料人旁确认原样${sample.massGrams}克、活性${sample.vitality}，${sample.alive ? '仍存活' : '已经死亡'}；没有增加活性或更换原样。`); elapse(l, p, 2, a); break;
    case 'CONSENT_SAMPLE': a.consent = a.ownerConsent === 'GRANTED' ? 'GRANTED' : 'DECLINED'; if (c.caseId === 'bounded-dormancy') p.recipient.consent = a.consent === 'GRANTED' ? 'GRANTED' : 'RECORD_ONLY'; a.evidence.push('当面确认当前照料人对本案搬运的选择；不复用上一案同意，普通照料仍可完成。'); elapse(l, p, 1, a); break;
    case 'TAKE_SAMPLE': a.sampleTaken = true; r.status = 'ACTIVE'; sample.holder = 'CASE'; sample.care = 'EXPOSED'; sample.handovers++; p.box.sampleId = sample.id; elapse(l, p, 1, a); break;
    case 'BOUNDED_DORMANCY': a.dormancyTier = tier; a.spiritualitySpent += 5; a.mindSpent += passed(tier) ? 2 : 4; elapse(l, p, 1, a); if (passed(tier)) { l.operation.dormancy = { abilityId: DORMANCY, sampleId: sample.id, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 60, sourceCaseId: c.caseId }; a.ordinaryRemainderSeconds = 0; a.protectedRemainderSeconds = 0; } a.evidence.push(passed(tier) ? '同一仍活植物进入最多六十秒有限休眠，暴露损耗由十秒一点减为二十秒一点；醒来不补活性，不治病或复活。' : '休眠未成，五灵性及失败精神成本照付；只能继续普通搬运与照料。'); break;
    case 'WITHDRAW_PERMISSION': a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.recipient.consent = 'REVOKED'; stopEffects(l, a); a.evidence.push('莉娜明确撤回第二株的接收与能力许可，立即结束未用休眠并停止新施术；已付成本、步行和活性损失保留。'); elapse(l, p, 1, a); break;
    case 'VERIFY_TRANSPORT': a.transportVerified = true; a.evidence.push('本人真实携同一原样到另一原位，用同一原纸普通核验十二秒；原匣只装这一份样本，两位照料员没有被移动或受伤。'); elapse(l, p, 12, a); break;
    case 'CONFIRM_LIMITED': a.limitedConfirmed = true; a.evidence.push('同一原枯样仍为零活性且已经死亡；休眠不能复活。接下来的衬垫只缓冲本人可见冲击，不治疗枯样或他人。'); elapse(l, p, 1, a); break;
    case 'ROOT_BUFFER': a.bufferTier = tier; a.spiritualitySpent += 6; a.mindSpent += passed(tier) ? 2 : 4; elapse(l, p, 1, a); if (passed(tier)) l.operation.buffer = { abilityId: BUFFER, actor: 'PLAYER', target: 'PLAYER', padId: l.rootPad.id, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 30, remainingUses: 1, sourceCaseId: 'finite-root-buffer' }; a.evidence.push(passed(tier) ? '仅以亲持的同一付费根纤维衬垫护持自己，三十秒内下一次可见轻小冲击有效，不能替缺席的人承伤或无条件免疫。' : '根纤维护持未成，六灵性与失败精神成本保留；仍可普通承托而不受伤。'); break;
    case 'APPLY_IMPACT': case 'ORDINARY_SUPPORT': {
      const ordinary = c.type === 'ORDINARY_SUPPORT', buffered = !ordinary && !!l.operation.buffer, healthLoss = ordinary ? 0 : buffered ? 2 : 5;
      a.impact = { actor: 'PLAYER', target: 'PLAYER', objectId: 'CB3-DRY-1', massGrams: 100, visible: true, at: p.clockSeconds, mode: ordinary ? 'ORDINARY_SUPPORT' : 'IMPACT', baseHealthLoss: 5, healthLoss, padWear: ordinary ? 0 : 15, bufferApplied: buffered };
      if (buffered) a.appliedAbilityIds.push(BUFFER); a.healthLost += healthLoss; if (!ordinary) l.rootPad.integrity -= 15; else stopEffects(l, a); l.operation.buffer = null;
      a.evidence.push(ordinary ? '本人普通承托同一百克原枯样，安全放回原匣；无冲击、伤害、磨损或能力掌握。' : `本人让同一百克原枯样与亲持衬垫发生一次可见轻小冲击后放回原匣；自己实损${healthLoss}健康，唯一根纤维衬垫磨损十五，两位照料员未受伤。`); elapse(l, p, 1, a); break;
    }
    case 'RETURN_SAMPLE': {
      sample.holder = c.caseId === 'bounded-dormancy' ? 'RECIPIENT' : 'OWNER'; sample.care = c.caseId === 'bounded-dormancy' ? 'RECIPIENT_CARE' : 'OWNER_CARE'; sample.returns++; p.box.sampleId = null; a.sampleReturned = true;
      if (c.caseId === 'bounded-dormancy' && !a.permissionWithdrawn && passed(a.dormancyTier) && a.protectedTravelSeconds > 0 && Math.floor((a.ordinaryExposureSeconds + a.protectedExposureSeconds) / 10) > a.vitalityLost) a.appliedAbilityIds.push(DORMANCY);
      a.evidence.push(`亲交同一原样回原照料人，当前活性${sample.vitality}；醒来没有补回损失，原枯样仍未复活。`); elapse(l, p, 1, a); break;
    }
    case 'RETURN_KIT': for (const x of [p.box, p.tag, p.paper, ...p.pads]) { x.holder = 'OWNER'; x.location = 'A'; } p.box.returns++; p.tag.returns++; a.kitReturned = true; p.paper.records.push(`原样${sample.id}：本次核得活性${a.checkedVitality}，交还活性${sample.vitality}；实际普通暴露${a.ordinaryExposureSeconds}秒、休眠暴露${a.protectedExposureSeconds}秒，步行${a.playerTravelMetres}米。原样和原物当面归还；无治疗或复活。`); a.evidence.push('本人把唯一空匣、原纸、原牌及用过和未用的全部旧衬片亲交艾达；新衬垫不补发，旧护腕不翻新，旧案记录保留。'); elapse(l, p, 2, a); break;
    case 'WAIT_EFFECT': { const seconds = Math.max(l.operation.dormancy?.expiresAt ?? p.clockSeconds, l.operation.buffer?.expiresAt ?? p.clockSeconds) - p.clockSeconds; a.waitedSeconds += seconds; elapse(l, p, seconds, a); a.evidence.push(`实际等待剩余${seconds}秒，有限效果到期；没有返还成本或增加活性。`); break; }
    case 'STOP': a.stopped = true; stopEffects(l, a); a.evidence.push('停止后续施术及未用效果；不退成本、不补活性，仍须亲携原物普通归还。'); elapse(l, p, 1, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, p, 2, a); break;
  }
}
export function applyBarrenMatriarchActivity(s: SliceState, c: BarrenMatriarchActivityCommand, ctx: SeerContext): void {
  const reason = blockBarrenMatriarchLife(s, c); if (reason) throw new Error(reason);
  const l = s.barrenMatriarch.life, p = site(s), source = checkSource(l, p, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), inheritedScene = l.source === null ? makeSource(s) : null;
  const clockBefore = p.clockSeconds, padBefore = structuredClone(l.rootPad), randomCursor = s.random.cursor; let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(c, tier, l), budget: BarrenMatriarchLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health - paid.health, mindBefore: s.mind, mindAfter: s.mind - paid.mind };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter; s.health = budget.healthAfter; s.mind = budget.mindAfter;
  evolve(l, p, c, s.week, s.date, tier, inheritedScene);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, randomCursor, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedScene, clockBefore, clockAfter: p.clockSeconds, padBefore, padAfter: structuredClone(l.rootPad), paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`原苗圃：${LABELS[c.type]}`, `${tier ? `检定${TIERS[tier]}。` : ''}本人在${LOCATIONS[p.playerLocation]}，原苗圃时钟${p.clockSeconds}秒。同一原物、实付成本和已发生损耗继续保留。`);
}
export const executeBarrenMatriarchActivity = applyBarrenMatriarchActivity;
const LOCATIONS = { START: '门口', A: '艾达原位', B: '莉娜原位', OUTSIDE: '院外安全处', SUPPLIER: '供应处' };
const TIERS = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<BarrenMatriarchActivityCommand['type'], string> = { OBSERVE: '观察同一原苗圃', PREPARE: '准备本案', WALK: '普通步行', CHECK_ORIGINALS: '当面核原记录', CONSENT_OWNER: '询问艾达本案许可', DECLINE_PERMISSION: '接受本案能力拒绝', TAKE_KIT: '亲领原匣和原物', CHECK_SAMPLE: '亲核同一原样', CONSENT_SAMPLE: '询问当前照料许可', TAKE_SAMPLE: '亲装同一原样', BOUNDED_DORMANCY: '尝试有限植物休眠', WITHDRAW_PERMISSION: '接受莉娜本案撤回', VERIFY_TRANSPORT: '普通核验真实搬运', CONFIRM_LIMITED: '确认原枯样不能复活', ROOT_BUFFER: '护持自己下一次冲击', APPLY_IMPACT: '自己承受一次轻小冲击', ORDINARY_SUPPORT: '普通承托安全放回', RETURN_SAMPLE: '亲交原样回照料人', RETURN_KIT: '当面交还原匣和原物', WAIT_EFFECT: '实际等候效果到期', STOP: '停止后续施术', INSPECT: '核实真实收尾', LEAVE: '结束本案接触', CLOSE: '结束本案接触', WITHDRAW: '停止后结束接触', REPORT: '报告本案实际结果', REFLECT: '反思三案有限边界', BUY_ROOT_PAD: '购买唯一根纤维衬垫' };
export const BARREN_MATRIARCH_LIFE_STORY = '回到同一原苗圃，保留两位成年照料员、三份原样、旧记录和实物。有限休眠只能减慢仍活植物的一次暴露损耗，醒来不增加活性；付费根纤维衬垫只缓冲自己下一次可见物理冲击。两种技巧都不能治百病、创造生命、造魂或复活。';
export const BARREN_MATRIARCH_LIFE_ENVIRONMENT = '门口至艾达、艾达至莉娜每段四米，普通步行四秒。原匣容量一件、上限一千克。原活样普通暴露每十秒失一点活性，成功休眠最多六十秒、每二十秒失一点；停止或到期转回普通计数，不返还已损活性。两种能力均知识二十，分别五或六灵性、一行动，成功二精神、失败四精神。根纤维衬垫三十便士、一行动，只此一片，完整度六十五，每次实际冲击磨损十五；三十秒护持将本人本次五健康损失减为二。普通承托无伤害、无能力掌握。';
const CASES: { id: BarrenMatriarchCaseId; title: string; story: string }[] = [
  { id: 'bounded-dormancy', title: '原活苗的有限休眠与真实往返', story: '先到艾达处核原纸和本案许可，再实到莉娜旁亲核同一株原活苗。本人装匣，短暂休眠或普通搬运至艾达旁核验，实际原路带回莉娜；生命没有增加。' },
  { id: 'withdrawn-transfer', title: '撤回后普通亲还第二株', story: '同一第二株仍由艾达照料。不能复用前案许可；本人带到莉娜旁时她撤回接收与能力许可。停止未用效果，再普通亲携回艾达，不倒退成本、时间或损耗。' },
  { id: 'finite-root-buffer', title: '不复活原枯样，只缓冲自身冲击', story: '同一零活性原枯样仍已死亡。本人实际核样、携行与记录，明确休眠不能复活。可用唯一付费根纤维衬垫护持自己一次轻小冲击，也可普通承托安全完成；无人替你承伤。' },
];
function preferred(s: SliceState, actions: BarrenMatriarchLifeAction[]): BarrenMatriarchLifeAction | undefined {
  const l = s.barrenMatriarch.life, p = site(s), a = current(l), enabled = actions.filter(x => x.enabled), pick = (type: BarrenMatriarchActivityCommand['type']) => enabled.find(x => x.command.type === type), walk = () => pick('WALK');
  if (!a) return pick('OBSERVE') ?? (l.cases['finite-root-buffer'].status === 'OBSERVED' && l.rootPad.owner !== 'PLAYER' ? pick('BUY_ROOT_PAD') : undefined) ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === (l.cases['withdrawn-transfer'].status === 'OBSERVED' ? 'ORDINARY' : 'ABILITY')) ?? pick('PREPARE') ?? pick('REPORT') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (p.playerLocation === 'START') return pick('INSPECT') ?? walk();
  if (!a.kitTaken) return pick('CHECK_ORIGINALS') ?? pick('CONSENT_OWNER') ?? pick('TAKE_KIT');
  if (!a.sampleTaken) return pick('CHECK_SAMPLE') ?? pick('CONSENT_SAMPLE') ?? pick('TAKE_SAMPLE') ?? walk();
  if (!a.transportVerified) return pick('WITHDRAW_PERMISSION') ?? pick('BOUNDED_DORMANCY') ?? pick('VERIFY_TRANSPORT') ?? walk();
  if (l.activeCase === 'finite-root-buffer' && !a.impact) return pick('CONFIRM_LIMITED') ?? pick('ROOT_BUFFER') ?? (l.operation.buffer ? pick('APPLY_IMPACT') : undefined) ?? pick('ORDINARY_SUPPORT');
  if (!a.sampleReturned) return (l.operation.dormancy || l.operation.buffer ? pick('STOP') : undefined) ?? pick('RETURN_SAMPLE') ?? walk();
  return pick('RETURN_KIT') ?? walk();
}
export function barrenMatriarchLifeActions(s: SliceState): BarrenMatriarchLifeAction[] {
  if (!promoted(s) || s.barrenMatriarch.encounter.status !== 'AVAILABLE' || s.barrenMatriarch.encounter.preparation) return [];
  const l = s.barrenMatriarch.life, p = site(s), out: BarrenMatriarchLifeAction[] = [], id = l.activeCase ?? BARREN_MATRIARCH_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: BarrenMatriarchActivityCommand) => { const reason = blockBarrenMatriarchLife(s, command), cost = commandCost(command, null, l), values = [`${cost.actions}行动`]; if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', '知识20'); if (cost.pennies) values.push(`${cost.pennies}便士`); if (command.type === 'APPLY_IMPACT') values.push(`本人${cost.health}健康`, '衬垫15完整度'); if (command.type === 'WAIT_EFFECT') values.push(`${Math.max(l.operation.dormancy?.expiresAt ?? p.clockSeconds, l.operation.buffer?.expiresAt ?? p.clockSeconds) - p.clockSeconds}秒`); const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : ''; out.push({ id: `BM2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: LABELS[command.type] + suffix, cost: values.join(' · '), enabled: reason === null, reason, command, cleanup: cost.actions === 0 }); };
  if (!open(l) && l.rootPad.acquiredWeek === null) add({ type: 'BUY_ROOT_PAD' });
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id }); if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); } if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) { for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const c: BarrenMatriarchActivityCommand = { type, caseId: id }; if (!localBlock(l, p, c, s.week)) add(c); } for (const to of ['START', 'A', 'B'] as const) { const c: BarrenMatriarchActivityCommand = { type: 'WALK', caseId: id, to }; if (!localBlock(l, p, c, s.week)) add(c); } }
  return out;
}
function projectAttempt(a: BarrenMatriarchAttempt, l: BarrenMatriarchLifeState, p: BarrenMatriarchSceneRoot): BarrenMatriarchAttemptProjection { const at = current(l) === a ? Math.max(l.operation.dormancy?.expiresAt ?? p.clockSeconds, l.operation.buffer?.expiresAt ?? p.clockSeconds) : p.clockSeconds; return { method: a.method, consent: a.consent, closed: a.closed, stopped: a.stopped, permissionWithdrawn: a.permissionWithdrawn, checkedAlive: a.checkedAlive, checkedVitality: a.checkedVitality, dormancyTier: a.dormancyTier, bufferTier: a.bufferTier, effectRemainingSeconds: at - p.clockSeconds, impact: a.impact ? { at: a.impact.at, mode: a.impact.mode, healthLoss: a.impact.healthLoss, padWear: a.impact.padWear, bufferApplied: a.impact.bufferApplied } : null, sampleReturned: a.sampleReturned, kitReturned: a.kitReturned, result: a.result, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres, spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, healthLost: a.healthLost, vitalityLost: a.vitalityLost, protectedTravelSeconds: a.protectedTravelSeconds, evidence: [...a.evidence] }; }
export function projectBarrenMatriarchLife(s: SliceState): BarrenMatriarchLifeProjection {
  const l = s.barrenMatriarch.life, p = site(s), a = current(l), actions = barrenMatriarchLifeActions(s), next = preferred(s, actions), pad = l.rootPad;
  return { title: '同一原苗圃的有限休眠与根纤维护持', story: BARREN_MATRIARCH_LIFE_STORY, environment: BARREN_MATRIARCH_LIFE_ENVIRONMENT, nextStep: next?.label ?? (l.reflected ? '三案已收束，原样、实付成本和衬垫磨损保留。' : '先支付必要成本或完成普通收尾。'), preferredActionId: next?.id ?? null, facts: [`艾达仍为46岁，莉娜39岁；两人健康与精神均100，仍有独立意愿。`, `本人累计普通步行${p.playerTravelMetres}米，原苗圃时钟${p.clockSeconds}秒。`, `唯一根纤维衬垫完整度${pad.integrity}/65，${pad.owner === 'PLAYER' ? '本人已实付购买' : '仍为门口供应库存'}，不会免费补发或恢复磨损。`, '原枯样仍是同一零活性死亡样本；有限休眠没有治疗或复活功能，护持不会使缺席的人代为承伤。'], activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: a ? projectAttempt(a, l, p) : null, rootPad: { title: '唯一根纤维衬垫', owner: pad.owner === 'PLAYER' ? '本人' : '供应商', holder: pad.holder === 'PLAYER' ? '本人亲持' : pad.holder === 'SUPPLIER' ? '门口库存' : '地上', location: LOCATIONS[pad.location], integrity: pad.integrity, acquired: pad.acquiredWeek !== null }, site: { title: '原净空苗圃', owner: `艾达·芬恩在${LOCATIONS[p.owner.location]}`, recipient: `莉娜·肖在${LOCATIONS[p.recipient.location]}`, samples: p.samples.map((x, i) => `${i === 0 ? '第一株原活苗' : i === 1 ? '第二株原活苗' : '原枯样'}：${x.massGrams}克，活性${x.vitality}，${x.alive ? '存活' : '已死亡'}，位于${LOCATIONS[x.location]}`), paper: `同一原纸在${LOCATIONS[p.paper.location]}，旧记录保留`, tag: `同一原牌在${LOCATIONS[p.tag.location]}，${p.tag.holder === 'PLAYER' ? '本人亲持' : p.tag.holder === 'OWNER' ? '艾达保管' : '供应商库存'}`, box: `同一原匣在${LOCATIONS[p.box.location]}，容量一件、上限一千克，${p.box.sampleId ? '亲装一份原样' : '空匣'}` }, cases: CASES.map(d => { const r = l.cases[d.id]; return { ...d, observations: r.attempts.flatMap(x => [...x.evidence]), status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限效果实际应用，原样及原物亲自交还。' : '普通安全完成，未实际应用的技巧没有掌握奖励。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(x => projectAttempt(x, l, p)) }; }), actions };
}
export function validateBarrenMatriarchSceneSource(v: unknown, s: SliceState): v is BarrenMatriarchSceneSource {
  try {
    if (!record(v) || !shape(v, ['root', 'promotionWeek', 'introducedWeek', 'snapshot', 'rootPad']) || v.root !== 'coffinBearer.life' || v.promotionWeek !== s.barrenMatriarch.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !integer(v.introducedWeek, v.promotionWeek, s.week) || !record(v.snapshot) || !same(v.rootPad, freshPad())) return false;
    const p = v.snapshot as unknown as CoffinBearerLifeState, initial = createCoffinBearerLifeState();
    if (!shape(p, Object.keys(initial)) || p.siteId !== initial.siteId || p.playerLocation !== 'START' || p.owner?.id !== 'CB3-ADA' || p.owner.name !== '艾达·芬恩' || p.owner.age !== 46 || p.owner.location !== 'A' || p.owner.alive !== true || p.owner.independentMind !== true || p.owner.health !== 100 || p.owner.mind !== 100 || !same(p.owner.injuries, []) || p.recipient?.id !== 'CB3-LENA' || p.recipient.name !== '莉娜·肖' || p.recipient.age !== 39 || p.recipient.location !== 'B' || p.recipient.alive !== true || p.recipient.independentMind !== true || p.recipient.health !== 100 || p.recipient.mind !== 100 || !same(p.recipient.injuries, []) || p.paper?.id !== initial.paper.id || p.paper.text !== initial.paper.text || p.box?.id !== 'CB3-CASE' || p.box.maximumMassGrams !== 1000 || p.box.capacity !== 1 || p.box.quantity !== 1 || p.tag?.id !== 'CB3-TAG' || !p.kit.purchased || cleanupBlock(createBarrenMatriarchLifeState(), p as BarrenMatriarchSceneRoot) || p.activeCase !== null || !p.reflected || !Object.values(p.cases).every(r => r.status === 'RESOLVED' && !r.contactOpen && r.returned && r.closes === 1) || !integer(p.clockSeconds) || !integer(p.playerTravelMetres)) return false;
    if (p.samples.length !== 3 || p.samples.some((sample, i) => sample.id !== initial.samples[i]!.id || sample.owner !== 'OWNER' || sample.quantity !== 1 || sample.massGrams !== initial.samples[i]!.massGrams || sample.origin !== initial.samples[i]!.origin || sample.originalAlive !== initial.samples[i]!.originalAlive || sample.originalVitality !== initial.samples[i]!.originalVitality) || p.samples[2]!.alive || p.samples[2]!.vitality !== 0) return false;
    return validateCoffinBearerLifeOriginal({ ...s, week: v.introducedWeek, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, coffinBearer: { ...s.coffinBearer, life: structuredClone(p) } });
  } catch { return false; }
}
function validBudget(b: BarrenMatriarchLifeBudget, cost: BarrenMatriarchLifeCost, c: BarrenMatriarchActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  return b.actionsBefore >= cost.actions + reserve(c) && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.cashAfter === b.cashBefore - cost.pennies && b.healthAfter === b.healthBefore - cost.health && b.mindAfter === b.mindBefore - cost.mind && !(cost.spirituality && b.mindBefore < 4) && !(cost.health && b.healthBefore <= 5);
}
function follows(a: BarrenMatriarchLifeBudget, b: BarrenMatriarchLifeBudget): boolean { return b.actionsBefore === a.actionsAfter && b.spiritualityBefore === a.spiritualityAfter && b.cashBefore === a.cashAfter && b.healthBefore === a.healthAfter && b.mindBefore === a.mindAfter; }
function currentBudget(s: SliceState, b: BarrenMatriarchLifeBudget): boolean { return s.actionsRemaining === b.actionsAfter && s.spirituality === b.spiritualityAfter && s.cash === b.cashAfter && s.health === b.healthAfter && s.mind === b.mindAfter; }
/** Replay derives plant vitality, both clocks, original positions, paid resources and mastery from executed commands. */
function replayLife(s: SliceState): { root: BarrenMatriarchSceneRoot; rootPad: BarrenMatriarchRootPad } | null {
  try {
    const l = s.barrenMatriarch?.life, expected = createBarrenMatriarchLifeState(), promotion = s.barrenMatriarch?.promotionWeek;
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, BARREN_MATRIARCH_CASE_IDS) || !Array.isArray(l.journal) || !l.journal.length || l.journal.length > 250 || !integer(promotion, 1, s.week) || !validateBarrenMatriarchSceneSource(l.source, s)) return null;
    const p = structuredClone(l.source.snapshot) as BarrenMatriarchSceneRoot; let previous: BarrenMatriarchLifeEvent | null = null, lastWeek = promotion, nextCursor = 0, revision = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'randomCursor', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedScene', 'clockBefore', 'clockAfter', 'padBefore', 'padAfter', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateBarrenMatriarchActivityCommand(raw.command)) return null;
      const e = raw as unknown as BarrenMatriarchLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(c, e.tier, expected), b = e.budget;
      if (!integer(e.randomCursor, nextCursor, s.random.cursor) || e.clockBefore !== p.clockSeconds || !same(e.padBefore, expected.rootPad)) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1 && e.week === previous.week && previous.budget.actionsAfter > 0) && e.randomCursor !== (previous.randomAfter ?? previous.randomCursor)) return null;
      const acquisition = s.barrenMatriarch.acquisitionJournal.at(-1); if (!previous && acquisition && e.revision === acquisition.revision + 1 && e.week === acquisition.week && acquisition.after.actions > 0 && (e.randomCursor !== acquisition.randomAfter || b.actionsBefore !== acquisition.after.actions || b.healthBefore !== acquisition.after.health || b.mindBefore !== acquisition.after.mind || b.spiritualityBefore !== acquisition.after.spirituality || b.cashBefore !== acquisition.after.cash)) return null;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date)) || localBlock(expected, p, c, e.week) || !same(e.paid, cost) || !validBudget(b, cost, c)) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1 && previous.budget.actionsAfter > 0) && !follows(previous.budget, b)) return null;
      const handoff = expected.source === null ? l.source : null;
      if (!same(e.inheritedScene, handoff) || handoff && (e.week !== handoff.introducedWeek || !same(p, handoff.snapshot))) return null;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source !== null && base > s.character.coreStats.knowledge) return null;
      const source = checkSource(expected, p, c, base, s.character.name, s.character.gender); if (!same(e.source, source)) return null;
      if (source) {
        if (!['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.randomBefore !== e.randomCursor || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) }); if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return null; nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return null;
      evolve(expected, p, c, e.week, e.date, e.tier, handoff); if (e.clockAfter !== p.clockSeconds || !same(e.padAfter, expected.rootPad)) return null; expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same({ ...l, rootPad: expected.rootPad }, expected)) return null;
    if (!s.barrenMatriarch.encounter.preparation && !same(l.rootPad, expected.rootPad)) return null;
    if (open(l)) { if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.barrenMatriarch.encounter.status !== 'AVAILABLE' || s.barrenMatriarch.encounter.preparation || current(l)?.week !== s.week || !previous || !same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !currentBudget(s, previous.budget)) return null; }
    if (previous && s.revision === previous.revision + 1 && s.week === previous.week && previous.budget.actionsAfter > 0 && (!same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !currentBudget(s, previous.budget))) return null;
    if (promoted(s)) { const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED'), lifeMastery = s.barrenMatriarch.encounter.preparation?.before.mastery ?? s.progression.mastery; for (const id of [DORMANCY, BUFFER]) if ((lifeMastery[id] ?? 0) !== reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0)) return null; if (s.progression.acting !== reported.length * 25 + Number(l.reflected) * 25) return null; }
    return { root: p, rootPad: structuredClone(expected.rootPad) };
  } catch { return null; }
}
export function replayBarrenMatriarchLifeRoot(s: SliceState): BarrenMatriarchSceneRoot | null { return replayLife(s)?.root ?? null; }
export function replayBarrenMatriarchLifeRootPad(s: SliceState): BarrenMatriarchRootPad | null { return replayLife(s)?.rootPad ?? null; }
export function validateBarrenMatriarchLifeState(s: SliceState): boolean {
  try { const l = s.barrenMatriarch?.life; if (l?.source === null) return same(l, createBarrenMatriarchLifeState()); const replay = replayLife(s); if (!replay) return false; if (!s.barrenMatriarch.encounter.preparation) return same(site(s), replay.root) && same(l.rootPad, replay.rootPad); if (open(l) || !l.reflected || cleanupBlock({ ...l, rootPad: replay.rootPad }, replay.root) || !Object.values(l.cases).every(r => r.status === 'RESOLVED')) return false; const actual = replayBarrenMatriarchEncounterRoot(s, replay.root), pad = replayBarrenMatriarchEncounterRootPad(s, replay.rootPad); return !!actual && !!pad && same(actual, site(s)) && same(pad, l.rootPad); } catch { return false; }
}
export const validateBarrenMatriarchLife = validateBarrenMatriarchLifeState;
export const validateBarrenMatriarchLifeOriginal = validateBarrenMatriarchLifeState;
export function reconstructBarrenMatriarchOriginalRoot(s: SliceState): CoffinBearerLifeState | null { if (!s.barrenMatriarch || !validateBarrenMatriarchLifeState(s)) return null; return structuredClone(s.barrenMatriarch.life.source?.snapshot ?? s.coffinBearer.life); }
export function validateBarrenMatriarchSourceCoffinBearerLife(s: SliceState): boolean {
  try { if (s.barrenMatriarch?.life.source === null) return validateCoffinBearerLifeOriginal(s); if (!promoted(s) || s.barrenMatriarch.coffinBearerActingAtPromotion !== 100) return false; const original = reconstructBarrenMatriarchOriginalRoot(s); if (!original) return false; return validateCoffinBearerLifeOriginal({ ...s, activeEvent: null, combat: null, progression: { ...s.progression, sequence: 3, acting: 100 }, coffinBearer: { ...s.coffinBearer, life: original } }); } catch { return false; }
}
