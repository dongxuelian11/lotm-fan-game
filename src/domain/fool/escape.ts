import type { PublicCheckResult, PublicCoreStats } from '../../shared/contracts.js';
import { resolveNormalCheck, type NormalCheckInput } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { FOOL_ESCAPE_RULES, type FoolAbilityId } from './content.js';
import type { SliceState } from '../slice/types.js';
import { validateFoolSource, type FoolSource } from './source.js';
import {
  buildFoolEscapeInitial, deriveFoolEscapeHost,
  type FoolEscapeReplayFrame, type FoolEscapeStartFrame,
} from './escape-host.js';

/** One authored accident, not an encounter/event framework. Canon: L243392–421
 * (instinct can counter blindness), L243590–614 (historical-image escape).
 * All distances, costs, +35/-30 and seconds below are this game's balance.
 * Ordinary sequence-0's complete abilities are unknown; this grants only two.
 * Never serialize this private state, receipts or checks to the renderer. */
export const FOOL_ESCAPE_CASE_ID = 'FOOL0-ORIGINAL-VAULT-ACCIDENT' as const;
export const FOOL_ESCAPE_MAX_JOURNAL = 32;
export type FoolEscapePlace = 'DOOR' | 'CORRIDOR' | 'EXIT';
export type FoolEscapeStatus = 'ACTIVE' | 'RESCUED' | 'WITHDRAWN' | 'DEAD';
export type FoolEscapeRole = 'ACTOR' | 'MESSENGER_A' | 'MESSENGER_B' | 'GUARD';
export interface FoolEscapeInjury { id: string; kind: string; healthLoss: number; }
export interface FoolEscapeBody {
  id: string; role: FoolEscapeRole; name: string; age: number; sourceEra: 'CONTEMPORARY';
  health: number; injuries: FoolEscapeInjury[]; place: FoolEscapePlace; walkedMetres: number;
}
export interface FoolEscapeObject {
  id: string; role: 'ORIGINAL_DOOR' | 'SEALED_CRATE' | 'SATCHEL_A' | 'SATCHEL_B' | 'BATON' | 'ACTOR_ITEM';
  holderId: string | null; place: FoolEscapePlace;
}
export interface FoolEscapeInitial {
  version: 1; caseId: typeof FOOL_ESCAPE_CASE_ID; runId: string; actorId: string; originReceiptId: string;
  now: number; conditionId: string; bodies: FoolEscapeBody[]; objects: FoolEscapeObject[];
  /** The two identified adults actually agreed to follow, before this scene. */
  consentReceiptIds: readonly [string, string];
  /** A pre-existing guard intention, independently recorded, not player consent.
   * These condition-triggered actions execute on the next actual main passage. */
  guardIntentReceiptId: string; guardInstinctiveStop: boolean;
}
export interface FoolEscapeBudget { actions: number; spirituality: number; mind: number; health: number; }
export interface FoolEscapeCost { actions: number; spirituality: number; mind: number; }
export type FoolEscapeCommand = { type:
  'OPEN_DOOR' | 'WALK' | 'BYPASS' | 'WAIT' | 'WITHDRAW' |
  'MOMENTARY_BLINDNESS' | 'PRIOR_PLACE' | 'RELEASE_IMAGE' | 'REPORT'; };
export interface FoolEscapeHost {
  id: string; eventId: string; expectedRevision: number; command: FoolEscapeCommand;
  actorId: string; alive: boolean; sequence: 0; now: number;
  budget: FoolEscapeBudget; stats: PublicCoreStats;
  /** Current observed world conditions; exact bytes are checked by the host ledger. */
  environment: { conditionId: string; lineOfSight: boolean };
  /** Created by resolveNormalCheck using the original central RNG stream. The
   * central exact-receipt verifier also checks roll consumption and these refs. */
  check: PublicCheckResult | null; rngBeforeRef: string | null; rngAfterRef: string | null;
}
export interface FoolEscapeAuthority {
  /** Full original identity/health/old-injury/consent/intent snapshot, not ID membership. */
  verifyInitial: (initial: FoolEscapeInitial) => boolean;
  /** Central singleton registry: false after this case was first committed. */
  canStartCase: (runId: string, caseId: string) => boolean;
  /** Full canonical receipt bytes, original RNG and real resource-before snapshot. */
  verifyHost: (host: FoolEscapeHost) => boolean;
}
export interface FoolEscapeScene {
  now: number; status: FoolEscapeStatus; doorOpen: boolean; conditionId: string;
  bodies: FoolEscapeBody[]; objects: FoolEscapeObject[];
  look: 'PENDING' | 'SETTLED'; tracking: 'DORMANT' | 'PENDING' | 'SETTLED';
  instinctiveStopExecuted: boolean; blindAttempted: boolean; imageAttempted: boolean;
  blindness: null | { expiresAt: number; conditionId: string };
  image: null | { place: FoolEscapePlace; observedAt: number; expiresAt: number; conditionId: string };
  observedPlaces: FoolEscapePlace[]; appliedAbilities: FoolAbilityId[]; reported: boolean;
}
export interface FoolEscapeConsequence {
  bodyId: string; injury: FoolEscapeInjury; healthBefore: number; healthAfter: number;
}
export interface FoolEscapeEffect {
  cost: FoolEscapeCost; elapsedSeconds: number; resourcesAfter: FoolEscapeBudget;
  positions: { bodyId: string; place: FoolEscapePlace; walkedMetres: number }[];
  objectPositions: { objectId: string; holderId: string | null; place: FoolEscapePlace }[];
  consequences: FoolEscapeConsequence[]; mastery: { abilityId: FoolAbilityId; amount: 8 }[];
  status: FoolEscapeStatus; rescuedIds: string[]; summary: string;
}
export interface FoolEscapeJournalEntry { revision: number; command: FoolEscapeCommand; host: FoolEscapeHost; effect: FoolEscapeEffect; }
export interface FoolEscapeState { initial: FoolEscapeInitial; revision: number; scene: FoolEscapeScene; journal: FoolEscapeJournalEntry[]; }
export interface FoolEscapeTransition { state: FoolEscapeState; effect: FoolEscapeEffect; }

