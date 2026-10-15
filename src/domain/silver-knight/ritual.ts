import { stableStringify } from '../canonical.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { hasSilverKnightOldPractice } from './index.js';
import { hasSilverKnightLifeLock } from './life.js';
import { getSilverKnightHuntRemains, placeSilverKnightHuntRemains, consumeSilverKnightHuntRemains, hasSilverKnightEncounterLock } from './encounter.js';

export const SILVER_KNIGHT_ALTAR_SLOTS = [
  { id: 'NORTH', speciesId: 'ROCK_HUSK', label: '北位·岩壳兽' },
  { id: 'NORTH_EAST', speciesId: 'EMBER_WING', label: '东北位·烬翼兽' },
  { id: 'SOUTH_EAST', speciesId: 'MIST_ANTLER', label: '东南位·雾角兽' },
  { id: 'SOUTH', speciesId: 'THORN_SHADOW', label: '南位·棘影兽' },
  { id: 'SOUTH_WEST', speciesId: 'RESONANT_BONE', label: '西南位·鸣骨兽' },
  { id: 'NORTH_WEST', speciesId: 'FROST_SPINE', label: '西北位·霜脊兽' },
] as const;
export type SilverKnightAltarSlotId = typeof SILVER_KNIGHT_ALTAR_SLOTS[number]['id'];
export type SilverKnightRitualLocation = 'DOOR' | 'MEETING' | 'ALTAR';
export type SilverKnightRitualCommand =
  | { type: 'RITUAL_REQUEST_MEETING' | 'RITUAL_GO_MEETING' | 'RITUAL_SHOW_RECORDS' | 'RITUAL_SEEK_BLESSING' | 'RITUAL_RETURN_DOOR' | 'RITUAL_CANCEL_MEETING' | 'RITUAL_GO_ALTAR' }
  | { type: 'RITUAL_PLACE_REMAINS'; remainsId: string; slotId: SilverKnightAltarSlotId };
