import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { FACELESS_TEMPLATES } from './content.js';
import { blockFacelessEncounter, applyFacelessEncounter, FACELESS_ENCOUNTER_STORY } from './encounter.js';
import {
  FACELESS_CASE_IDS, FACELESS_TEMPLATE_IDS,
  type FacelessActivityCommand, type FacelessCommand, type FacelessAction, type FacelessProjection,
} from './types.js';

const CASES = [
  {
    id: 'stage-double', title: '经过同意的舞台替身', templateId: 'STAGE_DOUBLE', stat: 'perception', outcome: 'DOUBLE_RECORDED',
    story: '原创成年演员阿伦·贝尔在排练室同意你作一小段舞台替身。他当面展示自己的面容、棕发、灰瞳与普通声线，读出“请在第二次铃声后入场”。他和成年服装保管员梅娜明确只允许这段公开排练，不授予姓名、证件或场外身份。',
    facts: ['本人当面示范并明确同意，原声是听过的普通人声音；固定模板只令本人身高+5厘米，头部变化有限。', '原道具外套FC6-PROP-COAT-1还在衣架上，变脸不能把外套变到身上。'],
    ability: '准备观察过的舞台模板；须另明确变化外貌与声线、借原外套，再按排练顺序发出已经听过的短句。',
    ordinary: '以本人原貌原声读台词，靠原台本、走位和普通配合完成替身排练，不冒充本人。',
    result: '这次替身只在约定排练内成立。外貌与声音相似没有带来阿伦的记忆、知识、身份或服装；原道具服仍须真实归还。',
  },
  {
    id: 'familiar-manner', title: '熟人认出的一个小习惯', templateId: 'PORTER_PART', stat: 'knowledge', outcome: 'MANNER_RECOGNIZED',
    story: '原创成年搬运工乔纳·里德同意一次有限角色练习，并当面展示短发、黑瞳、气味与普通声音，读出“这只空箱先放靠墙处”。他的成年同伴艾达知情参与。你们只移动原排练室的空箱；她会指出你下意识先抬右脚，而乔纳惯用左脚。',
    facts: ['当面观察和原声已记录；固定模板只令本人身高−5厘米，不获得乔纳的记忆或工作经验。', '艾达会从原有习惯看出差别；换脸、换声不自动通过熟人的行为核实。'],
    ability: '准备已见的搬运工模板；另变化外貌与声线、借同一原道具外套，真实读出示范短句并核对熟人指出的步态差别。',
    ordinary: '以本人原貌原声按原台本排练，用普通观察比较左右脚习惯，接受同伴指出差别。',
    result: '艾达指出了举止差别。你记录“外形相似，熟人仍能识破习惯”，没有把通过判定写成完美冒充或获得他人的知识。',
  },
  {
    id: 'remember-self', title: '扮演结束后记住自己', templateId: 'PORTER_PART', stat: 'will', outcome: 'SELF_REMEMBERED',
    story: '同一位成年指导者邀请你回看刚才的角色练习。乔纳仍同意在原排练室使用他的有限角色模板；指导者让你把自己的原姓名、亲历记忆与台本角色分开叙述。她不会给你另一人的记忆，也不会替你自动复原。',
    facts: ['搬运工模板的形貌与声音必须来自乔纳在前一项练习中的当面示范；普通方法不需要借用这个模板。', '本人原有身份与生理器官始终未变；离场和停止练习不等于已经显式复原。'],
    ability: '用已观察的搬运工模板和真实借来的原外套完成角色片段，再明确复原本人外貌与原声，归还同一原外套后报告。',
    ordinary: '以本人原貌原声读角色台本，区分角色经历与自己的真实经历，再结束练习并报告。',
    result: '你明确区分了自己与台本角色。本人原姓名、经历和生理器官没有被外貌模板改写；若曾变化，本次确实主动恢复了本人外貌与原声。',
  },
] as const;

