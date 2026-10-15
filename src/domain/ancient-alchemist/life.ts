import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { hasDruidOpenPractice } from '../druid/encounter.js';
import { stableStringify } from '../canonical.js';
import type { AncientAlchemistAbilityId } from './types.js';

export const ANCIENT_ALCHEMIST_CASE_IDS = ['living-stem', 'living-fibre', 'honest-handover'] as const;
export type AncientAlchemistCaseId = typeof ANCIENT_ALCHEMIST_CASE_IDS[number];
type MaterialCaseId = Exclude<AncientAlchemistCaseId, 'honest-handover'>;
export type AncientAlchemistLifeAbilityId = AncientAlchemistAbilityId;
type Method = 'ABILITY' | 'ORDINARY';
export type AncientAlchemistActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: AncientAlchemistCaseId }
  | { type: 'PREPARE'; caseId: AncientAlchemistCaseId; method: Method }
  | { type: 'BUY_KIT'; caseId: MaterialCaseId; kitId: string }
  | { type: 'OBSERVE_RECOVERY'; caseId: 'living-stem' }
  | { type: 'TEST_MATRIX' | 'STOP_MATRIX'; caseId: 'living-fibre' }
  | { type: 'RETURN_SAMPLE'; caseId: MaterialCaseId }
  | { type: 'HAND_OVER'; caseId: 'honest-handover' }
  | { type: 'PREPARE_GUARD'; kitId: string }
  | { type: 'REQUEST_KITS' | 'RECEIVE_KITS' | 'REQUEST_GUARD_KITS' | 'RECEIVE_GUARD_KITS' | 'RETURN_GUARD' | 'REFLECT' };
