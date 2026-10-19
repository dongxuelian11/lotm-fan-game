import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { addGameWeeks, isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import type { WriterAction } from './types.js';
import { hasDreamWeaverLifeLock } from '../dream-weaver/life.js';
import { hasManipulatorRitualLock } from '../manipulator/ritual.js';
import { manipulatorInside } from '../manipulator/life.js';

export const WRITER_CASE_IDS = ['mutual-clue', 'scheduled-return', 'withdrawn-request'] as const;
export const WRITER_PERSON_IDS = ['WR1-EVELYN', 'WR1-THOMAS'] as const;
export type WriterCaseId = typeof WRITER_CASE_IDS[number];
export type WriterPersonId = typeof WRITER_PERSON_IDS[number];
export type WriterNode = 'NEAR' | 'FAR';
export type WriterConsent = 'UNKNOWN' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
type Method = 'ABILITY' | 'ORDINARY';
type Result = 'NONE' | Method;
export type WriterActivityCommand =
  | { type: 'OBSERVE' | 'REPORT'; caseId: WriterCaseId }
  | { type: 'INVITE'; caseId: WriterCaseId; method: Method }
  | { type: 'MOVE'; to: WriterNode }
  | { type: 'REVOKE_CONSENT'; permission: 'ABILITY' | 'MATERIAL' }
  | { type: 'ENTER_ROOM' | 'INTRODUCE' | 'TAKE_BOOK' | 'CHECK_BOOK' | 'HAND_TO_THOMAS' | 'MUTUAL_INSIGHT' | 'ARRANGE_RETURN' | 'WAIT_ARRANGEMENT' | 'CANCEL_ARRANGEMENT' | 'CLOSE_DOOR' | 'OPEN_DOOR' | 'ORDINARY_RETURN' | 'RETURN_BOOK' | 'RETURN_HOME' | 'ABORT' | 'REFLECT' };
export interface WriterLifeBudget { health: number; mind: number; spirituality: number; cash: number; actions: number }
export interface WriterLifeReceipt {
  week: number; date: PublicGameDate; revision: number;
  randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null;
  command: WriterActivityCommand; outcome: PublicResolutionTier | null;
  before: WriterLifeBudget; after: WriterLifeBudget; elapsedSeconds: number;
  ownerWalkedMetres: number; bookTravelMetres: number; participantWalks: { id: WriterPersonId; metres: number }[];
}
export interface WriterPublicLifeReceipt {
  week: number; date: PublicGameDate; revision: number;
  checkBase: number | null; check: PublicCheckResult | null;
  command: WriterActivityCommand; outcome: PublicResolutionTier | null;
  before: WriterLifeBudget; after: WriterLifeBudget; elapsedSeconds: number;
  ownerWalkedMetres: number; bookTravelMetres: number; participantWalks: { id: WriterPersonId; metres: number }[];
}
export interface WriterLifeCase {
  status: 'AVAILABLE' | 'OBSERVED' | 'ACTIVE' | 'PAUSED' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; invitedWeek: number | null; invitationWeeks: number[]; method: Method | null;
  permission: { ability: WriterConsent; material: WriterConsent }; permissionRevision: number;
  entered: boolean; contactOpen: boolean; introduced: boolean; bookChecked: boolean; bookHandled: boolean;
  abilityAttempted: boolean; abilityApplied: boolean; outcome: PublicResolutionTier | null;
  arrangementEnd: 'NONE' | 'PENDING' | 'FAILED' | 'EXECUTED' | 'CANCELLED' | 'WITHDRAWN' | 'INVALIDATED';
  thomasWantsReturn: boolean; result: Result; returned: boolean;
}
export interface WriterSourceRecord {
  id: 'WR1-INTRO-RECORD'; ownerName: string; reportId: 'discerner-case:present-mark'; reportDigest: string; reportWeek: number;
}
export interface WriterLifePractice {
  sceneId: 'WR1-READING-ROOM'; activeCase: WriterCaseId | null; ownerNode: WriterNode;
  elapsedSeconds: number; ownerWalkedMetres: number;
  participants: { id: WriterPersonId; name: string; age: number; present: boolean; node: WriterNode; walkedMetres: number }[];
  book: { id: 'WR1-RETURN-BOOK'; ownerId: 'WR1-EVELYN'; holder: 'SHELF' | 'OWNER' | 'WR1-THOMAS'; node: WriterNode };
  door: { id: 'WR1-DOOR'; open: boolean; revision: number };
  bell: { id: 'WR1-BELL'; ready: boolean; rings: number };
  record: { id: 'WR1-INTRO-RECORD'; holder: 'OWNER'; node: WriterNode; reportId: string | null; reportDigest: string | null };
  invitation: { id: 'WR1-INVITATION'; entries: { caseId: WriterCaseId; week: number; method: Method; permission: WriterLifeCase['permission'] }[] };
  introduction: { name: string; reportId: string; reportDigest: string; shownAt: number } | null;
  knownClues: { source: 'RECIPROCAL_INSIGHT' | 'PHYSICAL_ORIGINAL'; text: string; caseId: WriterCaseId }[];
  pendingArrangement: { caseId: WriterCaseId; createdAt: number; executeAt: number; doorRevision: number; permissionRevision: number } | null;
  abilityUses: Record<'audience.s1.reciprocal-insight' | 'audience.s1.plausible-arrangement', { attempts: number; successes: number; applied: number }>;
}
export interface WriterLifeState {
  sourceRecord: WriterSourceRecord | null; sourceWeek: number | null;
  practice: WriterLifePractice; cases: Record<WriterCaseId, WriterLifeCase>; reflected: boolean; journal: WriterLifeReceipt[];
}
export interface WriterLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean; preferredActionId: string | null;
  practice: WriterLifePractice;
  cases: { id: WriterCaseId; title: string; story: string; observations: string[]; status: string; contactOpen: boolean;
    permission: WriterLifeCase['permission']; preparation: string | null; result: string | null; returned: boolean;
    attempts: { invitedWeek: number; method: Method; outcome: PublicResolutionTier | null;
      evidence: { abilityAttempted: boolean; abilityApplied: boolean; returned: boolean; aborted: boolean; permission: WriterLifeCase['permission']; result: Result };
      receipts: WriterPublicLifeReceipt[] }[] }[];
  ledger: WriterPublicLifeReceipt[];
}
const ABILITIES = ['audience.s1.reciprocal-insight', 'audience.s1.plausible-arrangement'] as const;
const SHELFMARK = '东架第三层，蓝色书脊旁的七号位。';
const CASES = [
  { id: 'mutual-clue', title: '互知线索：先让对方真正认识你', story: '伊芙琳·赛尔，36岁，保管着自己的旧书。她知道书架标记，却还不认识你。托马斯·里德，42岁，在入口桌边等待。', facts: ['先当面报出自己的真实姓名，并出示已经完成的洞察者报告原件；她只因此知道你实际介绍的这两件事。', '互知线索需要当前同意与六米内的当面接触，实付6灵性、2精神，意志18。一次尝试只可能得到她本来就知道的书架标记。', '可不用能力：取得同意后亲取同一本书，走回近桌读标签，再走返归还。'] },
  { id: 'scheduled-return', title: '合理安排：让一件已经可能的事在稍后发生', story: '托马斯本来就打算把借看的这本书还给伊芙琳。入口桌与书架相距六米，原门可以打开，原铃就在书架旁。必须先把同一本书交到他手里。', facts: ['只安排托马斯在接下来30秒内沿原路走到书架、摇响原铃并交还这本书。实付8灵性、3精神，意志20；成功检定尚不等于事件完成。', '须明确等待，届时仍要有归还意愿、当前许可、同一本书、畅通原门和可用原铃。关门再开也改变了原条件；撤回许可会立即取消尚未发生的安排。', '失败或取消不会退款，也不能再抽一次。可以开门后让托马斯亲自走过去普通归还。已经发生的交还不可改写。'] },
  { id: 'withdrawn-request', title: '撤回请求：照常归还，尊重一句停止', story: '两位成年人重新接受这次邀约。走到书架后，伊芙琳明确撤回超凡作用许可，托马斯也同意仅按普通方式还书。', facts: ['这次撤回立即生效，旧案同意和先前能力成功都不能覆盖它。原书交接与普通归还仍获单独许可。', '亲手取书、沿原通道走到入口桌、交给托马斯，再由他实际走六米交还。', '撤回和普通完成不增加新能力掌握；原物、已付成本与每个人的实际位置都保留。'] },
] as const;
export const WRITER_LIFE_ENVIRONMENT = '同一间阅览室，两位独立成年人，一本原书、一扇门、一只铃和两份原记录。近桌与远架之间的普通通道长6米，每次步行实耗6秒。观察1行动，邀请1行动20便士，报告1行动；每案25扮演，三案反思再25。仅相关能力实际成功且报告后增加8掌握。暂停后最多两次付费普通续办，须在下一真实周重新邀请；没有退款、重抽或恢复原物的捷径。';
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const same = (a: unknown, b: unknown): boolean => { try { return stableStringify(a) === stableStringify(b); } catch { return false; } };
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const successful = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 1;
const budget = (s: SliceState): WriterLifeBudget => ({ health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining });
const freshCase = (): WriterLifeCase => ({ status: 'AVAILABLE', observedWeek: null, invitedWeek: null, invitationWeeks: [], method: null,
  permission: { ability: 'UNKNOWN', material: 'UNKNOWN' }, permissionRevision: 0, entered: false, contactOpen: false, introduced: false, bookChecked: false, bookHandled: false,
  abilityAttempted: false, abilityApplied: false, outcome: null, arrangementEnd: 'NONE', thomasWantsReturn: false, result: 'NONE', returned: false });
