/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import type { VisionaryAction, VisionaryCommand, VisionaryProjection } from '../../src/domain/visionary/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Genuine actual210 boundaries, not a manufactured successful save. Only the
// captured next intent can commit. This adapter tests public navigation/delivery;
// it does not claim SQLite persistence or replay the 659-command original life.
const ROOT = 'tests/fixtures/visionary-v02100';
const MANIFEST_SHA = 'f57f14ae90a9c4401ef924aad65a5ce1f1af6d08dcdb69ad5f8749327ff8c24c';
const PANEL = '序列0 空想家';
const FULL_CASE_BUDGET = 120_000;
interface Member { file: string; bytes: number; sha256: string }
interface Boundary extends Member { kind: string; commandCount: number }
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown): string => sha(stableStringify(value));
const disabled = (button: HTMLElement): boolean => (button as HTMLButtonElement).disabled;
const checkedFiles = new Map<string, string>();

function checkedFile(file: string, expected: Pick<Member, 'bytes' | 'sha256'>): string {
  const path = `${ROOT}/${file}`, bytes = readFileSync(path);
  expect(bytes.length, file).toBe(expected.bytes);
  expect(sha(bytes), file).toBe(expected.sha256);
  checkedFiles.set(path, expected.sha256);
  return path;
}

function boundaryFile(count: number): string {
  const bytes = readFileSync(`${ROOT}/manifest.json`);
  expect(sha(bytes)).toBe(MANIFEST_SHA);
  checkedFiles.set(`${ROOT}/manifest.json`, MANIFEST_SHA);
  const manifest = JSON.parse(bytes.toString('utf8')) as { format: string; files: Member[] };
  expect(manifest.format).toBe('VISIONARY210_CAPTURE_FILES_V1');
  const indexMember = manifest.files.find(member => member.file === 'boundaries.index.json')!;
  const index = JSON.parse(readFileSync(checkedFile(indexMember.file, indexMember), 'utf8')) as Boundary[];
  const candidates = index.filter(boundary => boundary.commandCount === count);
  expect(candidates).toHaveLength(1);
  const selected = candidates[0]!;
  expect(manifest.files.find(member => member.file === selected.file)).toEqual({
    file: selected.file, bytes: selected.bytes, sha256: selected.sha256,
  });
  const path = checkedFile(selected.file, selected);
  expect(readObjectEntry<number>(path, 'commandCount')).toBe(count);
  return path;
}

type HistoricalVisionaryState = Omit<SliceState, 'schemaVersion' | 'contentVersion' |
  'perfecter' | 'moon' | 'darkness' | 'whiteTower' | 'tyrant' | 'sun'> & {
    schemaVersion: 207; contentVersion: 'visionary-v207';
  };
const VISIONARY_ADDED_ROOTS = ['perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun'] as const;
function historicalVisionaryState(current: SliceState): HistoricalVisionaryState {
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  // Independently pin the complete empty additions. Unknown roots and all old
  // fields survive this detached comparison view and must match the raw hash.
  const { perfecter, moon, darkness, whiteTower, tyrant, sun, ...originalFields } = current;
  expect(perfecter).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    works: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(moon).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(darkness).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(whiteTower).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(tyrant).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    coasts: null, challenge: null, materials: null, epilogue: null, seaVoyages: [], assembly: null,
    journal: [], promotionStability: { preparations: [] },
  });
  expect(sun).toStrictEqual({
    version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
    services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
  });
  expect(tyrant).toStrictEqual(createTyrantState()); expect(sun).toStrictEqual(createSunState());
  return { ...originalFields, schemaVersion: 207, contentVersion: 'visionary-v207' };
}
function migrateCapturedVisionaryState(raw: HistoricalVisionaryState): SliceState {
  const rawHash = hash(raw);
  expect([raw.schemaVersion, raw.contentVersion]).toEqual([207, 'visionary-v207']);
  for (const key of VISIONARY_ADDED_ROOTS) expect(Object.hasOwn(raw, key)).toBe(false);
  const current = migrateSliceState(raw);
  expect(Object.keys(current).sort()).toEqual([...Object.keys(raw), ...VISIONARY_ADDED_ROOTS].sort());
  expect(hash(historicalVisionaryState(current))).toBe(rawHash);
  expect(hash(raw), 'Explicit migration cannot mutate the captured raw state').toBe(rawHash);
  assertValidSliceState(current);
  return current;
}
function capturedState(count: number, entry: 'beforeLast' | 'final' = 'final'): SliceState {
  // Stream just one state; never retain the complete before/final/public bundle.
  return migrateCapturedVisionaryState(readObjectEntry<HistoricalVisionaryState>(boundaryFile(count), entry));
}

