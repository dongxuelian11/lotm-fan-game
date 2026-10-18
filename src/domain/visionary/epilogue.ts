import type { PublicCheckResult } from '../../shared/contracts.js';
import type { VisionaryBudget } from './source.js';
/** One original relay fault, registered in the era before promotion. This
 * bounded game scene reuses its exact adult people, patients and physical
 * objects. Temporary support is not inventory and never becomes tradable. */
export interface VisionaryEpilogueOrigin {
  id: string; location: string;
  rescuers: { id: string; name: string; age: number; status: string }[];
  patients: { id: string; name: string; age: number; injury: string; status: string }[];
  objects: { id: string; title: string; status: string }[];
}
export type VisionaryEpilogueCommand = { type: 'OBSERVE' | 'SUPPORT_STRUCTURE' | 'GUIDE_RESCUER' | 'EVACUATE' | 'WITHDRAW' | 'REPORT' };
export interface VisionaryEpilogueState {
  id: string; originId: string; location: string; startedWeek: number; startedRevision: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN'; observed: boolean; turns: number;
  supportAttempted: boolean; supportActive: boolean; supportExpiresTurn: number | null;
  guidanceAttempted: boolean; guidanceActive: boolean; guidanceExpiresTurn: number | null;
  rescuerIds: string[]; willingRescuerId: string; resistingRescuerId: string;
  patients: { id: string; injury: string; status: 'SHELTERED' | 'EVACUATED' }[];
  objectIds: string[]; routeDamage: number; rescueInjuries: string[]; reported: boolean;
  journal: { eventId: string; week: number; command: VisionaryEpilogueCommand; check: PublicCheckResult | null; summary: string }[];
}
export function validateVisionaryEpilogueCommand(v: unknown): v is VisionaryEpilogueCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['OBSERVE', 'SUPPORT_STRUCTURE', 'GUIDE_RESCUER', 'EVACUATE', 'WITHDRAW', 'REPORT'].includes(String((v as {type?:unknown}).type));
}
export function createVisionaryEpilogue(origin: VisionaryEpilogueOrigin, input: { eventId: string; week: number; revision: number }): VisionaryEpilogueState {
  if (origin.rescuers.length !== 2 || origin.patients.length !== 2 || origin.objects.length < 3 ||
    [...origin.rescuers, ...origin.patients].some(p => p.age < 19)) throw Error('原现场人员或物件尚未核清。');
  return { id: `${input.eventId}:relay-rescue`, originId: origin.id, location: origin.location,
    startedWeek: input.week, startedRevision: input.revision, status: 'ACTIVE', observed: false, turns: 0,
    supportAttempted: false, supportActive: false, supportExpiresTurn: null,
    guidanceAttempted: false, guidanceActive: false, guidanceExpiresTurn: null,
    rescuerIds: origin.rescuers.map(p => p.id), willingRescuerId: origin.rescuers[0]!.id, resistingRescuerId: origin.rescuers[1]!.id,
    patients: origin.patients.map(p => ({ id: p.id, injury: p.injury, status: 'SHELTERED' })),
    objectIds: origin.objects.map(o => o.id), routeDamage: 25, rescueInjuries: [], reported: false, journal: [] };
}
export function visionaryEpilogueBlock(s: VisionaryEpilogueState, c: VisionaryEpilogueCommand, b: VisionaryBudget): string | null {
  if (!validateVisionaryEpilogueCommand(c)) return '这项现场行动无效。';
  if (b.status !== 'ACTIVE' || b.sequence !== 0) return '须由仍活着的空想家本人行动。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先完成救援或沿普通出口撤离。' : s.reported ? '本次实际报告已经交接。' : null;
  if (s.status !== 'ACTIVE') return '这宗原现场已结束，不能改写结果或重开人员。';
  if (c.type === 'WITHDRAW') return null;
  if (c.type === 'OBSERVE') return s.observed ? '已实际观察过同一现场。' : null;
  if (!s.observed) return '先实际观察原支梁、伤员、担架、遮挡与出口。';
  if (b.actions < 1) return '需要一次行动；仍可零行动从原安全侧道撤离。';
  if (c.type === 'SUPPORT_STRUCTURE') return s.supportAttempted ? '本次原结构已施术一次，不能重抽或改写结果。' : b.spirituality < 12 || b.mind <= 10 ? '有限支撑需要12灵性与10精神，并保有清醒。' : null;
  if (c.type === 'GUIDE_RESCUER') return s.guidanceAttempted ? '本次原队员已接受过一次引导尝试，不能强迫重试。' : b.spirituality < 10 || b.mind <= 8 ? '待行引导需要10灵性与8精神，并保有清醒。' : null;
  return s.patients.every(p => p.status === 'EVACUATED') ? '两名原伤员均已转移。' : null;
}
export function applyVisionaryEpilogue(s: VisionaryEpilogueState, c: VisionaryEpilogueCommand, b: VisionaryBudget,
  input: { eventId: string; revision: number; check: PublicCheckResult | null }): VisionaryEpilogueState {
  const reason = visionaryEpilogueBlock(s,c,b); if (reason) throw Error(reason);
  const next = structuredClone(s), pass = input.check?.tier === 'SUCCESS' || input.check?.tier === 'GREAT_SUCCESS';
  let summary = '';
  if (c.type === 'OBSERVE') {
    next.observed = true;
    summary = '本人观察到原支梁开裂、两名成年原伤员与原担架。第一名成年队员本愿协助搬运，第二名队员因遮挡与安全顾虑拒绝心灵接触；安全侧道仍通。';
  } else if (c.type === 'WITHDRAW') {
    next.status = 'WITHDRAWN'; summary = '沿已观察的原安全侧道普通撤离；未搬离者仍在原遮蔽救护区，原伤、结构损坏和全部费用保留。';
  } else if (c.type === 'REPORT') {
    next.reported = true;
    for (const [attempted,id] of [[next.supportAttempted,'audience.s0.bounded-support'],[next.guidanceAttempted,'audience.s0.finite-guidance']] as const)
      if (attempted) b.mastery[id] = Math.min(100,(b.mastery[id] ?? 0)+2);
    b.acting = Math.min(100,b.acting+10);
    summary = `将${next.patients.filter(p=>p.status==='EVACUATED').length}名实际转运者、原伤、未完成救援和原物损坏交回原站。临时支撑与引导均已结束，没有物品奖励或新身体。`;
  } else {
    b.actions--; next.turns++;
    if (c.type === 'EVACUATE') {
      // Ordinary side-route is real and never requires a successful spell.
      const count = next.supportActive || next.guidanceActive ? 2 : 1;
      const moved = next.patients.filter(p=>p.status==='SHELTERED').slice(0,count);
      moved.forEach(p=>{p.status='EVACUATED';});
      summary = `使用原担架沿实际侧道搬离${moved.length}名原伤员；既有伤势保留。未参与引导的队员按自己的既有意愿处理接线箱，没有被远程控制。`;
      next.supportActive = false; next.guidanceActive = false;
      if (next.patients.every(p=>p.status==='EVACUATED')) next.status = 'RESOLVED';
    } else {
      if (!input.check) throw Error('有限技巧须有中央产生的真实检定。');
      if (c.type === 'SUPPORT_STRUCTURE') {
        b.spirituality-=12; b.mind-=10; next.supportAttempted=true; next.supportActive=pass; next.supportExpiresTurn=next.turns+2;
        b.mastery['audience.s0.bounded-support']=Math.min(100,(b.mastery['audience.s0.bounded-support']??0)+(pass?8:3));
        summary=pass?'已观察的原支梁获得至多两次现场行动的有限支撑，仅供一次搬运；不是永久材料。':'原结构抵抗使支撑失败，原支梁进一步受损；不能重抽结果。';
      } else {
        b.spirituality-=10; b.mind-=8; next.guidanceAttempted=true; next.guidanceActive=pass; next.guidanceExpiresTurn=next.turns+1;
        b.mastery['audience.s0.finite-guidance']=Math.min(100,(b.mastery['audience.s0.finite-guidance']??0)+(pass?8:3));
        summary=pass?'眼前本愿救援的原队员得到一次短时搬运引导，仅对下一项尚未发生的行动有效；被遮挡且抵抗的另一人不受影响。':'原队员的紧张与抵抗使引导失败；其自由意愿、已发生行动和现场事实不变。';
      }
      if(!pass){ const severe=input.check.tier==='GREAT_FAILURE'; b.health=Math.max(0,b.health-(severe?25:10)); b.mind=Math.max(0,b.mind-(severe?12:4)); next.routeDamage=Math.min(100,next.routeDamage+(severe?20:10));
        b.injuries.push({id:`${input.eventId}:relay-injury`,severity:severe?'HEAVY':'LIGHT',acquiredRevision:input.revision,treatedRevision:null});b.injuryRisk+=severe?2:1;
        next.rescueInjuries.push(`${input.eventId}:${next.willingRescuerId}:strain`);
      }
    }
    if(next.supportExpiresTurn!==null&&next.turns>=next.supportExpiresTurn)next.supportActive=false;
    if(next.guidanceExpiresTurn!==null&&next.turns>=next.guidanceExpiresTurn)next.guidanceActive=false;
    if(next.turns>=4&&next.status==='ACTIVE')next.status='WITHDRAWN';
    if(b.health===0||b.mind===0||b.pollution>=100){b.status='DEAD';b.health=0;next.status='WITHDRAWN';}
  }
  if(next.status!=='ACTIVE'){next.supportActive=false;next.guidanceActive=false;}
  next.journal.push({eventId:input.eventId,week:b.week,command:structuredClone(c),check:structuredClone(input.check),summary});
  return next;
}
