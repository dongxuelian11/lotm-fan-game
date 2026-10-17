import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { formatGameDate } from '../game-calendar.js';
import { applyCrimsonScholarEncounter, blockCrimsonScholarEncounter, CRIMSON_SCHOLAR_ENCOUNTER_STORY } from './encounter.js';
import { CRIMSON_SCHOLAR_CASE_IDS, type CrimsonScholarCaseId, type CrimsonScholarCommand, type CrimsonScholarActivityCommand, type CrimsonScholarAction, type CrimsonScholarProjection } from './types.js';

const CASES = [
  {
    id: 'full-moon', title: '原小院里的有限满月',
    story: '原导师艾琳约你在原私人训练小院的真实夜间，核对原先划定的5米练习区。成年伊莲本人愿意观察，她与艾琳始终留在区域外，区域内只有你。先对照原月相图与已有自然月光，再选择在这一个原区建立有限满月，或只做普通对照。（原创G）',
    facts: ['原5米区域、原月相图与固定地面均已在场；旁观的成年伊莲本人自愿，所有其他身体都在区外。', '本事项付费实施包含当前周实际夜间的有限练习窗口，不重写世界日历、自然月相或全城天空。', '能力方案建立区域满月后须明确CLOSE；普通对照只核对已有月光与原图，不生成满月，也不获得月光化。'],
    ability: '准备花1行动、3灵性，在原5米区域建立本次满月并核对有限现象；知识14为G检查，失败照耗，月场仍须明确停止。',
    ordinary: '准备以原月相图对照眼前已有自然月光；1行动、0灵性、知识10，不制造满月，不产生任何非凡月场。',
    abilityResult: '已核对原5米区域内本次人为满月的有限现象；只证实这个原区，不改全城天空或自然月相。',
    ordinaryResult: '已将眼前已有自然月光与原月相图作普通对照；没有建立满月、月光化或任何非凡月场。',
    outcome: 'FULL_MOON_CHECKED', spirit: 3,
  },
  {
    id: 'hidden-moon', title: '同一原小院的隐月与遮光对照',
    story: '完成第一项报告后，你与艾琳再在同一原5米区做一次真实夜间比较。愿意观察的成年伊莲仍在区外。能力方法只隐去本区月光；普通方法实际使用原主人艾琳留在原位的普通遮光板作明暗对照，结束后板仍归原主人并留在原处。（原创G）',
    facts: ['沿用第一项的原5米区，不扩大到整座城市，不改变远处旁人的环境。', '普通遮光板本来就在原小院、属于艾琳；普通对照不等于非凡隐月，不取走、复制或赠送原板。', '有限月场可能影响符合条件的其他对象；本场其他身体都在区外，不能据此推断任意敌人会受控或免疫。'],
    ability: '准备花1行动、3灵性，只在同一原5米区形成有限隐月；知识14为G检查，失败同样付费并须停止月场。',
    ordinary: '准备实际用原位普通遮光板作同一原区明暗对照；1行动、0灵性、知识10，不施放隐月，原板仍归艾琳。',
    abilityResult: '已核对同一原5米区域的有限隐月现象；没有改变全城月光、自然月相或旁人的思想。',
    ordinaryResult: '已实际用原普通遮光板作明暗对照；没有施放隐月或形成非凡月场，原板仍在原处并归艾琳。',
    outcome: 'HIDDEN_MOON_CHECKED', spirit: 3,
  },
  {
    id: 'moonlight-route', title: '原月照通路上的真实去程与返程',
    story: '先报告前两项结果，再到同一私人小院另一个原先划定的10米通路区。这是第三项自己的原区，不把前两项5米区暗中放大。艾琳已核实净空、平直且没有障碍的原通路，两处原地面标记相距6米；她与成年自愿观察者伊莲都在10米区外。能力方法先建立本区满月，再让你自己的身体月光化，实际尝试从START闪现到END。普通方法沿同一原6米路径实际步行。（原创G）',
    facts: ['第三项原10米月照通路区与前两项原5米练习区明确分开，两原标记相距6米且都位于这段月照区内。', '只允许自己的身体沿本次既有净空通路到原END；没有任意坐标、穿墙、乘客或跨区域传送。', '关闭月场不会搬回身体；到END后须先CLOSE，再沿同一原6米普通通路RETURN。实施行动已计入本事项往返所需时间，0行动返程不等于免费移动到任意地点。', '此处能退出只因原路径已核实；不保证逃离任意陷阱，不获得无敌、蝙蝠化、月纸替身或死亡复活。'],
    ability: '准备花1行动、6灵性：3灵性建立原10米通路区满月，另3灵性实际尝试月光化闪现6米，知识14为G检查。成功身体在END，失败留START，月场两者均须停止。',
    ordinary: '准备花1行动沿同一原6米净空路径实际步行到END作普通比较；0灵性、知识10，不制造月场或施放闪现。结果不充分也已走到END，须先结束接触再实际走回。',
    abilityResult: '本人身体已在原10米月照区内，从原START实际月光化闪现6米到原END；不携带他人、不穿墙，关闭月场不会自动把身体搬回START。',
    ordinaryResult: '本人已沿原6米净空通路普通步行到END；没有月光化、闪现或非凡月场，结束接触不会自动把身体搬回START。',
    outcome: 'ROUTE_CHECKED', spirit: 6,
  },
] as const;
type Case = typeof CASES[number];