const BLIND: FoolAbilityId = 'diviner.s0.momentary-blindness';
const IMAGE: FoolAbilityId = 'diviner.s0.prior-place';
const TYPES = ['OPEN_DOOR', 'WALK', 'BYPASS', 'WAIT', 'WITHDRAW', 'MOMENTARY_BLINDNESS', 'PRIOR_PLACE', 'RELEASE_IMAGE', 'REPORT'] as const;
const PLACES: readonly FoolEscapePlace[] = ['DOOR', 'CORRIDOR', 'EXIT'];
const ROLES: readonly FoolEscapeRole[] = ['ACTOR', 'MESSENGER_A', 'MESSENGER_B', 'GUARD'];
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160 && v.trim() === v;
const equal = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const keys = (v: unknown, expected: readonly string[]): boolean => !!v && typeof v === 'object' && !Array.isArray(v) && equal(Object.keys(v).sort(), [...expected].sort());
const body = (s: FoolEscapeScene, role: FoolEscapeRole): FoolEscapeBody => s.bodies.find(b => b.role === role)!;
const actor = (s: FoolEscapeScene): FoolEscapeBody => body(s, 'ACTOR');
const guard = (s: FoolEscapeScene): FoolEscapeBody => body(s, 'GUARD');
const messengers = (s: FoolEscapeScene): FoolEscapeBody[] => s.bodies.filter(b => b.role === 'MESSENGER_A' || b.role === 'MESSENGER_B');
const success = (check: PublicCheckResult | null): boolean => check?.tier === 'SUCCESS' || check?.tier === 'GREAT_SUCCESS';
const zeroCost = (): FoolEscapeCost => ({ actions: 0, spirituality: 0, mind: 0 });

