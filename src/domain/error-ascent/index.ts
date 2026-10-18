import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import type { ErrorAscentCommand, ErrorAscentProjection, ErrorAscentState } from './types.js';
import {
  createErrorAscentState, startErrorAscent, sameErrorAscent, errorAscentDigest,
  validateErrorAscentCommand, openErrorAscentOwnedEngine, snapshotErrorAscentOwnedEngine,
  advanceErrorAscentOwnedEngine, blockErrorAscentOwnedEngine,
  getErrorAscentPromotionStabilityPreview, getErrorAscentEpilogueCheckPreview,
  errorAscentHost, errorAscentRitualHost, type ErrorAscentOwnedEngine,
} from './engine.js';
import {
  errorAscentBudget, errorAscentHistoryDigest, errorAscentAcquisitionSnapshot,
  errorAscentSourceBlock, validateErrorAscentSource,
} from './source.js';
import {
  ERROR_ASCENT_ABILITIES, ERROR_ASCENT_STORY, ERROR_ASCENT_GOAL, ERROR_ASCENT_RISK,
  ERROR_ASCENT_CITY_PLACES, ERROR_ASCENT_HOME, ERROR_ASCENT_GUIDANCE,
  ERROR_ASCENT_SPIRITUALITY_CAP, ERROR_ASCENT_SUPPLIER, ERROR_ASCENT_WORKSHOP, ERROR_ASCENT_ARCHIVE, ERROR_ASCENT_VAULT,
} from './content.js';
import { getErrorRitualActions, projectErrorRitual } from './ritual.js';
import { projectErrorAscentEpilogue, getErrorAscentEpilogueActions } from './epilogue.js';
import { getErrorAscentMaterialActions, projectErrorAscentMaterials, errorAscentMaterialEffect } from './materials.js';
import { ERROR_ASCENT_MATERIAL_POLICY, ERROR_ASCENT_FUTURE_BRANCH, errorAscentSuccessionAt } from './material-content.js';
import { ERROR_ASCENT_LABOUR_IDS, type ErrorAscentMaterialCommand } from './types.js';
import { TIME_WORM_ABILITIES, TIME_WORM_INHERITED_ABILITIES } from '../time-worm/content.js';
import { ERROR_ASCENT_GATE } from './content.js';

export { createErrorAscentState, validateErrorAscentCommand } from './engine.js';
export { errorAscentSourceView } from './source.js';
export type { ErrorAscentOwnedEngine } from './engine.js';
export type { ErrorAscentCommand, ErrorAscentState, ErrorAscentProjection } from './types.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Raw entries are replayed before this check. Owned entries use a private
 * branded engine, but still cannot publish into a changed host state. */
function assertCurrent(s: SliceState, root: ErrorAscentState): void {
  const source = root.source, frame = root.frame;
  if (!source || !frame || s.progression.pathwayId !== 'error' ||
      !sameErrorAscent(errorAscentBudget(s), frame.budget) || !sameErrorAscent(s.random, frame.random))
    throw Error('当前身体、资源与实际行动记录不一致。');
  if (s.revision !== source.revision + 1 + root.journal.length)
    throw Error('当前实际行动次序不一致。');
  const { coreStats: _current, ...identity } = s.character;
  const { coreStats: _source, ...originalIdentity } = source.character;
  if (!sameErrorAscent(identity, originalIdentity) || Object.entries(frame.finance)
      .some(([key, value]) => !sameErrorAscent(s[key as keyof SliceState], value)))
    throw Error('当前身份或实际生活账本不一致。');
  if (source.historyDigest !== errorAscentHistoryDigest(s) ||
      source.originalWorldDigest !== errorAscentDigest(s.world) ||
      s.combatHistory.length !== source.combatHistoryLength ||
      source.combatHistoryDigest !== errorAscentDigest(s.combatHistory) ||
      !sameErrorAscent(source.acquisition, errorAscentAcquisitionSnapshot(s)))
    throw Error('旧人物、原物或原瓶履历被改写。');
  if (s.combat !== null || s.activeEvent !== null || s.eventQueue.length || s.pulse !== 'NONE')
    throw Error('本章不能同时开启旧现场。');
  if ((frame.budget.sequence === 0) !== (root.promotionWeek !== null))
    throw Error('当前晋升与实际服药记录不一致。');
}

