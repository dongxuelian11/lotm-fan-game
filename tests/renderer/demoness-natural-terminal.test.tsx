/* @vitest-environment jsdom */
/** Actual terminal public capture only. No game simulation, controlled input, or SQLite replay. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { DEMONESS_ABILITY_IDS } from '../../src/domain/demoness/types.js';
import { readDemonessNaturalSnapshot, readDemonessNaturalSummary } from '../helpers/demoness-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it('shows the actual natural terminal resources, feedback and ordinary-exit record through the public-only save adapter', async () => {
  const value = readDemonessNaturalSnapshot('terminal').public, summary = readDemonessNaturalSummary();
  expect(value.revision).toBe(summary.revision); expect(value.status).toBe(summary.actual.status);
  expect(value.demoness.promoted).toBe(summary.actual.promoted);
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
  await open();
  if (value.status !== 'ACTIVE') {
    expect(summary.stage).toBe(value.status === 'DEAD' ? 'NATURAL_DEATH' : 'NATURAL_TERMINAL');
    expect(await screen.findByRole('heading', { name: value.ending!.title })).toBeTruthy();
    expect(screen.getByText(value.ending!.summary)).toBeTruthy();
    if (value.status === 'DEAD') {
      expect(value.ending?.kind).toBe('DEATH');
      expect(screen.getByText('只读封存卷宗')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    }
    expect(screen.queryByRole('region', { name: value.demoness.title })).toBeNull();
  } else {
    expect(summary.stage).toBe('NATURAL_S0_REPORTED_EXIT');
    expect(summary.actual).toMatchObject({ promoted: true, reported: true, ordinaryExit: true, passagePhase: 'CLOSED' });
    const panel = await screen.findByRole('region', { name: value.demoness.title }), r = value.demoness.resources;
    const resources = `健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind}`
      + ` · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`;
    expect(panel.textContent).toContain(resources);
    expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
      maxSpirituality: value.maxSpirituality, cash: `${value.cash}便士`, actionsRemaining: value.actionsRemaining });
    expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.demoness.nextStep);
    for (const section of value.demoness.sections.filter(item => item.id === 'clock' || item.id === 'return')) {
      const rendered = within(panel).getByRole('region', { name: section.title });
      for (const line of section.lines) expect(rendered.textContent).toContain(line);
    }
    expect(within(panel).getByRole('region', { name: '有限落石与原撑返程' }).textContent)
      .toContain('两位成人已各自实际通过并走出，本人也已实际退出，结果已报告。');
    const feedback = within(panel).getByRole('region', { name: '最近行动结果' });
    const recent = value.demoness.sections.filter(item => item.id === 'recent-action');
    if (recent.length) for (const section of recent) for (const line of section.lines) expect(feedback.textContent).toContain(line);
    else if (value.lastResult) {
      expect(feedback.textContent).toContain(value.lastResult.title);
      expect(feedback.textContent).toContain(value.lastResult.text);
    }
    if (value.lastCheck) expect(feedback.textContent)
      .toContain(`本次成功率 ${value.lastCheck.chance}%，实际掷骰 ${value.lastCheck.roll}。`);
    await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
    for (const [index, id] of DEMONESS_ABILITY_IDS.entries()) {
      const ability = value.demoness.abilities.find(item => item.id === id)!;
      const applied = index === 0 ? summary.actual.petrificationApplied : summary.actual.reshapingApplied;
      expect(ability.mastery).toBe(applied ? 8 : 0);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    const ordinaryExit = value.demoness.actions.find(action => action.command.type === 'RETURN_ON_FOOT')!;
    expect((within(panel).getByRole('button', { name: ordinaryExit.label }) as HTMLButtonElement).disabled)
      .toBe(!ordinaryExit.enabled);
    expect(value.demoness.actions.some(action => action.preferredAction)).toBe(false);
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|randomSeed|beforeDigest|afterDigest/);
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await open();
    const reopened = await screen.findByRole('region', { name: value.demoness.title });
    expect(reopened.textContent).toContain(resources);
    expect(within(reopened).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.demoness.nextStep);
  }
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '末日魔女成长' })).toBeNull();
  expect(loadRun).toHaveBeenCalledTimes(value.status === 'ACTIVE' ? 2 : 1);
  expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
