import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyConspiratorEncounter, blockConspiratorEncounter, CONSPIRATOR_ENCOUNTER_STORY } from './encounter.js';
import { CONSPIRATOR_CASE_IDS, type ConspiratorCommand, type ConspiratorActivityCommand, type ConspiratorAction, type ConspiratorProjection } from './types.js';

const REFUSAL = '成年运输负责人梅娅明确拒绝原绕路方案：“那会错过约好的交班，我不会同意。”这次拒绝已发生，不能退出后重置。';
const NEW_FACT = '拒绝后当面核实的新公开事实：原班表的下一班可晚半刻接手；备用运输窗口已由负责人公开确认，但本周安排已定。';
const REVISION = '下一周依据已公开确认的接班窗口实际修订原方案，保留本人原拒绝；再次评估仍不保证同意。';
const CASES = [
  { id: 'warehouse-rosters', title: '两份相矛盾的货栈班表', story: '原货栈墙上班表与交接台副本把同一班次记成不同时间。成年值班员愿意让你现场核对；两张原纸都留在原处，单靠漂亮推理不能确定哪张还有效。（G）', facts: ['两张原班表的同一班次互相矛盾，原因待现场核实。', '本人允许查阅公开班表；不得删掉不利记录或凭推理指责任何人。'], ability: '依据两份已见班表整理相互冲突的假设；实施时花3灵性作有限推理，并亲自核对现场公开交接。', ordinary: '用普通比对与现场问答核查两份班表，保留矛盾与未知。', result: '现场确认旧副本未记载公开调整。两份原表与调整说明分别记录，结论只覆盖这一班次。', outcome: 'ROSTERS_CHECKED', stat: 'knowledge' },
  { id: 'rejected-detour', title: '负责人拒绝的绕路方案', story: '你向成年运输负责人梅娅提出绕过拥挤入口的平常运输方案。她重视按约定交班，愿意听完并自行决定；你的能力不能替她决定，也不能把反对改写成同意。（G）', facts: ['梅娅的公开利益是按约定交班；原绕路方案尚未获得她同意。', '本人有权拒绝；计划须随新公开事实实际修订。'], ability: '以已核信息组织针对性说辞，实施另耗3灵性；第一次提出原方案会遭真实拒绝，不进行虚假的成功掷骰。', ordinary: '普通说明方案与已知代价，让负责人自主评估；第一次原方案同样会遭拒绝。', result: '修订方案采用已确认的接班窗口，梅娅在重新评估后自行同意这一具体安排。原拒绝和修订依据仍在案卷，不代表下次必然服从。', outcome: 'DETOUR_REVISED', stat: 'will' },
  { id: 'urgent-handover', title: '紧急交接的备用通路', story: '一份普通交接文书快到公开约定时限，正门仍在常规检修。成年保管员已经确认侧廊作为备用通路可以步行使用；你需采用这条真实存在的路线，不要求正门负责人放弃检修，也不搬动任何物品。（G）', facts: ['正门仍在检修，不能要求负责人让步。', '原侧廊由成年保管员当面确认可用；已知备用通路才可纳入本次安排。'], ability: '根据已确认的侧廊与交接时限安排次序，实施耗3灵性作有限推理；路线判断仍可能失败。', ordinary: '按公开标识和保管员确认，普通走侧廊完成交接核对。', result: '你沿已确认的原侧廊抵达交接处，记录有限的按时到达结果。正门检修照常，没人被迫改变意愿，也没有凭空新增道路或转移货物。', outcome: 'BACKUP_USED', stat: 'knowledge' },
] as const;
export const CONSPIRATOR_ENVIRONMENT = '组织说辞与谋划增强仍依赖真实利益和已核情报；推理、说服都可能失败。三项事务均可普通完成，第二案保留第一次真实拒绝并在下周实际修订。每项报告G扮演+25，三案反思+25；没有自动降智、洗脑或序列5弱点收割。全部事件和数值为原创G。 ' + CONSPIRATOR_ENCOUNTER_STORY;
export const conspiratorInside = (s: SliceState) => Object.values(s.conspirator.cases).some(r => r.contactOpen);
export const isConspiratorActivity = (c: ConspiratorCommand): c is ConspiratorActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is ConspiratorActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!CONSPIRATOR_CASE_IDS.includes(c.caseId as typeof CONSPIRATOR_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: ConspiratorActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockConspiratorEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 6) return '先完成阴谋家晋升。';
  const r = 'caseId' in c ? s.conspirator.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次事项。';
  if (conspiratorInside(s)) return '先0行动结束本次接触并退出。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到索伦的原货栈。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.conspirator.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.conspirator.reflected ? '已经回看这段经历。' : CASES.some(p => s.conspirator.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察与本人意愿已经保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对当前事实与本人公开利益。' : r.attemptWeek === s.week ? '本周结果与拒绝保留，下周再依已核新事实重新准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实践需要3灵性；可取消准备后选择普通方法。' : null;
}
export function applyConspiratorActivity(s: SliceState, c: ConspiratorActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('阴谋家实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyConspiratorEncounter(s, c, ctx); return; }
  const m = s.conspirator;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次事项并退出', '0行动停止本次讨论或现场核对，原纸张与现场物品留在原处。已付成本、原观察、本人拒绝和修订记录全部保留，不退灵性、不治疗、不重置意愿、不再抽奖。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消这次准备，原观察、已付行动、公开拒绝与修订依据仍保留。没有让对方重新同意。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('conspirator-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('计划也必须接受现实纠正', '回看班表核实、实际拒绝与修订、备用通路三段经历。G扮演+25；他人的同意仍是本人的决定，情报和推理从不保证必成。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'rejected-detour' && r.notes.includes(REFUSAL) && !r.revised) { r.revised = true; r.notes.push(REVISION); ctx.note('实际修订原绕路方案', REVISION); }
    ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`conspirator-case:${p.id}`, 8);
    ctx.note(p.title, p.result + '本次事项已实际结束，G扮演+25、已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') { s.spirituality -= 3; ctx.note('有限能力的实际成本', '本次3灵性已经支出；情报、说辞和对方意愿仍各自成立，不保证成功。'); }
  if (p.id === 'rejected-detour' && !r.notes.includes(REFUSAL)) {
    r.status = 'OBSERVED'; r.notes.push(REFUSAL, NEW_FACT);
    ctx.note('梅娅真实拒绝原方案', REFUSAL + ' ' + NEW_FACT + '本次不抽成功骰。先0行动结束接触，下周再修订，不能重按同一方案强行说服。'); return;
  }
  const result = ctx.check(r.method === 'ABILITY' ? p.stat : 'knowledge', r.method === 'ABILITY' ? 12 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') { r.status = 'EXAMINED'; r.outcome = p.outcome; ctx.note(p.title, p.result + '先0行动结束本次事项并退出。'); }
  else {
    r.status = 'OBSERVED'; if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    ctx.note(p.title, (p.id === 'rejected-detour' ? '修订方案仍未获得本人同意；原拒绝与已核事实保留。' : '本次现场核对不足以支持结论，已有信息不保证推理成功。') + (result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : '') + '先实际结束本次接触，下周可再核对。');
  }
}
export function conspiratorActions(s: SliceState): ConspiratorAction[] {
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 6) return [];
  const out: ConspiratorAction[] = [];
  const add = (id: string, label: string, cost: string, command: ConspiratorActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.conspirator.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束本次事项并退出', '0行动 · 保留原事实与拒绝', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对现场事实与本人公开利益', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      const revised = p.id === 'rejected-detour' && r.notes.includes(REFUSAL);
      add(p.id + '-ability', revised ? '据新公开事实修订能力方案' : '准备有条件的能力方案', '1行动 · 实施另耗3灵性 · 不保证同意', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', revised ? '据新公开事实修订普通方案' : '准备普通核对方案', '1行动', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') { add(p.id + '-perform', '实际执行当前方案，由现场与本人评估', '1行动', { type: 'PERFORM', caseId: p.id }); add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不重置本人意愿', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与未知范围', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.conspirator.reflected) add('conspirator-reflect', '回看推理、拒绝与修订的边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.conspirator.encounter.status === 'AVAILABLE') {
    add('conspirator-encounter-talk', '前往原后门观察并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('conspirator-encounter-fight', '前往原后门观察并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function conspiratorCases(s: SliceState): ConspiratorProjection['cases'] {
  if (s.progression.pathwayId !== 'hunter' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3)) return [];
  return CASES.map(p => { const r = s.conspirator.cases[p.id]!; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...r.notes], preparation: r.status === 'PREPARED' ? (r.method === 'ABILITY' ? p.ability : p.ordinary) + (r.revised ? ' ' + REVISION : '') : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result : r.notes.includes(REFUSAL) ? REFUSAL + (r.revised ? ' 原方案已修订，仍须实际评估。' : ' 下一真实周可据新事实修订。') : r.attemptWeek !== null ? '此前核对未成，原成本和未知保留。' : r.withdrawals ? '尚未实施的准备已取消。' : null, status: r.status, contactOpen: r.contactOpen ? '本次事项仍须实际结束并退出' : '没有尚未结束的本次事项', closes: r.closes }; });
}
/** Fixed original evidence keeps refusal/revision persistent without a generic persuasion framework. */
export function validateConspiratorLife(s: SliceState): boolean {
  const m = s.conspirator;
  if (!record(m) || !record(m.cases) || !shape(m.cases, [...CONSPIRATOR_CASE_IDS]) || !Array.isArray(s.seer.completedSources)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean' || typeof r.revised !== 'boolean' || !Array.isArray(r.notes)) return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    const sourceCount = s.seer.completedSources.filter(x => x === `conspirator-case:${p.id}`).length;
    if (sourceCount !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.notes.length || r.revised)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.notes.length)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek === null || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (p.id === 'rejected-detour') {
      const expected = r.attemptWeek === null ? [] : r.revised ? [REFUSAL, NEW_FACT, REVISION] : [REFUSAL, NEW_FACT];
      if (JSON.stringify(r.notes) !== JSON.stringify(expected) || r.revised && (r.attemptWeek === null || r.closes < 1)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status as string) && !r.revised) return false;
    } else if (r.notes.length !== 0 || r.revised) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'conspirator-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'hunter' && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) return open === 0 && prepared === 0 && s.reaper.conspiratorActingAtPromotion === resolved * 25 + (m.reflected ? 25 : 0);
  if (s.progression.pathwayId === 'hunter' && s.progression.sequence === 6 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
