import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { AncientScholarAction } from './types.js';

export const ANCIENT_SCHOLAR_CASE_IDS = ['past-reserve', 'old-tag', 'lit-fragment'] as const;
export type AncientScholarCaseId = typeof ANCIENT_SCHOLAR_CASE_IDS[number];
export type AncientScholarLifeAbilityId = 'diviner.s3.borrow-past' | 'diviner.s3.historical-projection' | 'diviner.s3.history-shelter';
export type AncientScholarActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: AncientScholarCaseId }
  | { type: 'PREPARE'; caseId: AncientScholarCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'BORROW_PAST' | 'USE_BORROWED_RESERVE' | 'PROJECT_TAG' | 'MOVE_TAG_IMAGE' | 'HIDE_IN_HISTORY' | 'RETURN_TO_PRESENT' | 'FINISH_ORDINARY' | 'REFLECT' };
/** Taken only by an actual OBSERVE command. No command accepts sample contents. */
export interface AncientScholarPastSample {
  id: string; bodyId: string; revision: number; week: number; sequence: 3; spirituality: number;
  health: number; mind: number; airBulletKnown: boolean; airBulletGain: 60;
  source: 'ACTUAL_RECEPTION_OBSERVATION';
}
export interface AncientScholarHistoryFragment {
  id: string; bodyId: string; revision: number; week: number; place: 'AS3-RECEPTION-MAT';
  event: 'PERSONALLY_OBSERVED_SAFE_MAT';
}
export interface AncientScholarCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; attempted: boolean; outcome: PublicResolutionTier | null;
  returned: boolean; closes: number; withdrawals: number;
}
export interface AncientScholarLifeState {
  cases: Record<AncientScholarCaseId, AncientScholarCaseState>; reflected: boolean;
  sample: AncientScholarPastSample | null; fragment: AncientScholarHistoryFragment | null;
  tagFamiliarity: { sourceId: 'BR4-TAG-1'; massGrams: 1; observedRevision: number; observedWeek: number; source: 'OWN_ORIGINAL_IN_CARRIER' } | null;
  practice: {
    activeCase: AncientScholarCaseId | null; ownerAt: 'PRESENT_MAT' | 'OWN_HISTORY';
    borrowedReserve: number; reserveSpent: number; borrowRemainingSeconds: number;
    image: { id: string; sourceId: 'BR4-TAG-1'; massGrams: 1; remainingSeconds: 30; position: 'NEAR' | 'FAR' } | null;
    shelterRemainingSeconds: number; elapsedSeconds: number;
  };
}
export interface AncientScholarLifeProjection {
  insideCase: boolean; environment: string;
  cases: { id: AncientScholarCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  practice: (AncientScholarLifeState['practice'] & { sample: AncientScholarPastSample | null; fragment: AncientScholarHistoryFragment | null; facts: string[] }) | null;
}
const CASES = [
  { id: 'past-reserve', title: '曾经实际拥有的一口余力', ability: 'diviner.s3.borrow-past',
    story: '艾琳将已经核验的三份旧史料副本放在接待桌上。你把自己亲历的封室与眼前真实状态区分记下：史书不是自己曾有力量的凭证。随后用既有空气弹击打空砂盘，再短时借回刚才确实有过的少量灵性用于同一件小事。（原创G）',
    facts: ['观察当刻只登记本人真实当前H/M/S、身体与已知空气弹，不接受外部样本。', '能力实施先实耗4灵性作两次既有空气弹；借力另实耗当下2灵性维持，临时储备至多6，仅用于一次2灵性空气弹，最多30秒G。', '临时储备从不写入真实灵性、健康或精神；消散后没有永久恢复，不向更弱过去索取更强能力。'] },
  { id: 'old-tag', title: '原携笼里的那一克旧纸签', ability: 'diviner.s3.historical-projection',
    story: '你亲自取看一直拥有的BR4-CARRIER-1内同一BR4-TAG-1，并立即放回原携笼。艾琳在两米远的桌角标出落点，等你搬运它的短时历史影像作比较；原件从头到尾留在自己的携笼。（原创G）',
    facts: ['只开放亲历、再核实过的普通原签：1克、无隐藏权能。高位人物、唯一性、污染铜铃与未知历史没有可选来源。', '实耗4灵性、知识14，失败仍付；初学容量1，最多30秒G，实际影像ID与原件不同。', '影像搬到两米远桌角后自然消散；不能出售、永久入库存或询问本人未知的秘密。'] },
  { id: 'lit-fragment', title: '已经走过的安全落脚处', ability: 'diviner.s3.history-shelter',
    story: '你在接待处净空垫上亲自站定并观察，把这段已经真实发生的自身片段点亮。之后短时藏入自己这段历史，再回到同一原垫；艾琳不把书中的陌生年代当作你的亲历。（原创G）',
    facts: ['实耗当下4灵性、知识14，最多10秒G；失败留在现实，代价不退。', '进入后现实中没有另一个独立的自己；本人须明确返回同一安全原垫，不能在藏身时做现实行动。', '这里只是有限、可退出的实践，不改变过去、不任意瞬移或成为无敌逃跑。'] },
] as const;
export const ANCIENT_SCHOLAR_LIFE_ENVIRONMENT = '原著方向为借过去的自己、历史影像、藏身历史；本次场景、检定、费用、1个普通影像/30秒、借力30秒及藏身10秒均为初晋原创G，非克莱恩大幅消化后的3影像/5分钟/15分钟参数。每项观察、准备、实施、报告各1行动，后续子步骤已计入实施时间、0行动仍实耗灵性。每次能力尝试只一次，失败可普通完成或实际收束后下一周再准备。三份不同真实报告各25消化，反思25，共100为G，隔绝300年不自动消化。原物与物权保留，原鼠失败活放生及旧多恩死亡不变；没有复活、改变历史、未知秘密或天使影像库。';
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
export const isAncientScholarStage = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 3;
const ready = (s: SliceState) => isAncientScholarStage(s) && s.ancientScholar.ritual.location === 'RECEPTION';
// Historical inheritance only; existing stage command predicates stay unchanged.
const hasAttendantHistory = (s: SliceState) => s.progression.pathwayId === 'diviner' &&
  s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null;
const freshCase = (): AncientScholarCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', attempted: false, outcome: null, returned: false, closes: 0, withdrawals: 0 });
export function createAncientScholarLifeState(): AncientScholarLifeState {
  return { cases: { 'past-reserve': freshCase(), 'old-tag': freshCase(), 'lit-fragment': freshCase() }, reflected: false,
    sample: null, fragment: null, tagFamiliarity: null, practice: { activeCase: null, ownerAt: 'PRESENT_MAT', borrowedReserve: 0, reserveSpent: 0, borrowRemainingSeconds: 0, image: null, shelterRemainingSeconds: 0, elapsedSeconds: 0 } };
}
export const hasAncientScholarLifeLock = (s: SliceState): boolean => s.ancientScholar.life.practice.activeCase !== null || s.ancientScholar.life.practice.ownerAt !== 'PRESENT_MAT';
export function hasAncientScholarPastSample(s: SliceState): boolean {
  const p = s.ancientScholar.life.sample;
  return !!p && p.id === `${s.runId}:AS3-SAMPLE:${p.revision}` && p.bodyId === `${s.runId}:body` && p.source === 'ACTUAL_RECEPTION_OBSERVATION' && p.sequence === 3 &&
    integer(p.revision, 0, s.revision) && integer(p.week, s.ancientScholar.promotionWeek ?? s.week, s.week) && integer(p.spirituality, 0, 120) &&
    integer(p.health, 1, 100) && integer(p.mind, 1, 100) && p.airBulletGain === 60 && typeof p.airBulletKnown === 'boolean' && s.ancientScholar.life.cases['past-reserve'].observedWeek === p.week;
}
export function hasAncientScholarTagSource(s: SliceState): boolean {
  const f = s.ancientScholar.life.tagFamiliarity, p = s.bizarroSorcerer.life.practice;
  return !!f && f.sourceId === 'BR4-TAG-1' && f.massGrams === 1 && f.source === 'OWN_ORIGINAL_IN_CARRIER' && integer(f.observedRevision, 0, s.revision) &&
    integer(f.observedWeek, s.ancientScholar.promotionWeek ?? s.week, s.week) && s.ancientScholar.life.cases['old-tag'].observedWeek === f.observedWeek &&
    p.tag.id === f.sourceId && p.tag.massGrams === 1 && p.tag.holder === 'CARRIER' && p.carrier.id === 'BR4-CARRIER-1' && p.carrier.holder === 'OWNER';
}
export function hasAncientScholarFragment(s: SliceState): boolean {
  const f = s.ancientScholar.life.fragment;
  return !!f && f.id === `${s.runId}:AS3-FRAGMENT:${f.revision}` && f.bodyId === `${s.runId}:body` && f.place === 'AS3-RECEPTION-MAT' && f.event === 'PERSONALLY_OBSERVED_SAFE_MAT' &&
    integer(f.revision, 0, s.revision) && integer(f.week, s.ancientScholar.promotionWeek ?? s.week, s.week) && s.ancientScholar.life.cases['lit-fragment'].observedWeek === f.week;
}
const SIMPLE = ['BORROW_PAST', 'USE_BORROWED_RESERVE', 'PROJECT_TAG', 'MOVE_TAG_IMAGE', 'HIDE_IN_HISTORY', 'RETURN_TO_PRESENT', 'FINISH_ORDINARY', 'REFLECT'];
export function validateAncientScholarActivityCommand(v: unknown): v is AncientScholarActivityCommand {
  if (!isRecord(v)) return false;
  if (SIMPLE.includes(String(v.type))) return shape(v, ['type']);
  if (!ANCIENT_SCHOLAR_CASE_IDS.includes(v.caseId as AncientScholarCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export function blockAncientScholarActivity(s: SliceState, c: AncientScholarActivityCommand): string | null {
  if (!validateAncientScholarActivityCommand(c)) return '古代学者实践命令无效；不能传入伪造历史样本、原件或未知人物。';
  if (s.status !== 'ACTIVE' || !ready(s)) return '须本人真实晋升古代学者3并已走到新时代接待处。';
  if (s.activeEvent || s.combat || s.ancientScholar.encounter.status === 'FIGHTING') return '先处理当前事件或同一场真实战斗。';
  const l = s.ancientScholar.life, p = l.practice, id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? l.cases[id] : null;
  if (c.type === 'RETURN_TO_PRESENT') return p.activeCase ? null : '没有当前实践，不能从历史任意返回别处。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.status === 'ACTIVE') return !r || p.activeCase !== id || r.status !== 'ACTIVE' ? '没有这一项真实现场。' : !r.returned || p.ownerAt !== 'PRESENT_MAT' || p.image || p.borrowedReserve || p.shelterRemainingSeconds ? '先实际结束临时效果并返回同一原垫。' : null;
  if (p.ownerAt === 'OWN_HISTORY') return '本人仍藏在唯一真实自身片段，只能先返回现实；不能有两个独立自我。';
  if (c.type === 'FINISH_ORDINARY') return !r || r.status !== 'ACTIVE' || r.returned || r.result !== 'NONE' ? '没有尚待完成的原现场。' : null;
  if (SIMPLE.includes(c.type) && c.type !== 'REFLECT') {
    if (!r || r.status !== 'ACTIVE' || r.method !== 'ABILITY' || r.returned) return '须先实施对应能力实践，已经返回后不能再开效果。';
    if (c.type === 'USE_BORROWED_RESERVE') return id !== 'past-reserve' || p.borrowedReserve < 2 || p.reserveSpent > 0 || p.borrowRemainingSeconds <= 0 ? '没有仍有效且尚未使用的真实临时储备。' : null;
    if (c.type === 'MOVE_TAG_IMAGE') return id !== 'old-tag' || !p.image || p.image.position !== 'NEAR' ? '没有仍在近端的唯一原签影像。' : null;
    if (r.attempted) return '本次能力已经尝试，费用保留；可普通完成或返回收束后下一真实周再试。';
    if (c.type === 'BORROW_PAST') return id !== 'past-reserve' || !hasAncientScholarPastSample(s) || !l.sample!.airBulletKnown ? '缺少本人实际有过且知道空气弹的样本。' : s.spirituality < 2 ? '维持须从真实当下支付2灵性，临时储备不能自供。' : l.sample!.spirituality - (s.spirituality - 2) < 2 ? '过去样本没有可供这次具体行动的2点灵性差额，不凭空增强。' : null;
    if (c.type === 'PROJECT_TAG') return id !== 'old-tag' || !hasAncientScholarTagSource(s) ? '缺少本人亲历且仍可核对的同一普通原签来源。' : p.image ? '初学容量1，不能并存第二个影像。' : s.spirituality < 4 ? '需要真实当下4灵性。' : null;
    if (c.type === 'HIDE_IN_HISTORY') return id !== 'lit-fragment' || !hasAncientScholarFragment(s) ? '没有本人亲历并已点亮的安全片段。' : s.spirituality < 4 ? '需要真实当下4灵性。' : null;
  }
  if (hasAncientScholarLifeLock(s)) return '先实际结束当前现场并返回现实。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有可以取消的本项准备。';
  if (Object.entries(l.cases).some(([key, value]) => value.status === 'PREPARED' && key !== id)) return '先实施或取消另一项真实准备。';
  if (s.health <= 0 || s.mind <= 0) return '须先有实际可行动的身体和精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已经反思过，不能重领奖励。' : ANCIENT_SCHOLAR_CASE_IDS.some(k => l.cases[k].status !== 'RESOLVED') ? '先完成三份不同的真实报告。' : null;
  if (!r || !id) return '未知实践。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重领奖励。';
  if (c.type === 'OBSERVE') {
    if (id === 'past-reserve' && (s.ancientScholar.ritual.records.length !== 3 || s.ancientScholar.ritual.records.some(a => a.verifiedDate === null || a.copyId === null))) return '先有三份已经本人真实核验并保留可读副本的原史料；名字不是真实历史。';
    const previous = ANCIENT_SCHOLAR_CASE_IDS[ANCIENT_SCHOLAR_CASE_IDS.indexOf(id) - 1];
    if (r.status !== 'AVAILABLE') return '同一真实观察已经保留。';
    if (previous && l.cases[previous].status !== 'RESOLVED') return '先完成前一项实际报告。';
    if (id === 'old-tag' && (s.bizarroSorcerer.life.practice.tag.holder !== 'CARRIER' || s.bizarroSorcerer.life.practice.carrier.holder !== 'OWNER')) return '同一原签必须仍在本人原携笼，不替换所有权。';
    return null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本项真实来源。' : r.attemptWeek === s.week ? '本周已经实施，收束后下一真实周才可再试。' : null;
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' ? '先准备本项。' : id === 'past-reserve' && r.method === 'ABILITY' && (!hasAncientScholarPastSample(s) || !l.sample!.airBulletKnown || s.spirituality < 6) ? '此演示先实耗4灵性施两次既有空气弹，还需保留2当下灵性维持借力；可取消改普通。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '先取得实际结果、结束全部效果并收束。';
  return '当前不能进行这项实践。';
}
export const ancientScholarActivityReason = blockAncientScholarActivity;
export function applyAncientScholarActivity(s: SliceState, c: AncientScholarActivityCommand, ctx: SeerContext,
  award?: (id: AncientScholarLifeAbilityId, amount: number) => void): void {
  const reason = blockAncientScholarActivity(s, c); if (reason) throw new Error(reason);
  const l = s.ancientScholar.life, p = l.practice, id = 'caseId' in c ? c.caseId : p.activeCase, r = id ? l.cases[id] : null;
  if (c.type === 'RETURN_TO_PRESENT') {
    p.ownerAt = 'PRESENT_MAT'; p.borrowedReserve = 0; p.borrowRemainingSeconds = 0; p.image = null; p.shelterRemainingSeconds = 0; p.elapsedSeconds = Math.max(p.elapsedSeconds, 30); r!.returned = true;
    ctx.note('同一身体回到原垫，全部临时效果结束', '实际经过最多30秒G；本人从自己原片段回到同一安全原垫，或沿桌边原两米路走回。唯一影像消散、剩余借力失去；原签仍在本人携笼，原H/M/S不补回，费用不退。'); return;
  }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (r!.status === 'ACTIVE') { r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; p.activeCase = null; }
    else { r!.status = 'OBSERVED'; r!.method = null; }
    if (c.type === 'WITHDRAW') r!.withdrawals++;
    ctx.note('真实收束接待处实践', '本人、原物和物权均在原处，能力已停止；费用、失败与原身体状态保留。'); return;
  }
  if (c.type === 'FINISH_ORDINARY') { r!.result = 'ORDINARY'; ctx.note('亲自普通完成同一事项', id === 'past-reserve' ? '手工对照已核史料和自己的真实记录，不施法也不恢复灵性。' : id === 'old-tag' ? '本人沿两米桌边路搬运自己的原携笼再走回，原签始终在笼内，没有影像或所有权变化。' : '本人在净空原垫边普通迈步、退回，确认同一实际出口，不进入历史。'); return; }
  if (c.type === 'USE_BORROWED_RESERVE') { p.borrowedReserve -= 2; p.reserveSpent = 2; p.borrowRemainingSeconds = 20; p.elapsedSeconds = 10; r!.result = 'ABILITY'; ctx.note('借来的2点只用于既有空气弹', `从临时储备实耗2，对原空砂盘使用自己样本中已有的有限空气弹；真实灵性仍为${s.spirituality}，健康精神不变，剩余储备最多再存20秒后失去，不能支付借力维持。`); return; }
  if (c.type === 'MOVE_TAG_IMAGE') { p.image!.position = 'FAR'; p.elapsedSeconds = 10; r!.result = 'ABILITY'; ctx.note('唯一历史影像被实际搬到两米桌角', `${p.image!.id}只是BR4-TAG-1的1克普通历史影像。原签仍在BR4-CARRIER-1，未改原物、物权或历史；还须实际返回并让30秒G时限结束。`); return; }
  if (c.type === 'BORROW_PAST' || c.type === 'PROJECT_TAG' || c.type === 'HIDE_IN_HISTORY') {
    const cost = c.type === 'BORROW_PAST' ? 2 : 4; s.spirituality -= cost; r!.attempted = true; r!.outcome = ctx.check('knowledge', 14).tier;
    if (success(r!.outcome)) {
      if (c.type === 'BORROW_PAST') { p.borrowedReserve = Math.min(6, Math.max(0, l.sample!.spirituality - s.spirituality)); p.borrowRemainingSeconds = 30; }
      else if (c.type === 'PROJECT_TAG') p.image = { id: `${s.runId}:AS3-IMAGE:${s.revision}`, sourceId: 'BR4-TAG-1', massGrams: 1, remainingSeconds: 30, position: 'NEAR' };
      else { p.ownerAt = 'OWN_HISTORY'; p.shelterRemainingSeconds = 10; r!.result = 'ABILITY'; }
    }
    ctx.note(c.type === 'BORROW_PAST' ? '短时借回亲历样本的有限余力' : c.type === 'PROJECT_TAG' ? '召唤同一普通原签的短时影像' : '本人短时藏入已点亮自身片段', `当下真实灵性实耗${cost}，知识14判定${r!.outcome}（G）。${success(r!.outcome) ? c.type === 'BORROW_PAST' ? `只有临时储备${p.borrowedReserve}，最多30秒，不写入真实灵性。` : c.type === 'PROJECT_TAG' ? '初学仅1个普通影像，最多30秒；原件留在原携笼。' : '仅同一本人离开现实，最多10秒；下一步只能回同一原垫。' : '失败，本人和原物留在现实原位置，费用不退，可普通完成或返回收束。'}`); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('ancient-scholar-reflection'); ctx.note('在历史与现在之间完成反思', '三份不同报告后的25消化G；总计100。知道过去不等于改变过去，也不使旧人复活。'); return; }
  if (c.type === 'OBSERVE') {
    r!.status = 'OBSERVED'; r!.observedWeek = s.week;
    if (id === 'past-reserve') l.sample = { id: `${s.runId}:AS3-SAMPLE:${s.revision}`, bodyId: `${s.runId}:body`, revision: s.revision, week: s.week, sequence: 3, spirituality: s.spirituality, health: s.health, mind: s.mind, airBulletKnown: Object.hasOwn(s.progression.mastery, 'diviner.s7.air-bullet'), airBulletGain: 60, source: 'ACTUAL_RECEPTION_OBSERVATION' };
    if (id === 'old-tag') l.tagFamiliarity = { sourceId: 'BR4-TAG-1', massGrams: 1, observedRevision: s.revision, observedWeek: s.week, source: 'OWN_ORIGINAL_IN_CARRIER' };
    if (id === 'lit-fragment') l.fragment = { id: `${s.runId}:AS3-FRAGMENT:${s.revision}`, bodyId: `${s.runId}:body`, revision: s.revision, week: s.week, place: 'AS3-RECEPTION-MAT', event: 'PERSONALLY_OBSERVED_SAFE_MAT' };
    ctx.note('亲自观察并建立真实来源', CASES.find(x => x.id === id)!.facts.join(' ')); return;
  }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; r!.attempted = false; r!.outcome = null; r!.result = 'NONE'; r!.returned = false; ctx.note('准备有限实践', c.method === 'ABILITY' ? '准备真实来源和同一现场，不生成能力结果。' : '准备亲手普通完成同一事项，不施法。'); return; }
  if (c.type === 'PERFORM') {
    r!.status = 'ACTIVE'; r!.attemptWeek = s.week; p.activeCase = id; p.elapsedSeconds = 0; p.reserveSpent = 0;
    if (id === 'past-reserve' && r!.method === 'ABILITY') s.spirituality -= 4;
    if (r!.method === 'ORDINARY') r!.result = 'ORDINARY';
    ctx.note('进入真实接待处原现场', id === 'past-reserve' && r!.method === 'ABILITY' ? '两次本人既有空气弹实际击打无生命空砂盘，真实灵性−4；随后借力仍须另付当下维持，不退款。' : r!.method === 'ORDINARY' ? '本人沿原桌边与净空垫普通完成核对、搬运或往返；还须明确返回并收束。' : '已付本次现场时间，原物、原垫和安全出口可见；尚未尝试能力。'); return;
  }
  if (c.type === 'REPORT') {
    r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(`ancient-scholar-case:${id}`);
    if (r!.result === 'ABILITY') { const ability = CASES.find(x => x.id === id)!.ability; if (award) award(ability, 8); else s.progression.mastery[ability] = Math.min(500, (s.progression.mastery[ability] ?? 0) + 8); }
    ctx.note('报告实际收束后的有限经历', `本项25消化G，${r!.result === 'ABILITY' ? '本项真实能力掌握+8' : '普通结果不增长能力掌握'}；不重领奖励、不改变历史与原物。`);
  }
}
export function ancientScholarLifeActions(s: SliceState): AncientScholarAction[] {
  if (!ready(s)) return [];
  const out: AncientScholarAction[] = [], l = s.ancientScholar.life;
  const add = (command: AncientScholarActivityCommand, label: string, cost: string) => { const reason = blockAncientScholarActivity(s, command); out.push({ id: `AS3-LIFE:${command.type}:${'caseId' in command ? command.caseId : ''}:${'method' in command ? command.method : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const item of CASES) {
    const r = l.cases[item.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: item.id }, `观察：${item.title}`, '1行动 · 真实建立来源');
    if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: item.id, method: 'ABILITY' }, `准备能力：${item.title}`, '1行动'); add({ type: 'PREPARE', caseId: item.id, method: 'ORDINARY' }, `准备普通：${item.title}`, '1行动 · 不施法'); }
    if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId: item.id }, `实施：${item.title}`, item.id === 'past-reserve' && r.method === 'ABILITY' ? '1行动 · 先实际耗4灵性' : '1行动'); add({ type: 'WITHDRAW', caseId: item.id }, '取消当前准备', '0行动 · 不退款'); }
    if (r.status === 'ACTIVE') {
      if (r.method === 'ABILITY') {
        if (item.id === 'past-reserve') { add({ type: 'BORROW_PAST' }, '借自己真实过去的有限储备', '0行动 · 当下2灵性 · 知识14'); add({ type: 'USE_BORROWED_RESERVE' }, '消耗临时2储备作一次已有空气弹', '0行动 · 不增加真实灵性'); }
        if (item.id === 'old-tag') { add({ type: 'PROJECT_TAG' }, '召唤已亲历普通原签的唯一影像', '0行动 · 当下4灵性 · 知识14'); add({ type: 'MOVE_TAG_IMAGE' }, '把唯一影像搬到两米桌角', '0行动 · 原件不动'); }
        if (item.id === 'lit-fragment') add({ type: 'HIDE_IN_HISTORY' }, '本人藏进已点亮真实片段', '0行动 · 当下4灵性 · 知识14');
      }
      if (r.result === 'NONE') add({ type: 'FINISH_ORDINARY' }, '改由本人普通完成本项', '0行动 · 不施法');
      add({ type: 'RETURN_TO_PRESENT' }, '返回同一原垫并结束全部临时效果', '0行动 · 费用保留'); add({ type: 'CLOSE', caseId: item.id }, '实际收束本项原现场', '0行动 · 须先返回');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: item.id }, `报告：${item.title}`, '1行动 · 消化25G');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思三份不同经历与过去的边界', '1行动 · 三报告后消化25G');
  return out;
}
export function projectAncientScholarLife(s: SliceState): AncientScholarLifeProjection {
  if (!isAncientScholarStage(s) && !hasAttendantHistory(s)) return { insideCase: false, environment: '', cases: [], practice: null };
  const l = s.ancientScholar.life;
  return { insideCase: hasAncientScholarLifeLock(s), environment: ANCIENT_SCHOLAR_LIFE_ENVIRONMENT,
    cases: CASES.map(c => { const r = l.cases[c.id]; return { id: c.id, title: c.title, story: c.story, observations: r.status === 'AVAILABLE' ? [] : [...c.facts], status: r.status,
      preparation: r.status === 'PREPARED' ? `${r.method === 'ABILITY' ? '真实能力' : '普通手工'}准备完成，尚待实施。` : null,
      result: r.result === 'NONE' ? r.attempted ? `能力${r.outcome}，代价保留。` : null : `${r.result === 'ABILITY' ? '有限能力已实际完成' : '普通方法已完成'}；${r.returned ? '已经回到原垫、效果停止' : '仍须返回并结束效果'}。`, contactOpen: r.status === 'ACTIVE' ? '原现场尚未收束' : '没有未结束现场', closes: r.closes }; }),
    practice: { ...structuredClone(l.practice), sample: structuredClone(l.sample), fragment: structuredClone(l.fragment), facts: [
      `本人：${l.practice.ownerAt === 'OWN_HISTORY' ? '仅同一身体暂藏自己的真实片段' : '新时代接待处原垫'}；不会有两个独立自我。`,
      `临时储备${l.practice.borrowedReserve}，真实灵性${s.spirituality}；维持只花真实当下资源，不永久补满。`,
      `初晋容量1、普通影像最多30秒G；原BR4-TAG-1始终在本人BR4-CARRIER-1中。`,
      '藏身最多10秒G，仅回同一安全现场；原铜铃、已死旧人、高位人物与未知秘密均不在历史影像来源中。' ] } };
}
export function validateAncientScholarLife(s: SliceState): boolean {
  try {
    const l = s.ancientScholar.life, p = l.practice;
    if (!isRecord(l) || !shape(l, ['cases', 'reflected', 'sample', 'fragment', 'tagFamiliarity', 'practice']) || typeof l.reflected !== 'boolean' || !isRecord(l.cases) || !shape(l.cases, ANCIENT_SCHOLAR_CASE_IDS)) return false;
    if (!isRecord(p) || !shape(p, ['activeCase', 'ownerAt', 'borrowedReserve', 'reserveSpent', 'borrowRemainingSeconds', 'image', 'shelterRemainingSeconds', 'elapsedSeconds']) || ![null, ...ANCIENT_SCHOLAR_CASE_IDS].includes(p.activeCase) || !['PRESENT_MAT', 'OWN_HISTORY'].includes(p.ownerAt) || !integer(p.borrowedReserve, 0, 6) || ![0, 2].includes(p.reserveSpent) || ![0, 20, 30].includes(p.borrowRemainingSeconds) || ![0, 10].includes(p.shelterRemainingSeconds) || !integer(p.elapsedSeconds, 0, 30)) return false;
    if (l.sample !== null && (!hasAncientScholarPastSample(s) || !isRecord(l.sample) || !shape(l.sample, ['id', 'bodyId', 'revision', 'week', 'sequence', 'spirituality', 'health', 'mind', 'airBulletKnown', 'airBulletGain', 'source'])) || l.tagFamiliarity !== null && (!hasAncientScholarTagSource(s) || !isRecord(l.tagFamiliarity) || !shape(l.tagFamiliarity, ['sourceId', 'massGrams', 'observedRevision', 'observedWeek', 'source'])) || l.fragment !== null && (!hasAncientScholarFragment(s) || !isRecord(l.fragment) || !shape(l.fragment, ['id', 'bodyId', 'revision', 'week', 'place', 'event']))) return false;
    let resolved = 0, open = 0, prepared = 0;
    for (const [i, id] of ANCIENT_SCHOLAR_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!isRecord(r) || !shape(r, ['status', 'observedWeek', 'attemptWeek', 'method', 'result', 'attempted', 'outcome', 'returned', 'closes', 'withdrawals']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || ![null, 'SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(r.outcome) || typeof r.attempted !== 'boolean' || typeof r.returned !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals)) return false;
      if (r.observedWeek !== null && !integer(r.observedWeek, s.ancientScholar.promotionWeek ?? 0, s.week) || r.attemptWeek !== null && !integer(r.attemptWeek, r.observedWeek ?? 0, s.week)) return false;
      if (r.status === 'AVAILABLE' ? stableStringify(r) !== stableStringify(freshCase()) : r.observedWeek === null || s.ancientScholar.promotionWeek === null || (i > 0 && l.cases[ANCIENT_SCHOLAR_CASE_IDS[i - 1]!].status !== 'RESOLVED')) return false;
      if ((id === 'past-reserve' ? l.sample !== null : id === 'old-tag' ? l.tagFamiliarity !== null : l.fragment !== null) !== (r.status !== 'AVAILABLE')) return false;
      if (r.attempted !== (r.outcome !== null) || r.attempted && r.method !== 'ABILITY' || r.result === 'ABILITY' && (!r.attempted || !success(r.outcome))) return false;
      if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.attempted || r.returned || r.result !== 'NONE') return false; }
      if (r.status === 'ACTIVE') { open++; if (p.activeCase !== id || !ready(s) || s.status !== 'ACTIVE' || s.combat || s.activeEvent || r.attemptWeek !== s.week || r.method === null) return false; }
      if (['ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) && r.attemptWeek === null) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.returned || r.result === 'NONE' || r.closes < 1)) return false;
      if (r.status === 'RESOLVED') resolved++;
      if (s.seer.completedSources.filter(x => x === `ancient-scholar-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    }
    if (open > 1 || prepared > 1 || open && prepared || (p.activeCase !== null) !== (open === 1)) return false;
    const active = p.activeCase ? l.cases[p.activeCase] : null;
    if (!active || active.returned) { if (p.ownerAt !== 'PRESENT_MAT' || p.borrowedReserve || p.borrowRemainingSeconds || p.image || p.shelterRemainingSeconds) return false; }
    if (p.borrowedReserve || p.borrowRemainingSeconds) { if (p.activeCase !== 'past-reserve' || !success(active!.outcome) || active!.returned || p.borrowedReserve > Math.min(6, l.sample!.spirituality) - p.reserveSpent) return false; }
    if (p.image && (!isRecord(p.image) || !shape(p.image, ['id', 'sourceId', 'massGrams', 'remainingSeconds', 'position']) || p.activeCase !== 'old-tag' || !success(active!.outcome) || p.image.sourceId !== 'BR4-TAG-1' || p.image.massGrams !== 1 || p.image.remainingSeconds !== 30 || !p.image.id.startsWith(`${s.runId}:AS3-IMAGE:`) || !['NEAR', 'FAR'].includes(p.image.position))) return false;
    if ((p.ownerAt === 'OWN_HISTORY') !== (p.shelterRemainingSeconds === 10) || p.ownerAt === 'OWN_HISTORY' && (p.activeCase !== 'lit-fragment' || !success(active!.outcome) || !hasAncientScholarFragment(s))) return false;
    if (s.seer.completedSources.filter(x => x === 'ancient-scholar-reflection').length !== (l.reflected ? 1 : 0) || l.reflected && resolved !== 3) return false;
    if (s.ancientScholar.promotionWeek === null && stableStringify(l) !== stableStringify(createAncientScholarLifeState())) return false;
    const retained = s.progression.pathwayId === 'diviner' && s.progression.sequence === 2 || hasAttendantHistory(s);
    const acting = retained ? s.miracleWorker.ancientActingAtPromotion : s.progression.acting;
    return (!isAncientScholarStage(s) && !retained) || acting === resolved * 25 + (l.reflected ? 25 : 0);
  } catch { return false; }
}
