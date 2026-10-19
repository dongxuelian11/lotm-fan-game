/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AbominationPanel, type AbominationPanelProps } from '../../src/renderer/AbominationPanel.js';
import { projectAbomination } from '../../src/domain/abomination/index.js';
import { ABOMINATION_PREPARATION_IDS, type AbominationProjection } from '../../src/domain/abomination/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { ABOMINATION_CASE_IDS, type AbominationCaseId } from '../../src/domain/abomination/life.js';
import { playerText } from '../../src/shared/player-text.js';
import { ab, directedInitial2, dose, originalAncientEvil, oldChainedRoots, prepared, promoted, taught } from '../domain/abomination-directed-helper.js';

afterEach(cleanup);
// Every view below comes from the real public projector. Acquisition helpers retain
// the complete immutable 642-command source; declared pre-journal UNIT budgets
// are renderer coverage and never natural-play completion evidence.
beforeAll(() => { originalAncientEvil(); promoted(); }, 60_000);
function show(value: AbominationProjection = projectAbomination(originalAncientEvil()), extra: Partial<AbominationPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<AbominationPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '神孽目标' });
const resources = () => screen.getByRole('region', { name: '神孽当前资源' });
const room = () => screen.getByRole('region', { name: '神孽原场事务' });
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '神孽操作确认' }); }
const confirm = (dialog = screen.getByRole('dialog')) => within(dialog).getByRole('button', { name: '确认执行这一次操作' });
const editorial = /候选|原创G|本作G|原文未核|编号推断|SD3-QUIET-ROOM|\bSTART\b/;

