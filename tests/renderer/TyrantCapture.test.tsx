/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { TYRANT_ABILITY_IDS } from '../../src/domain/tyrant/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { assertGlobalPublic, hash, migrateCapturedTyrantState, sha } from '../helpers/tyrant-capture.js';

// NEW215 is the rebuilt natural864 death route: original701 + actual new163.
// These five immutable captures supply the complete real public receipts. The
// adapter tests display/retry/navigation only; it neither executes the producer,
// selects RNG, invents S0, nor constitutes the separate real SQLite save audit.
const ROOT = 'tests/fixtures/tyrant-v02150', PANEL = '序列0 暴君';
const PINS = {
  guidance: { count: 780, bytes: 858913, sha256: '6aa606af42f7d7becf448d600256c1cac9b15d12b804075e732b40ec752f5e74',
    originalBytes: 5442905, originalSha256: 'e122b334b86c84ed80dfa90e65c4763b265d5b22c797ada6a7a70501c3f6fb31',
    publicSha256: '96fe478ad5bb5f717ddfd42a706857da4660a183dc51b9086f0a8a64858ca878' },
  failure: { count: 830, bytes: 911697, sha256: 'e57fa3ad8c2ed740eb6cb727509cd29541815a8c4066bad2341529d12386b24b',
    originalBytes: 6720995, originalSha256: 'cfebae6138cc279791a2ecbaa2dda2da481bedee84bb9076f576a17e0c14b81e',
    publicSha256: '678c092216fde8a76ebab33643d399bd38977068031d6a1f69b47d9719440ea6' },
  paidWait: { count: 836, bytes: 913926, sha256: '2bd996c99bd7957eaffb6786c64f7030fe764ee38426a537a3569d76b21ba247',
    originalBytes: 6816070, originalSha256: '6562285aff2c2453e336f0b7ab4b134302a10df54b8d45dd9cbf74423847c902',
    publicSha256: '0ca5935fb8752f77087c6244c19e0ba36d400d6c54006817389b631d93aa7ce6' },
  challenge: { count: 856, bytes: 927116, sha256: '208f79668239651dc392979a44595119e10da7b417a7c9b8c436a15500f5b93c',
    originalBytes: 7126416, originalSha256: '10520a373ea32168e14c0b7a0e53d6cfab85b6ccdf32a19b9080bb673e0b1810',
    publicSha256: 'ff06e7cd6ee40154eb9d873aeb61c28628aaeb0d22f68cb48aea7e61470c7e72' },
  death: { count: 864, bytes: 934208, sha256: 'accf3d7b03d2bc0038ea4b0e53f79de5016c995432ceb2dbbf8151ef315c8c23',
    originalBytes: 7283660, originalSha256: 'd8459161a0f241f03ea92e95d9da4ae60e7f207adaddb44a63de04156bf20bff',
    publicSha256: '11f55d0ac868cc4576d450bbcf02fcdf99b90891188d6015c98090fd389dd937' },
} as const;
interface CapturedBoundary {
  commandCount: number; beforeLast: SliceState; final: SliceState; lastIntent: SliceIntent;
  globalPublicBefore: SliceProjection; globalPublic: SliceProjection;
  audit: { beforeStateSha256: string; afterStateSha256: string;
    globalPublicBeforeSha256: string; globalPublicAfterSha256: string };
}
const checkedFiles = new Map<string, string>();
const checkedStates: { state: SliceState; expected: string }[] = [];
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);
function captured(name: keyof typeof PINS) {
  const pin = PINS[name], path = `${ROOT}/action-${pin.count}.json.gz`, bytes = readFileSync(path);
  expect(bytes.length).toBe(pin.bytes); expect(sha(bytes)).toBe(pin.sha256); checkedFiles.set(path, pin.sha256);
  const raw = gunzipSync(bytes);
  expect(raw.length).toBe(pin.originalBytes); expect(sha(raw)).toBe(pin.originalSha256);
  const boundary = JSON.parse(raw.toString('utf8')) as CapturedBoundary;
  expect(boundary.commandCount).toBe(pin.count);
  expect(hash(boundary.beforeLast)).toBe(boundary.audit.beforeStateSha256);
  expect(hash(boundary.final)).toBe(boundary.audit.afterStateSha256);
  expect([boundary.final.schemaVersion, boundary.final.contentVersion]).toEqual([212, 'tyrant-v212']);
  expect(hash(boundary.globalPublicBefore)).toBe(boundary.audit.globalPublicBeforeSha256);
  expect(hash(boundary.globalPublic)).toBe(pin.publicSha256);
  expect(boundary.audit.globalPublicAfterSha256).toBe(pin.publicSha256);
  checkedStates.push({ state: boundary.beforeLast, expected: boundary.audit.beforeStateSha256 },
    { state: boundary.final, expected: boundary.audit.afterStateSha256 });
  const beforeState = migrateCapturedTyrantState(boundary.beforeLast), state = migrateCapturedTyrantState(boundary.final);
  const before = projectSliceState(beforeState), value = projectSliceState(state);
  // Entire captured globals are compared, including identifiers, old people,
  // exact numbers, commands and order; no roots or private history are deleted.
  expect(before).toEqual(projectPlayerText(structuredClone(boundary.globalPublicBefore), beforeState.character.name));
  expect(value).toEqual(projectPlayerText(structuredClone(boundary.globalPublic), state.character.name));
  expect(value.character).toEqual(boundary.final.character); expect(value.character.name).toBe('托林');
  assertGlobalPublic(before, beforeState); assertGlobalPublic(value, state);
  return { boundary, beforeState, state, before, value };
}
function assertPublicOnly(value: unknown, state: SliceState) {
  const forbidden = /^(?:random|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|randomBefore|randomAfter|cursorBefore|cursorAfter|preparedRoll|futureRoll|futureRolls|nextRoll|unrolledResult|sourceDigest|sourceIdentityDigest|historyDigest|originalsDigest|originalWorldDigest|combatHistoryDigest|acquisitionDigest|beforeDigest|afterDigest|randomReceipts)$/;
  const privatePaths: string[] = [];
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    for (const [key, child] of Object.entries(node)) {
      const next = `${path}.${key}`;
      if (forbidden.test(key) || key === 'source' && child !== null && typeof child === 'object') privatePaths.push(next);
      visit(child, next);
    }
  }
  visit(value, '$'); expect(privatePaths).toEqual([]);
  const serialized = JSON.stringify(value), source = state.tyrant.source;
  for (const secret of [state.random.seed, source?.actorId, source?.historyDigest, source?.originalsDigest,
    source?.originalWorldDigest, source?.combatHistoryDigest, source?.acquisitionDigest])
    if (secret) expect(serialized).not.toContain(secret);
  // Resolved checks legitimately expose a string-valued modifier source.
}

