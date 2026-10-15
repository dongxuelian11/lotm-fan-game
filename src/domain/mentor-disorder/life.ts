import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyBriberActivity } from '../briber/life.js';
import { applyMentorDisorderEncounter, blockMentorDisorderEncounter, MENTOR_DISORDER_ENCOUNTER_STORY } from './encounter.js';
import { validateMentorDisorderCommand } from './index.js';
import { MENTOR_DISORDER_CASE_IDS, type MentorDisorderCommand, type MentorDisorderActivityCommand, type MentorDisorderAction, type MentorDisorderProjection } from './types.js';

const CASES = [
  {
    id: 'paired-trays', title: '两枚原木筹与各自的封边软盘',
    story: '贝克兰德原契约铺指导室里，米蕾·沃德把同一枚红筹MD5-RED-1与同一枚蓝筹MD5-BLUE-1放在原低桌各自的封边软托盘内。两条原滚道在视线上交叉，却有原隔栏分开；米蕾明确许可这一次有限试验，准备时两筹仍停稳，实施时才由她同时启动。',
    facts: ['原红筹、原蓝筹、原封边软盘与低桌真实在场，原隔栏保持，两筹始终各在原盘内且归米蕾。', '能力只短暂混乱两枚已经运动的原筹轨迹，不瞬移、复制、交换所有权或把筹移出原盘；MIXED只表示本次轨迹曾受混乱。', '普通方法先等原筹停止，再亲手操作原普通分隔片并核对两筹；这是普通整理，不伪称魔法混乱。'],
    ability: '准备两枚原筹的有限混乱：准备1行动，尚未施法或启动原筹；实施另1行动、3灵性、知识14，失败照付。两筹停在各自原封边软盘内后，仍须0行动逐一按原编号收回原红、蓝分格。',
    ordinary: '准备普通核对同一对原筹：实施1行动、0灵性、知识12；等两枚原筹停止后亲手操作原分隔片，实际收拢核对，随后0行动按编号归入原红、蓝分格。',
    outcome: 'TRAYS_CHECKED',
  },
  {
    id: 'willing-crossing', title: '赛恩本人同意的一次短段行走',
    story: '原创成年递送员赛恩在原契约铺指导室明确同意一次可以随时停止的短段行走试验，或普通指路对照。同一房内有两条干燥、清楚标记的原短路，前方原停步点实际可达；没有障碍、台沿或旁人。赛恩保留停止信号与自己的选择。',
    facts: ['许可只限这一次有限行走，准备时赛恩尚未起步；下一次重试必须重新核实本人的当下同意。', '能力只尝试把本人已经开始的横向移动短暂混乱到前方原停步点，不能穿墙、瞬移、取消全部自由意志或留下长期服从。', '普通方法是实际口头澄清与正常沿原标线行走，不令本人自动走错。无论成败，赛恩都依自己的选择安全停步；收束时本人沿原路实际走回原起点，原标记MD5-ROUTE-MARKER收回原盒。'],
    ability: '核实赛恩本人对本次一次行走的明确同意，准备1行动，尚未施法或让他起步。实施另1行动、3灵性、知识14，可失败且失败照付；随后0行动停止影响，让本人复核原路并实际走回原起点。',
    ordinary: '核实赛恩本人当前同意，准备普通口头澄清；实施1行动、0灵性、知识10，由本人正常沿原标线行走与停步，不伪称强制走错；随后0行动实际返回、收好原标记并结束本次同意。',
    outcome: 'ROUTE_CHECKED',
  },
  {
    id: 'honest-account', title: '同一张有限记录的亲手交付',
    story: '核册员伊芙在米蕾的原指导室保留同一张原记录纸MD5-NOTE-1。你只整理已经实际发生的两枚原筹运动与收回、赛恩的本次同意与实际返回、成功或失败和实付成本，不凭文字制造未知事实。',
    facts: ['只写真实有限结果；普通整理或指路不能写成施法，失败不能写成成功，也不能把短效写成永久控制。', '实施时伊芙本人递来同一张MD5-NOTE-1，失败也留下实际文字；重试在同一原纸保留并更正旧文字。', '结束时你亲手把同一已写原纸交给伊芙，由她当面收妥；没有复制、远程转移或赠送新纸。'],
    ability: null,
    ordinary: '准备在同一张MD5-NOTE-1上普通书写；实施1行动、0灵性、知识10，之后0行动亲手交付已写原纸。',
    outcome: 'ACCOUNT_CHECKED',
  },
] as const;