function guidanceBlock(s: SliceState): string | null {
  if (!sameErrorAscent(s.errorAscent, createErrorAscentState()))
    return '已有本章记录，不能重新开始或补发原物。';
  const reason = errorAscentSourceBlock(s);
  if (reason) return reason;
  return s.actionsRemaining < ERROR_ASCENT_GUIDANCE.actions || s.cash < ERROR_ASCENT_GUIDANCE.cash
    ? '指导需要1行动与100便士，可先按原生活工作与休养。' : null;
}
function publicReason(reason: string | null): string | null {
  if (reason === null) return null;
  return /[\u3400-\u9fff]/.test(reason) && !/[A-Z_]{6,}|seed|cursor|digest|receipt/i.test(reason)
    ? reason : '当前原件、实际所在地或前一步条件尚不满足。';
}
export function validateErrorAscentState(s: SliceState): boolean {
  try {
    if (sameErrorAscent(s.errorAscent, createErrorAscentState()))
      return s.progression.pathwayId !== 'error' || s.progression.sequence !== 0;
    const head = openErrorAscentOwnedEngine(s);
    assertCurrent(s, snapshotErrorAscentOwnedEngine(head));
    return true;
  } catch { return false; }
}
export function hasErrorAscentHistory(s: SliceState): boolean {
  try {
    return s.errorAscent.guidanceKnown && s.errorAscent.source !== null &&
      s.progression.pathwayId === 'error' && validateErrorAscentSource(s, s.errorAscent.source, 'COLD_REOPEN');
  } catch { return false; }
}
export function hasErrorAscentLock(s: SliceState): boolean { return hasErrorAscentHistory(s); }
export function openErrorAscentOwnedHead(s: SliceState): ErrorAscentOwnedEngine {
  const head = openErrorAscentOwnedEngine(s);
  assertCurrent(s, snapshotErrorAscentOwnedEngine(head));
  return head;
}
export function assertOwnedErrorAscentCurrent(s: SliceState, head: ErrorAscentOwnedEngine): void {
  const root = snapshotErrorAscentOwnedEngine(head);
  if (!sameErrorAscent(root, s.errorAscent)) throw Error('当前会话与实际存档版本不一致。');
  assertCurrent(s, root);
}
export function errorAscentCommandBlock(s: SliceState, command: ErrorAscentCommand): string | null {
  if (!validateErrorAscentCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return guidanceBlock(s);
  try { return publicReason(blockErrorAscentOwnedEngine(openErrorAscentOwnedHead(s), command, s.revision + 1)); }
  catch { return '当前记录未通过核验，不能继续行动。'; }
}
export function ownedErrorAscentCommandBlock(s: SliceState, command: ErrorAscentCommand, head: ErrorAscentOwnedEngine): string | null {
  if (!validateErrorAscentCommand(command)) return '这项行动的内容无效。';
  if (s.status !== 'ACTIVE') return '已经死亡或结束的角色不能继续行动。';
  if (command.type === 'LEARN_GUIDANCE') return '已有本章记录，不能重新开始或补发原物。';
  try {
    assertOwnedErrorAscentCurrent(s, head);
    return publicReason(blockErrorAscentOwnedEngine(head, command, s.revision + 1));
  } catch { return '当前记录未通过核验，不能继续行动。'; }
}

function publish(s: SliceState, command: ErrorAscentCommand, root: ErrorAscentState, ctx: SeerContext): void {
  const b = root.frame!.budget;
  s.errorAscent = clone(root);
  s.week = b.week; s.date = clone(b.date); s.actionsRemaining = b.actions;
  s.cash = b.cash; s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = clone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting;
  s.progression.mastery = { ...b.mastery }; s.character.coreStats = { ...b.coreStats };
  s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...root.frame!.random }; Object.assign(s, clone(root.frame!.finance));
  const event = command.type === 'LEARN_GUIDANCE' ? null : root.journal.at(-1)!;
  s.lastCheck = event?.randomReceipts.length ? clone(event.randomReceipts.at(-1)!.check) : null;
  if (!event) ctx.note('错误晋升与钟塔调查指导', '已支付100便士与1行动核对本人三份时之虫原特性与旧账。钟塔有一场独立候选者真正的成神仪式，先查明其准备、实际通路与一次性时机，再决定是否替位。');
  else {
    for (const receipt of event.financeReceipts) ctx.note(receipt.title, receipt.text);
    ctx.note(b.sequence === 0 ? '错误当前行动' : '钟塔筹备当前行动', event.notes.join(''));
  }
}
export function applyErrorAscentCommand(s: SliceState, command: ErrorAscentCommand, ctx: SeerContext): void {
  if (!validateErrorAscentCommand(command) || s.status !== 'ACTIVE') throw Error('当前不能执行这项行动。');
  let root: ErrorAscentState;
  if (command.type === 'LEARN_GUIDANCE') {
    const reason = guidanceBlock(s); if (reason) throw Error(reason);
    root = startErrorAscent(s);
  } else root = snapshotErrorAscentOwnedEngine(advanceErrorAscentOwnedEngine(openErrorAscentOwnedHead(s), command, s.revision + 1));
  publish(s, command, root, ctx);
}
export function applyOwnedErrorAscentCommand(s: SliceState, command: ErrorAscentCommand, ctx: SeerContext, head: ErrorAscentOwnedEngine): ErrorAscentOwnedEngine {
  assertOwnedErrorAscentCurrent(s, head);
  if (!validateErrorAscentCommand(command) || command.type === 'LEARN_GUIDANCE' || s.status !== 'ACTIVE')
    throw Error('当前不能执行这项行动。');
  const next = advanceErrorAscentOwnedEngine(head, command, s.revision + 1);
  publish(s, command, snapshotErrorAscentOwnedEngine(next), ctx);
  return next;
}
export function projectErrorAscent(s: SliceState): ErrorAscentProjection {
  return projection(s, sameErrorAscent(s.errorAscent, createErrorAscentState()) ? null : openErrorAscentOwnedHead(s));
}
export function projectOwnedErrorAscent(s: SliceState, head: ErrorAscentOwnedEngine): ErrorAscentProjection {
  assertOwnedErrorAscentCurrent(s, head);
  return projection(s, head);
}

