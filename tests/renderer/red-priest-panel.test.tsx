/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedPriestPanel } from '../../src/renderer/RedPriestPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';

// Small UI-only public fixtures. These tests claim navigation and command delivery,
// not natural campaign progression, promotion, random outcomes or SQLite commits.
function value(): RedPriestProjection {
  return {
    title: '红祭司晋升准备', guidanceKnown: true, promoted: false,
    story: '同一大陆的战事与原物仍须逐项处理。', nextStep: '先处理当前战区的补给与伤员。',
    risk: '交战会留下真实伤亡；撤离不会撤销既有损失。',
    resources: { health: 86, mind: 91, spirituality: 102, cash: '25便士', actionsRemaining: 3 },
    abilities: [{ id: 'hunter.s1.focused-flame', label: '集中焰势', mastery: 0, description: '原有掌握与消耗保留。' }],
    actions: [
      { id: 'work', label: '做一班实际劳动', cost: '1行动，收入24便士', enabled: true, reason: null, command: { type: 'WORK' }, preferredAction: true },
      { id: 'rest', label: '付费休养', cost: '1行动、8便士', enabled: true, reason: null, command: { type: 'REST' } },
      { id: 'next-week', label: '度过七天', cost: '24便士，经过实际七天', enabled: false, reason: '用完本周行动再推进。', command: { type: 'NEXT_WEEK' } },
    ],
    sections: [
      { id: 'campaign-status', title: '当前战区', lines: ['本人仍在原指挥部；西线尚未巩固。'] },
      { id: 'campaign-losses', title: '伤亡与撤离', lines: ['原军团阵亡12人、负伤28人；居民已撤出30人。'] },
      { id: 'materials', title: '原特性与唯一性', lines: ['本人已整合一份；其余原物仍在各自封存处。'] },
    ], insideCase: false,
  };
}
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

