/* @vitest-environment jsdom */
/** One actual terminal public capture, opened twice. No simulation, RNG override or SQLite replay. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { assertBlackEmperorNaturalPublic, readBlackEmperorNaturalSnapshot, readBlackEmperorNaturalSummary } from '../helpers/black-emperor-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

it('opens and reopens the actual natural ending with its resources, realm, feedback and ordinary exit or death', async () => {
  const value = readBlackEmperorNaturalSnapshot('terminal').public, summary = readBlackEmperorNaturalSummary();
  assertBlackEmperorNaturalPublic(value);
  expect(value.revision).toBe(summary.revision); expect(value.status).toBe(summary.actual.status);
  expect(value.blackEmperor.promoted).toBe(summary.actual.promoted);
  expect(value.progression.sequence).toBe(summary.actual.sequence);
  expect([value.week, value.health, value.mind, value.spirituality])
    .toEqual([summary.actual.week, summary.actual.health, summary.actual.mind, summary.actual.spirituality]);
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockResolvedValue({ ok: true, value: {
    mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
      portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
      revision: value.revision, updatedAt: '2026-10-19T00:00:00.000Z' }],
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
    await userEvent.click(await screen.findByRole('button', { name: value.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  };
  const r = value.blackEmperor.resources;
  const resources = `健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind}`
    + ` · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`;
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, cash: `${value.cash}便士`, actionsRemaining: value.actionsRemaining });
  const inspectTerminal = async () => {
    if (value.status === 'DEAD') {
      expect(summary.stage).toBe('NATURAL_DEATH'); expect(value.ending?.kind).toBe('DEATH');
      expect(await screen.findByRole('heading', { name: value.ending!.title })).toBeTruthy();
      expect(screen.getByText(value.ending!.summary)).toBeTruthy();
      expect(screen.getByText('只读封存卷宗')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('region', { name: value.blackEmperor.title })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: '查看卷宗' }));
    } else {
      expect(summary.actual).toMatchObject({ status: 'ACTIVE', reported: true, ordinaryExit: true, exitClosed: true });
      expect(value.ending).toBeNull();
    }
    const panel = await screen.findByRole('region', { name: value.blackEmperor.title });
    expect(panel.textContent).toContain(resources);
    expect(within(panel).getByRole('region', { name: '本章目标' }).textContent).toContain(value.blackEmperor.nextStep);
    expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
      .toContain(`${value.character.name} · ${value.blackEmperor.title}`);
    return panel;
  };
  await open();
  const panel = await inspectTerminal();
  // Read the actual retained city/tomb/material/result lines, whatever happened naturally.
  for (const details of panel.querySelectorAll('details')) {
    const toggle = details.querySelector('summary');
    if (!details.open && toggle) await userEvent.click(toggle);
  }
  for (const section of value.blackEmperor.sections) {
    if (['recent-action', 'latest', 'injuries'].includes(section.id)) continue;
    const rendered = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(rendered.textContent).toContain(line);
  }
  const feedback = within(panel).getByRole('region', { name: '最近行动结果' });
  const recent = value.blackEmperor.sections.filter(item => item.id === 'recent-action' || item.id === 'latest');
  if (recent.length) for (const section of recent) for (const line of section.lines) expect(feedback.textContent).toContain(line);
  else if (value.lastResult) {
    expect(feedback.textContent).toContain(value.lastResult.title);
    expect(feedback.textContent).toContain(value.lastResult.text);
  }
  if (value.lastCheck) expect(feedback.textContent)
    .toContain(`本次成功率 ${value.lastCheck.chance}%，实际掷骰 ${value.lastCheck.roll}。`);
  for (const ability of value.blackEmperor.abilities)
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  for (const action of value.blackEmperor.actions)
    expect((within(panel).getByRole('button', { name: action.label }) as HTMLButtonElement).disabled)
      .toBe(value.status === 'DEAD' || !action.enabled);
  expect(value.blackEmperor.actions.some(action => action.preferredAction)).toBe(false);
  expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
  expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|randomSeed|beforeDigest|afterDigest|privateSite|actorId/);
  await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
  await open();
  await inspectTerminal();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '弑序亲王成长' })).toBeNull();
  expect(loadRun).toHaveBeenCalledTimes(2); expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
