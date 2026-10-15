import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { hasJudgeOpenPractice } from '../judge/encounter.js';
import type { ImperativeMageAbilityId } from './types.js';

export const IMPERATIVE_MAGE_CASE_IDS = ['willing-attention', 'one-borrowed-light', 'equal-line'] as const;
export type ImperativeMageCaseId = typeof IMPERATIVE_MAGE_CASE_IDS[number];
export type ImperativeMageLifeAbilityId = ImperativeMageAbilityId | 'justiciar.s6.prohibition';
export type ImperativeMageActivityCommand =
  | { type: 'OBSERVE'; caseId: ImperativeMageCaseId }
  | { type: 'PREPARE'; caseId: ImperativeMageCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: ImperativeMageCaseId }
  | { type: 'CLOSE'; caseId: ImperativeMageCaseId }
  | { type: 'REPORT'; caseId: ImperativeMageCaseId }
  | { type: 'WITHDRAW'; caseId: ImperativeMageCaseId }
  | { type: 'RELEASE_ATTENTION'; caseId: 'willing-attention' }
  | { type: 'WITHDRAW_CONSENT'; caseId: 'willing-attention' }
  | { type: 'CHECK_LIGHT'; caseId: 'one-borrowed-light' }
  | { type: 'RESTORE_LIGHT'; caseId: 'one-borrowed-light' }
  | { type: 'REMOVE_RULE'; caseId: 'equal-line' }
  | { type: 'PARTNER_REST' }
  | { type: 'REFLECT' };
