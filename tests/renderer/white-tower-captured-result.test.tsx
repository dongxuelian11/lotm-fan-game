/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { WHITE_TOWER_ABILITY_IDS } from '../../src/domain/white-tower/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import type { SliceBridge, SliceEnvelope } from '../../src/shared/slice-contracts.js';
import { migrateCapturedWhiteTowerState } from '../helpers/white-tower-capture.js';

// Original natural803 captures (666 archived commands + 137 actual new commands).
// Only these five boundaries are read; no producer, controlled route, RNG choice,
// original666 replay, or checkpoint rewrite runs here. The bridge below displays
// captured receipts, including a simulated lost response, not SQLite evidence.
const ROOT = 'tests/fixtures/white-tower-v02140';
const PANEL = '序列0 白塔';
const PINS = {
  promotion: { count: 775, bytes: 1019923, sha256: 'aefe25f7d6cff511265c21a152293ac1504005594229478e4ab01b75a621c2a9',
    publicSha256: 'c0dd4f6e3aa20435c377946c646235f975253b35c39b6c2afdd190145704397e' },
  insight: { count: 789, bytes: 1032198, sha256: '83968912fe14871a4f9f345c2da5694c7e80f1ee47155de79106a317fc269387',
    publicSha256: 'c595fd579c801a18999999911c583ffb752b8a6bb17915b90a826f805d3a3737' },
  application: { count: 790, bytes: 1035377, sha256: '8c0eaf24e19eb8e36561c9bb0fedf56944086bf665f9e1adb846a71757a43803',
    publicSha256: 'e1023b319477e23ccbfe172e9d6d3c97d0a57560b067b828e1d292ca12dbb511' },
  failure: { count: 795, bytes: 1041220, sha256: '6c251a8c3d9568814af2c2ef014dd40ad16c5c9c234fd0b76589a498d11e7909',
    publicSha256: '822508b64b8a39af368928009c3e7271de36bcadbb4e08780d9da13e0863156e' },
  report: { count: 803, bytes: 1048274, sha256: '10e69a3c19cfb393966ef213d90970e2fba6f82465be18b40f1b0f30549a11f2',
    publicSha256: 'e4887bf6d73eb1c9fa81553efe1f1c4d8deb0339040d8eb8845a126ff3136b46' },
} as const;
interface CapturedBoundary {
  commandCount: number;
  beforeLast: SliceState;
  lastIntent: SliceIntent;
  final: SliceState;
  globalPublicBefore: SliceProjection;
  globalPublic: SliceProjection;
  audit: { beforeStateSha256: string; afterStateSha256: string;
    globalPublicBeforeSha256: string; globalPublicAfterSha256: string };
}
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown) => sha(stableStringify(value));
const checkedFiles = new Map<string, string>();
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);

function captured(name: keyof typeof PINS) {
  const pin = PINS[name], path = `${ROOT}/action-${pin.count}.json.gz`, bytes = readFileSync(path);
  expect(bytes.length).toBe(pin.bytes); expect(sha(bytes)).toBe(pin.sha256);
  checkedFiles.set(path, pin.sha256);
  const boundary = JSON.parse(gunzipSync(bytes).toString('utf8')) as CapturedBoundary;
  expect(boundary.commandCount).toBe(pin.count);
  expect(hash(boundary.beforeLast)).toBe(boundary.audit.beforeStateSha256);
  expect(hash(boundary.final)).toBe(boundary.audit.afterStateSha256);
  expect([boundary.final.schemaVersion, boundary.final.contentVersion])
    .toEqual([211, 'white-tower-v211']);
  expect(hash(boundary.globalPublicBefore)).toBe(boundary.audit.globalPublicBeforeSha256);
  expect(hash(boundary.globalPublic)).toBe(pin.publicSha256);
  expect(boundary.audit.globalPublicAfterSha256).toBe(pin.publicSha256);
  const value = projectSliceState(migrateCapturedWhiteTowerState(boundary.final));
  // Compare the entire projection; only the existing display-prose adapter is
  // allowed. Identifiers, commands, numbers, order and player name stay exact.
  expect(value).toEqual(projectPlayerText(boundary.globalPublic, boundary.final.character.name));
  return { boundary, value };
}

function assertPublicOnly(value: unknown, state: SliceState) {
  const forbidden = /^(?:random|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|randomBefore|randomAfter|cursorBefore|cursorAfter|preparedRoll|futureRoll|futureRolls|nextRoll|unrolledResult|sourceDigest|sourceIdentityDigest|historyDigest|originalsDigest|acquisitionDigest|beforeDigest|afterDigest|randomReceipts)$/;
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
  const serialized = JSON.stringify(value), source = state.whiteTower.source!;
  for (const secret of [state.random.seed, source.actorId, source.historyDigest, source.originalsDigest, source.acquisitionDigest])
    expect(serialized).not.toContain(secret);
}

