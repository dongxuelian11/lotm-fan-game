/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { FATE_PROPHET_CASE_IDS, type FateProphetCaseId } from '../../src/domain/fate-prophet/life.js';
import { FATE_PROPHET_ENEMY_ABILITY_WHEEL, FATE_PROPHET_ENEMY_COUNT_WHEEL } from '../../src/domain/fate-prophet/combat.js';
import { type FateProphetCommand } from '../../src/domain/fate-prophet/types.js';
import type { SliceCombatRound, SliceIntent, SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { fp, dose, oldWheelRoots, originalChaosWalker, prepared, promoted } from '../domain/fate-prophet-directed-helper.js';

const PANEL = '先知成长', ENTRY = '先知与眼前预察', CONFIRMATION = '先知操作确认';
const view = (s: SliceState) => projectSliceState(s).fateProphet;
/** Every setup starts from the helper's exact migrated 551-command living source.
 * Directed budgets/cursors are declared BEFORE the first S2 journal, never edits
 * to a saved roll, body, injury, old history or outcome; these are UNIT branches. */
function savedGame(input: SliceState, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0, releaseFirstSave = () => {};
  assertValidSliceState(state);
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T03:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-15T02:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openPanel(game: SavedGame) {
  await mount(game); await acknowledgeRound();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: FateProphetCommand): HTMLButtonElement {
  const action = view(state).actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public Fate Prophet action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
async function control(state: SliceState, command: FateProphetCommand) {
  if ('bottleId' in command) {
    const bottle = view(state).bottles.find(entry => entry.id === command.bottleId)!;
    const goal = screen.getByRole('button', { name: `${bottle.title} · ${bottle.status}` }) as HTMLButtonElement;
    if (!goal.disabled) await userEvent.click(goal);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
async function execute(game: SavedGame, command: FateProphetCommand) {
  const before = structuredClone(game.state), expected = fp(before, command);
  await userEvent.click(await control(before, command));
  const dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
  await userEvent.click(within(dialog).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作' }));
  await waitFor(() => expect(game.state).toEqual(expected));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRMATION })).toBeNull());
  expect(vi.mocked(game.submit).mock.calls.at(-1)![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision,
    payload: { type: 'FATE_PROPHET', command } });
}
function ordinaryCase(s: SliceState, caseId: FateProphetCaseId): SliceState {
  s=fp(s,{type:'OBSERVE',caseId});s=fp(s,{type:'PREPARE',caseId,method:'ORDINARY'});s=fp(s,{type:'MANUAL_INSPECTION',caseId});
  s=fp(s,{type:caseId==='finite-disc'?'SPIN_DISC':'RELEASE_CART',caseId});
  if(caseId==='finite-disc'){s=fp(s,{type:'WALK',caseId,to:'B'});s=fp(s,{type:'READ_RECORD',caseId});s=fp(s,{type:'WALK',caseId,to:'A'});}
  else{s=fp(s,{type:'WALK',caseId,to:s.chaosWalker.life.cart.location});s=fp(s,{type:'RETURN_CART',caseId});}
  for(const command of [{type:'RETURN_OBJECT',caseId},{type:'WALK',caseId,to:'START'},{type:'INSPECT',caseId},{type:'LEAVE',caseId},{type:'REPORT',caseId}] as FateProphetCommand[])s=fp(s,command);
  return s;
}
let readyCache: SliceState|undefined;
function encounterReady():SliceState{
  if(!readyCache){let s=promoted();for(const id of FATE_PROPHET_CASE_IDS)s=ordinaryCase(s,id);s=fp(s,{type:'REFLECT'});s=fp(s,{type:'PREPARE_ENCOUNTER'});readyCache=fp(s,{type:'ENCOUNTER_TALK'});assertValidSliceState(readyCache);}
  return structuredClone(readyCache);
}
const fighting=()=>fp(encounterReady(),{type:'ENCOUNTER_FIGHT'});
function terminalTrace(stance:SliceStance){let state=fighting(),beforeLast=state;const intent:SliceIntent={type:'COMBAT_ROUND',stance,winnerPolicy:'HOLD'};
  for(let n=0;state.combat&&n<100;n++){beforeLast=state;state=applySliceIntent(state,intent);assertValidSliceState(state);}expect(state.combat).toBeNull();return{beforeLast,intent,final:state};}
function assertRound(reveal:HTMLElement,round:SliceCombatRound){
  expect(round.fateProphetOutcome).toBeTruthy();expect(within(reveal).getByRole('heading',{name:`第 ${round.round} 回合完整记录`})).toBeTruthy();
  if(round.consequenceDomain==='BODY'){expect(reveal.textContent).not.toContain('精神后果盘');if(round.consequenceWeights){const w=round.consequenceWeights;expect(reveal.textContent!.replace(/\s+/g,' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`);}}
  const o=round.fateProphetOutcome!,actual=within(reveal).getByRole('region',{name:'先知本回合实际记录'});
  expect(actual.textContent).toContain(`本人健康${o.playerHealthAfter}、精神${o.playerMindAfter}、灵性${o.playerSpiritualityAfter}`);
  expect(actual.textContent).toContain(`对手健康${o.enemyHealth}、精神${o.enemyMind}、灵性${o.enemySpirituality}`);
  const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order),rows=within(actual).queryAllByRole('listitem');expect(rows).toHaveLength(actions.length);
  actions.forEach((a,i)=>{expect(rows[i]!.textContent).toContain(a.label);expect(rows[i]!.textContent).toContain(`实耗${a.paidCost}灵性、${a.mindCost}精神、${a.luckCost}份幸运`);});
}
async function selectRound(game:SavedGame,stance:SliceStance){const battle=projectSliceState(game.state).combat!,stage=screen.getByRole('dialog',{name:battle.title!}),option=battle.stances.find(x=>x.id===stance)!;await userEvent.click(within(stage).getByRole('button',{name:name=>name.startsWith(option.label)}));return stage;}
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

describe('Fate Prophet actual SliceApp acquisition and current S2 navigation', () => {
  it('opens the immutable living551 source without inventing maturity, money, healing or a new save', async () => {
    const before = originalChaosWalker(), game = savedGame(before); expect(before).toMatchObject({ week: 140, revision: 552, cash: 630, health: 60, mind: 100, spirituality: 120 });
    const panel = await openPanel(game); expect(panel.textContent).toContain('继续停留混乱行者'); expect(panel.textContent).toContain('500便士');
    expect(actionButton(before, { type: 'LEARN_GUIDANCE' }).disabled).toBe(false);
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' })); await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expect(oldWheelRoots(game.state)).toEqual(oldWheelRoots(before));
  }, 20_000);

  it('loads current S2 growth ahead of the stale S3 round and shows all17 actual mastery values and untreated injury', async () => {
    const before = promoted(), game = savedGame(before); expect(before.lastCombatRound?.chaosWalkerOutcome).toBeTruthy();
    expect(before.injuries).toEqual(originalChaosWalker().injuries); expect(before.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ })); const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '混乱行者', hidden: true })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' })); expect(view(before).abilities).toHaveLength(17);
    for (const ability of view(before).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${before.progression.mastery[ability.id]}`);
    expect(within(panel).getByRole('region', { name: '先知当前资源' }).textContent).toContain(`健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(panel.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断/); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('cancels the selected failing dose, prevents duplicates, and retries the identical failed-save envelope once', async () => {
    const before = prepared('FAILURE'), expected = fp(before, dose), game = savedGame(before, { deferFirstSave: true, failFirstSave: true });
    expect(expected.fateProphet.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE' }); await openPanel(game);
    await userEvent.click(await control(before, dose)); let dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(before, dose)); dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一药瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before); expect(actionButton(before, dose).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert'); expect(game.state).toEqual(before);
    fireEvent.click(actionButton(before, dose)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await waitFor(() => expect(game.state).toEqual(expected));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: { type: 'FATE_PROPHET', command: dose } });
    expect(game.state).toMatchObject({ health: before.health - 15, mind: before.mind - 25, progression: { sequence: 3 }, fateProphet: { preparedWeek: null } });
    expect(game.state.random.cursor).toBe(before.random.cursor + 1); expect(oldWheelRoots(game.state)).toEqual(oldWheelRoots(before)); expect(game.state.injuries).toEqual(before.injuries);
    cleanup(); await openPanel(game); expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('saves a real zero-action preparation exit without refunding the paid room or consuming the original bottle', async () => {
    const before = prepared(), game = savedGame(before); await openPanel(game); await execute(game, { type: 'LEAVE_PREPARATION' });
    expect(game.state.fateProphet.preparedWeek).toBeNull(); expect(game.state.fateProphet.bottles).toEqual(before.fateProphet.bottles);
    expect([game.state.cash, game.state.actionsRemaining, game.state.random.cursor]).toEqual([before.cash, before.actionsRemaining, before.random.cursor]);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.submit).toHaveBeenCalledOnce();
  }, 20_000);
});


describe('Fate Prophet actual original-body combat and saved latest-round priority',()=>{
 it('opens real enemy resources and wheel ahead of stale S3 results, with actual adults outside',async()=>{
  const before=fighting(),game=savedGame(before),battle=projectSliceState(before).combat!;expect(before.lastCombatRound?.chaosWalkerOutcome).toBeTruthy();expect(battle.enemyAbilityWheel).toEqual(FATE_PROPHET_ENEMY_ABILITY_WHEEL);expect(battle.enemyCountWheel).toEqual(FATE_PROPHET_ENEMY_COUNT_WHEEL);
  await mount(game);expect(screen.queryByRole('dialog',{name:'战斗回合结果'})).toBeNull();const stage=await screen.findByRole('dialog',{name:battle.title!}),resources=within(stage).getByRole('region',{name:'先知本回合实际资源'});
  expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);expect(resources.textContent).toContain('薇拉与导师已沿原路走到门外');
  await userEvent.click(within(stage).getByText('查看公开轮盘与风险',{selector:'summary'}));for(const w of battle.enemyAbilityWheel)expect(stage.textContent).toContain(`${w.label} ${w.weight}%`);
  expect((within(stage).getByRole('radio',{name:'本回合保留幸运'}) as HTMLInputElement).checked).toBe(true);expect(game.state).toEqual(before);expect(game.submit).not.toHaveBeenCalled();
 },20000);
 it('saves the explicitly selected luck policy and reopens the same actual round without another draw',async()=>{
  const before=fighting(),game=savedGame(before);await mount(game);const stage=await selectRound(game,'CONTROL');await userEvent.click(within(stage).getByRole('radio',{name:'首次合格防护或厄运时使用1份'}));
  const payload:SliceIntent={type:'COMBAT_ROUND',stance:'CONTROL',winnerPolicy:'SPEND_FIRST'},expected=applySliceIntent(before,payload);assertValidSliceState(expected);
  await userEvent.click(within(stage).getByRole('button',{name:'确认姿态，结算完整回合'}));await waitFor(()=>expect(game.state).toEqual(expected));expect(game.submit).toHaveBeenCalledExactlyOnceWith({intentId:expect.any(String),runId:before.runId,expectedRevision:before.revision,payload});
  assertRound(await screen.findByRole('dialog',{name:'战斗回合结果'}),expected.lastCombatRound!);cleanup();await mount(game);assertRound(await screen.findByRole('dialog',{name:'战斗回合结果'}),expected.lastCombatRound!);expect(game.state).toEqual(expected);expect(game.submit).toHaveBeenCalledOnce();
 },30000);
 it('uses the real peaceful ordinary four-metre exit and retains both old opponents',async()=>{
  const before=encounterReady(),game=savedGame(before);await mount(game);await execute(game,{type:'LEAVE_ENCOUNTER'});expect(game.state.chaosWalker.life.playerLocation).toBe('START');expect(game.state.chaosWalker.life.playerTravelMetres).toBe(before.chaosWalker.life.playerTravelMetres+4);expect(game.state.chaosWalker.life.clockSeconds).toBe(before.chaosWalker.life.clockSeconds+4);expect(game.state.chaosWalker.encounter).toEqual(before.chaosWalker.encounter);expect(game.state.misfortuneMage.encounter).toEqual(before.misfortuneMage.encounter);expect(game.state.winner.luck).toEqual(before.winner.luck);expect(game.submit).toHaveBeenCalledOnce();
 },30000);
 it('reopens the exact terminal public continuation, never giving a dead body an ordinary exit',async()=>{
  const trace=terminalTrace('CONTROL'),before=trace.final,game=savedGame(before);expect(before.fateProphet.encounter.terminal).toBeTruthy();
  for(let n=0;n<2;n++){await mount(game);const reveal=await screen.findByRole('dialog',{name:'战斗回合结果'});assertRound(reveal,before.lastCombatRound!);await acknowledgeRound();
   if(before.status==='DEAD'){expect(before.fateProphet.encounter.terminal!.exitMetres).toBe(0);expect(before.chaosWalker.life.playerLocation).toBe('A');expect(screen.queryByRole('button',{name:ENTRY})).toBeNull();expect(screen.getByText('只读封存卷宗')).toBeTruthy();}
   else{expect(before.fateProphet.encounter.terminal!.exitMetres).toBe(4);expect(before.chaosWalker.life.playerLocation).toBe('START');}
   expect(game.state).toEqual(before);expect(game.submit).not.toHaveBeenCalled();cleanup();}
 },30000);
});
