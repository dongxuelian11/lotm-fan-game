import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { hasDeceitMentorLifeLock } from '../deceit-mentor/life.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

/** Authored, finite registry practice. Combat owns its own later scene; this journal never changes for it. */
export const FATE_TROJAN_CASE_IDS = ['identity-link', 'fate-assumption', 'revoked-link'] as const;
export const FATE_TROJAN_ACTIVITY_CASE_IDS = FATE_TROJAN_CASE_IDS;
export const ACTIVITY_CASE_IDS = FATE_TROJAN_CASE_IDS;
export type FateTrojanCaseId = typeof FATE_TROJAN_CASE_IDS[number];
export type FateTrojanLifeAbilityId = 'error.s2.identity-link' | 'error.s2.fate-assumption';
export type FateTrojanLocation = 'ENTRY' | 'DESK' | 'CABINET' | 'OUTSIDE' | 'YARD';
export type FateTrojanConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export type FateTrojanWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'RETURNED';
const STEPS = ['OBSERVE', 'CONSENT_OPERATOR', 'CONSENT_OWNER', 'TAKE_IDENTITY', 'TAKE_FATE', 'OPEN_CABINET', 'CLOSE_CABINET',
  'RETURN_LINK', 'CARRY_PARCEL', 'WITHDRAW_PERMISSION', 'RETURN_SEAL', 'STOP', 'WAIT_10', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type FateTrojanActivityCommand =
  | { type: typeof STEPS[number]; caseId: FateTrojanCaseId }
  | { type: 'PREPARE'; caseId: FateTrojanCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WALK'; caseId: FateTrojanCaseId; to: Exclude<FateTrojanLocation, 'YARD'> }
  | { type: 'REFLECT' };
export interface FateTrojanSeal {
  id: string; caseId: FateTrojanCaseId; ownerId: 'FT2-LINA'; quantity: 1; charges: 0 | 1;
  location: 'PLAYER' | 'DESK'; paidPennies: 20; preparedWeek: number;
}
export interface FateTrojanSiteState {
  siteId: 'FT2-REGISTRY'; introducedWeek: number | null; introducedDate: PublicGameDate | null;
  clockSeconds: number; playerLocation: FateTrojanLocation; playerTravelMetres: number; playerEnergy: number;
  lina: { id: 'FT2-LINA'; name: '莉娜'; age: 39; alive: true; location: 'DESK' | 'OUTSIDE'; energy: number; travelMetres: number };
  victor: { id: 'FT2-VICTOR'; name: '维克托'; age: 43; alive: true; location: 'DESK' | 'CABINET' | 'OUTSIDE'; energy: number; travelMetres: number };
  cabinet: { id: 'FT2-CABINET'; ownerId: 'FT2-VICTOR'; quantity: 1; location: 'CABINET'; recognitionHolder: 'OWNER' | 'PLAYER'; open: boolean; playerOpenings: number; ownerOpenings: number };
  parcel: { id: 'FT2-PARCEL'; ownerId: 'FT2-VICTOR'; quantity: 1; location: 'CABINET' | 'OUTSIDE'; ordinaryMetres: number; /** Historical last carrier; OUTSIDE means physically delivered and put down. */ carriedBy: 'PLAYER' | null };
  link: { id: 'FT2-RECOGNITION'; ownerId: 'FT2-VICTOR'; holder: 'OWNER' | 'PLAYER'; returnPending: boolean; windowExpiresAt: number | null };
  fate: { id: 'FT2-ONE-CARRY'; parcelId: 'FT2-PARCEL'; originalDebtor: 'FT2-VICTOR'; debtor: 'OWNER' | 'PLAYER';
    from: 'CABINET'; to: 'OUTSIDE'; status: 'PENDING' | 'ASSUMED' | 'COMPLETED'; offeredPennies: 12; escrowPennies: number;
    benefitRecipient: 'OWNER' | 'PLAYER'; paidToPlayer: number; ownerRelieved: boolean; burdenHealth: 5; burdenEnergy: 5; incurredHealth: number; incurredEnergy: number };
  seals: FateTrojanSeal[];
}
export interface FateTrojanMovement { from: FateTrojanLocation; to: FateTrojanLocation; mode: 'WALK'; metres: number; seconds: number; parcelId: 'FT2-PARCEL' | null }
export interface FateTrojanAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  stopped: boolean; inspected: boolean; permissionWithdrawn: boolean; elapsedSeconds: number; playerTravelMetres: number;
  energySpent: number; spiritualitySpent: number; penniesSpent: 20; healthSpent: number; benefitReceived: number;
  operatorConsent: FateTrojanConsent; ownerConsent: FateTrojanConsent; consentWeek: number;
  sealId: string; sealReturned: boolean; abilityTier: PublicResolutionTier | null; window: FateTrojanWindow; windowExpiresAt: number | null;
  identityTaken: boolean; identityUsed: boolean; linkReturned: boolean; fateTaken: boolean; parcelCarried: boolean; waits: number;
  appliedAbilityIds: FateTrojanLifeAbilityId[]; playerMoves: FateTrojanMovement[]; siteAtStart: FateTrojanSiteState; siteAtClose: FateTrojanSiteState | null;
}
export interface FateTrojanCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  operatorConsentWeek: number | null; ownerConsentWeek: number | null; preparations: number; closes: number; withdrawals: number;
  observation: { cabinetId: 'FT2-CABINET'; linkId: 'FT2-RECOGNITION'; parcelId: 'FT2-PARCEL'; parcelLocation: 'CABINET' | 'OUTSIDE';
    obligationId: 'FT2-ONE-CARRY'; debtor: 'OWNER' | 'PLAYER'; status: FateTrojanSiteState['fate']['status']; offeredPennies: 12; burdenHealth: 5; burdenEnergy: 5; walkedMetres: 12 } | null;
  attempts: FateTrojanAttempt[];
}
export interface FateTrojanCheckSource {
  caseId: FateTrojanCaseId; abilityId: FateTrojanLifeAbilityId; cost: 8; difficulty: 20; coreStat: 'knowledge' | 'will'; baseAbility: number;
  actor: { pathwayId: 'error'; sequence: 2; name: string; gender: string }; operatorConsentWeek: number; ownerConsentWeek: number;
  at: number; site: FateTrojanSiteState;
}
export interface FateTrojanCost { actions: number; spirituality: number; pennies: number; health: number; energy: number; cashGained: number }
export interface FateTrojanBudget {
  actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number;
  healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number; energyBefore: number; energyAfter: number;
}
export interface FateTrojanLifeEvent {
  week: number; date: PublicGameDate; command: FateTrojanActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: FateTrojanCheckSource | null;
  paid: FateTrojanCost; budget: FateTrojanBudget;
}
export interface FateTrojanLifeState { activeCase: FateTrojanCaseId | null; reflected: boolean; site: FateTrojanSiteState; cases: Record<FateTrojanCaseId, FateTrojanCaseState>; journal: FateTrojanLifeEvent[] }
export interface FateTrojanLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FateTrojanActivityCommand }
export interface FateTrojanLifeProjection {
  title: string; story: string; environment: string; activeCase: FateTrojanCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: FateTrojanSiteState; clockSeconds: number; playerLocation: FateTrojanLocation; playerTravelMetres: number;
  playerCanOpenCabinet: boolean; ownerCanOpenCabinet: boolean; currentAttempt: FateTrojanAttempt | null;
  cases: { id: FateTrojanCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null;
    result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: FateTrojanAttempt[] }[];
  actions: FateTrojanLifeAction[];
}
/** Structural boundary also lets this isolated candidate typecheck before the root is wired. */
type FateTrojanHost = SliceState & { fateTrojan: { life: FateTrojanLifeState; promotionWeek: number | null; preparedWeek: number | null; encounter: { status: string; startSite?: FateTrojanSiteState | null } } };
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const POSITION: Record<FateTrojanLocation, number> = { ENTRY: 0, DESK: 2, CABINET: 6, OUTSIDE: -2, YARD: -4 };
const LOCATIONS = ['ENTRY', 'DESK', 'CABINET', 'OUTSIDE'] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 2;
const distance = (from: FateTrojanLocation, to: FateTrojanLocation) => Math.abs(POSITION[from] - POSITION[to]);
const freshCase = (): FateTrojanCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false,
  operatorConsentWeek: null, ownerConsentWeek: null, preparations: 0, closes: 0, withdrawals: 0, observation: null, attempts: [] });
