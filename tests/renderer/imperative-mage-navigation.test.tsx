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
const natural = () => JSON.parse(readFileSync("tests/fixtures/punishment-knight-v01150/natural.json", "utf8"));
const imperativeNatural = () => JSON.parse(readFileSync("tests/fixtures/imperative-mage-v01370/natural.json", "utf8"));
const imperativeBoundaries = () => JSON.parse(readFileSync("tests/fixtures/imperative-mage-v01370/boundaries.json", "utf8"));
const project = (state: unknown) => projectSliceState(migrateSliceState(state));
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it("opens actual S5 to S4 preparation from the dashboard without claiming promotion", async () => {
  const state = project(natural().final), before = structuredClone(state);
  expect(state.progression.sequence).toBe(5); expect(state.maxSpirituality).toBe(100);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: "查看律令法师晋升" }));
  expect(screen.getByRole("region", { name: "律令法师成长下一步" })).toBeTruthy();
  const boundary = screen.getByRole("region", { name: "律令法师配方与成品边界" });
  for (const text of ["完整配方与晋升仪式细节尚未掌握", "12真实整周", "意志难度28", "继续惩戒骑士生活"]) expect(boundary.textContent).toContain(text);
  expect(screen.queryByRole("progressbar", { name: "律令法师扮演进度" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("keeps the actual S5 growth accessible and explicitly switches to the new advancement tab", async () => {
  const state = project(natural().final); await enter(state);
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "惩戒骑士成长下一步" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "律令法师晋升" }));
  expect(screen.getByRole("region", { name: "律令法师成长下一步" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "惩戒骑士成长" }));
  expect(screen.getByRole("region", { name: "惩戒骑士成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("returns from unstarted S4 preparation to ordinary life without spending the actual S5 resources", async () => {
  const state = project(natural().final), before = structuredClone(state);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: "查看律令法师晋升" }));
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  expect(screen.getByRole("button", { name: /^休养，/ })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "查看律令法师晋升" }));
  expect(screen.getByRole("region", { name: "律令法师成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("opens actual naturally promoted S4 with its unrefilled spirituality and zero acting", async () => {
  const state = project(imperativeNatural().promoted), before = structuredClone(state);
  expect(state.progression.sequence).toBe(4); expect(state.maxSpirituality).toBe(120);
  expect(state.spirituality).toBeLessThan(120); expect(state.imperativeMage!.acting).toBe(0);
  await enter(state);
  expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe("120");
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(`当前灵性 ${state.spirituality} / 120`);
  expect(screen.getByRole("progressbar", { name: "律令法师扮演进度" }).getAttribute("value")).toBe("0");
  expect(screen.getByRole("button", { name: "律令法师成长" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("region", { name: "惩戒骑士成长下一步" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("keeps all five real earlier stages accessible and S5 original cases read-only after new practice", async () => {
  const state = project(imperativeNatural().practiced), old = state.punishmentKnight!;
  expect(state.imperativeMage!.acting).toBe(100); expect(old.acting).toBe(100); expect(old.cases).toHaveLength(3);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "惩戒骑士经历" }));
  const history = screen.getByRole("region", { name: "惩戒骑士时期的经历" });
  for (const entry of old.cases) {
    expect(entry.status).toBe("RESOLVED"); expect(history.textContent).toContain(entry.title);
    expect(history.textContent).toContain(entry.story); if (entry.result) expect(history.textContent).toContain(entry.result);
  }
  for (const text of ["PK5-SOFT-PAD-1", "PK5-LINE-1", "PK5-NOTE-1", "同一原纸已实际交回", "旧迪恩"]) expect(history.textContent).toContain(text);
  expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull();
  for (const name of ["法官", "审讯者", "治安官", "仲裁人"]) {
    await userEvent.click(screen.getByRole("button", { name: `${name}经历` }));
    expect(screen.getByRole("region", { name: `${name}时期的经历` })).toBeTruthy();
  }
  await userEvent.click(screen.getByRole("button", { name: "律令法师成长" }));
  expect(screen.getByRole("progressbar", { name: "律令法师扮演进度" }).getAttribute("value")).toBe("100");
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("keeps the natural original attention contact locked after consent withdrawal until real release and close", async () => {
  let current = migrateSliceState(imperativeBoundaries()["willing-attention"].final);
  const initial = projectSliceState(current), old = structuredClone(current.punishmentKnight);
  const originalResources = [current.health, current.mind, current.spirituality, current.actionsRemaining];
  expect(initial.imperativeMage!.insideCase).toBe(true); expect(current.imperativeMage.life.attention.remainingSeconds).toBe(3);
  const withdraw = initial.imperativeMage!.actions.find(entry => entry.enabled && entry.command.type === "WITHDRAW_CONSENT")!;
  const release = initial.imperativeMage!.actions.find(entry => entry.enabled && entry.command.type === "RELEASE_ATTENTION")!;
  const close = initial.imperativeMage!.actions.find(entry => entry.command.type === "CLOSE" && "caseId" in entry.command && entry.command.caseId === "willing-attention")!;
  expect(withdraw).toBeTruthy(); expect(release).toBeTruthy(); expect(close.enabled).toBe(false);
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This fixture already has an original run.");
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  await enter(initial, submit);
  expect(screen.getByRole("region", { name: "律令法师成长下一步" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "惩戒骑士经历" }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(withdraw.label) }));
  expect(current.imperativeMage.life.attention.consented).toBe(false);
  expect(current.imperativeMage.life.attention.remainingSeconds).toBe(3); expect(projectSliceState(current).imperativeMage!.insideCase).toBe(true);
  expect((screen.getByRole("button", { name: name => name.startsWith(close.label) }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(release.label) }));
  expect(current.imperativeMage.life.attention.remainingSeconds).toBe(0); expect(current.imperativeMage.life.attention.elapsedSeconds).toBe(3);
  expect(projectSliceState(current).imperativeMage!.insideCase).toBe(true);
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(close.label) }));
  expect(projectSliceState(current).imperativeMage!.insideCase).toBe(false);
  expect(vi.mocked(submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
    { type: "IMPERATIVE_MAGE", command: withdraw.command }, { type: "IMPERATIVE_MAGE", command: release.command }, { type: "IMPERATIVE_MAGE", command: close.command },
  ]);
  expect([current.health, current.mind, current.spirituality, current.actionsRemaining]).toEqual(originalResources);
  expect(current.punishmentKnight).toEqual(old);
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});

it("commits actual original FLASH blocking, resource-paid recovery and two-metre object return before exit", async () => {
  let current = migrateSliceState(imperativeBoundaries()["one-borrowed-light"].final);
  const initial = projectSliceState(current), old = structuredClone(current.punishmentKnight);
  expect(current.imperativeMage.life.partner.spirituality).toBe(10); expect(current.imperativeMage.life.partner.abilityAvailable).toBe(false);
  const check = initial.imperativeMage!.actions.find(entry => entry.enabled && entry.command.type === "CHECK_LIGHT")!;
  const restore = initial.imperativeMage!.actions.find(entry => entry.enabled && entry.command.type === "RESTORE_LIGHT")!;
  const close = initial.imperativeMage!.actions.find(entry => entry.command.type === "CLOSE" && "caseId" in entry.command && entry.command.caseId === "one-borrowed-light")!;
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This fixture already has an original run.");
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  await enter(initial, submit);
  expect(screen.getByRole("region", { name: "律令法师成长下一步" }).textContent).toContain(check.label);
  expect((screen.getByRole("combobox", { name: "选择当前律令法师生活实践" }) as HTMLSelectElement).value).toBe("one-borrowed-light");
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(check.label) }));
  expect(current.imperativeMage.life.cases["one-borrowed-light"].attempts.at(-1)!.lightCheck).toBe("BLOCKED");
  expect(current.imperativeMage.life.partner.spirituality).toBe(10);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(restore.label) }));
  expect(current.imperativeMage.life.partner.abilityAvailable).toBe(true); expect(current.imperativeMage.life.partner.spirituality).toBe(8);
  expect(current.imperativeMage.life.light.elapsedSeconds).toBe(10);
  expect(current.imperativeMage.life.cases["one-borrowed-light"].attempts.at(-1)!.restoration).toBe("LIT");
  expect(current.imperativeMage.life.light.holder).toBe("TABLE");
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(close.label) }));
  expect(current.imperativeMage.life.light.holder).toBe("GUIDE"); expect(current.imperativeMage.life.light.distanceMetres).toBe(2);
  expect(projectSliceState(current).imperativeMage!.insideCase).toBe(false); expect(current.punishmentKnight).toEqual(old);
  expect(vi.mocked(submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
    { type: "IMPERATIVE_MAGE", command: check.command }, { type: "IMPERATIVE_MAGE", command: restore.command }, { type: "IMPERATIVE_MAGE", command: close.command },
  ]);
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});
