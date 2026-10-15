/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EntropyDukePanel, type EntropyDukePanelProps } from '../../src/renderer/EntropyDukePanel.js';
import { projectEntropyDuke } from '../../src/domain/entropy-duke/index.js';
import { ENTROPY_DUKE_PREPARATION_IDS, type EntropyDukeProjection } from '../../src/domain/entropy-duke/types.js';
import { ENTROPY_DUKE_CASE_IDS, type EntropyDukeCaseId } from '../../src/domain/entropy-duke/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { ed, directedInitial3, dose, originalFrenzyMage, prepared, promoted, taught } from '../domain/entropy-duke-directed-helper.js';

afterEach(cleanup);
// Actual source is the saved living S3 pre-combat capture, never its later death.
// Interactive states use declared pre-journal UNIT budgets and public commands.
// These renderer branches are not natural completion evidence.
beforeAll(() => { originalFrenzyMage(); }, 60_000);
const source = () => projectEntropyDuke(directedInitial3());
function show(value: EntropyDukeProjection = source(), extra: Partial<EntropyDukePanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '熵之公爵目标' });
const resources = () => screen.getByRole('region', { name: '熵之公爵当前资源' });
const room = () => screen.getByRole('region', { name: '熵之公爵原场事务' });
const attempt = () => screen.getByRole('region', { name: '熵之公爵本次实际尝试' });
function openPrimary() {
  fireEvent.click(primary());
  return screen.getByRole('dialog', { name: '熵之公爵操作确认' });
}
function confirm(dialog = screen.getByRole('dialog')) {
  return within(dialog).getByRole('button', { name: '确认执行这一次操作' });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|FM3-DELIVERY-PRACTICE|\bSTART\b/;

describe('EntropyDuke panel: original source and independent potion choices', () => {
  it('shows the living original S3 resources, three independent bottles and the actual paid next step', () => {
    const state = originalFrenzyMage(), value = projectEntropyDuke(state), view = show(value);
    expect(screen.getByRole('heading', { name: '熵之公爵·黑皇帝序列2' })).toBeTruthy();
    expect(resources().textContent).toContain(`健康${state.health}/100 · 精神${state.mind}/100 · 灵性${state.spirituality}/120`);
    expect(resources().textContent).toContain(`${state.cash}便士 · 本周行动${state.actionsRemaining}`);
    expect(resources().textContent).toContain('原伤继续生效');
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(disabled(primary())).toBe(!value.actions.find(action => action.command.type === 'LEARN_GUIDANCE')!.enabled);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.container.textContent).toContain('可选择继续停留狂乱法师');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state.injuries.some(injury => injury.severity === 'HEAVY')).toBe(true);
  });

  it('shows actual promotion costs, fourteen inherited and new skills with the original injury state', () => {
    const state = promoted(), value = projectEntropyDuke(state), view = show(value);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(state.mind).toBeLessThan(100);
    expect(value.abilities).toHaveLength(14);
    expect(value.abilities.slice(-2).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(resources().textContent).toContain(`健康${state.health}/100`);
    expect(resources().textContent).toContain(`现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
    expect(state.injuries).toEqual(originalFrenzyMage().injuries);
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('keeps the selected bottle after its actual labour receipt and never dispatches a goal choice', () => {
    const state = taught(), value = projectEntropyDuke(state), onCommand = vi.fn();
    const view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectEntropyDuke(ed(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<EntropyDukePanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('allows selecting either actually owned bottle after paid preparation and keeps the selected consume primary', () => {
    let state = taught();
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) state = ed(state, { type: 'PREPARE_TASK', taskId });
    state = ed(state, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-1' });
    state = ed(state, { type: 'BUY_POTION', bottleId: 'entropy-duke-potion-2' });
    state = ed(state, { type: 'PREPARE_PROMOTION' });
    const value = projectEntropyDuke(state), view = show(value), bottle = value.bottles[1]!;
    expect(value.insideCase).toBe(true);
    const goal = within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` });
    expect(disabled(goal)).toBe(false);
    fireEvent.click(goal);
    expect(primary().textContent).toContain('独立确认服用第2瓶');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state.entropyDuke.bottles.slice(0, 2).map(entry => entry.status)).toEqual(['PLAYER', 'PLAYER']);
  });

  it('confirms the exact bottle, success rate and paid failure risk and submits only one read-only intent', () => {
    const state = prepared(), value = projectEntropyDuke(state), before = structuredClone(state), view = show(value);
    const dialog = openPrimary(), bottle = value.bottles[0]!;
    expect(dialog.textContent).toContain(bottle.source);
    expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('140便士');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    expect(state).toEqual(before);
  });
});