function capturedIntent(count: number): SliceIntent {
  return readObjectEntry<SliceIntent>(boundaryFile(count), 'lastIntent');
}

function assertPublic(value: SliceProjection): void {
  const forbidden = /^(?:seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|preparedRoll|futureRoll|sourceDigest|sourceIdentityDigest|beforeDigest|afterDigest|randomReceipts)$/;
  const paths: string[] = [];
  function visit(current: unknown, path: string): void {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { current.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    for (const [key, child] of Object.entries(current)) {
      const next = `${path}.${key}`;
      if (forbidden.test(key)) paths.push(next);
      visit(child, next);
    }
  }
  visit(value, '$');
  expect(paths, 'Private stream, receipt or future-result paths in the public projection').toEqual([]);
  for (const key of ['random', 'seed', 'cursor', 'source', 'frame', 'journal']) expect(Object.hasOwn(value, key)).toBe(false);
  expect(Object.keys(value.visionary).sort()).toEqual([
    'abilities', 'actions', 'guidanceKnown', 'insideCase', 'nextStep', 'promoted', 'resources', 'risk', 'sections', 'story', 'title',
  ].sort());
  // A resolved check's modifiers.source is legitimate public prose; do not
  // mistake that property (or its historical resolved roll) for a private root.
}

function assertCapturedProjection(value: SliceProjection, count: number): void {
  assertPublic(value);
  const captured = readObjectEntry<VisionaryProjection>(boundaryFile(count), 'public');
  expect(value.visionary).toEqual(projectPlayerText(captured, value.character.name));
}

const outstandingReleases = new Set<() => void>();
function savedGame(input: SliceState, allowedIntent: SliceIntent | null = null) {
  let state = input, commits = 0, barrier: Promise<void> | null = null;
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (!allowedIntent) throw new Error('This captured save must remain read-only.');
    if (envelope.payload.type === 'CREATE') throw new Error('The captured campaign already exists.');
    expect(envelope.payload).toEqual(allowedIntent);
    expect(envelope.runId).toBe(state.runId);
    expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload);
    assertValidSliceState(next);
    const wait = barrier; barrier = null;
    if (wait) await wait;
    state = next; commits++;
    const value = projectSliceState(state); assertPublic(value);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-17T12:00:00Z', replayed: false, state: value } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit,
    holdNextSave() {
      if (barrier) throw new Error('A save is already waiting.');
      let resolve = () => {};
      barrier = new Promise<void>(done => { resolve = done; });
      const release = () => { outstandingReleases.delete(release); resolve(); };
      outstandingReleases.add(release);
      return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;

async function continueSave(game: SavedGame) {
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.state.character.name) }));
  return screen.findByRole('region', { name: PANEL });
}

async function mount(game: SavedGame) {
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => {
    const value = projectSliceState(game.state); assertPublic(value);
    return { ok: true, value };
  });
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => {
      const value = projectSliceState(game.state); assertPublic(value);
      return { ok: true, value: { mode: 'desktop', activeState: value,
        runs: [{ runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
          week: value.week, date: value.date, status: value.status, revision: value.revision,
          updatedAt: '2026-10-17T12:00:00Z' }] } };
    }), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await continueSave(game);
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(game.state.runId);
  return loadRun;
}

