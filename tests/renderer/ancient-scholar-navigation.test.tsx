/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { addGameDays } from "../../src/domain/game-calendar";
import type { SliceState } from "../../src/domain/slice/types";
import type { AncientScholarCommand } from "../../src/domain/ancient-scholar/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

// Every starting state is an actual public-command capture. No date, cash, qualification or bottle is patched.
const natural = () => JSON.parse(readFileSync("tests/fixtures/ancient-scholar-v01400/natural.json", "utf8"));
function savedGame(state: unknown, failFirstSave = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This original run already exists.");
    if (failFirstSave && attempts++ === 0) return { ok: false as const, error: { code: "SAVE_FAILED", message: "本次入舱尚未保存", retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function continueRun(game: SavedGame) {
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(game.state.character.name) }));
  const state = projectSliceState(game.state);
  if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.ancientScholar.locked || state.ancientScholar.eraClosed) await screen.findByRole("region", { name: "古代学者" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
    if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: state.combat ? "进入下一回合" : "返回生活" }));
    await userEvent.click(screen.getByRole("button", { name: "古代学者与三百年隔绝" }));
  }
}
async function mountGame(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T00:00:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />); await continueRun(game);
}
function actionButton(state: SliceState, type: AncientScholarCommand["type"]) {
  const entry = projectSliceState(state).ancientScholar.actions.find(item => item.command.type === type);
  if (!entry) throw new Error(`No actual public Ancient Scholar action: ${type}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "古代学者" }).getAttribute("aria-busy")).toBe("false"));
}
async function doAction(game: SavedGame, type: AncientScholarCommand["type"]) {
  await waitFor(() => expect(actionButton(game.state, type).disabled).toBe(false));
  const revision = game.state.revision;
  await userEvent.click(actionButton(game.state, type));
  await waitFor(() => expect(game.state.revision).toBe(revision + 1));
  await settled();
}
function expectNoOldScene() {
  expect(screen.queryByRole("heading", { name: "人物卷宗" })).toBeNull();
  expect(screen.queryByRole("button", { name: /非凡成长/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /^工作，|^休养，/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "关闭古代学者页面" })).toBeNull();
  expect(screen.queryByRole("region", { name: "诡法师有限生活实践" })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "战斗回合结果" })).toBeNull();
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Ancient Scholar navigation through captured real centuries", () => {
  it("opens the optional route from the original surviving S4 save and closes without starting isolation", async () => {
    const capture = natural(), game = savedGame(capture.departureStart), before = structuredClone(game.state);
    expect(capture.prefixCount).toBe(461); expect(game.state.progression.sequence).toBe(4);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("尚无本次已核验连续300年");
    expect(screen.getByRole("region", { name: "真实日期与连续隔绝" }).textContent).toContain("1351年6月12日");
    await userEvent.click(screen.getByRole("button", { name: "关闭古代学者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
  }, 15_000);

  it("retries the same confirmed entry envelope after a save failure without double-entering or paying again", async () => {
    const capture = natural(), game = savedGame(capture.prepared, true), before = structuredClone(game.state);
    await mountGame(game); await userEvent.click(actionButton(game.state, "ENTER_SECLUSION"));
    const review = screen.getByRole("region", { name: "不可逆三百年隔绝确认" });
    expect(review.textContent).toContain("150年与150年"); expect(review.textContent).toContain("84岁故去");
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "确认不可逆入舱，开始完全隔绝" }));
    await screen.findByRole("alert");
    expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "确认不可逆入舱，开始完全隔绝" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "不可逆三百年隔绝确认" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "ANCIENT_SCHOLAR", command: { type: "ENTER_SECLUSION", confirmed: true } });
    expect(game.state.ancientScholar.ritual.visits).toEqual(capture.sealed.ancientScholar.ritual.visits);
    expect(game.state.cash).toBe(before.cash); expect(game.state.date).toEqual(before.date);
    expect(game.state.ancientScholar.ritual.paidPennies).toBe(before.ancientScholar.ritual.paidPennies);
    expect(game.state.ancientScholar.bottles).toEqual(before.ancientScholar.bottles); expectNoOldScene();
  }, 15_000);

  it("continues the sealed original body through the first real 150 years with every bottle still blocked", async () => {
    const capture = natural(), game = savedGame(capture.sealed), bottles = structuredClone(game.state.ancientScholar.bottles);
    const resources = [game.state.health, game.state.mind, game.state.spirituality, game.state.cash];
    await mountGame(game); expectNoOldScene();
    expect(screen.queryByText("旧时代与此后的外部案卷", { selector: "summary" })).toBeNull();
    await doAction(game, "ADVANCE_FIRST_150");
    expect(game.state.date).toEqual(capture.first150.date); expect(game.state.week).toBe(capture.first150.week);
    expect(game.state.ancientScholar.ritual.visits).toEqual(capture.first150.ancientScholar.ritual.visits);
    expect([game.state.health, game.state.mind, game.state.spirituality, game.state.cash]).toEqual(resources);
    expect(game.state.ancientScholar.bottles).toEqual(bottles); expectNoOldScene();
    const potions = projectSliceState(game.state).ancientScholar.actions.filter(item => item.command.type === "CONSUME");
    expect(potions).toHaveLength(3);
    for (const entry of potions) expect((screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement).disabled).toBe(true);
    expect(game.state.ancientScholar.ritual.completed300VisitId).toBeNull();
    expect(screen.queryByRole("region", { name: "不可逆三百年隔绝确认" })).toBeNull();
    expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual({ type: "ANCIENT_SCHOLAR", command: { type: "ADVANCE_FIRST_150" } });
  }, 15_000);

  it("keeps an early-exit future era after returning to the main menu and continuing the same original run", async () => {
    const game = savedGame(natural().first150), date = structuredClone(game.state.date), cash = game.state.cash;
    await mountGame(game); await userEvent.click(actionButton(game.state, "EXIT_EARLY"));
    expect(screen.getByRole("region", { name: "提前结束隔绝确认" }).textContent).toContain("新的完整300年");
    await userEvent.click(screen.getByRole("button", { name: "确认提前出舱，保留已流逝年月" })); await settled();
    expect(game.state.date).toEqual(date); expect(game.state.cash).toBe(cash);
    expect(game.state.progression.sequence).toBe(4); expect(game.state.ancientScholar.ritual.completed300VisitId).toBeNull();
    expect(game.state.ancientScholar.ritual.visits[0]!.result).toBe("EARLY_EXIT");
    await userEvent.click(screen.getByText("旧人、旧物与不可逆时代后果", { selector: "summary" }));
    const people = screen.getByRole("region", { name: "旧人与当代保管人" });
    expect(people.textContent).toContain("84岁故去"); expect(people.textContent).toContain("AS3-ELIN");
    const external = screen.getByText("旧时代与此后的外部案卷", { selector: "summary" });
    await userEvent.click(external); expect(within(external.closest("details")!).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "返回主菜单" })); await continueRun(game);
    expectNoOldScene(); expect(game.state.date).toEqual(date); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("后世");
    expect(screen.getByRole("region", { name: "真实日期与连续隔绝" }).textContent).toContain("1501年8月21日");
  }, 15_000);

  it("requires local verification at the full 300-year save and lets the player leave still at S4", async () => {
    const capture = natural(), game = savedGame(capture.full300), date = structuredClone(game.state.date);
    const originals = structuredClone(game.state.ancientScholar.bottles);
    await mountGame(game); expectNoOldScene();
    expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("尚须本地核验");
    expect(actionButton(game.state, "CONSUME").disabled).toBe(true);
    await doAction(game, "VERIFY_CONTINUITY");
    expect(game.state.ancientScholar.ritual.visits).toEqual(capture.verified.ancientScholar.ritual.visits);
    expect(actionButton(game.state, "CONSUME").disabled).toBe(false);
    expect(game.state.date).toEqual(date); expect(game.state.progression.sequence).toBe(4);
    await doAction(game, "EXIT_SECLUSION");
    expect(game.state.ancientScholar.ritual.location).toBe("RECEPTION"); expect(game.state.date).toEqual(date);
    expect(game.state.progression.sequence).toBe(4); expect(game.state.ancientScholar.bottles).toEqual(originals); expectNoOldScene();
    expect(actionButton(game.state, "CONSUME").disabled).toBe(true);
    expect(screen.getByRole("region", { name: "古代学者当前处境" }).textContent).toContain("14天隔绝");
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: "ANCIENT_SCHOLAR", command: { type: "VERIFY_CONTINUITY" } },
      { type: "ANCIENT_SCHOLAR", command: { type: "EXIT_SECLUSION" } },
    ]);
  }, 15_000);

  it("saves current-era work, rest and the next real week from the actually practiced S3 save", async () => {
    const game = savedGame(natural().practiced), before = structuredClone(game.state);
    expect(game.state.progression.sequence).toBe(3); expect(game.state.progression.acting).toBe(100);
    expect(game.state.actionsRemaining).toBe(3);
    await mountGame(game); expectNoOldScene();
    expect(screen.getByRole("region", { name: "古代学者有限实践" }).textContent).toContain("三份不同报告已经留下真实记录");
    await userEvent.click(screen.getByText("旧人、旧物与不可逆时代后果", { selector: "summary" }));
    expect(screen.getByRole("region", { name: "原件保护与旧物去向" }).textContent).toContain("旧数量为历史，不可在新时代使用");
    for (const type of ["WORK", "REST", "WORK", "NEXT_WEEK"] as const) {
      await doAction(game, type); expectNoOldScene();
    }
    expect(game.state.cash).toBe(before.cash + 24 - 8 + 24 - 24);
    expect(game.state.date).toEqual(addGameDays(before.date, 7)); expect(game.state.actionsRemaining).toBe(4);
    expect(game.state.health).toBe(Math.min(100, before.health + 5));
    expect(game.state.mind).toBe(Math.min(100, before.mind + 8));
    expect(game.state.spirituality).toBe(Math.min(120, before.spirituality + 10));
    expect(game.state.character).toEqual(before.character); expect(game.state.progression).toEqual(before.progression);
    expect(game.state.ancientScholar.life).toEqual(before.ancientScholar.life);
    expect(game.state.ancientScholar.bottles).toEqual(before.ancientScholar.bottles);
    expect(game.state.bizarroSorcerer).toEqual(before.bizarroSorcerer);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual(
      ["WORK", "REST", "WORK", "NEXT_WEEK"].map(type => ({ type: "ANCIENT_SCHOLAR", command: { type } })),
    );
  }, 15_000);

  it("keeps the new real combat and its saved round result while suppressing only obsolete old-era replay", async () => {
    const capture = natural(), game = savedGame(capture.combatStart), before = structuredClone(game.state);
    const battle = projectSliceState(game.state).combat!;
    expect(game.state.combat?.encounterId).toBe("ANCIENT_SCHOLAR_DISPUTE");
    expect(game.state.ancientScholar.encounter.targetId).toBe("AS3-ROOK-VENN");
    await mountGame(game);
    expect(screen.queryByRole("dialog", { name: "战斗回合结果" })).toBeNull();
    const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(stage.textContent).toContain("鲁克"); expect(within(stage).getByRole("heading", { name: "第 1 回合" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "人物卷宗" })).toBeNull();
    const control = battle.stances.find(stance => stance.id === "CONTROL")!;
    await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(control.label) }));
    await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    const result = await screen.findByRole("dialog", { name: "战斗回合结果" });
    expect(within(result).getByRole("heading", { name: "第 1 回合结果" })).toBeTruthy();
    expect(game.state.lastCombatRound?.ancientScholarOutcome?.targetId).toBe("AS3-ROOK-VENN");
    const originalFirstRound = (capture.final.combatHistory as SliceState["combatHistory"]).find(round => round.ancientScholarOutcome?.round === 1);
    expect(game.state.lastCombatRound?.ancientScholarOutcome).toEqual(originalFirstRound?.ancientScholarOutcome);
    expect(game.state.combat?.round).toBe(2); expect(game.state.ancientScholar.encounter.status).toBe("FIGHTING");
    await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
    const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(within(next).getByRole("heading", { name: "第 2 回合" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "战斗回合结果" })).toBeNull();
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "CONTROL" });
    expect(game.state.bizarroSorcerer).toEqual(before.bizarroSorcerer);
  }, 15_000);
});
