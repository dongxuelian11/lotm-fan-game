/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { LISTENER_ABILITIES, LISTENER_CONSUMPTION_RISK } from "../../src/domain/listener/content";
import type { ListenerAction, ListenerCommand, ListenerProjection } from "../../src/domain/listener/types";
import { SECRET_SUPPLICANT_ABILITIES } from "../../src/domain/secret-supplicant/content";
import type { SliceProjection } from "../../src/domain/slice/types";
import { ListenerPanel } from "../../src/renderer/ListenerPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: ListenerCommand, label = `公开操作${command.type}`, enabled = true, cost = "1行动 · 公开成本"): ListenerAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
function listener(patch: Partial<ListenerProjection> = {}): ListenerProjection {
  return {
    title: "倾听者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [], bottles: [], abilities: [],
    acting: 0, digestion: "秘祈人消化100；序列9已完成4/4整周。", pollution: 3,
    risk: LISTENER_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): ListenerProjection {
  return listener({ guidanceKnown: true,
    supplies: "三瓶独立成品，指导180便士；三次实际劳动抵1050便士后另付160便士，原价1210便士。",
    actions: ["listener-potion-1", "listener-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一瓶")),
    bottles: [
      { id: "listener-potion-1", title: "第一瓶倾听者魔药", source: "伊森·洛弗独立保管的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "listener-potion-1", confirmed: true } },
      { id: "listener-potion-2", title: "第二瓶倾听者魔药", source: "伊森·洛弗独立保管的第二进阶原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "listener-potion-2", confirmed: true } },
      { id: "listener-potion-3", title: "第三瓶倾听者魔药", source: "伊森·洛弗独立保管的第三进阶原瓶", status: "指导者保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "listener-potion-3", confirmed: true } },
    ],
  });
}
function cases(): ListenerProjection["cases"] {
  return [
    { id: "wall-knock", title: "墙后普通敲击", story: "公开记录尚未确认墙后敲击的来源。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待结束的主动接触", verified: false, overclaims: 0 },
    { id: "broken-phrase", title: "未完整的片段", story: "旧片段与普通记录仍需分别核对。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待结束的主动接触", verified: false, overclaims: 0 },
    { id: "room-exit", title: "门口与实际离开", story: "门外有原退路，仍须实际离开。", observations: [], preparation: null, result: null, status: "AVAILABLE", contactOpen: "没有尚待结束的主动接触", verified: false, overclaims: 0 },
  ];
}
function contact(failed = false): ListenerProjection {
  return listener({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "room-exit" ? {
      ...entry, status: failed ? "OBSERVED" : "EXAMINED", contactOpen: "仍在原倾听位置，先实际离开",
      result: failed ? "此前倾听未成，仍需离开，成本保留。" : "实际片段已记录，来源仍待核实。",
    } : entry),
    actions: [action({ type: "LEAVE", caseId: "room-exit" }, "实际离开本次倾听位置", true, "0行动 · 0灵性 · 不退成本")],
  });
}
function panel(value: ListenerProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<ListenerPanel listener={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("listener-renderer-run", sliceDefaultCreationSelection, "listener-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 9 | 8 | null = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), investigateTargets: [], canAct: true, actionBlockedReason: null,
    listener: listener({ promoted: sequence === 8, title: sequence === 8 ? "倾听者 · 序列8" : "倾听者晋升",
      abilities: sequence === 8 ? LISTENER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    secretSupplicant: { ...structuredClone(base.secretSupplicant), discovered: sequence !== null, promoted: sequence !== null, actions: [],
      acting: sequence !== null ? 100 : 0,
      abilities: sequence !== null ? SECRET_SUPPLICANT_ABILITIES.map((ability) => ({ ...ability, mastery: 32 })) : [],
    },
    progression: { pathwayId: sequence === null ? null : "hanged-man", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
async function openListener() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  if (!screen.queryByRole("region", { name: "倾听者成长下一步" })) {
    const tab = screen.queryByRole("button", { name: /^倾听者(?:晋升|成长)$/ });
    if (tab) await userEvent.click(tab);
  }
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Listener sequence-eight public exposure and verification dossier", () => {
  it("keeps exactly sixteen ordinary routes and never exposes S8 as a new starting pathway", async () => {
    const api = bridge(fixture(null)); await enter(api);
    expect(screen.queryByRole("group", { name: "选择成长卷宗" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "秘祈人之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^倾听者/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("offers S9 digestion and four-full-week promotion guidance without consuming anything", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("秘祈人消化已达100");
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("四个完整周");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "倾听者成长下一步" }).textContent).toContain("晋升不自动加入组织");
    expect(screen.getByRole("region", { name: "倾听者成长下一步" }).textContent).toContain("直接听到对应隐秘存在的耳语，不等于可靠理解或证明真相。可能获得的独特或扭曲力量不是自动赐予，也不是通用法术。本页显示指导者、成品渠道、情境与实际数值；晋升不自动加入组织。");
    expect(screen.getByRole("button", { name: "倾听者晋升" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens S8 from the task button and preserves Secret Supplicant history as callback-free original records", async () => {
    const state = fixture(8);
    state.secretSupplicant.cases = [{ id: "covered-token", title: "旧原页", story: "旧公开故事", observations: ["原观察仍保留"], preparation: "原准备", result: "旧错误报告已更正", status: "RESOLVED", contactOpen: "已实际盖罩", overclaims: 1 }];
    state.secretSupplicant.bottles = [{ id: "secret-supplicant-potion-1", title: "旧秘祈人原瓶", source: "伊森原瓶", status: "已耗用", chance: 70, command: { type: "CONSUME", bottleId: "secret-supplicant-potion-1", confirmed: true } }];
    state.secretSupplicant.actions = [
      { id: "stale-s9-reflect", label: "旧S9不可继续反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } },
      { id: "stale-s9-bottle", label: "旧S9不可重新服用", cost: "0行动", enabled: true, reason: null, command: { type: "CONSUME", bottleId: "secret-supplicant-potion-1", confirmed: true } },
    ];
    const api = bridge(state); await enter(api);
    expect(screen.getByText("倾听者 · 序列8 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看倾听者成长" }));
    expect(screen.getByRole("region", { name: "倾听者能力与消化" }).textContent).toContain("可能的力量须受实际来源约束");
    await userEvent.click(screen.getByRole("button", { name: "秘祈人经历" }));
    const history = within(screen.getByRole("region", { name: "秘祈人渠道经历" }));
    expect(screen.getByRole("region", { name: "秘祈人原成长记录" }).textContent).toContain("秘祈人时期扮演进度 100");
    expect(history.getByText("原观察仍保留")).toBeTruthy();
    expect(history.getByText("旧错误报告已更正")).toBeTruthy();
    expect(history.getByText(/过度断言记录：1/)).toBeTruthy();
    expect(history.getByText("来源：伊森原瓶")).toBeTruthy();
    for (const ability of SECRET_SUPPLICANT_ABILITIES) expect(history.getByText(new RegExp(`${ability.label} · 掌握 32`))).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText(/已选择其它途径/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "倾听者成长" }));
    expect(screen.getByRole("region", { name: "倾听者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows independent bottle provenance and public terms without unverified recipe ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "未核实原料不应显示", quantity: 1, unit: "份" }] });
    expect(screen.getByRole("region", { name: "倾听者成品渠道与配方边界" }).textContent).toContain("本阶段只使用独立成品原瓶，不提供完整配方、材料或调配。每瓶来源、劳动与供应条件以公开记录为准。");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("未核实原料不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels with Escape or the explicit button, restores focus and confirms the exact original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶倾听者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}"); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("listener-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "倾听者服用风险与四档结果" }).textContent).toContain(LISTENER_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶倾听者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "listener-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "inside"] as const)("invalidates bottle confirmation when public state becomes %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<ListenerPanel listener={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "inside" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility instead of deriving readiness from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "序列9尚未度过四个完整周。";
    rerender(<ListenerPanel listener={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶倾听者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("passes both preparation methods unchanged and never invents observations or a result", async () => {
    const choices = (["LISTEN", "ORDINARY"] as const).map((method) => action({ type: "PREPARE", caseId: "broken-phrase", method }, `选择${method}`));
    const value = listener({ promoted: true, cases: cases(), actions: choices });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择倾听情境" }), "broken-phrase");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "已取得的现场观察" }).textContent).toContain("仍未确认");
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("不会自动生成结果");
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    rerender(<ListenerPanel listener={{ ...value, actions: [action({ type: "OBSERVE", caseId: "wall-knock" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择倾听情境" }) as HTMLSelectElement).value).toBe("broken-phrase");
  });

  it.each([false, true])("selects the exact open case from LEAVE after a failed practice=%s at zero AP and mind", async (failed) => {
    const { onCommand, rerender } = panel(listener({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择倾听情境" }), "broken-phrase");
    const value = contact(failed);
    value.actions.push(action({ type: "REPORT", caseId: "room-exit", claim: "LIMITED" }), action({ type: "REFLECT" }));
    rerender(<ListenerPanel listener={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择倾听情境" }) as HTMLSelectElement;
    expect(selector.value).toBe("room-exit"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("本次接触：仍在原倾听位置，先实际离开")).toBeTruthy();
    const stop = screen.getByRole("button", { name: /^实际离开本次倾听位置/ }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^公开操作REPORT/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^公开操作REFLECT/ })).toBeNull();
    await userEvent.click(stop);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE", caseId: "room-exit" });
    expect(screen.getByText("本次接触：仍在原倾听位置，先实际离开")).toBeTruthy();
  });

  it.each(["busy", "blocked"] as const)("keeps all exposure controls locked while %s", (lock) => {
    render(<ListenerPanel listener={contact()} resources={resources} busy={lock === "busy"} blocked={lock === "blocked"} onCommand={vi.fn()} />);
    expect((screen.getByRole("button", { name: /^实际离开本次倾听位置/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "OBSERVE", "PREPARE", "PERFORM", "LEAVE", "VERIFY", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the same failed %s envelope and keeps committed facts unchanged", async (type) => {
    const acquiring = ["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: ListenerCommand = type === "CONSUME" ? { type, bottleId: "listener-potion-2", confirmed: true }
      : type === "POTION_WORK" || type === "BUY_POTION" ? { type, bottleId: "listener-potion-3" }
      : type === "REFLECT" || type === "LEARN_GUIDANCE" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "room-exit", method: "LISTEN" }
      : type === "REPORT" ? { type, caseId: "room-exit", claim: "CERTAIN" }
      : { type, caseId: "room-exit" };
    const list = cases(); list[2]!.status = type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(acquiring ? 9 : 8, { listener: type === "CONSUME" ? bottled() : listener({ promoted: !acquiring, cases: list, insideCase: type === "LEAVE", actions: [action(command)] }), actionsRemaining: 0, spirituality: 0, canAct: false, mind: type === "LEAVE" ? 0 : 88 });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, listener: { ...state.listener, insideCase: false, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    api.submitIntent = submit; await enter(api); await openListener();
    if ("caseId" in command && !state.listener.insideCase) await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择倾听情境" }), command.caseId);
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶倾听者魔药」" : new RegExp(`^${action(command).label}`);
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "倾听者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("倾听者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "LISTENER", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    if ("caseId" in command) expect((screen.getByRole("combobox", { name: "选择倾听情境" }) as HTMLSelectElement).value).toBe("room-exit");
  });

  it.each([false, true])("reloads an open exposure after failed check=%s and unlocks only after its LEAVE receipt", async (failed) => {
    const state = fixture(8, { listener: contact(failed), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next = { ...state, revision: state.revision + 1, listener: { ...state.listener, insideCase: false, actions: [], cases: state.listener.cases.map((entry) => ({ ...entry, contactOpen: "已经实际离开" })) } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "离开尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "立即离开本次倾听位置" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际离开本次倾听位置");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^实际离开本次倾听位置/ }));
    expect(screen.getByRole("alert").textContent).toContain("离开尚未保存");
    expect(screen.getByText("本次接触：仍在原倾听位置，先实际离开")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "LISTENER", command: { type: "LEAVE", caseId: "room-exit" } });
    expect(screen.getByText("本次接触：已经实际离开")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("does not infer an open exposure from localized prose or EXAMINED status", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", contactOpen: "仍在倾听位置：这里只是历史文字" };
    const api = bridge(fixture(8, { listener: listener({ promoted: true, cases: list }), actionsRemaining: 1 }));
    await enter(api); expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openListener(); expect(screen.queryByRole("region", { name: "立即离开本次倾听位置" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择倾听情境" }) as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("preserves the original S9 cover exit ahead of a simultaneous listener exposure", async () => {
    const state = fixture(8, { listener: contact(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    state.secretSupplicant = { ...state.secretSupplicant, insideCase: true,
      cases: [{ id: "covered-token", title: "原罩与旧物", story: "原罩仍揭开。", status: "OBSERVED", contactOpen: "尚未盖回", overclaims: 0, observations: [], preparation: null, result: "必须实际盖回。" }],
      actions: [{ id: "legacy-cover", label: "旧接触的实际盖罩", cost: "0行动", enabled: true, reason: null, command: { type: "COVER", caseId: "covered-token" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const button = await screen.findByRole("button", { name: /^旧接触的实际盖罩/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "倾听者成长下一步" })).toBeNull();
    await userEvent.click(button);
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "SECRET_SUPPLICANT", command: { type: "COVER", caseId: "covered-token" } });
  });

  it("keeps a consumed failed bottle gone and confirms a different original with updated resources", async () => {
    const state = fixture(9, { listener: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      listener: { ...state.listener, bottles: state.listener.bottles.map((bottle) => bottle.id === "listener-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.listener.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openListener();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶倾听者魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("listener-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
  it.each(["wall-knock", "broken-phrase", "room-exit"] as const)("uses the public LEAVE for %s and hides every stale non-exit option", async (caseId) => {
    const value = listener({ promoted: true, insideCase: true, cases: cases(), actions: [
      action({ type: "LEAVE", caseId }, "沿原门实际离开", true, "0行动 · 0灵性"),
      action({ type: "VERIFY", caseId }, "不能提前核实"),
      action({ type: "WITHDRAW", caseId }, "不能用撤销代替退出"),
      action({ type: "REPORT", caseId, claim: "CERTAIN" }, "不能提前确定断言"),
      action({ type: "REFLECT" }, "不能提前反思"),
    ] });
    const onCommand = vi.fn();
    render(<ListenerPanel listener={value} resources={{ ...resources, mind: 0, spirituality: 0, actionsRemaining: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择倾听情境" }) as HTMLSelectElement).value).toBe(caseId);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "立即离开本次倾听位置" }).textContent).toContain("不能保证免受未知影响");
    await userEvent.click(screen.getByRole("button", { name: /^沿原门实际离开/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "LEAVE", caseId });
  });

  it("keeps voice fragments, ordinary verification and overclaims as separate public records", async () => {
    const list = cases();
    list[1] = { ...list[1]!, status: "EXAMINED", observations: ["公开片段只有一处断句，来源未定。"], preparation: "本次选择有限倾听", result: "听到了片段；没有据此证实含义。", contactOpen: "已沿原门离开", verified: false, overclaims: 1 };
    const value = listener({ promoted: true, cases: list, actions: [action({ type: "VERIFY", caseId: "broken-phrase" }, "执行普通核实")] });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择倾听情境" }), "broken-phrase");
    expect(screen.getByText("公开片段只有一处断句，来源未定。")).toBeTruthy();
    expect(screen.getByText("普通核实：尚未完成本次普通核实")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^执行普通核实/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "VERIFY", caseId: "broken-phrase" });
    expect(screen.getByText("普通核实：尚未完成本次普通核实")).toBeTruthy();
    const claims = (["LIMITED", "CERTAIN"] as const).map((claim) => action({ type: "REPORT", caseId: "broken-phrase", claim }, `提交${claim}`));
    rerender(<ListenerPanel listener={{ ...value, cases: list.map((entry) => entry.id === "broken-phrase" ? { ...entry, verified: true } : entry), actions: claims }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.getByText("普通核实：已完成本次普通核实")).toBeTruthy();
    expect(screen.getByText("过度断言记录：1")).toBeTruthy();
    for (const choice of claims) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.slice(1).map(([command]) => command)).toEqual(claims.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "实际实践结果" }).textContent).toContain("没有据此证实含义");
  });

  it("keeps ordinary preparation dismissible and relies on the public blocked report reason", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "PREPARED", preparation: "本次准备普通核对", verified: false };
    const report = action({ type: "REPORT", caseId: "wall-knock", claim: "LIMITED" }, "等待普通核实后报告", false);
    report.reason = "先实际完成普通核实。";
    const api = bridge(fixture(8, { listener: listener({ promoted: true, cases: list, actions: [report] }), actionsRemaining: 1 }));
    await enter(api);
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openListener();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /^等待普通核实后报告/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(/先实际完成普通核实/).length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("stays on the current S8 dossier after promotion and shows no stale S9 actions", async () => {
    const state = fixture(9, { listener: bottled() });
    state.secretSupplicant.actions = [{ id: "old-reflect", label: "旧阶段不可再反思", cost: "1行动", enabled: true, reason: null, command: { type: "REFLECT" } }];
    const next = fixture(8, { revision: state.revision + 1, secretSupplicant: state.secretSupplicant,
      listener: listener({ promoted: true, title: "倾听者 · 序列8", cases: cases(), abilities: LISTENER_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) }),
    });
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(next, envelope));
    await enter(api); await openListener();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶倾听者魔药」" }));
    expect(screen.getByRole("region", { name: "倾听者成长下一步" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "秘祈人成长下一步" })).toBeNull();
    expect(screen.queryByRole("region", { name: "占卜家成长下一步" })).toBeNull();
    expect(screen.queryByRole("button", { name: /确认服用|旧阶段不可再反思/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "秘祈人经历" }));
    expect(screen.getByRole("region", { name: "秘祈人原成长记录" }).textContent).toContain("秘祈人时期扮演进度 100");
    expect(within(screen.getByRole("region", { name: "秘祈人渠道经历" })).queryByRole("button")).toBeNull();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });

});
