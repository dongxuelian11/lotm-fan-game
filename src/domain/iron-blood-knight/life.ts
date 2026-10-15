import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { dismissIronBloodMembers, findIronBloodMember, hasIronBloodRite } from './team.js';
import type { IronBloodKnightAction } from './types.js';

export const IRON_BLOOD_CASE_IDS = ['steel-load', 'linked-carry', 'flame-clearance'] as const;
export type IronBloodCaseId = typeof IRON_BLOOD_CASE_IDS[number];
export type IronBloodActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW'; caseId: IronBloodCaseId }
  | { type: 'PREPARE'; caseId: IronBloodCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'RETURN_TOOL' | 'EXIT_FORM' | 'START_LINK' | 'LOAD_PULSE' | 'STOP_LINK' | 'FLAME_OUT' | 'FLAME_BACK' | 'RETURN_ORDINARY' | 'REFLECT' };
export interface IronBloodCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; closes: number; withdrawals: number;
  outwardAttempted: boolean; returnAttempted: boolean; abilityUses: number; returned: boolean; linkStarted: boolean;
  pulse: null | { ownerDamage: 2 | 4; memberIds: string[]; memberDamage: 0 | 1 };
}
export interface IronBloodPractice {
  activeCase: IronBloodCaseId | null; form: 'HUMAN' | 'STEEL' | 'FLAME'; ownerNode: 'NEAR' | 'FAR'; linkedMemberIds: string[];
  beam: { id: 'IB4-BEAM-1'; source: string; massKg: 12; holder: 'CRADLE' | 'OWNER' };
  crate: { id: 'IB4-CRATE-1'; source: string; massKg: 14; holder: 'CRADLE' | 'OWNER' };
  clothes: { id: 'IB4-OWNED-CLOTHES'; holder: 'OWNER' };
  route: { id: 'IB4-CLEAR-GROUND-ROUTE'; distanceMetres: 3; clear: true };
}
export interface IronBloodLifeState { practice: IronBloodPractice; cases: Record<IronBloodCaseId, IronBloodCaseState>; reflected: boolean }
export interface IronBloodCaseProjection {
  id: IronBloodCaseId; title: string; story: string; observations: string[]; preparation: string | null;
  result: string | null; status: string; contactOpen: boolean; returned: boolean; closes: number;
}
export interface IronBloodLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean; practice: IronBloodPractice;
  cases: IronBloodCaseProjection[]; reflected: boolean;
}
const PAIR = ['IB4-01', 'IB4-02'] as const;
const BEAM_SOURCE = '原创G：原石院登记的唯一12公斤训练梁与原静置支架';
const CRATE_SOURCE = '原创G：原石院登记的唯一14公斤练习箱与原静置支架';
const CASES = [
  { id: 'steel-load', title: '十二公斤原梁与有限钢铁姿态',
    story: '原石院教员莉迪亚把同一12公斤训练梁置于原支架。她要你短时接住受控负载，再把原梁放回；可以普通受力，也可以实际钢铁化后检验身体承载。（原创G）',
    facts: ['原梁12公斤，始终只有一根；实施时本人接住，结束前必须亲手放回同一支架。', '钢铁姿态3灵性、体魄14；失败健康−2，不免伤、不永久钢铁化。普通方式同样体魄14但不耗灵。'],
    ability: '准备本人短时钢铁姿态与原支架；实施才付3灵性并承载同一原梁。', ordinary: '准备普通受控承载；不用非凡能力，失败仍有少量真实损伤。', result: '同一原梁已放回支架，本人已退出形态，实际受力结论留在记录里。' },
  { id: 'linked-carry', title: '同一原箱与两位真正到场的战友',
    story: '艾达IB4-01与本尼特IB4-02是原第一组的两位成年人。若当前同意且健康精力足够，他们会在实施时实际来院。你们用原14公斤练习箱体验一次有限负载；普通独自承载也能得出比较结论。（原创G）',
    facts: ['只有实际到场且当前愿意的两位原队友能够建立联系，30人容量不产生30位帮手。', '建立联系3灵性；一次G负载4健康，实际联系时本人2、原01/02各1，否则本人4。', '停止联系后两人实际回家，所受损伤保留；还须把同一原箱放回支架。'],
    ability: '准备核对原01/02的当前同意与状态；实施时两人真实到场，之后单独选择建立联系和负载。', ordinary: '准备本人普通承载原箱，不请出复制队友，也不建立联系。', result: '同一原箱已放回，实际联系已停止，原同伴沿原路回家且健康损失仍在。' },
  { id: 'flame-clearance', title: '三米冷石地面上的原身体去回',
    story: '莉迪亚在原冷石院画出相距3米的近端与远端粉笔记号，中间地面净空。你亲自移动到远端核对记号，再回到近端；普通走路和有限火焰化都可尝试。（原创G）',
    facts: ['火焰化沿同一3米净空地面行进，不是飞行、传送、穿墙或跳火。', '能力去程3灵性、感知14；能力返程另3灵性且独立检定。普通原路返程0灵性，结束前明确退出形态。', '此有限G练习中身上原衣物仍属于本人并随同一个身体去回；没有复制、留下分身或普遍不燃保证。'],
    ability: '准备原冷石地面与近远粉笔端点；实施后选择真实火焰化去程。', ordinary: '准备沿同一原地面亲自走到远端看粉笔记号，再普通返回。', result: '本人沿原地面回到近端、退出火焰形态，仍是同一个身体和同一身原衣物。' },
] as const;
export const IRON_BLOOD_ENVIRONMENT = '三项原场景、物体、检定、距离与预算为原创G。观察、准备、实施、报告各1行动；实施支付有限去回与收束时间，后续子步骤0行动仍实际耗灵和健康。每项报告扮演25，三项后反思25；只有真实成功能力实践取得既有已知池单项掌握8，普通结果同样可完成扮演100。原物归还、实际返程、停止联系和退出形态都须明确完成，CLOSE不搬动物体或身体。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 4;
const freshCase = (): IronBloodCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, closes: 0, withdrawals: 0, outwardAttempted: false, returnAttempted: false, abilityUses: 0, returned: false, linkStarted: false, pulse: null });
export function createIronBloodLifeState(): IronBloodLifeState {
  return { practice: { activeCase: null, form: 'HUMAN', ownerNode: 'NEAR', linkedMemberIds: [],
    beam: { id: 'IB4-BEAM-1', source: BEAM_SOURCE, massKg: 12, holder: 'CRADLE' }, crate: { id: 'IB4-CRATE-1', source: CRATE_SOURCE, massKg: 14, holder: 'CRADLE' },
    clothes: { id: 'IB4-OWNED-CLOTHES', holder: 'OWNER' }, route: { id: 'IB4-CLEAR-GROUND-ROUTE', distanceMetres: 3, clear: true } },
    cases: { 'steel-load': freshCase(), 'linked-carry': freshCase(), 'flame-clearance': freshCase() }, reflected: false };
}
export function ironBloodInside(s: SliceState): boolean {
  const f = s.ironBloodKnight.life.practice;
  return f.activeCase !== null || f.form !== 'HUMAN' || f.ownerNode !== 'NEAR' || f.linkedMemberIds.length > 0 || f.beam.holder !== 'CRADLE' || f.crate.holder !== 'CRADLE';
}
export const ironBloodPractice = (s: SliceState): IronBloodPractice => structuredClone(s.ironBloodKnight.life.practice);
export function validateIronBloodActivityCommand(v: unknown): v is IronBloodActivityCommand {
  if (!record(v)) return false;
  if (['RETURN_TOOL', 'EXIT_FORM', 'START_LINK', 'LOAD_PULSE', 'STOP_LINK', 'FLAME_OUT', 'FLAME_BACK', 'RETURN_ORDINARY', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!IRON_BLOOD_CASE_IDS.includes(v.caseId as IronBloodCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isIronBloodActivity = validateIronBloodActivityCommand;
function availablePair(s: SliceState): boolean { return PAIR.every(id => { const m = findIronBloodMember(s, id); return !!m && m.joined && m.willing && m.health >= 80 && m.energy >= 8 && !m.present && m.location === 'HOME'; }); }
function presentPair(s: SliceState): boolean { return PAIR.every(id => { const m = findIronBloodMember(s, id); return !!m && m.joined && m.willing && m.health >= 80 && m.energy >= 8 && m.present && m.location === 'YARD'; }); }
export function blockIronBloodActivity(s: SliceState, c: IronBloodActivityCommand): string | null {
  if (!validateIronBloodActivityCommand(c)) return '铁血骑士生活命令无效。';
  if (s.status !== 'ACTIVE' || !active(s)) return '须仍活着并已成为铁血骑士。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原石院，不能从异地收束传回。';
  if (hasIronBloodRite(s) || ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status)) return '先让实际仪式集合或原院遭遇结束。';
  if (Object.values(s.reaper.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.practice.windowOpen) || Object.values(s.conspirator.cases).some(v => v.contactOpen || v.status === 'PREPARED')) return '先结束旧收割者或阴谋家的实际接触与准备。';
  const l = s.ironBloodKnight.life, f = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : f.activeCase ? l.cases[f.activeCase] : null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.contactOpen) {
    if (!r?.contactOpen || f.activeCase !== c.caseId) return '没有这一项尚未收束的原现场。';
    if (!r.returned || f.ownerNode !== 'NEAR' || f.beam.holder !== 'CRADLE' || f.crate.holder !== 'CRADLE') return '先实际沿原路返回并归还原物，结束按钮不能瞬移。';
    return f.form !== 'HUMAN' || f.linkedMemberIds.length || f.activeCase === 'linked-carry' && PAIR.some(id => findIronBloodMember(s, id)?.present) ? '先明确退出形态、停止联系并让原同伴实际回家。' : null;
  }
  if (c.type === 'EXIT_FORM') return f.activeCase && f.form !== 'HUMAN' ? null : '没有本次实践中的实际形态需要退出。';
  if (c.type === 'STOP_LINK') return f.activeCase === 'linked-carry' && (f.linkedMemberIds.length > 0 || PAIR.some(id => findIronBloodMember(s, id)?.present)) ? null : '没有本次实际联系或尚在场的两位原同伴。';
  if (c.type === 'RETURN_TOOL') return f.activeCase && f.ownerNode === 'NEAR' && (f.beam.holder === 'OWNER' || f.crate.holder === 'OWNER') ? null : '本人和待归还的同一原物须在原近端支架旁。';
  if (c.type === 'RETURN_ORDINARY') return f.activeCase === 'flame-clearance' ? null : '本项须在原三米地面现场，其他原梁或箱要明确归还。';
  if (s.health <= 4 || s.mind <= 0) return '先恢复身体和精神；已有现场仍可0行动实际返回、还物、断联及退出形态。';
  if (['START_LINK', 'LOAD_PULSE', 'FLAME_OUT', 'FLAME_BACK'].includes(c.type)) {
    if (!r?.contactOpen || r.returned) return '先支付实施并展开相应原现场，已经收回后不能重开。';
    if (c.type === 'LOAD_PULSE') return f.activeCase !== 'linked-carry' || f.crate.holder !== 'OWNER' ? '须亲自在原支架旁持有同一14公斤原箱。' : r.outwardAttempted ? '本次有限负载已经实际发生，不重复付伤刷结果。' : f.linkedMemberIds.length > 0 && !presentPair(s) ? '实际联系的两位原同伴当前状态不再足够；可以停止联系，再自己承担。' : null;
    if (r.method !== 'ABILITY') return '这次准备的是普通方式，不会伪称非凡施术。';
    if (c.type === 'START_LINK') return f.activeCase !== 'linked-carry' || r.linkStarted || r.outwardAttempted || !presentPair(s) ? '须尚未负载的两位原同伴真实在场、同意且健康精力足够；本次仅建立一次联系。' : s.spirituality < 3 ? '实际建立联系需要3灵性。' : null;
    if (f.activeCase !== 'flame-clearance') return '须在原三米冷石地面实践中。';
    if (c.type === 'FLAME_OUT' ? r.outwardAttempted || f.ownerNode !== 'NEAR' : r.returnAttempted || r.abilityUses !== 1 || f.ownerNode !== 'FAR') return '本段已尝试，或本人不在对应的原近远端。';
    return s.spirituality < 3 ? '本段需要3灵性，普通原路返程仍可0灵性选择。' : null;
  }
  if (ironBloodInside(s)) return '先实际返回、归还原物、退出形态并结束当前现场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消已经支付的当前准备。';
  if (s.ironBloodKnight.team.restRequestedWeek !== null) return '两位原成员仍在已付休整中，先等真实跨周并确认恢复。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已完成这三项实践的反思。' : IRON_BLOOD_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先报告三项已经实际结束的经历。' : null;
  if (!r || !('caseId' in c)) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不重复领奖。';
  if (c.type === 'OBSERVE') { const previous = IRON_BLOOD_CASE_IDS[IRON_BLOOD_CASE_IDS.indexOf(c.caseId) - 1]; return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先完成上一项真实报告。' : null; }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原现场。' : r.attemptWeek === s.week ? '本周已实施；失败收束后须下一真实周才可再准备。' : c.method === 'ABILITY' && c.caseId === 'linked-carry' && !availablePair(s) ? '原01/02须均已加入、当前愿意、在家且健康≥80精力≥8；也可普通独自承载。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '须实际取得结果并返回、还物、断联、退出形态与收束。';
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' ? '先准备本次实际实践。' : r.method === 'ABILITY' && c.caseId === 'linked-carry' && !availablePair(s) ? '原01/02此刻不能真实到场，可取消准备改普通方式。' : r.method === 'ABILITY' && c.caseId === 'steel-load' && s.spirituality < 3 ? '本次实际钢铁姿态需要3灵性。' : null;
  return '先准备并实施对应的原现场。';
}
export function applyIronBloodActivity(s: SliceState, c: IronBloodActivityCommand, ctx: SeerContext): void {
  const reason = blockIronBloodActivity(s, c); if (reason) throw new Error(reason);
  const l = s.ironBloodKnight.life, f = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : f.activeCase ? l.cases[f.activeCase] : null;
  if (c.type === 'EXIT_FORM') { f.form = 'HUMAN'; ctx.note('同一身体明确退出形态', '实际恢复人类形态，原身体仍在当前近端或远端，原衣物仍由本人携带；没有移动、治疗或返还灵性。'); return; }
  if (c.type === 'STOP_LINK') { f.linkedMemberIds = []; dismissIronBloodMembers(s, PAIR); ctx.note('停止实际联系，原同伴回家', '原01/02沿已知出口真正回家，所受健康与精力代价保留；并没有生成替身或恢复满血。'); return; }
  if (c.type === 'RETURN_TOOL') { f.beam.holder = 'CRADLE'; f.crate.holder = 'CRADLE'; r!.returned = true; ctx.note('本人亲手归还同一原物', '0行动、0灵性，时间含已付实践；把正在持有的同一原梁或原箱放回近端原支架。身体、物体和已付代价没有被重置。'); return; }
  if (c.type === 'RETURN_ORDINARY') { f.ownerNode = 'NEAR'; r!.returned = true; ctx.note('同一身体沿原三米地面返回', '本人从当前所在端点沿始终净空的原地面实际返回近端，原衣物随同；0行动、0灵性。形态若尚未退出，还须明确退出，不是瞬移。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (r!.contactOpen) { r!.contactOpen = false; r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; f.activeCase = null; }
    else { r!.status = 'OBSERVED'; r!.method = null; }
    if (c.type === 'WITHDRAW') r!.withdrawals++;
    ctx.note('原生活现场真实结束', '已经实际返回、归还原物、停止联系并退出形态；本次费用、真实损失和成员共同历史全部保留。'); return;
  }
  if (c.type === 'START_LINK') { s.spirituality -= 3; r!.linkStarted = true; f.linkedMemberIds = [...PAIR]; ctx.note('联系两位此刻真正到场的原战友', '主人实际支付3灵性，原01/02当前同意且在近端；联系只覆盖这两具原身体。还没有发生负载，也没有自动增加其他28人。'); return; }
  if (c.type === 'LOAD_PULSE') {
    const linked = f.linkedMemberIds.length === 2;
    const ownerDamage = linked ? 2 : 4; s.health -= ownerDamage;
    if (linked) for (const id of f.linkedMemberIds) findIronBloodMember(s, id)!.health--;
    r!.outwardAttempted = true; r!.pulse = { ownerDamage, memberIds: linked ? [...f.linkedMemberIds] : [], memberDamage: linked ? 1 : 0 };
    r!.result = linked ? 'ABILITY' : 'ORDINARY'; r!.abilityUses = linked ? 1 : 0;
    ctx.note('同一14公斤原箱的有限负载', linked ? '实际4点G健康负载由本人2、艾达1、本尼特1承担；三人的当前健康真正下降。现在须停止联系、让原同伴回家并归还原箱。' : '没有实际联系，本人独自承担4健康；这是普通受力结果，不能获得能力掌握。还须亲手归还原箱。'); return;
  }
  if (c.type === 'FLAME_OUT' || c.type === 'FLAME_BACK') {
    const back = c.type === 'FLAME_BACK'; s.spirituality -= 3; f.form = 'FLAME';
    if (back) r!.returnAttempted = true; else r!.outwardAttempted = true;
    const outcome = ctx.check('perception', 14).tier;
    if (success(outcome)) { f.ownerNode = back ? 'NEAR' : 'FAR'; r!.abilityUses++; r!.result = 'ABILITY'; if (back) r!.returned = true; }
    ctx.note(back ? '原身体火焰化沿地面返程' : '原身体火焰化沿地面去程', success(outcome) ? `本段3灵性已付，同一身体沿原3米净空地面移动到${back ? '近端' : '远端'}；没有飞行、跳火、穿墙或传送。原衣物仍随本人，形态须明确退出。` : '本段3灵性照付，移动失败，原身体与原衣物留在原端点；本段不能重刷，仍可0灵性沿原路实际返回并退出形态。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('iron-blood-reflection'); ctx.note('把同一身体和真正的战友放回经历里', '你区分有限钢铁受力、原战友真实分担与沿地面的形态移动；普通比较也形成真实理解。G扮演+25，不额外伪增能力掌握。'); return; }
  if (!('caseId' in c)) throw new Error('未知铁血骑士生活命令。');
  const p = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; r!.linkStarted = false; ctx.note('准备同一原现场，尚未施术', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') { r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); if (r!.result === 'ABILITY') awardSeerMastery(s, `iron-blood-case:${c.caseId}`, 8, ctx); else s.seer.completedSources.push(`iron-blood-case:${c.caseId}`); ctx.note(p.title, p.result + (r!.result === 'ABILITY' ? 'G扮演+25，真实能力结果获得既有已知池单项掌握8。' : 'G扮演+25；普通结果没有能力掌握奖励。')); return; }
  r!.status = 'ACTIVE'; r!.contactOpen = true; r!.attemptWeek = s.week; r!.result = 'NONE'; r!.returned = false;
  r!.outwardAttempted = false; r!.returnAttempted = false; r!.abilityUses = 0; r!.linkStarted = false; r!.pulse = null; f.activeCase = c.caseId;
  if (c.caseId === 'steel-load') {
    f.beam.holder = 'OWNER'; r!.outwardAttempted = true;
    if (r!.method === 'ABILITY') { s.spirituality -= 3; f.form = 'STEEL'; }
    const outcome = ctx.check('physique', 14).tier;
    if (success(outcome)) { r!.result = r!.method!; if (r!.method === 'ABILITY') r!.abilityUses = 1; }
    else s.health -= 2;
    ctx.note('本人实际承载唯一12公斤原梁', `${r!.method === 'ABILITY' ? '实际3灵性钢铁姿态已付。' : '普通受力，不施术。'}${success(outcome) ? '受控负载成功，取得本次真实结果。' : '本次承载失败，健康−2，钢铁没有使你免伤。'}同一原梁仍由本人托住，必须亲手放回原支架，再退出形态并收束。`); return;
  }
  if (c.caseId === 'linked-carry') {
    f.crate.holder = 'OWNER';
    if (r!.method === 'ABILITY') for (const id of PAIR) { const m = findIronBloodMember(s, id)!; m.present = true; m.location = 'YARD'; }
    ctx.note('原箱由本人托住，实施时间已支付', r!.method === 'ABILITY' ? '原艾达与本尼特再次确认同意后实际来到近端。可以单独建立联系，再施加一次真实负载；尚未发生任何分担。' : '本人普通托住同一原箱，尚未施加一次有限负载；没有同伴被自动召来。'); return;
  }
  if (r!.method === 'ORDINARY') { f.ownerNode = 'FAR'; r!.outwardAttempted = true; r!.result = 'ORDINARY'; }
  ctx.note('原三米冷石现场已实施', r!.method === 'ABILITY' ? '1行动实施包已支付。原身体仍在近端，去程尚须明确选择、实际耗灵并检定。' : '本人已经沿原净空地面走到远端核对原粉笔记号；同一身衣物随行，还须选择普通实际返程。');
}
export function ironBloodActions(s: SliceState): IronBloodKnightAction[] {
  if (!active(s)) return [];
  const out: IronBloodKnightAction[] = [], l = s.ironBloodKnight.life;
  const add = (command: IronBloodActivityCommand, label: string, cost: string) => { const reason = blockIronBloodActivity(s, command); out.push({ id: `iron-blood-life-${'caseId' in command ? `${command.caseId}-` : ''}${command.type.toLowerCase()}${'method' in command ? `-${command.method.toLowerCase()}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = l.cases[p.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: p.id }, `观察：${p.title}`, '1行动');
    if (r.status === 'OBSERVED') { add({ type: 'PREPARE', caseId: p.id, method: 'ABILITY' }, '准备真实能力方式', '1行动 · 尚未施术'); add({ type: 'PREPARE', caseId: p.id, method: 'ORDINARY' }, '准备普通实际比较', '1行动 · 不使用非凡能力'); }
    if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId: p.id }, '实际实施原现场', p.id === 'steel-load' && r.method === 'ABILITY' ? '1行动 · 3灵性 · 体魄14' : '1行动 · 含有限子步骤与实际返程'); add({ type: 'WITHDRAW', caseId: p.id }, '取消尚未实施的准备', '0行动 · 不退款'); }
    if (r.contactOpen) {
      if (p.id === 'linked-carry') { if (r.method === 'ABILITY') add({ type: 'START_LINK' }, '联系实际在场的原艾达与本尼特', '0行动 · 3灵性'); add({ type: 'LOAD_PULSE' }, '让原箱施加一次有限负载', '0行动 · 共4健康 · 实际联系时本人2、两人各1'); add({ type: 'STOP_LINK' }, '停止联系并让两位原同伴实际回家', '0行动 · 损伤不返还'); }
      if (p.id === 'flame-clearance') { if (r.method === 'ABILITY') { add({ type: 'FLAME_OUT' }, '火焰化沿原地面到三米远端', '0行动 · 3灵性 · 感知14'); add({ type: 'FLAME_BACK' }, '火焰化沿原地面返回近端', '0行动 · 另3灵性 · 独立感知14'); } add({ type: 'RETURN_ORDINARY' }, '沿原三米净空地面实际走回', '0行动 · 0灵性'); }
      else add({ type: 'RETURN_TOOL' }, '亲手把同一原物放回原支架', '0行动 · 0灵性');
      if (l.practice.form !== 'HUMAN') add({ type: 'EXIT_FORM' }, '让同一身体明确退出形态', '0行动 · 不改变当前位置');
      add({ type: 'CLOSE', caseId: p.id }, '收束已经真实处理的原现场', '0行动 · 须实际返回、还物、断联和退出形态');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: p.id }, '报告已经实际收束的结果', '1行动 · 扮演25 · 实际能力结果才有掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思有限形态、同伴与实际代价', '1行动 · 三报告后扮演25');
  return out;
}
export const ironBloodLifeActions = ironBloodActions;
export function projectIronBloodLife(s: SliceState): IronBloodLifeProjection {
  const l = s.ironBloodKnight.life;
  return { title: '有限生活：原身体、原工具与两位真正的战友', source: '形态与战友联系依据原著；三项场景、距离、原物与量化成本均为原创G。', environment: IRON_BLOOD_ENVIRONMENT, insideCase: ironBloodInside(s), practice: ironBloodPractice(s), reflected: l.reflected,
    cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
      result: r.result !== 'NONE' ? r.contactOpen ? '真实结果已发生，仍须实际返程、还物、断联、退出形态并结束。' : `${p.result}${r.result === 'ABILITY' ? '实际能力结果。' : '普通结果，无能力掌握。'}` : r.attemptWeek !== null ? '尚无成功结果；原身体、费用和损失保留。' : null,
      status: r.status, contactOpen: r.contactOpen, returned: r.returned, closes: r.closes }; }) };
}
export function validateIronBloodLife(s: SliceState): boolean {
  const l = s.ironBloodKnight?.life;
  if (!record(l) || !shape(l, ['practice', 'cases', 'reflected']) || typeof l.reflected !== 'boolean') return false;
  const f = l.practice;
  if (!record(f) || !shape(f, ['activeCase', 'form', 'ownerNode', 'linkedMemberIds', 'beam', 'crate', 'clothes', 'route']) || ![null, ...IRON_BLOOD_CASE_IDS].includes(f.activeCase) || !['HUMAN', 'STEEL', 'FLAME'].includes(f.form) || !['NEAR', 'FAR'].includes(f.ownerNode) || !Array.isArray(f.linkedMemberIds) || ![0, 2].includes(f.linkedMemberIds.length) || f.linkedMemberIds.some((id, i) => id !== PAIR[i])) return false;
  if (!record(f.beam) || !shape(f.beam, ['id', 'source', 'massKg', 'holder']) || f.beam.id !== 'IB4-BEAM-1' || f.beam.source !== BEAM_SOURCE || f.beam.massKg !== 12 || !['CRADLE', 'OWNER'].includes(f.beam.holder)) return false;
  if (!record(f.crate) || !shape(f.crate, ['id', 'source', 'massKg', 'holder']) || f.crate.id !== 'IB4-CRATE-1' || f.crate.source !== CRATE_SOURCE || f.crate.massKg !== 14 || !['CRADLE', 'OWNER'].includes(f.crate.holder)) return false;
  if (!record(f.clothes) || !shape(f.clothes, ['id', 'holder']) || f.clothes.id !== 'IB4-OWNED-CLOTHES' || f.clothes.holder !== 'OWNER' || !record(f.route) || !shape(f.route, ['id', 'distanceMetres', 'clear']) || f.route.id !== 'IB4-CLEAR-GROUND-ROUTE' || f.route.distanceMetres !== 3 || f.route.clear !== true) return false;
  if (!record(l.cases) || !shape(l.cases, IRON_BLOOD_CASE_IDS)) return false;
  const week = (v: unknown) => v === null || integer(v, s.ironBloodKnight.promotionWeek ?? 0, s.week);
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, id] of IRON_BLOOD_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attemptWeek', 'method', 'result', 'contactOpen', 'closes', 'withdrawals', 'outwardAttempted', 'returnAttempted', 'abilityUses', 'returned', 'linkStarted', 'pulse']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result)) return false;
    if (![r.contactOpen, r.outwardAttempted, r.returnAttempted, r.returned, r.linkStarted].every(v => typeof v === 'boolean') || !integer(r.closes) || !integer(r.withdrawals) || !integer(r.abilityUses, 0, id === 'flame-clearance' ? 2 : 1) || !week(r.observedWeek) || !week(r.attemptWeek) || r.attemptWeek !== null && (r.observedWeek === null || r.attemptWeek < r.observedWeek)) return false;
    if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(freshCase()) || r.status !== 'AVAILABLE' && (r.observedWeek === null || s.ironBloodKnight.promotionWeek === null) || i > 0 && r.status !== 'AVAILABLE' && l.cases[IRON_BLOOD_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen) return false; }
    if (r.contactOpen) { open++; if (f.activeCase !== id || r.status !== 'ACTIVE' || r.attemptWeek !== s.week || !active(s) || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || hasIronBloodRite(s) || ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status)) return false; }
    if ((r.status === 'ACTIVE') !== r.contactOpen || r.result === 'ABILITY' && (r.method !== 'ABILITY' || r.abilityUses < 1) || r.abilityUses > 0 && (r.result !== 'ABILITY' || !r.outwardAttempted) || r.result === 'ORDINARY' && (r.abilityUses !== 0 || !r.outwardAttempted)) return false;
    if (r.returnAttempted && (id !== 'flame-clearance' || r.method !== 'ABILITY' || r.abilityUses < 1 || !r.outwardAttempted) || r.linkStarted && (id !== 'linked-carry' || r.method !== 'ABILITY')) return false;
    if ((r.result !== 'NONE' || r.returned || r.outwardAttempted || r.returnAttempted || r.linkStarted) && r.attemptWeek === null) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || !r.returned || r.closes < 1 || r.contactOpen)) return false;
    if (r.pulse !== null) { const p = r.pulse; if (id !== 'linked-carry' || !record(p) || !shape(p, ['ownerDamage', 'memberIds', 'memberDamage']) || !Array.isArray(p.memberIds) || !r.outwardAttempted || r.result === 'NONE') return false; if (r.result === 'ABILITY' ? p.ownerDamage !== 2 || p.memberDamage !== 1 || p.memberIds.length !== 2 || p.memberIds.some((v, n) => v !== PAIR[n]) || !r.linkStarted : p.ownerDamage !== 4 || p.memberDamage !== 0 || p.memberIds.length !== 0) return false; }
    if (id === 'linked-carry' && r.outwardAttempted !== (r.pulse !== null) || id !== 'linked-carry' && r.linkStarted) return false;
    if (r.contactOpen && r.returned && (f.ownerNode !== 'NEAR' || f.beam.holder !== 'CRADLE' || f.crate.holder !== 'CRADLE')) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(v => v === `iron-blood-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (open > 1 || prepared > 1 || open > 0 && prepared > 0 || (f.activeCase !== null) !== (open === 1)) return false;
  if (!f.activeCase && (f.form !== 'HUMAN' || f.ownerNode !== 'NEAR' || f.beam.holder !== 'CRADLE' || f.crate.holder !== 'CRADLE' || f.linkedMemberIds.length)) return false;
  if (f.form === 'STEEL' && (f.activeCase !== 'steel-load' || l.cases['steel-load'].method !== 'ABILITY') || f.form === 'FLAME' && (f.activeCase !== 'flame-clearance' || l.cases['flame-clearance'].method !== 'ABILITY') || f.ownerNode === 'FAR' && f.activeCase !== 'flame-clearance') return false;
  if (f.beam.holder === 'OWNER' && f.activeCase !== 'steel-load' || f.crate.holder === 'OWNER' && f.activeCase !== 'linked-carry') return false;
  if (f.activeCase === 'steel-load' && f.beam.holder !== (l.cases['steel-load'].returned ? 'CRADLE' : 'OWNER') || f.activeCase === 'linked-carry' && f.crate.holder !== (l.cases['linked-carry'].returned ? 'CRADLE' : 'OWNER')) return false;
  if (f.linkedMemberIds.length && (f.activeCase !== 'linked-carry' || !l.cases['linked-carry'].linkStarted || PAIR.some(id => { const m = findIronBloodMember(s, id); return !m || !m.joined || !m.present || m.location !== 'YARD'; }))) return false;
  if (f.activeCase === 'flame-clearance') { const r = l.cases['flame-clearance']; if (f.ownerNode !== (r.returned ? 'NEAR' : r.result !== 'NONE' && r.abilityUses !== 2 ? 'FAR' : 'NEAR')) return false; }
  if (l.reflected && resolved !== 3 || s.seer.completedSources.filter(v => v === 'iron-blood-reflection').length !== (l.reflected ? 1 : 0)) return false;
  if (s.ironBloodKnight.promotionWeek === null && stableStringify(l) !== stableStringify(createIronBloodLifeState())) return false;
  return true;
}
export const validateIronBloodLifeState = validateIronBloodLife;