describe('Abomination panel: actual original source and independent bottles', () => {
  it('shows the complete living S2 source resources, three bottles and the real guidance fee', () => {
    const state = originalAncientEvil(), roots = oldChainedRoots(state), view = show(projectAbomination(state));
    expect(screen.getByRole('heading', { name: '神孽·被缚者序列1' })).toBeTruthy();
    expect(resources().textContent).toContain('健康100/100 · 精神97/100 · 灵性105/120');
    expect(resources().textContent).toContain('730便士 · 本周行动3');
    expect(resources().textContent).toContain('原伤势0处');
    expect(primary().textContent).toContain('500便士');
    expect(disabled(primary())).toBe(false);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(view.container.textContent).toContain('可选择继续停留古代邪物');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(oldChainedRoots(state)).toEqual(roots);
  });

  it('shows actual disabled reasons without inventing an affordable purchase', () => {
    const state = ab(originalAncientEvil(), { type: 'LEARN_GUIDANCE' }), value = projectAbomination(state), view = show(value);
    const action = value.actions.find(a => a.command.type === 'BUY_POTION' && 'bottleId' in a.command && a.command.bottleId === value.bottles[0]!.id)!;
    expect(action.enabled).toBe(false);
    const button = Array.from(view.container.querySelectorAll('button')).find(b => b.textContent?.includes(playerText(action.label)))!;
    expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(`abomination-reason-${action.id}`);
    expect(document.getElementById(`abomination-reason-${action.id}`)?.textContent).toBe(playerText(action.reason!));
    expect(resources().textContent).toContain('230便士');
    fireEvent.click(button);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps a selected bottle after its actual independent labour receipt', () => {
    const state = taught(), value = projectAbomination(state), onCommand = vi.fn(), view = show(value, { onCommand });
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectAbomination(ab(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<AbominationPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('confirms the selected owned bottle and exact costs without altering the source or double submitting', () => {
    let state = taught();
    for (const taskId of ABOMINATION_PREPARATION_IDS) state = ab(state, { type: 'PREPARE_TASK', taskId });
    state = ab(state, { type: 'BUY_POTION', bottleId: 'abomination-potion-1' });
    state = ab(state, { type: 'BUY_POTION', bottleId: 'abomination-potion-2' });
    state = ab(state, { type: 'PREPARE_PROMOTION' });
    const before = structuredClone(state), value = projectAbomination(state), bottle = value.bottles[1]!, view = show(value);
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(playerText(bottle.source));
    expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state).toEqual(before);
  });

  it('renders the actual post-promotion site, 19 inherited skills and two zero masteries', () => {
    const state = promoted(), value = projectAbomination(state), roots = oldChainedRoots(state), view = show(value);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(value.abilities).toHaveLength(21);
    expect(value.abilities.slice(-2).map(a => a.mastery)).toEqual([0, 0]);
    for (const id of Object.keys(originalAncientEvil().progression.mastery)) expect(value.abilities.find(a => a.id === id)?.mastery).toBe(originalAncientEvil().progression.mastery[id]);
    expect(room().textContent).toContain('埃尔莎·莫尔 · 43岁');
    expect(room().textContent).toContain('实际在室外');
    expect(room().textContent).toContain('原衣物1套');
    expect(room().textContent).toContain('原包1个');
    expect(room().textContent).toContain('本阶段协作耗力0/12');
    expect(room().textContent).not.toMatch(/原卡|原铃|诺拉|能量100/);
    expect(view.container.textContent).not.toMatch(editorial);
    expect(oldChainedRoots(state)).toEqual(roots);
  });

  it('keeps a custom player name exact when displaying authored inherited prose', () => {
    // Display-only name fixture; no new source history, command or roll is fabricated.
    const state = originalAncientEvil(); state.character.name = '原创G候选艾洛';
    const value = projectAbomination(state), before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain(state.character.name);
    expect(value).toEqual(before);
  });
});

describe('Abomination panel: confirmation and saved public facts', () => {
  it('traps focus, disables background choices and returns focus after cancellation', () => {
    const onClose = vi.fn(), view = show(undefined, { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(dialog.querySelector('h3'));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const target of within(targets()).getAllByRole('button')) expect(disabled(target)).toBe(true);
    const close = screen.getByRole('button', { name: '返回普通生活' });
    expect(disabled(close)).toBe(true); fireEvent.click(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('holds a submitted intent until changed saved facts arrive, then focuses the new phase', () => {
    const state = directedInitial2(), value = projectAbomination(state), onCommand = vi.fn(), view = show(value, { onCommand });
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<AbominationPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    const after = projectAbomination(ab(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<AbominationPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('invalidates an unsubmitted confirmation when actual saved facts change', () => {
    const state = prepared(), value = projectAbomination(state), onCommand = vi.fn(), view = show(value, { onCommand });
    openPrimary();
    view.rerender(<AbominationPanel value={projectAbomination(ab(state, dose))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('blocks every button during a pending save or external lock and closes outside scenes without a domain command', () => {
    for (const mode of ['busy', 'blocked'] as const) {
      const view = show(undefined, { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      expect(view.onCommand).not.toHaveBeenCalled(); view.unmount();
    }
    const onClose = vi.fn(), view = show(undefined, { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled();
  });
});

function prepareLifeCase(state: SliceState, caseId: AbominationCaseId, method: 'ABILITY' | 'ORDINARY'): SliceState {
  state = ab(state, { type: 'OBSERVE', caseId });
  state = ab(state, { type: 'CONSENT', caseId, permission: 'OWNER' });
  if (method === 'ABILITY') state = ab(state, { type: 'CONSENT', caseId, permission: 'ABILITY' });
  if (state.abomination.life.site.volunteer.location === 'OUTSIDE') state = ab(state, { type: 'INVITE', caseId });
  state = ab(state, { type: 'PREPARE', caseId, method });
  for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'PLACE_PIECE'] as const) state = ab(state, { type, caseId });
  return ab(state, { type: caseId === 'spoken-hesitation' ? 'PREPARE_CUE' : 'PREPARE_PULSE', caseId });
}
function closeLifeCase(state: SliceState, caseId: AbominationCaseId): SliceState {
  for (const type of ['TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'REPORT'] as const) state = ab(state, { type, caseId });
  return state;
}
function ordinaryCase(state: SliceState, caseId: AbominationCaseId): SliceState {
  state = prepareLifeCase(state, caseId, 'ORDINARY');
  state = ab(state, { type: caseId === 'spoken-hesitation' ? 'PERFORM_CUE' : 'PERFORM_PULSE', caseId });
  return closeLifeCase(state, caseId);
}
let completedCache: SliceState | undefined;
function completedLife(): SliceState {
  if (!completedCache) {
    let state = promoted();
    for (const caseId of ABOMINATION_CASE_IDS) state = ordinaryCase(state, caseId);
    completedCache = ab(state, { type: 'REFLECT' });
  }
  return structuredClone(completedCache);
}
let cryCache: SliceState | undefined;
function realCryAtZeroActions(): SliceState {
  if (!cryCache) {
    // Explicit UNIT-only selection before the new-stage journal: original seed,
    // ten AP and original body/resources. Actual acquisition costs five AP,
    // first ordinary case three and the second observation/preparation two.
    // Four actual rolls are promotion, ordinary pulse observation, cry, resistance.
    let state = directedInitial2(); state.actionsRemaining = 10;
    const potionChance = computeCheckChance({ baseAbility: state.character.coreStats.will, difficulty: 30, modifiers: [] });
    const cryChance = computeCheckChance({ baseAbility: state.character.coreStats.will + 1, difficulty: 18, modifiers: [] });
    let selected: number | null = null;
    for (let cursor = state.random.cursor; cursor < state.random.cursor + 512; cursor++) {
      const random = new DeterministicActionRandomStream(state.random.seed, cursor);
      const potion = random.nextInt(1, 100); random.nextInt(1, 100);
      const cry = random.nextInt(1, 100), resistance = random.nextInt(1, 100);
      if (potion > 5 && potion <= potionChance && cry > 5 && cry <= cryChance && resistance > 45) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded original-seed UNIT source for a successful resisted-check sequence.');
    state.random.cursor = selected;
    state = ab(state, { type: 'LEARN_GUIDANCE' });
    for (const taskId of ABOMINATION_PREPARATION_IDS) state = ab(state, { type: 'PREPARE_TASK', taskId });
    state = ab(state, { type: 'BUY_POTION', bottleId: dose.bottleId });
    state = ab(state, { type: 'PREPARE_PROMOTION' }); state = ab(state, dose);
    state = ordinaryCase(state, 'tray-pulse');
    state = prepareLifeCase(state, 'spoken-hesitation', 'ABILITY');
    state = ab(state, { type: 'BRIEF_CRY', caseId: 'spoken-hesitation' });
    expect(state.actionsRemaining).toBe(0);
    expect(state.abomination.life.cue).toMatchObject({ delayImposedSeconds: 3, delayRemainingSeconds: 3, executed: false });
    cryCache = state;
  }
  return structuredClone(cryCache);
}

describe('Abomination panel: finite original room and ordinary exits', () => {
  it('keeps ordinary cancellation visible before buying any piece', () => {
    const state = ab(promoted(), { type: 'OBSERVE', caseId: 'tray-pulse' }), value = projectAbomination(state), view = show(value);
    expect(state.abomination.life.pieces).toEqual([]);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const action = value.actions.find(a => a.command.type === 'ABORT')!;
    expect(action.enabled).toBe(true);
    const exits = screen.getByRole('region', { name: '停止与普通退出' });
    expect(within(exits).getAllByRole('button').length).toBeLessThanOrEqual(2);
    const button = within(exits).getByRole('button', { name: name => name.includes(action.label) });
    expect(disabled(button)).toBe(false);
    fireEvent.click(button); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ABORT', caseId: 'tray-pulse' });
  });

  it('shows one finite pulse and real original movement without changing stored objects', () => {
    const initial = promoted(), roots = oldChainedRoots(initial), state = prepareLifeCase(initial, 'tray-pulse', 'ORDINARY'), value = projectAbomination(state), view = show(value);
    const piece = state.abomination.life.pieces[0]!;
    expect(piece).toMatchObject({ location: 'TRAY', charges: 1, testCharges: 1, testUses: 0 });
    expect(room().textContent).toContain('精神作用（MENTAL），原压力45');
    expect(room().textContent).toContain('唯一测试源剩余1/1');
    expect(room().textContent).toContain('埃尔莎实际走8米');
    expect(room().textContent).toContain('本阶段协作耗力3/12');
    expect(value.life.site.clothing).toEqual(initial.abomination.life.site.clothing);
    expect(value.life.site.bag).toEqual(initial.abomination.life.site.bag);
    expect(oldChainedRoots(state)).toEqual(roots);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps WAIT_1 primary at zero AP after withdrawal leaves two actual seconds, then executes the same cue once', () => {
    let state = realCryAtZeroActions();
    const body = structuredClone(state.abomination.life.site.volunteer), cash = state.cash;
    state = ab(state, { type: 'WITHDRAW_CONSENT', caseId: 'spoken-hesitation', permission: 'ABILITY' });
    const paid = { cash: state.cash, mind: state.mind, spirituality: state.spirituality }, onCommand = vi.fn();
    expect(state.abomination.life.cue?.delayRemainingSeconds).toBe(2);
    const view = show(projectAbomination(state), { onCommand, onClose: vi.fn() });
    expect(screen.getByRole('region', { name: '神孽实际三秒等待' }).textContent).toContain('实际延迟还剩2秒');
    expect(room().textContent).toContain('本案许可已真实撤回');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    for (const remaining of [1, 0]) {
      expect(primary().textContent).toContain('实际等待1秒');
      expect(disabled(primary())).toBe(false);
      fireEvent.click(confirm(openPrimary()));
      const command = onCommand.mock.calls.at(-1)![0];
      expect(command).toEqual({ type: 'WAIT_1', caseId: 'spoken-hesitation' });
      state = ab(state, command);
      expect(state.abomination.life.cue?.delayRemainingSeconds).toBe(remaining);
      view.rerender(<AbominationPanel value={projectAbomination(state)} busy={false} onCommand={onCommand} />);
    }
    expect(onCommand).toHaveBeenCalledTimes(2);
    expect(state.abomination.life.cue?.executed).toBe(true);
    expect(state.abomination.life.pieces.find(p => p.caseId === 'spoken-hesitation')).toMatchObject({ charges: 0, wear: 1, testCharges: 0, testUses: 1 });
    expect(state.abomination.life.site.volunteer).toEqual(body);
    expect({ cash: state.cash, mind: state.mind, spirituality: state.spirituality }).toEqual(paid);
    expect(state.cash).toBe(cash); expect(state.actionsRemaining).toBe(0);
    expect(primary().textContent).not.toContain('实际等待1秒');
    expect(screen.getByRole('region', { name: '神孽实际三秒等待' }).textContent).toContain('原定手势已实际执行一次');
  }, 30_000);

  it('offers ordinary life after three real reports and reflection without another paid preparation', () => {
    const state = completedLife();
    const onClose = vi.fn(), view = show(projectAbomination(state), { onClose });
    expect(state.progression.acting).toBe(100);
    expect(state.abomination.life.pieces.every(piece => piece.location === 'RETURNED' && piece.testCharges === 0)).toBe(true);
    expect(screen.queryByRole('region', { name: '当前主要操作' })).toBeNull();
    expect(view.container.textContent).toContain('三案已结束，可返回普通生活');
    expect(view.container.textContent).not.toContain('15便士');
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});


describe('Abomination panel: optional independent courtyard', () => {
  it('shows the actual separate adult, finite plates, original owners outside and an ordinary exit', () => {
    let state = completedLife();
    const roots = oldChainedRoots(state);
    state = ab(state, { type: 'PREPARE_ENCOUNTER' });
    state = ab(state, { type: 'ENCOUNTER_TALK' });
    const value = projectAbomination(state), view = show(value, { onClose: vi.fn() });
    const yard = screen.getByRole('region', { name: '神孽独立小院冲突' });
    expect(yard.textContent).toContain('罗德里克·霍尔 · 45岁');
    expect(yard.textContent).toContain('健康100 · 精神100 · 灵性120');
    expect(yard.textContent).toContain('本人在独立小院，埃尔莎在室外，原导师在室外');
    expect(yard.textContent).toContain('剩余3/3份用量');
    expect(yard.textContent).toContain('对手原刻片剩余3/3枚');
    expect(yard.textContent).toContain('MENTAL75');
    expect(yard.textContent).toContain('BODY25');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const action = value.actions.find(a => a.command.type === 'LEAVE_ENCOUNTER')!;
    const exit = within(screen.getByRole('region', { name: '停止与普通退出' })).getByRole('button', { name: name => name.includes(action.label) });
    expect(disabled(exit)).toBe(false);
    fireEvent.click(exit); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(oldChainedRoots(state)).toEqual(roots);
    expect(state.ancientEvil.encounter.enemyStatus).toBe('DEAD');
    expect(state.ancientEvil.encounter.blocks.every(block => block.status === 'SPENT')).toBe(true);
  });
});