export const FACELESS_ENVIRONMENT = '本场只开放本人SELF、获同意成年人的STAGE_DOUBLE和PORTER_PART固定外貌与声线，来源须当面观察并听过，不能任意换成已知NPC。模板身高仅正负5厘米；头部变化有限，不改变生理器官、现实身份、记忆或知识，不生成衣物。变化2灵性、复原1灵性，均0行动（G）；外貌与所选声线持续，无维持费。CLOSE只停止练习，离场不自动复原或归还原服装。复原不足可先结束练习、休养后再主动复原。没有S5灵体之线或秘偶。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
export const facelessInside = (s: SliceState): boolean => Object.values(s.faceless.cases).some(r => r.contactOpen);

export function validateFacelessActivityCommand(value: unknown): value is FacelessActivityCommand {
  if (!record(value)) return false;
  if (['REFLECT', 'RESTORE_SELF', 'RETURN_OUTFIT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'CHANGE_APPEARANCE') return shape(value, ['type', 'templateId']) && ['STAGE_DOUBLE', 'PORTER_PART'].includes(value.templateId as string);
  if (!FACELESS_CASE_IDS.includes(value.caseId as typeof FACELESS_CASE_IDS[number])) return false;
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'BORROW_OUTFIT'].includes(value.type as string) && shape(value, ['type', 'caseId']);
}
export const isFacelessActivity = (c: FacelessCommand): c is FacelessActivityCommand => validateFacelessActivityCommand(c);

function blocked(s: SliceState, c: FacelessActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockFacelessEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!promoted(s)) return '先完成无面人晋升。';
  if ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && !['RESTORE_SELF', 'CHANGE_APPEARANCE', 'RETURN_OUTFIT', 'CLOSE'].includes(c.type)) return '旧无面人实践已完成，保留原貌变化、复原和归还原服装；继续诡法师实践。';
  if(s.progression.sequence===5&&!['RESTORE_SELF','CHANGE_APPEARANCE','RETURN_OUTFIT','CLOSE'].includes(c.type))return '旧无面人实践已完成，保留原貌变化、复原和归还原服装；继续秘偶大师实践。';
  const m = s.faceless, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次练习。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (c.type === 'RESTORE_SELF') {
    if (m.appearance.templateId === 'SELF') return '当前已经是本人原貌与原声。';
    return s.spirituality < 1 ? '显式复原需要1灵性；可以先0行动结束练习，休养后再复原。' : null;
  }
  if (facelessInside(s)) return '先0行动结束本次练习；场内仍可明确复原本人外貌。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德的原排练室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (c.type === 'RETURN_OUTFIT') return m.outfit.location === 'PLAYER' ? null : '原道具外套已经在原衣架上。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (c.type === 'CHANGE_APPEARANCE') {
    const source = FACELESS_TEMPLATES[c.templateId];
    if (m.cases[source.sourceCaseId].observedWeek === null) return '必须先当面观察这个已获同意的成年模板，并亲耳听过原声。';
    if (m.appearance.templateId === c.templateId) return '当前已经保持这个模板，不重复付费。';
    return s.spirituality < 2 ? '改变外貌与声线需要2灵性。' : null;
  }
  if (c.type === 'BORROW_OUTFIT') {
    if (m.outfit.location !== 'WARDROBE') return '同一原道具外套仍在你身上，先实际归还。';
    return r?.status === 'PREPARED' ? null : '先为这项练习选择方法，再向保管员借原道具外套。';
  }
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') {
    if (m.reflected) return '已经回看这段经历。';
    if (CASES.some(p => m.cases[p.id].status !== 'RESOLVED')) return '先完成三项有限报告。';
    if (m.appearance.templateId !== 'SELF') return '先明确恢复本人外貌与原声，再回看自己。';
    return m.outfit.location !== 'WARDROBE' ? '先实际归还原道具外套。' : null;
  }
  if (!r) return '未知原练习。';
  if (r.status === 'RESOLVED') return '这项核对已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对现场、形貌与原声来源及本人许可。';
    if (r.attemptWeek === s.week) return '本周未成，下周可以重新准备。';
    if (Object.entries(m.cases).some(([id, other]) => id !== c.caseId && other.status === 'PREPARED')) return '先完成或取消另一项尚未实施的准备。';
    return null;
  }
  if (c.type === 'REPORT') {
    if (r.status !== 'EXAMINED') return '先完成实际练习并结束接触。';
    if (m.outfit.location !== 'WARDROBE') return '先把同一原道具外套实际归还，变脸不能代替归还。';
    if (c.caseId === 'remember-self' && (m.appearance.templateId !== 'SELF' || r.method === 'ABILITY' && m.appearance.restores <= (r.restoresAtPerformance ?? 0))) return '本次扮演后须明确恢复本人外貌与原声，再作自我报告。';
    return null;
  }
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (m.outfit.location === 'PLAYER' && m.outfit.caseId !== p.id) return '这件原道具外套仍记在另一项练习，先实际归还再借。';
  if (r.method === 'ABILITY') {
    if (m.appearance.templateId !== p.templateId) return '先明确变为本项已观察的固定模板，变形另付2灵性、0行动。';
    if (m.outfit.location !== 'PLAYER' || m.outfit.caseId !== p.id) return '本项须借到同一原道具外套；外貌能力不会复制服装。';
  } else if (m.appearance.templateId !== 'SELF') return '普通方法使用本人原貌原声；先明确复原，不会自动免费变回。';
  return null;
}

