import type { PublicCheckResult } from '../../shared/contracts.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasDreamWeaverLifeLock } from '../dream-weaver/life.js';
import { hasManipulatorRitualLock } from '../manipulator/ritual.js';
import { manipulatorInside } from '../manipulator/life.js';

export const DISCERNER_CASE_IDS = ['present-mark', 'covered-mark', 'withdrawn-mark'] as const;
export const DISCERNER_PERSON_IDS = ['DCR2-ELENA', 'DCR2-BRAM', 'DCR2-SELMA'] as const;
export const DISCERNER_CARD_IDS = ['DCR2-ELENA-CARD', 'DCR2-BRAM-CARD', 'DCR2-SELMA-CARD'] as const;
export type DiscernerCaseId = typeof DISCERNER_CASE_IDS[number];
export type DiscernerPersonId = typeof DISCERNER_PERSON_IDS[number];
export type DiscernerCardId = typeof DISCERNER_CARD_IDS[number];
export type DiscernerNode = 'NEAR' | 'FAR';
export type DiscernerPermission = 'CONTACT' | 'MATERIAL';
export type DiscernerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN';
export type DiscernerActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'VERIFY' | 'CLOSE' | 'WITHDRAW' | 'REPORT'; caseId: DiscernerCaseId }
  | { type: 'PREPARE'; caseId: DiscernerCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; personId: DiscernerPersonId; permission: DiscernerPermission }
  | { type: 'MOVE'; actor: 'OWNER'; to: DiscernerNode }
  | { type: 'FORM_MARK' | 'MENTAL_IMPRINT' | 'STOP_CONTACT' | 'WAIT_MARK' | 'ACTIVATE_SEAL' | 'DEACTIVATE_SEAL' | 'TAKE_CARD' | 'CHECK_CARD' | 'RETURN_CARD' | 'REFLECT' };