const safetyTypes = new Set(['RETREAT', 'STOP_EFFECTS', 'WITHDRAW', 'RETURN_ON_FOOT']);
function nextIncome(root: ErrorAscentState): ErrorAscentCommand {
  const f = root.frame!, b = f.budget;
  if (b.actions > 0 && f.finance.wagePaidWeek !== b.week) return { type: 'WORK' };
  return { type: 'NEXT_WEEK' };
}
/** Advice selects an intent; the private engine still checks every actual action. */
function desiredCommand(root: ErrorAscentState): ErrorAscentCommand | null {
  const f = root.frame!, b = f.budget, r = root.ritual!, m = root.materials!;
  const revision = root.source!.revision + 2 + root.journal.length;
  const eventId = `R219:${root.source!.runId}:${revision}`;
  const at = (to: string, command: ErrorAscentCommand): ErrorAscentCommand => f.location === to ? command
    : to === ERROR_ASCENT_HOME ? { type: 'RETURN_ON_FOOT' }
      : b.actions > 0 ? { type: 'TRAVEL', to } : nextIncome(root);
  const h = errorAscentHost(root, eventId, revision);
  if (root.epilogue && !root.epilogue.reported) {
    const actions = getErrorAscentEpilogueActions(root.epilogue, { ...h, coreStats: b.coreStats });
    const action = actions.find(a => a.preferredAction && a.enabled)
      ?? actions.find(a => a.enabled && !safetyTypes.has(a.command.type)) ?? actions.find(a => a.enabled);
    return action ? { type: 'EPILOGUE', command: action.command } : null;
  }
  if (r.player.position === 'OUTER_CONTACT') {
    const actions = getErrorRitualActions(r, errorAscentRitualHost(root, eventId, revision));
    const action = actions.find(a => a.command.type === 'REPLACE' && a.enabled)
      ?? actions.find(a => a.command.type === 'WAIT_FOR_CHANT' && a.enabled)
      ?? actions.find(a => a.command.type === 'RETREAT' && a.enabled);
    return action ? { type: 'RITUAL', command: action.command } : null;
  }
  const failed = m.compounds.find(p => p.status === 'FAILED_EXPOSED' || p.status === 'FAILED_SEALED');
  if (failed?.status === 'FAILED_EXPOSED')
    return at(failed.location, { type: 'MATERIAL', command: { type: 'SEAL_REMAINS', compoundId: failed.id } });
  if (b.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null))
    return b.cash < 60 || b.actions < 1 ? nextIncome(root) : at(ERROR_ASCENT_HOME, { type: 'CLINIC' });
  const preparedForAttempt = root.promotionStability.preparations.some(p => p.status === 'READY' && p.expiresSecond >= f.nowSecond + 4);
  if (b.injuries.length || b.health < 80 || b.mind < (b.sequence === 0 ? 40 : preparedForAttempt ? 70 : 86) || b.spirituality < (b.sequence === 0 ? 26 : preparedForAttempt ? 30 : 42))
    return b.actions < 1 ? nextIncome(root) : { type: 'REST' };
  if (b.sequence === 0) {
    if (root.epilogue?.reported) return f.location === ERROR_ASCENT_HOME ? null : { type: 'RETURN_ON_FOOT' };
    if (b.actions < (f.location === ERROR_ASCENT_GATE ? 2 : 3)) return nextIncome(root);
    return at(ERROR_ASCENT_GATE, { type: 'START_EPILOGUE' });
  }
  if (failed?.status === 'FAILED_SEALED') {
    if (b.week <= (failed.sealedWeek ?? b.week) || b.cash < ERROR_ASCENT_MATERIAL_POLICY.sealedRecoveryFee || b.actions < 1)
      return nextIncome(root);
    return at(failed.location, { type: 'MATERIAL', command: { type: 'RECOVER_SEALED', compoundId: failed.id } });
  }
  if (r.player.outcome !== null || r.phase === 'SETTLED' || r.phase === 'CANCELLED')
    return f.location === ERROR_ASCENT_HOME ? null : { type: 'RETURN_ON_FOOT' };
  if (!r.booking) return at(ERROR_ASCENT_GATE, { type: 'RITUAL', command: { type: 'BRIEF' } });
  if (!r.player.surveyed) return b.actions < 1 ? nextIncome(root)
    : at(ERROR_ASCENT_GATE, { type: 'RITUAL', command: { type: 'SURVEY' } });
  // Keep the paid workday that the fixed appointment's route budget allows.
  // Free labour still uses AP; spending the whole week on it would silently
  // forfeit the wage needed to buy those same originals later.
  const waitingWeeks = Math.max(0, Math.floor((r.booking.consumeAt - f.weekAnchor) / 604800));
  const livingReserve = waitingWeeks * SLICE_LIFE[f.finance.lifeTier].cost
    + f.finance.debts.reduce((sum, debt) => sum + Math.min(debt.remaining, waitingWeeks * debt.weeklyPayment), 0);
  const originalCosts = m.characteristics.reduce((sum, item) => sum +
    (['EMBODIED', 'COMPOUND', 'FUSED'].includes(item.holder) || item.holder === 'PLAYER' && item.acquiredEventId ? 0
      : item.holder === 'SUPPLIER' ? item.recoveredVessel ? 90 : 1100
        : item.holder === 'PLAYER' ? 90 : ERROR_ASCENT_MATERIAL_POLICY.investigateFee + ERROR_ASCENT_MATERIAL_POLICY.legacyRecoveryFee + 90), 0);
  const uniqueCosts = ['UNVERIFIED', 'CUSTODIAN'].includes(m.uniqueness.holder)
    ? ERROR_ASCENT_MATERIAL_POLICY.uniquenessHandoverFee + (m.uniqueness.checks.some(c => c.step === 'CHAIN') ? 0 : ERROR_ASCENT_MATERIAL_POLICY.uniquenessCheckFee) : 0;
  const hasCompound = m.compounds.some(p => p.status === 'PREPARED');
  const carrierCosts = hasCompound ? 0 : ERROR_ASCENT_MATERIAL_POLICY.composeFee
    + (m.batches.some(batch => batch.status === 'PLAYER') ? 0 : ERROR_ASCENT_MATERIAL_POLICY.carrierPrices['error-ascent-carrier-1']);
  const preparationCosts = (preparedForAttempt ? 0 : 150) + (r.player.linePrepared ? 0 : 50);
  if (f.finance.wagePaidWeek !== b.week && b.actions > 0 && b.cash < originalCosts + uniqueCosts + carrierCosts + preparationCosts + livingReserve)
    return { type: 'WORK' };
  const item = m.characteristics.find(i => !['EMBODIED', 'COMPOUND', 'FUSED'].includes(i.holder)
    && (i.holder !== 'PLAYER' || !i.acquiredEventId));
  if (item) {
    let command: ErrorAscentMaterialCommand;
    if (item.holder === 'SUPPLIER') {
      const taskId = ERROR_ASCENT_LABOUR_IDS[item.inheritedLabourSteps + item.labour.length];
      command = taskId ? { type: 'MATERIAL_LABOUR', bottleId: item.originBottleId, taskId }
        : { type: 'ACQUIRE_CHARACTERISTIC', bottleId: item.originBottleId };
    } else {
      const site = m.legacySites.find(x => x.originalBottleId === item.originBottleId);
      command = { type: item.holder === 'PLAYER' ? 'ACQUIRE_CHARACTERISTIC'
        : site && (site.permissionWeek !== b.week || site.investigation !== 'ALLOW' || site.handover !== 'ALLOW') ? 'ASK_LEGACY_PERMISSION'
          : item.holder === 'UNLOCATED' ? 'INVESTIGATE_LEGACY_REMAINS'
            : item.holder === 'LOCATED' ? 'SEAL_LEGACY_REMAINS' : 'RECOVER_LEGACY_REMAINS', bottleId: item.originBottleId };
      if (command.type === 'RECOVER_LEGACY_REMAINS' && m.legacyRemains.some(x => x.originalBottleId === item.originBottleId && x.sealedWeek === b.week))
        return nextIncome(root);
    }
    const cost = errorAscentMaterialEffect(m, command, ERROR_ASCENT_MATERIAL_POLICY);
    if (b.cash < cost.cashCost || b.actions < cost.actions) return nextIncome(root);
    const place = item.holder === 'PLAYER' ? item.location! : item.holder === 'SUPPLIER' ? ERROR_ASCENT_SUPPLIER : ERROR_ASCENT_MATERIAL_POLICY.legacyLocation;
    return at(place, { type: 'MATERIAL', command });
  }
  if (['UNVERIFIED', 'CUSTODIAN'].includes(m.uniqueness.holder)) {
    if (!m.uniqueness.checks.some(c => c.step === 'CHAIN')) {
      if (b.cash < ERROR_ASCENT_MATERIAL_POLICY.uniquenessCheckFee || b.actions < 1) return nextIncome(root);
      return at(ERROR_ASCENT_ARCHIVE, { type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'CHAIN' } });
    }
    if (b.cash < ERROR_ASCENT_MATERIAL_POLICY.uniquenessHandoverFee || b.actions < 1) return nextIncome(root);
    if (!m.uniqueness.checks.some(c => c.step === 'VACANCY' && c.week === b.week)) {
      if (f.location === ERROR_ASCENT_VAULT && b.actions < 2) return nextIncome(root);
      return at(ERROR_ASCENT_VAULT, { type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step: 'VACANCY' } });
    }
    return at(ERROR_ASCENT_VAULT, { type: 'MATERIAL', command: { type: 'ACQUIRE_UNIQUENESS' } });
  }
  const compound = m.compounds.find(p => p.status === 'PREPARED');
  if (compound) {
    const preview = getErrorAscentPromotionStabilityPreview(root, compound.id);
    if (!preview.prepared) {
      const waitingWeeks = Math.max(0, Math.floor((r.booking.consumeAt - 86400 - f.weekAnchor) / 604800));
      const waitingBills = waitingWeeks * SLICE_LIFE[f.finance.lifeTier].cost
        + f.finance.debts.reduce((sum, debt) => sum + Math.min(debt.remaining, waitingWeeks * debt.weeklyPayment), 0);
      if (b.cash < 150 + (r.player.linePrepared ? 0 : 50) + waitingBills) return nextIncome(root);
      if (f.location !== ERROR_ASCENT_WORKSHOP) return at(ERROR_ASCENT_WORKSHOP, { type: 'WAIT_FOR_PREPARATION' });
      if (r.booking.consumeAt - f.nowSecond > 86400) return { type: 'WAIT_FOR_PREPARATION' };
      return b.actions < 1 ? nextIncome(root) : { type: 'STABILIZE_PROMOTION', compoundId: compound.id };
    }
    if (!r.player.linePrepared) return b.actions < 1 ? nextIncome(root)
      : at(ERROR_ASCENT_GATE, { type: 'RITUAL', command: { type: 'PREPARE_LINE' } });
    return at(ERROR_ASCENT_GATE, { type: 'RITUAL', command: { type: 'ENTER' } });
  }
  const held = m.batches.find(x => x.status === 'PLAYER');
  if (held) return b.cash < ERROR_ASCENT_MATERIAL_POLICY.composeFee || b.actions < 1 ? nextIncome(root)
    : at(ERROR_ASCENT_WORKSHOP, { type: 'MATERIAL', command: { type: 'COMPOSE_POTION', batchId: held.id } });
  const supplier = m.batches.find(x => x.status === 'SUPPLIER');
  if (supplier) return b.cash < ERROR_ASCENT_MATERIAL_POLICY.carrierPrices[supplier.id] ? nextIncome(root)
    : at(ERROR_ASCENT_SUPPLIER, { type: 'MATERIAL', command: { type: 'BUY_COMPOUND', batchId: supplier.id } });
  return null;
}
function projection(s: SliceState, head: ErrorAscentOwnedEngine | null): ErrorAscentProjection {
  const root = head ? snapshotErrorAscentOwnedEngine(head) : s.errorAscent;
  const f = root.frame, b = f?.budget ?? errorAscentBudget(s);
  const promoted = s.progression.pathwayId === 'error' && b.sequence === 0 && root.promotionWeek !== null;
  const definitions = s.progression.pathwayId === 'error'
    ? [...TIME_WORM_INHERITED_ABILITIES, ...TIME_WORM_ABILITIES, ...(promoted ? ERROR_ASCENT_ABILITIES : [])] : [];
  const result: ErrorAscentProjection = {
    title: promoted ? '错误 · 钟塔余波' : '错误晋升 · 潮汐钟塔', guidanceKnown: root.guidanceKnown, promoted,
    story: ERROR_ASCENT_STORY, nextStep: ERROR_ASCENT_GOAL, risk: ERROR_ASCENT_RISK,
    resources: { health: b.health, maxHealth: 100, mind: b.mind, maxMind: 100, spirituality: b.spirituality,
      maxSpirituality: promoted ? ERROR_ASCENT_SPIRITUALITY_CAP : 120, cash: `${b.cash}便士`, actionsRemaining: b.actions,
      weeklyBudget: f?.finance.weeklyBudget ?? s.weeklyBudget },
    injuries: b.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })), injuryRisk: b.injuryRisk,
    abilities: definitions.filter(a => Object.hasOwn(b.mastery, a.id)).map(a => ({ id: a.id, label: a.label,
      description: a.description, mastery: b.mastery[a.id] ?? 0 })), actions: [], sections: [],
    insideCase: root.ritual?.player.position === 'OUTER_CONTACT' || !!root.epilogue && !root.epilogue.reported,
  };
  const add = (command: ErrorAscentCommand, label: string, cost: string) => {
    const reason = publicReason(head ? blockErrorAscentOwnedEngine(head, command, s.revision + 1) : errorAscentCommandBlock(s, command));
    result.actions.push({ id: `error-ascent:${result.actions.length}:${command.type}`, label, cost,
      command: clone(command), enabled: reason === null, reason });
  };
  if (!root.guidanceKnown) {
    add({ type: 'LEARN_GUIDANCE' }, '听取错误晋升与钟塔调查指导', '1行动、100便士');
    if (result.actions[0]!.enabled) result.actions[0]!.preferredAction = true;
    else result.nextStep = result.actions[0]!.reason ?? ERROR_ASCENT_GOAL;
    return result;
  }
  const current = f!, ritual = root.ritual!, revision = s.revision + 1, eventId = `R219:${root.source!.runId}:${revision}`;
  const h = errorAscentHost(root, eventId, revision);
  const rh = errorAscentRitualHost(root, eventId, revision);
  const placeName = (id: string) => ERROR_ASCENT_CITY_PLACES.find(p => p.id === id)?.title
    ?? (id === root.source!.actorId ? '本人身上' : id === root.epilogue?.location ? '钟塔出口外廊' : '原封存地点');
  const publicLine = (line: string): string => {
    let text = line;
    for (const place of ERROR_ASCENT_CITY_PLACES) text = text.replaceAll(place.id, place.title);
    for (let i = 1; i <= 3; i++) text = text.replaceAll(`time-worm-potion-${i}`, `第${i}份原时之虫`);
    return text.replaceAll('ER219-ERROR-UNIQUE', '同一错误唯一性').replaceAll(root.source!.actorId, '本人')
      .replace(/世界第\d+秒开始饮用/g, '在约定时刻开始饮用');
  };
  const dateText = (date: typeof h.date) => `${date.year}年${date.month}月${date.day}日`;
  const hour = Math.floor(current.nowSecond % 86400 / 3600), minute = Math.floor(current.nowSecond % 3600 / 60);
  result.sections.push({ id: 'clock', title: '当前地点与日程', lines: [
    `${placeName(current.location)}，${dateText(h.date)} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}，第${b.week}周。`,
    `距下一周结算还有${Math.max(0, Math.ceil((current.weekAnchor + 604800 - current.nowSecond) / 3600))}小时。生活费与约定还款照常结算，工资须工作后领取。`,
  ] });
  const rv = projectErrorRitual(ritual, rh);
  const outcome: Record<string, string> = { ASCENDED: '完成晋升', FAILED_ALIVE: '失败但仍存活', DEAD: '已经死亡',
    WITHDRAWN: '本人已经退出', MISSED: '已错过这次时机', DISPLACED_ALIVE: '被替位后仍存活', DISPLACED_DEAD: '被替位后死亡', INELIGIBLE: '本次晋升条件已失效' };
  result.sections.push({ id: 'ritual', title: '钟塔这一场仪式', lines: [
    ritual.booking ? `候选人定于${dateText(ritual.booking.date)}饮用。${ritual.booking.consumeAt > current.nowSecond
      ? `还有约${Math.ceil((ritual.booking.consumeAt - current.nowSecond) / 3600)}小时。` : '约定时刻已经到来或过去。'}这次日程不会因离场、失败或等待而重订。`
      : '尚未听取唯一一次集会安排。先核对身体与现款，再到钟塔查明日程和路线。',
    `本人在${rv.position}。${ritual.player.surveyed ? '原线路与普通退路已经亲自走查。' : '原线路与退路尚待亲自走查。'}${ritual.player.linePrepared ? '普通外接线已准备。' : '外接线尚未准备。'}`,
    ritual.consumedAt !== null ? `候选人饮用后已过去${Math.max(0, current.nowSecond - ritual.consumedAt)}秒；替位须在第18至30秒间完整完成四秒动作。` : '须在候选人真正饮用后的短暂窗口内施作；提前进入不等于已经完成替位。',
    ...(rv.chance !== null ? [`此刻替位成功率${rv.chance}%；费用与失败伤害仍按当前实际身体承担。`] : []),
    ...(rv.result ? [`本人结果：${outcome[rv.result] ?? '按现场结算保留'}。`] : []),
    ...(rv.candidateResult ? [`伊德里克的结果：${outcome[rv.candidateResult] ?? '按现场结算保留'}。`] : []),
    rv.warning,
  ] });
  result.sections.push({ id: 'materials', ...projectErrorAscentMaterials(root.materials!),
    lines: projectErrorAscentMaterials(root.materials!).lines.map(publicLine) });
  result.sections.push({ id: 'body', title: '身体与旧经历', lines: [
    `${s.character.name}，${s.character.age}岁；污染${b.pollution}，意志${b.coreStats.will}。原伤势与全部旧掌握按已有结果保留。`,
    '旧登记室的人物、原包、寄生许可、已结束的联系与借用物仍留在各自原处，不会随本次调查重置或自动带来。',
    '重伤先付60便士与1行动处置，再实际休养。晋升后的两项新能力从零开始，只有实际应用才增长掌握。',
  ] });
  result.sections.push({ id: 'finance', title: '现款与生活', lines: [
    `现款${b.cash}便士；原职业每周工资${root.source!.character.weeklyWage}便士，本周${current.finance.wagePaidWeek === b.week ? '已经领取' : '尚未工作领取'}。`,
    `未还本金${current.finance.debts.reduce((sum, d) => sum + d.remaining, 0)}便士，下次约定还款${current.finance.debts.reduce((sum, d) => sum + Math.min(d.remaining, d.weeklyPayment), 0)}便士。`,
    '等候不会自动发工资或治疗；跨周仍须支付生活费与旧债。原载体劳动按同一份原件继续，先做完可减少交接费用。',
  ] });
  if (errorAscentSuccessionAt(h.date)) result.sections.push({ id: 'custody', title: '唯一性的保管来历', lines: [
    `档案记载前任于1351年12月10日死亡，同一唯一性次日转交${ERROR_ASCENT_FUTURE_BRANCH.custodianName}保管。须本人核对档案、当前空位与原物，再当面付费交接。`,
    '伊德里克的雷神原件与暴君唯一性属于另一条保管链，不是本人的成药材料。',
  ] });
  const latest = root.journal.at(-1);
  result.sections.push({ id: 'recent-action', title: '刚才发生了什么', lines: latest ? [
    ...latest.notes.map(publicLine), ...latest.financeReceipts.map(x => publicLine(x.text)),
    ...latest.randomReceipts.map(x => `本次检定成功率${x.check.chance}%，实际掷出${x.check.roll}，${{ GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '大失败' }[x.check.tier]}。`),
    `现款${latest.before.budget.cash}→${latest.after.budget.cash}便士，行动${latest.before.budget.actions}→${latest.after.budget.actions}，健康${latest.before.budget.health}→${latest.after.budget.health}，精神${latest.before.budget.mind}→${latest.after.budget.mind}，灵性${latest.before.budget.spirituality}→${latest.after.budget.spirituality}。`,
  ] : ['已支付100便士与1行动听取指导。接下来可先工作、治疗，再沿普通道路调查钟塔。'] });
  if (root.epilogue) {
    const ep = projectErrorAscentEpilogue(root.epilogue);
    result.story = ep.story; result.nextStep = ep.nextStep;
    result.sections.unshift({ id: 'epilogue', title: '钟塔外廊的追兵与出口', lines: ep.lines });
    if (!root.epilogue.reported)
      for (const a of getErrorAscentEpilogueActions(root.epilogue, { ...h, coreStats: b.coreStats })) add({ type: 'EPILOGUE', command: a.command }, a.label, a.cost);
    const theft = getErrorAscentEpilogueCheckPreview(root, 'STEAL_MOVEMENT');
    const release = getErrorAscentEpilogueCheckPreview(root, 'DIVERT_RELEASE');
    result.sections.push({ id: 'epilogue-readiness', title: '有限尝试与普通退路', lines: [
      `当前短时窃取成功率${theft?.chance ?? '待现场核对'}%，释放转移成功率${release?.chance ?? '待现场核对'}%。各只尝试一次，失败照付，成功后仍须实际利用效果。`,
      '可停止效果或沿普通侧阶退出，不依赖施术成功，也不要求额外行动与现款。',
    ] });
  }
  if (!promoted || ritual.player.position === 'OUTER_CONTACT')
    for (const a of getErrorRitualActions(ritual, rh)) add({ type: 'RITUAL', command: a.command }, a.label, a.cost);
  if (!promoted) {
    for (const a of getErrorAscentMaterialActions(root.materials!, ERROR_ASCENT_MATERIAL_POLICY)) add({ type: 'MATERIAL', command: a.command }, a.label, a.cost);
    for (const compound of root.materials!.compounds.filter(p => p.status === 'PREPARED')) {
      const preview = getErrorAscentPromotionStabilityPreview(root, compound.id);
      result.sections.push({ id: 'promotion-stability', title: '同一原剂的稳定准备', lines: [
        preview.prepared ? '当前这份付费准备仍有效。请携原剂前往钟塔，准备外线并亲自进入。'
          : '稳定准备只保持七天。先备齐费用、治疗与休养，临近约定前一天再付费准备，以免在等候中失效。',
        `准备需150便士、1行动、12灵性与8精神；准备后的当前预估成功率${preview.preparedChance}%，最终仍受候选人、守卫与原线路当时的状况影响。`,
        '准备可随同一原剂携行，过期或实际替位后失效。唯一一次替位会同时消耗自己的原剂、普通载体和这次准备。',
        ...(preview.reason ? [publicReason(preview.reason) ?? ''] : []),
      ] });
      add({ type: 'STABILIZE_PROMOTION', compoundId: compound.id }, '为同一原剂做稳定准备', '1行动、150便士、12灵性、8精神，实际一小时；有效七天');
      if (ritual.booking) add({ type: 'WAIT_FOR_PREPARATION' }, '在调配室等到仪式前一天', '按真实经过的日期结算生活与旧债；不发工资、不治疗、不重订仪式');
    }
  } else if (!root.epilogue) add({ type: 'START_EPILOGUE' }, '查看钟塔出口与追来的守卫', '进入同一次外廊现场，不补身体、行动或物品');
  for (const destination of ERROR_ASCENT_CITY_PLACES) if (destination.id !== current.location)
    add({ type: 'TRAVEL', to: destination.id }, `步行前往${destination.title}`, '1行动、0便士，实际半小时');
  if (current.location !== ERROR_ASCENT_HOME) add({ type: 'RETURN_ON_FOOT' }, '沿普通道路返回接待处', '0行动、0便士，实际两小时；现场的人物与原物照常变化');
  add({ type: 'WORK' }, '做本周的职业工作', `1行动，领取${root.source!.character.weeklyWage}便士，每周一次`);
  add({ type: 'CLINIC' }, '请医师处置当前重伤', '1行动、60便士，随后仍须休养');
  add({ type: 'REST' }, '休养当前身体', '1行动，实际八小时，按当前生活条件恢复');
  add({ type: 'NEXT_WEEK' }, '度过本周余下的时间', '跨周结算生活费与约定还款；不发工资、不恢复身体，仪式日程照常推进');
  const desired = b.status === 'ACTIVE' ? desiredCommand(root) : null;
  const chosen = result.actions.find(a => sameErrorAscent(a.command, desired));
  const safeWeek = !ritual.booking || ritual.phase === 'SETTLED' || ritual.phase === 'CANCELLED'
    || current.weekAnchor + 604800 < ritual.booking.consumeAt;
  let preferred = chosen?.enabled && (chosen.command.type !== 'NEXT_WEEK' || safeWeek) ? chosen : undefined;
  if (chosen && !preferred && !result.insideCase) {
    preferred = result.actions.find(a => a.command.type === 'WORK' && a.enabled)
      ?? (safeWeek ? result.actions.find(a => a.command.type === 'NEXT_WEEK' && a.enabled) : undefined)
      ?? result.actions.find(a => a.command.type === 'RETURN_ON_FOOT' && a.enabled);
  }
  if (preferred) { preferred.preferredAction = true; result.nextStep = `${preferred.label}。${preferred.cost}。`; }
  else if (chosen?.command.type === 'NEXT_WEEK' && !safeWeek) result.nextStep = '下一周会越过本次仪式时刻。当前资源不足时可退出，但不能靠周结重开日程。';
  else if (chosen?.reason) result.nextStep = `${chosen.reason}${ritual.booking ? '这一次仪式仍按原日程继续，请先核对剩余时间。' : ''}`;
  else if (!promoted && (ritual.player.outcome !== null || ritual.phase === 'SETTLED' || ritual.phase === 'CANCELLED'))
    result.nextStep = '这次仪式已经结束。可处理伤势与仍在的残余，然后返回接待处；原人物和结果不会重置。';
  return result;
}
