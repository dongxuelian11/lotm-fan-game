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
} from '../helpers/death-capture.js';

/** Actual natural217 public captures only. This adapter proves presentation,
 * identical retries and UI reopen, not SQLite persistence or a new playthrough.
 * No scenario builder, runtime session, RNG control or repaired projections. */
const PASSAGE = 'death.s0.partial-spirit-passage', BARRIER = 'death.s0.residual-propagation-barrier';
const INHERITED = {
  'death.s9.corpse-physique': 49, 'death.s9.spiritual-sight': 16, 'death.s9.undead-knowledge': 16,
  'death.s8.death-eye': 8, 'death.s8.spirit-contact': 0, 'death.s7.spirit-ritual': 0,
  'death.s7.spirit-communication': 74, 'death.s7.spirit-borrowing': 8, 'death.s6.spirit-recruitment': 0,
  'death.s6.dead-words': 0, 'death.s5.inner-underworld': 16, 'death.s5.underworld-door': 16,
  'death.s4.underworld-seal': 5, 'death.s3.bounded-ferry': 8, 'death.s3.departure-ward': 8,
  'death.s2.pale-flame': 8, 'death.s2.spirit-passage': 0,
  'death.s1.residual-quieting': 0, 'death.s1.spiritual-interdiction': 0,
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
  await screen.findByRole('region', { name: game.current.death.title });
  expect(game.bridge.loadRun).toHaveBeenCalledTimes(loads + 1);
  expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId);
  return view;
}
function assertPage(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: value.death.title });
  const r = value.death.resources, topbar = screen.getByRole('button', { name: '返回主菜单' }).closest('header');
  expect(topbar?.textContent).toContain(`${value.character.name} · ${value.death.title}`);
  expect(topbar?.textContent).toContain(`第 ${value.week} 周`);
  expect(panel.textContent).toContain(`健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind} · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, actionsRemaining: value.actionsRemaining, weeklyBudget: value.weeklyBudget });
  expect(panel.textContent).toContain(value.death.story);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.death.nextStep);
  for (const section of value.death.sections.filter(item => ['clock', 'body', 'epilogue'].includes(item.id))) {
    const visible = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(visible.textContent).toContain(line);
  }
  const injuries = within(panel).getByRole('region', { name: '当前伤势' });
  expect(injuries.textContent).toContain(`伤势风险 ${value.injuryRisk}`);
  expect(value.injuries).toEqual([]); expect(injuries.textContent).toContain('当前没有伤势。');
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '苍白皇帝成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
  assertPublicOnly({ renderedText: document.body.textContent }, state);
  return panel;
}
async function assertAbilities(value: SliceProjection, passage: number, barrier: number) {
  const panel = screen.getByRole('region', { name: value.death.title });
  const summary = within(panel).getByText('能力与掌握', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  expect(Object.values(INHERITED).filter(mastery => mastery === 0)).toHaveLength(7);
  const expected = { ...INHERITED, [PASSAGE]: passage, [BARRIER]: barrier };
  expect(value.progression.mastery).toEqual(expected);
  expect(Object.fromEntries(value.death.abilities.map(ability => [ability.id, ability.mastery]))).toEqual(expected);
  expect(value.death.abilities).toHaveLength(21);
  for (const ability of value.death.abilities)
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
}
async function actionButton(value: SliceProjection, intent: SliceIntent) {
  if (intent.type !== 'DEATH') throw new Error('Expected an actual captured Death command.');
  const action = value.death.actions.find(item => hash(item.command) === hash(intent.command));
  if (!action) throw new Error('The captured command is absent from its public predecessor.');
  expect(action.enabled).toBe(true); expect(action.preferredAction).toBe(true);
  const panel = screen.getByRole('region', { name: value.death.title });
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
    for (const line of value.death.sections.find(section => section.id === 'recent-action')!.lines)
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

describe('Death217 actual natural1141 captured results', () => {
  it('cancels actual consumption1128, then shows natural70% roll62 once after a pending lost response and identical retry', async () => {
    const { action, before, value } = captured(1128);
    expect(action.lastIntent).toEqual({ type: 'DEATH', command: { type: 'CONSUME', compoundId: 'death-compound-1', confirmed: true } });
    expect(before.progression).toMatchObject({ pathwayId: 'death', sequence: 1 });
    expect(before.death.abilities).toHaveLength(19);
    expect(before.progression.mastery).toEqual(INHERITED);
    expect([before.health, before.mind, before.spirituality, before.maxSpirituality, before.cash, before.actionsRemaining]).toEqual([80, 92, 108, 120, 12, 1]);
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
    const game = publicAdapter(before);
    game.queue({ intent: action.lastIntent, after: value, responseLost: true, responseGate });
    const first = await openPage(game);
    assertPage(before, action.beforeLast);
    const trigger = await actionButton(before, action.lastIntent);
    await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '死神服药确认' });
    for (const text of ['70%', '30灵性', '已付费用不退还', '严重失败可能死亡']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '死神服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    expect(game.current).toEqual(before);
    await userEvent.click(trigger); dialog = screen.getByRole('dialog', { name: '死神服药确认' });
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
    expect(screen.queryByRole('dialog', { name: '死神服药确认' })).toBeNull();
    for (const text of ['成功 · 意志检定', '本次成功率 70%，实际掷骰 62', '行动变化-1', '精神变化-12', '灵性变化-30']) expect(result.textContent).toContain(text);
    expect(value.lastCheck).toMatchObject({ chance: 70, roll: 62, tier: 'SUCCESS' });
    expect(value.progression).toMatchObject({ pathwayId: 'death', sequence: 0 });
    expect(value.death.promoted).toBe(true); expect(value.status).toBe('ACTIVE');
    expect([value.health, value.mind, value.spirituality, value.maxSpirituality, value.cash, value.actionsRemaining]).toEqual([80, 80, 78, 150, 12, 0]);
    expect(value.spirituality).toBe(before.spirituality - 30); expect(value.spirituality).toBeLessThan(value.maxSpirituality);
    await assertAbilities(value, 0, 0);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(await game.bridge.submitIntent.mock.results[1]!.value).toMatchObject({ ok: true,
      value: { replayed: true, previousRevision: 1128, newRevision: 1129 } });
    expect(game.commits).toBe(1); expect(game.current.revision).toBe(1129);
    const text = panel.textContent; first.unmount(); await openPage(game); await assertAbilities(value, 0, 0);
    expect(assertPage(value, action.final).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2); expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    await assertBridgePublic(game, action.final); assertCaptureUntouched(action);
  }, 120_000);

  it('separates actual barrier1134/1135 and passage1138/1139 casts from application along the adjacent captured sequence', async () => {
    let game: PublicAdapter | undefined, mounted: Awaited<ReturnType<typeof openPage>> | undefined;
    // Load one full action at a time. Permission1136 and survey1137 remain real
    // adjacent public transitions; there is no invented jump to the next cast.
    for (const count of [1134, 1135, 1136, 1137, 1138, 1139]) {
      const { action, before, value } = captured(count);
      if (!game) { game = publicAdapter(before); mounted = await openPage(game); }
      expect(hash(game.current)).toBe(action.audit.globalPublicBeforeSha256);
      assertPage(before, action.beforeLast);
      game.queue({ intent: action.lastIntent, after: value });
      const button = await actionButton(before, action.lastIntent);
      fireEvent.click(button); fireEvent.click(button);
      const panel = await settled(value, action.final), result = within(panel).getByRole('region', { name: '最近行动结果' });
      expect(game.commits).toBe(count - 1133); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(count - 1133);
      if (count === 1134 || count === 1138) {
        const barrier = count === 1134, window = barrier ? action.final.death.epilogue!.barrier.window : action.final.death.epilogue!.passage.window;
        expect(window).toMatchObject({ attempted: true, passed: true, applied: false });
        expect(value.lastCheck).toMatchObject({ chance: 70, roll: barrier ? 43 : 24, tier: 'SUCCESS' });
        for (const text of ['尚未应用，不增加掌握', `本次成功率 70%，实际掷骰 ${barrier ? 43 : 24}`,
          `精神变化-${barrier ? 3 : 4}`, `灵性变化-${barrier ? 8 : 10}`]) expect(result.textContent).toContain(text);
        expect([value.mind, value.spirituality]).toEqual(barrier ? [75, 70] : [71, 60]);
      } else {
        expect(value.lastCheck).toBeNull(); expect(result.textContent).not.toContain('实际掷骰');
        expect([value.health, value.mind, value.spirituality, value.cash, value.actionsRemaining])
          .toEqual([before.health, before.mind, before.spirituality, before.cash, before.actionsRemaining]);
      }
      if (count === 1135) {
        expect(action.final.death.epilogue!.barrier.window.applied).toBe(true);
        expect(result.textContent).toContain('这次真实应用增加8掌握');
        expect(panel.textContent).toContain('残余外露0、罐内3、已消散1');
      }
      if (count === 1139) {
        expect(action.final.death.epilogue!.passage.window.applied).toBe(true);
        expect(result.textContent).toContain('旧脚踝伤仍在');
        expect(panel.textContent).toContain('码头工人西蒙位于18米处，健康100，精力65');
      }
      await assertAbilities(value, count === 1139 ? 8 : 0, count >= 1135 ? 8 : 0);
      if (count === 1139) {
        const text = panel.textContent; mounted!.unmount(); await openPage(game); await assertAbilities(value, 8, 8);
        expect(assertPage(value, action.final).textContent).toBe(text);
        expect(game.bridge.submitIntent).toHaveBeenCalledTimes(6); expect(game.commits).toBe(6);
        await assertBridgePublic(game, action.final);
      }
      assertCaptureUntouched(action);
    }
  }, 120_000);

  it('reopens actual report1141 with the final paid resources, people, original damage and unchanged mastery', async () => {
    const { action, before, value } = captured(1141);
    expect(action.lastIntent).toEqual({ type: 'DEATH', command: { type: 'EPILOGUE', command: { type: 'REPORT' } } });
    const game = publicAdapter(before); game.queue({ intent: action.lastIntent, after: value });
    const first = await openPage(game), button = await actionButton(before, action.lastIntent);
    fireEvent.click(button); fireEvent.click(button);
    const panel = await settled(value, action.final), result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('不为完成报告补骰或追加掌握');
    expect(result.textContent).not.toContain('实际掷骰'); expect(value.lastCheck).toBeNull();
    expect(action.final.death.epilogue).toMatchObject({ status: 'RESOLVED', reported: true, stopped: true,
      residue: { total: 4, exposed: 0, contained: 3, dissipated: 1 }, vessel: { lid: 'CLOSED', seal: 'BROKEN' } });
    expect(value).toMatchObject({ status: 'ACTIVE', revision: 1142, week: 3331, health: 80, mind: 71,
      spirituality: 60, maxSpirituality: 150, cash: 12, actionsRemaining: 0, weeklyBudget: 4, injuries: [], injuryRisk: 0 });
    for (const text of ['码头工人埃文位于12米处，健康100，精力74', '码头工人西蒙位于18米处，健康100，精力65',
      '原桥耐久46，原绳耐久78', '原罐已合盖，残余外露0、罐内3、已消散1', '旧封条仍破损']) expect(panel.textContent).toContain(text);
    expect(value.progression.mastery).toEqual(before.progression.mastery); await assertAbilities(value, 8, 8);
    expect(action.randomAfter).toEqual(action.randomBefore);
    expect(game.commits).toBe(1); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    const text = panel.textContent; first.unmount(); await openPage(game); await assertAbilities(value, 8, 8);
    expect(assertPage(value, action.final).textContent).toBe(text);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    await assertBridgePublic(game, action.final); assertCaptureUntouched(action);
  }, 120_000);
});
