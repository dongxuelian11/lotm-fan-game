import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyDemonEncounter, blockDemonEncounter, DEMON_ENCOUNTER_STORY } from './encounter.js';
import { validateDemonCommand } from './index.js';
import { DEMON_CASE_IDS, type DemonCommand, type DemonActivityCommand, type DemonAction, type DemonProjection } from './types.js';

const CASES = [
  { id: 'loading-lane', title: '原仓库的有顶通道',
    story: '罗安的原旧货库外传来一阵杂乱脚步声。你仍在已知安全的公共入口，旁边原有一扇可从安全侧观察通道的窗口；原公共出口保持畅通。尚未看清情况，不把动静等同于危险，更不知道任何人的计划。',
    facts: ['原入口、侧窗与公共出口均已在场，可以留在安全侧核实，不必进入有顶通道。', '外面的动静本身不足以证明威胁；不从一个方向感受推断完整计划。'],
    ability: '留在原安全入口，尝试有限危险预感；1行动、2灵性、紧绷+1，意志难度14。只有现场已经实际发生、可能造成近期致命伤害的威胁才符合条件，最多获得有限方向，失败照耗。',
    ordinary: '从原安全入口观察脚步与原侧窗可见动静，取得有限普通线索；1行动、0灵性，不进入未知通道，不声称施法。',
    result: '通过原安全侧窗与罗安当场所见核实：原有顶通道内一名成年陌生人已经持凶器埋伏，正对通道入口做出致命袭击举动。这是当前现场已经实施的威胁，不是预感揭露完整计划。你选择原公共出口绕离并报告，未走进埋伏，未伤害、控制或移动对方。', outcome: 'LANE_VERIFIED' },
  { id: 'wide-door', title: '空练习院与原窄门',
    story: '成年监督员罗安本人同意在原开阔练习院看一次有限自体变化。原窄门仍在原处，另有原本就足够宽的出口；双方保持距离，不以任何人的身体作为试验目标。',
    facts: ['监督员本人在场且同意本次观看，练习院开阔，原窄门不会随你改变。', '本人若暂时增大就不穿原窄门，结束时须恢复正常；普通量门或原宽出口可替代。'],
    ability: '在原开阔练习院暂时增大自己的身体，核对与原窄门的尺寸差；1行动、3灵性、紧绷+1，失败照耗。不得强挤原窄门，0行动实际恢复正常后才离开。',
    ordinary: '普通量取本人和原窄门的尺寸，核对原有宽出口路线；1行动、0灵性，无身体变化，不拆门或移动他人。',
    result: '已核实本人尺寸与同一原窄门的关系；原门未改变，退出采用原有合适路线，身体已经恢复正常。只报告这次有限练习，不声称无敌、穿墙或全部毒火诅咒免疫。', outcome: 'BODY_VERIFIED' },
  { id: 'cold-brazier', title: '已清空的原石火盆',
    story: '原练习院有一只已经清空周边的石火盆，有限试验目标就是这只原盆。普通盖与对照灯本来就在旁边；场内没有作为目标的人或其它可燃物，不对建筑点火。',
    facts: ['原石火盆、原盖、原普通对照灯确实在场；测试不以他人作目标。', '有限火焰可被抵抗或替代，结束时用已经在场的原盖实际熄灭；普通对照不施法。'],
    ability: '在同一原石火盆内产生有限自生火焰，观察能否稳定维持本次有限目标；1行动、3灵性、紧绷+1，失败照耗。原盖收束时间已预付，须另选0行动实际熄灭。',
    ordinary: '用已经在场的原普通灯作照明对照，核对同一空盆；1行动、0灵性，不产生恶魔火焰，不赠送或消耗凭空物品。',
    result: '已经核实同一原石火盆的有限结果，原普通盖与对照灯仍在原处；本次火焰已实际熄灭或普通观察已结束，没有烧伤任何人、点燃建筑或净化污染。', outcome: 'FLAME_VERIFIED' },
] as const;
const LANE_CLUE = '你只取得通往原有顶通道方向的有限线索；尚不知道完整计划或是否确有致命威胁。须先实际结束本次接触，再从原安全侧窗与罗安所见核实。';
const VERIFIED_SOURCE = '从原安全侧窗与罗安当场所见核实：原有顶通道中一名成年陌生人已经持凶器埋伏，正做出针对通道入口的致命袭击举动；没有走近对方。这证明当前实际来源，不揭示其完整计划。可以选择原公共出口绕离并报告。';