export interface AncientAlchemistKit {
  id: string; suppliedWeek: number | null; caseId: MaterialCaseId | null;
  status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED'; acquiredWeek: number | null; consumedWeek: number | null;
}
export interface AncientAlchemistGuardKit {
  id: string; suppliedWeek: number | null; status: 'SUPPLIER' | 'CONSUMED'; consumedWeek: number | null; guardId: string | null;
}
export interface AncientAlchemistGuard {
  id: string; kitId: string; preparedWeek: number; holder: 'PLAYER' | 'GUIDE'; returnedWeek: number | null;
  segments: { id: string; spentWeek: number | null }[];
}
export interface AncientAlchemistMatrix {
  id: string; kitId: string; method: Method; success: boolean; holder: 'TRAY' | 'GUIDE_WASTE';
  state: 'ACTIVE' | 'INERT' | 'WOVEN_PAD'; remainingSeconds: number; elapsedSeconds: number;
  test: 'NONE' | 'BRACED_WEIGHT' | 'ORDINARY_SUPPORT' | 'NO_RESPONSE'; stopped: boolean;
}
export interface AncientAlchemistLifeAttempt {
  week: number; method: Method; success: boolean; actionCost: 1; spiritualityCost: 0 | 4;
  kitId: string | null; matrixId: string | null;
  outcome: 'STABILIZED' | 'BOUND' | 'UNRESOLVED' | 'REACTIVE_MATRIX' | 'WOVEN_PAD' | 'INERT_RESIDUE' | 'LIMITED_REPORT' | 'UNVERIFIED_REPORT';
  observationHours: 0 | 6; elapsedSeconds: number; distanceMetres: number;
  tested: boolean; stopped: boolean; returned: boolean; closed: boolean; handedOver: boolean;
  reportText: string | null;
}
export interface AncientAlchemistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED'; method: Method | null; contactOpen: boolean;
  preparations: number; withdrawals: number; closes: number; attempts: AncientAlchemistLifeAttempt[];
}
interface Supply { requestedWeek: number | null; deliveryWeeks: number[] }
export interface AncientAlchemistLifeState {
  cases: Record<AncientAlchemistCaseId, AncientAlchemistCaseState>; reflected: boolean;
  kits: AncientAlchemistKit[]; kitSupply: Supply;
  stem: { id: 'AA4-STEM-1'; potId: 'AA4-POT-1'; owner: 'GUIDE'; position: 'GUIDE_BENCH'; living: true; holder: 'GUIDE' | 'PLAYER'; damage: 'SHALLOW_UNRESOLVED' | 'STABILIZED' | 'SUPPORTED'; clips: 'GUIDE' | 'PLAYER'; observationHours: number; returns: number };
  tray: { id: 'AA4-TRAY-1'; position: 'GUIDE_BENCH'; weightId: 'AA4-WEIGHT-1'; weightKg: 0.5 };
  matrices: AncientAlchemistMatrix[];
  record: { id: 'AA4-RECORD-1'; holder: 'GUIDE' | 'PLAYER' | 'NORA'; revisions: string[]; handovers: number; distanceMetres: number };
  recipient: { id: 'AA4-NORA-BELL'; name: '诺拉·贝尔'; adult: true; willing: true; position: 'ORIGINAL_TABLE_2M' };
  guardKits: AncientAlchemistGuardKit[]; guardSupply: Supply; guards: AncientAlchemistGuard[];
  guardReturnDistanceMetres: number;
}
export interface AncientAlchemistLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AncientAlchemistActivityCommand }
export interface AncientAlchemistLifeProjection {
  cases: { id: AncientAlchemistCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: null | { stem: string; matrix: string; report: string; route: string; guard: string; kits: string; history: string[] };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const active = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 4;
const last = (r: AncientAlchemistCaseState) => r.attempts.at(-1);
const source = (id: AncientAlchemistCaseId) => `ancient-alchemist-case:${id}`;
const emptyCase = (): AncientAlchemistCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const cost = (id: AncientAlchemistCaseId, method: Method): 0 | 4 => id !== 'honest-handover' && method === 'ABILITY' ? 4 : 0;
const difficulty = (id: AncientAlchemistCaseId, method: Method) => cost(id, method) ? 18 : 10;
const kit = (n: number, suppliedWeek: number | null): AncientAlchemistKit => ({ id: `AA4-KIT-${n}`, suppliedWeek, caseId: null, status: 'SUPPLIER', acquiredWeek: null, consumedWeek: null });
const guardKit = (n: number, suppliedWeek: number | null): AncientAlchemistGuardKit => ({ id: `AA4-GUARD-KIT-${n}`, suppliedWeek, status: 'SUPPLIER', consumedWeek: null, guardId: null });
const heldKit = (s: SliceState, id: AncientAlchemistCaseId) => s.ancientAlchemist.life.kits.find(k => k.status === 'PLAYER' && k.caseId === id);
const originalMatrix = (s: SliceState, a?: AncientAlchemistLifeAttempt) => s.ancientAlchemist.life.matrices.find(m => m.id === a?.matrixId);
const outcome = (id: AncientAlchemistCaseId, method: Method, ok: boolean): AncientAlchemistLifeAttempt['outcome'] => id === 'living-stem'
  ? !ok ? 'UNRESOLVED' : method === 'ABILITY' ? 'STABILIZED' : 'BOUND'
  : id === 'living-fibre' ? !ok ? 'INERT_RESIDUE' : method === 'ABILITY' ? 'REACTIVE_MATRIX' : 'WOVEN_PAD'
    : ok ? 'LIMITED_REPORT' : 'UNVERIFIED_REPORT';
const reportable = (id: AncientAlchemistCaseId, a: AncientAlchemistLifeAttempt) => a.success && a.returned && (id === 'living-stem' ? a.observationHours === 6 : id === 'living-fibre' ? a.tested && a.stopped : a.handedOver);
const CASES = [
  { id: 'living-stem', title: '同一活植浅损的有限稳定', story: '伊芙把新原活植AA4-STEM-1留在自己的AA4-POT-1原盆与新苗圃台。原茎已有浅表损伤，始终存活；不替换旧德鲁伊原苗，也不先制造死亡。（原创G）',
    facts: ['先1行动80便士购买一件原AA4-KIT-n，内为虚构已处理培养介质与束纤；不提供现实配方或实验步骤。准备要求实际持有该案原包，实施无论成败均耗尽它。', '能力1行动4灵性、知识18，只稳定同一活茎浅损；普通0灵性、知识10只作支撑绑缚。失败保留可见未解决损伤。', 'OBSERVE_RECOVERY在同一原台实际观察6小时，只记录这段有限情况；RETURN_SAMPLE把原盆留在导师台、解除玩家保管并交回未用普通夹具；完成后才可CLOSE。'], ability: '准备原活茎有限稳定，实施另4灵性、知识18及同一原材料包。', ordinary: '准备原活茎普通支撑，实施0灵性、知识10，同样消耗实际原包。' },
  { id: 'living-fibre', title: '同盘有限六十秒反应纤维', story: '原AA4-TRAY-1和同一0.5千克AA4-WEIGHT-1留在导师台。只从已买原包制成一份虚构有机基质；没有意识、灵魂或独立人格。（全部具体机制为原创G）',
    facts: ['能力4灵性、知识18成功才产生一个唯一AA4-MATRIX-n，最多反应60秒。普通0灵性、知识10只编成非活性垫；失败原材料留下同一惰性残余。', 'TEST_MATRIX把同一0.5千克原重物沿原盘滑动一次，实际经过10秒：有限反应纤维收缩承托，普通垫只物理支撑；不证明无限力量。', 'STOP_MATRIX实际经过余下秒数至60秒并保留同一惰性原件；普通或失败材料也在同盘观察满60秒。RETURN_SAMPLE本人1米去、带同一耗尽原件1米回交导师废料盒，原盘原重物留台。'], ability: '准备一次60秒有限反应基质，实施另4灵性、知识18及同一原材料包。', ordinary: '准备普通非活性编织垫，实施0灵性、知识10及同一原材料包。' },
  { id: 'honest-handover', title: '同一张限度报告交给诺拉', story: '原成年苗圃助手AA4-NORA-BELL诺拉·贝尔自愿在2米外原桌接收报告。伊芙只给同一AA4-RECORD-1原纸，先核对两案实际原包、原件与观察结果，不把生命方向写成造人或复活证明。（原创G）',
    facts: ['前两案真实报告完成后才开始；两种入口都只作普通书写，0灵性、知识10，不取得伪能力掌握。失败原字迹保留，重试只在同纸补记。', 'HAND_OVER本人走2米去、2米回，把同一张纸当面交一次。诺拉只接受清楚的限度报告；不完整报告被退回导师原台，真实失败与4米路径仍保留。', '原纸已实际在NORA且本人回原台才可成功收束报告；原材料ID、6小时观察及60秒原件验证完整冻结在同纸记录。'], ability: '只准备普通有限报告，不施术、不取得能力奖励。', ordinary: '准备在同一原纸上核对并写明实际材料、有限结果和未知边界。' },
] as const;
export const ANCIENT_ALCHEMIST_LIFE_ENVIRONMENT = '古代炼金师4的生命炼成方向有原著依据，完整配方、仪式与具体生命制作规则仍未知；本处人物、材料、原件、成本、判定、距离、时间、护腕及奖励全部为原创G，不是现实实验教程。没有造人、灵魂创造、复活、动物变形或无限物。观察、准备、实施、报告各1行动；前两案各须另1行动80便士买原包，能力另4灵性知识18，普通0灵性知识10；第三案只有普通核对。0行动收束仍实际经过6小时或60秒、沿原路交回同一原件。三报告各G扮演25、反思25；前两案成功能力报告各掌握+8，普通无掌握。原耕种者、医师、丰收祭司、生物学家、德鲁伊五域与原马伦结局全部保留。战前原材料制作三段护腕需1行动120便士4灵性，每激活一段再4灵性，单段最多60秒、当轮到期，成败都耗尽该段；原件保留、无自动补充或独立攻击。';

export function createAncientAlchemistLifeState(): AncientAlchemistLifeState {
  return {
    cases: { 'living-stem': emptyCase(), 'living-fibre': emptyCase(), 'honest-handover': emptyCase() }, reflected: false,
    kits: [1, 2, 3].map(n => kit(n, null)), kitSupply: { requestedWeek: null, deliveryWeeks: [] },
    stem: { id: 'AA4-STEM-1', potId: 'AA4-POT-1', owner: 'GUIDE', position: 'GUIDE_BENCH', living: true, holder: 'GUIDE', damage: 'SHALLOW_UNRESOLVED', clips: 'GUIDE', observationHours: 0, returns: 0 },
    tray: { id: 'AA4-TRAY-1', position: 'GUIDE_BENCH', weightId: 'AA4-WEIGHT-1', weightKg: 0.5 }, matrices: [],
    record: { id: 'AA4-RECORD-1', holder: 'GUIDE', revisions: [], handovers: 0, distanceMetres: 0 },
    recipient: { id: 'AA4-NORA-BELL', name: '诺拉·贝尔', adult: true, willing: true, position: 'ORIGINAL_TABLE_2M' },
    guardKits: [1, 2, 3].map(n => guardKit(n, null)), guardSupply: { requestedWeek: null, deliveryWeeks: [] }, guards: [], guardReturnDistanceMetres: 0,
  };
}
export function availableAncientAlchemistGuard(s: SliceState): AncientAlchemistGuard | null {
  return s.ancientAlchemist.life.guards.find(g => g.holder === 'PLAYER' && g.segments.some(p => p.spentWeek === null)) ?? null;
}
export function getAncientAlchemistGuardSegment(s: SliceState): { guardId: string; segmentId: string } | null {
  const g = availableAncientAlchemistGuard(s), segment = g?.segments.find(p => p.spentWeek === null);
  return g && segment ? { guardId: g.id, segmentId: segment.id } : null;
}
/** The combat resolver pays its own 4 spirituality and records the actual 60-second effect. This consumes only the original material. */
export function consumeAncientAlchemistGuardSegment(s: SliceState, guardId: string, segmentId: string): boolean {
  const g = s.ancientAlchemist.life.guards.find(x => x.id === guardId && x.holder === 'PLAYER'), p = g?.segments.find(x => x.id === segmentId);
  if (!p || p.spentWeek !== null) return false;
  p.spentWeek = s.week; return true;
}
export function hasAncientAlchemistLifeLock(s: SliceState): boolean {
  const l = s.ancientAlchemist.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.stem.holder === 'PLAYER' || l.stem.clips === 'PLAYER'
    || l.matrices.some(m => m.holder === 'TRAY') || l.record.holder === 'PLAYER';
}
export function validateAncientAlchemistActivityCommand(c: unknown): c is AncientAlchemistActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'REQUEST_KITS', 'RECEIVE_KITS', 'REQUEST_GUARD_KITS', 'RECEIVE_GUARD_KITS', 'RETURN_GUARD'].includes(c.type as string)) return shape(c, ['type']);
  if (c.type === 'PREPARE_GUARD') return shape(c, ['type', 'kitId']) && typeof c.kitId === 'string';
  if (!ANCIENT_ALCHEMIST_CASE_IDS.includes(c.caseId as AncientAlchemistCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'BUY_KIT') return shape(c, ['type', 'caseId', 'kitId']) && c.caseId !== 'honest-handover' && typeof c.kitId === 'string';
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)
    || c.type === 'OBSERVE_RECOVERY' && c.caseId === 'living-stem' || ['TEST_MATRIX', 'STOP_MATRIX'].includes(c.type as string) && c.caseId === 'living-fibre'
    || c.type === 'RETURN_SAMPLE' && c.caseId !== 'honest-handover' || c.type === 'HAND_OVER' && c.caseId === 'honest-handover');
}
export function ancientAlchemistActivityReason(s: SliceState, c: AncientAlchemistActivityCommand): string | null {
  if (!validateAncientAlchemistActivityCommand(c)) return '古代炼金师有限实践命令无效。';
  if (!active(s)) return '先完成古代炼金师晋升。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (hasDruidOpenPractice(s)) return '先收束旧五域原现场与原物。';
  if (s.world.city !== 'BACKLUND' || !s.ancientAlchemist.guidanceKnown || !s.druid.guidanceKnown) return '需回贝克兰德伊芙原训练园的新苗圃台。';
  const l = s.ancientAlchemist.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r ? last(r) : undefined;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只可取消尚未实施的准备，未用原包仍由本人持有。';
  if (c.type === 'OBSERVE_RECOVERY') return r?.contactOpen && a && a.observationHours === 0 && !a.returned ? null : '没有待实际六小时观察的本次原活植。';
  if (c.type === 'TEST_MATRIX') return r?.contactOpen && a && !a.tested && !a.stopped ? null : '本次原重物仅能在停止前验证一次。';
  if (c.type === 'STOP_MATRIX') return r?.contactOpen && a && !a.stopped ? null : '没有待实际经过剩余秒数的本次原基质。';
  if (c.type === 'RETURN_SAMPLE') {
    if (!r?.contactOpen || !a || a.returned) return '没有待归还的同一原件。';
    return c.caseId === 'living-stem' ? a.observationHours === 6 ? null : '先在原台实际观察六小时。' : a.stopped ? null : '先实际经过60秒、停止并保留惰性原件。';
  }
  if (c.type === 'HAND_OVER') return r?.contactOpen && a && !a.returned && l.record.holder === 'PLAYER' ? null : '同一原纸本次尚未交接时才可走原4米路线。';
  if (c.type === 'CLOSE') return r?.contactOpen && a?.returned ? null : '先完成实际时间、同一原物归还或原纸交接；不能用CLOSE省略。';
  if (hasAncientAlchemistLifeLock(s)) return '先0行动经过实际时间并归还同一原物、结束接触。';
  const prepared = ANCIENT_ALCHEMIST_CASE_IDS.find(id => l.cases[id].status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared)) return '先实施或0行动取消当前准备。';
  if (c.type === 'RETURN_GUARD') {
    const g = l.guards.find(x => x.holder === 'PLAYER');
    return !g ? '没有本人持有的原护腕。' : g.segments.some(p => p.spentWeek === null) ? '须先耗尽原三段，不能把未耗材料当作废件重置。' : null;
  }
  if (c.type === 'REQUEST_KITS' || c.type === 'REQUEST_GUARD_KITS') {
    const supply = c.type === 'REQUEST_KITS' ? l.kitSupply : l.guardSupply, items = c.type === 'REQUEST_KITS' ? l.kits : l.guardKits;
    return supply.requestedWeek !== null ? '本次补货请求已记录，下一真实周再接货。' : items.some(k => k.status !== 'CONSUMED') ? '原供货必须全部实际耗尽且无人持有未用包，才可申请新批。' : null;
  }
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已付实践的0行动收束仍可进行。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'RECEIVE_KITS' || c.type === 'RECEIVE_GUARD_KITS') {
    const supply = c.type === 'RECEIVE_KITS' ? l.kitSupply : l.guardSupply;
    return supply.requestedWeek === null || s.week <= supply.requestedWeek ? '先申请补货，严格到下一个真实周后才能实际接收新批。' : null;
  }
  if (c.type === 'PREPARE_GUARD') {
    if (l.guards.some(g => g.holder === 'PLAYER')) return '仅可持有一个原护腕，先耗尽并实际归还原件。';
    if (!l.guardKits.some(k => k.id === c.kitId && k.status === 'SUPPLIER')) return '须指定导师现有的一件原护腕材料包。';
    return s.cash < 120 ? '购买与制作需120便士。' : s.spirituality < 4 ? '制作另需4灵性，不能免费产生护腕。' : null;
  }
  if (c.type === 'REFLECT') return l.reflected ? '已经回看三份限度报告。' : ANCIENT_ALCHEMIST_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份真实报告。' : null;
  if (!('caseId' in c) || !r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本案已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const index = ANCIENT_ALCHEMIST_CASE_IDS.indexOf(c.caseId);
    return r.status !== 'AVAILABLE' ? '原现场观察已保留。' : index > 0 && l.cases[ANCIENT_ALCHEMIST_CASE_IDS[index - 1]!].status !== 'RESOLVED' ? '先完成前一份真实报告。' : null;
  }
  if (c.type === 'BUY_KIT') return r.status !== 'OBSERVED' ? '先观察原现场，再选购该案实际材料。' : heldKit(s, c.caseId) ? '该案未用原包仍在本人手中，不重复购买。' : !l.kits.some(k => k.id === c.kitId && k.status === 'SUPPLIER') ? '指定的原包不在导师现有供货中。' : s.cash < 80 ? '原材料包需要80便士。' : null;
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场；完整成功结果可直接报告。' : a?.week === s.week ? '本周已实际尝试，下一真实周才能重试。' : c.caseId !== 'honest-handover' && !heldKit(s, c.caseId) ? '准备前须实际买入并持有该案原材料包。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && a?.closed && reportable(c.caseId, a) ? null : '须真实成功、完整观察验证与同一原物实际收束。';
  if (r.status !== 'PREPARED' || r.method === null) return '先准备本次有限实践。';
  if (c.caseId !== 'honest-handover' && !heldKit(s, c.caseId)) return '本次没有可消耗的实际原材料包。';
  return s.spirituality < cost(c.caseId, r.method) ? `本次需要${cost(c.caseId, r.method)}灵性，可0行动取消准备。` : null;
}

