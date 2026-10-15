/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import { COMBAT_SCHOLAR_ABILITIES, COMBAT_SCHOLAR_CONSUMPTION_RISK } from "../../src/domain/combat-scholar/content";
import type { CombatScholarAction, CombatScholarCommand, CombatScholarProjection } from "../../src/domain/combat-scholar/types";
import { PRYER_ABILITIES } from "../../src/domain/pryer/content";
import type { SliceProjection } from "../../src/domain/slice/types";
import { CombatScholarPanel } from "../../src/renderer/CombatScholarPanel";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 40, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
function action(command: CombatScholarCommand, label = `公开操作${command.type}`, enabled = true, cost = "1行动 · 公开成本"): CombatScholarAction {
  return { id: JSON.stringify(command), label, cost, enabled, reason: enabled ? null : "本次条件尚未满足。", command };
}
function scholar(patch: Partial<CombatScholarProjection> = {}): CombatScholarProjection {
  return {
    title: "格斗学者晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [], bottles: [], abilities: [],
    acting: 0, digestion: "窥秘人消化100；序列9已完成4/4整周。", pollution: 3,
    risk: COMBAT_SCHOLAR_CONSUMPTION_RISK, cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): CombatScholarProjection {
  return scholar({ guidanceKnown: true,
    supplies: "三瓶独立成品，指导180便士；三次实际劳动抵1050便士，原价1210便士。",
    actions: ["combat-scholar-potion-1", "combat-scholar-potion-2"].map((bottleId) => action({ type: "CONSUME", bottleId, confirmed: true }, `服用${bottleId}`, true, "0行动 · 独立确认 · 消耗这一瓶")),
    bottles: [
      { id: "combat-scholar-potion-1", title: "第一瓶格斗学者魔药", source: "塔文独立保管的第一进阶原瓶", status: "已交付，尚未服用", chance: 71, command: { type: "CONSUME", bottleId: "combat-scholar-potion-1", confirmed: true } },
      { id: "combat-scholar-potion-2", title: "第二瓶格斗学者魔药", source: "塔文独立保管的第二进阶原瓶", status: "已交付，尚未服用", chance: 43, command: { type: "CONSUME", bottleId: "combat-scholar-potion-2", confirmed: true } },
      { id: "combat-scholar-potion-3", title: "第三瓶格斗学者魔药", source: "塔文独立保管的第三进阶原瓶", status: "指导者保管 · 劳动0/3", chance: 43, command: { type: "CONSUME", bottleId: "combat-scholar-potion-3", confirmed: true } },
    ],
  });
}
function cases(): CombatScholarProjection["cases"] {
  return [
    { id: "counter-study", title: "纸上的右步，眼前的左步", story: "旧卡与现场动作不同。", observations: [], preparation: null, result: null, status: "AVAILABLE", exerciseOpen: "没有尚待停止的演练" },
    { id: "changed-passage", title: "箱子改变了通道", story: "原箱仍挡住中央，外侧有普通退路。", observations: [], preparation: null, result: null, status: "AVAILABLE", exerciseOpen: "没有尚待停止的演练" },
    { id: "halted-exercise", title: "听见停止之后", story: "本人只同意一段练习，铃声要求结束。", observations: [], preparation: null, result: null, status: "AVAILABLE", exerciseOpen: "没有尚待停止的演练" },
  ];
}
function exercising(failed = false): CombatScholarProjection {
  return scholar({ promoted: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "halted-exercise" ? {
      ...entry, status: failed ? "OBSERVED" : "EXAMINED", exerciseOpen: "原铃已响，先明确停止这次演练",
      result: failed ? "此前演练未成，成本保留。" : "实际演练已记录，仍需停止。",
    } : entry),
    actions: [action({ type: "STOP", caseId: "halted-exercise" }, "明确停止本次演练", true, "0行动 · 0灵性 · 不退成本")],
  });
}
function panel(value: CombatScholarProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<CombatScholarPanel combatScholar={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
const raw = createSliceRun("combat-scholar-renderer-run", sliceDefaultCreationSelection, "combat-scholar-renderer-seed");
raw.week = 10; raw.activeEvent = null; raw.arc.stage = "ENDED"; raw.character.name = "艾琳";
const base = projectSliceState(raw);
function fixture(sequence: 9 | 8 | null = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  return {
    ...structuredClone(base), investigateTargets: [], canAct: true, actionBlockedReason: null,
    combatScholar: scholar({ promoted: sequence === 8, title: sequence === 8 ? "格斗学者 · 序列8" : "格斗学者晋升",
      abilities: sequence === 8 ? COMBAT_SCHOLAR_ABILITIES.map((ability) => ({ ...ability, mastery: 0 })) : [],
    }),
    pryer: { ...structuredClone(base.pryer), discovered: sequence !== null, promoted: sequence !== null, actions: [],
      abilities: sequence !== null ? PRYER_ABILITIES.map((ability) => ({ ...ability, mastery: 32 })) : [],
    },
    progression: { pathwayId: sequence === null ? null : "hermit", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
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
async function openScholar() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  if (!screen.queryByRole("region", { name: "格斗学者成长下一步" })) {
    const tab = screen.queryByRole("button", { name: /^格斗学者(?:晋升|成长)$/ });
    if (tab) await userEvent.click(tab);
  }
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Combat scholar sequence-eight public G-training dossier", () => {
  it("keeps exactly fifteen ordinary routes and never exposes S8 as a new starting pathway", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const choices = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(choices.getAllByRole("button")).toHaveLength(22);
    expect(choices.getByRole("button", { name: "窥秘人之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^格斗学者/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("offers S9 digestion and four-full-week promotion guidance without consuming anything", async () => {
    const api = bridge(fixture()); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("窥秘人消化已达100");
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("四个完整周");
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "格斗学者成长下一步" }).textContent).toContain("格斗学者为序列8。本页只开放当前说明列出的训练、观察与演练，情境、成品渠道和数值以当前说明为准。晋升不自动加入组织。");
    expect(screen.getByRole("button", { name: "格斗学者晋升" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("opens S8 from the task button and preserves Pryer history as callback-free original records", async () => {
    const state = fixture(8);
    state.pryer.cases = [{ id: "intrusive-page", title: "旧原页", story: "旧公开故事", observations: ["原观察仍保留"], preparation: "原准备", result: "旧错误报告已更正", status: "RESOLVED", readingOpen: "已实际合页", overclaims: 1 }];
    state.pryer.bottles = [{ id: "pryer-potion-1", title: "旧窥秘人原瓶", source: "莉奈原瓶", status: "已耗用", chance: 70, command: { type: "CONSUME", bottleId: "pryer-potion-1", confirmed: true } }];
    const api = bridge(state); await enter(api);
    expect(screen.getByText("格斗学者 · 序列8 · " + base.character.professionName)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "查看格斗学者成长" }));
    expect(screen.getByRole("region", { name: "格斗学者能力与消化" }).textContent).toContain("新训练分类及具体效果全部以当前说明为准；窥秘人时期的能力与原掌握记录继续保留。");
    await userEvent.click(screen.getByRole("button", { name: "窥秘人经历" }));
    const history = within(screen.getByRole("region", { name: "窥秘人渠道经历" }));
    expect(history.getByText("原观察仍保留")).toBeTruthy();
    expect(history.getByText("旧错误报告已更正")).toBeTruthy();
    expect(history.getByText(/过度断言记录：1/)).toBeTruthy();
    expect(history.getByText("来源：莉奈原瓶")).toBeTruthy();
    for (const ability of PRYER_ABILITIES) expect(history.getByText(new RegExp(`${ability.label} · 掌握 32`))).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull(); expect(history.queryByRole("combobox")).toBeNull();
    expect(history.queryByText(/已选择其它途径/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "格斗学者成长" }));
    expect(screen.getByRole("region", { name: "格斗学者成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("shows independent bottle provenance and public terms without unverified recipe ingredients", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "未核实原料不应显示", quantity: 1, unit: "份" }] });
    expect(screen.getByRole("region", { name: "格斗学者成品渠道与配方边界" }).textContent).toContain("本阶段只使用独立成品原瓶，不提供完整配方、材料或调配。每瓶来源、劳动与供应条件以公开记录为准。");
    expect(screen.getByText(value.supplies)).toBeTruthy();
    for (const bottle of value.bottles) expect(screen.getByText(`来源：${bottle.source}`)).toBeTruthy();
    expect(screen.queryByText("未核实原料不应显示")).toBeNull();
    expect(screen.queryByRole("button", { name: /制造|调配|查看并准备服用「第三瓶/ })).toBeNull();
  });

  it("cancels with Escape or the explicit button, restores focus and confirms the exact original once", async () => {
    const { onCommand } = panel(bottled());
    const first = screen.getByRole("button", { name: /查看并准备服用「第一瓶/ });
    first.focus(); await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶格斗学者魔药" }));
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.keyboard("{Enter}"); await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("combat-scholar-potion-2")).toBeTruthy();
    expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(screen.getByRole("region", { name: "格斗学者服用风险与四档结果" }).textContent).toContain(COMBAT_SCHOLAR_CONSUMPTION_RISK);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const value of ["76 / 100", "88 / 100", "12 / 40", resources.cash, "0"]) expect(current.getByText(value)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "确认服用「第二瓶格斗学者魔药」" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "CONSUME", bottleId: "combat-scholar-potion-2", confirmed: true });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "暂不服用" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["removed", "promoted", "inside"] as const)("invalidates bottle confirmation when public state becomes %s", async (change) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    rerender(<CombatScholarPanel combatScholar={{ ...value, actions: change === "removed" ? value.actions.slice(1) : value.actions, promoted: change === "promoted", insideCase: change === "inside" }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByRole("button", { name: /确认服用/ })).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("uses updated public eligibility instead of deriving readiness from visible resources", async () => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    const reason = "序列9尚未度过四个完整周。";
    rerender(<CombatScholarPanel combatScholar={{ ...value, actions: value.actions.map((entry) => ({ ...entry, enabled: false, reason })) }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: "确认服用「第一瓶格斗学者魔药」" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy(); expect(onCommand).not.toHaveBeenCalled();
  });

  it("passes all three preparation methods unchanged and never invents observations or a result", async () => {
    const choices = (["OBSERVED", "MEMORIZED", "TEAM"] as const).map((method) => action({ type: "PREPARE", caseId: "changed-passage", method }, `选择${method}`));
    const value = scholar({ promoted: true, cases: cases(), actions: choices });
    const { onCommand, rerender } = panel(value);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择演练情境" }), "changed-passage");
    for (const choice of choices) await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${choice.label}`) }));
    expect(onCommand.mock.calls.map(([command]) => command)).toEqual(choices.map((entry) => entry.command));
    expect(screen.getByRole("region", { name: "已取得的现场观察" }).textContent).toContain("仍未确认");
    expect(screen.getByRole("region", { name: "实际方法与准备" }).textContent).toContain("不会自动生成结果");
    expect(screen.queryByRole("region", { name: "实际实践结果" })).toBeNull();
    rerender(<CombatScholarPanel combatScholar={{ ...value, actions: [action({ type: "OBSERVE", caseId: "counter-study" })] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("combobox", { name: "选择演练情境" }) as HTMLSelectElement).value).toBe("changed-passage");
  });

  it.each([false, true])("selects the exact open case from STOP after a failed practice=%s at zero AP and mind", async (failed) => {
    const { onCommand, rerender } = panel(scholar({ promoted: true, cases: cases() }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择演练情境" }), "changed-passage");
    const value = exercising(failed);
    value.actions.push(action({ type: "REPORT", caseId: "halted-exercise" }), action({ type: "REFLECT" }));
    rerender(<CombatScholarPanel combatScholar={value} resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    const selector = screen.getByRole("combobox", { name: "选择演练情境" }) as HTMLSelectElement;
    expect(selector.value).toBe("halted-exercise"); expect(selector.disabled).toBe(true);
    expect(screen.getByText("演练状态：原铃已响，先明确停止这次演练")).toBeTruthy();
    const stop = screen.getByRole("button", { name: /^明确停止本次演练/ }) as HTMLButtonElement;
    expect(stop.disabled).toBe(false);
    expect((screen.getByRole("button", { name: /^公开操作REPORT/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^公开操作REFLECT/ }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(stop);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "STOP", caseId: "halted-exercise" });
    expect(screen.getByText("演练状态：原铃已响，先明确停止这次演练")).toBeTruthy();
  });

  it.each(["busy", "blocked"] as const)("keeps all exercise controls locked while %s", (lock) => {
    render(<CombatScholarPanel combatScholar={exercising()} resources={resources} busy={lock === "busy"} blocked={lock === "blocked"} onCommand={vi.fn()} />);
    expect((screen.getByRole("button", { name: /^明确停止本次演练/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "OBSERVE", "PREPARE", "PERFORM", "STOP", "REPORT", "WITHDRAW", "REFLECT", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"] as const)("retries the same failed %s envelope and keeps committed facts unchanged", async (type) => {
    const acquiring = ["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(type);
    const command: CombatScholarCommand = type === "CONSUME" ? { type, bottleId: "combat-scholar-potion-2", confirmed: true }
      : type === "POTION_WORK" || type === "BUY_POTION" ? { type, bottleId: "combat-scholar-potion-3" }
      : type === "REFLECT" || type === "LEARN_GUIDANCE" || type === "REQUEST_SUPPLY" || type === "RECEIVE_SUPPLY" ? { type }
      : type === "PREPARE" ? { type, caseId: "halted-exercise", method: "MEMORIZED" }
      : { type, caseId: "halted-exercise" };
    const list = cases(); list[2]!.status = type === "REPORT" ? "EXAMINED" : type === "PERFORM" ? "PREPARED" : "OBSERVED";
    const state = fixture(acquiring ? 9 : 8, { combatScholar: type === "CONSUME" ? bottled() : scholar({ promoted: !acquiring, cases: list, insideCase: type === "STOP", actions: [action(command)] }), actionsRemaining: 0, spirituality: 0, canAct: false, mind: type === "STOP" ? 0 : 88 });
    const api = bridge(state); let finishFirst!: (value: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const next = { ...state, revision: state.revision + 1, combatScholar: { ...state.combatScholar, insideCase: false, actions: [] } };
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockReturnValueOnce(first).mockImplementationOnce(async (envelope) => receipt(next, envelope));
    api.submitIntent = submit; await enter(api); await openScholar();
    if (type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const name = type === "CONSUME" ? "确认服用「第二瓶格斗学者魔药」" : new RegExp(`^${action(command).label}`);
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "格斗学者模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("格斗学者模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "COMBAT_SCHOLAR", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    if ("caseId" in command) expect((screen.getByRole("combobox", { name: "选择演练情境" }) as HTMLSelectElement).value).toBe("halted-exercise");
  });

  it.each([false, true])("reloads an open exercise after failed check=%s and unlocks only after its STOP receipt", async (failed) => {
    const state = fixture(8, { combatScholar: exercising(failed), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next = { ...state, revision: state.revision + 1, combatScholar: { ...state.combatScholar, insideCase: false, actions: [], cases: state.combatScholar.cases.map((entry) => ({ ...entry, exerciseOpen: "已经实际停止" })) } };
    const api = bridge(state);
    api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "停止尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "立即停止本次演练" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际停止本次演练");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-life-action]")) expect(button.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^明确停止本次演练/ }));
    expect(screen.getByRole("alert").textContent).toContain("停止尚未保存");
    expect(screen.getByText("演练状态：原铃已响，先明确停止这次演练")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls;
    expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "COMBAT_SCHOLAR", command: { type: "STOP", caseId: "halted-exercise" } });
    expect(screen.getByText("演练状态：已经实际停止")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先恢复身心");
  });

  it("does not infer an open exercise from localized prose or EXAMINED status", async () => {
    const list = cases(); list[0] = { ...list[0]!, status: "EXAMINED", exerciseOpen: "原铃已响：这里只是历史文字" };
    const api = bridge(fixture(8, { combatScholar: scholar({ promoted: true, cases: list }), actionsRemaining: 1 }));
    await enter(api); expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openScholar(); expect(screen.queryByRole("region", { name: "立即停止本次演练" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择演练情境" }) as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it.each(["RETURN", "SETTLE", "CLOSE"] as const)("preserves older %s safety exit ahead of a simultaneous scholar exercise", async (exit) => {
    const state = fixture(8, { combatScholar: exercising(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    if (exit === "RETURN" || exit === "SETTLE") state.progression = { pathwayId: "demoness", sequence: exit === "RETURN" ? 9 : 8, mastery: {}, acting: 0, promotionWeek: 5 };
    if (exit === "RETURN") state.assassin = { ...state.assassin, promoted: true, discovered: true, insideCase: true,
      cases: [{ id: "upper-draft", title: "上层原平台", story: "本人仍在原平台。", status: "EXAMINED", position: "上层平台", observations: [], preparation: null, result: "必须实际返回。" }],
      actions: [{ id: "legacy-return", label: "旧实践的普通楼梯返回", cost: "0行动", enabled: true, reason: null, command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }],
    };
    else if (exit === "SETTLE") state.instigator = { ...state.instigator, promoted: true, insideCase: true,
      cases: [{ id: "queue-grievance", title: "旧争执现场", story: "争执仍在升温。", status: "EXAMINED", tension: "仍在激化", observations: [], preparation: null, result: "必须实际停止挑动。" }],
      actions: [{ id: "legacy-settle", label: "旧实践的停止挑动", cost: "0行动", enabled: true, reason: null, command: { type: "SETTLE", caseId: "queue-grievance" } }],
    };
    else state.pryer = { ...state.pryer, insideCase: true,
      cases: [{ id: "intrusive-page", title: "旧原页", story: "原页仍打开。", status: "OBSERVED", readingOpen: "尚未合页", overclaims: 0, observations: [], preparation: null, result: "必须实际合页。" }],
      actions: [{ id: "legacy-close", label: "旧实践的实际合页", cost: "0行动", enabled: true, reason: null, command: { type: "CLOSE", caseId: "intrusive-page" } }],
    };
    const api = bridge(state); api.submitIntent = vi.fn(() => new Promise<SliceResult<SliceReceipt>>(() => {}));
    await enter(api);
    const label = exit === "RETURN" ? "旧实践的普通楼梯返回" : exit === "SETTLE" ? "旧实践的停止挑动" : "旧实践的实际合页";
    const button = await screen.findByRole("button", { name: new RegExp(`^${label}`) });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "格斗学者成长下一步" })).toBeNull();
    await userEvent.click(button); expect(api.submitIntent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual(exit === "RETURN"
      ? { type: "ASSASSIN", command: { type: "RETURN", caseId: "upper-draft", route: "STAIRS" } }
      : exit === "SETTLE" ? { type: "INSTIGATOR", command: { type: "SETTLE", caseId: "queue-grievance" } }
      : { type: "PRYER", command: { type: "CLOSE", caseId: "intrusive-page" } });
  });

  it("keeps a consumed failed bottle gone and confirms a different original with updated resources", async () => {
    const state = fixture(9, { combatScholar: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      combatScholar: { ...state.combatScholar, bottles: state.combatScholar.bottles.map((bottle) => bottle.id === "combat-scholar-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.combatScholar.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openScholar();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶格斗学者魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect(screen.getByText("combat-scholar-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy();
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });
});