interface Transition { intent: SliceIntent; after: SliceProjection; firstResponse?: 'save-failed' | 'response-lost' }
function publicAdapter(initial: SliceProjection, transition?: Transition) {
  let current = initial, commits = 0, failures = 0, pending: SliceEnvelope | null = null, saved: SliceReceipt | null = null;
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current), runs: [{ runId: current.runId,
      name: current.character.name, portraitId: current.character.portraitId, week: current.week,
      date: current.date, status: current.status, revision: current.revision, updatedAt: '2026-10-18T03:26:15Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(current.runId); return { ok: true, value: structuredClone(current) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (!transition) throw Error('This actual capture has no supplied transition.');
    expect(envelope).toEqual(pending ?? { intentId: expect.any(String), runId: initial.runId,
      expectedRevision: initial.revision, payload: transition.intent });
    if (saved) {
      expect(envelope.intentId).toBe(saved.intentId); pending = null;
      return { ok: true, value: { ...structuredClone(saved), replayed: true } };
    }
    const fail = failures === 0 && !!transition.firstResponse;
    if (fail) { failures++; pending = structuredClone(envelope); }
    if (fail && transition.firstResponse === 'save-failed')
      return { ok: false, error: { code: 'SAVE_FAILED', message: '保存失败', retryable: true } };
    expect(transition.after.revision).toBe(initial.revision + 1);
    saved = { intentId: envelope.intentId, runId: initial.runId, previousRevision: initial.revision,
      newRevision: transition.after.revision, committedAt: '2026-10-18T03:26:15Z', replayed: false,
      state: structuredClone(transition.after) };
    current = transition.after; commits++;
    if (fail && transition.firstResponse === 'response-lost')
      return { ok: false, error: { code: 'RESPONSE_LOST', message: '保存回执未收到', retryable: true } };
    pending = null; return { ok: true, value: structuredClone(saved) };
  });
  return { bridge: { getBootstrap, loadRun, submitIntent }, get current() { return current; }, get commits() { return commits; } };
}
type PublicAdapter = ReturnType<typeof publicAdapter>;
async function openPage(game: PublicAdapter) {
  const bootstrapCalls = game.bridge.getBootstrap.mock.calls.length, loadCalls = game.bridge.loadRun.mock.calls.length;
  window.sliceGame = game.bridge; const view = render(<SliceApp />);
  const continueButton = await screen.findByRole('button', { name: /继续游戏/ });
  if (game.current.status === 'DEAD') {
    expect(disabled(continueButton)).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /查看封存/ }));
  } else await userEvent.click(continueButton);
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  if (game.current.status === 'DEAD') await screen.findByRole('heading', { name: '最终死亡 · 周目封存' });
  else {
    if (!game.current.tyrant.guidanceKnown)
      await userEvent.click(await screen.findByRole('button', { name: '查看暴君晋升准备' }));
    await screen.findByRole('region', { name: PANEL });
  }
  expect(game.bridge.getBootstrap).toHaveBeenCalledTimes(bootstrapCalls + 1);
  expect(game.bridge.loadRun).toHaveBeenCalledTimes(loadCalls + 1);
  expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId);
  return view;
}
function assertHeader(value: SliceProjection) {
  // Both the page and panel have headers: locate the real top bar by its action.
  const topbar = screen.getByRole('button', { name: '返回主菜单' }).closest('header');
  expect(topbar).not.toBeNull();
  expect(topbar!.textContent).toContain(`${value.character.name} · ${value.tyrant.title}`);
  expect(topbar!.textContent).toContain(`第 ${value.week} 周`);
}
function assertCurrentPage(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: PANEL }); assertHeader(value);
  expect(panel.textContent).toContain(value.tyrant.story);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.tyrant.nextStep);
  const r = value.tyrant.resources;
  expect(panel.textContent).toContain(`健康 ${r.health} · 精神 ${r.mind} · 灵性 ${r.spirituality} · ${r.cash} · 本周行动 ${r.actionsRemaining}`);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '雷神成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter|sourceDigest|historyDigest/);
  assertPublicOnly(value, state); assertPublicOnly({ renderedText: document.body.textContent }, state);
  return panel;
}
async function assertInheritedAbilities(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: PANEL });
  const summary = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  expect(value.progression.sequence).toBe(1); expect(value.tyrant.promoted).toBe(false);
  expect(value.tyrant.abilities).toHaveLength(24);
  expect(Object.fromEntries(value.tyrant.abilities.map(({ id, mastery }) => [id, mastery]))).toEqual(state.tyrant.source!.budget.mastery);
  for (const ability of value.tyrant.abilities) {
    expect(state.progression.mastery[ability.id]).toBe(ability.mastery);
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  for (const id of TYRANT_ABILITY_IDS) {
    expect(Object.hasOwn(state.progression.mastery, id)).toBe(false);
    expect(value.tyrant.abilities.find(ability => ability.id === id)).toBeUndefined();
  }
  expect(value.tyrant.abilities.filter(ability => ability.id.startsWith('tyrant.s1.')).map(ability => ability.mastery)).toEqual([0, 0]);
}
async function assertBridgePublic(game: PublicAdapter, state: SliceState) {
  for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun, game.bridge.submitIntent])
    for (const result of mock.mock.results) assertPublicOnly(await result.value, state);
}
async function clickCapturedAction(value: SliceProjection, intent: SliceIntent) {
  if (intent.type !== 'TYRANT') throw Error('Expected an actual Tyrant action.');
  const action = value.tyrant.actions.find(item => hash(item.command) === hash(intent.command))!;
  expect(action).toBeDefined(); expect(action.enabled).toBe(true);
  const panel = screen.getByRole('region', { name: PANEL });
  let button = within(panel).queryByRole('button', { name: action.label });
  if (!button) {
    const summary = within(panel).getByText('其他可选行动', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(within(panel).getByLabelText('查看其他行动'), action.id);
    button = within(panel).getByRole('button', { name: action.label });
  }
  expect(disabled(button)).toBe(false); expect(descriptions(button)).toEqual([action.cost]);
  fireEvent.click(button); fireEvent.click(button); return button;
}
async function settled(panel: HTMLElement) {
  await waitFor(() => expect(within(panel).queryByText('正在结算并保存这一次操作，请稍候。')).toBeNull());
}
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  // Reset implementations as well as calls: captured full-save closures must
  // not survive the case and retain complete historical states across tests.
  vi.resetAllMocks(); vi.restoreAllMocks();
  for (const [path, expected] of checkedFiles) expect(sha(readFileSync(path)), 'Capture bytes remain untouched').toBe(expected);
  for (const { state, expected } of checkedStates) expect(hash(state), 'Complete captured private state remains untouched').toBe(expected);
  checkedFiles.clear(); checkedStates.length = 0;
});

