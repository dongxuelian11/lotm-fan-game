/* @vitest-environment jsdom */
/** Actual terminal public capture only. No game simulation, controlled input, or SQLite replay. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { HANGED_MAN_ABILITY_IDS } from '../../src/domain/hanged-man/types.js';
import { readHangedManNaturalSnapshot, readHangedManNaturalSummary } from '../helpers/hanged-man-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it('shows the actual natural terminal resources, feedback and ordinary-exit record through the public-only save adapter', async () => {
  const value = readHangedManNaturalSnapshot('terminal').public, summary = readHangedManNaturalSummary();
  expect(value.revision).toBe(summary.revision); expect(value.status).toBe(summary.actual.status);
  expect(value.hangedMan.promoted).toBe(summary.actual.promoted);
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
    expect(screen.queryByRole('region', { name: value.hangedMan.title })).toBeNull();
  } else {
    expect(summary.stage).toBe('NATURAL_S0_RETURN_REPORTED');
    expect(summary.actual).toMatchObject({ promoted: true, reported: true, ordinaryExit: true, returnedHome: true, scenePhase: 'PRACTICE' });
    const panel = await screen.findByRole('region', { name: value.hangedMan.title }), r = value.hangedMan.resources;
    const resources = `健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind}`
      + ` · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`;
    expect(panel.textContent).toContain(resources);
    expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
      maxSpirituality: value.maxSpirituality, cash: `${value.cash}便士`, actionsRemaining: value.actionsRemaining });
    expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.hangedMan.nextStep);
    for (const section of value.hangedMan.sections.filter(item => ['clock', 'body', 'return'].includes(item.id))) {
      const rendered = within(panel).getByRole('region', { name: section.title });
      for (const line of section.lines) expect(rendered.textContent).toContain(line);
    }
    await userEvent.click(within(panel).getByText('原主许可、局部压力与普通退路', { selector: 'summary' }));
    for (const section of value.hangedMan.sections.filter(item => item.id === 'scene')) {
      const rendered = within(panel).getByRole('region', { name: section.title });
      for (const line of section.lines) expect(rendered.textContent).toContain(line);
    }
    expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
      .toContain(`${value.character.name} · ${value.hangedMan.title}`);
    const feedback = within(panel).getByRole('region', { name: '最近行动结果' });
    const recent = value.hangedMan.sections.filter(item => item.id === 'recent-action');
    if (recent.length) for (const section of recent) for (const line of section.lines) expect(feedback.textContent).toContain(line);
    else if (value.lastResult) {
      expect(feedback.textContent).toContain(value.lastResult.title);
      expect(feedback.textContent).toContain(value.lastResult.text);
    }
    if (value.lastCheck) expect(feedback.textContent)
      .toContain(`本次成功率 ${value.lastCheck.chance}%，实际掷骰 ${value.lastCheck.roll}。`);
    await userEvent.click(within(panel).getByText('当前能力与继承掌握', { selector: 'summary' }));
    for (const [index, id] of HANGED_MAN_ABILITY_IDS.entries()) {
      const ability = value.hangedMan.abilities.find(item => item.id === id)!;
      const applied = index === 0 ? summary.actual.pressureApplied : summary.actual.cooperativeSealApplied;
      expect(ability.mastery).toBe(applied ? 8 : 0);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    const ordinaryExit = value.hangedMan.actions.find(action => action.command.type === 'RETURN_ON_FOOT')!;
    expect((within(panel).getByRole('button', { name: ordinaryExit.label }) as HTMLButtonElement).disabled)
      .toBe(!ordinaryExit.enabled);
    expect(value.hangedMan.actions.some(action => action.preferredAction)).toBe(false);
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|randomSeed|beforeDigest|afterDigest/);
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await open();
    const reopened = await screen.findByRole('region', { name: value.hangedMan.title });
    expect(reopened.textContent).toContain(resources);
    expect(within(reopened).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.hangedMan.nextStep);
  }
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '暗天使成长' })).toBeNull();
  expect(loadRun).toHaveBeenCalledTimes(value.status === 'ACTIVE' ? 2 : 1);
  expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
