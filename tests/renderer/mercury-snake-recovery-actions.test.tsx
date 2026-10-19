/* @vitest-environment jsdom */
/** Presentation contract only; paid recovery qualification is covered by original-recovery domain tests. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MercurySnakePanel } from '../../src/renderer/MercurySnakePanel.js';
import type { MercurySnakeCommand } from '../../src/domain/mercury-snake/types.js';
import { readWheelOfFortuneNaturalSnapshot } from '../helpers/wheel-of-fortune-natural-capture.js';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
it.each(['REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1'] as const)
  ('renders and submits the publicly enabled %s for the selected original bottle', type => {
    const value = structuredClone(readWheelOfFortuneNaturalSnapshot('initial').public.mercurySnake);
    // Public prop fixture: exercise the acquisition filter, not an invented game state.
    value.promoted = false;
    const command: MercurySnakeCommand = { type, bottleId: value.bottles[0]!.id };
    const label = type === 'REQUEST_RECOVERY_V1' ? '调查并封存同一失败原特性' : '交接同一原特性并重配药液';
    value.actions = [{ id: 'visible-recovery', label, cost: '按实际公开费用支付', command,
      enabled: true, reason: null, preferredAction: true }];
    value.preferredActionId = 'visible-recovery';
    const onCommand = vi.fn();
    render(<MercurySnakePanel value={value} busy={false} onCommand={onCommand} />);
    const button = within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
    expect(button.textContent).toContain(label); expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    fireEvent.click(within(screen.getByRole('dialog', { name: '水银之蛇操作确认' }))
      .getByRole('button', { name: '确认执行这一次操作' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
  });
