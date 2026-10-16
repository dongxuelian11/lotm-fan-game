/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PureWhiteAngelPanel, type PureWhiteAngelPanelProps } from '../../src/renderer/PureWhiteAngelPanel.js';
import { projectPureWhiteAngel } from '../../src/domain/pure-white-angel/index.js';
import { PURE_WHITE_ANGEL_ABILITIES, PURE_WHITE_ANGEL_INHERITED_ABILITIES, PURE_WHITE_ANGEL_CONSUMPTION_RISK, PURE_WHITE_ANGEL_PREPARATIONS } from '../../src/domain/pure-white-angel/content.js';
import type { PureWhiteAngelAction, PureWhiteAngelCommand, PureWhiteAngelProjection } from '../../src/domain/pure-white-angel/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

afterEach(cleanup);
let sourceCache: SliceState | undefined;
function source() {
  if (!sourceCache) {
    sourceCache = migrateSliceState(readObjectEntry<SliceState>('tests/fixtures/light-seeker-v01720/natural.json', 'final'));
    expect(sourceCache.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(sourceCache.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  }
  return sourceCache;
}
function action(command: PureWhiteAngelCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): PureWhiteAngelAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let original: PureWhiteAngelProjection | undefined;
/** Renderer-only UNIT projections, never valid saves or a simulated campaign.
 * Original bodies, resources and all twenty inherited masteries come unchanged
 * from an explicitly migrated historical fixture, including five zero entries. */
function fixture(promoted = false): PureWhiteAngelProjection {
  const value = structuredClone(original ??= projectPureWhiteAngel(source()));
  Object.assign(value, {
    title: '纯白天使·太阳序列1', discovered: true, guidanceKnown: promoted, promoted, acting: 0,
    story: '指导者介绍独立封存的纯白天使成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null, insideCase: false,
    digestion: promoted ? '纯白天使扮演0/100，普通完成同样可以报告。' : '逐光者消化100，实际晋升后须12整周。',
    risk: PURE_WHITE_ANGEL_CONSUMPTION_RISK,
  } satisfies Partial<PureWhiteAngelProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `pure-white-angel-potion-${number}`, title: `第${number}瓶 · 纯白天使成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `pure-white-angel-potion-${number}`, confirmed: true } }));
  value.preparations = PURE_WHITE_ANGEL_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  value.abilities = promoted ? [...PURE_WHITE_ANGEL_INHERITED_ABILITIES.map(item => ({ ...item, mastery: source().progression.mastery[item.id] ?? 0 })),
    ...PURE_WHITE_ANGEL_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [action({ type: 'OBSERVE', caseId: 'residue-trace' }, '观察同一残留样本与原采光廊', '1行动')]
    : [action({ type: 'LEARN_GUIDANCE' }, '听取纯白天使成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  return value;
}
function show(value = fixture(), extra: Partial<PureWhiteAngelPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '纯白天使目标' });
const resources = () => screen.getAllByRole('region', { name: '纯白天使当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '纯白天使操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(FORECOURT|FAR|ENTRY|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"command"|"before"/;

describe('Pure White Angel panel: original resources and finite acquisition', () => {
  it('uses the migrated actual boundary and preserves all wounds, risk and original gallery objects', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('健康50/100 · 精神100/100 · 灵性87/120');
    expect(resources().textContent).toContain('540便士 · 本周行动3 · 现有伤势3处 · 累计风险3');
    expect(within(resources()).getAllByText(/尚未治疗/)).toHaveLength(3);
    expect(value.injuries.filter(injury => injury.severity === 'LIGHT')).toHaveLength(2);
    expect(value.injuries.filter(injury => injury.severity === 'HEAVY')).toHaveLength(1);
    const fold = screen.getByText('原采光廊、玛拉、芦影与旧物当前记录').closest('details')!; fold.open = true;
    const originals = screen.getByRole('region', { name: '原采光廊当前状态' });
    expect(originals.textContent).toContain('玛拉 · 46岁；精力90/100');
    expect(originals.textContent).toContain('芦影是同一独立灵体；精力96/100');
    expect(originals.textContent).toContain('累计实走94米'); expect(originals.textContent).toContain('现场时钟976秒');
    expect(originals.textContent).toContain('耐久81/100，已经实际操作19次');
    expect(originals.textContent).toContain('原油灯余油3份'); expect(originals.textContent).toContain('原屏板耐久99/100');
    expect(originals.textContent).toContain('归玛拉所有，已有实际核读记录');
    expect(screen.getByRole('region', { name: '纯白天使阶段总览' }).textContent).toContain('专业准备0/3');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3); expect(primary().textContent).toContain('500便士');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('renders twenty inherited values, five inherited zeros and two new zeros without awarding mastery', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(22); expect(value.abilities.slice(0, 20).filter(item => item.mastery === 0)).toHaveLength(5);
    expect(value.abilities.slice(20).map(item => item.mastery)).toEqual([0, 0]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(value.abilities.slice(0, 20).map(item => [item.id, item.mastery])).toEqual(PURE_WHITE_ANGEL_INHERITED_ABILITIES.map(item => [item.id, source().progression.mastery[item.id]]));
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('confirms the exact selected bottle and its failure cost without changing identity or double submission', () => {
    const value = fixture(); value.preparedWeek = 180; value.insideCase = true;
    value.actions = value.bottles.map(bottle => action(bottle.command, `饮用${bottle.title}`, '0行动 · 实际耗尽所选原瓶'));
    const before = structuredClone(value), view = show(value);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const dialog = openPrimary(); expect(dialog.textContent).toContain('第2瓶独立封存');
    expect(dialog.textContent).toContain('当前成功率68%'); expect(dialog.textContent).toContain('健康−15精神−25排异+30');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向'); expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });
  it('retains the selected original bottle when saved labour changes', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<PureWhiteAngelPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });
  it('keeps custom names verbatim even if a name contains editorial words', () => {
    const value = fixture(); value.characterName = '原创G候选'; value.appearanceRecord = `${value.characterName}保有自己的身份。`;
    value.actions[0]!.label = `请${value.characterName}听取指导`; const view = show(value);
    expect(resources().textContent).toContain('原创G候选'); expect(primary().textContent).toContain('请原创G候选听取指导');
    expect(view.container.textContent).toContain('原创G候选保有自己的身份。');
  });
});

describe('Pure White Angel panel: accessible confirmation and same-save protection', () => {
  it('traps focus and restores the initiating control on cancel and Escape without dispatch', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取纯白天使成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(disabled(picker())).toBe(true); expect(button.closest('[inert]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(document.activeElement).toBe(button); expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('keeps a submitted command locked across identical rerenders, error and error dismissal', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<PureWhiteAngelPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    view.rerender(<PureWhiteAngelPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });
  it('unlocks on new saved facts without automatically issuing the next command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value);
    saved.guidanceKnown = true; saved.resources!.cash = '40便士'; saved.resources!.actionsRemaining = 2;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }, '核对原瓶与旧物', '1行动')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<PureWhiteAngelPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false); expect(onCommand).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
  });
  it('invalidates stale confirmation when the same action ID carries a changed command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    const staleConfirm = confirm(openPrimary()), saved = structuredClone(value);
    saved.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' };
    view.rerender(<PureWhiteAngelPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.click(staleConfirm); expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });
  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks mutation and navigation while %s', mode => {
    const value = fixture(), onClose = vi.fn();
    if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null, onClose });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
  it('shows the current disabled reason and treats close as navigation only', () => {
    const value = fixture(); value.actions[0]!.enabled = false; value.actions[0]!.reason = '本周行动不足。';
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(disabled(primary())).toBe(true); expect(primary().getAttribute('aria-describedby')).toBeTruthy(); expect(screen.getByText('本周行动不足。')).toBeTruthy();
    fireEvent.click(primary()); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

function inside(caseId: 'residue-trace' | 'personal-impact' | 'screened-return' = 'residue-trace') {
  const value = fixture(true), life = value.life, guard = caseId !== 'residue-trace';
  life.activeCase = caseId; life.inside = life.insideCase = value.insideCase = true;
  life.playerLocation = 'FAR'; life.clockSeconds = 1100; life.elapsedSeconds = 124; life.playerTravelMetres = 10;
  life.conditionVersion = 1; life.site.playerLocation = 'FAR'; life.site.operatorLocation = 'SIDE'; life.site.spiritLocation = 'SIDE';
  life.site.shutter.state = 'OPEN'; life.maraPresent = true; life.ivan.present = true; life.ivan.location = 'SIDE';
  Object.assign(life.sample, { owner: 'PLAYER', purchasedWeek: 180, location: guard ? 'PLAYER' : 'FAR', residueUnits: 1, contained: false, version: 1 });
  Object.assign(life.pad, { owner: 'PLAYER', purchasedWeek: 180, location: guard ? 'WORN' : 'PLAYER' });
  const use = () => ({ attempts: 0, successes: 0, effects: 0, tier: null, state: 'NONE' as const, remainingSeconds: 0, conditionVersion: null });
  const attempt: NonNullable<PureWhiteAngelProjection['life']['currentAttempt']> = {
    week: 180, method: 'ABILITY', closed: false, result: 'NONE', elapsedSeconds: 124,
    playerTravelMetres: 10, maraTravelMetres: 0, ivanTravelMetres: 13, ownerEnergySpent: 2, spiritualitySpent: guard ? 6 : 8, mindSpent: 2,
    permission: { owner: 'GRANTED', technician: 'GRANTED', ability: 'GRANTED' }, permissionVersion: 3,
    sourceRead: true, spiritAsked: true, spiritAnswer: 'DECLINED', refusalAcknowledged: true, returnAgreed: true,
    entered: true, exited: false, samplePlaced: !guard, sampleRetrieved: false, observedSampleVersions: [1],
    cleanseAttempted: false, cleanseTier: null, sampleHandled: false, manualContained: false,
    padWorn: guard, padRetrieved: false, impactDeclared: guard, impactReleased: false, impactReset: false, healthPrevented: 0,
    conditionChanged: false, shutterReopened: false, stopped: false, focused: use(), guard: use(),
  };
  life.currentAttempt = attempt;
  const selected = life.cases.find(item => item.id === caseId)!; selected.status = 'ACTIVE'; selected.contactOpen = true; selected.attempts = [attempt];
  life.pending = { kind: guard ? 'GUARD' : 'FOCUSED', caseId, createdAt: 1090, expiresAt: 1120, conditionVersion: 1, permissionVersion: 3, sampleVersion: guard ? null : 1 };
  Object.assign(guard ? attempt.guard : attempt.focused, { attempts: 1, successes: 1, tier: 'SUCCESS', state: 'ACTIVE', remainingSeconds: 20, conditionVersion: 1 });
  value.actions = [action({ type: guard ? 'RELEASE_IMPACT' : 'CLEANSE_SAMPLE' }, guard ? '释放本人练习冲击' : '实际清理同一样本', '0行动 · 4秒'),
    action({ type: 'STOP' }, '普通停止本次作用', '0行动 · 实际停止')];
  value.actions[1]!.cleanup = true; value.preferredActionId = value.actions[0]!.id; return value;
}
describe('Pure White Angel panel: actual sample, pad, consent and application', () => {
  it.each(['residue-trace', 'personal-impact'] as const)('separates successful %s casting, a usable window and actual application', caseId => {
    const value = inside(caseId), before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain(`${caseId === 'residue-trace' ? '净光定向' : '温光护持'}还剩20秒`);
    expect(powers.textContent).toContain('成功开窗1次'); expect(powers.textContent).toContain('实际应用0次');
    expect(powers.textContent).toContain('施放本身不清除残留或抵挡伤害，也不增加掌握');
    expect(powers.textContent).toContain('本案尚未报告，成功开窗不提前奖励');
    expect(value.abilities.slice(20).map(item => item.mastery)).toEqual([0, 0]); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['expired', 'too-short', 'changed', 'closed-shutter', 'broken-shutter', 'withdrawn', 'old-permission', 'sample-version', 'contained', 'cleared', 'adult-in-line', 'not-observed', 'moved', 'closed', 'blocked-action'] as const)('does not call an unusable %s focused window active', why => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    if (why === 'expired') life.clockSeconds = 1120;
    if (why === 'too-short') life.clockSeconds = 1117;
    if (why === 'changed') life.conditionVersion++;
    if (why === 'closed-shutter') life.site.shutter.state = 'CLOSED';
    if (why === 'broken-shutter') { life.site.shutter.state = 'BROKEN'; life.site.shutter.durability = 0; }
    if (why === 'withdrawn') attempt.permission.owner = 'WITHDRAWN';
    if (why === 'old-permission') attempt.permissionVersion++;
    if (why === 'sample-version') life.sample.version++;
    if (why === 'contained') life.sample.contained = true;
    if (why === 'cleared') life.sample.residueUnits = 0;
    if (why === 'adult-in-line') life.ivan.location = 'ENTRY';
    if (why === 'not-observed') attempt.observedSampleVersions = [];
    if (why === 'moved') life.site.playerLocation = 'ENTRY';
    if (why === 'closed') attempt.closed = true;
    if (why === 'blocked-action') value.actions[0]!.enabled = false;
    const before = structuredClone(value), view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('当前没有可应用的净光定向窗口'); expect(powers.textContent).not.toContain('净光定向还剩');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it.each(['pad-returned', 'undeclared', 'released', 'reset', 'changed', 'too-short'] as const)('does not promise protection after %s', why => {
    const value = inside('personal-impact'), life = value.life;
    if (why === 'pad-returned') life.pad.location = 'PLAYER';
    if (why === 'undeclared') life.currentAttempt!.impactDeclared = false;
    if (why === 'released') life.currentAttempt!.impactReleased = true;
    if (why === 'reset') life.currentAttempt!.impactReset = true;
    if (why === 'changed') life.conditionVersion++;
    if (why === 'too-short') life.clockSeconds = 1117;
    const view = show(value), powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('当前没有可应用的温光护持窗口'); expect(powers.textContent).not.toContain('温光护持还剩'); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('shows ordinary containment as one retained residue, never a purified or refilled sample', () => {
    const value = inside(); value.life.pending = null; value.life.sample.contained = true; value.life.sample.version++;
    value.life.currentAttempt!.manualContained = true; value.life.currentAttempt!.focused.state = 'STOPPED';
    const before = structuredClone(value), view = show(value), originals = screen.getByRole('region', { name: '同一原样本与本人护垫' });
    expect(originals.textContent).toContain('超自然残留1份，已普通封存'); expect(originals.textContent).toContain('第三案不另发一份样本');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本案已经普通封存，残留未被净化');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('shows actual cleansing before report mastery and never asks to recast on a zero-residue original', () => {
    const value = inside(), life = value.life, attempt = life.currentAttempt!;
    life.pending = null; life.sample.residueUnits = 0; life.sample.version++;
    attempt.cleanseAttempted = true; attempt.cleanseTier = 'SUCCESS'; attempt.sampleHandled = true;
    attempt.focused.state = 'APPLIED'; attempt.focused.effects = 1;
    value.actions = [action({ type: 'STOP' }, '普通停止本次作用')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), onCommand = vi.fn(), view = render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '同一原样本与本人护垫' }).textContent).toContain('超自然残留0份，已经实际清理');
    const powers = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(powers.textContent).toContain('原样本残留已为0，不需要再次施放'); expect(powers.textContent).toContain('实际应用1次');
    expect(powers.textContent).toContain('本案尚未报告，成功开窗不提前奖励'); expect(value.abilities[20]!.mastery).toBe(0);
    const saved = structuredClone(value); saved.life.cases.find(item => item.id === 'residue-trace')!.status = 'RESOLVED'; saved.abilities[20]!.mastery = 8;
    view.rerender(<PureWhiteAngelPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本案已报告，实际应用的掌握增量以当前能力记录为准');
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(within(fold).getByRole('heading', { name: '净光定向 · 掌握8' })).toBeTruthy(); expect(value).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
  it('shows exact impact cost and a safe ordinary alternative before dispatch', () => {
    const value = inside('personal-impact'); value.life.pending = null; value.life.currentAttempt!.guard.state = 'FAILED';
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('同一护垫耐久减少10'); expect(dialog.textContent).toContain('通常本人健康减少5');
    expect(dialog.textContent).toContain('只有作用当时仍有效的温光护持'); expect(dialog.textContent).toContain('选择普通手柄复位');
    expect(dialog.textContent).toContain('伤害只可通过之后的普通行动恢复'); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RELEASE_IMPACT' }); expect(value).toEqual(before);
  });
  it.each(['BUY_SAMPLE', 'BUY_PAD', 'INVITE'] as const)('shows the actual %s cost and cancel submits nothing', type => {
    const value = fixture(true), command: PureWhiteAngelCommand = type === 'INVITE' ? { type, caseId: 'residue-trace', method: 'ORDINARY' } : { type };
    const price = type === 'BUY_SAMPLE' ? 40 : type === 'BUY_PAD' ? 20 : 10;
    value.actions = [action(command, '本次实付操作', `1行动、${price}便士`)]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain(`实付${price}便士、1行动`);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
  it('distinguishes all three adult permissions and does not reuse a closed agreement', () => {
    const value = inside(); value.life.currentAttempt!.closed = true; const view = show(value), permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('玛拉 · 46岁'); expect(permissions.textContent).toContain('伊文·梅罗 · 43岁');
    expect(within(permissions).getAllByText(/本案曾明确同意，当前无生效许可/)).toHaveLength(3);
    expect(permissions.textContent).not.toContain('：当前明确同意'); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('respects the original spirit refusal without consent, travel or energy gifts', () => {
    const value = inside(); value.life.currentAttempt!.refusalAcknowledged = false;
    value.actions = [action({ type: 'ACKNOWLEDGE_REFUSAL' }, '尊重芦影本次拒绝')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), permissions = screen.getByRole('region', { name: '本案的独立许可' });
    expect(permissions.textContent).toContain('明确拒绝来访'); expect(permissions.textContent).toContain('仍在九米侧路，精力96/100');
    expect(permissions.textContent).toContain('拒绝不阻止普通推进'); fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ACKNOWLEDGE_REFUSAL' }); expect(value).toEqual(before);
  });
  it.each(['STOP', 'OPEN_SHUTTER', 'RETRIEVE_SAMPLE', 'RETRIEVE_PAD', 'EXIT_GALLERY', 'HANDLE_RESET', 'ABORT'] as const)('keeps ordinary %s available at zero actions after fresh withdrawal', type => {
    const value = inside('screened-return'), life = value.life;
    life.site.shutter.state = 'CLOSED'; life.site.shutter.durability = 80; life.site.shutter.operations = 20; life.conditionVersion = 2;
    life.currentAttempt!.permission.ability = 'WITHDRAWN'; life.currentAttempt!.conditionChanged = true; life.currentAttempt!.guard.state = 'INVALIDATED';
    life.pending = null; value.resources!.actionsRemaining = 0;
    value.actions = [action({ type }, '实际普通收束', '0行动 · 实走并归还原物')]; value.actions[0]!.cleanup = true; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('本人使用能力：已经撤回');
    expect(screen.getByRole('region', { name: '同一原样本与本人护垫' }).textContent).toContain('当前原遮板关闭，耐久80/100、实际操作20次');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('条件改变，已经失效');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    const dialog = openPrimary(); if (type === 'HANDLE_RESET') { expect(dialog.textContent).toContain('不损失健康'); expect(dialog.textContent).toContain('实际磨损10耐久'); }
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type }); expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('Pure White Angel panel: independent encounter and ordinary exit', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.scene.playerLocation = 'FORECOURT'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动')]; value.preferredActionId = value.actions[0]!.id; return value;
  }
  it.each(['INHERITED_ONLY', 'FOCUSED_PURIFICATION', 'WARM_RADIANCE_GUARD', 'ALL', 'ORDINARY'] as const)('confirms exact %s policy without starting combat', policy => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_POLICY', policy }, '明确选择本场策略')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain('只保存本场策略');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy }); expect(value).toEqual(before);
  });
  it('shows the independent adult, depleted original rod, own hood and actual mental risk', () => {
    const value = encounter(); value.encounter.materials.weapon.charge = 0; value.encounter.materials.weapon.location = 'FORECOURT';
    value.encounter.enemy.powerUses.LIGHT_STRIKE = 4; value.encounter.scene.visibleBodyLine = false; value.encounter.scene.conditionVersion = 2;
    value.encounter.materials.screen.hood = 'CLOSED'; value.encounter.materials.screen.operations = 1;
    const before = structuredClone(value), view = show(value), opponent = screen.getByRole('region', { name: '纯白天使可选真实交战' });
    expect(opponent.textContent).toContain('西拉斯·戴恩 · 49岁'); expect(opponent.textContent).toContain('健康100/100、精神100/100、灵性120/120');
    expect(opponent.textContent).toContain('光击储能0/4'); expect(opponent.textContent).toContain('已落在前庭地面');
    expect(opponent.textContent).toContain('身体冲击路线当前不可见，当前条件版本2'); expect(opponent.textContent).toContain('原遮罩当前关闭');
    expect(opponent.textContent).toContain('不能挡住炫目压力的精神效果'); expect(opponent.textContent).toContain('光击25%、光护20%、炫目压力20%、普通打击20%、遮挡10%、意外5%');
    expect(opponent.textContent).toContain('旧欧文的原身体与死亡结局保留'); expect(opponent.textContent).toContain('都不在本场');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('requires confirmation before real combat and cancel commits nothing', () => {
    const value = encounter(); value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '开始真实交战', '1行动')]; value.preferredActionId = value.actions[0]!.id;
    const view = show(value), dialog = openPrimary(); expect(dialog.textContent).toContain('双方独立受伤、投降、撤退与死亡都将保存');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' });
  });
  it('submits real four-metre ordinary exit at zero actions instead of just closing the panel', () => {
    const value = encounter(); value.resources!.actionsRemaining = 0;
    value.actions = [action({ type: 'LEAVE_ENCOUNTER' }, '沿4米原路普通离场', '0行动 · 实走4米、4秒')]; value.preferredActionId = value.actions[0]!.id;
    const onClose = vi.fn(), before = structuredClone(value), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});
