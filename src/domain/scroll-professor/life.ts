import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyWizardActivity } from '../wizard/life.js';
import { WIZARD_SPELLS } from '../wizard/content.js';
import { SCROLL_PROFESSOR_KIT_PRICE, SCROLL_PROFESSOR_SCROLLS } from './content.js';
import { applyScrollProfessorEncounter, blockScrollProfessorEncounter, SCROLL_PROFESSOR_ENCOUNTER_STORY } from './encounter.js';
import { validateScrollProfessorCommand } from './index.js';
import { SCROLL_PROFESSOR_CASE_IDS, SCROLL_PROFESSOR_SCROLL_KINDS,
  type ScrollProfessorCommand, type ScrollProfessorActivityCommand, type ScrollProfessorAction,
  type ScrollProfessorProjection, type ScrollProfessorScrollKind,
} from './types.js';

const CASES = [
  { id: 'paper-target', kind: 'IMPACT', title: '制卷台上的原纸标',
    story: '成年导师伊蕾将自己的一张原纸标放在制卷台近端，目标线距离两米以内。她同意只对这张无人持握的原轻纸作有限试验，纸标归属不变；先核对原物与空出的桌面，再实施。',
    facts: ['眼前原纸标与目标线均实际可见，没有旁人或额外目标。', '卷轴须另行事先制造；课堂原纸标不是材料，也不是战斗装备。'],
    ability: '使用一张已实际制成的有限冲力原卷轴，只作用于眼前原纸标；失败也烧尽该卷。',
    ordinary: '沿原桌边走到纸标处，普通手取同一张纸放到原标线，不耗灵性。',
    result: '原纸标已实际移至原标线并核实为同一原物，仍属伊蕾；没有遥取其他物件或移动任何人。', outcome: 'PAPER_VERIFIED' },
  { id: 'soft-ward', kind: 'WARD', title: '双方同意的软纸球护持试验',
    story: '伊蕾本人同意仅做一次原软纸球轻微试验，并保留随时停止权。你们检查两人站位和空出的原桌面；没有真实武器，原球与软垫板都是教学室物品。',
    facts: ['双方均为明确同意本次试验的成年人；同意不扩大至任何真实打击。', '试验只记录一次轻微冲击，不保证刀枪不入，不治疗旧伤。'],
    ability: '使用一张预先制成的短时护持原卷轴进行这一次轻微试验，失败也耗尽原卷，随后实际结束。',
    ordinary: '用原软垫板挡下原软纸球作为普通对照，不施法、不耗灵性，随后交回原处。',
    result: '一次原软纸球试验已实际完成；只报告这一场有限结果，原器具没有变成你的装备。', outcome: 'WARD_VERIFIED' },
  { id: 'willing-reader', kind: null, title: '愿意了解卷轴边界的成年人',
    story: '成年读者米娅愿意听你说明已经发生的纸标与软球记录。她只同意这次有限讲解，可以拒绝或提出不理解之处；你不向她施法，不交付卷轴，不承诺教会全部魔法。',
    facts: ['米娅本人到场且明确愿意听这次已有事实讲解。', '讲解材料只含前两项真实结果、普通方法、真实成本与失败风险。'],
    ability: '根据已有真实记录解释先学术式、事先制卷、一次耗尽与使用可失败，请本人复述所理解的边界。',
    ordinary: '用已有公开报告作普通讲解，听取本人问题并请她复述；没有新施法、赠卷或强制教学。',
    result: '米娅本人已复述本次既有记录和有限边界；这只证明这次理解，不代表她学会法术或授权任何后续试验。', outcome: 'LESSON_VERIFIED' },
] as const;

