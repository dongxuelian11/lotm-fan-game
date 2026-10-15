import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyJudgeEncounter, blockJudgeEncounter, JUDGE_ENCOUNTER_STORY } from './encounter.js';
import { validateJudgeCommand } from './index.js';
import { JUDGE_CASE_IDS, type JudgeCommand, type JudgeActivityCommand, type JudgeAction, type JudgeProjection, type JudgeCaseId } from './types.js';

const CASES = [
  { id: 'calm-room', title: '原文书室里已有的自愿听众',
    story: '成年文书员莉达与瑟恩已经自愿坐在薇娜的原文书室，愿意听一段公开的场地安排说明。两人知道这只是一次可随时结束的注意力试验；没有询问私人秘密，不要求供词，也不把点头当作相信或说真话。',
    facts: ['两名成年自愿听众早已在场，未凭空创造听众或同意。', '权威只尝试在本次说明中吸引注意，仍可遭到抵抗；注意、赞同和真实陈述是不同的事。'],
    ability: '核实当前许可和停止信号，听众保持自在，没有施法。实践1行动、3灵性，才尝试一次短时质变权威；不迫使本人讲真话。',
    ordinary: '准备清楚而简短的普通说明；实践1行动、0灵性，由听众自行决定是否专注，没有神秘约束。',
    result: '两名原听众本次确实把注意转向了场地说明，随后已经结束影响与交流并恢复自由。没有取得供词、秘密或真话保证，原说明也没有变成不可质疑的事实。', outcome: 'ATTENTION_RECORDED' },
  { id: 'marked-line', title: '原划线区里的一条清晰界线',
    story: '原调解处空室有一块边界清楚的地面练习区，内侧横线早已画好。成年自愿者莉达许可一次在原区内“不越过这条原线”的短时试验。你也站在同一原区，两人各自真实迈步尝试越线，停止信号始终有效，结束后都可从原门自由离开。',
    facts: ['原练习区和原横线明确可见，不新造墙壁、牢房或无限管辖。', '本批G禁令对玩家与莉达同样适用；双方逐一实际试步，抵抗仍可能成功，不因身份自动豁免自己。'],
    ability: '复核原线、当前同意与安全退路，双方站稳未试步，也没有施法。实践1行动、3灵性，才短时宣告这一次区域禁令，并由双方真实尝试。',
    ordinary: '用同一原线准备普通停止约定；实践1行动、0灵性，双方逐一迈步后自行决定是否停住，不虚构法术。',
    result: '你与莉达已经在同一原区逐一真实试步，并各自在原线前停下。本次影响或普通约定已结束，双方从原线退开并恢复自由，不存在跨周禁令、囚禁或违规惩罚。', outcome: 'BOUNDARY_RECORDED' },
  { id: 'shared-token', title: '同一原木牌与原台域',
    story: '薇娜把她原有的唯一编号木牌J6-TOKEN-1放在原台面内，台域边界已经标清。成年自愿者瑟恩许可一次“不把这枚原木牌携出台域”的短时试验。你先拿同一原牌试动作，再亲手放回并交给瑟恩，由本人对同一原牌试动作；全程可见，不制造第二块木牌。',
    facts: ['只有薇娜的同一枚编号原木牌和原台域，没有复制、瞬移、新库存或改变归属。', '玩家与瑟恩各自真实试携出，G禁令同时约束双方；若被抵抗，原牌可以被真实拿出台域，结束必须亲手接回并放回原台。'],
    ability: '核实原牌仍在原台、边界与本人许可，尚未施法或拿牌。实践1行动、3灵性才短时宣告禁令，玩家与本人依次实际试携出。',
    ordinary: '对同一原木牌提出自愿不携出台域的普通约定；实践1行动、0灵性，双方各自实际拿牌试动作，可以拒绝。',
    result: '你与瑟恩确已依次拿起同一枚J6-TOKEN-1试携出，原牌保持在原台域内。本次限制或普通约定已结束，你已从瑟恩手中接回同一原牌并亲手放回原台，物件仍归薇娜，没有瞬移或复制。', outcome: 'TOKEN_RECORDED' },
] as const;

