import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { WEREWOLF_MOON_EVENTS } from '../werewolf/content.js';
import { applyWraithEncounter, blockWraithEncounter, WRAITH_ENCOUNTER_STORY } from './encounter.js';
import { validateWraithCommand } from './index.js';
import { WRAITH_CASE_IDS, type WraithCommand, type WraithActivityCommand, type WraithAction, type WraithProjection } from './types.js';

const CASES = [
  {
    id: 'reflected-room', title: '原工坊的两面固定镜与四米去回',
    story: '成年管理员哈伦在贝克兰德原工坊当面指导。原房间ROOM与四米外可见壁龛ALCOVE各有一面固定原镜WF5-MIRROR-ROOM、WF5-MIRROR-ALCOVE，两面完整且确实能反射，均属原工坊；旁边同一条四米普通侧廊连续净空，可以步行去回。',
    facts: ['本次只在眼前两处已登记反射端点之间移动；实施时哈伦本人实际揭开两面原镜的遮布，镜与遮布不转移所有权。', '能力只移动处于怨魂形态的你和原本所穿衣物，不携带手持道具、同伴，也不在出发点留下另一具身体。', '3灵性预付本次有限尝试的去程与同镜返程，失败仍可能已到壁龛，须显式返回并重新显形；没有通用免费镜跳或莎伦个人三百米距离保证。'],
    ability: '准备本次两端点镜面去回：实施1行动、3灵性、知识14，去回整段成本预付。实际转为怨魂，从ROOM原镜跃至ALCOVE原镜；核对失败也须0行动用同两面仍打开的原镜返回、显形并盖好。',
    ordinary: '准备沿原四米净空侧廊普通步行至ALCOVE，回看同两面原镜；实施1行动、0灵性、知识10，保持人形，随后须0行动沿同一原走廊实际走回。',
    outcome: 'ROUTE_CHECKED',
  },
  {
    id: 'willing-signal', title: '诺兰本人同意的一次原旗举放',
    story: '原创成年诺兰Nolan本人已在原房间ROOM，与原工坊的同一面小旗WF5-FLAG-1在场。诺兰明确同意这一次可以停止的有限附身举旗试验，或由他自愿举旗的普通对照；只有一个举旗动作，原旗仍归工坊，他的同意不延长成以后或任意行为的授权。',
    facts: ['附身可以失败并被排斥；本人同意是本次G场景的边界安排，不冒充原著施法必须自愿。', '成功时你实际为WRAITH并处于原诺兰体内NOLAN，同一原旗被举起；没有留在外面的第二具身体、读取记忆、直接伤害或永久控制。', '3灵性包含本次有界试验和显式退出；结束时须实际退出原诺兰、在ROOM重新显形，由诺兰亲手把同一原旗放回原桌。失败被排斥后也须当面确认停止。'],
    ability: '诺兰当面明确同意本次一次举旗与随时停止。准备不附身；实施1行动、3灵性、知识14。成功后有限附身仍待显式退出，失败则被排斥并显形；两者都须0行动实际结束本次联系。',
    ordinary: '准备普通请求原诺兰自愿举起同一面WF5-FLAG-1；实施1行动、0灵性、知识10。你始终HUMAN/SELF，不附身；结束时诺兰亲手放回原旗。',
    outcome: 'SIGNAL_CHECKED',
  },
  {
    id: 'honest-account', title: '亲手交付同一张有限记录',
    story: '哈伦在同一原房间保留原记录纸WF5-NOTE-1。你只整理已经实际经历的镜面或普通去回、原诺兰的本次意愿、附身成功或被排斥，以及实际退出；原纸始终属于工坊，不凭文字生成秘密、真理裁判或新能力。',
    facts: ['只写真实已经发生的有限事实；普通举旗不能写成附身，失败不能写成成功。', '实施时哈伦亲手递来同一张WF5-NOTE-1，失败也实际留下文字；重试仍递回同一张原纸，之前的失败文字保留并更正。', '结束时亲手把已经写过的原纸交给哈伦；不是凭标签远程转移、复制或赠送物品。'],
    ability: null,
    ordinary: '准备普通整理已发生事实；实施1行动、0灵性、知识10，在同一张WF5-NOTE-1上写下有限记录，然后0行动亲手交付。',
    outcome: 'ACCOUNT_CHECKED',
  },
] as const;