describe('Red Priest public panel', () => {
  it('shows current resources, war zone, actual losses, risks and accessible action costs', () => {
    const onCommand = vi.fn(), view = render(<RedPriestPanel value={value()} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('heading', { name: '红祭司晋升准备' })).toBeTruthy();
    expect(view.container.textContent).toContain('健康 86 · 精神 91 · 灵性 102 · 25便士 · 本周行动 3');
    expect(screen.getByRole('region', { name: '当前战区' }).textContent).toContain('西线尚未巩固');
    expect(screen.getByRole('region', { name: '伤亡与撤离' }).textContent).toContain('阵亡12人、负伤28人');
    expect(view.container.textContent).toContain('撤离不会撤销既有损失');
    const button = screen.getByRole('button', { name: '度过七天' });
    expect(disabled(button)).toBe(true);
    const descriptions = button.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent);
    expect(descriptions).toEqual(['24便士，经过实际七天', '用完本周行动再推进。']);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('集中焰势 · 熟练 0');
  });

  it('keeps three main actions and withdrawal visible while folding secondary choices and original-item detail', async () => {
    const current = value();
    current.actions.push(
      { id: 'clinic', label: '求助诊所', cost: '1行动、12便士', enabled: true, reason: null, command: { type: 'CLINIC' } },
      { id: 'withdraw', label: '保护撤离', cost: '仍须支付返程和原军团补给', enabled: true, reason: null, command: { type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } } },
    );
    const onCommand = vi.fn(); render(<RedPriestPanel value={current} busy={false} onCommand={onCommand} />);
    const mainActions = screen.getByRole('region', { name: '眼下该做什么' }).querySelector<HTMLElement>(':scope > .seer-actions')!;
    expect(within(mainActions).getAllByRole('button')).toHaveLength(3);
    expect(within(mainActions).getByRole('button', { name: '保护撤离' })).toBeTruthy();
    expect(within(mainActions).queryByRole('button', { name: '求助诊所' })).toBeNull();
    const more = screen.getByText('其他可选行动', { selector: 'summary' }).closest('details')!;
    const originals = screen.getByText('原物与个人账目', { selector: 'summary' }).closest('details')!;
    expect(more.open).toBe(false); expect(originals.open).toBe(false);
    await userEvent.click(screen.getByText('其他可选行动', { selector: 'summary' }));
    expect(more.open).toBe(true);
    expect(screen.getByRole('button', { name: '求助诊所' })).toBeTruthy();
    await userEvent.click(screen.getByText('原物与个人账目', { selector: 'summary' }));
    expect(originals.open).toBe(true);
    expect(screen.getByRole('region', { name: '原特性与唯一性' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保护撤离' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } });
  });

  it('dispatches once while pending and unlocks only after the next result', () => {
    const onCommand = vi.fn(), current = value(), view = render(<RedPriestPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WORK' });
    expect(disabled(screen.getByRole('button', { name: '付费休养' }))).toBe(true);
    view.rerender(<RedPriestPanel value={current} busy onCommand={onCommand} />);
    const next = value(); next.resources.cash = '49便士'; next.resources.actionsRemaining = 2;
    view.rerender(<RedPriestPanel value={next} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'REST' });
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks action and close controls while %s', reason => {
    const current = value(); if (reason === 'dead') current.resources.health = 0;
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<RedPriestPanel value={current} busy={reason === 'busy'} blocked={reason === 'blocked'}
      error={reason === 'error' ? '尚未确认保存结果。' : null} onCommand={onCommand} onClose={onClose} />);
    for (const button of screen.getAllByRole('button')) { expect(disabled(button)).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('requires a current, cancellable consumption confirmation and submits the original intent only once', () => {
    const current = value();
    current.actions = [{ id: 'consume', label: '服用已核实的原魔药', cost: '消耗这一份原魔药与准备', enabled: true, reason: null,
      command: { type: 'CONSUME', compoundId: 'ui-only-original-compound', confirmed: true } }];
    const onCommand = vi.fn(), view = render(<RedPriestPanel value={current} busy={false} onCommand={onCommand} />);
    const trigger = screen.getByRole('button', { name: '服用已核实的原魔药' });
    fireEvent.click(trigger);
    expect(onCommand).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: '红祭司服药确认' });
    expect(dialog.textContent).toContain('消耗这一份原魔药与准备');
    expect(dialog.textContent).toContain('可能死亡');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const changed = structuredClone(current); changed.resources.cash = '17便士';
    view.rerender(<RedPriestPanel value={changed} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的原魔药' }));
    const confirm = screen.getByRole('button', { name: '确认服用这一份原魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(current.actions[0]!.command);
    expect(disabled(screen.getByRole('button', { name: '取消，继续准备' }))).toBe(true);
  });

  it('renders only public fields, keeping private source, preparation rolls and truth out of text and markup', () => {
    const current = Object.assign(value(), {
      source: { random: { seed: 'PRIVATE_SOURCE_SEED', cursor: 987 }, truth: 'PRIVATE_SOURCE_TRUTH' },
      preparedRoll: { result: 'PRIVATE_PREPARATION_ROLL' }, journal: ['PRIVATE_JOURNAL'],
    });
    const view = render(<RedPriestPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|seed|cursor|preparedRoll|journal/);
  });

  it('keeps S0 rescue losses and ordinary withdrawal available exactly as projected', () => {
    const current = value(); current.promoted = true; current.title = '红祭司 · 战后救援'; current.insideCase = true;
    current.abilities = [{ id: 'hunter.s0.shared-standard', label: '共同旗帜', mastery: 0, description: '实际分队的短时协同。' }];
    current.actions = [{ id: 'withdraw', label: '沿原安全侧线撤出', cost: '未救出的原伤员仍留在原站', enabled: true, reason: null,
      command: { type: 'EPILOGUE', command: { type: 'WITHDRAW' } } }];
    current.sections = [{ id: 'epilogue', title: '运输路救援', lines: ['原分队阵亡1人；已转运2名原伤员，原伤势保留。'] }];
    const onCommand = vi.fn(), view = render(<RedPriestPanel value={current} busy={false} onCommand={onCommand} />);
    expect(view.container.textContent).toContain('共同旗帜 · 熟练 0');
    expect(screen.getByRole('region', { name: '运输路救援' }).textContent).toContain('原分队阵亡1人');
    fireEvent.click(screen.getByRole('button', { name: '沿原安全侧线撤出' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'EPILOGUE', command: { type: 'WITHDRAW' } });
  });
});

function publicGame(panel: RedPriestProjection = value()): SliceProjection {
  const raw = createSliceRun('red-priest-ui-only', sliceDefaultCreationSelection, 'ui-only');
  raw.activeEvent = null;
  const state = projectSliceState(raw);
  state.character.name = '艾琳';
  state.progression = { pathwayId: 'hunter', sequence: panel.promoted ? 0 : 1, mastery: {}, acting: 100, promotionWeek: 12 };
  state.conqueror.discovered = true; state.conqueror.promoted = true; state.conqueror.life.reflected = true;
  state.redPriest = panel;
  state.health = panel.resources.health; state.mind = panel.resources.mind; state.spirituality = panel.resources.spirituality;
  state.cash = 25; state.actionsRemaining = panel.resources.actionsRemaining;
  return state;
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: '2026-10-17T08:00:00Z', replayed: false, state } };
}
function bridge(current: () => SliceProjection, submitIntent: SliceBridge['submitIntent'] = vi.fn()): SliceBridge {
  const state = current();
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: 'desktop' as const, activeState: current(), runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
      date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-17T08:00:00Z',
    }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: current() })), submitIntent,
  };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: /艾琳/ }));
}

