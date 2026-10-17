/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { HUNTER_ABILITIES } from "../../src/domain/hunter/content";
import { PROVOKER_ABILITIES } from "../../src/domain/provoker/content";
import type { ProvokerAction, ProvokerCommand, ProvokerProjection } from "../../src/domain/provoker/types";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ProvokerPanel } from "../../src/renderer/ProvokerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 45, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const risk = "领域四档原文：大成功晋升、精神−5；成功晋升、精神−10；失败健康−10；灾难健康−20。所选原瓶消耗。";
const guidance: ProvokerAction = {
  id: "guidance", label: "了解挑衅者服药指导", cost: "1行动 · 180便士", enabled: true,
  reason: null, command: { type: "LEARN_GUIDANCE" },
};
function provoker(patch: Partial<ProvokerProjection> = {}): ProvokerProjection {
  return {
    title: "挑衅者之路", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "完整配方待核，只接受有来源的独立成品药。",
    cases: [], actions: [guidance], bottles: [], abilities: [],
    acting: 0, digestion: "猎人消化100/100，成熟4/6整周。", pollution: 3, risk, ...patch,
  };
}
function bottled(): ProvokerProjection {
  return provoker({
    guidanceKnown: true,
    actions: ["provoker-potion-1", "provoker-potion-2"].map((id) => ({
      id: `consume-${id}`, label: `服用${id}`, cost: "0行动 · 独立确认 · 消耗这瓶魔药", enabled: true,
      reason: null, command: { type: "CONSUME", bottleId: id, confirmed: true },
    })),
    bottles: [
      { id: "provoker-potion-1", title: "第一瓶挑衅者魔药", source: "新货源的第一原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "provoker-potion-1", confirmed: true } },
      { id: "provoker-potion-2", title: "第二瓶挑衅者魔药", source: "新货源的第二原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "provoker-potion-2", confirmed: true } },
      { id: "provoker-potion-3", title: "第三瓶挑衅者魔药", source: "新货源的第三原瓶", status: "供应方保管", chance: 43, command: { type: "CONSUME", bottleId: "provoker-potion-3", confirmed: true } },
    ],
  });
}
function panel(value: ProvokerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ProvokerPanel provoker={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: 8 | 9 = 8, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("provoker-renderer-run", sliceDefaultCreationSelection, "provoker-renderer-seed");
  raw.week = 12;
  raw.activeEvent = null;
  raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    hunter: {
      ...state.hunter, discovered: true, guidanceKnown: true, promoted: true, title: "猎人 · 序列9经历",
      actions: [], acting: 100, digestion: "晋升时猎人消化100/100已保留。",
      bottles: [{ id: "hunter-original", title: "最初的猎人原瓶", source: "旧导师原瓶", status: "已服用", chance: 71, command: { type: "CONSUME", bottleId: "hunter-original", confirmed: true } }],
      abilities: HUNTER_ABILITIES.map((ability) => ({ ...ability, mastery: 15 })),
      trapStock: 1, trapHeld: 1, trapDeployed: 1,
    },
    provoker: provoker({
      promoted: sequence === 8, guidanceKnown: sequence === 8,
      title: sequence === 8 ? "挑衅者 · 序列8" : "挑衅者之路", actions: sequence === 8 ? [] : [guidance],
      abilities: sequence === 8 ? PROVOKER_ABILITIES.map((ability) => ({ ...ability, mastery: 8 })) : [],
    }),
    progression: {
      pathwayId: "hunter", sequence,
      mastery: Object.fromEntries(HUNTER_ABILITIES.map((ability) => [ability.id, 15])),
      acting: sequence === 8 ? 20 : 100, promotionWeek: 5,
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
async function openProvoker() {
  await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  await userEvent.click(screen.getByRole("button", { name: "挑衅者晋升" }));
}
function action(id: string, command: ProvokerCommand, patch: Partial<ProvokerAction> = {}): ProvokerAction {
  return { id, label: `公开行动${id}`, cost: `公开成本${id}`, enabled: true, reason: null, command, ...patch };
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Provoker pathway dossier", () => {
  it("shows sourced originals and the unverified recipe boundary without inventing manufacturing", () => {
    const value = bottled();
    panel({ ...value, formula: [{ name: "未知原料不得展示", quantity: 7, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByText("未知原料不得展示")).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制药|制造/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels freely, restores focus and confirms only the selected original once at zero AP", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶挑衅者魔药」/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶挑衅者魔药" }));
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶挑衅者魔药」/ }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶挑衅者魔药」/ }));
    expect(screen.getByText("provoker-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy();
    expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByText("来源：新货源的第二原瓶")).toBeTruthy();
    expect(screen.getByRole("region", { name: "挑衅者服用风险与四档结果" }).textContent).toContain(risk);
    const current = screen.getByRole("region", { name: "服药前当前资源" });
    for (const text of ["76 / 100", "88 / 100", "12 / 45", resources.cash, "0"]) expect(within(current).getByText(text)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶挑衅者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "provoker-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("discards a confirmation when its original disappears", async () => {
    const value = bottled();
    const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶挑衅者魔药」/ }));
    rerender(<ProvokerPanel provoker={{ ...value, bottles: value.bottles.slice(1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("shows one case and only its public observation action before actual facts are supplied", async () => {
    const cases = ["invoice-claim", "queue-boast", "yard-hound"].map((id, index) => ({ id, title: `公开情境${index + 1}`, story: `眼前可知的事实${index + 1}` }));
    const actions = cases.map((entry) => action(entry.id, { type: "OBSERVE", caseId: entry.id }));
    const { onCommand } = panel(provoker({ promoted: true, cases, actions }));
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "当前挑衅者情境" }).textContent).toContain("眼前可知的事实1");
    expect(screen.queryByText("眼前可知的事实2")).toBeNull();
    expect(screen.queryByRole("button", { name: /针对性挑衅|读心/ })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择当前情境" }), "yard-hound");
    expect(screen.getByRole("region", { name: "当前挑衅者情境" }).textContent).toContain("眼前可知的事实3");
    await userEvent.click(screen.getByRole("button", { name: /公开行动yard-hound/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "OBSERVE", caseId: "yard-hound" });
  });

  it("prefers an observed case and renders its two exact choices, costs and unavailable reason", async () => {
    const choices = [
      action("challenge", { type: "CHOOSE", caseId: "queue-boast", choice: "CHALLENGE" }),
      action("peace", { type: "CHOOSE", caseId: "queue-boast", choice: "DEESCALATE" }, { enabled: false, reason: "领域提供的本周限制。" }),
    ];
    const value = provoker({ promoted: true,
      cases: [
        { id: "invoice-claim", title: "尚未观察的告示", story: "可以实际去看。" },
        { id: "queue-boast", title: "已观察的号码单", story: "亲眼看到他把晚号排到早号前。" },
      ],
      actions: [action("observe", { type: "OBSERVE", caseId: "invoice-claim" }), ...choices],
    });
    const { onCommand, rerender } = panel(value);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "当前挑衅者情境" }).textContent).toContain("亲眼看到他把晚号排到早号前。");
    const choiceGroup = screen.getByRole("group", { name: "当前情境行动" });
    expect(within(choiceGroup).getByText("公开成本challenge")).toBeTruthy();
    expect((within(choiceGroup).getByRole("button", { name: /公开行动peace/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("领域提供的本周限制。")).toBeTruthy();
    await userEvent.click(within(choiceGroup).getByRole("button", { name: /公开行动challenge/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(choices[0]!.command);
    rerender(<ProvokerPanel provoker={{ ...value, actions: value.actions.slice(0, 1) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /公开行动challenge/ })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择当前情境" }) as HTMLSelectElement).value).toBe("invoice-claim");
    expect(screen.getByRole("region", { name: "当前挑衅者情境" }).textContent).toContain("可以实际去看。");
  });

  it("keeps the encounter folded separately and forwards finite reflection and encounter commands", async () => {
    const actions = [action("talk", { type: "ENCOUNTER_TALK" }), action("fight", { type: "ENCOUNTER_FIGHT" }), action("reflect", { type: "REFLECT" })];
    const { onCommand, rerender } = panel(provoker({ promoted: true, actions, story: "实际车主保管原空车。" }));
    expect((screen.getByText("货栈争议").closest("details") as HTMLDetailsElement).open).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: /公开行动reflect/ }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "REFLECT" });
    await userEvent.click(screen.getByText("货栈争议"));
    expect(screen.getByRole("region", { name: "当前货栈情境" }).textContent).toContain("实际车主保管原空车。");
    for (const item of actions.slice(0, 2)) {
      await userEvent.click(screen.getByRole("button", { name: new RegExp(item.label) }));
      expect(onCommand).toHaveBeenLastCalledWith(item.command);
    }
    rerender(<ProvokerPanel provoker={provoker({ promoted: true, actions: [] })} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /reflect/ })).toBeNull();
  });

  it("shows only public acquired abilities and preserves spent original records after promotion", async () => {
    const value = bottled();
    panel({ ...value, promoted: true, actions: [], acting: 40,
      abilities: PROVOKER_ABILITIES.map((ability) => ({ ...ability, mastery: 8 })),
    });
    await userEvent.click(screen.getByText(/挑衅者能力与消化/));
    for (const ability of PROVOKER_ABILITIES) expect(screen.getByText(`${ability.label} · 掌握 8`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /服用/ })).toBeNull();
    await userEvent.click(screen.getByText("挑衅者独立原瓶 · 来源与去向"));
    expect(screen.getByRole("heading", { name: "第一瓶挑衅者魔药" })).toBeTruthy();
  });

  it("lets a sequence-9 hunter see the sequence-8 maturity and digestion requirement", async () => {
    const value = bridge(fixture(9));
    await enter(value);
    await openProvoker();
    expect(screen.getByRole("region", { name: "挑衅者成长下一步" }).textContent).toContain("猎人消化100/100，成熟4/6整周。");
    expect(screen.queryByRole("button", { name: "小丑晋升" })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("names hunter sequence 8 correctly and defaults to its new page while preserving the old hunter panel", async () => {
    const state = fixture();
    const value = bridge(state);
    await enter(value);
    expect(screen.getByText(new RegExp(`挑衅者 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看详情/ }));
    expect(within(screen.getByRole("dialog", { name: "人物详情" })).getByText("挑衅者 · 序列8 · 未加入正式组织")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "关闭人物详情" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "挑衅者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "小丑晋升" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "猎人之路" }));
    expect(screen.getByRole("region", { name: "猎人能力与消化" }).textContent).toContain("扮演进度 100");
    for (const ability of HUNTER_ABILITIES) expect(screen.getByText(`${ability.label} · 掌握 15`)).toBeTruthy();
    await userEvent.click(screen.getByText("导师的独立原瓶 · 来源与去向"));
    expect(screen.getByRole("heading", { name: "最初的猎人原瓶" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用/ })).toBeNull();
    expect(value.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps diviner sequence 8 a clown and does not offer the provoker page", async () => {
    const state = fixture(8, { progression: { pathwayId: "diviner", sequence: 8, mastery: {}, acting: 0, promotionWeek: 5 } });
    state.clown.promoted = true;
    await enter(bridge(state));
    expect(screen.getByText(new RegExp(`小丑 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "小丑成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "挑衅者晋升" })).toBeNull();
  });

  it("retries the exact failed envelope and original without accepting another click", async () => {
    const state = fixture(9, { provoker: bottled(), actionsRemaining: 0 });
    const value = bridge(state);
    let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1 }, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openProvoker();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶挑衅者魔药」/ }));
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶挑衅者魔药」" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "挑衅者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("挑衅者模拟保存失败");
    expect((screen.getByRole("button", { name: "确认服用「第二瓶挑衅者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "猎人之路" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "PROVOKER", command: { type: "CONSUME", bottleId: "provoker-potion-2", confirmed: true } });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });

  it("opens the shared combat screen from the public provoker encounter command", async () => {
    const state = fixture();
    state.provoker.actions = [action("fight", { type: "ENCOUNTER_FIGHT" })];
    const next: SliceProjection = { ...state, revision: state.revision + 1, combat: {
      title: "货栈入口冲突", round: 1, enemyName: "已见过的威斯", enemyHealth: 100,
      enemyStatus: "RESISTING", playerCountWheel: [], enemyCountWheel: [], playerAbilityWheel: [], enemyAbilityWheel: [],
      consequenceWeights: { light: 65, heavy: 30, death: 5 },
      stances: [{ id: "ATTACK", label: "进攻", description: "当前公开姿态说明。" }], lastRound: null,
    } };
    const value = bridge(state);
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockImplementation(async (envelope) => receipt(next, envelope));
    value.submitIntent = submit;
    await enter(value);
    await openProvoker();
    await userEvent.click(screen.getByText("货栈争议"));
    await userEvent.click(screen.getByRole("button", { name: /公开行动fight/ }));
    expect(submit.mock.calls[0]![0].payload).toEqual({ type: "PROVOKER", command: { type: "ENCOUNTER_FIGHT" } });
    await screen.findByRole("dialog", { name: "货栈入口冲突" });
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
  });
});
