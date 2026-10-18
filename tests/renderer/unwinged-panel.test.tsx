/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sliceDefaultCreationSelection } from "../../src/content/slice-creation";
import { createSliceRun, projectSliceState } from "../../src/domain/slice";
import type { SliceProjection } from "../../src/domain/slice/types";
import { UNWINGED_CHANGE_WARNING, UNWINGED_CONSUMPTION_RISK } from "../../src/domain/unwinged/content";
import type { UnwingedAction, UnwingedCommand, UnwingedProjection } from "../../src/domain/unwinged/types";
import { UnwingedCriminalHistory, UnwingedPanel } from "../../src/renderer/UnwingedPanel";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SeerResources } from "../../src/renderer/SeerPanel";
import type { SliceBridge, SliceEnvelope, SliceReceipt, SliceResult } from "../../src/shared/slice-contracts";

const resources: SeerResources = {
  health: 76, maxHealth: 100, mind: 88, maxMind: 100,
  spirituality: 12, maxSpirituality: 30, cash: "2镑 3苏勒 4便士", actionsRemaining: 0,
};
const consentLabel = "我已了解并接受这瓶魔药成功晋升后的虚构角色良知变化与恶欲代价";
const consume = (bottleId: string): UnwingedCommand => ({ type: "CONSUME", bottleId, confirmed: true, acceptedChange: true });
function action(command: UnwingedCommand, label = `公开操作${command.type}`, enabled = true): UnwingedAction {
  return { id: JSON.stringify(command), label, cost: "公开成本 · 0行动 · 本次实际成本", enabled,
    reason: enabled ? null : "本周已尝试，须下周再来。", command };
}
function unwinged(patch: Partial<UnwingedProjection> = {}): UnwingedProjection {
  return {
    title: "折翼天使晋升", discovered: true, guidanceKnown: false, promoted: false,
    formulaKnown: false, formula: [], supplies: "", actions: [action({ type: "LEARN_GUIDANCE" })], bottles: [], abilities: [],
    conscienceLost: false, changeWarning: UNWINGED_CHANGE_WARNING,
    acting: 0, digestion: "罪犯扮演100，已度过4/4个完整序列9周。", pollution: 3, risk: UNWINGED_CONSUMPTION_RISK,
    cases: [], insideCase: false, environment: "", ...patch,
  };
}
function bottled(): UnwingedProjection {
  return unwinged({
    guidanceKnown: true,
    supplies: "罗安保管三瓶独立成品，1210便士或3次劳动后付160便士；指导180便士、1行动。完整配方待核。",
    actions: [action(consume("unwinged-potion-1")), action(consume("unwinged-potion-2"))],
    bottles: [
      { id: "unwinged-potion-1", title: "第一瓶折翼天使魔药", source: "罗安交接的第一独立进阶原瓶", status: "已交付，尚未服用", chance: 71, command: consume("unwinged-potion-1") },
      { id: "unwinged-potion-2", title: "第二瓶折翼天使魔药", source: "罗安交接的第二独立进阶原瓶", status: "已交付，尚未服用", chance: 43, command: consume("unwinged-potion-2") },
      { id: "unwinged-potion-3", title: "第三瓶折翼天使魔药", source: "罗安保管的第三独立进阶原瓶", status: "尚未取得 · 劳动0/3", chance: 43, command: consume("unwinged-potion-3") },
    ],
  });
}
function cases(): UnwingedProjection["cases"] {
  return ["cold-grip", "refused-price", "false-claim"].map((id, index) => ({
    id, title: `克制实践${index + 1}`, story: `实际原场景与当事人边界${index + 1}`,
    observations: [], preparation: null, result: null, status: "AVAILABLE", urgeOpen: "没有待处理冲动", restraints: 0,
  }));
}
function openUrge(): UnwingedProjection {
  return unwinged({ promoted: true, conscienceLost: true, insideCase: true,
    cases: cases().map((entry) => entry.id === "refused-price" ? { ...entry, status: "EXAMINED", result: "本次普通方法实际失败，成本保留。", urgeOpen: "本人尚未退开，须实际处理冲动" } : entry),
    actions: [action({ type: "STAND_DOWN", caseId: "refused-price" }, "实际退开并停止施压")],
  });
}
function panel(value: UnwingedProjection, onCommand = vi.fn()) {
  return { onCommand, ...render(<UnwingedPanel unwinged={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />) };
}
function fixture(sequence: null | 9 | 8 = 9, patch: Partial<SliceProjection> = {}): SliceProjection {
  const raw = createSliceRun("unwinged-renderer-run", sliceDefaultCreationSelection, "unwinged-renderer-seed");
  raw.week = 14; raw.activeEvent = null; raw.character.name = "艾琳";
  const state = projectSliceState(raw);
  return {
    ...state, canAct: true, actionBlockedReason: null,
    criminal: { ...state.criminal, discovered: sequence !== null, promoted: sequence !== null, acting: sequence === null ? 0 : 100, actions: [] },
    unwinged: unwinged({ promoted: sequence === 8, conscienceLost: sequence === 8, title: sequence === 8 ? "折翼天使 · 序列8" : "折翼天使晋升", actions: sequence === 8 ? [] : [action({ type: "LEARN_GUIDANCE" })] }),
    progression: { pathwayId: sequence === null ? null : "abyss", sequence, mastery: {}, acting: sequence === 9 ? 100 : 0, promotionWeek: sequence === null ? null : 5 },
    ...patch,
  };
}
function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({ ok: true as const, value: {
      mode: "browser" as const, activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-12T00:00:00Z" }],
    } })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })), submitIntent: vi.fn(),
  };
}
function receipt(state: SliceProjection, envelope: SliceEnvelope): SliceResult<SliceReceipt> {
  return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
    newRevision: state.revision, committedAt: "2026-10-12T00:01:00Z", replayed: false, state } };
}
async function enter(api: SliceBridge) {
  window.sliceGame = api; render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: /艾琳/ }));
  await screen.findByRole("heading", { name: "人物卷宗" });
}
async function openUnwinged() {
  if (!screen.queryByRole("dialog", { name: "非凡成长" })) await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
  if (!screen.queryByRole("region", { name: "折翼天使成长下一步" })) await userEvent.click(screen.getByRole("button", { name: "折翼天使晋升" }));
}
async function acceptChange() { await userEvent.click(screen.getByRole("checkbox", { name: consentLabel })); }
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Unwinged sequence eight dossier", () => {
  it("preserves seventeen ordinary routes without exposing an S8 entry", async () => {
    const api = bridge(fixture(null)); await enter(api);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    const chooser = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(chooser.getAllByRole("button")).toHaveLength(22);
    expect(chooser.getByRole("button", { name: "罪犯之路" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /折翼天使/ })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("keeps S9 as default and opens advancement from the tab or dashboard", async () => {
    const api = bridge(fixture(9)); await enter(api);
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("准备序列8晋升");
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "罪犯成长下一步" })).toBeTruthy();
    const chooser = within(screen.getByRole("group", { name: "选择成长卷宗" }));
    expect(chooser.getAllByRole("button")).toHaveLength(2);
    expect(chooser.getByRole("button", { name: "罪犯成长" })).toBeTruthy();
    expect(chooser.getByRole("button", { name: "折翼天使晋升" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "折翼天使晋升" }));
    expect(screen.getByRole("region", { name: "折翼天使成长下一步" }).textContent).toContain("罪犯100消化与四个完整序列9周");
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    await userEvent.click(screen.getByRole("button", { name: "查看晋升准备" }));
    expect(screen.getByRole("region", { name: "折翼天使成长下一步" })).toBeTruthy();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("defaults S8 to Unwinged and preserves S9 facts and acting100 without callbacks", async () => {
    const state = fixture(8); state.seer.discovered = true;
    state.criminal.cases = [{ id: "found-pay", title: "原工钱袋", story: "原主人仍为玛拉", observations: ["原封记已经核对"], preparation: "实际取回经过", result: "归还不抹去拿取后果", status: "RESOLVED", holding: "已交回玛拉", tookOriginal: true, returns: 1 }];
    state.criminal.actions = [{ id: "stale", label: "不得重做的旧操作", cost: "1行动", enabled: true, reason: null, command: { type: "OBSERVE", caseId: "found-pay" } }];
    const api = bridge(state); await enter(api);
    expect(screen.getByText(new RegExp(`折翼天使 · 序列8 · ${state.character.professionName}`))).toBeTruthy();
    await openUnwinged();
    expect(screen.getByRole("button", { name: "折翼天使成长" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "占卜家经历" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("region", { name: "罪犯成长下一步" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "罪犯经历" }));
    const history = within(screen.getByRole("region", { name: "罪犯时期的经历" }));
    for (const text of ["原主人仍为玛拉", "原封记已经核对", "实际取回经过", "归还不抹去拿取后果"]) expect(history.getByText(text)).toBeTruthy();
    expect(history.getByText(/罪犯扮演进度 100/)).toBeTruthy();
    expect(history.queryByRole("button")).toBeNull();
    expect(screen.queryByText("不得重做的旧操作")).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });

  it("retains exact old bottle sources and inherited mastery in callback-free history", () => {
    const value = fixture(8).criminal;
    value.bottles = [{ id: "old-bottle", title: "罪犯原瓶", source: "旧货库原始交接", status: "已耗用 · 失败", chance: 40, command: { type: "CONSUME", bottleId: "old-bottle", confirmed: true } }];
    value.abilities = [{ id: "abyss.s9.alertness", label: "原敏锐直觉", description: "须实际核实", mastery: 37 }];
    render(<UnwingedCriminalHistory criminal={value} />);
    expect(screen.getByText("来源：旧货库原始交接")).toBeTruthy(); expect(screen.getByText("已耗用 · 失败")).toBeTruthy();
    expect(screen.getByText("原敏锐直觉 · 掌握 37：须实际核实")).toBeTruthy(); expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows public supply, costs and exact originals without inventing a formula", () => {
    const value = bottled(); panel({ ...value, formula: [{ name: "未核材料不得显示", quantity: 9, unit: "份" }] });
    expect(screen.getByText(value.supplies)).toBeTruthy(); expect(screen.queryByText("未核材料不得显示")).toBeNull();
    for (const bottle of value.bottles) expect(screen.getByRole("heading", { name: bottle.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /查看并准备服用「第三瓶/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /调配|制造|配方学习/ })).toBeNull();
  });

  it("opens with unchecked, bottle-specific acceptance and leaves the character unchanged", async () => {
    const value = bottled(); const original = JSON.stringify(value); const { onCommand } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "第一瓶折翼天使魔药" }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    const confirm = screen.getByRole("button", { name: "确认服用「第一瓶折翼天使魔药」" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); fireEvent.click(confirm);
    expect(screen.getByRole("region", { name: "本瓶晋升的角色变化与独立接受" }).textContent).toContain(UNWINGED_CHANGE_WARNING);
    expect(screen.getByRole("region", { name: "折翼天使服用风险与四档结果" }).textContent).toContain(value.risk);
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    expect(onCommand).not.toHaveBeenCalled(); expect(JSON.stringify(value)).toBe(original);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
  });

  it("resets acceptance on cancellation, Escape and selection of a different original", async () => {
    const { onCommand } = panel(bottled());
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptChange();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" }));
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false); await acceptChange();
    fireEvent.keyDown(screen.getByRole("region", { name: "这瓶折翼天使魔药的服用确认" }), { key: "Escape" });
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("unwinged-potion-2")).toBeTruthy(); expect(screen.getByText("43%")).toBeTruthy(); expect(screen.queryByText("71%")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("submits exactly one accepted true command for the selected original at zero AP", async () => {
    const { onCommand } = panel(bottled()); await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    const current = within(screen.getByRole("region", { name: "服药前当前资源" }));
    for (const text of ["76 / 100", "88 / 100", "12 / 30", resources.cash, "0"]) expect(current.getByText(text)).toBeTruthy();
    await acceptChange(); const button = screen.getByRole("button", { name: "确认服用「第二瓶折翼天使魔药」" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(consume("unwinged-potion-2"));
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(["promoted", "missing-action", "readonly"] as const)("closes and clears stale acceptance when %s", async (condition) => {
    const value = bottled(); const { onCommand, rerender } = panel(value);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptChange();
    rerender(<UnwingedPanel unwinged={condition === "promoted" ? { ...value, promoted: true, conscienceLost: true } : condition === "missing-action" ? { ...value, actions: [] } : value}
      resources={resources} busy={false} blocked={false} readOnly={condition === "readonly"} onCommand={onCommand} />);
    expect(screen.queryByRole("checkbox", { name: consentLabel })).toBeNull();
    rerender(<UnwingedPanel unwinged={value} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("retains a failed consumed bottle and the S9 character, requiring new consent for bottle two", async () => {
    const state = fixture(9, { unwinged: bottled() });
    const failed: SliceProjection = { ...state, revision: state.revision + 1, health: 66, mind: 68,
      unwinged: { ...state.unwinged, bottles: state.unwinged.bottles.map((bottle) => bottle.id === "unwinged-potion-1" ? { ...bottle, status: "已耗用 · 实际失败，尚未晋升" } : bottle), actions: state.unwinged.actions.slice(1) } };
    const api = bridge(state); api.submitIntent = vi.fn(async (envelope) => receipt(failed, envelope));
    await enter(api); await openUnwinged(); await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第一瓶/ })); await acceptChange();
    await userEvent.click(screen.getByRole("button", { name: "确认服用「第一瓶折翼天使魔药」" }));
    expect(screen.queryByRole("button", { name: /查看并准备服用「第一瓶/ })).toBeNull();
    expect(screen.getByText("已耗用 · 实际失败，尚未晋升")).toBeTruthy();
    expect(screen.getByText(new RegExp(`罪犯 · 序列9 · ${state.character.professionName}`))).toBeTruthy();
    expect(failed.unwinged.conscienceLost).toBe(false); expect(failed.criminal.acting).toBe(100);
    expect(vi.mocked(api.submitIntent).mock.calls[0]![0].payload).toEqual({ type: "UNWINGED", command: consume("unwinged-potion-1") });
    await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ }));
    expect((screen.getByRole("checkbox", { name: consentLabel }) as HTMLInputElement).checked).toBe(false);
    const current = within(screen.getByRole("region", { name: "服药前当前资源" })); expect(current.getByText("66 / 100")).toBeTruthy(); expect(current.getByText("68 / 100")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "暂不服用" })); expect(api.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("uses public action availability and costs without guessing from local AP or mind", async () => {
    const list = cases(); list[0]!.status = "OBSERVED";
    const body = action({ type: "PREPARE", caseId: "cold-grip", method: "BODY" }, "选择公开身体方法");
    const ordinary = action({ type: "PREPARE", caseId: "cold-grip", method: "ORDINARY" }, "选择公开普通方法", false);
    const onCommand = vi.fn(); render(<UnwingedPanel unwinged={unwinged({ promoted: true, conscienceLost: true, cases: list, actions: [body, ordinary] })}
      resources={{ ...resources, mind: 0, spirituality: 0 }} busy={false} blocked={false} onCommand={onCommand} />);
    expect((screen.getByRole("button", { name: /^选择公开身体方法/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /^选择公开普通方法/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(ordinary.reason!)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^选择公开身体方法/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(body.command);
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
  });

  const retryCommands: UnwingedCommand[] = [
    consume("unwinged-potion-2"), { type: "LEARN_GUIDANCE" }, { type: "POTION_WORK", bottleId: "unwinged-potion-3" }, { type: "BUY_POTION", bottleId: "unwinged-potion-3" },
    { type: "REQUEST_SUPPLY" }, { type: "RECEIVE_SUPPLY" }, { type: "OBSERVE", caseId: "cold-grip" },
    { type: "PREPARE", caseId: "cold-grip", method: "BODY" }, { type: "PREPARE", caseId: "cold-grip", method: "ORDINARY" },
    { type: "PERFORM", caseId: "cold-grip" }, { type: "STAND_DOWN", caseId: "cold-grip" }, { type: "REPORT", caseId: "cold-grip" },
    { type: "WITHDRAW", caseId: "cold-grip" }, { type: "REFLECT" },
  ];
  it.each(retryCommands)("retries the identical $type envelope with one initial submission", async (command) => {
    const consuming = command.type === "CONSUME";
    const acquiring = ["CONSUME", "LEARN_GUIDANCE", "POTION_WORK", "BUY_POTION", "REQUEST_SUPPLY", "RECEIVE_SUPPLY"].includes(command.type);
    const state = fixture(acquiring ? 9 : 8, { unwinged: consuming ? bottled() : unwinged({ promoted: !acquiring, conscienceLost: !acquiring,
      cases: acquiring ? [] : cases(), actions: [action(command, "执行这次公开行动")] }), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const api = bridge(state); let finishFirst!: (result: SliceResult<SliceReceipt>) => void;
    const first = new Promise<SliceResult<SliceReceipt>>((resolve) => { finishFirst = resolve; });
    const submit = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>().mockReturnValueOnce(first)
      .mockImplementationOnce(async (envelope) => receipt({ ...state, revision: state.revision + 1, unwinged: { ...state.unwinged, actions: [] } }, envelope));
    api.submitIntent = submit; await enter(api); await openUnwinged();
    if (consuming) { await userEvent.click(screen.getByRole("button", { name: /查看并准备服用「第二瓶/ })); await acceptChange(); }
    const name = consuming ? "确认服用「第二瓶折翼天使魔药」" : /^执行这次公开行动/;
    const button = screen.getByRole("button", { name }); fireEvent.click(button); fireEvent.click(button);
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => { finishFirst({ ok: false, error: { code: "SAVE_FAILED", message: "折翼天使模拟保存失败", retryable: true } }); });
    expect(screen.getByRole("alert").textContent).toContain("折翼天使模拟保存失败");
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    expect(screen.queryByRole("region", { name: "实际执行与报告记录" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toBe(submit.mock.calls[0]![0]);
    expect(submit.mock.calls[1]![0].payload).toEqual({ type: "UNWINGED", command });
    expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "折翼天使成长下一步" })).toBeTruthy();
    if ("caseId" in command) expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe(command.caseId);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads an open urge at zero AP and mind and unlocks only on committed actual step-back", async () => {
    const state = fixture(8, { unwinged: openUrge(), actionsRemaining: 0, mind: 0, spirituality: 0, canAct: false });
    const next: SliceProjection = { ...state, revision: state.revision + 1, unwinged: { ...state.unwinged, insideCase: false, actions: [],
      cases: state.unwinged.cases.map((entry) => entry.id === "refused-price" ? { ...entry, urgeOpen: "已实际退开", restraints: 1 } : entry) } };
    const api = bridge(state); api.submitIntent = vi.fn<(envelope: SliceEnvelope) => Promise<SliceResult<SliceReceipt>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: "SAVE_FAILED", message: "退开尚未保存", retryable: true } })
      .mockImplementationOnce(async (envelope) => receipt(next, envelope));
    await enter(api); await screen.findByRole("region", { name: "折翼天使成长下一步" });
    expect(screen.getByRole("region", { name: "接下来" }).textContent).toContain("先实际松手或退开");
    expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).value).toBe("refused-price");
    expect(screen.queryByRole("button", { name: "关闭非凡成长" })).toBeNull();
    await userEvent.keyboard("{Escape}"); expect(screen.getByRole("dialog", { name: "非凡成长" })).toBeTruthy();
    for (const button of within(screen.getByRole("group", { name: "选择成长卷宗" })).getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector<HTMLElement>(".slice-shell")?.inert).toBe(true);
    expect(screen.getByText("本次普通方法实际失败，成本保留。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^实际退开并停止施压/ }));
    expect(screen.getByRole("alert").textContent).toContain("退开尚未保存");
    expect(screen.getByText("冲动状态：本人尚未退开，须实际处理冲动")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" }));
    const calls = vi.mocked(api.submitIntent).mock.calls; expect(calls[1]![0]).toBe(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual({ type: "UNWINGED", command: { type: "STAND_DOWN", caseId: "refused-price" } });
    expect(screen.getByText("冲动状态：已实际退开")).toBeTruthy(); expect(screen.getByText("实际克制次数：1")).toBeTruthy();
    expect(screen.getByText("角色良知状态：已失去原有良知")).toBeTruthy();
    expect(screen.getByRole("button", { name: "关闭非凡成长" })).toBeTruthy();
    expect(next.health).toBe(state.health); expect(next.mind).toBe(0); expect(next.unwinged.conscienceLost).toBe(true);
  });

  it("does not lock ordinary life for an ordinary pending preparation or historical restraint", async () => {
    const value = unwinged({ promoted: true, conscienceLost: true, cases: cases().map((entry) => ({ ...entry, status: "PREPARED", preparation: "普通方法待执行", restraints: 1 })), actions: [] });
    const api = bridge(fixture(8, { unwinged: value, actionsRemaining: 1 })); await enter(api);
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect([...document.querySelectorAll<HTMLButtonElement>("[data-life-action]")].some((button) => !button.disabled)).toBe(true);
    await openUnwinged(); expect((screen.getByRole("combobox", { name: "选择当前实践" }) as HTMLSelectElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull(); expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