describe('Red Priest SliceApp public routing and save boundary', () => {
  it('opens S1 preparation ahead of the promoted Conqueror page and stays usable after guidance succeeds', async () => {
    const panel = value(); panel.guidanceKnown = false;
    panel.actions = [{ id: 'guidance', label: '核对红祭司晋升条件', cost: '不消耗行动', enabled: true, reason: null, command: { type: 'LEARN_GUIDANCE' } }];
    let current = publicGame(panel);
    const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
      current = structuredClone(current); current.revision++; current.redPriest = value();
      return receipt(current, envelope);
    });
    await enter(bridge(() => current, submit));
    await userEvent.click(screen.getByRole('button', { name: '查看红祭司晋升准备' }));
    const region = screen.getByRole('region', { name: panel.title });
    expect(region.closest<HTMLElement>('.slice-shell')?.inert).not.toBe(true);
    expect(screen.queryByRole('region', { name: '征服者成长' })).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '核对红祭司晋升条件' }));
    await screen.findByRole('button', { name: '做一班实际劳动' });
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ payload: { type: 'RED_PRIEST', command: { type: 'LEARN_GUIDANCE' } } }));
    expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
    expect(screen.getByRole('region', { name: panel.title }).closest<HTMLElement>('.slice-shell')?.inert).not.toBe(true);
  });

  it.each([false, true])('reopens the current %s-promoted root instead of old Conqueror rounds without issuing an intent', async promoted => {
    const panel = value(); panel.promoted = promoted; panel.title = promoted ? '红祭司 · 战后救援' : panel.title;
    const current = publicGame(panel);
    // Deliberately minimal obsolete PUBLIC round: if routed into Combat it is
    // insufficient, which catches accidental resurrection of historical UI.
    current.lastCombatRound = { round: 3, conquerorOutcome: {} } as unknown as SliceProjection['lastCombatRound'];
    const api = bridge(() => current);
    for (let opening = 0; opening < 2; opening++) {
      await enter(api);
      expect(screen.getByRole('region', { name: panel.title })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
      expect(screen.queryByRole('region', { name: '征服者成长' })).toBeNull();
      expect(api.submitIntent).not.toHaveBeenCalled();
      cleanup();
    }
    expect(api.loadRun).toHaveBeenCalledTimes(2);
  });

  it('keeps old costs visible after a failed save and retries the identical envelope exactly once', async () => {
    let current = publicGame(), first = true;
    const initialRevision = current.revision;
    const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
      if (first) { first = false; return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } }; }
      current = structuredClone(current); current.revision++; current.cash += 24; current.actionsRemaining--;
      current.redPriest.resources.cash = '49便士'; current.redPriest.resources.actionsRemaining--;
      return receipt(current, envelope);
    });
    await enter(bridge(() => current, submit));
    const work = screen.getByRole('button', { name: '做一班实际劳动' });
    fireEvent.click(work); fireEvent.click(work);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(current.cash).toBe(25); expect(current.revision).toBe(initialRevision);
    const panel = screen.getByRole('region', { name: value().title });
    expect(panel.textContent).toContain('25便士 · 本周行动 3');
    for (const button of within(panel).getAllByRole('button')) expect(disabled(button)).toBe(true);
    const envelope = structuredClone(submit.mock.calls[0]![0]);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull());
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toEqual(envelope);
    expect(envelope.payload).toEqual({ type: 'RED_PRIEST', command: { type: 'WORK' } });
    expect(current.cash).toBe(49); expect(current.actionsRemaining).toBe(2); expect(current.revision).toBe(initialRevision + 1);
    expect(screen.getByRole('region', { name: value().title }).textContent).toContain('49便士 · 本周行动 2');
  });

  it('opens the new S0 root immediately after an acknowledged consumption result', async () => {
    const panel = value(); panel.actions = [{ id: 'consume', label: '服用已核实的原魔药', cost: '消耗此份原魔药；失败可能死亡', enabled: true, reason: null,
      command: { type: 'CONSUME', compoundId: 'ui-only-original-compound', confirmed: true } }];
    let current = publicGame(panel);
    const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
      current = structuredClone(current); current.revision++; current.progression.sequence = 0;
      current.redPriest = value(); current.redPriest.promoted = true; current.redPriest.title = '红祭司 · 当前战区';
      return receipt(current, envelope);
    });
    await enter(bridge(() => current, submit));
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的原魔药' }));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认服用这一份原魔药' }));
    expect(await screen.findByRole('region', { name: '红祭司 · 当前战区' })).toBeTruthy();
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ payload: { type: 'RED_PRIEST', command: panel.actions[0]!.command } }));
    expect(screen.queryByRole('region', { name: '征服者成长' })).toBeNull();
  });
});
