/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { DeathConsulCommand } from '../../src/domain/death-consul/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { DEATH_CONSUL_ENEMY_ABILITY_WHEEL, DEATH_CONSUL_ENEMY_COUNT_WHEEL } from '../../src/domain/death-consul/combat';
import { readObjectEntry } from '../helpers/read-object-entry';
import { deathConsulSnapshot as snapshot, deathConsulBoundary as boundary, deathConsulBoundaryNames,
  deathLegacyKeys, ferrymanFixturePath } from '../domain/death-consul-helper';

const PANEL = '死亡执政官', ENTRY = '死亡执政官与封存室';
type Boundary = ReturnType<typeof boundary>;
const view = (state: SliceState) => projectSliceState(state).deathConsul;
function commandOf(entry: Boundary): DeathConsulCommand {
  if (entry.lastIntent.type !== 'DEATH_CONSUL') throw new Error('Expected an actual Death Consul command.');
  return entry.lastIntent.command;
}
function actualCombatBoundary(withPhysicalConsequences = false) {
  for (const name of deathConsulBoundaryNames().filter(name => name.startsWith('combat-'))) {
    const entry = boundary(name), round = entry.final.lastCombatRound;
    if (entry.lastIntent.type === 'COMBAT_ROUND' && round?.deathConsulOutcome && (!withPhysicalConsequences || round.consequenceWeights !== null)) return entry;
  }
  throw new Error('No recorded Death Consul combat boundary satisfies the requested display evidence.');
}
function savedGame(input: unknown, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0;
  assertValidSliceState(state);
  let releaseFirstSave = () => {};
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-14T05:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId,
      name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-14T04:59:00Z' }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp/>);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('region', { name: '摆渡人' })
    ?? screen.queryByRole('region', { name: '长期章节' }) ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeReveal() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openDeathConsul(game: SavedGame) {
  await mount(game); await acknowledgeReveal();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  await screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: DeathConsulCommand) {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: DeathConsulCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
const confirmName = (command: DeathConsulCommand) => command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险';
const confirmLabel = (command: DeathConsulCommand) => command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作';
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed); expect(after.character.gender).toBe(before.character.gender);
  for (const key of deathLegacyKeys) expect(after[key]).toEqual(before[key]);
  expect(after.ferryman).toEqual(before.ferryman);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) if (!id.startsWith('death.s2.')) expect(after.progression.mastery[id]).toBe(mastery);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
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

