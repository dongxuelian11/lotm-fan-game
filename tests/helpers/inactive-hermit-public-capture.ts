import assert from 'node:assert/strict';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Backwards-only audit for four inactive fields retained by raw210/214/216.
 * Restore literal nulls only after checking private and public inactivity.
 * Never copy a private source/preparation or remove any other public field. */
export function historicalInactiveHermitPublic(projection: SliceProjection, state: SliceState) {
  assert.notEqual(state.progression.pathwayId, 'hermit');
  for (const root of ['knowledgeEmperor', 'sage'] as const) {
    const original = state[root], current = projection[root];
    assert.equal(original.guidanceKnown, false);
    assert.equal(original.promotionWeek, null);
    assert.equal(original.life.activeCase, null);
    assert.equal(original.life.site.introducedWeek, null);
    assert.equal(original.life.site.introducedDate, null);
    assert.equal(original.life.site.source, null);
    assert.equal(original.encounter.status, 'AVAILABLE');
    assert.equal(original.encounter.preparation, null);
    assert.equal(original.encounter.approachWeek, null);
    assert.equal(original.encounter.attemptWeek, null);
    assert.equal(original.encounter.startSource, null);
    assert.equal(original.encounter.startSite, null);
    assert.equal(original.encounter.currentSite, null);
    assert.equal(current.discovered, false);
    assert.equal(current.guidanceKnown, false);
    assert.equal(current.promoted, false);
    assert.equal(current.life.activeCase, null);
    assert.equal(current.life.currentAttempt, null);
    assert.equal(current.life.inside, false);
    assert.equal(current.life.insideCase, false);
    assert.equal(current.encounter.status, 'AVAILABLE');
    assert.equal(current.encounter.inside, false);
    assert.equal(current.encounter.site, null);
    assert.equal(current.encounter.startSite, null);
    assert.equal(current.encounter.enemy, null);
    assert.deepEqual(current.encounter.actions, []);
    assert.equal(Object.hasOwn(current.encounter, 'preparationSummary'), true);
    assert.equal(current.encounter.preparationSummary, null);
    assert.equal(Object.hasOwn(current.encounter, 'preparation'), false);
    assert.equal(Object.hasOwn(current.life.site, 'source'), false);
  }
  const { preparationSummary: _emptyKnowledgePreparation, ...knowledgeEncounter } = projection.knowledgeEmperor.encounter;
  const { preparationSummary: _emptySagePreparation, ...sageEncounter } = projection.sage.encounter;
  return { ...projection,
    knowledgeEmperor: { ...projection.knowledgeEmperor,
      encounter: { ...knowledgeEncounter, preparation: null },
      life: { ...projection.knowledgeEmperor.life, site: { ...projection.knowledgeEmperor.life.site, source: null } } },
    sage: { ...projection.sage,
      encounter: { ...sageEncounter, preparation: null },
      life: { ...projection.sage.life, site: { ...projection.sage.life.site, source: null } } },
  };
}

export type HistoricalInactiveHermitProjection = ReturnType<typeof historicalInactiveHermitPublic>;
