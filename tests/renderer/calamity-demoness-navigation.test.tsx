/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { CalamityDemonessCommand } from '../../src/domain/calamity-demoness/types';
import { CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL, CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL } from '../../src/domain/calamity-demoness/combat';
import { UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL, UNAGING_DEMONESS_ENEMY_COUNT_WHEEL } from '../../src/domain/unaging-demoness/combat';
import { playerText } from '../../src/shared/player-text';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/calamity-demoness-v01770';
const OLD = 'tests/fixtures/unaging-demoness-v01530/natural.json';
const PANEL = '灾难魔女', ENTRY = '灾难魔女与镜廊附室';
const LEGACY = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness'] as const;
const NEW_IDS = ['assassin.s2.mirror-screen', 'assassin.s2.black-flame-channel'] as const;
const CASES = ['mirror-screen', 'black-flame-channel', 'revoked-window'] as const;
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
// Read actual unchanged public captures. Never invent a route or replace its random stream.
// Streaming top-level entries avoids retaining all historical state trees in jsdom.
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
function boundary(name: string): Boundary {
  if (!index[name]) throw new Error(`Missing actual CalamityDemoness boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { beforeLast: migrateSliceState(readObjectEntry(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry(file, 'final')) };
}
function snapshot(name: 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart'): SliceState {
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
}
const view = (state: SliceState) => projectSliceState(state).calamityDemoness;
function commandOf(entry: Boundary): CalamityDemonessCommand {
  if (entry.lastIntent.type !== 'CALAMITY_DEMONESS') throw new Error('Expected the recorded public CalamityDemoness command.');
  return entry.lastIntent.command;
}
function savedGame(input: unknown, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0, releaseFirstSave = () => {};
  assertValidSliceState(state);
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const,
      error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-14T08:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-14T07:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeReveal() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openCalamityDemoness(game: SavedGame) {
  await mount(game); await acknowledgeReveal();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: CalamityDemonessCommand): HTMLButtonElement {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: CalamityDemonessCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of LEGACY) expect(after[key]).toEqual(before[key]);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) {
    if (!NEW_IDS.includes(id as typeof NEW_IDS[number])) expect(after.progression.mastery[id]).toBe(mastery);
  }
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function fact(section: HTMLElement, label: string): string {
  return within(section).getByText(label, { selector: 'dt' }).closest('div')!.querySelector('dd')!.textContent!;
}
function assertRecordedBodyWheel(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.calamityDemonessOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).not.toContain('精神后果盘');
  if (round.consequenceWeights) {
    const w = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`);
  }
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});


function naturalCopy(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/候选|原文未核|原创G|本作G|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  expect(node.textContent).not.toMatch(/银甲|近身护持|白银骑士|"(?:playerEnergy|siteAtStart|appliedAbilityIds)"\s*:/);
}