export const CRIMSON_SCHOLAR_ENVIRONMENT = '原私人训练小院由原导师艾琳主持，成年伊莲本人自愿观察；除玩家以外的身体始终在当前原区外。前两项使用同一原5米区，第三项使用另一个原10米月照通路区，两原标记相距6米且全程净空。尺寸、夜间窗口、行动、灵性、难度、恢复量均为原创G，不冒充原著精确范围或成本。实施1行动已含当前游戏日期真实夜间的有限练习和同项普通返程，不重写全局昼夜、自然月相或日历。OBSERVE、PREPARE、PERFORM、REPORT各1行动；CLOSE停止月场和接触但身体留当前位置；END处须再RETURN沿原6米路走回，CLOSE、RETURN、WITHDRAW各0行动。能力三项实耗3、3、6灵性、知识14；普通对照0灵性、知识10且不施法。失败成本保留，关闭并实际返回后，下一真实周才可重试。当前FULL场内可选REASSEMBLE，每真实周至多一次尝试，1行动8灵性、知识14，失败照耗；只给仍活着且健康1至99的自己成功恢复至多10健康，身体不移动，不清伤势、不恢复精神或灵性、不生物品、不复活，不要求自伤，也不需要它达到100扮演。三项报告各G扮演25及既有池单项掌握8，最终反思25。所有退出仅依据这些固定净空场景，不保证突破任意封锁；不下放序列4月纸替身、蝙蝠化或无敌。旧血食、药剂原瓶、材料和原物所有权原样保留。 ' + CRIMSON_SCHOLAR_ENCOUNTER_STORY;

