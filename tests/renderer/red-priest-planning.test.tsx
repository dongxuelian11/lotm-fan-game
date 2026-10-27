/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedPriestPanel } from '../../src/renderer/RedPriestPanel.js';
import type { RedPriestAction, RedPriestProjection } from '../../src/domain/red-priest/types.js';
import { redPriestBattlePlanSelectionCost, redPriestCampaignReadiness } from '../../src/domain/red-priest/index.js';
import { createRedPriestCampaign, getRedPriestCampaignChallenge } from '../../src/domain/red-priest/campaign.js';
import { RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_LEGIONS } from '../../src/domain/red-priest/campaign-content.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';

// UI-only public fixtures and pure readiness calculations. These are not a
// natural campaign, an executed random check, or evidence of a SQLite commit.
function panel(): RedPriestProjection {
  const choices: RedPriestAction[] = [];
  for (const stance of ['STANDARD', 'COORDINATED', 'PROTECTIVE'] as const) for (const extraSupplies of [false, true]) {
    const label = stance === 'STANDARD' ? '常规' : stance === 'COORDINATED' ? '三军协同' : '保护性准备';
    choices.push({ id: `${stance}-${extraSupplies}`, label: `采用${label}${extraSupplies ? '并额外投入补给' : '方案'}`,
      cost: stance === 'PROTECTIVE' ? '1行动、实际1周；各原国库60，另结正常维持。' : '不花行动、时间或费用。',
      enabled: true, reason: null,
      command: { type: 'CAMPAIGN', command: { type: 'SELECT_BATTLE_PLAN', nodeId: 'northern-pass', stance, extraSupplies } } });
  }
  return { title: '红祭司 · 北大陆战争', guidanceKnown: true, promoted: false, insideCase: false,
    story: '三支原军实际同处灰脊北关。', nextStep: '先侦察或选定本次战术。', risk: '失败会留下真实伤亡。',
    resources: { health: 86, mind: 91, spirituality: 102, cash: '80便士', actionsRemaining: 3 }, abilities: [],
    sections: [
      { id: 'campaign-planning', title: '本次会战筹备', lines: ['尚未选定本次方案。', '当前补给50；首周直接消耗后45。'] },
      { id: 'campaign-readiness', title: '胜算与有限兵员', lines: ['当前方案成功率42%；胜利每军至多损失120，失败450。'] },
    ],
    actions: [
      { id: 'recon', label: '侦察灰脊北关当前守军', cost: '1行动、1周；每国库120与每军1补给，另结正常维持。',
        enabled: true, reason: null, preferredAction: true, command: { type: 'CAMPAIGN', command: { type: 'RECONNOITRE', nodeId: 'northern-pass' } } },
      ...choices,
      { id: 'battle', label: '按已选方案在灰脊北关执行会战', cost: '1行动、40便士、6灵性；每军4补给，另结正常维持。',
        enabled: false, reason: '须先选择本次方案。', command: { type: 'CAMPAIGN', command: { type: 'PREPARED_BATTLE', nodeId: 'northern-pass' } } },
      { id: 'withdraw', label: '保护撤离并结束本场战争', cost: '1行动；原伤亡保留。',
        enabled: true, reason: null, command: { type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } } },
    ] };
}
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Red Priest compact public planning controls', () => {
  it('requires an explicit stance and submits only the exact supplied action, never an implicit battle', () => {
    const value = panel(), onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    const preparation = screen.getByRole('region', { name: '本次会战筹备' });
    expect(within(preparation).queryAllByRole('button')).toHaveLength(0);
    expect((screen.getByLabelText('待提交战术') as HTMLSelectElement).value).toBe('');
    expect(disabled(screen.getByRole('button', { name: '按已选方案在灰脊北关执行会战' }))).toBe(true);
    fireEvent.change(screen.getByLabelText('待提交战术'), { target: { value: 'PROTECTIVE' } });
    fireEvent.click(screen.getByLabelText('额外投入每军6补给'));
    expect(onCommand).not.toHaveBeenCalled();
    expect(within(preparation).getAllByRole('button')).toHaveLength(1);
    const button = screen.getByRole('button', { name: '采用保护性准备并额外投入补给' });
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toContain('各原国库60');
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions.find(a => a.id === 'PROTECTIVE-true')!.command);
    expect(disabled(screen.getByLabelText('待提交战术'))).toBe(true);
    expect(disabled(screen.getByLabelText('额外投入每军6补给'))).toBe(true);
  });

  it('shows authoritative disabled conditions and cannot submit an unavailable preparation', () => {
    const value = panel(), onCommand = vi.fn();
    const selection = value.actions.find(a => a.id === 'COORDINATED-false')!;
    selection.enabled = false; selection.reason = '每支原军须至少1000人、60士气。';
    render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('待提交战术'), { target: { value: 'COORDINATED' } });
    const button = screen.getByRole('button', { name: '采用三军协同方案' });
    expect(disabled(button)).toBe(true); expect(screen.getByText(selection.reason)).toBeTruthy();
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it('refreshes drafts on acknowledged changes and only enables the projected prepared battle', () => {
    const value = panel(), onCommand = vi.fn(), view = render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('待提交战术'), { target: { value: 'STANDARD' } });
    fireEvent.click(screen.getByRole('button', { name: '采用常规方案' }));
    const next = structuredClone(value); next.sections[0]!.lines[0] = '已生效方案：常规。';
    const battle = next.actions.find(a => a.id === 'battle')!; battle.enabled = true; battle.reason = null;
    view.rerender(<RedPriestPanel value={next} busy={false} onCommand={onCommand} />);
    expect((screen.getByLabelText('待提交战术') as HTMLSelectElement).value).toBe('');
    expect(screen.getByText('已生效方案：常规。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: battle.label }));
    expect(onCommand).toHaveBeenNthCalledWith(2, battle.command);
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks selectors and every action while %s without changing current facts', reason => {
    const value = panel(); if (reason === 'dead') value.resources.health = 0;
    const onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={reason === 'busy'} blocked={reason === 'blocked'}
      error={reason === 'error' ? '本次保存尚未确认。' : null} onCommand={onCommand} />);
    expect(disabled(screen.getByLabelText('待提交战术'))).toBe(true);
    expect(disabled(screen.getByLabelText('额外投入每军6补给'))).toBe(true);
    for (const button of screen.getAllByRole('button')) { expect(disabled(button)).toBe(true); fireEvent.click(button); }
    expect(screen.getByText('尚未选定本次方案。')).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps readiness open, three main actions, ordinary withdrawal, and recent actual feedback', () => {
    const onCommand = vi.fn(); render(<RedPriestPanel value={panel()} busy={false} onCommand={onCommand}
      lastResult={{ id: 'ui-result', week: 22, title: '沈砚·Arden 的实际准备', text: '本次已支付各国库60，真实经过一周。' }}
      lastCheck={{ ability: 'will', baseAbility: 24, effectiveAbility: 44, difficulty: 42, chance: 54, roll: 89, tier: 'FAILURE', modifiers: [{ source: '原三军协同', value: 20 }] }} />);
    const readiness = screen.getByRole('region', { name: '胜算与有限兵员' });
    expect(readiness.closest('details')).toBeNull(); expect(readiness.textContent).toContain('成功率42%');
    const main = screen.getByRole('region', { name: '眼下该做什么' }).querySelector<HTMLElement>(':scope > .seer-actions')!;
    expect(within(main).getAllByRole('button')).toHaveLength(3);
    expect(within(main).getByRole('button', { name: '保护撤离并结束本场战争' })).toBeTruthy();
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('沈砚·Arden'); expect(result.textContent).toContain('d100 掷骰 89');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('shows the explicit optional opt-in before declaration without manufacturing a choice', () => {
    const value = panel(), onCommand = vi.fn(); value.sections = [];
    value.actions = [
      { id: 'declare', label: '签发大陆战争发动命令', cost: '1行动、80便士、1周。', enabled: true, reason: null,
        command: { type: 'CAMPAIGN', command: { type: 'DECLARE_OFFENSIVE' } } },
      { id: 'enable', label: '启用本场战争筹备', cost: '不花行动、时间或费用；仅发动前可选。', enabled: true, reason: null,
        command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } } },
    ];
    render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '发动前选择筹备' })).toBeTruthy();
    expect(screen.queryByLabelText('待提交战术')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '启用本场战争筹备' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[1]!.command);
  });

  it('renders no private extras from planning, source, rolls or journals', () => {
    const value = Object.assign(panel(), { planning: { privateSource: 'PRIVATE_BINDING' }, random: { seed: 'PRIVATE_SEED', cursor: 6 }, journal: ['PRIVATE_JOURNAL'] });
    const view = render(<RedPriestPanel value={value} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|seed|cursor|privateSource|journal/);
  });
});

