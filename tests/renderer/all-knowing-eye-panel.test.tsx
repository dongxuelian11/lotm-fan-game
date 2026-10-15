/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AllKnowingEyePanel, type AllKnowingEyePanelProps } from '../../src/renderer/AllKnowingEyePanel.js';
import { originalWisdomAngel } from '../domain/all-knowing-eye-directed-helper.js';
import { projectAllKnowingEye } from '../../src/domain/all-knowing-eye/index.js';
import { ALL_KNOWING_EYE_ABILITIES, ALL_KNOWING_EYE_CONSUMPTION_RISK, ALL_KNOWING_EYE_INHERITED_ABILITIES, ALL_KNOWING_EYE_PREPARATIONS } from '../../src/domain/all-knowing-eye/content.js';
import type { AllKnowingEyeAction, AllKnowingEyeCommand, AllKnowingEyeProjection } from '../../src/domain/all-knowing-eye/types.js';

afterEach(cleanup);

// Explicit renderer-only UNIT inputs, starting from the migrated original living
// boundary. These are presentation projections, not valid saves or a natural run.
function action(command: AllKnowingEyeCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): AllKnowingEyeAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let original: AllKnowingEyeProjection | undefined;
function fixture(promoted = false): AllKnowingEyeProjection {
  const value = structuredClone(original ??= projectAllKnowingEye(originalWisdomAngel()));
  Object.assign(value, {
    title: '全知之眼·白塔序列1', characterName: '莉娜', discovered: true, guidanceKnown: promoted, promoted,
    story: '指导者介绍独立封存的全知之眼成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null,
    digestion: promoted ? '全知之眼扮演0/100，普通完成同样可以报告。' : '智慧天使消化100，晋升后须12整周。',
    pollution: 0, risk: ALL_KNOWING_EYE_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，姓名、年龄、性格与身体记录保留。', inheritedHistory: [],
    inheritedTools: '同两张原纸仍在原桌，示范器剩余0格，原微光片逐件保留。', insideCase: false,
    environment: '同一4米原房间、玛拉与伊蕾娜·韦尔及原物各有自己的实际记录。',
  } satisfies Partial<AllKnowingEyeProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `all-knowing-eye-potion-${number}`, title: `第${number}瓶 · 全知之眼成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `all-knowing-eye-potion-${number}`, confirmed: true } }));
  value.preparations = ALL_KNOWING_EYE_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  const inheritedMastery = originalWisdomAngel().progression.mastery;
  value.abilities = promoted ? [...ALL_KNOWING_EYE_INHERITED_ABILITIES.map(item => ({ ...item, mastery: inheritedMastery[item.id] ?? 0 })),
    ...ALL_KNOWING_EYE_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [action({ type: 'OBSERVE', caseId: 'original-paper-check' }, '观察同两张原纸与本次交接', '1行动')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取全知之眼成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  return value;
}
function show(value = fixture(), extra: Partial<AllKnowingEyePanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '全知之眼目标' });
const resources = () => screen.getAllByRole('region', { name: '全知之眼当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '全知之眼操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '全知之眼其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(YARD|ROOM|EXIT|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('All-Knowing Eye panel: exact resources, finite acquisition and unchanged body', () => {
  it('shows one main step, actual resources and three independent bottles without inventing treatment', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '全知之眼阶段总览' }).textContent).toContain('专业准备0/3');
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
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原纸与原器具来历', '1行动'));
    value.preferredActionId = value.actions[1]!.id; const view = show(value);
    expect(primary().textContent).toContain('核对原纸与原器具来历');
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
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向'); expect(dialog.textContent).not.toMatch(/身体会成为|接受身体变化/);
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });

  it('retains the selected original bottle after saved facts change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'all-knowing-eye-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<AllKnowingEyePanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders all nineteen old masteries, five old zeros and two new zeros without awards', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(21); expect(value.abilities.slice(0, 19).filter(item => item.mastery === 0)).toHaveLength(5);
    expect(value.abilities.slice(19).map(item => item.mastery)).toEqual([0, 0]);
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
    value.actions = [action(bottle.command, '独立确认服用第1瓶全知之眼魔药')];
    const onCommand = vi.fn(), view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); view.rerender(<AllKnowingEyePanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为智慧天使';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<AllKnowingEyePanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('All-Knowing Eye panel: confirmation, focus and same-save protection', () => {
  it('traps focus, disables the background and restores the initiating button on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取全知之眼成品与专业准备指导' }));
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
    const value = fixture(), onCommand = vi.fn(), view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<AllKnowingEyePanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<AllKnowingEyePanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it('unlocks only after new committed facts and never automatically submits the next step', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原纸与原器具来历', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<AllKnowingEyePanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });

  it('invalidates a confirmation if any saved facts or the same action ID command change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<AllKnowingEyePanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), oldConfirm = confirm(dialog), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' };
    view.rerender(<AllKnowingEyePanel value={saved} busy={false} onCommand={onCommand} />);
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

describe('All-Knowing Eye panel: independent opponent, policy and actual ordinary exit', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动', '0行动；开战前明确选择')];
    value.preferredActionId = value.actions[0]!.id; return value;
  }
  it.each(['INHERITED_ONLY', 'BOUNDED_INSIGHT', 'PENDING_FORECAST', 'ALL', 'ORDINARY'] as const)('confirms the exact %s policy without beginning combat', policy => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('只保存本场策略'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });
  it('shows a distinct adult with real depleted rod, obscured line and mental risk', () => {
    const value = encounter(); value.encounter.materials.weapon.charge = 0; value.encounter.materials.weapon.location = 'YARD';
    value.encounter.enemy.powerUses.FLASH = 4; value.encounter.scene.visibleBodyLine = false;
    value.encounter.scene.conditionVersion = 2; value.encounter.scene.observedConditionVersion = 1;
    const before = structuredClone(value), view = show(value), region = screen.getByRole('region', { name: '全知之眼可选真实交战' });
    expect(region.textContent).toContain('埃德温·罗斯 · 47岁'); expect(region.textContent).toContain('玛拉和伊蕾娜·韦尔在本场之外');
    expect(region.textContent).toContain('等待本场明确选择'); expect(region.textContent).toContain('身体冲击路线当前不可见');
    expect(region.textContent).toContain('当前条件版本2；最近实际观察版本1');
    expect(region.textContent).toContain('可见闪光储能0/4'); expect(region.textContent).toContain('已落在石院地面');
    expect(region.textContent).toContain('随后一次可见身体冲击30，不能挡住精神压力');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled(); expect(view.container.textContent).not.toMatch(editorial);
  });
  it('requires a separate fight confirmation with saved strategy and real death risk', () => {
    const value = encounter(); value.encounter.policy = 'PENDING_FORECAST'; value.encounter.policyConfirmed = true;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '自主承担真实冲突', '1行动；真实伤势与死亡风险')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('埃德温·罗斯'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(dialog.textContent).toContain('本场策略：允许先机预判'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' }); expect(value).toEqual(before);
  });
  it('keeps the actual four-metre zero-action leave available while inside without healing or navigation', () => {
    const value = encounter(); value.resources!.actionsRemaining = 0; value.resources!.spirituality = 7;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '沿普通路和平离开', '0行动、4米4秒')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(primary())).toBe(false);
    const dialog = openPrimary(); expect(dialog.textContent).toContain('0行动、4米4秒'); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' }); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('All-Knowing Eye panel: current consent, actual slider and finite saved windows', () => {
  function inside(caseId: 'original-paper-check' | 'pending-slider' | 'changed-conditions' = 'pending-slider') {
    const value = fixture(true), life = value.life; value.insideCase = life.inside = life.insideCase = true;
    life.activeCase = caseId; life.playerLocation = 'TABLE'; life.clockSeconds = 200; life.elapsedSeconds = 82; life.playerTravelMetres = 8;
    life.mara.present = true; life.mara.location = 'TABLE'; life.irena.present = true; life.irena.location = 'TABLE';
    life.papers.forEach(paper => { paper.location = 'PLAYER'; });
    Object.assign(life.rig, { owner: 'PLAYER', purchasedWeek: 132, location: 'TABLE', motion: 'COCKED' });
    const use = () => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' as const, remainingSeconds: 0, conditionVersion: null });
    const attempt: NonNullable<AllKnowingEyeProjection['life']['currentAttempt']> = {
      week: 132, method: 'ABILITY', closed: false, result: 'NONE', elapsedSeconds: 34, playerTravelMetres: 8, maraTravelMetres: 4, irenaTravelMetres: 8,
      spiritualitySpent: 0, mindSpent: 0, permission: { owner: 'GRANTED', technician: 'GRANTED', ability: 'GRANTED' }, permissionVersion: 3,
      sourceRead: true, returnAgreed: true, entered: true, exited: false, papersTaken: true, papersReturned: false, readFirst: true, readSecond: true,
      handoverObserved: true, handoverObservation: '同两张原纸仍由本人持有，玛拉在原桌旁。', handoverAttempted: false, handoverTier: null, handoverVerified: false, manualCompared: false,
      rigPlaced: true, rigReturned: false, sliderCocked: true, observedVersions: [1], catchAttempted: false, catchTier: null, catchSucceeded: false,
      conditionChanged: false, sightlineCleared: false, handStopped: false, sliderRetrieved: false, insight: use(), forecast: use(),
    };
    life.currentAttempt = attempt;
    const current = life.cases.find(item => item.id === caseId)!; current.status = 'ACTIVE'; current.contactOpen = true; current.attempts = [attempt];
    life.pending = { kind: caseId === 'original-paper-check' ? 'INSIGHT' : 'FORECAST', caseId, createdAt: 190, expiresAt: 220, conditionVersion: 1, permissionVersion: 3, bonus: 10 };
    const power = caseId === 'original-paper-check' ? attempt.insight : attempt.forecast;
    Object.assign(power, { attempts: 1, successes: 1, tier: 'SUCCESS', state: 'ACTIVE', remainingSeconds: 20, conditionVersion: 1 });
    value.actions = [action({ type: 'HAND_STOP' }, '普通手动制停滑块', '0行动 · 1秒')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    return value;
  }
  it.each(['original-paper-check', 'pending-slider'] as const)('shows only the genuine pending %s window and no automatic effect or reward', caseId => {
    const value = inside(caseId), before = structuredClone(value), view = show(value);
    const powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain(`${caseId === 'original-paper-check' ? '现场洞察' : '先机预判'}还剩20秒`);
    expect(powers.textContent).toContain('施放本身不完成核验或接取，也不增加掌握'); expect(powers.textContent).toContain('实际应用0次');
    expect(powers.textContent).toContain('后续独立接取：尚未判定'); expect(value.abilities.slice(19).map(item => item.mastery)).toEqual([0, 0]);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['expired', 'too-short', 'changed', 'shuttered', 'withdrawn', 'old-permission', 'exit', 'released', 'not-observed', 'closed'] as const)('does not label an unusable %s prediction active', why => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    if (why === 'expired') life.clockSeconds = 220;
    if (why === 'too-short') life.clockSeconds = 217;
    if (why === 'changed') life.rig.conditionVersion++;
    if (why === 'shuttered') life.rig.sightline = 'SHUTTERED';
    if (why === 'withdrawn') attempt.permission.owner = 'WITHDRAWN';
    if (why === 'old-permission') attempt.permissionVersion++;
    if (why === 'exit') life.playerLocation = 'EXIT';
    if (why === 'released') life.rig.motion = 'STOPPED';
    if (why === 'not-observed') attempt.observedVersions = [];
    if (why === 'closed') attempt.closed = true;
    const before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('当前没有可应用的先机预判窗口'); expect(powers.textContent).not.toContain('先机预判还剩');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('keeps three separate permissions and never presents a closed agreement as fresh consent', () => {
    const value = inside(); value.life.currentAttempt!.closed = true; const view = show(value);
    const permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('玛拉 · 43岁'); expect(permissions.textContent).toContain('伊蕾娜·韦尔 · 41岁');
    expect(within(permissions).getAllByText(/本案曾明确同意，当前无生效许可/)).toHaveLength(3);
    expect(permissions.textContent).not.toContain('：当前明确同意'); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('retains real condition change, withdrawal and cost while allowing ordinary hand stop at zero actions', () => {
    const value = inside('changed-conditions'), life = value.life, attempt = life.currentAttempt!;
    life.rig.direction = 'RIGHT'; life.rig.sightline = 'SHUTTERED'; life.rig.conditionVersion = 2;
    attempt.conditionChanged = true; attempt.permission.owner = 'WITHDRAWN'; attempt.forecast.state = 'INVALIDATED';
    attempt.spiritualitySpent = 8; attempt.mindSpent = 3; life.pending = null; value.resources!.actionsRemaining = 0;
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('原纸与场地许可：已经撤回');
    const rig = screen.getByRole('region', { name: '独立无动力滑块' });
    expect(rig.textContent).toContain('第132周已实付30便士'); expect(rig.textContent).toContain('方向向右，视线已被遮挡，条件版本2');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('条件改变，已经失效');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'HAND_STOP' });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it.each(['BUY_RIG', 'INVITE'] as const)('shows the real %s fee before confirmation and cancel submits nothing', type => {
    const value = fixture(true), command: AllKnowingEyeCommand = type === 'BUY_RIG' ? { type } : { type, caseId: 'original-paper-check', method: 'ORDINARY' };
    value.actions = [action(command, type === 'BUY_RIG' ? '购入独立滑块' : '本次普通邀请', type === 'BUY_RIG' ? '1行动、30便士' : '1行动、10便士')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain(type === 'BUY_RIG' ? '实付30便士、1行动' : '实付10便士、1行动');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled();
  });
});