export const crimsonScholarInside = (s: SliceState): boolean => s.crimsonScholar.ritual.activeVisitId !== null || s.crimsonScholar.practice.field !== 'NONE' || s.crimsonScholar.practice.location === 'END' || Object.values(s.crimsonScholar.cases).some(r => r.contactOpen);
export const isCrimsonScholarActivity = (c: CrimsonScholarCommand): c is CrimsonScholarActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'RETURN', 'REASSEMBLE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is CrimsonScholarActivityCommand {
  if (!record(c)) return false;
  if (['RETURN', 'REASSEMBLE', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!CRIMSON_SCHOLAR_CASE_IDS.includes(c.caseId as CrimsonScholarCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: CrimsonScholarActivityCommand): string | null {
  const m = s.crimsonScholar, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (m.ritual.activeVisitId !== null) return '先0行动实际结束原晋升仪式并退出，不能把晋升现场当生活练习。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 5) return '先完成深红学者晋升。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次原小院事项。';
  if (c.type === 'RETURN') {
    if (Object.values(m.cases).some(value => value.contactOpen) || f.field !== 'NONE') return '先CLOSE实际停止月场与本次接触，不能把返程当作自动关闭。';
    if (f.location !== 'END') return '身体不在原END，没有尚待完成的原6米返程。';
    return s.activeEvent || s.combat ? '先处理当前事件或战斗。' : null;
  }
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德的原私人训练小院。';
  if (c.type === 'REASSEMBLE') {
    if (f.field !== 'FULL' || !Object.values(m.cases).some(value => value.contactOpen && value.method === 'ABILITY')) return '只在本次仍开放的原FULL月场内尝试恢复自己的现有伤损。';
    if (s.health <= 0 || s.health >= 100) return '只给仍活着且健康1至99的自己有限恢复；不要求自伤，不复活。';
    if (s.mind <= 0) return '精神已经耗尽，先安全结束现场。';
    if (f.reassembledWeek === s.week) return '本真实周已经尝试过月光重组，失败也不能再试。';
    if (s.actionsRemaining < 1) return '本次月光重组需要1行动。';
    return s.spirituality < 8 ? '本次月光重组需要8灵性，失败照耗。' : null;
  }
  if (crimsonScholarInside(s)) return '先0行动CLOSE停止月场与接触；身体若在END，还须沿原6米普通路RETURN。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockCrimsonScholarEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项真实比较报告并实际返回原起点。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.caseId === 'hidden-moon' && m.cases['full-moon']!.status !== 'RESOLVED') return '先完成原5米区满月或普通月光比较报告。';
  if (c.caseId === 'moonlight-route' && (m.cases['full-moon']!.status !== 'RESOLVED' || m.cases['hidden-moon']!.status !== 'RESOLVED')) return '先报告前两项原5米区真实比较，再进入另一个原10米通路区。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原场地、本人意愿与路径已经核对。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本人意愿。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周才能准备重试。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果、实际结束现场并返回原起点。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本真实周已尝试，不能重复实施。';
  const p = CASES.find(p => p.id === c.caseId)!;
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次能力实施需要${p.spirit}灵性；可0行动取消准备后休养或改选普通方法。` : null;
}
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.crimsonScholar.practice;
  return `当前月场${f.field}，本人身体在${f.location}；实际去程${f.outboundTrips}次，原路返程${f.returns}次；月光重组尝试${f.reassemblies}次${f.reassembledWeek === null ? '' : `，最近第${f.reassembledWeek}周`}。`;
};

export function applyCrimsonScholarActivity(s: SliceState, c: CrimsonScholarActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('深红学者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyCrimsonScholarEncounter(s, c, ctx); return; }
  const m = s.crimsonScholar, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1; f.field = 'NONE';
    ctx.note('实际停止月场与接触，身体不搬回', '0行动完成本事项已付有限夜间窗口的收束，停止本次月场或普通比较；身体仍在' + f.location + (f.location === 'END' ? '，还须沿同一原6米普通通路RETURN。' : '原起点，实际结束本次现场。') + '原遮光板始终归艾琳并留在原处；不退款、不续效、不治疗，不返还血食、药剂或材料。' + practiceText(s)); return;
  }
  if (c.type === 'RETURN') {
    f.location = 'START'; f.returns += 1;
    ctx.note('沿原6米普通路实际返回START', '0行动、0灵性完成本事项实施预算中已经计入的普通返程：你从原END沿同一条已核实净空的原6米路径实际走回START，不使用月光化，不带人、不穿墙。月场已关闭，不保证其它未知路径可逃离。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察、原物、已付行动和此前真实尝试保留；不施法、不走动、不退款。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REASSEMBLE') {
    s.spirituality -= 8; f.reassemblies += 1; f.reassembledWeek = s.week;
    const result = ctx.check('knowledge', 14);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      const recovered = Math.min(10, 100 - s.health); s.health += recovered;
      ctx.note('月光重组只恢复现有自身伤损', `本次1行动、8灵性已支付；在当前原FULL月场中，仍活着的自身身体成功有限重组，健康实际+${recovered}。身体仍在${f.location}，伤势条目、精神、其余灵性、污染及物品原样保留；不复活、不强迫自伤，本周不能再试。`);
    } else ctx.note('月光重组未能恢复，成本照耗', `1行动、8灵性照耗；本周一次尝试已用掉，健康没有恢复。本人仍在${f.location}，月场仍须CLOSE；不删除伤势、不恢复精神或灵性、不生成物品。`);
    return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('crimson-scholar-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('知道月场的范围，也实际走完回路', '回看原5米区的两种真实比较、另一个原10米通路区的实际去程与原路返程。G扮演+25；普通对照不冒充能力，退出不自动搬回身体，有限自身恢复不是复活或无敌，也无需伤害自己完成反思。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次仅核对原现场，尚未实施。' + practiceText(s)); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`crimson-scholar-case:${p.id}`, 8);
    ctx.note(p.title, resultText(p, r.method!) + '本次月场与接触现已结束，本人已在START；G扮演+25、既有池单项掌握+8，没有物品、血食或灵性奖励。' + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  ctx.note('按约实际进行有限夜间练习', `第${s.week}周，${formatGameDate(s.date)}夜间，艾琳与自愿的成年伊莲在当前原区外观察。实施的1行动已包含本次实际夜间窗口与原6米通路所需普通返程；只调度这个原创G场景，不改全局昼夜或自然月相。`);
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit; f.field = p.id === 'hidden-moon' ? 'HIDDEN' : 'FULL';
    ctx.note(p.id === 'hidden-moon' ? '只在原5米区隐月' : p.id === 'moonlight-route' ? '原10米通路区满月，实际尝试6米闪现' : '只在原5米区建立满月', p.id === 'moonlight-route' ? '实耗6灵性，其中3用于原10米通路区满月，3用于自己身体的月光化闪现尝试；两个原标记相距6米且都在原月照区内，失败身体仍在START，月场仍需关闭。' : `实耗3灵性，只改变同一原5米区的本次有限月场；没有其它身体在区内，不改变自然月相或全城天空。`);
  } else {
    f.field = 'NONE';
    if (p.id === 'moonlight-route') { f.location = 'END'; f.outboundTrips += 1; }
    ctx.note('实际普通对照，不施放能力', p.id === 'moonlight-route' ? '你已经沿同一原6米净空通路普通步行到END；比较是否充分另行核实，失败也不会抹去这次实际位移。没有非凡月场，仍须CLOSE后RETURN。' : p.id === 'hidden-moon' ? '实际使用原主人艾琳的原位普通遮光板作明暗比较；板始终留在原处并归她。没有非凡隐月或月场。' : '对照原月相图与眼前已有自然月光；没有制造满月、月光化或非凡月场。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    if (p.id === 'moonlight-route' && r.method === 'ABILITY') { f.location = 'END'; f.outboundTrips += 1; }
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, resultText(p, r.method!) + '先0行动CLOSE；身体若在END，再0行动沿原通路RETURN。' + practiceText(s));
  } else {
    r.status = 'OBSERVED'; r.outcome = 'NONE';
    ctx.note(p.title, '本次真实尝试未形成足够可报告的结果，1行动与所选灵性照耗。' + (p.id === 'moonlight-route' ? r.method === 'ABILITY' ? '实际闪现未成功，身体仍在START，FULL场仍须关闭。' : '普通去程已真实完成，身体仍在END，须先CLOSE再沿原路RETURN。' : r.method === 'ABILITY' ? '本次区域月场仍在，须明确关闭。' : '只发生普通对照，没有非凡月场，仍须结束接触。') + '实际结束并返回后，下一真实周才能准备重试。' + practiceText(s));
  }
}

export function crimsonScholarActions(s: SliceState): CrimsonScholarAction[] {
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 5) return [];
  const out: CrimsonScholarAction[] = [];
  const add = (id: string, label: string, cost: string, command: CrimsonScholarActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.crimsonScholar.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际停止月场与本次接触', '0行动 · 身体留当前位置 · 不退款、不治疗', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原区域、本人意愿与原路径', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', '准备本次有限月场能力', `1行动 · 实施另耗${p.spirit}灵性 · 知识14为G`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'moonlight-route' ? '准备普通步行同一原6米通路' : '准备已有月光或原遮光板普通对照', '1行动 · 不施法 · 实施0灵性、知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', p.id === 'moonlight-route' ? '实际完成本次原6米去程尝试' : '实际进行原5米区有限比较', `1行动 · ${r.method === 'ABILITY' ? p.spirit : 0}灵性 · 失败照耗 · 本事项含有限夜间窗口`, { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 已付成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告这一次真实有限结果', '1行动 · 先停止月场与接触并实际返回START', { type: 'REPORT', caseId: p.id });
  }
  if (s.crimsonScholar.practice.location === 'END') add('crimson-scholar-return', '沿原6米普通通路实际返回START', '0行动 · 0灵性 · 本事项往返已付 · 必须先CLOSE', { type: 'RETURN' });
  add('crimson-scholar-reassemble', '可选：FULL月场内有限恢复自身现有伤损', '1行动 · 8灵性 · 每周一次尝试 · 成功至多+10健康 · 不移动、不复活', { type: 'REASSEMBLE' });
  if (!s.crimsonScholar.reflected) add('crimson-scholar-reflect', '回看区域月场与真实往返边界', '1行动 · 三报告后 · 无需自伤或重组', { type: 'REFLECT' });
  if (s.crimsonScholar.encounter.status === 'AVAILABLE') {
    add('crimson-scholar-encounter-talk', '前往原小院外并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('crimson-scholar-encounter-fight', '前往原小院外并承担冲突', '1行动 · 真实伤势与死亡风险 · 不能保证逃离', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function crimsonScholarCases(s: SliceState): CrimsonScholarProjection['cases'] {
  if (s.progression.pathwayId !== 'moon' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return [];
  return CASES.map(p => {
    const r = s.crimsonScholar.cases[p.id]!;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(p, r.method!) + practiceText(s) : r.attemptWeek !== null ? '此前实际尝试未形成可报告结果，成本与实际位移保留；须结束接触、停止月场并返回，下一真实周再试。' + practiceText(s) : r.withdrawals ? '尚未实施的准备已取消，已付成本与原观察保留。' : null, status: r.status, contactOpen: r.contactOpen ? '本次原场地仍须CLOSE停止月场与接触；身体不自动返回' : s.crimsonScholar.practice.location === 'END' ? '月场与接触已结束；本人仍在END，须沿原6米路RETURN' : '本次接触已结束，本人在START且没有未关闭月场', closes: r.closes };
  });
}

/** Validate actual field, body location and return chronology without manufacturing travel history. */
export function validateCrimsonScholarLife(s: SliceState): boolean {
  const m = s.crimsonScholar;
  if (!record(m) || !record(m.cases) || !shape(m.cases, CRIMSON_SCHOLAR_CASE_IDS) || !record(m.ritual) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promoted = m.promotionWeek !== null, promotion = m.promotionWeek ?? s.week;
  if (!record(f) || !shape(f, ['field', 'location', 'outboundTrips', 'returns', 'reassemblies', 'reassembledWeek'])) return false;
  if (!['NONE', 'FULL', 'HIDDEN'].includes(f.field) || !['START', 'END'].includes(f.location) || !integer(f.outboundTrips, 0) || !integer(f.returns, 0, f.outboundTrips) || !integer(f.reassemblies, 0, Math.max(0, s.week - promotion + 1))) return false;
  if ((f.reassemblies === 0) !== (f.reassembledWeek === null) || f.reassembledWeek !== null && (!integer(f.reassembledWeek, promotion, s.week) || f.reassemblies > f.reassembledWeek - promotion + 1)) return false;
  let open = 0, prepared = 0, resolved = 0;
  let expectedField: 'NONE' | 'FULL' | 'HIDDEN' = 'NONE';
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `crimson-scholar-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes + (r.contactOpen ? 1 : 0) > r.attemptWeek - promotion + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.activeVisitId !== null) return false;
      if (r.method === 'ABILITY') expectedField = p.id === 'hidden-moon' ? 'HIDDEN' : 'FULL';
    }
    if ((!promoted || m.ritual.activeVisitId !== null) && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared || f.field !== expectedField) return false;
  const full = m.cases['full-moon']!, hidden = m.cases['hidden-moon']!, route = m.cases['moonlight-route']!;
  if (hidden.status !== 'AVAILABLE' && full.status !== 'RESOLVED' || route.status !== 'AVAILABLE' && (full.status !== 'RESOLVED' || hidden.status !== 'RESOLVED')) return false;
  if (hidden.attemptWeek !== null && (full.attemptWeek === null || hidden.attemptWeek < full.attemptWeek) || route.attemptWeek !== null && (hidden.attemptWeek === null || route.attemptWeek < hidden.attemptWeek)) return false;
  const routeAttempts = route.closes + (route.contactOpen ? 1 : 0);
  if (f.outboundTrips > routeAttempts || f.returns !== f.outboundTrips - (f.location === 'END' ? 1 : 0)) return false;
  if (['EXAMINED', 'RESOLVED'].includes(route.status) && f.outboundTrips < 1) return false;
  if (route.contactOpen && (route.method === 'ORDINARY' || route.status === 'EXAMINED') && f.location !== 'END') return false;
  if (route.contactOpen && route.method === 'ABILITY' && route.status === 'OBSERVED' && f.location !== 'START') return false;
  if (f.location === 'END') {
    if (!['OBSERVED', 'EXAMINED'].includes(route.status) || route.attemptWeek !== s.week || route.method === null || route.method === 'ABILITY' && route.status !== 'EXAMINED' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.activeVisitId !== null || prepared !== 0) return false;
    if (open !== (route.contactOpen ? 1 : 0)) return false;
  }
  const possibleFullAttempts = [full, route].reduce((total, r) => total + r.closes + (r.contactOpen ? 1 : 0) - (r.method === 'ORDINARY' && r.status !== 'PREPARED' ? 1 : 0), 0);
  if (f.reassemblies > possibleFullAttempts || f.reassembledWeek !== null && f.reassembledWeek > Math.max(full.attemptWeek ?? 0, route.attemptWeek ?? 0)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'crimson-scholar-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.field !== 'NONE' || f.location !== 'START' || f.outboundTrips !== 0 || f.returns !== 0 || f.reassemblies !== 0 || f.reassembledWeek !== null)) return false;
  if (s.progression.pathwayId === 'moon' && s.progression.sequence === 5 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if(s.progression.pathwayId==='moon'&&[4,3,2].includes(s.progression.sequence??0)&&(s.witchKing.crimsonScholarActingAtPromotion!==100||resolved!==3||!m.reflected))return false;
  return true;
}