export interface ImperativeMageLifeAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; success: boolean;
  actionCost: 1; spiritualityCost: 0 | 3 | 4;
  outcome: 'ATTENTION_HELD' | 'RESISTED' | 'ATTENTIVE' | 'DEPRIVED' | 'STILL_AVAILABLE' | 'ORDINARY_SHADE' | 'BOTH_STOP' | 'BOTH_CROSS' | 'VOLUNTARY_STOP';
  elapsedSeconds: number; distanceMetres: number; partnerDistanceMetres: number;
  cleaned: boolean; closed: boolean; consentWithdrawn: boolean;
  partnerSpiritualityBefore: number | null; partnerSpiritualityCost: number;
  baseline: 'NONE' | 'LIT'; lightCheck: 'NONE' | 'BLOCKED' | 'LIT' | 'EXHAUSTED'; restoration: 'NONE' | 'LIT' | 'NO_RESOURCE';
}
export interface ImperativeMageCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean;
  preparations: number; withdrawals: number; closes: number; attempts: ImperativeMageLifeAttempt[];
}
export interface ImperativeMageLifeState {
  cases: Record<ImperativeMageCaseId, ImperativeMageCaseState>; reflected: boolean;
  attention: {
    person: 'ORIGINAL_ARLEN'; position: 'ORIGINAL_CHAIR_DESK'; independentMind: true; consented: boolean;
    effect: 'NONE' | 'ATTENTION_HELD'; remainingSeconds: 0 | 3; elapsedSeconds: number;
    consentWithdrawals: number; cancelledConsents: number; confirmations: number;
  };
  partner: {
    id: 'IM4-ELDEN-VALE'; name: '埃尔登·维尔'; adult: true; pathwayId: 'door'; sequence: 8; profession: '戏法大师';
    position: 'ORIGINAL_ADJACENT_CHAIR'; independentMind: true; knownAbilities: ['FLASH'];
    spirituality: number; maxSpirituality: 12; abilityAvailable: boolean; consented: boolean; confirmations: number;
    rests: { week: number; afterAttempts: number; before: number; restored: number; elapsedHours: 6 }[];
  };
  light: {
    cardId: 'IM4-CARD-1'; hoodId: 'IM4-HOOD-1'; owner: 'GUIDE'; holder: 'GUIDE' | 'TABLE'; positionMetres: 0 | 1;
    hoodComparison: boolean; remainingSeconds: 0 | 10; elapsedSeconds: number; distanceMetres: number; handovers: number;
  };
  line: {
    id: 'IM4-LINE-1'; tokenId: 'IM4-TOKEN-1'; owner: 'GUIDE'; holder: 'GUIDE' | 'FLOOR'; tokenHolder: 'GUIDE' | 'TABLE' | 'PLAYER';
    partner: 'ORIGINAL_ARLEN'; rule: 'NONE' | 'NO_CROSSING'; appliesTo: 'BOTH'; testedBy: 'NONE' | 'BOTH';
    playerPositionMetres: 0 | 2; partnerPositionMetres: 0 | 2; playerDistanceMetres: number; partnerDistanceMetres: number; handovers: number;
  };
}
export interface ImperativeMageLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ImperativeMageActivityCommand }
export interface ImperativeMageLifeProjection {
  cases: { id: ImperativeMageCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: null | { attention: string; partner: string; light: string; line: string; consent: string; route: string; history: string[] };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const active = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 4;
const last = (r: ImperativeMageCaseState) => r.attempts.at(-1);
const passed = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const source = (id: ImperativeMageCaseId) => `imperative-mage-case:${id}`;
const emptyCase = (): ImperativeMageCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const abilityIds: Record<ImperativeMageCaseId, ImperativeMageLifeAbilityId> = { 'willing-attention': 'justiciar.s4.intimidation', 'one-borrowed-light': 'justiciar.s4.deprivation', 'equal-line': 'justiciar.s6.prohibition' };
const cost = (id: ImperativeMageCaseId, method: 'ABILITY' | 'ORDINARY'): 0 | 3 | 4 => method === 'ORDINARY' ? 0 : id === 'equal-line' ? 3 : 4;
const difficulty = (id: ImperativeMageCaseId, method: 'ABILITY' | 'ORDINARY') => method === 'ORDINARY' ? 10 : id === 'equal-line' ? 14 : 18;
const duration = (a: ImperativeMageLifeAttempt) => a.outcome === 'ATTENTION_HELD' ? 3 : a.outcome === 'DEPRIVED' ? 10 : 0;
const outcome = (id: ImperativeMageCaseId, method: 'ABILITY' | 'ORDINARY', ok: boolean): ImperativeMageLifeAttempt['outcome'] => id === 'willing-attention'
  ? method === 'ORDINARY' ? 'ATTENTIVE' : ok ? 'ATTENTION_HELD' : 'RESISTED'
  : id === 'one-borrowed-light' ? method === 'ORDINARY' ? 'ORDINARY_SHADE' : ok ? 'DEPRIVED' : 'STILL_AVAILABLE'
    : method === 'ORDINARY' ? 'VOLUNTARY_STOP' : ok ? 'BOTH_STOP' : 'BOTH_CROSS';
const reportable = (id: ImperativeMageCaseId, a: ImperativeMageLifeAttempt) => a.success && (id !== 'one-borrowed-light' || a.method === 'ORDINARY' || a.lightCheck === 'BLOCKED' && a.restoration === 'LIT');
const CASES = [
  { id: 'willing-attention', title: '阿伦新同意的一次有限威严',
    story: '同一原成年阿伦仍在薇娜·贝尔原调解处的原椅和桌旁，重新同意有限权威测试，保持独立心智。这不是犯罪审讯、真实口供保证或新官方职权。（原创G）',
    facts: ['能力1行动4灵性、知识18：成功只让本次注意短暂被吸引3秒；失败RESISTED、0秒且费用保留。普通1行动0灵性、知识10，仅本人自由选择注意。', 'RELEASE_ATTENTION实际经过剩余3秒或0秒恢复自由注意。撤回同意停止后续影响，已发生的3秒仍须实际到期。结束时仍是同一原阿伦在原处。'],
    ability: '准备本人这一次可撤回的有限威严；实施另1行动4灵性、知识18。', ordinary: '准备本人自由选择注意的普通对照；实施另1行动0灵性、知识10。' },
  { id: 'one-borrowed-light', title: '同一戏法大师的一次暂时失去微光',
    story: '新到场的成年戏法大师8埃尔登·维尔（IM4-ELDEN-VALE）实际会FLASH，自己的原灵性12，每次微光实耗2。薇娜把同一IM4-CARD-1与IM4-HOOD-1放在1米桌面，普通罩内遮暗且光路无人。（原创G）',
    facts: ['本次须伙伴至少6灵性。先由本人实际施展FLASH耗2照亮原卡，才进行玩家能力4灵性、知识18的一次暂剥，成功仅10秒；失败仍可用，费用不退。普通0灵性、知识10仅比较普通遮光罩。', 'CHECK_LIGHT每次至多一次：已暂剥则BLOCKED、0伙伴灵性；否则实际FLASH耗2并LIT，若资源不足仅EXHAUSTED，不冒充剥夺。', 'RESTORE_LIGHT实际经过剩余10秒或0秒、移开普通对照遮挡，原能力恢复；有2灵性便再实耗2亮原卡，否则只记NO_RESOURCE。能力报告必须已有BLOCKED且恢复后LIT。CLOSE本人普通1米去、1米回，取还同一原卡原罩。', 'PARTNER_REST只在无接触、无准备的真实新周一次，原相邻椅普通休息6小时，伙伴+6灵性、上限12；1行动，不补玩家资源，不自动补能。准备后不足可先0行动WITHDRAW。'],
    ability: '准备一次暂剥伙伴实际已会的FLASH；先实亮原卡，实施另1行动4灵性、知识18。', ordinary: '准备普通遮罩对照；原FLASH仍可用，不声称剥夺，实施另1行动0灵性、知识10。' },
  { id: 'equal-line', title: '同一条线对本人和阿伦都有效',
    story: '原空地放下新的同一IM4-LINE-1标条；薇娜自己的同一IM4-TOKEN-1在对面2米桌上。仍是原阿伦，双方新同意相同越线条件，原出口始终可用。（原创G）',
    facts: ['能力1行动3灵性、知识14，继承有限禁止跨线；本人和阿伦各实际尝试一次，同一次核对成功BOTH_STOP、两人0米，失败BOTH_CROSS、两人各2米且费用保留。普通0灵性、知识10是两人自由停步。', 'REMOVE_RULE实际结束禁令并收起原标条。已跨线时，阿伦普通走2米返回，本人从2米桌拿原牌走2米回；未跨线时本人在撤规后普通去2米、带原牌回2米。每次本人完整4米，阿伦成功0米、能力失败4米。CLOSE亲手交还同一原标条与原牌。'],
    ability: '准备一次对双方相同的有限跨线禁令；实施另1行动3灵性、知识14。', ordinary: '准备普通可见标线与口头约定；实施另1行动0灵性、知识10，不生成神秘禁令。' },
] as const;
export const IMPERATIVE_MAGE_LIFE_ENVIRONMENT = '律令法师4及威严、暂时剥夺有原著依据；人物安排、全部费用、秒数、距离、判定和奖励均为原创G。完整配方与晋升仪式仍未知。三项只限本人新同意的3秒注意、对实际戏法大师原FLASH的一次10秒暂剥、双方同一越线条件。不是必服、强制真话、永久剥夺、能力复制、即死或无限规则；不把场景中的并列限制说成职业固定两条上限。观察、准备、实施、报告各1行动；准备不施法、不打开接触锁，实施后须实际恢复和原物普通取还，0行动收束不跳过时间。失败费用保留，下个真实周再试。三报告各G扮演25、反思25；能力报告分别掌握+8，第三案继承原法官禁令ID；普通无掌握。旧仲裁人、治安官、审讯者、法官、惩戒骑士五域原人原物原敌与旧掌握保留。';

export function createImperativeMageLifeState(): ImperativeMageLifeState {
  return {
    cases: { 'willing-attention': emptyCase(), 'one-borrowed-light': emptyCase(), 'equal-line': emptyCase() }, reflected: false,
    attention: { person: 'ORIGINAL_ARLEN', position: 'ORIGINAL_CHAIR_DESK', independentMind: true, consented: false, effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 0, consentWithdrawals: 0, cancelledConsents: 0, confirmations: 0 },
    partner: { id: 'IM4-ELDEN-VALE', name: '埃尔登·维尔', adult: true, pathwayId: 'door', sequence: 8, profession: '戏法大师', position: 'ORIGINAL_ADJACENT_CHAIR', independentMind: true, knownAbilities: ['FLASH'], spirituality: 12, maxSpirituality: 12, abilityAvailable: true, consented: false, confirmations: 0, rests: [] },
    light: { cardId: 'IM4-CARD-1', hoodId: 'IM4-HOOD-1', owner: 'GUIDE', holder: 'GUIDE', positionMetres: 0, hoodComparison: false, remainingSeconds: 0, elapsedSeconds: 0, distanceMetres: 0, handovers: 0 },
    line: { id: 'IM4-LINE-1', tokenId: 'IM4-TOKEN-1', owner: 'GUIDE', holder: 'GUIDE', tokenHolder: 'GUIDE', partner: 'ORIGINAL_ARLEN', rule: 'NONE', appliesTo: 'BOTH', testedBy: 'NONE', playerPositionMetres: 0, partnerPositionMetres: 0, playerDistanceMetres: 0, partnerDistanceMetres: 0, handovers: 0 },
  };
}
const oldOpen = (s: SliceState) => [s.arbiter, s.sheriff, s.interrogator, s.judge, s.punishmentKnight].some(stage => Object.values(stage.cases).some(r => r.contactOpen || r.status === 'PREPARED'))
  || hasJudgeOpenPractice(s) || s.punishmentKnight.practice.pad !== 'STAND' || s.punishmentKnight.practice.partner !== 'FREE' || s.punishmentKnight.practice.rule !== 'NONE' || s.punishmentKnight.practice.note === 'WRITTEN';
export function hasImperativeMageLifeLock(s: SliceState): boolean {
  const l = s.imperativeMage.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.attention.effect !== 'NONE' || l.attention.remainingSeconds > 0 || !l.partner.abilityAvailable
    || l.light.holder !== 'GUIDE' || l.light.remainingSeconds > 0 || l.light.hoodComparison || l.line.holder !== 'GUIDE' || l.line.rule !== 'NONE' || l.line.tokenHolder !== 'GUIDE' || l.line.playerPositionMetres !== 0 || l.line.partnerPositionMetres !== 0;
}
export function validateImperativeMageActivityCommand(c: unknown): c is ImperativeMageActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT' || c.type === 'PARTNER_REST') return shape(c, ['type']);
  if (!IMPERATIVE_MAGE_CASE_IDS.includes(c.caseId as ImperativeMageCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)
    || ['RELEASE_ATTENTION', 'WITHDRAW_CONSENT'].includes(c.type as string) && c.caseId === 'willing-attention'
    || ['CHECK_LIGHT', 'RESTORE_LIGHT'].includes(c.type as string) && c.caseId === 'one-borrowed-light' || c.type === 'REMOVE_RULE' && c.caseId === 'equal-line');
}
export function imperativeMageActivityReason(s: SliceState, c: ImperativeMageActivityCommand): string | null {
  if (!validateImperativeMageActivityCommand(c)) return '律令法师有限实践命令无效。';
  if (!active(s)) return '先完成律令法师晋升。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (oldOpen(s)) return '先实际结束旧阶段的接触，收妥原物与原规则。';
  if (s.world.city !== 'BACKLUND' || !s.punishmentKnight.guidanceKnown || !s.imperativeMage.guidanceKnown) return '需回贝克兰德原调解处，由原薇娜当面安排。';
  const l = s.imperativeMage.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r ? last(r) : undefined;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只可取消尚未实施的准备。';
  if (c.type === 'WITHDRAW_CONSENT') return l.attention.consented && (r?.status === 'PREPARED' || r?.contactOpen) ? null : '没有本次尚待实施或收束的同意。';
  if (c.type === 'RELEASE_ATTENTION') return r?.contactOpen && a && !a.cleaned ? null : '没有尚待经过本次剩余秒数的注意影响。';
  if (c.type === 'CHECK_LIGHT') return r?.contactOpen && a && !a.cleaned && a.lightCheck === 'NONE' ? null : '每次只能在恢复之前核对一次原FLASH。';
  if (c.type === 'RESTORE_LIGHT') return r?.contactOpen && a && !a.cleaned ? null : '没有尚待恢复并核对的本次原FLASH。';
  if (c.type === 'REMOVE_RULE') return r?.contactOpen && a && !a.cleaned ? null : '没有尚待实际撤规与普通取还的本次标线。';
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen || !a || a.week !== s.week) return '没有尚待结束的本次接触；未实施准备可0行动取消。';
    if (c.caseId === 'willing-attention' && l.attention.remainingSeconds > 0) return '先实际经过剩余3秒恢复自由注意；撤回许可不会瞬间消去既有效果。';
    if (c.caseId === 'one-borrowed-light' && !a.cleaned) return '先RESTORE_LIGHT实际经过剩余时间并恢复原能力，再取还原卡原罩。';
    if (c.caseId === 'equal-line' && !a.cleaned) return '先REMOVE_RULE实际撤规，完成本人4米与阿伦需要的普通回程。';
    return null;
  }
  if (hasImperativeMageLifeLock(s)) return '先0行动完成本次实际恢复、原物取还与接触收束。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已付实践的0行动收束仍可进行。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = IMPERATIVE_MAGE_CASE_IDS.find(id => l.cases[id].status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared)) return '先实施或0行动取消当前准备。';
  if (c.type === 'PARTNER_REST') {
    if (['AVAILABLE', 'RESOLVED'].includes(l.cases['one-borrowed-light'].status)) return '先当面认识实际参与的戏法大师；已完成的实践不需再安排休息。';
    if (s.week <= (l.partner.rests.at(-1)?.week ?? s.imperativeMage.promotionWeek ?? s.week)) return '需到下一个真实新周，伙伴本周不能重复取得休息回复。';
    return l.partner.spirituality >= 12 ? '伙伴灵性已满，不需要本次付费普通休息。' : null;
  }
  if (c.type === 'REFLECT') return l.reflected ? '已经回看这三项经历。' : IMPERATIVE_MAGE_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本案已报告，不能重复获得奖励。';
  if (c.type === 'OBSERVE') {
    const index = IMPERATIVE_MAGE_CASE_IDS.indexOf(c.caseId);
    return r.status !== 'AVAILABLE' ? '本次原观察已保留。' : index > 0 && l.cases[IMPERATIVE_MAGE_CASE_IDS[index - 1]!].status !== 'RESOLVED' ? '先完成前一份真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场；完整成功结果可直接报告。' : a?.week === s.week ? '本周已经实际尝试，下一真实周才可重试。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && a?.closed && reportable(c.caseId, a) ? null : '须真实成功、完整证据与实际收束；光案能力报告须BLOCKED后原FLASH恢复LIT。';
  if (r.status !== 'PREPARED' || r.method === null) return '先准备本次有限实践。';
  if (s.spirituality < cost(c.caseId, r.method)) return `本次需要${cost(c.caseId, r.method)}灵性，不能透支；可0行动取消。`;
  if (c.caseId === 'willing-attention' && !l.attention.consented) return '阿伦本次许可已结束，须重新准备。';
  if (c.caseId === 'one-borrowed-light' && l.partner.spirituality < 6) return '原戏法大师本次须至少6灵性供实际前后验证；可0行动取消准备，真实新周再安排普通休息。';
  return null;
}

