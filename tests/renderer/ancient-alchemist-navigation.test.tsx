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
const natural = () => JSON.parse(readFileSync("tests/fixtures/druid-v01160/natural.json", "utf8"));
const ancientNatural = () => JSON.parse(readFileSync("tests/fixtures/ancient-alchemist-v01380/natural.json", "utf8"));
const ancientBoundaries = () => JSON.parse(readFileSync("tests/fixtures/ancient-alchemist-v01380/boundaries.json", "utf8"));
function savedGame(state: unknown) {
  let current = migrateSliceState(state);
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This fixture already has its original run.");
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T00:01:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
const project = (state: unknown) => projectSliceState(migrateSliceState(state));
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

it("opens actual S5 to S4 preparation from the dashboard without claiming promotion", async () => {
  const state = project(natural().final), before = structuredClone(state);
  expect(state.progression.sequence).toBe(5); expect(state.maxSpirituality).toBe(100);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: "非凡成长" }));
  await userEvent.click(screen.getByRole("button", { name: "古代炼金师晋升" }));
  expect(screen.getByRole("region", { name: "古代炼金师成长下一步" })).toBeTruthy();
  const boundary = screen.getByRole("region", { name: "古代炼金师配方与成品边界" });
  for (const text of ["完整配方与晋升仪式细节尚未掌握。原导师伊芙·莫兰提供独立成品、专业准备与指导，具体数值以本页说明为准；服药前仍须满足本次准备要求。", "12真实整周", "意志难度28", "继续德鲁伊生活"]) expect(boundary.textContent).toContain(text);
  expect(screen.queryByRole("progressbar", { name: "古代炼金师扮演进度" })).toBeNull();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("keeps the actual S5 growth accessible and explicitly switches to the new advancement tab", async () => {
  const state = project(natural().final); await enter(state);
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "德鲁伊成长下一步" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "古代炼金师晋升" }));
  expect(screen.getByRole("region", { name: "古代炼金师成长下一步" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "德鲁伊成长" }));
  expect(screen.getByRole("region", { name: "德鲁伊成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("returns from unstarted S4 preparation to ordinary life without spending the actual S5 resources", async () => {
  const state = project(natural().final), before = structuredClone(state);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: "非凡成长" }));
  await userEvent.click(screen.getByRole("button", { name: "古代炼金师晋升" }));
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  expect(screen.getByRole("button", { name: /^休养，/ })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "非凡成长" }));
  await userEvent.click(screen.getByRole("button", { name: "古代炼金师晋升" }));
  expect(screen.getByRole("region", { name: "古代炼金师成长下一步" })).toBeTruthy();
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("opens naturally promoted S4 with paid failed bottles, zero acting and unrefilled spirituality", async () => {
  const capture = ancientNatural(), state = project(capture.promoted), before = structuredClone(state);
  expect(capture.prefixCount).toBe(304); expect(capture.commands).toHaveLength(483);
  expect(state.progression.sequence).toBe(4); expect(state.maxSpirituality).toBe(120);
  expect(state.spirituality).toBe(85); expect(state.ancientAlchemist!.acting).toBe(0);
  expect(capture.promoted.ancientAlchemist.bottles.map((entry: { outcome: string }) => entry.outcome)).toEqual(["FAILURE", "FAILURE", "SUCCESS"]);
  await enter(state);
  expect(screen.getByRole("meter", { name: "灵性" }).getAttribute("aria-valuemax")).toBe("120");
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain("当前灵性 85 / 120");
  expect(screen.getByRole("progressbar", { name: "古代炼金师扮演进度" }).getAttribute("value")).toBe("0");
  expect(screen.getByRole("button", { name: "古代炼金师成长" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("尚未制作护腕");
  // The public S4 list includes all inherited abilities. Only the two genuinely new abilities start at zero.
  const abilityRegion = screen.getByRole("region", { name: "古代炼金师能力与消化" });
  const newAbilities = state.ancientAlchemist!.abilities.filter(ability => ability.id.startsWith("mother.s4."));
  expect(newAbilities.map(ability => ability.id)).toEqual(["mother.s4.vital-knit", "mother.s4.living-matrix"]);
  for (const ability of newAbilities) expect(ability.mastery).toBe(0);
  for (const ability of state.ancientAlchemist!.abilities) {
    expect(within(abilityRegion).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
  }
  for (const original of project(natural().final).druid!.abilities) {
    expect(state.ancientAlchemist!.abilities.find(ability => ability.id === original.id)?.mastery).toBe(original.mastery);
  }
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});

it("keeps all five earlier stages accessible and original Druid practice read-only after new reports", async () => {
  const state = project(ancientNatural().practiced), old = state.druid!;
  expect(state.ancientAlchemist!.acting).toBe(100); expect(old.acting).toBe(100); expect(old.cases).toHaveLength(3);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "德鲁伊经历" }));
  const history = screen.getByRole("region", { name: "德鲁伊时期的经历" });
  for (const entry of old.cases) {
    expect(entry.status).toBe("RESOLVED"); expect(history.textContent).toContain(entry.title);
    expect(history.textContent).toContain(entry.story); if (entry.result) expect(history.textContent).toContain(entry.result);
  }
  for (const text of ["BOX", "SETTLED", "RESTING", "HANDED_OVER", "拉瓦章鱼", "成年霍纳奇斯灰山羊", "六翼石像鬼", "原马伦"]) expect(history.textContent).toContain(text);
  expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull();
  for (const name of ["生物学家", "丰收祭司", "医师", "耕种者"]) {
    await userEvent.click(screen.getByRole("button", { name: `${name}经历` }));
    expect(screen.getByRole("region", { name: `${name}时期的经历` })).toBeTruthy();
  }
  await userEvent.click(screen.getByRole("button", { name: "古代炼金师成长" }));
  expect(screen.getByRole("progressbar", { name: "古代炼金师扮演进度" }).getAttribute("value")).toBe("100");
  const facts = screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" });
  for (const text of ["AA4-MATRIX-1", "AA4-MATRIX-2", "AA4-MATRIX-3", "NO_RESPONSE", "BRACED_WEIGHT", "AA4-KIT-4", "6小时", "60秒", "NORA"]) expect(facts.textContent).toContain(text);
  await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});

it("keeps actual living-stem contact locked until six-hour observation, original-pot return and close commit", async () => {
  const game = savedGame(ancientBoundaries()["living-stem"].final), initial = projectSliceState(game.state);
  const old = structuredClone(game.state.druid), kit = structuredClone(game.state.ancientAlchemist.life.kits[0]);
  const resources = [game.state.health, game.state.mind, game.state.spirituality, game.state.cash, game.state.actionsRemaining];
  expect(initial.ancientAlchemist!.insideCase).toBe(true); expect(game.state.ancientAlchemist.life.stem.observationHours).toBe(0);
  const steps = ["OBSERVE_RECOVERY", "RETURN_SAMPLE", "CLOSE"] as const;
  await enter(initial, game.submit);
  expect(screen.getByRole("region", { name: "古代炼金师成长下一步" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "德鲁伊经历" }) as HTMLButtonElement).disabled).toBe(true);
  for (const type of steps) {
    const entry = projectSliceState(game.state).ancientAlchemist!.actions.find(action => action.enabled && action.command.type === type && "caseId" in action.command && action.command.caseId === "living-stem")!;
    expect(entry).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(entry.label) }));
    if (type !== "CLOSE") expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  }
  const stem = game.state.ancientAlchemist.life.stem;
  expect(stem.id).toBe("AA4-STEM-1"); expect(stem.observationHours).toBe(6); expect(stem.holder).toBe("GUIDE");
  expect(stem.position).toBe("GUIDE_BENCH"); expect(stem.living).toBe(true); expect(stem.returns).toBe(1);
  expect(game.state.ancientAlchemist.life.kits[0]).toEqual(kit); expect(game.state.druid).toEqual(old);
  expect([game.state.health, game.state.mind, game.state.spirituality, game.state.cash, game.state.actionsRemaining]).toEqual(resources);
  expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual(steps.map(type => ({ type: "ANCIENT_ALCHEMIST", command: { type, caseId: "living-stem" } })));
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});