export function validateFoolEscapeCommand(value: unknown): value is FoolEscapeCommand {
  return keys(value, ['type']) && TYPES.includes((value as FoolEscapeCommand).type);
}
function assertInitial(i: FoolEscapeInitial, a: FoolEscapeAuthority): void {
  if (!keys(i, ['version', 'caseId', 'runId', 'actorId', 'originReceiptId', 'now', 'conditionId', 'bodies', 'objects', 'consentReceiptIds', 'guardIntentReceiptId', 'guardInstinctiveStop']) ||
      i.version !== 1 || i.caseId !== FOOL_ESCAPE_CASE_ID || ![i.runId, i.actorId, i.originReceiptId, i.conditionId, i.guardIntentReceiptId].every(id) ||
      !integer(i.now) || typeof i.guardInstinctiveStop !== 'boolean' || !Array.isArray(i.bodies) || i.bodies.length !== 4 ||
      !Array.isArray(i.objects) || i.objects.length < 5 || i.objects.length > 12 || !Array.isArray(i.consentReceiptIds) || i.consentReceiptIds.length !== 2 ||
      !i.consentReceiptIds.every(id) || new Set(i.consentReceiptIds).size !== 2 || !a.verifyInitial(i)) throw new Error('ESCAPE_UNVERIFIED_ORIGIN');
  const allIds: string[] = [];
  for (const b of i.bodies) {
    if (!keys(b, ['id', 'role', 'name', 'age', 'sourceEra', 'health', 'injuries', 'place', 'walkedMetres']) || !id(b.id) || !id(b.name) ||
        !ROLES.includes(b.role) || b.sourceEra !== 'CONTEMPORARY' || !integer(b.age, 19, 10000) || !integer(b.health, 1, 100) || b.walkedMetres !== 0 ||
        b.place !== (b.role === 'GUARD' ? 'CORRIDOR' : 'DOOR') || !Array.isArray(b.injuries) || b.injuries.length > 64 ||
        b.injuries.some(x => !keys(x, ['id', 'kind', 'healthLoss']) || !id(x.id) || !id(x.kind) || !integer(x.healthLoss, 0, 100)) ||
        new Set(b.injuries.map(x => x.id)).size !== b.injuries.length) throw new Error('ESCAPE_ORIGINAL_BODY_INVALID');
    allIds.push(b.id);
  }
  if (ROLES.some(r => i.bodies.filter(b => b.role === r).length !== 1) || i.bodies.find(b => b.role === 'ACTOR')!.id !== i.actorId ||
      i.bodies.find(b => b.role === 'GUARD')!.name !== '维克托') throw new Error('ESCAPE_ORIGINAL_ROLES_INVALID');
  const required = ['ORIGINAL_DOOR', 'SEALED_CRATE', 'SATCHEL_A', 'SATCHEL_B', 'BATON'] as const;
  if (required.some(r => i.objects.filter(o => o.role === r).length !== 1)) throw new Error('ESCAPE_ORIGINAL_OBJECTS_MISSING');
  for (const o of i.objects) {
    const holderRole = o.role === 'SATCHEL_A' ? 'MESSENGER_A' : o.role === 'SATCHEL_B' ? 'MESSENGER_B' : o.role === 'BATON' ? 'GUARD' : o.role === 'ACTOR_ITEM' ? 'ACTOR' : null;
    const expectedHolder = holderRole ? i.bodies.find(b => b.role === holderRole)! : null;
    if (!keys(o, ['id', 'role', 'holderId', 'place']) || !id(o.id) || ![...required, 'ACTOR_ITEM'].includes(o.role) ||
        o.holderId !== (expectedHolder?.id ?? null) || o.place !== (expectedHolder?.place ?? 'DOOR')) throw new Error('ESCAPE_ORIGINAL_OBJECT_INVALID');
    allIds.push(o.id);
  }
  if (new Set(allIds).size !== allIds.length) throw new Error('ESCAPE_DUPLICATE_ORIGINAL_ID');
}
function emptyState(initial: FoolEscapeInitial): FoolEscapeState {
  return { initial: structuredClone(initial), revision: 0, journal: [], scene: {
    now: initial.now, status: 'ACTIVE', doorOpen: false, conditionId: initial.conditionId,
    bodies: structuredClone(initial.bodies), objects: structuredClone(initial.objects), look: 'PENDING', tracking: 'DORMANT',
    instinctiveStopExecuted: false, blindAttempted: false, imageAttempted: false, blindness: null, image: null,
    observedPlaces: ['DOOR'], appliedAbilities: [], reported: false,
  } };
}
export function createFoolEscapeState(initial: FoolEscapeInitial, authority: FoolEscapeAuthority): FoolEscapeState {
  assertInitial(initial, authority);
  if (!authority.canStartCase(initial.runId, initial.caseId)) throw new Error('ESCAPE_CASE_ALREADY_REGISTERED');
  return emptyState(initial);
}
function costFor(c: FoolEscapeCommand): FoolEscapeCost {
  if (c.type === 'MOMENTARY_BLINDNESS') return { actions: 1, spirituality: FOOL_ESCAPE_RULES.blindSpirituality, mind: FOOL_ESCAPE_RULES.blindMind };
  if (c.type === 'PRIOR_PLACE') return { actions: 1, spirituality: FOOL_ESCAPE_RULES.echoSpirituality, mind: FOOL_ESCAPE_RULES.echoMind };
  return { ...zeroCost(), actions: c.type === 'OPEN_DOOR' ? 1 : 0 };
}
function invalidEffect(s: FoolEscapeScene, h: Pick<FoolEscapeHost, 'now' | 'environment'>): void {
  s.now = h.now; s.conditionId = h.environment.conditionId;
  if (s.blindness && (s.now > s.blindness.expiresAt || !h.environment.lineOfSight || s.conditionId !== s.blindness.conditionId || s.look !== 'PENDING' || guard(s).health === 0)) s.blindness = null;
  if (s.image && (s.now > s.image.expiresAt || !h.environment.lineOfSight || s.conditionId !== s.image.conditionId || Math.abs(PLACES.indexOf(actor(s).place) - PLACES.indexOf(s.image.place)) > 1)) s.image = null;
}
function commandReason(s: FoolEscapeState, c: FoolEscapeCommand, budget: FoolEscapeBudget): string | null {
  const q = s.scene;
  if (!validateFoolEscapeCommand(c)) return '撤离命令无效。';
  if (q.reported) return '本次撤离已经报告，不能再次领取掌握。';
  if (q.status === 'DEAD' || actor(q).health <= 0) return '你已经死亡，现场和伤亡保留。';
  if (c.type === 'REPORT') return q.status === 'ACTIVE' ? '先沿出口或退路收束本次撤离。' : null;
  if (q.status !== 'ACTIVE') return '本次任务已经结束，只能报告实际结果。';
  if (s.journal.length >= FOOL_ESCAPE_MAX_JOURNAL - 2 && c.type !== 'WITHDRAW') return '现场不能继续拖延，请沿退路退出。';
  const cost = costFor(c);
  if (budget.actions < cost.actions || budget.spirituality < cost.spirituality || budget.mind < cost.mind) return '当前资源不足；仍可不花行动沿退路退出。';
  if (c.type === 'OPEN_DOOR') return q.doorOpen || actor(q).place !== 'DOOR' ? '原门已经打开，或你不在门边。' : null;
  if (c.type === 'WALK') return actor(q).place === 'DOOR' && !q.doorOpen ? '先普通开门，或走旁边的绕行通道。' : null;
  if (c.type === 'MOMENTARY_BLINDNESS') return q.look !== 'PENDING' || q.blindAttempted || guard(q).health <= 0 ? '这次查看已经落定或已尝试干扰，不能补施法。' : !q.doorOpen || actor(q).place !== 'DOOR' ? '打开原门，亲眼看见维克托准备查看后才能尝试。' : null;
  if (c.type === 'PRIOR_PLACE') return q.imageAttempted || q.tracking !== 'PENDING' || actor(q).place !== 'CORRIDOR' || guard(q).health <= 0 ? '须在通廊亲见原位置，且下一次追踪尚未落定；本次只能尝试一次。' : null;
  if (c.type === 'RELEASE_IMAGE') return q.image ? null : '没有仍在维持的原位影像。';
  return null;
}
/** Private central-controller helper. It does not draw RNG or return future intent
 * through the public projection. Central resolveNormalCheck must use this input. */