export function applyImperativeMageActivity(s: SliceState, c: ImperativeMageActivityCommand, ctx: SeerContext, award: (id: ImperativeMageLifeAbilityId, amount?: number) => void): void {
  const reason = imperativeMageActivityReason(s, c); if (reason) throw new Error(reason);
  if (!validateImperativeMageLife(s)) throw new Error('律令法师原现场与实际历史不一致。');
  const l = s.imperativeMage.life;
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('imperative-mage-reflection');
    ctx.note('回看三次有限实践与真实代价', '三份真实报告后G扮演+25。原人原物、伙伴实际灵性与普通路程保留，不宣称完整律令权柄。'); return;
  }
  if (c.type === 'PARTNER_REST') {
    s.actionsRemaining -= 1; const before = l.partner.spirituality, restored = Math.min(6, 12 - before);
    l.partner.spirituality += restored; l.partner.rests.push({ week: s.week, afterAttempts: l.cases['one-borrowed-light'].attempts.length, before, restored, elapsedHours: 6 });
    ctx.note('同一埃尔登实际普通休息六小时', `同一IM4-ELDEN-VALE在原相邻椅普通休息6小时，实耗1行动，伙伴灵性${before}→${l.partner.spirituality}/12。本真实周仅一次，不自动补能、不恢复玩家健康、精神或灵性。`); return;
  }
  const r = l.cases[c.caseId], p = CASES.find(x => x.id === c.caseId)!, a = last(r);
  if (c.type === 'WITHDRAW' || c.type === 'WITHDRAW_CONSENT' && r.status === 'PREPARED') {
    r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'willing-attention') { l.attention.consented = false; if (c.type === 'WITHDRAW_CONSENT') { l.attention.consentWithdrawals += 1; l.attention.cancelledConsents += 1; } }
    if (c.caseId === 'one-borrowed-light') l.partner.consented = false;
    ctx.note('取消尚未实施的准备', '0行动取消，尚未施法、耗伙伴灵性或移动原物；不退已付准备成本。下次当面重新取得本人许可。'); return;
  }
  if (c.type === 'WITHDRAW_CONSENT') {
    a!.consentWithdrawn = true; l.attention.consented = false; l.attention.consentWithdrawals += 1;
    ctx.note('阿伦撤回这一次同意', `停止进一步影响的许可，已生效部分仍剩${l.attention.remainingSeconds}秒，须实际到期；不治疗、不退费用。`); return;
  }
  if (c.type === 'RELEASE_ATTENTION') {
    const seconds = l.attention.remainingSeconds; a!.elapsedSeconds += seconds; a!.cleaned = true;
    l.attention.elapsedSeconds += seconds; l.attention.remainingSeconds = 0; l.attention.effect = 'NONE';
    ctx.note('实际恢复原阿伦的自由注意', `原桌椅旁实际经过${seconds}秒，本次有限影响结束。阿伦本人自由表达，不保证真话或服从其它决定；0行动是已付实践收束。`); return;
  }
  if (c.type === 'CHECK_LIGHT') {
    if (!l.partner.abilityAvailable) a!.lightCheck = 'BLOCKED';
    else if (l.partner.spirituality < 2) a!.lightCheck = 'EXHAUSTED';
    else { l.partner.spirituality -= 2; a!.partnerSpiritualityCost += 2; a!.lightCheck = 'LIT'; }
    ctx.note('原戏法大师核对同一FLASH', a!.lightCheck === 'BLOCKED' ? '同一本人尝试原FLASH，因本次暂剥未能施展，BLOCKED、0伙伴灵性；原技能仍为本人已会，不能由玩家获得。' : a!.lightCheck === 'EXHAUSTED' ? '原能力可用，但伙伴灵性不足2，仅记EXHAUSTED，绝不当作剥夺证据。' : `本人实际施展原FLASH实耗2灵性，照亮同一原卡LIT，现余${l.partner.spirituality}/12。${l.light.hoodComparison ? '普通遮罩只改变观察遮挡，不是能力剥夺。' : '暂剥尝试没有阻止原能力。'}`); return;
  }
  if (c.type === 'RESTORE_LIGHT') {
    const seconds = l.light.remainingSeconds; a!.elapsedSeconds += seconds; a!.cleaned = true;
    l.light.elapsedSeconds += seconds; l.light.remainingSeconds = 0; l.light.hoodComparison = false; l.partner.abilityAvailable = true;
    if (l.partner.spirituality >= 2) { l.partner.spirituality -= 2; a!.partnerSpiritualityCost += 2; a!.restoration = 'LIT'; } else a!.restoration = 'NO_RESOURCE';
    ctx.note('实际经过原剩余时间并恢复同一能力', `实际经过${seconds}秒，移开普通对照遮挡，同一埃尔登原FLASH可用。${a!.restoration === 'LIT' ? `本人再实耗2灵性照亮同一IM4-CARD-1，恢复后LIT、现余${l.partner.spirituality}/12。` : '原能力已恢复，但资源不足，仅记NO_RESOURCE，不虚造成功证明；仍可安全收束，下真实周再试。'}原卡原罩仍须普通取还。`); return;
  }
  if (c.type === 'REMOVE_RULE') {
    const crossed = a!.outcome === 'BOTH_CROSS';
    l.line.rule = 'NONE'; l.line.holder = 'GUIDE';
    a!.distanceMetres += crossed ? 2 : 4; a!.partnerDistanceMetres += crossed ? 2 : 0;
    l.line.playerDistanceMetres += crossed ? 2 : 4; l.line.partnerDistanceMetres += crossed ? 2 : 0;
    l.line.playerPositionMetres = 0; l.line.partnerPositionMetres = 0; l.line.tokenHolder = 'PLAYER'; a!.cleaned = true;
    ctx.note('实际撤规与同一原牌的普通回路', `本次禁令实际结束，收起同一IM4-LINE-1。${crossed ? '阿伦从2米处普通走2米返回；本人在2米桌拿同一原牌，再普通走2米回。' : '本人在规则已撤后普通去2米，在桌上拿同一原牌，再走2米返回；阿伦仍在原处。'}本次本人合计真实4米、阿伦${a!.partnerDistanceMetres}米；没有瞬移、复制或永久障碍，原牌仍须交给薇娜。`); return;
  }
  if (c.type === 'CLOSE') {
    r.contactOpen = false; r.closes += 1; a!.cleaned = true; a!.closed = true;
    if (c.caseId === 'willing-attention') { l.attention.consented = false; l.attention.confirmations += 1; }
    if (c.caseId === 'one-borrowed-light') {
      a!.distanceMetres += 2; l.light.distanceMetres += 2; l.light.holder = 'GUIDE'; l.light.positionMetres = 0; l.light.handovers += 1;
      l.partner.consented = false; l.partner.confirmations += 1;
    }
    if (c.caseId === 'equal-line') { l.line.tokenHolder = 'GUIDE'; l.line.handovers += 1; }
    if (!reportable(c.caseId, a!)) { r.status = 'OBSERVED'; r.method = null; }
    ctx.note('原人原物实际结束本次接触', c.caseId === 'willing-attention' ? '同一原阿伦仍在原椅桌旁，自由注意与独立心智保留；本次许可结束，旧五域不改。' : c.caseId === 'one-borrowed-light' ? '本人普通走1米到原桌，拿同一IM4-CARD-1与IM4-HOOD-1，再走1米回，亲手交还原薇娜，共真实2米。原伙伴与实际资源保留。' : '本人把已普通带回的同一IM4-TOKEN-1与同一原标条亲手交还薇娜；双方已在原侧，原规则结束。');
    ctx.note('已付实践安全收束', `0行动、0额外玩家灵性；所有实际费用保留。${reportable(c.caseId, a!) ? '完整成功结果可报告一次。' : '失败或缺少完整验证不能得奖，下一真实周重新取得许可再试。'}`); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1;
    if (c.caseId === 'willing-attention') l.attention.consented = true;
    if (c.caseId === 'one-borrowed-light') l.partner.consented = true;
    ctx.note('准备一次有限实践', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '准备不施法、不耗伙伴资源、不打开接触锁；实施时当面重新核实本次同意，不把跨周准备当永久许可。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(source(c.caseId));
    if (r.method === 'ABILITY') award(abilityIds[c.caseId], 8);
    ctx.note(p.title, reportText(s, c.caseId) + (r.method === 'ABILITY' ? '该实际能力原ID掌握+8，G扮演+25，仅一次。' : '普通对照无能力掌握，G扮演+25，仅一次。')); return;
  }
  const method = r.method!, spiritualityCost = cost(c.caseId, method), partnerBefore = c.caseId === 'one-borrowed-light' ? l.partner.spirituality : null;
  s.spirituality -= spiritualityCost;
  if (c.caseId === 'one-borrowed-light') { l.partner.spirituality -= 2; ctx.note('先实际证明原FLASH存在', `当面重新确认同一埃尔登本人这一次许可，再由他实际FLASH耗2灵性照亮同一原卡，基线LIT、余${l.partner.spirituality}/12；此后才尝试暂剥或普通对照。`); }
  const ok = passed(ctx.check('knowledge', difficulty(c.caseId, method)).tier);
  const attempt: ImperativeMageLifeAttempt = { week: s.week, method, success: ok, actionCost: 1, spiritualityCost, outcome: outcome(c.caseId, method, ok), elapsedSeconds: 0, distanceMetres: 0, partnerDistanceMetres: 0, cleaned: false, closed: false, consentWithdrawn: false, partnerSpiritualityBefore: partnerBefore, partnerSpiritualityCost: partnerBefore === null ? 0 : 2, baseline: partnerBefore === null ? 'NONE' : 'LIT', lightCheck: 'NONE', restoration: 'NONE' };
  r.attempts.push(attempt); r.contactOpen = true; r.status = ok ? 'EXAMINED' : 'OBSERVED';
  if (c.caseId === 'willing-attention') {
    l.attention.consented = true; l.attention.effect = attempt.outcome === 'ATTENTION_HELD' ? 'ATTENTION_HELD' : 'NONE'; l.attention.remainingSeconds = l.attention.effect === 'ATTENTION_HELD' ? 3 : 0;
    ctx.note('原阿伦本次有限注意实践', `当面重新确认原阿伦本人新同意。${method === 'ORDINARY' ? '本人自由选择ATTENTIVE，没有魔法作用。' : ok ? '短暂ATTENTION_HELD，剩余3秒；并非强制口供。' : '威严尝试RESISTED、实际0秒，费用仍付。'}`);
  } else if (c.caseId === 'one-borrowed-light') {
    l.partner.consented = true; l.partner.abilityAvailable = attempt.outcome !== 'DEPRIVED'; l.light.remainingSeconds = attempt.outcome === 'DEPRIVED' ? 10 : 0;
    l.light.holder = 'TABLE'; l.light.positionMetres = 1; l.light.hoodComparison = method === 'ORDINARY';
    ctx.note('一次有限原FLASH比较', method === 'ORDINARY' ? '只用同一普通罩做遮光对照，原FLASH仍可用，不声称剥夺。' : ok ? '本次原FLASH暂时不可用，剩余10秒；原已会技能不删除，玩家没有学会FLASH。请先CHECK_LIGHT取得实际BLOCKED证据，再RESTORE_LIGHT。' : '本次暂剥失败，原FLASH仍可用且付费保留；仍须实际核对、收束与交还原物。');
  } else {
    const crossed = attempt.outcome === 'BOTH_CROSS';
    l.line.holder = 'FLOOR'; l.line.tokenHolder = 'TABLE'; l.line.rule = method === 'ABILITY' ? 'NO_CROSSING' : 'NONE'; l.line.testedBy = 'BOTH';
    l.line.playerPositionMetres = crossed ? 2 : 0; l.line.partnerPositionMetres = crossed ? 2 : 0;
    if (crossed) { attempt.distanceMetres = 2; attempt.partnerDistanceMetres = 2; l.line.playerDistanceMetres += 2; l.line.partnerDistanceMetres += 2; }
    ctx.note('本人和原阿伦同条件实际尝试', `双方重新同意同一原标线实践，分别真实尝试。${method === 'ORDINARY' ? '普通口头约定下双方自愿停步，VOLUNTARY_STOP，无神秘禁令。' : ok ? '同一有限禁令让双方均停在原侧，BOTH_STOP、各0米。' : '同一次核对失败，双方都实际跨到2米侧，BOTH_CROSS、各2米；仍须撤规后普通回程。'}`);
  }
  ctx.note('本次实付与安全收束', `实耗1行动/${spiritualityCost}玩家灵性，知识${difficulty(c.caseId, method)}${ok ? '成功' : '失败'}。失败费用保留；实施打开接触锁，不能用换周跳过真实恢复、回程与原物交接。`);
}
function reportText(s: SliceState, id: ImperativeMageCaseId): string {
  const a = last(s.imperativeMage.life.cases[id])!;
  if (id === 'willing-attention') return a.method === 'ABILITY' ? '阿伦本人新同意的3秒有限注意已实际到期，自由注意恢复，仍在原椅桌旁。' : '普通自由注意核对成功，无魔法影响，原阿伦已自行结束接触。';
  if (id === 'one-borrowed-light') return `${a.method === 'ABILITY' ? '原FLASH基线LIT、暂剥后实际BLOCKED、经过10秒后本人再次LIT，原技能恢复' : '普通遮罩对照完成，原FLASH始终可用'}；实耗伙伴${a.partnerSpiritualityCost}灵性，本人真实2米取还同一原卡原罩。`;
  return `${a.method === 'ABILITY' ? '相同禁令实际约束本人和阿伦，两人均停步' : '本人和阿伦普通自由停步'}；已实际撤规，本人普通4米取还同一原牌原标条。`;
}

