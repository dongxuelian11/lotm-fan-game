import { SLICE_LIFE } from '../../content/slice-events.js';
import type { SliceState } from './types.js';

export type SliceWeeklyFinanceState = Pick<SliceState, 'week' | 'revision' | 'cash' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit' | 'pulse' | 'billAmount'>;
export interface SliceWeeklyFinanceReceipt { title: string; text: string }
export interface SliceWeeklyFinanceResult {
  state: SliceWeeklyFinanceState;
  receipts: SliceWeeklyFinanceReceipt[];
  eventId: 'LIFE-BILL-01' | 'DEBT-NOTICE-01' | 'DEBT-SETTLE-01' | null;
}

/** Pure BILL/DEBTS portion of the ordinary weekly pulse. Time, event opening,
 * receipt IDs, scheduling and all combat resources remain with the caller. */
export function resolveSliceWeeklyFinance(input: SliceWeeklyFinanceState): SliceWeeklyFinanceResult {
  const s: SliceWeeklyFinanceState = { week: input.week, revision: input.revision, cash: input.cash, lifeTier: input.lifeTier, nextLifeTier: input.nextLifeTier,
    debts: structuredClone(input.debts), missedWeeks: input.missedWeeks, credit: input.credit, pulse: input.pulse, billAmount: input.billAmount };
  const result: SliceWeeklyFinanceResult = { state: s, receipts: [], eventId: null };
  const note = (title: string, text: string) => { result.receipts.push({ title, text }); };
  const debtTotal = () => s.debts.reduce((sum, debt) => sum + debt.remaining, 0);
  if (s.pulse === 'BILL') {
    const cost = SLICE_LIFE[s.lifeTier].cost; s.billAmount = cost;
    if (s.cash >= cost) { s.cash -= cost; note('本周生活费', `已支付${cost}便士，工作工资不重复入账。`); s.pulse = 'DEBTS'; }
    else if (s.credit === 'SUSPENDED') {
      const paid = s.cash; s.cash = 0;
      s.debts.push({ id: `debt-${s.week}-${s.revision + 1}-${s.debts.length}`, source: '生活应付款', remaining: cost - paid, weeklyPayment: 30, createdWeek: s.week });
      s.nextLifeTier = 'DESTITUTE'; note('生活费如实记账', `已付${paid}便士，剩余${cost - paid}便士计欠，下周转赤贫。`); s.pulse = 'DEBTS';
    } else { result.eventId = 'LIFE-BILL-01'; return result; }
  }
  if (s.pulse === 'DEBTS') {
    const before = debtTotal(); let due = 0, paid = 0;
    for (const d of s.debts) {
      if (d.createdWeek >= s.week) continue;
      const amount = Math.min(d.remaining, d.weeklyPayment); due += amount;
      const p = Math.min(amount, s.cash); d.remaining -= p; s.cash -= p; paid += p;
    }
    if (due > 0) { s.missedWeeks = paid === due ? 0 : s.missedWeeks + 1; note('本周约定还款', `应付${due}便士，实际支付${paid}便士；未付款仍在本金中，不重复计债。`); }
    if (before > 0 && debtTotal() === 0) { s.missedWeeks = 0; s.credit = 'NORMAL'; note('账目结清', '最后一笔应付款已结清。旧记录保留，当前不再要求还款。'); }
    s.pulse = 'ADVANCE';
    if (s.missedWeeks >= 4 && s.credit !== 'SUSPENDED') { s.credit = 'SUSPENDED'; result.eventId = 'DEBT-SETTLE-01'; }
    else if (s.missedWeeks >= 2 && s.credit === 'NORMAL') { s.credit = 'NOTICE'; result.eventId = 'DEBT-NOTICE-01'; }
  }
  return result;
}