export function foolEscapeCheckInput(state: FoolEscapeState, command: FoolEscapeCommand, host: Pick<FoolEscapeHost, 'now' | 'stats' | 'environment'>): NormalCheckInput | null {
  const s = structuredClone(state.scene);
  invalidEffect(s, host);
  if (command.type === 'MOMENTARY_BLINDNESS' || command.type === 'PRIOR_PLACE') return { ability: 'will', baseAbility: host.stats.will, difficulty: 35, modifiers: [] };
  if (command.type !== 'WALK' && command.type !== 'BYPASS') return null;
  const modifiers: { source: string; value: number }[] = [];
  // The prepared physical stop still happens; only the unexecuted look is affected.
  const crossingAt = host.now + 2 + (actor(s).place === 'DOOR' && state.initial.guardInstinctiveStop && !s.instinctiveStopExecuted ? 1 : 0);
  if (command.type === 'WALK' && actor(s).place === 'DOOR' && s.blindness && crossingAt <= s.blindness.expiresAt) modifiers.push({ source: '片刻盲愚', value: FOOL_ESCAPE_RULES.aid });
  return { ability: 'perception', baseAbility: host.stats.perception, difficulty: command.type === 'BYPASS' ? 20 : 35, modifiers };
}
function assertHost(state: FoolEscapeState, command: FoolEscapeCommand, h: FoolEscapeHost, a: FoolEscapeAuthority): void {
  if (!keys(h, ['id', 'eventId', 'expectedRevision', 'command', 'actorId', 'alive', 'sequence', 'now', 'budget', 'stats', 'environment', 'check', 'rngBeforeRef', 'rngAfterRef']) ||
      !id(h.id) || !id(h.eventId) || h.actorId !== state.initial.actorId || h.alive !== true || h.sequence !== 0 || h.expectedRevision !== state.revision || !equal(h.command, command) ||
      !integer(h.now, state.scene.now) || !keys(h.budget, ['actions', 'spirituality', 'mind', 'health']) || !Object.values(h.budget).every(v => integer(v)) || h.budget.health !== actor(state.scene).health ||
      !keys(h.stats, ['physique', 'perception', 'will', 'knowledge']) || !Object.values(h.stats).every(v => integer(v, 0, 500)) ||
      !keys(h.environment, ['conditionId', 'lineOfSight']) || !id(h.environment.conditionId) || typeof h.environment.lineOfSight !== 'boolean' ||
      state.journal.some(e => e.host.id === h.id || e.host.eventId === h.eventId) || !a.verifyHost(h)) throw new Error('ESCAPE_UNVERIFIED_HOST');
  const input = foolEscapeCheckInput(state, command, h);
  if (input) {
    if (!h.check || !id(h.rngBeforeRef) || !id(h.rngAfterRef) || h.rngBeforeRef === h.rngAfterRef ||
        !equal(h.check, resolveNormalCheck({ ...input, roll: h.check.roll }))) throw new Error('ESCAPE_NORMAL_CHECK_MISMATCH');
  } else if (h.check !== null || h.rngBeforeRef !== null || h.rngAfterRef !== null) throw new Error('ESCAPE_UNEXPECTED_CHECK');
}
function moveParty(s: FoolEscapeScene, to: FoolEscapePlace, metres: number): void {
  const from = actor(s).place;
  for (const b of s.bodies) if (b.role !== 'GUARD' && b.health > 0 && b.place === from) { b.place = to; b.walkedMetres += metres; }
  if (!s.observedPlaces.includes(to)) s.observedPlaces.push(to);
  syncObjects(s);
}
function syncObjects(s: FoolEscapeScene): void {
  for (const o of s.objects) if (o.holderId) o.place = s.bodies.find(b => b.id === o.holderId)!.place;
}
function injure(s: FoolEscapeScene, target: FoolEscapeBody, damage: number, eventId: string, consequences: FoolEscapeConsequence[]): void {
  if (damage <= 0 || target.health === 0) return;
  const before = target.health, injury: FoolEscapeInjury = { id: `${eventId}:${target.role}`, kind: '撤离时的挤压伤', healthLoss: Math.min(before, damage) };
  if (target.injuries.some(i => i.id === injury.id)) throw new Error('ESCAPE_INJURY_ID_REUSED');
  target.injuries.push(injury); target.health = Math.max(0, before - damage);
  consequences.push({ bodyId: target.id, injury: structuredClone(injury), healthBefore: before, healthAfter: target.health });
  if (target.role === 'ACTOR' && target.health === 0) s.status = 'DEAD';
  if (target.role === 'GUARD' && target.health === 0) { s.look = 'SETTLED'; s.tracking = 'SETTLED'; s.blindness = null; }
}
function markApplied(s: FoolEscapeScene, ability: FoolAbilityId): void { if (!s.appliedAbilities.includes(ability)) s.appliedAbilities.push(ability); }
function reduce(state: FoolEscapeState, command: FoolEscapeCommand, host: FoolEscapeHost, authority: FoolEscapeAuthority): FoolEscapeTransition {
  if (state.journal.length >= FOOL_ESCAPE_MAX_JOURNAL) throw new Error('ESCAPE_JOURNAL_LIMIT');
  assertHost(state, command, host, authority);
  const next = structuredClone(state), s = next.scene, cost = costFor(command), consequences: FoolEscapeConsequence[] = [];
  invalidEffect(s, host);
  const reason = commandReason(next, command, host.budget); if (reason) throw new Error(reason);
  if ((command.type === 'MOMENTARY_BLINDNESS' || command.type === 'PRIOR_PLACE') && !host.environment.lineOfSight) throw new Error('当前遮挡，无法维持眼前原位置或干扰查看。');
  let seconds = 1, summary = '', mastery: FoolEscapeEffect['mastery'] = [];
  switch (command.type) {
    case 'OPEN_DOOR': s.doorOpen = true; seconds = 2; summary = '你亲手推开卡住的原门。两名当代成年信使带着自己的邮袋等待跟随；维克托仍在通廊准备查看。'; break;
    case 'MOMENTARY_BLINDNESS':
      s.blindAttempted = true;
      if (success(host.check)) { s.blindness = { expiresAt: host.now + seconds + FOOL_ESCAPE_RULES.blindSeconds, conditionId: s.conditionId }; summary = '维克托尚未执行的查看受到片刻干扰；他的身体和事先形成的停步动作仍然存在。'; }
      else summary = '维克托抵抗了干扰，准备查看的动作没有被取消。灵性与精神仍已消耗。';
      break;
    case 'PRIOR_PLACE':
      s.imageAttempted = true;
      if (success(host.check)) { s.image = { place: actor(s).place, observedAt: host.now, expiresAt: host.now + seconds + FOOL_ESCAPE_RULES.echoSeconds, conditionId: s.conditionId }; summary = '你维持刚刚亲见的通廊原位影像。你本人、两名信使和各自原物仍在此处，须真实走向出口。'; }
      else summary = '原位影像未能维持。原人原物没有移动，消耗仍然发生。';
      break;
    case 'RELEASE_IMAGE': s.image = null; summary = '你撤回原位影像，身体、伤势和原物位置没有改变。'; break;
    case 'WAIT': summary = '你在原地等了一秒。两名信使和原物仍在实际位置，短暂窗口会照常流逝。'; break;
    case 'WITHDRAW': {
      seconds = actor(s).place === 'DOOR' ? 12 : 8;
      moveParty(s, 'EXIT', seconds); s.status = 'WITHDRAWN'; s.image = null; s.blindness = null;
      summary = '你沿开放的普通退路退出。还活着且在你身旁的信使实际跟随；倒下的人、原门、封箱和维克托保留实际位置与伤势。'; break;
    }
    case 'REPORT':
      s.reported = true; mastery = s.appliedAbilities.map(abilityId => ({ abilityId, amount: 8 }));
      summary = s.status === 'RESCUED' ? '两名原信使已实际抵达出口。你报告本次撤离；只有在真实查看或追踪中起效的技巧获得掌握，结果只记一次。' : '你报告本次撤离的真实救出、伤亡和退出结果。未实际起效的技巧不增长掌握，本案不会重新生成。'; break;
    case 'WALK':
    case 'BYPASS': {
      const from = actor(s).place, throughMain = command.type === 'WALK', first = from === 'DOOR';
      const instinct = first && throughMain && guard(s).health > 0 && state.initial.guardInstinctiveStop && !s.instinctiveStopExecuted;
      seconds = throughMain ? 2 + (instinct ? 1 : 0) : 5;
      if (instinct) s.instinctiveStopExecuted = true;
      if (!throughMain) { s.image = null; s.blindness = null; }
      const blindUsed = throughMain && first && s.look === 'PENDING' && !!s.blindness && host.now + seconds <= s.blindness.expiresAt;
      if (blindUsed) markApplied(s, BLIND);
      if (first) { s.look = 'SETTLED'; s.blindness = null; }
      const tracked = !first && s.tracking === 'PENDING' && guard(s).health > 0;
      const imageUsed = throughMain && tracked && !!s.image && host.now + seconds <= s.image.expiresAt && s.image.place === from;
      if (imageUsed) markApplied(s, IMAGE);
      if (!first) { s.tracking = 'SETTLED'; s.image = null; }
      if (success(host.check)) {
        moveParty(s, first ? 'CORRIDOR' : 'EXIT', throughMain ? 4 : 8);
        if (first) s.tracking = guard(s).health > 0 ? 'PENDING' : 'SETTLED';
        else {
          // The guard really follows down the main passage unless the one image
          // distracted that still-unsettled pursuit. This is not a teleport.
          if (throughMain && tracked && !imageUsed) { guard(s).place = 'EXIT'; guard(s).walkedMetres += 4; }
          s.status = messengers(s).every(b => b.health > 0 && b.place === 'EXIT') ? 'RESCUED' : 'WITHDRAWN';
        }
        summary = first ? '你与仍能跟随的原信使实际进入通廊，邮袋随原主人移动。维克托并未答应放行，仍可能在下一段拦截。' : '你与仍能跟随的原信使实际走到出口；原封箱留在门边，伤势不会因影像消失。';
      } else {
        // Real interception / falling-frame consequences; no invulnerability.
        // A valid image reduces only this next unsettled impact, never old harm.
        const impact = host.check?.tier === 'GREAT_FAILURE' ? 45 : 35;
        const reduced = Math.max(0, impact - (imageUsed ? FOOL_ESCAPE_RULES.mitigation : 0));
        injure(s, actor(s), reduced, host.eventId, consequences);
        for (const b of messengers(s)) if (b.place === from) injure(s, b, Math.ceil(reduced / 2), host.eventId, consequences);
        if (host.check?.tier === 'GREAT_FAILURE' && from === guard(s).place) injure(s, guard(s), 10, host.eventId, consequences);
        summary = '这次通过失败，人员留在原实际位置。门框落物或拦截造成真实挤压伤；可沿退路退出，已经落定的查看、追踪和伤害不能补施法改写。';
      }
      break;
    }
  }
  // Central survival rules treat an actual spell payment exhausting mind as
  // death. Merely taking an ordinary zero-cost retreat at zero mind is not a
  // new payment and is deliberately still allowed by this bounded scene.
  if (cost.mind > 0 && host.budget.mind - cost.mind === 0) {
    actor(s).health = 0; s.status = 'DEAD';
    summary += ' 本次施术耗尽了精神，你已死亡；身体与原物留在当前位置，原伤不被清除。';
  }
  s.now = host.now + seconds;
  if (!integer(s.now)) throw new Error('ESCAPE_TIME_OVERFLOW');
  if (s.blindness && s.now > s.blindness.expiresAt) s.blindness = null;
  if (s.image && (s.now > s.image.expiresAt || Math.abs(PLACES.indexOf(actor(s).place) - PLACES.indexOf(s.image.place)) > 1)) s.image = null;
  if (s.status !== 'ACTIVE') { s.image = null; s.blindness = null; }
  syncObjects(s);
  const effect: FoolEscapeEffect = { cost, elapsedSeconds: s.now - state.scene.now,
    resourcesAfter: { actions: host.budget.actions - cost.actions, spirituality: host.budget.spirituality - cost.spirituality, mind: host.budget.mind - cost.mind, health: actor(s).health },
    positions: s.bodies.map(b => ({ bodyId: b.id, place: b.place, walkedMetres: b.walkedMetres })),
    objectPositions: s.objects.map(o => ({ objectId: o.id, holderId: o.holderId, place: o.place })), consequences, mastery, status: s.status,
    rescuedIds: messengers(s).filter(b => b.health > 0 && b.place === 'EXIT').map(b => b.id), summary };
  next.revision++;
  next.journal.push({ revision: next.revision, command: structuredClone(command), host: structuredClone(host), effect: structuredClone(effect) });
  return { state: next, effect };
}
/** Strict full replay against independent original and exact central receipts.
 * IDs/booleans supplied by a save are not authority. Invalid histories fail closed. */