function publicAdapter(initial: SliceProjection, transition?: { intent: SliceIntent; after: SliceProjection; loseResponse?: boolean }) {
  let current = initial, receipts = 0, originalEnvelope: SliceEnvelope | null = null;
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current), runs: [{ runId: current.runId,
      name: current.character.name, portraitId: current.character.portraitId, week: current.week,
      date: current.date, status: current.status, revision: current.revision, updatedAt: '2026-10-17T21:39:47Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(current.runId);
    return { ok: true, value: structuredClone(current) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (!transition) throw Error('This capture has no permitted transition.');
    expect(envelope).toEqual(originalEnvelope ?? { intentId: expect.any(String), runId: initial.runId,
      expectedRevision: initial.revision, payload: transition.intent });
    const replayed = originalEnvelope !== null;
    if (!replayed) {
      originalEnvelope = structuredClone(envelope);
      expect(transition.after.revision).toBe(initial.revision + 1);
      current = transition.after; receipts++;
      if (transition.loseResponse) return { ok: false, error: { code: 'RESPONSE_LOST', message: '保存回执未收到', retryable: true } };
    }
    return { ok: true, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: initial.revision, newRevision: current.revision, committedAt: '2026-10-17T21:39:47Z',
      replayed, state: structuredClone(current) } };
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
  expect(banner.textContent).toContain(`${state.character.name} · ${value.whiteTower.title}`);
  expect(banner.textContent).toContain(`第 ${state.week} 周`);
  expect(panel.textContent).toContain(value.whiteTower.story);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.whiteTower.nextStep);
  const r = value.whiteTower.resources;
  expect(panel.textContent).toContain(`健康 ${r.health} · 精神 ${r.mind} · 灵性 ${r.spirituality} · ${r.cash} · 本周行动 ${r.actionsRemaining}`);
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter|sourceDigest|historyDigest/);
  expect(panel.innerHTML).not.toContain(state.random.seed);
  assertPublicOnly(value, state);
  return panel;
}

async function assertAbilities(value: SliceProjection, state: SliceState, newMastery: number[] | null) {
  const panel = screen.getByRole('region', { name: PANEL });
  const summary = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  const inherited = value.whiteTower.abilities.filter(ability => !WHITE_TOWER_ABILITY_IDS.some(id => id === ability.id));
  expect(inherited).toHaveLength(21);
  expect(Object.fromEntries(inherited.map(({ id, mastery }) => [id, mastery]))).toEqual(state.whiteTower.source!.budget.mastery);
  expect(value.whiteTower.abilities).toHaveLength(newMastery ? 23 : 21);
  for (const ability of value.whiteTower.abilities) {
    expect(state.progression.mastery[ability.id]).toBe(ability.mastery);
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  expect(WHITE_TOWER_ABILITY_IDS.map(id => value.whiteTower.abilities.find(ability => ability.id === id)?.mastery))
    .toEqual(newMastery ?? [undefined, undefined]);
}

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  for (const [path, expected] of checkedFiles) expect(sha(readFileSync(path)), 'Capture remains untouched').toBe(expected);
  checkedFiles.clear();
});

