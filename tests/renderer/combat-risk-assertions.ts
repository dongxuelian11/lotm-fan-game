import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

/** The lethal conditional risk stays visible; only recovery details are folded. */
export async function assertCombatRiskDisclosure(
  stage: HTMLElement,
  weights: { light: number; heavy: number; death: number },
) {
  const summary = within(stage).getByText(
    `若下次败北进入伤势后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%。这不是每回合或整场死亡概率。`,
  );
  expect(summary.closest('details')).toBeNull();
  const toggle = within(stage).getByText('查看伤势与风险详情', { selector: 'summary' });
  const disclosure = toggle.closest('details')!;
  expect(disclosure.open).toBe(false);
  await userEvent.click(toggle);
  expect(disclosure.open).toBe(true);
  const risk = within(stage).getByRole('region', { name: '伤势与恢复路线' });
  expect(risk.closest('details')).toBe(disclosure);
  return risk;
}

/** Check the named meters rather than whitespace between separate label/value nodes. */
export function assertCombatHealth(stage: HTMLElement, player: number, enemy: number, playerMax = 100) {
  for (const [name, value, max] of [['你的健康', player, playerMax], ['对手健康', enemy, 100]] as const) {
    const meter = within(stage).getByRole('progressbar', { name });
    expect(meter.getAttribute('aria-valuenow')).toBe(String(value));
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe(String(max));
    expect(meter.closest('details')).toBeNull();
    const fighter = within(stage).getByRole('region', { name: name === '你的健康' ? '你的战斗状态' : '对手战斗状态' });
    expect(within(fighter).getByText('健康', { selector: 'span' })).toBeTruthy();
    expect(within(fighter).getByText(`${value} / ${max}`, { selector: 'strong' })).toBeTruthy();
  }
}