function freshPractice(source: WriterSourceRecord | null = null): WriterLifePractice {
  return { sceneId: 'WR1-READING-ROOM', activeCase: null, ownerNode: 'NEAR', elapsedSeconds: 0, ownerWalkedMetres: 0,
    participants: [{ id: 'WR1-EVELYN', name: '伊芙琳·赛尔', age: 36, present: false, node: 'NEAR', walkedMetres: 0 }, { id: 'WR1-THOMAS', name: '托马斯·里德', age: 42, present: false, node: 'NEAR', walkedMetres: 0 }],
    book: { id: 'WR1-RETURN-BOOK', ownerId: 'WR1-EVELYN', holder: 'SHELF', node: 'FAR' }, door: { id: 'WR1-DOOR', open: true, revision: 0 }, bell: { id: 'WR1-BELL', ready: true, rings: 0 },
    record: { id: 'WR1-INTRO-RECORD', holder: 'OWNER', node: 'NEAR', reportId: source?.reportId ?? null, reportDigest: source?.reportDigest ?? null },
    invitation: { id: 'WR1-INVITATION', entries: [] }, introduction: null, knownClues: [], pendingArrangement: null,
    abilityUses: { 'audience.s1.reciprocal-insight': { attempts: 0, successes: 0, applied: 0 }, 'audience.s1.plausible-arrangement': { attempts: 0, successes: 0, applied: 0 } } };
}
const freshCases = (): Record<WriterCaseId, WriterLifeCase> => ({ 'mutual-clue': freshCase(), 'scheduled-return': freshCase(), 'withdrawn-request': freshCase() });
export function createWriterLifeState(): WriterLifeState { return { sourceRecord: null, sourceWeek: null, practice: freshPractice(), cases: freshCases(), reflected: false, journal: [] }; }
function sourceRecord(s: SliceState): WriterSourceRecord | null {
  const prior = s.discerner?.life?.cases?.['present-mark'];
  if (!prior || prior.status !== 'RESOLVED' || !s.seer.completedSources.includes('discerner-case:present-mark') || !prior.attempts.length) return null;
  return { id: 'WR1-INTRO-RECORD', ownerName: s.character.name, reportId: 'discerner-case:present-mark', reportDigest: sha256Hex(stableStringify(prior)), reportWeek: prior.attempts.at(-1)!.week };
}
export function initializeWriterLife(s: SliceState): void {
  const l = s.writer.life, source = sourceRecord(s);
  if (!active(s) || !source || !same(l, createWriterLifeState())) throw new Error('须实际晋升，并保留本人已经完成的洞察者原报告。');
  l.sourceRecord = source; l.sourceWeek = s.week; l.practice = freshPractice(source);
}
export function validateWriterActivityCommand(v: unknown): v is WriterActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'OBSERVE' || v.type === 'REPORT') return shape(v, ['type', 'caseId']) && WRITER_CASE_IDS.includes(v.caseId as WriterCaseId);
  if (v.type === 'INVITE') return shape(v, ['type', 'caseId', 'method']) && WRITER_CASE_IDS.includes(v.caseId as WriterCaseId) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'MOVE') return shape(v, ['type', 'to']) && ['NEAR', 'FAR'].includes(String(v.to));
  if (v.type === 'REVOKE_CONSENT') return shape(v, ['type', 'permission']) && ['ABILITY', 'MATERIAL'].includes(String(v.permission));
  return shape(v, ['type']) && ['ENTER_ROOM', 'INTRODUCE', 'TAKE_BOOK', 'CHECK_BOOK', 'HAND_TO_THOMAS', 'MUTUAL_INSIGHT', 'ARRANGE_RETURN', 'WAIT_ARRANGEMENT', 'CANCEL_ARRANGEMENT', 'CLOSE_DOOR', 'OPEN_DOOR', 'ORDINARY_RETURN', 'RETURN_BOOK', 'RETURN_HOME', 'ABORT', 'REFLECT'].includes(String(v.type));
}
export const hasWriterLifeLock = (s: SliceState): boolean => !!s.writer?.life && (s.writer.life.practice.activeCase !== null || s.writer.life.practice.participants.some(p => p.present) || s.writer.life.practice.book.holder !== 'SHELF' || s.writer.life.practice.pendingArrangement !== null);
export const writerInside = hasWriterLifeLock;
interface ReplayModel { source: WriterSourceRecord; practice: WriterLifePractice; cases: Record<WriterCaseId, WriterLifeCase>; reflected: boolean }
interface Audit { date: PublicGameDate; revision: number; randomCursor: number; randomBefore: number | null; randomAfter: number | null; checkBase: number | null; check: PublicCheckResult | null }
const isPower = (c: WriterActivityCommand) => c.type === 'MUTUAL_INSIGHT' || c.type === 'ARRANGE_RETURN';
const audit = (s: SliceState, power = false): Audit => ({ date: structuredClone(s.date), revision: s.revision, randomCursor: s.random.cursor, randomBefore: power ? s.random.cursor : null, randomAfter: power ? s.random.cursor + 1 : null, checkBase: power ? s.character.coreStats.will : null, check: null });
const validBudget = (v: unknown): v is WriterLifeBudget => record(v) && shape(v, ['health', 'mind', 'spirituality', 'cash', 'actions']) && integer(v.health, 1, 100) && integer(v.mind, 1, 100) && integer(v.spirituality, 0, 120) && integer(v.cash, 0) && integer(v.actions, 0, 10000);
/** The same transition validates commands and reconstructs every position, permission, object and paid receipt. */
function transition(input: ReplayModel, c: WriterActivityCommand, week: number, outcome: PublicResolutionTier | null, before: WriterLifeBudget, clock: Audit): { model: ReplayModel; receipt: WriterLifeReceipt } | null {
  if (!validateWriterActivityCommand(c) || !validBudget(before) || !integer(week) || (isPower(c) ? !['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(outcome)) : outcome !== null)) return null;
  const m = structuredClone(input), p = m.practice, id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? m.cases[id] : null;
  const evelyn = p.participants[0]!, thomas = p.participants[1]!;
  const receipt: WriterLifeReceipt = { week, ...structuredClone(clock), command: structuredClone(c), outcome, before: structuredClone(before), after: structuredClone(before), elapsedSeconds: 0, ownerWalkedMetres: 0, bookTravelMetres: 0, participantWalks: WRITER_PERSON_IDS.map(personId => ({ id: personId, metres: 0 })) };
  const pay = (ap: number, cash = 0, spirit = 0, mind = 0) => { receipt.after.actions -= ap; receipt.after.cash -= cash; receipt.after.spirituality -= spirit; receipt.after.mind -= mind; };
  const ownerMove = (to: WriterNode) => { if (p.ownerNode === to) return; p.ownerNode = to; p.record.node = to; receipt.ownerWalkedMetres += 6; receipt.elapsedSeconds += 6; if (p.book.holder === 'OWNER') { p.book.node = to; receipt.bookTravelMetres += 6; } };
  const personMove = (index: number, to: WriterNode) => { const person = p.participants[index]!; if (person.node === to) return; person.node = to; receipt.participantWalks[index]!.metres += 6; receipt.elapsedSeconds += 6; if (person.id === 'WR1-THOMAS' && p.book.holder === person.id) { p.book.node = to; receipt.bookTravelMetres += 6; } };
  const cancel = (end: WriterLifeCase['arrangementEnd']) => { if (p.pendingArrangement) { m.cases[p.pendingArrangement.caseId].arrangementEnd = end; p.pendingArrangement = null; } };
  const scene = p.activeCase !== null;
  const physical = scene && !!r && r.status === 'ACTIVE' && r.invitedWeek === week && evelyn.present && thomas.present;
  if (scene && (!physical || 'caseId' in c && c.caseId !== p.activeCase)) return null;
  const entered = physical && r!.entered;
  const material = entered && r!.permission.material === 'GRANTED';
  const restoreBook = () => { if (p.book.holder === 'OWNER') ownerMove('FAR'); else if (p.book.holder === 'WR1-THOMAS') personMove(1, 'FAR'); if (p.book.holder !== 'SHELF') { p.book.holder = 'SHELF'; p.book.node = 'FAR'; receipt.elapsedSeconds++; } };
  const leave = () => {
    ownerMove('NEAR'); personMove(0, 'NEAR'); personMove(1, 'NEAR');
    for (let i = 0; i < p.participants.length; i++) { p.participants[i]!.present = false; receipt.participantWalks[i]!.metres++; }
    receipt.elapsedSeconds++; r!.contactOpen = false; r!.returned = true; p.activeCase = null;
  };
  switch (c.type) {
    case 'OBSERVE': {
      const index = WRITER_CASE_IDS.indexOf(c.caseId);
      if (scene || r!.status !== 'AVAILABLE' || index > 0 && m.cases[WRITER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return null;
      pay(1); r!.status = 'OBSERVED'; r!.observedWeek = week; receipt.elapsedSeconds = 5; break;
    }
    case 'INVITE':
      if (scene || !['OBSERVED', 'PAUSED'].includes(r!.status) || r!.invitationWeeks.length >= 3 || r!.status === 'PAUSED' && (c.method !== 'ORDINARY' || week <= r!.invitedWeek!) || p.book.holder !== 'SHELF' || p.ownerNode !== 'NEAR' || p.participants.some(person => person.present)) return null;
      pay(1, 20); r!.status = 'ACTIVE'; r!.invitedWeek = week; r!.invitationWeeks.push(week); r!.method = c.method; r!.entered = false; r!.returned = false; r!.contactOpen = false; r!.bookHandled = false;
      r!.permission = { ability: r!.permission.ability === 'WITHDRAWN' ? 'WITHDRAWN' : c.method === 'ABILITY' || id === 'withdrawn-request' ? 'GRANTED' : 'DECLINED', material: 'GRANTED' }; r!.permissionRevision++;
      // The spoken request records Thomas's prior motive before any arrangement can exist.
      r!.thomasWantsReturn = id !== 'mutual-clue'; p.activeCase = c.caseId;
      for (let i = 0; i < p.participants.length; i++) { p.participants[i]!.present = true; receipt.participantWalks[i]!.metres++; }
      p.invitation.entries.push({ caseId: c.caseId, week, method: c.method, permission: structuredClone(r!.permission) }); receipt.elapsedSeconds = 5; break;
    case 'ENTER_ROOM':
      if (!physical || r!.entered || p.ownerNode !== 'NEAR' || !p.door.open) return null;
      ownerMove('FAR'); personMove(0, 'FAR'); r!.entered = true; r!.contactOpen = true;
      if (id === 'withdrawn-request') { r!.permission.ability = 'WITHDRAWN'; r!.permissionRevision++; }
      break;
    case 'INTRODUCE':
      if (!entered || id !== 'mutual-clue' || r!.introduced || !r!.contactOpen || p.ownerNode !== 'FAR' || evelyn.node !== 'FAR' || p.record.node !== 'FAR') return null;
      r!.introduced = true; receipt.elapsedSeconds = 3; p.introduction = { name: m.source.ownerName, reportId: m.source.reportId, reportDigest: m.source.reportDigest, shownAt: p.elapsedSeconds + 3 }; break;
    case 'MOVE':
      if (!entered || c.to === p.ownerNode || !p.door.open) return null;
      ownerMove(c.to); break;
    case 'TAKE_BOOK':
      if (!material || r!.bookHandled || p.ownerNode !== 'FAR' || evelyn.node !== 'FAR' || p.book.holder !== 'SHELF' || p.book.node !== 'FAR') return null;
      p.book.holder = 'OWNER'; r!.bookHandled = true; receipt.elapsedSeconds = 1; break;
    case 'CHECK_BOOK':
      if (!material || id !== 'mutual-clue' || r!.bookChecked || p.ownerNode !== 'NEAR' || p.book.holder !== 'OWNER' || p.book.node !== 'NEAR') return null;
      r!.bookChecked = true; p.knownClues.push({ source: 'PHYSICAL_ORIGINAL', text: SHELFMARK, caseId: id }); receipt.elapsedSeconds = 2; break;
    case 'RETURN_BOOK':
      if (!entered || p.ownerNode !== 'FAR' || p.book.holder !== 'OWNER' || p.book.node !== 'FAR' || evelyn.node !== 'FAR') return null;
      // Returning an already held original never needs renewed permission to inspect it.
      p.book.holder = 'SHELF'; p.book.node = 'FAR'; receipt.elapsedSeconds = 1;
      if (id === 'mutual-clue' && r!.bookChecked) r!.result = r!.abilityApplied ? 'ABILITY' : 'ORDINARY';
      break;
    case 'HAND_TO_THOMAS':
      if (!material || id === 'mutual-clue' || !r!.thomasWantsReturn || p.ownerNode !== 'NEAR' || thomas.node !== 'NEAR' || p.book.holder !== 'OWNER' || p.book.node !== 'NEAR') return null;
      p.book.holder = 'WR1-THOMAS'; receipt.elapsedSeconds = 1; break;
    case 'MUTUAL_INSIGHT': {
      if (!entered || id !== 'mutual-clue' || r!.method !== 'ABILITY' || r!.permission.ability !== 'GRANTED' || !r!.contactOpen || !r!.introduced || !p.introduction || r!.abilityAttempted || r!.bookChecked || r!.result !== 'NONE' || !p.door.open || !evelyn.present || Math.abs((p.ownerNode === 'FAR' ? 6 : 0) - (evelyn.node === 'FAR' ? 6 : 0)) > 6) return null;
      pay(0, 0, 6, 2); receipt.elapsedSeconds = 2; r!.abilityAttempted = true; r!.outcome = outcome; r!.abilityApplied = successful(outcome);
      const use = p.abilityUses[ABILITIES[0]]; use.attempts++; if (r!.abilityApplied) { use.successes++; use.applied++; p.knownClues.push({ source: 'RECIPROCAL_INSIGHT', text: SHELFMARK, caseId: id }); }
      break;
    }
    case 'ARRANGE_RETURN': {
      if (!material || id !== 'scheduled-return' || r!.method !== 'ABILITY' || r!.permission.ability !== 'GRANTED' || r!.abilityAttempted || r!.result !== 'NONE' || p.pendingArrangement || !r!.thomasWantsReturn || p.book.holder !== 'WR1-THOMAS' || p.book.node !== 'NEAR' || thomas.node !== 'NEAR' || p.ownerNode !== 'NEAR' || evelyn.node !== 'FAR' || !p.door.open || !p.bell.ready) return null;
      pay(0, 0, 8, 3); receipt.elapsedSeconds = 2; r!.abilityAttempted = true; r!.outcome = outcome;
      const use = p.abilityUses[ABILITIES[1]]; use.attempts++;
      if (successful(outcome)) { use.successes++; r!.arrangementEnd = 'PENDING'; const now = p.elapsedSeconds + 2; p.pendingArrangement = { caseId: id, createdAt: now, executeAt: now + 30, doorRevision: p.door.revision, permissionRevision: r!.permissionRevision }; }
      else r!.arrangementEnd = 'FAILED';
      break;
    }
    case 'WAIT_ARRANGEMENT': {
      const pending = p.pendingArrangement;
      if (!entered || id !== 'scheduled-return' || !pending || pending.caseId !== id || pending.executeAt <= p.elapsedSeconds) return null;
      const remaining = pending.executeAt - p.elapsedSeconds;
      const valid = r!.permission.ability === 'GRANTED' && r!.permission.material === 'GRANTED' && pending.permissionRevision === r!.permissionRevision && p.door.open && pending.doorRevision === p.door.revision && p.bell.ready && r!.thomasWantsReturn && p.book.holder === 'WR1-THOMAS' && p.book.node === 'NEAR' && thomas.node === 'NEAR' && evelyn.node === 'FAR' && remaining >= 8;
      if (valid) { personMove(1, 'FAR'); p.bell.rings++; p.book.holder = 'SHELF'; p.book.node = 'FAR'; r!.abilityApplied = true; r!.result = 'ABILITY'; r!.arrangementEnd = 'EXECUTED'; p.abilityUses[ABILITIES[1]].applied++; }
      else r!.arrangementEnd = 'INVALIDATED';
      receipt.elapsedSeconds = remaining; p.pendingArrangement = null; break;
    }
    case 'CANCEL_ARRANGEMENT':
      if (!entered || !p.pendingArrangement) return null;
      cancel('CANCELLED'); break;
    case 'REVOKE_CONSENT': {
      const key = c.permission === 'ABILITY' ? 'ability' : 'material';
      if (!physical || r!.permission[key] !== 'GRANTED') return null;
      r!.permission[key] = 'WITHDRAWN'; r!.permissionRevision++; cancel('WITHDRAWN'); if (key === 'ability') r!.contactOpen = false; receipt.elapsedSeconds = 1; break;
    }
    case 'CLOSE_DOOR':
    case 'OPEN_DOOR':
      if (!entered || p.ownerNode !== 'NEAR' || p.door.open === (c.type === 'OPEN_DOOR')) return null;
      p.door.open = c.type === 'OPEN_DOOR'; p.door.revision++; receipt.elapsedSeconds = 1; break;
    case 'ORDINARY_RETURN':
      if (!material || id === 'mutual-clue' || p.pendingArrangement || r!.result !== 'NONE' || !r!.thomasWantsReturn || p.book.holder !== 'WR1-THOMAS' || p.book.node !== 'NEAR' || thomas.node !== 'NEAR' || evelyn.node !== 'FAR' || !p.door.open || !p.bell.ready) return null;
      personMove(1, 'FAR'); p.bell.rings++; p.book.holder = 'SHELF'; p.book.node = 'FAR'; receipt.elapsedSeconds += 2; r!.result = 'ORDINARY'; break;
    case 'RETURN_HOME':
      if (!entered || r!.result === 'NONE' || p.pendingArrangement || p.book.holder !== 'SHELF' || p.ownerNode !== 'NEAR' || !p.door.open) return null;
      leave(); r!.status = 'EXAMINED'; break;
    case 'ABORT':
      if (!physical) return null;
      cancel('CANCELLED');
      // This command performs, and receipts, each real return movement. It is not a scene reset.
      if (!p.door.open) { p.door.open = true; p.door.revision++; receipt.elapsedSeconds++; }
      restoreBook();
      if (id === 'mutual-clue' && r!.bookChecked) r!.result = r!.abilityApplied ? 'ABILITY' : 'ORDINARY';
      leave(); r!.status = r!.result === 'NONE' ? 'PAUSED' : 'EXAMINED'; break;
    case 'REPORT':
      if (scene || r!.status !== 'EXAMINED' || !r!.returned || r!.result === 'NONE' || p.participants.some(person => person.present) || p.book.holder !== 'SHELF') return null;
      pay(1); r!.status = 'RESOLVED'; receipt.elapsedSeconds = 5; break;
    case 'REFLECT':
      if (scene || m.reflected || !WRITER_CASE_IDS.every(caseId => m.cases[caseId].status === 'RESOLVED') || p.participants.some(person => person.present)) return null;
      pay(1); m.reflected = true; receipt.elapsedSeconds = 5; break;
  }
  if (!validBudget(receipt.after)) return null;
  p.elapsedSeconds += receipt.elapsedSeconds; p.ownerWalkedMetres += receipt.ownerWalkedMetres;
  for (let i = 0; i < p.participants.length; i++) p.participants[i]!.walkedMetres += receipt.participantWalks[i]!.metres;
  // Only an explicit wait can execute the proposed event. Time spent doing something else may expire it.
  if (p.pendingArrangement && p.elapsedSeconds >= p.pendingArrangement.executeAt) cancel('INVALIDATED');
  return { model: m, receipt };
}
const dateMatches = (from: PublicGameDate, weeks: number, to: PublicGameDate): boolean => { try { return same(addGameWeeks(from, weeks), to); } catch { return false; } };
function replayLife(l: WriterLifeState, s: SliceState): ReplayModel | null {
  if (!l.sourceRecord || l.sourceWeek === null || !Array.isArray(l.journal)) return null;
  let model: ReplayModel = { source: structuredClone(l.sourceRecord), practice: freshPractice(l.sourceRecord), cases: freshCases(), reflected: false };
  let lastRandomAfter = 0, lastWeek = l.sourceWeek; let previous: WriterLifeReceipt | null = null;
  for (const entry of l.journal) {
    if (!record(entry) || !shape(entry, ['week', 'date', 'revision', 'randomCursor', 'randomBefore', 'randomAfter', 'checkBase', 'check', 'command', 'outcome', 'before', 'after', 'elapsedSeconds', 'ownerWalkedMetres', 'bookTravelMetres', 'participantWalks']) || !validateWriterActivityCommand(entry.command) || !integer(entry.week, lastWeek, s.week) || !integer(entry.revision, previous ? previous.revision + 1 : 0, s.revision) || !integer(entry.randomCursor, lastRandomAfter, s.random.cursor) || !isValidGameDate(entry.date) || !dateMatches(entry.date, s.week - entry.week, s.date)) return null;
    if (model.practice.activeCase !== null && (entry.week !== lastWeek || !previous || entry.revision !== previous.revision + 1 || !same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    if (isPower(entry.command)) {
      if (!integer(entry.checkBase, 0, 500) || !record(entry.check) || entry.randomBefore !== entry.randomCursor || !integer(entry.randomBefore, lastRandomAfter, s.random.cursor) || entry.randomAfter !== entry.randomBefore + 1 || entry.randomAfter > s.random.cursor) return null;
      const random = new DeterministicActionRandomStream(s.random.seed, entry.randomBefore);
      const expected = resolveNormalCheck({ ability: 'will', baseAbility: entry.checkBase, difficulty: entry.command.type === 'MUTUAL_INSIGHT' ? 18 : 20, modifiers: [], roll: random.nextInt(1, 100) });
      if (!same(entry.check, expected) || entry.outcome !== expected.tier) return null;
      lastRandomAfter = entry.randomAfter;
    } else if (entry.randomBefore !== null || entry.randomAfter !== null || entry.checkBase !== null || entry.check !== null) return null;
    if (previous && entry.revision === previous.revision + 1 && entry.week === previous.week && (!same(entry.before, previous.after) || entry.randomCursor !== (previous.randomAfter ?? previous.randomCursor))) return null;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, { date: entry.date, revision: entry.revision, randomCursor: entry.randomCursor, randomBefore: entry.randomBefore, randomAfter: entry.randomAfter, checkBase: entry.checkBase, check: entry.check });
    if (!next || !same(next.receipt, entry)) return null;
    model = next.model; previous = entry; lastWeek = entry.week; lastRandomAfter = entry.randomAfter ?? entry.randomCursor;
  }
  return model;
}
function oldSceneOpen(s: SliceState): boolean {
  return s.discerner.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.discerner.encounter.status) || Object.values(s.discerner.life.cases).some(c => c.status === 'PREPARED' || c.status === 'ACTIVE') ||
    hasDreamWeaverLifeLock(s) || s.dreamWeaver.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.dreamWeaver.encounter.status) ||
    hasManipulatorRitualLock(s) || manipulatorInside(s) || ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status);
}
export function validateWriterLife(s: SliceState): boolean {
  try {
    const l = s.writer?.life;
    if (!record(l) || !shape(l, ['sourceRecord', 'sourceWeek', 'practice', 'cases', 'reflected', 'journal']) || !Array.isArray(l.journal) || !record(l.practice) || !record(l.cases) || !shape(l.cases, WRITER_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.writer.promotionWeek === null) return same(l, createWriterLifeState());
    if (!integer(l.sourceWeek, 0, s.week) || l.sourceWeek !== s.writer.promotionWeek || !same(l.sourceRecord, sourceRecord(s)) || !l.sourceRecord) return false;
    const replay = replayLife(l, s);
    if (!replay || !same(l.practice, replay.practice) || !same(l.cases, replay.cases) || l.reflected !== replay.reflected) return false;
    let acting = l.reflected ? 25 : 0;
    for (const id of WRITER_CASE_IDS) {
      const r = l.cases[id], resolved = r.status === 'RESOLVED';
      if (s.seer.completedSources.filter(source => source === `writer-case:${id}`).length !== (resolved ? 1 : 0)) return false;
      if (resolved) acting += 25;
      if (resolved && r.abilityApplied && r.result === 'ABILITY' && id !== 'withdrawn-request' && (s.progression.mastery[id === 'mutual-clue' ? ABILITIES[0] : ABILITIES[1]] ?? 0) < 8) return false;
    }
    if (s.seer.completedSources.filter(source => source === 'writer-reflection').length !== (l.reflected ? 1 : 0) || active(s) && s.progression.acting < acting) return false;
    const last = l.journal.at(-1);
    if (hasWriterLifeLock(s) && (!active(s) || s.status !== 'ACTIVE' || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || oldSceneOpen(s) || s.writer.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.writer.encounter.status) || !last || last.week !== s.week || !same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    if (last && last.revision === s.revision - 1 && last.week === s.week && (!same(budget(s), last.after) || s.random.cursor !== (last.randomAfter ?? last.randomCursor))) return false;
    return true;
  } catch { return false; }
}
export function blockWriterActivity(s: SliceState, c: WriterActivityCommand): string | null {
  if (!validateWriterActivityCommand(c)) return '生活实践命令无效。';
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着，并已经实际成为作家。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际回到贝克兰德阅览室。';
  if (oldSceneOpen(s) || s.writer.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.writer.encounter.status)) return '先收束仍开放的现场、晋升准备或遭遇。';
  if (!validateWriterLife(s)) return '原人、原物、实际收支或历史记录不一致。';
  if (!transition(replayLife(s.writer.life, s)!, c, s.week, isPower(c) ? 'SUCCESS' : null, budget(s), audit(s, isPower(c)))) return '先完成当前实际步骤，确认这一次许可、原物位置及所需资源；已经付出的代价和结果不能重置。';
  return null;
}
const NOTES: Record<WriterActivityCommand['type'], [string, string]> = {
  OBSERVE: ['查看原书与六米普通通道', '已亲眼观察本案原物与退路。'],
  INVITE: ['两位成年人接受本次邀约', '实付1行动20便士。伊芙琳与托马斯分别走入入口，并在同一邀请记录上确认本案原书交接；超凡许可仅覆盖本次指定作用，仍可拒绝或撤回。'],
  ENTER_ROOM: ['实际走到远架', '本人携原报告走6米，伊芙琳也亲自走6米到原架；托马斯留在近桌。'],
  INTRODUCE: ['当面介绍并出示真实旧报告', '本人说出真实姓名，花3秒展示自己已经完成的洞察者原报告。伊芙琳由此知道这两项实际信息；没有把她的其他秘密当作已知。'],
  MOVE: ['沿原路实际步行', '本人走6米，实耗6秒；手中原书与原报告随身体一起移动。'],
  TAKE_BOOK: ['亲手接下同一本书', '伊芙琳按本案原书许可，从远架把唯一原书交给本人，实耗1秒。'],
  CHECK_BOOK: ['在近桌实读原书标签', '实耗2秒，亲眼看见同一本书的架位标签。普通来源可以核验线索，不会冒充能力成功。'],
  RETURN_BOOK: ['把同一本书亲交回原架', '本人已实际到远架，花1秒把手中原书交回伊芙琳，由她放回原架。归还之后本人仍须走回近桌。'],
  HAND_TO_THOMAS: ['把同一本书交给托马斯', '近桌两人当面交接原书，实耗1秒。托马斯此前已经明确愿意归还，并未被制造动机。'],
  MUTUAL_INSIGHT: ['尝试一次互知线索', '实付6灵性、2精神和2秒；只在当面介绍和当前许可之上，尝试得到伊芙琳原本知道的一个书架标记。'],
  ARRANGE_RETURN: ['安排一件尚未发生的归还', '实付8灵性、3精神和2秒。仅为托马斯已愿意做的同一次归还设置30秒机会；此刻没有移动人或书。'],
  WAIT_ARRANGEMENT: ['明确等待这一次归还机会', '实际等待剩余期限；只有原书、原门、原铃、意愿与许可全部保持有效，托马斯才会亲自走6米摇铃交还。'],
  CANCEL_ARRANGEMENT: ['取消尚未发生的安排', '本次未来安排立即结束，原人原书仍在实际位置；已付代价不会返还，不能重新尝试能力。'],
  REVOKE_CONSENT: ['撤回本案指定许可', '当事人明确撤回这一项当前许可。尚未发生的安排立即停止；此前实际完成的事实、成本与位置都保留。'],
  CLOSE_DOOR: ['合上同一扇门', '本人在近桌旁花1秒合上原门，改变后续通行条件。'],
  OPEN_DOOR: ['打开同一扇门', '本人在近桌旁花1秒重新打开原门。重新开放的路可供普通归还，但不会恢复失效的安排条件。'],
  ORDINARY_RETURN: ['托马斯沿原路普通归还', '托马斯携同一原书实际走6米，摇响原铃并交还伊芙琳，合计8秒。普通完成不会产生能力成功或新掌握。'],
  RETURN_HOME: ['两位成年人实际离开阅览室', '原书已经回到原架，本人已经走回近桌。两位成年人沿各自原路走回入口，再实际跨出门槛；无人留在后续遭遇中。'],
  ABORT: ['安全归还并结束本次现场', '取消仍未发生的安排，必要时打开原门。持书者实际走到远架交回同一本书，再由本人和两位成年人各自走回入口离开。保留所有已付代价、失败与已完成事实；未完案件只能跨周付费普通续办。'],
  REPORT: ['报告真实完成的一案', '实付1行动，扮演增加25。只有相关能力真正发生作用并完成普通核验或交还，才增加8掌握。'],
  REFLECT: ['反思互知、前因与可撤回的许可', '三案均已真实收束。实付1行动，扮演增加25；先认识一个人、承认已有前因，也尊重对方随时说停止。'],
};
export function applyWriterActivity(s: SliceState, c: WriterActivityCommand, ctx: SeerContext): void {
  const reason = blockWriterActivity(s, c); if (reason) throw new Error(reason);
  const l = s.writer.life, id = 'caseId' in c ? c.caseId : l.practice.activeCase, clock = audit(s, isPower(c));
  const check = isPower(c) ? ctx.check('will', c.type === 'MUTUAL_INSIGHT' ? 18 : 20) : null;
  clock.check = check; if (isPower(c)) clock.randomAfter = s.random.cursor;
  const next = transition(replayLife(l, s)!, c, s.week, check?.tier ?? null, budget(s), clock)!;
  s.health = next.receipt.after.health; s.mind = next.receipt.after.mind; s.spirituality = next.receipt.after.spirituality; s.cash = next.receipt.after.cash; s.actionsRemaining = next.receipt.after.actions;
  l.practice = next.model.practice; l.cases = next.model.cases; l.reflected = next.model.reflected; l.journal.push(next.receipt);
  if (c.type === 'REPORT') {
    const r = l.cases[c.caseId]; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`writer-case:${c.caseId}`);
    if (r.abilityApplied && r.result === 'ABILITY' && c.caseId !== 'withdrawn-request') { const ability = c.caseId === 'mutual-clue' ? ABILITIES[0] : ABILITIES[1]; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
  }
  if (c.type === 'REFLECT') { s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('writer-reflection'); }
  const note = NOTES[c.type]; let detail = note[1];
  if (c.type === 'OBSERVE') { const item = CASES.find(item => item.id === c.caseId)!; detail = item.story + item.facts.join(' '); }
  if (c.type === 'ENTER_ROOM' && id === 'withdrawn-request') detail += '伊芙琳此刻撤回超凡许可，托马斯同意仅普通办理；原书交接许可仍独立有效。';
  if (c.type === 'INTRODUCE') detail += `伊芙琳听见的姓名是${l.sourceRecord!.ownerName}。`;
  if (isPower(c)) detail += successful(check?.tier ?? null) ? c.type === 'MUTUAL_INSIGHT' ? `实际得到的有限线索：${SHELFMARK}` : '本次检定成功，但事情还没有发生，须明确等待并保持现实条件。' : '本次检定失败，成本已经支付；不能重试，可按原物许可普通完成。';
  if (c.type === 'WAIT_ARRANGEMENT') detail += l.cases['scheduled-return'].arrangementEnd === 'EXECUTED' ? '原书已经真实交还，托马斯仍站在远架。' : '条件已改变，这次安排没有执行；不能重试，仍可普通归还。';
  ctx.note(note[0], detail);
}
export function writerLifeActions(s: SliceState): WriterAction[] {
  if (!active(s)) return [];
  const out: WriterAction[] = [], l = s.writer.life, p = l.practice;
  const add = (command: WriterActivityCommand, label: string, cost: string, cleanup = false, preferredAction = false) => {
    const reason = blockWriterActivity(s, command);
    out.push({ id: `writer-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'to' in command ? '-' + command.to.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason, cleanup, preferredAction });
  };
  if (p.activeCase) {
    const id = p.activeCase, r = l.cases[id];
    if (!r.entered) add({ type: 'ENTER_ROOM' }, '与伊芙琳沿原路走到书架', '0行动 · 两人各走6米', false, true);
    else if (r.result !== 'NONE') {
      if (p.ownerNode === 'FAR') add({ type: 'MOVE', to: 'NEAR' }, '亲自走6米回近桌', '0行动 · 6秒', true, true);
      else add({ type: 'RETURN_HOME' }, '让两位成年人沿原路离开', '0行动 · 实际步行离场', true, true);
    } else if (p.pendingArrangement) {
      add({ type: 'WAIT_ARRANGEMENT' }, '等候这一次30秒归还机会', `0行动 · 余${Math.max(0, p.pendingArrangement.executeAt - p.elapsedSeconds)}秒`, false, true);
      add({ type: 'CANCEL_ARRANGEMENT' }, '取消尚未发生的安排', '0行动 · 不退款或重试', true);
      if (p.door.open) add({ type: 'CLOSE_DOOR' }, '合上原门，改变尚未发生的条件', '0行动 · 1秒');
      else add({ type: 'OPEN_DOOR' }, '重新打开原门', '0行动 · 1秒', true);
    } else if (id === 'mutual-clue') {
      if (r.method === 'ABILITY' && !r.abilityAttempted && r.permission.ability === 'GRANTED') {
        if (!r.introduced) add({ type: 'INTRODUCE' }, '当面报姓名并出示已完成的旧报告', '0行动 · 3秒', false, true);
        else add({ type: 'MUTUAL_INSIGHT' }, '尝试一次互知线索', '0行动 · 6灵性＋2精神 · 意志18', false, true);
      }
      if (p.book.holder === 'SHELF' && !r.bookHandled) add({ type: 'TAKE_BOOK' }, '按许可接下同一本书', '0行动 · 1秒', false, out.every(a => !a.enabled));
      else if (p.book.holder === 'OWNER' && !r.bookChecked) {
        if (p.ownerNode === 'FAR') add({ type: 'MOVE', to: 'NEAR' }, '携原书走6米到近桌', '0行动 · 6秒', true, true);
        else add({ type: 'CHECK_BOOK' }, '亲眼读原书标签', '0行动 · 2秒', false, true);
      } else if (p.book.holder === 'OWNER') {
        if (p.ownerNode === 'NEAR') add({ type: 'MOVE', to: 'FAR' }, '携原书走6米返回书架', '0行动 · 6秒', true, true);
        else add({ type: 'RETURN_BOOK' }, '把同一本书交回伊芙琳', '0行动 · 1秒', true, true);
      }
    } else if (p.book.holder === 'SHELF' && !r.bookHandled) add({ type: 'TAKE_BOOK' }, '从伊芙琳手中接下原书', '0行动 · 1秒', false, true);
    else if (p.book.holder === 'OWNER') {
      if (p.ownerNode === 'FAR') add({ type: 'MOVE', to: 'NEAR' }, '携原书走6米到近桌', '0行动 · 6秒', true, true);
      else add({ type: 'HAND_TO_THOMAS' }, '把原书亲交给托马斯', '0行动 · 1秒', false, true);
    } else if (p.book.holder === 'WR1-THOMAS') {
      if (!p.door.open) add({ type: 'OPEN_DOOR' }, '打开原门供普通归还', '0行动 · 1秒', true, true);
      if (id === 'scheduled-return' && r.method === 'ABILITY' && !r.abilityAttempted && r.permission.ability === 'GRANTED') add({ type: 'ARRANGE_RETURN' }, '为既有归还意愿安排30秒机会', '0行动 · 8灵性＋3精神 · 意志20', false, true);
      add({ type: 'ORDINARY_RETURN' }, '托马斯沿六米原路普通归还', '0行动 · 8秒', true, out.every(a => !a.enabled));
    }
    if (r.permission.ability === 'GRANTED') add({ type: 'REVOKE_CONSENT', permission: 'ABILITY' }, '当事人撤回本案超凡许可', '0行动 · 1秒 · 已完成事实保留', true);
    if (r.permission.material === 'GRANTED') add({ type: 'REVOKE_CONSENT', permission: 'MATERIAL' }, '物主撤回进一步交接与查阅许可', '0行动 · 1秒 · 仍可安全归还', true);
    add({ type: 'ABORT' }, '安全还原物、走返并中止本次现场', '0行动 · 实际还物离场 · 不退款', true);
    return out;
  }
  const next = CASES.find(item => l.cases[item.id].status !== 'RESOLVED');
  if (next) {
    const r = l.cases[next.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: next.id }, `观察：${next.title}`, '1行动', false, true);
    if (r.status === 'OBSERVED' || r.status === 'PAUSED') {
      if (r.status !== 'PAUSED') add({ type: 'INVITE', caseId: next.id, method: 'ABILITY' }, next.id === 'withdrawn-request' ? '邀请两人，并听取这一次的许可' : '邀请两人，说明本次有限能力与普通退路', '1行动 · 20便士 · 许可可随时撤回', false, true);
      add({ type: 'INVITE', caseId: next.id, method: 'ORDINARY' }, r.status === 'PAUSED' ? '跨周重新邀请，只以普通方式续办' : '邀请两人，只做普通原书实践', '1行动 · 20便士', false, r.status === 'PAUSED');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: next.id }, '报告已还书并离场的真实结果', '1行动 · 扮演25 · 实际能力成功才掌握8', false, true);
  } else if (!l.reflected) add({ type: 'REFLECT' }, '反思互知、前因与当事人的许可', '1行动 · 扮演25', false, true);
  return out;
}
const publicLifeBudget = (b: WriterLifeBudget): WriterLifeBudget => ({ health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions });
function publicLifeCommand(c: WriterActivityCommand): WriterActivityCommand {
  switch (c.type) {
    case 'OBSERVE': case 'REPORT': return { type: c.type, caseId: c.caseId };
    case 'INVITE': return { type: c.type, caseId: c.caseId, method: c.method };
    case 'MOVE': return { type: c.type, to: c.to };
    case 'REVOKE_CONSENT': return { type: c.type, permission: c.permission };
    default: return { type: c.type };
  }
}
/** Only resolved life facts cross the public boundary; journal replay cursors stay private. */
export function projectWriterLifeReceipt(entry: WriterLifeReceipt): WriterPublicLifeReceipt {
  const check = entry.check;
  return {
    week: entry.week, date: { epoch: entry.date.epoch, year: entry.date.year, month: entry.date.month, day: entry.date.day }, revision: entry.revision,
    checkBase: entry.checkBase, check: check ? {
      ability: check.ability, baseAbility: check.baseAbility, modifiers: check.modifiers.map(modifier => ({ source: modifier.source, value: modifier.value })),
      effectiveAbility: check.effectiveAbility, difficulty: check.difficulty, chance: check.chance, roll: check.roll, tier: check.tier,
    } : null,
    command: publicLifeCommand(entry.command), outcome: entry.outcome,
    before: publicLifeBudget(entry.before), after: publicLifeBudget(entry.after), elapsedSeconds: entry.elapsedSeconds,
    ownerWalkedMetres: entry.ownerWalkedMetres, bookTravelMetres: entry.bookTravelMetres,
    participantWalks: entry.participantWalks.map(walk => ({ id: walk.id, metres: walk.metres })),
  };
}
function projectAttempts(l: WriterLifeState, id: WriterCaseId): WriterLifeProjection['cases'][number]['attempts'] {
  let model: ReplayModel | null = l.sourceRecord ? { source: structuredClone(l.sourceRecord), practice: freshPractice(l.sourceRecord), cases: freshCases(), reflected: false } : null;
  const result: WriterLifeProjection['cases'][number]['attempts'] = [];
  let current: WriterLifeProjection['cases'][number]['attempts'][number] | null = null;
  for (const entry of l.journal) {
    if (!model) break;
    const next = transition(model, entry.command, entry.week, entry.outcome, entry.before, entry); if (!next) break; model = next.model;
    if (entry.command.type === 'INVITE' && entry.command.caseId === id) {
      current = { invitedWeek: entry.week, method: entry.command.method, outcome: null, evidence: { abilityAttempted: false, abilityApplied: false, returned: false, aborted: false, permission: structuredClone(model.cases[id].permission), result: 'NONE' }, receipts: [] }; result.push(current);
    }
    if (current) {
      current.receipts.push(projectWriterLifeReceipt(entry)); const r = model.cases[id];
      current.outcome = r.outcome; current.evidence = { abilityAttempted: r.abilityAttempted, abilityApplied: r.abilityApplied, returned: r.returned, aborted: entry.command.type === 'ABORT', permission: structuredClone(r.permission), result: r.result };
      if (entry.command.type === 'RETURN_HOME' || entry.command.type === 'ABORT') current = null;
    }
  }
  return result;
}
export function projectWriterLife(s: SliceState): WriterLifeProjection {
  const l = s.writer.life;
  const actions = writerLifeActions(s);
  return { title: '两个名字、一本书与尚未发生的归还', source: '伊芙琳和托马斯分别决定是否参与；一个线索有它的来源，一次归还也需要真实的人、书和通路。', environment: WRITER_LIFE_ENVIRONMENT, insideCase: hasWriterLifeLock(s), reflected: l.reflected,
    preferredActionId: actions.find(a => a.enabled && a.preferredAction)?.id ?? actions.find(a => a.enabled)?.id ?? null, practice: structuredClone(l.practice),
    cases: CASES.map(item => { const r = l.cases[item.id]; return { id: item.id, title: item.title, story: item.story, observations: r.status === 'AVAILABLE' ? [] : [...item.facts], status: r.status, contactOpen: r.contactOpen, permission: structuredClone(r.permission),
      preparation: r.status === 'OBSERVED' ? '原物与通路已经观察，等待两位成年人对这一次邀请作出回应。' : r.status === 'PAUSED' ? '前次代价和结果保留，下一真实周可付费普通续办；最多两次。' : null,
      result: r.result !== 'NONE' ? `${r.result === 'ABILITY' ? '相关能力实际成功，并已完成原书核验或归还。' : '已按普通方法完成原书实践。'}${r.returned ? '两位成年人已实际离场。' : '仍须让身体沿原路离场。'}` : r.arrangementEnd === 'PENDING' ? '归还尚未发生，等待30秒期限内的实际条件。' : r.abilityAttempted ? '能力尝试及其成本已经记录；未完成的步骤仍可按当前许可普通办理。' : null,
      returned: r.returned, attempts: projectAttempts(l, item.id) }; }), ledger: l.journal.map(projectWriterLifeReceipt) };
}
