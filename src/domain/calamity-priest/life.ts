import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyCalamityPriestEncounter, blockCalamityPriestEncounter, CALAMITY_PRIEST_ENCOUNTER_STORY } from './encounter.js';
import { validateCalamityPriestCommand } from './index.js';
import { CALAMITY_PRIEST_CASE_IDS, type CalamityPriestCommand, type CalamityPriestActivityCommand, type CalamityPriestAction, type CalamityPriestProjection } from './types.js';

const CASES = [
  { id: 'rain-rack', title: '漏雨处的原货架',
    story: '报时铺储物间原屋面正在漏雨，同一原货架支撑因受潮松动，原箱仍在低层。艾妲许可核对这处既有问题，并用原推车挪开原箱、用原固定件加固；不创造另一场灾难供练习。',
    facts: ['原雨痕、原货架、原箱、推车与固定件确实在场，没有人在货架下。', '有限预感不能代替实际查看支撑；后续仍核对同一原物，已修好的支撑不会凭空再次变坏。'],
    ability: '集中辨认本次有限灾祸征兆，再实际查看原受潮支撑、原箱位置和可用固定件；1行动、3灵性。即使判断未成，也须实际挪开原箱、加固支撑后结束接触。',
    ordinary: '普通查看同一原雨痕与支撑松动，用原推车、固定件处理原箱与支撑；1行动、0灵性，不假称知道未来。',
    result: '已把本次所见与有限预感分开记录；原箱用原推车挪到原干燥低位，原支撑实际固定。只确认眼前修整结果，不能由此预知所有未来灾祸。', outcome: 'RACK_SECURED' },
  { id: 'isolated-board', title: '获准隔开的原小板',
    story: '物主艾妲明确允许在原工作间进行这次有限试验：只有她的一块原小板、原支撑与原接物盘。原操作区已经隔开，旁人清走，双方留在原挡栏外；不伤害活物、不制造新物件。',
    facts: ['艾妲明确许可本次原物试验；重新准备必须实际将同一原小板复位、支好，并再次清空旁人。', '本次招灾只可能让这块原小板落入原接物盘一次；当前G布置不是一般免伤保证，也不能把板带入外院战斗。'],
    ability: '实际复位同一小板与有限支撑，核实原接物盘和隔开区域后，尝试一次招灾；实践1行动、3灵性。结果可失败，原板仍可能不稳，必须实际收妥，不能补出新板。',
    ordinary: '实际准备同一小板、原支撑、原接物盘并清空旁人，使用原夹具普通下放小板；实践1行动、0灵性，仍可能未能完成记录，不假称招灾。',
    result: '这次原小板一次落入或普通下放到原接物盘的结果已记录；同一原小板与支撑实际卸下、平放固定，原物没有补充、复制或转移给玩家。', outcome: 'BOARD_RECORDED' },
  { id: 'willing-focus', title: '佩林自愿的短暂试验',
    story: '成年记录员佩林明确同意在原报时铺安静座位做一次短暂、轻微的精神风暴试验。双方先核实这次同意与停止信号，佩林保留自己的意见，不回答秘密或作证；他可以要求结束。',
    facts: ['佩林为原创成年自愿者，许可仅限这一次短暂轻微试验；本次效果来自精神风暴，非强制服从。', '先核实当前同意，再准备停止信号；结束须停止施加并实际等候短效过去，不改写记忆、不迫供或声称治疗。'],
    ability: '再次确认佩林当下同意和停止信号，作一次短暂轻微精神干扰；实践1行动、3灵性，可因抵抗而未形成结果。必须停止施加并等待已有短效实际结束。',
    ordinary: '佩林同意普通注意力对照：用原纸页作短时辨认并记录本人回答；实践1行动、0灵性，不施加精神风暴，不从普通回答推断其秘密。',
    result: '仅记录佩林自愿描述的本次短暂体验或普通纸页对照。若施加精神风暴，已实际停止并等候本次短效过去；没有强制服从、秘密供述、记忆改写或治疗。', outcome: 'FOCUS_RECORDED' },
] as const;