export const SCROLL_PROFESSOR_ENVIRONMENT = '本作G制卷工房：每真实周最多购买1包、1行动100便士，每包有4份独立材料。只写入本人已学的有限牵引或短时护持；制造1行动2灵性、知识14，每次实际耗1份材料，失败不返还。成功卷轴持久保留、启动耗1灵性并一次烧用；使用仍可失败。教学及普通对照不耗灵性。每次实践须0行动实际结束接触与短时效果，才可报告或离开。' + SCROLL_PROFESSOR_ENCOUNTER_STORY;
export const scrollProfessorInside = (s: SliceState) => Object.values(s.scrollProfessor.cases).some(r => r.contactOpen);
export const isScrollProfessorActivity = (c: ScrollProfessorCommand): c is ScrollProfessorActivityCommand =>
  ['LEARN_SPELL', 'BUY_KIT', 'CRAFT_SCROLL', 'AUTHORIZE_SCROLL', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const active = (s: SliceState) => s.progression.pathwayId === 'hermit' && (s.progression.sequence === 6 || s.progression.sequence === 5 || (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
const heldScroll = (s: SliceState, kind: ScrollProfessorScrollKind) => s.scrollProfessor.workshop.scrolls.find(scroll => scroll.kind === kind && scroll.status === 'HELD');

function blocked(s: SliceState, c: ScrollProfessorActivityCommand): string | null {
  if ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)) && !['LEARN_SPELL','BUY_KIT','CRAFT_SCROLL','AUTHORIZE_SCROLL'].includes(c.type)) return '卷轴教授经历已归档，请在当前序列成长页继续实践。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockScrollProfessorEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成卷轴教授晋升。';
  const m = s.scrollProfessor, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (scrollProfessorInside(s)) return '先0行动实际结束本次接触、护持或普通对照。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗；原卷授权只能在战斗外改变。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德伊蕾的原教学室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (c.type === 'AUTHORIZE_SCROLL') {
    const scroll = m.workshop.scrolls.find(x => x.id === c.scrollId);
    return !scroll || scroll.status !== 'HELD' ? '只能授权或取消授权自己实际持有且尚未使用的同一原卷轴。'
      : scroll.authorized === c.authorized ? '这张原卷轴的授权状态没有变化。' : null;
  }
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前已准备的事项。';
  if (c.type === 'LEARN_SPELL') {
    const lesson = s.wizard.lessons[c.spellId];
    return !lesson ? '未知巫师课程。' : lesson.learned ? '已经实际学过此术。' : lesson.attemptWeek === s.week ? '本周学习未成，下一真实周可重试。' : s.cash < 60 ? '学习旧巫师课程需要60便士。' : null;
  }
  if (c.type === 'BUY_KIT') return m.workshop.lastKitWeek === s.week ? '本真实周已购买一包，下一真实周才有下一包可购。' : s.cash < SCROLL_PROFESSOR_KIT_PRICE ? '这一包材料需要100便士。' : null;
  if (c.type === 'CRAFT_SCROLL') return !s.wizard.lessons[SCROLL_PROFESSOR_SCROLLS[c.kind].spellId]!.learned
    ? '先实际学习对应的巫师术式，晋升与知道名称不能代替学会。'
    : !m.workshop.materials.some(x => x.status === 'HELD') ? '没有实际持有的独立制卷材料份额。'
      : s.spirituality < 2 ? '制造需要2灵性，不能透支。' : null;
  if (c.type === 'REFLECT') return m.reflected ? '已回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原物与本人本次同意。'
    : r.attemptWeek === s.week ? '本周实践未成，下一真实周再重新准备。'
      : c.method === 'ABILITY' && p.kind && !heldScroll(s, p.kind) ? '需要一张已实际制成、匹配本案且尚未使用的实体卷轴，或选择普通方法。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得真实结果，并实际结束本次接触。';
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && p.kind ? !heldScroll(s, p.kind) ? '准备中的原卷轴已不在手中，须取消准备后重新处理。' : s.spirituality < 1 ? '烧用卷轴需要1灵性，不能透支；可取消后采用普通方法。' : null : null;
}

