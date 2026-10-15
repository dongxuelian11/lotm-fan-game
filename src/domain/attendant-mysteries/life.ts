import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

export const ATTENDANT_MYSTERIES_CASE_IDS = ['lost-threads', 'bounded-door', 'enclosed-realm'] as const;
export type AttendantMysteriesCaseId = typeof ATTENDANT_MYSTERIES_CASE_IDS[number];
export const ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS = ['diviner.s1.thread-regeneration', 'diviner.s1.bounded-grafting', 'diviner.s1.mysterious-realm'] as const;
export type AttendantMysteriesLifeAbilityId = typeof ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS[number];
export type AttendantMysteriesLocation = 'A' | 'B' | 'ROOM';
export type AttendantMysteriesConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
const STEPS = ['OBSERVE', 'CONSENT', 'DECLINE', 'CHECK_ORIGINALS', 'SETUP', 'ENTER_ROOM', 'REGENERATE_THREADS', 'GRAFT_DOOR', 'CONCEAL_ROOM', 'MOVE_FISH', 'MOVE_FISH_MANUALLY', 'CROSS_GATE', 'WALK_OUTBOUND', 'CHECK_CONCEALMENT', 'VOLUNTEER_EXIT', 'WITHDRAW_PERMISSION', 'WAIT_EFFECT', 'STOP', 'RETURN', 'RETURN_ITEMS', 'INSPECT', 'CLOSE', 'REPORT'] as const;
export type AttendantMysteriesActivityCommand = { type: typeof STEPS[number]; caseId: AttendantMysteriesCaseId } | { type: 'PREPARE'; caseId: AttendantMysteriesCaseId; method: 'ABILITY' | 'ORDINARY' } | { type: 'REFLECT' };
export interface AttendantMysteriesMovement { actorId: 'PLAYER' | 'AM1-MIRA' | 'AM1-FISH'; from: AttendantMysteriesLocation | 'TRAY' | 'DISH'; to: AttendantMysteriesLocation | 'TRAY' | 'DISH'; mode: 'WALK' | 'ORIGINAL_DOOR' | 'GRAFT' | 'THREADS' | 'HAND'; metres: number; seconds: number; itemIds: string[] }
export interface AttendantMysteriesAdult { id: 'AM1-GLEN' | 'AM1-MIRA'; name: string; age: 39 | 46; alive: true; independentMind: true; health: 100; mind: 100; bodyCount: 1; location: 'A' | 'ROOM'; consent: AttendantMysteriesConsent; travelMetres: number }
export interface AttendantMysteriesMaterial { id: string; caseId: AttendantMysteriesCaseId; quantity: 1; owner: 'SUPPLIER' | 'PLAYER'; holder: 'SUPPLIER' | 'PLAYER' | 'INSTALLED' | 'STORED'; paidPennies: number; wear: number }
export interface AttendantMysteriesSite {
  siteId: 'AM1-RIVERSIDE-WORKSHOP'; introducedWeek: number | null; introducedDate: PublicGameDate | null; clockSeconds: number; playerLocation: AttendantMysteriesLocation; playerTravelMetres: number;
  playerBody: { id: 'PLAYER'; count: 1; original: true; solid: true }; owner: AttendantMysteriesAdult; volunteer: AttendantMysteriesAdult;
  fish: { id: 'AM1-FISH'; quantity: 1; massGrams: 100; alive: false; owner: 'FISHERMAN' | 'PLAYER'; holder: 'TRAY' | 'DISH'; location: 'A'; travelMetres: number; provenance: { sourceId: 'AM1-LICENSED-CATCH-17'; sellerId: 'AM1-GLEN'; sellerLicence: 'AM1-RIVER-LICENCE-9'; species: 'RIVER_PERCH'; originalSpiritThreads: 'PREEXISTED_THEN_LOST'; deathBeforeScene: true }; paidPennies: 0 | 18; threadsPresent: boolean };
  gate: { id: 'AM1-TIMBER-GATE'; quantity: 1; material: 'TIMBER'; location: 'A'; endpointA: { id: 'AM1-END-A'; location: 'A'; observed: boolean; positioned: boolean }; endpointB: { id: 'AM1-END-B'; location: 'B'; observed: boolean; positioned: boolean }; distanceMetres: 8; ordinaryRouteOpen: true; traversals: number };
  parcel: { id: 'AM1-PARCEL'; quantity: 1; alive: false; massGrams: 500; owner: 'AM1-GLEN'; holder: 'OWNER' | 'PLAYER'; location: AttendantMysteriesLocation; travelMetres: number };
  room: { id: 'AM1-ROOM'; quantity: 1; radiusMetres: 6; enclosed: true; doorId: 'AM1-ORDINARY-DOOR'; doorUsable: true; tableId: 'AM1-ROOM-TABLE'; tableQuantity: 1; concealed: boolean; boundaryObservations: number };
  materials: AttendantMysteriesMaterial[]; movements: AttendantMysteriesMovement[];
}
export interface AttendantMysteriesEffect { abilityId: AttendantMysteriesLifeAbilityId; caseId: AttendantMysteriesCaseId; createdAt: number; expiresAt: number; targetId: 'AM1-FISH' | 'AM1-TIMBER-GATE' | 'AM1-ROOM' }
export interface AttendantMysteriesAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; consent: AttendantMysteriesConsent; originalsChecked: boolean; setup: boolean; entered: boolean; checkedBoundary: boolean; taskDone: boolean; returned: boolean; itemsReturned: boolean; inspected: boolean; closed: boolean; stopped: boolean; permissionWithdrawn: boolean; effectExpired: boolean; effectStopped: boolean;
  tier: PublicResolutionTier | null; elapsedSeconds: number; playerTravelMetres: number; spiritualitySpent: number; mindSpent: number; penniesSpent: number; waitedSeconds: number; appliedAbilityIds: AttendantMysteriesLifeAbilityId[]; result: 'NONE' | 'ABILITY' | 'ORDINARY'; evidence: string[];
}
export interface AttendantMysteriesCaseState { status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean; returned: boolean; closes: number; attempts: AttendantMysteriesAttempt[] }
export interface AttendantMysteriesLifeCost { actions: number; spirituality: number; mind: number; pennies: number; health: 0; cashGained: 0 }
export interface AttendantMysteriesLifeBudget { actionsBefore: number; actionsAfter: number; spiritualityBefore: number; spiritualityAfter: number; mindBefore: number; mindAfter: number; cashBefore: number; cashAfter: number; healthBefore: number; healthAfter: number }
export interface AttendantMysteriesCheckSource { caseId: AttendantMysteriesCaseId; abilityId: AttendantMysteriesLifeAbilityId; cost: number; difficulty: 20; coreStat: 'knowledge'; baseAbility: number; actor: { pathwayId: 'diviner'; sequence: 1; name: string; gender: string; bodyId: 'PLAYER'; bodyCount: 1 }; currentConsent: 'GRANTED'; maximumSeconds: number; site: AttendantMysteriesSite }
export interface AttendantMysteriesRewardReceipt { sourceId: string; actingBefore: number; actingAfter: number; masteryBefore: Record<string, number>; masteryAfter: Record<string, number>; completedSourcesBefore: string[]; completedSourcesAfter: string[] }
export interface AttendantMysteriesLifeEvent { week: number; date: PublicGameDate; revision: number; randomCursor: number; command: AttendantMysteriesActivityCommand; tier: PublicResolutionTier | null; randomBefore: number | null; randomAfter: number | null; check: PublicCheckResult | null; source: AttendantMysteriesCheckSource | null; clockBefore: number; clockAfter: number; paid: AttendantMysteriesLifeCost; budget: AttendantMysteriesLifeBudget; reward: AttendantMysteriesRewardReceipt | null }
export interface AttendantMysteriesLifeState { activeCase: AttendantMysteriesCaseId | null; reflected: boolean; completedSources: string[]; site: AttendantMysteriesSite; effect: AttendantMysteriesEffect | null; cases: Record<AttendantMysteriesCaseId, AttendantMysteriesCaseState>; journal: AttendantMysteriesLifeEvent[] }
export interface AttendantMysteriesLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AttendantMysteriesActivityCommand; cleanup?: boolean; preferredAction?: boolean }
export type AttendantMysteriesAction = AttendantMysteriesLifeAction;
export interface AttendantMysteriesLifeProjection { title: string; story: string; environment: string; nextStep: string; preferredActionId: string | null; facts: string[]; activeCase: AttendantMysteriesCaseId | null; inside: boolean; insideCase: boolean; reflected: boolean; clockSeconds: number; playerLocation: AttendantMysteriesLocation; playerTravelMetres: number; currentAttempt: AttendantMysteriesAttempt | null; effectRemainingSeconds: number; site: AttendantMysteriesSite; cases: { id: AttendantMysteriesCaseId; title: string; story: string; observations: string[]; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; returned: boolean; closes: number; attempts: AttendantMysteriesAttempt[] }[]; actions: AttendantMysteriesLifeAction[] }
const [THREADS, GRAFT, REALM] = ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const passed = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 1;
const abilityFor = (id: AttendantMysteriesCaseId): AttendantMysteriesLifeAbilityId => id === 'lost-threads' ? THREADS : id === 'bounded-door' ? GRAFT : REALM;
const durationFor = (id: AttendantMysteriesCaseId) => id === 'lost-threads' ? 20 : id === 'bounded-door' ? 30 : 60;
const cast = (c: AttendantMysteriesActivityCommand) => ['REGENERATE_THREADS', 'GRAFT_DOOR', 'CONCEAL_ROOM'].includes(c.type);
const freshCase = (): AttendantMysteriesCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, contactOpen: false, returned: false, closes: 0, attempts: [] });
export function createAttendantMysteriesLifeState(): AttendantMysteriesLifeState {
  return { activeCase: null, reflected: false, completedSources: [], effect: null, site: {
    siteId: 'AM1-RIVERSIDE-WORKSHOP', introducedWeek: null, introducedDate: null, clockSeconds: 0, playerLocation: 'A', playerTravelMetres: 0,
    playerBody: { id: 'PLAYER', count: 1, original: true, solid: true },
    owner: { id: 'AM1-GLEN', name: '格伦·伍德', age: 46, alive: true, independentMind: true, health: 100, mind: 100, bodyCount: 1, location: 'A', consent: 'UNASKED', travelMetres: 0 },
    volunteer: { id: 'AM1-MIRA', name: '米拉·里德', age: 39, alive: true, independentMind: true, health: 100, mind: 100, bodyCount: 1, location: 'A', consent: 'UNASKED', travelMetres: 0 },
    fish: { id: 'AM1-FISH', quantity: 1, massGrams: 100, alive: false, owner: 'FISHERMAN', holder: 'TRAY', location: 'A', travelMetres: 0, provenance: { sourceId: 'AM1-LICENSED-CATCH-17', sellerId: 'AM1-GLEN', sellerLicence: 'AM1-RIVER-LICENCE-9', species: 'RIVER_PERCH', originalSpiritThreads: 'PREEXISTED_THEN_LOST', deathBeforeScene: true }, paidPennies: 0, threadsPresent: false },
    gate: { id: 'AM1-TIMBER-GATE', quantity: 1, material: 'TIMBER', location: 'A', endpointA: { id: 'AM1-END-A', location: 'A', observed: false, positioned: false }, endpointB: { id: 'AM1-END-B', location: 'B', observed: false, positioned: false }, distanceMetres: 8, ordinaryRouteOpen: true, traversals: 0 },
    parcel: { id: 'AM1-PARCEL', quantity: 1, alive: false, massGrams: 500, owner: 'AM1-GLEN', holder: 'OWNER', location: 'A', travelMetres: 0 },
    room: { id: 'AM1-ROOM', quantity: 1, radiusMetres: 6, enclosed: true, doorId: 'AM1-ORDINARY-DOOR', doorUsable: true, tableId: 'AM1-ROOM-TABLE', tableQuantity: 1, concealed: false, boundaryObservations: 0 },
    materials: ATTENDANT_MYSTERIES_CASE_IDS.map(caseId => ({ id: `AM1-KIT-${caseId}`, caseId, quantity: 1, owner: 'SUPPLIER', holder: 'SUPPLIER', paidPennies: 0, wear: 0 })), movements: [],
  }, cases: { 'lost-threads': freshCase(), 'bounded-door': freshCase(), 'enclosed-realm': freshCase() }, journal: [] };
}
const current = (l: AttendantMysteriesLifeState) => l.activeCase ? l.cases[l.activeCase].attempts.at(-1) ?? null : null;
const open = (l: AttendantMysteriesLifeState) => l.activeCase !== null || Object.values(l.cases).some(x => x.contactOpen);
const material = (l: AttendantMysteriesLifeState, id: AttendantMysteriesCaseId) => l.site.materials.find(x => x.caseId === id)!;
function clean(l: AttendantMysteriesLifeState): string | null {
  const p = l.site;
  if (l.effect || p.fish.threadsPresent || p.room.concealed) return '先解除或实际等到有限效果结束。';
  if (p.playerLocation !== 'A' || p.owner.location !== 'A' || p.volunteer.location !== 'A') return '本人和米拉须经普通通道实际回到工坊门口。';
  if (p.fish.holder !== 'TRAY' || p.parcel.holder !== 'OWNER' || p.parcel.location !== 'A') return '须亲手把同一鱼料放回原盘，并交还唯一包裹。';
  if (p.materials.some(x => x.holder === 'PLAYER' || x.holder === 'INSTALLED')) return '须收好本案付费材料；磨损不会消失。';
  return null;
}
export const hasAttendantMysteriesLifeLock = (s: SliceState): boolean => open(s.attendantMysteries.life);
export const attendantMysteriesLifeClosed = (s: SliceState): boolean => !open(s.attendantMysteries.life) && s.attendantMysteries.life.reflected && !clean(s.attendantMysteries.life) && Object.values(s.attendantMysteries.life.cases).every(x => x.status === 'RESOLVED');
export function validateAttendantMysteriesActivityCommand(v: unknown): v is AttendantMysteriesActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'REFLECT') return shape(v, ['type']);
  if (!ATTENDANT_MYSTERIES_CASE_IDS.includes(v.caseId as AttendantMysteriesCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return shape(v, ['type', 'caseId']) && STEPS.includes(v.type as typeof STEPS[number]);
}
function localBlock(l: AttendantMysteriesLifeState, c: AttendantMysteriesActivityCommand, week: number): string | null {
  if (c.type === 'REFLECT') return !open(l) && !clean(l) && !l.reflected && Object.values(l.cases).every(x => x.status === 'RESOLVED') ? null : '先完成三份真实报告和普通收尾。';
  const r = l.cases[c.caseId], a = r.attempts.at(-1), p = l.site, index = ATTENDANT_MYSTERIES_CASE_IDS.indexOf(c.caseId);
  if (c.type === 'OBSERVE') return !open(l) && !clean(l) && r.status === 'AVAILABLE' && (index === 0 || l.cases[ATTENDANT_MYSTERIES_CASE_IDS[index - 1]!].status === 'RESOLVED') ? null : '先收束前案，再观察下一处真实原物。';
  if (c.type === 'PREPARE') return !open(l) && !clean(l) && r.status === 'OBSERVED' && !r.attempts.length ? null : '每案只准备一次，不可重置耗材或检查结果。';
  if (c.type === 'REPORT') return !open(l) && !clean(l) && r.status === 'EXAMINED' && a?.inspected ? null : '先核实、归还原物并结束本案。';
  if (!a || a.closed || !r.contactOpen || l.activeCase !== c.caseId || a.week !== week) return '须本周正在进行的同一工坊现场。';
  if (c.type === 'CLOSE') return a.inspected && !clean(l) ? null : '先解除效果、实际回原位、归还原物并核实。';
  if (a.inspected) return '已经核实，只须结束本案。';
  if (c.type === 'CONSENT' || c.type === 'DECLINE') return a.consent === 'UNASKED' && p.playerLocation === 'A' ? null : '本案只询问一次，拒绝后不重复索取许可。';
  if (c.type === 'WITHDRAW_PERMISSION') return a.consent === 'GRANTED' ? null : '没有仍有效的本案许可可撤回。';
  if (c.type === 'STOP') return !a.stopped ? null : '已经停止新施术；仍可普通完成，成本不退。';
  if (c.type === 'WAIT_EFFECT') return l.effect ? null : '没有需要等待的有限效果。';
  if (c.type === 'CHECK_ORIGINALS') return a.consent !== 'UNASKED' && !a.originalsChecked && p.playerLocation === 'A' ? null : '先接受本案参与者的选择，再亲核原物。';
  if (c.type === 'SETUP') return a.originalsChecked && !a.setup && p.playerLocation === 'A' && material(l, c.caseId).holder === 'PLAYER' ? null : '须亲核同一原物，使用已实付的唯一材料布置一次。';
  if (c.type === 'ENTER_ROOM') return c.caseId === 'enclosed-realm' && a.setup && !a.entered && p.playerLocation === 'A' && p.volunteer.location === 'A' ? null : '只可与米拉自愿经原门进入这间房一次；普通观察也可进行。';
  if (c.type === 'VOLUNTEER_EXIT') return c.caseId === 'enclosed-realm' && p.volunteer.location === 'ROOM' ? null : '米拉只从当前所在原房间经原门离开。';
  if (c.type === 'MOVE_FISH_MANUALLY') return c.caseId === 'lost-threads' && a.setup && !a.taskDone && p.fish.holder === 'TRAY' ? null : '只能亲手搬这份已购买的原鱼料一次。';
  if (c.type === 'WALK_OUTBOUND') return c.caseId === 'bounded-door' && a.setup && !a.taskDone && p.playerLocation === 'A' && p.parcel.holder === 'PLAYER' ? null : '本人须持同一包裹沿原通道实际走八米。';
  if (c.type === 'CHECK_CONCEALMENT') return c.caseId === 'enclosed-realm' && a.entered && !a.checkedBoundary && p.playerLocation === 'ROOM' ? null : '本人须在原房内，实际核查原门、原桌和当时在场者。';
  if (c.type === 'RETURN') {
    if (!a.taskDone || a.returned || l.effect) return '先完成实际观察或搬运，并解除效果；再普通归回原位。';
    return c.caseId === 'enclosed-realm' && p.volunteer.location === 'ROOM' ? '米拉先自愿经原门离开，本人再携原包裹离开。' : null;
  }
  if (c.type === 'RETURN_ITEMS') return a.returned && !a.itemsReturned && p.playerLocation === 'A' && !l.effect ? null : '先普通返回，再亲手收好材料并交还同一包裹。';
  if (c.type === 'INSPECT') return a.itemsReturned && !clean(l) ? null : '先把原物、在场者和本人实际带回原位。';
  if (a.method !== 'ABILITY' || a.consent !== 'GRANTED' || a.stopped || a.permissionWithdrawn) return '没有当前能力许可，只可普通搬运、观察、离开和收尾。';
  if (c.type === 'REGENERATE_THREADS') return c.caseId === 'lost-threads' && a.setup && !a.taskDone && a.tier === null && p.fish.owner === 'PLAYER' && p.fish.paidPennies === 18 && !p.fish.alive && p.fish.provenance.originalSpiritThreads === 'PREEXISTED_THEN_LOST' && !l.effect ? null : '只能对眼前这份确有已失旧灵体之线的原鱼料尝试一次，不能给钢铁或任意物体造线。';
  if (c.type === 'GRAFT_DOOR') return c.caseId === 'bounded-door' && a.setup && !a.taskDone && a.tier === null && p.gate.endpointA.observed && p.gate.endpointB.observed && p.gate.endpointA.positioned && p.gate.endpointB.positioned && p.playerLocation === 'A' && !l.effect ? null : '须已亲见并实地布置相距八米的两个原端点，只尝试一次有限连接。';
  if (c.type === 'CONCEAL_ROOM') return c.caseId === 'enclosed-realm' && a.entered && !a.checkedBoundary && a.tier === null && p.playerLocation === 'ROOM' && p.volunteer.location === 'ROOM' && !l.effect ? null : '须本人和当前自愿的米拉同在原房内，只尝试一次六十秒遮蔽。';
  if (c.type === 'MOVE_FISH') return c.caseId === 'lost-threads' && !a.taskDone && p.fish.holder === 'TRAY' && l.effect?.abilityId === THREADS && p.fish.threadsPresent ? null : '须在原鱼料旧灵体之线暂时恢复期间实际牵动同一鱼料。';
  if (c.type === 'CROSS_GATE') return c.caseId === 'bounded-door' && !a.taskDone && p.playerLocation === 'A' && p.parcel.holder === 'PLAYER' && l.effect?.abilityId === GRAFT ? null : '须连接仍有效，本人亲持唯一原包裹穿过原木门。';
  return '本案不支持这个动作。';
}
/** Durations, prices, check difficulty and AP are game calibration, not quotations of canonical power scales. */
function commandCost(c: AttendantMysteriesActivityCommand, tier: PublicResolutionTier | null = null): AttendantMysteriesLifeCost {
  return { actions: cast(c) || ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type) ? 1 : 0, spirituality: c.type === 'REGENERATE_THREADS' ? 6 : c.type === 'GRAFT_DOOR' || c.type === 'CONCEAL_ROOM' ? 8 : 0, mind: cast(c) ? tier !== null && !passed(tier) ? 4 : 2 : 0, pennies: c.type === 'PREPARE' ? c.caseId === 'lost-threads' ? 30 : c.caseId === 'bounded-door' ? 24 : 12 : 0, health: 0, cashGained: 0 };
}
const rewardSource = (c: AttendantMysteriesActivityCommand): string | null => c.type === 'REFLECT' ? 'attendant-mysteries-reflection' : c.type === 'REPORT' ? `attendant-mysteries-life-${c.caseId}` : null;
const reserve = (c: AttendantMysteriesActivityCommand) => c.type === 'PREPARE' && c.method === 'ABILITY' ? 1 : 0;
export function blockAttendantMysteriesActivity(s: SliceState, c: AttendantMysteriesActivityCommand): string | null {
  if (!validateAttendantMysteriesActivityCommand(c)) return '诡秘侍者生活命令无效。';
  if (!promoted(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.attendantMysteries.promotionWeek === null) return '须本人仍活着且已晋升诡秘侍者。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件或战斗，并实际回到贝克兰德河岸工坊。';
  const reason = localBlock(s.attendantMysteries.life, c, s.week); if (reason) return reason;
  const sourceId = rewardSource(c); if (sourceId && s.seer.completedSources.includes(sourceId)) return '本案报告或反思已经计入，不可重复领奖。';
  const cost = commandCost(c);
  if (s.actionsRemaining < cost.actions + reserve(c)) return '须预留准备和施术行动；现场普通收尾不额外耗行动。';
  if (s.cash < cost.pennies) return '须实付原材料和鱼料费用，不能凭记录免费领物。';
  if (s.spirituality < cost.spirituality || s.mind < (cost.spirituality ? 4 : 0)) return '须能支付灵性和失败精神成本；仍可普通完成。';
  return null;
}
function endEffect(l: AttendantMysteriesLifeState, a: AttendantMysteriesAttempt | null, expired = false): void {
  if (l.effect && a) { if (expired) a.effectExpired = true; else a.effectStopped = true; }
  l.effect = null; l.site.fish.threadsPresent = false; l.site.room.concealed = false;
}
function elapse(l: AttendantMysteriesLifeState, seconds: number, a = current(l)): void {
  l.site.clockSeconds += seconds; if (a) a.elapsedSeconds += seconds;
  if (l.effect && l.site.clockSeconds >= l.effect.expiresAt) endEffect(l, a, true);
}
function movePlayer(l: AttendantMysteriesLifeState, to: AttendantMysteriesLocation, mode: 'WALK' | 'ORIGINAL_DOOR' | 'GRAFT', metres: number, seconds: number): void {
  const p = l.site, a = current(l), items = p.parcel.holder === 'PLAYER' ? [p.parcel.id] : [];
  p.movements.push({ actorId: 'PLAYER', from: p.playerLocation, to, mode, metres, seconds, itemIds: items });
  p.playerLocation = to; p.playerTravelMetres += metres; if (a) a.playerTravelMetres += metres;
  if (p.parcel.holder === 'PLAYER') { p.parcel.location = to; p.parcel.travelMetres += metres; }
  elapse(l, seconds);
}
function freshAttempt(week: number, method: 'ABILITY' | 'ORDINARY', pennies: number): AttendantMysteriesAttempt { return { week, method, consent: 'UNASKED', originalsChecked: false, setup: false, entered: false, checkedBoundary: false, taskDone: false, returned: false, itemsReturned: false, inspected: false, closed: false, stopped: false, permissionWithdrawn: false, effectExpired: false, effectStopped: false, tier: null, elapsedSeconds: 0, playerTravelMetres: 0, spiritualitySpent: 0, mindSpent: 0, penniesSpent: pennies, waitedSeconds: 0, appliedAbilityIds: [], result: 'NONE', evidence: [] }; }
function sourceFor(l: AttendantMysteriesLifeState, c: AttendantMysteriesActivityCommand, baseAbility: number, name: string, gender: string): AttendantMysteriesCheckSource | null {
  if (!cast(c) || !('caseId' in c)) return null;
  return { caseId: c.caseId, abilityId: abilityFor(c.caseId), cost: commandCost(c).spirituality, difficulty: 20, coreStat: 'knowledge', baseAbility, actor: { pathwayId: 'diviner', sequence: 1, name, gender, bodyId: 'PLAYER', bodyCount: 1 }, currentConsent: 'GRANTED', maximumSeconds: durationFor(c.caseId), site: structuredClone(l.site) };
}
function evolve(l: AttendantMysteriesLifeState, c: AttendantMysteriesActivityCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null): void {
  const p = l.site;
  if (p.introducedWeek === null) { p.introducedWeek = week; p.introducedDate = structuredClone(date); }
  if (c.type === 'REFLECT') { l.reflected = true; l.completedSources.push('attendant-mysteries-reflection'); elapse(l, 6); return; }
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = week; elapse(l, 4); return; }
  if (c.type === 'PREPARE') {
    const cost = commandCost(c), m = material(l, c.caseId); r.attempts.push(freshAttempt(week, c.method, cost.pennies)); r.method = c.method; r.status = 'PREPARED'; r.contactOpen = true; l.activeCase = c.caseId;
    m.owner = 'PLAYER'; m.holder = 'PLAYER'; m.paidPennies = c.caseId === 'lost-threads' ? 12 : cost.pennies;
    if (c.caseId === 'lost-threads') { p.fish.owner = 'PLAYER'; p.fish.paidPennies = 18; }
    p.owner.consent = 'UNASKED'; p.volunteer.consent = 'UNASKED'; elapse(l, 3); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; l.completedSources.push(`attendant-mysteries-life-${c.caseId}`); elapse(l, 4); return; }
  const a = r.attempts.at(-1)!;
  if (c.type === 'CLOSE') { a.closed = true; if (a.consent === 'GRANTED') a.consent = 'CLOSED'; p.owner.consent = a.consent; p.volunteer.consent = a.consent; r.status = 'EXAMINED'; r.contactOpen = false; r.returned = true; r.closes++; elapse(l, 2); l.activeCase = null; return; }
  if (cast(c)) {
    const cost = commandCost(c, tier); a.tier = tier; a.spiritualitySpent += cost.spirituality; a.mindSpent += cost.mind; material(l, c.caseId).wear++; elapse(l, 1);
    if (passed(tier)) { l.effect = { abilityId: abilityFor(c.caseId), caseId: c.caseId, createdAt: p.clockSeconds, expiresAt: p.clockSeconds + durationFor(c.caseId), targetId: c.caseId === 'lost-threads' ? p.fish.id : c.caseId === 'bounded-door' ? p.gate.id : p.room.id }; if (c.caseId === 'lost-threads') p.fish.threadsPresent = true; if (c.caseId === 'enclosed-realm') p.room.concealed = true; }
    a.evidence.push(passed(tier) ? c.caseId === 'lost-threads' ? '这份原鱼料先前失去的灵体之线暂时恢复，最多二十秒；鱼料始终已经死亡，尚未被牵动。' : c.caseId === 'bounded-door' ? '两个亲见且实地布置的原端点临时连接三十秒；本人和原包裹仍在起点，尚未穿门。' : '原房间及仍在其中的本人、米拉、包裹和原桌被有限遮蔽，最多六十秒；身体没有复制，原门仍可通行。' : '本次能力未成，行动、灵性、精神和一份实际材料磨损照付；检查结果及已过时间保留。'); return;
  }
  switch (c.type) {
    case 'CONSENT': case 'DECLINE': a.consent = c.type === 'CONSENT' ? 'GRANTED' : 'DECLINED'; p.owner.consent = a.consent; p.volunteer.consent = a.consent; a.evidence.push(c.type === 'CONSENT' ? '格伦与米拉对本案说明后的有限演练自愿同意，随时可以撤回；这不允许伤害或控制他们。' : '接受本案能力参与的拒绝；两人仍自愿协助普通搬运和安全观察，不再次索取能力许可。'); elapse(l, 1); break;
    case 'CHECK_ORIGINALS':
      a.originalsChecked = true;
      if (c.caseId === 'bounded-door') { p.gate.endpointA.observed = true; movePlayer(l, 'B', 'WALK', 8, 8); p.gate.endpointB.observed = true; movePlayer(l, 'A', 'WALK', 8, 8); a.evidence.push('本人普通走到八米外亲见另一原端点，再走回原木门；两个端点都真实存在，未凭空指定远处目标。'); }
      else if (c.caseId === 'lost-threads') { a.evidence.push('核对格伦的捕鱼许可与这份原河鲈鱼料的来源，实付十八便士购买；它已死亡，原有灵体之线已失，不能推及钢铁或任意物体。'); elapse(l, 2); }
      else { a.evidence.push('当面核对唯一原房间，半径六米，原木门通道可用；两名成年协助者保持独立意愿，米拉仍在门外。'); elapse(l, 2); } break;
    case 'SETUP':
      a.setup = true; r.status = 'ACTIVE'; material(l, c.caseId).holder = 'INSTALLED'; material(l, c.caseId).wear++;
      if (c.caseId === 'bounded-door') { p.gate.endpointA.positioned = true; movePlayer(l, 'B', 'WALK', 8, 8); p.gate.endpointB.positioned = true; movePlayer(l, 'A', 'WALK', 8, 8); p.parcel.holder = 'PLAYER'; a.evidence.push('已付二十四便士的实物标件分别在两个原端点亲手定位，普通往返十六米；随后领起唯一五百克无生命包裹。'); }
      else { if (c.caseId === 'enclosed-realm') p.parcel.holder = 'PLAYER'; a.evidence.push(c.caseId === 'lost-threads' ? '使用实付十二便士的原托盘材料，实置相距一米的原盘与接料碟。' : '用实付十二便士的标记材料核出原房边界，领起同一原包裹；没有新增房间或门。'); elapse(l, 2); } break;
    case 'ENTER_ROOM': {
      p.movements.push({ actorId: 'AM1-MIRA', from: 'A', to: 'ROOM', mode: 'ORIGINAL_DOOR', metres: 2, seconds: 2, itemIds: [] }); p.volunteer.location = 'ROOM'; p.volunteer.travelMetres += 2; movePlayer(l, 'ROOM', 'ORIGINAL_DOOR', 2, 2); a.entered = true; a.evidence.push('米拉自愿与本人经原门走入原房，本人亲持原包裹；格伦留在门外，房内外的人没有复制或互换。'); break;
    }
    case 'MOVE_FISH': case 'MOVE_FISH_MANUALLY': {
      const ability = c.type === 'MOVE_FISH'; p.movements.push({ actorId: 'AM1-FISH', from: 'TRAY', to: 'DISH', mode: ability ? 'THREADS' : 'HAND', metres: 1, seconds: 1, itemIds: [] }); p.fish.holder = 'DISH'; p.fish.travelMetres++; a.taskDone = true; if (ability) a.appliedAbilityIds.push(THREADS); a.evidence.push(ability ? '用刚暂时恢复的旧灵体之线，把同一百克原鱼料牵到一米外原碟；只有原物位置改变，生物生命没有恢复。' : '亲手把同一百克原鱼料搬到一米外原碟，鱼料仍已死亡；没有能力应用或掌握奖励。'); elapse(l, 1); break;
    }
    case 'CROSS_GATE': case 'WALK_OUTBOUND': {
      const ability = c.type === 'CROSS_GATE'; movePlayer(l, 'B', ability ? 'GRAFT' : 'WALK', 8, ability ? 1 : 8); a.taskDone = true; if (ability) { p.gate.traversals++; a.appliedAbilityIds.push(GRAFT); } a.evidence.push(ability ? '本人亲持唯一原包裹穿过临时连接，实际抵达八米外原端点；起点没有留下另一个本人或包裹。' : '本人亲持同一原包裹沿开放原通道走八米，实际抵达另一端；没有嫁接应用。'); break;
    }
    case 'CHECK_CONCEALMENT': {
      const applied = l.effect?.abilityId === REALM && p.volunteer.location === 'ROOM' && a.consent === 'GRANTED' && !a.stopped;
      a.checkedBoundary = true; a.taskDone = true; p.room.boundaryObservations++; if (applied) a.appliedAbilityIds.push(REALM);
      a.evidence.push(applied ? '实际观察五秒：门外格伦无法分辨房内物件细节，房内本人、米拉与同一包裹和原桌仍占据原位置；原门仍可普通通行，遮蔽没有造出免伤或免疫。' : '普通观察五秒：核实原门、原桌、同一身体和原包裹，记录当前没有可验证的有效遮蔽；不虚报能力掌握。'); elapse(l, 5); break;
    }
    case 'VOLUNTEER_EXIT': p.movements.push({ actorId: 'AM1-MIRA', from: 'ROOM', to: 'A', mode: 'ORIGINAL_DOOR', metres: 2, seconds: 2, itemIds: [] }); p.volunteer.location = 'A'; p.volunteer.travelMetres += 2; a.evidence.push('米拉按自己的意愿经原门走出原房，来到门外格伦身旁；没有瞬移、复制或被困住。'); elapse(l, 2); break;
    case 'WITHDRAW_PERMISSION': a.consent = 'WITHDRAWN'; a.permissionWithdrawn = true; p.owner.consent = 'WITHDRAWN'; p.volunteer.consent = 'WITHDRAWN'; endEffect(l, a); a.evidence.push('接受本案许可撤回，立即解除当前效果并停止新施术；原身体和原物保持当前位置，已付成本与已过时间不回退。'); elapse(l, 1); break;
    case 'STOP': a.stopped = true; endEffect(l, a); a.evidence.push('停止新施术并解除当前效果，原物与本人留在实际位置；仍须普通返回，费用不退。'); elapse(l, 1); break;
    case 'WAIT_EFFECT': { const seconds = l.effect!.expiresAt - p.clockSeconds; a.waitedSeconds += seconds; elapse(l, seconds); a.evidence.push(`实际等过剩余${seconds}秒，有限效果到期；同一身体与原物都留在当前位置，成本不退。`); break; }
    case 'RETURN':
      if (c.caseId === 'lost-threads') { p.movements.push({ actorId: 'AM1-FISH', from: 'DISH', to: 'TRAY', mode: 'HAND', metres: 1, seconds: 1, itemIds: [] }); p.fish.holder = 'TRAY'; p.fish.travelMetres++; elapse(l, 1); }
      else movePlayer(l, 'A', c.caseId === 'enclosed-realm' ? 'ORIGINAL_DOOR' : 'WALK', c.caseId === 'enclosed-realm' ? 2 : 8, c.caseId === 'enclosed-realm' ? 2 : 8);
      a.returned = true; a.evidence.push('通过普通手段把原鱼料或本人亲持的原包裹送回工坊原位；结束效果没有代替返回。'); break;
    case 'RETURN_ITEMS': material(l, c.caseId).holder = 'STORED'; p.parcel.holder = 'OWNER'; p.parcel.location = 'A'; a.itemsReturned = true; a.evidence.push('当面交还同一原包裹，收好用过的付费材料；鱼料仍属本人且仍已死亡，磨损和费用保留。'); elapse(l, 2); break;
    case 'INSPECT': a.inspected = true; a.result = a.appliedAbilityIds.length ? 'ABILITY' : 'ORDINARY'; a.evidence.push('核实两位成年人身心完整、意愿独立，原身体和原物各只有一个；没有治疗、复活、永久连接或伤害免疫。'); elapse(l, 2); break;
  }
}
export function applyAttendantMysteriesActivity(s: SliceState, c: AttendantMysteriesActivityCommand, ctx: SeerContext): void {
  const reason = blockAttendantMysteriesActivity(s, c); if (reason) throw new Error(reason);
  const l = s.attendantMysteries.life, source = sourceFor(l, c, s.character.coreStats.knowledge, s.character.name, s.character.gender), clockBefore = l.site.clockSeconds, randomCursor = s.random.cursor;
  let tier: PublicResolutionTier | null = null, check: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  if (source) { randomBefore = s.random.cursor; check = structuredClone(ctx.check('knowledge', 20)); tier = check.tier; randomAfter = s.random.cursor; }
  const paid = commandCost(c, tier), budget: AttendantMysteriesLifeBudget = { actionsBefore: s.actionsRemaining, actionsAfter: s.actionsRemaining - paid.actions, spiritualityBefore: s.spirituality, spiritualityAfter: s.spirituality - paid.spirituality, mindBefore: s.mind, mindAfter: s.mind - paid.mind, cashBefore: s.cash, cashAfter: s.cash - paid.pennies, healthBefore: s.health, healthAfter: s.health };
  s.actionsRemaining = budget.actionsAfter; s.spirituality = budget.spiritualityAfter; s.mind = budget.mindAfter; s.cash = budget.cashAfter;
  const sourceId = rewardSource(c), reward: AttendantMysteriesRewardReceipt | null = sourceId ? { sourceId, actingBefore: s.progression.acting, actingAfter: s.progression.acting, masteryBefore: structuredClone(s.progression.mastery), masteryAfter: {}, completedSourcesBefore: [...s.seer.completedSources], completedSourcesAfter: [] } : null;
  evolve(l, c, s.week, s.date, tier);
  if (c.type === 'REPORT') { s.progression.acting = Math.min(100, s.progression.acting + 25); for (const id of l.cases[c.caseId].attempts[0]!.appliedAbilityIds) s.progression.mastery[id] = Math.min(500, (s.progression.mastery[id] ?? 0) + 8); }
  else if (c.type === 'REFLECT') s.progression.acting = Math.min(100, s.progression.acting + 25);
  if (reward) { s.seer.completedSources.push(reward.sourceId); reward.actingAfter = s.progression.acting; reward.masteryAfter = structuredClone(s.progression.mastery); reward.completedSourcesAfter = [...s.seer.completedSources]; }
  l.journal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision, randomCursor, command: structuredClone(c), tier, randomBefore, randomAfter, check, source, clockBefore, clockAfter: l.site.clockSeconds, paid, budget, reward });
  ctx.note(`河岸工坊：${LABELS[c.type]}`, `${tier ? `检定${TIERS[tier]}。` : ''}本人在${LOCATIONS[l.site.playerLocation]}，现场实际经过${l.site.clockSeconds}秒；原物、成本和已发生移动保留。`);
}
const LABELS: Record<AttendantMysteriesActivityCommand['type'], string> = { OBSERVE: '观察本案原现场', PREPARE: '购买原料并准备', CONSENT: '确认本案自愿许可', DECLINE: '接受能力参与拒绝', CHECK_ORIGINALS: '亲核来源和原物', SETUP: '实地布置付费原料', ENTER_ROOM: '与米拉经原门进入', REGENERATE_THREADS: '暂时再生原鱼料旧灵体之线', GRAFT_DOOR: '临时连接两个原端点', CONCEAL_ROOM: '短暂遮蔽原房间', MOVE_FISH: '牵动同一原鱼料一米', MOVE_FISH_MANUALLY: '亲手搬原鱼料一米', CROSS_GATE: '持原包裹穿过连接', WALK_OUTBOUND: '持原包裹普通走八米', CHECK_CONCEALMENT: '实际核查房间遮蔽边界', VOLUNTEER_EXIT: '米拉自愿经原门离开', WITHDRAW_PERMISSION: '接受本案许可撤回', WAIT_EFFECT: '实际等候有限效果到期', STOP: '解除效果并停止新施术', RETURN: '普通返回原位', RETURN_ITEMS: '当面交还原物并收好材料', INSPECT: '核实真实收尾', CLOSE: '结束本案接触', REPORT: '报告本案实际结果', REFLECT: '反思三案的有限边界' };
const TIERS = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' };
const LOCATIONS = { A: '工坊原门口', B: '八米外原端点', ROOM: '原房间内' };
const CASES: { id: AttendantMysteriesCaseId; title: string; story: string }[] = [
  { id: 'lost-threads', title: '旧灵体之线与同一鱼料', story: '向持照渔夫购买来源明确的原鱼料。它确曾有灵体之线但已经失去，只暂时恢复这些旧线，再牵动原料一米；也可亲手搬动。鱼料始终没有恢复生物生命。' },
  { id: 'bounded-door', title: '两个真实端点之间的一次穿门', story: '亲见相距八米的两个原端点，付费并实际定位。短暂连接原木门后，本人亲持唯一无生命包裹移动到另一端；效果结束仍须普通走回来。' },
  { id: 'enclosed-realm', title: '原房间内的短时遮蔽', story: '与自愿的米拉经原门进入半径六米的原房间，有限遮蔽最多六十秒。原人、原桌和原包裹继续占据原位置，原门随时可用；不复制身体，不保证免伤。' },
];
export function attendantMysteriesLifeActions(s: SliceState): AttendantMysteriesLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.attendantMysteries.life, out: AttendantMysteriesLifeAction[] = [], id = l.activeCase ?? ATTENDANT_MYSTERIES_CASE_IDS.find(x => l.cases[x].status !== 'RESOLVED');
  const add = (command: AttendantMysteriesActivityCommand) => { const cost = commandCost(command), reason = blockAttendantMysteriesActivity(s, command), values = [`${cost.actions}行动`]; if (cost.pennies) values.push(`${cost.pennies}便士`); if (cost.spirituality) values.push(`${cost.spirituality}灵性`, '成功2精神／失败4精神', '知识20'); if (command.type === 'WAIT_EFFECT') values.push(`${(l.effect?.expiresAt ?? l.site.clockSeconds) - l.site.clockSeconds}秒`); out.push({ id: `AM1:${'caseId' in command ? command.caseId : 'COMMON'}:${command.type}${command.type === 'PREPARE' ? `:${command.method}` : ''}`, label: LABELS[command.type] + (command.type === 'PREPARE' ? command.method === 'ABILITY' ? '（能力方法）' : '（普通方法）' : ''), cost: values.join(' · '), enabled: reason === null, reason, command, cleanup: cost.actions === 0 }); };
  if (!id) { if (!l.reflected) add({ type: 'REFLECT' }); return out; }
  const r = l.cases[id]; if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: id }); if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: id, method: 'ABILITY' }); add({ type: 'PREPARE', caseId: id, method: 'ORDINARY' }); } if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: id });
  if (r.contactOpen) for (const type of STEPS) if (!['OBSERVE', 'REPORT'].includes(type)) { const c = { type, caseId: id } as AttendantMysteriesActivityCommand; if (!localBlock(l, c, s.week)) add(c); }
  const a = current(l), order: AttendantMysteriesActivityCommand['type'][] = !a ? ['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'] : a.inspected ? ['CLOSE'] : !a.originalsChecked ? ['CONSENT', 'CHECK_ORIGINALS'] : !a.setup ? ['SETUP'] : !a.taskDone ? id === 'lost-threads' ? ['REGENERATE_THREADS', 'MOVE_FISH', 'MOVE_FISH_MANUALLY'] : id === 'bounded-door' ? ['GRAFT_DOOR', 'CROSS_GATE', 'WALK_OUTBOUND'] : ['ENTER_ROOM', 'CONCEAL_ROOM', 'CHECK_CONCEALMENT'] : ['VOLUNTEER_EXIT', 'STOP', 'RETURN', 'RETURN_ITEMS', 'INSPECT'];
  const preferred = order.map(type => out.find(x => x.enabled && x.command.type === type)).find(Boolean); if (preferred) preferred.preferredAction = true;
  return out;
}
export function createAttendantMysteriesLifeProjection(): AttendantMysteriesLifeProjection { return projectLifeState(createAttendantMysteriesLifeState(), []); }
export function projectAttendantMysteriesLife(s: SliceState): AttendantMysteriesLifeProjection { return projectLifeState(s.attendantMysteries.life, attendantMysteriesLifeActions(s)); }
function projectLifeState(l: AttendantMysteriesLifeState, actions: AttendantMysteriesLifeAction[]): AttendantMysteriesLifeProjection {
  const p = l.site, a = current(l), next = actions.find(x => x.preferredAction) ?? actions.find(x => x.enabled);
  return { title: '河岸工坊的三次有限演练', story: '格伦与米拉在新工坊保留各自独立意愿。每案只尝试一次有限效果，实际搬运原物、经过时间并亲自收尾；既往现场不因这次练习改变。', environment: '两端相距八米，普通走八秒；原门到房内两米、两秒。鱼料十八便士，第一案材料十二便士；第二案标件二十四便士，第三案材料十二便士。每次施术一行动，知识二十；旧线六灵性，嫁接及遮蔽各八灵性，成功二精神、失败四精神。旧线二十秒、连接三十秒、遮蔽六十秒；等待会实际经过时间。', nextStep: next?.label ?? (l.reflected ? '三案已收束，原物与实际成本继续保留。' : '先支付必要费用或完成普通收尾。'), preferredActionId: next?.id ?? null, facts: ['格伦46岁，米拉39岁，两人各保有唯一原身体、完整身心与独立意愿。', '原鱼料已死亡，有限旧线再生不会恢复它的生物生命，也不适用于任意无生命物体。', '嫁接只使用本次亲见、付费定位的两个原端点；遮蔽只涉及半径六米的这间原房。', `本人累计实际移动${p.playerTravelMetres}米，现场时钟${p.clockSeconds}秒。`], activeCase: l.activeCase, inside: open(l), insideCase: open(l), reflected: l.reflected, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: a ? structuredClone(a) : null, effectRemainingSeconds: l.effect ? l.effect.expiresAt - p.clockSeconds : 0, site: structuredClone(p), cases: CASES.map(d => { const r = l.cases[d.id], last = r.attempts.at(-1); return { ...d, observations: r.attempts.flatMap(x => x.evidence), status: r.status, method: r.method, result: last?.result === 'ABILITY' ? '有限能力实际应用，原身体与原物已核实。' : last?.result === 'ORDINARY' ? '普通安全完成，未应用的能力不授予掌握。' : null, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }), actions };
}
function validBudget(b: AttendantMysteriesLifeBudget, cost: AttendantMysteriesLifeCost, c: AttendantMysteriesActivityCommand): boolean {
  if (!record(b) || !shape(b, ['actionsBefore', 'actionsAfter', 'spiritualityBefore', 'spiritualityAfter', 'mindBefore', 'mindAfter', 'cashBefore', 'cashAfter', 'healthBefore', 'healthAfter'])) return false;
  for (const k of ['actionsBefore', 'actionsAfter', 'cashBefore', 'cashAfter'] as const) if (!integer(b[k])) return false;
  for (const k of ['spiritualityBefore', 'spiritualityAfter'] as const) if (!integer(b[k], 0, 120)) return false;
  for (const k of ['mindBefore', 'mindAfter'] as const) if (!integer(b[k], 0, 100)) return false;
  for (const k of ['healthBefore', 'healthAfter'] as const) if (!integer(b[k], 1, 100)) return false;
  return b.actionsBefore >= cost.actions + reserve(c) && b.actionsAfter === b.actionsBefore - cost.actions && b.spiritualityAfter === b.spiritualityBefore - cost.spirituality && b.mindAfter === b.mindBefore - cost.mind && b.cashAfter === b.cashBefore - cost.pennies && b.healthAfter === b.healthBefore && (!cost.spirituality || b.mindBefore >= 4);
}
const follows = (a: AttendantMysteriesLifeBudget, b: AttendantMysteriesLifeBudget) => b.actionsBefore === a.actionsAfter && b.spiritualityBefore === a.spiritualityAfter && b.mindBefore === a.mindAfter && b.cashBefore === a.cashAfter && b.healthBefore === a.healthAfter;
const currentBudget = (s: SliceState, b: AttendantMysteriesLifeBudget) => s.actionsRemaining === b.actionsAfter && s.spirituality === b.spiritualityAfter && s.mind === b.mindAfter && s.cash === b.cashAfter && s.health === b.healthAfter;
export function attendantMysteriesLifeRewards(l: AttendantMysteriesLifeState): { acting: number; mastery: Record<AttendantMysteriesLifeAbilityId, number> } {
  const reports = Object.values(l.cases).filter(x => x.status === 'RESOLVED');
  return { acting: reports.length * 25 + Number(l.reflected) * 25, mastery: Object.fromEntries(ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS.map(id => [id, reports.reduce((n, r) => n + (r.attempts[0]!.appliedAbilityIds.includes(id) ? 8 : 0), 0)])) as Record<AttendantMysteriesLifeAbilityId, number> };
}
/** Exact replay pins every original object, actor, movement, material, check, cost and earned source. */
export function validateAttendantMysteriesLife(s: SliceState): boolean {
  try {
    const l = s.attendantMysteries?.life, promotion = s.attendantMysteries?.promotionWeek, expected = createAttendantMysteriesLifeState();
    if (!record(l) || !shape(l, Object.keys(expected)) || !record(l.cases) || !shape(l.cases, ATTENDANT_MYSTERIES_CASE_IDS) || !Array.isArray(l.journal) || l.journal.length > 160) return false;
    if (promotion === null) return same(l, expected);
    if (!integer(promotion, 1, s.week)) return false;
    let previous: AttendantMysteriesLifeEvent | null = null, lastWeek = promotion, revision = -1, nextCursor = 0;
    for (const raw of l.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'randomCursor', 'command', 'tier', 'randomBefore', 'randomAfter', 'check', 'source', 'clockBefore', 'clockAfter', 'paid', 'budget', 'reward']) || !integer(raw.week, lastWeek, s.week) || !integer(raw.revision, revision + 1, s.revision) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || gameDaysBetween(ORIGIN, raw.date) !== 7 * (raw.week - 1) + s.ancientScholar.ritual.calendarRemainderDays || previous && compareGameDates(raw.date, previous.date) < 0 || !validateAttendantMysteriesActivityCommand(raw.command)) return false;
      const e = raw as unknown as AttendantMysteriesLifeEvent, c = e.command, wasOpen = open(expected), cost = commandCost(c, e.tier), adjacent = previous && e.revision === previous.revision + 1 && e.week === previous.week && previous.budget.actionsAfter > 0;
      if (!integer(e.randomCursor, nextCursor, s.random.cursor) || e.clockBefore !== expected.site.clockSeconds || localBlock(expected, c, e.week) || !same(e.paid, cost) || !validBudget(e.budget, cost, c)) return false;
      if (wasOpen && (e.week !== lastWeek || previous && !same(e.date, previous.date))) return false;
      if (previous && (wasOpen || adjacent) && (!follows(previous.budget, e.budget) || e.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return false;
      const base = record(e.source) && integer(e.source.baseAbility, 0, 500) ? e.source.baseAbility : 0;
      if (e.source !== null && base > s.character.coreStats.knowledge) return false;
      const source = sourceFor(expected, c, base, s.character.name, s.character.gender); if (!same(e.source, source)) return false;
      if (source) {
        if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(e.tier)) || e.randomBefore !== e.randomCursor || !integer(e.randomBefore, nextCursor, s.random.cursor) || e.randomAfter !== e.randomBefore + 1 || !integer(e.randomAfter, 0, s.random.cursor) || !record(e.check)) return false;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore), check = resolveNormalCheck({ ability: 'knowledge', baseAbility: source.baseAbility, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, e.check) || check.tier !== e.tier || random.cursor !== e.randomAfter) return false;
        nextCursor = e.randomAfter;
      } else if (e.tier !== null || e.randomBefore !== null || e.randomAfter !== null || e.check !== null) return false;
      const sourceId = rewardSource(c);
      if (sourceId) {
        const reward = e.reward;
        if (!record(reward) || !shape(reward, ['sourceId', 'actingBefore', 'actingAfter', 'masteryBefore', 'masteryAfter', 'completedSourcesBefore', 'completedSourcesAfter']) || reward.sourceId !== sourceId || reward.actingBefore !== attendantMysteriesLifeRewards(expected).acting || reward.actingAfter !== Math.min(100, reward.actingBefore + 25) || !record(reward.masteryBefore) || Object.values(reward.masteryBefore).some(x => !integer(x, 0, 500)) || !Array.isArray(reward.completedSourcesBefore) || reward.completedSourcesBefore.some(x => typeof x !== 'string' || !x.length || x.length > 200) || new Set(reward.completedSourcesBefore).size !== reward.completedSourcesBefore.length || reward.completedSourcesBefore.includes(sourceId) || !same(reward.completedSourcesAfter, [...reward.completedSourcesBefore, sourceId]) || expected.completedSources.some(id => !reward.completedSourcesBefore.includes(id))) return false;
        const mastery = { ...reward.masteryBefore };
        for (const id of ATTENDANT_MYSTERIES_LIFE_ABILITY_IDS) if (!integer(mastery[id], 0, 500)) return false;
        if (c.type === 'REPORT') for (const id of expected.cases[c.caseId].attempts[0]!.appliedAbilityIds) mastery[id] = Math.min(500, mastery[id]! + 8);
        if (!same(reward.masteryAfter, mastery)) return false;
      } else if (e.reward !== null) return false;
      evolve(expected, c, e.week, e.date, e.tier); if (e.clockAfter !== expected.site.clockSeconds) return false;
      expected.journal.push(structuredClone(e)); previous = e; lastWeek = e.week; revision = e.revision;
    }
    if (!same(l, expected)) return false;
    if (open(l) && (s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || current(l)?.week !== s.week || !previous || !same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !currentBudget(s, previous.budget))) return false;
    if (previous && (s.revision === previous.revision || s.revision === previous.revision + 1) && s.week === previous.week && previous.budget.actionsAfter > 0 && (!same(previous.date, s.date) || s.random.cursor !== (previous.randomAfter ?? previous.randomCursor) || !currentBudget(s, previous.budget))) return false;
    if (!Array.isArray(s.seer?.completedSources) || !same(s.seer.completedSources.filter(id => id.startsWith('attendant-mysteries-life-') || id === 'attendant-mysteries-reflection'), l.completedSources)) return false;
    // The parent reconciles current acting/mastery against life plus later combat; receipts above prove exact life-only deltas.
    return true;
  } catch { return false; }
}
export const validateAttendantMysteriesLifeState = validateAttendantMysteriesLife;
export const blockAttendantMysteriesLife = blockAttendantMysteriesActivity;
