/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import type { SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format';
import { deceitMentorDeathPath, loadTimeWormFixture, originalErrorRoots, originalFateTrojan, promoted } from '../domain/time-worm-directed-helper';

vi.setConfig({ testTimeout: 120_000 });
const PANEL = '时之虫成长', ENTRY = '时之虫与登记室';

// The existing actual551 source and its directed public continuation are used
// unchanged. These navigation tests produce no new natural capture or outcome.
async function mount(state: SliceState) {
  assertValidSliceState(state);
  expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  const value = projectSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async () => { throw new Error('Navigation must not submit a gameplay intent.'); });
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-15T21:00:00Z' }],
    } })), loadRun, submitIntent: submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (value.ending ? screen.queryByRole('heading', { name: value.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  return submit;
}
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
  }
}
async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
async function closePanel() {
  await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })).toBeNull());
}
async function assertSavedFacts(state: SliceState) {
  const value = projectSliceState(state), resources = screen.getByRole('region', { name: '时之虫当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${value.timeWorm.title}`);
  expect(resources.textContent).toContain(`健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
  expect(resources.textContent).toContain(`${value.timeWorm.resources!.cash} · 本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
  await userEvent.click(screen.getByText('原登记室、原人和旧物当前记录', { selector: 'summary' }));
  const original = screen.getByRole('region', { name: '原登记室当前状态' }), site = state.fateTrojan.life.site;
  expect(original.textContent).toContain(`精力${site.playerEnergy}/100，累计普通步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
  for (const person of [site.lina, site.victor]) {
    expect(original.textContent).toContain(`${person.name} · ${person.age}岁`);
    expect(original.textContent).toContain(`独立精力${person.energy}/100，累计实走${person.travelMetres}米`);
  }
  expect(original.textContent).toContain(`唯一原包数量${site.parcel.quantity}`);
  expect(original.textContent).toContain(`累计实际搬运${site.parcel.ordinaryMetres}米`);
  expect(original.textContent).toContain(`原报酬已实付本人${site.fate.paidToPlayer}便士`);
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

describe('Time Worm saved campaign navigation and progression routing', () => {
  it('opens the real injured S2 source without treatment and keeps its original growth route', async () => {
    const state = originalFateTrojan(), before = structuredClone(state), submit = await mount(state);
    expect(state).toMatchObject({ revision: 552, week: 127, health: 40, mind: 100, spirituality: 90,
      cash: 472, actionsRemaining: 3, injuryRisk: 2, progression: { pathwayId: 'error', sequence: 2 } });
    await acknowledgeRound(); await openPanel(); await assertSavedFacts(state);
    expect(screen.getByRole('region', { name: '时之虫服药准备' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '时之虫当前资源' }).textContent).toContain('伤势3：重伤 · 尚未治疗');
    expect(projectSliceState(state).timeWorm).toMatchObject({ promoted: false, guidanceKnown: false, formulaKnown: false, formula: [] });
    await closePanel();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '命运木马' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭命运木马页面' }));
    await userEvent.click(screen.getByRole('button', { name: '查看登记室与晋升' }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy();
    expect(state).toEqual(before); expect(submit).not.toHaveBeenCalled();
  });

  it('routes S1 growth to sixteen actual abilities while retaining the old S2 page as read-only history', async () => {
    const state = promoted(), before = structuredClone(state), source = originalFateTrojan(), submit = await mount(state);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL }); await assertSavedFacts(state);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(state).timeWorm.abilities;
    expect(abilities).toHaveLength(16);
    expect(abilities.slice(0, 14).map(ability => [ability.id, ability.mastery])).toEqual(
      abilities.slice(0, 14).map(ability => [ability.id, source.progression.mastery[ability.id]]));
    expect(abilities.slice(0, 14).filter(ability => ability.mastery === 0)).toHaveLength(1);
    expect(abilities.slice(14).map(ability => [ability.id, ability.mastery])).toEqual([
      ['error.s1.short-time-theft', 0], ['error.s1.time-release', 0],
    ]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(originalErrorRoots(state)).toEqual(originalErrorRoots(source));
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: '命运木马与身份登记所' }));
    const old = await screen.findByRole('region', { name: '命运木马' });
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(projectSliceState(state).fateTrojan.actions).toEqual([]);
    expect(within(old).getByRole('region', { name: '命运木马当前行动' }).querySelector('button')).toBeNull();
    expect(within(old).queryByRole('button', { name: /确认.*交战/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭命运木马页面' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '命运木马' })).toBeNull();
    expect(state).toEqual(before); expect(submit).not.toHaveBeenCalled();
    cleanup(); const reopened = await mount(state); await openPanel(); await assertSavedFacts(state);
    expect(state).toEqual(before); expect(reopened).not.toHaveBeenCalled();
  });

  it('keeps the separate earlier death sealed instead of offering a living Time Worm continuation', async () => {
    const state = loadTimeWormFixture(deceitMentorDeathPath, 'final'), before = structuredClone(state);
    expect(state.status).toBe('DEAD'); expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH');
    expect(state.timeWorm.guidanceKnown).toBe(false); expect(state.timeWorm.promotionWeek).toBeNull();
    const submit = await mount(state); await acknowledgeRound();
    expect(await screen.findByRole('heading', { name: state.ending!.title })).toBeTruthy();
    expect(screen.getByText('只读封存卷宗')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
    expect(state).toEqual(before); expect(submit).not.toHaveBeenCalled();
    cleanup(); const reopened = await mount(state); await acknowledgeRound();
    expect(state).toEqual(before); expect(reopened).not.toHaveBeenCalled();
  });
});
