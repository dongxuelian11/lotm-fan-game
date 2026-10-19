/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDemonHunterCommand, projectDemonHunter } from "../../src/domain/demon-hunter/index";
import { DEMON_HUNTER_CONSUMPTION_RISK } from "../../src/domain/demon-hunter/content";
import type { DemonHunterAction, DemonHunterCommand, DemonHunterProjection } from "../../src/domain/demon-hunter/types";
import { projectSliceState } from "../../src/domain/slice/index";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { DemonHunterPanel, DemonHunterGuardianHistory } from "../../src/renderer/DemonHunterPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";

const oldRun = JSON.parse(readFileSync("tests/fixtures/guardian-v01070/natural.json", "utf8")).final;
type CaseId = "sealed-sample" | "tailored-coating" | "concealed-approach";
/** Directed UI setup only: all original Guardian people, injuries, objects and outcomes stay unchanged. */
function guardian(): SliceState {
  const s = migrateSliceState(structuredClone(oldRun));
  s.week = Math.max(s.week, s.guardian.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28; s.character.coreStats.perception = 28;
  return s;
}
function apply(s: SliceState, command: DemonHunterCommand, roll = 1) {
  const context: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  applyDemonHunterCommand(s, command, context);
}
function taught() { const s = guardian(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function purchased() { const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "demon-hunter-potion-1" }); return s; }
function promoted() { const s = purchased(); apply(s, { type: "CONSUME", bottleId: "demon-hunter-potion-1", confirmed: true }); return s; }
function prepare(s: SliceState, caseId: CaseId, method: "ABILITY" | "ORDINARY" = "ABILITY") {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "PREPARE", caseId, method });
}
function finish(s: SliceState, caseId: CaseId, method: "ABILITY" | "ORDINARY" = "ABILITY") {
  prepare(s, caseId, method); apply(s, { type: "PERFORM", caseId });
  if (caseId === "tailored-coating" && method === "ABILITY") {
    apply(s, { type: "TEST_PROBE", caseId }); apply(s, { type: "WITHDRAW_PROBE", caseId });
  }
  if (caseId === "concealed-approach" && method === "ABILITY") apply(s, { type: "RETURN_ROUTE", caseId });
  apply(s, { type: "CLOSE", caseId }); apply(s, { type: "REPORT", caseId });
}
function withSampleReport() { const s = promoted(); finish(s, "sealed-sample"); return s; }
function withCoatingReport() { const s = withSampleReport(); finish(s, "tailored-coating"); return s; }
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality,
    maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: DemonHunterProjection, type: DemonHunterCommand["type"], predicate: (action: DemonHunterAction) => boolean = () => true) {
  const action = value.actions.find((entry) => entry.command.type === type && predicate(entry));
  if (!action) throw new Error(`Missing actual projected action ${type}`); return action;
}
function buttonFor(value: DemonHunterProjection, type: DemonHunterCommand["type"], predicate?: (action: DemonHunterAction) => boolean) {
  const action = findAction(value, type, predicate);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
const forCase = (id: CaseId) => (action: DemonHunterAction) => "caseId" in action.command && action.command.caseId === id;
const forBottle = (id: string) => (action: DemonHunterAction) => "bottleId" in action.command && action.command.bottleId === id;
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectDemonHunter(s);
  return { value, onCommand, ...render(<DemonHunterPanel demonHunter={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
function updatePanel(s: SliceState, onCommand: (command: DemonHunterCommand) => void) {
  return <DemonHunterPanel demonHunter={projectDemonHunter(s)} resources={resources(s)} busy={false} onCommand={onCommand} />;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Demon Hunter original bottles and committed confirmation", () => {
  it("keeps the unknown recipe empty and exposes real per-bottle price, work and provenance", async () => {
    const s = taught(), before = structuredClone(s.demonHunter), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "猎魔者配方与成品边界" });
    for (const text of ["完整配方", "仍未知", "540", "6800", "五次", "5300", "1500", "继续守护者生活"]) expect(boundary.textContent).toContain(text);
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    const first = findAction(value, "POTION_WORK", forBottle("demon-hunter-potion-1"));
    await userEvent.click(buttonFor(value, "POTION_WORK", forBottle("demon-hunter-potion-1")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(first.command); expect(onCommand.mock.calls[0]![0]).toBe(first.command);
    expect(s.demonHunter).toEqual(before);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立猎魔者原瓶" }), "demon-hunter-potion-2");
    expect(screen.queryByRole("button", { name: name => name.startsWith(first.label) })).toBeNull();
    expect(buttonFor(value, "BUY_POTION", forBottle("demon-hunter-potion-2"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: /调配|直接晋升|跳过/ })).toBeNull();
  });

  it("shows the selected original, four outcomes and current resources before one zero-action drink", async () => {
    const s = purchased(); s.actionsRemaining = 0;
    const before = structuredClone(s.demonHunter), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: value.bottles[0]!.title }));
    const review = screen.getByRole("region", { name: "这瓶猎魔者魔药的服用确认" });
    expect(within(review).getByRole("region", { name: "猎魔者服用风险与四档结果" }).textContent).toContain(DEMON_HUNTER_CONSUMPTION_RISK);
    expect(within(review).getByRole("region", { name: "服药前当前资源" }).textContent).toContain(resources(s).cash);
    for (const text of ["demon-hunter-potion-1", "0行动", "不覆盖真实战斗死亡", "不补满灵性", "最低保留1"]) expect(review.textContent).toContain(text);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "CONSUME").command); expect(s.demonHunter).toEqual(before);
  });

  it("cancels via Escape and returns focus without touching the original bottle", async () => {
    const s = purchased(), before = structuredClone(s.demonHunter), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME")); await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(buttonFor(value, "CONSUME")); expect(onCommand).not.toHaveBeenCalled(); expect(s.demonHunter).toEqual(before);
  });

  it("keeps the exact submitted operation through save failure and never resubmits it locally", async () => {
    const s = purchased(), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME")); fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    rerender(<DemonHunterPanel demonHunter={value} resources={resources(s)} busy={false} error={{ message: "本次保存失败", retryable: true }} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要重复服药");
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "这瓶猎魔者魔药的服用确认" })).toBeTruthy();
    rerender(updatePanel(s, onCommand)); fireEvent.click(screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` }));
    expect(onCommand).toHaveBeenCalledTimes(1); expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
  });

  it.each([1, 100])("dismisses review only after the actual committed outcome, roll %s", async roll => {
    const s = purchased(), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "CONSUME")); apply(s, findAction(value, "CONSUME").command, roll); rerender(updatePanel(s, onCommand));
    expect(screen.queryByRole("region", { name: "这瓶猎魔者魔药的服用确认" })).toBeNull();
    expect(s.demonHunter.bottles[0]!.status).toBe("CONSUMED"); expect(onCommand).not.toHaveBeenCalled();
    expect(s.progression.sequence).toBe(roll === 100 ? 5 : 4);
  });

  it("keeps exhausted originals and requires a real next-week delivery before new bottle IDs appear", async () => {
    const s = taught();
    for (const bottleId of ["demon-hunter-potion-1", "demon-hunter-potion-2", "demon-hunter-potion-3"]) {
      s.health = 100; s.mind = 100;
      apply(s, { type: "BUY_POTION", bottleId }); apply(s, { type: "CONSUME", bottleId, confirmed: true }, 100);
    }
    const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "REQUEST_SUPPLY")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REQUEST_SUPPLY" });
    apply(s, { type: "REQUEST_SUPPLY" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectDemonHunter(s), "RECEIVE_SUPPLY").disabled).toBe(true);
    expect(s.demonHunter.bottles).toHaveLength(3);
    s.week += 1; rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectDemonHunter(s), "RECEIVE_SUPPLY").disabled).toBe(false);
    apply(s, { type: "RECEIVE_SUPPLY" }); rerender(updatePanel(s, onCommand));
    expect(s.demonHunter.bottles).toHaveLength(6);
    expect(s.demonHunter.bottles.slice(0, 3).every(bottle => bottle.status === "CONSUMED")).toBe(true);
    expect(screen.getByText("原瓶：demon-hunter-potion-4")).toBeTruthy();
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("locks all original intentions while %s", condition => {
    const s = purchased(), value = projectDemonHunter(s), onCommand = vi.fn();
    render(<DemonHunterPanel demonHunter={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const select of screen.getAllByRole("combobox")) expect((select as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "CONSUME")); expect(onCommand).not.toHaveBeenCalled();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });
});

describe("Demon Hunter distinct observations, actual preparation and physical cleanup", () => {
  it("shows distinct original stories while folding the full rule and source explanation", async () => {
    const s = promoted(), { value } = panel(s);
    expect(value.cases).toHaveLength(3); expect(new Set(value.cases.map(entry => entry.story)).size).toBe(3);
    for (const entry of value.cases) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前猎魔者生活实践" }), entry.id);
      expect(screen.getByRole("region", { name: entry.title }).textContent).toContain(entry.story);
    }
    const source = screen.getByText("能力与使用范围").closest("details");
    const observations = screen.getByText("已观察的事实与本次方法边界").closest("details");
    expect(source?.open).toBe(false); expect(observations?.open).toBe(false);
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain("DH4-PROBE-1");
  });

  it("advances after a committed report while allowing an explicit look back at the original case", async () => {
    const s = promoted(); prepare(s, "sealed-sample"); apply(s, { type: "PERFORM", caseId: "sealed-sample" }); apply(s, { type: "CLOSE", caseId: "sealed-sample" });
    const { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "REPORT", forCase("sealed-sample")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "REPORT", caseId: "sealed-sample" });
    expect(s.demonHunter.life.cases["sealed-sample"].status).toBe("EXAMINED");
    apply(s, { type: "REPORT", caseId: "sealed-sample" }); rerender(updatePanel(s, onCommand));
    const picker = screen.getByRole("combobox", { name: "选择当前猎魔者生活实践" }) as HTMLSelectElement;
    expect(picker.value).toBe("tailored-coating");
    await userEvent.selectOptions(picker, "sealed-sample"); expect(picker.value).toBe("sealed-sample");
    expect(screen.getByRole("region", { name: "猎魔者实际实践结果" }).textContent).toContain("本次有限任务已完成");
  });

  it("does not turn preparation or a renderer click into a diagnosis, and keeps an ordinary method", async () => {
    const s = promoted(); apply(s, { type: "OBSERVE", caseId: "sealed-sample" });
    const before = structuredClone(s.demonHunter.life), { value, onCommand } = panel(s);
    const ordinary = findAction(value, "PREPARE", action => action.command.type === "PREPARE" && action.command.method === "ORDINARY" && action.command.caseId === "sealed-sample");
    await userEvent.click(buttonFor(value, "PREPARE", action => action.id === ordinary.id));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command); expect(onCommand.mock.calls[0]![0]).toBe(ordinary.command);
    expect(s.demonHunter.life).toEqual(before);
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain(value.practice!.samples);
  });

  it("leaves a failed diagnosis visible and allows actual zero-resource closure", async () => {
    const s = promoted(); prepare(s, "sealed-sample"); apply(s, { type: "PERFORM", caseId: "sealed-sample" }, 100);
    s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0;
    const before = structuredClone(s.demonHunter.life), { value, onCommand } = panel(s);
    expect(screen.getByRole("region", { name: "猎魔者实际实践结果" }).textContent).toContain(value.cases[0]!.result);
    expect(buttonFor(value, "CLOSE", forCase("sealed-sample")).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "CLOSE", forCase("sealed-sample")));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "sealed-sample" }); expect(s.demonHunter.life).toEqual(before);
  });

  it("uses the real coating test, then requires the same inserted probe back before closing", async () => {
    const s = withSampleReport(); prepare(s, "tailored-coating"); apply(s, { type: "PERFORM", caseId: "tailored-coating" });
    const { value, onCommand, rerender } = panel(s);
    expect((screen.getByRole("combobox", { name: "选择当前猎魔者生活实践" }) as HTMLSelectElement).value).toBe("tailored-coating");
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain(value.practice!.preparation);
    const before = structuredClone(s.demonHunter.life);
    await userEvent.click(buttonFor(value, "TEST_PROBE")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "TEST_PROBE", caseId: "tailored-coating" });
    expect(s.demonHunter.life).toEqual(before);
    apply(s, { type: "TEST_PROBE", caseId: "tailored-coating" }); s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0; rerender(updatePanel(s, onCommand));
    const inserted = projectDemonHunter(s);
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain(inserted.practice!.probe);
    expect(buttonFor(inserted, "CLOSE", forCase("tailored-coating")).disabled).toBe(true);
    expect(buttonFor(inserted, "WITHDRAW_PROBE").disabled).toBe(false);
    await userEvent.click(buttonFor(inserted, "WITHDRAW_PROBE")); expect(onCommand).toHaveBeenLastCalledWith({ type: "WITHDRAW_PROBE", caseId: "tailored-coating" });
    apply(s, { type: "WITHDRAW_PROBE", caseId: "tailored-coating" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectDemonHunter(s), "CLOSE", forCase("tailored-coating")).disabled).toBe(false);
  });

  it("shows paid failed materials and no successful coating without inventing a replacement", () => {
    const s = withSampleReport(); prepare(s, "tailored-coating"); apply(s, { type: "PERFORM", caseId: "tailored-coating" }, 100);
    const { value } = panel(s);
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain(value.practice!.preparation);
    expect(screen.getByRole("region", { name: "猎魔者实际实践结果" }).textContent).toContain(value.cases.find(entry => entry.id === "tailored-coating")!.result);
    expect(value.actions.some(action => action.command.type === "TEST_PROBE")).toBe(false);
    expect(buttonFor(value, "CLOSE", forCase("tailored-coating")).disabled).toBe(false);
  });

  it("keeps the real two-metre endpoint, sound reaction and zero-resource walk back separate", async () => {
    const s = withCoatingReport(); prepare(s, "concealed-approach"); apply(s, { type: "PERFORM", caseId: "concealed-approach" });
    const { value, onCommand, rerender } = panel(s);
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain(value.practice!.route);
    await userEvent.click(screen.getByText("可选：制造响声验证（会中断本次任务）"));
    await userEvent.click(buttonFor(value, "RUSTLE")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RUSTLE", caseId: "concealed-approach" });
    apply(s, { type: "RUSTLE", caseId: "concealed-approach" }); s.actionsRemaining = 0; s.spirituality = 0; s.cash = 0; rerender(updatePanel(s, onCommand));
    const noisy = projectDemonHunter(s), before = structuredClone(s.demonHunter.life);
    expect(screen.getByRole("region", { name: "猎魔者实际标本材料与位置" }).textContent).toContain(noisy.practice!.moth);
    expect(buttonFor(noisy, "CLOSE", forCase("concealed-approach")).disabled).toBe(true);
    expect(buttonFor(noisy, "RETURN_ROUTE").disabled).toBe(false);
    await userEvent.click(buttonFor(noisy, "RETURN_ROUTE")); expect(onCommand).toHaveBeenLastCalledWith({ type: "RETURN_ROUTE", caseId: "concealed-approach" }); expect(s.demonHunter.life).toEqual(before);
    apply(s, { type: "RETURN_ROUTE", caseId: "concealed-approach" }); rerender(updatePanel(s, onCommand));
    expect(buttonFor(projectDemonHunter(s), "CLOSE", forCase("concealed-approach")).disabled).toBe(false);
  });

  it("completes all three ordinary lessons without claiming ability mastery or magic resources", () => {
    const s = promoted(), spirituality = s.spirituality;
    for (const id of ["sealed-sample", "tailored-coating", "concealed-approach"] as const) finish(s, id, "ORDINARY");
    apply(s, { type: "REFLECT" }); const { value } = panel(s);
    expect(value.acting).toBe(100); expect(s.spirituality).toBe(spirituality);
    for (const ability of value.abilities) expect(ability.mastery).toBe(0);
    expect(value.encounter?.coatingsRemaining).toBe(0);
    expect(screen.getByRole("region", { name: "猎魔者实际战斗涂层" }).textContent).toContain("不是免费库存");
  });
});

describe("Demon Hunter finite original opponent and historical Guardian", () => {
  it("shows original enemy H/M/SP, the real exit and empty coating stock", () => {
    const s = withSampleReport(), { value } = panel(s);
    const enemy = screen.getByRole("region", { name: "猎魔者原敌人与有限资源" });
    for (const text of ["DH4-CINDER-GUARD", "100 / 100", "36 / 36", "无追逐"]) expect(enemy.textContent).toContain(text);
    expect(value.encounter?.coatings).toEqual([]);
    expect(screen.getByRole("region", { name: "猎魔者实际战斗涂层" }).textContent).toContain("尚未购入原涂层");
    expect(buttonFor(value, "ENCOUNTER_TALK").disabled).toBe(false);
  });

  it("projects the two bought original charges and forwards preparation without local restocking", async () => {
    const s = withCoatingReport(), before = structuredClone(s.demonHunter.encounter), { value, onCommand, rerender } = panel(s);
    await userEvent.click(buttonFor(value, "PREPARE_HUNT")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE_HUNT" }); expect(s.demonHunter.encounter).toEqual(before);
    apply(s, { type: "PREPARE_HUNT" }); rerender(updatePanel(s, onCommand));
    const coatings = screen.getByRole("region", { name: "猎魔者实际战斗涂层" });
    for (const text of ["DH4-COATING-1", "DH4-COATING-2", "剩余 2 份", "120", "不逐轮补货"]) expect(coatings.textContent).toContain(text);
    expect(buttonFor(projectDemonHunter(s), "PREPARE_HUNT").disabled).toBe(true);
  });

  it("reviews combat risk separately and lets ordinary withdrawal send only its exact projected intention", async () => {
    const s = withSampleReport(), before = structuredClone(s.demonHunter.encounter), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "ENCOUNTER_FIGHT"));
    const review = screen.getByRole("region", { name: "猎魔者真实迎战确认" });
    for (const text of ["重伤或死亡", "有限灵性", "库存为空", "不让身体隐形", "服药照护不保护实战"]) expect(review.textContent).toContain(text);
    await userEvent.click(screen.getByRole("button", { name: "暂不迎战" })); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(buttonFor(value, "ENCOUNTER_TALK")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_TALK" });
    expect(onCommand.mock.calls[0]![0]).toBe(findAction(value, "ENCOUNTER_TALK").command); expect(s.demonHunter.encounter).toEqual(before); expect(s.combat).toBeNull();
  });

  it("sends one original fight command after confirmation without starting a local battle", async () => {
    const s = withSampleReport(), { value, onCommand } = panel(s);
    await userEvent.click(buttonFor(value, "ENCOUNTER_FIGHT")); const confirm = screen.getByRole("button", { name: "确认风险，开始真实交战" });
    fireEvent.click(confirm); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "ENCOUNTER_FIGHT" }); expect(s.combat).toBeNull();
  });

  it("retains consumed and supplier originals after promotion without new medicine commands", () => {
    const s = promoted(), { value } = panel(s);
    expect(screen.getByText("猎魔者原瓶 · 来源与去向")).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`原瓶：${bottle.id}`)).toBeTruthy();
    expect(value.actions.some(action => ["CONSUME", "BUY_POTION", "POTION_WORK"].includes(action.command.type))).toBe(false);
    expect(s.demonHunter.bottles[0]!.status).toBe("CONSUMED"); expect(s.demonHunter.bottles[1]!.status).toBe("SUPPLIER");
  });

  it("uses final root projection to preserve old original people, injuries, guard, objects and bottles read-only", () => {
    const s = promoted(), before = structuredClone(s.guardian), value = projectSliceState(s).guardian;
    render(<DemonHunterGuardianHistory guardian={value} />);
    const history = screen.getByRole("region", { name: "守护者时期的经历" });
    expect(within(history).queryByRole("button")).toBeNull(); expect(within(history).queryByRole("combobox")).toBeNull();
    expect(value.cases).toHaveLength(3); expect(value.practice).not.toBeNull(); expect(value.acting).toBe(100);
    for (const entry of value.cases) expect(history.textContent).toContain(entry.title);
    for (const bottle of value.bottles) expect(history.textContent).toContain(bottle.id);
    for (const fact of [value.practice!.guard, value.practice!.target, value.practice!.companion]) expect(history.textContent).toContain(fact);
    expect(history.textContent).toContain("91/100"); expect(history.textContent).toContain("GD5-TARGET-1");
    expect(history.textContent).toContain("旧战斗装备不能转存"); expect(s.guardian).toEqual(before);
  });
});
