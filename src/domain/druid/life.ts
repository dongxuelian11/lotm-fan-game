import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyDruidEncounter, blockDruidEncounter, DRUID_ENCOUNTER_STORY } from './encounter.js';
import { DRUID_CASE_IDS, type DruidCommand, type DruidActivityCommand, type DruidAction, type DruidProjection } from './types.js';

const CASES = [
  {
    id: 'known-soil', title: '原身体穿过一米已知浅土',
    story: '伊芙·莫兰在原训练园核对一条长一米的已知普通浅壤土通道，近端NEAR与远端FAR均有敞开的原低阶出口，旁边同一条干燥普通地表小路始终畅通。通道没有金属、地基、未知土层或脚下活物。你只让自己的原身体通过这一米，并携带唯一原标记DR5-MARKER-1；这不是遥控观察或替身。（原创G）',
    facts: ['原通道与地表返程已经由你和伊芙亲自核对；本次仅限两个已知原端点，不延伸到地下未知地点。', '能力去程1行动、3灵性、知识14；成功才实际携原标记到FAR，失败仍在NEAR，费用保留。', '能力返程0行动、另3灵性、独立知识14；往返预计6灵性，每次实践只有一次能力返程尝试。失败仍在FAR。', '原普通地表返程始终可0行动0灵性实际走回NEAR，不检定、不施法；安全返程与收束的时间包含在原实践预算中。'],
    ability: '把唯一原标记DR5-MARKER-1放在NEAR，准备携它让原身体潜过同一米浅土。实施另3灵性、知识14；另选能力返程再3灵性、独立检定，往返预计6灵性，也可走原普通地表路返回。',
    ordinary: '把同一原标记DR5-MARKER-1放在NEAR，准备本人携它沿原一米干燥地表小路走到FAR，再作知识10核对；0灵性，核对失败也保留实际位置，之后必须明确返程。',
    abilityResult: '你的原身体实际携唯一DR5-MARKER-1潜过一米已知普通浅土到FAR，临时软化的土已重新稳定；随后你已实际返回NEAR并把同一原标记归还原盒。',
    ordinaryResult: '你的原身体实际携唯一DR5-MARKER-1沿同一米普通地表小路走到FAR，完成有限核对后实际返回NEAR，并把原标记放回原盒；去程没有施放地下潜行。',
    outcome: 'PASSAGE_CHECKED',
  },
  {
    id: 'paired-growth', title: '原畦里同一对普通苗',
    story: '伊芙允许你在同一原苗圃查看两株既有普通原苗DR5-SEEDLING-A与DR5-SEEDLING-B。两株始终留在各自原畦；你只对照原有浇水、土壤记录与本次实际可见的有限情况。（原创G）',
    facts: ['同一两株原苗、原畦与已有记录均实际在场，原苗保持存活，不进入玩家库存。', '本项只用普通观察，1行动、0灵性、知识10；失败仍保留已经查看的事实，不能声称取得成功结论。', '没有新浇水、快速生长、催生新品种、生物复制或额外产量。'],
    ability: '本项不施术，只允许普通观察。',
    ordinary: '准备在原畦旁核对同一两株原苗和已有浇水、土壤记录；实施1行动、0灵性、知识10，不移动原苗或消耗旧原水。',
    abilityResult: '',
    ordinaryResult: '你普通查看了原畦里同一两株原苗，对照已有浇水与土壤记录，只报告本次可见的有限情况。两株仍存活于原畦，没有新苗、新品种、额外产量或能力施放。',
    outcome: 'GROWTH_CHECKED',
  },
  {
    id: 'honest-record', title: '把同一张有限记录交还本人',
    story: '伊芙把本次唯一原记录纸DR5-LIFE-NOTE-1留在原台，供你写明已经实际完成的去回与原苗观察。它与晋升学习的原笔记本不同。你只记录可知的有限结果，并亲手将同一张原纸交给伊芙；没有从职业名字推断动物变形。（原创G）',
    facts: ['唯一DR5-LIFE-NOTE-1始终是同一张纸；失败后的原字迹保留，重试只补记，不复制原件。', '实施1行动、0灵性、知识10；先实际写下有限记录，失败也须亲手交回这张原纸，不能凭空撤销字迹。', '本次不提供熊、鹰、龙等未核动物形态，不授予灵魂、造物或序列4炼金术。'],
    ability: '本项不施术，只允许普通书写与亲手交还。',
    ordinary: '准备核对已经发生的真实经历与未知边界；实施时在同一张DR5-LIFE-NOTE-1上书写或补记，之后亲手交给原主人伊芙。',
    abilityResult: '',
    ordinaryResult: '你已把真实去回、原苗有限观察和未知边界写在同一张DR5-LIFE-NOTE-1上，再亲手交给伊芙本人。记录没有宣称未核动物形态或高阶炼金能力。',
    outcome: 'RECORD_CHECKED',
  },
] as const;
type Case = typeof CASES[number];

