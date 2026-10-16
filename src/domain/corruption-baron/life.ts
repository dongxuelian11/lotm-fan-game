import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyBriberActivity } from '../briber/life.js';
import { applyCorruptionBaronEncounter, blockCorruptionBaronEncounter, CORRUPTION_BARON_ENCOUNTER_STORY } from './encounter.js';
import { validateCorruptionBaronCommand } from './index.js';
import { CORRUPTION_BARON_CASE_IDS, type CorruptionBaronCommand, type CorruptionBaronActivityCommand, type CorruptionBaronAction, type CorruptionBaronProjection, type CorruptionBaronCaseId } from './types.js';

const CASES = [
  { id: 'clause-order', title: '门前原队列与核册顺序',
    story: '契约铺核册员伊芙已经向等候者说明“依原队列进门，再按入门顺序核册”。米蕾许可在这一既有安排内作一次短时核对：只把当前两份原册的核查先后暂时调换，入门队列与册页归属不改，也不修改正式契约。',
    facts: ['原话、原队列和两份原册都已存在；不会凭空出现新规程或新等候者。', '扭曲只短暂偏转当前核册次序，可遭抵抗；实际结束时须停止施加、核对原册并恢复原次序。'],
    ability: '准备针对已经说出的核册安排作一次有限扭曲；此时原次序仍保持，尚未施法。实际实践另需1行动、3灵性，成功也只是暂调当前两册先后。',
    ordinary: '向伊芙提出同样的临时调整，由她当面自行决定；普通方法不施法，仍可被拒绝。实践1行动、0灵性。',
    result: '两份原册本次核对的先后已真实记录；已结束临时调整并恢复原核册顺序，入门队列、原册归属与正式契约没有被重写。', outcome: 'ORDER_RECORDED' },
  { id: 'rolling-marker', title: '原木球在封闭托盘内滚动',
    story: '米蕾取出同一枚编号原木球和封闭安全托盘。木球原先停在托盘起点卡槽，侧袋与连续滚道均已存在，盖栏已固定。她许可一次真实滚动对照：只有木球开始滚动后，才能尝试把现有运动偏向原侧袋。',
    facts: ['原木球只在封闭托盘内，准备时卡槽保持固定；没有松动危险或跨周悬置运动。', '必须实际释放卡槽产生原有滚动，再偏转连续路径；没有瞬移、凭空加速、复制木球或赋予物件新能力。'],
    ability: '核对原侧袋、封闭盖栏与卡槽，原木球保持停稳；实践时才放开卡槽，对已经开始的滚动尝试有限扭曲，另耗1行动、3灵性。',
    ordinary: '核对相同原物，木球仍固定；实践时使用原导向片普通引导已有滚动，1行动、0灵性。没对准仍算失败，必须收停。',
    result: '同一原木球确已沿托盘内的连续路径进入原侧袋，本次路径完成记录后已经取回原卡槽并固定收稳。原物仍归米蕾，没有瞬移、复制或新增库存。', outcome: 'ROLL_RECORDED' },
  { id: 'agreed-route', title: '赛恩已有的短段递送路线',
    story: '成年递送员赛恩明确自愿在契约铺划定区域内做一次短时路线试验。他本来就要把自己的原册从柜台送到原架，侧边短路也已经存在。他保留停止信号和随时离开的权利；许可仅限这一次短段，不回答秘密或承诺后续效劳。',
    facts: ['赛恩是原创成年自愿者，原递送意图、原册、起点和目的地已经存在；未开始行走时不凭空替他创造动作。', '只能暂时偏转当前约定区域内的路线，抵抗与拒绝仍可能发生；结束要停止施加、等待短效过去，让本人恢复自由选择。'],
    ability: '核实赛恩当前同意、范围与停止信号；准备时赛恩尚未起步。实践中他按已有意图开始行走后，尝试一次短时路线偏转，1行动、3灵性。',
    ordinary: '不施用扭曲，在赛恩按原计划起步后普通提出走原侧路的建议，由他自行决定；1行动、0灵性，可以拒绝。',
    result: '赛恩在本次约定区域内实际走过原侧路，本人的原册没有易主。你已经停止施加并等候本次短效结束或结束普通指路，他恢复自由选择并自行离开，不形成长期服从。', outcome: 'ROUTE_RECORDED' },
] as const;

