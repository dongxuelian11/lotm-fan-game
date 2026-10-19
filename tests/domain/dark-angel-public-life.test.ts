import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectDarkAngelLife, publicDarkAngelAttempt, publicDarkAngelWindow } from '../../src/domain/dark-angel/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

function expectPublic(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    expect(['random', 'randomSeed', 'randomCursor', 'randomBefore', 'randomAfter', 'sourceSpirit'].includes(key), key).toBe(false);
    if (key === 'source') expect(typeof entry).toBe('string'); // Public prose and check modifier labels remain legal.
    expectPublic(entry);
  }
}

describe('Dark Angel public life evidence', () => {
  it('retains actual receipts and attempts without exporting private replay sources or changing the saved RNG', () => {
    // Read one existing terminal capture only. No gameplay, command-chain replay or RNG search.
    const state = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/dark-angel-v02010/natural.json', 'final')) as SliceState;
    const life = state.darkAngel.life;
    expect(life.journal.length).toBeGreaterThan(0);
    const checked = life.journal.find(receipt => receipt.check !== null)!;
    expect(checked).toBeDefined();
    checked.check = { ...checked.check!, modifiers: [...checked.check!.modifiers, { source: '已公开的原灵协助', value: 0 }] };
    // Unknown provenance fields at multiple depths must not hitchhike through public object copies.
    Object.assign(checked.date, { randomCursor: 999 });
    Object.assign(checked.paid, { source: { privateSentinel: 'replay-only' } });
    Object.assign(checked.check!.modifiers[0]!, { randomBefore: 999 });
    Object.assign(checked.siteAfter.owner, { source: { privateSentinel: 'replay-only' } });
    const originalAttempt = life.cases['guided-reading'].attempts[0]!;
    Object.assign(originalAttempt, { randomCursor: 999 });
    Object.assign(originalAttempt.siteAtStart.card, { source: { privateSentinel: 'replay-only' } });
    const before = stableStringify(state), random = structuredClone(state.random);
    const projected = projectDarkAngelLife(state);
    expectPublic(projected);
    expect(projected.ledger).toHaveLength(life.journal.length);
    projected.ledger.forEach((receipt, index) => {
      const saved = life.journal[index]!;
      expect(receipt.week).toBe(saved.week);
      expect(receipt.revision).toBe(saved.revision);
      expect(receipt.command).toEqual(saved.command);
      expect(receipt.date).toEqual({ epoch: saved.date.epoch, year: saved.date.year, month: saved.date.month, day: saved.date.day });
      expect(receipt.paid).toEqual({ actions: saved.paid.actions, pennies: saved.paid.pennies, spirituality: saved.paid.spirituality, mind: saved.paid.mind, spiritSpirituality: saved.paid.spiritSpirituality, spiritIntegrity: saved.paid.spiritIntegrity, sealCharges: saved.paid.sealCharges });
      expect(receipt.elapsedSeconds).toBe(saved.elapsedSeconds);
      expect(receipt.moves).toEqual(saved.moves);
      expect(receipt.outcome).toBe(saved.outcome);
      expect(receipt.check?.roll ?? null).toBe(saved.check?.roll ?? null);
      expect(receipt.siteAfter.playerLocation).toBe(saved.siteAfter.playerLocation);
      expect(receipt.operationAfter.materials).toEqual(saved.operationAfter.materials);
    });
    const publicCheck = projected.ledger.find(receipt => receipt.check !== null)!.check!;
    expect(publicCheck.modifiers).toContainEqual({ source: '已公开的原灵协助', value: 0 });
    const publicAttempt = publicDarkAngelAttempt(originalAttempt);
    expectPublic(publicAttempt);
    expect(projected.cases[0]!.attempts[0]).toEqual(publicAttempt);
    expect(publicAttempt.penniesSpent).toBe(originalAttempt.penniesSpent);
    expect(publicAttempt.appliedAbilityIds).toEqual(originalAttempt.appliedAbilityIds);
    const sourceWindow = life.journal.find(receipt => receipt.source?.window)?.source?.window;
    expect(sourceWindow).toBeTruthy();
    const window = publicDarkAngelWindow(sourceWindow!);
    expectPublic(window);
    expect(window.spiritName).toBe(sourceWindow!.sourceSpirit.name);
    expect(window.expiresAt).toBe(sourceWindow!.expiresAt);
    expect(stableStringify(state)).toBe(before);
    expect(state.random).toEqual(random);
    projected.ledger[0]!.paid.pennies++;
    projected.ledger[0]!.siteAfter.card.travelMetres++;
    publicAttempt.appliedAbilityIds.length = 0;
    publicAttempt.siteAtStart.spirits['THT3-HELENA'].knownAbilities.length = 0;
    expect(stableStringify(state)).toBe(before);
  }, 120_000);
});
