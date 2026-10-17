/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GloryPanel } from '../../src/renderer/GloryPanel';
import type { GloryAction, GloryCommand, GloryProjection } from '../../src/domain/glory/types';
import type { GloryAttempt, GloryCaseId, GlorySiteState } from '../../src/domain/glory/life';

// Small renderer-only public fixtures. These are not domain saves, replay evidence or
// natural outcomes; no campaign fixtures or whole application are loaded by this suite.
const INHERITED = [
  ['warrior.s9.physique', '强健体魄', 24], ['warrior.s9.arms', '持械训练', 33], ['warrior.s9.restraint', '克制施力', 57],
  ['warrior.s8.combat-skill', '格斗技巧', 16], ['warrior.s7.weapons', '兵器运用', 8], ['warrior.s7.weak-point', '弱点观察', 8],
  ['warrior.s6.dawn-light', '晨曦之光', 0], ['warrior.s6.dawn-armor', '晨曦铠甲', 41], ['warrior.s6.dawn-weapon', '晨曦武器', 8], ['warrior.s6.light-storm', '光之风暴', 0],
  ['warrior.s5.guard-state', '守护状态', 0], ['warrior.s5.damage-sharing', '附近同伴伤害分担', 0],
  ['warrior.s4.discern-corruption', '邪恶与污染痕迹辨识', 8], ['warrior.s4.targeted-preparation', '真实材料的针对性准备', 33], ['warrior.s4.veil-intent', '隐藏自身行动意图', 8],
  ['warrior.s3.silver-armor', '实质银甲', 8], ['warrior.s3.light-concealment', '借光隐藏', 8], ['warrior.s3.silver-thrust', '传送银白细剑', 8],
] as const;
const caseTitles: Record<GloryCaseId, string> = { 'armor-temper': '同一银甲的真实磨损', 'close-guard': '身旁一人的六米过桥', 'revoked-crossing': '撤回许可后的普通侧路' };
function site(): GlorySiteState {
  return { siteId: 'GL2-REPAIR-ROOM', introducedWeek: 135, introducedDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 1 },
    clockSeconds: 24, playerLocation: 'BENCH', playerTravelMetres: 6, playerEnergy: 94,
    celia: { id: 'GL2-CELIA', name: '西莉娅', age: 41, alive: true, location: 'BENCH', energy: 100, travelMetres: 0 },
    evan: { id: 'GL2-EVAN', name: '埃文', age: 36, alive: true, location: 'BENCH', energy: 100, travelMetres: 0 },
    armor: { id: 'SK3-LIFE-ARMOR', owner: 'PLAYER', formed: true, active: false, integrity: 60, remainingSeconds: 0 },
    armorSource: { root: 'silverKnight.life.armor', promotionWeek: 120, introducedWeek: 135, actor: 'PLAYER', at: 'ENTRY', snapshot: { id: 'SK3-LIFE-ARMOR', owner: 'PLAYER', formed: true, active: false, integrity: 65, remainingSeconds: 0 } }, armorWorn: true,
    pads: { id: 'GL2-PADS', ownerId: 'GL2-CELIA', issuedWithPlateId: 'GL2-PLATE:armor-temper', location: 'PLAYER', remaining: 1, consumed: 1, worn: true },
    load: { id: 'GL2-LOAD', ownerId: 'GL2-CELIA', location: 'BENCH', kilograms: 12, remainingLoads: 0, appliedLoads: 1, safetyStop: 'ENGAGED' },
    bridge: { id: 'GL2-BRIDGE', from: 'BENCH', to: 'BRIDGE', metres: 6, sidePathMetres: 8, ordinaryPath: 'OPEN', crossings: 0, ordinaryCrossings: 0 },
    temper: { active: false, expiresAt: null }, guard: { active: false, actorId: null, expiresAt: null, sharedHealth: 0, sharedEnergy: 0 },
    plates: [{ id: 'GL2-PLATE:armor-temper', caseId: 'armor-temper', ownerId: 'PLAYER', quantity: 1, charges: 0, location: 'PLAYER', paidPennies: 20, preparedWeek: 135 }] };
}
function attempt(p: GlorySiteState, overrides: Partial<GloryAttempt> = {}): GloryAttempt {
  return { week: 135, method: 'ABILITY', closed: false, result: 'ABILITY', stopped: false, inspected: false, permissionWithdrawn: false,
    elapsedSeconds: 18, playerTravelMetres: 2, energySpent: 2, spiritualitySpent: 6, penniesSpent: 20, healthSpent: 0,
    operatorConsent: 'GRANTED', ownerConsent: 'GRANTED', routeConsent: 'GRANTED', consentWeek: 135, actorId: null,
    plateId: 'GL2-PLATE:armor-temper', plateReturned: false, abilityTier: 'SUCCESS', window: 'APPLIED', windowExpiresAt: null,
    padWorn: true, padRemoved: false, loadApplied: true, armorWear: 5, crossed: false, crossingMethod: null, actorReturned: false, waits: 0,
    appliedAbilityIds: ['warrior.s2.armor-temper'], playerMoves: [], actorMoves: [], siteAtStart: structuredClone(p), siteAtClose: null, ...overrides };
}
function action(command: GloryCommand, label: string, cost: string, enabled = true, reason: string | null = null): GloryAction {
  return { id: `display:${command.type}:${'bottleId' in command ? command.bottleId : 'caseId' in command ? command.caseId : 'once'}`, command, label, cost, enabled, reason };
}
function view(promoted = true): GloryProjection {
  const p = site(), a = attempt(p);
  return { title: '荣耀者', discovered: true, guidanceKnown: true, promoted, formulaKnown: false, formula: [],
    story: '在修护室核对同一银甲与本人承担的真实负担。', supplies: '独立原瓶各有交付记录。', actions: [],
    bottles: [1, 2].map((n): GloryProjection['bottles'][number] => ({ id: `glory-potion-${n}`, title: `第${n}瓶荣耀者成品魔药`, source: `专业交接处第${n}瓶独立原瓶。`, status: n === 1 ? '已耗尽，未晋升' : '本人持有，尚未饮用', chance: 72, command: { type: 'CONSUME', bottleId: `glory-potion-${n}`, confirmed: true } })),
    preparations: [{ taskId: 'TRACE_ARMOR', title: '核对已有银甲和损耗', completedWeek: 132 }, { taskId: 'PLAN_LOAD', title: '核读负载与本人承受范围', completedWeek: 133 }, { taskId: 'CHECK_EXIT', title: '走查停手与普通退出路线', completedWeek: 133 }],
    preparedWeek: promoted ? null : 134,
    abilities: [...INHERITED.map(([id, label, mastery]) => ({ id, label, mastery, description: '按实际身体、原物与已有经历使用。' })), ...(promoted ? [{ id: 'warrior.s2.armor-temper', label: '银甲淬护', mastery: 0, description: '6灵性尝试加强同一银甲，实际承压仍有磨损。' }, { id: 'warrior.s2.close-guard', label: '近身护持', mastery: 0, description: '当前同意的一人实际过桥，本人承担真实负担。' }] : [])],
    acting: promoted ? 0 : 100, digestion: promoted ? '荣耀者消化0/100。' : '白银骑士消化100/100。', pollution: 0,
    risk: '服药必耗所选原瓶和当次检查。普通战斗可能造成伤势与死亡。',
    resources: { health: 100, maxHealth: 100, mind: 85, maxMind: 100, spirituality: 114, maxSpirituality: 120, cash: '3镑2苏勒', actionsRemaining: 1 },
    currentGender: 'FEMALE', inheritedHistory: ['白银骑士在第120周实际晋升，旧消化100/100保留。', '原有伤势和旧人物结局保持。'],
    life: { title: '修护室', story: '逐案记录原人、原甲和实际费用。', environment: '门口0米，修护台2米，短桥另一端8米。', activeCase: promoted ? 'armor-temper' : null, inside: promoted, insideCase: promoted, reflected: false, site: p,
      clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: promoted ? a : null, historicalArmorIntegrity: 65, currentArmorIntegrity: 60, armorIdentity: 'SK3-LIFE-ARMOR',
      cases: (Object.keys(caseTitles) as GloryCaseId[]).map((id): GloryProjection['life']['cases'][number] => ({ id, title: caseTitles[id], story: '每案取得当前同意，普通路线始终保留。', observations: [], status: id === 'armor-temper' && promoted ? 'ACTIVE' : 'AVAILABLE', method: id === 'armor-temper' && promoted ? 'ABILITY' : null, result: null, contactOpen: id === 'armor-temper' && promoted, returned: false, closes: 0, attempts: id === 'armor-temper' && promoted ? [a] : [] })), actions: [] },
    encounter: { title: '庭院里的通行争议', story: '马丁持自己的原棍提出争议。', status: 'AVAILABLE', inside: false, site: null, startSite: null, enemy: null, actions: [], facts: [] },
    insideCase: promoted, environment: '贝克兰德修护室' };
}
function renderView(value: GloryProjection, extra: { busy?: boolean; blocked?: boolean; error?: string | { message: string; retryable?: boolean } | null } = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), props = { value, busy: false, error: null, onCommand, onClose, ...extra };
  return { ...render(<GloryPanel {...props}/>), props, onCommand, onClose };
}
function copyIsNatural(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/候选|原文未核|原创G|本作G|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  expect(node.textContent).not.toMatch(/"(?:playerEnergy|armorSource|appliedAbilityIds)"\s*:/);
}
async function choose(a: GloryAction) {
  const button = screen.getByRole('button', { name: name => name.startsWith(a.label) });
  await userEvent.click(button); return button;
}
const confirm = () => within(screen.getByRole('dialog')).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一药瓶)$/ });
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
beforeEach(() => Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); });

