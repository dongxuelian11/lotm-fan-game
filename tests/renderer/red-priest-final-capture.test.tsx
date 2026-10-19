/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { createVisionaryState, projectVisionary } from '../../src/domain/visionary/index.js';
import { createPerfecterState, projectPerfecter } from '../../src/domain/perfecter/index.js';
import { createMoonState, projectMoon } from '../../src/domain/moon/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { RedPriestPanel } from '../../src/renderer/RedPriestPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Actual immutable 1051-command capture. Only the final snapshot is migrated and
// projected once; no producer, replay, RNG draw, state repair or save mutation.
// An explicit local path is useful before the public fixture bundle is restored.
const FILE = process.env.RED_PRIEST_FINAL_UI_FIXTURE
  ?? 'tests/fixtures/red-priest-v02090/planned/natural.json';
const FINAL_SHA = '6a308acd1cee397f8666ae2a2715723f075d7b86c0c700b56ee7b7a569b3970c';
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const fileDigest = () => createHash('sha256').update(readFileSync(FILE)).digest('hex');
// Review additions here explicitly if a future format adds a default root. Never
// normalize away an old field or infer an allowed default from migrated output.
const NEW_DEFAULT_ROOTS: Pick<SliceState, 'visionary' | 'perfecter' | 'moon'> = {
  visionary: createVisionaryState(), perfecter: createPerfecterState(), moon: createMoonState(),
};
let raw: SliceState, current: SliceState, publicState: SliceProjection;
let originalFileSha: string, originalCurrentSha: string, originalPublicSha: string;

function assertCurrentMigration(state: SliceState = current): void {
  expect([raw.schemaVersion, raw.contentVersion]).toEqual([206, 'red-priest-v206']);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(Object.keys(state).sort()).toEqual([...Object.keys(raw), ...Object.keys(NEW_DEFAULT_ROOTS)].sort());
  for (const [key, value] of Object.entries(NEW_DEFAULT_ROOTS)) {
    expect(Object.hasOwn(raw, key), `New root ${key} cannot replace an old field`).toBe(false);
    expect(state[key as keyof SliceState], `Explicit default ${key}`).toStrictEqual(value);
  }
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'schemaVersion' && key !== 'contentVersion') {
      expect(digest(state[key as keyof SliceState]), `Historical field ${key}`).toBe(digest(value));
    }
  }
  expect(digest(raw), 'Migration cannot rewrite the captured input').toBe(FINAL_SHA);
}

function assertInactiveCurrentChapters(state: SliceProjection): void {
  const expected = {
    visionary: projectPlayerText(projectVisionary(current), current.character.name),
    perfecter: projectPlayerText(projectPerfecter(current), current.character.name),
    moon: projectPlayerText(projectMoon(current), current.character.name),
  };
  for (const key of ['visionary', 'perfecter', 'moon'] as const) {
    const root = state[key];
    expect(Object.hasOwn(state, key)).toBe(true);
    expect(root).toStrictEqual(expected[key]);
    expect(Object.keys(root).sort()).toEqual(['title', 'guidanceKnown', 'promoted', 'story', 'nextStep',
      'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase'].sort());
    expect(root.guidanceKnown).toBe(false); expect(root.promoted).toBe(false); expect(root.insideCase).toBe(false);
    expect(root.abilities).toEqual([]); expect(root.sections).toEqual([]);
    expect(root.actions.every(action => !action.enabled)).toBe(true);
    assertPublicOnly(root, key);
  }
}