it("cleans up the actual failed first matrix without relabeling it a successful living prototype", async () => {
  const game = savedGame(ancientBoundaries()["living-fibre"].final), initial = projectSliceState(game.state);
  const old = structuredClone(game.state.druid), kit = structuredClone(game.state.ancientAlchemist.life.kits[1]);
  const resources = [game.state.spirituality, game.state.cash, game.state.actionsRemaining, game.state.progression.acting];
  expect(game.state.ancientAlchemist.life.matrices[0]!.success).toBe(false);
  expect(game.state.ancientAlchemist.life.matrices[0]!.id).toBe("AA4-MATRIX-1");
  await enter(initial, game.submit);
  expect((screen.getByRole("combobox", { name: "选择当前古代炼金师生活实践" }) as HTMLSelectElement).value).toBe("living-fibre");
  expect(screen.getByRole("region", { name: "古代炼金师实际实践结果" }).textContent).toContain("INERT_RESIDUE");
  for (const type of ["TEST_MATRIX", "STOP_MATRIX", "RETURN_SAMPLE", "CLOSE"] as const) {
    const entry = projectSliceState(game.state).ancientAlchemist!.actions.find(action => action.enabled && action.command.type === type && "caseId" in action.command && action.command.caseId === "living-fibre")!;
    expect(entry).toBeTruthy(); await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(entry.label) }));
    if (type === "TEST_MATRIX") {
      expect(game.state.ancientAlchemist.life.matrices[0]!.test).toBe("NO_RESPONSE");
      expect(game.state.ancientAlchemist.life.matrices[0]!.elapsedSeconds).toBe(10);
    }
    if (type !== "CLOSE") expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  }
  const matrix = game.state.ancientAlchemist.life.matrices[0]!;
  expect(matrix.id).toBe("AA4-MATRIX-1"); expect(matrix.kitId).toBe("AA4-KIT-2"); expect(matrix.success).toBe(false);
  expect(matrix.state).toBe("INERT"); expect(matrix.elapsedSeconds).toBe(60); expect(matrix.holder).toBe("GUIDE_WASTE");
  expect(game.state.ancientAlchemist.life.cases["living-fibre"].attempts[0]!.distanceMetres).toBe(2);
  expect(game.state.ancientAlchemist.life.cases["living-fibre"].status).toBe("OBSERVED");
  expect(game.state.ancientAlchemist.life.kits[1]).toEqual(kit); expect(game.state.druid).toEqual(old);
  expect([game.state.spirituality, game.state.cash, game.state.actionsRemaining, game.state.progression.acting]).toEqual(resources);
  // Failed, closed attempts return to OBSERVED; no successful-report command is projected at this stage.
  const report = projectSliceState(game.state).ancientAlchemist!.actions.find(action => action.command.type === "REPORT" && "caseId" in action.command && action.command.caseId === "living-fibre");
  expect(report).toBeUndefined();
  expect(screen.queryByRole("button", { name: /^报告已成功并实际收束的有限结果/ })).toBeNull();
  expect(game.state.seer.completedSources).not.toContain("ancient-alchemist-case:living-fibre");
  const afterCleanup = structuredClone(game.state);
  expect(() => applySliceIntent(game.state, { type: "ANCIENT_ALCHEMIST", command: { type: "REPORT", caseId: "living-fibre" } })).toThrow("须真实成功、完整观察验证与同一原物实际收束。");
  expect(game.state).toEqual(afterCleanup);
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" }));
  expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});