const active = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 5;
const contactOpen = (s: SliceState) => Object.values(s.mentorDisorder.cases).some(r => r.contactOpen);
const physicalContact = (s: SliceState) => s.mentorDisorder.practice.markers !== 'SORTED' || s.mentorDisorder.practice.route === 'MARKED' || s.mentorDisorder.practice.note === 'WRITTEN';
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
export const mentorDisorderInside = (s: SliceState) => contactOpen(s) || physicalContact(s);
export const isMentorDisorderActivity = (c: MentorDisorderCommand): c is MentorDisorderActivityCommand => typeof c === 'object' && c !== null &&
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'BUY_GIFTS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

export const MENTOR_DISORDER_ENVIRONMENT = '以下现场与全部数值为原创G：观察、准备、实施、报告各1行动；前两项能力实践另3灵性、知识14，失败照付。原红、蓝筹始终各在原封边软盘内；普通等停后操作原分隔片知识12、0灵性。赛恩仅明确同意这一次有限行走，普通口头澄清知识10、0灵性，不伪称强制走错。同一原纸只允许普通知识10、0灵性。最后1行动或0灵性仍可0行动按编号实际收回原筹、停止影响并让赛恩实际走回原起点且收好原标记、或亲手交付已写原纸；不退款、不治疗，不瞬移。失败先实际收束，下一真实周重新准备并取得本次有限同意。三份真实报告各G扮演25，只有前两项真实成功的能力报告各得已有知识池单项掌握8，普通方法不伪造掌握，反思25。全普通和平100有实际成本，不保证原著无风险消化，不提前取得序列4赋予、放大、正式利用或建筑规模改写；封印物的三分钟自我混乱也不当作本职成本。' + MENTOR_DISORDER_ENCOUNTER_STORY;

function closeBlock(s: SliceState, caseId: string): string | null {
  const m = s.mentorDisorder, f = m.practice, r = m.cases[caseId];
  if (!r?.contactOpen || r.attemptWeek !== s.week || r.method === null || !['OBSERVED', 'EXAMINED'].includes(r.status)) return '没有尚待实际结束的本次接触。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '须在原指导室的同一实际接触里收回原物或让本人实际返回。';
  if (caseId === 'paired-trays') {
    const expected = r.status === 'EXAMINED' && r.method === 'ABILITY' ? 'MIXED' : 'COLLECTED';
    return f.markers === expected && f.route === 'READY' && f.note === 'BLANK' ? null : '须有本次真实停在各自原盘内的同一红、蓝筹，才能按编号收回原红、蓝分格。';
  }
  if (caseId === 'willing-crossing') return f.markers === 'SORTED' && f.route === 'MARKED' && f.note === 'BLANK' ? null : '须有赛恩本次已经实际行走并停步的原路线，才能结束影响、实际返回并收好原标记。';
  return f.markers === 'SORTED' && f.route === 'FREE' && f.note === 'WRITTEN' ? null : '须先实际写过并持有同一张原纸，才能亲手交付。';
}