export const CORRUPTION_BARON_ENVIRONMENT = '以下现场、流程与数值均为原创G：观察、准备、实践、报告各1行动；能力实践额外3灵性，普通方法0灵性，失败照付。PREPARE只保留稳定的原安排、卡住的原木球与尚未起步的自愿者；PERFORM才开始短时接触。实践后必须0行动显式收束，实际恢复原核册顺序、把同一原木球收停固定、或停止施加并等候短效结束，让本人恢复自由。失败同样保留接触，可CLOSE收束，或WITHDRAW实际结束并放弃本次结果；不退成本、不治疗，下周才可重试。三份报告各25扮演，反思25，和平100是有真实成本的G玩法。能力只有限扭曲已有语言、行动与意图，不保证服从、不瞬移，不提前开放序列5混乱或序列4正式放大、利用。' + CORRUPTION_BARON_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 6;
export const corruptionBaronInside = (s: SliceState) => Object.values(s.corruptionBaron.cases).some(r => r.contactOpen);
export const isCorruptionBaronActivity = (c: CorruptionBaronCommand): c is CorruptionBaronActivityCommand =>
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'BUY_GIFTS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function blocked(s: SliceState, c: CorruptionBaronActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockCorruptionBaronEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成腐化男爵晋升。';
  const m = s.corruptionBaron, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (c.type === 'WITHDRAW' && r?.contactOpen) return null;
  if (corruptionBaronInside(s)) return '先0行动恢复原安排、实际收停原木球或停止并等候路线短效结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德米蕾的原契约铺。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备或待结束的接触。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (c.type === 'BUY_GIFTS') return s.cash < 60 ? '三枚独立原木筹需要60便士。' : null;
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践已结束，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得真实结果，并实际结束本次接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实践需要3灵性，不能透支；可取消准备后选择普通方法。' : null;
}

function preparePractice(s: SliceState, id: CorruptionBaronCaseId): void {
  const p = s.corruptionBaron.practice;
  if (id === 'clause-order') p.clauseOrder = 'ORIGINAL';
  if (id === 'rolling-marker') p.marker = 'CRADLED';
  if (id === 'agreed-route') p.route = 'READY';
}
function finishPractice(s: SliceState, id: CorruptionBaronCaseId, ctx: SeerContext, wasOpen: boolean): void {
  const p = s.corruptionBaron.practice;
  if (id === 'clause-order') p.clauseOrder = 'RESTORED';
  if (id === 'rolling-marker') p.marker = 'STOPPED';
  if (id === 'agreed-route') p.route = 'FREE';
  if (!wasOpen) {
    ctx.note('收起尚未实施的准备', id === 'clause-order' ? '原核册次序始终未改，收起临时调整方案；没有发生扭曲或新的接触。' : id === 'rolling-marker' ? '同一原木球始终卡在原卡槽，实际复核卡扣并收好导向片；没有释放或开始滚动。' : '赛恩尚未按试验起步，你撤回本次试验请求，让他自由决定接下来的行程；没有产生路线短效。');
    return;
  }
  ctx.note('实际结束本次有限实践', id === 'clause-order'
    ? '你停止本次扭曲或普通临时调整，与伊芙逐册核对并恢复原核册次序；原队列和正式契约未改变。0行动，收束时间已预付，不退款、不治疗。'
    : id === 'rolling-marker'
      ? '你停止施加扭曲或使用导向片，等封闭托盘内的同一原木球停止，再把原球从原滚道或侧袋取回起点卡槽并固定收稳。原物仍归米蕾，不瞬移、不复制、不入玩家库存。0行动，不退成本。'
      : '你实际停止本次路线扭曲并与赛恩等候已有短效过去；普通方法则结束临时指路。赛恩保有原册，恢复自由决定是否继续递送或离开，不再接受本次试验要求。0行动，时间已预付，不退款、不治疗。');
}