function readinessCampaign() {
  const campaign = createRedPriestCampaign('readiness-only', 1);
  campaign.phase = 'ORDERED'; campaign.location = 'northern-pass';
  for (const id of RED_PRIEST_CAMPAIGN_COALITION) campaign.polities[id].authority = 'GRANTED';
  for (const cfg of RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD')) {
    const legion = campaign.legions[cfg.id]; legion.mobilized = true; legion.location = 'northern-pass';
  }
  const binding = { eventId: 'readiness-only', week: 1, nodeId: 'northern-pass' as const, defenderId: 'feysac-north' as const, battleCount: 0 };
  campaign.planning = { version: 1, enabledEventId: 'readiness-opt-in', enabledWeek: 1,
    recon: { ...binding }, selection: { ...binding, stance: 'PROTECTIVE', extraSupplies: true } };
  return campaign;
}
describe('Red Priest selected-plan readiness wording', () => {
  it('shows the prospective selected cost and chance before payment, without granting ineligible coordination', () => {
    const campaign = readinessCampaign(), original = structuredClone(campaign);
    const value = panel(), proposed = value.actions.find(a => a.id === 'PROTECTIVE-true')!;
    proposed.cost = redPriestBattlePlanSelectionCost(campaign, 0, 'northern-pass', 'PROTECTIVE', true);
    const onCommand = vi.fn(); render(<RedPriestPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('待提交战术'), { target: { value: 'PROTECTIVE' } });
    fireEvent.click(screen.getByLabelText('额外投入每军6补给'));
    expect(screen.getByText(proposed.cost).textContent).toContain('各原国库60');
    expect(proposed.cost).toContain('按当前兵员与已有效侦察估计42%');
    expect(proposed.cost).toContain('跨周或实际条件改变后重算；须满足资源条件');
    expect(onCommand).not.toHaveBeenCalled(); expect(campaign).toEqual(original);
    expect(redPriestBattlePlanSelectionCost(campaign, 0, 'northern-pass', 'COORDINATED', true)).toContain('估计46%');
    campaign.legions['loen-expedition'].morale = 59;
    expect(redPriestBattlePlanSelectionCost(campaign, 0, 'northern-pass', 'COORDINATED', true)).toContain('估计6%');
  });
  it('uses the same actual challenge bonus and selected losses, naming the future-fight assumptions', () => {
    const campaign = readinessCampaign(), challenge = getRedPriestCampaignChallenge(campaign, { type: 'PREPARED_BATTLE', nodeId: 'northern-pass' })!;
    const chance = computeCheckChance({ baseAbility: 0, difficulty: challenge.difficulty, modifiers: [{ source: '本次筹备', value: challenge.effectiveBonus! }] });
    const text = redPriestCampaignReadiness(campaign, 0).join('');
    expect(text).toContain(`当前方案成功率${chance}%`); expect(text).toContain('实际筹备加值38');
    expect(text).toContain('胜利每军至多损失120'); expect(text).toContain('失败每军至多损失450');
    expect(text).toContain('之后各战采用常规且全部获胜'); expect(text).toContain('不是完成保证');
  });
  it('does not count a stale defender-bound plan or promise impossible certainty', () => {
    const campaign = readinessCampaign(); campaign.nodes['northern-pass'].battleCount++;
    const text = redPriestCampaignReadiness(campaign, 0).join('');
    expect(text).toContain('尚未选定本次方案'); expect(text).toContain('实际筹备加值0');
    expect(text).toContain('胜利每军至多损失180'); expect(text).not.toContain('当前已选保护性准备');
  });
  it('preserves the legacy no-planning readiness text exactly', () => {
    const campaign = createRedPriestCampaign('legacy-readiness', 1);
    expect(redPriestCampaignReadiness(campaign, 24)).toEqual([
      '现有原军7800人；每次开战至少3000人，各军士气至少40。',
      '每次败仗最多损失1800现员并降低各军36士气；死者和伤员不能靠休整返还。每胜仍会损失各军至多180现员。',
      '还需5处独立胜利；后备兵员剩3600。不再补兵且之后全部获胜时，完成剩余目标至少需现有5160人。',
    ]);
  });
});