export const DRUID_ENVIRONMENT = '以下人物、原物、场地、距离、检定与费用为原创G：观察、准备、实施、报告各1行动。第一项只让自己的原身体携唯一原标记穿过一米已知普通浅土；能力去程3灵性、知识14，返程另3灵性、独立知识14，往返预计6灵性，失败照付。每次实践只有一次能力返程尝试；原干燥地表返程始终开放，0行动0灵性实际步行，不施法且无需检定。只有回到NEAR、土已稳定，才可0行动把同一原标记归盒并结束接触；不能以CLOSE瞬移。普通去程实际走到FAR后核对失败也须返程。后两项只普通观察原畦同一两株苗、在唯一原纸上写明有限记录并亲手交还，不催生、不复制。每项每真实周至多实施一次，失败收束后下一真实周再准备。三报告各G扮演25、反思25，可全普通和平100；只有第一项真实能力去程成功且实际返回收束后的报告，才取得一次已有知识池单项掌握8。没有免费返程施法、灵性补满、动物变形菜单或序列4造物炼金。 ' + DRUID_ENCOUNTER_STORY;
const active = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 5;
export const druidInside = (s: SliceState) => s.druid.practice.position !== 'NEAR' || s.druid.practice.soil !== 'SETTLED' || Object.values(s.druid.cases).some(r => r.contactOpen);
export const isDruidActivity = (c: DruidCommand): c is DruidActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'RETURN', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is DruidActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!DRUID_CASE_IDS.includes(c.caseId as typeof DRUID_CASE_IDS[number])) return false;
  if (c.type === 'RETURN') return shape(c, ['type', 'caseId', 'method']) && c.caseId === 'known-soil' && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string) && (c.caseId === 'known-soil' || c.method === 'ORDINARY');
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: DruidActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成德鲁伊晋升。';
  const m = s.druid, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '先实际返回贝克兰德伊芙的原训练园，不能借收束从异地传回。';
  if (c.type === 'RETURN') {
    if (!r?.contactOpen || f.position !== 'FAR' || f.marker !== 'FAR' || f.soil !== 'SETTLED') return '须本人携原标记实际在FAR，才可沿原场地返程。';
    if (c.method === 'ORDINARY') return null;
    if (f.returnAttempted) return '本次能力返程已尝试，费用与位置保留；请沿始终开放的原地表小路0行动0灵性实际返回。';
    return s.spirituality < 3 ? '能力返程另需3灵性；仍可沿原地表小路0行动0灵性实际返回。' : null;
  }
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen) return '没有尚未结束的本次接触。';
    return f.position !== 'NEAR' || f.soil !== 'SETTLED' ? '仍在FAR，先明确选择RETURN实际返程，不能用CLOSE瞬移。' : null;
  }
  if (druidInside(s)) return '先明确实际返程，再0行动收稳原物并结束接触。';
  if ([s.biologist, s.harvestpriest, s.physician, s.cultivator].some(previous => Object.values(previous.cases).some(value => value.contactOpen))) return '先实际结束原序列尚未收束的原现场接触。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备；已实施的操作须实际返程并CLOSE。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或0行动取消另一项已准备的事项。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockDruidEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '本项已报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原场地、原物与本次边界。' : r.attemptWeek === s.week ? '本周实践与成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '先取得真实结果，并实际返程、收稳原物和结束接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周再准备。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '能力去程需要3灵性，不能透支；可0行动取消准备再改普通方法。能力往返预计6灵性，原普通返程始终0灵性。' : null;
}
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.druid.practice;
  return `原身体位于${f.position}；原土${f.soil === 'SETTLED' ? '已稳定' : '仍软化'}；唯一DR5-MARKER-1${f.marker === 'BOX' ? '在原盒' : `随本人在${f.marker}`}。两株原苗${f.seedlings === 'RESTING' ? '原畦安置' : '刚经普通观察、待结束接触'}；唯一原记录纸${f.note === 'BLANK' ? '尚未书写' : f.note === 'WRITTEN' ? '已写、待亲手交还' : '已亲手交给伊芙'}。`;
};
export function applyDruidActivity(s: SliceState, c: DruidActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('德鲁伊活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyDruidEncounter(s, c, ctx); return; }
  const m = s.druid, f = m.practice;
  if (c.type === 'RETURN') {
    if (c.method === 'ABILITY') {
      s.spirituality -= 3; f.returnAttempted = true;
      const result = ctx.check('knowledge', 14);
      if (result.tier !== 'SUCCESS' && result.tier !== 'GREAT_SUCCESS') {
        ctx.note('能力返程未成，原身体仍在FAR', `另3灵性已实际支付，独立知识14判定${result.roll}/${result.chance}未通过。本人和同一DR5-MARKER-1仍在原敞开远端FAR，原土保持稳定，接触未关闭；本次不能再次尝试能力返程。原干燥低阶出口与地表小路始终畅通，可0行动0灵性实际走回NEAR，不退款、不补资源。`); return;
      }
      f.soil = 'SOFTENED'; f.position = 'NEAR'; f.marker = 'NEAR'; f.soil = 'SETTLED';
      ctx.note('另付灵性实际潜回原近端', '0行动、另3灵性，独立知识14成功。你携同一DR5-MARKER-1让自己的原身体沿同一米已知浅土从FAR潜回NEAR，临时软化的原土已稳定；这次返程不包含在去程3灵性中。仍须CLOSE亲手把原标记归盒并结束接触。');
    } else {
      f.position = 'NEAR'; f.marker = 'NEAR';
      ctx.note('本人沿原地表小路实际返回', '0行动、0灵性，无需检定。你从原敞开低阶出口走上始终畅通的同一米干燥地表小路，携唯一DR5-MARKER-1实际从FAR走回NEAR。没有返程施法、不回灵性；返程时间已含原实践预算，仍须CLOSE亲手把原标记归盒并结束接触。');
    }
    return;
  }
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let closure = '';
    if (c.caseId === 'known-soil') { f.marker = 'BOX'; closure = '本人已实际在NEAR，原土已稳定。你亲手把同一DR5-MARKER-1放回唯一原盒；本次收束没有移动身体或免费返程。'; }
    if (c.caseId === 'paired-growth') { f.seedlings = 'RESTING'; closure = '你停止本次普通观察，核对同一DR5-SEEDLING-A与B仍存活于各自原畦，随后退开；没有搬走、替换或生成苗木。'; }
    if (c.caseId === 'honest-record') { f.note = 'HANDED_OVER'; closure = '你亲手把已写字迹的同一张DR5-LIFE-NOTE-1交给伊芙本人；成功或不足的原记录均保留，没有复制、销毁或撤回真实书写。'; }
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际收束原现场', '0行动。' + closure + '本次接触已结束，原结果与已付行动、灵性保留，不退款、不治疗、不增加掌握或扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'known-soil') f.marker = 'BOX';
    ctx.note('取消尚未实施的准备', '0行动，保留已经付出的准备行动。本人仍在原近端；若准备过标记，亲手将同一DR5-MARKER-1归还原盒。没有施法、移动原身体、观察新结果或改写已交还的原纸，可以正常生活或改用普通方法。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('druid-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('有限土地、原生命与诚实记录', '回看自己的原身体与同一原标记的实际去回、原畦同一两株苗的普通观察，以及原记录的亲手交还。G扮演+25。普通方法同样完成有限帮助，不伪造未使用的能力，也不把动物变形或高阶炼金当作已验证知识。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'known-soil') { f.marker = 'NEAR'; f.returnAttempted = false; }
    ctx.note('准备本次有限实践', (c.method === 'ABILITY' ? p.ability : p.ordinary) + '尚未实施；即使这是本周最后行动，也可0行动取消准备，不返还准备成本。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `druid-case:${p.id}`, ability = p.id === 'known-soil' && r.method === 'ABILITY';
    if (ability) award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(p, r.method!) + '本次原现场已实际收束。G扮演+25；' + (ability ? '真实能力去程的报告取得一次已有知识池单项掌握+8。' : '普通报告不伪造能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'known-soil' && r.method === 'ORDINARY') { f.position = 'FAR'; f.marker = 'FAR'; }
  if (p.id === 'paired-growth') f.seedlings = 'OBSERVED';
  if (p.id === 'honest-record') {
    const previouslyHandedOver = f.note === 'HANDED_OVER'; f.note = 'WRITTEN';
    ctx.note('在同一张原纸上实际书写', previouslyHandedOver ? '伊芙本人交回同一张DR5-LIFE-NOTE-1，你保留上次原字迹并补记本次有限认识，随后核对记录是否充分；没有换成新纸或抹去失败。' : '你取原台唯一DR5-LIFE-NOTE-1，亲手写下已发生的有限经历与未知边界，随后核对记录是否充分。字迹已经发生，判定失败也不会消失。');
  }
  if (r.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'known-soil') {
      if (r.method === 'ABILITY') { f.soil = 'SOFTENED'; f.position = 'FAR'; f.marker = 'FAR'; f.soil = 'SETTLED'; }
      ctx.note(p.title, (r.method === 'ABILITY' ? '你已实际支付3灵性，让原身体携同一DR5-MARKER-1潜过一米已知浅土到FAR；原土临时软化后已稳定。' : '本人已携同一DR5-MARKER-1沿原一米地表小路走到FAR，并完成知识核对；没有施放去程能力。') + '去程成功不包含返程。先明确RETURN另付3灵性独立能力返程，或沿原地表路0行动0灵性实际返回，再CLOSE收稳原物。');
    } else ctx.note(p.title, '本次普通核对成功，已有有限结果。' + (p.id === 'paired-growth' ? '同一原苗仍留原畦，先CLOSE结束观察并退开。' : '同一原纸已写，先CLOSE亲手交给伊芙本人。'));
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次有限核对不足，不能报告。已付行动与实际使用的灵性保留。' + (p.id === 'known-soil' ? r.method === 'ABILITY' ? '能力去程未成，本人和原标记仍在NEAR，土保持稳定；先CLOSE亲手归还原标记。' : '普通步行已经发生，本人和原标记仍在FAR；先明确RETURN实际返回，再CLOSE归还原标记。' : p.id === 'paired-growth' ? '已经普通查看同一原苗，先CLOSE结束接触，原苗留在原畦。' : '实际写下的原字迹保留，先CLOSE亲手交回同一原纸。') + '实际收束后下一真实周可再准备。');
  }
}

export function druidActions(s: SliceState): DruidAction[] {
  if (!active(s)) return [];
  const out: DruidAction[] = [];
  const add = (id: string, label: string, cost: string, command: DruidActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.druid.cases[p.id]!;
    if (r.contactOpen) {
      if (p.id === 'known-soil' && s.druid.practice.position === 'FAR') {
        add(`${p.id}-return-ability`, '另付灵性，让原身体潜回NEAR', '0行动 · 另3灵性 · 独立知识14 · 本次仅一次 · 往返预计6灵性', { type: 'RETURN', caseId: 'known-soil', method: 'ABILITY' });
        add(`${p.id}-return-ordinary`, '沿原地表小路实际走回NEAR', '0行动 · 0灵性 · 无需检定 · 原安全出口始终开放', { type: 'RETURN', caseId: 'known-soil', method: 'ORDINARY' });
      }
      add(`${p.id}-close`, p.id === 'known-soil' ? '在NEAR亲手归盒原标记并结束接触' : p.id === 'paired-growth' ? '原苗留原畦，结束普通观察' : '亲手把同一张原记录交给伊芙', '0行动 · 不移动身体 · 原结果与成本保留', { type: 'CLOSE', caseId: p.id });
    }
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原场地、原物与有限边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      if (p.id === 'known-soil') add(`${p.id}-ability`, '准备原身体的一米浅土潜行', '1行动 · 去程3灵性，另选能力返程3灵性 · 往返预计6灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备同一原物的普通方法', '1行动 · 0灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, p.id === 'known-soil' ? '本人携原标记实际到FAR' : p.id === 'paired-growth' ? '普通观察原畦同一两株苗' : '在同一原纸写下真实有限记录', r.method === 'ABILITY' ? '1行动 · 去程3灵性 · 知识14 · 能力往返预计6灵性 · 失败照付' : '1行动 · 0灵性 · 知识10 · 失败保留实际经历', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 原物归位 · 不退准备成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告真实有限结果与未知', '1行动 · G扮演25 · 先实际收束', { type: 'REPORT', caseId: p.id });
  }
  if (!s.druid.reflected) add('druid-reflect', '回看土地、原生命与记录责任', '1行动 · 三项报告后 · G扮演25', { type: 'REFLECT' });
  if (s.druid.encounter.status === 'AVAILABLE') {
    add('druid-encounter-talk', '到原园边向马伦当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('druid-encounter-fight', '到原园边承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function druidCases(s: SliceState): DruidProjection['cases'] {
  if (!active(s)&&!(s.progression.pathwayId==='mother'&&(s.progression.sequence===4||s.progression.sequence===3))) return [];
  return CASES.map(p => {
    const r = s.druid.cases[p.id]!;
    let result: string | null = null;
    if (r.contactOpen) result = (r.status === 'EXAMINED' ? '已取得有限结果，' : '本次结果不足，') + (p.id === 'known-soil' && s.druid.practice.position === 'FAR' ? '本人及同一原标记仍在FAR；先选择RETURN实际返程，再CLOSE归还原标记。' : p.id === 'honest-record' ? '同一原纸已写，先CLOSE亲手交给伊芙本人。' : '先CLOSE实际收稳原物并结束接触。');
    else if (['EXAMINED', 'RESOLVED'].includes(r.status)) result = resultText(p, r.method!);
    else if (r.attemptWeek !== null) result = '此前结果不足，原行动、实际灵性与已发生的经历保留；实际收束后下一真实周可再准备。';
    else if (r.withdrawals) result = '尚未实施的准备已取消，原身体、原苗与同一原物保持原位。';
    if (result) result += practiceText(s);
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次原现场操作尚待实际返程或收束' : '没有尚待结束的本次接触', closes: r.closes };
  });
}
export function druidPractice(s: SliceState): DruidProjection['practice'] { return { ...s.druid.practice }; }

/** The persisted body and original objects must agree with the finite, explicitly closed practice. */
export function validateDruidLife(s: SliceState): boolean {
  const m = s.druid, f = m.practice;
  if (!record(f) || !shape(f, ['position', 'soil', 'marker', 'seedlings', 'note', 'returnAttempted'])) return false;
  if (!['NEAR', 'FAR'].includes(f.position) || f.soil !== 'SETTLED' || !['BOX', 'NEAR', 'FAR'].includes(f.marker) || !['RESTING', 'OBSERVED'].includes(f.seedlings) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note) || typeof f.returnAttempted !== 'boolean') return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, p] of CASES.entries()) {
    const r = m.cases[p.id]; if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !integer(r.closes) || !integer(r.withdrawals) || typeof r.contactOpen !== 'boolean') return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (p.id !== 'known-soil' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(x => x === `druid-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (i > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[i - 1]!.id]!.status !== 'RESOLVED') return false;
    if (r.status === 'AVAILABLE' && (r.attemptWeek !== null || r.method !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.contactOpen || r.attemptWeek === s.week) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.outcome !== p.outcome || r.attemptWeek === null || r.method === null) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.closes < 1 || r.contactOpen) return false; }
    if (r.closes > 0 && r.attemptWeek === null) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.status !== 'ACTIVE' || s.activeEvent !== null || s.combat !== null || s.world.city !== 'BACKLUND') return false; }
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const soil = m.cases['known-soil']!, seedlings = m.cases['paired-growth']!, note = m.cases['honest-record']!;
  if (f.position === 'FAR' && (!soil.contactOpen || f.marker !== 'FAR' || soil.method === 'ABILITY' && soil.status !== 'EXAMINED')) return false;
  if (soil.contactOpen || soil.status === 'PREPARED') { if (f.marker !== f.position) return false; }
  else if (f.marker !== 'BOX' || f.position !== 'NEAR') return false;
  if (soil.status === 'PREPARED' && (f.position !== 'NEAR' || f.returnAttempted)) return false;
  if (f.returnAttempted && (soil.attemptWeek === null || soil.status === 'AVAILABLE' || soil.status === 'PREPARED' || soil.method === 'ABILITY' && soil.status === 'OBSERVED')) return false;
  if ((f.seedlings === 'OBSERVED') !== seedlings.contactOpen) return false;
  if (note.contactOpen ? f.note !== 'WRITTEN' : note.attemptWeek === null ? f.note !== 'BLANK' : f.note !== 'HANDED_OVER') return false;
  if (s.seer.completedSources.filter(x => x === 'druid-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId==='mother' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)) && ((s.progression.sequence===4||s.progression.sequence===3)?s.ancientAlchemist.druidActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (open !== 0 || prepared !== 0 || resolved !== 0 || m.reflected || f.returnAttempted || f.position !== 'NEAR' || f.marker !== 'BOX' || f.seedlings !== 'RESTING' || f.note !== 'BLANK' || CASES.some(p => m.cases[p.id]!.status !== 'AVAILABLE'))) return false;
  return true;
}
