/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedPriestPanel } from '../../src/renderer/RedPriestPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { redPriestPromotionStabilityReadiness, validateRedPriestCommand } from '../../src/domain/red-priest/index.js';
import type { getRedPriestPromotionStabilityPreview } from '../../src/domain/red-priest/engine.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from '../../src/shared/slice-contracts.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';

// Public-only renderer examples. These do not fabricate a legal saved campaign
// or claim a natural promotion/SQLite commit. Domain tests own evidence binding.
const COMPOUND = 'public-original-compound-3';
function preview(prepared = false): ReturnType<typeof getRedPriestPromotionStabilityPreview> {
  return { eligible: !prepared, reason: prepared ? '本瓶已有一次稳定准备；不能重复付费叠加或转给另一瓶。' : null,
    prepared, status: prepared ? 'READY' : 'UNPREPARED', effectiveBonus: prepared ? 35 : 0,
    unpreparedChance: 5, currentChance: prepared ? 68 : 5, stabilizedChance: 68, witnesses: [
      { polityId: 'loen', name: '鲁恩', legionId: 'loen-expedition', legionName: '鲁恩东境军团', personnel: 1400 },
      { polityId: 'intis', name: '因蒂斯', legionId: 'intis-expedition', legionName: '因蒂斯西境军团', personnel: 1400 },
      { polityId: 'feneport', name: '费内波特', legionId: 'feneport-expedition', legionName: '费内波特南境军团', personnel: 1400 },
    ], victoryCount: 5, cost: { actions: 2, cash: 120, spirituality: 12, mind: 8, weeks: 1 } };
}
function panel(prepared = false): RedPriestProjection {
  const p = preview(prepared);
  return { title: '红祭司 · 北大陆战争', guidanceKnown: true, promoted: false, insideCase: false,
    story: '原战争已经实际停战，旧失败和伤亡继续保留。', nextStep: '恢复实际伤势后再决定服药。',
    risk: '服药失败可能重伤、污染、失控或死亡；原件不能无条件找回。',
    resources: { health: 100, mind: prepared ? 92 : 100, spirituality: prepared ? 108 : 120, cash: prepared ? '64便士' : '200便士', actionsRemaining: 3 },
    abilities: [{ id: 'hunter.s7.flame-control', label: '火焰操控', mastery: 0, description: '旧能力值不变。' }],
    actions: [
      { id: 'legacy-consume-1', label: '确认风险并饮下原成药', cost: '1行动、30灵性；失败可能重伤、污染或死亡', enabled: true, reason: null,
        preferredAction: true, command: { type: 'CONSUME', compoundId: COMPOUND, confirmed: true } },
      { id: 'legacy-travel-2', label: '前往鲁恩联合协商处', cost: '1行动、10便士；普通城市道路1小时', enabled: true, reason: null, command: { type: 'TRAVEL', to: 'loen-headquarters' } },
      { id: 'legacy-work-3', label: '做本周原职业工作', cost: '1行动；本周工资24便士仅一次', enabled: true, reason: null, command: { type: 'WORK' } },
      { id: 'legacy-rest-4', label: '按当前生活档休养', cost: '1行动；旧重伤须先处置', enabled: true, reason: null, command: { type: 'REST' } },
      { id: 'append-stability-5', label: '为这份原成药完成战后稳定准备', cost: '2行动、120便士、12灵性、8精神；实际1周，另结正常生活费与旧还款；只用于此份原成药的下一次服用',
        enabled: p.eligible, reason: p.reason, ...(p.eligible ? { preferredAction: true } : {}), command: { type: 'STABILIZE_PROMOTION', compoundId: COMPOUND } },
    ],
    sections: [
      { id: 'campaign-status', title: '当前战区与目标', lines: ['独立胜利5/5；交战战区3/3；受控战区3/3。'] },
      { id: 'campaign-losses', title: '原军团与战争损失', lines: ['原军团死伤和两次原服药失败永久保留。'] },
      { id: 'promotion-stability', title: '这份原成药的服用风险与准备', lines: redPriestPromotionStabilityReadiness(p) },
    ] };
}
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const mainActions = () => screen.getByRole('region', { name: '眼下该做什么' }).querySelector<HTMLElement>(':scope > .seer-actions')!;
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe('Red Priest paid postwar stability controls', () => {
  it('prioritizes only the enabled public preparation and retains ordinary work/rest without changing legacy values', () => {
    const value = panel(), before = structuredClone(value), onCommand = vi.fn();
    const view = render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    expect(within(mainActions()).getAllByRole('button').map(b => b.textContent)).toEqual([
      '为这份原成药完成战后稳定准备', '做本周原职业工作', '按当前生活档休养',
    ]);
    expect(screen.getByRole('button', { name: '确认风险并饮下原成药' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '前往鲁恩联合协商处' })).toBeTruthy();
    const readiness = screen.getByRole('region', { name: '这份原成药的服用风险与准备' });
    expect(readiness.closest('details')).toBeNull();
    expect(readiness.textContent).toContain('当前服用成功率5%');
    expect(readiness.textContent).toContain('若真实见证、原件、地点与资源条件均满足');
    expect(readiness.textContent).toContain('有条件的准备后估计，当前仍为5%');
    expect(readiness.textContent).toContain('实际经过1周');
    expect(readiness.textContent).toContain('120便士、2行动、12灵性、8精神');
    expect(view.container.textContent).toContain('火焰操控 · 熟练 0');
    const button = screen.getByRole('button', { name: '为这份原成药完成战后稳定准备' });
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(value.actions.at(-1)!.cost);
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions.at(-1)!.command);
    expect(onCommand.mock.calls[0]![0]).toBe(value.actions.at(-1)!.command);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(value).toEqual(before);
  });

  it.each([
    '三方原受托见证尚未全部核实；缺少对应原军团的实际战果。',
    '稳定准备需要2行动、120便士、12灵性与8精神，并实际经过一周。',
  ])('shows the exact disabled reason and cannot submit unavailable preparation: %s', reason => {
    const value = panel(), action = value.actions.at(-1)!, p = preview();
    action.enabled = false; action.reason = reason; delete action.preferredAction;
    p.eligible = false; p.reason = reason; p.witnesses = [];
    value.sections.at(-1)!.lines = redPriestPromotionStabilityReadiness(p);
    const onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: action.label });
    expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent)).toEqual([action.cost, reason]);
    expect(screen.getByRole('region', { name: '这份原成药的服用风险与准备' }).textContent).toContain(`当前不能准备：${reason}`);
    expect(within(mainActions()).getByRole('button', { name: '做本周原职业工作' })).toBeTruthy();
    expect(within(mainActions()).getByRole('button', { name: '按当前生活档休养' })).toBeTruthy();
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps the original cancellable confirmation and exact compound for prepared=%s', prepared => {
    const value = panel(prepared), onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    const trigger = screen.getByRole('button', { name: '确认风险并饮下原成药' });
    fireEvent.click(trigger); expect(onCommand).not.toHaveBeenCalled();
    let dialog = screen.getByRole('dialog', { name: '红祭司服药确认' });
    expect(dialog.textContent).toContain(`当前服用成功率${prepared ? 68 : 5}%`);
    expect(dialog.textContent).toContain('实际伤势、增加污染，可能死亡');
    expect(dialog.textContent).toContain(value.actions[0]!.cost);
    if (prepared) {
      expect(dialog.textContent).toContain('仅用于此份原成药的下一次服用');
      expect(dialog.textContent).toContain('成功或失败都会用尽本次准备');
      expect(dialog.textContent).not.toContain('有条件的准备后估计');
    }
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); dialog = screen.getByRole('dialog', { name: '红祭司服药确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份原魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，继续准备' }))).toBe(true);
  });

  it('never reuses consumed preparation or an old confirmation for a new compound', () => {
    const onCommand = vi.fn(), value = panel(true), view = render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(screen.getByRole('button', { name: '为这份原成药完成战后稳定准备' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '确认风险并饮下原成药' }));
    const next = panel(false);
    for (const action of next.actions) if (action.command.type === 'CONSUME' || action.command.type === 'STABILIZE_PROMOTION') action.command.compoundId = 'public-next-original-compound';
    view.rerender(<RedPriestPanel value={next} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: '这份原成药的服用风险与准备' }).textContent).toContain('当前服用成功率5%');
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '为这份原成药完成战后稳定准备' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'STABILIZE_PROMOTION', compoundId: 'public-next-original-compound' });
  });

  it('shows only the new bounded rescue entry when projected and keeps the original AP cost visible', () => {
    const value = panel(); value.promoted = true; value.sections = [{ id: 'epilogue-entry-readiness', title: '进入原火场前', lines: [
      '当前3行动；入场实际消耗1行动，之后剩2行动。入场不会额外补行动。',
      '可以一次技巧后搬运，或普通搬运；也可零行动撤出，尚未转运者留在原遮蔽救护站。',
    ] }];
    value.actions = [
      { id: 'old-entry', label: '到原运输路参加救援', cost: '1行动；原军团实派六人、消耗2补给', enabled: true, reason: null, preferredAction: true, command: { type: 'START_EPILOGUE' } },
      { id: 'new-entry', label: '到原运输路开展有限战后救援', cost: '1行动；原军团实派六人、消耗2补给', enabled: true, reason: null, preferredAction: true, command: { type: 'START_PREPARED_EPILOGUE' } },
    ];
    const before = structuredClone(value), onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('button', { name: '到原运输路参加救援' })).toBeNull();
    expect(screen.getByRole('region', { name: '进入原火场前' }).textContent).toContain('之后剩2行动');
    fireEvent.click(screen.getByRole('button', { name: '到原运输路开展有限战后救援' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command); expect(value).toEqual(before);
  });

  it('shows the actual rescue odds while preserving zero-action ordinary withdrawal', () => {
    const value = panel(); value.promoted = true; value.insideCase = true; value.resources.actionsRemaining = 0;
    value.sections = [{ id: 'epilogue-readiness', title: '本次有限救援的胜算', lines: [
      '同袍战旌当前成功率74%，实际有效加值25，难度42；须满足本项资源与现场条件，失败仍会造成伤亡。',
      '赤焰界限当前成功率62%，实际有效加值25，难度48；须满足本项资源与现场条件，失败仍会造成伤亡。',
      '当前只剩0行动；行动不足时仍可零行动撤出，未转运者留在原遮蔽救护站。',
    ] }];
    value.actions = [
      { id: 'coordinate', label: '以同袍战旌协同原分队', cost: '1行动、8灵性、8精神；仅本次六人', enabled: false,
        reason: '现场行动需要一次行动；仍可沿原路普通撤出。', command: { type: 'EPILOGUE', command: { type: 'COORDINATE' } } },
      { id: 'withdraw', label: '沿原安全侧线撤出', cost: '0行动；保留未完成救援与全部后果', enabled: true,
        reason: null, command: { type: 'EPILOGUE', command: { type: 'WITHDRAW' } } },
    ];
    const onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    const readiness = screen.getByRole('region', { name: '本次有限救援的胜算' });
    expect(readiness.closest('details')).toBeNull();
    expect(readiness.textContent).toContain('成功率74%'); expect(readiness.textContent).toContain('成功率62%');
    expect(disabled(screen.getByRole('button', { name: '以同袍战旌协同原分队' }))).toBe(true);
    const withdraw = within(mainActions()).getByRole('button', { name: '沿原安全侧线撤出' });
    expect(disabled(withdraw)).toBe(false); fireEvent.click(withdraw);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
  });

  it('accepts only the new bounded public command shapes', () => {
    expect(validateRedPriestCommand({ type: 'STABILIZE_PROMOTION', compoundId: COMPOUND })).toBe(true);
    expect(validateRedPriestCommand({ type: 'START_PREPARED_EPILOGUE' })).toBe(true);
    for (const command of [
      { type: 'STABILIZE_PROMOTION', compoundId: COMPOUND, effectiveBonus: 35 },
      { type: 'STABILIZE_PROMOTION', compoundId: COMPOUND, witnesses: [] },
      { type: 'STABILIZE_PROMOTION', compoundId: '' },
      { type: 'START_PREPARED_EPILOGUE', actions: 3 },
    ]) expect(validateRedPriestCommand(command)).toBe(false);
  });
});

