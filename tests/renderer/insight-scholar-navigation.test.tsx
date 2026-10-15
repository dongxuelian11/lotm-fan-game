/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { InsightScholarCommand } from "../../src/domain/insight-scholar/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface NaturalCapture {
  prefixCount: number; commands: SliceIntent[]; departureStart: unknown; guidanceStart: unknown;
  promoted: unknown; practiced: unknown; combatStart: unknown; final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// These are actual public-command captures. Never edit resources, consent, RNG, original people or objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/prophet-v01230/natural.json", "utf8"));
const natural = (): NaturalCapture => JSON.parse(readFileSync("tests/fixtures/insight-scholar-v01460/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/insight-scholar-v01460/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real Insight Scholar boundary: ${name}`);
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
const LEGACY_STAGES = ["reader", "reasoner", "detective", "polymath", "prophet"] as const;
function expectLegacyPreserved(state: SliceState, before: SliceState) {
  for (const key of LEGACY_STAGES) expect(state[key]).toEqual(before[key]);
  const old = structuredClone(before.mysticismMagister), now = structuredClone(state.mysticismMagister);
  expect(now.crafts).toHaveLength(old.crafts.length);
  const consumed = state.combatHistory.slice(before.combatHistory.length).flatMap(round => round.insightScholarOutcome?.consumedCraftIds ?? []);
  for (const [index, craft] of now.crafts.entries()) {
    const original = old.crafts[index]!;
    if (consumed.includes(craft.id)) { expect(original.status).toBe("PLAYER"); expect(craft.status).toBe("CONSUMED"); expect(craft.usedWeek).toBe(state.week); craft.status = original.status; craft.usedWeek = original.usedWeek; }
    expect(craft).toEqual(original);
  }
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
    ?? screen.queryByRole("region", { name: "洞悉者" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.combat ? screen.queryByRole("dialog", { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Previous battles remain in the save. Acknowledge their real outcomes through the UI instead of erasing them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.insightScholar.insideCase) await screen.findByRole("region", { name: "洞悉者" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "洞悉者与证据核实" }));
    await screen.findByRole("region", { name: "洞悉者" });
  }
}
function actionButton(state: SliceState, command: InsightScholarCommand) {
  const entry = projectSliceState(state).insightScholar.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!entry) throw new Error(`No actual public Insight Scholar action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "洞悉者" }).getAttribute("aria-busy")).toBe("false"));
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

describe("Insight Scholar navigation from preserved real Prophet captures", () => {
  it("opens after the exact329-command prefix and keeps Harold, original samples and objects unchanged", async () => {
    const old = original(), capture = natural(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(329); expect(capture.prefixCount).toBe(329);
    expect(capture.commands.length).toBeGreaterThan(329); expect(capture.commands.slice(0, 329)).toEqual(old.commands);
    expect(migrateSliceState(capture.departureStart)).toEqual(before);
    expect(before).toMatchObject({ week: 88, health: 100, mind: 100, spirituality: 114, cash: 1360, actionsRemaining: 1, character: { gender: "FEMALE" }, progression: { sequence: 4, acting: 100 } });
    expect(before.prophet.promotionWeek).toBe(78);
    expect(before.prophet.encounter.enemy).toMatchObject({ id: "PF4-HAROLD", health: 70, status: "SURRENDERED", weaponLocation: "YARD" });
    expect(before.mysticismMagister.crafts[1]).toMatchObject({ id: "MM5-FLASH-3", sourceKitId: "MM5-KIT-3", createdWeek: 63, status: "PLAYER" });
    await mountGame(game);
    const target = screen.getByRole("region", { name: "洞悉者当前目标" });
    expect(target.textContent).toContain("预言家需消化100"); expect(target.textContent).toContain("10/12");
    expect(target.textContent).toContain("本阶段开放三项有限实践；晋升须取得独立成品并完成专业准备。");
    expect(target.textContent).not.toContain("G扩展");
    const summary = screen.getByText("原身体、旧哈罗德与原物", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "洞悉者继承记录" });
    expect(history.textContent).toContain("第78周真实晋升"); expect(history.textContent).toContain("PF4-HAROLD-CLUB");
    expect(history.textContent).toContain("健康70/100"); expect(history.textContent).toContain("已投降，原伤势保留");
    expect(history.textContent).toContain("MM5-FLASH-3"); expect(history.textContent).toContain("MM5-KIT-3");
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭洞悉者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);
  it("retries the exact guidance envelope after save failure without charging twice", async () => {
    const captured = boundary("guidance"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "INSIGHT_SCHOLAR", command: { type: "LEARN_GUIDANCE" } });
    expect(migrateSliceState(natural().guidanceStart)).toEqual(before);
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "LEARN_GUIDANCE" }));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, { type: "LEARN_GUIDANCE" }).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭洞悉者页面" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final));
    if (game.state.week === before.week) { expect(game.state.cash).toBe(before.cash - 500); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1); }
    expect(game.state.insightScholar).toMatchObject({ guidanceKnown: true, preparations: [], preparedWeek: null });
    expectLegacyPreserved(game.state, before);
  }, 15_000);

  it("records the fifth real job against only its original bottle before any handover", async () => {
    const captured = boundary("potion-work-5"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "INSIGHT_SCHOLAR" || captured.lastIntent.command.type !== "POTION_WORK") throw new Error("Expected the real fifth bottle job.");
    const command = captured.lastIntent.command, bottle = before.insightScholar.bottles.find(entry => entry.id === command.bottleId)!;
    expect(bottle).toMatchObject({ labourSteps: 4, status: "SUPPLIER" });
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.insightScholar.bottles.find(entry => entry.id === command.bottleId)).toMatchObject({ labourSteps: 5, status: "SUPPLIER", acquiredWeek: null });
    expect(game.state.insightScholar.bottles.filter(entry => entry.id !== command.bottleId)).toEqual(before.insightScholar.bottles.filter(entry => entry.id !== command.bottleId));
    expect(game.state.insightScholar.preparations).toEqual(before.insightScholar.preparations);
    expect(game.state.insightScholar.life).toEqual(before.insightScholar.life); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("receives the independently worked original800p bottle without drinking or granting preparation", async () => {
    const captured = boundary("buy-independent-potion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "INSIGHT_SCHOLAR" || captured.lastIntent.command.type !== "BUY_POTION") throw new Error("Expected the real bottle handover.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - 800); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.insightScholar.bottles.find(bottle => bottle.id === command.bottleId)).toMatchObject({ status: "PLAYER", labourSteps: 5, consumedWeek: null, outcome: null });
    expect(game.state.progression.sequence).toBe(4); expect(game.state.insightScholar.preparedWeek).toBeNull();
    expect(game.state.insightScholar.preparations).toEqual(before.insightScholar.preparations);
    expect(screen.queryByRole("region", { name: "洞悉者原瓶服用确认" })).toBeNull(); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves the actual current-week120p preparation and retains its zero-action physical exit", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "INSIGHT_SCHOLAR", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "PREPARE_PROMOTION" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect([game.state.cash, game.state.actionsRemaining, game.state.week]).toEqual([before.cash - 120, before.actionsRemaining - 1, before.week]);
    expect(game.state.insightScholar.preparedWeek).toBe(before.week);
    expect(screen.queryByRole("button", { name: "关闭洞悉者页面" })).toBeNull();
    const exit = actionButton(game.state, { type: "LEAVE_PREPARATION" }); expect(exit.disabled).toBe(false); expect(exit.textContent).toContain("0行动");
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("requires separate bottle confirmation then keeps the promoted page without reviving old bodies or refilling spirituality", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "INSIGHT_SCHOLAR" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual independent consumption.");
    const command = captured.lastIntent.command;
    expect(projectSliceState(before).insightScholar.insideCase).toBe(true);
    await mountGame(game); expect(screen.queryByRole("button", { name: "洞悉者与证据核实" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command));
    const review = screen.getByRole("region", { name: "洞悉者原瓶服用确认" });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain("本阶身体性别不改变");
    expect(review.textContent).toContain("当前灵性不补满"); expect(review.textContent).toContain("旧哈罗德"); expect(review.textContent).toContain("微光片库存");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.insightScholar.bottles.find(bottle => bottle.id === command.bottleId)?.status).toBe("CONSUMED");
    expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.insightScholar.preparedWeek).toBeNull(); expect(game.state.insightScholar.prophetActingAtPromotion).toBe(100);
    expect(game.state.injuries).toEqual(before.injuries); expectLegacyPreserved(game.state, before);
    expect(game.state.insightScholar.life).toEqual(before.insightScholar.life);
    expect(screen.getByRole("region", { name: "洞悉者" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭洞悉者页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves actual reflection then returns to ordinary life and reopens growth without renewing consent", async () => {
    const captured = boundary("reflection"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "INSIGHT_SCHOLAR", command: { type: "REFLECT" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "REFLECT" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state).toEqual(migrateSliceState(natural().practiced));
    expect(game.state.status).toBe("ACTIVE"); expect(game.state.progression).toMatchObject({ sequence: 3, acting: 100 });
    const life = game.state.insightScholar.life, after = structuredClone(game.state);
    expect(life.reflected).toBe(true); expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe("EXIT");
    expect(Object.values(life.cases).every(entry => entry.status === "RESOLVED" && entry.returned && !entry.contactOpen && entry.attempts.every(attempt => attempt.closed))).toBe(true);
    expect(life.original.location).toBe("DESK"); expect(life.copy.location).toBe("DESK");
    expect(life.box).toMatchObject({ location: "OWNER", charges: 0 }); expect(life.parcel.location).toBe("OWNER"); expect(life.barrier.state).toBe("CLOSED");
    expect(screen.getByRole("region", { name: "洞悉者当前目标" }).textContent).toContain("预言家消化100/100留存");
    await userEvent.click(screen.getByRole("button", { name: "关闭洞悉者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ })); expect(screen.getByRole("region", { name: "洞悉者" })).toBeTruthy();
    expect(game.state).toEqual(after); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves the first actual Alton round and replays it without repeating original craft or enemy costs", async () => {
    const captured = boundary("combat-first"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(migrateSliceState(natural().combatStart)).toEqual(before);
    expect(before.combat?.encounterId).toBe("INSIGHT_SCHOLAR_DISPUTE"); expect(before.combat?.round).toBe(1);
    expect(before.lastCombatRound?.prophetOutcome).toBeTruthy();
    expect(before.insightScholar.encounter.targetId).toBe("IS3-ALTON"); expect(before.insightScholar.encounter.enemySpirituality).toBe(120);
    await mountGame(game);
    const battle = projectSliceState(before).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain("阿尔顿"); expect(within(stage).getByRole("heading", { name: battle.enemyName })).toBeTruthy();
    expect(battle.insightScholar).toBeTruthy(); expect(stage.textContent).toContain(battle.insightScholar!.summary);
    expect(game.submit).not.toHaveBeenCalled();
    const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1);
    const round = game.state.lastCombatRound!, after = structuredClone(game.state), outcome = round.insightScholarOutcome!;
    expect(outcome).toBeTruthy(); expect(outcome.source.crafts).toEqual(before.mysticismMagister.crafts);
    expect(outcome.craftsAfter).toEqual(game.state.mysticismMagister.crafts);
    expect(outcome.enemySpirituality).toBe(120 - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
    expect(within(result).getByRole("heading", { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
    const expectedRawMoveLabels = [
      "继承有限片段预警实付4S/意志16成功，减势22G；不检查未来轮盘，不保证获胜。",
      "原阿尔顿持唯一IS3-ALTON-CLUB普通打击20×身体G，0S，无新武器或额外行动。",
      "尚未亲见本场原阿尔顿实际付费施展FLASH或WARD，方法辨析未施放、不扣5S；本人普通避让减势10G、0S，不预读下一动作或保证免伤。",
      "继承实际原FLASH实付2S/知识14成功，减势12×旧博学者掌握G；不改变样本、学习新术、删敌行动或造成直接伤害。"
    ];
    const expectedDisplayedMoveLabels = [
      "继承有限片段预警实付4S/意志16成功，减势22；不检查未来轮盘，不保证获胜。",
      "原阿尔顿持唯一IS3-ALTON-CLUB普通打击20×身体，0S，无新武器或额外行动。",
      "尚未亲见本场原阿尔顿实际付费施展FLASH或WARD，方法辨析未施放、不扣5S；本人普通避让减势10、0S，不预读下一动作或保证免伤。",
      "继承实际原FLASH实付2S/知识14成功，减势12×旧博学者掌握；不改变样本、学习新术、删敌行动或造成直接伤害。"
    ];
    expect(round.moves.map(move => move.label)).toEqual(expectedRawMoveLabels);
    const displayedRound = projectSliceState(game.state).lastCombatRound!;
    expect(displayedRound.moves.map(move => move.label)).toEqual(expectedDisplayedMoveLabels);
    for (const label of expectedDisplayedMoveLabels) expect(result.textContent).toContain(label);
    const expectedConsequence = "同一47岁原阿尔顿在净空庭院2米外，独立S120/120；有限方法辨析只用本场实际亲见施法，双方共用次数和伤势盘。你在共同伤势盘50/100受到重伤，原健康实际−30；不是方法辨析一槽自动杀伤，伤势保留。本轮有限方法辨析结束；本场亲见施法记录和实际消耗的原微光片保留，未复制敌方能力。";
    expect(round.consequence).toBe(expectedConsequence);
    expect(displayedRound.consequence).toBe(expectedConsequence);
    expect(result.textContent).toContain(expectedConsequence);
    await userEvent.click(within(result).getByRole("checkbox", { name: "快速显示本回合结果" }));
    expect(game.state).toEqual(after);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
      const replay = within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: "summary" });
      await userEvent.click(replay); expect(replay.closest("details")!.open).toBe(true);
      for (const label of expectedDisplayedMoveLabels) expect(replay.closest("details")!.textContent).toContain(label);
      expect(round.moves.map(move => move.label)).toEqual(expectedRawMoveLabels);
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    }
  }, 15_000);

  it("commits and reloads the actual terminal outcome without resetting Harold or replacing any original craft", async () => {
    const captured = boundary("combat-terminal"), game = savedGame(captured.beforeLast), before = structuredClone(game.state), terminal = migrateSliceState(captured.final);
    expect(terminal.combat).toBeNull(); expect(terminal.insightScholar.encounter.terminal).toMatchObject({ outcome: "PLAYER_DEAD", round: 3 });
    expect(terminal).toMatchObject({ week: 106, status: "DEAD", health: 0 });
    expect(terminal.insightScholar.encounter).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemySpirituality: 102, weaponLocation: "HAND" });
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
    } else expect(screen.getByRole("region", { name: "洞悉者" })).toBeTruthy();
    expect(reloaded.state.prophet.encounter.enemy).toMatchObject({ id: "PF4-HAROLD", status: "SURRENDERED", health: 70, weaponLocation: "YARD" });
    expectLegacyPreserved(reloaded.state, before);
  }, 15_000);






  it("preserves the actual first failed bottle and allows ordinary recovery without hiding paid costs", async () => {
    const captured = boundary("consume-failure"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "INSIGHT_SCHOLAR" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual failed original consumption.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立洞悉者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.insightScholar.bottles[0]).toMatchObject({ id: "insight-scholar-potion-1", status: "CONSUMED", outcome: "FAILURE", consumedWeek: 92, preparationWeek: 92 });
    expect(game.state).toMatchObject({ health: 85, mind: 75, spirituality: before.spirituality, progression: { sequence: 4, acting: 100 } });
    expect(game.state.insightScholar.preparedWeek).toBeNull(); expect(game.state.insightScholar.preparations).toEqual(before.insightScholar.preparations);
    expectLegacyPreserved(game.state, before); const after = structuredClone(game.state);
    await userEvent.click(screen.getByRole("button", { name: "关闭洞悉者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    expect(game.state).toEqual(after);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it.each([
    ['copy-discrepancy', 'copy-discrepancy-ability-outcome', 6, 'FAILURE', 8, 32],
    ['known-method', 'known-method-ability-outcome', 5, 'GREAT_FAILURE', 6, 28],
    ['revised-route', 'revised-route-ability-outcome', 6, 'SUCCESS', 20, 36],
  ] as const)('replays the actual %s ability outcome and ordinary physical cleanup without another ability draw', async (caseId, boundaryName, spiritCost, abilityTier, metres, seconds) => {
    const captured = boundary(boundaryName), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "INSIGHT_SCHOLAR") throw new Error("Expected the actual life ability command.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.spirituality).toBe(before.spirituality - spiritCost);
    expect(game.state.insightScholar.life.cases[caseId].attempts.at(-1)).toMatchObject({ abilityTier });
    if (caseId === "known-method") expect(before.actionsRemaining).toBe(0);
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭洞悉者页面" })).toBeNull();
    const capture = natural(), start = capture.commands.findIndex(intent => JSON.stringify(intent) === JSON.stringify(captured.lastIntent));
    expect(start).toBeGreaterThanOrEqual(329);
    const end = capture.commands.findIndex((intent, index) => index > start && intent.type === "INSIGHT_SCHOLAR" && intent.command.type === "CLOSE" && intent.command.caseId === caseId);
    expect(end).toBeGreaterThan(start);
    const tail = capture.commands.slice(start + 1, end + 1);
    let expected = migrateSliceState(captured.final);
    for (const intent of tail) {
      if (intent.type !== "INSIGHT_SCHOLAR") throw new Error("Only actual zero-AP scene substeps belong before this close.");
      const control = actionButton(game.state, intent.command); expect(control.disabled).toBe(false); expect(control.textContent).toContain("0行动");
      const ap = game.state.actionsRemaining, spirituality = game.state.spirituality;
      expected = applySliceIntent(expected, intent);
      await userEvent.click(control); await settled(); expect(game.state).toEqual(expected);
      if (intent.command.type !== "CLOSE") { expect(game.state.actionsRemaining).toBe(ap); expect(game.state.spirituality).toBe(spirituality); }
    }
    const life = game.state.insightScholar.life;
    expect(life).toMatchObject({ activeCase: null, playerLocation: "EXIT" });
    expect(life.cases[caseId].attempts.at(-1)).toMatchObject({ closed: true, inspected: true, spiritualitySpent: spiritCost, abilityTier, playerTravelMetres: metres, elapsedSeconds: seconds });
    expect(life.original.location).toBe("DESK"); expect(life.copy.location).toBe("DESK"); expect(life.box.location).toBe("OWNER");
    if (caseId === 'copy-discrepancy') expect(life.cases[caseId].attempts.at(-1)).toMatchObject({ ownerEvidenceRead: true, verified: true, hypothesis: 'COPY_ERROR', hypothesisHistory: ['MISSING_DELIVERY', 'COPY_ERROR'], manualCompared: true, result: 'ORDINARY', papersReturned: true });
    if (caseId === 'known-method') { expect(life.box).toMatchObject({ charges: 0, demonstrations: 2, output: 'DARK' }); expect(life.cases[caseId].attempts.at(-1)).toMatchObject({ prediction: 'LIT', observedResult: true, revised: true, result: 'ORDINARY' }); }
    if (caseId === 'revised-route') { expect(life.parcel.location).toBe('OWNER'); expect(life.barrier.state).toBe('CLOSED'); expect(life.cases[caseId].attempts.at(-1)).toMatchObject({ routeHistory: ['SHORT', 'SIDE'], shortBlocked: true, result: 'ABILITY' }); }
    expectLegacyPreserved(game.state, before); expect(screen.getByRole("button", { name: "关闭洞悉者页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, ...tail]);
  }, 25_000);

  it("chooses the actual peaceful exit before any optional fight and keeps the separate death capture unchanged", async () => {
    const captured = boundary("peaceful-leave"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = { type: "LEAVE_ENCOUNTER" } as const;
    expect(captured.lastIntent).toEqual({ type: "INSIGHT_SCHOLAR", command });
    expect(before.insightScholar.encounter).toMatchObject({ status: "READY", attemptWeek: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    await mountGame(game); expect(screen.queryByRole("button", { name: "关闭洞悉者页面" })).toBeNull();
    const control = actionButton(game.state, command); expect(control.disabled).toBe(false); expect(control.textContent).toContain("0行动");
    await userEvent.click(control); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state).toMatchObject({ status: "ACTIVE", health: 100, mind: 100, spirituality: 120, combat: null, ending: null, actionsRemaining: before.actionsRemaining });
    expect(game.state.insightScholar.encounter).toMatchObject({ status: "RESOLVED", attemptWeek: null, terminal: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: "HAND", seenPowers: [] });
    expect(game.state.combatHistory).toEqual(before.combatHistory); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("button", { name: "关闭洞悉者页面" })).toBeTruthy();
    expect(migrateSliceState(natural().final)).toMatchObject({ status: "DEAD", health: 0, ending: { kind: "DEATH" } });
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("performs the actual ordinary work on the independent peaceful branch and reloads its living result", async () => {
    const captured = boundary("peaceful-ordinary-life"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const peaceful = JSON.parse(readFileSync("tests/fixtures/insight-scholar-v01460/peaceful.json", "utf8")) as { final: unknown; sharedPublicPrefix: number; commands: SliceIntent[] };
    expect(peaceful.sharedPublicPrefix).toBe(421); expect(peaceful.commands).toHaveLength(423);
    expect(captured.lastIntent).toEqual({ type: "ACTION", action: "WORK" });
    await mountGame(game); await userEvent.click(screen.getByRole("button", { name: "关闭洞悉者页面" }));
    await userEvent.click(screen.getByRole("button", { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(migrateSliceState(captured.final)));
    expect(game.state).toEqual(migrateSliceState(peaceful.final));
    expect(game.state).toMatchObject({ week: 106, status: "ACTIVE", health: 100, mind: 100, spirituality: 120, cash: 640, actionsRemaining: 1 });
    expect(game.state.insightScholar.life).toEqual(before.insightScholar.life); expect(game.state.insightScholar.encounter).toEqual(before.insightScholar.encounter);
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    cleanup(); delete window.sliceGame;
    const reloaded = savedGame(peaceful.final); await mountGame(reloaded);
    expect(reloaded.state).toEqual(game.state); expect(reloaded.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "洞悉者" })).toBeTruthy();
  }, 20_000);
});
