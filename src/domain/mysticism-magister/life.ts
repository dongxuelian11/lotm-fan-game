import { hasWisdomAngelLifeLock } from '../wisdom-angel/life.js';
import { hasWisdomAngelEncounterLock } from '../wisdom-angel/encounter.js';
import { hasInsightScholarLifeLock } from '../insight-scholar/life.js';
import { hasInsightScholarEncounterLock } from '../insight-scholar/encounter.js';
import { hasProphetLifeLock } from '../prophet/life.js';
import { hasProphetEncounterLock } from '../prophet/encounter.js';
import { hasProphetRitualLock } from '../prophet/ritual.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyMysticismMagisterEncounter, blockMysticismMagisterEncounter, MYSTICISM_MAGISTER_ENCOUNTER_STORY } from './encounter.js';
import { MYSTICISM_MAGISTER_CASE_IDS, type MysticismMagisterCaseId, type MysticismMagisterCommand, type MysticismMagisterActivityCommand, type MysticismMagisterAction, type MysticismMagisterProjection } from './types.js';

const CASES = [
  {
    id: 'linked-dream', title: '原衣角连起的有限梦话',
    story: '原博学者教学中的成年诺亚，自愿参与塞缪尔原书房的一次有限实践。他借出自己一直持有的普通衣角MM5-CLOTH-1，所有权始终归诺亚；原休息室沿公共步道距书房40米。准备时你亲自借取并走回，实施时再当面确认本次同意与当周休息安排。仪式开始后你的原身体始终留在书房，不随梦境移动；只核对诺亚自己原阅读表上的一句普通信息。（原创G）',
    facts: ['MM5-CLOTH-1是诺亚本人真实持有的普通衣角，不是魔法奖励，也不是复制品。', '普通步行路线长40米；付费实施时才落实本次同意与实际入睡，不沿用上一周的睡眠。', '听见一句话只是待核实陈述；须明确结束，再本人步行找醒来的诺亚复核，最后归还同一原物。'],
    ability: '准备亲自沿原40米步道借取同一衣角并返回书房。实施另耗4灵性、知识14，以真实原物为联系进行有限仪式；需本次再次同意和入睡，原身体不移动。',
    ordinary: '准备亲自借取同一衣角并返回，采用醒时普通证言对照；实施知识10、0灵性，不入梦，得到的陈述同样需要独立醒时复核。',
    spirit: 4, difficulty: 14, outcome: 'DREAM_VERIFIED',
  },
  {
    id: 'modest-craft', title: '真实材料只制出一次微光',
    story: '衣角经历报告后，塞缪尔在原书房提供逐包封存、实际交付的原创G低阶非凡残材套包，含本次用尽的残材与惰性纸基，每包160便士。你只能依据旧FLASH样本的真实学会记录尝试做出一枚弱化、一次性微光片。书房三米外的原私人试验凹间已清空，无敌人、旁观者或可受损财物；必须实际消耗本次成功原片试闪，才能报告。（原创G）',
    facts: ['每次能力实施都实际买入并用尽一包MM5-KIT-N，失败仍耗160便士、4灵性与1行动。', '成功原片MM5-FLASH-N与耗掉的MM5-KIT-N一一对应，强度按制作时掌握固定，只有一次短暂低强闪光。', '普通替代实际购买并用完60便士纸样包，只核对惰性纸样和安全间距；不制造魔法物品。'],
    ability: '依已经实际学会的旧FLASH知识准备材料仿制；实施1行动、160便士、4灵性、知识16。成功原片须先结束现场，再实际消耗试用，不能把库存展示当试验。',
    ordinary: '准备购买并用完一套60便士普通纸样包，核对惰性纸样、来源和安全间距；实施知识10、0灵性，没有非凡材料或可带走的微光片。',
    spirit: 4, difficulty: 16, outcome: 'CRAFT_TESTED',
  },
  {
    id: 'careful-teaching', title: '让本人复述核验清单',
    story: '实际制作或纸样报告后，原成年塔莉娅自愿到同一书房听取有限教学。她只学习如何问清来源、检查材料、确认出口与停止条件，再本人独立复述普通清单。能力方法由你在已清空的原试验凹间演示自己以前确实学会的弱闪光，普通方法则使用留在原桌的惰性图示；都不把技能、位阶、魔药或服从复制给她。（原创G）',
    facts: ['塔莉娅是原自愿成年参与者；实施时确认她本次愿意听取，允许拒绝与停止。', '演示只使用你真实学会的旧FLASH样本，不创造老师或学生的新技能。', '成功只证明她这一次独立完成普通来源、材料、出口与停止条件核验，不能保证以后服从。'],
    ability: '准备在清空的原三米试验凹间展示自己已学会的弱闪光；实施3灵性、知识14，之后由塔莉娅独立复述普通核验清单。',
    ordinary: '准备以原桌惰性图示讲解普通核验清单；实施知识10、0灵性，让塔莉娅本人独立复述，不传授非凡能力。',
    spirit: 3, difficulty: 14, outcome: 'LESSON_CHECKED',
  },
] as const;
type Case = typeof CASES[number];

