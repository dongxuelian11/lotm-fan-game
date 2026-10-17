/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedPriestPanel } from '../../src/renderer/RedPriestPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import type { SliceProjection, SliceRecord } from '../../src/domain/slice/types.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';

// UI-only public fixtures. These verify display and acknowledged result routing,
// not natural campaign outcomes, actual random execution, or a SQLite commit.
function panel(): RedPriestProjection {
  return {
    title: '红祭司 · 北大陆战争', guidanceKnown: true, promoted: false,
    story: '原军团仍在灰脊北关。', nextStep: '按实际准备决定下一步。', risk: '行动可能失败并留下伤亡。',
    resources: { health: 86, mind: 91, spirituality: 102, cash: '80便士', actionsRemaining: 3 },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'battle', label: '在灰脊北关执行会战', cost: '1行动、40便士、6灵性；实际1周，真实军团伤亡',
      enabled: true, reason: null, preferredAction: true,
      command: { type: 'CAMPAIGN', command: { type: 'BATTLE', nodeId: 'northern-pass' } } }],
  };
}
function record(text = '沈砚·Arden 已支付60便士，原伤仍须休养。'): SliceRecord {
  return { id: 'public-result-1', week: 201, title: '北大陆当前行动', text };
}
function check(tier: PublicCheckResult['tier'] = 'SUCCESS', ability: PublicCheckResult['ability'] = 'will', roll = 17): PublicCheckResult {
  return { ability, baseAbility: 24, effectiveAbility: 32, difficulty: 20, chance: 74, roll, tier,
    modifiers: [{ source: '沈砚·Arden 的已生效协同', value: 10 }, { source: '现有伤势', value: -2 }] };
}
const isDisabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

describe('Red Priest exact public action feedback', () => {
  it.each([
    ['GREAT_SUCCESS', 'physique', 1, '大成功 · 体魄检定'],
    ['SUCCESS', 'perception', 17, '成功 · 感知检定'],
    ['FAILURE', 'knowledge', 82, '失败 · 知识检定'],
    ['GREAT_FAILURE', 'will', 99, '大失败 · 意志检定'],
  ] as const)('shows the executed %s check, public modifiers and exact narrative', (tier, ability, roll, heading) => {
    const lastResult = record(), lastCheck = check(tier, ability, roll);
    render(<RedPriestPanel value={panel()} busy={false} lastResult={lastResult} lastCheck={lastCheck} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(within(result).getByRole('heading', { name: heading })).toBeTruthy();
    expect(within(result).getByText(lastResult.text).textContent).toBe(lastResult.text);
    expect(result.textContent).toContain(`基础 24，有效能力 32，难度 20。成功率 74%，d100 掷骰 ${roll}。`);
    expect(result.textContent).toContain('沈砚·Arden 的已生效协同 +10');
    expect(result.textContent).toContain('现有伤势 -2');
    // Next-action costs are not represented as already paid costs in the result.
    expect(result.textContent).not.toContain('40便士');
    expect(result.textContent).not.toMatch(/GREAT_SUCCESS|GREAT_FAILURE|FAILURE|SUCCESS|physique|perception|knowledge|will/);
  });

  it('removes a previous check when the acknowledged action has none and never invents a result', () => {
    const onCommand = vi.fn();
    const view = render(<RedPriestPanel value={panel()} busy={false} lastResult={record()} lastCheck={check()} onCommand={onCommand} />);
    const lastResult = record('已沿原路返回总部，战争尚未结束。');
    view.rerender(<RedPriestPanel value={panel()} busy={false} lastResult={lastResult} lastCheck={null} onCommand={onCommand} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain(lastResult.text);
    expect(result.textContent).not.toMatch(/掷骰|检定|成功率|成功|失败|便士/);
    view.rerender(<RedPriestPanel value={panel()} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('region', { name: '最近行动结果' })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders explicit public fields without serializing private extras on results or checks', () => {
    const lastResult = Object.assign(record(), { privateSource: 'PRIVATE_RECORD_SOURCE', cursor: 987 });
    const lastCheck = Object.assign(check(), { seed: 'PRIVATE_SEED', futureRoll: 'PRIVATE_FUTURE_ROLL', source: 'PRIVATE_ROOT_SOURCE' });
    const value = Object.assign(panel(), { source: { seed: 'PRIVATE_PANEL_SEED' }, journal: ['PRIVATE_JOURNAL'] });
    const view = render(<RedPriestPanel value={value} busy={false} lastResult={lastResult} lastCheck={lastCheck} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|cursor|seed|futureRoll|journal/);
    expect(screen.getByText('沈砚·Arden 的已生效协同 +10')).toBeTruthy();
  });

  it('keeps enabled zero-cash logistics return visible and distinct from permanently ending the war', () => {
    const value = panel(); value.resources.cash = '0便士';
    value.actions[0] = { ...value.actions[0]!, enabled: false, reason: '实际费用不足。' };
    value.actions.push(
      { id: 'consolidate', label: '巩固原运输设施', cost: '1行动、30便士', enabled: false,
        reason: '实际费用不足。', preferredAction: true, command: { type: 'CAMPAIGN', command: { type: 'CONSOLIDATE', nodeId: 'northern-pass' } } },
      { id: 'withdraw', label: '保护撤离并结束本场战争', cost: '1行动；原路真实返程，原伤亡保留', enabled: true,
        reason: null, command: { type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } } },
      { id: 'logistics', label: '沿原路返回总部整备', cost: '1行动；按实际原路周数结算补给与生活费，战争继续', enabled: true,
        reason: null, preferredAction: true, command: { type: 'CAMPAIGN', command: { type: 'RETURN_TO_HEADQUARTERS' } } },
    );
    const onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    const main = screen.getByRole('region', { name: '眼下该做什么' }).querySelector<HTMLElement>(':scope > .seer-actions')!;
    const buttons = within(main).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.textContent).toBe('沿原路返回总部整备');
    expect(isDisabled(buttons[0]!)).toBe(false);
    expect(within(main).getByRole('button', { name: '保护撤离并结束本场战争' })).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(buttons[0]!);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CAMPAIGN', command: { type: 'RETURN_TO_HEADQUARTERS' } });
  });

  it('renders headquarters rest as an ordinary projected choice with its exact costs', () => {
    const value = panel();
    value.actions = [{ id: 'army-rest', label: '让总部原军休整',
      cost: '1行动、实际2周；每国库120、每原军4补给，另结正常维持；士气+20，最高80',
      enabled: true, reason: null, preferredAction: true, command: { type: 'CAMPAIGN', command: { type: 'REST_FIELD_ARMIES' } } }];
    const onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: value.actions[0]!.label });
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(value.actions[0]!.cost);
    expect(screen.queryByRole('region', { name: '最近行动结果' })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });
});