function publicGame(): SliceProjection {
  const raw = createSliceRun('red-priest-stability-public-only', sliceDefaultCreationSelection, 'ui-only'); raw.activeEvent = null;
  const state = projectSliceState(raw), value = panel(); state.character.name = '沈砚·Arden';
  state.progression = { pathwayId: 'hunter', sequence: 1, mastery: {}, acting: 100, promotionWeek: 12 };
  state.conqueror.discovered = true; state.conqueror.promoted = true; state.conqueror.life.reflected = true;
  state.redPriest = value; state.health = 100; state.mind = 100; state.spirituality = 120; state.cash = 200; state.actionsRemaining = 3;
  return state;
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: '2026-10-17T10:00:00Z', replayed: false, state } };
}
function bridge(current: () => SliceProjection, submitIntent: SliceBridge['submitIntent']): SliceBridge {
  const state = current();
  return { getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: 'desktop' as const, activeState: current(), runs: [{
    runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
    status: state.status, revision: state.revision, updatedAt: '2026-10-17T10:00:00Z',
  }] } })), loadRun: vi.fn(async () => ({ ok: true as const, value: current() })), submitIntent };
}

describe('Red Priest stability save boundary', () => {
  it('retains the unpaid 5% state on SAVE_FAILED and retries the identical intent before showing paid 68%', async () => {
    let current = publicGame(), finish!: (result: SliceResult<SliceReceipt>) => void;
    const submit = vi.fn<SliceBridge['submitIntent']>()
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockImplementationOnce(async envelope => {
        current = structuredClone(current); current.revision++; current.week++;
        current.redPriest = panel(true); current.cash = 64; current.mind = 92; current.spirituality = 108;
        return receipt(current, envelope);
      });
    window.sliceGame = bridge(() => current, submit); render(<SliceApp />);
    await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: /沈砚·Arden/ }));
    const prepare = screen.getByRole('button', { name: '为这份原成药完成战后稳定准备' });
    fireEvent.click(prepare); fireEvent.click(prepare);
    expect(submit).toHaveBeenCalledTimes(1); expect(disabled(prepare)).toBe(true);
    await act(async () => finish({ ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } }));
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(current.cash).toBe(200);
    expect(screen.getByRole('region', { name: '这份原成药的服用风险与准备' }).textContent).toContain('当前服用成功率5%');
    expect(screen.getByRole('region', { name: panel().title }).textContent).toContain('200便士 · 本周行动 3');
    for (const button of within(screen.getByRole('region', { name: panel().title })).getAllByRole('button')) expect(disabled(button)).toBe(true);
    const envelope = structuredClone(submit.mock.calls[0]![0]);
    expect(envelope.payload).toEqual({ type: 'RED_PRIEST', command: { type: 'STABILIZE_PROMOTION', compoundId: COMPOUND } });
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull());
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toEqual(envelope);
    expect(screen.getByRole('region', { name: '这份原成药的服用风险与准备' }).textContent).toContain('当前服用成功率68%');
    expect(disabled(screen.getByRole('button', { name: '为这份原成药完成战后稳定准备' }))).toBe(true);
    expect(within(mainActions()).getAllByRole('button')[0]!.textContent).toBe('确认风险并饮下原成药');
    fireEvent.click(screen.getByRole('button', { name: '确认风险并饮下原成药' }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog', { name: '红祭司服药确认' }).textContent).toContain('当前服用成功率68%');
    expect(current.character.name).toBe('沈砚·Arden');
  });
});
