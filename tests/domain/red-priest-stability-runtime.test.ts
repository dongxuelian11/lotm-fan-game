import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { openRedPriestRuntimeSession } from '../../src/domain/red-priest/owned-session.js';
import { getRedPriestPromotionStabilityPreview } from '../../src/domain/red-priest/engine.js';
import { RED_PRIEST_FROZEN_SOURCE_KEYS } from '../../src/domain/red-priest/source.js';
import type { RedPriestCommand } from '../../src/domain/red-priest/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

// Actual-kernel QA uses the genuine sealed1137 fixture. An environment path
// may override its location for local review; missing input fails explicitly. No fake root, rewound RNG, chosen roll,
// outcome search or alternate starting save is accepted. Raw historical evidence
// is checked independently before exercising the current supported migration.
const path = process.env.RED_PRIEST_STABILITY_SOURCE ?? 'tests/fixtures/red-priest-v02090/planned1137/natural.json';
describe('paid postwar preparation on the actual living 1137-command predecessor', () => {
  it('pays once, advances real finance without RNG, consumes once, preserves old failures and strictly reopens', () => {
    expect(existsSync(path), `Missing genuine1137 fixture: ${path}`).toBe(true);
    const rawFileSha = createHash('sha256').update(readFileSync(path)).digest('hex');
    expect(rawFileSha).toBe('fc50408c3dbb087d46e441dfc5228993c1d65d750874cda81621e567e8930ac0');
    const raw = readObjectEntry<SliceState>(path, 'final'), rawState = stableStringify(raw);
    // Historical assertions are about untouched capture bytes. Current runtime
    // assertions happen only after the explicit supported migration below.
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([206, 'red-priest-v206']);
    expect(raw.revision).toBe(1138); expect(raw.random).toEqual({ seed: 'hunter-rebuild-first', cursor: 477 });
    expect(raw.status).toBe('ACTIVE'); expect(raw.progression.sequence).toBe(1);
    expect(Object.hasOwn(raw.redPriest, 'promotionStability')).toBe(false);
    const initial = migrateSliceState(raw);
    expect(stableStringify(raw), 'Migration cannot rewrite the raw historical1137 input').toBe(rawState);
    expect([initial.schemaVersion, initial.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    const original = raw as unknown as Record<string, unknown>, current = initial as unknown as Record<string, unknown>;
    const defaults = createSliceRun(raw.runId, readObjectEntry<Parameters<typeof createSliceRun>[1]>(path, 'creation'), raw.random.seed) as unknown as Record<string, unknown>;
    for (const key of Object.keys(original)) if (key !== 'schemaVersion' && key !== 'contentVersion')
      expect(stableStringify(current[key]), `Preserve captured1137 field ${key}`).toBe(stableStringify(original[key]));
    const added = Object.keys(defaults).filter(key => !Object.hasOwn(original, key));
    expect(Object.keys(current).filter(key => !Object.hasOwn(original, key)).sort()).toEqual([...added].sort());
    for (const key of added) expect(stableStringify(current[key]), `Exact current empty default ${key}`).toBe(stableStringify(defaults[key]));
    expect(initial.revision).toBe(1138); expect(initial.redPriest.journal.filter(e => e.command.type === 'CONSUME')
      .map(e => ({ chance: e.randomReceipts[0]!.check.chance, roll: e.randomReceipts[0]!.check.roll, tier: e.randomReceipts[0]!.check.tier })))
      .toEqual([{ chance: 5, roll: 42, tier: 'FAILURE' }, { chance: 5, roll: 58, tier: 'FAILURE' }]);
    expect(Object.hasOwn(initial.redPriest, 'promotionStability')).toBe(false);
    const session = openRedPriestRuntimeSession(initial), oldJournal = stableStringify(initial.redPriest.journal),
      oldSource = stableStringify(initial.redPriest.source), oldItemIds = initial.redPriest.materials!.items.map(i => i.id);
    const act = (command: RedPriestCommand) => {
      const draft = session.prepare({ type: 'RED_PRIEST', command }, session.inspect().revision);
      session.commit(draft); return session.snapshot();
    };
    // A bounded public-action-only preparation policy. Failed real purification
    // remains a paid attempt; no check or cursor is inspected by this selector.
    let compoundId: string | undefined;
    for (let i = 0; i < 180 && !compoundId; i++) {
      const view = session.projectRedPriest(), enabled = view.actions.filter(a => a.enabled);
      const consume = enabled.find(a => a.command.type === 'CONSUME');
      if (consume?.command.type === 'CONSUME') { compoundId = consume.command.compoundId; break; }
      const pick = (type: RedPriestCommand['type']) => enabled.find(a => a.command.type === type);
      const recovery = pick('CLINIC') ?? ((view.resources.health < 90 || view.resources.mind < 85 || view.resources.spirituality < 45) ? pick('REST') : undefined);
      const work = Number.parseInt(view.resources.cash, 10) < 650 ? pick('WORK') : undefined;
      const material = enabled.find(a => a.command.type === 'MATERIAL');
      const choice = recovery ?? work ?? material ?? pick('NEXT_WEEK');
      expect(choice, 'Real material preparation became blocked; do not manufacture a ready compound').toBeDefined();
      act(choice!.command); expect(session.inspect().status).toBe('ACTIVE');
    }
    expect(compoundId, 'Bounded real preparation did not reach an available third original dose').toBeDefined();
    for (let i = 0; i < 20; i++) {
      const current = session.snapshot(), preview = getRedPriestPromotionStabilityPreview(current.redPriest, compoundId!);
      if (preview.eligible && current.cash >= 200 && current.mind >= 78 && current.spirituality >= 42) break;
      const view = session.projectRedPriest(), enabled = view.actions.filter(a => a.enabled);
      const kind = view.resources.health < 80 || view.resources.mind < 78 || view.resources.spirituality < 42 ? 'REST'
        : Number.parseInt(view.resources.cash, 10) < 200 ? 'WORK' : 'NEXT_WEEK';
      const next = enabled.find(a => a.command.type === kind) ?? enabled.find(a => a.command.type === 'NEXT_WEEK');
      expect(next).toBeDefined(); act(next!.command);
    }
    const before = session.snapshot(), paidCommand = { type: 'STABILIZE_PROMOTION' as const, compoundId: compoundId! };
    expect(getRedPriestPromotionStabilityPreview(before.redPriest, compoundId!).eligible).toBe(true);
    const finance = resolveSliceWeeklyFinance({ ...before.redPriest.frame!.finance, week: before.week,
      revision: before.revision + 1, cash: before.cash - 120, pulse: 'BILL', billAmount: 0 });
    expect(finance.eventId).not.toBe('LIFE-BILL-01');
    const stable = act(paidCommand), receipt = stable.redPriest.journal.at(-1)!;
    expect(stable.random).toEqual(before.random); expect(receipt.randomReceipts).toEqual([]);
    expect(stable.week).toBe(before.week + 1); expect(stable.date).toEqual(addGameWeeks(before.date, 1));
    expect(stable.redPriest.frame!.nowSecond - before.redPriest.frame!.nowSecond).toBe(604800);
    expect(stable.actionsRemaining).toBe(stable.weeklyBudget);
    expect([stable.cash, stable.mind, stable.spirituality]).toEqual([finance.state.cash, before.mind - 8, before.spirituality - 12]);
    expect(stable.debts).toEqual(finance.state.debts); expect(receipt.financeReceipts).toEqual(finance.receipts);
    expect(stable.redPriest.materials).toEqual(before.redPriest.materials);
    const preparation = stable.redPriest.promotionStability!.preparations[0]!;
    expect(preparation.status).toBe('READY'); expect(preparation.witnesses).toHaveLength(3); expect(preparation.victoryReceiptIds).toHaveLength(5);
    expect(preparation.witnesses.every(w => stable.redPriest.journal.some(e => e.id === w.authorizationEventId && e.campaignHost?.receipt?.id === w.authorizationReceiptId))).toBe(true);
    expect(() => session.prepare({ type: 'RED_PRIEST', command: paidCommand }, stable.revision)).toThrow();
    expect(session.snapshot()).toEqual(stable);
    expect(openRedPriestRuntimeSession(stable).snapshot()).toEqual(stable);
    // Separate directed interruption branch from the same genuine paid state.
    // It is not a natural capture and neither outcome chooses the main branch.
    const interrupted = openRedPriestRuntimeSession(stable);
    const interruptAct = (command: RedPriestCommand) => {
      const draft = interrupted.prepare({ type: 'RED_PRIEST', command }, interrupted.inspect().revision);
      interrupted.commit(draft); return interrupted.snapshot();
    };
    const left = interruptAct({ type: 'TRAVEL', to: 'loen-headquarters' });
    expect(left.redPriest.promotionStability!.preparations[0]).toMatchObject({ status: 'INVALIDATED',
      invalidatedEventId: left.redPriest.journal.at(-1)!.id, spentEventId: null });
    const returned = interruptAct({ type: 'TRAVEL', to: stable.redPriest.frame!.location });
    expect(returned.cash).toBe(stable.cash - 20); expect(returned.random).toEqual(stable.random);
    expect(getRedPriestPromotionStabilityPreview(returned.redPriest, compoundId!)).toMatchObject({ prepared: false, effectiveBonus: 0, currentChance: 5 });
    const invalidDose = interruptAct({ type: 'CONSUME', compoundId: compoundId!, confirmed: true });
    expect(invalidDose.redPriest.journal.at(-1)!.randomReceipts[0]!.check.chance).toBe(5);
    expect(invalidDose.redPriest.promotionStability!.preparations[0]).toMatchObject({ status: 'SPENT',
      spentEventId: invalidDose.redPriest.journal.at(-1)!.id, invalidatedEventId: left.redPriest.journal.at(-1)!.id });
    expect(openRedPriestRuntimeSession(invalidDose).snapshot()).toEqual(invalidDose);
    const after = act({ type: 'CONSUME', compoundId: compoundId!, confirmed: true }), consumption = after.redPriest.journal.at(-1)!;
    expect(consumption.randomReceipts).toHaveLength(1); expect(consumption.randomReceipts[0]!.check.chance).toBe(68);
    expect(after.random.cursor).toBe(stable.random.cursor + 1);
    expect(after.redPriest.promotionStability!.preparations[0]).toMatchObject({ status: 'SPENT', spentEventId: consumption.id });
    expect(after.redPriest.materials!.compounds.find(c => c.id === compoundId)!.status).toBe('CONSUMED');
    expect(() => session.prepare({ type: 'RED_PRIEST', command: paidCommand }, after.revision)).toThrow();
    expect(() => session.prepare({ type: 'RED_PRIEST', command: { type: 'CONSUME', compoundId: compoundId!, confirmed: true } }, after.revision)).toThrow();
    expect(stableStringify(after.redPriest.journal.slice(0, initial.redPriest.journal.length))).toBe(oldJournal);
    expect(stableStringify(after.redPriest.source)).toBe(oldSource);
    expect(after.redPriest.materials!.items.map(i => i.id)).toEqual(oldItemIds);
    expect(after.redPriest.materials!.compounds).toHaveLength(3);
    for (const key of RED_PRIEST_FROZEN_SOURCE_KEYS) expect(after[key]).toEqual(initial[key]);
    if (consumption.randomReceipts[0]!.check.tier === 'FAILURE' || consumption.randomReceipts[0]!.check.tier === 'GREAT_FAILURE') {
      expect(after.progression.sequence).toBe(1); expect(after.injuries.length).toBeGreaterThan(stable.injuries.length);
      expect(getRedPriestPromotionStabilityPreview(after.redPriest, compoundId!).effectiveBonus).toBe(0);
    }
    expect(openRedPriestRuntimeSession(after).snapshot()).toEqual(after);
    const forged = structuredClone(stable); forged.redPriest.promotionStability!.preparations[0]!.witnesses[0]!.authorizationEventId = 'invented:witness';
    expect(() => openRedPriestRuntimeSession(forged)).toThrow();
    expect(createHash('sha256').update(readFileSync(path)).digest('hex'), 'Read-only historical1137 fixture').toBe(rawFileSha);
  }, 180_000);
});