export function createFateTrojanSiteState(): FateTrojanSiteState {
  return { siteId: 'FT2-REGISTRY', introducedWeek: null, introducedDate: null, clockSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, playerEnergy: 100,
    lina: { id: 'FT2-LINA', name: '莉娜', age: 39, alive: true, location: 'DESK', energy: 100, travelMetres: 0 },
    victor: { id: 'FT2-VICTOR', name: '维克托', age: 43, alive: true, location: 'DESK', energy: 100, travelMetres: 0 },
    cabinet: { id: 'FT2-CABINET', ownerId: 'FT2-VICTOR', quantity: 1, location: 'CABINET', recognitionHolder: 'OWNER', open: false, playerOpenings: 0, ownerOpenings: 0 },
    parcel: { id: 'FT2-PARCEL', ownerId: 'FT2-VICTOR', quantity: 1, location: 'CABINET', ordinaryMetres: 0, carriedBy: null },
    link: { id: 'FT2-RECOGNITION', ownerId: 'FT2-VICTOR', holder: 'OWNER', returnPending: false, windowExpiresAt: null },
    fate: { id: 'FT2-ONE-CARRY', parcelId: 'FT2-PARCEL', originalDebtor: 'FT2-VICTOR', debtor: 'OWNER', from: 'CABINET', to: 'OUTSIDE', status: 'PENDING',
      offeredPennies: 12, escrowPennies: 12, benefitRecipient: 'OWNER', paidToPlayer: 0, ownerRelieved: false, burdenHealth: 5, burdenEnergy: 5, incurredHealth: 0, incurredEnergy: 0 }, seals: [] };
}
export function createFateTrojanLifeState(): FateTrojanLifeState {
  return { activeCase: null, reflected: false, site: createFateTrojanSiteState(), cases: { 'identity-link': freshCase(), 'fate-assumption': freshCase(), 'revoked-link': freshCase() }, journal: [] };
}
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', id: FateTrojanCaseId, p: FateTrojanSiteState): FateTrojanAttempt {
  return { week, method, closed: false, result: 'NONE', stopped: false, inspected: false, permissionWithdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0,
    energySpent: 0, spiritualitySpent: 0, penniesSpent: 20, healthSpent: 0, benefitReceived: 0, operatorConsent: 'GRANTED', ownerConsent: 'GRANTED', consentWeek: week,
    sealId: `FT2-SEAL:${id}`, sealReturned: false, abilityTier: null, window: 'NONE', windowExpiresAt: null,
    identityTaken: false, identityUsed: false, linkReturned: false, fateTaken: false, parcelCarried: false, waits: 0,
    appliedAbilityIds: [], playerMoves: [], siteAtStart: structuredClone(p), siteAtClose: null };
}
const current = (l: FateTrojanLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: FateTrojanLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
function cleanupBlock(l: FateTrojanLifeState): string | null {
  const p = l.site;
  if (p.link.returnPending || p.link.holder !== 'OWNER' || p.cabinet.recognitionHolder !== 'OWNER') return '原身份联系尚未当面归还；到期、停止或退出都不免除归还。';
  if (p.fate.status === 'ASSUMED') return '你已接下这一次原包裹搬运，须实际完成；停止不能抹去已经接下的负担。';
  if (p.cabinet.open) return '先到原柜前亲手合上柜门。';
  if (p.seals.some(seal => seal.location !== 'DESK')) return '本案同一枚封签须带到登记桌实际交回，无论是否已经使用。';
  return p.playerLocation === 'ENTRY' ? null : '本人还须沿普通道路实际回到门口。';
}
export const hasFateTrojanLifeLock = (s: FateTrojanHost): boolean => contactOpen(s.fateTrojan.life) || s.fateTrojan.encounter.status === 'AVAILABLE' && cleanupBlock(s.fateTrojan.life) !== null;
export const fateTrojanInside = hasFateTrojanLifeLock;
export const fateTrojanLifeClosed = (s: FateTrojanHost): boolean => !hasFateTrojanLifeLock(s) && Object.values(s.fateTrojan.life.cases).every(r => r.status === 'RESOLVED');
export function validateFateTrojanActivityCommand(v: unknown): v is FateTrojanActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!FATE_TROJAN_CASE_IDS.includes(v.caseId as FateTrojanCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && LOCATIONS.includes(v.to as typeof LOCATIONS[number]);
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isFateTrojanActivityCommand = validateFateTrojanActivityCommand;
export const isFateTrojanActivity = validateFateTrojanActivityCommand;
const consent = (a: FateTrojanAttempt, week: number) => a.operatorConsent === 'GRANTED' && a.ownerConsent === 'GRANTED' && a.consentWeek === week && !a.stopped;
function localBlock(l: FateTrojanLifeState, c: FateTrojanActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !contactOpen(l) && !cleanupBlock(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先实际收尾并如实报告三案，再完成一次反思。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = FATE_TROJAN_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[FATE_TROJAN_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '依次观察本案；原人、原柜、原包裹仍按前案真实结果保留。';
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'CONSENT_OWNER') {
    if (contactOpen(l) || cleanupBlock(l) || r.status !== 'OBSERVED') return '须已观察本案，尚未准备；两位成人仍在门口前方2米的登记桌边。';
    return (c.type === 'CONSENT_OPERATOR' ? r.operatorConsentWeek : r.ownerConsentWeek) === week ? '已记录本案本周的明确答复。' : null;
  }
  if (c.type === 'PREPARE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'OBSERVED' && r.attempts.length === 0 &&
    r.operatorConsentWeek === week && r.ownerConsentWeek === week ? null : '须先取得莉娜与维克托本案本周的明确同意；每案仅有这一枚实付封签。';
  if (c.type === 'REPORT') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'EXAMINED' ? null : '先真实归还、收尾并离开本案，再报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一案现场。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l) ?? (a.inspected ? null : '先核实本案实际结果，取消同样须真正归还和普通返回。');
  if (a.inspected) return '已核实本案，请结束接触后报告。';
  if (c.type === 'WALK') {
    if (c.to === p.playerLocation) return '你已在这里。';
    const remaining = p.playerEnergy - distance(p.playerLocation, c.to);
    const needsDesk = p.link.returnPending || p.seals.some(seal => seal.location === 'PLAYER');
    const reserve = p.fate.status === 'ASSUMED' ? distance(c.to, 'CABINET') + 27
      : p.cabinet.open ? distance(c.to, 'CABINET') + (needsDesk ? 6 : distance('CABINET', 'ENTRY'))
      : needsDesk ? distance(c.to, 'DESK') + 2 : distance(c.to, 'ENTRY');
    return remaining >= reserve ? null : '当前精力不足以走这一段并保留普通返程；不能靠退出恢复精力或归位。';
  }
  if (c.type === 'RETURN_LINK') return p.playerLocation === 'DESK' && p.link.returnPending && p.link.holder === 'PLAYER' && !p.cabinet.open ? null : '须先亲手合柜，再本人走到原主面前的登记桌归还同一联系。';
  if (c.type === 'RETURN_SEAL') return p.playerLocation === 'DESK' && !p.link.returnPending && p.fate.status !== 'ASSUMED' && !a.sealReturned ? null : '须本人在登记桌、归还联系并结清已经接下的搬运，再交回同一封签。';
  if (c.type === 'CLOSE_CABINET' && p.fate.status === 'ASSUMED') return '先履行已接下的唯一搬运，再回到原柜亲手合门；中止不删除负担。';
  if (c.type === 'CLOSE_CABINET') return p.playerLocation === 'CABINET' && p.cabinet.open ? null : '本人须实际在原柜前，柜门确实开着。';
  if (c.type === 'STOP') return !a.stopped ? null : '已停止新的施术；归还债务、实际负担和已付费用仍保留。';
  if (c.type === 'WAIT_10') return a.abilityTier !== null && a.waits < 4 ? null : '施术后每案最多等待四次10秒，等待不续窗、不搬运、不付款。';
  if (c.type === 'INSPECT') return cleanupBlock(l) ?? (c.caseId === 'revoked-link' && !a.permissionWithdrawn ? '还须读取原主支付后撤回许可的决定。' : null);
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'revoked-link' && !a.permissionWithdrawn && a.abilityTier === null && p.playerLocation === 'DESK' ? null : '本案准备费已经实付，须在登记桌读取原主当前撤回的决定，之后不取得联系。';
  if (c.type === 'CARRY_PARCEL') {
    if (c.caseId !== 'fate-assumption' || a.parcelCarried || p.parcel.location !== 'CABINET' || p.playerLocation !== 'CABINET' || !p.cabinet.open || p.fate.status === 'COMPLETED') return '须本人在原柜前，柜门已开，唯一原包裹仍在里面且这一次搬运未完成。';
    if (p.fate.status !== 'ASSUMED' && (!consent(a, week) || a.method === 'ABILITY' && a.abilityTier === null)) return '须已经接下本次负担，或在当前同意下按普通方法搬运；中止不能删去已接下的负担。';
    return p.playerEnergy >= 13 + 14 ? null : '实际搬运耗8米步行与5精力负担，还须留14精力回原柜合门、登记桌交签并普通返回。';
  }
  if (!consent(a, week) && !(c.type === 'OPEN_CABINET' && c.caseId === 'fate-assumption' && p.fate.status === 'ASSUMED')) return '本案当前许可已撤回或你已停止；普通归还与必须履行的既有负担仍可进行。';
  if (c.type === 'TAKE_IDENTITY' || c.type === 'TAKE_FATE') {
    const identity = c.type === 'TAKE_IDENTITY';
    if (c.caseId !== (identity ? 'identity-link' : 'fate-assumption') || a.method !== 'ABILITY' || a.abilityTier !== null || p.playerLocation !== 'DESK' || r.status !== 'PREPARED' || a.sealReturned) return '须本案能力准备完成，本人在登记桌；只有一次实付尝试，撤回案不能取得联系。';
    if (identity) return p.link.holder === 'OWNER' && !p.link.returnPending && p.playerEnergy >= 10 ? null : '原主须仍独占原柜的识别联系，并给本人留足普通往返精力。';
    return r.observation?.status === 'PENDING' && r.observation.debtor === 'OWNER' && p.fate.status === 'PENDING' && p.parcel.location === 'CABINET' && p.playerEnergy >= 31 ? null : '须先记录这一次真实待搬运与12便士报酬，且保留实际负担及完整返程的精力。';
  }
  if (c.type === 'OPEN_CABINET') {
    if (c.caseId === 'revoked-link' || p.playerLocation !== 'CABINET' || p.cabinet.open || a.identityUsed || a.parcelCarried) return '须本人实际走到同一原柜前，柜门尚未开启且本案尚未完成使用。';
    if (p.link.holder === 'PLAYER') return c.caseId === 'identity-link' && p.link.windowExpiresAt !== null && p.link.windowExpiresAt - p.clockSeconds >= 4 ? null : '你持有的识别窗口须还够实际开柜4秒；过期仍须归还同一联系。';
    if (c.caseId === 'identity-link' && a.method === 'ABILITY' && a.abilityTier === null) return '本案先尝试准备好的能力，或明确停止后如实收尾。';
    return p.victor.energy >= 8 ? null : '原主须保留亲自往返原柜8米的精力；普通开柜由他的原身份完成。';
  }
  return '当前阶段不能进行这一步。';
}
function commandCost(l: FateTrojanLifeState, c: FateTrojanActivityCommand): FateTrojanCost {
  const a = 'caseId' in c ? l.cases[c.caseId].attempts.at(-1) : undefined;
  const ordinaryWork = (c.type === 'OPEN_CABINET' && c.caseId === 'identity-link' || c.type === 'CARRY_PARCEL') && a?.method === 'ORDINARY';
  return { actions: ['OBSERVE', 'PREPARE', 'TAKE_IDENTITY', 'TAKE_FATE', 'REPORT', 'REFLECT'].includes(c.type) || ordinaryWork ? 1 : 0,
    spirituality: c.type === 'TAKE_IDENTITY' || c.type === 'TAKE_FATE' ? 8 : c.type === 'RETURN_LINK' ? 4 : 0,
    pennies: c.type === 'PREPARE' ? 20 : 0, health: c.type === 'CARRY_PARCEL' ? 5 : 0,
    energy: c.type === 'OBSERVE' ? 12 : c.type === 'PREPARE' ? 2 : c.type === 'WALK' ? distance(l.site.playerLocation, c.to) : c.type === 'CARRY_PARCEL' ? 13 : 0,
    cashGained: c.type === 'CARRY_PARCEL' ? 12 : 0 };
}
export function blockFateTrojanLife(s: FateTrojanHost, c: FateTrojanActivityCommand): string | null {
  if (!validateFateTrojanActivityCommand(c)) return '命运木马生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着，且当前确实是错误途径序列2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德的登记室。';
  if (hasDeceitMentorLifeLock(s) || ['READY', 'FIGHTING'].includes(s.deceitMentor.encounter.status) || s.fateTrojan.preparedWeek !== null) return '先收束旧实践、遭遇与服药准备。';
  if (s.fateTrojan.encounter.status !== 'AVAILABLE') return '本场实践已经结束并进入后续遭遇，不能重开原案或恢复物资。';
  const reason = localBlock(s.fateTrojan.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.fateTrojan.life, c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备须另留1行动，实际归还与普通返程仍为0行动。';
  if (s.cash < cost.pennies) return '本案唯一封签需实付20便士。';
  if (s.spirituality < cost.spirituality + (c.type === 'TAKE_IDENTITY' ? 4 : 0)) return c.type === 'TAKE_IDENTITY' ? '取得联系需要8灵性，并必须另留4灵性供实际归还。' : `当前不足${cost.spirituality}灵性，仍可完成普通收尾。`;
  if (cost.spirituality > 0 && s.mind <= 0) return '当前精神不足以施术；实际返程仍可进行。';
  if ((c.type === 'TAKE_FATE' || c.type === 'PREPARE' && c.caseId === 'fate-assumption' || c.type === 'CARRY_PARCEL') && s.health <= 5) return '实际搬运将承受5健康负担，须留有承受它并返回的余力。';
  if (s.fateTrojan.life.site.playerEnergy < cost.energy + (c.type === 'PREPARE' ? 2 : 0)) return '本场剩余精力不足，换案不会补充精力。';
  return null;
}
function elapse(l: FateTrojanLifeState, seconds: number, a: FateTrojanAttempt | null = current(l)): void {
  l.site.clockSeconds += seconds;
  if (a) { a.elapsedSeconds += seconds; if (a.window === 'ACTIVE' && a.windowExpiresAt !== null && l.site.clockSeconds >= a.windowExpiresAt) a.window = 'EXPIRED'; }
}
function walk(l: FateTrojanLifeState, to: FateTrojanLocation, a: FateTrojanAttempt | null = current(l), parcel = false): void {
  const p = l.site, from = p.playerLocation, metres = distance(from, to);
  p.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres;
  if (parcel) p.parcel.ordinaryMetres += metres;
  if (a) { a.playerTravelMetres += metres; a.energySpent += metres; a.playerMoves.push({ from, to, mode: 'WALK', metres, seconds: metres, parcelId: parcel ? 'FT2-PARCEL' : null }); }
  elapse(l, metres, a);
}
function checkSource(l: FateTrojanLifeState, c: FateTrojanActivityCommand, baseAbility: number, name: string, gender: string): FateTrojanCheckSource | null {
  if (c.type !== 'TAKE_IDENTITY' && c.type !== 'TAKE_FATE') return null;
  const r = l.cases[c.caseId];
  return { caseId: c.caseId, abilityId: c.type === 'TAKE_IDENTITY' ? 'error.s2.identity-link' : 'error.s2.fate-assumption', cost: 8, difficulty: 20,
    coreStat: c.type === 'TAKE_IDENTITY' ? 'knowledge' : 'will', baseAbility, actor: { pathwayId: 'error', sequence: 2, name, gender },
    operatorConsentWeek: r.operatorConsentWeek!, ownerConsentWeek: r.ownerConsentWeek!, at: l.site.clockSeconds, site: structuredClone(l.site) };
}
/** Every elapsed second, ordinary step, unique object and incurred obligation is replayed here. */
function evolve(l: FateTrojanLifeState, c: FateTrojanActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null): void {
  const p = l.site;
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, 10, null); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') {
    if (p.introducedWeek === null) { p.introducedWeek = week; p.introducedDate = structuredClone(date); }
    walk(l, 'CABINET', null); elapse(l, 4, null); walk(l, 'ENTRY', null);
    r.observation = { cabinetId: p.cabinet.id, linkId: p.link.id, parcelId: p.parcel.id, parcelLocation: p.parcel.location, obligationId: p.fate.id,
      debtor: p.fate.debtor, status: p.fate.status, offeredPennies: 12, burdenHealth: 5, burdenEnergy: 5, walkedMetres: 12 };
    r.status = 'OBSERVED'; r.observedWeek = week; return;
  }
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'CONSENT_OWNER') {
    if (c.type === 'CONSENT_OPERATOR') r.operatorConsentWeek = week; else r.ownerConsentWeek = week;
    elapse(l, 2, null); return;
  }
  if (c.type === 'PREPARE') {
    const a = freshAttempt(week, c.method, c.caseId, p); r.attempts.push(a); r.preparations++; r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId;
    p.seals.push({ id: a.sealId, caseId: c.caseId, ownerId: 'FT2-LINA', quantity: 1, charges: 1, location: 'PLAYER', paidPennies: 20, preparedWeek: week });
    walk(l, 'DESK', a); elapse(l, 4, a); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, 4, null); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) {
    a.closed = true; a.operatorConsent = 'CLOSED'; if (a.ownerConsent !== 'WITHDRAWN') a.ownerConsent = 'CLOSED';
    r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++;
    elapse(l, 2, a); a.siteAtClose = structuredClone(p); l.activeCase = null; return;
  }
  switch (c.type) {
    case 'WALK': walk(l, c.to, a); break;
    case 'TAKE_IDENTITY': case 'TAKE_FATE': {
      p.seals.find(seal => seal.id === a.sealId)!.charges = 0; a.abilityTier = tier; a.spiritualitySpent += 8; r.status = 'ACTIVE'; elapse(l, 4, a);
      if (c.type === 'TAKE_IDENTITY') {
        a.window = success(tier) ? 'ACTIVE' : 'FAILED';
        if (success(tier)) { a.identityTaken = true; a.windowExpiresAt = p.clockSeconds + 20; p.link.holder = p.cabinet.recognitionHolder = 'PLAYER'; p.link.returnPending = true; p.link.windowExpiresAt = a.windowExpiresAt; }
      } else if (success(tier)) { a.fateTaken = true; p.fate.status = 'ASSUMED'; p.fate.debtor = p.fate.benefitRecipient = 'PLAYER'; p.fate.ownerRelieved = true; }
      break;
    }
    case 'OPEN_CABINET': {
      if (p.link.holder === 'PLAYER') { elapse(l, 4, a); a.identityUsed = true; a.appliedAbilityIds.push('error.s2.identity-link'); p.cabinet.playerOpenings++; }
      else { p.victor.location = 'CABINET'; p.victor.travelMetres += 4; p.victor.energy -= 4; elapse(l, 4, a);
        elapse(l, 4, a); p.victor.location = 'DESK'; p.victor.travelMetres += 4; p.victor.energy -= 4; elapse(l, 4, a); p.cabinet.ownerOpenings++; }
      p.cabinet.open = true; r.status = 'ACTIVE'; break;
    }
    case 'CLOSE_CABINET': p.cabinet.open = false; elapse(l, 2, a); break;
    case 'RETURN_LINK':
      p.link.holder = p.cabinet.recognitionHolder = 'OWNER'; p.link.returnPending = false; p.link.windowExpiresAt = null;
      a.linkReturned = true; a.window = 'RETURNED'; a.spiritualitySpent += 4; elapse(l, 2, a); break;
    case 'CARRY_PARCEL':
      walk(l, 'OUTSIDE', a, true); p.playerEnergy -= 5; a.energySpent += 5; a.healthSpent += 5; a.benefitReceived += 12;
      p.parcel.location = 'OUTSIDE'; p.parcel.carriedBy = 'PLAYER'; p.fate.status = 'COMPLETED'; p.fate.benefitRecipient = 'PLAYER'; p.fate.escrowPennies -= 12;
      p.fate.paidToPlayer += 12; p.fate.incurredHealth += 5; p.fate.incurredEnergy += 5; a.parcelCarried = true;
      if (a.fateTaken) a.appliedAbilityIds.push('error.s2.fate-assumption'); r.status = 'ACTIVE'; break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.ownerConsent = 'WITHDRAWN'; elapse(l, 2, a); break;
    case 'RETURN_SEAL': p.seals.find(seal => seal.id === a.sealId)!.location = 'DESK'; a.sealReturned = true; elapse(l, 2, a); break;
    case 'STOP': a.stopped = true; elapse(l, 1, a); break;
    case 'WAIT_10': a.waits++; elapse(l, 10, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, 2, a); break;
  }
}
export function applyFateTrojanActivity(s: FateTrojanHost, c: FateTrojanActivityCommand, ctx: SeerContext): void {
  const reason = blockFateTrojanLife(s, c); if (reason) throw new Error(reason);
  const l = s.fateTrojan.life, stat = c.type === 'TAKE_FATE' ? 'will' : 'knowledge';
  const source = checkSource(l, c, s.character.coreStats[stat], s.character.name, s.character.gender), paid = commandCost(l, c);
  const budget: FateTrojanBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions,
    spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, cashBefore: s.cash, cashAfter: s.cash - paid.pennies + paid.cashGained,
    healthBefore: s.health, healthAfter: s.health - paid.health, mindBefore: s.mind, mindAfter: s.mind, energyBefore: l.site.playerEnergy, energyAfter: l.site.playerEnergy - paid.energy };
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter; s.health = budget.healthAfter;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check(stat, 20)); tier = check.tier; randomAfter = s.random.cursor; }
  evolve(l, c, s.week, s.date, tier);
  l.journal.push({ week: s.week, date: structuredClone(s.date), command: structuredClone(c), tier, randomBefore, randomAfter, check, source, paid, budget });
  if (c.type === 'REPORT') {
    s.progression.acting = Math.min(100, s.progression.acting + 25);
    for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8);
  } else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const p = l.site;
  ctx.note(`登记室：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}你在${LOCATION_LABELS[p.playerLocation]}，本场精力余${p.playerEnergy}。原柜识别联系由${p.link.holder === 'OWNER' ? '维克托' : '你'}持有${p.link.returnPending ? '，仍欠实际归还' : ''}。${p.fate.status === 'ASSUMED' ? '这一次原包裹搬运已由你接下，等待不会替你完成。' : p.fate.status === 'COMPLETED' ? '同一原包已实际搬到室外并放下，5健康与5精力负担、12便士报酬均已结算。' : '原包裹仍待本次搬运。'}两人的身体、姓名与物品归属保持原样。`);
}
export const applyFateTrojanLife = applyFateTrojanActivity;
const LOCATION_LABELS: Record<FateTrojanLocation, string> = { ENTRY: '门口', DESK: '登记桌', CABINET: '原柜前', OUTSIDE: '室外', YARD: '后院' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<FateTrojanActivityCommand['type'], string> = {
  OBSERVE: '沿普通路观察原柜与原包裹', CONSENT_OPERATOR: '询问莉娜本案的明确许可', CONSENT_OWNER: '询问维克托本案的明确许可', PREPARE: '实付封签并到登记桌准备',
  TAKE_IDENTITY: '暂取同一原柜的识别联系', TAKE_FATE: '接下已记录的这一次搬运', WALK: '沿普通道路走到指定位置', OPEN_CABINET: '在原柜前实际开柜', CLOSE_CABINET: '亲手合上原柜',
  RETURN_LINK: '当面归还同一识别联系', CARRY_PARCEL: '亲自把唯一原包裹搬到室外', WITHDRAW_PERMISSION: '读取原主当前撤回的决定', RETURN_SEAL: '到登记桌交回同一封签',
  STOP: '停止新的施术，保留必须完成的归还', WAIT_10: '实际等待10秒', INSPECT: '核实实际结果与收尾', LEAVE: '结束已经收束的接触', CLOSE: '结束已经收束的接触',
  WITHDRAW: '按实际结果取消并结束接触', REPORT: '如实报告本案', REFLECT: '反思三次实践' };
export const FATE_TROJAN_LIFE_STORY = '登记室里，莉娜与维克托请你分别验证原柜的身份联系与一件真实待办。每案须重新取得明确许可，实付20便士准备唯一封签。取得身份联系需8灵性、知识20、1行动，并另留4灵性归还；成功只有20秒供实际开柜。接下搬运需8灵性、意志20、1行动；报酬12便士与5健康、5精力负担，只有亲自搬完同一原包裹才结算。普通步行另外耗真实精力。三份报告各25扮演，反思25；只有实际应用并报告的技巧才增加8掌握。';
const CASES = [
  { id: 'identity-link', title: '原柜识别谁', story: '原柜只识别一份来自维克托的联系。取得成功后，他暂时不能用这份联系开柜；你须亲自走4米到原柜，在20秒窗口内花4秒开柜。身体、姓名与物权始终不变。关柜后仍须走回登记桌，耗4灵性实际归还；失败、到期或停止都不会替你归还。' },
  { id: 'fate-assumption', title: '接下这一件待办', story: '事先记录原包裹从柜内到室外的一次搬运、5健康与5精力负担，以及莉娜已留出的12便士报酬。成功接下后维克托从这一次待办中解脱，你仍必须实际走到原柜，将同一原包搬到室外。等待或停止不能删掉义务，已经发生的负担不恢复，报酬只付一次。' },
  { id: 'revoked-link', title: '准备后撤回的许可', story: '重新观察同一原柜、取得本案同意并支付20便士准备封签。维克托随后明确改变主意。读取这次撤回，停止施术，把尚未使用的同一封签实际交回，再走回门口如实报告；没有取得联系，也没有技巧掌握奖励。' },
] as const;
function costLabel(l: FateTrojanLifeState, c: FateTrojanActivityCommand): string {
  const cost = commandCost(l, c), items = [`${cost.actions}行动`];
  if (cost.pennies) items.push(`${cost.pennies}便士`);
  if (cost.spirituality) items.push(`${cost.spirituality}灵性`);
  if (cost.energy) items.push(`${cost.energy}精力`);
  if (cost.health) items.push(`${cost.health}健康负担`);
  if (cost.cashGained) items.push(`实搬后报酬${cost.cashGained}便士`);
  if (c.type === 'TAKE_IDENTITY') items.push('知识20', '另留4灵性归还', '成功20秒窗口');
  if (c.type === 'TAKE_FATE') items.push('意志20', '仅这一件待办');
  if (c.type === 'PREPARE') items.push('须另留1行动', '真实步行2米');
  if (c.type === 'WALK') items.push(`${distance(l.site.playerLocation, c.to)}米/秒`);
  if (c.type === 'OPEN_CABINET') items.push(l.site.link.holder === 'PLAYER' ? '开柜4秒' : '原主普通往返8米并开柜，共12秒');
  if (c.type === 'OBSERVE') items.push('普通往返12米', '实查4秒');
  return items.join(' · ');
}
export function fateTrojanLifeActions(s: FateTrojanHost): FateTrojanLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.fateTrojan.life, out: FateTrojanLifeAction[] = [];
  const add = (command: FateTrojanActivityCommand) => {
    const reason = blockFateTrojanLife(s, command);
    out.push({ id: `FT2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`,
      label: `${LABELS[command.type]}${command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATION_LABELS[command.to]}` : ''}`,
      cost: costLabel(l, command), enabled: reason === null, reason, command });
  };
  const caseId = l.activeCase ?? FATE_TROJAN_CASE_IDS.find(id => l.cases[id].status !== 'RESOLVED');
  if (caseId) {
    const r = l.cases[caseId], a = r.attempts.at(-1);
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') {
      add({ type: 'CONSENT_OPERATOR', caseId }); add({ type: 'CONSENT_OWNER', caseId });
      add({ type: 'PREPARE', caseId, method: 'ABILITY' });
      if (caseId !== 'revoked-link') add({ type: 'PREPARE', caseId, method: 'ORDINARY' });
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (r.contactOpen && a) {
      if (a.inspected) add({ type: 'LEAVE', caseId });
      else {
        if (caseId === 'revoked-link' && !a.permissionWithdrawn) add({ type: 'WITHDRAW_PERMISSION', caseId });
        if (a.method === 'ABILITY' && a.abilityTier === null && caseId !== 'revoked-link') add({ type: caseId === 'identity-link' ? 'TAKE_IDENTITY' : 'TAKE_FATE', caseId });
        if (caseId !== 'revoked-link') add({ type: 'OPEN_CABINET', caseId });
        if (l.site.cabinet.open) add({ type: 'CLOSE_CABINET', caseId });
        if (caseId === 'fate-assumption' && !a.parcelCarried) add({ type: 'CARRY_PARCEL', caseId });
        if (l.site.link.returnPending) add({ type: 'RETURN_LINK', caseId });
        if (!a.sealReturned) add({ type: 'RETURN_SEAL', caseId });
        if (a.abilityTier !== null && a.waits < 4) add({ type: 'WAIT_10', caseId });
        for (const to of LOCATIONS) if (to !== l.site.playerLocation) add({ type: 'WALK', caseId, to });
        if (!a.stopped) add({ type: 'STOP', caseId });
        add({ type: 'INSPECT', caseId });
      }
    }
  } else if (!l.reflected) add({ type: 'REFLECT' });
  return out;
}
export function projectFateTrojanLife(s: FateTrojanHost): FateTrojanLifeProjection {
  const l = s.fateTrojan.life, p = l.site, a = current(l);
  return { title: '登记室里的身份与待办', story: FATE_TROJAN_LIFE_STORY,
    environment: '门口0米，登记桌2米，原柜6米，室外−2米。莉娜39岁、维克托43岁，始终是原来的两名成人；封签每案只有一枚，包裹只有这一件。本人本场精力最初100，普通步行每米消耗1精力，换案不补。归还联系必须本人回到原主面前，搬运须本人将原物实际送到室外。',
    activeCase: l.activeCase, inside: hasFateTrojanLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected,
    site: structuredClone(p), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres,
    playerCanOpenCabinet: p.link.holder === 'PLAYER' && p.link.windowExpiresAt !== null && p.link.windowExpiresAt - p.clockSeconds >= 4 && !a?.stopped,
    ownerCanOpenCabinet: p.link.holder === 'OWNER', currentAttempt: structuredClone(a),
    cases: CASES.map(d => { const r = l.cases[d.id], t = r.attempts.at(-1); return { id: d.id, title: d.title, story: d.story,
      observations: [ ...(r.observation ? [`已实际步行${r.observation.walkedMetres}米，核对同一原柜、原识别联系、原包裹与这一份12便士搬运报酬。`] : []),
        ...(t ? [`本案耗${t.spiritualitySpent}灵性、${t.penniesSpent}便士、${t.energySpent}精力，普通步行${t.playerTravelMetres}米、实际经过${t.elapsedSeconds}秒。`,
          ...(t.abilityTier ? [`检定${TIER_LABELS[t.abilityTier]}；实际应用${t.appliedAbilityIds.length}项技巧。`] : []),
          ...(t.identityTaken ? [`同一联系${t.linkReturned ? '已在登记桌实际归还' : '仍须实际归还'}；${t.identityUsed ? '曾在有效窗口内真正开柜' : '尚未在有效窗口内开柜'}。`] : []),
          ...(t.fateTaken ? [`这一件搬运${t.parcelCarried ? '已实际完成' : '仍由你承担，停止不免除义务'}。`] : []),
          ...(t.parcelCarried ? [`已实际承受${t.healthSpent}健康、5搬运精力负担，并只领取${t.benefitReceived}便士；已付负担不会因取消消失。`] : []),
          ...(t.permissionWithdrawn ? ['准备费实付后原主撤回许可；封签未用于取得身份联系。'] : [])] : []) ],
      status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '能力已真正应用，原人原物与实际成本均保留。' : '按普通方法或停止结果收尾，未应用的技巧不增加掌握。',
      contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: fateTrojanLifeActions(s) };
}
/** Shape validation is deliberately independent from scene replay; later encounter must prove its own lineage. */
export function validateFateTrojanSiteState(v: unknown): v is FateTrojanSiteState {
  try {
    const initial = createFateTrojanSiteState();
    if (!record(v) || !shape(v, Object.keys(initial))) return false;
    const p = v as unknown as FateTrojanSiteState;
    if (p.siteId !== initial.siteId || !integer(p.clockSeconds) || !integer(p.playerTravelMetres) || !integer(p.playerEnergy, 0, 100) || ![...LOCATIONS, 'YARD'].includes(p.playerLocation)) return false;
    if (p.introducedWeek === null ? p.introducedDate !== null : !integer(p.introducedWeek, 1) || !isValidGameDate(p.introducedDate)) return false;
    for (const k of ['lina', 'victor', 'cabinet', 'parcel', 'link', 'fate'] as const) if (!record(p[k]) || !shape(p[k], Object.keys(initial[k]))) return false;
    for (const key of ['lina', 'victor'] as const) {
      const actor = p[key];
      if (!(key === 'victor' ? ['DESK', 'CABINET', 'OUTSIDE'] : ['DESK', 'OUTSIDE']).includes(actor.location) || !integer(actor.energy, 0, 100) || !integer(actor.travelMetres) ||
        !same(actor, { ...initial[key], location: actor.location, energy: actor.energy, travelMetres: actor.travelMetres })) return false;
    }
    if (typeof p.cabinet.open !== 'boolean' || !['OWNER', 'PLAYER'].includes(p.cabinet.recognitionHolder) || !integer(p.cabinet.playerOpenings, 0, 1) || !integer(p.cabinet.ownerOpenings) ||
      !same(p.cabinet, { ...initial.cabinet, open: p.cabinet.open, recognitionHolder: p.cabinet.recognitionHolder, playerOpenings: p.cabinet.playerOpenings, ownerOpenings: p.cabinet.ownerOpenings })) return false;
    if (!['CABINET', 'OUTSIDE'].includes(p.parcel.location) || !integer(p.parcel.ordinaryMetres, 0, 8) || p.parcel.carriedBy !== null && p.parcel.carriedBy !== 'PLAYER' ||
      !same(p.parcel, { ...initial.parcel, location: p.parcel.location, ordinaryMetres: p.parcel.ordinaryMetres, carriedBy: p.parcel.carriedBy })) return false;
    if (!['OWNER', 'PLAYER'].includes(p.link.holder) || typeof p.link.returnPending !== 'boolean' || p.link.windowExpiresAt !== null && !integer(p.link.windowExpiresAt) ||
      p.link.holder !== p.cabinet.recognitionHolder || p.link.returnPending !== (p.link.holder === 'PLAYER') || (p.link.windowExpiresAt !== null) !== p.link.returnPending ||
      !same(p.link, { ...initial.link, holder: p.link.holder, returnPending: p.link.returnPending, windowExpiresAt: p.link.windowExpiresAt })) return false;
    const f = p.fate;
    if (!['OWNER', 'PLAYER'].includes(f.debtor) || !['OWNER', 'PLAYER'].includes(f.benefitRecipient) || !['PENDING', 'ASSUMED', 'COMPLETED'].includes(f.status) || typeof f.ownerRelieved !== 'boolean' ||
      ![0, 12].includes(f.escrowPennies) || ![0, 12].includes(f.paidToPlayer) || f.escrowPennies + f.paidToPlayer !== 12 || ![0, 5].includes(f.incurredHealth) || ![0, 5].includes(f.incurredEnergy) ||
      !same(f, { ...initial.fate, debtor: f.debtor, status: f.status, escrowPennies: f.escrowPennies, benefitRecipient: f.benefitRecipient, paidToPlayer: f.paidToPlayer,
        ownerRelieved: f.ownerRelieved, incurredHealth: f.incurredHealth, incurredEnergy: f.incurredEnergy })) return false;
    if ((f.status === 'COMPLETED') !== (f.paidToPlayer === 12) || (f.status === 'COMPLETED') !== (p.parcel.location === 'OUTSIDE') ||
      (f.status === 'COMPLETED') !== (p.parcel.carriedBy === 'PLAYER') || (f.status === 'COMPLETED') !== (p.parcel.ordinaryMetres === 8) ||
      f.incurredHealth !== (f.status === 'COMPLETED' ? 5 : 0) || f.incurredEnergy !== (f.status === 'COMPLETED' ? 5 : 0) || f.ownerRelieved !== (f.debtor === 'PLAYER')) return false;
    if (!Array.isArray(p.seals) || p.seals.length > 3 || new Set(p.seals.map(seal => seal.id)).size !== p.seals.length) return false;
    for (const seal of p.seals) if (!record(seal) || !shape(seal, ['id', 'caseId', 'ownerId', 'quantity', 'charges', 'location', 'paidPennies', 'preparedWeek']) ||
      !FATE_TROJAN_CASE_IDS.includes(seal.caseId) || seal.id !== `FT2-SEAL:${seal.caseId}` || seal.ownerId !== 'FT2-LINA' || seal.quantity !== 1 || ![0, 1].includes(seal.charges) ||
      !['PLAYER', 'DESK'].includes(seal.location) || seal.paidPennies !== 20 || !integer(seal.preparedWeek, 1)) return false;
    return true;
  } catch { return false; }
}
function validBudget(b: FateTrojanBudget, cost: FateTrojanCost, command: FateTrojanActivityCommand, energy: number): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'])) return false;
  for (const key of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[key])) return false;
  for (const key of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[key], 0, 120)) return false;
  for (const key of ['healthBefore', 'healthAfter'] as const) if (!integer(b[key], 1, 100)) return false;
  for (const key of ['mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'] as const) if (!integer(b[key], 0, 100)) return false;
  if (b.actionsAfter !== b.actionsBefore - cost.actions || b.spiritualityAfter !== b.spiritualityBefore - cost.spirituality || b.cashAfter !== b.cashBefore - cost.pennies + cost.cashGained ||
    b.healthAfter !== b.healthBefore - cost.health || b.mindAfter !== b.mindBefore || b.energyBefore !== energy || b.energyAfter !== energy - cost.energy) return false;
  if (command.type === 'PREPARE' && (b.actionsBefore < 2 || energy < 4) || command.type === 'TAKE_IDENTITY' && b.spiritualityBefore < 12 || cost.spirituality > 0 && b.mindBefore <= 0) return false;
  if ((command.type === 'TAKE_FATE' || command.type === 'PREPARE' && command.caseId === 'fate-assumption' || command.type === 'CARRY_PARCEL') && b.healthBefore <= 5) return false;
  return true;
}
/** Full charge/check/source/date replay. Encounter proves mutations of the one authoritative live site separately. */
export function validateFateTrojanLife(s: FateTrojanHost): boolean {
  try {
    const l = s.fateTrojan?.life, promotion = s.fateTrojan?.promotionWeek, expected = createFateTrojanLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, FATE_TROJAN_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 600 || !validateFateTrojanSiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week)) return false;
    let lastWeek = promotion, nextCursor = 0, previous: FateTrojanLifeEvent | null = null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'paid', 'budget']) ||
        !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        previous && compareGameDates(raw.date, previous.date) < 0 || !validateFateTrojanActivityCommand(raw.command)) return false;
      const event = raw as unknown as FateTrojanLifeEvent, c = event.command, wasOpen = contactOpen(expected), cost = commandCost(expected, c), b = event.budget;
      if (wasOpen && (event.week !== lastWeek || previous && !same(event.date, previous.date)) || localBlock(expected, c, event.week) || !same(event.paid, cost) || !validBudget(b, cost, c, expected.site.playerEnergy)) return false;
      if (wasOpen && previous) {
        const old = previous.budget;
        if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter || b.energyBefore !== old.energyAfter) return false;
      }
      const base = record(event.check) && integer(event.check.baseAbility, 0, 500) ? event.check.baseAbility : 0;
      const name = record(event.source) && record(event.source.actor) && typeof event.source.actor.name === 'string' ? event.source.actor.name : '';
      const gender = record(event.source) && record(event.source.actor) && typeof event.source.actor.gender === 'string' ? event.source.actor.gender : '';
      const source = checkSource(expected, c, base, name, gender);
      if (!same(event.source, source)) return false;
      if (source) {
        if (!name || !gender || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) ||
          event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
        if (promoted(s)) {
          const now = s.character.coreStats[source.coreStat];
          if (source.actor.name !== s.character.name || source.actor.gender !== s.character.gender ||
            (source.coreStat === 'will' || now > 20 || l.activeCase === source.caseId ? source.baseAbility !== now : source.baseAbility > now)) return false;
        }
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: source.coreStat, baseAbility: base, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || event.tier !== check.tier || random.cursor !== event.randomAfter) return false;
        nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.date, event.tier);
      if (!validateFateTrojanSiteState(expected.site) || expected.site.playerEnergy !== b.energyAfter) return false;
      expected.journal.push(structuredClone(event)); previous = event; lastWeek = event.week;
    }
    const encounter = s.fateTrojan.encounter;
    if (encounter.status === 'AVAILABLE') { if (!same(l, expected)) return false; }
    else {
      if (contactOpen(expected) || !expected.reflected || !Object.values(expected.cases).every(r => r.status === 'RESOLVED') || cleanupBlock(expected) || !same(encounter.startSite, expected.site) || !same({ ...l, site: expected.site }, expected)) return false;
    }
    if (contactOpen(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return false;
      const b = previous.budget;
      if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter || l.site.playerEnergy !== b.energyAfter) return false;
    }
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['error.s2.identity-link', 'error.s2.fate-assumption'] as const) {
        const minimum = reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0);
        // New combat mastery, if any, is independently proved by the encounter/combat validators.
        if (encounter.status === 'AVAILABLE' ? s.progression.mastery[id] !== minimum : !integer(s.progression.mastery[id], minimum, 500)) return false;
      }
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