export type DiscernerStep =
  | { type: 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'; permission: DiscernerPermission }
  | { type: 'MOVE'; to: DiscernerNode }
  | { type: 'MENTAL_IMPRINT'; check: PublicCheckResult; spiritualityBefore: number; mindBefore: number }
  | { type: 'PERFORM' | 'FORM_MARK' | 'STOP_CONTACT' | 'WAIT_MARK' | 'ACTIVATE_SEAL' | 'DEACTIVATE_SEAL' | 'TAKE_CARD' | 'CHECK_CARD' | 'RETURN_CARD' | 'VERIFY' | 'CLOSE' | 'WITHDRAW' };
/** Physical steps are the source of truth. Positions, knowledge, costs and results are projected, never separately saved. */
export interface DiscernerAttempt { week: number; method: 'ABILITY' | 'ORDINARY'; steps: DiscernerStep[] }
export interface DiscernerCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attempts: DiscernerAttempt[];
}
export interface DiscernerLifeState { cases: Record<DiscernerCaseId, DiscernerCaseState>; reflected: boolean }
export interface DiscernerAttemptProjection {
  week: number; method: 'ABILITY' | 'ORDINARY'; performed: boolean; closed: boolean; withdrawn: boolean;
  contactPermission: DiscernerConsent; materialPermission: DiscernerConsent;
  elapsedSeconds: number; ownerTravelMetres: number; spiritualitySpent: number; ownerMindSpent: number;
  ownerNode: DiscernerNode; markFormed: boolean; markRemainingSeconds: number; imprintAttempted: boolean;
  imprintResult: 'NONE' | 'BLOCKED' | 'FAILED' | 'REVEALED'; check: PublicCheckResult | null;
  contactActive: boolean; contactEnd: 'NONE' | 'STOPPED' | 'WITHDRAWN' | 'EXPIRED';
  cardTaken: boolean; cardChecked: boolean; cardReturned: boolean; verified: boolean;
  sealActivated: boolean; sealActive: boolean; sealCharges: number;
  result: 'NONE' | 'ABILITY' | 'ORDINARY';
}
export interface DiscernerPerson { id: DiscernerPersonId; name: string; age: number; node: 'FAR'; health: 100; mind: 100 }
export interface DiscernerCard {
  id: DiscernerCardId; ownerId: DiscernerPersonId; holder: 'TARGET' | 'OWNER'; node: DiscernerNode;
  /** Omitted until the owner actually reads this original at the near desk. */
  marking?: string;
}
export interface DiscernerKnowledge { caseId: DiscernerCaseId; sourceId: string; source: 'FINITE_IMPRINT' | 'PHYSICAL_ORIGINAL'; week: number; text: string }
export interface DiscernerPractice {
  sceneId: 'DCR2-CARD-ROOM'; activeCase: DiscernerCaseId | null; ownerNode: DiscernerNode;
  participants: Record<DiscernerPersonId, DiscernerPerson>; cards: Record<DiscernerCardId, DiscernerCard>;
  seal: { id: 'DCR2-BRAM-SEAL'; ownerId: 'DCR2-BRAM'; holder: 'TARGET'; node: 'FAR'; active: boolean; charges: number; scope: string };
  knownClues: DiscernerKnowledge[];
}
export interface DiscernerLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean;
  practice: DiscernerPractice | null; currentAttempt: DiscernerAttemptProjection | null;
  currentConsents: { id: DiscernerPersonId; consented: boolean; materialConsented: boolean }[];
  cases: { id: DiscernerCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: boolean; returned: boolean; closes: number; attempts: DiscernerAttemptProjection[] }[];
}
export interface DiscernerLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DiscernerActivityCommand }
const IMPRINT_ID = 'audience.s2.mental-imprint';
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const active = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 2;
const CASES = [
  { id: 'present-mark', personId: 'DCR2-ELENA', name: '埃蕾娜', age: 38, cardId: 'DCR2-ELENA-CARD', title: '眼前印记：有限线索与同一原卡', story: '新成年人埃蕾娜在远桌保管自己的唯一原卡。她须实际看卡形成当次有限印记；本人走完三米普通通道后，才能在当前同意下尝试近距接触。（原创G）', facts: ['能力许可与原卡交接许可分别询问；任何旧人物的同意均不沿用。', '一次近距尝试实付6灵性与本人2精神、意志18；成功也只得一个有限象征，不是客观证明或生平记忆。', '她自愿亲手交原卡后，本人带回近桌实读比较，再亲自走返归还同一卡。'], clue: '一个缺口圆环的短暂象征。', marking: '原卡正面画着一个缺口圆环，背面有埃蕾娜亲笔的本次练习编号。' },
  { id: 'covered-mark', personId: 'DCR2-BRAM', name: '布兰', age: 46, cardId: 'DCR2-BRAM-CARD', title: '遮蔽印记：原保护封签的有限拒止', story: '新成年人布兰在远桌保管另一张独立原卡，并一直佩戴DCR2-BRAM-SEAL原保护封签。封签只有一次本练习近距接触阻挡额度；须真实启用才生效，阻挡后耗尽，不代表敌意或普遍无敌。（原创G）', facts: ['原封签始终在远桌布兰身上，不由玩家凭空生成、装备或复制。', '启用时阻挡本次一次近距印记扫描，扫描仍实付6灵性2精神，没有隐藏线索泄漏或掌握奖励。', '可以明确停用未消耗的保护；不管能力失败或被阻挡，都可另获原卡许可后普通交接、比较、归还。'], clue: '三段不相接的短直线。', marking: '布兰原卡正面是三段不相接的短直线，背面有他亲笔的本次练习编号。' },
  { id: 'withdrawn-mark', personId: 'DCR2-SELMA', name: '塞尔玛', age: 34, cardId: 'DCR2-SELMA-CARD', title: '撤回印记许可：普通核验仍可独立进行', story: '新成年人塞尔玛在远桌保管第三张原卡。她可以在实际看卡后、接触前撤回当次能力许可；读取原卡是另一份自愿许可。停止能力不挪动任何人，也不把原卡送回。（原创G）', facts: ['本案的两份当前许可分别记录；撤回能力许可后不能施术，也不能从撤回推断私密内容。', '即使未施术、检定失败或本人停止，原卡仍由原持有人掌握，必须实际自愿交接。', '尊重拒绝并完成普通原卡核验同样可报告；没有能力成功就没有新掌握。'], clue: '一个偏向右侧的细小弯钩。', marking: '塞尔玛原卡正面画一个偏向右侧的细小弯钩，背面有她亲笔的本次练习编号。' },
] as const;
const entryFor = (id: DiscernerCaseId) => CASES.find(v => v.id === id)!;
export const DISCERNER_LIFE_ENVIRONMENT = 'DCR2-CARD-ROOM：三名新的知情成年人、三张不同原卡、近远桌3米开放普通路。人物、封签、时间、数值及练习均原创G。观察/准备/实施各1行动；准备须余2行动。子步骤0行动但真实耗时，步行3米/3秒。目标实看原卡3秒后才形成60秒有限印记；近距尝试6灵性＋本人2精神、意志18，一案只一次，不可重开洗骰。成功只给有限象征；接触至多30秒且可立即停止。原封签只挡一次本练习扫描，真实耗尽。原卡须自愿交付、本人带回近桌实读、走返归还并回近桌；每报告25扮演、反思25，仅实际成功印记对应掌握8。';
const freshCase = (): DiscernerCaseState => ({ status: 'AVAILABLE', observedWeek: null, attempts: [] });
export function createDiscernerLifeState(): DiscernerLifeState { return { cases: { 'present-mark': freshCase(), 'covered-mark': freshCase(), 'withdrawn-mark': freshCase() }, reflected: false }; }
const selectedCase = (s: SliceState): DiscernerCaseId | null => DISCERNER_CASE_IDS.find(id => ['PREPARED', 'ACTIVE'].includes(s.discerner.life.cases[id].status)) ?? null;
export function hasDiscernerLifeLock(s: SliceState): boolean { return !!s.discerner?.life && selectedCase(s) !== null; }
export const discernerInside = hasDiscernerLifeLock;

