import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyRecorderActivity, recorderActions } from '../recorder/life.js';
import { RECORDER_SAMPLE_IDS, type RecorderSampleId } from '../recorder/types.js';
import { applyTravelerEncounter, blockTravelerEncounter, TRAVELER_ENCOUNTER_STORY } from './encounter.js';
import { TRAVELER_CASE_IDS, type TravelerCaseId, type TravelerCommand, type TravelerActivityCommand, type TravelerAction, type TravelerProjection } from './types.js';

const CASES = [
  {
    id: 'known-landing', title: '亲自确认过的六米落点',
    story: '贝克兰德原教学室旁有一段净空普通走廊，入口与六米外原平台相互可见。原序列8戏法大师诺拉·维恩仍只负责原场地与记录教学；她没有因你的晋升变成旅行家。你先亲自步行核对平台和普通返程，再尝试自己的有限旅行。（原创G）',
    facts: ['观察花1行动，原身体沿普通走廊实际步行六米到原平台、检查落脚处，再沿原路走回入口；此后准备不移动身体。', '能力实施花1行动、3灵性，知识14；成功才让原身体经灵界实际抵达同一个六米平台，失败留在入口且成本保留。', '普通实施花1行动、0灵性，先本人实际步行六米到平台，再作知识10核对；核对失败也不会把身体移回入口。', '关闭是0行动沿已确认的普通走廊实际步行六米返回入口；没有免费返程施法，也不据此保证穿过一切封锁。'],
    ability: '准备凭已亲自确认的原平台定位；实施3灵性、知识14，成功才让原身体经灵界实际旅行六米，另以已知普通走廊步行返回。',
    ordinary: '准备普通步行六米到原平台并核对落点；实施0灵性、知识10，身体真实抵达后核对失败也须普通步行返回。',
    abilityResult: '你支付3灵性，让自己的原身体经灵界实际抵达亲自确认过的六米原平台，完成有限定位；没有创造新身体、复制落点或取得任意世界目的地。',
    ordinaryResult: '你的原身体沿原普通走廊实际步行六米到平台，核对了同一落脚处与原返程路线；没有使用旅行能力。',
    outcome: 'LANDING_CHECKED', spirit: 3, difficulty: 14,
  },
  {
    id: 'offered-card', title: '两米外同一张获准木卡',
    story: '诺拉本人把自己所有的唯一木制图卡TR5-CARD-1放在入口两米外可见、未上锁的原桌上，明确允许你取来核对并亲手放回。这是本次新原物，不是旧示范或能力记录；卡片始终归诺拉。（原创G）',
    facts: ['原桌与入口之间有净空普通两米路径；卡片完全可见，没有不透明容器、封闭墙面或未知保管人。', '能力实施1行动、2灵性、知识14，无形之手成功才实际拿到同一张TR5-CARD-1；原身体留在入口，失败卡片仍在原桌。', '普通实施先本人步行两米到原桌，亲手拿起同一张卡，再走回入口；之后知识10核对失败也保留真实取卡。', '关闭时本人携原卡沿普通路径步行两米、亲手放回同一原桌并走回入口；卡片不复制、不遥距归还，也不成为奖励。'],
    ability: '准备以无形之手实际取来两米外原桌上同一张获准木卡；实施2灵性、知识14，成功才取到，原身体仍在入口。',
    ordinary: '准备本人实际步行两米，亲手取同一张木卡后走回入口；实施0灵性、知识10，核对失败不撤销已经发生的取卡。',
    abilityResult: '无形之手沿可见的净空两米距离实际取来唯一TR5-CARD-1，交到入口的你手中；原桌已没有这张卡，所有权仍属诺拉，没有穿墙取物或复制原件。',
    ordinaryResult: '你实际步行两米到原桌，亲手拿起同一张TR5-CARD-1，再沿普通路径走回入口并完成核对；没有施放无形之手。',
    outcome: 'CARD_TAKEN', spirit: 2, difficulty: 14,
  },
  {
    id: 'willing-companion', title: '米拉本人同意的一次同行',
    story: '同一位原创成年场务米拉已独立来到原教学室入口。她只愿讨论一次入口至六米原平台的短途同行，结束后两人沿原普通走廊实际走回；她不是晋升赠送的乘客，也没有在你请求时被搬来。（原创G）',
    facts: ['观察只当面核对米拉本人、原平台和普通返程安排，不移动任何人，也不自动获得同意。', '准备花1行动当面明确方法：米拉本人答应这一次有限六米旅行或普通同行；此时两人仍在入口。', '能力实施1行动、5灵性、知识16，成功才把你和同一位自愿的米拉经灵界实际带到原平台，失败两人仍在入口；没有任意人数或重量保证。', '普通实施由两人实际步行六米到原平台，0灵性、知识10；核对失败仍保留两人的实际位置。', '关闭由两人沿原普通走廊实际步行六米回入口，并结束本次同意；未实施前可0行动取消准备与同意，不移动米拉。'],
    ability: '你当面说明一次六米灵界同行与随后普通步行返程；原米拉本人明确自愿答应，两人仍在入口。实施另5灵性、知识16，不把本次同意扩展到其他目的地或乘客。',
    ordinary: '你当面说明一次六米普通同行与原路步行返程；原米拉本人明确自愿答应，两人仍在入口。实施0灵性、知识10，没有任何人被传送。',
    abilityResult: '在米拉本人本次明确同意后，你支付5灵性，经灵界实际带着自己的原身体和同一位原米拉抵达六米平台；只完成这一段有限两人旅行，没有复制同伴或承诺任意携带。',
    ordinaryResult: '你与同一位明确同意的成年原米拉沿原普通走廊实际同行六米到平台，完成普通核对；没有施放旅行能力。',
    outcome: 'COMPANION_RETURNED', spirit: 5, difficulty: 16,
  },
] as const;
type Case = typeof CASES[number];