export const JUDGE_ENVIRONMENT = '以下现场、范围、持续、数量、双方同约束与数值均为原创G：观察、准备、实践、报告各1行动；能力实践额外3灵性，普通方法0灵性，失败照付。PREPARE只保持现有听众、原划线区与原台上木牌稳定；PERFORM才开始当前短效和实际接触。双方各自试步或试携同一原木牌，不靠宣告冒充试验。实践后必须0行动显式停止、等候短效结束、退开并亲手安全放回同一原牌；结束时间已包含在原实践预算，不让禁令跨周长期存在。失败也须CLOSE或WITHDRAW实际收束；不退成本、不治疗，下周才可重试。三份报告各25扮演，反思25，和平100有真实成本。权威不保证真话，禁令可抵抗，不永久封能力，不下放惩戒骑士的额外惩罚、囚禁或死亡打击。' + JUDGE_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 6;
export const judgeInside = (s: SliceState) => Object.values(s.judge.cases).some(r => r.contactOpen);
export const isJudgeActivity = (c: JudgeCommand): c is JudgeActivityCommand =>
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function blocked(s: SliceState, c: JudgeActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockJudgeEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成法官晋升。';
  const m = s.judge, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (c.type === 'WITHDRAW' && r?.contactOpen) return null;
  if (judgeInside(s)) return '先0行动停止本次影响、等候短效结束并亲手放回原木牌。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德薇娜的原调解处。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备或待结束的接触。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
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

function preparePractice(s: SliceState, id: JudgeCaseId): void {
  const p = s.judge.practice;
  if (id === 'calm-room') p.audience = 'READY';
  if (id === 'marked-line') { p.boundary = 'CLEAR'; p.lineTestedBy = 'NONE'; }
  if (id === 'shared-token') { p.token = 'ON_TABLE'; p.tokenTestedBy = 'NONE'; }
}
function finishPractice(s: SliceState, id: JudgeCaseId, ctx: SeerContext, wasOpen: boolean): void {
  const p = s.judge.practice;
  if (id === 'calm-room') p.audience = 'FREE';
  if (id === 'marked-line') p.boundary = 'RELEASED';
  if (id === 'shared-token') p.token = 'RETURNED';
  if (!wasOpen) {
    ctx.note('收起尚未实施的准备', id === 'calm-room' ? '撤回尚未开始的说明，原听众自由离开，没有施加权威。' : id === 'marked-line' ? '双方仍站稳，取消尚未实施的方案；没有禁令、试步或惩罚。' : '同一原木牌始终在原台面，你核对后收好方案；没有拿牌、复制、瞬移或禁令。');
    return;
  }
  ctx.note('实际结束本次有限实践', id === 'calm-room'
    ? '你停止本次权威或普通说明，与原听众等候短效结束并结束交流；本人恢复自由注意和行动。0行动，收束时间已包含在原实践预算，不退款、不治疗。'
    : id === 'marked-line'
      ? '你停止本次禁令或普通约定，与莉达等候短效消退，双方实际从原线退开并恢复自由。0行动，等候与退开时间已包含在原实践预算；禁令不跨周留存，没有囚禁或违规惩罚，不退成本。'
      : '你停止本次禁令或普通约定，与瑟恩等候短效消退，然后从本人手中实际接过同一枚J6-TOKEN-1，亲手安全放回薇娜的原台。原牌连续可见，不复制、不瞬移、不入玩家库存。0行动，结束与放回时间已包含在原实践预算，不退款、不治疗。');
}

export function applyJudgeActivity(s: SliceState, c: JudgeActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateJudgeCommand(c) || !isJudgeActivity(c)) throw new Error('法官活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyJudgeEncounter(s, c, ctx); return; }
  const m = s.judge;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!, wasOpen = r.contactOpen;
    finishPractice(s, c.caseId as JudgeCaseId, ctx, wasOpen);
    if (wasOpen) { r.contactOpen = false; r.closes += 1; }
    if (c.type === 'WITHDRAW') {
      r.status = 'OBSERVED'; r.method = null; r.outcome = 'NONE'; r.withdrawals += 1;
      ctx.note('取消本次方案', wasOpen ? '本次接触、短效与原物均已实际收束，放弃尚未报告的结果，原行动与灵性成本保留；下一真实周才可重试。' : '尚未实施的方案已取消；原听众、原线与原木牌都保持稳定，不施法、不退准备行动。');
    }
    return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('judge-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看权威、明确边界与自身约束', '你区分了注意和真话，记下双方真实尝试同一条有限约束、遭遇抵抗的可能，以及实际结束和原物安全放回。G扮演+25；本作短效与双方同约束不冒充原著通用法则，序列5惩戒骑士的惩罚、囚禁或死亡打击仍未开放。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; preparePractice(s, p.id);
    ctx.note('准备本次有限方案', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '此时原物稳定、本人未试动作、没有新接触；即使这是本周最后行动，也不会把短效留到下一周。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`judge-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次使用普通方法，双方自行决定，没有虚构施法。' : '') + '本次接触已实际结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'calm-room') m.practice.audience = 'ADDRESSED';
  if (p.id === 'marked-line') { m.practice.boundary = 'ATTEMPTED'; m.practice.lineTestedBy = 'BOTH'; }
  if (p.id === 'shared-token') { m.practice.token = 'OUTSIDE_TABLE'; m.practice.tokenTestedBy = 'BOTH'; }
  ctx.note('本次接触与真实尝试开始', p.id === 'calm-room'
    ? '再次核实原听众自愿，你实际开始当前公开场地说明；只尝试吸引已有听众的注意，没有提问秘密或要求供词。'
    : p.id === 'marked-line'
      ? (r.method === 'ABILITY' ? '再次确认莉达同意与停止信号，你在当前原区短时宣告禁止越过原线。' : '再次确认莉达同意与停止信号，双方提出普通停止约定。') + '随后你和她依次真实迈步尝试跨过同一原线。G规则也约束你自己，没有只宣告而不试步。'
      : (r.method === 'ABILITY' ? '再次确认瑟恩许可，你在当前原台域短时宣告禁止携出这枚原牌。' : '再次确认瑟恩许可，双方提出同一原牌不携出的普通约定。') + '随后你先真实拿起唯一原木牌尝试携出台域，然后亲手放回并交给瑟恩；本人拿起同一原牌实际试携出，没有复制或让原牌凭空移动。');
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    ctx.note('有限能力的成本已付', '实际消耗3灵性，仅本次短时权威或当前原区域内一条明确禁令。失败照耗，必须0行动实际停止并等候短效结束；不保证真话，不永久封能力，不追加违规惩罚。');
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'perception', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'calm-room') m.practice.audience = 'ATTENTIVE';
    if (p.id === 'marked-line') m.practice.boundary = 'HELD';
    if (p.id === 'shared-token') m.practice.token = 'HELD_ON_TABLE';
    ctx.note(p.title, p.id === 'calm-room'
      ? (r.method === 'ABILITY' ? '本次质变权威使两名原听众暂时转来注意。' : '原听众自行接受清楚的说明，暂时转来注意。') + '没有得到供词或真话保证；先结束本次接触再报告。'
      : p.id === 'marked-line'
        ? (r.method === 'ABILITY' ? '同一有限禁令实际阻住你和莉达各自的越线尝试，双方都没有越过原线。' : '你和莉达各自迈步后自行遵守普通约定，在原线前停下，没有施法。') + '尚须停止并等候短效结束或撤去普通约定，双方退开。'
        : (r.method === 'ABILITY' ? '同一条有限禁令先后阻住了你与瑟恩各自携出原牌的动作。' : '你与瑟恩各自拿牌后自行遵守普通约定，没有把原牌携出台域。') + '原木牌最后仍在台域内瑟恩手中，必须实际结束、亲手接回并放回同一原台。');
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次未取得可报告结果，已付行动与灵性保留，当前接触仍在。' + (p.id === 'calm-room' ? '原听众没有持续专注；这不表示说谎或有罪，仍须结束本次交流。' : p.id === 'marked-line' ? '你与莉达的实际试步没有同时被约束住，原线已被越过；可能的抵抗保留，仍须停止并等候短效结束，双方退开。' : '双方依次实际试携出，没有形成共同约束；同一原木牌最后在台域外瑟恩手中，须等候短效结束后亲手接回并安全放回原台，不靠瞬移复位。') + '先0行动CLOSE或WITHDRAW实际收束，下一真实周再准备。');
  }
}

