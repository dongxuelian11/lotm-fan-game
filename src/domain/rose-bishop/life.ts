import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ROSE_BISHOP_RATION_PRICE } from './content.js';
import { applyRoseBishopEncounter, blockRoseBishopEncounter, ROSE_BISHOP_ENCOUNTER_STORY } from './encounter.js';
import { validateRoseBishopCommand } from './index.js';
import { ROSE_BISHOP_CASE_IDS, type RoseBishopCommand, type RoseBishopActivityCommand, type RoseBishopAction, type RoseBishopProjection } from './types.js';

const CASES = [
  { id: 'ring-release', shape: 'SLIM_HAND', title: '可打开的原练习环',
    story: '成年导师伊森在原旧物间摆好一枚带开合扣的宽练习环。你只将自己的手放入，原扣随时可开，无需压伤或改变骨骼。练习只观察本人有限血肉调整与退出，环始终归伊森。',
    facts: ['原环确实有可手动打开的扣，没有封死手腕或危险夹持。', '只调整自己手部的有限血肉，不进入任何人的身体，也不改变骨骼。'],
    ability: '有限调整本人手部血肉，尝试将手从原宽练习环中退出；1行动、3灵性、1真实储备，失败照耗，随后必须恢复正常形态。',
    ordinary: '直接打开同一原练习环的扣，普通方式退出自己的手，不耗灵性或储备。',
    result: '自己的手已从同一原练习环中退出；原环和开合扣保持完整且仍属伊森，只报告这一有限结果。', outcome: 'RING_VERIFIED' },
  { id: 'steady-grip', shape: 'SUPPORT_PALM', title: '原支架旁的一小瓶水',
    story: '伊森把一只装少量水的原小瓶放在原低支架上。你只用自己的手在支架上方近处练习持握，随时可用另一只手接住并放回；不把小瓶变成你的物品，也不对他人施加力量。',
    facts: ['原小瓶、少量水与原支架均实际在场，位置就在自己的手边。', '本次观察本人手掌的有限血肉调整，普通双手持握随时可用；不检验愈伤或骨骼变化。'],
    ability: '有限调整自己的掌部血肉，尝试稳住同一原小瓶；1行动、3灵性、1真实储备，失败照耗，结束时放回原支架并恢复正常。',
    ordinary: '用普通双手稳住同一小瓶，再放回原支架，不施法、不耗灵性或储备。',
    result: '同一原小瓶已完成一次有限持握核实，仍属伊森；本次只观察实际持握，没有治伤或任意改变物质。', outcome: 'GRIP_VERIFIED' },
  { id: 'reserve-lesson', shape: 'NORMAL', title: '伊登愿意听的供给说明',
    story: '成年伊登愿意听你说明已经发生的原环与小瓶练习。他只同意这次既有记录的讲解，可以拒绝继续；你不对他施法，不以他的身体供给资源，不要求他进食或自伤。',
    facts: ['伊登本人在场并同意本次有限说明，同意不延伸到任何身体试验。', '说明仅含前两项真实记录、动物来源原份、有限储备、失败代价与普通方法。'],
    ability: '依据已有真实记录说明血肉供给与有限自体调整的边界，请伊登复述本人理解；不施法，不消耗储备。',
    ordinary: '按既有公开记录作普通讲解，听取伊登的问题并请本人复述；不要求相信、进食或接受能力。',
    result: '伊登本人已复述这次记录与资源风险；这只证明本次理解，不代表授予能力、授权身体接触或消除污染。', outcome: 'LESSON_VERIFIED' },
] as const;

export const ROSE_BISHOP_ENVIRONMENT = '本作G血肉供给：每真实周最多购1份明确动物来源的封装鱼肉，1行动40便士；原份可跨周保留。另花1行动实际取用选定原份，原份耗尽、储备+1，上限3；不治疗，也不靠休养自动制造。前两项能力实践各1行动、3灵性、1储备，失败照耗且本人形态仍须0行动实际恢复；这段收束已包含在实践预付时间内。普通开扣或双手方法0灵性0储备。讲解尊重成年人拒绝。所有接触须实际结束后才能报告或离开。' + ROSE_BISHOP_ENCOUNTER_STORY;
export const roseBishopInside = (s: SliceState) => Object.values(s.roseBishop.cases).some(r => r.contactOpen);
export const isRoseBishopActivity = (c: RoseBishopCommand): c is RoseBishopActivityCommand =>
  ['BUY_RATION', 'TAKE_RATION', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const active = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 6 || s.progression.sequence === 5 || (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));