describe('Tyrant215 rebuilt natural864 actual public captures', () => {
  it('shows actual guidance780 cost and reopens the same original S1 with all 24 inherited mastery values', async () => {
    const { boundary, beforeState, state, before, value } = captured('guidance');
    expect(boundary.lastIntent).toEqual({ type: 'TYRANT', command: { type: 'LEARN_GUIDANCE' } });
    expect([before.cash - value.cash, before.actionsRemaining - value.actionsRemaining]).toEqual([100, 1]);
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value }), first = await openPage(game);
    assertCurrentPage(before, beforeState); await clickCapturedAction(before, boundary.lastIntent);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('已实付100便士和1行动听取指导'));
    const panel = assertCurrentPage(value, state); await assertInheritedAbilities(value, state); await settled(panel);
    expect(within(panel).getByRole('region', { name: '三岸原人群与当前追随' }).textContent).toContain('交集0/200000');
    const text = panel.textContent; first.unmount(); await openPage(game);
    assertCurrentPage(value, state); await assertInheritedAbilities(value, state);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.commits).toBe(1);
    await assertBridgePublic(game, state);
  }, 120_000);

  it.each(['save-failed', 'response-lost'] as const)('retains actual coast830 failure and retries the identical envelope after %s', async firstResponse => {
    const { boundary, beforeState, state, before, value } = captured('failure');
    expect(boundary.lastIntent).toEqual({ type: 'TYRANT', command: { type: 'COAST', command: { type: 'FULFILL', coastId: 'east' } } });
    expect(state.lastCheck).toMatchObject({ chance: 72, roll: 74, tier: 'FAILURE' });
    expect([before.health - value.health, before.spirituality - value.spirituality, before.actionsRemaining - value.actionsRemaining])
      .toEqual([4, 6, 1]);
    const east = state.tyrant.coasts!.coasts.find(coast => coast.id === 'east')!;
    expect(east).toMatchObject({ grain: 12, playerPosition: 30, fulfillment: { grain: 3, passed: false } });
    expect(east.cohorts.every(cohort => cohort.fears && !cohort.obeys && !cohort.believes)).toBe(true);
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value, firstResponse }), first = await openPage(game);
    const trigger = await clickCapturedAction(before, boundary.lastIntent);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    assertCurrentPage(before, beforeState);
    expect(disabled(trigger)).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(trigger); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('护堤失败并造成本人真实伤势'));
    const panel = assertCurrentPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['失败 · 意志检定', '本次成功率 72%，实际掷骰 74', '三粮仍已交付、不能返还', '健康变化-4', '灵性变化-6'])
      expect(result.textContent).toContain(text);
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('1. 轻伤 · 未处理');
    expect(within(panel).getByRole('region', { name: '三岸原人群与当前追随' }).textContent).toContain('交集90000/200000');
    await settled(panel);
    const exits = within(panel).getByRole('region', { name: '普通救援、撤退与返回' });
    expect(exits.closest('details')).toBeNull();
    expect(within(exits).getAllByRole('button').some(button => !disabled(button))).toBe(true);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1); await settled(panel);
    const text = panel.textContent; first.unmount(); await openPage(game);
    expect(assertCurrentPage(value, state).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2); await assertBridgePublic(game, state);
  }, 120_000);

  it('shows actual paid week836 without automatically renewing the refused coast or changing its RNG', async () => {
    const { boundary, beforeState, state, before, value } = captured('paidWait');
    expect(boundary.lastIntent).toEqual({ type: 'TYRANT', command: { type: 'NEXT_WEEK' } });
    expect([before.week, value.week, before.cash, value.cash]).toEqual([190, 191, 30, 0]);
    expect(state.random).toEqual(beforeState.random); expect(state.lastCheck).toBeNull();
    expect([value.health, value.mind, value.spirituality]).toEqual([before.health, before.mind, before.spirituality]);
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value }); await openPage(game);
    await clickCapturedAction(before, boundary.lastIntent);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('已支付30便士，工作工资不重复入账'));
    const panel = assertCurrentPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('没有自动工资、免费修理或恢复'); expect(result.textContent).not.toContain('实际掷骰');
    const coasts = within(panel).getByRole('region', { name: '三岸原人群与当前追随' });
    expect(coasts.textContent).toContain('居民拒绝，须尊重答复'); expect(coasts.textContent).toContain('交集90000/200000');
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.commits).toBe(1); await assertBridgePublic(game, state);
  }, 120_000);

  it('shows actual challenge856 independent hostility, paid damage and 270000 current followers without claiming survival', async () => {
    const { boundary, state, before, value } = captured('challenge');
    expect(boundary.lastIntent).toEqual({ type: 'TYRANT', command: { type: 'CHALLENGE', command: { type: 'BEGIN' } } });
    expect(state).toMatchObject({ status: 'ACTIVE', week: 195, health: 92, spirituality: 108, actionsRemaining: 0,
      lastCheck: { chance: 72, roll: 41, tier: 'SUCCESS' }, progression: { sequence: 1 } });
    expect(state.tyrant.challenge).toMatchObject({ status: 'ENGAGED', position: 0, escape: null,
      opponent: { status: 'ACTIVE', disposition: 'HOSTILE', health: 988, spirituality: 9988 } });
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value }); await openPage(game);
    await clickCapturedAction(before, boundary.lastIntent);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('1次实际敌对交换'));
    const panel = assertCurrentPage(value, state); await assertInheritedAbilities(value, state);
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['太阳真神独立使用太阳长枪', '实际掷骰 41', '健康变化-8', '灵性变化-12']) expect(result.textContent).toContain(text);
    expect(within(panel).getByRole('region', { name: '三岸原人群与当前追随' }).textContent).toContain('交集270000/200000');
    const challenge = within(panel).getByRole('region', { name: '单独挑战另一真神并实际存活' });
    expect(challenge.textContent).toContain('敌对交换进行中，不能直接离场或领取存活证明');
    await settled(panel);
    const retreat = within(panel).getByRole('button', { name: '沿原路普通撤退' });
    expect(disabled(retreat)).toBe(false); expect(retreat.closest('details')).toBeNull();
    expect(descriptions(retreat)[0]).toContain('0行动、0灵性');
    expect(disabled(within(panel).getByRole('button', { name: '撑过出口截击并脱离' }))).toBe(true);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); await assertBridgePublic(game, state);
  }, 120_000);

  it('retains actual death864 after a lost response, archives the original name and disables every inspected action on reload', async () => {
    const { boundary, beforeState, state, before, value } = captured('death');
    expect(state).toMatchObject({ status: 'DEAD', week: 195, health: 0, mind: 100, spirituality: 76,
      cash: 120, actionsRemaining: 0, injuryRisk: 7, ending: { kind: 'DEATH' }, progression: { sequence: 1 },
      random: { seed: 'sailor-natural-v026', cursor: 284 } });
    expect(state.tyrant.challenge).toMatchObject({ status: 'DEAD', position: 60, totalWalkedMeters: 60, escape: null,
      opponent: { status: 'ACTIVE', pursuitCount: 9 } });
    expect(state.tyrant.challenge!.exchanges).toHaveLength(9);
    // The final movement check succeeded; real hostile damage nevertheless killed
    // the original character. Do not replace this with a controlled escape.
    expect(state.lastCheck).toMatchObject({ chance: 72, roll: 38, tier: 'SUCCESS' });
    expect(state.injuries.map(injury => injury.severity)).toEqual(['HEAVY', 'LIGHT', 'LIGHT', 'LIGHT', 'HEAVY']);
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value, firstResponse: 'response-lost' }), first = await openPage(game);
    await clickCapturedAction(before, boundary.lastIntent);
    const retry = await screen.findByRole('button', { name: '重试这次操作' }); assertCurrentPage(before, beforeState);
    expect(screen.queryByRole('heading', { name: '最终死亡 · 周目封存' })).toBeNull();
    fireEvent.click(retry); fireEvent.click(retry);
    await screen.findByRole('heading', { name: '最终死亡 · 周目封存' }); assertHeader(value);
    expect(screen.getByText('只读封存卷宗')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1);
    async function inspectDeath() {
      await userEvent.click(screen.getByRole('button', { name: '查看卷宗' }));
      const panel = assertCurrentPage(value, state); await assertInheritedAbilities(value, state);
      expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain('本人已死亡，周目停止');
      const challenge = within(panel).getByRole('region', { name: '单独挑战另一真神并实际存活' });
      for (const text of ['本人距开场60米', '本人死亡', '9次实际敌对交换', '5份原伤势记录']) expect(challenge.textContent).toContain(text);
      const result = within(panel).getByRole('region', { name: '最近行动结果' });
      expect(result.textContent).toContain('挑战以死亡终止'); expect(result.textContent).toContain('实际掷骰 38');
      expect(result.textContent).toContain('健康变化-2'); expect(result.textContent).toContain('本人位置45→60米');
      const injuries = within(panel).getByRole('region', { name: '当前伤势' });
      expect(within(injuries).getAllByRole('listitem').map(item => item.textContent))
        .toEqual(['1. 重伤 · 未处理', '2. 轻伤 · 未处理', '3. 轻伤 · 未处理', '4. 轻伤 · 未处理', '5. 重伤 · 未处理']);
      const more = within(panel).getByText('其他可选行动', { selector: 'summary' });
      if (!(more.closest('details') as HTMLDetailsElement).open) await userEvent.click(more);
      expect(disabled(within(panel).getByLabelText('查看其他行动'))).toBe(true);
      const buttons = within(panel).getAllByRole('button'); expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) { expect(disabled(button)).toBe(true); fireEvent.click(button); }
      expect(value.tyrant.actions.every(action => !action.enabled)).toBe(true);
      expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
      return panel.textContent;
    }
    const text = await inspectDeath(); first.unmount(); await openPage(game);
    assertHeader(value); expect(await inspectDeath()).toBe(text);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
    await assertBridgePublic(game, state);
  }, 120_000);
});
