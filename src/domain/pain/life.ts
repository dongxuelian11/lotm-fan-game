import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyWitchActivity } from '../witch/life.js';
import { applyPainEncounter, blockPainEncounter, PAIN_ENCOUNTER_STORY } from './encounter.js';
import { PAIN_GUIDE, PAIN_VOLUNTEER } from './content.js';
import { PAIN_CASE_IDS, type PainCaseId, type PainCommand, type PainActivityCommand, type PainAction, type PainProjection } from './types.js';

const CASES = [
  {
    id: 'exit-markers', title: '原木牌和四米普通退路',
    story: `${PAIN_GUIDE}与同一位${PAIN_VOLUNTEER}核对原练习场的净空通路。她这次明确自愿参加无疾病的疏散模拟，随时可以停止；原木制地面标牌PN5-MARKER-1在原架上，原门与四米外安全标线都实际存在。（原创G）`,
    facts: ['拉维妮这次只同意普通步行的模拟，不同意被施加疾病；她始终没有感染，不把旧排练里的意见当作这次同意。', '准备只约定方法，原木牌仍在架上，你仍在入口，她仍在原等候点；没有已经发生的撤离或能力效果。', '实施亲手把同一块原木牌摆到原门边，再与本人沿净空的四米原路走到安全标线；普通知识10核对标示和实际疏散记录。', '检定失败也保留已走到的原位置和门边原木牌；0行动收束必须两人沿同一条四米原路实际返回，并把同一原木牌放回原架。'],
    preparation: '只准备这次双方明确同意的普通步行模拟。现在不移动本人、拉维妮或原木牌；实施另花1行动、0灵性、知识10，不施加疾病。',
    physical: '你亲手将同一块PN5-MARKER-1摆到原门边；拉维妮按这次明确同意的模拟与你沿原净空四米通路实际走到安全标线。她没有生病，普通步行没有伪装成疾病能力。',
    result: '原门边标牌与四米普通退路已实际核对，你和同一位拉维妮完成一次无疾病疏散模拟。报告只接受这次实际路线与标示，不声称疾病的作用范围或离开后的治愈。',
    failure: '本次标示与疏散记录的核对未获接受；两人仍实际在安全标线，原木牌仍在原门边，失败不能把人送回或复制原牌。',
    outcome: 'EXIT_REHEARSED',
  },
  {
    id: 'symptom-table', title: '虚构情境卡上的三行比较',
    story: `${PAIN_GUIDE}取出原文件夹内唯一的PN5-CASE-NOTES-1纸质情境卡。卡面明确印着“纯虚构模拟”，只列0、1、2个G回合的乏力与咳嗽示例。你要在同一张纸上比较变化和未知之处；没有病人、样本或实际感染。（原创G）`,
    facts: ['0、1、2个G回合只是本作虚构表格的三个示例时点，不是现实病程，也不是原著所有疾病的统一时限。', '准备时原情境卡还在原文件夹；实施才实际取出并在同一原纸上记录三行，普通知识10核对变化与未知。', '没有检验样本、真实症状、用药或施加疾病；记录不构成诊断，也不奖励疾病能力掌握。', '核对失败仍保留原纸上已经写好的三行；再次尝试只复核同三行，不添新纸或叠加记录数。0行动收束将同一原纸放回原文件夹。'],
    preparation: '准备比较原虚构情境卡的三个G时点与未知项，现在尚未取出原纸或书写。实施1行动、0灵性、知识10；记录不是诊断或能力使用。',
    physical: '你从原文件夹实际取出PN5-CASE-NOTES-1，在同一张纯虚构情境卡上写下0、1、2个G回合的三行比较；已有三行时只复核原行，不复制或累加。没有实际感染者。',
    result: '原虚构情境卡上的三行比较已获核对：示例中的乏力、咳嗽可逐步变化，未知部分仍标为未知；没有把虚构时点当作现实诊断、固定致死时限或真正疾病能力。',
    failure: '本次三行比较的解释未获接受；同一张原情境卡上实际写好的三行仍保留，不擦除或复制，也没有发生真实疾病。',
    outcome: 'TABLE_COMPARED',
  },
  {
    id: 'care-handoff', title: '把同一张模拟照护便笺交到本人手里',
    story: `${PAIN_VOLUNTEER}另行主动请你准备一份虚构演练的照护联络便笺，并明确同意核对后接收。原桌上只有一张PN5-CARE-NOTE-1纸；她没有生病。你实际写清演练状态、暂停意愿和可请求协助的事实，不能以便笺宣称治愈。（原创G）`,
    facts: ['拉维妮自由提出这一次虚构演练请求，只同意核对和接收便笺，随时可以停止；没有默许疾病、控制或治疗。', '准备不书写也不递纸。实施在唯一原纸上实际写下演练照护联络说明，再做普通知识10核对，不使用疾病能力。', '核对成功才把同一张原纸实际交给本人，纸从此由她保管；失败时纸已写好但仍在玩家手上，不能谎称已经交付。', '失败后的0行动收束把已经写好的同一原纸放回原桌，文字保留；成功后只结束这次谈话，原纸留在拉维妮手中。没有治疗、健康增加或疾病清除。'],
    preparation: '准备回应本人明确提出的虚构演练请求；现在不写字、不递纸。实施1行动、0灵性、知识10，实际写好后经核对才能交付同一张原便笺。',
    physical: '你在同一张PN5-CARE-NOTE-1原纸上实际写下虚构演练的照护联络说明；若此前已经写过，只核对并修订同一原纸。纸暂时仍在你手中，没有治疗或疾病施加。',
    result: '原便笺内容通过有限核对后，你亲手把同一张PN5-CARE-NOTE-1交给提出请求的拉维妮，她自行接收并保管。实际交接已经发生；这是虚构演练的联络说明，没有真实治疗或健康恢复。',
    failure: '原纸上的照护联络说明尚未通过核对；便笺已经实际写好，但仍由你拿着，拉维妮尚未接收。收束必须把同一张已写原纸放回原桌，不能擦除书写或假称交付。',
    outcome: 'CARE_HANDED',
  },
] as const;
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 5;
export const PAIN_ENVIRONMENT = '三项都是成年本人明确同意、没有真实疾病的原创G和平模拟：原木牌与四米普通退路、纯虚构三时点纸表、同一原纸的照护联络交接。只开放普通方法；观察、准备、实施、报告各1行动，实施普通知识10、0灵性。准备不移动人或物，也不进入接触；实施失败仍保留真实步行、原纸三行或已经写好的便笺，下一真实周才能重试。每次实施之后都须0行动实际走回、归还原物或结束交接，期间不能工作或跨周；收束不返成本、不治疗、不清除疾病、不复制原物。每项报告G扮演+25、三案反思+25，可和平100；模拟不发能力掌握奖励，不宣称实际使用疾病或完成原著完整扮演。真实敌人的已发生疾病不因离开范围自动消失，盟友也没有默认免疫。' + PAIN_ENCOUNTER_STORY;
export const painInside = (s: SliceState) => Object.values(s.pain.cases).some(r => r.contactOpen) || s.pain.practice.playerNode !== 'ENTRY' || s.pain.practice.companionNode !== 'WAITING' || s.pain.practice.marker !== 'RACK';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export const isPainActivity = (c: PainCommand): c is PainActivityCommand => record(c) && ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'BUY_SUPPLIES', 'PREPARE_MIRROR', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'ENCOUNTER_AID'].includes(c.type);
export function validatePainActivityCommand(c: unknown): c is PainActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'BUY_SUPPLIES', 'PREPARE_MIRROR', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'ENCOUNTER_AID'].includes(c.type as string)) return shape(c, ['type']);
  if (!PAIN_CASE_IDS.includes(c.caseId as PainCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && c.method === 'ORDINARY';
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: PainActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!promoted(s)) return '先完成痛苦魔女晋升。';
  const m = s.pain, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原练习场，不能借收束让人或原纸瞬移。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未实际收束的本次模拟接触。';
  if (painInside(s)) return '先0行动沿原四米通路实际返回、归还同一原物或结束便笺交接。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备可取消。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT' || c.type === 'ENCOUNTER_AID') return blockPainEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (c.type === 'PREPARE_MIRROR') return s.witch.tools.mirrorPrepared ? '原小镜已经备好。' : s.witch.tools.mirrorsHeld < 1 ? '没有实际持有的原小镜。' : null;
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'BUY_SUPPLIES') return s.witch.tools.lastPurchaseWeek === s.week ? '本周这份原工具包已交付，下周再购。' : s.cash < 60 ? '原工具包需要60便士。' : null;
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段模拟经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成，原路与同一原纸的实际结果保留。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原人、原物和这一次模拟范围已经核对。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得可报告的有限结果并实际收束。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与这一次明确同意。' : r.attemptWeek === s.week ? '本周实际动作与核对结果保留，下一真实周再准备。' : null;
  if (r.status !== 'PREPARED' || r.method !== 'ORDINARY') return '先准备本次普通模拟，不开放对志愿者施加疾病。';
  return r.attemptWeek === s.week ? '本周已经实际尝试，下一真实周才可重试。' : null;
}
function actualText(s: SliceState, caseId: PainCaseId): string {
  const f = s.pain.practice, r = s.pain.cases[caseId]!;
  if (caseId === 'exit-markers') return f.playerNode === 'SAFE_MARK' ? ' 当前你与拉维妮仍在四米外原安全标线，原木牌仍在原门边，须实际沿原路返回并归还原牌。' : r.attemptWeek === null ? ' 当前你在原入口，拉维妮在原等候点，原木牌在原架。' : ' 双方已经沿同一条四米原路实际返回入口和原等候点，同一原木牌已放回原架；步行历史仍保留。';
  if (caseId === 'symptom-table') return ` 原情境卡已有${f.tableRows}行实际记录；${r.contactOpen ? '同一原纸仍在本次核对桌上，须实际放回原文件夹' : '同一原纸在原文件夹，已有文字不会因收束被擦除'}。`;
  return f.careNote === 'HANDED_OVER' ? ' 同一张已写原便笺现在由拉维妮保管，收束不会取回或复制。' : f.careNote === 'WRITTEN' ? r.contactOpen ? ' 同一张已写原便笺仍在你手上，尚未交付，须实际放回原桌。' : ' 同一张已写原便笺已实际放回原桌，书写保留，尚未交付。' : ' 唯一原便笺仍是原桌上的空白纸，尚未书写或交付。';
}
export function applyPainActivity(s: SliceState, c: PainActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validatePainActivityCommand(c)) throw new Error('痛苦魔女模拟实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT' || c.type === 'ENCOUNTER_AID') { applyPainEncounter(s, c, ctx); return; }
  if (c.type === 'BUY_SUPPLIES' || c.type === 'PREPARE_MIRROR') { applyWitchActivity(s, c, ctx, award); return; }
  const m = s.pain, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    if (c.caseId === 'exit-markers') {
      f.playerNode = 'ENTRY'; f.companionNode = 'WAITING'; f.marker = 'RACK';
      ctx.note('沿原四米通路实际返回并归还原牌', '0行动、0灵性，你与拉维妮沿同一条净空四米原路径实际走回原入口和原等候点，再把同一块PN5-MARKER-1放回原架。她始终没有感染；这次返程不是传送、治愈或把既往步行清零，已付成本与核对成败保留。');
    } else if (c.caseId === 'symptom-table') ctx.note('把同一原情境卡实际放回文件夹', '0行动、0灵性，把已经写有三行比较的同一张PN5-CASE-NOTES-1放回原文件夹，结束本次桌面核对。已有三行与成败记录保留，不擦除、不复制，也没有真实疾病需要清除。');
    else ctx.note(f.careNote === 'HANDED_OVER' ? '结束原便笺交接' : '把已写好的同一原便笺放回原桌', f.careNote === 'HANDED_OVER' ? '0行动、0灵性结束本次谈话并退离；已经实际交付的PN5-CARE-NOTE-1继续由拉维妮保管，没有取回或复制，没有治疗或健康增加。' : '0行动、0灵性把手中已经写好的同一张PN5-CARE-NOTE-1实际放回原桌，结束本次未获接受的核对。文字与失败历史保留，纸尚未交给拉维妮，没有治疗、健康增加或疾病清除。');
    r.contactOpen = false; r.closes += 1; return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的普通模拟准备', '0行动取消这次尚未实施的准备，没有移动任何人、原木牌或原纸，不施加疾病、不返成本。以前已经发生的步行、三行记录或原便笺书写与交付保持原状。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('pain-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('模拟的边界与真实后果', '回看明确同意的普通退路、虚构变化表与同一原纸的照护交接。原创G和平扮演+25，三案报告与反思可和平100；模拟没有施加疾病，也没有能力掌握奖励。真实疾病的后果仍须面对，离开范围不等于治愈，盟友没有默认免疫；这不宣称完成原著完整扮演。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = 'ORDINARY'; ctx.note(p.title, p.preparation + actualText(s, p.id)); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(`pain-case:${p.id}`); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note(p.title, p.result + actualText(s, p.id) + ' 本次接触已实际收束。原创G和平扮演+25；没有实际施加疾病，不发能力掌握奖励，不治疗或清除任何既往疾病。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'exit-markers') { f.marker = 'DOOR_MARK'; f.playerNode = 'SAFE_MARK'; f.companionNode = 'SAFE_MARK'; }
  else if (p.id === 'symptom-table') f.tableRows = 3;
  else f.careNote = 'WRITTEN';
  ctx.note('先实际完成这次普通动作', p.physical);
  const result = ctx.check('knowledge', 10), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  r.status = success ? 'EXAMINED' : 'OBSERVED'; r.outcome = success ? p.outcome : 'NONE';
  if (p.id === 'care-handoff' && success) f.careNote = 'HANDED_OVER';
  ctx.note(p.title, (success ? p.result : p.failure) + ' 已付1行动，0灵性；实际动作不随核对成败撤销。' + (success ? '先0行动实际收束后才能报告。' : '先0行动实际收束，下一真实周再准备核对。') + actualText(s, p.id));
}
export function painActions(s: SliceState): PainAction[] {
  if (!promoted(s)) return [];
  const out: PainAction[] = [], m = s.pain;
  const add = (id: string, label: string, cost: string, command: PainActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('pain-buy-tools', '领取本周原女巫粉剂与小镜', '1行动 · 60便士 · 每周一包', { type: 'BUY_SUPPLIES' });
  add('pain-arm-mirror', '把持有的原镜备给替身', '0行动 · 0灵性 · 本次不碎镜', { type: 'PREPARE_MIRROR' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', p.id === 'exit-markers' ? '沿原四米路返回并归还同一原牌' : p.id === 'symptom-table' ? '把同一原情境卡放回原文件夹' : m.practice.careNote === 'HANDED_OVER' ? '结束交接，原便笺留给本人' : '把同一张已写便笺放回原桌', '0行动 · 0灵性 · 实际动作与成本保留', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对原人原物与这一次模拟范围', '1行动 · 无实际疾病', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') add(p.id + '-ordinary', p.id === 'exit-markers' ? '准备普通四米疏散模拟' : p.id === 'symptom-table' ? '准备比较原虚构情境卡' : '准备原便笺照护交接', '1行动 · 此刻不接触 · 实施0灵性、知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', p.id === 'exit-markers' ? '放原牌并沿原路实际走到安全标线' : p.id === 'symptom-table' ? '在同一原纸实际记录三行比较' : '实际写原便笺，核对后再交给本人', '1行动 · 0灵性 · 知识10 · 失败保留实际动作', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 原物历史与成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际模拟结果与仍未知的边界', '1行动 · 扮演+25 · 无能力掌握奖励', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('pain-reflect', '回看模拟范围与真实后果', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('pain-encounter-talk', '前往原空院与奥伦当面澄清', '1行动 · 先完成一项报告 · 不施加疾病', { type: 'ENCOUNTER_TALK' });
    add('pain-encounter-fight', '前往原空院并承担真实冲突', '1行动 · 真实伤势与疾病后果 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  } else if (m.encounter.status !== 'FIGHTING' && m.encounter.enemyDisease > 0 && m.encounter.enemyHealth > 0 && m.encounter.enemyStatus !== 'DEAD' && m.encounter.care === 'NONE') add('pain-encounter-aid', '为仍患病的原奥伦实际请求协助', '1行动 · 40便士 · 通知与交通协助，不承诺治愈', { type: 'ENCOUNTER_AID' });
  return out;
}
export function painCases(s: SliceState): PainProjection['cases'] {
  if (!(s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) return [];
  return CASES.map(p => {
    const r = s.pain.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result + actualText(s, p.id)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周核对未成。` + p.failure + actualText(s, p.id)
        : r.withdrawals ? '尚未实施的准备已取消；没有疾病、步行、书写或交付被伪造。' + actualText(s, p.id) : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, actualText(s, p.id)], preparation: r.status === 'PREPARED' ? p.preparation + actualText(s, p.id) : null, result, status: r.status, contactOpen: r.contactOpen ? '须0行动实际返回、归还同一原物或结束交接' : '没有尚未收束的本次模拟接触', closes: r.closes };
  });
}
export function painPractice(s: SliceState): PainProjection['practice'] {
  if (!(s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))) return null;
  const f = s.pain.practice;
  return {
    position: actualText(s, 'exit-markers').trim(),
    records: `PN5-CASE-NOTES-1 · 唯一原虚构情境卡 · 实际${f.tableRows}行` + actualText(s, 'symptom-table'),
    care: `PN5-CARE-NOTE-1 · 唯一原便笺 · ${f.careNote === 'BLANK' ? '尚未书写' : f.careNote === 'WRITTEN' ? '已写、未交付' : '已实际交给拉维妮'}` + actualText(s, 'care-handoff'),
    history: ['三项始终只作普通模拟，拉维妮没有感染；没有施加疾病、灵性支出或模拟能力奖励', ...CASES.map(p => { const r = s.pain.cases[p.id]!; return `${p.title}：实际尝试${r.closes + Number(r.contactOpen)}次，已实际收束${r.closes}次；${r.outcome === 'NONE' ? '尚无已接受报告结果' : '有限结果已获核对'}，${r.status === 'RESOLVED' ? '报告已完成' : '报告尚未完成'}`; }), '已走过的原路、原纸已有三行和便笺书写不会因失败、取消或下周被删除；真实患病者也不会因退出范围自动治愈'],
  };
}
export function applyPainLifeProjection(s: SliceState, projection: PainProjection): PainProjection {
  return { ...projection, actions: [...projection.actions, ...painActions(s)], cases: painCases(s), insideCase: painInside(s), environment: (s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) ? PAIN_ENVIRONMENT : '', practice: painPractice(s) };
}
/** Physical actions persist through failed checks; simulation never represents actual illness. */
export function validatePainLife(s: SliceState): boolean {
  const m = s.pain;
  if (!record(m) || !record(m.cases) || !shape(m.cases, PAIN_CASE_IDS) || !record(m.practice) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice;
  if (!shape(f, ['playerNode', 'companionNode', 'marker', 'tableRows', 'careNote', 'simulatedOnly']) || f.simulatedOnly !== true) return false;
  if (!['ENTRY', 'SAFE_MARK'].includes(f.playerNode) || !['WAITING', 'SAFE_MARK'].includes(f.companionNode) || !['RACK', 'DOOR_MARK'].includes(f.marker) || !integer(f.tableRows, 0, 3) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.careNote)) return false;
  const firstWeek = m.promotionWeek ?? s.week;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, s.week - firstWeek + 1) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && r.method !== 'ORDINARY' || r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    const successful = ['EXAMINED', 'RESOLVED'].includes(r.status as string);
    if (successful ? r.attemptWeek === null || r.method !== 'ORDINARY' || r.outcome !== p.outcome : r.outcome !== 'NONE') return false;
    if (s.seer.completedSources.filter(x => x === `pain-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (r.status === 'PREPARED') { prepared += 1; if (r.method !== 'ORDINARY' || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method !== 'ORDINARY' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
    }
    if (!(s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const exit = m.cases['exit-markers']!, table = m.cases['symptom-table']!, care = m.cases['care-handoff']!;
  if (f.playerNode !== (exit.contactOpen ? 'SAFE_MARK' : 'ENTRY') || f.companionNode !== (exit.contactOpen ? 'SAFE_MARK' : 'WAITING') || f.marker !== (exit.contactOpen ? 'DOOR_MARK' : 'RACK')) return false;
  if (f.tableRows !== (table.attemptWeek === null ? 0 : 3)) return false;
  if (f.careNote !== (care.attemptWeek === null ? 'BLANK' : ['EXAMINED', 'RESOLVED'].includes(care.status) ? 'HANDED_OVER' : 'WRITTEN')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'pain-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!(s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) && m.reflected) return false;
  return !(s.progression.pathwayId==='demoness'&&(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) || ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.despair.painActingAtPromotion:s.progression.acting) === resolved * 25 + (m.reflected ? 25 : 0);
}