export const TRAVELER_ENVIRONMENT = '三项原创G实践分别核对原身体的六米旅行、两米外同一张获准木卡的无形之手取还，以及原米拉本人明确同意的一次两人六米同行。观察、准备、实施、报告各1行动；能力实施依次3灵性知识14、2灵性知识14、5灵性知识16，普通方法0灵性知识10。能力失败不移动原身体、原卡或米拉；普通核对前已完成的真实步行与取卡不因失败而撤销。成败都须0行动实际结束接触；在平台便普通步行返回，手持木卡便普通步行亲手归还，同行便两人一起走回并结束同意。取消未实施的准备0行动且不返成本。每案每真实周至多实施一次，实际收束后才能生活或换周；普通生活不生成旅程。三份报告各G扮演25，能力报告一次已有知识池单项掌握8，普通报告不伪造能力掌握；三案反思25，可全普通和平100。诺拉仍是原序列8教师，旧记录与实际示范保留；可继续付1行动亲访原教师实际示范FLASH或COURAGE，教师耗2灵性、你耗3灵性、知识14，成功才获得一份原记录；没有免费能力库存、隐秘空间、口袋空间或序列4放逐。所有人物、物件、距离、场地与数值为原创G。 ' + TRAVELER_ENCOUNTER_STORY;
export const travelerInside = (s: SliceState) => s.traveler.ritual.at !== 'HOME' || Object.values(s.traveler.cases).some(r => r.contactOpen) || s.traveler.practice.position !== 'ENTRY' || s.traveler.practice.card !== 'DESK' || s.traveler.practice.companionPosition !== 'ENTRY';
export const isTravelerActivity = (c: TravelerCommand): c is TravelerActivityCommand => ['RECORD_SAMPLE', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is TravelerActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (c.type === 'RECORD_SAMPLE') return shape(c, ['type', 'sample']) && RECORDER_SAMPLE_IDS.includes(c.sample as RecorderSampleId);
  if (!TRAVELER_CASE_IDS.includes(c.caseId as TravelerCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: TravelerActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 5) return '先完成旅行家晋升。';
  const m = s.traveler, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND' || m.ritual.at !== 'HOME') return '先真实返回贝克兰德原教学室，不能借实践收束从异地传回。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次接触。';
  if (travelerInside(s)) return '先0行动实际步行返回、亲手归还原卡并结束本次接触。';
  if (Object.values(s.recorder.cases).some(value => value.contactOpen) || Object.values(s.apprentice.cases).some(value => value.position === 'INSIDE')) return '先从原旧现场实际退出。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockTravelerEncounter(s, c);
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'RECORD_SAMPLE') {
    const action = recorderActions(s).find(action => action.command.type === 'RECORD' && action.command.sample === c.sample);
    return action ? action.reason : '原教师本次实际示范不可用。';
  }
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三段经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场、原物与实际返程安排已经核对。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际返回、归还原物和结束同意。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与有限同意。' : r.attemptWeek === s.week ? '本周实际尝试与成本保留，下一真实周再准备。' : null;
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才可重试。';
  if (c.caseId === 'willing-companion' && !m.practice.consent) return '米拉本人尚未明确同意本次有限同行。';
  const p = CASES.find(p => p.id === c.caseId)!;
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次能力需要${p.spirit}灵性；可0行动取消准备后休养或改用普通方法。` : null;
}
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const practiceText = (s: SliceState) => {
  const f = s.traveler.practice;
  return `你的原身体${f.position === 'ENTRY' ? '在原入口' : '仍在六米原平台，须普通步行返回'}；原TR5-CARD-1${f.card === 'DESK' ? '在诺拉原桌' : '仍在你手中，须本人亲手归还'}；原米拉${f.companionPosition === 'ENTRY' ? '在原入口' : '仍在六米原平台，须一同普通步行返回'}。实施实际抵达${f.journeys}次、收束步行返回${f.returns}次；同一原卡取来${f.cardTakes}次、亲手归还${f.cardReturns}次；原米拉实际同行抵达${f.companionTrips}次。${f.consent ? '米拉的同意仅限本次已准备的有限同行与普通返程。' : '没有尚在生效的本次同行同意。'}`;
};
/** Counters track performed trials; the observation's complete ordinary inspection is recorded in its text. */
function arrive(s: SliceState, p: Case): void {
  const f = s.traveler.practice;
  if (p.id === 'offered-card') { f.card = 'PLAYER'; f.cardTakes += 1; return; }
  f.position = 'LANDING'; f.journeys += 1;
  if (p.id === 'willing-companion') { f.companionPosition = 'LANDING'; f.companionTrips += 1; }
}
export function applyTravelerActivity(s: SliceState, c: TravelerActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('旅行家实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyTravelerEncounter(s, c, ctx); return; }
  if (c.type === 'RECORD_SAMPLE') { applyRecorderActivity(s, { type: 'RECORD', sample: c.sample }, ctx, award); return; }
  const m = s.traveler, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let movement = '本次能力未令原身体、原卡或原米拉离开原处，没有虚构返程或归还。';
    if (c.caseId === 'offered-card' && f.card === 'PLAYER') {
      f.card = 'DESK'; f.cardReturns += 1;
      movement = '你本人携同一张TR5-CARD-1沿普通路径步行两米到原桌，亲手将原卡放回，再步行两米回到入口。原桌重新有且只有这一张原卡，所有权仍属诺拉；没有遥距归还或复制。';
    } else if (f.position === 'LANDING') {
      const companion = c.caseId === 'willing-companion';
      f.position = 'ENTRY'; f.returns += 1;
      if (companion) f.companionPosition = 'ENTRY';
      movement = companion ? '你与同一位原米拉一起沿已经确认的原普通走廊实际步行六米返回入口，两具原身体真实回到出发处。没有免费返程传送，也没有把米拉留在平台。' : '你本人沿已经确认的原普通走廊实际步行六米返回入口，原身体真实回到出发处；没有免费返程传送。';
    }
    if (c.caseId === 'willing-companion') { f.consent = false; movement += '你与米拉当面结束这一次有限同行同意，不能把它延长为后续乘行权限。'; }
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际收束并完成普通返回', '0行动。' + movement + '本次接触已经结束；实际结果与已付行动、灵性保留，不返资源、不治疗、不奖励。' + practiceText(s)); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'willing-companion') f.consent = false;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察与此前实际结果、已付行动保留。两人的原身体仍在入口，原卡仍在原桌；若准备过同行，本次有限同意也已撤销。没有移动任何人或物，不返成本。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('traveler-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('辨认落点、原物与自愿同行的边界', '回看亲身确认的原落点、同一张获准木卡的真实取还，以及米拉本人本次明确同意和两人普通返程。G扮演+25；空间能力不复制原物，不替他人默认同意，也不保证突破所有封锁。普通方法同样完成这三段有限帮助。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + (p.id === 'known-landing' ? '本次观察中，你本人已经实际步行六米到平台核对，再沿同一普通走廊步行六米返回入口；这是观察去回，没有施法。' : '本次只在原入口当面核对原物来源或原米拉及返程计划，没有取卡、移动任何人或取得同行同意。')); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'willing-companion') f.consent = true;
    ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `traveler-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(p, r.method!) + '上述实施后已实际收束：原身体在入口，原木卡在原桌，米拉也在入口，本次同行同意已结束。G扮演+25；' + (r.method === 'ABILITY' ? '能力报告一次已有知识池单项掌握+8。' : '普通报告不伪造能力掌握。') + practiceText(s)); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit;
    ctx.note('付出本次有限能力成本', `${p.spirit}灵性已经实际支出；只有接下来的知识${p.difficulty}核对成功，原身体、同一原卡或明确同意的原米拉才实际抵达本次已知目标。失败成本保留，仍须明确结束本次接触。`);
  } else {
    arrive(s, p);
    ctx.note('普通去程已经真实完成', p.id === 'offered-card' ? '你本人已实际步行两米到原桌，亲手取同一张TR5-CARD-1，再走回入口。接下来的普通知识核对失败也不撤销真实取卡，仍须亲手归还。' : p.id === 'willing-companion' ? '你与明确同意的同一位原米拉已经沿原普通走廊实际同行六米到平台。核对失败也保留两人的真实位置，仍须一起普通步行返回。' : '你的原身体已经沿原普通走廊实际步行六米到平台。接下来的普通核对失败也保留真实位置，仍须普通步行返回。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? p.difficulty : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    if (r.method === 'ABILITY') arrive(s, p);
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, resultText(p, r.method!) + '本次接触仍未结束，须0行动实际返回或亲手归还后才能报告。' + practiceText(s)); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, '本次有限核对失败，尚不足以报告。' + (r.method === 'ABILITY' ? '能力没有完成移动；原身体和米拉仍在入口，原卡仍在原桌。' : '普通去程或取卡已真实发生，不因核对失败而撤销。') + '已付行动与灵性保留，先0行动实际收束，下一真实周再准备。' + practiceText(s));
}
export function travelerActions(s: SliceState): TravelerAction[] {
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 5) return [];
  const out: TravelerAction[] = [], m = s.traveler;
  const add = (id: string, label: string, cost: string, command: TravelerActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const action of recorderActions(s)) {
    if (action.command.type === 'RECORD') add('traveler-' + action.id, action.label, action.cost, { type: 'RECORD_SAMPLE', sample: action.command.sample });
  }
  for (const p of CASES) {
    const r = m.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', p.id === 'offered-card' ? '本人实际归还同一原卡并结束接触' : p.id === 'willing-companion' ? '两人实际普通返回并结束本次同意' : '本人实际普通返回并结束接触', '0行动 · 原普通路径 · 不返成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', p.id === 'known-landing' ? '本人步行去回，确认六米原落点' : '当面核对原物、本人及实际返程', '1行动 · 原身体最后在入口', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'offered-card' ? '准备无形之手取同一张获准木卡' : p.id === 'willing-companion' ? '当面征得米拉本次六米旅行同意' : '准备自己的原身体旅行六米', `1行动 · 实施另${p.spirit}灵性 · 知识${p.difficulty}`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'offered-card' ? '准备本人普通步行取卡' : p.id === 'willing-companion' ? '当面征得米拉本次普通同行同意' : '准备本人普通步行核对原平台', '1行动 · 实施0灵性 · 知识10', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', '实际进行这一次有限实践', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 知识${p.difficulty}` : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备与本次同意', '0行动 · 不移动人或原物 · 成本保留', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告实际结果与有限边界', '1行动 · 先实际返回与归还', { type: 'REPORT', caseId: p.id });
  }
  if (!m.reflected) add('traveler-reflect', '回看原落点、原物与自愿同行', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  if (m.encounter.status === 'AVAILABLE') {
    add('traveler-encounter-talk', '前往原空厅与贝兰当面澄清', '1行动 · 先完成一项报告', { type: 'ENCOUNTER_TALK' });
    add('traveler-encounter-fight', '前往原空厅并承担有限冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function travelerCases(s: SliceState): TravelerProjection['cases'] {
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 5) return [];
  return CASES.map(p => {
    const r = s.traveler.cases[p.id]!;
    const closure = r.attemptWeek !== null && !r.contactOpen ? '该次接触已经实际结束，需要的普通步行返回或亲手归还已完成。' : '';
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(p, r.method!) + closure + practiceText(s)
      : r.attemptWeek !== null ? `第${r.attemptWeek}周的实施核对失败；已发生的真实移动和成本保留。` + closure + practiceText(s)
        : r.withdrawals ? '尚未实施的准备与本次同行同意已取消，两人仍在入口、原卡仍在原桌；原观察与已付行动保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, practiceText(s)], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触仍未结束；原身体、原卡与米拉均依实际位置保留，须0行动真实收束' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function travelerPractice(s: SliceState): TravelerProjection['practice'] {
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 5 && (s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return null;
  const f = s.traveler.practice;
  return {
    position: f.position === 'ENTRY' ? '你的原身体在原教学室入口' : '你的原身体在六米原平台，须沿普通走廊实际返回',
    card: `唯一TR5-CARD-1 · ${f.card === 'DESK' ? '在诺拉原桌' : '在你手中，须本人普通步行亲手归还'} · 始终归原诺拉所有`,
    companion: `同一位成年原米拉 · ${f.companionPosition === 'ENTRY' ? '在原入口' : '在六米原平台，须两人一起普通步行返回'} · ${f.consent ? '仅明确同意本次有限同行与普通返程' : '没有当前同行同意'}`,
    history: [`实施实际抵达${f.journeys}次，实际普通返回${f.returns}次；观察中的完整步行核对另记在原案`, `同一原木卡实际取来${f.cardTakes}次、本人亲手归还${f.cardReturns}次`, `同一原米拉实际同行抵达${f.companionTrips}次；准备和请求不移动她`, '诺拉仍是原序列8教师；记录官原示范、记录、教师灵性与旧案例未由本次实践改写'],
  };
}

/** Validate real positions, one original card and this trip's actual limited consent. */
export function validateTravelerLife(s: SliceState): boolean {
  const m = s.traveler;
  if (!record(m) || !record(m.cases) || !shape(m.cases, TRAVELER_CASE_IDS) || !record(m.practice) || !record(m.ritual) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promoted = s.progression.pathwayId === 'door' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  if (!shape(f, ['position', 'card', 'companionPosition', 'consent', 'journeys', 'returns', 'cardTakes', 'cardReturns', 'companionTrips'])) return false;
  if (!['ENTRY', 'LANDING'].includes(f.position) || !['DESK', 'PLAYER'].includes(f.card) || !['ENTRY', 'LANDING'].includes(f.companionPosition) || typeof f.consent !== 'boolean') return false;
  if (![f.journeys, f.returns, f.cardTakes, f.cardReturns, f.companionTrips].every(x => integer(x, 0))) return false;
  if (f.journeys - f.returns !== (f.position === 'LANDING' ? 1 : 0) || f.cardTakes - f.cardReturns !== (f.card === 'PLAYER' ? 1 : 0) || f.companionTrips > f.journeys) return false;
  const firstWeek = m.promotionWeek ?? s.week, weeks = s.week - firstWeek + 1;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, weeks)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `traveler-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || m.ritual.at !== 'HOME' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
    }
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const landing = m.cases['known-landing']!, card = m.cases['offered-card']!, companion = m.cases['willing-companion']!;
  const trials = (r: typeof landing) => r.closes + (r.contactOpen ? 1 : 0);
  const latestMoved = (r: typeof landing) => r.attemptWeek !== null && r.status !== 'PREPARED' && (r.method === 'ORDINARY' || ['EXAMINED', 'RESOLVED'].includes(r.status));
  const landingTrips = f.journeys - f.companionTrips;
  if (landingTrips > trials(landing) || f.companionTrips > trials(companion) || f.cardTakes > trials(card)) return false;
  if (latestMoved(landing) && landingTrips < 1 || latestMoved(companion) && f.companionTrips < 1 || latestMoved(card) && f.cardTakes < 1) return false;
  if (f.position !== ((landing.contactOpen && latestMoved(landing) || companion.contactOpen && latestMoved(companion)) ? 'LANDING' : 'ENTRY')) return false;
  if (f.card !== (card.contactOpen && latestMoved(card) ? 'PLAYER' : 'DESK')) return false;
  if (f.companionPosition !== (companion.contactOpen && latestMoved(companion) ? 'LANDING' : 'ENTRY')) return false;
  if (f.consent !== (companion.status === 'PREPARED' || companion.contactOpen)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'traveler-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.position !== 'ENTRY' || f.card !== 'DESK' || f.companionPosition !== 'ENTRY' || f.consent || f.journeys || f.returns || f.cardTakes || f.cardReturns || f.companionTrips)) return false;
  if (promoted && ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.secretsSorcerer.travelerActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