function assertPanel(value: SliceProjection): HTMLElement {
  const panel = screen.getByRole('region', { name: PANEL }), publicValue = value.visionary;
  const { health, mind, spirituality, cash, actionsRemaining } = publicValue.resources;
  expect(panel.textContent).toContain(`健康 ${health} · 精神 ${mind} · 灵性 ${spirituality} · ${cash} · 本周行动 ${actionsRemaining}`);
  for (const text of [publicValue.story, publicValue.nextStep, publicValue.risk]) expect(panel.textContent).toContain(playerText(text));
  for (const section of publicValue.sections.filter(section => section.id !== 'injuries')) {
    for (const line of section.lines) expect(panel.textContent).toContain(playerText(line));
  }
  const injuries = within(panel).getByRole('region', { name: '原有伤势' });
  expect(injuries.textContent).toContain(`伤势风险 ${value.injuryRisk}`);
  expect(within(injuries).queryAllByRole('listitem')).toHaveLength(value.injuries.length);
  value.injuries.forEach((injury, index) => expect(injuries.textContent).toContain(
    `${index + 1}. ${injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · ${injury.treatedRevision === null ? '未处理' : '已处理'}`));
  expect(screen.getByText(`${value.character.name} · ${PANEL}`)).toBeTruthy();
  for (const name of ['作家成长', '洞察者', '有限复起待决选择']) expect(screen.queryByRole('region', { name })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/audience-rebuild-first|preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter|sourceDigest/);
  return panel;
}

async function control(value: VisionaryProjection, command: VisionaryCommand): Promise<{ action: VisionaryAction; button: HTMLElement }> {
  const matches = value.actions.filter(action => JSON.stringify(action.command) === JSON.stringify(command));
  expect(matches).toHaveLength(1);
  const action = matches[0]!, panel = screen.getByRole('region', { name: PANEL });
  let button = within(panel).queryByRole('button', { name: action.label });
  if (!button) {
    await userEvent.click(within(panel).getByText('其他可选行动', { selector: 'summary' }));
    button = within(panel).getByRole('button', { name: action.label });
  }
  expect(disabled(button)).toBe(!action.enabled);
  expect((button.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent))
    .toEqual([action.cost, ...(action.reason ? [action.reason] : [])]);
  return { action, button };
}

