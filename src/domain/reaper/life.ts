import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import { applyReaperEncounter, blockReaperEncounter, REAPER_ENCOUNTER_STORY } from './encounter.js';
import { REAPER_CASE_IDS, type ReaperCaseId, type ReaperCommand, type ReaperActivityCommand, type ReaperAction, type ReaperProjection } from './types.js';

const CASES = [
  {
    id: 'timber-seam', title: '原木接缝查验',
    story: '索伦原货栈的成年器材教练伊沃允许你查验练习架上原有的两段木料接缝；木料、固定架与刻线尺均属练习场，原件不会交付给你。接缝松紧需要现场核对，不能凭能力把不存在的裂口写成事实。（G）',
    facts: ['原木与接缝留在练习架上，可见线条不等于已证实的薄弱处。', '伊沃允许观察和轻触查验，不劈毁木料，不获得工具或装备。'],
    ability: '准备结合弱点观察与原刻线核查，实际实施另耗3灵性；观察可能失误，仍要查验真实接缝。',
    ordinary: '准备以普通目视、轻触与原刻线对照查验接缝，不施放非凡能力。',
    abilityResult: '你以弱点观察辅助查验，确认了这一处原接缝的有限松动范围；结论不推广为所有物体的通用弱点。',
    ordinaryResult: '你以普通目视与轻触对照原刻线，确认了这一处接缝的有限松动范围；没有声称施放弱点观察。',
    outcome: 'SEAM_CHECKED', stat: 'perception', spirit: 3,
  },
  {
    id: 'moving-shutter', title: '伊沃摆动的安全挡片',
    story: '同一位成年教练伊沃在原练习架旁看护固定的软垫与安全挡片。准备后必须另行给出信号，由他亲手摆动原挡片，才会实际露出一次短暂窗口；准备或观察不能自己制造窗口。原软头练习杆系在架上，属于伊沃，只在原处练习，不生成随身装备。（G）',
    facts: ['伊沃仍是同一个成年教练；原挡片、软垫和系留练习杆均在原架上。', '准备不等于窗口；独立发信号后才有一次真实摆动。失败也消耗该窗口，不能重复使用。'],
    ability: '准备在实际摆动后观察露出的软垫边缘，以原系留软头练习杆作一次有限精准触击；实施另耗3灵性，仍可能错过。',
    ordinary: '准备在伊沃实际摆动后，以普通视线核对原软垫刻线出现的时机；不冒充精准打击能力。',
    abilityResult: '伊沃的这一次真实摆动露出了窗口，你在窗口内以原软头练习杆完成有限触击。窗口已消耗，不保证下一次命中，更不代表必杀。',
    ordinaryResult: '你在伊沃这一次真实摆动中，以普通观察核对了原软垫刻线短暂可见的时机；窗口已消耗，没有施放精准打击。',
    outcome: 'WINDOW_CHECKED', stat: 'perception', spirit: 3,
  },
  {
    id: 'guarded-flame', title: '隔离耐火靶位的准确投射',
    story: '原练习场有伊沃看护的隔离耐火靶位，原石质后挡与靶面标线一直在场。实施前须实际请伊沃退到隔离线外、确认靶道没有旁人及可燃物；能力方法才会向原靶面作有限火焰投射，普通方法只核对标线。靶具归练习场，不变为奖励。（G）',
    facts: ['原隔离耐火靶、石质后挡与标线有明确来源，不临时生成防护或装备。', '实施时实际清空靶道，再作有限火焰投射或普通标线核对；不向任何人施放。'],
    ability: '准备在实际清场后配合已见靶面薄弱标记，准确投射继承的有限火焰；实施耗4灵性，不获得火焰化或团队共享力量。',
    ordinary: '准备在实际清场后普通核对原靶面与隔离标线；不点火、不施放能力、不伪造非凡投射结果。',
    abilityResult: '清空后的原靶道没有旁人与可燃物，你向原耐火靶的指定区域完成有限火焰投射。准确结果仅覆盖这次练习，不保证穿透任意防护。',
    ordinaryResult: '清空后的原靶道已经核对，你以普通方法完成靶面标线与隔离线对照；没有点火，也没有声称取得火焰投射结果。',
    outcome: 'FLAME_CHECKED', stat: 'perception', spirit: 4,
  },
] as const;
type Case = typeof CASES[number];
export const REAPER_ENVIRONMENT = '三项原场地练习分别核查结构、配合实际摆动窗口和清空后的耐火靶位。OBSERVE、PREPARE、PERFORM、REPORT各1行动；独立SIGNAL 0行动产生一次窗口，失败亦消耗；CLOSE与WITHDRAW 0行动实际结束。能力实施耗3灵性，火焰耗4；普通方法均可完成有限报告，不伪造非凡结果。每报告G扮演+25，三案反思+25。没有必中必杀、序列4火焰化或铁血军团，也没有丧钟物品规则。全部场景和数值为原创G。 ' + REAPER_ENCOUNTER_STORY;
/** A live swing holds the shared pulse too: it must be used or actually stopped first. */
export const reaperInside = (s: SliceState) => Object.values(s.reaper.cases).some(r => r.contactOpen || r.practice.windowOpen);
export const isReaperActivity = (c: ReaperCommand): c is ReaperActivityCommand => ['OBSERVE', 'PREPARE', 'SIGNAL', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is ReaperActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!REAPER_CASE_IDS.includes(c.caseId as ReaperCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'SIGNAL') return shape(c, ['type', 'caseId']) && c.caseId === 'moving-shutter';
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: ReaperActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockReaperEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 5) return '先完成收割者晋升。';
  const r = 'caseId' in c ? s.reaper.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次练习。';
  if (Object.values(s.reaper.cases).some(value => value.contactOpen)) return '先0行动实际结束本次练习并退出。';
  if (s.reaper.cases['moving-shutter']!.practice.windowOpen && !('caseId' in c && c.caseId === 'moving-shutter' && (c.type === 'PERFORM' || c.type === 'WITHDRAW'))) return '伊沃已实际摆动原挡片；只能使用本次窗口，或取消准备并实际停摆。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德的原练习场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.reaper.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return c.type === 'SIGNAL' ? '发信号虽为0行动，仍须保有1行动才能实际使用这次窗口。' : '需要1行动。';
  if (c.type === 'REFLECT') return s.reaper.reflected ? '已经回看这段经历。' : CASES.some(p => s.reaper.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!r) return '未知原练习。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察与实际练习记录已经保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原物、场地与本次练习边界。' : r.attemptWeek === s.week ? '本周尝试与窗口消耗保留，下周才能重新准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果，并实际结束练习。';
  if (c.type === 'SIGNAL') return r.status !== 'PREPARED' ? '先准备本次挡片练习。' : r.practice.windowOpen ? '本次摆动窗口已打开，不能重复发信号叠加。' : null;
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (c.caseId === 'moving-shutter' && !r.practice.windowOpen) return '先独立发信号，让伊沃实际摆动原挡片产生本次窗口。';
  const p = CASES.find(p => p.id === c.caseId)!;
  return r.method === 'ABILITY' && s.spirituality < p.spirit ? `本次能力实践需要${p.spirit}灵性；可取消准备后选择普通方法。` : null;
}
const resultText = (p: Case, method: 'ABILITY' | 'ORDINARY') => method === 'ABILITY' ? p.abilityResult : p.ordinaryResult;
const succeeded = (tier: PublicResolutionTier) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
function attemptNote(p: Case, week: number, number: number, method: 'ABILITY' | 'ORDINARY', tier: PublicResolutionTier): string {
  return `第${week}周第${number}次，${method}，${tier}：${succeeded(tier) ? resultText(p, method) : '本次未能支持有限结论，原成本和未知保留。'}${p.id === 'moving-shutter' ? '本次真实摆动窗口已消耗。' : ''}`;
}
export function applyReaperActivity(s: SliceState, c: ReaperActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('收割者实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyReaperEncounter(s, c, ctx); return; }
  const m = s.reaper;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.practice.siteCleared = false; r.closes += 1;
    ctx.note('实际结束本次练习并退出', '0行动停止本次查验或投射，确认残余火焰熄灭、挡片停止，系留练习杆回到原架停靠处，所有原靶具留在原处。已付成本、原观察、失败和窗口消耗记录保留；不退灵性、不治疗、不再抽奖。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!, hadWindow = r.practice.windowOpen;
    r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1; r.practice.windowOpen = false; r.practice.siteCleared = false;
    ctx.note('取消尚未实施的准备', `0行动实际停止本次准备。${hadWindow ? '伊沃停止本次原挡片摆动，已经打开的窗口失效，不可保存或复用。' : ''}原物留在原处，原观察、已付行动与失败记录保留，没有免费恢复或抽奖。`); return;
  }
  if (c.type === 'SIGNAL') {
    const r = m.cases[c.caseId]!; r.practice.signals += 1; r.practice.windowOpen = true;
    ctx.note('伊沃实际摆动原挡片', '你另行发出信号，0行动。同一位成年教练伊沃亲手摆动原安全挡片，原软垫边缘实际露出一次窗口；这不是准备自带的效果。只能随后实施一次，或实际停摆取消，不能携带窗口去休养或跨周。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('reaper-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('看见薄弱处仍须面对真实时机', '回看原木接缝、真实摆动窗口和清空后的耐火靶三段有限经历，分清观察、现场条件与实际结果。G扮演+25；不把一次成功当作必中必杀，也不把普通核对写成非凡施放。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`reaper-case:${p.id}`, 8);
    ctx.note(p.title, resultText(p, r.method!) + '本次练习已实际结束，G扮演+25、已知能力单项掌握+8；没有工具、靶具或装备奖励。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true; r.practice.attempts += 1;
  if (p.id === 'moving-shutter') { r.practice.windowOpen = false; r.practice.windowUses += 1; }
  if (p.id === 'guarded-flame') {
    r.practice.siteCleared = true;
    ctx.note('实际清空原隔离靶道', '伊沃实际退到原隔离线外；你核对原耐火靶与石质后挡，确认靶道没有旁人和可燃物，才开始本次练习。没有凭空添加防护。');
  }
  if (r.method === 'ABILITY') { s.spirituality -= p.spirit; ctx.note('有限能力的实际成本', `本次${p.spirit}灵性已经支出；${p.id === 'guarded-flame' ? '实际向清空后的原耐火靶作有限火焰投射。' : '实际实施所选能力练习。'}观察和时机仍可能失败。`); }
  const result = ctx.check(r.method === 'ABILITY' ? p.stat : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  r.notes.push(attemptNote(p, s.week, r.practice.attempts, r.method!, result.tier));
  if (succeeded(result.tier)) {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    ctx.note(p.title, resultText(p, r.method!) + '先0行动实际结束本次练习并退出。');
  } else {
    r.status = 'OBSERVED'; if (result.tier === 'GREAT_FAILURE') s.mind = Math.max(0, s.mind - 5);
    ctx.note(p.title, '本次未能取得可报告的有限结论，原成本和失败记录保留。' + (p.id === 'moving-shutter' ? '这一次真实摆动窗口已消耗，即使失败也不能复用。' : '') + (result.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : '') + '先实际结束本次练习，下周可重新准备。');
  }
}
export function reaperActions(s: SliceState): ReaperAction[] {
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 5) return [];
  const out: ReaperAction[] = [];
  const add = (id: string, label: string, cost: string, command: ReaperActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.reaper.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束本次练习并退出', '0行动 · 原物留原处 · 成本与失败保留', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '观察原物、场地与本次边界', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', '准备有条件的能力练习', `1行动 · 实施另耗${p.spirit}灵性 · 不保证成功`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', p.id === 'guarded-flame' ? '准备普通标线核对' : '准备普通查验方法', '1行动 · 实施不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      if (p.id === 'moving-shutter') add(p.id + '-signal', '发信号，让伊沃实际摆动原挡片', '0行动 · 需保有1行动 · 仅一次真实窗口', { type: 'SIGNAL', caseId: p.id });
      add(p.id + '-perform', p.id === 'guarded-flame' ? '实际清空靶道并执行所选方法' : p.id === 'moving-shutter' ? '实际使用本次摆动窗口' : '实际查验原木接缝', '1行动', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', r.practice.windowOpen ? '取消准备并让伊沃实际停摆' : '取消尚未实施的准备', '0行动 · 已开窗口失效 · 不退成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本次有限结果与未知范围', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.reaper.reflected) add('reaper-reflect', '回看弱点、时机与实际结果', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.reaper.encounter.status === 'AVAILABLE') {
    add('reaper-encounter-talk', '前往原石院观察并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('reaper-encounter-fight', '前往原石院观察并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function reaperCases(s: SliceState): ReaperProjection['cases'] {
  if (s.progression.pathwayId !== 'hunter' || (s.progression.sequence !== 5 && s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==1)) return [];
  return CASES.map(p => {
    const r = s.reaper.cases[p.id]!;
    return {
      id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts, ...r.notes],
      preparation: r.status === 'PREPARED' ? (r.method === 'ABILITY' ? p.ability : p.ordinary) : null,
      result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? resultText(p, r.method!) : r.attemptWeek !== null ? '此前练习未成，原成本、失败与窗口消耗记录保留。' : r.withdrawals ? '尚未实施的准备已实际取消。' : null,
      status: r.status, contactOpen: r.contactOpen ? '本次练习仍须实际结束并退出' : r.practice.windowOpen ? '伊沃正在摆动原挡片，须使用窗口或实际停摆' : '没有尚未结束的本次练习', closes: r.closes,
      windowOpen: p.id === 'moving-shutter' ? r.practice.windowOpen ? '一次真实摆动窗口已打开，尚未使用' : '当前没有可用窗口；准备不会自动产生窗口' : '本案不使用摆动窗口',
      practice: p.id === 'moving-shutter' ? `实际发信号${r.practice.signals}次，窗口已实施${r.practice.windowUses}次，练习${r.practice.attempts}次；取消后旧窗口不复用。` : p.id === 'guarded-flame' ? `实际练习${r.practice.attempts}次；${r.practice.siteCleared ? '靶道已实际清空，本次练习仍须结束' : '实施时实际清空靶道，普通方法不点火'}。` : `原接缝实际查验${r.practice.attempts}次；工具与木料仍归原练习场。`,
    };
  });
}
/** Fixed cases and canonical attempt records make costs, failed windows and actual stopping persist. */
export function validateReaperLife(s: SliceState): boolean {
  const m = s.reaper;
  if (!record(m) || !record(m.cases) || !shape(m.cases, REAPER_CASE_IDS) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || typeof m.reflected !== 'boolean') return false;
  let open = 0, prepared = 0, windows = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'practice'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean' || !Array.isArray(r.notes)) return false;
    if (!record(r.practice) || !shape(r.practice, ['attempts', 'signals', 'windowOpen', 'windowUses', 'siteCleared'])) return false;
    const a = r.practice;
    if (!integer(a.attempts, 0) || !integer(a.signals, 0) || !integer(a.windowUses, 0) || typeof a.windowOpen !== 'boolean' || typeof a.siteCleared !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `reaper-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen || r.notes.length || a.attempts || a.signals || a.windowOpen || a.windowUses || a.siteCleared)) return false;
    if ((r.attemptWeek === null) !== (a.attempts === 0) || r.notes.length !== a.attempts || r.closes !== a.attempts - Number(r.contactOpen)) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (a.windowOpen) {
      windows += 1;
      if (r.status !== 'PREPARED' || p.id !== 'moving-shutter' || r.contactOpen || s.actionsRemaining < 1 || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false;
    }
    if (p.id === 'moving-shutter') {
      if (a.windowUses !== a.attempts || a.signals < a.windowUses + Number(a.windowOpen) || a.signals > a.windowUses + Number(a.windowOpen) + r.withdrawals || a.siteCleared) return false;
    } else if (a.signals !== 0 || a.windowUses !== 0 || a.windowOpen) return false;
    if (a.siteCleared !== (p.id === 'guarded-flame' && r.contactOpen)) return false;
    let lastWeek = (m.promotionWeek ?? s.week) - 1;
    for (const [index, note] of r.notes.entries()) {
      if (typeof note !== 'string') return false;
      const match = note.match(/^第([1-9]\d*)周第([1-9]\d*)次，(ABILITY|ORDINARY)，(GREAT_SUCCESS|SUCCESS|FAILURE|GREAT_FAILURE)：/);
      if (!match) return false;
      const week = Number(match[1]), number = Number(match[2]), method = match[3] as 'ABILITY' | 'ORDINARY', tier = match[4] as PublicResolutionTier;
      if (!integer(week, lastWeek + 1, s.week) || number !== index + 1 || note !== attemptNote(p, week, number, method, tier)) return false;
      if (index < r.notes.length - 1 && succeeded(tier)) return false;
      if (index === r.notes.length - 1 && (week !== r.attemptWeek || succeeded(tier) !== ['EXAMINED', 'RESOLVED'].includes(r.status as string) || r.contactOpen && method !== r.method || ['EXAMINED', 'RESOLVED'].includes(r.status as string) && method !== r.method)) return false;
      lastWeek = week;
    }
  }
  if (open > 1 || prepared > 1 || windows > 1 || open && prepared || open && windows) return false;
  if (s.seer.completedSources.filter(x => x === 'reaper-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'hunter' && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))) return open === 0 && prepared === 0 && windows === 0 && s.ironBloodKnight?.reaperActingAtPromotion === resolved * 25 + (m.reflected ? 25 : 0);
  if (s.progression.pathwayId === 'hunter' && s.progression.sequence === 5 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
