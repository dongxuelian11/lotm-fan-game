/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent } from '../../src/domain/slice/types';
import type { AttendantMysteriesAction } from '../../src/domain/attendant-mysteries/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

vi.setConfig({ testTimeout: 60_000 });
const ROOT = 'tests/fixtures/attendant-mysteries-v01860';
const FIRST_ROUND = `${ROOT}/boundary-same-first-round-revalidated.json`;
const PANEL = '诡秘侍者成长';

/** Only captured living campaign states: no edited name, resources, seed or outcome. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input);
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('This original campaign already exists.');
    expect(envelope.runId).toBe(state.runId);
    expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload);
    assertValidSliceState(state);
    return { ok: true, value: {
      intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T08:50:00Z', replayed: false, state: projectSliceState(state),
    } };
  });
  return { get state() { return state; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status,
        revision: state.revision, updatedAt: '2026-10-15T08:49:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  const rendered = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await screen.findByRole('region', { name: PANEL });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  return { ...rendered, loadRun };
}
const page = (name: string) => within(screen.getByRole('navigation', { name: '诡秘侍者页面' })).getByRole('button', { name });
async function issuedActionControl(action: AttendantMysteriesAction) {
  const primary = screen.queryByRole('region', { name: '当前主要操作' });
  if (!primary || !within(primary).getByRole('button').textContent?.startsWith(action.label)) {
    await userEvent.click(screen.getByText(/^其他操作、普通替代与退出（/, { selector: 'summary' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '其他操作' }), action.id);
  }
  const button = screen.getByRole('button', { name: name => name.startsWith(action.label) });
  expect(button.textContent).toContain(action.cost);
  expect((button as HTMLButtonElement).disabled).toBe(!action.enabled);
  return button;
}
function assertOriginalName(game: SavedGame) {
  const current = projectSliceState(game.state);
  expect(screen.getByRole('banner').textContent).toContain(`${current.character.name} · ${current.attendantMysteries.title}`);
}
function assertBodyRound(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.consequenceDomain).toBe('BODY');
  const outcome = round.attendantMysteriesOutcome;
  if (!outcome || !round.consequenceWeights) throw new Error('Expected the captured first BODY round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).not.toContain('精神后果盘');
  const weights = round.consequenceWeights;
  expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
  const actual = within(reveal).getByRole('region', { name: '诡秘侍者本回合实际记录' });
  expect(actual.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(actual.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(actual.textContent).toContain(outcome.remnantAfter.id);
  expect(actual.textContent).toContain(`剩余${outcome.remnantAfter.segments.filter(segment => segment.status === 'UNUSED').length}段`);
  expect(actual.textContent).toContain(`镇中居民实际参战${outcome.rootAfter.residentsJoined}位`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(actual).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
  });
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

describe('AttendantMysteries actual saved S1 navigation and first BODY round', () => {
  it('opens the living natural S1 town above historical MiracleWorker and AncientScholar pages without replaying their round or revival', async () => {
    const game = savedGame(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'final'));
    const before = structuredClone(game.state), current = projectSliceState(before);
    expect(before.status).toBe('ACTIVE');
    expect(before.progression).toMatchObject({ pathwayId: 'diviner', sequence: 1 });
    expect(current.miracleWorker.promoted).toBe(true);
    expect(before.attendantMysteries.life.reflected).toBe(true);
    await mount(game);
    expect(page('城镇').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: '新城镇总览' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: current.attendantMysteries.title })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '奇迹师' })).toBeNull();
    expect(screen.queryByRole('region', { name: '古代学者' })).toBeNull();
    expect(screen.queryByRole('region', { name: '有限复起待决选择' })).toBeNull();
    expect(screen.queryByRole('button', { name: '完成奇迹师旧实践' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    assertOriginalName(game);
    expect(game.submit).not.toHaveBeenCalled();
    expect(game.state).toEqual(before);
  });

  it('switches completed real practice and original formula pages without new practice, then saves only the issued reception rest', async () => {
    const game = savedGame(readObjectEntry<unknown>(`${ROOT}/natural.json`, 'final'));
    const before = structuredClone(game.state), current = projectSliceState(before).attendantMysteries;
    expect(current.life.actions).toEqual([]);
    expect(current.life.cases.every(entry => entry.status === 'RESOLVED')).toBe(true);
    await mount(game);
    await userEvent.click(page('实践'));
    for (const entry of current.life.cases) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '当前实践' }), entry.id);
      const practice = screen.getByRole('region', { name: '诡秘侍者实践现场' });
      expect(within(practice).getByRole('heading', { name: entry.title })).toBeTruthy();
      if (entry.result) expect(practice.textContent).toContain(entry.result);
    }
    expect(screen.queryByRole('region', { name: '当前主要操作' })).toBeNull();
    await userEvent.click(page('材料与魔药'));
    const materials = screen.getByRole('region', { name: '诡秘侍者材料与魔药' });
    for (const ingredient of current.formula) expect(materials.textContent).toContain(ingredient.name);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(current.bottles[0]!.id);
    const rest = current.actions.find(action => action.command.type === 'RECEPTION_REST' && action.enabled);
    if (!rest) throw new Error('The unchanged natural final must offer actual reception rest.');
    const button = await issuedActionControl(rest);
    expect(game.submit).not.toHaveBeenCalled();
    expect(game.state).toEqual(before);
    await userEvent.click(button);
    const confirmation = screen.getByRole('dialog', { name: '诡秘侍者操作确认' });
    expect(confirmation.textContent).toContain(rest.cost);
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(confirmation).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.submit.mock.calls[0]![0].payload).toEqual({ type: 'ATTENDANT_MYSTERIES', command: rest.command });
    expect(game.state).toEqual(applySliceIntent(before, { type: 'ATTENDANT_MYSTERIES', command: rest.command }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '诡秘侍者操作确认' })).toBeNull());
    expect(page('材料与魔药').getAttribute('aria-pressed')).toBe('true');
    assertOriginalName(game);
  });

  it('saves the captured first DEFEND round and shows its exact BODY consequence and paid original-material action record', async () => {
    const game = savedGame(readObjectEntry<unknown>(FIRST_ROUND, 'beforeLast'));
    const captured = migrateSliceState(readObjectEntry<unknown>(FIRST_ROUND, 'final'));
    const intent = readObjectEntry<SliceIntent>(FIRST_ROUND, 'lastIntent');
    if (intent.type !== 'COMBAT_ROUND') throw new Error('Expected the captured first combat command.');
    expect(intent.stance).toBe('DEFEND');
    const before = structuredClone(game.state), battle = projectSliceState(before).combat!;
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const stance = battle.stances.find(entry => entry.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    expect(game.submit).not.toHaveBeenCalled();
    expect(game.state).toEqual(before);
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.submit.mock.calls[0]![0].payload).toEqual(intent);
    expect(game.state).toEqual(captured);
    expect(game.state.health).toBe(90);
    expect(game.state.injuryRisk).toBe(1);
    expect(game.state.injuries.at(-1)).toMatchObject({ severity: 'LIGHT', treatedRevision: null });
    assertBodyRound(reveal, captured.lastCombatRound!);
    assertOriginalName(game);
  });

  it('reopens the actual first round twice without commands or rerolls, retaining the original name and current original-body resources', async () => {
    const game = savedGame(readObjectEntry<unknown>(FIRST_ROUND, 'final'));
    const before = structuredClone(game.state), current = projectSliceState(before), battle = current.combat!;
    const actual = battle.attendantMysteries!;
    expect(before.character.name).toBe('莉娜');
    for (let opening = 0; opening < 2; opening++) {
      const mounted = await mount(game);
      const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
      assertBodyRound(reveal, before.lastCombatRound!);
      await userEvent.click(within(reveal).getByRole('checkbox', { name: '快速显示本回合结果' }));
      expect(game.submit).not.toHaveBeenCalled();
      await userEvent.click(within(reveal).getByRole('button', { name: '进入下一回合' }));
      const stage = await screen.findByRole('dialog', { name: battle.title! });
      expect(within(stage).getByRole('heading', { name: before.character.name })).toBeTruthy();
      const resources = within(stage).getByRole('region', { name: '诡秘侍者本回合实际资源' });
      expect(resources.textContent).toContain(`本人健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
      expect(resources.textContent).toContain(`${actual.enemyName}：健康${actual.enemyHealth}、精神${actual.enemyMind}、灵性${actual.enemySpirituality}`);
      expect(resources.textContent).toContain(actual.remnant.id);
      expect(resources.textContent).toContain(actual.remnant.sourceId);
      expect(resources.textContent).toContain(`尚可耗用${actual.remainingMaterialSegments}段`);
      expect(stage.textContent).not.toContain('精神后果盘');
      expect(screen.queryByRole('region', { name: '奇迹师' })).toBeNull();
      assertOriginalName(game);
      expect(game.submit).not.toHaveBeenCalled();
      expect(game.state).toEqual(before);
      mounted.unmount();
    }
  });
});
