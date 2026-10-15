import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { MisfortuneMageAbilityId } from './types.js';

export const MISFORTUNE_MAGE_CASE_IDS = ['uncertain-weight', 'willing-throw', 'honest-forecast'] as const;
export type MisfortuneMageCaseId = typeof MISFORTUNE_MAGE_CASE_IDS[number];
export type MisfortuneMageActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: MisfortuneMageCaseId }
  | { type: 'PREPARE'; caseId: MisfortuneMageCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'SECURE_WEIGHT'; caseId: 'uncertain-weight' }
  | { type: 'RETURN_BAG' | 'WITHDRAW_CONSENT'; caseId: 'willing-throw' }
  | { type: 'CONFIRM_ACCOUNT'; caseId: 'honest-forecast'; claim: 'LIMITED' | 'GUARANTEED' }
  | { type: 'ACCUMULATE' }
  | { type: 'REFLECT' };
export interface MisfortuneMageLifeAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; success: boolean;
  actionCost: 1; spiritualityCost: 0 | 3 | 5; luckSpent: 0 | 1;
  outcome: 'POSSIBLE_SLIP' | 'INCONCLUSIVE' | 'INSPECTED' | 'HIT' | 'MISS' | 'ACCOUNT';
  secured: boolean; returned: boolean; consentWithdrawn: boolean;
  accountConfirmed: boolean; rejectedClaims: number;
}
export interface MisfortuneMageCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean;
  preparations: number; withdrawals: number; closes: number; attempts: MisfortuneMageLifeAttempt[];
}
/** These are immutable observations of changes to winner.luck, never a second spendable reserve. */
export interface MisfortuneMageAccumulation {
  week: number; actionCost: 1; storedBefore: number; storedAfter: number; accumulatedAfter: number; spentAtTime: number;
}
export interface MisfortuneMageLifeState {
  cases: Record<MisfortuneMageCaseId, MisfortuneMageCaseState>; reflected: boolean;
  weight: {
    id: 'MM4-WEIGHT-1'; owner: 'GUIDE'; position: 'GUIDE' | 'SUSPENDED' | 'TRAY';
    cordId: 'MM4-CORD-1'; cordHolder: 'GUIDE' | 'PLAYER'; cordIntact: true;
    trayId: 'MM4-PADDED-TRAY-1'; permission: boolean; resets: number; handovers: number;
  };
  bag: {
    id: 'MM4-BAG-1'; owner: 'SELLA'; position: 'OWNER' | 'MAT';
    consented: boolean; effectActive: boolean; distanceMetres: number; handovers: number;
    consentWithdrawals: number; cancelledConsents: number;
  };
  note: { id: 'MM4-NOTE-1'; owner: 'GUIDE'; holder: 'GUIDE' | 'PLAYER'; writings: string[]; handovers: number; accepted: boolean };
  accumulations: MisfortuneMageAccumulation[];
}
export interface MisfortuneMageLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MisfortuneMageActivityCommand }
export interface MisfortuneMageLifeProjection {
  cases: { id: MisfortuneMageCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: null | { weight: string; cord: string; bag: string; consent: string; note: string; route: string; history: string[] };
  luck: SliceState['winner']['luck'] & { capacity: 3; summary: string };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const active = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 4;
const last = (r: MisfortuneMageCaseState) => r.attempts.at(-1);
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const source = (id: MisfortuneMageCaseId) => `misfortune-mage-case:${id}`;
const emptyCase = (): MisfortuneMageCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const complete = (id: MisfortuneMageCaseId, r: MisfortuneMageCaseState) => !!last(r)?.success && (id !== 'honest-forecast' || last(r)!.accountConfirmed);
const abilityIds: Partial<Record<MisfortuneMageCaseId, MisfortuneMageAbilityId>> = { 'uncertain-weight': 'wheel.s4.precaution-practice', 'willing-throw': 'wheel.s4.bounded-misfortune' };
const CASES = [
  {
    id: 'uncertain-weight', title: '同一原砝码的不确定预警与普通落稳',
    story: '原成年导师艾妲·芬恩本人在贝克兰德原报时铺，把自己的MM4-WEIGHT-1小钟砝码与完好的同一MM4-CORD-1展示在原工作台软接盘上方。落点下方无人，她只允许一次有软盘兜底的有限演示。（原创G）',
    facts: ['预警成功只记录可能滑落的征兆，失败只记录未能确认；不查看未来骰点，不保证将来必定发生或不会发生。', '能力1行动3灵性、知识18；普通检查1行动0灵性、知识10。无论成功失败，SECURE_WEIGHT都须本人用同一原绳普通放低原砝码至同一软盘，再亲手交还。', '失败下个真实周重试，由在场原主人把同一砝码和原绳重新设好并记实际复位次数；没有凭空生绳、复制砝码或主动制造灾难。'],
    ability: '准备一次G继承危险预感的有限练习；实施1行动3灵性、知识18，不花幸运，不预测必然结果。',
    ordinary: '准备普通检查原绳与原砝码；实施1行动0灵性、知识10。普通固定和归还都要实际完成。',
  },
  {
    id: 'willing-throw', title: '塞拉新同意的一次原豆袋投掷',
    story: '同一原成年塞拉Sella本人重新同意一次可撤回的有限试验。她用自己新的原豆袋MM4-BAG-1向软垫上方的低木桩投一次；旧WN5-RING-1原环仍由她保管，不参加本次试验。（原创G）',
    facts: ['此次同意只涵盖这一投；实施时再次向在场本人核实，不凭旧案或跨周准备延长许可，不控制她的意志。', '能力1行动5灵性加1份winner.luck实际原储备、知识18；成功这一次MISS，失败仍实际HIT。普通知识10观察一次HIT。HIT/MISS为本场明确G固定对照，不等于全局保证。', '每次真实投完同一豆袋都落在两米外原软垫MAT。本人普通走两米、拾起同一原袋、走两米返回并亲手交给塞拉；失败也必须真实四米取回，撤回同意不能让原袋瞬移。'],
    ability: '准备这一次有限G厄运实践；实施1行动5灵性、1份旧幸运、知识18，失败照付不退款。',
    ordinary: '准备普通观察塞拉本人同意的一次原袋投掷；实施1行动0灵性、0幸运、知识10，不施加厄运。',
  },
  {
    id: 'honest-forecast', title: '同一张原纸上的有限结论',
    story: '艾妲保留新的同一MM4-NOTE-1记录纸。你只记录已经发生的砝码预警、塞拉这一投、成功失败和旧幸运账的实际支出；旧WN5-NOTE-1记录不动。（原创G）',
    facts: ['只允许普通知识10书写，没有文字施法、重抽、治愈或免费积运。能力失败及实际成本都保留，不许写成成功。', '实施时导师亲手递同一原纸给本人，失败文字也留在原纸；下周重试只更正这张纸，保留此前文字。', 'LIMITED仅确认本次所见与未确认范围；GUARANTEED会被当面拒绝，原纸与原记录保留、接触不结束，也不重新判定。CLOSE须亲手交回同一张纸。'],
    ability: null,
    ordinary: '准备普通书写真实所见和有限范围；实施1行动0灵性、知识10，再确认LIMITED并实际交回原纸。',
  },
] as const;
export const MISFORTUNE_MAGE_LIFE_ENVIRONMENT = '厄运法师4沿用既有候选编号；本次未在原文核实直接编号或新增职业能力细表，第六部第77章仅有混合封印物特征的试探称呼，完整配方和仪式未知。以下三场与新掌握都是原创G扩展练习，不是原著完整S4。观察、准备、实施、报告各1行动；普通0灵性知识10，预警能力3灵性知识18，单投厄运5灵性及1份真实旧幸运知识18。失败照付，下个真实周才能重试同一原物。0行动安全固定、真实四米取回与交还属于已付实践收束，零灵性仍可完成，不治疗、不退款。三份成功且实际收束的报告各G扮演25，前两项能力报告各对应新掌握8，普通方法不给能力掌握；最后反思25。积运只能回到原艾妲所在贝克兰德报时铺，1行动、0灵性，每实际周一次且最多3份，继续修改唯一winner.luck原账。没有第二幸运池、概率骰子、重抽、回溯、永久诅咒、保证成功或自动等量厄运债。';

export function createMisfortuneMageLifeState(): MisfortuneMageLifeState {
  return {
    cases: { 'uncertain-weight': emptyCase(), 'willing-throw': emptyCase(), 'honest-forecast': emptyCase() }, reflected: false,
    weight: { id: 'MM4-WEIGHT-1', owner: 'GUIDE', position: 'GUIDE', cordId: 'MM4-CORD-1', cordHolder: 'GUIDE', cordIntact: true, trayId: 'MM4-PADDED-TRAY-1', permission: false, resets: 0, handovers: 0 },
    bag: { id: 'MM4-BAG-1', owner: 'SELLA', position: 'OWNER', consented: false, effectActive: false, distanceMetres: 0, handovers: 0, consentWithdrawals: 0, cancelledConsents: 0 },
    note: { id: 'MM4-NOTE-1', owner: 'GUIDE', holder: 'GUIDE', writings: [], handovers: 0, accepted: false }, accumulations: [],
  };
}
const oldOpen = (s: SliceState) => Object.values(s.winner.cases).some(r => r.contactOpen || r.status === 'PREPARED')
  || Object.values(s.calamityPriest.cases).some(r => r.contactOpen) || Object.values(s.lucky.cases).some(r => r.contactOpen)
  || Object.values(s.machine.cases).some(r => r.contactOpen) || Object.values(s.monster.cases).some(r => r.contactOpen)
  || [s.monster, s.machine, s.lucky, s.calamityPriest].some(stage => Object.values(stage.cases).some(r => r.status === 'PREPARED'))
  || s.calamityPriest.practice.board === 'UNSTABLE' || s.calamityPriest.practice.board === 'FALLEN' || s.calamityPriest.practice.contact === 'FOCUSED'
  || s.winner.practice.counter !== 'GUIDE' || s.winner.practice.ring !== 'OWNER' || s.winner.practice.note === 'WRITTEN';
export function hasMisfortuneMageLifeLock(s: SliceState): boolean {
  const l = s.misfortuneMage.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.weight.position !== 'GUIDE' || l.weight.cordHolder !== 'GUIDE' || l.bag.position !== 'OWNER' || l.bag.effectActive || l.note.holder !== 'GUIDE';
}
export function validateMisfortuneMageActivityCommand(c: unknown): c is MisfortuneMageActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'ACCUMULATE' || c.type === 'REFLECT') return shape(c, ['type']);
  if (!MISFORTUNE_MAGE_CASE_IDS.includes(c.caseId as MisfortuneMageCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'CONFIRM_ACCOUNT') return c.caseId === 'honest-forecast' && shape(c, ['type', 'caseId', 'claim']) && ['LIMITED', 'GUARANTEED'].includes(c.claim as string);
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)
    || c.type === 'SECURE_WEIGHT' && c.caseId === 'uncertain-weight' || ['RETURN_BAG', 'WITHDRAW_CONSENT'].includes(c.type as string) && c.caseId === 'willing-throw');
}
export function misfortuneMageActivityReason(s: SliceState, c: MisfortuneMageActivityCommand): string | null {
  if (!validateMisfortuneMageActivityCommand(c)) return '厄运法师G实践命令无效。';
  if (!active(s)) return '先完成候选厄运法师晋升。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (oldOpen(s)) return '先实际结束原先阶段的接触，并交还原木筹、原环与原纸。';
  if (s.world.city !== 'BACKLUND' || !s.winner.guidanceKnown || !s.misfortuneMage.guidanceKnown) return '原艾妲与塞拉只在贝克兰德原报时铺当面参与，不能召来异地。';
  const l = s.misfortuneMage.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r ? last(r) : undefined;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只可取消尚未实施的准备。';
  if (c.type === 'WITHDRAW_CONSENT') return l.bag.consented && (r?.status === 'PREPARED' || r?.contactOpen) ? null : '没有仍待实施或收束的这一次本人同意。';
  if (c.type === 'SECURE_WEIGHT') return r?.contactOpen && a && !a.secured && l.weight.position === 'SUSPENDED' ? null : '没有尚待用同一原绳实际放稳的原砝码。';
  if (c.type === 'RETURN_BAG') return r?.contactOpen && a && !a.returned && l.bag.position === 'MAT' ? null : '同一原豆袋没有尚待完成的实际四米取回。';
  if (c.type === 'CONFIRM_ACCOUNT') return r?.contactOpen && a && !a.accountConfirmed && l.note.holder === 'PLAYER' ? null : '先实际在同一原纸书写；已接受的有限结论不能无限重复修正。';
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen || !a || a.week !== s.week) return '没有尚待结束的本次真实接触；未实施准备可0行动取消。';
    if (c.caseId === 'uncertain-weight' && !a.secured) return '先0行动用同一原绳实际把原砝码放低至同一软盘。';
    if (c.caseId === 'willing-throw' && !a.returned) return '先0行动普通走两米拾起同一原豆袋，再走两米亲手还给塞拉。';
    return null;
  }
  if (hasMisfortuneMageLifeLock(s)) return '先0行动安全固定、实际取回或亲手交还本次原物；不能在接触中积运或继续其它普通活动。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已付实践的0行动收束不受此限制。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = MISFORTUNE_MAGE_CASE_IDS.find(id => l.cases[id].status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared)) return '先实施或0行动取消当前准备。';
  if (c.type === 'ACCUMULATE') return s.winner.luck.stored >= 3 ? '唯一旧幸运储备已达3份上限。' : s.winner.luck.lastAccumulateWeek === s.week ? '本真实周已实际积运，下一真实周才能再积累。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '已经回看这三项经历。' : MISFORTUNE_MAGE_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本案已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const index = MISFORTUNE_MAGE_CASE_IDS.indexOf(c.caseId);
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : index > 0 && l.cases[MISFORTUNE_MAGE_CASE_IDS[index - 1]!].status !== 'RESOLVED' ? '先完成前一份真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场；已有成功结果直接报告。'
    : a?.week === s.week ? '本周本项已经实际尝试，失败下一真实周再试同一原物。'
      : c.caseId === 'honest-forecast' && c.method === 'ABILITY' ? '有限记录只允许普通书写，不能把文字变成新能力。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && complete(c.caseId, r) && !!a?.returned ? null : '先取得真实成功、确认有限范围并实际归还原物。';
  if (r.status !== 'PREPARED' || r.method === null) return '先准备这一次有限实践。';
  const cost = r.method === 'ABILITY' ? c.caseId === 'uncertain-weight' ? 3 : 5 : 0;
  if (s.spirituality < cost) return `本次能力需要${cost}灵性，不能透支；可0行动取消准备。`;
  if (c.caseId === 'willing-throw' && r.method === 'ABILITY' && s.winner.luck.stored < 1) return '本次能力需要1份真实旧幸运；可0行动取消，再实际积运或改用普通方法。';
  if (c.caseId === 'uncertain-weight' && !l.weight.permission || c.caseId === 'willing-throw' && !l.bag.consented) return '原主人许可或塞拉的本次同意已结束，须重新准备。';
  return null;
}