describe('EntropyDuke panel: confirmation, focus and saved-state safety', () => {
  it('focuses and traps confirmation, blocks background controls and restores focus on cancel or Escape', () => {
    const onClose = vi.fn(), view = show(source(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取熵之公爵成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const target of within(targets()).getAllByRole('button')) expect(disabled(target)).toBe(true);
    const close = screen.getByRole('button', { name: '返回普通生活' });
    expect(disabled(close)).toBe(true); fireEvent.click(close);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps a double-clicked submission locked while the same saved facts await a receipt', () => {
    const value = source(), onCommand = vi.fn(), view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes unsubmitted confirmation on save failure and delegates retry to the existing save operation', () => {
    const value = source(), onCommand = vi.fn(), view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<EntropyDukePanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(disabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked through error clearing until changed saved facts arrive and then focuses the new phase', () => {
    const state = directedInitial3(), value = projectEntropyDuke(state), onCommand = vi.fn();
    const view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<EntropyDukePanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    const after = projectEntropyDuke(ed(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<EntropyDukePanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(resources().textContent).toContain(`${state.cash - 500}便士`);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('keeps the exact paid bottle intent locked across a save error until its actual failed receipt arrives', () => {
    const state = prepared('FAILURE'), value = projectEntropyDuke(state), onCommand = vi.fn();
    const view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    view.rerender(<EntropyDukePanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    fireEvent.click(primary());
    expect(onCommand).toHaveBeenCalledTimes(1);
    const after = ed(state, dose);
    view.rerender(<EntropyDukePanel value={projectEntropyDuke(after)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(resources().textContent).toContain(`健康${after.health}/100 · 精神${after.mind}/100`);
    expect(after.entropyDuke.bottles[0]!.status).toBe('CONSUMED');
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale unsubmitted confirmation when newer actual facts arrive', () => {
    const state = directedInitial3(), value = projectEntropyDuke(state), onCommand = vi.fn();
    const view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<EntropyDukePanel value={projectEntropyDuke(ed(state, { type: 'LEARN_GUIDANCE' }))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('disables all public buttons when busy, externally blocked or dead', () => {
    for (const mode of ['busy', 'blocked', 'dead'] as const) {
      // Explicit UNIT-only pre-journal terminal display fixture, not a natural death.
      const state = directedInitial3();
      if (mode === 'dead') { state.status = 'DEAD'; state.health = 0; }
      const view = show(projectEntropyDuke(state), { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      if (mode === 'dead') expect(view.container.textContent).toContain('本周目已经死亡');
      expect(view.onCommand).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('closes only outside an actual scene without submitting movement, healing, returns or a new sequence', () => {
    const onClose = vi.fn(), view = show(source(), { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('EntropyDuke panel: actual paid results and retained resources', () => {
  it.each([
    ['GREAT_SUCCESS', 0, 8, true],
    ['SUCCESS', 0, 15, true],
    ['FAILURE', 15, 25, false],
    ['GREAT_FAILURE', 25, 45, false],
  ] as const)('shows the saved %s bottle outcome without healing or spending a second bottle', (kind, healthCost, mindCost, succeeded) => {
    const before = prepared(kind), state = ed(before, dose), value = projectEntropyDuke(state), view = show(value);
    expect(resources().textContent).toContain(`健康${before.health - healthCost}/100 · 精神${before.mind - mindCost}/100 · 灵性${before.spirituality}/120`);
    expect(value.promoted).toBe(succeeded);
    expect(state.entropyDuke.bottles.map(bottle => bottle.status)).toEqual(['CONSUMED', 'SUPPLIER', 'SUPPLIER']);
    expect(state.injuries).toEqual(before.injuries);
    expect(resources().textContent).toContain(`累计风险${before.injuryRisk}`);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    expect(state.entropyDuke.preparedWeek).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows a paid failed bottle as exhausted when selected and preserves all three completed preparations', () => {
    const state = ed(prepared('FAILURE'), dose), value = projectEntropyDuke(state), view = show(value), bottle = value.bottles[0]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异，仍为狂乱法师');
    expect(value.preparations.every(entry => entry.completedWeek !== null)).toBe(true);
    expect(value.actions.some(action => action.command.type === 'CONSUME' && action.command.bottleId === bottle.id)).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms ending paid preparation separately and keeps its original unpaid-for-again bottle', () => {
    const state = prepared(), value = projectEntropyDuke(state), onCommand = vi.fn(), onClose = vi.fn();
    const view = render(<EntropyDukePanel value={value} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const action = value.actions.find(entry => entry.command.type === 'LEAVE_PREPARATION')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('不退成本');
    fireEvent.click(confirm(dialog));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_PREPARATION' });
    const after = ed(state, { type: 'LEAVE_PREPARATION' });
    view.rerender(<EntropyDukePanel value={projectEntropyDuke(after)} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(after.cash).toBe(state.cash);
    expect(after.actionsRemaining).toBe(state.actionsRemaining);
    expect(after.entropyDuke.bottles[0]!.status).toBe('PLAYER');
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays exact bottle purchase and per-bottle labour costs before dispatching', () => {
    const state = taught(), value = projectEntropyDuke(state), view = show(value);
    const action = value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === dose.bottleId)!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('6400便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(state.entropyDuke.bottles[0]!.status).toBe('SUPPLIER');
  });

  it('renders and confirms from a deeply frozen actual projection without changing saved facts', () => {
    const value = source(), before = JSON.stringify(value);
    const freeze = (entry: unknown): void => {
      if (!entry || typeof entry !== 'object') return;
      Object.freeze(entry); Object.values(entry).forEach(freeze);
    };
    freeze(value);
    const view = show(value);
    fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
    expect(JSON.stringify(value)).toBe(before);
  });
});

describe('EntropyDuke panel: authored prose and preserved names', () => {
  it('adapts fixed authoring labels but leaves a custom name inside saved history untouched', () => {
    const actual = source();
    // Display-boundary probe only. Mechanical state and commands still come from
    // the real source; this does not claim to be a saved gameplay transition.
    const customName = '原创G候选';
    const value: EntropyDukeProjection = {
      ...actual,
      title: '本作原创G熵之公爵·黑皇帝序列2',
      inheritedHistory: [...actual.inheritedHistory, `原人物${customName}的既有经历继续保留。`],
    };
    const view = show(value);
    expect(screen.getByRole('heading', { name: '熵之公爵·黑皇帝序列2' })).toBeTruthy();
    expect(view.container.textContent).toContain(`原人物${customName}的既有经历继续保留。`);
    expect(value.title).toBe('本作原创G熵之公爵·黑皇帝序列2');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('retains the original past encounters and gifts without exposing random or replay internals', () => {
    const state = promoted(), original = originalFrenzyMage(), value = projectEntropyDuke(state), view = show(value);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(state.frenzyMage.encounter).toEqual(original.frenzyMage.encounter);
    expect(state.fallenEarl.encounter).toEqual(original.fallenEarl.encounter);
    expect(state.briber.gifts).toEqual(original.briber.gifts);
    expect(view.container.textContent).not.toContain(state.random.seed);
    expect(view.container.textContent).not.toMatch(/randomBefore|randomAfter|branchRoll|snapshot|journal|sourceId/);
    expect(view.container.textContent).not.toMatch(editorial);
  });
});


function closeFlight(s: SliceState, caseId: EntropyDukeCaseId): SliceState {
  for (const type of ['STOP_INPUT', 'WAIT_FLIGHT'] as const) {
    if (projectEntropyDuke(s).actions.some(action => action.enabled && action.command.type === type)) s = ed(s, { type, caseId });
  }
  for (const command of [
    { type: 'WALK', caseId, to: 'B' }, { type: 'READ_RESULT', caseId }, { type: 'TAKE_RESULT', caseId },
    { type: 'WALK', caseId, to: 'A' }, { type: 'RETURN_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'START' },
    { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
  ] as const) s = ed(s, command);
  return s;
}
function ordinaryCase(s: SliceState, caseId: EntropyDukeCaseId): SliceState {
  for (const command of [
    { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
    { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId },
    { type: 'TAKE_BALL', caseId }, { type: 'ORDINARY_THROW', caseId },
  ] as const) s = ed(s, command);
  return closeFlight(s, caseId);
}
const lifeSources = new Map<string, SliceState>();
/** Explicit UNIT-only original-seed selection occurs before the first new
 * journal. Potion and both ability checks remain real public-command results;
 * ordinary earlier cases do not draw. Never edits an outcome or active timer. */
function lifePromotion(amplification: boolean, prolongation = true): SliceState {
  const key = `${amplification}:${prolongation}`;
  if (!lifeSources.has(key)) {
    let s = directedInitial3();
    const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
    const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
      const random = new DeterministicActionRandomStream(s.random.seed, cursor);
      const potion = random.nextInt(1, 100), first = random.nextInt(1, 100), second = random.nextInt(1, 100);
      if (potion > 5 && potion <= potionChance && (first <= lifeChance) === amplification && (second <= lifeChance) === prolongation) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded same-seed UNIT source for the real ability checks.');
    s.random.cursor = selected;
    s = ed(s, { type: 'LEARN_GUIDANCE' });
    for (const taskId of ENTROPY_DUKE_PREPARATION_IDS) s = ed(s, { type: 'PREPARE_TASK', taskId });
    s = ed(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    s = ed(s, { type: 'PREPARE_PROMOTION' }); s = ed(s, dose);
    lifeSources.set(key, s);
  }
  return structuredClone(lifeSources.get(key)!);
}
function readyCase(caseId: EntropyDukeCaseId = 'measured-throw', amplification = true, prolongation = true): SliceState {
  let s = lifePromotion(amplification, prolongation);
  for (const id of ENTROPY_DUKE_CASE_IDS) { if (id === caseId) break; s = ordinaryCase(s, id); }
  for (const command of [
    { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ABILITY' },
    { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId },
  ] as const) s = ed(s, command);
  return s;
}
function airborne(caseId: EntropyDukeCaseId = 'measured-throw', amplification = true, prolongation = true): SliceState {
  let s = readyCase(caseId, amplification, prolongation);
  for (const type of ['CONSENT_DARIAN', 'TAKE_BALL', 'ACTION_AMPLIFICATION'] as const) s = ed(s, { type, caseId });
  return s;
}
function publicButton(value: EntropyDukeProjection, type: string): HTMLButtonElement {
  const action = value.actions.find(entry => entry.command.type === type)!;
  return screen.getByRole('button', { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}

describe('EntropyDuke panel: one actual action, consent and finite original flight', () => {
  it('offers a separately confirmed ordinary alternative without submitting a method merely by viewing it', () => {
    const state = ed(promoted(), { type: 'OBSERVE', caseId: 'measured-throw' }), value = projectEntropyDuke(state), view = show(value);
    const ordinary = value.actions.find(action => action.command.type === 'PREPARE' && action.command.method === 'ORDINARY')!;
    fireEvent.click(screen.getByRole('button', { name: name => name.startsWith(ordinary.label) }));
    const dialog = screen.getByRole('dialog'); expect(dialog.textContent).toContain(ordinary.cost);
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PREPARE', caseId: 'measured-throw', method: 'ORDINARY' });
  });

  it('shows the same original adults, objects, real location and costs before asking current permission', () => {
    const state = readyCase(), value = projectEntropyDuke(state), onClose = vi.fn(), view = show(value, { onClose });
    expect(room().textContent).toContain('42岁的达里安·维尔'); expect(room().textContent).toContain('米蕾·沃德');
    for (const text of ['400克', '80克', '从A到B', '四米']) expect(room().textContent).toContain(text);
    expect(room().textContent).toContain(`原投递房时钟${value.life.clockSeconds}秒`);
    expect(attempt().textContent).toContain('尚未询问'); expect(primary().textContent).toContain('询问本次可随时撤回的许可');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(within(targets()).getAllByRole('button').every(disabled)).toBe(true);
    expect(view.container.textContent).not.toMatch(editorial); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('retains a real refusal while allowing the ordinary throw with zero ability costs', () => {
    let state = ed(readyCase(), { type: 'DECLINE_PERMISSION', caseId: 'measured-throw' });
    state = ed(state, { type: 'TAKE_BALL', caseId: 'measured-throw' });
    const value = projectEntropyDuke(state), view = show(value);
    expect(attempt().textContent).toContain('已拒绝本次练习');
    expect(value.actions.some(action => action.enabled && action.command.type === 'ACTION_AMPLIFICATION')).toBe(false);
    const button = publicButton(value, 'ORDINARY_THROW'); expect(button.disabled).toBe(false); fireEvent.click(button);
    expect(screen.getByRole('dialog').textContent).toContain('0行动'); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ORDINARY_THROW', caseId: 'measured-throw' });
    expect(state.entropyDuke.life.cases['measured-throw'].attempts[0]).toMatchObject({ spiritualitySpent: 0, mindSpent: 0, consent: 'DECLINED' });
  });

  it('shows a paid failed amplification with a real ordinary flight, no healing and no false success', () => {
    const state = airborne('measured-throw', false), value = projectEntropyDuke(state), view = show(value);
    expect(attempt().textContent).toContain('实际消耗6灵性、4精神'); expect(attempt().textContent).toContain('失败');
    expect(attempt().textContent).toContain('还剩4秒'); expect(attempt().textContent).toContain('已亲手投出，仍在实际飞行');
    expect(state.progression.mastery['black-emperor.s2.action-amplification']).toBe(0);
    expect(state.injuries).toEqual(originalFrenzyMage().injuries); expect(view.onCommand).not.toHaveBeenCalled();
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('preserves an actual withdrawal, costs and airborne position without restoring permission or returning the ball', () => {
    const before = airborne('withdrawn-flight'), state = ed(before, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-flight' });
    const value = projectEntropyDuke(state), view = show(value);
    expect(attempt().textContent).toContain('已撤回同意'); expect(attempt().textContent).toContain('新输入已经停止');
    expect(attempt().textContent).toContain('实际消耗6灵性、2精神'); expect(state.frenzyMage.life.ball.holder).toBe('AIRBORNE');
    expect(value.actions.some(action => action.enabled && ['CONSENT_DARIAN', 'ACTION_AMPLIFICATION', 'EFFECT_PROLONGATION'].includes(action.command.type))).toBe(false);
    expect(state.spirituality).toBe(before.spirituality); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows one real finite prolongation and confirms only its remaining zero-action wait without ticking locally', () => {
    let state = ed(airborne('lasting-flight'), { type: 'EFFECT_PROLONGATION', caseId: 'lasting-flight' });
    state = ed(state, { type: 'STOP_INPUT', caseId: 'lasting-flight' });
    const value = projectEntropyDuke(state), before = structuredClone(state), view = show(value);
    const remaining = value.life.currentAttempt!.flightRemainingSeconds;
    expect(remaining).toBeGreaterThan(0); expect(remaining).toBeLessThan(30);
    expect(attempt().textContent).toContain(`还剩${remaining}秒`); expect(attempt().textContent).toContain('实际消耗10灵性、4精神');
    expect(attempt().textContent).toContain('最迟投出后三十秒'); expect(attempt().textContent).toContain('页面停留不会自行计时');
    fireEvent.click(publicButton(value, 'WAIT_FLIGHT')); const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(`0行动 · ${remaining}秒`); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WAIT_FLIGHT', caseId: 'lasting-flight' });
    expect(state).toEqual(before);
  });

  it('keeps failed prolongation costs and the original finite landing time', () => {
    const before = airborne('lasting-flight', true, false), state = ed(before, { type: 'EFFECT_PROLONGATION', caseId: 'lasting-flight' });
    const value = projectEntropyDuke(state), view = show(value);
    expect(attempt().textContent).toContain('实际消耗10灵性、6精神'); expect(attempt().textContent).toContain('本次效果延长：');
    expect(state.entropyDuke.life.operation.flight?.landsAt).toBe(before.entropyDuke.life.operation.flight!.landsAt);
    expect(value.life.currentAttempt!.flightRemainingSeconds).toBe(1); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires actual landing, walking, reading and return before close and keeps completed facts on reload', () => {
    const state = airborne(), value = projectEntropyDuke(state), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const closed = closeFlight(state, 'measured-throw');
    view.rerender(<EntropyDukePanel value={projectEntropyDuke(closed)} busy={false} onCommand={view.onCommand} onClose={onClose} />);
    fireEvent.click(within(targets()).getByRole('button', { name: /本人当下的一次投球/ }));
    expect(attempt().textContent).toContain('已经实际落垫'); expect(attempt().textContent).toContain('已在原物旁实际核验结果');
    expect(attempt().textContent).toContain('原物已经实际归还'); expect(attempt().textContent).toContain('现场已实际收束');
    expect(closed.frenzyMage.life).toMatchObject({ playerLocation: 'START', ball: { holder: 'GUIDE', location: 'START' }, paper: { holder: 'GUIDE', location: 'START' } });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(onClose).toHaveBeenCalledOnce();
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});
