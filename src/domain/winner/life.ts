import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyWinnerEncounter, blockWinnerEncounter, WINNER_ENCOUNTER_STORY } from './encounter.js';
import { validateWinnerCommand } from './index.js';
import { WINNER_CASE_IDS, type WinnerCommand, type WinnerActivityCommand, type WinnerAction, type WinnerProjection } from './types.js';

const CASES = [
  {
    id: 'falling-counter', title: '原软盘上方的同一枚木筹',
    story: '贝克兰德原报时铺指导室里，原创成年导师艾妲·芬恩拿着自己的轻质原木筹WN5-COUNTER-1。原低桌上的同一只软接物盘已经就位，桌边净空，落点下方没有人、食物或其它物品；只有艾妲在这一次有限试验中松手。',
    facts: ['同一枚原木筹、原软盘、原低桌与艾妲本人确实在场，木筹仍归艾妲。', '能力只短暂调动自己已经实际积累的好运，帮助这次接稳原木筹；普通方法使用同一原软盘实际承接。', '能力知识9是从本场未获好运帮助的知识14降低5难度的G帮助，通常提高10个百分点，仍受普通判定上下限限制；只判一次，不改骰、不重抽或保证接稳。'],
    ability: '准备本次短暂自身好运：实施1行动、2灵性、1份已有幸运，知识9（本场原难度14，G帮助降低5）；失败照付。原木筹仍会落到原软盘，随后须0行动亲手交还艾妲。',
    ordinary: '准备以同一原软接物盘普通承接原木筹并核对；实施1行动、0灵性、0幸运、知识12。原木筹留在手边或原盘，随后须0行动实际交还。',
    outcome: 'COUNTER_CHECKED',
  },
  {
    id: 'willing-aim', title: '塞拉自愿的一次原环投准',
    story: '原创成年塞拉Sella本人在原指导室，明确同意这一次可以停止的有限厄运投准试验，或普通观察对照。她使用自己同一枚原环WN5-RING-1，向原软垫上方的低木桩投准一次；旁人清空，没有活物处在投掷路径上。',
    facts: ['许可只限本次一次安全投准，不授权其它行为、后续控制或伤害；塞拉仍是独立的原成年人。', '能力只试着让这一次原环投准受到有限厄运影响，可失败；普通方法只观察本人真实投准与记录，不令她自动失手。', '一次投准后，同一原环实际在原软垫MAT；结束由塞拉本人亲手取回原环，本次有限试验到此结束，不宣称清除其它诅咒。'],
    ability: '核实塞拉本人当下同意，准备一次有限厄运：实施1行动、2灵性、1份已有幸运、知识14，可失败且失败照付；仅核对这次投准，随后0行动由本人实际取回原环并结束。',
    ordinary: '准备普通观察塞拉同意的一次实际原环投准与记录；实施1行动、0灵性、0幸运、知识10。记录实际所见，不从普通观察虚构她必定失手。',
    outcome: 'AIM_CHECKED',
  },
  {
    id: 'honest-account', title: '同一张有限记录的亲手交付',
    story: '艾妲在原指导室保留同一张原记录纸WN5-NOTE-1。你只整理已经真实发生的积累与支出、原木筹的落点、塞拉本次投准、成功或失败以及原物归还；不凭文字制造未知事实或额外幸运。',
    facts: ['只写已经发生的有限事实；普通方法不能写成施法，能力失败不能写成成功。', '实施时艾妲本人递来同一张WN5-NOTE-1，失败也留下实际文字；重试在同一张原纸保留并更正旧文字。', '结束时你亲手把同一原纸交给艾妲，由她当面收妥，没有复制、远程转移或赠送新纸。'],
    ability: null,
    ordinary: '准备在同一张WN5-NOTE-1上普通书写；实施1行动、0灵性、0幸运、知识10，之后0行动亲手交付已写原纸。',
    outcome: 'ACCOUNT_CHECKED',
  },
] as const;