export const CALAMITY_PRIEST_ENVIRONMENT = '以下现场、流程与数值均为原创G：观察、准备、实践、报告各1行动；能力实践额外3灵性，普通方法0灵性，失败照付。察觉需要现实核实；招灾只作用于获准隔开的原小板，准备须实际复位支撑并清空旁人；精神风暴只向当前明确自愿的成年佩林作短暂轻微试验。实践后0行动显式收束，实际挪箱固定原架、收妥同一原板、或停止并等候短效结束，时间已预付，不退款、不治疗。失败也保留接触直到真实收束，下一真实周才可重试。三份报告各25扮演，反思25，和平100是有成本的G玩法；有限场地布置不保证其它场景自身与他人安全。' + CALAMITY_PRIEST_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 6;
export const calamityPriestInside = (s: SliceState) => Object.values(s.calamityPriest.cases).some(r => r.contactOpen);
export const isCalamityPriestActivity = (c: CalamityPriestCommand): c is CalamityPriestActivityCommand =>
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function blocked(s: SliceState, c: CalamityPriestActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockCalamityPriestEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成灾祸教士晋升。';
  const m = s.calamityPriest, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (calamityPriestInside(s)) return '先0行动实际稳固原架、收妥原板，或停止并等候本次短效结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德艾妲的原报时铺。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践未成，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得真实结果，并实际结束本次接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实践需要3灵性，不能透支；可取消准备后选择普通方法。' : null;
}

