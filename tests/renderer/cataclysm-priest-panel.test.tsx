/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCataclysmPriestCommand, projectCataclysmPriest } from "../../src/domain/cataclysm-priest/index";
import { applyCataclysmPriestActivity, validateCataclysmPriestActivityCommand, type CataclysmPriestCaseId } from "../../src/domain/cataclysm-priest/life";
import { CATACLYSM_PRIEST_CONSUMPTION_RISK } from "../../src/domain/cataclysm-priest/content";
import type { CataclysmPriestAction, CataclysmPriestCommand, CataclysmPriestProjection } from "../../src/domain/cataclysm-priest/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { CataclysmPriestOceanSingerHistory, CataclysmPriestPanel } from "../../src/renderer/CataclysmPriestPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldRun = JSON.parse(readFileSync("tests/fixtures/ocean-singer-v01020/natural.json", "utf8")).final;
/** Directed component setup only: original S5 history stays unchanged; the test clock,
 * attributes and resources isolate UI boundaries. Navigation below never uses this setup. */
function singer(): SliceState {
  const s = migrateSliceState(structuredClone(oldRun));
  s.week = Math.max(s.week, s.oceanSinger.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.physique = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function apply(s: SliceState, command: CataclysmPriestCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  if (validateCataclysmPriestActivityCommand(command)) applyCataclysmPriestActivity(s, command, context);
  else applyCataclysmPriestCommand(s, command, context);
}
function taught() { const s = singer(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function booked() {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "cataclysm-priest-potion-1" }); apply(s, { type: "BOOK_RITUAL" }); return s;
}
function entered() { const s = booked(); s.week++; apply(s, { type: "BEGIN_RITUAL" }); return s; }
function cleared() { const s = entered(); apply(s, { type: "CLEAR_COAST" }); return s; }
function checked() { const s = cleared(); apply(s, { type: "CHECK_PREPARATION", confirmed: true }); return s; }
function surge() { const s = checked(); apply(s, { type: "START_QUAKE", confirmed: true }); return s; }
function drank(roll = 1) { const s = surge(); apply(s, { type: "CONSUME", bottleId: "cataclysm-priest-potion-1", confirmed: true }, roll); return s; }
function promoted(leave = true) { const s = drank(); apply(s, { type: "HOLD_POSITION" }); apply(s, { type: "HOLD_POSITION" }); if (leave) apply(s, { type: "END_RITUAL" }); return s; }
function beginCase(s: SliceState, caseId: CataclysmPriestCaseId, method: "ABILITY" | "ORDINARY" = "ABILITY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method }); apply(s, { type: "MOVE_ALLY" }); apply(s, { type: "PERFORM", caseId }, roll);
}
function finishCase(s: SliceState, caseId: CataclysmPriestCaseId) {
  if (s.cataclysmPriest.life.cases[caseId].effectActive) apply(s, { type: "STOP_EFFECT", caseId });
  if (s.cataclysmPriest.life.float.location === "MARK") apply(s, { type: "RETURN_FLOAT" });
  if (s.cataclysmPriest.life.ally.location === "RIDGE") apply(s, { type: "RETURN_ALLY" });
  apply(s, { type: "CLOSE", caseId }); apply(s, { type: "REPORT", caseId });
}
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: CataclysmPriestProjection, type: CataclysmPriestCommand["type"], predicate: (action: CataclysmPriestAction) => boolean = () => true) {
  const action = value.actions.find(entry => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`); return action;
}
function buttonFor(value: CataclysmPriestProjection, type: CataclysmPriestCommand["type"], predicate?: (action: CataclysmPriestAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (caseId: CataclysmPriestCaseId) => (action: CataclysmPriestAction) => "caseId" in action.command && action.command.caseId === caseId;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectCataclysmPriest(s);
  return { value, onCommand, ...render(<CataclysmPriestPanel cataclysmPriest={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: CataclysmPriestCommand) => void) {
  return <CataclysmPriestPanel cataclysmPriest={projectCataclysmPriest(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Cataclysm Priest originals and three independent confirmations", () => {
  it("keeps the complete recipe unknown and forwards only the selected original supply task", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "灾难主祭配方与仪式边界" }).textContent).toContain("当前渠道只提供成品魔药");
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]); expect(value.bottles).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /直接晋升|调配魔药|远程海域/ })).toBeNull();
    const work = findAction(value, "POTION_WORK"); await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(work.command);
    expect(s.cataclysmPriest.bottles.every(bottle => bottle.labourSteps === 0 && bottle.status === "SUPPLIER")).toBe(true);
  });

  it("shows the paid original site, kit and current adults while next-week entry is still unavailable", () => {
    const s = booked(), { value } = panel(s), facts = screen.getByRole("region", { name: "灾难主祭当前仪式" });
    for (const text of ["阿尔玛·伦恩", "61岁", "CP4-ALMA", "CP4-ORRIN", "CP4-MABEL", "CP4-SITE-1", "CP4-KIT-1", "CP4-GAUGE-1", "CP4-WALKWAY-1", "420便士", "原供应方保管"])
      expect(facts.textContent).toContain(text);
    expect(value.ritual.windowOpen).toBe(false); expect(buttonFor(value, "BEGIN_RITUAL").disabled).toBe(true);
    expect(buttonFor(value, "LEAVE_RITUAL").disabled).toBe(false); expect(s.cataclysmPriest.ritual.visits[0]!.site.earthquakeOccurred).toBe(false);
  });

  it("reviews preparation independently and restores focus without moving people or triggering the quake", async () => {
    const s = cleared(), before = structuredClone(s.cataclysmPriest.ritual), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "核对撤离与现场准备" }));
    expect(screen.getByRole("region", { name: "灾难主祭准备的独立确认" }).textContent).toContain("此次确认不会引发地震，也不会服药");
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "CHECK_PREPARATION"));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.cataclysmPriest.ritual).toEqual(before);
    await userEvent.click(buttonFor(value, "CHECK_PREPARATION")); await userEvent.click(screen.getByRole("button", { name: "确认核对本次准备" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CHECK_PREPARATION", confirmed: true });
    expect(s.cataclysmPriest.ritual).toEqual(before);
  });

  it("separately confirms the quake with visible original damage, hazards and retreat costs", async () => {
    const s = checked(), { value, onCommand } = panel(s); await userEvent.click(buttonFor(value, "START_QUAKE"));
    const risk = screen.getByRole("region", { name: "本次灾害与退路的代价" });
    for (const text of ["原木质潮标", "下层步道", "两段各60秒", "可能受伤或死亡", "不能撤回灾害"]) expect(risk.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: "暂不继续，返回现场" }));
    expect(onCommand).not.toHaveBeenCalled(); expect(s.cataclysmPriest.ritual.visits[0]!.phase).toBe("CHECKED");
    await userEvent.click(buttonFor(value, "START_QUAKE")); const confirm = screen.getByRole("button", { name: "确认引发本次地震与海啸" });
    fireEvent.click(confirm); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "START_QUAKE", confirmed: true });
    expect(s.cataclysmPriest.ritual.visits[0]!.site.earthquakeOccurred).toBe(false);
  });

  it("rechecks the current adult's consent and discards review when the original visit changes", async () => {
    const s = cleared(), { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CHECK_PREPARATION"));
    s.cataclysmPriest.ritual.expert.willing = false; rerender(updatePanel(s, onCommand));
    expect(screen.getByRole("region", { name: "当前主持者与助手的位置" }).textContent).toContain("不愿参与本次安排");
    const confirm = screen.getByRole("button", { name: "确认核对本次准备" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    apply(s, { type: "LEAVE_RITUAL" }); s.cataclysmPriest.ritual.expert.willing = true; s.week++; apply(s, { type: "BOOK_RITUAL" });
    rerender(updatePanel(s, onCommand)); expect(screen.queryByRole("region", { name: "灾难主祭准备的独立确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "灾难主祭当前仪式" }).textContent).toContain("CP4-KIT-2");
    expect(s.cataclysmPriest.ritual.visits[0]!.kit.status).toBe("SEALED");
  });

  it("reviews the exact bottle and current resources, then guards double submission and failed saving", async () => {
    const s = surge(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s); await userEvent.click(buttonFor(value, "CONSUME"));
    const review = screen.getByRole("region", { name: "这瓶灾难主祭魔药的服用确认" });
    for (const text of ["cataclysm-priest-potion-1", "CP4-KIT-1", "服药成功仅是暂定结果", "下一真实周"]) expect(review.textContent).toContain(text);
    expect(screen.getByRole("region", { name: "灾难主祭服用风险与四档结果" }).textContent).toContain(CATACLYSM_PRIEST_CONSUMPTION_RISK);
    expect(screen.getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    rerender(<CataclysmPriestPanel cataclysmPriest={value} resources={resources(s)} busy={false} error={{ message: "原操作保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复引发灾害、服药或推进波浪");
    expect((screen.getByRole("button", { name: "暂不服用，返回现场" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶灾难主祭魔药的服用确认" })).toBeTruthy();
    rerender(updatePanel(s, onCommand)); fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "cataclysm-priest-potion-1", confirmed: true });
    expect(s.cataclysmPriest.bottles[0]!.status).toBe("PLAYER"); expect(s.cataclysmPriest.ritual.visits[0]!.elapsedSeconds).toBe(0);
  });

  it("shows a provisional successful drink and both actual hazard phases before awarding S4", async () => {
    const s = drank(); s.actionsRemaining = 0; const { value, onCommand, rerender } = panel(s);
    const stages = () => screen.getByRole("region", { name: "服药后的两段存活考验" });
    expect(s.progression.sequence).toBe(5); expect(value.promoted).toBe(false); expect(stages().textContent).toContain("第一波尚待经历");
    expect(stages().textContent).toContain("回卷浪尚待经历"); expect(buttonFor(value, "HOLD_POSITION").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "HOLD_POSITION")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "HOLD_POSITION" });
    expect(s.cataclysmPriest.ritual.visits[0]!.elapsedSeconds).toBe(0);
    apply(s, { type: "HOLD_POSITION" }, 100); rerender(updatePanel(s, onCommand));
    expect(s.progression.sequence).toBe(5); expect(stages().textContent).toContain("第一波已实际经过"); expect(stages().textContent).toContain("回卷浪尚待经历");
    expect(screen.getByRole("region", { name: "CP4-RITUAL-1实际浪涌伤势" }).textContent).toContain("实际伤害 25");
    expect(screen.getByRole("region", { name: "CP4-RITUAL-1原设施与海水" }).textContent).toContain("已冲毁");
    apply(s, { type: "HOLD_POSITION" }); rerender(updatePanel(s, onCommand));
    expect(s.progression.sequence).toBe(4); expect(stages().textContent).toContain("两段灾害已经实际结束");
    expect(s.cataclysmPriest.ritual.playerLocation).toBe("PLATFORM"); expect(buttonFor(projectCataclysmPriest(s), "END_RITUAL").disabled).toBe(false);
    expect(screen.getByRole("region", { name: "灾难主祭当前仪式" }).textContent).toContain("晋升已经完成");
  });

  it("keeps a successful raw roll, spent original and damage after retreat, then shows a newly paid site", () => {
    const s = drank(); apply(s, { type: "LEAVE_RITUAL" }); const oldVisit = structuredClone(s.cataclysmPriest.ritual.visits[0]);
    const { onCommand, rerender } = panel(s), facts = () => screen.getByRole("region", { name: "灾难主祭当前仪式" });
    expect(s.progression.sequence).toBe(5); expect(s.progression.acting).toBe(100); expect(facts().textContent).toContain("原成本与损坏保留");
    expect(facts().textContent).toContain("已经耗用，不能复用"); expect(facts().textContent).toContain("已冲毁");
    apply(s, { type: "BUY_POTION", bottleId: "cataclysm-priest-potion-2" }); s.week++; apply(s, { type: "BOOK_RITUAL" }); rerender(updatePanel(s, onCommand));
    for (const text of ["CP4-SITE-1", "CP4-SITE-2", "CP4-KIT-1", "CP4-KIT-2", "原供应方保管"]) expect(facts().textContent).toContain(text);
    expect(s.cataclysmPriest.ritual.visits[0]).toEqual(oldVisit); expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows a real hazard death at the original platform as read-only, with no escape teleport", () => {
    const s = drank(); s.health = 20; apply(s, { type: "HOLD_POSITION" }, 100);
    render(<CataclysmPriestPanel cataclysmPriest={projectCataclysmPriest(s)} resources={resources(s)} busy={false} readOnly onCommand={vi.fn()} />);
    expect(s.status).toBe("DEAD"); expect(s.cataclysmPriest.ritual.playerLocation).toBe("PLATFORM");
    expect(screen.getByRole("region", { name: "灾难主祭当前仪式" }).textContent).toContain("本人在原台面死亡");
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("blocks commands during %s without inventing a retry", condition => {
    const s = cleared(), value = projectCataclysmPriest(s), onCommand = vi.fn();
    render(<CataclysmPriestPanel cataclysmPriest={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"} readOnly={condition === "readOnly"}
      error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CHECK_PREPARATION")); expect(onCommand).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });
});

describe("Cataclysm Priest current originals, ally movement and actual cleanup", () => {
  it("shows the real ally, paid effect and original float, then keeps stop and return as different zero-action commands", async () => {
    const s = promoted(); beginCase(s, "sea-eddy"); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand, rerender } = panel(s), original = () => screen.getByRole("region", { name: "灾难主祭当前原物与真实海水" });
    expect(screen.getByRole("region", { name: "当前同伴与有限效果" }).textContent).toContain("西尔瓦·霍尔特 · 38岁 · CP4-SYLVA");
    expect(screen.getByRole("region", { name: "当前同伴与有限效果" }).textContent).toContain("原高脊");
    for (const text of ["CP4-PRACTICE-BAY", "SEAWATER", "CP4-FLOAT", "MARK", "CP4-ROPE", "耐久90"]) expect(original().textContent).toContain(text);
    expect(buttonFor(value, "CLOSE", forCase("sea-eddy")).disabled).toBe(true); expect(buttonFor(value, "RETURN_FLOAT").disabled).toBe(true);
    await userEvent.click(buttonFor(value, "STOP_EFFECT", forCase("sea-eddy")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP_EFFECT", caseId: "sea-eddy" }); expect(s.cataclysmPriest.life.cases["sea-eddy"].effectActive).toBe(true);
    apply(s, { type: "STOP_EFFECT", caseId: "sea-eddy" }); rerender(updatePanel(s, onCommand));
    expect(original().textContent).toContain("MARK"); expect(buttonFor(projectCataclysmPriest(s), "RETURN_FLOAT").disabled).toBe(false);
    apply(s, { type: "RETURN_FLOAT" }); apply(s, { type: "RETURN_ALLY" }); rerender(updatePanel(s, onCommand));
    expect(original().textContent).toContain("BANK"); expect(original().textContent).toContain("耐久90");
    expect(buttonFor(projectCataclysmPriest(s), "CLOSE", forCase("sea-eddy")).disabled).toBe(false);
    expect(buttonFor(projectCataclysmPriest(s), "REPORT", forCase("sea-eddy")).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择当前生活实践" }) as HTMLSelectElement).disabled).toBe(true);
  });

  it("keeps current consent meaningful and never moves the ally just by selecting a case", async () => {
    const s = promoted(); apply(s, { type: "OBSERVE", caseId: "sea-eddy" }); apply(s, { type: "PREPARE", caseId: "sea-eddy", method: "ABILITY" });
    s.cataclysmPriest.life.ally.willing = false; const { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "当前同伴与有限效果" }).textContent).toContain("当前不愿参与");
    expect(buttonFor(value, "MOVE_ALLY").disabled).toBe(true); expect(buttonFor(value, "PERFORM", forCase("sea-eddy")).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "MOVE_ALLY")); expect(onCommand).not.toHaveBeenCalled(); expect(s.cataclysmPriest.life.ally.location).toBe("LOW");
  });

  it("shows actual retained water and stone marks in later cases without erasing them on stop", () => {
    const s = promoted(), beforeOrdinary = structuredClone(s.progression.mastery);
    beginCase(s, "sea-eddy", "ORDINARY"); finishCase(s, "sea-eddy"); expect(s.progression.mastery).toEqual(beforeOrdinary); beginCase(s, "wind-screen");
    const { onCommand, rerender } = panel(s), originals = () => screen.getByRole("region", { name: "灾难主祭当前原物与真实海水" });
    expect(originals().textContent).toContain("CP4-TRAY · 实际接水1G份"); expect(originals().textContent).toContain("保留湿痕1");
    finishCase(s, "wind-screen"); beginCase(s, "lightning-stone"); rerender(updatePanel(s, onCommand));
    expect(originals().textContent).toContain("CP4-STONE"); expect(originals().textContent).toContain("新雷击焦痕1");
    apply(s, { type: "STOP_EFFECT", caseId: "lightning-stone" }); rerender(updatePanel(s, onCommand));
    expect(originals().textContent).toContain("新雷击焦痕1"); expect(originals().textContent).toContain("实际接水1G份");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows the actual ordinary opponent and dry exit instead of a guaranteed victory", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const before = structuredClone(s.cataclysmPriest.encounter), { value, onCommand } = panel(s), encounter = screen.getByRole("region", { name: "灾难主祭可选原石岸冲突" });
    for (const text of ["本尼迪克特·维尔 · 48岁 · CP4-BENEDICT", "CP4-BENEDICT-CLUB", "真实海水", "不追击"]) expect(encounter.textContent).toContain(text);
    expect(buttonFor(value, "ENCOUNTER_FIGHT").disabled).toBe(true); expect(buttonFor(value, "LEAVE_ENCOUNTER").disabled).toBe(false);
    await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" }); expect(s.cataclysmPriest.encounter).toEqual(before);
  });

  it("preserves all original S5 sources, song and beast journeys as noninteractive history", () => {
    const s = promoted(), old = projectSliceState(s).oceanSinger; render(<CataclysmPriestOceanSingerHistory oceanSinger={old} />);
    const history = screen.getByRole("region", { name: "海洋歌者时期的经历" });
    expect(history.textContent).toContain("晋升时海洋歌者扮演进度 100"); expect(s.progression.acting).toBe(0);
    expect(history.textContent).toContain("实际赴仪式 2 次"); expect(history.textContent).toContain(old.ritual.summary);
    for (const bottle of old.bottles) { expect(history.textContent).toContain(bottle.id); expect(history.textContent).toContain(bottle.source); expect(history.textContent).toContain(bottle.status); }
    for (const entry of old.cases) { for (const fact of entry.observations) expect(history.textContent).toContain(fact); if (entry.result) expect(history.textContent).toContain(entry.result); }
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.oceanSinger).toEqual(oldRun.oceanSinger);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return { getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state,
    runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})) };
}
/** These navigation states are exact migrated natural captures. Do not rewrite the name,
 * resources, sequence, active event or inherited combat to make navigation pass. */
async function enter(state: SliceProjection) {
  const api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return api;
}
function natural(key: "promoted" | "practiced") {
  const capture = JSON.parse(readFileSync("tests/fixtures/cataclysm-priest-v01240/natural.json", "utf8"));
  return projectSliceState(migrateSliceState(structuredClone(capture[key])));
}
describe("Cataclysm Priest actual SliceApp navigation", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
  it("opens S5 advancement from the unmodified original Ocean Singer capture", async () => {
    const s = migrateSliceState(structuredClone(oldRun)), before = structuredClone(s), state = projectSliceState(s), api = await enter(state);
    await userEvent.click(screen.getByRole("button", { name: "查看灾难主祭晋升" }));
    expect(screen.getByRole("region", { name: "灾难主祭成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "灾难主祭晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(api.submitIntent).not.toHaveBeenCalled(); expect(s).toEqual(before); expect(s.oceanSinger).toEqual(oldRun.oceanSinger);
  });
  it("opens current S4, folds original S5 history and returns without replaying old actions", async () => {
    const state = natural("practiced"), api = await enter(state); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "灾难主祭成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "海洋歌者经历" }));
    const history = within(screen.getByRole("region", { name: "海洋歌者时期的经历" }));
    await userEvent.click(history.getByText("海洋歌者原瓶 · 来源与去向"));
    expect(history.getByText(`原瓶：${state.oceanSinger.bottles[0]!.id}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "灾难主祭成长" })); expect(screen.getByRole("region", { name: "灾难主祭成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("keeps the newly promoted original platform locked until actual departure", async () => {
    const state = natural("promoted"), api = await enter(state);
    expect(state.cataclysmPriest.ritual.playerLocation).toBe("PLATFORM");
    expect(await screen.findByRole("region", { name: "灾难主祭当前仪式" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "海洋歌者经历" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(buttonFor(state.cataclysmPriest, "END_RITUAL"));
    expect(api.submitIntent).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: "CATACLYSM_PRIEST", command: { type: "END_RITUAL" } } }));
    expect(state.cataclysmPriest.ritual.playerLocation).toBe("PLATFORM");
  });
  it("allows normal rest after the natural original effects and objects are all closed", async () => {
    const state = natural("practiced"), api = await enter(state); expect(state.cataclysmPriest.insideCase).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ })); await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    const rest = screen.getByRole("button", { name: "休养，1行动，恢复身心" }) as HTMLButtonElement; expect(rest.disabled).toBe(false);
    await userEvent.click(rest); expect(api.submitIntent).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: "ACTION", action: "REST" } }));
  });
});
