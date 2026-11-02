import type { SliceProjection } from './types.js';

/** Only existing public fields are needed by both settlement and the learning menu. */
export type LearningView = Pick<SliceProjection, 'character' | 'progression'>;
export function learningKnowledge(s: LearningView, targetId: string) {
  const before = s.character.coreStats.knowledge;
  const occult = targetId === 'learn.seer-notes';
  const cap = s.progression.pathwayId === 'paragon' ? 30 : 20;
  const after = Math.max(before, Math.min(cap, before + 1 + s.character.learningBonus + (occult ? 2 : 0)));
  const difficulty = occult ? 9 : s.progression.pathwayId === 'paragon' ? 10 : 12;
  return { before, after, cap, difficulty };
}
