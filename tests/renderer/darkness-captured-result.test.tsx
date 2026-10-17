/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { DARKNESS_ABILITY_IDS } from '../../src/domain/darkness/types.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

// Immutable natural834 snapshots, not a second producer or domain replay. The
// one transition adapter returns the already captured public promotion receipt;
// it does not execute gameplay, choose RNG, or establish SQLite persistence.
// Read only these small gzip boundaries, never retain the complete checkpoint.
const ROOT = 'tests/fixtures/darkness-v02130';
const PANEL = '序列0 黑暗';
const PINS = {
  promotion: { file: 'boundary-814-darkness-actual-promotion.json.gz', count: 814, bytes: 400832,
    sha256: 'be716c9ac4a2d6205e62ee632dbfd9ca42ebdeafffc57cea78d40a07a267790c',
    publicSha256: '1863b565f4964428812dca1069253f10cd6f204336d51a5f4eb5cec3dce42a39' },
  failure: { file: 'boundary-831-epilogue-bounded_misfortune_diversion.json.gz', count: 831, bytes: 413323,
    sha256: 'fc3daaf9490f8ffa45c7865d4ba366ffdee985b3ad3b562ca05e2949a132ada5',
    publicSha256: 'd58c66df5f8443811e7541f06ddbdc0096b169cd3125f013999392a98290f9b2' },
  report: { file: 'boundary-834-epilogue-report.json.gz', count: 834, bytes: 415499,
    sha256: 'ca67121b53898e465df87400fbb9c8a2d0f6728c3db0f914599d7e72367d09b1',
    publicSha256: 'd714aea09577cbf42aff68c3d4837122155c0a7a1ded27a0607f6082135ad1af' },
} as const;
interface CapturedBoundary {
  commandCount: number;
  beforeLast: SliceState;
  lastIntent: SliceIntent;
  final: SliceState;
  public: Omit<Partial<SliceProjection>, 'progression'> & {
    progression: Pick<SliceProjection['progression'], 'sequence' | 'acting' | 'mastery'>;
  };
  globalPublicSha256: string;
  audit: { beforeStateSha256: string; afterStateSha256: string; globalPublicBeforeSha256: string };
}
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown) => sha(stableStringify(value));
const checkedFiles = new Map<string, string>();
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);

function captured(name: keyof typeof PINS) {
  const pin = PINS[name], path = `${ROOT}/${pin.file}`, bytes = readFileSync(path);
  expect(bytes.length).toBe(pin.bytes); expect(sha(bytes)).toBe(pin.sha256);
  checkedFiles.set(path, pin.sha256);
  const boundary = JSON.parse(gunzipSync(bytes).toString('utf8')) as CapturedBoundary;
  expect(boundary.commandCount).toBe(pin.count);
  expect(hash(boundary.beforeLast)).toBe(boundary.audit.beforeStateSha256);
  expect(hash(boundary.final)).toBe(boundary.audit.afterStateSha256);
  expect([boundary.final.schemaVersion, boundary.final.contentVersion])
    .toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  const value = projectSliceState(boundary.final);
  expect(hash(value)).toBe(pin.publicSha256);
  expect(boundary.globalPublicSha256).toBe(pin.publicSha256);
  // The captured policy window intentionally omits pathwayId/promotionWeek;
  // the independently pinned global hash above still covers the entire view.
  const capturedPublic = Object.fromEntries(Object.keys(boundary.public)
    .map(key => [key, key === 'progression' ? { sequence: value.progression.sequence,
      acting: value.progression.acting, mastery: value.progression.mastery } : value[key as keyof SliceProjection]]));
  expect(capturedPublic).toEqual(boundary.public);
  return { boundary, value };
}

function assertPublicOnly(value: unknown, state: SliceState) {
  const forbidden = /^(?:random|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|randomBefore|randomAfter|cursorBefore|cursorAfter|preparedRoll|futureRoll|futureRolls|nextRoll|unrolledResult|sourceDigest|sourceIdentityDigest|historyDigest|originalsDigest|originalPracticeDigest|acquisitionDigest|beforeDigest|afterDigest|randomReceipts)$/;
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
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain(state.random.seed);
  expect(serialized).not.toContain(state.darkness.source!.actorId);
  expect(serialized).not.toContain(state.darkness.source!.historyDigest);
  expect(serialized).not.toContain(state.darkness.source!.originalsDigest);
  // Resolved public check modifier explanations legitimately have a string source.
}

