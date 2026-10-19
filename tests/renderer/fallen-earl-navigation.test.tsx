/* @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { SliceApp } from "../../src/renderer/SliceApp";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import type { SliceProjection } from "../../src/domain/slice/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

async function enter(state: SliceProjection, submitIntent: SliceBridge["submitIntent"] = vi.fn()) {
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision,
      updatedAt: "2026-10-13T00:00:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: state })), submitIntent,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: new RegExp(state.character.name) }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: state.combat ? "进入下一回合" : "返回生活" }));
}
// The actual preceding S5 save is migrated; no new promotion, original objects or cash are fabricated.
const natural = () => JSON.parse(readFileSync("tests/fixtures/mentor-disorder-v01140/natural.json", "utf8"));
const fallenNatural = () => JSON.parse(readFileSync("tests/fixtures/fallen-earl-v01360/natural.json", "utf8"));
const fallenBoundaries = () => JSON.parse(readFileSync("tests/fixtures/fallen-earl-v01360/boundaries.json", "utf8"));
const project = (state: unknown) => projectSliceState(migrateSliceState(state));
async function openFallenAdvancement() {
  await userEvent.click(screen.getByRole("button", { name: "非凡成长" }));
  await userEvent.click(screen.getByRole("button", { name: "堕落伯爵晋升" }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it("opens actual S5 to S4 preparation through permanent growth without claiming promotion", async () => {
  const state = project(natural().final), before = structuredClone(state);
  expect(state.progression.sequence).toBe(5); expect(state.maxSpirituality).toBe(100);
  expect(state.recovery.needsAttention).toBe(true); expect(state.injuries).toEqual(natural().final.injuries);
  await enter(state); await openFallenAdvancement();
  expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" })).toBeTruthy();
  const boundary = screen.getByRole("region", { name: "堕落伯爵配方与成品边界" });
  for (const text of ["完整配方与晋升仪式细节尚未掌握", "12真实整周", "意志难度28", "继续混乱导师生活"]) expect(boundary.textContent).toContain(text);
  expect(boundary.textContent).toContain("完整配方与晋升仪式细节尚未掌握。原导师米蕾·沃德提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。");
  expect(screen.queryByRole("progressbar", { name: "堕落伯爵扮演进度" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("keeps the actual S5 growth accessible and explicitly switches to the new advancement tab", async () => {
  const state = project(natural().final); await enter(state);
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "混乱导师成长下一步" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "堕落伯爵晋升" }));
  expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "混乱导师成长" }));
  expect(screen.getByRole("region", { name: "混乱导师成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("returns from unstarted S4 preparation to ordinary life without spending the actual S5 resources", async () => {
  const state = project(natural().final), before = structuredClone(state);
  await enter(state); await openFallenAdvancement();
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  expect(screen.getByRole("button", { name: /^休养，/ })).toBeTruthy();
  await openFallenAdvancement();
  expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("shows the migrated original five held and seven given gifts without creating another inventory", async () => {
  const raw = natural().final, original = structuredClone(raw), state = project(raw), before = structuredClone(state);
  expect(raw.briber.gifts.filter((gift: { location: string }) => gift.location === "PLAYER")).toHaveLength(5);
  expect(raw.briber.gifts.filter((gift: { location: string }) => gift.location === "GIVEN")).toHaveLength(7);
  await enter(state); await openFallenAdvancement();
  const gifts = screen.getByRole("region", { name: "堕落伯爵同一原赠物库存" });
  for (const text of ["5 件", "7 件", "0 件", "60便士", "不自动归还"]) expect(gifts.textContent).toContain(text);
  expect(screen.queryByRole("region", { name: "堕落伯爵原马洛与实际费用" })).toBeNull();
  expect(screen.queryByRole("button", { name: /实际购买三.*原/ })).toBeNull();
  expect(raw).toEqual(original); expect(state).toEqual(before);
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("retains the original S5 combat without adding S4 bestow or a luck-policy control", async () => {
  const state = project(natural().combatStart); await enter(state);
  expect(screen.queryByRole("radio", { name: "本回合保留幸运" })).toBeNull();
  expect(screen.queryByRole("region", { name: "堕落伯爵成长下一步" })).toBeNull();
  const submit: SliceBridge["submitIntent"] = vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {}));
  window.sliceGame!.submitIntent = submit;
  await userEvent.click(screen.getByRole("button", { name: "确认姿态，结算完整回合" }));
  expect(submit).toHaveBeenCalledTimes(1);
  const payload = vi.mocked(submit).mock.calls[0]![0].payload;
  expect(payload.type).toBe("COMBAT_ROUND"); expect(payload).not.toHaveProperty("winnerPolicy");
});

it("opens the naturally promoted S4 by default with its actual unrefilled spirituality and zero acting", async () => {
  const state = project(fallenNatural().promoted), before = structuredClone(state);
  expect(state.progression.sequence).toBe(4); expect(state.maxSpirituality).toBe(120);
  expect(state.spirituality).toBeLessThan(120); expect(state.fallenEarl!.acting).toBe(0);
  await enter(state);
  expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe("120");
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" }).textContent).toContain(`当前灵性 ${state.spirituality} / 120`);
  expect(screen.getByRole("progressbar", { name: "堕落伯爵扮演进度" }).getAttribute("value")).toBe("0");
  expect(screen.getByRole("button", { name: "堕落伯爵成长" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("region", { name: "混乱导师成长下一步" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("opens all actual S5 histories after the natural S4 practices and returns to the completed S4", async () => {
  const state = project(fallenNatural().practiced), old = state.mentorDisorder!;
  expect(state.fallenEarl!.acting).toBe(100); expect(old.acting).toBe(100); expect(old.cases).toHaveLength(3);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("progressbar", { name: "堕落伯爵扮演进度" }).getAttribute("value")).toBe("100");
  await userEvent.click(screen.getByRole("button", { name: "混乱导师经历" }));
  const history = screen.getByRole("region", { name: "混乱导师时期的经历" });
  for (const entry of old.cases) {
    expect(entry.status).toBe("RESOLVED"); expect(history.textContent).toContain(entry.title);
    expect(history.textContent).toContain(entry.story); if (entry.result) expect(history.textContent).toContain(entry.result);
  }
  for (const text of ["MD5-RED-1", "MD5-BLUE-1", "MD5-ROUTE-MARKER", "MD5-NOTE-1", "同一原纸已实际交回", "旧里斯"]) expect(history.textContent).toContain(text);
  expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "堕落伯爵成长" }));
  expect(screen.getByRole("progressbar", { name: "堕落伯爵扮演进度" }).getAttribute("value")).toBe("100");
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("keeps the natural clerk contact locked after withdrawal until actual recovery and close both commit", async () => {
  let current = migrateSliceState(fallenBoundaries()["willing-pause"].final);
  const initial = projectSliceState(current), originalMentor = structuredClone(current.mentorDisorder), originalGifts = structuredClone(current.briber.gifts);
  const originalResources = [current.health, current.mind, current.spirituality, current.actionsRemaining];
  expect(initial.fallenEarl!.insideCase).toBe(true); expect(current.fallenEarl.life.clerk.remainingSeconds).toBe(30);
  const withdraw = initial.fallenEarl!.actions.find(entry => entry.enabled && entry.command.type === "WITHDRAW_CONSENT")!;
  const wait = initial.fallenEarl!.actions.find(entry => entry.enabled && entry.command.type === "WAIT_RECOVERY")!;
  const close = initial.fallenEarl!.actions.find(entry => entry.command.type === "CLOSE")!;
  expect(withdraw).toBeTruthy(); expect(wait).toBeTruthy(); expect(close.enabled).toBe(false);
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This fixture already has an original run.");
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  await enter(initial, submit);
  expect(screen.getByRole("region", { name: "堕落伯爵成长下一步" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "混乱导师经历" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(withdraw.label) }));
  expect(current.fallenEarl.life.clerk.consented).toBe(false);
  expect(current.fallenEarl.life.clerk.remainingSeconds).toBe(30); expect(projectSliceState(current).fallenEarl!.insideCase).toBe(true);
  expect((screen.getByRole("button", { name: name => name.startsWith(close.label) }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(wait.label) }));
  expect(current.fallenEarl.life.clerk.remainingSeconds).toBe(0); expect(current.fallenEarl.life.clerk.elapsedSeconds).toBe(30);
  expect(projectSliceState(current).fallenEarl!.insideCase).toBe(true);
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(close.label) }));
  expect(projectSliceState(current).fallenEarl!.insideCase).toBe(false);
  expect(submit).toHaveBeenCalledTimes(3);
  expect(vi.mocked(submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
    { type: "FALLEN_EARL", command: withdraw.command }, { type: "FALLEN_EARL", command: wait.command }, { type: "FALLEN_EARL", command: close.command },
  ]);
  expect([current.health, current.mind, current.spirituality, current.actionsRemaining]).toEqual(originalResources);
  expect(current.mentorDisorder).toEqual(originalMentor); expect(current.briber.gifts).toEqual(originalGifts);
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});
