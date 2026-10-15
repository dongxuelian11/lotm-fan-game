import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { starMysticInside } from '../star-mystic/life.js';
import { scrollProfessorInside } from '../scroll-professor/life.js';
import { MYSTIC_GUIDE } from './content.js';
import type { MysticAction } from './types.js';

export const MYSTIC_SAMPLE_ID = 'MY4-BLOOD-1';
export const MYSTIC_DONOR_ID = 'MY4-DONOR-1';
export const MYSTIC_SHIELD_ID = 'MY4-SHIELD-1';
export const MYSTIC_RECORDBOOK_ID = 'MY4-RECORD-1';
export const MYSTIC_ANALYSIS_STEPS = [
  { id: 'structure', title: '观察同一原滴的神秘结构', detail: '在原防护罩内，以已佩戴的原厚镜片辅助有限神秘观察，把同一原滴可分辨的结构写入原册；不提供现实血液处理指引。' },
  { id: 'references', title: '交叉核对本人既有神秘学记录', detail: '把刚才同一原滴的真实结构与本人已学习的窥秘与法术记录逐项交叉核对；不凭空借用未研究的知识、配方或命运能力。' },
  { id: 'model-recheck', title: '独立解释并复核完整分析', detail: '在原册独立写出本次神秘结构解释，再对同一原滴逐项复核，成功才记录已完成已知仪式部分；不推断未知的完整配方或其余仪式。' },
] as const;
export type MysticAnalysisStepId = typeof MYSTIC_ANALYSIS_STEPS[number]['id'];
export type MysticRitualCommand = { type: 'ACQUIRE_SAMPLE' | 'OPEN_ANALYSIS' | 'ANALYZE_SAMPLE' | 'CLOSE_ANALYSIS' | 'RETURN_SAMPLE' };
export interface MysticAnalysisAttempt {
  stepId: MysticAnalysisStepId; sampleId: typeof MYSTIC_SAMPLE_ID; session: number; week: number;
  tier: PublicResolutionTier; roll: number; chance: number;
  actionCost: 1; spiritualityCost: 4; mindCost: 2;
}
export interface MysticRitualState {
  sample: { id: typeof MYSTIC_SAMPLE_ID; donorId: typeof MYSTIC_DONOR_ID; source: string; quantityDrops: 1; status: 'SUPPLIER' | 'SEALED' | 'ANALYSIS' | 'RETURNED'; acquiredWeek: number | null; returnedWeek: number | null };
  donorContribution: { donorId: typeof MYSTIC_DONOR_ID; sampleId: typeof MYSTIC_SAMPLE_ID; week: number; quantityDrops: 1; source: string } | null;
  shield: { id: typeof MYSTIC_SHIELD_ID; status: 'SUPPLIER' | 'RACK' | 'AROUND_SAMPLE' };
  recordbook: { id: typeof MYSTIC_RECORDBOOK_ID; status: 'SUPPLIER' | 'PLAYER' };
  sessions: { openedWeek: number; closedWeek: number | null }[];
  attemptWeek: number | null; attempts: MysticAnalysisAttempt[];
  completedSteps: MysticAnalysisStepId[]; complete: boolean; completedWeek: number | null;
}
export interface MysticRitualProjection {
  ritual: {
    title: string; source: string; sample: string; shield: string; recordbook: string;
    complete: boolean; completedSteps: number; totalSteps: 3; open: boolean; boundary: string;
    steps: { id: string; title: string; complete: boolean; detail: string }[]; history: string[];
  } | null;
}
export const MYSTIC_SAMPLE_SOURCE = '本作原创成年半神奥蕾莉娅·维尔（Orelia Vale，MY4-DONOR-1）自愿捐赠的一滴神话生物血液，由原成年伊蕾·莫文负责核实来源并交接；独立原密封器皿MY4-BLOOD-1只装这一原滴。人物、捐赠渠道、防护与研究流程均为G，不提供现实采集或处理血液指引，不宣称获得该捐赠者途径的免费能力。';
export const MYSTIC_RITUAL_BOUNDARY = '已知仪式部分是完全解析一滴神话生物血液，不是饮血。原滴始终是同一滴，分析不复制、不消耗，不作战斗燃料。三项不同知识18分析各实付1行动、4灵性、2精神，失败也记下实际费用且不推进，失败只能下一真实周再试。原册保留全部成功与失败；无扮演或能力掌握奖励。开罩1行动，原镜须已实际购买并佩戴。0行动关闭归回安全架，可休养跨周；再次开罩须下一真实周。三项成功后0行动归还同一密封原器皿。完整配方与仪式其余细节仍未知，导师后续专业准备明确为G。';
export function createMysticRitualState(): MysticRitualState {
  return {
    sample: { id: MYSTIC_SAMPLE_ID, donorId: MYSTIC_DONOR_ID, source: MYSTIC_SAMPLE_SOURCE, quantityDrops: 1, status: 'SUPPLIER', acquiredWeek: null, returnedWeek: null },
    donorContribution: null,
    shield: { id: MYSTIC_SHIELD_ID, status: 'SUPPLIER' }, recordbook: { id: MYSTIC_RECORDBOOK_ID, status: 'SUPPLIER' },
    sessions: [], attemptWeek: null, attempts: [], completedSteps: [], complete: false, completedWeek: null,
  };
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).length === fields.length && fields.every(f => Object.hasOwn(v, f));
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string) => tier === 'GREAT_SUCCESS' || tier === 'SUCCESS';
const eligible = (s: SliceState) => s.progression.pathwayId === 'hermit' && (s.progression.sequence === 5 || s.progression.sequence === 4 || s.progression.sequence === 3) && s.starMystic.promotionWeek !== null && s.mystic.guidanceKnown;
export const hasMysticRitualLock = (s: SliceState): boolean => s.mystic.ritual.sample.status === 'ANALYSIS';
export const hasMysticOldPracticeLock = (s: SliceState): boolean => starMysticInside(s) || scrollProfessorInside(s)
  || Object.values(s.wizard.cases).some(r => r.effectOpen)
  || [s.pryer, s.combatScholar, s.wizard, s.scrollProfessor, s.starMystic].some(stage => Object.values(stage.cases).some(r => r.status === 'PREPARED'));