export const MYSTICISM_MAGISTER_ENVIRONMENT = '三项明确原创G实践：借诺亚原衣角MM5-CLOTH-1进行有限仪式、结束后步行40米醒时核验并实际归还；用真实知识与逐包160便士非凡残材制造一次弱微光，先关闭现场再实际耗片试验；让成年塔莉娅本人复述普通核验清单。OBSERVE、PREPARE、PERFORM、REPORT各1行动，VERIFY_DREAM另1行动；CLOSE、RETURN_TOKEN、TEST_TOKEN、WITHDRAW为0行动，失败成本保留，下一真实周才可重试。仪式4灵性/知识14、制造4灵性/知识16、演示3灵性/知识14；普通方法知识10、0灵性，纸样案实耗60便士。报告各G扮演25；只有实际能力报告按已有知识池给予单项掌握8，普通报告只留来源。三案反思另25。案例二报告后可每真实周另1行动、160便士、4灵性尝试一枚有限战备原片；不需要制作才能和平100。原身体不入梦传送，不等于梦魇；个别原著千海里案例不是本阶段默认射程。材料仿制可失败，没有免费技能库、永久装备或预言。 ' + MYSTICISM_MAGISTER_ENCOUNTER_STORY;
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 5;
export const mysticismMagisterInside = (s: SliceState) => s.mysticismMagister.practice.dreamOpen || Object.values(s.mysticismMagister.cases).some(r => r.contactOpen);
export const isMysticismMagisterActivity = (c: MysticismMagisterCommand): c is MysticismMagisterActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'RETURN_TOKEN', 'VERIFY_DREAM', 'MAKE_TOKEN', 'TEST_TOKEN', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const learnedFlash = (s: SliceState) => s.polymath.samples.FLASH.learnedWeek !== null;
function validActivity(c: unknown): c is MysticismMagisterActivityCommand {
  if (!record(c)) return false;
  if (['RETURN_TOKEN', 'VERIFY_DREAM', 'MAKE_TOKEN', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (c.type === 'TEST_TOKEN') return shape(c, ['type', 'itemId']) && typeof c.itemId === 'string' && /^MM5-FLASH-[1-9]\d*$/.test(c.itemId);
  if (!MYSTICISM_MAGISTER_CASE_IDS.includes(c.caseId as MysticismMagisterCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
/** Before case two's report, its successful creation is necessarily the first and only real craft. */
const caseCraft = (s: SliceState) => {
  const r = s.mysticismMagister.cases['modest-craft']!, item = s.mysticismMagister.crafts[0];
  return r.method === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(r.status) && item?.createdWeek === r.attemptWeek ? item : null;
};
function craftBlock(s: SliceState): string | null {
  if (!learnedFlash(s)) return '必须保有旧FLASH样本真实学会记录；只见过或分析过不能制造。';
  if (s.cash < 160) return '这包真实非凡残材需要160便士。';
  return s.spirituality < 4 ? '本次实际制造需要4灵性，失败也会消耗。' : null;
}
function blocked(s: SliceState, c: MysticismMagisterActivityCommand, inheritedCraft = false): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!promoted(s) && !(inheritedCraft && c.type === 'MAKE_TOKEN' && s.progression.pathwayId === 'white-tower' && (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))) return '先完成秘术导师晋升。';
  if (inheritedCraft && [3, 2].includes(s.progression.sequence ?? 0) && (s.wisdomAngel.preparedWeek !== null || hasWisdomAngelLifeLock(s) || hasWisdomAngelEncounterLock(s))) return '先实际收束智慧天使候选准备、原物现场或遭遇，再到原工作台付费制作。';
  if (inheritedCraft && s.progression.sequence === 2 && (s.insightScholar.preparedWeek !== null || hasInsightScholarLifeLock(s) || hasInsightScholarEncounterLock(s) || hasProphetRitualLock(s) || hasProphetLifeLock(s) || hasProphetEncounterLock(s) || Object.values(s.prophet.life.cases).some(r => r.status === 'PREPARED') || s.prophet.life.pages.location !== 'TABLE' || Object.values(s.polymath.cases).some(r => r.contactOpen || r.status === 'PREPARED') || s.mysticismMagister.practice.token !== 'OWNER')) return '先实际收束智慧天使候选准备、原物现场或遭遇，并归还全部旧借物，再到原工作台付费制作。';
  const m = s.mysticismMagister, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次原现场。';
  if (mysticismMagisterInside(s)) return '先0行动明确结束本次接触与仪式；归还衣角不会代替关闭梦境。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原书房、原40米公共步道与原试验凹间。';
  if (c.type === 'RETURN_TOKEN') return f.token === 'PLAYER' ? null : '同一原衣角已经在诺亚本人手中。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockMysticismMagisterEncounter(s, c);
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (c.type === 'TEST_TOKEN') {
    const item = m.crafts.find(item => item.id === c.itemId);
    if (!item || item.status !== 'PLAYER') return '没有这枚仍在手中、尚未使用的真实原片。';
    const craftCase = m.cases['modest-craft']!;
    if (craftCase.status !== 'RESOLVED' && caseCraft(s)?.id !== item.id) return '本案必须实际试用这次成功制造的那一枚原片，不能用别的物品冒充。';
    return null;
  }
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'VERIFY_DREAM') return m.cases['linked-dream']!.status === 'EXAMINED' && f.dreamResult === 'CLAIM' ? null : '先取得本次有限陈述并明确结束接触，才可另行醒时核验。';
  if (c.type === 'MAKE_TOKEN') {
    if (m.cases['modest-craft']!.status !== 'RESOLVED') return '先完成本案真实制作并试用报告，或普通纸样报告，再选择额外战备制作。';
    if (m.craftAttemptWeek === s.week) return '本周额外制作已经实际尝试，下一真实周再买新包重试。';
    return craftBlock(s);
  }
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限实际报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  const p = CASES.find(p => p.id === c.caseId)!;
  if (p.id === 'modest-craft' && m.cases['linked-dream']!.status !== 'RESOLVED') return '先结束、醒时核验、归还同一衣角并完成首案报告。';
  if (p.id === 'careful-teaching' && m.cases['modest-craft']!.status !== 'RESOLVED') return '先完成真实原片试用报告，或普通纸样报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '本次原来源与有限安排已经核对。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对本次原来源与有限安排。';
    if (r.attemptWeek === s.week) return '本周实际尝试与成本保留，下一真实周再准备。';
    return c.method === 'ABILITY' && p.id !== 'linked-dream' && !learnedFlash(s) ? '能力方法需要旧FLASH实际学会记录；普通核对不需要。' : null;
  }
  if (c.type === 'REPORT') {
    if (r.status !== 'EXAMINED' || r.outcome !== p.outcome) return '先完成本案实际醒时核验、原片试用或独立教学核验。';
    return p.id === 'linked-dream' && f.token !== 'OWNER' ? '先0行动沿原步道把同一衣角亲手归还诺亚，再回来报告。' : null;
  }
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才能重试。';
  if (p.id === 'linked-dream' && f.token !== 'PLAYER') return '原衣角已经归还；请取消准备后实际重借同一原物，不能无联系施术。';
  if (r.method === 'ORDINARY') return p.id === 'modest-craft' && s.cash < 60 ? '实际普通纸样包需要60便士。' : null;
  if (p.id === 'modest-craft') return craftBlock(s);
  if (p.id === 'careful-teaching' && !learnedFlash(s)) return '必须已经真实学会旧FLASH样本，不能无来源演示。';
  return s.spirituality < p.spirit ? `本次实施需要${p.spirit}灵性，可取消准备后休养或选择普通方法。` : null;
}

const practiceText = (s: SliceState) => {
  const f = s.mysticismMagister.practice;
  return `原衣角MM5-CLOTH-1${f.token === 'OWNER' ? '已在诺亚本人处' : '仍由你按有限借用许可持有，所有权仍属诺亚，须实际归还'}；${f.dreamOpen ? '原身体留书房，仪式尚未明确结束' : '没有持续梦境仪式'}。陈述${f.dreamResult === 'VERIFIED' ? '已经醒时核验' : f.dreamResult === 'CLAIM' ? '仍待醒时核验' : '尚未取得'}；实际仪式尝试${f.dreamAttempts}次，已耗非凡材料包${f.kitsUsed}包，成功普通教学核验${f.teachingChecks}次。`;
};
function resultText(s: SliceState, p: Case): string {
  const r = s.mysticismMagister.cases[p.id]!, f = s.mysticismMagister.practice;
  if (p.id === 'linked-dream') return (r.method === 'ABILITY' ? '本次仪式得到诺亚关于原阅读表第二行书名《港口纪事》的有限梦中陈述。' : '本次只得到清醒诺亚关于原阅读表第二行书名《港口纪事》的普通陈述，没有入梦。') + (f.dreamResult === 'VERIFIED' ? '之后你已沿原40米步道本人往返，与醒着的诺亚当面查看同一原阅读表，核实这句有限信息；原表仍由诺亚持有。' : '这还不是已证实的事实，必须结束接触后另花1行动实际醒时核验。');
  if (p.id === 'modest-craft') {
    if (r.method === 'ORDINARY') return '你实际买入并用完60便士普通纸样包，完成惰性纸样与安全间距对照，没有制造微光、使用非凡材料或学会能力。';
    const item = caseCraft(s);
    return `本案实际买入用尽一包非凡残材，成功制造原片${item?.id ?? '（来源缺失）'}。` + (r.outcome === 'CRAFT_TESTED' ? '之后已在清空的原三米试验凹间实际耗尽同一原片的一次微光，未伤人；原片现在只保留已消耗历史，不能再带入战斗使用。' : '原片仍是待试的真实物品；必须关闭现场，再用TEST_TOKEN实际耗片试闪，展示库存不算试用。');
  }
  return (r.method === 'ABILITY' ? '你实际以旧FLASH知识在清空原凹间演示自己的弱闪光，支付3灵性。' : '你实际以原桌惰性图示进行普通讲解，没有施法。') + '成年塔莉娅本人独立完成这一次普通来源、材料、出口与停止条件清单核验；没有获得你的技能或位阶，也没有永久服从。';
}
function makeCraft(s: SliceState, ctx: SeerContext): boolean {
  const m = s.mysticismMagister, number = ++m.practice.kitsUsed;
  s.cash -= 160; s.spirituality -= 4;
  ctx.note('真实购买并用尽原非凡材料包', `塞缪尔将封存原创G低阶非凡残材与惰性纸基MM5-KIT-${number}实际交付给你，160便士、4灵性和本次1行动已付。你用尽整包材料尝试仿制真实学会的FLASH；包内没有剩余库存，失败不退款、不返材料。`);
  const result = ctx.check('knowledge', 16);
  if (result.tier !== 'SUCCESS' && result.tier !== 'GREAT_SUCCESS') { ctx.note('本次材料仿制失败', `MM5-KIT-${number}已经用尽，但没有形成可用原片；不生成物品、不补领材料，本次成本保留。`); return false; }
  const mastery = s.progression.mastery['reader.s5.material-imitation'] ?? 0;
  const power = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
  m.crafts.push({ id: `MM5-FLASH-${number}`, sourceKitId: `MM5-KIT-${number}`, createdWeek: s.week, usedWeek: null, status: 'PLAYER', power });
  ctx.note('一次性弱微光原片实际制成', `原片MM5-FLASH-${number}源于刚用尽的MM5-KIT-${number}，制作强度${power.toFixed(3)}已固定。它只有一次短暂低强闪光，不是永久装备或新技能；未使用前在你手中，不自动触发或补充。`);
  return true;
}
export function applyMysticismMagisterActivity(s: SliceState, c: MysticismMagisterActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void, inheritedCraft = false): void {
  if (!validActivity(c)) throw new Error('秘术导师实践命令无效。');
  const reason = blocked(s, c, inheritedCraft); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyMysticismMagisterEncounter(s, c, ctx); return; }
  const m = s.mysticismMagister, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'linked-dream') f.dreamOpen = false;
    ctx.note('明确结束本次原现场', '0行动实际停止本次仪式、试作或教学接触并离开操作位；诺亚的本次睡眠联系已结束，原身体始终没有传送。关闭不归还衣角、不试用或删除原片，不撤销成品或失败、不退资源、不治疗。' + practiceText(s)); return;
  }
  if (c.type === 'RETURN_TOKEN') {
    f.token = 'OWNER';
    ctx.note('本人步行归还同一原衣角', '0行动，你沿原40米公共步道实际走到诺亚所在原休息室，经本人允许唤醒并把同一普通衣角MM5-CLOTH-1亲手归还，再走回书房；所有权一直归诺亚。此动作不代替醒时信息核验，不额外扮演、退资源或治疗，也不能在未关闭的梦境中执行。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动只取消本次尚未实施的准备。实际借取的原衣角仍按原许可在你手中，须另行归还；原观察、既有结果与已付行动不退款，没有自动开始或结束梦境。'); return;
  }
  if (c.type === 'TEST_TOKEN') {
    const item = m.crafts.find(item => item.id === c.itemId)!;
    item.status = 'CONSUMED'; item.usedWeek = s.week;
    if (caseCraft(s)?.id === item.id && m.cases['modest-craft']!.status === 'EXAMINED') m.cases['modest-craft']!.outcome = 'CRAFT_TESTED';
    ctx.note('在真实空凹间耗片试闪', `0行动，你沿书房原净空路线走到三米外原私人试验凹间，确认无人和可受损财物后，实际启动并耗尽${item.id}唯一一次低强闪光，再回书房。来源${item.sourceKitId}、固定强度${item.power.toFixed(3)}、第${s.week}周使用已记录；没有敌人或自身伤害，不凭空预览，不回收充能，不返还制作时已花的4灵性。`); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'VERIFY_DREAM') {
    f.dreamResult = 'VERIFIED'; m.cases['linked-dream']!.outcome = 'DREAM_VERIFIED';
    ctx.note('本人醒时复核这句有限陈述', '1行动，你沿原40米公共步道实际去原休息室，经本人允许唤醒诺亚，和醒着的他当面查看一直由他持有的原阅读表：第二行确为《港口纪事》。然后普通步行回原书房。这次独立实物与醒时对照才使有限陈述成为已核验结果；不验证其余梦话，不带走原表，也不自动归还衣角。'); return;
  }
  if (c.type === 'MAKE_TOKEN') { m.craftAttemptWeek = s.week; makeCraft(s, ctx); return; }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('mysticism-magister-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('联系、实物代价与普通核验', '回看真实原衣角的借还与醒时核验、实际材料试作或普通纸样、以及塔莉娅自己的有限核验。G扮演+25；仪式陈述须复核，材料失败也是实际支出，教人核验不等于复制技能或决定对方。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '本次只核对安排，没有代替当周实施时的本人同意或睡眠。'); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'linked-dream') {
      f.dreamResult = 'NONE';
      if (f.token === 'OWNER') { f.token = 'PLAYER'; ctx.note('本人真实借取同一原衣角', '本次准备的1行动包含沿原40米公共步道亲自到诺亚面前，由他同意借出同一个MM5-CLOTH-1，再普通步行返回原书房。有限借用许可可跨周保留，所有权始终归诺亚；没有新造第二块衣角。'); }
    }
    ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `mysticism-magister-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(s, p) + (r.method === 'ABILITY' ? '报告G扮演+25、原规则已有知识池单项掌握+8。' : '普通报告G扮演+25，仅保留本案来源，不增加魔法掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true; r.outcome = 'NONE';
  if (p.id === 'linked-dream') {
    f.dreamResult = 'NONE';
    if (r.method === 'ABILITY') {
      f.dreamAttempts += 1; f.dreamOpen = true;
      ctx.note('当周本人同意、入睡与原物仪式', `第${s.week}真实周，本次1行动包含你先沿40米公共步道到原休息室，当面再次确认成年诺亚同意这一次有限联系，他按本次约定实际入睡；你普通步行回原书房，再以真实借来的MM5-CLOTH-1开始仪式。仪式期间你的原身体一直坐在原书房，诺亚在40米外的原休息室，没有携人、瞬移、附身或提前获得梦魇。即使联系判定失败，也须明确关闭已开始的仪式。`);
    } else ctx.note('当周本人清醒的普通证言', '本次1行动包含你沿40米原步道当面征得清醒诺亚同意，听取他关于原阅读表的有限陈述，再返回原书房整理同一原衣角的来源。没有安排入睡或施加仪式；稍后仍须独立醒时核验。');
  }
  if (p.id === 'careful-teaching') ctx.note('塔莉娅本人确认这一次教学', '成年塔莉娅在原书房当面表示本次愿意听取有限说明，可随时拒绝与停止。' + (r.method === 'ABILITY' ? '你在已清空的原三米凹间实际演示自己已经学会的弱FLASH，之后由她独立核验普通清单；成功判定不决定她是否永远服从。' : '你使用留在原桌的普通惰性图示说明来源、材料与出口；没有能力传授或强迫听取。'));
  let success: boolean;
  if (p.id === 'modest-craft' && r.method === 'ABILITY') success = makeCraft(s, ctx);
  else {
    if (r.method === 'ABILITY') { s.spirituality -= p.spirit; ctx.note('实际支付本次有限能力成本', `${p.spirit}灵性已支出，失败照耗；不返还行动、不制造材料或学会新样本。`); }
    if (p.id === 'modest-craft') { s.cash -= 60; ctx.note('实际买入并用完普通纸样包', '60便士已付，塞缪尔交付本次普通惰性纸样包，你实际裁折并用完作对照；失败仍消耗，没有非凡材料或可携成品。'); }
    const result = ctx.check('knowledge', r.method === 'ABILITY' ? p.difficulty : 10);
    success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  }
  if (success) {
    r.status = 'EXAMINED';
    if (p.id === 'linked-dream') f.dreamResult = 'CLAIM';
    else if (p.id === 'careful-teaching') { f.teachingChecks += 1; r.outcome = p.outcome; }
    else if (r.method === 'ORDINARY') r.outcome = p.outcome;
    ctx.note(p.title, resultText(s, p) + '先0行动明确结束本次原现场，再完成尚欠的实际核验与报告。'); return;
  }
  r.status = 'OBSERVED';
  ctx.note(p.title, (p.id === 'linked-dream' ? '本次没有取得可核验陈述；原衣角仍在手中，已经开始的仪式若有也仍待明确关闭。' : p.id === 'modest-craft' ? '本次没有合格成品或纸样核对结果；真实购买和消耗保留，不生成免费物品。' : '本次独立普通清单核验未完成；若已演示弱闪光，其行动与灵性照耗，不把失败写成学生获得技能。') + '先0行动结束接触，下一真实周再准备，不能同周重刷。');
}

export function mysticismMagisterActions(s: SliceState): MysticismMagisterAction[] {
  if (!promoted(s)) return [];
  const out: MysticismMagisterAction[] = [], m = s.mysticismMagister;
  const add = (id: string, label: string, cost: string, command: MysticismMagisterActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (m.practice.token === 'PLAYER') add('mysticism-magister-return', '本人沿40米步道归还同一原衣角', '0行动 · 须先明确关闭接触/梦境', { type: 'RETURN_TOKEN' });
  if (m.practice.dreamResult === 'CLAIM') add('mysticism-magister-verify', '本人去原休息室醒时复核后返回', '1行动 · 普通步行40米 · 不自动归还衣角', { type: 'VERIFY_DREAM' });
  for (const item of m.crafts) if (item.status === 'PLAYER') add('test-' + item.id, `实际耗用${item.id}试闪`, '0行动 · 原三米空凹间 · 一次消耗', { type: 'TEST_TOKEN', itemId: item.id });
  if (m.cases['modest-craft']!.status === 'RESOLVED') add('mysticism-magister-make', '另买真实材料尝试一枚战备微光片', '1行动 · 160便士 · 4灵性 · 知识16 · 每真实周一次', { type: 'MAKE_TOKEN' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '明确结束本次接触与仪式', '0行动 · 不归还衣角/不消耗原片 · 保留成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原物、本人和有限现场来源', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'linked-dream' ? '实际借衣角并准备有限仪式' : p.id === 'modest-craft' ? '准备已学样本的真实材料仿制' : '准备演示已学弱闪光并教核验', `1行动 · 实施另耗${p.spirit}灵性` + (p.id === 'modest-craft' ? '、160便士' : ''), { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'linked-dream' ? '实际借衣角并准备醒时普通对照' : '准备普通纸样或图示核对', '1行动 · 实施0灵性' + (p.id === 'modest-craft' ? '、60便士' : ''), { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', '实际进行本次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 知识${p.difficulty}` + (p.id === 'modest-craft' ? ' · 160便士' : '') : '1行动 · 知识10 · 0灵性' + (p.id === 'modest-craft' ? ' · 60便士' : ''), { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不自动归还实际借物', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本案真实核验结果', '1行动 · 先关闭、实际核验/试用并归还原借物', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('mysticism-magister-reflect', '回看联系、材料与独立核验', '1行动 · 三案报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('mysticism-magister-encounter-talk', '前往原私人空院当面澄清', '1行动 · 先完成一案报告', { type: 'ENCOUNTER_TALK' });
    add('mysticism-magister-encounter-fight', '前往原私人空院承担有限冲突', '1行动 · 真实伤势/死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function mysticismMagisterCases(s: SliceState): MysticismMagisterProjection['cases'] {
  if (!promoted(s) && !(s.progression.pathwayId === 'white-tower' && (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))) return [];
  return CASES.map(p => {
    const r = s.mysticismMagister.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p) + practiceText(s) : r.attemptWeek !== null ? `第${r.attemptWeek}周未完成可报告核验，原物与实际成本保留；结束接触后下一真实周再准备。` + practiceText(s) : r.withdrawals ? '尚未实施的准备已取消，原借物须另行归还，行动不退。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次原现场尚未结束；必须明确CLOSE，不以归还衣角代替结束仪式' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function mysticismMagisterPractice(s: SliceState): MysticismMagisterProjection['practice'] {
  if (!promoted(s) && !(s.progression.pathwayId === 'white-tower' && (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))) return null;
  const f = s.mysticismMagister.practice;
  return { token: `MM5-CLOTH-1 · ${f.token === 'OWNER' ? '诺亚本人持有' : '由你有限借用，须实际归还'} · 所有权始终归诺亚`, dream: f.dreamOpen ? '本体留在原书房，有限仪式仍待明确关闭' : f.dreamResult === 'CLAIM' ? '仪式/接触已结束，陈述仍待本人醒时复核' : f.dreamResult === 'VERIFIED' ? '已结束并完成有限醒时核验' : '没有持续仪式或已核实陈述', summary: practiceText(s) };
}
export function mysticismMagisterCrafts(s: SliceState): MysticismMagisterProjection['crafts'] {
  if (!promoted(s) && !(s.progression.pathwayId === 'white-tower' && (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))) return [];
  return s.mysticismMagister.crafts.map(item => ({ id: item.id, source: `${item.sourceKitId} · 实付160便士并用尽原非凡残材 · 第${item.createdWeek}周制成`, status: item.status === 'PLAYER' ? '在你手中 · 一次未用' : `第${item.usedWeek}周已实际消耗 · 仅保留原物历史`, power: `${item.power.toFixed(3)} · 制作时固定 · 一次低强闪光` }));
}

/** Only these finite original loans, consumed kits and one-use craft histories are represented. */
export function validateMysticismMagisterLife(s: SliceState): boolean {
  const m = s.mysticismMagister;
  if (!record(m) || !record(m.cases) || !shape(m.cases, MYSTICISM_MAGISTER_CASE_IDS) || !record(m.practice) || !shape(m.practice, ['token', 'dreamOpen', 'dreamResult', 'dreamAttempts', 'kitsUsed', 'teachingChecks']) || !Array.isArray(m.crafts) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, first = m.promotionWeek ?? s.week, weeks = s.week - first + 1, active = promoted(s), inherited = s.progression.pathwayId === 'white-tower' && (s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2);
  if (!['OWNER', 'PLAYER'].includes(f.token) || typeof f.dreamOpen !== 'boolean' || !['NONE', 'CLAIM', 'VERIFIED'].includes(f.dreamResult) || !integer(f.dreamAttempts, 0, Math.max(0, weeks)) || !integer(f.kitsUsed, 0, Math.max(0, weeks * 2)) || !integer(f.teachingChecks, 0, 1)) return false;
  if (m.craftAttemptWeek !== null && !integer(m.craftAttemptWeek, first, s.week)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, weeks)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string) || r.attemptWeek !== null && !integer(r.attemptWeek, first, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `mysticism-magister-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1 || r.outcome !== p.outcome) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) {
      if (r.attemptWeek === null || r.method === null) return false;
      if (p.id === 'careful-teaching' || p.id === 'modest-craft' && r.method === 'ORDINARY') { if (r.outcome !== p.outcome) return false; }
      else if (!['NONE', p.outcome].includes(r.outcome as 'NONE' | typeof p.outcome)) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - first + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.method === 'ABILITY' && p.id !== 'linked-dream' && !learnedFlash(s)) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - first + 1) return false;
    }
    if (!active && !inherited && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared || inherited && (open > 0 || prepared > 0 || f.token !== 'OWNER' || f.dreamOpen || resolved !== 3 || !m.reflected || s.prophet.mysticismMagisterActingAtPromotion !== 100)) return false;
  const dream = m.cases['linked-dream']!, craft = m.cases['modest-craft']!, teaching = m.cases['careful-teaching']!;
  if (craft.status !== 'AVAILABLE' && dream.status !== 'RESOLVED' || teaching.status !== 'AVAILABLE' && craft.status !== 'RESOLVED') return false;
  if (craft.attemptWeek !== null && (dream.attemptWeek === null || craft.attemptWeek < dream.attemptWeek) || teaching.attemptWeek !== null && (craft.attemptWeek === null || teaching.attemptWeek < craft.attemptWeek)) return false;
  if (f.dreamOpen !== (dream.contactOpen && dream.method === 'ABILITY')) return false;
  if (f.token === 'PLAYER' && (dream.status === 'AVAILABLE' || dream.status === 'RESOLVED' || dream.status === 'OBSERVED' && dream.attemptWeek === null && dream.withdrawals === 0)) return false;
  if (dream.contactOpen && f.token !== 'PLAYER' || dream.status === 'RESOLVED' && f.token !== 'OWNER') return false;
  if (f.dreamAttempts > dream.closes + (dream.contactOpen ? 1 : 0) || dream.attemptWeek === null && f.dreamAttempts !== 0 || dream.method === 'ABILITY' && dream.attemptWeek !== null && dream.status !== 'PREPARED' && f.dreamAttempts === 0) return false;
  const dreamSuccess = ['EXAMINED', 'RESOLVED'].includes(dream.status);
  if (f.dreamResult !== (dreamSuccess ? dream.outcome === 'DREAM_VERIFIED' ? 'VERIFIED' : 'CLAIM' : 'NONE') || f.dreamResult === 'VERIFIED' && dream.contactOpen) return false;
  if (f.teachingChecks !== (['EXAMINED', 'RESOLVED'].includes(teaching.status) ? 1 : 0)) return false;
  const craftAttempts = craft.closes + (craft.contactOpen ? 1 : 0);
  const extraWeeks = m.craftAttemptWeek === null || craft.attemptWeek === null ? 0 : m.craftAttemptWeek - craft.attemptWeek + 1;
  if (f.kitsUsed > craftAttempts + extraWeeks || (f.kitsUsed > 0 || m.crafts.length > 0 || m.craftAttemptWeek !== null) && !learnedFlash(s)) return false;
  if (m.craftAttemptWeek !== null && (craft.status !== 'RESOLVED' || craft.attemptWeek === null || m.craftAttemptWeek < craft.attemptWeek || f.kitsUsed < 1)) return false;
  if (craft.method === 'ABILITY' && craft.attemptWeek !== null && craft.status !== 'PREPARED' && f.kitsUsed < 1) return false;
  const numbers = new Set<number>(), creationCounts = new Map<number, number>(); let lastNumber = 0, lastWeek = first;
  for (const item of m.crafts) {
    if (!record(item) || !shape(item, ['id', 'sourceKitId', 'createdWeek', 'usedWeek', 'status', 'power']) || typeof item.id !== 'string' || typeof item.sourceKitId !== 'string' || !/^MM5-FLASH-[1-9]\d*$/.test(item.id)) return false;
    const number = Number(item.id.slice('MM5-FLASH-'.length));
    if (!integer(number, 1, f.kitsUsed) || number <= lastNumber || numbers.has(number) || item.sourceKitId !== `MM5-KIT-${number}` || !integer(item.createdWeek, first, s.week) || item.createdWeek < lastWeek || !['PLAYER', 'CONSUMED'].includes(item.status) || !Number.isFinite(item.power) || item.power < 0.65 || item.power > 1) return false;
    if (item.status === 'PLAYER' ? item.usedWeek !== null : !integer(item.usedWeek, item.createdWeek, s.week)) return false;
    if (craft.attemptWeek === null || item.createdWeek < craft.attemptWeek) return false;
    const isCaseItem = craft.method === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(craft.status) && m.crafts[0] === item;
    if (isCaseItem ? item.createdWeek !== craft.attemptWeek : m.craftAttemptWeek === null || item.createdWeek > m.craftAttemptWeek) return false;
    creationCounts.set(item.createdWeek, (creationCounts.get(item.createdWeek) ?? 0) + 1);
    numbers.add(number); lastNumber = number; lastWeek = item.createdWeek;
  }
  const original = caseCraft(s);
  if (craft.method === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(craft.status)) {
    if (!original || (craft.outcome === 'CRAFT_TESTED') !== (original.status === 'CONSUMED')) return false;
    if (craft.contactOpen && original.status !== 'PLAYER') return false;
  }
  if (craft.status !== 'RESOLVED' && m.crafts.length !== (original ? 1 : 0)) return false;
  for (const [week, count] of creationCounts) if (count > (original?.createdWeek === week ? 2 : 1)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'mysticism-magister-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!active && !inherited && (m.reflected || f.token !== 'OWNER' || f.dreamOpen || f.dreamResult !== 'NONE' || f.dreamAttempts || f.kitsUsed || f.teachingChecks || m.crafts.length || m.craftAttemptWeek !== null)) return false;
  if (active && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}

/** S4/S3/S2 delegate only the original paid producer; all original case writes stay S5-only. */
export function blockProphetInheritedFlash(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'white-tower' || ![4,3,2].includes(s.progression.sequence??0)) return '须已成为预言家或继承其原工坊。';
  return blocked(s, { type: 'MAKE_TOKEN' }, true);
}
export function applyProphetInheritedFlash(s: SliceState, ctx: SeerContext): void {
  const reason = blockProphetInheritedFlash(s); if (reason) throw new Error(reason);
  applyMysticismMagisterActivity(s, { type: 'MAKE_TOKEN' }, ctx, () => {}, true);
}
