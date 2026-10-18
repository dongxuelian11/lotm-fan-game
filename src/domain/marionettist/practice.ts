import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyMarionettistEncounter, blockMarionettistEncounter, MARIONETTIST_ENCOUNTER_STORY } from './encounter.js';
import { applyMarionettistPuppetCommand, hasMarionettistOpenCapture, isMarionettistPuppetCommand, marionettistPuppetActions, validateMarionettistPuppetCommand } from './puppet.js';
import { MARIONETTIST_CASE_IDS, type MarionettistActivityCommand, type MarionettistAction, type MarionettistProjection, type MarionettistCaseId } from './types.js';

const CASES = [
  { id: 'living-lines', title: '同一成人与无生命木偶的对照',
    story: '贝克兰德原排练室里，曾亲自同意示范的成年演员阿伦·贝尔再次明确自愿，在原位置与你相距3米。原台上同时摆着一只普通无生命木偶M5-WOOD-1；它只是排练道具，不是人，也不是秘偶。本次只有限感知，不控制阿伦。',
    facts: ['只对眼前自愿成年阿伦与原普通木偶作对照。生灵有真实灵体之线，无生命木偶没有。', '100米只是新晋有限感知参考范围，不读取幕后人物、想法、秘密或不可知目标。'],
    preparation: '核对阿伦本人同意，固定原普通木偶与站位；尚未用能力。实践时才花1行动与3灵性感知，失败照付。',
    result: '你真实观察到阿伦的灵体之线，同时确认原普通木偶没有灵体之线；记录只限原现场两个已知对象，不产生秘偶或后台知识。', outcome: 'LINES_RECORDED' },
  { id: 'controlled-release', title: '五米内短暂初控并主动放开',
    story: '成年搬运工乔纳·里德在同一原排练室内自愿参与，与你相距3米，范围始终小于新晋5米起控参考。双方只约定本作G约20秒有限初控及实际释放，绝不推进约5分钟完整转化；原人始终存活。',
    facts: ['PREPARE只核对本人同意与稳定站位，PERFORM才开始真实接触。', '初控成功会使思维、动作变慢，你的专注也限制自身动作；个体抗性可使尝试失败。必须0行动CLOSE或WITHDRAW实际释放后才可报告。'],
    preparation: '与乔纳确认短时初控、即时停止与实际释放安排；现在不施术。实践另付1行动、3灵性，失败照付。',
    result: '短时初控已真实发生，又由你主动停止操纵、实际释放，乔纳本人恢复自主活动。没有完整转化、死亡或新秘偶。', outcome: 'RELEASE_RECORDED' },
  { id: 'break-contact', title: '约定打断后的自主行动复核',
    story: '同一排练室里，成年乔纳再次自愿接受仅限短时的初控。成年阿伦在原位置事先同意适时拍你的肩并叫停，打断你正在维持的专注。成功实践必须实际经历初控、阿伦打断、目标恢复，然后亲眼核实乔纳自主抬手并离开原站位。',
    facts: ['两位成年人都提前同意，原现场无第三目标，不通过伤害他人模拟死亡或完整转化。', '本次约定的真实干扰适合中断短时初控；不能推成所有伤害必解除，也不赋予心智免疫或高阶能力。'],
    preparation: '三人当面确认短时初控与真实拍肩叫停，阿伦仍在原位，乔纳自由站定；尚无能力接触。实践另付1行动、3灵性。',
    result: '阿伦在本次真实初控中按约拍肩叫停，专注实际中断；乔纳恢复，并由本人自主抬手、走离原站位，已亲眼核实。全部仍为原成年人，没有任何秘偶。', outcome: 'INTERRUPTION_RECORDED' },
] as const;
export const MARIONETTIST_ENVIRONMENT = '原排练室与本次成年人许可、时长、成本和奖励为原创G。观察、准备、实践、报告各1行动，能力实践3灵性且可失败。准备时站位稳定，没有施术；实际接触从PERFORM开始。CLOSE与WITHDRAW均0行动，实际停止能力、释放并退开；未实施准备取消不退款。失败须下一真实周再准备，已付灵性不返还。三报告各25扮演，三项完成后反思25。和平路线不进行完整转化，不产生秘偶，不改写已有无面人外貌与衣物历史。' + MARIONETTIST_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 5;
export const marionettistInside = (s: SliceState) => s.marionettist.ritual.location === 'COAST' || Object.values(s.marionettist.cases).some(r => r.contactOpen) || hasMarionettistOpenCapture(s);
export const isMarionettistActivity = (value: unknown): value is MarionettistActivityCommand => validateMarionettistActivityCommand(value);

