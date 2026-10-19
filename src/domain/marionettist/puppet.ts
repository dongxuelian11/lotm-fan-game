import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { MarionettistAction } from './types.js';

export type MarionettistPuppetCommand =
  | { type: 'BEGIN_CAPTURE' }
  | { type: 'COMPLETE_CAPTURE'; confirmedDeath: true }
  | { type: 'RELEASE_CONTROL' }
  | { type: 'PUPPET_DELIVER' }
  | { type: 'DISMISS_PUPPET' }
  | { type: 'MOVE_BEYOND_RANGE' };
export type MarionettistTargetStatus = 'SURRENDERED' | 'INITIAL_CONTROL' | 'CONTROLLED'
  | 'DEAD' | 'DEPARTED' | 'INERT' | 'UNCONTROLLED';
/** There is one body record, first populated from the settled combat authority.
 * CONTROLLED/INERT retain bodily integrity, injuries and original spirituality;
 * their alive=false records the irreversible death of the original person. */
export interface MarionettistTarget {
  id: 'MM5-DORN'; name: '多恩'; nature: 'ADULT_ORDINARY_HUMAN';
  health: number; mind: number; spirituality: number; injuries: SliceInjury[]; injuryRisk: number;
  alive: boolean; status: MarionettistTargetStatus; location: 'ORIGINAL_COURTYARD' | 'DEPARTED';
  source: { encounterId: 'MARIONETTIST_DISPUTE'; startHistoryIndex: number; settledRound: number;
    combatStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD' };
  club: { id: 'MM5-DORN-CLUB'; ownerId: 'MM5-DORN'; location: 'DORN_HAND' | 'COURTYARD_GROUND' };
}
export interface MarionettistPuppetState {
  target: MarionettistTarget | null;
  capture: { elapsedSeconds: 0 | 20 | 300; startedWeek: number | null;
    beginOutcome: PublicResolutionTier | null; completeOutcome: PublicResolutionTier | null };
  active: boolean; ownerDistanceMetres: 2 | 122 | null;
  note: { id: 'MM5-NOTE'; location: 'SOURCE_TABLE' | 'RECIPIENT_TABLE'; accepted: true; deliveries: 0 | 1;
    bodyRoute: ('ORIGINAL_COURTYARD' | 'SOURCE_TABLE' | 'RECIPIENT_TABLE')[];
    noteRoute: ('SOURCE_TABLE' | 'DORN_HAND' | 'RECIPIENT_TABLE')[] };
}
export interface MarionettistPuppetProjection {
  title: string; source: string; status: string; summary: string; elapsedSeconds: number;
  active: boolean; alive: boolean | null; targetId: string | null;
  body: string; equipment: string; distance: string; note: string;
  irreversibleWarning: string; canCompleteCapture: boolean;
}
const COMMANDS = ['BEGIN_CAPTURE', 'COMPLETE_CAPTURE', 'RELEASE_CONTROL', 'PUPPET_DELIVER', 'DISMISS_PUPPET', 'MOVE_BEYOND_RANGE'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const tiers = ['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'];
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failure = (tier: PublicResolutionTier | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
const BODY_ROUTE = ['ORIGINAL_COURTYARD', 'SOURCE_TABLE', 'RECIPIENT_TABLE', 'ORIGINAL_COURTYARD'] as const;
const NOTE_ROUTE = ['SOURCE_TABLE', 'DORN_HAND', 'RECIPIENT_TABLE'] as const;
export function createMarionettistPuppetState(): MarionettistPuppetState {
  return { target: null, capture: { elapsedSeconds: 0, startedWeek: null, beginOutcome: null, completeOutcome: null },
    active: false, ownerDistanceMetres: null,
    note: { id: 'MM5-NOTE', location: 'SOURCE_TABLE', accepted: true, deliveries: 0, bodyRoute: [], noteRoute: [] } };
}
export function isMarionettistPuppetCommand(value: unknown): value is MarionettistPuppetCommand {
  return isRecord(value) && typeof value.type === 'string' && COMMANDS.includes(value.type);
}
export function validateMarionettistPuppetCommand(value: unknown): value is MarionettistPuppetCommand {
  if (!isMarionettistPuppetCommand(value)) return false;
  return value.type === 'COMPLETE_CAPTURE'
    ? Object.keys(value).length === 2 && value.confirmedDeath === true
    : Object.keys(value).length === 1;
}
/** Also holds the unresolved surrendered person's scene open until an explicit
 * release. A week change or ordinary action must not silently prolong control. */
export function hasMarionettistOpenCapture(s: SliceState): boolean {
  return ['SURRENDERED', 'INITIAL_CONTROL', 'CONTROLLED'].includes(s.marionettist.puppet.target?.status ?? '');
}
export function blockMarionettistPuppetCommand(s: SliceState, c: MarionettistPuppetCommand): string | null {
  if (!validateMarionettistPuppetCommand(c)) return '秘偶命令无效；完整转化需要单独明确确认原人真正死亡。';
  if (s.status !== 'ACTIVE') return '当前周目已经结束。';
  if (s.progression.pathwayId !== 'diviner' || s.progression.sequence !== 5) return '先成为秘偶大师。';
  if (s.activeEvent || s.combat) return '先完整结算当前事件与真实战斗。';
  const p = s.marionettist.puppet, target = p.target;
  if (!target) return '本场没有真实原身体；不能凭空生成秘偶。';
  // These two safe exits stay available at 0 AP/SP and exhausted mind.
  if (c.type === 'RELEASE_CONTROL') return target.alive && ['SURRENDERED', 'INITIAL_CONTROL'].includes(target.status)
    ? null : '没有可以释放的同场活人或初控。';
  if (c.type === 'DISMISS_PUPPET') return p.active && target.status === 'CONTROLLED' && !target.alive
    ? null : '没有仍在控制的真实秘偶。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神，或0行动释放当前控制。';
  if (s.world.city !== 'BACKLUND' || target.location !== 'ORIGINAL_COURTYARD' || p.ownerDistanceMetres !== 2) return '必须仍在原院子与同一原身体的2米现场。';
  if (s.marionettist.encounter.status !== 'RESOLVED' || target.source.combatStatus !== 'SURRENDERED') return '只有本场真实战败后仍活着并停止抵抗的多恩，才能开始这两段操作。';
  if (s.marionettist.ritual.location !== 'CLUB' || Object.values(s.marionettist.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return '先实际结束其它原现场接触或准备。';
  if (c.type !== 'PUPPET_DELIVER' && s.actionsRemaining < 1) return '本次需要1行动；仍可0行动释放控制。';
  if (c.type === 'BEGIN_CAPTURE') {
    if (s.marionettist.encounter.attemptWeek !== s.week) return '原同场接触已跨周，不能追补捕获；请释放原人。';
    if (!target.alive || target.health <= 0 || target.status !== 'SURRENDERED' || p.capture.elapsedSeconds !== 0 || p.active) return '没有尚未尝试且真实活着的投降目标；死人没有可起控的灵体之线。';
    return s.spirituality < 3 ? '初控需要主人3灵性，失败也照付。' : null;
  }
  if (c.type === 'COMPLETE_CAPTURE') {
    if (!target.alive || target.health <= 0 || target.status !== 'INITIAL_CONTROL' || p.capture.elapsedSeconds !== 20 || !success(p.capture.beginOutcome) || p.capture.completeOutcome !== null || p.active) return '先实际完成同一活人的约20秒初控，不能一槽完全秘偶化。';
    if (p.capture.startedWeek !== s.week) return '初控已经中断，不能跨周接续；请0行动释放原人。';
    return s.spirituality < 8 ? '继续约280秒需要主人8灵性，失败照付；也可0行动释放活人。' : null;
  }
  if (!p.active || target.alive || target.status !== 'CONTROLLED' || p.capture.elapsedSeconds !== 300 || !success(p.capture.completeOutcome)) return '需要仍在100米内控制的同一真实秘偶。';
  if (c.type === 'PUPPET_DELIVER') {
    if (p.note.deliveries !== 0 || p.note.location !== 'SOURCE_TABLE') return '同一原信已经交到收件台，不能复制原信或重复领奖。';
    if (target.health <= 0) return '原身体已经不能移动，不能遥控死物继续递信。';
    if (s.spirituality < 2 || target.spirituality < 1) return '递信需要主人2灵性、该原身体自身1灵性。';
    return null;
  }
  return c.type === 'MOVE_BEYOND_RANGE' ? null : '未知秘偶操作。';
}
function releaseLiving(p: MarionettistPuppetState): void {
  const t = p.target!;
  t.status = 'DEPARTED'; t.location = 'DEPARTED'; t.club.location = 'DORN_HAND';
  p.active = false; p.ownerDistanceMetres = null;
}
/** Both checks consume the ordinary deterministic check port. Failure retains
 * the paid attempt and living person's departure, and cannot be rerolled. */
export function applyMarionettistPuppetCommand(s: SliceState, c: MarionettistPuppetCommand, ctx: SeerContext): void {
  const reason = blockMarionettistPuppetCommand(s, c); if (reason) throw new Error(reason);
  const p = s.marionettist.puppet, t = p.target!;
  if (c.type === 'RELEASE_CONTROL') {
    releaseLiving(p);
    ctx.note('释放同一个活人', '0行动解除初控或停止继续尝试。多恩仍然活着，保留原伤势与精神，自己拿回原棍离开；没有死亡、秘偶或奖励，也不能重新捕获刷新。'); return;
  }
  if (c.type === 'DISMISS_PUPPET') {
    t.status = 'INERT'; p.active = false;
    ctx.note('解除真实秘偶控制', '0行动停止对同一已死原身体的控制。身体与原棍留在原院子成为死物；原人不会复活，不能继续递信，本阶段不开放重新连接。'); return;
  }
  if (c.type !== 'PUPPET_DELIVER') s.actionsRemaining -= 1;
  if (c.type === 'BEGIN_CAPTURE') {
    s.spirituality -= 3; p.capture.startedWeek = s.week; p.capture.elapsedSeconds = 20;
    const result = ctx.check('will', 16); p.capture.beginOutcome = result.tier;
    if (success(result.tier)) {
      t.status = 'INITIAL_CONTROL';
      ctx.note('同一活人的约20秒初控', `1行动、主人3灵性已付，原院子现场持续约20秒；抗拒判定${result.roll}/${result.chance}通过。多恩仍然活着，保留原伤势与自身15灵性，仍有反抗与被外力解脱的可能。你专注维持，尚未完整秘偶化；可以0行动释放，继续约280秒必须另行确认原人死亡。`);
    } else {
      releaseLiving(p);
      ctx.note('约20秒初控遭到抗拒', `1行动、主人3灵性已经消耗，抗拒判定${result.roll}/${result.chance}失败。联系断开，多恩仍活着，带同一原棍自行离开；原伤势保留，没有秘偶，不能重刷这个人。`);
    }
    return;
  }
  if (c.type === 'COMPLETE_CAPTURE') {
    s.spirituality -= 8; p.capture.elapsedSeconds = 300;
    const result = ctx.check('will', 20); p.capture.completeOutcome = result.tier;
    if (success(result.tier)) {
      t.status = 'CONTROLLED'; t.alive = false; p.active = true;
      ctx.note('原人真正死亡，同一身体成为唯一秘偶', `另1行动、主人8灵性已付，继续约280秒并再判抗拒与中断${result.roll}/${result.chance}通过，现场累计约300秒。多恩本人真正死亡且不可逆；唯一原身体保有战后身体完整度${t.health}、精神记录${t.mind}、原伤势与自身灵性${t.spirituality}，原棍仍在地面。没有第二个活NPC、装备复制、复活或把别人的能力交给主人。新晋容量1、操控100米；本普通人没有魔法，不能使用主人的能力或互换位置。`);
    } else {
      releaseLiving(p);
      ctx.note('完整转化前联系中断', `另1行动、主人8灵性已付，现场累计约300秒；抗拒与中断判定${result.roll}/${result.chance}失败。多恩仍然活着，取回原棍自行离开；没有死亡或秘偶，不能将失败改为成功或重刷。`);
    }
    return;
  }
  if (c.type === 'PUPPET_DELIVER') {
    s.spirituality -= 2; t.spirituality -= 1;
    // One actual closed walking route. The ordinary body moves the original note,
    // not the controller, a duplicate NPC, a created letter, or an item teleport.
    p.note.bodyRoute = [...BODY_ROUTE]; p.note.noteRoute = [...NOTE_ROUTE];
    p.note.location = 'RECIPIENT_TABLE'; p.note.deliveries = 1;
    ctx.note('唯一原身体实际递交同一原信', '这次原8米路线的短检验计入已付完整转化事项，额外0行动；主人2灵性、原身体自身1灵性已付。秘偶用自己的腿从原2米位置走到原信台，拿起MM5-NOTE，沿原8米净空路线送至本场事先接受这封原信的收件台，然后原路走回原2米位置；全程在100米内，主人专注操纵。原棍MM5-DORN-CLUB始终留在原院地面，原信留在收件台；没有新信、奖励、能力转移、位置互换或额外攻击。'); return;
  }
  p.ownerDistanceMetres = 122; p.active = false; t.status = 'INERT';
  ctx.note('实际走出100米操控范围', '1行动沿原120米净空公道背离院子步行，主人与留在原位的原身体相距122米。越过100米时联系丢失，原身体成为死物；原棍仍在院子，已递交原信仍在原收件台。没有拖带、传送、遥控办事、复活或自动恢复连接，本阶段不开放重连。');
}
export function marionettistPuppetActions(s: SliceState): MarionettistAction[] {
  const t = s.marionettist.puppet.target;
  if (!t || s.progression.pathwayId !== 'diviner' || s.progression.sequence !== 5) return [];
  const entries: { command: MarionettistPuppetCommand; label: string; cost: string }[] = [];
  if (t.status === 'SURRENDERED') entries.push({ command: { type: 'BEGIN_CAPTURE' }, label: '对仍活着的多恩尝试约20秒初控', cost: '1行动 · 主人3灵性 · 可被抗拒' });
  if (t.status === 'INITIAL_CONTROL') entries.push({ command: { type: 'COMPLETE_CAPTURE', confirmedDeath: true }, label: '继续约280秒，确认完整转化将使多恩真正死亡', cost: '1行动 · 主人8灵性 · 再判抗拒与中断 · 死亡不可逆' });
  if (t.alive && (t.status === 'SURRENDERED' || t.status === 'INITIAL_CONTROL')) entries.push({ command: { type: 'RELEASE_CONTROL' }, label: '停止控制并释放活着的多恩', cost: '0行动 · 多恩自行离开，不再重试' });
  if (t.status === 'CONTROLLED' && s.marionettist.puppet.active) {
    if (s.marionettist.puppet.note.deliveries === 0) entries.push({ command: { type: 'PUPPET_DELIVER' }, label: '操纵同一原身体沿原路递交MM5-NOTE并走回', cost: '0行动 · 已付转化事项的唯一短检验 · 主人2灵性 · 秘偶自身1灵性' });
    entries.push({ command: { type: 'DISMISS_PUPPET' }, label: '解除控制，留下同一已死身体', cost: '0行动 · 不复活 · 本阶段不重连' },
      { command: { type: 'MOVE_BEYOND_RANGE' }, label: '独自沿原120米公道离开，越过操控范围', cost: '1行动 · 原身体原地失控成死物' });
  }
  return entries.map(({ command, label, cost }) => {
    const reason = blockMarionettistPuppetCommand(s, command);
    return { id: `marionettist-${command.type.toLowerCase().replaceAll('_', '-')}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectMarionettistPuppet(s: SliceState): MarionettistPuppetProjection {
  const p = s.marionettist.puppet, t = p.target;
  const labels: Record<MarionettistTargetStatus, string> = { SURRENDERED: '仍活着并停止抵抗', INITIAL_CONTROL: '约20秒初控，原人仍活着', CONTROLLED: '原人已死，同一身体受控', DEAD: '真实战死，不能秘偶化', DEPARTED: '活着自行离开，不能重试', INERT: '原人已死，身体已失控成死物', UNCONTROLLED: '原人仍活着，未被捕获' };
  return { title: '同一原身体与真实控制', source: '第三部183章：新晋看线100米、起控5米、约20秒初控、约5分钟完整转化、容量1、已成秘偶100米。有限原院子、多恩、两次抗拒判定、费用与递信路线为本作原创G。',
    status: t ? labels[t.status] : '没有秘偶或已结算的原身体',
    summary: t ? `同一身体${t.id}；${t.alive ? '本人仍活着' : '本人真正死亡且不可逆'}。现场捕获累计${p.capture.elapsedSeconds}秒；本阶段仅原场短检验，必须解除后才能跨周；未开放重连。` : '战斗时以真实战斗身体为唯一权威；只有战后仍活着并投降的多恩可尝试捕获，和平三案无需杀人。',
    elapsedSeconds: p.capture.elapsedSeconds, active: p.active, alive: t?.alive ?? null, targetId: t?.id ?? null,
    body: t ? `战后身体完整度${t.health}/100，精神记录${t.mind}/100，自身灵性${t.spirituality}/15，原伤势${t.injuries.length}项、原累计风险${t.injuryRisk}。普通人，没有魔法。` : '没有免费帮手或复制身体。',
    equipment: t ? `原棍${t.club.id}：${t.club.location === 'DORN_HAND' ? '多恩本人手中' : '原院地面'}，未进入主人库存。` : '没有新造装备。',
    distance: p.ownerDistanceMetres === null ? '当前没有可持续操控的同场距离。' : `主人与原身体${p.ownerDistanceMetres}米；已成秘偶超过100米失控。`,
    note: `同一原信${p.note.id}在${p.note.location === 'SOURCE_TABLE' ? '原信台' : '已接受该信的原收件台'}；实际交付${p.note.deliveries}次。${p.note.deliveries ? '原身体已经沿原8米清路送达并原路返回，原信未复制。' : '仅有真实已控秘偶才显示递信动作。'}`,
    irreversibleWarning: '完整转化成功意味着多恩本人真正死亡，无法撤销或复活；解除控制与超距只会留下死物。',
    canCompleteCapture: t?.status === 'INITIAL_CONTROL' && blockMarionettistPuppetCommand(s, { type: 'COMPLETE_CAPTURE', confirmedDeath: true }) === null };
}
/** Shape and conservation checks are intentionally local to this one real body. */
export function validateMarionettistPuppet(value: unknown): value is MarionettistPuppetState {
  if (!isRecord(value) || !shape(value, ['target', 'capture', 'active', 'ownerDistanceMetres', 'note']) ||
      !isRecord(value.capture) || !shape(value.capture, ['elapsedSeconds', 'startedWeek', 'beginOutcome', 'completeOutcome']) ||
      !isRecord(value.note) || !shape(value.note, ['id', 'location', 'accepted', 'deliveries', 'bodyRoute', 'noteRoute']) || typeof value.active !== 'boolean' || ![null, 2, 122].includes(value.ownerDistanceMetres as null | number)) return false;
  const p = value as unknown as MarionettistPuppetState, c = p.capture, n = p.note;
  if (![0, 20, 300].includes(c.elapsedSeconds) || !(c.startedWeek === null || integer(c.startedWeek, 1)) ||
      !(c.beginOutcome === null || tiers.includes(c.beginOutcome)) || !(c.completeOutcome === null || tiers.includes(c.completeOutcome))) return false;
  if (c.elapsedSeconds === 0 ? c.startedWeek !== null || c.beginOutcome !== null || c.completeOutcome !== null
    : c.startedWeek === null || c.beginOutcome === null || (c.elapsedSeconds === 20 ? c.completeOutcome !== null : !success(c.beginOutcome) || c.completeOutcome === null)) return false;
  if (n.id !== 'MM5-NOTE' || n.accepted !== true || ![0, 1].includes(n.deliveries) || !Array.isArray(n.bodyRoute) || !Array.isArray(n.noteRoute)) return false;
  if (n.deliveries === 0 ? n.location !== 'SOURCE_TABLE' || n.bodyRoute.length !== 0 || n.noteRoute.length !== 0
    : n.location !== 'RECIPIENT_TABLE' || JSON.stringify(n.bodyRoute) !== JSON.stringify(BODY_ROUTE) || JSON.stringify(n.noteRoute) !== JSON.stringify(NOTE_ROUTE)) return false;
  if (p.target === null) return !p.active && p.ownerDistanceMetres === null && c.elapsedSeconds === 0 && n.deliveries === 0;
  if (!isRecord(p.target) || !shape(p.target, ['id', 'name', 'nature', 'health', 'mind', 'spirituality', 'injuries', 'injuryRisk', 'alive', 'status', 'location', 'source', 'club']) ||
      !isRecord(p.target.source) || !shape(p.target.source, ['encounterId', 'startHistoryIndex', 'settledRound', 'combatStatus']) ||
      !isRecord(p.target.club) || !shape(p.target.club, ['id', 'ownerId', 'location'])) return false;
  const t = p.target;
  if (t.id !== 'MM5-DORN' || t.name !== '多恩' || t.nature !== 'ADULT_ORDINARY_HUMAN' ||
      !finite(t.health, 0, 100) || !finite(t.mind, 0, 100) || t.spirituality !== 15 - n.deliveries || !integer(t.injuryRisk) ||
      typeof t.alive !== 'boolean' || !['SURRENDERED', 'INITIAL_CONTROL', 'CONTROLLED', 'DEAD', 'DEPARTED', 'INERT', 'UNCONTROLLED'].includes(t.status) ||
      !['ORIGINAL_COURTYARD', 'DEPARTED'].includes(t.location) || !Array.isArray(t.injuries) || t.injuries.length > 10000) return false;
  if (!t.injuries.every(i => isRecord(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision))) || new Set(t.injuries.map(i => i.id)).size !== t.injuries.length) return false;
  if (t.source.encounterId !== 'MARIONETTIST_DISPUTE' || !integer(t.source.startHistoryIndex) || !integer(t.source.settledRound, 1) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(t.source.combatStatus) ||
      t.club.id !== 'MM5-DORN-CLUB' || t.club.ownerId !== 'MM5-DORN' || !['DORN_HAND', 'COURTYARD_GROUND'].includes(t.club.location)) return false;
  if (t.alive !== ['SURRENDERED', 'INITIAL_CONTROL', 'DEPARTED', 'UNCONTROLLED'].includes(t.status) || p.active !== (t.status === 'CONTROLLED') ||
      t.location !== (t.status === 'DEPARTED' ? 'DEPARTED' : 'ORIGINAL_COURTYARD')) return false;
  if ((t.status === 'DEAD') !== (t.health === 0) || (t.status === 'DEAD') !== (t.source.combatStatus === 'DEAD')) return false;
  if (t.status === 'UNCONTROLLED') return t.source.combatStatus === 'RESISTING' && c.elapsedSeconds === 0 && n.deliveries === 0 && p.ownerDistanceMetres === null && t.club.location === 'DORN_HAND';
  if (t.status === 'DEAD') return c.elapsedSeconds === 0 && n.deliveries === 0 && p.ownerDistanceMetres === null && t.club.location === 'COURTYARD_GROUND';
  if (t.source.combatStatus !== 'SURRENDERED' || t.health <= 0) return false;
  if (t.status === 'SURRENDERED') return c.elapsedSeconds === 0 && n.deliveries === 0 && p.ownerDistanceMetres === 2 && t.club.location === 'COURTYARD_GROUND';
  if (t.status === 'INITIAL_CONTROL') return c.elapsedSeconds === 20 && success(c.beginOutcome) && n.deliveries === 0 && p.ownerDistanceMetres === 2 && t.club.location === 'COURTYARD_GROUND';
  if (t.status === 'DEPARTED') return n.deliveries === 0 && p.ownerDistanceMetres === null && t.club.location === 'DORN_HAND' && !success(c.completeOutcome) && (c.elapsedSeconds !== 300 || failure(c.completeOutcome));
  return c.elapsedSeconds === 300 && success(c.completeOutcome) && t.club.location === 'COURTYARD_GROUND' &&
    (t.status === 'CONTROLLED' ? p.ownerDistanceMetres === 2 : [2, 122].includes(p.ownerDistanceMetres ?? 0));
}