export function replayFoolEscape(initial: FoolEscapeInitial, journal: readonly FoolEscapeJournalEntry[], authority: FoolEscapeAuthority): FoolEscapeState {
  assertInitial(initial, authority);
  if (!Array.isArray(journal) || journal.length > FOOL_ESCAPE_MAX_JOURNAL) throw new Error('ESCAPE_JOURNAL_LIMIT');
  let state = emptyState(initial);
  for (const entry of journal) {
    if (!keys(entry, ['revision', 'command', 'host', 'effect']) || entry.revision !== state.revision + 1 || !validateFoolEscapeCommand(entry.command)) throw new Error('ESCAPE_JOURNAL_INVALID');
    const next = reduce(state, entry.command, entry.host, authority);
    if (!equal(next.state.journal.at(-1), entry)) throw new Error('ESCAPE_REPLAY_EFFECT_MISMATCH');
    state = next.state;
  }
  return state;
}
export function validateFoolEscapeState(value: unknown, authority: FoolEscapeAuthority): value is FoolEscapeState {
  try {
    if (!keys(value, ['initial', 'revision', 'scene', 'journal'])) return false;
    const state = value as FoolEscapeState;
    return equal(state, replayFoolEscape(state.initial, state.journal, authority));
  } catch { return false; }
}
export function applyFoolEscapeCommand(state: FoolEscapeState, command: FoolEscapeCommand, host: FoolEscapeHost, authority: FoolEscapeAuthority): FoolEscapeTransition {
  if (!validateFoolEscapeState(state, authority)) throw new Error('ESCAPE_STATE_REPLAY_FAILED');
  if (!validateFoolEscapeCommand(command)) throw new Error('ESCAPE_COMMAND_INVALID');
  return reduce(state, command, host, authority);
}

