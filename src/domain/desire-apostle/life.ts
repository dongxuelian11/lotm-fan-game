import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyDesireApostleEncounter, blockDesireApostleEncounter, DESIRE_APOSTLE_ENCOUNTER_STORY } from './encounter.js';
import { validateDesireApostleCommand } from './index.js';
import { DESIRE_APOSTLE_CASE_IDS, type DesireApostleCommand, type DesireApostleActivityCommand, type DesireApostleAction, type DesireApostleProjection } from './types.js';

const CASES = [
  {
    id: 'calm-boundary', title: '蕾娜的平稳心情与同一本原记录册',
    story: '原创成年蕾娜（Reina）本人已在罗安的原练习室，明确愿意有限讨论。她当下心情平稳，言语和动作也平静；这是本作明确写定的当前G现场条件，不是你读出了隐秘内心。罗安持有原记录册DA5-LEDGER-1，讨论与交接均在同一房间内进行。',
    facts: ['蕾娜只自述目前平静；可观察的动作与这句话相符，不据此判断秘密、人格或未来。', '当前缺少强烈情绪或明显欲望，不能埋种或催化；本项只允许普通核对。', '实施时从罗安手中接过同一本原记录册，结束时须亲手交还；失败也保留实际交接。'],
    ability: null,
    ordinary: '准备普通核对蕾娜的当面表述与可见行为；实施1行动、0灵性、知识10，从罗安手中接过原记录册DA5-LEDGER-1。',
  },
  {
    id: 'eager-rehearsal', title: '米蕾尔本人同意的一次有限排练',
    story: '原创成年米蕾尔（Mirel）本人已在同一原练习室，为自己选择的即将登台机会兴奋。她明确说出期待，语速和动作明显活跃，并自愿同意一次可以停止的有限试验或普通谈话；强烈情绪来自她已有的演出期待，没有由玩家制造恐惧、勒索或羞辱。',
    facts: ['她自己的当面表述与实际活跃动作是本次原排练的公开来源，不读取隐藏欲望或把所有人都判定为激动。', '能力实施付1行动、3灵性，知识14成功才埋下本次种子；此时尚无催化效果，也无奖励。', '种子尚在且本人当前仍强烈兴奋，才可在同一已付实践内另付2灵性、知识14尝试催化，不再收行动；只核对一次短暂可见迟疑。', '随时可0行动停止本次试验并实际等过原创G的一次有限窗口；未催化的种子到期，不许诺解除任意诅咒或通用净化。'],
    ability: '准备米蕾尔本人明确同意的本次排练。实施埋种需3灵性，后续催化还需2灵性，建议先保有5灵性；不足后续成本可停止并等待本次G窗口实际到期。准备不施法，不改变她的情绪。',
    ordinary: '准备普通谈话，请米蕾尔本人愿意时短暂停一下；实施1行动、0灵性、知识10，没有埋种或催化。',
  },
  {
    id: 'honest-account', title: '亲手交付同一张有限记录',
    story: '罗安在同一原练习室保留原记录纸DA5-NOTE-1。你只整理已经实际经历的平稳边界、强烈情绪来源、成功或失败与普通替代；同一张纸始终在场，不把文字变成诊断、隐藏心思或新能力。',
    facts: ['只记录此前已经实际观察、尝试与结束的事实，失败与普通谈话不能写成成功催化。', '实施时罗安递来同一张原记录纸，普通书写；若重试，递回的仍是上次同一张纸，原失败文字保留并更正。', '即使书写核对失败，纸上文字已经留下；结束时必须亲手把原纸交给罗安，不凭状态标签完成交付。'],
    ability: null,
    ordinary: '准备普通整理已经发生的有限事实；实施1行动、0灵性、知识10，在同一张DA5-NOTE-1上书写，随后另选0行动亲手交付。',
  },
] as const;
const active = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 5;
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';