describe('Death Consul routing within the actual later-era shell', () => {
  it('opens the new preparation from the forced Ferryman page of the unchanged611 source', async () => {
    const game = savedGame(readObjectEntry<unknown>(ferrymanFixturePath, 'final')), before = structuredClone(game.state);
    await mount(game); await acknowledgeReveal(); expect(screen.getByRole('region', { name: '摆渡人' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull(); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL }); expect(panel.textContent).toContain('死亡执政官');
    expect(screen.queryByRole('region', { name: '摆渡人' })).toBeNull(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    expect(game.state.ferryman.life.reed.energy).toBe(91); expect(game.state.ferryman.life.reed.travelMetres).toBe(22);
  }, 20000);

  it.each(['promoted', 'practiced'] as const)('opens currentS2 %s with17 real skills while the old era remains available', async key => {
    const game = savedGame(snapshot(key)), before = structuredClone(game.state);
    expect(projectSliceState(game.state).ferryman.era.available).toBe(true); await openDeathConsul(game);
    const panel = screen.getByRole('region', { name: PANEL }); expect(view(game.state).abilities).toHaveLength(17);
    for (const ability of view(game.state).abilities) expect(panel.textContent).toContain(ability.label);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it.each(['pale-residue-prepared', 'short-passage-paid-window', 'withdrawn-passage-current-withdrawal'] as const)('prioritizes actual new scene %s over the historical Ferryman page on reload', async key => {
    const game = savedGame(boundary(key).final), before = structuredClone(game.state);
    expect(view(game.state).insideCase).toBe(true); expect(projectSliceState(game.state).ferryman.era.available).toBe(true);
    await mount(game); expect(screen.getByRole('region', { name: PANEL })).toBeTruthy(); expect(screen.queryByRole('region', { name: '摆渡人' })).toBeNull();
    expect(screen.queryByRole('button', { name: '关闭死亡执政官页面' })).toBeNull(); expect(screen.queryByRole('button', { name: '查看原居所与周期记录' })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('routes ERA_LIFE from the new preparation page to real contemporary care without submitting, healing or opening an old investigation', async () => {
    const game = savedGame(readObjectEntry<unknown>(ferrymanFixturePath, 'final')), before = structuredClone(game.state), current = projectSliceState(game.state);
    expect(current.recovery.nextAction.kind).toBe('ERA_LIFE'); expect(current.recovery.nextAction.enabled).toBe(true); await openDeathConsul(game);
    const recovery = screen.getByRole('region', { name: '伤势与恢复路线' });
    expect(recovery.textContent).toContain('60便士'); expect(recovery.textContent).toContain('8便士');
    await userEvent.click(within(recovery).getByRole('button', { name: current.recovery.nextAction.label }));
    await screen.findByRole('region', { name: '摆渡人' }); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(screen.queryByRole('button', { name: '查看普通诊疗点' })).toBeNull();
    const care = current.ferryman.era.actions.find(a => a.command.type === 'ERA_CARE')!;
    expect(screen.getByRole('button', { name: name => name.startsWith(care.label) })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('closes only the new page and can inspect the actual old residence as read-only history', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state); await openDeathConsul(game);
    await userEvent.click(screen.getByRole('button', { name: '关闭死亡执政官页面' })); await screen.findByRole('region', { name: '摆渡人' });
    await userEvent.click(screen.getByRole('button', { name: '查看原居所与周期记录' }));
    const archive = await screen.findByRole('region', { name: '长期章节' });
    expect(within(archive).queryByRole('button', { name: /劳动|休整|进入接待|过去七天|复起/ })).toBeNull();
    await userEvent.click(within(archive).getByRole('button', { name: '关闭长期章节页面' })); await screen.findByRole('region', { name: '摆渡人' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);
});

describe('Death Consul application submissions retain the same saved intent', () => {
  it('confirms the actual original bottle once and preserves its recorded natural outcome', async () => {
    const entry = boundary('public-consume'), game = savedGame(entry.beforeLast), command = commandOf(entry); await openDeathConsul(game);
    await userEvent.click(await control(game.state, command)); expect(game.submit).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: confirmName(command) });
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    await waitFor(() => expect(game.state).toEqual(entry.final)); assertEnvelope(game, entry.beforeLast, entry.lastIntent); assertLegacy(entry.beforeLast, game.state);
    expect(screen.queryByRole('dialog', { name: confirmName(command) })).toBeNull();
  }, 20000);

  it('cannot issue a second envelope while the first actual purchase is awaiting persistence', async () => {
    const entry = boundary('buy-independent-bottle'), game = savedGame(entry.beforeLast, { deferFirstSave: true }), before = structuredClone(game.state), command = commandOf(entry);
    await openDeathConsul(game); await userEvent.click(await control(game.state, command));
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) });
    fireEvent.click(confirm); fireEvent.click(confirm); await waitFor(() => expect(game.submit).toHaveBeenCalledOnce());
    expect(game.state).toEqual(before); expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await waitFor(() => expect(game.state).toEqual(entry.final));
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
  }, 20000);

  it('retries a failed drink with exactly the same envelope, bottle and revision', async () => {
    const entry = boundary('public-consume'), game = savedGame(entry.beforeLast, { failFirstSave: true }), before = structuredClone(game.state), command = commandOf(entry);
    await openDeathConsul(game); await userEvent.click(await control(game.state, command));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)); expect(game.state).toEqual(before);
    const review = screen.getByRole('dialog', { name: confirmName(command) });
    expect((within(review).getByRole('button', { name: confirmLabel(command) }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(review).getByRole('button', { name: confirmLabel(command) })); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await waitFor(() => expect(game.state).toEqual(entry.final));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual(entry.lastIntent); expect(calls[0]![0].expectedRevision).toBe(before.revision); assertLegacy(before, game.state);
  }, 20000);
});

describe('Death Consul combat reveal and actual physical consequences', () => {
  it('shows the new actual wheels, door, original companion and independent combat budgets', async () => {
    const game = savedGame(snapshot('combatStart')), before = structuredClone(game.state); await mount(game); await acknowledgeReveal();
    const current = projectSliceState(game.state), battle = current.combat!, dialog = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    const resources = screen.getByRole('region', { name: '死亡执政官本回合实际资源' });
    for (const text of ['诺兰', '独立灵性', '原门', '普通退到室外', '原封材剩余']) expect(resources.textContent).toContain(text);
    expect(dialog.textContent).toContain('苍白焰'); expect(dialog.textContent).toContain('灵界短渡');
    expect(battle.enemyAbilityWheel).toEqual(DEATH_CONSUL_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(DEATH_CONSUL_ENEMY_COUNT_WHEEL);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('shows a newly saved deathConsulOutcome instead of swallowing it as old Ferryman history', async () => {
    const entry = actualCombatBoundary(), game = savedGame(entry.beforeLast); await mount(game); await acknowledgeReveal();
    if (entry.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected recorded combat round.');
    const battle = projectSliceState(game.state).combat!, stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    // Select the recorded public stance, not a more favorable alternative.
    const intent = entry.lastIntent, selected = battle.stances.find(option => option.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(selected.label) }));
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(reveal.textContent).toContain(`第 ${entry.final.lastCombatRound!.round} 回合结果`);
    expect(game.state).toEqual(entry.final); expect(game.state.lastCombatRound!.deathConsulOutcome).toBeTruthy();
    assertEnvelope(game, entry.beforeLast, entry.lastIntent); assertLegacy(entry.beforeLast, game.state);
  }, 20000);

  it('reloads a real physical injury result with its recorded light/heavy/death weights', async () => {
    const entry = actualCombatBoundary(true), game = savedGame(entry.final), before = structuredClone(game.state); await mount(game);
    const reveal = screen.getByRole('dialog', { name: '战斗回合结果' }), round = game.state.lastCombatRound!, weights = round.consequenceWeights!;
    expect(reveal.textContent).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
    expect(reveal.textContent).not.toContain('精神后果盘'); expect(reveal.textContent).not.toContain('损耗40点');
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('keeps the actual terminal ending and offers no old-period resurrection for this conflict', async () => {
    const game = savedGame(snapshot('final')), before = structuredClone(game.state); await mount(game); await acknowledgeReveal();
    if (game.state.status === 'DEAD') {
      await screen.findByRole('heading', { name: game.state.ending!.title });
      expect(screen.queryByRole('button', { name: /七天.*复起|等待.*复起|继续不死者/ })).toBeNull(); expect(screen.queryByRole('region', { name: '长期章节' })).toBeNull();
    } else {
      expect(game.state.deathConsul.life.site.playerLocation).toBe('ENTRY'); await screen.findByRole('region', { name: '摆渡人' });
      if (projectSliceState(game.state).recovery.needsAttention) expect(projectSliceState(game.state).recovery.nextAction.kind).toBe('ERA_LIFE');
    }
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);
});
