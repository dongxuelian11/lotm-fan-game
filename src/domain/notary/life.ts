import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyNotaryEncounter, blockNotaryEncounter, NOTARY_ENCOUNTER_STORY } from './encounter.js';
import { NOTARY_AGREEMENT, NOTARY_CARETAKER, NOTARY_GUIDE, NOTARY_TOOL_SOURCE } from './content.js';
import { NOTARY_CASE_IDS, type NotaryCommand, type NotaryActivityCommand, type NotaryAction, type NotaryProjection } from './types.js';

const REFUSAL = `${NOTARY_CARETAKER}当面明确拒绝：“我不会签下让我放弃亲自看守原器具箱的条款。”原方案没有本人认可，不成立契约，也不抽成功骰。`;
const NEW_FACT = '本人明确允许的新范围：自己继续在原箱旁看守，只同意核对眼前原标签和原登记簿这一项任务；不允许移走原箱、替换原件或把拒绝解释成同意。';
const REVISION = '下一真实周实际删除放弃看守责任的条款，改为米菈亲自看守原箱时当面核对原标签与原登记簿这一项窄任务。本人已明确同意此范围，原拒绝仍保留；能力只公证本人已有的短时圣光以辅助看清，不生成新的签名契约。';
const CASES = [
  {
    id: 'limited-light', title: '原靶上的一小束圣光',
    story: `${NOTARY_GUIDE}在原礼拜堂工作间安排一次自愿比较。${NOTARY_CARETAKER}当面同意观看原台架上原靶的照明。你可实际使用自己已掌握的有限神圣之光，再对这一次现有效果作“有效”公证；普通方法点亮原桌灯。没有污染对象、真假裁决或清除排异。（G）`,
    facts: ['原台架、原靶和原桌灯均在眼前，所有权不转移。', '公证对象是玩家已经掌握并在本次实际使用的有限神圣之光，不是凭空出现的能力。', '有效公证成功只暂时略增强本次现有效果；实际停止照明并退离才结束接触。'],
    ability: '准备对本人当场施展到原靶上的有限神圣之光作“有效”公证；实施合计3灵性、知识14，结果可能失败，具体成本与有限强度为G。',
    ordinary: '准备原桌灯的普通照明比较，不使用公证或神圣之光；知识10，0灵性。',
    abilityResult: '你实际在原靶上使用已有神圣之光，并以“有效”公证让当前这一小束光暂时稍强。原靶仍是原物，没有污染被清除，也没有获得关于其它事实的真伪答案。',
    ordinaryResult: '你点亮原桌灯，完成原靶上的普通照明比较。没有施展神圣之光或公证，没有改变任何污染。',
    abilityOutcome: 'LIGHT_NOTARIZED', ordinaryOutcome: 'LAMP_COMPARED',
  },
  {
    id: 'rejected-terms', title: '不能替本人签下的条款',
    story: `${NOTARY_CARETAKER}当面说明亲自看守受托原器具箱是自己的责任。原提议却要求她放弃这项看守，因此第一次提出时必然被她拒绝。能力不能把未经认可的条款变成约束；原导师见证本人回答和后来的窄任务修订。（G）`,
    facts: ['米菈本人在原器具箱旁，原箱与原登记簿均未移动。', '她从未签名或认可放弃看守责任的原条款；拒绝不因能力消耗而失效。', '首次拒绝后必须实际结束接触，下一真实周才依本人允许的新范围重新准备。'],
    ability: '准备提出原条款；第一次实施实际耗3灵性，但米菈会明确拒绝，契约不成立，不抽成功骰，不移动原箱。',
    ordinary: '准备普通口头说明原提议；本人同样可以明确拒绝，不能把不签名当作同意。',
    abilityResult: '米菈始终亲自看守原箱，按修订后自愿接受的窄任务核对原标签和原登记簿。你用已有有限圣光并对当前效果作“有效”公证辅助看清；没有契约绑定她，没有改写首次拒绝。',
    ordinaryResult: '米菈按下一真实周修订后的窄任务，在继续亲自看守原箱的同时普通核对原标签和原登记簿。没有使用公证、没有签名契约，原拒绝完整保留。',
    abilityOutcome: 'NARROW_TASK_NOTARIZED', ordinaryOutcome: 'NARROW_TASK_AGREED',
  },
  {
    id: 'signed-tool', title: '签名之后归还同一把工具',
    story: `${NOTARY_TOOL_SOURCE}真实在原桌上。米菈已当面同意你本次借用并归还，同意不延伸到其他物品或他人。玩家可先读明再选择本人签名，准确短约定是：“${NOTARY_AGREEMENT}”签名前可改用普通纸面约定；签名并不自动借走工具。（G）`,
    facts: [`米菈在场并已明确同意本次原工具借还；工具来源：${NOTARY_TOOL_SOURCE}，不会生成副本。`, `你本人可以明确读明、认可并签名的唯一条款：“${NOTARY_AGREEMENT}”`, 'SIGN只记录玩家自己的明确认可，0行动、0灵性；成功实施后才实际借到工具，且只有能力方法启用本次有限契约。', '普通纸面方法不用超自然约束；离开前仍须0行动亲手归还同一原工具。'],
    ability: `准备本人已签名认可的有限约定：“${NOTARY_AGREEMENT}”实施另耗3灵性、知识14；成功后才借出原工具并使本次契约生效。`,
    ordinary: '准备同一把原工具的普通纸面借还约定，不签超自然契约；实施0灵性、知识10，成功后仍要实际归还原件。',
    abilityResult: '本人签名认可的有限契约已在这次成功实施中生效，米菈实际把原测量工具交到你手中。唯一义务是离开前归还同一把原工具；不绑定未签名者，不产生金钱、物品副本或后台惩罚。',
    ordinaryResult: '米菈按普通纸面约定实际把同一把原测量工具交到你手中。没有签名公证契约或超自然约束；仍须实际归还原件。',
    abilityOutcome: 'SIGNED_LOAN', ordinaryOutcome: 'ORDINARY_LOAN',
  },
] as const;

