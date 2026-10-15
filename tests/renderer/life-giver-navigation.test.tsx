/* @vitest-environment jsdom */
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent } from '../../src/domain/slice/types';
import {
  ENTRY, PANEL, NEW_IDS, boundary, naturalEntry, boundaryNames, capturedCommand, savedGame,
  mountGame, commandControl, actionButton, settled, view,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './life-giver-ui-fixture';

// Static candidate: execute independently under 512 MiB. No outcome is manufactured.
describe('Life Giver known name, unknown canon and exact saved acquisition', () => {
  it('keeps all 444 original S3 commands and opens optional S2 guidance without replacing S3 growth', async () => {
    const old = readObjectEntry<SliceIntent[]>('tests/fixtures/summoning-master-v01440/natural.json', 'commands');
    expect(naturalEntry<SliceIntent[]>('commands')).toHaveLength(572);
    expect(naturalEntry<number>('prefixCount')).toBe(444); expect(old).toHaveLength(444);
    expect(naturalEntry<SliceIntent[]>('commands').slice(0, 444)).toEqual(old);
    expect(migrateSliceState(naturalEntry('departureStart'))).toEqual(migrateSliceState(readObjectEntry('tests/fixtures/summoning-master-v01440/natural.json', 'final')));
    const game = savedGame(naturalEntry('guidanceStart')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(3);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const goal = screen.getByRole('region', { name: '创生者当前目标' });
    expect(goal.textContent).toContain('召唤大师3 → 创生者2');
    expect(goal.textContent).toContain('创生者为序列2，下一阶为美神序列1');
    expect(goal.textContent).toContain('当前渠道只提供独立成品魔药，不提供完整配方；服用前须完成专业准备');
    expect(goal.textContent).toContain('本阶能力与限制以当前说明为准，不改变性别');
    for (const marker of ['名称已核实', '原著仪式', '原创G']) expect(goal.textContent).not.toContain(marker);
    expect(view(before).formulaKnown).toBe(false); expect(view(before).formula).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: '关闭创生者页面' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: '召唤大师' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced', 'final'])('opens the actual %s S2 growth and preserves original mastery and gender', async name => {
    const game = savedGame(naturalEntry(name)), before = structuredClone(game.state), value = view(before);
    const old = migrateSliceState(naturalEntry('departureStart'));
    expect(value.abilities.slice(-2).map(a => a.id)).toEqual([...NEW_IDS]);
    expect(Object.keys(before.progression.mastery).sort()).toEqual([...Object.keys(old.progression.mastery), ...NEW_IDS].sort());
    if (name === 'promoted') expect(value.abilities.slice(-2).map(a => a.mastery)).toEqual([0, 0]);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '召唤大师' })).toBeNull();
    const details = screen.getByText('三项实践、实际成功与掌握', { selector: 'summary' });
    await userEvent.click(details);
    for (const a of value.abilities) expect(details.closest('details')!.textContent).toContain(`${a.label} · 掌握${a.mastery}`);
    await userEvent.click(screen.getByText('原身体、七阶掌握与旧人原物', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('创生者2不改变性别');
    expect(value.currentGender).toBe(old.character.gender);
    await userEvent.click(screen.getByRole('button', { name: '关闭创生者页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(boundaryNames(/^(inherited-full-s3-final|guidance$|buy-independent-five-work-bottle$|paid-current-week-preparation$|promotion$|consume-failure$)/))('renders committed %s without changing original resources', renderBoundaryProjection);

  it.each(['guidance', 'buy-independent-five-work-bottle', 'paid-current-week-preparation', 'promotion'])('separately reviews/cancels and double-click confirms actual %s once', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command);
    const reviewName = command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次实际消耗与风险';
    await userEvent.click(trigger); let review = screen.getByRole('dialog', { name: reviewName });
    const cancel = within(review).getByRole('button', { name: '取消，返回查看' });
    expect(document.activeElement).toBe(cancel); expect(game.submit).not.toHaveBeenCalled();
    if ('bottleId' in command) expect(review.textContent).toContain(command.bottleId);
    if (command.type === 'CONSUME') {
      expect(review.textContent).toContain(view(before).risk);
      expect(review.textContent).toContain('不补灵、不治疗、不变性、不产生新生命');
      expect(review.textContent).toContain("成功或失败都会耗尽这一原瓶与当次准备。旧消化、掌握、伤势、风险及原人原物保留；不补灵、不治疗、不变性、不产生新生命。当前渠道不提供完整配方，服用前须完成专业准备。");
      expect(review.textContent).not.toContain('原著仪式');
    }
    await userEvent.click(cancel); expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull();
    expect(document.activeElement).toBe(trigger); expect(game.state).toEqual(before);
    await userEvent.click(trigger); fireEvent.keyDown(screen.getByRole('dialog', { name: reviewName }), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); fireEvent(screen.getByRole('dialog', { name: reviewName }), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull();
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: reviewName });
    const confirm = within(review).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    if (command.type === 'LEARN_GUIDANCE') expect(game.state.cash).toBe(before.cash - 500);
    if (command.type === 'BUY_POTION') {
      expect(game.state.cash).toBe(before.cash - 800);
      expect(game.state.lifeGiver.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: 'PLAYER', consumedWeek: null });
      expect(game.state.progression.sequence).toBe(3);
    }
    if (command.type === 'PREPARE_PROMOTION') {
      expect(game.state.cash).toBe(before.cash - 120); expect(game.state.lifeGiver.preparedWeek).toBe(before.week);
      expect(game.state.progression.sequence).toBe(3);
    }
    if (command.type === 'CONSUME') {
      expect(game.state.lifeGiver.bottles.find(b => b.id === command.bottleId)?.status).toBe('CONSUMED');
      expect(game.state.lifeGiver.preparedWeek).toBeNull(); expect(game.state.cash).toBe(before.cash);
      expect(game.state.spirituality).toBe(before.spirituality);
      expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
      expect(game.state.injuries).toEqual(before.injuries); expect(game.state.injuryRisk).toBe(before.injuryRisk);
      for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(game.state.progression.mastery[id]).toBe(mastery);
    }
  }, 20_000);

  it.each(['buy-independent-five-work-bottle', 'paid-current-week-preparation', 'promotion'])('locks pending/failed %s and retries the identical retained intent', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true });
    const before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    await userEvent.click(screen.getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作' }));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '选择创生者原瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(actionButton(game.state, command).disabled).toBe(true);
    expect(screen.queryByRole('dialog', { name: /^(独立确认服用这一原瓶|确认本次实际消耗与风险)$/ })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('当前仍显示上次已保存记录');
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('shows supplied SQLite recovery notice while reopening the exact saved practiced state', async () => {
    // Renderer bridge mock only; this does not claim real SQLite recovery.
    const game = savedGame(naturalEntry('practiced')), before = structuredClone(game.state);
    await mountGame(game, true, '已从SQLite最近可恢复备份恢复；当前显示上次已保存记录。');
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
