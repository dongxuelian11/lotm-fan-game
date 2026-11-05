/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun } from '../../src/domain/slice';
import { applyFacelessAcquisition, projectFaceless } from '../../src/domain/faceless';
import type { SeerContext } from '../../src/domain/seer';
import { FacelessLabourProgress } from '../../src/renderer/FacelessLabourProgress';
import { FacelessPanel } from '../../src/renderer/FacelessPanel';

const batchId = 'faceless-batch-1';
const resources = { health: 100, maxHealth: 100, mind: 100, maxMind: 100, spirituality: 30, maxSpirituality: 80, cash: '5000便士', actionsRemaining: 3 };
afterEach(cleanup);
function state(completed: number) {
  const s = createSliceRun('labour-progress', sliceDefaultCreationSelection, 'labour-progress');
  s.activeEvent = null; s.arc.stage = 'ENDED'; s.week = 30; s.actionsRemaining = 3; s.cash = 5000;
  s.progression.pathwayId = 'diviner'; s.progression.sequence = 7;
  s.seer.discovered = true; s.magician.formulaKnown = true; s.faceless.formulaKnown = true;
  s.faceless.batches[0]!.labourSteps = completed;
  return s;
}
function actions(completed: number) {
  return projectFaceless(state(completed)).actions.filter(a => 'batchId' in a.command && a.command.batchId === batchId);
}

describe('Faceless labour progress from exact public facts', () => {
  it.each([0, 1, 2, 3, 4, 5])('shows %s completed jobs from the production projection, never acquired materials', completed => {
    const projected = actions(completed), snapshot = JSON.stringify(projected);
    const { container } = render(<FacelessLabourProgress batchId={batchId} actions={projected} />);
    const meter = screen.getByRole('progressbar', { name: '第1批备料劳务' });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(completed));
    expect(meter.getAttribute('aria-valuemax')).toBe('5');
    expect(meter.getAttribute('aria-valuetext')).toBe(`已完成${completed}/5次劳动；材料尚未领取，尚未调配。`);
    expect(meter.querySelectorAll('.is-complete')).toHaveLength(completed);
    expect(meter.children).toHaveLength(5);
    expect(container.textContent).toContain('材料尚未领取');
    if (completed === 5) expect(container.textContent).toContain('仍须支付240便士领取材料，再另行调配');
    expect(JSON.stringify(projected)).toBe(snapshot);
  });

  it.each([0, 5])('does not imply five jobs were done after acquisition through route %s', completed => {
    const s = state(completed); s.faceless.batches[0]!.acquired = true;
    const projected = projectFaceless(s).actions.filter(a => 'batchId' in a.command && a.command.batchId === batchId);
    expect(projected.map(a => a.command.type)).toEqual(['BREW']);
    render(<FacelessLabourProgress batchId={batchId} actions={projected} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it.each([2, 5])('keeps %s earned jobs visible when money or actions disable the existing buttons', completed => {
    const s = state(completed); s.cash = 0; s.actionsRemaining = 0;
    const projected = projectFaceless(s).actions.filter(a => 'batchId' in a.command && a.command.batchId === batchId);
    expect(projected[0]!.enabled).toBe(false);
    render(<FacelessLabourProgress batchId={batchId} actions={projected} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(String(completed));
    if (completed === 5) expect(screen.getByText(/仍须支付240便士/)).toBeTruthy();
  });

  it.each(['unknown-cost', 'mismatched-step', 'wrong-batch', 'extra-command', 'missing-buy', 'full-price-only', 'unknown-id'] as const)('declines to infer progress for %s', variant => {
    let projected = structuredClone(actions(2));
    let id = batchId;
    if (variant === 'unknown-cost') projected[0]!.cost += '新说明';
    if (variant === 'mismatched-step') projected[0]!.label = '第1批 · 清理独立调配台';
    if (variant === 'wrong-batch') projected[1]!.command = { type: 'BUY_MATERIALS', batchId: 'faceless-batch-2' };
    if (variant === 'extra-command') projected.push({ ...projected[0]!, command: { type: 'BREW', batchId } });
    if (variant === 'missing-buy') projected = projected.slice(0, 1);
    if (variant === 'full-price-only') projected = projected.filter(a => a.command.type === 'BUY_MATERIALS');
    if (variant === 'unknown-id') id = 'faceless-batch-01';
    render(<FacelessLabourProgress batchId={id} actions={projected} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('distinguishes later batches rather than treating a new supply as already completed', () => {
    const s = state(5);
    for (const batch of s.faceless.batches) {
      batch.labourSteps = 5; batch.acquired = true; batch.brewed = true;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      s.faceless.bottles.push({ id: `${batch.id}:bottle`, batchId: batch.id, inputIds: batch.materials.map(m => m.id), brewedWeek: 29, status: 'CONSUMED', outcome: 'FAILURE' });
    }
    const context: SeerContext = { check: () => { throw new Error('No check expected for resupply'); }, roll: min => min, note: () => {} };
    applyFacelessAcquisition(s, { type: 'REQUEST_SUPPLY' }, context);
    s.week += 1;
    applyFacelessAcquisition(s, { type: 'RECEIVE_SUPPLY' }, context);
    const projected = projectFaceless(s).actions.filter(a => 'batchId' in a.command && a.command.batchId === 'faceless-batch-4');
    render(<FacelessLabourProgress batchId="faceless-batch-4" actions={projected} />);
    expect(screen.getByRole('progressbar', { name: '第4批备料劳务' }).getAttribute('aria-valuenow')).toBe('0');
  });

  it('updates only on a new projection, preserves commands, and keeps spare batches folded', () => {
    const s = state(1), value = projectFaceless(s), snapshot = JSON.stringify(value), onCommand = vi.fn();
    const props = { resources, busy: false, onCommand };
    const view = render(<FacelessPanel faceless={value} {...props} />);
    const meter = () => screen.getByRole('progressbar', { name: '第1批备料劳务' });
    const work = value.actions.find(a => a.command.type === 'MATERIAL_WORK')!;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${work.label}`) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(work.command);
    expect(meter().getAttribute('aria-valuenow')).toBe('1');
    view.rerender(<FacelessPanel faceless={value} {...props} busy />);
    expect(meter().getAttribute('aria-valuenow')).toBe('1');
    expect(JSON.stringify(value)).toBe(snapshot);
    expect(screen.getByText('其他批次 · 备用材料（2批）').closest('details')!.open).toBe(false);
    s.faceless.batches[0]!.labourSteps = 2;
    view.rerender(<FacelessPanel faceless={projectFaceless(s)} {...props} />);
    expect(meter().getAttribute('aria-valuenow')).toBe('2');
    view.unmount();
    render(<FacelessPanel faceless={projectFaceless(s)} {...props} />);
    expect(meter().getAttribute('aria-valuenow')).toBe('2');
  });
});
