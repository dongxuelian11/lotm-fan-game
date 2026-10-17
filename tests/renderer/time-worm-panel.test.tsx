/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TimeWormPanel, type TimeWormPanelProps } from '../../src/renderer/TimeWormPanel.js';
import { TIME_WORM_ABILITIES, TIME_WORM_CONSUMPTION_RISK, TIME_WORM_INHERITED_ABILITIES, TIME_WORM_PREPARATIONS } from '../../src/domain/time-worm/content.js';
import { createTimeWormMaterials, createTimeWormScene } from '../../src/domain/time-worm/encounter.js';
import { createFateTrojanSiteState } from '../../src/domain/fate-trojan/life.js';
import type { TimeWormAction, TimeWormCommand, TimeWormProjection } from '../../src/domain/time-worm/types.js';

afterEach(cleanup);

// Explicit renderer-only UNIT projections. These are presentation inputs, not
// valid saves, source continuations, random replays, or evidence of a natural run.
function action(command: TimeWormCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): TimeWormAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
const oldMastery: Record<string, number> = {
  'error.s9.agility': 41, 'error.s9.dexterity': 49, 'error.s9.theft': 57, 'error.s8.deceit': 41,
  'error.s7.decryption': 8, 'error.s6.power-theft': 8, 'error.s6.borrowed-power': 8, 'error.s5.thought-theft': 0,
  'error.s4.parasitism': 16, 'error.s4.deferred-thought': 33, 'error.s3.law-deceit': 8, 'error.s3.deep-deception': 8,
  'error.s2.identity-link': 8, 'error.s2.fate-assumption': 8,
};
function fixture(promoted = false): TimeWormProjection {
  const actions = promoted ? [action({ type: 'OBSERVE', caseId: 'delayed-observation' }, '观察原登记室与本次待办', '1行动')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取时之虫成品与专业准备指导', '1行动 · 500便士')];
  return {
    title: '时之虫·错误序列1', characterName: '伊莲', discovered: true, guidanceKnown: promoted, promoted, formulaKnown: false, formula: [],
    story: '指导者介绍独立封存的时之虫成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null, actions, preferredActionId: actions[0]!.id,
    digestion: promoted ? '时之虫扮演0/100，普通完成同样可以报告。' : '命运木马消化100，晋升后须12整周。',
    pollution: 0, risk: TIME_WORM_CONSUMPTION_RISK, acting: 0,
    resources: { health: 40, maxHealth: 100, mind: 100, maxMind: 100, spirituality: 90, maxSpirituality: 120, cash: '472便士', actionsRemaining: 3 },
    injuries: [{ id: 'old-light-1', severity: 'LIGHT', treated: false }, { id: 'old-light-2', severity: 'LIGHT', treated: false }, { id: 'old-heavy', severity: 'HEAVY', treated: false }], injuryRisk: 2, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，姓名、年龄、性格与身体记录保留。', inheritedHistory: [],
    inheritedTools: '十四项原能力与已有掌握保留，原包和旧封签仍各有原主。', insideCase: false,
    environment: '同一登记室、莉娜、维克托与原包各有自己的实际记录。',
    bottles: [1, 2, 3].map(number => ({ id: `time-worm-potion-${number}`, title: `第${number}瓶 · 时之虫成品魔药`,
      source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
      command: { type: 'CONSUME', bottleId: `time-worm-potion-${number}`, confirmed: true } })),
    preparations: TIME_WORM_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null })),
    abilities: promoted ? [...TIME_WORM_INHERITED_ABILITIES.map(item => ({ ...item, mastery: oldMastery[item.id] ?? 0 })),
      ...TIME_WORM_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [],
    life: lifeFixture(),
    encounter: {
      title: '庭院里的陌生对手', story: '登记室外有一名独立成年对手，尚未实际交谈。', status: 'AVAILABLE', inside: false,
      policy: 'INHERITED_ONLY', policyConfirmed: false, scene: createTimeWormScene(), materials: createTimeWormMaterials(),
      enemy: { id: 'TW1-ADRIAN', name: null, age: null, sequence: null, health: 100, mind: 100, spirituality: 120,
        status: 'RESISTING', weaponLocation: 'HAND', powerUses: { BODY_MARK: 0, MENTAL_MARK: 0, FEINT: 0 } },
      actions: [], facts: [],
    },
  };
}
function show(value = fixture(), extra: Partial<TimeWormPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '时之虫目标' });
const resources = () => screen.getAllByRole('region', { name: '时之虫当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '时之虫操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '时之虫其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(YARD|ROOM|ENTRY|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('Time Worm panel: exact resources, finite acquisition and unchanged body', () => {
  it('shows one main step, actual resources and three independent bottles without inventing treatment', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康40/100 · 精神100/100 · 灵性90/120 · 排异0');
    expect(resources().textContent).toContain('472便士 · 本周行动3 · 现有伤势3处 · 累计风险2');
    expect(screen.getByRole('region', { name: '时之虫阶段总览' }).textContent).toContain('专业准备0/3');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所/); expect(view.container.textContent).not.toMatch(editorial);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps existing injury severity, treatment and risk visible', () => {
    const value = fixture(); value.injuries = [{ id: 'unit-old-injury', severity: 'HEAVY', treated: true }]; value.injuryRisk = 9;
    const before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('现有伤势1处 · 累计风险9');
    expect(resources().textContent).toContain('伤势1：重伤 · 已经实际治疗');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('uses only the preferred public action and leaves alternatives collapsed', () => {
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原包与原登记室', '1行动'));
    value.preferredActionId = value.actions[1]!.id; const view = show(value);
    expect(primary().textContent).toContain('核对原包与原登记室');
    expect((screen.getByText('其他操作与普通替代').closest('details') as HTMLDetailsElement).open).toBe(false);
    chooseExtra(value.actions[0]!.id); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('confirms the exact selected original bottle with spent-on-failure costs and no gender transformation', () => {
    const value = fixture(); value.preparedWeek = 138; value.insideCase = true;
    value.bottles[0]!.status = value.bottles[1]!.status = '已交付，尚未服用';
    value.actions = value.bottles.slice(0, 2).map(bottle => action(bottle.command, `独立确认服用${bottle.title}`, '0行动 · 当周准备已付150便士'));
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(disabled(picker())).toBe(false); fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const dialog = openPrimary(); expect(dialog.textContent).toContain('第2瓶独立封存'); expect(dialog.textContent).toContain('当前成功率68%');
    expect(dialog.textContent).toContain('健康−15'); expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向'); expect(dialog.textContent).not.toMatch(/身体会成为|接受身体变化/);
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });

  it('retains the selected original bottle after saved facts change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'time-worm-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<TimeWormPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders all fourteen actual old masteries, one old zero and two new zeros without awards', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(16); expect(value.abilities.slice(0, 14).filter(item => item.mastery === 0)).toHaveLength(1);
    expect(value.abilities.slice(14).map(item => item.mastery)).toEqual([0, 0]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves a custom player name verbatim even when it contains editorial words', () => {
    const value = fixture(); value.characterName = '原创G候选'; value.appearanceRecord = `${value.characterName}保有自己的身份。`;
    value.actions[0]!.label = `请${value.characterName}听取指导`; const view = show(value);
    expect(resources().textContent).toContain('原创G候选'); expect(primary().textContent).toContain('请原创G候选听取指导');
    expect(view.container.textContent).toContain('原创G候选保有自己的身份。');
  });

  it('shows saved failure damage and a spent bottle without a second consumption', () => {
    const value = fixture(), bottle = value.bottles[0]!; value.preparedWeek = 138; value.insideCase = true;
    value.actions = [action(bottle.command, '独立确认服用第1瓶时之虫魔药')];
    const onCommand = vi.fn(), view = render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); view.rerender(<TimeWormPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为命运木马';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<TimeWormPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性90/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('Time Worm panel: confirmation, focus and same-save protection', () => {
  it('traps focus, disables the background and restores the initiating button on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取时之虫成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(disabled(picker())).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回普通生活' }))).toBe(true);
    expect(button.closest('[inert]')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked across identical rerenders, errors and clearing the error', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<TimeWormPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<TimeWormPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it('unlocks only after new committed facts and never automatically submits the next step', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '0便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原包与原登记室', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<TimeWormPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });

  it('invalidates a confirmation if any saved facts or the same action ID command change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), oldConfirm = confirm(dialog), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' };
    view.rerender(<TimeWormPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.click(oldConfirm); expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks all commands and navigation while %s', mode => {
    const value = fixture(), onClose = vi.fn();
    if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null, onClose });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps a disabled action and its current reason visible without dispatch', () => {
    const value = fixture(); value.actions[0]!.enabled = false; value.actions[0]!.reason = '本周行动不足。'; const view = show(value);
    expect(disabled(primary())).toBe(true); expect(primary().getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('本周行动不足。')).toBeTruthy(); fireEvent.click(primary()); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('closes a settled page as navigation only', () => {
    const value = fixture(), before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});


describe('Time Worm panel: independent opponent and ordinary exit', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.title = '艾德里安的庭院争议'; value.encounter.story = '与眼前的独立对手交谈后，再决定是否真实交战。';
    Object.assign(value.encounter.enemy, { name: '艾德里安·凯斯', age: 45, sequence: 1 });
    value.encounter.scene.knownEnemyName = '艾德里安·凯斯'; value.encounter.scene.knownPlayerName = value.characterName;
    value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动', '0行动；开战前明确选择')];
    value.preferredActionId = value.actions[0]!.id; return value;
  }
  it('never reveals the hidden opponent name before actual contact, including confirmation', () => {
    const value = fixture(true); value.life.reflected = true;
    value.actions = [action({ type: 'ENCOUNTER_TALK' }, '沿普通路接近并交谈', '1行动 · 普通步行4米4秒')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '时之虫可选真实交战' }).textContent).toContain('尚未实际交谈');
    expect(view.container.textContent).not.toMatch(/艾德里安|凯斯|45岁|罗温|伊莱亚斯/);
    const dialog = openPrimary(); expect(dialog.textContent).not.toMatch(/艾德里安|凯斯|45岁/);
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_TALK' });
    expect(value).toEqual(before);
  });
  it.each(['INHERITED_ONLY', 'SHORT_TIME_THEFT', 'TIME_RELEASE', 'ALL', 'ORDINARY'] as const)('only confirms the exact %s policy', policy => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('只保存本场策略'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });
  it('shows the contacted independent adult, spent finite marks and physical threat without restoring resources', () => {
    const value = encounter(); value.encounter.materials.weapon.location = 'YARD';
    value.encounter.materials.marks.forEach(mark => { mark.status = 'SPENT'; mark.usedRound = 1; });
    value.encounter.enemy.powerUses.BODY_MARK = 2; value.encounter.enemy.powerUses.MENTAL_MARK = 1;
    value.encounter.enemy.spirituality = 99; value.encounter.scene.visibleBodyLine = false;
    value.encounter.scene.conditionVersion = 2; value.encounter.scene.observedConditionVersion = 1;
    const before = structuredClone(value), view = show(value), region = screen.getByRole('region', { name: '时之虫可选真实交战' });
    expect(region.textContent).toContain('艾德里安·凯斯 · 45岁'); expect(region.textContent).toContain('灵性99/120');
    expect(region.textContent).toContain('当前动作路线被遮挡'); expect(region.textContent).toContain('现场条件版本2；最近实际观察版本1');
    expect(region.textContent).toContain('原印记剩余0/3枚，已耗尽3枚'); expect(region.textContent).toContain('已落在庭院地面');
    expect(region.textContent).toContain('身体标记会造成身体威胁'); expect(region.textContent).toContain('身体与精神后果分别结算');
    expect(region.textContent).toContain('目标余下延迟仍保留'); expect(region.textContent).toContain('30%抵抗');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled(); expect(view.container.textContent).not.toMatch(editorial);
  });
  it('requires separate fight confirmation with saved strategy and real death risk', () => {
    const value = encounter(); value.encounter.policy = 'TIME_RELEASE'; value.encounter.policyConfirmed = true;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '自主承担真实冲突', '1行动；真实伤势与死亡风险')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('艾德里安·凯斯'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(dialog.textContent).toContain('本场策略：先付费短时窃取再尝试释放'); expect(dialog.textContent).toContain('合计14灵性、4精神'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' }); expect(value).toEqual(before);
  });
  it('keeps the public four-metre zero-action exit available without navigation or healing', () => {
    const value = encounter(); value.resources!.actionsRemaining = 0; value.resources!.spirituality = 7;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '沿普通路和平离开', '0行动、4米4秒')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(primary())).toBe(false);
    const dialog = openPrimary(); expect(dialog.textContent).toContain('0行动、4米4秒'); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' }); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('Time Worm panel: retained body and scarce ordinary resources', () => {
  it('does not erase a heavy injury when the saved health number is 100', () => {
    const value = fixture(); value.resources!.health = 100;
    const before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康100/100'); expect(resources().textContent).toContain('现有伤势3处 · 累计风险2');
    expect(resources().textContent).toContain('伤势3：重伤 · 尚未治疗'); expect(resources().textContent).toContain('不代表既有伤势已经消失');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('shows the retained source site, nine energy and 0/0/1 seals without reopening the paid carry', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('原登记室、原人和旧物当前记录').closest('details')!; fold.open = true;
    const region = within(fold).getByRole('region', { name: '原登记室当前状态' });
    expect(region.textContent).toContain('本人当前在登记室外，精力9/100，累计普通步行86米，现场时钟745秒');
    expect(region.textContent).toContain('莉娜 · 39岁，当前在登记室外，独立精力96/100');
    expect(region.textContent).toContain('维克托 · 43岁，当前在登记室外，独立精力88/100');
    expect(region.textContent).toContain('唯一原包数量1'); expect(region.textContent).toContain('累计实际搬运8米');
    expect(region.textContent).toContain('旧搬运义务已经完成，原报酬已实付本人12便士，暂存0便士');
    expect(region.textContent).toContain('第1枚余量0'); expect(region.textContent).toContain('第2枚余量0'); expect(region.textContent).toContain('第3枚余量1');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('confirms paid energy recovery only from the actual public action and never refills on opening', () => {
    const value = fixture(true); value.actions = [action({ type: 'RECOVER_ENERGY' }, '在室外付费休息恢复精力', '1行动 · 15便士 · 实际60秒 · 精力+20，上限100')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('15便士'); expect(dialog.textContent).toContain('60秒');
    expect(value.life.site.playerEnergy).toBe(9); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RECOVER_ENERGY' }); expect(value).toEqual(before);
  });
  it('keeps only one primary and at most two cleanup choices visible', () => {
    const value = fixture(true);
    value.actions = [action({ type: 'OBSERVE', caseId: 'delayed-observation' }, '观察本次原场地'),
      action({ type: 'STOP_METHOD' }, '停止本次方法'), action({ type: 'EXIT_ROOM' }, '普通离场'),
      action({ type: 'ABORT' }, '中止本次练习'), action({ type: 'RECOVER_ENERGY' }, '付费恢复精力')];
    value.actions.slice(1).forEach(item => { item.cleanup = true; }); value.preferredActionId = value.actions[0]!.id;
    const view = show(value);
    expect(within(screen.getByRole('region', { name: '当前主要操作' })).getAllByRole('button')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: '恢复与收尾' })).getAllByRole('button')).toHaveLength(2);
    expect((screen.getByText('其他操作与普通替代').closest('details') as HTMLDetailsElement).open).toBe(false);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('treats a nullable close callback as unavailable navigation', () => {
    const view = show(fixture(), { onClose: null });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(view.onCommand).not.toHaveBeenCalled();
  });
});

function lifeFixture(): TimeWormProjection['life'] {
  const site = createFateTrojanSiteState();
  Object.assign(site, { introducedWeek: 119, introducedDate: { epoch: 'FIFTH_EPOCH', year: 1351, month: 10, day: 2 }, clockSeconds: 745, playerLocation: 'OUTSIDE', playerTravelMetres: 86, playerEnergy: 9 });
  Object.assign(site.lina, { location: 'OUTSIDE', energy: 96, travelMetres: 4 });
  Object.assign(site.victor, { location: 'OUTSIDE', energy: 88, travelMetres: 12 });
  Object.assign(site.cabinet, { playerOpenings: 1, ownerOpenings: 1 });
  Object.assign(site.parcel, { location: 'OUTSIDE', ordinaryMetres: 8, carriedBy: 'PLAYER' });
  Object.assign(site.fate, { debtor: 'PLAYER', status: 'COMPLETED', escrowPennies: 0, benefitRecipient: 'PLAYER', paidToPlayer: 12, ownerRelieved: true, incurredHealth: 5, incurredEnergy: 5 });
  site.seals = (['identity-link', 'fate-assumption', 'revoked-link'] as const).map((caseId, index) => ({ id: `FT2-SEAL:${caseId}`, caseId, ownerId: 'FT2-LINA', quantity: 1,
    charges: index === 2 ? 1 : 0, location: 'DESK', paidPennies: 20, preparedWeek: 121 + index }));
  return {
    title: '原登记室、一次待执行查看与三秒时间', story: '只改变同一成人的一次尚未执行动作。', source: '原登记室、莉娜、维克托和唯一原包保留。',
    environment: '登记桌到室外4米，每人的普通步行各付实际时间与精力。', activeCase: null, inside: false, insideCase: false, reflected: false, preferredActionId: null,
    clockSeconds: 745, elapsedSeconds: 0, playerLocation: 'OUTSIDE', playerTravelMetres: 0, linaTravelMetres: 0, victorTravelMetres: 0,
    site, declaration: null, pending: null, pendingUsable: false, pendingRemainingSeconds: 0, targetRemainingSeconds: 0, currentAttempt: null,
    cases: ([['delayed-observation', '一次待执行查看与三秒延迟'], ['released-interval', '暂存时段与真实比对'], ['withdrawn-delay', '撤回许可与普通离场']] as const)
      .map(([id, title]) => ({ id, title, story: '每次取得当前许可，保留真实等待、费用和普通离场。', observations: [], status: 'AVAILABLE', method: null, result: null, contactOpen: false, returned: false, attempts: [] })),
    ledger: [], actions: [],
  };
}

function inside(caseId: 'delayed-observation' | 'released-interval' | 'withdrawn-delay' = 'delayed-observation') {
  const value = fixture(true), life = value.life; value.insideCase = life.inside = life.insideCase = true;
  life.activeCase = caseId; life.playerLocation = 'DESK'; life.clockSeconds = 900; life.elapsedSeconds = 155;
  life.playerTravelMetres = life.linaTravelMetres = 4;
  Object.assign(life.site, { clockSeconds: 900, playerLocation: 'DESK', playerEnergy: 25, playerTravelMetres: 90 });
  Object.assign(life.site.lina, { location: 'DESK', energy: 92, travelMetres: 8 });
  const use = (): NonNullable<TimeWormProjection['life']['currentAttempt']>['theft'] => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' });
  const declaration: NonNullable<TimeWormProjection['life']['declaration']> = {
    id: `unit-look-${caseId}-1`, caseId, attempt: 1, actionId: 'unit-look-action-1', targetId: 'FT2-VICTOR', parcelId: 'FT2-PARCEL', action: 'LOOK_AT_ORIGINAL_LABEL',
    state: 'DELAYED', declaredAt: 898, baselineDueAt: 899, delayStartedAt: 900, dueAt: 903, executedAt: null, cancelledAt: null, delayedSeconds: 0,
  };
  const attempt: NonNullable<TimeWormProjection['life']['currentAttempt']> = {
    week: 140, method: 'ABILITY', closed: false, result: 'NONE', elapsedSeconds: 10, playerTravelMetres: 4, linaTravelMetres: 4, victorTravelMetres: 0,
    playerEnergySpent: 4, linaEnergySpent: 4, victorEnergySpent: 1, penniesSpent: 20, spiritualitySpent: 8, mindSpent: 2,
    permission: { owner: 'GRANTED', observer: 'GRANTED', ability: 'GRANTED' }, permissionVersion: 3, siteAtStart: lifeFixture().site,
    approached: true, baselineAt: 897, declaration, comparisonAttempted: false, comparisonAt: null, comparisonTier: null, comparisonBonus: 0,
    stopped: false, exited: false, theft: { ...use(), attempts: 1, successes: 1, tier: 'SUCCESS', state: 'ACTIVE' }, release: use(),
  };
  life.currentAttempt = attempt; life.declaration = declaration;
  life.pending = { caseId, declarationId: declaration.id, createdAt: 900, expiresAt: 903, permissionVersion: 3, state: 'STORED', bonus: 8 };
  life.pendingUsable = true; life.pendingRemainingSeconds = 3; life.targetRemainingSeconds = 3;
  const current = life.cases.find(entry => entry.id === caseId)!; current.status = 'ACTIVE'; current.method = 'ABILITY'; current.contactOpen = true; current.attempts = [attempt];
  value.actions = [action({ type: 'TIME_RELEASE' }, '尝试释放本人未用时段', '6灵性 · 2精神 · 实际1秒')]; value.preferredActionId = value.actions[0]!.id;
  return value;
}

describe('Time Worm panel: declared look, three seconds and actual application', () => {
  it('shows an actual three-second target delay separately from the unspent own reserve', () => {
    const value = inside(), before = structuredClone(value), view = show(value);
    const timing = screen.getByRole('region', { name: '当前时钟与待执行查看' }), reserve = screen.getByRole('region', { name: '暂存时段与实际应用' });
    expect(timing.textContent).toContain('现场时钟900秒'); expect(timing.textContent).toContain('仍在实际等待');
    expect(timing.textContent).toContain('从900秒开始，原定到903秒'); expect(timing.textContent).toContain('目标还须等待3秒');
    expect(reserve.textContent).toContain('已暂存，尚未释放；还剩3秒'); expect(reserve.textContent).toContain('实际应用0次');
    expect(reserve.textContent).toContain('释放成功本身不算应用'); expect(reserve.textContent).toContain('到期的那一刻已无帮助');
    expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before); expect(view.container.textContent).not.toMatch(editorial);
    const dialog = openPrimary(); expect(dialog.textContent).toContain('本次消耗6灵性、2精神'); expect(dialog.textContent).toContain('比对结束严格早于到期');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'TIME_RELEASE' }); expect(value).toEqual(before);
  });
  it('does not tick local scene time or expire a reserve because browser wall time passes', () => {
    vi.useFakeTimers();
    try {
      const value = inside(), before = structuredClone(value), view = show(value); vi.advanceTimersByTime(10_000);
      expect(screen.getByRole('region', { name: '当前时钟与待执行查看' }).textContent).toContain('现场时钟900秒');
      expect(screen.getByRole('region', { name: '暂存时段与实际应用' }).textContent).toContain('还剩3秒');
      expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    } finally { vi.useRealTimers(); }
  });
  it('shows a pending ordinary declaration without inventing stolen time or past execution', () => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    Object.assign(life.declaration!, { state: 'PENDING', delayStartedAt: null, dueAt: 901 });
    Object.assign(attempt.theft, { attempts: 0, successes: 0, tier: null, state: 'NONE' });
    life.pending = null; life.pendingUsable = false; life.pendingRemainingSeconds = life.targetRemainingSeconds = 0;
    value.actions = [action({ type: 'SHORT_TIME_THEFT' }, '只对这一次待办尝试短时窃取', '8灵性 · 2精神 · 实际1秒')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), timing = screen.getByRole('region', { name: '当前时钟与待执行查看' });
    expect(timing.textContent).toContain('已声明，尚未查看'); expect(timing.textContent).toContain('尚未发生能力延迟');
    expect(screen.getByRole('region', { name: '暂存时段与实际应用' }).textContent).toContain('没有尚未用掉的暂存时段');
    const dialog = openPrimary(); expect(dialog.textContent).toContain('一次声明只尝试一次'); expect(dialog.textContent).toContain('失败没有暂存时段');
    expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it.each(['exact-expiry', 'last-second', 'withdrawn', 'stopped', 'mismatched-declaration'] as const)('does not offer an unusable %s reserve as actual help', reason => {
    const value = inside('released-interval'), life = value.life;
    life.pending!.state = 'RELEASED'; Object.assign(life.currentAttempt!.release, { attempts: 1, successes: 1, tier: 'SUCCESS', state: 'ACTIVE' });
    life.pendingUsable = false;
    if (reason === 'exact-expiry') { life.clockSeconds = 903; life.pendingRemainingSeconds = life.targetRemainingSeconds = 0; }
    if (reason === 'last-second') { life.clockSeconds = 902; life.pendingRemainingSeconds = life.targetRemainingSeconds = 1; }
    if (reason === 'withdrawn') life.currentAttempt!.permission.ability = 'WITHDRAWN';
    if (reason === 'stopped') life.currentAttempt!.stopped = true;
    if (reason === 'mismatched-declaration') life.pending!.declarationId = 'different-original-declaration';
    const before = structuredClone(value), view = show(value), reserve = screen.getByRole('region', { name: '暂存时段与实际应用' });
    expect(reserve.textContent).not.toContain('当前可用在下一次真实标签比对'); expect(reserve.textContent).not.toContain('当前可尝试释放');
    expect(reserve.textContent).toContain('实际应用0次'); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('records a failed actual comparison as used help without removing the remaining target delay', () => {
    const value = inside('released-interval'), life = value.life, attempt = life.currentAttempt!;
    life.clockSeconds = 902; life.site.clockSeconds = 902; life.targetRemainingSeconds = 1; life.declaration!.delayedSeconds = 2;
    life.pending = null; life.pendingUsable = false; life.pendingRemainingSeconds = 0;
    Object.assign(attempt.release, { attempts: 1, successes: 1, effects: 1, tier: 'SUCCESS', state: 'APPLIED' });
    Object.assign(attempt, { comparisonAttempted: true, comparisonAt: 902, comparisonTier: 'FAILURE', comparisonBonus: 8, spiritualitySpent: 14, mindSpent: 4, playerEnergySpent: 5 });
    value.actions = [action({ type: 'WAIT_1' }, '真实等待余下1秒', '0行动 · 1秒')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), reserve = screen.getByRole('region', { name: '暂存时段与实际应用' });
    expect(reserve.textContent).toContain('暂存时段释放：成功，已经实际应用，实际应用1次');
    expect(reserve.textContent).toContain('本人实际比对：失败，实际帮助8点，于902秒完成');
    expect(screen.getByRole('region', { name: '当前时钟与待执行查看' }).textContent).toContain('目标还须等待1秒');
    expect(value.abilities.at(-1)!.mastery).toBe(0); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('distinguishes expired unspent time from the target actually executing after its delay', () => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    life.clockSeconds = 903; life.pending = null; life.pendingUsable = false; life.pendingRemainingSeconds = life.targetRemainingSeconds = 0;
    life.declaration!.delayedSeconds = 3; attempt.theft.state = 'EXPIRED';
    value.actions = [action({ type: 'EXECUTE_LOOK' }, '维克托现在普通查看原标签', '0行动 · 1精力 · 1秒')]; value.preferredActionId = value.actions[0]!.id;
    const onCommand = vi.fn(), view = render(<TimeWormPanel value={value} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '暂存时段与实际应用' }).textContent).toContain('已经到期，实际应用0次');
    expect(screen.getByRole('region', { name: '当前时钟与待执行查看' }).textContent).toContain('延迟已到点，尚待普通执行');
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    Object.assign(saved.life.declaration!, { state: 'EXECUTED', executedAt: 904 });
    Object.assign(saved.life.currentAttempt!.theft, { state: 'APPLIED', effects: 1 }); saved.life.clockSeconds = 904;
    view.rerender(<TimeWormPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '当前时钟与待执行查看' }).textContent).toContain('已于904秒实际完成查看');
    expect(screen.getByRole('region', { name: '暂存时段与实际应用' }).textContent).toContain('短时窃取：成功，已经实际应用，实际应用1次');
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'EXECUTE_LOOK' });
  });
  it('preserves paid failure and offers only the public ordinary fallback', () => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    Object.assign(attempt.theft, { successes: 0, tier: 'FAILURE', state: 'FAILED' });
    Object.assign(life.declaration!, { state: 'PENDING', delayStartedAt: null, dueAt: 900 });
    life.pending = null; life.pendingUsable = false; life.pendingRemainingSeconds = life.targetRemainingSeconds = 0;
    value.actions = [action({ type: 'EXECUTE_LOOK' }, '维克托普通查看', '0行动 · 1精力 · 1秒')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), reserve = screen.getByRole('region', { name: '暂存时段与实际应用' });
    expect(reserve.textContent).toContain('短时窃取：失败，判定失败，实际应用0次'); expect(reserve.textContent).toContain('本次已付20便士、8灵性、2精神');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'EXECUTE_LOOK' }); expect(value).toEqual(before);
  });
  it.each(['OWNER', 'OBSERVER', 'ABILITY'] as const)('confirms the exact zero-action %s withdrawal without refund or navigation', permission => {
    const value = inside('withdrawn-delay'); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type: 'WITHDRAW_CONSENT', permission }, '撤回本次当前许可', '0行动，不退已付费用')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(disabled(primary())).toBe(false); expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const dialog = openPrimary(); expect(dialog.textContent).toContain('撤回原主查看许可会取消本次查看'); expect(dialog.textContent).toContain('目标仍须等到原到期时间');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WITHDRAW_CONSENT', permission }); expect(value).toEqual(before); expect(onClose).not.toHaveBeenCalled();
  });
  it('shows owner cancellation with elapsed delay retained and no mastery application', () => {
    const value = inside('withdrawn-delay'), life = value.life, attempt = life.currentAttempt!;
    life.clockSeconds = 901; Object.assign(life.declaration!, { state: 'CANCELLED', cancelledAt: 901, delayedSeconds: 1 });
    attempt.permission.owner = 'WITHDRAWN'; attempt.theft.state = 'STOPPED'; life.pending = null; life.pendingUsable = false; life.pendingRemainingSeconds = life.targetRemainingSeconds = 0;
    const before = structuredClone(value), view = show(value), timing = screen.getByRole('region', { name: '当前时钟与待执行查看' });
    expect(timing.textContent).toContain('本次查看已取消'); expect(timing.textContent).toContain('已流逝的1秒与原费用保留');
    expect(screen.getByRole('region', { name: '暂存时段与实际应用' }).textContent).toContain('已经停止，实际应用0次');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['WAIT_1', 'WAIT_3', 'CANCEL_LOOK', 'STOP_METHOD', 'EXIT_ROOM', 'LEAVE', 'ABORT'] as const)('submits the exact public %s action without moving bodies or creating actions', type => {
    const value = inside('withdrawn-delay'); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type }, '按实际条件普通收尾', '0行动，保留真实时间与步行')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type }); expect(value).toEqual(before);
  });
  it('does not present a closed attempt as current permission or a live reserve', () => {
    const value = inside(), life = value.life; life.activeCase = null; life.inside = life.insideCase = value.insideCase = false;
    life.currentAttempt!.closed = true; life.cases[0]!.contactOpen = false; life.pendingUsable = false;
    const view = show(value), permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('本案曾明确同意，当前无生效许可'); expect(permissions.textContent).not.toContain('当前明确同意');
    expect(screen.getByRole('region', { name: '暂存时段与实际应用' }).textContent).not.toContain('当前可尝试释放'); expect(view.onCommand).not.toHaveBeenCalled();
  });
});
