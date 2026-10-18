/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BarrenMatriarchPanel, type BarrenMatriarchPanelProps } from '../../src/renderer/BarrenMatriarchPanel.js';
import { projectBarrenMatriarch } from '../../src/domain/barren-matriarch/index.js';
import { BARREN_MATRIARCH_PREPARATION_IDS, type BarrenMatriarchProjection } from '../../src/domain/barren-matriarch/types.js';
import { BARREN_MATRIARCH_CASE_IDS, type BarrenMatriarchCaseId } from '../../src/domain/barren-matriarch/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { ba, directedInitial3, dose, originalCoffinBearer, prepared, promoted, taught } from '../domain/barren-matriarch-directed-helper.js';

afterEach(cleanup);
// Actual source is the complete 674-command Mother campaign with four untreated injuries.
// Interactive states use declared pre-journal UNIT budgets and public commands.
// These renderer branches are not natural completion evidence.
beforeAll(() => { originalCoffinBearer(); }, 60_000);
const source = () => projectBarrenMatriarch(directedInitial3());
function show(value: BarrenMatriarchProjection = source(), extra: Partial<BarrenMatriarchPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '荒芜主母目标' });
const resources = () => screen.getByRole('region', { name: '荒芜主母当前资源' });
function openPrimary() {
  fireEvent.click(primary());
  return screen.getByRole('dialog', { name: '荒芜主母操作确认' });
}
function confirm(dialog = screen.getByRole('dialog')) {
  return within(dialog).getByRole('button', { name: '确认执行这一次操作' });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|CH3-LINE-PRACTICE|\bSTART\b/;

describe('BarrenMatriarch panel: original source and independent potion choices', () => {
  it('shows the living original S3 resources, three independent bottles and the actual paid next step', () => {
    const state = originalCoffinBearer(), value = projectBarrenMatriarch(state), view = show(value);
    expect(screen.getByRole('heading', { name: '荒芜主母·母亲序列2' })).toBeTruthy();
    expect(resources().textContent).toContain(`健康${state.health}/100 · 精神${state.mind}/100 · 灵性${state.spirituality}/120`);
    expect(resources().textContent).toContain(`${state.cash}便士 · 本周行动${state.actionsRemaining}`);
    expect(resources().textContent).toContain('原伤继续生效');
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(disabled(primary())).toBe(!value.actions.find(action => action.command.type === 'LEARN_GUIDANCE')!.enabled);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.container.textContent).toContain('可选择继续停留抬棺人');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state.injuries.some(injury => injury.severity === 'HEAVY')).toBe(true);
    expect(state).toMatchObject({ week: 174, revision: 675, status: 'ACTIVE', health: 50, mind: 100, spirituality: 116, cash: 335, character: { gender: 'FEMALE' } });
    expect(disabled(primary())).toBe(true);
  });

  it('shows actual promotion costs, thirteen inherited and two new skills with the original injury state', () => {
    const state = promoted(), value = projectBarrenMatriarch(state), view = show(value);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(state.mind).toBeLessThan(100);
    expect(value.abilities).toHaveLength(15);
    expect(value.abilities.slice(-2).map(ability => ability.id)).toEqual(['mother.s2.bounded-dormancy', 'mother.s2.root-buffer']);
    expect(value.abilities.slice(-2).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const [id, mastery] of Object.entries(originalCoffinBearer().progression.mastery)) {
      expect(value.abilities.find(ability => ability.id === id)?.mastery).toBe(mastery);
    }
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(resources().textContent).toContain(`健康${state.health}/100`);
    expect(resources().textContent).toContain(`现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
    expect(state.injuries).toEqual(originalCoffinBearer().injuries);
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('keeps the selected bottle after its actual labour receipt and never dispatches a goal choice', () => {
    const state = taught(), value = projectBarrenMatriarch(state), onCommand = vi.fn();
    const view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectBarrenMatriarch(ba(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<BarrenMatriarchPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('allows selecting either actually owned bottle after paid preparation and keeps the selected consume primary', () => {
    let state = taught();
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) state = ba(state, { type: 'PREPARE_TASK', taskId });
    state = ba(state, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-1' });
    state = ba(state, { type: 'BUY_POTION', bottleId: 'barren-matriarch-potion-2' });
    state = ba(state, { type: 'PREPARE_PROMOTION' });
    const value = projectBarrenMatriarch(state), view = show(value), bottle = value.bottles[1]!;
    expect(value.insideCase).toBe(true);
    const goal = within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` });
    expect(disabled(goal)).toBe(false);
    fireEvent.click(goal);
    expect(primary().textContent).toContain('接受成功后角色成为女性并确认服用第2瓶');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    fireEvent.click(within(dialog).getByRole('button', { name: '接受角色变化，确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true, acceptFeminization: true });
    expect(state.barrenMatriarch.bottles.slice(0, 2).map(entry => entry.status)).toEqual(['PLAYER', 'PLAYER']);
  });

  it('confirms the exact bottle, success rate and paid failure risk and submits only one read-only intent', () => {
    const state = prepared(), value = projectBarrenMatriarch(state), before = structuredClone(state), view = show(value);
    const dialog = openPrimary(), bottle = value.bottles[0]!;
    expect(dialog.textContent).toContain(bottle.source);
    expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('140便士');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '接受角色变化，确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    expect(state).toEqual(before);
  });
});

describe('BarrenMatriarch panel: confirmation, focus and saved-state safety', () => {
  it('focuses and traps confirmation, blocks background controls and restores focus on cancel or Escape', () => {
    const onClose = vi.fn(), view = show(source(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取荒芜主母成品与专业准备指导' }));
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
    const value = source(), onCommand = vi.fn(), view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes unsubmitted confirmation on save failure and delegates retry to the existing save operation', () => {
    const value = source(), onCommand = vi.fn(), view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<BarrenMatriarchPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(disabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked through error clearing until changed saved facts arrive and then focuses the new phase', () => {
    const state = directedInitial3(), value = projectBarrenMatriarch(state), onCommand = vi.fn();
    const view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<BarrenMatriarchPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    const after = projectBarrenMatriarch(ba(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<BarrenMatriarchPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(resources().textContent).toContain(`${state.cash - 500}便士`);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('keeps the exact paid bottle intent locked across a save error until its actual failed receipt arrives', () => {
    const state = prepared('FAILURE'), value = projectBarrenMatriarch(state), onCommand = vi.fn();
    const view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = within(dialog).getByRole('button', { name: '接受角色变化，确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    view.rerender(<BarrenMatriarchPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    fireEvent.click(primary());
    expect(onCommand).toHaveBeenCalledTimes(1);
    const after = ba(state, dose);
    view.rerender(<BarrenMatriarchPanel value={projectBarrenMatriarch(after)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(resources().textContent).toContain(`健康${after.health}/100 · 精神${after.mind}/100`);
    expect(after.barrenMatriarch.bottles[0]!.status).toBe('CONSUMED');
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale unsubmitted confirmation when newer actual facts arrive', () => {
    const state = directedInitial3(), value = projectBarrenMatriarch(state), onCommand = vi.fn();
    const view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<BarrenMatriarchPanel value={projectBarrenMatriarch(ba(state, { type: 'LEARN_GUIDANCE' }))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('disables all public buttons when busy, externally blocked or dead', () => {
    for (const mode of ['busy', 'blocked', 'dead'] as const) {
      // Explicit UNIT-only pre-journal terminal display fixture, not a natural death.
      const state = directedInitial3();
      if (mode === 'dead') { state.status = 'DEAD'; state.health = 0; }
      const view = show(projectBarrenMatriarch(state), { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
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

describe('BarrenMatriarch panel: actual paid results and retained resources', () => {
  it.each([
    ['GREAT_SUCCESS', 0, 8, true],
    ['SUCCESS', 0, 15, true],
    ['FAILURE', 15, 25, false],
    ['GREAT_FAILURE', 25, 45, false],
  ] as const)('shows the saved %s bottle outcome without healing or spending a second bottle', (kind, healthCost, mindCost, succeeded) => {
    const before = prepared(kind), state = ba(before, dose), value = projectBarrenMatriarch(state), view = show(value);
    expect(resources().textContent).toContain(`健康${before.health - healthCost}/100 · 精神${before.mind - mindCost}/100 · 灵性${before.spirituality}/120`);
    expect(value.promoted).toBe(succeeded);
    expect(state.barrenMatriarch.bottles.map(bottle => bottle.status)).toEqual(['CONSUMED', 'SUPPLIER', 'SUPPLIER']);
    expect(state.injuries).toEqual(before.injuries);
    expect(resources().textContent).toContain(`累计风险${before.injuryRisk}`);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    expect(state.barrenMatriarch.preparedWeek).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows a paid failed bottle as exhausted when selected and preserves all three completed preparations', () => {
    const state = ba(prepared('FAILURE'), dose), value = projectBarrenMatriarch(state), view = show(value), bottle = value.bottles[0]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异，仍为抬棺人');
    expect(value.preparations.every(entry => entry.completedWeek !== null)).toBe(true);
    expect(value.actions.some(action => action.command.type === 'CONSUME' && action.command.bottleId === bottle.id)).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms ending paid preparation separately and keeps its original unpaid-for-again bottle', () => {
    const state = prepared(), value = projectBarrenMatriarch(state), onCommand = vi.fn(), onClose = vi.fn();
    const view = render(<BarrenMatriarchPanel value={value} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const action = value.actions.find(entry => entry.command.type === 'LEAVE_PREPARATION')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('不退成本');
    fireEvent.click(confirm(dialog));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_PREPARATION' });
    const after = ba(state, { type: 'LEAVE_PREPARATION' });
    view.rerender(<BarrenMatriarchPanel value={projectBarrenMatriarch(after)} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(after.cash).toBe(state.cash);
    expect(after.actionsRemaining).toBe(state.actionsRemaining);
    expect(after.barrenMatriarch.bottles[0]!.status).toBe('PLAYER');
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays exact bottle purchase and per-bottle labour costs before dispatching', () => {
    const state = taught(), value = projectBarrenMatriarch(state), view = show(value);
    const action = value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === dose.bottleId)!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('6400便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(state.barrenMatriarch.bottles[0]!.status).toBe('SUPPLIER');
  });

  it('shows the 900-penny balance only on the original bottle with five completed labour steps', () => {
    let state = taught();
    for (let n = 0; n < 5; n++) state = ba(state, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const value = projectBarrenMatriarch(state), view = show(value);
    const discounted = value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === dose.bottleId)!;
    expect(discounted.cost).toContain('900便士');
    expect(value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === 'barren-matriarch-potion-2')!.cost).toContain('6400便士');
    fireEvent.click(screen.getByRole('button', { name: name => name.startsWith(discounted.label) }));
    expect(screen.getByRole('dialog').textContent).toContain('900便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(state.barrenMatriarch.bottles[0]!.status).toBe('SUPPLIER');
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

describe('BarrenMatriarch panel: authored prose and preserved names', () => {
  it('adapts fixed authoring labels but leaves a custom name inside saved history untouched', () => {
    const actual = source();
    // Display-boundary probe only. Mechanical state and commands still come from
    // the real source; this does not claim to be a saved gameplay transition.
    const customName = '原创G候选';
    const value: BarrenMatriarchProjection = {
      ...actual,
      title: '本作原创G荒芜主母·母亲序列2',
      inheritedHistory: [...actual.inheritedHistory, `原人物${customName}的既有经历继续保留。`],
    };
    const view = show(value);
    expect(screen.getByRole('heading', { name: '荒芜主母·母亲序列2' })).toBeTruthy();
    expect(view.container.textContent).toContain(`原人物${customName}的既有经历继续保留。`);
    expect(value.title).toBe('本作原创G荒芜主母·母亲序列2');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('retains the original Mother histories and surrendered Nolan without exposing random or replay internals', () => {
    const state = promoted(), original = originalCoffinBearer(), value = projectBarrenMatriarch(state), view = show(value);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(state.coffinBearer.encounter).toEqual(original.coffinBearer.encounter);
    expect(state.ancientAlchemist).toEqual(original.ancientAlchemist);
    expect(state.coffinBearer.encounter).toMatchObject({ targetId: 'CB3-NOLAN', enemyStatus: 'SURRENDERED' });
    expect(view.container.textContent).not.toContain(state.random.seed);
    expect(view.container.textContent).not.toMatch(/randomBefore|randomAfter|branchRoll|snapshot|journal|sourceId/);
    expect(view.container.textContent).not.toMatch(editorial);
  });
});


describe('Barren Matriarch explicit game-character consequence acceptance', () => {
  it.each(['MALE', 'FEMALE'] as const)('shows the %s body, success consequence and failure boundary before an explicit accepted dose', gender => {
    const state = prepared('SUCCESS', false, gender), before = structuredClone(state), view = show(projectBarrenMatriarch(state));
    const dialog = openPrimary(), consequence = within(dialog).getByRole('region', { name: '晋升后的角色身体变化' });
    expect(consequence.textContent).toContain(`当前角色为${gender === 'MALE' ? '男性' : '女性'}`);
    expect(consequence.textContent).toContain('男性角色的性别会实际变为女性');
    expect(consequence.textContent).toContain('已经是女性的角色保持女性');
    expect(consequence.textContent).toContain('服药失败时，角色性别保持原状');
    expect(consequence.textContent).toContain('与现实玩家的性别或身份无关');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '接受角色变化，确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: dose.bottleId, confirmed: true, acceptFeminization: true });
    expect(state).toEqual(before);
  });

  it.each(['MALE', 'FEMALE'] as const)('allows a %s character to decline the consequence and remain S3 without spending the dose', gender => {
    const state = prepared('SUCCESS', false, gender), before = structuredClone(state), view = show(projectBarrenMatriarch(state));
    const dialog = openPrimary();
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled(); expect(state).toEqual(before);
    expect(state.progression.sequence).toBe(3); expect(state.character.gender).toBe(gender);
    expect(state.barrenMatriarch.bottles[0]!.status).toBe('PLAYER');
  });

  it.each(['MALE', 'FEMALE'] as const)('shows the actual accepted %s success as FEMALE and preserves all old bodies and injuries', gender => {
    const before = prepared('SUCCESS', false, gender), state = ba(before, dose), value = projectBarrenMatriarch(state), view = show(value);
    expect(state.character.gender).toBe('FEMALE'); expect(state.progression.sequence).toBe(2);
    expect(resources().textContent).toContain('当前角色性别：女性');
    expect(state.injuries).toEqual(before.injuries); expect(state.coffinBearer).toEqual(before.coffinBearer);
    expect(state.barrenMatriarch.acquisitionJournal.at(-1)!.before.gender).toBe(gender);
    expect(state.barrenMatriarch.acquisitionJournal.at(-1)!.after.gender).toBe('FEMALE');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it.each(['MALE', 'FEMALE'] as const)('shows a failed %s dose without silently changing the character gender', gender => {
    const before = prepared('FAILURE', false, gender), state = ba(before, dose), view = show(projectBarrenMatriarch(state));
    expect(state.character.gender).toBe(gender); expect(state.progression.sequence).toBe(3);
    expect(resources().textContent).toContain(`当前角色性别：${gender === 'MALE' ? '男性' : '女性'}`);
    expect(state.injuries).toEqual(before.injuries); expect(state.coffinBearer).toEqual(before.coffinBearer);
    expect(state.health).toBe(before.health - 15); expect(state.mind).toBe(before.mind - 25);
    expect(state.barrenMatriarch.bottles[0]!.status).toBe('CONSUMED');
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});


const room = () => screen.getByRole('region', { name: '荒芜主母原场事务' });
const attemptRegion = () => screen.getByRole('region', { name: '荒芜主母本次实际尝试' });
function ordinaryCase(s: SliceState, caseId: BarrenMatriarchCaseId): SliceState {
  const bounded = caseId === 'bounded-dormancy';
  s = ba(s, { type: 'OBSERVE', caseId }); s = ba(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
  s = ba(s, { type: 'WALK', caseId, to: 'A' }); s = ba(s, { type: 'CHECK_ORIGINALS', caseId });
  s = ba(s, { type: 'CONSENT_OWNER', caseId }); s = ba(s, { type: 'TAKE_KIT', caseId });
  if (bounded) s = ba(s, { type: 'WALK', caseId, to: 'B' });
  for (const type of ['CHECK_SAMPLE', 'CONSENT_SAMPLE', 'TAKE_SAMPLE'] as const) s = ba(s, { type, caseId });
  s = ba(s, { type: 'WALK', caseId, to: bounded ? 'A' : 'B' });
  if (caseId === 'withdrawn-transfer') s = ba(s, { type: 'WITHDRAW_PERMISSION', caseId });
  s = ba(s, { type: 'VERIFY_TRANSPORT', caseId });
  if (caseId === 'finite-root-buffer') { s = ba(s, { type: 'CONFIRM_LIMITED', caseId }); s = ba(s, { type: 'ORDINARY_SUPPORT', caseId }); }
  s = ba(s, { type: 'STOP', caseId }); s = ba(s, { type: 'WALK', caseId, to: bounded ? 'B' : 'A' });
  s = ba(s, { type: 'RETURN_SAMPLE', caseId });
  if (bounded) s = ba(s, { type: 'WALK', caseId, to: 'A' });
  s = ba(s, { type: 'RETURN_KIT', caseId }); s = ba(s, { type: 'WALK', caseId, to: 'START' });
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) s = ba(s, { type, caseId });
  return s;
}
const lifeSources = new Map<string, SliceState>();
/** Declared UNIT-only cursor and optional AP budget are selected before the
 * first S2 journal. All potion and knowledge checks then run as real commands. */
function lifePromotion(success: boolean, actions = 100): SliceState {
  const key = `${success}:${actions}`;
  if (!lifeSources.has(key)) {
    let s = directedInitial3(); s.actionsRemaining = actions;
    const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
    const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
    let selected: number | null = null;
    for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
      const rng = new DeterministicActionRandomStream(s.random.seed, cursor), potion = rng.nextInt(1, 100), roll = rng.nextInt(1, 100);
      if (potion > 5 && potion <= potionChance && (success ? roll <= lifeChance : roll > lifeChance && roll < 96)) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded original-seed UNIT input for the actual knowledge check.');
    s.random.cursor = selected; s = ba(s, { type: 'LEARN_GUIDANCE' });
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
    s = ba(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ba(s, { type: 'PREPARE_PROMOTION' });
    lifeSources.set(key, ba(s, dose));
  }
  return structuredClone(lifeSources.get(key)!);
}
function readySample(caseId: BarrenMatriarchCaseId = 'bounded-dormancy', success = true, actions = 100): SliceState {
  let s = lifePromotion(success, actions);
  if (caseId === 'finite-root-buffer') s = ba(s, { type: 'BUY_ROOT_PAD' });
  for (const previous of BARREN_MATRIARCH_CASE_IDS) { if (previous === caseId) break; s = ordinaryCase(s, previous); }
  s = ba(s, { type: 'OBSERVE', caseId }); s = ba(s, { type: 'PREPARE', caseId, method: 'ABILITY' });
  s = ba(s, { type: 'WALK', caseId, to: 'A' }); s = ba(s, { type: 'CHECK_ORIGINALS', caseId });
  s = ba(s, { type: 'CONSENT_OWNER', caseId }); s = ba(s, { type: 'TAKE_KIT', caseId });
  if (caseId === 'bounded-dormancy') s = ba(s, { type: 'WALK', caseId, to: 'B' });
  for (const type of ['CHECK_SAMPLE', 'CONSENT_SAMPLE', 'TAKE_SAMPLE'] as const) s = ba(s, { type, caseId });
  if (caseId === 'finite-root-buffer') {
    s = ba(s, { type: 'WALK', caseId, to: 'B' }); s = ba(s, { type: 'VERIFY_TRANSPORT', caseId }); s = ba(s, { type: 'CONFIRM_LIMITED', caseId });
  }
  return s;
}
function publicButton(value: BarrenMatriarchProjection, type: string): HTMLButtonElement {
  const action = value.actions.find(entry => entry.command.type === type)!;
  return screen.getByRole('button', { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}

describe('Barren Matriarch original nursery, finite effects and actual costs', () => {
  it('renders both original adults, three finite original samples, old injuries and one unpurchased pad', () => {
    const state = promoted(), value = projectBarrenMatriarch(state), view = show(value);
    for (const sample of value.life.site.samples) expect(room().textContent).toContain(sample);
    for (const object of [value.life.site.box, value.life.site.tag, value.life.site.paper]) expect(room().textContent).toContain(object);
    for (const text of ['艾达·芬恩', '莉娜·肖', '46岁', '39岁', '完整度65/65', '30便士']) expect(room().textContent).toContain(text);
    expect(state.coffinBearer.life.samples.map(sample => [sample.id, sample.alive, sample.vitality])).toEqual([
      ['CB3-LIVE-1', true, 47], ['CB3-LIVE-2', true, 49], ['CB3-DRY-1', false, 0],
    ]);
    expect(resources().textContent).toContain('现有伤势4处');
    expect(view.container.textContent).not.toMatch(editorial); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms the ordinary alternative without choosing it by merely viewing the case', () => {
    const state = ba(promoted(), { type: 'OBSERVE', caseId: 'bounded-dormancy' }), value = projectBarrenMatriarch(state), view = show(value);
    const action = value.actions.find(entry => entry.command.type === 'PREPARE' && entry.command.method === 'ORDINARY')!;
    fireEvent.click(screen.getByRole('button', { name: name => name.startsWith(action.label) }));
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PREPARE', caseId: 'bounded-dormancy', method: 'ORDINARY' });
  });

  it.each([true, false])('shows actual paid knowledge-check costs for dormancy success=%s', success => {
    const before = readySample('bounded-dormancy', success), state = ba(before, { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' }), value = projectBarrenMatriarch(state), view = show(value, { onClose: vi.fn() });
    expect(attemptRegion().textContent).toContain(`实际消耗5灵性、${success ? 2 : 4}精神、0健康`);
    expect(attemptRegion().textContent).toContain(`本次有限效果还剩${success ? 60 : 0}秒`);
    expect(attemptRegion().textContent).toContain('知识'); expect(attemptRegion().textContent).toContain('唤醒不增加活性');
    expect(state.health).toBe(before.health); expect(state.injuries).toEqual(before.injuries);
    expect(state.coffinBearer.life.samples).toEqual(before.coffinBearer.life.samples);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(within(targets()).getAllByRole('button').every(disabled)).toBe(true);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(view.container.textContent).not.toMatch(editorial);
  });

  it('confirms actual zero-AP waiting, then shows expired finite protection and permanently lost plant vitality', () => {
    const before = ba(readySample(), { type: 'BOUNDED_DORMANCY', caseId: 'bounded-dormancy' }), value = projectBarrenMatriarch(before), view = show(value);
    fireEvent.click(publicButton(value, 'WAIT_EFFECT')); const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('0行动'); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WAIT_EFFECT', caseId: 'bounded-dormancy' });
    const after = ba(before, { type: 'WAIT_EFFECT', caseId: 'bounded-dormancy' });
    view.rerender(<BarrenMatriarchPanel value={projectBarrenMatriarch(after)} busy={false} onCommand={view.onCommand} />);
    expect(after.coffinBearer.life.clockSeconds).toBe(before.coffinBearer.life.clockSeconds + 60);
    expect(after.coffinBearer.life.samples[0]!.vitality).toBeLessThan(before.coffinBearer.life.samples[0]!.vitality);
    expect(after.coffinBearer.life.samples[2]).toMatchObject({ alive: false, vitality: 0 });
    expect(attemptRegion().textContent).toContain('本次有限效果还剩0秒');
    expect(after.actionsRemaining).toBe(before.actionsRemaining); expect(after.health).toBe(before.health);
  });

  it('shows withdrawn current permission with no implied return, refund or renewed casting', () => {
    let state = ba(readySample('withdrawn-transfer'), { type: 'BOUNDED_DORMANCY', caseId: 'withdrawn-transfer' });
    state = ba(state, { type: 'WALK', caseId: 'withdrawn-transfer', to: 'B' });
    state = ba(state, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-transfer' });
    const value = projectBarrenMatriarch(state), view = show(value);
    expect(attemptRegion().textContent).toContain('当前许可已撤回'); expect(attemptRegion().textContent).toContain('本次原样尚未实际交还');
    expect(attemptRegion().textContent).toContain('已付成本、实际时间和失去的活性不退');
    expect(value.actions.some(action => action.enabled && action.command.type === 'BOUNDED_DORMANCY')).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it.each([true, false])('shows root-buffer success=%s with actual self-impact, retained injury and the same worn pad', success => {
    const initial = readySample('finite-root-buffer', success), buffered = ba(initial, { type: 'ROOT_BUFFER', caseId: 'finite-root-buffer' });
    const state = ba(buffered, { type: 'APPLY_IMPACT', caseId: 'finite-root-buffer' }), value = projectBarrenMatriarch(state), view = show(value);
    expect(attemptRegion().textContent).toContain(`实际消耗6灵性、${success ? 2 : 4}精神、${success ? 2 : 5}健康`);
    expect(attemptRegion().textContent).toContain('原衬垫磨损15');
    expect(room().textContent).toContain('完整度50/65'); expect(state.health).toBe(initial.health - (success ? 2 : 5));
    expect(state.injuries).toEqual(initial.injuries); expect(state.coffinBearer.life.samples[2]).toMatchObject({ alive: false, vitality: 0 });
    expect(view.onCommand).not.toHaveBeenCalled(); expect(view.container.textContent).not.toMatch(editorial);
  });

  it('keeps an exhausted-AP open scene usable for zero-action physical cleanup without free healing', () => {
    const state = ba(ba(readySample('finite-root-buffer', true, 15), { type: 'ROOT_BUFFER', caseId: 'finite-root-buffer' }), { type: 'APPLY_IMPACT', caseId: 'finite-root-buffer' });
    expect(state.actionsRemaining).toBe(0); const value = projectBarrenMatriarch(state), view = show(value);
    expect(resources().textContent).toContain('本周行动0');
    const stop = publicButton(value, 'STOP'); expect(disabled(stop)).toBe(false); fireEvent.click(stop);
    fireEvent.click(confirm()); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'STOP', caseId: 'finite-root-buffer' });
    expect(state.health).toBe(48); expect(state.barrenMatriarch.life.rootPad.integrity).toBe(50);
  });
});
