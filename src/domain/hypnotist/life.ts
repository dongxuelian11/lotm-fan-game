import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyHypnotistEncounter, blockHypnotistEncounter, HYPNOTIST_ENCOUNTER_STORY } from './encounter.js';
import { HYPNOTIST_CASE_IDS, type HypnotistCommand, type HypnotistActivityCommand, type HypnotistAction, type HypnotistProjection } from './types.js';

const REFUSAL = '成年保管员米菈明确拒绝原提议：“亲自看护这只受托原箱是我最重视的责任，我不会为了练习把注意移开。”这次拒绝真实发生，不骰成功，也未移动原箱。';
const NEW_FACT = '拒绝后本人说明的新公开事实：只接受你在旁边解释练习范围，自己始终看护原箱；若用能力，也只同意短时集中于眼前原箱标签，按已约定钟声停止。';
const REVISION = '下一真实周实际改用本人接受的旁观说明方案：不移开她对受托原箱的注意，不碰原箱，保留第一次拒绝；本次有限专注或普通说明仍须实际判定。';
const CASES = [
  { id: 'focused-reading', title: '只读眼前的一小段', story: '成年校对员诺拉在原会所自愿参加短时专注练习，只同意阅读眼前自己选择的一小段公开文字。她和你事先约定原壁钟响起即停止，随时说停也结束；不是接受治疗或交出秘密。（G）', facts: ['诺拉本人只同意这段短时阅读，公开原纸仍在她面前。', '先确认她实际把注意集中到这段文字；没有集中便不能当作非战斗催眠已经成立。', '已约定原壁钟响起或本人说停时结束；退出不会让同意自动延长。'], ability: '准备本人同意的有限专注练习；实施时实际确认注意集中，另耗3灵性。结果仍会被抵抗，不展示现实催眠步骤。', ordinary: '准备普通安静阅读与读后核对，不用精神影响，照常尊重原停止信号。', result: '诺拉完成并自行核对了这一小段阅读。按已约定的原壁钟停止，结果只涉及本次专注任务，没有取得秘密、制造供词或作出医疗保证。', outcome: 'FOCUS_VERIFIED', stat: 'will' },
  { id: 'protected-choice', title: '保管员不肯移开的目光', story: '成年保管员米菈坐在受托原箱旁，公开表示亲自看护是自己最重视的责任。你第一次提出把注意短暂转去旁边文字的练习时，她会拒绝；普通提议和能力准备都不能把她的拒绝当成待覆盖的数据，原箱始终不移动。（G）', facts: ['米菈最重视的保管责任已明确说出；她未同意移开对原箱的注意。', '危及生命或最珍视之物会激起强烈反抗，坚定心智亦可抵抗；本案不试图强迫突破她的边界。', '本人说停或原壁钟响起即结束接触中的练习。'], ability: '提出有限能力练习，实际实施另耗3灵性；原方案第一次会遭真实拒绝，不施加强迫、不抽成功骰、不碰原箱。', ordinary: '普通说明原提议，由本人决定；第一次同样真实拒绝，不移动任何物品。', result: '米菈自行接受的是改后的旁观说明与原箱标签的有限专注核对，原看护责任始终保留。练习按原信号停止，原箱和决定仍归本人，第一次拒绝不会被改写。', outcome: 'BOUNDARY_RESPECTED', stat: 'will' },
  { id: 'unnoticed-passage', title: '仍然占据空间的人', story: '成年观察员赛恩事先同意在原会所侧廊做一次观察比较。原椅、原墙与通道位置清楚可见；你需要绕开它们。心理学隐身只让他在认知上忽略你，身体仍占空间，不能穿墙或带走现场物品。（G）', facts: ['赛恩自愿参加这一次比较，原物原位，通路已在眼前确认。', '你本人讲话或大动静会破除心理学隐身；事先约定你说出“练习结束”便恢复公开接触。', '普通方法用平常走位作比较，效果不同也能形成有限报告。'], ability: '准备心理学隐身的认知忽略，实施另耗3灵性；实际绕开原椅和原墙，到位后你亲口说“练习结束”，当场破除。', ordinary: '准备普通走位比较，沿同一原通道绕开原物；结束时同样亲口说明，不声称产生隐身。', result: '完成原通道的有限走位比较后，你亲口说出“练习结束”；若采用心理学隐身，它也因这句话当场破除。原椅原墙仍在原处，身体没有穿越它们，赛恩恢复正常观察。', outcome: 'PASSAGE_COMPARED', stat: 'perception' },
] as const;
export const HYPNOTIST_ENVIRONMENT = '非战斗催眠需要真实注意集中，坚定心智可抵抗；触及生命或最珍视之物会激起强反抗。三项自愿练习均可普通完成，第二案真实拒绝后下一周改为本人接受的旁观说明。心理学隐身只认知忽略，本人讲话或大动静破除且实体仍碰撞；0行动实际结束所有本次精神影响并退离。每项报告G扮演+25、单项掌握+8，三案反思+25。没有全知供词、洗脑、医疗保证或序列5梦境能力。全部事件和数值为原创G。 ' + HYPNOTIST_ENCOUNTER_STORY;
export const hypnotistInside = (s: SliceState) => Object.values(s.hypnotist.cases).some(r => r.contactOpen);
export const isHypnotistActivity = (c: HypnotistCommand): c is HypnotistActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is HypnotistActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!HYPNOTIST_CASE_IDS.includes(c.caseId as typeof HYPNOTIST_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: HypnotistActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockHypnotistEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 6) return '先完成催眠师晋升。';
  const r = 'caseId' in c ? s.hypnotist.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次事项。';
  if (hypnotistInside(s)) return '先0行动结束本次接触并退出。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到原阅览室观察导师联络的贝克兰德会所。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.hypnotist.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.hypnotist.reflected ? '已经回看这段经历。' : CASES.some(p => s.hypnotist.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察与本人意愿已经保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对当前事实、本人同意范围与停止信号。' : r.attemptWeek === s.week ? '本周结果与拒绝保留，下周再依已核新事实重新准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  return r.method === 'ABILITY' && s.spirituality < 3 ? '本次能力实践需要3灵性；可取消准备后选择普通方法。' : null;
}
export function applyHypnotistActivity(s: SliceState, c: HypnotistActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('催眠师实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyHypnotistEncounter(s, c, ctx); return; }
  const m = s.hypnotist;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次事项并退出', '0行动实际停止本次全部精神影响、结束练习并退离现场；当事人自行恢复普通活动，不能持续控制。原纸、原箱与现场物品留在原处。已付成本、观察、本人拒绝和修订记录全部保留，不退灵性、不治疗、不重置意愿、不再抽奖。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消这次准备，原观察、已付行动、公开拒绝与修订依据仍保留。没有让对方重新同意。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('hypnotist-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('专注与忽略都有边界', '回看短时专注、最珍视的保管责任与认知忽略三段经历。G扮演+25；集中注意不等于交出决定，拒绝真实有效，讲话结束隐身后身体仍在原处。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'protected-choice' && r.notes.includes(REFUSAL) && !r.revised) { r.revised = true; r.notes.push(REVISION); ctx.note('实际改为本人接受的旁观说明', REVISION); }
    ctx.note(p.title, r.revised ? REVISION + (c.method === 'ABILITY' ? '本次只在她自愿集中于原箱标签时进行有限专注，另耗3灵性。' : '本次使用普通旁观说明与本人核对。') : c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`hypnotist-case:${p.id}`, 8);
    ctx.note(p.title, p.result + '本次事项已实际结束，G扮演+25、已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') { s.spirituality -= 3; ctx.note('有限能力的实际成本', '本次3灵性已经支出；本人意愿、注意范围与停止信号仍有效，不保证成功或绕过抵抗。'); }
  if (p.id === 'protected-choice' && !r.notes.includes(REFUSAL)) {
    r.status = 'OBSERVED'; r.notes.push(REFUSAL, NEW_FACT);
    ctx.note('米菈真实拒绝原提议', REFUSAL + ' ' + NEW_FACT + '本次不抽成功骰。先0行动结束接触，下周再修订，不能重按同一方案强迫接受。'); return;
  }
  if (r.method === 'ABILITY' && p.id !== 'unnoticed-passage') ctx.note('本人实际集中注意', p.id === 'focused-reading' ? '诺拉在本人允许的短时阅读范围内实际集中于眼前公开文字，原停止信号保留；随后才判定有限效果。' : '米菈在已接受的旁观说明中实际集中于自己看护的原箱标签；没有移开看护注意，原停止信号仍有效。');
  const result = ctx.check(r.method === 'ABILITY' ? p.stat : 'knowledge', r.method === 'ABILITY' ? 12 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') { r.status = 'EXAMINED'; r.outcome = p.outcome; ctx.note(p.title, p.result + '先0行动结束本次事项并退出。'); }
  else {
    r.status = 'OBSERVED'; if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    if (p.id === 'unnoticed-passage') ctx.note('本人讲话结束本次练习', r.method === 'ABILITY' ? '你亲口说出“练习结束”，本次可能形成的心理学隐身当场破除；没有穿越原墙或移动原物。' : '你亲口说明普通走位练习已经结束，本次没有使用心理学隐身，也没有穿越原墙或移动原物。');
    ctx.note(p.title, (p.id === 'protected-choice' ? '本人接受的旁观说明本次仍未形成可报告结果；首次拒绝与看护边界保留。' : '本次练习没有取得足够的有限结果，注意集中和事先同意都不保证能力成功。') + (result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : '') + '先实际结束本次接触，下周可再核对。');
  }
}
export function hypnotistActions(s: SliceState): HypnotistAction[] {
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 6) return [];
  const out: HypnotistAction[] = [];
  const add = (id: string, label: string, cost: string, command: HypnotistActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.hypnotist.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束本次事项并退出', '0行动 · 保留原事实与拒绝', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对本人同意、注意范围与停止信号', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      const revised = p.id === 'protected-choice' && r.notes.includes(REFUSAL);
      add(p.id + '-ability', revised ? '改为本人接受的旁观专注方案' : '准备有边界的能力练习', '1行动 · 实施另耗3灵性 · 不保证同意', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', revised ? '改为本人接受的普通旁观说明' : '准备普通比较方案', '1行动', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') { add(p.id + '-perform', '实际进行本次练习并核对有限结果', r.method === 'ABILITY' ? '1行动 · 3灵性 · 仍可能失败' : '1行动 · 普通方法', { type: 'PERFORM', caseId: p.id }); add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 不重置本人意愿', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告有限结果与未知范围', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.hypnotist.reflected) add('hypnotist-reflect', '回看专注、保护责任与认知忽略的边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.hypnotist.encounter.status === 'AVAILABLE') {
    add('hypnotist-encounter-talk', '前往原后门观察并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('hypnotist-encounter-fight', '前往原后门观察并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function hypnotistCases(s: SliceState): HypnotistProjection['cases'] {
  if (s.progression.pathwayId !== 'audience' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&(s.progression.sequence!==2&&s.progression.sequence!==1))) return [];
  return CASES.map(p => { const r = s.hypnotist.cases[p.id]!; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...r.notes], preparation: r.status === 'PREPARED' ? r.revised ? REVISION + (r.method === 'ABILITY' ? ' 只作本人接受的有限专注，实施另耗3灵性。' : ' 使用普通旁观说明。') : r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result : r.notes.includes(REFUSAL) ? REFUSAL + (r.revised ? ' 原方案已修订，仍须实际评估。' : ' 下一真实周可据新事实修订。') : r.attemptWeek !== null ? '此前练习未成，原成本、抵抗与未知保留。' : r.withdrawals ? '尚未实施的准备已取消。' : null, status: r.status, contactOpen: r.contactOpen ? '本次现场仍须停止精神影响并退离' : '没有尚未结束的本次事项', closes: r.closes }; });
}
/** Fixed original consent, stop signals and refusal evidence; no generic mind-control state. */
export function validateHypnotistLife(s: SliceState): boolean {
  const m = s.hypnotist;
  if (!record(m) || !record(m.cases) || !shape(m.cases, [...HYPNOTIST_CASE_IDS]) || !Array.isArray(s.seer.completedSources)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean' || typeof r.revised !== 'boolean' || !Array.isArray(r.notes)) return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    const sourceCount = s.seer.completedSources.filter(x => x === `hypnotist-case:${p.id}`).length;
    if (sourceCount !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.notes.length || r.revised)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen || r.notes.length)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (p.id === 'protected-choice') {
      const expected = r.attemptWeek === null ? [] : r.revised ? [REFUSAL, NEW_FACT, REVISION] : [REFUSAL, NEW_FACT];
      if (JSON.stringify(r.notes) !== JSON.stringify(expected) || r.revised && (r.attemptWeek === null || r.closes < 1)) return false;
      if (['EXAMINED', 'RESOLVED'].includes(r.status as string) && !r.revised) return false;
    } else if (r.notes.length !== 0 || r.revised) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'hypnotist-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'audience' && s.progression.sequence === 6 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
