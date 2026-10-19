/* @vitest-environment jsdom */
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent } from '../../src/domain/slice/types';
import {
  ENTRY, PANEL, NEW_IDS, boundary, naturalEntry, boundaryNames, capturedCommand, savedGame,
  mountGame, commandControl, actionButton, clickCommand, settled, view,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './knowledge-mentor-ui-fixture';

// Static authoring only. The lead must run this file independently under 512 MiB.
// Evidence is the actual 691-command branch, including the unchanged 564-command prefix.
describe('Knowledge Mentor candidate G navigation and exact saved purchase intent', () => {
  it('retains the complete living S3 run, opens optional candidate G guidance, and returns to the correct S3 title', async () => {
    expect(naturalEntry<number>('prefixCount')).toBe(564);
    expect(naturalEntry<SliceIntent[]>('commands')).toHaveLength(691);
    const old = readObjectEntry<SliceIntent[]>('tests/fixtures/arcane-scholar-v01430/natural.json', 'commands');
    expect(naturalEntry<SliceIntent[]>('commands').slice(0, 564)).toEqual(old);
    expect(migrateSliceState(naturalEntry('departureStart'))).toEqual(migrateSliceState(readObjectEntry('tests/fixtures/arcane-scholar-v01430/natural.json', 'final')));
    const game = savedGame(naturalEntry('guidanceStart')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(3);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const goal = screen.getByRole('region', { name: '知识导师当前目标' });
    expect(goal.textContent).toContain('奥秘学者3 → 知识导师2');
    expect(within(goal).getByText('本阶段开放有限工序。').closest('details')).toBeNull();
    expect(goal.textContent).toContain('晋升须取得独立成品并完成专业准备；工序的持续时间、成本与奖励见下方。');
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain("知识导师为通识者序列2。当前渠道只提供成品魔药，不提供完整配方；服用前须完成专业准备。本阶段使用明确专业支持、独立序列2原瓶与实际准备，不重复炼金术士抽取原园生命的旧仪式。");
    expect(view(game.state).formulaKnown).toBe(false); expect(view(game.state).formula).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: '关闭知识导师页面' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: '奥秘学者' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced', 'final'])('opens actual %s S2 growth with 17 preserved and two new ability IDs, without refilling', async name => {
    const game = savedGame(naturalEntry(name)), before = structuredClone(game.state), value = view(before);
    expect(value.abilities).toHaveLength(19);
    expect(value.abilities.slice(-2).map(a => a.id)).toEqual([...NEW_IDS]);
    expect(Object.keys(before.progression.mastery)).toHaveLength(19);
    if (name === 'promoted') expect(value.abilities.slice(-2).map(a => a.mastery)).toEqual([0, 0]);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '奥秘学者' })).toBeNull();
    const details = screen.getByText('三项实践、实际尝试与掌握', { selector: 'summary' });
    await userEvent.click(details);
    for (const a of value.abilities) expect(details.closest('details')!.textContent).toContain(`${a.label} · 掌握${a.mastery}`);
    await userEvent.click(screen.getByRole('button', { name: '关闭知识导师页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(boundaryNames(/^(inherited-full-s3-final|clinic-discovery|original-light-wounds-actual-rest|guidance|preparation-|buy-independent-|paid-current-week-|promotion)/))('renders committed %s without mutating historical resources', renderBoundaryProjection);

  it.each(['guidance', 'preparation-plan_withdrawal'])('submits the actual %s public command once', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['buy-independent-five-work-bottle', 'paid-current-week-preparation', 'promotion'])('reviews, cancels, escapes and double-click confirms the actual %s once', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command);
    const reviewName = command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次实际消耗与风险';
    await userEvent.click(trigger); let review = screen.getByRole('dialog', { name: reviewName });
    const cancel = within(review).getByRole('button', { name: '取消，返回查看' });
    expect(document.activeElement).toBe(cancel); expect(game.submit).not.toHaveBeenCalled();
    if ('bottleId' in command) expect(review.textContent).toContain(command.bottleId);
    if (command.type === 'CONSUME') {
      expect(review.textContent).toContain(view(before).risk);
      expect(review.textContent).toContain('当前灵性不补满、原物不充能不修复');
      expect(review.textContent).toContain("成功或失败都会耗尽这一原瓶与当次准备；当前灵性不补满、原物不充能不修复，旧伤、旧园与旧人结局保留。尚未掌握完整配方，服用前须完成专业准备。");
      expect(review.textContent).not.toContain('身份映射'); expect(review.textContent).not.toContain('原著');
    }
    await userEvent.click(cancel); expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(game.state).toEqual(before);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: reviewName });
    fireEvent.keyDown(review, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); fireEvent(screen.getByRole('dialog', { name: reviewName }), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(game.state).toEqual(before);
    await userEvent.click(trigger);
    const confirm = within(screen.getByRole('dialog', { name: reviewName })).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    if (command.type === 'CONSUME') {
      expect(game.state.knowledgeMentor.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
      expect(game.state.knowledgeMentor.preparedWeek).toBeNull();
      expect(game.state.spirituality).toBe(before.spirituality);
      expect(game.state.alchemist.life.creations).toEqual(before.alchemist.life.creations);
      for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(game.state.progression.mastery[id]).toBe(mastery);
    }
  }, 20_000);

  it.each(['buy-independent-five-work-bottle', 'paid-current-week-preparation', 'promotion'])('locks pending/failed %s and retries the identical retained intent envelope', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true });
    const before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    await userEvent.click(screen.getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作' }));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '选择知识导师原瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(actionButton(game.state, command).disabled).toBe(true);
    // A native top-layer modal must close on failure, or the parent's retry is inert.
    expect(screen.queryByRole('dialog', { name: /^(独立确认服用这一原瓶|确认本次实际消耗与风险)$/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('displays a desktop SQLite recovery notice supplied by bootstrap and reopens the exact saved state', async () => {
    // This is only a renderer bridge mock, not evidence of real SQLite recovery.
    const game = savedGame(naturalEntry('final')), before = structuredClone(game.state);
    await mountGame(game, true, '已从SQLite最近可恢复备份恢复；当前显示上次已保存记录。');
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    expect(game.state.knowledgeMentor.encounter.enemyStatus).toBe('DEAD');
    expect(game.state.alchemist.encounter.enemy?.status).toBe('DEAD');
    expect(game.state.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED');
  }, 20_000);
});