const active = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 5;
const contactOpen = (s: SliceState) => Object.values(s.wraith.cases).some(r => r.contactOpen);
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const physicalContact = (s: SliceState) => {
  const f = s.wraith.practice;
  return f.node !== 'ROOM' || f.form !== 'HUMAN' || f.host !== 'SELF' || f.flag === 'RAISED' || f.note === 'WRITTEN' || f.mirror === 'OPEN';
};
export const wraithInside = (s: SliceState) => s.wraith.moon.pendingWeek !== null || contactOpen(s) || physicalContact(s);
export const isWraithActivity = (c: WraithCommand): c is WraithActivityCommand => typeof c === 'object' && c !== null &&
  ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'HANDLE_MOON', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

export const WRAITH_ENVIRONMENT = '以下现场与全部成本是原创G：观察、准备、实施、报告各1行动。镜面去回和有限附身实施3灵性、知识14，已包含本次显式返程或退出；普通方法0灵性、知识10，失败照付。两面原固定镜相距四米且同一普通侧廊可步行去回；不是任意传送。成功附身只限原成年诺兰的一次原旗举放，失败实际被排斥并显形。最后1行动或0灵性仍可0行动实际返回、退出或交付原纸；不退款、不治疗。三份真实报告各G扮演25，前两项真实成功的能力报告才各得已有知识池单项掌握8，普通方法不伪造能力奖励，最后反思25。全普通和平100是有成本的G玩法，不保证原著无风险消化或消除诅咒。怨魂满月不吞食人类灵魂会极度虚弱，沿用原先公示的八场有限事件；当前选择实际等待并承受精神成本，没有自动杀人、吞魂或叠加旧狼人嗜血与活尸剧痛。等待时长与精神数值只是本场G规则，不冒称原著精确弱化公式。' + WRAITH_ENCOUNTER_STORY;

