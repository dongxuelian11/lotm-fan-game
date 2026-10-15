/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { LUCKY_ABILITIES, LUCKY_CONSUMPTION_RISK } from "../../src/domain/lucky/content";
import type { LuckyAction, LuckyCommand, LuckyProjection } from "../../src/domain/lucky/types";
import type { SliceCombatRound, SliceProjection } from "../../src/domain/slice/types";
import { LuckyPanel } from "../../src/renderer/LuckyPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 45, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: LuckyCommand, label = "本次公开行动", enabled = true, cost = "1行动 · 本次公开成本"): LuckyAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
const guidance = action({ type: "LEARN_GUIDANCE" }, "向艾妲·芬恩了解幸运者用药指导", true, "240便士 · 1行动");
function lucky(patch: Partial<LuckyProjection> = {}): LuckyProjection {
  return {
    title: "幸运者晋升准备", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "需机器消化100与八个完整序列8周。", pollution: 3,
    risk: LUCKY_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): LuckyProjection {
  return lucky({
    guidanceKnown: true,
    supplies: "三瓶独立幸运者成品，原价2010便士；每瓶四次实际劳动后210便士，指导240便士并用1行动。供应方剩余1瓶，持有未服原瓶2瓶；本批用尽后有限补给须申请并到下一周实际领取。",
    actions: ["lucky-potion-1", "lucky-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这瓶魔药")),
    bottles: [
      { id: "lucky-potion-1", title: "第一瓶幸运者魔药", source: "艾妲·芬恩独立进阶渠道的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "lucky-potion-1", confirmed: true } },
      { id: "lucky-potion-2", title: "第二瓶幸运者魔药", source: "艾妲·芬恩独立进阶渠道的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "lucky-potion-2", confirmed: true } },
      { id: "lucky-potion-3", title: "第三瓶幸运者魔药", source: "艾妲·芬恩独立进阶渠道的第三原瓶", status: "指导者保管 · 劳动0/4", chance: 43, command: { type: "CONSUME", bottleId: "lucky-potion-3", confirmed: true } },
    ],
  });
}
function cases(): LuckyProjection["cases"] {
  return [
    { id: "next-carriage", title: "下一班车", story: "已错过原班车，只能核实下一班车。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0, luck: "" },
    { id: "loose-receipt", title: "原回执", story: "原回执LU7-RECEIPT-01属于艾妲，记录后仍须交还。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0, luck: "" },
    { id: "closed-path", title: "封闭小路", story: "小路已封闭且看守拒绝通行，只能核实普通绕行。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "本次尚未实际开始", closes: 0, luck: "" },
  ];
}
function opened(): LuckyProjection {
  return lucky({ title: "幸运者 · 序列7", promoted: true, guidanceKnown: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "loose-receipt" ? {
      ...entry, status: "EXAMINED", contactOpen: "本次实践尚未实际结束", observations: ["原回执编号与原主人已经核实。"],
      result: "原回执已记录，仍须实际交还艾妲；本次普通核实继续保留。", luck: "本次没有得到偶然帮助。",
    } : entry),
    actions: [action({ type: "CLOSE", caseId: "loose-receipt" }, "实际结束原回执实践", true, "0行动 · 0精神 · 0灵性 · 不退款、不治疗")],
  });
}
function panel(value: LuckyProjection, onCommand = vi.fn(), current = resources) {
  return { onCommand, ...render(<LuckyPanel lucky={value} resources={current} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("lucky-renderer-run", sliceDefaultCreationSelection, "lucky-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 7 | 8 | null = 7, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), canAct: true, actionBlockedReason: null,
    monster: { ...structuredClone(base.monster), discovered: sequence !== null, guidanceKnown: true, promoted: sequence !== null, acting: 100, actions: [] },
    machine: { ...structuredClone(base.machine), title: "机器 · 序列8", discovered: sequence !== null, guidanceKnown: true, promoted: sequence !== null, acting: 100, actions: [] },
    lucky: lucky({ title: sequence === 7 ? "幸运者 · 序列7" : "幸运者晋升准备", promoted: sequence === 7,
      guidanceKnown: sequence === 7, actions: sequence === 7 ? [] : [guidance],
      abilities: sequence === 7 ? LUCKY_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    progression: { pathwayId: sequence === null ? null : "wheel", sequence, mastery: {}, acting: sequence === 8 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
async function openLucky() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  const tab = screen.getByRole("button", { name: /^幸运者(?:晋升|成长)$/ });
  if (tab.getAttribute("aria-pressed") !== "true") await userEvent.click(tab);
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Lucky sequence-seven public practice dossier", () => {
  it("keeps nineteen ordinary routes without a Lucky starting shortcut", async () => {
    const api = bridge(fixture(null, { lucky: lucky({ discovered: false, actions: [] }) }));
    await enter(api); await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "怪物之路" })).toBeTruthy();
    expect(choices.queryByRole("button", { name: /幸运者|机器/ })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps Machine current at S8 and routes completed digestion to Lucky advancement", async () => {
    const reason = "机器消化须达100并度过八个完整序列8周。";
    const api = bridge(fixture(8, { lucky: lucky({ actions: [{ ...guidance, enabled: false, reason }] }) }));
    await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列7晋升");
    await userEvent.click(screen.getByRole("button", { name: "查看机器成长" }));
    expect(screen.getByRole("region", { name: "机器成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "幸运者成长下一步" }).textContent).toContain("八个完整序列8周");
    const button = screen.getByRole("button", { name: /^向艾妲·芬恩了解幸运者/ });
    expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    expect(screen.getAllByText(new RegExp(reason)).length).toBeGreaterThan(0); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S7 to Lucky and preserves both original read-only histories", async () => {
    const state = fixture();
    state.monster = { ...state.monster, cases: [{ id: "wrong-shadow", title: "原影子记录", story: "原片段仍有限。", status: "RESOLVED", contactOpen: "已实际结束", closes: 2, overclaims: 1,
      observations: ["原观察"], preparation: "原普通核实准备", result: "曾错误报告，后实际修正。" }],
      bottles: [{ id: "monster-potion-old", title: "怪物旧原瓶", source: "原怪物渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "monster-potion-old", confirmed: true } }],
      actions: [{ id: "old-mutation", label: "不得执行怪物旧命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    state.machine = { ...state.machine, cases: [{ id: "steady-pointer", title: "原指针记录", story: "估计仍须实测。", status: "RESOLVED", contactOpen: "已实际结束", closes: 3,
      observations: ["原刻度观察"], preparation: "原普通方法", result: "原估计与失败实测仍保留。" }],
      bottles: [{ id: "machine-potion-old", title: "机器旧原瓶", source: "原机器渠道", status: "已耗用 · 失败", chance: 0, command: { type: "CONSUME", bottleId: "machine-potion-old", confirmed: true } }],
      actions: [{ id: "old-mutation", label: "不得执行机器旧命令", cost: "0行动", enabled: true, reason: null, command: { type: "REFLECT" } }],
    };
    const api = bridge(state); await enter(api);
    expect(screen.getByText("幸运者 · 序列7 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看幸运者成长" }));
    expect(screen.getByRole("region", { name: "幸运者成长下一步" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "怪物经历" }));
    const monster = within(screen.getByRole("region", { name: "怪物时期的经历" }));
    expect(monster.getByText(/实际结束次数：2 · 过度断言记录：1/)).toBeTruthy();
    expect(monster.getByText("来源：原怪物渠道")).toBeTruthy(); expect(monster.getByText("曾错误报告，后实际修正。")).toBeTruthy();
    expect(monster.queryByRole("button")).toBeNull(); expect(monster.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "机器经历" }));
    const machine = within(screen.getByRole("region", { name: "机器时期的经历" }));
    expect(machine.getByText(/实际结束次数：3/)).toBeTruthy(); expect(machine.getByText("来源：原机器渠道")).toBeTruthy();
    expect(machine.getByText("原估计与失败实测仍保留。")).toBeTruthy();
    expect(machine.queryByRole("button")).toBeNull(); expect(machine.queryByRole("combobox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "幸运者成长下一步" })).toBeTruthy(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows passive fluctuating luck only from committed facts and preserves real limits", () => {
    const value = lucky({ promoted: true, cases: cases(), abilities: LUCKY_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) });
    const { rerender, onCommand } = panel(value);
    const abilities = screen.getByRole("region", { name: "幸运者能力与消化" });
    expect(within(abilities).getByText("被动幸运 · 掌握 0")).toBeTruthy();
    for (const text of ["被动", "不可控制", "波动", "可能没有帮助", "固定等量厄运债"]) expect(abilities.textContent).toContain(text);
    const boundary = screen.getByRole("region", { name: "准备、偶然帮助与现实边界" }).textContent;
    for (const text of ["不保证成功", "封闭路线", "他人的拒绝", "原回执始终属于原主人", "实际结束时须交还"]) expect(boundary).toContain(text);
    expect(screen.queryByLabelText("本次被动幸运记录")).toBeNull();
    rerender(<LuckyPanel lucky={{ ...value, cases: value.cases.map((entry) => ({ ...entry, luck: "本次得到偶然帮助；仍须核实原路线。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByLabelText("本次被动幸运记录").textContent).toBe("本次得到偶然帮助；仍须核实原路线。");
    rerender(<LuckyPanel lucky={{ ...value, cases: value.cases.map((entry) => ({ ...entry, luck: "本次没有得到偶然帮助。" })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByLabelText("本次被动幸运记录").textContent).toBe("本次没有得到偶然帮助。");
    expect(screen.queryByRole("button", { name: /发动幸运|重掷|储存幸运|幸运池/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("renders independent bottle sources and finite public supply terms without fabricating a formula", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "不得呈现的未核材料", quantity: 1, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "幸运者成品渠道与配方边界" }).textContent).toContain("当前渠道只提供成品魔药，不提供完整配方");
    expect(screen.queryByText("不得呈现的未核材料")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels at zero AP, restores focus and confirms only the selected original once", async () => {
    const { onCommand } = panel(bottled());
    screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }).focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶幸运者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("lucky-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "幸运者服用风险与四档结果" }).textContent).toContain(LUCKY_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 45", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶幸运者魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "lucky-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("honors changed public eligibility and invalidates a removed bottle confirmation", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "尚未度过八个完整序列8周。";
    rerender(<LuckyPanel lucky={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶幸运者魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(reason)).toBeTruthy(); fireEvent.click(confirm);
    rerender(<LuckyPanel lucky={{ ...value, actions: value.actions.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("preserves selected practice and sends public preparation, report and supply commands unchanged", async () => {
    const choices = [
      ...(["CAREFUL", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "closed-path", method }, `准备${method}`)),
      action({ type: "OBSERVE", caseId: "closed-path" }, "观察封闭小路"),
      action({ type: "PERFORM", caseId: "closed-path" }, "执行已准备的方法"),
      action({ type: "REPORT", caseId: "closed-path" }, "提交有限报告"),
      action({ type: "WITHDRAW", caseId: "closed-path" }, "撤回尚未执行的准备", true, "0行动"),
      action({ type: "REFLECT" }, "按原记录反思"),
      action({ type: "POTION_WORK", bottleId: "lucky-potion-3" }, "完成本瓶劳动"),
      action({ type: "REQUEST_SUPPLY" }, "申请有限补给", false),
    ];
    const value = lucky({ promoted: true, cases: cases(), actions: choices }); const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前实践" }), "closed-path");
    for (const choice of choices) {
      const button = screen.getByRole("button", { name: new RegExp(`^${choice.label}`) });
      expect(button.textContent).toContain(choice.cost); fireEvent.click(button);
    }
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.filter((entry) => entry.enabled).map((entry) => entry.command));
    expect(screen.getByText("本次条件尚未满足。")).toBeTruthy();
    rerender(<LuckyPanel lucky={{ ...value, actions: [action({ type: "OBSERVE", caseId: "next-carriage" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("closed-path");
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.getByRole("region", { name: "实际观察记录" }).textContent).toContain("本次行动结果仍未知");
  });


  it("selects the actual open case and exposes only its public CLOSE at zero AP, mind and spirituality", async () => {
    const { onCommand, rerender } = panel(lucky({ promoted: true, cases: cases(), actions: [] }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "closed-path");
    const value = opened();
    rerender(<LuckyPanel lucky={{ ...value, actions: [action({ type: "CLOSE", caseId: "next-carriage" }, "旧记录不可结束", false), ...value.actions,
      action({ type: "REPORT", caseId: "loose-receipt" }, "不得提前报告"), action({ type: "WITHDRAW", caseId: "loose-receipt" }, "不得撤回代替结束"), action({ type: "REFLECT" }, "不得提前反思"),
    ] }} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox") as HTMLSelectElement;
    expect(selector.value).toBe("loose-receipt"); expect(selector.disabled).toBe(true);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const close = screen.getByRole("button", { name: /^实际结束原回执/ }); expect((close as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(close); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CLOSE", caseId: "loose-receipt" });
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    expect(screen.getByRole("region", { name: "本次实际结果与有限报告" }).textContent).toContain("仍须实际交还艾妲");
  });

  it("never manufactures an absent CLOSE from public prose", () => {
    const { onCommand } = panel({ ...opened(), actions: [] });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("region", { name: "幸运者成长下一步" }).textContent).toContain("查看当前公开结束选项");
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retries the same failed consumption envelope without duplicate clicks and preserves a consumed failure", async () => {
    const state = fixture(8, { lucky: bottled() }); const api = bridge(state);
    let finish!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finish = resolve; });
    const failed = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      lucky: { ...state.lucky, actions: state.lucky.actions.slice(1), bottles: state.lucky.bottles.map((bottle) => bottle.id === "lucky-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle) } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(failed, envelope));
    api.submitIntent = submit; await enter(api); await openLucky();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶幸运者魔药」" }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: false, error: { code: "SAVE_FAILED", message: "幸运者服药尚未保存", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("幸运者服药尚未保存");
    expect((screen.getByRole("button", { name: "确认服用「第一瓶幸运者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "LUCKY", command: { type: "CONSUME", bottleId: "lucky-potion-1", confirmed: true } });
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("lucky-potion-2")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
  });

  it("reloads zero-resource practice and releases navigation only after the exact CLOSE receipt", async () => {
    const state = fixture(7, { lucky: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, lucky: { ...opened(), insideCase: false, actions: [],
      cases: opened().cases.map((entry) => entry.id === "loose-receipt" ? { ...entry, contactOpen: "本次实践已实际结束", closes: 1, result: "原回执LU7-RECEIPT-01已实际交还艾妲；原结果与无帮助记录保留。" } : entry),
    } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "结束尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "幸运者成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际结束本次幸运者实践");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    const title = screen.getByRole("button", { name: "返回标题" }); expect((title as HTMLButtonElement).disabled).toBe(true); fireEvent.click(title);
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(api.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^实际结束原回执/ }));
    expect(screen.getByRole("alert").textContent).toContain("结束尚未保存");
    expect(screen.getByText("本次实践：本次实践尚未实际结束")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "LUCKY", command: { type: "CLOSE", caseId: "loose-receipt" } });
    expect(screen.getByText("本次实践：本次实践已实际结束")).toBeTruthy(); expect(screen.getByText("实际结束次数：1")).toBeTruthy();
    expect(screen.getByText("原回执LU7-RECEIPT-01已实际交还艾妲；原结果与无帮助记录保留。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("preserves actual Monster and Machine exits before the Lucky receipt return", async () => {
    const state = fixture(7, { lucky: opened(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.monster = { ...state.monster, insideCase: true, cases: [{ id: "wrong-shadow", title: "原影子", story: "旧观察仍未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0, overclaims: 0 }],
      actions: [{ id: "old-close", label: "先结束旧怪物观察", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "wrong-shadow" } }],
    };
    state.machine = { ...state.machine, insideCase: true, cases: [{ id: "steady-pointer", title: "原指针", story: "旧测量仍未结束。", observations: [], preparation: null, result: null, status: "EXAMINED", contactOpen: "尚未结束", closes: 0 }],
      actions: [{ id: "old-machine-close", label: "再结束旧机器实践", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "steady-pointer" } }],
    };
    const monsterClosed = { ...state, revision: state.revision + 1, monster: { ...state.monster, insideCase: false, actions: [] } };
    const machineClosed = { ...monsterClosed, revision: state.revision + 2, machine: { ...state.machine, insideCase: false, actions: [] } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(monsterClosed, envelope))
      .mockImplementationOnce(async (envelope) => receipt(machineClosed, envelope));
    await enter(api); const close = await screen.findByRole("button", { name: /^先结束旧怪物观察/ });
    expect((close as HTMLButtonElement).disabled).toBe(false); expect(screen.queryByRole("region", { name: "幸运者成长下一步" })).toBeNull();
    await userEvent.click(close);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "MONSTER", command: { type: "CLOSE", caseId: "wrong-shadow" } });
    await userEvent.click(await screen.findByRole("button", { name: /^再结束旧机器实践/ }));
    expect(vi.mocked(api.submitIntent).mock.calls[1]![0].payload).toEqual({ type: "MACHINE", command: { type: "CLOSE", caseId: "steady-pointer" } });
    expect(await screen.findByRole("region", { name: "幸运者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
  });

  it("keeps ordinary life available for prepared work and stale contact prose", async () => {
    const value = lucky({ promoted: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "原普通方法准备", result: "原已提交记录", contactOpen: "旧文字说实践尚未结束", closes: 1 })), insideCase: false, actions: [] });
    const api = bridge(fixture(7, { lucky: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openLucky(); expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
  it("adds no combat choice and displays committed passive help, no-help, injury and death", async () => {
    const battle: NonNullable<SliceProjection["combat"]> = { title: "原现场冲突", round: 1, enemyName: "持棍的对手", enemyHealth: 100, enemyStatus: "RESISTING",
      playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [], consequenceWeights: { light: 65, heavy: 30, death: 5 },
      stances: [{ id: "ATTACK", label: "进攻", description: "公开进攻姿态" }, { id: "DEFEND", label: "防守", description: "公开防守姿态" }, { id: "RETREAT", label: "撤退", description: "公开撤退姿态" }], lastRound: null };
    const state = fixture(7, { combat: battle, canAct: false });
    const helped: SliceCombatRound = { round: 1, stance: "ATTACK", first: "PLAYER", playerCount: 1, enemyCount: 2, playerCountRoll: 20, enemyCountRoll: 70,
      moves: [], playerAdvantage: 5, enemyAdvantage: 12, winChance: 35, winner: "ENEMY", consequence: "虽然得到偶然帮助，仍实际受重伤。", consequenceWeights: { light: 65, heavy: 30, death: 5 }, retreat: "NONE",
      passiveLuck: { roll: 12, triggered: true, bonus: 5 } };
    const noHelp: SliceCombatRound = { ...helped, round: 2, playerAdvantage: 0, consequence: "本次实际死亡，原重伤记录保留。", passiveLuck: { roll: 88, triggered: false, bonus: 0 } };
    const wounded: SliceProjection = { ...state, revision: state.revision + 1, health: 35, injuries: [{ id: "original-wound", severity: "HEAVY", acquiredRevision: state.revision + 1, treatedRevision: null }],
      combat: { ...battle, round: 2, lastRound: helped }, lastCombatRound: helped, combatHistory: [helped] };
    const dead: SliceProjection = { ...wounded, revision: state.revision + 2, status: "DEAD", health: 0, combat: null, lastCombatRound: noHelp, combatHistory: [helped, noHelp],
      ending: { kind: "DEATH", title: "原现场死亡封存", summary: "本次实际死亡，原重伤记录保留。", workers: "原记录", accountability: "原记录", hazard: "原记录", relationship: "原记录" } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockImplementationOnce(async (envelope) => receipt(wounded, envelope)).mockImplementationOnce(async (envelope) => receipt(dead, envelope));
    await enter(api); expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: /发动幸运|重掷|储存幸运|幸运池/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "确认姿态，结算完整回合" }));
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "COMBAT_ROUND", stance: "ATTACK" });
    expect(screen.getByLabelText("本回合被动幸运记录").textContent).toContain("掷骰 12 · 本次得到偶然帮助 · 已结算优势 +5");
    expect(screen.getByText(helped.consequence)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "进入下一回合" }));
    expect(screen.getByText("健康 35 / 100")).toBeTruthy(); expect(screen.getAllByText("普通伤势 1处").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "确认姿态，结算完整回合" }));
    expect(screen.getByLabelText("本回合被动幸运记录").textContent).toContain("掷骰 88 · 本次没有帮上忙 · 已结算优势 +0");
    expect(screen.getAllByText(noHelp.consequence).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "查看收尾卷宗" }));
    expect(screen.getByRole("heading", { name: "原现场死亡封存" })).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(2);
  });

});
