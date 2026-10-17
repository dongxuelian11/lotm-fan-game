import { describe, expect, it, vi } from 'vitest';
import { SLICE_LIFE } from '../../src/content/slice-events.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { openRedPriestRuntimeSession, type RedPriestRuntimeDraft } from '../../src/domain/red-priest/owned-session.js';
import { redPriestCommandBlock, projectRedPriest, validateRedPriestCommand, validateRedPriestState,
  assertOwnedRedPriestCurrent, openRedPriestOwnedHead } from '../../src/domain/red-priest/index.js';
import { RED_PRIEST_FROZEN_SOURCE_KEYS } from '../../src/domain/red-priest/source.js';
import { RED_PRIEST_MATERIAL_LOCATIONS } from '../../src/domain/red-priest/material-content.js';
import type { RedPriestCommand } from '../../src/domain/red-priest/types.js';
import type { RedPriestOwnedEngine } from '../../src/domain/red-priest/engine.js';
import * as engine from '../../src/domain/red-priest/engine.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Directed domain checks continue the real 795-command predecessor. They are
// not the natural producer, never search seeds and never manufacture a victory,
// authorization, dose, army, money, identity or previously consumed item.
const FILE = 'tests/fixtures/conqueror-v01870/natural.json';
let originalCache: SliceState | undefined, guidedCache: SliceState | undefined;
const original = (): SliceState => structuredClone(originalCache ??= migrateSliceState(readObjectEntry<unknown>(FILE, 'final')));
const guided = (): SliceState => structuredClone(guidedCache ??= applySliceIntent(original(), { type: 'RED_PRIEST', command: { type: 'LEARN_GUIDANCE' } }));
const intent = (command: RedPriestCommand): SliceIntent => ({ type: 'RED_PRIEST', command });
const same = (actual: unknown, expected: unknown): void => { expect(stableStringify(actual)).toBe(stableStringify(expected)); };
const advance = (session: ReturnType<typeof openRedPriestRuntimeSession>, command: RedPriestCommand): SliceState => {
  const draft = session.prepare(intent(command), session.inspect().revision); session.commit(draft); return session.snapshot();
};

function ordinaryFinance(state: SliceState) {
  let result = resolveSliceWeeklyFinance({ week: state.week, revision: state.revision + 1, cash: state.cash,
    lifeTier: state.lifeTier, nextLifeTier: state.nextLifeTier, debts: state.debts, missedWeeks: state.missedWeeks,
    credit: state.credit, pulse: 'BILL', billAmount: 0 });
  // This expectation is used only where cash pays the life bill; the separate
  // insufficient-cash test verifies the explicit new principal independently.
  expect(result.eventId).not.toBe('LIFE-BILL-01');
  return result.state;
}