export function applyMisfortuneMageActivity(s: SliceState, c: MisfortuneMageActivityCommand, ctx: SeerContext, award: (id: MisfortuneMageAbilityId, amount?: number) => void): void {
  const reason = misfortuneMageActivityReason(s, c);
  if (reason) throw new Error(reason);
  if (!validateMisfortuneMageLife(s)) throw new Error('厄运法师原现场与实际历史不一致。');
  const l = s.misfortuneMage.life;
  if (c.type === 'ACCUMULATE') {
    const luck = s.winner.luck, before = luck.stored;
    s.actionsRemaining -= 1; luck.stored += 1; luck.accumulated += 1; luck.lastAccumulateWeek = s.week;
    l.accumulations.push({ week: s.week, actionCost: 1, storedBefore: before, storedAfter: luck.stored, accumulatedAfter: luck.accumulated, spentAtTime: luck.spent });
    ctx.note('在原艾妲指导室继续实际积运', `在场原艾妲指导你度过平静节制时间，实耗1行动、0灵性。唯一winner.luck原账：储备${before}→${luck.stored}/3，累计积累${luck.accumulated}、累计支出${luck.spent}。本真实周不再积运；没有治疗、补充灵性、能力掌握或第二储备。`); return;
  }
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('misfortune-mage-reflection');
    ctx.note('回看不确定预警、本人许可与有限记录', '三份成功且实际收束的报告保留，G扮演+25。预警不是必然预知，厄运只限这一投，文字不制造能力。原著编号与完整能力仍未核明；不重开旧案、不恢复伤势或幸运，不宣称无风险消化。'); return;
  }
  const r = l.cases[c.caseId], p = CASES.find(p => p.id === c.caseId)!, a = last(r);
  if (c.type === 'WITHDRAW' || c.type === 'WITHDRAW_CONSENT' && r.status === 'PREPARED') {
    r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'uncertain-weight') l.weight.permission = false;
    if (c.caseId === 'willing-throw') {
      l.bag.consented = false; l.bag.effectActive = false;
      if (c.type === 'WITHDRAW_CONSENT') { l.bag.consentWithdrawals += 1; l.bag.cancelledConsents += 1; }
    }
    ctx.note('取消尚未实施的一次准备', '当面结束这次许可，原物仍由原主人保管；未投掷、未施法、未取纸，不补扣灵性或幸运，也不退已付观察与准备行动。下次须重新当面约定。'); return;
  }
  if (c.type === 'SECURE_WEIGHT') {
    a!.secured = true; l.weight.position = 'TRAY';
    ctx.note('用同一原绳普通放稳原砝码', '你本人握同一条完好的MM4-CORD-1，把同一MM4-WEIGHT-1缓缓放低到原软接盘。预警失败也能这样普通固定；没有新绳或远程搬移，仍须亲手交还艾妲。'); return;
  }
  if (c.type === 'RETURN_BAG') {
    a!.returned = true; l.bag.position = 'OWNER'; l.bag.distanceMetres += 4; l.bag.handovers += 1;
    ctx.note('本人普通走四米取回同一原豆袋', '你从原位置普通走两米至MAT，亲手拾起同一MM4-BAG-1，再普通走两米返回并亲手交给原塞拉，共四米。无论HIT/MISS或检定失败都保留这条真实路线；没有召回、复制或移动旧原环，仍须结束本次同意。'); return;
  }
  if (c.type === 'WITHDRAW_CONSENT') {
    a!.consentWithdrawn = true; l.bag.consented = false; l.bag.effectActive = false; l.bag.consentWithdrawals += 1;
    ctx.note('塞拉本人撤回本次同意', '立即结束这一次临时效果与继续实践的许可，已经投出的真实结果和费用保留。原豆袋若仍在MAT，必须本人实际四米取回后才能结束，没有自动退款或原袋瞬移。'); return;
  }
  if (c.type === 'CONFIRM_ACCOUNT') {
    if (c.claim === 'GUARANTEED') {
      a!.rejectedClaims += 1;
      ctx.note('保证未来的说法被当面拒绝', '艾妲拒绝GUARANTEED：本次征兆与一次投掷不能保证未知未来，失败不能写成成功。同一MM4-NOTE-1仍在本人手中，原文字保留，接触继续；没有重抽、成长、退款或新增权柄。'); return;
    }
    a!.accountConfirmed = true; l.note.accepted = true;
    if (a!.success) r.status = 'EXAMINED';
    ctx.note('确认同纸有限范围LIMITED', '只认可已经真实记录的这一组观察、费用与不确定范围；未核对成功的书写仍不能报告，下个真实周在同一原纸更正。没有新判定、重抽或能力，接下来亲手交回。'); return;
  }
  if (c.type === 'CLOSE') {
    r.contactOpen = false; r.closes += 1; a!.returned = true;
    if (c.caseId === 'uncertain-weight') {
      l.weight.position = 'GUIDE'; l.weight.cordHolder = 'GUIDE'; l.weight.permission = false; l.weight.handovers += 1;
      ctx.note('亲手交回同一原砝码与原绳', '从同一原软盘拿起已实际放稳的MM4-WEIGHT-1，连同完好MM4-CORD-1亲手交给当面艾妲。她收妥自己的原物，本次实践到此结束。');
    } else if (c.caseId === 'willing-throw') {
      l.bag.consented = false; l.bag.effectActive = false;
      ctx.note('同一原豆袋已归原主，本次同意结束', '塞拉当面持有已由本人真实四米取回的同一MM4-BAG-1，本次有限许可和临时效果结束。旧原环未动，不宣称解除其它诅咒。');
    } else {
      l.note.holder = 'GUIDE'; l.note.handovers += 1;
      ctx.note('亲手交回同一张新原纸', '把仍含此前真实文字及更正历史的同一MM4-NOTE-1亲手交给艾妲。失败、未确认或被拒的文字不消失；没有复制纸张、远程归还或改写旧WN5原纸。');
    }
    if (!complete(c.caseId, r)) { r.status = 'OBSERVED'; r.method = null; }
    ctx.note('本次0行动真实收束完成', '已付行动、灵性和旧幸运支出保留，不治疗或退款；未成功或未确认范围不能报告，失败下一真实周再试。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    if (c.caseId === 'uncertain-weight') l.weight.permission = true;
    if (c.caseId === 'willing-throw') l.bag.consented = true;
    ctx.note(p.title, p.story + p.facts.join(' ')); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1;
    if (c.caseId === 'uncertain-weight') l.weight.permission = true;
    if (c.caseId === 'willing-throw') l.bag.consented = true;
    ctx.note('准备这一次有限G实践', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '此时只记录方法，原物仍在原主人手中，没有施法；实施时重新核实在场本人当下许可，不用跨周准备延长同意。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(source(c.caseId));
    const ability = abilityIds[c.caseId];
    if (r.method === 'ABILITY' && ability) award(ability, 8);
    ctx.note(p.title, reportText(s, c.caseId) + (r.method === 'ABILITY' ? '本案真实能力报告仅一次对应新掌握+8、G扮演+25。' : '普通方法没有能力掌握，仅一次G扮演+25。')); return;
  }
  const method = r.method!, spiritualityCost = method === 'ABILITY' ? c.caseId === 'uncertain-weight' ? 3 : 5 : 0;
  const luckSpent = method === 'ABILITY' && c.caseId === 'willing-throw' ? 1 : 0;
  s.spirituality -= spiritualityCost;
  if (luckSpent) { s.winner.luck.stored -= 1; s.winner.luck.spent += 1; }
  const passed = success(ctx.check('knowledge', method === 'ABILITY' ? 18 : 10).tier);
  const outcome: MisfortuneMageLifeAttempt['outcome'] = c.caseId === 'uncertain-weight' ? method === 'ABILITY' ? passed ? 'POSSIBLE_SLIP' : 'INCONCLUSIVE' : 'INSPECTED'
    : c.caseId === 'willing-throw' ? method === 'ABILITY' && passed ? 'MISS' : 'HIT' : 'ACCOUNT';
  const attempt: MisfortuneMageLifeAttempt = { week: s.week, method, success: passed, actionCost: 1, spiritualityCost, luckSpent, outcome, secured: c.caseId !== 'uncertain-weight', returned: false, consentWithdrawn: false, accountConfirmed: false, rejectedClaims: 0 };
  r.attempts.push(attempt); r.contactOpen = true; r.status = complete(c.caseId, r) ? 'EXAMINED' : 'OBSERVED';
  if (c.caseId === 'uncertain-weight') {
    if (r.attempts.length > 1) l.weight.resets += 1;
    l.weight.permission = true; l.weight.position = 'SUSPENDED'; l.weight.cordHolder = 'PLAYER';
    ctx.note('同一原砝码的本次实际核对', '艾妲本人重新核实许可，在原软盘上方用同一完好原绳设置同一原砝码，并把原绳交给本人。' + (r.attempts.length > 1 ? '本次是原主人实际复位，已记录；没有替换原物。' : '') + (method === 'ABILITY' ? passed ? '你察觉可能滑落的征兆，不是未来必然结果；仍须普通放稳。' : '预警未能确认，不能写成成功；仍能用同一原绳普通放稳。' : `普通检查${passed ? '核对成功' : '核对失败'}，未使用预警能力；仍须普通放稳。`));
  } else if (c.caseId === 'willing-throw') {
    l.bag.consented = true; l.bag.position = 'MAT'; l.bag.effectActive = method === 'ABILITY' && passed;
    ctx.note('塞拉新的这一次实际投掷', `当面重新确认塞拉本人的本次可撤回同意，她独立投出同一MM4-BAG-1一次。${method === 'ABILITY' ? passed ? '这一次有限厄运尝试成功，实际MISS' : '付费厄运尝试失败，这一次未受影响且实际HIT' : `普通观察核对${passed ? '成功' : '失败'}，本次实际HIT而没有施法`}；这是明确G固定对照。同一原袋实际在两米外MAT，仍须本人四米取回。唯一旧幸运储备${s.winner.luck.stored}，累计支出${s.winner.luck.spent}；没有控制意志或额外投掷。`);
  } else {
    l.note.holder = 'PLAYER'; l.note.accepted = false;
    const weight = l.cases['uncertain-weight'].attempts.map(x => `W${x.week}:${x.outcome}/${x.success ? '核对成功' : '核对失败'}/实耗${x.spiritualityCost}灵性`).join('；');
    const throws = l.cases['willing-throw'].attempts.map(x => `W${x.week}:${x.outcome}/${x.success ? '核对成功' : '核对失败'}/实耗${x.spiritualityCost}灵性及${x.luckSpent}幸运`).join('；');
    const luck = s.winner.luck;
    l.note.writings.push(`MM4-NOTE-1 W${s.week}：原砝码[${weight}]，原豆袋[${throws}]；唯一旧幸运账累计${luck.accumulated}、支出${luck.spent}、现存${luck.stored}。本次普通书写${passed ? '核对成功' : '核对失败，保留待下周更正'}。只限真实所见，预警不确定，不保证未来，不重抽；失败实际成本不退。`);
    ctx.note('同一张原纸实际书写', '艾妲当面递来同一MM4-NOTE-1，本人实际书写持有，旧原紙未动。' + l.note.writings.at(-1)!);
  }
  ctx.note('本次费用与实际收束', `已实耗1行动/${spiritualityCost}灵性/${luckSpent}份旧幸运，知识${method === 'ABILITY' ? 18 : 10}${passed ? '成功' : '失败'}。失败照付，尚须0行动实际收束；不能把失败写成成功或用撤回同意免除原物归还。`);
}
function reportText(s: SliceState, id: MisfortuneMageCaseId): string {
  const r = s.misfortuneMage.life.cases[id];
  if (id === 'uncertain-weight') return r.method === 'ABILITY' ? '只察觉这一次可能滑落的征兆，已用同一原绳普通放稳同一砝码并亲手交还；不声称必然预知。' : '普通检查同一原绳与砝码成功，实际放稳并亲手交还，没有预警施法。';
  if (id === 'willing-throw') return r.method === 'ABILITY' ? '塞拉新同意的这一次有限厄运实际MISS，失败旧成本仍保留；本人四米取回同一豆袋并归还，许可已结束。' : '普通观察塞拉新同意的一次实际HIT，本人四米取回同一豆袋并归还，没有施加厄运。';
  return '只记录真实预警/投掷与唯一旧幸运账，LIMITED范围已确认，同一新原纸亲手交回；不保证未来，不创造新能力。';
}

export function misfortuneMageLifeActions(s: SliceState): MisfortuneMageLifeAction[] {
  if (!active(s)) return [];
  const out: MisfortuneMageLifeAction[] = [], l = s.misfortuneMage.life;
  const add = (id: string, label: string, cost: string, command: MisfortuneMageActivityCommand) => { const reason = misfortuneMageActivityReason(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('misfortune-mage-accumulate', '在原艾妲指导室继续积累1份旧幸运', '1行动 · 0灵性 · 本真实周一次 · 旧储备上限3', { type: 'ACCUMULATE' });
  for (const p of CASES) {
    const r = l.cases[p.id], a = last(r);
    if (r.contactOpen) {
      if (p.id === 'uncertain-weight' && !a?.secured) add(`${p.id}-secure`, '用同一原绳普通放低原砝码至原软盘', '0行动 · 0额外灵性 · 不依赖预警成功', { type: 'SECURE_WEIGHT', caseId: p.id });
      if (p.id === 'willing-throw') {
        if (!a?.returned) add(`${p.id}-return`, '本人普通走两米拾袋，再走两米亲手归还', '0行动 · 真实四米 · 失败也要取回', { type: 'RETURN_BAG', caseId: p.id });
        if (l.bag.consented) add(`${p.id}-consent`, '接受塞拉撤回同意，立即结束临时效果', '0行动 · 原袋仍须实际取回 · 不退款', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      }
      if (p.id === 'honest-forecast' && !a?.accountConfirmed) {
        add(`${p.id}-limited`, '确认仅限已经实际观察的LIMITED结论', '0行动 · 不重抽 · 不增加能力或保证', { type: 'CONFIRM_ACCOUNT', caseId: p.id, claim: 'LIMITED' });
        add(`${p.id}-guaranteed`, '提出GUARANTEED保证说法并听取核对', '0行动 · 不实保证会被当面拒绝', { type: 'CONFIRM_ACCOUNT', caseId: p.id, claim: 'GUARANTEED' });
      }
      add(`${p.id}-close`, p.id === 'uncertain-weight' ? '亲手交回同一原砝码与完好原绳' : p.id === 'willing-throw' ? '确认原袋已归还并结束本次许可' : '亲手把同一新原纸交给艾妲', '0行动 · 0额外灵性 · 已付真实收束', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '当面核对原人原物与本次有限许可', '1行动 · 旧案同意不能替代新同意', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      if (p.ability !== null) add(`${p.id}-ability`, '准备本次有限G能力实践', `1行动 · 不施法 · 实施另${p.id === 'uncertain-weight' ? '3灵性' : '5灵性及1份旧幸运'}`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备本次普通检查、观察或有限书写', '1行动 · 不施法 · 实施0灵性知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '重新核实当下许可并实际实施一次', r.method === 'ABILITY' ? `1行动 · ${p.id === 'uncertain-weight' ? '3灵性' : '5灵性及1份旧幸运'} · 知识18 · 失败照付` : '1行动 · 0灵性 · 知识10 · 无能力掌握', { type: 'PERFORM', caseId: p.id });
      if (p.id === 'willing-throw') add(`${p.id}-consent`, '投掷前接受塞拉撤回这一次同意', '0行动 · 不投掷 · 不扣灵性或幸运', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备与许可', '0行动 · 原物仍归原主 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告真实成功且实际收束的有限结果', '1行动 · G扮演+25 · 同案仅一次', { type: 'REPORT', caseId: p.id });
  }
  if (!l.reflected) add('misfortune-mage-reflect', '回看三份有限结果与实际成本', '1行动 · 三份报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectMisfortuneMageLife(s: SliceState): MisfortuneMageLifeProjection {
  const l = s.misfortuneMage.life, oldLuck = s.winner.luck;
  const luck: MisfortuneMageLifeProjection['luck'] = { ...oldLuck, capacity: 3, summary: `唯一赢家原幸运账：现存${oldLuck.stored}/3，累计积累${oldLuck.accumulated}、实际支出${oldLuck.spent}；最近实际积运${oldLuck.lastAccumulateWeek === null ? '无' : `W${oldLuck.lastAccumulateWeek}`}。新实践与战斗继续同一原账，不另建幸运池、不自动回满。` };
  if (!(s.progression.pathwayId==='wheel'&&[4,3].includes(s.progression.sequence!))) return { cases: [], insideCase: false, environment: '', practice: null, luck };
  return {
    insideCase: hasMisfortuneMageLifeLock(s), environment: MISFORTUNE_MAGE_LIFE_ENVIRONMENT, luck,
    cases: CASES.map(p => {
      const r = l.cases[p.id], a = last(r);
      const result = a ? `${a.method}/${a.outcome}，核对${a.success ? '成功' : '失败'}；实耗${a.actionCost}行动/${a.spiritualityCost}灵性/${a.luckSpent}份旧幸运。${complete(p.id, r) ? r.contactOpen ? '本次核对已成功，实际归还与收束后才可报告。' : reportText(s, p.id) : p.id === 'honest-forecast' && a.success ? '还须确认LIMITED范围才可报告。' : '没有可报告的成功，失败成本保留，下一真实周才可重试。'}${r.contactOpen ? '当前仍须0行动实际收束。' : '同次原物已实际归还。'}` : r.withdrawals ? '未实施准备已取消，观察与已付准备成本保留。' : null;
      return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '当前实际接触尚未收束，不能普通行动或积运' : '没有尚待收束的实际接触', closes: r.closes };
    }),
    practice: {
      weight: `同一${l.weight.id}属于原艾妲，当前位置${l.weight.position}，原软盘${l.weight.trayId}在原工作台；实际重设${l.weight.resets}次、亲手交还${l.weight.handovers}次。`,
      cord: `同一${l.weight.cordId}完好，当前由${l.weight.cordHolder === 'GUIDE' ? '原艾妲' : '本人'}实际持有；${l.weight.permission ? '本次有限许可已当面核实，实施仍须重核' : '没有继续实践的许可'}。固定使用这条原绳，没有新绳。`,
      bag: `同一${l.bag.id}始终属于原塞拉，当前位置${l.bag.position}；亲手归还${l.bag.handovers}次。旧WN5-RING-1原环不动。`,
      consent: `${l.bag.consented ? '塞拉本人这一次有限同意已记录，实施时重新核实，可随时撤回' : '塞拉本次同意已结束或尚未开始'}；本次临时效果${l.bag.effectActive ? '只限已经发生的这一投，尚待明确结束' : '无'}，本人撤回${l.bag.consentWithdrawals}次。`,
      note: `同一${l.note.id}属于原艾妲，由${l.note.holder === 'GUIDE' ? '原艾妲' : '本人'}持有，实际书写${l.note.writings.length}次、交还${l.note.handovers}次，当前LIMITED${l.note.accepted ? '已确认' : '未确认'}。失败文字保留，旧WN5-NOTE-1不改。`,
      route: `每次真实投掷后都要两米去MAT、两米回来亲手还袋，累计本人真实步行${l.bag.distanceMetres}米；不以撤回同意代替归还。`,
      history: [
        ...MISFORTUNE_MAGE_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => `${id} W${a.week} ${a.method}/${a.outcome}：核对${a.success ? '成功' : '失败'}，实耗1行动/${a.spiritualityCost}灵性/${a.luckSpent}份旧幸运；${a.returned ? '同一原物已实际归还' : '原物仍待真实收束'}${id === 'honest-forecast' ? `，LIMITED${a.accountConfirmed ? '已确认' : '未确认'}，保证说法被拒${a.rejectedClaims}次` : ''}${a.consentWithdrawn ? '，塞拉已撤回本次同意' : ''}。`)),
        ...l.accumulations.map(a => `W${a.week}实耗1行动积运，唯一旧账现存${a.storedBefore}→${a.storedAfter}，当时累计${a.accumulatedAfter}、支出${a.spentAtTime}；这只是实际变化记录，不是另一储备。`),
        ...l.note.writings,
        '旧怪物、机器人、幸运儿、灾祸祭司、赢家的原人物、原物、旧敌与原故事不改；只有唯一winner.luck按新真实行动继续更新。',
      ],
    },
  };
}

/** Validates finite paid attempts and physical exits; the only authoritative reserve is winner.luck. */
export function validateMisfortuneMageLife(s: SliceState): boolean {
  try {
    const l = s.misfortuneMage.life, start = s.misfortuneMage.promotionWeek;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'weight', 'bag', 'note', 'accumulations']) || !record(l.cases) || !shape(l.cases, MISFORTUNE_MAGE_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (start === null) return stableStringify(l) === stableStringify(createMisfortuneMageLifeState());
    if (!integer(start, 1, s.week)) return false;
    const luck = s.winner.luck;
    if (!integer(luck.stored, 0, 3) || !integer(luck.accumulated) || !integer(luck.spent, 0, luck.accumulated) || luck.stored !== luck.accumulated - luck.spent || luck.lastAccumulateWeek !== null && !integer(luck.lastAccumulateWeek, 1, s.week)) return false;
    let open = 0, prepared = 0, resolved = 0;
    for (const [index, id] of MISFORTUNE_MAGE_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || ![r.preparations, r.withdrawals, r.closes].every(x => integer(x)) || !Array.isArray(r.attempts)) return false;
      let previousWeek = start - 1;
      for (const [n, a] of r.attempts.entries()) {
        if (!record(a) || !shape(a, ['week', 'method', 'success', 'actionCost', 'spiritualityCost', 'luckSpent', 'outcome', 'secured', 'returned', 'consentWithdrawn', 'accountConfirmed', 'rejectedClaims']) || !integer(a.week, start, s.week) || a.week <= previousWeek || !['ABILITY', 'ORDINARY'].includes(a.method) || ![a.success, a.secured, a.returned, a.consentWithdrawn, a.accountConfirmed].every(x => typeof x === 'boolean') || a.actionCost !== 1 || !integer(a.rejectedClaims)) return false;
        if (id === 'honest-forecast' && a.method !== 'ORDINARY' || a.spiritualityCost !== (a.method === 'ABILITY' ? id === 'uncertain-weight' ? 3 : 5 : 0) || a.luckSpent !== Number(a.method === 'ABILITY' && id === 'willing-throw')) return false;
        const expected = id === 'uncertain-weight' ? a.method === 'ABILITY' ? a.success ? 'POSSIBLE_SLIP' : 'INCONCLUSIVE' : 'INSPECTED' : id === 'willing-throw' ? a.method === 'ABILITY' && a.success ? 'MISS' : 'HIT' : 'ACCOUNT';
        if (a.outcome !== expected || id !== 'uncertain-weight' && !a.secured || id !== 'willing-throw' && a.consentWithdrawn || id !== 'honest-forecast' && (a.accountConfirmed || a.rejectedClaims > 0)) return false;
        if (a.returned && !a.secured || !a.returned && (!r.contactOpen || n !== r.attempts.length - 1)) return false;
        if (r.attempts.slice(0, n).some(old => old.success && (id !== 'honest-forecast' || old.accountConfirmed))) return false;
        previousWeek = a.week;
      }
      const a = last(r), ready = r.status === 'PREPARED';
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(ready)) return false;
      if (r.contactOpen && (!a || a.week !== s.week || ready || r.status === 'RESOLVED' || r.method !== a.method)) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') !== complete(id, r)) return false;
      if ((ready || r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method === null || !r.contactOpen && ['AVAILABLE', 'OBSERVED'].includes(r.status) && r.method !== null) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method !== a?.method) return false;
      if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (index > 0 && r.status !== 'AVAILABLE' && l.cases[MISFORTUNE_MAGE_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === source(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(ready); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const weight = l.weight, bag = l.bag, note = l.note, wr = l.cases['uncertain-weight'], br = l.cases['willing-throw'], nr = l.cases['honest-forecast'];
    const wa = last(wr), ba = last(br), na = last(nr);
    if (!record(weight) || !shape(weight, ['id', 'owner', 'position', 'cordId', 'cordHolder', 'cordIntact', 'trayId', 'permission', 'resets', 'handovers']) || weight.id !== 'MM4-WEIGHT-1' || weight.owner !== 'GUIDE' || weight.cordId !== 'MM4-CORD-1' || weight.cordIntact !== true || weight.trayId !== 'MM4-PADDED-TRAY-1' || typeof weight.permission !== 'boolean') return false;
    if (weight.position !== (wr.contactOpen ? wa!.secured ? 'TRAY' : 'SUSPENDED' : 'GUIDE') || weight.cordHolder !== (wr.contactOpen ? 'PLAYER' : 'GUIDE') || weight.resets !== Math.max(0, wr.attempts.length - 1) || weight.handovers !== wr.closes) return false;
    if (wa && wa.returned !== !wr.contactOpen || na && na.returned !== !nr.contactOpen) return false;
    if ((wr.contactOpen || wr.status === 'PREPARED') && !weight.permission || !wr.contactOpen && wr.attempts.length > 0 && wr.status !== 'PREPARED' && weight.permission || wr.status === 'AVAILABLE' && weight.permission) return false;
    if (!record(bag) || !shape(bag, ['id', 'owner', 'position', 'consented', 'effectActive', 'distanceMetres', 'handovers', 'consentWithdrawals', 'cancelledConsents']) || bag.id !== 'MM4-BAG-1' || bag.owner !== 'SELLA' || typeof bag.consented !== 'boolean' || typeof bag.effectActive !== 'boolean' || !integer(bag.cancelledConsents, 0, br.withdrawals)) return false;
    if (bag.position !== (br.contactOpen && !ba!.returned ? 'MAT' : 'OWNER') || bag.handovers !== br.attempts.filter(a => a.returned).length || bag.distanceMetres !== bag.handovers * 4 || bag.consentWithdrawals !== bag.cancelledConsents + br.attempts.filter(a => a.consentWithdrawn).length) return false;
    if (bag.effectActive !== !!(br.contactOpen && ba?.method === 'ABILITY' && ba.success && !ba.consentWithdrawn)) return false;
    if (br.contactOpen && bag.consented !== !ba?.consentWithdrawn || br.status === 'PREPARED' && !bag.consented || !br.contactOpen && br.attempts.length > 0 && br.status !== 'PREPARED' && bag.consented || br.status === 'AVAILABLE' && bag.consented) return false;
    if (!record(note) || !shape(note, ['id', 'owner', 'holder', 'writings', 'handovers', 'accepted']) || note.id !== 'MM4-NOTE-1' || note.owner !== 'GUIDE' || note.holder !== (nr.contactOpen ? 'PLAYER' : 'GUIDE') || !Array.isArray(note.writings) || note.writings.length !== nr.attempts.length || note.writings.some(x => typeof x !== 'string' || !x.includes('MM4-NOTE-1') || !x.includes('不保证未来') || !x.includes('唯一旧幸运账')) || note.handovers !== nr.closes || note.accepted !== !!na?.accountConfirmed) return false;
    if (!Array.isArray(l.accumulations)) return false;
    let week = start - 1, accumulated = -1, spent = -1;
    for (const a of l.accumulations) {
      if (!record(a) || !shape(a, ['week', 'actionCost', 'storedBefore', 'storedAfter', 'accumulatedAfter', 'spentAtTime']) || !integer(a.week, start, s.week) || a.week <= week || a.actionCost !== 1 || !integer(a.storedBefore, 0, 2) || a.storedAfter !== a.storedBefore + 1 || !integer(a.accumulatedAfter, 1, luck.accumulated) || a.accumulatedAfter <= accumulated || !integer(a.spentAtTime, 0, luck.spent) || a.spentAtTime < spent || a.storedAfter !== a.accumulatedAfter - a.spentAtTime || luck.lastAccumulateWeek === null || a.week > luck.lastAccumulateWeek) return false;
      week = a.week; accumulated = a.accumulatedAfter; spent = a.spentAtTime;
    }
    if (br.attempts.reduce((sum, a) => sum + a.luckSpent, 0) > luck.spent) return false;
    if (s.seer.completedSources.filter(x => x === 'misfortune-mage-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3 || (active(s)||s.progression.pathwayId==='wheel'&&s.progression.sequence===3) && (s.progression.sequence===3?s.chaosWalker.misfortuneMageActingAtPromotion:s.progression.acting) !== resolved * 25 + Number(l.reflected) * 25) return false;
    if (hasMisfortuneMageLifeLock(s) && (!active(s) || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat || oldOpen(s))) return false;
    return true;
  } catch { return false; }
}
