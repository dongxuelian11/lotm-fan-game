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
const natural = () => JSON.parse(readFileSync("tests/fixtures/puppet-v01340/natural.json", "utf8"));
const project = (state: unknown) => projectSliceState(migrateSliceState(state));
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it("opens the actual S5 to S4 advancement from the dashboard guide", async () => {
  await enter(project(natural().guidanceStart));
  await userEvent.click(screen.getByRole("button", { name: "查看木偶晋升" }));
  expect(screen.getByRole("region", { name: "木偶成长下一步" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "木偶配方与成品边界" }).textContent).toContain("完整配方与原著晋升仪式细节仍未知");
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("opens actual S4 reports with max spirituality 120 and the unchanged S5 history", async () => {
  const state = project(natural().practiced); expect(state.progression.sequence).toBe(4); expect(state.maxSpirituality).toBe(120);
  await enter(state); expect(screen.getByRole("meter",{name:"灵性"}).getAttribute("aria-valuemax")).toBe("120");
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "木偶成长下一步" }).textContent).toContain(`当前灵性 ${state.spirituality} / 120`);
  expect(screen.getByRole("progressbar", { name: "木偶扮演进度" }).getAttribute("value")).toBe("100");
  await userEvent.click(screen.getByRole("button", { name: "怨魂经历" }));
  const history = screen.getByRole("region", { name: "怨魂时期的经历" });
  expect(history.textContent).toContain("WF5-FLAG-1"); expect(history.textContent).toContain("WF5-NOTE-1");
  expect(within(history).queryByRole("button")).toBeNull(); expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("returns from an already closed original scene to ordinary life without submitting an action", async () => {
  await enter(project(natural().practiced)); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  expect(screen.getByRole("button", { name: /^休养，/ })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "木偶成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("keeps a real open scene locked until its exact zero-AP close has committed", async () => {
  const boundaries = JSON.parse(readFileSync("tests/fixtures/puppet-v01340/boundaries.json", "utf8"));
  let current = migrateSliceState(boundaries.close.beforeLast);
  const initial = projectSliceState(current), health = current.health, mind = current.mind, spirituality = current.spirituality;
  expect(initial.puppet?.insideCase).toBe(true);
  const close = initial.puppet!.actions.find(entry => entry.enabled && entry.command.type === "CLOSE")!;
  expect(close).toBeTruthy();
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This fixture already has an original run.");
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  await enter(initial, submit);
  expect(screen.getByRole("region", { name: "木偶成长下一步" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "怨魂经历" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(close.label) }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(projectSliceState(current).puppet!.insideCase).toBe(false);
  expect([current.health, current.mind, current.spirituality]).toEqual([health, mind, spirituality]);
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});
