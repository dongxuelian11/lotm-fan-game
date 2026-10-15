/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { FearBishopCommand } from "../../src/domain/fear-bishop/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface NaturalCapture {
  prefixCount: number; commands: SliceIntent[]; departureStart: unknown; guidanceStart: unknown;
  promoted: unknown; practiced: unknown; combatStart: unknown; final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// These are actual public-command captures. Never edit resources, consent, RNG, original people or objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/nightwatcher-v01220/natural.json", "utf8"));
const natural = (): NaturalCapture => JSON.parse(readFileSync("tests/fixtures/fear-bishop-v01450/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/fear-bishop-v01450/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real Fear Bishop boundary: ${name}`);
  return entries[name];
}
function savedGame(state: unknown, failFirstSave = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This original run already exists.");
    if (failFirstSave && attempts++ === 0) return { ok: false as const, error: { code: "SAVE_FAILED", message: "本次原操作尚未保存", retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T08:00:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
const LEGACY_STAGES = ["sleepless", "midnight", "nightmare", "soother", "nightwatcher"] as const;
function expectLegacyPreserved(state: SliceState, before: SliceState) {
  for (const key of LEGACY_STAGES) expect(state[key]).toEqual(before[key]);
  const old = structuredClone(before.spiritWarlock), now = structuredClone(state.spiritWarlock);
  const deployments = now.companion.deployments - old.companion.deployments;
  const recalls = now.companion.recalls - old.companion.recalls;
  expect(deployments).toBeGreaterThanOrEqual(0); expect(recalls).toBe(deployments);
  const rounds = state.combatHistory.slice(before.combatHistory.length).filter(round => round.fearBishopOutcome);
  expect(deployments).toBe(rounds.reduce((sum, round) => sum + round.fearBishopOutcome!.playerActions.filter(action => action.spiritOperation === "DEPLOY").length, 0));
  expect(recalls).toBe(rounds.filter(round => round.fearBishopOutcome!.recalled).length);
  now.companion.deployments = old.companion.deployments; now.companion.recalls = old.companion.recalls;
  expect(now).toEqual(old);
  expect(state.runId).toBe(before.runId); expect(state.random.seed).toBe(before.random.seed);
  expect(state.character.gender).toBe(before.character.gender);
}
async function acknowledgeSavedRound() {
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function mountGame(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T07:59:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: state.status === "DEAD" ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "人物卷宗" })
    ?? screen.queryByRole("region", { name: "恐惧主教" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.combat ? screen.queryByRole("dialog", { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Previous battles remain in the save. Acknowledge their real outcomes through the UI instead of erasing them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.fearBishop.insideCase) await screen.findByRole("region", { name: "恐惧主教" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "恐惧主教与有限黑暗" }));
    await screen.findByRole("region", { name: "恐惧主教" });
  }
}
function actionButton(state: SliceState, command: FearBishopCommand) {
  const entry = projectSliceState(state).fearBishop.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!entry) throw new Error(`No actual public Fear Bishop action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "恐惧主教" }).getAttribute("aria-busy")).toBe("false"));
}
async function submitCapturedRound(game: SavedGame, intent: SliceIntent) {
  if (intent.type !== "COMBAT_ROUND") throw new Error("The actual captured intent must be a combat round.");
  const battle = projectSliceState(game.state).combat!;
  const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
  const stance = battle.stances.find(item => item.id === intent.stance)!;
  await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(stance.label) }));
  await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
  return screen.findByRole("dialog", { name: "战斗回合结果" });
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Fear Bishop navigation from preserved real Nightwatcher captures", () => {
  it("opens and closes after the exact291-command prefix while preserving dead Bram and the same sealed Leaf", async () => {
    const old = original(), capture = natural(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(291); expect(capture.prefixCount).toBe(291);
    expect(capture.commands.length).toBeGreaterThan(291); expect(capture.commands.slice(0, 291)).toEqual(old.commands);
    expect(migrateSliceState(capture.departureStart)).toEqual(before);
    expect(before).toMatchObject({ week: 75, health: 70, mind: 100, spirituality: 120, cash: 780, actionsRemaining: 1, character: { gender: "FEMALE" }, progression: { sequence: 4, acting: 100 } });
    expect(before.nightwatcher.promotionWeek).toBe(68);
    expect(before.nightwatcher.encounter.enemy).toMatchObject({ id: "NW4-BRAM", health: 0, status: "DEAD", weaponLocation: "YARD" });
    expect(before.spiritWarlock.companion).toMatchObject({ source: "SW5-LEAF-1", status: "SEALED", deployments: 10, recalls: 10, releases: 1, invitedWeek: 53 });
    await mountGame(game);
    const target = screen.getByRole("region", { name: "恐惧主教当前目标" });
    expect(target.textContent).toContain("守夜人需消化100"); expect(target.textContent).toContain("7/12");
    expect(target.textContent).toContain("恐惧主教3可将安眠与恐惧结合，产生有限黑暗毁灭效果；场景与参数以当前说明为准。当前渠道不提供完整配方，晋升仍须完成专业准备。");
    const summary = screen.getByText("原身体、旧布拉姆与原卷叶", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "恐惧主教继承记录" });
    expect(history.textContent).toContain("第68周真实晋升"); expect(history.textContent).toContain("NW4-BRAM-CLUB");
    expect(history.textContent).toContain("健康0/100"); expect(history.textContent).toContain("已死亡，不会复活");
    expect(history.textContent).toContain("SW5-LEAF-1"); expect(history.textContent).toContain("原派出10次、实际召回10次");
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭恐惧主教页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("retries the exact guidance envelope after save failure without charging twice", async () => {
    const captured = boundary("guidance"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "FEAR_BISHOP", command: { type: "LEARN_GUIDANCE" } });
    expect(migrateSliceState(natural().guidanceStart)).toEqual(before);
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "LEARN_GUIDANCE" }));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, { type: "LEARN_GUIDANCE" }).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭恐惧主教页面" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final));
    if (game.state.week === before.week) { expect(game.state.cash).toBe(before.cash - 500); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1); }
    expect(game.state.fearBishop).toMatchObject({ guidanceKnown: true, preparations: [], preparedWeek: null });
    expectLegacyPreserved(game.state, before);
  }, 15_000);

  it("records the fifth real job against only its original bottle before any handover", async () => {
    const captured = boundary("potion-work-5"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "FEAR_BISHOP" || captured.lastIntent.command.type !== "POTION_WORK") throw new Error("Expected the real fifth bottle job.");
    const command = captured.lastIntent.command, bottle = before.fearBishop.bottles.find(entry => entry.id === command.bottleId)!;
    expect(bottle).toMatchObject({ labourSteps: 4, status: "SUPPLIER" });
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立恐惧主教原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.fearBishop.bottles.find(entry => entry.id === command.bottleId)).toMatchObject({ labourSteps: 5, status: "SUPPLIER", acquiredWeek: null });
    expect(game.state.fearBishop.bottles.filter(entry => entry.id !== command.bottleId)).toEqual(before.fearBishop.bottles.filter(entry => entry.id !== command.bottleId));
    expect(game.state.fearBishop.preparations).toEqual(before.fearBishop.preparations);
    expect(game.state.fearBishop.life).toEqual(before.fearBishop.life); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("receives the independently worked original800p bottle without drinking or granting preparation", async () => {
    const captured = boundary("buy-independent-potion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "FEAR_BISHOP" || captured.lastIntent.command.type !== "BUY_POTION") throw new Error("Expected the real bottle handover.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立恐惧主教原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - 800); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.fearBishop.bottles.find(bottle => bottle.id === command.bottleId)).toMatchObject({ status: "PLAYER", labourSteps: 5, consumedWeek: null, outcome: null });
    expect(game.state.progression.sequence).toBe(4); expect(game.state.fearBishop.preparedWeek).toBeNull();
    expect(game.state.fearBishop.preparations).toEqual(before.fearBishop.preparations);
    expect(screen.queryByRole("region", { name: "恐惧主教原瓶服用确认" })).toBeNull(); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves the actual current-week120p preparation and retains its zero-action physical exit", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "FEAR_BISHOP", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "PREPARE_PROMOTION" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect([game.state.cash, game.state.actionsRemaining, game.state.week]).toEqual([before.cash - 120, before.actionsRemaining - 1, before.week]);
    expect(game.state.fearBishop.preparedWeek).toBe(before.week);
    expect(screen.queryByRole("button", { name: "关闭恐惧主教页面" })).toBeNull();
    const exit = actionButton(game.state, { type: "LEAVE_PREPARATION" }); expect(exit.disabled).toBe(false); expect(exit.textContent).toContain("0行动");
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("requires separate bottle confirmation then keeps the promoted page without reviving old bodies or refilling spirituality", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "FEAR_BISHOP" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual independent consumption.");
    const command = captured.lastIntent.command;
    expect(projectSliceState(before).fearBishop.insideCase).toBe(true);
    await mountGame(game); expect(screen.queryByRole("button", { name: "恐惧主教与有限黑暗" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立恐惧主教原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command));
    const review = screen.getByRole("region", { name: "恐惧主教原瓶服用确认" });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain("本阶身体性别不改变");
    expect(review.textContent).toContain("当前灵性不补满"); expect(review.textContent).toContain("旧布拉姆结局与原卷叶状态");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.fearBishop.bottles.find(bottle => bottle.id === command.bottleId)?.status).toBe("CONSUMED");
    expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.fearBishop.preparedWeek).toBeNull(); expect(game.state.fearBishop.nightwatcherActingAtPromotion).toBe(100);
    expect(game.state.injuries).toEqual(before.injuries); expectLegacyPreserved(game.state, before);
    expect(game.state.fearBishop.life).toEqual(before.fearBishop.life);
    expect(screen.getByRole("region", { name: "恐惧主教" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭恐惧主教页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves actual reflection then returns to ordinary life and reopens growth without renewing consent", async () => {
    const captured = boundary("reflection"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "FEAR_BISHOP", command: { type: "REFLECT" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "REFLECT" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state).toEqual(migrateSliceState(natural().practiced));
    expect(game.state.status).toBe("ACTIVE"); expect(game.state.progression).toMatchObject({ sequence: 3, acting: 100 });
    const life = game.state.fearBishop.life, after = structuredClone(game.state);
    expect(life.reflected).toBe(true); expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe("EXIT");
    expect(Object.values(life.cases).every(entry => entry.status === "RESOLVED" && entry.returned && !entry.contactOpen && entry.attempts.every(attempt => attempt.closed))).toBe(true);
    expect(life.tomas).toMatchObject({ state: "AWAKE", location: "EXIT", effectActive: false });
    expect(life.container.location).toBe("OWNER"); expect(life.lamp.location).toBe("OWNER");
    expect(screen.getByRole("region", { name: "恐惧主教当前目标" }).textContent).toContain("守夜人消化100/100留存");
    await userEvent.click(screen.getByRole("button", { name: "关闭恐惧主教页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ })); expect(screen.getByRole("region", { name: "恐惧主教" })).toBeTruthy();
    expect(game.state).toEqual(after); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves the first actual Harlan round and replays it without repeating original Leaf or enemy costs", async () => {
    const captured = boundary("combat-first"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(migrateSliceState(natural().combatStart)).toEqual(before);
    expect(before.combat?.encounterId).toBe("FEAR_BISHOP_DISPUTE"); expect(before.combat?.round).toBe(1);
    expect(before.lastCombatRound?.nightwatcherOutcome).toBeTruthy();
    expect(before.fearBishop.encounter.targetId).toBe("FB3-HARLAN"); expect(before.fearBishop.encounter.enemySpirituality).toBe(120);
    await mountGame(game);
    const battle = projectSliceState(before).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain("哈兰"); expect(within(stage).getByRole("heading", { name: battle.enemyName })).toBeTruthy();
    expect(battle.fearBishop).toBeTruthy(); expect(stage.textContent).toContain(battle.fearBishop!.summary);
    expect(game.submit).not.toHaveBeenCalled();
    const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1);
    const round = game.state.lastCombatRound!, after = structuredClone(game.state), outcome = round.fearBishopOutcome!;
    expect(outcome).toBeTruthy(); expect(outcome.source.companion).toEqual(before.spiritWarlock.companion);
    expect(outcome.companionAfter).toEqual(game.state.spiritWarlock.companion);
    expect(outcome.enemySpirituality).toBe(120 - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
    const displayRound = projectSliceState(game.state).lastCombatRound!;
    const displayLabels = [
      "有限黑暗毁灭知识18失败，实际6S不退，0贡献，不附送普通打击或重抽。",
      "原哈兰持自己的唯一FB3-HARLAN-CLUB普通打击20×身体，0S，没有新武器或额外行动。",
      "有限黑暗毁灭知识18失败，实际6S不退，0贡献，不附送普通打击或重抽。",
      "原哈兰判断失衡，本槽固定−22.5，不另抽。",
      "安眠与恐惧结合的有限短时压力，实付5S/意志18成功，减势32；本轮后结束，不直接扣H/M、永眠、强制真话或治疗。",
      "原哈兰有限暗矢实付5S，有限优势75，余115/120；原人不补资源，伤势由共同盘决定。",
      "有限黑暗毁灭实付6S/知识18成功，对2米可见原敌形成65×新掌握优势；不直接扣H、抹除原人或单槽必杀，真实伤势仍由共同盘决定。"
    ];
    const displayConsequence = "同一48岁原哈兰在净空庭院2米外，独立S120/120；原卷叶仍SEALED，只使用双方共同次数和伤势盘。你在共同伤势盘25/100受到轻伤，原健康实际−10；不是黑暗一槽自动杀伤，伤势保留。本轮有限黑暗与睡恐压力结束；若实际派出原卷叶则真实召回，实付灵性和原伤势保留。";
    expect(displayRound.moves).toEqual(round.moves.map((move, index) => ({ ...move, label: displayLabels[index] })));
    expect(displayRound.consequence).toBe(displayConsequence);
    expect(round).toEqual(migrateSliceState(captured.final).lastCombatRound);
    expect(within(result).getByRole("heading", { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
    for (const label of displayLabels) expect(result.textContent).toContain(label);
    expect(result.textContent).toContain(displayConsequence);
    await userEvent.click(within(result).getByRole("checkbox", { name: "快速显示本回合结果" }));
    expect(game.state).toEqual(after);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
      const replay = within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: "summary" });
      await userEvent.click(replay); expect(replay.closest("details")!.open).toBe(true);
      for (const label of displayLabels) expect(replay.closest("details")!.textContent).toContain(label);
      expect(replay.closest("details")!.textContent).toContain(displayConsequence);
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    }
  }, 15_000);

  it("commits and reloads the actual terminal outcome without reviving Bram or replacing the original Leaf", async () => {
    const captured = boundary("combat-terminal"), game = savedGame(captured.beforeLast), before = structuredClone(game.state), terminal = migrateSliceState(captured.final);
    expect(terminal.combat).toBeNull(); expect(terminal.fearBishop.encounter.terminal).not.toBeNull();
    await mountGame(game); const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(terminal); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    if (terminal.status === "DEAD") {
      expect(terminal.health).toBe(0); expect(terminal.ending?.kind).toBe("DEATH");
      await userEvent.click(within(result).getByRole("button", { name: "查看收尾卷宗" }));
      expect(screen.getByRole("heading", { name: terminal.ending!.title })).toBeTruthy(); expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    } else {
      expect(terminal.health).toBeGreaterThan(0); await userEvent.click(within(result).getByRole("button", { name: "返回生活" }));
    }
    cleanup(); delete window.sliceGame;
    const reloaded = savedGame(captured.final); await mountGame(reloaded);
    expect(reloaded.state).toEqual(terminal); expect(reloaded.submit).not.toHaveBeenCalled();
    if (terminal.ending) {
      expect(screen.getByRole("heading", { name: terminal.ending.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull(); expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    } else expect(screen.getByRole("region", { name: "恐惧主教" })).toBeTruthy();
    expect(reloaded.state.nightwatcher.encounter.enemy).toMatchObject({ id: "NW4-BRAM", status: "DEAD", health: 0, weaponLocation: "YARD" });
    expectLegacyPreserved(reloaded.state, before);
  }, 15_000);
  it("preserves the real first failed bottle and permits ordinary recovery without concealing its paid costs", async () => {
    const captured = boundary("consume-failure"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "FEAR_BISHOP" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual failed original consumption.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立恐惧主教原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.fearBishop.bottles[0]).toMatchObject({ id: "fear-bishop-potion-1", status: "CONSUMED", outcome: "FAILURE", consumedWeek: 82, preparationWeek: 82 });
    expect(game.state).toMatchObject({ health: 85, mind: 75, spirituality: before.spirituality, progression: { sequence: 4, acting: 100 } });
    expect(game.state.fearBishop.preparedWeek).toBeNull(); expect(game.state.fearBishop.preparations).toEqual(before.fearBishop.preparations);
    expectLegacyPreserved(game.state, before); const after = structuredClone(game.state);
    await userEvent.click(screen.getByRole("button", { name: "关闭恐惧主教页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    expect(game.state).toEqual(after);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("dissolves the actual original residue once and returns its same empty container through the recorded ordinary exit", async () => {
    const captured = boundary("contained-residue-ability-outcome"), returned = boundary("contained-residue-returned"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = { type: "DISSOLVE", caseId: "contained-residue" } as const;
    expect(captured.lastIntent).toEqual({ type: "FEAR_BISHOP", command });
    await mountGame(game); await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.spirituality).toBe(before.spirituality - 6);
    expect(game.state.fearBishop.life.residue).toMatchObject({ id: "FB3-RESIDUE-1", status: "DISSOLVED", location: "NONE", alive: false, conscious: false });
    expect(game.state.fearBishop.life.container).toMatchObject({ id: "FB3-GLASS-1", location: "PLAYER" });
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect(actionButton(game.state, { type: "CLOSE", caseId: "contained-residue" }).disabled).toBe(true);
    const tail: FearBishopCommand[] = [
      { type: "RETURN_PLAYER", caseId: "contained-residue" }, { type: "RETURN_CONTAINER", caseId: "contained-residue" },
      { type: "INSPECT", caseId: "contained-residue" }, { type: "CLOSE", caseId: "contained-residue" },
    ];
    const capture = natural(), index = capture.commands.findIndex(intent => JSON.stringify(intent) === JSON.stringify(captured.lastIntent));
    expect(capture.commands.slice(index + 1, index + 5)).toEqual(tail.map(command => ({ type: "FEAR_BISHOP", command })));
    for (const step of tail) {
      const oldAP = game.state.actionsRemaining, spirit = game.state.spirituality;
      const control = actionButton(game.state, step); expect(control.textContent).toContain("0行动"); await userEvent.click(control); await settled();
      expect(game.state.actionsRemaining).toBe(oldAP); expect(game.state.spirituality).toBe(spirit);
      if (step.type === "RETURN_CONTAINER") expect(game.state).toEqual(migrateSliceState(returned.final));
    }
    expect(game.state.fearBishop.life).toMatchObject({ activeCase: null, playerLocation: "EXIT", container: { id: "FB3-GLASS-1", owner: "FB3-EDITH", location: "OWNER" }, residue: { status: "DISSOLVED", location: "NONE" } });
    expect(game.state.fearBishop.life.cases["contained-residue"].attempts.at(-1)).toMatchObject({ result: "ABILITY", closed: true, containerReturned: true, playerTravelMetres: 4, spiritualitySpent: 6 });
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, ...tail.map(command => ({ type: "FEAR_BISHOP", command }))]);
  }, 20_000);

  it("honors Tomas's actual zero-AP stop immediately then wakes and releases the same body without refunding his mind", async () => {
    const captured = boundary("stop-signal-ability-outcome"), stopped = boundary("stop-signal-stopped"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = { type: "SLEEP_FEAR", caseId: "stop-signal" } as const;
    expect(captured.lastIntent).toEqual({ type: "FEAR_BISHOP", command }); expect(before.actionsRemaining).toBe(0);
    await mountGame(game); await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.spirituality).toBe(before.spirituality - 5);
    expect(game.state.fearBishop.life.tomas).toMatchObject({ id: "FB3-TOMAS", mind: 98, state: "DROWSY", effectActive: true, remainingSeconds: 10 });
    expect(screen.queryByRole("button", { name: "关闭恐惧主教页面" })).toBeNull();
    const stop = { type: "STOP", caseId: "stop-signal", actor: "TOMAS" } as const;
    const clock = game.state.fearBishop.life.clockSeconds;
    await userEvent.click(actionButton(game.state, stop)); await settled();
    expect(game.state).toEqual(migrateSliceState(stopped.final)); expect(game.state.fearBishop.life.clockSeconds).toBe(clock);
    expect(game.state.fearBishop.life.tomas).toMatchObject({ state: "DROWSY", mind: 98, effectActive: false, remainingSeconds: 0 });
    expect(actionButton(game.state, command).disabled).toBe(true); expect(actionButton(game.state, { type: "CLOSE", caseId: "stop-signal" }).disabled).toBe(true);
    const tail: FearBishopCommand[] = [
      { type: "WAKE", caseId: "stop-signal" }, { type: "CONFIRM_WAKE", caseId: "stop-signal" }, { type: "LEAVE_VOLUNTEER", caseId: "stop-signal" },
      { type: "INSPECT", caseId: "stop-signal" }, { type: "CLOSE", caseId: "stop-signal" },
    ];
    const capture = natural(), index = capture.commands.findIndex(intent => JSON.stringify(intent) === JSON.stringify(stopped.lastIntent));
    expect(capture.commands.slice(index + 1, index + 6)).toEqual(tail.map(command => ({ type: "FEAR_BISHOP", command })));
    let expected = migrateSliceState(stopped.final);
    for (const step of tail) {
      const control = actionButton(game.state, step); expect(control.disabled).toBe(false); expect(control.textContent).toContain("0行动");
      expected = applySliceIntent(expected, { type: "FEAR_BISHOP", command: step });
      await userEvent.click(control); await settled(); expect(game.state).toEqual(expected);
      expect(game.state.fearBishop.life.tomas.mind).toBe(98);
    }
    expect(game.state.fearBishop.life).toMatchObject({ activeCase: null, playerLocation: "EXIT", tomas: { id: "FB3-TOMAS", state: "AWAKE", location: "EXIT", mind: 98, travelMetres: 2 } });
    expect(game.state.fearBishop.life.cases["stop-signal"].attempts.at(-1)).toMatchObject({ closed: true, stoppedBy: "TOMAS", wakeConfirmed: true, volunteerLeft: true, spiritualitySpent: 5, mindSpent: 2 });
    expect(game.state.week).toBe(100); expect(game.state.actionsRemaining).toBe(3); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("button", { name: "关闭恐惧主教页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, stopped.lastIntent, ...tail.map(command => ({ type: "FEAR_BISHOP", command }))]);
  }, 20_000);

  it("walks the real eight-metre corridor after actual dissolution and returns the same original lamp", async () => {
    const captured = boundary("corridor-exit-ability-outcome"), returned = boundary("corridor-exit-returned"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = { type: "DISSOLVE", caseId: "corridor-exit" } as const;
    await mountGame(game); await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.fearBishop.life).toMatchObject({ playerLocation: "CORRIDOR_ENTRANCE", trace: { id: "FB3-TRACE-1", status: "DISSOLVED" }, lamp: { id: "FB3-LAMP", location: "STORE" } });
    expect(game.state.spirituality).toBe(before.spirituality - 6); expect(actionButton(game.state, command).disabled).toBe(true);
    const route = screen.getByRole("region", { name: "原灯与八米十二米实际路径" }); expect(route.textContent).toContain("8米"); expect(route.textContent).toContain("12米");
    const tail: FearBishopCommand[] = [
      { type: "WALK_CORRIDOR", caseId: "corridor-exit" }, { type: "TAKE_LAMP", caseId: "corridor-exit" }, { type: "RETURN_PLAYER", caseId: "corridor-exit" },
      { type: "RETURN_LAMP", caseId: "corridor-exit" }, { type: "INSPECT", caseId: "corridor-exit" }, { type: "CLOSE", caseId: "corridor-exit" },
    ];
    const capture = natural(), index = capture.commands.findIndex(intent => JSON.stringify(intent) === JSON.stringify(captured.lastIntent));
    expect(capture.commands.slice(index + 1, index + 7)).toEqual(tail.map(command => ({ type: "FEAR_BISHOP", command })));
    for (const step of tail) {
      const ap = game.state.actionsRemaining, spirit = game.state.spirituality;
      const control = actionButton(game.state, step); expect(control.textContent).toContain("0行动"); await userEvent.click(control); await settled();
      expect(game.state.actionsRemaining).toBe(ap); expect(game.state.spirituality).toBe(spirit);
      if (step.type === "RETURN_LAMP") expect(game.state).toEqual(migrateSliceState(returned.final));
    }
    expect(game.state.fearBishop.life).toMatchObject({ activeCase: null, playerLocation: "EXIT", trace: { status: "DISSOLVED" }, lamp: { id: "FB3-LAMP", owner: "FB3-EDITH", location: "OWNER" } });
    expect(game.state.fearBishop.life.cases["corridor-exit"].attempts.at(-1)).toMatchObject({ result: "ABILITY", closed: true, route: "CORRIDOR", lampReturned: true, playerTravelMetres: 18, spiritualitySpent: 6 });
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, ...tail.map(command => ({ type: "FEAR_BISHOP", command }))]);
  }, 20_000);

  it("performs the actual final ordinary work after exit and preserves all original consequences into the next week", async () => {
    const captured = boundary("ordinary-life-after-exit"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "ACTION", action: "WORK" });
    await mountGame(game); await userEvent.click(screen.getByRole("button", { name: "关闭恐惧主教页面" }));
    await userEvent.click(screen.getByRole("button", { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(migrateSliceState(captured.final)));
    expect(game.state).toEqual(migrateSliceState(natural().final));
    expect(game.state).toMatchObject({ week: 105, health: 80, cash: 580, actionsRemaining: 3, status: "ACTIVE" });
    expect(game.state.fearBishop.encounter).toMatchObject({ enemyHealth: 50, enemySpirituality: 44, enemyStatus: "SURRENDERED", weaponLocation: "YARD" });
    expect(game.state.fearBishop.life).toEqual(before.fearBishop.life); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

});