function blocked(s: SliceState, c: RoseBishopActivityCommand): string | null {
  if ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) && !['BUY_RATION','TAKE_RATION'].includes(c.type)) return '蔷薇主教经历已归档，请在牧羊人页继续当前实践。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockRoseBishopEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成蔷薇主教晋升。';
  const m = s.roseBishop, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (roseBishopInside(s)) return '先0行动实际结束本次接触，将自己的身体恢复正常。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德伊森的原旧物间。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (c.type === 'BUY_RATION') return m.reserve.lastPurchaseWeek === s.week ? '本真实周已购买一份，下一真实周才有下一份可购。' : s.cash < ROSE_BISHOP_RATION_PRICE ? '这一份动物来源封装鱼肉需要40便士。' : null;
  if (c.type === 'TAKE_RATION') return !m.reserve.packets.some(x => x.id === c.packetId && x.status === 'HELD') ? '没有实际持有且尚未取用的同一封装原份。' : m.reserve.points >= m.reserve.max ? '储备已经达到3，不消耗这份原物。' : null;
  if (c.type === 'REFLECT') return m.reflected ? '已回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原物与本人本次同意。' : r.attemptWeek === s.week ? '本周实践未成，下一真实周再重新准备。' : c.method === 'ABILITY' && p.shape !== 'NORMAL' && m.reserve.points < 1 ? '先实际取用动物来源原份取得1储备，或选择普通方法。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得真实结果，并实际结束本次接触。';
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && p.shape !== 'NORMAL' ? m.reserve.points < 1 ? '缺少1真实储备，可取消准备后补充或采用普通方法。' : s.spirituality < 3 ? '本次调整需要3灵性，不能透支；可取消后采用普通方法。' : null : null;
}

export function applyRoseBishopActivity(s: SliceState, c: RoseBishopActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateRoseBishopCommand(c) || !isRoseBishopActivity(c)) throw new Error('蔷薇主教活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyRoseBishopEncounter(s, c, ctx); return; }
  const m = s.roseBishop;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1; m.practice.shape = 'NORMAL';
    ctx.note('实际恢复本人形态并结束接触', c.caseId === 'ring-release' ? '你在本次预付练习时间内实际恢复自己的正常手部形态；如手尚在原环内，先打开原扣退出。原环归位且仍属伊森。0行动，不追加储备或灵性，不返还此前消耗，不治疗。' : c.caseId === 'steady-grip' ? '你用普通双手接稳同一原小瓶，实际放回原支架，再恢复自己的正常手掌形态。本次收束包含在预付练习时间内，0行动，不返还消耗，不治疗，原瓶仍属伊森。' : '你与伊登实际结束这次讲解，尊重他本人已表达的意愿。0行动，无施法、物品转交、治疗或资源补充。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消准备，自己的身体仍为正常形态；没有消耗新储备，不退之前的行动或真实成本。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'BUY_RATION') {
    const reserve = m.reserve; s.cash -= ROSE_BISHOP_RATION_PRICE; reserve.packetsBought += 1; reserve.lastPurchaseWeek = s.week;
    const id = `rose-bishop-ration-${reserve.packetsBought}`; reserve.packets.push({ id, acquiredWeek: s.week, status: 'HELD', consumedWeek: null });
    ctx.note('动物来源封装原份实际交付', `花费1行动、40便士，伊森从本作G普通食物渠道购入并交付明确动物来源的封装鱼肉${id}。没有人类来源；原份可跨周保留。本次只购买，还未取用，不加储备、不治疗，本真实周不再供应第二份。`); return;
  }
  if (c.type === 'TAKE_RATION') {
    const packet = m.reserve.packets.find(x => x.id === c.packetId)!; packet.status = 'CONSUMED'; packet.consumedWeek = s.week; m.reserve.points += 1;
    ctx.note('实际取用选定动物来源原份', `花费1行动，实际取用原份${packet.id}；同一原份已耗尽，血肉储备+1至${m.reserve.points}/3。健康、精神、灵性与伤势均未因此恢复，不要求自伤或食人，也不产生新原份。`); return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('rose-bishop-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看有限自体调整与真实供给', '你将原物、本人身体、动物来源份额、失败成本、普通方法与他人意愿分开记录。G扮演+25；没有凭空补充储备、消除污染、吞取灵魂或得到复活。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`rose-bishop-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次采用普通方法，没有虚构施法。' : '') + '本次接触已结束、本人形态正常，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY' && p.shape !== 'NORMAL') {
    s.spirituality -= 3; m.reserve.points -= 1; m.practice.shape = p.shape;
    ctx.note('本人有限血肉调整已经开始', '本次实际消耗3灵性和1血肉储备，自己的手部已进入有限调整状态；结果仍需判定，失败也不返还成本，必须0行动实际恢复正常形态才能离开。没有改变骨骼或接触他人身体。');
  }
  const result = ctx.check(p.shape === 'NORMAL' ? 'knowledge' : 'will', p.shape === 'NORMAL' ? 12 : r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome; ctx.note(p.title, p.result + '须先0行动归还原物、恢复本人形态并实际结束接触再报告。');
  } else {
    r.status = 'OBSERVED';
    ctx.note(p.title, (p.shape !== 'NORMAL' ? '本次没有取得可报告结果，实际消耗保留；原环可开扣，原瓶可用双手放回，不需危险自伤。' : '伊登本人尚未理解或不愿继续这次说明，你尊重他的拒绝，不施法强迫。') + '先0行动实际收束；下一真实周可重新准备。');
  }
}

