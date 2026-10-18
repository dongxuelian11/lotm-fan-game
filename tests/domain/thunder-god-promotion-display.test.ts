import { beforeAll, describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { projectThunderGodLastCheck } from '../../src/domain/thunder-god/index.js';
import { assertGlobalPublic, CURRENT_SUPPORTED_PROMOTION_CHECK, expectedCurrentGlobal, filePin, hash,
  json, migrateCapturedTyrantState, RAW_SUPPORTED_PROMOTION_CHECK, ROOT, type Action } from '../helpers/tyrant-capture.js';

let promotion: Action, nextAction: Action;
beforeAll(() => {
  expect(filePin(`${ROOT}/action-717.json.gz`)).toEqual({ bytes: 816812,
    sha256: '9e0d99dd618d2df3812dbf42e939e8159a1114b67f199bc03e95fccc279bd69b' });
  expect(filePin(`${ROOT}/action-718.json.gz`)).toEqual({ bytes: 812778,
    sha256: '7e2f89e89380415973296d22353fdad35eecc765e670b47e24054ab9e06ac443' });
  promotion = json<Action>('action-717.json.gz'); nextAction = json<Action>('action-718.json.gz');
});

describe('Thunder God promotion display uses only the exact latest resolved receipt', () => {
  it('projects the complete actual717 supported70 check without changing any private state', () => {
    const state = migrateCapturedTyrantState(promotion.final), before = hash(state);
    expect(before).toBe('9be5b3d7474353d105f271e4af504fe9aeb980ee40d6e8776289490527ffd8be');
    expect(state.lastCheck).toEqual(RAW_SUPPORTED_PROMOTION_CHECK);
    expect(promotion.globalPublic.lastCheck).toEqual(RAW_SUPPORTED_PROMOTION_CHECK);
    expect(state.character.coreStats.will).toBe(28);
    expect(state.thunderGod.promotionStability!.preparations.at(-1)!.status).toBe('SPENT');
    const receipt = state.thunderGod.acquisitionJournal.at(-1)!;
    expect(receipt.before.coreStats.will).toBe(27);
    expect([receipt.revision, state.revision, receipt.randomBefore, receipt.randomAfter, state.random.cursor])
      .toEqual([717, 718, 270, 271, 271]);

    const result = projectThunderGodLastCheck(state), view = projectSliceState(state);
    expect(result).toEqual(CURRENT_SUPPORTED_PROMOTION_CHECK);
    expect(result).not.toBe(receipt.check);
    expect(result!.modifiers).not.toBe(receipt.check!.modifiers);
    expect(view).toEqual(expectedCurrentGlobal(promotion, 'after'));
    expect(Object.keys(view).filter(key => hash(view[key as keyof typeof view]) !==
      hash(promotion.globalPublic[key as keyof typeof view]))).toEqual(['lastCheck']);
    assertGlobalPublic(view, state);
    expect(hash(state)).toBe(before);
    Object.assign(result!.modifiers[0]!, { value: 999 });
    Object.assign(view.lastCheck!, { chance: 5 });
    expect(hash(state)).toBe(before);
    expect(hash(promotion.final)).toBe(before);
  }, 120_000);

  it('keeps actual718-before corrected and actual718-after null despite its unchanged RNG cursor', () => {
    expect(hash(nextAction.beforeLast)).toBe(hash(promotion.final));
    const before = migrateCapturedTyrantState(nextAction.beforeLast), after = migrateCapturedTyrantState(nextAction.final);
    const beforeHash = hash(before), afterHash = hash(after);
    expect(afterHash).toBe('cd99dccfa805f56fb7b8e47fa59b1a62b0c49eaa0b210275974c84e27ea7d6a7');
    expect(nextAction.lastIntent).toEqual({ type: 'THUNDER_GOD', command: { type: 'OBSERVE', caseId: 'located-target' } });
    expect([before.revision, after.revision, before.random.cursor, after.random.cursor]).toEqual([718, 719, 271, 271]);
    expect(projectSliceState(before)).toEqual(expectedCurrentGlobal(nextAction, 'before'));
    expect(projectThunderGodLastCheck(after)).toBeNull();
    expect(projectSliceState(after)).toEqual(nextAction.globalPublic);
    expect(hash(before)).toBe(beforeHash); expect(hash(after)).toBe(afterHash);
  }, 120_000);

  // These are isolated attribution negatives, never replay inputs or evidence of
  // a real altered history. Each starts from a fresh clone of the pinned save.
  const mismatches: Array<[string, (state: SliceState) => void]> = [
    ['no current check', s => { s.lastCheck = null; }],
    ['no acquisition receipt', s => { s.thunderGod.acquisitionJournal = []; }],
    ['wrong latest action', s => { s.thunderGod.acquisitionJournal.at(-1)!.command = { type: 'PREPARE_PROMOTION' }; }],
    ['missing resolved receipt', s => { s.thunderGod.acquisitionJournal.at(-1)!.check = null; }],
    ['later state revision with the same draw', s => { s.revision++; }],
    ['earlier receipt revision', s => { s.thunderGod.acquisitionJournal.at(-1)!.revision--; }],
    ['same revision rather than pre-commit revision', s => { s.thunderGod.acquisitionJournal.at(-1)!.revision = s.revision; }],
    ['later random draw', s => { s.random.cursor++; }],
    ['missing draw start', s => { s.thunderGod.acquisitionJournal.at(-1)!.randomBefore = null; }],
    ['different command start cursor', s => { s.thunderGod.acquisitionJournal.at(-1)!.cursorBefore--; }],
    ['different draw start cursor', s => { const e = s.thunderGod.acquisitionJournal.at(-1)!; e.randomBefore = e.randomBefore! - 1; }],
    ['different command end cursor', s => { s.thunderGod.acquisitionJournal.at(-1)!.cursorAfter++; }],
    ['different draw end cursor', s => { const e = s.thunderGod.acquisitionJournal.at(-1)!; e.randomAfter = e.randomAfter! + 1; }],
    ['different receipt roll', s => { const e = s.thunderGod.acquisitionJournal.at(-1)!; e.check = { ...e.check!, roll: e.check!.roll + 1 }; }],
    ['different raw ability', s => { s.lastCheck = { ...s.lastCheck!, ability: 'perception' }; }],
    ['different raw base', s => { s.lastCheck = { ...s.lastCheck!, baseAbility: s.lastCheck!.baseAbility + 1 }; }],
    ['different raw modifiers', s => { s.lastCheck = { ...s.lastCheck!, modifiers: [{ source: 'Unrelated check', value: 0 }] }; }],
    ['different raw effective ability', s => { s.lastCheck = { ...s.lastCheck!, effectiveAbility: s.lastCheck!.effectiveAbility + 1 }; }],
    ['different raw difficulty', s => { s.lastCheck = { ...s.lastCheck!, difficulty: s.lastCheck!.difficulty + 1 }; }],
    ['different raw chance', s => { s.lastCheck = { ...s.lastCheck!, chance: s.lastCheck!.chance + 1 }; }],
    ['different raw roll', s => { s.lastCheck = { ...s.lastCheck!, roll: s.lastCheck!.roll + 1 }; }],
    ['different raw outcome', s => { s.lastCheck = { ...s.lastCheck!, tier: 'FAILURE' }; }],
  ];
  it.each(mismatches)('does not substitute a promotion result for %s', (_name, change) => {
    const state = structuredClone(promotion.final); change(state);
    const before = hash(state), result = projectThunderGodLastCheck(state);
    expect(result).toEqual(state.lastCheck);
    if (result) { expect(result).not.toBe(state.lastCheck); expect(result.modifiers).not.toBe(state.lastCheck!.modifiers); }
    expect(hash(state)).toBe(before);
  });
});
