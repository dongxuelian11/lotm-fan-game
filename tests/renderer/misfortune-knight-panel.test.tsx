/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MisfortuneKnightPanel, type MisfortuneKnightPanelProps } from '../../src/renderer/MisfortuneKnightPanel.js';
import { originalConcealmentServant } from '../domain/misfortune-knight-directed-helper.js';
import { projectMisfortuneKnight } from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_ABILITIES, MISFORTUNE_KNIGHT_CONSUMPTION_RISK, MISFORTUNE_KNIGHT_INHERITED_ABILITIES, MISFORTUNE_KNIGHT_PREPARATIONS } from '../../src/domain/misfortune-knight/content.js';
import type { MisfortuneKnightAction, MisfortuneKnightCommand, MisfortuneKnightProjection } from '../../src/domain/misfortune-knight/types.js';

afterEach(cleanup);

// Explicit renderer-only UNIT inputs, starting from the migrated original living
// boundary. These are presentation projections, not valid saves or a natural run.
function action(command: MisfortuneKnightCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): MisfortuneKnightAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let original: MisfortuneKnightProjection | undefined;
function fixture(promoted = false): MisfortuneKnightProjection {
  const value = structuredClone(original ??= projectMisfortuneKnight(originalConcealmentServant()));
  Object.assign(value, {
    title: '厄难骑士·黑夜序列1', characterName: '莉娜', discovered: true, guidanceKnown: promoted, promoted,
    story: '指导者介绍独立封存的厄难骑士成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null,
    digestion: promoted ? '厄难骑士扮演0/100，普通完成同样可以报告。' : '隐秘之仆消化100，晋升后须12整周。',
    pollution: 0, risk: MISFORTUNE_KNIGHT_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，姓名、年龄、性格与身体记录保留。', inheritedHistory: [],
    inheritedTools: '同一原卷叶封存，已派出12次并召回12次；旧原纸仍在原桌。', insideCase: false,
    environment: '原房间、艾琳和米洛及原物各有自己的实际记录。',
  } satisfies Partial<MisfortuneKnightProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `misfortune-knight-potion-${number}`, title: `第${number}瓶 · 厄难骑士成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `misfortune-knight-potion-${number}`, confirmed: true } }));
  value.preparations = MISFORTUNE_KNIGHT_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  value.abilities = promoted ? [...MISFORTUNE_KNIGHT_INHERITED_ABILITIES.map((item, index) => ({ ...item, mastery: index < 5 ? 0 : 8 })),
    ...MISFORTUNE_KNIGHT_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [action({ type: 'OBSERVE', caseId: 'pending-parcel' }, '观察尚未滑动的原盒', '1行动')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取厄难骑士成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  return value;
}
function show(value = fixture(), extra: Partial<MisfortuneKnightPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '厄难骑士目标' });
const resources = () => screen.getAllByRole('region', { name: '厄难骑士当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '厄难骑士操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '厄难骑士其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(YARD|ROOM|EXIT|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('Misfortune Knight panel: exact resources, finite acquisition and unchanged body', () => {
  it('shows one main step, actual resources and three independent bottles without inventing treatment', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '厄难骑士阶段总览' }).textContent).toContain('专业准备0/3');
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
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' }, '核对待发生动作与护持边界', '1行动'));
    value.preferredActionId = value.actions[1]!.id; const view = show(value);
    expect(primary().textContent).toContain('核对待发生动作与护持边界');
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
    expect(dialog.textContent).toContain('健康−15精神−25排异+30'); expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('性别、姓名、年龄、性格与取向不变'); expect(dialog.textContent).not.toMatch(/身体会成为|接受身体变化/);
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });

  it('retains the selected original bottle after saved facts change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'misfortune-knight-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<MisfortuneKnightPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders all eighteen old masteries, five old zeros and two new zeros without awards', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(20); expect(value.abilities.slice(0, 18).filter(item => item.mastery === 0)).toHaveLength(5);
    expect(value.abilities.slice(18).map(item => item.mastery)).toEqual([0, 0]);
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
    value.actions = [action(bottle.command, '独立确认服用第1瓶厄难骑士魔药')];
    const onCommand = vi.fn(), view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); view.rerender(<MisfortuneKnightPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为隐秘之仆';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<MisfortuneKnightPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('Misfortune Knight panel: confirmation, focus and same-save protection', () => {
  it('traps focus, disables the background and restores the initiating button on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取厄难骑士成品与专业准备指导' }));
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
    const value = fixture(), onCommand = vi.fn(), view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<MisfortuneKnightPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<MisfortuneKnightPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it('unlocks only after new committed facts and never automatically submits the next step', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' }, '核对待发生动作与护持边界', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<MisfortuneKnightPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });

  it('invalidates a confirmation if any saved facts or the same action ID command change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<MisfortuneKnightPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), oldConfirm = confirm(dialog), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' };
    view.rerender(<MisfortuneKnightPanel value={saved} busy={false} onCommand={onCommand} />);
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

describe('Misfortune Knight panel: explicit strategy and independent finite battle materials', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动', '0行动；开战前明确选择')];
    value.preferredActionId = value.actions[0]!.id; return value;
  }

  it('shows a distinct adult opponent, explicit unconfirmed strategy and no free plate', () => {
    const value = encounter(), before = structuredClone(value), view = show(value);
    const region = screen.getByRole('region', { name: '厄难骑士可选真实交战' });
    expect(region.textContent).toContain('奥尔登·沃德 · 46岁'); expect(region.textContent).toContain('艾琳和米洛在本场之外');
    expect(region.textContent).toContain('尚未购买战场木板'); expect(region.textContent).toContain('当前策略：只用已学能力');
    expect(region.textContent).toContain('等待本场明确选择'); expect(region.textContent).toContain('普通出口开放');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' });
    expect(value).toEqual(before); expect(view.container.textContent).not.toMatch(editorial);
  });

  it.each(['INHERITED_ONLY', 'GUIDED_MISHAP', 'BOUNDED_NIGHT_GUARD', 'ALL', 'ORDINARY'] as const)('dispatches the exact %s policy only after its own confirmation', policy => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('只保存本场策略'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });

  it('shows actual purchased plate wear and depleted four-charge rod without repairing either', () => {
    const value = encounter(), e = value.encounter;
    e.materials.plate = { id: 'MK1-BATTLE-WOOD-PLATE', sourceId: 'MK1-BATTLE-WOOD-SHOP-1', owner: 'PLAYER', paidPennies: 40,
      purchasedWeek: 135, location: 'RETURN_TRAY', integrity: 25, initialIntegrity: 65, wearPerAttempt: 10 };
    e.materials.weapon.charge = 0; e.materials.weapon.location = 'YARD'; e.enemy.powerUses.DARK_BOLT = 4;
    const before = structuredClone(value), view = show(value);
    const materials = screen.getByRole('region', { name: '本场独立木板' });
    expect(materials.textContent).toContain('第135周实付40便士'); expect(materials.textContent).toContain('已经实放返还盘');
    expect(materials.textContent).toContain('完整度25/65'); expect(materials.textContent).toContain('换轮不免费修复');
    const rod = screen.getByRole('region', { name: '对手原杆与有限资源' });
    expect(rod.textContent).toContain('可见冲击储能0/4'); expect(rod.textContent).toContain('已落在石院地面');
    expect(rod.textContent).toContain('暗色冲击4次'); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('distinguishes a blocked or invisible line from a valid pending attack and keeps mental pressure outside the guard', () => {
    const value = encounter(); value.encounter.scene.visibleBodyLine = false; value.encounter.scene.floorLineClear = false;
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '战场位置与普通出口' }).textContent).toContain('身体冲击路线当前不可见；落点空地当前受阻');
    const powers = screen.getByRole('region', { name: '实战的有限能力' });
    expect(powers.textContent).toContain('6灵性、2精神、意志18'); expect(powers.textContent).toContain('8灵性、3精神、知识18');
    expect(powers.textContent).toContain('30秒内只削弱一次待发身体冲击30，不能挡住精神压力');
    expect(powers.textContent).toContain('失败、空窗口、失效或未实际应用都不增加掌握');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires a separate fight confirmation with the saved policy and actual death risk', () => {
    const value = encounter(); value.encounter.policy = 'BOUNDED_NIGHT_GUARD'; value.encounter.policyConfirmed = true;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '自主承担真实冲突', '1行动；真实伤势与死亡风险')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('本场明确选择已经保存');
    const dialog = openPrimary(); expect(dialog.textContent).toContain('奥尔登·沃德'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(dialog.textContent).toContain('本场策略：允许隐夜护持'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' }); expect(value).toEqual(before);
  });

  it('still exposes the public zero-action ordinary return while inside, without free resource recovery', () => {
    const value = encounter(); value.resources!.actionsRemaining = 0; value.resources!.spirituality = 7;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '带回原物并和平离开', '0行动、4米4秒')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(primary())).toBe(false);
    const dialog = openPrimary(); expect(dialog.textContent).toContain('0行动、4米4秒');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('Misfortune Knight panel: same room, current consent and actual future operations', () => {
  function inside(caseId: 'pending-parcel' | 'personal-dark-guard' | 'withdrawn-path' = 'pending-parcel') {
    const value = fixture(true), p = value.life.practice; value.life.insideCase = value.insideCase = true;
    p.activeCase = caseId; p.playerLocation = 'ROOM'; p.playerOffsetMetres = 4; p.playerTravelMetres = 48; p.elapsedSeconds = 60;
    const current = value.life.cases.find(item => item.id === caseId)!;
    current.status = 'ACTIVE'; current.contactOpen = true; current.permission = { owner: 'GRANTED', technician: 'GRANTED', selfPower: 'GRANTED' };
    value.life.currentConsents = [{ id: 'CS2-ERIN', consented: true }, { id: 'MK1-MILO44', consented: true }, { id: 'PLAYER', consented: true }];
    value.actions = [action({ type: 'RETURN_BOX' }, '亲手归还艾琳的原盒')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    return value;
  }

  it('keeps the three permissions separate and shows both adults at the clear exit', () => {
    const value = inside(), current = value.life.cases[0]!;
    current.permission.owner = 'DECLINED'; value.life.currentConsents[0]!.consented = false;
    const before = structuredClone(value), view = show(value), permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('艾琳 · 38岁；米洛 · 44岁');
    expect(permissions.textContent).toContain('两人在6米出口外的安全处');
    expect(permissions.textContent).toContain('艾琳的原盒与场地：已拒绝');
    expect(permissions.textContent).toContain('米洛的本次工具用途：当前明确同意');
    expect(permissions.textContent).toContain('本人使用自身能力：当前明确同意');
    expect(permissions.textContent).toContain('本人愿意施术不能代替物主或技师同意');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('never presents an old closed permission as current consent', () => {
    const value = fixture(true); value.life.cases[0]!.permission = { owner: 'GRANTED', technician: 'GRANTED', selfPower: 'GRANTED' };
    value.life.currentConsents = []; value.life.cases[0]!.contactOpen = false; show(value);
    const permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('本案曾明确同意，当前无生效许可'); expect(permissions.textContent).not.toContain('：当前明确同意');
  });

  it('shows the original box, actual tray position, worn plate and an unreleased weight without a free movement', () => {
    const value = inside('personal-dark-guard'), p = value.life.practice;
    p.boxHolder = 'TABLE'; p.boxOffsetMetres = 2; p.tray.location = 'ROOM'; p.plate.holder = 'PLAYER';
    p.plate.integrity = 55; p.plate.wear = 10; p.rig.borrowed = true; p.rig.weightState = 'ARMED';
    const before = structuredClone(value), view = show(value);
    const objects = screen.getByRole('region', { name: '原托盘木板与待发动作' });
    expect(objects.textContent).toContain('同一托盘在原房间2米处'); expect(objects.textContent).toContain('同一木板由本人实际手持，完整度55/65');
    expect(objects.textContent).toContain('已磨损10，实际承接轻触0次'); expect(objects.textContent).toContain('校准轻锤：已架起，尚未释放');
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('同一原盒在原桌上，距原起点2米');
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('室内位置距起点4米');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled(); expect(view.container.textContent).not.toMatch(editorial);
  });

  it('shows one guided future catch with its actual 30-second window and no automatic catch or mastery', () => {
    const value = inside(), p = value.life.practice; p.elapsedSeconds = 80; p.boxHolder = 'BOARD'; p.tray.location = 'ROOM';
    p.rig.tilted = p.rig.parcelPending = true;
    p.pendingGuided = { caseId: 'pending-parcel', createdAt: 70, expiresAt: 100, permissionRevision: 3, bonus: 10 };
    value.life.cases[0]!.attempts = [{ invitedWeek: 132, method: 'ABILITY', outcome: 'SUCCESS', operationOutcome: null, receipts: [] }];
    const before = structuredClone(value), view = show(value), windows = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(windows.textContent).toContain('厄势导引还剩20秒'); expect(windows.textContent).toContain('4米内一次尚未发生的原盒普通接取加10');
    expect(windows.textContent).toContain('独立普通接取：尚未进行'); expect(windows.textContent).toContain('施放本身不完成接取或释放，也不增加掌握');
    expect(value.abilities.slice(18).map(item => item.mastery)).toEqual([0, 0]); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows guard only for a real held plate and armed light impact, with existing wear retained', () => {
    const value = inside('personal-dark-guard'), p = value.life.practice;
    p.elapsedSeconds = 90; p.plate.holder = 'PLAYER'; p.plate.integrity = 55; p.plate.wear = 10; p.rig.weightState = 'ARMED';
    p.pendingGuard = { caseId: 'personal-dark-guard', createdAt: 80, expiresAt: 110, permissionRevision: 3, reduction: 10 };
    const before = structuredClone(value), view = show(value), windows = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(windows.textContent).toContain('隐夜护持还剩20秒，等待一次真实轻触');
    expect(windows.textContent).toContain('8灵性、3精神，知识18，并让同一木板磨损10');
    expect(windows.textContent).toContain('随后一次对手持木板的10刻度轻触');
    expect(value.life.practice.plate.impacts).toBe(0); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it.each(['expired', 'exit', 'blocked', 'withdrawn', 'released', 'returned-plate'] as const)('does not describe an unusable %s guard window as active', reason => {
    const value = inside('personal-dark-guard'), p = value.life.practice;
    p.elapsedSeconds = 90; p.plate.holder = 'PLAYER'; p.rig.weightState = 'ARMED';
    p.pendingGuard = { caseId: 'personal-dark-guard', createdAt: 80, expiresAt: 110, permissionRevision: 3, reduction: 10 };
    if (reason === 'expired') p.elapsedSeconds = 110;
    if (reason === 'exit') p.playerOffsetMetres = 6;
    if (reason === 'blocked') value.life.originals.room.doorBlocked = true;
    if (reason === 'withdrawn') { value.life.cases[1]!.permission.selfPower = 'WITHDRAWN'; value.life.currentConsents[2]!.consented = false; }
    if (reason === 'released') p.rig.weightState = 'RELEASED';
    if (reason === 'returned-plate') p.plate.holder = 'OWNER';
    const before = structuredClone(value), view = show(value);
    const windows = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(windows.textContent).toContain('当前没有可应用的隐夜护持窗口'); expect(windows.textContent).not.toContain('隐夜护持还剩');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps failed attempts, withdrawal, wear and ordinary cleanup available without navigating away', () => {
    const value = inside('withdrawn-path'), current = value.life.cases[2]!, p = value.life.practice;
    current.permission.owner = 'WITHDRAWN'; value.life.currentConsents[0]!.consented = false;
    current.attempts = [{ invitedWeek: 132, method: 'ABILITY', outcome: 'FAILURE', operationOutcome: null, receipts: [] },
      { invitedWeek: 133, method: 'ORDINARY', outcome: null, operationOutcome: 'SUCCESS', receipts: [] }];
    p.plate.integrity = 45; p.plate.wear = 20; p.pendingGuard = null;
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('艾琳的原盒与场地：已经撤回');
    expect(screen.getByText('此前尝试与已付代价').closest('details')!.textContent).toContain('第132周：曾选择能力帮助；能力失败');
    expect(screen.getByRole('region', { name: '原托盘木板与待发动作' }).textContent).toContain('完整度45/65');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RETURN_BOX' });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it('summarizes only actual paid receipt deltas, travel and wood wear', () => {
    const value = inside('personal-dark-guard'), current = value.life.cases[1]!, originals = structuredClone(value.life.originals);
    const base: MisfortuneKnightProjection['life']['ledger'][number] = {
      week: 132, date: { epoch: 'FIFTH_EPOCH', year: 1351, month: 12, day: 25 }, revision: 580, randomCursor: 350, randomBefore: null, randomAfter: null,
      checkBase: null, check: null, command: { type: 'INVITE', caseId: 'personal-dark-guard', method: 'ABILITY' }, outcome: null,
      before: { health: 98, mind: 98, spirituality: 120, cash: 100, actions: 2 }, after: { health: 98, mind: 98, spirituality: 120, cash: 80, actions: 1 },
      elapsedSeconds: 5, playerWalkedMetres: 0, boxMovedMetres: 0, plateWear: 0, releasedForce: 0, absorbedForce: 0,
      originalsBefore: originals, originalsAfter: structuredClone(originals), companion: { source: 'SW5-LEAF-1', status: 'SEALED', acquiredWeek: 45, invitedWeek: 53, releases: 1, deployments: 12, recalls: 12 },
    };
    const paid = structuredClone(base); paid.command = { type: 'BOUNDED_NIGHT_GUARD' }; paid.before = structuredClone(base.after);
    paid.after = { ...paid.before, spirituality: 112, mind: 95 }; paid.plateWear = 10; paid.elapsedSeconds = 2;
    current.attempts = [{ invitedWeek: 132, method: 'ABILITY', outcome: 'FAILURE', operationOutcome: null, receipts: [base, paid] }];
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '厄难骑士生活练习' }).textContent).toContain('本次已付：1行动、20便士、8灵性、3精神、0健康；木板磨损10');
    expect(screen.getByRole('region', { name: '厄难骑士生活练习' }).textContent).toContain('本人实走0米、原盒实移0米，经过7秒');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
});