export function applyCorruptionBaronActivity(s: SliceState, c: CorruptionBaronActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateCorruptionBaronCommand(c) || !isCorruptionBaronActivity(c)) throw new Error('腐化男爵活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyCorruptionBaronEncounter(s, c, ctx); return; }
  if (c.type === 'BUY_GIFTS') { applyBriberActivity(s, c, ctx, award); return; }
  const m = s.corruptionBaron;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!, wasOpen = r.contactOpen;
    finishPractice(s, c.caseId as CorruptionBaronCaseId, ctx, wasOpen);
    if (wasOpen) { r.contactOpen = false; r.closes += 1; }
    if (c.type === 'WITHDRAW') {
      r.status = 'OBSERVED'; r.method = null; r.outcome = 'NONE'; r.withdrawals += 1;
      ctx.note('取消本次方案', wasOpen ? '本次接触已实际结束，放弃尚未报告的结果，原行动与灵性成本保留；下一真实周才可重试。' : '尚未实施的方案已取消；原安排、原木球或本人都保持稳定，不施法、不退准备行动。');
    }
    return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('corruption-baron-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看已有安排、真实行动与短时影响', '你把原有语言安排、连续运动、本人原有意图与本次有限偏转分开记录，也记录实际恢复、收停与放行。G扮演+25；有限扭曲不创造事实或永久支配人格，更不等于序列5混乱、序列4正式放大或利用。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; preparePractice(s, p.id);
    ctx.note('准备本次有限方案', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '此时原安排仍在、原物稳定、没有新接触；即使这是本周最后行动，也不会把运动或短效留到下一周。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`corruption-baron-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次使用普通方法，没有虚构施法。' : '') + '本次接触已实际结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'clause-order') m.practice.clauseOrder = 'PENDING';
  if (p.id === 'rolling-marker') m.practice.marker = 'ROLLING';
  if (p.id === 'agreed-route') m.practice.route = 'MOVING';
  ctx.note('本次原有行动实际开始', p.id === 'clause-order'
    ? '伊芙按照已说出的原安排开始当前两册的核查，现有顺序成为本次有限作用对象；没有改写合同或队列。'
    : p.id === 'rolling-marker'
      ? '再次检查原封闭托盘，你实际释放起点卡槽；同一原木球先沿原滚道真实滚动，此后才尝试偏转。'
      : '再次确认赛恩自愿与停止信号后，他持本人原册按已有递送意图实际起步；此后才尝试偏转本段路线。');
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    ctx.note('有限扭曲的成本已付', '实际消耗3灵性，仅对眼前已有语言、运动或行动意图作一次短暂且可抵抗的扭曲。失败照耗，必须显式0行动收束；不凭空创造动作、不瞬移、不放大已有作用。');
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'perception', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'clause-order') m.practice.clauseOrder = 'ADJUSTED';
    if (p.id === 'rolling-marker') m.practice.marker = 'SIDE_POCKET';
    if (p.id === 'agreed-route') m.practice.route = 'DIVERTED';
    ctx.note(p.title, p.id === 'clause-order'
      ? (r.method === 'ABILITY' ? '本次扭曲暂时偏转原话所指的两册核对次序。' : '伊芙自行同意并实际临时调换两册核对次序。') + '原安排尚待恢复，先实际结束再报告。'
      : p.id === 'rolling-marker'
        ? (r.method === 'ABILITY' ? '已有滚动被有限偏转，' : '原导向片普通引导已有滚动，') + '同一原木球沿连续路径进入原侧袋，没有消失后出现在别处。先实际收停固定再报告。'
        : (r.method === 'ABILITY' ? '本次短暂扭曲偏转了赛恩正在执行的原递送意图，他实际走上约定的原侧路。' : '赛恩自行采纳普通建议，实际走过原侧路。') + '本人仍保留原册，必须停止并等候短效结束或结束普通指路，让他恢复自由。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次未取得可报告结果，已付行动与灵性保留，当前接触仍在。' + (p.id === 'clause-order' ? '伊芙抵抗了影响或拒绝建议；仍须停止临时干预并核对恢复原次序。' : p.id === 'rolling-marker' ? '同一原木球仍在封闭托盘原滚道中，未进入侧袋；必须实际等候收停并固定。' : '赛恩抵抗了影响或没有采纳建议；必须停止并等候已有短效结束，让他自由离开。') + '先0行动CLOSE或WITHDRAW实际收束，下一真实周再准备。');
  }
}