function publicAdapter(initial: SliceProjection, transition?: { intent: SliceIntent; after: SliceProjection }) {
  let current = initial, receipts = 0;
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current), runs: [{ runId: current.runId,
      name: current.character.name, portraitId: current.character.portraitId, week: current.week,
      date: current.date, status: current.status, revision: current.revision, updatedAt: '2026-10-17T20:00:59Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(current.runId);
    return { ok: true, value: structuredClone(current) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (!transition || receipts !== 0) throw Error('Only the captured promotion receipt may be displayed once.');
    expect(envelope).toEqual({ intentId: expect.any(String), runId: current.runId,
      expectedRevision: current.revision, payload: transition.intent });
    expect(transition.after.revision).toBe(current.revision + 1);
    current = transition.after; receipts++;
    return { ok: true, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: '2026-10-17T20:00:59Z', replayed: false, state: structuredClone(current) } };
  });
  return { bridge: { getBootstrap, loadRun, submitIntent }, get current() { return current; }, get receipts() { return receipts; } };
}

async function openPage(game: ReturnType<typeof publicAdapter>) {
  const bootstrapCalls = game.bridge.getBootstrap.mock.calls.length, loadCalls = game.bridge.loadRun.mock.calls.length;
  window.sliceGame = game.bridge;
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  await screen.findByRole('region', { name: PANEL });
  expect(game.bridge.getBootstrap).toHaveBeenCalledTimes(bootstrapCalls + 1);
  expect(game.bridge.loadRun).toHaveBeenCalledTimes(loadCalls + 1);
  expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId);
  return view;
}

