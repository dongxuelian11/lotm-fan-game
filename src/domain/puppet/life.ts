import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { PuppetAbilityId } from './types.js';

export const PUPPET_CASE_IDS = ['moving-token', 'chosen-form', 'reversible-link'] as const;
export type PuppetCaseId = typeof PUPPET_CASE_IDS[number];
export type PuppetForm = 'HUMAN' | 'WOOD' | 'PAPER';
export type PuppetActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: PuppetCaseId }
  | { type: 'PREPARE'; caseId: PuppetCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'FORM_TRIAL'; caseId: 'chosen-form'; form: 'WOOD' | 'PAPER' }
  | { type: 'RETURN_FORM_ROUTE' | 'RESTORE_FORM'; caseId: 'chosen-form' }
  | { type: 'RETURN_ROUTE'; caseId: 'moving-token' }
  | { type: 'WITHDRAW_CONSENT'; caseId: 'reversible-link' }
  | { type: 'HANDLE_MOON'; method: 'GUARDED' | 'ALONE' }
  | { type: 'REFLECT' };
export interface PuppetLifeAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; form: 'WOOD' | 'PAPER' | null;
  success: boolean; actionCost: 1; spiritualityCost: 0 | 3;
  returned: boolean; restored: boolean; consentWithdrawn: boolean;
}
export interface PuppetCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean;
  preparations: number; withdrawals: number; closes: number; attempts: PuppetLifeAttempt[];
}
export interface PuppetMoonNotice { id: 'PU4-MOON-1' | 'PU4-MOON-2'; week: number }
export interface PuppetMoonHistory {
  id: PuppetMoonNotice['id']; announcedWeek: number; week: number;
  method: 'GUARDED' | 'ALONE'; mentalCost: number; waitedHours: 6; deferred: boolean;
}
export interface PuppetLifeState {
  cases: Record<PuppetCaseId, PuppetCaseState>; reflected: boolean;
  token: {
    id: 'PU4-TOKEN-1'; owner: 'HARLAN'; permission: boolean;
    position: 'NEAR' | 'FAR' | 'PLAYER' | 'GUIDE'; playerNode: 'NEAR' | 'FAR';
    distanceMetres: number; handovers: number;
  };
  body: { owner: 'SELF'; form: PuppetForm; node: 'DOOR'; route: 'UNTRIED' | 'WAITING' | 'RETURNED'; checked: { WOOD: boolean; PAPER: boolean }; distanceMetres: number; restorations: number };
  link: { subjectId: 'NOLAN'; consented: boolean; state: 'NONE' | 'LINKED' | 'RELEASED'; contactDistanceMetres: number; consentWithdrawals: number; releases: number };
  note: { id: 'PU4-NOTE-1'; holder: 'GUIDE' | 'PLAYER'; writings: string[]; handovers: number };
  moon: { notices: PuppetMoonNotice[]; pendingId: PuppetMoonNotice['id'] | null; history: PuppetMoonHistory[]; waitedHours: number };
}
export interface PuppetLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PuppetActivityCommand }
export interface PuppetLifeProjection {
  cases: { id: PuppetCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: null | { token: string; body: string; formState: PuppetForm; forms: string; link: string; linkState: PuppetLifeState['link']['state']; consent: string; note: string; route: string; history: string[] };
  moon: { title: string; pendingWeek: number | null; notices: { id: string; week: number; title: string; status: string }[]; history: string[]; waitedHours: number; rule: string };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const active = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 4;
const last = (r: PuppetCaseState) => r.attempts.at(-1);
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const source = (id: PuppetCaseId) => `puppet-case:${id}`;
const emptyCase = (): PuppetCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const complete = (id: PuppetCaseId, r: PuppetCaseState) => id === 'chosen-form'
  ? r.attempts.some(a => a.method === 'ORDINARY' && a.success) || ['WOOD', 'PAPER'].every(form => r.attempts.some(a => a.form === form && a.success))
  : r.attempts.some(a => a.success);
const abilityIds: Record<PuppetCaseId, PuppetAbilityId> = { 'moving-token': 'chained.s4.object-motion', 'chosen-form': 'chained.s4.cursed-form', 'reversible-link': 'chained.s4.curse-link' };
const CASES = [
  { id: 'moving-token', title: '同一原木片的两米移动与亲手归还', story: '原创成年哈伦·维斯在贝克兰德原工坊，拥有放在NEAR原桌端的同一木片PU4-TOKEN-1。他当面只允许这次沿净空桌面移动到两米外FAR原标记；所有权始终是哈伦的。（原创G）', facts: ['观察时原主人本人当面许可，准备不施法。能力成功才使原木片到FAR；失败原木片仍在NEAR，没有复制或隐形新物。', '能力实施1行动3灵性、知识18。成功后本人普通走两米至FAR，拾起同一原木片，再携它走两米返回；普通方法则先携原木片走两米，随后原路走回。', '0行动返程用本次实践已付预算，记录真实共四米步行；CLOSE亲手把同一原木片交回哈伦。失败照付，下个真实周才重试同一原物。'], ability: '准备让原木片沿净空原桌移动两米；实施1行动3灵性、知识18，不自动取回。', ordinary: '准备普通携同一原木片走两米到FAR，再沿原路回来；实施1行动0灵性、知识10。' },
  { id: 'chosen-form', title: '同一个身体的木偶与纸人两次实试', story: '原空工坊的DOOR与PAD相距两米，路线净空且没有活人实验对象。哈伦观察你自己的同一具身体分别尝试神秘木偶WOOD与魔法纸人PAPER，两种形态独立付费并真实还原。（原创G）', facts: ['每种FORM_TRIAL各1行动3灵性、知识18；成功只改变本人原身体，原衣物随身，不在门口留下第二具身体，不缩小或复制装备。', '成功后0行动实际从DOOR到PAD两米并走回两米，再0行动实际还原HUMAN；这是该次预付有限试验的收束，不能保持形态继续普通活动。', '两种形态都成功、实际去回并还原才可报告能力结果；失败保持HUMAN，仍须当面结束，失败同形态下一真实周才能重试。普通方法只观察姿态和非魔法木/纸展示，不冒称变形。'], ability: '准备自己的有限变形。明确选择WOOD或PAPER，各自另付1行动3灵性；两种都真实成功才奖励该项能力。', ordinary: '普通检查本人站姿与原有非魔法木/纸展示；1行动0灵性、知识10，不变形、不获得能力掌握。' },
  { id: 'reversible-link', title: '诺兰可撤回的一次联系与同纸记录', story: '原成年诺兰本人只同意这一次短暂接触、建立有限联系和释放的演示，明确不同意受伤或被命令。原记录纸PU4-NOTE-1属于哈伦，与旧WF5原旗和原纸分别保管。（原创G）', facts: ['能力实施1行动3灵性、知识18。本人普通接近一米并返回一米，尝试接触同一位原诺兰；失败费用保留、联系NONE，成功只是LINKED。', '本案不会伤害诺兰、转移其意志或自动启动诅咒。本人可以0行动撤回同意，立即实际释放RELEASED，不能继续；CLOSE也会释放仍在的联系。', '在同一张PU4-NOTE-1写明成功或失败与未测试伤害/强制意志的局限，0行动亲手交回。普通方法只是当面讨论具体边界，不产生隐藏联系或能力掌握。'], ability: '准备在诺兰此次有限同意内进行短暂接触与释放；1行动3灵性、知识18，不能伤害或命令他。', ordinary: '普通讨论并记录这一次允许与禁止的具体范围；1行动0灵性、知识10，没有隐蔽施法。' },
] as const;
export const PUPPET_MOON_RULE = '木偶4的具体原著满月诅咒尚未核明；这里仅有导师在实际晋升后公告的两场原创G工坊月相事件，日期为晋升后第3与第8周，不是28天循环或天文推算。表现为G身体僵硬与专注脆弱，不能写成怨魂5必须吞食人类灵魂；旧狼人/活尸/怨魂记录保留且不叠加。每场实际等待六小时G、守望至多8精神或独处至多16精神；没有治疗、成长或补充。两场结束不自动续排，也不代表诅咒消失。';
export const PUPPET_LIFE_ENVIRONMENT = '三项有限原创G实践：观察、每次准备、每次实施、报告各1行动，每份报告扮演25，三案后1行动反思25。能力实施3灵性、知识18，普通0灵性、知识10；失败照付、失败项目下一真实周再试。两个自身形态需分别实付与完成；每案成功能力报告只给对应新能力掌握8，普通和平100不伪造能力掌握或原著无风险消化。原木片、原诺兰和新原纸保持同一性；停止、原路返回、真实还原与释放为已付实践的0行动收束，0灵性仍可完成，不退款或治疗。不是占卜家秘偶尸体、控制木制NPC的思想、支配敌人封印物或免费无敌。' + PUPPET_MOON_RULE;

export function createPuppetLifeState(): PuppetLifeState {
  return {
    cases: { 'moving-token': emptyCase(), 'chosen-form': emptyCase(), 'reversible-link': emptyCase() }, reflected: false,
    token: { id: 'PU4-TOKEN-1', owner: 'HARLAN', permission: false, position: 'NEAR', playerNode: 'NEAR', distanceMetres: 0, handovers: 0 },
    body: { owner: 'SELF', form: 'HUMAN', node: 'DOOR', route: 'UNTRIED', checked: { WOOD: false, PAPER: false }, distanceMetres: 0, restorations: 0 },
    link: { subjectId: 'NOLAN', consented: false, state: 'NONE', contactDistanceMetres: 0, consentWithdrawals: 0, releases: 0 },
    note: { id: 'PU4-NOTE-1', holder: 'GUIDE', writings: [], handovers: 0 },
    moon: { notices: [], pendingId: null, history: [], waitedHours: 0 },
  };
}
/** Only acquisition calls this, after successful actual promotion. Reading never starts a moon. */
export function initializePuppetMoon(s: SliceState): void {
  if (!active(s) || s.puppet.promotionWeek === null || s.puppet.life.moon.notices.length) return;
  const week = s.puppet.promotionWeek;
  s.puppet.life.moon.notices = [{ id: 'PU4-MOON-1', week: week + 3 }, { id: 'PU4-MOON-2', week: week + 8 }];
}
const physicalOpen = (s: SliceState) => {
  const l = s.puppet.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.token.playerNode !== 'NEAR' || l.token.position === 'PLAYER' || l.token.position === 'FAR' || l.body.form !== 'HUMAN' || l.link.state === 'LINKED' || l.note.holder === 'PLAYER';
};
const oldOpen = (s: SliceState) => s.werewolf.moon.pendingWeek !== null || s.zombie.moon.pendingWeek !== null || s.wraith.moon.pendingWeek !== null
  || Object.values(s.prisoner.cases).some(r => r.holding) || Object.values(s.madman.cases).some(r => r.burstOpen)
  || Object.values(s.werewolf.cases).some(r => r.sceneOpen) || Object.values(s.zombie.cases).some(r => r.contactOpen) || Object.values(s.wraith.cases).some(r => r.contactOpen)
  || s.wraith.practice.form !== 'HUMAN' || s.wraith.practice.host !== 'SELF' || s.wraith.practice.node !== 'ROOM' || s.wraith.practice.mirror !== 'COVERED';
export function hasPuppetLifeLock(s: SliceState): boolean { return s.puppet.life.moon.pendingId !== null || physicalOpen(s); }
export function syncPuppetMoon(s: SliceState, ctx: SeerContext): void {
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.activeEvent || s.combat || hasPuppetLifeLock(s) || oldOpen(s)) return;
  const moon = s.puppet.life.moon;
  const notice = moon.notices.find(n => n.week <= s.week && !moon.history.some(h => h.id === n.id));
  if (!notice) return;
  moon.pendingId = notice.id;
  ctx.note('导师原告示的木偶G月相事件开始', `${notice.id}原公告第${notice.week}周，当前第${s.week}周${s.week > notice.week ? '，先前实际事件或联系结束后延后处理同一场' : ''}。现在出现原创G身体僵硬与专注脆弱，先暂停普通活动并实际等过六小时。${PUPPET_MOON_RULE}`);
}
export function validatePuppetActivityCommand(c: unknown): c is PuppetActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT') return shape(c, ['type']);
  if (c.type === 'HANDLE_MOON') return shape(c, ['type', 'method']) && ['GUARDED', 'ALONE'].includes(c.method as string);
  if (!PUPPET_CASE_IDS.includes(c.caseId as PuppetCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'FORM_TRIAL') return c.caseId === 'chosen-form' && shape(c, ['type', 'caseId', 'form']) && ['WOOD', 'PAPER'].includes(c.form as string);
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)
    || c.type === 'RETURN_ROUTE' && c.caseId === 'moving-token' || ['RETURN_FORM_ROUTE', 'RESTORE_FORM'].includes(c.type as string) && c.caseId === 'chosen-form'
    || c.type === 'WITHDRAW_CONSENT' && c.caseId === 'reversible-link');
}
const formAvailable = (s: SliceState, form: 'WOOD' | 'PAPER') => !s.puppet.life.cases['chosen-form'].attempts.some(a => a.form === form && (a.success || a.week === s.week));
export function puppetActivityReason(s: SliceState, c: PuppetActivityCommand): string | null {
  if (!validatePuppetActivityCommand(c)) return '木偶实践命令无效。';
  if (!active(s)) return '先完成木偶晋升。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (oldOpen(s)) return '先实际结束原先阶段的联系与月相事件。';
  const l = s.puppet.life, r = 'caseId' in c ? l.cases[c.caseId] : null, a = r ? last(r) : undefined;
  if (c.type === 'HANDLE_MOON') {
    if (physicalOpen(s)) return '先实际返回、还原自身、释放联系并交回同一原物。';
    if (l.moon.pendingId === null) return '当前没有待度过的木偶G月相事件。';
    return c.method === 'GUARDED' && (s.world.city !== 'BACKLUND' || !s.puppet.guidanceKnown) ? '原哈伦本人只在贝克兰德原工坊提供守望，不能召来异地。' : null;
  }
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德哈伦的原工坊。';
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen || !a || a.week !== s.week) return '没有尚待结束的本次实际接触。';
    if (!a.returned) return '先0行动沿本次原路线真实返回。';
    if (!a.restored || l.body.form !== 'HUMAN') return '先0行动把同一身体实际还原HUMAN。';
    return null;
  }
  if (c.type === 'RETURN_ROUTE') return r?.contactOpen && a && !a.returned ? null : '同一原木片与本人已经返回，没有额外免费路线。';
  if (c.type === 'RETURN_FORM_ROUTE') return r?.contactOpen && a?.success && a.form !== null && !a.returned && l.body.form === a.form ? null : '须先付费成功变为所选自身形态，且尚未完成这次去回。';
  if (c.type === 'RESTORE_FORM') return r?.contactOpen && a?.success && a.form !== null && a.returned && !a.restored && l.body.form === a.form ? null : '须先实际走完原两米去回，再还原同一身体。';
  if (c.type === 'WITHDRAW_CONSENT') return r?.contactOpen && l.link.consented && l.link.state === 'LINKED' ? null : '须本次真实联系仍在，由原诺兰本人撤回这次同意。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只可取消尚未实施的准备。';
  if (hasPuppetLifeLock(s)) return '先0行动真实返回、还原、释放与交付，或实际度过已公告G月相事件。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已付实践的0行动收束不受此限制。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = PUPPET_CASE_IDS.find(id => l.cases[id].status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared)) return '先实施或取消现有准备。';
  if (c.type === 'REFLECT') return l.reflected ? '已经回看本组三项经历。' : PUPPET_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份真实报告。' : null;
  if (!r) return '未知木偶现场。';
  if (r.status === 'RESOLVED') return '本案已经报告，不重复奖励。';
  if (c.type === 'OBSERVE') {
    const n = PUPPET_CASE_IDS.indexOf(c.caseId);
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : n > 0 && l.cases[PUPPET_CASE_IDS[n - 1]!].status !== 'RESOLVED' ? '先完成前一份真实报告。' : null;
  }
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先观察原现场，已完成结果直接报告。';
    if (c.caseId === 'chosen-form' && c.method === 'ABILITY') return formAvailable(s, 'WOOD') || formAvailable(s, 'PAPER') ? null : '两种形态已成功或本周均已尝试；失败形态下一真实周再试。';
    return a?.week === s.week ? '本周本项已实际尝试，失败下一真实周再准备。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && complete(c.caseId, r) ? null : '先取得真实成功、完成实际收束；能力形态须两种都成功。';
  if (r.status !== 'PREPARED' || r.method === null) return '先准备这一次实践。';
  if (c.type === 'FORM_TRIAL') {
    if (r.method !== 'ABILITY') return 'FORM_TRIAL只适用于已准备的自身能力实践。';
    if (!formAvailable(s, c.form)) return '这项自身形态已经成功，或本周失败仍须下一真实周再试。';
  } else if (c.type === 'PERFORM' && c.caseId === 'chosen-form' && r.method === 'ABILITY') return '请明确选择WOOD或PAPER并各自进行FORM_TRIAL。';
  if (r.method === 'ABILITY' && s.spirituality < 3) return '本次能力需要3灵性，不能透支。';
  if (c.caseId === 'moving-token' && !l.token.permission || c.caseId === 'reversible-link' && !l.link.consented) return '原主人许可或诺兰本人这次同意已经结束，需要重新准备。';
  return null;
}

