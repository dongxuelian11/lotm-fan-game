/* @vitest-environment jsdom */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { ConcealmentServantPanel } from '../../src/renderer/ConcealmentServantPanel';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent } from '../../src/domain/slice/types';
import {
  ENTRY, PANEL, NEW_IDS, boundary, snapshot, naturalEntry, boundaryNames, capturedCommand, savedGame,
  mountGame, commandControl, actionButton, settled, view, confirmationName, confirmLabel,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './concealment-servant-ui-fixture';

describe('Concealment Servant source distinctions and exact saved acquisition', () => {
  it('preserves all 420 original public commands and opens the optional inferred S2 candidate from real S3', async () => {
    const old = readObjectEntry<SliceIntent[]>('tests/fixtures/fear-bishop-v01450/natural.json', 'commands');
    const commands = naturalEntry<SliceIntent[]>('commands');
    expect(old).toHaveLength(420); expect(naturalEntry<number>('prefixCount')).toBe(420);
    expect(commands.length).toBeGreaterThan(420); expect(commands.slice(0, 420)).toEqual(old);
    const departure = migrateSliceState(snapshot('departureStart'));
    expect(departure).toEqual(migrateSliceState(readObjectEntry('tests/fixtures/fear-bishop-v01450/natural.json', 'final')));
    expect(departure).toMatchObject({ health: 80, injuryRisk: 3, random: { seed: 'sleepless-natural-v020', cursor: 334 } });
    expect(departure.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toHaveLength(1);
    const game = savedGame(snapshot('guidanceStart')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(3); await mountGame(game, false);
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = screen.getByRole('region', { name: PANEL });
    for (const text of ['隐秘之仆的完整配方与晋升仪式仍未知', '材料、用量、调配顺序及仪式要求尚未掌握，仍须完成服药准备', '本阶段的隐秘与遮踪均有范围、时限和消耗']) expect(panel.textContent).toContain(text);
    expect(view(before).formulaKnown).toBe(false); expect(view(before).formula).toEqual([]);
    const clinicNotice = within(panel).getByText(view(before).risk);
    expect(clinicNotice.closest('details')).toBeNull(); expect(clinicNotice.textContent).toContain('旧伤护理须真实发现诊所、支付实际医疗费用并后续休养');
    await userEvent.click(screen.getByRole('button', { name: '关闭隐秘之仆页面' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced'] as const)('routes actual %s S2 growth to the new panel without duplicating bodies or mastery', async name => {
    const game = savedGame(snapshot(name)), before = structuredClone(game.state), old = migrateSliceState(snapshot('departureStart'));
    const value = view(before); expect(value.abilities.slice(-2).map(a => a.id)).toEqual([...NEW_IDS]);
    expect(Object.keys(before.progression.mastery).sort()).toEqual([...Object.keys(old.progression.mastery), ...NEW_IDS].sort());
    expect(Object.keys(before.progression.mastery)).toHaveLength(18);
    if (name === 'promoted') expect(value.abilities.slice(-2).map(a => a.mastery)).toEqual([0, 0]);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = screen.getByRole('region', { name: PANEL });
    await userEvent.click(screen.getByText('三案历史、掌握与原记录', { selector: 'summary' }));
    for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    await userEvent.click(screen.getByText('原身体与七阶历史', { selector: 'summary' }));
    expect(panel.textContent).toContain('不免费治疗或补灵'); expect(panel.textContent).toContain('不创建新身体');
    expect(value.currentGender).toBe(old.character.gender); assertLegacyPreserved(old, before);
    await userEvent.click(screen.getByRole('button', { name: '关闭隐秘之仆页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['inherited-full-s3-final', 'independent-guidance', 'buy-independent-bottle', 'current-week-paid-preparation', 'promotion'])('renders actual %s resources, source qualifications and clinic notice without mutation', renderBoundaryProjection);
  const failureKeys = boundaryNames(/^actual-potion-failure(?:-\d+)?$/);
  if (failureKeys.length) it.each(failureKeys)('renders the actual failed independent original %s without hiding its costs', renderBoundaryProjection);

  it.each(['independent-guidance', 'buy-independent-bottle', 'current-week-paid-preparation', 'promotion'])('reviews/cancels by pointer, Escape and dialog cancel, then commits %s exactly once', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command), reviewName = confirmationName(command);
    await userEvent.click(trigger); let review = screen.getByRole('dialog', { name: reviewName });
    const cancel = within(review).getByRole('button', { name: '取消，返回查看' });
    expect(document.activeElement).toBe(cancel); expect(game.submit).not.toHaveBeenCalled();
    if ('bottleId' in command) expect(review.textContent).toContain(command.bottleId);
    if (command.type === 'CONSUME') {
      expect(review.textContent).toContain(view(before).risk);
      for (const text of ['旧16掌握', '原人原物、伤势与风险保留', '不免费治疗或补灵', '完整配方尚未掌握，服用前仍须完成专业准备']) expect(review.textContent).toContain(text);
      for (const text of ['大成功', '成功', '失败', '灾难']) expect(review.textContent).toContain(text);
    }
    await userEvent.click(cancel); expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(game.state).toEqual(before);
    await userEvent.click(trigger); fireEvent.keyDown(screen.getByRole('dialog', { name: reviewName }), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); fireEvent(screen.getByRole('dialog', { name: reviewName }), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull();
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: reviewName });
    const confirm = within(review).getByRole('button', { name: confirmLabel(command) });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    if (command.type === 'LEARN_GUIDANCE') expect(game.state.cash).toBe(before.cash - 500);
    if (command.type === 'BUY_POTION') {
      expect(game.state.cash).toBe(before.cash - 800); expect(game.state.progression.sequence).toBe(3);
      expect(game.state.concealmentServant.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: 'PLAYER', consumedWeek: null });
    }
    if (command.type === 'PREPARE_PROMOTION') {
      expect(game.state.cash).toBe(before.cash - 120); expect(game.state.concealmentServant.preparedWeek).toBe(before.week);
    }
    if (command.type === 'CONSUME') {
      expect(game.state.concealmentServant.bottles.find(b => b.id === command.bottleId)?.status).toBe('CONSUMED');
      expect(game.state.concealmentServant.preparedWeek).toBeNull(); expect(game.state.spirituality).toBe(before.spirituality);
      expect(game.state.injuries).toEqual(before.injuries); expect(game.state.injuryRisk).toBe(before.injuryRisk);
      expect(game.state.spiritWarlock).toEqual(before.spiritWarlock); expect(game.state.town).toEqual(before.town);
      expect(game.state.concealmentServant.fearBishopActingAtPromotion).toBe(100);
    }
  }, 20_000);

  it.each(['buy-independent-bottle', 'current-week-paid-preparation', 'promotion'])('locks busy and failed %s and retries the same envelope without duplicate spending', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true });
    const before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert'); await settled();
    expect(game.state).toEqual(before); expect(actionButton(game.state, command).disabled).toBe(true);
    expect(screen.queryByRole('dialog', { name: confirmationName(command) })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('保存错误未解除原意图锁');
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('does not mistake error clearing after busy=false for a commit receipt', async () => {
    const captured = boundary('buy-independent-bottle'), before = migrateSliceState(captured.beforeLast), value = view(before), command = capturedCommand(captured);
    const onCommand = vi.fn(), onClose = vi.fn();
    const props = { value, busy: false, error: null, onCommand, onClose };
    const mounted = render(<ConcealmentServantPanel {...props}/>);
    await userEvent.click(await commandControl(before, command));
    fireEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    mounted.rerender(<ConcealmentServantPanel {...props} busy/>);
    mounted.rerender(<ConcealmentServantPanel {...props} error="本次原操作尚未保存"/>);
    expect(screen.queryByRole('dialog', { name: confirmationName(command) })).toBeNull();
    mounted.rerender(<ConcealmentServantPanel {...props}/>);
    expect(actionButton(before, command).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '关闭隐秘之仆页面' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(actionButton(before, command)); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
    // Only the new committed projection releases the retained intent lock.
    mounted.rerender(<ConcealmentServantPanel {...props} value={view(migrateSliceState(captured.final))}/>);
    expect(screen.queryByRole('dialog', { name: confirmationName(command) })).toBeNull();
    expect(screen.queryByText(/已提交同一次意图/)).toBeNull();
    expect((screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledOnce(); expect(before).toEqual(migrateSliceState(captured.beforeLast));
  });

  it('shows the supplied recovery notice while reopening the exact practiced save', async () => {
    // Bridge mock only: this test does not claim actual SQLite recovery execution.
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mountGame(game, true, '已从SQLite最近可恢复备份恢复；当前显示上次已保存记录。');
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});


describe('Concealment Servant accessible original Leaf agreement', () => {
  it('releases and asks the same original spirit again using real saved costs and permission', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mountGame(game);
    const area = within(screen.getByRole('region', { name: '同一个原卷叶的继承约定' }));
    await userEvent.click(area.getByRole('button', { name: '自愿释放同一个原卷叶回原老榆树' }));
    await settled();
    expect(game.state.spiritWarlock.companion).toMatchObject({ status: 'RELEASED', source: 'SW5-LEAF-1', acquiredWeek: before.spiritWarlock.companion.acquiredWeek, releases: before.spiritWarlock.companion.releases + 1 });
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.random).toEqual(before.random);
    await userEvent.click(screen.getByRole('button', { name: '邀请同一个原卷叶自愿在牙齿中休息' }));
    await settled();
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1); expect(game.state.spirituality).toBe(before.spirituality - 3);
    expect(game.state.spiritWarlock.companion.source).toBe('SW5-LEAF-1'); expect(game.state.spiritWarlock.companion.acquiredWeek).toBe(before.spiritWarlock.companion.acquiredWeek);
    expect(game.state.spiritWarlock.companion.invitedWeek).toBe(before.week); expect(['SEALED', 'RELEASED']).toContain(game.state.spiritWarlock.companion.status);
    expect(game.state.progression).toEqual(before.progression);
    expect(vi.mocked(game.submit).mock.calls.map(([e]) => e.payload)).toEqual([{ type: 'SPIRIT_WARLOCK', command: { type: 'RELEASE_SPIRIT' } }, { type: 'SPIRIT_WARLOCK', command: { type: 'INVITE_SPIRIT' } }]);
  }, 20_000);
  it('cannot release the inherited spirit from inside the unclosed new original room', async () => {
    const game = savedGame(boundary('blocked-door-concealment-outcome').final), before = structuredClone(game.state);
    await mountGame(game);
    const control = screen.getByRole('button', { name: '自愿释放同一个原卷叶回原老榆树' }) as HTMLButtonElement;
    expect(control.disabled).toBe(true); await userEvent.click(control);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
  }, 20_000);
});