export function applyScrollProfessorActivity(s: SliceState, c: ScrollProfessorActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateScrollProfessorCommand(c) || !isScrollProfessorActivity(c)) throw new Error('卷轴教授活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyScrollProfessorEncounter(s, c, ctx); return; }
  const m = s.scrollProfessor, w = m.workshop;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次接触与效果', '本次预付练习时间中，你与对方实际停止试验与讲解，等短时护持结束，或将原软垫板放回；伊蕾在需要时协助收束。原物和归属保留，0行动，不退款、不补卷、不治疗；没有把本次效果带出现场。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消准备，未烧用新卷，原物与已付成本保留；此前真正耗尽的卷轴不会恢复。'); return;
  }
  if (c.type === 'AUTHORIZE_SCROLL') {
    const scroll = w.scrolls.find(x => x.id === c.scrollId)!; scroll.authorized = c.authorized;
    ctx.note(c.authorized ? '授权这张原卷轴一次战斗使用' : '取消这张原卷轴的战斗授权', `${scroll.id}：${SCROLL_PROFESSOR_SCROLLS[scroll.kind].title}仍实际持有。${c.authorized ? '只准许匹配的主攻或自保槽自动烧用本张一次，使用可失败且失败也耗尽；没有授权其他卷轴。' : '匹配战斗槽也不会烧用本张。'}0行动、0灵性，本次没有使用卷轴。`); return;
  }
  if (c.type === 'LEARN_SPELL') { applyWizardActivity(s, c, ctx, award); return; }
  s.actionsRemaining -= 1;
  if (c.type === 'BUY_KIT') {
    s.cash -= SCROLL_PROFESSOR_KIT_PRICE; w.kitsBought += 1; w.lastKitWeek = s.week;
    for (let i = 0; i < 4; i += 1) w.materials.push({ id: `scroll-professor-material-${w.materials.length + 1}`, acquiredWeek: s.week, status: 'HELD', spentWeek: null });
    ctx.note('购买四份独立G制卷材料', `花费1行动、100便士，第${w.kitsBought}包本作原创G封装低强灵性材料实际交付，含4份独立材料并逐份记录来源。本周不再供应第二包，已有材料可跨周持有；不是原著材料名称或完整数量配方。`); return;
  }
  if (c.type === 'CRAFT_SCROLL') {
    const material = w.materials.find(x => x.status === 'HELD')!;
    material.status = 'SPENT'; material.spentWeek = s.week; w.craftAttempts += 1; s.spirituality -= 2;
    const result = ctx.check('knowledge', 14), spec = SCROLL_PROFESSOR_SCROLLS[c.kind];
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      const scroll = { id: `scroll-professor-scroll-${w.scrolls.length + 1}`, kind: c.kind, makerSequence: (s.progression.sequence===2?2:s.progression.sequence===3?3:s.progression.sequence===4?4:s.progression.sequence===5?5:6) as 2|3|4|5|6, inscriptionMastery: s.progression.mastery['hermit.s6.scrollcraft']!, materialId: material.id, createdWeek: s.week, status: 'HELD' as const, usedWeek: null, authorized: false };
      w.scrolls.push(scroll);
      ctx.note('制卷成功，实体原卷入囊', `${scroll.id}：${spec.title}。本人已学对应巫师术式，花费1行动、2灵性，实际耗尽材料${material.id}。制造时序列${scroll.makerSequence}与卷轴掌握${scroll.inscriptionMastery}固定在本卷记录。${spec.effect}未用卷可跨周保留；目前未授权战斗自动使用，使用仍可能失败。`);
    } else {
      w.craftFailures += 1; ctx.note('制卷失败，材料照耗', `本次${spec.title}没有形成可用卷轴。1行动、2灵性和独立材料${material.id}已实际耗尽，没有新卷、材料退款或免费复制。`);
    }
    return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('scroll-professor-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看制卷与有限教学的边界', '你将已有事实、普通对照、先学后制、实际材料、一次消耗及本人自愿理解分开记录。G扮演+25；没有补造卷轴、自动学术或得到星象与神秘再现。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`scroll-professor-case:${p.id}`, 8);
    ctx.note(p.title, p.result + (r.method === 'ORDINARY' ? '本次采用普通方法，没有虚构施法或制卷。' : '') + '本次接触已实际结束，G扮演+25，已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY' && p.kind) {
    const scroll = heldScroll(s, p.kind)!; s.spirituality -= 1; scroll.status = 'USED'; scroll.usedWeek = s.week; scroll.authorized = false; r.usedScrollIds.push(scroll.id);
    ctx.note('实际烧用同一张原卷轴', `${scroll.id}（${SCROLL_PROFESSOR_SCROLLS[scroll.kind].title}）已耗尽，材料来源${scroll.materialId}与制造掌握${scroll.inscriptionMastery}保留供核对。该卷不因判定失败复原，不返还制造成本，本次另耗1灵性启动，失败也不退还。`);
  }
  const result = ctx.check('knowledge', p.kind ? r.method === 'ABILITY' ? 14 : 10 : 12);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome; ctx.note(p.title, p.result + '须先0行动实际结束本次接触再报告。');
  } else {
    r.status = 'OBSERVED';
    ctx.note(p.title, (p.kind ? '本次原物试验未取得可报告结果，成本保留，已经使用的卷轴确实耗尽。' : '米娅本人尚未理解或不愿继续这次讲解，你尊重她的拒绝；没有强制学习，也没有交付卷轴。') + '先0行动实际结束接触；下一真实周可重新准备更有限的方案。');
  }
}

