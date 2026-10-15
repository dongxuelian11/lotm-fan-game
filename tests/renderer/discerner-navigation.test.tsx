/* @vitest-environment jsdom */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent } from '../../src/domain/slice/types';
import {
  NAVIGATION_BOUNDARIES, boundary, capturedCommand, savedGame, mountGame, actionButton,
  commandControl, settled, assertLegacyPreserved, assertSavedEnvelope, naturalEntry, renderBoundaryProjection,
} from './discerner-ui-fixture';

// Actual 580-command branch: original living prefix 441; first bottle failed,
// second succeeded at W117. This does not reopen the separate 443-command death.
describe('Discerner navigation and independent potion confirmation', () => {
  it('opens optional S2 guidance from the preserved living S3 run, then returns to current S3 growth without a command', async () => {
    expect(naturalEntry<number>('prefixCount')).toBe(441);
    const oldCommands = readObjectEntry<SliceIntent[]>('tests/fixtures/dream-weaver-v01420/peaceful-exit.json', 'commands');
    expect(oldCommands).toHaveLength(441);
    expect(naturalEntry<SliceIntent[]>('commands').slice(0, 441)).toEqual(oldCommands);
    expect(migrateSliceState(naturalEntry('departureStart'))).toEqual(migrateSliceState(readObjectEntry('tests/fixtures/dream-weaver-v01420/peaceful-exit.json', 'final')));
    const game = savedGame(naturalEntry('guidanceStart')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(3);
    await mountGame(game, false);
    await userEvent.click(screen.getByRole('button', { name: '洞察者与有限印记' }));
    expect(screen.getByRole('region', { name: '洞察者当前目标' }).textContent).toContain('织梦人3 → 洞察者2');
    const history = screen.getByText('原身体、既往经历与能力掌握', { selector: 'summary' });
    expect(history.closest('details')!.open).toBe(false); await userEvent.click(history);
    for (const text of ['全部21项原ID与掌握', 'DWV3-MESSAGE', 'DWV3-BELL', 'DWV3-OSMOND-CLUB', '本次不改变身体性别']) expect(history.closest('details')!.textContent).toContain(text);
    await userEvent.click(screen.getByRole('button', { name: '关闭洞察者页面' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: '织梦人' })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced', 'final'] as const)('routes actual %s S2 growth to all 23 current abilities, including the same 21 inherited IDs', async name => {
    const game = savedGame(naturalEntry(name)), before = structuredClone(game.state), projection = projectSliceState(before);
    expect(before.progression.sequence).toBe(2); expect(Object.keys(before.progression.mastery)).toHaveLength(23);
    expect(projection.discerner.abilities).toHaveLength(23); expect(projection.dreamWeaver.abilities).toHaveLength(21);
    expect(projection.discerner.abilities.slice(0, 21)).toEqual(projection.dreamWeaver.abilities);
    expect(projection.discerner.abilities.slice(21).map(a => a.id)).toEqual(['audience.s2.mental-imprint', 'audience.s2.insight-window']);
    if (name === 'promoted') expect(projection.discerner.abilities.slice(21).map(a => a.mastery)).toEqual([0, 0]);
    await mountGame(game, false);
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: '洞察者' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '织梦人' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^独立确认服用第/ })).toBeNull();
    await userEvent.click(screen.getByText('原身体、既往经历与能力掌握', { selector: 'summary' }));
    const abilities = screen.getByRole('region', { name: '洞察者有限能力与实际掌握' });
    for (const ability of projection.discerner.abilities) expect(abilities.textContent).toContain(`${ability.label} · 掌握 ${before.progression.mastery[ability.id]}`);
    await userEvent.click(screen.getByRole('button', { name: '关闭洞察者页面' }));
    await userEvent.click(screen.getByRole('button', { name: '洞察者与有限印记' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(NAVIGATION_BOUNDARIES)('projects every committed fact at the actual %s boundary without submitting or changing it', name => renderBoundaryProjection(name));

  it.each(['guidance', 'preparation-plan_withdrawal', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week'])('submits the actual %s command exactly once through its published control', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game);
    await userEvent.click(await commandControl(game.state, capturedCommand(captured)));
    if (game.state.activeEvent) await waitFor(() => expect(screen.getByRole('heading', { name: projectSliceState(game.state).activeEvent!.title })).toBeTruthy());
    else await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['consume-failure', 'promotion'])('independently reviews, cancels, escapes and then confirms the actual %s bottle once', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    if (command.type !== 'CONSUME') throw new Error('Expected actual consumption.');
    await mountGame(game);
    const trigger = await commandControl(game.state, command);
    await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: /^确认服用第/ });
    expect(review.textContent).toContain(command.bottleId);
    expect(review.textContent).toContain(projectSliceState(before).discerner.risk);
    for (const text of ['两项新掌握从0开始', '原21项掌握与既往经历保留', '当前灵性不补满', '本渠道仅提供独立成品，晋升仍须完成专业准备']) expect(review.textContent).toContain(text);
    expect(document.activeElement).toBe(within(review).getByRole('button', { name: '暂不服用，返回准备' }));
    expect(within(review).queryByRole('checkbox')).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '暂不服用，返回准备' }));
    expect(screen.queryByRole('dialog', { name: /^确认服用第/ })).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(game.state).toEqual(before);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: /^确认服用第/ });
    fireEvent.keyDown(review, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /^确认服用第/ })).toBeNull(); expect(game.state).toEqual(before);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: /^确认服用第/ });
    fireEvent(review, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: /^确认服用第/ })).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    const confirm = within(screen.getByRole('dialog', { name: /^确认服用第/ })).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    expect(game.state.discerner.bottles.find(b => b.id === command.bottleId)?.status).toBe('CONSUMED');
    expect(game.state.discerner.preparedWeek).toBeNull(); expect(game.state.progression.sequence).toBe(name === 'promotion' ? 2 : 3);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(game.state.progression.mastery[id]).toBe(mastery);
    assertLegacyPreserved(before, game.state);
    expect(screen.queryByRole('dialog', { name: /^确认服用第/ })).toBeNull();
  }, 20_000);

  it.each(['buy-independent-potion', 'prepare-current-week', 'promotion'])('locks pending/failed %s and retries the same envelope without duplicate payment or consumption', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true });
    const before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    if (command.type === 'CONSUME') await userEvent.click(screen.getByRole('button', { name: '确认服用这一原瓶' }));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: '洞察者' }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '选择独立洞察者原瓶' }) as HTMLSelectElement).disabled).toBe(true);
    const close = screen.queryByRole('button', { name: '关闭洞察者页面' }) as HTMLButtonElement | null;
    if (close) expect(close.disabled).toBe(true);
    fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(actionButton(game.state, command).disabled).toBe(true);
    const retry = screen.getByRole('button', { name: '重试这次操作' });
    // A native modal must not make the parent's retained-envelope retry inert.
    expect(screen.queryByRole('dialog', { name: /^确认服用第/ })).toBeNull();
    await userEvent.click(retry); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - (name === 'buy-independent-potion' ? 800 : name === 'prepare-current-week' ? 120 : 0));
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - (name === 'prepare-current-week' ? 1 : 0));
    assertLegacyPreserved(before, game.state);
  }, 20_000);
});
