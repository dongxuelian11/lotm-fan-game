/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { StarKeyCommand } from '../../src/domain/star-key/types';
import type { StarKeyActivityCommand, StarKeyCaseId } from '../../src/domain/star-key/life';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { stableStringify } from '../../src/domain/canonical';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format';
import { readObjectEntry } from '../helpers/read-object-entry';
import { ae, dose, ordinary, originalDoorRoots, originalPlaneswalker, planeswalkerNaturalPath, prepared, promoted, ready } from '../domain/star-key-directed-helper';

vi.setConfig({ testTimeout: 120_000 });
const PANEL = '星之匙成长', ENTRY = '星之匙与通行室', CONFIRM = '星之匙操作确认';
const ENDPOINT = 'door.s1.endpoint-location', ANCHOR = 'door.s1.anchor-maintenance';
const EDITORIAL = /候选|原创G|本作G|原文未核|编号推断|来源未知|\"command\"|\"beforeLast\"/;

/** Directed public continuation of the real living701 boundary. These helpers
 * never edit a body, resource, result, mastery, random seed or cursor. They are
 * not a new natural producer capture; actual potion/check failures remain. */
function act(state: SliceState, ...commands: StarKeyCommand[]): SliceState {
  for (const command of commands) state = ae(state, command);
  assertValidSliceState(state);
  return state;
}
function enter(state: SliceState, caseId: StarKeyCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', lastAp = false): SliceState {
  state = act(ready(state), { type: 'OBSERVE', caseId });
  state = ready(state, { ap: 1, cash: 10, mind: 10, spirituality: 10 });
  if (lastAp) while (state.actionsRemaining > 1) state = ordinary(state);
  if (state.planeswalker.life.site.playerLocation === 'OUTSIDE') state = act(state, { type: 'WALK_TO_ROOM' });
  return act(state, { type: 'INVITE', caseId, method }, { type: 'READ_SOURCE' },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OPERATOR' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' },
    { type: 'AGREE_RETURN' }, { type: 'OPEN_DOOR' }, { type: 'INSPECT_PADS' }, { type: 'READ_RETURN_MARKER' },
    { type: 'TAKE_PARCEL' }, { type: 'WALK_NEAR' }, { type: 'OBSERVE_ENDPOINT' });
}
function finish(state: SliceState, caseId: StarKeyCaseId): SliceState {
  if (state.starKey.life.pending) state = act(state, { type: 'STOP_METHOD' });
  if (state.planeswalker.life.site.playerLocation !== 'ENTRY' || state.planeswalker.life.site.operatorLocation !== 'ENTRY') state = act(state, { type: 'WALK_ENTRY' });
  if (state.planeswalker.life.site.parcel.location === 'PLAYER') state = act(state, { type: 'RETURN_PARCEL' });
  if (state.planeswalker.life.site.door.state === 'OPEN') state = act(state, { type: 'CLOSE_DOOR' });
  state = act(state, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
  return act(ready(state), { type: 'REPORT', caseId });
}
let firstCache: SliceState | undefined, secondCache: SliceState | undefined, practicedCache: SliceState | undefined;
function afterFirst(): SliceState {
  if (!firstCache) {
    let state = act(enter(promoted(), 'endpoint-verification', 'ORDINARY'), { type: 'WALK_VERIFY' });
    if (!state.starKey.life.cases['endpoint-verification'].attempts.at(-1)!.walkVerified) state = act(state, { type: 'MANUAL_VERIFY' });
    firstCache = finish(state, 'endpoint-verification');
  }
  return structuredClone(firstCache);
}
function afterSecond(): SliceState {
  if (!secondCache) secondCache = finish(act(enter(afterFirst(), 'anchor-transfer', 'ORDINARY'), { type: 'WALK_CARRY' }), 'anchor-transfer');
  return structuredClone(secondCache);
}
function practiced(): SliceState {
  if (!practicedCache) {
    const state = finish(act(enter(afterSecond(), 'withdrawn-return', 'ORDINARY'), { type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' }), 'withdrawn-return');
    practicedCache = act(ready(state), { type: 'REFLECT' });
  }
  return structuredClone(practicedCache);
}
function boundary(before: SliceState, command: StarKeyCommand) {
  const intent: SliceIntent = { type: 'STAR_KEY', command };
  const final = applySliceIntent(before, intent);
  assertValidSliceState(before); assertValidSliceState(final);
  return { before, intent, final };
}
type Boundary = ReturnType<typeof boundary>;

/** The fake bridge models one authoritative saved state. Failed persistence
 * does not apply a command; retry must retain the exact original envelope. */
function savedGame(input: unknown, failFirst = false) {
  let state = migrateSliceState(input), commits = 0;
  assertValidSliceState(state);
  expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    if (failFirst) {
      failFirst = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next);
    state = next; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-15T20:30:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: state, runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status,
        revision: state.revision, updatedAt: '2026-10-15T20:29:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  assertAuthoredCopy(game.state);
}
async function reopen(game: SavedGame) { cleanup(); await mount(game); }
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
  }
}
async function ensurePanel() {
  await acknowledgeRound();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function assertAuthoredCopy(state: SliceState) {
  expect(document.body.textContent!.split(state.character.name).join('')).not.toMatch(EDITORIAL);
}
function assertResources(state: SliceState) {
  const projected = projectSliceState(state), resources = screen.getByRole('region', { name: '星之匙当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${projected.starKey.title}`);
  expect(resources.textContent).toContain(`健康${projected.health}/${projected.maxHealth} · 精神${projected.mind}/${projected.maxMind} · 灵性${projected.spirituality}/${projected.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
  expect(resources.textContent).toContain(projected.starKey.resources!.cash);
}
async function assertOriginalFacts(state: SliceState) {
  const summary = screen.getByText('原通行室、玛拉与旧物当前记录', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  const original = screen.getByRole('region', { name: '原通行室当前状态' }), site = state.planeswalker.life.site;
  const place = { ENTRY: '原入口', NEAR: '近台', FAR: '远台', OUTSIDE: '通行室外', REMOTE: '异星原地点' };
  expect(original.textContent).toContain(`${site.operatorName} · ${site.operatorAge}岁，当前在${place[site.operatorLocation]}，精力${site.operatorEnergy}/100，累计实走${site.operatorMetres}米`);
  expect(original.textContent).toContain(`本人当前在${place[site.playerLocation]}，累计普通步行${site.playerMetres}米、既往异星行程${site.playerAstralLegs}程`);
  expect(original.textContent).toContain(`数量${site.parcel.quantity}`);
  expect(original.textContent).toContain(`累计普通搬运${site.parcel.ordinaryMetres}米、既往异星行程${site.parcel.astralLegs}程`);
  expect(original.textContent).toContain(`原油灯余油${site.lamp.oilRemaining}份，已实际展示${site.lamp.shows}次`);
  expect(original.textContent).toContain(`已实际应用${site.screen.applications}次`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count = 1) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function publicControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'STAR_KEY') throw new Error('Expected a public Star Key command.');
  const action = projectSliceState(state).starKey.actions.find(entry => stableStringify(entry.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  let button = screen.queryByRole('button', { name: name => name.startsWith(action!.label) });
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '星之匙其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
async function confirm(game: SavedGame, save: Boundary, previousCalls = 0) {
  expect(game.state).toEqual(save.before);
  await userEvent.click(await publicControl(save.before, save.intent));
  expect(game.submit).toHaveBeenCalledTimes(previousCalls);
  const dialog = screen.getByRole('dialog', { name: CONFIRM });
  const button = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(button); fireEvent.click(button);
}
async function commit(game: SavedGame, save: Boundary, count = 1) {
  await confirm(game, save, count - 1);
  await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
  expect(game.state).toEqual(save.final); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
  assertAuthoredCopy(game.state);
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.starKeyOutcome;
  if (!outcome) throw new Error('Expected the actual public Star Key round.');
  const reveal = screen.getByRole('dialog', { name: '战斗回合结果' });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '星之匙本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    if (action.fallbackReason) expect(rows[index]!.textContent).toContain(action.fallbackReason);
    if (action.finiteResult === 'PENDING') expect(rows[index]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
  });
  if (round.consequenceDomain === 'BODY') expect(record.textContent).toContain('本回合按实际身体冲击结算伤势');
  else if (round.consequenceDomain === 'MENTAL') {
    expect(record.textContent).toContain('本回合按实际精神压力结算，不生成身体伤口');
    expect(round.consequenceWeights).toBeNull();
  } else {
    expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(round.consequenceWeights).toBeNull();
  }
  expect(within(reveal).queryByRole('region', { name: '旅法师本回合实际记录' })).toBeNull();
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Star Key original campaign navigation and authoritative reopening', () => {
  it('opens the genuine living701 S2 boundary and preserves its existing growth route', async () => {
    const state = originalPlaneswalker(), game = savedGame(state);
    expect(state).toMatchObject({ revision: 1009, week: 201, status: 'ACTIVE', health: 100, mind: 100,
      spirituality: 120, cash: 5280, actionsRemaining: 3, injuries: [], injuryRisk: 0 });
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await ensurePanel(); assertResources(state); await assertOriginalFacts(state);
    expect(screen.getByRole('region', { name: '星之匙服药准备' })).toBeTruthy();
    expect(projectSliceState(state).starKey).toMatchObject({ promoted: false, guidanceKnown: false, formulaKnown: false, formula: [] });
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '旅法师' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  });

  it('cancels and independently confirms the real first original bottle once without choosing its result', async () => {
    const save = boundary(prepared(), dose), game = savedGame(save.before);
    const bottle = projectSliceState(save.before).starKey.bottles.find(entry => entry.id === dose.bottleId)!;
    await mount(game); await ensurePanel();
    await userEvent.click(await publicControl(save.before, save.intent));
    const dialog = screen.getByRole('dialog', { name: CONFIRM });
    expect(dialog.textContent).toContain(bottle.title); expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向');
    expect(dialog.textContent).toContain('健康−15精神−25排异+30');
    expect(dialog.textContent).not.toContain('确认接受晋升后的身体变化');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(game.state).toEqual(save.before); expect(game.submit).not.toHaveBeenCalled();
    await commit(game, save); await reopen(game); await ensurePanel(); assertResources(save.final);
    expect(game.state.starKey.bottles.find(entry => entry.id === dose.bottleId)!.status).toBe('CONSUMED');
    expect({ ...game.state.character, coreStats: save.before.character.coreStats }).toEqual(save.before.character);
    expect(originalDoorRoots(game.state)).toEqual(originalDoorRoots(save.before));
    expect(game.state).toEqual(save.final); expect(game.commits).toBe(1);
  });

  it('reopens seventeen actual S1 abilities and keeps all original S2 actions read-only', async () => {
    const state = promoted(), game = savedGame(state), source = originalPlaneswalker();
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL }); assertResources(state); await assertOriginalFacts(state);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(state).starKey.abilities;
    expect(abilities).toHaveLength(17);
    expect(abilities.slice(0, 15).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(abilities.slice(15).map(ability => [ability.id, ability.mastery])).toEqual([[ENDPOINT, 0], [ANCHOR, 0]]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(state.planeswalker.life.site).toEqual(source.planeswalker.life.site);
    expect(state.wanderer.life.packet.location).toBe('REMOTE');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: '旅法师与九处星途' }));
    const old = await screen.findByRole('region', { name: '旅法师' });
    expect(projectSliceState(state).planeswalker.actions).toEqual([]);
    expect(within(old).getByRole('region', { name: '旅法师当前行动' }).querySelector('button')).toBeNull();
    await userEvent.click(within(old).getByText('通行室的可选冲突', { selector: 'summary' }));
    const oldEncounter = within(old).getByRole('region', { name: '旅法师可选遭遇' });
    expect(within(oldEncounter).getByRole('heading', { name: '尚未开放的通行室遭遇' })).toBeTruthy();
    expect(oldEncounter.textContent).toContain('尚未接触');
    expect(oldEncounter.textContent).not.toContain('索伦');
    expect(within(old).queryByRole('button', { name: /确认真正交战/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭旅法师页面' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '旅法师' })).toBeNull());
    await ensurePanel(); await reopen(game); await ensurePanel(); assertResources(state);
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  });

  it('holds the authoritative paid-cast state on save failure and retries the identical envelope once', async () => {
    const save = boundary(enter(promoted(), 'endpoint-verification'), { type: 'ENDPOINT_LOCATION' });
    const game = savedGame(save.before, true); await mount(game); assertResources(save.before);
    const resources = screen.getByRole('region', { name: '星之匙当前资源' }).textContent;
    await userEvent.click(await publicControl(save.before, save.intent));
    const dialog = screen.getByRole('dialog', { name: CONFIRM });
    expect(dialog.textContent).toContain('本次消耗8灵性、2精神'); expect(dialog.textContent).toContain('仍须另行普通步行4米核验');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(game.submit).not.toHaveBeenCalled();
    await confirm(game, save); await screen.findByRole('button', { name: '重试这次操作' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertEnvelope(game, save.before, save.intent); expect(game.commits).toBe(0); expect(game.state).toEqual(save.before);
    expect(screen.getByRole('region', { name: '星之匙当前资源' }).textContent).toBe(resources);
    expect((screen.getByRole('combobox', { name: '星之匙目标' }) as HTMLSelectElement).disabled).toBe(true);
    for (const button of within(screen.getByRole('region', { name: PANEL })).queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    const envelope = game.submit.mock.calls[0]![0], retry = screen.getByRole('button', { name: '重试这次操作' });
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope); expect(game.commits).toBe(1);
    await reopen(game); assertResources(save.final); await assertOriginalFacts(save.final);
    expect(game.state.spirituality).toBe(save.before.spirituality - 8); expect(game.state.mind).toBe(save.before.mind - 2);
    expect(game.state.planeswalker.life.site.playerLocation).toBe('NEAR');
    expect(game.state.planeswalker.life.site.parcel).toEqual(save.before.planeswalker.life.site.parcel);
    expect(game.state.starKey.life.cases['endpoint-verification'].attempts.at(-1)).toMatchObject({ endpoint: { attempts: 1, effects: 0 }, walkVerified: false });
    expect(game.state.progression.mastery[ENDPOINT]).toBe(0);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('施放本身不增加掌握');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
  });

  it('saves the separate anchor cast and actual four-metre carry without inventing successful application', async () => {
    const cast = boundary(enter(afterFirst(), 'anchor-transfer'), { type: 'ANCHOR_MAINTENANCE' });
    const carry = boundary(cast.final, { type: 'WALK_CARRY' }), game = savedGame(cast.before);
    await mount(game); await commit(game, cast); await reopen(game); assertResources(cast.final); await assertOriginalFacts(cast.final);
    expect(game.state.spirituality).toBe(cast.before.spirituality - 7); expect(game.state.mind).toBe(cast.before.mind - 2);
    expect(game.state.starKey.life.cases['anchor-transfer'].attempts.at(-1)).toMatchObject({ anchor: { attempts: 1, effects: 0 }, walkCarried: false });
    expect(game.state.planeswalker.life.site.playerMetres).toBe(cast.before.planeswalker.life.site.playerMetres);
    expect(game.state.progression.mastery[ANCHOR]).toBe(0);
    await commit(game, carry, 2); await reopen(game); assertResources(carry.final); await assertOriginalFacts(carry.final);
    expect(game.state.planeswalker.life.site).toMatchObject({ playerLocation: 'FAR', parcel: { id: 'PW2-PARCEL', quantity: 1, location: 'PLAYER' } });
    expect(game.state.planeswalker.life.site.playerMetres).toBe(cast.final.planeswalker.life.site.playerMetres + 4);
    expect(game.state.planeswalker.life.site.parcel.ordinaryMetres).toBe(cast.final.planeswalker.life.site.parcel.ordinaryMetres + 4);
    expect(game.state.starKey.life.pending).toBeNull();
    expect(game.state.starKey.life.cases['anchor-transfer'].attempts.at(-1)!.walkCarried).toBe(true);
    expect(game.state.planeswalker.life.site.lamp).toEqual(cast.before.planeswalker.life.site.lamp);
    expect(game.state.planeswalker.life.site.screen).toEqual(cast.before.planeswalker.life.site.screen);
    expect(game.state).toEqual(carry.final); expect(game.commits).toBe(2);
  });

  it('reopens current withdrawal and ordinary zero-AP cleanup with the same parcel and actual Mara energy', async () => {
    const state = act(enter(afterSecond(), 'withdrawn-return', 'ABILITY', true), { type: 'ANCHOR_MAINTENANCE' });
    expect(state.actionsRemaining).toBe(0);
    const game = savedGame(state); await mount(game);
    const withdrawal = boundary(state, { type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' });
    await commit(game, withdrawal); await reopen(game); assertResources(withdrawal.final); await assertOriginalFacts(withdrawal.final);
    expect(game.state.starKey.life.pending).toBeNull(); expect(game.state.planeswalker.life.site.operatorConsent).toBe('WITHDRAWN');
    expect(game.state.planeswalker.life.site.playerLocation).toBe('NEAR'); expect(game.state.planeswalker.life.site.parcel.location).toBe('PLAYER');
    expect(game.state.spirituality).toBe(state.spirituality); expect(game.state.mind).toBe(state.mind);
    const beforeCleanup = structuredClone(game.state.planeswalker.life.site);
    const commands: StarKeyActivityCommand[] = [{ type: 'WALK_ENTRY' }, { type: 'RETURN_PARCEL' }, { type: 'CLOSE_DOOR' }, { type: 'EXIT_ROOM' }, { type: 'LEAVE' }];
    for (const [index, command] of commands.entries()) {
      expect(game.state.actionsRemaining).toBe(0);
      const save = boundary(game.state, command); await commit(game, save, index + 2);
      const receipt = game.state.starKey.life.journal.at(-1)!;
      expect(receipt.before.actions).toBe(0); expect(receipt.after.actions).toBe(0);
      expect(game.state.spirituality).toBe(state.spirituality); expect(game.state.mind).toBe(state.mind);
    }
    await reopen(game); await ensurePanel(); assertResources(game.state); await assertOriginalFacts(game.state);
    const site = game.state.planeswalker.life.site;
    expect(site).toMatchObject({ playerLocation: 'OUTSIDE', operatorLocation: 'OUTSIDE', parcel: { location: 'ENTRY_STAND' }, door: { state: 'CLOSED' } });
    expect(site.playerMetres - beforeCleanup.playerMetres).toBe(8);
    expect(site.operatorMetres - beforeCleanup.operatorMetres).toBe(4); expect(site.operatorEnergy).toBe(beforeCleanup.operatorEnergy - 2);
    expect(site.parcel.ordinaryMetres).toBe(beforeCleanup.parcel.ordinaryMetres + 2);
    expect(game.state.week).toBe(state.week + 1); expect(game.state.actionsRemaining).toBe(state.weeklyBudget);
    expect(game.state.starKey.life.cases['withdrawn-return']).toMatchObject({ status: 'EXAMINED', result: 'ORDINARY', returned: true, contactOpen: false });
    expect(game.state.progression.mastery[ANCHOR]).toBe(0); expect(game.commits).toBe(6);
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  });

  it('prioritizes the actual new battle and round over inherited history on complete reopening', async () => {
    const state = act(ready(practiced(), { ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 }),
      { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_POLICY', policy: 'ALL' });
    const start = boundary(state, { type: 'ENCOUNTER_FIGHT' }), game = savedGame(state);
    await mount(game); await ensurePanel(); await commit(game, start);
    const battle = projectSliceState(start.final).combat!;
    expect(start.final.combat).toMatchObject({ encounterId: 'STAR_KEY_DISPUTE', round: 1, lastRound: null });
    expect(start.final.planeswalker.life.site.operatorLocation).toBe('OUTSIDE');
    await reopen(game);
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '旅法师' })).toBeNull();
    const resources = within(stage).getByRole('region', { name: '星之匙本回合实际资源' });
    expect(resources.textContent).toContain(`${battle.starKey!.enemyName}：健康100、精神100、灵性120`);
    expect(within(stage).queryByRole('region', { name: '旅法师本回合实际资源' })).toBeNull();
    const before = game.state, intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent); assertValidSliceState(expected);
    const stance = battle.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit);
    await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    expect(game.state).toEqual(expected); assertEnvelope(game, before, intent, 2);
    await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    await reopen(game); await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    expect(game.state.planeswalker).toEqual(before.planeswalker); expect(game.commits).toBe(2);
  });

  it('keeps the separate actual707-command death sealed instead of reopening it as a living Star Key source', async () => {
    const raw = readObjectEntry<SliceState>(planeswalkerNaturalPath, 'final'), state = migrateSliceState(raw), game = savedGame(state);
    expect(readObjectEntry<SliceIntent[]>(planeswalkerNaturalPath, 'commands')).toHaveLength(707);
    expect(state.status).toBe('DEAD'); expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH');
    expect(originalDoorRoots(state)).toEqual(originalDoorRoots(raw)); expect(state.lastCombatRound).toEqual(raw.lastCombatRound);
    expect(state.starKey.guidanceKnown).toBe(false); expect(state.starKey.promotionWeek).toBeNull();
    await mount(game); await acknowledgeRound();
    expect(await screen.findByRole('heading', { name: state.ending!.title })).toBeTruthy();
    expect(screen.getByText('只读封存卷宗')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
    expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await reopen(game); await acknowledgeRound();
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  });
});
