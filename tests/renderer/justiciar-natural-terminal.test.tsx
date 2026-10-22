/* @vitest-environment jsdom */
/** Actual single natural terminal. One actual terminal public capture, opened in two fresh app
 * mounts. No simulation, fabricated promotion, RNG override, or SQLite replay. */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import {
  assertJusticiarNaturalPublic, justiciarNaturalPins, readJusticiarNaturalSnapshot, readJusticiarNaturalSummary,
} from '../helpers/justiciar-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

it('opens and reopens the sole actual terminal capture with its true return or death and public resources', async () => {
  const pins = justiciarNaturalPins(), value = readJusticiarNaturalSnapshot('terminal').public;
  const summary = readJusticiarNaturalSummary();
  assertJusticiarNaturalPublic(value);
  expect(value.revision).toBe(pins.revision); expect(value.status).toBe(pins.actual.status);
  expect(value.justiciar.promoted).toBe(pins.actual.promoted); expect(value.progression.sequence).toBe(pins.actual.sequence);
  expect([value.week, value.health, value.mind, value.spirituality, value.cash, value.actionsRemaining])
    .toEqual([pins.state.week, pins.state.health, pins.state.mind, pins.state.spirituality, pins.state.cash, pins.state.actionsRemaining]);
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
  const open = async () => {
    await userEvent.click(await screen.findByRole('button', { name: value.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  };
  const inspectTerminal = async () => {
    if (value.status === 'DEAD') {
      expect(summary.stage).toBe('NATURAL_DEATH'); expect(value.ending?.kind).toBe('DEATH');
      expect(await screen.findByRole('heading', { name: value.ending!.title })).toBeTruthy();
      for (const text of [value.ending!.summary, value.ending!.workers, value.ending!.accountability,
        value.ending!.hazard, value.ending!.relationship]) expect(screen.getByText(text)).toBeTruthy();
      expect(screen.getByText('只读封存卷宗')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('region', { name: value.justiciar.title })).toBeNull();
      // An actual S2/S1 death must stay that death. Do not synthesize S0 guidance
      // or pretend the unreached Justiciar chapter is the current screen.
      if (!value.justiciar.guidanceKnown) return;
      await userEvent.click(screen.getByRole('button', { name: '查看卷宗' }));
    } else {
      expect(summary.actual).toMatchObject({ status: 'ACTIVE', reported: true, cargoDelivered: true,
        ordinaryExit: true, returnedHome: true });
      expect(value.ending).toBeNull();
    }
    const panel = await screen.findByRole('region', { name: value.justiciar.title }), r = value.justiciar.resources;
    const resources = `健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind}`
      + ` · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`;
    expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
      maxSpirituality: value.maxSpirituality, cash: `${value.cash}便士`, actionsRemaining: value.actionsRemaining });
    expect(panel.textContent).toContain(resources);
    expect(within(panel).getByRole('region', { name: '本章目标' }).textContent).toContain(value.justiciar.nextStep);
    expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
      .toContain(`${value.character.name} · ${value.justiciar.title}`);
    for (const details of panel.querySelectorAll('details')) {
      const toggle = details.querySelector('summary'); if (!details.open && toggle) await userEvent.click(toggle);
    }
    for (const section of value.justiciar.sections) {
      if (['recent-action', 'injuries'].includes(section.id)) continue;
      const rendered = within(panel).getByRole('region', { name: section.title });
      for (const line of section.lines) expect(rendered.textContent).toContain(line);
    }
    const injuries = within(panel).getByRole('region', { name: '当前伤势' });
    expect(injuries.textContent).toContain(`伤势风险 ${value.justiciar.injuryRisk}`);
    for (const section of value.justiciar.sections.filter(s => s.id === 'injuries'))
      for (const line of section.lines) expect(injuries.textContent).toContain(line);
    const feedback = within(panel).getByRole('region', { name: '最近行动结果' });
    const recent = value.justiciar.sections.filter(item => item.id === 'recent-action');
    if (recent.length) for (const section of recent) for (const line of section.lines) expect(feedback.textContent).toContain(line);
    else if (value.lastResult) {
      expect(feedback.textContent).toContain(value.lastResult.title); expect(feedback.textContent).toContain(value.lastResult.text);
    }
    if (value.lastCheck) expect(feedback.textContent)
      .toContain(`本次成功率 ${value.lastCheck.chance}%，实际掷骰 ${value.lastCheck.roll}。`);
    for (const ability of value.justiciar.abilities)
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    for (const action of value.justiciar.actions)
      expect((within(panel).getByRole('button', { name: action.label }) as HTMLButtonElement).disabled)
        .toBe(value.status === 'DEAD' || !action.enabled);
    expect(value.justiciar.actions.some(action => action.preferredAction)).toBe(false);
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|randomSeed|beforeDigest|afterDigest|privateSource|actorId/);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '秩序之手成长' })).toBeNull();
  };
  const first = render(<SliceApp />); await open(); await inspectTerminal();
  first.unmount(); render(<SliceApp />); await open(); await inspectTerminal();
  expect(loadRun).toHaveBeenCalledTimes(2); expect(submitIntent).not.toHaveBeenCalled();
}, 30_000);
