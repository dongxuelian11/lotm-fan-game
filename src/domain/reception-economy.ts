import type { PublicGameDate } from '../shared/contracts.js';
import type { SliceInjury, SliceState } from './slice/types.js';
import { addGameDays } from './game-calendar.js';

/** Exact established contemporary reception rules, shared by both sequences. */
export type ReceptionEconomyCommand = 'WORK' | 'REST' | 'NEXT_WEEK';
export interface ReceptionEconomyBudget {
  week: number; date: PublicGameDate; revision: number; actions: number; cash: number;
  health: number; mind: number; spirituality: number; pollution: number; injuries: SliceInjury[]; injuryRisk: number;
}
export interface ReceptionWorkLedger { week: number | null; works: number; rests: number; weeks: number; income: number; expenses: number; emergencyUsed: boolean }
export interface ReceptionEconomyResult { after: ReceptionEconomyBudget; workAfter: ReceptionWorkLedger }
export function createReceptionWorkLedger(): ReceptionWorkLedger { return { week: null, works: 0, rests: 0, weeks: 0, income: 0, expenses: 0, emergencyUsed: false }; }
export function receptionEconomySnapshot(s: SliceState): ReceptionEconomyBudget {
  return { week: s.week, date: structuredClone(s.date), revision: s.revision, actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind, spirituality: s.spirituality,
    pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
export function receptionEconomyBlock(b: ReceptionEconomyBudget, w: ReceptionWorkLedger, command: ReceptionEconomyCommand): string | null {
  if (command === 'NEXT_WEEK') return b.actions !== 0 ? '用完本周行动再推进真实七天。' : b.cash < 24 ? '七天生活费24便士；可用本周有限补劳动。' : null;
  if (command === 'WORK') return b.actions > 0 || b.cash < 24 && !w.emergencyUsed ? null : '本周行动用尽；有限补劳动已用或无需启用。';
  if (command === 'REST') return b.actions < 1 ? '休养需要1行动。' : b.cash < 8 ? '休养需要8便士。' : null;
  return '接待处普通动作无效。';
}
export function resolveReceptionEconomy(before: ReceptionEconomyBudget, work: ReceptionWorkLedger, command: ReceptionEconomyCommand): ReceptionEconomyResult {
  const reason = receptionEconomyBlock(before, work, command); if (reason) throw new Error(reason);
  const after = structuredClone(before), workAfter = structuredClone(work);
  if (command === 'WORK') {
    if (after.actions > 0) after.actions--; else workAfter.emergencyUsed = true;
    after.cash += 24; workAfter.income += 24; workAfter.works++; workAfter.week = after.week;
  } else if (command === 'REST') {
    after.actions--; after.cash -= 8; workAfter.expenses += 8; workAfter.rests++;
    after.health = Math.min(100, after.health + 5); after.mind = Math.min(100, after.mind + 8); after.spirituality = Math.min(120, after.spirituality + 10); after.pollution = Math.max(0, after.pollution - 10);
    for (const injury of after.injuries) if (injury.treatedRevision === null) injury.treatedRevision = before.revision + 1;
    after.injuryRisk = 0;
  } else {
    after.cash -= 24; workAfter.expenses += 24; workAfter.weeks++; after.week++; after.date = addGameDays(after.date, 7); after.actions = 4; workAfter.emergencyUsed = false; workAfter.week = after.week;
  }
  return { after, workAfter };
}
