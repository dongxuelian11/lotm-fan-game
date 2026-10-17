/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SAVANT_ABILITIES, SAVANT_PROJECTS } from "../../src/domain/savant/content";
import type { SavantAction, SavantProjection } from "../../src/domain/savant/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SavantPanel } from "../../src/renderer/SavantPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const discover: SavantAction = {
  id: "discover", label: "拜访工坊导师", cost: "1行动 · 只建立渠道", enabled: true,
  reason: null, command: { type: "DISCOVER" },
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
function savant(patch: Partial<SavantProjection> = {}): SavantProjection {
  return {
    title: "通识者之路", discovered: false, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [discover], bottles: [], abilities: [],
    acting: 0, digestion: "普通生活已完成4/4整周，第5周起可服药。", pollution: 3, risk,
    projects: [], ...patch,
  };
}
function bottled(): SavantProjection {
  return savant({
    discovered: true, guidanceKnown: true,
    supplies: "完整配方资料待核，只能取得导师三瓶独立成品；供应方剩余1瓶，你持有未服原瓶2瓶。",
    actions: ["savant-potion-1", "savant-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "savant-potion-1", title: "第一瓶通识者魔药", source: "导师留存的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "savant-potion-1", confirmed: true } },
      { id: "savant-potion-2", title: "第二瓶通识者魔药", source: "导师留存的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "savant-potion-2", confirmed: true } },
      { id: "savant-potion-3", title: "第三瓶通识者魔药", source: "导师留存的第三原瓶", status: "导师保管 · 劳动0/2", chance: 43, command: { type: "CONSUME", bottleId: "savant-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: SavantProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SavantPanel savant={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(promoted = false, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("savant-renderer-run", sliceDefaultCreationSelection, "savant-renderer-seed");
  raw.week = 6;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    savant: savant({
      discovered: promoted, guidanceKnown: promoted, promoted,
      title: promoted ? "通识者 · 序列9" : "通识者之路",
      actions: promoted ? [] : [discover],
      abilities: promoted ? SAVANT_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 5 })) : [],
    }),
    progression: {
      pathwayId: promoted ? "paragon" : null, sequence: promoted ? 9 : null,
      mastery: promoted ? Object.fromEntries(SAVANT_ABILITIES.map((ability) => [ability.id, 0])) : {},
      acting: 0, promotionWeek: promoted ? 5 : null,
    }, ...patch,
  };
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
async function openSavant() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.queryByRole("button", { name: "通识者之路" });
  if (tab) await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

function projects(): SavantProjection["projects"] {
  return ["shelf-repair", "handcart-wheel", "lamp-shutter", "dispatch-tray"].map((id, index) => ({
    id, title: `公开委托${index + 1}`, story: `委托人公开说明${index + 1}`,
    plan: "", status: "尚未学习", materials: "原材料仍在工坊", tool: "原工具仍在工坊",
  }));
}
function projectAction(type: "STUDY" | "PREPARE" | "CRAFT" | "DELIVER" | "RETURN_TOOLS", projectId = "shelf-repair", enabled = true): SavantAction {
  return {
    id: `${type}-${projectId}`, label: `公开操作${type}`, cost: `领域成本${type}`,
    enabled, reason: enabled ? null : "实际公开限制", command: { type, projectId },
  };
}

describe("Savant pathway dossier", () => {
  it("offers the fourth ordinary route inside growth while retaining one dashboard goal and Town entry", async () => {
    const value = bridge(fixture());
    await enter(value);
    expect(screen.getAllByRole("region", { name: "接下来" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /随身物品与商店/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "通识者之路" })).toBeNull();
    expect(screen.queryByRole("region", { name: "通识者工坊委托" })).toBeNull();
    await openSavant();
    for (const name of ["占卜家之路", "猎人之路", "观众之路", "通识者之路"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("region", { name: "通识者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /考古学家|小丑晋升/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect((screen.getByRole("button", { name: /^工作，/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("shows actual finite finished bottles but never a recipe or a fabricated brewing action", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "不应展示的未知配方材料", quantity: 7, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("不应展示的未知配方材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制药|制造/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus, and consumes only the independently confirmed original bottle once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶通识者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶通识者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶通识者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶通识者魔药」/ }));
    expect(screen.getByText("savant-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：导师留存的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "通识者服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶通识者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "savant-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("discards a confirmation when its original bottle or public consume action disappears", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶通识者魔药」/ }));
    rerender(<SavantPanel savant={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one selected public project and no work plan before it is supplied by the projection", async () => {
    const list = projects();
    const actions = list.map((project) => projectAction("STUDY", project.id));
    const value = savant({ promoted: true, projects: list, actions });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("region", { name: "当前工坊委托" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^公开操作STUDY/ })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "已经学过的工序" })).toBeNull();
    expect(screen.queryByText("委托人公开说明2")).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择工坊委托" }), "handcart-wheel");
    expect(screen.getByText("委托人公开说明2")).toBeTruthy();
    expect(screen.queryByText("委托人公开说明1")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作STUDY/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STUDY", projectId: "handcart-wheel" });
    expect(screen.queryByRole("region", { name: "已经学过的工序" })).toBeNull();
    const learned = list.map((project) => project.id === "handcart-wheel" ? { ...project, status: "已经学习", plan: "投影中实际读过的轮轴工序。" } : project);
    rerender(<SavantPanel savant={{ ...value, projects: learned, actions: [projectAction("PREPARE", "handcart-wheel")] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "已经学过的工序" }).textContent).toContain("投影中实际读过的轮轴工序。");
    expect(screen.queryByRole("button", { name: /^公开操作STUDY/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^公开操作PREPARE/ })).toBeTruthy();
  });

  it("reveals the actual plan after shared-domain STUDY from a synthetic valid promoted checkpoint", async () => {
    const raw = createSliceRun("savant-plan-run", sliceDefaultCreationSelection, "savant-plan-seed");
    raw.week = 6;
    raw.activeEvent = null;
    raw.actionsRemaining = raw.weeklyBudget;
    raw.savant.discovered = true;
    raw.savant.guidanceKnown = true;
    raw.progression = { pathwayId: "paragon", sequence: 9, acting: 0, mastery: Object.fromEntries(SAVANT_ABILITIES.map((ability) => [ability.id, 0])), promotionWeek: 5 };
    // This is a synthetic checkpoint, with the successful original preserved for validation.
    Object.assign(raw.savant.bottles[0]!, { acquiredWeek: 5, consumedWeek: 5, status: "CONSUMED", outcome: "SUCCESS" });
    raw.mind = 90;
    raw.spirituality = 30;
    assertValidSliceState(raw);
    const before = projectSliceState(raw).savant;
    const { onCommand, rerender } = panel(before);
    expect(screen.queryByRole("region", { name: "已经学过的工序" })).toBeNull();
    for (const project of SAVANT_PROJECTS) expect(screen.queryByText(project.plan)).toBeNull();
    const learned = applySliceIntent(raw, { type: "SAVANT", command: { type: "STUDY", projectId: "shelf-repair" } });
    assertValidSliceState(learned);
    rerender(<SavantPanel savant={projectSliceState(learned).savant} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "已经学过的工序" }).textContent).toContain(SAVANT_PROJECTS[0]!.plan);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择工坊委托" }), "handcart-wheel");
    expect(screen.queryByRole("region", { name: "已经学过的工序" })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders original borrowed tools and ready product before forwarding only actual prepare, craft, delivery and return commands", async () => {
    const project = { ...projects()[0]!, plan: "已经学过的普通维修步骤。", status: "已备料，等待操作", materials: "这一组原材料已在工作台", tool: "这套原工具借出，由你保管" };
    const value = savant({ promoted: true, projects: [project], actions: [projectAction("CRAFT"), projectAction("RETURN_TOOLS")] });
    const { onCommand, rerender } = panel(value);
    const card = screen.getByRole("region", { name: "当前工坊委托" });
    expect(within(card).getByText("这一组原材料已在工作台")).toBeTruthy();
    expect(within(card).getByText("这套原工具借出，由你保管")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /公开操作DELIVER|公开操作PREPARE/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作CRAFT/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "CRAFT", projectId: project.id });
    const ready = { ...project, status: "成品在工作台，尚未交付", materials: "原材料已用于这一件成品" };
    rerender(<SavantPanel savant={{ ...value, projects: [ready], actions: [projectAction("DELIVER"), projectAction("RETURN_TOOLS")] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText(ready.status)).toBeTruthy();
    expect(screen.getByText(ready.materials)).toBeTruthy();
    expect(screen.getByText("领域成本DELIVER")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作DELIVER/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "DELIVER", projectId: project.id });
    expect(screen.getByText(ready.status)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^公开操作RETURN_TOOLS/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "RETURN_TOOLS", projectId: project.id });
  });

  it("obeys actual disabled reasons, busy and blocked states without treating zero AP as a blanket prohibition", async () => {
    const value = savant({ promoted: true, projects: projects(), actions: [projectAction("CRAFT", "shelf-repair", false), projectAction("RETURN_TOOLS")] });
    const { onCommand, rerender } = panel(value);
    expect((screen.getByRole("button", { name: /^公开操作CRAFT/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("实际公开限制")).toBeTruthy();
    const returning = screen.getByRole("button", { name: /^公开操作RETURN_TOOLS/ });
    expect((returning as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(returning);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "RETURN_TOOLS", projectId: "shelf-repair" });
    rerender(<SavantPanel savant={value} resources={resources} busy={true} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^公开操作RETURN_TOOLS/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "选择工坊委托" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<SavantPanel savant={value} resources={resources} busy={false} blocked={true} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /^公开操作RETURN_TOOLS/ }));
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("does not invent commands for a ready product or borrowed tool absent public actions", () => {
    panel(savant({ promoted: true, projects: [{ ...projects()[0]!, status: "成品待交付", tool: "原工具仍借出" }], actions: [] }));
    expect(screen.getByText("成品待交付")).toBeTruthy();
    expect(screen.getByText("原工具仍借出")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows only the three acquired S9 abilities and their actual mastery and digestion", () => {
    panel(savant({ promoted: true, actions: [], acting: 48, digestion: "已记录两次实际交付。", abilities: SAVANT_ABILITIES.map((ability, index) => ({ ...ability, mastery: index * 7 })) }));
    const abilities = screen.getByRole("region", { name: "通识者能力与消化" });
    for (const [index, ability] of SAVANT_ABILITIES.entries()) expect(within(abilities).getByText(`${ability.label} · 掌握 ${index * 7}`)).toBeTruthy();
    expect(abilities.textContent).toContain("扮演进度 48");
    expect(abilities.textContent).toContain("没有接触过的知识不会自动出现");
    expect(abilities.textContent).toContain("不能制作非凡器物");
  });

  it("names the promoted Savant, defaults to that route and preserves other learned channels as read-only history", async () => {
    const state = fixture(true);
    state.seer.discovered = true;
    state.seer.formulaKnown = true;
    state.seer.formula = [{ name: "已学占卜家配方材料", quantity: 2, unit: "份" }];
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`通识者 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("通识者 · 序列9 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "通识者成长下一步" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "考古学家晋升" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /小丑晋升|读心者晋升|挑衅者晋升/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "占卜家经历" }));
    const history = screen.getByRole("region", { name: "已了解的占卜家渠道" });
    expect(history.textContent).toContain("已学占卜家配方材料");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "通识者能力与消化" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps known Savant bottles read-only after choosing another pathway", async () => {
    const state = fixture(false, { savant: bottled(), progression: { pathwayId: "diviner", sequence: 9, acting: 0, mastery: {}, promotionWeek: 5 } });
    await enter(bridge(state));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    await userEvent.click(screen.getByRole("button", { name: "通识者经历" }));
    const history = screen.getByRole("region", { name: "已了解的通识者渠道" });
    expect(history.textContent).toContain("第一瓶通识者魔药");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region", { name: "通识者能力与消化" })).toBeNull();
  });

  it.each([false, true])("a fully digested Savant can open the real S8 preparation without spending an action (investigation=%s)", async (investigation) => {
    const state = fixture(true, { investigateTargets: investigation ? [{ id: "KNOWN-CASE", label: "实际公开的后续调查", description: "可以调查的已知目标" }] : [], progression: { pathwayId: "paragon", sequence: 9, acting: 100, mastery: {}, promotionWeek: 5 } });
    const value = bridge(state);
    await enter(value);
    const guide = screen.getByRole("region", { name: "接下来" });
    expect(guide.textContent).toContain("准备序列8晋升");
    await userEvent.click(within(guide).getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "考古学家成长下一步" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "考古学家晋升" })).toHaveLength(1);
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["CONSUME", "RETURN_TOOLS"] as const)("locks and retries the same failed %s envelope at zero AP without a duplicate command", async (type) => {
    const returning = type === "RETURN_TOOLS";
    const state = fixture(returning, { savant: returning ? savant({ promoted: true, projects: projects(), actions: [projectAction("RETURN_TOOLS")] }) : bottled(), actionsRemaining: 0, canAct: false });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openSavant();
    if (!returning) await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶通识者魔药」/ }));
    const confirm = screen.getByRole("button", { name: returning ? /^公开操作RETURN_TOOLS/ : "确认服用「第二瓶通识者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "通识者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("通识者模拟保存失败");
    expect((screen.getByRole("button", { name: returning ? /^公开操作RETURN_TOOLS/ : "确认服用「第二瓶通识者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SAVANT", command: returning ? { type: "RETURN_TOOLS", projectId: "shelf-repair" } : { type: "CONSUME", bottleId: "savant-potion-2", confirmed: true } });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
