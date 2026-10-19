import type { PublicCheckResult } from '../../shared/contracts.js';
import type { RedPriestBudget } from './source.js';
import type { CampaignLegionId, CampaignNodeId } from './campaign-content.js';
/** A single bounded aftermath on an existing wartime transport route. The
 * parent dispatches six actual soldiers from its original legion and settles
 * every casualty there. The three patients remain wounded even when evacuated. */
export type RedPriestEpilogueCommand = { type: 'COORDINATE' | 'CONTAIN_FIRE' | 'EVACUATE' | 'WITHDRAW' | 'REPORT' };
export interface RedPriestEpilogueState {
  /** Absent in historical scenes; only the new explicit opening opts in. */
  rulesVersion?: 2;
  id: string; originLegionId: CampaignLegionId; originLocation: CampaignNodeId; detachmentId: string;
  startedWeek: number; startedRevision: number; status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN';
  personnel: 6; killed: number; wounded: number; returned: number; settlementEventId: string | null;
  patients: { id: string; status: 'SHELTERED' | 'EVACUATED' }[];
  fire: number; routeDamage: number; turns: number; coordinated: boolean; coordinationAttempted: boolean;
  flameAttempted: boolean; flameContained: boolean; reported: boolean;
  journal: { eventId: string; week: number; command: RedPriestEpilogueCommand; check: PublicCheckResult | null; summary: string }[];
}
const assert = (v: unknown, message: string): void => { if (!v) throw Error(message); };
export function validateRedPriestEpilogueCommand(v: unknown): v is RedPriestEpilogueCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['COORDINATE', 'CONTAIN_FIRE', 'EVACUATE', 'WITHDRAW', 'REPORT'].includes(String((v as { type?: unknown }).type));
}
export function createRedPriestEpilogue(input: {
  eventId: string; week: number; revision: number; legionId: CampaignLegionId; location: CampaignNodeId; detachmentId: string;
}): RedPriestEpilogueState {
  return { id: `${input.eventId}:transport-fire`, originLegionId: input.legionId, originLocation: input.location,
    detachmentId: input.detachmentId, startedWeek: input.week, startedRevision: input.revision, status: 'ACTIVE',
    personnel: 6, killed: 0, wounded: 0, returned: 0, settlementEventId: null,
    patients: [1,2,3].map(n => ({ id: `${input.legionId}:war-wounded:${n}`, status: 'SHELTERED' })),
    fire: 60, routeDamage: 0, turns: 0, coordinated: false, coordinationAttempted: false,
    flameAttempted: false, flameContained: false, reported: false, journal: [] };
}
export function redPriestEpilogueBlock(s: RedPriestEpilogueState, c: RedPriestEpilogueCommand, b: RedPriestBudget): string | null {
  if (!validateRedPriestEpilogueCommand(c)) return '这项现场行动无效。';
  if (b.status !== 'ACTIVE' || b.sequence !== 0) return '须由仍活着的红祭司本人行动。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先结束现场救援或普通撤离。' : s.reported ? '本次交接已经完成。' : null;
  if (s.status !== 'ACTIVE') return '这宗运输路现场已经结束。';
  if (c.type === 'WITHDRAW') return null;
  if (b.actions < 1) return '现场行动需要一次行动；仍可沿原路普通撤出。';
  if (c.type === 'COORDINATE') return s.coordinationAttempted ? '本次分队协同已实际尝试，不能反复改写结果。' : b.spirituality < 8 || b.mind < 8 ? '协同需要8灵性与8精神。' : null;
  if (c.type === 'CONTAIN_FIRE') return s.flameAttempted ? '这处原火势已经实际施术一次，余下须走普通救援路线。' : b.spirituality < 12 || b.mind < 10 ? '现场控火需要12灵性与10精神。' : null;
  return s.patients.every(p => p.status === 'EVACUATED') ? '原伤员已经全部移往安全站。' : null;
}
export function applyRedPriestEpilogue(s: RedPriestEpilogueState, c: RedPriestEpilogueCommand, b: RedPriestBudget,
  input: { eventId: string; revision: number; check: PublicCheckResult | null }): RedPriestEpilogueState {
  const reason = redPriestEpilogueBlock(s, c, b); if (reason) throw Error(reason);
  const next = structuredClone(s), pass = input.check?.tier === 'SUCCESS' || input.check?.tier === 'GREAT_SUCCESS';
  let summary: string;
  if (c.type === 'REPORT') { next.reported = true; summary = '实际救出人数、未解除的伤势及原分队损失已经交还军团登记。'; }
  else if (c.type === 'WITHDRAW') { next.status = 'WITHDRAWN'; summary = '沿原安全侧线撤出，尚未转运的原伤员留在有遮蔽的原救护站；原火损与伤势保留。'; }
  else {
    assert(input.check !== null, '现场须由真实检定结算。'); b.actions--; next.turns++;
    if (c.type === 'COORDINATE') {
      b.spirituality -= 8; b.mind -= 8; next.coordinationAttempted = true; next.coordinated = pass;
      summary = pass ? '六名原军团成员保持实际队列，建立了这一次短时搬运协同。' : '现场噪声与分队疲劳抵消了这次协同，不能强迫他们无条件行动。';
      b.mastery['hunter.s0.shared-standard'] = Math.min(100, (b.mastery['hunter.s0.shared-standard'] ?? 0) + (pass ? 8 : 3));
    } else if (c.type === 'CONTAIN_FIRE') {
      b.spirituality -= 12; b.mind -= 10; next.flameAttempted = true; next.flameContained = pass;
      if (pass) next.fire = Math.max(0, next.fire - 55);
      summary = pass ? '本人压住眼前原火场的蔓延边界，留出有限搬运时间。' : '原燃料与风压抵抗了控火，火线仍在；本人受到热浪伤害。';
      b.mastery['hunter.s0.bounded-flame'] = Math.min(100, (b.mastery['hunter.s0.bounded-flame'] ?? 0) + (pass ? 8 : 3));
    } else {
      const capacity = pass ? (next.coordinated ? 3 : 2) : 1;
      next.patients.filter(p => p.status === 'SHELTERED').slice(0, capacity).forEach(p => { p.status = 'EVACUATED'; });
      summary = `沿实际运输侧线搬离${capacity}名以内的原伤员；救出者仍保留原伤势。`;
    }
    if (!pass) {
      const severe = input.check?.tier === 'GREAT_FAILURE', loss = severe ? 30 : 12;
      b.health = Math.max(0, b.health - loss); b.mind = Math.max(0, b.mind - (severe ? 12 : 5));
      b.injuries.push({ id: `${input.eventId}:fire-injury`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: input.revision, treatedRevision: null });
      b.injuryRisk += severe ? 2 : 1;
      if (next.killed + next.wounded < next.personnel) { if (severe) next.killed++; else next.wounded++; }
    }
    if (!next.flameContained) { next.fire = Math.min(100, next.fire + 10); next.routeDamage = Math.min(100, next.routeDamage + 12); }
    if (next.patients.every(p => p.status === 'EVACUATED')) next.status = 'RESOLVED';
    else if (next.turns >= 4 || next.killed + next.wounded >= next.personnel) next.status = 'WITHDRAWN';
    if (b.health <= 0 || b.mind <= 0) { b.status = 'DEAD'; b.health = 0; next.status = 'WITHDRAWN'; }
  }
  next.journal.push({ eventId: input.eventId, week: b.week, command: structuredClone(c), check: structuredClone(input.check), summary });
  return next;
}