function frozenReport(s: SliceState): string {
  const l = s.ancientAlchemist.life;
  return `同一AA4-RECORD-1依据伊芙原说明卡记录：${(['living-stem', 'living-fibre'] as const).flatMap(id => l.cases[id].attempts.map(a => `${id} W${a.week} 原包${a.kitId}已耗尽，${a.method}/${a.outcome}，实际观察${a.observationHours}小时，${a.matrixId ? `原件${a.matrixId} ${originalMatrix(s, a)?.test}，实际${a.elapsedSeconds}秒、已停${a.stopped}、已归还${a.returned}` : '同一活植AA4-STEM-1留原盆与原台'}`)).join('；')}。这仅证明上述短时、有限结果；永久治愈、造人、灵魂、复活、无限物均未证实。全部具体材料机制为原创G，不是现实实验教程。`;
}
export function applyAncientAlchemistActivity(s: SliceState, c: AncientAlchemistActivityCommand, ctx: SeerContext, award: (id: AncientAlchemistLifeAbilityId, amount?: number) => void): void {
  const reason = ancientAlchemistActivityReason(s, c); if (reason) throw new Error(reason);
  if (!validateAncientAlchemistLife(s)) throw new Error('原材料、同一原件与有限实践历史不一致。');
  const l = s.ancientAlchemist.life;
  if (c.type === 'REQUEST_KITS' || c.type === 'REQUEST_GUARD_KITS') {
    (c.type === 'REQUEST_KITS' ? l.kitSupply : l.guardSupply).requestedWeek = s.week;
    ctx.note('向原导师请求下一真实周的新批材料', '0行动只记录请求，原库存不增加；每件旧原包与耗尽原件继续保留。'); return;
  }
  if (c.type === 'RECEIVE_KITS' || c.type === 'RECEIVE_GUARD_KITS') {
    s.actionsRemaining -= 1;
    const supply = c.type === 'RECEIVE_KITS' ? l.kitSupply : l.guardSupply; supply.requestedWeek = null; supply.deliveryWeeks.push(s.week);
    if (c.type === 'RECEIVE_KITS') { const count = l.kits.length; l.kits.push(...[1, 2, 3].map(n => kit(count + n, s.week))); }
    else { const count = l.guardKits.length; l.guardKits.push(...[1, 2, 3].map(n => guardKit(count + n, s.week))); }
    ctx.note('实际接收导师新准备的三件独立原包', '1行动，新的稳定ID已登记于导师供货；尚未免费成为玩家材料或护腕，购买与制作费用仍须支付。'); return;
  }
  if (c.type === 'RETURN_GUARD') {
    const g = l.guards.find(x => x.holder === 'PLAYER')!; g.holder = 'GUIDE'; g.returnedWeek = s.week; l.guardReturnDistanceMetres += 2;
    ctx.note('本人普通两米归还同一耗尽护腕', `本人1米去、携同一${g.id}原腕架和三段惰性材料1米回，交给伊芙；0行动收束仍真实走2米，没有补充、复活或新护腕。`); return;
  }
  if (c.type === 'PREPARE_GUARD') {
    s.actionsRemaining -= 1; s.cash -= 120; s.spirituality -= 4;
    const k = l.guardKits.find(x => x.id === c.kitId)!, id = `AA4-GUARD-${l.guards.length + 1}`;
    k.status = 'CONSUMED'; k.consumedWeek = s.week; k.guardId = id;
    l.guards.push({ id, kitId: k.id, preparedWeek: s.week, holder: 'PLAYER', returnedWeek: null, segments: [1, 2, 3].map(n => ({ id: `${id}-SEGMENT-${n}`, spentWeek: null })) });
    ctx.note('实际原材料制作三段有限护腕', `${k.id}已耗尽，实付1行动120便士4灵性，制成同一${id}原腕架和3段未激活材料。每段战斗另4灵性，成功失败都耗一次；成功效果最多60秒、当轮到期，绝不自动补充，无心智、灵魂或独立攻击。（原创G）`); return;
  }
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('ancient-alchemist-reflection');
    ctx.note('回看三份真实限度报告', 'G扮演+25；原包、原件、六小时与六十秒真实结果保留，不推断未核高阶生命权柄。'); return;
  }
  if (!('caseId' in c)) return;
  const r = l.cases[c.caseId], p = CASES.find(x => x.id === c.caseId)!, a = last(r);
  if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1; ctx.note('取消尚未实施的准备', '0行动、不退准备费用；未用原材料包仍在本人手中，不消耗、不补充或生成原件。'); return; }
  if (c.type === 'OBSERVE_RECOVERY') {
    a!.observationHours = 6; l.stem.observationHours += 6;
    ctx.note('同一原活茎实际观察六小时', `在原导师台实际经过6小时，同一${l.stem.id}仍活着，浅损状态${l.stem.damage}。只记录本段观察，不宣称永久治愈，也不补玩家资源。`); return;
  }
  if (c.type === 'TEST_MATRIX') {
    const m = originalMatrix(s, a)!; a!.tested = true; a!.elapsedSeconds += 10; m.elapsedSeconds += 10;
    if (m.state === 'ACTIVE') { m.remainingSeconds -= 10; m.test = 'BRACED_WEIGHT'; } else m.test = m.state === 'WOVEN_PAD' ? 'ORDINARY_SUPPORT' : 'NO_RESPONSE';
    ctx.note('同一半千克原重物实际验证一次', `${l.tray.weightId}沿原${l.tray.id}滑动一次，实经10秒；同一${m.id}：${m.test}，剩余反应${m.remainingSeconds}秒。仅有限承托，不证明无限力量、意识或自主生命。`); return;
  }
  if (c.type === 'STOP_MATRIX') {
    const m = originalMatrix(s, a)!, seconds = 60 - m.elapsedSeconds; a!.elapsedSeconds += seconds; a!.stopped = true;
    m.elapsedSeconds = 60; m.remainingSeconds = 0; m.stopped = true; if (m.state === 'ACTIVE') m.state = 'INERT';
    ctx.note('实际经过余时并保留同一耗尽原件', `原台实际再经过${seconds}秒，本次合计60秒；${m.id}已停止、保留同一惰性原件，不能复活或充值。普通垫与失败残余也只做实际时间对照。`); return;
  }
  if (c.type === 'RETURN_SAMPLE') {
    a!.returned = true;
    if (c.caseId === 'living-stem') { l.stem.holder = 'GUIDE'; l.stem.clips = 'GUIDE'; l.stem.returns += 1; }
    else { const m = originalMatrix(s, a)!; m.holder = 'GUIDE_WASTE'; a!.distanceMetres += 2; }
    ctx.note('交回同一原件与实际保管', c.caseId === 'living-stem' ? '同一活植原盆始终留导师原台，解除玩家保管并交回未用普通夹具，不复制或替换原苗。' : `本人普通1米去原台，携同一${a!.matrixId}耗尽原件1米回，交伊芙废料盒，实际2米；同一原盘和原重物仍在导师台。`); return;
  }
  if (c.type === 'HAND_OVER') {
    a!.distanceMetres += 4; a!.returned = true; a!.handedOver = a!.success; l.record.distanceMetres += 4;
    l.record.holder = a!.success ? 'NORA' : 'GUIDE'; if (a!.success) l.record.handovers += 1;
    ctx.note('同一原纸实际四米交接', `本人普通2米走到原成年诺拉·贝尔的原桌，递出同一AA4-RECORD-1，再实际2米返回。${a!.success ? '本人愿意接受清楚的限度报告，原纸留NORA。' : '核对未通过，诺拉不接受不完整结论；同一原纸带回导师原台，原字迹保留，下真实周在同纸补记。'}没有改变本人心智。`); return;
  }
  if (c.type === 'CLOSE') {
    a!.closed = true; r.contactOpen = false; r.closes += 1;
    if (!reportable(c.caseId, a!)) { r.status = 'OBSERVED'; r.method = null; }
    ctx.note('原现场实际收束', reportable(c.caseId, a!) ? '实际时间和同一原物交接已经完成，完整有限结果可报告一次。' : '真实失败或证据不足保留，费用不退，下一真实周再买新原包或补记同纸；没有成功奖励。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'BUY_KIT') {
    const k = l.kits.find(x => x.id === c.kitId)!; s.cash -= 80; k.status = 'PLAYER'; k.acquiredWeek = s.week; k.caseId = c.caseId;
    ctx.note('实际购买一件已有原材料包', `${k.id}由伊芙现有供货交到本人，实付1行动80便士，绑定${c.caseId}。内为有限虚构介质与束纤（G），无现实制作配方；实施无论成败都耗尽此件。`); return;
  }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.caseId === 'honest-handover' ? 'ORDINARY' : c.method; r.preparations += 1; ctx.note('准备原材料与有限目标', (r.method === 'ABILITY' ? p.ability : p.ordinary) + '准备不施术、不打开接触锁，取消后未用原包保留。'); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(source(c.caseId));
    if (r.method === 'ABILITY' && c.caseId !== 'honest-handover') award(c.caseId === 'living-stem' ? 'mother.s4.vital-knit' : 'mother.s4.living-matrix', 8);
    ctx.note(p.title, `${a!.reportText ?? `${a!.kitId} / ${a!.outcome}，真实${a!.observationHours}小时、${a!.elapsedSeconds}秒，原件已实际交回。`} G扮演+25，仅一次；${r.method === 'ABILITY' ? '该实际能力掌握+8。' : '普通结果无能力掌握。'}`); return;
  }
  const method = r.method!, spiritualityCost = cost(c.caseId, method), material = heldKit(s, c.caseId);
  s.spirituality -= spiritualityCost;
  if (material) { material.status = 'CONSUMED'; material.consumedWeek = s.week; }
  const tier = ctx.check('knowledge', difficulty(c.caseId, method)).tier, ok = tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
  const attempt: AncientAlchemistLifeAttempt = { week: s.week, method, success: ok, actionCost: 1, spiritualityCost, kitId: material?.id ?? null, matrixId: null, outcome: outcome(c.caseId, method, ok), observationHours: 0, elapsedSeconds: 0, distanceMetres: 0, tested: false, stopped: false, returned: false, closed: false, handedOver: false, reportText: null };
  r.attempts.push(attempt); r.contactOpen = true; r.status = ok ? 'EXAMINED' : 'OBSERVED';
  if (c.caseId === 'living-stem') {
    l.stem.holder = 'PLAYER'; l.stem.clips = 'PLAYER'; l.stem.damage = !ok ? 'SHALLOW_UNRESOLVED' : method === 'ABILITY' ? 'STABILIZED' : 'SUPPORTED';
  } else if (c.caseId === 'living-fibre') {
    const id = `AA4-MATRIX-${l.matrices.length + 1}`; attempt.matrixId = id;
    l.matrices.push({ id, kitId: material!.id, method, success: ok, holder: 'TRAY', state: !ok ? 'INERT' : method === 'ABILITY' ? 'ACTIVE' : 'WOVEN_PAD', remainingSeconds: ok && method === 'ABILITY' ? 60 : 0, elapsedSeconds: 0, test: 'NONE', stopped: false });
  } else {
    attempt.reportText = (ok ? 'LIMITED：' : 'UNVERIFIED，本次核对未通过：') + frozenReport(s);
    l.record.revisions.push(attempt.reportText); l.record.holder = 'PLAYER';
  }
  ctx.note(p.title, `本次${method}/${attempt.outcome}，实耗1行动${spiritualityCost}灵性${material ? `并耗尽原${material.id}` : ''}。${attempt.reportText ?? (c.caseId === 'living-stem' ? '同一原活茎仍在原盆，接下来实际六小时观察。' : `同一${attempt.matrixId}在原盘，有限反应最多60秒；请一次核对原重物并实际停止。`)}失败同样保留实际费用，尚须原现场收束。`);
}

