/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { ARBITER_ABILITIES } from "../../src/domain/arbiter/content";
import { SHERIFF_ABILITIES } from "../../src/domain/sheriff/content";
import { INTERROGATOR_ABILITIES, INTERROGATOR_CONSUMPTION_RISK, INTERROGATOR_FORMULA_STATUS } from "../../src/domain/interrogator/content";
import type { InterrogatorAction, InterrogatorCommand, InterrogatorProjection } from "../../src/domain/interrogator/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { InterrogatorPanel } from "../../src/renderer/InterrogatorPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: InterrogatorCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): InterrogatorAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const guidance = action({ type: "LEARN_GUIDANCE" }, "向薇娜·贝尔了解审讯者用药指导", true, "240便士 · 1行动");
function interrogator(patch: Partial<InterrogatorProjection> = {}): InterrogatorProjection {
  return {
    title: "审讯者晋升准备", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "需治安官消化100与八个完整序列8周。", pollution: 3,
    risk: INTERROGATOR_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): InterrogatorProjection {
  return interrogator({
    guidanceKnown: true,
    supplies: "三瓶独立审讯者成品，原价2010便士；每瓶四次实际劳动抵扣1800便士后210便士，指导240便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；本批用尽后有限补给须申请并到下一周实际领取。",
    actions: ["interrogator-potion-1", "interrogator-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "interrogator-potion-1", title: "第一瓶审讯者魔药", source: "薇娜·贝尔独立进阶渠道的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "interrogator-potion-1", confirmed: true } },
      { id: "interrogator-potion-2", title: "第二瓶审讯者魔药", source: "薇娜·贝尔独立进阶渠道的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "interrogator-potion-2", confirmed: true } },
      { id: "interrogator-potion-3", title: "第三瓶审讯者魔药", source: "薇娜·贝尔独立进阶渠道的第三原瓶", status: "指导者保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "interrogator-potion-3", confirmed: true } },
    ],
  });
}
function cases(): InterrogatorProjection["cases"] {
  return [
    { id: "fragment-account", title: "原片段陈述", story: "片段陈述仍须用普通记录实际核对。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "conflicting-delivery", title: "矛盾交付记录", story: "原交付记录相互矛盾，须经许可实际核对。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "withdrawn-interview", title: "撤回的自愿访谈", story: "自愿谈话可以停止，实际撤回仍须尊重。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
  ];
}
function opened(): InterrogatorProjection {
  return interrogator({ title: "审讯者 · 序列7", promoted: true, guidanceKnown: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "conflicting-delivery" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次实践尚未实际结束", observations: ["原交付记录与当前矛盾已经观察。"],
      result: "本次陈述相互矛盾，真相仍未知；须实际结束谈话并退开。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "conflicting-delivery" }, "实际结束矛盾交付记录实践", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: InterrogatorProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<InterrogatorPanel interrogator={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("interrogator-renderer-run", sliceDefaultCreationSelection, "interrogator-renderer-seed");
raw.week = 20; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 7 | 8 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    arbiter: { ...structuredClone(base.arbiter), discovered: true, guidanceKnown: true, promoted: true, acting: 100, actions: [] },
    sheriff: { ...structuredClone(base.sheriff), discovered: true, guidanceKnown: true, promoted: true, acting: 100, actions: [] },
    interrogator: interrogator({ title: sequence === 7 ? "审讯者 · 序列7" : "审讯者晋升准备", promoted: sequence === 7,
      guidanceKnown: sequence === 7, actions: sequence === 7 ? [] : [guidance],
      abilities: sequence === 7 ? [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES, ...INTERROGATOR_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: "justiciar", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: 12 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{
        runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:01:00Z",
      }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:02:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openInterrogator() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.getByRole("button", { name: /^审讯者(?:晋升|成长)$/ });
  if (tab.getAttribute("aria-pressed") !== "true") await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Interrogator sequence-seven public practice dossier", () => {
  it("keeps twenty-one ordinary routes and adds no independent Interrogator starting route", async () => {
    const api = bridge(fixture(8, { progression: { ...base.progression }, arbiter: { ...base.arbiter }, sheriff: { ...base.sheriff }, interrogator: interrogator({ discovered: false, actions: [] }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "仲裁人之路" })).toBeTruthy();
    expect(choices.queryByRole("button", { name: /审讯者/ })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Sheriff current growth at S8 and routes completed digestion to Interrogator advancement", async () => {
    const reason = "治安官消化须达100并度过八个完整序列8周。";
    const api = bridge(fixture(8, { interrogator: interrogator({ actions: [{ ...guidance, enabled: false, reason }] }) }));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看治安官成长" }));
    expect(screen.getByRole("region", { name: "治安官成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "审讯者成长下一步" }).textContent).toContain("八个完整序列8周");
    const button = screen.getByRole("button", { name: /^向薇娜·贝尔了解审讯者/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(new RegExp(reason)).length).toBeGreaterThan(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S7 to Interrogator and preserves read-only original Arbiter history", async () => {
    const state = fixture();
    state.arbiter = { ...state.arbiter, cases: [{ id: "shared-yard", title: "原共用院落记录", story: "原争议与当事人的选择仍保留。", status: "RESOLVED", contactOpen: "已实际结束", closes: 2,
      observations: ["原观察"], preparation: "原普通核实准备", result: "原威严遭拒；后来依普通方法达成约定。" }],
      bottles: [{ id: "arbiter-potion-old", title: "仲裁人旧原瓶", source: "原仲裁人渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "arbiter-potion-old", confirmed: true } }],
      actions: [{ id: "old-mutation", label: "不得执行旧命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("审讯者 · 序列7 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看审讯者成长" }));
    expect(screen.getByRole("region", { name: "审讯者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "仲裁人经历" }));
    const history = within(screen.getByRole("region", { name: "仲裁人时期的经历" }));
    expect(history.getByText(/仲裁人扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/实际结束次数：2/)).toBeTruthy();
    expect(history.getByText("来源：原仲裁人渠道")).toBeTruthy(); expect(history.getByText("原威严遭拒；后来依普通方法达成约定。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "审讯者成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows seven current abilities and bounds pressure, truth claims and voluntary contact", () => {
    panel(interrogator({ promoted: true, cases: cases(), abilities: [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES, ...INTERROGATOR_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) }));
    const abilities = screen.getByRole("region", { name: "审讯者能力与消化" });
    expect(abilities.querySelectorAll("details")).toHaveLength(7);
    for (const ability of [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES, ...INTERROGATOR_ABILITIES]) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const text of ["威严", "魅力", "格斗训练", "痕迹感应", "图像重构", "精神刺穿", "精神压迫", "自动读取真相", "宣告有罪", "序列6神秘禁令", "上限60", "不会自动补满"]) expect(abilities.textContent).toContain(text);
    const boundary = screen.getByRole("region", { name: "自愿谈话、有限陈述与核实边界" }).textContent;
    for (const text of ["能力施压不保证真话", "自愿谈话可随时停止", "撤回同意", "能力执行消耗3灵性"]) expect(boundary).toContain(text);
    expect(screen.queryByRole("region", { name: "原陈述、实际结果与有限报告" })).toBeNull();
    const summary = screen.getByRole("region", { name: "审讯者成长下一步" }).textContent;
    expect(summary).toContain("成年民间调解文书员薇娜·贝尔"); expect(summary).toContain("没有获任政府职务");
    expect(screen.queryByRole("button", { name: /精神刺穿|神秘禁令|远程库存|全域判罪/ })).toBeNull();
  });

  it("renders independent bottle sources and finite public supply terms without fabricating a formula", () => {
    const value = { ...bottled(), supplies: INTERROGATOR_FORMULA_STATUS + bottled().supplies }; panel({ ...value, formula: [{ name: "不得呈现的未核材料", quantity: 1, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "审讯者成品渠道与配方边界" }).textContent).toContain(INTERROGATOR_FORMULA_STATUS);
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "审讯者成品渠道与配方边界" }).textContent).toContain("完整配方尚未核实");
    expect(screen.queryByText("不得呈现的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels at zero AP, restores focus and confirms only the selected original once", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶审讯者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("interrogator-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "审讯者服用风险与四档结果" }).textContent).toContain(INTERROGATOR_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 60", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶审讯者魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "interrogator-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("honors changed public eligibility and invalidates a removed bottle confirmation", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "尚未度过八个完整序列8周。";
    rerender(<InterrogatorPanel interrogator={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶审讯者魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); fireEvent.click(confirm);
    rerender(<InterrogatorPanel interrogator={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves case selection and binds only the public ABILITY and ORDINARY preparation commands", async () => {
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "withdrawn-interview", method }, `准备${method}`));
    const value = interrogator({ promoted: true, cases: cases(), actions: choices }); const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "withdrawn-interview");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    rerender(<InterrogatorPanel interrogator={{ ...value, actions: [action({ type: "OBSERVE", caseId: "fragment-account" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("withdrawn-interview");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
  });

  it("sends public practice and acquisition commands unchanged and preserves their costs and reasons", async () => {
    const choices = [
      action({ type: "OBSERVE", caseId: "fragment-account" }, "观察原片段陈述"),
      action({ type: "PERFORM", caseId: "fragment-account" }, "执行已准备的方法", true, "1行动 · 能力方法3灵性"),
      action({ type: "REPORT", caseId: "fragment-account" }, "提交有限报告"),
      action({ type: "WITHDRAW", caseId: "fragment-account" }, "撤回尚未执行的准备", true, "0行动"),
      action({ type: "REFLECT" }, "按原记录反思"),
      action({ type: "POTION_WORK", bottleId: "interrogator-potion-3" }, "完成本瓶第四次劳动", true, "1行动 · 劳动3/4→4/4 · 本瓶累计抵扣1800便士"),
      action({ type: "BUY_POTION", bottleId: "interrogator-potion-3" }, "交付本瓶余款", true, "210便士 · 0行动"),
      action({ type: "RECEIVE_SUPPLY" }, "实际领取下周原瓶", true, "0行动 · 本次公开补给"),
      action({ type: "REQUEST_SUPPLY" }, "申请有限补给", false),
    ];
    const { onCommand } = panel(interrogator({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) {
      const button = screen.getByRole("button", { name: new RegExp(`^${choice.label}`) });
      expect(button.textContent).toContain(choice.cost); fireEvent.click(button);
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.filter((entry) => entry.enabled).map((entry) => entry.command));
    expect(screen.getByText("本次条件尚未满足。")).toBeTruthy();
  });

  it("selects the actual open case and exposes only its public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(interrogator({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "withdrawn-interview");
    const value = opened();
    rerender(<InterrogatorPanel interrogator={{ ...value, actions: [action({ type: "CLOSE", caseId: "fragment-account" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "conflicting-delivery" }, "不得提前报告"), action({ type: "WITHDRAW", caseId: "conflicting-delivery" }, "不得撤回代替结束"), action({ type: "REFLECT" }, "不得提前反思"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("conflicting-delivery"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束矛盾交付记录/ }); expect((close as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "conflicting-delivery" });
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "原陈述、实际结果与有限报告" }).textContent).toContain("陈述相互矛盾");
  });

  it("never manufactures an absent CLOSE from public prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "审讯者成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retries the same failed consumption envelope without duplicate clicks and preserves a consumed failure", async () => {
    const state = fixture(8, { interrogator: bottled() }); const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const failed = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      interrogator: { ...state.interrogator, actions: state.interrogator.actions.slice(1), bottles: state.interrogator.bottles.map((bottle) => bottle.id === "interrogator-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle) } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(failed, envelope));
    api.submitIntent = submit; await enter(api); await openInterrogator();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶审讯者魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "审讯者服药尚未保存", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("审讯者服药尚未保存");
    expect((screen.getByRole("button", { name: "确认服用「第一瓶审讯者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "INTERROGATOR", command: { type: "CONSUME", bottleId: "interrogator-potion-1", confirmed: true } });
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("interrogator-potion-2")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
  });

  it("keeps the dossier open after a successful Interrogator consumption receipt", async () => {
    const state = fixture(8, { interrogator: bottled() }); const api = bridge(state);
    const next = fixture(7, { revision: state.revision + 1, interrogator: interrogator({
      promoted: true, title: "审讯者 · 序列7", guidanceKnown: true, actions: [], cases: cases(),
      abilities: [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES, ...INTERROGATOR_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })),
      bottles: bottled().bottles.map((bottle) => bottle.id === "interrogator-potion-1" ? { ...bottle, status: "已耗用 · 成功晋升" } : bottle),
    }) });
    api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openInterrogator();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶审讯者魔药」" }));
    expect(await screen.findByRole("region", { name: "审讯者能力与消化" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByText("已耗用 · 成功晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "INTERROGATOR", command: { type: "CONSUME", bottleId: "interrogator-potion-1", confirmed: true } });
  });

  it("reloads zero-resource practice and releases navigation only after the exact CLOSE receipt", async () => {
    const state = fixture(7, { interrogator: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, interrogator: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "conflicting-delivery" ? { ...entry, contactOpen: "本次实践已实际结束", closes: 1 } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "审讯者成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次审讯者接触");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" }); expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束矛盾交付记录/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "INTERROGATOR", command: { type: "CLOSE", caseId: "conflicting-delivery" } });
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy(); expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("preserves an earlier Arbiter exit before a simultaneous Interrogator practice", async () => {
    const state = fixture(7, { interrogator: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.arbiter = { ...state.arbiter, insideCase: true, cases: [{ id: "shared-yard", title: "原共用院落", story: "旧调解仍未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "old-close", label: "先结束旧仲裁人调解", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "shared-yard" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, arbiter: { ...state.arbiter, insideCase: false, actions: [] } }, envelope));
    await enter(api); const close = await screen.findByRole("button", { name: /^先结束旧仲裁人调解/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByRole("region", { name: "审讯者成长下一步" })).toBeNull();
    await userEvent.click(close);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "ARBITER", command: { type: "CLOSE", caseId: "shared-yard" } });
    expect(await screen.findByRole("region", { name: "审讯者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });


  it("preserves the original Sheriff records and mastery in read-only S8 history", async () => {
    const state = fixture();
    state.sheriff = { ...state.sheriff, story: "原治安官供给与实践沿原记录保存。", cases: [{ id: "shielded-box", title: "原屏蔽箱核实", story: "原箱仍受屏蔽。", status: "RESOLVED", contactOpen: "已实际结束", closes: 3,
      observations: ["原普通方法核对记录"], preparation: "原普通方法准备", result: "原感应受阻，后来实际查看并归还原箱。" }],
      bottles: [{ id: "sheriff-potion-old", title: "治安官旧原瓶", source: "原治安官独立渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "sheriff-potion-old", confirmed: true } }],
      abilities: SHERIFF_ABILITIES.map((ability) => ({ ...ability, mastery: 35 })),
      actions: [{ id: "old-sheriff-mutation", label: "不得执行旧治安官命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api); await openInterrogator();
    await userEvent.click(screen.getByRole("button", { name: "治安官经历" }));
    const history = within(screen.getByRole("region", { name: "治安官时期的经历" }));
    expect(history.getByText(/治安官扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/实际结束次数：3/)).toBeTruthy();
    expect(history.getByText("来源：原治安官独立渠道")).toBeTruthy();
    expect(history.getByText("原感应受阻，后来实际查看并归还原箱。")).toBeTruthy();
    for (const ability of SHERIFF_ABILITIES) expect(history.getByText(`${ability.label} · 掌握 35：${ability.description}`)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("closes inherited Arbiter then Sheriff contact before the current Interrogator contact", async () => {
    const state = fixture(7, { interrogator: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.arbiter = { ...state.arbiter, insideCase: true, cases: [{ id: "shared-yard", title: "原调解", story: "原调解尚未结束。", observations: [], preparation: null, result: "原结果", status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "arbiter-close", label: "实际结束最早的调解", cost: "0行动 · 0精神 · 0灵性", enabled: true, reason: null, command: { type: "CLOSE", caseId: "shared-yard" } }],
    };
    state.sheriff = { ...state.sheriff, insideCase: true, cases: [{ id: "shielded-box", title: "原治安官实践", story: "原箱须实际归还。", observations: [], preparation: null, result: "原结果", status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "sheriff-close", label: "实际结束后来的治安官实践", cost: "0行动 · 0精神 · 0灵性", enabled: true, reason: null, command: { type: "CLOSE", caseId: "shielded-box" } }],
    };
    const second: SliceProjection = { ...state, revision: state.revision + 1, arbiter: { ...state.arbiter, insideCase: false, actions: [] } };
    const third: SliceProjection = { ...second, revision: second.revision + 1, sheriff: { ...state.sheriff, insideCase: false, actions: [] } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(second, envelope))
      .mockImplementationOnce(async (envelope) => receipt(third, envelope));
    await enter(api);
    const firstClose = await screen.findByRole("button", { name: /^实际结束最早的调解/ });
    expect((firstClose as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "治安官成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "审讯者成长下一步" })).toBeNull();
    await userEvent.click(firstClose);
    const secondClose = await screen.findByRole("button", { name: /^实际结束后来的治安官实践/ });
    expect((secondClose as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "治安官时期的经历" })).toBeNull();
    expect(screen.queryByRole("region", { name: "审讯者成长下一步" })).toBeNull();
    await userEvent.click(secondClose);
    expect(await screen.findByRole("region", { name: "审讯者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(vi.mocked(api.submitIntent).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: "ARBITER", command: { type: "CLOSE", caseId: "shared-yard" } },
      { type: "SHERIFF", command: { type: "CLOSE", caseId: "shielded-box" } },
    ]);
  });

  it("honors withdrawn consent and its public zero-spirituality cost without inventing an answer", async () => {
    const withdrawn = cases().find((entry) => entry.id === "withdrawn-interview")!;
    const perform = action({ type: "PERFORM", caseId: withdrawn.id }, "尊重本人撤回并停止核对", true, "1行动 · 0灵性 · 不抽取答案");
    const value = interrogator({ promoted: true, cases: [{ ...withdrawn, status: "PREPARED", preparation: "本人可随时停止的有限核对" }], actions: [perform] });
    const { onCommand, rerender } = panel(value, vi.fn(), { ...resources, spirituality: 0 });
    const button = screen.getByRole("button", { name: /^尊重本人撤回并停止核对/ });
    expect(button.textContent).toContain("1行动 · 0灵性 · 不抽取答案");
    await userEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.queryByRole("region", { name: "原陈述、实际结果与有限报告" })).toBeNull();
    const close = action({ type: "CLOSE", caseId: withdrawn.id }, "实际结束已撤回的访谈", true, "0行动 · 0精神 · 0灵性");
    rerender(<InterrogatorPanel interrogator={{ ...value, insideCase: true, actions: [close], cases: [{ ...withdrawn, status: "EXAMINED", contactOpen: "尚未实际结束", result: "本人已撤回同意，未继续施压；没有新增答案。" }] }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "原陈述、实际结果与有限报告" }).textContent).toContain("没有新增答案");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^实际结束已撤回的访谈/ }));
    expect(onCommand).toHaveBeenLastCalledWith(close.command);
  });

  it("keeps ordinary life available for prepared work and stale contact prose", async () => {
    const value = interrogator({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "原普通方法准备", result: "原已提交记录", contactOpen: "旧文字说实践尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(7, { interrogator: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openInterrogator(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