export function validateMysticRitualCommand(value: unknown): value is MysticRitualCommand {
  return record(value) && shape(value, ['type']) && ['ACQUIRE_SAMPLE', 'OPEN_ANALYSIS', 'ANALYZE_SAMPLE', 'CLOSE_ANALYSIS', 'RETURN_SAMPLE'].includes(value.type as string);
}
export function mysticRitualReason(s: SliceState, command: MysticRitualCommand): string | null {
  const r = s.mystic.ritual;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!eligible(s)) return '先成为星象师，并听取原导师的神秘学家指导。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '先回到贝克兰德伊蕾的原教学室。';
  // Cleanup does not require AP, spiritual reserves or another successful check.
  if (command.type === 'CLOSE_ANALYSIS') return r.sample.status === 'ANALYSIS' ? null : '当前没有尚未安全关闭的原样本分析。';
  if (command.type === 'RETURN_SAMPLE') return !r.complete ? '先取得同一原滴三项不同的真实成功分析。' : r.sample.status !== 'SEALED' ? '先0行动关闭防护并将同一原样本密封放回安全架。' : null;
  if (hasMysticOldPracticeLock(s) || Object.values(s.mystic.life.cases).some(c => c.contactOpen) || s.mystic.encounter.status === 'FIGHTING') return '先实际收束旧实践、新接触与真实路线。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < 1) return '本次需要1行动；已经开罩仍可0行动关闭。';
  if (s.progression.sequence === 4 || s.progression.sequence === 3) return '已完成神秘学家晋升，分析记录保留，不再重复筹备。';
  if (command.type === 'ACQUIRE_SAMPLE') return r.sample.status !== 'SUPPLIER' ? '这份原滴、防护罩与记录册已经实际交付，不能复制购买。' : s.cash < 240 ? '原渠道交接需要240便士。' : null;
  if (command.type === 'OPEN_ANALYSIS') {
    if (r.complete) return '三项完整分析已经完成，不重复开启原滴。';
    if (r.sample.status !== 'SEALED') return '先取得同一原密封样本，当前不能重复开罩。';
    if (s.starMystic.practice.lenses !== 'WORN') return '须实际购买并戴好原厚镜片眼镜SM5-LENS-1；可选本阶段的购买原眼镜。';
    const previous = r.sessions.at(-1);
    return previous && previous.closedWeek !== null && s.week <= previous.closedWeek ? '本周已关闭本次分析，下一真实周再开原罩。' : null;
  }
  if (r.sample.status !== 'ANALYSIS' || r.shield.status !== 'AROUND_SAMPLE') return '先在同一原防护罩内开启同一原样本分析。';
  if (s.starMystic.practice.lenses !== 'WORN') return '必须实际佩戴自己持有的原厚镜片眼镜。';
  if (r.complete) return '同一原滴三项分析已齐全，先安全关闭，不重复奖励或分析。';
  const previous = r.attempts.at(-1);
  if (previous && !success(previous.tier) && previous.week === s.week) return '本周分析已经失败且真实付费；先安全关闭，下一真实周才能重试。';
  if (s.spirituality < 4 || s.mind <= 2) return '分析需要4灵性、2精神且必须保持清醒；仍可0行动安全关闭后休养。';
  return null;
}
export function applyMysticRitualCommand(s: SliceState, command: MysticRitualCommand, c: SeerContext): void {
  if (!validateMysticRitualCommand(command)) throw new Error('神秘学家原滴分析命令无效。');
  const reason = mysticRitualReason(s, command); if (reason) throw new Error(reason);
  const r = s.mystic.ritual;
  if (command.type === 'ACQUIRE_SAMPLE') {
    s.actionsRemaining -= 1; s.cash -= 240;
    r.sample.status = 'SEALED'; r.sample.acquiredWeek = s.week;
    r.donorContribution = { donorId: MYSTIC_DONOR_ID, sampleId: MYSTIC_SAMPLE_ID, week: s.week, quantityDrops: 1, source: MYSTIC_SAMPLE_SOURCE };
    r.shield.status = 'RACK'; r.recordbook.status = 'PLAYER';
    c.note('同一原滴与防护记录实际交付', `实付1行动、240便士。${MYSTIC_GUIDE}当面核验原创成年捐赠者MY4-DONOR-1的自愿贡献记录，在第${s.week}周将装有唯一原滴的密封器皿MY4-BLOOD-1、唯一可重复使用的原防护罩MY4-SHIELD-1及原册MY4-RECORD-1交付。${MYSTIC_SAMPLE_SOURCE}本次没有分析、饮血或能力奖励。`); return;
  }
  if (command.type === 'OPEN_ANALYSIS') {
    s.actionsRemaining -= 1; r.sample.status = 'ANALYSIS'; r.shield.status = 'AROUND_SAMPLE'; r.sessions.push({ openedWeek: s.week, closedWeek: null });
    c.note('在同一原罩中安置同一原滴', '实付1行动。你戴着已购原厚镜片眼镜SM5-LENS-1，把原密封器皿MY4-BLOOD-1在原防护罩MY4-SHIELD-1中就位，打开这次有限神秘观察。原册在手，没有换样、复制原滴、制造新的防护或预先完成任何分析。随时可0行动安全关闭。'); return;
  }
  if (command.type === 'CLOSE_ANALYSIS') {
    r.sample.status = 'SEALED'; r.shield.status = 'RACK'; r.sessions.at(-1)!.closedWeek = s.week;
    c.note('安全封存同一原滴并归回原架', '0行动、0灵性。实际结束本次神秘观察，把同一原密封器皿MY4-BLOOD-1安全放回原架，收起同一原防护罩；原厚镜片仍佩戴。所有已付成本与原册成功、失败记录保留。现在可普通休养与真实跨周；没有退款、补滴、掌握或扮演奖励。'); return;
  }
  if (command.type === 'RETURN_SAMPLE') {
    r.sample.status = 'RETURNED'; r.sample.returnedWeek = s.week;
    c.note('归还已完整分析的同一原滴', `0行动。你把第${r.sample.acquiredWeek}周实际取得的同一密封器皿MY4-BLOOD-1与其中原一滴交回伊蕾，记录第${s.week}周归还。三项不同成功分析与全部失败成本保留在MY4-RECORD-1；原罩继续收在原架，原滴没有被饮用、耗尽、变成魔药或战斗燃料。只完成已知仪式部分，其余原著仪式细节仍未知。`); return;
  }
  const step = MYSTIC_ANALYSIS_STEPS[r.completedSteps.length]!;
  s.actionsRemaining -= 1; s.spirituality -= 4; s.mind -= 2;
  const result = c.check('knowledge', 18);
  r.attemptWeek = s.week;
  r.attempts.push({ stepId: step.id, sampleId: MYSTIC_SAMPLE_ID, session: r.sessions.length, week: s.week, tier: result.tier, roll: result.roll, chance: result.chance, actionCost: 1, spiritualityCost: 4, mindCost: 2 });
  if (success(result.tier)) {
    r.completedSteps.push(step.id);
    if (r.completedSteps.length === 3) { r.complete = true; r.completedWeek = s.week; }
  }
  c.note(success(result.tier) ? `分析成功：${step.title}` : `分析未完成：${step.title}`, `同一原滴MY4-BLOOD-1，第${r.attempts.length}次实际分析：知识18，${result.roll}/${result.chance}，${result.tier}。实际支付1行动、4灵性、2精神，写入同一原册MY4-RECORD-1。${step.detail}${success(result.tier) ? `不同成功步骤${r.completedSteps.length}/3。${r.complete ? '已完成已知仪式部分，仍须0行动安全关闭并归还同一原滴后才能服药；完整配方及其余仪式仍未知。' : '下一次另付成本分析下一项不同内容。'}` : '本项没有完成，不推进、不补造观察；下一真实周才能重试，先0行动安全关闭后休养。'}不奖励扮演或能力掌握，原滴仍在同一原罩内。`);
}
export function mysticRitualActions(s: SliceState): MysticAction[] {
  if (!eligible(s)) return [];
  const r = s.mystic.ritual, rows: [MysticRitualCommand['type'], string, string][] = [];
  if (r.sample.status === 'SUPPLIER') rows.push(['ACQUIRE_SAMPLE', '核验捐赠并领取唯一原滴、防护罩与原册', '1行动 · 240便士 · 同一原滴']);
  if (r.sample.status === 'SEALED' && !r.complete) rows.push(['OPEN_ANALYSIS', '戴原镜，在原罩中开启原滴分析', '1行动 · 需要已购原厚镜片']);
  if (r.sample.status === 'ANALYSIS') {
    if (!r.complete) rows.push(['ANALYZE_SAMPLE', MYSTIC_ANALYSIS_STEPS[r.completedSteps.length]!.title, '1行动 · 4灵性 · 2精神 · 知识18 · 失败照付']);
    rows.push(['CLOSE_ANALYSIS', '实际安全封存原滴并归回原架', '0行动 · 无需剩余灵性 · 允许休养跨周']);
  }
  if (r.complete && r.sample.status === 'SEALED') rows.push(['RETURN_SAMPLE', '归还已完整分析的同一密封原滴', '0行动 · 原记录保留 · 不饮血']);
  return rows.map(([type, label, cost]) => { const command: MysticRitualCommand = { type }, reason = mysticRitualReason(s, command); return { id: `mystic-${type.toLowerCase()}`, label, cost, command, enabled: reason === null, reason }; });
}
export function projectMysticRitual(s: SliceState): MysticRitualProjection {
  if (!eligible(s)) return { ritual: null };
  const r = s.mystic.ritual;
  const history = r.sessions.map((session, i) => `第${i + 1}次原罩开启：第${session.openedWeek}周；${session.closedWeek === null ? '仍须实际关闭' : `第${session.closedWeek}周已实际关闭，原样本归回安全架`}。`);
  for (const a of r.attempts) history.push(`第${a.week}周，第${a.session}次原罩，第${r.attempts.indexOf(a) + 1}次分析，原滴${a.sampleId}：${MYSTIC_ANALYSIS_STEPS.find(step => step.id === a.stepId)!.title}，${a.tier}（${a.roll}/${a.chance}），实付1行动、4灵性、2精神；${success(a.tier) ? '本项真正完成' : '本项未完成，失败成本保留'}。`);
  if (r.sample.returnedWeek !== null) history.push(`第${r.sample.returnedWeek}周，同一密封器皿与原一滴已归还原导师。`);
  return { ritual: { title: '完全解析同一原滴 · 已知仪式部分', source: MYSTIC_SAMPLE_SOURCE,
    sample: `${MYSTIC_SAMPLE_ID} · 唯一原一滴 · ${r.sample.status === 'SUPPLIER' ? '原导师保管，尚未交付' : r.sample.status === 'ANALYSIS' ? '同一原罩内，尚未关闭' : r.sample.status === 'RETURNED' ? '同一原滴已归还导师' : '已密封，原安全架上'}${r.donorContribution ? `；第${r.donorContribution.week}周实际核验MY4-DONOR-1原贡献并交付` : '；尚无玩家交接记录'}`,
    shield: `${MYSTIC_SHIELD_ID} · ${r.shield.status === 'SUPPLIER' ? '尚未交付' : r.shield.status === 'AROUND_SAMPLE' ? '正保护同一原样本' : '已收在原架，可重复使用，不复制'}`,
    recordbook: `${MYSTIC_RECORDBOOK_ID} · ${r.recordbook.status === 'SUPPLIER' ? '尚未交付' : `原册实录${r.attempts.length}次实际分析，包括失败成本`}`,
    complete: r.complete, completedSteps: r.completedSteps.length, totalSteps: 3, open: hasMysticRitualLock(s), boundary: MYSTIC_RITUAL_BOUNDARY,
    steps: MYSTIC_ANALYSIS_STEPS.map(step => ({ ...step, complete: r.completedSteps.includes(step.id) })), history,
  } };
}
/** One original sample, exact paid attempts and ordered distinct successes; no editable success flag shortcut. */
export function validateMysticRitual(s: SliceState): boolean {
  try { return validateRitual(s); } catch { return false; }
}
function validateRitual(s: SliceState): boolean {
  const r = s.mystic.ritual;
  if (!record(r) || !shape(r, ['sample', 'donorContribution', 'shield', 'recordbook', 'sessions', 'attemptWeek', 'attempts', 'completedSteps', 'complete', 'completedWeek']) || !record(r.sample) || !shape(r.sample, ['id', 'donorId', 'source', 'quantityDrops', 'status', 'acquiredWeek', 'returnedWeek']) ||
      r.sample.id !== MYSTIC_SAMPLE_ID || r.sample.donorId !== MYSTIC_DONOR_ID || r.sample.source !== MYSTIC_SAMPLE_SOURCE || r.sample.quantityDrops !== 1 || !['SUPPLIER', 'SEALED', 'ANALYSIS', 'RETURNED'].includes(r.sample.status) ||
      !record(r.shield) || !shape(r.shield, ['id', 'status']) || r.shield.id !== MYSTIC_SHIELD_ID || !['SUPPLIER', 'RACK', 'AROUND_SAMPLE'].includes(r.shield.status) ||
      !record(r.recordbook) || !shape(r.recordbook, ['id', 'status']) || r.recordbook.id !== MYSTIC_RECORDBOOK_ID || !['SUPPLIER', 'PLAYER'].includes(r.recordbook.status) ||
      !Array.isArray(r.sessions) || !Array.isArray(r.attempts) || !Array.isArray(r.completedSteps) || r.completedSteps.length > 3 || typeof r.complete !== 'boolean') return false;
  if (r.sample.status === 'SUPPLIER') return r.sample.acquiredWeek === null && r.sample.returnedWeek === null && r.donorContribution === null && r.shield.status === 'SUPPLIER' && r.recordbook.status === 'SUPPLIER' && r.sessions.length === 0 && r.attempts.length === 0 && r.attemptWeek === null && r.completedSteps.length === 0 && !r.complete && r.completedWeek === null;
  if (!eligible(s) || !integer(r.sample.acquiredWeek, s.starMystic.promotionWeek ?? 1, s.week) || !record(r.donorContribution) || !shape(r.donorContribution, ['donorId', 'sampleId', 'week', 'quantityDrops', 'source']) ||
      r.donorContribution.donorId !== MYSTIC_DONOR_ID || r.donorContribution.sampleId !== MYSTIC_SAMPLE_ID || r.donorContribution.quantityDrops !== 1 || r.donorContribution.week !== r.sample.acquiredWeek || r.donorContribution.source !== MYSTIC_SAMPLE_SOURCE || r.recordbook.status !== 'PLAYER') return false;
  const open = r.sample.status === 'ANALYSIS';
  if (r.shield.status !== (open ? 'AROUND_SAMPLE' : 'RACK') || open && (s.starMystic.practice.lenses !== 'WORN' || s.progression.sequence !== 5)) return false;
  for (const [i, session] of r.sessions.entries()) {
    if (!record(session) || !shape(session, ['openedWeek', 'closedWeek']) || !integer(session.openedWeek, r.sample.acquiredWeek, s.week) || i > 0 && (r.sessions[i - 1]!.closedWeek === null || session.openedWeek <= r.sessions[i - 1]!.closedWeek!) ||
        session.closedWeek !== null && !integer(session.closedWeek, session.openedWeek, s.week) || (session.closedWeek === null) !== (open && i === r.sessions.length - 1)) return false;
  }
  if (open && (r.sessions.length === 0 || r.sessions.at(-1)!.openedWeek !== s.week)) return false;
  const completed: MysticAnalysisStepId[] = []; let lastWeek = r.sample.acquiredWeek, lastSession = 1;
  for (const [i, a] of r.attempts.entries()) {
    if (!record(a) || !shape(a, ['stepId', 'sampleId', 'session', 'week', 'tier', 'roll', 'chance', 'actionCost', 'spiritualityCost', 'mindCost']) ||
        a.sampleId !== MYSTIC_SAMPLE_ID || a.stepId !== MYSTIC_ANALYSIS_STEPS[completed.length]?.id || !integer(a.session, lastSession, r.sessions.length) || !integer(a.week, lastWeek, s.week) ||
        a.actionCost !== 1 || a.spiritualityCost !== 4 || a.mindCost !== 2 || !integer(a.roll, 1, 100) || !integer(a.chance, 5, 95)) return false;
    const session = r.sessions[a.session - 1]!;
    if (a.week !== session.openedWeek || session.closedWeek !== null && a.week > session.closedWeek) return false;
    const expected: PublicResolutionTier = a.roll <= 5 ? 'GREAT_SUCCESS' : a.roll >= 96 ? 'GREAT_FAILURE' : a.roll <= a.chance ? 'SUCCESS' : 'FAILURE';
    if (a.tier !== expected || i > 0 && !success(r.attempts[i - 1]!.tier) && a.week <= r.attempts[i - 1]!.week) return false;
    if (success(a.tier)) completed.push(a.stepId);
    lastWeek = a.week; lastSession = a.session;
  }
  if (r.attemptWeek !== (r.attempts.at(-1)?.week ?? null) || r.completedSteps.length !== completed.length || completed.some((id, i) => r.completedSteps[i] !== id) || r.complete !== (completed.length === 3) || r.completedWeek !== (r.complete ? r.attempts.at(-1)!.week : null)) return false;
  if (r.complete && r.sessions.some(session => session.openedWeek > r.completedWeek!)) return false;
  if (r.sample.status === 'RETURNED') {
    if (!r.complete || !integer(r.sample.returnedWeek, r.completedWeek!, s.week) || r.sessions.at(-1)?.closedWeek === null || r.sample.returnedWeek < r.sessions.at(-1)!.closedWeek!) return false;
  } else if (r.sample.returnedWeek !== null) return false;
  if (s.mystic.promotionWeek !== null && (!r.complete || open || r.completedWeek! > s.mystic.promotionWeek || r.sessions.some(session => session.closedWeek === null || session.closedWeek > s.mystic.promotionWeek!))) return false;
  return true;
}
