import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { formatGameDate } from '../game-calendar.js';
import { applyAstronomerEncounter, blockAstronomerEncounter, ASTRONOMER_ENCOUNTER_STORY } from './encounter.js';
import { ASTRONOMER_CASE_IDS, type AstronomerCaseId, type AstronomerCommand, type AstronomerActivityCommand, type AstronomerAction, type AstronomerProjection } from './types.js';

const CASES = [
  {
    id: 'catalogue-check', title: '星图上的一处抄录差异',
    story: '成年观测员梅瑞狄斯得到原观测台组织授权，在贝克兰德原观测楼顶与你核对一张已经印好的星图。她拿出同处保存、来源已知的原始星表底本，只请你逐栏比较这一张图的抄录。两份原纸始终留在原观测台，不把印刷差异当成天体变化或秘密预言。（原创G）',
    facts: ['原印刷星图和原始星表底本实际同时在场，属于原观测台组织。', '这里只能比较眼前已有的两份资料；尚未实际调整观测仪器，也没有进行夜间测量。'],
    ability: '准备使用原创G短时专注校准，集中自己的注意力逐栏核对两份原纸；实施另耗2灵性，能力不产生未知星表或必然真相。',
    ordinary: '准备以普通知识逐栏核对原印刷星图与已知来源的原始星表底本，不施放非凡能力。',
    result: '逐项对照确认：这一张原印刷星图第七栏的参照编号抄成18，原始星表底本为16。只确认这处有限抄录差异，没有凭星象获得未来或隐藏真相。',
    outcome: 'CATALOGUE_CHECKED', spirit: 2,
  },
  {
    id: 'instrument-drift', title: '亲手校准屋顶的原仪器',
    story: '完成星图报告后，成年梅瑞狄斯本人在原屋顶确认原观测台组织允许这次维护，并将原普通螺丝刀放在原观测仪器旁供本次使用。原仪器的基准偏移为2格；你要对照原固定基准刻线，亲手调整原调节螺钉。她全程在场，工具与仪器都不交付给你。（原创G）',
    facts: ['原仪器、原固定基准刻线和普通螺丝刀始终位于同一原观测楼顶，归原观测台组织。', '梅瑞狄斯本人同意这一次有限手工维护；能力只能帮助自己的专注，不能遥控螺钉、赋予仪器生命或代替实际操作。'],
    ability: '准备以原创G短时专注校准辅助自己的手眼配合，再亲手用原普通螺丝刀调节原螺钉；实施另耗3灵性，成功才把原仪器偏移2格校正为0格。',
    ordinary: '准备依靠普通知识和原基准刻线，亲手用原普通螺丝刀调节原仪器；同样只有实际成功才把偏移2格校正为0格。',
    result: '你已亲手用原普通螺丝刀完成原螺钉调节，原仪器基准偏移从2格变为0格。这一真实校准在报告前就已发生，结束现场不会撤销或复制它。',
    outcome: 'INSTRUMENT_ALIGNED', spirit: 3,
  },
  {
    id: 'night-measurement', title: '下一真实周的屋顶夜测',
    story: '校准报告完成后，梅瑞狄斯约你在校准之后的一个真实周，夜间回到同一原观测楼顶。用已经校准的同一原仪器，对准已知星表中那一个固定参照，再比较原刻线读数。本次实施的1行动包含按约在当前周实际夜间到访与测量；日期和夜间安排是明确原创G的有限场景调度，不把白昼暗室改称夜晚。（原创G）',
    facts: ['必须已报告真实校准，且当前周严格晚于校准发生周，不能同周赶完夜测。', '原仪器、原星表和原刻线仍在原屋顶；夜间到访不需要也不借回已交给伊芙的ART6-LAMP-1。', '只检验这次固定参照下的有限读数；不预言未来、不改变星体、天气或昼夜。'],
    ability: '准备在约定夜间实际到原屋顶，使用原创G短时专注校准辅助读取同一原仪器；实施另耗2灵性，失败也花掉本次夜间行动。',
    ordinary: '准备在同样的约定夜间实际到原屋顶，以普通知识读取同一原仪器与已知固定参照，不施放能力，也不能用白昼暗室代替夜测。',
    result: '你已在校准后另一真实周的约定夜间，用同一原仪器完成一次固定参照测量并核对原刻线。测量仅支持这一次有限读数，没有获得未来、天气控制或额外观测设备。',
    outcome: 'MEASUREMENT_CHECKED', spirit: 2,
  },
] as const;
type Case = typeof CASES[number];

