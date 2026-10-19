/* @vitest-environment jsdom */
/** Actual terminal public capture only. No game simulation, controlled input, or SQLite replay. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { ABYSS_ABILITY_IDS } from '../../src/domain/abyss/types.js';
import { readAbyssNaturalSnapshot, readAbyssNaturalSummary } from '../helpers/abyss-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it('shows actual964 living S0 resources, final rest feedback and the reported ordinary exit through the public-only save adapter', async () => {
  const value = readAbyssNaturalSnapshot('terminal').public, summary = readAbyssNaturalSummary();
  expect(value.revision).toBe(summary.revision); expect(value.status).toBe(summary.actual.status);
  expect(value.abyss.promoted).toBe(summary.actual.promoted);
  expect(value).toMatchObject({ revision: 965, status: 'ACTIVE', week: 227, health: 100, mind: 84,
    spirituality: 92, maxSpirituality: 150, cash: 600, actionsRemaining: 2, injuries: [] });
  expect(value.lastCheck).toBeNull();
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
    await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  };
  await open();
  expect(summary.stage).toBe('NATURAL_S0_REPORTED_EXIT');
  expect(summary.actual).toMatchObject({ promoted: true, reported: true, ordinaryExit: true, returnedHome: true });
  const panel = await screen.findByRole('region', { name: value.abyss.title }), r = value.abyss.resources;
  const resources = `健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind}`
    + ` · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`;
  expect(panel.textContent).toContain(resources);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, cash: `${value.cash}便士`, actionsRemaining: value.actionsRemaining });
  expect(within(panel).getByRole('region', { name: '本章目标' }).textContent).toContain(value.abyss.nextStep);
  for (const section of value.abyss.sections.filter(item => ['clock', 'body', 'return'].includes(item.id))) {
    const rendered = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(rendered.textContent).toContain(line);
  }
  await userEvent.click(within(panel).getByText('货闸、货物与普通退路', { selector: 'summary' }));
  for (const section of value.abyss.sections.filter(item => item.id === 'scene' || item.id.startsWith('passage-'))) {
    const rendered = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(rendered.textContent).toContain(line);
  }
  expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
    .toContain(`${value.character.name} · ${value.abyss.title}`);
  const feedback = within(panel).getByRole('region', { name: '最近行动结果' });
  expect(feedback.textContent).toContain('按实际生活档休养八小时');
  const recent = value.abyss.sections.filter(item => item.id === 'recent-action');
  if (recent.length) for (const section of recent) for (const line of section.lines) expect(feedback.textContent).toContain(line);
  else if (value.lastResult) {
    expect(feedback.textContent).toContain(value.lastResult.title);
    expect(feedback.textContent).toContain(value.lastResult.text);
  }
  await userEvent.click(within(panel).getByText('当前能力与继承掌握', { selector: 'summary' }));
  for (const id of ABYSS_ABILITY_IDS) {
    const ability = value.abyss.abilities.find(item => item.id === id)!;
    expect(ability.mastery).toBe(8);
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  const ordinaryExit = value.abyss.actions.find(action => action.command.type === 'RETURN_ON_FOOT')!;
  expect((within(panel).getByRole('button', { name: ordinaryExit.label }) as HTMLButtonElement).disabled)
    .toBe(!ordinaryExit.enabled);
  expect(value.abyss.actions.some(action => action.preferredAction)).toBe(false);
  expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
  expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|randomSeed|beforeDigest|afterDigest/);
  await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
  await open();
  const reopened = await screen.findByRole('region', { name: value.abyss.title });
  expect(reopened.textContent).toContain(resources);
  expect(within(reopened).getByRole('region', { name: '本章目标' }).textContent).toContain(value.abyss.nextStep);
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '污秽君王成长' })).toBeNull();
  expect(loadRun).toHaveBeenCalledTimes(2);
  expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