export function judgeActions(s: SliceState): JudgeAction[] {
  if (!active(s)) return [];
  const out: JudgeAction[] = [];
  const add = (id: string, label: string, cost: string, command: JudgeActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.judge.cases[p.id]!;
    if (r.contactOpen) {
      add(`${p.id}-close`, p.id === 'calm-room' ? '停止影响，结束交流，回到生活' : p.id === 'marked-line' ? '停止并等候禁令结束，双方退开，回到生活' : '停止并等候禁令结束，亲手放回同一原牌，回到生活', '0行动 · 时间已含原预算 · 不退款、不治疗', { type: 'CLOSE', caseId: p.id });
      add(`${p.id}-withdraw`, '实际结束接触并放弃本次结果', '0行动 · 成本保留 · 下周再准备', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、已有本人和明确边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.id === 'calm-room' ? '准备吸引已有听众注意' : p.id === 'marked-line' ? '准备同一区域双方不越原线' : '准备双方试携同一原木牌', '1行动 · 保持稳定 · 尚未施法', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备相同原现场的普通方法', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '开始并实际完成本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 失败照耗' : '1行动 · 0灵性 · 本人仍可拒绝', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 保持原物稳定 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际结果与有限边界', '1行动 · 先实际结束接触', { type: 'REPORT', caseId: p.id });
  }
  if (!s.judge.reflected) add('judge-reflect', '回看权威、明确边界与自身约束', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.judge.encounter.status === 'AVAILABLE') {
    add('judge-encounter-talk', '到原调解处外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('judge-encounter-fight', '到原调解处外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function judgeCases(s: SliceState): JudgeProjection['cases'] {
  if (!active(s) && !(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) return [];
  return CASES.map(p => {
    const r = s.judge.cases[p.id]!;
    let result: string | null = r.status === 'RESOLVED' ? p.result : r.status === 'EXAMINED' ? r.contactOpen ? '本次有限结果已经出现，接触仍在；先实际停止、等候短效结束并亲手放回原木牌。' : p.result : r.attemptWeek !== null ? '此前未形成已保留的可报告结果；成本继续保留，接触须先收束，下一真实周可再准备。' : r.withdrawals ? '尚未实施的方案已取消，原物与本人保持稳定，没有新能力消耗。' : null;
    if (result && ['EXAMINED', 'RESOLVED'].includes(r.status) && r.method === 'ORDINARY') result += '本次使用普通方法，没有施加权威或禁令。';
    if (p.id === 'shared-token' && r.contactOpen) result += mTokenResult(s);
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束，须实际收束' : '没有未收束的接触；准备阶段保持原物稳定', closes: r.closes };
  });
}
function mTokenResult(s: SliceState): string { return s.judge.practice.token === 'OUTSIDE_TABLE' ? '同一原牌仍在台域外瑟恩手中；玩家与本人均已试动作，尚未安全放回。' : '同一原牌仍在台域内瑟恩手中；玩家与本人均已试动作，尚未安全放回。'; }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export function validateJudgeLife(s: SliceState): boolean {
  const m = s.judge;
  if (!record(m) || !record(m.cases) || !shape(m.cases, JUDGE_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  if (!record(m.practice) || !shape(m.practice, ['audience', 'boundary', 'token', 'lineTestedBy', 'tokenTestedBy']) || !['READY', 'ADDRESSED', 'ATTENTIVE', 'FREE'].includes(m.practice.audience) || !['CLEAR', 'ATTEMPTED', 'HELD', 'RELEASED'].includes(m.practice.boundary) || !['ON_TABLE', 'OUTSIDE_TABLE', 'HELD_ON_TABLE', 'RETURNED'].includes(m.practice.token) || !['NONE', 'BOTH'].includes(m.practice.lineTestedBy) || !['NONE', 'BOTH'].includes(m.practice.tokenTestedBy)) return false;
  const promotion = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `judge-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
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
  const audience = m.cases['calm-room']!, boundary = m.cases['marked-line']!, token = m.cases['shared-token']!;
  const expected = (r: typeof audience, initial: string, pending: string, complete: string, closed: string) => r.status === 'PREPARED' ? initial : r.contactOpen ? r.status === 'EXAMINED' ? complete : pending : r.closes > 0 || r.withdrawals > 0 ? closed : initial;
  if (m.practice.audience !== expected(audience, 'READY', 'ADDRESSED', 'ATTENTIVE', 'FREE')) return false;
  if (m.practice.boundary !== expected(boundary, 'CLEAR', 'ATTEMPTED', 'HELD', 'RELEASED')) return false;
  if (m.practice.token !== expected(token, 'ON_TABLE', 'OUTSIDE_TABLE', 'HELD_ON_TABLE', 'RETURNED')) return false;
  for (const [r, tested] of [[boundary, m.practice.lineTestedBy], [token, m.practice.tokenTestedBy]] as const) {
    if ((r.attemptWeek === null || r.status === 'PREPARED') && tested !== 'NONE') return false;
    if ((r.contactOpen || ['EXAMINED', 'RESOLVED'].includes(r.status)) && tested !== 'BOTH') return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && !r.contactOpen && tested === 'NONE' && r.withdrawals === 0) return false;
  }
  if (s.seer.completedSources.filter(x => x === 'judge-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if ((active(s)||(s.progression.pathwayId==='justiciar'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) && ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?s.punishmentKnight.judgeActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (m.practice.audience !== 'READY' || m.practice.boundary !== 'CLEAR' || m.practice.token !== 'ON_TABLE' || m.practice.lineTestedBy !== 'NONE' || m.practice.tokenTestedBy !== 'NONE' || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