it("hands the same actual report to original Nora and walks four metres before exit", async () => {
  const game = savedGame(ancientBoundaries()["honest-handover"].final), old = structuredClone(game.state.druid);
  const paper = structuredClone(game.state.ancientAlchemist.life.record), resources = [game.state.spirituality, game.state.cash, game.state.actionsRemaining];
  expect(paper.holder).toBe("PLAYER"); expect(paper.revisions[0]).toContain("AA4-KIT-4");
  expect(paper.revisions[0]).toContain("NO_RESPONSE"); expect(paper.revisions[0]).toContain("BRACED_WEIGHT");
  await enter(projectSliceState(game.state), game.submit);
  const hand = projectSliceState(game.state).ancientAlchemist!.actions.find(action => action.enabled && action.command.type === "HAND_OVER")!;
  expect(screen.getByRole("region", { name: "古代炼金师成长下一步" }).textContent).toContain(hand.label);
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(hand.label) }));
  expect(game.state.ancientAlchemist.life.record.holder).toBe("NORA"); expect(game.state.ancientAlchemist.life.record.handovers).toBe(1);
  expect(game.state.ancientAlchemist.life.record.distanceMetres).toBe(4); expect(game.state.ancientAlchemist.life.record.revisions).toEqual(paper.revisions);
  expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  const close = projectSliceState(game.state).ancientAlchemist!.actions.find(action => action.enabled && action.command.type === "CLOSE" && "caseId" in action.command && action.command.caseId === "honest-handover")!;
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(close.label) }));
  expect(game.state.druid).toEqual(old); expect([game.state.spirituality, game.state.cash, game.state.actionsRemaining]).toEqual(resources);
  await userEvent.click(await screen.findByRole("button", { name: "关闭非凡成长" })); expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
});

