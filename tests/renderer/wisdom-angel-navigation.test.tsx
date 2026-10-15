/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { WisdomAngelPanel } from '../../src/renderer/WisdomAngelPanel';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent } from '../../src/domain/slice/types';
import {
  ENTRY, PREPARATION_ENTRY, PANEL, NEW_IDS, snapshot, naturalEntry, boundaryForIntent, commandBoundary,
  capturedCommand, savedGame, mountGame, commandControl, actionButton, settled, view,
  confirmationName, confirmLabel, clickCommand, assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './wisdom-angel-helper';

const OLD_LIVING = 'tests/fixtures/insight-scholar-v01460/peaceful.json';
const OLD_DEATH = 'tests/fixtures/insight-scholar-v01460/natural.json';

describe('Wisdom Angel candidate navigation and the same original saved body', () => {
  it('keeps all 423 living public commands, the independent 425-command death branch and the genuine H100 untreated injury', async () => {
    const oldCommands = readObjectEntry<SliceIntent[]>(OLD_LIVING, 'commands');
    const commands = naturalEntry<SliceIntent[]>('commands');
    expect(oldCommands).toHaveLength(423); expect(naturalEntry<number>('prefixCount')).toBe(423);
    expect(commands.length).toBeGreaterThan(423); expect(commands.slice(0, 423)).toEqual(oldCommands);
    const departure = snapshot('departureStart');
    expect(departure).toEqual(migrateSliceState(readObjectEntry(OLD_LIVING, 'final')));
    expect(departure).toMatchObject({ week: 106, status: 'ACTIVE', health: 100, mind: 100, spirituality: 120, cash: 640, actionsRemaining: 1, injuryRisk: 1, random: { seed: 'reader-natural-v023', cursor: 173 }, progression: { pathwayId: 'white-tower', sequence: 3, acting: 100 } });
    expect(departure.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toHaveLength(1);
    expect(departure.insightScholar.promotionWeek).toBe(99);
    const deathCommands = readObjectEntry<SliceIntent[]>(OLD_DEATH, 'commands');
    expect(deathCommands).toHaveLength(425); expect(deathCommands.slice(0, 421)).toEqual(oldCommands.slice(0, 421));
    expect(migrateSliceState(readObjectEntry(OLD_DEATH, 'final'))).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
    const game = savedGame(departure), before = structuredClone(game.state);
    await mountGame(game, false);
    const guidance = screen.getByRole('region', { name: '接下来' }), recovery = projectSliceState(before).recovery;
    expect(recovery.healthFullWithInjuries).toBe(true); expect(recovery.untreatedHeavyCount).toBe(1);
    expect(guidance.textContent).toContain('健康已满，先处理仍在的伤势');
    expect(guidance.textContent).toContain(recovery.summary); expect(guidance.textContent).toContain(recovery.guidance);
    expect(guidance.textContent).toContain('支付60便士'); expect(guidance.textContent).toContain('后来一次休养');
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = screen.getByRole('region', { name: PANEL });
    const risk = within(panel).getByText(view(before).risk); expect(risk.closest('details')).toBeNull();
    expect(risk.textContent).toContain('治疗仍须真实发现诊所、支付实际费用并后续休养');
    await userEvent.click(screen.getByRole('button', { name: '关闭智慧天使页面' }));
    expect(screen.getByRole('region', { name: '接下来' }).textContent).toContain(recovery.guidance);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('routes actual S3 growth to its current history and the preparation shortcut to the unverified S2 candidate', async () => {
    const game = savedGame(snapshot('guidanceStart')), before = structuredClone(game.state);
    expect(before.progression).toMatchObject({ pathwayId: 'white-tower', sequence: 3, acting: 100 });
    await mountGame(game, false);
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: '洞悉者' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭洞悉者页面' }));
    await userEvent.click(screen.getByRole('button', { name: PREPARATION_ENTRY }));
    const panel = screen.getByRole('region', { name: PANEL });
    const warning = within(panel).getByText('晋升须取得独立成品并完成专业准备。下一序列1尚未开放；判断仍须依据当前实际资料。');
    expect(warning.closest('details')).toBeNull();
    expect(view(before).formulaKnown).toBe(false); expect(view(before).formula).toEqual([]);
    for (const text of ['晋升须取得独立成品并完成专业准备', '完整配方', '材料、用量、调配顺序与仪式要求保持未知', '当前亲眼观察']) expect(panel.textContent).toContain(text);
    await userEvent.click(screen.getByRole('button', { name: '关闭智慧天使页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced'] as const)('opens actual %s S2 growth with exactly19 unique abilities and no reopened older live cases', async name => {
    const game = savedGame(snapshot(name)), before = structuredClone(game.state), old = snapshot('departureStart');
    const state = projectSliceState(before), value = view(before), ids = value.abilities.map(a => a.id);
    expect(before.progression.sequence).toBe(2); expect(ids).toHaveLength(19); expect(new Set(ids).size).toBe(19);
    expect(ids.slice(-2)).toEqual([...NEW_IDS]); expect(Object.keys(before.progression.mastery).sort()).toEqual([...Object.keys(old.progression.mastery), ...NEW_IDS].sort());
    for (const [id, mastery] of Object.entries(old.progression.mastery)) expect(before.progression.mastery[id]).toBe(mastery);
    if (name === 'promoted') expect(value.abilities.slice(-2).map(a => a.mastery)).toEqual([0, 0]);
    for (const key of ['reader', 'reasoner', 'detective', 'polymath', 'prophet', 'insightScholar'] as const) {
      expect(before[key]).toEqual(old[key]); expect(state[key].actions).toEqual([]);
    }
    expect(state.mysticismMagister.actions).toEqual([]);
    expect(before.mysticismMagister.cases).toEqual(old.mysticismMagister.cases);
    expect(before.mysticismMagister.crafts.slice(0, old.mysticismMagister.crafts.length)).toEqual(old.mysticismMagister.crafts);
    expect(before.insightScholar.encounter).toMatchObject({ targetId: 'IS3-ALTON', status: 'RESOLVED', attemptWeek: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND', seenPowers: [] });
    expect(before.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', health: 70, status: 'SURRENDERED', weaponLocation: 'YARD' });
    expect(before.wisdomAngel.insightScholarActingAtPromotion).toBe(100);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = screen.getByRole('region', { name: PANEL });
    await userEvent.click(within(panel).getByText('三案历史与新掌握', { selector: 'summary' }));
    for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    await userEvent.click(within(panel).getByText('原身体与七阶历史', { selector: 'summary' }));
    for (const text of ['不免费治疗或补灵', '不创建新身体', '原阿尔顿IS3-ALTON', '原哈罗德PF4-HAROLD', '原和平收尾、伤亡或投降不重开']) expect(panel.textContent).toContain(text);
    expect(value.currentGender).toBe(old.character.gender);
    await userEvent.click(screen.getByRole('button', { name: '关闭智慧天使页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('renders the actual saved %s resources and unverified source boundary without mutation', type => {
    renderBoundaryProjection(commandBoundary(type));
  });
});

describe('Wisdom Angel actual medical preparation', () => {
  it('uses the real ordinary clinic discovery control without interpreting health100 as treatment', async () => {
    const captured = boundaryForIntent(intent => intent.type === 'ACTION' && intent.action === 'INVESTIGATE' && intent.targetId === 'CARE-ACCESS-01', entry => entry.beforeLast.revision >= snapshot('departureStart').revision);
    const game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game, false);
    await userEvent.click(screen.getByRole('button', { name: /^调查，1行动/ }));
    await userEvent.click(within(screen.getByRole('dialog', { name: '选择调查目标' })).getByRole('button', { name: name => name.startsWith('核实普通诊疗点') }));
    await waitFor(() => expect(game.state).toEqual(captured.final));
    expect(game.state.careKnown).toBe(true); expect(game.state.injuries).toEqual(before.injuries); expect(game.state.cash).toBe(before.cash);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('pays the original60p medical event while retaining treated heavy injury until a later actual rest', async () => {
    const captured = boundaryForIntent(intent => intent.type === 'EVENT_CHOICE' && intent.choiceId === 'PAY', entry => entry.beforeLast.revision >= snapshot('departureStart').revision && entry.beforeLast.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) && entry.final.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision !== null));
    const game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game, false);
    await userEvent.click(screen.getByRole('button', { name: name => name.startsWith('支付60便士处置') }));
    await waitFor(() => expect(game.state).toEqual(captured.final));
    expect(game.state.cash).toBe(before.cash - 60); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.injuries.map(i => i.id)).toEqual(before.injuries.map(i => i.id)); expect(game.state.injuryRisk).toBe(before.injuryRisk);
    const recovery = projectSliceState(game.state).recovery;
    expect(recovery.untreatedHeavyCount).toBe(0); expect(recovery.treatedHeavyCount).toBeGreaterThan(0); expect(recovery.guidance).toContain('实际休养');
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('clears the treated original wound only through the captured later REST and saves its genuine result', async () => {
    const captured = boundaryForIntent(intent => intent.type === 'ACTION' && intent.action === 'REST', entry => entry.beforeLast.revision >= snapshot('departureStart').revision && entry.beforeLast.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision !== null) && entry.final.injuries.length < entry.beforeLast.injuries.length);
    const game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game, false); await userEvent.click(screen.getByRole('button', { name: /^休养，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(captured.final));
    expect(game.state.health).toBeGreaterThanOrEqual(80); expect(game.state.injuries).toEqual([]); expect(game.state.injuryRisk).toBe(0);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);
});

describe('Wisdom Angel independent confirmations, save locks and physical exit', () => {
  it.each(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('cancels %s by pointer, Escape and native dialog cancel, then commits only one original envelope', async type => {
    const captured = commandBoundary(type, type === 'CONSUME' ? entry => entry.final.progression.sequence === 2 : undefined);
    const game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command), reviewName = confirmationName(command);
    await userEvent.click(trigger); let review = screen.getByRole('dialog', { name: reviewName });
    const cancel = within(review).getByRole('button', { name: '取消，返回查看' });
    expect(document.activeElement).toBe(cancel); expect(game.submit).not.toHaveBeenCalled();
    if ('bottleId' in command) expect(review.textContent).toContain(command.bottleId);
    if (type === 'CONSUME') {
      expect(review.textContent).toContain(view(before).risk);
      for (const text of ['旧17掌握', '当前灵性不补满', "本瓶和当次准备成功失败均耗尽；旧17掌握、原人原物、旧死亡与和平结局、伤势及风险保留。当前灵性不补满，完整配方与晋升仪式细节尚未掌握，服药前仍须完成专业准备。", '大成功', '成功', '失败', '灾难']) expect(review.textContent).toContain(text);
      expect(within(review).queryByRole('checkbox')).toBeNull();
    }
    await userEvent.click(cancel); expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(game.state).toEqual(before); await userEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog', { name: reviewName }), { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); fireEvent(screen.getByRole('dialog', { name: reviewName }), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: reviewName })).toBeNull(); expect(game.state).toEqual(before);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: reviewName });
    const confirm = within(review).getByRole('button', { name: confirmLabel(command) }); fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(captured.final); assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
    if (type === 'LEARN_GUIDANCE') expect(game.state.cash).toBe(before.cash - 500);
    if (command.type === 'BUY_POTION') {
      const bottle = before.wisdomAngel.bottles.find(b => b.id === command.bottleId)!;
      expect(game.state.cash).toBe(before.cash - (bottle.labourSteps === 5 ? 800 : 6200));
      expect(game.state.wisdomAngel.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: 'PLAYER', consumedWeek: null });
      expect(game.state.wisdomAngel.preparedWeek).toBeNull(); expect(game.state.progression.sequence).toBe(3);
    }
    if (type === 'PREPARE_PROMOTION') { expect(game.state.cash).toBe(before.cash - 120); expect(game.state.wisdomAngel.preparedWeek).toBe(before.week); }
    if (command.type === 'CONSUME') {
      expect(game.state.wisdomAngel.bottles.find(b => b.id === command.bottleId)?.status).toBe('CONSUMED');
      expect(game.state.wisdomAngel.preparedWeek).toBeNull(); expect(game.state.spirituality).toBe(before.spirituality);
      expect(game.state.injuries).toEqual(before.injuries); expect(game.state.injuryRisk).toBe(before.injuryRisk);
      expect(game.state.wisdomAngel.insightScholarActingAtPromotion).toBe(100); expect(game.state.wisdomAngel.life).toEqual(before.wisdomAngel.life);
      expect(Object.keys(game.state.progression.mastery)).toHaveLength(19); expect(NEW_IDS.map(id => game.state.progression.mastery[id])).toEqual([0, 0]);
    }
  }, 20_000);

  it.each(['BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('keeps pending and failed %s locked and retries the identical saved envelope without double spending', async type => {
    const captured = commandBoundary(type), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true });
    const before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); await userEvent.click(await commandControl(game.state, command));
    await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert'); await settled();
    expect(game.state).toEqual(before); expect(actionButton(game.state, command).disabled).toBe(true);
    expect(screen.queryByRole('dialog', { name: confirmationName(command) })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('保存错误未解除原意图锁');
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(captured.final); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('does not treat clearing an error with unchanged saved facts as a commit receipt', async () => {
    const captured = commandBoundary('BUY_POTION'), before = captured.beforeLast, command = capturedCommand(captured);
    const onCommand = vi.fn(), onClose = vi.fn(), props = { value: view(before), busy: false, error: null, onCommand, onClose };
    const mounted = render(<WisdomAngelPanel {...props}/>);
    await userEvent.click(await commandControl(before, command));
    fireEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
    mounted.rerender(<WisdomAngelPanel {...props} busy/>);
    mounted.rerender(<WisdomAngelPanel {...props} error="本次原操作尚未保存"/>);
    expect(screen.queryByRole('dialog', { name: confirmationName(command) })).toBeNull();
    mounted.rerender(<WisdomAngelPanel {...props}/>);
    expect(actionButton(before, command).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '关闭智慧天使页面' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(actionButton(before, command)); expect(onCommand).toHaveBeenCalledOnce(); expect(onClose).not.toHaveBeenCalled();
    mounted.rerender(<WisdomAngelPanel {...props} value={view(captured.final)}/>);
    expect(screen.queryByRole('dialog', { name: confirmationName(command) })).toBeNull();
    expect(screen.queryByText(/已提交同一次意图/)).toBeNull();
    expect((screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement).disabled).toBe(false);
    expect(onCommand).toHaveBeenCalledOnce();
  });

  it('leaves an actual paid preparation at zero AP cost without refunding cash, consuming its bottle or reopening any old scene', async () => {
    // A deliberate alternative public choice from a real capture, not a rewritten natural save.
    const prepared = commandBoundary('PREPARE_PROMOTION').final, game = savedGame(prepared), before = structuredClone(game.state);
    const command = { type: 'LEAVE_PREPARATION' } as const;
    const expected = applySliceIntent(before, { type: 'WISDOM_ANGEL', command });
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭智慧天使页面' })).toBeNull();
    const control = await commandControl(game.state, command); expect(control.disabled).toBe(false); expect(control.textContent).toContain('0行动');
    await clickCommand(game, command); expect(game.state).toEqual(expected);
    expect(game.state.wisdomAngel.preparedWeek).toBeNull(); expect(game.state.wisdomAngel.bottles).toEqual(before.wisdomAngel.bottles);
    expect(game.state.cash).toBe(before.cash); expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.random).toEqual(before.random);
    assertLegacyPreserved(before, game.state); assertSavedEnvelope(game, before, { type: 'WISDOM_ANGEL', command });
    await userEvent.click(screen.getByRole('button', { name: '关闭智慧天使页面' }));
    expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy();
  }, 20_000);

  it('separately confirms actual inherited paid FLASH crafting and preserves old case records even when its check fails', async () => {
    const captured = commandBoundary('MAKE_INHERITED_FLASH'), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const section = screen.getByRole('region', { name: '实际旧法生产' });
    for (const text of ['160便士', '4灵性', '知识16', '每真实周最多一次', '失败照付且不出新片']) expect(section.textContent).toContain(text);
    const trigger = await commandControl(game.state, command); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of ['1行动', '160便士', '4灵性', '失败成本照付且没有新片']) expect(review.textContent).toContain(text);
    expect(game.submit).not.toHaveBeenCalled(); await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); await userEvent.click(trigger); review = screen.getByRole('dialog', { name: confirmationName(command) });
    await userEvent.click(within(review).getByRole('button', { name: confirmLabel(command) })); await settled();
    expect(game.state).toEqual(captured.final); assertSavedEnvelope(game, before, captured.lastIntent);
    expect(game.state.cash).toBe(before.cash - 160); expect(game.state.spirituality).toBe(before.spirituality - 4); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.mysticismMagister.craftAttemptWeek).toBe(before.week);
    expect(game.state.mysticismMagister.practice.kitsUsed).toBe(before.mysticismMagister.practice.kitsUsed + 1);
    expect(game.state.mysticismMagister.cases).toEqual(before.mysticismMagister.cases);
    expect(game.state.mysticismMagister.crafts.slice(0, before.mysticismMagister.crafts.length)).toEqual(before.mysticismMagister.crafts);
    expect(game.state.polymath.samples).toEqual(before.polymath.samples); expect(game.state.insightScholar).toEqual(before.insightScholar); expect(game.state.prophet).toEqual(before.prophet);
    expect(game.state.progression).toEqual(before.progression); expect(actionButton(game.state, command).disabled).toBe(true);
    const made = game.state.mysticismMagister.crafts.slice(before.mysticismMagister.crafts.length);
    expect(made.length).toBeLessThanOrEqual(1);
    if (made.length) expect(made[0]).toMatchObject({ sourceKitId: `MM5-KIT-${game.state.mysticismMagister.practice.kitsUsed}`, createdWeek: before.week, status: 'PLAYER', usedWeek: null });
    else expect(game.state.mysticismMagister.crafts).toEqual(before.mysticismMagister.crafts);
    fireEvent.click(actionButton(game.state, command)); expect(game.submit).toHaveBeenCalledOnce();
  }, 20_000);

  it('reopens the practiced saved game with its supplied recovery notice without granting consent or clearing old histories', async () => {
    // Renderer bridge mock only; real SQLite recovery is verified by separate integration execution.
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mountGame(game, true, '已从SQLite最近可恢复备份恢复；当前显示上次已保存记录。');
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    expect(game.state.wisdomAngel.life.reflected).toBe(true); expect(game.state.wisdomAngel.life.activeCase).toBeNull();
    expect(Object.values(game.state.wisdomAngel.life.cases).every(entry => entry.status === 'RESOLVED' && !entry.contactOpen)).toBe(true);
  }, 20_000);

  it('reloads the actual natural ending without assuming survival or reviving either original enemy', async () => {
    const final = snapshot('final'), game = savedGame(final), before = structuredClone(game.state);
    await mountGame(game);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    expect(game.state.insightScholar).toEqual(snapshot('departureStart').insightScholar);
    expect(game.state.prophet).toEqual(snapshot('departureStart').prophet);
    if (before.ending) {
      expect(screen.getByRole('heading', { name: before.ending.title })).toBeTruthy();
      if (before.status === 'DEAD') {
        expect(before.health).toBe(0); expect(before.ending.kind).toBe('DEATH');
        expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull(); expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
      }
    } else if (before.combat) {
      expect(screen.getByRole('dialog', { name: projectSliceState(before).combat!.title ?? "普通人追击" })).toBeTruthy();
    } else {
      expect(screen.getByRole('region', { name: PANEL })).toBeTruthy();
      if (!view(before).insideCase) {
        await userEvent.click(screen.getByRole('button', { name: '关闭智慧天使页面' }));
        expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy();
      }
    }
    cleanup(); delete window.sliceGame;
  }, 20_000);
});
