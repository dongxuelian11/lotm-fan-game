import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { FallenEarlAbilityId } from './types.js';

export const FALLEN_EARL_CASE_IDS = ['willing-pause', 'own-push', 'short-rise'] as const;
export type FallenEarlCaseId = typeof FALLEN_EARL_CASE_IDS[number];
export type FallenEarlActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: FallenEarlCaseId }
  | { type: 'PREPARE'; caseId: FallenEarlCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'WAIT_RECOVERY' | 'WITHDRAW_CONSENT'; caseId: 'willing-pause' }
  | { type: 'RETURN_CRATE'; caseId: 'own-push' }
  | { type: 'LAND'; caseId: 'short-rise' }
  | { type: 'REFLECT' };
export interface FallenEarlLifeAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; success: boolean;
  actionCost: 1; spiritualityCost: 0 | 3 | 4;
  outcome: 'LACK_ENTHUSIASM' | 'RESISTED' | 'FREE_PAUSE' | 'PUSHED' | 'STILL' | 'IN_AIR_EXTENDED' | 'IN_AIR_ORDINARY';
  elapsedSeconds: number; distanceMetres: number; cleaned: boolean; closed: boolean; consentWithdrawn: boolean;
}
export interface FallenEarlCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean;
  preparations: number; withdrawals: number; closes: number; attempts: FallenEarlLifeAttempt[];
}
export interface FallenEarlLifeState {
  cases: Record<FallenEarlCaseId, FallenEarlCaseState>; reflected: boolean;
  clerk: {
    person: 'ORIGINAL_EVE'; position: 'ORIGINAL_DESK'; independentMind: true;
    consented: boolean; effect: 'NONE' | 'LACK_ENTHUSIASM'; remainingSeconds: 0 | 30; elapsedSeconds: number;
    consentWithdrawals: number; cancelledConsents: number; confirmations: number;
  };
  crate: {
    id: 'FE4-CRATE-1'; owner: 'GUIDE'; holder: 'GUIDE' | 'FLOOR'; positionMetres: 0 | 1;
    distanceMetres: number; handovers: number;
  };
  pad: {
    id: 'FE4-PAD-1'; owner: 'GUIDE'; holder: 'GUIDE' | 'FLOOR'; positionMetres: 0;
    body: 'PLAYER_ORIGINAL'; footwear: 'PLAYER_ORIGINAL';
    bodyState: 'GROUNDED' | 'IN_AIR_ORDINARY' | 'IN_AIR_EXTENDED'; remainingSeconds: 0 | 1 | 4;
    elapsedSeconds: number; handovers: number;
  };
}
export interface FallenEarlLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FallenEarlActivityCommand }
export interface FallenEarlLifeProjection {
  cases: { id: FallenEarlCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: null | { clerk: string; crate: string; pad: string; consent: string; route: string; history: string[] };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const active = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 4;
const last = (r: FallenEarlCaseState) => r.attempts.at(-1);
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const source = (id: FallenEarlCaseId) => `fallen-earl-case:${id}`;
const emptyCase = (): FallenEarlCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const abilityIds: Record<FallenEarlCaseId, FallenEarlAbilityId> = { 'willing-pause': 'black-emperor.s4.bestow', 'own-push': 'black-emperor.s4.magnify', 'short-rise': 'black-emperor.s4.exploit' };
const cost = (id: FallenEarlCaseId, method: 'ABILITY' | 'ORDINARY'): 0 | 3 | 4 => method === 'ORDINARY' ? 0 : id === 'short-rise' ? 3 : 4;
const duration = (id: FallenEarlCaseId, a: FallenEarlLifeAttempt) => id === 'willing-pause' ? a.outcome === 'LACK_ENTHUSIASM' ? 30 : 0 : id === 'short-rise' ? a.outcome === 'IN_AIR_EXTENDED' ? 4 : 1 : 0;
const outcome = (id: FallenEarlCaseId, method: 'ABILITY' | 'ORDINARY', passed: boolean): FallenEarlLifeAttempt['outcome'] => id === 'willing-pause'
  ? method === 'ORDINARY' ? 'FREE_PAUSE' : passed ? 'LACK_ENTHUSIASM' : 'RESISTED'
  : id === 'own-push' ? passed ? 'PUSHED' : 'STILL' : method === 'ABILITY' && passed ? 'IN_AIR_EXTENDED' : 'IN_AIR_ORDINARY';
const CASES = [
  {
    id: 'willing-pause', title: '伊芙新同意的一次短暂失去热情',
    story: '原成年核册员伊芙本人仍在贝克兰德原契约铺的原桌旁，保持独立心智。她新同意一次有限的失去热情试验，可以撤回这一次许可；旧混乱导师原纸和此前决定都保留。（原创G）',
    facts: ['能力1行动4灵性、知识18：成功后伊芙自述短暂失去热情30秒，失败为RESISTED且无效果，费用仍实际支付。普通1行动0灵性、知识10，仅核对她自由选择暂停的对照。', 'WAIT_RECOVERY实际经过尚余30秒，随后影响自然到期；无效果时经过0秒。撤回同意停止后续尝试，不会让已生效状态瞬间治愈，须等原剩余时间。', '结束时仍是同一位伊芙在原桌旁，自行表达判断和去留；不更改她的身份、道德、永久意愿或旧案结论。'],
    ability: '准备本人新同意的一次赠予负面心理状态；实施另1行动4灵性、知识18，最多本次30秒。',
    ordinary: '准备普通观察本人自由选择的暂停；实施另1行动0灵性、知识10，不施加心理影响。',
  },
  {
    id: 'own-push', title: '本人推动同一只原轻木箱',
    story: '原米蕾·沃德把自己的FE4-CRATE-1轻木箱放在原空地清晰标定的0→1米地面导轨。沿途无人、不挡路，只由你本人实际推动，不增强别人的动作。（原创G）',
    facts: ['能力1行动4灵性、知识18，只放大本人这一次真实推力；成功后同一箱在1米处，失败仍在0米。普通1行动0灵性、知识10，成功普通推至1米，失败仍在0米。', 'RETURN_CRATE由本人普通走1米、拾起同一轻木箱、再走1米回原0米处放好，实走2米。原箱若未移动，原地收妥即可，不虚记路程。', 'CLOSE再由原米蕾实际收回同一只箱，失败与下周重试仍是这只原箱，没有复制或召回。'],
    ability: '准备放大本人这一推；实施另1行动4灵性、知识18，不放大旁人的行为。',
    ordinary: '准备本人普通推箱；实施另1行动0灵性、知识10，之后一样亲自取回原箱。',
  },
  {
    id: 'short-rise', title: '本人低跳的有限延长与原垫落回',
    story: '原米蕾在原平坦空地放下自己的FE4-PAD-1低垫。你用同一本体与原鞋在0米位置做一次普通低跳，开始向上运动之后才尝试利用；没有高台、深坑或同行者。（原创G）',
    facts: ['能力1行动3灵性、知识18，只尝试把本人已经开始的向上运动由1秒有限延长到4秒。失败仍真实低跳1秒，普通1行动0灵性、知识10也低跳1秒，普通核对失败不使人凭空停止在空中。', 'LAND实际经过本次剩余1秒或4秒并落回同一0米原垫，同一本体、原鞋保留；不能重复延长、永久飞行或携带别人。', 'CLOSE在本人已落地后普通收起并亲手交还同一原垫；没有治疗、退还失败成本或旧案改写。'],
    ability: '准备在本人真实低跳启动之后有限利用已有上升；实施另1行动3灵性、知识18，成功4秒、失败1秒。',
    ordinary: '准备本人普通低跳与观察；实施另1行动0灵性、知识10，真实1秒后回到同一原垫。',
  },
] as const;
export const FALLEN_EARL_LIFE_ENVIRONMENT = '堕落伯爵4的赠予、放大、利用有原著依据；本次三场人物安排、距离、秒数、判定、费用与奖励均为原创G。完整配方与晋升仪式仍未知。本次只赠予一项有限负面心理状态、放大本人真实推力、延长本人已开始的低跳上升；不赠物、不任意停时、不强制改变人格、不开放神话形态。观察、准备、实施、报告各1行动；能力知识18分别4/4/3灵性，普通知识10且0灵性。准备不施法、不打开接触锁。真实实施后须0行动经过原剩余秒数、本人取还同一原物并结束接触；零灵性和零行动仍能收束。失败成本保留，下个真实周才能重试。三份成功报告各G扮演25，能力方法各新掌握8、普通无能力掌握，最后反思25。旧律师至混乱导师全部原人物、旧敌、原物、旧掌握和唯一贿赂礼物库存不改。';

export function createFallenEarlLifeState(): FallenEarlLifeState {
  return {
    cases: { 'willing-pause': emptyCase(), 'own-push': emptyCase(), 'short-rise': emptyCase() }, reflected: false,
    clerk: { person: 'ORIGINAL_EVE', position: 'ORIGINAL_DESK', independentMind: true, consented: false, effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 0, consentWithdrawals: 0, cancelledConsents: 0, confirmations: 0 },
    crate: { id: 'FE4-CRATE-1', owner: 'GUIDE', holder: 'GUIDE', positionMetres: 0, distanceMetres: 0, handovers: 0 },
    pad: { id: 'FE4-PAD-1', owner: 'GUIDE', holder: 'GUIDE', positionMetres: 0, body: 'PLAYER_ORIGINAL', footwear: 'PLAYER_ORIGINAL', bodyState: 'GROUNDED', remainingSeconds: 0, elapsedSeconds: 0, handovers: 0 },
  };
}
const oldOpen = (s: SliceState) => [s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.mentorDisorder].some(stage => Object.values(stage.cases).some(r => r.contactOpen || r.status === 'PREPARED'))
  || ['PENDING', 'ADJUSTED'].includes(s.corruptionBaron.practice.clauseOrder) || ['ROLLING', 'SIDE_POCKET'].includes(s.corruptionBaron.practice.marker)
  || ['MOVING', 'DIVERTED'].includes(s.corruptionBaron.practice.route) || ['MIXED', 'COLLECTED'].includes(s.mentorDisorder.practice.markers)
  || s.mentorDisorder.practice.route === 'MARKED' || s.mentorDisorder.practice.note === 'WRITTEN';
export function hasFallenEarlLifeLock(s: SliceState): boolean {
  const l = s.fallenEarl.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.clerk.effect !== 'NONE' || l.clerk.remainingSeconds > 0
    || l.crate.holder !== 'GUIDE' || l.crate.positionMetres !== 0 || l.pad.holder !== 'GUIDE' || l.pad.bodyState !== 'GROUNDED' || l.pad.remainingSeconds > 0;
}
export function validateFallenEarlActivityCommand(c: unknown): c is FallenEarlActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT') return shape(c, ['type']);
  if (!FALLEN_EARL_CASE_IDS.includes(c.caseId as FallenEarlCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)
    || ['WAIT_RECOVERY', 'WITHDRAW_CONSENT'].includes(c.type as string) && c.caseId === 'willing-pause'
    || c.type === 'RETURN_CRATE' && c.caseId === 'own-push' || c.type === 'LAND' && c.caseId === 'short-rise');
}
export function fallenEarlActivityReason(s: SliceState, c: FallenEarlActivityCommand): string | null {
  if (!validateFallenEarlActivityCommand(c)) return '堕落伯爵有限实践命令无效。';
  if (!active(s)) return '先完成堕落伯爵晋升。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (oldOpen(s)) return '先实际结束旧阶段的接触，并收妥原筹、原路线标记与原纸。';
  if (s.world.city !== 'BACKLUND' || !s.mentorDisorder.guidanceKnown || !s.fallenEarl.guidanceKnown) return '原米蕾与伊芙只在贝克兰德原契约铺当面参与。';
  const l = s.fallenEarl.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r ? last(r) : undefined;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只可取消尚未实施的准备。';
  if (c.type === 'WITHDRAW_CONSENT') return l.clerk.consented && (r?.status === 'PREPARED' || r?.contactOpen) ? null : '没有仍待实施或收束的这一次本人同意。';
  if (c.type === 'WAIT_RECOVERY') return r?.contactOpen && a && !a.cleaned ? null : '没有尚待核对本次自然恢复的原伊芙。';
  if (c.type === 'RETURN_CRATE') return r?.contactOpen && a && !a.cleaned && l.crate.holder === 'FLOOR' ? null : '没有尚待本人实际取回的同一原箱。';
  if (c.type === 'LAND') return r?.contactOpen && a && !a.cleaned && l.pad.bodyState !== 'GROUNDED' ? null : '本人没有尚待经过剩余时间落回原垫的低跳。';
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen || !a || a.week !== s.week) return '没有尚待结束的本次真实接触；未实施准备可0行动取消。';
    if (c.caseId === 'willing-pause' && l.clerk.remainingSeconds > 0) return '先0行动实际等待剩余30秒自然恢复，撤回同意不能瞬间消除既有效果。';
    if (c.caseId === 'own-push' && (!a.cleaned || l.crate.positionMetres !== 0)) return '先0行动本人普通取回同一原箱，移动过的箱须实际两米往返。';
    if (c.caseId === 'short-rise' && (!a.cleaned || l.pad.bodyState !== 'GROUNDED')) return '先0行动实际经过剩余1秒或4秒，落回同一原垫。';
    return null;
  }
  if (hasFallenEarlLifeLock(s)) return '先0行动实际等待恢复、取回原箱或落回原垫并结束本次接触。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已付实践的0行动收束不受此限制。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = FALLEN_EARL_CASE_IDS.find(id => l.cases[id].status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared)) return '先实施或0行动取消当前准备。';
  if (c.type === 'REFLECT') return l.reflected ? '已经回看这三项经历。' : FALLEN_EARL_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本案已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const index = FALLEN_EARL_CASE_IDS.indexOf(c.caseId);
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : index > 0 && l.cases[FALLEN_EARL_CASE_IDS[index - 1]!].status !== 'RESOLVED' ? '先完成前一份真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场；已有成功结果直接报告。' : a?.week === s.week ? '本周本项已经实际尝试，失败下一真实周再试。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && a?.success && a.closed ? null : '先取得真实成功并完成原时间、原物的实际收束。';
  if (r.status !== 'PREPARED' || r.method === null) return '先准备这一次有限实践。';
  if (s.spirituality < cost(c.caseId, r.method)) return `本次能力需要${cost(c.caseId, r.method)}灵性，不能透支；可0行动取消准备。`;
  if (c.caseId === 'willing-pause' && !l.clerk.consented) return '伊芙这一次本人同意已结束，须重新准备。';
  return null;
}

