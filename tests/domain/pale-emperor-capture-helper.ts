import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

export const PALE_EMPEROR_ROOT = 'tests/fixtures/pale-emperor-v01950';
export const PALE_EMPEROR_SOURCE = 'tests/fixtures/death-consul-v01730/natural.json';
export const PALE_EMPEROR_SOURCE_SHA = '283fa4554282597027a6e65f2a31c561750769fb3f93343e570abebac11fdee9';
// The inspected producer hashes are insertion-order JSON.stringify hashes.
// They must not be compared with canonical/stableStringify hashes.
export const PALE_EMPEROR_PREFIX_SHA = '7f1377eebd7abfe9032d610ca171cdda2fac8541d5777ba096866b9b9e533caa';
export const PALE_EMPEROR_RAW_SOURCE_STATE_SHA = '6f02cbfee03fb205ffbb5017173800c078227ac388790217028f188db50274ab';
export const PALE_EMPEROR_PREFIX_COUNT = 815;
export const PALE_EMPEROR_RAW_ROOT_HASHES = {
  corpsecollector: 'e1e50c8908522f960e78737811cb16a7fc984ba935b089f1d5dcb4cc12818a0b',
  gravedigger: 'ce7607573601230c64730ca6f9d82f9489e1a3c86736ffd852b67dcdd82cfefb',
  spiritmedium: 'd17f603f4ab4cb5befd1effe9f081f8252b5a65ff70e99fd790f3895d47b8dad',
  spiritGuide: '3f61981e689a6ff548ffdc6c56eaee8750843291b30f80b70c4d010f421ba896',
  gatekeeper: 'ef027769305502c2a4faf019ff352f2c46ce99ddea23079285ef4d6aa230e0be',
  undying: '1cbb960f48e85c005ad943110d8e10aa40a0135c9876139caff7568a9a79ccd7',
  longChapter: '4300c7426ca8dba26baae24156be2fde2779f71c990e39033ef41ec54a79f1a8',
} as const;
export const sameCaptureValue = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
export const captureValueHash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${PALE_EMPEROR_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(PALE_EMPEROR_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${PALE_EMPEROR_ROOT}/summary.json`, key);

// Only small indexes and the command list stay resident. The large natural
// capture and every two-state boundary are read one top-level root at a time.
export const boundaryIndex: Record<string, string> = JSON.parse(readFileSync(`${PALE_EMPEROR_ROOT}/boundaries.index.json`, 'utf8'));
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export const uniqueBoundaryFiles = [...new Set(Object.values(boundaryIndex))];
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${PALE_EMPEROR_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${PALE_EMPEROR_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) if (line.trim()) yield JSON.parse(line) as T; }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
const checkpoints = new Map<string, SliceState>();
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  if (!checkpoints.has(key)) checkpoints.set(key, currentCapture(naturalEntry<unknown>(key)));
  return checkpoints.get(key)!;
}
export function capturedSnapshot(name: string): SliceState {
  const filename = snapshotIndex[name];
  if (!filename) throw new Error(`Missing actual Pale Emperor snapshot: ${name}`);
  // Each snapshot is one state, never a natural/boundary all-state tree.
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
  if (!filename) throw new Error(`Missing actual Pale Emperor boundary: ${name}`);
  return boundaryFile(filename);
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'PALE_EMPEROR' || intent.type === 'FERRYMAN') {
    if (intent.type === 'FERRYMAN') expect(['ERA_ENTER', 'ERA_WORK', 'ERA_REST', 'ERA_CARE', 'ERA_NEXT_WEEK']).toContain(intent.command.type);
    const actions = intent.type === 'PALE_EMPEROR' ? view.paleEmperor.actions : view.ferryman.era.actions;
    const offered = actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing current public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
/** One reviewed wording change in the otherwise unchanged 195 command trace.
 * These are independent full-value expectations, not product-derived text or a
 * general normalization. Original snapshots, hashes and migrations stay exact. */
export const PALE_EMPEROR_GUIDANCE_REPLAY_DIFF = {
  index: 1126, id: 'record-866-1126', week: 3300,
  title: '听取苍白皇帝独立成品与专业准备指导',
  inputRevision: 865, outputRevision: 866,
  historicalText: "花1行动、120便士。汉娜·斯托克（FR3-HANNA）介绍的当代独立苍白皇帝成品渠道说明当前渠道记录。苍白皇帝的当前渠道交付独立封存成品，不提供可自行调配的完整配方。先核对八阶实际经历和当前供应人的凭据，复核有限残响的处理边界，走查停止与普通返程。三项专业准备完成后，还须检查本周服药场地，再独立确认饮用所选原瓶。死亡执政官消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与20便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与准备均耗尽，专业支持只将本次排异后的健康精神保底到1。成功四属性各+1，17项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满。姓名、性别、身体与旧伤保留。全批失败耗尽后，实付1行动与20便士申请独立三瓶，至少跨一真实周领取；每瓶另做劳动并付款。",
  currentText: "花1行动、120便士。汉娜·斯托克（FR3-HANNA）介绍的当代独立苍白皇帝成品渠道说明当前渠道记录。苍白皇帝的当前渠道交付独立封存成品，不提供可自行调配的完整配方。先核对八阶实际经历和当前供应人的凭据，复核有限残响的处理边界，走查停止与普通返程。三项专业准备完成后，还须检查本周服药场地，再独立确认饮用所选原瓶。死亡执政官消化100、实际晋2后12整周、三份旧报告与反思完成、健康>20且精神>40。三项专业准备各1行动，再实付1行动与20便士检查本周服药场地；0行动独立确认饮用所选原瓶，意志30。大成功：晋1、精神−8；成功：晋1、精神−15；失败：仍2、健康−15精神−25排异+30；严重排异：仍2、健康−25精神−45排异+60。原瓶与准备均耗尽，专业支持只将本次排异后的健康精神保底到1。成功四属性各+1，17项原掌握不变，两项新掌握从0开始；灵性上限120，当前不补满。姓名、性别、身体与旧伤保留。三份原特性全部真实失败后，只能调查最后失败留下的同一份原物：1行动与20便士，至少七天后的真实下一周再花1行动原处交接；本次普通新药另付120便士，或五次新劳务后12便士。旧费用不退，旧劳动不抵新药；新容器不增加第四份特性。",
} as const;
function checkedPaleEmperorGuidanceReplayCopy(recorded: SliceState, revision: 866 | 1039, chronicleLength: 1127 | 1301): SliceState {
  const diff = PALE_EMPEROR_GUIDANCE_REPLAY_DIFF;
  expect(recorded.revision).toBe(revision);
  expect(recorded.chronicle).toHaveLength(chronicleLength);
  expect(recorded.chronicle.filter(e => e.id === diff.id)).toHaveLength(1);
  sameCaptureValue(recorded.chronicle[diff.index], { id: diff.id, week: diff.week, title: diff.title, text: diff.historicalText });
  const guidance = recorded.paleEmperor.acquisitionJournal[0];
  expect(guidance?.revision).toBe(diff.inputRevision); expect(guidance?.week).toBe(diff.week);
  sameCaptureValue(guidance?.command, { type: 'LEARN_GUIDANCE' });
  expect(recorded.paleEmperor.sourceScene?.revision).toBe(diff.inputRevision);
  return structuredClone(recorded);
}
/** Only the current execution of the one actual 120p guidance boundary. */
export function currentPaleEmperorGuidanceBoundaryExpected(recorded: SliceState): SliceState {
  const diff = PALE_EMPEROR_GUIDANCE_REPLAY_DIFF;
  const expected = checkedPaleEmperorGuidanceReplayCopy(recorded, 866, 1127);
  sameCaptureValue(recorded.lastResult, recorded.chronicle[diff.index]);
  expected.chronicle[diff.index]!.text = diff.currentText;
  expected.lastResult = structuredClone(expected.chronicle[diff.index]!);
  return expected;
}
/** Only the end of executing all 1038 unchanged capture commands today. */
export function currentPaleEmperorFullReplayExpected(recorded: SliceState): SliceState {
  const diff = PALE_EMPEROR_GUIDANCE_REPLAY_DIFF;
  const expected = checkedPaleEmperorGuidanceReplayCopy(recorded, 1039, 1301);
  expect(recorded.lastResult?.id).not.toBe(diff.id);
  sameCaptureValue(recorded.lastResult, recorded.chronicle.at(-1));
  expected.chronicle[diff.index]!.text = diff.currentText;
  return expected;
}
/** Other single-step boundaries start from their own original before-state;
 * their existing old guidance entry is never rewritten by current execution. */
export function expectedPaleEmperorBoundaryReplay(save: ReturnType<typeof boundaryFile>): SliceState {
  if (save.intent.type !== 'PALE_EMPEROR' || save.intent.command.type !== 'LEARN_GUIDANCE') return save.final;
  const diff = PALE_EMPEROR_GUIDANCE_REPLAY_DIFF;
  expect(save.count).toBe(diff.inputRevision); expect(save.before.revision).toBe(diff.inputRevision);
  expect(save.before.chronicle).toHaveLength(diff.index);
  expect(save.before.paleEmperor.guidanceKnown).toBe(false);
  sameCaptureValue(save.intent, { type: 'PALE_EMPEROR', command: { type: 'LEARN_GUIDANCE' } });
  return currentPaleEmperorGuidanceBoundaryExpected(save.final);
}

export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > PALE_EMPEROR_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), expectedPaleEmperorBoundaryReplay(save));
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting, era: s.ferryman.era });

/** Current-era costs and bodily continuity are checked on each actual command.
 * ERA_CARE marks wounds; only a later paid ERA_REST can remove them. */
export function assertEraTransition(before: SliceState, intent: SliceIntent, after: SliceState): void {
  if (intent.type !== 'FERRYMAN') return;
  const type = intent.command.type;
  sameCaptureValue(after.random, before.random);
  if (type === 'ERA_WORK') {
    expect(after.cash).toBe(before.cash + 24); expect(after.actionsRemaining).toBe(Math.max(0, before.actionsRemaining - 1));
    expect(after.ferryman.era.works).toBe(before.ferryman.era.works + 1); expect(after.ferryman.era.income).toBe(before.ferryman.era.income + 24);
    if (before.actionsRemaining === 0) {
      expect(before.cash).toBeLessThan(24); expect(before.ferryman.era.emergencyWorkUsed).toBe(false);
      expect(after.ferryman.era.emergencyWorks).toBe(before.ferryman.era.emergencyWorks + 1);
    }
  } else if (type === 'ERA_REST') {
    expect(after.cash).toBe(before.cash - 8); expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(after.health).toBe(Math.min(100, before.health + 5)); expect(after.mind).toBe(Math.min(100, before.mind + 8));
    expect(after.spirituality).toBe(Math.min(120, before.spirituality + 10)); expect(after.seer.pollution).toBe(Math.max(0, before.seer.pollution - 4));
    sameCaptureValue(after.injuries, before.injuries.filter(i => !(after.health >= 80 && i.acquiredRevision < after.revision &&
      (i.severity === 'LIGHT' || i.treatedRevision !== null && i.treatedRevision < after.revision))));
  } else if (type === 'ERA_CARE') {
    expect(after.cash).toBe(before.cash - 60); expect(after.actionsRemaining).toBe(before.actionsRemaining - 1); expect(after.injuryRisk).toBe(before.injuryRisk);
    sameCaptureValue(after.injuries, before.injuries.map(i => ({ ...i, treatedRevision: i.severity === 'HEAVY' && i.treatedRevision === null ? after.revision : i.treatedRevision })));
  } else if (type === 'ERA_NEXT_WEEK') {
    expect(before.actionsRemaining).toBe(0); expect(after.cash).toBe(before.cash - 24); expect(after.actionsRemaining).toBe(4);
    expect(after.week).toBe(before.week + 1); sameCaptureValue(after.date, addGameDays(before.date, 7));
  } else {
    expect(type).toBe('ERA_ENTER'); expect(after.cash).toBe(before.cash); expect(after.actionsRemaining).toBe(before.actionsRemaining);
    expect(after.ferryman.era.travelledMetres).toBe(before.ferryman.era.travelledMetres + 12);
    expect(after.ferryman.era.elapsedSeconds).toBe(before.ferryman.era.elapsedSeconds + 12);
  }
  if (type !== 'ERA_REST') {
    expect([after.health, after.mind, after.spirituality, after.seer.pollution]).toEqual([before.health, before.mind, before.spirituality, before.seer.pollution]);
    if (type !== 'ERA_CARE') { sameCaptureValue(after.injuries, before.injuries); expect(after.injuryRisk).toBe(before.injuryRisk); }
  }
  if (type !== 'ERA_NEXT_WEEK') { expect(after.week).toBe(before.week); sameCaptureValue(after.date, before.date); }
}

// The complete immutable prefix and actual continuation run on their own budget.
// Never replace the 815-command prefix, shorten replay, or raise a global timeout.
export const FULL_CAPTURE_REPLAY_TIMEOUT = Math.max(300_000, captureCommands.length * 400);
export const CAPTURE_BOUNDARY_TIMEOUT = 60_000;
