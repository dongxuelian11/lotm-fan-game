import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { POTION_PROFESSOR_ASSISTANCE, POTION_PROFESSOR_KIT_PRICE, potionProfessorAssistanceSource } from './content.js';
import { applyPotionProfessorEncounter, blockPotionProfessorEncounter, POTION_PROFESSOR_ENCOUNTER_STORY } from './encounter.js';
import { POTION_PROFESSOR_ASSISTANCE_KINDS, POTION_PROFESSOR_CASE_IDS, type PotionProfessorCommand, type PotionProfessorActivityCommand, type PotionProfessorAction, type PotionProfessorAssistanceKind, type PotionProfessorEffects, type PotionProfessorProjection } from './types.js';

const CASES = [
  { id: 'quiet-passage', title: '同一原室里的脚步声', story: '原导师艾琳与你在原夜间药房教学室核对短段净空地面。先普通走过同一小段路，再明确使用预先调好的独立静步原瓶并进行有限走动，比较这次脚步声。药剂来源、已付材料和失败风险必须说清；不穿墙、不无视原地面。（原创G）', facts: ['原室、固定照明、短段净空地面均已核实，不从别处移动人或物。', '必须自己实际持有成功预配的QUIET_STEP独立原瓶；讲述静步故事不等于已经制药或使用。', '短效等待包含在本事项已付预算内；结束时要实际确认效果消退并退出，没有原著持续量或免费续效。'], ability: '准备比较同一原室普通脚步与本次独立静步药剂的实际结果；只使用玩家已有原瓶。', ordinary: '普通叙述不能替代实际预配与原瓶使用。', result: '已实际比较同一段地面的普通脚步声与原静步辅助药的有限结果，来源、范围和结束条件可核实。', outcome: 'QUIET_STEP_VERIFIED' },
  { id: 'separate-signals', title: '身体、衣物和气味各自核对', story: '回到同一原教学室，艾琳准备分别核对身体、普通衣物与自身气味的三个可辨信号。你一次明确选择，依次用三瓶已预配且自己持有的原药：先身体透明而普通衣物仍可见、气味仍在，再另瓶处理衣物，最后另瓶处理气味。整段短时练习已包含本次预算，不把三瓶合成一瓶。（原创G）', facts: ['BODY_VEIL、CLOTH_VEIL、ODOR_VEIL是三个不同种类的实际独立原瓶，必须事先各持有一瓶。', '身体透明不会自动隐去普通衣物或气味；每一步单独核实并记下原瓶ID。', '有限原室核验不是完全隐身保证；不能穿墙、移走他人、无限持续或把效果带入战斗。'], ability: '一次明确选择依次实际使用身体透明、衣物透明、去味三独立原瓶，按顺序逐项比较，失败同样耗瓶。', ordinary: '普通讨论不能冒充这三种实际预配、实际使用的独立药剂。', result: '已分别核实身体透明时普通衣物与气味仍在，以及另两瓶依次处理衣物、气味的有限结果；三份独立来源和消耗各自保留。', outcome: 'SIGNALS_VERIFIED' },
  { id: 'willing-student', title: '向愿意学习的成年人讲清结果', story: '成年药房学员米娅本人愿意听你讲解已经实际完成的两项实践。你用已有原瓶记录和自己的真实观察，说明事先调配、分别用药、耗料失败与实际结束的边界；由米娅本人复述并核实理解，她仍可能不理解或要求停止。此处不提供现实制药操作，也不凭教学凭空产生新药。（原创G）', facts: ['米娅是自愿学习的成年人，普通讲解与能力辅助教学都保留她的拒绝和核实空间。', '只教学前两项已报告的真实结果、已知失败风险和成本，不传授未核配方，不宣称自己成功经历过并未发生的失败。', '报告不要求交出药剂或产生新瓶，也不会赐予对方非凡能力。'], ability: '以有限药剂研究与教学能力清楚解释已有结果，再请本人复述；不强制理解，不新造药。', ordinary: '用普通逐项讲解、原记录对照和本人复述核实理解，不施加控制或凭空制药。', result: '米娅本人已核实并复述真实结果与失败风险；教学仍是有限知识交流，没有交付或新造药剂。', outcome: 'LESSON_VERIFIED' },
] as const;
export const POTION_PROFESSOR_ENVIRONMENT = '原夜间药房G教学室：固定照明、已核实净空短路、原教学卡。四种有限辅助药须先有真实材料并预配成独立瓶；身体、衣物、气味分别核验。一次事项的已付预算包含本次短时练习与等待消退，0行动结束不是免费持续。' + POTION_PROFESSOR_ENCOUNTER_STORY;
export const potionProfessorInside = (s: SliceState): boolean => Object.values(s.potionProfessor.cases).some(r => r.contactOpen);
export const isPotionProfessorActivity = (c: PotionProfessorCommand): c is PotionProfessorActivityCommand => ['BUY_KIT', 'BREW_ASSISTANCE', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const clearEffects = (): PotionProfessorEffects => ({ quietStep: false, odorVeil: false, bodyVeil: false, clothVeil: false });
const kindsFor = (id: string): readonly PotionProfessorAssistanceKind[] => id === 'quiet-passage' ? ['QUIET_STEP'] : id === 'separate-signals' ? ['BODY_VEIL', 'CLOTH_VEIL', 'ODOR_VEIL'] : [];
function validActivity(c: unknown): c is PotionProfessorActivityCommand {
  if (!record(c)) return false;
  if (['BUY_KIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (c.type === 'BREW_ASSISTANCE') return shape(c, ['type', 'kind']) && POTION_PROFESSOR_ASSISTANCE_KINDS.includes(c.kind as PotionProfessorAssistanceKind);
  if (!POTION_PROFESSOR_CASE_IDS.includes(c.caseId as typeof POTION_PROFESSOR_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: PotionProfessorActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockPotionProfessorEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 6) return '先完成魔药教授晋升。';
  const r = 'caseId' in c ? s.potionProfessor.cases[c.caseId] : null, l = s.potionProfessor.laboratory;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次事项。';
  if (potionProfessorInside(s)) return '先0行动实际等短效结束、确认消退并退出本次现场。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原夜间药房教学室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (Object.entries(s.potionProfessor.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (c.type === 'BUY_KIT') {
    if (l.materials !== 0) return '当前原材料尚未耗尽，不能囤积下一包。';
    if (l.kitStock === 0 && (l.restockAfterWeek === null || s.week <= l.restockAfterWeek)) return '原药房本批三包已售尽，下一真实周才能实际付费补进。';
    return s.cash < POTION_PROFESSOR_KIT_PRICE ? '一包4份明确G封装低强灵性材料需要100便士。' : null;
  }
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'BREW_ASSISTANCE') {
    if (l.materials < 1) return '需要实际持有至少1份G封装低强灵性材料。';
    if (s.spirituality < 2) return '本次调配需要2灵性。';
    if (l.potions.some(p => p.kind === c.kind && p.status === 'PLAYER')) return '已经持有同种未用原瓶，不能重复预配囤积。';
    const original = s.potionProfessor.cases[c.kind === 'QUIET_STEP' ? 'quiet-passage' : 'separate-signals']!;
    if (original.attemptWeek === s.week && original.status === 'OBSERVED') return '本周实际练习失败、原瓶已耗尽，下一真实周再重配重试。';
    return null;
  }
  if (c.type === 'REFLECT') return s.potionProfessor.reflected ? '已经回看这段经历。' : CASES.some(p => s.potionProfessor.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项实际报告与本人教学核实。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.caseId === 'separate-signals' && s.potionProfessor.cases['quiet-passage']!.status !== 'RESOLVED') return '先完成静步原瓶的实际比较与报告。';
  if (c.caseId === 'willing-student' && s.potionProfessor.cases['separate-signals']!.status !== 'RESOLVED') return '先报告前两项真实实践结果，再向愿意学习的成年人教学。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原教学卡、原瓶记录与现场观察已经保留。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束现场。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对当前真实原瓶与现场。';
    if (r.attemptWeek === s.week) return '本周结果与原瓶消耗保留，下一真实周再准备重试。';
    if (c.caseId !== 'willing-student' && c.method !== 'ABILITY') return '实际药剂实践必须使用事先预配的原瓶，普通讲故事不能冒充已制药。';
  } else if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (c.caseId !== 'willing-student') {
    if (c.type === 'PERFORM' && r.method !== 'ABILITY') return '实际用药必须使用有限辅助药剂方案。';
    const missing = kindsFor(c.caseId).filter(kind => !l.potions.some(p => p.kind === kind && p.status === 'PLAYER'));
    if (missing.length) return `需要实际持有预配的独立原瓶：${missing.map(kind => POTION_PROFESSOR_ASSISTANCE[kind].title).join('、')}。`;
  }
  return null;
}
export function applyPotionProfessorActivity(s: SliceState, c: PotionProfessorActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('魔药教授实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyPotionProfessorEncounter(s, c, ctx); return; }
  const m = s.potionProfessor, l = m.laboratory;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1; l.effects = clearEffects();
    ctx.note('确认短效实际结束并退出', '0行动完成本事项已付预算中的短效等待，核对本次G效果确已消退，再退出原教学室；教学事项则实际结束交流。身体、衣物、气味和静步当前效果全部结束。原著未给持续量，此处不编持续时长、不续效、不退瓶、不补材料、不治疗；失败和已付成本保留。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与已付行动保留；尚未使用的独立原瓶仍在玩家包中，不重复生成或退还已耗原瓶。'); return;
  }
  if (c.type === 'BUY_KIT') {
    if (l.kitStock === 0) { l.kitStock = 3; l.restockAfterWeek = null; ctx.note('原药房下一批三包材料实际到货', `第${s.week}周原药房实际补进3包原创G封装低强灵性材料。这里只记录当前教学供给，不模拟全城库存；本次仍须支付100便士购买1包，没有免费材料。`); }
    s.cash -= POTION_PROFESSOR_KIT_PRICE; l.kitsBought += 1; l.kitStock -= 1; l.materials = 4;
    if (l.kitStock === 0) l.restockAfterWeek = s.week;
    ctx.note('付费领取实际封装材料包', `0行动支付100便士，取得第${l.kitsBought}包原创G封装低强灵性材料，共4份。本批剩${l.kitStock}包；没有药剂成品、真实材料名称或操作配方。`); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'BREW_ASSISTANCE') {
    l.materials -= 1; l.brewAttempts += 1; s.spirituality -= 2;
    const result = ctx.check('knowledge', 12), spec = POTION_PROFESSOR_ASSISTANCE[c.kind];
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      const id = `potion-professor-assistance-${l.potions.length + 1}`, source = potionProfessorAssistanceSource(c.kind, l.kitsBought);
      l.potions.push({ id, kind: c.kind, source, brewedWeek: s.week, status: 'PLAYER', usedWeek: null });
      ctx.note('预配成功，取得独立原瓶', `按本作已知${spec.card}完成封闭调配，1行动、2灵性与1份实际材料已耗用。${id}：${source}该原瓶实际在玩家包中，尚未使用；${spec.effect}`);
    } else { l.brewFailures += 1; ctx.note('预配失败，材料与灵性照耗', `本次${spec.title}封闭调配未成，1行动、2灵性与第${l.kitsBought}包中的1份G材料照耗；没有产生原瓶、残料退款或免费补药。`); }
    return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('potion-professor-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('预配、分别验证与自愿教学', '回看真实材料预配、静步比较、身体与衣物和气味分别验证，以及向自愿成年人讲清已有结果与失败风险。G扮演+25；没有新造药剂，不解除血食与身体代价，不获得序列5能力。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`potion-professor-case:${p.id}`, 8);
    ctx.note(p.title, p.result + '本次现场已实际结束，G扮演+25、已知能力单项掌握+8；没有额外药剂或强制交物。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'quiet-passage') ctx.note('先走过同一原地面作普通对照', '你在原室短段净空地面实际普通走动，艾琳记录这一次脚步声；不换房间、不移动旁人或物品。');
  for (const kind of kindsFor(p.id)) {
    const bottle = l.potions.find(b => b.kind === kind && b.status === 'PLAYER')!;
    bottle.status = 'USED'; bottle.usedWeek = s.week;
    const detail = kind === 'QUIET_STEP' ? 'quietStep' : kind === 'BODY_VEIL' ? 'bodyVeil' : kind === 'CLOTH_VEIL' ? 'clothVeil' : 'odorVeil';
    l.effects[detail] = true;
    ctx.note(kind === 'BODY_VEIL' ? '第一瓶：身体透明，衣物和气味仍在' : kind === 'CLOTH_VEIL' ? '第二瓶：另行处理普通衣物' : kind === 'ODOR_VEIL' ? '第三瓶：另行处理自身气味' : '实际使用原静步药并比较', `${bottle.id}（${POTION_PROFESSOR_ASSISTANCE[kind].title}）已实际耗尽。${kind === 'BODY_VEIL' ? '当前只有身体透明；普通衣物仍可见，气味仍在。' : kind === 'CLOTH_VEIL' ? '另用这瓶后，原普通衣物才进入本次短时透明；气味仍在。' : kind === 'ODOR_VEIL' ? '再另用这瓶后，才核对本次自身气味信号的短时减弱。' : '在同一原地面有限走动，实际比较脚步声；不能穿墙或无视地面。'}本次预付短时练习成败均不退瓶，须实际等待消退并退出，不带进战斗。`);
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 12 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome; ctx.note(p.title, p.result + '先0行动确认本次短效实际结束并退出。');
  } else {
    r.status = 'OBSERVED';
    ctx.note(p.title, (p.id === 'willing-student' ? '米娅本人的复述尚未形成可报告的理解；她的意愿保留，本次只教学，未新造或交付药剂。' : '本次实际比较未形成足够可报告结果，原瓶已经耗尽、短效仍须实际结束；没有新药、退款或伪成功。') + '先实际结束现场，下一真实周才能重新准备；用过的药须重新付出材料与灵性预配。');
  }
}
export function potionProfessorActions(s: SliceState): PotionProfessorAction[] {
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 6) return [];
  const out: PotionProfessorAction[] = [];
  const add = (id: string, label: string, cost: string, command: PotionProfessorActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('potion-professor-buy-kit', '购买4份G封装低强灵性材料包', '0行动 · 100便士 · 当前材料耗尽才能买1包', { type: 'BUY_KIT' });
  for (const kind of POTION_PROFESSOR_ASSISTANCE_KINDS) add(`potion-professor-brew-${kind}`, `事先调配${POTION_PROFESSOR_ASSISTANCE[kind].title}`, '1行动 · 2灵性 · 1份材料 · 失败照耗 · 同种未用瓶最多1', { type: 'BREW_ASSISTANCE', kind });
  for (const p of CASES) {
    const r = s.potionProfessor.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '确认短效实际结束并退出', '0行动 · 本事项已付短效等待 · 不退瓶、不续效、不治疗', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对本案原瓶记录与真实现场', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'willing-student' ? '准备有限教学与本人核实' : '准备实际原瓶药剂比较', '1行动 · 只用已有真实记录或预配原瓶', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      if (p.id === 'willing-student') add(p.id + '-ordinary', '准备普通讲解与本人复述', '1行动 · 教学不凭空新造药', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', p.id === 'quiet-passage' ? '用原静步瓶比较同一原路脚步' : p.id === 'separate-signals' ? '依次使用身体、衣物、去味三独立原瓶' : '向米娅实际教学并请本人复述', p.id === 'quiet-passage' ? '1行动 · 静步原瓶1 · 失败照耗' : p.id === 'separate-signals' ? '1行动 · 三种原瓶各1 · 包含实际短时练习 · 失败照耗' : '1行动 · 不交物、不制新药 · 本人仍可拒绝', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 原瓶不变 · 保留已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告真实结果与已知失败风险', '1行动 · 先实际结束现场', { type: 'REPORT', caseId: p.id });
  }
  if (!s.potionProfessor.reflected) add('potion-professor-reflect', '回看分别预配、真实验证与自愿教学', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.potionProfessor.encounter.status === 'AVAILABLE') {
    add('potion-professor-encounter-talk', '前往原夜间药房外院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('potion-professor-encounter-fight', '前往原夜间药房外院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function potionProfessorCases(s: SliceState): PotionProfessorProjection['cases'] {
  if (s.progression.pathwayId !== 'moon' || ![6, 5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return [];
  return CASES.map(p => { const r = s.potionProfessor.cases[p.id]!; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result : r.attemptWeek !== null ? p.id === 'willing-student' ? '此前本人复述未形成可报告理解，没有新药或强制教学；下一真实周才能重试。' : '此前实测未形成可报告结果，实际原瓶已耗尽，须结束短效后下一真实周重新预配并尝试。' : r.withdrawals ? '尚未实施的准备已取消，原事实与独立原瓶保留。' : null, status: r.status, contactOpen: r.contactOpen ? '本次原室仍须确认短效实际消退并退出' : '没有尚未结束的本次事项；辅助药效果均已结束', closes: r.closes }; });
}
/** Materials balance, immutable bottle identity and actual use/exit chronology stay in this small laboratory. */
export function validatePotionProfessorLife(s: SliceState): boolean {
  const m = s.potionProfessor;
  if (!record(m) || !record(m.cases) || !shape(m.cases, POTION_PROFESSOR_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const l = m.laboratory, promotion = m.promotionWeek ?? s.week;
  if (!record(l) || !shape(l, ['kitsBought', 'kitStock', 'restockAfterWeek', 'materials', 'brewAttempts', 'brewFailures', 'potions', 'effects'])) return false;
  if (!integer(l.kitsBought, 0, Math.max(0, s.week - promotion + 1) * 3) || !integer(l.kitStock, 0, 3) || !integer(l.materials, 0, 4) || !integer(l.brewAttempts, 0) || !integer(l.brewFailures, 0, l.brewAttempts) || !Array.isArray(l.potions)) return false;
  if (l.restockAfterWeek !== null && !integer(l.restockAfterWeek, promotion + Math.floor(Math.max(0, l.kitsBought - 1) / 3), s.week)) return false;
  if ((l.kitStock === 0) !== (l.restockAfterWeek !== null) || l.kitStock !== (l.kitsBought === 0 ? 3 : (3 - l.kitsBought % 3) % 3)) return false;
  if (l.kitsBought * 4 - l.brewAttempts !== l.materials || l.potions.length !== l.brewAttempts - l.brewFailures) return false;
  if (!record(l.effects) || !shape(l.effects, ['quietStep', 'odorVeil', 'bodyVeil', 'clothVeil']) || !Object.values(l.effects).every(v => typeof v === 'boolean')) return false;
  const held: Record<PotionProfessorAssistanceKind, number> = { QUIET_STEP: 0, ODOR_VEIL: 0, BODY_VEIL: 0, CLOTH_VEIL: 0 };
  const usedWeeks: Record<PotionProfessorAssistanceKind, number[]> = { QUIET_STEP: [], ODOR_VEIL: [], BODY_VEIL: [], CLOTH_VEIL: [] };
  const perKit = new Map<number, number>();
  let previousKit = 0, previousBrewWeek = promotion;
  for (const [index, p] of l.potions.entries()) {
    if (!record(p) || !shape(p, ['id', 'kind', 'source', 'brewedWeek', 'status', 'usedWeek']) || p.id !== `potion-professor-assistance-${index + 1}` || !POTION_PROFESSOR_ASSISTANCE_KINDS.includes(p.kind) || typeof p.source !== 'string') return false;
    const match = p.source.match(/实际耗用第(\d+)包/), kit = match ? Number(match[1]) : 0;
    if (!integer(kit, Math.max(1, previousKit), l.kitsBought) || p.source !== potionProfessorAssistanceSource(p.kind, kit) || !integer(p.brewedWeek, Math.max(previousBrewWeek, promotion + Math.floor((kit - 1) / 3)), s.week)) return false;
    if (kit === l.kitsBought && l.restockAfterWeek !== null && p.brewedWeek < l.restockAfterWeek) return false;
    perKit.set(kit, (perKit.get(kit) ?? 0) + 1);
    if (perKit.get(kit)! > (kit === l.kitsBought ? 4 - l.materials : 4)) return false;
    previousKit = kit; previousBrewWeek = p.brewedWeek;
    if (p.status === 'PLAYER') { if (p.usedWeek !== null || ++held[p.kind] > 1) return false; }
    else if (p.status === 'USED') {
      if (!integer(p.usedWeek, p.brewedWeek, s.week)) return false;
      usedWeeks[p.kind].push(p.usedWeek!);
    } else return false;
  }
  let open = 0, prepared = 0, resolved = 0;
  const expectedEffects = clearEffects();
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `potion-professor-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week || kindsFor(p.id).some(kind => held[kind] !== 1)) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
      if (p.id === 'quiet-passage') expectedEffects.quietStep = true;
      if (p.id === 'separate-signals') { expectedEffects.bodyVeil = true; expectedEffects.clothVeil = true; expectedEffects.odorVeil = true; }
    }
    if (p.id !== 'willing-student' && r.method !== null && r.method !== 'ABILITY') return false;
    for (const kind of kindsFor(p.id)) {
      const weeks = usedWeeks[kind].sort((a, b) => a - b);
      if (weeks.length !== r.closes + (r.contactOpen ? 1 : 0) || new Set(weeks).size !== weeks.length || (weeks.length ? weeks.at(-1) !== r.attemptWeek : r.attemptWeek !== null)) return false;
    }
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (Object.entries(expectedEffects).some(([key, value]) => l.effects[key as keyof PotionProfessorEffects] !== value)) return false;
  if (JSON.stringify(usedWeeks.BODY_VEIL) !== JSON.stringify(usedWeeks.CLOTH_VEIL) || JSON.stringify(usedWeeks.BODY_VEIL) !== JSON.stringify(usedWeeks.ODOR_VEIL)) return false;
  if (m.cases['separate-signals']!.status !== 'AVAILABLE' && m.cases['quiet-passage']!.status !== 'RESOLVED' || m.cases['willing-student']!.status !== 'AVAILABLE' && m.cases['separate-signals']!.status !== 'RESOLVED') return false;
  if (s.seer.completedSources.filter(x => x === 'potion-professor-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'moon' && s.progression.sequence === 6 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (l.kitsBought !== 0 || l.kitStock !== 3 || l.restockAfterWeek !== null || l.materials !== 0 || l.brewAttempts !== 0 || l.brewFailures !== 0 || l.potions.length !== 0 || open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected)) return false;
  return true;
}
