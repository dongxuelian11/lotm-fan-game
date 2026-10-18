import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const FILE = 'tests/fixtures/civilization-enlightener-v01890/natural.json';
const FILE_HASH = '5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f';
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');

describe('Knowledge Mentor and CE shared counts initialize independently', () => {
  it.each(['combat-first', 'slice-first'] as const)('preserves every count and all four private historical rounds with %s imports', async order => {
    // Reset the entire module graph before each entry point. These cases must
    // not inherit initialized combat aliases from the preceding import order.
    vi.resetModules();
    if (order === 'combat-first') await import('../../src/domain/knowledge-mentor/combat.js');
    else await import('../../src/domain/slice/index.js');
    const pyro = await import('../../src/domain/pyromaniac/combat.js');
    const pure = await import('../../src/domain/pyromaniac/count-wheel.js');
    const mentor = await import('../../src/domain/knowledge-mentor/combat.js');
    const enlightener = await import('../../src/domain/civilization-enlightener/combat.js');
    const { validateKnowledgeMentorRecordedRound } = await import('../../src/domain/slice/knowledge-mentor-combat.js');
    const { assertValidSliceState } = await import('../../src/domain/slice/index.js');
    const { migrateSliceState } = await import('../../src/domain/slice/migration.js');
    const { stableStringify } = await import('../../src/domain/canonical.js');
    const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');

    const wheel = pure.PYROMANIAC_COUNT_WHEEL;
    expect(wheel).toEqual([10, 15, 25, 25, 15, 10].map((weight, i) => ({ id: String(i + 1), label: `${i + 1}次`, weight })));
    expect(Object.isFrozen(wheel)).toBe(true); wheel.forEach(entry => expect(Object.isFrozen(entry)).toBe(true));
    for (const exported of [pyro.PYROMANIAC_COUNT_WHEEL, mentor.KNOWLEDGE_MENTOR_COUNT_WHEEL, mentor.KNOWLEDGE_MENTOR_ENEMY_COUNT_WHEEL,
      enlightener.CIVILIZATION_ENLIGHTENER_COUNT_WHEEL, enlightener.CIVILIZATION_ENLIGHTENER_ENEMY_COUNT_WHEEL]) expect(exported).toBe(wheel);
    const expected = [10, 15, 25, 25, 15, 10].flatMap((weight, i) => Array<number>(weight).fill(i + 1));
    for (const count of [pyro.pyromaniacActionCount, mentor.knowledgeMentorActionCount, mentor.knowledgeMentorEnemyActionCount,
      enlightener.civilizationEnlightenerActionCount, enlightener.civilizationEnlightenerEnemyActionCount]) {
      expect(count).toBe(pure.pyromaniacActionCount);
      expect(Array.from({ length: 100 }, (_, i) => count(i + 1))).toEqual(expected);
    }

    expect(fileDigest()).toBe(FILE_HASH);
    const raw = readObjectEntry<SliceState>(FILE, 'final'), original = digest(raw), random = structuredClone(raw.random);
    const history = raw.combatHistory.filter(round => round.knowledgeMentorOutcome);
    expect(history).toHaveLength(4);
    for (const round of history) {
      const before = digest(round), source = stableStringify(round.knowledgeMentorOutcome!.source);
      expect(mentor.validateKnowledgeMentorRoundOutcome(round.knowledgeMentorOutcome)).toBe(true);
      expect(validateKnowledgeMentorRecordedRound(round)).toBe(true);
      expect(digest(round)).toBe(before); expect(stableStringify(round.knowledgeMentorOutcome!.source)).toBe(source);
    }
    const current = migrateSliceState(raw), before = digest(current);
    assertValidSliceState(current);
    expect(current.combatHistory).toEqual(raw.combatHistory); expect(current.random).toEqual(random);
    expect(digest(current)).toBe(before); expect(digest(raw)).toBe(original); expect(fileDigest()).toBe(FILE_HASH);
  });
});