function assertPublicOnly(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, i) => assertPublicOnly(child, `${path}[${i}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
      'beforeDigest', 'afterDigest', 'sourceDigest', 'privateProbe'].includes(key), `${path}.${key}`).toBe(false);
    // Public resolved modifier explanations are legitimately named "source".
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/\.check\.modifiers\[\d+\]$/);
    assertPublicOnly(child, `${path}.${key}`);
  }
}

function bridge(state: SliceProjection): SliceBridge {
  // This is a read-only public boundary adapter, not an emulated SQLite commit.
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: 'desktop' as const,
      activeState: structuredClone(state), runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date,
        status: state.status, revision: state.revision, updatedAt: '2026-10-17T10:00:00Z' }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: structuredClone(state) })),
    submitIntent: vi.fn(async () => { throw new Error('Read-only final-capture UI test must not submit gameplay.'); }),
  };
}
async function loadFinal(state: SliceProjection): Promise<SliceBridge> {
  const saved = bridge(state); window.sliceGame = saved;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await screen.findByRole('region', { name: '红祭司 · 战争之后' });
  expect(saved.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  expect(saved.submitIntent).not.toHaveBeenCalled();
  return saved;
}

beforeAll(() => {
  originalFileSha = fileDigest();
  expect(readObjectEntry(FILE, 'stage')).toBe('NATURAL_RESCUE_REPORTED');
  expect(readObjectEntry(FILE, 'pendingIntent')).toBeNull();
  const commands = readObjectEntry<SliceIntent[]>(FILE, 'commands');
  expect(commands).toHaveLength(1051);
  expect(commands.at(-1)).toEqual({ type: 'RED_PRIEST', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
  raw = readObjectEntry<SliceState>(FILE, 'final'); expect(digest(raw)).toBe(FINAL_SHA);
  current = migrateSliceState(raw); // Includes the current strict saved-state gate.
  assertCurrentMigration();
  originalCurrentSha = digest(current);
  publicState = projectSliceState(current); originalPublicSha = digest(publicState);
  assertInactiveCurrentChapters(publicState);
}, 120_000);
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });
afterAll(() => {
  if (!raw || !current || !publicState) return;
  expect(fileDigest(), 'The on-disk capture is read-only').toBe(originalFileSha);
  expect(digest(raw)).toBe(FINAL_SHA);
  expect(digest(current)).toBe(originalCurrentSha);
  expect(digest(publicState)).toBe(originalPublicSha);
});

describe('Red Priest actual final capture in the renderer', () => {
  it('rejects missing, forged or altered newly added defaults and public chapters', () => {
    expect(() => assertCurrentMigration({ ...current, unexpectedRoot: null } as SliceState)).toThrow();
    for (const key of ['visionary', 'perfecter', 'moon'] as const) {
      const { [key]: _missing, ...missing } = current;
      expect(() => assertCurrentMigration(missing as SliceState)).toThrow();
      expect(() => assertCurrentMigration({ ...current, [key]: { ...current[key], guidanceKnown: true } })).toThrow();
      expect(() => assertCurrentMigration({ ...current, [key]: { ...current[key], unexpectedField: undefined } })).toThrow();
      expect(() => assertInactiveCurrentChapters({ ...publicState, [key]: { ...publicState[key], guidanceKnown: true } })).toThrow();
      expect(() => assertInactiveCurrentChapters({ ...publicState, [key]: { ...publicState[key], privateProbe: undefined } })).toThrow();
    }
  });

  it('shows genuine sequence-zero promotion and the actually used 8 versus unused 0 mastery', async () => {
    expect(current).toMatchObject({ status: 'ACTIVE', revision: 1052, week: 353,
      progression: { pathwayId: 'hunter', sequence: 0 }, redPriest: { promotionWeek: 341, materials: { status: 'ASCENDED' } } });
    expect(publicState.redPriest.promoted).toBe(true);
    expect(publicState.redPriest.risk).toBe('战事会耗尽原军团、国库和补给，并留下伤亡与居民迁离。服药失败可能造成重伤、污染、失控或死亡；原件不能无条件找回。');
    expect(Object.fromEntries(publicState.redPriest.abilities.map(a => [a.id, a.mastery]))).toEqual(raw.progression.mastery);
    const onCommand = vi.fn();
    render(<RedPriestPanel value={publicState.redPriest} busy={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '同袍战旌 · 熟练 8' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '赤焰界限 · 熟练 0' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '火焰操控 · 熟练 0' })).toBeTruthy();
    for (const action of publicState.redPriest.actions) {
      expect(['CONSUME', 'STABILIZE_PROMOTION', 'START_EPILOGUE', 'START_PREPARED_EPILOGUE']).not.toContain(action.command.type);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('retains the actual untreated injury, paid resource consequences, casualties and exact remaining action costs', async () => {
    expect(current).toMatchObject({ health: 70, mind: 80, spirituality: 112, cash: 0, actionsRemaining: 0, injuryRisk: 2 });
    expect(current.injuries).toEqual([{ id: 'R209:hunter-rebuild-natural:1050:fire-injury',
      severity: 'HEAVY', acquiredRevision: 1050, treatedRevision: null }]);
    expect(current.redPriest.epilogue).toMatchObject({ status: 'WITHDRAWN', personnel: 6, killed: 1,
      wounded: 0, returned: 5, reported: true, patients: [{ status: 'EVACUATED' }, { status: 'SHELTERED' }, { status: 'SHELTERED' }] });
    expect(publicState.redPriest.actions.map(action => action.label)).toEqual([
      '前往鲁恩联合协商处', '支付普通重伤处置', '按当前生活档休养', '度过真实七天', '停战后沿原路步行返总部',
    ]);
    const onCommand = vi.fn(), view = render(<RedPriestPanel value={publicState.redPriest} busy={false} onCommand={onCommand} />);
    expect(view.container.textContent).toContain('健康 70 · 精神 80 · 灵性 112 · 0便士 · 本周行动 0');
    const story = '停战后的原运输侧线起火；已转运原伤员1名，2名仍留在有遮蔽的原救护站。救援人数和原分队损失已经交接。';
    expect(publicState.redPriest.story).toBe(story);
    expect(screen.getByText(story)).toBeTruthy();
    expect(view.container.textContent).not.toContain('三名原伤员尚待移出');
    const rescue = screen.getByRole('region', { name: '原运输路救援' });
    expect(rescue.closest('details')).toBeNull();
    expect(rescue.textContent).toContain('已转运伤员1/3');
    expect(rescue.textContent).toContain('阵亡1，受伤0，已返队5');
    expect(rescue.textContent).toContain('救出伤员没有被自动治愈');
    await userEvent.click(screen.getByText('原物与个人账目', { selector: 'summary' }));
    const finance = screen.getByRole('region', { name: '个人生活与旧账' });
    expect(finance.textContent).toContain('未付本金94便士');
    expect(finance.textContent).toContain('当前伤势1份；重伤先以60便士普通处置，再经之后休养达到80健康');
    const more = screen.queryByText('其他可选行动', { selector: 'summary' });
    if (more) await userEvent.click(more);
    for (const action of publicState.redPriest.actions) {
      const button = screen.getByRole('button', { name: action.label }) as HTMLButtonElement;
      expect(button.disabled).toBe(!action.enabled);
      expect(button.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent))
        .toEqual([action.cost, ...(action.reason ? [action.reason] : [])]);
      if (!action.enabled) fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled();
    const clinic = publicState.redPriest.actions.find(a => a.command.type === 'CLINIC')!;
    expect(clinic).toMatchObject({ enabled: false, cost: '1行动、60便士；之后仍须休养' });
    const nextWeek = publicState.redPriest.actions.find(a => a.command.type === 'NEXT_WEEK')!;
    expect(nextWeek.enabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: nextWeek.label }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(nextWeek.command);
  });

  it('loads the real public final state and shows REPORT, never the earlier failed evacuation or old S1 round as current', async () => {
    expect(raw.lastCombatRound).not.toBeNull(); // Real inherited history must remain in the save.
    expect(raw.redPriest.epilogue!.journal.map(event => [event.command.type, event.check?.chance ?? null,
      event.check?.roll ?? null, event.check?.tier ?? null])).toEqual([
      ['COORDINATE', 74, 23, 'SUCCESS'], ['EVACUATE', 34, 99, 'GREAT_FAILURE'],
      ['WITHDRAW', null, null, null], ['REPORT', null, null, null],
    ]);
    expect(publicState.lastCheck).toBeNull();
    expect(publicState.lastResult).toEqual(raw.lastResult);
    await loadFinal(publicState);
    expect(screen.getByText(`${raw.character.name} · 红祭司 · 战争之后`)).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(within(result).getByRole('heading', { name: raw.lastResult!.title })).toBeTruthy();
    expect(result.textContent).toContain('实际救出人数、未解除的伤势及原分队损失已经交还军团登记。');
    expect(result.textContent).not.toMatch(/掷骰|检定|34%|74%|大失败/);
  });

  it('keeps actual replay data outside the public boundary without filtering user names or legitimate public words', async () => {
    expect(Object.keys(publicState.redPriest).sort()).toEqual(['title', 'guidanceKnown', 'promoted', 'story',
      'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase'].sort());
    for (const key of ['random', 'seed', 'cursor', 'source', 'frame', 'journal']) expect(Object.hasOwn(publicState, key)).toBe(false);
    assertPublicOnly({ redPriest: publicState.redPriest, lastResult: publicState.lastResult,
      lastCheck: publicState.lastCheck, lastConquerorRound: publicState.lastCombatRound?.conquerorOutcome });
    expect(JSON.stringify(publicState)).not.toContain(raw.random.seed);
    expect(JSON.stringify(publicState)).not.toContain(raw.redPriest.source!.historyDigest);
    // Only this display-boundary control substitutes a name in a detached PUBLIC
    // copy. It is not represented as a renamed natural save or accepted command.
    const name = 'G候选·seed/cursor/source';
    const named = projectPlayerText({ ...structuredClone(publicState),
      character: { ...publicState.character, name },
      lastResult: { ...publicState.lastResult!, text: `${name}：${publicState.lastResult!.text}` },
    }, name);
    expect(named.character.name).toBe(name);
    expect(named.lastResult.text).toBe(`${name}：${publicState.lastResult!.text}`);
    await loadFinal(named);
    expect(screen.getByText(`${name} · 红祭司 · 战争之后`)).toBeTruthy();
    expect(screen.getByRole('region', { name: '最近行动结果' }).textContent).toContain(name);
    expect(named.redPriest.actions).toEqual(publicState.redPriest.actions);
  });
});