export function applyPuppetActivity(s: SliceState, c: PuppetActivityCommand, ctx: SeerContext, award: (id: PuppetAbilityId, amount?: number) => void): void {
  const reason = puppetActivityReason(s, c);
  if (reason) throw new Error(reason);
  if (!validatePuppetLife(s)) throw new Error('木偶原现场与实际历史不一致。');
  const l = s.puppet.life;
  if (c.type === 'HANDLE_MOON') {
    const notice = l.moon.notices.find(n => n.id === l.moon.pendingId)!, mentalCost = Math.min(s.mind, c.method === 'GUARDED' ? 8 : 16);
    s.mind -= mentalCost;
    l.moon.history.push({ id: notice.id, announcedWeek: notice.week, week: s.week, method: c.method, mentalCost, waitedHours: 6, deferred: s.week > notice.week });
    l.moon.pendingId = null; l.moon.waitedHours += 6;
    ctx.note('实际等待六小时度过本场木偶G事件', `${notice.id}：${c.method === 'GUARDED' ? '原哈伦本人自愿留在贝克兰德原工坊守望，你在旁边独立空间实际等待' : '你留在当前实际地点停止接触与普通活动，独自实际等待'}六小时G，精神实际减少${mentalCost}，本周日期不额外跳周。没有伤人、吞食灵魂、治疗、补充灵性或成长；不触发旧阶段叠加。${PUPPET_MOON_RULE}`); return;
  }
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('puppet-reflection');
    ctx.note('回看原物、自己的身体与可释放的联系', '三份真实报告已经保留。G扮演+25；普通检查不冒称变形，有限联系不冒称伤害或强迫意志，真实去回不冒称瞬移。旧人物、伤势、原旗原纸与旧月相历史不改，和平100不解除未知的原著木偶诅咒。'); return;
  }
  const r = l.cases[c.caseId], p = CASES.find(p => p.id === c.caseId)!, a = last(r);
  if (c.type === 'RETURN_ROUTE') {
    const distance = r.method === 'ABILITY' ? 4 : 2;
    l.token.distanceMetres += distance; l.token.playerNode = 'NEAR'; l.token.position = 'PLAYER'; a!.returned = true;
    ctx.note('携同一原木片真实走回', r.method === 'ABILITY' ? '你本人普通走两米至FAR，亲手拾起同一PU4-TOKEN-1，再携它普通走两米返回NEAR，共四米。没有远程取回或新造木片，仍须亲手交给哈伦。' : '你已在FAR，携同一PU4-TOKEN-1沿原路线普通走两米回NEAR，本次累计四米；仍须亲手交给哈伦。'); return;
  }
  if (c.type === 'RETURN_FORM_ROUTE') {
    a!.returned = true; l.body.route = 'RETURNED'; l.body.distanceMetres += 4;
    ctx.note('同一变形身体真实完成原路去回', `你以自己的${a!.form}形态从DOOR普通移动两米至PAD，再移动两米回DOOR，实际共四米；没有身体分身、瞬移、物品复制或缩小。0额外行动/灵性使用本次已付有限试验预算，接下来仍须实际还原。`); return;
  }
  if (c.type === 'RESTORE_FORM') {
    a!.restored = true; l.body.form = 'HUMAN'; l.body.restorations += 1;
    ctx.note('同一原身体实际还原人形', '你在原DOOR把同一个木偶或纸人身体实际还原HUMAN，原衣物始终随身，没有另一具身体或新装备。0行动、0额外灵性，伤势和已付成本保留，不治疗；仍须当面结束本次实践。'); return;
  }
  if (c.type === 'WITHDRAW_CONSENT') {
    l.link.consented = false; l.link.state = 'RELEASED'; l.link.consentWithdrawals += 1; l.link.releases += 1; a!.consentWithdrawn = true;
    ctx.note('原诺兰本人撤回，真实联系立即释放', '诺兰当面说“这一次就到这里”。你立即实际解除本次LINKED联系为RELEASED，不再继续，不伤害他、不命令他；已发生的有限建立保留，仍须把同一PU4-NOTE-1亲手交回哈伦。'); return;
  }
  if (c.type === 'WITHDRAW') {
    r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'moving-token') l.token.permission = false;
    if (c.caseId === 'reversible-link') l.link.consented = false;
    ctx.note('取消尚未实施的这次准备', '0行动，原观察与已付准备行动保留。原主人许可或本人本次同意同时结束；没有新的施法、移动、变形或联系。'); return;
  }
  if (c.type === 'CLOSE') {
    r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'moving-token') {
      l.token.position = 'GUIDE'; l.token.permission = false; l.token.handovers += 1;
      ctx.note('亲手交回同一原木片', '你在NEAR亲手将同一PU4-TOKEN-1交回原主人哈伦，他实际接住；失败留在NEAR的木片也由你当场拾起交还。所有权始终属于他，后续重试仍是同一原物。');
    } else if (c.caseId === 'chosen-form') {
      ctx.note('在原门口实际结束自身试验', '你已在DOOR且同一原身体为HUMAN；失败则保持原人形，成功则已经真实走完去回并显式还原。结束本次实践，不把木偶或纸人形态延长成普通活动中的免费保护。');
    } else {
      if (l.link.state === 'LINKED') { l.link.state = 'RELEASED'; l.link.releases += 1; }
      l.link.consented = false; l.note.holder = 'GUIDE'; l.note.handovers += 1;
      ctx.note('实际释放联系并交回同一原记录纸', '仍有的本次联系实际解除；若此前已由诺兰撤回，就保留已释放事实，不虚构再次释放。你本人把同一PU4-NOTE-1亲手交给哈伦，失败文字保留，下次只在同一原纸更正。没有伤害、控制或改写旧WF5原旗原纸。');
    }
    if (!complete(c.caseId, r)) { r.status = 'OBSERVED'; r.method = null; }
    ctx.note('本次0行动收束已完成', '不退已付行动与灵性，不治疗、不奖励。真实成功方可报告；自身能力必须两种形态都已真实成功。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    if (c.caseId === 'moving-token') l.token.permission = true;
    if (c.caseId === 'reversible-link') l.link.consented = true;
    ctx.note(p.title, p.story + p.facts.join(' ')); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1;
    if (c.caseId === 'moving-token') l.token.permission = true;
    if (c.caseId === 'reversible-link') l.link.consented = true;
    ctx.note('准备这一次有限实践', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '哈伦或原诺兰当面确认本次限定范围；准备本身不施法。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push(source(c.caseId));
    if (r.method === 'ABILITY') award(abilityIds[c.caseId], 8);
    ctx.note(p.title, reportText(s, c.caseId) + (r.method === 'ABILITY' ? '本案真实能力报告仅一次掌握+8、G扮演+25。' : '普通方法没有施法或能力掌握，仅一次G扮演+25。')); return;
  }
  const method = r.method!, form = c.type === 'FORM_TRIAL' ? c.form : null;
  if (method === 'ABILITY') s.spirituality -= 3;
  const passed = success(ctx.check('knowledge', method === 'ABILITY' ? 18 : 10).tier);
  const attempt: PuppetLifeAttempt = { week: s.week, method, form, success: passed, actionCost: 1, spiritualityCost: method === 'ABILITY' ? 3 : 0, returned: true, restored: true, consentWithdrawn: false };
  r.attempts.push(attempt); r.contactOpen = true;
  if (c.caseId === 'moving-token') {
    if (method === 'ORDINARY') { l.token.position = 'PLAYER'; l.token.playerNode = 'FAR'; l.token.distanceMetres += 2; attempt.returned = false; }
    else { l.token.position = passed ? 'FAR' : 'NEAR'; attempt.returned = !passed; }
    ctx.note('同一原木片的实际结果', method === 'ORDINARY' ? '你实际拿起同一PU4-TOKEN-1，普通携它走两米到FAR；即使核对失败也保留去程，须沿原路回来。' : passed ? '同一PU4-TOKEN-1沿净空桌面实际移动两米到FAR，你本人仍在NEAR；尚未拾回、没有复制。' : '实际付费尝试未能移动原PU4-TOKEN-1，它仍在NEAR。没有新木片，须当面交还收束。');
  } else if (c.caseId === 'chosen-form') {
    l.body.route = 'UNTRIED';
    if (form && passed) { l.body.form = form; l.body.route = 'WAITING'; l.body.checked[form] = true; attempt.returned = false; attempt.restored = false; }
    ctx.note('自己的同一原身体', form ? passed ? `实际成为${form}，本人全部身体在DOOR，起点没有另一具身体，原衣物仍随身。须明确实际去回与还原；当前不能普通活动。` : `付费${form}试验失败，身体保持HUMAN；费用保留，仍须结束，下一真实周再试此形态。` : '你普通检查自己的站姿与非魔法木/纸展示，一直HUMAN，没有木偶化、纸人化或新能力掌握。');
  } else {
    if (method === 'ABILITY') { l.link.contactDistanceMetres += 2; l.link.state = passed ? 'LINKED' : 'NONE'; }
    l.note.holder = 'PLAYER';
    l.note.writings.push(`PU4-NOTE-1 第${s.week}周：${method === 'ABILITY' ? `本人普通接近原诺兰一米并返回一米，本次有限联系${passed ? '成功建立' : '尝试失败'}` : '普通讨论诺兰这一次具体同意与禁止范围'}；${passed ? '核对成功' : '核对失败，文字保留待更正'}。没有测试伤害、诅咒传伤或强制意志，不作保证。`);
    ctx.note('原诺兰与同一新记录纸', l.note.writings.at(-1)! + '原纸由哈伦当面递出，本人实际书写持有；旧WF5-NOTE-1与原旗不动。' + (l.link.state === 'LINKED' ? 'LINKED仅是本次有限联系，可随时撤回或释放，没有自动诅咒。' : '当前没有施加中的新联系。'));
  }
  r.status = complete(c.caseId, r) ? 'EXAMINED' : 'OBSERVED';
  ctx.note('本次费用与收束', `已经实际消耗1行动/${attempt.spiritualityCost}灵性，知识${method === 'ABILITY' ? 18 : 10}${passed ? '成功' : '失败'}；失败不退款。先0行动实际收束，不能跳过返程、还原或原纸交付。`);
}
function reportText(s: SliceState, id: PuppetCaseId): string {
  const r = s.puppet.life.cases[id];
  if (id === 'moving-token') return r.method === 'ABILITY' ? '同一原木片真正受能力移动，本人再普通走四米取回并亲手交还；物权未变。' : '本人携同一原木片实际普通走两米去、两米回并交还，没有能力移动。';
  if (id === 'chosen-form') return r.method === 'ABILITY' ? '同一个原身体分别实际成为WOOD与PAPER，两次都完成原路去回并还原HUMAN，累计八米；没有分身或新装备。' : '普通站姿与非魔法展示核对完成，没有假称WOOD/PAPER变形。';
  return r.method === 'ABILITY' ? '原诺兰这一次有限联系真实建立后实际释放，同一原纸已交回。没有测试伤害传递、命令或强迫意志，不能将掌握理解为保证。' : '普通讨论记录了原诺兰本人的范围与退出权，同一原纸已交回，没有隐蔽联系或施法。';
}

