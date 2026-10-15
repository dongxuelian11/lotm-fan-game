import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasManipulatorRitualLock } from '../manipulator/ritual.js';
import { manipulatorInside } from '../manipulator/life.js';

export const DREAM_WEAVER_CASE_IDS = ['two-desks', 'original-message', 'woven-bell'] as const;
export const DREAM_WEAVER_PERSON_IDS = ['DWV3-IRIS', 'DWV3-OWEN'] as const;
export type DreamWeaverCaseId = typeof DREAM_WEAVER_CASE_IDS[number];
export type DreamWeaverPersonId = typeof DREAM_WEAVER_PERSON_IDS[number];
export type DreamWeaverNode = 'NEAR' | 'FAR';
export type DreamWeaverActor = 'OWNER' | 'IDENTITY';
export type DreamWeaverActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'VERIFY' | 'CLOSE' | 'WITHDRAW' | 'REPORT'; caseId: DreamWeaverCaseId }
  | { type: 'PREPARE'; caseId: DreamWeaverCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONSENT' | 'REVOKE_CONSENT'; personId: DreamWeaverPersonId }
  | { type: 'MOVE'; actor: DreamWeaverActor; to: DreamWeaverNode }
  | { type: 'TALK'; actor: DreamWeaverActor; personId: DreamWeaverPersonId }
  | { type: 'READ_MESSAGE'; actor: DreamWeaverActor }
  | { type: 'CREATE_IDENTITY' | 'REJOIN_IDENTITY' | 'WAIT_IDENTITY' | 'TAKE_MESSAGE' | 'CHECK_MESSAGE' | 'RETURN_MESSAGE' | 'WOVEN_IMAGE' | 'BELIEVE_IMAGE' | 'RECOGNIZE_IMAGE' | 'STOP_IMAGE' | 'CHECK_BELL' | 'REFLECT' };
export interface DreamWeaverAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; consentWeeks: Record<DreamWeaverPersonId, number | null>; revokedPersonIds: DreamWeaverPersonId[];
  performed: boolean; closed: boolean; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  elapsedSeconds: number; ownerTravelMetres: number; identityTravelMetres: number;
  identityAttempted: boolean; identityCreated: boolean; identityId: string | null; identityCreatedAtSeconds: number | null; identityEnd: 'NONE' | 'REJOINED' | 'EXPIRED'; identityLastNode: DreamWeaverNode;
  spiritualitySpent: number; ownerMindSpent: number; talkedToOwen: boolean; irisTalkBy: 'NONE' | DreamWeaverActor;
  messageReadBy: 'NONE' | DreamWeaverActor; messageTaken: boolean; messageChecked: boolean; messageReturned: boolean;
  imageAttempted: boolean; imageCreated: boolean; imageBelieved: boolean; imageRecognized: boolean; imageStopped: boolean; owenMindSpent: number; bellChecked: boolean;
}
export interface DreamWeaverIdentity {
  id: string; originalName: string; source: 'OWNER_SHARED_THOUGHT'; node: DreamWeaverNode; remainingSeconds: number; limitMetres: 6;
}
export interface DreamWeaverPerson { id: DreamWeaverPersonId; name: string; age: number; node: DreamWeaverNode; health: number; mind: number }
export interface DreamWeaverPractice {
  sceneId: 'DWV3-READING-ROOM'; activeCase: DreamWeaverCaseId | null; ownerNode: DreamWeaverNode;
  participants: Record<DreamWeaverPersonId, DreamWeaverPerson>; identity: DreamWeaverIdentity | null;
  image: { id: 'DWV3-BELL-IMAGE'; source: 'KNOWN_ORIGINAL_BELL'; targetId: 'DWV3-OWEN'; believed: boolean } | null;
  message: { id: 'DWV3-MESSAGE'; ownerId: 'DWV3-IRIS'; holder: 'FAR_DESK' | 'OWNER' };
  knownMessage: { sourceId: 'DWV3-MESSAGE'; text: string; readWeek: number; reader: DreamWeaverActor } | null;
  bell: { id: 'DWV3-BELL'; holder: 'NEAR_DESK'; marking: 'ONE_BRASS_BELL_TWO_RINGS' };
}
export interface DreamWeaverCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; verified: boolean; returned: boolean; closes: number; withdrawals: number;
  attempts: DreamWeaverAttempt[];
}
export interface DreamWeaverLifeState { practice: DreamWeaverPractice; cases: Record<DreamWeaverCaseId, DreamWeaverCaseState>; reflected: boolean }
export interface DreamWeaverLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; reflected: boolean; practice: DreamWeaverPractice | null;
  currentAttempt: DreamWeaverAttempt | null; currentConsents: { id: DreamWeaverPersonId; consented: boolean }[];
  cases: { id: DreamWeaverCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: boolean; returned: boolean; closes: number; attempts: DreamWeaverAttempt[] }[];
}
export interface DreamWeaverLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DreamWeaverActivityCommand }
const MESSAGE_TEXT = '请把这张原留言带到近桌核对，再放回远桌；今晚我会亲自合上西窗。';
const EXTERNAL_ID = 'audience.s3.external-identity', IMAGE_ID = 'audience.s3.woven-image';
const CASES = [
  { id: 'two-desks', title: '相邻两桌：同一姓名与共通心思', story: '两位新的知情成年人艾丽丝（DWV3-IRIS，36岁）与欧文（DWV3-OWEN，44岁）分别在远桌与近桌。两桌之间只有三米开放普通通道。本人与一具有限外部身份只交流本人姓名及眼前已知的桌间路线，不读取两人的隐私。（原创G）', facts: ['每案分别询问两人本次同意；任何人可停止本次实践，旧米拉或集会同意无效。', '本人在近桌与欧文交谈，身份须实际走三米到远桌与艾丽丝交谈；思想共通并不提供未知内容。', '普通方式由本人依次沿原路走到两桌，交流后身体须亲自返回。'], result: '同一姓名及本人已知路线已分别交流，单一外部身份已消解，本人实际返回近桌。' },
  { id: 'original-message', title: '同一原留言：读到之后才知道', story: 'DWV3-MESSAGE是艾丽丝拥有、放在远桌的唯一原纸。本次同意明确包含读取、本人取用及归还；系统不会提前公开纸上内容，身份不能复制或搬走它。（原创G）', facts: ['能力方式由实际走到远桌的身份读同一原纸；只有这一实际读取才通过共通心思成为本人的已知内容。', '本人仍须沿三米路取原纸、带回近桌核对，再走到远桌归还同一纸，最后回近桌。', '普通本人实地读取与递送不需要再次能力骰；没有第二张纸或独立装备库。'], result: '本人已将唯一原留言带到近桌实际核对，随后亲自放回远桌，身体已沿原路返回。' },
  { id: 'woven-bell', title: '原铜铃与可停止的有限梦像', story: '近桌只有一个原铜铃DWV3-BELL。欧文知情允许一次可随时停止的有限梦像，并保留辨认的权利；艾丽丝只作知情旁观，不受到伤害或施术。（原创G）', facts: ['先实际观察原铃两道环纹；梦像只使用本人刚见的原物，不召来未知存在或独立高位灵魂。', '梦像意志16、6灵性；相信时欧文真实付2精神，明确辨认后不再相信，不自动退款或受控。', '明确停止梦像，再普通核对原铃仍只有一个；失败也可普通比较，不重骰、不生成实体铃。'], result: '梦像已明确停止，原铃仍是近桌唯一原铜铃；相信、辨认及实际精神代价均保留。' },
] as const;
export const DREAM_WEAVER_LIFE_ENVIRONMENT = '有限原著能力边界，人物、原场、数值与反馈均原创G。观察、准备、实施各1行动，准备须至少余2行动；子步骤与普通退出0行动但真实耗时。1具外部身份：5灵性、本人2精神、意志16、60秒、6米，同一姓名与共通思想，没有第二份资源池或装备。梦像6灵性、意志16；可相信或识破，不能变真钱或实体。每报告扮演25、三案反思25；仅实际成功对应新能力掌握8。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 3;
const freshCase = (): DreamWeaverCaseState => ({ status: 'AVAILABLE', observedWeek: null, method: null, result: 'NONE', contactOpen: false, verified: false, returned: false, closes: 0, withdrawals: 0, attempts: [] });
const freshAttempt = (week: number, method: 'ABILITY' | 'ORDINARY'): DreamWeaverAttempt => ({ week, method, consentWeeks: { 'DWV3-IRIS': null, 'DWV3-OWEN': null }, revokedPersonIds: [], performed: false, closed: false, result: 'NONE', elapsedSeconds: 0, ownerTravelMetres: 0, identityTravelMetres: 0, identityAttempted: false, identityCreated: false, identityId: null, identityCreatedAtSeconds: null, identityEnd: 'NONE', identityLastNode: 'NEAR', spiritualitySpent: 0, ownerMindSpent: 0, talkedToOwen: false, irisTalkBy: 'NONE', messageReadBy: 'NONE', messageTaken: false, messageChecked: false, messageReturned: false, imageAttempted: false, imageCreated: false, imageBelieved: false, imageRecognized: false, imageStopped: false, owenMindSpent: 0, bellChecked: false });
export function createDreamWeaverLifeState(): DreamWeaverLifeState {
  return { practice: { sceneId: 'DWV3-READING-ROOM', activeCase: null, ownerNode: 'NEAR', participants: { 'DWV3-IRIS': { id: 'DWV3-IRIS', name: '艾丽丝', age: 36, node: 'FAR', health: 100, mind: 100 }, 'DWV3-OWEN': { id: 'DWV3-OWEN', name: '欧文', age: 44, node: 'NEAR', health: 100, mind: 100 } }, identity: null, image: null, message: { id: 'DWV3-MESSAGE', ownerId: 'DWV3-IRIS', holder: 'FAR_DESK' }, knownMessage: null, bell: { id: 'DWV3-BELL', holder: 'NEAR_DESK', marking: 'ONE_BRASS_BELL_TWO_RINGS' } }, cases: { 'two-desks': freshCase(), 'original-message': freshCase(), 'woven-bell': freshCase() }, reflected: false };
}
const selectedCase = (s: SliceState): DreamWeaverCaseId | null => s.dreamWeaver.life.practice.activeCase ?? DREAM_WEAVER_CASE_IDS.find(id => s.dreamWeaver.life.cases[id].status === 'PREPARED') ?? null;
const lastAttempt = (s: SliceState, id = selectedCase(s)): DreamWeaverAttempt | null => id ? s.dreamWeaver.life.cases[id].attempts.at(-1) ?? null : null;
const consented = (a: DreamWeaverAttempt | null, id: DreamWeaverPersonId, week: number): boolean => !!a && !a.closed && a.consentWeeks[id] === week && !a.revokedPersonIds.includes(id);
const allConsent = (s: SliceState, a: DreamWeaverAttempt | null) => DREAM_WEAVER_PERSON_IDS.every(id => consented(a, id, s.week));
const physicallyReturned = (s: SliceState) => { const p = s.dreamWeaver.life.practice; return p.ownerNode === 'NEAR' && p.identity === null && p.image === null && p.message.holder === 'FAR_DESK'; };
export function hasDreamWeaverLifeLock(s: SliceState): boolean { const l = s.dreamWeaver?.life; return !!l && (selectedCase(s) !== null || !physicallyReturned(s)); }
export const dreamWeaverInside = hasDreamWeaverLifeLock;
export function validateDreamWeaverActivityCommand(v: unknown): v is DreamWeaverActivityCommand {
  if (!record(v)) return false;
  if (['CREATE_IDENTITY', 'REJOIN_IDENTITY', 'WAIT_IDENTITY', 'TAKE_MESSAGE', 'CHECK_MESSAGE', 'RETURN_MESSAGE', 'WOVEN_IMAGE', 'BELIEVE_IMAGE', 'RECOGNIZE_IMAGE', 'STOP_IMAGE', 'CHECK_BELL', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (['CONSENT', 'REVOKE_CONSENT'].includes(String(v.type))) return shape(v, ['type', 'personId']) && DREAM_WEAVER_PERSON_IDS.includes(v.personId as DreamWeaverPersonId);
  if (v.type === 'MOVE') return shape(v, ['type', 'actor', 'to']) && ['OWNER', 'IDENTITY'].includes(String(v.actor)) && ['NEAR', 'FAR'].includes(String(v.to));
  if (v.type === 'TALK') return shape(v, ['type', 'actor', 'personId']) && ['OWNER', 'IDENTITY'].includes(String(v.actor)) && DREAM_WEAVER_PERSON_IDS.includes(v.personId as DreamWeaverPersonId);
  if (v.type === 'READ_MESSAGE') return shape(v, ['type', 'actor']) && ['OWNER', 'IDENTITY'].includes(String(v.actor));
  if (!DREAM_WEAVER_CASE_IDS.includes(v.caseId as DreamWeaverCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'VERIFY', 'CLOSE', 'WITHDRAW', 'REPORT'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isDreamWeaverActivity = validateDreamWeaverActivityCommand;
export function blockDreamWeaverActivity(s: SliceState, c: DreamWeaverActivityCommand): string | null {
  if (!validateDreamWeaverActivityCommand(c)) return '织梦人生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE') return '本人须仍活着并已成为织梦人。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件或战斗，并实际回贝克兰德原阅览室。';
  if (s.dreamWeaver.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.dreamWeaver.encounter.status) || hasManipulatorRitualLock(s) || manipulatorInside(s) || ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status)) return '先收束晋升准备、旧原场或当前遭遇。';
  const l = s.dreamWeaver.life, p = l.practice, id = selectedCase(s), r = 'caseId' in c ? l.cases[c.caseId] : id ? l.cases[id] : null, a = lastAttempt(s, 'caseId' in c ? c.caseId : id);
  if (c.type === 'WITHDRAW' && r?.status === 'PREPARED') return null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') return !r?.contactOpen || p.activeCase !== c.caseId ? '没有本项尚未收束的原现场。' : !physicallyReturned(s) ? '先停梦像、消解身份、本人归还同纸并沿普通路回近桌；结束不会传送人或物。' : r.result !== 'NONE' && !r.verified ? '实际结果须在能力结束后明确复核。' : null;
  if (c.type === 'REJOIN_IDENTITY' || c.type === 'WAIT_IDENTITY') return p.identity ? null : '没有本次尚在场的单一外部身份。';
  if (c.type === 'STOP_IMAGE') return p.image ? null : '没有本次尚未停止的梦像。';
  if (c.type === 'REVOKE_CONSENT') return consented(a, c.personId, s.week) ? null : '这位原人当前没有尚可撤回的本次同意。';
  if (c.type === 'MOVE') {
    if (!p.activeCase || !a?.performed || a.closed || r?.verified) return '先实际实施本项尚未完成复核的现场。';
    const node = c.actor === 'OWNER' ? p.ownerNode : p.identity?.node;
    if (!node || node === c.to) return '须有此实际行动者且目的桌不同于所在桌。';
    if (c.actor === 'IDENTITY' && (!allConsent(s, a) || p.identity!.remainingSeconds < 3)) return '身份移动须本次同意仍有效且至少余三秒；可直接消解，原身体不会移动。';
    return null;
  }
  if (c.type === 'RETURN_MESSAGE') return p.activeCase === 'original-message' && p.ownerNode === 'FAR' && p.message.holder === 'OWNER' ? null : '本人须持同一原纸实际到远桌，才能亲手归还。';
  if (c.type === 'VERIFY') return !r?.contactOpen || p.activeCase !== c.caseId || r.result === 'NONE' || r.verified ? '须本项当前尚未复核的真实结果。' : !physicallyReturned(s) ? '先结束能力、归还原纸并让本人走回近桌。' : null;
  if (c.type === 'CONSENT') return !a || r?.status !== 'PREPARED' || a.week !== s.week || a.closed || consented(a, c.personId, s.week) || a.revokedPersonIds.includes(c.personId) ? '仅在本次准备后分别询问两位新成年人的当前同意；拒绝或撤回后请结束本次准备。' : null;
  const substep = ['CREATE_IDENTITY', 'TALK', 'READ_MESSAGE', 'TAKE_MESSAGE', 'CHECK_MESSAGE', 'WOVEN_IMAGE', 'BELIEVE_IMAGE', 'RECOGNIZE_IMAGE', 'CHECK_BELL'].includes(c.type);
  if (substep) {
    if (!p.activeCase || !a?.performed || a.closed || !r?.contactOpen || r.verified) return '先支付实施行动，再做原场实际子步骤。';
    if (!allConsent(s, a)) return '两位新原人的本次同意须仍有效；可普通走返、还纸与停止能力。';
    if (c.type === 'CREATE_IDENTITY') return id === 'woven-bell' || a.method !== 'ABILITY' || a.identityAttempted || p.identity || p.ownerNode !== 'NEAR' ? '本案能力方式只可尝试创建一具；失败可本人普通完成，不可重骰。' : s.spirituality < 5 || s.mind <= 2 ? '需要5灵性与本人2精神，并保留清醒；资源不足可普通完成。' : null;
    if (c.type === 'TALK') {
      if (id !== 'two-desks') return '本次两桌交流才使用此步骤。';
      const node = c.actor === 'OWNER' ? p.ownerNode : p.identity?.node;
      if (node !== p.participants[c.personId].node) return '这位行动者须实际走到原人所在桌才能交谈。';
      if (c.actor === 'IDENTITY' && p.identity!.remainingSeconds < 2) return '身份余时不足两秒；可消解后本人普通交流。';
      return c.personId === 'DWV3-OWEN' ? c.actor !== 'OWNER' || a.talkedToOwen ? '由近桌本人亲自与欧文交流一次。' : null : a.irisTalkBy !== 'NONE' ? '已经与本次艾丽丝完成有限交流。' : null;
    }
    if (c.type === 'READ_MESSAGE') return id !== 'original-message' || a.messageReadBy !== 'NONE' || p.message.holder !== 'FAR_DESK' || (c.actor === 'OWNER' ? p.ownerNode : p.identity?.node) !== 'FAR' ? '须在本项由实际在远桌的行动者读取唯一原纸一次。' : c.actor === 'IDENTITY' && p.identity!.remainingSeconds < 3 ? '身份余时不足三秒；本人可普通走到远桌读取。' : null;
    if (c.type === 'TAKE_MESSAGE') return id === 'original-message' && p.ownerNode === 'FAR' && p.message.holder === 'FAR_DESK' && a.messageReadBy !== 'NONE' && !a.messageTaken ? null : '先实际读取，再由本人到远桌取同一原纸；身份不能搬物。';
    if (c.type === 'CHECK_MESSAGE') return id === 'original-message' && p.ownerNode === 'NEAR' && p.message.holder === 'OWNER' && a.messageTaken && !a.messageChecked ? null : '须本人将同一原纸带回近桌，才能与已读内容核对。';
    if (c.type === 'WOVEN_IMAGE') return id !== 'woven-bell' || a.method !== 'ABILITY' || a.imageAttempted || p.ownerNode !== 'NEAR' ? '本项近桌能力准备只可尝试一次原铃梦像。' : s.spirituality < 6 || s.mind <= 0 ? '需6灵性与清醒；资源不足可普通核对原铃。' : p.participants['DWV3-OWEN'].mind <= 2 ? '欧文当前精神不足安全演示；只可普通核对。' : null;
    if (c.type === 'BELIEVE_IMAGE') return p.image && !a.imageBelieved && !a.imageRecognized && p.ownerNode === 'NEAR' && p.participants['DWV3-OWEN'].mind > 2 ? null : '须当前真实成功且欧文尚未辨认的梦像，保持近桌知情演示。';
    if (c.type === 'RECOGNIZE_IMAGE') return p.image && a.imageBelieved && !a.imageRecognized ? null : '先记录这次相信的有限后果，再让欧文明确认出梦像。';
    if (c.type === 'CHECK_BELL') return id === 'woven-bell' && p.ownerNode === 'NEAR' && !p.image && !a.bellChecked ? null : '先停梦像，再由近桌本人普通核对唯一原铃。';
  }
  if (p.activeCase) return '先真实收束当前生活现场。';
  if (id && (!('caseId' in c) || c.caseId !== id)) return '先实施或取消当前准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已在场仍可0行动普通退出。';
  if (s.actionsRemaining < 1) return '需要1行动；现场实际收束子步骤仍可0行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已完成三案反思。' : DREAM_WEAVER_CASE_IDS.some(key => l.cases[key].status !== 'RESOLVED') ? '先报告三项真实经历。' : null;
  if (!r || !('caseId' in c)) return '操作与本项当前状态不符。';
  if (c.type === 'OBSERVE') { const previous = DREAM_WEAVER_CASE_IDS[DREAM_WEAVER_CASE_IDS.indexOf(c.caseId) - 1]; return r.status !== 'AVAILABLE' ? '已经实际观察本场。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先完成上一项实际报告。' : null; }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原场。' : s.actionsRemaining < 2 ? '准备须至少余2行动，为随后实施保留1行动。' : r.attempts.some(attempt => attempt.performed && attempt.week === s.week) ? '本周已实际实施；失败或撤回保留，下一真实周才可重开。' : null;
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' || !a || a.closed ? '先准备本项原场。' : !allConsent(s, a) || a.week !== s.week ? '先分别取得艾丽丝与欧文在本周此案的当前同意。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.verified && r.returned ? null : '先实际完成、复核、还原原物与关闭现场。';
  return '操作与本项当前状态不符。';
}
function endIdentity(s: SliceState, a: DreamWeaverAttempt, end: 'REJOINED' | 'EXPIRED'): void { const p = s.dreamWeaver.life.practice; if (p.identity) { a.identityLastNode = p.identity.node; a.identityEnd = end; p.identity = null; } }
function elapse(s: SliceState, a: DreamWeaverAttempt, seconds: number): void { a.elapsedSeconds += seconds; const identity = s.dreamWeaver.life.practice.identity; if (identity) { identity.remainingSeconds = Math.max(0, identity.remainingSeconds - seconds); if (identity.remainingSeconds === 0) endIdentity(s, a, 'EXPIRED'); } }
function updateResult(s: SliceState, a: DreamWeaverAttempt): void {
  const p = s.dreamWeaver.life.practice, id = p.activeCase!; let result: DreamWeaverAttempt['result'] = 'NONE';
  if (id === 'two-desks' && a.talkedToOwen && a.irisTalkBy !== 'NONE') result = a.irisTalkBy === 'IDENTITY' ? 'ABILITY' : 'ORDINARY';
  if (id === 'original-message' && a.messageChecked && a.messageReturned) result = a.messageReadBy === 'IDENTITY' ? 'ABILITY' : 'ORDINARY';
  if (id === 'woven-bell' && a.bellChecked) result = a.imageBelieved && a.imageRecognized && a.imageStopped ? 'ABILITY' : 'ORDINARY';
  a.result = result; s.dreamWeaver.life.cases[id].result = result;
}
export function applyDreamWeaverActivity(s: SliceState, c: DreamWeaverActivityCommand, ctx: SeerContext): void {
  const reason = blockDreamWeaverActivity(s, c); if (reason) throw new Error(reason);
  const l = s.dreamWeaver.life, p = l.practice, id = selectedCase(s), r = 'caseId' in c ? l.cases[c.caseId] : id ? l.cases[id] : null, a = lastAttempt(s, 'caseId' in c ? c.caseId : id);
  if (c.type === 'CONSENT') { a!.consentWeeks[c.personId] = s.week; ctx.note('本次新成年人的具体同意', `${p.participants[c.personId].name}明确知情同意本案有限交流${id === 'original-message' ? '、读取和由本人取还同一原纸' : id === 'woven-bell' ? '、可停止的原铃演示；只有欧文承担相信后的2精神' : ''}，保留随时退出权；没有沿用旧人物授权。`); return; }
  if (c.type === 'REVOKE_CONSENT') { a!.revokedPersonIds.push(c.personId); ctx.note('当前同意已明确撤回', '本次不再开始交流、读取或能力演示；仍可停止梦像、消解身份、本人沿普通路归还原纸与返回。'); return; }
  if (c.type === 'REJOIN_IDENTITY' || c.type === 'WAIT_IDENTITY') { const seconds = c.type === 'WAIT_IDENTITY' ? p.identity!.remainingSeconds : 1; if (c.type === 'REJOIN_IDENTITY') endIdentity(s, a!, 'REJOINED'); elapse(s, a!, seconds); ctx.note(c.type === 'WAIT_IDENTITY' ? '单一身份真实到期' : '明确消解单一外部身份', `本人仍在${p.ownerNode === 'FAR' ? '远桌' : '近桌'}；形象结束不传送原身体、不搬原纸、不返还灵性或精神。`); return; }
  if (c.type === 'STOP_IMAGE') { p.image = null; a!.imageStopped = true; elapse(s, a!, 1); updateResult(s, a!); ctx.note('明确停止有限原铃梦像', '欧文的实际精神消耗保留，形象不再施加后果；实体原铃仍只有近桌的那一个。'); return; }
  if (c.type === 'MOVE') { if (c.actor === 'OWNER') { p.ownerNode = c.to; a!.ownerTravelMetres += 3; } else { p.identity!.node = c.to; a!.identityLastNode = c.to; a!.identityTravelMetres += 3; } elapse(s, a!, 3); ctx.note('沿三米开放普通通道移动', `${c.actor === 'OWNER' ? '本人原身体' : '本次单一身份'}实际到${c.to === 'FAR' ? '远桌' : '近桌'}，耗3秒；另一行动者没有被移动。`); return; }
  if (c.type === 'CREATE_IDENTITY') { s.spirituality -= 5; s.mind -= 2; a!.spiritualitySpent += 5; a!.ownerMindSpent += 2; a!.identityAttempted = true; const ok = success(ctx.check('will', 16).tier); elapse(s, a!, 2); if (ok) { const identityId = `DWV3-IDENTITY-${id}-${r!.attempts.length}`; p.identity = { id: identityId, originalName: s.character.name, source: 'OWNER_SHARED_THOUGHT', node: p.ownerNode, remainingSeconds: 60, limitMetres: 6 }; a!.identityCreated = true; a!.identityId = identityId; a!.identityCreatedAtSeconds = a!.elapsedSeconds; a!.identityLastNode = p.ownerNode; } ctx.note('一次有限外部身份尝试', ok ? '实付5灵性与本人2精神，形成1具60秒/6米G外部身份；同一姓名与共通思想，不产生第二资源池、装备或独立高位灵魂。尚须实际移动、交流或读取。' : '实付5灵性与本人2精神后失败，没有身份或掌握；本次不能重复能力骰，可由本人普通走返完成。'); return; }
  if (c.type === 'TALK') { if (c.personId === 'DWV3-OWEN') a!.talkedToOwen = true; else a!.irisTalkBy = c.actor; elapse(s, a!, 2); updateResult(s, a!); ctx.note('在实际所在桌有限交谈', `${c.actor === 'OWNER' ? '本人' : '外部身份'}以原姓名${s.character.name}与${p.participants[c.personId].name}谈论刚观察的三米普通通道；只使用已知内容，没有隐私读取或系统真话。`); return; }
  if (c.type === 'READ_MESSAGE') { a!.messageReadBy = c.actor; p.knownMessage = { sourceId: 'DWV3-MESSAGE', text: MESSAGE_TEXT, readWeek: s.week, reader: c.actor }; elapse(s, a!, 3); ctx.note('实际读取同一原留言', `${c.actor === 'IDENTITY' ? '远桌身份读取后，共通心思才使本人知道：' : '本人到远桌实读：'}${MESSAGE_TEXT} 原纸仍在远桌，没有复制或自动递送。`); return; }
  if (c.type === 'TAKE_MESSAGE') { p.message.holder = 'OWNER'; a!.messageTaken = true; elapse(s, a!, 1); ctx.note('本人亲手取同一原纸', 'DWV3-MESSAGE现在由远桌的原身体持有，只有一张。'); return; }
  if (c.type === 'CHECK_MESSAGE') { a!.messageChecked = true; elapse(s, a!, 2); ctx.note('近桌核对带回的原留言', '本人对照手中唯一原纸与实际读到的内容；仍须亲自走回远桌归还。'); return; }
  if (c.type === 'RETURN_MESSAGE') { p.message.holder = 'FAR_DESK'; a!.messageReturned = true; elapse(s, a!, 1); updateResult(s, a!); ctx.note('远桌归还同一原纸', '本人将DWV3-MESSAGE放回艾丽丝的原桌；原身体仍在远桌，退出还须亲自走回近桌。'); return; }
  if (c.type === 'WOVEN_IMAGE') { s.spirituality -= 6; a!.spiritualitySpent += 6; a!.imageAttempted = true; const ok = success(ctx.check('will', 16).tier); elapse(s, a!, 2); if (ok) { a!.imageCreated = true; p.image = { id: 'DWV3-BELL-IMAGE', source: 'KNOWN_ORIGINAL_BELL', targetId: 'DWV3-OWEN', believed: false }; } ctx.note('一次有限原铃梦像尝试', ok ? '6灵性已支付，形成来自亲眼观察原铃的有限形象；欧文尚未相信，无实体第二铃。' : '6灵性已支付但梦像失败；无形象与掌握，可直接普通核对原铃，不重骰。'); return; }
  if (c.type === 'BELIEVE_IMAGE') { a!.imageBelieved = true; a!.owenMindSpent = 2; p.image!.believed = true; p.participants['DWV3-OWEN'].mind -= 2; elapse(s, a!, 2); ctx.note('欧文相信时的有限精神后果', '知情欧文短暂相信近真的铃影，实际精神−2（G）；身体未受伤，艾丽丝未施术，原铃没有增殖。'); return; }
  if (c.type === 'RECOGNIZE_IMAGE') { a!.imageRecognized = true; p.image!.believed = false; elapse(s, a!, 2); ctx.note('欧文明确认出有限梦像', '他对照先前看见的原铃认出形象，之后不再相信、不再受精神影响；已付2精神仍保留，须明确停像。'); return; }
  if (c.type === 'CHECK_BELL') { a!.bellChecked = true; elapse(s, a!, 2); updateResult(s, a!); ctx.note('亲眼核对唯一原铃', '近桌DWV3-BELL只有一个，两道环纹不变；无真钱、装备或新实体物。'); return; }
  if (c.type === 'VERIFY') { r!.verified = true; r!.returned = true; elapse(s, a!, 1); ctx.note('能力结束后的原场实际复核', CASES.find(entry => entry.id === c.caseId)!.result); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { a!.closed = true; if (r!.contactOpen) { r!.contactOpen = false; r!.closes++; r!.returned = true; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; p.activeCase = null; } else { r!.status = 'OBSERVED'; r!.method = null; } if (c.type === 'WITHDRAW') r!.withdrawals++; ctx.note('真实结束本次阅览室实践', '当前双方同意到此结束。所有已付费用、走过距离、能力失败和欧文精神后果均保留；下次须新同意。'); return; }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('dream-weaver-reflection'); ctx.note('反思同一自我、知识来源与有限形象', '三项报告后的反思，扮演+25（G）；交流的边界不等于全知、永恒分身、实体造物或强迫他人。'); return; }
  if (!('caseId' in c)) throw new Error('未知织梦人生活命令。');
  const entry = CASES.find(item => item.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(entry.title, entry.story + entry.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; r!.result = 'NONE'; r!.verified = false; r!.returned = false; r!.attempts.push(freshAttempt(s.week, c.method)); ctx.note('准备有限原场与普通退路', c.method === 'ABILITY' ? '本次准备有限能力方式，未施术；先分别询问两位新成年人，能力失败仍可普通完成。' : '本次准备由原身体依次实地读取、交谈或核对；先分别询问两位新成年人。'); return; }
  if (c.type === 'REPORT') { r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `dream-weaver-case:${c.caseId}`; s.seer.completedSources.push(source); if (r!.result === 'ABILITY') { const ability = c.caseId === 'woven-bell' ? IMAGE_ID : EXTERNAL_ID; s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); } ctx.note(entry.title, entry.result + (r!.result === 'ABILITY' ? '实际成功对应新能力掌握+8、扮演+25（G）。' : '普通结果扮演+25（G），不加能力掌握。')); return; }
  r!.status = 'ACTIVE'; r!.contactOpen = true; a!.performed = true; p.activeCase = c.caseId; ctx.note('实际实施本项原场', '已支付1行动；后续子步骤包含真实秒数、移动和必要资源，尚未创建身份、读取消息或产生梦像。即使行动归零，仍可普通还物与走返收束。');
}
export function dreamWeaverLifeActions(s: SliceState): DreamWeaverLifeAction[] {
  if (!active(s)) return [];
  const out: DreamWeaverLifeAction[] = [], l = s.dreamWeaver.life, p = l.practice;
  const add = (command: DreamWeaverActivityCommand, label: string, cost: string) => { const reason = blockDreamWeaverActivity(s, command); out.push({ id: `dream-weaver-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}${'actor' in command ? '-' + command.actor.toLowerCase() : ''}${'personId' in command ? '-' + command.personId.toLowerCase() : ''}${'to' in command ? '-' + command.to.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const entry of CASES) {
    const r = l.cases[entry.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: entry.id }, `观察：${entry.title}`, '1行动');
    if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: entry.id, method: 'ABILITY' }, '准备有限能力方式', '1行动 · 准备前须余2行动'); add({ type: 'PREPARE', caseId: entry.id, method: 'ORDINARY' }, '准备原身体普通方式', '1行动 · 准备前须余2行动'); }
    if (r.status === 'PREPARED') {
      for (const personId of DREAM_WEAVER_PERSON_IDS) { add({ type: 'CONSENT', personId }, `询问${p.participants[personId].name}本次具体同意`, '0行动 · 可拒绝或撤回'); add({ type: 'REVOKE_CONSENT', personId }, `${p.participants[personId].name}撤回本次同意`, '0行动'); }
      add({ type: 'PERFORM', caseId: entry.id }, '实际实施本次原场', '1行动 · 此后0行动仍可普通收束'); add({ type: 'WITHDRAW', caseId: entry.id }, '取消本次尚未实施的准备', '0行动 · 已付行动不退');
    }
    if (r.contactOpen) {
      const a = r.attempts.at(-1)!;
      for (const personId of DREAM_WEAVER_PERSON_IDS) add({ type: 'REVOKE_CONSENT', personId }, `${p.participants[personId].name}停止本次同意`, '0行动 · 保留普通退路');
      for (const to of ['FAR', 'NEAR'] as const) add({ type: 'MOVE', actor: 'OWNER', to }, `本人沿普通路走到${to === 'FAR' ? '远桌' : '近桌'}`, '0行动 · 3米/3秒 · 原纸随本人');
      if (entry.id !== 'woven-bell' && r.method === 'ABILITY') {
        if (!a.identityAttempted) add({ type: 'CREATE_IDENTITY' }, '从本人形成一具有限外部身份', '0行动 · 5灵性＋本人2精神 · 意志16');
        if (p.identity) { for (const to of ['FAR', 'NEAR'] as const) add({ type: 'MOVE', actor: 'IDENTITY', to }, `身份沿普通路走到${to === 'FAR' ? '远桌' : '近桌'}`, '0行动 · 3米/3秒 · 不搬原物'); add({ type: 'REJOIN_IDENTITY' }, '明确消解并回归单一自我', '0行动 · 1秒 · 不移动原身体'); add({ type: 'WAIT_IDENTITY' }, '等本次有限身份实际到期', '0行动 · 消耗全部剩余秒数'); }
      }
      if (entry.id === 'two-desks') { add({ type: 'TALK', actor: 'OWNER', personId: 'DWV3-OWEN' }, '近桌本人向欧文说已知内容', '0行动 · 2秒'); add({ type: 'TALK', actor: 'OWNER', personId: 'DWV3-IRIS' }, '远桌本人向艾丽丝普通交谈', '0行动 · 2秒 · 不加能力掌握'); if (p.identity) add({ type: 'TALK', actor: 'IDENTITY', personId: 'DWV3-IRIS' }, '远桌身份向艾丽丝说共通已知内容', '0行动 · 2秒'); }
      if (entry.id === 'original-message') { add({ type: 'READ_MESSAGE', actor: 'OWNER' }, '本人到远桌读取原留言', '0行动 · 3秒'); if (p.identity) add({ type: 'READ_MESSAGE', actor: 'IDENTITY' }, '远桌身份实读原留言并共通心思', '0行动 · 3秒 · 不移动原纸'); add({ type: 'TAKE_MESSAGE' }, '远桌本人亲手取同一原纸', '0行动 · 1秒'); add({ type: 'CHECK_MESSAGE' }, '近桌本人核对带回的原纸', '0行动 · 2秒'); add({ type: 'RETURN_MESSAGE' }, '远桌本人亲手归还同一原纸', '0行动 · 1秒'); }
      if (entry.id === 'woven-bell') { if (r.method === 'ABILITY' && !a.imageAttempted) add({ type: 'WOVEN_IMAGE' }, '编织亲眼见过的有限原铃梦像', '0行动 · 6灵性 · 意志16'); if (p.image) { add({ type: 'BELIEVE_IMAGE' }, '记录欧文相信时的有限精神后果', '0行动 · 2秒 · 欧文−2精神'); add({ type: 'RECOGNIZE_IMAGE' }, '欧文明确认出有限梦像', '0行动 · 2秒 · 不再相信'); add({ type: 'STOP_IMAGE' }, '明确停止本次原铃梦像', '0行动 · 1秒'); } add({ type: 'CHECK_BELL' }, '本人普通核对唯一原铜铃', '0行动 · 2秒'); }
      add({ type: 'VERIFY', caseId: entry.id }, '能力结束后复核已真实归还的原场', '0行动 · 1秒'); add({ type: 'CLOSE', caseId: entry.id }, '关闭已经真实收束的原场', '0行动 · 不代替移动或还物'); add({ type: 'WITHDRAW', caseId: entry.id }, '结束本次尝试并保留实际后果', '0行动 · 先普通返回与还原');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: entry.id }, '报告本次真实结果', '1行动 · 扮演25');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思同一自我、知识来源与有限梦像', '1行动 · 三项报告后扮演25');
  return out;
}
export function projectDreamWeaverLife(s: SliceState): DreamWeaverLifeProjection {
  const l = s.dreamWeaver.life;
  if (!active(s) && !(s.progression.pathwayId==='audience'&&s.progression.sequence===2)) return { title: '织梦人生活', source: '尚未进入织梦人原场。', environment: '', insideCase: false, reflected: false, practice: null, currentAttempt: null, currentConsents: [], cases: [] };
  const a = lastAttempt(s);
  return { title: '织梦人生活：单一外部身份、原消息与有限梦像', source: '能力边界依据原著；人物、场景、数值与具体反馈均原创G。', environment: DREAM_WEAVER_LIFE_ENVIRONMENT, insideCase: hasDreamWeaverLifeLock(s), reflected: l.reflected, practice: structuredClone(l.practice), currentAttempt: a ? structuredClone(a) : null, currentConsents: DREAM_WEAVER_PERSON_IDS.map(id => ({ id, consented: consented(a, id, s.week) })), cases: CASES.map(entry => { const r = l.cases[entry.id]; return { id: entry.id, title: entry.title, story: entry.story, observations: r.status === 'AVAILABLE' ? [] : [...entry.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? '本次有限能力方式；须分别取得两位新原人的当前同意，能力失败可普通完成。' : '本次由原身体普通完成，仍需本次双方同意。' : null, result: r.result !== 'NONE' ? r.contactOpen ? '已有实际结果；仍须结束能力、本人还物、走返并复核。' : entry.result : r.attempts.some(v => v.performed) ? '尚无完成结果；所有能力失败与已付代价仍在。' : null, status: r.status, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes, attempts: structuredClone(r.attempts) }; }) };
}
export function validateDreamWeaverLifeState(s: SliceState): boolean {
  const l = s.dreamWeaver?.life, initial = createDreamWeaverLifeState();
  if (!record(l) || !shape(l, ['practice', 'cases', 'reflected']) || typeof l.reflected !== 'boolean' || !record(l.practice) || !shape(l.practice, Object.keys(initial.practice)) || !record(l.cases) || !shape(l.cases, DREAM_WEAVER_CASE_IDS)) return false;
  const p = l.practice;
  if (p.sceneId !== initial.practice.sceneId || ![null, ...DREAM_WEAVER_CASE_IDS].includes(p.activeCase) || !['NEAR', 'FAR'].includes(p.ownerNode) || !record(p.participants) || !shape(p.participants, DREAM_WEAVER_PERSON_IDS)) return false;
  for (const id of DREAM_WEAVER_PERSON_IDS) { const person = p.participants[id], fresh = initial.practice.participants[id]; if (!record(person) || !shape(person, Object.keys(fresh)) || person.id !== id || person.name !== fresh.name || person.age !== fresh.age || person.node !== fresh.node || person.health !== 100 || !integer(person.mind, 1, 100)) return false; }
  if (p.participants['DWV3-IRIS'].mind !== 100 || stableStringify(p.bell) !== stableStringify(initial.practice.bell) || !record(p.message) || !shape(p.message, ['id', 'ownerId', 'holder']) || p.message.id !== 'DWV3-MESSAGE' || p.message.ownerId !== 'DWV3-IRIS' || !['FAR_DESK', 'OWNER'].includes(p.message.holder)) return false;
  if (p.knownMessage !== null && (!record(p.knownMessage) || !shape(p.knownMessage, ['sourceId', 'text', 'readWeek', 'reader']) || p.knownMessage.sourceId !== 'DWV3-MESSAGE' || p.knownMessage.text !== MESSAGE_TEXT || !integer(p.knownMessage.readWeek, s.dreamWeaver.promotionWeek ?? 0, s.week) || !['OWNER', 'IDENTITY'].includes(p.knownMessage.reader))) return false;
  let open = 0, prepared = 0, resolved = 0, owenSpent = 0;
  const reads: { week: number; reader: DreamWeaverActor }[] = [];
  for (const [index, id] of DREAM_WEAVER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || ![r.contactOpen, r.verified, r.returned].every(v => typeof v === 'boolean') || !integer(r.closes) || !integer(r.withdrawals) || !Array.isArray(r.attempts)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; }
    else if (!integer(r.observedWeek, s.dreamWeaver.promotionWeek ?? 0, s.week) || s.dreamWeaver.promotionWeek === null || index > 0 && l.cases[DREAM_WEAVER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    let closedPerformed = 0, previousWeek = r.observedWeek ?? 0;
    const performedWeeks = new Set<number>();
    for (const [attemptIndex, a] of r.attempts.entries()) {
      if (!record(a) || !shape(a, Object.keys(freshAttempt(0, 'ORDINARY'))) || !integer(a.week, previousWeek, s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(a.result) || !record(a.consentWeeks) || !shape(a.consentWeeks, DREAM_WEAVER_PERSON_IDS) || !Array.isArray(a.revokedPersonIds) || new Set(a.revokedPersonIds).size !== a.revokedPersonIds.length || a.revokedPersonIds.some(v => !DREAM_WEAVER_PERSON_IDS.includes(v))) return false;
      previousWeek = a.week;
      const bools = ['performed', 'closed', 'identityAttempted', 'identityCreated', 'talkedToOwen', 'messageTaken', 'messageChecked', 'messageReturned', 'imageAttempted', 'imageCreated', 'imageBelieved', 'imageRecognized', 'imageStopped', 'bellChecked'] as const;
      if (bools.some(key => typeof a[key] !== 'boolean') || ['elapsedSeconds', 'ownerTravelMetres', 'identityTravelMetres', 'spiritualitySpent', 'ownerMindSpent', 'owenMindSpent'].some(key => !integer(a[key as keyof DreamWeaverAttempt])) || a.ownerTravelMetres % 3 !== 0 || a.identityTravelMetres % 3 !== 0 || !['NONE', 'REJOINED', 'EXPIRED'].includes(a.identityEnd) || !['NEAR', 'FAR'].includes(a.identityLastNode) || !['NONE', 'OWNER', 'IDENTITY'].includes(a.irisTalkBy) || !['NONE', 'OWNER', 'IDENTITY'].includes(a.messageReadBy)) return false;
      for (const personId of DREAM_WEAVER_PERSON_IDS) if (a.consentWeeks[personId] !== null && a.consentWeeks[personId] !== a.week || a.revokedPersonIds.includes(personId) && a.consentWeeks[personId] !== a.week) return false;
      if (a.performed) { if (performedWeeks.has(a.week) || DREAM_WEAVER_PERSON_IDS.some(personId => a.consentWeeks[personId] !== a.week)) return false; performedWeeks.add(a.week); if (a.closed) closedPerformed++; }
      if (!a.performed && (a.result !== 'NONE' || a.elapsedSeconds !== 0 || a.ownerTravelMetres !== 0 || a.identityTravelMetres !== 0 || a.identityAttempted || a.talkedToOwen || a.irisTalkBy !== 'NONE' || a.messageReadBy !== 'NONE' || a.messageTaken || a.messageChecked || a.messageReturned || a.imageAttempted || a.bellChecked)) return false;
      if (!a.closed && (attemptIndex !== r.attempts.length - 1 || !['PREPARED', 'ACTIVE'].includes(r.status))) return false;
      if (a.identityAttempted && (id === 'woven-bell' || a.method !== 'ABILITY' || !a.performed) || a.imageAttempted && (id !== 'woven-bell' || a.method !== 'ABILITY' || !a.performed)) return false;
      if (a.spiritualitySpent !== (a.identityAttempted ? 5 : 0) + (a.imageAttempted ? 6 : 0) || a.ownerMindSpent !== (a.identityAttempted ? 2 : 0) || a.owenMindSpent !== (a.imageBelieved ? 2 : 0)) return false;
      if (a.identityCreated ? !a.identityAttempted || a.identityId !== `DWV3-IDENTITY-${id}-${attemptIndex + 1}` || !integer(a.identityCreatedAtSeconds, 2, a.elapsedSeconds) : a.identityId !== null || a.identityCreatedAtSeconds !== null || a.identityEnd !== 'NONE' || a.identityTravelMetres !== 0 || a.identityLastNode !== 'NEAR') return false;
      if (a.identityCreated && a.closed && a.identityEnd === 'NONE' || !a.identityCreated && (a.irisTalkBy === 'IDENTITY' || a.messageReadBy === 'IDENTITY')) return false;
      if (a.identityEnd === 'EXPIRED' && a.elapsedSeconds - (a.identityCreatedAtSeconds ?? 0) < 60 || a.identityTravelMetres > a.elapsedSeconds || a.ownerTravelMetres > a.elapsedSeconds) return false;
      if (a.identityCreated && a.identityLastNode !== (a.identityTravelMetres / 3 % 2 === 0 ? 'NEAR' : 'FAR')) return false;
      if (id !== 'two-desks' && (a.talkedToOwen || a.irisTalkBy !== 'NONE') || a.irisTalkBy === 'IDENTITY' && a.identityTravelMetres < 3 || a.irisTalkBy === 'OWNER' && a.ownerTravelMetres < 3) return false;
      if (id !== 'original-message' && (a.messageReadBy !== 'NONE' || a.messageTaken || a.messageChecked || a.messageReturned) || a.messageTaken && (a.messageReadBy === 'NONE' || a.ownerTravelMetres < 3) || a.messageChecked && (!a.messageTaken || a.ownerTravelMetres < 6) || a.messageReturned && !a.messageTaken || a.messageReadBy === 'IDENTITY' && a.identityTravelMetres < 3 || a.messageReadBy === 'OWNER' && a.ownerTravelMetres < 3) return false;
      if (a.messageReadBy !== 'NONE') reads.push({ week: a.week, reader: a.messageReadBy });
      if (a.imageCreated && !a.imageAttempted || a.imageBelieved && !a.imageCreated || a.imageRecognized && !a.imageBelieved || a.imageStopped && !a.imageCreated || a.closed && a.imageCreated && !a.imageStopped || id !== 'woven-bell' && (a.imageCreated || a.imageBelieved || a.imageRecognized || a.imageStopped || a.bellChecked)) return false;
      const expectedResult = id === 'two-desks' ? a.talkedToOwen && a.irisTalkBy !== 'NONE' ? a.irisTalkBy === 'IDENTITY' ? 'ABILITY' : 'ORDINARY' : 'NONE' : id === 'original-message' ? a.messageChecked && a.messageReturned ? a.messageReadBy === 'IDENTITY' ? 'ABILITY' : 'ORDINARY' : 'NONE' : a.bellChecked ? a.imageBelieved && a.imageRecognized && a.imageStopped ? 'ABILITY' : 'ORDINARY' : 'NONE';
      if (a.result !== expectedResult || a.result === 'ABILITY' && a.method !== 'ABILITY') return false;
      owenSpent += a.owenMindSpent;
    }
    if (r.closes !== closedPerformed || r.withdrawals > r.attempts.filter(a => a.closed).length) return false;
    const last = r.attempts.at(-1);
    if (r.status === 'PREPARED') { prepared++; if (!last || last.performed || last.closed || r.method !== last.method || r.contactOpen || r.result !== 'NONE' || r.verified || r.returned) return false; }
    if (r.contactOpen) { open++; if (r.status !== 'ACTIVE' || p.activeCase !== id || !last?.performed || last.closed || last.week !== s.week || !active(s) || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || s.dreamWeaver.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.dreamWeaver.encounter.status)) return false; }
    if ((r.status === 'ACTIVE') !== r.contactOpen || last && r.result !== last.result || r.verified && (r.result === 'NONE' || !r.returned) || ['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.verified || !r.returned || !last?.closed || r.result === 'NONE' || r.closes < 1)) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(source => source === `dream-weaver-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (open > 1 || prepared > 1 || open > 0 && prepared > 0 || (p.activeCase !== null) !== (open === 1) || p.participants['DWV3-OWEN'].mind !== 100 - owenSpent) return false;
  const latestRead = reads.at(-1);
  if (latestRead ? !p.knownMessage || p.knownMessage.readWeek !== latestRead.week || p.knownMessage.reader !== latestRead.reader : p.knownMessage !== null) return false;
  const a = lastAttempt(s);
  if (p.identity !== null) {
    const identity = p.identity;
    if (!record(identity) || !shape(identity, ['id', 'originalName', 'source', 'node', 'remainingSeconds', 'limitMetres']) || !a?.identityCreated || a.identityEnd !== 'NONE' || p.activeCase === null || identity.id !== a.identityId || identity.originalName !== s.character.name || identity.source !== 'OWNER_SHARED_THOUGHT' || identity.node !== a.identityLastNode || !integer(identity.remainingSeconds, 1, 60) || identity.remainingSeconds !== 60 - (a.elapsedSeconds - a.identityCreatedAtSeconds!) || identity.limitMetres !== 6) return false;
  } else if (a?.identityCreated && a.identityEnd === 'NONE') return false;
  if (p.image !== null) { if (!record(p.image) || !shape(p.image, ['id', 'source', 'targetId', 'believed']) || p.image.id !== 'DWV3-BELL-IMAGE' || p.image.source !== 'KNOWN_ORIGINAL_BELL' || p.image.targetId !== 'DWV3-OWEN' || typeof p.image.believed !== 'boolean' || p.activeCase !== 'woven-bell' || !a?.imageCreated || a.imageStopped || p.image.believed !== (a.imageBelieved && !a.imageRecognized)) return false; }
  else if (a?.imageCreated && !a.imageStopped) return false;
  if (p.message.holder === 'OWNER' ? p.activeCase !== 'original-message' || !a?.messageTaken || a.messageReturned : p.activeCase === 'original-message' && a?.messageTaken && !a.messageReturned) return false;
  if (p.activeCase && a && p.ownerNode !== (a.ownerTravelMetres / 3 % 2 === 0 ? 'NEAR' : 'FAR')) return false;
  if (!p.activeCase && !physicallyReturned(s) || p.activeCase && l.cases[p.activeCase].verified && !physicallyReturned(s) || l.reflected && resolved !== 3 || s.seer.completedSources.filter(source => source === 'dream-weaver-reflection').length !== (l.reflected ? 1 : 0)) return false;
  return s.dreamWeaver.promotionWeek !== null || stableStringify(l) === stableStringify(initial);
}
