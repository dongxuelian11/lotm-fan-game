import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { MIRACLE_WORKER_CASE_IDS, hasMiracleWorkerLifeLock } from '../miracle-worker/life.js';
import { hasMiracleWorkerEncounterLock } from '../miracle-worker/encounter.js';
import { isValidGameDate, compareGameDates, gameDaysBetween } from '../game-calendar.js';
import { createReceptionWorkLedger, receptionEconomyBlock, receptionEconomySnapshot, resolveReceptionEconomy,
  type ReceptionEconomyBudget, type ReceptionWorkLedger, type ReceptionEconomyCommand } from '../reception-economy.js';
import { attendantMysteriesSourceDigest, hasAttendantMysteriesTownLock } from './ritual.js';
import { hasAttendantMysteriesLifeLock } from './life.js';
import { hasAttendantMysteriesEncounterLock } from './encounter.js';

export type AttendantMysteriesReceptionCommand = { type: 'RECEPTION_WORK' | 'RECEPTION_REST' | 'RECEPTION_NEXT_WEEK' };
export interface AttendantMysteriesReceptionOrigin {
  runId: string; revision: number; sourceHistoryDigest: string; oldWork: ReceptionWorkLedger;
}
export interface AttendantMysteriesReceptionEvent {
  command: AttendantMysteriesReceptionCommand; revision: number; sequence: 2 | 1; place: 'RECEPTION'; locksCleared: true;
  before: ReceptionEconomyBudget; after: ReceptionEconomyBudget;
  workBefore: ReceptionWorkLedger; workAfter: ReceptionWorkLedger;
  randomSeed: string; randomBefore: number; randomAfter: number; preservedBefore: string; preservedAfter: string;
}
export interface AttendantMysteriesReceptionState {
  origin: AttendantMysteriesReceptionOrigin | null; work: ReceptionWorkLedger; journal: AttendantMysteriesReceptionEvent[];
}
export interface AttendantMysteriesReceptionAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AttendantMysteriesReceptionCommand;
}
export function createAttendantMysteriesReceptionState(): AttendantMysteriesReceptionState { return { origin: null, work: createReceptionWorkLedger(), journal: [] }; }
const same = (a: unknown, b: unknown) => a === b || a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b);
const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const economyCommand = (c: AttendantMysteriesReceptionCommand): ReceptionEconomyCommand => c.type === 'RECEPTION_WORK' ? 'WORK' : c.type === 'RECEPTION_REST' ? 'REST' : 'NEXT_WEEK';
const completedOriginalReports = (s: SliceState) => s.miracleWorker.life.reflected && s.miracleWorker.life.activeCase === null &&
  MIRACLE_WORKER_CASE_IDS.every(id => s.miracleWorker.life.cases[id].status === 'RESOLVED' && s.seer.completedSources.filter(x => x === `miracle-worker-case:${id}`).length === 1) &&
  s.seer.completedSources.filter(x => x === 'miracle-worker-reflection').length === 1;
const eligible = (s: SliceState) => s.progression.pathwayId === 'diviner' && [2, 1].includes(s.progression.sequence ?? 0) && s.miracleWorker.promotionWeek !== null &&
  (s.attendantMysteries.guidanceKnown || s.progression.sequence === 2 && completedOriginalReports(s));