it("actually pays for the existing original guard kit and retains exactly three unspent segments", async () => {
  const boundary = ancientBoundaries()["prepare-guard"], game = savedGame(boundary.beforeLast);
  const before = { cash: game.state.cash, spirituality: game.state.spirituality, actions: game.state.actionsRemaining, druid: structuredClone(game.state.druid) };
  expect(game.state.ancientAlchemist.life.guards).toHaveLength(0);
  await enter(projectSliceState(game.state), game.submit); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const prepare = projectSliceState(game.state).ancientAlchemist!.actions.find(action => action.enabled && action.command.type === "PREPARE_GUARD" && action.command.kitId === "AA4-GUARD-KIT-1")!;
  await userEvent.click(screen.getByRole("button", { name: name => name.startsWith(prepare.label) }));
  expect(game.state.cash).toBe(before.cash - 120); expect(game.state.spirituality).toBe(before.spirituality - 4);
  expect(game.state.actionsRemaining).toBe(before.actions - 1); expect(game.state.druid).toEqual(before.druid);
  expect(game.state.ancientAlchemist.life.guards).toEqual(boundary.final.ancientAlchemist.life.guards);
  const facts = screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" });
  for (const text of ["AA4-GUARD-1", "AA4-GUARD-KIT-1", "剩3/3段", "AA4-GUARD-1-SEGMENT-1", "AA4-GUARD-1-SEGMENT-2", "AA4-GUARD-1-SEGMENT-3"]) expect(facts.textContent).toContain(text);
  expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([boundary.lastIntent]);
});

it("shows the actual natural terminal opponent and unchanged guard instead of inventing a B activation", async () => {
  const capture = ancientNatural(), state = project(capture.final), before = structuredClone(state);
  expect(capture.final.ancientAlchemist.encounter.guardAttempts).toBe(0);
  expect(capture.final.ancientAlchemist.life.guards[0].segments.every((entry: { spentWeek: number | null }) => entry.spentWeek === null)).toBe(true);
  await enter(state); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const encounter = screen.getByRole("region", { name: "古代炼金师原奥斯里克与实际费用" });
  for (const text of ["AA4-OSRIC-VALE", "AA4-OSRIC-CLUB", "尝试防护 0 次", "原奥斯里克自行停止抵抗", "不能重新开战"]) expect(encounter.textContent).toContain(text);
  expect(screen.getByRole("region", { name: "古代炼金师本次原材料与实际收束" }).textContent).toContain("剩3/3段");
  for (const action of state.ancientAlchemist!.actions.filter(action => action.command.type === "ENCOUNTER_FIGHT")) {
    expect((screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement).disabled).toBe(true);
  }
  await userEvent.click(screen.getByRole("button", { name: "德鲁伊经历" }));
  expect(screen.getByRole("region", { name: "德鲁伊时期的经历" }).textContent).toContain("原马伦");
  expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled(); expect(state).toEqual(before);
});