/** An owned original and its real sequential transitions. There is no saved-state,
 * supplied verifier, prepared context or skip-validation entry point. */
export interface FoolEscapeHostReplayCursor {
  snapshot(): FoolEscapeState;
  matches(candidate: unknown): boolean;
  fork(): FoolEscapeHostReplayCursor;
  advance(frame: FoolEscapeReplayFrame): FoolEscapeTransition & { host: FoolEscapeHost };
}
/** Strict minting lives beside the private reducer. The host adapter re-exports
 * this constructor; its original/host derivation helpers never invoke it. */
export function createFoolEscapeReplayCursor(source: FoolSource, archivedS1: SliceState,
  start: FoolEscapeStartFrame): FoolEscapeHostReplayCursor {
  // Detach before verification and retention. No external object or callback can
  // later change the source, original or capability's verification behavior.
  // Reject noncanonical input before structuredClone can normalize prototypes.
  try { stableStringify(source); stableStringify(archivedS1); } catch { throw new Error('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED'); }
  stableStringify(start);
  const original = structuredClone(source), archived = structuredClone(archivedS1), opening = structuredClone(start);
  if (!validateFoolSource(archived, original)) throw new Error('ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  const initial = buildFoolEscapeInitial(original, opening), initialBytes = stableStringify(initial);
  const authority: FoolEscapeAuthority = {
    verifyInitial: candidate => stableStringify(candidate) === initialBytes,
    canStartCase: (runId, caseId) => runId === original.runId && caseId === initial.caseId,
    verifyHost: () => false,
  };
  const current = createFoolEscapeState(initial, authority);
  // Forks may share only this deeply immutable privately cloned source.
  freezeEscapeSource(original);
  return ownFoolEscapeReplayCursor(original, current, opening.revision, original.random.cursor);
}
function freezeEscapeSource(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const nested of Object.values(value)) freezeEscapeSource(nested);
  Object.freeze(value);
}
/** Only strict original construction and an existing owned fork reach here.
 * Commit all closure fields after reducer and detached-result creation succeed. */