export const DEMON_ENVIRONMENT = '以下场景与数值为本作原创G：有限预感实践2灵性，暂时增大或原盆火焰各3灵性，每次能力实践1行动、紧绷+1（上限3），失败也付费；紧绷达到3先花1行动收束欲念，确定减少1，不恢复健康、精神、灵性或良知。普通方法不耗灵性、不加紧绷。实践之后须0行动实际停止接触、恢复身体或用原盖熄灭，收束时间已预付且不退款；随后才能报告或离开。预感线索还须从原安全窗口单独花1行动复核，不能把感觉直接当成真相。三报告与反思的和平100只是有成本的G替代，不是原著的无代价安全保证。' + DEMON_ENCOUNTER_STORY;
export const demonInside = (s: SliceState) => Object.values(s.demon.cases).some(r => r.contactOpen);
export const isDemonActivity = (c: DemonCommand): c is DemonActivityCommand =>
  ['COMPOSE', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'VERIFY', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const active = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 6;

function blocked(s: SliceState, c: DemonActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockDemonEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)&&!(s.progression.pathwayId==='abyss'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))&&c.type==='COMPOSE')) return '先完成恶魔晋升。';
  const m = s.demon, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (demonInside(s)) return '先0行动实际结束本次接触、恢复正常身体或用原盖熄灭火焰。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德罗安的原旧货库。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  if (c.type === 'COMPOSE') return m.strain > 0 ? null : '当前没有可以收束的紧绷，不白耗行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (c.type === 'REFLECT') return m.reflected ? '已回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践未成，下一真实周再重新准备。' : c.method === 'ABILITY' && m.strain >= 3 ? '紧绷已到3，先收束欲念，或选普通方法。' : null;
  if (c.type === 'VERIFY') return c.caseId !== 'loading-lane' ? '此项不需要通道来源复核。' : r.status !== 'EXAMINED' || !['LANE_CLUE', 'VERIFY_FAILED'].includes(r.outcome) ? '先取得有限线索并实际结束接触。' : !m.threat.active ? '当前原通道已没有本次活动来源，不能遥测未来或其它地点。' : r.outcome === 'VERIFY_FAILED' && r.attemptWeek === s.week ? '本周未看清足够证据，下一真实周再从安全窗口复核。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得真实结果，并实际结束本次接触。' : c.caseId === 'loading-lane' && (!m.threat.active || !m.threat.verified || r.outcome !== 'LANE_VERIFIED') ? '有限线索还不能报告为已证实威胁；先从原安全窗口复核。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  if (c.caseId === 'loading-lane' && !m.threat.active) return '原现场当前没有本次活动来源，不能从菜单预知未来。';
  if (r.method === 'ABILITY') {
    if (m.strain >= 3) return '紧绷已到3，先取消准备或收束欲念，不能继续能力实践。';
    const cost = c.caseId === 'loading-lane' ? 2 : 3;
    if (s.spirituality < cost) return `本次能力需要${cost}灵性，不能透支；可取消后采用普通方法。`;
  }
  return null;
}

