import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/domain/checksum.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateCivilizationEnlightenerState, resolveCivilizationEnlightenerOriginalCharacteristics,
  civilizationEnlightenerInheritedView } from '../../src/domain/civilization-enlightener/index.js';
import { createPerfecterSource, perfecterSourceBlock, perfecterSourceView, validatePerfecterSource,
  PERFECTER_FROZEN_SOURCE_KEYS } from '../../src/domain/perfecter/source.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const file = 'tests/fixtures/civilization-enlightener-v01890/natural.json';
const original = (): SliceState => migrateSliceState(readObjectEntry<SliceState>(file, 'final'));

describe('Perfecter exact living Civilization Enlightener handoff', () => {
  it('retains the real 797-command S1 source, nine roots, wounds, zeros and exhausted original devices', () => {
    expect(sha256Hex(readFileSync(file, 'utf8'))).toBe('5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f');
    expect(readObjectEntry<SliceIntent[]>(file, 'commands')).toHaveLength(797);
    const raw = readObjectEntry<SliceState>(file, 'final'), s = original(), bytes = stableStringify(s);
    expect(raw.schemaVersion).toBe(186); expect(perfecterSourceBlock(s)).toBeNull();
    expect(s).toMatchObject({ revision: 798, week: 188, cash: 436, actionsRemaining: 3, health: 60,
      date: { year: 1353, month: 1, day: 27 }, progression: { pathwayId: 'paragon', sequence: 1, acting: 100 } });
    expect(s.injuries.map(i => i.severity).sort()).toEqual(['HEAVY', 'LIGHT']);
    expect(Object.keys(s.progression.mastery)).toHaveLength(21);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(8);
    const source = createPerfecterSource(s);
    expect(source.originalDevices.map(d => [d.id, d.charge, d.durability, d.location, d.active])).toEqual([
      ['AL4-BOX-1', 0, 100, 'PLAYER', false], ['AL4-FRAME-1', 0, 95, 'PLAYER', false],
    ]);
    expect(source.originalDevices).not.toBe(s.alchemist.life.creations);
    expect(source.originalDevicesDigest).toBe(sha256Hex(stableStringify(s.alchemist.life.creations)));
    expect(PERFECTER_FROZEN_SOURCE_KEYS).toEqual(['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'alchemist', 'arcaneScholar', 'knowledgeMentor', 'civilizationEnlightener']);
    for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(s[key]).toEqual(raw[key]);
    expect(validatePerfecterSource(s, source)).toBe(true); expect(stableStringify(s)).toBe(bytes);
    const originals = resolveCivilizationEnlightenerOriginalCharacteristics(s)!;
    expect(originals.embodiedOriginalBottleId).toBe('civilization-enlightener-potion-1');
    expect(originals.characteristics.map(c => c.holder)).toEqual(['EMBODIED', 'SUPPLIER', 'SUPPLIER']);
  });
  it('validates the frozen real S1 view before deriving its historical S2 view', () => {
    const s = original(), source = createPerfecterSource(s), before = stableStringify(s);
    const s1 = perfecterSourceView(s, source);
    expect(validateCivilizationEnlightenerState(s1)).toBe(true);
    const s2 = civilizationEnlightenerInheritedView(s1);
    expect(s2.progression).toMatchObject({ pathwayId: 'paragon', sequence: 2, acting: 100 });
    expect(s2.alchemist.life.creations).toEqual(s.civilizationEnlightener.sourceScene!.creations);
    expect(stableStringify(s)).toBe(before);
  });
  it('rejects forged budget, RNG, source receipts, device charge, repairs and legacy-root substitutions', () => {
    const s = original(), source = createPerfecterSource(s);
    for (const mutate of [
      (x: typeof source) => { x.budget.cash++; },
      (x: typeof source) => { x.random.cursor--; },
      (x: typeof source) => { x.acquisition.consumptions[0]!.cursorAfter++; },
      (x: typeof source) => { x.originalDevices[0]!.charge++; },
      (x: typeof source) => { x.originalDevices[1]!.durability = 100; },
    ]) { const forged = structuredClone(source); mutate(forged); expect(validatePerfecterSource(s, forged)).toBe(false); }
    for (const mutate of [
      (x: SliceState) => { x.alchemist.life.creations[0]!.charge++; },
      (x: SliceState) => { x.civilizationEnlightener.bottles[1]!.status = 'PLAYER'; },
      (x: SliceState) => { x.status = 'DEAD'; x.health = 0; },
    ]) { const forged = structuredClone(s); mutate(forged); expect(perfecterSourceBlock(forged)).not.toBeNull(); }
  });
});