export function applyFacelessActivity(s: SliceState, c: FacelessActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateFacelessActivityCommand(c)) throw new Error('无面人实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyFacelessEncounter(s, c, ctx); return; }
  const m = s.faceless;
  if (c.type === 'RESTORE_SELF') {
    s.spirituality -= 1;
    m.appearance.templateId = 'SELF'; m.appearance.sourceCaseId = null; m.appearance.changedWeek = s.week; m.appearance.restores += 1;
    ctx.note('明确复原本人外貌与原声', '0行动、灵性−1（G）。外貌与声线恢复；本人身份和生理器官从未被改写。原道具外套的位置不变，接触也须另行结束。'); return;
  }
  if (c.type === 'CHANGE_APPEARANCE') {
    const template = FACELESS_TEMPLATES[c.templateId];
    s.spirituality -= 2;
    m.appearance.templateId = c.templateId; m.appearance.sourceCaseId = template.sourceCaseId; m.appearance.changedWeek = s.week; m.appearance.changes += 1;
    ctx.note('保持有限外貌与已听声线', `${template.label}，0行动、灵性−2（G）。${template.source}变化持续且无需维持，离场不会自动复原；衣物、本人身份、记忆和生理器官不变。`); return;
  }
  if (c.type === 'BORROW_OUTFIT') {
    m.outfit.location = 'PLAYER'; m.outfit.caseId = c.caseId; m.outfit.loans += 1;
    ctx.note('实际借到同一原道具外套', `${m.outfit.id}从原衣架交到你手中并穿好，0行动。第${m.outfit.loans}次借用只用于约定练习，不因变脸新增或复制衣物。`); return;
  }
  if (c.type === 'RETURN_OUTFIT') {
    m.outfit.location = 'WARDROBE'; m.outfit.caseId = null; m.outfit.returns += 1;
    ctx.note('实际归还同一原道具外套', `${m.outfit.id}脱下并交回原保管员、放回原衣架，0行动。已借${m.outfit.loans}次、已还${m.outfit.returns}次；当前外貌与声线没有改变。`); return;
  }
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]; r.contactOpen = false; r.closes += 1;
    ctx.note('实际停止本次练习并退开', '0行动，不再继续约定台词或动作；不抽取新判定，不退已付成本。当前外貌与声线继续保持，原道具服位置不变，复原和归还须分别明确进行。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的角色准备', '0行动，原观察与已付行动保留，不假称已经表演。已经改变的外貌与声线、已经借到的外套都保持实际状态。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('faceless-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('记住自己，才知道在扮演谁', '三段真实经历保留：获同意的有限外形不等于身份，熟人仍会看见举止差别，自己原有的经历不可被台本替换。G扮演+25。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, `${p.story} ${p.facts.join(' ')}`); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`faceless-case:${p.id}`, 8);
    ctx.note(p.title, `${p.result}已实际结束练习并归还原服装，G扮演+25、已知能力单项掌握+8。`); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true; r.appearanceAtPerformance = m.appearance.templateId; r.restoresAtPerformance = m.appearance.restores;
  r.outfitLoanAtPerformance = m.outfit.location === 'PLAYER' ? m.outfit.loans : null;
  r.voiceImitated = r.method === 'ABILITY';
  const result = ctx.check(r.method === 'ABILITY' ? p.stat : 'knowledge', r.method === 'ABILITY' ? 10 : 12);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, `${p.id === 'remember-self' ? '角色片段已经完成；还须明确复原本人外貌与原声，才足以提交自我报告。' : p.result}先0行动结束练习。`);
  } else {
    r.status = 'OBSERVED';
    if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    ctx.note(p.title, `这次练习不足以支持结论。${result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : ''}外貌与原服装仍保持，已付成本不返还；先实际结束接触，下周可再准备，也可改走普通方法。`);
  }
}