describe('Red Priest central runtime on the actual living predecessor', () => {
  it('hands off exactly once and keeps all nine roots, thirty people, old bottles and original war untouched', () => {
    const prior = original(), next = guided();
    expect([prior.revision, prior.week, prior.cash, prior.health]).toEqual([796, 200, 536, 80]);
    expect(next.revision).toBe(prior.revision + 1); expect(next.redPriest.journal).toEqual([]);
    same(next.random, prior.random); same(next.progression, prior.progression);
    for (const key of RED_PRIEST_FROZEN_SOURCE_KEYS) same(next[key], prior[key]);
    same(next.world, prior.world); same(next.combatHistory, prior.combatHistory);
    expect(next.ironBloodKnight.team.members.every(p => p.location === 'HOME' && !p.present)).toBe(true);
    expect(next.redPriest.materials!.items.filter(i => i.disposition === 'INTEGRATED_PLAYER')).toHaveLength(1);
    expect(next.redPriest.materials!.items.filter(i => i.disposition === 'UNLOCATED')).toHaveLength(2);
    expect(next.redPriest.materials!.items.filter(i => i.disposition === 'PLAYER_HELD')).toHaveLength(0);
    expect(() => applySliceIntent(next, intent({ type: 'LEARN_GUIDANCE' }))).toThrow();
    assertValidSliceState(next);
  }, 60_000);

  it('matches raw and opaque owned transitions including one real investigation check, receipts and untouched previews', () => {
    let raw = guided(); const session = openRedPriestRuntimeSession(raw), initial = structuredClone(raw);
    const commands: RedPriestCommand[] = [ { type: 'REST' }, { type: 'TRAVEL', to: RED_PRIEST_MATERIAL_LOCATIONS.archive },
      { type: 'MATERIAL', command: { type: 'TRACE_DISPOSITION', itemId: 'conqueror-potion-1:characteristic' } }, { type: 'NEXT_WEEK' } ];
    for (const command of commands) {
      const before = structuredClone(raw), previewBytes = stableStringify(session.snapshot());
      session.projectRedPriest(); session.projectRedPriest();
      expect(stableStringify(session.snapshot())).toBe(previewBytes);
      const draft = session.prepare(intent(command), raw.revision);
      raw = applySliceIntent(raw, intent(command));
      same(session.snapshot(), before); same(session.snapshotDraft(draft), raw);
      same(session.projectDraftRedPriest(draft), projectRedPriest(raw));
      session.commit(draft); same(session.snapshot(), raw);
    }
    expect(raw.random.cursor).toBe(initial.random.cursor + 1);
    expect(raw.redPriest.journal.flatMap(e => e.randomReceipts)).toHaveLength(1);
    expect(raw.redPriest.journal[2]!.materialReceipt?.frame.evidence?.kind).toBe('MATERIAL_CHECK');
    expect(raw.redPriest.frame!.location).toBe(RED_PRIEST_MATERIAL_LOCATIONS.archive);
    expect(raw.injuries).toEqual([]); // The original two LIGHT injuries actually recover through REST.
    for (const key of RED_PRIEST_FROZEN_SOURCE_KEYS) same(raw[key], initial[key]);
    same(openRedPriestRuntimeSession(raw).snapshot(), raw);
  }, 90_000);

  it('pays the original weekly wage once and uses the ordinary life/debt resolver on real seven-day boundaries', () => {
    const session = openRedPriestRuntimeSession(guided());
    const atNewWeek = advance(session, { type: 'NEXT_WEEK' }), random = structuredClone(atNewWeek.random);
    const worked = advance(session, { type: 'WORK' });
    expect(worked.cash).toBe(atNewWeek.cash + atNewWeek.character.weeklyWage);
    expect(worked.wagePaidWeek).toBe(worked.week); expect(worked.actionsRemaining).toBe(atNewWeek.actionsRemaining - 1);
    expect(() => session.prepare(intent({ type: 'WORK' }), worked.revision)).toThrow();
    const expected = ordinaryFinance(worked), next = advance(session, { type: 'NEXT_WEEK' });
    expect(next.week).toBe(worked.week + 1); same(next.date, addGameWeeks(worked.date, 1));
    expect(next.cash).toBe(expected.cash); same(next.debts, expected.debts);
    expect([next.missedWeeks, next.credit, next.lifeTier]).toEqual([expected.missedWeeks, expected.credit, expected.nextLifeTier]);
    expect(next.actionsRemaining).toBe(next.weeklyBudget); same(next.random, random);
    same(next.redPriest.frame!.finance.debts, next.debts);
  }, 60_000);

  it('records unpaid ordinary living costs and later repays them instead of freezing or erasing personal debt', () => {
    const session = openRedPriestRuntimeSession(guided());
    let state = session.snapshot(), steps = 0;
    while (state.cash >= SLICE_LIFE[state.lifeTier].cost) {
      state = advance(session, { type: 'NEXT_WEEK' });
      expect(++steps).toBeLessThan(64);
    }
    const prior = state, due = SLICE_LIFE[prior.lifeTier].cost;
    state = advance(session, { type: 'NEXT_WEEK' });
    const created = state.debts.filter(d => !prior.debts.some(p => p.id === d.id));
    expect(created).toHaveLength(1); expect(created[0]!.remaining).toBe(due - prior.cash);
    expect(created[0]!.source).toBe('生活应付款'); expect(state.cash).toBe(0); expect(state.lifeTier).toBe('DESTITUTE');
    expect(state.redPriest.journal.at(-1)!.financeReceipts.some(r => r.text.includes('计欠'))).toBe(true);
    state = advance(session, { type: 'WORK' });
    const expected = ordinaryFinance(state), next = advance(session, { type: 'NEXT_WEEK' });
    same(next.debts, expected.debts); expect(next.cash).toBe(expected.cash);
    expect(next.debts.reduce((n, d) => n + d.remaining, 0)).toBeLessThan(state.debts.reduce((n, d) => n + d.remaining, 0));
    expect(next.redPriest.campaign!.week).toBe(next.week);
  }, 90_000);

  it('rejects remote material actions and every pre-promotion shortcut without spending fees or RNG', () => {
    const session = openRedPriestRuntimeSession(guided()), before = session.snapshot(), bytes = stableStringify(before);
    const blocked: RedPriestCommand[] = [
      { type: 'MATERIAL', command: { type: 'TRACE_DISPOSITION', itemId: 'conqueror-potion-1:characteristic' } },
      { type: 'MATERIAL', command: { type: 'PREPARE_COMPOUND' } },
      { type: 'CONSUME', compoundId: 'invented-dose', confirmed: true },
      { type: 'START_EPILOGUE' }, { type: 'EPILOGUE', command: { type: 'CONTAIN_FIRE' } },
      { type: 'TRAVEL', to: 'southern-harbor' }, { type: 'CAMPAIGN', command: { type: 'DECLARE_OFFENSIVE' } },
    ];
    for (const command of blocked) expect(() => session.prepare(intent(command), before.revision)).toThrow();
    expect(stableStringify(session.snapshot())).toBe(bytes);
    const arrived = advance(session, { type: 'TRAVEL', to: RED_PRIEST_MATERIAL_LOCATIONS.archive });
    expect(arrived.cash).toBe(before.cash - 10); expect(arrived.actionsRemaining).toBe(before.actionsRemaining - 1);
    same(arrived.random, before.random); expect(arrived.redPriest.frame!.nowSecond).toBe(3600);
    expect(arrived.redPriest.materials!.items.find(i => i.disposition === 'INTEGRATED_PLAYER')!.locationId).toBe(RED_PRIEST_MATERIAL_LOCATIONS.archive);
    expect(redPriestCommandBlock(arrived, blocked[0]!)).toBeNull();
    expect(projectRedPriest(arrived).abilities.some(a => a.id.startsWith('hunter.s0.'))).toBe(false);
  }, 60_000);

  it('rejects rewritten source, check receipt, current budget, old people and forged opaque identities', () => {
    const session = openRedPriestRuntimeSession(guided());
    advance(session, { type: 'TRAVEL', to: RED_PRIEST_MATERIAL_LOCATIONS.archive });
    const valid = advance(session, { type: 'MATERIAL', command: { type: 'TRACE_DISPOSITION', itemId: 'conqueror-potion-1:characteristic' } });
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.redPriest.source!.budget.cash++; },
      s => { const receipt = s.redPriest.journal.at(-1)!.randomReceipts[0]!; receipt.check = { ...receipt.check, roll: receipt.check.roll % 100 + 1 }; },
      s => { s.redPriest.journal.at(-1)!.afterDigest = '0'.repeat(64); },
      s => { s.redPriest.frame!.budget.cash++; s.cash++; },
      s => { s.ironBloodKnight.team.members[0]!.energy++; },
      s => { s.random.cursor++; },
      s => { (s.redPriest as unknown as Record<string, unknown>).verified = true; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(valid); mutate(changed);
      expect(validateRedPriestState(changed)).toBe(false); expect(() => openRedPriestRuntimeSession(changed)).toThrow();
    }
    const head = openRedPriestOwnedHead(valid);
    for (const fake of [{}, { ...head }, structuredClone(head)] as RedPriestOwnedEngine[]) expect(() => assertOwnedRedPriestCurrent(valid, fake)).toThrow();
    const foreign = openRedPriestRuntimeSession(valid).prepare(intent({ type: 'NEXT_WEEK' }), valid.revision);
    expect(() => session.commit(foreign)).toThrow();
    expect(() => session.commit({} as RedPriestRuntimeDraft)).toThrow();
    same(session.snapshot(), valid);
  }, 90_000);

  it('keeps owned previews and advancement on the opened current engine, with strict reconstruction only on reopening', () => {
    const input = guided(), open = vi.spyOn(engine, 'openRedPriestOwnedEngine');
    try {
      const session = openRedPriestRuntimeSession(input); expect(open).toHaveBeenCalledTimes(1);
      session.projectRedPriest();
      const draft = session.prepare(intent({ type: 'REST' }), session.inspect().revision);
      session.projectDraftRedPriest(draft); session.commit(draft); session.projectRedPriest();
      expect(open).toHaveBeenCalledTimes(1);
      same(openRedPriestRuntimeSession(session.snapshot()).snapshot(), session.snapshot()); expect(open).toHaveBeenCalledTimes(2);
      expect(validateRedPriestCommand({ type: 'CAMPAIGN', command: { type: 'HOST_ADVANCE', toWeek: 9999 } })).toBe(false);
      expect(validateRedPriestCommand({ type: 'MATERIAL', command: { type: 'TRACE_DISPOSITION', itemId: 'conqueror-potion-1:characteristic', proof: 'supplied' } })).toBe(false);
    } finally { open.mockRestore(); }
  }, 60_000);
});
