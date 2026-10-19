import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { hasManipulatorRitualLock } from './ritual.js';

export const MANIPULATOR_CASE_IDS = ['consenting-island', 'divided-attention', 'plague-model'] as const;
export type ManipulatorCaseId = typeof MANIPULATOR_CASE_IDS[number];
export type ManipulatorActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'VERIFY'; caseId: ManipulatorCaseId }
  | { type: 'PREPARE'; caseId: ManipulatorCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CONSENT' | 'STOP' | 'CREATE_PERSONA' | 'PERSONA_TASK' | 'WITHDRAW_PERSONA' | 'RETURN_PAPER' | 'REFLECT' };
export interface ManipulatorCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; closes: number; withdrawals: number;
  consentWeek: number | null; verified: boolean; returned: boolean; personaAttempted: boolean; abilityUses: number;
}
export interface ManipulatorPersona {
  id: string; source: 'OWNER_MIND'; createdWeek: number; rejoinedWeek: number | null;
  status: 'ACTIVE' | 'REJOINED'; taskAttempted: boolean; taskDone: boolean;
}
export interface ManipulatorPractice {
  activeCase: ManipulatorCaseId | null; contact: 'NONE' | 'MIRA_MIND'; consent: boolean;
  persona: ManipulatorPersona | null; personaHistory: ManipulatorPersona[]; createdPersonas: number; totalMindSpent: number;
  paper: { id: 'MP4-COMPARISON-PAPER'; holder: 'DESK' | 'OWNER' };
  board: { id: 'MP4-LOCKED-BOARD'; locked: true; marking: 'THREE_BLUE_LINES' };
  bell: { id: 'MP4-ORIGINAL-BELL'; marking: 'THREE_NOTCHES' };
  ledger: { id: 'MP4-ORIGINAL-LEDGER'; entry: 'PARCEL_SHELF_B' };
  parcel: { id: 'MP4-PARCEL'; location: 'SHELF_B' };
  diagram: { id: 'MP4-INERT-DIAGRAM'; nature: 'ORDINARY_INERT_PAPER'; infections: 0 };
}
export interface ManipulatorLifeState { practice: ManipulatorPractice; cases: Record<ManipulatorCaseId, ManipulatorCaseState>; reflected: boolean }
export interface ManipulatorCaseProjection { id: ManipulatorCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: boolean; returned: boolean; closes: number }
export interface ManipulatorLifeProjection { title: string; source: string; environment: string; insideCase: boolean; practice: ManipulatorPractice; cases: ManipulatorCaseProjection[]; reflected: boolean }
export interface ManipulatorLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ManipulatorActivityCommand }
const CASES = [
  { id: 'consenting-island', title: '米拉的心灵岛屿与同一原包裹', story: '原创成年人米拉（31岁，MP4-MIRA）愿意让你了解她此刻对错归档包裹的担心。她保留拒绝权；只接触这一个当前问题，不能改写她的意志。也可直接读可见原账簿。（原创G）', facts: ['须先明确询问并记录米拉当前同意，能力实施耗3灵性、感知16；失败仍须停止接触。', '心灵线索不是全知或证词，退出后亲自核对同一MP4-ORIGINAL-LEDGER与MP4-PARCEL。原账簿条目和包裹都指向B架。'], ability: '准备接触当前同意的原米拉；3灵性与感知16在实际实施时结算。', ordinary: '准备亲自阅读可见原账簿，再核对同一原包裹。', result: '已在心灵接触之外亲自核对原账簿及B架原包裹，米拉仍保有自己的意志。' },
  { id: 'divided-attention', title: '同一锁定训练板、原铃与虚拟人格', story: '原创静置锁定板上有三条蓝线，同一原铃有三个缺口。本人借同一比较纸记录，可依次普通查看，或从自身实际形成一位虚拟人格协同关注板面；人格没有独立肉体或实体手。（原创G）', facts: ['CREATE_PERSONA耗3灵性与本人2精神；本有限练习一次只产生一位，不赠送奥黛丽实际案例里的13位。', 'PERSONA_TASK另耗2灵性，知识16，只执行一次板面观察，本人同时查看原铃。', '结束前明确重归人格并亲手把同一比较纸放回原桌，已付精神与灵性不返还。'], ability: '准备原板、原铃、同一比较纸与本人的有限并行注意；实施后另行创建人格。', ordinary: '准备本人依次查看原板与原铃，普通比较不伪增能力掌握。', result: '已比较原板和原铃；虚拟人格已真实重归本人，同一原纸放回原桌。' },
  { id: 'plague-model', title: '不产生感染的普通图解', story: '同意授课的成年人教员与玩家在普通纸面上比较假想传播连线、当前出口和求助选项。MP4-INERT-DIAGRAM只是静物，没有心灵，实际感染始终为0。（原创G教学模拟）', facts: ['本案只允许普通方式，知识14；没有施放精神瘟疫，没有真实传播或感染。', '图解可以形成扮演理解，不能增加精神瘟疫或任何能力掌握。可选原仓库真实冲突另行发生。'], ability: '本案不开放施病。', ordinary: '准备普通纸面辨识假想连线、原出口与自愿求助；不施术。', result: '普通图解与原出口已核对，纸面仍是静物，实际感染0、能力掌握0。' },
] as const;
export const MANIPULATOR_ENVIRONMENT = '能力边界依据原著，人物、原物、距离、检定与预算为原创G。观察、准备、实施、报告各1行动，明确子步骤与退出0行动；每报告25扮演，最后反思25。能力真实成功才获得既有已知池掌握8。失败须实际收束，下一真实周才能再试。未开放不完整龙形，也不获得序列3分身或近真实影像。';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 4;
const freshCase = (): ManipulatorCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, closes: 0, withdrawals: 0, consentWeek: null, verified: false, returned: false, personaAttempted: false, abilityUses: 0 });
export function createManipulatorLifeState(): ManipulatorLifeState {
  return { practice: { activeCase: null, contact: 'NONE', consent: false, persona: null, personaHistory: [], createdPersonas: 0, totalMindSpent: 0,
    paper: { id: 'MP4-COMPARISON-PAPER', holder: 'DESK' }, board: { id: 'MP4-LOCKED-BOARD', locked: true, marking: 'THREE_BLUE_LINES' }, bell: { id: 'MP4-ORIGINAL-BELL', marking: 'THREE_NOTCHES' }, ledger: { id: 'MP4-ORIGINAL-LEDGER', entry: 'PARCEL_SHELF_B' }, parcel: { id: 'MP4-PARCEL', location: 'SHELF_B' }, diagram: { id: 'MP4-INERT-DIAGRAM', nature: 'ORDINARY_INERT_PAPER', infections: 0 } },
    cases: { 'consenting-island': freshCase(), 'divided-attention': freshCase(), 'plague-model': freshCase() }, reflected: false };
}
export function manipulatorInside(s: SliceState): boolean { const p = s.manipulator.life.practice; return p.activeCase !== null || p.contact !== 'NONE' || p.persona !== null || p.paper.holder !== 'DESK'; }
export function validateManipulatorActivityCommand(v: unknown): v is ManipulatorActivityCommand {
  if (!record(v)) return false;
  if (['CONSENT', 'STOP', 'CREATE_PERSONA', 'PERSONA_TASK', 'WITHDRAW_PERSONA', 'RETURN_PAPER', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!MANIPULATOR_CASE_IDS.includes(v.caseId as ManipulatorCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'VERIFY'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isManipulatorActivity = validateManipulatorActivityCommand;
export function blockManipulatorActivity(s: SliceState, c: ManipulatorActivityCommand): string | null {
  if (!validateManipulatorActivityCommand(c)) return '操纵师生活命令无效。';
  if (!active(s) || s.status !== 'ACTIVE') return '须仍活着并已成为操纵师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原指导室。';
  if (hasManipulatorRitualLock(s) || ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status)) return '先收束当前实际集会或仓库遭遇。';
  const l = s.manipulator.life, p = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : p.activeCase ? l.cases[p.activeCase] : null;
  if (c.type === 'STOP') return p.activeCase === 'consenting-island' && p.contact === 'MIRA_MIND' ? null : '没有当前米拉心灵接触。';
  if (c.type === 'WITHDRAW_PERSONA') return p.activeCase === 'divided-attention' && p.persona ? null : '没有尚未重归的本人虚拟人格。';
  if (c.type === 'RETURN_PAPER') return p.activeCase === 'divided-attention' && p.paper.holder === 'OWNER' ? null : '没有本人正持的同一比较纸。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.contactOpen) {
    if (!r?.contactOpen || p.activeCase !== c.caseId) return '没有本项尚未收束的原现场。';
    if (p.contact !== 'NONE' || p.persona || p.paper.holder !== 'DESK' || !r.returned) return '先明确停止接触、重归人格、归还同一原纸；结束按钮不会代办。';
    return r.result !== 'NONE' && !r.verified ? '成功线索仍须在心灵之外实际复核。' : null;
  }
  if (c.type === 'VERIFY') return !r?.contactOpen || p.activeCase !== c.caseId || r.result === 'NONE' || r.verified ? '须有当前尚未核实的真实结果。' : p.contact !== 'NONE' || p.persona || p.paper.holder !== 'DESK' ? '先退出心灵、重归人格与归还原纸，再实际复核。' : null;
  if (c.type === 'CONSENT') { const m = l.cases['consenting-island']; return p.activeCase || m.status !== 'PREPARED' || m.method !== 'ABILITY' || m.consentWeek === s.week ? '只在本次能力准备后询问米拉当前同意，不能代他人同意或重复。' : null; }
  if (s.health <= 0 || s.mind <= 2) return '先恢复身体与精神，已有接触仍可0行动安全收束。';
  if (c.type === 'CREATE_PERSONA' || c.type === 'PERSONA_TASK') {
    if (p.activeCase !== 'divided-attention' || !r?.contactOpen || r.method !== 'ABILITY' || p.paper.holder !== 'OWNER') return '须在已付实施的原板与原铃能力实践内。';
    if (c.type === 'CREATE_PERSONA') return r.personaAttempted || p.persona ? '本次只创建一位；失败不能在同一次接触里刷人格。' : s.spirituality < 3 ? '创建需要3灵性与本人2精神。' : null;
    return !p.persona || p.persona.taskAttempted ? '须有本次尚未执行任务的实际人格。' : s.spirituality < 2 ? '这一次真实并行观察需要2灵性。' : null;
  }
  if (manipulatorInside(s)) return '先实际退出并收束当前生活现场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有本项尚未实施的准备。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || c.caseId !== id))) return '先实施或取消当前准备。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已经反思。' : MANIPULATOR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先报告三项实际经历。' : null;
  if (!r || !('caseId' in c)) return '未知原现场。';
  if (c.type === 'OBSERVE') { const previous = MANIPULATOR_CASE_IDS[MANIPULATOR_CASE_IDS.indexOf(c.caseId) - 1]; return r.status !== 'AVAILABLE' ? '已经保留原观察。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先完成上一项实际报告。' : null; }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原现场。' : r.attemptWeek === s.week ? '本周已经实施；收束后须下一真实周重试。' : c.caseId === 'plague-model' && c.method !== 'ORDINARY' ? '原图解是静物，本案只开放普通模拟。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.verified && r.returned ? null : '先取得结果并实际复核、归还与收束。';
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' ? '先准备本次实践。' : c.caseId === 'consenting-island' && r.method === 'ABILITY' && (r.consentWeek !== s.week || !p.consent) ? '先询问并记录米拉本周当下的自愿同意。' : c.caseId === 'consenting-island' && r.method === 'ABILITY' && s.spirituality < 3 ? '实际接触需3灵性。' : null;
  return '本项操作与当前状态不符。';
}
export function applyManipulatorActivity(s: SliceState, c: ManipulatorActivityCommand, ctx: SeerContext): void {
  const reason = blockManipulatorActivity(s, c); if (reason) throw new Error(reason);
  const l = s.manipulator.life, p = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : p.activeCase ? l.cases[p.activeCase] : null;
  if (c.type === 'CONSENT') { l.cases['consenting-island'].consentWeek = s.week; p.consent = true; ctx.note('米拉明确同意这一项当前接触', '原31岁成年人米拉自愿允许了解错归档包裹这一个当前担心；不授权其他记忆、改写意志或强迫证词。'); return; }
  if (c.type === 'STOP') { p.contact = 'NONE'; p.consent = false; r!.returned = true; ctx.note('明确退出原米拉的心灵接触', '精神接触现在已结束；消耗不返还，线索尚需亲自核对原账簿和原包裹。'); return; }
  if (c.type === 'CREATE_PERSONA') { s.spirituality -= 3; s.mind -= 2; p.totalMindSpent += 2; r!.personaAttempted = true; p.createdPersonas++; p.persona = { id: `MP4-P${p.createdPersonas}`, source: 'OWNER_MIND', createdWeek: s.week, rejoinedWeek: null, status: 'ACTIVE', taskAttempted: false, taskDone: false }; ctx.note('从本人形成一位实际虚拟人格', `${p.persona.id}来自本人的心灵，已付3灵性和2精神；没有独立肉体或实体手，本次只存在这一位。任务仍需另行选择。`); return; }
  if (c.type === 'PERSONA_TASK') { s.spirituality -= 2; p.persona!.taskAttempted = true; const ok = success(ctx.check('knowledge', 16).tier); p.persona!.taskDone = ok; if (ok) { r!.result = 'ABILITY'; r!.abilityUses = 1; } ctx.note('原板与原铃的一次真实并行观察', ok ? '人格实际关注锁定原板的三条蓝线，本人查看原铃三个缺口；付2灵性，得到有限比较结果。仍须重归与还纸。' : '付2灵性后并行注意失败，没有成功结果或掌握；不能在同次现场重试，仍须重归人格与还纸。'); return; }
  if (c.type === 'WITHDRAW_PERSONA') { p.persona!.status = 'REJOINED'; p.persona!.rejoinedWeek = s.week; p.personaHistory.push({ ...p.persona! }); p.persona = null; ctx.note('同一虚拟人格实际重归本人', '独立心灵存在与任务现在结束，保留实际创建、观察和重归历史；2精神与灵性不返还，没有远处自动工作。'); return; }
  if (c.type === 'RETURN_PAPER') { p.paper.holder = 'DESK'; r!.returned = true; ctx.note('亲手归还同一原纸', '本人把MP4-COMPARISON-PAPER放回同一原桌；没有复制纸张、人格实体或自动搬物。'); return; }
  if (c.type === 'VERIFY') { r!.verified = true; ctx.note('在精神接触之外实际复核', CASES.find(v => v.id === c.caseId)!.result); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { if (r!.contactOpen) { r!.contactOpen = false; r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; p.activeCase = null; } else { r!.status = 'OBSERVED'; r!.method = null; } p.consent = false; if (c.type === 'WITHDRAW') r!.withdrawals++; ctx.note('原生活现场实际收束', '本次真实费用、失败和精神损失保留；原人保持自己的意志，原物没有被重置。'); return; }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('manipulator-reflection'); ctx.note('反思心灵边界与真实代价', '三项有限生活理解，扮演+25（G）；静物模拟没有真实感染或额外掌握，不保证他人心灵可被控制。'); return; }
  if (!('caseId' in c)) throw new Error('未知操纵师生活命令。');
  const entry = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(entry.title, entry.story + entry.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; r!.consentWeek = null; p.consent = false; ctx.note('准备同一原现场', c.method === 'ABILITY' ? entry.ability : entry.ordinary); return; }
  if (c.type === 'REPORT') { r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r!.result === 'ABILITY') awardSeerMastery(s, `manipulator-case:${c.caseId}`, 8, ctx); else s.seer.completedSources.push(`manipulator-case:${c.caseId}`); ctx.note(entry.title, entry.result + (r!.result === 'ABILITY' ? '扮演25与既有已知池掌握8（G）。' : '扮演25（G），普通结果不加能力掌握。')); return; }
  r!.status = 'ACTIVE'; r!.contactOpen = true; r!.attemptWeek = s.week; r!.result = 'NONE'; r!.verified = false; r!.returned = c.caseId !== 'divided-attention'; r!.personaAttempted = false; r!.abilityUses = 0; p.activeCase = c.caseId;
  if (c.caseId === 'consenting-island') { const ability = r!.method === 'ABILITY'; if (ability) { s.spirituality -= 3; p.contact = 'MIRA_MIND'; r!.returned = false; } const ok = !ability || success(ctx.check('perception', 16).tier); if (ok) { r!.result = ability ? 'ABILITY' : 'ORDINARY'; r!.abilityUses = ability ? 1 : 0; } ctx.note('实际接触当前问题', ability ? `已付3灵性。${ok ? '只得到她担忧B架归档的一点心灵线索。' : '当前防御与注意使接触失败，没有线索。'}现在须明确STOP，不能重刷或强迫供述。` : '普通阅读同一可见账簿，发现B架条目；仍须亲自复核原包裹。'); return; }
  if (c.caseId === 'divided-attention') { p.paper.holder = 'OWNER'; if (r!.method === 'ORDINARY') r!.result = 'ORDINARY'; ctx.note('本人取用同一比较纸', r!.method === 'ABILITY' ? '实施时间已支付，原纸由本人持有；尚未创建人格或执行任务。' : '本人依次看原板三条蓝线与原铃三个缺口；普通比较结果成立，须亲手还纸。'); return; }
  if (success(ctx.check('knowledge', 14).tier)) r!.result = 'ORDINARY'; ctx.note('普通惰性图解模拟', r!.result === 'ORDINARY' ? '已辨明假想连线、原出口与自愿求助；真实感染0，能力掌握0，仍须明确复核并结束。' : '普通知识比较未成功；没有施术或感染，收束后下一真实周再试。');
}
export function manipulatorLifeActions(s: SliceState): ManipulatorLifeAction[] {
  if (!active(s)) return [];
  const out: ManipulatorLifeAction[] = [], l = s.manipulator.life;
  const add = (command: ManipulatorActivityCommand, label: string, cost: string) => { const reason = blockManipulatorActivity(s, command); out.push({ id: `manipulator-life-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const entry of CASES) { const r = l.cases[entry.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: entry.id }, `观察：${entry.title}`, '1行动');
    if (r.status === 'OBSERVED') { if (entry.id !== 'plague-model') add({ type: 'PREPARE', caseId: entry.id, method: 'ABILITY' }, '准备有限能力方式', '1行动'); add({ type: 'PREPARE', caseId: entry.id, method: 'ORDINARY' }, '准备普通比较', '1行动 · 不加能力掌握'); }
    if (r.status === 'PREPARED') { if (entry.id === 'consenting-island' && r.method === 'ABILITY') add({ type: 'CONSENT' }, '询问原米拉当前自愿同意', '0行动 · 仅当前问题'); add({ type: 'PERFORM', caseId: entry.id }, '实际实施原现场', '1行动 · 含明确退出子步骤'); add({ type: 'WITHDRAW', caseId: entry.id }, '取消尚未实施的准备', '0行动 · 不退款'); }
    if (r.contactOpen) { if (entry.id === 'consenting-island') add({ type: 'STOP' }, '停止米拉心灵接触', '0行动 · 不退款'); if (entry.id === 'divided-attention') { if (r.method === 'ABILITY') { add({ type: 'CREATE_PERSONA' }, '从本人创建一位虚拟人格', '0行动 · 3灵性＋本人2精神'); add({ type: 'PERSONA_TASK' }, '人格看原板，本人看原铃', '0行动 · 2灵性 · 知识16'); add({ type: 'WITHDRAW_PERSONA' }, '明确重归同一人格', '0行动 · 无退款'); } add({ type: 'RETURN_PAPER' }, '亲手归还同一比较纸', '0行动'); } add({ type: 'VERIFY', caseId: entry.id }, '在接触之外实际复核原物', '0行动'); add({ type: 'CLOSE', caseId: entry.id }, '结束已真实收束的现场', '0行动'); }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: entry.id }, '报告实际结果', '1行动 · 扮演25');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思有限心灵能力与责任', '1行动 · 三报告后扮演25');
  return out;
}
export function projectManipulatorLife(s: SliceState): ManipulatorLifeProjection { const l = s.manipulator.life; return { title: '操纵师生活：自愿心灵、有限人格与普通图解', source: '能力边界依据原著；所有场景、物品和数值为原创G。', environment: MANIPULATOR_ENVIRONMENT, insideCase: manipulatorInside(s), practice: structuredClone(l.practice), reflected: l.reflected, cases: CASES.map(entry => { const r = l.cases[entry.id]; return { id: entry.id, title: entry.title, story: entry.story, observations: r.status === 'AVAILABLE' ? [] : [...entry.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? entry.ability : entry.ordinary : null, result: r.result !== 'NONE' ? r.contactOpen ? '已获得有限结果，仍须实际退出、核实与收束。' : entry.result : r.attemptWeek !== null ? '尚无成功结果；真实费用和精神损失保留。' : null, status: r.status, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes }; }) }; }
export function validateManipulatorLifeState(s: SliceState): boolean {
  const l = s.manipulator?.life;
  if (!record(l) || !shape(l, ['practice', 'cases', 'reflected']) || typeof l.reflected !== 'boolean') return false;
  const p = l.practice, fresh = createManipulatorLifeState().practice;
  if (!record(p) || !shape(p, Object.keys(fresh)) || ![null, ...MANIPULATOR_CASE_IDS].includes(p.activeCase) || !['NONE', 'MIRA_MIND'].includes(p.contact) || typeof p.consent !== 'boolean' || !integer(p.createdPersonas) || !integer(p.totalMindSpent) || p.totalMindSpent !== p.createdPersonas * 2 || !Array.isArray(p.personaHistory)) return false;
  for (const key of ['board', 'bell', 'ledger', 'parcel', 'diagram'] as const) if (stableStringify(p[key]) !== stableStringify(fresh[key])) return false;
  if (!record(p.paper) || !shape(p.paper, ['id', 'holder']) || p.paper.id !== fresh.paper.id || !['DESK', 'OWNER'].includes(p.paper.holder)) return false;
  const personas = [...p.personaHistory, ...(p.persona ? [p.persona] : [])];
  if (personas.length !== p.createdPersonas || personas.some((v, i) => !record(v) || !shape(v, ['id', 'source', 'createdWeek', 'rejoinedWeek', 'status', 'taskAttempted', 'taskDone']) || v.id !== `MP4-P${i + 1}` || v.source !== 'OWNER_MIND' || !integer(v.createdWeek, s.manipulator.promotionWeek ?? 0, s.week) || !['ACTIVE', 'REJOINED'].includes(v.status) || typeof v.taskAttempted !== 'boolean' || typeof v.taskDone !== 'boolean' || v.taskDone && !v.taskAttempted || (v.status === 'ACTIVE' ? v.rejoinedWeek !== null || v !== p.persona : !integer(v.rejoinedWeek, v.createdWeek, s.week)))) return false;
  if (p.personaHistory.some(v => v.status !== 'REJOINED') || p.persona && (p.persona.status !== 'ACTIVE' || p.activeCase !== 'divided-attention')) return false;
  if (!record(l.cases) || !shape(l.cases, MANIPULATOR_CASE_IDS)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, id] of MANIPULATOR_CASE_IDS.entries()) { const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || ![r.contactOpen, r.verified, r.returned, r.personaAttempted].every(v => typeof v === 'boolean') || !integer(r.closes) || !integer(r.withdrawals) || !integer(r.abilityUses, 0, 1)) return false;
    if ([r.observedWeek, r.attemptWeek, r.consentWeek].some(v => v !== null && !integer(v, s.manipulator.promotionWeek ?? 0, s.week)) || r.attemptWeek !== null && (r.observedWeek === null || r.attemptWeek < r.observedWeek)) return false;
    if (r.status === 'AVAILABLE' ? stableStringify(r) !== stableStringify(freshCase()) : r.observedWeek === null || s.manipulator.promotionWeek === null || i > 0 && l.cases[MANIPULATOR_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen) return false; }
    if (r.contactOpen) { open++; if (p.activeCase !== id || r.status !== 'ACTIVE' || r.attemptWeek !== s.week || !active(s) || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || hasManipulatorRitualLock(s) || ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status)) return false; }
    if ((r.status === 'ACTIVE') !== r.contactOpen || r.result === 'ABILITY' && (r.method !== 'ABILITY' || r.abilityUses !== 1) || r.abilityUses === 1 && r.result !== 'ABILITY' || r.result === 'ORDINARY' && (r.method !== 'ORDINARY' || r.abilityUses !== 0) || r.verified && r.result === 'NONE') return false;
    if (id === 'plague-model' && (r.method === 'ABILITY' || r.result === 'ABILITY' || r.abilityUses > 0) || r.personaAttempted && (id !== 'divided-attention' || r.method !== 'ABILITY') || r.consentWeek !== null && id !== 'consenting-island') return false;
    if (r.result !== 'NONE' && r.attemptWeek === null || ['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.verified || !r.returned || r.closes < 1 || r.contactOpen)) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(v => v === `manipulator-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (open > 1 || prepared > 1 || open > 0 && prepared > 0 || (p.activeCase !== null) !== (open === 1)) return false;
  if (p.contact === 'MIRA_MIND' && (p.activeCase !== 'consenting-island' || !p.consent || l.cases['consenting-island'].method !== 'ABILITY' || l.cases['consenting-island'].consentWeek !== s.week || l.cases['consenting-island'].returned)) return false;
  if (p.paper.holder === 'OWNER' && (p.activeCase !== 'divided-attention' || l.cases['divided-attention'].returned)) return false;
  if (!p.activeCase && (p.contact !== 'NONE' || p.persona || p.paper.holder !== 'DESK')) return false;
  if (l.reflected && resolved !== 3 || s.seer.completedSources.filter(v => v === 'manipulator-reflection').length !== (l.reflected ? 1 : 0)) return false;
  return s.manipulator.promotionWeek !== null || stableStringify(l) === stableStringify(createManipulatorLifeState());
}