export function facelessActions(s: SliceState): FacelessAction[] {
  if (!promoted(s)) return [];
  const out: FacelessAction[] = [];
  const add = (id: string, label: string, cost: string, command: FacelessActivityCommand) => {
    if ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && !['RESTORE_SELF', 'CHANGE_APPEARANCE', 'RETURN_OUTFIT', 'CLOSE'].includes(command.type)) return;
    const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  for (const templateId of ['STAGE_DOUBLE', 'PORTER_PART'] as const) add(`faceless-change-${templateId}`, `采用${FACELESS_TEMPLATES[templateId].label}与已听声线`, '0行动 · 2灵性 · 持续至主动复原', { type: 'CHANGE_APPEARANCE', templateId });
  if (s.faceless.appearance.templateId !== 'SELF') add('faceless-restore-self', '明确复原本人外貌与原声', '0行动 · 1灵性 · 场内也可进行', { type: 'RESTORE_SELF' });
  if (s.faceless.outfit.location === 'PLAYER') add('faceless-return-outfit', '实际归还同一原道具外套', '0行动 · 先结束接触 · 不改变外貌', { type: 'RETURN_OUTFIT' });
  for (const p of CASES) {
    const r = s.faceless.cases[p.id];
    if (r.contactOpen) add(`${p.id}-close`, '结束本次练习并退开', '0行动 · 不自动复原或归还服装', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对当面来源与本人许可', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(`${p.id}-ability`, '准备有限外貌与声音实践', '1行动 · 变形和借原服另作明确操作', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备本人原貌的普通方法', '1行动 · 不需施用能力', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      if (s.faceless.outfit.location === 'WARDROBE') add(`${p.id}-borrow`, '实际借用同一原道具外套', '0行动 · 能力方法必需，普通方法可选', { type: 'BORROW_OUTFIT', caseId: p.id });
      add(`${p.id}-perform`, '实际完成本次角色练习', '1行动 · 不自动变形或生成服装', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 保留实际外貌与原服状态', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告有限结果与身份边界', '1行动 · 先结束接触并归还原服', { type: 'REPORT', caseId: p.id });
  }
  if (s.faceless.encounter.status === 'AVAILABLE') {
    add('faceless-encounter-talk', '当面澄清后门交接误会', '1行动 · 普通交涉 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('faceless-encounter-fight', '承担风险，面对后门真实冲突', '1行动 · 对方普通短棍 · 可实际撤退', { type: 'ENCOUNTER_FIGHT' });
  }
  if (!s.faceless.reflected) add('faceless-reflect', '回看扮演与自己原有的经历', '1行动 · 三项报告后 · 本人原貌与原声', { type: 'REFLECT' });
  return out;
}

export function facelessCases(s: SliceState): FacelessProjection['cases'] {
  if (!promoted(s)) return [];
  const cases: FacelessProjection['cases'] = CASES.map(p => {
    const r = s.faceless.cases[p.id];
    const completed = r.status === 'RESOLVED';
    return {
      id: p.id, title: p.title, story: p.story, observations: r.observedWeek === null ? [] : [...p.facts],
      preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
      result: completed ? p.result : r.status === 'EXAMINED' ? p.id === 'remember-self' ? '角色片段已完成，尚须按当前状态结束、复原并归还原服，才可报告。' : p.result : r.attemptWeek !== null ? '此前练习不足，已付成本、原外貌与原服历史保留，可在下一周再准备。' : r.withdrawals ? '准备已取消，仍须分别处理实际外貌与原服。' : null,
      status: r.status, contactOpen: r.contactOpen ? '本次练习尚未结束；可0行动停止或主动复原' : '没有尚未结束的练习；当前外貌另行记录', closes: r.closes,
    };
  });
  const encounter = s.faceless.encounter;
  cases.push({ id: 'faceless-dispute', title: '原排练室后门的交接误会', story: FACELESS_ENCOUNTER_STORY, observations: [], preparation: null, result: encounter.status === 'AVAILABLE' ? encounter.attemptWeek === null ? null : '此前交涉没有让对方同意，原现场与退出路线保留。' : encounter.status === 'FIGHTING' ? '真实冲突正在进行，可按现场规则实际撤退。' : encounter.status === 'RETREATED' ? '已从原出口实际退出，原外貌、伤势与消耗保留。' : encounter.status === 'LOST' ? '冲突已按真实死亡结果结束。' : '争议已有结果，原短棍没有转为你的物品。', status: encounter.status, contactOpen: encounter.status === 'FIGHTING' ? '真实战斗进行中' : '没有进行中的后门战斗', closes: 0 });
  return cases;
}

export function facelessAppearanceProjection(s: SliceState): FacelessProjection['appearance'] {
  const appearance = s.faceless.appearance;
  if (appearance.templateId === 'SELF') return {
    templateId: 'SELF', label: '本人原貌', voice: '本人原声', source: '建角时本人的原有身份与身体；不是从别人复制的资料。', heightOffsetCm: 0, persistent: false,
    summary: '当前为本人原貌与原声。原姓名、记忆、生理器官和真实身份一直保留；衣物单独记录。',
  };
  const template = FACELESS_TEMPLATES[appearance.templateId];
  return {
    templateId: appearance.templateId, label: template.label, source: template.source, heightOffsetCm: template.heightOffsetCm, persistent: true,
    voice: appearance.templateId === 'STAGE_DOUBLE' ? '已亲耳听过的成年阿伦示范声线；不复制语言或台词知识' : '已亲耳听过的成年乔纳示范声线；不复制语言或台词知识',
    summary: `第${appearance.changedWeek}周采用的外貌与声线仍在保持，无维持费，离场不自动复原。身高相对本人${template.heightOffsetCm > 0 ? '+' : ''}${template.heightOffsetCm}厘米；原身份、记忆、生理器官和衣物不变。`,
  };
}
export function facelessOutfitProjection(s: SliceState): FacelessProjection['outfit'] {
  const o = s.faceless.outfit;
  return { id: o.id, label: '原排练室道具外套', location: o.location === 'PLAYER' ? '本人实际借用中' : '原衣架，由原保管员持有', summary: `同一原物${o.id}，已借${o.loans}次、已还${o.returns}次。外貌与声音能力不复制衣物；CLOSE和RESTORE_SELF都不代替归还。` };
}

/** Validate case evidence and the bounded physical costume without a generic ownership framework. */
export function validateFacelessPractice(s: SliceState): boolean {
  const m = s.faceless;
  if (!record(m) || !record(m.cases) || !shape(m.cases, FACELESS_CASE_IDS) || !record(m.appearance) || !record(m.outfit) || !Array.isArray(s.seer.completedSources)) return false;
  const a = m.appearance, o = m.outfit;
  if (!shape(a, ['templateId', 'sourceCaseId', 'changedWeek', 'changes', 'restores']) || !FACELESS_TEMPLATE_IDS.includes(a.templateId) || !integer(a.changes, 0) || !integer(a.restores, 0, a.changes)) return false;
  const firstWeek = m.promotionWeek ?? s.week;
  if (a.changedWeek !== null && !integer(a.changedWeek, firstWeek, s.week)) return false;
  if (a.templateId === 'SELF') { if (a.sourceCaseId !== null || (a.changes === 0) !== (a.changedWeek === null) || a.changes > 0 && a.restores === 0) return false; }
  else {
    const template = FACELESS_TEMPLATES[a.templateId];
    if (a.sourceCaseId !== template.sourceCaseId || a.changedWeek === null || a.changes <= a.restores) return false;
  }
  if (!shape(o, ['id', 'source', 'location', 'caseId', 'loans', 'returns']) || o.id !== 'FC6-PROP-COAT-1' || o.source !== 'ORIGINAL_REHEARSAL_WARDROBE' || !integer(o.loans, 0) || !integer(o.returns, 0, o.loans)) return false;
  if (o.location === 'WARDROBE') { if (o.caseId !== null || o.loans !== o.returns) return false; }
  else if (o.location === 'PLAYER') { if (!FACELESS_CASE_IDS.includes(o.caseId!) || o.loans !== o.returns + 1) return false; }
  else return false;
  let open = 0, prepared = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'appearanceAtPerformance', 'restoresAtPerformance', 'outfitLoanAtPerformance', 'voiceImitated'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean' || typeof r.voiceImitated !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method)) return false;
    if (r.observedWeek !== null && !integer(r.observedWeek, firstWeek, s.week)) return false;
    if (r.attemptWeek !== null && (!integer(r.attemptWeek, r.observedWeek ?? firstWeek, s.week) || r.observedWeek === null)) return false;
    if (r.appearanceAtPerformance !== null && !FACELESS_TEMPLATE_IDS.includes(r.appearanceAtPerformance)) return false;
    if (r.restoresAtPerformance !== null && !integer(r.restoresAtPerformance, 0, a.restores)) return false;
    if (r.outfitLoanAtPerformance !== null && !integer(r.outfitLoanAtPerformance, 1, o.loans)) return false;
    if ((r.status === 'RESOLVED') !== s.seer.completedSources.includes(`faceless-case:${p.id}`)) return false;
    if (r.status === 'AVAILABLE') {
      if (r.observedWeek !== null || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen) return false;
    } else if (r.observedWeek === null) return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.attemptWeek === null) {
      if (r.appearanceAtPerformance !== null || r.restoresAtPerformance !== null || r.outfitLoanAtPerformance !== null || r.voiceImitated || r.closes || r.contactOpen) return false;
    } else {
      if (r.appearanceAtPerformance === null || r.restoresAtPerformance === null || !r.contactOpen && r.closes < 1) return false;
      if (r.voiceImitated && (r.appearanceAtPerformance !== p.templateId || r.outfitLoanAtPerformance === null || a.changes === 0)) return false;
      if (r.voiceImitated) {
        const source = m.cases[FACELESS_TEMPLATES[p.templateId].sourceCaseId];
        if (!record(source) || !integer(source.observedWeek, firstWeek, r.attemptWeek)) return false;
      }
      if (!r.voiceImitated && r.appearanceAtPerformance !== 'SELF') return false;
    }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome || r.voiceImitated !== (r.method === 'ABILITY')) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'RESOLVED') {
      if (r.contactOpen || r.closes < 1 || r.outfitLoanAtPerformance !== null && o.returns < r.outfitLoanAtPerformance) return false;
      if (p.id === 'remember-self' && r.voiceImitated && a.restores <= r.restoresAtPerformance!) return false;
    }
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek === null || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
  }
  if (open > 1 || prepared > 1) return false;
  if (a.changes > 0 && Object.values(FACELESS_TEMPLATES).every(template => m.cases[template.sourceCaseId].observedWeek === null)) return false;
  if (a.templateId !== 'SELF' && (m.cases[a.sourceCaseId!].observedWeek === null || m.cases[a.sourceCaseId!].observedWeek! > a.changedWeek!)) return false;
  if (o.caseId !== null && m.cases[o.caseId].observedWeek === null) return false;
  if (m.reflected !== s.seer.completedSources.includes('faceless-reflection') || m.reflected && CASES.some(p => m.cases[p.id].status !== 'RESOLVED')) return false;
  if (!promoted(s) && !(s.progression.pathwayId === 'diviner' && s.progression.sequence === 1 && s.attendantMysteries?.promotionWeek != null) && (a.templateId !== 'SELF' || a.changes !== 0 || a.restores !== 0 || a.changedWeek !== null || o.loans !== 0 || o.returns !== 0 || o.location !== 'WARDROBE' || m.reflected || CASES.some(p => m.cases[p.id].status !== 'AVAILABLE'))) return false;
  return true;
}
