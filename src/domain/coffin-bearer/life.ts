import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasCoffinBearerOldPractice, hasCoffinBearerRitualLock } from './index.js';

export const COFFIN_BEARER_CASE_IDS = ['fresh-transfer', 'withdrawn-transfer', 'dry-record'] as const;
export type CoffinBearerCaseId = typeof COFFIN_BEARER_CASE_IDS[number];
export type CoffinBearerLocation = 'START' | 'A' | 'B';
export type CoffinBearerSampleId = 'CB3-LIVE-1' | 'CB3-LIVE-2' | 'CB3-DRY-1';
export type CoffinBearerConsent = 'UNASKED' | 'GRANTED' | 'REVOKED' | 'RECORD_ONLY';
type SceneType = 'GO_A' | 'TAKE_KIT' | 'CHECK_SAMPLE' | 'PERFORM' | 'ORDINARY_CHECK' | 'WAIT_WINDOW' | 'STOP_EFFECT' | 'TAKE_SAMPLE' | 'CARRY_B' | 'OFFER_SAMPLE' | 'HAND_OVER' | 'RETURN_A' | 'RETURN_SAMPLE' | 'RETURN_KIT' | 'RECORD_OUTCOME' | 'RETURN_START';
export type CoffinBearerActivityCommand =
  | { type: 'BUY_KIT' | 'PREPARE_GUARD' | 'REFLECT' }
  | { type: 'OBSERVE' | 'START_CASE' | 'REPORT_CASE' | 'LEAVE_CASE' | 'WITHDRAW' | SceneType; caseId: CoffinBearerCaseId }
  | { type: 'PREPARE'; caseId: CoffinBearerCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONFIRM_LIMITED'; caseId: 'dry-record'; claim: 'LIMITED' | 'REVIVE' };
export interface CoffinBearerMovement { from: CoffinBearerLocation; to: CoffinBearerLocation; mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[] }
export interface CoffinBearerEvidence { sourceId: string; text: string; atSecond: number }
export interface CoffinBearerLifeStep { type: SceneType | 'CONFIRM_LIMITED'; atSecond: number; check: PublicCheckResult | null; claim: 'LIMITED' | 'REVIVE' | null }
export interface CoffinBearerSample {
  id: CoffinBearerSampleId; caseId: CoffinBearerCaseId; owner: 'OWNER'; origin: 'OWNER_GREENHOUSE' | 'OWNER_NATURALLY_WITHERED'; quantity: 1; massGrams: 500 | 100;
  originalAlive: boolean; originalVitality: 50 | 0; alive: boolean; vitality: number; maximumVitality: 100;
  holder: 'OWNER' | 'CASE' | 'RECIPIENT'; location: 'A' | 'B'; care: 'OWNER_CARE' | 'EXPOSED' | 'RECIPIENT_CARE'; handovers: number; returns: number;
}
export interface CoffinBearerGuard {
  id: 'CB3-GUARD'; sourceId: 'CB3-GUARD-MATERIAL'; prepared: boolean; owner: 'SUPPLIER' | 'PLAYER'; location: 'SUPPLIER' | 'HAND'; preparedWeek: number | null;
  actionsSpent: 0 | 1; costPence: 0 | 120; spiritualitySpent: 0 | 4;
  segments: { id: 'CB3-SEG1' | 'CB3-SEG2' | 'CB3-SEG3'; status: 'RAW' | 'UNUSED' | 'SPENT' }[];
}
export interface CoffinBearerAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; sampleId: CoffinBearerSampleId; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  initialSpirituality: number; initialMind: number; initialKnowledge: number;
  elapsedSeconds: number; playerTravelMetres: number; playerMoves: CoffinBearerMovement[]; objectMoves: CoffinBearerMovement[]; steps: CoffinBearerLifeStep[];
  sampleChecked: boolean; paperRead: boolean; ownerConsent: CoffinBearerConsent; recipientConsent: CoffinBearerConsent; consentWithdrawn: boolean;
  checkedAlive: boolean | null; checkedVitality: number | null; resolutionPaid: boolean; resolutionActions: 0 | 1; spiritualitySpent: 0 | 5; mindSpent: 0 | 2; padId: string | null;
  ordinaryChecked: boolean; abilityCheck: PublicCheckResult | null; abilityTier: PublicResolutionTier | null; abilitySourceId: CoffinBearerSampleId | null; abilityAtSecond: number | null; resolutionAtSecond: number | null;
  effectActive: boolean; remainingSeconds: number; stopped: boolean; effectCancelled: boolean; effectExpired: boolean; ordinaryExposureSeconds: number; protectedExposureSeconds: number;
  ordinaryRemainderSeconds: number; protectedRemainderSeconds: number; vitalityLost: number; waitedSeconds: number; waitCompleted: boolean;
  sampleTaken: boolean; offered: boolean; handedOver: boolean; sampleReturned: boolean; kitReturned: boolean; limitedConfirmed: boolean; rejectedClaims: number;
  evidence: CoffinBearerEvidence[]; outcomeRecorded: boolean; outcome: string | null;
}
export interface CoffinBearerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: CoffinBearerAttempt[];
}
export interface CoffinBearerLifeState {
  siteId: 'CB3-NURSERY-TRANSFER'; introducedWeek: number | null; introducedDate: PublicGameDate | null; activeCase: CoffinBearerCaseId | null;
  playerLocation: CoffinBearerLocation; playerTravelMetres: number; clockSeconds: number; externalSeconds: number;
  owner: { id: 'CB3-ADA'; name: '艾达·芬恩'; age: 46; alive: true; independentMind: true; location: 'A'; health: 100; mind: 100; injuries: []; consent: CoffinBearerConsent };
  recipient: { id: 'CB3-LENA'; name: '莉娜·肖'; age: 39; alive: true; independentMind: true; location: 'B'; health: 100; mind: 100; injuries: []; consent: CoffinBearerConsent };
  samples: CoffinBearerSample[];
  paper: { id: 'CB3-RECORD'; owner: 'OWNER'; holder: 'OWNER'; location: 'A'; sampleIds: CoffinBearerSampleId[]; text: string; readings: number; records: string[] };
  kit: { sourceId: 'CB3-SUPPLIER'; purchased: boolean; purchasedWeek: number | null; actionsSpent: 0 | 1; costPence: 0 | 90 };
  box: { id: 'CB3-CASE'; owner: 'SUPPLIER' | 'PLAYER'; holder: 'SUPPLIER' | 'PLAYER' | 'OWNER'; location: CoffinBearerLocation | 'SUPPLIER'; quantity: 1; maximumMassGrams: 1000; capacity: 1; sampleId: CoffinBearerSampleId | null; returns: number };
  tag: { id: 'CB3-TAG'; owner: 'SUPPLIER' | 'PLAYER'; holder: 'SUPPLIER' | 'PLAYER' | 'OWNER'; location: CoffinBearerLocation | 'SUPPLIER'; quantity: 1; returns: number };
  pads: { id: 'CB3-PAD-1' | 'CB3-PAD-2' | 'CB3-PAD-3'; sourceId: 'CB3-SUPPLIER'; owner: 'SUPPLIER' | 'PLAYER'; holder: 'SUPPLIER' | 'PLAYER' | 'OWNER'; location: CoffinBearerLocation | 'SUPPLIER'; quantity: 1; status: 'UNUSED' | 'SPENT'; caseId: CoffinBearerCaseId | null; spentWeek: number | null }[];
  guard: CoffinBearerGuard; cases: Record<CoffinBearerCaseId, CoffinBearerCaseState>; reflected: boolean;
}
export interface CoffinBearerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CoffinBearerActivityCommand }
export interface CoffinBearerLifeProjection extends Omit<CoffinBearerLifeState, 'cases'> {
  title: string; story: string; summary: string; environment: string; nextStep: string; facts: string[]; inside: boolean; insideCase: boolean; currentAttempt: CoffinBearerAttempt | null;
  cases: { id: CoffinBearerCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: CoffinBearerAttempt[] }[];
  actions: CoffinBearerLifeAction[];
}

