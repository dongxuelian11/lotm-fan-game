import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyDreamwalkerEncounter, blockDreamwalkerEncounter, DREAMWALKER_ENCOUNTER_STORY } from './encounter.js';
import { DREAMWALKER_CASE_IDS, type DreamwalkerCommand, type DreamwalkerActivityCommand, type DreamwalkerAction, type DreamwalkerProjection } from './types.js';

const CASES = [
  {
    id: 'dream-evidence', title: '梦里换了位置的箱子', spirit: 2, requiredSessions: 1,
    story: '成年文书诺尔本人同意在原起点静室SOURCE_ROOM记录一段已有梦境。他梦见两只箱子换了位置，只允许谈这个片段；原交接记录仍在原阅览桌，须在清醒后另行核对。梦境不是定罪依据。（原创G）',
    facts: ['诺尔同意的对象只是一段已有梦境；能力实施时本人实际在SOURCE_ROOM自然熟睡，不能把清醒者直接拉入梦。', '箱子换位只是本人梦中说法或象征，梦里出现的人影没有得到现实身份确认。', '原交接记录获准在清醒后核对；原箱、原记录和其他隐私均不被带走。'],
    ability: '准备进入诺尔已经存在的梦，只记录本人同意的箱子换位片段；实施1行动、2灵性、意志14。进入不是强制让清醒者睡着。',
    ordinary: '准备听清醒诺尔自己回忆这一片段；实施1行动、知识10、0灵性。普通谈话不进入梦境，也不能把回忆变成证据。',
    abilityResult: '你进入了实际在SOURCE_ROOM熟睡的诺尔已有梦境，只记录“箱子换位”这一象征性说法。它可能失真，没有确认人物身份、动机或现实调包。',
    ordinaryResult: '诺尔在SOURCE_ROOM清醒自述自己记得的“箱子换位”片段；你只是普通记录其回忆，没有入梦或取得确定供词。',
    verification: '诺尔醒后本人同意你查看原交接记录：记录载明两只原箱由当班保管员按编号正常移位。你只确认这份现实记录与梦中说法的有限对应，梦里人影身份仍未知，没有据梦认定犯罪。',
    outcome: 'EVIDENCE_CHECKED',
  },
  {
    id: 'repeated-garden', title: '隔周再见的花园', spirit: 3, requiredSessions: 2,
    story: '成年阿米娜自愿约定在两次真实不同周到原起点静室SOURCE_ROOM，围绕本人选择的花园意象作有限练习。她可结束任何一次，能力的日积月累影响不等于一次永久改写记忆；两次练习也不保证现实治愈。（原创G）',
    facts: ['阿米娜每次依约本人到访SOURCE_ROOM，能力路线实施时实际自然熟睡并有自己的已有梦境。', '两次成功练习须分别处在真实不同周；第一次实际退出后保留记录，等下一周重新准备。', '普通方法同样由本人两次隔周清醒谈话，不伪称修改梦境；醒后反馈只由她本人给出。'],
    ability: '准备在阿米娜自愿且已经熟睡后，对她选定的已有花园梦境作有限意象调整；每次实施1行动、3灵性、意志14。需要两次真实不同周，仍无永久改记忆或治愈承诺。',
    ordinary: '准备在SOURCE_ROOM与清醒阿米娜谈她自己选择的花园意象；每次实施1行动、知识10、0灵性，同样须两次真实不同周。',
    abilityResult: '阿米娜实际在SOURCE_ROOM熟睡后，你进入她已有的花园梦境，依本人同意有限调整这次意象。只记本次体验，没有一键改变记忆、人格或保证现实康复。',
    ordinaryResult: '阿米娜清醒到访SOURCE_ROOM，与你完成一次本人选择的花园意象普通谈话。没有入梦、施加精神影响或声称改变她的记忆。',
    verification: '两次真实不同周的约定都已结束后，阿米娜清醒自述：这次回想花园时愿意停留片刻，除此仍有不确定。你只记录她本人的有限反馈，不把两次练习报告为治愈、永久记忆修改或替代现实照护。',
    outcome: 'REFLECTION_CHECKED',
  },
  {
    id: 'paired-dream', title: '两间静室之间', spirit: 4, requiredSessions: 1,
    story: '成年诺尔和阿米娜都事先同意一次两室比较。能力实施时诺尔实际在SOURCE_ROOM熟睡、阿米娜实际在TARGET_ROOM熟睡，两室间已核原普通步行路线160米，处于新晋梦境行者不超过500米的范围内。你只移动本人，去程不包含返回。（原创G）',
    facts: ['两位成年人本人同意，实际在各自原静室熟睡且各有已有梦境，缺一不可；不把清醒者直接拉入梦。', '已核原普通路线160米，远小于500米；不开放任意坐标、远程目标或携带他人。', '能力使本人身体虚化，在两个智慧生物的已有梦之间实际闪现；退出落在当下实际静室，身体不会自动回起点。', '普通方法沿同一原160米通路实际步行，到位仍须明确走回；本事项1行动已计入往返步行时间，RETURN只完成已付事项的返程。'],
    ability: '准备从SOURCE_ROOM诺尔的已有梦进入TARGET_ROOM阿米娜的已有梦；实施1行动、4灵性、意志14。成功时本人身体实际到TARGET_ROOM，退出后仍须走原160米普通路返回。',
    ordinary: '准备沿已核原160米通路实际步行去TARGET_ROOM作普通现场比较；实施1行动、知识10、0灵性。成功到位后仍须CLOSE与RETURN，不伪称梦间移动。',
    abilityResult: '两位本人依约实际熟睡。你从SOURCE_ROOM诺尔的已有梦出发，身体虚化并在160米范围内实际到TARGET_ROOM阿米娜的已有梦；当前位置TARGET_ROOM、当前梦AMINA。原身体没有留在起点，也没有带他人或原场物。',
    ordinaryResult: '你沿已核原160米通路实际步行到TARGET_ROOM，完成普通现场比较。本人身体在TARGET_ROOM、当前梦NONE；没有虚化、闪现或进入任何人的梦。',
    verification: '完成实际退出与原160米普通步行返程后，两位本人醒来共同核对原两室与到访记录。只确认这次有限去程和返程；能力路线确认身体实际移动，普通路线只是步行，均未搬走原场物或将梦中说法当作现实证据。',
    outcome: 'TRAVEL_CHECKED',
  },
] as const;
type CaseDefinition = typeof CASES[number];
const sessionText = (p: CaseDefinition, method: 'ABILITY' | 'ORDINARY', session: number) => `第${session}次实际记录：${method === 'ABILITY' ? p.abilityResult : p.ordinaryResult}`;

