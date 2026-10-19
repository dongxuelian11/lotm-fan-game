/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThunderGodPanel, type ThunderGodPanelProps } from '../../src/renderer/ThunderGodPanel.js';
import { originalCatastrophe } from '../domain/thunder-god-directed-helper.js';
import { projectThunderGod } from '../../src/domain/thunder-god/index.js';
import { THUNDER_GOD_ABILITIES, THUNDER_GOD_CONSUMPTION_RISK, THUNDER_GOD_INHERITED_ABILITIES, THUNDER_GOD_PREPARATIONS } from '../../src/domain/thunder-god/content.js';
import type { ThunderGodAction, ThunderGodCommand, ThunderGodProjection } from '../../src/domain/thunder-god/types.js';

afterEach(cleanup);

// Explicit renderer-only UNIT inputs, starting from the migrated original living
// boundary. These are presentation projections, not valid saves or a natural run.
function action(command: ThunderGodCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): ThunderGodAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let original: ThunderGodProjection | undefined;
function fixture(promoted = false): ThunderGodProjection {
  const value = structuredClone(original ??= projectThunderGod(originalCatastrophe()));
  Object.assign(value, {
    title: '雷神·暴君序列1', characterName: '莉娜', discovered: true, guidanceKnown: promoted, promoted,
    story: '指导者介绍独立封存的雷神成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null,
    digestion: promoted ? '雷神扮演0/100，普通完成同样可以报告。' : '天灾消化100，晋升后须12整周。',
    pollution: 0, risk: THUNDER_GOD_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，姓名、年龄、性格与身体记录保留。', inheritedHistory: [],
    inheritedTools: '同一小湾原水20单位、原闸耐久96，旧物逐件保留。', insideCase: false,
    environment: '同一12米原小湾、诺拉与芬恩·科尔及原物各有自己的实际记录。',
  } satisfies Partial<ThunderGodProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `thunder-god-potion-${number}`, title: `第${number}瓶 · 雷神成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `thunder-god-potion-${number}`, confirmed: true } }));
  value.preparations = THUNDER_GOD_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  const inheritedMastery = originalCatastrophe().progression.mastery;
  value.abilities = promoted ? [...THUNDER_GOD_INHERITED_ABILITIES.map(item => ({ ...item, mastery: inheritedMastery[item.id] ?? 0 })),
    ...THUNDER_GOD_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [action({ type: 'OBSERVE', caseId: 'located-target' }, '观察同一目标与当前原物', '1行动')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取雷神成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  return value;
}
function show(value = fixture(), extra: Partial<ThunderGodPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '雷神目标' });
const resources = () => screen.getAllByRole('region', { name: '雷神当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '雷神操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '雷神其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(PLATFORM|CONTROL|EXIT|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('Thunder God panel: exact resources, finite acquisition and unchanged body', () => {
  it('shows one main step, actual resources and three independent bottles without inventing treatment', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '雷神阶段总览' }).textContent).toContain('专业准备0/3');
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
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对同一小湾与原物来历', '1行动'));
    value.preferredActionId = value.actions[1]!.id; const view = show(value);
    expect(primary().textContent).toContain('核对同一小湾与原物来历');
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
    const value = fixture(), onCommand = vi.fn(), view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'thunder-god-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<ThunderGodPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders all twenty-two old masteries, seven old zeros and two new zeros without awards', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(24); expect(value.abilities.slice(0, 22).filter(item => item.mastery === 0)).toHaveLength(7);
    expect(value.abilities.slice(22).map(item => item.mastery)).toEqual([0, 0]);
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
    value.actions = [action(bottle.command, '独立确认服用第1瓶雷神魔药')];
    const onCommand = vi.fn(), view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); view.rerender(<ThunderGodPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为天灾';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<ThunderGodPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('Thunder God panel: confirmation, focus and same-save protection', () => {
  it('traps focus, disables the background and restores the initiating button on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取雷神成品与专业准备指导' }));
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
    const value = fixture(), onCommand = vi.fn(), view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<ThunderGodPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<ThunderGodPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });

  it('unlocks only after new committed facts and never automatically submits the next step', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对同一小湾与原物来历', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<ThunderGodPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });

  it('invalidates a confirmation if any saved facts or the same action ID command change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ThunderGodPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), oldConfirm = confirm(dialog), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' };
    view.rerender(<ThunderGodPanel value={saved} busy={false} onCommand={onCommand} />);
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

describe('Thunder God panel: independent opponent and actual ordinary exit', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.scene.playerLocation = 'PLATFORM'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动', '0行动；开战前明确选择')];
    value.preferredActionId = value.actions[0]!.id; return value;
  }
  it.each(['INHERITED_ONLY', 'GUIDED_THUNDER', 'STORM_BRACE', 'ALL', 'ORDINARY'] as const)('confirms the exact %s policy without beginning combat', policy => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('只保存本场策略'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });
  it('renders a distinct adult, depleted original rod, original hood and mental risk without inventing protection', () => {
    const value = encounter(); value.encounter.materials.weapon.charge = 0; value.encounter.materials.weapon.location = 'PLATFORM';
    value.encounter.enemy.powerUses.LIGHTNING = 4; value.encounter.scene.visibleBodyLine = false;
    value.encounter.scene.conditionVersion = 2; value.encounter.materials.screen.hood = 'CLOSED'; value.encounter.materials.screen.operations = 1;
    const before = structuredClone(value), view = show(value);
    const opponent = screen.getByRole('region', { name: '雷神可选真实交战' });
    expect(opponent.textContent).toContain('欧伦·盖奇 · 48岁'); expect(opponent.textContent).toContain('健康100/100、精神100/100、灵性120/120');
    expect(opponent.textContent).toContain('雷击储能0/4'); expect(opponent.textContent).toContain('已落在干平台地面');
    expect(opponent.textContent).toContain('身体冲击路线当前不可见，当前条件版本2');
    expect(opponent.textContent).toContain('原遮罩当前关闭'); expect(opponent.textContent).toContain('不能挡住海歌的精神压力');
    expect(opponent.textContent).toContain('雷击25%、风护20%、海歌20%、普通打击20%、遮挡10%、意外5%');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('requires confirmation for real combat and keeps independent consequences visible before commitment', () => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '开始真实交战', '1行动')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('双方独立受伤、投降、撤退与死亡都将保存');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' });
  });
  it('submits an actual four-metre ordinary exit at zero actions instead of merely closing the page', () => {
    const value = encounter(); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '沿4米原路普通离场', '0行动 · 实走4米、4秒')]; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
describe('Thunder God panel: real original objects, fresh permission and finite future windows', () => {
  function inside(caseId: 'located-target' | 'personal-impact' | 'obscured-return' = 'located-target') {
    const value = fixture(true), life = value.life, guard = caseId === 'personal-impact';
    life.activeCase = caseId; life.inside = life.insideCase = value.insideCase = true;
    life.playerLocation = guard ? 'TARGET' : 'CONTROL'; life.clockSeconds = 200; life.elapsedSeconds = 77; life.playerTravelMetres = 18;
    life.site.playerPosition = guard ? 'PLATFORM' : 'CONTROL'; life.site.keeper.position = 'EXIT';
    life.keeperPresent = true; life.finn.present = true; life.finn.location = 'EXIT';
    Object.assign(life.target, { owner: 'PLAYER', purchasedWeek: 144, location: 'HOLDER', pulse: 'ARMED', conditionVersion: 1 });
    Object.assign(life.pad, { owner: 'PLAYER', purchasedWeek: 144, location: guard ? 'WORN' : 'PLAYER', registered: guard, conditionVersion: 1 });
    const use = () => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' as const, remainingSeconds: 0, conditionVersion: null });
    const attempt: NonNullable<ThunderGodProjection['life']['currentAttempt']> = {
      week: 144, method: 'ABILITY', closed: false, result: 'NONE', elapsedSeconds: 77,
      playerTravelMetres: 18, keeperTravelMetres: 6, finnTravelMetres: 24, keeperEnergySpent: 1, spiritualitySpent: 0, mindSpent: 0,
      permission: { owner: 'GRANTED', technician: 'GRANTED', ability: 'GRANTED' }, permissionVersion: 3,
      sourceRead: true, returnAgreed: true, entered: true, exited: false, adultsCleared: true,
      targetPlaced: true, targetRetrieved: false, observedTargetVersion: 1, dischargeAttempted: false, dischargeTier: null, targetHit: false, manuallyInspected: false,
      padWorn: guard, padReturned: false, impactRegistered: guard, impactReleased: false, healthLost: 0, healthPrevented: 0, handReset: false,
      conditionChanged: false, pulseStopped: false, hoodCleared: false, guided: use(), guard: use(),
    };
    life.currentAttempt = attempt;
    const current = life.cases.find(item => item.id === caseId)!; current.status = 'ACTIVE'; current.contactOpen = true; current.attempts = [attempt];
    life.pending = { kind: guard ? 'GUARD' : 'GUIDED', caseId, createdAt: 190, expiresAt: 220, conditionVersion: 1, permissionVersion: 3,
      targetId: guard ? life.pad.id : life.target.id, bonus: guard ? 0 : 10 };
    Object.assign(guard ? attempt.guard : attempt.guided, { attempts: 1, successes: 1, tier: 'SUCCESS', state: 'ACTIVE', remainingSeconds: 20, conditionVersion: 1 });
    value.actions = [action({ type: guard ? 'RELEASE_IMPACT' : 'DISCHARGE_TARGET' }, guard ? '释放本人练习冲击' : '实际放出雷势', '0行动 · 2秒'),
      action({ type: 'STOP_PULSE' }, '普通停止本次作用', '0行动 · 实际停止')];
    value.actions[1]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    return value;
  }
  it.each(['located-target', 'personal-impact'] as const)('shows a genuine pending %s window separately from actual application', caseId => {
    const value = inside(caseId), before = structuredClone(value), view = show(value);
    const powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain(`${caseId === 'located-target' ? '雷势引导' : '风雷护持'}还剩20秒`);
    expect(powers.textContent).toContain('施放本身不完成放电或抵挡，也不增加掌握');
    expect(powers.textContent).toContain('实际应用0次'); expect(powers.textContent).toContain('后续独立放出雷势：尚未判定');
    expect(powers.textContent).toContain('本人练习冲击：尚未实际释放');
    expect(value.abilities.slice(22).map(item => item.mastery)).toEqual([0, 0]);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['expired', 'too-short', 'changed', 'shuttered', 'withdrawn', 'old-permission', 'wrong-object', 'adult-in-line', 'not-observed', 'moved', 'closed', 'blocked-action'] as const)('does not present an unusable %s directed window as active', why => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    if (why === 'expired') life.clockSeconds = 220;
    if (why === 'too-short') life.clockSeconds = 219;
    if (why === 'changed') life.target.conditionVersion++;
    if (why === 'shuttered') { life.target.hood = 'CLOSED'; life.target.line = 'OBSCURED'; }
    if (why === 'withdrawn') attempt.permission.owner = 'WITHDRAWN';
    if (why === 'old-permission') attempt.permissionVersion++;
    if (why === 'wrong-object') life.pending!.targetId = 'a-different-target';
    if (why === 'adult-in-line') life.finn.location = 'TARGET';
    if (why === 'not-observed') attempt.observedTargetVersion = null;
    if (why === 'moved') life.playerLocation = 'EXIT';
    if (why === 'closed') attempt.closed = true;
    if (why === 'blocked-action') value.actions[0]!.enabled = false;
    const before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('当前没有可应用的雷势引导窗口'); expect(powers.textContent).not.toContain('雷势引导还剩');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['pad-returned', 'not-registered', 'wrong-version', 'too-short', 'condition-changed'] as const)('does not claim personal protection when %s', why => {
    const value = inside('personal-impact'), life = value.life;
    if (why === 'pad-returned') life.pad.location = 'PLAYER';
    if (why === 'not-registered') life.pad.registered = false;
    if (why === 'wrong-version') life.pad.conditionVersion++;
    if (why === 'too-short') life.clockSeconds = 219;
    if (why === 'condition-changed') life.currentAttempt!.conditionChanged = true;
    const before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('当前没有可应用的风雷护持窗口'); expect(powers.textContent).not.toContain('风雷护持还剩');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['GUIDED_THUNDER', 'STORM_BRACE'] as const)('confirms the exact %s cost without treating a cast as an application', type => {
    const value = inside(type === 'STORM_BRACE' ? 'personal-impact' : 'located-target');
    value.life.pending = null; value.actions = [action({ type }, '尝试本次有限能力')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain(type === 'GUIDED_THUNDER' ? '8灵性、2精神，感知18' : '6灵性、2精神，意志18');
    expect(dialog.textContent).toContain('30秒');
    if (type === 'GUIDED_THUNDER') expect(dialog.textContent).toContain('施放本身不等于命中');
    else { expect(dialog.textContent).toContain('通常本人健康减少5'); expect(dialog.textContent).toContain('选择普通手柄复位'); }
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type }); expect(value).toEqual(before);
  });
  it('makes registration distinct from release and states both health and pad costs before confirmation', () => {
    const value = inside('personal-impact'); value.actions = [action({ type: 'REGISTER_IMPACT' }, '登记本次本人冲击')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('登记只声明下一次本人练习冲击，不立即释放');
    expect(dialog.textContent).toContain('磨损同一护垫10耐久，通常损失本人5健康');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('shows exact personal impact risk and the ordinary hand alternative before confirming a release', () => {
    const value = inside('personal-impact'); value.life.pending = null; value.life.currentAttempt!.guard.state = 'FAILED';
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('同一护垫耐久减少10'); expect(dialog.textContent).toContain('通常本人健康减少5');
    expect(dialog.textContent).toContain('只有作用当时仍有效的风雷护持'); expect(dialog.textContent).toContain('选择普通手柄复位');
    expect(dialog.textContent).toContain('伤害只可通过之后的普通行动恢复'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(openPrimary())); fireEvent.click(primary());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RELEASE_IMPACT' }); expect(value).toEqual(before);
  });
  it('offers a zero-health ordinary hand reset after failed guard while preserving original pad wear', () => {
    const value = inside('personal-impact'); value.life.pending = null; value.life.currentAttempt!.guard.state = 'FAILED';
    value.actions = [action({ type: 'HAND_RESET' }, '普通手柄复位', '0行动 · 护垫耐久−10 · 健康0损失')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('不损失健康'); expect(dialog.textContent).toContain('实际磨损10耐久，不增加新能力掌握');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'HAND_RESET' }); expect(value).toEqual(before);
  });
  it.each(['BUY_TARGET', 'BUY_PAD', 'INVITE'] as const)('shows the real %s cost before commitment and cancel submits nothing', type => {
    const value = fixture(true), command: ThunderGodCommand = type === 'INVITE' ? { type, caseId: 'located-target', method: 'ORDINARY' } : { type };
    const price = type === 'BUY_TARGET' ? 40 : type === 'BUY_PAD' ? 20 : 10;
    value.actions = [action(command, '本次实付操作', `1行动、${price}便士`)]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain(`实付${price}便士、1行动`);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it('separates all3 permissions and never presents a closed old agreement as fresh consent', () => {
    const value = inside(); value.life.currentAttempt!.closed = true; const view = show(value);
    const permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('诺拉 · 45岁'); expect(permissions.textContent).toContain('芬恩·科尔 · 44岁');
    expect(within(permissions).getAllByText(/本案曾明确同意，当前无生效许可/)).toHaveLength(3);
    expect(permissions.textContent).not.toContain('：当前明确同意'); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('submits only the explicit declined permission and never manufactures consent or deletes objects', () => {
    const value = inside(); value.actions = [action({ type: 'DECLINE_CONSENT', permission: 'TECHNICIAN' }, '尊重技师本次拒绝')];
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('芬恩本次参与'); expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DECLINE_CONSENT', permission: 'TECHNICIAN' }); expect(value).toEqual(before);
  });
  it.each(['STOP_PULSE', 'CLEAR_HOOD', 'RETRIEVE_TARGET', 'RETURN_PAD', 'ABORT'] as const)('keeps ordinary %s available at zero actions after withdrawal without hiding original objects or costs', type => {
    const value = inside('obscured-return'), life = value.life;
    life.target.hood = 'CLOSED'; life.target.line = 'OBSCURED'; life.target.conditionVersion = 2;
    life.currentAttempt!.conditionChanged = true; life.currentAttempt!.permission.owner = 'WITHDRAWN';
    life.currentAttempt!.guided.state = 'INVALIDATED'; life.currentAttempt!.spiritualitySpent = 8; life.currentAttempt!.mindSpent = 2;
    life.pending = null; value.resources!.actionsRemaining = 0;
    value.actions = [action({ type }, '实际普通收束', '0行动 · 实走并归还原物')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('原小湾与保管员许可：已经撤回');
    expect(screen.getByRole('region', { name: '同一原目标与本人护垫' }).textContent).toContain('遮罩关闭，视线被遮挡，条件版本2');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('条件改变，已经失效');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
