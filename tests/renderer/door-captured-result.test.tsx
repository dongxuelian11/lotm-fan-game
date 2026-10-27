/* @vitest-environment jsdom */
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  FILE_PINS, MANIFEST, MANIFEST_SHA, ROOT, assertCapturedGlobal, assertGlobalPublic, assertPublicOnly, filePin, hash, readActionAt,
  type Action, type FilePin,
} from '../helpers/door-capture.js';

/** Actual natural218 public captures only. This adapter proves presentation,
 * identical retries and UI reopen, not SQLite persistence or a new playthrough.
 * No scenario builder, runtime session, RNG control or repaired projections. */
const ESCAPE = 'door.s0.bounded-conceptual-escape', SEAL = 'door.s0.single-exit-seal';
const INHERITED = {
  "door.s9.door-opening": 78,
  "door.s8.tricks": 45,
  "door.s7.astrology": 66,
  "door.s7.divination-interference": 8,
  "door.s6.recording": 8,
  "door.s6.release": 8,
  "door.s5.travel": 46,
  "door.s5.invisible-hand": 0,
  "door.s4.space-hiding": 0,
  "door.s4.space-pocket": 0,
  "door.s4.banishment": 0,
  "door.s3.star-wandering": 0,
  "door.s3.astral-positioning": 0,
  "door.s2.symbolic-transit": 8,
  "door.s2.pattern-reproduction": 0,
  "door.s1.endpoint-location": 8,
  "door.s1.anchor-maintenance": 0
} as const;
const checkedFiles = new Map<string, FilePin>();
const disabled = (button: HTMLElement): boolean => (button as HTMLButtonElement).disabled;
function captured(count: number) {
  const action = readActionAt(count), path = join(ROOT, `action-${count}.json.gz`);
  const pin = filePin(path); expect(pin).toEqual(FILE_PINS[`action-${count}.json.gz`]);
  checkedFiles.set(path, pin);
  const before = action.globalPublicBefore, value = action.globalPublic;
  assertCapturedGlobal(before, action, 'before'); assertCapturedGlobal(value, action, 'after');
  assertGlobalPublic(before, action.beforeLast); assertGlobalPublic(value, action.final);
  expect(value.character.name).toBe('伊莲');
  expect(value.character).toEqual(before.character);
  return { action, before, value };
}
function assertCaptureUntouched(action: Action) {
  expect(hash(action.beforeLast)).toBe(action.audit.beforeStateSha256);
  expect(hash(action.final)).toBe(action.audit.afterStateSha256);
  expect(hash(action.globalPublicBefore)).toBe(action.audit.globalPublicBeforeSha256);
  expect(hash(action.globalPublic)).toBe(action.audit.globalPublicAfterSha256);
}
interface Transition { intent: SliceIntent; after: SliceProjection; responseLost?: boolean; responseGate?: Promise<void> }
function publicAdapter(initial: SliceProjection) {
  let current = initial, transition: Transition | null = null, commits = 0;
  let pending: SliceEnvelope | null = null, saved: SliceReceipt | null = null;
  // mockImplementation permits resetAllMocks to release the captured closures.
  // Only one pending public transition is retained, never a private capture.
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current), runs: [{ runId: current.runId,
      name: current.character.name, portraitId: current.character.portraitId, week: current.week,
      date: current.date, status: current.status, revision: current.revision, updatedAt: '2026-10-18T08:00:00Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(current.runId); return { ok: true, value: structuredClone(current) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (pending) {
      expect(envelope).toEqual(pending);
      if (!saved) throw new Error('The lost response has no saved public receipt.');
      pending = null;
      return { ok: true, value: { ...structuredClone(saved), replayed: true } };
    }
    if (!transition) throw new Error('No captured public transition was supplied.');
    const next = transition, before = current;
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: next.intent });
    expect(next.after.revision).toBe(before.revision + 1);
    saved = { intentId: envelope.intentId, runId: before.runId, previousRevision: before.revision,
      newRevision: next.after.revision, committedAt: '2026-10-18T08:01:00Z', replayed: false,
      state: structuredClone(next.after) };
    current = next.after; transition = null; commits++;
    if (next.responseLost) {
      pending = structuredClone(envelope);
      await next.responseGate;
      return { ok: false, error: { code: 'RESPONSE_LOST', message: '保存回执未收到', retryable: true } };
    }
    return { ok: true, value: structuredClone(saved) };
  });
  return { bridge: { getBootstrap, loadRun, submitIntent },
    queue(next: Transition) {
      expect(transition).toBeNull(); expect(pending).toBeNull(); transition = next;
    },
    get current() { return current; }, get commits() { return commits; },
  };
}
type PublicAdapter = ReturnType<typeof publicAdapter>;
async function openPage(game: PublicAdapter) {
  const loads = game.bridge.loadRun.mock.calls.length;
  window.sliceGame = game.bridge;
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  await screen.findByRole('region', { name: game.current.door.title });
  expect(game.bridge.loadRun).toHaveBeenCalledTimes(loads + 1);
  expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId);
  return view;
}
function assertPage(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: value.door.title });
  const r = value.door.resources, topbar = screen.getByRole('button', { name: '返回主菜单' }).closest('header');
  expect(topbar?.textContent).toContain(`${value.character.name} · ${value.door.title}`);
  expect(topbar?.textContent).toContain(`第 ${value.week} 周`);
  expect(panel.textContent).toContain(`健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind} · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, actionsRemaining: value.actionsRemaining, weeklyBudget: value.weeklyBudget });
  expect(panel.textContent).toContain(value.door.story);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.door.nextStep);
  for (const section of value.door.sections.filter(item => ['clock', 'body', 'epilogue'].includes(item.id))) {
    const visible = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(visible.textContent).toContain(line);
  }
  const injuries = within(panel).getByRole('region', { name: '当前伤势' });
  expect(injuries.textContent).toContain(`伤势风险 ${value.injuryRisk}`);
  expect(value.injuries).toEqual([]); expect(injuries.textContent).toContain('当前没有伤势。');
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '星之匙成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
  expect(panel.textContent).not.toMatch(/原创|G\d+|NEW218|randomCursor|sourceDigest|seed|cursor/);
  assertPublicOnly({ renderedText: document.body.textContent }, state);
  return panel;
}
async function assertAbilities(value: SliceProjection, escape: number, seal: number) {
  const panel = screen.getByRole('region', { name: value.door.title });
  const summary = within(panel).getByText('能力与掌握', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  expect(Object.values(INHERITED).filter(mastery => mastery === 0)).toHaveLength(8);
  const expected = { ...INHERITED, [ESCAPE]: escape, [SEAL]: seal };
  expect(value.progression.mastery).toEqual(expected);
  expect(Object.fromEntries(value.door.abilities.map(ability => [ability.id, ability.mastery]))).toEqual(expected);
  expect(value.door.abilities).toHaveLength(19);
  for (const ability of value.door.abilities)
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
}
async function actionButton(value: SliceProjection, intent: SliceIntent) {
  if (intent.type !== 'DOOR') throw new Error('Expected an actual captured Door command.');
  const action = value.door.actions.find(item => hash(item.command) === hash(intent.command));
  if (!action) throw new Error('The captured command is absent from its public predecessor.');
  expect(action.enabled).toBe(true); expect(action.preferredAction).toBe(true);
  const panel = screen.getByRole('region', { name: value.door.title });
  let button = within(panel).queryByRole('button', { name: action.label });
  if (!button) {
    const summary = within(panel).getByText('其他可选行动', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    button = within(panel).getByRole('button', { name: action.label });
  }
  expect(disabled(button)).toBe(false);
  const descriptions = button.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent);
  expect(descriptions).toEqual([action.cost]);
  return button;
}
async function settled(value: SliceProjection, state: SliceState) {
  await waitFor(() => {
    const panel = assertPage(value, state);
    expect(panel.getAttribute('aria-busy')).toBe('false');
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const line of value.door.sections.find(section => section.id === 'recent-action')!.lines)
      expect(result.textContent).toContain(line);
  });
  return assertPage(value, state);
}
async function assertBridgePublic(game: PublicAdapter, state: SliceState) {
  for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun, game.bridge.submitIntent])
    for (const result of mock.mock.results) assertPublicOnly(await result.value, state);
}
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const manifest = filePin(MANIFEST), checkpoint = join(ROOT, 'checkpoint.json.gz');
  expect(manifest.sha256).toBe(MANIFEST_SHA); checkedFiles.set(MANIFEST, manifest);
  const pin = filePin(checkpoint); expect(pin).toEqual(FILE_PINS['checkpoint.json.gz']); checkedFiles.set(checkpoint, pin);
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  try {
    for (const [path, pin] of checkedFiles) expect(filePin(path), 'The immutable capture remains untouched').toEqual(pin);
  } finally { checkedFiles.clear(); }
});

describe('Door218 actual natural928 captured results', () => {
  it('cancels actual consumption916, then shows natural70% roll2 once after a pending lost response and identical retry', async () => {
    const { action, before, value } = captured(916);
    expect(action.lastIntent).toEqual({ type: 'DOOR', command: { type: 'CONSUME', compoundId: 'door-compound-1', confirmed: true } });
    expect(before.progression).toMatchObject({ pathwayId: 'door', sequence: 1 });
    expect(before.door.abilities).toHaveLength(17);
    expect(before.progression.mastery).toEqual(INHERITED);
    expect([before.health, before.mind, before.spirituality, before.maxSpirituality, before.cash, before.actionsRemaining]).toEqual([88, 92, 108, 120, 1786, 2]);
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
    const game = publicAdapter(before);
    game.queue({ intent: action.lastIntent, after: value, responseLost: true, responseGate });
    const first = await openPage(game);
    assertPage(before, action.beforeLast);
    const trigger = await actionButton(before, action.lastIntent);
    await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '门服药确认' });
    for (const text of ['70%', '30灵性', '已付费用不退还', '严重失败可能死亡']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '门服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    expect(game.current).toEqual(before);
    await userEvent.click(trigger); dialog = screen.getByRole('dialog', { name: '门服药确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(assertPage(before, action.beforeLast).getAttribute('aria-busy')).toBe('true'));
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.commits).toBe(1);
    expect(disabled(confirm)).toBe(true); expect(disabled(trigger)).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    releaseResponse();
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    assertPage(before, action.beforeLast);
    expect(disabled(trigger)).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    fireEvent.click(trigger); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    const panel = await settled(value, action.final), result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(screen.queryByRole('dialog', { name: '门服药确认' })).toBeNull();
    for (const text of ['大成功 · 意志检定', '本次成功率 70%，实际掷骰 2', '行动变化-1', '精神变化-12', '灵性变化-30']) expect(result.textContent).toContain(text);
    expect(value.lastCheck).toMatchObject({ chance: 70, roll: 2, tier: 'GREAT_SUCCESS' });
    expect(value.progression).toMatchObject({ pathwayId: 'door', sequence: 0 });
    expect(value.door.promoted).toBe(true); expect(value.status).toBe('ACTIVE');
    expect([value.health, value.mind, value.spirituality, value.maxSpirituality, value.cash, value.actionsRemaining]).toEqual([88, 80, 78, 150, 1786, 1]);
    expect(value.spirituality).toBe(before.spirituality - 30); expect(value.spirituality).toBeLessThan(value.maxSpirituality);
    await assertAbilities(value, 0, 0);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(await game.bridge.submitIntent.mock.results[1]!.value).toMatchObject({ ok: true,
      value: { replayed: true, previousRevision: 1223, newRevision: 1224 } });
    expect(game.commits).toBe(1); expect(game.current.revision).toBe(1224);
    const text = panel.textContent; first.unmount(); await openPage(game); await assertAbilities(value, 0, 0);
    expect(assertPage(value, action.final).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2); expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    await assertBridgePublic(game, action.final); assertCaptureUntouched(action);
  }, 120_000);

  it('separates actual escape923/924 and seal926/927 casts from their physical applications along all adjacent captures', async () => {
    let game: PublicAdapter | undefined, mounted: Awaited<ReturnType<typeof openPage>> | undefined;
    // Actual observation925 remains between application924 and cast926.
    // Never jump to a fabricated scene or treat a passed cast as application.
    for (const count of [923, 924, 925, 926, 927]) {
      const { action, before, value } = captured(count);
      if (!game) { game = publicAdapter(before); mounted = await openPage(game); }
      expect(hash(game.current)).toBe(action.audit.globalPublicBeforeSha256);
      assertPage(before, action.beforeLast); game.queue({ intent: action.lastIntent, after: value });
      const button = await actionButton(before, action.lastIntent);
      fireEvent.click(button); fireEvent.click(button);
      const panel = await settled(value, action.final), result = within(panel).getByRole('region', { name: '最近行动结果' });
      expect(game.commits).toBe(count - 922); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(count - 922);
      if (count === 923 || count === 926) {
        const escape = count === 923, window = escape ? action.final.door.epilogue!.escape : action.final.door.epilogue!.seal;
        expect(window).toMatchObject({ attempted: true, passed: true, applied: false });
        expect(value.lastCheck).toMatchObject({ chance: escape ? 66 : 68, roll: escape ? 45 : 64, tier: 'SUCCESS' });
        for (const text of [escape ? '尚未实际避开冲击' : '尚未抵住实际推力',
          `本次成功率 ${escape ? 66 : 68}%，实际掷骰 ${escape ? 45 : 64}`,
          `现款变化-${escape ? 8 : 6}便士`, '行动变化-1', `精神变化-${escape ? 8 : 6}`, `灵性变化-${escape ? 14 : 12}`])
          expect(result.textContent).toContain(text);
        expect(result.textContent).not.toContain('技巧掌握增8');
        expect([value.mind, value.spirituality, value.cash, value.actionsRemaining]).toEqual(escape ? [72, 64, 1748, 1] : [66, 52, 1742, 0]);
      } else {
        expect(value.lastCheck).toBeNull(); expect(result.textContent).not.toContain('实际掷骰');
        expect([value.health, value.mind, value.spirituality, value.cash, value.actionsRemaining])
          .toEqual([before.health, before.mind, before.spirituality, before.cash, before.actionsRemaining]);
      }
      if (count === 924) {
        expect(action.final.door.epilogue!.escape.applied).toBe(true);
        expect(action.final.door.epilogue!.impacts.spring.status).toBe('AVOIDED');
        for (const text of ['技巧掌握增8', '仅本人避开已指定的这一次冲击', '人和车仍在八米维修位，旧伤不变'])
          expect(result.textContent).toContain(text);
      }
      if (count === 927) {
        expect(action.final.door.epilogue!.seal.applied).toBe(true);
        expect(action.final.door.epilogue!.impacts.exit.status).toBe('HELD');
        for (const text of ['技巧掌握增8', '侧道从未被封住', '实走24米侧道', '原车仍归艾达，伤势和磨损没有恢复'])
          expect(result.textContent).toContain(text);
      }
      await assertAbilities(value, count >= 924 ? 8 : 0, count === 927 ? 8 : 0);
      if (count === 927) {
        const text = panel.textContent; mounted!.unmount(); await openPage(game); await assertAbilities(value, 8, 8);
        expect(assertPage(value, action.final).textContent).toBe(text);
        expect(game.bridge.submitIntent).toHaveBeenCalledTimes(5); expect(game.commits).toBe(5);
        await assertBridgePublic(game, action.final);
      }
      assertCaptureUntouched(action);
    }
  }, 120_000);

  it('reopens actual report928 with final paid resources, same people and objects, old damage and all19 masteries', async () => {
    const { action, before, value } = captured(928);
    expect(action.lastIntent).toEqual({ type: 'DOOR', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
    const game = publicAdapter(before); game.queue({ intent: action.lastIntent, after: value });
    const first = await openPage(game), button = await actionButton(before, action.lastIntent);
    fireEvent.click(button); fireEvent.click(button);
    const panel = await settled(value, action.final), result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(value).toMatchObject({ revision: 1236, status: 'ACTIVE', week: 229, date: { year: 1353, month: 11, day: 10 },
      health: 88, mind: 66, spirituality: 52, maxSpirituality: 150, cash: 1742, actionsRemaining: 0,
      injuries: [], injuryRisk: 0, lastCheck: null });
    for (const text of ['艾达已在棚外，健康96，原挫伤仍在', '原工具车已交还棚外的艾达，状况84',
      '原机房门状况76，手刹状况76', '仅实际处理过指定冲击的技巧增加掌握']) expect(result.textContent).toContain(text);
    expect(result.textContent).not.toContain('实际掷骰');
    expect(action.final.door.epilogue).toMatchObject({ status: 'RESOLVED', reported: true, playerMetres: 32,
      worker: { health: 96, position: 0, travelledMetres: 24, injuries: ['本次卡滞留下的手臂挫伤，尚未处理'] },
      trolley: { condition: 84, ownerId: 'DR0-SHED-ADA-WREN', holderId: 'DR0-SHED-ADA-WREN', position: 0, travelledMetres: 24 } });
    await assertAbilities(value, 8, 8);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.commits).toBe(1);
    expect(game.bridge.submitIntent.mock.calls[0]![0]).toMatchObject({ expectedRevision: 1235, payload: action.lastIntent });
    const text = panel.textContent; first.unmount(); await openPage(game); await assertAbilities(value, 8, 8);
    expect(assertPage(value, action.final).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    await assertBridgePublic(game, action.final); assertCaptureUntouched(action);
  }, 120_000);
});
