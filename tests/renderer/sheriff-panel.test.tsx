/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { ARBITER_ABILITIES } from "../../src/domain/arbiter/content";
import { SHERIFF_ABILITIES, SHERIFF_CONSUMPTION_RISK, SHERIFF_FORMULA_STATUS } from "../../src/domain/sheriff/content";
import type { SheriffAction, SheriffCommand, SheriffProjection } from "../../src/domain/sheriff/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SheriffPanel } from "../../src/renderer/SheriffPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 45, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: SheriffCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): SheriffAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const guidance = action({ type: "LEARN_GUIDANCE" }, "向薇娜·贝尔了解治安官用药指导", true, "180便士 · 1行动");
function sheriff(patch: Partial<SheriffProjection> = {}): SheriffProjection {
  return {
    title: "治安官晋升准备", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "需仲裁人消化100与四个完整序列9周。", pollution: 3,
    risk: SHERIFF_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): SheriffProjection {
  return sheriff({
    guidanceKnown: true,
    supplies: "三瓶独立治安官成品，原价1210便士；每瓶三次实际劳动抵扣1050便士后160便士，指导180便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；本批用尽后有限补给须申请并到下一周实际领取。",
    actions: ["sheriff-potion-1", "sheriff-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "sheriff-potion-1", title: "第一瓶治安官魔药", source: "薇娜·贝尔独立进阶渠道的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "sheriff-potion-1", confirmed: true } },
      { id: "sheriff-potion-2", title: "第二瓶治安官魔药", source: "薇娜·贝尔独立进阶渠道的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "sheriff-potion-2", confirmed: true } },
      { id: "sheriff-potion-3", title: "第三瓶治安官魔药", source: "薇娜·贝尔独立进阶渠道的第三原瓶", status: "指导者保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "sheriff-potion-3", confirmed: true } },
    ],
  });
}
function cases(): SheriffProjection["cases"] {
  return [
    { id: "remembered-face", title: "旧画像与当前面容", story: "曾见过的形象须与眼前特征实际核对。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "shielded-box", title: "原屏蔽箱", story: "附近感应不穿透屏蔽，须经许可实际查看原箱。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "known-route", title: "走过的原路线", story: "只重构走过的路线，不补齐未见过的路段。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
  ];
}
function opened(): SheriffProjection {
  return sheriff({ title: "治安官 · 序列8", promoted: true, guidanceKnown: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "shielded-box" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次实践尚未实际结束", observations: ["原屏蔽箱与当前屏蔽情况已经观察。"],
      result: "本次感应受屏蔽阻隔，箱内仍未知；须停止感应并实际返回。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "shielded-box" }, "实际结束原屏蔽箱实践", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: SheriffProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<SheriffPanel sheriff={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("sheriff-renderer-run", sliceDefaultCreationSelection, "sheriff-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 8 | 9 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    arbiter: { ...structuredClone(base.arbiter), discovered: true, guidanceKnown: true, promoted: true, acting: 100, actions: [] },
    sheriff: sheriff({ title: sequence === 8 ? "治安官 · 序列8" : "治安官晋升准备", promoted: sequence === 8,
      guidanceKnown: sequence === 8, actions: sequence === 8 ? [] : [guidance],
      abilities: sequence === 8 ? [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: "justiciar", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: 5 },
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
async function openSheriff() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.getByRole("button", { name: /^治安官(?:晋升|成长)$/ });
  if (tab.getAttribute("aria-pressed") !== "true") await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Sheriff sequence-eight public practice dossier", () => {
  it("keeps twenty-one ordinary routes and adds no independent Sheriff starting route", async () => {
    const api = bridge(fixture(9, { progression: { ...base.progression }, arbiter: { ...base.arbiter }, sheriff: sheriff({ discovered: false, actions: [] }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "仲裁人之路" })).toBeTruthy();
    expect(choices.queryByRole("button", { name: /治安官/ })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Arbiter current growth at S9 and routes its completed digestion to Sheriff advancement", async () => {
    const reason = "仲裁人消化须达100并度过四个完整序列9周。";
    const api = bridge(fixture(9, { sheriff: sheriff({ actions: [{ ...guidance, enabled: false, reason }] }) }));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看仲裁人成长" }));
    expect(screen.getByRole("region", { name: "仲裁人成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "治安官成长下一步" }).textContent).toContain("四个完整序列9周");
    const button = screen.getByRole("button", { name: /^向薇娜·贝尔了解治安官/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(new RegExp(reason)).length).toBeGreaterThan(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to Sheriff and preserves read-only original Arbiter history", async () => {
    const state = fixture();
    state.arbiter = { ...state.arbiter, cases: [{ id: "shared-yard", title: "原共用院落记录", story: "原争议与当事人的选择仍保留。", status: "RESOLVED", contactOpen: "已实际结束", closes: 2,
      observations: ["原观察"], preparation: "原普通核实准备", result: "原威严遭拒；后来依普通方法达成约定。" }],
      bottles: [{ id: "arbiter-potion-old", title: "仲裁人旧原瓶", source: "原仲裁人渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "arbiter-potion-old", confirmed: true } }],
      actions: [{ id: "old-mutation", label: "不得执行旧命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("治安官 · 序列8 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看治安官成长" }));
    expect(screen.getByRole("region", { name: "治安官成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "仲裁人经历" }));
    const history = within(screen.getByRole("region", { name: "仲裁人时期的经历" }));
    expect(history.getByText(/仲裁人扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/实际结束次数：2/)).toBeTruthy();
    expect(history.getByText("来源：原仲裁人渠道")).toBeTruthy(); expect(history.getByText("原威严遭拒；后来依普通方法达成约定。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "治安官成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows five current abilities and keeps current features, nearby sensing and known images bounded", () => {
    panel(sheriff({ promoted: true, cases: cases(), abilities: [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) }));
    const abilities = screen.getByRole("region", { name: "治安官能力与消化" });
    expect(abilities.querySelectorAll("details")).toHaveLength(5);
    for (const ability of [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES]) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const text of ["威严", "魅力", "格斗训练", "痕迹感应", "图像重构", "全域判罪", "远程库存", "陌生人身份", "序列7精神刺穿", "序列6神秘禁令"]) expect(abilities.textContent).toContain(text);
    const boundary = screen.getByRole("region", { name: "当前特征、有限感应与图像重构边界" }).textContent;
    for (const text of ["旧记忆不能证明当前未变", "附近、未屏蔽", "屏蔽容器", "能力执行消耗2灵性"]) expect(boundary).toContain(text);
    expect(screen.queryByRole("region", { name: "当前观察、有限感应与核实报告" })).toBeNull();
    const summary = screen.getByRole("region", { name: "治安官成长下一步" }).textContent;
    expect(summary).toContain("成年民间调解文书员薇娜·贝尔"); expect(summary).toContain("没有获任政府职务");
    expect(screen.queryByRole("button", { name: /精神刺穿|神秘禁令|远程库存|全域判罪/ })).toBeNull();
  });

  it("renders independent bottle sources and finite public supply terms without fabricating a formula", () => {
    const value = { ...bottled(), supplies: SHERIFF_FORMULA_STATUS + bottled().supplies }; panel({ ...value, formula: [{ name: "不得呈现的未核材料", quantity: 1, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "治安官成品渠道与配方边界" }).textContent).toContain(SHERIFF_FORMULA_STATUS);
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "治安官成品渠道与配方边界" }).textContent).toContain("完整配方尚未核实");
    expect(screen.queryByText("不得呈现的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels at zero AP, restores focus and confirms only the selected original once", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶治安官魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("sheriff-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "治安官服用风险与四档结果" }).textContent).toContain(SHERIFF_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 45", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶治安官魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "sheriff-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("honors changed public eligibility and invalidates a removed bottle confirmation", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "尚未度过四个完整序列9周。";
    rerender(<SheriffPanel sheriff={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶治安官魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); fireEvent.click(confirm);
    rerender(<SheriffPanel sheriff={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves case selection and binds only the public ABILITY and ORDINARY preparation commands", async () => {
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "known-route", method }, `准备${method}`));
    const value = sheriff({ promoted: true, cases: cases(), actions: choices }); const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "known-route");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    rerender(<SheriffPanel sheriff={{ ...value, actions: [action({ type: "OBSERVE", caseId: "remembered-face" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("known-route");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
  });

  it("sends public practice and acquisition commands unchanged and preserves their costs and reasons", async () => {
    const choices = [
      action({ type: "OBSERVE", caseId: "remembered-face" }, "观察旧画像与当前面容"),
      action({ type: "PERFORM", caseId: "remembered-face" }, "执行已准备的方法", true, "1行动 · 能力方法2灵性"),
      action({ type: "REPORT", caseId: "remembered-face" }, "提交有限报告"),
      action({ type: "WITHDRAW", caseId: "remembered-face" }, "撤回尚未执行的准备", true, "0行动"),
      action({ type: "REFLECT" }, "按原记录反思"),
      action({ type: "POTION_WORK", bottleId: "sheriff-potion-3" }, "完成本瓶第三次劳动", true, "1行动 · 劳动2/3→3/3 · 本瓶累计抵扣1050便士"),
      action({ type: "BUY_POTION", bottleId: "sheriff-potion-3" }, "交付本瓶余款", true, "160便士 · 0行动"),
      action({ type: "RECEIVE_SUPPLY" }, "实际领取下周原瓶", true, "0行动 · 本次公开补给"),
      action({ type: "REQUEST_SUPPLY" }, "申请有限补给", false),
    ];
    const { onCommand } = panel(sheriff({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) {
      const button = screen.getByRole("button", { name: new RegExp(`^${choice.label}`) });
      expect(button.textContent).toContain(choice.cost); fireEvent.click(button);
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.filter((entry) => entry.enabled).map((entry) => entry.command));
    expect(screen.getByText("本次条件尚未满足。")).toBeTruthy();
  });

  it("selects the actual open case and exposes only its public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(sheriff({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "known-route");
    const value = opened();
    rerender(<SheriffPanel sheriff={{ ...value, actions: [action({ type: "CLOSE", caseId: "remembered-face" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "shielded-box" }, "不得提前报告"), action({ type: "WITHDRAW", caseId: "shielded-box" }, "不得撤回代替结束"), action({ type: "REFLECT" }, "不得提前反思"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("shielded-box"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束原屏蔽箱/ }); expect((close as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "shielded-box" });
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前观察、有限感应与核实报告" }).textContent).toContain("感应受屏蔽阻隔");
  });

  it("never manufactures an absent CLOSE from public prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "治安官成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retries the same failed consumption envelope without duplicate clicks and preserves a consumed failure", async () => {
    const state = fixture(9, { sheriff: bottled() }); const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const failed = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      sheriff: { ...state.sheriff, actions: state.sheriff.actions.slice(1), bottles: state.sheriff.bottles.map((bottle) => bottle.id === "sheriff-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle) } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(failed, envelope));
    api.submitIntent = submit; await enter(api); await openSheriff();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶治安官魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "治安官服药尚未保存", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("治安官服药尚未保存");
    expect((screen.getByRole("button", { name: "确认服用「第一瓶治安官魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "SHERIFF", command: { type: "CONSUME", bottleId: "sheriff-potion-1", confirmed: true } });
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("sheriff-potion-2")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
  });

  it("keeps the dossier open after a successful Sheriff consumption receipt", async () => {
    const state = fixture(9, { sheriff: bottled() }); const api = bridge(state);
    const next = fixture(8, { revision: state.revision + 1, sheriff: sheriff({
      promoted: true, title: "治安官 · 序列8", guidanceKnown: true, actions: [], cases: cases(),
      abilities: [...ARBITER_ABILITIES, ...SHERIFF_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })),
      bottles: bottled().bottles.map((bottle) => bottle.id === "sheriff-potion-1" ? { ...bottle, status: "已耗用 · 成功晋升" } : bottle),
    }) });
    api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openSheriff();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶治安官魔药」" }));
    expect(await screen.findByRole("region", { name: "治安官能力与消化" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByText("已耗用 · 成功晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "SHERIFF", command: { type: "CONSUME", bottleId: "sheriff-potion-1", confirmed: true } });
  });

  it("reloads zero-resource practice and releases navigation only after the exact CLOSE receipt", async () => {
    const state = fixture(8, { sheriff: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, sheriff: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "shielded-box" ? { ...entry, contactOpen: "本次实践已实际结束", closes: 1 } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "治安官成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次治安官实践");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" }); expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束原屏蔽箱/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "SHERIFF", command: { type: "CLOSE", caseId: "shielded-box" } });
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy(); expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("preserves an earlier Arbiter exit before a simultaneous Sheriff practice", async () => {
    const state = fixture(8, { sheriff: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.arbiter = { ...state.arbiter, insideCase: true, cases: [{ id: "shared-yard", title: "原共用院落", story: "旧调解仍未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "old-close", label: "先结束旧仲裁人调解", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "shared-yard" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, arbiter: { ...state.arbiter, insideCase: false, actions: [] } }, envelope));
    await enter(api); const close = await screen.findByRole("button", { name: /^先结束旧仲裁人调解/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByRole("region", { name: "治安官成长下一步" })).toBeNull();
    await userEvent.click(close);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "ARBITER", command: { type: "CLOSE", caseId: "shared-yard" } });
    expect(await screen.findByRole("region", { name: "治安官成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });

  it("keeps ordinary life available for prepared work and stale contact prose", async () => {
    const value = sheriff({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "原普通方法准备", result: "原已提交记录", contactOpen: "旧文字说实践尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(8, { sheriff: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openSheriff(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
