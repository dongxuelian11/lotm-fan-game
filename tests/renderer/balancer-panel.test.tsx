/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BalancerPanel, type BalancerPanelProps } from '../../src/renderer/BalancerPanel.js';
import { projectBalancer } from '../../src/domain/balancer/index.js';
import { BALANCER_PREPARATION_IDS, type BalancerProjection } from '../../src/domain/balancer/types.js';
import { BALANCER_CASE_IDS, type BalancerCaseId } from '../../src/domain/balancer/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { ba, directedInitial3, dose, originalChaosHunter, prepared, promoted, taught } from '../domain/balancer-directed-helper.js';

afterEach(cleanup);
// Actual source is the complete 483-command recovery campaign, not the separate 477-command death.
// Interactive states use declared pre-journal UNIT budgets and public commands.
// These renderer branches are not natural completion evidence.
beforeAll(() => { originalChaosHunter(); }, 60_000);
const source = () => projectBalancer(directedInitial3());
function show(value: BalancerProjection = source(), extra: Partial<BalancerPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<BalancerPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '平衡者目标' });
const resources = () => screen.getByRole('region', { name: '平衡者当前资源' });
const room = () => screen.getByRole('region', { name: '平衡者原场事务' });
const attempt = () => screen.getByRole('region', { name: '平衡者本次实际尝试' });
function openPrimary() {
  fireEvent.click(primary());
  return screen.getByRole('dialog', { name: '平衡者操作确认' });
}
function confirm(dialog = screen.getByRole('dialog')) {
  return within(dialog).getByRole('button', { name: '确认执行这一次操作' });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|CH3-LINE-PRACTICE|\bSTART\b/;

describe('Balancer panel: original source and independent potion choices', () => {
  it('shows the living original S3 resources, three independent bottles and the actual paid next step', () => {
    const state = originalChaosHunter(), value = projectBalancer(state), view = show(value);
    expect(screen.getByRole('heading', { name: '平衡者·审判者序列2' })).toBeTruthy();
    expect(resources().textContent).toContain(`健康${state.health}/100 · 精神${state.mind}/100 · 灵性${state.spirituality}/120`);
    expect(resources().textContent).toContain(`${state.cash}便士 · 本周行动${state.actionsRemaining}`);
    expect(resources().textContent).toContain('原伤继续生效');
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(disabled(primary())).toBe(!value.actions.find(action => action.command.type === 'LEARN_GUIDANCE')!.enabled);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.container.textContent).toContain('可选择继续停留混乱猎手');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state.injuries.some(injury => injury.severity === 'HEAVY')).toBe(true);
    expect(state).toMatchObject({ week: 115, revision: 484, status: 'ACTIVE', health: 70, mind: 100, spirituality: 116, cash: 400 });
    expect(disabled(primary())).toBe(true);
  });

  it('shows actual promotion costs, seventeen inherited and new skills with the original injury state', () => {
    const state = promoted(), value = projectBalancer(state), view = show(value);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(state.mind).toBeLessThan(100);
    expect(value.abilities).toHaveLength(17);
    expect(value.abilities.slice(-2).map(ability => ability.id)).toEqual(['justiciar.s2.imbalance-sensing', 'justiciar.s2.measured-resistance']);
    expect(value.abilities.slice(-2).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const [id, mastery] of Object.entries(originalChaosHunter().progression.mastery)) {
      expect(value.abilities.find(ability => ability.id === id)?.mastery).toBe(mastery);
    }
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(resources().textContent).toContain(`健康${state.health}/100`);
    expect(resources().textContent).toContain(`现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
    expect(state.injuries).toEqual(originalChaosHunter().injuries);
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('keeps the selected bottle after its actual labour receipt and never dispatches a goal choice', () => {
    const state = taught(), value = projectBalancer(state), onCommand = vi.fn();
    const view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectBalancer(ba(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<BalancerPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('allows selecting either actually owned bottle after paid preparation and keeps the selected consume primary', () => {
    let state = taught();
    for (const taskId of BALANCER_PREPARATION_IDS) state = ba(state, { type: 'PREPARE_TASK', taskId });
    state = ba(state, { type: 'BUY_POTION', bottleId: 'balancer-potion-1' });
    state = ba(state, { type: 'BUY_POTION', bottleId: 'balancer-potion-2' });
    state = ba(state, { type: 'PREPARE_PROMOTION' });
    const value = projectBalancer(state), view = show(value), bottle = value.bottles[1]!;
    expect(value.insideCase).toBe(true);
    const goal = within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` });
    expect(disabled(goal)).toBe(false);
    fireEvent.click(goal);
    expect(primary().textContent).toContain('独立确认服用第2瓶');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state.balancer.bottles.slice(0, 2).map(entry => entry.status)).toEqual(['PLAYER', 'PLAYER']);
  });

  it('confirms the exact bottle, success rate and paid failure risk and submits only one read-only intent', () => {
    const state = prepared(), value = projectBalancer(state), before = structuredClone(state), view = show(value);
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

describe('Balancer panel: confirmation, focus and saved-state safety', () => {
  it('focuses and traps confirmation, blocks background controls and restores focus on cancel or Escape', () => {
    const onClose = vi.fn(), view = show(source(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取平衡者成品与专业准备指导' }));
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
    const value = source(), onCommand = vi.fn(), view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes unsubmitted confirmation on save failure and delegates retry to the existing save operation', () => {
    const value = source(), onCommand = vi.fn(), view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<BalancerPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(disabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked through error clearing until changed saved facts arrive and then focuses the new phase', () => {
    const state = directedInitial3(), value = projectBalancer(state), onCommand = vi.fn();
    const view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<BalancerPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    const after = projectBalancer(ba(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<BalancerPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(resources().textContent).toContain(`${state.cash - 500}便士`);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('keeps the exact paid bottle intent locked across a save error until its actual failed receipt arrives', () => {
    const state = prepared('FAILURE'), value = projectBalancer(state), onCommand = vi.fn();
    const view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    view.rerender(<BalancerPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    fireEvent.click(primary());
    expect(onCommand).toHaveBeenCalledTimes(1);
    const after = ba(state, dose);
    view.rerender(<BalancerPanel value={projectBalancer(after)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(resources().textContent).toContain(`健康${after.health}/100 · 精神${after.mind}/100`);
    expect(after.balancer.bottles[0]!.status).toBe('CONSUMED');
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale unsubmitted confirmation when newer actual facts arrive', () => {
    const state = directedInitial3(), value = projectBalancer(state), onCommand = vi.fn();
    const view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<BalancerPanel value={projectBalancer(ba(state, { type: 'LEARN_GUIDANCE' }))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('disables all public buttons when busy, externally blocked or dead', () => {
    for (const mode of ['busy', 'blocked', 'dead'] as const) {
      // Explicit UNIT-only pre-journal terminal display fixture, not a natural death.
      const state = directedInitial3();
      if (mode === 'dead') { state.status = 'DEAD'; state.health = 0; }
      const view = show(projectBalancer(state), { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
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

describe('Balancer panel: actual paid results and retained resources', () => {
  it.each([
    ['GREAT_SUCCESS', 0, 8, true],
    ['SUCCESS', 0, 15, true],
    ['FAILURE', 15, 25, false],
    ['GREAT_FAILURE', 25, 45, false],
  ] as const)('shows the saved %s bottle outcome without healing or spending a second bottle', (kind, healthCost, mindCost, succeeded) => {
    const before = prepared(kind), state = ba(before, dose), value = projectBalancer(state), view = show(value);
    expect(resources().textContent).toContain(`健康${before.health - healthCost}/100 · 精神${before.mind - mindCost}/100 · 灵性${before.spirituality}/120`);
    expect(value.promoted).toBe(succeeded);
    expect(state.balancer.bottles.map(bottle => bottle.status)).toEqual(['CONSUMED', 'SUPPLIER', 'SUPPLIER']);
    expect(state.injuries).toEqual(before.injuries);
    expect(resources().textContent).toContain(`累计风险${before.injuryRisk}`);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    expect(state.balancer.preparedWeek).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows a paid failed bottle as exhausted when selected and preserves all three completed preparations', () => {
    const state = ba(prepared('FAILURE'), dose), value = projectBalancer(state), view = show(value), bottle = value.bottles[0]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异，仍为混乱猎手');
    expect(value.preparations.every(entry => entry.completedWeek !== null)).toBe(true);
    expect(value.actions.some(action => action.command.type === 'CONSUME' && action.command.bottleId === bottle.id)).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms ending paid preparation separately and keeps its original unpaid-for-again bottle', () => {
    const state = prepared(), value = projectBalancer(state), onCommand = vi.fn(), onClose = vi.fn();
    const view = render(<BalancerPanel value={value} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const action = value.actions.find(entry => entry.command.type === 'LEAVE_PREPARATION')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('不退成本');
    fireEvent.click(confirm(dialog));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_PREPARATION' });
    const after = ba(state, { type: 'LEAVE_PREPARATION' });
    view.rerender(<BalancerPanel value={projectBalancer(after)} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(after.cash).toBe(state.cash);
    expect(after.actionsRemaining).toBe(state.actionsRemaining);
    expect(after.balancer.bottles[0]!.status).toBe('PLAYER');
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays exact bottle purchase and per-bottle labour costs before dispatching', () => {
    const state = taught(), value = projectBalancer(state), view = show(value);
    const action = value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === dose.bottleId)!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('6400便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(state.balancer.bottles[0]!.status).toBe('SUPPLIER');
  });

  it('shows the 900-penny balance only on the original bottle with five completed labour steps', () => {
    let state = taught();
    for (let n = 0; n < 5; n++) state = ba(state, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const value = projectBalancer(state), view = show(value);
    const discounted = value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === dose.bottleId)!;
    expect(discounted.cost).toContain('900便士');
    expect(value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === 'balancer-potion-2')!.cost).toContain('6400便士');
    fireEvent.click(screen.getByRole('button', { name: name => name.startsWith(discounted.label) }));
    expect(screen.getByRole('dialog').textContent).toContain('900便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(state.balancer.bottles[0]!.status).toBe('SUPPLIER');
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

describe('Balancer panel: authored prose and preserved names', () => {
  it('adapts fixed authoring labels but leaves a custom name inside saved history untouched', () => {
    const actual = source();
    // Display-boundary probe only. Mechanical state and commands still come from
    // the real source; this does not claim to be a saved gameplay transition.
    const customName = '原创G候选';
    const value: BalancerProjection = {
      ...actual,
      title: '本作原创G平衡者·审判者序列2',
      inheritedHistory: [...actual.inheritedHistory, `原人物${customName}的既有经历继续保留。`],
    };
    const view = show(value);
    expect(screen.getByRole('heading', { name: '平衡者·审判者序列2' })).toBeTruthy();
    expect(view.container.textContent).toContain(`原人物${customName}的既有经历继续保留。`);
    expect(value.title).toBe('本作原创G平衡者·审判者序列2');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('retains the original past encounters and interrogation history without exposing random or replay internals', () => {
    const state = promoted(), original = originalChaosHunter(), value = projectBalancer(state), view = show(value);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(state.chaosHunter.encounter).toEqual(original.chaosHunter.encounter);
    expect(state.imperativeMage.encounter).toEqual(original.imperativeMage.encounter);
    expect(state.interrogator).toEqual(original.interrogator);
    expect(view.container.textContent).not.toContain(state.random.seed);
    expect(view.container.textContent).not.toMatch(/randomBefore|randomAfter|branchRoll|snapshot|journal|sourceId/);
    expect(view.container.textContent).not.toMatch(editorial);
  });
});


function ordinaryCase(s: SliceState, caseId: BalancerCaseId): SliceState {
  s = ba(s, { type: 'OBSERVE', caseId });
  s = ba(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
  for (const command of [
    { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId },
    { type: 'CONSENT_MIRA', caseId }, { type: 'SETUP_OBJECTS', caseId },
  ] as const) s = ba(s, command);
  if (caseId === 'measured-impact') s = ba(s, { type: 'TAKE_PARCEL', caseId });
  s = ba(s, { type: 'WALK', caseId, to: 'B' });
  if (caseId === 'withdrawn-inspection') s = ba(s, { type: 'REMOVE_COVER', caseId });
  if (caseId === 'measured-impact') s = ba(s, { type: 'ORDINARY_BRACE', caseId });
  return closeCase(s, caseId);
}
function closeCase(s: SliceState, caseId: BalancerCaseId): SliceState {
  for (const command of [
    { type: 'MANUAL_INSPECTION', caseId }, { type: 'TAKE_OBJECT', caseId },
    { type: 'WALK', caseId, to: 'A' }, { type: 'RETURN_OBJECTS', caseId },
    { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId },
    { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
  ] as const) s = ba(s, command);
  return s;
}
const lifeSources = new Map<string, SliceState>();
/** Directed UNIT input selects only the original-seed cursor before the first
 * S2 journal. Both potion and ability checks then use actual public commands.
 * No saved check, timer, physical answer, injury or result is edited. */
function lifePromotion(stat: 'perception' | 'knowledge', success: boolean): SliceState {
  const key = `${stat}:${success}`;
  if (!lifeSources.has(key)) {
    let s = directedInitial3();
    const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
    const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats[stat] + 1, difficulty: 20, modifiers: [] });
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
      const random = new DeterministicActionRandomStream(s.random.seed, cursor);
      const potion = random.nextInt(1, 100), check = random.nextInt(1, 100);
      if (potion > 5 && potion <= potionChance && (check <= lifeChance) === success) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded original-seed UNIT input for the real ability check.');
    s.random.cursor = selected;
    s = ba(s, { type: 'LEARN_GUIDANCE' });
    for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    s = ba(s, { type: 'PREPARE_PROMOTION' });
    s = ba(s, dose);
    lifeSources.set(key, s);
  }
  return structuredClone(lifeSources.get(key)!);
}
function readyCase(caseId: BalancerCaseId = 'visible-imbalance', success = true): SliceState {
  let s = lifePromotion(caseId === 'measured-impact' ? 'knowledge' : 'perception', success);
  if (caseId === 'measured-impact') s = ba(s, { type: 'BUY_GUARD_PLATE' });
  for (const id of BALANCER_CASE_IDS) { if (id === caseId) break; s = ordinaryCase(s, id); }
  for (const command of [
    { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ABILITY' },
    { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId },
  ] as const) s = ba(s, command);
  return s;
}
function readyObjects(caseId: BalancerCaseId, success = true): SliceState {
  let s = readyCase(caseId, success);
  s = ba(s, { type: 'CONSENT_MIRA', caseId });
  s = ba(s, { type: 'SETUP_OBJECTS', caseId });
  return caseId === 'measured-impact' ? ba(s, { type: 'TAKE_PARCEL', caseId }) : s;
}
function sensed(caseId: 'visible-imbalance' | 'withdrawn-inspection', success = true) {
  return ba(readyObjects(caseId, success), { type: 'IMBALANCE_SENSING', caseId });
}
function resisted(success = true) {
  return ba(readyObjects('measured-impact', success), { type: 'MEASURED_RESISTANCE', caseId: 'measured-impact' });
}
function publicButton(value: BalancerProjection, type: string): HTMLButtonElement {
  const action = value.actions.find(entry => entry.command.type === type)!;
  return screen.getByRole('button', { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}

describe('Balancer panel: actual room, consent and bounded visible sensing', () => {
  it('offers a separately confirmed ordinary alternative without choosing a method by viewing it', () => {
    const state = ba(promoted(), { type: 'OBSERVE', caseId: 'visible-imbalance' }), value = projectBalancer(state), view = show(value);
    const ordinary = value.actions.find(action => action.command.type === 'PREPARE' && action.command.method === 'ORDINARY')!;
    fireEvent.click(screen.getByRole('button', { name: name => name.startsWith(ordinary.label) }));
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain(ordinary.cost);
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PREPARE', caseId: 'visible-imbalance', method: 'ORDINARY' });
  });

  it('shows the original adults, original350g parcel, real location, injury and actual permission request', () => {
    const state = readyCase(), value = projectBalancer(state), view = show(value, { onClose: vi.fn() });
    for (const text of ['米拉·佩恩', '薇娜·贝尔', '43岁', '350克', '本次从A到B的越线', '四米']) expect(room().textContent).toContain(text);
    expect(room().textContent).toContain(`原演练房时钟${value.life.clockSeconds}秒`);
    expect(attempt().textContent).toContain('尚未询问');
    expect(primary().textContent).toContain('询问本案可随时撤回的许可');
    expect(resources().textContent).toContain('重伤');
    expect(resources().textContent).toContain('尚未处置');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(within(targets()).getAllByRole('button').every(disabled)).toBe(true);
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('retains a refusal and exposes only ordinary setup, with no new permission or paid sensing', () => {
    const state = ba(readyCase(), { type: 'DECLINE_PERMISSION', caseId: 'visible-imbalance' }), value = projectBalancer(state), view = show(value);
    expect(attempt().textContent).toContain('已拒绝本次练习');
    expect(value.actions.some(action => action.enabled && ['CONSENT_MIRA', 'IMBALANCE_SENSING'].includes(action.command.type))).toBe(false);
    fireEvent.click(publicButton(value, 'SETUP_OBJECTS'));
    expect(screen.getByRole('dialog').textContent).toContain('0行动');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'SETUP_OBJECTS', caseId: 'visible-imbalance' });
    expect(state.balancer.life.cases['visible-imbalance'].attempts[0]).toMatchObject({ spiritualitySpent: 0, mindSpent: 0, consent: 'DECLINED' });
  });

  it('shows the actual visible offset after a real successful sensing check and still requires ordinary close inspection', () => {
    const state = sensed('visible-imbalance'), value = projectBalancer(state), view = show(value);
    expect(attempt().textContent).toContain('实际消耗5灵性、2精神、0健康');
    expect(attempt().textContent).toContain('可见轮廓偏离120毫米');
    expect(attempt().textContent).toContain('尚未亲眼核实原包的实际偏移');
    expect(state.progression.mastery['justiciar.s2.imbalance-sensing']).toBe(0);
    expect(state.chaosHunter.life.playerLocation).toBe('A');
    expect(state.injuries).toEqual(originalChaosHunter().injuries);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows a failed check with actual paid costs, without fabricating its hidden physical answer', () => {
    const state = sensed('visible-imbalance', false), value = projectBalancer(state), view = show(value);
    expect(attempt().textContent).toContain('实际消耗5灵性、4精神、0健康');
    expect(attempt().textContent).toContain('失败');
    expect(room().textContent).not.toContain('120毫米');
    expect(state.progression.mastery['justiciar.s2.imbalance-sensing']).toBe(0);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('reveals only an actual obstruction before withdrawal, walking and manually removing the original paper', () => {
    const before = sensed('withdrawn-inspection'), value = projectBalancer(before), view = show(value);
    expect(attempt().textContent).toContain('存在遮挡，隐藏位移未知');
    expect(room().textContent).not.toContain('120毫米');
    let state = ba(before, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-inspection' });
    view.rerender(<BalancerPanel value={projectBalancer(state)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain('已撤回同意');
    expect(attempt().textContent).toContain('新输入已经停止');
    expect(attempt().textContent).toContain('实际消耗5灵性、2精神、0健康');
    expect(state.spirituality).toBe(before.spirituality);
    state = ba(state, { type: 'WALK', caseId: 'withdrawn-inspection', to: 'B' });
    state = ba(state, { type: 'REMOVE_COVER', caseId: 'withdrawn-inspection' });
    state = ba(state, { type: 'MANUAL_INSPECTION', caseId: 'withdrawn-inspection' });
    view.rerender(<BalancerPanel value={projectBalancer(state)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain('本人已到原桌旁亲核偏移120毫米');
    expect(state.progression.mastery['justiciar.s2.imbalance-sensing']).toBe(0);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('Balancer panel: one real plate, finite own impact and safe ordinary alternative', () => {
  it('confirms the unique original65-integrity plate purchase without giving it away or silently refreshing it', () => {
    const state = promoted(), value = projectBalancer(state), view = show(value);
    const plate = screen.getByRole('region', { name: '平衡者唯一原护板' });
    expect(plate.textContent).toContain('完整度65/65');
    expect(plate.textContent).toContain('所有人：薇娜');
    fireEvent.click(publicButton(value, 'BUY_GUARD_PLATE'));
    expect(screen.getByRole('dialog').textContent).toContain('30便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_GUARD_PLATE' });
    const after = ba(state, { type: 'BUY_GUARD_PLATE' });
    view.rerender(<BalancerPanel value={projectBalancer(after)} busy={false} onCommand={view.onCommand} />);
    expect(after.cash).toBe(state.cash - 30);
    expect(plate.textContent).toContain('所有人：本人');
    expect(plate.textContent).toContain('完整度65/65');
    expect(projectBalancer(after).actions.some(action => action.enabled && action.command.type === 'BUY_GUARD_PLATE')).toBe(false);
  });

  it('confirms the actual finite wait without ticking the saved window locally or refunding paid costs', () => {
    const state = resisted(), value = projectBalancer(state), before = structuredClone(state), view = show(value);
    const remaining = value.life.currentAttempt!.effectRemainingSeconds;
    expect(remaining).toBe(30);
    expect(attempt().textContent).toContain('实际消耗6灵性、2精神、0健康');
    expect(attempt().textContent).toContain(`还剩${remaining}秒`);
    expect(attempt().textContent).toContain('页面停留不会自行计时');
    fireEvent.click(publicButton(value, 'WAIT_EFFECT'));
    expect(screen.getByRole('dialog').textContent).toContain(`0行动 · ${remaining}秒`);
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WAIT_EFFECT', caseId: 'measured-impact' });
    expect(state).toEqual(before);
    const after = ba(state, { type: 'WAIT_EFFECT', caseId: 'measured-impact' });
    view.rerender(<BalancerPanel value={projectBalancer(after)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain('还剩0秒');
    expect(after.balancer.life.guardPlate.integrity).toBe(65);
    expect(after.spirituality).toBe(state.spirituality);
  });

  it.each([true, false])('shows the real %s resistance attempt, own injury cost and15 actual plate wear', success => {
    const before = resisted(success);
    let state = ba(before, { type: 'WALK', caseId: 'measured-impact', to: 'B' });
    state = ba(state, { type: 'APPLY_IMPACT', caseId: 'measured-impact' });
    const value = projectBalancer(state), view = show(value), healthLoss = success ? 2 : 5;
    expect(attempt().textContent).toContain(`损${healthLoss}健康，护板磨损15`);
    expect(attempt().textContent).toContain(`实际消耗6灵性、${success ? 2 : 4}精神、${healthLoss}健康`);
    expect(screen.getByRole('region', { name: '平衡者唯一原护板' }).textContent).toContain('完整度50/65');
    expect(resources().textContent).toContain(`健康${before.health - healthLoss}/100`);
    expect(state.chaosHunter.life.volunteer.health).toBe(100);
    expect(state.injuries).toEqual(before.injuries);
    expect(state.progression.mastery['justiciar.s2.measured-resistance']).toBe(0);
    expect(value.actions.some(action => action.enabled && action.command.type === 'APPLY_IMPACT')).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps an expired successful check separate from an unprotected real impact with5 health loss and15 wear', () => {
    const before = resisted();
    let state = ba(before, { type: 'WAIT_EFFECT', caseId: 'measured-impact' });
    state = ba(state, { type: 'WALK', caseId: 'measured-impact', to: 'B' });
    state = ba(state, { type: 'APPLY_IMPACT', caseId: 'measured-impact' });
    const view = show(projectBalancer(state));
    expect(attempt().textContent).toContain('还剩0秒');
    expect(attempt().textContent).toContain('未获得有效护持');
    expect(attempt().textContent).toContain('损5健康，护板磨损15');
    expect(state.health).toBe(before.health - 5);
    expect(state.balancer.life.guardPlate.integrity).toBe(50);
    expect(state.progression.mastery['justiciar.s2.measured-resistance']).toBe(0);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms stopping separately and clears only the unused effect, leaving costs, location and originals intact', () => {
    const before = resisted(), value = projectBalancer(before), view = show(value);
    fireEvent.click(publicButton(value, 'STOP'));
    expect(screen.getByRole('dialog').textContent).toContain('0行动');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'STOP', caseId: 'measured-impact' });
    const after = ba(before, { type: 'STOP', caseId: 'measured-impact' });
    view.rerender(<BalancerPanel value={projectBalancer(after)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain('本次输入已实际停止');
    expect(attempt().textContent).toContain('还剩0秒');
    expect(after.health).toBe(before.health);
    expect(after.spirituality).toBe(before.spirituality);
    expect(after.chaosHunter.life.playerLocation).toBe('A');
    expect(after.chaosHunter.life.parcel.holder).toBe('PLAYER');
    expect(after.balancer.life.guardPlate.integrity).toBe(65);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
  });

  it('uses an independently confirmed ordinary brace after failed resistance, without additional health loss or wear', () => {
    const before = ba(resisted(false), { type: 'WALK', caseId: 'measured-impact', to: 'B' });
    const value = projectBalancer(before), view = show(value);
    fireEvent.click(publicButton(value, 'ORDINARY_BRACE'));
    expect(screen.getByRole('dialog').textContent).toContain('普通承托');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ORDINARY_BRACE', caseId: 'measured-impact' });
    const state = ba(before, { type: 'ORDINARY_BRACE', caseId: 'measured-impact' });
    view.rerender(<BalancerPanel value={projectBalancer(state)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain('损0健康，护板磨损0');
    expect(attempt().textContent).toContain('实际消耗6灵性、4精神、0健康');
    expect(state.health).toBe(before.health);
    expect(state.balancer.life.guardPlate.integrity).toBe(65);
  });

  it('stops a successful window on withdrawal and leaves original objects for physical ordinary cleanup', () => {
    const before = resisted(), state = ba(before, { type: 'WITHDRAW_PERMISSION', caseId: 'measured-impact' });
    const value = projectBalancer(state), view = show(value, { onClose: vi.fn() });
    expect(attempt().textContent).toContain('已撤回同意');
    expect(attempt().textContent).toContain('还剩0秒');
    expect(state.chaosHunter.life.parcel.holder).toBe('PLAYER');
    expect(state.chaosHunter.life.playerLocation).toBe('A');
    expect(state.balancer.life.guardPlate.integrity).toBe(65);
    expect(state.spirituality).toBe(before.spirituality);
    expect(value.actions.some(action => action.enabled && ['APPLY_IMPACT', 'MEASURED_RESISTANCE', 'CONSENT_MIRA'].includes(action.command.type))).toBe(false);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires real walking, inspection, retrieval and return before close, then preserves the completed record', () => {
    let state = ba(resisted(), { type: 'WALK', caseId: 'measured-impact', to: 'B' });
    state = ba(state, { type: 'APPLY_IMPACT', caseId: 'measured-impact' });
    const onClose = vi.fn(), view = show(projectBalancer(state), { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const closed = closeCase(state, 'measured-impact'), value = projectBalancer(closed);
    view.rerender(<BalancerPanel value={value} busy={false} onCommand={view.onCommand} onClose={onClose} />);
    const goal = value.life.cases.find(entry => entry.id === 'measured-impact')!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${goal.title} · 已收束` }));
    expect(attempt().textContent).toContain('原物已经实际归还');
    expect(attempt().textContent).toContain('本次现场已实际收束');
    expect(screen.getByRole('region', { name: '平衡者唯一原护板' }).textContent).toContain('完整度50/65');
    expect(closed.chaosHunter.life.parcel.holder).toBe('GUIDE');
    expect(closed.chaosHunter.life.playerLocation).toBe('START');
    expect(closed.progression.mastery['justiciar.s2.measured-resistance']).toBe(8);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

function lifeComplete(): SliceState {
  let state = ba(promoted(), { type: 'BUY_GUARD_PLATE' });
  for (const caseId of BALANCER_CASE_IDS) state = ordinaryCase(state, caseId);
  return ba(state, { type: 'REFLECT' });
}

describe('Balancer panel: optional original-room conflict', () => {
  it('shows independent Caspar46 and actual costs when inspecting the optional encounter without starting it', () => {
    const state = lifeComplete(), before = structuredClone(state), value = projectBalancer(state), view = show(value);
    fireEvent.click(within(targets()).getByRole('button', { name: '可选原演练房交战' }));
    const scene = screen.getByRole('region', { name: '平衡者原演练房冲突' });
    expect(scene.textContent).toContain('卡斯帕·霍尔特 · 46岁');
    expect(scene.textContent).toContain('健康100 · 精神100 · 灵性120');
    expect(scene.textContent).toContain('完整度65/65');
    expect(scene.textContent).toContain('不拦截弧光');
    expect(scene.textContent).toContain('精神施压单独结算精神后果');
    expect(primary().textContent).toContain('2精神');
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state).toEqual(before);
    fireEvent.click(primary());
    expect(screen.getByRole('dialog').textContent).toContain('2精神');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PREPARE_ENCOUNTER' });
  });

  it('shows the same adults and carried originals actually outside while keeping physical exit as a separate saved action', () => {
    let state = ba(lifeComplete(), { type: 'PREPARE_ENCOUNTER' });
    state = ba(state, { type: 'ENCOUNTER_TALK' });
    const value = projectBalancer(state), view = show(value, { onClose: vi.fn() });
    const scene = screen.getByRole('region', { name: '平衡者原演练房冲突' });
    expect(scene.textContent).toContain('米拉在室外，薇娜在室外');
    expect(scene.textContent).toContain('支付2精神');
    expect(state.chaosHunter.life.volunteer.location).toBe('OUTSIDE');
    expect(state.chaosHunter.life.guide.location).toBe('OUTSIDE');
    for (const item of [state.chaosHunter.life.parcel, state.chaosHunter.life.paper, state.chaosHunter.life.line]) {
      expect(item).toMatchObject({ holder: 'GUIDE', location: 'OUTSIDE' });
    }
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    fireEvent.click(publicButton(value, 'LEAVE_ENCOUNTER'));
    expect(screen.getByRole('dialog').textContent).toContain('4米4秒');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(state.chaosHunter.life.playerLocation).toBe('A');
  });
});