export const DESIRE_APOSTLE_ENVIRONMENT = '三项原创G有限实践，观察、准备、实施、报告各1行动。平稳边界与诚实记录只用普通方法，0灵性、知识10。原米蕾尔已经因自己选择的演出兴奋且本人明确同意有限排练：埋种1行动、3灵性、知识14；种子成功后，仍须当前强烈情绪，在同一已付实践中催化0额外行动、2灵性、知识14。失败照耗，埋种本身无效果与奖励；建议预留5灵性。0行动停止并实际等过本作一次有限窗口，未催化种子到期；原记录册亲手归还、原记录纸亲手交付。即使最后1行动或0灵性也能完成收束。每案每真实周至多实施一次，须收束才可生活或换周。三份报告各G扮演25，只有真实成功催化的能力报告取得一次已有知识池单项掌握8；普通报告无能力奖励，反思25。全普通和平100只是本作有成本的G替代，不是原著深渊无风险、安全消化或完美扮演的保证；本人同意是本场景伦理安排，不被冒充为原著施法条件。不提供现实治疗、诊断或操控步骤。' + DESIRE_APOSTLE_ENCOUNTER_STORY;
export const desireApostleInside = (s: SliceState) => {
  const m = s.desireApostle, f = m.practice;
  return Object.values(m.cases).some(r => r.contactOpen) || f.ledger === 'PLAYER' || f.note === 'WRITTEN' || f.seed === 'PLANTED';
};
export const isDesireApostleActivity = (c: DesireApostleCommand): c is DesireApostleActivityCommand => typeof c === 'object' && c !== null && ['OBSERVE', 'PREPARE', 'PERFORM', 'CATALYZE', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function blocked(s: SliceState, c: DesireApostleActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockDesireApostleEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成欲望使徒晋升。';
  const m = s.desireApostle, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (c.type === 'CATALYZE') {
    if (!r || c.caseId !== 'eager-rehearsal' || r.status !== 'PREPARED' || r.method !== 'ABILITY' || !r.contactOpen || r.attemptWeek !== s.week || f.seed !== 'PLANTED') return '须先在本次已付排练中实际成功埋种。';
    if (f.emotion !== 'STRONG') return '本人当前情绪平稳，缺少催化条件；可以停止并等过本次有限窗口。';
    if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '催化只限仍在原练习室的同一本次接触。';
    if (s.health <= 0 || s.mind <= 0) return '身体或精神不足以继续试验，请0行动停止。';
    return s.spirituality < 2 ? '后续催化还需2灵性，不能透支；可以0行动停止并等待本次种子到期。' : null;
  }
  if (desireApostleInside(s)) return '先0行动停止本次试验并等过有限窗口，实际交还原记录册或原纸。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德罗安的原练习室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前尚未实施的准备。';
  if (c.type === 'REFLECT') return m.reflected ? '已回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践已经发生，下一真实周再重新准备。' : c.method === 'ABILITY' && c.caseId !== 'eager-rehearsal' ? '此项没有当前可用的能力条件，只可用普通方法。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' || r.outcome === 'NONE' ? '先取得真实结果并实际结束本次接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  if (r.method === 'ABILITY' && (c.caseId !== 'eager-rehearsal' || s.spirituality < 3)) return '本次排练埋种需要3灵性；后续催化另需2灵性，也可取消准备改用普通方法。';
  return null;
}

function resultText(s: SliceState, id: string): string {
  const r = s.desireApostle.cases[id]!;
  if (id === 'calm-boundary') return '你普通核对了蕾娜的当面平静表述与可见行为，记录当前缺少催化入口；没有读心或制造情绪。同一本DA5-LEDGER-1的实际交接有记录。';
  if (id === 'eager-rehearsal') return r.outcome === 'CATALYSIS_CHECKED' ? '米蕾尔在本次强烈兴奋且本人同意的排练中，实际埋种后催化成功，出现一次短暂可见迟疑；只报告这次有限现象，不声称强制忠诚、隐藏真相、永久控制或心脏必停。' : '你与米蕾尔普通谈话，她本人愿意短暂停一下；没有埋种、催化或非凡支配，不把自愿配合写成魔法成功。';
  return '你在同一张DA5-NOTE-1上整理了此前已经实际发生的有限观察、成功或失败与普通替代，不补写秘密、诊断或尚未发生的效果。';
}

export function applyDesireApostleActivity(s: SliceState, c: DesireApostleActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateDesireApostleCommand(c) || !isDesireApostleActivity(c)) throw new Error('欲望使徒活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyDesireApostleEncounter(s, c, ctx); return; }
  const m = s.desireApostle, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'calm-boundary') {
      f.ledger = 'GUIDE'; ctx.note('同一本原记录册实际归还', '你仍在原练习室，亲手把同一本DA5-LEDGER-1交还罗安，并结束与蕾娜的普通讨论。即使核对失败也确实归还，0行动、0灵性，不退成本。');
    } else if (c.caseId === 'eager-rehearsal') {
      if (f.seed === 'PLANTED') { f.seed = 'EXPIRED'; r.status = 'OBSERVED'; r.outcome = 'NONE'; }
      f.emotion = 'CALM';
      ctx.note('停止试验并实际等过有限窗口', '你明确停止本次试验，双方仍在原练习室，实际等过已经预付的原创G一次有限练习窗口。米蕾尔自行平复；尚未催化的本次种子实际到期，已催化尝试保留为历史。0行动、0灵性，即使资源耗尽也能停止，不退款、不承诺通用净化或现实治疗。未取得结果须下一真实周再确认本人新的排练同意。');
    } else {
      f.note = 'HANDED_OVER'; ctx.note('同一张原记录纸实际交付', '你亲手把已经写过的同一张DA5-NOTE-1交给罗安，双方仍在原练习室。失败文字也保留；下一真实周重试时由罗安亲手递回这一张原纸，再作有限更正。0行动、0灵性，不复制纸张、不退款。');
    }
    return;
  }
  if (c.type === 'CATALYZE') {
    const r = m.cases[c.caseId]!;
    s.spirituality -= 2; f.seed = 'SPENT';
    const result = ctx.check('knowledge', 14);
    if (success(result.tier)) {
      f.pauseObserved = true; r.status = 'EXAMINED'; r.outcome = 'CATALYSIS_CHECKED';
      ctx.note('当前情绪条件下的一次有限催化', resultText(s, c.caseId) + '这是同一个已付实践中的后续尝试，只另付2灵性，0额外行动。接触仍未结束，须实际停止后才可报告。');
    } else {
      r.status = 'OBSERVED'; r.outcome = 'NONE';
      ctx.note('本次催化未取得结果', '当前强烈情绪与本次种子曾满足尝试条件，但知识14催化失败。2灵性已付、0额外行动，本次种子已经用尽，未出现可报告迟疑，也未改变忠诚或获得真相。先0行动停止并实际等过本次窗口，下一真实周再准备。');
    }
    return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消，不开始新接触、不埋种、不改变情绪、不移动原物，之前已付成本不退。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('desire-apostle-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看当前条件与有限事实', '你分清平稳边界、已有强烈情绪、实际埋种、成功或失败的催化与普通自愿配合。G扮演+25；这条和平100只是本作有成本替代，不是原著深渊完美安全扮演或无风险消化保证，也不自动恢复良知或清除风险。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    ctx.note('准备本次有限方案', (c.method === 'ABILITY' ? p.ability! : p.ordinary) + (p.id === 'eager-rehearsal' ? '米蕾尔本人再次确认这次排练范围与停止选择；若已跨周，这是同一位原志愿者的新一次明确同意，不自动控制任何人的情绪。' : '')); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `desire-apostle-case:${p.id}`;
    if (r.method === 'ABILITY' && r.outcome === 'CATALYSIS_CHECKED') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(s, p.id) + '实际停止与原物交接均已完成。G扮演+25；' + (r.method === 'ABILITY' ? '真实成功催化的能力报告取得一次已有知识池单项掌握8。' : '普通报告不伪增能力掌握。')); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true; r.outcome = 'NONE';
  if (p.id === 'calm-boundary') {
    f.ledger = 'PLAYER'; ctx.note('从罗安手中实际接过原记录册', '你亲手接过同一本DA5-LEDGER-1，按蕾娜自己的表述与可见动作普通核对。知识10即使失败，原册也已在你手中，仍须亲手归还。');
  } else if (p.id === 'eager-rehearsal') {
    f.emotion = 'STRONG'; f.seed = 'NONE'; f.pauseObserved = false;
    ctx.note('原米蕾尔开始本人同意的有限排练', '同一位米蕾尔当面确认已有演出期待，实际语速和动作活跃。当前强烈情绪来自这次原创G原排练事实，没有恐吓、隐藏读心或任意改变别处人的情绪。双方仍在原练习室。');
    if (r.method === 'ABILITY') s.spirituality -= 3;
  } else {
    f.note = 'WRITTEN'; ctx.note('同一张原记录纸已经实际书写', '罗安亲手递来同一张DA5-NOTE-1，你按已经实际发生的有限事实书写或更正。之前的失败文字保留；知识10失败也不会抹去此次书写，仍须把这一张原纸交还。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (success(result.tier)) {
    if (r.method === 'ABILITY') {
      f.seed = 'PLANTED'; r.status = 'PREPARED';
      ctx.note('本次种子已埋下，尚未催化', '1行动与3灵性已经实际支付，知识14埋种成功，但尚无催化效果、报告或奖励。本次接触仍开着：可在同一已付实践中以0额外行动、另2灵性尝试催化，也可0行动停止并实际等过有限窗口使种子到期。');
    } else {
      r.status = 'EXAMINED'; r.outcome = p.id === 'calm-boundary' ? 'CALM_CHECKED' : p.id === 'eager-rehearsal' ? 'TALK_CHECKED' : 'ACCOUNT_CHECKED';
      ctx.note(p.title, resultText(s, p.id) + '本次接触与原物交接尚未收束，先0行动实际结束。');
    }
  } else {
    r.status = 'OBSERVED';
    ctx.note(p.title, (r.method === 'ABILITY' ? '3灵性与1行动已付，埋种失败，本次没有种子或催化效果。' : '普通核对未形成可报告结果，1行动已付；已经发生的原物交接、书写与当面接触保留。') + '先0行动实际结束，下一真实周再准备，失败不退款。');
  }
}

export function desireApostleActions(s: SliceState): DesireApostleAction[] {
  if (!active(s)) return [];
  const out: DesireApostleAction[] = [];
  const add = (id: string, label: string, cost: string, command: DesireApostleActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.desireApostle.cases[p.id]!, pending = p.id === 'eager-rehearsal' && r.contactOpen && s.desireApostle.practice.seed === 'PLANTED';
    if (pending) add(`${p.id}-catalyze`, '在当前强烈情绪下尝试一次催化', '0额外行动 · 另2灵性 · 知识14 · 失败照耗', { type: 'CATALYZE', caseId: 'eager-rehearsal' });
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'calm-boundary' ? '亲手归还同一本原记录册' : p.id === 'eager-rehearsal' ? '停止并实际等待本次有限窗口到期' : '亲手交付同一张原记录纸', '0行动 · 0灵性 · 实际收束 · 不退款', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场与本人的当面表述', '1行动 · 不读取隐藏内心', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      if (p.ability) add(`${p.id}-ability`, '准备本人同意的有限埋种与催化', '1行动 · 建议预留5灵性 · 尚未施法', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备普通核对或书写', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED' && !r.contactOpen) {
      add(`${p.id}-perform`, r.method === 'ABILITY' ? '实际尝试本次有限埋种' : '实际完成普通核对或书写', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识14 · 成功后催化另需2灵性' : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已经实际发生的有限结果', '1行动 · 先实际收束', { type: 'REPORT', caseId: p.id });
  }
  if (!s.desireApostle.reflected) add('desire-apostle-reflect', '回看条件、事实与普通替代', '1行动 · 三份真实报告后', { type: 'REFLECT' });
  if (s.desireApostle.encounter.status === 'AVAILABLE') {
    add('desire-apostle-encounter-talk', '到原空院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('desire-apostle-encounter-fight', '到原空院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}

export function desireApostleCases(s: SliceState): DesireApostleProjection['cases'] {
  if (!active(s)&&!(s.progression.pathwayId==='abyss'&&(s.progression.sequence===4||s.progression.sequence===3))) return [];
  return CASES.map(p => {
    const r = s.desireApostle.cases[p.id]!, pending = p.id === 'eager-rehearsal' && r.contactOpen && s.desireApostle.practice.seed === 'PLANTED';
    const result = pending ? '本次种子已成功埋下，尚无催化效果与奖励。仍须当前强烈情绪、另2灵性，可0额外行动催化；也可0行动停止并实际等过有限窗口。' : ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p.id) + (r.contactOpen ? '尚须实际结束接触与原物交接。' : '本次接触与原物交接已实际结束。') : r.attemptWeek !== null ? '上次没有形成可报告结果，已付成本与真实记录保留；先实际收束，下一真实周再准备。' : r.withdrawals ? '准备已取消，未开始新的接触。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' && !pending ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触尚未结束，须显式停止并完成原物交接' : '无尚未结束的本次接触', closes: r.closes };
  });
}
export function desireApostlePractice(s: SliceState): DesireApostleProjection['practice'] {
  if (!active(s)) return null;
  const f = s.desireApostle.practice;
  return {
    emotion: f.emotion === 'STRONG' ? '本次原排练当前强烈兴奋，来源为米蕾尔已有演出期待与实际表述' : '无正在进行的强烈情绪试验；平稳或已实际结束本次窗口',
    seed: f.seed === 'PLANTED' ? '本次种子待处理：尚无催化效果，另需2灵性；可0行动催化或停止等待到期' : f.seed === 'SPENT' ? '本次种子已用于一次催化尝试，成败照实记录' : f.seed === 'EXPIRED' ? '未催化种子已在实际停止后的原创G有限窗口到期' : '没有本次种子',
    records: `原记录册DA5-LEDGER-1：${f.ledger === 'PLAYER' ? '本人手中，须亲手归还' : '罗安保管'}；同一原纸DA5-NOTE-1：${f.note === 'WRITTEN' ? '已书写，须亲手交付' : f.note === 'HANDED_OVER' ? '已亲手交给罗安，实际文字保留' : '原空白纸尚未书写'}`,
    history: [f.pauseObserved ? '真实成功催化曾产生一次可见迟疑，未产生永久控制或隐藏真相' : '没有成功催化的可见迟疑记录；普通自愿配合不计能力效果', '新增人物、场地、原物、有限窗口、判定与成本均为原创G，非原著通用安全保证'],
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function validateDesireApostleLife(s: SliceState): boolean {
  const m = s.desireApostle;
  if (!record(m) || !record(m.cases) || !shape(m.cases, DESIRE_APOSTLE_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || typeof m.reflected !== 'boolean') return false;
  const f = m.practice;
  if (!record(f) || !shape(f, ['emotion', 'seed', 'pauseObserved', 'ledger', 'note']) || !['CALM', 'STRONG'].includes(f.emotion) || !['NONE', 'PLANTED', 'SPENT', 'EXPIRED'].includes(f.seed) || typeof f.pauseObserved !== 'boolean' || !['GUIDE', 'PLAYER'].includes(f.ledger) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note)) return false;
  const promotion = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.method === 'ABILITY' && p.id !== 'eager-rehearsal' || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `desire-apostle-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) {
      const expected = p.id === 'calm-boundary' ? 'CALM_CHECKED' : p.id === 'honest-account' ? 'ACCOUNT_CHECKED' : r.method === 'ABILITY' ? 'CATALYSIS_CHECKED' : 'TALK_CHECKED';
      if (r.attemptWeek === null || r.method === null || r.outcome !== expected) return false;
    } else if (r.outcome !== 'NONE') return false;
    const planted = p.id === 'eager-rehearsal' && f.seed === 'PLANTED';
    if (r.status === 'PREPARED') {
      prepared += 1;
      if (r.method === null || (planted ? !r.contactOpen || r.attemptWeek !== s.week || r.method !== 'ABILITY' : r.contactOpen || r.attemptWeek === s.week)) return false;
    } else if (planted) return false;
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) {
      open += 1;
      if ((!['OBSERVED', 'EXAMINED'].includes(r.status) && !planted) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
  }
  const calm = m.cases['calm-boundary']!, eager = m.cases['eager-rehearsal']!, account = m.cases['honest-account']!;
  if (open > 1 || prepared > 1 || open && prepared && f.seed !== 'PLANTED') return false;
  if ((f.ledger === 'PLAYER') !== calm.contactOpen || (f.note === 'WRITTEN') !== account.contactOpen || (f.emotion === 'STRONG') !== eager.contactOpen) return false;
  if ((f.note === 'BLANK') !== (account.attemptWeek === null) || (f.note === 'HANDED_OVER') !== (account.attemptWeek !== null && !account.contactOpen)) return false;
  if (f.pauseObserved !== (eager.outcome === 'CATALYSIS_CHECKED') || f.pauseObserved && f.seed !== 'SPENT') return false;
  if (eager.attemptWeek === null && f.seed !== 'NONE') return false;
  if (f.seed === 'EXPIRED' && (eager.contactOpen || eager.closes < 1 || eager.outcome !== 'NONE')) return false;
  if (eager.contactOpen && eager.method === 'ORDINARY' && f.seed !== 'NONE') return false;
  if (f.seed === 'SPENT' && (eager.attemptWeek === null || eager.contactOpen && eager.method !== 'ABILITY')) return false;
  if (s.seer.completedSources.filter(x => x === 'desire-apostle-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId==='abyss' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)) && ((s.progression.sequence===4||s.progression.sequence===3)?s.devil.desireApostleActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (Object.values(m.cases).some(r => r.status !== 'AVAILABLE') || f.emotion !== 'CALM' || f.seed !== 'NONE' || f.pauseObserved || f.ledger !== 'GUIDE' || f.note !== 'BLANK' || m.reflected)) return false;
  return true;
}
