import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasGloryOldPractice } from './index.js';

export const GLORY_CASE_IDS = ['armor-temper', 'close-guard', 'revoked-crossing'] as const;
export const GLORY_ACTIVITY_CASE_IDS = GLORY_CASE_IDS;
export const ACTIVITY_CASE_IDS = GLORY_CASE_IDS;
export type GloryCaseId = typeof GLORY_CASE_IDS[number];
export type GloryLifeAbilityId = 'warrior.s2.armor-temper' | 'warrior.s2.close-guard';
export type GloryLocation = 'ENTRY' | 'BENCH' | 'BRIDGE' | 'OUTSIDE' | 'YARD';
export type GloryConsent = 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED';
export type GloryWindow = 'NONE' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'APPLIED' | 'STOPPED';
const STEPS = ['OBSERVE', 'CONSENT_OPERATOR', 'CONSENT_OWNER', 'WEAR_PAD', 'REMOVE_PAD', 'TEMPER_ARMOR', 'APPLY_LOAD', 'RAISE_GUARD', 'CROSS_BRIDGE', 'ORDINARY_CROSS', 'RETURN_ACTOR', 'WITHDRAW_PERMISSION', 'RETURN_PLATE', 'STOP', 'WAIT_10', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT'] as const;
export type GloryActivityCommand =
  | { type: typeof STEPS[number]; caseId: GloryCaseId }
  | { type: 'PREPARE'; caseId: GloryCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WALK'; caseId: GloryCaseId; to: Exclude<GloryLocation, 'YARD'> }
  | { type: 'REFLECT' };
export interface GloryArmor { id: 'SK3-LIFE-ARMOR'; owner: 'PLAYER'; formed: boolean; active: boolean; integrity: number; remainingSeconds: number }
export interface GloryArmorSource { root: 'silverKnight.life.armor'; promotionWeek: number; introducedWeek: number; actor: 'PLAYER'; at: 'ENTRY'; snapshot: GloryArmor }
export interface GloryPlate { id: string; caseId: GloryCaseId; ownerId: 'PLAYER'; quantity: 1; charges: 0 | 1; location: 'PLAYER' | 'BENCH'; paidPennies: 20; preparedWeek: number }
export interface GloryAdult { id: 'GL2-CELIA' | 'GL2-EVAN'; name: '西莉娅' | '埃文'; age: 41 | 36; alive: true; location: 'BENCH' | 'BRIDGE' | 'OUTSIDE'; energy: number; travelMetres: number }
export interface GlorySiteState {
  siteId: 'GL2-REPAIR-ROOM'; introducedWeek: number | null; introducedDate: PublicGameDate | null;
  clockSeconds: number; playerLocation: GloryLocation; playerTravelMetres: number; playerEnergy: number;
  celia: GloryAdult; evan: GloryAdult;
  /** One original object continued from the immutable S3 record, never a newly formed second armor. */
  armor: GloryArmor | null; armorSource: GloryArmorSource | null; armorWorn: boolean;
  pads: { id: 'GL2-PADS'; ownerId: 'GL2-CELIA'; issuedWithPlateId: string | null; location: 'BENCH' | 'PLAYER'; remaining: number; consumed: number; worn: boolean };
  load: { id: 'GL2-LOAD'; ownerId: 'GL2-CELIA'; location: 'BENCH'; kilograms: 12; remainingLoads: 0 | 1; appliedLoads: 0 | 1; safetyStop: 'ENGAGED' };
  bridge: { id: 'GL2-BRIDGE'; from: 'BENCH'; to: 'BRIDGE'; metres: 6; sidePathMetres: 8; ordinaryPath: 'OPEN'; crossings: number; ordinaryCrossings: number };
  temper: { active: boolean; expiresAt: number | null };
  guard: { active: boolean; actorId: 'GL2-CELIA' | 'GL2-EVAN' | null; expiresAt: number | null; sharedHealth: number; sharedEnergy: number };
  plates: GloryPlate[];
}
export interface GloryMovement { from: GloryLocation; to: GloryLocation; mode: 'WALK' | 'BRIDGE' | 'SIDE_PATH'; metres: number; seconds: number; actorId: 'PLAYER' | 'GL2-CELIA' | 'GL2-EVAN' }
export interface GloryAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY'; stopped: boolean; inspected: boolean; permissionWithdrawn: boolean;
  elapsedSeconds: number; playerTravelMetres: number; energySpent: number; spiritualitySpent: number; penniesSpent: 20; healthSpent: number;
  operatorConsent: GloryConsent; ownerConsent: GloryConsent; routeConsent: GloryConsent; consentWeek: number; actorId: 'GL2-CELIA' | 'GL2-EVAN' | null;
  plateId: string; plateReturned: boolean; abilityTier: PublicResolutionTier | null; window: GloryWindow; windowExpiresAt: number | null;
  padWorn: boolean; padRemoved: boolean; loadApplied: boolean; armorWear: number; crossed: boolean; crossingMethod: 'BRIDGE' | 'SIDE_PATH' | null; actorReturned: boolean; waits: number;
  appliedAbilityIds: GloryLifeAbilityId[]; playerMoves: GloryMovement[]; actorMoves: GloryMovement[]; siteAtStart: GlorySiteState; siteAtClose: GlorySiteState | null;
}
export interface GloryCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; returned: boolean;
  operatorConsentWeek: number | null; ownerConsentWeek: number | null; preparations: number; closes: number; withdrawals: number;
  observation: { armorId: 'SK3-LIFE-ARMOR' | null; armorIntegrity: number; loadId: 'GL2-LOAD'; remainingLoads: number; bridgeId: 'GL2-BRIDGE'; bridgeMetres: 6; sidePathMetres: 8; walkedMetres: 4 } | null;
  attempts: GloryAttempt[];
}
export interface GloryCheckSource {
  caseId: GloryCaseId; abilityId: GloryLifeAbilityId; cost: 6; difficulty: 20; coreStat: 'knowledge' | 'will'; baseAbility: number;
  actor: { pathwayId: 'warrior'; sequence: 2; name: string; gender: string }; operatorConsentWeek: number; ownerConsentWeek: number;
  at: number; site: GlorySiteState;
}
export interface GloryCost { actions: number; spirituality: number; pennies: number; health: number; energy: number; cashGained: 0 }
export interface GloryBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number; mindBefore: number; mindAfter: number; energyBefore: number; energyAfter: number }
export interface GloryLifeEvent {
  week: number; date: PublicGameDate; command: GloryActivityCommand; tier: PublicResolutionTier | null;
  randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: GloryCheckSource | null; inheritedArmor: GloryArmorSource | null;
  paid: GloryCost; budget: GloryBudget;
}
export interface GloryLifeState { activeCase: GloryCaseId | null; reflected: boolean; site: GlorySiteState; cases: Record<GloryCaseId, GloryCaseState>; journal: GloryLifeEvent[] }
export interface GloryLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: GloryActivityCommand }
export interface GloryLifeProjection {
  title: string; story: string; environment: string; activeCase: GloryCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean;
  site: GlorySiteState; clockSeconds: number; playerLocation: GloryLocation; playerTravelMetres: number; currentAttempt: GloryAttempt | null;
  historicalArmorIntegrity: number; currentArmorIntegrity: number | null; armorIdentity: 'SK3-LIFE-ARMOR';
  cases: { id: GloryCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: GloryAttempt[] }[];
  actions: GloryLifeAction[];
}
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const POSITION: Record<GloryLocation, number> = { ENTRY: 0, BENCH: 2, BRIDGE: 8, OUTSIDE: -2, YARD: -4 };
const LOCATIONS = ['ENTRY', 'BENCH', 'BRIDGE', 'OUTSIDE'] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 2;
const distance = (from: GloryLocation, to: GloryLocation) => Math.abs(POSITION[from] - POSITION[to]);
const freshCase = (): GloryCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, returned: false, operatorConsentWeek: null, ownerConsentWeek: null, preparations: 0, closes: 0, withdrawals: 0, observation: null, attempts: [] });
export function createGlorySiteState(): GlorySiteState {
  return { siteId: 'GL2-REPAIR-ROOM', introducedWeek: null, introducedDate: null, clockSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, playerEnergy: 100,
    celia: { id: 'GL2-CELIA', name: '西莉娅', age: 41, alive: true, location: 'BENCH', energy: 100, travelMetres: 0 },
    evan: { id: 'GL2-EVAN', name: '埃文', age: 36, alive: true, location: 'BENCH', energy: 100, travelMetres: 0 },
    armor: null, armorSource: null, armorWorn: false,
    pads: { id: 'GL2-PADS', ownerId: 'GL2-CELIA', issuedWithPlateId: null, location: 'BENCH', remaining: 0, consumed: 0, worn: false },
    load: { id: 'GL2-LOAD', ownerId: 'GL2-CELIA', location: 'BENCH', kilograms: 12, remainingLoads: 1, appliedLoads: 0, safetyStop: 'ENGAGED' },
    bridge: { id: 'GL2-BRIDGE', from: 'BENCH', to: 'BRIDGE', metres: 6, sidePathMetres: 8, ordinaryPath: 'OPEN', crossings: 0, ordinaryCrossings: 0 },
    temper: { active: false, expiresAt: null }, guard: { active: false, actorId: null, expiresAt: null, sharedHealth: 0, sharedEnergy: 0 }, plates: [] };
}
export function createGloryLifeState(): GloryLifeState { return { activeCase: null, reflected: false, site: createGlorySiteState(), cases: { 'armor-temper': freshCase(), 'close-guard': freshCase(), 'revoked-crossing': freshCase() }, journal: [] }; }
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', id: GloryCaseId, p: GlorySiteState): GloryAttempt {
  return { week, method, closed: false, result: 'NONE', stopped: false, inspected: false, permissionWithdrawn: false, elapsedSeconds: 0, playerTravelMetres: 0,
    energySpent: 0, spiritualitySpent: 0, penniesSpent: 20, healthSpent: 0, operatorConsent: 'GRANTED', ownerConsent: 'GRANTED', routeConsent: 'GRANTED', consentWeek: week,
    actorId: id === 'armor-temper' ? null : id === 'close-guard' ? 'GL2-EVAN' : 'GL2-CELIA', plateId: `GL2-PLATE:${id}`, plateReturned: false, abilityTier: null, window: 'NONE', windowExpiresAt: null,
    padWorn: false, padRemoved: false, loadApplied: false, armorWear: 0, crossed: false, crossingMethod: null, actorReturned: false, waits: 0,
    appliedAbilityIds: [], playerMoves: [], actorMoves: [], siteAtStart: structuredClone(p), siteAtClose: null };
}
const current = (l: GloryLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const contactOpen = (l: GloryLifeState) => l.activeCase !== null || Object.values(l.cases).some(r => r.contactOpen || r.status === 'PREPARED');
const participant = (p: GlorySiteState, a: GloryAttempt): GloryAdult | null => a.actorId === 'GL2-CELIA' ? p.celia : a.actorId === 'GL2-EVAN' ? p.evan : null;
function cleanupBlock(l: GloryLifeState): string | null {
  const p = l.site;
  if (p.temper.active || p.guard.active) return '先停止尚未结束的有限防护。';
  if (p.pads.worn || p.armorWorn || p.pads.location !== 'BENCH') return '先在工作台脱下并交回安全垫；同一银甲仍属于你，磨损不会恢复。';
  if (p.celia.location !== 'BENCH' || p.evan.location !== 'BENCH') return '先与过桥者沿普通侧路实际返回工作台。';
  if (p.plates.some(x => x.location !== 'BENCH')) return '本案同一枚实付护片须实际交回工作台。';
  return p.playerLocation === 'ENTRY' ? null : '本人还须沿普通道路实际回到门口。';
}
export const hasGloryLifeLock = (s: SliceState): boolean => contactOpen(s.glory.life) || s.glory.encounter.status === 'AVAILABLE' && cleanupBlock(s.glory.life) !== null;
export const gloryInside = hasGloryLifeLock;
export const gloryLifeClosed = (s: SliceState): boolean => !hasGloryLifeLock(s) && Object.values(s.glory.life.cases).every(r => r.status === 'RESOLVED');
export function validateGloryActivityCommand(v: unknown): v is GloryActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!GLORY_CASE_IDS.includes(v.caseId as GloryCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'WALK') return shape(v, ['type', 'caseId', 'to']) && LOCATIONS.includes(v.to as typeof LOCATIONS[number]);
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
export const isGloryActivityCommand = validateGloryActivityCommand;
export const isGloryActivity = validateGloryActivityCommand;
const consent = (a: GloryAttempt, week: number) => a.operatorConsent === 'GRANTED' && a.ownerConsent === 'GRANTED' && a.consentWeek === week && !a.stopped;
function localBlock(l: GloryLifeState, c: GloryActivityCommand, week: number): string | null {
  const p = l.site;
  if (c.type === 'REFLECT') return !contactOpen(l) && !cleanupBlock(l) && !l.reflected && Object.values(l.cases).every(r => r.status === 'RESOLVED') ? null : '先实际收尾并报告三案，再完成一次反思。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), index = GLORY_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'AVAILABLE' && p.playerEnergy >= 8 && (index === 0 || l.cases[GLORY_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '依次观察本案，保留原人、原甲与已用物资的真实状态及往返精力。';
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'CONSENT_OWNER') {
    if (contactOpen(l) || cleanupBlock(l) || r.status !== 'OBSERVED') return '须已观察本案而尚未准备；两名成人仍在前方2米的工作台。';
    return (c.type === 'CONSENT_OPERATOR' ? r.operatorConsentWeek : r.ownerConsentWeek) === week ? '本案本周的明确答复已记录。' : null;
  }
  if (c.type === 'PREPARE') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'OBSERVED' && r.attempts.length === 0 && r.operatorConsentWeek === week && r.ownerConsentWeek === week && p.playerEnergy >= (c.caseId === 'armor-temper' ? 4 : 25) ? null : '须先取得本案本周的当前同意，并保留实际操作与普通返程的精力；每案只有一枚付费护片。';
  if (c.type === 'REPORT') return !contactOpen(l) && !cleanupBlock(l) && r.status === 'EXAMINED' ? null : '先完成真实收尾与普通返回，再如实报告。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一案。';
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) return cleanupBlock(l) ?? (a.inspected ? null : '先核实实际结果；取消也要真实收尾。');
  if (a.inspected) return '本案已核实，请结束接触后报告。';
  if (c.type === 'WALK') {
    if (c.to === p.playerLocation) return '你已经在这里。';
    if (participant(p, a)?.location === 'BRIDGE') return '先与原过桥者一起沿普通侧路回到工作台。';
    if (p.pads.worn || p.armorWorn) return '本次负载须在工作台完成；先脱下原安全垫再离开。';
    const reserve = p.plates.some(x => x.location === 'PLAYER') ? distance(c.to, 'BENCH') + 2 : distance(c.to, 'ENTRY');
    return p.playerEnergy >= distance(p.playerLocation, c.to) + reserve ? null : '这段路会用掉普通返程所需精力。';
  }
  if (c.type === 'STOP') return a.stopped ? '已经停止新的施术；物品和真实成本仍保留。' : null;
  if (c.type === 'WAIT_10') return a.abilityTier !== null && a.waits < 4 ? null : '施术后最多等待四次10秒；等待不会续窗或修复银甲。';
  if (c.type === 'WITHDRAW_PERMISSION') return c.caseId === 'revoked-crossing' && !a.permissionWithdrawn && a.abilityTier === null && p.playerLocation === 'BENCH' ? null : '须在工作台读取西莉娅当前撤回能力许可的决定，尚未施术。';
  if (c.type === 'RETURN_ACTOR') { const actor = participant(p, a); return actor?.location === 'BRIDGE' && p.playerLocation === 'BRIDGE' && p.playerEnergy >= 10 && actor.energy >= 8 ? null : '须你与同一过桥者都在桥的另一端，并留足8米普通侧路和你的2米返门精力。'; }
  if (c.type === 'REMOVE_PAD') return c.caseId === 'armor-temper' && p.playerLocation === 'BENCH' && p.pads.worn && !p.temper.active ? null : '须在工作台，停止防护后亲手脱下并交回同一安全垫。';
  if (c.type === 'RETURN_PLATE') return p.playerLocation === 'BENCH' && !a.plateReturned && !p.temper.active && !p.guard.active && !p.pads.worn && !p.armorWorn && p.celia.location === 'BENCH' && p.evan.location === 'BENCH' ? null : '须在工作台，停止防护、脱垫并与过桥者返回后交回同一护片。';
  if (c.type === 'INSPECT') return cleanupBlock(l) ?? (c.caseId === 'revoked-crossing' && (!a.permissionWithdrawn || !a.stopped) ? '先读取撤回许可并停止能力尝试。' : null);
  if (c.type === 'ORDINARY_CROSS') {
    const actor = participant(p, a);
    if (c.caseId === 'armor-temper' || !actor || a.crossed || p.playerLocation !== 'BENCH' || actor.location !== 'BENCH' || a.routeConsent !== 'GRANTED' || a.plateReturned || c.caseId === 'revoked-crossing' && (!a.permissionWithdrawn || !a.stopped)) return '须本人和当前自愿选择普通侧路的同一成人在工作台；撤回案先停止施术。';
    if (a.method === 'ABILITY' && c.caseId === 'close-guard' && a.abilityTier === null && !a.stopped) return '先尝试已准备的能力，或明确停止后选择普通侧路。';
    return p.playerEnergy >= 18 && actor.energy >= 16 ? null : '普通侧路去回共16米，还须留你的2米返门精力。';
  }
  if (!consent(a, week) || a.plateReturned) return '本案当前能力许可已撤回、停止或护片已归还；普通返回仍可进行。';
  if (c.type === 'WEAR_PAD') return c.caseId === 'armor-temper' && p.playerLocation === 'BENCH' && !a.padWorn && p.pads.remaining > 0 && p.pads.location === 'BENCH' ? null : '须在工作台穿好本案有限的原安全垫。';
  if (c.type === 'TEMPER_ARMOR' || c.type === 'RAISE_GUARD') {
    if (c.caseId !== (c.type === 'TEMPER_ARMOR' ? 'armor-temper' : 'close-guard') || a.method !== 'ABILITY' || a.abilityTier !== null || p.playerLocation !== 'BENCH' || r.status !== 'PREPARED') return '本案只能在工作台作一次已付费的能力尝试。';
    if (c.type === 'TEMPER_ARMOR') return p.armor?.formed && p.armor.integrity >= 5 && p.armorWorn && p.pads.worn ? null : '须实际穿好原安全垫与同一件已形成、完整度至少5的银甲；不能另造或重置。';
    const actor = participant(p, a); return actor?.alive && actor.location === 'BENCH' && actor.energy >= 14 && p.playerEnergy >= 21 ? null : '须原埃文当前同意并在身旁，还要保留实际6米过桥、个人负担与普通返回的精力。';
  }
  if (c.type === 'APPLY_LOAD') {
    if (c.caseId !== 'armor-temper' || p.playerLocation !== 'BENCH' || !p.pads.worn || p.pads.remaining < 1 || p.load.remainingLoads !== 1 || a.loadApplied) return '须在工作台穿好原安全垫，原负载与垫片各尚有一次可用。';
    return a.method !== 'ABILITY' || a.abilityTier !== null ? null : '先完成本案的一次淬甲尝试；失败或到期仍可由普通安全垫承接。';
  }
  if (c.type === 'CROSS_BRIDGE') { const actor = participant(p, a); return c.caseId === 'close-guard' && !a.crossed && success(a.abilityTier) && a.window === 'ACTIVE' && p.guard.active && p.guard.actorId === a.actorId && p.guard.expiresAt !== null && p.guard.expiresAt - p.clockSeconds >= 6 && p.playerLocation === 'BENCH' && actor?.location === 'BENCH' && actor.energy >= 14 && p.playerEnergy >= 21 ? null : '须当前同意的原埃文就在身旁，有限防护还够6秒；实际同走6米并由你支付5健康、额外5精力。'; }
  return '当前阶段不能进行这一步。';
}
function commandCost(l: GloryLifeState, c: GloryActivityCommand): GloryCost {
  const a = 'caseId' in c ? l.cases[c.caseId].attempts.at(-1) : undefined;
  const ordinaryWork = c.type === 'APPLY_LOAD' && a?.method === 'ORDINARY' || c.type === 'ORDINARY_CROSS' && (a?.method === 'ORDINARY' || c.caseId === 'revoked-crossing');
  return { actions: ['OBSERVE', 'PREPARE', 'TEMPER_ARMOR', 'RAISE_GUARD', 'REPORT', 'REFLECT'].includes(c.type) || ordinaryWork ? 1 : 0,
    spirituality: c.type === 'TEMPER_ARMOR' || c.type === 'RAISE_GUARD' ? 6 : 0, pennies: c.type === 'PREPARE' ? 20 : 0, health: c.type === 'CROSS_BRIDGE' ? 5 : 0,
    energy: c.type === 'OBSERVE' ? 4 : c.type === 'PREPARE' ? 2 : c.type === 'WALK' ? distance(l.site.playerLocation, c.to) : c.type === 'CROSS_BRIDGE' ? 11 : c.type === 'ORDINARY_CROSS' || c.type === 'RETURN_ACTOR' ? 8 : 0, cashGained: 0 };
}
export function blockGloryLife(s: SliceState, c: GloryActivityCommand): string | null {
  if (!validateGloryActivityCommand(c)) return '荣耀者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须本人仍活着且已成为荣耀者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德的修护室。';
  if (hasGloryOldPractice(s) || s.glory.preparedWeek !== null) return '先收束旧实践、遭遇与服药准备。';
  if (s.glory.encounter.status !== 'AVAILABLE') return '实践已经进入后续遭遇，不能重开原案或恢复原物。';
  const reason = localBlock(s.glory.life, c, s.week); if (reason) return reason;
  const cost = commandCost(s.glory.life, c);
  if (s.actionsRemaining < (c.type === 'PREPARE' ? 2 : cost.actions)) return '本周行动不足；准备另留1行动，普通收尾和返回仍可进行。';
  if (s.cash < cost.pennies) return '每案护片需实付20便士。';
  if (s.spirituality < cost.spirituality || cost.spirituality > 0 && s.mind <= 0) return '当前灵性或精神不足以施术；仍可普通收尾。';
  if ((c.type === 'RAISE_GUARD' || c.type === 'CROSS_BRIDGE') && s.health <= 5) return '须有余力承受实际分担的5健康，不能用防护恢复身体。';
  if (s.glory.life.site.playerEnergy < cost.energy) return '本场精力不足；换案不会恢复精力。';
  return null;
}
function elapse(l: GloryLifeState, seconds: number, a: GloryAttempt | null = current(l)): void {
  const p = l.site; p.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (p.temper.active && p.temper.expiresAt !== null && p.clockSeconds >= p.temper.expiresAt) { p.temper.active = false; p.temper.expiresAt = null; if (a?.window === 'ACTIVE') a.window = 'EXPIRED'; }
  if (p.guard.active && p.guard.expiresAt !== null && p.clockSeconds >= p.guard.expiresAt) { p.guard.active = false; p.guard.actorId = null; p.guard.expiresAt = null; if (a?.window === 'ACTIVE') a.window = 'EXPIRED'; }
}
function walk(l: GloryLifeState, to: GloryLocation, a: GloryAttempt | null = current(l), mode: GloryMovement['mode'] = 'WALK', metres = distance(l.site.playerLocation, to)): void {
  const p = l.site, from = p.playerLocation; p.playerLocation = to; p.playerTravelMetres += metres; p.playerEnergy -= metres;
  if (a) { a.playerTravelMetres += metres; a.energySpent += metres; a.playerMoves.push({ from, to, mode, metres, seconds: metres, actorId: 'PLAYER' }); } elapse(l, metres, a);
}
function together(l: GloryLifeState, a: GloryAttempt, to: 'BENCH' | 'BRIDGE', mode: 'BRIDGE' | 'SIDE_PATH', metres: number): void {
  const actor = participant(l.site, a)!; a.actorMoves.push({ from: actor.location, to, mode, metres, seconds: metres, actorId: actor.id }); actor.location = to; actor.travelMetres += metres; actor.energy -= metres; walk(l, to, a, mode, metres);
}
function checkSource(l: GloryLifeState, c: GloryActivityCommand, baseAbility: number, name: string, gender: string): GloryCheckSource | null {
  if (c.type !== 'TEMPER_ARMOR' && c.type !== 'RAISE_GUARD') return null;
  const r = l.cases[c.caseId]; return { caseId: c.caseId, abilityId: c.type === 'TEMPER_ARMOR' ? 'warrior.s2.armor-temper' : 'warrior.s2.close-guard', cost: 6, difficulty: 20, coreStat: c.type === 'TEMPER_ARMOR' ? 'knowledge' : 'will', baseAbility,
    actor: { pathwayId: 'warrior', sequence: 2, name, gender }, operatorConsentWeek: r.operatorConsentWeek!, ownerConsentWeek: r.ownerConsentWeek!, at: l.site.clockSeconds, site: structuredClone(l.site) };
}
function armorHandoff(s: SliceState, week: number): GloryArmorSource { return { root: 'silverKnight.life.armor', promotionWeek: s.silverKnight.promotionWeek!, introducedWeek: week, actor: 'PLAYER', at: 'ENTRY', snapshot: structuredClone(s.silverKnight.life.armor) }; }
function evolve(l: GloryLifeState, c: GloryActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, inheritedArmor: GloryArmorSource | null): void {
  const p = l.site;
  if (c.type === 'REFLECT') { l.reflected = true; elapse(l, 10, null); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') {
    if (p.introducedWeek === null) { if (!inheritedArmor) throw new Error('缺少同一银甲的原始记录。'); p.introducedWeek = week; p.introducedDate = structuredClone(date); p.armorSource = structuredClone(inheritedArmor); p.armor = structuredClone(inheritedArmor.snapshot); }
    walk(l, 'BENCH', null); elapse(l, 4, null); walk(l, 'ENTRY', null);
    r.observation = { armorId: p.armor?.id ?? null, armorIntegrity: p.armor?.integrity ?? 0, loadId: p.load.id, remainingLoads: p.load.remainingLoads, bridgeId: p.bridge.id, bridgeMetres: 6, sidePathMetres: 8, walkedMetres: 4 }; r.status = 'OBSERVED'; r.observedWeek = week; return;
  }
  if (c.type === 'CONSENT_OPERATOR' || c.type === 'CONSENT_OWNER') { if (c.type === 'CONSENT_OPERATOR') r.operatorConsentWeek = week; else r.ownerConsentWeek = week; elapse(l, 2, null); return; }
  if (c.type === 'PREPARE') {
    const a = freshAttempt(week, c.method, c.caseId, p); r.attempts.push(a); r.preparations++; r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId;
    p.plates.push({ id: a.plateId, caseId: c.caseId, ownerId: 'PLAYER', quantity: 1, charges: 1, location: 'PLAYER', paidPennies: 20, preparedWeek: week });
    if (c.caseId === 'armor-temper') { p.pads.issuedWithPlateId = a.plateId; p.pads.remaining = 2; }
    walk(l, 'BENCH', a); elapse(l, 4, a); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; elapse(l, 4, null); return; }
  const a = r.attempts.at(-1)!;
  if (['LEAVE', 'CLOSE', 'WITHDRAW'].includes(c.type)) { a.closed = true; a.operatorConsent = 'CLOSED'; if (a.ownerConsent !== 'WITHDRAWN') a.ownerConsent = 'CLOSED'; a.routeConsent = 'CLOSED'; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; if (c.type === 'WITHDRAW') r.withdrawals++; elapse(l, 2, a); a.siteAtClose = structuredClone(p); l.activeCase = null; return; }
  switch (c.type) {
    case 'WALK': walk(l, c.to, a); break;
    case 'WEAR_PAD': p.pads.worn = true; p.pads.location = 'PLAYER'; p.armorWorn = p.armor?.formed === true; a.padWorn = true; elapse(l, 4, a); break;
    case 'REMOVE_PAD': p.pads.worn = false; p.pads.location = 'BENCH'; p.armorWorn = false; a.padRemoved = true; elapse(l, 4, a); break;
    case 'TEMPER_ARMOR': case 'RAISE_GUARD':
      p.plates.find(x => x.id === a.plateId)!.charges = 0; a.abilityTier = tier; a.spiritualitySpent += 6; r.status = 'ACTIVE'; elapse(l, 4, a); a.window = success(tier) ? 'ACTIVE' : 'FAILED';
      if (success(tier)) { a.windowExpiresAt = p.clockSeconds + 30; if (c.type === 'TEMPER_ARMOR') p.temper = { active: true, expiresAt: a.windowExpiresAt }; else { p.guard.active = true; p.guard.actorId = a.actorId; p.guard.expiresAt = a.windowExpiresAt; } } break;
    case 'APPLY_LOAD': {
      const protectedLoad = p.temper.active && p.temper.expiresAt !== null && p.temper.expiresAt - p.clockSeconds >= 4 && p.armorWorn && !!p.armor?.formed && p.armor.integrity >= 5;
      p.load.remainingLoads = 0; p.load.appliedLoads = 1; p.pads.remaining--; p.pads.consumed++; a.loadApplied = true;
      if (protectedLoad) { p.armor!.integrity -= 5; a.armorWear = 5; a.appliedAbilityIds.push('warrior.s2.armor-temper'); a.window = 'APPLIED'; }
      p.temper.active = false; p.temper.expiresAt = null; if (a.window === 'ACTIVE') a.window = 'EXPIRED'; elapse(l, 4, a); r.status = 'ACTIVE'; break;
    }
    case 'CROSS_BRIDGE':
      together(l, a, 'BRIDGE', 'BRIDGE', 6); p.playerEnergy -= 5; a.energySpent += 5; a.healthSpent += 5; p.guard.sharedHealth += 5; p.guard.sharedEnergy += 5; p.bridge.crossings++;
      a.crossed = true; a.crossingMethod = 'BRIDGE'; a.appliedAbilityIds.push('warrior.s2.close-guard'); a.window = 'APPLIED'; p.guard.active = false; p.guard.actorId = null; p.guard.expiresAt = null; r.status = 'ACTIVE'; break;
    case 'ORDINARY_CROSS':
      p.guard.active = false; p.guard.actorId = null; p.guard.expiresAt = null; if (a.window === 'ACTIVE') a.window = 'STOPPED'; together(l, a, 'BRIDGE', 'SIDE_PATH', 8); p.bridge.ordinaryCrossings++; a.crossed = true; a.crossingMethod = 'SIDE_PATH'; r.status = 'ACTIVE'; break;
    case 'RETURN_ACTOR': together(l, a, 'BENCH', 'SIDE_PATH', 8); a.actorReturned = true; break;
    case 'WITHDRAW_PERMISSION': a.permissionWithdrawn = true; a.ownerConsent = 'WITHDRAWN'; elapse(l, 2, a); break;
    case 'RETURN_PLATE': p.plates.find(x => x.id === a.plateId)!.location = 'BENCH'; a.plateReturned = true; elapse(l, 2, a); break;
    case 'STOP': a.stopped = true; p.temper.active = false; p.temper.expiresAt = null; p.guard.active = false; p.guard.actorId = null; p.guard.expiresAt = null; if (a.window === 'ACTIVE') a.window = 'STOPPED'; elapse(l, 1, a); break;
    case 'WAIT_10': a.waits++; elapse(l, 10, a); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; r.result = a.result; elapse(l, 2, a); break;
  }
}
export function applyGloryActivity(s: SliceState, c: GloryActivityCommand, ctx: SeerContext): void {
  const reason = blockGloryLife(s, c); if (reason) throw new Error(reason);
  const l = s.glory.life, stat = c.type === 'RAISE_GUARD' ? 'will' : 'knowledge', source = checkSource(l, c, s.character.coreStats[stat], s.character.name, s.character.gender), paid = commandCost(l, c);
  const inheritedArmor = c.type === 'OBSERVE' && l.site.introducedWeek === null ? armorHandoff(s, s.week) : null;
  const budget: GloryBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality,
    cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health - paid.health, mindBefore: s.mind, mindAfter: s.mind, energyBefore: l.site.playerEnergy, energyAfter: l.site.playerEnergy - paid.energy };
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.cash = budget.cashAfter; s.health = budget.healthAfter;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check(stat, 20)); tier = check.tier; randomAfter = s.random.cursor; }
  evolve(l, c, s.week, s.date, tier, inheritedArmor);
  l.journal.push({ week: s.week, date: structuredClone(s.date), command: structuredClone(c), tier, randomBefore, randomAfter, check, source, inheritedArmor, paid, budget });
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts.at(-1)!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); }
  else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  const p = l.site; ctx.note(`修护室：${LABELS[c.type]}`, `${tier ? `检定${TIER_LABELS[tier]}。` : ''}你在${LOCATION_LABELS[p.playerLocation]}，本场精力余${p.playerEnergy}。同一银甲当前完整度${p.armor?.integrity ?? 0}，原银骑士经历中的记录不变。${c.type === 'CROSS_BRIDGE' ? '你与埃文实际走过6米桥面，本人承受5健康与额外5精力负担。' : c.type === 'WITHDRAW_PERMISSION' ? '西莉娅撤回能力许可，仍愿意按普通侧路过桥；不得强行施术。' : '已经支付的费用、实际路程与耗用物资均保留。'}`);
}
export const applyGloryLife = applyGloryActivity;
export const handleGloryLife = applyGloryActivity;
const LOCATION_LABELS: Record<GloryLocation, string> = { ENTRY: '门口', BENCH: '工作台', BRIDGE: '桥的另一端', OUTSIDE: '室外', YARD: '后院' };
const TIER_LABELS: Record<PublicResolutionTier, string> = { SUCCESS: '成功', GREAT_SUCCESS: '大成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LABELS: Record<GloryActivityCommand['type'], string> = { OBSERVE: '实地核对原甲、负载与普通侧路', CONSENT_OPERATOR: '询问本案操作许可', CONSENT_OWNER: '询问当事人本案当前许可', PREPARE: '实付护片并走到工作台', WALK: '沿普通道路步行', WEAR_PAD: '实际穿好原安全垫', REMOVE_PAD: '脱下并交回原安全垫', TEMPER_ARMOR: '银甲淬护：同一件原银甲', APPLY_LOAD: '施加一次原校准负载', RAISE_GUARD: '近身护持：当前同意的埃文', CROSS_BRIDGE: '与埃文实际过桥并承受分担', ORDINARY_CROSS: '和当事人改走普通侧路', RETURN_ACTOR: '和原过桥者沿普通侧路返回', WITHDRAW_PERMISSION: '读取西莉娅撤回能力许可的决定', RETURN_PLATE: '实际交回同一护片', STOP: '停止新的能力使用', WAIT_10: '实际等待10秒', INSPECT: '核实实际结果与收尾', LEAVE: '结束已经收束的接触', CLOSE: '结束已经收束的接触', WITHDRAW: '如实取消并结束接触', REPORT: '如实报告本案', REFLECT: '反思三次实践' };
export const GLORY_LIFE_STORY = '修护室里的西莉娅41岁、埃文36岁，与你核对同一银甲、一次负载和真实的过桥路线。每案重新取得当前同意，实付20便士领取一枚有限护片。银甲淬护需6灵性、知识20；近身护持需6灵性、意志20，成功后各有30秒供实际应用。负载真正磨损银甲5并消耗一枚安全垫片；只有实际分担6米过桥时，你才支付5健康与额外5精力。三份报告各25扮演，反思25；实际应用并报告的技巧各增8掌握。';
const CASES = [
  { id: 'armor-temper', title: '同一银甲的真实磨损', story: '核对银骑士时期形成的同一件银甲，保留它已有的完整度。在工作台穿好两枚有限垫片组成的安全垫，尝试淬护后施加一次校准负载。有效保护也会实际磨损银甲5，并用掉一枚垫片；失败或到期仍有普通安全垫和限位承接，不会免费重置原甲。' },
  { id: 'close-guard', title: '身旁一人的六米过桥', story: '埃文须本人在工作台并给出本案当前同意。近护成功后，两人实际同走6米桥面，你亲自承担5健康与额外5精力；他仍用自己的身体和精力走完。普通侧路单程8米始终开放，回程也要真的走。' },
  { id: 'revoked-crossing', title: '撤回许可后的普通侧路', story: '准备费已经实付，西莉娅在施术前改变主意。读取撤回、停止能力尝试；她仍愿意与你按普通侧路往返。交回未使用的护片并真实返回后报告，不强迫控制，不取得能力掌握。' },
] as const;
function costLabel(l: GloryLifeState, c: GloryActivityCommand): string {
  const cost = commandCost(l, c), items = [`${cost.actions}行动`]; if (cost.pennies) items.push(`${cost.pennies}便士`); if (cost.spirituality) items.push(`${cost.spirituality}灵性`); if (cost.energy) items.push(`${cost.energy}精力`); if (cost.health) items.push(`${cost.health}健康负担`);
  if (c.type === 'TEMPER_ARMOR') items.push('知识20', '成功30秒'); if (c.type === 'RAISE_GUARD') items.push('意志20', '成功30秒', '仅当前同意的一人'); if (c.type === 'APPLY_LOAD') items.push('耗1垫片', '有效保护仍磨损原甲5');
  if (c.type === 'WALK') items.push(`${distance(l.site.playerLocation, c.to)}米/秒`); if (c.type === 'CROSS_BRIDGE') items.push('两人各6米/秒'); if (c.type === 'ORDINARY_CROSS' || c.type === 'RETURN_ACTOR') items.push('两人各8米/秒'); return items.join(' · ');
}
export function gloryLifeActions(s: SliceState): GloryLifeAction[] {
  if (!promoted(s) || s.glory.encounter.status !== 'AVAILABLE') return [];
  const l = s.glory.life, out: GloryLifeAction[] = [], add = (command: GloryActivityCommand) => { const reason = blockGloryLife(s, command); out.push({ id: `GL2:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : command.type === 'WALK' ? `:${command.to}` : ''}`, label: `${LABELS[command.type]}${command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力）' : '（普通方法）' : command.type === 'WALK' ? `：${LOCATION_LABELS[command.to]}` : ''}`, cost: costLabel(l, command), enabled: reason === null, reason, command }); };
  const caseId = l.activeCase ?? GLORY_CASE_IDS.find(id => l.cases[id].status !== 'RESOLVED');
  if (caseId) { const r = l.cases[caseId], a = r.attempts.at(-1);
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId });
    if (r.status === 'OBSERVED') { add({ type: 'CONSENT_OPERATOR', caseId }); add({ type: 'CONSENT_OWNER', caseId }); add({ type: 'PREPARE', caseId, method: 'ABILITY' }); if (caseId !== 'revoked-crossing') add({ type: 'PREPARE', caseId, method: 'ORDINARY' }); }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId });
    if (r.contactOpen && a) { if (a.inspected) add({ type: 'LEAVE', caseId }); else {
      if (caseId === 'armor-temper') { if (!a.padWorn) add({ type: 'WEAR_PAD', caseId }); if (!a.loadApplied) add({ type: 'APPLY_LOAD', caseId }); if (l.site.pads.worn) add({ type: 'REMOVE_PAD', caseId }); }
      if (caseId === 'revoked-crossing' && !a.permissionWithdrawn) add({ type: 'WITHDRAW_PERMISSION', caseId });
      if (a.method === 'ABILITY' && a.abilityTier === null && caseId !== 'revoked-crossing') add({ type: caseId === 'armor-temper' ? 'TEMPER_ARMOR' : 'RAISE_GUARD', caseId });
      if (caseId !== 'armor-temper' && !a.crossed) { if (caseId === 'close-guard') add({ type: 'CROSS_BRIDGE', caseId }); add({ type: 'ORDINARY_CROSS', caseId }); }
      if (a.crossed && !a.actorReturned) add({ type: 'RETURN_ACTOR', caseId }); if (!a.plateReturned) add({ type: 'RETURN_PLATE', caseId }); if (a.abilityTier !== null && a.waits < 4) add({ type: 'WAIT_10', caseId });
      for (const to of LOCATIONS) if (to !== l.site.playerLocation) add({ type: 'WALK', caseId, to }); if (!a.stopped) add({ type: 'STOP', caseId }); add({ type: 'INSPECT', caseId });
    } }
  } else if (!l.reflected) add({ type: 'REFLECT' }); return out;
}
export function projectGloryLife(s: SliceState): GloryLifeProjection {
  const l = s.glory.life, p = l.site;
  return { title: '修护室里的原甲与近护', story: GLORY_LIFE_STORY, environment: '门口0米，工作台2米，桥另一端8米，室外−2米，后院−4米。桥面6米，普通侧路8米。本人本场精力最初100，步行每米耗1精力，换案不补；两名成人各有自己的位置与有限精力。',
    activeCase: l.activeCase, inside: hasGloryLifeLock(s), insideCase: contactOpen(l), reflected: l.reflected, site: structuredClone(p), clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: structuredClone(current(l)),
    historicalArmorIntegrity: s.silverKnight.life.armor.integrity, currentArmorIntegrity: p.armor?.integrity ?? null, armorIdentity: 'SK3-LIFE-ARMOR',
    cases: CASES.map(d => { const r = l.cases[d.id], a = r.attempts.at(-1); return { id: d.id, title: d.title, story: d.story, observations: [ ...(r.observation ? [`已普通步行4米核对现场；当时同一银甲完整度${r.observation.armorIntegrity}。`] : []), ...(a ? [`本案实付${a.penniesSpent}便士、${a.spiritualitySpent}灵性，步行${a.playerTravelMetres}米、经过${a.elapsedSeconds}秒，耗${a.energySpent}精力与${a.healthSpent}健康。`, ...(a.abilityTier ? [`检定${TIER_LABELS[a.abilityTier]}；实际应用${a.appliedAbilityIds.length}项技巧。`] : []), ...(a.loadApplied ? [`原负载已实际使用，垫片消耗1；原甲本案磨损${a.armorWear}。`] : []), ...(a.crossed ? [`本人和同一成人已按${a.crossingMethod === 'BRIDGE' ? '6米桥面' : '8米普通侧路'}实际过桥，${a.actorReturned ? '已一同沿普通侧路返回' : '尚须实际返回'}。`] : []), ...(a.permissionWithdrawn ? ['当前能力许可已经撤回，普通侧路许可仍独立有效。'] : [])] : []) ], status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '有限能力已真实应用，原人原物与实际成本保留。' : '按普通方法或停止结果收尾，未应用技巧不增加掌握。', contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions: gloryLifeActions(s) };
}
function validArmor(v: unknown): v is GloryArmor {
  return record(v) && shape(v, ['id', 'owner', 'formed', 'active', 'integrity', 'remainingSeconds']) && v.id === 'SK3-LIFE-ARMOR' && v.owner === 'PLAYER' && typeof v.formed === 'boolean' && v.active === false && v.remainingSeconds === 0 && integer(v.integrity, 0, 100) && (v.formed || v.integrity === 0);
}
export function validateGloryArmorSource(v: unknown): v is GloryArmorSource {
  return record(v) && shape(v, ['root', 'promotionWeek', 'introducedWeek', 'actor', 'at', 'snapshot']) && v.root === 'silverKnight.life.armor' && integer(v.promotionWeek, 1) && integer(v.introducedWeek, v.promotionWeek) && v.actor === 'PLAYER' && v.at === 'ENTRY' && validArmor(v.snapshot);
}
/** Independent shape checks; full ordered replay below establishes all movement, consent and paid provenance. */
export function validateGlorySiteState(v: unknown): v is GlorySiteState {
  try {
    const initial = createGlorySiteState(); if (!record(v) || !shape(v, Object.keys(initial))) return false; const p = v as unknown as GlorySiteState;
    if (p.siteId !== initial.siteId || !integer(p.clockSeconds) || !integer(p.playerTravelMetres) || !integer(p.playerEnergy, 0, 100) || ![...LOCATIONS, 'YARD'].includes(p.playerLocation)) return false;
    if (p.introducedWeek === null ? p.introducedDate !== null || p.armorSource !== null || p.armor !== null : !integer(p.introducedWeek, 1) || !isValidGameDate(p.introducedDate) || !validateGloryArmorSource(p.armorSource) || p.armorSource.introducedWeek !== p.introducedWeek || !validArmor(p.armor)) return false;
    if (p.armor && (!p.armorSource || p.armor.integrity > p.armorSource.snapshot.integrity || !same(p.armor, { ...p.armorSource.snapshot, integrity: p.armor.integrity }))) return false;
    if (typeof p.armorWorn !== 'boolean' || p.armorWorn && !p.armor?.formed) return false;
    for (const key of ['celia', 'evan'] as const) { const a = p[key]; if (!record(a) || !shape(a, Object.keys(initial[key])) || !['BENCH', 'BRIDGE', 'OUTSIDE'].includes(a.location) || !integer(a.energy, 0, 100) || !integer(a.travelMetres) || a.energy + a.travelMetres !== 100 || !same(a, { ...initial[key], location: a.location, energy: a.energy, travelMetres: a.travelMetres })) return false; }
    for (const key of ['pads', 'load', 'bridge', 'temper', 'guard'] as const) if (!record(p[key]) || !shape(p[key], Object.keys(initial[key]))) return false;
    const pads = p.pads;
    if (!['BENCH', 'PLAYER'].includes(pads.location) || !integer(pads.remaining, 0, 2) || !integer(pads.consumed, 0, 1) || typeof pads.worn !== 'boolean' || pads.worn !== (pads.location === 'PLAYER') || pads.issuedWithPlateId !== null && pads.issuedWithPlateId !== 'GL2-PLATE:armor-temper' || pads.remaining + pads.consumed !== (pads.issuedWithPlateId ? 2 : 0) || !same(pads, { ...initial.pads, issuedWithPlateId: pads.issuedWithPlateId, location: pads.location, remaining: pads.remaining, consumed: pads.consumed, worn: pads.worn })) return false;
    if (!integer(p.load.remainingLoads, 0, 1) || !integer(p.load.appliedLoads, 0, 1) || p.load.remainingLoads + p.load.appliedLoads !== 1 || p.load.appliedLoads !== pads.consumed || !same(p.load, { ...initial.load, remainingLoads: p.load.remainingLoads, appliedLoads: p.load.appliedLoads })) return false;
    if (!integer(p.bridge.crossings, 0, 1) || !integer(p.bridge.ordinaryCrossings, 0, 2) || p.bridge.crossings + p.bridge.ordinaryCrossings > 2 || !same(p.bridge, { ...initial.bridge, crossings: p.bridge.crossings, ordinaryCrossings: p.bridge.ordinaryCrossings })) return false;
    if (typeof p.temper.active !== 'boolean' || (p.temper.active ? !integer(p.temper.expiresAt, p.clockSeconds + 1) || !p.armorWorn || !p.pads.worn : p.temper.expiresAt !== null)) return false;
    if (typeof p.guard.active !== 'boolean' || (p.guard.active ? !integer(p.guard.expiresAt, p.clockSeconds + 1) || !['GL2-CELIA', 'GL2-EVAN'].includes(String(p.guard.actorId)) : p.guard.expiresAt !== null || p.guard.actorId !== null) || p.guard.sharedHealth !== p.bridge.crossings * 5 || p.guard.sharedEnergy !== p.bridge.crossings * 5 || p.temper.active && p.guard.active) return false;
    if (!Array.isArray(p.plates) || p.plates.length > 3 || new Set(p.plates.map(x => x.id)).size !== p.plates.length) return false;
    for (const x of p.plates) if (!record(x) || !shape(x, ['id', 'caseId', 'ownerId', 'quantity', 'charges', 'location', 'paidPennies', 'preparedWeek']) || !GLORY_CASE_IDS.includes(x.caseId) || x.id !== `GL2-PLATE:${x.caseId}` || x.ownerId !== 'PLAYER' || x.quantity !== 1 || ![0, 1].includes(x.charges) || !['PLAYER', 'BENCH'].includes(x.location) || x.paidPennies !== 20 || !integer(x.preparedWeek, 1)) return false;
    return true;
  } catch { return false; }
}
function validBudget(b: GloryBudget, cost: GloryCost, c: GloryActivityCommand, energy: number): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter', 'mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'])) return false;
  for (const key of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[key])) return false;
  for (const key of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[key], 0, 120)) return false;
  for (const key of ['healthBefore', 'healthAfter'] as const) if (!integer(b[key], 1, 100)) return false;
  for (const key of ['mindBefore', 'mindAfter', 'energyBefore', 'energyAfter'] as const) if (!integer(b[key], 0, 100)) return false;
  if (b.actionsAfter !== b.actionsBefore - cost.actions || b.spiritualityAfter !== b.spiritualityBefore - cost.spirituality || b.cashAfter !== b.cashBefore - cost.pennies || b.healthAfter !== b.healthBefore - cost.health || b.mindAfter !== b.mindBefore || b.energyBefore !== energy || b.energyAfter !== energy - cost.energy) return false;
  if (c.type === 'PREPARE' && b.actionsBefore < 2 || cost.spirituality > 0 && b.mindBefore <= 0 || (c.type === 'RAISE_GUARD' || c.type === 'CROSS_BRIDGE') && b.healthBefore <= 5) return false;
  return true;
}
export function validateGloryLife(s: SliceState): boolean {
  try {
    const l = s.glory?.life, promotion = s.glory?.promotionWeek, expected = createGloryLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, GLORY_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 600 || !validateGlorySiteState(l.site)) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week) || !integer(s.silverKnight.promotionWeek, 1, promotion)) return false;
    let lastWeek = promotion, nextCursor = 0, previous: GloryLifeEvent | null = null;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'inheritedArmor', 'paid', 'budget']) || !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 || previous && compareGameDates(raw.date, previous.date) < 0 || !validateGloryActivityCommand(raw.command)) return false;
      const event = raw as unknown as GloryLifeEvent, c = event.command, wasOpen = contactOpen(expected), cost = commandCost(expected, c), b = event.budget;
      if (wasOpen && (event.week !== lastWeek || previous && !same(event.date, previous.date)) || localBlock(expected, c, event.week) || !same(event.paid, cost) || !validBudget(b, cost, c, expected.site.playerEnergy)) return false;
      if (wasOpen && previous) { const old = previous.budget; if (b.actionsBefore !== old.actionsAfter || b.spiritualityBefore !== old.spiritualityAfter || b.cashBefore !== old.cashAfter || b.healthBefore !== old.healthAfter || b.mindBefore !== old.mindAfter || b.energyBefore !== old.energyAfter) return false; }
      const handoff = c.type === 'OBSERVE' && expected.site.introducedWeek === null ? armorHandoff(s, event.week) : null;
      if (!same(event.inheritedArmor, handoff) || handoff !== null && !validateGloryArmorSource(handoff)) return false;
      const base = record(event.check) && integer(event.check.baseAbility, 0, 500) ? event.check.baseAbility : 0;
      const name = record(event.source) && record(event.source.actor) && typeof event.source.actor.name === 'string' ? event.source.actor.name : '';
      const gender = record(event.source) && record(event.source.actor) && typeof event.source.actor.gender === 'string' ? event.source.actor.gender : '';
      const source = checkSource(expected, c, base, name, gender); if (!same(event.source, source)) return false;
      if (source) {
        if (name !== s.character.name || gender !== s.character.gender || source.baseAbility !== s.character.coreStats[source.coreStat] || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(event.tier)) || !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || !record(event.check) || !integer(event.check.baseAbility, 0, 500)) return false;
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore), check = resolveNormalCheck({ ability: source.coreStat, baseAbility: base, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || event.tier !== check.tier || random.cursor !== event.randomAfter) return false; nextCursor = event.randomAfter;
      } else if (event.tier !== null || event.randomBefore !== null || event.randomAfter !== null || event.check !== null) return false;
      evolve(expected, c, event.week, event.date, event.tier, handoff);
      if (!validateGlorySiteState(expected.site) || expected.site.playerEnergy !== b.energyAfter) return false;
      expected.journal.push(structuredClone(event)); previous = event; lastWeek = event.week;
    }
    const encounter = s.glory.encounter;
    if (encounter.status === 'AVAILABLE') { if (!same(l, expected)) return false; }
    else if (contactOpen(expected) || !expected.reflected || !Object.values(expected.cases).every(r => r.status === 'RESOLVED') || cleanupBlock(expected) || !same(encounter.startSite, expected.site) || !same({ ...l, site: expected.site }, expected)) return false;
    if (contactOpen(l)) {
      if (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || encounter.status !== 'AVAILABLE' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date)) return false;
      const b = previous.budget; if (s.actionsRemaining !== b.actionsAfter || s.spirituality !== b.spiritualityAfter || s.cash !== b.cashAfter || s.health !== b.healthAfter || s.mind !== b.mindAfter || l.site.playerEnergy !== b.energyAfter) return false;
    }
    if (promoted(s)) {
      const reported = Object.values(l.cases).filter(r => r.status === 'RESOLVED');
      for (const id of ['warrior.s2.armor-temper', 'warrior.s2.close-guard'] as const) { const earned = reported.reduce((n, r) => n + (r.attempts.at(-1)!.appliedAbilityIds.includes(id) ? 8 : 0), 0); if (s.progression.mastery[id] !== earned) return false; }
      if (s.progression.acting !== reported.length * 25 + (l.reflected ? 25 : 0)) return false;
    }
    return true;
  } catch { return false; }
}
export const validateGloryLifeState = validateGloryLife;
