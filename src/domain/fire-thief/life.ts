import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { FIRE_THIEF_CASE_IDS, FIRE_THIEF_SAMPLE_IDS, type FireThiefActivityCommand, type FireThiefAction, type FireThiefCommand, type FireThiefProjection, type FireThiefSampleId, type FireThiefCaseState } from './types.js';
import { applyFireThiefEncounter, blockFireThiefEncounter, FIRE_THIEF_ENCOUNTER_STORY } from './encounter.js';

const SAMPLES = {
  FLASH: { label: '闪光', actor: 'SERE', source: '原创成年、自愿参加的序列8戏法大师瑟蕾·芬恩；只能对原不透光屏后的净空目标闪光。', use: '你实际使用偷到的闪光，只照向原不透光屏后的净空目标；没有照射人或改变照明设备。' },
  FROST: { label: '冰霜', actor: 'SERE', source: '原创成年、自愿参加的序列8戏法大师瑟蕾·芬恩；只在原水杯现有水面结出薄霜。', use: '你实际使用偷到的冰霜，在原杯中现有水面形成薄霜；没有凭空造水、造杯或冻结任何人。' },
  COURAGE: { label: '勇气', actor: 'NORTIN', source: '原创成年、自愿参加的序列9歌颂者诺汀·布莱尔；只鼓舞本人完成原普通整理任务。', use: '你实际使用偷到的勇气鼓舞本人，继续完成原普通整理任务；没有控制他人意愿或获得永久精神属性。' },
} as const;
const CASES = [
  { id: 'borrowed-flash', title: '想借闪光，也可能拿到冰霜', story: '艾德温·洛克的原练习室内，成年瑟蕾·芬恩自愿参加有限练习。她实际拥有闪光与冰霜：首次观察时分别对原不透光屏后的净空目标与原杯现有水面演示，各实付本人2灵性。你可以在了解两项后意向偷取闪光，或普通检查遮光屏和原水杯。（原创G）', facts: ['原能力池只有实际已演示的闪光与冰霜；知道意向不等于指定结果。', 'G成功偷取后再抽一次：70%闪光、30%冰霜，失败不抽能力。', '两者都有安全原目标，必须按实际偷到的样本使用，不能改选。'], ability: '准备在瑟蕾知情同意下意向偷取闪光；实施1行动、3灵性、知识14，成功后才确定实际借到闪光还是冰霜。', ordinary: '准备以普通方式检查原遮光屏位置、净空目标与原杯水面，知识10、不耗灵性。', ordinaryResult: '实际核对原不透光屏后的净空目标和原杯水面，记录可安全演示的边界，没有偷取任何能力。', ordinaryOutcome: 'SCREEN_CHECKED' },
  { id: 'separate-windows', title: '借用先结束，原主稍后恢复', story: '同一原练习室内，成年诺汀·布莱尔自愿参加有限练习。首次观察时他以本人2灵性真实展示勇气，并亲自完成一段原普通整理任务。可以尝试偷取这一实际已见能力并区分两种期限，或用普通方法记录同意条款及分别结束的约定。（原创G）', facts: ['本次实际原能力池只有已经演示的勇气，不抽不存在的能力。', 'G自身可用2现场时段，原主受限3现场时段，二者独立。', '自身到期后仍要实际等待原主剩余时段并核实恢复；不能用离开瞬间恢复他。'], ability: '准备只偷取诺汀已真实演示的勇气，实施1行动、3灵性、知识14；借到后以2灵性鼓舞本人完成原普通任务。', ordinary: '准备普通核对两种有限期限、同意条款与原普通任务，知识10、不耗灵性，不冒称实际发生偷取。', ordinaryResult: '通过普通记录区分自身借用与原主受限的两种期限，核对同意条款和原任务；没有冒称实际偷取或时间实验。', ordinaryOutcome: 'WINDOWS_CHECKED' },
  { id: 'unknown-power', title: '没有实际来源，就不借用', story: '原导师留下的一页讨论记录提到一种未在场、未演示的能力，没有对应在场对象。你只能普通核对原记录并标明来源缺口，不能把描述或愿望变成可偷取能力。（原创G）', facts: ['纸上名称不等于实际在场且已知的原能力。', '没有实际来源池，本项不开放能力准备。', '不偷取梦境、念头、行动，不移除污染或不想要的属性。'], ability: '', ordinary: '准备普通核对原记录与缺少的实证，知识10、不耗灵性。', ordinaryResult: '实际核对原记录并注明没有在场对象与亲见演示，因此没有可偷取来源；保留不知道的边界。', ordinaryOutcome: 'LIMIT_REVIEWED' },
] as const;
export const FIRE_THIEF_ENVIRONMENT = '原导师练习室和具体规则为原创G：观察、准备、实施各1行动；首次观察包含志愿者实际演示，每个样本由原主实付2灵性，初始各20且不循环补充。能力实施3灵性、知识14，普通知识10、0灵性。成功偷取建立自身2/原主3个现场时段；USE为0行动、2灵性，WAIT为0行动，各实际推进一时段。这些是已付练习内的有限现场时段，不是墙钟、原著小时数或免费周行动。可借用两次；自身先到期，原主晚一时段恢复。CLOSE实际等待剩余有限时段并核实归还后离开，不瞬间恢复、不返费。没有使用过的借用不能报告，需下周重试。失败照耗、下周重试。每案报告25扮演及原掌握池单项8，三案反思25，可全程普通方法和平100。' + FIRE_THIEF_ENCOUNTER_STORY;
export const fireThiefInside = (s: SliceState) => Object.values(s.fireThief.cases).some(r => r.contactOpen);
export const isFireThiefActivity = (c: FireThiefCommand): c is FireThiefActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'USE', 'WAIT', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is FireThiefActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!FIRE_THIEF_CASE_IDS.includes(c.caseId as typeof FIRE_THIEF_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'USE', 'WAIT', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
const availablePool = (s: SliceState, caseId: string): readonly FireThiefSampleId[] => {
  const demo = s.fireThief.demonstrations.find(d => d.caseId === caseId);
  if (caseId === 'borrowed-flash' && demo?.actor === 'SERE' && demo.samples.join('|') === 'FLASH|FROST') return ['FLASH', 'FROST'];
  if (caseId === 'separate-windows' && demo?.actor === 'NORTIN' && demo.samples.join('|') === 'COURAGE') return ['COURAGE'];
  return [];
};
function blocked(s: SliceState, c: FireThiefActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockFireThiefEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 6) return '先完成盗火人晋升。';
  const p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? s.fireThief.cases[p.id] : null;
  if (['CLOSE', 'USE', 'WAIT'].includes(c.type)) {
    if (!r?.contactOpen) return '没有尚未结束的本次实践。';
    if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '本次原现场位置不符，不能用结束实践瞬移。';
    if (c.type === 'CLOSE') return null;
    const loan = s.fireThief.loan;
    if (loan.caseId !== p?.id || loan.sample === null || r.borrowedSample !== loan.sample) return '没有本次实际成功偷取的能力。';
    if (c.type === 'WAIT') return loan.targetSteps > 0 ? null : '两种有限期限均已实际结束，可以核对并离开。';
    if (loan.playerSteps <= 0) return '自身借用期限已经结束；即使原主尚未恢复也不能继续使用。';
    return s.spirituality < 2 ? '实际使用需要2灵性；可以等待或结束，不能免费使用。' : null;
  }
  if (fireThiefInside(s)) return '先实际等待剩余期限、核实原主恢复并离开本次实践。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德艾德温·洛克的原练习室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(s.fireThief.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.fireThief.reflected ? '已经回看这段经历。' : CASES.some(p => s.fireThief.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') {
    if (r.status !== 'AVAILABLE') return '首次原现场观察和演示已经保留，不能循环演示。';
    if (p.id === 'borrowed-flash' && s.fireThief.instructorSpirituality.SERE < 4 || p.id === 'separate-windows' && s.fireThief.instructorSpirituality.NORTIN < 2) return '原志愿者灵性不足，不能虚构演示。';
    return null;
  }
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先实际观察本项原现场。';
    if (r.attemptWeek === s.week) return '本周实施结果保留，下一真实周再准备。';
    if (c.method === 'ABILITY' && availablePool(s, p.id).length === 0) return '缺少实际在场且亲见演示的原能力来源，只能采用普通方法。';
    return null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && (r.method === 'ORDINARY' || r.usedCount > 0 && r.sourceRestored && r.playerExpiredObserved) ? null : '先取得有限结果；借用须真正使用过，等待两种期限结束并核实原主恢复后才能报告。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.method === 'ABILITY' && availablePool(s, p.id).length === 0) return '实际演示来源不匹配，不能生成能力。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次偷取需要3灵性；可取消准备后选择普通方法。' : null;
}
function advancePeriod(s: SliceState, ctx: SeerContext): void {
  const loan = s.fireThief.loan, r = s.fireThief.cases[loan.caseId!]!;
  loan.elapsedSteps += 1;
  loan.playerSteps = Math.max(0, 2 - loan.elapsedSteps);
  loan.targetSteps = Math.max(0, 3 - loan.elapsedSteps);
  if (loan.playerSteps === 0 && !r.playerExpiredObserved) {
    r.playerExpiredObserved = true;
    ctx.note('自身借用先到期', '实际经过第2个G现场时段，你已不能使用所借能力；原主仍有1个现场时段不能使用该能力，没有同时恢复。');
  }
  if (loan.targetSteps === 0 && !r.sourceRestored) {
    r.sourceRestored = true;
    ctx.note('原主的能力随后恢复', '实际经过第3个G现场时段，原主确认原能力已经恢复可用；没有新增演示、补充灵性或永久转移能力。');
  }
}
const actualResult = (r: FireThiefCaseState) => r.borrowedSample === null ? '' : `本次实际借到${SAMPLES[r.borrowedSample].label}，已实际使用${r.usedCount}次。${r.playerExpiredObserved ? '已观察自身借用到期。' : '自身借用尚未到期。'}${r.sourceRestored ? '已实际核实原主恢复。' : '原主暂时仍不能使用这一能力。'}`;
export function applyFireThiefActivity(s: SliceState, c: FireThiefActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('盗火人实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyFireThiefEncounter(s, c, ctx); return; }
  const m = s.fireThief;
  if (c.type === 'USE' || c.type === 'WAIT') {
    const r = m.cases[c.caseId]!;
    if (c.type === 'USE') {
      s.spirituality -= 2; m.loan.uses += 1; r.usedCount += 1;
      r.outcome = m.loan.sample === 'FLASH' ? 'FLASH_USED' : m.loan.sample === 'FROST' ? 'FROST_USED' : 'COURAGE_USED';
      ctx.note('实际使用所借能力', `0行动、实付2灵性。${SAMPLES[m.loan.sample!].use}随后实际经过1个G现场时段；没有消耗一次性记录或改选能力。`);
    } else ctx.note('原地实际等待一个现场时段', '0行动，不施放能力、不耗灵性；在已付练习范围内实际等待一个有限G现场时段，两种期限分别推进。');
    advancePeriod(s, ctx); return;
  }
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    if (m.loan.caseId === c.caseId) {
      const remaining = m.loan.targetSteps;
      if (remaining > 0) ctx.note('实际等候尚未结束的期限', `0行动收尾不瞬间恢复原主：在同一安全原练习室实际等待剩余${remaining}个G现场时段，再核实原主恢复。`);
      while (m.loan.targetSteps > 0) advancePeriod(s, ctx);
      if (r.usedCount === 0) { r.status = 'OBSERVED'; r.outcome = 'NONE'; }
      m.loan = { caseId: null, sample: null, playerSteps: 0, targetSteps: 0, uses: 0, elapsedSteps: 0 };
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('核对后实际离开原实践', `0行动。${actualResult(r)}原遮光屏、水杯、记录与任务物品均留在原处，归属不变。${r.borrowedSample !== null && r.usedCount === 0 ? '没有实际使用过本次借用，不能报告；保留观察，下一真实周重试。' : '本次实际成功或失败保留。'}不返行动、灵性，不治疗或增加掌握。`); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与已付行动保留；尚未偷取、使用或限制他人能力，可改选普通方法。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('fire-thief-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('拿到什么，何时归还，都要核实', '回看实际能力与意向不一致、自身期限与原主恢复分别结束、未知来源应停止三项报告。G扮演+25，普通方法同样可和平完成全部实践；不生成额外能力或永久掌握。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    if (p.id === 'borrowed-flash') {
      m.instructorSpirituality.SERE -= 4;
      m.demonstrations.push({ caseId: p.id, actor: 'SERE', samples: ['FLASH', 'FROST'], week: s.week });
    } else if (p.id === 'separate-windows') {
      m.instructorSpirituality.NORTIN -= 2;
      m.demonstrations.push({ caseId: p.id, actor: 'NORTIN', samples: ['COURAGE'], week: s.week });
    }
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '实际观察后离开，没有偷取或借用；志愿者灵性不自动补回。'); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.borrowedSample = null; r.usedCount = 0; r.playerExpiredObserved = false; r.sourceRestored = false;
    ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`fire-thief-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? actualResult(r) : p.ordinaryResult) + '本次已实际收尾离开；报告G扮演+25、原规则掌握池单项+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED';
    if (r.method === 'ABILITY') {
      const sample: FireThiefSampleId = p.id === 'borrowed-flash' ? ctx.roll(1, 100) <= 70 ? 'FLASH' : 'FROST' : 'COURAGE';
      r.borrowedSample = sample;
      m.loan = { caseId: p.id, sample, playerSteps: 2, targetSteps: 3, uses: 0, elapsedSteps: 0 };
      ctx.note(p.title, `实际成功偷到${SAMPLES[sample].label}。${p.id === 'borrowed-flash' && sample === 'FROST' ? '意向是闪光，实际结果却是冰霜；不得把结果改回闪光。' : ''}原主暂时不能使用这一项能力，自身有2个G现场时段可借用，原主受限3时段。尚未实际使用；可以USE或WAIT，最终必须实际等待恢复后CLOSE。`);
    } else { r.outcome = p.ordinaryOutcome; ctx.note(p.title, p.ordinaryResult + '本次实践仍须0行动实际收尾并离开，之后才能报告。'); }
    return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, `本次实施未取得可报告结果，原观察保留。1行动${r.method === 'ABILITY' ? '与3灵性' : ''}实际消耗；未偷到能力，没有使原主失能，不抽样本、不增加掌握或扮演。先0行动实际收尾离开，下一真实周再准备。`);
}
export function fireThiefActions(s: SliceState): FireThiefAction[] {
  if (s.progression.pathwayId !== 'error' || s.progression.sequence !== 6) return [];
  const out: FireThiefAction[] = [];
  const add = (id: string, label: string, cost: string, command: FireThiefActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.fireThief.cases[p.id]!;
    if (r.contactOpen) {
      if (s.fireThief.loan.caseId === p.id) {
        add(p.id + '-use', `实际使用所借${SAMPLES[s.fireThief.loan.sample!].label}`, '0行动 · 2灵性 · 随后经过1个G现场时段', { type: 'USE', caseId: p.id });
        add(p.id + '-wait', '原地实际等待一个现场时段', '0行动 · 不施放 · 两种期限分别推进', { type: 'WAIT', caseId: p.id });
      }
      add(p.id + '-close', '实际等待剩余期限、核对恢复并离开', '0行动 · 不瞬间恢复 · 不退资源', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '实际观察本项原现场与来源', '1行动 · 首次演示由原主实付灵性', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.id !== 'unknown-power') add(p.id + '-ability', p.id === 'borrowed-flash' ? '准备意向偷取已见闪光' : '准备偷取已见勇气', '1行动 · 实施另3灵性，知识14', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', '准备原现场普通核对', '1行动 · 实施知识10、不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际尝试偷取已见能力' : '实际进行普通核对', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识14 · 失败照耗' : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际结果与原主恢复', '1行动 · 实际收尾后 · 未用借用不可报告', { type: 'REPORT', caseId: p.id });
  }
  if (!s.fireThief.reflected) add('fire-thief-reflect', '回看实际样本、双期限与来源边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.fireThief.encounter.status === 'AVAILABLE') {
    add('fire-thief-encounter-talk', '前往原练习室外院当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('fire-thief-encounter-fight', '前往原练习室外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function fireThiefCases(s: SliceState): FireThiefProjection['cases'] {
  if (s.progression.pathwayId !== 'error' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&(s.progression.sequence!==4&&(s.progression.sequence!==3&&s.progression.sequence!==2)))) return [];
  return CASES.map(p => {
    const r = s.fireThief.cases[p.id]!;
    const result = r.borrowedSample !== null ? actualResult(r) + (r.status === 'OBSERVED' && !r.contactOpen ? '本次借用没有使用，不能报告，下一真实周可重试。' : '') : ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.ordinaryResult : r.attemptWeek !== null ? '此前实施未成，已付成本与原观察保留。' : r.withdrawals ? '尚未实施的准备已取消，原观察保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '仍在原实践现场；须核实独立期限与收尾离开' : '没有尚未结束的本次实践', closes: r.closes };
  });
}
export function projectFireThiefSamples(s: SliceState): FireThiefProjection['samples'] {
  return FIRE_THIEF_SAMPLE_IDS.filter(id => s.fireThief.demonstrations.some(d => d.samples.includes(id))).map(id => ({ id, label: SAMPLES[id].label, source: SAMPLES[id].source, instructorSpirituality: s.fireThief.instructorSpirituality[SAMPLES[id].actor], demonstrated: true }));
}
/** Reject invented demonstrations, wrong sample pools, instant restoration and reports without actual use. */
export function validateFireThiefLife(s: SliceState): boolean {
  const m = s.fireThief;
  if (!record(m) || !record(m.cases) || !shape(m.cases, FIRE_THIEF_CASE_IDS) || !Array.isArray(m.demonstrations) || !record(m.instructorSpirituality) || !shape(m.instructorSpirituality, ['SERE', 'NORTIN']) || !record(m.loan) || !shape(m.loan, ['caseId', 'sample', 'playerSteps', 'targetSteps', 'uses', 'elapsedSteps']) || !Array.isArray(s.seer.completedSources) || !s.seer.completedSources.every(x => typeof x === 'string') || typeof m.reflected !== 'boolean') return false;
  const isPromoted = s.progression.pathwayId === 'error' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  const seen = new Set<string>();
  for (const demo of m.demonstrations) {
    if (!record(demo) || !shape(demo, ['caseId', 'actor', 'samples', 'week']) || !Array.isArray(demo.samples) || !integer(demo.week, m.promotionWeek ?? s.week, s.week) || seen.has(demo.caseId)) return false;
    if (demo.caseId === 'borrowed-flash') { if (demo.actor !== 'SERE' || demo.samples.join('|') !== 'FLASH|FROST') return false; }
    else if (demo.caseId === 'separate-windows') { if (demo.actor !== 'NORTIN' || demo.samples.join('|') !== 'COURAGE') return false; }
    else return false;
    seen.add(demo.caseId);
  }
  if (m.instructorSpirituality.SERE !== (seen.has('borrowed-flash') ? 16 : 20) || m.instructorSpirituality.NORTIN !== (seen.has('separate-windows') ? 18 : 20)) return false;
  const loan = m.loan;
  if (!integer(loan.playerSteps, 0, 2) || !integer(loan.targetSteps, 0, 3) || !integer(loan.uses, 0, 2) || !integer(loan.elapsedSteps, 0, 3)) return false;
  if (loan.caseId === null) {
    if (loan.sample !== null || loan.playerSteps !== 0 || loan.targetSteps !== 0 || loan.uses !== 0 || loan.elapsedSteps !== 0) return false;
  } else {
    if (!FIRE_THIEF_CASE_IDS.includes(loan.caseId) || loan.sample === null || !availablePool(s, loan.caseId).includes(loan.sample)) return false;
    if (loan.playerSteps !== Math.max(0, 2 - loan.elapsedSteps) || loan.targetSteps !== Math.max(0, 3 - loan.elapsedSteps) || loan.uses > Math.min(2, loan.elapsedSteps)) return false;
  }
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'borrowedSample', 'usedCount', 'playerExpiredObserved', 'sourceRestored'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || !integer(r.usedCount, 0, 2) || typeof r.contactOpen !== 'boolean' || typeof r.playerExpiredObserved !== 'boolean' || typeof r.sourceRestored !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `fire-thief-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (p.id !== 'unknown-power' && seen.has(p.id) !== (r.status !== 'AVAILABLE')) return false;
    const demo = m.demonstrations.find(d => d.caseId === p.id);
    if (demo && r.attemptWeek !== null && demo.week > (r.attemptWeek as number)) return false;
    if (p.id === 'unknown-power' && (r.method === 'ABILITY' || r.borrowedSample !== null)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || (r.closes as number) < 1) return false; }
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week || r.borrowedSample !== null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.borrowedSample !== null || ['EXAMINED', 'RESOLVED'].includes(r.status as string))) return false;
    if (r.attemptWeek !== null && !r.contactOpen && (r.closes as number) < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (r.borrowedSample === null) {
      if (r.usedCount !== 0 || r.playerExpiredObserved || r.sourceRestored || loan.caseId === p.id) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.method !== 'ORDINARY' || r.outcome !== p.ordinaryOutcome) return false; }
      else if (r.outcome !== 'NONE') return false;
    } else {
      if (r.method !== 'ABILITY' || !availablePool(s, p.id).includes(r.borrowedSample as FireThiefSampleId) || r.attemptWeek === null || !['OBSERVED', 'EXAMINED', 'RESOLVED'].includes(r.status as string)) return false;
      if (r.contactOpen) {
        if (r.status !== 'EXAMINED' || loan.caseId !== p.id || loan.sample !== r.borrowedSample || loan.uses !== r.usedCount || r.playerExpiredObserved !== (loan.playerSteps === 0) || r.sourceRestored !== (loan.targetSteps === 0)) return false;
      } else if (!r.sourceRestored || !r.playerExpiredObserved) return false;
      const expectedOutcome = r.usedCount === 0 ? 'NONE' : r.borrowedSample === 'FLASH' ? 'FLASH_USED' : r.borrowedSample === 'FROST' ? 'FROST_USED' : 'COURAGE_USED';
      if (r.outcome !== expectedOutcome) return false;
      if (r.status === 'OBSERVED' && (r.contactOpen || r.usedCount !== 0)) return false;
      if (!r.contactOpen && ['EXAMINED', 'RESOLVED'].includes(r.status as string) && r.usedCount === 0) return false;
    }
    if (!isPromoted && (r.status !== 'AVAILABLE' || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.contactOpen || r.closes !== 0 || r.withdrawals !== 0 || r.borrowedSample !== null)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared || loan.caseId !== null && open !== 1) return false;
  if (s.seer.completedSources.some(x => x.startsWith('fire-thief-case:') && !FIRE_THIEF_CASE_IDS.some(id => x === `fire-thief-case:${id}`))) return false;
  if (s.seer.completedSources.filter(x => x === 'fire-thief-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!isPromoted && (m.reflected || m.demonstrations.length > 0 || loan.caseId !== null)) return false;
  return !isPromoted || ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.dreamStealer.fireThiefActingAtPromotion:s.progression.acting) === resolved * 25 + (m.reflected ? 25 : 0);
}
