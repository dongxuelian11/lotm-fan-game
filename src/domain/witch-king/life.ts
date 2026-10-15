import type { SliceState } from '../slice/types.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';

export const WITCH_KING_CASE_IDS = ['paper-trial', 'arrow-target', 'moon-return'] as const;
export type WitchKingCaseId = typeof WITCH_KING_CASE_IDS[number];
export type WitchKingActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'STOP_EFFECT' | 'INSPECT'; caseId: WitchKingCaseId }
  | { type: 'PREPARE'; caseId: WitchKingCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PREPARE_PAPER'; paperId: string }
  | { type: 'RETURN'; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'BUY_PAPERS' }
  | { type: 'REFLECT' };
export interface WitchKingPaper {
  id: string; batch: number; source: string; purchasedWeek: number; status: 'HELD' | 'PREPARED' | 'CONSUMED';
  preparedWeek: number | null; consumedWeek: number | null; consumedBy: 'PAPER_TRIAL' | 'COMBAT' | null; combatRound: number | null;
}
export interface WitchKingCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED'; observedWeek: number | null;
  attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  contactOpen: boolean; effectActive: boolean; inspected: boolean; closes: number; withdrawals: number; paperId: string | null;
}
export interface WitchKingLifeState {
  cases: Record<WitchKingCaseId, WitchKingCaseState>; papers: WitchKingPaper[]; paperPurchases: number;
  target: { id: 'WK4-TARGET'; source: 'ORIGINAL_CLAY_TARGET'; status: 'INTACT' | 'MARKED' | 'BROKEN'; backstopId: 'WK4-BACKSTOP'; misses: number };
  instructor: { id: 'WK4-IRMA'; name: '伊尔玛'; age: 35; alive: boolean; willing: boolean; location: 'WK4-YARD' };
  padId: 'WK4-PAD'; yardId: 'WK4-YARD';
  practice: { field: 'NONE' | 'MOON'; location: 'START' | 'END'; outboundTrips: number; returns: number; returnAttempted: boolean;
    folio: { id: 'WK4-FOLIO'; owner: 'PLAYER'; location: 'START' | 'END' } };
  reflected: boolean;
}
export interface WitchKingLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WitchKingActivityCommand }
export interface WitchKingLifeProjection {
  title: string; story: string; cases: { id: WitchKingCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; observations: string[] }[];
  papers: WitchKingPaper[]; paperPurchases: number; target: WitchKingLifeState['target']; instructor: WitchKingLifeState['instructor'];
  practice: WitchKingLifeState['practice']; reflected: boolean; inside: boolean; actions: WitchKingLifeAction[];
}
export const WITCH_KING_PAPER_SOURCE = '原创G：艾琳持照商店出售的三张预裁虚构月光纸，每批60便士；不是原著完整配方或真实仪式教程';
export const WITCH_KING_LIFE_STORY = '观察、准备、实施、报告各1行动。三案各扮演25，反思25；成功能力实测掌握5、报告掌握8，普通对照不授能力掌握。纸人须购买真实原纸、明确选一张准备，使用即耗；有限纸影不是复制生命、永久无敌或复活。所有成本、距离、难度及场景均为原创G。';
const CASES = [
  { id: 'paper-trial', title: '原纸与一次软垫轻触', story: '35岁成年持照训练员伊尔玛（WK4-IRMA）自愿留在原练习院WK4-YARD，以同一个软垫WK4-PAD作一次限位轻触。她会在安全线内等你明确开始，也允许随时停止。能力失败仅健康−2（G），不要求故意受伤；也可选择普通侧步。', facts: ['购买1行动、60便士，得到三张不同原纸；每真实周最多一批，仍持有原纸时不能再购。', '准备一张需3灵性；本案已付PREPARE内为0行动，平时另1行动。实施知识16；普通侧步知识14，0灵性。'] },
  { id: 'arrow-target', title: '同一个泥靶与石质挡板', story: '原院唯一泥靶WK4-TARGET置于惰性石挡板WK4-BACKSTOP前，路径无人。血月之箭只试着击中这个有限目标；成功原靶破裂，失败落在原挡板，不生成新靶。普通方法亲手用现有标记工具留下检查记号。', facts: ['血月之箭4灵性、感知16；失败成本照耗、效果0。', '停止效果后检查同一原靶再结束；报告后不能重置原靶刷取成长。'] },
  { id: 'moon-return', title: '带着同一本练习册走完六米', story: '同一原院内START与END相隔已核实净空的6米。你始终携带自己的原练习册WK4-FOLIO。继承月光化在同一有限月场中去程再返程；普通方法也要实际走到END并回来。不能用关闭按钮搬回身体。', facts: ['能力去程：月场3灵性加位移2灵性，知识16；返回可选2灵性知识16或0灵性普通原路步行。', '返回身体和原册后再停止月场、检查并结束；0行动返程已含在实施预算内，灵性不足也不会困住。'] },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && [4,3,2].includes(s.progression.sequence??0);
const freshCase = (): WitchKingCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, effectActive: false, inspected: false, closes: 0, withdrawals: 0, paperId: null });
export function createWitchKingLifeState(): WitchKingLifeState {
  return { cases: { 'paper-trial': freshCase(), 'arrow-target': freshCase(), 'moon-return': freshCase() }, papers: [], paperPurchases: 0,
    target: { id: 'WK4-TARGET', source: 'ORIGINAL_CLAY_TARGET', status: 'INTACT', backstopId: 'WK4-BACKSTOP', misses: 0 },
    instructor: { id: 'WK4-IRMA', name: '伊尔玛', age: 35, alive: true, willing: true, location: 'WK4-YARD' }, padId: 'WK4-PAD', yardId: 'WK4-YARD',
    practice: { field: 'NONE', location: 'START', outboundTrips: 0, returns: 0, returnAttempted: false, folio: { id: 'WK4-FOLIO', owner: 'PLAYER', location: 'START' } }, reflected: false };
}
export const hasWitchKingLifeLock = (s: SliceState): boolean => Object.values(s.witchKing.life.cases).some(r => r.contactOpen) || s.witchKing.life.practice.location !== 'START' || s.witchKing.life.practice.field !== 'NONE';
export const witchKingInside = hasWitchKingLifeLock;
export const preparedWitchKingPaper = (s: SliceState): WitchKingPaper | null => s.witchKing.life.papers.find(p => p.status === 'PREPARED') ?? null;
export function consumeWitchKingPaper(s: SliceState, paper: WitchKingPaper, by: 'PAPER_TRIAL' | 'COMBAT', round: number | null): void {
  if (paper.status !== 'PREPARED' || !s.witchKing.life.papers.includes(paper) || paper.preparedWeek === null || paper.source !== WITCH_KING_PAPER_SOURCE || (by === 'COMBAT') !== (round !== null)) throw new Error('只能消耗实际准备且仍持有的同一原纸。');
  paper.status = 'CONSUMED'; paper.consumedWeek = s.week; paper.consumedBy = by; paper.combatRound = round;
}
export function validateWitchKingActivityCommand(v: unknown): v is WitchKingActivityCommand {
  if (!record(v)) return false;
  if (['BUY_PAPERS', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_PAPER') return shape(v, ['type', 'paperId']) && typeof v.paperId === 'string' && /^WK4-PAPER-[1-9]\d*-[123]$/.test(v.paperId);
  if (v.type === 'RETURN') return shape(v, ['type', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (!WITCH_KING_CASE_IDS.includes(v.caseId as WitchKingCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'STOP_EFFECT', 'INSPECT'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isWitchKingActivityCommand = validateWitchKingActivityCommand;
export const isWitchKingActivity = validateWitchKingActivityCommand;
const embeddedPaperPreparation = (s: SliceState) => s.witchKing.life.cases['paper-trial'].status === 'PREPARED' && s.witchKing.life.cases['paper-trial'].method === 'ABILITY';
export function blockWitchKingLife(s: SliceState, c: WitchKingActivityCommand): string | null {
  if (!validateWitchKingActivityCommand(c)) return '巫王实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着并已经成为月亮途径巫王。';
  if([3,2].includes(s.progression.sequence??0)&&!['BUY_PAPERS','PREPARE_PAPER'].includes(c.type))return '旧巫王实践保留；当前只维护实际原月纸。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原练习院。';
  if (['READY', 'FIGHTING'].includes(s.witchKing.encounter.status)) return '先和平离开或收束原院遭遇。';
  const l = s.witchKing.life, f = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'RETURN') return f.location !== 'END' || !l.cases['moon-return'].contactOpen ? '没有已到原END、尚待返回的本人和原册。' : c.method === 'ABILITY' && (f.field !== 'MOON' || f.returnAttempted || s.spirituality < 2 || s.health <= 0 || s.mind <= 0) ? '月光返程需要当前原月场、2灵性且本次未试；仍可0行动普通步行返回。' : null;
  if (c.type === 'STOP_EFFECT') return !r?.contactOpen ? '没有本项正在进行的原现场。' : c.caseId === 'moon-return' && f.location !== 'START' ? '先实际返回本人和同一本原册，不能关闭月场代替返程。' : !r.effectActive ? '本项效果已经停止；可以检查原物。' : null;
  if (c.type === 'INSPECT') return !r?.contactOpen || r.effectActive || f.location !== 'START' ? '先实际返回并停止本项效果，再检查原物。' : r.inspected ? '本次原物已经检查。' : null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.contactOpen) return !r?.contactOpen ? '没有本项尚未结束的原现场。' : r.effectActive || f.location !== 'START' || !r.inspected ? '先返回、停止效果并检查同一原物；结束不搬回身体或补充资源。' : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (hasWitchKingLifeLock(s)) return '先0行动实际返回、停止效果、检查原物并结束当前现场。';
  if (s.witchKing.ritual.playerLocation === 'HALL') return '先实际结束晋升仪式现场。';
  if (s.health <= 0 || s.mind <= 0) return '先休养身体与精神。';
  if (c.type === 'PREPARE_PAPER') {
    const p = l.papers.find(p => p.id === c.paperId);
    return !p || p.status !== 'HELD' ? '须明确选择一张实际购得且尚未准备或消耗的原纸。' : preparedWitchKingPaper(s) ? '最多准备一张原纸；已有原纸不复制、不自动更换。' : s.spirituality < 3 || !embeddedPaperPreparation(s) && s.actionsRemaining < 1 ? '准备原纸需要3灵性；本案已付准备外另需1行动。' : null;
  }
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'BUY_PAPERS') return l.papers.some(p => p.status !== 'CONSUMED') ? '仍持有原纸，先真实使用；不能另购免费或重复库存。' : l.papers.some(p => p.purchasedWeek === s.week) ? '本真实周已经购入一批，下一真实周才可再购。' : s.cash < 60 ? '三张原纸需要60便士。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '已经反思。' : WITCH_KING_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知原实践。';
  const index = WITCH_KING_CASE_IDS.indexOf(c.caseId);
  if (r.status === 'RESOLVED') return '本项已报告，不能重置原物或重复成长。';
  if (index > 0 && l.cases[WITCH_KING_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成前一项原实践报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场已经观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场。' : r.attemptWeek === s.week ? '本周实际尝试和成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.inspected && r.result !== 'NONE' ? null : '先完成真实结果、检查并结束现场。';
  if (r.status !== 'PREPARED' || r.attemptWeek === s.week) return '先准备本次实践，不能同周重复实施。';
  if (!l.instructor.alive || !l.instructor.willing || l.instructor.location !== 'WK4-YARD') return '原伊尔玛须仍活着、自愿且真实在原院；可以取消准备。';
  if (r.method === 'ABILITY') {
    if (c.caseId === 'paper-trial') return !preparedWitchKingPaper(s) ? '先明确准备一张实际持有的原纸；可以取消或改普通方法。' : s.health <= 2 ? '本次已公开健康−2的失败风险；先休养或改普通侧步。' : null;
    if (s.spirituality < (c.caseId === 'arrow-target' ? 4 : 5)) return `本次需要${c.caseId === 'arrow-target' ? 4 : 5}灵性；可0行动取消准备。`;
  }
  return null;
}
const succeeded = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
export function applyWitchKingActivity(s: SliceState, c: WitchKingActivityCommand, ctx: SeerContext): void {
  const reason = blockWitchKingLife(s, c); if (reason) throw new Error(reason);
  const l = s.witchKing.life, f = l.practice;
  if (c.type === 'PREPARE_PAPER') {
    const p = l.papers.find(p => p.id === c.paperId)!; const embedded = embeddedPaperPreparation(s);
    if (!embedded) s.actionsRemaining--; s.spirituality -= 3; p.status = 'PREPARED'; p.preparedWeek = s.week;
    ctx.note('明确准备这一张原纸', `${p.id}实耗3灵性，${embedded ? '在本案已付准备内，不再扣行动' : '另扣1行动'}。这次选择也授权以后战斗J槽使用同一原纸；不自动准备其它HELD纸。原纸仍只有一张，使用即消耗，不能保证免伤或复活。`); return;
  }
  if (c.type === 'RETURN') {
    f.returnAttempted = true;
    if (c.method === 'ABILITY') { s.spirituality -= 2; if (!succeeded(ctx.check('knowledge', 16).tier)) { ctx.note('月光返程失败', '2灵性照耗，本人和同一本原册仍在END，月场仍在；现在仍可0行动、0灵性沿原6米路普通步行返回。'); return; } }
    f.location = 'START'; f.folio.location = 'START'; f.returns++;
    ctx.note('本人和同一本原册实际回到START', `${c.method === 'ABILITY' ? '实耗2灵性，在当前原月场中有限月光化返程' : '0灵性，沿同一原6米净空路实际普通步行返回'}；0行动返程已含在实施预算中。身体没有复制、治愈或复活，接下来停止月场。`); return;
  }
  if (c.type === 'STOP_EFFECT') { l.cases[c.caseId].effectActive = false; if (c.caseId === 'moon-return') f.field = 'NONE'; ctx.note('实际停止本项效果', '0行动停止本次已付效果窗口；原纸消耗、泥靶状态、本人伤损及实际位移保留。没有永久纸影或月场。'); return; }
  if (c.type === 'INSPECT') { l.cases[c.caseId].inspected = true; ctx.note('检查同一原物', c.caseId === 'paper-trial' ? '原软垫仍由伊尔玛持有；用掉的同一原纸留有消耗记录，不回补。' : c.caseId === 'arrow-target' ? `同一个WK4-TARGET现在${l.target.status}，原挡板仍在，未更换目标。` : '本人和同一本WK4-FOLIO均已实际返回START，月场已停止。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && l.cases[c.caseId].contactOpen) {
    const r = l.cases[c.caseId]; r.contactOpen = false; r.closes++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED';
    ctx.note('实际结束本次原现场', '本人和原物均已核实；没有传送、免费补纸或治疗。失败成本保留，下一真实周才能准备重试。'); return;
  }
  if (c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.paperId = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '0行动取消；已经准备的原纸仍是同一PREPARED原纸，实付成本不退，不施法、不生成物品。'); return; }
  s.actionsRemaining--;
  if (c.type === 'BUY_PAPERS') { s.cash -= 60; const batch = ++l.paperPurchases; for (let n = 1; n <= 3; n++) l.papers.push({ id: `WK4-PAPER-${batch}-${n}`, batch, source: WITCH_KING_PAPER_SOURCE, purchasedWeek: s.week, status: 'HELD', preparedWeek: null, consumedWeek: null, consumedBy: null, combatRound: null }); ctx.note('购得三张不同原纸', `1行动、60便士已付，批次${batch}的三张预裁虚构原纸交到本人手中。尚未准备任何一张；消耗历史永久保留，没有每日自动补货。`); return; }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('witch-king-reflection'); ctx.note('有限力量也要有真实收束', '三案原物、有限纸影和六米去回均已收束。G扮演+25。长寿有自然限度，月光化不是无敌、复活或召唤大师的门。'); return; }
  const p = CASES.find(p => p.id === c.caseId)!, r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; r.paperId = null; r.inspected = false; ctx.note(p.title, c.method === 'ABILITY' ? '已付1行动选择有限能力实践；成本和失败风险已知，仍可0行动取消。纸案还须明确PREPARE_PAPER选一张原纸。' : '已付1行动选择普通真实对照；不会伪造能力成功或能力掌握。'); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `witch-king-case:${p.id}`; if (r.result === 'ABILITY') awardSeerMastery(s, source, 8, ctx); else s.seer.completedSources.push(source); ctx.note(p.title, '报告这一次已结束的真实结果，G扮演+25；' + (r.result === 'ABILITY' ? '真实能力报告在既有池单项掌握+8。' : '普通方法不授能力掌握。') + '不补纸、不修靶、不治伤。'); return; }
  r.status = 'ACTIVE'; r.attemptWeek = s.week; r.contactOpen = true; r.inspected = false; r.result = 'NONE'; r.paperId = null;
  if (c.caseId === 'paper-trial' && r.method === 'ABILITY') { const paper = preparedWitchKingPaper(s)!; r.paperId = paper.id; consumeWitchKingPaper(s, paper, 'PAPER_TRIAL', null); }
  if (c.caseId === 'arrow-target' && r.method === 'ABILITY') s.spirituality -= 4;
  if (c.caseId === 'moon-return') { f.returnAttempted = false; if (r.method === 'ABILITY') { s.spirituality -= 5; f.field = 'MOON'; } }
  r.effectActive = r.method === 'ABILITY';
  const ok = succeeded(ctx.check(c.caseId === 'arrow-target' && r.method === 'ABILITY' ? 'perception' : 'knowledge', r.method === 'ABILITY' ? 16 : 14).tier);
  r.effectActive = r.method === 'ABILITY' && (ok || c.caseId === 'moon-return');
  if (c.caseId === 'moon-return' && (ok || r.method === 'ORDINARY')) { f.location = 'END'; f.folio.location = 'END'; f.outboundTrips++; }
  if (c.caseId === 'arrow-target') { if (ok) l.target.status = r.method === 'ABILITY' ? 'BROKEN' : 'MARKED'; else if (r.method === 'ABILITY') l.target.misses++; }
  if (c.caseId === 'paper-trial' && r.method === 'ABILITY' && !ok) s.health -= 2;
  if (ok) { r.result = r.method!; if (r.method === 'ABILITY') awardSeerMastery(s, `witch-king-practice:${p.id}`, 5, ctx); }
  ctx.note(p.title, (ok ? c.caseId === 'paper-trial' ? r.method === 'ABILITY' ? `同一${r.paperId}实际消耗，短暂纸影代受原软垫轻触，本人这次避开标记。` : '本人实际普通侧步避开这一次轻触。' : c.caseId === 'arrow-target' ? r.method === 'ABILITY' ? '血月之箭实际击中同一泥靶，原靶BROKEN。' : '亲手以原普通工具标记同一泥靶，原靶MARKED。' : '本人和同一本原册已经实际到达原END。' : '本次检验失败，已付行动及灵性不退，能力效果0。' + (c.caseId === 'paper-trial' && r.method === 'ABILITY' ? `同一${r.paperId}仍已消耗，未替下软垫接触，健康−2（G）。` : c.caseId === 'arrow-target' && r.method === 'ABILITY' ? '箭落在原石挡板，原靶仍INTACT。' : c.caseId === 'moon-return' ? r.method === 'ABILITY' ? '本人和原册仍在START，原月场仍须停止。' : '普通去程已发生，本人和原册仍在END。' : '本次普通对照未形成充分结果。')) + '实际返回（如需要）、停止效果、检查并结束；失败下一真实周重试。');
}
export function witchKingLifeActions(s: SliceState): WitchKingLifeAction[] {
  if (!promoted(s)) return [];
  const out: WitchKingLifeAction[] = [], l = s.witchKing.life;
  const add = (id: string, label: string, cost: string, command: WitchKingActivityCommand) => { const reason = blockWitchKingLife(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('witch-king-buy-papers', '购买三张不同原月光纸', '1行动 · 60便士 · 每真实周至多一批 · 持有原纸时不能再购', { type: 'BUY_PAPERS' });
  for (const p of l.papers.filter(p => p.status === 'HELD')) add(`prepare-${p.id}`, `明确准备原纸 ${p.id}`, `${embeddedPaperPreparation(s) ? '0' : '1'}行动 · 3灵性 · 最多准备一张 · 授权后续战斗J使用此原纸`, { type: 'PREPARE_PAPER', paperId: p.id });
  if (s.progression.sequence !== 4) return out;
  for (const p of CASES) {
    const r = l.cases[p.id];
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '观察原现场与安全退出', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(`${p.id}-${method}`, method === 'ABILITY' ? '准备有限能力实践' : '准备普通真实对照', '1行动 · 能力另付实物与灵性 · 可0行动取消', { type: 'PREPARE', caseId: p.id, method });
    if (r.status === 'PREPARED') { add(`${p.id}-perform`, '实际实施这一次实践', `1行动 · ${r.method === 'ORDINARY' ? '0灵性 · 知识14' : p.id === 'paper-trial' ? '消耗所选PREPARED原纸 · 知识16 · 失败健康−2' : p.id === 'arrow-target' ? '4灵性 · 感知16 · 失败照耗' : '5灵性 · 知识16 · 返程另2灵性或普通0灵性'}`, { type: 'PERFORM', caseId: p.id }); add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.contactOpen) { if (r.effectActive) add(`${p.id}-stop`, '实际停止本项效果', '0行动 · 不移动身体', { type: 'STOP_EFFECT', caseId: p.id }); add(`${p.id}-inspect`, '检查同一原物与本人位置', '0行动 · 先返回并停止效果', { type: 'INSPECT', caseId: p.id }); add(`${p.id}-close`, '实际结束本次原现场', '0行动 · 先检查 · 不退款、不补纸', { type: 'CLOSE', caseId: p.id }); }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告这一次真实结果', '1行动 · 扮演25 · 普通方法无能力掌握', { type: 'REPORT', caseId: p.id });
  }
  if (l.practice.location === 'END') { add('moon-return-walk', '本人携原册沿六米原路普通返回', '0行动 · 0灵性 · 实施已含返程预算', { type: 'RETURN', method: 'ORDINARY' }); add('moon-return-ability', '本人携原册月光化返回', '0行动 · 2灵性 · 知识16 · 失败仍可普通返回', { type: 'RETURN', method: 'ABILITY' }); }
  if (!l.reflected) add('witch-king-reflect', '回看原纸、原靶与真实往返', '1行动 · 三报告后扮演25', { type: 'REFLECT' });
  return out;
}
export function projectWitchKingLife(s: SliceState): WitchKingLifeProjection {
  const l = s.witchKing.life;
  return { title: '巫王的有限原物实践', story: WITCH_KING_LIFE_STORY, cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, result: r.attemptWeek === null ? null : `实际尝试第${r.attemptWeek}周；${r.result === 'NONE' ? '未取得充分结果，成本保留' : r.result === 'ABILITY' ? '能力实测成功' : '普通真实对照'}${r.paperId ? `；原纸${r.paperId}已消耗` : ''}。`, contactOpen: r.contactOpen, observations: r.observedWeek === null ? [] : [...p.facts] }; }), papers: l.papers.map(p => ({ ...p })), paperPurchases: l.paperPurchases, target: { ...l.target }, instructor: { ...l.instructor }, practice: { ...l.practice, folio: { ...l.practice.folio } }, reflected: l.reflected, inside: hasWitchKingLifeLock(s), actions: witchKingLifeActions(s) };
}
export function validateWitchKingLife(s: SliceState): boolean {
  const l = s.witchKing?.life, initial = createWitchKingLifeState(), promotion = s.witchKing?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, WITCH_KING_CASE_IDS) || !Array.isArray(l.papers) || !integer(l.paperPurchases) || l.papers.length !== l.paperPurchases * 3 || !record(l.target) || !shape(l.target, Object.keys(initial.target)) || !record(l.instructor) || !shape(l.instructor, Object.keys(initial.instructor)) || !record(l.practice) || !shape(l.practice, Object.keys(initial.practice)) || !record(l.practice.folio)) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.yardId !== 'WK4-YARD' || l.padId !== 'WK4-PAD' || l.instructor.id !== 'WK4-IRMA' || l.instructor.name !== '伊尔玛' || l.instructor.age !== 35 || l.instructor.location !== 'WK4-YARD' || typeof l.instructor.alive !== 'boolean' || typeof l.instructor.willing !== 'boolean') return false;
  const f = l.practice, target = l.target;
  if (!shape(f.folio, ['id', 'owner', 'location']) || f.folio.id !== 'WK4-FOLIO' || f.folio.owner !== 'PLAYER' || f.folio.location !== f.location || !['START', 'END'].includes(f.location) || !['NONE', 'MOON'].includes(f.field) || !integer(f.outboundTrips) || !integer(f.returns, 0, f.outboundTrips) || f.returns !== f.outboundTrips - (f.location === 'END' ? 1 : 0) || typeof f.returnAttempted !== 'boolean' || target.id !== 'WK4-TARGET' || target.source !== 'ORIGINAL_CLAY_TARGET' || target.backstopId !== 'WK4-BACKSTOP' || !['INTACT', 'MARKED', 'BROKEN'].includes(target.status) || !integer(target.misses)) return false;
  const paperShape = ['id', 'batch', 'source', 'purchasedWeek', 'status', 'preparedWeek', 'consumedWeek', 'consumedBy', 'combatRound'];
  let previousPurchase = 0;
  for (let i = 0; i < l.papers.length; i++) {
    const p = l.papers[i]!, batch = Math.floor(i / 3) + 1;
    if (!record(p) || !shape(p, paperShape) || p.id !== `WK4-PAPER-${batch}-${i % 3 + 1}` || p.batch !== batch || p.source !== WITCH_KING_PAPER_SOURCE || !integer(p.purchasedWeek, promotion, s.week) || !['HELD', 'PREPARED', 'CONSUMED'].includes(p.status)) return false;
    if (i % 3 === 0) { if (p.purchasedWeek <= previousPurchase || l.papers.slice(0, i).some(old => old.status !== 'CONSUMED' || old.consumedWeek! > p.purchasedWeek)) return false; previousPurchase = p.purchasedWeek; } else if (p.purchasedWeek !== previousPurchase) return false;
    if (p.status === 'HELD') { if (p.preparedWeek !== null || p.consumedWeek !== null || p.consumedBy !== null || p.combatRound !== null) return false; }
    else if (!integer(p.preparedWeek, p.purchasedWeek, s.week)) return false;
    if (p.status === 'PREPARED' && (p.consumedWeek !== null || p.consumedBy !== null || p.combatRound !== null)) return false;
    if (p.status === 'CONSUMED' && (!integer(p.consumedWeek, p.preparedWeek!, s.week) || !['PAPER_TRIAL', 'COMBAT'].includes(String(p.consumedBy)) || (p.consumedBy === 'COMBAT' ? !integer(p.combatRound, 1) || !s.combatHistory.some(r => r.round === p.combatRound && (r.witchKingOutcome?.papersConsumed.includes(p.id)||r.summoningMasterOutcome?.papersConsumed.includes(p.id)||(r.lifeGiverOutcome?.targetId==='LG2-ADRIAN-VALE'&&r.lifeGiverOutcome.source.encounterId==='LIFE_GIVER_DISPUTE'&&r.lifeGiverOutcome.source.week===p.consumedWeek&&r.lifeGiverOutcome.source.attemptWeek===p.consumedWeek&&r.lifeGiverOutcome.papersConsumed.includes(p.id)&&r.lifeGiverOutcome.playerActions.some(a=>a.paperId===p.id&&a.paidCost===3)))) : p.combatRound !== null))) return false;
  }
  if (l.papers.filter(p => p.status === 'PREPARED').length > 1) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of WITCH_KING_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || !integer(r.closes) || !integer(r.withdrawals) || typeof r.contactOpen !== 'boolean' || typeof r.effectActive !== 'boolean' || typeof r.inspected !== 'boolean') return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || r.attemptWeek !== null && !integer(r.attemptWeek, r.observedWeek, s.week) || index > 0 && l.cases[WITCH_KING_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.attemptWeek === s.week || r.contactOpen) return false; }
    if (r.contactOpen) { open++; if (r.status !== 'ACTIVE' || r.attemptWeek !== s.week || r.method === null || s.activeEvent || s.combat || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (r.effectActive && (!r.contactOpen || r.method !== 'ABILITY')) return false;
    if (r.status === 'ACTIVE' && !r.contactOpen || r.attemptWeek === null && (r.closes > 0 || r.inspected || r.result !== 'NONE' || r.paperId !== null)) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.contactOpen || r.effectActive || !r.inspected || r.result === 'NONE' || r.result !== r.method || r.closes < 1)) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(x => x === `witch-king-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0) || s.seer.completedSources.filter(x => x === `witch-king-practice:${id}`).length !== (r.result === 'ABILITY' ? 1 : 0)) return false;
    if (r.paperId !== null && (id !== 'paper-trial' || r.method !== 'ABILITY' || !l.papers.some(p => p.id === r.paperId && p.consumedBy === 'PAPER_TRIAL' && p.consumedWeek === r.attemptWeek))) return false;
    if (id === 'paper-trial' && r.attemptWeek !== null && r.method === 'ABILITY' && r.paperId === null && r.status !== 'PREPARED') return false;
  }
  const route = l.cases['moon-return'], arrow = l.cases['arrow-target'];
  if (open > 1 || prepared > 1 || open && prepared || f.field !== (route.effectActive ? 'MOON' : 'NONE') || f.location === 'END' && !route.contactOpen || f.outboundTrips > route.closes + (route.contactOpen ? 1 : 0) || ['EXAMINED', 'RESOLVED'].includes(route.status) && f.outboundTrips < 1) return false;
  if (target.status !== (arrow.result === 'ABILITY' ? 'BROKEN' : arrow.result === 'ORDINARY' ? 'MARKED' : 'INTACT') || target.misses > arrow.closes + (arrow.contactOpen ? 1 : 0)) return false;
  if (l.papers.filter(p => p.consumedBy === 'PAPER_TRIAL').length > l.cases['paper-trial'].closes + (l.cases['paper-trial'].contactOpen ? 1 : 0)) return false;
  return typeof l.reflected === 'boolean' && (!l.reflected || resolved === 3) && s.seer.completedSources.filter(x => x === 'witch-king-reflection').length === (l.reflected ? 1 : 0) && (!promoted(s) || ([3,2].includes(s.progression.sequence??0)?s.summoningMaster.witchKingActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0));
}
