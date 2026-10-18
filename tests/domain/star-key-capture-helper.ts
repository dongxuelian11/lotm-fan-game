import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateStarKeySource } from '../../src/domain/star-key/index.js';
import { STAR_KEY_SOURCE_KEYS, STAR_KEY_ABILITY_IDS } from '../../src/domain/star-key/types.js';
import { starKeyExpectedOriginals, starKeyLifeMasteryGains } from '../../src/domain/star-key/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

export const STAR_KEY_ROOT = 'tests/fixtures/star-key-v01960';
export const STAR_KEY_SOURCE = 'tests/fixtures/planeswalker-v01740/natural.json';
export const STAR_KEY_PEACEFUL_SOURCE = 'tests/fixtures/planeswalker-v01740/original-enemy-approach.json';
export const STAR_KEY_WANDERER_DEATH_SOURCE = 'tests/fixtures/wanderer-v01500/continued.json';
export const STAR_KEY_SOURCE_SHA = '06e0bec9d3a72a41c27c96dbedafdddb023732f74a559471848f53163d144a78';
export const STAR_KEY_PEACEFUL_SHA = 'ef0fe46be50b3b8ad09b8ef8551b7fa7fe76542626ccf769a50e31f9babe73f9';
export const STAR_KEY_WANDERER_DEATH_SHA = 'aa074a2c14ca18d3199a667bbec61b47bab05b6796de83649949299c9f03ffa9';
export const STAR_KEY_PREFIX_COUNT = 701;
export const STAR_KEY_PREFIX_SHA = 'cef4fc68b02edf0328bb5b5345684f997fa4919427c5e1a4f962d454fad81a8e';
export const STAR_KEY_RAW_SOURCE_STATE_SHA = '8ae8728f0320f9ee21573321b165f5d883efc02b431f46ba612189eb6c10dfe8';
export const STAR_KEY_RAW_SOURCE_SORTED_SHA = '597c582724d70fe524a3edbc6276942fd556abbdd9b7686f1d781ad4e0a5b864';
export const CAPTURE_BOUNDARY_TIMEOUT = 180_000;
export const sameCaptureValue = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${STAR_KEY_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(STAR_KEY_SOURCE, key);
export const peacefulEntry = <T>(key: string): T => readObjectEntry<T>(STAR_KEY_PEACEFUL_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${STAR_KEY_ROOT}/summary.json`, key);

// Retain only small metadata. Large natural captures are read one top-level
// entry at a time; historical schema literals are asserted before migration.
export const boundaryIndex: Record<string, string> = JSON.parse(readFileSync(`${STAR_KEY_ROOT}/boundaries.index.json`, 'utf8'));
export const boundarySteps: Record<string, number> = JSON.parse(readFileSync(`${STAR_KEY_ROOT}/boundaries.steps.json`, 'utf8'));
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export const uniqueBoundaryFiles = [...new Set(Object.values(boundaryIndex))];
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${STAR_KEY_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${STAR_KEY_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) if (line.trim()) yield JSON.parse(line) as T; }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  return currentCapture(naturalEntry<unknown>(key));
}
export function capturedSnapshot(name: string): SliceState {
  const filename = snapshotIndex[name];
  if (!filename) throw new Error(`Missing actual Star Key snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function boundaryFile(filename: string) {
  const path = capturePath(filename);
  return { count: readObjectEntry<number>(path, 'commandCount'),
    before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function namedBoundary(name: string) {
  const filename = boundaryIndex[name];
  if (!filename) throw new Error(`Missing actual Star Key boundary: ${name}`);
  return boundaryFile(filename);
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'STAR_KEY') {
    const offered = view.starKey.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing current public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct, view.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    const choice = view.activeEvent?.choices.find(row => row.id === intent.choiceId);
    expect(choice, `Missing public event choice: ${JSON.stringify(intent)}`).toBeDefined(); expect(choice!.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
/** One reviewed wording change in the otherwise unchanged stage196 capture.
 * Independent full-value expectations only; raw captures and current migrations
 * remain exact, including all original body, cost, outcome and RNG evidence. */
export const STAR_KEY_GUIDANCE_REPLAY_DIFF = {
  commandCount: 702, index: 1461, id: 'record-1010-1461', week: 201,
  title: '听取星之匙独立成品与专业准备指导', inputRevision: 1009, outputRevision: 1010,
  historicalText: '花1行动、500便士。52岁导师赫斯特·沃尔介绍的旅法师独立封存渠道说明原渠道记录。赫斯特介绍独立封存的星之匙成品魔药。当前渠道只交付成品。服用前先核对学徒至旅法师的八阶原瓶、三份实际报告与反思，记录已亲见的本地端点，再走查停止、归物与普通返回路线。完成三项准备后，另付费检查当周场地，再独立确认饮用所选原瓶。要求旅法师消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为旅法师、健康−15精神−25排异+30；严重排异仍为旅法师、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十五项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。三瓶全部失败耗尽后，可花1行动与100便士申请下一批，至少跨一真实周再接收三瓶；各瓶费用与准备单独结算。',
  currentText: '花1行动、500便士。52岁导师赫斯特·沃尔介绍的旅法师独立封存渠道说明原渠道记录。赫斯特介绍独立封存的星之匙成品魔药。当前渠道只交付成品。服用前先核对学徒至旅法师的八阶原瓶、三份实际报告与反思，记录已亲见的本地端点，再走查停止、归物与普通返回路线。完成三项准备后，另付费检查当周场地，再独立确认饮用所选原瓶。要求旅法师消化100、从其实际晋升周起满12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动；另付1行动与150便士检查当周场地，再以0行动独立确认饮用所选原瓶，意志30。大成功晋升、精神−8；成功晋升、精神−15；失败仍为旅法师、健康−15精神−25排异+30；严重排异仍为旅法师、健康−25精神−45排异+60。原瓶与本次准备均耗尽；专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。成功四属性各+1，十五项旧掌握保持原值，两项新掌握从0开始，灵性上限120且当前不补满。姓名、性别、年龄、性格、取向、原伤势与旧人的结局不变。最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查、核验并封存同一原特性，至少下一真实周以1行动和30便士当面回收；新普通药物与调配服务900便士，或五项新劳动后90便士。当周准备仍另行付费，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。',
} as const;
function checkedStarKeyGuidanceReplayCopy(recorded: SliceState, revision: 1010 | 1131, chronicleLength: 1462 | 1618): SliceState {
  const diff = STAR_KEY_GUIDANCE_REPLAY_DIFF;
  expect(recorded.revision).toBe(revision);
  expect(recorded.chronicle).toHaveLength(chronicleLength);
  expect(recorded.chronicle.filter(record => record.id === diff.id)).toHaveLength(1);
  sameCaptureValue(recorded.chronicle[diff.index], { id: diff.id, week: diff.week, title: diff.title, text: diff.historicalText });
  const guidance = recorded.starKey.acquisitionJournal[0];
  expect(guidance?.revision).toBe(diff.inputRevision); expect(guidance?.week).toBe(diff.week);
  sameCaptureValue(guidance?.command, { type: 'LEARN_GUIDANCE' });
  expect(recorded.starKey.sourceScene?.revision).toBe(diff.inputRevision);
  return structuredClone(recorded);
}
/** Only the current execution of actual command702 and its lastResult mirror. */
export function currentStarKeyGuidanceBoundaryExpected(recorded: SliceState): SliceState {
  const diff = STAR_KEY_GUIDANCE_REPLAY_DIFF;
  const expected = checkedStarKeyGuidanceReplayCopy(recorded, 1010, 1462);
  sameCaptureValue(recorded.lastResult, recorded.chronicle[diff.index]);
  expected.chronicle[diff.index]!.text = diff.currentText;
  expected.lastResult = structuredClone(expected.chronicle[diff.index]!);
  return expected;
}
/** Only the final expectation for executing all 823 unchanged commands today. */
export function currentStarKeyFullReplayExpected(recorded: SliceState): SliceState {
  const diff = STAR_KEY_GUIDANCE_REPLAY_DIFF;
  const expected = checkedStarKeyGuidanceReplayCopy(recorded, 1131, 1618);
  expect(recorded.lastResult?.id).not.toBe(diff.id);
  sameCaptureValue(recorded.lastResult, recorded.chronicle.at(-1));
  expected.chronicle[diff.index]!.text = diff.currentText;
  return expected;
}
/** Every other single-step replay starts from its exact archived before-state,
 * so its already-recorded guidance must retain the historical wording. */
export function expectedStarKeyBoundaryReplay(save: ReturnType<typeof boundaryFile>): SliceState {
  if (save.intent.type !== 'STAR_KEY' || save.intent.command.type !== 'LEARN_GUIDANCE') return save.final;
  const diff = STAR_KEY_GUIDANCE_REPLAY_DIFF;
  expect(save.count).toBe(diff.commandCount); expect(save.before.revision).toBe(diff.inputRevision);
  expect(save.before.chronicle).toHaveLength(diff.index);
  expect(save.before.starKey.guidanceKnown).toBe(false);
  sameCaptureValue(save.intent, { type: 'STAR_KEY', command: { type: 'LEARN_GUIDANCE' } });
  return currentStarKeyGuidanceBoundaryExpected(save.final);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > STAR_KEY_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), expectedStarKeyBoundaryReplay(save));
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting });

/** The frozen histories are exact. Only the existing PW2 room's authoritative
 * current physical fields change, and every such change must replay its journal. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of STAR_KEY_SOURCE_KEYS) {
    const current = structuredClone(state[key]);
    if (key === 'planeswalker') (current as SliceState['planeswalker']).life.site = structuredClone(original.planeswalker.life.site);
    sameCaptureValue(current, original[key]);
  }
  if (state.starKey.guidanceKnown) {
    sameCaptureValue(state.starKey.sourceHistory, Object.fromEntries(STAR_KEY_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(validateStarKeySource(state)).toBe(true);
    sameCaptureValue({ site: state.planeswalker.life.site }, starKeyExpectedOriginals(state));
  } else sameCaptureValue(state.planeswalker.life.site, original.planeswalker.life.site);
  const site = state.planeswalker.life.site, old = original.planeswalker.life.site;
  for (const key of ['lamp', 'screen', 'kits', 'effect'] as const) sameCaptureValue(site[key], old[key]);
  expect(site.playerAstralLegs).toBe(old.playerAstralLegs); expect(site.parcel.astralLegs).toBe(old.parcel.astralLegs);
  sameCaptureValue({ ...site.parcel, location: old.parcel.location, ordinaryMetres: old.parcel.ordinaryMetres }, old.parcel);
  expect(state.wanderer.life.packet.location).toBe('REMOTE');
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of STAR_KEY_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(starKeyLifeMasteryGains(state))) mastery[id] = mastery[id]! + gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.starKeyOutcome).toBeDefined();
    for (const action of [...round.starKeyOutcome!.playerActions, ...round.starKeyOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  expect(state.random.seed).toBe(original.random.seed);
  const { coreStats, ...identity } = state.character, { coreStats: originalStats, ...originalIdentity } = original.character;
  sameCaptureValue(identity, originalIdentity);
  for (const id of Object.keys(originalStats) as (keyof typeof originalStats)[]) expect(coreStats[id]).toBe(Math.min(500, originalStats[id] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
