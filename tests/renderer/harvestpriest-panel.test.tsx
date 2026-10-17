/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { CULTIVATOR_ABILITIES } from "../../src/domain/cultivator/content";
import { PHYSICIAN_ABILITIES } from "../../src/domain/physician/content";
import { HARVESTPRIEST_ABILITIES, HARVESTPRIEST_CONSUMPTION_RISK, HARVESTPRIEST_FORMULA_STATUS } from "../../src/domain/harvestpriest/content";
import type { HarvestpriestAction, HarvestpriestCommand, HarvestpriestProjection } from "../../src/domain/harvestpriest/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { HarvestpriestPanel } from "../../src/renderer/HarvestpriestPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 60, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: HarvestpriestCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): HarvestpriestAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const guidance = action({ type: "LEARN_GUIDANCE" }, "向伊芙·莫兰了解丰收祭司用药指导", true, "240便士 · 1行动");
function harvestpriest(patch: Partial<HarvestpriestProjection> = {}): HarvestpriestProjection {
  return {
    title: "丰收祭司晋升准备", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "需医师消化100与八个完整序列8周。", pollution: 3,
    risk: HARVESTPRIEST_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", plot: "", ...patch,
  };
}
function bottled(): HarvestpriestProjection {
  return harvestpriest({
    guidanceKnown: true,
    supplies: "三瓶独立丰收祭司成品，原价2010便士；每瓶四次实际劳动抵扣1800便士后210便士，指导240便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；本批用尽后有限补给须申请并到下一周实际领取。",
    actions: ["harvestpriest-potion-1", "harvestpriest-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "harvestpriest-potion-1", title: "第一瓶丰收祭司魔药", source: "伊芙·莫兰独立进阶渠道的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "harvestpriest-potion-1", confirmed: true } },
      { id: "harvestpriest-potion-2", title: "第二瓶丰收祭司魔药", source: "伊芙·莫兰独立进阶渠道的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "harvestpriest-potion-2", confirmed: true } },
      { id: "harvestpriest-potion-3", title: "第三瓶丰收祭司魔药", source: "伊芙·莫兰独立进阶渠道的第三原瓶", status: "指导者保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "harvestpriest-potion-3", confirmed: true } },
    ],
  });
}
function cases(): HarvestpriestProjection["cases"] {
  return [
    { id: "wilting-bed", title: "原植床照护", story: "伊芙许可照料的原菜苗接近采收，仍需实际用水与跨周。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "shared-yield", title: "有限收成分享", story: "仅能交出真实收成中的2份，保留1份。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
    { id: "next-season", title: "下一季计划", story: "记录下一季条件不会提前获得任何粮食。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0 },
  ];
}
function opened(): HarvestpriestProjection {
  return harvestpriest({ title: "丰收祭司 · 序列7", promoted: true, guidanceKnown: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "shared-yield" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次实践尚未实际结束", observations: ["原收成总共3份，实际交出2份，保留1份。"],
      result: "本次实际分享2份，保留1份；须收好工具并实际退出。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "shared-yield" }, "实际结束有限收成分享实践", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: HarvestpriestProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<HarvestpriestPanel harvestpriest={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("harvestpriest-renderer-run", sliceDefaultCreationSelection, "harvestpriest-renderer-seed");
raw.week = 20; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 7 | 8 = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    cultivator: { ...structuredClone(base.cultivator), discovered: true, guidanceKnown: true, promoted: true, acting: 100, actions: [] },
    physician: { ...structuredClone(base.physician), discovered: true, guidanceKnown: true, promoted: true, acting: 100, actions: [] },
    harvestpriest: harvestpriest({ title: sequence === 7 ? "丰收祭司 · 序列7" : "丰收祭司晋升准备", promoted: sequence === 7,
      guidanceKnown: sequence === 7, actions: sequence === 7 ? [] : [guidance],
      abilities: sequence === 7 ? [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES, ...HARVESTPRIEST_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: "mother", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: 12 },
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
async function openHarvestpriest() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.getByRole("button", { name: /^丰收祭司(?:晋升|成长)$/ });
  if (tab.getAttribute("aria-pressed") !== "true") await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Harvestpriest sequence-seven public practice dossier", () => {
  it("keeps twenty-two ordinary routes and adds no independent Harvestpriest starting route", async () => {
    const api = bridge(fixture(8, { progression: { ...base.progression }, cultivator: { ...base.cultivator }, physician: { ...base.physician }, harvestpriest: harvestpriest({ discovered: false, actions: [] }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "耕种者之路" })).toBeTruthy();
    expect(choices.queryByRole("button", { name: /丰收祭司/ })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Physician current growth at S8 and routes completed digestion to Harvestpriest advancement", async () => {
    const reason = "医师消化须达100并度过八个完整序列8周。";
    const api = bridge(fixture(8, { harvestpriest: harvestpriest({ actions: [{ ...guidance, enabled: false, reason }] }) }));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看医师成长" }));
    expect(screen.getByRole("region", { name: "医师成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "丰收祭司成长下一步" }).textContent).toContain("八个完整序列8周");
    const button = screen.getByRole("button", { name: /^向伊芙·莫兰了解丰收祭司/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(new RegExp(reason)).length).toBeGreaterThan(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S7 to Harvestpriest and preserves read-only original Cultivator history", async () => {
    const state = fixture();
    state.cultivator = { ...state.cultivator, garden: "原菜圃：原种子3份，水已用2份，实际收成4份，已交出2份。", cases: [{ id: "seed-bed", title: "原播种照护记录", story: "原土、种子、水、已交付份数与报告仍保留。", status: "RESOLVED", contactOpen: "已实际结束", closes: 2,
      observations: ["原观察"], preparation: "原普通核实准备", result: "原照护失败后实际退出；后来跨周收获并实际交付。" }],
      bottles: [{ id: "cultivator-potion-old", title: "耕种者旧原瓶", source: "原耕种者渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "cultivator-potion-old", confirmed: true } }],
      actions: [{ id: "old-mutation", label: "不得执行旧命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("丰收祭司 · 序列7 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看丰收祭司成长" }));
    expect(screen.getByRole("region", { name: "丰收祭司成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "耕种者经历" }));
    const history = within(screen.getByRole("region", { name: "耕种者时期的经历" }));
    expect(history.getByText(/耕种者扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/实际结束次数：2/)).toBeTruthy();
    expect(history.getByText("来源：原耕种者渠道")).toBeTruthy(); expect(history.getByText("原照护失败后实际退出；后来跨周收获并实际交付。")).toBeTruthy();
    expect(history.getByText("原菜圃：原种子3份，水已用2份，实际收成4份，已交出2份。")).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "丰收祭司成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows seven current abilities and marks exact S7 spells, water and production limits as original G", () => {
    panel(harvestpriest({ promoted: true, cases: cases(), abilities: [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES, ...HARVESTPRIEST_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })) }));
    const abilities = screen.getByRole("region", { name: "丰收祭司能力与消化" });
    expect(abilities.querySelectorAll("details")).toHaveLength(7);
    for (const ability of [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES, ...HARVESTPRIEST_ABILITIES]) expect(within(abilities).getByText(`${ability.label} · 掌握 0`)).toBeTruthy();
    for (const text of ["原ID和掌握", "完整法术表尚未核实", "原创G", "不创造水", "不瞬间制造粮食", "不控制天气", "弗兰克序列6生物学家的杂交改造", "上限60", "不会自动补满"]) expect(abilities.textContent).toContain(text);
    const boundary = screen.getByRole("region", { name: "原植床、有限用水与跨周收成边界" }).textContent;
    for (const text of ["1份水", "失败也保留耗水", "3灵性", "下一周", "3份有限产物", "交出2份、保留1份", "不会新增当前或未来粮食", "30便士", "2份水"]) expect(boundary).toContain(text);
    expect(screen.queryByRole("region", { name: "实际照护、有限产物与原报告" })).toBeNull();
    const summary = screen.getByRole("region", { name: "丰收祭司成长下一步" }).textContent;
    expect(summary).toContain("成年苗圃照料员伊芙·莫兰"); expect(summary).toContain("不会自动加入大地母神教会");
    expect(screen.queryByRole("button", { name: /天气控制|杂交改造|瞬间制造粮食|复活/ })).toBeNull();
  });

  it("renders independent bottle sources and finite public supply terms without fabricating a formula", () => {
    const value = { ...bottled(), supplies: HARVESTPRIEST_FORMULA_STATUS + bottled().supplies }; panel({ ...value, formula: [{ name: "不得呈现的未核材料", quantity: 1, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    expect(screen.getByRole("region", { name: "丰收祭司成品渠道与配方边界" }).textContent).toContain(HARVESTPRIEST_FORMULA_STATUS);
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "丰收祭司成品渠道与配方边界" }).textContent).toContain("完整配方尚未核实");
    expect(screen.queryByText("不得呈现的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels at zero AP, restores focus and confirms only the selected original once", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶丰收祭司魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("harvestpriest-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "丰收祭司服用风险与四档结果" }).textContent).toContain(HARVESTPRIEST_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 60", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶丰收祭司魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "harvestpriest-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("honors changed public eligibility and invalidates a removed bottle confirmation", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "尚未度过八个完整序列8周。";
    rerender(<HarvestpriestPanel harvestpriest={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶丰收祭司魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); fireEvent.click(confirm);
    rerender(<HarvestpriestPanel harvestpriest={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves case selection and binds only the public ABILITY and ORDINARY preparation commands", async () => {
    const choices = (["ABILITY", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "next-season", method }, `准备${method}`));
    const value = harvestpriest({ promoted: true, cases: cases(), actions: choices }); const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "next-season");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    rerender(<HarvestpriestPanel harvestpriest={{ ...value, actions: [action({ type: "OBSERVE", caseId: "wilting-bed" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("next-season");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
  });

  it("sends public practice and acquisition commands unchanged and preserves their costs and reasons", async () => {
    const choices = [
      action({ type: "OBSERVE", caseId: "wilting-bed" }, "观察原植床照护"),
      action({ type: "PERFORM", caseId: "wilting-bed" }, "执行已准备的方法", true, "1行动 · 能力方法3灵性"),
      action({ type: "REPORT", caseId: "wilting-bed" }, "提交有限报告"),
      action({ type: "WITHDRAW", caseId: "wilting-bed" }, "撤回尚未执行的准备", true, "0行动"),
      action({ type: "REFLECT" }, "按原记录反思"),
      action({ type: "BUY_WATER" }, "实际购买2份水", true, "30便士 · 0行动 · 水库存为0"),
      action({ type: "HARVEST" }, "收获原植床的3份产物", true, "1行动 · 跨周后一次性实际收成"),
      action({ type: "POTION_WORK", bottleId: "harvestpriest-potion-3" }, "完成本瓶第四次劳动", true, "1行动 · 劳动3/4→4/4 · 本瓶累计抵扣1800便士"),
      action({ type: "BUY_POTION", bottleId: "harvestpriest-potion-3" }, "交付本瓶余款", true, "210便士 · 0行动"),
      action({ type: "RECEIVE_SUPPLY" }, "实际领取下周原瓶", true, "0行动 · 本次公开补给"),
      action({ type: "REQUEST_SUPPLY" }, "申请有限补给", false),
    ];
    const { onCommand } = panel(harvestpriest({ promoted: true, cases: cases(), actions: choices }));
    for (const choice of choices) {
      const button = screen.getByRole("button", { name: new RegExp(`^${choice.label}`) });
      expect(button.textContent).toContain(choice.cost); fireEvent.click(button);
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.filter((entry) => entry.enabled).map((entry) => entry.command));
    expect(screen.getByText("本次条件尚未满足。")).toBeTruthy();
  });

  it("selects the actual open case and exposes only its public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(harvestpriest({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "next-season");
    const value = opened();
    rerender(<HarvestpriestPanel harvestpriest={{ ...value, actions: [action({ type: "CLOSE", caseId: "wilting-bed" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "shared-yield" }, "不得提前报告"), action({ type: "WITHDRAW", caseId: "shared-yield" }, "不得撤回代替结束"), action({ type: "REFLECT" }, "不得提前反思"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("shared-yield"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束有限收成分享/ }); expect((close as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "shared-yield" });
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "实际照护、有限产物与原报告" }).textContent).toContain("实际分享2份");
  });

  it("never manufactures an absent CLOSE from public prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "丰收祭司成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retries the same failed consumption envelope without duplicate clicks and preserves a consumed failure", async () => {
    const state = fixture(8, { harvestpriest: bottled() }); const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const failed = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      harvestpriest: { ...state.harvestpriest, actions: state.harvestpriest.actions.slice(1), bottles: state.harvestpriest.bottles.map((bottle) => bottle.id === "harvestpriest-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle) } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(failed, envelope));
    api.submitIntent = submit; await enter(api); await openHarvestpriest();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶丰收祭司魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "丰收祭司服药尚未保存", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("丰收祭司服药尚未保存");
    expect((screen.getByRole("button", { name: "确认服用「第一瓶丰收祭司魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "HARVESTPRIEST", command: { type: "CONSUME", bottleId: "harvestpriest-potion-1", confirmed: true } });
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("harvestpriest-potion-2")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
  });

  it("keeps the dossier open after a successful Harvestpriest consumption receipt", async () => {
    const state = fixture(8, { harvestpriest: bottled() }); const api = bridge(state);
    const next = fixture(7, { revision: state.revision + 1, harvestpriest: harvestpriest({
      promoted: true, title: "丰收祭司 · 序列7", guidanceKnown: true, actions: [], cases: cases(),
      abilities: [...CULTIVATOR_ABILITIES, ...PHYSICIAN_ABILITIES, ...HARVESTPRIEST_ABILITIES].map((ability) => ({ ...ability, mastery: 0 })),
      bottles: bottled().bottles.map((bottle) => bottle.id === "harvestpriest-potion-1" ? { ...bottle, status: "已耗用 · 成功晋升" } : bottle),
    }) });
    api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openHarvestpriest();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶丰收祭司魔药」" }));
    expect(await screen.findByRole("region", { name: "丰收祭司能力与消化" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByText("已耗用 · 成功晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "HARVESTPRIEST", command: { type: "CONSUME", bottleId: "harvestpriest-potion-1", confirmed: true } });
  });

  it("reloads zero-resource practice and releases navigation only after the exact CLOSE receipt", async () => {
    const state = fixture(7, { harvestpriest: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, harvestpriest: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "shared-yield" ? { ...entry, contactOpen: "本次实践已实际结束", closes: 1 } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "丰收祭司成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次丰收祭司照护");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" }); expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束有限收成分享/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "HARVESTPRIEST", command: { type: "CLOSE", caseId: "shared-yield" } });
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy(); expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("preserves an earlier Cultivator exit before a simultaneous Harvestpriest practice", async () => {
    const state = fixture(7, { harvestpriest: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.cultivator = { ...state.cultivator, insideCase: true, cases: [{ id: "seed-bed", title: "原播种菜圃", story: "旧照护仍未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "old-close", label: "先结束旧耕种者照护", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "seed-bed" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt({ ...state, revision: state.revision + 1, cultivator: { ...state.cultivator, insideCase: false, actions: [] } }, envelope));
    await enter(api); const close = await screen.findByRole("button", { name: /^先结束旧耕种者照护/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByRole("region", { name: "丰收祭司成长下一步" })).toBeNull();
    await userEvent.click(close);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "CULTIVATOR", command: { type: "CLOSE", caseId: "seed-bed" } });
    expect(await screen.findByRole("region", { name: "丰收祭司成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });


  it("preserves the original Physician records and mastery in read-only S8 history", async () => {
    const state = fixture();
    state.physician = { ...state.physician, clinic: "原诊所：成年患者健康78，剩余2份敷料、已用1份，原危险耳语已转介。", story: "原医师供给与实际敷料消耗沿原记录保存。", cases: [{ id: "minor-cut", title: "原轻微伤口照护", story: "原患者实际健康与用过的敷料继续保留。", status: "RESOLVED", contactOpen: "已实际结束", closes: 3,
      observations: ["原普通方法核对记录"], preparation: "原普通方法准备", result: "原伤口改善、健康78；用过的1份敷料未退还。" }],
      bottles: [{ id: "physician-potion-old", title: "医师旧原瓶", source: "原医师独立渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "physician-potion-old", confirmed: true } }],
      abilities: PHYSICIAN_ABILITIES.map((ability) => ({ ...ability, mastery: 35 })),
      actions: [{ id: "old-physician-mutation", label: "不得执行旧医师命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api); await openHarvestpriest();
    await userEvent.click(screen.getByRole("button", { name: "医师经历" }));
    const history = within(screen.getByRole("region", { name: "医师时期的经历" }));
    expect(history.getByText(/医师扮演进度 100/)).toBeTruthy();
    expect(history.getByText(/实际结束次数：3/)).toBeTruthy();
    expect(history.getByText("来源：原医师独立渠道")).toBeTruthy();
    expect(history.getByText("原伤口改善、健康78；用过的1份敷料未退还。")).toBeTruthy();
    expect(history.getByText("原诊所：成年患者健康78，剩余2份敷料、已用1份，原危险耳语已转介。")).toBeTruthy();
    for (const ability of PHYSICIAN_ABILITIES) expect(history.getByText(`${ability.label} · 掌握 35：${ability.description}`)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("closes inherited Cultivator then Physician contact before the current Harvestpriest contact", async () => {
    const state = fixture(7, { harvestpriest: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.cultivator = { ...state.cultivator, insideCase: true, cases: [{ id: "seed-bed", title: "原耕种者照护", story: "原耕种者照护尚未结束。", observations: [], preparation: null, result: "原结果", status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "cultivator-close", label: "实际结束最早的菜圃照护", cost: "0行动 · 0精神 · 0灵性", enabled: true, reason: null, command: { type: "CLOSE", caseId: "seed-bed" } }],
    };
    state.physician = { ...state.physician, insideCase: true, cases: [{ id: "minor-cut", title: "原医师实践", story: "原照护须实际结束。", observations: [], preparation: null, result: "原结果", status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "physician-close", label: "实际结束后来的医师实践", cost: "0行动 · 0精神 · 0灵性", enabled: true, reason: null, command: { type: "CLOSE", caseId: "minor-cut" } }],
    };
    const second: SliceProjection = { ...state, revision: state.revision + 1, cultivator: { ...state.cultivator, insideCase: false, actions: [] } };
    const third: SliceProjection = { ...second, revision: second.revision + 1, physician: { ...state.physician, insideCase: false, actions: [] } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(second, envelope))
      .mockImplementationOnce(async (envelope) => receipt(third, envelope));
    await enter(api);
    const firstClose = await screen.findByRole("button", { name: /^实际结束最早的菜圃照护/ });
    expect((firstClose as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "医师成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "丰收祭司成长下一步" })).toBeNull();
    await userEvent.click(firstClose);
    const secondClose = await screen.findByRole("button", { name: /^实际结束后来的医师实践/ });
    expect((secondClose as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "医师时期的经历" })).toBeNull();
    expect(screen.queryByRole("region", { name: "丰收祭司成长下一步" })).toBeNull();
    await userEvent.click(secondClose);
    expect(await screen.findByRole("region", { name: "丰收祭司成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(vi.mocked(api.submitIntent).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: "CULTIVATOR", command: { type: "CLOSE", caseId: "seed-bed" } },
      { type: "PHYSICIAN", command: { type: "CLOSE", caseId: "minor-cut" } },
    ]);
  });

  it("renders original plot facts without predicting a harvest or creating absent production controls", () => {
    const plot = "原六株菜苗：用水1份，剩余1份；第20周已成功照护，尚未跨周，实有产物0份，已交付0份。";
    const harvest = { ...action({ type: "HARVEST" }, "实际收获原植床", false, "1行动 · 原收成3份"), reason: "成功照护后至少等下一真实周。" };
    const value = harvestpriest({ promoted: true, cases: cases(), plot, actions: [harvest] });
    const { onCommand, rerender } = panel(value);
    expect(screen.getByRole("region", { name: "原植床与实际收成" }).textContent).toContain(plot);
    const button = screen.getByRole("button", { name: /^实际收获原植床/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText("成功照护后至少等下一真实周。").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /购买.*水/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
    rerender(<HarvestpriestPanel harvestpriest={{ ...value, plot: "原植床已采收一次，实有1份，已交付2份；下一季计划已记录，没有新增粮食。", actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "原植床与实际收成" }).textContent).toContain("实有1份，已交付2份");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("preserves paid failed care until the exact close receipt and does not render future food", async () => {
    const care = cases()[0]!;
    const perform = action({ type: "PERFORM", caseId: care.id }, "执行原菜苗能力照护", true, "1行动 · 1份实际水 · 3灵性");
    const value = harvestpriest({ promoted: true, cases: [{ ...care, status: "PREPARED", preparation: "原菜苗有限能力照护" }], plot: "原水1份，实有产物0份。", actions: [perform] });
    const { onCommand, rerender } = panel(value);
    const button = screen.getByRole("button", { name: /^执行原菜苗能力照护/ });
    expect(button.textContent).toContain(perform.cost); await userEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(perform.command);
    expect(screen.getByRole("region", { name: "原植床与实际收成" }).textContent).toContain("原水1份，实有产物0份。");
    expect(screen.queryByRole("region", { name: "实际照护、有限产物与原报告" })).toBeNull();
    const close = action({ type: "CLOSE", caseId: care.id }, "结束本次失败照护", true, "0行动 · 0精神 · 0灵性");
    rerender(<HarvestpriestPanel harvestpriest={{ ...value, insideCase: true, actions: [close, action({ type: "BUY_WATER" }, "接触中不得补水"), action({ type: "HARVEST" }, "接触中不得收获")], plot: "原水已用1份，剩余0份；照护失败，原苗未改善，实有产物0份。", cases: [{ ...care, status: "EXAMINED", contactOpen: "尚未实际结束", result: "照护失败；实际耗水1份与3灵性继续保留，没有收成。" }] }}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByRole("region", { name: "实际照护、有限产物与原报告" }).textContent).toContain("实际耗水1份与3灵性继续保留");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /^结束本次失败照护/ }));
    expect(onCommand).toHaveBeenLastCalledWith(close.command);
    expect(screen.getByRole("region", { name: "原植床与实际收成" }).textContent).toContain("照护失败，原苗未改善，实有产物0份");
  });

  it("keeps ordinary life available for prepared work and stale contact prose", async () => {
    const value = harvestpriest({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "原普通方法准备", result: "原已提交记录", contactOpen: "旧文字说实践尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(7, { harvestpriest: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openHarvestpriest(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