const active = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 5;
const contactOpen = (s: SliceState) => Object.values(s.winner.cases).some(r => r.contactOpen);
const physicalContact = (s: SliceState) => s.winner.practice.counter !== 'GUIDE' || s.winner.practice.ring !== 'OWNER' || s.winner.practice.note === 'WRITTEN';
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
export const winnerInside = (s: SliceState) => contactOpen(s) || physicalContact(s);
export const isWinnerActivity = (c: WinnerCommand): c is WinnerActivityCommand => typeof c === 'object' && c !== null &&
  ['ACCUMULATE', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

export const WINNER_ENVIRONMENT = '以下现场与全部数值是原创G：幸运从0开始，在艾妲原指导室实际度过一段平静节制时间才积累1份；每真实周至多一次，1行动、0灵性，上限3，不恢复健康、精神或灵性。每次能力实践1行动、2灵性、1份已有幸运；失败照付，不能重抽、保证成功或借空储备施法。原木筹能力知识9（原难度14，G降低5，通常+10个百分点且受普通判定上下限限制），普通知识12；原塞拉有限厄运知识14，普通观察知识10；同一原纸只允许普通知识10。观察、准备、报告各1行动。最后1行动或0灵性仍可0行动亲手归还同一原木筹、由本人取回同一原环或亲手交付已写原纸；不退款、不治疗，不宣称全局诅咒消除。三份真实报告各G扮演25，只有前两项真实成功的能力报告各得已有知识池单项掌握8，普通方法不伪造掌握，反思25。全普通和平100有实际成本，不自动积满幸运，不保证原著无风险消化，不取得序列4或混合封印物能力。' + WINNER_ENCOUNTER_STORY;

function closeBlock(s: SliceState, caseId: string): string | null {
  const m = s.winner, f = m.practice, r = m.cases[caseId];
  if (!r?.contactOpen || r.attemptWeek !== s.week || r.method === null || !['OBSERVED', 'EXAMINED'].includes(r.status)) return '没有尚待实际结束的本次接触。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '须在原指导室的同一实际接触里归还原物。';
  if (caseId === 'falling-counter') return f.counter === (r.status === 'EXAMINED' ? 'CAUGHT' : 'TRAY') && f.ring === 'OWNER' && f.note === 'BLANK' ? null : '须有本次真实接稳或落在原软盘的同一原木筹，才能实际交还艾妲。';
  if (caseId === 'willing-aim') return f.counter === 'GUIDE' && f.ring === 'MAT' && f.note === 'BLANK' ? null : '须有本次实际投到原软垫的同一原环，由塞拉本人取回。';
  return f.counter === 'GUIDE' && f.ring === 'OWNER' && f.note === 'WRITTEN' ? null : '须先实际写过并持有同一张原纸，才能亲手交付。';
}

function blocked(s: SliceState, c: WinnerActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockWinnerEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成赢家晋升。';
  const m = s.winner, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return closeBlock(s, c.caseId);
  if (winnerInside(s)) return '先0行动实际交还同一原木筹、由塞拉取回同一原环，或亲手交付同一已写原纸。';
  if (Object.values(s.calamityPriest.cases).some(value => value.contactOpen) || Object.values(s.lucky.cases).some(value => value.contactOpen) || Object.values(s.machine.cases).some(value => value.contactOpen) || Object.values(s.monster.cases).some(value => value.contactOpen)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德艾妲的原报时铺指导室。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次行动需要1行动。';
  const prepared = Object.entries(m.cases).find(([, value]) => value.status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared[0])) return '先实施或取消当前尚未实施的准备。';
  if (c.type === 'ACCUMULATE') return m.luck.stored >= 3 ? '当前幸运已达3份上限，不能追加。' : m.luck.lastAccumulateWeek === s.week ? '本真实周已经实际积累过，下一真实周才可再次积累。' : null;
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这组经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本次边界。' : r.attemptWeek === s.week ? '本周实践已发生，下一真实周再准备同一原现场。' : c.caseId === 'honest-account' && c.method === 'ABILITY' ? '有限记录只能普通书写，不能把文字变成新能力。' : c.method === 'ABILITY' && m.luck.stored < 1 ? '能力实践需要1份已有幸运；可先实际积累，若本周已积累则等下一真实周，或现在选择普通方法。' : null;
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' || r.outcome === 'NONE' ? '先取得真实结果，并实际归还原物结束接触。' : null;
  if (r.status !== 'PREPARED') return '先准备本次有限方法。';
  if (r.method === 'ABILITY' && m.luck.stored < 1) return '本次能力需要1份已有幸运，不能透支；可0行动取消准备再积累或改用普通方法。';
  return r.method === 'ABILITY' && s.spirituality < 2 ? '本次能力需要2灵性，不能透支；可0行动取消准备后选择普通方法。' : null;
}

function practiceText(s: SliceState): string {
  const f = s.winner.practice, luck = s.winner.luck;
  return `同一原木筹WN5-COUNTER-1为${f.counter}，塞拉自己的原环WN5-RING-1为${f.ring}，同一原纸WN5-NOTE-1为${f.note}；原物所有权不变。幸运${luck.stored}/3，累计实际积累${luck.accumulated}、实耗${luck.spent}，最近积累${luck.lastAccumulateWeek === null ? '尚无' : `第${luck.lastAccumulateWeek}周`}。`;
}
function resultText(s: SliceState, id: string): string {
  const r = s.winner.cases[id]!;
  if (id === 'falling-counter') return r.method === 'ABILITY' ? '你实付本次短暂自身好运，在艾妲放开同一枚WN5-COUNTER-1时实际接稳并核对；这次普通判定成功，不代表重抽或以后必胜。' : '你借同一原软接物盘普通接稳并核对同一枚WN5-COUNTER-1，没有动用幸运或虚构能力效果。';
  if (id === 'willing-aim') return r.method === 'ABILITY' ? '塞拉同意的一次原环投准实际偏离低桩，有限厄运只在这次尝试形成可辨结果；同一原环落在原软垫，不能延伸成以后控制。' : '你核对并记录塞拉本人自愿的一次实际原环投准；同一原环落在原软垫，普通观察没有使她自动失手或施加厄运。';
  return '你在同一张WN5-NOTE-1上普通写下实际积累、支出、原物操作、本人同意与成功或失败，不补写未知事实或生成幸运。';
}

export function applyWinnerActivity(s: SliceState, c: WinnerActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateWinnerCommand(c) || !isWinnerActivity(c)) throw new Error('赢家活动命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyWinnerEncounter(s, c, ctx); return; }
  const m = s.winner, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let closure: string;
    if (c.caseId === 'falling-counter') {
      closure = f.counter === 'CAUGHT' ? '你把已经接稳的同一枚WN5-COUNTER-1亲手交回原艾妲，由她当面接住。' : '你从同一原软接物盘实际取出这次落下的同一枚WN5-COUNTER-1，亲手交回原艾妲，由她当面接住。';
      f.counter = 'GUIDE';
    } else if (c.caseId === 'willing-aim') {
      f.ring = 'OWNER';
      closure = '你实际停止这次有限尝试，塞拉本人走到原软垫，亲手取回自己的同一枚WN5-RING-1；本次一次投准及有限同意已经结束，不追加投掷或控制，也不宣称清除她的其它厄运或全局诅咒。';
    } else {
      f.note = 'HANDED_OVER';
      closure = '你亲手把已经写过的同一张WN5-NOTE-1实际交给原艾妲，由她当面接住收妥；失败文字也保留，不复制、远程转移或赠送新纸。';
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('原物实际收束', '0行动、0额外灵性、0幸运。' + closure + '本次收束时间已经预付，真实结果与已付成本保留，不退款、不治疗、不奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消尚未实施的方案；艾妲仍持有原木筹，塞拉仍持有自己的原环，尚未新增书写或施法。本次尚未实施的有限同意同时结束，原观察与已付准备行动保留，不退款、不积累幸运。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'ACCUMULATE') {
    m.luck.stored += 1; m.luck.accumulated += 1; m.luck.lastAccumulateWeek = s.week;
    ctx.note('实际节制并积累一份幸运', `第${s.week}周，你在贝克兰德艾妲的原报时铺指导室实际度过一段平静、节制的时间，暂不调动好运，支付1行动、0灵性，实际积累1份幸运。${practiceText(s)}本真实周不能再次积累；这不是普通休养，不恢复健康、精神或灵性，不生成他人的幸运或通用等量厄运债务。`); return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('winner-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看节制、有限幸运与真实归还', '实际积累与消耗、原木筹落点、塞拉这一次有限同意、实际投准结果和同一原纸交付分别有据。G扮演+25；全普通和平100有实际成本，不伪造能力掌握、不自动补满幸运，不保证原著无风险消化，也没有序列4或混合封印物的能力。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability! : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `winner-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(s, p.id) + '同一原物已经实际归还或亲手交付，本次接触已结束。G扮演+25；' + (r.method === 'ABILITY' ? '真实成功的能力报告给予一次已有知识池单项掌握8。' : '普通方法没有施法，不增加能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 2; m.luck.stored -= 1; m.luck.spent += 1;
    ctx.note('本次有限能力已经实付', '实际消耗2灵性与1份已有幸运。' + (p.id === 'falling-counter' ? '这次只短暂帮助自身接筹，原难度14降为知识9是G帮助，不是改骰、重抽或保证成功。' : '这次只对塞拉本人同意的一次原环投准尝试有限厄运，可失败，不控制意愿或伤害本人。') + '失败照付，收束不返还幸运。');
  }
  if (p.id === 'falling-counter') {
    f.counter = 'TRAY';
    ctx.note('同一原木筹实际落下', '艾妲在原低桌上方松开同一枚轻质WN5-COUNTER-1；原软盘实际位于下方，周围净空，没有人或食物在落点下。若未接稳，原筹实际留在原软盘，不销毁或补造原物。');
  } else if (p.id === 'willing-aim') {
    f.ring = 'MAT';
    ctx.note('原塞拉实际完成一次投准', '塞拉本人按本次明确同意，以自己的同一枚WN5-RING-1向原低桩投准一次，同一原环实际落在下方原软垫MAT。' + (r.method === 'ORDINARY' ? '普通观察不令她自动失手，只核对实际所见。' : '本次有限厄运是否形成可辨效果仍须一次真实判定，失败不虚构控制。') + '无论核对成败，都须由她本人实际取回原环。');
  } else {
    const retry = f.note === 'HANDED_OVER'; f.note = 'WRITTEN';
    ctx.note('同一原纸已经实际书写', '艾妲亲手递来同一张WN5-NOTE-1，你接过并普通书写已经实际发生的有限事实。' + (retry ? '之前的失败文字保留，在同一张原纸上核对和更正。' : '没有复制、新造或取得原纸的所有权。') + '核对失败也保留文字，须亲手交付。');
  }
  const difficulty = p.id === 'falling-counter' ? r.method === 'ABILITY' ? 9 : 12 : r.method === 'ABILITY' ? 14 : 10;
  const result = ctx.check('knowledge', difficulty);
  if (success(result.tier)) {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'falling-counter') f.counter = 'CAUGHT';
    ctx.note(p.title, resultText(s, p.id) + '本次接触仍在，先0行动实际收束才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, '本次未形成可报告结果，实际行动与已经支付的灵性、幸运不返还。' + (p.id === 'falling-counter' ? '同一原木筹实际留在原软盘TRAY，未接稳，不重抽。' : p.id === 'willing-aim' ? '同一原环仍实际在原软垫MAT，没有可报告的能力效果或完整普通观察，不虚构她失手或受到持续控制。' : '同一原纸已经写过，失败文字实际保留。') + '先0行动实际归还或交付原物，下一真实周再准备。' + practiceText(s));
}

export function winnerActions(s: SliceState): WinnerAction[] {
  if (!active(s)) return [];
  const out: WinnerAction[] = [], m = s.winner;
  const add = (id: string, label: string, cost: string, command: WinnerActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('winner-accumulate', '在原指导室实际节制并积累幸运', '1行动 · 0灵性 · 本真实周至多1份 · 上限3 · 不治疗', { type: 'ACCUMULATE' });
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'falling-counter' ? '亲手把同一原木筹实际交还艾妲' : p.id === 'willing-aim' ? '由塞拉本人实际取回原环并结束试验' : '亲手把同一已写原纸交给艾妲', '0行动 · 0额外灵性 · 0幸运 · 实际原物收束', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、原本人和有限边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.ability !== null) add(`${p.id}-ability`, p.id === 'falling-counter' ? '准备本次短暂自身好运接筹' : '核实塞拉本人同意并准备一次有限厄运', `1行动 · 尚未施法 · 实施另2灵性+1幸运 · 知识${p.id === 'falling-counter' ? '9（原14）' : '14'}`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'falling-counter' ? '准备同一原软盘普通承接' : p.id === 'willing-aim' ? '准备普通观察塞拉一次实际投准' : '准备同一张原纸普通书写', `1行动 · 实施0灵性、0幸运 · 知识${p.id === 'falling-counter' ? 12 : 10}`, { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限实践', r.method === 'ABILITY' ? `1行动 · 2灵性 · 1幸运 · 知识${p.id === 'falling-counter' ? '9（原14，G帮助）' : 14} · 失败照付` : `1行动 · 0灵性 · 0幸运 · 知识${p.id === 'falling-counter' ? 12 : 10}`, { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备与本次同意', '0行动 · 不退已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已归还原物的真实有限结果', '1行动 · 先实际归还或亲手交付 · G扮演+25', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('winner-reflect', '回看节制、有限幸运与实际归还', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('winner-encounter-talk', '到原报时铺外院向奥德里当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('winner-encounter-fight', '到原报时铺外院承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function winnerCases(s: SliceState): WinnerProjection['cases'] {
  if (!active(s)&&!(s.progression.pathwayId==='wheel'&&(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) return [];
  return CASES.map(p => {
    const r = s.winner.cases[p.id]!;
    const closed = r.attemptWeek !== null && !r.contactOpen ? '本次原木筹、原环已经实际归还，或已写原纸已经亲手交付；接触已结束。' : '';
    let result: string | null = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(s, p.id) : r.attemptWeek !== null ? '上次没有取得可报告结果；同一原木筹落盘、原环到垫或原纸文字实际保留，已付成本不退。' : r.withdrawals ? '尚未实施的准备与本次有限同意已取消，没有施法或消耗幸运。' : null;
    if (result !== null) result += closed + (r.contactOpen ? '本次接触仍在，须0行动实际收束。' : '') + practiceText(s);
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次真实接触尚未结束，须0行动实际归还或交付原物' : '没有尚未收束的本次接触', closes: r.closes };
  });
}
export function winnerPractice(s: SliceState): WinnerProjection['practice'] { return { ...s.winner.practice }; }

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Finite accumulated luck, original objects, paid attempts and actual handbacks. */
export function validateWinnerLife(s: SliceState): boolean {
  const m = s.winner;
  if (!record(m) || !record(m.cases) || !shape(m.cases, WINNER_CASE_IDS) || !record(m.practice) || !record(m.luck) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, luck = m.luck, promotion = m.promotionWeek ?? s.week;
  if (!shape(f, ['counter', 'ring', 'note']) || !['GUIDE', 'TRAY', 'CAUGHT'].includes(f.counter) || !['OWNER', 'MAT'].includes(f.ring) || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note)) return false;
  if (!shape(luck, ['stored', 'lastAccumulateWeek', 'accumulated', 'spent']) || !integer(luck.stored, 0, 3) || !integer(luck.accumulated, 0) || !integer(luck.spent, 0, luck.accumulated) || luck.stored !== luck.accumulated - luck.spent) return false;
  if (luck.accumulated === 0 ? luck.lastAccumulateWeek !== null : luck.lastAccumulateWeek === null || !integer(luck.lastAccumulateWeek, promotion, s.week) || luck.accumulated > luck.lastAccumulateWeek - promotion + 1) return false;
  if (m.promotionWeek === null && (luck.stored !== 0 || luck.accumulated !== 0 || luck.spent !== 0 || luck.lastAccumulateWeek !== null)) return false;
  let open = 0, prepared = 0, resolved = 0, knownAbilityAttempts = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - promotion + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, promotion, s.week) || p.id === 'honest-account' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(source => source === `winner-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.status === 'OBSERVED' && r.method !== null)) return false;
    if (r.attemptWeek !== null && (!r.contactOpen && r.closes < 1 || r.closes + (r.contactOpen ? 1 : 0) > r.attemptWeek - promotion + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.attemptWeek !== null && r.method === 'ABILITY' && r.status !== 'PREPARED') knownAbilityAttempts += 1;
    if (r.contactOpen) {
      open += 1;
      if (!active(s) || !['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (m.promotionWeek === null && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared || luck.spent < knownAbilityAttempts) return false;
  const counter = m.cases['falling-counter']!, ring = m.cases['willing-aim']!, note = m.cases['honest-account']!;
  if (f.counter !== (counter.contactOpen ? counter.status === 'EXAMINED' ? 'CAUGHT' : 'TRAY' : 'GUIDE')) return false;
  if (f.ring !== (ring.contactOpen ? 'MAT' : 'OWNER')) return false;
  if (f.note !== (note.contactOpen ? 'WRITTEN' : note.attemptWeek !== null ? 'HANDED_OVER' : 'BLANK')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(source => source === 'winner-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId==='wheel' && (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) && ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.misfortuneMage.winnerActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  if (m.promotionWeek === null && m.reflected) return false;
  return true;
}