export function ancientAlchemistLifeActions(s: SliceState): AncientAlchemistLifeAction[] {
  if (!active(s)) return [];
  const l = s.ancientAlchemist.life, out: AncientAlchemistLifeAction[] = [];
  const add = (id: string, label: string, price: string, command: AncientAlchemistActivityCommand) => { const reason = ancientAlchemistActivityReason(s, command); out.push({ id, label, cost: price, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = l.cases[p.id], a = last(r);
    if (r.contactOpen) {
      if (p.id === 'living-stem' && a?.observationHours === 0) add(`${p.id}-observe-recovery`, '在原台实际观察同一活茎六小时', '0行动 · 实际6小时 · 无资源回复', { type: 'OBSERVE_RECOVERY', caseId: p.id });
      if (p.id === 'living-fibre' && !a?.stopped) {
        if (!a?.tested) add(`${p.id}-test`, '同一半千克原重物验证一次', '0行动 · 实际10秒 · 一次有限承托', { type: 'TEST_MATRIX', caseId: p.id });
        add(`${p.id}-stop`, '实际经过余下时间并保留惰性原件', `0行动 · 本次累计60秒 · 无法充值`, { type: 'STOP_MATRIX', caseId: p.id });
      }
      if (p.id !== 'honest-handover' && !a?.returned) add(`${p.id}-return`, p.id === 'living-stem' ? '原盆留导师台并交回未用原夹具' : '普通两米归还同一耗尽基质', p.id === 'living-stem' ? '0行动 · 同一原盆原台 · 解除玩家保管' : '0行动 · 本人1米去1米回 · 原盘原重物留台', { type: 'RETURN_SAMPLE', caseId: p.id });
      if (p.id === 'honest-handover' && !a?.returned) add(`${p.id}-handover`, '普通四米把同一限度报告交给诺拉', '0行动 · 本人2米去2米回 · 原成年本人接收', { type: 'HAND_OVER', caseId: p.id });
      add(`${p.id}-close`, '确认真实时间与原物交接并结束接触', '0行动 · 不跳过时间或原路', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '观察本次原材料、原件与有限范围', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      if (p.id !== 'honest-handover' && !heldKit(s, p.id)) for (const k of l.kits.filter(k => k.status === 'SUPPLIER')) add(`${p.id}-buy-${k.id}`, `购买同一原包 ${k.id}`, '1行动 · 80便士 · 有限G材料', { type: 'BUY_KIT', caseId: p.id, kitId: k.id });
      if (p.id !== 'honest-handover') add(`${p.id}-ability`, '准备一次有限能力实践', '1行动 · 准备不施术 · 实施另4灵性及原包', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备普通有限对照或报告', `1行动 · 实施0灵性知识10${p.id === 'honest-handover' ? '' : ' · 仍耗原包'}`, { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限实践', `1行动 · ${cost(p.id, r.method!)}灵性 · 知识${difficulty(p.id, r.method!)}`, { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消未实施准备并保留未用原包', '0行动 · 不退已付准备费用', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已成功并实际收束的有限结果', '1行动 · G扮演+25 · 同案仅一次', { type: 'REPORT', caseId: p.id });
  }
  if (l.kits.every(k => k.status === 'CONSUMED')) add('ancient-alchemist-kit-supply', l.kitSupply.requestedWeek === null ? '请求下一真实周新材料批次' : '接收下一真实周三件新原包', l.kitSupply.requestedWeek === null ? '0行动 · 不即时生成材料' : '1行动 · 新原包留导师供货 · 仍须付费购买', { type: l.kitSupply.requestedWeek === null ? 'REQUEST_KITS' : 'RECEIVE_KITS' });
  const guard = l.guards.find(g => g.holder === 'PLAYER');
  if (guard) add('ancient-alchemist-return-guard', `归还同一耗尽护腕 ${guard.id}`, '0行动 · 耗尽三段后 · 本人普通2米', { type: 'RETURN_GUARD' });
  else for (const k of l.guardKits.filter(k => k.status === 'SUPPLIER')) add(`ancient-alchemist-guard-${k.id}`, `用原材料 ${k.id} 制作三段护腕`, '1行动 · 120便士 · 4灵性 · 每段激活另4灵性', { type: 'PREPARE_GUARD', kitId: k.id });
  if (l.guardKits.every(k => k.status === 'CONSUMED')) add('ancient-alchemist-guard-supply', l.guardSupply.requestedWeek === null ? '请求下真实周护腕材料新批' : '接收下真实周三件原护腕材料', l.guardSupply.requestedWeek === null ? '0行动 · 原材料必须耗尽' : '1行动 · 新原包不等于免费护腕', { type: l.guardSupply.requestedWeek === null ? 'REQUEST_GUARD_KITS' : 'RECEIVE_GUARD_KITS' });
  if (!l.reflected) add('ancient-alchemist-reflect', '回看三份限度报告与实际原材料', '1行动 · 三报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectAncientAlchemistLife(s: SliceState): AncientAlchemistLifeProjection {
  if (!(s.progression.pathwayId==='mother'&&[4,3].includes(s.progression.sequence!))) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.ancientAlchemist.life;
  return {
    insideCase: hasAncientAlchemistLifeLock(s), environment: ANCIENT_ALCHEMIST_LIFE_ENVIRONMENT,
    cases: CASES.map(p => {
      const r = l.cases[p.id], a = last(r);
      return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
        result: a ? `${a.method}/${a.outcome}，${a.success ? '有限核对成功' : '核对失败'}；原包${a.kitId ?? '本案不用材料包'}${a.matrixId ? `，原件${a.matrixId}` : ''}，实耗1行动/${a.spiritualityCost}灵性，实际观察${a.observationHours}小时/${a.elapsedSeconds}秒、普通路程${a.distanceMetres}米。${a.reportText ?? ''}${r.contactOpen ? '仍须实际时间与同一原物收束。' : reportable(p.id, a) ? '完整有限结果已收束。' : '失败或证据不全，费用保留，下一真实周再试。'}` : r.withdrawals ? '未实施准备取消，未用原包与已付费用保留。' : null,
        status: r.status, contactOpen: r.contactOpen ? '本次原现场尚未收束，不能普通行动或换周' : '没有未收束的现场接触', closes: r.closes };
    }),
    practice: {
      stem: `同一${l.stem.id}始终存活于${l.stem.potId}原盆、导师原台；浅损${l.stem.damage}，保管${l.stem.holder}，普通夹具${l.stem.clips}，累计实际观察${l.stem.observationHours}小时，实际归还${l.stem.returns}次。没有替换原苗或永久治愈保证。`,
      matrix: `同一${l.tray.id}与${l.tray.weightKg}千克原${l.tray.weightId}始终留台。${l.matrices.length ? l.matrices.map(m => `${m.id}←${m.kitId}，${m.state}/${m.holder}，原重物${m.test}，实际${m.elapsedSeconds}秒/反应剩${m.remainingSeconds}秒`).join('；') : '尚无制成原件。'}每件只有一次原重物验证，不可复活或充值。`,
      report: `同一${l.record.id}在${l.record.holder}；原成年${l.recipient.name}（${l.recipient.id}）自愿留在2米原桌。清楚限度报告已接受${l.record.handovers}次，同纸实际书写/补记${l.record.revisions.length}次。${l.record.revisions.at(-1) ?? '原纸尚未书写。'}`,
      route: `原活植原盆不离导师台；每个耗尽基质本人实际1米去1米回，累计${l.cases['living-fibre'].attempts.reduce((n, a) => n + a.distanceMetres, 0)}米；原纸2米去2米回，累计${l.record.distanceMetres}米；耗尽原护腕累计归还${l.guardReturnDistanceMetres}米。`,
      guard: l.guards.length ? l.guards.map(g => `同一${g.id}←${g.kitId}，W${g.preparedWeek}实付1行动120便士4灵性制作；${g.holder}，剩${g.segments.filter(p => p.spentWeek === null).length}/3段，${g.segments.map(p => `${p.id}:${p.spentWeek === null ? '未耗' : `W${p.spentWeek}已耗惰性原段`}`).join('、')}；每激活段另4灵性、最多60秒且当轮到期，无免费补充`).join('；') : '尚未制作护腕。须战前用一件实际原材料付1行动120便士4灵性制作3段；每激活段另4灵性，无晋升赠送、自动补充或独立攻击。',
      kits: `实践原包：${l.kits.map(k => `${k.id} ${k.status}${k.caseId ? `/${k.caseId}` : ''}`).join('；')}。护腕原材料：${l.guardKits.map(k => `${k.id} ${k.status}${k.guardId ? `→${k.guardId}` : ''}`).join('；')}。每种初始3件，全部耗尽后申请，下真实周才另付1行动接收3件新原供货；旧ID永不覆盖。`,
      history: [...ANCIENT_ALCHEMIST_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => `${id} W${a.week} ${a.method}/${a.outcome}：原包${a.kitId ?? '无'}、原件${a.matrixId ?? (id === 'living-stem' ? l.stem.id : l.record.id)}，实耗1行动/${a.spiritualityCost}灵性；实际${a.observationHours}小时/${a.elapsedSeconds}秒、${a.distanceMetres}米，${a.closed ? '真实收束' : '待收束'}。${a.reportText ?? ''}`)), '旧五域全部原人原物、原马伦结局与旧掌握保留；所有具体生命与护腕机制均为原创G。'],
    },
  };
}

/** Small local consistency checks for paid originals, finite times and one-way material use. */
export function validateAncientAlchemistLife(s: SliceState): boolean {
  try {
    const l = s.ancientAlchemist.life, start = s.ancientAlchemist.promotionWeek;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'kits', 'kitSupply', 'stem', 'tray', 'matrices', 'record', 'recipient', 'guardKits', 'guardSupply', 'guards', 'guardReturnDistanceMetres']) || typeof l.reflected !== 'boolean') return false;
    if (start === null) return stableStringify(l) === stableStringify(createAncientAlchemistLifeState());
    if (!record(l.cases) || !shape(l.cases, ANCIENT_ALCHEMIST_CASE_IDS) || !Array.isArray(l.kits) || !Array.isArray(l.matrices) || !Array.isArray(l.guards) || !Array.isArray(l.guardKits)) return false;
    let open = 0, prepared = 0, resolved = 0;
    const consumed = new Set<string>();
    for (const [index, id] of ANCIENT_ALCHEMIST_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || !Array.isArray(r.attempts) || !integer(r.preparations) || !integer(r.withdrawals) || !integer(r.closes)) return false;
      let previous = start - 1;
      for (const [n, a] of r.attempts.entries()) {
        if (!record(a) || !shape(a, ['week', 'method', 'success', 'actionCost', 'spiritualityCost', 'kitId', 'matrixId', 'outcome', 'observationHours', 'elapsedSeconds', 'distanceMetres', 'tested', 'stopped', 'returned', 'closed', 'handedOver', 'reportText']) || !integer(a.week, start, s.week) || a.week <= previous || !['ABILITY', 'ORDINARY'].includes(a.method) || typeof a.success !== 'boolean' || ['tested', 'stopped', 'returned', 'closed', 'handedOver'].some(k => typeof (a as unknown as Record<string, unknown>)[k] !== 'boolean') || a.actionCost !== 1 || a.spiritualityCost !== cost(id, a.method) || a.outcome !== outcome(id, a.method, a.success)) return false;
        if (id !== 'honest-handover') {
          const k = l.kits.find(k => k.id === a.kitId);
          if (!k || k.status !== 'CONSUMED' || k.caseId !== id || k.consumedWeek !== a.week || consumed.has(k.id) || a.reportText !== null || a.handedOver) return false;
          consumed.add(k.id);
        } else if (a.method !== 'ORDINARY' || a.kitId !== null || a.matrixId !== null || a.reportText !== (a.success ? 'LIMITED：' : 'UNVERIFIED，本次核对未通过：') + frozenReport(s) || a.handedOver !== (a.returned && a.success)) return false;
        if (id === 'living-stem') {
          if (![0, 6].includes(a.observationHours) || a.returned && a.observationHours !== 6 || a.matrixId !== null || a.elapsedSeconds !== 0 || a.distanceMetres !== 0 || a.tested || a.stopped) return false;
        } else if (id === 'living-fibre') {
          const m = originalMatrix(s, a);
          if (!m || m.kitId !== a.kitId || m.method !== a.method || m.success !== a.success || a.observationHours !== 0 || a.elapsedSeconds !== (a.stopped ? 60 : a.tested ? 10 : 0) || a.distanceMetres !== (a.returned ? 2 : 0) || a.returned && !a.stopped) return false;
          if (m.elapsedSeconds !== a.elapsedSeconds || m.stopped !== a.stopped || m.holder !== (a.returned ? 'GUIDE_WASTE' : 'TRAY') || m.test !== (!a.tested ? 'NONE' : a.success ? a.method === 'ABILITY' ? 'BRACED_WEIGHT' : 'ORDINARY_SUPPORT' : 'NO_RESPONSE') || m.state !== (!a.success ? 'INERT' : a.method === 'ORDINARY' ? 'WOVEN_PAD' : a.stopped ? 'INERT' : 'ACTIVE') || m.remainingSeconds !== (a.success && a.method === 'ABILITY' && !a.stopped ? 60 - a.elapsedSeconds : 0)) return false;
        } else if (a.observationHours !== 0 || a.elapsedSeconds !== 0 || a.distanceMetres !== (a.returned ? 4 : 0) || a.tested || a.stopped) return false;
        if (a.closed !== (n < r.attempts.length - 1 || !r.contactOpen) || a.closed && !a.returned || n < r.attempts.length - 1 && reportable(id, a)) return false;
        previous = a.week;
      }
      const a = last(r), ready = r.status === 'PREPARED', good = !!a && (r.contactOpen ? a.success : reportable(id, a));
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(ready) || (r.status === 'EXAMINED' || r.status === 'RESOLVED') !== good) return false;
      if (r.contactOpen && (!a || a.week !== s.week || r.method !== a.method || ready || r.status === 'RESOLVED') || r.status === 'RESOLVED' && !a?.closed || (ready || r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method === null || !r.contactOpen && ['AVAILABLE', 'OBSERVED'].includes(r.status) && r.method !== null) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method !== a?.method) return false;
      if (ready && id !== 'honest-handover' && !heldKit(s, id) || id === 'honest-handover' && r.method === 'ABILITY' || r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase()) || index > 0 && r.status !== 'AVAILABLE' && l.cases[ANCIENT_ALCHEMIST_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === source(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(ready); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared || l.matrices.length !== l.cases['living-fibre'].attempts.length || l.matrices.some((m, i) => m.id !== `AA4-MATRIX-${i + 1}` || l.cases['living-fibre'].attempts[i]?.matrixId !== m.id)) return false;
    for (const [items, supply] of [[l.kits, l.kitSupply], [l.guardKits, l.guardSupply]] as const) {
      if (!record(supply) || !shape(supply, ['requestedWeek', 'deliveryWeeks']) || !Array.isArray(supply.deliveryWeeks) || supply.deliveryWeeks.some((w, i) => !integer(w, start + 1, s.week) || i > 0 && w <= supply.deliveryWeeks[i - 1]!) || items.length !== 3 * (1 + supply.deliveryWeeks.length) || supply.requestedWeek !== null && (!integer(supply.requestedWeek, start, s.week) || items.some(k => k.status !== 'CONSUMED') || supply.requestedWeek < (supply.deliveryWeeks.at(-1) ?? start))) return false;
    }
    const held = new Set<MaterialCaseId>();
    for (const [i, k] of l.kits.entries()) {
      if (!record(k) || !shape(k, ['id', 'suppliedWeek', 'caseId', 'status', 'acquiredWeek', 'consumedWeek']) || k.id !== `AA4-KIT-${i + 1}` || k.suppliedWeek !== (i < 3 ? null : l.kitSupply.deliveryWeeks[Math.floor(i / 3) - 1]) || !['SUPPLIER', 'PLAYER', 'CONSUMED'].includes(k.status)) return false;
      if (k.status === 'SUPPLIER') { if (k.caseId !== null || k.acquiredWeek !== null || k.consumedWeek !== null) return false; }
      else {
        if (!['living-stem', 'living-fibre'].includes(k.caseId as string) || !integer(k.acquiredWeek, k.suppliedWeek ?? start, s.week)) return false;
        if (k.status === 'CONSUMED') { if (!integer(k.consumedWeek, k.acquiredWeek, s.week) || !consumed.has(k.id)) return false; }
        else { if (k.consumedWeek !== null || held.has(k.caseId!) || l.cases[k.caseId!].status === 'RESOLVED') return false; held.add(k.caseId!); }
      }
    }
    const stemAttempts = l.cases['living-stem'].attempts, sa = stemAttempts.at(-1), stemHeld = !!(l.cases['living-stem'].contactOpen && !sa?.returned);
    if (!record(l.stem) || l.stem.id !== 'AA4-STEM-1' || l.stem.potId !== 'AA4-POT-1' || l.stem.owner !== 'GUIDE' || l.stem.position !== 'GUIDE_BENCH' || l.stem.living !== true || l.stem.holder !== (stemHeld ? 'PLAYER' : 'GUIDE') || l.stem.clips !== (stemHeld ? 'PLAYER' : 'GUIDE') || l.stem.damage !== (!sa?.success ? 'SHALLOW_UNRESOLVED' : sa.method === 'ABILITY' ? 'STABILIZED' : 'SUPPORTED') || l.stem.observationHours !== stemAttempts.reduce((n, a) => n + a.observationHours, 0) || l.stem.returns !== stemAttempts.filter(a => a.returned).length) return false;
    if (stableStringify(l.tray) !== stableStringify(createAncientAlchemistLifeState().tray) || stableStringify(l.recipient) !== stableStringify(createAncientAlchemistLifeState().recipient)) return false;
    const reportAttempts = l.cases['honest-handover'].attempts, ra = reportAttempts.at(-1);
    if (!record(l.record) || l.record.id !== 'AA4-RECORD-1' || l.record.holder !== (ra && !ra.returned ? 'PLAYER' : ra?.handedOver ? 'NORA' : 'GUIDE') || stableStringify(l.record.revisions) !== stableStringify(reportAttempts.map(a => a.reportText)) || l.record.handovers !== reportAttempts.filter(a => a.handedOver).length || l.record.distanceMetres !== reportAttempts.reduce((n, a) => n + a.distanceMetres, 0)) return false;
    if (l.guardKits.filter(k => k.status === 'CONSUMED').length !== l.guards.length || l.guards.filter(g => g.holder === 'PLAYER').length > 1) return false;
    for (const [i, k] of l.guardKits.entries()) {
      if (!record(k) || !shape(k, ['id', 'suppliedWeek', 'status', 'consumedWeek', 'guardId']) || k.id !== `AA4-GUARD-KIT-${i + 1}` || k.suppliedWeek !== (i < 3 ? null : l.guardSupply.deliveryWeeks[Math.floor(i / 3) - 1])) return false;
      if (k.status === 'SUPPLIER') { if (k.consumedWeek !== null || k.guardId !== null) return false; }
      else if (k.status !== 'CONSUMED' || !integer(k.consumedWeek, k.suppliedWeek ?? start, s.week) || !l.guards.some(g => g.id === k.guardId && g.kitId === k.id && g.preparedWeek === k.consumedWeek)) return false;
    }
    for (const [i, g] of l.guards.entries()) {
      if (!record(g) || !shape(g, ['id', 'kitId', 'preparedWeek', 'holder', 'returnedWeek', 'segments']) || g.id !== `AA4-GUARD-${i + 1}` || !integer(g.preparedWeek, start, s.week) || !l.guardKits.some(k => k.id === g.kitId && k.guardId === g.id) || !Array.isArray(g.segments) || g.segments.length !== 3 || g.segments.some((p, n) => !record(p) || !shape(p, ['id', 'spentWeek']) || p.id !== `${g.id}-SEGMENT-${n + 1}` || p.spentWeek !== null && !integer(p.spentWeek, g.preparedWeek, s.week))) return false;
      if (g.holder === 'PLAYER') { if (g.returnedWeek !== null || i < l.guards.length - 1) return false; }
      else if (g.holder !== 'GUIDE' || !integer(g.returnedWeek, g.preparedWeek, s.week) || g.segments.some(p => p.spentWeek === null || p.spentWeek > g.returnedWeek!)) return false;
      if (i > 0 && (l.guards[i - 1]!.returnedWeek === null || g.preparedWeek < l.guards[i - 1]!.returnedWeek!)) return false;
    }
    if (l.guardReturnDistanceMetres !== 2 * l.guards.filter(g => g.holder === 'GUIDE').length || s.seer.completedSources.filter(x => x === 'ancient-alchemist-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3 || (active(s)||s.progression.pathwayId==='mother'&&s.progression.sequence===3) && (s.progression.sequence===3?s.coffinBearer.ancientAlchemistActingAtPromotion:s.progression.acting) !== resolved * 25 + Number(l.reflected) * 25) return false;
    if (hasAncientAlchemistLifeLock(s) && (!active(s) || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat || hasDruidOpenPractice(s))) return false;
    return true;
  } catch { return false; }
}
