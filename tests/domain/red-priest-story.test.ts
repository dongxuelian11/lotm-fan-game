import { describe, expect, it } from 'vitest';
import { redPriestEpilogueStory } from '../../src/domain/red-priest/index.js';

type StoryInput = Parameters<typeof redPriestEpilogueStory>[0];
// Pure display examples only. No gameplay state, saved capture, RNG or runtime
// session is synthesized, changed or replayed by this small helper regression.
function input(evacuated: number, status: StoryInput['status'], reported: boolean): StoryInput {
  return { status, reported, patients: [1, 2, 3].map<StoryInput['patients'][number]>((id, index) => ({
    id: `original-patient-${id}`, status: index < evacuated ? 'EVACUATED' : 'SHELTERED',
  })) };
}
function freeze(value: object): void {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  Object.freeze(value);
}

describe('Red Priest epilogue introduction follows actual patient and handover state', () => {
  it.each([
    [0, 'ACTIVE', false, '已转运原伤员0名，3名仍留在有遮蔽的原救护站。', '原分队仍受疲劳、伤势和现场抵抗限制。'],
    [1, 'ACTIVE', false, '已转运原伤员1名，2名仍留在有遮蔽的原救护站。', '原分队仍受疲劳、伤势和现场抵抗限制。'],
    [1, 'WITHDRAWN', false, '已转运原伤员1名，2名仍留在有遮蔽的原救护站。', '救援已经收束，实际人数和原分队损失尚待交接。'],
    [1, 'WITHDRAWN', true, '已转运原伤员1名，2名仍留在有遮蔽的原救护站。', '救援人数和原分队损失已经交接。'],
    [3, 'RESOLVED', true, '已转运原伤员3名，0名仍留在有遮蔽的原救护站。', '救援人数和原分队损失已经交接。'],
  ] as const)('describes %i evacuated, %s, reported=%s without mutating input', (evacuated, status, reported, patients, account) => {
    const value = input(evacuated, status, reported), before = structuredClone(value); freeze(value);
    expect(redPriestEpilogueStory(value)).toBe(`停战后的原运输侧线起火；${patients}${account}`);
    expect(value).toStrictEqual(before);
  });
});
