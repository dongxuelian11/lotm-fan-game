import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceRecord, SliceState } from '../../src/domain/slice/types.js';
import { MERCURY_SNAKE_CURRENT_CONSUMPTION_RISK, mercurySnakeConsumptionRisk } from '../../src/domain/mercury-snake/content.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { MERCURY_SNAKE_PREFIX_COUNT, MERCURY_SNAKE_ROOT, assertPublicCaptureControl, captureBody, captureFileHash,
  captureValueHash, currentCapture, mercurySnakeReplayExpectation, naturalEntry, sameCaptureValue as same } from './mercury-snake-capture-helper.js';

const archiveHash = '6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574';
const prefixHash = '8e245a712705c444a2d5389e594ffe9c8c1ea8290bae511d686cbc8cd769a4c2';
let rawPrefix: SliceState, prefix: SliceState, guidance: SliceRecord, currentGuidance: SliceRecord;
let frozenStage: SliceState['mercurySnake'];

beforeAll(() => {
  rawPrefix = naturalEntry<SliceState>('prefixFinal');
  prefix = currentCapture(rawPrefix);
  const final = naturalEntry<SliceState>('final');
  guidance = final.chronicle.find(row => row.id === 'record-705-1131')!;
  frozenStage = final.mercurySnake;
  currentGuidance = { ...guidance, text: guidance.text.replace(mercurySnakeConsumptionRisk(), MERCURY_SNAKE_CURRENT_CONSUMPTION_RISK) };
}, 60_000);

describe('Mercury Snake frozen703 prefix and one current guidance action', () => {
  it('pins the immutable204 file and preserves every existing prefix field during migration', async () => {
    expect(await captureFileHash(`${MERCURY_SNAKE_ROOT}/natural.json`)).toBe(archiveHash);
    expect(captureValueHash(rawPrefix)).toBe(prefixHash);
    expect([rawPrefix.schemaVersion, rawPrefix.contentVersion]).toEqual([201, 'mercury-snake-v201']);
    expect([prefix.schemaVersion, prefix.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const key of Object.keys(rawPrefix) as (keyof SliceState)[]) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(prefix[key], rawPrefix[key]);
    }
    expect(prefix).toMatchObject({ revision: 704, week: 177, cash: 1060, actionsRemaining: 2,
      random: { seed: 'monster-natural-v060', cursor: 269 }, mercurySnake: { guidanceKnown: false } });
    expect(guidance).toMatchObject({ id: 'record-705-1131', week: 177, title: '听取水银之蛇独立成品与专业准备指导' });
    expect(guidance.text.endsWith(mercurySnakeConsumptionRisk())).toBe(true);
    expect(currentGuidance.text).not.toBe(guidance.text);
    expect(captureValueHash(rawPrefix)).toBe(prefixHash);
  });

  it('executes only command704 with the new sentence and the exact old paid receipt and source', () => {
    const intent = naturalEntry<SliceIntent[]>('commands')[MERCURY_SNAKE_PREFIX_COUNT]!;
    expect(intent).toEqual({ type: 'MERCURY_SNAKE', command: { type: 'LEARN_GUIDANCE' } });
    const beforeHash = captureValueHash(prefix);
    assertPublicCaptureControl(prefix, intent);
    const actual = applySliceIntent(prefix, intent);
    same(captureBody(actual), { ...captureBody(prefix), revision: 705, cash: 560, AP: 1 });
    same(actual.chronicle, [...prefix.chronicle, currentGuidance]);
    same(actual.lastResult, currentGuidance);
    same(actual.mercurySnake.acquisitionJournal, [frozenStage.acquisitionJournal[0]!]);
    same(actual.mercurySnake.sourceScene, frozenStage.sourceScene);
    same(actual.mercurySnake.sourceHistory, frozenStage.sourceHistory);
    // This text-only historical expectation is never fed back into the reducer.
    const historicalExpectation = { ...actual, chronicle: [...prefix.chronicle, guidance], lastResult: { ...guidance } };
    same(mercurySnakeReplayExpectation(historicalExpectation), actual);
    expect(historicalExpectation.lastResult.text).toBe(guidance.text);
    expect(captureValueHash(prefix)).toBe(beforeHash);
    expect(captureValueHash(rawPrefix)).toBe(prefixHash);
  }, 60_000);

  it('changes only the exact chronicle entry and its matching lastResult mirror', () => {
    const lookalikes = [
      { ...guidance, id: 'record-705-other' },
      { ...guidance, week: 178 },
      { ...guidance, title: '其他指导' },
      { ...guidance, text: `${guidance.text}其他原文。` },
    ];
    const historical = { ...prefix, chronicle: [...prefix.chronicle, ...lookalikes, guidance], lastResult: { ...guidance } };
    const beforeHash = captureValueHash(historical), projected = mercurySnakeReplayExpectation(historical);
    same(projected, { ...historical, chronicle: [...prefix.chronicle, ...lookalikes, currentGuidance], lastResult: currentGuidance });
    expect(captureValueHash(historical)).toBe(beforeHash);
    expect(mercurySnakeReplayExpectation(projected)).toBe(projected);
    for (const lastResult of [...lookalikes, prefix.lastResult, null]) {
      expect(mercurySnakeReplayExpectation({ ...historical, lastResult }).lastResult).toBe(lastResult);
    }
    const noMatchingChronicle = { ...historical, chronicle: [...prefix.chronicle, ...lookalikes] };
    expect(mercurySnakeReplayExpectation(noMatchingChronicle)).toBe(noMatchingChronicle);
    const archived = { ...rawPrefix, chronicle: [...rawPrefix.chronicle, guidance], lastResult: guidance };
    expect(mercurySnakeReplayExpectation(archived)).toBe(archived);
  });
});
