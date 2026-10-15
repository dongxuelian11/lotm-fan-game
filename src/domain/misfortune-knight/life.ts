import type { PublicCheckResult, PublicCoreStatKey, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { MisfortuneKnightAction } from './types.js';

/** Original bounded practice. The old room/body/box remain authoritative in
 * concealmentServant.life. Position/holder below refine its coarse old view;
 * they never constitute another body, box, trace or spendable spirit. */
export const MISFORTUNE_KNIGHT_CASE_IDS = ['pending-parcel', 'personal-dark-guard', 'withdrawn-path'] as const;
export type MisfortuneKnightCaseId = typeof MISFORTUNE_KNIGHT_CASE_IDS[number];
export type MisfortuneKnightConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
type Method = 'ABILITY' | 'ORDINARY';
type Offset = 0 | 2 | 4 | 6;
type WindowEnd = 'NONE' | 'PENDING' | 'FAILED' | 'APPLIED' | 'OPERATION_FAILED' | 'WITHDRAWN' | 'BLOCKED' | 'STEPPED_OUT' | 'EXPIRED' | 'CANCELLED';
export type MisfortuneKnightOriginals = Pick<SliceState['concealmentServant']['life'], 'playerLocation' | 'playerTravelMetres' | 'clockSeconds' | 'erin' | 'room' | 'box' | 'page' | 'trace' | 'anchorLight'>;
type OldCompanion = SliceState['spiritWarlock']['companion'];
export type MisfortuneKnightActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: MisfortuneKnightCaseId }
  | { type: 'INVITE'; caseId: MisfortuneKnightCaseId; method: Method }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; permission: 'OWNER' | 'TECHNICIAN' | 'SELF_POWER' }
  | { type: 'WALK_TO'; metres: Offset }
  | { type: 'VISIT_ROOM' | 'SETUP_TOOLS' | 'BORROW_BOX' | 'ARM_PARCEL' | 'GUIDED_MISHAP' | 'CATCH_PARCEL' | 'BORROW_PLATE' | 'ARM_IMPACT' | 'BOUNDED_NIGHT_GUARD' | 'RELEASE_WEIGHT' | 'MANUAL_STOP' | 'STOP_RELEASE' | 'ORDINARY_CARRY' | 'BLOCK_DOOR' | 'CLEAR_DOOR' | 'WAIT_WINDOW' | 'RETURN_BOX' | 'RETURN_PLATE' | 'RETURN_TOOLS' | 'RETURN_HOME' | 'ABORT' | 'REFLECT' };
export interface MisfortuneKnightLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  invitedWeek: number | null; invitationWeeks: number[]; method: Method | null;
  permission: { owner: MisfortuneKnightConsent; technician: MisfortuneKnightConsent; selfPower: MisfortuneKnightConsent }; permissionRevision: number;
  contactOpen: boolean; visited: boolean; boxBorrowed: boolean; parcelArmed: boolean; parcelAttempted: boolean;
  guardArmed: boolean; impactReleased: boolean; operationOutcome: PublicResolutionTier | null;
  guidedAttempted: boolean; guidedOutcome: PublicResolutionTier | null; guidedEnd: WindowEnd; guidedApplied: boolean;
  guardAttempted: boolean; guardOutcome: PublicResolutionTier | null; guardEnd: WindowEnd; guardApplied: boolean;
  obstructionObserved: boolean; withdrawalObserved: boolean; abilityApplied: boolean; result: 'NONE' | Method; returned: boolean;
}
export interface MisfortuneKnightLifePractice {
  roomId: 'CS2-ROOM'; activeCase: MisfortuneKnightCaseId | null; playerLocation: 'YARD' | 'ROOM'; playerOffsetMetres: Offset;
  elapsedSeconds: number; playerTravelMetres: number; boxHolder: 'START' | 'PLAYER' | 'BOARD' | 'TRAY' | 'PAD' | 'TABLE'; boxOffsetMetres: 0 | 2;
  technician: { id: 'MK1-MILO44'; name: '米洛'; age: 44; alive: true; health: 100; mind: 100; location: 'EXIT'; offsetMetres: 6 };
  tray: { id: 'MK1-TRAY'; owner: 'MK1-MILO44'; source: string; location: 'OWNER' | 'ROOM'; offsetMetres: 2 };
  plate: { id: 'MK1-WOOD-PLATE'; owner: 'MK1-MILO44'; source: string; holder: 'OWNER' | 'PLAYER'; integrity: number; wear: number; impacts: number };
  rig: { boardId: 'MK1-TILT-BOARD'; padId: 'MK1-SOFT-PAD'; weightId: 'MK1-CALIBRATION-WEIGHT'; source: string; borrowed: boolean; tilted: boolean; parcelPending: boolean;
    weightState: 'OWNER' | 'REST' | 'ARMED' | 'RELEASED' | 'STOPPED'; releases: number; remainingForce: number; absorbedForce: number };
  pendingGuided: { caseId: MisfortuneKnightCaseId; createdAt: number; expiresAt: number; permissionRevision: number; bonus: 10 } | null;
  pendingGuard: { caseId: MisfortuneKnightCaseId; createdAt: number; expiresAt: number; permissionRevision: number; reduction: 10 } | null;
}
export interface MisfortuneKnightLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface MisfortuneKnightLifeReceipt {
  week: number; date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null;
  checkBase: number | null; check: PublicCheckResult | null; command: MisfortuneKnightActivityCommand; outcome: PublicResolutionTier | null;
  before: MisfortuneKnightLifeBudget; after: MisfortuneKnightLifeBudget; elapsedSeconds: number; playerWalkedMetres: number; boxMovedMetres: number;
  plateWear: number; releasedForce: number; absorbedForce: number; originalsBefore: MisfortuneKnightOriginals; originalsAfter: MisfortuneKnightOriginals; companion: OldCompanion;
}
export interface MisfortuneKnightLifeState {
  sourceWeek: number | null; sourceOriginals: MisfortuneKnightOriginals | null; sourceCompanion: OldCompanion | null;
  practice: MisfortuneKnightLifePractice; cases: Record<MisfortuneKnightCaseId, MisfortuneKnightLifeCase>; reflected: boolean; journal: MisfortuneKnightLifeReceipt[];
}
export interface MisfortuneKnightLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  practice: MisfortuneKnightLifePractice; originals: MisfortuneKnightOriginals;
  currentConsents: { id: 'CS2-ERIN' | 'MK1-MILO44' | 'PLAYER'; consented: boolean }[];
  cases: { id: MisfortuneKnightCaseId; title: string; story: string; observations: string[]; status: string;
    permission: MisfortuneKnightLifeCase['permission']; contactOpen: boolean; preparation: string | null; result: string | null; returned: boolean;
    attempts: { invitedWeek: number; method: Method; outcome: PublicResolutionTier | null; operationOutcome: PublicResolutionTier | null; receipts: MisfortuneKnightLifeReceipt[] }[] }[];
  ledger: MisfortuneKnightLifeReceipt[];
}
export interface MisfortuneKnightOriginalEvent { revision: number; week: number; source: string; before: MisfortuneKnightOriginals; after: MisfortuneKnightOriginals }
const GUIDED = 'darkness.s1.guided-mishap', GUARD = 'darkness.s1.bounded-night-guard';
const CASES = [
  { id: 'pending-parcel', title: '接住尚未滑下的原盒', story: '艾琳仍保管原封签盒。44岁的技师米洛带来有来源的斜板、托盘与软垫，两人留在6米出口外。本人走进原屋，准备一次尚未发生的滑动，再亲手接取。', facts: ['厄势导引实耗6灵性、2精神，意志18，每案一次。', '成功只为30秒内、4米范围内的一次普通接取增加10；施术不等于接住。', '独立接取检定失败，原盒留在原桌上的软垫，随后须亲手拾取与归还。'] },
  { id: 'personal-dark-guard', title: '木板前的一次轻触', story: '重新确认本案许可，把原盒安全放在2米原桌。本人持米洛的唯一木板，先架好尚未释放的校准轻锤，再试一次仅覆盖自己手中木板的有限护持。', facts: ['隐夜护持实耗8灵性、3精神，知识18，并消耗木板10完整度；失败也不返还。', '木板初始65完整度。成功窗口30秒，只吸收下一次10单位游戏刻度的轻触，尚未释放时没有奖励。', '失败仍留下木板磨损；实际释放后由普通手动制停，艾琳与米洛不进入受击线。'] },
  { id: 'withdrawn-path', title: '撤回以后，亲手清路还物', story: '付费重新准备，保留同一原盒、门与工具。真正放下原门闩、撤回本案许可后，未用窗口停止；本人止住未释放的轻锤、清开原门，再普通还物离开。', facts: ['阻门、走到6米出口或任一当前许可撤回，都会取消未用帮助，不重开、不退款。', '已经发生的磨损、消耗与失败保留，弱标记始终无生命、无意识。', '原盒回原起点，原托盘与木板交还米洛，本人沿40米小径回院里。'] },
] as const;
export const MISFORTUNE_KNIGHT_LIFE_ENVIRONMENT = '同一原房间长6米，原桌距起点2米，操作位4米，原门在6米。艾琳38岁与米洛44岁始终在出口外安全处；本人往返院子各40米，每米1秒。观察、邀请、报告各1行动，邀请另20便士。每案扮演25，三案后反思25；只有真正应用后才对应掌握8。旧封叶一直封存，不释放新灵体。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const successful = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 1;
const budget = (s: SliceState): MisfortuneKnightLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const ORIGINAL_KEYS = ['playerLocation', 'playerTravelMetres', 'clockSeconds', 'erin', 'room', 'box', 'page', 'trace', 'anchorLight'] as const;
export function getMisfortuneKnightOriginals(s: SliceState): MisfortuneKnightOriginals {
  const l = s.concealmentServant.life;
  return structuredClone({ playerLocation: l.playerLocation, playerTravelMetres: l.playerTravelMetres, clockSeconds: l.clockSeconds, erin: l.erin, room: l.room, box: l.box, page: l.page, trace: l.trace, anchorLight: l.anchorLight });
}
const freshCase = (): MisfortuneKnightLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invitedWeek: null, invitationWeeks: [], method: null,
  permission: { owner: 'UNASKED', technician: 'UNASKED', selfPower: 'UNASKED' }, permissionRevision: 0, contactOpen: false, visited: false, boxBorrowed: false,
  parcelArmed: false, parcelAttempted: false, guardArmed: false, impactReleased: false, operationOutcome: null, guidedAttempted: false, guidedOutcome: null, guidedEnd: 'NONE', guidedApplied: false,
  guardAttempted: false, guardOutcome: null, guardEnd: 'NONE', guardApplied: false, obstructionObserved: false, withdrawalObserved: false, abilityApplied: false, result: 'NONE', returned: false });