export const NOTARY_ENVIRONMENT = '三项均为原礼拜堂工作间的有限原创G实践，先观察、准备再实施，每次实施都打开现场接触。能力实施3灵性、知识14；普通方法0灵性、知识10。公证只作用现有效果，不是万能真伪裁决；未签名认可不能绑定。首次拒绝真实保留，下一周实际修订；签约只约定归还一把原工具，CLOSE实际停光、归还原件、履行并离开。每项报告G扮演+25、单项掌握+8，三案反思+25，不清除污染、不治疗、不下放序列5能力。' + NOTARY_ENCOUNTER_STORY;
export const notaryInside = (s: SliceState) => Object.values(s.notary.cases).some(r => r.contactOpen);
export const isNotaryActivity = (c: NotaryCommand): c is NotaryActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'SIGN', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateNotaryActivityCommand(c: unknown): c is NotaryActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!NOTARY_CASE_IDS.includes(c.caseId as typeof NOTARY_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'SIGN') return c.caseId === 'signed-tool' && shape(c, ['type', 'caseId']);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: NotaryActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockNotaryEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 6) return '先完成公证人晋升。';
  const r = 'caseId' in c ? s.notary.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未实际结束的本次接触。';
  if (notaryInside(s)) return '先0行动停止本次效果、归还原物并实际退出。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原礼拜堂工作间。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' || c.caseId === 'signed-tool' && r?.status === 'OBSERVED' && s.notary.contract.signed && !s.notary.contract.active ? null : '没有尚未实施的准备或未使用签名可取消。';
  if (Object.entries(s.notary.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (c.type === 'SIGN') {
    if (!r || !['OBSERVED', 'PREPARED'].includes(r.status)) return '先当面观察原工具、本人同意与准确短约定。';
    if (s.notary.contract.signed) return '本人已经签名认可；不能重复签名或扩大条款。';
    return r.status === 'PREPARED' && r.method === 'ORDINARY' ? '当前准备的是普通纸面方法；先取消准备再选择签名契约。' : null;
  }
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.notary.reflected ? '已经回看这段经历。' : CASES.some(p => s.notary.cases[p.id].status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察与当面同意已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对原物、本人同意和本次范围。';
    if (r.attemptWeek === s.week) return '本周结果与拒绝保留，下一个真实周再依原事实准备。';
    return c.caseId === 'signed-tool' && c.method === 'ORDINARY' && s.notary.contract.signed ? '要改用普通方法，先明确取消未使用的签名，不会退还原成本。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (c.caseId === 'signed-tool' && r.method === 'ABILITY' && !s.notary.contract.signed) return '先由你本人读明并明确签名认可这条短约定；准备不能代替签名。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实施需要3灵性；可取消准备后选择普通方法。' : null;
}
export function applyNotaryActivity(s: SliceState, c: NotaryActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateNotaryActivityCommand(c)) throw new Error('公证人实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyNotaryEncounter(s, c, ctx); return; }
  const m = s.notary;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]; r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'signed-tool' && m.contract.tool === 'PLAYER') {
      m.contract.tool = 'TABLE';
      if (m.contract.active) { m.contract.active = false; m.contract.fulfilled = true; }
      ctx.note('亲手归还同一把原工具并离开', `0行动、0灵性把${NOTARY_TOOL_SOURCE}从自己手中实际放回原桌；${m.contract.fulfilled ? '本人签名的本次活动契约已实际履行并终止。' : '普通纸面借还已完成，没有超自然契约。'}然后退离现场，没有副本、退款或传送，已付成本与历史保留。`);
    } else ctx.note('实际停下本次效果并退出', '0行动、0灵性停止本次有限圣光、公证增强或原桌灯照明，结束谈话并实际退离；若本次借用失败，原工具始终留在原桌，没有虚构归还。原拒绝、本人签名、观察、代价和结果保留，不退灵性、不治疗、不清零污染。');
    return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'signed-tool' && !m.contract.active && !m.contract.fulfilled) m.contract.signed = false;
    ctx.note('取消尚未实施的准备', c.caseId === 'signed-tool' ? '0行动明确取消本次尚未使用的本人签名和准备；原工具仍在原桌，没有退还已付行动、借走工具或传送归还。' : '0行动取消尚未实施的准备；原观察、拒绝和修订依据保留，不改写其它事项的有效签名或履行历史。'); return;
  }
  if (c.type === 'SIGN') {
    m.contract.signed = true;
    ctx.note('本人读明并签名认可', `你当着原导师和米菈的面实际读明并自愿签下：“${NOTARY_AGREEMENT}”米菈此前当面同意的范围仅是这一次原工具借还。0行动、0灵性；尚未借到原工具，也尚未形成活动契约，不绑定其它人或条款。`); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('notary-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('公证范围与本人认可', '回看原靶现有效果、不能代签的拒绝和同一把原工具的实际借还。G扮演+25；公证不创造任意事实，签名只覆盖本人读明认可的窄条款，归还原件才完成本次承诺。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'rejected-terms' && r.notes === 1 && !r.revised) { r.revised = true; ctx.note('下一周实际修订原条款', REVISION); }
    ctx.note(p.title, r.revised ? REVISION + (c.method === 'ABILITY' ? '本次已有圣光和公证合计另耗3灵性。' : '本次用原灯和普通口头核对。') : c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`notary-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + ' 本次接触已经实际结束，原物已在原处；G扮演+25、已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') { s.spirituality -= 3; ctx.note('本次能力实际支出', '本次3灵性已经支出，失败不退还；公证不能越过本人明确拒绝或缺少签名认可。'); }
  if (p.id === 'rejected-terms' && r.notes === 0) {
    r.status = 'OBSERVED'; r.notes = 1;
    ctx.note('米菈真实拒绝未认可的条款', REFUSAL + ' ' + NEW_FACT + ' 先0行动实际结束接触，下一真实周才能修改原提议。'); return;
  }
  if (r.method === 'ABILITY' && p.id !== 'signed-tool') ctx.note('实际使用已知的有限神圣之光', '本人在当前原物上实际使用此前已经掌握的有限神圣之光，随后只对这一次现有效果作“有效”公证；不是创造新能力、凭空生成光之祭司强度或裁决一切真假。');
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'signed-tool') { m.contract.tool = 'PLAYER'; m.contract.active = r.method === 'ABILITY' && m.contract.signed; }
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + ' 先0行动实际停止效果、归还原物并离开。');
  } else {
    r.status = 'OBSERVED'; if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    ctx.note(p.title, '本次没有形成可报告的有限结果；已付行动与灵性保留。' + (p.id === 'signed-tool' ? '原工具仍在原桌，没有实际借出，契约没有激活；本人未使用的签名仍保留，可明确撤回。' : '本次短时照明和公证仍须实际停止，原事实和首次拒绝没有改变。') + (result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : '') + '先0行动结束接触，下一个真实周可再准备。');
  }
}
export function notaryActions(s: SliceState): NotaryAction[] {
  if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 6) return [];
  const out: NotaryAction[] = [];
  const add = (id: string, label: string, cost: string, command: NotaryActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.notary.cases[p.id];
    if (r.contactOpen) add(p.id + '-close', p.id === 'signed-tool' && s.notary.contract.tool === 'PLAYER' ? '亲手归还同一把原工具并离开' : '实际停止本次效果并退出', '0行动 · 0灵性 · 保留原事实和成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原物、本人同意与本次范围', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      const revised = p.id === 'rejected-terms' && r.notes === 1;
      add(p.id + '-ability', revised ? '改为本人同意的原标签窄任务' : '准备有限能力方案', '1行动 · 实施另耗3灵性 · 知识14', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', revised ? '改为本人同意的普通核对' : '准备普通方法', '1行动 · 实施0灵性 · 知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (p.id === 'signed-tool' && ['OBSERVED', 'PREPARED'].includes(r.status) && !s.notary.contract.signed) add(p.id + '-sign', '本人读明、认可并签名：离开前归还同一把原工具', `0行动 · 0灵性 · “${NOTARY_AGREEMENT}”`, { type: 'SIGN', caseId: 'signed-tool' });
    if (r.status === 'PREPARED') add(p.id + '-perform', '实际实施并核对有限结果', r.method === 'ABILITY' ? '1行动 · 3灵性 · 仍可能失败' : '1行动 · 普通方法 · 0灵性', { type: 'PERFORM', caseId: p.id });
    if (r.status === 'PREPARED' || p.id === 'signed-tool' && r.status === 'OBSERVED' && s.notary.contract.signed) add(p.id + '-withdraw', p.id === 'signed-tool' ? '取消尚未使用的签名与准备' : '取消尚未实施的准备', '0行动 · 不退还原成本', { type: 'WITHDRAW', caseId: p.id });
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与真实边界', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.notary.reflected) add('notary-reflect', '回看现有效果、拒绝与本人签名的边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.notary.encounter.status === 'AVAILABLE') {
    add('notary-encounter-talk', '前往原空院当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('notary-encounter-fight', '前往原空院并承担真实冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function notaryCases(s: SliceState): NotaryProjection['cases'] {
  if (s.progression.pathwayId !== 'sun' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => {
    const r = s.notary.cases[p.id];
    const contractResult = p.id === 'signed-tool' ? s.notary.contract.tool === 'PLAYER' ? ' 当前同一原工具仍在PLAYER手中，须实际归还。' : s.notary.contract.fulfilled ? ' 同一原工具已回TABLE，本人活动契约已履行并终止。' : ' 同一原工具仍在或已实际回到TABLE，无活动契约。' : '';
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...(r.notes ? [REFUSAL, NEW_FACT] : []), ...(r.revised ? [REVISION] : [])], preparation: r.status === 'PREPARED' ? r.revised ? REVISION + (r.method === 'ABILITY' ? '本次以已有圣光和公证辅助。' : '本次只用普通核对。') : r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + contractResult : r.notes ? REFUSAL + (r.revised ? ' 已实际修订，仍须成功核对。' : ' 下一真实周可以修订。') : r.attemptWeek !== null ? '此前实施未成，原成本仍保留。' + contractResult : r.withdrawals ? '尚未使用的准备已明确取消。' : null, status: r.status, contactOpen: r.contactOpen ? '本次接触仍开着，须停止效果、归还原物并实际退离' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
/** Validate only the three original tasks and the one real original tool, without a generic contract framework. */
export function validateNotaryLife(s: SliceState): boolean {
  const m = s.notary;
  if (!record(m) || !record(m.cases) || !shape(m.cases, NOTARY_CASE_IDS) || !record(m.contract) || !shape(m.contract, ['signed', 'active', 'tool', 'fulfilled']) || !Array.isArray(s.seer.completedSources)) return false;
  if (typeof m.contract.signed !== 'boolean' || typeof m.contract.active !== 'boolean' || typeof m.contract.fulfilled !== 'boolean' || !['TABLE', 'PLAYER'].includes(m.contract.tool)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || !integer(r.notes, 0, 1) || typeof r.contactOpen !== 'boolean' || typeof r.revised !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `notary-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.notes !== 0 || r.revised)) return false;
    if (r.status === 'OBSERVED' && r.method !== null && r.attemptWeek === null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.notes !== 0)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (p.id === 'rejected-terms') {
      if (r.notes !== (r.attemptWeek === null ? 0 : 1)) return false;
      if (r.revised && (r.notes !== 1 || r.closes < 1)) return false;
      if (r.status === 'PREPARED' && r.notes === 1 && (!r.revised || r.attemptWeek === s.week)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status as string) && !r.revised) return false;
      if (r.contactOpen && r.revised && r.closes < 1) return false;
    } else if (r.notes !== 0 || r.revised) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const r = m.cases['signed-tool'], contract = m.contract;
  const loanSucceeded = ['EXAMINED', 'RESOLVED'].includes(r.status);
  if ((contract.tool === 'PLAYER') !== (loanSucceeded && r.contactOpen)) return false;
  if (contract.signed && (r.status === 'AVAILABLE' || r.method === 'ORDINARY')) return false;
  if (r.method === 'ABILITY' && (r.contactOpen || loanSucceeded) && !contract.signed) return false;
  if (contract.active !== (loanSucceeded && r.method === 'ABILITY' && r.contactOpen && contract.signed)) return false;
  if (contract.fulfilled !== (loanSucceeded && r.method === 'ABILITY' && !r.contactOpen && contract.signed)) return false;
  if (s.seer.completedSources.filter(x => x === 'notary-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'sun' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.priestOfLight.notaryActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
