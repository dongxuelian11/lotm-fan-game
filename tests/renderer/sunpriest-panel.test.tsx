/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { SUNPRIEST_ABILITIES, SUNPRIEST_CONSUMPTION_RISK, SUNPRIEST_FORMULA } from "../../src/domain/sunpriest/content";
import { BARD_ABILITIES } from "../../src/domain/bard/content";
import { LIGHTPRAYER_ABILITIES } from "../../src/domain/lightprayer/content";
import type { SunpriestAction, SunpriestCommand, SunpriestProjection } from "../../src/domain/sunpriest/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { LightprayerHistory, SunpriestBardHistory, SunpriestPanel } from "../../src/renderer/SunpriestPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const learn: SunpriestAction = {
  id: "formula", label: "学习太阳神官配方", cost: "1行动 · 240便士", enabled: true,
  reason: null, command: { type: "LEARN_FORMULA" },
};
const risk = SUNPRIEST_CONSUMPTION_RISK;
function sunpriest(patch: Partial<SunpriestProjection> = {}): SunpriestProjection {
  return {
    title: "太阳神官晋升", discovered: true, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [learn], bottles: [], abilities: [],
    acting: 0, digestion: "祈光人扮演100，已度过8/8个完整序列8周。", pollution: 3, risk,
    cases: [], environment: "", ...patch,
  };
}
function bottled(): SunpriestProjection {
  return sunpriest({
    formulaKnown: true, formula: [...SUNPRIEST_FORMULA],
    supplies: "第一批六项原材料已调配；第二批原材料独立调配；第三批仍由导师保管。神圣之水：制备0、持有0、使用0。",
    actions: ["sunpriest-batch-1:bottle", "sunpriest-batch-2:bottle"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "sunpriest-batch-1:bottle", title: "第一瓶太阳神官魔药", source: "第一批六项原材料的调配记录", status: "已调配，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "sunpriest-batch-1:bottle", confirmed: true } },
      { id: "sunpriest-batch-2:bottle", title: "第二瓶太阳神官魔药", source: "第二批六项原材料的调配记录", status: "已调配，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "sunpriest-batch-2:bottle", confirmed: true } },
      { id: "sunpriest-batch-3:bottle", title: "第三瓶太阳神官魔药", source: "第三批六项原材料的调配记录", status: "已服用 · 失败", chance: 43, command: { type: "CONSUME", bottleId: "sunpriest-batch-3:bottle", confirmed: true } },
    ],
  });
}
function cases(): SunpriestProjection["cases"] {
  return ["water-preparation", "voluntary-oath", "isolation-cleanup"].map((id, index) => ({
    id, title: `神官实践${index + 1}`, story: `原现场对象与范围${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE",
  }));
}
function action(command: SunpriestCommand, label = "观察本处现场", enabled = true): SunpriestAction {
  return {
    id: JSON.stringify(command), label, cost: "1行动 · 本案公开成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command,
  };
}
function panel(value: SunpriestProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<SunpriestPanel sunpriest={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 | 7 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("sunpriest-renderer-run", sliceDefaultCreationSelection, "sunpriest-renderer-seed");
  raw.week = 30;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    bard: { ...state.bard, discovered: sequence !== null, promoted: sequence !== null, title: "歌颂者 · 序列9", acting: 100, actions: [] },
    lightprayer: { ...state.lightprayer, discovered: sequence === 8 || sequence === 7, promoted: sequence === 8 || sequence === 7, acting: 100, actions: [] },
    sunpriest: sunpriest({ promoted: sequence === 7, title: sequence === 7 ? "太阳神官 · 序列7" : "太阳神官晋升", actions: sequence === 7 ? [] : [learn] }),
    progression: {
      pathwayId: sequence === null ? null : "sun", sequence,
      mastery: {}, acting: sequence === 7 ? 0 : 100, promotionWeek: sequence === null ? null : 5,
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
async function openSunpriest() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Sunpriest sequence seven dossier", () => {
  it("keeps exactly eleven ordinary routes and hides S7 even from Sun S9", async () => {
    let api = bridge(fixture(null));
    await enter(api); await openSunpriest();
    expect(within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")).toHaveLength(22);
    expect(screen.queryByRole("button", { name: /太阳神官|祈光人/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
    cleanup();
    api = bridge(fixture(9));
    await enter(api); await openSunpriest();
    expect(screen.getByRole("region", { name: "歌颂者成长下一步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "祈光人晋升" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /太阳神官/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults Sun S8 to its S7 candidate, retains current practice, and opens advancement from the dashboard", async () => {
    const api = bridge(fixture(8));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await openSunpriest();
    expect(screen.getByRole("button", { name: "太阳神官晋升" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "太阳神官成长下一步" }).textContent).toContain("实际材料、调配成瓶");
    await userEvent.click(screen.getByRole("button", { name: "祈光人成长" }));
    expect(screen.getByRole("region", { name: "祈光人成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "太阳神官成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults Sun S7 to current growth and preserves both lower histories without callbacks", async () => {
    const state = fixture(7);
    state.seer.discovered = true;
    state.bard.cases = [{ id: "troubled-carrier", title: "原短歌协助", story: "当事人曾拒绝唱歌", observations: ["原观察为疲惫而非邪恶"], preparation: "约定普通交谈", result: "原结果为继续工作", status: "RESOLVED" }];
    state.bard.actions = [{ id: "stale-bard", label: "不得重做的歌颂者行动", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "troubled-carrier" } }];
    state.lightprayer.cases = [{ id: "storehouse-echo", title: "原库房记录", story: "原声源未确认", observations: ["原敲击确实发生"], preparation: "准备普通转交", result: "已转交但未净化", status: "RESOLVED" }];
    state.lightprayer.actions = [{ id: "stale-light", label: "不得重做的祈光人行动", cost: "1行动", enabled: true, reason: null, command: { type: "PERFORM", caseId: "storehouse-echo" } }];
    const api = bridge(state);
    await enter(api);
    expect(screen.getByText(new RegExp(`太阳神官 · 序列7 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("太阳神官 · 序列7 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await openSunpriest();
    expect(screen.getByRole("button", { name: "太阳神官成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    for (const [tab, texts] of [["歌颂者", ["当事人曾拒绝唱歌", "原观察为疲惫而非邪恶", "约定普通交谈", "原结果为继续工作"]], ["祈光人", ["原声源未确认", "原敲击确实发生", "准备普通转交", "已转交但未净化"]]] as const) {
      await userEvent.click(screen.getByRole("button", { name: `${tab}经历` }));
      const history = screen.getByRole("region", { name: `${tab}时期的经历` });
      for (const text of texts) expect(within(history).getByText(text)).toBeTruthy();
      expect(history.textContent).toContain("你已晋升太阳神官");
      expect(within(history).queryByRole("button")).toBeNull();
      expect(screen.queryByText(/不得重做/)).toBeNull();
    }
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains lower-sequence bottle provenance, outcome and original mastery", () => {
    const state = fixture(7);
    state.bard.bottles = [{ id: "old-bard", title: "原歌颂者瓶", source: "原音乐室交接", status: "已服用 · 失败", chance: 50, command: { type: "CONSUME", bottleId: "old-bard", confirmed: true } }];
    state.bard.abilities = [{ id: "sun.s9.praise", label: "原歌颂", mastery: 37, description: "原共同声场边界" }];
    state.lightprayer.bottles = [{ id: "old-light", title: "原祈光人瓶", source: "原灯具库房交接", status: "已服用 · 灾难", chance: 50, command: { type: "CONSUME", bottleId: "old-light", confirmed: true } }];
    state.lightprayer.abilities = [{ id: "sun.s8.ritual", label: "原有限仪式", mastery: 42, description: "原准备与对象" }];
    render(<><SunpriestBardHistory bard={state.bard} /><LightprayerHistory lightprayer={state.lightprayer} /></>);
    for (const text of ["来源：原音乐室交接", "已服用 · 失败", "原歌颂 · 掌握 37：原共同声场边界", "来源：原灯具库房交接", "已服用 · 灾难", "原有限仪式 · 掌握 42：原准备与对象"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows all six known materials exactly, hides unknown formula, and does not claim a verified mixing order", async () => {
    const value = bottled();
    const { rerender, onCommand } = panel(value);
    const formula = screen.getByLabelText("太阳神官已知配方");
    await userEvent.click(within(formula).getByText("查看已知太阳神官配方 · 6 种材料"));
    expect(within(formula).getAllByRole("listitem")).toHaveLength(6);
    for (const material of SUNPRIEST_FORMULA) {
      const row = within(formula).getByText(material.name).closest("li")!;
      expect(within(row).getByText(`${material.quantity} ${material.unit}`)).toBeTruthy();
    }
    expect(formula.textContent).toContain("不把列表顺序当作调配顺序");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    rerender(<SunpriestPanel sunpriest={{ ...value, formulaKnown: false }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByLabelText("太阳神官已知配方")).toBeNull();
    expect(screen.queryByText("黎明雄鸡红冠")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("dispatches acquisition stages with their exact batch IDs and projected costs without creating bottles locally", async () => {
    const entries: SunpriestAction[] = [learn,
      { ...action({ type: "MATERIAL_WORK", batchId: "sunpriest-batch-2" }, "第二批实际劳动"), cost: "1行动 · 本次劳动抵扣按原批记录" },
      { ...action({ type: "BUY_MATERIALS", batchId: "sunpriest-batch-2" }, "取得第二批六料"), cost: "1行动 · 第二批实际应付160便士" },
      { ...action({ type: "BREW", batchId: "sunpriest-batch-2" }, "调配第二批原料"), cost: "1行动 · 调配费60便士 · 消耗这批六料" },
    ];
    const { onCommand } = panel(sunpriest({ actions: entries }));
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
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶太阳神官魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("sunpriest-batch-2:bottle")).toBeTruthy();
    expect(screen.getByText("来源：第二批六项原材料的调配记录")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "太阳神官服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶太阳神官魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "sunpriest-batch-2:bottle", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("region", { name: "这瓶太阳神官魔药的服用确认" })).toBeTruthy();
  });

  it("invalidates confirmation when the bottle action disappears or the panel becomes history", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<SunpriestPanel sunpriest={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    rerender(<SunpriestPanel sunpriest={value} resources={resources} busy={false} blocked={false} readOnly onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses projected maturity, labour and purchase reasons without inventing a threshold", () => {
    const value = bottled();
    const reason = "祈光人消化不足100，且仅度过7/8完整周。";
    panel({ ...value, actions: [...value.actions.map((entry) => ({ ...entry, enabled: false, reason })), learn,
      { ...action({ type: "BUY_MATERIALS", batchId: "sunpriest-batch-3" }, "取得第三批原料", false), cost: "本次实际应付150便士", reason: "现金不足，原批劳动记录保留" },
    ] });
    expect((screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(screen.getByText("本次实际应付150便士")).toBeTruthy();
    expect(screen.getByText("现金不足，原批劳动记录保留")).toBeTruthy();
    expect(screen.queryByText(/达到意志18/)).toBeNull();
  });

  it("keeps observed voluntary consent, preparations and committed outcomes separate", async () => {
    const list = cases();
    list[1] = { ...list[1]!, observations: ["当事人明确自愿，并保留停止选择。"], preparation: "已选择普通陪伴，未订立神圣誓约。", status: "PREPARED" };
    const { onCommand, rerender } = panel(sunpriest({ promoted: true, cases: list, actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择神官实践" }), "voluntary-oath");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain(list[1]!.observations[0]);
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).not.toContain("已选择普通陪伴");
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain(list[1]!.preparation);
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    list[1] = { ...list[1]!, result: "当事人按自己的决定完成了有限工作。", status: "RESOLVED" };
    rerender(<SunpriestPanel sunpriest={sunpriest({ promoted: true, cases: list, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain(list[1]!.result);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).not.toContain(list[1]!.result);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("presents LIGHT and ORDINARY equally and does not fabricate a prepared holy-water bottle", async () => {
    const list = cases();
    list[0] = { ...list[0]!, observations: ["原清水与容器确实存在，尚未制作。"], status: "OBSERVED" };
    const choices = [action({ type: "PREPARE", caseId: "water-preparation", method: "LIGHT" }, "准备神圣之水"), action({ type: "PREPARE", caseId: "water-preparation", method: "ORDINARY" }, "准备归还原水瓶")];
    const { onCommand } = panel(sunpriest({ promoted: true, cases: list, actions: choices, supplies: "神圣之水：制备0、持有0、使用0。" }));
    const summary = screen.getByRole("region", { name: "太阳神官成长下一步" });
    expect(summary.textContent).toContain("选择神官方式或普通方法");
    for (const entry of choices) expect(summary.textContent).not.toContain(entry.label);
    await userEvent.click(screen.getByRole("button", { name: /^准备神圣之水/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[0]!.command);
    expect(screen.getByRole("region", { name: "实际方式与准备" }).textContent).toContain("尚无本次准备记录");
    expect(screen.getByRole("region", { name: "太阳神官实际物资" }).textContent).toContain("持有0");
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
  });

  it("shows actual holy-water production and use only after committed projections, while ordinary reporting preserves inventory", async () => {
    const list = cases();
    list[0] = { ...list[0]!, status: "RESOLVED", result: "原清水已经制成一瓶神圣之水。" };
    const value = sunpriest({ promoted: true, cases: list, actions: [], supplies: "神圣之水：制备1、持有1、使用0。" });
    const { rerender, onCommand } = panel(value);
    expect(screen.getByRole("region", { name: "太阳神官实际物资" }).textContent).toContain("制备1、持有1、使用0");
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain("制成一瓶");
    list[2] = { ...list[2]!, status: "RESOLVED", preparation: "普通记录与转交。", result: "原记录已转交，未净化，未使用神圣之水。" };
    rerender(<SunpriestPanel sunpriest={{ ...value, cases: list }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择神官实践" }), "isolation-cleanup");
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain("未净化，未使用");
    expect(screen.getByRole("region", { name: "太阳神官实际物资" }).textContent).toContain("制备1、持有1、使用0");
    list[2] = { ...list[2]!, result: "实际使用一瓶神圣之水；本次未能完成有限清理。" };
    rerender(<SunpriestPanel sunpriest={{ ...value, cases: list, supplies: "神圣之水：制备1、持有0、使用1。" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "太阳神官实际物资" }).textContent).toContain("制备1、持有0、使用1");
    expect(screen.getByRole("region", { name: "实际作业结果" }).textContent).toContain("未能完成");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("keeps unprovided facts unknown and respects zero-AP withdrawal, reflection, and every lock", async () => {
    const value = sunpriest({ promoted: true, cases: cases(), actions: [action({ type: "OBSERVE", caseId: "water-preparation" }, "观察原现场", false), { ...action({ type: "WITHDRAW", caseId: "water-preparation" }, "退出本次准备"), cost: "0行动" }, { ...action({ type: "REFLECT" }, "反思实际神官实践"), cost: "0行动" }] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "已知现场与处理边界" }).textContent).toContain("尚未确认");
    expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("不能确认未提供的事实");
    expect((screen.getByRole("button", { name: /^观察原现场/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^退出本次准备/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "WITHDRAW", caseId: "water-preparation" });
    await userEvent.click(screen.getByRole("button", { name: /^反思实际神官实践/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REFLECT" });
    for (const flags of [{ busy: true, blocked: false }, { busy: false, blocked: true }, { busy: false, blocked: false, readOnly: true }]) {
      rerender(<SunpriestPanel sunpriest={value} resources={resources} {...flags} onCommand={onCommand} />);
      const button = screen.getByRole("button", { name: /^反思实际神官实践/ });
      expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it("shows all nine supplied abilities and true fear immunity without upgrading it to general mind immunity", () => {
    const abilities = [...BARD_ABILITIES, ...LIGHTPRAYER_ABILITIES, ...SUNPRIEST_ABILITIES].map((entry, index) => ({ ...entry, mastery: index * 7 }));
    panel(sunpriest({ promoted: true, actions: [], acting: 100, abilities }));
    const region = screen.getByRole("region", { name: "太阳神官能力与消化" });
    expect(within(region).getByRole("heading", { name: "能力与消化 · 9 项能力" })).toBeTruthy();
    for (const ability of abilities) {
      expect(within(region).getByText(`${ability.label} · 掌握 ${ability.mastery}`)).toBeTruthy();
      expect(within(region).getByText(ability.description)).toBeTruthy();
    }
    expect(region.textContent).toContain("恐惧免疫确实生效，但不等于所有心智影响免疫");
    expect(region.textContent).toContain("不包含序列6公证、复活或高污染治愈");
    expect(screen.getByRole("region", { name: "太阳神官成长下一步" }).textContent).toContain("这一阶段的魔药已消化");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["LEARN_FORMULA", "MATERIAL_WORK", "BUY_MATERIALS", "BREW", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "CONSUME", "OBSERVE", "PREPARE_LIGHT", "PREPARE_ORDINARY", "PERFORM", "WITHDRAW", "REFLECT"] as const)("retries the original failed %s envelope without speculative state", async (type) => {
    const command: SunpriestCommand = type === "CONSUME" ? { type, bottleId: "sunpriest-batch-2:bottle", confirmed: true }
      : type === "REFLECT" || type === "LEARN_FORMULA" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "MATERIAL_WORK" || type === "BUY_MATERIALS" || type === "BREW" ? { type, batchId: "sunpriest-batch-2" }
      : type === "PREPARE_LIGHT" || type === "PREPARE_ORDINARY" ? { type: "PREPARE", caseId: "water-preparation", method: type === "PREPARE_LIGHT" ? "LIGHT" : "ORDINARY" }
      : { type, caseId: "water-preparation" };
    const entry = action(command, `执行${type}`);
    const promoted = "caseId" in command || type === "REFLECT";
    const state = fixture(promoted ? 7 : 8, { sunpriest: type === "CONSUME" ? bottled() : sunpriest({ promoted, cases: promoted ? cases() : [], actions: [entry] }) });
    const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    api.submitIntent = submit;
    await enter(api); await openSunpriest();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const label = type === "CONSUME" ? "确认服用「第二瓶太阳神官魔药」" : new RegExp(`^${entry.label}`);
    const confirm = screen.getByRole("button", { name: label });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "太阳神官模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("太阳神官模拟保存失败");
    expect((screen.getByRole("button", { name: label }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际作业结果" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "SUNPRIEST", command });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