export function applyFallenEarlActivity(s: SliceState, c: FallenEarlActivityCommand, ctx: SeerContext, award: (id: FallenEarlAbilityId, amount?: number) => void): void {
  const reason = fallenEarlActivityReason(s, c);
  if (reason) throw new Error(reason);
  if (!validateFallenEarlLife(s)) throw new Error('堕落伯爵原现场与实际历史不一致。');
  const l = s.fallenEarl.life;
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('fallen-earl-reflection');
    ctx.note('回看有限心理状态、本人推力与已有上升', '三份真实成功并收束的报告保留，G扮演+25。只限本次30秒心理状态、本人推箱与1→4秒低跳；原人原物、旧案和已付成本不改，不宣称无风险消化或完整权柄。'); return;
  }
  const r = l.cases[c.caseId], p = CASES.find(p => p.id === c.caseId)!, a = last(r);
  if (c.type === 'WITHDRAW' || c.type === 'WITHDRAW_CONSENT' && r.status === 'PREPARED') {
    r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'willing-pause') {
      l.clerk.consented = false;
      if (c.type === 'WITHDRAW_CONSENT') { l.clerk.consentWithdrawals += 1; l.clerk.cancelledConsents += 1; }
    }
    ctx.note('取消尚未实施的一次准备', '没有施法、推箱或起跳，原人原物仍在原处。0行动取消，不扣实施灵性，也不退已付观察和准备行动；下次重新当面准备。'); return;
  }
  if (c.type === 'WITHDRAW_CONSENT') {
    a!.consentWithdrawn = true; l.clerk.consented = false; l.clerk.consentWithdrawals += 1;
    ctx.note('伊芙撤回这一次同意', `停止继续施加影响的许可，已发生的结果和成本保留。现有效果仍剩${l.clerk.remainingSeconds}秒，须实际等到自然恢复；撤回同意本身没有治疗或退款。`); return;
  }
  if (c.type === 'WAIT_RECOVERY') {
    const seconds = l.clerk.remainingSeconds;
    a!.elapsedSeconds += seconds; a!.cleaned = true; l.clerk.elapsedSeconds += seconds; l.clerk.remainingSeconds = 0; l.clerk.effect = 'NONE';
    ctx.note('实际等待原剩余时间并核对自然恢复', `在原桌旁实际经过${seconds}秒后，本次影响自然到期；同一伊芙自行确认当前感受，未被要求接受新的决定。0行动属于已付实践收束，不跳过时间、不治疗其它状态。`); return;
  }
  if (c.type === 'RETURN_CRATE') {
    const metres = l.crate.positionMetres * 2;
    a!.distanceMetres += metres; a!.cleaned = true; l.crate.distanceMetres += metres; l.crate.positionMetres = 0;
    ctx.note('本人普通取回同一原轻木箱', metres ? '本人从0米普通走到1米，亲手拾起同一FE4-CRATE-1，再走1米回0米处放好，共真实2米；原箱仍须交给米蕾。没有召回、替换或复制。' : '同一FE4-CRATE-1仍在0米原处，本人原地收妥，实际移动0米；不凭失败记一次虚假往返，仍须交给米蕾。'); return;
  }
  if (c.type === 'LAND') {
    const seconds = l.pad.remainingSeconds;
    a!.elapsedSeconds += seconds; a!.cleaned = true; l.pad.elapsedSeconds += seconds; l.pad.remainingSeconds = 0; l.pad.bodyState = 'GROUNDED';
    ctx.note('实际经过剩余秒数并落回同一原垫', `本人实际经过${seconds}秒后落回0米同一FE4-PAD-1，同一本体与原鞋保留。没有第二次延长、无限滞空、携人飞行或高处坠落；原垫还须普通收起交还。`); return;
  }
  if (c.type === 'CLOSE') {
    r.contactOpen = false; r.closes += 1; a!.cleaned = true; a!.closed = true;
    if (c.caseId === 'willing-pause') {
      l.clerk.consented = false; l.clerk.confirmations += 1;
      ctx.note('原伊芙自行确认本次接触结束', '同一原成年伊芙仍在原桌旁且保有独立心智，已无本次心理效果；她自行表达感受和后续决定。本次许可结束，旧原纸和旧案结论未改。');
    } else if (c.caseId === 'own-push') {
      l.crate.holder = 'GUIDE'; l.crate.handovers += 1;
      ctx.note('原米蕾实际收回同一轻木箱', '本人把已回到原0米位置的同一FE4-CRATE-1亲手交还在场米蕾，仍是她原有的轻木箱。实际距离与失败成本保留。');
    } else {
      l.pad.holder = 'GUIDE'; l.pad.handovers += 1;
      ctx.note('本人落地后亲手交还同一原垫', '本人已经落回原0米位置，普通收起同一FE4-PAD-1并亲手交给在场米蕾；本体、原鞋、真实经过的秒数和失败成本保留。');
    }
    if (!a!.success) { r.status = 'OBSERVED'; r.method = null; }
    ctx.note('本次实际收束完成', '0行动、0额外灵性，已付费用不退款、不治疗；失败下一真实周再试，不凭收束获得报告奖励。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1;
    if (c.caseId === 'willing-pause') l.clerk.consented = true;
    ctx.note('准备这一次有限实践', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '此时只准备方法，没有心理效果、推箱或起跳，未打开接触锁。实施时重新核实在场本人本次许可，不把跨周准备当作永久同意。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(source(c.caseId));
    if (r.method === 'ABILITY') award(abilityIds[c.caseId], 8);
    ctx.note(p.title, reportText(s, c.caseId) + (r.method === 'ABILITY' ? '本案真实能力报告仅一次新掌握+8、G扮演+25。' : '普通方法没有能力掌握，仅一次G扮演+25。')); return;
  }
  const method = r.method!, spiritualityCost = cost(c.caseId, method);
  s.spirituality -= spiritualityCost;
  const passed = success(ctx.check('knowledge', method === 'ABILITY' ? 18 : 10).tier);
  const attempt: FallenEarlLifeAttempt = { week: s.week, method, success: passed, actionCost: 1, spiritualityCost, outcome: outcome(c.caseId, method, passed), elapsedSeconds: 0, distanceMetres: 0, cleaned: false, closed: false, consentWithdrawn: false };
  r.attempts.push(attempt); r.contactOpen = true; r.status = passed ? 'EXAMINED' : 'OBSERVED';
  if (c.caseId === 'willing-pause') {
    l.clerk.consented = true; l.clerk.effect = attempt.outcome === 'LACK_ENTHUSIASM' ? 'LACK_ENTHUSIASM' : 'NONE'; l.clerk.remainingSeconds = l.clerk.effect === 'LACK_ENTHUSIASM' ? 30 : 0;
    ctx.note('伊芙新的这一次有限心理实践', '当面重新确认原伊芙本人的本次可撤回同意。' + (method === 'ABILITY' ? passed ? '有限赠予成功，她自述短暂失去热情，实际剩余30秒；不是永久改写人格，必须等待自然恢复。' : '付费尝试被抵抗RESISTED，没有造成心理效果，仍保留成本并当面结束接触。' : `她自由选择暂停，普通核对${passed ? '成功' : '失败'}，没有魔法心理效果或强迫决定。`));
  } else if (c.caseId === 'own-push') {
    l.crate.holder = 'FLOOR'; l.crate.positionMetres = passed ? 1 : 0;
    ctx.note('本人实际推动同一原箱', `米蕾当面在原空地0米处放下同一FE4-CRATE-1，由本人实际推动。${method === 'ABILITY' ? '只对本人这一推尝试放大' : '只用普通推力'}，${passed ? '原箱实际到1米处，须本人真实2米取回' : '本次失败，原箱仍在0米，不虚记位移'}。没有推动别人或复制原箱。`);
  } else {
    l.pad.holder = 'FLOOR'; l.pad.bodyState = attempt.outcome === 'IN_AIR_EXTENDED' ? 'IN_AIR_EXTENDED' : 'IN_AIR_ORDINARY'; l.pad.remainingSeconds = l.pad.bodyState === 'IN_AIR_EXTENDED' ? 4 : 1;
    ctx.note('本人先真实低跳，再尝试利用已有上升', `米蕾铺下同一FE4-PAD-1，本人用同一本体和原鞋在0米处启动普通低跳。${method === 'ABILITY' ? passed ? '利用成功，将已有向上运动有限延长为4秒' : '付费利用失败，仍是原普通低跳1秒' : `普通观察${passed ? '成功' : '失败'}，本次低跳仍为1秒`}；现仍在空中，须LAND实际经过剩余时间后落回原处。`);
  }
  ctx.note('本次费用与待办收束', `已实耗1行动/${spiritualityCost}灵性，知识${method === 'ABILITY' ? 18 : 10}${passed ? '成功' : '失败'}。失败照付；真实实施打开接触锁，不能用换周、普通行动或撤回准备跳过原时间与原物收束。`);
}
function reportText(s: SliceState, id: FallenEarlCaseId): string {
  const a = last(s.fallenEarl.life.cases[id])!;
  if (id === 'willing-pause') return a.method === 'ABILITY' ? '本人同意的一次有限失去热情已实际经过30秒自然恢复，原伊芙仍在原桌旁自行决定。' : '普通核对本人自由选择暂停的对照成功，未施加心理效果，原伊芙已自行结束接触。';
  if (id === 'own-push') return `${a.method === 'ABILITY' ? '放大本人真实推力' : '本人普通推力'}使同一原箱到1米处，本人真实走2米取回，并已亲手交还米蕾。`;
  return `本人已经启动的普通低跳${a.method === 'ABILITY' ? '被有限延长到4秒' : '持续1秒'}，已真实经过原剩余时间并以同一本体与原鞋落回0米原垫，原垫已亲手交还。`;
}

export function fallenEarlLifeActions(s: SliceState): FallenEarlLifeAction[] {
  if (!active(s)) return [];
  const out: FallenEarlLifeAction[] = [], l = s.fallenEarl.life;
  const add = (id: string, label: string, price: string, command: FallenEarlActivityCommand) => { const reason = fallenEarlActivityReason(s, command); out.push({ id, label, cost: price, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = l.cases[p.id], a = last(r);
    if (r.contactOpen) {
      if (p.id === 'willing-pause') {
        if (!a?.cleaned) add(`${p.id}-wait`, '实际等待剩余时间并确认伊芙自然恢复', `0行动 · 实际${l.clerk.remainingSeconds}秒 · 不治疗其它状态`, { type: 'WAIT_RECOVERY', caseId: p.id });
        if (l.clerk.consented) add(`${p.id}-consent`, '接受伊芙撤回本次同意', '0行动 · 已生效状态仍须自然恢复 · 不退款', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      }
      if (p.id === 'own-push' && !a?.cleaned) add(`${p.id}-return`, '本人普通取回同一轻木箱到原0米', `0行动 · 实际${l.crate.positionMetres * 2}米 · 不复制或召回`, { type: 'RETURN_CRATE', caseId: p.id });
      if (p.id === 'short-rise' && !a?.cleaned) add(`${p.id}-land`, '经过剩余时间并落回同一原垫', `0行动 · 实际${l.pad.remainingSeconds}秒 · 同一本体与原鞋`, { type: 'LAND', caseId: p.id });
      add(`${p.id}-close`, p.id === 'willing-pause' ? '确认原伊芙已恢复并结束接触' : p.id === 'own-push' ? '把已取回的同一原箱亲手交还米蕾' : '落地后收起同一原垫并亲手交还米蕾', '0行动 · 0额外灵性 · 真实收束', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '当面观察原人、原物与有限范围', '1行动 · 不以旧案代替本次同意', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(`${p.id}-ability`, '准备本次有限能力实践', `1行动 · 不施法 · 实施另${cost(p.id, 'ABILITY')}灵性`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备本次普通对照实践', '1行动 · 不施法 · 实施0灵性知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '重新核实当下许可并实际实施一次', r.method === 'ABILITY' ? `1行动 · ${cost(p.id, 'ABILITY')}灵性 · 知识18 · 失败照付` : '1行动 · 0灵性 · 知识10 · 无能力掌握', { type: 'PERFORM', caseId: p.id });
      if (p.id === 'willing-pause') add(`${p.id}-consent`, '实施前接受伊芙撤回本次同意', '0行动 · 不施法 · 不扣实施灵性', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告真实成功且实际收束的有限结果', '1行动 · G扮演+25 · 同案仅一次', { type: 'REPORT', caseId: p.id });
  }
  if (!l.reflected) add('fallen-earl-reflect', '回看三份有限结果与实际成本', '1行动 · 三份报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectFallenEarlLife(s: SliceState): FallenEarlLifeProjection {
  const l = s.fallenEarl.life;
  if (!(s.progression.pathwayId==='black-emperor'&&[4,3].includes(s.progression.sequence!))) return { cases: [], insideCase: false, environment: '', practice: null };
  return {
    insideCase: hasFallenEarlLifeLock(s), environment: FALLEN_EARL_LIFE_ENVIRONMENT,
    cases: CASES.map(p => {
      const r = l.cases[p.id], a = last(r);
      const result = a ? `${a.method}/${a.outcome}，核对${a.success ? '成功' : '失败'}；实耗1行动/${a.spiritualityCost}灵性，实际经过${a.elapsedSeconds}秒、本人取箱步行${a.distanceMetres}米。${r.contactOpen ? '尚须0行动实际收束后才可报告。' : a.success ? reportText(s, p.id) : '失败成本保留，下一真实周才可重试。'}` : r.withdrawals ? '未实施准备已取消，观察与已付准备成本保留。' : null;
      return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '当前实际接触尚未收束，不能普通行动或换周' : '没有尚待收束的实际接触', closes: r.closes };
    }),
    practice: {
      clerk: `同一原成年伊芙仍在原桌旁，保持独立心智；本次心理状态${l.clerk.effect}，实际剩余${l.clerk.remainingSeconds}秒，累计已等${l.clerk.elapsedSeconds}秒；本人确认结束${l.clerk.confirmations}次。`,
      crate: `同一${l.crate.id}始终属于原米蕾，当前${l.crate.holder === 'GUIDE' ? '由米蕾保管' : '在原地面导轨'}，位置${l.crate.positionMetres}米；亲手交还${l.crate.handovers}次。`,
      pad: `同一${l.pad.id}始终属于原米蕾，当前${l.pad.holder === 'GUIDE' ? '由米蕾保管' : '铺在原平地0米处'}；本人同一本体与原鞋${l.pad.bodyState}，剩余${l.pad.remainingSeconds}秒，累计真实经过${l.pad.elapsedSeconds}秒；原垫亲手归还${l.pad.handovers}次。`,
      consent: `${l.clerk.consented ? '伊芙这一次有限同意已记录，实施时仍当面重核' : '没有仍有效的本次许可'}；本人撤回${l.clerk.consentWithdrawals}次。撤回只停止后续影响，既有效果仍等原剩余时间自然恢复。`,
      route: `原箱移动到1米后，本人普通去1米、提原箱回1米，共2米；累计真实取箱步行${l.crate.distanceMetres}米。原低跳只在0米同一原垫起落，不开放高台、无限飞行或携带别人。`,
      history: [
        ...FALLEN_EARL_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => `${id} W${a.week} ${a.method}/${a.outcome}：核对${a.success ? '成功' : '失败'}，实耗1行动/${a.spiritualityCost}灵性；实际经过${a.elapsedSeconds}秒、取箱步行${a.distanceMetres}米；${a.closed ? '原人原物已实际收束' : '仍待真实收束'}${a.consentWithdrawn ? '，伊芙已撤回本次同意' : ''}。`)),
        '旧律师、野蛮人、贿赂者、腐化男爵、混乱导师原人物、原瓶、原物、旧敌与全部旧掌握保留；本次不另建礼物库存、不改旧原纸。',
      ],
    },
  };
}

/** Finite paid attempts, original props, actual elapsed time and ordinary exits. */
export function validateFallenEarlLife(s: SliceState): boolean {
  try {
    const l = s.fallenEarl.life, start = s.fallenEarl.promotionWeek;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'clerk', 'crate', 'pad']) || !record(l.cases) || !shape(l.cases, FALLEN_EARL_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (start === null) return stableStringify(l) === stableStringify(createFallenEarlLifeState());
    if (!integer(start, 1, s.week)) return false;
    let open = 0, prepared = 0, resolved = 0;
    for (const [index, id] of FALLEN_EARL_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || ![r.preparations, r.withdrawals, r.closes].every(x => integer(x)) || !Array.isArray(r.attempts)) return false;
      let previousWeek = start - 1;
      for (const [n, a] of r.attempts.entries()) {
        if (!record(a) || !shape(a, ['week', 'method', 'success', 'actionCost', 'spiritualityCost', 'outcome', 'elapsedSeconds', 'distanceMetres', 'cleaned', 'closed', 'consentWithdrawn']) || !integer(a.week, start, s.week) || a.week <= previousWeek || !['ABILITY', 'ORDINARY'].includes(a.method) || ![a.success, a.cleaned, a.closed, a.consentWithdrawn].every(x => typeof x === 'boolean') || a.actionCost !== 1 || a.spiritualityCost !== cost(id, a.method) || a.outcome !== outcome(id, a.method, a.success)) return false;
        if (a.elapsedSeconds !== (a.cleaned ? duration(id, a) : 0) || a.distanceMetres !== (id === 'own-push' && a.cleaned && a.success ? 2 : 0) || id !== 'willing-pause' && a.consentWithdrawn || a.closed && !a.cleaned) return false;
        if (a.closed !== (n < r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && a.success) return false;
        previousWeek = a.week;
      }
      const a = last(r), ready = r.status === 'PREPARED';
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(ready)) return false;
      if (r.contactOpen && (!a || a.week !== s.week || ready || r.status === 'RESOLVED' || r.method !== a.method)) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') !== !!a?.success || r.status === 'RESOLVED' && !a?.closed) return false;
      if ((ready || r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method === null || !r.contactOpen && ['AVAILABLE', 'OBSERVED'].includes(r.status) && r.method !== null) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method !== a?.method) return false;
      if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (index > 0 && r.status !== 'AVAILABLE' && l.cases[FALLEN_EARL_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === source(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(ready); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const clerk = l.clerk, crate = l.crate, pad = l.pad, cr = l.cases['willing-pause'], br = l.cases['own-push'], pr = l.cases['short-rise'];
    const ca = last(cr), ba = last(br), pa = last(pr), affected = !!(cr.contactOpen && ca?.outcome === 'LACK_ENTHUSIASM' && !ca.cleaned), airborne = !!(pr.contactOpen && pa && !pa.cleaned);
    if (!record(clerk) || !shape(clerk, ['person', 'position', 'independentMind', 'consented', 'effect', 'remainingSeconds', 'elapsedSeconds', 'consentWithdrawals', 'cancelledConsents', 'confirmations']) || clerk.person !== 'ORIGINAL_EVE' || clerk.position !== 'ORIGINAL_DESK' || clerk.independentMind !== true || typeof clerk.consented !== 'boolean' || !integer(clerk.cancelledConsents, 0, cr.withdrawals)) return false;
    if (clerk.effect !== (affected ? 'LACK_ENTHUSIASM' : 'NONE') || clerk.remainingSeconds !== (affected ? 30 : 0) || clerk.elapsedSeconds !== cr.attempts.reduce((sum, a) => sum + a.elapsedSeconds, 0) || clerk.confirmations !== cr.closes || clerk.consentWithdrawals !== clerk.cancelledConsents + cr.attempts.filter(a => a.consentWithdrawn).length) return false;
    if (clerk.consented !== (cr.status === 'PREPARED' || cr.contactOpen && !ca?.consentWithdrawn)) return false;
    if (!record(crate) || !shape(crate, ['id', 'owner', 'holder', 'positionMetres', 'distanceMetres', 'handovers']) || crate.id !== 'FE4-CRATE-1' || crate.owner !== 'GUIDE' || crate.holder !== (br.contactOpen ? 'FLOOR' : 'GUIDE') || crate.positionMetres !== (br.contactOpen && ba?.success && !ba.cleaned ? 1 : 0) || crate.distanceMetres !== br.attempts.reduce((sum, a) => sum + a.distanceMetres, 0) || crate.handovers !== br.closes) return false;
    if (!record(pad) || !shape(pad, ['id', 'owner', 'holder', 'positionMetres', 'body', 'footwear', 'bodyState', 'remainingSeconds', 'elapsedSeconds', 'handovers']) || pad.id !== 'FE4-PAD-1' || pad.owner !== 'GUIDE' || pad.holder !== (pr.contactOpen ? 'FLOOR' : 'GUIDE') || pad.positionMetres !== 0 || pad.body !== 'PLAYER_ORIGINAL' || pad.footwear !== 'PLAYER_ORIGINAL') return false;
    if (pad.bodyState !== (airborne ? pa!.outcome : 'GROUNDED') || pad.remainingSeconds !== (airborne ? duration('short-rise', pa!) : 0) || pad.elapsedSeconds !== pr.attempts.reduce((sum, a) => sum + a.elapsedSeconds, 0) || pad.handovers !== pr.closes) return false;
    if (s.seer.completedSources.filter(x => x === 'fallen-earl-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3 || (active(s)||s.progression.pathwayId==='black-emperor'&&s.progression.sequence===3) && (s.progression.sequence===3?s.frenzyMage.fallenEarlActingAtPromotion:s.progression.acting) !== resolved * 25 + Number(l.reflected) * 25) return false;
    if (hasFallenEarlLifeLock(s) && (!active(s) || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat || oldOpen(s))) return false;
    return true;
  } catch { return false; }
}