export function corruptionBaronActions(s: SliceState): CorruptionBaronAction[] {
  if (!active(s)) return [];
  const out: CorruptionBaronAction[] = [];
  const add = (id: string, label: string, cost: string, command: CorruptionBaronActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('corruption-baron-buy-gifts', '购买三枚独立原木筹', '0行动 · 60便士 · 进入同一贿赂者原库存', { type: 'BUY_GIFTS' });
  for (const p of CASES) {
    const r = s.corruptionBaron.cases[p.id]!;
    if (r.contactOpen) {
      add(`${p.id}-close`, p.id === 'clause-order' ? '恢复原核册顺序，结束本次实践，回到生活' : p.id === 'rolling-marker' ? '实际收停原木球，结束本次实践，回到生活' : '停止并等候短效结束，让赛恩自由离开，回到生活', '0行动 · 实际收束 · 不退款、不治疗', { type: 'CLOSE', caseId: p.id });
      add(`${p.id}-withdraw`, '实际结束接触并放弃本次结果', '0行动 · 成本保留 · 下周再准备', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场与已有安排', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.id === 'clause-order' ? '准备短暂调整已有核册安排' : p.id === 'rolling-marker' ? '固定原木球，准备偏转已有滚动' : '核实赛恩同意，准备短段偏转', '1行动 · 保持稳定 · 尚未施法', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备相同原物的普通方法', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '开始并实际完成本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 失败照耗' : '1行动 · 0灵性 · 本人仍可拒绝', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 保持原物稳定 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际结果与有限边界', '1行动 · 先实际结束接触', { type: 'REPORT', caseId: p.id });
  }
  if (!s.corruptionBaron.reflected) add('corruption-baron-reflect', '回看已有安排、真实运动与本人自由', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.corruptionBaron.encounter.status === 'AVAILABLE') {
    add('corruption-baron-encounter-talk', '到原契约铺外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('corruption-baron-encounter-fight', '到原契约铺外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function corruptionBaronCases(s: SliceState): CorruptionBaronProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId==='black-emperor'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) return [];
  return CASES.map(p => {
    const r = s.corruptionBaron.cases[p.id]!;
    let result: string | null = r.status === 'RESOLVED' ? p.result : r.status === 'EXAMINED' ? r.contactOpen ? '本次有限结果已经出现，接触仍在；先实际恢复原安排、收停原木球或停止并等候短效结束。' : p.result : r.attemptWeek !== null ? '此前未形成已保留的可报告结果；成本继续保留，接触须先收束，下一真实周可再准备。' : r.withdrawals ? '尚未实施的方案已取消，原物与本人保持稳定，没有新能力消耗。' : null;
    if (result && ['EXAMINED', 'RESOLVED'].includes(r.status) && r.method === 'ORDINARY') result += '本次使用普通方法，没有施加扭曲。';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束，须实际收束' : '没有未收束的接触；准备阶段保持原物稳定', closes: r.closes };
  });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export function validateCorruptionBaronLife(s: SliceState): boolean {
  const m = s.corruptionBaron;
  if (!record(m) || !record(m.cases) || !shape(m.cases, CORRUPTION_BARON_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  if (!record(m.practice) || !shape(m.practice, ['clauseOrder', 'marker', 'route']) || !['ORIGINAL', 'PENDING', 'ADJUSTED', 'RESTORED'].includes(m.practice.clauseOrder) || !['CRADLED', 'ROLLING', 'SIDE_POCKET', 'STOPPED'].includes(m.practice.marker) || !['READY', 'MOVING', 'DIVERTED', 'FREE'].includes(m.practice.route)) return false;
  const promotion = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `corruption-baron-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1 || r.outcome !== p.outcome) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const clause = m.cases['clause-order']!, marker = m.cases['rolling-marker']!, route = m.cases['agreed-route']!;
  const expected = (r: typeof clause, initial: string, pending: string, complete: string, closed: string) => r.status === 'PREPARED' ? initial : r.contactOpen ? r.status === 'EXAMINED' ? complete : pending : r.closes > 0 || r.withdrawals > 0 ? closed : initial;
  if (m.practice.clauseOrder !== expected(clause, 'ORIGINAL', 'PENDING', 'ADJUSTED', 'RESTORED')) return false;
  if (m.practice.marker !== expected(marker, 'CRADLED', 'ROLLING', 'SIDE_POCKET', 'STOPPED')) return false;
  if (m.practice.route !== expected(route, 'READY', 'MOVING', 'DIVERTED', 'FREE')) return false;
  if (s.seer.completedSources.filter(x => x === 'corruption-baron-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if ((active(s)||(s.progression.pathwayId==='black-emperor'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) && ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?s.mentorDisorder.corruptionBaronActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (m.practice.clauseOrder !== 'ORIGINAL' || m.practice.marker !== 'CRADLED' || m.practice.route !== 'READY' || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
