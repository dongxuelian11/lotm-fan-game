import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyPolymathEncounter, blockPolymathEncounter, POLYMATH_ENCOUNTER_STORY } from './encounter.js';
import { POLYMATH_SAMPLES } from './content.js';
import { POLYMATH_CASE_IDS, POLYMATH_SAMPLE_IDS, type PolymathCommand, type PolymathActivityCommand, type PolymathAction, type PolymathProjection } from './types.js';

const CASES = [
  {
    id: 'flash-study', sample: 'FLASH', title: '教学室里的低强闪光',
    story: '本作原创成年戏法大师诺亚明确同意，在原借阅馆教学室演示一次低强闪光。你亲自在已确认的安全外侧观看并记录；原教师、原房间与普通出口都是本次有限现场。演示结束后原教师停止效果，你结束观察；只见过不等于理解或学会。（原创G）',
    facts: ['原教师诺亚在本人明确同意下实际示范低强闪光。', '你亲见的是这次有限效果，没有未知能力池或2-081戒指。', '只分析实际亲见样本，成功模仿也必须弱于原示范，不造成伤害。'],
    ability: '以已成功辨析的原低强闪光为依据，准备在原教学室安全外侧模仿更小的闪光；实施1行动、3灵性、知识16，不伤人。',
    ordinary: '准备从原观察记录比较闪光前后的可见细节与普通固定照明，只作普通对照；不施术、不学会样本。',
    abilityResult: '你在原教学室实际模仿出弱于诺亚示范的小闪光，没有造成伤害。只把这个已见、已分析并成功模仿的FLASH样本记为学会。',
    ordinaryResult: '你依原记录与原固定照明核对了闪光前后的有限可见细节，完成普通对照；没有施加闪光或学会FLASH样本。',
    abilityOutcome: 'FLASH_IMITATED', ordinaryOutcome: 'FLASH_COMPARED',
    close: '你实际停止小闪光或普通对照，确认短效已经结束，从原普通出口离开原教学室；原教师与原固定照明留在原处。',
  },
  {
    id: 'thin-frost', sample: 'FROST', title: '原杯温水的一层薄冰',
    story: '成年戏法大师诺亚再次明确同意，在原教学室对原杯温水的表面示范薄冰。你亲自在原安全外侧观察原杯水面，教师结束示范并让薄冰消退；原杯和水仍留在原处，没有任何物品进入你的库存。（原创G）',
    facts: ['本次只有诺亚本人同意演示的原杯温水水面薄冰。', '原杯、原水与原安全外侧都有明确来源，不新增可携走的物品。', '模仿范围只限原杯水面，不能冻人、冻整个房间或改变气候。'],
    ability: '以已成功辨析的原杯薄冰为依据，准备在这只原杯水面模仿更有限的薄冰；实施1行动、3灵性、知识16，不冻人或改变气候。',
    ordinary: '准备比较原观察记录与原杯水面的可见变化，核对液态水和此前薄冰的有限差异；不用能力、不学会样本。',
    abilityResult: '你只在这只原杯温水水面模仿出弱于原示范的薄冰，未冻结任何人、其它物品或气候。这次成功才把FROST记为学会，不自动加入战斗。',
    ordinaryResult: '你对照原记录和原杯水面，记录液态水与此前薄冰的有限差异；没有产生薄冰或学会FROST样本。原杯与水不是奖励。',
    abilityOutcome: 'FROST_IMITATED', ordinaryOutcome: 'WATER_COMPARED',
    close: '你实际停止薄冰或普通对照，确认原杯水面短效消退，将本次使用的原杯归还原位并留在原教学室，然后从原普通出口离开；原杯和水没有进入库存。',
  },
  {
    id: 'willing-chorus', sample: 'COURAGE', title: '小庭里自愿听取的短句',
    story: '本作原创成年歌颂者塔莉娅明确同意，在原小庭向一名自愿成年同伴示范短句鼓舞。你亲自在场听见短句并观察本人有限回应；同伴保有停止与拒绝的权利，示范结束便停止效果，不把振作写成思想控制。（原创G）',
    facts: ['塔莉娅和本次成年同伴明确同意这一段有限示范，没有默认同意其它影响。', '示范只是眼前本人短暂振作，不保证说服、回满灵性或替人决定。', '本人随时可以要求停止；分析已见样本不读取本人思想或其它能力。'],
    ability: '在同一成年同伴本次再次明确同意下，以已辨析短句为依据准备更弱的有限鼓舞；实施1行动、3灵性、知识16，不能控心、保证说服或回满灵性。',
    ordinary: '准备与原自愿成年同伴普通交谈，核对本人愿意描述的有限前后感受；不施加鼓舞、不保证说服、不学会样本。',
    abilityResult: '原自愿成年同伴在本次明确同意范围内短暂、有限地振作，效果弱于塔莉娅的原示范。这次成功才把COURAGE记为学会，没有控心、替人决定或回满灵性，也不保证被说服。',
    ordinaryResult: '你普通听取原成年同伴愿意说明的有限前后感受，本人仍可拒绝或停止；没有施加非凡鼓舞或学会COURAGE样本，也没有说服保证。',
    abilityOutcome: 'COURAGE_IMITATED', ordinaryOutcome: 'WORDS_COMPARED',
    close: '原成年同伴亲口表示本次到此为止。你依本人决定实际停止短句鼓舞或普通交谈，确认短效结束并离开原小庭，不延长本人同意。',
  },
] as const;
export const POLYMATH_ENVIRONMENT = '本阶段三个低阶教学样本、成年教师与现场均为原创G。亲眼观察1行动仅记已见；辨析1行动、知识14，失败本周不能重试，不耗灵性或增加掌握/扮演。能力准备必须已分析，实施1行动、3灵性、知识16，成功才记为已学会且效果弱于原版；普通准备与知识10对照不耗灵性、不学会样本。每次实施后都须0行动实际结束短效、归还原杯留原处并离开；失败照耗，下周再试。每案报告G扮演25与原规则单项掌握8，反思25，三案可和平100。没有未知NPC能力池、免费2-081戒指或序列5千里仪式入梦与制造。 ' + POLYMATH_ENCOUNTER_STORY;
export const polymathInside = (s: SliceState) => Object.values(s.polymath.cases).some(r => r.contactOpen);
export const isPolymathActivity = (c: PolymathCommand): c is PolymathActivityCommand => ['OBSERVE', 'ANALYSE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is PolymathActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!POLYMATH_CASE_IDS.includes(c.caseId as typeof POLYMATH_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'ANALYSE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: PolymathActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockPolymathEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 6) return '先完成博学者晋升。';
  const p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? s.polymath.cases[p.id] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次接触。';
  if (polymathInside(s)) return '先0行动实际结束本次短效或普通接触并离开。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到原导师塞缪尔联络的贝克兰德原教学现场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.polymath.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.polymath.reflected ? '已经回看这段经历。' : CASES.some(p => s.polymath.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  const sample = s.polymath.samples[p.sample];
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' && sample.observedWeek === null ? null : '这次亲见样本与来源记录已经保留。';
  if (c.type === 'ANALYSE') {
    if (r.status !== 'OBSERVED' || sample.observedWeek === null) return '先亲眼观看原教师明确同意的这次示范并结束观察。';
    if (sample.understoodWeek !== null) return '这个亲见样本已经成功辨析，理解仍不等于学会。';
    return sample.analysisAttemptWeek === s.week ? '本周辨析失败记录保留，下一真实周才能重试。' : null;
  }
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED' || sample.observedWeek === null) return '先亲眼观察原教师的有限示范。';
    if (r.attemptWeek === s.week) return '本周实施结果保留，下一真实周再依原观察准备。';
    return c.method === 'ABILITY' && sample.understoodWeek === null ? '只见过不等于理解，先成功辨析这个确切样本；也可选择普通对照。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触离开。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.method === 'ABILITY' && (sample.observedWeek === null || sample.understoodWeek === null)) return '能力模仿必须已有本样本亲见与成功辨析来源。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次模仿需要3灵性，可取消准备后选择普通对照。' : null;
}
export function applyPolymathActivity(s: SliceState, c: PolymathActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('博学者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyPolymathEncounter(s, c, ctx); return; }
  const m = s.polymath;
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次接触并离开', '0行动。' + p.close + '本次成功或失败与已付行动、灵性均保留，不再判定、不返资源、不治疗，也不额外授予样本。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，已付行动、亲见与辨析记录保留。没有施加新作用、学会样本或延长他人同意。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('polymath-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('从亲见到理解仍有距离', '回看低强闪光、原杯薄冰与自愿短句。G扮演+25；见过、理解、成功模仿是三个不同事实，普通对照也能帮助澄清边界，不能伪称学会能力。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!, sample = m.samples[p.sample];
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED'; sample.observedWeek = s.week;
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '只记录已见，未分析也未学会；没有持续短效或待结束接触。'); return;
  }
  if (c.type === 'ANALYSE') {
    sample.analysisAttemptWeek = s.week;
    const result = ctx.check('knowledge', 14);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      sample.understoodWeek = s.week;
      ctx.note('成功辨析亲见样本', `你只依据${p.title}的实际来源理清有限步骤，知识14判定成功。已分析不等于已经学会，仍须能力准备与实际弱化模仿；本次不耗灵性、不增加掌握或扮演。`);
    } else ctx.note('辨析仍有缺口', '1行动已耗，知识14判定未通过，亲见来源保留但未理解、未学会，不耗灵性或增加掌握/扮演。下一真实周可再分析；本周仍可据原观察选择普通对照。');
    return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`polymath-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + p.close + '本次已实际离开现场，G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    ctx.note('有限弱化模仿的实际成本', '本次3灵性已经支出，只涉及原样本与本次同意范围；成功弱于原示范，失败也不退灵性。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 16 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (r.method === 'ABILITY') sample.learnedWeek = s.week;
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次接触尚须0行动实际结束短效并离开，之后才能报告。');
  } else {
    r.status = 'OBSERVED';
    ctx.note(p.title, '本次实施未取得可报告结果，没有学会新样本；原观察和已完成辨析仍保留。行动和已支出的灵性不返还，先0行动实际结束接触、归还原杯留原处并离开，下一真实周再准备。');
  }
}
export function polymathActions(s: SliceState): PolymathAction[] {
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 6) return [];
  const out: PolymathAction[] = [];
  const add = (id: string, label: string, cost: string, command: PolymathActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.polymath.cases[p.id]!, sample = s.polymath.samples[p.sample];
    if (r.contactOpen) add(p.id + '-close', '实际结束短效与接触并离开', '0行动 · 原杯归还原位 · 保留事实与成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '亲看原教师同意的有限演示', '1行动 · 只记已见', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (sample.understoodWeek === null) add(p.id + '-analyse', '辨析这个确切的亲见样本', '1行动 · 知识14 · 不耗灵性 · 失败下周再试', { type: 'ANALYSE', caseId: p.id });
      add(p.id + '-ability', '准备已分析样本的弱化模仿', '1行动 · 需先分析 · 实施另耗3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', '依原观察准备普通对照', '1行动 · 不施术、不授予样本', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际尝试有限弱化模仿' : '实际完成原现场普通对照', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识16 · 仍可能失败' : '1行动 · 知识10 · 不耗灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 保留亲见和辨析记录', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与样本边界', '1行动 · 实际离开后', { type: 'REPORT', caseId: p.id });
  }
  if (!s.polymath.reflected) add('polymath-reflect', '回看亲见、理解和弱化模仿的区别', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.polymath.encounter.status === 'AVAILABLE') {
    add('polymath-encounter-talk', '前往原教学室外空院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('polymath-encounter-fight', '前往原教学室外空院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function polymathCases(s: SliceState): PolymathProjection['cases'] {
  if (s.progression.pathwayId !== 'white-tower' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => {
    const r = s.polymath.cases[p.id]!, sample = s.polymath.samples[p.sample];
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status)
      ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (r.contactOpen ? ' 尚须实际结束短效与接触并离开。' : p.close)
      : r.attemptWeek !== null ? '此前实施未成，已付成本与原观察保留，没有学会样本。'
        : sample.understoodWeek !== null ? '原样本已成功分析，尚未实际成功模仿，不能声称学会。'
          : sample.analysisAttemptWeek !== null ? '辨析未成，原亲见事实保留，下一真实周可再分析。'
            : r.withdrawals ? '尚未实施的准备已取消，原亲见来源保留。' : null;
    const source = POLYMATH_SAMPLES.find(value => value.id === p.sample)!;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, source.source, source.boundary], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次短效或接触仍须结束并实际离开' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
/** Three fixed, independently sourced G samples. Observation, understanding and successful imitation remain distinct. */
export function validatePolymathLife(s: SliceState): boolean {
  const m = s.polymath;
  if (!record(m) || !record(m.cases) || !shape(m.cases, POLYMATH_CASE_IDS) || !record(m.samples) || !shape(m.samples, POLYMATH_SAMPLE_IDS) || !Array.isArray(s.seer.completedSources)) return false;
  const isPromoted = s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 6 || s.progression.sequence === 5 || (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id], sample = m.samples[p.sample];
    if (!record(sample) || !shape(sample, ['observedWeek', 'understoodWeek', 'learnedWeek', 'analysisAttemptWeek'])) return false;
    for (const value of Object.values(sample)) if (value !== null && !integer(value, m.promotionWeek ?? s.week, s.week)) return false;
    if (!isPromoted && Object.values(sample).some(value => value !== null)) return false;
    if (sample.observedWeek === null && Object.values(sample).some(value => value !== null)) return false;
    if (sample.analysisAttemptWeek !== null && (sample.observedWeek === null || sample.analysisAttemptWeek < sample.observedWeek)) return false;
    if (sample.understoodWeek !== null && (sample.analysisAttemptWeek !== sample.understoodWeek || sample.observedWeek === null || sample.understoodWeek < sample.observedWeek)) return false;
    if (sample.learnedWeek !== null && (sample.understoodWeek === null || sample.learnedWeek < sample.understoodWeek)) return false;
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && (!integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week) || sample.observedWeek === null || r.attemptWeek < sample.observedWeek)) return false;
    if ((r.status === 'AVAILABLE') !== (sample.observedWeek === null)) return false;
    if (s.seer.completedSources.filter(x => x === `polymath-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false;
      if (r.method === 'ABILITY' && sample.learnedWeek !== r.attemptWeek) return false;
    } else if (r.outcome !== 'NONE' || sample.learnedWeek !== null) return false;
    if (r.method === 'ORDINARY' && sample.learnedWeek !== null) return false;
    if (r.method === 'ABILITY' && (sample.understoodWeek === null || (r.contactOpen || ['EXAMINED', 'RESOLVED'].includes(r.status as string)) && r.attemptWeek !== null && sample.understoodWeek > r.attemptWeek)) return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (isPromoted && s.progression.sequence === 2 && (open || prepared || resolved !== 3 || !m.reflected)) return false;
  if (s.seer.completedSources.filter(x => x === 'polymath-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (isPromoted && ((s.progression.sequence === 5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)) ? s.mysticismMagister.polymathActingAtPromotion : s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