export const ASTRONOMER_ENVIRONMENT = '原观测台组织的成年观测员梅瑞狄斯在原屋顶依次主持三项原创G实践：对照两份真实原纸，亲手用普通螺丝刀校准原仪器，报告后下一真实周夜间再测。原仪器偏移初始2格，成功手工校准才变0格；校准在报告前已生效。夜测实施的1行动包含当前游戏日期夜间的实际到访，只是有限G场景调度；白昼暗室不能替代，不模拟或控制天气。OBSERVE、PREPARE、PERFORM、REPORT各1行动；CLOSE与WITHDRAW为0行动，成本不退。能力方法按三案顺序实耗2、3、2灵性，意志14；普通方法知识10、0灵性，均可能失败，结束后下一真实周才可重试。每报告G扮演+25、原规则单项掌握+8，三案反思+25。所有原纸、原仪器和普通工具仍归原观测台并留在原屋顶；ART6-LAMP-1仍在客户处，不借回、复制或充能。短时专注校准是原创G，不冒充未知具体原著星术，不预言真相、发射星光、操纵天象或提前赋灵。 ' + ASTRONOMER_ENCOUNTER_STORY;

export const astronomerInside = (s: SliceState) => Object.values(s.astronomer.cases).some(r => r.contactOpen);
export const isAstronomerActivity = (c: AstronomerCommand): c is AstronomerActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is AstronomerActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!ASTRONOMER_CASE_IDS.includes(c.caseId as AstronomerCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: AstronomerActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 5) return '先完成天文学家晋升。';
  const m = s.astronomer, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次原屋顶现场。';
  if (astronomerInside(s)) return '先0行动实际结束本次原屋顶现场并退出。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德的原观测楼顶与原仪器旁。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockAstronomerEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项实际核对、校准与隔周夜测报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.caseId === 'instrument-drift' && m.cases['catalogue-check']!.status !== 'RESOLVED') return '先完成原印刷星图与原始星表的实际核对报告。';
  if (c.caseId === 'night-measurement') {
    if (m.cases['instrument-drift']!.status !== 'RESOLVED' || f.instrumentOffset !== 0 || f.calibratedWeek === null) return '先实际校准同一原仪器，并完成校准报告。';
    if (s.week <= f.calibratedWeek) return '须校准后的下一真实周再按约夜间到访，不能同周赶完；白昼暗室不算夜测。';
  }
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原资料、现场与本人许可已经核对。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先实际核对原资料、原仪器和本人许可。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备重试。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束本次现场。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才可重新准备。';
  if (c.caseId === 'instrument-drift' && (f.instrumentOffset !== 2 || f.calibratedWeek !== null)) return '原仪器已经实际校准，不能重复调整并制造第二份结果。';
  if (c.caseId === 'night-measurement' && (f.measurements !== 0 || f.observedWeek !== null)) return '这一次有限夜测已经完成，不能重复记作新测量。';
  const p = CASES.find(p => p.id === c.caseId)!;
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次短时专注需要${p.spirit}灵性；可0行动取消准备，休养或改用普通方法。` : null;
}

const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => p.result + (method === 'ABILITY' ? '本次确实使用了原创G短时专注辅助自己的注意力。' : '本次采用普通方法，没有施放非凡能力。');
const practiceText = (s: SliceState) => {
  const f = s.astronomer.practice;
  return `原仪器当前偏移${f.instrumentOffset}格；${f.calibratedWeek === null ? '尚未成功校准' : `第${f.calibratedWeek}周已亲手校准`}；${f.observedWeek === null ? '尚无成功夜测' : `第${f.observedWeek}周已完成夜测`}，成功测量${f.measurements}次。原件与工具仍在原观测楼顶，归原观测台组织。`;
};

export function applyAstronomerActivity(s: SliceState, c: AstronomerActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('天文学家实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyAstronomerEncounter(s, c, ctx); return; }
  const m = s.astronomer, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束原屋顶现场并退出', '0行动停止本次专注、手工操作或夜测，实际退离原观测位。原纸、原仪器和普通螺丝刀仍归原观测台组织并留在原屋顶；已发生的校准、夜测与成本保留，不移动物品、不退款、不治疗。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备；原观察、许可、已付行动与此前结果保留。没有实施本次校准或夜测，不改原仪器，不返还已付成本。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('astronomer-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('资料、亲手校准与下一周的夜空', '回看真实星表对照、本人许可下的手工校准，以及隔周夜间对同一原仪器的实际复核。G扮演+25；专注只能帮助自己，已有记录需要检验，下一周不能靠文字跳过，原物与未知都有边界。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只核对原现场和本人许可，尚未实施。' + practiceText(s)); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`astronomer-case:${p.id}`, 8);
    ctx.note(p.title, resultText(p, r.method!) + '现场已实际结束，报告G扮演+25、原规则单项掌握+8。' + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'instrument-drift') ctx.note('梅瑞狄斯本人确认这次原仪器维护', '成年梅瑞狄斯在原屋顶当面确认原观测台组织的这次维护许可，原普通螺丝刀和原仪器均在眼前。你亲手握持普通螺丝刀调整原螺钉；短时专注若启用，也只辅助自己的手眼配合，不是隔空操纵。');
  if (p.id === 'night-measurement') ctx.note('按约实际到原屋顶夜测', `第${s.week}周，${formatGameDate(s.date)}夜间，你按梅瑞狄斯的约定实际到达同一原观测楼顶，使用已校准原仪器和已知固定参照。本次1行动已包含这次夜间到访及实际测量；这是明确原创G的有限日期／夜间场景调度，不把白昼暗室当成夜晚，不更改世界天气或昼夜。之后读数核对仍可能失败。`);
  if (r.method === 'ABILITY') { s.spirituality -= p.spirit; ctx.note('实际支付短时专注成本', `原创G短时专注只作用于自己的注意力，${p.spirit}灵性已经支出；之后核对或手工调整仍须判定，失败也不退还。`); }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'instrument-drift') { f.instrumentOffset = 0; f.calibratedWeek = s.week; }
    if (p.id === 'night-measurement') { f.measurements = 1; f.observedWeek = s.week; }
    ctx.note(p.title, resultText(p, r.method!) + '先0行动实际结束本次现场，再另行报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED';
  ctx.note(p.title, (p.id === 'instrument-drift' ? '本次手工调整未形成合格校准，原仪器仍偏移2格，没有写成已校准。' : p.id === 'night-measurement' ? '本次夜间到访与读数尝试确实发生，但未形成可核实的测量；不增加成功次数。此前原仪器的成功校准保留。' : '本次两份原纸核对未形成足够结论，没有从星图获得必然真相。') + `本次1行动${r.method === 'ABILITY' ? `及${p.spirit}灵性` : ''}已花；先0行动实际结束现场，下一真实周重新准备，不能同周重刷。` + practiceText(s));
}

export function astronomerActions(s: SliceState): AstronomerAction[] {
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 5) return [];
  const out: AstronomerAction[] = [];
  const add = (id: string, label: string, cost: string, command: AstronomerActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.astronomer.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束原屋顶现场并退出', '0行动 · 保留原校准、结果与成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', p.id === 'catalogue-check' ? '核对原印刷星图与原星表来源' : p.id === 'instrument-drift' ? '核对本人维护许可与原仪器' : '核对下一真实周的夜测约定', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', '准备原创G短时专注辅助', `1行动 · 实施另${p.spirit}灵性 · 只作用于自身`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'instrument-drift' ? '准备普通手工校准' : '准备普通知识核对', '1行动 · 实施0灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', p.id === 'catalogue-check' ? '实际逐栏核对两份原纸' : p.id === 'instrument-drift' ? '获本人许可后亲手调整原螺钉' : '按约实际夜间到屋顶测量', (r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 意志14 · 失败照耗` : '1行动 · 知识10 · 0灵性') + (p.id === 'night-measurement' ? ' · 包含实际夜间到访' : ''), { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 原观察和成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本案有限实际结果', '1行动 · 实际结束现场后', { type: 'REPORT', caseId: p.id });
  }
  if (!s.astronomer.reflected) add('astronomer-reflect', '回看原资料、手工校准与隔周夜测', '1行动 · 三项实际报告后', { type: 'REFLECT' });
  if (s.astronomer.encounter.status === 'AVAILABLE') {
    add('astronomer-encounter-talk', '前往原观测台外院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('astronomer-encounter-fight', '前往原观测台外院并承担冲突', '1行动 · 真实伤亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}

export function astronomerCases(s: SliceState): AstronomerProjection['cases'] {
  if (s.progression.pathwayId !== 'paragon' || (s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => {
    const r = s.astronomer.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(p, r.method!) + practiceText(s)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周有限尝试未成，实际成本保留；结束现场后下一真实周再准备。` + practiceText(s)
        : r.withdrawals ? '尚未实施的准备已取消，原观察与已付行动保留。' + practiceText(s) : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次原屋顶现场仍须实际结束并退出' : '没有尚未结束的本次原屋顶现场', closes: r.closes };
  });
}

/** These three known originals and one later night visit do not create a general physics or inventory system. */
export function validateAstronomerLife(s: SliceState): boolean {
  const m = s.astronomer;
  if (!record(m) || !record(m.cases) || !shape(m.cases, ASTRONOMER_CASE_IDS) || !record(m.practice) || !shape(m.practice, ['instrumentOffset', 'calibratedWeek', 'observedWeek', 'measurements']) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promoted = s.progression.pathwayId === 'paragon' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (![0, 2].includes(f.instrumentOffset) || !integer(f.measurements, 0, 1)) return false;
  if (f.calibratedWeek !== null && !integer(f.calibratedWeek, m.promotionWeek ?? s.week, s.week) || f.observedWeek !== null && !integer(f.observedWeek, m.promotionWeek ?? s.week, s.week)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - (m.promotionWeek ?? s.week) + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `astronomer-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - (m.promotionWeek ?? r.attemptWeek) + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
      if (r.closes >= r.attemptWeek - (m.promotionWeek ?? r.attemptWeek) + 1) return false;
    }
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const catalogue = m.cases['catalogue-check']!, calibration = m.cases['instrument-drift']!, night = m.cases['night-measurement']!;
  if (calibration.status !== 'AVAILABLE' && catalogue.status !== 'RESOLVED' || night.status !== 'AVAILABLE' && calibration.status !== 'RESOLVED') return false;
  const aligned = ['EXAMINED', 'RESOLVED'].includes(calibration.status), measured = ['EXAMINED', 'RESOLVED'].includes(night.status);
  if (f.instrumentOffset !== (aligned ? 0 : 2) || f.calibratedWeek !== (aligned ? calibration.attemptWeek : null)) return false;
  if (f.measurements !== (measured ? 1 : 0) || f.observedWeek !== (measured ? night.attemptWeek : null)) return false;
  if (night.status !== 'AVAILABLE' && (f.calibratedWeek === null || s.week <= f.calibratedWeek)) return false;
  if (night.attemptWeek !== null && (f.calibratedWeek === null || night.attemptWeek <= f.calibratedWeek)) return false;
  if (calibration.attemptWeek !== null && (catalogue.attemptWeek === null || calibration.attemptWeek < catalogue.attemptWeek)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'astronomer-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.instrumentOffset !== 2 || f.calibratedWeek !== null || f.observedWeek !== null || f.measurements !== 0)) return false;
  if (s.progression.pathwayId==='paragon'&&s.progression.sequence===5 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if(s.progression.pathwayId==='paragon'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && (s.alchemist.astronomerActingAtPromotion!==100||resolved!==3||!m.reflected))return false;
  return true;
}
