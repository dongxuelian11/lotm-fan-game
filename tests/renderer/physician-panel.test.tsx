/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { CULTIVATOR_ABILITIES } from "../../src/domain/cultivator/content";
import { PHYSICIAN_ABILITIES, PHYSICIAN_CONSUMPTION_RISK, PHYSICIAN_FORMULA_STATUS } from "../../src/domain/physician/content";
import type { PhysicianAction, PhysicianCommand, PhysicianProjection } from "../../src/domain/physician/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { PhysicianPanel } from "../../src/renderer/PhysicianPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 45, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: PhysicianCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): PhysicianAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const guidance = action({ type: "LEARN_GUIDANCE" }, "向伊芙·莫兰了解医师用药指导", true, "180便士 · 1行动");
function physician(patch: Partial<PhysicianProjection> = {}): PhysicianProjection {
  return {
    title: "医师晋升准备", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "需耕种者消化100与四个完整序列9周。", pollution: 3,
    risk: PHYSICIAN_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", clinic: "", ...patch,
  };
}
function bottled(): PhysicianProjection {
  return physician({
    guidanceKnown: true,
    supplies: "三瓶独立医师成品，原价1210便士；每瓶三次实际劳动抵扣1050便士后160便士，指导180便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；本批用尽后有限补给须申请并到下一周实际领取。",
    actions: ["physician-potion-1", "physician-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "physician-potion-1", title: "第一瓶医师魔药", source: "伊芙·莫兰独立进阶渠道的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "physician-potion-1", confirmed: true } },
      { id: "physician-potion-2", title: "第二瓶医师魔药", source: "伊芙·莫兰独立进阶渠道的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "physician-potion-2", confirmed: true } },
      { id: "physician-potion-3", title: "第三瓶医师魔药", source: "伊芙·莫兰独立进阶渠道的第三原瓶", status: "指导者保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "physician-potion-3", confirmed: true } },
    ],
  });
}
function cases(): PhysicianProjection["cases"] {
  return [
    { id: "minor-cut", title: "成年人的轻微割伤", story: "先观察眼前伤口，再选择有限幻想治疗或实际敷料。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "uncertain-fatigue", title: "未明疲乏", story: "未明原因只能记录观察并求助，不凭空确诊。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "unsafe-whisper", title: "危险耳语", story: "面对危险耳语实际退开转介，不治愈污染。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
  ];
}
function opened(): PhysicianProjection {
  return physician({ title: "医师 · 序列8", promoted: true, guidanceKnown: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "uncertain-fatigue" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次实践尚未实际结束", observations: ["当前疲乏与有限转介条件已经观察。"],
      result: "本次已记录疲乏，原因仍未知；须实际停止接触并转介。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "uncertain-fatigue" }, "实际结束未明疲乏实践", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: PhysicianProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<PhysicianPanel physician={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("physician-renderer-run", sliceDefaultCreationSelection, "physician-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 8 | 9 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    cultivator: { ...structuredClone(base.cultivator), discovered: true, guidanceKnown: true, promoted: true, acting: 100, actions: [] },
    physician: physician({ title: sequence === 8 ? "医师 · 序列8" : "医师晋升准备", promoted: sequence === 8,
      guidanceKnown: sequence === 8, actions: sequence === 8 ? [] : [guidance],
      abilities: sequence === 8 ? [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: "mother", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: 5 },
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
async function openPhysician() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.getByRole("button", { name: /^医师(?:晋升|成长)$/ });
  if (tab.getAttribute("aria-pressed") !== "true") await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Physician sequence-eight public practice dossier", () => {
  it("keeps twenty-two ordinary routes and adds no independent Physician starting route", async () => {
    const api = bridge(fixture(9, { progression: { ...base.progression }, cultivator: { ...base.cultivator }, physician: physician({ discovered: false, actions: [] }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "耕种者之路" })).toBeTruthy();
    expect(choices.queryByRole("button", { name: /医师/ })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Cultivator current growth at S9 and routes its completed digestion to Physician advancement", async () => {
    const reason = "耕种者消化须达100并度过四个完整序列9周。";
    const api = bridge(fixture(9, { physician: physician({ actions: [{ ...guidance, enabled: false, reason }] }) }));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看耕种者成长" }));
    expect(screen.getByRole("region", { name: "耕种者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "医师成长下一步" }).textContent).toContain("四个完整序列9周");
    const button = screen.getByRole("button", { name: /^向伊芙·莫兰了解医师/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(new RegExp(reason)).length).toBeGreaterThan(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to Physician and preserves read-only original Cultivator history", async () => {
    const state = fixture();
    state.cultivator = { ...state.cultivator, garden: "原菜圃：水2份、种子1份、已收成3份、已交付1份。", cases: [{ id: "soil-record", title: "原种床照护记录", story: "原种子、水与跨周照护结果仍保留。", status: "RESOLVED", contactOpen: "已实际结束", closes: 2,
      observations: ["原观察"], preparation: "原普通照护准备", result: "原种床照护失败；后来依普通方法完成照护。" }],
      bottles: [{ id: "cultivator-potion-old", title: "耕种者旧原瓶", source: "原耕种者渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "cultivator-potion-old", confirmed: true } }],
      actions: [{ id: "old-mutation", label: "不得执行旧命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("医师 · 序列8 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看医师成长" }));
    expect(screen.getByRole("region", { name: "医师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "耕种者经历" }));
    const history = within(screen.getByRole("region", { name: "耕种者时期的经历" }));
    expect(history.getByText(/耕种者扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/实际结束次数：2/)).toBeTruthy();
    expect(history.getByText("原菜圃：水2份、种子1份、已收成3份、已交付1份。")).toBeTruthy();
    expect(history.getByText("来源：原耕种者渠道")).toBeTruthy(); expect(history.getByText("原种床照护失败；后来依普通方法完成照护。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "医师成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows five current abilities and keeps actual health and uncertain conditions bounded", () => {
    const clinic = "实际敷料2份；割伤患者健康90/100；未知疲乏已转介；危险耳语未治愈。";
    panel(physician({ promoted: true, clinic, cases: cases(), abilities: [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) }));
    const abilities = screen.getByRole("region", { name: "医师能力与消化" });
    expect(abilities.querySelectorAll("details")).toHaveLength(5);
    for (const ability of [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES]) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const text of ["有限治疗", "病况观察", "不清除污染", "现实处方", "序列7催生", "灵性上限为45", "不会自动补满"]) expect(abilities.textContent).toContain(text);
    const boundary = screen.getByRole("region", { name: "有限照护、实际健康与转介边界" }).textContent;
    for (const text of ["3灵性", "1份敷料", "70改善至90", "70改善至80", "普通检定", "有限观察和转介", "不耗灵性", "45便士", "3份", "失败也保留已付成本"]) expect(boundary).toContain(text);
    expect(screen.getByRole("region", { name: "患者健康、敷料与转介记录" }).textContent).toContain(clinic);
    expect(screen.queryByRole("region", { name: "当前照护、实际健康与转介报告" })).toBeNull();
    expect(screen.queryByRole("button", { name: /灵魂缝合|复活|治愈污染|催生/ })).toBeNull();
    expect(screen.getByRole("region", { name: "医师成长下一步" }).textContent).toContain("不是现实医疗指导");
  });

  it("renders independent bottle sources and finite public supply terms without fabricating a formula", () => {
    const value = { ...bottled(), supplies: PHYSICIAN_FORMULA_STATUS + bottled().supplies }; panel({ ...value, formula: [{ name: "不得呈现的未核材料", quantity: 1, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "医师成品渠道与配方边界" }).textContent).toContain(PHYSICIAN_FORMULA_STATUS);
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    const authored = screen.getByRole("region", { name: "医师成品渠道与配方边界" }).querySelector("p")!;
    expect(authored.textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(authored.textContent).toContain("材料、完整用量与投料顺序仍未知");
    expect(authored.textContent).toContain("来源、费用、三次劳动与后续补给条件");
    expect(authored.textContent).not.toContain("候选资料");
    expect(screen.queryByText("不得呈现的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels at zero AP, restores focus and confirms only the selected original once", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶医师魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("physician-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "医师服用风险与四档结果" }).textContent).toContain(PHYSICIAN_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 45", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶医师魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "physician-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("honors changed public eligibility and invalidates a removed bottle confirmation", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "尚未度过四个完整序列9周。";
    rerender(<PhysicianPanel physician={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶医师魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); fireEvent.click(confirm);
    rerender(<PhysicianPanel physician={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves case selection and binds only the public ABILITY and ORDINARY preparation commands", async () => {
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "unsafe-whisper", method }, `准备${method}`));
    const value = physician({ promoted: true, cases: cases(), actions: choices }); const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "unsafe-whisper");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    rerender(<PhysicianPanel physician={{ ...value, actions: [action({ type: "OBSERVE", caseId: "minor-cut" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("unsafe-whisper");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
  });

  it("sends public practice and acquisition commands unchanged and preserves their costs and reasons", async () => {
    const choices = [
      action({ type: "OBSERVE", caseId: "minor-cut" }, "观察成年人的轻微割伤"),
      action({ type: "PERFORM", caseId: "minor-cut" }, "执行已准备的方法", true, "1行动 · 能力方法3灵性"),
      action({ type: "REPORT", caseId: "minor-cut" }, "提交有限报告"),
      action({ type: "WITHDRAW", caseId: "minor-cut" }, "撤回尚未执行的准备", true, "0行动"),
      action({ type: "REFLECT" }, "按原记录反思"),
      action({ type: "BUY_KIT" }, "补充实际敷料", true, "45便士 · 3份实际敷料 · 仅库存0时"),
      action({ type: "POTION_WORK", bottleId: "physician-potion-3" }, "完成本瓶第三次劳动", true, "1行动 · 劳动2/3→3/3 · 本瓶累计抵扣1050便士"),
      action({ type: "BUY_POTION", bottleId: "physician-potion-3" }, "交付本瓶余款", true, "160便士 · 0行动"),
      action({ type: "RECEIVE_SUPPLY" }, "实际领取下周原瓶", true, "0行动 · 本次公开补给"),
      action({ type: "REQUEST_SUPPLY" }, "申请有限补给", false),
    ];
    const { onCommand } = panel(physician({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) {
      const button = screen.getByRole("button", { name: new RegExp(`^${choice.label}`) });
      expect(button.textContent).toContain(choice.cost); fireEvent.click(button);
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.filter((entry) => entry.enabled).map((entry) => entry.command));
    expect(screen.getByText("本次条件尚未满足。")).toBeTruthy();
  });

  it("selects the actual open case and exposes only its public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(physician({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "unsafe-whisper");
    const value = opened();
    rerender(<PhysicianPanel physician={{ ...value, actions: [action({ type: "CLOSE", caseId: "minor-cut" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "uncertain-fatigue" }, "不得提前报告"), action({ type: "WITHDRAW", caseId: "uncertain-fatigue" }, "不得撤回代替结束"), action({ type: "REFLECT" }, "不得提前反思"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("uncertain-fatigue"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束未明疲乏/ }); expect((close as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "uncertain-fatigue" });
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前照护、实际健康与转介报告" }).textContent).toContain("原因仍未知");
  });

  it("never manufactures an absent CLOSE from public prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "医师成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retries the same failed consumption envelope without duplicate clicks and preserves a consumed failure", async () => {
    const state = fixture(9, { physician: bottled() }); const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const failed = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      physician: { ...state.physician, actions: state.physician.actions.slice(1), bottles: state.physician.bottles.map((bottle) => bottle.id === "physician-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle) } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(failed, envelope));
    api.submitIntent = submit; await enter(api); await openPhysician();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶医师魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "医师服药尚未保存", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("医师服药尚未保存");
    expect((screen.getByRole("button", { name: "确认服用「第一瓶医师魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "PHYSICIAN", command: { type: "CONSUME", bottleId: "physician-potion-1", confirmed: true } });
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("physician-potion-2")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
  });

  it("keeps the dossier open after a successful Physician consumption receipt", async () => {
    const state = fixture(9, { physician: bottled() }); const api = bridge(state);
    const next = fixture(8, { revision: state.revision + 1, physician: physician({
      promoted: true, title: "医师 · 序列8", guidanceKnown: true, actions: [], cases: cases(),
      abilities: [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })),
      bottles: bottled().bottles.map((bottle) => bottle.id === "physician-potion-1" ? { ...bottle, status: "已耗用 · 成功晋升" } : bottle),
    }) });
    api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openPhysician();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶医师魔药」" }));
    expect(await screen.findByRole("region", { name: "医师能力与消化" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByText("已耗用 · 成功晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "PHYSICIAN", command: { type: "CONSUME", bottleId: "physician-potion-1", confirmed: true } });
  });

  it("reloads zero-resource practice and releases navigation only after the exact CLOSE receipt", async () => {
    const state = fixture(8, { physician: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, physician: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "uncertain-fatigue" ? { ...entry, contactOpen: "本次实践已实际结束", closes: 1 } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "医师成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次医师照护");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" }); expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束未明疲乏/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "PHYSICIAN", command: { type: "CLOSE", caseId: "uncertain-fatigue" } });
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy(); expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("preserves an earlier Cultivator exit before a simultaneous Physician practice", async () => {
    const state = fixture(8, { physician: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.cultivator = { ...state.cultivator, insideCase: true, cases: [{ id: "soil-record", title: "原种床", story: "旧照护仍未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "old-close", label: "先结束旧耕种者照护", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "soil-record" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, cultivator: { ...state.cultivator, insideCase: false, actions: [] } }, envelope));
    await enter(api); const close = await screen.findByRole("button", { name: /^先结束旧耕种者照护/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByRole("region", { name: "医师成长下一步" })).toBeNull();
    await userEvent.click(close);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "CULTIVATOR", command: { type: "CLOSE", caseId: "soil-record" } });
    expect(await screen.findByRole("region", { name: "医师成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });

  it("preserves an unrelated earlier Arbiter exit before both Mother-pathway contacts", async () => {
    const state = fixture(8, { physician: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.arbiter = { ...state.arbiter, insideCase: true, cases: [{ id: "shared-yard", title: "原院落", story: "原调解尚未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "arbiter-close", label: "先结束原仲裁人调解", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "shared-yard" } }],
    };
    state.cultivator = { ...state.cultivator, insideCase: true, cases: [{ id: "soil-record", title: "原土记录", story: "原照护尚未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "cultivator-close", label: "再结束原耕种者照护", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "soil-record" } }],
    };
    const afterArbiter = { ...state, revision: state.revision + 1, arbiter: { ...state.arbiter, insideCase: false, actions: [] } };
    const afterCultivator = { ...afterArbiter, revision: state.revision + 2, cultivator: { ...state.cultivator, insideCase: false, actions: [] } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(afterArbiter, envelope))
      .mockImplementationOnce(async (envelope) => receipt(afterCultivator, envelope));
    await enter(api);
    await userEvent.click(await screen.findByRole("button", { name: /^先结束原仲裁人调解/ }));
    expect(screen.queryByRole("region", { name: "医师成长下一步" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: /^再结束原耕种者照护/ }));
    expect(await screen.findByRole("region", { name: "医师成长下一步" })).toBeTruthy();
    expect(vi.mocked(api.submitIntent).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: "ARBITER", command: { type: "CLOSE", caseId: "shared-yard" } },
      { type: "CULTIVATOR", command: { type: "CLOSE", caseId: "soil-record" } },
    ]);
  });

  it("keeps ordinary life available for prepared work and stale contact prose", async () => {
    const value = physician({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "原普通方法准备", result: "原已提交记录", contactOpen: "旧文字说实践尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(8, { physician: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openPhysician(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("does not calculate patient health from a selected method or stale success prose", async () => {
    const value = physician({ promoted: true, clinic: "患者实际健康70/100；敷料0份；尚未转介。", cases: cases().map((entry) => ({ ...entry, result: "原成功记录只供回看。" })), actions: [
      action({ type: "PREPARE", caseId: "minor-cut", method: "ABILITY" }, "准备有限治疗"),
      action({ type: "BUY_KIT" }, "等待库存条件", false, "45便士 · 3份敷料"),
    ] });
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /^准备有限治疗/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PREPARE", caseId: "minor-cut", method: "ABILITY" });
    expect(screen.getByRole("region", { name: "患者健康、敷料与转介记录" }).textContent).toContain("患者实际健康70/100；敷料0份；尚未转介。");
    expect((screen.getByRole("button", { name: /^等待库存条件/ }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<PhysicianPanel physician={{ ...value, clinic: "保存后的实际健康80/100；敷料2份；已转介。" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "患者健康、敷料与转介记录" }).textContent).toContain("保存后的实际健康80/100；敷料2份；已转介。");
  });

});