export interface SilverKnightAnchorEntry { root: 'warrior' | 'guardian'; caseId: string; personId: string; eventWeek: number; outcome: string }
export interface SilverKnightAnchor {
  id: 'SK3-ANCHOR-JOURNAL'; owner: 'PLAYER'; location: 'PLAYER'; quantity: 1;
  writtenWeek: number; text: string; entries: SilverKnightAnchorEntry[];
}
export interface SilverKnightBlessing {
  id: string; sourceId: 'SK3-AURIEL'; meetingId: string; grantedWeek: number;
  status: 'ACTIVE' | 'CONSUMED' | 'CANCELLED' | 'EXPIRED'; consumedWeek: number | null;
}
export interface SilverKnightMeeting {
  id: string; requestedWeek: number; visited: boolean; shown: boolean; returned: boolean;
  status: 'REQUESTED' | 'GRANTED' | 'REFUSED' | 'CANCELLED'; decisionTier: PublicResolutionTier | null;
  sourceWilling: boolean | null; anchorId: 'SK3-ANCHOR-JOURNAL' | null; remainsIds: string[];
  blessing: SilverKnightBlessing | null;
}
export interface SilverKnightRitualAttempt {
  id: string; week: number; remainsIds: string[]; blessingId: string;
  kitId: string; kitStatus: 'APPLIED'; sealingPowderSpent: 1; altarMaterialSpent: 1; costPence: 140;
  status: 'PREPARED' | 'CANCELLED' | 'CONSUMED'; bottleId: string | null; outcome: PublicResolutionTier | null;
}
export interface SilverKnightRitualMove { week: number; from: SilverKnightRitualLocation; to: SilverKnightRitualLocation; metres: 4 | 6; mode: 'WALK' }
export interface SilverKnightRitualState {
  siteId: 'SK3-CHAPEL'; door: { id: 'SK3-CHAPEL-DOOR'; state: 'OPEN' };
  altarId: 'SK3-CHAPEL-ALTAR'; meetingPointId: 'SK3-CHAPEL-MEETING';
  auriel: { id: 'SK3-AURIEL'; name: '晨印守望者奥瑞尔'; nature: 'ORIGINAL_G_ANGEL'; willing: boolean };
  playerLocation: SilverKnightRitualLocation; travelMetres: number; moves: SilverKnightRitualMove[];
  anchor: SilverKnightAnchor | null; meetings: SilverKnightMeeting[]; activeMeetingId: string | null;
  slots: { slotId: SilverKnightAltarSlotId; remainsId: string | null }[];
  attempts: SilverKnightRitualAttempt[]; activeAttemptId: string | null;
}
export interface SilverKnightRitualAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SilverKnightRitualCommand }
export interface SilverKnightRitualProjection extends SilverKnightRitualState {
  title: string; story: string; nextStep: string; inside: boolean; facts: string[];
  blessing: SilverKnightBlessing | null; actions: SilverKnightRitualAction[];
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const tier = (v: unknown) => ['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(v));
export function createSilverKnightRitualState(): SilverKnightRitualState {
  return { siteId: 'SK3-CHAPEL', door: { id: 'SK3-CHAPEL-DOOR', state: 'OPEN' }, altarId: 'SK3-CHAPEL-ALTAR', meetingPointId: 'SK3-CHAPEL-MEETING',
    auriel: { id: 'SK3-AURIEL', name: '晨印守望者奥瑞尔', nature: 'ORIGINAL_G_ANGEL', willing: true }, playerLocation: 'DOOR', travelMetres: 0, moves: [],
    anchor: null, meetings: [], activeMeetingId: null, slots: SILVER_KNIGHT_ALTAR_SLOTS.map(slot => ({ slotId: slot.id, remainsId: null })), attempts: [], activeAttemptId: null };
}
export const hasSilverKnightRitualLock = (s: SliceState): boolean => s.silverKnight.preparedWeek !== null || s.silverKnight.ritual.playerLocation !== 'DOOR' || s.silverKnight.ritual.activeMeetingId !== null || s.silverKnight.ritual.activeAttemptId !== null;
function anchorEntries(s: SliceState): SilverKnightAnchorEntry[] {
  const entries: SilverKnightAnchorEntry[] = [];
  for (const caseId of ['yard-gate', 'staff-drill', 'loaded-trolley']) {
    const scene = s.warrior.cases[caseId];
    if (scene?.status === 'RESOLVED' && scene.attemptWeek !== null) entries.push({ root: 'warrior', caseId, personId: '奥斯温·布莱克特', eventWeek: scene.attemptWeek, outcome: scene.outcome });
  }
  for (const caseId of ['guarded-load', 'nearby-companion']) {
    const scene = s.guardian.cases[caseId];
    if (scene?.status === 'RESOLVED' && scene.attemptWeek !== null) entries.push({ root: 'guardian', caseId, personId: caseId === 'nearby-companion' ? '维拉·埃德里奇（Vera Edridge）' : '奥斯温·布莱克特', eventWeek: scene.attemptWeek, outcome: scene.outcome });
  }
  return entries;
}
export function silverKnightAnchorBlock(s: SliceState): string | null {
  const entries = anchorEntries(s);
  return entries.some(e => e.root === 'warrior') && entries.some(e => e.root === 'guardian') ? null : '须有本人原战士训练与守护者护人报告，不能凭空写入未发生的经历。';
}
export function writeSilverKnightAnchor(s: SliceState): void {
  const reason = silverKnightAnchorBlock(s); if (reason || s.silverKnight.ritual.anchor) throw new Error(reason ?? '唯一原锚册已经写下，不能重复造册。');
  s.silverKnight.ritual.anchor = { id: 'SK3-ANCHOR-JOURNAL', owner: 'PLAYER', location: 'PLAYER', quantity: 1, writtenWeek: s.week,
    text: '我曾在奥斯温的原训练场学会持械与克制，也实际护过身旁的人。成功、退让、原物与真实代价一起属于我的经历。', entries: anchorEntries(s) };
}
const meeting = (s: SliceState) => s.silverKnight.ritual.meetings.find(m => m.id === s.silverKnight.ritual.activeMeetingId) ?? null;
const activeAttempt = (s: SliceState) => s.silverKnight.ritual.attempts.find(a => a.id === s.silverKnight.ritual.activeAttemptId) ?? null;
export function currentSilverKnightBlessing(s: SliceState): SilverKnightBlessing | null {
  return s.silverKnight.ritual.meetings.map(m => m.blessing).find(b => b?.status === 'ACTIVE' && b.grantedWeek === s.week) ?? null;
}
export function currentSilverKnightRemains(s: SliceState) {
  const remains = getSilverKnightHuntRemains(s);
  return SILVER_KNIGHT_ALTAR_SLOTS.map(slot => remains.find(r => r.speciesId === slot.speciesId && r.status !== 'CONSUMED')).filter((r): r is NonNullable<typeof r> => !!r);
}
export function validateSilverKnightRitualCommand(v: unknown): v is SilverKnightRitualCommand {
  if (!record(v)) return false;
  if (v.type === 'RITUAL_PLACE_REMAINS') return shape(v, ['type', 'remainsId', 'slotId']) && typeof v.remainsId === 'string' && v.remainsId.length > 0 && v.remainsId.length < 160 && SILVER_KNIGHT_ALTAR_SLOTS.some(slot => slot.id === v.slotId);
  return shape(v, ['type']) && ['RITUAL_REQUEST_MEETING', 'RITUAL_GO_MEETING', 'RITUAL_SHOW_RECORDS', 'RITUAL_SEEK_BLESSING', 'RITUAL_RETURN_DOOR', 'RITUAL_CANCEL_MEETING', 'RITUAL_GO_ALTAR'].includes(String(v.type));
}
export function silverKnightRitualBlock(s: SliceState, c: SilverKnightRitualCommand): string | null {
  if (!validateSilverKnightRitualCommand(c)) return '银骑士祭坛命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且清醒，祝福不会复活死亡。';
  if (s.activeEvent || s.combat || hasSilverKnightOldPractice(s) || hasSilverKnightLifeLock(s) || hasSilverKnightEncounterLock(s)) return '先沿真实路线结束原事件、战斗与其它实践。';
  if (s.world.city !== 'BACKLUND' || s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 4 || !s.silverKnight.guidanceKnown) return '须在贝克兰德，作为已听过指导的猎魔者4本人来到原礼堂。';
  const r = s.silverKnight.ritual, m = meeting(s);
  if (s.silverKnight.preparedWeek !== null || r.activeAttemptId !== null) return '当前祭坛已应用本次耗材；独立确认饮药或沿原路结束本次准备。';
  if (c.type === 'RITUAL_RETURN_DOOR') return r.playerLocation === 'DOOR' ? '本人已经在原门处。' : m?.status === 'REQUESTED' ? '先等待实际祝福回应或明确取消这次会面，再沿原路离开。' : null;
  if (c.type === 'RITUAL_CANCEL_MEETING') return !m || m.status !== 'REQUESTED' ? '没有尚在等待的本次会面。' : null;
  if (c.type === 'RITUAL_REQUEST_MEETING') {
    if (r.playerLocation !== 'DOOR' || m) return '先实际回到原门并结束上一场会面。';
    if (s.actionsRemaining < 2) return '预约花1行动；本周须至少余2行动，留1行动完成同周祭坛准备。';
    if (r.meetings.some(previous => previous.requestedWeek === s.week)) return '本周已经实际申请过，新的独立回应须等下一真实周。';
    if (s.silverKnight.preparations.length !== 3 || !r.anchor) return '先完成三项准备并实际写下唯一原锚册。';
    if (currentSilverKnightRemains(s).length !== 6) return '须六种本人实际亲猎并收集的原遗骸齐全；旧尸、购买材料和投降者不能代替。';
    return null;
  }
  if (c.type === 'RITUAL_GO_MEETING') return !m || m.status !== 'REQUESTED' || r.playerLocation !== 'DOOR' || m.visited ? '先从原门预约，再本人普通走6米到原会见点。' : null;
  if (c.type === 'RITUAL_SHOW_RECORDS') return !m || m.status !== 'REQUESTED' || r.playerLocation !== 'MEETING' || !m.visited || m.shown ? '须本人在本次原会见点，尚未出示过记录。' : !r.anchor || currentSilverKnightRemains(s).length !== 6 ? '当前原锚和六种原亲猎记录不齐。' : null;
  if (c.type === 'RITUAL_SEEK_BLESSING') return !m || m.status !== 'REQUESTED' || r.playerLocation !== 'MEETING' || !m.shown ? '须本人实际走到会见点并出示这六件原亲猎记录与原锚册。' : null;
  if (m) return '先结束本次会见，并本人沿6米原路回到门处。';
  if (c.type === 'RITUAL_GO_ALTAR') return r.playerLocation !== 'DOOR' ? '先回到原门。' : !s.silverKnight.preparations.some(p => p.taskId === 'READ_ALTAR') ? '先实际读过导师G祭坛布局。' : null;
  if (r.playerLocation !== 'ALTAR') return '须本人从原门普通走4米到祭坛，不能远距放遗骸。';
  if (c.type === 'RITUAL_PLACE_REMAINS') {
    const slot = SILVER_KNIGHT_ALTAR_SLOTS.find(v => v.id === c.slotId)!, placed = r.slots.find(v => v.slotId === c.slotId)!;
    const remains = getSilverKnightHuntRemains(s).find(v => v.id === c.remainsId);
    if (placed.remainsId !== null) return '这个原槽已有原遗骸，不能复制或叠放。';
    if (!remains || remains.status !== 'OWNER_PLAYER' || remains.speciesId !== slot.speciesId || remains.killedBy !== 'PLAYER' || remains.outcome !== 'ENEMY_DEAD') return '只能亲手放入本人实际击杀所得、属于此种且尚持有的唯一原遗骸。';
    return null;
  }
  return '未知的祭坛操作。';
}
function walk(s: SliceState, to: SilverKnightRitualLocation): void {
  const r = s.silverKnight.ritual, from = r.playerLocation;
  if (from === to || from !== 'DOOR' && to !== 'DOOR') throw new Error('须沿原门相连的普通路线移动。');
  const metres = from === 'MEETING' || to === 'MEETING' ? 6 : 4;
  r.moves.push({ week: s.week, from, to, metres, mode: 'WALK' }); r.travelMetres += metres; r.playerLocation = to;
}
export function applySilverKnightRitualCommand(s: SliceState, c: SilverKnightRitualCommand, ctx: SeerContext): void {
  const reason = silverKnightRitualBlock(s, c); if (reason) throw new Error(reason);
  const r = s.silverKnight.ritual, m = meeting(s);
  switch (c.type) {
    case 'RITUAL_REQUEST_MEETING': {
      for (const old of r.meetings) if (old.blessing?.status === 'ACTIVE') old.blessing.status = 'EXPIRED';
      s.actionsRemaining--; const id = `SK3-AURIEL-MEETING-${r.meetings.length + 1}`;
      r.meetings.push({ id, requestedWeek: s.week, visited: false, shown: false, returned: false, status: 'REQUESTED', decisionTier: null, sourceWilling: null, anchorId: null, remainsIds: [], blessing: null }); r.activeMeetingId = id;
      ctx.note('实际预约原创天使会面', '花1行动，原晨印守望者奥瑞尔SK3-AURIEL仅接受这一场有原亲猎记录和原锚的申请。本人仍在原门，尚未显现或给予祝福；可拒绝或取消，下一真实周才能另约。'); return;
    }
    case 'RITUAL_GO_MEETING': walk(s, 'MEETING'); m!.visited = true; ctx.note('本人走到原会见点', '沿原门普通走6米，身体在SK3-CHAPEL-MEETING，没有传送、远距代身或免费天使伙伴。'); return;
    case 'RITUAL_SHOW_RECORDS': m!.shown = true; m!.anchorId = r.anchor!.id; m!.remainsIds = currentSilverKnightRemains(s).map(v => v.id); ctx.note('当面出示原亲猎与原锚', `出示这六件原遗骸的本人死亡/采集来源记录：${m!.remainsIds.join('、')}；亲笔原册${r.anchor!.id}引用已有训练与护人事实。原物仍在原位置。`); return;
    case 'RITUAL_SEEK_BLESSING': {
      m!.sourceWilling = r.auriel.willing;
      const result = r.auriel.willing ? ctx.check('will', 18) : null;
      m!.decisionTier = result?.tier ?? null;
      if (r.auriel.willing && success(m!.decisionTier)) {
        m!.status = 'GRANTED'; m!.blessing = { id: `SK3-AURIEL-BLESSING-${r.meetings.length}`, sourceId: 'SK3-AURIEL', meetingId: m!.id, grantedWeek: s.week, status: 'ACTIVE', consumedWeek: null };
        ctx.note('奥瑞尔实际显现并给予当场祝福', `${m!.id}中原创G天使在原会见点回应，意志${result!.roll}/${result!.chance}，给予唯一${m!.blessing.id}。仅第${s.week}周这六种亲猎祭坛可用；不授水银形态、随机好运或任意呼神能力。本人仍须普通6米返回。`);
      } else { m!.status = 'REFUSED'; ctx.note('原天使没有给予本次祝福', result ? `当面请求检定${result.roll}/${result.chance}未获回应，已用1行动不返；六原遗骸和原锚保留，普通6米返回。下周可重新申请，不能将失败当祝福。` : '奥瑞尔本次不愿回应，没有祝福。本人原锚与六遗骸仍在原位置，普通6米返回；不强迫同意。'); }
      return;
    }
    case 'RITUAL_CANCEL_MEETING': m!.status = 'CANCELLED'; if (r.playerLocation === 'DOOR') { m!.returned = true; r.activeMeetingId = null; } ctx.note('取消这次会面', '未生成祝福，已花行动不返；人在会见点时仍须普通走回原门，六原遗骸与原锚位置保留。'); return;
    case 'RITUAL_RETURN_DOOR': {
      const metres = r.playerLocation === 'MEETING' ? 6 : 4; walk(s, 'DOOR'); if (m) { m.returned = true; r.activeMeetingId = null; }
      ctx.note('本人沿原路回到门处', `普通走${metres}米回SK3-CHAPEL-DOOR，身体位置真实改变。已放祭坛的原遗骸留原槽，不远距收物、不复原耗材。`); return;
    }
    case 'RITUAL_GO_ALTAR': walk(s, 'ALTAR'); ctx.note('本人走到原祭坛', '从原门普通走4米到SK3-CHAPEL-ALTAR。六个原槽真实独立，须按导师明确G方案逐一放入对应种原遗骸。'); return;
    case 'RITUAL_PLACE_REMAINS': if (!placeSilverKnightHuntRemains(s, c.remainsId, c.slotId)) throw new Error('原遗骸状态变化，尚未放置。'); r.slots.find(v => v.slotId === c.slotId)!.remainsId = c.remainsId; ctx.note('亲手放置同一原遗骸', `${c.remainsId}从本人持有转到原祭坛${c.slotId}，唯一来源记录不变；没有复制、购买或改名代替。`); return;
  }
}
export function silverKnightRitualPreparationBlock(s: SliceState): string | null {
  const r = s.silverKnight.ritual, remains = getSilverKnightHuntRemains(s), blessing = currentSilverKnightBlessing(s);
  if (r.playerLocation !== 'ALTAR' || r.activeMeetingId !== null) return '本人须结束实际会见并从原门走4米到原祭坛。';
  if (!r.anchor || !blessing) return '需要原锚册与奥瑞尔当周实际给予、尚未消耗的祝福。';
  const source = r.meetings.find(m => m.id === blessing.meetingId)!;
  if (!source.returned || source.status !== 'GRANTED') return '先从本次会见点实际返回原门。';
  for (const required of SILVER_KNIGHT_ALTAR_SLOTS) {
    const id = r.slots.find(slot => slot.slotId === required.id)?.remainsId;
    const original = remains.find(v => v.id === id);
    if (!original || original.status !== 'ALTAR' || original.speciesId !== required.speciesId || original.slotId !== required.id || !source.remainsIds.includes(original.id)) return '须六种不同原亲猎遗骸全在正确原槽，且属于本次当面审核的六件原物。';
  }
  return null;
}
export function prepareSilverKnightRitual(s: SliceState): void {
  const reason = silverKnightRitualPreparationBlock(s); if (reason || s.silverKnight.ritual.activeAttemptId) throw new Error(reason ?? '本次祭坛已经应用耗材。');
  const r = s.silverKnight.ritual, number = r.attempts.length + 1, id = `SK3-RITE-${number}`;
  r.attempts.push({ id, week: s.week, remainsIds: r.slots.map(v => v.remainsId!), blessingId: currentSilverKnightBlessing(s)!.id, kitId: `SK3-ALTAR-KIT-${number}`, kitStatus: 'APPLIED', sealingPowderSpent: 1, altarMaterialSpent: 1, costPence: 140, status: 'PREPARED', bottleId: null, outcome: null }); r.activeAttemptId = id;
}
export function cancelSilverKnightRitual(s: SliceState): void {
  const r = s.silverKnight.ritual, attempt = activeAttempt(s); if (!attempt || attempt.status !== 'PREPARED' || r.playerLocation !== 'ALTAR') throw new Error('没有可实际结束的当次祭坛准备。');
  attempt.status = 'CANCELLED'; const blessing = r.meetings.map(m => m.blessing).find(b => b?.id === attempt.blessingId)!; blessing.status = 'CANCELLED'; r.activeAttemptId = null; walk(s, 'DOOR');
}
export function consumeSilverKnightRitual(s: SliceState, bottleId: string, outcome: PublicResolutionTier): void {
  const reason = silverKnightRitualPreparationBlock(s), r = s.silverKnight.ritual, attempt = activeAttempt(s);
  if (reason || !attempt || attempt.status !== 'PREPARED' || attempt.week !== s.week) throw new Error(reason ?? '本周原祭坛尚未准备。');
  if (!consumeSilverKnightHuntRemains(s, attempt.remainsIds)) throw new Error('这六原遗骸未能原子消耗，尚未饮药。');
  attempt.status = 'CONSUMED'; attempt.bottleId = bottleId; attempt.outcome = outcome;
  const blessing = r.meetings.map(m => m.blessing).find(b => b?.id === attempt.blessingId)!; blessing.status = 'CONSUMED'; blessing.consumedWeek = s.week;
  for (const slot of r.slots) slot.remainsId = null;
  r.activeAttemptId = null; walk(s, 'DOOR');
}
export function silverKnightRitualActions(s: SliceState): SilverKnightRitualAction[] {
  if (!s.silverKnight.guidanceKnown || s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 4) return [];
  const r = s.silverKnight.ritual, m = meeting(s), actions: SilverKnightRitualAction[] = [];
  const add = (label: string, cost: string, command: SilverKnightRitualCommand) => { const reason = silverKnightRitualBlock(s, command); actions.push({ id: command.type === 'RITUAL_PLACE_REMAINS' ? `place-${command.remainsId}` : command.type.toLowerCase(), label, cost, command, enabled: reason === null, reason }); };
  if (s.silverKnight.preparedWeek !== null) return actions;
  if (m) {
    if (m.status === 'REQUESTED') {
      if (!m.visited) add('本人走6米到原会见点', '0行动 · 普通6米', { type: 'RITUAL_GO_MEETING' });
      else if (!m.shown) add('当面出示六原亲猎记录与原锚册', '0行动 · 原件核对', { type: 'RITUAL_SHOW_RECORDS' });
      else add('请求奥瑞尔实际回应本次祝福', '0行动 · 意志18 G · 可以拒绝', { type: 'RITUAL_SEEK_BLESSING' });
      add('取消这次祝福会面', '0行动 · 已用行动不返', { type: 'RITUAL_CANCEL_MEETING' });
    } else add('沿6米原路回门处', '0行动 · 普通6米', { type: 'RITUAL_RETURN_DOOR' });
  } else if (r.playerLocation === 'ALTAR') {
    for (const slot of SILVER_KNIGHT_ALTAR_SLOTS) {
      const remains = currentSilverKnightRemains(s).find(v => v.speciesId === slot.speciesId && v.status === 'OWNER_PLAYER');
      if (remains) add(`亲手放入${slot.label}`, '0行动 · 唯一原遗骸转移', { type: 'RITUAL_PLACE_REMAINS', remainsId: remains.id, slotId: slot.id });
    }
    add('本人沿4米原路回门处', '0行动 · 原槽遗骸留原位', { type: 'RITUAL_RETURN_DOOR' });
  } else {
    if (!currentSilverKnightBlessing(s)) add('预约原天使当场会面', '1行动 · 须留另1行动本周准备', { type: 'RITUAL_REQUEST_MEETING' });
    add('本人走4米到原祭坛', '0行动 · 普通4米', { type: 'RITUAL_GO_ALTAR' });
  }
  return actions;
}
export function projectSilverKnightRitual(s: SliceState): SilverKnightRitualProjection {
  const r = s.silverKnight.ritual, m = meeting(s), blessing = currentSilverKnightBlessing(s), actions = silverKnightRitualActions(s);
  return { ...structuredClone(r), title: '原封护礼堂与六种亲猎祭坛（G）', story: '六种亲猎遗骸、复杂祭坛和祝福为已核核心；六角布置、原奥瑞尔、现场审核和全部数值为G。完整配方与原著精确布局未知。', inside: hasSilverKnightRitualLock(s), blessing: blessing ? structuredClone(blessing) : null, actions,
    nextStep: s.silverKnight.preparedWeek !== null ? '复核四档风险，独立确认这一原瓶或沿4米原路退出。' : actions.find(a => a.enabled)?.label ?? '先完成本人亲猎、原锚与三项准备。',
    facts: [`原门${r.door.id}：${r.door.state}；本人${r.playerLocation}，累计普通步行${r.travelMetres}米。`,
      r.anchor ? `唯一原锚册${r.anchor.id}由本人第${r.anchor.writtenWeek}周写下，引用${r.anchor.entries.length}项原训练/护人记录，原册仍由本人持有。` : '唯一原锚册尚未亲笔记录，不生成信众或免费锚。',
      `原创G天使${r.auriel.name}(${r.auriel.id})是独立祝福来源；${m ? `本次${m.id}：${m.status}，${m.shown ? '已当面出示原记录' : '尚未出示原记录'}。` : `已结束或未开启会见，共${r.meetings.length}次实际申请。`}`,
      blessing ? `本周有效原祝福${blessing.id}，源于${blessing.meetingId}，仅本次原祭坛使用。` : '当前没有本周有效原祝福；过期、拒绝或取消均不能当成功。',
      ...r.slots.map(slot => `${SILVER_KNIGHT_ALTAR_SLOTS.find(v => v.id === slot.slotId)!.label}：${slot.remainsId ?? '尚空'}。`),
      ...r.attempts.map(a => `${a.id}第${a.week}周：${a.status}，原耗材${a.kitId}封护粉1与祭坛材料1实际用尽、140便士不退；原六遗骸${a.remainsIds.join('、')}，祝福${a.blessingId}${a.bottleId ? `，原瓶${a.bottleId}/${a.outcome}` : '，尚未饮药'}。`)] };
}

/** Cross-check original provenance instead of creating a second inventory. */
export function validateSilverKnightRitual(s: SliceState): boolean { try { return validate(s); } catch { return false; } }
function validate(s: SliceState): boolean {
  const r = s.silverKnight.ritual, firstWeek = s.demonHunter.promotionWeek ?? s.week;
  if (!record(r) || !shape(r, ['siteId', 'door', 'altarId', 'meetingPointId', 'auriel', 'playerLocation', 'travelMetres', 'moves', 'anchor', 'meetings', 'activeMeetingId', 'slots', 'attempts', 'activeAttemptId'])) return false;
  if (r.siteId !== 'SK3-CHAPEL' || r.altarId !== 'SK3-CHAPEL-ALTAR' || r.meetingPointId !== 'SK3-CHAPEL-MEETING' || !record(r.door) || !shape(r.door, ['id', 'state']) || r.door.id !== 'SK3-CHAPEL-DOOR' || r.door.state !== 'OPEN' || !record(r.auriel) || !shape(r.auriel, ['id', 'name', 'nature', 'willing']) || r.auriel.id !== 'SK3-AURIEL' || r.auriel.name !== '晨印守望者奥瑞尔' || r.auriel.nature !== 'ORIGINAL_G_ANGEL' || typeof r.auriel.willing !== 'boolean') return false;
  if (!Array.isArray(r.moves) || !Array.isArray(r.slots) || !Array.isArray(r.meetings) || !Array.isArray(r.attempts) || !integer(r.travelMetres)) return false;
  let position: SilverKnightRitualLocation = 'DOOR', distance = 0, moveWeek = firstWeek;
  for (const v of r.moves) { if (!record(v) || !shape(v, ['week', 'from', 'to', 'metres', 'mode']) || !integer(v.week, moveWeek, s.week) || v.from !== position || !['DOOR', 'MEETING', 'ALTAR'].includes(v.to) || v.from === v.to || v.from !== 'DOOR' && v.to !== 'DOOR' || v.mode !== 'WALK' || v.metres !== (v.from === 'MEETING' || v.to === 'MEETING' ? 6 : 4)) return false; position = v.to; distance += v.metres; moveWeek = v.week; }
  if (r.playerLocation !== position || r.travelMetres !== distance) return false;
  const recorded = s.silverKnight.preparations.find(p => p.taskId === 'RECORD_ANCHOR');
  if (r.anchor === null) { if (recorded) return false; }
  else {
    if (!record(r.anchor) || !shape(r.anchor, ['id', 'owner', 'location', 'quantity', 'writtenWeek', 'text', 'entries']) || r.anchor.id !== 'SK3-ANCHOR-JOURNAL' || r.anchor.owner !== 'PLAYER' || r.anchor.location !== 'PLAYER' || r.anchor.quantity !== 1 || !recorded || r.anchor.writtenWeek !== recorded.completedWeek || r.anchor.text !== '我曾在奥斯温的原训练场学会持械与克制，也实际护过身旁的人。成功、退让、原物与真实代价一起属于我的经历。' || stableStringify(r.anchor.entries) !== stableStringify(anchorEntries(s)) || silverKnightAnchorBlock(s)) return false;
  }
  const remains = getSilverKnightHuntRemains(s);
  if (r.slots.length !== 6 || r.slots.some((slot, index) => !record(slot) || !shape(slot, ['slotId', 'remainsId']) || slot.slotId !== SILVER_KNIGHT_ALTAR_SLOTS[index]!.id)) return false;
  const used = new Set<string>();
  for (const [index, slot] of r.slots.entries()) if (slot.remainsId !== null) { const original = remains.find(v => v.id === slot.remainsId); if (!original || original.status !== 'ALTAR' || original.slotId !== slot.slotId || original.speciesId !== SILVER_KNIGHT_ALTAR_SLOTS[index]!.speciesId || used.has(original.id)) return false; used.add(original.id); }
  if (remains.some(v => v.status === 'ALTAR' && !used.has(v.id))) return false;
  let previousMeetingWeek = firstWeek - 1;
  for (const [index, m] of r.meetings.entries()) {
    if (!record(m) || !shape(m, ['id', 'requestedWeek', 'visited', 'shown', 'returned', 'status', 'decisionTier', 'sourceWilling', 'anchorId', 'remainsIds', 'blessing']) || m.id !== `SK3-AURIEL-MEETING-${index + 1}` || !integer(m.requestedWeek, previousMeetingWeek + 1, s.week) || !['REQUESTED', 'GRANTED', 'REFUSED', 'CANCELLED'].includes(m.status) || typeof m.visited !== 'boolean' || typeof m.shown !== 'boolean' || typeof m.returned !== 'boolean' || !Array.isArray(m.remainsIds)) return false;
    previousMeetingWeek = m.requestedWeek;
    if (s.silverKnight.preparations.length !== 3 || s.silverKnight.preparations.some(p => p.completedWeek > m.requestedWeek) || !r.anchor) return false;
    const approaches = r.moves.filter(v => v.week === m.requestedWeek && v.to === 'MEETING').length;
    const returns = r.moves.filter(v => v.week === m.requestedWeek && v.from === 'MEETING').length;
    if (approaches !== (m.visited ? 1 : 0) || returns !== (m.visited && m.returned ? 1 : 0)) return false;
    if (m.shown) {
      if (!m.visited || !r.anchor || r.anchor.writtenWeek > m.requestedWeek || m.anchorId !== r.anchor.id || m.remainsIds.length !== 6 || new Set(m.remainsIds).size !== 6) return false;
      for (const [n, id] of m.remainsIds.entries()) { const original = remains.find(v => v.id === id); if (!original || original.speciesId !== SILVER_KNIGHT_ALTAR_SLOTS[n]!.speciesId || original.collectedWeek > m.requestedWeek || original.consumedWeek !== null && original.consumedWeek < m.requestedWeek || original.killedBy !== 'PLAYER' || original.outcome !== 'ENEMY_DEAD') return false; }
    } else if (m.anchorId !== null || m.remainsIds.length) return false;
    if (m.status === 'GRANTED' || m.status === 'REFUSED') {
      if (!m.shown || typeof m.sourceWilling !== 'boolean' || m.sourceWilling && !tier(m.decisionTier) || !m.sourceWilling && m.decisionTier !== null) return false;
      if ((m.sourceWilling && success(m.decisionTier)) !== (m.status === 'GRANTED')) return false;
    } else if (m.sourceWilling !== null || m.decisionTier !== null || m.blessing !== null) return false;
    if (m.status === 'GRANTED') {
      const b = m.blessing;
      if (!b || !shape(b, ['id', 'sourceId', 'meetingId', 'grantedWeek', 'status', 'consumedWeek']) || b.id !== `SK3-AURIEL-BLESSING-${index + 1}` || b.sourceId !== 'SK3-AURIEL' || b.meetingId !== m.id || b.grantedWeek !== m.requestedWeek || !['ACTIVE', 'CONSUMED', 'CANCELLED', 'EXPIRED'].includes(b.status)) return false;
      if (b.status === 'CONSUMED' ? b.consumedWeek !== b.grantedWeek : b.consumedWeek !== null) return false;
    } else if (m.blessing !== null) return false;
    if (!m.returned && r.activeMeetingId !== m.id || m.returned && r.activeMeetingId === m.id || m.status === 'REQUESTED' && m.returned) return false;
  }
  if (r.moves.some(v => (v.from === 'MEETING' || v.to === 'MEETING') && !r.meetings.some(m => m.requestedWeek === v.week))) return false;
  if (r.meetings.filter(m => m.blessing?.status === 'ACTIVE').length > 1) return false;
  const active = meeting(s);
  if (r.activeMeetingId !== null && (!active || active.requestedWeek !== s.week || active.returned || r.activeAttemptId !== null || r.playerLocation !== (active.visited ? 'MEETING' : 'DOOR'))) return false;
  if (r.playerLocation === 'MEETING' && !active) return false;
  let preparedCount = 0, consumed = 0;
  const consumedIds = new Set<string>(), consumedBottles = new Set<string>();
  for (const [index, a] of r.attempts.entries()) {
    if (!record(a) || !shape(a, ['id', 'week', 'remainsIds', 'blessingId', 'kitId', 'kitStatus', 'sealingPowderSpent', 'altarMaterialSpent', 'costPence', 'status', 'bottleId', 'outcome']) || a.id !== `SK3-RITE-${index + 1}` || !integer(a.week, firstWeek + 12, s.week) || a.kitId !== `SK3-ALTAR-KIT-${index + 1}` || a.kitStatus !== 'APPLIED' || a.sealingPowderSpent !== 1 || a.altarMaterialSpent !== 1 || a.costPence !== 140 || !['PREPARED', 'CANCELLED', 'CONSUMED'].includes(a.status) || !Array.isArray(a.remainsIds) || a.remainsIds.length !== 6 || new Set(a.remainsIds).size !== 6) return false;
    const source = r.meetings.find(m => m.blessing?.id === a.blessingId), b = source?.blessing;
    if (!r.moves.some(v => v.week === a.week && v.to === 'ALTAR') || !source || !source.returned || !b || b.grantedWeek !== a.week || JSON.stringify(a.remainsIds) !== JSON.stringify(source.remainsIds)) return false;
    if (r.attempts.slice(0, index).some(old => old.blessingId === a.blessingId)) return false;
    if (a.status === 'PREPARED') { preparedCount++; if (r.activeAttemptId !== a.id || s.silverKnight.preparedWeek !== a.week || a.week !== s.week || b.status !== 'ACTIVE' || a.bottleId !== null || a.outcome !== null || silverKnightRitualPreparationBlock(s)) return false; }
    else if (a.status === 'CANCELLED') { if (b.status !== 'CANCELLED' || a.bottleId !== null || a.outcome !== null) return false; }
    else {
      consumed++; const bottle = s.silverKnight.bottles.find(v => v.id === a.bottleId);
      if (!bottle || consumedBottles.has(bottle.id) || bottle.status !== 'CONSUMED' || bottle.consumedWeek !== a.week || bottle.outcome !== a.outcome || !tier(a.outcome) || b.status !== 'CONSUMED' || b.consumedWeek !== a.week) return false;
      consumedBottles.add(bottle.id);
      for (const id of a.remainsIds) { const original = remains.find(v => v.id === id); if (!original || original.status !== 'CONSUMED' || original.consumedWeek !== a.week || consumedIds.has(id)) return false; consumedIds.add(id); }
    }
  }
  if (r.activeAttemptId !== null ? preparedCount !== 1 || r.playerLocation !== 'ALTAR' : preparedCount !== 0) return false;
  if ((s.silverKnight.preparedWeek !== null) !== (r.activeAttemptId !== null) || consumed !== s.silverKnight.bottles.filter(b => b.status === 'CONSUMED').length || remains.some(v => v.status === 'CONSUMED' && !consumedIds.has(v.id))) return false;
  for (const [index, m] of r.meetings.entries()) if (m.blessing) {
    const b = m.blessing, a = r.attempts.find(v => v.blessingId === b.id);
    if (b.status === 'CONSUMED' && a?.status !== 'CONSUMED' || b.status === 'CANCELLED' && a?.status !== 'CANCELLED' || b.status === 'EXPIRED' && (a || !r.meetings.slice(index + 1).some(v => v.requestedWeek > m.requestedWeek))) return false;
  }
  if (!s.silverKnight.guidanceKnown && (r.anchor || r.moves.length || r.meetings.length || r.attempts.length || r.slots.some(v => v.remainsId !== null))) return false;
  if (s.silverKnight.promotionWeek !== null && hasSilverKnightRitualLock(s)) return false;
  return true;
}