export function applyCalamityPriestActivity(s: SliceState, c: CalamityPriestActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateCalamityPriestCommand(c) || !isCalamityPriestActivity(c)) throw new Error('灾祸教士活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyCalamityPriestEncounter(s, c, ctx); return; }
  const m = s.calamityPriest;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'rain-rack') m.practice.hazard = 'SECURED';
    if (c.caseId === 'isolated-board') m.practice.board = 'SECURED';
    if (c.caseId === 'willing-focus' && m.practice.contact === 'FOCUSED') m.practice.contact = 'RELEASED';
    ctx.note('实际结束本次接触', c.caseId === 'rain-rack' ? '你停止集中注意，用原推车把同一原箱实际移到原干燥低位，以原固定件加固同一原支撑；即使判断失败，也完成这次普通避险动作。已经修好的货架不再被重置为新的危险。0行动，不退款、不治疗。' : c.caseId === 'isolated-board' ? '你停止这次招灾或普通操作，用原夹具实际卸下不稳支撑，将同一原小板从支撑或原接物盘取下，平放固定并收妥。原小板、原支撑和原盘仍归艾妲，没有补充或复制物件。0行动，收束时间已预付，不退款、不治疗。' : '你实际停止向佩林施加本次精神干扰，并和他等候这段短暂眩晕或混乱实际过去；试验失败也不继续刺激。若为普通方法，则结束原纸页对照。佩林保留自己的意愿和记忆；不是治疗或任意抹除精神效果。0行动，收束时间已预付，不退款。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'isolated-board') m.practice.board = 'SECURED';
    ctx.note('取消尚未实施的准备', c.caseId === 'isolated-board' ? '0行动实际卸下本次支好的原板与支撑，平放固定并收妥同一原物；没有实施招灾、不补新板，不退已付准备行动。' : '0行动取消尚未实施的准备，未开始新的能力消耗，不退已经花费的观察或准备行动。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('calamity-priest-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看灾祸、现实与本人的意愿', '你把有限征兆、实际观察、原物操作、本人自愿与实际结束分别记录。G扮演+25；和平100有真实成本，不意味着所有灾难可被预知、自身与他人总能避险，或可以操控幸运和意愿。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'isolated-board') m.practice.board = 'RESTING';
    ctx.note('准备本次有限方案', (p.id === 'isolated-board' ? '艾妲再次许可本次使用；同一原小板已实际复位在原有限支撑上，原夹具继续固定，原接物盘就位，旁人已清空并在原挡栏外；此时原板仍稳固，尚未释放夹具。取消也须实际收妥同一原板。' : p.id === 'willing-focus' ? '佩林再次明确同意本次短暂轻微试验，双方核实停止信号。' : '') + (c.method === 'ABILITY' ? p.ability : p.ordinary)); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`calamity-priest-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次采用普通方法，没有虚构施法或预言。' : '') + '本次接触已实际结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'isolated-board') { m.practice.board = 'UNSTABLE'; ctx.note('开始原板的一次实际操作', '再次核对清场与原接物盘，原夹具实际松开，同一原板进入本次有限支撑的不稳状态；从此必须显式收妥，不能离开或重抽。'); }
  if (p.id === 'rain-rack' && m.practice.hazard !== 'SECURED') m.practice.hazard = 'NOTICED';
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    if (p.id === 'willing-focus') m.practice.contact = 'FOCUSED';
    ctx.note('本次有限实践已经开始', '实际消耗3灵性。' + (p.id === 'rain-rack' ? '本次有限征兆只指向原雨漏支撑，随后实际查看支撑、原箱与固定件，不能由预感直接宣布全部未来。' : p.id === 'isolated-board' ? '对获准隔开的同一原小板尝试一次招灾，只可能作用于这次已有布置，不添加新灾源。' : '向当前明确自愿的成年佩林施加一次短暂轻微精神风暴；可能未形成可辨结果，仍须停止并等候已有短效结束。') + '失败照耗，须显式0行动收束，不退成本。');
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'perception', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'isolated-board') m.practice.board = 'FALLEN';
    ctx.note(p.title, p.id === 'rain-rack' ? '你实际看清原雨痕、支撑松动与原箱位置，并与本次有限线索逐项核对；先实际挪开原箱、固定支撑后才可报告。已修整的原架只作现况复核，不制造新险情。' : p.id === 'isolated-board' ? (r.method === 'ABILITY' ? '同一原小板因本次招灾实际落入原接物盘一次。' : '你以原夹具把同一原小板实际下放至原接物盘。') + '原物已改变位置，接触仍在，须实际平放固定并收妥，不能重抽或补新板。' : (r.method === 'ABILITY' ? '佩林自愿描述了本次短暂轻微眩晕与混乱，没有被强迫作答或改写意愿；短效仍须实际等候过去。' : '你记录佩林自愿完成的原纸页对照，只得本次普通结果，未施加精神风暴。') + '接触仍在，先实际结束再报告。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次未取得可报告结果，已付行动与灵性保留，当前接触仍在。' + (p.id === 'rain-rack' ? '现场核对未完整，仍须用原工具挪箱并固定原支撑。' : p.id === 'isolated-board' ? '本次未落入原盘或未完成普通下放，原小板仍在不稳支撑上，必须实际卸下并固定收妥。' : '佩林可能抵抗或未能描述明确结果；先停止施加并实际等候已有短效结束，不追加刺激或迫供。') + '先0行动收束，下一真实周才可重新准备。');
  }
}

export function calamityPriestActions(s: SliceState): CalamityPriestAction[] {
  if (!active(s)) return [];
  const out: CalamityPriestAction[] = [];
  const add = (id: string, label: string, cost: string, command: CalamityPriestActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.calamityPriest.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'rain-rack' ? '挪开原箱并实际加固原支撑' : p.id === 'isolated-board' ? '实际卸下、固定并收妥原小板' : '停止施加并等候本次短效结束', '0行动 · 实际收束 · 不退款、不治疗', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场与当前边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.id === 'rain-rack' ? '准备有限察觉与现实复核' : p.id === 'isolated-board' ? '复位原板、清场并准备招灾' : '核实佩林同意并准备短暂试验', '1行动 · 尚未施法', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备原物的普通核对方法', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际完成本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 失败照耗' : '1行动 · 0灵性 · 仍可失败', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, p.id === 'isolated-board' ? '实际收妥原板，取消准备' : '取消尚未实施的准备', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际结果与有限边界', '1行动 · 先实际结束接触', { type: 'REPORT', caseId: p.id });
  }
  if (!s.calamityPriest.reflected) add('calamity-priest-reflect', '回看征兆、原物与本人意愿', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.calamityPriest.encounter.status === 'AVAILABLE') {
    add('calamity-priest-encounter-talk', '到原报时铺外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('calamity-priest-encounter-fight', '到原报时铺外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function calamityPriestCases(s: SliceState): CalamityPriestProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId==='wheel'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) return [];
  return CASES.map(p => {
    const r = s.calamityPriest.cases[p.id]!;
    let result: string | null = r.status === 'RESOLVED' ? p.result : r.status === 'EXAMINED' ? r.contactOpen ? '已取得本次有限结果，但当前接触仍在；先实际稳固原物，或停止并等候短效结束。' : p.result : r.attemptWeek !== null ? '上次未形成可报告结果；成本保留，接触须先收束，下一真实周可重新准备。' : r.withdrawals ? '尚未实施的准备已经取消；若支好原小板，已经实际收妥，没有新能力消耗。' : null;
    if (result && ['EXAMINED', 'RESOLVED'].includes(r.status) && r.method === 'ORDINARY') result += '本次为普通方法，没有施法或预言。';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束，须实际收束' : '没有未收束的本次接触；已准备的原板仍须实施或实际收妥', closes: r.closes };
  });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export function validateCalamityPriestLife(s: SliceState): boolean {
  const m = s.calamityPriest;
  if (!record(m) || !record(m.cases) || !shape(m.cases, CALAMITY_PRIEST_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  if (!record(m.practice) || !shape(m.practice, ['hazard', 'board', 'contact']) || !['UNASSESSED', 'NOTICED', 'SECURED'].includes(m.practice.hazard) || !['RESTING', 'UNSTABLE', 'FALLEN', 'SECURED'].includes(m.practice.board) || !['NONE', 'FOCUSED', 'RELEASED'].includes(m.practice.contact)) return false;
  const promotion = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `calamity-priest-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1 || r.outcome !== p.outcome) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const rack = m.cases['rain-rack']!, board = m.cases['isolated-board']!, focus = m.cases['willing-focus']!;
  const expectedHazard = rack.closes > 0 ? 'SECURED' : rack.contactOpen ? 'NOTICED' : 'UNASSESSED';
  if (m.practice.hazard !== expectedHazard) return false;
  const expectedBoard = board.status === 'PREPARED' ? 'RESTING' : board.contactOpen && board.status === 'OBSERVED' ? 'UNSTABLE' : board.contactOpen && board.status === 'EXAMINED' ? 'FALLEN' : board.closes > 0 || board.withdrawals > 0 ? 'SECURED' : 'RESTING';
  if (m.practice.board !== expectedBoard) return false;
  const focused = focus.contactOpen && focus.method === 'ABILITY';
  if ((m.practice.contact === 'FOCUSED') !== focused) return false;
  if (focus.attemptWeek === null && m.practice.contact !== 'NONE') return false;
  if (m.practice.contact === 'RELEASED' && (focus.attemptWeek === null || focus.closes < 1)) return false;
  if (focus.method === 'ABILITY' && focus.attemptWeek !== null && !focus.contactOpen && focus.status !== 'PREPARED' && m.practice.contact !== 'RELEASED') return false;
  if (s.seer.completedSources.filter(x => x === 'calamity-priest-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if ((active(s)||(s.progression.pathwayId==='wheel'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.winner.calamityPriestActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (m.practice.hazard !== 'UNASSESSED' || m.practice.board !== 'RESTING' || m.practice.contact !== 'NONE' || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