function publicGame(): SliceProjection {
  const raw = createSliceRun('red-priest-feedback-ui-only', sliceDefaultCreationSelection, 'ui-only');
  raw.activeEvent = null;
  const state = projectSliceState(raw), value = panel();
  state.character.name = '沈砚·Arden';
  state.progression = { pathwayId: 'hunter', sequence: 1, mastery: {}, acting: 100, promotionWeek: 12 };
  state.conqueror.discovered = true; state.conqueror.promoted = true; state.conqueror.life.reflected = true;
  state.redPriest = value;
  state.health = value.resources.health; state.mind = value.resources.mind; state.spirituality = value.resources.spirituality;
  state.cash = 80; state.actionsRemaining = value.resources.actionsRemaining;
  state.lastResult = record('先前协同成功，原队伍已到场。'); state.lastCheck = check();
  return state;
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: '2026-10-17T08:00:00Z', replayed: false, state } };
}
function bridge(current: () => SliceProjection, submitIntent: SliceBridge['submitIntent']): SliceBridge {
  const state = current();
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: 'desktop' as const, activeState: current(), runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week,
      date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-17T08:00:00Z',
    }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: current() })), submitIntent,
  };
}

describe('Red Priest feedback save boundary', () => {
  it('retains the previous result while pending or failed, then displays only the same-intent retry receipt', async () => {
    let current = publicGame();
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const submit = vi.fn<SliceBridge['submitIntent']>()
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementationOnce(async envelope => {
        current = structuredClone(current); current.revision++;
        current.cash = 40; current.actionsRemaining = 2;
        current.redPriest.resources.cash = '40便士'; current.redPriest.resources.actionsRemaining = 2;
        current.lastResult = { ...record('本次会战失败；已付40便士，原军团阵亡2人。'), id: 'public-result-2' };
        current.lastCheck = check('FAILURE', 'will', 89);
        return receipt(current, envelope);
      });
    window.sliceGame = bridge(() => current, submit); render(<SliceApp />);
    await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: /沈砚·Arden/ }));
    const previous = screen.getByRole('region', { name: '最近行动结果' });
    expect(previous.textContent).toContain('先前协同成功，原队伍已到场。');
    expect(previous.textContent).toContain('d100 掷骰 17');
    const previousText = previous.textContent;
    const battle = screen.getByRole('button', { name: '在灰脊北关执行会战' });
    fireEvent.click(battle); fireEvent.click(battle);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(isDisabled(battle)).toBe(true);
    expect(screen.getByRole('region', { name: '最近行动结果' }).textContent).toBe(previousText);
    expect(screen.queryByText(/本次会战失败/)).toBeNull();
    await act(async () => finishFirst({ ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } }));
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(current.cash).toBe(80);
    expect(screen.getByRole('region', { name: '最近行动结果' }).textContent).toContain('d100 掷骰 17');
    expect(screen.getByRole('region', { name: panel().title }).textContent).toContain('80便士 · 本周行动 3');
    for (const button of within(screen.getByRole('region', { name: panel().title })).getAllByRole('button')) expect(isDisabled(button)).toBe(true);
    const originalEnvelope = structuredClone(submit.mock.calls[0]![0]);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull());
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toEqual(originalEnvelope);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('本次会战失败；已付40便士，原军团阵亡2人。');
    expect(within(result).getByRole('heading', { name: '失败 · 意志检定' })).toBeTruthy();
    expect(result.textContent).toContain('d100 掷骰 89');
    expect(result.textContent).not.toContain('先前协同成功');
    expect(screen.getByRole('region', { name: panel().title }).textContent).toContain('40便士 · 本周行动 2');
    expect(screen.getByText('沈砚·Arden · 红祭司 · 北大陆战争')).toBeTruthy();
    expect(current.character.name).toBe('沈砚·Arden');
  });
});