function assertCurrentPage(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: PANEL });
  const banner = screen.getAllByRole('banner').find(item => within(item).queryByRole('button', { name: '返回主菜单' }))!;
  expect(banner.textContent).toContain(`${state.character.name} · ${PANEL}`);
  expect(banner.textContent).toContain(`第 ${state.week} 周`);
  expect(panel.textContent).toContain(value.darkness.story);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.darkness.nextStep);
  const resources = value.darkness.resources;
  expect(panel.textContent).toContain(`健康 ${resources.health} · 精神 ${resources.mind} · 灵性 ${resources.spirituality} · ${resources.cash} · 本周行动 ${resources.actionsRemaining}`);
  expect(screen.queryByRole('region', { name: '厄难骑士成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter|sourceDigest|historyDigest/);
  expect(panel.innerHTML).not.toContain(state.random.seed);
  expect(panel.innerHTML).not.toContain(state.darkness.source!.historyDigest);
  expect(Object.keys(value.darkness).sort()).toEqual(['title', 'guidanceKnown', 'promoted', 'story',
    'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase'].sort());
  assertPublicOnly(value, state);
  return panel;
}

async function assertAbilities(value: SliceProjection, state: SliceState, promoted: boolean) {
  const panel = screen.getByRole('region', { name: PANEL });
  const summary = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  const inherited = value.darkness.abilities.filter(ability => !DARKNESS_ABILITY_IDS.some(id => id === ability.id));
  expect(inherited).toHaveLength(20);
  expect(Object.fromEntries(inherited.map(({ id, mastery }) => [id, mastery])))
    .toEqual(state.darkness.source!.budget.mastery);
  expect(value.darkness.abilities).toHaveLength(promoted ? 22 : 20);
  for (const ability of value.darkness.abilities) {
    expect(state.progression.mastery[ability.id]).toBe(ability.mastery);
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  for (const id of DARKNESS_ABILITY_IDS) {
    expect(Object.hasOwn(state.progression.mastery, id)).toBe(promoted);
    expect(value.darkness.abilities.find(ability => ability.id === id)?.mastery).toBe(promoted ? 0 : undefined);
  }
}

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  // clearAllMocks alone would keep the public-save closures alive across cases.
  vi.resetAllMocks(); vi.restoreAllMocks();
  for (const [path, expected] of checkedFiles) expect(sha(readFileSync(path)), 'Capture remains untouched').toBe(expected);
  checkedFiles.clear();
});

describe('Darkness actual natural834 saved public pages', () => {
  it('shows the real command814 promotion immediately after its captured receipt and reopens the identical S0', async () => {
    const { boundary, value } = captured('promotion'), before = projectSliceState(boundary.beforeLast);
    expect(hash(before)).toBe(boundary.audit.globalPublicBeforeSha256);
    expect(boundary.lastIntent).toEqual({ type: 'DARKNESS', command: {
      type: 'CONSUME', compoundId: 'darkness-compound-1', confirmed: true } });
    expect(boundary.final).toMatchObject({ revision: 815, week: 189, status: 'ACTIVE', health: 100,
      mind: 80, spirituality: 78, cash: 662, actionsRemaining: 1, injuryRisk: 0, injuries: [], ending: null,
      progression: { pathwayId: 'darkness', sequence: 0, acting: 0 } });
    expect(boundary.final.character).toEqual(boundary.beforeLast.character);
    expect(boundary.final.lastCheck).toMatchObject({ chance: 70, roll: 50, tier: 'SUCCESS' });
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value }), first = await openPage(game);
    assertCurrentPage(before, boundary.beforeLast); await assertAbilities(before, boundary.beforeLast, false);
    const action = before.darkness.actions.find(item => item.command.type === 'CONSUME')!;
    const trigger = within(screen.getByRole('region', { name: '晋升与服药' })).getByRole('button', { name: action.label });
    expect(disabled(trigger)).toBe(false); expect(descriptions(trigger)).toEqual([action.cost]);
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '黑暗服药确认' });
    expect(dialog.textContent).toContain('1行动、30灵性'); expect(dialog.textContent).toContain('70%');
    expect(dialog.textContent).toContain('已付费用不退还'); expect(dialog.textContent).toContain('可能死亡');
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull());
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.receipts).toBe(1);
    const panel = assertCurrentPage(value, boundary.final);
    await assertAbilities(value, boundary.final, true);
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('精神实扣12'); expect(result.textContent).toContain('实际掷骰 50');
    expect(result.textContent).toContain('成功率70%');
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('当前没有伤势');
    // All three actual SliceApp ingress responses are public-only, including the receipt.
    for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun, game.bridge.submitIntent]) {
      assertPublicOnly(await mock.mock.results[0]!.value, boundary.final);
    }
    // The committed state can render before the submit finally clears busy.
    // Compare only after that real status leaves the screen, not by dropping it.
    await waitFor(() => expect(within(panel).queryByText('正在结算并保存这一次操作，请稍候。')).toBeNull());
    const immediateText = panel.textContent; first.unmount();
    await openPage(game); assertCurrentPage(value, boundary.final); await assertAbilities(value, boundary.final, true);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toBe(immediateText);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.receipts).toBe(1);
    expect(hash(boundary.beforeLast)).toBe(boundary.audit.beforeStateSha256);
    expect(hash(boundary.final)).toBe(boundary.audit.afterStateSha256);
    expect(hash(value)).toBe(PINS.promotion.publicSha256);
  }, 120_000);

  it('displays the actual command831 failed diversion, spent resources and untreated recoil instead of an invented skill success', async () => {
    const { boundary, value } = captured('failure'), state = boundary.final;
    expect(state).toMatchObject({ revision: 832, week: 192, health: 92, mind: 83, spirituality: 128,
      cash: 752, actionsRemaining: 1, injuryRisk: 1, ending: null });
    expect([boundary.beforeLast.health - state.health, boundary.beforeLast.mind - state.mind,
      boundary.beforeLast.spirituality - state.spirituality, boundary.beforeLast.actionsRemaining - state.actionsRemaining])
      .toEqual([8, 9, 10, 1]);
    expect(state.lastCheck).toMatchObject({ chance: 82, roll: 85, tier: 'FAILURE' });
    expect(state.injuries).toEqual([{ id: 'R213:sleepless-rebuild-natural:832:darkness-strain',
      severity: 'LIGHT', acquiredRevision: 832, treatedRevision: null }]);
    const game = publicAdapter(value); await openPage(game);
    const panel = assertCurrentPage(value, state); await assertAbilities(value, state, true);
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(within(result).getByRole('heading', { name: '失败 · 意志检定' })).toBeTruthy();
    expect(result.textContent).toContain('本次施术失败，代价已经消耗');
    expect(result.textContent).toContain('反冲留下本人实际伤势');
    expect(result.textContent).toContain('本次成功率 82%，实际掷骰 85');
    expect(result.textContent).not.toContain('实际掷骰 31');
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('1. 轻伤 · 未处理');
    const incident = within(panel).getByRole('region', { name: '原居民返街后的有限事故' });
    expect(incident.textContent).toContain('本人实际位置40米');
    expect(incident.textContent).toContain('厄难偏导：已尝试，未证明实际应用');
    const exits = within(panel).getByRole('region', { name: '暂停与安全返回' });
    const sideExit = within(exits).getByRole('button', { name: '陪同原两人沿普通侧路回登记处' });
    expect(sideExit.closest('details')).toBeNull(); expect(disabled(sideExit)).toBe(false);
    expect(descriptions(sideExit)).toEqual(['0行动、0便士；按实际位置慢行']);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    expect(hash(state)).toBe(boundary.audit.afterStateSha256);
    expect(hash(value)).toBe(PINS.failure.publicSha256);
  }, 60_000);

  it('opens and reopens the actual command834 report with two ordinary returns, preserved four-person history and zero new mastery', async () => {
    const { boundary, value } = captured('report'), state = boundary.final;
    expect(state).toMatchObject({ revision: 835, week: 192, status: 'ACTIVE', health: 92, mind: 83,
      spirituality: 128, cash: 752, actionsRemaining: 1, injuryRisk: 1, ending: null, lastCheck: null,
      progression: { pathwayId: 'darkness', sequence: 0, acting: 0 } });
    const epilogue = state.darkness.epilogue!;
    expect(epilogue).toMatchObject({ status: 'RESOLVED', position: 0, reported: true,
      concealment: { attempted: true, passed: true, applied: false, expiresSecond: null },
      diversion: { attempted: true, passed: false, applied: false, expiresSecond: null },
      load: { condition: 65, secured: true, latchUsed: true, landed: 'NOT_RELEASED' } });
    const concealment = epilogue.journal.find(event => event.command.type === 'SHORT_CONCEALMENT')!;
    const diversion = epilogue.journal.find(event => event.command.type === 'BOUNDED_MISFORTUNE_DIVERSION')!;
    const secure = epilogue.journal.find(event => event.command.type === 'SECURE_LOAD')!;
    expect(concealment.check).toMatchObject({ chance: 82, roll: 31, tier: 'SUCCESS' });
    expect(diversion.check).toMatchObject({ chance: 82, roll: 85, tier: 'FAILURE' });
    expect(secure.second - diversion.second).toBe(60);
    expect(secure.second).toBeGreaterThan(concealment.second + 30);
    expect(epilogue.journal.slice(-2).map(event => event.command.type)).toEqual(['ORDINARY_SIDE_EXIT', 'REPORT']);
    expect(epilogue.residents.map(resident => [resident.id, resident.position, resident.consenting, resident.injuries]))
      .toEqual([['DN-LENA', 0, true, []], ['DN-NOAH', 0, true, []]]);
    expect(state.darkness.evacuation!.residents.map(resident => [resident.id, resident.position, resident.consent]))
      .toEqual([['DN-LENA', 110, 'ACCEPT'], ['DN-JONAH', 110, 'ACCEPT'], ['DN-ADA', 110, 'ACCEPT'], ['DN-NOAH', 110, 'ACCEPT']]);
    expect(state.character).toEqual(state.darkness.source!.character);
    const game = publicAdapter(value), first = await openPage(game);
    async function assertReport() {
      const panel = assertCurrentPage(value, state); await assertAbilities(value, state, true);
      const incident = within(panel).getByRole('region', { name: '原居民返街后的有限事故' });
      expect(incident.closest('details')).toBeNull();
      expect(incident.textContent).toContain('原百叶状况65，原扣已止动');
      for (const name of ['莱娜', '诺亚']) expect(incident.textContent).toContain(`${name}：当前位置0米，愿意同行；没有新增伤势。`);
      expect(incident.textContent).toContain('短隐秘：已尝试，未证明实际应用。厄难偏导：已尝试，未证明实际应用。');
      const history = within(panel).getByText('原夜间撤离记录', { selector: 'summary' });
      expect((history.closest('details') as HTMLDetailsElement).open).toBe(false);
      await userEvent.click(history);
      const original = within(panel).getByRole('region', { name: '四位成年人的长夜撤离' });
      expect(original.textContent).toContain('已到达4/4');
      for (const [name, age] of [['莱娜', 32], ['乔纳', 41], ['艾达', 36], ['诺亚', 58]])
        expect(original.textContent).toContain(`${name}（${age}岁）：110米，本人同意；真实到达已记录`);
      expect(original.textContent).toContain('余油1245灯秒'); expect(original.textContent).toContain('原绳状况99');
      const body = within(panel).getByRole('region', { name: '原身体、20项旧掌握与原物' });
      expect(body.textContent).toContain('米洛原木板完整度45、磨损20，没有借给新街区');
      expect(body.textContent).toContain('轻伤：尚未处置');
      expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('1. 轻伤 · 未处理');
      const result = within(panel).getByRole('region', { name: '最近行动结果' });
      expect(result.textContent).toContain('如实交接：2名原居民抵达登记处');
      expect(result.textContent).not.toMatch(/实际掷骰|意志检定|掷出85|掷出31/);
      expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
      return panel.textContent;
    }
    const firstText = await assertReport(); first.unmount();
    await openPage(game); expect(await assertReport()).toBe(firstText);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled(); expect(game.receipts).toBe(0);
    for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun]) {
      for (const result of mock.mock.results) assertPublicOnly(await result.value, state);
    }
    expect(hash(state)).toBe(boundary.audit.afterStateSha256);
    expect(hash(value)).toBe(PINS.report.publicSha256);
  }, 120_000);
});