describe('Glory independent confirmations and committed-state gates', () => {
  const acquisitions: [GloryCommand, string, string][] = [
    [{ type: 'LEARN_GUIDANCE' }, '听取荣耀者成品与专业准备指导', '1行动 · 500便士'],
    [{ type: 'BUY_POTION', bottleId: 'glory-potion-2' }, '支付本瓶余款并领取原瓶', '0行动 · 900便士'],
    [{ type: 'PREPARE_PROMOTION' }, '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效'],
    [{ type: 'CONSUME', bottleId: 'glory-potion-2', confirmed: true }, '服用第2瓶荣耀者成品魔药', '0行动 · 意志30 · 耗用本瓶与当次检查'],
  ];
  it.each(acquisitions)('%s shows its own real costs and submits only after confirmation', async (command, label, cost) => {
    const value = view(false), a = action(command, label, cost); value.actions = [a]; const before = structuredClone(value), ui = renderView(value);
    await choose(a); const dialog = screen.getByRole('dialog'); expect(dialog.textContent).toContain(cost); copyIsNatural(dialog);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
    await userEvent.click(confirm()); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(ui.onCommand.mock.calls[0]![0]).toBe(a.command);
  });
  it('keeps the selected original bottle, cancels without costs, restores focus and prevents double submission', async () => {
    const value = view(false), a = action(acquisitions[3]![0], acquisitions[3]![1], consumeCost()); value.actions = [a]; const ui = renderView(value), saved = structuredClone(value);
    const trigger = screen.getByRole('button', { name: name => name.startsWith(a.label) });
    expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).value).toBe('glory-potion-2');
    for (const mode of ['button', 'escape', 'native']) {
      await userEvent.click(trigger); const dialog = screen.getByRole('dialog'), cancel = within(dialog).getByRole('button', { name: '取消，返回查看' });
      expect(document.activeElement).toBe(cancel);
      for (const text of ['第2瓶荣耀者成品魔药', '当前成功率72%', '无论成功失败都会耗尽', '费用不退', '十八项已有掌握', '不补满当前灵性', '不修复原银甲']) expect(dialog.textContent).toContain(text);
      if (mode === 'button') await userEvent.click(cancel); else if (mode === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' }); else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(ui.onCommand).not.toHaveBeenCalled();
    }
    await userEvent.click(trigger); const submit = confirm(); fireEvent.click(submit); fireEvent.click(submit);
    expect(ui.onCommand).toHaveBeenCalledOnce(); expect(value).toEqual(saved);
  });
  it('holds one pending command through save denial, unchanged clones and error dismissal', async () => {
    const value = view(false), a = action(acquisitions[3]![0], acquisitions[3]![1], consumeCost()); value.actions = [a]; const ui = renderView(value);
    await choose(a); fireEvent.click(confirm()); ui.rerender(<GloryPanel {...ui.props} busy/>);
    for (const error of [{ message: '本次保存被拒绝', retryable: true }, null]) {
      ui.rerender(<GloryPanel {...ui.props} value={structuredClone(value)} error={error}/>);
      for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
      for (const select of screen.getAllByRole('combobox', { hidden: true })) expect((select as HTMLSelectElement).disabled).toBe(true);
      expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).toHaveBeenCalledOnce(); expect(ui.onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /重试/, hidden: true })).toBeNull();
    }
    const committed = structuredClone(value); committed.bottles[1]!.status = '已耗尽，实际晋升'; committed.resources!.mind = 70;
    ui.rerender(<GloryPanel {...ui.props} value={committed} error="仍待同一次保存"/>); expect(screen.queryByRole('dialog')).toBeNull();
    ui.rerender(<GloryPanel {...ui.props} value={committed}/>); expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: '荣耀者' }).getAttribute('aria-busy')).toBe('false'); expect(ui.onCommand).toHaveBeenCalledOnce();
  });
  it.each([{ busy: true }, { blocked: true }, { error: '保存被拒绝' }])('rejects interaction while %s', extra => {
    const value = view(false), a = action({ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动 · 500便士'); value.actions = [a]; const ui = renderView(value, extra);
    const button = screen.getByRole('button', { name: /听取专业指导/ }); expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onClose).not.toHaveBeenCalled();
  });
  it('shows an explicit blocked reason and invalidates an unsubmitted confirmation when facts change', async () => {
    const value = view(false), a = action({ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动 · 500便士'); value.actions = [a]; const ui = renderView(value); await choose(a);
    const changed = structuredClone(value); changed.actions[0]!.enabled = false; changed.actions[0]!.reason = '现金不足，先取得500便士。';
    ui.rerender(<GloryPanel {...ui.props} value={changed}/>); expect(screen.queryByRole('dialog')).toBeNull();
    const denied = screen.getByRole('button', { name: /听取专业指导/ }); expect((denied as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(denied.getAttribute('aria-describedby')!)?.textContent).toContain('现金不足'); fireEvent.click(denied); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it('contains keyboard focus within a confirmation', async () => {
    const value = view(false), a = action({ type: 'LEARN_GUIDANCE' }, '听取专业指导', '1行动 · 500便士'); value.actions = [a]; const ui = renderView(value); await choose(a);
    const dialog = screen.getByRole('dialog'), controls = within(dialog).getAllByRole('button'); controls[0]!.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(controls.at(-1));
    controls.at(-1)!.focus(); fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(controls[0]); expect(ui.onCommand).not.toHaveBeenCalled();
  });
});
function consumeCost() { return '0行动 · 意志30 · 耗用本瓶与当次检查'; }

describe('Glory original armor, real resources and distinct skills', () => {
  it('separates all18 inherited mastery values from the two new zero values', async () => {
    const value = view(); const ui = renderView(value); const fresh = screen.getByRole('region', { name: '荣耀者两项新技巧' });
    await userEvent.click(screen.getByText('身体与已有经历')); const inherited = screen.getByRole('region', { name: '荣耀者十八项已有掌握' });
    expect(within(inherited).getAllByText(/· 掌握/)).toHaveLength(18); expect(within(fresh).getAllByText(/· 掌握/)).toHaveLength(2);
    for (const [, label, mastery] of INHERITED) { expect(inherited.textContent).toContain(`${label} · 掌握${mastery}`); expect(fresh.textContent).not.toContain(`${label} · 掌握`); }
    expect(fresh.textContent).toContain('银甲淬护 · 掌握0'); expect(fresh.textContent).toContain('近身护持 · 掌握0');
    expect(ui.container.textContent).toContain('当前身体性别：女性'); expect(ui.container.textContent).toContain('旧阶段页面只供查看已有记录');
    copyIsNatural(inherited); copyIsNatural(fresh); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it('shows old65 and current60 as one original armor, with real paid and consumed resources outside folds', () => {
    const value = view(), saved = structuredClone(value), ui = renderView(value), armor = screen.getByRole('region', { name: '荣耀者同一银甲与当前物资' }), people = screen.getByRole('region', { name: '荣耀者当前位置与本案许可' });
    expect(armor.closest('details')).toBeNull(); expect(people.closest('details')).toBeNull();
    for (const text of ['白银骑士时期留存完整度65/100', '同一件银甲当前完整度60/100', '原物编号：SK3-LIFE-ARMOR', '剩余1枚 · 已耗1枚', '剩余0次 · 已施加1次', '实付20便士，已经耗尽', '仍须交回修护台']) expect(armor.textContent).toContain(text);
    expect(armor.textContent?.match(/SK3-LIFE-ARMOR/g)).toHaveLength(1);
    for (const text of ['西莉娅，41岁', '埃文，36岁', '本场精力94/100', '累计普通步行6米', '本案许可', '普通侧路许可已同意本案用途']) expect(people.textContent).toContain(text);
    const resources = screen.getByRole('region', { name: '荣耀者当前资源' }); expect(resources.closest('details')).toBeNull(); expect(resources.textContent).toContain('114/120');
    copyIsNatural(armor); copyIsNatural(people); expect(value).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled();
  });
  it('does not claim that a successful unused check has applied protection or gained mastery', () => {
    const value = view(), a = value.life.currentAttempt!; a.appliedAbilityIds = []; a.loadApplied = false; a.armorWear = 0; a.window = 'ACTIVE'; value.life.site.temper = { active: true, expiresAt: 44 };
    renderView(value); const current = screen.getByRole('region', { name: '荣耀者本次尝试' });
    expect(current.textContent).toContain('检定成功，但尚无实际应用'); expect(current.textContent).toContain('实际应用：无');
    expect(current.textContent).toContain('实耗6灵性、20便士'); expect(screen.getByRole('region', { name: '荣耀者两项新技巧' }).textContent).toContain('银甲淬护 · 掌握0');
  });
  it('shows actual personal crossing costs before submitting the exact crossing command', async () => {
    const value = view(), a = action({ type: 'CROSS_BRIDGE', caseId: 'close-guard' }, '与埃文实际过桥并承受分担', '0行动 · 11精力 · 5健康负担 · 两人各6米/秒');
    value.life.activeCase = 'close-guard'; value.actions = [a]; const ui = renderView(value); await choose(a); const dialog = screen.getByRole('dialog');
    for (const text of ['各用自己的身体步行6米', '本人另承担5健康与5精力', '共付11精力', '8米普通侧路实际返回', '不获得报酬']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled(); await userEvent.click(confirm()); expect(ui.onCommand.mock.calls[0]![0]).toBe(a.command);
  });
  it('keeps actual stop and the separately consented ordinary route available after permission withdrawal', async () => {
    const value = view(); value.life.activeCase = 'revoked-crossing'; value.life.currentAttempt = attempt(value.life.site, { actorId: 'GL2-CELIA', permissionWithdrawn: true, ownerConsent: 'WITHDRAWN', routeConsent: 'GRANTED', abilityTier: null, appliedAbilityIds: [], loadApplied: false, armorWear: 0, spiritualitySpent: 0, window: 'NONE' });
    const stop = action({ type: 'STOP', caseId: 'revoked-crossing' }, '停止新的能力使用', '0行动'); value.actions = [stop]; const ui = renderView(value);
    expect((screen.getByRole('button', { name: '关闭荣耀者页面' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看实践' }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '荣耀者当前位置与本案许可' }).textContent).toContain('已撤回能力许可，不能继续施术');
    await choose(stop); expect(ui.onCommand.mock.calls[0]![0]).toBe(stop.command); expect(ui.onClose).not.toHaveBeenCalled();
    const saved = structuredClone(value), route = action({ type: 'ORDINARY_CROSS', caseId: 'revoked-crossing' }, '和当事人改走普通侧路', '1行动 · 8精力 · 两人各8米/秒'); saved.life.currentAttempt!.stopped = true; saved.actions = [route];
    ui.rerender(<GloryPanel {...ui.props} value={saved}/>); await choose(route); const dialog = screen.getByRole('dialog');
    for (const text of ['8米普通侧路', '各付8精力', '已撤回的能力许可保持撤回', '不取得新能力掌握']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).toHaveBeenCalledOnce(); expect(ui.onClose).not.toHaveBeenCalled();
  });
  it('uses current downstream armor wear and actual original Martin resources after encounter entry', async () => {
    const value = view(); value.life.site.armor!.integrity = 55; value.life.currentArmorIntegrity = 55; value.life.currentAttempt = null; value.life.activeCase = null;
    value.life.site.playerLocation = 'YARD'; value.life.site.celia.location = 'OUTSIDE'; value.life.site.evan.location = 'OUTSIDE';
    value.encounter = { ...value.encounter, status: 'READY', inside: true, site: structuredClone(value.life.site), startSite: site(), enemy: { id: 'GL2-MARTIN', name: '马丁', age: 45, sequence: 3, health: 70, mind: 100, spirituality: 65, status: 'RESISTING', weaponId: 'GL2-MARTIN-CLUB', weaponLocation: 'HAND', powerUses: { FORCE_STRIKE: 7, GUARD: 3, DISCERN: 2 } }, facts: ['本人有2米普通退出路线。'] };
    const leave = action({ type: 'LEAVE_ENCOUNTER' }, '沿普通出口离开庭院', '0行动 · 2米 · 2秒 · 2精力'); value.actions = [leave]; const ui = renderView(value);
    const armor = screen.getByRole('region', { name: '荣耀者同一银甲与当前物资' }); expect(armor.textContent).toContain('同一件银甲当前完整度55/100'); expect(armor.textContent).toContain('白银骑士时期留存完整度65/100');
    const encounter = screen.getByRole('region', { name: '荣耀者可选遭遇' });
    for (const text of ['马丁，45岁', '健康70/100', '独立灵性65/120', '仍在马丁手中', '本场没有同伴参战', '近身护持只用于本人守势', '原洛肯']) expect(encounter.textContent).toContain(text);
    await choose(leave); const dialog = screen.getByRole('dialog'); for (const text of ['步行2米', '耗2秒和2精力', '原棍留在庭院']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled(); copyIsNatural(encounter);
  });
});
