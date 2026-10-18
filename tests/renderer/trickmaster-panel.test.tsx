/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { TRICKMASTER_ABILITIES, TRICKMASTER_CONSUMPTION_RISK, TRICKMASTER_FORMULA } from "../../src/domain/trickmaster/content";
import { APPRENTICE_ABILITIES } from "../../src/domain/apprentice/content";
import type { TrickmasterAction, TrickmasterCommand, TrickmasterProjection } from "../../src/domain/trickmaster/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ApprenticeHistory, TrickmasterPanel } from "../../src/renderer/TrickmasterPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const learn: TrickmasterAction = {
  id: "formula", label: "学习戏法大师配方", cost: "1行动 · 240便士", enabled: true,
  reason: null, command: { type: "LEARN_FORMULA" },
};
const risk = TRICKMASTER_CONSUMPTION_RISK;
function trickmaster(patch: Partial<TrickmasterProjection> = {}): TrickmasterProjection {
  return {
    title: "戏法大师晋升", discovered: true, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [],
    acting: 0, digestion: "学徒扮演100，已度过4/4个完整序列9周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): TrickmasterProjection {
  return trickmaster({
    formulaKnown: true, formula: [...TRICKMASTER_FORMULA],
    supplies: "第一批六项原材料已调配；第二批原材料独立调配；第三批仍由导师保管。",
    actions: ["trickmaster-batch-1:bottle", "trickmaster-batch-2:bottle"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "trickmaster-batch-1:bottle", title: "第一瓶戏法大师魔药", source: "第一批六项原材料的调配记录", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "trickmaster-batch-1:bottle", confirmed: true } },
      { id: "trickmaster-batch-2:bottle", title: "第二瓶戏法大师魔药", source: "第二批六项原材料的调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "trickmaster-batch-2:bottle", confirmed: true } },
      { id: "trickmaster-batch-3:bottle", title: "第三瓶戏法大师魔药", source: "第三批六项原材料的调配记录", status: "已服用 · 失败", chance: 43, command: { type: "CONSUME", bottleId: "trickmaster-batch-3:bottle", confirmed: true } },
    ],
  });
}
function cases(): TrickmasterProjection["cases"] {
  return ["warm-cup", "stage-signal", "clear-walkway"].map((id, index) => ({
    id, title: `生活实践${index + 1}`, story: `原现场对象与范围${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: TrickmasterCommand, label = "观察本处现场", enabled = true): TrickmasterAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: TrickmasterProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<TrickmasterPanel trickmaster={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("trickmaster-renderer-run", sliceDefaultCreationSelection, "trickmaster-renderer-seed");
  raw.week = 30;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    apprentice: { ...state.apprentice, discovered: sequence !== null, promoted: sequence !== null, title: "学徒 · 序列9", acting: 100, actions: [] },
    trickmaster: trickmaster({ promoted: sequence === 8, title: sequence === 8 ? "戏法大师 · 序列8" : "戏法大师晋升", actions: sequence === 8 ? [] : [learn] }),
    progression: {
      pathwayId: sequence === null ? null : "door", sequence,
      mastery: {}, acting: sequence === 8 ? 0 : 100, promotionWeek: sequence === null ? null : 5,
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
async function openTrickmaster() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const currentS8 = screen.queryByRole("button", { name: "戏法大师成长" });
  if (currentS8) await userEvent.click(currentS8);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Trickmaster sequence eight dossier", () => {
  it("keeps exactly eleven ordinary routes and only shows S8 to Door S9 or S8", async () => {
    const api = bridge(fixture(null));
    await enter(api); await openTrickmaster();
    expect(within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")).toHaveLength(22);
    expect(screen.queryByRole("button", { name: /戏法大师|占星人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
    cleanup();
    const other = fixture(null, { progression: { pathwayId: "sun", sequence: 9, acting: 100, mastery: {}, promotionWeek: 5 } });
    await enter(bridge(other)); await openTrickmaster();
    expect(screen.queryByRole("button", { name: /戏法大师/ })).toBeNull();
  });

  it("defaults Door S9 to S8 preparation, preserves current Apprentice practice, and opens advancement from the dashboard", async () => {
    const api = bridge(fixture(9));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await openTrickmaster();
    expect(screen.getByRole("button", { name: "戏法大师晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "戏法大师成长下一步" }).textContent).toContain("实际材料、调配成瓶");
    await userEvent.click(screen.getByRole("button", { name: "学徒成长" }));
    expect(screen.getByRole("region", { name: "学徒成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "戏法大师成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults Door S8 to current growth and keeps the original Apprentice history read-only", async () => {
    const state = fixture(8);
    state.seer.discovered = true;
    state.apprentice.cases = [{ id: "locked-office", title: "原档案室通行", story: "委托人原在外侧", observations: ["原薄门与原内闩"], preparation: "选定本人开门", result: "本人已返回并报告", status: "RESOLVED" }];
    state.apprentice.actions = [{ id: "stale-apprentice", label: "不得重做的学徒行动", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "locked-office" } }];
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`戏法大师 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("戏法大师 · 序列8 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openTrickmaster();
    expect(screen.getByRole("button", { name: "戏法大师成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "学徒经历" }));
    const history = screen.getByRole("region", { name: "学徒时期的经历" });
    for (const text of ["委托人原在外侧", "原薄门与原内闩", "选定本人开门", "本人已返回并报告"]) expect(within(history).getByText(text)).toBeTruthy();
    expect(history.textContent).toContain("你已晋升戏法大师");
    expect(within(history).queryByRole("button")).toBeNull();
    expect(screen.queryByText(/不得重做/)).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains the original Apprentice bottle provenance, outcome and exact mastery", () => {
    const state = fixture(8);
    state.apprentice.bottles = [{ id: "old-apprentice", title: "原学徒瓶", source: "原档案工作间交接", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-apprentice", confirmed: true } }];
    state.apprentice.abilities = [{ id: "door.s9.door-opening", label: "开门", mastery: 42, description: "原薄门和本人通行边界" }];
    render(<ApprenticeHistory apprentice={state.apprentice} />);
    for (const text of ["来源：原档案工作间交接", "已服用 · 失败", "开门 · 掌握 42：原薄门和本人通行边界"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows all six known materials exactly, hides unknown formula, and does not claim a verified mixing order", async () => {
    const value = bottled();
    const { rerender, onCommand } = panel(value);
    const formula = screen.getByLabelText("戏法大师已知配方");
    await userEvent.click(within(formula).getByText("查看已知戏法大师配方 · 6 种材料"));
    expect(within(formula).getAllByRole("listitem")).toHaveLength(6);
    for (const material of TRICKMASTER_FORMULA) {
      const row = within(formula).getByText(material.name).closest("li")!;
      expect(within(row).getByText(material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`)).toBeTruthy();
    }
    expect(formula.textContent).toContain("不把列表顺序当作调配顺序");
    expect(formula.textContent).toContain("本作G每批供货1份");
    expect(formula.textContent).not.toContain("null");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    rerender(<TrickmasterPanel trickmaster={{ ...value, formulaKnown: false }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByLabelText("戏法大师已知配方")).toBeNull();
    expect(screen.queryByText("食灵者的胃袋")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches acquisition stages with their exact batch IDs and projected costs without creating bottles locally", async () => {
    const entries: TrickmasterAction[] = [learn,
      { ...action({ type: "MATERIAL_WORK", batchId: "trickmaster-batch-2" }, "第二批实际劳动"), cost: "1行动 · 本次劳动抵扣按原批记录" },
      { ...action({ type: "BUY_MATERIALS", batchId: "trickmaster-batch-2" }, "取得第二批六料"), cost: "1行动 · 第二批实际应付160便士" },
      { ...action({ type: "BREW", batchId: "trickmaster-batch-2" }, "调配第二批原料"), cost: "1行动 · 调配费60便士 · 消耗这批六料" },
    ];
    const { onCommand } = panel(trickmaster({ actions: entries }));
    for (const entry of entries) {
      expect(screen.getByText(entry.cost)).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${entry.label}`) }));
      expect(onCommand).toHaveBeenLastCalledWith(entry.command);
    }
    expect(onCommand).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
  });

  it("cancels with Escape without spending, restores focus, and confirms only the selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶戏法大师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("trickmaster-batch-2:bottle")).toBeTruthy();
    expect(screen.getByText("来源：第二批六项原材料的调配记录")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "戏法大师服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶戏法大师魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "trickmaster-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶戏法大师魔药的服用确认" })).toBeTruthy();
  });

  it("invalidates confirmation when the bottle action disappears or the panel becomes history", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<TrickmasterPanel trickmaster={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<TrickmasterPanel trickmaster={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses projected maturity, labour and purchase reasons without inventing a threshold", () => {
    const value = bottled();
    const reason = "学徒消化不足100，且仅度过3/4完整周。";
    panel({ ...value, actions: [...value.actions.map((entry) => ({ ...entry, enabled: false, reason })), learn,
      { ...action({ type: "BUY_MATERIALS", batchId: "trickmaster-batch-3" }, "取得第三批原料", false), cost: "本次实际应付150便士", reason: "现金不足，原批劳动记录保留" },
    ] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("本次实际应付150便士")).toBeTruthy();
    expect(screen.getByText("现金不足，原批劳动记录保留")).toBeTruthy();
    expect(screen.queryByText(/达到意志18/)).toBeNull();
  });

  it("keeps observations, preparations and committed outcomes separate", async () => {
    const list = cases();
    list[1] = { ...list[1]!, observations: ["原手铃在台边，低强度闪光区域已确认。"], preparation: "已选普通手铃方式，尚未发出信号。", status: "PREPARED" };
    const { onCommand, rerender } = panel(trickmaster({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择生活实践" }), "stage-signal");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain(list[1]!.observations[0]);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).not.toContain("已选普通手铃");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[1]!.preparation);
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    list[1] = { ...list[1]!, result: "已实际敲响原手铃，原手铃留在台边。", status: "RESOLVED" };
    rerender(<TrickmasterPanel trickmaster={trickmaster({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[1]!.result);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).not.toContain(list[1]!.result);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents TRICK and ORDINARY equally without freezing the original cup on click", async () => {
    const list = cases();
    list[0] = { ...list[0]!, observations: ["原杯确实温热，尚无薄冰。"], status: "OBSERVED" };
    const choices = [action({ type: "PREPARE", caseId: "warm-cup", method: "TRICK" }, "准备薄冰戏法"), action({ type: "PREPARE", caseId: "warm-cup", method: "ORDINARY" }, "准备普通冷却")];
    const { onCommand } = panel(trickmaster({ promoted: true, cases: list, actions: choices, environment: "原杯仍温热；原物件均在现场。" }));
    const summary = screen.getByRole("region", { name: "戏法大师成长下一步" });
    expect(summary.textContent).toContain("选择有限戏法或普通方法");
    for (const entry of choices) expect(summary.textContent).not.toContain(entry.label);
    await userEvent.click(screen.getByRole("button", { name: /^准备薄冰戏法/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[0]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("尚无本次准备记录");
    expect(screen.getByRole("region", { name: "已知现场与处理边界" }).textContent).toContain("原杯仍温热");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it.each([
    ["warm-cup", "原杯液面结了一层薄冰，未冻透，稍后融化。"],
    ["stage-signal", "低强度闪光已经在约定区域发出；原手铃留在台边。"],
    ["clear-walkway", "轻风已把原散纸移到路旁，原工具与纸仍在现场。"],
  ])("shows actual %s object effects only after a committed projection", async (id, result) => {
    const list = cases();
    const index = list.findIndex((entry) => entry.id === id);
    list[index] = { ...list[index]!, status: "PREPARED", preparation: "已准备本次有限戏法。" };
    const value = trickmaster({ promoted: true, cases: list, actions: [action({ type: "PERFORM", caseId: id }, "执行本次方式")] });
    const { rerender, onCommand } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择生活实践" }), id);
    await userEvent.click(screen.getByRole("button", { name: /^执行本次方式/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PERFORM", caseId: id });
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    list[index] = { ...list[index]!, status: "RESOLVED", result };
    rerender(<TrickmasterPanel trickmaster={{ ...value, cases: list, actions: [], environment: result }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(result);
    expect(screen.getByRole("region", { name: "已知现场与处理边界" }).textContent).toContain(result);
  });

  it("keeps unprovided facts unknown and respects zero-AP withdrawal, reflection, and every lock", async () => {
    const value = trickmaster({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "warm-cup" }, "观察原现场", false), { ...action({ type: "WITHDRAW", caseId: "warm-cup" }, "退出本次准备"), cost: "0行动" }, { ...action({ type: "REFLECT" }, "反思实际生活实践"), cost: "0行动" }] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "已知现场与处理边界" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能确认未提供的事实");
    expect((screen.getByRole("button", { name: /^观察原现场/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^退出本次准备/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "WITHDRAW", caseId: "warm-cup" });
    await userEvent.click(screen.getByRole("button", { name: /^反思实际生活实践/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<TrickmasterPanel trickmaster={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际生活实践/ });
      expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("retains S9 mastery plus one shared tricks mastery without inventing separate spell tracks", () => {
    const abilities = [...APPRENTICE_ABILITIES, ...TRICKMASTER_ABILITIES].map((entry, index) => ({ ...entry, mastery: index === 0 ? 42 : 17 }));
    panel(trickmaster({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "戏法大师能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 2 项能力" })).toBeTruthy();
    for (const ability of abilities) {
      expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(within(region).getByText(ability.description)).toBeTruthy();
    }
    expect(region.textContent).toContain("各种较弱戏法共用的一项掌握度");
    expect(screen.getByRole("region", { name: "戏法大师成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["LEARN_FORMULA", "MATERIAL_WORK", "BUY_MATERIALS", "BREW", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "CONSUME", "OBSERVE", "PREPARE_TRICK", "PREPARE_ORDINARY", "PERFORM", "WITHDRAW", "REFLECT"] as const)("retries the original failed %s envelope without speculative state", async (type) => {
    const command: TrickmasterCommand = type === "CONSUME" ? { type, bottleId: "trickmaster-batch-2:bottle", confirmed: true }
      : type === "REFLECT" || type === "LEARN_FORMULA" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "MATERIAL_WORK" || type === "BUY_MATERIALS" || type === "BREW" ? { type, batchId: "trickmaster-batch-2" }
      : type === "PREPARE_TRICK" || type === "PREPARE_ORDINARY" ? { type: "PREPARE", caseId: "warm-cup", method: type === "PREPARE_TRICK" ? "TRICK" : "ORDINARY" }
      : { type, caseId: "warm-cup" };
    const entry = action(command, `执行${type}`);
    const promoted = "caseId" in command || type === "REFLECT";
    const state = fixture(promoted ? 8 : 9, { trickmaster: type === "CONSUME" ? bottled() : trickmaster({ promoted, cases: promoted ? cases() : [], actions: [entry] }) });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openTrickmaster();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶戏法大师魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "戏法大师模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("戏法大师模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "TRICKMASTER", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