/** Reuse the original eight announced episodes, after events and actual contacts close. */
export function syncWraithMoon(s: SliceState, ctx: SeerContext): void {
  if (!active(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.activeEvent || s.combat || wraithInside(s)) return;
  if (s.werewolf.moon.pendingWeek !== null || s.zombie.moon.pendingWeek !== null || Object.values(s.zombie.cases).some(r => r.contactOpen) || Object.values(s.werewolf.cases).some(r => r.sceneOpen) || Object.values(s.madman.cases).some(r => r.burstOpen) || Object.values(s.prisoner.cases).some(r => r.holding)) return;
  const event = WEREWOLF_MOON_EVENTS.find(entry => entry.week === s.week);
  if (!event || [s.werewolf.moon.history, s.zombie.moon.history, s.wraith.moon.history].some(history => history.some(entry => entry.week === s.week))) return;
  s.wraith.moon.pendingWeek = s.week;
  ctx.note('原告示中的怨魂满月已经到来', `第${event.week}周「${event.title}」的本次G月相事件实际开始。你没有吞食人类灵魂，正在承受极度虚弱，期间不能战斗或继续普通活动；须实际度过这段发作时间。没有自动伤人。这取代旧狼人嗜血与活尸剧痛的发作形态，旧记录完整保留，同一场不重复结算。`);
}

function closeBlock(s: SliceState, caseId: string): string | null {
  const m = s.wraith, f = m.practice, r = m.cases[caseId];
  if (!r?.contactOpen || r.attemptWeek !== s.week || r.method === null || !['OBSERVED', 'EXAMINED'].includes(r.status)) return '没有尚待实际结束的本次接触。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || m.moon.pendingWeek !== null) return '本次收束须在原工坊的同一实际接触内。';
  if (caseId === 'reflected-room') return f.node === 'ALCOVE' && f.mirror === 'OPEN' && f.host === 'SELF' && f.form === (r.method === 'ABILITY' ? 'WRAITH' : 'HUMAN') ? null : '须有本人在ALCOVE与同两面已打开的真实原镜，才能沿本次原路线返回。';
  if (caseId === 'willing-signal') {
    const possessed = r.method === 'ABILITY' && r.status === 'EXAMINED';
    const raised = r.method === 'ORDINARY' || possessed;
    return f.node === 'ROOM' && f.mirror === 'COVERED' && f.form === (possessed ? 'WRAITH' : 'HUMAN') && f.host === (possessed ? 'NOLAN' : 'SELF') && f.flag === (raised ? 'RAISED' : 'TABLE') ? null : '须按本次真实附身、被排斥或普通举旗状态结束，不能虚构退出。';
  }
  return f.node === 'ROOM' && f.form === 'HUMAN' && f.host === 'SELF' && f.note === 'WRITTEN' ? null : '须先实际写过并持有同一张原纸，才能亲手交付。';
}

function blocked(s: SliceState, c: WraithActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockWraithEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成怨魂晋升。';
  const m = s.wraith, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return closeBlock(s, c.caseId);
  if (contactOpen(s) || physicalContact(s)) return '先0行动实际沿原镜或原走廊返回、退出原诺兰，或亲手交付同一原纸。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (c.type === 'HANDLE_MOON') {
    if (m.moon.pendingWeek === null) return '当前没有尚待度过的怨魂月圆。';
    return c.method === 'GUARDED' && (s.world.city !== 'BACKLUND' || !m.guidanceKnown) ? '哈伦本人只在贝克兰德原工坊提供本次守望，不能召至异地。' : null;
  }
  if (m.moon.pendingWeek !== null) return '先实际度过本次怨魂满月的极度虚弱，当前不能战斗或继续普通活动。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德哈伦的原工坊。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前尚未实施的准备。';
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践已发生，下一真实周再重新准备。' : c.caseId === 'honest-account' && c.method === 'ABILITY' ? '有限记录只能普通书写，没有真理裁判能力。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' || r.outcome === 'NONE' ? '先取得真实结果，并实际结束本次接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力需要3灵性，已含有限返回或退出；不能透支，可取消准备改用普通方法。' : null;
}

function practiceText(s: SliceState): string {
  const f = s.wraith.practice;
  return `本人形态${f.form}，实际位置${f.node}，同两面固定原镜${f.mirror}，本次宿主${f.host}；唯一原旗WF5-FLAG-1为${f.flag}，同一原纸WF5-NOTE-1为${f.note}。镜、旗与纸仍归原工坊，诺兰仍是原来的独立成年人；没有第二具身体或所有权转移。`;
}
function resultText(s: SliceState, id: string): string {
  const r = s.wraith.cases[id]!;
  if (id === 'reflected-room') return r.method === 'ABILITY' ? '你实际从ROOM原镜以怨魂形态跃至四米外ALCOVE原镜，并核实本次两处真实反射端点；没有通用任意传送、携物或分身。' : '你本人沿同一原四米侧廊普通步行至ALCOVE，核对两面原镜；一直保持人形，没有镜面跳跃。';
  if (id === 'willing-signal') return r.method === 'ABILITY' ? '在原诺兰本人同意的一次有限试验里，你实际附身于同一原诺兰并举起同一面WF5-FLAG-1；只核对这次动作，不读取记忆、改写人格或永久控制。' : '原诺兰应普通请求自愿举起同一面WF5-FLAG-1；你一直HUMAN/SELF，普通自愿配合不算附身。';
  return '你在同一张WF5-NOTE-1上写下实际去回、本人意愿、成功或失败与真实停止的有限记录，没有补写未知事实或把文字变成能力。';
}