function blocked(s: SliceState, c: MentorDisorderActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockMentorDisorderEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成混乱导师晋升。';
  const m = s.mentorDisorder, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return closeBlock(s, c.caseId);
  if (mentorDisorderInside(s)) return '先0行动按编号实际收回原筹、让赛恩沿原路实际返回并收好原标记，或亲手交付同一已写原纸。';
  if (Object.values(s.corruptionBaron.cases).some(value => value.contactOpen) || Object.values(s.briber.cases).some(value => value.contactOpen) || Object.values(s.barbarian.cases).some(value => value.contactOpen) || Object.values(s.lawyer.cases).some(value => value.contactOpen)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德米蕾的原契约铺指导室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前尚未实施的准备。';
  if (c.type === 'BUY_GIFTS') return s.cash < 60 ? '三枚独立原木筹需要60便士。' : null;
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践已发生，下一真实周再准备同一原现场。' : c.caseId === 'honest-account' && c.method === 'ABILITY' ? '有限记录只能普通书写，不能把文字变成新能力。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' || r.outcome === 'NONE' ? '先取得真实结果，并实际结束接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力需要3灵性，不能透支；可0行动取消准备后选择普通方法。' : null;
}

function practiceText(s: SliceState): string {
  const f = s.mentorDisorder.practice;
  return `同一原红筹MD5-RED-1与原蓝筹MD5-BLUE-1为${f.markers}，原赛恩与MD5-ROUTE-MARKER本次路线为${f.route}，同一原纸MD5-NOTE-1为${f.note}；原物所有权不变。`;
}
function resultText(s: SliceState, id: string): string {
  const r = s.mentorDisorder.cases[id]!;
  if (id === 'paired-trays') return r.method === 'ABILITY' ? '你实付3灵性，短暂混乱已经同时运动的原红筹MD5-RED-1与原蓝筹MD5-BLUE-1的实际轨迹；两筹沿各自连续滚道停留在原封边软盘内，没有瞬移、交换原物或更改所有权。' : '你等两枚原筹停止后，亲手操作原普通分隔片，实际收拢并核对同一MD5-RED-1与MD5-BLUE-1；这只是普通整理，没有产生魔法混乱。';
  if (id === 'willing-crossing') return r.method === 'ABILITY' ? '赛恩已经开始的横向移动，在这一次本人同意的有限试验里短暂偏向前方原停步点；他依自己的选择安全停步，没有穿墙、瞬移、取消全部自由意志或留下长期服从。' : '你实际口头澄清原标线与停步点，赛恩本人正常沿原标线行走，并依自己的选择安全停步；普通指路没有令他自动走错。';
  return '你在同一张MD5-NOTE-1上普通写下实际原筹轨迹与收回、赛恩本次同意与返回、已付成本和成功或失败，不补写未知事实或伪造能力效果。';
}

export function applyMentorDisorderActivity(s: SliceState, c: MentorDisorderActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateMentorDisorderCommand(c) || !isMentorDisorderActivity(c)) throw new Error('混乱导师活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyMentorDisorderEncounter(s, c, ctx); return; }
  if (c.type === 'BUY_GIFTS') { applyBriberActivity(s, c, ctx, award); return; }
  const m = s.mentorDisorder, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let closure: string;
    if (c.caseId === 'paired-trays') {
      f.markers = 'SORTED';
      closure = '你停止这次短效或普通整理，逐一按MD5-RED-1与MD5-BLUE-1核对同一原红、蓝筹，亲手从各自原盘收回原红、蓝分格并放稳；两枚原物一直保留，没有复制、换物、丢失或改变所有权。';
    } else if (c.caseId === 'willing-crossing') {
      f.route = 'FREE';
      closure = '你停止施加本次影响或普通指路，赛恩本人复核原路线，沿同一原路实际走回原起点；你亲手撤下同一MD5-ROUTE-MARKER并收回原盒。本次一次行走及有限同意已经结束，赛恩自行决定后续行动，下一次须重新取得本人的当下同意；没有瞬移、永久控制或额外治疗。';
    } else {
      f.note = 'HANDED_OVER';
      closure = '你亲手把已经写过的同一张MD5-NOTE-1实际交给原核册员伊芙，由她当面接住收妥；失败文字也保留，不复制、远程转移或赠送新纸。';
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('原物与本人实际收束', '0行动、0额外灵性。' + closure + '本次收束时间已经预付，真实结果与已付成本保留，不退款、不治疗、不奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'willing-crossing') f.route = 'FREE';
    ctx.note('取消尚未实施的准备', '0行动取消尚未实施的方案；同一原红、蓝筹仍在原分格，原纸没有新增文字，也没有施法。' + (c.caseId === 'willing-crossing' ? '赛恩尚未起步，原标记仍在原盒；本次尚未实施的有限同意同时结束，下一次须重新核实。' : '') + '原观察与已付准备行动保留，不退款、不治疗。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('mentor-disorder-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看有限混乱与实际收束', '原筹当前轨迹、赛恩这一次有限同意与本人实际返回、实付成本和同一原纸交付分别有据。G扮演+25；全普通和平100有实际成本，不伪造能力掌握，不保证原著无风险消化，不提前取得序列4赋予、放大或正式利用。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'willing-crossing') f.route = 'READY';
    ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability! : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `mentor-disorder-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    const closed = p.id === 'paired-trays' ? '同一原红、蓝筹已经按编号实际收回原红、蓝分格。' : p.id === 'willing-crossing' ? '赛恩已经沿原路实际返回原起点，原标记收回原盒，本次有限同意结束。' : '同一已写原纸已经亲手交付伊芙。';
    ctx.note(p.title, resultText(s, p.id) + closed + '本次接触已结束。G扮演+25；' + (r.method === 'ABILITY' ? '真实成功的能力报告给予一次已有知识池单项掌握8。' : '普通方法没有施法，不增加能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    ctx.note('本次有限混乱已经实付', '实际消耗3灵性，只在本次原物或本人已经开始的有限运动上尝试混乱；失败照付，不重抽、不扩大范围，也不保证成功。');
  }
  if (p.id === 'paired-trays') {
    f.markers = 'COLLECTED';
    ctx.note('同一对原筹实际开始并结束运动', '米蕾按本次明确许可同时启动同一MD5-RED-1与MD5-BLUE-1，两枚原筹先实际开始运动，再进行本次核对。原隔栏与封边软盘保持，两筹最终停留并收拢在各自原盘内。' + (r.method === 'ORDINARY' ? '你先等两筹停止，再亲手操作原普通分隔片；这是普通整理，不伪称魔法混乱。' : '能力只对当时已经运动的轨迹作短暂混乱尝试；失败也保留并实际收拢原两筹，不丢失、补造或移出原盘。'));
  } else if (p.id === 'willing-crossing') {
    f.route = 'MARKED';
    ctx.note('原赛恩实际行走并安全停步', '你从原盒取出同一MD5-ROUTE-MARKER，放在本次已核实的原停步点；赛恩依本次明确同意，从原起点实际开始短段行走。' + (r.method === 'ORDINARY' ? '你实际口头澄清原标线，由本人正常行走，普通指路不令他自动走错。' : '只有在他开始横向移动后，才尝试把这次当前运动混乱到前方原停步点，效果仍须一次真实判定。') + '无论核对成败，他都依自己的选择在同一干燥安全短路内实际停步；本次接触与原标记仍在，须停止影响、实际返回并收好原标记。');
  } else {
    const retry = f.note === 'HANDED_OVER'; f.note = 'WRITTEN';
    ctx.note('同一原纸已经实际书写', '伊芙亲手递来同一张MD5-NOTE-1，你接过并普通书写已经实际发生的有限事实。' + (retry ? '之前的失败文字保留，在同一张原纸上核对和更正。' : '没有复制、新造或取得原纸的所有权。') + '核对失败也保留文字，须亲手交付。');
  }
  const difficulty = r.method === 'ABILITY' ? 14 : p.id === 'paired-trays' ? 12 : 10;
  const result = ctx.check('knowledge', difficulty);
  if (success(result.tier)) {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'paired-trays' && r.method === 'ABILITY') f.markers = 'MIXED';
    ctx.note(p.title, resultText(s, p.id) + '本次接触仍在，先0行动实际收束才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, '本次未形成可报告结果，实际行动与已经支付的灵性不返还。' + (p.id === 'paired-trays' ? '同一原红、蓝筹仍实际收拢在各自原软盘内COLLECTED，没有可报告的轨迹混乱或完整普通核对，不重抽。' : p.id === 'willing-crossing' ? '赛恩已经依自己的选择安全停步，本次路线与原标记仍为MARKED；没有可报告的混乱效果或完整普通核对，不虚构强制走错或持续控制。' : '同一原纸已经写过，失败文字实际保留。') + '先0行动实际收束，下一真实周重新准备与核实本次有限同意。' + practiceText(s));
}

export function mentorDisorderActions(s: SliceState): MentorDisorderAction[] {
  if (!active(s)) return [];
  const out: MentorDisorderAction[] = [], m = s.mentorDisorder;
  const add = (id: string, label: string, cost: string, command: MentorDisorderActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('mentor-disorder-buy-gifts', '购买三枚独立原木筹供继承贿赂使用', '0行动 · 60便士 · 不返还已给原物', { type: 'BUY_GIFTS' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'paired-trays' ? '按原编号实际收回同一原红、蓝筹' : p.id === 'willing-crossing' ? '让赛恩实际返回原起点并收好原标记' : '亲手把同一已写原纸交给伊芙', '0行动 · 0额外灵性 · 实际收束', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、原本人和有限边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.ability !== null) add(`${p.id}-ability`, p.id === 'paired-trays' ? '准备原两筹已经运动后的有限混乱' : '核实赛恩本次同意并准备有限路线混乱', '1行动 · 尚未施法 · 实施另3灵性 · 知识14', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'paired-trays' ? '准备等原两筹停止后的普通分隔整理' : p.id === 'willing-crossing' ? '准备普通口头澄清与正常标线行走' : '准备同一张原纸普通书写', `1行动 · 实施0灵性 · 知识${p.id === 'paired-trays' ? 12 : 10}`, { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识14 · 失败照付' : `1行动 · 0灵性 · 知识${p.id === 'paired-trays' ? 12 : 10}`, { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备与本次同意', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已经实际收束的真实有限结果', '1行动 · 先实际收回、返回或交付 · G扮演+25', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('mentor-disorder-reflect', '回看有限混乱、本人选择与实际收束', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('mentor-disorder-encounter-talk', '到原契约铺外院向里斯当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('mentor-disorder-encounter-fight', '到原契约铺外院承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function mentorDisorderCases(s: SliceState): MentorDisorderProjection['cases'] {
  if (!active(s)&&!(s.progression.pathwayId==='black-emperor'&&(s.progression.sequence===4||s.progression.sequence===3))) return [];
  return CASES.map(p => {
    const r = s.mentorDisorder.cases[p.id]!;
    const closed = r.attemptWeek !== null && !r.contactOpen ? p.id === 'paired-trays' ? '本次两枚原筹已经按编号实际收回原红、蓝分格。' : p.id === 'willing-crossing' ? '本次影响已停止，赛恩已经沿原路实际走回原起点，原标记收回原盒，有限同意已结束。' : '同一已写原纸已经亲手交付伊芙，失败文字也保留。' : '';
    let result: string | null = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p.id) : r.attemptWeek !== null ? '上次没有取得可报告结果；实际原筹、赛恩本人及同一原纸保留，已付成本不退。' : r.withdrawals ? '尚未实施的准备与本次有限同意已取消，没有施法。' : null;
    if (result !== null) result += closed + (r.contactOpen ? '本次接触仍在，须0行动实际收束。' : '') + practiceText(s);
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次真实接触尚未结束，须0行动实际收束' : '没有尚未收束的本次接触', closes: r.closes };
  });
}
export function mentorDisorderPractice(s: SliceState): MentorDisorderProjection['practice'] { return { ...s.mentorDisorder.practice }; }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Finite original trajectories, renewed adult consent and real zero-action closure. */
export function validateMentorDisorderLife(s: SliceState): boolean {
  const m = s.mentorDisorder;
  if (!record(m) || !record(m.cases) || !shape(m.cases, MENTOR_DISORDER_CASE_IDS) || !record(m.practice) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promotion = m.promotionWeek ?? s.week;
  if (!shape(f, ['markers', 'route', 'note']) || !['SORTED', 'MIXED', 'COLLECTED'].includes(f.markers) || !['READY', 'MARKED', 'FREE'].includes(f.route) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week) || p.id === 'honest-account' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(source => source === `mentor-disorder-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.status === 'OBSERVED' && r.method !== null)) return false;
    if (r.attemptWeek !== null && (!r.contactOpen && r.closes < 1 || r.closes + (r.contactOpen ? 1 : 0) > r.attemptWeek - promotion + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!active(s) || !['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (m.promotionWeek === null && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const trays = m.cases['paired-trays']!, route = m.cases['willing-crossing']!, note = m.cases['honest-account']!;
  if (f.markers !== (trays.contactOpen ? trays.status === 'EXAMINED' && trays.method === 'ABILITY' ? 'MIXED' : 'COLLECTED' : 'SORTED')) return false;
  if (f.route !== (route.contactOpen ? 'MARKED' : route.status === 'PREPARED' ? 'READY' : route.closes > 0 || route.withdrawals > 0 ? 'FREE' : 'READY')) return false;
  if (f.note !== (note.contactOpen ? 'WRITTEN' : note.attemptWeek !== null ? 'HANDED_OVER' : 'BLANK')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(source => source === 'mentor-disorder-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId==='black-emperor' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)) && ((s.progression.sequence===4||s.progression.sequence===3)?s.fallenEarl.mentorDisorderActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && m.reflected) return false;
  return true;
}