export function scrollProfessorActions(s: SliceState): ScrollProfessorAction[] {
  if (!active(s)) return [];
  const out: ScrollProfessorAction[] = [];
  const add = (id: string, label: string, cost: string, command: ScrollProfessorActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spell of WIZARD_SPELLS) if (!s.wizard.lessons[spell.id]!.learned) add(`scroll-professor-learn-${spell.id}`, `补学原巫师课程：${spell.label}`, '1行动 · 60便士 · 知识12 · 不新增S6法术', { type: 'LEARN_SPELL', spellId: spell.id });
  add('scroll-professor-buy-kit', '购买4份独立G制卷材料', '1行动 · 100便士 · 每真实周最多1包', { type: 'BUY_KIT' });
  for (const kind of SCROLL_PROFESSOR_SCROLL_KINDS) add(`scroll-professor-craft-${kind}`, `事先制造${SCROLL_PROFESSOR_SCROLLS[kind].title}`, '1行动 · 2灵性 · 1份实际材料 · 知识14 · 失败照耗', { type: 'CRAFT_SCROLL', kind });
  for (const scroll of s.scrollProfessor.workshop.scrolls) if (scroll.status === 'HELD') add(`scroll-professor-authorize-${scroll.id}`, `${scroll.authorized ? '取消' : '明确允许'}${scroll.id}战斗自动烧用一次`, '0行动 · 仅本张 · 匹配主攻/自保槽 · 使用可失败', { type: 'AUTHORIZE_SCROLL', scrollId: scroll.id, authorized: !scroll.authorized });
  if(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))return out;
  for (const p of CASES) {
    const r = s.scrollProfessor.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, '实际结束本次接触与短时效果', '0行动 · 实际收束/放回原板 · 不补卷', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原物与本人的本次同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, p.kind ? `准备${SCROLL_PROFESSOR_SCROLLS[p.kind].title}实际试验` : '准备已有事实的有限教学', '1行动 · 不补造物品', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'paper-target' ? '准备普通手取同一纸标' : p.id === 'soft-ward' ? '准备原软垫板普通对照' : '准备普通讲解与本人复述', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, p.kind ? '实际完成本次有限试验' : '向米娅讲解并请本人核实', p.kind && r.method === 'ABILITY' ? '1行动 · 实际原卷1 · 1灵性 · 失败照耗' : '1行动 · 0灵性 · 无新卷 · 本人可拒绝', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告实际结果与有限边界', '1行动 · 先结束本次接触', { type: 'REPORT', caseId: p.id });
  }
  if (!s.scrollProfessor.reflected) add('scroll-professor-reflect', '回看制卷、消耗与自愿教学', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.scrollProfessor.encounter.status === 'AVAILABLE') {
    add('scroll-professor-encounter-talk', '到原教学室外院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('scroll-professor-encounter-fight', '到原教学室外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function scrollProfessorCases(s: SliceState): ScrollProfessorProjection['cases'] {
  if (!active(s)) return [];
  return CASES.map(p => { const r = s.scrollProfessor.cases[p.id]!; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result + (r.method === 'ORDINARY' ? '本次为普通方法。' : '') : r.attemptWeek !== null ? '上次没有形成可报告结果，已付成本与本人意愿保留；下一真实周可重新准备。' : r.withdrawals ? '准备已取消，尚未烧用的原卷保留。' : null, status: r.status, contactOpen: r.contactOpen ? '本次接触或短时效果仍待实际结束' : '没有尚未结束的本次接触或效果', closes: r.closes }; });
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** One actual material can produce at most one original; a used original cannot be authorized again. */
export function validateScrollProfessorLife(s: SliceState): boolean {
  const m = s.scrollProfessor;
  if (!record(m) || !record(m.cases) || !shape(m.cases, SCROLL_PROFESSOR_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const w = m.workshop, promotion = m.promotionWeek ?? s.week;
  if (!record(w) || !shape(w, ['kitsBought', 'lastKitWeek', 'materials', 'craftAttempts', 'craftFailures', 'scrolls'])) return false;
  if (!integer(w.kitsBought, 0, Math.max(0, s.week - promotion + 1)) || !Array.isArray(w.materials) || w.materials.length !== w.kitsBought * 4 || !integer(w.craftAttempts, 0, w.materials.length) || !integer(w.craftFailures, 0, w.craftAttempts) || !Array.isArray(w.scrolls) || w.scrolls.length !== w.craftAttempts - w.craftFailures) return false;
  if (w.kitsBought === 0 ? w.lastKitWeek !== null : !integer(w.lastKitWeek, promotion, s.week)) return false;
  let spent = 0, previousKitWeek = promotion - 1;
  for (const [index, material] of w.materials.entries()) {
    if (!record(material) || !shape(material, ['id', 'acquiredWeek', 'status', 'spentWeek']) || material.id !== `scroll-professor-material-${index + 1}` || !integer(material.acquiredWeek, promotion, s.week)) return false;
    if (index % 4 === 0) { if (material.acquiredWeek <= previousKitWeek) return false; previousKitWeek = material.acquiredWeek; }
    else if (material.acquiredWeek !== previousKitWeek) return false;
    if (material.status === 'HELD') { if (material.spentWeek !== null) return false; }
    else if (material.status === 'SPENT') { if (!integer(material.spentWeek, material.acquiredWeek, s.week)) return false; spent += 1; }
    else return false;
  }
  if (spent !== w.craftAttempts || w.kitsBought > 0 && previousKitWeek !== w.lastKitWeek) return false;
  const usedMaterials = new Set<string>(); let previousCreated = promotion;
  for (const [index, scroll] of w.scrolls.entries()) {
    if (!record(scroll) || !shape(scroll, ['id', 'kind', 'makerSequence', 'inscriptionMastery', 'materialId', 'createdWeek', 'status', 'usedWeek', 'authorized'])) return false;
    if (scroll.id !== `scroll-professor-scroll-${index + 1}` || !SCROLL_PROFESSOR_SCROLL_KINDS.includes(scroll.kind) || ![6,5,4,3,2].includes(scroll.makerSequence) || !integer(scroll.inscriptionMastery, 0, 500) || typeof scroll.authorized !== 'boolean') return false;
    if (scroll.makerSequence === 2 && (s.progression.pathwayId !== 'hermit' || s.progression.sequence !== 2 || !integer(s.sage?.promotionWeek, promotion, s.week) || scroll.createdWeek < s.sage.promotionWeek!)) return false;
    if(scroll.makerSequence===3&&(s.prophecyMaster.promotionWeek===null||scroll.createdWeek<s.prophecyMaster.promotionWeek))return false;
    if(scroll.makerSequence===4&&(s.mystic.promotionWeek===null||scroll.createdWeek<s.mystic.promotionWeek))return false;
    if (scroll.makerSequence === 5 && (s.starMystic.promotionWeek === null || scroll.createdWeek < s.starMystic.promotionWeek)) return false;
    if (!s.wizard.lessons[SCROLL_PROFESSOR_SCROLLS[scroll.kind].spellId]?.learned || s.wizard.lessons[SCROLL_PROFESSOR_SCROLLS[scroll.kind].spellId]!.attemptWeek! > scroll.createdWeek) return false;
    if (scroll.inscriptionMastery > (s.progression.mastery['hermit.s6.scrollcraft'] ?? 0)) return false;
    const material = w.materials.find(x => x.id === scroll.materialId);
    if (!material || material.status !== 'SPENT' || material.spentWeek !== scroll.createdWeek || usedMaterials.has(scroll.materialId) || !integer(scroll.createdWeek, Math.max(previousCreated, material.acquiredWeek), s.week)) return false;
    usedMaterials.add(scroll.materialId); previousCreated = scroll.createdWeek;
    if (scroll.status === 'HELD') { if (scroll.usedWeek !== null) return false; }
    else if (scroll.status === 'USED') { if (!integer(scroll.usedWeek, scroll.createdWeek, s.week) || scroll.authorized) return false; }
    else return false;
  }
  let open = 0, prepared = 0, resolved = 0;
  const caseScrollIds = new Set<string>();
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'usedScrollIds'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean' || !Array.isArray(r.usedScrollIds)) return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `scroll-professor-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week || r.method === 'ABILITY' && p.kind && !heldScroll(s, p.kind)) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.usedScrollIds.length !== 0)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.usedScrollIds.length !== 0)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (r.usedScrollIds.length > r.closes + (r.contactOpen ? 1 : 0) || !p.kind && r.usedScrollIds.length > 0) return false;
    let previousUse = promotion - 1;
    for (const id of r.usedScrollIds) {
      if (typeof id !== 'string' || caseScrollIds.has(id)) return false;
      const scroll = w.scrolls.find(x => x.id === id);
      if (!scroll || scroll.status !== 'USED' || scroll.kind !== p.kind || !integer(scroll.usedWeek, previousUse + 1, r.attemptWeek ?? 0)) return false;
      caseScrollIds.add(id); previousUse = scroll.usedWeek!;
    }
    if (p.kind && r.method === 'ABILITY' && r.attemptWeek !== null && r.status !== 'PREPARED' && previousUse !== r.attemptWeek) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'scroll-professor-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (active(s) && ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))?s.starMystic.scrollProfessorActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (w.kitsBought !== 0 || w.materials.length !== 0 || w.craftAttempts !== 0 || w.scrolls.length !== 0 || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