export function imperativeMageLifeActions(s: SliceState): ImperativeMageLifeAction[] {
  if (!active(s)) return [];
  const out: ImperativeMageLifeAction[] = [], l = s.imperativeMage.life;
  const add = (id: string, label: string, price: string, command: ImperativeMageActivityCommand) => { const reason = imperativeMageActivityReason(s, command); out.push({ id, label, cost: price, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = l.cases[p.id], a = last(r);
    if (r.contactOpen) {
      if (p.id === 'willing-attention') {
        if (!a?.cleaned) add(`${p.id}-release`, '经过剩余时间并恢复阿伦自由注意', `0行动 · 实际${l.attention.remainingSeconds}秒`, { type: 'RELEASE_ATTENTION', caseId: p.id });
        if (l.attention.consented) add(`${p.id}-consent`, '接受阿伦撤回本次同意', '0行动 · 已有效果仍须实际到期', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      }
      if (p.id === 'one-borrowed-light' && !a?.cleaned) {
        if (a?.lightCheck === 'NONE') add(`${p.id}-check`, '先核对同一伙伴原FLASH是否真正受阻', '0行动 · 仅本次一次 · 可用时伙伴实际2灵性', { type: 'CHECK_LIGHT', caseId: p.id });
        add(`${p.id}-restore`, '实际等待原能力恢复并再次亮原卡', `0行动 · 实际${l.light.remainingSeconds}秒 · 再示范伙伴2灵性`, { type: 'RESTORE_LIGHT', caseId: p.id });
      }
      if (p.id === 'equal-line' && !a?.cleaned) add(`${p.id}-remove`, '实际撤规并普通取还同一原牌', '0行动 · 本人本次合计4米 · 阿伦实际回程', { type: 'REMOVE_RULE', caseId: p.id });
      add(`${p.id}-close`, p.id === 'one-borrowed-light' ? '本人普通2米取还同一原卡原罩并结束' : '交还原物并确认原人自由、结束接触', '0行动 · 0额外玩家灵性 · 真实收束', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '当面观察原人原物与本次范围', '1行动 · 不用旧案代替本次同意', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(`${p.id}-ability`, '准备一次有限能力实践', `1行动 · 不施法 · 实施另${cost(p.id, 'ABILITY')}灵性`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备一次普通对照实践', '1行动 · 不施法 · 实施0灵性知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '重新确认本人许可并实际实施一次', `1行动 · ${cost(p.id, r.method!)}灵性 · 知识${difficulty(p.id, r.method!)}${p.id === 'one-borrowed-light' ? ' · 伙伴须至少6灵性' : ''}`, { type: 'PERFORM', caseId: p.id });
      if (p.id === 'willing-attention') add(`${p.id}-consent`, '接受实施前撤回本次同意', '0行动 · 不扣实施灵性', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告真实成功且实际收束的结果', '1行动 · G扮演+25 · 同案仅一次', { type: 'REPORT', caseId: p.id });
  }
  if (!['AVAILABLE', 'RESOLVED'].includes(l.cases['one-borrowed-light'].status)) add('imperative-mage-partner-rest', '安排原埃尔登本真实新周普通休息', '1行动 · 实际6小时 · 伙伴+6灵性上限12 · 每周一次', { type: 'PARTNER_REST' });
  if (!l.reflected) add('imperative-mage-reflect', '回看三份有限报告与实际成本', '1行动 · 三报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectImperativeMageLife(s: SliceState): ImperativeMageLifeProjection {
  if (!(s.progression.pathwayId==='justiciar'&&[4,3].includes(s.progression.sequence!))) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.imperativeMage.life;
  return {
    insideCase: hasImperativeMageLifeLock(s), environment: IMPERATIVE_MAGE_LIFE_ENVIRONMENT,
    cases: CASES.map(p => {
      const r = l.cases[p.id], a = last(r);
      return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
        result: a ? `${a.method}/${a.outcome}，核对${a.success ? '成功' : '失败'}；实耗1行动/${a.spiritualityCost}玩家灵性、${a.partnerSpiritualityCost}伙伴灵性；实际${a.elapsedSeconds}秒，本人${a.distanceMetres}米/阿伦${a.partnerDistanceMetres}米。${p.id === 'one-borrowed-light' ? `原FLASH ${a.baseline}→${a.lightCheck}→${a.restoration}。` : ''}${r.contactOpen ? '尚须0行动实际收束后才可报告。' : reportable(p.id, a) ? reportText(s, p.id) : '失败或证据不全，费用保留，下一真实周再试。'}` : r.withdrawals ? '未实施准备已取消，观察与已付准备成本保留。' : null,
        status: r.status, contactOpen: r.contactOpen ? '本次实际接触尚未收束，不能普通行动或换周' : '没有尚待收束的实际接触', closes: r.closes };
    }),
    practice: {
      attention: `同一原成年阿伦仍在原椅桌旁，独立心智；本次${l.attention.effect}、剩余${l.attention.remainingSeconds}秒，累计实际${l.attention.elapsedSeconds}秒；本人确认结束${l.attention.confirmations}次。`,
      partner: `${l.partner.id} ${l.partner.name}，实际成年${l.partner.profession}${l.partner.sequence}，会原FLASH；独立灵性${l.partner.spirituality}/${l.partner.maxSpirituality}、每次2灵性。原能力${l.partner.abilityAvailable ? '可用' : '暂时不可用'}，仍为本人已会。原相邻椅累计普通休息${l.partner.rests.length * 6}小时，不补玩家资源。`,
      light: `同一${l.light.cardId}/${l.light.hoodId}始终属于薇娜，当前${l.light.holder}、${l.light.positionMetres}米；普通罩对照${l.light.hoodComparison ? '正在进行' : '未进行'}，暂剥剩余${l.light.remainingSeconds}秒，累计实际${l.light.elapsedSeconds}秒；亲手归还${l.light.handovers}次。`,
      line: `同一${l.line.id}/${l.line.tokenId}均属薇娜；规则${l.line.rule}、同条件BOTH，真实尝试${l.line.testedBy}；本人${l.line.playerPositionMetres}米、原阿伦${l.line.partnerPositionMetres}米；原牌${l.line.tokenHolder}、原条${l.line.holder}，交还${l.line.handovers}次。`,
      consent: `原阿伦本次注意许可${l.attention.consented ? '已取得、实施仍重核' : '未生效或已结束'}，撤回${l.attention.consentWithdrawals}次；原埃尔登本次许可${l.partner.consented ? '已取得、实施仍重核' : '未生效或已结束'}。每次重试重新当面取得本人许可。`,
      route: `原卡原罩每次本人1米去1米回，累计${l.light.distanceMetres}米；同一标线案每次本人普通完整4米，累计${l.line.playerDistanceMetres}米；原阿伦累计${l.line.partnerDistanceMetres}米。原出口净空，不瞬移或复制原物。`,
      history: [...IMPERATIVE_MAGE_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => `${id} W${a.week} ${a.method}/${a.outcome}：实耗1行动/${a.spiritualityCost}玩家灵性/${a.partnerSpiritualityCost}伙伴灵性，真实${a.elapsedSeconds}秒、本人${a.distanceMetres}米/阿伦${a.partnerDistanceMetres}米；${a.closed ? '实际收束' : '仍待收束'}${id === 'one-borrowed-light' ? `，FLASH ${a.baseline}→${a.lightCheck}→${a.restoration}` : ''}${a.consentWithdrawn ? '，本人已撤回同意' : ''}。`)),
        ...l.partner.rests.map(r => `W${r.week} 原埃尔登原相邻椅真实休息${r.elapsedHours}小时，1行动、灵性${r.before}→${r.before + r.restored}/12。`),
        '旧仲裁人、治安官、审讯者、法官、惩戒骑士五域及原阿伦、旧迪恩结局、旧软靶/标线/原纸与全部旧掌握保留。'],
    },
  };
}

/** Validate the finite scene, actual partner expenditure/rest, and original-object routes. */
export function validateImperativeMageLife(s: SliceState): boolean {
  try {
    const l = s.imperativeMage.life, start = s.imperativeMage.promotionWeek;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'attention', 'partner', 'light', 'line']) || !record(l.cases) || !shape(l.cases, IMPERATIVE_MAGE_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (start === null) return stableStringify(l) === stableStringify(createImperativeMageLifeState());
    if (!integer(start, 1, s.week)) return false;
    let open = 0, prepared = 0, resolved = 0;
    for (const [index, id] of IMPERATIVE_MAGE_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || ![r.preparations, r.withdrawals, r.closes].every(x => integer(x)) || !Array.isArray(r.attempts)) return false;
      let previousWeek = start - 1;
      for (const [n, a] of r.attempts.entries()) {
        if (!record(a) || !shape(a, ['week', 'method', 'success', 'actionCost', 'spiritualityCost', 'outcome', 'elapsedSeconds', 'distanceMetres', 'partnerDistanceMetres', 'cleaned', 'closed', 'consentWithdrawn', 'partnerSpiritualityBefore', 'partnerSpiritualityCost', 'baseline', 'lightCheck', 'restoration']) || !integer(a.week, start, s.week) || a.week <= previousWeek || !['ABILITY', 'ORDINARY'].includes(a.method) || ![a.success, a.cleaned, a.closed, a.consentWithdrawn].every(x => typeof x === 'boolean') || a.actionCost !== 1 || a.spiritualityCost !== cost(id, a.method) || a.outcome !== outcome(id, a.method, a.success)) return false;
        if (a.elapsedSeconds !== (a.cleaned ? duration(a) : 0) || id !== 'willing-attention' && a.consentWithdrawn || a.closed && !a.cleaned) return false;
        const crossed = a.outcome === 'BOTH_CROSS';
        if (a.distanceMetres !== (id === 'one-borrowed-light' ? a.closed ? 2 : 0 : id === 'equal-line' ? a.cleaned ? 4 : crossed ? 2 : 0 : 0) || a.partnerDistanceMetres !== (id === 'equal-line' && crossed ? a.cleaned ? 4 : 2 : 0)) return false;
        if (id === 'one-borrowed-light') {
          if (!integer(a.partnerSpiritualityBefore, 6, 12) || a.baseline !== 'LIT' || !['NONE', 'BLOCKED', 'LIT', 'EXHAUSTED'].includes(a.lightCheck) || !['NONE', 'LIT', 'NO_RESOURCE'].includes(a.restoration)) return false;
          const deprived = a.outcome === 'DEPRIVED', afterBase = a.partnerSpiritualityBefore - 2;
          if (a.lightCheck !== 'NONE' && a.lightCheck !== (deprived ? 'BLOCKED' : afterBase >= 2 ? 'LIT' : 'EXHAUSTED')) return false;
          const afterCheck = afterBase - (a.lightCheck === 'LIT' ? 2 : 0);
          if (a.restoration !== (a.cleaned ? afterCheck >= 2 ? 'LIT' : 'NO_RESOURCE' : 'NONE') || a.partnerSpiritualityCost !== 2 + (a.lightCheck === 'LIT' ? 2 : 0) + (a.restoration === 'LIT' ? 2 : 0)) return false;
        } else if (a.partnerSpiritualityBefore !== null || a.partnerSpiritualityCost !== 0 || a.baseline !== 'NONE' || a.lightCheck !== 'NONE' || a.restoration !== 'NONE') return false;
        if (a.closed !== (n < r.attempts.length - 1 || !r.contactOpen) || n < r.attempts.length - 1 && reportable(id, a)) return false;
        previousWeek = a.week;
      }
      const a = last(r), ready = r.status === 'PREPARED', hasResult = !!a && (r.contactOpen ? a.success : reportable(id, a));
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(ready)) return false;
      if (r.contactOpen && (!a || a.week !== s.week || ready || r.status === 'RESOLVED' || r.method !== a.method)) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') !== hasResult || r.status === 'RESOLVED' && !a?.closed) return false;
      if ((ready || r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method === null || !r.contactOpen && ['AVAILABLE', 'OBSERVED'].includes(r.status) && r.method !== null) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method !== a?.method) return false;
      if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (index > 0 && r.status !== 'AVAILABLE' && l.cases[IMPERATIVE_MAGE_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === source(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(ready); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const at = l.attention, partner = l.partner, light = l.light, line = l.line;
    const ar = l.cases['willing-attention'], lr = l.cases['one-borrowed-light'], er = l.cases['equal-line'];
    const aa = last(ar), la = last(lr), ea = last(er), held = !!(ar.contactOpen && aa?.outcome === 'ATTENTION_HELD' && !aa.cleaned), deprived = !!(lr.contactOpen && la?.outcome === 'DEPRIVED' && !la.cleaned), crossing = !!(er.contactOpen && ea?.outcome === 'BOTH_CROSS' && !ea.cleaned);
    if (!record(at) || !shape(at, ['person', 'position', 'independentMind', 'consented', 'effect', 'remainingSeconds', 'elapsedSeconds', 'consentWithdrawals', 'cancelledConsents', 'confirmations']) || at.person !== 'ORIGINAL_ARLEN' || at.position !== 'ORIGINAL_CHAIR_DESK' || at.independentMind !== true || !integer(at.cancelledConsents, 0, ar.withdrawals)) return false;
    if (at.effect !== (held ? 'ATTENTION_HELD' : 'NONE') || at.remainingSeconds !== (held ? 3 : 0) || at.elapsedSeconds !== ar.attempts.reduce((n, a) => n + a.elapsedSeconds, 0) || at.confirmations !== ar.closes || at.consentWithdrawals !== at.cancelledConsents + ar.attempts.filter(a => a.consentWithdrawn).length || at.consented !== (ar.status === 'PREPARED' || ar.contactOpen && !aa?.consentWithdrawn)) return false;
    if (!record(partner) || !shape(partner, ['id', 'name', 'adult', 'pathwayId', 'sequence', 'profession', 'position', 'independentMind', 'knownAbilities', 'spirituality', 'maxSpirituality', 'abilityAvailable', 'consented', 'confirmations', 'rests']) || partner.id !== 'IM4-ELDEN-VALE' || partner.name !== '埃尔登·维尔' || partner.adult !== true || partner.pathwayId !== 'door' || partner.sequence !== 8 || partner.profession !== '戏法大师' || partner.position !== 'ORIGINAL_ADJACENT_CHAIR' || partner.independentMind !== true || stableStringify(partner.knownAbilities) !== '["FLASH"]' || partner.maxSpirituality !== 12 || !integer(partner.spirituality, 0, 12) || partner.abilityAvailable !== !deprived || partner.consented !== (lr.status === 'PREPARED' || lr.contactOpen) || partner.confirmations !== lr.closes || !Array.isArray(partner.rests)) return false;
    let spirit = 12, restIndex = 0, restWeek = start, restAfter = 0;
    for (let n = 0; n <= lr.attempts.length; n += 1) {
      while (partner.rests[restIndex]?.afterAttempts === n) {
        const rest = partner.rests[restIndex]!;
        if (!record(rest) || !shape(rest, ['week', 'afterAttempts', 'before', 'restored', 'elapsedHours']) || !integer(rest.week, start + 1, s.week) || rest.week <= restWeek || !integer(rest.afterAttempts, restAfter, lr.attempts.length) || rest.elapsedHours !== 6 || rest.before !== spirit || spirit >= 12 || rest.restored !== Math.min(6, 12 - spirit) || n > 0 && (!lr.attempts[n - 1]!.closed || rest.week < lr.attempts[n - 1]!.week) || n < lr.attempts.length && rest.week > lr.attempts[n]!.week) return false;
        spirit += rest.restored; restWeek = rest.week; restAfter = rest.afterAttempts; restIndex += 1;
      }
      if (n < lr.attempts.length) { const a = lr.attempts[n]!; if (a.partnerSpiritualityBefore !== spirit) return false; spirit -= a.partnerSpiritualityCost; }
    }
    if (restIndex !== partner.rests.length || spirit !== partner.spirituality) return false;
    if (!record(light) || !shape(light, ['cardId', 'hoodId', 'owner', 'holder', 'positionMetres', 'hoodComparison', 'remainingSeconds', 'elapsedSeconds', 'distanceMetres', 'handovers']) || light.cardId !== 'IM4-CARD-1' || light.hoodId !== 'IM4-HOOD-1' || light.owner !== 'GUIDE' || light.holder !== (lr.contactOpen ? 'TABLE' : 'GUIDE') || light.positionMetres !== (lr.contactOpen ? 1 : 0) || light.hoodComparison !== !!(lr.contactOpen && la?.method === 'ORDINARY' && !la.cleaned) || light.remainingSeconds !== (deprived ? 10 : 0) || light.elapsedSeconds !== lr.attempts.reduce((n, a) => n + a.elapsedSeconds, 0) || light.distanceMetres !== lr.attempts.reduce((n, a) => n + a.distanceMetres, 0) || light.handovers !== lr.closes) return false;
    if (!record(line) || !shape(line, ['id', 'tokenId', 'owner', 'holder', 'tokenHolder', 'partner', 'rule', 'appliesTo', 'testedBy', 'playerPositionMetres', 'partnerPositionMetres', 'playerDistanceMetres', 'partnerDistanceMetres', 'handovers']) || line.id !== 'IM4-LINE-1' || line.tokenId !== 'IM4-TOKEN-1' || line.owner !== 'GUIDE' || line.partner !== 'ORIGINAL_ARLEN' || line.appliesTo !== 'BOTH' || line.testedBy !== (er.attempts.length ? 'BOTH' : 'NONE') || line.holder !== (er.contactOpen && !ea?.cleaned ? 'FLOOR' : 'GUIDE') || line.tokenHolder !== (er.contactOpen ? ea?.cleaned ? 'PLAYER' : 'TABLE' : 'GUIDE') || line.rule !== (er.contactOpen && !ea?.cleaned && ea?.method === 'ABILITY' ? 'NO_CROSSING' : 'NONE') || line.playerPositionMetres !== (crossing ? 2 : 0) || line.partnerPositionMetres !== (crossing ? 2 : 0) || line.playerDistanceMetres !== er.attempts.reduce((n, a) => n + a.distanceMetres, 0) || line.partnerDistanceMetres !== er.attempts.reduce((n, a) => n + a.partnerDistanceMetres, 0) || line.handovers !== er.closes) return false;
    if (s.seer.completedSources.filter(x => x === 'imperative-mage-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3 || (active(s)||s.progression.pathwayId==='justiciar'&&s.progression.sequence===3) && (s.progression.sequence===3?s.chaosHunter.imperativeMageActingAtPromotion:s.progression.acting) !== resolved * 25 + Number(l.reflected) * 25) return false;
    if (hasImperativeMageLifeLock(s) && (!active(s) || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat || oldOpen(s))) return false;
    return true;
  } catch { return false; }
}