export function applyWraithActivity(s: SliceState, c: WraithActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateWraithCommand(c) || !isWraithActivity(c)) throw new Error('怨魂活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyWraithEncounter(s, c, ctx); return; }
  const m = s.wraith, f = m.practice;
  if (c.type === 'HANDLE_MOON') {
    const week = m.moon.pendingWeek!, mentalCost = Math.min(s.mind, c.method === 'GUARDED' ? 10 : 20);
    s.mind -= mentalCost; m.moon.history.push({ week, method: c.method, mentalCost }); m.moon.pendingWeek = null;
    ctx.note('实际度过本次怨魂满月虚弱', c.method === 'GUARDED' ? '你当面请原哈伦提供本次守望，他本人自愿留在贝克兰德原工坊的隔开空间，协助你实际等过这一段极度虚弱时间。期间停止普通活动与战斗；没有让他承担诅咒，没有召来替代者。' : '你留在当前实际地点停止接触他人、停止普通活动与战斗，独自承受并实际等过这一段极度虚弱时间；没有被传送到别处。');
    ctx.note('本次发作过去，满月诅咒仍在', `0行动，精神实际消耗${mentalCost}。只实际度过这场已公告G事件的有限发作，没有推进新的历法、杀人或吞食灵魂，没有治疗、补充灵性、扮演或掌握奖励。旧狼人嗜血与活尸剧痛不再叠加，已有历史原样保留。和平消化不消除诅咒；末场之后月相尚未展开，也不代表诅咒消失。`); return;
  }
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let closure: string;
    if (c.caseId === 'reflected-room') {
      closure = r.method === 'ABILITY' ? '你本人以仍在ALCOVE的怨魂形态，借同一面WF5-MIRROR-ALCOVE实际跃回仍打开的WF5-MIRROR-ROOM，完整返回ROOM后重新显形为HUMAN。返程使用本次3灵性已经预付的有界去回预算，没有在起点留下身体，没有新落点或免费额外跳跃。' : '你本人从ALCOVE沿同一条已经净空的四米原侧廊实际步行返回ROOM，一直保持HUMAN，没有施法。';
      f.node = 'ROOM'; f.form = 'HUMAN'; f.mirror = 'COVERED';
      closure += '哈伦当面将同两面固定原镜的原遮布重新盖好；两面原镜仍在各自原位。';
    } else if (c.caseId === 'willing-signal') {
      closure = f.host === 'NOLAN' ? '你实际退出同一位原诺兰，不再占据他的身体，并在原房间ROOM重新显形为HUMAN/SELF；退出使用本次已经预付的有限试验预算。' : r.method === 'ABILITY' ? '本次附身已经被排斥，你此前已在ROOM显形为HUMAN/SELF，没有虚构第二次退出；你当面向同一位原诺兰确认本次试验停止。' : '你本人一直HUMAN/SELF，没有附身或虚构退出；当面结束本次普通举旗请求。';
      if (f.flag === 'RAISED') closure += '诺兰本人亲手把同一面WF5-FLAG-1实际放回原桌TABLE，原旗仍归原工坊。';
      else closure += '同一面WF5-FLAG-1始终在原桌TABLE，没有凭空举起或转移。';
      f.form = 'HUMAN'; f.host = 'SELF'; f.flag = 'TABLE';
      closure += '诺兰本人的这一次有限同意与联系实际结束，不能延续为未来控制权限。';
    } else {
      f.note = 'HANDED_OVER';
      closure = '你本人亲手把已经写过的同一张WF5-NOTE-1实际交给原哈伦，由他当面接住收妥；失败文字也保留，不复制、远程传递或赠送新物品。';
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际收束本次接触', '0行动、0额外灵性。' + closure + '实际结果与已付成本保留，不退款、不治疗、不奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消尚未实施的方案；原观察与已付行动保留，没有新移动、附身、举旗或书写。若准备过诺兰的试验，本次尚未实施的有限同意同时结束；不退成本。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('wraith-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看同一身体、有限同意与真实去回', '两面原镜和普通侧廊的实际去回、原诺兰这一次可停止的同意、成功或被排斥与显式退出、同一原纸的亲手交付分别有据。G扮演+25；全普通和平100也是有成本的G玩法，不伪造能力掌握，不保证原著无风险消化或解除满月诅咒，不提前取得序列4木偶能力。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability! : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `wraith-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(s, p.id) + '本次已实际返回、退出或亲手交付，接触已经结束。G扮演+25；' + (r.method === 'ABILITY' ? '真实成功的能力报告给予一次已有知识池单项掌握8。' : '普通方法没有施法，不增加能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    ctx.note('本次有限能力已经实付', '实际消耗3灵性，包含这一次实践与后续显式返回或退出。失败照付，不续成自由移动、长期附身或全时无敌。');
  }
  if (p.id === 'reflected-room') {
    f.mirror = 'OPEN'; f.node = 'ALCOVE'; f.form = r.method === 'ABILITY' ? 'WRAITH' : 'HUMAN';
    ctx.note('本次去程已经真实发生', '哈伦本人实际揭开同两面固定原镜的原遮布，两个真实反射端点仍完整可用。' + (r.method === 'ABILITY' ? '你转为怨魂，实际由ROOM原镜跃至四米外ALCOVE原镜；原身体整体进入怨魂形态，起点没有另一具身体。' : '你保持人形，沿同一原四米侧廊实际步行到ALCOVE，回看原房间。') + '接下来的核对失败也不撤销这次抵达，须显式实际返回。');
  } else if (p.id === 'willing-signal' && r.method === 'ORDINARY') {
    f.flag = 'RAISED';
    ctx.note('原诺兰自愿举旗', '原诺兰本人听取普通请求后自愿亲手举起同一面WF5-FLAG-1；你一直HUMAN/SELF，没有附身。核对失败也保留原旗已经举起的事实，仍须结束请求并由他放回。');
  } else if (p.id === 'honest-account') {
    const retry = f.note === 'HANDED_OVER'; f.note = 'WRITTEN';
    ctx.note('同一原纸已经实际书写', '哈伦亲手递来同一张WF5-NOTE-1，你接过并普通书写已经实际经历的有限事实。' + (retry ? '之前的失败文字保留，在同一张原纸上核对和更正。' : '没有新造、复制或取得这张原纸的所有权。') + '接下来的核对失败也保留文字，须亲手交付。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (success(result.tier)) {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'willing-signal' && r.method === 'ABILITY') {
      f.form = 'WRAITH'; f.host = 'NOLAN'; f.flag = 'RAISED';
      ctx.note('本次有限附身实际成功', '你转为怨魂并实际进入同一位原诺兰体内，以这一次限定动作举起同一面WF5-FLAG-1；原身体没有留在外面。当前WRAITH/NOLAN/RAISED，本次联系仍在，须0行动实际退出、在ROOM显形，再由诺兰放回原旗。');
    }
    ctx.note(p.title, resultText(s, p.id) + '本次接触仍在，先0行动实际收束才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  if (p.id === 'willing-signal' && r.method === 'ABILITY') {
    f.form = 'HUMAN'; f.host = 'SELF'; f.flag = 'TABLE';
    ctx.note('本次附身实际被排斥', '你已经转为怨魂尝试进入原诺兰，但本次附身没有维持住，被排斥后实际在ROOM重新显形为HUMAN/SELF。原旗仍在TABLE，没有举旗、记忆读取或伤害；3灵性与行动照耗。本次试验联系仍待当面确认停止，不能替换成人或同周重试。');
  }
  ctx.note(p.title, '本次核对失败，尚无可报告结果。已经发生的去程、普通举旗或原纸书写不撤销，附身失败则保留实际被排斥的事实；先0行动实际收束，下一真实周再准备同一原现场与原本人。' + practiceText(s));
}

export function wraithActions(s: SliceState): WraithAction[] {
  if (!active(s)) return [];
  const out: WraithAction[] = [], m = s.wraith;
  const add = (id: string, label: string, cost: string, command: WraithActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (m.moon.pendingWeek !== null && !contactOpen(s)) {
    add('wraith-moon-guarded', '请原哈伦当面守望，实际度过极度虚弱', '0行动 · 至多10精神 · 实际等待 · 不治疗或成长', { type: 'HANDLE_MOON', method: 'GUARDED' });
    add('wraith-moon-alone', '留在当前地点独自度过极度虚弱', '0行动 · 至多20精神 · 实际等待 · 不治疗或成长', { type: 'HANDLE_MOON', method: 'ALONE' }); return out;
  }
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'reflected-room' ? r.method === 'ABILITY' ? '沿同两面原镜实际返回、显形并盖好' : '沿原四米侧廊实际走回并盖好原镜' : p.id === 'willing-signal' ? m.practice.host === 'NOLAN' ? '实际退出原诺兰、显形并放回原旗' : '当面停止本次试验并收妥原旗' : '本人亲手交付同一张原记录纸', '0行动 · 0额外灵性 · 已付有限收束 · 不退款', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、原本人和有限边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.ability !== null) add(`${p.id}-ability`, p.id === 'reflected-room' ? '准备同两面原镜的有限去回' : '征得原诺兰这一次举旗试验同意', '1行动 · 尚未施法 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'reflected-room' ? '准备原四米侧廊的普通步行' : p.id === 'willing-signal' ? '准备普通请求诺兰自愿举旗' : '准备在同一张原纸普通书写', '1行动 · 实施0灵性 · 知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识14 · 含有限返回或退出' : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备与本次同意', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已收束的真实有限结果', '1行动 · 先实际返回、退出或亲手交付', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('wraith-reflect', '回看原端点、本人意愿与实际退出', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('wraith-encounter-talk', '到原工坊外院向贝文当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('wraith-encounter-fight', '到原工坊外院承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}

export function wraithCases(s: SliceState): WraithProjection['cases'] {
  if (!active(s)&&!(s.progression.pathwayId==='chained'&&(s.progression.sequence===4||s.progression.sequence===3))) return [];
  return CASES.map(p => {
    const r = s.wraith.cases[p.id]!;
    const closed = r.attemptWeek !== null && !r.contactOpen ? '本次已经实际返回、退出或亲手交付，原接触已结束。' : '';
    let result: string | null = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p.id) : r.attemptWeek !== null ? p.id === 'willing-signal' && r.method === 'ABILITY' ? '本次付费附身实际被排斥，已经在ROOM显形为HUMAN/SELF，原旗仍在TABLE；没有成功举旗。' : '上次核对没有形成可报告结果，实际去程、普通举旗或原纸文字与成本保留。' : r.withdrawals ? '尚未实施的准备与本次同意已取消，没有新的移动或施法。' : null;
    if (result !== null) result += closed + (r.contactOpen ? '本次接触仍在，须0行动实际收束。' : '') + practiceText(s);
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次真实接触尚未结束，须0行动返回、退出或亲手交付' : '没有尚未收束的本次接触', closes: r.closes };
  });
}
export function wraithPractice(s: SliceState): WraithProjection['practice'] { return { ...s.wraith.practice }; }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Exact original endpoints, one body/host, original props, paid attempts and non-stacking moon episodes. */
export function validateWraithLife(s: SliceState): boolean {
  const m = s.wraith;
  if (!record(m) || !record(m.cases) || !shape(m.cases, WRAITH_CASE_IDS) || !record(m.practice) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promotion = m.promotionWeek ?? s.week;
  if (!shape(f, ['form', 'node', 'mirror', 'host', 'flag', 'note']) || !['HUMAN', 'WRAITH'].includes(f.form) || !['ROOM', 'ALCOVE'].includes(f.node) || !['COVERED', 'OPEN'].includes(f.mirror) || !['SELF', 'NOLAN'].includes(f.host) || !['TABLE', 'RAISED'].includes(f.flag) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note)) return false;
  if (!record(m.moon) || !shape(m.moon, ['pendingWeek', 'history']) || !Array.isArray(m.moon.history) || !record(s.werewolf) || !record(s.werewolf.moon) || !Array.isArray(s.werewolf.moon.history) || !record(s.zombie) || !record(s.zombie.moon) || !Array.isArray(s.zombie.moon.history)) return false;
  const oldMoon = [...s.werewolf.moon.history, ...s.zombie.moon.history];
  if (oldMoon.some(entry => !record(entry) || !integer(entry.week, 1, s.week))) return false;
  const weeks = new Set<number>(); let lastMoonWeek = 0;
  for (const entry of m.moon.history) {
    if (!record(entry) || !shape(entry, ['week', 'method', 'mentalCost']) || !integer(entry.week, promotion, s.week) || !WEREWOLF_MOON_EVENTS.some(event => event.week === entry.week) || weeks.has(entry.week) || entry.week <= lastMoonWeek || oldMoon.some(old => old.week === entry.week)) return false;
    if (!['GUARDED', 'ALONE'].includes(entry.method) || !integer(entry.mentalCost, 0, entry.method === 'GUARDED' ? 10 : 20)) return false;
    weeks.add(entry.week); lastMoonWeek = entry.week;
  }
  if (m.moon.pendingWeek !== null && (!active(s) || m.moon.pendingWeek !== s.week || !integer(m.moon.pendingWeek, promotion, s.week) || !WEREWOLF_MOON_EVENTS.some(event => event.week === m.moon.pendingWeek) || weeks.has(m.moon.pendingWeek) || oldMoon.some(old => old.week === m.moon.pendingWeek) || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.health <= 0)) return false;
  if (active(s) && (s.werewolf.moon.pendingWeek !== null || s.zombie.moon.pendingWeek !== null)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week) || p.id === 'honest-account' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(source => source === `wraith-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.status === 'OBSERVED' && r.method !== null)) return false;
    if (r.attemptWeek !== null && (!r.contactOpen && r.closes < 1 || r.closes + (r.contactOpen ? 1 : 0) > r.attemptWeek - promotion + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!active(s) || !['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.moon.pendingWeek !== null) return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (m.promotionWeek === null && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const mirror = m.cases['reflected-room']!, signal = m.cases['willing-signal']!, note = m.cases['honest-account']!;
  const possessed = signal.contactOpen && signal.method === 'ABILITY' && signal.status === 'EXAMINED';
  if (f.node !== (mirror.contactOpen ? 'ALCOVE' : 'ROOM') || f.mirror !== (mirror.contactOpen ? 'OPEN' : 'COVERED')) return false;
  if (f.form !== (mirror.contactOpen && mirror.method === 'ABILITY' || possessed ? 'WRAITH' : 'HUMAN') || f.host !== (possessed ? 'NOLAN' : 'SELF')) return false;
  if (f.flag !== (signal.contactOpen && (signal.method === 'ORDINARY' || possessed) ? 'RAISED' : 'TABLE')) return false;
  if (f.note !== (note.contactOpen ? 'WRITTEN' : note.attemptWeek !== null ? 'HANDED_OVER' : 'BLANK')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(source => source === 'wraith-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId==='chained' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)) && ((s.progression.sequence===4||s.progression.sequence===3)?s.puppet.wraithActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && (m.moon.pendingWeek !== null || m.moon.history.length !== 0 || m.reflected)) return false;
  return true;
}