function assertRescuedAndInjured(state: SliceState, value: SliceProjection): void {
  expect(state).toMatchObject({ revision: expect.any(Number), status: 'ACTIVE', week: 213,
    health: 90, mind: 78, spirituality: 98, cash: 1700, actionsRemaining: 0, injuryRisk: 1,
    progression: { pathwayId: 'audience', sequence: 0 } });
  expect(state.injuries).toEqual([{ id: 'R210:audience-rebuild-natural:831:relay-injury',
    severity: 'LIGHT', acquiredRevision: 831, treatedRevision: null }]);
  const rescue = state.visionary.epilogue!, origin = state.visionary.era!.epilogueOrigin;
  expect(rescue).toMatchObject({ status: 'RESOLVED', routeDamage: 35, supportActive: false, guidanceActive: false,
    rescueInjuries: ['R210:audience-rebuild-natural:831:era-rescuer-oswin:strain'] });
  expect(rescue.patients).toEqual(origin.patients.map(({ id, injury }) => ({ id, injury, status: 'EVACUATED' })));
  expect(rescue.patients).toHaveLength(2);
  const panel = assertPanel(value), result = within(panel).getByRole('region', { name: '原失联站的有限救援' });
  expect(result.closest('details')).toBeNull();
  expect(result.textContent).toContain('已转运2/2名原伤员；原结构损坏35');
  for (const patient of origin.patients) expect(result.textContent).toContain(`${patient.injury}：已搬到原安全站。`);
  expect(result.textContent).toContain('救出者仍保留原伤');
  expect(result.textContent).not.toContain('仍在原遮蔽救护区');
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(async () => {
  await act(async () => { for (const release of outstandingReleases) release(); });
  cleanup(); delete window.sliceGame;
  // Drop mock implementations and their campaign/projection closures, including
  // failed assertions; do not retain fixture trees in beforeAll or mock defaults.
  vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  for (const [path, expected] of checkedFiles) expect(sha(readFileSync(path)), 'Captured bytes remain unchanged').toBe(expected);
  checkedFiles.clear();
});

describe('Visionary raw207 exact current-root adapter', () => {
  it('retains the genuine boundary660 hash and rejects altered, smuggled or unknown roots', () => {
    const path = `${ROOT}/boundary-660-learn_guidance.json`;
    const expected = '11268eb866d0842a91ca20fe2d2c7f032352050bcd39484231effc05260fb632';
    expect(sha(readFileSync(path))).toBe(expected); checkedFiles.set(path, expected);
    const raw = readObjectEntry<HistoricalVisionaryState>(path, 'beforeLast'), rawHash = hash(raw);
    const current = migrateCapturedVisionaryState(raw), currentHash = hash(current);
    expect(hash(historicalVisionaryState(current))).toBe(rawHash);
    for (const root of VISIONARY_ADDED_ROOTS) {
      expect(() => historicalVisionaryState({ ...current, [root]: { ...current[root], guidanceKnown: true } })).toThrow();
      expect(() => historicalVisionaryState({ ...current, [root]: { ...current[root], unexpected: undefined } })).toThrow();
      const missing = { ...current }; Reflect.deleteProperty(missing, root);
      expect(() => historicalVisionaryState(missing)).toThrow();
      expect(() => migrateCapturedVisionaryState({ ...raw, [root]: current[root] })).toThrow();
    }
    expect(() => migrateCapturedVisionaryState({ ...raw, unexpectedRoot: null } as HistoricalVisionaryState)).toThrow();
    expect(hash(historicalVisionaryState({ ...current, unexpectedRoot: null } as SliceState))).not.toBe(rawHash);
    expect(hash(historicalVisionaryState({ ...current, cash: current.cash + 1 }))).not.toBe(rawHash);
    expect(hash(raw)).toBe(rawHash); expect(hash(current)).toBe(currentHash);
  }, FULL_CASE_BUDGET);
});

describe('Visionary actual210 final capture in the public renderer', () => {
  it('commits the captured promotion, immediately owns the S0 page and reopens that exact acknowledged save', async () => {
    const expectedHash = hash(capturedState(820)), intent = capturedIntent(820);
    const before = capturedState(820, 'beforeLast'), beforeHash = hash(before), oldMastery = { ...before.progression.mastery };
    const game = savedGame(before, intent), loadRun = await mount(game);
    expect(intent).toEqual({ type: 'VISIONARY', command: { type: 'CONSUME', compoundId: 'visionary-compound-1', confirmed: true } });
    const initial = projectSliceState(before); assertCapturedProjection(initial, 819); assertPanel(initial);
    expect(initial.visionary.promoted).toBe(false);
    if (intent.type !== 'VISIONARY') throw new Error('Expected the captured public Visionary intent.');
    const consume = await control(initial.visionary, intent.command);
    expect(consume.action.enabled).toBe(true);
    await userEvent.click(consume.button);
    const dialog = screen.getByRole('dialog', { name: '空想家服药确认' });
    expect(dialog.textContent).toContain('失败会留下实际伤势与污染，可能死亡');
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '确认服用这一份原魔药' }));
    await waitFor(() => expect(game.commits).toBe(1));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: 820, payload: intent });
    expect(hash(game.state)).toBe(expectedHash);
    expect(game.state).toMatchObject({ revision: 821, week: 210, health: 100, mind: 92, spirituality: 78,
      cash: 1796, actionsRemaining: 0, progression: { sequence: 0 }, visionary: { promotionWeek: 210 } });
    const value = projectSliceState(game.state); assertCapturedProjection(value, 820); assertPanel(value);
    expect(value.visionary.promoted).toBe(true);
    expect(value.lastCheck).toMatchObject({ chance: 70, roll: 67, tier: 'SUCCESS' });
    for (const [ability, mastery] of Object.entries(oldMastery)) expect(game.state.progression.mastery[ability]).toBe(mastery);
    expect(value.visionary.actions.some(action => ['CONSUME', 'STABILIZE_PROMOTION'].includes(action.command.type))).toBe(false);
    expect(screen.queryByRole('dialog', { name: '空想家服药确认' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await continueSave(game); assertPanel(value);
    expect(loadRun).toHaveBeenCalledTimes(2);
    expect(hash(game.state)).toBe(expectedHash); expect(hash(before)).toBe(beforeHash);
    expect(game.submit).toHaveBeenCalledTimes(1);
  }, FULL_CASE_BUDGET);

  it('shows the real failed support roll and lawful modifier prose, then the captured guide success without rerolling either skill', async () => {
    const expectedHash = hash(capturedState(831)), intent = capturedIntent(831);
    const before = capturedState(830), beforeHash = hash(before), game = savedGame(before, intent);
    await mount(game);
    const failed = projectSliceState(before); assertCapturedProjection(failed, 830); assertPanel(failed);
    expect(failed.lastCheck).toMatchObject({ chance: 70, roll: 86, tier: 'FAILURE',
      modifiers: [{ source: '本人本次有限施术', value: 23 }] });
    const recent = screen.getByRole('region', { name: '最近行动结果' });
    expect(recent.textContent).toContain('本次成功率 70%，实际掷骰 86');
    expect(recent.textContent).toContain('本人本次有限施术 +23');
    expect(before.visionary.epilogue).toMatchObject({ routeDamage: 35, supportActive: false });
    expect(before.injuries).toHaveLength(1);
    const repeatSupport = await control(failed.visionary, { type: 'EPILOGUE', command: { type: 'SUPPORT_STRUCTURE' } });
    expect(repeatSupport.action.enabled).toBe(false); fireEvent.click(repeatSupport.button);
    expect(game.submit).not.toHaveBeenCalled();
    if (intent.type !== 'VISIONARY') throw new Error('Expected the captured public Visionary intent.');
    const guide = await control(failed.visionary, intent.command);
    await userEvent.click(guide.button);
    await waitFor(() => expect(game.commits).toBe(1));
    expect(hash(game.state)).toBe(expectedHash);
    const guided = projectSliceState(game.state); assertCapturedProjection(guided, 831); assertPanel(guided);
    expect(guided.lastCheck).toMatchObject({ chance: 70, roll: 29, tier: 'SUCCESS',
      modifiers: [{ source: '本人本次有限施术', value: 23 }] });
    expect(game.state).toMatchObject({ health: 90, mind: 78, spirituality: 98, cash: 1700, actionsRemaining: 1, injuryRisk: 1 });
    expect(game.state.injuries).toEqual(before.injuries);
    expect(game.state.visionary.epilogue!.rescueInjuries).toEqual(before.visionary.epilogue!.rescueInjuries);
    expect(game.state.visionary.epilogue!.journal.filter(event => event.check).map(event => event.check!.roll)).toEqual([86, 29]);
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await continueSave(game); assertPanel(guided);
    for (const type of ['SUPPORT_STRUCTURE', 'GUIDE_RESCUER'] as const) {
      const repeated = await control(guided.visionary, { type: 'EPILOGUE', command: { type } });
      expect(repeated.action.enabled).toBe(false); fireEvent.click(repeated.button);
    }
    expect(screen.getByRole('region', { name: '最近行动结果' }).textContent).toContain('实际掷骰 29');
    expect(game.submit).toHaveBeenCalledTimes(1); expect(hash(game.state)).toBe(expectedHash); expect(hash(before)).toBe(beforeHash);
  }, FULL_CASE_BUDGET);

  it('keeps the actual two-patient report pending until acknowledgement, blocks duplicate reports and reopens the final consequences', async () => {
    const expectedHash = hash(capturedState(833)), intent = capturedIntent(833);
    const before = capturedState(832), beforeHash = hash(before), game = savedGame(before, intent);
    const release = game.holdNextSave(); await mount(game);
    const pending = projectSliceState(before); assertCapturedProjection(pending, 832); assertRescuedAndInjured(before, pending);
    expect(before.visionary.epilogue!.reported).toBe(false);
    if (intent.type !== 'VISIONARY') throw new Error('Expected the captured public Visionary intent.');
    const report = await control(pending.visionary, intent.command), panelText = assertPanel(pending).textContent;
    expect(report.action).toMatchObject({ enabled: true, cost: '0行动；只记录真实应用与结果' });
    fireEvent.click(report.button); fireEvent.click(report.button);
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: 833, payload: intent });
    expect(game.commits).toBe(0); expect(hash(game.state)).toBe(beforeHash);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toBe(panelText);
    for (const button of screen.getAllByRole('button')) { expect(disabled(button)).toBe(true); fireEvent.click(button); }
    expect(game.submit).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
    await waitFor(() => expect(game.commits).toBe(1));
    expect(hash(game.state)).toBe(expectedHash);
    const final = projectSliceState(game.state); assertCapturedProjection(final, 833); assertRescuedAndInjured(game.state, final);
    expect(game.state.visionary.epilogue!.reported).toBe(true);
    expect(final.lastCheck).toBeNull();
    const recent = screen.getByRole('region', { name: '最近行动结果' });
    expect(recent.textContent).toContain(playerText(game.state.lastResult!.text));
    expect(recent.textContent).not.toMatch(/实际掷骰|86|29|支撑失败/);
    expect(final.visionary.actions.some(action => action.command.type === 'EPILOGUE')).toBe(false);
    expect(screen.queryByRole('button', { name: report.action.label })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await continueSave(game); assertRescuedAndInjured(game.state, final);
    expect(screen.queryByRole('button', { name: report.action.label })).toBeNull();
    expect(hash(game.state)).toBe(expectedHash); expect(hash(before)).toBe(beforeHash); expect(game.submit).toHaveBeenCalledTimes(1);
  }, FULL_CASE_BUDGET);

  it('loads the genuine 833-command final with 5/10 practiced skills and every original mastery unchanged', async () => {
    const state = capturedState(833), originalHash = hash(state), game = savedGame(state);
    expect(state.revision).toBe(834);
    expect(state.visionary.journal).toHaveLength(173); // 174 new commands include the guidance start.
    expect(state.visionary.source!.revision).toBe(660); // The original 659 commands.
    expect(state.lastCombatRound?.discernerOutcome).toBeTruthy();
    await mount(game);
    const value = projectSliceState(state); assertCapturedProjection(value, 833); assertRescuedAndInjured(state, value);
    const original = state.visionary.source!.budget.mastery;
    expect(Object.keys(original)).toHaveLength(25);
    expect(value.visionary.abilities).toHaveLength(27);
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    for (const ability of value.visionary.abilities) {
      expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
      if (Object.hasOwn(original, ability.id)) expect(ability.mastery, ability.id).toBe(original[ability.id]);
    }
    expect(screen.getByRole('heading', { name: '有限空想支撑 · 熟练 5' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '待行心灵引导 · 熟练 10' })).toBeTruthy();
    expect(value.visionary.abilities.filter(ability => Object.hasOwn(original, ability.id) && ability.mastery === 0)).toHaveLength(9);
    expect(state.visionary.epilogue!.journal.map(event => [event.command.type, event.check?.roll ?? null])).toEqual([
      ['OBSERVE', null], ['SUPPORT_STRUCTURE', 86], ['GUIDE_RESCUER', 29], ['EVACUATE', null], ['REPORT', null],
    ]);
    expect(game.submit).not.toHaveBeenCalled(); expect(hash(game.state)).toBe(originalHash);
  }, FULL_CASE_BUDGET);

  it('opens and closes real optional actions and reloads the final page without spending resources or offering repeat rescue/promotion', async () => {
    const state = capturedState(833), originalHash = hash(state), game = savedGame(state);
    const loadRun = await mount(game), value = projectSliceState(state);
    assertCapturedProjection(value, 833); assertRescuedAndInjured(state, value);
    const panel = screen.getByRole('region', { name: PANEL });
    const optional = within(panel).getByText('其他可选行动', { selector: 'summary' });
    await userEvent.click(optional);
    expect((optional.parentElement as HTMLDetailsElement).open).toBe(true);
    for (const action of value.visionary.actions) {
      expect(['LEARN_GUIDANCE', 'CONSUME', 'STABILIZE_PROMOTION', 'START_EPILOGUE', 'EPILOGUE']).not.toContain(action.command.type);
      const { button } = await control(value.visionary, action.command);
      if (!action.enabled) fireEvent.click(button);
    }
    expect(value.visionary.actions.filter(action => action.enabled).map(action => action.command)).toEqual([{ type: 'NEXT_WEEK' }]);
    await userEvent.click(optional);
    expect((optional.parentElement as HTMLDetailsElement).open).toBe(false);
    await userEvent.click(optional);
    expect((optional.parentElement as HTMLDetailsElement).open).toBe(true);
    assertRescuedAndInjured(state, value);
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await continueSave(game); assertRescuedAndInjured(state, value);
    expect(loadRun).toHaveBeenCalledTimes(2);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0); expect(hash(game.state)).toBe(originalHash);
  }, FULL_CASE_BUDGET);
});
