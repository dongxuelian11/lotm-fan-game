/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from "../../src/domain/slice";
import { ARCHAEOLOGIST_ABILITIES } from "../../src/domain/archaeologist/content";
import type { ArchaeologistAction, ArchaeologistCommand, ArchaeologistProjection } from "../../src/domain/archaeologist/types";
import { SAVANT_ABILITIES } from "../../src/domain/savant/content";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ArchaeologistPanel } from "../../src/renderer/ArchaeologistPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 45, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "实际四档：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选考古学家原瓶消耗。";
function action(command: ArchaeologistCommand, enabled = true): ArchaeologistAction {
  const suffix = "approach" in command ? command.approach : "siteId" in command ? command.siteId : "bottleId" in command ? command.bottleId : "";
  return {
    id: `${command.type}-${suffix}`, label: `公开操作${command.type}${suffix}`, cost: `领域成本${command.type}`,
    enabled, reason: enabled ? null : "本周剩余行动不足。", command,
  };
}
function archaeologist(patch: Partial<ArchaeologistProjection> = {}): ArchaeologistProjection {
  return {
    title: "考古学家之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", sites: [],
    actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    acting: 0, digestion: "通识者消化100/100，晋升通识者后6/6整周。", pollution: 3, risk,
    ...patch,
  };
}
function bottled(): ArchaeologistProjection {
  return archaeologist({
    guidanceKnown: true,
    supplies: "新渠道三瓶独立考古学家成品；供应方剩余1瓶，你持有未服原瓶2瓶。完整配方资料待核。",
    actions: ["archaeologist-potion-1", "archaeologist-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true })),
    bottles: [
      { id: "archaeologist-potion-1", title: "第一瓶考古学家魔药", source: "考察队实际交接的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "archaeologist-potion-1", confirmed: true } },
      { id: "archaeologist-potion-2", title: "第二瓶考古学家魔药", source: "考察队实际交接的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "archaeologist-potion-2", confirmed: true } },
      { id: "archaeologist-potion-3", title: "第三瓶考古学家魔药", source: "考察队实际交接的第三原瓶", status: "导师保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "archaeologist-potion-3", confirmed: true } },
    ],
  });
}
function sites(): ArchaeologistProjection["sites"] {
  return ["cellar-arch", "old-waypost", "sealed-store"].map((id, index) => ({
    id, title: `公开地点${index + 1}`, story: `本次许可与公开委托${index + 1}`,
    observations: [], result: null, status: "AVAILABLE",
  }));
}
function panel(value: ArchaeologistProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ArchaeologistPanel archaeologist={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function checkpoint(sequence: 9 | 8 = 8) {
  const raw = createSliceRun("archaeologist-renderer-run", sliceDefaultCreationSelection, "archaeologist-renderer-seed");
  raw.week = 12;
  raw.activeEvent = null;
  raw.actionsRemaining = raw.weeklyBudget;
  raw.character.name = "艾琳";
  raw.savant.discovered = true;
  raw.savant.guidanceKnown = true;
  // Synthetic valid checkpoint: both historical successful originals are retained.
  Object.assign(raw.savant.bottles[0]!, { acquiredWeek: 5, consumedWeek: 5, status: "CONSUMED", outcome: "SUCCESS" });
  raw.progression = {
    pathwayId: "paragon", sequence, acting: sequence === 9 ? 100 : 0, promotionWeek: 5,
    mastery: Object.fromEntries([...SAVANT_ABILITIES, ...(sequence === 8 ? ARCHAEOLOGIST_ABILITIES : [])].map((ability, index) => [ability.id, index * 7])),
  };
  if (sequence === 8) {
    raw.archaeologist.guidanceKnown = true;
    raw.archaeologist.promotionWeek = 11;
    raw.archaeologist.savantActingAtPromotion = 100;
    Object.assign(raw.archaeologist.bottles[0]!, { acquiredWeek: 11, consumedWeek: 11, status: "CONSUMED", outcome: "SUCCESS" });
  }
  raw.mind = 90;
  raw.spirituality = sequence === 8 ? 45 : 30;
  return raw;
}
function fixture(sequence: 9 | 8 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return { ...projectSliceState(checkpoint(sequence)), investigateTargets: [], canAct: true, actionBlockedReason: null, ...patch };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision,
        updatedAt: "2026-10-11T00:00:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: {
    intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-11T00:01:00Z", replayed: false, state,
  } };
}
async function enter(value: SliceBridge) {
  window.sliceGame = value;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openArchaeologist() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "考古学家晋升" }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Archaeologist pathway dossier", () => {
  it("offers the real S8 guide inside growth while retaining one Town entry and one dashboard goal", async () => {
    const value = bridge(fixture(9));
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /随身物品与商店/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "考古学家晋升" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getAllByRole("button", { name: "考古学家晋升" })).toHaveLength(1);
    expect(screen.getByRole("region", { name: "考古学家成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /请埃德温说明考古学家成品与风险/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /小丑晋升|挑衅者晋升|读心者晋升/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows finite original S8 bottles without inventing a formula, ingredients or brewing", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未公开的配方材料", quantity: 7, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未公开的配方材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制药|制造/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus, and independently confirms exactly the chosen original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶考古学家魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶考古学家魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶考古学家魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶考古学家魔药」/ }));
    expect(screen.getByText("archaeologist-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：考察队实际交接的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "考古学家服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 45", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶考古学家魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "archaeologist-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["bottle", "action", "promotion"])("discards a confirmation when its %s changes", async (change) => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶考古学家魔药」/ }));
    const next = { ...value, ...(change === "bottle" ? { bottles: value.bottles.slice(1) } : change === "action" ? { actions: value.actions.slice(1) } : { promoted: true }) };
    rerender(<ArchaeologistPanel archaeologist={next} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected site and only reveals observations and results supplied after the matching stage", async () => {
    const list = sites();
    const value = archaeologist({ promoted: true, sites: list, actions: list.map((site) => action({ type: "SURVEY", siteId: site.id })) });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前探索地点" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "已经勘察到的现场记录" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际探索结果" })).toBeNull();
    expect(screen.queryByText("本次许可与公开委托2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择探索地点" }), "old-waypost");
    expect(screen.getByText("本次许可与公开委托2")).toBeTruthy();
    expect(screen.queryByText("本次许可与公开委托1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作SURVEY/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "SURVEY", siteId: "old-waypost" });
    expect(screen.queryByRole("region", { name: "已经勘察到的现场记录" })).toBeNull();
    const surveyed = list.map((site) => site.id === "old-waypost" ? { ...site, status: "SURVEYED", observations: ["亲眼看到干路与新塌边。"] } : site);
    rerender(<ArchaeologistPanel archaeologist={{ ...value, sites: surveyed, actions: [action({ type: "EXPLORE", siteId: "old-waypost", approach: "COMPARE" }), action({ type: "EXPLORE", siteId: "old-waypost", approach: "CAREFUL" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "已经勘察到的现场记录" }).textContent).toContain("亲眼看到干路与新塌边。");
    expect(screen.queryByRole("button", { name: /^公开操作SURVEY/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际探索结果" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作EXPLORECAREFUL/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "EXPLORE", siteId: "old-waypost", approach: "CAREFUL" });
    const resolved = surveyed.map((site) => site.id === "old-waypost" ? { ...site, status: "RESOLVED", result: "沿原干路返回，归还原绳尺；路标留在现场。" } : site);
    rerender(<ArchaeologistPanel archaeologist={{ ...value, sites: resolved, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际探索结果" }).textContent).toContain("沿原干路返回，归还原绳尺；路标留在现场。");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reveals real observations only after shared-domain SURVEY and never invents an appraisal", () => {
    const raw = checkpoint();
    assertValidSliceState(raw);
    const before = projectSliceState(raw).archaeologist;
    const { onCommand, rerender } = panel(before);
    expect(screen.queryByRole("region", { name: "已经勘察到的现场记录" })).toBeNull();
    expect(screen.queryByText("你实际读到普通维修簿：二十年前换过一段砖。")).toBeNull();
    const surveyed = applySliceIntent(raw, { type: "ARCHAEOLOGIST", command: { type: "SURVEY", siteId: "cellar-arch" } });
    assertValidSliceState(surveyed);
    rerender(<ArchaeologistPanel archaeologist={projectSliceState(surveyed).archaeologist} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "已经勘察到的现场记录" }).textContent).toContain("二十年前换过一段砖");
    expect(screen.queryByRole("region", { name: "实际探索结果" })).toBeNull();
    expect(screen.queryByRole("button", { name: /神奇物品鉴定|解除诅咒|制造非凡/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps known sites readable at zero AP and follows actual disabled reasons, busy and blocked states", async () => {
    const raw = checkpoint();
    raw.archaeologist.sites["old-waypost"]!.status = "SURVEYED";
    raw.actionsRemaining = 0;
    const value = projectSliceState(raw).archaeologist;
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择探索地点" }), "old-waypost");
    expect(screen.getByRole("region", { name: "已经勘察到的现场记录" }).textContent).toContain("沿沟路有新塌边");
    const actions = within(screen.getByRole("group", { name: "当前地点的探索行动" })).getAllByRole("button");
    expect(actions.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByText("需要1行动。").length).toBeGreaterThan(0);
    fireEvent.click(actions[0]!);
    expect(onCommand).not.toHaveBeenCalled();
    rerender(<ArchaeologistPanel archaeologist={value} resources={resources} busy={true} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择探索地点" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<ArchaeologistPanel archaeologist={value} resources={resources} busy={false} blocked={true} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择探索地点" }) as HTMLSelectElement).disabled).toBe(true);
  });

  it("renders guidance, three original-bottle labour steps, payment and resupply from projected commands", async () => {
    const commands: ArchaeologistCommand[] = [
      { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "archaeologist-potion-1" },
      { type: "POTION_WORK", bottleId: "archaeologist-potion-1" }, { type: "POTION_WORK", bottleId: "archaeologist-potion-1" },
      { type: "BUY_POTION", bottleId: "archaeologist-potion-1" }, { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" },
    ];
    const { onCommand, rerender } = panel(archaeologist());
    for (const [index, command] of commands.entries()) {
      const current = action(command);
      current.label = `实际阶段${index + 1}`;
      current.cost = `实际领域消耗${index + 1}`;
      rerender(<ArchaeologistPanel archaeologist={archaeologist({ guidanceKnown: index > 0, actions: [current] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
      expect(screen.getByText(current.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(current.label) }));
      expect(onCommand).toHaveBeenLastCalledWith(command);
      expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    }
    expect(onCommand).toHaveBeenCalledTimes(commands.length);
  });

  it("shows both inherited S9 and newly acquired S8 abilities with actual mastery", () => {
    const value = projectSliceState(checkpoint()).archaeologist;
    panel(value);
    const abilities = screen.getByRole("region", { name: "考古学家能力与消化" });
    expect(value.abilities).toHaveLength(6);
    for (const ability of value.abilities) expect(within(abilities).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
    expect(abilities.textContent).toContain("通识者消化成果100/100已保留");
    expect(abilities.textContent).toContain("不是鉴定神奇物品");
  });

  it("defaults to S8 and keeps the original Savant records read-only without offering an S7 upgrade", async () => {
    const state = fixture(8, { actionsRemaining: 0, canAct: false });
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`考古学家 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "考古学家成长下一步" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "考古学家晋升" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "通识者经历" }));
    const history = screen.getByRole("region", { name: "通识者时期的经历" });
    expect(history.textContent).toContain("成功晋升");
    expect(history.textContent).toContain("记忆唤醒");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "通识者成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "考古学家成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /鉴定师晋升/ })).toBeTruthy();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "SURVEY", "EXPLORE", "REFLECT"] as const)("locks and retries the same failed %s envelope without duplicating a command", async (type) => {
    const consume = type === "CONSUME";
    const command: ArchaeologistCommand = consume ? { type, bottleId: "archaeologist-potion-2", confirmed: true }
      : type === "REFLECT" ? { type } : type === "EXPLORE" ? { type, siteId: "cellar-arch", approach: "COMPARE" } : { type, siteId: "cellar-arch" };
    const state = fixture(consume ? 9 : 8, {
      archaeologist: consume ? bottled() : archaeologist({ promoted: true, sites: sites(), actions: [action(command)] }),
      actionsRemaining: consume ? 0 : 1, canAct: !consume,
    });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openArchaeologist();
    if (consume) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶考古学家魔药」/ }));
    const buttonName = consume ? "确认服用「第二瓶考古学家魔药」" : new RegExp(`^公开操作${type}`);
    const confirm = screen.getByRole("button", { name: buttonName });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "考古学家模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("考古学家模拟保存失败");
    expect((screen.getByRole("button", { name: buttonName }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect((screen.getByRole("button", { name: consume ? "通识者之路" : "通识者经历" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "ARCHAEOLOGIST", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
