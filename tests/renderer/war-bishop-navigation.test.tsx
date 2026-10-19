/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { WarBishopCommand } from "../../src/domain/war-bishop/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface NaturalCapture { prefixCount: number; commands: SliceIntent[]; promoted: unknown; practiced: unknown; combatStart: unknown; beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// Real command captures only. Never patch resources, member presence, RNG, qualifications or original objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/iron-blood-knight-v01180/natural.json", "utf8"));
const natural = (): NaturalCapture => JSON.parse(readFileSync("tests/fixtures/war-bishop-v01410/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/war-bishop-v01410/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real War Bishop boundary: ${name}`);
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
      committedAt: "2026-10-13T01:00:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;

async function acknowledgeSavedRound() {
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function mountGame(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T00:59:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: state.status === "DEAD" ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "人物卷宗" })
    ?? screen.queryByRole("region", { name: "战争主教" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Older saved outcomes remain history; acknowledge them through the actual UI, never erase them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.warBishop.insideCase) await screen.findByRole("region", { name: "战争主教" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "战争主教与原队协作" }));
    await screen.findByRole("region", { name: "战争主教" });
  }
}
function actionButton(state: SliceState, type: WarBishopCommand["type"], bottleId?: string) {
  const entry = projectSliceState(state).warBishop.actions.find(item => item.command.type === type
    && (!bottleId || "bottleId" in item.command && item.command.bottleId === bottleId));
  if (!entry) throw new Error(`No actual public War Bishop action: ${type}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "战争主教" }).getAttribute("aria-busy")).toBe("false"));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("War Bishop navigation from preserved real Hunter captures", () => {
  it("opens and closes the optional S3 route from all 423 original commands without changing original people or history", async () => {
    const capture = original(), game = savedGame(capture.final), before = structuredClone(game.state);
    expect(capture.commands).toHaveLength(423); expect(game.state.progression.sequence).toBe(4);
    expect(game.state.ironBloodKnight.team.members).toHaveLength(30);
    expect(game.state.ironBloodKnight.team.members.every(member => !member.present && member.location === "HOME")).toBe(true);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "战争主教当前目标" }).textContent).toContain("铁血骑士需消化100");
    const summary = screen.getByText("原身体、三十人历史与继承能力", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "战争主教继承记录" });
    expect(history.textContent).toContain("30位原成员只有一份健康");
    expect(history.textContent).toContain("本阶不再次改变性别");
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭战争主教页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("retries the same real field-preparation envelope once after failed persistence without paying twice", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "WAR_BISHOP", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, "PREPARE_PROMOTION"));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, "PREPARE_PROMOTION").disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭战争主教页面" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - 120); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.ironBloodKnight.team.members).toEqual(before.ironBloodKnight.team.members);
    expect(game.state.ironBloodKnight.encounter).toEqual(before.ironBloodKnight.encounter);
    expect(screen.queryByRole("button", { name: "关闭战争主教页面" })).toBeNull();
  }, 15_000);

  it("independently confirms the actual successful original bottle while preserving the earlier body change and thirty original members", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "WAR_BISHOP" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Actual promotion capture must be a consumed original bottle.");
    const bottleId = captured.lastIntent.command.bottleId;
    await mountGame(game);
    const select = screen.getByRole("combobox", { name: "选择独立战争主教原瓶" });
    await userEvent.selectOptions(select, bottleId);
    await userEvent.click(actionButton(game.state, "CONSUME", bottleId));
    const review = screen.getByRole("region", { name: "战争主教原瓶服用确认" });
    expect(review.textContent).toContain(bottleId); expect(review.textContent).toContain("身体性别不再变化");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, "CONSUME", bottleId));
    await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.progression.sequence).toBe(3); expect(game.state.character.gender).toBe(before.character.gender);
    expect(game.state.ironBloodKnight).toEqual(before.ironBloodKnight);
    expect(game.state.warBishop.ironBloodActingAtPromotion).toBe(100);
    expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.submit).toHaveBeenCalledOnce();
  }, 15_000);

  it("returns from the actual practiced living S3 save to ordinary life without re-inviting the team or resetting original outcomes", async () => {
    const capture = natural(), game = savedGame(capture.practiced), before = structuredClone(game.state);
    expect(capture.prefixCount).toBe(423); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.warBishop.life.reflected).toBe(true); expect(game.state.progression.acting).toBe(100);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "战争主教当前目标" }).textContent).toContain("实际在院 0 / 5");
    const team = screen.getByText("原G1五人的当前状态 · 实际在院 0 / 5", { selector: "summary" });
    expect(team.closest("details")!.open).toBe(false); await userEvent.click(team);
    const people = screen.getByRole("region", { name: "原G1真实成员状态" });
    for (const member of before.ironBloodKnight.team.members.slice(0, 5)) {
      expect(people.textContent).toContain(`${member.name}`); expect(people.textContent).toContain(`健康 ${member.health} / 100`); expect(people.textContent).toContain(`精力 ${member.energy} / 20`);
    }
    await userEvent.click(screen.getByRole("button", { name: "关闭战争主教页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "战争主教" })).toBeTruthy(); expect(game.state).toEqual(before);
  }, 15_000);

  it.each(["HOLD", "LINK_IF_READY"] as const)("saves one actual current-war round with explicit %s policy and preserves its real costs", async policy => {
    const game = savedGame(natural().combatStart), before = structuredClone(game.state), battle = projectSliceState(game.state).combat!;
    expect(game.state.combat?.encounterId).toBe("WAR_BISHOP_DISPUTE"); expect(battle.warBishop?.targetId).toBe("WB3-CEDRIC-VALE");
    await mountGame(game); const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    const hold = within(stage).getByRole("radio", { name: "本回合保留" }) as HTMLInputElement;
    const link = within(stage).getByRole("radio", { name: "条件满足时联结（本人5灵性、原五人各2精力）" }) as HTMLInputElement;
    expect(hold.checked).toBe(true); expect(link.checked).toBe(false);
    expect(stage.textContent).toContain("缺人、拒绝、重伤或资源不足便不消耗");
    if (policy === "LINK_IF_READY") await userEvent.click(link);
    expect(game.submit).not.toHaveBeenCalled();
    const control = battle.stances.find(stance => stance.id === "CONTROL")!;
    await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(control.label) }));
    await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    const result = await screen.findByRole("dialog", { name: "战斗回合结果" });
    expect(within(result).getByRole("heading", { name: `第 ${before.combat!.round} 回合结果` })).toBeTruthy();
    const outcome = game.state.lastCombatRound?.warBishopOutcome;
    expect(outcome?.targetId).toBe("WB3-CEDRIC-VALE"); expect(outcome?.policy).toBe(policy);
    expect(outcome?.source.revision).toBe(before.revision); expect(outcome?.source.members).toEqual(battle.warBishop?.source?.members);
    expect(outcome?.linkCost).toBe(policy === "HOLD" ? 0 : 5);
    expect(outcome?.teamContribution).toBeLessThanOrEqual(20);
    expect(game.state.ironBloodKnight.encounter).toEqual(before.ironBloodKnight.encounter);
    expect(game.state.ironBloodKnight.team.members.slice(5)).toEqual(before.ironBloodKnight.team.members.slice(5));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision,
      payload: { type: "COMBAT_ROUND", stance: "CONTROL", warBishopPolicy: policy } });
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
      expect((within(next).getByRole("radio", { name: "本回合保留" }) as HTMLInputElement).checked).toBe(true);
      expect((within(next).getByRole("radio", { name: "条件满足时联结（本人5灵性、原五人各2精力）" }) as HTMLInputElement).checked).toBe(false);
    }
  }, 15_000);

  it("keeps the actual terminal round and reloads the resulting death as a read-only original archive", async () => {
    const capture = natural(), game = savedGame(capture.beforeLast), final = migrateSliceState(capture.final);
    if (capture.lastIntent.type !== "COMBAT_ROUND") throw new Error("The captured final intent must be the actual terminal combat round.");
    const lastIntent = capture.lastIntent;
    expect(final.status).toBe("DEAD"); expect(final.health).toBe(0); expect(final.ending?.kind).toBe("DEATH");
    await mountGame(game); const battle = projectSliceState(game.state).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    const stance = battle.stances.find(item => item.id === lastIntent.stance)!;
    await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(stance.label) }));
    if (lastIntent.warBishopPolicy === "LINK_IF_READY") await userEvent.click(within(stage).getByRole("radio", { name: "条件满足时联结（本人5灵性、原五人各2精力）" }));
    await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
    await waitFor(() => expect(game.state.status).toBe("DEAD")); expect(game.state).toEqual(final);
    const result = await screen.findByRole("dialog", { name: "战斗回合结果" });
    await userEvent.click(within(result).getByRole("button", { name: "查看收尾卷宗" }));
    expect(screen.getByRole("heading", { name: final.ending!.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual(capture.lastIntent);
    cleanup(); delete window.sliceGame;
    const archived = savedGame(capture.final), before = structuredClone(archived.state); await mountGame(archived);
    expect(screen.getByRole("heading", { name: final.ending!.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull(); expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    expect(archived.state.ironBloodKnight.team.members.slice(0, 5).map(member => member.energy)).toEqual(final.ironBloodKnight.team.members.slice(0, 5).map(member => member.energy));
    expect(archived.state.ironBloodKnight.encounter).toEqual(final.ironBloodKnight.encounter);
    expect(archived.state).toEqual(before); expect(archived.submit).not.toHaveBeenCalled();
  }, 15_000);
});
