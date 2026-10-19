/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { PlaneswalkerCommand } from '../../src/domain/planeswalker/types';
import { PLANESWALKER_ENEMY_ABILITY_WHEEL, PLANESWALKER_ENEMY_COUNT_WHEEL } from '../../src/domain/planeswalker/combat';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/planeswalker-v01740';
const PANEL = '旅法师', ENTRY = '旅法师与九处星途';
const LEGACY = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer'] as const;
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
// These are fresh actual captures, not edited presentation states. The 208-command
// inherited peace branch retains the explicitly directed early S4 provenance.
// Load one boundary/snapshot at a time, never the whole campaign beside the DOM.
function boundary(name: string): Boundary {
  const filename = index[name];
  if (!filename) throw new Error(`Missing actual Planeswalker boundary: ${name}`);
  const raw = JSON.parse(readFileSync(`${ROOT}/${filename}`, 'utf8')) as { beforeLast: unknown; lastIntent: SliceIntent; final: unknown };
  return { beforeLast: migrateSliceState(raw.beforeLast), lastIntent: raw.lastIntent, final: migrateSliceState(raw.final) };
}
function snapshot(name: 'departureStart' | 'promoted' | 'practiced' | 'combatStart'): SliceState {
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
}
const view = (state: SliceState) => projectSliceState(state).planeswalker;
function commandOf(entry: Boundary): PlaneswalkerCommand {
  if (entry.lastIntent.type !== 'PLANESWALKER') throw new Error('Expected an actual Planeswalker command.');
  return entry.lastIntent.command;
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
    state = applySliceIntent(state, envelope.payload);
    assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-14T06:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-14T05:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeReveal() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openPlaneswalker(game: SavedGame) {
  await mount(game);
  await acknowledgeReveal();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  await screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: PlaneswalkerCommand): HTMLButtonElement {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: PlaneswalkerCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId);
  expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of LEGACY) expect(after[key]).toEqual(before[key]);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) {
    if (!id.startsWith('door.s2.')) expect(after.progression.mastery[id]).toBe(mastery);
  }
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
async function submitRecordedRound(game: SavedGame, entry: Boundary) {
  if (entry.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected an actual recorded combat round.');
  const intent = entry.lastIntent, battle = projectSliceState(game.state).combat!;
  const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
  const stance = battle.stances.find(option => option.id === intent.stance)!;
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
  await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
  return screen.findByRole('dialog', { name: '战斗回合结果' });
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

describe('Planeswalker navigation from the original peaceful S3 save', () => {
  it('opens preparation from the exact 208-command peace branch without rewriting its directed early S4 history or old objects', async () => {
    const inherited = boundary('inherited-full-208-peaceful-final').final;
    const oldPath = 'tests/fixtures/wanderer-v01500/peaceful.json';
    const old = migrateSliceState(readObjectEntry<unknown>(oldPath, 'final'));
    expect(inherited).toEqual(old); expect(snapshot('departureStart')).toEqual(inherited);
    const originalCommands = readObjectEntry<SliceIntent[]>(oldPath, 'commands');
    const continuedCommands = readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands');
    expect(originalCommands).toHaveLength(208); expect(continuedCommands).toHaveLength(707);
    expect(continuedCommands.slice(0, 208)).toEqual(originalCommands);
    expect(continuedCommands.slice(208)).toHaveLength(499);
    expect(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'provenance')).toEqual(readObjectEntry<unknown>(oldPath, 'provenance'));
    expect(readObjectEntry<{ kind: string }>(oldPath, 'provenance').kind).toBe('DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER');
    const steps = JSON.parse(readFileSync(`${ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>;
    expect(Object.keys(index)).toHaveLength(100);
    expect(steps['inherited-full-208-peaceful-final']).toBe(208); expect(steps['combat-terminal']).toBe(707);
    const game = savedGame(inherited), before = structuredClone(game.state);
    expect(before.progression).toMatchObject({ pathwayId: 'door', sequence: 3, acting: 100 });
    expect(before.wanderer.life.suit.protectionSeconds).toBe(90);
    expect(before.wanderer.life.energy).toMatchObject({ remaining: 1, spent: 1 });
    expect(before.wanderer.life.packet.location).toBe('REMOTE');
    await mount(game); await acknowledgeReveal();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('漫游者3 → 旅法师2');
    await userEvent.click(within(panel).getByText('身体与此前经历', { selector: 'summary' }));
    for (const text of ['WN3-SUIT', '90秒', 'WN3-ENERGY', '剩1片', 'WN3-PACKET', 'REMOTE']) expect(panel.textContent).toContain(text);
    await userEvent.click(screen.getByRole('button', { name: '关闭旅法师页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    await userEvent.click(screen.getByRole('button', { name: '查看旅法师准备' }));
    await screen.findByRole('region', { name: PANEL });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it.each(['promoted', 'practiced'] as const)('opens the actual %s S2 ability drawer, then closes and reopens without changing mastery', async key => {
    const game = savedGame(snapshot(key)), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2);
    await mount(game);
    // The previous Secrets Sorcerer result is preserved in the save but is not a new S2 reveal.
    expect(before.lastCombatRound?.secretsSorcererOutcome).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL });
    const summary = within(panel).getByText('三案经历与实际技巧掌握', { selector: 'summary' });
    await userEvent.click(summary);
    const abilities = view(game.state).abilities;
    expect(abilities).toHaveLength(15);
    expect(abilities.filter(ability => ability.id.startsWith('door.s2.'))).toHaveLength(2);
    expect(abilities.filter(ability => !ability.id.startsWith('door.s2.'))).toHaveLength(13);
    for (const ability of abilities) {
      expect(summary.closest('details')!.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
    }
    expect(before.progression.mastery['door.s2.symbolic-transit']).toBe(key === 'practiced' ? 8 : 0);
    expect(before.progression.mastery['door.s2.pattern-reproduction']).toBe(0);
    if (key === 'practiced') {
      expect(before.progression.acting).toBe(100);
      expect(before.planeswalker.life.reflected).toBe(true);
      expect(Object.values(before.planeswalker.life.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen)).toBe(true);
    }
    await userEvent.click(screen.getByRole('button', { name: '关闭旅法师页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await screen.findByRole('region', { name: PANEL });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);
});

describe('Planeswalker saved offworld bodies require actual returns', () => {
  it.each(['first-actual-offworld-departure', 'symbolic-transit-actual-offworld-body-and-parcel'] as const)('reloads %s directly into its locked actual scene', async name => {
    const game = savedGame(boundary(name).final), before = structuredClone(game.state);
    expect(view(before).insideCase).toBe(true);
    await mount(game); await acknowledgeReveal();
    const panel = screen.getByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '漫游者' })).toBeNull();
    expect(screen.queryByRole('button', { name: '关闭旅法师页面' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动|^休养，1行动|结束本周/ })).toBeNull();
    const ritual = name === 'first-actual-offworld-departure';
    const marker: PlaneswalkerCommand = ritual ? { type: 'CHECK_RITUAL_RETURN_MARKER' } : { type: 'READ_RETURN_MARKER', caseId: 'symbolic-transit' };
    const actualReturn: PlaneswalkerCommand = ritual ? { type: 'RETURN_RITUAL' } : { type: 'RETURN_LOCAL', caseId: 'symbolic-transit' };
    expect(actionButton(game.state, marker).disabled).toBe(false);
    expect(actionButton(game.state, actualReturn).disabled).toBe(true);
    const returns = within(panel).getByRole('region', { name: '旅法师真实返回与收尾' });
    expect(returns.closest('details')).toBeNull();
    expect(returns.textContent).toContain('关闭页面不替代本人返回');
    if (!ritual) {
      expect(before.planeswalker.life.site.playerLocation).toBe('REMOTE');
      expect(before.planeswalker.life.site.parcel.location).toBe('PLAYER');
      // Only LEAVE is exposed as the public ordinary exit; CLOSE/WITHDRAW are domain aliases.
      for (const type of ['LEAVE', 'CLEANUP'] as const) expect(actionButton(game.state, { type, caseId: 'symbolic-transit' }).disabled).toBe(true);
      expect(view(game.state).actions.some(action => action.command.type === 'CLOSE' || action.command.type === 'WITHDRAW')).toBe(false);
    }
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it.each(['first-actual-paid-return', 'symbolic-transit-paid-actual-return'] as const)('submits %s as its saved physical return, pays once and keeps the original body and equipment', async name => {
    const entry = boundary(name), game = savedGame(entry.beforeLast), before = structuredClone(game.state), command = commandOf(entry);
    await mount(game); await acknowledgeReveal();
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '关闭旅法师页面' })).toBeNull();
    const button = await control(game.state, command);
    expect(button.disabled).toBe(false); await userEvent.click(button);
    await waitFor(() => expect(game.state).toEqual(entry.final));
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(game.state.spirituality).toBe(before.spirituality - 8);
    expect(game.state.random).toEqual(before.random);
    if (command.type === 'RETURN_RITUAL') {
      const prior = before.planeswalker.ritual.visits.at(-1)!, returned = game.state.planeswalker.ritual.visits.at(-1)!;
      expect(game.state.planeswalker.ritual.playerLocation).toBe('LOCAL');
      expect(returned.id).toBe(prior.id); expect(returned.kit.id).toBe(prior.kit.id);
      expect(returned.kit.suit.protectionSeconds).toBe(prior.kit.suit.protectionSeconds - 10);
      expect(returned.kit.energy.filter(piece => piece.status === 'UNUSED')).toHaveLength(0);
      expect(returned.phase).toBe('RETURNED');
    } else {
      expect(command.type).toBe('RETURN_LOCAL');
      const prior = before.planeswalker.life.site, returned = game.state.planeswalker.life.site;
      expect(returned.playerLocation).toBe('ENTRY'); expect(returned.parcel.id).toBe(prior.parcel.id);
      expect(returned.parcel.location).toBe('PLAYER'); expect(returned.playerAstralLegs).toBe(prior.playerAstralLegs + 1);
      expect(returned.kits['symbolic-transit'].protectionSeconds).toBe(prior.kits['symbolic-transit'].protectionSeconds - 10);
      expect(returned.operatorEnergy).toBe(prior.operatorEnergy);
    }
    // Arrival alone does not finish the original kit archive or local cleanup.
    expect(view(game.state).insideCase).toBe(true);
    expect(screen.queryByRole('button', { name: '关闭旅法师页面' })).toBeNull();
  }, 20000);
});

describe('Planeswalker application saves keep the original pending intent', () => {
  it('separately confirms the actual third bottle and consumes only its own three auxiliary originals', async () => {
    const entry = boundary('promotion'), game = savedGame(entry.beforeLast), before = structuredClone(game.state), command = commandOf(entry);
    expect(command).toEqual({ type: 'CONSUME', bottleId: 'planeswalker-potion-3', confirmed: true });
    await openPlaneswalker(game); await userEvent.click(await control(game.state, command));
    let review = screen.getByRole('dialog', { name: '独立确认服用这一药瓶' });
    expect(review.textContent).toContain('planeswalker-potion-3');
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(game.state, command));
    review = screen.getByRole('dialog', { name: '独立确认服用这一药瓶' });
    await userEvent.click(within(review).getByRole('button', { name: '确认服用这一药瓶' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(game.state.progression.sequence).toBe(2);
    expect(game.state.planeswalker.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'GREAT_FAILURE', 'SUCCESS']);
    expect(game.state.planeswalker.bottles.slice(0, 2)).toEqual(before.planeswalker.bottles.slice(0, 2));
    expect(game.state.planeswalker.bottles[2]!.auxiliaryKit.items.every(item => item.status === 'CONSUMED')).toBe(true);
    expect(game.state.planeswalker.ritual).toEqual(before.planeswalker.ritual);
    expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull();
  }, 20000);

  it('does not issue a second purchase envelope while the actual first bottle save is pending', async () => {
    const entry = boundary('buy-independent-bottle-and-three-original-worms');
    const game = savedGame(entry.beforeLast, { deferFirstSave: true }), before = structuredClone(game.state), command = commandOf(entry);
    await openPlaneswalker(game); await userEvent.click(await control(game.state, command));
    const review = screen.getByRole('dialog', { name: '确认本次消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' }) as HTMLButtonElement;
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.submit).toHaveBeenCalledOnce());
    const pending = vi.mocked(game.submit).mock.calls[0]![0];
    expect(pending).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: entry.lastIntent });
    expect(confirm.disabled).toBe(true); expect(game.state).toEqual(before);
    expect((screen.getByRole('button', { name: '关闭旅法师页面' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(review, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '确认本次消耗与风险' })).toBeTruthy();
    await act(async () => { game.releaseFirstSave(); });
    await waitFor(() => expect(game.state).toEqual(entry.final));
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(vi.mocked(game.submit).mock.calls[0]![0].intentId).toBe(pending.intentId);
  }, 20000);

  it('retries a failed third-bottle save with exactly the same intent ID, original bottle and revision', async () => {
    const entry = boundary('promotion'), game = savedGame(entry.beforeLast, { failFirstSave: true });
    const before = structuredClone(game.state), command = commandOf(entry);
    await openPlaneswalker(game); await userEvent.click(await control(game.state, command));
    await userEvent.click(within(screen.getByRole('dialog', { name: '独立确认服用这一药瓶' })).getByRole('button', { name: '确认服用这一药瓶' }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledOnce();
    const original = vi.mocked(game.submit).mock.calls[0]![0];
    const review = screen.getByRole('dialog', { name: '独立确认服用这一药瓶' });
    const confirm = within(review).getByRole('button', { name: '确认服用这一药瓶' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm);
    fireEvent.keyDown(review, { key: 'Escape' }); fireEvent(review, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeTruthy();
    expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(original);
    expect(calls[1]![0].intentId).toBe(original.intentId);
    expect(original).toMatchObject({ runId: before.runId, expectedRevision: before.revision, payload: entry.lastIntent });
    assertLegacy(before, game.state);
    expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull();
  }, 20000);
});

describe('Planeswalker actual battle resources, physical consequences and sealed death', () => {
  it('shows the actual new opponent wheels and independent current resources rather than inherited Wanderer combat', async () => {
    const game = savedGame(snapshot('combatStart')), before = structuredClone(game.state);
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const battle = projectSliceState(game.state).combat!, dialog = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(before.combat?.encounterId).toBe('PLANESWALKER_DISPUTE');
    expect(battle.enemyName).toContain('索伦');
    expect(battle.enemyAbilityWheel).toEqual(PLANESWALKER_ENEMY_ABILITY_WHEEL);
    expect(battle.enemyCountWheel).toEqual(PLANESWALKER_ENEMY_COUNT_WHEEL);
    const resources = within(dialog).getByRole('region', { name: '旅法师本回合实际资源' });
    for (const text of ['索伦', '独立灵性', '原遮门', '玛拉', '原灯油', '原屏', '异星行程']) expect(resources.textContent).toContain(text);
    expect(within(dialog).queryByRole('region', { name: '漫游者本回合实际资源' })).toBeNull();
    await userEvent.click(within(dialog).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of PLANESWALKER_ENEMY_ABILITY_WHEEL) expect(dialog.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('submits the captured first CONTROL round and reveals its new saved outcome without replaying the old S4 battle', async () => {
    const entry = boundary('combat-first'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    expect(entry.lastIntent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(before.lastCombatRound?.secretsSorcererOutcome).toBeTruthy();
    await mount(game); await acknowledgeReveal();
    const reveal = await submitRecordedRound(game, entry);
    expect(game.state).toEqual(entry.final); assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(game.state.lastCombatRound!.planeswalkerOutcome).toBeTruthy();
    expect(within(reveal).getByRole('heading', { name: '第 1 回合完整记录' })).toBeTruthy();
    expect(game.state.lastCombatRound!.consequenceWeights).toBeNull();
    expect(reveal.textContent).not.toContain('精神后果盘');
    const saved = structuredClone(game.state);
    await userEvent.click(within(reveal).getByRole('checkbox', { name: '快速显示本回合结果' }));
    await userEvent.click(within(reveal).getByRole('button', { name: '进入下一回合' }));
    const stage = screen.getByRole('dialog', { name: projectSliceState(game.state).combat!.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByText('回看第 1 回合完整记录', { selector: 'summary' }));
    expect(game.state).toEqual(saved); expect(game.submit).toHaveBeenCalledOnce();
  }, 20000);

  it('reloads the actual fourth-round roll 98 death on the physical 65/30/5 wheel and keeps its archive read-only', async () => {
    const game = savedGame(boundary('combat-terminal').final), before = structuredClone(game.state);
    expect(before).toMatchObject({ status: 'DEAD', health: 0, mind: 100, spirituality: 100 });
    expect(before.lastCombatRound).toMatchObject({ round: 4, consequenceRoll: 98, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    expect(before.planeswalker.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', enemyHealth: 90, enemySpirituality: 84, enemyStatus: 'RESISTING' });
    expect(before.planeswalker.life.site.playerLocation).toBe('FAR');
    await mount(game);
    // Mount deliberately does not acknowledge results. Legacy Wanderer history must
    // not suppress this newly saved Planeswalker outcome when the run is reloaded.
    const reveal = screen.getByRole('dialog', { name: '战斗回合结果' });
    expect(reveal.textContent).toContain('败者后果盘：轻伤 65% · 重伤 30% · 死亡 5%');
    expect(reveal.textContent).not.toContain('精神后果盘'); expect(reveal.textContent).not.toContain('损耗40点');
    await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
    await screen.findByRole('heading', { name: before.ending!.title });
    expect(screen.queryByRole('button', { name: /继续生活|进入下一回合|确认姿态|复起|复活/ })).toBeNull();
    expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动|^休养，1行动/ })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20000);

  it('commits the captured fatal round and seals the same original body without opening a resumable growth page', async () => {
    const entry = boundary('combat-terminal'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    expect(before.status).toBe('ACTIVE'); expect(before.health).toBe(100);
    await mount(game); await acknowledgeReveal();
    const reveal = await submitRecordedRound(game, entry);
    expect(game.state).toEqual(entry.final); assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    expect(reveal.textContent).toContain('败者后果盘：轻伤 65% · 重伤 30% · 死亡 5%');
    await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
    await screen.findByRole('heading', { name: entry.final.ending!.title });
    expect(screen.queryByRole('button', { name: /继续生活|进入下一回合|复起|复活/ })).toBeNull();
    expect(game.state.planeswalker.life.site.parcel).toEqual(before.planeswalker.life.site.parcel);
    expect(game.submit).toHaveBeenCalledOnce();
  }, 20000);
});
