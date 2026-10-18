/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FateProphetPanel, type FateProphetPanelProps } from '../../src/renderer/FateProphetPanel.js';
import { projectFateProphet } from '../../src/domain/fate-prophet/index.js';
import { FATE_PROPHET_PREPARATION_IDS, type FateProphetProjection } from '../../src/domain/fate-prophet/types.js';
import { FATE_PROPHET_CASE_IDS, type FateProphetCaseId } from '../../src/domain/fate-prophet/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { fp, directedInitial3, dose, originalChaosWalker, prepared, promoted, step, taught } from '../domain/fate-prophet-directed-helper.js';

afterEach(cleanup);
// Actual source: the preserved living S3 ending of all 551 public commands.
// Interactive S2 states use only the explicitly declared pre-journal UNIT budgets
// in the shared helper. These renderer cases are not natural completion evidence.
beforeAll(() => { originalChaosWalker(); }, 60_000);
const source = () => projectFateProphet(directedInitial3());
function show(value: FateProphetProjection = source(), extra: Partial<FateProphetPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '先知目标' });
const resources = () => screen.getByRole('region', { name: '先知当前资源' });
const room = () => screen.getByRole('region', { name: '先知原场事务' });
const attempt = () => screen.getByRole('region', { name: '先知本次实际尝试' });
function openPrimary() {
  fireEvent.click(primary());
  return screen.getByRole('dialog', { name: '先知操作确认' });
}
function confirm(dialog = screen.getByRole('dialog')) {
  return within(dialog).getByRole('button', { name: '确认执行这一次操作' });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|CW3-MECHANICAL-WORKSHOP|\bSTART\b/;

describe('FateProphet panel: original source and independent potion choices', () => {
  it('shows the living original S3 resources, three independent bottles and the actual paid next step', () => {
    const state = originalChaosWalker(), value = projectFateProphet(state), view = show(value);
    expect(screen.getByRole('heading', { name: '先知·命运之轮序列2' })).toBeTruthy();
    expect(resources().textContent).toContain('健康60/100 · 精神100/100 · 灵性120/120');
    expect(resources().textContent).toContain('630便士 · 本周行动3');
    expect(resources().textContent).toContain('原伤继续生效');
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(disabled(primary())).toBe(false);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.container.textContent).toContain('可选择继续停留混乱行者');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state.injuries.some(injury => injury.severity === 'HEAVY')).toBe(true);
  });

  it('shows actual promotion costs, seventeen inherited and new skills with the original injury state', () => {
    const state = promoted(), value = projectFateProphet(state), view = show(value);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(state.mind).toBeLessThan(100);
    expect(value.abilities).toHaveLength(17);
    expect(value.abilities.slice(-2).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(resources().textContent).toContain('健康60/100');
    expect(resources().textContent).toContain('现有伤势3处 · 累计风险2');
    expect(resources().textContent?.match(/重伤 · 尚未处置/g)).toHaveLength(2);
    expect(resources().textContent).toContain('轻伤 · 尚未处置');
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('keeps the selected bottle after its actual labour receipt and never dispatches a goal choice', () => {
    const state = taught(), value = projectFateProphet(state), onCommand = vi.fn();
    const view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectFateProphet(fp(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<FateProphetPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('allows selecting either actually owned bottle after paid preparation and keeps the selected consume primary', () => {
    let state = taught();
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) state = fp(state, { type: 'PREPARE_TASK', taskId });
    state = fp(state, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' });
    state = fp(state, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-2' });
    state = fp(state, { type: 'PREPARE_PROMOTION' });
    const value = projectFateProphet(state), view = show(value), bottle = value.bottles[1]!;
    expect(value.insideCase).toBe(true);
    const goal = within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` });
    expect(disabled(goal)).toBe(false);
    fireEvent.click(goal);
    expect(primary().textContent).toContain('独立确认服用第2瓶');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state.fateProphet.bottles.slice(0, 2).map(entry => entry.status)).toEqual(['PLAYER', 'PLAYER']);
  });

  it('confirms the exact bottle, success rate and paid failure risk and submits only one read-only intent', () => {
    const state = prepared(), value = projectFateProphet(state), before = structuredClone(state), view = show(value);
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

/** Public commands only after the shared helper's explicitly declared UNIT budget.
 * These finite walks are test branches, not a natural continuation fixture. */
function closeCase(s: SliceState, caseId: FateProphetCaseId): SliceState {
  if (caseId === 'finite-disc') {
    s = fp(s, { type: 'WALK', caseId, to: 'B' });
    s = fp(s, { type: 'READ_RECORD', caseId });
    s = fp(s, { type: 'WALK', caseId, to: 'A' });
  } else {
    s = fp(s, { type: 'WALK', caseId, to: s.chaosWalker.life.cart.location });
    s = fp(s, { type: 'RETURN_CART', caseId });
  }
  s = fp(s, { type: 'RETURN_OBJECT', caseId });
  s = fp(s, { type: 'WALK', caseId, to: 'START' });
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) s = fp(s, { type, caseId });
  return s;
}
function ordinaryCase(s: SliceState, caseId: FateProphetCaseId): SliceState {
  s = fp(s, { type: 'OBSERVE', caseId });
  s = fp(s, { type: 'PREPARE', caseId, method: 'ORDINARY' });
  s = fp(s, { type: 'MANUAL_INSPECTION', caseId });
  s = fp(s, { type: caseId === 'finite-disc' ? 'SPIN_DISC' : 'RELEASE_CART', caseId });
  return closeCase(s, caseId);
}
const lifeSources = new Map<string, SliceState>();
/** Bounded, original-seed cursor selection occurs before the first new journal.
 * Potion, mechanical preparation, knowledge and actual event checks remain real
 * separate public-command resolutions. No post-journal state or result is edited. */
function lifePromotion(kind: 'foresight-failure' | 'adjustment-success' | 'adjustment-failure' = 'adjustment-success'): SliceState {
  if (!lifeSources.has(kind)) {
    let s = directedInitial3();
    const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
    const lifeChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
    const start = originalChaosWalker().random.cursor;
    let selected: number | null = null;
    for (let cursor = start; cursor < start + 512; cursor++) {
      const random = new DeterministicActionRandomStream(s.random.seed, cursor);
      const rolls = Array.from({ length: 8 }, () => random.nextInt(1, 100));
      if (!(rolls[0]! > 5 && rolls[0]! <= potionChance)) continue;
      const matches = kind === 'foresight-failure' ? rolls[2]! > lifeChance && rolls[2]! < 96
        : rolls[6]! <= lifeChance && (kind === 'adjustment-success' ? rolls[7]! <= lifeChance : rolls[7]! > lifeChance && rolls[7]! < 96);
      if (matches) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded original-seed renderer UNIT source satisfies the requested checks.');
    s.random.cursor = selected;
    s = fp(s, { type: 'LEARN_GUIDANCE' });
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    s = fp(s, { type: 'PREPARE_PROMOTION' });
    s = fp(s, dose);
    lifeSources.set(kind, s);
  }
  return structuredClone(lifeSources.get(kind)!);
}
function lifeReady(caseId: FateProphetCaseId, initial = promoted(), method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  let s = initial;
  for (const previous of FATE_PROPHET_CASE_IDS) { if (previous === caseId) break; s = ordinaryCase(s, previous); }
  if (caseId === 'finite-disc' && s.winner.luck.stored === 0) s = fp(s, { type: 'ACCUMULATE' });
  s = fp(s, { type: 'OBSERVE', caseId });
  return fp(s, { type: 'PREPARE', caseId, method });
}
function foresightReady(caseId: FateProphetCaseId, initial = promoted()): SliceState {
  let s = lifeReady(caseId, initial);
  s = fp(s, { type: 'CONSENT_VERA', caseId });
  return fp(s, { type: 'EVENT_FORESIGHT', caseId });
}

describe('FateProphet panel: original physical event, consent and finite effects', () => {
  it('shows one concrete primary goal and a separately confirmed ordinary alternative', () => {
    const value = projectFateProphet(fp(promoted(), { type: 'OBSERVE', caseId: 'cart-omen' })), view = show(value);
    expect(within(screen.getByRole('region', { name: '当前主要操作' })).getAllByRole('button')).toHaveLength(1);
    expect(primary().textContent).toContain('能力方法');
    const future = within(targets()).getByRole('button', { name: /条件改变，旧预感作废/ });
    expect(disabled(future)).toBe(true);
    fireEvent.click(future);
    expect(primary().textContent).toContain('能力方法');
    fireEvent.click(screen.getByRole('button', { name: /普通方法/ }));
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PREPARE', caseId: 'cart-omen', method: 'ORDINARY' });
  });

  it('displays the real prepared site and original objects without revealing its hidden mechanical condition', () => {
    const state = lifeReady('cart-omen'), value = projectFateProphet(state), before = structuredClone(state), view = show(value, { onClose: vi.fn() });
    expect(room().textContent).toContain('本人实际在操作处');
    expect(room().textContent).toContain('唯一四百克密封包始终在原车上');
    expect(room().textContent).toContain('同一不透明袋与两枚原签');
    expect(attempt().textContent).toContain('当前记录许可：尚未询问');
    expect(attempt().textContent).toContain('尚无亲自取得的机械条件线索');
    expect(attempt().textContent).toContain('尚无已经亲见的本次事件结果');
    expect(primary().textContent).toContain('询问薇拉');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(JSON.stringify(value.life)).not.toMatch(/preparationRoll|originalBias|eventRoll|physicalRoll|mechanicalState|randomCursor|snapshot/);
    expect(view.container.textContent).not.toMatch(editorial);
    expect(state).toEqual(before);
  });

  it('respects an actual refusal while keeping ordinary inspection available', () => {
    const state = fp(lifeReady('cart-omen'), { type: 'DECLINE_PERMISSION', caseId: 'cart-omen' }), view = show(projectFateProphet(state));
    expect(attempt().textContent).toContain('当前记录许可：已拒绝本次练习');
    expect(primary().textContent).toContain('普通拆看');
    expect(screen.queryByRole('button', { name: /询问薇拉/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /尝试预感/ })).toBeNull();
    fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MANUAL_INSPECTION', caseId: 'cart-omen' });
  });

  it('renders a paid failed foresight without a clue, future result or refund', () => {
    const state = foresightReady('cart-omen', lifePromotion('foresight-failure')), view = show(projectFateProphet(state));
    expect(attempt().textContent).toContain('单次事件预感：失败');
    expect(attempt().textContent).toContain('本次实际消耗5灵性、1精神、0份原幸运');
    expect(attempt().textContent).toContain('尚无亲自取得的机械条件线索');
    expect(attempt().textContent).not.toMatch(/当时机械偏向/);
    expect(state.fateProphet.life.cases['cart-omen'].attempts[0]!.eventDraws).toBe(0);
    expect(resources().textContent).toContain('健康60/100');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows an actual withdrawal and changed conditions without reviving the old permission or forecast', () => {
    const state = fp(foresightReady('changed-condition'), { type: 'WITHDRAW_PERMISSION', caseId: 'changed-condition' });
    const view = show(projectFateProphet(state));
    expect(attempt().textContent).toContain('已撤回同意');
    expect(attempt().textContent).toContain('原机械条件已实际改变，旧预感作废');
    expect(attempt().textContent).toContain('本次实际消耗5灵性、1精神、0份原幸运');
    expect(attempt().textContent).toContain('当前没有可用的本次预感');
    expect(screen.queryByRole('button', { name: /尝试预感/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /尝试有限修正/ })).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('keeps the independent actual cart event unread until the player walks to its result, then requires the original return', () => {
    let state = lifeReady('cart-omen', promoted(), 'ORDINARY');
    state = fp(state, { type: 'MANUAL_INSPECTION', caseId: 'cart-omen' });
    state = fp(state, { type: 'RELEASE_CART', caseId: 'cart-omen' });
    const value = projectFateProphet(state), view = show(value);
    expect(attempt().textContent).toContain('尚无已经亲见的本次事件结果');
    expect(value.life.currentAttempt!.eventResult).toBeNull();
    expect(screen.queryByRole('button', { name: /实际放开原车一次/ })).toBeNull();
    const to = state.chaosWalker.life.cart.location;
    state = fp(state, { type: 'WALK', caseId: 'cart-omen', to });
    view.rerender(<FateProphetPanel value={projectFateProphet(state)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain(`原车停在${to === 'B' ? '左侧' : '右侧'}软挡`);
    expect(primary().textContent).toContain('手推同一原车与密封包返回');
    expect(attempt().textContent).toContain('不能重置、重抽或事后改写');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows paid finite disc correction and sends a zero-action expiry wait without locally advancing time', () => {
    const before = foresightReady('finite-disc', lifePromotion()), state = fp(before, { type: 'HAZARD_ADJUSTMENT', caseId: 'finite-disc' });
    const value = projectFateProphet(state), view = show(value);
    expect(attempt().textContent).toContain('本次实际消耗10灵性、2精神、1份原幸运');
    expect(attempt().textContent).toContain('待用修正还剩30秒');
    expect(attempt().textContent).toContain('不能保证后来结果');
    const wait = value.actions.find(action => action.command.type === 'WAIT_EFFECT')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(wait.label) }));
    expect(screen.getByRole('dialog').textContent).toContain('0行动');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WAIT_EFFECT', caseId: 'finite-disc' });
    expect(state.chaosWalker.life.clockSeconds).toBe(before.chaosWalker.life.clockSeconds + 2);
    const after = fp(state, { type: 'WAIT_EFFECT', caseId: 'finite-disc' });
    view.rerender(<FateProphetPanel value={projectFateProphet(after)} busy={false} onCommand={view.onCommand} />);
    expect(attempt().textContent).toContain('待用修正还剩0秒');
    expect(after.spirituality).toBe(state.spirituality);
    expect(after.winner.luck).toEqual(state.winner.luck);
  });

  it('keeps failed adjustment costs and permits the one actual disc event without a success timer', () => {
    const state = fp(foresightReady('finite-disc', lifePromotion('adjustment-failure')), { type: 'HAZARD_ADJUSTMENT', caseId: 'finite-disc' });
    const view = show(projectFateProphet(state));
    expect(attempt().textContent).toContain('有限风险调整：失败');
    expect(attempt().textContent).toContain('本次实际消耗10灵性、2精神、1份原幸运');
    expect(attempt().textContent).toContain('待用修正还剩0秒');
    expect(primary().textContent).toContain('实际转动原盘一次');
    expect(screen.queryByRole('button', { name: /实际等候尚未使用的修正到期/ })).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows the real one-time disc result and still requires reading and returning the original records', () => {
    let state = fp(foresightReady('finite-disc', lifePromotion()), { type: 'HAZARD_ADJUSTMENT', caseId: 'finite-disc' });
    state = fp(state, { type: 'SPIN_DISC', caseId: 'finite-disc' });
    const value = projectFateProphet(state), view = show(value);
    expect(attempt().textContent).toContain(value.life.currentAttempt!.eventResult!);
    expect(attempt().textContent).toContain('待用修正还剩0秒');
    expect(primary().textContent).toContain('沿原路步行并查看');
    expect(screen.queryByRole('button', { name: /实际转动原盘一次/ })).toBeNull();
    const completed = closeCase(state, 'finite-disc');
    view.rerender(<FateProphetPanel value={projectFateProphet(completed)} busy={false} onCommand={view.onCommand} />);
    expect(room().textContent).toContain('本次现场已实际收束');
    expect(completed.chaosWalker.life.disc.pointer).toBe(state.chaosWalker.life.disc.pointer);
    expect(completed.chaosWalker.life.disc.control).toBe('GUIDE');
  });

  it('stops an unused correction without refund, then requires real returns before allowing the page to close', () => {
    const state = fp(foresightReady('finite-disc', lifePromotion()), { type: 'HAZARD_ADJUSTMENT', caseId: 'finite-disc' });
    const onClose = vi.fn(), view = show(projectFateProphet(state), { onClose });
    const stopped = fp(state, { type: 'STOP', caseId: 'finite-disc' });
    view.rerender(<FateProphetPanel value={projectFateProphet(stopped)} busy={false} onCommand={view.onCommand} onClose={onClose} />);
    expect(attempt().textContent).toContain('本次输入已实际停止');
    expect(attempt().textContent).toContain('待用修正还剩0秒');
    expect(stopped.spirituality).toBe(state.spirituality);
    expect(stopped.winner.luck).toEqual(state.winner.luck);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    let returned = fp(stopped, { type: 'RETURN_OBJECT', caseId: 'finite-disc' });
    returned = fp(returned, { type: 'WALK', caseId: 'finite-disc', to: 'START' });
    returned = fp(returned, { type: 'INSPECT', caseId: 'finite-disc' });
    returned = fp(returned, { type: 'LEAVE', caseId: 'finite-disc' });
    view.rerender(<FateProphetPanel value={projectFateProphet(returned)} busy={false} onCommand={view.onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

let ordinaryPracticeCache: SliceState | undefined;
function ordinaryPractice(): SliceState {
  if (!ordinaryPracticeCache) {
    let s = promoted();
    for (const caseId of FATE_PROPHET_CASE_IDS) s = ordinaryCase(s, caseId);
    ordinaryPracticeCache = fp(s, { type: 'REFLECT' });
  }
  return structuredClone(ordinaryPracticeCache);
}
describe('FateProphet panel: independent caster and ordinary exit', () => {
  it('keeps optional combat separate and shows the actual paid preparation and consenting original people walking out', () => {
    const state = ordinaryPractice(), value = projectFateProphet(state), view = show(value, { onClose: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: '可选原工坊交战' }));
    const region = () => screen.getByRole('region', { name: '先知原工坊冲突' });
    expect(region().textContent).toContain('洛温·米勒 · 42岁 · 序列3施术者');
    expect(region().textContent).toContain('健康100 · 精神100 · 灵性120');
    expect(region().textContent).toContain('本人在原门口，薇拉在操作处，艾妲在原门口');
    expect(primary().textContent).toContain('2精神；0行动');
    expect(state.progression.mastery['wheel.s2.event-foresight']).toBe(0);
    expect(state.progression.mastery['wheel.s2.hazard-adjustment']).toBe(0);
    const prepared = fp(state, { type: 'PREPARE_ENCOUNTER' });
    const approached = fp(prepared, { type: 'ENCOUNTER_TALK' });
    view.rerender(<FateProphetPanel value={projectFateProphet(approached)} busy={false} onCommand={view.onCommand} />);
    expect(region().textContent).toContain('本人在操作处，薇拉在室外，艾妲在室外');
    expect(region().textContent).toContain(`原工坊时钟${state.chaosWalker.life.clockSeconds + 16}秒`);
    expect(region().textContent).toContain('唯一原杖仍由本人持有');
    expect(region().textContent).toContain('生活中的机械试验不代替交战结果');
    expect(resources().textContent).toContain(`精神${state.mind - 2}/100`);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms a real peaceful exit without refunding preparation or reopening old death and surrender records', () => {
    const state = fp(fp(ordinaryPractice(), { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' });
    const onClose = vi.fn(), value = projectFateProphet(state), view = show(value, { onClose });
    const action = value.actions.find(entry => entry.command.type === 'LEAVE_ENCOUNTER')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    expect(screen.getByRole('dialog').textContent).toContain('到场后4米4秒');
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    const after = fp(state, { type: 'LEAVE_ENCOUNTER' });
    view.rerender(<FateProphetPanel value={projectFateProphet(after)} busy={false} onCommand={view.onCommand} onClose={onClose} />);
    expect(after.mind).toBe(state.mind);
    expect(after.health).toBe(state.health);
    expect(after.chaosWalker.life.clockSeconds).toBe(state.chaosWalker.life.clockSeconds + 4);
    expect(after.chaosWalker.life.playerLocation).toBe('START');
    expect(after.chaosWalker.encounter).toEqual(state.chaosWalker.encounter);
    expect(after.misfortuneMage.encounter).toEqual(state.misfortuneMage.encounter);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommand).toHaveBeenCalledTimes(1);
  });

  it('shows actual first-round body, mind, spirit, injuries and original rod state without inventing a favorable outcome', () => {
    const state = fp(fp(fp(ordinaryPractice(), { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' }), { type: 'ENCOUNTER_FIGHT' });
    const after = step(state, { type: 'COMBAT_ROUND', stance: 'DEFEND', winnerPolicy: 'HOLD' });
    const value = projectFateProphet(after), view = show(value);
    if (!value.encounter.inside) fireEvent.click(screen.getByRole('button', { name: '可选原工坊交战' }));
    const enemy = value.encounter.enemy!;
    expect(screen.getByRole('region', { name: '洛温独立身体与心智' }).textContent).toContain(`健康${enemy.health} · 精神${enemy.mind} · 灵性${enemy.spirituality}`);
    expect(resources().textContent).toContain(`健康${after.health}/100 · 精神${after.mind}/100 · 灵性${after.spirituality}/120`);
    expect(resources().textContent).toContain(`现有伤势${after.injuries.length}处 · 累计风险${after.injuryRisk}`);
    expect(view.container.textContent).not.toContain(after.random.seed);
    expect(after.chaosWalker.encounter).toEqual(state.chaosWalker.encounter);
    expect(after.misfortuneMage.encounter).toEqual(state.misfortuneMage.encounter);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('FateProphet panel: confirmation, focus and saved-state safety', () => {
  it('focuses and traps confirmation, blocks background controls and restores focus on cancel or Escape', () => {
    const onClose = vi.fn(), view = show(source(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取先知成品与专业准备指导' }));
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
    const value = source(), onCommand = vi.fn(), view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes unsubmitted confirmation on save failure and delegates retry to the existing save operation', () => {
    const value = source(), onCommand = vi.fn(), view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<FateProphetPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(disabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked through error clearing until changed saved facts arrive and then focuses the new phase', () => {
    const state = directedInitial3(), value = projectFateProphet(state), onCommand = vi.fn();
    const view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<FateProphetPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    const after = projectFateProphet(fp(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<FateProphetPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(resources().textContent).toContain(`${state.cash - 500}便士`);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('keeps the exact paid bottle intent locked across a save error until its actual failed receipt arrives', () => {
    const state = prepared('FAILURE'), value = projectFateProphet(state), onCommand = vi.fn();
    const view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    view.rerender(<FateProphetPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    fireEvent.click(primary());
    expect(onCommand).toHaveBeenCalledTimes(1);
    const after = fp(state, dose);
    view.rerender(<FateProphetPanel value={projectFateProphet(after)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(resources().textContent).toContain('健康45/100 · 精神75/100');
    expect(after.fateProphet.bottles[0]!.status).toBe('CONSUMED');
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale unsubmitted confirmation when newer actual facts arrive', () => {
    const state = directedInitial3(), value = projectFateProphet(state), onCommand = vi.fn();
    const view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<FateProphetPanel value={projectFateProphet(fp(state, { type: 'LEARN_GUIDANCE' }))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('disables all public buttons when busy, externally blocked or dead', () => {
    for (const mode of ['busy', 'blocked', 'dead'] as const) {
      // Explicit UNIT-only pre-journal terminal display fixture, not a natural death.
      const state = directedInitial3();
      if (mode === 'dead') { state.status = 'DEAD'; state.health = 0; }
      const view = show(projectFateProphet(state), { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
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

describe('FateProphet panel: actual paid results and retained resources', () => {
  it.each([
    ['GREAT_SUCCESS', 60, 92, true],
    ['SUCCESS', 60, 85, true],
    ['FAILURE', 45, 75, false],
    ['GREAT_FAILURE', 35, 55, false],
  ] as const)('shows the saved %s bottle outcome without healing or spending a second bottle', (kind, health, mind, succeeded) => {
    const before = prepared(kind), state = fp(before, dose), value = projectFateProphet(state), view = show(value);
    expect(resources().textContent).toContain(`健康${health}/100 · 精神${mind}/100 · 灵性120/120`);
    expect(value.promoted).toBe(succeeded);
    expect(state.fateProphet.bottles.map(bottle => bottle.status)).toEqual(['CONSUMED', 'SUPPLIER', 'SUPPLIER']);
    expect(state.injuries).toEqual(before.injuries);
    expect(resources().textContent).toContain('累计风险2');
    expect(resources().textContent).toContain(`${state.cash}便士`);
    expect(state.fateProphet.preparedWeek).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows a paid failed bottle as exhausted when selected and preserves all three completed preparations', () => {
    const state = fp(prepared('FAILURE'), dose), value = projectFateProphet(state), view = show(value), bottle = value.bottles[0]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异，仍为混乱行者');
    expect(value.preparations.every(entry => entry.completedWeek !== null)).toBe(true);
    expect(value.actions.some(action => action.command.type === 'CONSUME' && action.command.bottleId === bottle.id)).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms ending paid preparation separately and keeps its original unpaid-for-again bottle', () => {
    const state = prepared(), value = projectFateProphet(state), onCommand = vi.fn(), onClose = vi.fn();
    const view = render(<FateProphetPanel value={value} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const action = value.actions.find(entry => entry.command.type === 'LEAVE_PREPARATION')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('不退成本');
    fireEvent.click(confirm(dialog));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_PREPARATION' });
    const after = fp(state, { type: 'LEAVE_PREPARATION' });
    view.rerender(<FateProphetPanel value={projectFateProphet(after)} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(after.cash).toBe(state.cash);
    expect(after.actionsRemaining).toBe(state.actionsRemaining);
    expect(after.fateProphet.bottles[0]!.status).toBe('PLAYER');
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays exact bottle purchase and per-bottle labour costs before dispatching', () => {
    const state = taught(), value = projectFateProphet(state), view = show(value);
    const action = value.actions.find(entry => entry.command.type === 'BUY_POTION' && entry.command.bottleId === dose.bottleId)!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action.label) }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('6400便士');
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(state.fateProphet.bottles[0]!.status).toBe('SUPPLIER');
  });

  it('shows the original single luck account and all inherited outcomes without displaying hidden random state', () => {
    const state = promoted(), value = projectFateProphet(state), view = show(value);
    expect(resources().textContent).toContain(`唯一幸运储备${state.winner.luck.stored}/3`);
    expect(resources().textContent).toContain(`累计积累${state.winner.luck.accumulated}份 · 实际消耗${state.winner.luck.spent}份`);
    expect(view.container.textContent).toContain('原费里斯');
    expect(view.container.textContent).toContain('原加雷斯');
    expect(view.container.textContent).not.toContain(state.random.seed);
    expect(view.container.textContent).not.toMatch(/randomBefore|randomAfter|branchRoll|snapshot|journal|sourceId/);
    expect(state.winner.luck).toEqual(originalChaosWalker().winner.luck);
  });

  it('updates actual injury treatment only after ordinary discovery, rest and the paid care receipt', () => {
    let state = promoted();
    if (!state.careKnown) state = step(state, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    state = step(state, { type: 'ACTION', action: 'REST' });
    expect(state.activeEvent?.id).toBe('LIFE-CARE-01');
    const before = state, view = show(projectFateProphet(before));
    expect(resources().textContent?.match(/重伤 · 尚未处置/g)).toHaveLength(2);
    state = step(state, { type: 'EVENT_CHOICE', eventInstanceId: state.activeEvent!.instanceId, choiceId: 'PAY' });
    view.rerender(<FateProphetPanel value={projectFateProphet(state)} busy={false} onCommand={view.onCommand} />);
    expect(resources().textContent?.match(/重伤 · 已实际处置，仍须休养/g)).toHaveLength(2);
    expect(state.health).toBe(before.health);
    expect(state.cash).toBe(before.cash - 60);
    expect(resources().textContent).toContain(`累计风险${before.injuryRisk}`);
    expect(view.onCommand).not.toHaveBeenCalled();
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
