import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { NATURE_WALKER_SOURCE_KEYS } from '../../src/domain/nature-walker/types.js';
import { barrenMatriarchNaturalPath, originalBarrenMatriarch } from './nature-walker-directed-helper.js';

async function fileHash(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

describe('Nature Walker historical source and current migration are separate claims', () => {
  it('pins the complete authentic 851-command historical input without changing its old format', async () => {
    expect(await fileHash(barrenMatriarchNaturalPath)).toBe('cd557e330303c6ce9efaf9960544f28eb8a4f9058182a1860a38f4edb7298caf');
    expect(readObjectEntry<SliceIntent[]>(barrenMatriarchNaturalPath, 'commands')).toHaveLength(851);
    const raw = readObjectEntry<Record<string, unknown>>(barrenMatriarchNaturalPath, 'final');
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([182, 'barren-matriarch-v182']);
    expect(raw).toMatchObject({ revision: 852, week: 212, status: 'ACTIVE', health: 100, mind: 96, spirituality: 114,
      cash: 885, actionsRemaining: 3, injuries: [], character: { gender: 'FEMALE' } });
    expect(Object.hasOwn(raw, 'natureWalker')).toBe(false);
  }, 30_000);

  it('migrates the actual terminal source to CURRENT with all eight historical roots and RNG unchanged', () => {
    const raw = readObjectEntry<Record<string, unknown>>(barrenMatriarchNaturalPath, 'final');
    const bytes = JSON.stringify(raw), current = migrateSliceState(raw), source = originalBarrenMatriarch();
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of NATURE_WALKER_SOURCE_KEYS) expect(current[key], key).toEqual(raw[key]);
    expect(current.random).toEqual(raw.random); expect(current.character).toEqual(raw.character);
    expect(current.progression).toEqual(raw.progression); expect(current.combatHistory).toEqual(raw.combatHistory);
    expect(current).toEqual(source); expect(JSON.stringify(raw)).toBe(bytes); assertValidSliceState(current);
    expect(current.natureWalker.acquisitionJournal).toEqual([]); expect(current.natureWalker.promotionWeek).toBeNull();
  }, 30_000);
});
