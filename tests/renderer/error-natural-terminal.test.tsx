/* @vitest-environment jsdom */
/** Actual730 public capture only. Transport UI smoke, not another simulation or SQLite test. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { readErrorNaturalSnapshot } from '../helpers/error-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it('shows the natural living S0 withdrawal, unchanged zero mastery, and the same page after menu/reload', async () => {
  const value = readErrorNaturalSnapshot('terminal').public;
  expect(value).toMatchObject({ revision: 731, status: 'ACTIVE', canAct: false, maxSpirituality: 150,
    progression: { pathwayId: 'error', sequence: 0 }, errorAscent: { promoted: true, insideCase: false } });
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockResolvedValue({ ok: true, value: {
    mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
      portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
      revision: value.revision, updatedAt: '2026-10-18T22:00:00.000Z' }],
  } });
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(value.runId);
    return { ok: true, value: structuredClone(value) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>();
  window.sliceGame = { getBootstrap, loadRun, submitIntent };
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<SliceApp />);
  const open = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
    return screen.findByRole('region', { name: value.errorAscent.title });
  };
  let panel = await open();
  expect(panel.textContent).toContain('健康 86/100 · 精神 78/100 · 灵性 64/150 · 现金 127便士 · 本周行动 1/3');
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain('撤离记录已完成');
  expect(panel.textContent).toContain('如实交接');
  expect(panel.textContent).toContain('街区接待处');
  expect(panel.textContent).toContain('伊德里克的结果：被替位后仍存活。');
  expect(panel.textContent).toContain('原联索已切断');
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '时之虫成长' })).toBeNull();
  expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
  await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
  for (const label of ['短时窃走行动', '联系错置'])
    expect(within(panel).getByRole('heading', { name: label + ' · 熟练 0' })).toBeTruthy();
  expect(value.errorAscent.actions.some(action => action.command.type === 'RITUAL' && action.command.command.type === 'REPLACE')).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
  panel = await open();
  expect(panel.textContent).toContain('撤离记录已完成');
  expect(panel.textContent).toContain('灵性 64/150');
  expect(loadRun).toHaveBeenCalledTimes(2);
  expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
