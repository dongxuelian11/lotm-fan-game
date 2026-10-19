import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { CoffinBearerSampleId } from '../coffin-bearer/life.js';
import type { BarrenMatriarchSceneRoot, BarrenMatriarchOperationState, BarrenMatriarchRootPad } from '../barren-matriarch/life.js';
import { replayNatureWalkerEncounterPhysical } from './encounter.js';

export const NATURE_WALKER_CASE_IDS = ['living-response', 'withdrawn-care', 'root-impact'] as const;
export const NATURE_WALKER_ACTIVITY_CASE_IDS = NATURE_WALKER_CASE_IDS;
export const ACTIVITY_CASE_IDS = NATURE_WALKER_CASE_IDS;
export type NatureWalkerCaseId = typeof NATURE_WALKER_CASE_IDS[number];
export type NatureWalkerLifeAbilityId = 'mother.s1.living-response' | 'mother.s1.root-bearing';
export type NatureWalkerLocation = 'START' | 'A' | 'B' | 'OUTSIDE' | 'ANNEX_A' | 'ANNEX_B';
export type NatureWalkerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
/** The original nursery remains evidence. This continuation alone owns actual movement and costs. */
export interface NatureWalkerSceneRoot extends Omit<BarrenMatriarchSceneRoot, 'playerLocation' | 'owner' | 'recipient' | 'samples' | 'paper' | 'box' | 'tag' | 'pads'> {
  playerLocation: NatureWalkerLocation;
  owner: Omit<BarrenMatriarchSceneRoot['owner'], 'location' | 'mind'> & { location: NatureWalkerLocation; mind: number };
  recipient: Omit<BarrenMatriarchSceneRoot['recipient'], 'location' | 'mind'> & { location: NatureWalkerLocation; mind: number };
  samples: (Omit<BarrenMatriarchSceneRoot['samples'][number], 'location'> & { location: NatureWalkerLocation })[];
  paper: Omit<BarrenMatriarchSceneRoot['paper'], 'location'> & { location: NatureWalkerLocation };
  box: Omit<BarrenMatriarchSceneRoot['box'], 'location'> & { location: NatureWalkerLocation | 'SUPPLIER' };
  tag: Omit<BarrenMatriarchSceneRoot['tag'], 'location'> & { location: NatureWalkerLocation | 'SUPPLIER' };
  pads: (Omit<BarrenMatriarchSceneRoot['pads'][number], 'location'> & { location: NatureWalkerLocation | 'SUPPLIER' })[];
}
export type NatureWalkerSite = NatureWalkerSceneRoot;
export type NatureWalkerPhysicalState = NatureWalkerSite;
export interface NatureWalkerRootPad extends Omit<BarrenMatriarchRootPad, 'location'> { location: NatureWalkerLocation }
export interface NatureWalkerSceneSource { promotionWeek: number; originals: { site: BarrenMatriarchSceneRoot; operation: BarrenMatriarchOperationState; rootPad: BarrenMatriarchRootPad } }
export interface NatureWalkerEffect { abilityId: NatureWalkerLifeAbilityId; actor: 'PLAYER'; target: 'PLAYER'; sampleId: CoffinBearerSampleId | null; padId: 'BM2-ROOT-PAD' | null; createdAt: number; expiresAt: number; remainingUses: 1; sourceCaseId: NatureWalkerCaseId }
export interface NatureWalkerOperationState extends BarrenMatriarchOperationState { livingResponse: NatureWalkerEffect | null; rootBearing: NatureWalkerEffect | null }
export interface NatureWalkerMovement { actor: 'PLAYER' | 'CB3-ADA' | 'CB3-LENA'; from: NatureWalkerLocation; to: NatureWalkerLocation; mode: 'WALK'; metres: 4; seconds: 4; itemIds: string[] }
export interface NatureWalkerAnnexClearance { week: number; ownerId: 'CB3-ADA'; recipientId: 'CB3-LENA'; ownerLocation: 'OUTSIDE'; recipientLocation: 'OUTSIDE'; carriedItemIds: string[] }
export interface NatureWalkerAnnex {
  id: 'NW1-NEIGHBOR-WORKAREA'; paidWeek: number | null; paidRevision: number | null; placementConsent: 'UNASKED' | 'GRANTED';
  supportPieces: number; effortSpent: number; effortLimit: 9; ownerTravelMetres: number; recipientTravelMetres: number;
  marks: { id: 'NW1-MARK-A' | 'NW1-MARK-B'; owner: 'PLAYER'; holder: 'SUPPLIER' | 'OWNER' | 'FLOOR'; location: 'SUPPLIER' | 'ANNEX_A' | 'ANNEX_B'; quantity: 1 }[];
  clearance: NatureWalkerAnnexClearance | null;
}
const STEPS = ['OBSERVE', 'CHECK_ORIGINALS', 'CONSENT_OWNER', 'DECLINE_PERMISSION', 'SETUP_OBJECTS', 'CHECK_SAMPLE', 'LIVING_RESPONSE', 'ORDINARY_CARE', 'ROOT_BEARING', 'APPLY_IMPACT', 'ORDINARY_SUPPORT', 'CANCEL_IMPACT', 'CANCEL_CASE', 'WITHDRAW_PERMISSION', 'RETURN_OBJECTS', 'STOP', 'WAIT_EFFECT', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type NatureWalkerActivityCommand =
  | { type: typeof STEPS[number]; caseId: NatureWalkerCaseId }
  | { type: 'PREPARE'; caseId: NatureWalkerCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WALK'; caseId: NatureWalkerCaseId; to: 'OUTSIDE' | 'ANNEX_A' | 'ANNEX_B' }
  | { type: 'CARE_CHECK'; caseId: NatureWalkerCaseId; response: 'COOPERATE' | 'RESIST' }
  | { type: 'EXIT_ORIGINAL' | 'INITIALISE_WORKAREA' | 'RENT_ANNEX' | 'REFLECT' };
export interface NatureWalkerImpact { actor: 'PLAYER'; target: 'PLAYER'; objectId: 'CB3-DRY-1'; padId: 'BM2-ROOT-PAD'; massGrams: 100; visible: true; kind: 'BODY'; at: number; mode: 'IMPACT' | 'ORDINARY_SUPPORT' | 'CANCELLED'; baseContribution: 45; contribution: 15 | 45 | 0; baseHealthLoss: 5; healthLoss: 0 | 2 | 5; padWear: 0 | 15; rootBearingApplied: boolean }
export interface NatureWalkerAttempt {
  week: number; date: PublicGameDate; method: 'ABILITY' | 'ORDINARY'; sampleId: CoffinBearerSampleId; consent: NatureWalkerConsent;
  closed: boolean; inspected: boolean; stopped: boolean; cancelled: boolean; permissionWithdrawn: boolean;
  originalsChecked: boolean; objectsSetup: boolean; sampleChecked: boolean; checkedAlive: boolean | null; checkedVitality: number | null;
  responseObserved: boolean; livingResponseTier: PublicResolutionTier | null; rootBearingTier: PublicResolutionTier | null;
  careTier: PublicResolutionTier | null; careAssisted: boolean; careResponse: 'COOPERATE' | 'RESIST' | 'ORDINARY' | null;
  impact: NatureWalkerImpact | null; effectExpired: boolean; effectStopped: boolean; resultRead: boolean; objectsReturned: boolean;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; healthLost: number;
  effortSpent: number; recipientMindSpent: number; waitedSeconds: number; appliedAbilityIds: NatureWalkerLifeAbilityId[]; movements: NatureWalkerMovement[]; evidence: string[];
}
export interface NatureWalkerCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; consentWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean; closes: number; withdrawals: number; attempts: NatureWalkerAttempt[] }
export interface NatureWalkerLifeCost { actions: number; spirituality: number; mind: number; pennies: number; health: number; cashGained: 0 }
export interface NatureWalkerLifeBudget { actions: number; health: number; mind: number; spirituality: number; cash: number }
export interface NatureWalkerLifeCheckSource {
  kind: 'CAST' | 'CARE'; abilityId: NatureWalkerLifeAbilityId | null; coreStat: 'knowledge' | 'will'; difficulty: 18 | 20; baseAbility: number;
  actor: { name: string; gender: string; pathwayId: 'mother'; sequence: 1 }; caseId: NatureWalkerCaseId; at: number; location: 'ANNEX_B';
  consent: NatureWalkerConsent; sampleId: CoffinBearerSampleId; sampleAlive: boolean; sampleVitality: number; paperId: 'CB3-RECORD'; padId: 'BM2-ROOT-PAD' | null;
  supportPiecesBefore: number; assistance: 0 | 35; response: 'COOPERATE' | 'RESIST' | null;
}
export interface NatureWalkerLifeEvent { week: number; date: PublicGameDate; revision: number; command: NatureWalkerActivityCommand; before: NatureWalkerLifeBudget; after: NatureWalkerLifeBudget; paid: NatureWalkerLifeCost; randomCursor: number; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; tier: PublicResolutionTier | null; source: NatureWalkerLifeCheckSource | null; clockBefore: number; clockAfter: number; padBefore: NatureWalkerRootPad; padAfter: NatureWalkerRootPad }
export interface NatureWalkerLifeState { source: NatureWalkerSceneSource | null; site: NatureWalkerSite | null; rootPad: NatureWalkerRootPad | null; operation: NatureWalkerOperationState; annex: NatureWalkerAnnex; activeCase: NatureWalkerCaseId | null; reflected: boolean; cases: Record<NatureWalkerCaseId, NatureWalkerCaseState>; movements: NatureWalkerMovement[]; journal: NatureWalkerLifeEvent[] }
export interface NatureWalkerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NatureWalkerActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export interface NatureWalkerAttemptProjection {
  method: 'ABILITY' | 'ORDINARY'; consent: NatureWalkerConsent; closed: boolean; stopped: boolean; cancelled: boolean; permissionWithdrawn: boolean;
  checkedAlive: boolean | null; checkedVitality: number | null; livingResponseTier: PublicResolutionTier | null; rootBearingTier: PublicResolutionTier | null;
  careTier: PublicResolutionTier | null; careAssisted: boolean; careResponse: NatureWalkerAttempt['careResponse']; effectRemainingSeconds: number;
  impact: Pick<NatureWalkerImpact, 'at' | 'mode' | 'healthLoss' | 'padWear' | 'rootBearingApplied'> | null;
  resultRead: boolean; objectsReturned: boolean; result: NatureWalkerAttempt['result']; elapsedSeconds: number; playerTravelMetres: number;
  spiritualitySpent: number; mindSpent: number; healthLost: number; effortSpent: number; recipientMindSpent: number; evidence: string[];
}
export interface NatureWalkerLifeProjection {
  title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[];
  activeCase: NatureWalkerCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; clockSeconds: number; playerLocation: NatureWalkerLocation; playerTravelMetres: number;
  currentAttempt: NatureWalkerAttemptProjection | null; rootPad: { title: string; owner: string; holder: string; location: string; integrity: number; acquired: boolean };
  site: { title: string; owner: string; recipient: string; samples: string[]; paper: string; box: string; tag: string };
  annex: { title: string; paid: boolean; supportPieces: number; effortSpent: number; effortLimit: 9; recipientMind: number; ownerTravelMetres: number; recipientTravelMetres: number };
  effectRemainingSeconds: number; cases: { id: NatureWalkerCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: NatureWalkerAttemptProjection[] }[]; actions: NatureWalkerLifeAction[];
}
const RESPONSE = 'mother.s1.living-response' as const, BEARING = 'mother.s1.root-bearing' as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 1;
const freshCase = (): NatureWalkerCaseState => ({ status: 'AVAILABLE', observedWeek: null, consentWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
export function createNatureWalkerLifeState(): NatureWalkerLifeState {
  return { source: null, site: null, rootPad: null, operation: { dormancy: null, buffer: null, livingResponse: null, rootBearing: null },
    annex: { id: 'NW1-NEIGHBOR-WORKAREA', paidWeek: null, paidRevision: null, placementConsent: 'UNASKED', supportPieces: 0, effortSpent: 0, effortLimit: 9, ownerTravelMetres: 0, recipientTravelMetres: 0, marks: [], clearance: null },
    activeCase: null, reflected: false, cases: { 'living-response': freshCase(), 'withdrawn-care': freshCase(), 'root-impact': freshCase() }, movements: [], journal: [] };
}
function fromSource(source: NatureWalkerSceneSource): NatureWalkerLifeState {
  const l = createNatureWalkerLifeState(); l.source = structuredClone(source); l.site = structuredClone(source.originals.site) as NatureWalkerSite; l.rootPad = structuredClone(source.originals.rootPad);
  l.operation = { ...structuredClone(source.originals.operation), livingResponse: null, rootBearing: null }; return l;
}
export function initializeNatureWalkerLifeState(s: SliceState): void {
  if (s.natureWalker.life.source !== null) throw new Error('原苗圃已接续，不能再次复制原物或恢复生命与磨损。');
  s.natureWalker.life = fromSource({ promotionWeek: s.natureWalker.promotionWeek ?? s.week, originals: {
    site: structuredClone(s.coffinBearer.life) as BarrenMatriarchSceneRoot, operation: structuredClone(s.barrenMatriarch.life.operation), rootPad: structuredClone(s.barrenMatriarch.life.rootPad) } });
}
export const initializeNatureWalkerLife = initializeNatureWalkerLifeState;
export const getNatureWalkerCurrentSite = (s: SliceState): NatureWalkerSite => s.natureWalker.life.site ?? s.coffinBearer.life as NatureWalkerSite;
const current = (l: NatureWalkerLifeState): NatureWalkerAttempt | null => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: NatureWalkerLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen);
const effect = (l: NatureWalkerLifeState) => l.operation.livingResponse ?? l.operation.rootBearing;
const sampleId = (id: NatureWalkerCaseId): CoffinBearerSampleId => id === 'living-response' ? 'CB3-LIVE-1' : id === 'withdrawn-care' ? 'CB3-LIVE-2' : 'CB3-DRY-1';
const sampleFor = (l: NatureWalkerLifeState, id: NatureWalkerCaseId) => l.site!.samples.find(x => x.id === sampleId(id))!;
function returnedAt(l: NatureWalkerLifeState, at: NatureWalkerLocation): boolean {
  const p = l.site, pad = l.rootPad;
  return !!p && !!pad && p.playerLocation === at && p.owner.location === at && p.recipient.location === at && p.box.sampleId === null
    && [p.paper, p.box, p.tag, ...p.pads].every(x => x.holder === 'OWNER' && x.location === at)
    && p.samples.every(x => x.location === at && x.holder === (x.id === 'CB3-LIVE-1' ? 'RECIPIENT' : 'OWNER') && x.care === (x.id === 'CB3-LIVE-1' ? 'RECIPIENT_CARE' : 'OWNER_CARE'))
    && pad.owner === 'PLAYER' && pad.holder === 'PLAYER' && pad.location === at && !effect(l) && !l.operation.dormancy && !l.operation.buffer;
}
export const hasNatureWalkerLifeLock = (s: SliceState): boolean => open(s.natureWalker.life);
export const isNatureWalkerLifeLocked = hasNatureWalkerLifeLock;
export const natureWalkerInside = hasNatureWalkerLifeLock;
export const natureWalkerLifeClosed = (s: SliceState): boolean => !open(s.natureWalker.life) && returnedAt(s.natureWalker.life, 'OUTSIDE') && Object.values(s.natureWalker.life.cases).every(r => r.status === 'RESOLVED');
export function validateNatureWalkerActivityCommand(v: unknown): v is NatureWalkerActivityCommand {
  if (!record(v)) return false;
  if (['EXIT_ORIGINAL', 'INITIALISE_WORKAREA', 'RENT_ANNEX', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!NATURE_WALKER_CASE_IDS.includes(v.caseId as NatureWalkerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && ['OUTSIDE', 'ANNEX_A', 'ANNEX_B'].includes(String(v.to));
  if (v.type === 'CARE_CHECK') return shape(v, ['type', 'caseId', 'response']) && ['COOPERATE', 'RESIST'].includes(String(v.response));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isNatureWalkerLifeCommand = validateNatureWalkerActivityCommand;
export const isNatureWalkerActivityCommand = validateNatureWalkerActivityCommand;
export const isNatureWalkerActivity = validateNatureWalkerActivityCommand;
function localBlock(l: NatureWalkerLifeState, c: NatureWalkerActivityCommand, week: number): string | null {
  const p = l.site, pad = l.rootPad;
  if (!p || !pad) return '先接续本人晋升后的原苗圃现场。';
  if (c.type === 'EXIT_ORIGINAL') return !open(l) && l.annex.paidWeek === null && p.playerLocation === 'START' && p.owner.location === 'OUTSIDE' && p.recipient.location === 'OUTSIDE' && pad.holder === 'PLAYER' && pad.location === 'START' ? null : '本人须从旧苗圃门口普通走四米出去；旧对手与旧现场不重置。';
  if (c.type === 'INITIALISE_WORKAREA' || c.type === 'RENT_ANNEX') return !open(l) && l.annex.paidWeek === null && returnedAt(l, 'OUTSIDE') ? null : '先与原两位成年人和原物在外面会合；相邻场地只可实付布置一次。';
  if (c.type === 'REFLECT') return !l.reflected && !open(l) && returnedAt(l, 'OUTSIDE') && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '须三案均已结束、报告并真实归物离场。';
  if (l.annex.paidWeek === null) return '可先普通离开旧苗圃；开始三案须实付40便士和1行动布置两个标位与三份材料。';
  if (!('caseId' in c)) return '此操作不属于当前事务。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), idx = NATURE_WALKER_CASE_IDS.indexOf(c.caseId), impact = c.caseId === 'root-impact';
  if (c.type === 'OBSERVE') return !open(l) && returnedAt(l, 'OUTSIDE') && r.status === 'AVAILABLE' && (idx === 0 || l.cases[NATURE_WALKER_CASE_IDS[idx - 1]!].status === 'RESOLVED') ? null : '须先报告前案并实际回到场外，再观察下一案。';
  if (c.type === 'PREPARE') return !open(l) && returnedAt(l, 'OUTSIDE') && r.status === 'OBSERVED' && r.attempts.length === 0 ? null : '每案只准备一次；不能重置结果、许可或材料。';
  if (c.type === 'REPORT') return !open(l) && returnedAt(l, 'OUTSIDE') && r.status === 'EXAMINED' && !!a?.closed && a.inspected && a.resultRead ? null : '先核实、归物、实际离场并结束接触，再如实报告。';
  if (!a || a.closed || l.activeCase !== c.caseId || !r.contactOpen || a.week !== week) return '须本周仍在进行的同一案。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return returnedAt(l, 'OUTSIDE') && a.objectsReturned && a.inspected ? null : '须普通归物离场并核实；这些收尾不耗行动、金钱或灵性。';
  if (c.type === 'STOP') return !a.stopped ? null : '施术已停止；普通取消、归物、步行和收尾仍可进行。';
  if (c.type === 'CANCEL_CASE') return !a.resultRead ? null : '本案实际结果已产生，保留结果后归物即可。';
  if (c.type === 'WAIT_EFFECT') return effect(l) ? null : '没有未用且未到期的有限窗口。';
  if (c.type === 'WITHDRAW_PERMISSION') return a.consent === 'GRANTED' && !a.permissionWithdrawn && !a.resultRead ? null : '须本案仍有效且未撤回的许可。';
  if (c.type === 'INSPECT') return returnedAt(l, 'OUTSIDE') && a.objectsReturned && a.resultRead && !a.inspected ? null : '须先亲还原物、普通走出场地并确认实际结果。';
  if (a.inspected) return '核实已完成，只须结束接触和如实报告。';
  if (c.type === 'WALK') {
    if (p.owner.location !== p.playerLocation || p.recipient.location !== p.playerLocation) return '不能用步行命令远程搬动他人或原物。';
    if (p.playerLocation === 'OUTSIDE' && c.to === 'ANNEX_A') return !a.objectsReturned && !a.resultRead ? null : '已经收尾，不再重返现场。';
    if (p.playerLocation === 'ANNEX_A' && c.to === 'ANNEX_B') return a.objectsSetup && !a.resultRead && !a.cancelled ? null : '须当面核物并实际安排后再共同走四米到乙位。';
    if (p.playerLocation === 'ANNEX_B' && c.to === 'ANNEX_A') return a.objectsReturned ? null : '先在同一地点亲还原纸与实际借用物，随后共同普通走回甲位。';
    if (p.playerLocation === 'ANNEX_A' && c.to === 'OUTSIDE') return a.objectsReturned ? null : '可免费取消后当面归物，再普通走到场外。';
    return '只沿场外、甲位、四米外乙位逐段步行。';
  }
  if (c.type === 'RETURN_OBJECTS') return a.resultRead && !a.objectsReturned && p.owner.location === p.playerLocation && p.recipient.location === p.playerLocation ? null : '先完成或取消本案，再当面交还实际借用的原物。';
  if (c.type === 'CHECK_ORIGINALS') return p.playerLocation === 'ANNEX_A' && !a.originalsChecked && !a.resultRead ? null : '先真实来到甲位，当面核对原人原样和原纸。';
  if (c.type === 'CONSENT_OWNER' || c.type === 'DECLINE_PERMISSION') return p.playerLocation === 'ANNEX_A' && a.originalsChecked && a.consent === 'UNASKED' && !a.resultRead ? null : '每案重新询问两位成年人；不能沿用旧许可或重复索取被拒许可。';
  if (c.type === 'SETUP_OBJECTS') return p.playerLocation === 'ANNEX_A' && a.originalsChecked && a.consent !== 'UNASKED' && !a.objectsSetup && !a.resultRead && returnedAt(l, 'ANNEX_A') && l.annex.effortSpent + 3 <= 9 && p.recipient.mind >= 1 ? null : '须原人原物同在甲位，当前合作另耗3额度与莉娜1精神；总额度9。';
  if (c.type === 'CHECK_SAMPLE') return p.playerLocation === 'ANNEX_B' && a.objectsSetup && !a.sampleChecked && !a.resultRead && sampleFor(l, c.caseId).location === 'ANNEX_B' && p.paper.holder === 'PLAYER' && p.paper.location === 'ANNEX_B' ? null : '须在乙位亲见同一原样，并持同一原纸直接记录。';
  if (c.type === 'ORDINARY_CARE' || c.type === 'CARE_CHECK') {
    if (impact || p.playerLocation !== 'ANNEX_B' || !a.sampleChecked || a.resultRead || !sampleFor(l, c.caseId).alive) return '只可对乙位眼前已观察的同一原活苗完成一次本人照料检查。';
    if (c.caseId === 'withdrawn-care' && a.consent === 'GRANTED') return '本案须先尊重照料员撤回当前能力许可，再普通完成。';
    return null;
  }
  if (['APPLY_IMPACT', 'ORDINARY_SUPPORT', 'CANCEL_IMPACT'].includes(c.type)) {
    if (!impact || p.playerLocation !== 'ANNEX_B' || !a.sampleChecked || a.resultRead || a.impact || p.box.holder !== 'PLAYER' || p.box.sampleId !== 'CB3-DRY-1') return '须在乙位亲持装有同一原枯样的原匣，且一次冲击尚未发生。';
    if (c.type === 'CANCEL_IMPACT') return null;
    if (pad.owner !== 'PLAYER' || pad.holder !== 'PLAYER' || pad.location !== 'ANNEX_B' || pad.integrity < 15) return '同一原根垫须亲持且至少余15完整度；也可免费取消冲击。';
    return c.type !== 'APPLY_IMPACT' || a.method === 'ABILITY' && a.rootBearingTier !== null && a.consent === 'GRANTED' && !a.stopped ? null : '只可在当前许可下自愿实际试行；普通支撑或取消仍可进行。';
  }
  if (c.type === 'LIVING_RESPONSE' || c.type === 'ROOT_BEARING') {
    if (a.method !== 'ABILITY' || a.stopped || a.consent !== 'GRANTED' || a.resultRead || !a.sampleChecked || p.playerLocation !== 'ANNEX_B' || effect(l) || l.annex.supportPieces < 1 || p.owner.consent !== 'GRANTED' || p.recipient.consent !== 'GRANTED') return '只可在当前许可下亲历同一目标，以一份已付费材料尝试一次；失败、拒绝或撤回后普通收尾仍可进行。';
    if (c.type === 'LIVING_RESPONSE') return !impact && a.livingResponseTier === null && a.responseObserved && sampleFor(l, c.caseId).alive && sampleFor(l, c.caseId).vitality > 0 ? null : '须实际观察仍活的同一原苗；零活性枯样不能施术。';
    return impact && a.rootBearingTier === null && pad.holder === 'PLAYER' && pad.location === 'ANNEX_B' && pad.integrity >= 15 ? null : '仅对本人亲触的同一原根垫尝试一次；不能凭空造垫或恢复磨损。';
  }
  return '本案不支持这个步骤。';
}
function commandCost(c: NatureWalkerActivityCommand, tier: PublicResolutionTier | null = null, l?: NatureWalkerLifeState): NatureWalkerLifeCost {
  const cast = c.type === 'LIVING_RESPONSE' || c.type === 'ROOT_BEARING';
  return { actions: cast || ['INITIALISE_WORKAREA', 'RENT_ANNEX', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: cast ? 8 : 0,
    mind: cast ? tier !== null && !passed(tier) ? 4 : 2 : 0, pennies: c.type === 'INITIALISE_WORKAREA' || c.type === 'RENT_ANNEX' ? 40 : 0,
    health: c.type === 'ORDINARY_SUPPORT' ? 2 : c.type === 'APPLY_IMPACT' ? l?.operation.rootBearing ? 2 : 5 : 0, cashGained: 0 };
}
const reserve = (c: NatureWalkerActivityCommand) => c.type === 'PREPARE' && c.method === 'ABILITY' ? 1 : 0;
export function blockNatureWalkerLife(s: SliceState, c: NatureWalkerActivityCommand): string | null {
  if (!validateNatureWalkerActivityCommand(c)) return '自然行者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人活着并已成为自然行者。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗并回到贝克兰德。';
  if (s.natureWalker.preparedWeek !== null || s.natureWalker.encounter.preparation || s.natureWalker.encounter.status !== 'AVAILABLE') return '先收束当前准备；新遭遇开始后不能重开三案。';
  const l = s.natureWalker.life, reason = localBlock(l, c, s.week); if (reason) return reason;
  const cost = commandCost(c, null, l);
  if (s.actionsRemaining < cost.actions + reserve(c)) return '须支付本次行动并预留一次施术；普通取消、归物、步行和结束接触不耗行动。';
  if (s.cash < cost.pennies) return '场地、两个标位与三份有限材料须一次实付40便士；可停留场外，不必购买。';
  if (s.spirituality < cost.spirituality || cost.spirituality > 0 && s.mind < 4) return '不足以承担这次施术及失败成本；普通检查、取消和离场仍可进行。';
  if ((cost.spirituality > 0 || cost.health > 0) && (s.health <= 5 || s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null))) return '目前不宜承受施术或冲击；可普通照料、免费取消并归物离场。';
  return null;
}
export const natureWalkerActivityReason = blockNatureWalkerLife;
export function advanceNatureWalkerLifeClock(l: NatureWalkerLifeState, seconds: number): void {
  const p = l.site; if (!p || !integer(seconds) || !Number.isSafeInteger(p.clockSeconds + seconds)) throw new Error('实际场地时钟无效。');
  p.clockSeconds += seconds; const a = current(l); if (a) a.elapsedSeconds += seconds;
  for (const key of ['livingResponse', 'rootBearing'] as const) if (l.operation[key] && p.clockSeconds >= l.operation[key]!.expiresAt) { l.operation[key] = null; if (a) a.effectExpired = true; }
}
function stopEffects(l: NatureWalkerLifeState): void { const a = current(l); if (effect(l) && a) a.effectStopped = true; l.operation.livingResponse = null; l.operation.rootBearing = null; }
function walkActor(l: NatureWalkerLifeState, actor: NatureWalkerMovement['actor'], to: NatureWalkerLocation, countTime = true): void {
  const p = l.site!, pad = l.rootPad!, a = current(l), holder = actor === 'CB3-ADA' ? 'OWNER' : actor === 'CB3-LENA' ? 'RECIPIENT' : 'PLAYER';
  const from = actor === 'PLAYER' ? p.playerLocation : actor === 'CB3-ADA' ? p.owner.location : p.recipient.location;
  const objects = [p.paper, p.box, p.tag, ...p.pads].filter(x => x.holder === holder);
  const samples = p.samples.filter(x => x.holder === holder || x.holder === 'CASE' && p.box.holder === holder);
  const carriesPad = actor === 'PLAYER' && pad.holder === 'PLAYER';
  const m: NatureWalkerMovement = { actor, from, to, mode: 'WALK', metres: 4, seconds: 4, itemIds: [...objects.map(x => x.id), ...samples.map(x => x.id), ...(carriesPad ? [pad.id] : [])] };
  l.movements.push(m); if (a) a.movements.push(structuredClone(m));
  for (const item of [...objects, ...samples]) item.location = to; if (carriesPad) pad.location = to;
  if (actor === 'PLAYER') { p.playerLocation = to; p.playerTravelMetres += 4; if (a) a.playerTravelMetres += 4; }
  else if (actor === 'CB3-ADA') { p.owner.location = to; l.annex.ownerTravelMetres += 4; }
  else { p.recipient.location = to; l.annex.recipientTravelMetres += 4; }
  if (countTime) advanceNatureWalkerLifeClock(l, 4);
}
function walkTogether(l: NatureWalkerLifeState, to: NatureWalkerLocation): void { walkActor(l, 'CB3-ADA', to, false); walkActor(l, 'CB3-LENA', to, false); walkActor(l, 'PLAYER', to); }
function freshAttempt(week: number, date: PublicGameDate, method: NatureWalkerAttempt['method'], id: NatureWalkerCaseId): NatureWalkerAttempt {
  return { week, date: structuredClone(date), method, sampleId: sampleId(id), consent: 'UNASKED', closed: false, inspected: false, stopped: false, cancelled: false, permissionWithdrawn: false,
    originalsChecked: false, objectsSetup: false, sampleChecked: false, checkedAlive: null, checkedVitality: null, responseObserved: false, livingResponseTier: null, rootBearingTier: null,
    careTier: null, careAssisted: false, careResponse: null, impact: null, effectExpired: false, effectStopped: false, resultRead: false, objectsReturned: false, result: 'NONE', elapsedSeconds: 0,
    playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, healthLost: 0, effortSpent: 0, recipientMindSpent: 0, waitedSeconds: 0, appliedAbilityIds: [], movements: [], evidence: [] };
}
function appendObservation(l: NatureWalkerLifeState, a: NatureWalkerAttempt, text: string): void { l.site!.paper.records.push(text); a.evidence.push(text); }
function evolve(l: NatureWalkerLifeState, c: NatureWalkerActivityCommand, week: number, date: PublicGameDate, revision: number, tier: PublicResolutionTier | null): void {
  const p = l.site!, pad = l.rootPad!;
  if (c.type === 'EXIT_ORIGINAL') { walkActor(l, 'PLAYER', 'OUTSIDE'); return; }
  if (c.type === 'INITIALISE_WORKAREA' || c.type === 'RENT_ANNEX') {
    l.annex.paidWeek = week; l.annex.paidRevision = revision; l.annex.placementConsent = 'GRANTED'; l.annex.supportPieces = 3;
    walkTogether(l, 'ANNEX_A'); l.annex.marks = [{ id: 'NW1-MARK-A', owner: 'PLAYER', holder: 'FLOOR', location: 'ANNEX_A', quantity: 1 }, { id: 'NW1-MARK-B', owner: 'PLAYER', holder: 'OWNER', location: 'ANNEX_A', quantity: 1 }];
    walkActor(l, 'CB3-ADA', 'ANNEX_B'); l.movements.at(-1)!.itemIds.push('NW1-MARK-B'); l.annex.marks[1]!.holder = 'FLOOR'; l.annex.marks[1]!.location = 'ANNEX_B'; walkActor(l, 'CB3-ADA', 'ANNEX_A'); walkTogether(l, 'OUTSIDE'); return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; advanceNatureWalkerLifeClock(l, 6); return; }
  if (!('caseId' in c)) throw new TypeError('Missing nature walker case');
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; advanceNatureWalkerLifeClock(l, 2); return; }
  if (c.type === 'PREPARE') { r.attempts.push(freshAttempt(week, date, c.method, c.caseId)); r.method = c.method; r.contactOpen = true; r.status = 'PREPARED'; l.activeCase = c.caseId; l.annex.clearance = null; advanceNatureWalkerLifeClock(l, 2); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; advanceNatureWalkerLifeClock(l, 4); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; if (a.consent === 'GRANTED') a.consent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; advanceNatureWalkerLifeClock(l, 1); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': walkTogether(l, c.to); if (c.to === 'OUTSIDE') { stopEffects(l); l.annex.clearance = { week, ownerId: 'CB3-ADA', recipientId: 'CB3-LENA', ownerLocation: 'OUTSIDE', recipientLocation: 'OUTSIDE', carriedItemIds: [p.paper.id, p.box.id, p.tag.id, ...p.pads.map(x => x.id), ...p.samples.map(x => x.id)] }; } break;
    case 'CHECK_ORIGINALS': a.originalsChecked = true; p.paper.readings++; a.evidence.push('当面核对46岁艾达、39岁莉娜、同一原纸、原匣、原牌、三片原衬片、两株仍活原苗和零活性原枯样；本人仍持同一原根垫，旧护腕余段不补发。'); advanceNatureWalkerLifeClock(l, 2); break;
    case 'CONSENT_OWNER': a.consent = 'GRANTED'; r.consentWeek = week; p.owner.consent = p.recipient.consent = 'GRANTED'; a.evidence.push('艾达与莉娜分别同意本案实际合作和有限能力观察，任何一人都可随时拒绝或撤回；两人的独立心智保持。'); advanceNatureWalkerLifeClock(l, 1); break;
    case 'DECLINE_PERMISSION': a.consent = 'DECLINED'; p.owner.consent = p.recipient.consent = 'RECORD_ONLY'; a.evidence.push('两位照料员拒绝本案超凡参与，只接受普通核实与安全归物；不会再次索取同意。'); advanceNatureWalkerLifeClock(l, 1); break;
    case 'SETUP_OBJECTS': {
      a.objectsSetup = true; r.status = 'ACTIVE'; l.annex.effortSpent += 3; p.recipient.mind--; a.effortSpent = 3; a.recipientMindSpent = 1; p.paper.holder = 'PLAYER';
      if (c.caseId === 'root-impact') { const sample = sampleFor(l, c.caseId); p.box.holder = 'PLAYER'; p.box.sampleId = sample.id; sample.holder = 'CASE'; sample.care = 'EXPOSED'; sample.handovers++; }
      a.evidence.push('莉娜的这次合作实际耗3额度与1精神，三案总额度最多9；原物依各自实际持有人携行，原活苗持续由原照料人照护，不增加活性。'); advanceNatureWalkerLifeClock(l, 1); break;
    }
    case 'CHECK_SAMPLE': {
      const sample = sampleFor(l, c.caseId); a.sampleChecked = true; a.checkedAlive = sample.alive; a.checkedVitality = sample.vitality; a.responseObserved = sample.alive && sample.vitality > 0; p.paper.readings++;
      appendObservation(l, a, `${sample.id}在乙位由本人直接观察：${a.responseObserved ? '同一仍活植株有可见叶片光向反应，照料员保持原有照护' : '同一原枯样仍无生命反应、活性为零'}；在同一原纸追加本次观察，旧记录保留。`); advanceNatureWalkerLifeClock(l, 2); break;
    }
    case 'LIVING_RESPONSE': case 'ROOT_BEARING': {
      const response = c.type === 'LIVING_RESPONSE'; if (response) a.livingResponseTier = tier; else a.rootBearingTier = tier;
      a.spiritualitySpent += 8; a.mindSpent += passed(tier) ? 2 : 4; l.annex.supportPieces--; advanceNatureWalkerLifeClock(l, 1);
      if (passed(tier)) { const value: NatureWalkerEffect = { abilityId: response ? RESPONSE : BEARING, actor: 'PLAYER', target: 'PLAYER', sampleId: response ? a.sampleId : null, padId: response ? null : pad.id, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + 20, remainingUses: 1, sourceCaseId: c.caseId }; if (response) l.operation.livingResponse = value; else l.operation.rootBearing = value; }
      a.evidence.push(!passed(tier) ? '本次施术未成，8灵性、4精神和一份已付费材料照耗；没有恢复生命或补发物品，普通收尾仍可行。' : response ? '生机辨应只帮助本人接下来一次对同一原活苗的照料检查，二十秒后未用即失效；此刻没有增加植物活性，也未获得应用掌握。' : '本人亲触同一原根垫，根系承冲只为接下来一次可见身体或弧光冲击留出二十秒窗口；没有疗伤，也没有替别人承伤。'); break;
    }
    case 'WITHDRAW_PERMISSION': a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.owner.consent = p.recipient.consent = 'REVOKED'; stopEffects(l); a.evidence.push('莉娜明确撤回本案能力许可，艾达尊重这一选择；未用效果立即停止，已付成本与既成结果不回滚，普通核实与离场仍可行。'); advanceNatureWalkerLifeClock(l, 1); break;
    case 'CARE_CHECK': case 'ORDINARY_CARE': {
      const assisted = c.type === 'CARE_CHECK' && c.response === 'COOPERATE' && !!l.operation.livingResponse && a.consent === 'GRANTED' && !a.stopped;
      a.careTier = tier; a.careResponse = c.type === 'CARE_CHECK' ? c.response : 'ORDINARY'; a.careAssisted = assisted;
      if (c.type === 'CARE_CHECK' && c.response === 'RESIST') { a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.owner.consent = p.recipient.consent = 'REVOKED'; }
      if (assisted) a.appliedAbilityIds.push(RESPONSE); stopEffects(l); a.resultRead = true;
      appendObservation(l, a, `${a.sampleId}的本次本人照料${c.type === 'ORDINARY_CARE' ? '按普通人工方法完成' : `独立检查${passed(tier) ? '成功' : '未成'}`}${assisted ? '，实际用尽同一原苗的一次辨应帮助' : c.type === 'CARE_CHECK' && c.response === 'RESIST' ? '；照料员自主抗拒该帮助，未施加强制影响' : '，没有未付费帮助'}；记录真实结果，生命与活性不增加。`); advanceNatureWalkerLifeClock(l, 2); break;
    }
    case 'APPLY_IMPACT': case 'ORDINARY_SUPPORT': case 'CANCEL_IMPACT': {
      const cancelled = c.type === 'CANCEL_IMPACT', ordinary = c.type === 'ORDINARY_SUPPORT', applied = !cancelled && !ordinary && !!l.operation.rootBearing;
      const healthLoss = cancelled ? 0 : ordinary || applied ? 2 : 5;
      a.impact = { actor: 'PLAYER', target: 'PLAYER', objectId: 'CB3-DRY-1', padId: pad.id, massGrams: 100, visible: true, kind: 'BODY', at: p.clockSeconds,
        mode: cancelled ? 'CANCELLED' : ordinary ? 'ORDINARY_SUPPORT' : 'IMPACT', baseContribution: 45, contribution: cancelled ? 0 : ordinary || applied ? 15 : 45, baseHealthLoss: 5, healthLoss, padWear: cancelled ? 0 : 15, rootBearingApplied: applied };
      a.healthLost += healthLoss; if (!cancelled) pad.integrity -= 15; if (applied) a.appliedAbilityIds.push(BEARING); stopEffects(l); a.resultRead = true;
      appendObservation(l, a, cancelled ? '取消尚未发生的轻小冲击，原枯样仍死亡、原根垫不磨损，不记作能力成功。' : `同一100克原枯样的轻小可见身体冲击真实发生；本人实际损失${healthLoss}健康，同一原根垫实损15完整度，${applied ? '根系承冲的一次窗口用尽' : ordinary ? '以普通支撑减轻后果，无超凡掌握' : '未有有效承冲，承担完整后果'}。原枯样仍为零活性，两位成年人没有代受伤害。`); advanceNatureWalkerLifeClock(l, 1); break;
    }
    case 'CANCEL_CASE': a.cancelled = true; a.stopped = true; a.resultRead = true; stopEffects(l); a.evidence.push('本人取消尚未执行的本案步骤，记录普通取消，不伪称照料或承冲成功；所有已付成本保留，原物仍需当面交还并普通带出。'); advanceNatureWalkerLifeClock(l, 1); break;
    case 'RETURN_OBJECTS': {
      stopEffects(l); p.paper.holder = 'OWNER'; p.paper.location = p.owner.location;
      if (p.box.holder === 'PLAYER') { const dry = p.samples.find(x => x.id === p.box.sampleId); if (dry) { dry.holder = 'OWNER'; dry.location = p.owner.location; dry.care = 'OWNER_CARE'; dry.returns++; } p.box.sampleId = null; p.box.holder = 'OWNER'; p.box.location = p.owner.location; p.box.returns++; }
      p.owner.consent = p.recipient.consent = 'RECORD_ONLY'; a.objectsReturned = true; a.evidence.push('本人在同一地点把原纸和实际借用的原匣、原枯样亲交艾达；其他原物未被远程召回，两株活苗仍由各自照料人照护。原根垫仍由本人携带，磨损不恢复。'); advanceNatureWalkerLifeClock(l, 2); break;
    }
    case 'STOP': a.stopped = true; stopEffects(l); a.evidence.push('停止后续施术与未用窗口；成本不退，普通照料、取消、当面归物和步行仍可进行。'); advanceNatureWalkerLifeClock(l, 1); break;
    case 'WAIT_EFFECT': { const seconds = effect(l)!.expiresAt - p.clockSeconds; a.waitedSeconds += seconds; advanceNatureWalkerLifeClock(l, seconds); a.evidence.push(`实际等待${seconds}秒至窗口失效，没有退款或应用奖励。`); break; }
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; advanceNatureWalkerLifeClock(l, 2); break;
  }
}
function checkSource(l: NatureWalkerLifeState, c: NatureWalkerActivityCommand, base: number, name: string, gender: string): NatureWalkerLifeCheckSource | null {
  if (c.type !== 'LIVING_RESPONSE' && c.type !== 'ROOT_BEARING' && c.type !== 'CARE_CHECK') return null;
  const a = current(l)!, sample = sampleFor(l, c.caseId), care = c.type === 'CARE_CHECK', response = care ? c.response : null;
  return { kind: care ? 'CARE' : 'CAST', abilityId: care ? null : c.type === 'LIVING_RESPONSE' ? RESPONSE : BEARING, coreStat: c.type === 'ROOT_BEARING' ? 'will' : 'knowledge', difficulty: care ? 20 : 18, baseAbility: base,
    actor: { name, gender, pathwayId: 'mother', sequence: 1 }, caseId: c.caseId, at: l.site!.clockSeconds, location: 'ANNEX_B', consent: a.consent,
    sampleId: sample.id, sampleAlive: sample.alive, sampleVitality: sample.vitality, paperId: 'CB3-RECORD', padId: c.type === 'ROOT_BEARING' ? 'BM2-ROOT-PAD' : null,
    supportPiecesBefore: l.annex.supportPieces, assistance: care && response === 'COOPERATE' && l.operation.livingResponse?.sampleId === sample.id && a.consent === 'GRANTED' && !a.stopped ? 35 : 0, response };
}
const modifiersFor = (source: NatureWalkerLifeCheckSource) => source.assistance ? [{ source: '生机辨应：同一原活苗的本人下一次照料检查', value: 35 }] : [];
const budget = (s: SliceState): NatureWalkerLifeBudget => ({ actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash });
export function applyNatureWalkerLifeCommand(s: SliceState, c: NatureWalkerActivityCommand, ctx: SeerContext): void {
  const reason = blockNatureWalkerLife(s, c); if (reason) throw new Error(reason);
  const l = s.natureWalker.life, core = c.type === 'ROOT_BEARING' ? 'will' : 'knowledge', source = checkSource(l, c, s.character.coreStats[core], s.character.name, s.character.gender);
  const before = budget(s), clockBefore = l.site!.clockSeconds, padBefore = structuredClone(l.rootPad!), randomCursor = s.random.cursor;
  let check: PublicCheckResult | null = null, tier: PublicResolutionTier | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = resolveNormalCheck({ ability: source.coreStat, baseAbility: source.baseAbility, difficulty: source.difficulty, modifiers: modifiersFor(source), roll: ctx.roll(1, 100) }); tier = check.tier; s.lastCheck = structuredClone(check); randomAfter = s.random.cursor; }
  const paid = commandCost(c, tier, l); s.actionsRemaining -= paid.actions; s.cash -= paid.pennies; s.health -= paid.health; s.mind -= paid.mind; s.spirituality -= paid.spirituality;
  evolve(l, c, s.week, s.date, s.revision, tier);
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, command: structuredClone(c), before, after: budget(s), paid, randomCursor, randomBefore, randomAfter, check, tier, source, clockBefore, clockAfter: l.site!.clockSeconds, padBefore, padAfter: structuredClone(l.rootPad!) });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); }
  else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  ctx.note(`邻圃记录：${LABELS[c.type]}`, `${tier ? `本次检定${TIERS[tier]}。` : ''}本人在${LOCATIONS[l.site!.playerLocation]}，实际时钟${l.site!.clockSeconds}秒；原生命、实付成本和既成后果保留。`);
}
export const applyNatureWalkerActivity = applyNatureWalkerLifeCommand;
export const applyNatureWalkerLife = applyNatureWalkerLifeCommand;
export const handleNatureWalkerLife = applyNatureWalkerLifeCommand;

