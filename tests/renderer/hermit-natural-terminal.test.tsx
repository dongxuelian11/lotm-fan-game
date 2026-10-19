/* @vitest-environment jsdom */
/** Actual terminal public capture only. No simulation, forced outcome or SQLite replay. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { HERMIT_ABILITY_IDS } from '../../src/domain/hermit/types.js';
import { readHermitNaturalSnapshot, readHermitNaturalSummary } from '../helpers/hermit-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it('loads the actual Hermit terminal resources, location, abilities and honest outcome through the public-only save adapter', async () => {
  const value = readHermitNaturalSnapshot('terminal').public, summary = readHermitNaturalSummary();
  expect(value.revision).toBe(summary.revision); expect(value.status).toBe(summary.actual.status);
  expect(value.hermit.promoted).toBe(summary.actual.promoted);
  expect(value).toMatchObject({ status: 'ACTIVE', revision: 942, week: 205, health: 100, mind: 79,
    spirituality: 63, maxSpirituality: 150, cash: 45, actionsRemaining: 2 });
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockResolvedValue({ ok: true, value: {
    mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
      portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
      revision: value.revision, updatedAt: '2026-10-19T00:00:00.000Z' }],
  } });
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(value.runId); return { ok: true, value: structuredClone(value) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>();
  window.sliceGame = { getBootstrap, loadRun, submitIntent };
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: value.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.status === 'DEAD') {
    expect(value.ending?.kind).toBe('DEATH');
    expect(await screen.findByRole('heading', { name: value.ending!.title })).toBeTruthy();
    expect(screen.getByText('只读封存卷宗')).toBeTruthy(); expect(screen.getByText(value.ending!.summary)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(screen.queryByRole('region', { name: value.hermit.title })).toBeNull();
  } else {
    const panel = await screen.findByRole('region', { name: value.hermit.title }), r = value.hermit.resources;
    expect(panel.textContent).toContain(`健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind}`
      + ` · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`);
    expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
      maxSpirituality: value.maxSpirituality, cash: `${value.cash}便士`, actionsRemaining: value.actionsRemaining });
    expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.hermit.nextStep);
    for (const section of value.hermit.sections.filter(item => ['clock', 'body', 'scene', 'return'].includes(item.id))) {
      const rendered = within(panel).getByRole('region', { name: section.title });
      for (const line of section.lines) expect(rendered.textContent).toContain(line);
    }
    expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
      .toContain(`${value.character.name} · ${value.hermit.title}`);
    expect(within(panel).getByRole('region', { name: '实际日期与所在地' }).textContent).toContain('档案馆外；第205周，1353年5月26日。');
    expect(within(panel).getByRole('region', { name: '交接与普通退路' }).textContent).toContain('返程报告已完成，同一记录已实际归还。');
    await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
    for (const id of HERMIT_ABILITY_IDS) {
      const ability = value.hermit.abilities.find(item => item.id === id)!;
      expect(ability.mastery).toBe(8);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(value.hermit.actions.some(action => action.preferredAction)).toBe(false);
    expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|seed|cursor/);
  }
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '知识皇帝成长' })).toBeNull();
  expect(loadRun).toHaveBeenCalledTimes(1); expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