describe('Calamity Demoness actual saved growth navigation', () => {
  it('preserves the natural S3 departure, gives recovery priority and separates current growth from S2 preparation', async () => {
    const original = migrateSliceState(readObjectEntry(OLD, 'final'));
    const game = savedGame(snapshot('departureStart')), before = structuredClone(game.state);
    expect(before).toEqual(original);
    expect(before.progression).toMatchObject({ pathwayId: 'demoness', sequence: 3, acting: 100 });
    expect(before).toMatchObject({ health: 70, spirituality: 111, character: { gender: 'FEMALE' } });
    expect(before.injuries).toHaveLength(1);
    expect(before.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    await mount(game); await acknowledgeReveal();
    expect(screen.getByText(`不老魔女 · 序列3 · ${projectSliceState(before).character.professionName}`, { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('先查看伤势恢复路线')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: '伤势与恢复路线' })).getByRole('button', { name: '查看普通诊疗点' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: '不老魔女' });
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('不老魔女3 → 灾难魔女2');
    expect(within(panel).getByRole('region', { name: '灾难魔女独立药瓶与准备' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '不老魔女' })).toBeNull(); naturalCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭灾难魔女页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced'] as const)('opens actual %s S2 growth, keeps all16 inherited skills and closes/backtracks without altering saved facts', async name => {
    const game = savedGame(snapshot(name)), before = structuredClone(game.state), actual = view(before);
    expect(before.progression.sequence).toBe(2); expect(before.lastCombatRound?.unagingDemonessOutcome).toBeTruthy();
    expect(actual.abilities).toHaveLength(18); expect(Object.keys(before.progression.mastery)).toHaveLength(18);
    assertLegacy(snapshot('departureStart'), before);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByText(`灾难魔女 · 序列2 · ${projectSliceState(before).character.professionName}`, { selector: 'p' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '不老魔女' })).toBeNull();
    const newSkills = within(panel).getByRole('region', { name: '灾难魔女两项新技巧' });
    await userEvent.click(within(panel).getByText('身体与已有经历', { selector: 'summary' }));
    const inherited = within(panel).getByRole('region', { name: '灾难魔女十六项已有掌握' });
    for (const ability of actual.abilities) {
      expect((NEW_IDS.includes(ability.id as typeof NEW_IDS[number]) ? newSkills : inherited).textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
    }
    const objects = within(panel).getByRole('region', { name: '灾难魔女原镜与当前物资' });
    if (name === 'promoted') {
      for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(0);
      expect(fact(objects, '同一原镜A当前状态')).toBe('尚未当面核对');
    } else {
      const site = before.calamityDemoness.life.site;
      expect(site).toMatchObject({ playerTravelMetres: 72, playerEnergy: 28 });
      expect(site.load).toMatchObject({ initialForce: 12, finalForce: 7, bufferedForce: 5 });
      expect(fact(objects, '唯一封闭负载')).toContain('实际减势5 · 最终7单位');
      expect(fact(objects, '唯一封装残留物')).toContain('CD2-RESIDUE-1 · 已耗尽');
      expect(objects.textContent).toContain('实际磨损5');
      expect(within(panel).getByRole('region', { name: '灾难魔女原人位置与当前许可' }).textContent).toContain('累计普通步行72米');
      for (const id of NEW_IDS) {
        expect(before.progression.mastery[id]).toBe(8);
        expect(before.progression.mastery[id]).toBe(CASES.reduce((n, caseId) => n + before.calamityDemoness.life.cases[caseId].attempts.filter(a => a.appliedAbilityIds.includes(id)).length * 8, 0));
      }
    }
    naturalCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭灾难魔女页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await screen.findByRole('region', { name: PANEL });
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
    await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: label => label.includes(before.character.name) }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('keeps the actual first bottle and RNG unchanged through cancel, duplicate clicks and failed save, then retries the identical envelope', async () => {
    const entry = boundary('actual-promotion'), command = commandOf(entry);
    if (command.type !== 'CONSUME') throw new Error('Expected the recorded first-dose consumption.');
    const game = savedGame(entry.beforeLast, { deferFirstSave: true, failFirstSave: true }), before = structuredClone(game.state);
    await openCalamityDemoness(game); const trigger = await control(before, command);
    await userEvent.click(trigger);
    let review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    expect(review.textContent).toContain(view(before).bottles.find(b => b.id === command.bottleId)!.title);
    naturalCopy(review); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    fireEvent.keyDown(review, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    const confirm = within(review).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(before, command).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(actionButton(before, command).disabled).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull());
    fireEvent.click(actionButton(before, command)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: entry.lastIntent });
    assertLegacy(before, game.state);
    expect(game.state.random).toEqual(entry.final.random); expect(game.state.random.cursor).toBe(before.random.cursor + 1);
    expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.injuryRisk).toBe(before.injuryRisk);
    expect(game.state.calamityDemoness.bottles.filter(b => b.id !== command.bottleId)).toEqual(before.calamityDemoness.bottles.filter(b => b.id !== command.bottleId));
    expect(game.state.calamityDemoness.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS', consumedWeek: 134 });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }, 20_000);
});

describe('Calamity Demoness current battle and actual terminal navigation', () => {
  it('prioritizes Iris over the old Corbin reveal and uses the actual independent enemy wheels while life commands are blocked', async () => {
    const game = savedGame(snapshot('combatStart')), before = structuredClone(game.state), battle = projectSliceState(before).combat!;
    expect(before.combat?.encounterId).toBe('CALAMITY_DEMONESS_DISPUTE'); expect(before.lastCombatRound?.unagingDemonessOutcome).toBeTruthy();
    expect(battle.title).toBe('灾难魔女 · 镜廊外院'); expect(battle.enemyName).toContain('伊瑞丝');
    expect(battle.enemyAbilityWheel).toEqual(CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const dialog = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    const resources = within(dialog).getByRole('region', { name: '灾难魔女本回合实际资源' });
    expect(resources.textContent).toContain('本人健康 100 / 100'); expect(resources.textContent).toContain('独立灵性 120 / 120');
    expect(resources.textContent).toContain('当前没有同行者'); expect(resources.textContent).toContain('CD2-COMBAT-PLATE');
    const panel = screen.getByRole('region', { name: PANEL, hidden: true });
    expect(panel.textContent).toContain('请先处理当前阻塞事项');
    for (const button of within(panel).getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(before.calamityDemoness.encounter.currentSite).toMatchObject({ playerLocation: 'YARD', vera: { location: 'OUTSIDE' }, marcus: { location: 'OUTSIDE' } });
    await userEvent.click(within(dialog).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of CALAMITY_DEMONESS_ENEMY_ABILITY_WHEEL) expect(dialog.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    const count = within(dialog).getByText(/^对手次数盘：/);
    for (const wheel of CALAMITY_DEMONESS_ENEMY_COUNT_WHEEL) expect(count.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    naturalCopy(dialog); naturalCopy(panel);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('submits and reloads the captured first round instead of retaining the old S3 reveal mask', async () => {
    const entry = boundary('combat-round-1'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    if (entry.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected the captured first round.');
    const intent = entry.lastIntent, battle = projectSliceState(before).combat!, option = battle.stances.find(s => s.id === intent.stance)!;
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const stage = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByRole('button', { name: label => label.startsWith(option.label) }));
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    let reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, game.state.lastCombatRound!); assertEnvelope(game, before, intent); assertLegacy(before, game.state); naturalCopy(reveal);
    const saved = structuredClone(game.state); cleanup();
    const reloaded = savedGame(saved); await mount(reloaded);
    reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRecordedBodyWheel(reveal, saved.lastCombatRound!);
    expect(screen.queryByRole('region', { name: '不老魔女' })).toBeNull();
    expect(reloaded.state).toEqual(saved); expect(reloaded.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('reloads the actual BODY roll86 heavy injury and paid failed screen without inventing a battle application', async () => {
    const entry = boundary('combat-body-consequence'), game = savedGame(entry.final), before = structuredClone(game.state), round = before.lastCombatRound!;
    expect(round).toMatchObject({ round: 2, consequenceDomain: 'BODY', consequenceRoll: 86, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    expect(before.health).toBe(70); expect(before.injuries.map(i => i.severity)).toEqual(['HEAVY']);
    expect(round.calamityDemonessOutcome!.playerActions.find(a => a.id === NEW_IDS[0])).toMatchObject({ paidCost: 6, succeeded: false, applied: false, appliedAmount: 0, plateChargeSpent: 0 });
    expect(round.calamityDemonessOutcome!.plateChargesAfter).toBe(3);
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, round); naturalCopy(reveal);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('retains three-round RETREATED, the resisting H100/S97 opponent and current78m location, then commits the saved WORK', async () => {
    const terminal = boundary('combat-terminal'), game = savedGame(terminal.final), before = structuredClone(game.state), e = before.calamityDemoness.encounter;
    expect(before.combat).toBeNull(); expect(before).toMatchObject({ status: 'ACTIVE', health: 70, mind: 100, injuryRisk: 0 });
    expect(before.injuries.map(i => i.severity)).toEqual(['HEAVY']);
    expect(e.terminal).toMatchObject({ outcome: 'RETREATED', round: 3, exitMetres: 2, exitSeconds: 2, playerEnergyPaid: 2 });
    expect(e).toMatchObject({ targetId: 'CD2-IRIS', enemyPosition: 'YARD', enemyHealth: 100, enemySpirituality: 97, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
    expect(e.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 78, playerEnergy: 22, vera: { location: 'OUTSIDE' }, marcus: { location: 'OUTSIDE' } });
    expect(before.calamityDemoness.life.site).toMatchObject({ playerLocation: 'ENTRY', playerTravelMetres: 72, playerEnergy: 28 });
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, before.lastCombatRound!);
    await userEvent.click(within(reveal).getByRole('button', { name: '返回生活' }));
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    const people = within(panel).getByRole('region', { name: '灾难魔女原人位置与当前许可' });
    expect(people.textContent).toContain('本人当前在接触区外（门口外2米）'); expect(people.textContent).toContain('累计普通步行78米');
    expect(people.textContent).not.toContain('累计普通步行72米'); naturalCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭灾难魔女页面' }));
    const ordinary = boundary('ordinary-life-after-actual-exit');
    expect(ordinary.beforeLast).toEqual(before); expect(ordinary.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(ordinary.final).toEqual(migrateSliceState(readObjectEntry(`${ROOT}/natural.json`, 'final')));
    const work = await screen.findByRole('button', { name: /^工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false); await userEvent.click(work);
    await waitFor(() => expect(game.state).toEqual(ordinary.final));
    assertEnvelope(game, before, ordinary.lastIntent); assertLegacy(before, game.state);
    expect(game.state.calamityDemoness.encounter).toEqual(e); expect(game.state.lastCombatRound).toEqual(before.lastCombatRound);
  }, 20_000);
});

describe('Original Unaging Demoness narrow saved-display regression', () => {
  it('uses Corbin title and actual S3 wheels, and displays the legacy domain-less consequence as physical without rewriting it', async () => {
    const oldStart = migrateSliceState(readObjectEntry(OLD, 'combatStart')), game = savedGame(oldStart), before = structuredClone(game.state);
    const battle = projectSliceState(before).combat!;
    expect(battle.title).toBe('不老魔女 · 原镜小院交战'); expect(battle.enemyName).toContain('科宾');
    expect(battle.enemyAbilityWheel).toEqual(UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL.map(w => ({ ...w, label: playerText(w.label) })));
    expect(battle.enemyCountWheel).toEqual(UNAGING_DEMONESS_ENEMY_COUNT_WHEEL.map(w => ({ ...w, label: playerText(w.label) })));
    await mount(game); await acknowledgeReveal();
    const stage = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of battle.enemyAbilityWheel) expect(stage.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    expect(stage.textContent).not.toContain('精神后果盘'); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    cleanup();
    const oldFinal = migrateSliceState(readObjectEntry(OLD, 'final')), round = oldFinal.lastCombatRound!, historical = savedGame(oldFinal);
    expect(round.unagingDemonessOutcome).toBeTruthy(); expect(round.consequenceDomain).toBeUndefined();
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    await mount(historical); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(reveal.textContent).not.toContain('精神后果盘');
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain('败者后果盘：轻伤 65% · 重伤 30% · 死亡 5%');
    expect(historical.state).toEqual(oldFinal); expect(historical.submit).not.toHaveBeenCalled();
  }, 20_000);
});
