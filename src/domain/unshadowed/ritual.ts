import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { priestOfLightInside } from '../priest-of-light/life.js';
import { notaryInside } from '../notary/life.js';
import { BARD_GUIDE } from '../bard/content.js';
import { BARD_CASE_IDS } from '../bard/types.js';
import { LIGHTPRAYER_CASE_IDS } from '../lightprayer/types.js';
import { SUNPRIEST_CASE_IDS } from '../sunpriest/types.js';
import { NOTARY_CASE_IDS } from '../notary/types.js';
import { PRIEST_OF_LIGHT_CASE_IDS } from '../priest-of-light/types.js';
import { UNSHADOWED_RITUAL_SOURCE, UNSHADOWED_CONSUMPTION_RISK } from './content.js';
import type { UnshadowedAction } from './types.js';

export const UNSHADOWED_RITUAL_PRICE = 320;
export const UNSHADOWED_GUIDE_ID = 'UD4-MIRIEL';
export const UNSHADOWED_EXPERT_ID = 'UD4-CELIA';
export const UNSHADOWED_EMOTION_DECLARATION = '对原导师米瑞尔在长期指导与实际共同经历中形成的珍重与感激，是本角色此刻最强烈、最不愿舍弃的情感。';
export interface UnshadowedRitualPerson { id: string; name: string; age: number; gender: 'FEMALE'; sequence: 4 | null; alive: boolean; willing: boolean; location: 'HALL' | 'AWAY'; source: string }
export interface UnshadowedEmotionBasis { id: string; description: string; week: number | null }
export interface UnshadowedEmotionAnchor { id: string; subjectId: 'UD4-MIRIEL'; reason: string; basis: UnshadowedEmotionBasis[]; declaredWeek: number; location: 'SELF' | 'VESSEL' | 'RETURNED'; felt: boolean; memoriesRetained: true; separatedWeek: number | null; returnedWeek: number | null; returnedFromVesselId: string | null }
export interface UnshadowedEmotionVessel { id: string; source: string; ownerId: 'UD4-CELIA'; location: 'SUPPLIER' | 'TABLE' | 'MISSING'; status: 'EMPTY' | 'FULL' | 'DESTROYED'; intact: boolean; anchorId: string | null; returnedWeek: number | null }
export interface UnshadowedRitualKit { id: string; source: string; location: 'SUPPLIER' | 'TABLE' | 'MISSING'; status: 'SEALED' | 'IN_USE' | 'CONSUMED' | 'DAMAGED'; consumedWeek: number | null }
export type UnshadowedRitualPhase = 'BOOKED' | 'ENTERED' | 'DECLARED' | 'SEPARATED' | 'DRUNK' | 'RETURNED' | 'ABORTED';
export interface UnshadowedRitualVisit {
  id: string; siteId: 'UD4-HALL'; source: string; guideId: 'UD4-MIRIEL'; expertId: 'UD4-CELIA'; paidPennies: number;
  phase: UnshadowedRitualPhase; bookedWeek: number; plannedWeek: number; enteredWeek: number | null; closedWeek: number | null;
  anchor: UnshadowedEmotionAnchor | null; vessel: UnshadowedEmotionVessel; kit: UnshadowedRitualKit;
  pendingBottleId: string | null; rawOutcome: PublicResolutionTier | null; consumedWeek: number | null;
  finishedSuccess: boolean; abortedReason: 'PLAYER_CANCELLED' | null;
}
export interface UnshadowedRitualState { playerLocation: 'OUTSIDE' | 'HALL'; activeVisitId: string | null; guide: UnshadowedRitualPerson; expert: UnshadowedRitualPerson; visits: UnshadowedRitualVisit[] }
export type UnshadowedRitualCommand =
  | { type: 'BOOK_RITUAL' } | { type: 'BEGIN_RITUAL' } | { type: 'RETURN_EMOTION' } | { type: 'END_RITUAL' } | { type: 'CANCEL_RITUAL' }
  | { type: 'DECLARE_EMOTION'; subjectId: 'UD4-MIRIEL'; confirmed: true }
  | { type: 'SEPARATE_EMOTION'; confirmed: true };