interface Replay extends DiscernerAttemptProjection { markAt: number | null; contactAt: number | null }
function freshReplay(a: DiscernerAttempt, charges: number): Replay {
  return { week: a.week, method: a.method, performed: false, closed: false, withdrawn: false, contactPermission: 'UNASKED', materialPermission: 'UNASKED', elapsedSeconds: 0, ownerTravelMetres: 0, spiritualitySpent: 0, ownerMindSpent: 0, ownerNode: 'NEAR', markFormed: false, markRemainingSeconds: 0, imprintAttempted: false, imprintResult: 'NONE', check: null, contactActive: false, contactEnd: 'NONE', cardTaken: false, cardChecked: false, cardReturned: false, verified: false, sealActivated: false, sealActive: false, sealCharges: charges, result: 'NONE', markAt: null, contactAt: null };
}
function elapse(a: Replay, seconds: number): void {
  a.elapsedSeconds += seconds;
  a.markRemainingSeconds = a.markAt === null ? 0 : Math.max(0, 60 - (a.elapsedSeconds - a.markAt));
  if (a.contactActive && a.contactAt !== null && a.elapsedSeconds - a.contactAt >= 30) { a.contactActive = false; a.contactEnd = 'EXPIRED'; }
}
const returned = (a: Replay) => a.ownerNode === 'NEAR' && (!a.cardTaken || a.cardReturned) && !a.contactActive && !a.sealActive;
function resultOf(a: Replay): 'NONE' | 'ABILITY' | 'ORDINARY' { return a.cardChecked && a.cardReturned ? a.imprintResult === 'REVEALED' ? 'ABILITY' : 'ORDINARY' : 'NONE'; }
function stepShape(v: unknown): v is DiscernerStep {
  if (!record(v)) return false;
  if (['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'permission']) && ['CONTACT', 'MATERIAL'].includes(String(v.permission));
  if (v.type === 'MOVE') return shape(v, ['type', 'to']) && ['NEAR', 'FAR'].includes(String(v.to));
  if (v.type === 'MENTAL_IMPRINT') {
    if (!shape(v, ['type', 'check', 'spiritualityBefore', 'mindBefore']) || !integer(v.spiritualityBefore, 6, 120) || !integer(v.mindBefore, 3, 100) || !record(v.check) || !shape(v.check, ['ability', 'baseAbility', 'modifiers', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier'])) return false;
    const c = v.check;
    if (c.ability !== 'will' || c.difficulty !== 18 || !integer(c.baseAbility, 0, 500) || !integer(c.roll, 1, 100) || !Array.isArray(c.modifiers)) return false;
    try { return stableStringify(c) === stableStringify(resolveNormalCheck({ ability: 'will', baseAbility: c.baseAbility, difficulty: 18, modifiers: c.modifiers, roll: c.roll })); } catch { return false; }
  }
  return ['PERFORM', 'FORM_MARK', 'STOP_CONTACT', 'WAIT_MARK', 'ACTIVATE_SEAL', 'DEACTIVATE_SEAL', 'TAKE_CARD', 'CHECK_CARD', 'RETURN_CARD', 'VERIFY', 'CLOSE', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type']);
}
/** The same physical preconditions serve live controls and saved-step replay. */
function stepBlock(id: DiscernerCaseId, a: Replay, c: DiscernerStep['type'], permission?: DiscernerPermission, to?: DiscernerNode, previousScan = false): string | null {
  if (a.closed) return '本次尝试已经真实收束。';
  if (c === 'CONSENT' || c === 'DECLINE_CONSENT' || c === 'REVOKE_CONSENT') {
    if (!permission || a.verified) return '先选择本次尚未复核的具体许可。';
    const current = permission === 'CONTACT' ? a.contactPermission : a.materialPermission;
    if (c === 'REVOKE_CONSENT') return current === 'GRANTED' ? null : '本次这份许可当前没有生效，不能重复撤回。';
    return current === 'UNASKED' ? null : '本次这份许可已明确回应；撤回或拒绝后不能在同次重新同意。';
  }
  if (c === 'PERFORM') return a.performed ? '本次已支付实施行动。' : a.materialPermission !== 'GRANTED' ? '先单独询问原卡自愿交接与实读的当前许可。' : a.method === 'ABILITY' && a.contactPermission === 'UNASKED' ? '能力方式先单独询问当前近距接触许可；拒绝后仍可普通实施。' : null;
  if (c === 'WITHDRAW' && !a.performed) return null;
  if (!a.performed) return '先支付1行动实际实施本项原场。';
  if (c === 'CLOSE' || c === 'WITHDRAW') return !returned(a) ? '先停止接触和封签、本人归还同一卡，并实际走回近桌；关闭不会传送。' : a.result !== 'NONE' && !a.verified ? '有实际核验结果时须先明确复核。' : null;
  if (c === 'STOP_CONTACT') return a.contactActive ? null : '没有尚在持续的本次有限接触。';
  if (c === 'DEACTIVATE_SEAL') return a.sealActive ? null : '原保护封签当前没有启用。';
  if (c === 'RETURN_CARD') return a.ownerNode === 'FAR' && a.cardTaken && !a.cardReturned ? null : '本人须携同一原卡实际到远桌，才能交回原主人。';
  if (a.verified) return '本项已完成实际复核，只可关闭或结束现场。';
  if (c === 'MOVE') return to && to !== a.ownerNode ? null : '目的桌须不同于原身体当前所在桌。';
  if (c === 'VERIFY') return a.result === 'NONE' ? '先将自愿交付的同一原卡带回近桌实读比较，再亲自归还。' : !returned(a) ? '先停接触、停封签、归还同一卡并让原身体回近桌。' : null;
  if (c === 'FORM_MARK') return a.markFormed || a.imprintAttempted || a.cardTaken ? '本次只由目标亲眼查看自己手中的原卡一次，不重新制造印记。' : a.contactPermission !== 'GRANTED' ? '目标须当前明确允许形成和接触本次有限印记。' : null;
  if (c === 'ACTIVATE_SEAL') return id !== 'covered-mark' || a.sealActive || a.sealCharges < 1 || a.imprintAttempted ? '只有布兰尚存一次额度的原封签可在扫描前启用。' : a.contactPermission !== 'GRANTED' ? '先取得本次知情接触许可，才能进行封签拒止演示。' : null;
  if (c === 'WAIT_MARK') return a.markRemainingSeconds > 0 ? null : '本次没有仍存续的有限印记。';
  if (c === 'MENTAL_IMPRINT') return a.method !== 'ABILITY' || previousScan || a.imprintAttempted ? '本案只有一次能力尝试；失败、被挡或重开都不能再骰，可普通完成。' : a.contactPermission !== 'GRANTED' ? '当前接触许可已缺失、拒绝或撤回；不得继续扫描。' : a.ownerNode !== 'FAR' ? '本人须实际走3米到远桌目标身边，近桌不能隔空扫描。' : !a.markFormed || a.markRemainingSeconds < 2 ? '目标须先亲眼看自己的原卡形成尚余至少2秒的当次有限印记。' : a.cardTaken ? '原卡交接后转入普通核验，不再追溯扫描。' : null;
  if (c === 'TAKE_CARD') return a.materialPermission !== 'GRANTED' ? '能力同意不能代替原卡交付许可；须主人另行自愿交付。' : a.ownerNode !== 'FAR' || a.cardTaken ? '本人须在远桌，亲手接下原主人尚持的唯一原卡一次。' : a.contactActive ? '先立即停止有限接触，再另行自愿交接原卡。' : null;
  if (c === 'CHECK_CARD') return a.materialPermission !== 'GRANTED' ? '当前原卡实读许可须仍有效；撤回后仍可普通归还。' : a.ownerNode !== 'NEAR' || !a.cardTaken || a.cardReturned || a.cardChecked ? '须本人携同一原卡回近桌，才能实际翻看并比较一次。' : null;
  return '未知的洞察者原场子步骤。';
}
function applyStep(a: Replay, c: DiscernerStep): void {
  switch (c.type) {
    case 'CONSENT': case 'DECLINE_CONSENT': case 'REVOKE_CONSENT': {
      const value = c.type === 'CONSENT' ? 'GRANTED' : c.type === 'DECLINE_CONSENT' ? 'DECLINED' : 'WITHDRAWN';
      if (c.permission === 'CONTACT') { a.contactPermission = value; if (c.type === 'REVOKE_CONSENT' && a.contactActive) { a.contactActive = false; a.contactEnd = 'WITHDRAWN'; } }
      else a.materialPermission = value;
      break;
    }
    case 'PERFORM': a.performed = true; break;
    case 'MOVE': a.ownerNode = c.to; a.ownerTravelMetres += 3; elapse(a, 3); break;
    case 'FORM_MARK': elapse(a, 3); a.markFormed = true; a.markAt = a.elapsedSeconds; a.markRemainingSeconds = 60; break;
    case 'ACTIVATE_SEAL': a.sealActivated = true; a.sealActive = true; elapse(a, 1); break;
    case 'DEACTIVATE_SEAL': a.sealActive = false; elapse(a, 1); break;
    case 'MENTAL_IMPRINT': {
      a.imprintAttempted = true; a.spiritualitySpent += 6; a.ownerMindSpent += 2; a.check = structuredClone(c.check);
      const shielded = a.sealActive && a.sealCharges > 0;
      elapse(a, 2);
      if (shielded) { a.sealCharges--; a.sealActive = false; a.imprintResult = 'BLOCKED'; }
      else if (success(c.check.tier)) { a.imprintResult = 'REVEALED'; a.contactActive = true; a.contactAt = a.elapsedSeconds; }
      else a.imprintResult = 'FAILED';
      break;
    }
    case 'STOP_CONTACT': a.contactActive = false; a.contactEnd = 'STOPPED'; break;
    case 'WAIT_MARK': elapse(a, a.markRemainingSeconds); break;
    case 'TAKE_CARD': a.cardTaken = true; elapse(a, 1); break;
    case 'CHECK_CARD': a.cardChecked = true; elapse(a, 2); break;
    case 'RETURN_CARD': a.cardReturned = true; elapse(a, 1); break;
    case 'VERIFY': a.verified = true; elapse(a, 1); break;
    case 'CLOSE': case 'WITHDRAW': a.closed = true; a.withdrawn = c.type === 'WITHDRAW'; break;
  }
  a.result = resultOf(a);
}
function replayAttempt(id: DiscernerCaseId, a: DiscernerAttempt, charges: number, previousScan: boolean): Replay {
  const out = freshReplay(a, charges);
  for (const c of a.steps) {
    if (!stepShape(c)) throw new Error('洞察者原场步骤结构无效。');
    const blocked = stepBlock(id, out, c.type, 'permission' in c ? c.permission : undefined, 'to' in c ? c.to : undefined, previousScan);
    if (blocked) throw new Error(blocked);
    applyStep(out, c);
  }
  return out;
}
function replays(s: SliceState, id: DiscernerCaseId): Replay[] {
  const out: Replay[] = []; let charges = 1, previousScan = false;
  for (const attempt of s.discerner.life.cases[id].attempts) { const a = replayAttempt(id, attempt, charges, previousScan); out.push(a); charges = a.sealCharges; previousScan ||= a.imprintAttempted; }
  return out;
}
function publicAttempt(a: Replay): DiscernerAttemptProjection { const { markAt: _markAt, contactAt: _contactAt, ...view } = a; return structuredClone(view); }
function current(s: SliceState): { id: DiscernerCaseId; state: DiscernerCaseState; attempt: DiscernerAttempt; view: Replay; previousScan: boolean } | null {
  const id = selectedCase(s); if (!id) return null;
  const state = s.discerner.life.cases[id], all = replays(s, id);
  return { id, state, attempt: state.attempts.at(-1)!, view: all.at(-1)!, previousScan: all.slice(0, -1).some(a => a.imprintAttempted) };
}
export function validateDiscernerActivityCommand(v: unknown): v is DiscernerActivityCommand {
  if (!record(v)) return false;
  if (['FORM_MARK', 'MENTAL_IMPRINT', 'STOP_CONTACT', 'WAIT_MARK', 'ACTIVATE_SEAL', 'DEACTIVATE_SEAL', 'TAKE_CARD', 'CHECK_CARD', 'RETURN_CARD', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (['CONSENT', 'DECLINE_CONSENT', 'REVOKE_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'personId', 'permission']) && DISCERNER_PERSON_IDS.includes(v.personId as DiscernerPersonId) && ['CONTACT', 'MATERIAL'].includes(String(v.permission));
  if (v.type === 'MOVE') return shape(v, ['type', 'actor', 'to']) && v.actor === 'OWNER' && ['NEAR', 'FAR'].includes(String(v.to));
  if (!DISCERNER_CASE_IDS.includes(v.caseId as DiscernerCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'VERIFY', 'CLOSE', 'WITHDRAW', 'REPORT'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isDiscernerActivity = validateDiscernerActivityCommand;
function oldSceneLock(s: SliceState): boolean {
  return hasDreamWeaverLifeLock(s) || s.dreamWeaver.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.dreamWeaver.encounter.status) || hasManipulatorRitualLock(s) || manipulatorInside(s) || ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status);
}
export function blockDiscernerActivity(s: SliceState, c: DiscernerActivityCommand): string | null {
  if (!validateDiscernerActivityCommand(c)) return '洞察者生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE') return '本人须仍活着且当前恰为观众途径序列2洞察者。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理当前事件或战斗，并实际回贝克兰德DCR2-CARD-ROOM。';
  if (s.discerner.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.discerner.encounter.status) || oldSceneLock(s)) return '先真实收束晋升准备、旧原场或当前遭遇。';
  const live = current(s), l = s.discerner.life;
  if (live) {
    if ('caseId' in c && c.caseId !== live.id) return '先实际收束当前同一原场或取消准备。';
    if ('personId' in c && c.personId !== entryFor(live.id).personId) return '这份同意必须来自本案的原成年人，其他人的许可无效。';
    if (['OBSERVE', 'PREPARE', 'REPORT', 'REFLECT'].includes(c.type)) return '先真实结束当前准备或原场。';
    const reason = stepBlock(live.id, live.view, c.type as DiscernerStep['type'], 'permission' in c ? c.permission : undefined, 'to' in c ? c.to : undefined, live.previousScan);
    if (reason) return reason;
    if (c.type === 'PERFORM' && s.actionsRemaining < 1) return '实际实施仍须支付1行动。';
    if (c.type === 'MENTAL_IMPRINT' && (s.spirituality < 6 || s.mind <= 2)) return '本次需实付6灵性与本人2精神并保持清醒；不足可普通完成。';
    return null;
  }
  if (s.health <= 0 || s.mind <= 0) return '先恢复本人身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动；实际原场内普通返回与还物仍为0行动。';
  if (c.type === 'REFLECT') return l.reflected ? '三案反思已完成。' : DISCERNER_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先报告三项真实经历。' : null;
  if (!('caseId' in c)) return '先观察、准备并实际实施本项原场。';
  const r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { const previous = DISCERNER_CASE_IDS[DISCERNER_CASE_IDS.indexOf(c.caseId) - 1]; return r.status !== 'AVAILABLE' ? '已经观察本项原场。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先完成上一项真实报告。' : null; }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原场。' : c.method === 'ABILITY' && r.attempts.some(a => a.steps.some(step => step.type === 'MENTAL_IMPRINT')) ? '本案能力尝试已耗用，后续只可重新准备普通核验，不能重骰。' : s.actionsRemaining < 2 ? '准备须余2行动，为实际实施保留1行动。' : r.attempts.some(a => a.week === s.week && a.steps.some(step => step.type === 'PERFORM')) ? '本周已实际实施本案，保留失败与代价；下一真实周可重新普通完成，但不能重骰。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先实读比较、归还原卡、亲自走返、复核并关闭原场。';
  return '本项当前没有可以使用的准备或原场。';
}
export function applyDiscernerActivity(s: SliceState, c: DiscernerActivityCommand, ctx: SeerContext): void {
  const reason = blockDiscernerActivity(s, c); if (reason) throw new Error(reason);
  const l = s.discerner.life, live = current(s);
  if (live) {
    let step: DiscernerStep;
    if (c.type === 'MENTAL_IMPRINT') {
      const spiritualityBefore = s.spirituality, mindBefore = s.mind;
      s.spirituality -= 6; s.mind -= 2;
      step = { type: 'MENTAL_IMPRINT', check: structuredClone(ctx.check('will', 18)), spiritualityBefore, mindBefore };
    } else if (c.type === 'MOVE') step = { type: 'MOVE', to: c.to };
    else if (c.type === 'CONSENT' || c.type === 'DECLINE_CONSENT' || c.type === 'REVOKE_CONSENT') step = { type: c.type, permission: c.permission };
    else step = { type: c.type as Exclude<DiscernerStep['type'], 'MOVE' | 'MENTAL_IMPRINT' | 'CONSENT' | 'DECLINE_CONSENT' | 'REVOKE_CONSENT'> };
    live.attempt.steps.push(step); applyStep(live.view, step);
    const a = live.view, entry = entryFor(live.id);
    if (c.type === 'PERFORM') { s.actionsRemaining--; live.state.status = 'ACTIVE'; }
    if (c.type === 'CLOSE' || c.type === 'WITHDRAW') live.state.status = a.result === 'NONE' ? 'OBSERVED' : 'EXAMINED';
    const notes: Partial<Record<DiscernerStep['type'], string>> = {
      PERFORM: '实付1行动进入同一原场；目标尚未看卡、没有印记或未知线索。之后0行动仍可普通还物走返。',
      FORM_MARK: `${entry.name}在远桌亲眼查看自己原卡3秒后才形成60秒有限印记。卡面未向本人展示，未知内容仍不公开。`,
      ACTIVATE_SEAL: '布兰实际启用身上DCR2-BRAM-SEAL原封签，耗1秒；只对本练习一次近距扫描有效，未凭空获得保护或敌意标签。',
      DEACTIVATE_SEAL: '布兰花1秒明确停用身上同一原封签；未用额度保留，没有补充或复制。',
      STOP_CONTACT: '有限接触立即停止，0秒；不会移动原身体、交还原卡、退款或清除已发生结果。',
      WAIT_MARK: '真实等待当次印记剩余秒数直至60秒期限，持续接触若达到30秒也实际结束；不移动本人或原卡。',
      TAKE_CARD: `${entry.name}按独立当前原卡许可，将唯一${entry.cardId}亲手交给远桌本人，耗1秒；没有另一张复制品。`,
      CHECK_CARD: `本人将同一原卡带回近桌，耗2秒实际翻看：${entry.marking} ${a.imprintResult === 'REVEALED' ? '与此前实际接触得到的有限象征比较；这不证明任何其他事情。' : '这是普通实物来源，不能倒称此前读心成功，也不增加能力掌握。'}`,
      RETURN_CARD: `远桌本人花1秒将同一${entry.cardId}交回${entry.name}；原身体仍在远桌，必须亲自再走3米回近桌。`,
      VERIFY: '耗1秒复核：原卡已亲自比较并归还原主人，接触和封签已停，本人已实际回近桌。',
      CLOSE: '原场真实关闭；已耗灵性、精神、保护额度、秒数与移动均保留，不重置旧人物、原物或失败。',
      WITHDRAW: '本次尝试已真实结束；已付行动、能力失败与保护消耗均保留。后续普通完成不能重骰本案能力。',
    };
    let note = notes[step.type] ?? '';
    if (c.type === 'MOVE') note = `本人原身体沿开放普通路走3米、耗3秒到${c.to === 'FAR' ? '远桌' : '近桌'}；${a.cardTaken && !a.cardReturned ? '手中同一原卡随本人移动。' : '三张原卡仍各由其当前实际持有人保管。'}`;
    if (c.type === 'CONSENT' || c.type === 'DECLINE_CONSENT' || c.type === 'REVOKE_CONSENT') note = `${entry.name}${c.type === 'CONSENT' ? '明确同意' : c.type === 'DECLINE_CONSENT' ? '明确拒绝' : '明确撤回'}本次${c.permission === 'CONTACT' ? '有限印记形成与近距接触' : '原卡自愿交接、本人实读比较与归还'}许可。两份许可分开；撤回接触立即结束持续影响，原身体和原卡不移动，普通归还始终可做。`;
    if (c.type === 'MENTAL_IMPRINT') note = `一次尝试实际支付6灵性与本人2精神，耗2秒，意志${a.check!.roll}/${a.check!.chance}。${a.imprintResult === 'BLOCKED' ? '布兰身上原保护封签拒止并耗尽唯一额度；没有透露卡面或象征，没有能力掌握，也不能推断敌意。' : a.imprintResult === 'FAILED' ? '检定失败，没有读到有限象征，不返还成本、不增加掌握；可按另一份原卡许可普通完成。' : `只接触到当次有限象征：${entry.clue} 不是客观证据、生平记忆或通用读心；仍需明确停止并按独立许可亲取、比较、归还原卡。`}`;
    ctx.note(entry.title, note); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('discerner-reflection'); ctx.note('反思有限洞察、保护与当前许可', '三项真实报告后的反思，扮演+25（G）。线索须有真实来源；普通核验同样有价值，拒绝与遮蔽不能证明敌意或罪行。'); return; }
  if (!('caseId' in c)) throw new Error('未知洞察者生活命令。');
  const r = l.cases[c.caseId], entry = entryFor(c.caseId);
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(entry.title, entry.story + entry.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.attempts.push({ week: s.week, method: c.method, steps: [] }); ctx.note('准备当前两份独立许可与普通退路', '实付1行动；先分别询问本案成年人的能力接触与原卡交接许可。尚未施术、看卡或得知有限象征；旧同意不沿用。'); return; }
  if (c.type === 'REPORT') { const a = replays(s, c.caseId).at(-1)!; r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`discerner-case:${c.caseId}`); if (a.result === 'ABILITY') s.progression.mastery[IMPRINT_ID] = Math.min(500, (s.progression.mastery[IMPRINT_ID] ?? 0) + 8); ctx.note(entry.title, `已比较并归还同一原卡，本人亲自走返。扮演+25（G）；${a.result === 'ABILITY' ? '本次真实成功近距印记对应掌握+8。' : '普通完成不增加能力掌握，拒绝、失败与保护消耗保留。'}`); }
}
export function discernerLifeActions(s: SliceState): DiscernerLifeAction[] {
  if (!active(s)) return [];
  const out: DiscernerLifeAction[] = [], l = s.discerner.life;
  const add = (command: DiscernerActivityCommand, label: string, cost: string) => {
    const reason = blockDiscernerActivity(s, command);
    out.push({ id: `discerner-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'personId' in command ? '-' + command.personId.toLowerCase() : ''}${'permission' in command ? '-' + command.permission.toLowerCase() : ''}${'to' in command ? '-' + command.to.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason });
  };
  for (const entry of CASES) {
    const r = l.cases[entry.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: entry.id }, `观察：${entry.title}`, '1行动');
    if (r.status === 'OBSERVED') {
      add({ type: 'PREPARE', caseId: entry.id, method: 'ABILITY' }, '准备有限印记与普通退路', '1行动 · 须余2行动 · 本案能力仅一次');
      add({ type: 'PREPARE', caseId: entry.id, method: 'ORDINARY' }, '准备普通原卡核验', '1行动 · 须余2行动 · 不需要施术');
    }
    if (r.status === 'PREPARED' || r.status === 'ACTIVE') {
      for (const permission of ['CONTACT', 'MATERIAL'] as const) {
        const title = permission === 'CONTACT' ? '本次有限印记接触' : '同一原卡自愿交接与实读';
        add({ type: 'CONSENT', personId: entry.personId, permission }, `询问${entry.name}：${title}许可`, '0行动 · 两份当前许可分开');
        add({ type: 'DECLINE_CONSENT', personId: entry.personId, permission }, `${entry.name}拒绝${title}`, '0行动 · 不泄漏未知内容');
        add({ type: 'REVOKE_CONSENT', personId: entry.personId, permission }, `${entry.name}撤回${title}许可`, '0行动 · 接触影响立即停止 · 不移动人或卡');
      }
    }
    if (r.status === 'PREPARED') {
      add({ type: 'PERFORM', caseId: entry.id }, '实际实施本次原场', '1行动 · 后续普通走返与还物0行动');
      add({ type: 'WITHDRAW', caseId: entry.id }, '取消尚未实施的本次准备', '0行动 · 不返还已付行动');
    }
    if (r.status === 'ACTIVE') {
      const a = replays(s, entry.id).at(-1)!;
      if (a.method === 'ABILITY' && !a.markFormed) add({ type: 'FORM_MARK' }, `${entry.name}亲眼查看自己原卡，形成当次印记`, '0行动 · 3秒 · 不向本人公开卡面');
      if (entry.id === 'covered-mark') {
        add({ type: 'ACTIVATE_SEAL' }, '布兰启用身上同一原保护封签', '0行动 · 1秒 · 仅一次本练习扫描保护');
        add({ type: 'DEACTIVATE_SEAL' }, '布兰明确停用同一原保护封签', '0行动 · 1秒 · 不补充消耗额度');
      }
      for (const to of ['FAR', 'NEAR'] as const) add({ type: 'MOVE', actor: 'OWNER', to }, `本人沿原普通路走到${to === 'FAR' ? '远桌' : '近桌'}`, '0行动 · 3米/3秒 · 持有的原卡随本人');
      if (a.method === 'ABILITY' && !a.imprintAttempted) add({ type: 'MENTAL_IMPRINT' }, '近距尝试一次当次有限心灵印记', '0行动 · 2秒 · 6灵性＋本人2精神 · 意志18');
      add({ type: 'STOP_CONTACT' }, '立即停止本次有限接触', '0行动 · 0秒 · 人和原卡仍在原位置');
      if (a.markRemainingSeconds > 0) add({ type: 'WAIT_MARK' }, '真实等待当次有限印记到期', `0行动 · ${a.markRemainingSeconds}秒 · 不返还能力成本`);
      add({ type: 'TAKE_CARD' }, `远桌本人接下${entry.name}自愿交付的同一原卡`, '0行动 · 1秒 · 需独立当前原卡许可');
      add({ type: 'CHECK_CARD' }, '近桌本人实读并比较带回的同一原卡', '0行动 · 2秒 · 普通来源不冒充能力成功');
      add({ type: 'RETURN_CARD' }, `远桌本人把同一原卡亲交回${entry.name}`, '0行动 · 1秒 · 撤回后仍可归还');
      add({ type: 'VERIFY', caseId: entry.id }, '能力已停、原卡已还、本人走返后复核', '0行动 · 1秒');
      add({ type: 'CLOSE', caseId: entry.id }, '关闭真实收束的本次原场', '0行动 · 不代替停止、走路或归还');
      add({ type: 'WITHDRAW', caseId: entry.id }, '结束本次尝试并保留实际后果', '0行动 · 必须先普通还物走返');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: entry.id }, '报告已真实核验与归还的本次结果', '1行动 · 扮演25 · 成功印记对应掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思有限线索、保护、同意与普通来源', '1行动 · 三项报告后扮演25');
  return out;
}
export function projectDiscernerLife(s: SliceState): DiscernerLifeProjection {
  const l = s.discerner.life;
  if (!active(s) && !(s.progression.pathwayId==='audience'&&s.progression.sequence===1)) return { title: '洞察者生活', source: '尚未进入洞察者有限原场。', environment: '', insideCase: false, reflected: false, practice: null, currentAttempt: null, currentConsents: [], cases: [] };
  const all = Object.fromEntries(DISCERNER_CASE_IDS.map(id => [id, replays(s, id)])) as Record<DiscernerCaseId, Replay[]>;
  const id = selectedCase(s), a = id ? all[id].at(-1)! : null;
  const participants = Object.fromEntries(CASES.map(e => [e.personId, { id: e.personId, name: e.name, age: e.age, node: 'FAR', health: 100, mind: 100 }])) as Record<DiscernerPersonId, DiscernerPerson>;
  const cards = Object.fromEntries(CASES.map(e => {
    const carried = id === e.id && !!a?.cardTaken && !a.cardReturned;
    return [e.cardId, { id: e.cardId, ownerId: e.personId, holder: carried ? 'OWNER' : 'TARGET', node: carried ? a!.ownerNode : 'FAR', ...(all[e.id].some(v => v.cardChecked) ? { marking: e.marking } : {}) }];
  })) as Record<DiscernerCardId, DiscernerCard>;
  const knownClues: DiscernerKnowledge[] = [];
  for (const e of CASES) {
    const firstScan = all[e.id].find(v => v.imprintResult === 'REVEALED'), firstRead = all[e.id].find(v => v.cardChecked);
    if (firstScan) knownClues.push({ caseId: e.id, sourceId: `${e.personId}:MARK-${all[e.id].indexOf(firstScan) + 1}`, source: 'FINITE_IMPRINT', week: firstScan.week, text: e.clue });
    if (firstRead) knownClues.push({ caseId: e.id, sourceId: e.cardId, source: 'PHYSICAL_ORIGINAL', week: firstRead.week, text: e.marking });
  }
  const shield = all['covered-mark'].at(-1);
  return {
    title: '洞察者生活：有限印记、原保护封签与自愿原卡核验', source: '近距特定印记探知只取有限参考边界；三人三卡、封签及全部练习机制与数值均原创G。不构成通用读心、绝对真相或自动敌意鉴定。',
    environment: DISCERNER_LIFE_ENVIRONMENT, insideCase: hasDiscernerLifeLock(s), reflected: l.reflected,
    practice: { sceneId: 'DCR2-CARD-ROOM', activeCase: id, ownerNode: a?.ownerNode ?? 'NEAR', participants, cards, seal: { id: 'DCR2-BRAM-SEAL', ownerId: 'DCR2-BRAM', holder: 'TARGET', node: 'FAR', active: shield?.sealActive ?? false, charges: shield?.sealCharges ?? 1, scope: '预先存在的唯一原创G保护封签；仅一次本练习近距印记扫描，耗尽不补充，不是普遍无敌或敌意证据。' }, knownClues },
    currentAttempt: a ? publicAttempt(a) : null,
    currentConsents: CASES.map(e => ({ id: e.personId, consented: id === e.id && a?.contactPermission === 'GRANTED' && !a.closed, materialConsented: id === e.id && a?.materialPermission === 'GRANTED' && !a.closed })),
    cases: CASES.map(e => {
      const r = l.cases[e.id], attempts = all[e.id], last = attempts.at(-1);
      return { id: e.id, title: e.title, story: e.story, observations: r.status === 'AVAILABLE' ? [] : [...e.facts], preparation: r.status === 'PREPARED' ? last!.method === 'ABILITY' ? '本次有限印记方式，先分别取得能力和原卡两份当前许可；失败、拒绝或被挡可普通完成。' : '本次普通原卡方式，仍须原主人当前自愿交付与实读许可；不增加能力掌握。' : null,
        result: last?.result !== 'NONE' && last ? `${last.result === 'ABILITY' ? '实际成功得到有限象征，并普通比较同一原卡。' : '已通过普通实物来源核验；未把拒绝、失败或遮蔽当作能力成功。'}${last.closed ? '同一卡已归还，本人已实际走返。' : '仍须停止接触、本人走返、复核并关闭原场。'}` : last?.performed ? '本次尚未完成原卡核验；已付代价与实际位置均保留。' : null,
        status: r.status, contactOpen: r.status === 'ACTIVE', returned: !!last?.performed && returned(last), closes: attempts.filter(v => v.performed && v.closed).length, attempts: attempts.map(publicAttempt) };
    }),
  };
}
/** Replaying finite physical steps checks ordering and conservation without another mutable mirror. */
export function validateDiscernerLifeState(s: SliceState): boolean { try { return validateLife(s); } catch { return false; } }
function validateLife(s: SliceState): boolean {
  const raw: unknown = s.discerner?.life;
  if (!record(raw) || !shape(raw, ['cases', 'reflected']) || typeof raw.reflected !== 'boolean' || !record(raw.cases) || !shape(raw.cases, DISCERNER_CASE_IDS)) return false;
  const l = raw as unknown as DiscernerLifeState, promotionWeek = s.discerner.promotionWeek;
  if (promotionWeek === null) return stableStringify(l) === stableStringify(createDiscernerLifeState()) && !s.seer.completedSources.some(v => v === 'discerner-reflection' || DISCERNER_CASE_IDS.some(id => v === `discerner-case:${id}`));
  if (!integer(promotionWeek, 1, s.week)) return false;
  let open = 0, resolved = 0, reportedSuccesses = 0;
  for (const [index, id] of DISCERNER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; }
    else if (!integer(r.observedWeek, promotionWeek, s.week) || index > 0 && (l.cases[DISCERNER_CASE_IDS[index - 1]!].status !== 'RESOLVED' || r.observedWeek < (l.cases[DISCERNER_CASE_IDS[index - 1]!].attempts.at(-1)?.week ?? promotionWeek))) return false;
    let previousWeek = r.observedWeek ?? promotionWeek, previousScan = false, charges = 1;
    const views: Replay[] = [], performedWeeks = new Set<number>();
    for (const [attemptIndex, attempt] of r.attempts.entries()) {
      if (!record(attempt) || !shape(attempt, ['week', 'method', 'steps']) || !integer(attempt.week, previousWeek, s.week) || !['ABILITY', 'ORDINARY'].includes(attempt.method) || !Array.isArray(attempt.steps)) return false;
      previousWeek = attempt.week;
      if (previousScan && attempt.method === 'ABILITY') return false;
      const a = replayAttempt(id, attempt, charges, previousScan);
      if (a.performed) { if (performedWeeks.has(a.week)) return false; performedWeeks.add(a.week); }
      if (a.closed && !returned(a) || a.verified && (a.result === 'NONE' || !returned(a)) || a.spiritualitySpent !== (a.imprintAttempted ? 6 : 0) || a.ownerMindSpent !== (a.imprintAttempted ? 2 : 0)) return false;
      if (a.ownerTravelMetres % 3 !== 0 || a.ownerNode !== (a.ownerTravelMetres / 3 % 2 === 0 ? 'NEAR' : 'FAR') || a.ownerTravelMetres > a.elapsedSeconds || !integer(a.elapsedSeconds) || !integer(a.ownerTravelMetres)) return false;
      if (a.cardChecked && a.ownerTravelMetres < 6 || a.cardReturned && a.cardChecked && a.ownerTravelMetres < 9 || a.verified && a.ownerTravelMetres < 12) return false;
      if (id !== 'covered-mark' && (a.sealActivated || a.sealActive || a.sealCharges !== 1) || !integer(a.sealCharges, 0, 1)) return false;
      if (attemptIndex < r.attempts.length - 1 && (!a.closed || a.result !== 'NONE')) return false;
      if (!a.closed && attemptIndex !== r.attempts.length - 1) return false;
      charges = a.sealCharges; previousScan ||= a.imprintAttempted; views.push(a);
    }
    const last = views.at(-1);
    if (r.status === 'OBSERVED' && last && (!last.closed || last.result !== 'NONE')) return false;
    if (r.status === 'PREPARED' && (!last || last.performed || last.closed)) return false;
    if (r.status === 'ACTIVE' && (!last?.performed || last.closed)) return false;
    if (r.status === 'EXAMINED' || r.status === 'RESOLVED') { if (!last?.performed || !last.closed || !last.verified || last.result === 'NONE' || !returned(last)) return false; }
    if (r.status === 'PREPARED' || r.status === 'ACTIVE') {
      open++;
      if (!last || last.week !== s.week || !active(s) || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || s.discerner.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.discerner.encounter.status) || oldSceneLock(s)) return false;
    }
    if (r.status === 'RESOLVED') { resolved++; if (last?.result === 'ABILITY') reportedSuccesses++; }
    if (s.seer.completedSources.filter(source => source === `discerner-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (open > 1 || l.reflected && resolved !== 3 || s.seer.completedSources.filter(source => source === 'discerner-reflection').length !== (l.reflected ? 1 : 0)) return false;
  return !active(s) || integer(s.progression.mastery[IMPRINT_ID], reportedSuccesses * 8, 500) && s.progression.acting >= resolved * 25 + (l.reflected ? 25 : 0);
}