export function roseBishopActions(s: SliceState): RoseBishopAction[] {
  if (!active(s)) return [];
  const out: RoseBishopAction[] = [];
  const add = (id: string, label: string, cost: string, command: RoseBishopActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('rose-bishop-buy-ration', '购买一份动物来源封装鱼肉', '1行动 · 40便士 · 每真实周最多1份', { type: 'BUY_RATION' });
  for (const packet of s.roseBishop.reserve.packets) if (packet.status === 'HELD') add(`take-${packet.id}`, `实际取用${packet.id}`, '1行动 · 消耗同一原份 · 储备+1，上限3 · 不治疗', { type: 'TAKE_RATION', packetId: packet.id });
  if(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))return out;
  for (const p of CASES) {
    const r = s.roseBishop.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, '恢复本人正常形态并结束接触', '0行动 · 实际归还原物/停止讲解 · 不退款', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原物与本人的本次同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.shape === 'NORMAL' ? '准备已有记录的供给说明' : '准备本人有限血肉调整', '1行动 · 不凭空生成储备', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'ring-release' ? '准备打开原环扣的普通方法' : p.id === 'steady-grip' ? '准备普通双手持握' : '准备普通讲解与本人复述', '1行动 · 不耗灵性或储备', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, p.shape === 'NORMAL' ? '向伊登说明并请本人核实' : '实际完成本次有限练习', p.shape !== 'NORMAL' && r.method === 'ABILITY' ? '1行动 · 3灵性 · 1储备 · 失败照耗' : '1行动 · 0灵性 · 0储备 · 可失败或拒绝', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际结果与有限边界', '1行动 · 先结束本次接触', { type: 'REPORT', caseId: p.id });
  }
  if (!s.roseBishop.reflected) add('rose-bishop-reflect', '回看自体调整、供给与自愿说明', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.roseBishop.encounter.status === 'AVAILABLE') {
    add('rose-bishop-encounter-talk', '到原旧物间外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('rose-bishop-encounter-fight', '到原旧物间外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function roseBishopCases(s: SliceState): RoseBishopProjection['cases'] {
  if (!active(s)) return [];
  return CASES.map(p => { const r = s.roseBishop.cases[p.id]!; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result + (r.method === 'ORDINARY' ? '本次为普通方法。' : '') : r.attemptWeek !== null ? '上次没有形成可报告结果，实际成本与本人意愿保留；下一真实周可重新准备。' : r.withdrawals ? '准备已取消，未消耗新储备。' : null, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束；需实际恢复正常形态或停止讲解' : '本人形态正常，无尚未结束的接触', closes: r.closes }; });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateRoseBishopLife(s: SliceState): boolean {
  const m = s.roseBishop;
  if (!record(m) || !record(m.cases) || !shape(m.cases, ROSE_BISHOP_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const reserve = m.reserve, promotion = m.promotionWeek ?? s.week;
  if (!record(reserve) || !shape(reserve, ['points', 'max', 'packetsBought', 'lastPurchaseWeek', 'packets']) || reserve.max !== 3 || !integer(reserve.points, 0, 3) || !integer(reserve.packetsBought, 0, Math.max(0, s.week - promotion + 1)) || !Array.isArray(reserve.packets) || reserve.packets.length !== reserve.packetsBought) return false;
  let previousWeek = promotion - 1, consumed = 0;
  for (const [index, packet] of reserve.packets.entries()) {
    if (!record(packet) || !shape(packet, ['id', 'acquiredWeek', 'status', 'consumedWeek']) || packet.id !== `rose-bishop-ration-${index + 1}` || !integer(packet.acquiredWeek, previousWeek + 1, s.week)) return false;
    previousWeek = packet.acquiredWeek;
    if (packet.status === 'HELD') { if (packet.consumedWeek !== null) return false; }
    else if (packet.status === 'CONSUMED') { if (!integer(packet.consumedWeek, packet.acquiredWeek, s.week)) return false; consumed += 1; }
    else return false;
  }
  if (reserve.points > consumed || (reserve.packetsBought === 0 ? reserve.lastPurchaseWeek !== null : reserve.lastPurchaseWeek !== previousWeek)) return false;
  if (!record(m.practice) || !shape(m.practice, ['shape']) || !['NORMAL', 'SLIM_HAND', 'SUPPORT_PALM'].includes(m.practice.shape)) return false;
  let open = 0, prepared = 0, resolved = 0;
  let expectedShape: string = 'NORMAL';
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `rose-bishop-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; if (r.method === 'ABILITY') expectedShape = p.shape; }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
  }
  if (m.practice.shape !== expectedShape || open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'rose-bishop-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (active(s) && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.shepherd.roseBishopActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (reserve.packetsBought !== 0 || reserve.points !== 0 || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
