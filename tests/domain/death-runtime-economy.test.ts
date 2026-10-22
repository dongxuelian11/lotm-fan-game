import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { startDeathOwnedEngine, advanceDeathOwnedEngine, inspectDeathOwnedEngine, snapshotDeathOwnedEngine,
  blockDeathOwnedEngine, assertOwnedDeathCurrent, type DeathRuntimeState } from '../../src/domain/death/engine.js';
import { authenticDeathSource, assertUnmodifiedDeathInput, deathInheritedHash } from '../helpers/death-scenario.js';

/** Test-only projection of the exact private engine snapshot into its enclosing
 * source. No body/time field is invented. The full central cold validator must
 * independently accept the resulting complete source+command history. */
function enclosing(source: SliceState, root: DeathRuntimeState): SliceState {
  const s = structuredClone(source), f = root.frame!, b = f.budget;
  s.death = structuredClone(root); s.revision = source.revision + 1 + root.journal.length;
  Object.assign(s, structuredClone(f.finance));
  s.week = b.week; s.date = structuredClone(b.date); s.actionsRemaining = b.actions; s.cash = b.cash;
  s.health = b.health; s.mind = b.mind; s.spirituality = b.spirituality; s.status = b.status;
  s.injuries = structuredClone(b.injuries); s.injuryRisk = b.injuryRisk;
  s.progression.sequence = b.sequence; s.progression.acting = b.acting; s.progression.mastery = { ...b.mastery };
  s.character.coreStats = { ...b.coreStats }; s.seer.pollution = b.pollution; s.seer.completedSources = [...b.completedSources];
  s.random = { ...f.random }; s.lastCheck = root.journal.at(-1)?.randomReceipts.at(-1)?.check ?? null;
  return s;
}

/** Full strict source admission and real owned commands, no time mutation or
 * authority skip. This directed economy test is neither natural promotion nor
 * SQLite fault injection. Each travel uses the actual registered1800s route. */
describe('Death actual zero-cash return accounting', () => {
  it('crosses a real week on foot, retains only the unpaid difference, and repays from actual work first', () => {
    const source = authenticDeathSource(), frozen = deathInheritedHash(source);
    let head = startDeathOwnedEngine(source);
    const step = (command: import('../../src/domain/death/types.js').DeathCommand) => {
      head = advanceDeathOwnedEngine(head, command, inspectDeathOwnedEngine(head).revision + 1);
    };
    step({ type: 'NEXT_WEEK' });
    const begin = snapshotDeathOwnedEngine(head), initial = begin.frame!;
    expect(initial.budget.cash).toBe(0); expect(initial.budget.actions).toBe(4); expect(initial.nowSecond).toBe(initial.weekAnchor);
    // No full Slice clone/projection or predecessor replay inside this loop.
    for (let n = 0; n < 335; n++) step(n % 2 === 0 ? { type: 'TRAVEL', to: 'DE0-ARCHIVE' } : { type: 'RETURN_ON_FOOT' });
    const before = snapshotDeathOwnedEngine(head), previous = before.frame!;
    expect(previous.location).toBe('DE0-ARCHIVE'); expect(previous.nowSecond - previous.weekAnchor).toBe(603000);
    expect(previous.economy.livingArrears).toBe(0); expect(previous.budget.cash).toBe(0);
    const command = { type: 'RETURN_ON_FOOT' as const }, revision = inspectDeathOwnedEngine(head).revision + 1;
    const unpublished = advanceDeathOwnedEngine(head, command, revision), preview = snapshotDeathOwnedEngine(unpublished);
    expect(preview.frame!.economy.livingArrears).toBe(24); expect(snapshotDeathOwnedEngine(head).frame!.economy.livingArrears).toBe(0);
    const retry = advanceDeathOwnedEngine(head, command, revision); expect(snapshotDeathOwnedEngine(retry)).toEqual(preview); head = retry;
    const returned = snapshotDeathOwnedEngine(head), frame = returned.frame!;
    expect(frame.location).toBe('DE0-RECEPTION'); expect(frame.nowSecond).toBe(frame.weekAnchor);
    expect(frame.budget.week).toBe(previous.budget.week + 1); expect(frame.budget.cash).toBe(0); expect(frame.budget.actions).toBe(4);
    expect(frame.economy.livingArrears).toBe(24); expect(frame.economy.expenses).toBe(previous.economy.expenses);
    expect(frame.economy.travelledMetres - initial.economy.travelledMetres).toBe(604800);
    expect(frame.economy.elapsedSeconds - initial.economy.elapsedSeconds).toBe(604800);
    const receipt = returned.journal.at(-1)!; expect(receipt.financeReceipts).toHaveLength(1);
    expect(receipt.financeReceipts[0]!.text).toContain('新增本章生活欠费24');
    expect(blockDeathOwnedEngine(head, { type: 'MATERIAL', command: { type: 'BUY_COMPOUND', batchId: 'death-carrier-1' } }, inspectDeathOwnedEngine(head).revision + 1)).toContain('生活欠费');
    step({ type: 'WORK' }); const repaid = snapshotDeathOwnedEngine(head), paid = repaid.frame!;
    expect(paid.budget.cash).toBe(0); expect(paid.economy.livingArrears).toBe(0); expect(paid.budget.week).toBe(frame.budget.week);
    expect(paid.economy.income - frame.economy.income).toBe(24); expect(paid.economy.expenses - frame.economy.expenses).toBe(24);
    expect(repaid.journal.at(-1)!.financeReceipts.filter(r => r.title === '当代生活实际满七天')).toEqual([]);
    step({ type: 'WORK' }); const earned = snapshotDeathOwnedEngine(head);
    expect(earned.frame!.budget.cash).toBe(24); expect(earned.frame!.economy.livingArrears).toBe(0);
    const final = enclosing(source, earned);
    expect(final.debts).toEqual(source.debts); expect(final.random).toEqual(source.random); expect(deathInheritedHash(final)).toBe(frozen);
    assertOwnedDeathCurrent(final, head); assertValidSliceState(final); assertUnmodifiedDeathInput();
  }, 600_000);
});