export function applyDemonActivity(s: SliceState, c: DemonActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateDemonCommand(c) || !isDemonActivity(c)) throw new Error('恶魔活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyDemonEncounter(s, c, ctx); return; }
  const m = s.demon;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1; m.practice.body = 'NORMAL';
    if (m.practice.flame === 'LIT') m.practice.flame = 'EXTINGUISHED';
    ctx.note('实际结束本次接触', c.caseId === 'loading-lane' ? '你留在原安全入口，停止本次预感或普通观察；没有进入有顶通道，也未知道任何人的完整计划。0行动，不退消耗，已有线索还须从原安全窗口核实。' : c.caseId === 'wide-door' ? '你在原开阔练习院实际恢复本人正常身体，再经原有合适路线结束练习；原窄门不变，未强行通过。0行动，不退款、不治疗，紧绷仍保留。' : '你用已经在场的原普通盖实际熄灭本次原石火盆火焰；若用了普通灯对照，则结束观察并把原灯留在原处。收束时间已在本次实践预付，0行动，不退款、不治疗，紧绷仍保留。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消准备，不开始身体变化或火焰；不退之前的行动、灵性或紧绷。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'COMPOSE') {
    m.strain -= 1;
    ctx.note('花时间收束自己的欲念', `花费1行动，停止刺激、重新确认本人当下选择，紧绷确定减少1至${m.strain}/3。健康、精神、灵性、伤势、排异与既有良知变化均未恢复；并不保证后续无失控风险。`); return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('demon-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看有限能力与实际克制', '你把预感线索、现场证据、本人变化、实际停止与普通替代分开记录。G扮演+25；和平100是本作有成本替代，不是原著的无代价安全消化保证，不恢复良知或自动消除紧绷。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    // Finite authored G source: the hostile adult has already begun waiting in the original covered route
    // for a near-term deadly attack. This private producer is not a global prediction or public plan reveal.
    if (p.id === 'loading-lane') m.threat.active = true;
    ctx.note(p.title, p.story + p.facts.join(' ')); return;
  }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'VERIFY') {
    r.attemptWeek = s.week;
    const result = ctx.check('perception', 12);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      m.threat.verified = true; r.outcome = 'LANE_VERIFIED'; ctx.note('原窗口的实际来源核实', VERIFIED_SOURCE);
    } else {
      r.outcome = 'VERIFY_FAILED'; ctx.note('原窗口的证据仍不充分', '你和罗安留在原安全侧窗，没有看清足以确认来源的证据。1行动已付，不把猜测报告为事实，不进入未知通道；下一真实周可从同一安全侧窗重试。');
    }
    return;
  }
  if (c.type === 'REPORT') {
    if (p.id === 'loading-lane') { m.threat.avoided = true; m.threat.active = false; }
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`demon-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次采用普通方法，没有虚构施法。' : '') + '本次接触已结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    const cost = p.id === 'loading-lane' ? 2 : 3;
    s.spirituality -= cost; m.strain += 1;
    if (p.id === 'wide-door') m.practice.body = 'ENLARGED';
    if (p.id === 'cold-brazier') m.practice.flame = 'LIT';
    ctx.note('有限能力实践已经开始', `本次实际消耗${cost}灵性、紧绷+1至${m.strain}/3。${p.id === 'wide-door' ? '本人已暂时增大，原窄门不变；结果失败也要实际恢复正常。' : p.id === 'cold-brazier' ? '原石火盆已有有限火焰，稳定测试仍可能失败；必须用原盖实际熄灭。' : '留在原安全入口尝试有限感应；不直接获得完整计划。'}不退款、不治疗，须显式0行动结束接触。`);
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'perception', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.id === 'loading-lane' ? 'LANE_CLUE' : p.outcome;
    if (p.id === 'loading-lane') {
      m.threat.noticed = r.method === 'ABILITY';
      ctx.note(p.title, (r.method === 'ABILITY' ? '一次有限预感指向原有顶通道。' : '普通观察发现动静集中在原有顶通道。') + LANE_CLUE);
    } else ctx.note(p.title, '本次有限测试已取得结果，但接触仍然继续，尚未收束。' + (p.id === 'wide-door' && r.method === 'ABILITY' ? '本人仍暂时增大，不能穿原窄门；先实际恢复正常。' : p.id === 'cold-brazier' && r.method === 'ABILITY' ? '同一原火盆仍有火焰；先用原盖实际熄灭。' : '先实际结束普通观察。'));
  } else {
    r.status = 'OBSERVED';
    ctx.note(p.title, '本次没有取得可报告结果，实际成本与当前接触保留。先0行动停止预感、恢复身体或用原盖熄灭；下一真实周可重新准备，不以失败为理由追加危险试验。');
  }
}

export function demonActions(s: SliceState): DemonAction[] {
  if (!active(s)) return [];
  const out: DemonAction[] = [];
  const add = (id: string, label: string, cost: string, command: DemonActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('demon-compose', '花时间收束自己的欲念', '1行动 · 紧绷−1 · 不恢复健康、精神或灵性', { type: 'COMPOSE' });
  for (const p of CASES) {
    const r = s.demon.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'wide-door' ? '恢复正常身体并结束接触' : p.id === 'cold-brazier' ? '用原盖熄灭火焰并结束接触' : '停止本次预感或普通观察', '0行动 · 实际收束 · 不退款、不消除紧绷', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场与当前边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.id === 'loading-lane' ? '准备有限危险预感' : p.id === 'wide-door' ? '准备本人暂时增大' : '准备原盆有限火焰', '1行动 · 尚未施法', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'loading-lane' ? '准备安全侧普通观察' : p.id === 'wide-door' ? '准备普通量门与原宽出口' : '准备原普通灯对照', '1行动 · 不耗灵性、不加紧绷', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际完成本次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.id === 'loading-lane' ? 2 : 3}灵性 · 紧绷+1 · 失败照耗` : '1行动 · 0灵性 · 不加紧绷 · 仍可失败', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') {
      if (p.id === 'loading-lane' && !s.demon.threat.verified) add(`${p.id}-verify`, '从原安全窗口与罗安所见复核', '1行动 · 先结束接触 · 只核实当前现场', { type: 'VERIFY', caseId: p.id });
      add(`${p.id}-report`, p.id === 'loading-lane' ? '选择原公共出口绕离并报告证据' : '报告实际结果与有限边界', '1行动 · 先实际收束并完成必要复核', { type: 'REPORT', caseId: p.id });
    }
  }
  if (!s.demon.reflected) add('demon-reflect', '回看预感、证据与实际克制', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.demon.encounter.status === 'AVAILABLE') {
    add('demon-encounter-talk', '到原旧货库外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('demon-encounter-fight', '到原旧货库外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function demonCases(s: SliceState): DemonProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId==='abyss'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) return [];
  return CASES.map(p => {
    const r = s.demon.cases[p.id]!;
    let result: string | null = null;
    if (p.id === 'loading-lane' && r.status === 'EXAMINED') result = s.demon.threat.verified ? VERIFIED_SOURCE : LANE_CLUE + (r.outcome === 'VERIFY_FAILED' ? '本周复核未看清足够证据，下一真实周再试。' : '');
    else if (r.status === 'RESOLVED') result = p.result;
    else if (r.status === 'EXAMINED') result = r.contactOpen ? '已取得有限测试结果，但当前接触仍在继续；须先实际恢复正常身体、熄灭原盆火焰或结束普通观察。' : p.result;
    else if (r.attemptWeek !== null) result = '上次没有形成可报告结果，实际成本保留；先收束接触，下一真实周可重新准备。';
    else if (r.withdrawals) result = '准备已取消，未开始新的能力消耗。';
    if (result && ['EXAMINED', 'RESOLVED'].includes(r.status) && r.method === 'ORDINARY') result += '本次为普通方法，没有施法。';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束；必须实际停止、恢复身体或熄灭' : '身体正常、无持续火焰，无尚未结束的接触', closes: r.closes };
  });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateDemonLife(s: SliceState): boolean {
  const m = s.demon;
  if (!record(m) || !record(m.cases) || !shape(m.cases, DEMON_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  if (!integer(m.strain, 0, 3) || !record(m.practice) || !shape(m.practice, ['body', 'flame']) || !['NORMAL', 'ENLARGED'].includes(m.practice.body) || !['NONE', 'LIT', 'EXTINGUISHED'].includes(m.practice.flame)) return false;
  if (!record(m.threat) || !shape(m.threat, ['active', 'noticed', 'verified', 'avoided']) || Object.values(m.threat).some(v => typeof v !== 'boolean')) return false;
  const promotion = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0, enlarged = false, lit = false;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `demon-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1 || r.outcome !== p.outcome) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) {
      if (r.attemptWeek === null || r.method === null) return false;
      if (p.id === 'loading-lane' ? !['LANE_CLUE', 'VERIFY_FAILED', 'LANE_VERIFIED'].includes(r.outcome) : r.outcome !== p.outcome) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
      if (r.method === 'ABILITY') { if (m.strain < 1) return false; enlarged = p.id === 'wide-door'; lit = p.id === 'cold-brazier'; }
      if (p.id === 'loading-lane' && ['VERIFY_FAILED', 'LANE_VERIFIED'].includes(r.outcome)) return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
  }
  if ((m.practice.body === 'ENLARGED') !== enlarged || (m.practice.flame === 'LIT') !== lit || open > 1 || prepared > 1 || open && prepared) return false;
  const brazier = m.cases['cold-brazier']!;
  if (m.practice.flame === 'EXTINGUISHED' && (brazier.attemptWeek === null || brazier.closes < 1)) return false;
  if (brazier.method === 'ABILITY' && brazier.attemptWeek !== null && !brazier.contactOpen && m.practice.flame !== 'EXTINGUISHED') return false;
  const lane = m.cases['loading-lane']!, t = m.threat;
  if (t.active !== (lane.status !== 'AVAILABLE' && lane.status !== 'RESOLVED') || t.avoided !== (lane.status === 'RESOLVED')) return false;
  if (t.verified !== (lane.outcome === 'LANE_VERIFIED') || t.noticed !== (lane.method === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(lane.status))) return false;
  if (t.verified && (lane.contactOpen || lane.closes < 1) || t.avoided && !t.verified) return false;
  if (s.seer.completedSources.filter(x => x === 'demon-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if ((active(s)||(s.progression.pathwayId==='abyss'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.desireApostle.demonActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (m.strain !== 0 || m.practice.body !== 'NORMAL' || m.practice.flame !== 'NONE' || Object.values(t).some(Boolean) || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