function effectiveWork(work: ReceptionWorkLedger, old: ReceptionWorkLedger, week: number): ReceptionWorkLedger {
  return { ...structuredClone(work), emergencyUsed: work.emergencyUsed || old.week === week && old.emergencyUsed };
}
function preserved(s: SliceState): string {
  const a = s.attendantMysteries;
  return stableStringify({ progression: s.progression, oldHistory: attendantMysteriesSourceDigest(s),
    preservedDigest: sha256Hex(stableStringify({ character: s.character, status: s.status,
    town: a.town, townJournal: a.townJournal, acquisitionJournal: a.acquisitionJournal, preparation: a.preparation, life: a.life, encounter: a.encounter,
    guidanceKnown: a.guidanceKnown, guidanceWeek: a.guidanceWeek, batches: a.batches, bottles: a.bottles, resupply: a.resupply, promotionWeek: a.promotionWeek,
    miracleWorkerActingAtPromotion: a.miracleWorkerActingAtPromotion, completedSources: s.seer.completedSources,
    combat: s.combat, combatHistory: s.combatHistory, random: s.random, debts: s.debts, credit: s.credit, missedWeeks: s.missedWeeks,
    lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, weeklyBudget: s.weeklyBudget, pulse: s.pulse, billAmount: s.billAmount })) });
}
export function validateAttendantMysteriesReceptionCommand(v: unknown): v is AttendantMysteriesReceptionCommand {
  return shape(v, ['type']) && ['RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK'].includes(String((v as { type: unknown }).type));
}
export const isAttendantMysteriesReceptionCommand = validateAttendantMysteriesReceptionCommand;
export function blockAttendantMysteriesReception(s: SliceState, c: AttendantMysteriesReceptionCommand): string | null {
  if (!validateAttendantMysteriesReceptionCommand(c)) return '接待处命令无效。';
  if (!eligible(s) || s.status !== 'ACTIVE' || s.health <= 0) return '须活着完成奇迹师三案报告与反思，或已经取得诡秘侍者指导。';
  const a = s.attendantMysteries;
  if (s.ancientScholar.ritual.location !== 'RECEPTION' || s.miracleWorker.ritual.location !== 'RECEPTION' || a.town !== null && a.town.operatorAt !== 'base') return '先沿原路回同一当代接待处。';
  if (hasMiracleWorkerLifeLock(s) || hasMiracleWorkerEncounterLock(s)) return '先归还原物、结束原生活现场与争议，再在接待处筹备。';
  if (a.preparation !== null || hasAttendantMysteriesTownLock(s) || hasAttendantMysteriesLifeLock(s) || hasAttendantMysteriesEncounterLock(s)) return '先实际收束城镇控制、生活现场、服药准备或空地争议，再回接待处。';
  if (s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前战斗、事件或未结账目。';
  const old = a.reception.origin?.oldWork ?? s.miracleWorker.ritual.work;
  return receptionEconomyBlock(receptionEconomySnapshot(s), effectiveWork(a.reception.work, old, s.week), economyCommand(c));
}
export const attendantMysteriesReceptionReason = blockAttendantMysteriesReception;
export function applyAttendantMysteriesReception(s: SliceState, c: AttendantMysteriesReceptionCommand, ctx: SeerContext): void {
  const reason = blockAttendantMysteriesReception(s, c); if (reason) throw new Error(reason);
  const r = s.attendantMysteries.reception, before = receptionEconomySnapshot(s), protectedBefore = preserved(s), workBefore = structuredClone(r.work), randomBefore = s.random.cursor;
  r.origin ??= { runId: s.runId, revision: s.revision + 1, sourceHistoryDigest: attendantMysteriesSourceDigest(s), oldWork: structuredClone(s.miracleWorker.ritual.work) };
  const result = resolveReceptionEconomy(before, effectiveWork(r.work, r.origin.oldWork, s.week), economyCommand(c)), after = result.after;
  s.actionsRemaining = after.actions; s.cash = after.cash; s.week = after.week; s.date = after.date; s.health = after.health; s.mind = after.mind; s.spirituality = after.spirituality;
  s.seer.pollution = after.pollution; s.injuries = after.injuries; s.injuryRisk = after.injuryRisk; r.work = result.workAfter;
  r.journal.push({ command: structuredClone(c), revision: s.revision + 1, sequence: s.progression.sequence as 2 | 1, place: 'RECEPTION', locksCleared: true,
    before, after: receptionEconomySnapshot(s), workBefore, workAfter: structuredClone(r.work), randomSeed: s.random.seed, randomBefore, randomAfter: s.random.cursor, preservedBefore: protectedBefore, preservedAfter: preserved(s) });
  if (c.type === 'RECEPTION_WORK') ctx.note('当代接待处实际劳动', `${before.actions > 0 ? '实付1行动' : '使用本周唯一一次低钱应急劳动机会'}整理原机构材料，得到24便士；不调用旧时代工资。`);
  else if (c.type === 'RECEPTION_REST') ctx.note('当代接待处处置休养', '实付1行动和8便士，健康最多恢复5、精神最多恢复8、灵性最多恢复10，排异最多减少10；普通处置同一原伤并把风险归零，受伤历史保留。');
  else ctx.note('在当代实际经过七天', '实付24便士生活费，日期推进7天，取得下一周4次行动；旧城市账目不重开，镇中原人原物仍在原处。');
}
export const applyAttendantMysteriesReceptionCommand = applyAttendantMysteriesReception;
export function attendantMysteriesReceptionActions(s: SliceState): AttendantMysteriesReceptionAction[] {
  if (!eligible(s)) return [];
  return ([['RECEPTION_WORK', '当代接待处普通劳动', '1行动，收入24便士；低钱时每周至多一次应急'], ['RECEPTION_REST', '当代接待处处置休养', '1行动、8便士'], ['RECEPTION_NEXT_WEEK', '在当代实际度过七天', '行动用尽后24便士；下一周4行动']] as const).map(([type, label, cost]) => {
    const command: AttendantMysteriesReceptionCommand = { type }, reason = blockAttendantMysteriesReception(s, command); return { id: `attendantMysteries-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectAttendantMysteriesReception(s: SliceState) {
  const r = s.attendantMysteries.reception;
  return { title: '同一当代接待处', summary: `真实劳动${r.work.works}次，处置休养${r.work.rests}次，经过${r.work.weeks}周；本处累计收入${r.work.income}便士、支出${r.work.expenses}便士。`,
    location: s.attendantMysteries.town?.operatorAt === 'base' || s.attendantMysteries.town === null ? '接待处' : '须先沿原路返回', actions: attendantMysteriesReceptionActions(s),
    facts: ['与原接待处使用同一套当代规则：劳动24便士，处置休养8便士，七天生活费24便士，下一周4行动。',
      '行动用尽且不足24便士时，每周只有一次应急劳动；已经用过的旧接待处同周机会也计入。',
      '城镇与生活现场、空地争议或服药准备未收束时，不能隔空劳动、休养或推进日期。',
      '所有变化使用真实当前现金、健康、精神、灵性及全局日期；原伤、旧工资、旧复起和城镇原人原物记录保留。'] };
}
export type AttendantMysteriesReceptionProjection = ReturnType<typeof projectAttendantMysteriesReception>;
function validWork(w: ReceptionWorkLedger): boolean {
  return shape(w, ['week', 'works', 'rests', 'weeks', 'income', 'expenses', 'emergencyUsed']) && (w.week === null || int(w.week, 1)) && [w.works, w.rests, w.weeks, w.income, w.expenses].every(n => int(n)) &&
    w.income === w.works * 24 && w.expenses === w.rests * 8 + w.weeks * 24 && typeof w.emergencyUsed === 'boolean';
}
function validBudget(b: ReceptionEconomyBudget): boolean {
  return shape(b, ['week', 'date', 'revision', 'actions', 'cash', 'health', 'mind', 'spirituality', 'pollution', 'injuries', 'injuryRisk']) && int(b.week, 1) && isValidGameDate(b.date) && int(b.revision) && int(b.actions, 0, 100) && int(b.cash) &&
    int(b.health, 1, 100) && int(b.mind, 0, 100) && int(b.spirituality, 0, 120) && int(b.pollution, 0, 100) && int(b.injuryRisk) && Array.isArray(b.injuries) && new Set(b.injuries.map(i => i.id)).size === b.injuries.length &&
    b.injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && int(i.acquiredRevision, 0, b.revision + 1) && (i.treatedRevision === null || int(i.treatedRevision, i.acquiredRevision, b.revision + 1)));
}
export function validateAttendantMysteriesReception(s: SliceState): boolean {
  try {
    const r = s.attendantMysteries.reception, initial = createAttendantMysteriesReceptionState();
    if (!shape(r, Object.keys(initial)) || !validWork(r.work) || !Array.isArray(r.journal)) return false;
    if (r.origin === null) return same(r, initial);
    const origin = r.origin;
    if (!shape(origin, ['runId', 'revision', 'sourceHistoryDigest', 'oldWork']) || origin.runId !== s.runId || !int(origin.revision, 1, s.revision) || !validWork(origin.oldWork) || !same(origin.oldWork, s.miracleWorker.ritual.work) ||
      origin.sourceHistoryDigest !== attendantMysteriesSourceDigest(s) ||
      (s.attendantMysteries.guidanceKnown ? origin.sourceHistoryDigest !== s.attendantMysteries.sourceHistoryDigest : s.attendantMysteries.sourceHistoryDigest !== null || !eligible(s)) || r.journal.length === 0) return false;
    let work = createReceptionWorkLedger(), previous: AttendantMysteriesReceptionEvent | null = null;
    for (const entry of r.journal) {
      if (!shape(entry, ['command', 'revision', 'sequence', 'place', 'locksCleared', 'before', 'after', 'workBefore', 'workAfter', 'randomSeed', 'randomBefore', 'randomAfter', 'preservedBefore', 'preservedAfter']) || !validateAttendantMysteriesReceptionCommand(entry.command) ||
        !int(entry.revision, previous ? previous.revision + 1 : origin.revision, s.revision) || !previous && entry.revision !== origin.revision || ![2, 1].includes(entry.sequence) || entry.place !== 'RECEPTION' || entry.locksCleared !== true || !validBudget(entry.before) || !validBudget(entry.after) ||
        entry.before.revision !== entry.revision - 1 || entry.after.revision !== entry.before.revision || !same(entry.workBefore, work) || !validWork(entry.workAfter) || entry.randomSeed !== s.random.seed || !int(entry.randomBefore, previous?.randomAfter ?? 0, s.random.cursor) || entry.randomAfter !== entry.randomBefore || typeof entry.preservedBefore !== 'string' || !entry.preservedBefore || entry.preservedAfter !== entry.preservedBefore ||
        entry.after.week > s.week || compareGameDates(entry.after.date, s.date) > 0) return false;
      const scope = JSON.parse(entry.preservedBefore) as { progression: { pathwayId: string; sequence: number }; oldHistory: string; preservedDigest: string };
      if (!shape(scope, ['progression', 'oldHistory', 'preservedDigest']) || stableStringify(scope) !== entry.preservedBefore || scope.progression.pathwayId !== 'diviner' || scope.progression.sequence !== entry.sequence || scope.oldHistory !== origin.sourceHistoryDigest || typeof scope.preservedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(scope.preservedDigest)) return false;
      if (previous) {
        if (entry.before.week < previous.after.week || gameDaysBetween(previous.after.date, entry.before.date) !== (entry.before.week - previous.after.week) * 7 || previous.sequence === 1 && entry.sequence !== 1) return false;
        if (entry.revision === previous.revision + 1 && (!same(entry.before, { ...previous.after, revision: previous.revision }) || entry.randomBefore !== previous.randomAfter || entry.preservedBefore !== previous.preservedAfter)) return false;
      }
      const expected = resolveReceptionEconomy(entry.before, effectiveWork(work, origin.oldWork, entry.before.week), economyCommand(entry.command));
      if (!same(entry.after, expected.after) || !same(entry.workAfter, expected.workAfter)) return false;
      work = expected.workAfter; previous = entry;
    }
    if (!same(r.work, work) || !previous) return false;
    if (previous.revision === s.revision && (!same(receptionEconomySnapshot(s), { ...previous.after, revision: s.revision }) || s.random.cursor !== previous.randomAfter || preserved(s) !== previous.preservedAfter)) return false;
    return true;
  } catch { return false; }
}
export const validateAttendantMysteriesReceptionState = validateAttendantMysteriesReception;