describe('White Tower actual natural803 saved public pages', () => {
  it('displays promotion775 once after same-envelope receipt retry and reopens identical saved S0 facts', async () => {
    const { boundary, value } = captured('promotion'), before = projectSliceState(migrateCapturedWhiteTowerState(boundary.beforeLast));
    expect(before).toEqual(projectPlayerText(boundary.globalPublicBefore, boundary.beforeLast.character.name));
    expect(boundary.lastIntent).toEqual({ type: 'WHITE_TOWER', command: { type: 'CONSUME', compoundId: 'white-tower-compound-1', confirmed: true } });
    expect(boundary.final).toMatchObject({ revision: 776, week: 170, status: 'ACTIVE', health: 100,
      mind: 80, spirituality: 78, cash: 40, actionsRemaining: 1, injuryRisk: 0, injuries: [], ending: null,
      progression: { pathwayId: 'white-tower', sequence: 0, acting: 0 } });
    expect(boundary.final.character).toEqual(boundary.beforeLast.character);
    expect(boundary.final.lastCheck).toMatchObject({ chance: 70, roll: 34, tier: 'SUCCESS' });
    const game = publicAdapter(before, { intent: boundary.lastIntent, after: value, loseResponse: true }), first = await openPage(game);
    assertCurrentPage(before, boundary.beforeLast); await assertAbilities(before, boundary.beforeLast, null);
    const action = before.whiteTower.actions.find(item => item.command.type === 'CONSUME')!;
    const trigger = within(screen.getByRole('region', { name: '晋升与服药' })).getByRole('button', { name: action.label });
    expect(disabled(trigger)).toBe(false); expect(descriptions(trigger)).toEqual([action.cost]);
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '白塔服药确认' });
    for (const text of ['1行动、30灵性', '70%', '已付费用不退还', '可能死亡']) expect(dialog.textContent).toContain(text);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    assertCurrentPage(before, boundary.beforeLast);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('精神 92 · 灵性 108 · 40便士 · 本周行动 2');
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '白塔服药确认' })).toBeNull());
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('精神实扣12'));
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.receipts).toBe(1);
    const panel = assertCurrentPage(value, boundary.final); await assertAbilities(value, boundary.final, [0, 0]);
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['成功率70%', '实际掷骰 34', '精神变化-12，灵性变化-30']) expect(result.textContent).toContain(text);
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('当前没有伤势');
    await waitFor(() => expect(within(panel).queryByRole('status')).toBeNull());
    const immediateText = panel.textContent; first.unmount();
    await openPage(game); assertCurrentPage(value, boundary.final); await assertAbilities(value, boundary.final, [0, 0]);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toBe(immediateText);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2); expect(game.receipts).toBe(1);
    for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun, game.bridge.submitIntent])
      for (const result of mock.mock.results) assertPublicOnly(await result.value, boundary.final);
  }, 120_000);

  it('separates the real insight789 roll from its command790 independent application and counteraction', async () => {
    const insight = captured('insight'), application = captured('application');
    expect(hash(insight.boundary.final)).toBe(application.boundary.audit.beforeStateSha256);
    expect(insight.boundary.final.lastCheck).toMatchObject({ chance: 76, roll: 15, tier: 'SUCCESS' });
    expect(insight.boundary.final.whiteTower.epilogue!.insight).toMatchObject({ attempted: true, passed: true, applied: false });
    const game = publicAdapter(insight.value, { intent: application.boundary.lastIntent, after: application.value });
    await openPage(game); const panel = assertCurrentPage(insight.value, insight.boundary.final);
    await assertAbilities(insight.value, insight.boundary.final, [0, 0]);
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['成功 · 感知检定', '本次成功率 76%，实际掷骰 15', '精神变化-8，灵性变化-12']) expect(result.textContent).toContain(text);
    expect(within(panel).getByRole('region', { name: '同一机械结构上的有限应对' }).textContent).toContain('结构洞察：已尝试，未证明实际应用');
    fireEvent.click(within(panel).getByRole('button', { name: '本人独立实测当前原结构' }));
    await waitFor(() => expect(panel.textContent).toContain('旧核验和所有旧窗口失效'));
    assertCurrentPage(application.value, application.boundary.final); await assertAbilities(application.value, application.boundary.final, [8, 0]);
    expect(result.textContent).toContain('对应掌握仅此一次增加8');
    expect(result.textContent).toContain('瑟拉当即撤回，仍在零米');
    expect(result.textContent).not.toContain('实际掷骰');
    expect(application.boundary.final.lastCheck).toBeNull();
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); expect(game.receipts).toBe(1);
  }, 120_000);

  it('shows actual weak-point795 great failure, paid costs, untreated injury and resident withdrawal', async () => {
    const { boundary, value } = captured('failure'), state = boundary.final;
    expect(state).toMatchObject({ revision: 796, week: 174, health: 84, mind: 77, spirituality: 122,
      cash: 0, actionsRemaining: 1, injuryRisk: 2, ending: null });
    expect([boundary.beforeLast.health - state.health, boundary.beforeLast.mind - state.mind,
      boundary.beforeLast.spirituality - state.spirituality, boundary.beforeLast.actionsRemaining - state.actionsRemaining])
      .toEqual([16, 15, 16, 1]);
    expect(state.lastCheck).toMatchObject({ chance: 70, roll: 96, tier: 'GREAT_FAILURE' });
    expect(state.injuries).toEqual([{ id: 'R214:reader-rebuild-natural:796:structural-strain', severity: 'HEAVY', acquiredRevision: 796, treatedRevision: null }]);
    const game = publicAdapter(value); await openPage(game);
    const panel = assertCurrentPage(value, state); await assertAbilities(value, state, [8, 0]);
    const result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['大失败 · 意志检定', '本次成功率 70%，实际掷骰 96', '本场不能重抽', '健康变化-16，精神变化-15，灵性变化-16'])
      expect(result.textContent).toContain(text);
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('1. 重伤 · 未处理');
    const incident = within(panel).getByRole('region', { name: '同一机械结构上的有限应对' });
    expect(incident.textContent).toContain('本人0米；瑟拉（39岁）0米，已撤回同行');
    expect(incident.textContent).toContain('原连接杆回震飞出碎屑，在入口造成一次擦伤');
    expect(incident.textContent).toContain('有限弱点：已尝试，未证明实际应用');
    const exits = within(panel).getByRole('region', { name: '暂停与安全返回' });
    for (const label of ['用原止动扣普通卸力并锁开闸', '本人独自卸力并沿侧路实退']) {
      const button = within(exits).getByRole('button', { name: label });
      expect(button.closest('details')).toBeNull(); expect(disabled(button)).toBe(false);
    }
    expect(disabled(within(exits).getByRole('button', { name: '与同处愿意的瑟拉沿普通侧路离开' }))).toBe(true);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  }, 60_000);

  it('reopens report803 with actual return, old people and objects, retained debt, injuries and mastery', async () => {
    const { boundary, value } = captured('report'), state = boundary.final, epilogue = state.whiteTower.epilogue!;
    expect(state).toMatchObject({ revision: 804, week: 174, status: 'ACTIVE', health: 84, mind: 77,
      spirituality: 122, cash: 0, actionsRemaining: 1, injuryRisk: 2, ending: null, lastCheck: null });
    expect(value.debtTotal).toBe(80);
    expect(epilogue).toMatchObject({ status: 'RESOLVED', position: 12, reported: true,
      insight: { passed: true, applied: true }, weakness: { passed: false, applied: false },
      resident: { position: 12, consent: 'ACCEPT', arrival: { route: 'GATE_THEN_SIDE' } },
      gate: { version: 4, condition: 74, locked: true, strut: { loaded: false } } });
    expect(epilogue.resident.permissionHistory.map(item => item.answer)).toEqual(['ACCEPT', 'WITHDRAWN', 'ACCEPT', 'WITHDRAWN', 'ACCEPT']);
    expect(epilogue.journal.slice(-2).map(event => event.command.type)).toEqual(['ORDINARY_SIDE_EXIT', 'REPORT']);
    const game = publicAdapter(value), first = await openPage(game);
    async function assertReport() {
      const panel = assertCurrentPage(value, state); await assertAbilities(value, state, [8, 0]);
      const incident = within(panel).getByRole('region', { name: '同一机械结构上的有限应对' });
      expect(incident.closest('details')).toBeNull();
      for (const text of ['本人12米；瑟拉（39岁）12米', '在入口造成一次擦伤', '版本4，状况74', '结构洞察：已帮助一次独立实测，掌握增8', '有限弱点：已尝试，未证明实际应用'])
        expect(incident.textContent).toContain(text);
      await userEvent.click(within(panel).getByText('三处通路与原居民记录', { selector: 'summary' }));
      const passages = within(panel).getByRole('region', { name: '三条真实通路与隔周复核' });
      for (const text of ['伊娃（34岁）24米/24米', '利昂（46岁）30米/30米', '米娜（29岁）18米/18米']) expect(passages.textContent).toContain(text);
      await userEvent.click(within(panel).getByText('过往经历与个人账目', { selector: 'summary' }));
      const originals = within(panel).getByRole('region', { name: '原人原物的已知去向' });
      for (const text of ['埃德温·罗斯：已投降', '原杖仍归本人，留在原庭院，储能0', 'WA2-SHEET-1', 'WA2-SHEET-2', '原滑块与止挡块归本人，已经停止']) expect(originals.textContent).toContain(text);
      expect(within(panel).getByRole('region', { name: '实际工资、生活与旧债' }).textContent).toContain('未付本金80便士');
      expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('1. 重伤 · 未处理');
      const result = within(panel).getByRole('region', { name: '最近行动结果' });
      expect(result.textContent).toContain('瑟拉实际在12米，本次真实抵达');
      expect(result.textContent).toContain('现款变化0便士；行动变化0，健康变化0，精神变化0，灵性变化0');
      expect(result.textContent).not.toMatch(/实际掷骰|意志检定|掷出96|掷出15/);
      return panel.textContent;
    }
    const firstText = await assertReport(); first.unmount();
    await openPage(game); expect(await assertReport()).toBe(firstText);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled(); expect(game.receipts).toBe(0);
    for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun])
      for (const result of mock.mock.results) assertPublicOnly(await result.value, state);
    expect(hash(state)).toBe(boundary.audit.afterStateSha256);
    expect(hash(boundary.globalPublic)).toBe(PINS.report.publicSha256);
  }, 120_000);
});