const ABILITY = 'mother.s3.finite-preservation' as const;
export const COFFIN_BEARER_LIFE_STORY = '序列3抬棺人的名称与母亲途径序列2荒芜主母、序列1自然行者有原著直接依据；本阶完整配方、晋升仪式和新增通用能力仍未核。以下人物、原样本、保全能力、护腕、全部距离、时间、数值与奖励均为本作原创G。只延缓同一仍活样本的本次暴露损耗，不增加活性、不治病、不改死亡，不造人、造魂、复活或赋予棺材免死。';
export const COFFIN_BEARER_LIFE_ENVIRONMENT = 'G · 净空原苗圃，START至A4米、A至B4米，普通步行每段4秒。46岁艾达在A、39岁莉娜在B各自独立且健康精神100。三份观察、准备、实施、报告各1行动，加反思共13行动；另一次1行动90便士买原匣、牌和三片原衬片。能力实施另5灵性2精神和一片原衬片，知识20四档一次，失败照耗；普通不判定、不耗材料灵性精神。仅当前已核且未交付/交回的原活样每10秒损1活性，成功的60秒内每20秒损1；停止或到期从新的普通10秒计数开始，不返还已失活性。保全、搬运、撤回、实物交回、记录和离场是不同动作，0行动收束仍真实耗时行走。';
const CASES = [
  { id: 'fresh-transfer', title: 'G · 原活苗有限保全与真实交付', story: '艾达的原温室活苗CB3-LIVE-1初始活性50。核当前许可后，只做一次保全或普通记录，实际等满实施完成后的60秒，再装入唯一匣，由本人普通携行到B，询问莉娜本案当前接收许可，当面交付同一株；原匣、牌和全部衬片亲带回A交存。只有真实发生保全且交付才有掌握。' },
  { id: 'withdrawn-transfer', title: 'G · 当前许可撤回后亲带原苗返回', story: '第二株CB3-LIVE-2是不同的原温室活苗，初始活性50。不能沿用前案许可。本人携原苗到B提出交付时，莉娜明确撤回本案接收和保全许可；必须停止未用效果，再亲携同一原苗回A交艾达，不回滚成本、时间和活性，不奖励掌握。' },
  { id: 'dry-record', title: 'G · 同一原枯样与不复活的报告', story: 'CB3-DRY-1在本案前已经自然枯萎，原活性0且死亡。只作普通记录和实际搬运，不允许对它施保全。莉娜在B只核实枯样记录，不接受复活承诺；承认有限结论后，亲携原枯样回A交还。它始终是同一0活性原枯样。' },
] as const;
const SCENES: readonly SceneType[] = ['GO_A', 'TAKE_KIT', 'CHECK_SAMPLE', 'PERFORM', 'ORDINARY_CHECK', 'WAIT_WINDOW', 'STOP_EFFECT', 'TAKE_SAMPLE', 'CARRY_B', 'OFFER_SAMPLE', 'HAND_OVER', 'RETURN_A', 'RETURN_SAMPLE', 'RETURN_KIT', 'RECORD_OUTCOME', 'RETURN_START'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 3;
const sourceFor = (id: CoffinBearerCaseId) => `coffin-bearer-life-${id}`;
const sampleFor = (l: CoffinBearerLifeState, id: CoffinBearerCaseId) => l.samples.find(sample => sample.caseId === id)!;
const freshCase = (): CoffinBearerCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
function freshAttempt(s: SliceState, id: CoffinBearerCaseId, method: 'ABILITY' | 'ORDINARY'): CoffinBearerAttempt {
  return { week: s.week, date: { ...s.date }, method, sampleId: sampleFor(s.coffinBearer.life, id).id, closed: false, result: 'NONE', initialSpirituality: s.spirituality, initialMind: s.mind, initialKnowledge: s.character.coreStats.knowledge,
    elapsedSeconds: 0, playerTravelMetres: 0, playerMoves: [], objectMoves: [], steps: [], sampleChecked: false, paperRead: false, ownerConsent: 'UNASKED', recipientConsent: 'UNASKED', consentWithdrawn: false, checkedAlive: null, checkedVitality: null,
    resolutionPaid: false, resolutionActions: 0, spiritualitySpent: 0, mindSpent: 0, padId: null, ordinaryChecked: false, abilityCheck: null, abilityTier: null, abilitySourceId: null, abilityAtSecond: null, resolutionAtSecond: null,
    effectActive: false, remainingSeconds: 0, stopped: false, effectCancelled: false, effectExpired: false, ordinaryExposureSeconds: 0, protectedExposureSeconds: 0, ordinaryRemainderSeconds: 0, protectedRemainderSeconds: 0, vitalityLost: 0, waitedSeconds: 0, waitCompleted: false,
    sampleTaken: false, offered: false, handedOver: false, sampleReturned: false, kitReturned: false, limitedConfirmed: false, rejectedClaims: 0, evidence: [], outcomeRecorded: false, outcome: null };
}
export function createCoffinBearerLifeState(): CoffinBearerLifeState {
  const samples: CoffinBearerSample[] = COFFIN_BEARER_CASE_IDS.map((caseId, i) => ({ id: i === 0 ? 'CB3-LIVE-1' : i === 1 ? 'CB3-LIVE-2' : 'CB3-DRY-1', caseId, owner: 'OWNER', origin: i < 2 ? 'OWNER_GREENHOUSE' : 'OWNER_NATURALLY_WITHERED', quantity: 1, massGrams: i < 2 ? 500 : 100, originalAlive: i < 2, originalVitality: i < 2 ? 50 : 0, alive: i < 2, vitality: i < 2 ? 50 : 0, maximumVitality: 100, holder: 'OWNER', location: 'A', care: 'OWNER_CARE', handovers: 0, returns: 0 }));
  return { siteId: 'CB3-NURSERY-TRANSFER', introducedWeek: null, introducedDate: null, activeCase: null, playerLocation: 'START', playerTravelMetres: 0, clockSeconds: 0, externalSeconds: 0,
    owner: { id: 'CB3-ADA', name: '艾达·芬恩', age: 46, alive: true, independentMind: true, location: 'A', health: 100, mind: 100, injuries: [], consent: 'UNASKED' },
    recipient: { id: 'CB3-LENA', name: '莉娜·肖', age: 39, alive: true, independentMind: true, location: 'B', health: 100, mind: 100, injuries: [], consent: 'UNASKED' }, samples,
    paper: { id: 'CB3-RECORD', owner: 'OWNER', holder: 'OWNER', location: 'A', sampleIds: ['CB3-LIVE-1', 'CB3-LIVE-2', 'CB3-DRY-1'], text: 'CB3-LIVE-1与CB3-LIVE-2由艾达原温室培养；CB3-DRY-1已自然枯萎。记录观察，不改变生命。', readings: 0, records: [] },
    kit: { sourceId: 'CB3-SUPPLIER', purchased: false, purchasedWeek: null, actionsSpent: 0, costPence: 0 },
    box: { id: 'CB3-CASE', owner: 'SUPPLIER', holder: 'SUPPLIER', location: 'SUPPLIER', quantity: 1, maximumMassGrams: 1000, capacity: 1, sampleId: null, returns: 0 },
    tag: { id: 'CB3-TAG', owner: 'SUPPLIER', holder: 'SUPPLIER', location: 'SUPPLIER', quantity: 1, returns: 0 },
    pads: (['CB3-PAD-1', 'CB3-PAD-2', 'CB3-PAD-3'] as const).map(id => ({ id, sourceId: 'CB3-SUPPLIER', owner: 'SUPPLIER', holder: 'SUPPLIER', location: 'SUPPLIER', quantity: 1, status: 'UNUSED', caseId: null, spentWeek: null })),
    guard: { id: 'CB3-GUARD', sourceId: 'CB3-GUARD-MATERIAL', prepared: false, owner: 'SUPPLIER', location: 'SUPPLIER', preparedWeek: null, actionsSpent: 0, costPence: 0, spiritualitySpent: 0,
      segments: (['CB3-SEG1', 'CB3-SEG2', 'CB3-SEG3'] as const).map(id => ({ id, status: 'RAW' })) },
    cases: { 'fresh-transfer': freshCase(), 'withdrawn-transfer': freshCase(), 'dry-record': freshCase() }, reflected: false };
}
export function getCoffinBearerGuardSegment(s: SliceState): { guardId: string; segmentId: string } | null {
  const g = s.coffinBearer.life.guard, p = g.prepared && g.owner === 'PLAYER' && g.location === 'HAND' ? g.segments.find(part => part.status === 'UNUSED') : undefined;
  return p ? { guardId: g.id, segmentId: p.id } : null;
}
export function consumeCoffinBearerGuardSegment(s: SliceState, guardId: string, segmentId: string): boolean {
  const next = getCoffinBearerGuardSegment(s); if (!next || next.guardId !== guardId || next.segmentId !== segmentId) return false;
  s.coffinBearer.life.guard.segments.find(part => part.id === segmentId)!.status = 'SPENT'; return true;
}
export function validateCoffinBearerActivityCommand(v: unknown): v is CoffinBearerActivityCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['BUY_KIT', 'PREPARE_GUARD', 'REFLECT'].includes(v.type)) return shape(v, ['type']);
  if (!COFFIN_BEARER_CASE_IDS.includes(v.caseId as CoffinBearerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'CONFIRM_LIMITED') return v.caseId === 'dry-record' && shape(v, ['type', 'caseId', 'claim']) && ['LIMITED', 'REVIVE'].includes(String(v.claim));
  if (!shape(v, ['type', 'caseId']) || ['WAIT_WINDOW', 'HAND_OVER'].includes(v.type) && v.caseId !== 'fresh-transfer' || v.type === 'RETURN_SAMPLE' && v.caseId === 'fresh-transfer') return false;
  return ['OBSERVE', 'START_CASE', 'REPORT_CASE', 'LEAVE_CASE', 'WITHDRAW', ...SCENES].includes(v.type);
}
export const currentCoffinBearerAttempt = (s: SliceState) => s.coffinBearer.life.activeCase ? s.coffinBearer.life.cases[s.coffinBearer.life.activeCase].attempts.at(-1) ?? null : null;
function cleanupBlock(s: SliceState): string | null {
  const l = s.coffinBearer.life, a = currentCoffinBearerAttempt(s);
  if (a?.effectActive || (a?.remainingSeconds ?? 0) > 0) return '先停止未用保全或等其实际到期；不能带着未收束效果离场。';
  if (l.playerLocation !== 'START' || l.box.sampleId !== null || l.samples.some(sample => sample.holder === 'CASE' || sample.care === 'EXPOSED')) return '本人须实际交付或交回同一原样本、归还原匣，再普通走回START。';
  if (a && (!a.kitReturned || l.box.holder !== 'OWNER' || l.tag.holder !== 'OWNER' || l.pads.some(p => p.holder !== 'OWNER'))) return '先当面把原匣、原牌和全部原衬片交存艾达，不得离场瞬间归还。';
  return null;
}
export const hasCoffinBearerLifeLock = (s: SliceState): boolean => s.coffinBearer.life.activeCase !== null || Object.values(s.coffinBearer.life.cases).some(r => r.status === 'PREPARED') || cleanupBlock(s) !== null;
function kitHeld(l: CoffinBearerLifeState, at: CoffinBearerLocation) { return l.box.holder === 'PLAYER' && l.box.location === at && l.tag.holder === 'PLAYER' && l.tag.location === at && l.pads.every(p => p.holder === 'PLAYER' && p.location === at); }
function sceneReason(s: SliceState, id: CoffinBearerCaseId, type: SceneType | 'CONFIRM_LIMITED'): string | null {
  const l = s.coffinBearer.life, a = l.cases[id].attempts.at(-1)!, sample = sampleFor(l, id), at = l.playerLocation;
  if (type === 'STOP_EFFECT') return a.resolutionPaid && !a.stopped && !a.handedOver && !a.sampleReturned ? null : '只可停止本次已实施且未交付或交回的方案一次，不移动原物，不退费。';
  if (type === 'RETURN_START') return at === 'A' && a.kitReturned && a.outcomeRecorded && !a.effectActive ? null : '先交存全部原物并如实记录，再由本人空手普通返回START。';
  if (a.outcomeRecorded) return '本案已经如实记录，只可实际离场；不得重做或重抽。';
  if (a.consentWithdrawn && !a.stopped) return '当前接收和保全许可已撤回，必须先STOP_EFFECT清除未用时长。';
  if (type === 'GO_A') return at === 'START' && a.playerMoves.length === 0 ? null : '本人只能从START普通走4米到A一次。';
  if (type === 'TAKE_KIT') return at === 'A' && !a.sampleChecked && l.box.sampleId === null && l.box.holder === 'OWNER' && l.box.location === 'A' && l.tag.holder === 'OWNER' && l.pads.every(p => p.holder === 'OWNER' && p.location === 'A') ? null : '后续案须亲到A，从艾达处领取同一空匣、牌和全部原衬片。';
  if (type === 'CHECK_SAMPLE') return at === 'A' && !a.sampleChecked && kitHeld(l, 'A') && l.box.sampleId === null && sample.holder === 'OWNER' && sample.location === 'A' && sample.care === 'OWNER_CARE' ? null : '本人须在A持唯一空匣，核艾达原样本、原纸和本案当前许可。';
  if (type === 'PERFORM' || type === 'ORDINARY_CHECK') {
    if (!a.sampleChecked || !a.paperRead || a.resolutionPaid || at !== 'A' || sample.holder !== 'OWNER' || !kitHeld(l, 'A')) return '先在A核原样本与本案许可，再实际实施一次；不能重抽、远施或免费重复记录。';
    if (type === 'PERFORM' && (!sample.alive || sample.vitality <= 0 || id === 'dry-record')) return '原枯样不能接受保全；生命与原记录不变，须选择普通记录。';
    if (s.actionsRemaining < 1) return '首次实施需要1行动；后续实际收束不另收行动。';
    if (type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') return null;
    if (a.ownerConsent !== 'GRANTED' || l.owner.consent !== 'GRANTED' || a.consentWithdrawn || a.stopped) return '本次保全没有当前明确许可，只可普通记录。';
    if (!l.pads.some(p => p.status === 'UNUSED' && p.holder === 'PLAYER' && p.location === 'A')) return '须有一片真实未用原衬片；可选择普通记录。';
    return s.spirituality < 5 ? '保全须实付5灵性；可普通记录。' : s.mind < 2 ? '保全须实付2精神；可普通记录。' : null;
  }
  if (type === 'WAIT_WINDOW') return id === 'fresh-transfer' && a.resolutionPaid && !a.waitCompleted && !a.sampleTaken && at === 'A' && a.resolutionAtSecond !== null && a.elapsedSeconds - a.resolutionAtSecond < 60 ? null : '本案只可实际等满实施完成后的60秒一次，不重复刷时间。';
  if (type === 'TAKE_SAMPLE') return a.resolutionPaid && !a.sampleTaken && at === 'A' && sample.holder === 'OWNER' && sample.location === 'A' && kitHeld(l, 'A') && l.box.sampleId === null && sample.massGrams <= l.box.maximumMassGrams && (id !== 'fresh-transfer' || a.waitCompleted) ? null : '须先实施并完成本案等待，再于A把同一原样本放进容量一件的空匣。';
  if (type === 'CARRY_B') return a.sampleTaken && !a.offered && at === 'A' && sample.holder === 'CASE' && sample.location === 'A' && l.box.sampleId === sample.id && kitHeld(l, 'A') ? null : '本人须在A真实持匣与同一原样本，才能普通携行4米4秒到B。';
  if (type === 'OFFER_SAMPLE') return at === 'B' && a.sampleTaken && !a.offered && sample.holder === 'CASE' && sample.location === 'B' && kitHeld(l, 'B') ? null : '本人须亲携同一原样到B，再询问莉娜本案当前接收许可。';
  if (type === 'HAND_OVER') return id === 'fresh-transfer' && at === 'B' && a.offered && !a.handedOver && a.recipientConsent === 'GRANTED' && l.recipient.consent === 'GRANTED' && !a.effectActive && sample.holder === 'CASE' && l.box.sampleId === sample.id && kitHeld(l, 'B') ? null : '须在B获得莉娜本案当前明确许可且效果已结束，再亲交原样，不转交空匣或复制。';
  if (type === 'CONFIRM_LIMITED') return id === 'dry-record' && at === 'B' && a.offered && !a.limitedConfirmed && sample.holder === 'CASE' ? null : '先亲携原枯样到B核记录，再承认本能力不能复活原枯样。';
  if (type === 'RETURN_A') return at === 'B' && a.offered && kitHeld(l, 'B') && (id === 'fresh-transfer' ? a.handedOver : sample.holder === 'CASE' && l.box.sampleId === sample.id && (id !== 'dry-record' || a.limitedConfirmed) && !a.effectActive) ? null : '先处理本案当前许可与有限结论；本人须亲携实际剩余原物普通走回A。';
  if (type === 'RETURN_SAMPLE') return id !== 'fresh-transfer' && at === 'A' && a.offered && !a.sampleReturned && sample.holder === 'CASE' && sample.location === 'A' && l.box.sampleId === sample.id && !a.effectActive && (id !== 'dry-record' || a.limitedConfirmed) ? null : '须亲携同一原样回A，效果已停，才能当面交艾达。';
  if (type === 'RETURN_KIT') return at === 'A' && !a.kitReturned && (a.handedOver || a.sampleReturned) && l.box.sampleId === null && kitHeld(l, 'A') && !a.effectActive ? null : '须先实际交付或交回原样，再把原空匣、牌、用过和未用的原衬片当面交存艾达。';
  if (type === 'RECORD_OUTCOME') return at === 'A' && a.kitReturned && a.resolutionPaid && a.offered && (a.handedOver || a.sampleReturned) && !a.effectActive && (id !== 'dry-record' || a.limitedConfirmed) ? null : '先完成本案原样处置、当前许可和所有原物交存，再在A同一原纸如实记录。';
  return '本案不支持此动作。';
}
export function coffinBearerActivityReason(s: SliceState, c: CoffinBearerActivityCommand): string | null {
  if (!validateCoffinBearerActivityCommand(c)) return '抬棺人命令无效、字段多余或不属于本案。';
  if (!promoted(s)) return '先实际晋升母亲途径抬棺人序列3。';
  if (s.status !== 'ACTIVE' || s.health <= 0) return '本人已死亡或周目结束，不能操作、复活或自动归还。';
  if (s.activeEvent || s.combat || ['READY', 'FIGHTING'].includes(s.coffinBearer.encounter.status)) return '先处理当前事件或战斗，同一本体不能在两处。';
  if (s.world.city !== 'BACKLUND') return '须实际回贝克兰德原苗圃。';
  const l = s.coffinBearer.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只取消尚未START_CASE的准备；已付不退，已开现场必须真实收束。';
  if (c.type === 'LEAVE_CASE') return r?.contactOpen && l.activeCase === c.caseId && r.attempts.at(-1)?.outcomeRecorded ? cleanupBlock(s) : '先真实交物、记录和返回START。';
  if (SCENES.includes(c.type as SceneType) || c.type === 'CONFIRM_LIMITED') return 'caseId' in c && l.activeCase === c.caseId && r?.contactOpen ? sceneReason(s, c.caseId, c.type as SceneType | 'CONFIRM_LIMITED') : '先START_CASE打开实际现场。';
  if (l.activeCase !== null || cleanupBlock(s)) return '先收束当前原样本、效果、原物与实际位置。';
  if (Object.entries(l.cases).some(([id, item]) => item.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消当前准备。';
  if (hasCoffinBearerOldPractice(s) || hasCoffinBearerRitualLock(s)) return '先真实收束旧生活、原物和晋升准备。';
  if (s.mind <= 0 || s.actionsRemaining < 1) return '新行动须有精神和1行动；已付现场真实收束仍0行动。';
  if (c.type === 'BUY_KIT') return l.kit.purchased ? '唯一原匣、牌和三片衬片已买，不复制、不补充。' : s.cash < 90 ? '须实付90便士购买唯一原套件。' : null;
  if (c.type === 'PREPARE_GUARD') return l.guard.prepared ? '唯一三段新护腕已制作，不能翻新或补段。' : s.coffinBearer.encounter.status !== 'AVAILABLE' ? '新护腕须在本次原院遭遇开始前制作，不能改写已经发生的战斗材料来源。' : s.cash < 120 ? '须实付120便士购买本阶新原材料。' : s.spirituality < 4 ? '须实付4灵性，以既有活性基质知识制作。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '反思已完成。' : COFFIN_BEARER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三份真实报告。';
  if (!('caseId' in c) || !r || r.status === 'RESOLVED') return '本案报告已经完成。';
  const index = COFFIN_BEARER_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[COFFIN_BEARER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一份真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '同一原案只观察一次。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本案原人原物和边界。' : !l.kit.purchased ? '先真实购买90便士的唯一原套件。' : s.actionsRemaining < 2 ? '准备需要1行动，并另留1行动实际实施。' : null;
  if (c.type === 'START_CASE') return r.status === 'PREPARED' ? null : '先准备本案。';
  return r.status === 'EXAMINED' && r.attempts.at(-1)?.outcomeRecorded && !r.contactOpen ? null : '须实际完成、交物及退出后才可报告。';
}
export const blockCoffinBearerLife = coffinBearerActivityReason;

/** Combat and ordinary exits add external time only; samples already in care never undergo laboratory exposure again. */
export function advanceCoffinBearerLifeClock(s: SliceState, seconds: number): void {
  const l = s.coffinBearer.life;
  if (!integer(seconds) || !Number.isSafeInteger(l.clockSeconds + seconds) || !Number.isSafeInteger(l.externalSeconds + seconds)) throw new Error('苗圃外部累计时钟无效。');
  if (l.activeCase !== null) throw new Error('本案原样仍在处理，不能并行推进场外战斗时间。');
  l.clockSeconds += seconds; l.externalSeconds += seconds;
}
export const advanceCoffinBearerClock = advanceCoffinBearerLifeClock;
function endEffect(a: CoffinBearerAttempt, expired: boolean) {
  const wasProtected = a.effectActive || a.remainingSeconds > 0;
  a.effectActive = false; a.remainingSeconds = 0;
  if (wasProtected || expired) a.ordinaryRemainderSeconds = 0;
  if (expired) a.effectExpired = true;
}
function elapse(s: SliceState, a: CoffinBearerAttempt, seconds: number) {
  const l = s.coffinBearer.life, sample = sampleFor(l, l.activeCase!);
  a.elapsedSeconds += seconds; l.clockSeconds += seconds;
  for (let i = 0; i < seconds; i++) {
    if (a.sampleChecked && sample.care === 'EXPOSED' && sample.alive) {
      const protectedNow = a.effectActive && a.remainingSeconds > 0 && !a.consentWithdrawn;
      if (protectedNow) { a.protectedExposureSeconds++; a.protectedRemainderSeconds++; }
      else { a.ordinaryExposureSeconds++; a.ordinaryRemainderSeconds++; }
      if (protectedNow ? a.protectedRemainderSeconds === 20 : a.ordinaryRemainderSeconds === 10) {
        if (protectedNow) a.protectedRemainderSeconds = 0; else a.ordinaryRemainderSeconds = 0;
        sample.vitality = Math.max(0, sample.vitality - 1); a.vitalityLost++;
        if (sample.vitality === 0) { sample.alive = false; if (a.effectActive) { a.effectCancelled = true; endEffect(a, false); } }
      }
    }
    if (a.effectActive && a.remainingSeconds > 0) { a.remainingSeconds--; if (a.remainingSeconds === 0) endEffect(a, true); }
  }
}
function playerMove(s: SliceState, a: CoffinBearerAttempt, to: CoffinBearerLocation) {
  const l = s.coffinBearer.life;
  const ids = [...(l.box.holder === 'PLAYER' ? [l.box.id] : []), ...(l.tag.holder === 'PLAYER' ? [l.tag.id] : []), ...l.pads.filter(p => p.holder === 'PLAYER').map(p => p.id), ...(l.box.sampleId ? [l.box.sampleId] : [])];
  const m: CoffinBearerMovement = { from: l.playerLocation, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: ids };
  a.playerMoves.push(m); if (ids.length) a.objectMoves.push(structuredClone(m));
  elapse(s, a, 4); l.playerLocation = to; a.playerTravelMetres += 4; l.playerTravelMetres += 4;
  if (l.box.holder === 'PLAYER') l.box.location = to;
  if (l.tag.holder === 'PLAYER') l.tag.location = to;
  for (const pad of l.pads) if (pad.holder === 'PLAYER') pad.location = to;
  if (l.box.sampleId) l.samples.find(sample => sample.id === l.box.sampleId)!.location = to as 'A' | 'B';
}
function acquireKit(l: CoffinBearerLifeState, week: number) {
  l.kit = { sourceId: 'CB3-SUPPLIER', purchased: true, purchasedWeek: week, actionsSpent: 1, costPence: 90 };
  l.box.owner = 'PLAYER'; l.box.holder = 'PLAYER'; l.box.location = 'START';
  l.tag.owner = 'PLAYER'; l.tag.holder = 'PLAYER'; l.tag.location = 'START';
  for (const pad of l.pads) { pad.owner = 'PLAYER'; pad.holder = 'PLAYER'; pad.location = 'START'; }
}
function prepareGuard(l: CoffinBearerLifeState, week: number) {
  const g = l.guard; g.prepared = true; g.owner = 'PLAYER'; g.location = 'HAND'; g.preparedWeek = week; g.actionsSpent = 1; g.costPence = 120; g.spiritualitySpent = 4;
  for (const part of g.segments) part.status = 'UNUSED';
}
function startAttempt(s: SliceState, id: CoffinBearerCaseId) {
  const l = s.coffinBearer.life, r = l.cases[id]; r.status = 'ACTIVE'; r.contactOpen = true; r.attempts.push(freshAttempt(s, id, r.method!)); l.activeCase = id;
  l.owner.consent = 'UNASKED'; l.recipient.consent = 'UNASKED';
}
function evidence(a: CoffinBearerAttempt, sourceId: string, text: string) { a.evidence.push({ sourceId, text, atSecond: a.elapsedSeconds }); }
function applyScene(s: SliceState, id: CoffinBearerCaseId, step: CoffinBearerLifeStep) {
  const l = s.coffinBearer.life, a = l.cases[id].attempts.at(-1)!, sample = sampleFor(l, id); a.steps.push(structuredClone(step));
  switch (step.type) {
    case 'GO_A': playerMove(s, a, 'A'); evidence(a, 'PLAYER_ORIGINAL', '本人从START普通走4米4秒到A；只携当前真实持有的原物，没有召回或传送。'); break;
    case 'TAKE_KIT':
      elapse(s, a, 1); l.box.holder = 'PLAYER'; l.tag.holder = 'PLAYER'; for (const pad of l.pads) pad.holder = 'PLAYER';
      evidence(a, l.box.id, '本人在A从艾达处亲领同一原空匣、原牌以及全部用过和未用的原衬片，没有新供应或复制。'); break;
    case 'CHECK_SAMPLE':
      elapse(s, a, 2); a.sampleChecked = true; a.paperRead = true; a.checkedAlive = sample.alive; a.checkedVitality = sample.vitality; l.paper.readings++;
      a.ownerConsent = id === 'dry-record' ? 'RECORD_ONLY' : 'GRANTED'; l.owner.consent = a.ownerConsent; sample.care = 'EXPOSED';
      evidence(a, sample.id, `艾达在A针对本案原样${sample.id}给出当前${a.ownerConsent}许可；实测存活${sample.alive}、活性${sample.vitality}，原所有者不变。莉娜本案接收许可尚待B当面询问。`);
      evidence(a, l.paper.id, `本人在A读同一原纸，固定原ID：${l.paper.sampleIds.join('、')}。原纸与艾达留A；只有当前核过原样开始本次暴露计时。`); break;
    case 'PERFORM': case 'ORDINARY_CHECK':
      s.actionsRemaining--; a.resolutionPaid = true; a.resolutionActions = 1; elapse(s, a, 2); a.resolutionAtSecond = a.elapsedSeconds;
      if (step.type === 'ORDINARY_CHECK' || a.method === 'ORDINARY') { a.ordinaryChecked = true; evidence(a, sample.id, '普通实施仅付1行动和实际2秒，不判定、不耗衬片灵性精神；死亡原样仍死亡。'); break; }
      s.spirituality -= 5; s.mind -= 2; a.spiritualitySpent = 5; a.mindSpent = 2;
      { const pad = l.pads.find(p => p.status === 'UNUSED' && p.holder === 'PLAYER')!; pad.status = 'SPENT'; pad.caseId = id; pad.spentWeek = s.week; a.padId = pad.id; }
      a.abilityCheck = structuredClone(step.check); a.abilityTier = step.check!.tier; a.abilitySourceId = sample.id; a.abilityAtSecond = a.elapsedSeconds;
      a.effectActive = passed(a.abilityTier); a.remainingSeconds = a.effectActive ? 60 : 0;
      evidence(a, sample.id, `知识20四档${a.abilityTier}，一次实付5灵性2精神和原${a.padId}；用过原片仍保留。${a.effectActive ? '只给当前原活样60秒内较慢暴露损耗' : '失败无保全且不退费'}，没有增加活性或重新判定。`); break;
    case 'WAIT_WINDOW': { const seconds = 60 - (a.elapsedSeconds - a.resolutionAtSecond!); a.waitedSeconds = seconds; a.waitCompleted = true; elapse(s, a, seconds); evidence(a, sample.id, '实际等至本次实施完成后60秒；有效保全已真实到期，原活性只降不升，不可再次等待刷新。'); break; }
    case 'STOP_EFFECT': a.effectCancelled = a.remainingSeconds > 0; endEffect(a, false); a.stopped = true; evidence(a, sample.id, '停止当前未用保全，从新的普通10秒损耗计数开始；不补活性、不退费、不搬物。'); break;
    case 'TAKE_SAMPLE':
      elapse(s, a, 1); sample.holder = 'CASE'; sample.handovers++; l.box.sampleId = sample.id; a.sampleTaken = true;
      evidence(a, sample.id, `本人在A亲装唯一原样${sample.id}（${sample.massGrams}克）进唯一1千克、单件容量原匣。`); break;
    case 'CARRY_B': playerMove(s, a, 'B'); evidence(a, sample.id, '本人携同一原匣及其中同一原样普通走4米4秒到B；没有远交或物品复制。'); break;
    case 'OFFER_SAMPLE':
      elapse(s, a, 1); a.offered = true;
      a.recipientConsent = id === 'fresh-transfer' ? 'GRANTED' : id === 'withdrawn-transfer' ? 'REVOKED' : 'RECORD_ONLY'; l.recipient.consent = a.recipientConsent;
      if (id === 'withdrawn-transfer') a.consentWithdrawn = true;
      evidence(a, l.recipient.id, id === 'fresh-transfer' ? '莉娜在B对本次同一原活样给出当前明确接收照料许可；前案或未来许可不互相替代。' : id === 'withdrawn-transfer' ? '莉娜在B明确撤回本案接收和保全许可；必须先停止未用效果，再亲携原苗回艾达。' : '莉娜只核原枯样实际记录；没有接收复活承诺或让死亡变成存活。'); break;
    case 'HAND_OVER':
      elapse(s, a, 1); sample.holder = 'RECIPIENT'; sample.handovers++; sample.care = 'RECIPIENT_CARE'; l.box.sampleId = null; a.handedOver = true;
      evidence(a, sample.id, `本人在B亲交同一原样给莉娜照料，实际活性${sample.vitality}、存活${sample.alive}固定记录；正式照料停止本次暴露计时，不赠活性。本人仍持原空匣。`); break;
    case 'CONFIRM_LIMITED':
      if (step.claim === 'REVIVE') a.rejectedClaims++; else a.limitedConfirmed = true;
      evidence(a, sample.id, step.claim === 'REVIVE' ? '复活主张被拒绝；同一原枯样仍活性0、死亡，原纸未改写，不重抽。' : '确认本次只有普通枯样记录与搬运，保全不能恢复已死原样。'); break;
    case 'RETURN_A': playerMove(s, a, 'A'); break;
    case 'RETURN_SAMPLE':
      elapse(s, a, 1); sample.holder = 'OWNER'; sample.handovers++; sample.returns++; sample.care = 'OWNER_CARE'; l.box.sampleId = null; a.sampleReturned = true;
      evidence(a, sample.id, `本人在A当面交回同一原样给艾达，实际活性${sample.vitality}、存活${sample.alive}保留；照料停止本次暴露计时，不倒退损耗。`); break;
    case 'RETURN_KIT':
      elapse(s, a, 2); l.box.holder = 'OWNER'; l.box.returns++; l.tag.holder = 'OWNER'; l.tag.returns++; for (const pad of l.pads) pad.holder = 'OWNER'; a.kitReturned = true;
      evidence(a, l.box.id, '本人在A把同一空匣、原牌和三片原衬片全部交存艾达；已用片仍为惰性SPENT，不翻新，未用片仍是原片。'); break;
    case 'RECORD_OUTCOME':
      elapse(s, a, 1); a.outcomeRecorded = true; a.result = id === 'fresh-transfer' && passed(a.abilityTier) && a.protectedExposureSeconds > 0 && a.handedOver ? 'ABILITY' : 'ORDINARY'; l.cases[id].result = a.result;
      a.outcome = `G · 原${sample.id}：原活性${sample.originalVitality}→实际${sample.vitality}，存活${sample.alive}；检定${a.abilityTier ?? '普通无检定'}，保护暴露${a.protectedExposureSeconds}秒、普通暴露${a.ordinaryExposureSeconds}秒，许可${a.recipientConsent}。原样现由${sample.holder}在${sample.location}照料；原匣、牌、全部原衬片在A交存艾达。${a.result === 'ABILITY' ? '有限保全确实发生且原活样亲交，报告掌握+8' : '普通、失败、提前停止、撤回或原枯样，无掌握'}。不治病、不复活、不补回已失活性。`;
      l.paper.records.push(a.outcome); evidence(a, l.paper.id, '在A同一原纸追加实际测量与有限结论，固定来源文字和原样本ID不改。'); break;
    case 'RETURN_START': playerMove(s, a, 'START'); break;
  }
}
export function applyCoffinBearerActivity(s: SliceState, c: CoffinBearerActivityCommand, ctx: SeerContext, _award?: (id: typeof ABILITY, amount?: number) => void): void {
  const reason = coffinBearerActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.coffinBearer.life;
  if (c.type === 'BUY_KIT') { s.actionsRemaining--; s.cash -= 90; acquireKit(l, s.week); ctx.note('G · 真实购买唯一转运套件', '实付1行动90便士，从CB3-SUPPLIER取得原匣、原牌和三片一次原衬片，现由本人在START持有；没有免费复制或补充。'); return; }
  if (c.type === 'PREPARE_GUARD') { s.actionsRemaining--; s.cash -= 120; s.spirituality -= 4; prepareGuard(l, s.week); ctx.note('G · 原新材料制作唯一三段护腕', '实付1行动120便士4灵性，用既有活性基质知识从CB3-GUARD-MATERIAL制成CB3-GUARD，三段原CB3-SEG1..3在本人手上。不是旧护腕翻新，不改旧古代炼金师任何字段。'); return; }
  if (c.type === 'REFLECT') { s.actionsRemaining--; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('coffin-bearer-reflection'); ctx.note('G · 反思有限保全、当前许可与原生命', '三份真实报告后扮演+25。原活样只减慢损耗，撤回许可要停止并实际归还，原枯样不能复活；旧六阶历史全部保留。'); return; }
  if (!('caseId' in c)) throw new Error('本次生活命令缺少具体原案。');
  const r = l.cases[c.caseId], spec = CASES.find(item => item.id === c.caseId)!;
  if (c.type === 'OBSERVE') { s.actionsRemaining--; r.status = 'OBSERVED'; r.observedWeek = s.week; if (l.introducedWeek === null) { l.introducedWeek = s.week; l.introducedDate = { ...s.date }; } ctx.note(spec.title, spec.story); return; }
  if (c.type === 'PREPARE') { s.actionsRemaining--; r.status = 'PREPARED'; r.method = c.method; ctx.note(spec.title, `准备实付1行动，另留实施1行动；${c.method === 'ABILITY' ? '只有仍活且当前许可的原样能施保全，另5灵性2精神及一片原衬片' : '普通实施不检定，不耗材料灵性精神'}。尚未开始搬运，不提前取得许可。`); return; }
  if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('G · 取消未开始的准备', '0行动、已付不退。尚未移动原样或取得许可；重新准备不重置任何已执行案。'); return; }
  if (c.type === 'START_CASE') { startAttempt(s, c.caseId); ctx.note(spec.title, '0行动打开实际现场；本人仍START，艾达在A、莉娜在B，样本和原纸仍A，新案许可尚未取得。'); return; }
  if (c.type === 'REPORT_CASE') { s.actionsRemaining--; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(sourceFor(c.caseId)); if (r.result === 'ABILITY') s.progression.mastery[ABILITY] = Math.min(500, (s.progression.mastery[ABILITY] ?? 0) + 8); ctx.note(spec.title, `${r.attempts[0]!.outcome} 报告扮演+25，${r.result === 'ABILITY' ? '真实保全交付掌握+8' : '无能力掌握'}。`); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'LEAVE_CASE') { a.closed = true; r.contactOpen = false; r.returned = true; r.closes++; r.status = 'EXAMINED'; l.activeCase = null; ctx.note('G · 真正离开原苗圃现场', '本人已普通走回START；原样在实际接收照料者处，原匣牌片在A。没有离场传送、生命恢复或物品重置。'); return; }
  const check = c.type === 'PERFORM' && a.method === 'ABILITY' ? ctx.check('knowledge', 20) : null;
  applyScene(s, c.caseId, { type: c.type, atSecond: a.elapsedSeconds, check, claim: c.type === 'CONFIRM_LIMITED' ? c.claim : null });
  ctx.note(`G · ${c.type}`, `${c.type === 'RECORD_OUTCOME' ? a.outcome : '只处理本案同一原样、当前许可、真实原物和实际时间。'} 本人${l.playerLocation}；本案${a.elapsedSeconds}秒/${a.playerTravelMetres}米；保全剩余${a.remainingSeconds}秒。`);
}

const LABELS: Record<SceneType, [string, string]> = {
  GO_A: ['本人普通走到A核原样', '0行动 · 4米4秒'], TAKE_KIT: ['从艾达处亲领同一原匣牌片', '0行动 · 1秒'], CHECK_SAMPLE: ['核原样生命、原纸与本案当前许可', '0行动 · 2秒'],
  PERFORM: ['只对当前许可的原活样实施一次保全', '1行动 · 5灵性2精神1原衬片 · 知识20'], ORDINARY_CHECK: ['只作普通观察记录', '1行动 · 不检定不耗材料灵性精神'], WAIT_WINDOW: ['实际等到实施完成后60秒', '0行动 · 一次真实等待'], STOP_EFFECT: ['停止当前未用保全', '0行动0秒 · 不退费不恢复'],
  TAKE_SAMPLE: ['在A把同一原样亲装唯一空匣', '0行动 · 1秒'], CARRY_B: ['本人携原匣与原样普通走到B', '0行动 · 4米4秒'], OFFER_SAMPLE: ['当面询问莉娜本案接收许可', '0行动 · 1秒'], HAND_OVER: ['在B亲交原样给莉娜照料', '0行动 · 1秒'],
  RETURN_A: ['本人携实际剩余原物普通返回A', '0行动 · 4米4秒'], RETURN_SAMPLE: ['在A亲交同一原样给艾达', '0行动 · 1秒'], RETURN_KIT: ['在A交存原空匣、牌和全部原衬片', '0行动 · 2秒'], RECORD_OUTCOME: ['在A同一原纸如实记录有限结果', '0行动 · 1秒'], RETURN_START: ['本人空手普通走回START', '0行动 · 4米4秒'],
};
export function coffinBearerLifeActions(s: SliceState): CoffinBearerLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.coffinBearer.life, actions: CoffinBearerLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: CoffinBearerActivityCommand) => { const reason = coffinBearerActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (!l.kit.purchased) add('coffin-bearer-buy-kit', 'G · 从供应者购买唯一原转运套件', '1行动90便士 · 原匣原牌三片原衬片', { type: 'BUY_KIT' });
  for (const [index, spec] of CASES.entries()) {
    const id = spec.id, r = l.cases[id]; if (index > 0 && l.cases[COFFIN_BEARER_CASE_IDS[index - 1]!].status !== 'RESOLVED') continue;
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察本案原样本、人物与边界', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') {
      if (id !== 'dry-record') add(`${id}-ability`, '准备G一次有限活性保全', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ABILITY' });
      add(`${id}-ordinary`, '准备普通观察与真实转运', '1行动 · 另留实施1行动', { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') { add(`${id}-start`, '打开本案原苗圃现场', '0行动', { type: 'START_CASE', caseId: id }); add(`${id}-withdraw`, '取消尚未开始的准备', '0行动 · 已付不退', { type: 'WITHDRAW', caseId: id }); }
    if (r.status === 'ACTIVE') {
      const a = r.attempts.at(-1)!;
      for (const type of [...SCENES.filter(type => type !== 'STOP_EFFECT'), 'STOP_EFFECT'] as SceneType[]) {
        const command = { type, caseId: id } as CoffinBearerActivityCommand; if (!validateCoffinBearerActivityCommand(command)) continue;
        if (type === 'PERFORM' && (id === 'dry-record' || a.method === 'ORDINARY')) continue;
        if (type === 'STOP_EFFECT' && !a.effectActive && !a.consentWithdrawn) continue;
        const blockedAbility = type === 'PERFORM' && a.method === 'ABILITY' && a.sampleChecked && !a.resolutionPaid;
        if (coffinBearerActivityReason(s, command) === null || blockedAbility) add(`${id}-${type.toLowerCase()}`, LABELS[type][0], LABELS[type][1], command);
      }
      if (id === 'dry-record' && sceneReason(s, id, 'CONFIRM_LIMITED') === null) for (const claim of ['LIMITED', 'REVIVE'] as const) add(`${id}-${claim.toLowerCase()}`, claim === 'LIMITED' ? '承认同一原枯样不能复活' : '声称原枯样已复活（拒绝）', '0行动 · 原生命与原纸不改', { type: 'CONFIRM_LIMITED', caseId: id, claim });
      if (a.outcomeRecorded && cleanupBlock(s) === null) add(`${id}-leave`, '关闭已实际退出的现场', '0行动', { type: 'LEAVE_CASE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告实测生命、当前许可与实物交接', `1行动 · 扮演+25 · ${r.result === 'ABILITY' ? '实际保全交付掌握+8' : '无能力掌握'}`, { type: 'REPORT_CASE', caseId: id });
  }
  if (!l.reflected && COFFIN_BEARER_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED')) add('coffin-bearer-reflect', '反思有限保全、撤回许可与原死亡', '1行动 · 扮演+25', { type: 'REFLECT' });
  if (!l.guard.prepared) add('coffin-bearer-prepare-guard', 'G · 用新原材料制作唯一三段护腕', '1行动120便士4灵性 · 不动旧护腕', { type: 'PREPARE_GUARD' });
  return actions;
}
export function projectCoffinBearerLife(s: SliceState): CoffinBearerLifeProjection {
  const l = s.coffinBearer.life, a = currentCoffinBearerAttempt(s), actions = coffinBearerLifeActions(s), inside = hasCoffinBearerLifeLock(s);
  const next = actions.find(v => v.enabled && !['WITHDRAW', 'STOP_EFFECT'].includes(v.command.type)) ?? actions.find(v => v.enabled);
  const summary = `本人${l.playerLocation}，普通步行${l.playerTravelMetres}米；累计${l.clockSeconds}秒，其中场外${l.externalSeconds}秒。`;
  return { ...structuredClone(l), title: '抬棺人 · G有限活性与原样转运', story: COFFIN_BEARER_LIFE_STORY, environment: COFFIN_BEARER_LIFE_ENVIRONMENT, summary, inside, insideCase: inside, currentAttempt: a ? structuredClone(a) : null, actions,
    nextStep: next ? `下一步：${next.label}（${next.cost}）。` : '本批有限报告与实际转运已结束，可以继续普通生活。',
    facts: [summary, `原艾达${l.owner.id}固定在A、莉娜${l.recipient.id}固定在B；各自独立H100/M100，本案许可${l.owner.consent}/${l.recipient.consent}。`,
      ...l.samples.map(sample => `原${sample.id}：${sample.alive ? '仍活' : '死亡'}，活性${sample.vitality}/100；原所有者${sample.owner}，当前${sample.holder}/${sample.location}/${sample.care}；没有增加生命。`),
      `唯一${l.box.id}在${l.box.location}/${l.box.holder}，承重1000克、容量1件，当前原样${l.box.sampleId ?? '空'}；实际归还${l.box.returns}次。`,
      `原${l.tag.id}在${l.tag.location}/${l.tag.holder}；三片原衬片${l.pads.map(p => `${p.id}:${p.status}/${p.holder}/${p.location}`).join('；')}。`,
      `同一${l.paper.id}固定在A由OWNER保管，原ID${l.paper.sampleIds.join('、')}；已亲读${l.paper.readings}次、实测记录${l.paper.records.length}份。`,
      `新原${l.guard.id}由${l.guard.sourceId}提供，${l.guard.prepared ? '已实付1行动120便士4灵性制作' : '尚未购买制作'}；段${l.guard.segments.map(p => `${p.id}:${p.status}`).join('、')}，不复制旧护腕。`,
      a ? `知识20四档${a.abilityTier ?? '尚未施术或普通'}；保全${a.effectActive ? '有效' : '无效'}、剩余${a.remainingSeconds}秒；当前普通暴露${a.ordinaryExposureSeconds}秒、保护暴露${a.protectedExposureSeconds}秒，实失${a.vitalityLost}活性。` : '只有当前已核未交的原活样暴露计时，已交照料者的原样不会因场外时间继续实验性衰减。', a?.outcome ?? '原枯样不复活，原生命不复制；不能因姓名、职业或棺材得到免死。'],
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return { id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [spec.story], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.attempts[0]?.outcome ?? null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}

/** Replays every original sample, kit handoff, paid material, consent, movement and second; stored conclusions are never trusted. */
export function validateCoffinBearerLife(s: SliceState): boolean {
  try { return validateLife(s); } catch { return false; }
}
function validateLife(s: SliceState): boolean {
  const l = s.coffinBearer.life, initial = createCoffinBearerLifeState(), promotion = s.coffinBearer.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, COFFIN_BEARER_CASE_IDS) || !integer(l.clockSeconds) || !integer(l.externalSeconds) || !record(l.kit) || !record(l.guard) || !Array.isArray(l.samples) || !Array.isArray(l.pads)) return false;
  if (promotion === null) return same(l, initial) && !s.combatHistory.some(round => round.coffinBearerOutcome);
  if (!integer(promotion, 1, s.week)) return false;
  const replay = createCoffinBearerLifeState();
  let externalSeconds: number = s.coffinBearer.encounter.exitSeconds;
  if (![0, 4].includes(externalSeconds)) return false;
  for (const round of s.combatHistory) if (round.coffinBearerOutcome) { if (round.coffinBearerOutcome.elapsedSeconds !== 60) return false; externalSeconds += 60; }
  if (!integer(externalSeconds) || l.externalSeconds !== externalSeconds) return false;
  replay.clockSeconds = externalSeconds; replay.externalSeconds = externalSeconds;
  if (l.kit.purchased) { if (!integer(l.kit.purchasedWeek, promotion, s.week)) return false; acquireKit(replay, l.kit.purchasedWeek); }
  if (!same(l.kit, replay.kit)) return false;
  if (l.guard.prepared) { if (!integer(l.guard.preparedWeek, promotion, s.week)) return false; prepareGuard(replay, l.guard.preparedWeek); }
  for (const round of s.combatHistory) if (round.coffinBearerOutcome) {
    const outcome = round.coffinBearerOutcome;
    if (!same(outcome.source.guard, replay.guard)) return false;
    for (const action of outcome.playerActions) if (action.guard) {
      const segment = replay.guard.segments.find(part => part.status === 'UNUSED');
      if (!replay.guard.prepared || !segment || action.guard.guardId !== replay.guard.id || action.guard.segmentId !== segment.id || !['mother.s4.living-matrix', ABILITY].includes(action.id)) return false;
      segment.status = 'SPENT';
    }
    if (!same(outcome.guardAfter, replay.guard)) return false;
  }
  if (!same(l.guard, replay.guard)) return false;
  if (l.introducedWeek === null) return l.introducedDate === null && same(l, replay) && (!promoted(s) || s.progression.acting === 0 && (s.progression.mastery[ABILITY] ?? 0) === 0);
  if (!integer(l.introducedWeek, promotion, s.week) || !isValidGameDate(l.introducedDate) || l.cases['fresh-transfer'].observedWeek !== l.introducedWeek) return false;
  replay.introducedWeek = l.introducedWeek; replay.introducedDate = { ...l.introducedDate };
  const shadow: SliceState = { ...s, status: 'ACTIVE', health: 100, mind: 100, actionsRemaining: 100, activeEvent: null, combat: null, coffinBearer: { ...s.coffinBearer, life: replay } };
  let open = 0, prepared = 0, resolved = 0, mastery = 0, lastAttemptWeek = promotion;
  for (const [index, id] of COFFIN_BEARER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes, 0, 1) || !integer(r.withdrawals) || !Array.isArray(r.attempts) || r.attempts.length > 1) return false;
    if (r.status === 'AVAILABLE') { if (!same(r, freshCase())) return false; continue; }
    if (!integer(r.observedWeek, l.introducedWeek, s.week) || index > 0 && l.cases[COFFIN_BEARER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'OBSERVED' || r.status === 'PREPARED') {
      if (r.attempts.length || r.contactOpen || r.returned || r.closes || r.result !== 'NONE' || (r.status === 'OBSERVED') !== (r.method === null) || r.status === 'PREPARED' && !l.kit.purchased) return false;
      if (r.status === 'PREPARED') prepared++; replay.cases[id] = structuredClone(r); continue;
    }
    if (r.attempts.length !== 1 || r.method === null || !l.kit.purchased) return false;
    const a = r.attempts[0]!;
    if (!record(a) || !shape(a, Object.keys(freshAttempt(shadow, id, 'ORDINARY'))) || !integer(a.week, Math.max(r.observedWeek, lastAttemptWeek, l.kit.purchasedWeek!), s.week) || !isValidGameDate(a.date) || a.method !== r.method || !integer(a.initialSpirituality, 0, 120) || !integer(a.initialMind, 1, 100) || !integer(a.initialKnowledge, 0, 500) || !Array.isArray(a.steps)) return false;
    lastAttemptWeek = a.week; shadow.week = a.week; shadow.date = { ...a.date }; shadow.spirituality = a.initialSpirituality; shadow.mind = a.initialMind; shadow.actionsRemaining = 100; shadow.character = { ...s.character, coreStats: { ...s.character.coreStats, knowledge: a.initialKnowledge } };
    replay.cases[id] = { ...structuredClone(r), result: 'NONE', attempts: [], status: 'PREPARED', contactOpen: false, closes: 0, returned: false };
    startAttempt(shadow, id); const expected = replay.cases[id].attempts[0]!;
    for (const step of a.steps) {
      if (!record(step) || !shape(step, ['type', 'atSecond', 'check', 'claim']) || step.atSecond !== expected.elapsedSeconds) return false;
      const casting = step.type === 'PERFORM' && a.method === 'ABILITY';
      if (casting) { if (!record(step.check) || !integer(step.check.roll, 1, 100) || !same(step.check, resolveNormalCheck({ ability: 'knowledge', baseAbility: a.initialKnowledge, difficulty: 20, modifiers: [], roll: step.check.roll }))) return false; } else if (step.check !== null) return false;
      const command = step.type === 'CONFIRM_LIMITED' ? { type: step.type, caseId: id, claim: step.claim } : { type: step.type, caseId: id };
      if (step.type !== 'CONFIRM_LIMITED' && step.claim !== null || !SCENES.includes(step.type as SceneType) && step.type !== 'CONFIRM_LIMITED' || !validateCoffinBearerActivityCommand(command) || sceneReason(shadow, id, step.type)) return false;
      applyScene(shadow, id, step);
    }
    if (a.closed) { if (!expected.outcomeRecorded || cleanupBlock(shadow)) return false; expected.closed = true; replay.activeCase = null; }
    if (!same(a, expected) || r.result !== expected.result || r.closes !== Number(a.closed) || r.returned !== a.closed || r.contactOpen === a.closed) return false;
    if (r.status === 'ACTIVE') { open++; if (a.closed || a.week !== s.week || l.activeCase !== id || s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return false; }
    else if (!['EXAMINED', 'RESOLVED'].includes(r.status) || !a.closed) return false;
    if (r.status === 'RESOLVED') { if (!a.outcomeRecorded || a.result === 'NONE') return false; resolved++; if (a.result === 'ABILITY') mastery += 8; }
    replay.cases[id] = structuredClone(r);
  }
  if (open > 1 || prepared > 1 || open && prepared || (l.activeCase !== null) !== (open === 1) || typeof l.reflected !== 'boolean' || l.reflected && resolved !== 3 || prepared && (s.world.city !== 'BACKLUND' || s.activeEvent || s.combat)) return false;
  replay.activeCase = l.activeCase; replay.reflected = l.reflected;
  if (!same(replay, l) || !open && cleanupBlock(s) !== null) return false;
  return !promoted(s) || s.progression.acting === resolved * 25 + Number(l.reflected) * 25 && (s.progression.mastery[ABILITY] ?? 0) === mastery;
}