const freshCases = (): Record<MisfortuneKnightCaseId, MisfortuneKnightLifeCase> => ({ 'pending-parcel': freshCase(), 'personal-dark-guard': freshCase(), 'withdrawn-path': freshCase() });
function freshPractice(): MisfortuneKnightLifePractice {
  return { roomId: 'CS2-ROOM', activeCase: null, playerLocation: 'YARD', playerOffsetMetres: 6, elapsedSeconds: 0, playerTravelMetres: 0, boxHolder: 'START', boxOffsetMetres: 0,
    technician: { id: 'MK1-MILO44', name: '米洛', age: 44, alive: true, health: 100, mind: 100, location: 'EXIT', offsetMetres: 6 },
    tray: { id: 'MK1-TRAY', owner: 'MK1-MILO44', source: '技师米洛登记MK1-TOOLS-1：唯一木托盘，由本人交付、最后收回。', location: 'OWNER', offsetMetres: 2 },
    plate: { id: 'MK1-WOOD-PLATE', owner: 'MK1-MILO44', source: '技师米洛登记MK1-TOOLS-2：唯一完整度65木板，不是旧弱标记转成的材料。', holder: 'OWNER', integrity: 65, wear: 0, impacts: 0 },
    rig: { boardId: 'MK1-TILT-BOARD', padId: 'MK1-SOFT-PAD', weightId: 'MK1-CALIBRATION-WEIGHT', source: '技师米洛登记MK1-TOOLS-3：各一件斜板、软垫与有止动扣的校准轻锤；轻锤冲击刻度为10。', borrowed: false, tilted: false, parcelPending: false, weightState: 'OWNER', releases: 0, remainingForce: 0, absorbedForce: 0 },
    pendingGuided: null, pendingGuard: null };
}
export function createMisfortuneKnightLifeState(): MisfortuneKnightLifeState { return { sourceWeek: null, sourceOriginals: null, sourceCompanion: null, practice: freshPractice(), cases: freshCases(), reflected: false, journal: [] }; }
export function initializeMisfortuneKnightLife(s: SliceState): void {
  const l = s.misfortuneKnight.life, o = getMisfortuneKnightOriginals(s), leaf = s.spiritWarlock.companion;
  if (!active(s) || !same(l, createMisfortuneKnightLifeState()) || o.box.id !== 'CS2-CASE-1' || o.box.owner !== 'CS2-ERIN' || o.box.location !== 'START' || o.erin.id !== 'CS2-ERIN' || o.erin.age !== 38 || !o.erin.alive || o.erin.location !== 'EXIT' || o.playerLocation !== 'EXIT' || o.room.id !== 'CS2-ROOM' || o.room.lengthMetres !== 6 || o.room.doorBlocked || o.room.concealed || o.room.remainingSeconds !== 0 || o.anchorLight.on || !o.trace.exists || o.trace.alive || o.trace.conscious || leaf.source !== 'SW5-LEAF-1' || leaf.status !== 'SEALED' || leaf.deployments !== 12 || leaf.recalls !== 12) throw new Error('须保留同一原屋、艾琳、原盒、无生命弱标记与封存12进12回的旧叶。');
  l.sourceWeek = s.week; l.sourceOriginals = o; l.sourceCompanion = structuredClone(leaf);
}
const simpleCommands = ['VISIT_ROOM', 'SETUP_TOOLS', 'BORROW_BOX', 'ARM_PARCEL', 'GUIDED_MISHAP', 'CATCH_PARCEL', 'BORROW_PLATE', 'ARM_IMPACT', 'BOUNDED_NIGHT_GUARD', 'RELEASE_WEIGHT', 'MANUAL_STOP', 'STOP_RELEASE', 'ORDINARY_CARRY', 'BLOCK_DOOR', 'CLEAR_DOOR', 'WAIT_WINDOW', 'RETURN_BOX', 'RETURN_PLATE', 'RETURN_TOOLS', 'RETURN_HOME', 'ABORT', 'REFLECT'];
export function validateMisfortuneKnightActivityCommand(v: unknown): v is MisfortuneKnightActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && MISFORTUNE_KNIGHT_CASE_IDS.includes(v.caseId as MisfortuneKnightCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && MISFORTUNE_KNIGHT_CASE_IDS.includes(v.caseId as MisfortuneKnightCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['OWNER', 'TECHNICIAN', 'SELF_POWER'].includes(String(v.permission));
  if (v.type === 'WALK_TO') return shape(v, ['type', 'metres']) && [0, 2, 4, 6].includes(v.metres as number);
  return shape(v, ['type']) && simpleCommands.includes(String(v.type));
}
export const isMisfortuneKnightActivityCommand = validateMisfortuneKnightActivityCommand;
export const hasMisfortuneKnightLifeLock = (s: SliceState): boolean => !!s.misfortuneKnight?.life && (s.misfortuneKnight.life.practice.activeCase !== null || s.misfortuneKnight.life.practice.playerLocation !== 'YARD' || s.misfortuneKnight.life.practice.boxHolder !== 'START' || s.misfortuneKnight.life.practice.tray.location !== 'OWNER' || s.misfortuneKnight.life.practice.plate.holder !== 'OWNER' || s.misfortuneKnight.life.practice.rig.borrowed);
export const misfortuneKnightInside = hasMisfortuneKnightLifeLock;
interface ReplayModel { practice: MisfortuneKnightLifePractice; cases: Record<MisfortuneKnightCaseId, MisfortuneKnightLifeCase>; originals: MisfortuneKnightOriginals; companion: OldCompanion; reflected: boolean; sourceWeek: number }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isCheck = (c: MisfortuneKnightActivityCommand) => ['GUIDED_MISHAP', 'BOUNDED_NIGHT_GUARD', 'CATCH_PARCEL'].includes(c.type);
const checkAbility = (c: MisfortuneKnightActivityCommand): PublicCoreStatKey => c.type === 'GUIDED_MISHAP' ? 'will' : c.type === 'BOUNDED_NIGHT_GUARD' ? 'knowledge' : 'perception';
const checkBase = (s: SliceState, c: MisfortuneKnightActivityCommand) => s.character.coreStats[checkAbility(c)];
const audit = (s: SliceState, c: MisfortuneKnightActivityCommand): Audit => ({ date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: isCheck(c) ? s.random.cursor : null, randomAfter: isCheck(c) ? s.random.cursor + 1 : null, checkBase: isCheck(c) ? checkBase(s, c) : null, check: null });
const validBudget = (v: unknown): v is MisfortuneKnightLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.actions, 0, 10000);
function permittedWindow(m: ReplayModel, w: MisfortuneKnightLifePractice['pendingGuided'] | MisfortuneKnightLifePractice['pendingGuard'], seconds: number): boolean {
  if (!w) return false; const p = m.practice, r = m.cases[w.caseId];
  return p.activeCase === w.caseId && p.playerLocation === 'ROOM' && p.playerOffsetMetres <= 4 && !m.originals.room.doorBlocked && p.elapsedSeconds + seconds <= w.expiresAt && r.permissionRevision === w.permissionRevision && Object.values(r.permission).every(x => x === 'GRANTED');
}
function guidedValid(m: ReplayModel): boolean { return permittedWindow(m, m.practice.pendingGuided, Math.abs(m.practice.playerOffsetMetres - 2) + 2) && m.practice.rig.parcelPending && m.practice.rig.tilted && m.practice.boxHolder === 'BOARD' && m.practice.tray.location === 'ROOM'; }
function guardValid(m: ReplayModel): boolean { return permittedWindow(m, m.practice.pendingGuard, 1) && m.practice.rig.weightState === 'ARMED' && m.practice.plate.holder === 'PLAYER'; }
const modifiers = (m: ReplayModel, c: MisfortuneKnightActivityCommand): { source: string; value: number }[] => c.type === 'CATCH_PARCEL' && guidedValid(m) ? [{ source: '这一次尚未发生的原盒接取', value: 10 }] : [];
function transition(input: ReplayModel, c: MisfortuneKnightActivityCommand, week: number, outcome: PublicResolutionTier | null, before: MisfortuneKnightLifeBudget, clock: Audit): { model: ReplayModel; receipt: MisfortuneKnightLifeReceipt } | null {
  if (!validateMisfortuneKnightActivityCommand(c) || !validBudget(before) || !integer(week) || (isCheck(c) ? !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(outcome)) : outcome !== null)) return null;
  const m = structuredClone(input), p = m.practice, o = m.originals, id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? m.cases[id] : null;
  const receipt: MisfortuneKnightLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, playerWalkedMetres: 0, boxMovedMetres: 0, plateWear: 0, releasedForce: 0, absorbedForce: 0, originalsBefore: structuredClone(o), originalsAfter: structuredClone(o), companion: structuredClone(m.companion) };
  const pay = (ap: number, cash = 0, spirit = 0, mind = 0) => { receipt.after.actions -= ap; receipt.after.cash -= cash; receipt.after.spirituality -= spirit; receipt.after.mind -= mind; };
  const endGuided = (reason: WindowEnd) => { if (p.pendingGuided) { m.cases[p.pendingGuided.caseId].guidedEnd = reason; p.pendingGuided = null; } };
  const endGuard = (reason: WindowEnd) => { if (p.pendingGuard) { m.cases[p.pendingGuard.caseId].guardEnd = reason; p.pendingGuard = null; } };
  const cancel = (reason: WindowEnd) => { endGuided(reason); endGuard(reason); };
  const elapse = (seconds: number) => { receipt.elapsedSeconds += seconds; p.elapsedSeconds += seconds; o.clockSeconds += seconds;
    if (p.pendingGuided && p.elapsedSeconds >= p.pendingGuided.expiresAt) endGuided('EXPIRED');
    if (p.pendingGuard && p.elapsedSeconds >= p.pendingGuard.expiresAt) endGuard('EXPIRED'); };
  const move = (to: Offset) => { const distance = Math.abs(p.playerOffsetMetres - to); if (!distance) return;
    p.playerOffsetMetres = to; p.playerTravelMetres += distance; o.playerTravelMetres += distance; receipt.playerWalkedMetres += distance;
    o.playerLocation = to === 6 ? 'EXIT' : 'ROOM'; if (to === 6) cancel('STEPPED_OUT'); elapse(distance); };
  const moveBox = (to: 0 | 2, holder: MisfortuneKnightLifePractice['boxHolder']) => { const distance = Math.abs(p.boxOffsetMetres - to); p.boxOffsetMetres = to; p.boxHolder = holder; o.box.travelMetres += distance; receipt.boxMovedMetres += distance;
    o.box.location = holder === 'PLAYER' ? 'PLAYER' : to === 0 ? 'START' : 'TABLE'; };
  const outsideMove = (to: 'YARD' | 'ROOM') => { p.playerLocation = to; p.playerOffsetMetres = 6; o.playerLocation = 'EXIT'; p.playerTravelMetres += 40; o.playerTravelMetres += 40; receipt.playerWalkedMetres += 40; elapse(40); };
  const returnBox = () => { if (p.boxHolder === 'START') return; cancel('CANCELLED'); p.rig.parcelPending = false; p.rig.tilted = false; move(p.boxOffsetMetres); moveBox(p.boxOffsetMetres, 'PLAYER'); elapse(1); move(0); moveBox(0, 'START'); elapse(1); };
  const stopWeight = () => { if (p.rig.weightState === 'ARMED' || p.rig.weightState === 'RELEASED') { move(4); p.rig.weightState = 'STOPPED'; p.rig.remainingForce = 0; cancel('CANCELLED'); elapse(1); } };
  const returnPlate = () => { if (p.plate.holder === 'PLAYER') { move(6); p.plate.holder = 'OWNER'; elapse(1); } };
  const returnTools = () => { if (p.rig.borrowed) { move(0); p.rig.tilted = false; elapse(1); move(2); elapse(1); move(4); elapse(1); move(6); p.tray.location = 'OWNER'; p.rig.borrowed = false; p.rig.weightState = 'OWNER'; elapse(1); } };
  const clean = () => p.boxHolder === 'START' && p.boxOffsetMetres === 0 && o.box.location === 'START' && p.plate.holder === 'OWNER' && p.tray.location === 'OWNER' && !p.rig.borrowed && p.rig.weightState === 'OWNER' && !p.rig.parcelPending && !p.pendingGuided && !p.pendingGuard && !o.room.doorBlocked;
  const scene = p.activeCase !== null, physical = scene && !!r && r.status === 'ACTIVE' && r.invitedWeek === week;
  if (scene && (!physical || 'caseId' in c && c.caseId !== p.activeCase)) return null;
  const home = physical && p.playerLocation === 'ROOM' && r!.visited;
  const allowed = home && r!.permission.owner === 'GRANTED' && r!.permission.technician === 'GRANTED';
  const power = allowed && r!.permission.selfPower === 'GRANTED' && r!.method === 'ABILITY' && !o.room.doorBlocked && p.playerOffsetMetres <= 4;
  const leave = () => { p.activeCase = null; r!.contactOpen = false; r!.returned = true; };
  switch (c.type) {
    case 'OBSERVE': {
      const index = MISFORTUNE_KNIGHT_CASE_IDS.indexOf(c.caseId);
      if (scene || r!.status !== 'AVAILABLE' || !clean() || p.playerLocation !== 'YARD' || index > 0 && m.cases[MISFORTUNE_KNIGHT_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; elapse(5); break;
    }
    case 'INVITE':
      if (scene || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 4 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitedWeek!) || !clean() || p.playerLocation !== 'YARD') return null;
      pay(1, 20); r!.status = 'ACTIVE'; r!.invitedWeek = week; r!.invitationWeeks.push(week); r!.method = c.method; r!.permission = { owner: 'UNASKED', technician: 'UNASKED', selfPower: 'UNASKED' }; r!.permissionRevision++;
      r!.contactOpen = true; r!.visited = false; r!.returned = false; r!.boxBorrowed = false; p.activeCase = c.caseId; elapse(5); break;
    case 'VISIT_ROOM':
      if (!physical || r!.visited || p.playerLocation !== 'YARD' || o.room.doorBlocked) return null;
      outsideMove('ROOM'); r!.visited = true; break;
    case 'CONSENT': case 'DECLINE_CONSENT': case 'REVOKE_CONSENT': {
      const key = c.permission === 'OWNER' ? 'owner' : c.permission === 'TECHNICIAN' ? 'technician' : 'selfPower';
      if (!home || (c.type === 'REVOKE_CONSENT' ? r!.permission[key] !== 'GRANTED' : r!.permission[key] !== 'UNASKED') || c.type === 'CONSENT' && key === 'selfPower' && r!.method !== 'ABILITY') return null;
      r!.permission[key] = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN'; r!.permissionRevision++;
      if (c.type !== 'CONSENT') cancel('WITHDRAWN'); if (c.type === 'REVOKE_CONSENT') r!.withdrawalObserved = true; elapse(1); break;
    }
    case 'WALK_TO':
      if (!home || c.metres === p.playerOffsetMetres || p.boxHolder === 'PLAYER' || p.rig.weightState === 'RELEASED' || o.room.doorBlocked && c.metres === 6) return null;
      move(c.metres); break;
    case 'SETUP_TOOLS':
      if (!allowed || r!.permission.selfPower === 'UNASKED' || p.rig.borrowed || p.tray.location !== 'OWNER' || o.room.doorBlocked || r!.result !== 'NONE') return null;
      move(6); elapse(1); move(0); elapse(1); move(2); p.tray.location = 'ROOM'; elapse(1); move(4); p.rig.borrowed = true; p.rig.weightState = 'REST'; elapse(1); break;
    case 'BORROW_BOX':
      if (!allowed || !p.rig.borrowed || r!.boxBorrowed || p.boxHolder !== 'START' || o.room.doorBlocked || r!.permission.selfPower === 'UNASKED') return null;
      move(0); moveBox(0, 'PLAYER'); r!.boxBorrowed = true; elapse(1); break;
    case 'ARM_PARCEL':
      if (!allowed || id !== 'pending-parcel' || !r!.boxBorrowed || r!.parcelArmed || r!.parcelAttempted || p.boxHolder !== 'PLAYER' || p.boxOffsetMetres !== 0 || p.tray.location !== 'ROOM' || o.room.doorBlocked) return null;
      move(0); moveBox(0, 'BOARD'); p.rig.tilted = true; p.rig.parcelPending = true; r!.parcelArmed = true; elapse(1); move(2); break;
    case 'GUIDED_MISHAP':
      if (!power || id !== 'pending-parcel' || r!.guidedAttempted || r!.parcelAttempted || !p.rig.parcelPending || !p.rig.tilted || p.boxHolder !== 'BOARD' || p.tray.location !== 'ROOM') return null;
      pay(0, 0, 6, 2); r!.guidedAttempted = true; r!.guidedOutcome = outcome; elapse(2); r!.guidedEnd = successful(outcome) ? 'PENDING' : 'FAILED';
      if (successful(outcome)) p.pendingGuided = { caseId: id, createdAt: p.elapsedSeconds, expiresAt: p.elapsedSeconds + 30, permissionRevision: r!.permissionRevision, bonus: 10 }; break;
    case 'CATCH_PARCEL': {
      if (!allowed || id !== 'pending-parcel' || !p.rig.parcelPending || !p.rig.tilted || p.boxHolder !== 'BOARD' || r!.parcelAttempted || p.playerOffsetMetres > 4 || o.room.doorBlocked) return null;
      const helped = guidedValid(m); r!.parcelAttempted = true; r!.operationOutcome = outcome; endGuided(successful(outcome) && helped ? 'APPLIED' : 'OPERATION_FAILED');
      move(2); p.rig.parcelPending = false; p.rig.tilted = false; moveBox(2, successful(outcome) ? 'TRAY' : 'PAD'); elapse(2);
      if (successful(outcome)) { r!.guidedApplied = helped; r!.result = helped ? 'ABILITY' : 'ORDINARY'; } break;
    }
    case 'BORROW_PLATE':
      if (!allowed || id === 'pending-parcel' || !p.rig.borrowed || !r!.boxBorrowed || p.plate.holder !== 'OWNER' || p.plate.integrity < 10 || o.room.doorBlocked || r!.result !== 'NONE') return null;
      if (p.boxHolder === 'PLAYER') { move(2); moveBox(2, 'TABLE'); elapse(1); }
      move(6); p.plate.holder = 'PLAYER'; elapse(1); move(4); break;
    case 'ARM_IMPACT':
      if (!allowed || id === 'pending-parcel' || !p.rig.borrowed || p.plate.holder !== 'PLAYER' || r!.guardArmed || r!.impactReleased || p.rig.weightState !== 'REST' || o.room.doorBlocked || p.boxHolder === 'PLAYER') return null;
      move(4); p.rig.weightState = 'ARMED'; r!.guardArmed = true; elapse(1); break;
    case 'BOUNDED_NIGHT_GUARD':
      if (!power || id === 'pending-parcel' || !r!.guardArmed || r!.guardAttempted || r!.impactReleased || p.rig.weightState !== 'ARMED' || p.plate.holder !== 'PLAYER' || p.plate.integrity < 10) return null;
      pay(0, 0, 8, 3); p.plate.integrity -= 10; p.plate.wear += 10; receipt.plateWear = 10; r!.guardAttempted = true; r!.guardOutcome = outcome; elapse(2); r!.guardEnd = successful(outcome) ? 'PENDING' : 'FAILED';
      if (successful(outcome)) p.pendingGuard = { caseId: id!, createdAt: p.elapsedSeconds, expiresAt: p.elapsedSeconds + 30, permissionRevision: r!.permissionRevision, reduction: 10 }; break;
    case 'RELEASE_WEIGHT': {
      if (!allowed || id !== 'personal-dark-guard' || !r!.guardArmed || r!.impactReleased || p.rig.weightState !== 'ARMED' || p.plate.holder !== 'PLAYER' || o.room.doorBlocked || p.playerOffsetMetres !== 4) return null;
      const helped = guardValid(m); r!.impactReleased = true; p.rig.releases++; p.plate.impacts++; p.rig.weightState = 'RELEASED'; receipt.releasedForce = 10;
      p.rig.remainingForce = helped ? 0 : 10; p.rig.absorbedForce += helped ? 10 : 0; receipt.absorbedForce = helped ? 10 : 0;
      if (!r!.guardAttempted) { if (p.plate.integrity < 10) return null; p.plate.integrity -= 10; p.plate.wear += 10; receipt.plateWear = 10; }
      endGuard(helped ? 'APPLIED' : 'OPERATION_FAILED'); elapse(1); r!.guardApplied = helped;
      if (helped) { p.rig.weightState = 'STOPPED'; r!.result = 'ABILITY'; } break;
    }
    case 'MANUAL_STOP':
      if (!home || p.rig.weightState !== 'RELEASED' || p.rig.remainingForce !== 10 || !r!.impactReleased) return null;
      stopWeight(); r!.result = 'ORDINARY'; break;
    case 'STOP_RELEASE':
      if (!home || p.rig.weightState !== 'ARMED' && !p.rig.parcelPending) return null;
      cancel('CANCELLED'); stopWeight(); if (p.rig.parcelPending) { move(0); p.rig.parcelPending = false; p.rig.tilted = false; elapse(1); } break;
    case 'ORDINARY_CARRY':
      if (!home || !r!.boxBorrowed || r!.result !== 'NONE' || p.boxHolder === 'START' || o.room.doorBlocked || p.rig.weightState === 'RELEASED' || id === 'withdrawn-path' && (!r!.obstructionObserved || !r!.withdrawalObserved)) return null;
      cancel('CANCELLED'); stopWeight(); p.rig.parcelPending = false; p.rig.tilted = false; move(p.boxOffsetMetres); moveBox(p.boxOffsetMetres, 'PLAYER'); elapse(1); move(2); moveBox(2, 'TABLE'); elapse(1); r!.result = 'ORDINARY'; break;
    case 'BLOCK_DOOR':
      if (!home || o.room.doorBlocked || r!.result !== 'NONE' || p.boxHolder === 'PLAYER' || p.rig.weightState === 'RELEASED' || !r!.boxBorrowed) return null;
      // The latch is operated from inside; the two adults remain outside it.
      cancel('BLOCKED'); move(6); o.room.doorBlocked = true; r!.obstructionObserved = true; elapse(1); move(4); break;
    case 'CLEAR_DOOR':
      if (!home || !o.room.doorBlocked || p.rig.weightState === 'RELEASED') return null;
      cancel('CANCELLED'); move(6); o.room.doorBlocked = false; elapse(1); break;
    case 'WAIT_WINDOW': {
      if (!home || !p.pendingGuided && !p.pendingGuard) return null;
      const until = Math.max(p.pendingGuided?.expiresAt ?? p.elapsedSeconds, p.pendingGuard?.expiresAt ?? p.elapsedSeconds); elapse(until - p.elapsedSeconds); break;
    }
    case 'RETURN_BOX':
      if (!home || p.boxHolder === 'START' || o.room.doorBlocked || p.rig.weightState === 'RELEASED') return null;
      returnBox(); break;
    case 'RETURN_PLATE':
      if (!home || p.plate.holder !== 'PLAYER' || o.room.doorBlocked || p.rig.weightState === 'ARMED' || p.rig.weightState === 'RELEASED' || p.boxHolder === 'PLAYER') return null;
      cancel('CANCELLED'); returnPlate(); break;
    case 'RETURN_TOOLS':
      if (!home || !p.rig.borrowed || p.boxHolder !== 'START' || p.plate.holder !== 'OWNER' || o.room.doorBlocked || p.rig.weightState === 'ARMED' || p.rig.weightState === 'RELEASED' || p.rig.parcelPending) return null;
      cancel('CANCELLED'); returnTools(); break;
    case 'RETURN_HOME':
      if (!home || r!.result === 'NONE' || !clean()) return null;
      move(6); outsideMove('YARD'); leave(); r!.status = 'EXAMINED'; break;
    case 'ABORT':
      if (!physical) return null;
      cancel('CANCELLED');
      if (p.playerLocation === 'ROOM') { stopWeight(); if (o.room.doorBlocked) { move(6); o.room.doorBlocked = false; elapse(1); } returnBox(); returnPlate(); returnTools(); move(6); outsideMove('YARD'); }
      if (!clean()) return null; leave(); r!.status = r!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; break;
    case 'REPORT':
      if (scene || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || !clean() || p.playerLocation !== 'YARD') return null;
      pay(1); r!.status = 'RESOLVED'; elapse(5); break;
    case 'REFLECT':
      if (scene || m.reflected || !MISFORTUNE_KNIGHT_CASE_IDS.every(x => m.cases[x].status === 'RESOLVED') || !clean() || p.playerLocation !== 'YARD') return null;
      pay(1); m.reflected = true; elapse(5); break;
  }
  if (!validBudget(receipt.after)) return null;
  for (const value of Object.values(m.cases)) value.abilityApplied = value.guidedApplied || value.guardApplied;
  receipt.originalsAfter = structuredClone(o); return { model: m, receipt };
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate): boolean => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(l: MisfortuneKnightLifeState, s: SliceState): ReplayModel | null {
  if (l.sourceWeek === null || !l.sourceOriginals || !l.sourceCompanion || !Array.isArray(l.journal)) return null;
  let model: ReplayModel = { practice: freshPractice(), cases: freshCases(), originals: structuredClone(l.sourceOriginals), companion: structuredClone(l.sourceCompanion), reflected: false, sourceWeek: l.sourceWeek };
  let lastRandomAfter = 0, lastWeek = l.sourceWeek; let previous: MisfortuneKnightLifeReceipt | null = null;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'command', 'outcome', 'before', 'after', 'elapsedSeconds', 'playerWalkedMetres', 'boxMovedMetres', 'plateWear', 'releasedForce', 'absorbedForce', 'originalsBefore', 'originalsAfter', 'companion']) || !validateMisfortuneKnightActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : 0, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (model.practice.activeCase !== null && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isCheck(entry.command)) {
      if (entry.checkBase !== checkBase(s, entry.command) || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ability: checkAbility(entry.command), baseAbility: entry.checkBase, difficulty: 18, modifiers: modifiers(model, entry.command), roll: random.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
    } else if (entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry); if (!next || !same(next.receipt, entry)) return null;
    model = next.model; previous = entry; lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
export function misfortuneKnightExpectedOriginals(s: SliceState): MisfortuneKnightOriginals | null { try { const m = replayLife(s.misfortuneKnight.life, s); return m ? structuredClone(m.originals) : null; } catch { return null; } }
export function misfortuneKnightLifeOriginalEvents(s: SliceState): MisfortuneKnightOriginalEvent[] { return s.misfortuneKnight.life.journal.map(r => ({ revision: r.revision, week: r.week, source: `misfortune-knight-life:${r.command.type}`, before: structuredClone(r.originalsBefore), after: structuredClone(r.originalsAfter) })); }
export const misfortuneKnightLifeOriginalTail = misfortuneKnightExpectedOriginals;
/** Exact new-skill increments, derived from replayed applied reports only. */
export function misfortuneKnightLifeMasteryGains(s: SliceState): Record<string, number> {
  const gains: Record<string, number> = { [GUIDED]: 0, [GUARD]: 0 };
  try { const m = replayLife(s.misfortuneKnight.life, s); if (!m) return gains;
    const parcel = m.cases['pending-parcel'], guard = m.cases['personal-dark-guard'];
    if (parcel.status === 'RESOLVED' && parcel.guidedApplied && parcel.result === 'ABILITY') gains[GUIDED] = 8;
    if (guard.status === 'RESOLVED' && guard.guardApplied && guard.result === 'ABILITY') gains[GUARD] = 8;
  } catch { return gains; } return gains;
}
export function lifeAdultsAbsent(s: SliceState): boolean { const p = s.misfortuneKnight.life.practice; return !hasMisfortuneKnightLifeLock(s) && s.concealmentServant.life.erin.location === 'EXIT' && p.technician.location === 'EXIT' && p.technician.offsetMetres === 6 && p.playerLocation === 'YARD'; }
export const misfortuneKnightLifeAdultsAbsent = lifeAdultsAbsent;
export function validateMisfortuneKnightLife(s: SliceState): boolean {
  try {
    const l = s.misfortuneKnight?.life;
    if (!record(l) || !shape(l, ['sourceWeek', 'sourceOriginals', 'sourceCompanion', 'practice', 'cases', 'reflected', 'journal']) || !Array.isArray(l.journal) || !record(l.practice) || !record(l.cases) || !shape(l.cases, MISFORTUNE_KNIGHT_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.misfortuneKnight.promotionWeek === null) return same(l, createMisfortuneKnightLifeState());
    if (!integer(l.sourceWeek, 0, s.week) || l.sourceWeek !== s.misfortuneKnight.promotionWeek || !l.sourceOriginals || !shape(l.sourceOriginals, ORIGINAL_KEYS) || !same(l.sourceOriginals, s.misfortuneKnight.sourceScene?.originals) || !same(l.sourceCompanion, s.misfortuneKnight.sourceScene?.companion) || l.sourceCompanion?.source !== 'SW5-LEAF-1' || l.sourceCompanion.status !== 'SEALED' || l.sourceCompanion.deployments !== 12 || l.sourceCompanion.recalls !== 12) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l.practice, replay.practice) || !same(l.cases, replay.cases) || l.reflected !== replay.reflected || !same(getMisfortuneKnightOriginals(s), replay.originals)) return false;
    let acting = l.reflected ? 25 : 0;
    for (const id of MISFORTUNE_KNIGHT_CASE_IDS) { const r = l.cases[id], resolved = r.status === 'RESOLVED';
      if (s.seer.completedSources.filter(source => source === `misfortune-knight-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
      if (resolved && r.abilityApplied && r.result === 'ABILITY' && (s.progression.mastery[id === 'pending-parcel' ? GUIDED : GUARD] ?? 0) < 8) return false;
    }
    if (s.seer.completedSources.filter(source => source === 'misfortune-knight-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting) return false;
    const last = l.journal.at(-1), locked = hasMisfortuneKnightLifeLock(s);
    if (locked && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.misfortuneKnight.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.misfortuneKnight.encounter.status) || !same(s.spiritWarlock.companion, l.sourceCompanion) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.after.actions > 0 && last.revision === s.revision - 1 && last.week === s.week && (!same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    return true;
  } catch { return false; }
}
export function blockMisfortuneKnightActivity(s: SliceState, c: MisfortuneKnightActivityCommand): string | null {
  if (!validateMisfortuneKnightActivityCommand(c)) return '原屋生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已实际成为厄难骑士。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际回到贝克兰德。';
  if (s.misfortuneKnight.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.misfortuneKnight.encounter.status) || s.misfortuneKnight.encounter.preparation !== null) return '先收束晋升准备或当前遭遇。';
  if (!validateMisfortuneKnightLife(s) || !same(s.spiritWarlock.companion, s.misfortuneKnight.life.sourceCompanion)) return '同一原人原物、封存旧叶、真实成本或历史记录不一致。';
  if (!transition(replayLife(s.misfortuneKnight.life, s)!, c, s.week, isCheck(c) ? 'SUCCESS' : null, budget(s), audit(s, c))) return '先完成实际前一步，核对本次许可、原物位置、普通退路与有限窗口；原失败和已付代价保留。';
  return null;
}
const NOTES: Record<MisfortuneKnightActivityCommand['type'], [string, string]> = {
  OBSERVE: ['查看原6米房间与普通退路', '原盒、原门、原纸和无生命弱标记仍各为同一件。'],
  INVITE: ['重新邀请艾琳与米洛', '实付1行动20便士。物主、技师工具与本人能力决定分别重新取得；两位成年人留在6米出口外。'],
  VISIT_ROOM: ['沿40米普通小径走到原屋', '本人实际步行40米、实耗40秒，仍须沿原屋路线走到操作位置。'],
  CONSENT: ['确认这一项当前许可', '只覆盖本案已说明的用途，任何一项都能撤回；无人被要求承受身体伤害。'],
  DECLINE_CONSENT: ['记录这一项拒绝', '拒绝已经生效，普通还物与安全离开仍可完成。'],
  REVOKE_CONSENT: ['撤回这一项当前许可', '尚未应用的窗口立即停止。灵性、精神、工具磨损与既成动作不会返还或倒转。'],
  WALK_TO: ['沿原屋普通路线行走', '按实际距离耗时；到6米出口即取消未用帮助，回到屋里也不会重开。'],
  SETUP_TOOLS: ['接过米洛的原工具并亲手布置', '逐步行至0米斜板、2米原桌托盘软垫、4米校准位；工具有唯一来源，不由弱标记生成。'],
  BORROW_BOX: ['到原起点亲手拿起同一原盒', '同一原盒由本人亲手拿起，所有权仍属艾琳，旧封签与原纸记录保留。'],
  ARM_PARCEL: ['架好一次尚未发生的滑动', '原盒仍在0米斜板止动端，2米原托盘已就位，下一次亲手接取才真正释放。'],
  GUIDED_MISHAP: ['尝试一次厄势导引', '实耗6灵性2精神，意志18。成功只打开30秒内一次接取加值10，没有重掷过去事件。'],
  CATCH_PARCEL: ['释放原盒并亲手接取一次', '独立感知18检定；原盒实际移动2米。失败留在原桌软垫，仍须普通拾取，不自动重试。'],
  BORROW_PLATE: ['把原盒放稳，再亲手接过木板', '原盒真实移至2米原桌，本人到6米处接过米洛唯一木板，再走回4米操作位。'],
  ARM_IMPACT: ['架好尚未释放的校准轻锤', '轻锤、可见受击线与本人手持木板均真实就位；两位成年人在出口外。'],
  BOUNDED_NIGHT_GUARD: ['尝试一次隐夜护持', '实耗8灵性3精神、木板10完整度，知识18。成功只保留30秒内的一次轻触防护，失败仍有可见磨损。'],
  RELEASE_WEIGHT: ['真正释放一次校准轻锤', '轻锤冲击刻度为10。有效护持吸收这一次实际轻触；无有效护持则仍待普通手动制停，没有让人受伤。'],
  MANUAL_STOP: ['亲手制停已经释放的轻锤', '剩余10单位轻触由普通止动扣收束。原失败与木板磨损保留，没有补健康或能源。'],
  STOP_RELEASE: ['扣住尚未释放的原物', '亲手到实际位置停止未来动作，取消未用帮助；已经发生的动作与磨损不会倒退。'],
  ORDINARY_CARRY: ['亲手拾取并普通搬放原盒', '走到原盒实际位置，带到2米原桌放稳；撤回后只进行原已约定的安全收束，不再要求他人受术。'],
  BLOCK_DOOR: ['亲手放下原门闩', '本人实际走到6米门内放闩，再回4米。原路真正受阻，未用窗口停止；两位成年人一直在门外。'],
  CLEAR_DOOR: ['亲手解开同一原门闩', '本人走到门内解除实在的阻碍，已经中断的窗口不会恢复。'],
  WAIT_WINDOW: ['等到这次30秒窗口真正到期', '实际等待剩余秒数；未完成真实动作，不增加掌握，也不返还代价。'],
  RETURN_BOX: ['亲手归还同一原盒', '走到原盒真实位置拾取，再带回0米原起点，实记本人和原盒的移动。'],
  RETURN_PLATE: ['把同一木板交还米洛', '本人实走到6米出口交还。木板所有磨损保留，没有维修或免费替换。'],
  RETURN_TOOLS: ['沿原屋逐件收起并交还原工具', '实际到0、2、4米位置收斜板、托盘软垫与轻锤，再走到6米处交还米洛。'],
  RETURN_HOME: ['沿40米原路回到院子', '原盒工具已归还、门已清开，本人实际步行40米离场，旧封叶仍封存。'],
  ABORT: ['实际止动、清门、还物并步行退出', '每一段拾取返程都计入距离与时间。失败、消耗和磨损保留；未完成的案子可下一真实周付费普通续办。'],
  REPORT: ['报告这一案实际完成的结果', '实付1行动，扮演增加25。仅真正应用于实际动作的技能增加8掌握。'],
  REFLECT: ['反思有限帮助与撤回后的普通收束', '三份真实报告后花1行动，扮演增加25；没有制造原灵、改写厄运或恢复原死人。'],
};
export function applyMisfortuneKnightActivity(s: SliceState, c: MisfortuneKnightActivityCommand, ctx: SeerContext): void {
  const reason = blockMisfortuneKnightActivity(s, c); if (reason) throw new Error(reason);
  const l = s.misfortuneKnight.life, model = replayLife(l, s)!, clock = audit(s, c); let check: PublicCheckResult | null = null;
  if (isCheck(c)) { check = resolveNormalCheck({ ability: checkAbility(c), baseAbility: checkBase(s, c), difficulty: 18, modifiers: modifiers(model, c), roll: ctx.roll(1, 100) }); s.lastCheck = check; }
  clock.check = check; if (isCheck(c)) clock.randomAfter = s.random.cursor;
  const next = transition(model, c, s.week, check?.tier ?? null, budget(s), clock)!;
  s.health = next.receipt.after.health; s.mind = next.receipt.after.mind; s.spirituality = next.receipt.after.spirituality; s.cash = next.receipt.after.cash; s.actionsRemaining = next.receipt.after.actions;
  l.practice = next.model.practice; l.cases = next.model.cases; l.reflected = next.model.reflected; l.journal.push(next.receipt);
  // Exact authoritative old objects; never touch the frozen old cases/journal.
  Object.assign(s.concealmentServant.life, structuredClone(next.model.originals));
  if (c.type === 'REPORT') { const r = l.cases[c.caseId]; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`misfortune-knight-case:${c.caseId}`);
    if (r.abilityApplied && r.result === 'ABILITY' && c.caseId !== 'withdrawn-path') { const ability = c.caseId === 'pending-parcel' ? GUIDED : GUARD; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); } }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('misfortune-knight-reflection'); }
  const note = NOTES[c.type]; let detail = note[1];
  if (c.type === 'OBSERVE') { const entry = CASES.find(item => item.id === c.caseId)!; detail = entry.story + entry.facts.join(' '); }
  if (isCheck(c)) detail += successful(check?.tier ?? null) ? c.type === 'CATCH_PARCEL' ? '本次实际接取成功，仍须真实还物与返程。' : '有限窗口已打开，仍待真实动作，此刻没有掌握奖励。' : '真实失败与代价已保留，不能重抽；普通收束仍可继续。';
  ctx.note(note[0], detail);
}
export const applyMisfortuneKnightLifeIntent = applyMisfortuneKnightActivity;
export function misfortuneKnightLifeActions(s: SliceState): MisfortuneKnightAction[] {
  if (!active(s)) return [];
  const out: MisfortuneKnightAction[] = [], l = s.misfortuneKnight.life, p = l.practice;
  const add = (command: MisfortuneKnightActivityCommand, label: string, cost: string, cleanup = false, preferredAction = false) => {
    const reason = blockMisfortuneKnightActivity(s, command);
    out.push({ id: `misfortune-knight-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}${'metres' in command ? '-' + command.metres : ''}`, label, cost, command, enabled: reason === null, reason, cleanup, preferredAction });
  };
  const simple = (type: MisfortuneKnightActivityCommand['type'], label: string, cost: string, cleanup = false, preferred = true) => add({ type } as MisfortuneKnightActivityCommand, label, cost, cleanup, preferred);
  if (p.activeCase) {
    const id = p.activeCase, r = l.cases[id];
    if (!r.visited) simple('VISIT_ROOM', '沿40米小径走到原屋', '0行动 · 40米／40秒');
    else if (r.permission.owner === 'UNASKED') { add({ type: 'CONSENT', permission: 'OWNER' }, '询问艾琳本案原盒与原屋许可', '0行动 · 当次物主许可', false, true); add({ type: 'DECLINE_CONSENT', permission: 'OWNER' }, '艾琳拒绝本案用途', '0行动 · 可安全退出', true); }
    else if (r.permission.technician === 'UNASKED') { add({ type: 'CONSENT', permission: 'TECHNICIAN' }, '询问米洛本案工具许可', '0行动 · 当次工具许可', false, true); add({ type: 'DECLINE_CONSENT', permission: 'TECHNICIAN' }, '米洛拒绝借用本案工具', '0行动 · 可安全退出', true); }
    else if (r.permission.selfPower === 'UNASKED') { if (r.method === 'ABILITY') add({ type: 'CONSENT', permission: 'SELF_POWER' }, '本人确认这一次有限能力使用', '0行动 · 可随时停止', false, true); add({ type: 'DECLINE_CONSENT', permission: 'SELF_POWER' }, '本人选择普通方法', '0行动', true, r.method === 'ORDINARY'); }
    else if (r.result !== 'NONE') {
      if (s.concealmentServant.life.room.doorBlocked) simple('CLEAR_DOOR', '亲手解开原门闩', '0行动 · 实际步行与解闩', true);
      else if (p.rig.weightState === 'ARMED' || p.rig.weightState === 'RELEASED') simple(p.rig.weightState === 'RELEASED' ? 'MANUAL_STOP' : 'STOP_RELEASE', '亲手止住原轻锤', '0行动 · 真实止动', true);
      else if (p.boxHolder !== 'START') simple('RETURN_BOX', '把同一原盒带回原起点', '0行动 · 实际拾取与返程', true);
      else if (p.plate.holder === 'PLAYER') simple('RETURN_PLATE', '把有原磨损的木板还给米洛', '0行动 · 实走到6米处', true);
      else if (p.rig.borrowed) simple('RETURN_TOOLS', '逐件收起并交还原工具', '0行动 · 实走原0／2／4／6米位置', true);
      else simple('RETURN_HOME', '沿40米原路回院里', '0行动 · 40米／40秒', true);
    } else if (!p.rig.borrowed) simple('SETUP_TOOLS', '接过并亲手布置米洛的原工具', '0行动 · 实际搬运布置');
    else if (!r.boxBorrowed) simple('BORROW_BOX', '走到0米处亲手借来原盒', '0行动 · 实走与拾取');
    else if (id === 'pending-parcel') {
      if (r.method === 'ORDINARY' || r.permission.selfPower !== 'GRANTED') simple('ORDINARY_CARRY', '普通搬放同一原盒', '0行动 · 实际行走与取放', true);
      else if (!r.parcelArmed) simple('ARM_PARCEL', '架好尚未发生的一次原盒滑动', '0行动 · 原斜板与托盘就位');
      else if (!r.guidedAttempted) simple('GUIDED_MISHAP', '尝试一次厄势导引', '0行动 · 6灵性＋2精神 · 意志18');
      else if (!r.parcelAttempted && p.rig.parcelPending && p.playerOffsetMetres <= 4) simple('CATCH_PARCEL', '释放原盒并亲手接取一次', '0行动 · 感知18 · 实移2米');
      else simple('ORDINARY_CARRY', '保留失败，普通拾取放稳原盒', '0行动 · 实际拾取与搬放', true);
    } else if (id === 'withdrawn-path' && (r.guardAttempted || r.method === 'ORDINARY' || r.permission.selfPower !== 'GRANTED')) {
      if (p.boxHolder === 'PLAYER') simple('BORROW_PLATE', '先放稳原盒，再接过原木板', '0行动 · 实际搬物与步行');
      else if (!r.obstructionObserved) simple('BLOCK_DOOR', '亲手放下同一原门闩', '0行动 · 实际往返 · 中断未用窗口', true);
      else if (!r.withdrawalObserved) add({ type: 'REVOKE_CONSENT', permission: 'OWNER' }, '艾琳撤回本次能力与用途许可', '0行动 · 已付代价保留', true, true);
      else if (p.rig.weightState === 'ARMED') simple('STOP_RELEASE', '亲手扣住未释放的轻锤', '0行动 · 实际止动', true);
      else if (s.concealmentServant.life.room.doorBlocked) simple('CLEAR_DOOR', '走到原门亲手解闩', '0行动 · 清开真实退路', true);
      else simple('ORDINARY_CARRY', '按原约定普通收束原盒', '0行动 · 实际拾取搬放', true);
    } else if (r.method === 'ORDINARY' || r.permission.selfPower !== 'GRANTED') simple('ORDINARY_CARRY', '普通搬放原盒并结束本案', '0行动 · 真实搬放', true);
    else if (p.plate.holder === 'OWNER') simple('BORROW_PLATE', '放稳原盒，再接过米洛的原木板', '0行动 · 实际搬物与步行');
    else if (!r.guardArmed) simple('ARM_IMPACT', '架好尚未释放的校准轻锤', '0行动 · 真实可见轻触线');
    else if (!r.guardAttempted) simple('BOUNDED_NIGHT_GUARD', '尝试一次隐夜护持', '0行动 · 8灵性＋3精神＋10木板完整度 · 知识18');
    else if (!r.impactReleased) simple('RELEASE_WEIGHT', '真正释放一次校准轻锤', '0行动 · 单次10游戏刻度轻触');
    else if (p.rig.weightState === 'RELEASED') simple('MANUAL_STOP', '亲手制停已经释放的轻锤', '0行动 · 原失败与磨损保留', true);
    else simple('ORDINARY_CARRY', '普通拾取放稳原盒', '0行动 · 真实搬放', true);
    if (r.visited && r.boxBorrowed && r.result === 'NONE' && (id !== 'withdrawn-path' || r.obstructionObserved && r.withdrawalObserved) && !out.some(a => a.command.type === 'ORDINARY_CARRY')) simple('ORDINARY_CARRY', '不用能力，普通收束原盒', '0行动 · 已付代价保留', true, false);
    if (p.pendingGuided || p.pendingGuard) { simple('WAIT_WINDOW', '等待本次30秒窗口到期', '0行动 · 实际等待', true, false); add({ type: 'WALK_TO', metres: 6 }, '沿原路走到6米出口停止帮助', '0行动 · 实际步行', true); if (!out.some(a => a.command.type === 'BLOCK_DOOR')) simple('BLOCK_DOOR', '亲手放下原门闩，停止未用帮助', '0行动 · 实际阻门', true, false); }
    if (r.visited && s.concealmentServant.life.room.doorBlocked && !out.some(a => a.command.type === 'CLEAR_DOOR')) simple('CLEAR_DOOR', '亲手清开原门', '0行动 · 实际解闩', true, false);
    for (const permission of ['OWNER', 'TECHNICIAN', 'SELF_POWER'] as const) { const key = permission === 'OWNER' ? 'owner' : permission === 'TECHNICIAN' ? 'technician' : 'selfPower';
      if (r.permission[key] === 'GRANTED' && !out.some(a => a.command.type === 'REVOKE_CONSENT' && a.command.permission === permission)) add({ type: 'REVOKE_CONSENT', permission }, permission === 'OWNER' ? '艾琳撤回本案许可' : permission === 'TECHNICIAN' ? '米洛撤回本案工具许可' : '本人停止本次能力', '0行动 · 普通还物离场仍可继续', true); }
    simple('ABORT', '实际止动、清门、还物并步行退出', '0行动 · 原失败与成本保留', true, !out.some(a => a.enabled && a.preferredAction)); return out;
  }
  const next = CASES.find(item => l.cases[item.id].status !== 'RESOLVED');
  if (next) { const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, `观察：${next.title}`, '1行动', false, true);
    if (r.status === 'OBSERVED' || r.status === 'PAUSED') { if (r.status === 'OBSERVED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, '重新邀请并说明有限能力用途', '1行动 · 20便士', false, true); add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED' ? '下一真实周重新邀请，普通续办' : '重新邀请，只按普通方法完成', '1行动 · 20便士', false, r.status === 'PAUSED'); }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, '报告原物已还、本人已返程的真实结果', '1行动 · 扮演25 · 实际应用才掌握8', false, true);
  } else if (!l.reflected) simple('REFLECT', '反思有限帮助与普通收束', '1行动 · 扮演25');
  return out;
}
function projectAttempts(l: MisfortuneKnightLifeState, id: MisfortuneKnightCaseId): MisfortuneKnightLifeProjection['cases'][number]['attempts'] {
  const result: MisfortuneKnightLifeProjection['cases'][number]['attempts'] = []; let current: typeof result[number] | null = null;
  for (const entry of l.journal) { if (entry.command.type === 'INVITE' && entry.command.caseId === id) { current = { invitedWeek: entry.week, method: entry.command.method, outcome: null, operationOutcome: null, receipts: [] }; result.push(current); }
    if (!current) continue; current.receipts.push(structuredClone(entry));
    if (entry.command.type === 'GUIDED_MISHAP' || entry.command.type === 'BOUNDED_NIGHT_GUARD') current.outcome = entry.outcome;
    if (entry.command.type === 'CATCH_PARCEL') current.operationOutcome = entry.outcome;
    if (entry.command.type === 'RETURN_HOME' || entry.command.type === 'ABORT') current = null;
  } return result;
}
export function projectMisfortuneKnightLife(s: SliceState): MisfortuneKnightLifeProjection {
  const l = s.misfortuneKnight.life, actions = misfortuneKnightLifeActions(s), r = l.practice.activeCase ? l.cases[l.practice.activeCase] : null;
  return { title: '原屋中的有限帮助与普通返程', source: '同一38岁艾琳、原6米房间、原盒原纸与无生命弱标记。44岁米洛的工具另有唯一来源。封存旧叶保持原账，不制造灵体或恢复死者。', environment: MISFORTUNE_KNIGHT_LIFE_ENVIRONMENT,
    insideCase: hasMisfortuneKnightLifeLock(s), reflected: l.reflected, preferredActionId: actions.find(a => a.enabled && a.preferredAction)?.id ?? actions.find(a => a.enabled)?.id ?? null,
    practice: structuredClone(l.practice), originals: getMisfortuneKnightOriginals(s), currentConsents: [{ id: 'CS2-ERIN', consented: r?.permission.owner === 'GRANTED' }, { id: 'MK1-MILO44', consented: r?.permission.technician === 'GRANTED' }, { id: 'PLAYER', consented: r?.permission.selfPower === 'GRANTED' }],
    cases: CASES.map(item => { const c = l.cases[item.id]; return { id: item.id, title: item.title, story: item.story, observations: c.status === 'AVAILABLE' ? [] : [...item.facts], status: c.status, permission: structuredClone(c.permission), contactOpen: c.contactOpen,
      preparation: c.status === 'OBSERVED' ? '本案仍须付费邀请并分别取得当前许可。' : c.status === 'PAUSED' ? '原失败与成本保留，下一真实周可付费普通续办，最多三次。' : null,
      result: c.result !== 'NONE' ? `${c.result === 'ABILITY' ? '有限帮助已实际应用于原物。' : '已按普通方式真实收束。'}${c.returned ? '原物已还，本人已实际返程。' : '仍须归还原物工具并步行离开。'}` : c.guidedEnd === 'PENDING' || c.guardEnd === 'PENDING' ? '有限窗口仍待真正的下一次动作，此刻没有掌握奖励。' : c.guidedAttempted || c.guardAttempted ? '原施术结果和真实代价已保留，普通收束仍可继续。' : null,
      returned: c.returned, attempts: projectAttempts(l, item.id) }; }), ledger: structuredClone(l.journal) };
}
export const misfortuneKnightLifeRows = projectMisfortuneKnightLife;