export interface UnshadowedRitualVisitProjection extends UnshadowedRitualVisit { status: string; summary: string }
export interface UnshadowedRitualProjection {
  title: string; status: string; boundary: string; source: string; consequence: string; appointment: string;
  currentVisitId: string | null; playerLocation: string; windowOpen: boolean; declaration: string; basis: UnshadowedEmotionBasis[];
  guide: UnshadowedRitualPerson | null; expert: UnshadowedRitualPerson | null; visits: UnshadowedRitualVisitProjection[];
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const tiers = ['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'];
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const vesselSource = (id: string) => `本作G本次独立封存载体${id}，归原专业者西莉娅所有，仅暂存本人声明的同一份情感，不是新情感副本或赠品。`;
const kitSource = (id: string) => `本作G本次独立原包${id}，320便士预约费内配置；用于虚构情感分离及回输，不提供现实心理或医疗操作说明。`;
export function createUnshadowedRitualState(): UnshadowedRitualState {
  return { playerLocation: 'OUTSIDE', activeVisitId: null, visits: [],
    guide: { id: UNSHADOWED_GUIDE_ID, name: '米瑞尔·赫斯', age: 52, gender: 'FEMALE', sequence: null, alive: true, willing: true, location: 'HALL', source: `同一位${BARD_GUIDE}，本作G当前52岁；登记原人物身份，不复制人物、不赋予未核高阶能力。` },
    expert: { id: UNSHADOWED_EXPERT_ID, name: '西莉娅·罗', age: 64, gender: 'FEMALE', sequence: 4, alive: true, willing: true, location: 'HALL', source: '本作原创G独立持照专业者，64岁女性，序列4；当前在原UD4-HALL，以本作虚构规程操作原载体，非原导师升级替身。' } };
}
function freshVisit(n: number, week: number): UnshadowedRitualVisit {
  const vesselId = `UD4-VESSEL-${n}`, kitId = `UD4-KIT-${n}`;
  return { id: `UD4-RITUAL-${n}`, siteId: 'UD4-HALL', source: UNSHADOWED_RITUAL_SOURCE, guideId: 'UD4-MIRIEL', expertId: 'UD4-CELIA', paidPennies: 320,
    phase: 'BOOKED', bookedWeek: week, plannedWeek: week + 1, enteredWeek: null, closedWeek: null, anchor: null,
    vessel: { id: vesselId, source: vesselSource(vesselId), ownerId: 'UD4-CELIA', location: 'SUPPLIER', status: 'EMPTY', intact: true, anchorId: null, returnedWeek: null },
    kit: { id: kitId, source: kitSource(kitId), location: 'SUPPLIER', status: 'SEALED', consumedWeek: null },
    pendingBottleId: null, rawOutcome: null, consumedWeek: null, finishedSuccess: false, abortedReason: null };
}
/** These are existing facts, not automatically the character's strongest feeling. */
export function unshadowedEmotionBasis(s: SliceState): UnshadowedEmotionBasis[] {
  const basis: UnshadowedEmotionBasis[] = [];
  if (s.bard.discovered && s.bard.guidanceKnown) basis.push({ id: 'bard:original-guidance', description: '曾实际认识原公共音乐室导师米瑞尔并接受歌颂者指导。', week: null });
  // Persisted object-key order is not presentation order; retain each old module's registered case order.
  const appendCases = (module: string, cases: Record<string, { status: string; attemptWeek: number | null }>, ids: readonly string[]) => {
    for (const id of ids) { const c = cases[id]; if (c?.status === 'RESOLVED') basis.push({ id: `${module}:case:${id}`, description: `原${module}阶段已实际完成${id}，保留旧案结果与原人物原物。`, week: c.attemptWeek }); }
  };
  appendCases('bard', s.bard.cases, BARD_CASE_IDS);
  appendCases('lightprayer', s.lightprayer.cases, LIGHTPRAYER_CASE_IDS);
  appendCases('sunpriest', s.sunpriest.cases, SUNPRIEST_CASE_IDS);
  appendCases('notary', s.notary.cases, NOTARY_CASE_IDS);
  appendCases('priest-of-light', s.priestOfLight.cases, PRIEST_OF_LIGHT_CASE_IDS);
  if (s.lightprayer.promotionWeek !== null) basis.push({ id: 'lightprayer:promotion', description: '原祈光人阶段晋升与歌颂者成长成果仍在。', week: s.lightprayer.promotionWeek });
  if (s.priestOfLight.promotionWeek !== null) basis.push({ id: 'priest-of-light:promotion', description: '原米瑞尔曾在真实黑暗原冰仪式中指导喂服，原光之祭司晋升记录仍在。', week: s.priestOfLight.promotionWeek });
  return basis;
}
export const currentUnshadowedVisit = (s: SliceState) => s.unshadowed.ritual.visits.find(v => v.id === s.unshadowed.ritual.activeVisitId);
export const hasUnshadowedRitualLock = (s: SliceState) => s.unshadowed.ritual.playerLocation === 'HALL';
function staffReady(s: SliceState): boolean {
  const r = s.unshadowed.ritual;
  return r.guide.id === UNSHADOWED_GUIDE_ID && r.expert.id === UNSHADOWED_EXPERT_ID && [r.guide, r.expert].every(p => p.alive && p.willing && p.location === 'HALL');
}
function originalKit(v: UnshadowedRitualVisit, location: 'SUPPLIER' | 'TABLE', status: 'SEALED' | 'IN_USE' | 'CONSUMED'): boolean {
  return v.kit.id === v.id.replace('RITUAL', 'KIT') && v.kit.source === kitSource(v.kit.id) && v.kit.location === location && v.kit.status === status;
}
function originalVessel(v: UnshadowedRitualVisit, location: 'SUPPLIER' | 'TABLE', status: 'EMPTY' | 'FULL'): boolean {
  return v.vessel.id === v.id.replace('RITUAL', 'VESSEL') && v.vessel.source === vesselSource(v.vessel.id) && v.vessel.ownerId === 'UD4-CELIA' && v.vessel.location === location && v.vessel.status === status && v.vessel.intact;
}
function canReturn(s: SliceState, v: UnshadowedRitualVisit): boolean {
  return s.unshadowed.ritual.playerLocation === 'HALL' && staffReady(s) && !!v.anchor && v.anchor.location === 'VESSEL' && !v.anchor.felt && v.anchor.memoriesRetained && v.anchor.subjectId === 'UD4-MIRIEL'
    && originalVessel(v, 'TABLE', 'FULL') && v.vessel.anchorId === v.anchor.id && originalKit(v, 'TABLE', v.pendingBottleId === null ? 'IN_USE' : 'CONSUMED');
}
export function canConsumeUnshadowedRitual(s: SliceState): boolean {
  const v = currentUnshadowedVisit(s);
  return !!v && s.status === 'ACTIVE' && s.world.city === 'BACKLUND' && s.progression.pathwayId === 'sun' && s.progression.sequence === 5 && s.unshadowed.formulaKnown && !s.activeEvent && !s.combat
    && v.phase === 'SEPARATED' && v.enteredWeek === s.week && v.anchor?.separatedWeek === s.week && v.pendingBottleId === null && v.rawOutcome === null && canReturn(s, v);
}
export function recordUnshadowedRitualDrink(s: SliceState, bottleId: string): void {
  rule(canConsumeUnshadowedRitual(s), '须在本次同一原载体暂存声明情感期间饮药。');
  const v = currentUnshadowedVisit(s)!, b = s.unshadowed.bottles.find(b => b.id === bottleId);
  rule(b && b.status === 'CONSUMED' && b.consumedWeek === s.week && b.ritualId === v.id && tiers.includes(b.outcome ?? ''), '须同一原瓶已实际耗尽并记录本场原始结果。');
  v.pendingBottleId = b.id; v.rawOutcome = b.outcome; v.consumedWeek = s.week; v.phase = 'DRUNK'; v.kit.status = 'CONSUMED'; v.kit.consumedWeek = s.week;
}
export function validateUnshadowedRitualCommand(v: unknown): v is UnshadowedRitualCommand {
  if (!record(v)) return false;
  if (v.type === 'DECLARE_EMOTION') return shape(v, ['type', 'subjectId', 'confirmed']) && v.subjectId === 'UD4-MIRIEL' && v.confirmed === true;
  if (v.type === 'SEPARATE_EMOTION') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  return ['BOOK_RITUAL', 'BEGIN_RITUAL', 'RETURN_EMOTION', 'END_RITUAL', 'CANCEL_RITUAL'].includes(String(v.type)) && shape(v, ['type']);
}
export const isUnshadowedRitualCommand = validateUnshadowedRitualCommand;
export function blockUnshadowedRitualCommand(s: SliceState, command: UnshadowedRitualCommand): string | null {
  if (!validateUnshadowedRitualCommand(command)) return '须分别明确声明本角色的情感选择与同意分离。';
  const v = currentUnshadowedVisit(s), r = s.unshadowed.ritual;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '本人须仍活着且能够行动。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '本人须实际在贝克兰德的本场原仪式厅附近。';
  if (command.type === 'CANCEL_RITUAL') {
    if (!v || v.phase === 'RETURNED' || v.phase === 'ABORTED') return '没有可取消的未结束本场；已回输者请实际离场。';
    if (v.anchor?.location === 'VESSEL' && !canReturn(s, v)) return '同一份情感仍离身；当前原载体、原包或自愿在场的原人员不可用，不能假装回输或自动复原。';
    return null;
  }
  if (command.type === 'END_RITUAL') return v?.phase === 'RETURNED' && v.anchor?.location === 'RETURNED' && v.anchor.felt && v.vessel.status === 'EMPTY' && v.vessel.anchorId === null && r.playerLocation === 'HALL' ? null : '先实际回输原情感，或明确选择放弃晋升并回输退出。';
  if (command.type === 'RETURN_EMOTION') return v?.phase === 'DRUNK' && canReturn(s, v) ? null : '须已饮药，原声明情感仍在同一完整原载体，当前原人员自愿在场且原包未丢失或损坏，才能实际回输。';
  if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 5 || !s.unshadowed.formulaKnown || s.priestOfLight.promotionWeek === null) return '先成为光之祭司并了解无暗者配方和真实情感仪式。';
  if (priestOfLightInside(s) || notaryInside(s)) return '须实际结束旧现场、原身体撤出旧冰并返回原指导处。';
  if (!staffReady(s)) return '同一原导师米瑞尔与原专业者西莉娅须当前存活、自愿且实际在原仪式厅，不能凭旧预约强迫或召回。';
  if (command.type === 'BOOK_RITUAL') {
    if (v) return '先实际结束或取消本次预约。';
    if (!s.unshadowed.bottles.some(b => b.status === 'PREPARED')) return '先以六项原材料实际调配至少一瓶无暗者魔药。';
    if (s.actionsRemaining < 1) return '预约本次原载体与原包需要1行动。';
    return s.cash < 320 ? '本次原载体、原包与普通往返共320便士，取消不退款。' : null;
  }
  if (!v) return '先实际预约本次原载体与原包。';
  if (command.type === 'BEGIN_RITUAL') {
    if (v.phase !== 'BOOKED') return '本场已经实际开始，不能刷新原包或载体。';
    if (s.week < v.plannedWeek) return `须等下一真实周，第${v.plannedWeek}周起实际赴场。`;
    if (!originalKit(v, 'SUPPLIER', 'SEALED') || !originalVessel(v, 'SUPPLIER', 'EMPTY') || v.vessel.anchorId !== null) return '须本次同一完整原包与空原载体当前真实在供应方，不能替换丢失或损坏的原物。';
    return s.actionsRemaining < 1 ? '本人普通步行赴原仪式厅需要1行动。' : null;
  }
  if (r.playerLocation !== 'HALL' || v.enteredWeek !== s.week || !originalKit(v, 'TABLE', 'SEALED') || !originalVessel(v, 'TABLE', 'EMPTY')) return '本人须本周在原厅，同一完整原包与空原载体当前在原台。';
  if (command.type === 'DECLARE_EMOTION') return v.phase === 'ENTERED' && v.anchor === null && unshadowedEmotionBasis(s).some(b => b.id === 'bard:original-guidance') && unshadowedEmotionBasis(s).some(b => b.id === 'priest-of-light:promotion') ? null : '须本人在本场明确选择，且原导师旧指导与实际成长记录仍在；不能自动认定这是最强情感。';
  return v.phase === 'DECLARED' && v.anchor?.location === 'SELF' && v.anchor.felt && v.anchor.subjectId === 'UD4-MIRIEL' ? null : '先由玩家明确声明本角色此刻最强烈、最不愿舍弃的这一份具体情感。';
}
function returnOriginalEmotion(s: SliceState, v: UnshadowedRitualVisit): void {
  rule(canReturn(s, v), '当前同一原载体、原包与自愿原人员必须实际可用，不能伪造回输。');
  v.anchor!.location = 'RETURNED'; v.anchor!.felt = true; v.anchor!.returnedWeek = s.week; v.anchor!.returnedFromVesselId = v.vessel.id;
  v.vessel.status = 'EMPTY'; v.vessel.anchorId = null; v.vessel.returnedWeek = s.week;
}
export function applyUnshadowedRitualCommand(s: SliceState, command: UnshadowedRitualCommand, c: SeerContext): void {
  const blocked = blockUnshadowedRitualCommand(s, command); rule(blocked === null, blocked ?? '当前无法进行此步骤。');
  const r = s.unshadowed.ritual, v = currentUnshadowedVisit(s);
  switch (command.type) {
    case 'BOOK_RITUAL': { const visit = freshVisit(r.visits.length + 1, s.week); s.actionsRemaining--; s.cash -= 320; r.visits.push(visit); r.activeVisitId = visit.id; c.note('预约原情感载体与本次原包', `1行动320便士，最早第${visit.plannedWeek}周本人实际赴UD4-HALL；原${visit.vessel.id}归原专业者所有，原${visit.kit.id}只服务本次。取消不退款，不预先声明或分离任何情感。`); return; }
    case 'BEGIN_RITUAL': s.actionsRemaining--; r.playerLocation = 'HALL'; v!.enteredWeek = s.week; v!.phase = 'ENTERED'; v!.vessel.location = 'TABLE'; v!.kit.location = 'TABLE'; c.note('本人实际来到原仪式厅', '1行动沿普通道路来到UD4-HALL，同一原导师与原专业者当前自愿在场，同一原载体与原包已实际置于原台。你仍完整感受原情感，尚未声明它最强或同意分离。'); return;
    case 'DECLARE_EMOTION': v!.anchor = { id: v!.id.replace('RITUAL', 'EMOTION'), subjectId: 'UD4-MIRIEL', reason: UNSHADOWED_EMOTION_DECLARATION, basis: unshadowedEmotionBasis(s), declaredWeek: s.week, location: 'SELF', felt: true, memoriesRetained: true, separatedWeek: null, returnedWeek: null, returnedFromVesselId: null }; v!.phase = 'DECLARED'; c.note('玩家明确声明本角色最不愿舍弃的原情感', `${UNSHADOWED_EMOTION_DECLARATION}本次${v!.anchor.id}绑定同一原人物UD4-MIRIEL与真实旧经历。声明是玩家当前角色选择，不是系统替你判定内心；不符合角色时可取消并留在5。`); return;
    case 'SEPARATE_EMOTION': v!.anchor!.location = 'VESSEL'; v!.anchor!.felt = false; v!.anchor!.separatedWeek = s.week; v!.vessel.status = 'FULL'; v!.vessel.anchorId = v!.anchor!.id; v!.kit.status = 'IN_USE'; v!.phase = 'SEPARATED'; c.note('专业者实际分离并封存同一声明情感', `0行动，由当前自愿在场的原西莉娅按本作G虚构规程操作：${v!.anchor!.id}从本人移入同一${v!.vessel.id}，你暂时不再感受这一份珍重与感激，记忆事实和其他情感保留。原包实际启用。尚未饮药，仍须独立确认原瓶；不是玩家任意操纵他人情感。`); return;
    case 'RETURN_EMOTION': returnOriginalEmotion(s, v!); v!.phase = 'RETURNED'; c.note('同一原载体内的原声明情感实际回到本人', `0行动，当前原西莉娅与原米瑞尔自愿在场，从原${v!.vessel.id}回输同一${v!.anchor!.id}；原载体现为空，本人重新感受原情感，旧记忆不改写、不新造情感，不治疗损伤、不退款或恢复药瓶。原始药效${v!.rawOutcome}，由本次完整回输结果决定是否晋升。`); return;
    case 'END_RITUAL': v!.closedWeek = s.week; r.activeVisitId = null; r.playerLocation = 'OUTSIDE'; c.note('实际走出原仪式厅', '0行动沿已付普通原路返回，已经回输的原情感留在本人；原载体与原包留在专业者原台，原瓶、损失和结果全部保留。'); return;
    case 'CANCEL_RITUAL': { const absent = v!.anchor?.location === 'VESSEL'; if (absent) returnOriginalEmotion(s, v!); v!.phase = 'ABORTED'; v!.abortedReason = 'PLAYER_CANCELLED'; v!.closedWeek = s.week; r.activeVisitId = null; r.playerLocation = 'OUTSIDE'; c.note('明确放弃本次晋升并实际退出', `${absent ? `先由当前自愿原人员从同一${v!.vessel.id}回输同一原情感，再` : '原情感未离身，'}沿普通原路退出。${v!.pendingBottleId ? `原瓶已耗，原始药效${v!.rawOutcome}不再完成晋升，仍5、旧扮演100。` : '未饮原瓶仍保留。'}费用、已用原包与任何损失不恢复；不会因退出自动造一份替代情感。`); return; }
  }
}
export function unshadowedRitualActions(s: SliceState): UnshadowedAction[] {
  const actions: UnshadowedAction[] = [], v = currentUnshadowedVisit(s);
  const add = (id: string, label: string, cost: string, command: UnshadowedRitualCommand) => { const reason = blockUnshadowedRitualCommand(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (!s.unshadowed.formulaKnown) return actions;
  if (!v) { if (s.progression.sequence === 5) add('unshadowed-book-ritual', '预约本次原载体与原包', '1行动 · 320便士 · 下一真实周', { type: 'BOOK_RITUAL' }); return actions; }
  if (v.phase === 'BOOKED') add('unshadowed-begin-ritual', '实际走到原仪式厅', `1行动 · 最早第${v.plannedWeek}周`, { type: 'BEGIN_RITUAL' });
  if (v.phase === 'ENTERED') add('unshadowed-declare-emotion', '确认这是本角色当前最强烈、最不愿舍弃的情感', '0行动 · 对原米瑞尔的珍重与感激 · 仅在符合角色选择时确认', { type: 'DECLARE_EMOTION', subjectId: 'UD4-MIRIEL', confirmed: true });
  if (v.phase === 'DECLARED') add('unshadowed-separate-emotion', '同意由原专业者把这一份原情感实际分离入原载体', '0行动 · 暂时不再感受这份情感 · 记忆保留', { type: 'SEPARATE_EMOTION', confirmed: true });
  if (v.phase === 'DRUNK') add('unshadowed-return-emotion', '从同一原载体实际回输原情感并完成本次仪式', '0行动 · 原人员与原载体须当前可用 · 失败不退成本', { type: 'RETURN_EMOTION' });
  if (v.phase === 'RETURNED') add('unshadowed-end-ritual', '实际走出原仪式厅', '0行动 · 已付普通返程', { type: 'END_RITUAL' });
  else add('unshadowed-cancel-ritual', v.pendingBottleId ? '放弃本次晋升并从原载体回输后退出' : v.anchor?.location === 'VESSEL' ? '从原载体实际回输原情感并取消退出' : '取消本次仪式并实际退出，留在序列5', '0行动 · 原物可用才实际回输 · 不退款或补药', { type: 'CANCEL_RITUAL' });
  return actions;
}
export function projectUnshadowedRitual(s: SliceState): UnshadowedRitualProjection {
  const r = s.unshadowed.ritual, known = s.unshadowed.formulaKnown, v = currentUnshadowedVisit(s);
  return { title: '原情感分离与真实回输', status: !known ? '先了解本阶配方与仪式。' : v ? `本次${v.id}：${v.phase}；${v.anchor?.location === 'VESSEL' ? '原情感仍离身，尚未回输' : v.anchor?.location === 'RETURNED' ? '同一原情感已实际回到本人' : '尚未分离原情感'}` : '本人在原仪式厅外。',
    boundary: known ? '只由玩家明确选择本角色当前最强、最不愿舍弃的具体情感；若不符合角色就取消并留在5。原记忆保留，不永久舍弃人性。' : '', source: known ? UNSHADOWED_RITUAL_SOURCE : '', consequence: known ? UNSHADOWED_CONSUMPTION_RISK : '',
    appointment: v?.phase === 'BOOKED' ? `第${v.bookedWeek}周预约，最早第${v.plannedWeek}周实际赴场；320便士已付，失败或取消不退。` : known ? '每次预约1行动320便士；下一真实周赴场1行动，其余实际操作包含在本次服务中。' : '',
    currentVisitId: known ? r.activeVisitId : null, playerLocation: known ? r.playerLocation : '未知', windowOpen: known && canConsumeUnshadowedRitual(s), declaration: known ? UNSHADOWED_EMOTION_DECLARATION : '', basis: known ? unshadowedEmotionBasis(s) : [],
    guide: known ? structuredClone(r.guide) : null, expert: known ? structuredClone(r.expert) : null,
    visits: known ? r.visits.map(visit => ({ ...structuredClone(visit), status: visit.finishedSuccess ? '原情感实际回输后已晋升' : visit.phase === 'ABORTED' ? '已放弃晋升，原情感未丢弃' : visit.phase === 'DRUNK' ? '原瓶已耗，原情感仍离身，尚未晋升' : visit.phase === 'RETURNED' ? '原情感已回输，本次未晋升' : visit.phase,
      summary: `${visit.id}在原${visit.siteId}，费用${visit.paidPennies}便士；原载体${visit.vessel.id}/${visit.vessel.status}，原包${visit.kit.id}/${visit.kit.status}。${visit.anchor ? `具体情感${visit.anchor.id}属于本人，对象${visit.anchor.subjectId}；当前${visit.anchor.location}，${visit.anchor.felt ? '能感受' : '暂时不再感受'}，原记忆保留。` : '尚未替角色声明情感。'}${visit.pendingBottleId ? `原瓶${visit.pendingBottleId}已耗，原始药效${visit.rawOutcome}；只有实际回输完成且未放弃才可能晋升。` : '未饮药。'}${visit.closedWeek === null ? '本场尚未实际退出。' : `第${visit.closedWeek}周已实际退出，原物与成本保留。`}`,
    })) : [] };
}
/** Strict identities and physical carriers survive both normal saves and interrupted external conditions. */
export function validateUnshadowedRitualState(s: SliceState): boolean {
  try {
    const r = s.unshadowed.ritual;
    if (!record(r) || !shape(r, ['playerLocation', 'activeVisitId', 'guide', 'expert', 'visits']) || !['OUTSIDE', 'HALL'].includes(r.playerLocation) || !Array.isArray(r.visits)) return false;
    const fresh = createUnshadowedRitualState();
    for (const key of ['guide', 'expert'] as const) {
      const p = r[key], expected = fresh[key];
      if (!record(p) || !shape(p, Object.keys(expected)) || p.id !== expected.id || p.name !== expected.name || p.age !== expected.age || p.gender !== expected.gender || p.sequence !== expected.sequence || p.source !== expected.source || typeof p.alive !== 'boolean' || typeof p.willing !== 'boolean' || !['HALL', 'AWAY'].includes(p.location)) return false;
    }
    const first = s.priestOfLight.promotionWeek ?? s.week, availableBasis = unshadowedEmotionBasis(s);
    let lastClosed = first, successful = 0;
    for (const [i, v] of r.visits.entries()) {
      if (!record(v) || !shape(v, ['id', 'siteId', 'source', 'guideId', 'expertId', 'paidPennies', 'phase', 'bookedWeek', 'plannedWeek', 'enteredWeek', 'closedWeek', 'anchor', 'vessel', 'kit', 'pendingBottleId', 'rawOutcome', 'consumedWeek', 'finishedSuccess', 'abortedReason'])) return false;
      const original = freshVisit(i + 1, v.bookedWeek);
      if (v.id !== original.id || v.siteId !== 'UD4-HALL' || v.source !== UNSHADOWED_RITUAL_SOURCE || v.guideId !== 'UD4-MIRIEL' || v.expertId !== 'UD4-CELIA' || v.paidPennies !== 320 || !integer(v.bookedWeek, lastClosed, s.week) || v.plannedWeek !== v.bookedWeek + 1 || !['BOOKED', 'ENTERED', 'DECLARED', 'SEPARATED', 'DRUNK', 'RETURNED', 'ABORTED'].includes(v.phase) || typeof v.finishedSuccess !== 'boolean') return false;
      if (!s.unshadowed.formulaKnown || v.enteredWeek !== null && !integer(v.enteredWeek, v.plannedWeek, s.week) || v.closedWeek !== null && !integer(v.closedWeek, v.enteredWeek ?? v.bookedWeek, s.week)) return false;
      if (v.closedWeek === null) { if (i !== r.visits.length - 1 || r.activeVisitId !== v.id) return false; } else { lastClosed = v.closedWeek; if (r.activeVisitId === v.id || !['RETURNED', 'ABORTED'].includes(v.phase)) return false; }
      if (v.phase === 'BOOKED' && (v.enteredWeek !== null || v.closedWeek !== null) || !['BOOKED', 'ABORTED'].includes(v.phase) && v.enteredWeek === null) return false;
      if ((v.phase === 'ABORTED') !== (v.abortedReason === 'PLAYER_CANCELLED') || v.phase !== 'ABORTED' && v.abortedReason !== null || v.phase === 'ABORTED' && v.closedWeek === null) return false;
      if (!record(v.vessel) || !shape(v.vessel, Object.keys(original.vessel)) || v.vessel.id !== original.vessel.id || v.vessel.source !== original.vessel.source || v.vessel.ownerId !== 'UD4-CELIA' || !['SUPPLIER', 'TABLE', 'MISSING'].includes(v.vessel.location) || !['EMPTY', 'FULL', 'DESTROYED'].includes(v.vessel.status) || typeof v.vessel.intact !== 'boolean' || v.vessel.status === 'DESTROYED' && v.vessel.intact) return false;
      if (!record(v.kit) || !shape(v.kit, Object.keys(original.kit)) || v.kit.id !== original.kit.id || v.kit.source !== original.kit.source || !['SUPPLIER', 'TABLE', 'MISSING'].includes(v.kit.location) || !['SEALED', 'IN_USE', 'CONSUMED', 'DAMAGED'].includes(v.kit.status)) return false;
      if (v.enteredWeek === null && (v.vessel.location === 'TABLE' || v.kit.location === 'TABLE') || v.enteredWeek !== null && (v.vessel.location === 'SUPPLIER' || v.kit.location === 'SUPPLIER')) return false;
      if (v.anchor === null) {
        if (!['BOOKED', 'ENTERED', 'ABORTED'].includes(v.phase) || v.vessel.anchorId !== null || v.vessel.returnedWeek !== null || v.vessel.status === 'FULL' || v.kit.status === 'IN_USE') return false;
      } else {
        const a = v.anchor;
        if (!record(a) || !shape(a, ['id', 'subjectId', 'reason', 'basis', 'declaredWeek', 'location', 'felt', 'memoriesRetained', 'separatedWeek', 'returnedWeek', 'returnedFromVesselId']) || a.id !== v.id.replace('RITUAL', 'EMOTION') || a.subjectId !== 'UD4-MIRIEL' || a.reason !== UNSHADOWED_EMOTION_DECLARATION || a.memoriesRetained !== true || typeof a.felt !== 'boolean' || !integer(a.declaredWeek, v.enteredWeek!, s.week) || a.declaredWeek !== v.enteredWeek || !Array.isArray(a.basis) || a.basis.length < 2) return false;
        if (!a.basis.every(b => record(b) && shape(b, ['id', 'description', 'week']) && availableBasis.some(expected => expected.id === b.id && expected.description === b.description && expected.week === b.week)) || new Set(a.basis.map(b => b.id)).size !== a.basis.length || !['bard:original-guidance', 'priest-of-light:promotion'].every(id => a.basis.some(b => b.id === id))) return false;
        if (a.location === 'SELF') {
          if (!a.felt || !['DECLARED', 'ABORTED'].includes(v.phase) || a.separatedWeek !== null || a.returnedWeek !== null || a.returnedFromVesselId !== null || v.vessel.anchorId !== null || v.vessel.status === 'FULL' || v.vessel.returnedWeek !== null) return false;
        } else if (a.location === 'VESSEL') {
          if (a.felt || !['SEPARATED', 'DRUNK'].includes(v.phase) || a.separatedWeek !== a.declaredWeek || a.returnedWeek !== null || a.returnedFromVesselId !== null || v.vessel.anchorId !== a.id || !['FULL', 'DESTROYED'].includes(v.vessel.status) || v.vessel.returnedWeek !== null || v.closedWeek !== null) return false;
        } else if (a.location === 'RETURNED') {
          if (!a.felt || !['RETURNED', 'ABORTED'].includes(v.phase) || a.separatedWeek !== a.declaredWeek || !integer(a.returnedWeek, v.consumedWeek ?? a.separatedWeek!, s.week) || a.returnedFromVesselId !== v.vessel.id || v.vessel.anchorId !== null || v.vessel.status === 'FULL' || v.vessel.returnedWeek !== a.returnedWeek || v.closedWeek !== null && v.closedWeek < a.returnedWeek) return false;
        } else return false;
        if (a.separatedWeek !== null && v.kit.status === 'SEALED') return false;
      }
      if (v.pendingBottleId === null) {
        if (v.rawOutcome !== null || v.consumedWeek !== null || v.kit.consumedWeek !== null || v.kit.status === 'CONSUMED' || ['DRUNK', 'RETURNED'].includes(v.phase) || v.finishedSuccess) return false;
      } else {
        if (typeof v.pendingBottleId !== 'string' || !tiers.includes(v.rawOutcome ?? '') || v.consumedWeek !== v.enteredWeek || !integer(v.consumedWeek, first + 12, s.week) || v.kit.consumedWeek !== v.consumedWeek || !['CONSUMED', 'DAMAGED'].includes(v.kit.status) || !v.anchor || v.anchor.separatedWeek !== v.consumedWeek || !['DRUNK', 'RETURNED', 'ABORTED'].includes(v.phase)) return false;
        const bottle = s.unshadowed.bottles.find(b => b.id === v.pendingBottleId);
        if (!bottle || bottle.status !== 'CONSUMED' || bottle.ritualId !== v.id || bottle.outcome !== v.rawOutcome || bottle.consumedWeek !== v.consumedWeek) return false;
      }
      const rawSuccess = v.rawOutcome === 'SUCCESS' || v.rawOutcome === 'GREAT_SUCCESS';
      if (v.finishedSuccess !== (v.phase === 'RETURNED' && rawSuccess)) return false;
      if (v.finishedSuccess) { successful++; if (s.unshadowed.promotionWeek !== v.anchor?.returnedWeek || ![4,3,2].includes(s.progression.sequence??0) || s.progression.pathwayId !== 'sun') return false; }
      if (successful && i !== r.visits.length - 1) return false;
    }
    if (r.activeVisitId === null) return r.playerLocation === 'OUTSIDE' && r.visits.every(v => v.closedWeek !== null) && successful === (s.unshadowed.promotionWeek === null ? 0 : 1);
    const v = currentUnshadowedVisit(s);
    return !!v && v.closedWeek === null && r.playerLocation === (v.phase === 'BOOKED' ? 'OUTSIDE' : 'HALL') && s.world.city === 'BACKLUND' && (r.playerLocation !== 'HALL' || !s.activeEvent && !s.combat && !priestOfLightInside(s) && !notaryInside(s)) && successful === (s.unshadowed.promotionWeek === null ? 0 : 1);
  } catch { return false; }
}