function ownFoolEscapeReplayCursor(source: FoolSource, initial: FoolEscapeState,
  initialRevision: number, initialRandomCursor: number): FoolEscapeHostReplayCursor {
  let current = initial, revision = initialRevision, randomCursor = initialRandomCursor;
  return Object.freeze({
    snapshot: (): FoolEscapeState => structuredClone(current),
    matches: (candidate: unknown): boolean => {
      try { return equal(current, candidate); } catch { return false; }
    },
    fork: (): FoolEscapeHostReplayCursor => ownFoolEscapeReplayCursor(source, structuredClone(current), revision, randomCursor),
    advance: (supplied: FoolEscapeReplayFrame): FoolEscapeTransition & { host: FoolEscapeHost } => {
      stableStringify(supplied);
      const frame = structuredClone(supplied);
      if (!integer(frame.revision, revision + 1) || !integer(frame.randomBefore, randomCursor) || !equal(frame.escapeBefore, current)) {
        throw new Error('ESCAPE_AUTHORITY_PREFIX_MISMATCH');
      }
      if (!validateFoolEscapeCommand(frame.command)) throw new Error('ESCAPE_COMMAND_INVALID');
      const host = deriveFoolEscapeHost(source, frame), hostBytes = stableStringify(host);
      const authority: FoolEscapeAuthority = {
        verifyInitial: () => false,
        canStartCase: () => false,
        verifyHost: candidate => stableStringify(candidate) === hostBytes,
      };
      // The real reducer still checks all current command, host, resource,
      // identity, clock, receipt, check, injury and journal-bound requirements.
      // Already-owned history is not reconstructed or accepted from the frame.
      const next = reduce(current, frame.command, host, authority);
      const result = structuredClone({ ...next, host });
      current = next.state; revision = frame.revision; randomCursor = frame.randomAfter;
      return result;
    },
  });
}
export interface FoolEscapeAction { command: FoolEscapeCommand; label: string; cost: string; enabled: boolean; reason: string | null; }
export interface FoolEscapeProjection {
  title: string; story: string; status: FoolEscapeStatus; reported: boolean; now: number;
  bodies: FoolEscapeBody[]; objects: FoolEscapeObject[]; doorOpen: boolean; resources: FoolEscapeBudget;
  actions: FoolEscapeAction[]; facts: string[]; lastSummary: string | null;
}
/** Explicit allowlist: no private checks, RNG refs, journal, future intent,
 * authority receipts or hidden success predictions. Resource needs are truthful. */
