/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAlchemistCommand, createAlchemistState, projectAlchemist } from "../../src/domain/alchemist/index";
import { applyAlchemistActivity, validateAlchemistActivityCommand, type AlchemistCaseId } from "../../src/domain/alchemist/life";
import { ALCHEMIST_CONSUMPTION_RISK } from "../../src/domain/alchemist/content";
import type { AlchemistAction, AlchemistCommand, AlchemistProjection } from "../../src/domain/alchemist/types";
import { migrateSliceState } from "../../src/domain/slice/migration";
import { projectSliceState } from "../../src/domain/slice";
import type { SliceProjection, SliceState } from "../../src/domain/slice/types";
import type { SeerContext } from "../../src/domain/seer";
import { resolveNormalCheck } from "../../src/resolution/normal-check";
import { AlchemistAstronomerHistory, AlchemistPanel } from "../../src/renderer/AlchemistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

const oldAstronomerRun = JSON.parse(readFileSync("tests/fixtures/astronomer-v0980/natural.json", "utf8")).final;
/** UI fixtures retain the old natural history, then use explicit test clocks/resources and real commands.
 * These are component fixtures, not a claimed natural playthrough. Availability always comes from the projector. */
function astronomer(): SliceState {
  const s = migrateSliceState(structuredClone(oldAstronomerRun));
  s.alchemist = createAlchemistState(); s.week = Math.max(s.week, s.astronomer.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.cash = 100000; s.actionsRemaining = 1000; s.weeklyBudget = 1000;
  s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function apply(s: SliceState, command: AlchemistCommand, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn<SeerContext["check"]>((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  if (validateAlchemistActivityCommand(command)) applyAlchemistActivity(s, command, ctx);
  else applyAlchemistCommand(s, command, ctx);
}
function taught() { const s = astronomer(); apply(s, { type: "LEARN_GUIDANCE" }); return s; }
function garden(open = true, survey = true) {
  const s = taught(); apply(s, { type: "BUY_POTION", bottleId: "alchemist-potion-1" }); apply(s, { type: "PURCHASE_PLOT" });
  if (open) { s.week += 1; apply(s, { type: "OPEN_RITUAL" }); if (survey) apply(s, { type: "SURVEY" }); }
  return s;
}
function drained() { const s = garden(); apply(s, { type: "DRAIN_LIFE", confirmed: true }); return s; }
function promoted() { const s = drained(); apply(s, { type: "CONSUME", bottleId: "alchemist-potion-1", confirmed: true }); return s; }
function makeOriginal(s: SliceState, caseId: Exclude<AlchemistCaseId, "maker-account">, method: "ABILITY" | "ORDINARY" = "ABILITY", roll = 1) {
  apply(s, { type: "OBSERVE", caseId }); apply(s, { type: "BUY_KIT", caseId });
  apply(s, { type: "PREPARE", caseId, method }); apply(s, { type: "ASSEMBLE", caseId });
  apply(s, { type: "PERFORM", caseId }, roll);
}
function finishOriginal(s: SliceState, caseId: Exclude<AlchemistCaseId, "maker-account">) {
  apply(s, { type: caseId === "messenger-box" ? "MOVE_CREATION" : "GUARD_CREATION", caseId });
  const original = s.alchemist.life.creations.find(item => item.kind === (caseId === "messenger-box" ? "MESSENGER_BOX" : "GUARD_FRAME"))!;
  if (original.active) apply(s, { type: "STOP_CREATION", caseId });
  apply(s, { type: "RETURN_CREATION", caseId }); apply(s, { type: "CLOSE", caseId }); apply(s, { type: "REPORT", caseId });
}
function resources(s: SliceState): SeerResources {
  return { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: s.progression.sequence === 4 ? 120 : 100, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining };
}
function findAction(value: AlchemistProjection, type: AlchemistCommand["type"], caseId?: string): AlchemistAction {
  const found = value.actions.find(entry => entry.command.type === type && (caseId === undefined || "caseId" in entry.command && entry.command.caseId === caseId));
  if (!found) throw new Error(`Missing actual projected action ${type}:${caseId ?? ""}`);
  return found;
}
function buttonFor(value: AlchemistProjection, type: AlchemistCommand["type"], caseId?: string) {
  const a = findAction(value, type, caseId);
  return screen.getByRole("button", { name: (name) => name.startsWith(a.label) });
}
function panel(s: SliceState, onCommand = vi.fn()) {
  const value = projectAlchemist(s);
  return { value, onCommand, ...render(<AlchemistPanel alchemist={value} resources={resources(s)} busy={false} onCommand={onCommand} />) };
}
async function openDrain(value: AlchemistProjection) { await userEvent.click(buttonFor(value, "DRAIN_LIFE")); }
async function openBottle(value: AlchemistProjection) { await userEvent.click(buttonFor(value, "CONSUME")); }
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Alchemist actual public panel, original garden cost and finite self-made objects", () => {
  it("keeps the complete recipe unknown and forwards only real original-bottle supply actions", async () => {
    const s = taught(), { value, onCommand } = panel(s);
    const boundary = screen.getByRole("region", { name: "炼金术士配方与导师方案边界" });
    expect(boundary.textContent).toContain("当前渠道仅提供成品魔药");
    expect(boundary.textContent).toContain("晋升须满足本渠道的具体准备要求；本作导师方案");
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    expect(screen.queryByRole("button", { name: /调配|直接晋升|奥秘学者/ })).toBeNull();
    expect(value.bottles).toHaveLength(3);
    const work = findAction(value, "POTION_WORK"); await userEvent.click(buttonFor(value, "POTION_WORK"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(work.command);
    expect(screen.getByRole("region", { name: "炼金术士原瓶与独立来源" }).textContent).toContain("原供应方持有，未交付");
    expect(s.alchemist.bottles.every(bottle => bottle.labourSteps === 0 && bottle.status === "SUPPLIER")).toBe(true);
  });

  it("shows purchased original living plants, soil and water, with next-week entry and no premature drain", () => {
    const s = garden(false), { value } = panel(s);
    const current = screen.getByRole("region", { name: "炼金术士当前实际原地块" });
    expect(current.textContent).toContain("AL4-PLOT-1"); expect(current.textContent).toContain("活株 14 · 已死 0");
    expect(current.textContent).toContain("活力 100"); expect(current.textContent).toContain("现存 80 升");
    expect(current.textContent).toContain("AL4-PLOT-1-PLANT-14"); expect(current.textContent).toContain("持照隔离苗圃");
    expect((buttonFor(value, "OPEN_RITUAL") as HTMLButtonElement).disabled).toBe(true);
    expect(value.actions.some(action => action.command.type === "DRAIN_LIFE")).toBe(false);
    expect((buttonFor(value, "LEAVE_RITUAL") as HTMLButtonElement).disabled).toBe(false);
  });

  it("requires a fresh independent unchecked drain consent and restores keyboard focus when cancelled", async () => {
    const s = garden(), { value, onCommand } = panel(s); await openDrain(value);
    const review = screen.getByRole("region", { name: "原地块生命力抽取的独立确认" });
    expect(review.textContent).toContain("AL4-PLOT-1"); expect(review.textContent).toContain("活株 14 · 已死 0");
    expect(review.textContent).toContain("不会恢复这块土地"); expect(review.textContent).toContain("可以拒绝抽取");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "独立确认抽取本地块全部生命力" }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    const confirm = screen.getByRole("button", { name: "确认不可逆抽取本地块生命力" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "原地块生命力抽取的独立确认" })).toBeNull();
    expect(document.activeElement).toBe(buttonFor(value, "DRAIN_LIFE"));
    await openDrain(value); expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.click(screen.getByRole("button", { name: "确认不可逆抽取本地块生命力" }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "DRAIN_LIFE").command);
    expect(s.alchemist.ritual.plots[0]!.soil.vitality).toBe(100);
  });

  it("rechecks live eligibility while reviewing destruction and never reuses consent on a different original plot", async () => {
    const s = garden(), { value, onCommand, rerender } = panel(s); await openDrain(value); await userEvent.click(screen.getByRole("checkbox"));
    s.health = 0; const revoked = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={revoked} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认不可逆抽取本地块生命力" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "确认不可逆抽取本地块生命力" })); expect(onCommand).not.toHaveBeenCalled();
    s.health = 100; apply(s, { type: "LEAVE_RITUAL" }); apply(s, { type: "PURCHASE_PLOT" }); s.week += 1;
    apply(s, { type: "OPEN_RITUAL" }); apply(s, { type: "SURVEY" }); const next = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={next} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "原地块生命力抽取的独立确认" })).toBeNull();
    await openDrain(next); expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("region", { name: "确认前的当前原地块" }).textContent).toContain("AL4-PLOT-2");
  });

  it("locks one submitted drain across double clicks, save errors and Escape, then shows only committed damage", async () => {
    const s = garden(), { value, onCommand, rerender } = panel(s); await openDrain(value); await userEvent.click(screen.getByRole("checkbox"));
    const confirm = screen.getByRole("button", { name: "确认不可逆抽取本地块生命力" }); fireEvent.click(confirm); fireEvent.click(confirm);
    const error = { message: "本次保存失败，请重试原操作。", retryable: true };
    rerender(<AlchemistPanel alchemist={value} resources={resources(s)} busy={false} error={error} onCommand={onCommand} />);
    expect(screen.getByRole("status").textContent).toContain("不要再次抽取或服药");
    expect((screen.getByRole("button", { name: "暂不抽取，返回原地块" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("region", { name: "原地块生命力抽取的独立确认" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    expect(screen.getByRole("region", { name: "确认前的当前原地块" }).textContent).toContain("活株 14 · 已死 0");
    rerender(<AlchemistPanel alchemist={value} resources={resources(s)} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: "确认不可逆抽取本地块生命力" })); expect(onCommand).toHaveBeenCalledTimes(1);
    apply(s, findAction(value, "DRAIN_LIFE").command);
    rerender(<AlchemistPanel alchemist={projectAlchemist(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "原地块生命力抽取的独立确认" })).toBeNull();
    const current = screen.getByRole("region", { name: "炼金术士当前实际原地块" });
    expect(current.textContent).toContain("活株 0 · 已死 14"); expect(current.textContent).toContain("活力 0"); expect(current.textContent).toContain("现存 0 升");
  });

  it("separately reviews the exact original bottle, current destroyed land, chance and all four potion risks", async () => {
    const s = drained(), { value, onCommand } = panel(s); await openBottle(value);
    const review = screen.getByRole("region", { name: "这瓶炼金术士魔药的服用确认" });
    expect(review.textContent).toContain("alchemist-potion-1"); expect(review.textContent).toContain("AL4-PLOT-1");
    expect(review.textContent).toContain(`服用成功率 ${value.bottles[0]!.chance}%`);
    expect(review.textContent).toContain(ALCHEMIST_CONSUMPTION_RISK); expect(review.textContent).toContain("活株 0 · 已死 14");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}"); expect(document.activeElement).toBe(buttonFor(value, "CONSUME"));
    await openBottle(value); const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` });
    fireEvent.click(confirm); fireEvent.click(confirm); expect(onCommand).toHaveBeenCalledExactlyOnceWith(findAction(value, "CONSUME").command);
  });

  it("uses live potion conditions and preserves failed original land when a committed dose closes the window", async () => {
    const s = drained(), { value, onCommand, rerender } = panel(s); await openBottle(value);
    s.health = 20; s.character.coreStats.will = 1; const low = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={low} resources={resources(s)} busy={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: `确认服用「${value.bottles[0]!.title}」` });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(findAction(low, "CONSUME").reason!)).toBeTruthy();
    expect(screen.getByRole("region", { name: "这瓶炼金术士魔药的服用确认" }).textContent).toContain(`服用成功率 ${low.bottles[0]!.chance}%`);
    fireEvent.click(confirm); expect(onCommand).not.toHaveBeenCalled();
    s.health = 100; apply(s, { type: "CONSUME", bottleId: "alchemist-potion-1", confirmed: true }, 100);
    rerender(<AlchemistPanel alchemist={projectAlchemist(s)} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole("region", { name: "这瓶炼金术士魔药的服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "炼金术士原瓶与独立来源" }).textContent).toContain("原瓶已耗尽");
    await userEvent.click(screen.getByText("已结束的原地块与永久损毁记录"));
    const history = screen.getByRole("article", { name: "AL4-PLOT-1原地块历史" });
    expect(history.textContent).toContain("活株 0 · 已死 14"); expect(history.textContent).toContain("原土已沙化"); expect(history.textContent).toContain("原池已干涸");
    expect(within(history).queryByRole("button")).toBeNull();
  });

  it.each([false, true])("keeps the actual zero-action exit usable with no remaining resources, drained=%s", async (afterDrain) => {
    const s = afterDrain ? drained() : garden(); s.actionsRemaining = 0; s.spirituality = 0; s.health = 1; s.mind = 1;
    const { value, onCommand } = panel(s); const leave = buttonFor(value, "LEAVE_RITUAL");
    expect((leave as HTMLButtonElement).disabled).toBe(false); await userEvent.click(leave);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_RITUAL" });
    expect(s.alchemist.ritual.playerLocation).toBe("PLOT");
    expect(screen.getByRole("region", { name: "炼金术士当前实际原地块" }).textContent).toContain(afterDrain ? "活株 0 · 已死 14" : "活株 14 · 已死 0");
  });

  it("shows an independently bought second living plot beside the unchanged dead first plot", async () => {
    const s = drained(); apply(s, { type: "CONSUME", bottleId: "alchemist-potion-1", confirmed: true }, 100);
    s.health = 100; s.mind = 100; apply(s, { type: "BUY_POTION", bottleId: "alchemist-potion-2" }); apply(s, { type: "PURCHASE_PLOT" });
    panel(s); const current = screen.getByRole("region", { name: "炼金术士当前实际原地块" });
    expect(current.textContent).toContain("AL4-PLOT-2-PLANT-01"); expect(current.textContent).toContain("活株 14 · 已死 0");
    await userEvent.click(screen.getByText("已结束的原地块与永久损毁记录"));
    const history = screen.getByRole("article", { name: "AL4-PLOT-1原地块历史" });
    expect(history.textContent).toContain("AL4-PLOT-1-PLANT-01"); expect(history.textContent).toContain("活株 0 · 已死 14");
    expect(s.alchemist.ritual.plots[0]!.plants.every(plant => plant.status === "DEAD")).toBe(true);
  });

  it("starts promoted abilities at actual zero and has no free original creation or unlocked next sequence", () => {
    const s = promoted(), { value } = panel(s);
    expect(value.abilities).toHaveLength(2); expect(value.abilities.every(ability => ability.mastery === 0)).toBe(true);
    expect(screen.getByRole("region", { name: "炼金术士亲手制造的有限原物" }).textContent).toContain("尚未亲手造出本阶段原物");
    expect(screen.getByRole("region", { name: "炼金术士成长下一步" }).textContent).toContain("序列3奥秘学者尚未开放");
    expect(screen.queryByRole("button", { name: /奥秘学者|复苏|复活|复制/ })).toBeNull();
  });

  it("shows the personally manufactured original, finite charge and separate stop, return and close at zero AP", async () => {
    const s = promoted(); makeOriginal(s, "messenger-box"); s.actionsRemaining = 0; s.spirituality = 0; s.health = 1; s.mind = 1;
    const { value, onCommand, rerender } = panel(s);
    const original = screen.getByRole("article", { name: "AL4-BOX-1原造物" });
    expect(original.textContent).toContain("AL4-WOOD-1"); expect(original.textContent).toContain(s.runId);
    expect(original.textContent).toContain("3 / 3"); expect(original.textContent).toContain("原工作台起点");
    expect(original.textContent).toContain("已激活，仍须明确停止");
    expect((screen.getByRole("combobox", { name: "选择当前生活实践" }) as HTMLSelectElement).disabled).toBe(true);
    expect((buttonFor(value, "CLOSE", "messenger-box") as HTMLButtonElement).disabled).toBe(true);
    expect((buttonFor(value, "RETURN_CREATION", "messenger-box") as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "MOVE_CREATION", "messenger-box"));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "MOVE_CREATION", caseId: "messenger-box" });
    expect(original.textContent).toContain("3 / 3"); expect(original.textContent).toContain("原工作台起点");
    apply(s, { type: "MOVE_CREATION", caseId: "messenger-box" }); const moved = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={moved} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(original.textContent).toContain("2 / 3"); expect(original.textContent).toContain("原工作台终点");
    await userEvent.click(buttonFor(moved, "STOP_CREATION", "messenger-box"));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "STOP_CREATION", caseId: "messenger-box" });
    apply(s, { type: "STOP_CREATION", caseId: "messenger-box" }); const stopped = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={stopped} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(original.textContent).toContain("已停止或尚未激活"); expect(original.textContent).toContain("2 / 3");
    await userEvent.click(buttonFor(stopped, "RETURN_CREATION", "messenger-box"));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "RETURN_CREATION", caseId: "messenger-box" });
    apply(s, { type: "RETURN_CREATION", caseId: "messenger-box" }); const returned = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={returned} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(original.textContent).toContain("由玩家本人保管"); expect(returned.life.parcel.custodian).toBe("AL4-HELENA");
    expect((buttonFor(returned, "CLOSE", "messenger-box") as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(buttonFor(returned, "CLOSE", "messenger-box"));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CLOSE", caseId: "messenger-box" });
  });

  it("retains a failed original at its real location and offers actual recovery rather than fabricated ability success", async () => {
    const s = promoted(); makeOriginal(s, "messenger-box", "ABILITY", 100); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand } = panel(s);
    const original = screen.getByRole("article", { name: "AL4-BOX-1原造物" });
    expect(original.textContent).toContain("0 / 3"); expect(original.textContent).toContain("原工作台起点");
    expect(screen.getByRole("region", { name: "炼金术士实际生活结果" }).textContent).toContain("尚无完成用途的结果");
    expect(value.actions.some(action => action.command.type === "MOVE_CREATION")).toBe(false);
    expect((buttonFor(value, "RETURN_CREATION", "messenger-box") as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(buttonFor(value, "RETURN_CREATION", "messenger-box"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_CREATION", caseId: "messenger-box" });
    expect(s.alchemist.life.creations).toHaveLength(1); expect(s.alchemist.life.creations[0]!.charge).toBe(0);
  });

  it("preserves the same original guard frame's used charge and durability and forwards paid recharge without optimistic refill", async () => {
    const s = promoted(); makeOriginal(s, "messenger-box"); finishOriginal(s, "messenger-box");
    makeOriginal(s, "guard-frame"); finishOriginal(s, "guard-frame");
    const { value, onCommand } = panel(s);
    const original = screen.getByRole("article", { name: "AL4-FRAME-1原造物" });
    expect(original.textContent).toContain("AL4-STEEL-1"); expect(original.textContent).toContain("AL4-CELL-2");
    expect(original.textContent).toContain("2 / 3"); expect(original.textContent).toContain("95 / 100");
    expect(original.textContent).toContain("由玩家本人保管");
    const recharge = buttonFor(value, "RECHARGE_FRAME"); expect(recharge.textContent).toContain("40便士"); expect(recharge.textContent).toContain("3灵性");
    await userEvent.click(recharge); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RECHARGE_FRAME" });
    expect(original.textContent).toContain("2 / 3"); expect(original.textContent).toContain("95 / 100");
    expect(value.life.creations).toHaveLength(2);
  });

  it("uses the real ordinary route and original workbench, with no manufactured ability option or fake soul", async () => {
    const s = promoted(), mastery = { ...s.progression.mastery };
    makeOriginal(s, "messenger-box", "ORDINARY"); finishOriginal(s, "messenger-box");
    makeOriginal(s, "guard-frame", "ORDINARY"); finishOriginal(s, "guard-frame");
    apply(s, { type: "OBSERVE", caseId: "maker-account" });
    const { value, onCommand, rerender } = panel(s);
    const current = screen.getByRole("region", { name: "当前炼金术士生活实践" });
    expect(current.textContent).toContain("AL4-WORKBENCH-1"); expect(current.textContent).toContain("无生命模型没有被赋魂");
    expect(value.actions.some(action => action.command.type === "PREPARE" && action.command.caseId === "maker-account" && action.command.method === "ABILITY")).toBe(false);
    expect(s.progression.mastery).toEqual(mastery); expect(value.life.creations.every(item => item.charge === 0 && !item.active)).toBe(true);
    await userEvent.click(buttonFor(value, "PREPARE", "maker-account"));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE", caseId: "maker-account", method: "ORDINARY" });
    apply(s, { type: "PREPARE", caseId: "maker-account", method: "ORDINARY" }); apply(s, { type: "PERFORM", caseId: "maker-account" });
    s.actionsRemaining = 0; const active = projectAlchemist(s);
    rerender(<AlchemistPanel alchemist={active} resources={resources(s)} busy={false} onCommand={onCommand} />);
    expect(active.life.entrustedMaterial.custodian).toBe("PLAYER");
    expect((buttonFor(active, "CLOSE", "maker-account") as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(buttonFor(active, "RETURN_MATERIAL", "maker-account"));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "RETURN_MATERIAL", caseId: "maker-account" });
    expect(active.life.entrustedMaterial.custodian).toBe("PLAYER"); expect(s.progression.mastery).toEqual(mastery);
  });

  it("keeps the optional conflict on the actual adult and his original club, with a zero-action peaceful exit", async () => {
    const s = promoted(); apply(s, { type: "ENCOUNTER_TALK" }); s.actionsRemaining = 0; s.spirituality = 0;
    const { value, onCommand } = panel(s);
    const encounter = screen.getByRole("region", { name: "炼金术士可选原院冲突" });
    expect(encounter.textContent).toContain("奥斯里克 · 44岁 · AL4-OSRIC"); expect(encounter.textContent).toContain("AL4-OSRIC-CLUB");
    expect(encounter.textContent).toContain("仍在原对手手中"); expect(encounter.textContent).toContain("没有原框则普通应对");
    expect((buttonFor(value, "ENCOUNTER_FIGHT") as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(buttonFor(value, "LEAVE_ENCOUNTER")); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE_ENCOUNTER" });
    expect(s.alchemist.encounter.status).toBe("READY"); expect(s.alchemist.life.creations).toEqual([]);
  });

  it.each(["readOnly", "blocked", "busy", "error"] as const)("blocks actions while %s without inventing a panel retry", (condition) => {
    const s = garden(), value = projectAlchemist(s), onCommand = vi.fn();
    render(<AlchemistPanel alchemist={value} resources={resources(s)} busy={condition === "busy"} blocked={condition === "blocked"}
      readOnly={condition === "readOnly"} error={condition === "error" ? { message: "保存结果未确认", retryable: false } : null} onCommand={onCommand} />);
    for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttonFor(value, "DRAIN_LIFE")); expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /重试/ })).toBeNull();
    if (condition === "error") expect(screen.getByRole("status").textContent).toContain("请按错误提示重新加载。");
  });

  it("keeps actual Astronomer observations, failures, instrument and original bottles entirely read-only", () => {
    const s = promoted(), old = projectSliceState(s).astronomer; render(<AlchemistAstronomerHistory astronomer={old} />);
    const history = screen.getByRole("region", { name: "天文学家时期的经历" });
    expect(history.textContent).toContain(`实际测量 ${old.practice!.measurements} 次`);
    expect(history.textContent).toContain(old.bottles[0]!.id); expect(history.textContent).toContain(old.bottles[0]!.status);
    for (const entry of old.cases) for (const fact of entry.observations) expect(history.textContent).toContain(fact);
    expect(within(history).queryAllByRole("button", { hidden: true })).toHaveLength(0);
    expect(within(history).queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(s.astronomer.practice).toEqual(oldAstronomerRun.astronomer.practice);
  });
});

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: { mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }] } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(() => new Promise<Awaited<ReturnType<SliceBridge["submitIntent"]>>>(() => {})),
  };
}
async function enter(s: SliceState) {
  s.character.name = "艾琳"; const state = projectSliceState(s); const api = bridge(state); window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
  // The retained natural Astronomer run still has its genuine terminal-round reveal.
  // Close that presentation through the UI; keep its original battle outcome and navigation assertions.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId); return { api, state };
}

describe("Alchemist actual SliceApp navigation", () => {
  beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });

  it("opens Paragon S5 advancement directly in the real Alchemist panel without a command", async () => {
    const { api, state } = await enter(taught());
    await userEvent.click(screen.getByRole("button", { name: "查看炼金术士晋升" }));
    expect(within(screen.getByRole("region", { name: "炼金术士成长下一步" })).getByRole("heading", { name: state.alchemist.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: "炼金术士晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "天文学家成长下一步" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens current S4 growth and the old Astronomer chapter with no repeatable actions", async () => {
    const { api, state } = await enter(promoted());
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "炼金术士成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "炼金术士成长" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "天文学家经历" }));
    const history = within(screen.getByRole("region", { name: "天文学家时期的经历" }));
    await userEvent.click(history.getByText("天文学家原瓶 · 来源与去向"));
    expect(history.getByText(`原瓶：${state.astronomer.bottles[0]!.id}`)).toBeTruthy();
    expect(history.queryAllByRole("button", { hidden: true })).toHaveLength(0); expect(history.queryAllByRole("combobox", { hidden: true })).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "炼金术士成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "炼金术士成长" }));
    expect(screen.getByRole("region", { name: "炼金术士成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