export const DREAMWALKER_ENVIRONMENT = '三个原静室事项与行动、灵性、难度及160米场景数值均为原创G。观察、准备、实施、清醒核实、报告各1行动；CLOSE实际退出、RETURN沿已知原路返程和WITHDRAW取消未实施准备均0行动。梦境引导只能进入已有梦，不能直接拉清醒者入梦；梦境修改依日积月累影响，不一键改记忆。本人身体能在两位智慧生物的已有梦间实际闪现，新晋距离不超过500米；退出落当前实际节点，不自动回原地。能力三案分别2/3/4灵性，普通路线0灵性；失败成本保留，须退出后等下一真实周重新准备。花园须两次真实不同周，普通谈话也不能同周刷完；梦中说法须另付1行动醒后现实核实。三项报告各25扮演与单项掌握8，反思25，可和平100；无医疗保证、人格操纵或精神瘟疫。 ' + DREAMWALKER_ENCOUNTER_STORY;
export const dreamwalkerInside = (s: SliceState) => s.dreamwalker.ritual.activeVisitId !== null || s.dreamwalker.practice.dream !== 'NONE' || s.dreamwalker.practice.location !== 'SOURCE_ROOM' || Object.values(s.dreamwalker.cases).some(r => r.contactOpen);
export const isDreamwalkerActivity = (c: DreamwalkerCommand): c is DreamwalkerActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'RETURN', 'VERIFY', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is DreamwalkerActivityCommand {
  if (!record(c)) return false;
  if (['RETURN', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!DREAMWALKER_CASE_IDS.includes(c.caseId as typeof DREAMWALKER_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'VERIFY', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: DreamwalkerActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.dreamwalker.ritual.activeVisitId !== null) return '先0行动实际结束原晋升仪式，归还原羽毛并退出。';
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 5) return '先完成梦境行者晋升。';
  const m = s.dreamwalker, p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? m.cases[p.id] : null;
  if (c.type === 'CLOSE' || c.type === 'RETURN') {
    if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '原静室现场不符，不能用退出或返程瞬移。';
    if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未实际结束的本次接触。';
    if (m.practice.dream !== 'NONE' || Object.values(m.cases).some(r => r.contactOpen)) return '先0行动从当前梦退出或结束普通现场比较，再走原路返回。';
    return m.practice.location === 'TARGET_ROOM' ? null : '本人已经在SOURCE_ROOM，不能重复返程。';
  }
  if (dreamwalkerInside(s)) return '先0行动实际退出当前梦或接触；若在TARGET_ROOM，再沿原160米普通路返回。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原静室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockDreamwalkerEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项清醒核实后的有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场、本人同意与退出约定已经记录。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先实际核对本人同意和原静室现场。' : r.attemptWeek === s.week ? '本周实际结果保留，须下一真实周重新准备；花园两次练习不能同周完成。' : null;
  if (c.type === 'VERIFY') return r.status !== 'EXAMINED' || r.sessions !== p.requiredSessions ? '先取得所需有限记录，并实际退出、完成返程。' : r.verified ? '已经完成本次清醒现实核实。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.verified ? null : '先实际退出、返程并另行清醒核实，不据梦直接报告事实。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已实际尝试，下一真实周重新准备。';
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次能力实施需要${p.spirit}灵性；可取消准备后选择普通方法。` : null;
}
export function applyDreamwalkerActivity(s: SliceState, c: DreamwalkerActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('梦境行者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyDreamwalkerEncounter(s, c, ctx); return; }
  const m = s.dreamwalker;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!, wasDreaming = m.practice.dream !== 'NONE';
    m.practice.dream = 'NONE'; r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'repeated-garden' && r.sessions < 2) r.status = 'OBSERVED';
    ctx.note('实际退出，身体落在当前静室', `0行动、0灵性。${wasDreaming ? '你实际退出当前已有梦境，停止本次有限梦境影响。' : '你实际结束本次普通接触。'}本人身体仍在${m.practice.location}，不会自动回到别处；${m.practice.location === 'TARGET_ROOM' ? '现在还须沿已核原160米普通路RETURN。' : '已在原起点静室结束本次事项。'}${c.caseId === 'repeated-garden' && r.sessions === 1 ? '第一次实际记录保留；下一真实周再准备第二次约定。' : ''}已付成本、成功记录与未知保留，不补资源、不治疗。`); return;
  }
  if (c.type === 'RETURN') {
    m.practice.location = 'SOURCE_ROOM'; m.practice.returns += 1;
    ctx.note('沿原160米普通路实际返回', '0行动、0灵性。你已退出梦境，从TARGET_ROOM沿先前核实的原160米普通通路步行回SOURCE_ROOM；本事项实施的1行动已包含这段往返步行时间，此步只完成已付事项的返程。没有梦间闪现、携带他人、移动原场物或返还灵性。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消这次准备。没有入梦、修改意象或移动到另一间静室；原观察、此前实际记录与已花行动保留。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('dreamwalker-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('梦中所见与醒来之后', '回看一段待核说法、两次真实隔周的自愿练习与两室实际往返。G扮演+25；梦境引导不是把清醒者拉入梦，日积月累影响不是一键改记忆，实际身体所在也不会因退出而被抹去。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只完成现场与本人意愿核对，尚未入梦或进行比较。'); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, (c.method === 'ABILITY' ? p.ability : p.ordinary) + (p.id === 'repeated-garden' && r.sessions === 1 ? '此前第一周真实记录保留，本周重新约定第二次。' : '')); return; }
  if (c.type === 'VERIFY') {
    r.verified = true; r.outcome = p.outcome; m.practice.wakingChecks += 1;
    ctx.note('清醒后的有限核实', p.verification + '本次另付1行动，尚未领取报告成长；原记录和原场物仍留原处。'); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`dreamwalker-case:${p.id}`, 8);
    ctx.note(p.title, p.verification + '实际退出与返程已完成，本次报告G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit;
    m.practice.dream = p.id === 'repeated-garden' ? 'AMINA' : 'NOEL';
    ctx.note('本人同意的已有梦与实际成本', `${p.id === 'repeated-garden' ? '阿米娜' : '诺尔'}本人依约实际在SOURCE_ROOM自然熟睡，你进入其已有梦境；${p.id === 'paired-dream' ? '阿米娜也实际在TARGET_ROOM熟睡并已同意。' : ''}没有把清醒者拉入梦。${p.spirit}灵性已支出，之后有限引导、调整或梦间移动仍须实际判定。`);
  }
  const result = ctx.check(r.method === 'ABILITY' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.sessions += 1; r.sessionWeeks.push(s.week); r.status = 'EXAMINED';
    r.notes.push(sessionText(p, r.method!, r.sessions));
    if (p.id === 'paired-dream') { m.practice.location = 'TARGET_ROOM'; m.practice.dream = r.method === 'ABILITY' ? 'AMINA' : 'NONE'; m.practice.outboundTrips += 1; }
    ctx.note(p.title, r.notes[r.notes.length - 1]! + (p.id === 'repeated-garden' && r.sessions === 1 ? '这是第一次实际记录，须CLOSE后等下一真实周重新准备第二次。' : '先0行动实际退出或结束接触，必要时走原路返程，再另付1行动清醒核实。')); return;
  }
  r.status = 'OBSERVED';
  if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
  ctx.note(p.title, `本次有限实施未成，1行动${r.method === 'ABILITY' ? `与${p.spirit}灵性` : ''}已花，先前真实记录保留，不增加本次成功次数或成长。${p.id === 'paired-dream' ? r.method === 'ABILITY' ? '未能转入阿米娜的梦，本人仍在SOURCE_ROOM诺尔的梦中，身体没有到另一间静室。' : '本次尚未完成出发前的普通现场比对，没有走到另一间静室；本人仍在SOURCE_ROOM。' : ''}${result.tier === 'GREAT_FAILURE' ? '本次额外精神疲劳至多5。' : ''}须0行动实际结束本次接触，下一真实周重新准备，不可同周重刷。`);
}
export function dreamwalkerActions(s: SliceState): DreamwalkerAction[] {
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 5) return [];
  const out: DreamwalkerAction[] = [];
  const add = (id: string, label: string, cost: string, command: DreamwalkerActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.dreamwalker.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际退出当前梦或结束接触', `0行动 · 身体留在当前${s.dreamwalker.practice.location}`, { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对本人同意、原静室与退出约定', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'repeated-garden' && r.sessions === 1 ? '隔周重新准备第二次有限梦境练习' : '准备本项有限梦境能力', `1行动 · 实施另${p.spirit}灵性${p.id === 'repeated-garden' ? ' · 两次真实不同周' : ''}`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'paired-dream' ? '准备沿原160米路线步行比较' : '准备本人同意的普通谈话', '1行动 · 实施0灵性' + (p.id === 'repeated-garden' ? ' · 同样两次真实不同周' : ''), { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际进入已有梦并尝试有限能力' : '实际完成普通谈话或步行比较', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 意志14 · 失败照耗` : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 原记录与成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED' && r.sessions === p.requiredSessions) {
      if (!r.verified) add(p.id + '-verify', '清醒后核对原记录或本人有限反馈', '1行动 · 实际退出及返程后', { type: 'VERIFY', caseId: p.id });
      add(p.id + '-report', '报告经清醒核实的有限结果', '1行动 · 不据梦定罪或保证治愈', { type: 'REPORT', caseId: p.id });
    }
  }
  if (s.dreamwalker.practice.location === 'TARGET_ROOM') add('dreamwalker-return', '沿原160米普通路实际回SOURCE_ROOM', '0行动 · 0灵性 · 本事项往返步行已付 · 先退出', { type: 'RETURN' });
  if (!s.dreamwalker.reflected) add('dreamwalker-reflect', '回看梦、现实核实与实际身体位置', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.dreamwalker.encounter.status === 'AVAILABLE') {
    add('dreamwalker-encounter-talk', '前往原外院并当面澄清', '1行动 · 清醒者仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('dreamwalker-encounter-fight', '前往原外院并承担冲突', '1行动 · 真实伤亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function dreamwalkerCases(s: SliceState): DreamwalkerProjection['cases'] {
  if (s.progression.pathwayId !== 'audience' || (s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => {
    const r = s.dreamwalker.cases[p.id]!, f = s.dreamwalker.practice;
    const result = r.verified ? p.verification : r.sessions > 0
      ? `已完成${r.sessions}/${p.requiredSessions}次真实记录（第${r.sessionWeeks.join('、')}周）。` + (r.sessions < p.requiredSessions ? '仍须退出后等下一真实周再准备；没有完成两次。' : '尚须实际退出与返程，然后清醒核实。')
      : r.attemptWeek !== null ? '此前有限实施未成，原观察与已付成本保留；实际结束本次接触后，下一真实周重新准备。' : r.withdrawals ? '尚未实施的准备已取消，原观察保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...r.notes], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? `本次尚须实际结束；身体${f.location}，当前梦${f.dream}` : p.id === 'paired-dream' && f.location === 'TARGET_ROOM' ? '已在TARGET_ROOM实际退出，仍须沿原160米普通路返回' : '本次已无待退出接触；身体未因退出而瞬移', closes: r.closes, sessions: r.sessions, sessionWeeks: [...r.sessionWeeks], verified: r.verified };
  });
}
/** Only these original rooms, witnessed sessions and fixed reality checks can support growth. */
export function validateDreamwalkerLife(s: SliceState): boolean {
  const m = s.dreamwalker;
  if (!record(m) || !record(m.cases) || !shape(m.cases, DREAMWALKER_CASE_IDS) || !record(m.practice) || !shape(m.practice, ['location', 'dream', 'outboundTrips', 'returns', 'wakingChecks']) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice;
  if (!['SOURCE_ROOM', 'TARGET_ROOM'].includes(f.location) || !['NONE', 'NOEL', 'AMINA'].includes(f.dream) || !integer(f.outboundTrips, 0, 1) || !integer(f.returns, 0, 1) || !integer(f.wakingChecks, 0, 3)) return false;
  if (f.outboundTrips !== f.returns + (f.location === 'TARGET_ROOM' ? 1 : 0)) return false;
  const promoted = s.progression.pathwayId === 'audience' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  let open = 0, prepared = 0, resolved = 0, verified = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'sessions', 'sessionWeeks', 'verified'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean' || typeof r.verified !== 'boolean' || !integer(r.sessions, 0, p.requiredSessions) || !Array.isArray(r.sessionWeeks) || !Array.isArray(r.notes)) return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (r.sessionWeeks.length !== r.sessions || r.notes.length !== r.sessions) return false;
    for (let i = 0; i < r.sessions; i++) {
      const week = r.sessionWeeks[i];
      if (!integer(week, m.promotionWeek ?? s.week, r.attemptWeek ?? s.week) || i > 0 && week! <= r.sessionWeeks[i - 1]!) return false;
      if (r.notes[i] !== sessionText(p, 'ABILITY', i + 1) && r.notes[i] !== sessionText(p, 'ORDINARY', i + 1)) return false;
    }
    if (s.seer.completedSources.filter(x => x === `dreamwalker-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (!r.verified || r.contactOpen) return false; }
    if (r.verified) { verified += 1; if (!['EXAMINED', 'RESOLVED'].includes(r.status as string) || r.sessions !== p.requiredSessions || r.contactOpen || r.outcome !== p.outcome || r.closes < r.sessions) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) {
      if (r.sessions === 0 || r.method === null || r.attemptWeek !== r.sessionWeeks[r.sessions - 1] || r.notes[r.sessions - 1] !== sessionText(p, r.method, r.sessions)) return false;
      if (r.sessions < p.requiredSessions && (p.id !== 'repeated-garden' || !r.contactOpen)) return false;
    } else if (r.sessions >= p.requiredSessions) return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.sessions !== 0)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.sessions !== 0)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && (!r.contactOpen && r.closes < 1 || r.closes > r.attemptWeek - (m.promotionWeek ?? r.attemptWeek) + 1)) return false;
    if (r.closes < r.sessions - (r.contactOpen ? 1 : 0)) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || r.verified || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.activeVisitId !== null) return false;
      const expectedDream = r.method === 'ORDINARY' ? 'NONE' : p.id === 'repeated-garden' || p.id === 'paired-dream' && r.sessions === 1 ? 'AMINA' : 'NOEL';
      if (f.dream !== expectedDream || f.location !== (p.id === 'paired-dream' && r.sessions === 1 ? 'TARGET_ROOM' : 'SOURCE_ROOM')) return false;
    }
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.sessions !== 0 || r.contactOpen || r.verified)) return false;
    if (p.id === 'paired-dream') {
      if (f.outboundTrips !== r.sessions || r.verified && f.returns !== 1 || r.contactOpen && r.sessions === 1 && f.returns !== 0) return false;
      if (f.location === 'TARGET_ROOM' && (r.status !== 'EXAMINED' || r.attemptWeek !== s.week || r.verified || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.activeVisitId !== null)) return false;
    }
  }
  if (open > 1 || prepared > 1 || open && prepared || open === 0 && f.dream !== 'NONE' || f.location === 'TARGET_ROOM' && prepared !== 0 || f.wakingChecks !== verified) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'dreamwalker-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.outboundTrips !== 0 || f.dream !== 'NONE' || f.location !== 'SOURCE_ROOM')) return false;
  if (s.progression.pathwayId==='audience'&&s.progression.sequence===5 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if(s.progression.pathwayId==='audience'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && (s.manipulator.dreamwalkerActingAtPromotion!==100||resolved!==3||!m.reflected))return false;
  return true;
}