export function projectFoolEscape(state: FoolEscapeState, budget: FoolEscapeBudget): FoolEscapeProjection {
  const s = state.scene;
  let candidates: [FoolEscapeCommand['type'], string, string][];
  if (s.status === 'DEAD' || s.reported) candidates = [];
  else if (s.status !== 'ACTIVE') candidates = [['REPORT', '报告实际撤离结果', '0行动；1秒']];
  else {
    candidates = [];
    if (actor(s).place === 'DOOR' && !s.doorOpen) candidates.push(['OPEN_DOOR', '推开原门', '1行动；2秒']);
    else candidates.push(['WALK', actor(s).place === 'DOOR' ? '步行进入通廊' : '步行走向出口', '0行动；2秒，停步时另加1秒']);
    candidates.push(['BYPASS', '走普通绕行通道', '0行动；5秒']);
    if (actor(s).place === 'DOOR' && s.doorOpen && !s.blindAttempted && s.look === 'PENDING') candidates.push(['MOMENTARY_BLINDNESS', '片刻盲愚', '1行动；12灵性、4精神；最多3秒']);
    if (actor(s).place === 'CORRIDOR' && !s.imageAttempted && s.tracking === 'PENDING') candidates.push(['PRIOR_PLACE', '前刻留影', '1行动；12灵性、4精神；最多20秒']);
    if (s.image) candidates.push(['RELEASE_IMAGE', '撤回原位影像', '0行动；1秒']);
    candidates.push(['WAIT', '等一秒', '0行动；1秒'], ['WITHDRAW', '沿开放退路退出', `0行动；${actor(s).place === 'DOOR' ? 12 : 8}秒`]);
  }
  return { title: '封存库的短撤离', story: '封存库落物卡住了原门，两名当代成年信使被困，并已同意跟随你撤离。成年看守维克托正在阻拦未查验的离库人员；他没有同意配合演练。推门、步行、绕行与退路都真实可用，每个人都有受伤和死亡风险。',
    status: s.status, reported: s.reported, now: s.now, bodies: structuredClone(s.bodies), objects: structuredClone(s.objects), doorOpen: s.doorOpen, resources: structuredClone(budget),
    actions: candidates.map(([type, label, cost]) => { const command: FoolEscapeCommand = { type }, reason = commandReason(state, command, budget); return { command, label, cost, enabled: reason === null, reason }; }),
    facts: ['影像不是实体，不会替人或原物走路，也不能复活或改写旧伤。', '查看或追踪一旦落定，不能事后补施法。遮挡、条件改变、离开范围或撤回都会结束影像。', '普通退路不需要行动、灵性或精神；退出仍消耗真实时间，伤亡与原物位置保留。'], lastSummary: state.journal.at(-1)?.effect.summary ?? null };
}
