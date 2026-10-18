import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { openPerfecterRuntimeSession } from '../../src/domain/perfecter/owned-session.js';
import { createPerfecterState, perfecterCommandBlock, validatePerfecterState } from '../../src/domain/perfecter/index.js';
import type { PerfecterCommand } from '../../src/domain/perfecter/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { PERFECTER_FROZEN_SOURCE_KEYS } from '../../src/domain/perfecter/source.js';
import {
  authenticPerfecterBeforeConsume, assertControlledPerfecterPromotion, assertUnmodifiedPerfecterCapture,
  CONTROLLED_CONSUME, controlledHash, installControlledPerfecterPromotion,
} from '../helpers/perfecter-controlled-success.js';

afterEach(() => vi.restoreAllMocks());

describe('Perfecter explicitly controlled success branch, separate from the natural failed/dead capture', () => {
  it('substitutes only the declared first-new d100 draw and leaves historical and later draws intact', () => {
    const seam = installControlledPerfecterPromotion();
    for (let cursor = 0; cursor < 346; cursor++) {
      const actual = new DeterministicActionRandomStream('savant-rebuild-first', cursor);
      const expected = new DeterministicActionRandomStream('savant-rebuild-first', cursor);
      expect(actual.nextInt(1, 100)).toBe(seam.original.call(expected, 1, 100));
      expect(actual.cursor).toBe(cursor + 1);
    }
    expect(seam.substituted).toEqual([]);
    const firstNew = new DeterministicActionRandomStream('savant-rebuild-first', 346);
    expect(firstNew.nextInt(1, 100)).toBe(1); expect(firstNew.cursor).toBe(347);
    expect(firstNew.nextInt(1, 100)).toBe(100); expect(firstNew.nextInt(1, 100)).toBe(95);
    const otherRange = new DeterministicActionRandomStream('savant-rebuild-first', 346);
    expect(otherRange.nextInt(0, 9)).toBe(seam.original.call(new DeterministicActionRandomStream('savant-rebuild-first', 346), 0, 9));
    expect(seam.substituted).toEqual([{ cursorBefore: 346, cursorAfter: 347, actual: 81, controlled: 1 }]);
    seam.restore();
    expect(new DeterministicActionRandomStream('savant-rebuild-first', 346).nextInt(1, 100)).toBe(81);
  });

  it('promotes the exact prepared original body for one real charge, fuses only three original characteristics, and adds two zero skills', () => {
    const before = authenticPerfecterBeforeConsume(), beforeHash = controlledHash(before);
    const seam = installControlledPerfecterPromotion();
    const after = applySliceIntent(before, CONTROLLED_CONSUME);
    assertControlledPerfecterPromotion(before, after);
    assertValidSliceState(after);
    expect(projectSliceState(after).perfecter).toMatchObject({ promoted: true, insideCase: false });
    expect(projectSliceState(after).perfecter.abilities).toHaveLength(23);
    expect(perfecterCommandBlock(after, CONTROLLED_CONSUME.command)).not.toBeNull();
    expect(controlledHash(openPerfecterRuntimeSession(JSON.parse(JSON.stringify(after))).snapshot())).toBe(controlledHash(after));
    expect(seam.substituted.length).toBeGreaterThan(0);
    expect(seam.substituted.every(draw => draw.actual === 81 && draw.controlled === 1 && draw.cursorBefore === 346 && draw.cursorAfter === 347)).toBe(true);
    expect(controlledHash(before)).toBe(beforeHash);
    // Accepting an empty unrelated Fool root must never authenticate S0 itself.
    // The real Perfecter origin, promotion journal and unique originals remain
    // mandatory, even while this one explicitly controlled draw is active.
    const afterHash = controlledHash(after);
    const forgeries: { label: string; mutate: (state: SliceState) => void }[] = [
      { label: 'S0 without its legitimate Perfecter root', mutate: state => { state.perfecter = createPerfecterState(); } },
      { label: 'fabricated promotion history', mutate: state => { state.perfecter.journal.at(-1)!.command = { type: 'WORK' }; } },
      { label: 'the same original characteristic fused twice', mutate: state => {
        const materials = state.perfecter.materials!;
        materials.characteristics.push(structuredClone(materials.characteristics[0]!));
      } },
    ];
    for (const { label, mutate } of forgeries) {
      const forged = structuredClone(after); mutate(forged);
      expect(validatePerfecterState(forged), label).toBe(false);
      expect(() => assertValidSliceState(forged), label).toThrow();
      expect(() => openPerfecterRuntimeSession(forged), label).toThrow();
    }
    expect(() => applySliceIntent(after, CONTROLLED_CONSUME)).toThrow();
    expect(controlledHash(after)).toBe(afterHash);
    seam.restore();
    // A controlled result must fail production replay once its explicit seam is
    // removed. It cannot silently pass as the immutable natural play evidence.
    expect(validatePerfecterState(after)).toBe(false);
    assertValidSliceState(before);
    assertUnmodifiedPerfecterCapture();
  }, 60_000);

  it.each(['failed-skills-and-withdrawal', 'ordinary-rescue'] as const)('continues actual S0 into finite epilogue and %s without changing another draw', route => {
    const before = authenticPerfecterBeforeConsume();
    const seam = installControlledPerfecterPromotion();
    const session = openPerfecterRuntimeSession(before);
    const step = (command: PerfecterCommand) => {
      const draft = session.prepare({ type: 'PERFECTER', command }, session.inspect().revision);
      session.commit(draft);
      return session.snapshot();
    };
    const promoted = step(CONTROLLED_CONSUME.command);
    assertControlledPerfecterPromotion(before, promoted);
    step({ type: 'NEXT_WEEK' });
    const arrived = step({ type: 'TRAVEL', to: 'backlund:old-civic-archive' });
    expect([arrived.actionsRemaining, arrived.cash, arrived.health, arrived.mind, arrived.spirituality]).toEqual([2, 400, 100, 92, 78]);
    const entered = step({ type: 'START_EPILOGUE' });
    expect(entered.perfecter.frame!.budget).toEqual(arrived.perfecter.frame!.budget);
    expect(entered.perfecter.frame!.nowSecond).toBe(arrived.perfecter.frame!.nowSecond + 600);
    expect(entered.perfecter.epilogue).toMatchObject({ status: 'ACTIVE', apparatus: { id: 'BC-ARC-17', durability: 80, priorDurability: 92 } });
    expect(entered.perfecter.epilogue!.patients.map(patient => patient.injury)).toEqual(before.perfecter.works!.epilogueOrigin.patients.map(patient => patient.injury));
    step({ type: 'EPILOGUE', command: { type: 'OBSERVE' } });
    if (route === 'failed-skills-and-withdrawal') {
      step({ type: 'EPILOGUE', command: { type: 'CONTAIN_FLOW' } });
      const exhausted = step({ type: 'EPILOGUE', command: { type: 'RECONSTRUCT_MODEL' } });
      expect(exhausted.perfecter.journal.slice(-2).map(event => event.randomReceipts[0]!.check)).toMatchObject([
        { chance: 70, roll: 100, tier: 'GREAT_FAILURE' }, { chance: 70, roll: 95, tier: 'FAILURE' },
      ]);
      expect([exhausted.actionsRemaining, exhausted.cash, exhausted.health, exhausted.mind, exhausted.spirituality]).toEqual([0, 386, 72, 65, 56]);
      expect(exhausted.injuries.map(injury => injury.severity)).toEqual(['HEAVY', 'LIGHT']);
      expect(exhausted.perfecter.epilogue!.apparatus).toMatchObject({ durability: 68, supplierPartsStock: 2, sparePartsPurchased: 1, sparePartsInstalled: 0, sparePartsDamaged: 1 });
      const isolation = step({ type: 'EPILOGUE', command: { type: 'ISOLATE' } });
      expect(isolation.actionsRemaining).toBe(0);
      const withdrawn = step({ type: 'EPILOGUE', command: { type: 'WITHDRAW' } });
      expect(withdrawn.perfecter.epilogue).toMatchObject({ status: 'WITHDRAWN', flow: { quietedUnits: 6, looseUnits: 0 }, apparatus: { durability: 68 } });
      expect(withdrawn.perfecter.epilogue!.patients.every(patient => patient.status === 'SHELTERED' && patient.location.endsWith(':sheltered-reading-room'))).toBe(true);
      expect(withdrawn.perfecter.epilogue!.patients[0]!.additionalInjuries).toHaveLength(2);
      expect(withdrawn.injuries).toEqual(exhausted.injuries);
    } else {
      step({ type: 'EPILOGUE', command: { type: 'ISOLATE' } });
      const rescued = step({ type: 'EPILOGUE', command: { type: 'EVACUATE' } });
      expect(rescued.perfecter.epilogue).toMatchObject({ status: 'RESOLVED', pageAttempted: false, modelAttempted: false,
        flow: { quietedUnits: 6, looseUnits: 0 }, apparatus: { durability: 80 } });
      expect(rescued.perfecter.epilogue!.patients.every(patient => patient.status === 'EVACUATED' && patient.location.endsWith(':courtyard-aid-post'))).toBe(true);
      expect([rescued.actionsRemaining, rescued.cash, rescued.spirituality]).toEqual([1, 400, 78]);
      expect(rescued.random).toEqual(promoted.random);
    }
    const final = step({ type: 'EPILOGUE', command: { type: 'REPORT' } });
    expect(final.perfecter.epilogue!.reported).toBe(true);
    expect(session.projectPerfecter().insideCase).toBe(false);
    expect(() => step({ type: 'START_EPILOGUE' })).toThrow();
    expect(() => step({ type: 'EPILOGUE', command: { type: 'CONTAIN_FLOW' } })).toThrow();
    assertValidSliceState(final);
    expect(controlledHash(openPerfecterRuntimeSession(JSON.parse(JSON.stringify(final))).snapshot())).toBe(controlledHash(final));
    expect(final.perfecter.source).toEqual(before.perfecter.source);
    for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(final[key]).toEqual(before[key]);
    expect(seam.substituted.every(draw => draw.cursorBefore === 346 && draw.actual === 81 && draw.controlled === 1)).toBe(true);
    assertUnmodifiedPerfecterCapture();
  }, 60_000);
});