const LOCATIONS: Record<NatureWalkerLocation | 'SUPPLIER', string> = { START: '旧苗圃门口', A: '旧苗圃甲位', B: '旧苗圃乙位', OUTSIDE: '场外通道', ANNEX_A: '邻圃甲位', ANNEX_B: '四米外邻圃乙位', SUPPLIER: '供应库存' };
const TIERS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<NatureWalkerActivityCommand['type'], string> = {
  EXIT_ORIGINAL: '实走四米离开旧苗圃', INITIALISE_WORKAREA: '实付布置相邻两标位工作区', RENT_ANNEX: '实付布置相邻两标位工作区',
  OBSERVE: '观察本案', PREPARE: '准备本案', WALK: '原人携原物普通步行', CHECK_ORIGINALS: '当面核对原人原物', CONSENT_OWNER: '重新询问两人的本案许可', DECLINE_PERMISSION: '接受能力参与的拒绝',
  SETUP_OBJECTS: '实际安排本次照料或轻小冲击', CHECK_SAMPLE: '亲见原样并在原纸记录', LIVING_RESPONSE: '尝试辨应同一原活苗', CARE_CHECK: '实际完成本人下一次照料检查', ORDINARY_CARE: '以普通人工方法完成照料核实',
  ROOT_BEARING: '亲触原根垫尝试承冲', APPLY_IMPACT: '自愿实际承受一次轻小可见冲击', ORDINARY_SUPPORT: '普通支撑同一原根垫', CANCEL_IMPACT: '取消尚未发生的冲击', CANCEL_CASE: '普通取消尚未发生的本案步骤',
  WITHDRAW_PERMISSION: '尊重当前许可撤回', RETURN_OBJECTS: '当面亲还实际借用的原物', STOP: '停止后续施术', WAIT_EFFECT: '实际等待有限窗口到期', INSPECT: '在场外核实真实收尾',
  LEAVE: '结束本案接触', CLOSE: '结束本案接触', WITHDRAW: '结束本案接触', REPORT: '如实报告本案', REFLECT: '反思三案的真实边界',
};
export const NATURE_WALKER_LIFE_STORY = '同一身体先实际离开旧苗圃，再实付布置相邻两标位。两位照料员亲携原活苗、枯样与原物随行；生机辨应只帮助本人对同一可见原活苗的一次照料检查，根系承冲只减轻本人同一原根垫接下来的有限冲击。生命、独立意愿与旧事都不会被改写。';
export const NATURE_WALKER_LIFE_ENVIRONMENT = '场外到邻圃甲位、甲位到乙位各四米，每段普通步行四秒。实付40便士和1行动取得场地、两枚实物标记及三份材料；每次施术另1行动、8灵性、成功2精神或失败4精神，生机辨应知识18、根系承冲意志18。每案实际合作耗3额度与莉娜1精神，总额度9。二十秒窗口只用一次，未用到期无退款；本人下一次照料检查有辨应帮助，承冲实际发生时原根垫实损15完整度。';
const CASES: readonly { id: NatureWalkerCaseId; title: string; story: string }[] = [
  { id: 'living-response', title: '同一原活苗的一次本人照料', story: '莉娜亲携第一株原活苗到乙位，本人亲见叶片的可见反应并在同一原纸记录。付费辨应只帮助本人下一次独立照料检查，不能把活性47变回50，也不替代实际照护。' },
  { id: 'withdrawn-care', title: '撤回许可后的普通照料', story: '艾达亲携第二株原活苗到乙位；莉娜撤回本案能力许可后，未用窗口即时结束。随后普通核实、原纸归还与实际步行照常进行，既付成本不返还。' },
  { id: 'root-impact', title: '同一原根垫的一次承冲', story: '同一原枯样始终是死亡的零活性样本。本人可在亲持原根垫上尝试一次轻小冲击：有效承冲或普通支撑都实损2健康、15完整度，无有效承冲时实损5健康；也可免费取消未发生的冲击。' },
];
function preferred(s: SliceState, actions: NatureWalkerLifeAction[]): NatureWalkerLifeAction | undefined {
  const l = s.natureWalker.life, p = l.site, a = current(l), enabled = actions.filter(x => x.enabled);
  const pick = (type: NatureWalkerActivityCommand['type']) => enabled.find(x => x.command.type === type);
  const walk = (to: 'OUTSIDE' | 'ANNEX_A' | 'ANNEX_B') => enabled.find(x => x.command.type === 'WALK' && x.command.to === to);
  if (!p) return undefined;
  if (l.annex.paidWeek === null) return pick('EXIT_ORIGINAL') ?? pick('INITIALISE_WORKAREA') ?? pick('RENT_ANNEX');
  if (!a) return pick('REPORT') ?? pick('OBSERVE') ?? enabled.find(x => x.command.type === 'PREPARE' && x.command.method === 'ABILITY') ?? pick('PREPARE') ?? pick('REFLECT');
  if (a.inspected) return pick('LEAVE');
  if (a.objectsReturned) return p.playerLocation === 'OUTSIDE' ? pick('INSPECT') : p.playerLocation === 'ANNEX_B' ? walk('ANNEX_A') : walk('OUTSIDE');
  if (a.resultRead) return pick('RETURN_OBJECTS');
  if (a.stopped) return pick('ORDINARY_CARE') ?? pick('CANCEL_IMPACT') ?? pick('CANCEL_CASE');
  if (p.playerLocation === 'OUTSIDE') return walk('ANNEX_A') ?? pick('CANCEL_CASE');
  if (!a.objectsSetup) return pick('CHECK_ORIGINALS') ?? pick('CONSENT_OWNER') ?? pick('SETUP_OBJECTS') ?? pick('CANCEL_CASE');
  if (p.playerLocation === 'ANNEX_A') return walk('ANNEX_B');
  if (!a.sampleChecked) return pick('CHECK_SAMPLE');
  if (l.activeCase === 'root-impact') return pick('ROOT_BEARING') ?? (l.operation.rootBearing ? pick('APPLY_IMPACT') : undefined) ?? pick('ORDINARY_SUPPORT') ?? pick('CANCEL_IMPACT');
  if (l.activeCase === 'withdrawn-care' && a.consent === 'GRANTED') return pick('LIVING_RESPONSE') ?? pick('WITHDRAW_PERMISSION');
  return pick('LIVING_RESPONSE') ?? enabled.find(x => x.command.type === 'CARE_CHECK' && x.command.response === 'COOPERATE') ?? pick('ORDINARY_CARE') ?? pick('CANCEL_CASE');
}
export function natureWalkerLifeActions(s: SliceState): NatureWalkerLifeAction[] {
  const l = s.natureWalker.life;
  if (!promoted(s) || !l.site || s.natureWalker.encounter.status !== 'AVAILABLE' || s.natureWalker.encounter.preparation) return [];
  const out: NatureWalkerLifeAction[] = [];
  const add = (command: NatureWalkerActivityCommand) => {
    const reason = blockNatureWalkerLife(s, command), paid = commandCost(command, null, l), cost = [`${paid.actions}行动`];
    if (paid.pennies) cost.push(`${paid.pennies}便士`); if (paid.spirituality) cost.push('8灵性', '成功2精神／失败4精神', command.type === 'ROOT_BEARING' ? '意志18' : '知识18', '1份有限材料');
    if (paid.health) cost.push(`本人${paid.health}健康`, '原根垫15完整度'); if (command.type === 'SETUP_OBJECTS') cost.push('3合作额度', '莉娜1精神');
    if (command.type === 'WALK' || command.type === 'EXIT_ORIGINAL') cost.push('实走4米／4秒'); if (command.type === 'WAIT_EFFECT') cost.push(`${Math.max(0, (effect(l)?.expiresAt ?? l.site!.clockSeconds) - l.site!.clockSeconds)}秒`);
    if (command.type === 'CARE_CHECK') cost.push('本人知识20独立检查');
    const suffix = command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（有限能力）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATIONS[command.to]}` : command.type === 'CARE_CHECK' ? command.response === 'COOPERATE' ? '（照料员当前合作）' : '（尊重照料员抗拒）' : '';
    out.push({ id: `NW1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'WALK' ? `:${command.to}` : command.type === 'PREPARE' ? `:${command.method}` : command.type === 'CARE_CHECK' ? `:${command.response}` : ''}`,
      label: LABELS[command.type] + suffix, cost: cost.join(' · '), enabled: reason === null, reason, command,
      cleanup: ['EXIT_ORIGINAL', 'WALK', 'STOP', 'CANCEL_CASE', 'CANCEL_IMPACT', 'WITHDRAW_PERMISSION', 'WAIT_EFFECT', 'ORDINARY_CARE', 'RETURN_OBJECTS', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW'].includes(command.type) });
  };
  if (l.annex.paidWeek === null) { add({ type: l.site.playerLocation === 'START' ? 'EXIT_ORIGINAL' : 'INITIALISE_WORKAREA' }); if (out[0]?.enabled) out[0].preferredAction = true; return out; }
  const id = l.activeCase ?? NATURE_WALKER_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); if (out[0]?.enabled) out[0].preferredAction = true; return out; }
  const r = l.cases[id];
  if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id });
  if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); }
  if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) {
    for (const type of STEPS) if (!['OBSERVE', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(type)) { const command: NatureWalkerActivityCommand = { type, caseId: id }; if (!localBlock(l, command, s.week)) add(command); }
    for (const to of ['OUTSIDE', 'ANNEX_A', 'ANNEX_B'] as const) { const command: NatureWalkerActivityCommand = { type: 'WALK', caseId: id, to }; if (!localBlock(l, command, s.week)) add(command); }
    for (const response of ['COOPERATE', 'RESIST'] as const) { const command: NatureWalkerActivityCommand = { type: 'CARE_CHECK', caseId: id, response }; if (!localBlock(l, command, s.week)) add(command); }
  }
  const next = preferred(s, out); if (next) next.preferredAction = true; return out;
}
const naturalText = (text: string): string => text.replaceAll('CB3-LIVE-1', '第一株原活苗').replaceAll('CB3-LIVE-2', '第二株原活苗').replaceAll('CB3-DRY-1', '同一原枯样');
function projectAttempt(a: NatureWalkerAttempt, l: NatureWalkerLifeState): NatureWalkerAttemptProjection {
  const activeEffect = current(l) === a ? effect(l) : null;
  return { method: a.method, consent: a.consent, closed: a.closed, stopped: a.stopped, cancelled: a.cancelled, permissionWithdrawn: a.permissionWithdrawn,
    checkedAlive: a.checkedAlive, checkedVitality: a.checkedVitality, livingResponseTier: a.livingResponseTier, rootBearingTier: a.rootBearingTier, careTier: a.careTier, careAssisted: a.careAssisted, careResponse: a.careResponse,
    effectRemainingSeconds: activeEffect ? Math.max(0, activeEffect.expiresAt - l.site!.clockSeconds) : 0,
    impact: a.impact ? { at: a.impact.at, mode: a.impact.mode, healthLoss: a.impact.healthLoss, padWear: a.impact.padWear, rootBearingApplied: a.impact.rootBearingApplied } : null,
    resultRead: a.resultRead, objectsReturned: a.objectsReturned, result: a.result, elapsedSeconds: a.elapsedSeconds, playerTravelMetres: a.playerTravelMetres,
    spiritualitySpent: a.spiritualitySpent, mindSpent: a.mindSpent, healthLost: a.healthLost, effortSpent: a.effortSpent, recipientMindSpent: a.recipientMindSpent, evidence: a.evidence.map(naturalText) };
}
export function projectNatureWalkerLife(s: SliceState): NatureWalkerLifeProjection {
  const l = s.natureWalker.life, p = getNatureWalkerCurrentSite(s), pad = l.rootPad ?? s.barrenMatriarch.life.rootPad, a = current(l), actions = natureWalkerLifeActions(s), next = preferred(s, actions), activeEffect = effect(l);
  return { title: '邻圃的有限生机辨应与根系承冲', story: NATURE_WALKER_LIFE_STORY, environment: NATURE_WALKER_LIFE_ENVIRONMENT,
    nextStep: next?.label ?? (l.reflected ? '三案已如实收束；原人原物、实际生命、精神成本与根垫磨损继续保留。' : l.annex.paidWeek === null && p.playerLocation === 'OUTSIDE' ? '已普通离开旧苗圃；有余力时再决定是否支付相邻工作区费用。' : '先完成眼前普通收尾；需要行动时可在接触结束后工作或休养。'), preferredActionId: next?.id ?? null,
    facts: [`本人在${LOCATIONS[p.playerLocation]}，累计普通步行${p.playerTravelMetres}米，现场时钟${p.clockSeconds}秒。`,
      `艾达46岁、莉娜39岁，均仍活着并有独立意愿；莉娜当前精神${p.recipient.mind}。`,
      `两株同一原活苗当前活性${p.samples[0]!.vitality}和${p.samples[1]!.vitality}，同一原枯样仍死亡、活性${p.samples[2]!.vitality}；没有生命补满或复活。`,
      `同一原根垫当前完整度${pad.integrity}，本阶段接续时为50；旧护腕尚余${p.guard.segments.filter(x => x.status === 'UNUSED').length}段，没有复制、补发或重复扣旧段。`,
      `本阶段实际合作已耗${l.annex.effortSpent}/9额度，已付费施术材料余${l.annex.supportPieces}份。`,
      '原马丁与诺兰此前的停手和身体后果仍留在旧现场记录；本案不重打旧战斗，也不重复改变本人的性别。',
      '辨应只帮助本人下一次同株照料检查；承冲只作用于本人原根垫上的一次可见冲击。拒绝、抗拒、停止和普通退出始终可行。'],
    activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres,
    currentAttempt: a ? projectAttempt(a, l) : null,
    rootPad: { title: '本人同一原根纤维垫', owner: pad.owner === 'PLAYER' ? '本人' : '供应商', holder: pad.holder === 'PLAYER' ? '本人亲持' : pad.holder === 'GROUND' ? '地上' : '供应库存', location: LOCATIONS[pad.location], integrity: pad.integrity, acquired: pad.acquiredWeek !== null },
    site: { title: l.annex.paidWeek === null ? '旧苗圃外与待布置邻圃' : '实际付费的相邻两标位工作区', owner: `艾达·芬恩在${LOCATIONS[p.owner.location]}`, recipient: `莉娜·肖在${LOCATIONS[p.recipient.location]}`,
      samples: p.samples.map(x => `${naturalText(x.id)}：${x.massGrams}克，${x.alive ? '仍活着' : '已死亡'}，活性${x.vitality}，在${LOCATIONS[x.location]}`),
      paper: `同一原纸在${LOCATIONS[p.paper.location]}，原文字与旧记录保留，当前记录${p.paper.records.length}条`,
      box: `同一原匣在${LOCATIONS[p.box.location]}，${p.box.sampleId ? '实际装有同一原枯样' : '空匣'}，容量一件、上限一千克`, tag: `同一原牌在${LOCATIONS[p.tag.location]}` },
    annex: { title: '相邻两标位工作区', paid: l.annex.paidWeek !== null, supportPieces: l.annex.supportPieces, effortSpent: l.annex.effortSpent, effortLimit: 9, recipientMind: p.recipient.mind, ownerTravelMetres: l.annex.ownerTravelMetres, recipientTravelMetres: l.annex.recipientTravelMetres },
    effectRemainingSeconds: activeEffect ? Math.max(0, activeEffect.expiresAt - p.clockSeconds) : 0,
    cases: CASES.map(d => { const r = l.cases[d.id]; return { id: d.id, title: d.title, story: d.story, observations: r.attempts.flatMap(x => x.evidence.map(naturalText)), status: r.status, method: r.method,
      result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '已核实真实有限应用并实际归物离场。' : '已如实记录普通完成或取消；未应用的能力没有掌握奖励。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: r.attempts.map(x => projectAttempt(x, l)) }; }), actions };
}

/** Immutable identities and source history are preserved; replay proves every mutable field. */
export function validateNatureWalkerSceneOriginal(v: unknown, original?: BarrenMatriarchSceneRoot): v is NatureWalkerSite {
  try {
    if (!record(v)) return false; const p = v as unknown as NatureWalkerSite;
    if (p.siteId !== 'CB3-NURSERY-TRANSFER' || !integer(p.clockSeconds) || !integer(p.externalSeconds) || !integer(p.playerTravelMetres) || !Object.keys(LOCATIONS).includes(p.playerLocation)
      || !record(p.owner) || !record(p.recipient) || p.owner.id !== 'CB3-ADA' || p.owner.name !== '艾达·芬恩' || p.owner.age !== 46 || p.recipient.id !== 'CB3-LENA' || p.recipient.name !== '莉娜·肖' || p.recipient.age !== 39
      || ![p.owner, p.recipient].every(x => x.alive === true && x.independentMind === true && x.health === 100 && integer(x.mind, 0, 100) && same(x.injuries, []) && Object.keys(LOCATIONS).includes(x.location))) return false;
    if (!Array.isArray(p.samples) || p.samples.length !== 3 || !Array.isArray(p.pads) || p.pads.length !== 3 || !record(p.paper) || !record(p.box) || !record(p.tag) || !record(p.guard)) return false;
    if (!same(p.samples.map(x => x.id), ['CB3-LIVE-1', 'CB3-LIVE-2', 'CB3-DRY-1']) || !p.samples.every((x, i) => x.owner === 'OWNER' && x.quantity === 1 && x.massGrams === (i < 2 ? 500 : 100) && x.alive === (i < 2) && x.vitality === (i < 2 ? 47 : 0) && integer(x.handovers) && integer(x.returns) && Object.keys(LOCATIONS).includes(x.location))) return false;
    if (p.paper.id !== 'CB3-RECORD' || !Array.isArray(p.paper.records) || !p.paper.records.every(x => typeof x === 'string') || !integer(p.paper.readings) || p.box.id !== 'CB3-CASE' || p.box.quantity !== 1 || p.box.capacity !== 1 || p.box.maximumMassGrams !== 1000 || !integer(p.box.returns) || p.tag.id !== 'CB3-TAG') return false;
    if (![p.paper, p.box, p.tag, ...p.pads].every(x => Object.keys(LOCATIONS).includes(x.location)) || !same(p.pads.map(x => x.id), ['CB3-PAD-1', 'CB3-PAD-2', 'CB3-PAD-3'])) return false;
    if (original) {
      if (!shape(p, Object.keys(original)) || !same(p.cases, original.cases) || !same(p.kit, original.kit) || p.reflected !== original.reflected || p.activeCase !== original.activeCase || p.introducedWeek !== original.introducedWeek || !same(p.introducedDate, original.introducedDate) || p.externalSeconds < original.externalSeconds
        || p.clockSeconds < original.clockSeconds || p.playerTravelMetres < original.playerTravelMetres || p.owner.mind > original.owner.mind || p.recipient.mind > original.recipient.mind) return false;
      for (const key of ['owner', 'recipient'] as const) if (!same({ ...p[key], location: original[key].location, mind: original[key].mind, consent: original[key].consent }, original[key])) return false;
      for (const [i, x] of p.samples.entries()) { const o = original.samples[i]!; if (!same({ ...x, location: o.location, holder: o.holder, care: o.care, handovers: o.handovers, returns: o.returns }, o) || x.handovers < o.handovers || x.returns < o.returns) return false; }
      if (!same({ ...p.paper, location: original.paper.location, holder: original.paper.holder, readings: original.paper.readings, records: original.paper.records }, original.paper) || p.paper.readings < original.paper.readings || !same(p.paper.records.slice(0, original.paper.records.length), original.paper.records)) return false;
      if (!same({ ...p.box, location: original.box.location, holder: original.box.holder, sampleId: original.box.sampleId, returns: original.box.returns }, original.box) || p.box.returns < original.box.returns || !same({ ...p.tag, location: original.tag.location }, original.tag)) return false;
      if (!p.pads.every((x, i) => same({ ...x, location: original.pads[i]!.location }, original.pads[i]))) return false;
      if (!same({ ...p.guard, segments: original.guard.segments }, original.guard) || !shape(p.guard.segments, Object.keys(original.guard.segments)) || p.guard.segments.some((x, i) => x.id !== original.guard.segments[i]!.id || !['UNUSED', 'SPENT'].includes(x.status) || original.guard.segments[i]!.status === 'SPENT' && x.status !== 'SPENT')) return false;
    }
    return true;
  } catch { return false; }
}
export const validateNatureWalkerSite = validateNatureWalkerSceneOriginal;
export function validateNatureWalkerSceneSource(v: unknown, s: SliceState): v is NatureWalkerSceneSource {
  try {
    if (!record(v) || !shape(v, ['promotionWeek', 'originals']) || v.promotionWeek !== s.natureWalker.promotionWeek || !integer(v.promotionWeek, 1, s.week) || !record(v.originals) || !shape(v.originals, ['site', 'operation', 'rootPad'])) return false;
    const source = v as unknown as NatureWalkerSceneSource, p = source.originals.site, pad = source.originals.rootPad;
    if (!same(p, s.coffinBearer.life) || !same(source.originals.operation, s.barrenMatriarch.life.operation) || !same(pad, s.barrenMatriarch.life.rootPad) || !validateNatureWalkerSceneOriginal(p, p)) return false;
    if (s.natureWalker.sourceScene && !same(source.originals, s.natureWalker.sourceScene.originals)) return false;
    return p.playerLocation === 'START' && p.clockSeconds === 834 && p.playerTravelMetres === 124 && p.owner.location === 'OUTSIDE' && p.recipient.location === 'OUTSIDE' && p.owner.mind === 100 && p.recipient.mind === 100
      && [p.paper, p.box, p.tag, ...p.pads].every(x => x.holder === 'OWNER' && x.location === 'OUTSIDE') && p.box.sampleId === null && p.samples.every(x => x.location === 'OUTSIDE' && x.holder === (x.id === 'CB3-LIVE-1' ? 'RECIPIENT' : 'OWNER'))
      && p.guard.id === 'CB3-GUARD' && p.guard.prepared && p.guard.owner === 'PLAYER' && p.guard.location === 'HAND' && same(p.guard.segments.map(x => x.status), ['SPENT', 'UNUSED', 'UNUSED'])
      && pad.id === 'BM2-ROOT-PAD' && pad.sourceId === 'BM2-ROOT-FIBRE-STOCK' && pad.material === 'PLANT_FIBRE' && pad.quantity === 1 && pad.owner === 'PLAYER' && pad.holder === 'PLAYER' && pad.location === 'START' && pad.integrity === 50 && integer(pad.acquiredWeek, 1, s.week)
      && same(source.originals.operation, { dormancy: null, buffer: null });
  } catch { return false; }
}
function validBudget(before: NatureWalkerLifeBudget, after: NatureWalkerLifeBudget, paid: NatureWalkerLifeCost, c: NatureWalkerActivityCommand): boolean {
  const keys = ['actions', 'health', 'mind', 'spirituality', 'cash'];
  if (!record(before) || !record(after) || !shape(before, keys) || !shape(after, keys)) return false;
  for (const b of [before, after]) if (!integer(b.actions) || !integer(b.cash) || !integer(b.health, 1, 100) || !integer(b.mind, 0, 100) || !integer(b.spirituality, 0, 120)) return false;
  return before.actions >= paid.actions + reserve(c) && (!paid.spirituality || before.mind >= 4 && before.health > 5) && (!paid.health || before.health > 5)
    && after.actions === before.actions - paid.actions && after.health === before.health - paid.health && after.mind === before.mind - paid.mind && after.spirituality === before.spirituality - paid.spirituality && after.cash === before.cash - paid.pennies;
}
interface NatureWalkerLifeReplay { root: NatureWalkerSite; rootPad: NatureWalkerRootPad; life: NatureWalkerLifeState }
function replayLife(s: SliceState): NatureWalkerLifeReplay | null {
  try {
    const l = s.natureWalker?.life, blank = createNatureWalkerLifeState();
    if (!record(l) || !shape(l, Object.keys(blank)) || !validateNatureWalkerSceneSource(l.source, s) || !record(l.cases) || !shape(l.cases, NATURE_WALKER_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 250 || !Array.isArray(l.movements) || !validateNatureWalkerSceneOriginal(l.site, l.source.originals.site)) return null;
    const expected = fromSource(l.source); let previous: NatureWalkerLifeEvent | null = null, lastWeek = l.source.promotionWeek, revision = 0, cursor = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'before', 'after', 'paid', 'randomCursor', 'randomBefore', 'randomAfter', 'check', 'tier', 'source', 'clockBefore', 'clockAfter', 'padBefore', 'padAfter'])
        || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0
        || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateNatureWalkerActivityCommand(raw.command)) return null;
      const e = raw as unknown as NatureWalkerLifeEvent, c = e.command, wasOpen = open(expected), paid = commandCost(c, e.tier, expected);
      if (!integer(e.randomCursor, cursor, s.random.cursor) || e.clockBefore !== expected.site!.clockSeconds || !same(e.padBefore, expected.rootPad) || localBlock(expected, c, e.week) || !same(e.paid, paid) || !validBudget(e.before, e.after, paid, c)) return null;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date))) return null;
      if (previous && (wasOpen || e.revision === previous.revision + 1 && e.week === previous.week && previous.after.actions > 0) && (!same(e.before, previous.after) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
      const acquisition = s.natureWalker.acquisitionJournal.at(-1);
      if (!previous && acquisition && e.revision === acquisition.revision + 1 && e.week === acquisition.week && acquisition.after.actions > 0 && (!same(e.before, { actions: acquisition.after.actions, health: acquisition.after.health, mind: acquisition.after.mind, spirituality: acquisition.after.spirituality, cash: acquisition.after.cash }) || e.randomCursor !== acquisition.cursorAfter)) return null;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      const core = c.type === 'ROOT_BEARING' ? 'will' : 'knowledge'; if (e.source && base > s.character.coreStats[core]) return null;
      const source = checkSource(expected, c, base, s.character.name, s.character.gender); if (!same(e.source, source)) return null;
      if (source) {
        if (e.randomBefore !== e.randomCursor || !integer(e.randomBefore, cursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return null;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: source.coreStat, baseAbility: base, difficulty: source.difficulty, modifiers: modifiersFor(source), roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return null;
      } else if (e.randomBefore !== null || e.randomAfter !== null || e.check !== null || e.tier !== null) return null;
      evolve(expected, c, e.week, e.date, e.revision, e.tier);
      if (e.clockAfter !== expected.site!.clockSeconds || !same(e.padAfter, expected.rootPad)) return null;
      expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision; cursor = e.randomAfter ?? e.randomCursor;
    }
    if (!same({ ...l, site: expected.site, rootPad: expected.rootPad }, expected)) return null;
    if (open(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.natureWalker.encounter.preparation || s.natureWalker.encounter.status !== 'AVAILABLE'
        || !previous || previous.week !== s.week || !same(previous.date, s.date) || s.random.cursor !== cursor || !same(budget(s), previous.after)) return null;
    }
    if (previous && !s.natureWalker.encounter.preparation && s.revision === previous.revision + 1 && previous.week === s.week && previous.after.actions > 0 && (s.random.cursor !== cursor || !same(budget(s), previous.after))) return null;
    return { root: expected.site!, rootPad: expected.rootPad!, life: expected };
  } catch { return null; }
}
export function replayNatureWalkerLifeRoot(s: SliceState): NatureWalkerSite | null { return replayLife(s)?.root ?? null; }
export const replayNatureWalkerLifeSite = replayNatureWalkerLifeRoot;
export function replayNatureWalkerLifeRootPad(s: SliceState): NatureWalkerRootPad | null { return replayLife(s)?.rootPad ?? null; }
export function getNatureWalkerLifeMasteryGains(l: NatureWalkerLifeState): Record<NatureWalkerLifeAbilityId, number> {
  const gains = { [RESPONSE]: 0, [BEARING]: 0 };
  for (const id of NATURE_WALKER_CASE_IDS) { const r = l.cases[id]; if (r.status === 'RESOLVED') for (const ability of r.attempts.at(-1)?.appliedAbilityIds ?? []) gains[ability] += 8; } return gains;
}
export const natureWalkerLifeMasteryGains = (s: SliceState): Record<NatureWalkerLifeAbilityId, number> => getNatureWalkerLifeMasteryGains(s.natureWalker.life);
export function validateNatureWalkerLifeState(s: SliceState): boolean {
  try {
    const l = s.natureWalker?.life; if (l?.source === null) return s.natureWalker.promotionWeek === null && same(l, createNatureWalkerLifeState());
    const replay = replayLife(s); if (!replay) return false;
    if (!s.natureWalker.encounter.preparation) return same(l.site, replay.root) && same(l.rootPad, replay.rootPad);
    if (open(l) || !l.reflected || !returnedAt(replay.life, 'OUTSIDE') || !Object.values(l.cases).every(r => r.status === 'RESOLVED')) return false;
    const physical = replayNatureWalkerEncounterPhysical(s, replay.root, replay.rootPad); return !!physical && same(l.site, physical.site) && same(l.rootPad, physical.rootPad);
  } catch { return false; }
}
export const validateNatureWalkerLife = validateNatureWalkerLifeState;