export function puppetLifeActions(s: SliceState): PuppetLifeAction[] {
  if (!active(s)) return [];
  const out: PuppetLifeAction[] = [], l = s.puppet.life;
  const add = (id: string, label: string, cost: string, command: PuppetActivityCommand) => { const reason = puppetActivityReason(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (l.moon.pendingId !== null) {
    add('puppet-moon-guarded', '请原哈伦守望并实际等待六小时G', '0行动 · 至多8精神 · 只在贝克兰德 · 不治疗', { type: 'HANDLE_MOON', method: 'GUARDED' });
    add('puppet-moon-alone', '留在当前地点独自实际等待六小时G', '0行动 · 至多16精神 · 不治疗或成长', { type: 'HANDLE_MOON', method: 'ALONE' });
  }
  for (const p of CASES) {
    const r = l.cases[p.id], a = last(r);
    if (r.contactOpen) {
      if (p.id === 'moving-token' && !a?.returned) add(`${p.id}-return`, r.method === 'ABILITY' ? '本人走到FAR拾起同一木片并实际走回' : '携同一原木片沿两米原路走回', '0行动 · 0额外灵性 · 原路实际步行', { type: 'RETURN_ROUTE', caseId: p.id });
      if (p.id === 'chosen-form' && a?.form && a.success) {
        if (!a.returned) add(`${p.id}-return`, '同一变形身体实际走到PAD并沿原路返回', '0行动 · 0额外灵性 · 实际两米去、两米回', { type: 'RETURN_FORM_ROUTE', caseId: p.id });
        if (!a.restored) add(`${p.id}-restore`, '把同一原身体实际还原HUMAN', '0行动 · 0额外灵性 · 原衣物与伤势保留', { type: 'RESTORE_FORM', caseId: p.id });
      }
      if (p.id === 'reversible-link' && l.link.state === 'LINKED' && l.link.consented) add(`${p.id}-consent`, '听取诺兰本人撤回这次同意并立即释放', '0行动 · 不伤人或命令 · 仍须交还原纸', { type: 'WITHDRAW_CONSENT', caseId: p.id });
      add(`${p.id}-close`, p.id === 'moving-token' ? '亲手把同一原木片交回哈伦' : p.id === 'chosen-form' ? '在人形原门口实际结束本次实践' : '实际释放联系并亲手交回同一新原纸', '0行动 · 0额外灵性 · 已付收束 · 不退款', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '当面核对原人原物与这一次有限边界', '1行动 · 确认原主人许可或本人同意', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(`${p.id}-ability`, '准备这一次有限能力实践', '1行动 · 不施法 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备普通步行、观察或边界讨论', '1行动 · 不施法 · 实施0灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      if (p.id === 'chosen-form' && r.method === 'ABILITY') for (const form of ['WOOD', 'PAPER'] as const) add(`${p.id}-${form.toLowerCase()}`, `实际尝试自己的${form === 'WOOD' ? '神秘木偶WOOD' : '魔法纸人PAPER'}形态`, '1行动 · 3灵性 · 知识18 · 成功后实际去回和还原', { type: 'FORM_TRIAL', caseId: p.id, form });
      else add(`${p.id}-perform`, '实际实施本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识18 · 失败照付' : '1行动 · 0灵性 · 知识10 · 不冒称能力', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备与本次许可', '0行动 · 已付成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已经实际收束的有限结果', '1行动 · G扮演+25 · 同案仅一次', { type: 'REPORT', caseId: p.id });
  }
  if (!l.reflected) add('puppet-reflect', '回看原物、同一身体与可释放的联系', '1行动 · 三份报告后 · G扮演+25', { type: 'REFLECT' });
  return out;
}

export function projectPuppetLife(s: SliceState): PuppetLifeProjection {
  const l = s.puppet.life, pending = l.moon.notices.find(n => n.id === l.moon.pendingId);
  const moon: PuppetLifeProjection['moon'] = {
    title: '两场已公告的有限木偶G月相事件', pendingWeek: pending?.week ?? null,
    notices: l.moon.notices.map((n, index) => ({ id: n.id, week: n.week, title: `原工坊第${index + 1}场有限G月相事件`, status: l.moon.history.some(h => h.id === n.id) ? '已实际度过' : n.id === l.moon.pendingId ? '当前待实际等待六小时' : n.week <= s.week ? '原事件待当前现场收束后处理' : '未来原公告，不是循环日历' })),
    history: l.moon.history.map(h => `${h.id} 原公告W${h.announcedWeek}，实际W${h.week}${h.deferred ? '延后处理同一场' : ''}；${h.method === 'GUARDED' ? '原哈伦守望' : '留在原地独处'}，真实等待${h.waitedHours}小时G，精神实耗${h.mentalCost}；不吞魂、不叠加旧诅咒、不治疗。`),
    waitedHours: l.moon.waitedHours, rule: PUPPET_MOON_RULE,
  };
  if (!(s.progression.pathwayId==='chained'&&[4,3].includes(s.progression.sequence!))) return { cases: [], insideCase: false, environment: '', practice: null, moon };
  return {
    insideCase: hasPuppetLifeLock(s), environment: PUPPET_LIFE_ENVIRONMENT, moon,
    cases: CASES.map(p => {
      const r = l.cases[p.id];
      const result = complete(p.id, r) ? reportText(s, p.id) + (r.contactOpen ? '尚须实际收束。' : '本次已经实际收束。') : r.attempts.length ? `${r.attempts.length}次真实付费尝试已保留；${p.id === 'chosen-form' ? `WOOD${l.body.checked.WOOD ? '已成功' : '未成功'}、PAPER${l.body.checked.PAPER ? '已成功' : '未成功'}。` : '尚无可报告成功。'}${r.contactOpen ? '先完成0行动真实收束。' : '失败项目下一真实周才能重试；未试的另一形态可另行准备。'}` : r.withdrawals ? '已取消未实施的准备，观察与费用保留。' : null;
      return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '实际接触尚未收束，须返回、还原或交还原物' : '没有尚待结束的本次接触', closes: r.closes };
    }),
    practice: {
      token: `同一${l.token.id}始终属于原哈伦；位置${l.token.position}，本人在${l.token.playerNode}；本次${l.token.permission ? '有原主人有限许可' : '没有继续使用许可'}，实际交回${l.token.handovers}次。`,
      body: `只有本人同一原身体SELF，当前${l.body.form}，位于原DOOR；原衣物随身，无第二具身体、新装备或缩小。真实还原${l.body.restorations}次。`,
      formState: l.body.form, forms: `WOOD${l.body.checked.WOOD ? '真实成功' : '尚未成功'}；PAPER${l.body.checked.PAPER ? '真实成功' : '尚未成功'}；两种成功且真实收束才可报告能力结果。`,
      link: `同一原成年诺兰NOLAN：${l.link.state}；实际释放${l.link.releases}次。只试有限建立与释放，未测试伤害传递或强制意志，没有自动诅咒。`,
      linkState: l.link.state, consent: `${l.link.consented ? '诺兰本次有限同意仍在，可以撤回' : '当前没有继续实践的同意'}；本人实际撤回${l.link.consentWithdrawals}次。`,
      note: `同一${l.note.id}由${l.note.holder === 'GUIDE' ? '哈伦' : '本人'}实际持有，书写${l.note.writings.length}次、亲手交回${l.note.handovers}次；失败文字保留，旧WF5原纸原旗不动。`,
      route: `原木片路线本人实际走${l.token.distanceMetres}米；自身形态DOOR–PAD两米去回累计${l.body.distanceMetres}米，当前${l.body.route}；接触原诺兰实际一米去、一米回累计${l.link.contactDistanceMetres}米。`,
      history: [...PUPPET_CASE_IDS.flatMap(id => l.cases[id].attempts.map(a => `${id} W${a.week} ${a.method}${a.form ? `/${a.form}` : ''}：实付${a.actionCost}行动/${a.spiritualityCost}灵性，${a.success ? '成功' : '失败'}；${a.returned ? '真实返程已完成或无需返程' : '尚待真实返程'}，${a.restored ? '当前已还原或未变形' : '尚待真实还原'}${a.consentWithdrawn ? '，本人已撤回同意' : ''}。`)), ...l.note.writings, '旧囚犯、疯子、狼人、活尸、怨魂的原人物、原物、身体与月相历史全部保留；木偶新G事件不重开旧案，也不赋予莎伦个人物品的豁免。'],
    },
  };
}

/** A small finite scene: validate actual paid attempts, original objects and explicit physical exits. */
export function validatePuppetLife(s: SliceState): boolean {
  try {
    const l = s.puppet.life, start = s.puppet.promotionWeek;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'token', 'body', 'link', 'note', 'moon']) || !record(l.cases) || !shape(l.cases, PUPPET_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (start === null) return stableStringify(l) === stableStringify(createPuppetLifeState());
    if (!integer(start, 1, s.week)) return false;
    let open = 0, prepared = 0, resolved = 0;
    for (const [index, id] of PUPPET_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || ![r.preparations, r.withdrawals, r.closes].every(x => integer(x)) || !Array.isArray(r.attempts)) return false;
      let prev = start - 1;
      const forms = new Set<string>();
      for (const [n, a] of r.attempts.entries()) {
        if (!record(a) || !shape(a, ['week', 'method', 'form', 'success', 'actionCost', 'spiritualityCost', 'returned', 'restored', 'consentWithdrawn']) || !integer(a.week, start, s.week) || a.week < prev || !['ABILITY', 'ORDINARY'].includes(a.method) || ![null, 'WOOD', 'PAPER'].includes(a.form) || ![a.success, a.returned, a.restored, a.consentWithdrawn].every(x => typeof x === 'boolean') || a.actionCost !== 1 || a.spiritualityCost !== (a.method === 'ABILITY' ? 3 : 0)) return false;
        if ((a.form !== null) !== (id === 'chosen-form' && a.method === 'ABILITY') || a.form !== null && forms.has(a.form)) return false;
        const earlier = r.attempts.slice(0, n);
        if (earlier.some(x => x.success && (id !== 'chosen-form' || x.method === 'ORDINARY')) || earlier.some(x => x.week === a.week && (id !== 'chosen-form' || x.form === a.form || a.form === null))) return false;
        if (a.form && a.success) forms.add(a.form);
        if (a.consentWithdrawn && (id !== 'reversible-link' || a.method !== 'ABILITY' || !a.success)) return false;
        if (!a.returned && !(id === 'moving-token' && (a.method === 'ORDINARY' || a.success) || id === 'chosen-form' && a.form !== null && a.success)) return false;
        if (!a.restored && !(id === 'chosen-form' && a.form !== null && a.success)) return false;
        if ((!a.returned || !a.restored) && (!r.contactOpen || n !== r.attempts.length - 1) || a.form && a.success && a.restored && !a.returned) return false;
        prev = a.week;
      }
      const a = last(r), ready = r.status === 'PREPARED';
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(ready)) return false;
      if (r.contactOpen && (!a || a.week !== s.week || ready || r.status === 'RESOLVED' || r.method !== a.method)) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') !== complete(id, r)) return false;
      if ((ready || r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method === null || !r.contactOpen && ['AVAILABLE', 'OBSERVED'].includes(r.status) && r.method !== null) return false;
      if ((r.status === 'EXAMINED' || r.status === 'RESOLVED') && r.method !== a?.method) return false;
      if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (index > 0 && r.status !== 'AVAILABLE' && l.cases[PUPPET_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === source(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(ready); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const token = l.token, body = l.body, link = l.link, note = l.note;
    const tr = l.cases['moving-token'], fr = l.cases['chosen-form'], lr = l.cases['reversible-link'];
    const ta = last(tr), fa = last(fr), la = last(lr);
    if (!record(token) || !shape(token, ['id', 'owner', 'permission', 'position', 'playerNode', 'distanceMetres', 'handovers']) || token.id !== 'PU4-TOKEN-1' || token.owner !== 'HARLAN' || typeof token.permission !== 'boolean' || token.handovers !== tr.closes) return false;
    const tokenPosition = tr.contactOpen ? ta!.method === 'ORDINARY' || ta!.success && ta!.returned ? 'PLAYER' : ta!.success ? 'FAR' : 'NEAR' : tr.attempts.length ? 'GUIDE' : 'NEAR';
    if (token.position !== tokenPosition || token.playerNode !== (tr.contactOpen && ta!.method === 'ORDINARY' && !ta!.returned ? 'FAR' : 'NEAR')) return false;
    if (token.distanceMetres !== tr.attempts.reduce((n, a) => n + (a.method === 'ORDINARY' ? a.returned ? 4 : 2 : a.success && a.returned ? 4 : 0), 0)) return false;
    if ((tr.contactOpen || tr.status === 'PREPARED') && !token.permission || !tr.contactOpen && tr.attempts.length > 0 && tr.status !== 'PREPARED' && token.permission || tr.status === 'AVAILABLE' && token.permission) return false;
    if (!record(body) || !shape(body, ['owner', 'form', 'node', 'route', 'checked', 'distanceMetres', 'restorations']) || body.owner !== 'SELF' || body.node !== 'DOOR' || !record(body.checked) || !shape(body.checked, ['WOOD', 'PAPER'])) return false;
    if (body.form !== (fr.contactOpen && fa?.form && fa.success && !fa.restored ? fa.form : 'HUMAN')) return false;
    if (body.route !== (fa?.form && fa.success ? fa.returned ? 'RETURNED' : 'WAITING' : 'UNTRIED')) return false;
    for (const form of ['WOOD', 'PAPER'] as const) if (body.checked[form] !== fr.attempts.some(a => a.form === form && a.success)) return false;
    if (body.distanceMetres !== fr.attempts.filter(a => a.form && a.success && a.returned).length * 4 || body.restorations !== fr.attempts.filter(a => a.form && a.success && a.restored).length) return false;
    if (!record(link) || !shape(link, ['subjectId', 'consented', 'state', 'contactDistanceMetres', 'consentWithdrawals', 'releases']) || link.subjectId !== 'NOLAN' || typeof link.consented !== 'boolean') return false;
    const expectedLink = la?.method === 'ABILITY' && la.success ? lr.contactOpen && !la.consentWithdrawn ? 'LINKED' : 'RELEASED' : 'NONE';
    if (link.state !== expectedLink || link.contactDistanceMetres !== lr.attempts.filter(a => a.method === 'ABILITY').length * 2 || link.consentWithdrawals !== lr.attempts.filter(a => a.consentWithdrawn).length || link.releases !== lr.attempts.filter(a => a.method === 'ABILITY' && a.success).length - Number(link.state === 'LINKED')) return false;
    if (lr.contactOpen && link.consented !== !la?.consentWithdrawn || lr.status === 'PREPARED' && !link.consented || !lr.contactOpen && lr.attempts.length > 0 && lr.status !== 'PREPARED' && link.consented || lr.status === 'AVAILABLE' && link.consented) return false;
    if (!record(note) || !shape(note, ['id', 'holder', 'writings', 'handovers']) || note.id !== 'PU4-NOTE-1' || note.holder !== (lr.contactOpen ? 'PLAYER' : 'GUIDE') || !Array.isArray(note.writings) || note.writings.length !== lr.attempts.length || note.writings.some(x => typeof x !== 'string' || !x.includes('PU4-NOTE-1') || !x.includes('没有测试伤害')) || note.handovers !== lr.closes) return false;
    if (s.seer.completedSources.filter(x => x === 'puppet-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3 || (active(s)||s.progression.pathwayId==='chained'&&s.progression.sequence===3) && (s.progression.sequence===3?s.silentDisciple.puppetActingAtPromotion:s.progression.acting) !== resolved * 25 + Number(l.reflected) * 25) return false;
    const moon = l.moon;
    if (!record(moon) || !shape(moon, ['notices', 'pendingId', 'history', 'waitedHours']) || !Array.isArray(moon.notices) || moon.notices.length !== 2 || !Array.isArray(moon.history) || moon.history.length > 2) return false;
    for (const [index, n] of moon.notices.entries()) if (!record(n) || !shape(n, ['id', 'week']) || n.id !== `PU4-MOON-${index + 1}` || n.week !== start + (index === 0 ? 3 : 8)) return false;
    let handledWeek = start;
    for (const [index, h] of moon.history.entries()) {
      const n = moon.notices[index]!;
      if (!record(h) || !shape(h, ['id', 'announcedWeek', 'week', 'method', 'mentalCost', 'waitedHours', 'deferred']) || h.id !== n.id || h.announcedWeek !== n.week || !integer(h.week, Math.max(n.week, handledWeek), s.week) || !['GUARDED', 'ALONE'].includes(h.method) || !integer(h.mentalCost, 0, h.method === 'GUARDED' ? 8 : 16) || h.waitedHours !== 6 || h.deferred !== (h.week > n.week)) return false;
      handledWeek = h.week;
    }
    if (moon.waitedHours !== moon.history.length * 6) return false;
    if (moon.pendingId !== null) {
      const next = moon.notices[moon.history.length];
      if (!active(s) || !next || moon.pendingId !== next.id || next.week > s.week || physicalOpen(s) || oldOpen(s) || s.activeEvent || s.combat || s.status !== 'ACTIVE' || s.health <= 0) return false;
    }
    if (physicalOpen(s) && (!active(s) || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat || moon.pendingId !== null)) return false;
    return true;
  } catch { return false; }
}