function blocked(s: SliceState, c: Exclude<MarionettistActivityCommand, import('./puppet.js').MarionettistPuppetCommand>): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockMarionettistEncounter(s, c);
  const m = s.marionettist, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待释放或结束的真实接触。';
  if (c.type === 'WITHDRAW' && r?.contactOpen) return null;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成秘偶大师晋升。';
  if (marionettistInside(s)) return '先0行动结束当前接触、释放目标，或按已付原路从海岸返回。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原排练室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  const prepared = Object.entries(m.cases).find(([, v]) => v.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或0行动取消当前尚未施术的准备。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已回看这组经历。' : CASES.some(p => m.cases[p.id].status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知实践事项。';
  if (r.status === 'RESOLVED') return '已完成报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已保留。' : previous && m.cases[previous.id].status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原现场并核对成年人本人同意。' : r.attemptWeek === s.week ? '本周已实践，失败记录保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得实际结果，结束接触并核实恢复后才能报告。' : c.caseId !== 'living-lines' && (!r.autonomyVerified || r.initialControl) ? '须先真实解除控制并核实本人自主行动。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限能力实践。';
  return s.spirituality < 3 ? '本次需3灵性，不能透支；可0行动取消尚未施术的准备。' : null;
}

export function applyMarionettistActivity(s: SliceState, c: MarionettistActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateMarionettistActivityCommand(c)) throw new Error('秘偶大师活动命令无效。');
  if (isMarionettistPuppetCommand(c)) { applyMarionettistPuppetCommand(s, c, ctx); return; }
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyMarionettistEncounter(s, c, ctx); return; }
  const m = s.marionettist;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId];
    if (r.contactOpen) {
      r.contactOpen = false; r.closes += 1; r.initialControl = false;
      if (r.outcome === 'RELEASE_RECORDED') r.autonomyVerified = true;
      ctx.note('实际停止能力、释放并退开', '你停止本次有限感知或短时操纵，真实释放并亲眼核实本人自主活动，然后退出接触。0行动，收束时间已含原实践预算；原成年人始终活着，普通木偶仍是原无生命道具。已发生的失败、打断、灵性与行动消耗全部保留，不治疗、不退款。');
    } else {
      r.status = 'OBSERVED'; r.method = null;
      ctx.note('取消尚未施术的准备', '原成年人仍自由站定，原道具保持稳定；尚未使用能力，无人需要解除控制。0行动，不退准备成本。');
    }
    if (c.type === 'WITHDRAW') r.withdrawals += 1;
    return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('marionettist-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('感知、专注与停止的边界', '你把原生命与道具、初控与完整转化区分开，保留自愿、真实失败、释放和打断后自主行动的记录。完整转化会使原人不可逆死亡，本组和平实践没有这样做。G扮演+25，不能由报告复制或制造秘偶。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = 'ABILITY'; ctx.note('准备有限实践，尚未接触', p.preparation + '若为最后行动，仍可正常等待下周或0行动取消准备。'); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`marionettist-case:${p.id}`, 8); ctx.note(p.title, p.result + '本次接触已实际结束，G扮演+25、已知能力单项掌握+8。'); return; }
  r.attemptWeek = s.week; r.contactOpen = true; s.spirituality -= 3;
  const result = ctx.check(p.id === 'living-lines' ? 'perception' : 'will', 12);
  if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'living-lines') r.linesObserved = true;
    else if (p.id === 'controlled-release') r.initialControl = true;
    else { r.initialControl = false; r.interrupted = true; r.autonomyVerified = true; }
    ctx.note(p.title, p.id === 'controlled-release' ? '在原5米内对自愿成年乔纳实际短时初控，思维和动作变慢，你也因专注受行动限制。未推进完整转化；现在须0行动CLOSE或WITHDRAW实际释放并核实自主行动，不能带着控制离场或过周。' : p.result + '先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次有限尝试失败，未取得可报告的结果；没有把人变成秘偶。1行动与3灵性已真实支付，不退款。先0行动停止本次能力尝试、实际退开；下一真实周可重新准备。');
  }
}
export function marionettistActions(s: SliceState): MarionettistAction[] {
  if (!active(s)) return [];
  const out: MarionettistAction[] = [];
  const add = (id: string, label: string, cost: string, command: Exclude<MarionettistActivityCommand, import('./puppet.js').MarionettistPuppetCommand>) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.marionettist.cases[p.id];
    if (r.contactOpen) { add(`${p.id}-close`, '实际停止能力、释放并退开', '0行动 · 保留原成本与结果', { type: 'CLOSE', caseId: p.id }); add(`${p.id}-withdraw`, '结束本次接触并回到生活', '0行动 · 不退款、不治疗', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对同一原现场与成年人许可', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') add(`${p.id}-ability`, '准备有限灵体之线实践', '1行动 · 稳定站位，尚未施术', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
    if (r.status === 'PREPARED') { add(`${p.id}-perform`, '实际进行短时能力实践', '1行动 · 3灵性 · 可失败，失败照付', { type: 'PERFORM', caseId: p.id }); add(`${p.id}-withdraw`, '取消尚未施术的准备', '0行动 · 不退款', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际有限结果', '1行动 · 须先真实收束', { type: 'REPORT', caseId: p.id });
  }
  if (!s.marionettist.reflected) add('marionettist-reflect', '回看感知、专注与停止的边界', '1行动 · 三项真实报告后', { type: 'REFLECT' });
  if (s.marionettist.encounter.status === 'AVAILABLE') { add('marionettist-encounter-talk', '向多恩当面澄清', '1行动 · 本人可以拒绝', { type: 'ENCOUNTER_TALK' }); add('marionettist-encounter-fight', '承担原现场冲突', '1行动 · 真实伤势与死亡风险', { type: 'ENCOUNTER_FIGHT' }); }
  return [...out, ...marionettistPuppetActions(s)];
}
// Historical inheritance only; existing stage command predicates stay unchanged.
const hasAttendantHistory = (s: SliceState) => s.progression.pathwayId === 'diviner' &&
  s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null;
export function marionettistCases(s: SliceState): MarionettistProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId === 'diviner' && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s)))))) return [];
  return CASES.map(p => { const r = s.marionettist.cases[p.id]; return {
    id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts],
    preparation: r.status === 'PREPARED' ? p.preparation : null,
    result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? r.initialControl ? '真实短时初控尚未释放，须0行动CLOSE或WITHDRAW；原人成为秘偶的完整转化没有发生。' : p.result : r.attemptWeek !== null ? '此前尝试未成功，已付成本保留；实际退开后，下一真实周可重试。' : r.withdrawals > 0 ? '尚未实施的准备已取消，未退款。' : null,
    status: r.status, contactOpen: r.contactOpen ? '本次真实接触尚待结束' : '没有尚待结束的本次接触', closes: r.closes,
  }; });
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateMarionettistActivityCommand(v: unknown): v is MarionettistActivityCommand {
  if (!record(v)) return false;
  if (validateMarionettistPuppetCommand(v)) return true;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(v.type as string)) return shape(v, ['type']);
  if (!MARIONETTIST_CASE_IDS.includes(v.caseId as MarionettistCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && v.method === 'ABILITY';
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(v.type as string) && shape(v, ['type', 'caseId']);
}
export function validateMarionettistPractice(s: SliceState): boolean {
  const m = s.marionettist;
  if (!record(m.cases) || !shape(m.cases, MARIONETTIST_CASE_IDS) || !Array.isArray(s.seer.completedSources)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'linesObserved', 'initialControl', 'interrupted', 'autonomyVerified'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY'].includes(r.method) || !integer(r.withdrawals) || !integer(r.closes)) return false;
    if (![r.contactOpen, r.linesObserved, r.initialControl, r.interrupted, r.autonomyVerified].every(v => typeof v === 'boolean')) return false;
    if (r.observedWeek !== null && !integer(r.observedWeek, m.promotionWeek ?? s.week, s.week) || r.attemptWeek !== null && !integer(r.attemptWeek, r.observedWeek ?? s.week, s.week)) return false;
    if (r.status === 'AVAILABLE' && (r.observedWeek !== null || r.attemptWeek !== null || r.method !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status !== 'AVAILABLE' && (m.promotionWeek === null || r.observedWeek === null)) return false;
    if (i > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[i - 1]!.id].status !== 'RESOLVED') return false;
    if (s.seer.completedSources.filter(x => x === `marionettist-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    const success = ['EXAMINED', 'RESOLVED'].includes(r.status);
    if (success ? r.outcome !== p.outcome || r.attemptWeek === null || r.method !== 'ABILITY' : r.outcome !== 'NONE') return false;
    if (r.linesObserved !== (p.id === 'living-lines' && success)) return false;
    if (r.initialControl !== (p.id === 'controlled-release' && success && r.contactOpen)) return false;
    if (r.interrupted !== (p.id === 'break-contact' && success)) return false;
    if (r.autonomyVerified !== (success && (p.id === 'break-contact' || p.id === 'controlled-release' && !r.contactOpen))) return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method !== 'ABILITY' || r.contactOpen) return false; }
    if (r.status === 'RESOLVED') { resolved += 1; if (r.closes < 1 || r.contactOpen) return false; }
    if (r.closes > 0 && r.attemptWeek === null || r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method !== 'ABILITY' || s.status !== 'ACTIVE' || s.activeEvent !== null || s.combat !== null || s.world.city !== 'BACKLUND') return false; }
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'marionettist-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'diviner' && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||hasAttendantHistory(s))))) return open === 0 && prepared === 0 && s.bizarroSorcerer?.marionettistActingAtPromotion === resolved * 25 + (m.reflected ? 25 : 0);
  return !active(s) || s.progression.acting === resolved * 25 + (m.reflected ? 25 : 0);
}
