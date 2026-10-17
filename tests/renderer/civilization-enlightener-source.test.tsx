/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CivilizationEnlightenerPanel } from '../../src/renderer/CivilizationEnlightenerPanel.js';
import { projectCivilizationEnlightener } from '../../src/domain/civilization-enlightener/index.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { originalKnowledgeMentor, prepared, promoted, knowledgeMentorNaturalPath } from '../domain/civilization-enlightener-directed-helper.js';

// Raw historical metadata is intentionally tested separately. The historical
// capture is never passed to the current-schema validator or projector.
describe('Civilization Enlightener renderer source boundary', () => {
  afterEach(cleanup);

  it('retains the exact historical schema164 metadata', () => {
    const raw = readObjectEntry<{ schemaVersion: number; contentVersion: string; revision: number; week: number }>(knowledgeMentorNaturalPath, 'final');
    expect(raw).toMatchObject({ schemaVersion: 164, contentVersion: 'knowledge-mentor-v164', revision: 692, week: 169 });
  });

  it('renders the explicitly migrated original body without healing or inventing a replacement object', () => {
    const state = originalKnowledgeMentor(), before = structuredClone(state);
    assertValidSliceState(state);
    const value = projectCivilizationEnlightener(state), onCommand = vi.fn();
    render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    const resources = screen.getByRole('region', { name: '文明启蒙者当前资源' });
    expect(resources.textContent).toContain('伊文');
    expect(resources.textContent).toContain('健康70/100 · 精神99/100 · 灵性113/120');
    expect(resources.textContent).toContain('本周行动3 · 现有伤势1处 · 累计风险0');
    expect(resources.textContent).toContain('重伤 · 尚未治疗');
    expect(state.alchemist.life.creations.map(item => [item.id, item.charge, item.durability, item.location, item.active])).toEqual([
      ['AL4-BOX-1', 0, 100, 'PLAYER', false], ['AL4-FRAME-1', 0, 90, 'PLAYER', false],
    ]);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);

  it('submits the exact current prepared original bottle only after confirmation and never applies it in the renderer', () => {
    // Declared future-input unit helper; all prior history comes through explicit migration.
    const state = prepared(), before = structuredClone(state), value = projectCivilizationEnlightener(state), onCommand = vi.fn();
    assertValidSliceState(state);
    const consume = value.actions.find(entry => entry.enabled && entry.command.type === 'CONSUME')!;
    expect(consume).toBeTruthy();
    render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    const primary = within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
    expect(primary.textContent).toContain(consume.label);
    fireEvent.click(primary);
    const dialog = screen.getByRole('dialog', { name: '文明启蒙者操作确认' });
    expect(onCommand).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    const button = within(dialog).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume.command);
    expect(state).toEqual(before);
  }, 60000);

  it('shows all actual inherited mastery values and two new zeros after a real directed promotion', () => {
    const state = promoted(), before = structuredClone(state), value = projectCivilizationEnlightener(state), onCommand = vi.fn();
    assertValidSliceState(state);
    const view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(21);
    expect(value.abilities.slice(0, 19).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(value.abilities.slice(19).map(ability => [ability.id, ability.mastery])).toEqual([
      ['paragon.s1.process-analysis', 0], ['paragon.s1.operational-guidance', 0],
    ]);
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(state.progression.mastery[ability.id]);
      expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    }
    expect(view.container.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断/);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  }, 60000);
});
